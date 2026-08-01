/**
 * Motor de Combate (Turn-based Math + Ciclo de Turnos + IA + VFX/Áudio)
 * + Sistema de Distância, Alcance e Movimentação Tática
 */

class BattleSystem {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.turnCount = 1;
        this.isPlayerTurn = true;
        this.isBattleActive = true;

        // Distância entre os combatentes, em "metros" (escala 0-10). Começa num
        // valor médio: armas de alcance curto precisam se aproximar, lanças já
        // atacam de cara, arcos/bestas precisam recuar antes de atirar.
        this.distance = 5;

        // Modificadores de estado temporários (defesa, sangramento/dot,
        // atordoamento, corrida recente, postura de manter distância, e os
        // dois novos status da árvore de Linhagem: barreira/escudo temporário
        // — Luz — e esquiva temporária — Vampirismo).
        this.playerState = { isDefending: false, bleedTurns: 0, bleedDamage: 0, stunned: false, justRan: false, holdingDistance: false, shieldTurns: 0, shieldPercent: 0, evasionTurns: 0, evasionBonus: 0 };
        this.enemyState = { isDefending: false, bleedTurns: 0, bleedDamage: 0, stunned: false, justRan: false, holdingDistance: false, shieldTurns: 0, shieldPercent: 0, evasionTurns: 0, evasionBonus: 0 };

        // Rastreia se o jogador usou alguma magia OFENSIVA (tipo MAGIC) nesta
        // luta — usado pelo Ritual da Luz ("vencer sem usar magia ofensiva").
        // Ataques físicos, curas e habilidades de sangramento/atordoamento
        // continuam livres de usar sem "quebrar" o requisito.
        this.usedOffensiveMagic = false;

        // Renascimento (nó capstone da árvore da Luz) só pode disparar uma
        // vez por batalha — ver checkWinCondition().
        this.autoReviveUsed = false;

