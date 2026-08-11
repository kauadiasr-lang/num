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
        // curseTurns/curseDefensePercent (item 9 da auditoria de
        // balanceamento — Maldição Sanguínea, árvore de Vampirismo): reduz a
        // Defesa do ALVO amaldiçoado por N turnos, ver executeAttack.
        // bleedIgnoresArmor (item 12 da auditoria — revisão de
        // encantamentos): antes NENHUM dano contínuo (Fogo/Sangramento/
        // Veneno, todos armazenados nos MESMOS bleedTurns/bleedDamage)
        // jamais era mitigado por Defesa — então o próprio texto do
        // encantamento Veneno ("dano contínuo que ignora armadura") não
        // descrevia nada de ESPECIAL: Fogo e Sangramento "ignoravam
        // armadura" exatamente do mesmo jeito, sem nunca terem prometido
        // isso. Ver applyBleedTick/executeAttack — agora só o Veneno de
        // verdade ignora Defesa; Fogo/Sangramento passam a ser mitigados
        // por ela, como qualquer dano físico esperaria.
        // weaponImbueId/weaponImbueTurns (item 14 da auditoria de
        // balanceamento — Fio Sanguinário/Fio Consagrado): enquanto
        // weaponImbueTurns > 0, o encantamento efetivo da arma do dono deste
        // estado passa a ser window.LINEAGE_IMBUES[weaponImbueId] em vez do
        // encantamento permanente do item (ver executeAttack/
        // _getEffectiveEnchantment) — sempre reseta pra null/0 no fim da
        // duração, nunca ficando "vazado" pra fora da batalha (não é salvo).
        this.playerState = { isDefending: false, bleedTurns: 0, bleedDamage: 0, bleedIgnoresArmor: false, dotType: 'sangramento', stunned: false, justRan: false, holdingDistance: false, shieldTurns: 0, shieldPercent: 0, evasionTurns: 0, evasionBonus: 0, curseTurns: 0, curseDefensePercent: 0, weaponImbueId: null, weaponImbueTurns: 0, muralhaCounterBonus: 0 };
        this.enemyState = { isDefending: false, bleedTurns: 0, bleedDamage: 0, bleedIgnoresArmor: false, dotType: 'sangramento', stunned: false, justRan: false, holdingDistance: false, shieldTurns: 0, shieldPercent: 0, evasionTurns: 0, evasionBonus: 0, curseTurns: 0, curseDefensePercent: 0, weaponImbueId: null, weaponImbueTurns: 0, muralhaCounterBonus: 0 };

        // Rastreia se o jogador usou alguma magia OFENSIVA (tipo MAGIC) nesta
        // luta — usado pelo Ritual da Luz ("vencer sem usar magia ofensiva").
        // Ataques físicos, curas e habilidades de sangramento/atordoamento
        // continuam livres de usar sem "quebrar" o requisito.
        this.usedOffensiveMagic = false;

        // Rastreiam dano causado pelo jogador e se ele usou QUALQUER
        // habilidade (mágica ou não) nesta luta — usados pelos Mestres de
        // Treinamento Orc (ver js/orctraining.js, MEGA REWORK econômico).
        // `playerDamageDealt` é acumulado via o MESMO `enemyHpBefore` já
        // capturado pra IA em executePlayerTurn (window.AICombat.
        // recordPlayerAction) — nunca um contador de dano paralelo.
        this.playerDamageDealt = 0;
        this.playerUsedAnySkill = false;

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

    // Encantamento EFETIVO no acerto (item 14 da auditoria — Fio
    // Sanguinário/Fio Consagrado): enquanto uma imbuição de Linhagem estiver
    // ativa (`entityState.weaponImbueTurns > 0`), ela assume o lugar do
    // encantamento permanente do item pela duração restante — o mesmo
    // formato onHit(attacker, defender) faz o resto do consumo em
    // executeAttack funcionar sem NENHUMA mudança adicional, já que ele só
    // enxerga o objeto retornado aqui, nunca de qual registry ele veio.
    _getEffectiveEnchantment(entity, entityState) {
        if (entityState.weaponImbueTurns > 0 && entityState.weaponImbueId && window.LINEAGE_IMBUES) {
            const imbue = window.LINEAGE_IMBUES[entityState.weaponImbueId];
            if (imbue) return imbue;
        }
        return this._getWeaponEnchantment(entity);
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

    // Ação Defender (item 8 da auditoria de balanceamento) — compartilhada
    // entre jogador e inimigo (chamada pelos dois ramos de `DEF`, ver
    // executePlayerTurn/executeEnemyTurn) pra nunca duplicar a fórmula.
    // `state.isDefending = true` já dobrava a Defesa antes desta mudança
    // (ver executeAttack acima); esta função ADICIONA os 3 efeitos que
    // faltavam sem tocar nesse comportamento existente:
    //
    // 1. Mana (pedido do usuário: mana só volta com Defender ou poção,
    //    nunca de graça a cada turno — ver player.js Entity, onde a
    //    regeneração passiva antiga foi removida) — só se aplica a quem
    //    realmente tem mana (maxMp > 0), e SEMPRE menos que a Poção de Mana
    //    (items.js `mana_potion`, 25 fixo): o teto de 18 abaixo garante essa
    //    relação mesmo pra builds extremas de INT (maxMp pode passar de
    //    1000 em builds bem investidas — 10% cru já ultrapassaria a poção
    //    de longe, então o teto é indispensável, não só a porcentagem).
    // 2. Limpa sangramento ativo (bleedTurns/bleedDamage) com 50% de
    //    chance — "quando apropriado" (pedido original) significa: só
    //    quando existe algo pra limpar, e nunca garantido. Bug de auditoria
    //    verificado e evitado de propósito: `justRan` (a mesma flag de
    //    "lentidão"/menos esquiva no próximo golpe sofrido) NÃO é limpa
    //    aqui, porque ela também é usada como o custo deliberado da ação
    //    RUN/Correr (ver linha ~502 abaixo) — cleanar isso via Defender
    //    anularia de graça o trade-off daquela ação inteiramente separada,
    //    já que as duas fontes compartilham o mesmo campo sem distinção.
    //    Nunca atordoamento (`stunned`): quem está atordoado nem chega a
    //    executar Defender, então não há nada pra "limpar" nesse caso.
    // 3. Animação própria (`defend`, ver graphics.js computePose) além da
    //    postura de guarda contínua que já existia (`pose.guard`, mantida
    //    intacta) — um gesto breve de recolhimento no momento de assumir a
    //    postura, não só o braço do escudo erguido durante o turno inteiro.
    _resolveDefend(entity, state, isPlayer) {
        state.isDefending = true;
        let msg = `${entity.name} assumiu uma postura defensiva`;

        if (entity.derivedStats.maxMp > 0) {
            const manaBefore = entity.currentMp;
            const manaRestore = Math.min(18, Math.max(1, Math.ceil(entity.derivedStats.maxMp * 0.06)));
            entity.currentMp = Utils.clamp(entity.currentMp + manaRestore, 0, entity.derivedStats.maxMp);
            const actuallyRestored = entity.currentMp - manaBefore;
            if (actuallyRestored > 0) msg += `, recuperando ${actuallyRestored} de mana`;
        }

        if (state.bleedTurns > 0 && Utils.chance(50)) {
            state.bleedTurns = 0;
            state.bleedDamage = 0;
            msg += ' e estancou o sangramento';
        }

        // Estilo de Combate — Muralha de Ferro (item 14 da diretiva Arena +
        // Estilos): Defender ganha sinergia especial com o nó "Contra-
        // Ataque Ensaiado" — chance extra de revidar no PRÓXIMO golpe
        // recebido (ver executeAttack, consumido/resetado logo abaixo,
        // nunca acumula turno após turno — não é regeneração infinita).
        if (window.CombatStyleSystem && window.CombatStyleSystem.hasActiveStyleNode(entity, 'muralha_contra_ataque')) {
            state.muralhaCounterBonus = 25;
            msg += ', pronta para revidar';
        }
        msg += '!';

        if (window.GFX) window.GFX.playAnim(isPlayer, 'defend', 500);
        return msg;
    }

    // Precisão (ACC) do ATACANTE melhora a chance bruta de um efeito
    // negativo (atordoar/lentidão) realmente grudar no alvo — item 11 da
    // revisão profunda ("habilidades que exigem precisão"). Simétrico ao
    // papel de Sorte (negativeEffectResistPercent, ver
    // Entity.calculateDerivedStats): Sorte protege VOCÊ de ser atordoado,
    // Precisão ajuda VOCÊ a atordoar o outro — os dois atributos ganham
    // identidades distintas em vez de disputar o mesmo papel de "atributo
    // de efeitos negativos". Aplicado ANTES da resistência do alvo (nunca
    // ignora negResist, só melhora a rolagem bruta que o alvo ainda resiste
    // por cima) — 0.3 ponto percentual por ponto de ACC é modesto o
    // bastante pra nunca tornar um stun garantido sozinho.
    _precisionEffectChance(baseChance, attacker) {
        const acc = attacker.getTotalStat ? attacker.getTotalStat('acc') : 0;
        return baseChance + acc * 0.3;
    }

    executeAttack(attacker, defender, attackerState, defenderState, damageMulti = 1, isCounter = false, isExtraAttack = false) {
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

        // Estilo de Combate — Caminho do Predador (item 15 da diretiva
        // Arena + Estilos): "quanto maior a distância, maior o bônus" —
        // escala linearmente de 0% (distância 0) até o bônus cheio dos
        // passivos (distância 10, o máximo do BattleSystem). Só entra em
        // jogo com arma de longo alcance ATIVA (ver
        // CombatStyles.predador.isCompatible) — sumActiveStylePassives já
        // devolve tudo zerado se o estilo não estiver ativo/compatível ou
        // se `attacker` não for o Player (Enemy/Rival nunca têm
        // `combatStyle` definido).
        const stylePassivesAtk = window.CombatStyleSystem ? window.CombatStyleSystem.sumActiveStylePassives(attacker) : null;
        if (stylePassivesAtk && stylePassivesAtk.rangedDistanceDamageBonusPercent) {
            const distanceFactor = Utils.clamp(this.distance / 10, 0, 1);
            damage = Math.floor(damage * (1 + (stylePassivesAtk.rangedDistanceDamageBonusPercent * distanceFactor) / 100));
        }
        if (isCrit) damage = Math.floor(damage * 1.5); // Crítico padrão x1.5

        // 4. Mitigação por Defesa, reduzida pela perfuração de armadura da arma do atacante
        const armorPierce = attacker.getWeaponArmorPierce ? attacker.getWeaponArmorPierce() : 0;
        let defenseRating = defender.derivedStats.defenseRating * (1 - armorPierce);
        if (armorDef.defenseBonusPercent) defenseRating *= (1 + armorDef.defenseBonusPercent / 100);
        if (defenderState.isDefending) {
            defenseRating *= 2; // Dobra a defesa se usou a ação "Defender" no turno
        }
        // Maldição Sanguínea (item 9 da auditoria — árvore de Vampirismo):
        // reduz a Defesa do alvo amaldiçoado enquanto curseTurns > 0.
        if (defenderState.curseTurns > 0) {
            defenseRating *= (1 - defenderState.curseDefensePercent / 100);
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
        // Item 14 da auditoria: uma imbuição temporária de Linhagem (Fio
        // Sanguinário/Fio Consagrado) ativa em `attackerState` assume o
        // lugar do encantamento permanente do item enquanto durar — ver
        // _getEffectiveEnchantment.
        const enchant = this._getEffectiveEnchantment(attacker, attackerState);
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
                // Item 12 da auditoria: `ignoresArmor` (Veneno) agora tem
                // efeito real de verdade — ver applyBleedTick.
                defenderState.bleedIgnoresArmor = !!enchantEff.dot.ignoresArmor;
                // Bug de auditoria visual: sangramento/veneno/queimadura
                // dividiam os MESMOS bleedTurns/bleedDamage e por isso
                // pareciam idênticos na UI (mesmo ícone, mesma cor, mesma
                // mensagem "sofre X de dano por sangramento!" mesmo quando a
                // fonte era Veneno). dotType guarda qual efeito é de
                // verdade, pra applyBleedTick/_buildStatusIconsHtml
                // mostrarem cada um com sua própria identidade visual.
                defenderState.dotType = enchantEff.dot.type;
            }
            if (enchantEff.stunChance && Utils.chance(this._precisionEffectChance(enchantEff.stunChance, attacker) * (1 - negResist))) defenderState.stunned = true;
            if (enchantEff.slowChance && Utils.chance(this._precisionEffectChance(enchantEff.slowChance, attacker) * (1 - negResist))) defenderState.justRan = true; // reaproveita a penalidade de esquiva já existente como "lentidão"
            if (window.GFX && enchantEff.particleColor) window.GFX.spawnParticles(defX, defY, enchantEff.particleColor, 10, 4, 3);
        }

        defender.currentHp -= mitigatedDamage;
        if (defender.currentHp < 0) defender.currentHp = 0;

        // Mecânica de Fúria Crescente (item 6 da mega-diretiva Arena+Estilos:
        // bosses especiais precisam de UMA mecânica própria e legível, nunca
        // só "+HP+STR+DEF") — só bosses com `furyPerHit` definido (ver
        // enemy.js ARENA_BOSS_DEFS/createArenaBoss) acumulam fúria; qualquer
        // outro combatente (jogador, inimigo comum, Rival, boss de Ritual
        // sem essa flag) passa direto por aqui sem nenhum efeito, então essa
        // mecânica nunca vaza pro resto do combate. Os limiares de fúria em
        // si (buffs/mensagens) são aplicados pela IA exclusiva do boss em
        // bossai.js — este bloco só acumula o valor bruto.
        if (defender.isBoss && defender.furyPerHit && mitigatedDamage > 0) {
            defender.furyStacks = Math.min((defender.furyStacks || 0) + defender.furyPerHit, defender.furyMax || 100);
        }

        // Mecânica de Manto de Sombras (Nyxara, Senhora das Sombras — ver
        // enemy.js ARENA_BOSS_DEFS.nyxara_sombras) — só sinaliza QUE um
        // golpe acertou neste round; a própria IA do boss (bossai.js
        // nyxara_sombras.decideAction) decide o que fazer com isso no
        // início do turno dela (zera os stacks acumulados e reseta a
        // esquiva de volta ao valor base). Nunca afeta nenhum outro
        // combatente, igual ao hook de Fúria acima.
        if (defender.isBoss && defender.shadowStackMax && mitigatedDamage > 0) {
            defender.wasHitThisRound = true;
        }

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
            // Mega Atualização item 9 (Sopro da Mata, ver enchantments.js):
            // primeiro encantamento do jogo a interagir com MANA (a diretiva
            // pede explicitamente essa identidade élfica) — restaura MP do
            // atacante a cada acerto, simétrico a healPercent/lifestealPercent
            // acima só que sobre `maxMp` em vez de `maxHp`.
            if (enchantEff.manaRestoreFlat) attacker.currentMp = Utils.clamp(attacker.currentMp + enchantEff.manaRestoreFlat, 0, attacker.derivedStats.maxMp);
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
            // Muralha de Ferro (Contra-Ataque Ensaiado): bônus de UM turno só,
            // concedido por _resolveDefend e sempre consumido aqui —
            // acerte ou erre o revide, não sobra pro próximo golpe.
            const muralhaBonus = defenderState.muralhaCounterBonus || 0;
            defenderState.muralhaCounterBonus = 0;
            const riposteChance = Math.min(70, defender.derivedStats.blockChance * 1.5 + muralhaBonus);
            if (Utils.chance(riposteChance)) {
                counter = this.executeAttack(defender, attacker, defenderState, attackerState, 0.45, true);
                msg += ` <span style="color:#88ccff">${defender.name} contra-ataca com o escudo! ${counter.message}</span>`;
            }
        }

        // Ataque extra por Agilidade (item 9 da revisão profunda): o
        // comentário de baseStats.agi já prometia "velocidade de turno" há
        // muito tempo, mas nenhum sistema em battle.js/player.js implementava
        // isso de verdade — AGI só afetava esquiva/crítico, nunca a
        // velocidade em si. Em vez de reescrever executePlayerTurn/
        // executeEnemyTurn com uma fila de iniciativa (mudança grande demais
        // pro que é essencialmente um turno alternado simples), reaproveita
        // o mesmo padrão do contra-ataque de escudo acima: uma vantagem real
        // de Agilidade sobre o alvo dá chance de golpear de novo, na mesma
        // ação, com um golpe mais fraco. `isExtraAttack` impede que o golpe
        // extra gere outro golpe extra (sem corrente infinita).
        let extraAttack = null;
        if (!isCounter && !isExtraAttack && defender.currentHp > 0 && attacker.currentHp > 0) {
            const agiEdge = attacker.getTotalStat('agi') - defender.getTotalStat('agi');
            if (agiEdge > 0) {
                const extraChance = Math.min(15, agiEdge * 0.3);
                if (Utils.chance(extraChance)) {
                    extraAttack = this.executeAttack(attacker, defender, attackerState, defenderState, 0.5, false, true);
                    msg += ` <span style="color:#ffe27a">${attacker.name} é rápido demais e ataca de novo! ${extraAttack.message}</span>`;
                }
            }
        }

        return { hit: true, crit: isCrit, blocked, damage: mitigatedDamage, message: msg, counter, extraAttack };
    }

    // Aplica o tique de sangramento (Corte Sangrento) no início do turno da vítima.
    // Retorna a mensagem de log, ou null se não houver sangramento ativo.
    applyBleedTick(target, state, isPlayerTarget) {
        if (!state.bleedTurns || state.bleedTurns <= 0) return null;

        // Resistência a sangramento (Vampirismo) reduz o dano de QUALQUER
        // fonte contínua (habilidade de sangramento OU encantamento de
        // fogo/veneno/sangramento) — aplicada aqui, no tique, não na origem.
        const resist = (target.derivedStats && target.derivedStats.bleedResistPercent) || 0;
        let baseTickDamage = state.bleedDamage;
        // Item 12 da auditoria: mitigação por Defesa — a MESMA fórmula usada
        // em qualquer dano físico (Def / (Def + 50)) — se aplica ao tique,
        // A MENOS que a fonte seja Veneno (`bleedIgnoresArmor`). Antes NADA
        // aqui olhava pra Defesa: Fogo/Sangramento/Veneno eram idênticos
        // nesse aspecto, então o texto do Veneno ("ignora armadura") não
        // descrevia nenhuma diferença real — agora ignora Defesa de
        // verdade, e Fogo/Sangramento passam a ser mitigados por ela, como
        // qualquer corte/queimadura física esperaria.
        if (!state.bleedIgnoresArmor && target.derivedStats && target.derivedStats.defenseRating) {
            const reductionPercent = target.derivedStats.defenseRating / (target.derivedStats.defenseRating + 50);
            baseTickDamage = baseTickDamage * (1 - reductionPercent);
        }
        const tickDamage = Math.max(1, Math.floor(baseTickDamage * (1 - resist / 100)));

        target.currentHp = Utils.clamp(target.currentHp - tickDamage, 0, target.derivedStats.maxHp);
        state.bleedTurns--;

        // Item de auditoria visual: partícula/mensagem seguem o dotType real
        // (sangramento/veneno/queimadura) em vez de sempre mostrar sangue
        // vermelho e "de dano por sangramento" mesmo quando a fonte era
        // outra — ver DOT_VISUALS em enchantments.js.
        const visuals = (window.DOT_VISUALS && window.DOT_VISUALS[state.dotType]) || window.DOT_VISUALS.sangramento;

        const x = window.GFX.getEntityX(isPlayerTarget, window.innerWidth);
        const y = window.innerHeight / 2;
        if (window.GFX) {
            window.GFX.spawnText(x, y - 80, `-${tickDamage}`, '#ff3333', false);
            window.GFX.spawnParticles(x, y, visuals.color, 10, 3, 3);
        }

        return `<span style="color:${visuals.color}">${target.name} sofre ${tickDamage} de dano por ${visuals.label}!</span>`;
    }

    // Contagem regressiva da Maldição Sanguínea (item 9 da auditoria —
    // Vampirismo) no início do turno da VÍTIMA amaldiçoada — espelha
    // exatamente o mesmo ponto de chamada de applyBleedTick acima. Ao
    // contrário do sangramento (que causa dano a cada tique), a maldição só
    // reduz a Defesa do alvo enquanto curseTurns > 0 (ver executeAttack);
    // aqui só decrementa o contador e avisa quando ela se dissipa.
    tickCurse(target, state) {
        if (!state.curseTurns || state.curseTurns <= 0) return null;
        state.curseTurns--;
        if (state.curseTurns <= 0) {
            return `<span style="color:#7a1030">A maldição sobre ${target.name} se dissipou.</span>`;
        }
        return null;
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
        this.playerState.muralhaCounterBonus = 0; // Mesmo ciclo de vida de isDefending acima — nunca sobrevive além do turno em que foi concedido, mesmo sem ser consumido por um bloqueio
        this.playerState.holdingDistance = false; // Reseta a postura de manter distância
        window.UI.toggleBattleButtons(false); // Bloqueia a UI
        if (this.player.tickCooldowns) this.player.tickCooldowns(); // Recargas de habilidade avançam a cada turno do jogador
        // Regeneração passiva de mana REMOVIDA (pedido do usuário: mana só
        // volta com Defender ou poção, ver player.js Entity — comentário
        // onde regenMp() vivia antes).

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

        // Contagem regressiva da Maldição Sanguínea sofrida PELO jogador
        // (ver tickCurse) — nunca causa dano/derrota, então não precisa de
        // checkWinCondition como o sangramento acima.
        const playerCurseMsg = this.tickCurse(this.player, this.playerState);
        if (playerCurseMsg) window.UI.appendBattleLog(playerCurseMsg);

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

        // Contagem regressiva de barreira/esquiva/imbuição temporárias da Linhagem
        if (this.playerState.shieldTurns > 0) this.playerState.shieldTurns--;
        if (this.playerState.evasionTurns > 0) this.playerState.evasionTurns--;
        if (this.playerState.weaponImbueTurns > 0) {
            this.playerState.weaponImbueTurns--;
            if (this.playerState.weaponImbueTurns <= 0) this.playerState.weaponImbueId = null;
        }

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
            resultMsg = this._resolveDefend(this.player, this.playerState, true);
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
            // Rework da Taverna item 4: `true` = em combate — bloqueia
            // itens `outOfCombatOnly` (bandagens) mesmo que a UI de seleção
            // (ui.js openBattleItemMenu) já os tenha filtrado da lista;
            // nunca confiar só na UI pra essa regra.
            const result = this.player.useConsumable(param, true);
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

            // Estilo de Combate incompatível (item 19 da diretiva Arena +
            // Estilos): equipar algo errado NUNCA remove o equipamento
            // sozinho, só bloqueia a habilidade do estilo até o jogador
            // reequipar o certo — mesma ideia de duas camadas já usada
            // pras Bandagens (outOfCombatOnly, ver useConsumable/
            // openBattleItemMenu), aqui a segunda camada é
            // openBattleSkillMenu (ui.js), que já filtra do menu.
            if (skill.isStyleSkill && !window.CombatStyleSystem.isStyleCompatible(this.player, skill.styleId)) {
                const style = window.CombatStyleSystem.getStyle(skill.styleId);
                resultMsg = (style && style.incompatibleMessage) || `${skill.name} exige equipamento compatível com o estilo.`;
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
                if (skill.type === 'PHYSICAL' || skill.type === 'BLEED' || skill.type === 'STUN' || skill.type === 'LIFESTEAL' || skill.type === 'CURSE') {
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
                // Rastreado pro Mestre de Armas Orc ("vença sem usar
                // nenhuma habilidade") — conta a partir daqui (habilidade
                // validamente invocada), não só em caso de acerto.
                this.playerUsedAnySkill = true;

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
                    // Coeficiente 2.5 (item 15 da revisão profunda: análise matemática
                    // mostrou INT dominando dano físico cada vez mais forte late-game).
                    // Simulação de 20 turnos (build 70% INT vs 70% STR, mesmos pontos,
                    // arma representativa em ambos, alvo com DEF/RES médios do nível)
                    // com coeficiente 3 (original): dano mágico total já saía 21% maior
                    // que o físico no nível 5 e a vantagem SUBIA pra 44% no nível 30 —
                    // a folga cresce porque o bônus fixo de arma (que não escala com
                    // nível) dilui cada vez menos o multiplicador puro de INT enquanto
                    // o personagem sobe de nível. Com 2.5 a mesma simulação fica quase
                    // no empate (nível 5: +2%, nível 15: +14%, nível 30: +19%) — builds
                    // de INT continuam fortes (ainda ligeiramente à frente, compensando
                    // o custo/gestão de mana), só sem a explosão desproporcional
                    // tardia. Ver /tmp/pw/sim_coef_search.js para a simulação completa.
                    const magicDmg = this.applyLineageWeakness(this.player, this.enemy, Math.floor(this.player.getTotalStat('int') * 2.5 * skill.powerMulti));
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
                    this.enemyState.dotType = 'sangramento';
                    // Item 12 da auditoria: um corte de habilidade é mitigado
                    // por Defesa como qualquer dano físico — nunca deixa
                    // `bleedIgnoresArmor` travado em `true` de um Veneno
                    // anterior que já tenha expirado.
                    this.enemyState.bleedIgnoresArmor = false;

                    resultMsg = `<span style="color:#ff5555">${this.player.name} usou ${skill.name}, causando ${mitigatedDamage} de dano e sangramento!</span>`;
                    window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#ff3333", false);
                    window.GFX.spawnParticles(enemyX, enemyY, "#8b0000", 25, 5, 4);
                    window.GFX.playAnim(false, 'hurt', 500);
                    window.AudioManager.playSwordClash();
                }
                else if (skill.type === 'CURSE') {
                    // Maldição Sanguínea (item 9 da auditoria — árvore de
                    // Vampirismo): dano + amaldiçoa o inimigo, reduzindo a
                    // Defesa dele por N turnos (ver executeAttack, mitigação
                    // de Defesa). Diferente de SHIELD/EVASION (que reforçam
                    // QUEM lança), este é o primeiro efeito de linhagem que
                    // enfraquece o ALVO — a Luz nunca amaldiçoa ninguém, só
                    // cura/protege/nuka à distância, reforçando que as duas
                    // árvores não compartilham identidade nenhuma.
                    let damage = this.applyLineageWeakness(this.player, this.enemy, Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti));
                    let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                    let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));

                    this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                    this.enemyState.curseTurns = skill.duration;
                    this.enemyState.curseDefensePercent = skill.curseDefensePercent;

                    resultMsg = `<span style="color:#7a1030">${this.player.name} usou ${skill.name}: ${mitigatedDamage} de dano e ${this.enemy.name} foi amaldiçoado (-${skill.curseDefensePercent}% de Defesa por ${skill.duration} turnos)!</span>`;
                    window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#c81e6e", false);
                    window.GFX.spawnParticles(enemyX, enemyY, "#7a1030", 25, 5, 4);
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
                    const stunned = Utils.chance(this._precisionEffectChance(skill.stunChance, this.player) * (1 - negResist));
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
                else if (skill.type === 'IMBUE_WEAPON') {
                    // Imbuição temporária de arma (item 14 da auditoria — Fio
                    // Sanguinário/Fio Consagrado): substitui o encantamento
                    // efetivo da arma equipada por `skill.duration` turnos
                    // (ver _getEffectiveEnchantment/executeAttack) — igual a
                    // SHIELD/EVASION acima, é um buff no PRÓPRIO lançador,
                    // nunca um efeito no alvo.
                    this.playerState.weaponImbueId = skill.imbueEnchantId;
                    this.playerState.weaponImbueTurns = skill.duration;
                    const imbue = window.LINEAGE_IMBUES ? window.LINEAGE_IMBUES[skill.imbueEnchantId] : null;
                    resultMsg = `<span style="color:${imbue ? imbue.color : '#fff2c0'}">${this.player.name} usa ${skill.name}, imbuindo a arma por ${skill.duration} turnos!</span>`;
                    window.GFX.spawnParticles(playerX, playerY, imbue ? imbue.color : "#fff2c0", 25, 4, 5);
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

        // Rastreado pros Mestres de Treinamento Orc (ver js/orctraining.js)
        // — reaproveita o MESMO `enemyHpBefore` já capturado pra IA logo
        // abaixo, nunca um contador de dano paralelo. Cobre QUALQUER fonte
        // de dano nesta ação (ATK, toda variante de SKILL, contra-ataque),
        // sem precisar instrumentar cada branch individualmente.
        this.playerDamageDealt += Math.max(0, enemyHpBefore - this.enemy.currentHp);

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
            // Mesmo coeficiente 2.5 do lado do jogador (ver comentário em
            // executeSkill/player MAGIC, item 15) — mantém simetria entre
            // magos jogadores e magos inimigos.
            const magicDmg = this.applyLineageWeakness(this.enemy, this.player, Math.floor(this.enemy.getTotalStat('int') * 2.5 * skill.powerMulti));
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
            this.playerState.dotType = 'sangramento';
            // Item 12 da auditoria: mesmo motivo do ramo do jogador acima.
            this.playerState.bleedIgnoresArmor = false;
            message = `<span style="color:#ff5555">${this.enemy.name} usou ${skill.name}, causando ${mitigatedDamage} de dano e sangramento!</span>`;
            window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#ff3333", false);
            window.GFX.spawnParticles(playerX, playerY, "#8b0000", 25, 5, 4);
            window.GFX.playAnim(true, 'hurt', 500);
            window.AudioManager.playSwordClash();
            selfEvent = { type: 'landedHit', crit: false };
        } else if (skill.type === 'CURSE') {
            // Espelha o ramo do jogador acima (mesmo motivo: só existe pra
            // um futuro boss/skillDef reaproveitar este `type`, já que
            // Enemy/Rival comuns nunca têm `.lineage` nem acesso à árvore
            // de Vampirismo — mesma simetria já mantida por SHIELD/EVASION).
            let curseDamage = this.applyLineageWeakness(this.enemy, this.player, Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti));
            let curseReductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
            let curseMitigatedDamage = Math.max(1, Math.floor(curseDamage * (1 - curseReductionPercent)));
            this.player.currentHp = Utils.clamp(this.player.currentHp - curseMitigatedDamage, 0, this.player.derivedStats.maxHp);
            this.playerState.curseTurns = skill.duration;
            this.playerState.curseDefensePercent = skill.curseDefensePercent;
            message = `<span style="color:#7a1030">${this.enemy.name} usou ${skill.name}: ${curseMitigatedDamage} de dano e ${this.player.name} foi amaldiçoado (-${skill.curseDefensePercent}% de Defesa por ${skill.duration} turnos)!</span>`;
            window.GFX.spawnText(playerX, playerY - 50, `-${curseMitigatedDamage}`, "#c81e6e", false);
            window.GFX.spawnParticles(playerX, playerY, "#7a1030", 25, 5, 4);
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
            const stunned = Utils.chance(this._precisionEffectChance(skill.stunChance, this.enemy) * (1 - negResist));
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
        } else if (skill.type === 'TELEPORT_ENEMY') {
            // Iteração 2 da mega-diretiva de IA de combate (item 3, bug
            // confirmado na auditoria): esses 3 tipos já existiam desde
            // skills.js/executePlayerTurn, mas nunca tinham um branch aqui —
            // um inimigo com essas magias equipadas "conjurava" e nada
            // acontecia (MP gasto, efeito zero). Espelha exatamente o ramo
            // do jogador acima (TELEPORT_ENEMY): o INIMIGO se teleporta para
            // o corpo a corpo do jogador — versão mágica da Investida.
            this.distance = 0;
            message = `<span style="color:#66ccff">${this.enemy.name} usou ${skill.name} e surge no seu corpo a corpo! (Distância: ${this.distance.toFixed(1)}m)</span>`;
            window.GFX.spawnParticles(enemyX, enemyY, "#66ccff", 20, 5, 4);
            window.AudioManager.playMagicCast();
        } else if (skill.type === 'TELEPORT_FAR') {
            this.distance = 10;
            message = `<span style="color:#66ccff">${this.enemy.name} usou ${skill.name} e desaparece para o ponto mais distante! (Distância: ${this.distance.toFixed(1)}m)</span>`;
            window.GFX.spawnParticles(enemyX, enemyY, "#66ccff", 20, 5, 4);
            window.AudioManager.playMagicCast();
        } else if (skill.type === 'AMMO_RECALL') {
            const rangedWeapon = this.enemy.equipment[SLOTS.RANGED];
            if (rangedWeapon && rangedWeapon.maxAmmo) {
                rangedWeapon.ammo = rangedWeapon.maxAmmo;
                message = `<span style="color:#66ccff">${this.enemy.name} usou ${skill.name} e recupera toda a munição de ${rangedWeapon.name}! (${rangedWeapon.ammo}/${rangedWeapon.maxAmmo})</span>`;
            } else {
                message = `${this.enemy.name} usou ${skill.name}, mas não possui nenhuma arma de longo alcance equipada.`;
            }
            window.GFX.spawnParticles(enemyX, enemyY, "#66ccff", 15, 4, 4);
            window.AudioManager.playMagicCast();
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
        } else if (skill.type === 'IMBUE_WEAPON') {
            // Espelha o ramo do jogador acima (mesmo motivo: só existe pra
            // um futuro boss/skillDef reaproveitar este `type`, mesma
            // simetria já mantida por SHIELD/EVASION/CURSE).
            this.enemyState.weaponImbueId = skill.imbueEnchantId;
            this.enemyState.weaponImbueTurns = skill.duration;
            const imbue = window.LINEAGE_IMBUES ? window.LINEAGE_IMBUES[skill.imbueEnchantId] : null;
            message = `<span style="color:${imbue ? imbue.color : '#fff2c0'}">${this.enemy.name} usa ${skill.name}, imbuindo a arma por ${skill.duration} turnos!</span>`;
            window.GFX.spawnParticles(enemyX, enemyY, imbue ? imbue.color : "#fff2c0", 25, 4, 5);
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
        this.enemyState.muralhaCounterBonus = 0; // Mesmo ciclo de vida de isDefending acima — ver executePlayerTurn
        this.enemyState.holdingDistance = false; // Reseta a postura de manter distância — espelha o reset do jogador em executePlayerTurn
        if (this.enemy.tickCooldowns) this.enemy.tickCooldowns();
        // Regeneração passiva de mana REMOVIDA — mesma regra do jogador
        // (ver executePlayerTurn acima), simetria mantida dos dois lados.
        // Bug de auditoria (relatado pelo usuário): inimigos usavam item de
        // cura em turnos seguidos ("spam de poção") sempre que HP e cargas
        // permitiam — a cura de 25% do HP máximo raramente tirava o inimigo
        // da faixa "abaixo de 60%" num só uso, então ITEM continuava sendo a
        // ação de maior pontuação turno após turno até as cargas acabarem.
        // Cooldown de 2 turnos próprios entre usos força pelo menos uma
        // ação de combate real entre curas, sem reduzir o total de cargas
        // disponíveis (ver ai.js/executeEnemyItem).
        if (this.enemy.aiState && this.enemy.aiState.itemCooldown > 0) this.enemy.aiState.itemCooldown--;

        // Contagem regressiva de barreira/esquiva/imbuição temporárias (usado
        // por bosses com habilidades próprias, ex: Anjo Guardião)
        if (this.enemyState.shieldTurns > 0) this.enemyState.shieldTurns--;
        if (this.enemyState.evasionTurns > 0) this.enemyState.evasionTurns--;
        if (this.enemyState.weaponImbueTurns > 0) {
            this.enemyState.weaponImbueTurns--;
            if (this.enemyState.weaponImbueTurns <= 0) this.enemyState.weaponImbueId = null;
        }

        // Contagem regressiva da Maldição Sanguínea sofrida PELO inimigo
        // (ver tickCurse) — espelha o mesmo ponto de chamada do jogador em
        // executePlayerTurn.
        const enemyCurseMsg = this.tickCurse(this.enemy, this.enemyState);
        if (enemyCurseMsg) window.UI.appendBattleLog(enemyCurseMsg);

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
            // `resultMsg` já carrega a fala de sabor da IA (ver ai.js
            // decision.message, ex: "zomba de você, confiante!") — soma a
            // ela em vez de substituir, preservando essa personalidade.
            const defendMsg = this._resolveDefend(this.enemy, this.enemyState, false);
            resultMsg = resultMsg ? `${resultMsg} ${defendMsg}` : defendMsg;
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
            if (!item || item.durability <= 0) continue;
            // Vínculo do Ferreiro (Mega Atualização item 10, ver
            // enchantments.js) — único encantamento do jogo com uma
            // propriedade passiva fora do contrato onHit/onDefend, então
            // é lido direto aqui em vez de forçar uma chamada de função
            // só pra manter uma convenção que não se aplica a este efeito.
            const ench = item.enchantmentId ? window.ENCHANTMENTS[item.enchantmentId] : null;
            if (ench && ench.durabilityShieldChance && Utils.chance(ench.durabilityShieldChance)) continue;
            item.durability--;
        }

        // Rework da Taverna item 15: efeitos de Comida/Bebida (ver
        // player.js useConsumable/`expiresAfterBattles`) expiram por
        // NÚMERO DE BATALHAS, não por dia — decrementa 1 aqui a cada fim de
        // luta (vitória OU derrota, a diretiva não distingue) e remove os
        // que chegaram a 0. Buffs day-based (Hidromel/Runas anãs) nunca têm
        // esse campo, então nunca são tocados por este laço.
        if (this.player.activeBuffs && this.player.activeBuffs.length > 0) {
            this.player.activeBuffs.forEach(b => { if (b.expiresAfterBattles !== undefined) b.expiresAfterBattles--; });
            this.player.activeBuffs = this.player.activeBuffs.filter(b => b.expiresAfterBattles === undefined || b.expiresAfterBattles > 0);
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

            // Reputação (ver reputation.js) — só vitórias IMPORTANTES
            // (elite/Rival/campeão/boss) rendem reputação; um duelo comum
            // não move o número (ver ReputationSystem._opponentWeight),
            // então nenhuma mudança aqui pra Enemy genérico.
            const reputationDelta = window.ReputationSystem ? window.ReputationSystem.onBattleVictory(this.player, this.enemy) : 0;

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

            // Boss Especial da Arena derrotado (ver enemy.js ARENA_BOSS_DEFS/
            // createArenaBoss) — só marca "Derrotado" na tela da Ladder
            // (ui.js openLadder), NUNCA bloqueia reenfrentar (mesmo
            // comportamento já usado pelos Rivais comuns/Campeões).
            if (this.enemy.bossId && window.ARENA_BOSS_DEFS && window.ARENA_BOSS_DEFS[this.enemy.bossId]) {
                if (!this.player.arenaBossesDefeated) this.player.arenaBossesDefeated = [];
                if (!this.player.arenaBossesDefeated.includes(this.enemy.bossId)) {
                    this.player.arenaBossesDefeated.push(this.enemy.bossId);
                }
            }

            // Progresso de Missões Secundárias (ver quests.js) — bosses de
            // Ritual ficam de fora (combate único/especial, não um "duelo"
            // comum pra fins de missão, igual ao Ritual da Luz que também
            // não mistura contadores com combates de boss).
            if (window.QuestSystem && !this.enemy.isBoss) {
                window.QuestSystem.onBattleVictory(this.player, this.enemy, { hpPercentAtEnd: hpPercent });
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

            // Mestres de Treinamento Orc (ver js/orctraining.js, MEGA
            // REWORK econômico) — mesmo ponto de integração que QuestSystem/
            // ReputationSystem acima, só dispara se houver um desafio ativo
            // (ver OrcTrainingSystem.onBattleVictory). `usedMagic` reaproveita
            // `this.usedOffensiveMagic` (já existia pro Ritual da Luz, linha
            // acima) — nunca um segundo rastreador do mesmo dado.
            if (window.OrcTrainingSystem) {
                const trainingResult = window.OrcTrainingSystem.onBattleVictory(this.player, this.enemy, {
                    damageDealt: this.playerDamageDealt,
                    usedMagic: this.usedOffensiveMagic,
                    usedAnySkill: this.playerUsedAnySkill,
                    turnsSurvived: this.turnCount,
                });
                if (trainingResult && trainingResult.success) {
                    window.UI.appendBattleLog(`<span style="color:#ffb340">⚔️ Desafio de ${trainingResult.master.name} concluído! +${trainingResult.master.reward} pontos de atributo.</span>`);
                }
            }

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
                    window.UI.showBattleResults(true, expGained, goldGained, leveledUp, loot, newAchievements, reputationDelta);
                });
            } else {
                setTimeout(() => window.UI.showBattleResults(true, expGained, goldGained, leveledUp, loot, newAchievements, reputationDelta), 2000);
            }

        } else if (result === 'DEFEAT') {
            window.UI.appendBattleLog(`<span style="color:#8b0000; font-size:1.2rem;">Você foi derrotado...</span>`);

            this.player.losses = (this.player.losses || 0) + 1;
            this.player.addFatigue(1); // Cada derrota deixa o gladiador mais cansado

            // Penalidade econômica por derrota (seção 2 do sistema de
            // Reputação, ver reputation.js) — perde uma fração do ouro
            // CARREGADO, nunca o guardado no Banco (mesma proteção que já
            // existia contra ladrões/assaltos noturnos, ver city.js
            // _eventNightMugging — reaproveitada aqui em vez de inventar
            // uma segunda "reserva protegida"). Nunca remove equipamento,
            // armas, habilidades ou progresso de linhagem — só ouro e
            // reputação, conforme pedido explícito.
            const weight = window.ReputationSystem ? window.ReputationSystem._opponentWeight(this.enemy) : 0;
            const goldLossPercent = 0.08 + weight * 0.015; // comum=8%, boss=15.5%
            const goldLost = Math.min(this.player.gold, Math.round(this.player.gold * goldLossPercent));
            this.player.gold -= goldLost;

            const reputationDelta = window.ReputationSystem ? window.ReputationSystem.onBattleDefeat(this.player, this.enemy) : 0;

            // Penalidade por morte: Revive no hub com 10% de HP
            this.player.currentHp = Math.floor(this.player.derivedStats.maxHp * 0.1);

            setTimeout(() => window.UI.showBattleResults(false, 0, -goldLost, false, null, [], reputationDelta), 2000);
        }

        window.SaveManager.save(window.Engine.state);
    }
}