        // Memória/emoção/moral/combo do inimigo para esta luta (nunca salvo —
        // só existe durante a batalha, ver ai.js)
        if (window.AICombat) window.AICombat.initBattleState(this);
    }

    // Altera a distância, sempre mantida entre 0 e 10
    applyDistanceChange(delta) {
        this.distance = Utils.clamp(this.distance + delta, 0, 10);
    }

    // Confere se a distância atual está dentro de um alcance {min, max}
    isInRange(range) {
        return this.distance >= range.min && this.distance <= range.max;
    }

    // Multiplicador de dano por alcance: null = fora do alcance máximo (bloqueia
    // o ataque, como antes); 1 = alcance normal; 0.6 = alvo mais perto do que o
    // alcance mínimo da arma (ex: lança/chicote) — ainda acerta, mas com 40% a
    // menos de dano, em vez do bloqueio total que existia antes.
    _weaponRangeMulti(range) {
        if (this.distance > range.max) return null;
        if (this.distance < range.min) return 0.6;
        return 1;
    }

    // Enchantments (ver enchantments.js) só existem na arma/armadura ATIVA do
    // atacante — nunca no corpo dele. Retorna null se não houver nenhum.
    _getWeaponEnchantment(entity) {
        const weapon = entity.getActiveWeapon ? entity.getActiveWeapon() : null;
        return weapon && window.EnchantmentSystem ? window.EnchantmentSystem.get(weapon) : null;
    }

    // Soma os bônus defensivos de encantamentos SAGRADO/PROFANO quando
    // aplicados numa peça de armadura equipada (onDefend) — independente da
    // arma. Percorre só os slots de armadura/acessório, nunca as armas.
    _getArmorEnchantmentDefense(entity) {
        const bonus = { defenseBonusPercent: 0, dodgeBonusPercent: 0 };
        if (!entity.equipment || !window.EnchantmentSystem) return bonus;
        const armorSlots = [SLOTS.HEAD, SLOTS.CHEST, SLOTS.HANDS, SLOTS.LEGS, SLOTS.FEET, SLOTS.OFF_HAND];
        armorSlots.forEach(slot => {
            const item = entity.equipment[slot];
            const ench = item ? window.EnchantmentSystem.get(item) : null;
            if (ench && ench.onDefend) {
                const eff = ench.onDefend(entity);
                if (eff.defenseBonusPercent) bonus.defenseBonusPercent += eff.defenseBonusPercent;
                if (eff.dodgeBonusPercent) bonus.dodgeBonusPercent += eff.dodgeBonusPercent;
            }
        });
        return bonus;
    }

    // Calcula dano, acerto e crítico de um ataque físico básico, e dispara VFX/SFX.
    // damageMulti (padrão 1) permite bônus de dano de ações especiais (ex: Investida)
    // sem alterar o cálculo de nenhuma chamada existente.
    // Aplica o multiplicador de fraqueza entre Linhagens (ver
    // LineageSystem.getWeaknessMultiplier) a um dano bruto já calculado —
    // usado por TODA fonte de dano (ataque padrão em executeAttack e as
    // habilidades PHYSICAL/BLEED/STUN/LIFESTEAL/MAGIC no turno do jogador e
    // do inimigo), garantindo que a fraqueza de cada Linhagem seja real
    // não importa como o dano foi causado. `attacker.lineage`/`defender.lineage`
    // só existem em jogadores/bosses com mutação; inimigos comuns não têm o
    // campo, então a função retorna o dano sem alteração nesse caso.
    applyLineageWeakness(attacker, defender, damage) {
        if (!window.LineageSystem) return damage;
        const mult = window.LineageSystem.getWeaknessMultiplier(attacker.lineage, defender.lineage);
        return mult !== 1 ? Math.floor(damage * mult) : damage;
    }

    executeAttack(attacker, defender, attackerState, defenderState, damageMulti = 1, isCounter = false) {
        const isPlayer = attacker === this.player;
        const defX = window.GFX.getEntityX(!isPlayer, window.innerWidth);
        const defY = window.innerHeight / 2;
        const armorDef = this._getArmorEnchantmentDefense(defender);

        // 1. Cálculo de Acerto (Precisão vs Esquiva), com bônus de precisão da arma.
        // Quem correu no turno anterior (Correr) fica com a esquiva reduzida.
        // Véu da Noite (Vampirismo) e outros efeitos de esquiva temporária
        // somam evasionBonus enquanto evasionTurns > 0.
        const weaponAcc = attacker.getWeaponAccBonus ? attacker.getWeaponAccBonus() : 0;
        let effectiveDodge = defender.derivedStats.dodgeChance + (armorDef.dodgeBonusPercent || 0);
        if (defenderState.evasionTurns > 0) effectiveDodge += defenderState.evasionBonus;
        if (defenderState.justRan) {
            effectiveDodge *= 0.5;
            defenderState.justRan = false; // efeito consumido nesta tentativa de ataque
        }
        let hitChance = 90 + (attacker.getTotalStat('acc') * 2) + weaponAcc - effectiveDodge;
        hitChance = Utils.clamp(hitChance, 20, 100); // Mínimo de 20% de chance de acerto

        if (window.GFX) {
            // Armas rápidas (adaga, rapieira) golpeiam com um gesto curto e
            // seco; armas pesadas (martelo, machado) têm um giro mais lento
            // e visivelmente mais "pesado" — reforça a identidade de cada
            // arma além dos números de dano/alcance já existentes.
            const atkSpeed = (attacker.getWeaponSpeed ? attacker.getWeaponSpeed().atkSpeed : 1) || 1;
            window.GFX.playAnim(isPlayer, 'attack', Utils.clamp(650 / atkSpeed, 420, 1150));
        }

        if (!Utils.chance(hitChance)) {
            if (window.GFX) {
                window.GFX.spawnText(defX, defY - 50, "ESQUIVOU!", "#aaaaaa");
                window.GFX.playAnim(!isPlayer, 'dodge');
            }
            return { hit: false, crit: false, damage: 0, message: `${attacker.name} errou o ataque!` };
        }

        // 2. Cálculo de Crítico — Linhagens com HP baixo (Vampirismo:
        // "Sanguinário") podem ganhar chance crítica extra nessa condição.
        const attackerLowHp = attacker.derivedStats.maxHp > 0 && (attacker.currentHp / attacker.derivedStats.maxHp) <= 0.3;
        const critBonus = (attackerLowHp && attacker.derivedStats.critChanceLowHpBonus) ? attacker.derivedStats.critChanceLowHpBonus : 0;
        let isCrit = Utils.chance(attacker.derivedStats.critChance + critBonus);

        // 3. Cálculo de Dano Base (com multiplicador de ação especial, se
        // houver, e o bônus de dano com HP baixo de linhagens como Vampirismo)
        let damage = Math.floor(attacker.derivedStats.physicalDamage * damageMulti);
        if (attackerLowHp && attacker.derivedStats.lowHpDamageBonusPercent) {
            damage = Math.floor(damage * (1 + attacker.derivedStats.lowHpDamageBonusPercent / 100));
        }
        // Fraqueza entre Linhagens (ex: um atacante "luz" causa +25% contra um
        // defensor "vampirismo", já que a fraqueza declarada do Vampirismo é a
        // Luz — ver LINEAGES em lineages.js).
        damage = this.applyLineageWeakness(attacker, defender, damage);
        if (isCrit) damage = Math.floor(damage * 1.5); // Crítico padrão x1.5

        // 4. Mitigação por Defesa, reduzida pela perfuração de armadura da arma do atacante
        const armorPierce = attacker.getWeaponArmorPierce ? attacker.getWeaponArmorPierce() : 0;
        let defenseRating = defender.derivedStats.defenseRating * (1 - armorPierce);
        if (armorDef.defenseBonusPercent) defenseRating *= (1 + armorDef.defenseBonusPercent / 100);
        if (defenderState.isDefending) {
            defenseRating *= 2; // Dobra a defesa se usou a ação "Defender" no turno
        }

        // Fórmula AAA: Armor Damage Reduction = Def / (Def + 50)
        let reductionPercent = defenseRating / (defenseRating + 50);
        let mitigatedDamage = Math.floor(damage * (1 - reductionPercent));

        // Variação de dano (RNG 10%)
        mitigatedDamage = Math.floor(mitigatedDamage * Utils.randomFloat(0.9, 1.1));
        if (mitigatedDamage < 1) mitigatedDamage = 1; // Mínimo 1 de dano

        // 5. Chance de Bloqueio (escudo): reduz o dano final pela metade, independente da esquiva/defesa
        let blocked = false;
        if (defender.derivedStats.blockChance > 0 && Utils.chance(defender.derivedStats.blockChance)) {
            blocked = true;
            mitigatedDamage = Math.max(1, Math.floor(mitigatedDamage * 0.5));
        }

        // 5b. Barreira temporária (Escudo Dourado, Luz) reduz uma % fixa do
        // dano já mitigado — empilha com defesa/bloqueio, mas só dura N turnos.
        if (defenderState.shieldTurns > 0) {
            mitigatedDamage = Math.max(1, Math.floor(mitigatedDamage * (1 - defenderState.shieldPercent / 100)));
        }

        // 5c. Encantamento da arma do atacante (ver enchantments.js) — dano
        // elemental extra, chance de efeito negativo (reduzida pela
        // resistência a efeitos negativos da Linhagem Luz do defensor), e
        // sangramento/queimadura/veneno contínuos (reduzidos pela resistência
        // a sangramento da Linhagem Vampirismo do defensor).
        const enchant = this._getWeaponEnchantment(attacker);
        let enchantEff = null;
        if (enchant && enchant.onHit) {
            const negResist = (defender.derivedStats.negativeEffectResistPercent || 0) / 100;
            enchantEff = enchant.onHit(attacker, defender);
            if (enchantEff.extraDamage) mitigatedDamage += enchantEff.extraDamage;
            if (enchantEff.dot) {
                // A resistência a sangramento (Vampirismo) é aplicada a cada
                // tique (ver applyBleedTick), não aqui — assim protege contra
                // QUALQUER fonte de dano contínuo, não só encantamentos.
                //
                // Bug de auditoria: `dot.stacks` (ver enchantments.js,
                // encantamento Sangramento — "acumula com golpes repetidos"
                // na própria descrição mostrada ao jogador no tooltip) nunca
                // era lido aqui; TODO dot (com ou sem `stacks`) sempre
                // sobrescrevia bleedTurns/bleedDamage direto, então acertar
                // duas vezes com uma arma de Sangramento só reiniciava o
                // sangramento pro MESMO valor base, nunca acumulava — a
                // mecânica prometida no próprio texto do encantamento nunca
                // funcionou de verdade. Com `stacks: true` e um sangramento
                // já ativo, agora SOMA o dano do tique em vez de substituir
                // (e ainda renova a duração, senão o efeito somado
                // terminaria antes do previsto).
                if (enchantEff.dot.stacks && defenderState.bleedTurns > 0) {
                    defenderState.bleedDamage += Math.max(1, enchantEff.dot.damage);
                } else {
                    defenderState.bleedDamage = Math.max(1, enchantEff.dot.damage);
                }
                defenderState.bleedTurns = enchantEff.dot.turns;
            }
            if (enchantEff.stunChance && Utils.chance(enchantEff.stunChance * (1 - negResist))) defenderState.stunned = true;
            if (enchantEff.slowChance && Utils.chance(enchantEff.slowChance * (1 - negResist))) defenderState.justRan = true; // reaproveita a penalidade de esquiva já existente como "lentidão"
            if (window.GFX && enchantEff.particleColor) window.GFX.spawnParticles(defX, defY, enchantEff.particleColor, 10, 4, 3);
        }

        defender.currentHp -= mitigatedDamage;
        if (defender.currentHp < 0) defender.currentHp = 0;

        // 5d. Roubo de vida passivo da Linhagem (Vampirismo) — cura o
        // atacante por uma % do dano causado, com bônus extra em críticos.
        // Totalmente separado do LIFESTEAL de habilidades específicas (que
        // já tem seu próprio roubo de vida embutido), soma-se por cima.
        // Bug de auditoria: esse bloco inteiro só rodava dentro de
        // `if (attacker.derivedStats.lifestealPercent)`, mas a passiva
        // racial do Orco ("Fúria Sanguinária: acertos críticos roubam +12%
        // do dano como HP", races.js) alimenta SÓ drainOnCritPercent, nunca
        // lifestealPercent (esse só vem da árvore de Vampirismo). Um Orco
        // que não tivesse TAMBÉM despertado a Linhagem Vampirismo (a
        // esmagadora maioria) tinha lifestealPercent sempre 0 — o gate
        // nunca abria, e a passiva prometida na criação de personagem e na
        // ficha nunca surtia efeito em nenhuma batalha. Agora calcula o
        // percentual combinado primeiro e só depois decide se há algo a
        // curar, então drainOnCritPercent funciona sozinho, sem depender
        // de lifestealPercent também ser diferente de zero.
        let lifestealHealed = 0;
        let lsPercent = attacker.derivedStats.lifestealPercent || 0;
        if (isCrit && attacker.derivedStats.drainOnCritPercent) lsPercent += attacker.derivedStats.drainOnCritPercent;
        if (lsPercent > 0) {
            lifestealHealed = Math.floor(mitigatedDamage * (lsPercent / 100));
            if (lifestealHealed > 0) {
                attacker.currentHp = Utils.clamp(attacker.currentHp + lifestealHealed, 0, attacker.derivedStats.maxHp);
            }
        }
        if (enchantEff) {
            if (enchantEff.healPercent) attacker.currentHp = Utils.clamp(attacker.currentHp + Math.floor(mitigatedDamage * (enchantEff.healPercent / 100)), 0, attacker.derivedStats.maxHp);
            if (enchantEff.lifestealPercent) attacker.currentHp = Utils.clamp(attacker.currentHp + Math.floor(mitigatedDamage * (enchantEff.lifestealPercent / 100)), 0, attacker.derivedStats.maxHp);
        }

        // --- Camada Visual/Sonora ---
        if (window.GFX) {
            const textColor = isCrit ? '#ffcc00' : (blocked ? '#88ccff' : '#ffffff');
            window.GFX.spawnText(defX, defY - 50, `-${mitigatedDamage}`, textColor, isCrit);
            const particleColor = blocked ? '#88ccff' : (defenderState.isDefending ? '#cccccc' : '#cc0000');
            window.GFX.spawnParticles(defX, defY, particleColor, isCrit ? 30 : 15, isCrit ? 8 : 4);
            window.GFX.playAnim(!isPlayer, 'hurt');
            if (isCrit) window.GFX.spawnCritBurst(defX, defY);
            if (lifestealHealed > 0) {
                const atkX = window.GFX.getEntityX(isPlayer, window.innerWidth);
                window.GFX.spawnText(atkX, window.innerHeight / 2 - 50, `+${lifestealHealed}`, '#c81e2a', false);
            }
        }
        if (window.Engine) window.Engine.triggerShake(isCrit ? 15 : 3, isCrit ? 0.3 : 0.1);
        if (window.AudioManager) {
            isCrit ? window.AudioManager.playCrit() : window.AudioManager.playSwordClash();
            if (defender.visuals && defender.visuals.gender) window.AudioManager.playHitGrunt(defender.visuals.gender);
        }

        let msg;
        if (isCrit) msg = `ACERTO CRÍTICO! ${attacker.name} causou ${mitigatedDamage} de dano.`;
        else if (blocked) msg = `${defender.name} bloqueou parcialmente o ataque com o escudo! (${mitigatedDamage} de dano)`;
        else msg = `${attacker.name} atacou e causou ${mitigatedDamage} de dano.`;
        if (lifestealHealed > 0) msg += ` <span style="color:#c81e2a">${attacker.name} drena ${lifestealHealed} HP!</span>`;

        // Contra-ataque de escudo: um bloqueio bem-sucedido dá chance de o
        // defensor revidar na hora com um golpe rápido e mais fraco — o
        // escudo passa a servir tanto pra defesa quanto pra represália,
        // sem criar nenhum sistema novo (reaproveita o próprio executeAttack).
        let counter = null;
        if (blocked && !isCounter && defender.currentHp > 0 && attacker.currentHp > 0) {
            const riposteChance = Math.min(45, defender.derivedStats.blockChance * 1.5);
            if (Utils.chance(riposteChance)) {
                counter = this.executeAttack(defender, attacker, defenderState, attackerState, 0.45, true);
                msg += ` <span style="color:#88ccff">${defender.name} contra-ataca com o escudo! ${counter.message}</span>`;
            }
        }

        return { hit: true, crit: isCrit, blocked, damage: mitigatedDamage, message: msg, counter };
    }

    // Aplica o tique de sangramento (Corte Sangrento) no início do turno da vítima.
    // Retorna a mensagem de log, ou null se não houver sangramento ativo.
    applyBleedTick(target, state, isPlayerTarget) {
        if (!state.bleedTurns || state.bleedTurns <= 0) return null;

        // Resistência a sangramento (Vampirismo) reduz o dano de QUALQUER
        // fonte contínua (habilidade de sangramento OU encantamento de
        // fogo/veneno/sangramento) — aplicada aqui, no tique, não na origem.
        const resist = (target.derivedStats && target.derivedStats.bleedResistPercent) || 0;
        const tickDamage = Math.max(1, Math.floor(state.bleedDamage * (1 - resist / 100)));

        target.currentHp = Utils.clamp(target.currentHp - tickDamage, 0, target.derivedStats.maxHp);
        state.bleedTurns--;

        const x = window.GFX.getEntityX(isPlayerTarget, window.innerWidth);
        const y = window.innerHeight / 2;
        if (window.GFX) {
            window.GFX.spawnText(x, y - 80, `-${tickDamage}`, '#ff3333', false);
            window.GFX.spawnParticles(x, y, '#8b0000', 10, 3, 3);
        }

        return `<span style="color:#ff5555">${target.name} sofre ${tickDamage} de dano por sangramento!</span>`;
    }

    // Processa o fim do combate
    checkWinCondition() {
        if (this.enemy.currentHp <= 0) {
            this.isBattleActive = false;
            return 'VICTORY';
        }

        // Renascimento (Luz, tier 4 — ver skilltrees.js): uma vez por
        // batalha, cair abaixo de 20% de HP cura 25% do HP máximo na hora.
        // O nó já existia e custava pontos de mutação reais, mas nada lia
        // `derivedStats.mutationSpecials` — o efeito nunca disparava.
        const specials = this.player.derivedStats && this.player.derivedStats.mutationSpecials;
        if (specials && specials.includes('auto_revive_heal') && !this.autoReviveUsed &&
            this.player.currentHp > 0 && this.player.currentHp < this.player.derivedStats.maxHp * 0.2) {
            this.autoReviveUsed = true;
            const healAmount = Math.floor(this.player.derivedStats.maxHp * 0.25);
            this.player.currentHp = Utils.clamp(this.player.currentHp + healAmount, 0, this.player.derivedStats.maxHp);
            if (window.GFX) {
                const playerX = window.GFX.getEntityX(true, window.innerWidth);
                const playerY = window.innerHeight / 2;
                window.GFX.spawnText(playerX, playerY - 60, `+${healAmount}`, '#ffe9a3', false);
                window.GFX.spawnParticles(playerX, playerY, '#ffe9a3', 30, 5, 5);
            }
            if (window.UI && window.UI.appendBattleLog) {
                window.UI.appendBattleLog(`<span style="color:#ffe9a3">Renascimento: a Luz interior te salva, curando ${healAmount} HP!</span>`);
            }
        }

        if (this.player.currentHp <= 0) {
            this.isBattleActive = false;
            return 'DEFEAT';
        }
        return 'ONGOING';
    }

    // Processa a ação do Jogador (Atacar, Defender, Habilidade, Item ou Movimentação Tática)
    executePlayerTurn(actionCode, param = null) {
        if (!this.isBattleActive || !this.isPlayerTurn) return;

        this.isPlayerTurn = false;
        this.playerState.isDefending = false; // Reseta a defesa do turno anterior
        this.playerState.holdingDistance = false; // Reseta a postura de manter distância
        window.UI.toggleBattleButtons(false); // Bloqueia a UI
        if (this.player.tickCooldowns) this.player.tickCooldowns(); // Recargas de habilidade avançam a cada turno do jogador

        // Sangramento/dot do jogador tica no início do turno dele — espelha
        // exatamente o tique do inimigo em executeEnemyTurn. Bug corrigido
        // nesta atualização: antes, sangramento infligido NO JOGADOR nunca
        // chegava a causar dano nenhum (só o do inimigo ticava).
        const playerBleedMsg = this.applyBleedTick(this.player, this.playerState, true);
        if (playerBleedMsg) {
            window.UI.appendBattleLog(playerBleedMsg);
            window.UI.updateBattleBars();
            const bleedStatus = this.checkWinCondition();
            if (bleedStatus !== 'ONGOING') {
                this.endBattle(bleedStatus);
                return;
            }
        }

        // Regeneração de HP por turno (Linhagem — Vigília Noturna/
        // Regeneração Vampírica etc, ver skilltrees.js)
        if (this.player.derivedStats.hpRegenPerTurn > 0) {
            const regenAmount = Math.floor(this.player.derivedStats.maxHp * (this.player.derivedStats.hpRegenPerTurn / 100));
            if (regenAmount > 0 && this.player.currentHp > 0) {
                this.player.currentHp = Utils.clamp(this.player.currentHp + regenAmount, 0, this.player.derivedStats.maxHp);
                window.UI.appendBattleLog(`<span style="color:#c81e2a">${this.player.name} regenera ${regenAmount} HP com sua Linhagem.</span>`);
                window.UI.updateBattleBars();
            }
        }

        // Contagem regressiva de barreira/esquiva temporárias da Linhagem
        if (this.playerState.shieldTurns > 0) this.playerState.shieldTurns--;
        if (this.playerState.evasionTurns > 0) this.playerState.evasionTurns--;

        // Instantâneos usados só para a IA do inimigo "perceber" o que aconteceu
        // neste turno (memória de batalha, ver ai.js) — não influenciam a lógica
        const enemyHpBefore = this.enemy.currentHp;
        const playerHpAtDecision = this.player.currentHp;

        const playerX = window.GFX.getEntityX(true, window.innerWidth);
        const playerY = window.innerHeight / 2;
        const enemyX = window.GFX.getEntityX(false, window.innerWidth);
        const enemyY = window.innerHeight / 2;

        let resultMsg = "";

        if (actionCode === 'ATK') {
            const range = this.player.getWeaponRange();
            const rangeMulti = this._weaponRangeMulti(range);
            if (rangeMulti === null) {
                resultMsg = `${this.enemy.name} está fora do alcance da sua arma! Aproxime-se primeiro.`;
                this.isPlayerTurn = true;
                window.UI.toggleBattleButtons(true);
                window.UI.appendBattleLog(resultMsg);
                window.AudioManager.playError();
                return;
            }

            // Armas de longo alcance têm munição limitada — sem isso, alcançar
            // o mapa inteiro seria dano ilimitado sem nenhum custo tático.
            const rangedWeapon = this.player.getActiveWeapon();
            if (rangedWeapon && rangedWeapon.maxAmmo) {
                if (rangedWeapon.ammo <= 0) {
                    resultMsg = `Sem munição para ${rangedWeapon.name}! Troque de arma ou use uma habilidade de recarga.`;
                    this.isPlayerTurn = true;
                    window.UI.toggleBattleButtons(true);
                    window.UI.appendBattleLog(resultMsg);
                    window.AudioManager.playError();
                    return;
                }
                rangedWeapon.ammo--;
            }

            const atkResult = this.executeAttack(this.player, this.enemy, this.playerState, this.enemyState, rangeMulti);
            resultMsg = atkResult.message;
            if (rangeMulti < 1) {
                resultMsg += ` (alvo muito perto para sua arma — dano reduzido)`;
            }
            if (rangedWeapon && rangedWeapon.maxAmmo) {
                resultMsg += ` (Munição: ${rangedWeapon.ammo}/${rangedWeapon.maxAmmo})`;
            }
        }
        else if (actionCode === 'SWITCH_WEAPON') {
            if (!this.player.hasDualWeapons()) {
                resultMsg = "Você precisa de uma arma corpo a corpo e uma de longo alcance equipadas para trocar.";
                this.isPlayerTurn = true;
                window.UI.toggleBattleButtons(true);
                window.UI.appendBattleLog(resultMsg);
                window.AudioManager.playError();
                return;
            }
            this.player.activeWeaponSlot = (this.player.activeWeaponSlot === SLOTS.MAIN_HAND) ? SLOTS.RANGED : SLOTS.MAIN_HAND;
            this.player.calculateDerivedStats();
            const newWeapon = this.player.getActiveWeapon();
            resultMsg = `${this.player.name} troca de arma, agora empunhando ${newWeapon ? newWeapon.name : 'as mãos nuas'}!`;
            if (window.GFX) window.GFX.playAnim(true, 'approach', 500);
        }
        else if (actionCode === 'DEF') {
            this.playerState.isDefending = true;
            resultMsg = `${this.player.name} assumiu uma postura defensiva!`;
        }
        else if (actionCode === 'HOLD') {
            this.playerState.holdingDistance = true;
            resultMsg = `${this.player.name} se posiciona com cautela, pronto para manter a distância!`;
        }
        else if (actionCode === 'APPROACH') {
            // Bug de auditoria: a resistência de HOLD (ver enemyState.
            // holdingDistance) só era conferida do lado do inimigo (a
            // APPROACH dele já lia playerState.holdingDistance) — o
            // APPROACH do JOGADOR nunca conferia o mesmo estado do
            // inimigo, deixando "manter distância" funcionar só a favor
            // do jogador, nunca contra ele.
            const speed = this.player.getWeaponSpeed();
            const resisted = this.enemyState.holdingDistance;
            let amount = speed.approachSpeed;
            if (resisted) amount *= 0.5;
            this.applyDistanceChange(-amount);
            resultMsg = resisted
                ? `${this.player.name} tenta avançar, mas ${this.enemy.name} mantém a distância!`
                : `${this.player.name} avança em direção ao oponente. (Distância: ${this.distance.toFixed(1)}m)`;
            if (window.GFX) {
                window.GFX.playAnim(true, 'approach', 700);
                if (resisted) window.GFX.playAnim(false, 'push', 500);
            }
        }
        else if (actionCode === 'RETREAT') {
            const speed = this.player.getWeaponSpeed();
            this.applyDistanceChange(speed.retreatSpeed);
            resultMsg = `${this.player.name} recua, abrindo distância. (Distância: ${this.distance.toFixed(1)}m)`;
            if (window.GFX) window.GFX.playAnim(true, 'retreat', 700);
        }
        else if (actionCode === 'RUN') {
            const speed = this.player.getWeaponSpeed();
            this.applyDistanceChange(-speed.approachSpeed * 2);
            this.playerState.justRan = true; // fica vulnerável (menos esquiva) no próximo ataque sofrido
            resultMsg = `${this.player.name} corre para encurtar a distância rapidamente! (Distância: ${this.distance.toFixed(1)}m)`;
            if (window.GFX) window.GFX.playAnim(true, 'run', 700);
        }
        else if (actionCode === 'CHARGE') {
            const speed = this.player.getWeaponSpeed();
            this.applyDistanceChange(-speed.approachSpeed * 2);
            if (window.GFX) window.GFX.playAnim(true, 'charge', 700);

            const range = this.player.getWeaponRange();
            const chargeWeapon = this.player.getActiveWeapon();
            const outOfAmmo = chargeWeapon && chargeWeapon.maxAmmo && chargeWeapon.ammo <= 0;
            const rangeMulti = this._weaponRangeMulti(range);
            if (rangeMulti !== null && !outOfAmmo) {
                if (chargeWeapon && chargeWeapon.maxAmmo) chargeWeapon.ammo--;
                const atkResult = this.executeAttack(this.player, this.enemy, this.playerState, this.enemyState, 1.2 * rangeMulti);
                resultMsg = `${this.player.name} investiu contra o oponente! ${atkResult.message}`;
                if (rangeMulti < 1) resultMsg += ` (alvo muito perto — dano reduzido)`;
                if (chargeWeapon && chargeWeapon.maxAmmo) resultMsg += ` (Munição: ${chargeWeapon.ammo}/${chargeWeapon.maxAmmo})`;
            } else if (outOfAmmo) {
                resultMsg = `${this.player.name} investiu, mas está sem munição para ${chargeWeapon.name}!`;
            } else {
                resultMsg = `${this.player.name} investiu, mas ainda não alcançou o oponente. (Distância: ${this.distance.toFixed(1)}m)`;
            }
        }
        else if (actionCode === 'ITEM') {
            const result = this.player.useConsumable(param);
            if (result) {
                resultMsg = `${this.player.name} usou ${result.name}. ${result.message}.`;
                window.GFX.spawnText(playerX, playerY - 50, result.message.includes('MP') ? '+MP' : '+HP', '#1eff00', false);
                window.GFX.spawnParticles(playerX, playerY, '#1eff00', 20, 4, 4);
                window.AudioManager.playHeal();
            } else {
                resultMsg = "Item indisponível.";
                this.isPlayerTurn = true;
                window.UI.toggleBattleButtons(true);
                window.UI.appendBattleLog(resultMsg);
                return;
            }
        }
        else if (actionCode === 'SKILL' && param) {
            const skillId = param;
            const skill = window.SkillDB[skillId];

            // Recarga: impede o uso se a habilidade ainda não recuperou os turnos de cooldown
            if (this.player.skillCooldowns && this.player.skillCooldowns[skillId] > 0) {
                resultMsg = `${skill.name} ainda está recarregando! (${this.player.skillCooldowns[skillId]} turno(s) restante(s))`;
                this.isPlayerTurn = true;
                window.UI.toggleBattleButtons(true);
                window.UI.appendBattleLog(resultMsg);
                window.AudioManager.playError();
                return;
            }

            if (this.player.currentMp >= skill.mpCost) {
                // Alcance da habilidade: físicas usam o alcance da arma; mágicas usam
                // o alcance próprio (skill.range); cura não tem restrição de alcance.
                let skillRange = null;
                if (skill.type === 'PHYSICAL' || skill.type === 'BLEED' || skill.type === 'STUN' || skill.type === 'LIFESTEAL') {
                    skillRange = this.player.getWeaponRange();
                } else if (skill.type === 'MAGIC' && skill.range !== undefined) {
                    skillRange = { min: 0, max: skill.range };
                }

                if (skillRange && !this.isInRange(skillRange)) {
                    resultMsg = `${this.enemy.name} está fora do alcance de ${skill.name}!`;
                    this.isPlayerTurn = true;
                    window.UI.toggleBattleButtons(true);
                    window.UI.appendBattleLog(resultMsg);
                    window.AudioManager.playError();
                    return;
                }

                this.player.currentMp -= skill.mpCost;
                if (skill.cooldown && this.player.setSkillCooldown) this.player.setSkillCooldown(skillId, skill.cooldown);
                if (window.GFX) window.GFX.playAnim(true, skill.animation || 'attack', 700);

                if (skill.type === 'HEAL') {
                    // Cura base = Inteligência * 2.5 * powerMulti, com bônus de
                    // poder de cura da Linhagem (Luz: Luz Interior/Bênção Maior/etc)
                    const healMult = 1 + ((this.player.derivedStats.healPowerBonusPercent || 0) / 100);
                    const healAmount = Math.floor(this.player.getTotalStat('int') * 2.5 * skill.powerMulti * healMult);
                    this.player.currentHp = Utils.clamp(this.player.currentHp + healAmount, 0, this.player.derivedStats.maxHp);
                    resultMsg = `<span style="color:#1eff00">${this.player.name} usou ${skill.name} e recuperou ${healAmount} HP!</span>`;
                    // Santuário (Luz): também purifica sangramento/venenos/atordoamento
                    // ativos NO PRÓPRIO jogador (não no inimigo)
                    if (skill.cleanse) {
                        this.playerState.bleedTurns = 0;
                        this.playerState.bleedDamage = 0;
                        this.playerState.stunned = false;
                        resultMsg += ` <span style="color:#fff2c0">Efeitos negativos purificados!</span>`;
                    }
                    window.GFX.spawnText(playerX, playerY - 50, `+${healAmount}`, "#1eff00", false);
                    window.GFX.spawnParticles(playerX, playerY, "#1eff00", 25, 4, 4);
                    window.AudioManager.playHeal();
                }
                else if (skill.type === 'MAGIC') {
                    // Dano mágico ignora armadura, mitigado apenas pela Inteligência do inimigo
                    this.usedOffensiveMagic = true; // rastreado pro Ritual da Luz ("vencer sem magia ofensiva")
                    const magicDmg = this.applyLineageWeakness(this.player, this.enemy, Math.floor(this.player.getTotalStat('int') * 3 * skill.powerMulti));
                    const resist = this.enemy.getTotalStat('int') * 0.5;
                    let finalDmg = Math.floor(magicDmg - resist);
                    if (finalDmg < 1) finalDmg = 1;

                    this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - finalDmg, 0, this.enemy.derivedStats.maxHp);
                    resultMsg = `<span style="color:#a335ee">${this.player.name} conjurou ${skill.name} causando ${finalDmg} de Dano Mágico!</span>`;
                    window.GFX.spawnText(enemyX, enemyY - 50, `-${finalDmg}`, "#a335ee", true);
                    window.GFX.spawnParticles(enemyX, enemyY, "#a335ee", 40, 6, 5);
                    window.GFX.playAnim(false, 'hurt', 500);
                    window.Engine.triggerShake(8, 0.2);
                    window.AudioManager.playMagicCast();
                }
                else if (skill.type === 'PHYSICAL') {
                    // Aproveita o cálculo base de ataque físico, com bônus de acerto e multiplicador de poder
                    let hitChance = 110 + (this.player.getTotalStat('acc') * 2) - this.enemy.derivedStats.dodgeChance;
                    if (Utils.chance(hitChance)) {
                        let damage = this.applyLineageWeakness(this.player, this.enemy, Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti));
                        let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                        let mitigatedDamage = Math.floor(damage * (1 - reductionPercent));
                        if (mitigatedDamage < 1) mitigatedDamage = 1;

                        this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                        resultMsg = `<span style="color:var(--color-gold)">${this.player.name} executou ${skill.name} causando esmagadores ${mitigatedDamage} de Dano!</span>`;
                        window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#ffcc00", true);
                        window.GFX.spawnParticles(enemyX, enemyY, "#cc0000", 25, 6, 5);
                        window.GFX.playAnim(false, 'hurt', 500, true);
                        window.Engine.triggerShake(10, 0.25);
                        window.AudioManager.playSwordClash();
                    } else {
                        resultMsg = `${this.player.name} usou ${skill.name} mas errou o alvo!`;
                    }
                }
                else if (skill.type === 'BLEED') {
                    let damage = this.applyLineageWeakness(this.player, this.enemy, Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti));
                    let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                    let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));

                    this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                    this.enemyState.bleedTurns = skill.duration;
                    this.enemyState.bleedDamage = Math.max(1, Math.floor(this.player.getTotalStat('str') * 0.8));

                    resultMsg = `<span style="color:#ff5555">${this.player.name} usou ${skill.name}, causando ${mitigatedDamage} de dano e sangramento!</span>`;
                    window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#ff3333", false);
                    window.GFX.spawnParticles(enemyX, enemyY, "#8b0000", 25, 5, 4);
                    window.GFX.playAnim(false, 'hurt', 500);
                    window.AudioManager.playSwordClash();
                }
                else if (skill.type === 'STUN') {
                    let damage = this.applyLineageWeakness(this.player, this.enemy, Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti));
                    let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                    let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));

                    this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                    // Resistência a efeitos negativos (Ateniense/Linhagem Luz do
                    // defensor) — já era aplicada ao stun de encantamento de arma
                    // (ver executeAttack, linha ~186), mas faltava aqui: quem
                    // investisse na árvore da Luz ou escolhesse Ateniense
                    // continuava sendo atordoado na chance bruta sempre que o
                    // stun vinha de uma habilidade tipo STUN em vez de encantamento.
                    const negResist = (this.enemy.derivedStats.negativeEffectResistPercent || 0) / 100;
                    const stunned = Utils.chance(skill.stunChance * (1 - negResist));
                    if (stunned) this.enemyState.stunned = true;

                    resultMsg = stunned
                        ? `<span style="color:#3388ff">${this.player.name} usou ${skill.name}: ${mitigatedDamage} de dano e ${this.enemy.name} ficou atordoado!</span>`
                        : `<span style="color:#3388ff">${this.player.name} usou ${skill.name}, causando ${mitigatedDamage} de dano.</span>`;
                    window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#3388ff", false);
                    window.GFX.spawnParticles(enemyX, enemyY, "#3388ff", 25, 5, 4);
                    window.GFX.playAnim(false, 'hurt', 500);
                    window.Engine.triggerShake(6, 0.15);
                    window.AudioManager.playSwordClash();
                }
                else if (skill.type === 'LIFESTEAL') {
                    let hitChance = 100 + (this.player.getTotalStat('acc') * 2) - this.enemy.derivedStats.dodgeChance;
                    if (Utils.chance(hitChance)) {
                        let damage = this.applyLineageWeakness(this.player, this.enemy, Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti));
                        let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                        let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));

                        this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                        const healed = Math.floor(mitigatedDamage * (skill.lifestealPercent / 100));
                        this.player.currentHp = Utils.clamp(this.player.currentHp + healed, 0, this.player.derivedStats.maxHp);

                        resultMsg = `<span style="color:#aa0044">${this.player.name} usou ${skill.name}: ${mitigatedDamage} de dano, recuperando ${healed} HP!</span>`;
                        window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#ff0066", true);
                        window.GFX.spawnText(playerX, playerY - 50, `+${healed}`, "#1eff00", false);
                        window.GFX.spawnParticles(enemyX, enemyY, "#aa0044", 30, 6, 5);
                        window.GFX.playAnim(false, 'hurt', 500, true);
                        window.Engine.triggerShake(10, 0.2);
                        window.AudioManager.playCrit();
                    } else {
                        resultMsg = `${this.player.name} usou ${skill.name} mas errou o alvo!`;
                    }
                }
                else if (skill.type === 'TELEPORT_ENEMY') {
                    this.distance = 0;
                    resultMsg = `<span style="color:#66ccff">${this.player.name} usou ${skill.name} e teleportou-se para o corpo a corpo do inimigo! (Distância: ${this.distance.toFixed(1)}m)</span>`;
                    window.GFX.spawnParticles(playerX, playerY, "#66ccff", 20, 5, 4);
                    window.AudioManager.playMagicCast();
                }
                else if (skill.type === 'TELEPORT_FAR') {
                    this.distance = 10;
                    resultMsg = `<span style="color:#66ccff">${this.player.name} usou ${skill.name} e teleportou-se para o ponto mais distante do inimigo! (Distância: ${this.distance.toFixed(1)}m)</span>`;
                    window.GFX.spawnParticles(playerX, playerY, "#66ccff", 20, 5, 4);
                    window.AudioManager.playMagicCast();
                }
                else if (skill.type === 'AMMO_RECALL') {
                    const rangedWeapon = this.player.equipment[SLOTS.RANGED];
                    if (rangedWeapon && rangedWeapon.maxAmmo) {
                        rangedWeapon.ammo = rangedWeapon.maxAmmo;
                        resultMsg = `<span style="color:#66ccff">${this.player.name} usou ${skill.name} e recuperou toda a munição de ${rangedWeapon.name}! (${rangedWeapon.ammo}/${rangedWeapon.maxAmmo})</span>`;
                    } else {
                        resultMsg = `${this.player.name} usou ${skill.name}, mas não possui nenhuma arma de longo alcance equipada.`;
                    }
                    window.GFX.spawnParticles(playerX, playerY, "#66ccff", 15, 4, 4);
                    window.AudioManager.playMagicCast();
                }
                else if (skill.type === 'SHIELD') {
                    // Barreira temporária (Linhagem Luz: Escudo Dourado) — reduz
                    // uma % do dano recebido pelos próximos N turnos.
                    this.playerState.shieldTurns = skill.duration;
                    this.playerState.shieldPercent = skill.shieldPercent;
                    resultMsg = `<span style="color:#fff2c0">${this.player.name} ergue ${skill.name}, reduzindo ${skill.shieldPercent}% do dano recebido por ${skill.duration} turnos!</span>`;
                    window.GFX.spawnParticles(playerX, playerY, "#fff2c0", 25, 4, 5);
                    window.AudioManager.playMagicCast();
                }
                else if (skill.type === 'EVASION') {
                    // Esquiva temporária (Linhagem Vampirismo: Véu da Noite)
                    this.playerState.evasionTurns = skill.duration;
                    this.playerState.evasionBonus = skill.evasionBonus;
                    resultMsg = `<span style="color:#7a1030">${this.player.name} usa ${skill.name}, ganhando +${skill.evasionBonus}% de esquiva por ${skill.duration} turnos!</span>`;
                    window.GFX.spawnParticles(playerX, playerY, "#3a1020", 25, 4, 5);
                    window.AudioManager.playMagicCast();
                }
            } else {
                // Failsafe: devolve o turno se por algum motivo a UI permitiu conjurar sem mana
                resultMsg = "Mana insuficiente!";
                this.isPlayerTurn = true;
                window.UI.toggleBattleButtons(true);
                window.UI.appendBattleLog(resultMsg);
                window.AudioManager.playError();
                return;
            }
        }

        window.UI.appendBattleLog(resultMsg);
        window.UI.updateBattleBars();

        if (window.AICombat) window.AICombat.recordPlayerAction(this, actionCode, param, { enemyHpBefore, playerHpAtDecision });

        const status = this.checkWinCondition();
        if (status !== 'ONGOING') {
            this.endBattle(status);
            return;
        }

        // Passa a vez para o inimigo após 1.2 segundos (Feedback visual)
        setTimeout(() => this.executeEnemyTurn(), 1200);
    }

    // Executa uma habilidade do inimigo (espelha exatamente as fórmulas do
    // branch SKILL de executePlayerTurn, com atacante/defensor invertidos).
    executeEnemySkill(skillId) {
        const skill = window.SkillDB[skillId];
        const playerX = window.GFX.getEntityX(true, window.innerWidth);
        const playerY = window.innerHeight / 2;
        const enemyX = window.GFX.getEntityX(false, window.innerWidth);
        const enemyY = window.innerHeight / 2;

        this.enemy.currentMp -= skill.mpCost;
        if (skill.cooldown && this.enemy.setSkillCooldown) this.enemy.setSkillCooldown(skillId, skill.cooldown);
        if (window.GFX) window.GFX.playAnim(false, skill.animation || 'attack', 700);

        let message = '', selfEvent = null;

        if (skill.type === 'HEAL') {
            const healAmount = Math.floor(this.enemy.getTotalStat('int') * 2.5 * skill.powerMulti);
            this.enemy.currentHp = Utils.clamp(this.enemy.currentHp + healAmount, 0, this.enemy.derivedStats.maxHp);
            message = `<span style="color:#1eff00">${this.enemy.name} usou ${skill.name} e recuperou ${healAmount} HP!</span>`;
            window.GFX.spawnText(enemyX, enemyY - 50, `+${healAmount}`, "#1eff00", false);
            window.GFX.spawnParticles(enemyX, enemyY, "#1eff00", 25, 4, 4);
            window.AudioManager.playHeal();
        } else if (skill.type === 'MAGIC') {
            const magicDmg = this.applyLineageWeakness(this.enemy, this.player, Math.floor(this.enemy.getTotalStat('int') * 3 * skill.powerMulti));
            const resist = this.player.getTotalStat('int') * 0.5;
            let finalDmg = Math.max(1, Math.floor(magicDmg - resist));
            this.player.currentHp = Utils.clamp(this.player.currentHp - finalDmg, 0, this.player.derivedStats.maxHp);
            message = `<span style="color:#a335ee">${this.enemy.name} conjurou ${skill.name} causando ${finalDmg} de Dano Mágico!</span>`;
            window.GFX.spawnText(playerX, playerY - 50, `-${finalDmg}`, "#a335ee", true);
            window.GFX.spawnParticles(playerX, playerY, "#a335ee", 40, 6, 5);
            window.GFX.playAnim(true, 'hurt', 500, true);
            window.Engine.triggerShake(8, 0.2);
            window.AudioManager.playMagicCast();
            selfEvent = { type: 'landedHit', crit: false };
        } else if (skill.type === 'PHYSICAL') {
            let hitChance = 110 + (this.enemy.getTotalStat('acc') * 2) - this.player.derivedStats.dodgeChance;
            if (Utils.chance(hitChance)) {
                let damage = this.applyLineageWeakness(this.enemy, this.player, Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti));
                let reductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
                let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));
                this.player.currentHp = Utils.clamp(this.player.currentHp - mitigatedDamage, 0, this.player.derivedStats.maxHp);
                message = `<span style="color:var(--color-gold)">${this.enemy.name} executou ${skill.name} causando esmagadores ${mitigatedDamage} de Dano!</span>`;
                window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#ffcc00", true);
                window.GFX.spawnParticles(playerX, playerY, "#cc0000", 25, 6, 5);
                window.GFX.playAnim(true, 'hurt', 500, true);
                window.Engine.triggerShake(10, 0.25);
                window.AudioManager.playSwordClash();
                selfEvent = { type: 'landedHit', crit: false };
            } else {
                message = `${this.enemy.name} usou ${skill.name} mas errou o alvo!`;
                selfEvent = { type: 'missed' };
            }
        } else if (skill.type === 'BLEED') {
            let damage = this.applyLineageWeakness(this.enemy, this.player, Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti));
            let reductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
            let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));
            this.player.currentHp = Utils.clamp(this.player.currentHp - mitigatedDamage, 0, this.player.derivedStats.maxHp);
            this.playerState.bleedTurns = skill.duration;
            this.playerState.bleedDamage = Math.max(1, Math.floor(this.enemy.getTotalStat('str') * 0.8));
            message = `<span style="color:#ff5555">${this.enemy.name} usou ${skill.name}, causando ${mitigatedDamage} de dano e sangramento!</span>`;
            window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#ff3333", false);
            window.GFX.spawnParticles(playerX, playerY, "#8b0000", 25, 5, 4);
            window.GFX.playAnim(true, 'hurt', 500);
            window.AudioManager.playSwordClash();
            selfEvent = { type: 'landedHit', crit: false };
        } else if (skill.type === 'STUN') {
            let damage = this.applyLineageWeakness(this.enemy, this.player, Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti));
            let reductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
            let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));
            this.player.currentHp = Utils.clamp(this.player.currentHp - mitigatedDamage, 0, this.player.derivedStats.maxHp);
            // Espelha a mesma resistência a efeitos negativos aplicada acima
            // no STUN do jogador (ver executePlayerTurn) — sem isso, a
            // resistência prometida pela árvore da Luz/Ateniense só protegia
            // o jogador quando o inimigo usava STUN, nunca o contrário.
            const negResist = (this.player.derivedStats.negativeEffectResistPercent || 0) / 100;
            const stunned = Utils.chance(skill.stunChance * (1 - negResist));
            if (stunned) this.playerState.stunned = true;
            message = stunned
                ? `<span style="color:#3388ff">${this.enemy.name} usou ${skill.name}: ${mitigatedDamage} de dano e ${this.player.name} ficou atordoado!</span>`
                : `<span style="color:#3388ff">${this.enemy.name} usou ${skill.name}, causando ${mitigatedDamage} de dano.</span>`;
            window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#3388ff", false);
            window.GFX.spawnParticles(playerX, playerY, "#3388ff", 25, 5, 4);
            window.GFX.playAnim(true, 'hurt', 500);
            window.Engine.triggerShake(6, 0.15);
            window.AudioManager.playSwordClash();
            selfEvent = { type: 'landedHit', crit: false };
        } else if (skill.type === 'LIFESTEAL') {
            let hitChance = 100 + (this.enemy.getTotalStat('acc') * 2) - this.player.derivedStats.dodgeChance;
            if (Utils.chance(hitChance)) {
                let damage = this.applyLineageWeakness(this.enemy, this.player, Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti));
                let reductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
                let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));
                this.player.currentHp = Utils.clamp(this.player.currentHp - mitigatedDamage, 0, this.player.derivedStats.maxHp);
                const healed = Math.floor(mitigatedDamage * (skill.lifestealPercent / 100));
                this.enemy.currentHp = Utils.clamp(this.enemy.currentHp + healed, 0, this.enemy.derivedStats.maxHp);
                message = `<span style="color:#aa0044">${this.enemy.name} usou ${skill.name}: ${mitigatedDamage} de dano, recuperando ${healed} HP!</span>`;
                window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#ff0066", true);
                window.GFX.spawnText(enemyX, enemyY - 50, `+${healed}`, "#1eff00", false);
                window.GFX.spawnParticles(playerX, playerY, "#aa0044", 30, 6, 5);
                window.GFX.playAnim(true, 'hurt', 500, true);
                window.Engine.triggerShake(10, 0.2);
                window.AudioManager.playCrit();
                selfEvent = { type: 'landedHit', crit: false };
            } else {
                message = `${this.enemy.name} usou ${skill.name} mas errou o alvo!`;
                selfEvent = { type: 'missed' };
            }
        } else if (skill.type === 'SHIELD') {
            // Usado por bosses com habilidade defensiva própria (ex: Anjo
            // Guardião — Barreira Celestial)
            this.enemyState.shieldTurns = skill.duration;
            this.enemyState.shieldPercent = skill.shieldPercent;
            message = `<span style="color:#fff2c0">${this.enemy.name} ergue ${skill.name}, reduzindo ${skill.shieldPercent}% do dano recebido por ${skill.duration} turnos!</span>`;
            window.GFX.spawnParticles(enemyX, enemyY, "#fff2c0", 25, 4, 5);
            window.AudioManager.playMagicCast();
        } else if (skill.type === 'EVASION') {
            this.enemyState.evasionTurns = skill.duration;
            this.enemyState.evasionBonus = skill.evasionBonus;
            message = `<span style="color:#7a1030">${this.enemy.name} usa ${skill.name}, ganhando +${skill.evasionBonus}% de esquiva por ${skill.duration} turnos!</span>`;
            window.GFX.spawnParticles(enemyX, enemyY, "#3a1020", 25, 4, 5);
            window.AudioManager.playMagicCast();
        }

        if (selfEvent && window.AICombat) window.AICombat.onSelfEvent(this, selfEvent.type, selfEvent);
        return message;
    }

    // Cura o inimigo usando uma carga de item "virtual" (ver ai.js — inimigos
    // não têm mochila de verdade, só um número de curas equivalente ao quanto
    // a personalidade gosta de usar itens).
    executeEnemyItem() {
        this.enemy.aiState.itemCharges = Math.max(0, (this.enemy.aiState.itemCharges || 0) - 1);
        this.enemy.aiState.itemCooldown = 2; // exige 2 turnos próprios de combate real antes da próxima cura (ver ai.js)
        const healAmount = Math.floor(this.enemy.derivedStats.maxHp * 0.25);
        this.enemy.currentHp = Utils.clamp(this.enemy.currentHp + healAmount, 0, this.enemy.derivedStats.maxHp);
        const enemyX = window.GFX.getEntityX(false, window.innerWidth);
        const enemyY = window.innerHeight / 2;
        window.GFX.spawnText(enemyX, enemyY - 50, `+${healAmount}`, '#1eff00', false);
        window.GFX.spawnParticles(enemyX, enemyY, '#1eff00', 20, 4, 4);
        window.AudioManager.playHeal();
        return `${this.enemy.name} usa um item e recupera ${healAmount} HP!`;
    }

    // Processa a Inteligência Artificial do Inimigo: motor de Utility AI
    // (personalidade + estilo de luta + memória + emoção + risco + blefe +
    // combos — ver ai.js), com o gate físico de alcance sempre em primeiro
    // lugar (ver AICombat.decideAction).
    executeEnemyTurn() {
        if (!this.isBattleActive) return;

        this.enemyState.isDefending = false;
        this.enemyState.holdingDistance = false; // Reseta a postura de manter distância — espelha o reset do jogador em executePlayerTurn
        if (this.enemy.tickCooldowns) this.enemy.tickCooldowns();
        // Bug de auditoria (relatado pelo usuário): inimigos usavam item de
        // cura em turnos seguidos ("spam de poção") sempre que HP e cargas
        // permitiam — a cura de 25% do HP máximo raramente tirava o inimigo
        // da faixa "abaixo de 60%" num só uso, então ITEM continuava sendo a
        // ação de maior pontuação turno após turno até as cargas acabarem.
        // Cooldown de 2 turnos próprios entre usos força pelo menos uma
        // ação de combate real entre curas, sem reduzir o total de cargas
        // disponíveis (ver ai.js/executeEnemyItem).
        if (this.enemy.aiState && this.enemy.aiState.itemCooldown > 0) this.enemy.aiState.itemCooldown--;

        // Contagem regressiva de barreira/esquiva temporárias (usado por
        // bosses com habilidades próprias de escudo, ex: Anjo Guardião)
        if (this.enemyState.shieldTurns > 0) this.enemyState.shieldTurns--;
        if (this.enemyState.evasionTurns > 0) this.enemyState.evasionTurns--;

        // Sangramento tica sempre, mesmo que o inimigo esteja atordoado
        const bleedMsg = this.applyBleedTick(this.enemy, this.enemyState, false);
        if (bleedMsg) {
            window.UI.appendBattleLog(bleedMsg);
            window.UI.updateBattleBars();
            const bleedStatus = this.checkWinCondition();
            if (bleedStatus !== 'ONGOING') {
                this.endBattle(bleedStatus);
                return;
            }
        }

        // Atordoamento: o inimigo perde a ação deste turno
        if (this.enemyState.stunned) {
            this.enemyState.stunned = false;
            window.UI.appendBattleLog(`<span style="color:#3388ff">${this.enemy.name} está atordoado e perde o turno!</span>`);
            this.turnCount++;
            this.isPlayerTurn = true;
            setTimeout(() => {
                if (this.isBattleActive) window.UI.toggleBattleButtons(true);
            }, 500);
            return;
        }

        // Transição de fase de chefe (só afeta campeões com `phases` definido)
        if (window.AICombat) {
            const phaseMsg = window.AICombat.checkBossPhase(this);
            if (phaseMsg) {
                window.UI.appendBattleLog(`<span style="color:var(--color-gold); font-size:1.1rem; font-weight:bold;">${phaseMsg}</span>`);
                window.UI.updateBattleBars();
            }
        }

        // Bosses de Ritual usam IA 100% exclusiva (ver bossai.js) — NUNCA a
        // personalidade/estilo/emoção/memória do AICombat comum.
        const decision = this.enemy.isBoss && window.BossAI
            ? window.BossAI.decide(this.enemy.bossId, this)
            : (window.AICombat ? window.AICombat.decideAction(this) : { action: 'ATK', message: `${this.enemy.name} ataca!` });
        let resultMsg = decision.message || '';
        const speed = this.enemy.getWeaponSpeed();

        if (decision.action === 'APPROACH') {
            const resisted = this.playerState.holdingDistance;
            let amount = speed.approachSpeed;
            if (resisted) amount *= 0.5;
            this.applyDistanceChange(-amount);
            if (resisted) resultMsg = `${this.enemy.name} tenta avançar, mas ${this.player.name} mantém a distância!`;
            if (window.GFX) {
                window.GFX.playAnim(false, 'approach', 700);
                if (resisted) window.GFX.playAnim(true, 'push', 500);
            }
        } else if (decision.action === 'RUN') {
            this.applyDistanceChange(-speed.approachSpeed * 2);
            // Bug de auditoria: o RUN do jogador sempre marcava justRan
            // (vulnerabilidade de esquiva no próximo ataque sofrido, ver
            // executeAttack), mas o RUN do inimigo nunca marcava o mesmo
            // estado nele mesmo — um inimigo que corria pra fechar
            // distância nunca pagava o preço que o jogador paga na mesma
            // situação.
            this.enemyState.justRan = true;
            if (window.GFX) window.GFX.playAnim(false, 'run', 700);
        } else if (decision.action === 'RETREAT') {
            const amount = decision.amount !== undefined ? decision.amount : speed.retreatSpeed;
            this.applyDistanceChange(amount);
            if (window.GFX) window.GFX.playAnim(false, 'retreat', 700);
        } else if (decision.action === 'CHARGE') {
            this.applyDistanceChange(-speed.approachSpeed * 2);
            if (window.GFX) window.GFX.playAnim(false, 'charge', 700);
            const range = this.enemy.getWeaponRange();
            const chargeRangeMulti = this._weaponRangeMulti(range);
            if (chargeRangeMulti !== null) {
                // Munição limitada (ver ATK abaixo pelo mesmo motivo) — antes
                // só o ATK comum do inimigo ganhou essa checagem, deixando o
                // caminho de CHARGE atirar de graça mesmo sem munição.
                const chargeWeapon = this.enemy.getActiveWeapon();
                if (chargeWeapon && chargeWeapon.maxAmmo && chargeWeapon.ammo <= 0) {
                    resultMsg = `${this.enemy.name} investiu, mas está sem munição para ${chargeWeapon.name}!`;
                } else {
                    if (chargeWeapon && chargeWeapon.maxAmmo) chargeWeapon.ammo--;
                    const atkResult = this.executeAttack(this.enemy, this.player, this.enemyState, this.playerState, 1.2 * chargeRangeMulti);
                    resultMsg = `${this.enemy.name} investiu contra você! ${atkResult.message}`;
                    if (chargeRangeMulti < 1) resultMsg += ` (perto demais para a arma dele — dano reduzido)`;
                    if (window.AICombat) window.AICombat.onSelfEvent(this, atkResult.hit ? 'landedHit' : 'missed', { crit: atkResult.crit });
                }
            } else {
                resultMsg = `${this.enemy.name} investiu, mas não alcançou você.`;
            }
        } else if (decision.action === 'ATK') {
            // Munição limitada em armas de longo alcance — bug de auditoria:
            // essa checagem (e o decremento) só existia no ATK do JOGADOR
            // (ver executePlayerTurn acima); um inimigo/Rival de estilo
            // Arqueiro (ver ai_data.js weaponPool: bow/crossbow/
            // elvenlongbow) atirava infinitamente, sem nunca ficar sem
            // munição — quebrando pra um dos lados o próprio "custo tático"
            // que a munição existe pra impor.
            const rangedWeapon = this.enemy.getActiveWeapon();
            if (rangedWeapon && rangedWeapon.maxAmmo && rangedWeapon.ammo <= 0) {
                resultMsg = `${this.enemy.name} tenta atacar à distância, mas está sem munição para ${rangedWeapon.name}!`;
            } else {
                if (rangedWeapon && rangedWeapon.maxAmmo) rangedWeapon.ammo--;
                // A IA agora pode escolher ATK mesmo abaixo do alcance mínimo da
                // arma (ver decideAction em ai.js) — nesse caso o ataque sai com
                // 40% menos dano em vez de simplesmente não acontecer.
                const enemyRangeMulti = this._weaponRangeMulti(this.enemy.getWeaponRange()) || 1;
                const atkResult = this.executeAttack(this.enemy, this.player, this.enemyState, this.playerState, enemyRangeMulti);
                resultMsg = atkResult.message;
                if (enemyRangeMulti < 1) resultMsg += ` (perto demais para a arma dele — dano reduzido)`;
                if (rangedWeapon && rangedWeapon.maxAmmo) resultMsg += ` (Munição do inimigo: ${rangedWeapon.ammo}/${rangedWeapon.maxAmmo})`;
                if (window.AICombat) window.AICombat.onSelfEvent(this, atkResult.hit ? 'landedHit' : 'missed', { crit: atkResult.crit });
            }
        } else if (decision.action === 'SKILL') {
            resultMsg = this.executeEnemySkill(decision.param);
        } else if (decision.action === 'ITEM') {
            resultMsg = this.executeEnemyItem();
        } else if (decision.action === 'SWAP_INTERNAL') {
            resultMsg = window.AICombat.trySwapWeapon(this);
        } else if (decision.action === 'SWITCH_WEAPON') {
            // Espelha o SWITCH_WEAPON do jogador (ver executePlayerTurn
            // acima): alterna entre as duas armas JÁ equipadas (principal e
            // secundária, ver Entity.hasDualWeapons/maybeEquipSecondaryWeapon
            // em player.js) — nunca conjura uma arma nova, e consome o turno
            // inteiro sem atacar, exatamente como a ação equivalente do
            // jogador. A decisão de QUANDO trocar já foi tomada em
            // AICombat.decideAction/_buildCandidates (munição/alcance/vida/
            // mana), nunca aleatoriamente.
            this.enemy.activeWeaponSlot = (this.enemy.activeWeaponSlot === SLOTS.MAIN_HAND) ? SLOTS.RANGED : SLOTS.MAIN_HAND;
            this.enemy.calculateDerivedStats();
            this.enemy.aiState.lastWeaponSwitchTurn = this.enemy.aiState.turnCount;
            if (window.GFX) window.GFX.playAnim(false, 'approach', 500);
        } else if (decision.action === 'HOLD') {
            // Bug de auditoria: HOLD do jogador já marca playerState.
            // holdingDistance (lido pelo APPROACH do inimigo, resistindo a
            // metade da velocidade), mas o HOLD do inimigo nunca marcava o
            // mesmo estado nele mesmo — "segurar a distância" só
            // funcionava a favor do jogador, nunca contra ele. Consumido
            // no início do PRÓXIMO turno do inimigo (ver reset em
            // executeEnemyTurn), exatamente como o do jogador.
            this.enemyState.holdingDistance = true;
        } else if (decision.action === 'DEF') {
            this.enemyState.isDefending = true;
        }

        window.UI.appendBattleLog(`<span style="color:#ff4444">${resultMsg}</span>`);
        window.UI.updateBattleBars();

        const status = this.checkWinCondition();
        if (status !== 'ONGOING') {
            this.endBattle(status);
            return;
        }

        // Retorna o turno ao jogador — a menos que ele tenha acabado de ser
        // atordoado por uma habilidade do próprio inimigo, caso em que o
        // turno dele é perdido automaticamente (espelha o atordoamento do inimigo).
        this.turnCount++;
        if (this.playerState.stunned) {
            this.playerState.stunned = false;
            window.UI.appendBattleLog(`<span style="color:#3388ff">${this.player.name} está atordoado e perde o turno!</span>`);
            setTimeout(() => this.executeEnemyTurn(), 1000);
        } else {
            this.isPlayerTurn = true;
            setTimeout(() => {
                if (this.isBattleActive) window.UI.toggleBattleButtons(true);
            }, 500);
        }
    }

    // Gerencia o fim do combate, distribuição de recompensas e conquistas
    endBattle(result) {
        this.isBattleActive = false;

        // Desgaste de equipamento: toda luta desgasta 1 ponto de
        // durabilidade de cada peça equipada (vitória ou derrota — o
        // combate desgasta o aço de qualquer jeito). `durability` já
        // existia em todo item desde items.js, mas nada nunca o lia; peças
        // com durabilidade 0 ficam "quebradas" (ver calculateDerivedStats
        // em player.js) até serem reparadas no Ferreiro/Armeiro.
        for (let key in this.player.equipment) {
            const item = this.player.equipment[key];
            if (item && item.durability > 0) item.durability--;
        }
        this.player.calculateDerivedStats();

        if (window.GFX) {
            window.GFX.playAnim(result === 'VICTORY', 'victory', 1600);
            window.GFX.playAnim(result !== 'VICTORY', 'death', 1600);
        }

        if (result === 'VICTORY') {
            window.UI.appendBattleLog(`<span style="color:var(--color-gold); font-size:1.2rem;">Vitória! O inimigo caiu!</span>`);

            const expGained = this.enemy.expValue;
            const goldGained = this.enemy.goldValue;
            const levelBefore = this.player.level;
            const hpPercent = this.player.currentHp / this.player.derivedStats.maxHp;

            this.player.gold += goldGained;
            this.player.wins = (this.player.wins || 0) + 1;
            this.player.gainExp(expGained);

            const leveledUp = this.player.level > levelBefore;
            const loot = this.enemy.generateLoot(this.player.getTotalStat('luk'));
            const isLegendary = loot && loot.rarity && loot.rarity.id === RARITY.LEGENDARY.id;

            // Se derrotou um Rival da ladder, marca como derrotado e libera o próximo
            let defeatedRivalId = null;
            if (this.enemy.rivalId) {
                defeatedRivalId = this.enemy.rivalId;
                if (!this.player.rivalsDefeated.includes(defeatedRivalId)) {
                    this.player.rivalsDefeated.push(defeatedRivalId);
                }
            }

            // Ritual do Vampirismo: Vampiros comuns (não o boss) têm chance
            // pequena de dropar uma Essência Vampírica ao serem derrotados.
            if (this.enemy.isVampireEnemy && this.enemy.rollEssenceDrop && this.enemy.rollEssenceDrop()) {
                window.RitualSystem.onVampiricEssenceGained(this.player, 1);
                window.UI.appendBattleLog(`<span style="color:#c81e2a">Uma Essência Vampírica se solidifica das cinzas do inimigo! (${this.player.ritualProgress.vampirismo.vampiricEssences}/10)</span>`);
            }

            // Ritual da Luz: toda vitória sem magia ofensiva conta para o
            // requisito de 5 vitórias "puras" — mesmo antes de a Linhagem
            // Luz existir, o progresso já vai sendo acumulado silenciosamente.
            if (window.RitualSystem) window.RitualSystem.onBattleWon(this.player, this.usedOffensiveMagic);

            // Boss de Ritual derrotado: desperta a Linhagem PERMANENTEMENTE e
            // dispara a cinemática "NOVA LINHAGEM DESPERTA" antes da tela de
            // resultados normal.
            let awakenedLineageId = null;
            if (this.enemy.isBoss) {
                const ritualEntry = window.RitualSystem.getAll().find(r => {
                    const lineage = window.LineageSystem.get(r.lineageId);
                    return lineage && lineage.bossId === this.enemy.bossId;
                });
                if (ritualEntry) {
                    const awakened = window.RitualSystem.completeRitual(this.player, ritualEntry.id);
                    if (awakened) awakenedLineageId = ritualEntry.lineageId;
                }
            }

            // checkAchievements roda DEPOIS do despertar de Linhagem (não
            // antes, como estava) — senão a conquista "Sangue Renovado"
            // nunca teria como saber que a Linhagem acabou de despertar
            // NESTA MESMA vitória.
            const newAchievements = this.player.checkAchievements({
                victory: true, hpPercent, gotLegendary: isLegendary, defeatedRivalId,
                awakenedLineage: !!awakenedLineageId, defeatedElite: !!this.enemy.isElite
            });

            // Cura passiva após a batalha (20% do HP max)
            this.player.currentHp = Utils.clamp(this.player.currentHp + Math.floor(this.player.derivedStats.maxHp * 0.2), 0, this.player.derivedStats.maxHp);

            if (awakenedLineageId && window.UI.showLineageAwakening) {
                window.UI.showLineageAwakening(awakenedLineageId, () => {
                    window.UI.showBattleResults(true, expGained, goldGained, leveledUp, loot, newAchievements);
                });
            } else {
                setTimeout(() => window.UI.showBattleResults(true, expGained, goldGained, leveledUp, loot, newAchievements), 2000);
            }

        } else if (result === 'DEFEAT') {
            window.UI.appendBattleLog(`<span style="color:#8b0000; font-size:1.2rem;">Você foi derrotado...</span>`);

            this.player.losses = (this.player.losses || 0) + 1;
            this.player.addFatigue(1); // Cada derrota deixa o gladiador mais cansado

            // Penalidade por morte: Revive no hub com 10% de HP
            this.player.currentHp = Math.floor(this.player.derivedStats.maxHp * 0.1);

            setTimeout(() => window.UI.showBattleResults(false, 0, 0, false, null, []), 2000);
        }

        window.SaveManager.save(window.Engine.state);
    }
}
