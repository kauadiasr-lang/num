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

        // Modificadores de estado temporários (defesa, sangramento, atordoamento,
        // corrida recente e postura de manter distância)
        this.playerState = { isDefending: false, bleedTurns: 0, bleedDamage: 0, stunned: false, justRan: false, holdingDistance: false };
        this.enemyState = { isDefending: false, bleedTurns: 0, bleedDamage: 0, stunned: false, justRan: false, holdingDistance: false };

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

    // Calcula dano, acerto e crítico de um ataque físico básico, e dispara VFX/SFX.
    // damageMulti (padrão 1) permite bônus de dano de ações especiais (ex: Investida)
    // sem alterar o cálculo de nenhuma chamada existente.
    executeAttack(attacker, defender, attackerState, defenderState, damageMulti = 1, isCounter = false) {
        const isPlayer = attacker === this.player;
        const defX = window.GFX.getEntityX(!isPlayer, window.innerWidth);
        const defY = window.innerHeight / 2;

        // 1. Cálculo de Acerto (Precisão vs Esquiva), com bônus de precisão da arma.
        // Quem correu no turno anterior (Correr) fica com a esquiva reduzida.
        const weaponAcc = attacker.getWeaponAccBonus ? attacker.getWeaponAccBonus() : 0;
        let effectiveDodge = defender.derivedStats.dodgeChance;
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

        // 2. Cálculo de Crítico
        let isCrit = Utils.chance(attacker.derivedStats.critChance);

        // 3. Cálculo de Dano Base (com multiplicador de ação especial, se houver)
        let damage = Math.floor(attacker.derivedStats.physicalDamage * damageMulti);
        if (isCrit) damage = Math.floor(damage * 1.5); // Crítico padrão x1.5

        // 4. Mitigação por Defesa, reduzida pela perfuração de armadura da arma do atacante
        const armorPierce = attacker.getWeaponArmorPierce ? attacker.getWeaponArmorPierce() : 0;
        let defenseRating = defender.derivedStats.defenseRating * (1 - armorPierce);
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

        defender.currentHp -= mitigatedDamage;
        if (defender.currentHp < 0) defender.currentHp = 0;

        // --- Camada Visual/Sonora ---
        if (window.GFX) {
            const textColor = isCrit ? '#ffcc00' : (blocked ? '#88ccff' : '#ffffff');
            window.GFX.spawnText(defX, defY - 50, `-${mitigatedDamage}`, textColor, isCrit);
            const particleColor = blocked ? '#88ccff' : (defenderState.isDefending ? '#cccccc' : '#cc0000');
            window.GFX.spawnParticles(defX, defY, particleColor, isCrit ? 30 : 15, isCrit ? 8 : 4);
            window.GFX.playAnim(!isPlayer, 'hurt');
            if (isCrit) window.GFX.spawnCritBurst(defX, defY);
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

        target.currentHp = Utils.clamp(target.currentHp - state.bleedDamage, 0, target.derivedStats.maxHp);
        state.bleedTurns--;

        const x = window.GFX.getEntityX(isPlayerTarget, window.innerWidth);
        const y = window.innerHeight / 2;
        if (window.GFX) {
            window.GFX.spawnText(x, y - 80, `-${state.bleedDamage}`, '#ff3333', false);
            window.GFX.spawnParticles(x, y, '#8b0000', 10, 3, 3);
        }

        return `<span style="color:#ff5555">${target.name} sofre ${state.bleedDamage} de dano por sangramento!</span>`;
    }

    // Processa o fim do combate
    checkWinCondition() {
        if (this.enemy.currentHp <= 0) {
            this.isBattleActive = false;
            return 'VICTORY';
        } else if (this.player.currentHp <= 0) {
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
            if (!this.isInRange(range)) {
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

            const atkResult = this.executeAttack(this.player, this.enemy, this.playerState, this.enemyState);
            resultMsg = atkResult.message;
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
            const speed = this.player.getWeaponSpeed();
            this.applyDistanceChange(-speed.approachSpeed);
            resultMsg = `${this.player.name} avança em direção ao oponente. (Distância: ${this.distance.toFixed(1)}m)`;
            if (window.GFX) window.GFX.playAnim(true, 'approach', 700);
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
            if (this.isInRange(range) && !outOfAmmo) {
                if (chargeWeapon && chargeWeapon.maxAmmo) chargeWeapon.ammo--;
                const atkResult = this.executeAttack(this.player, this.enemy, this.playerState, this.enemyState, 1.2);
                resultMsg = `${this.player.name} investiu contra o oponente! ${atkResult.message}`;
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
                    // Cura base = Inteligência * 2.5 * powerMulti
                    const healAmount = Math.floor(this.player.getTotalStat('int') * 2.5 * skill.powerMulti);
                    this.player.currentHp = Utils.clamp(this.player.currentHp + healAmount, 0, this.player.derivedStats.maxHp);
                    resultMsg = `<span style="color:#1eff00">${this.player.name} usou ${skill.name} e recuperou ${healAmount} HP!</span>`;
                    window.GFX.spawnText(playerX, playerY - 50, `+${healAmount}`, "#1eff00", false);
                    window.GFX.spawnParticles(playerX, playerY, "#1eff00", 25, 4, 4);
                    window.AudioManager.playHeal();
                }
                else if (skill.type === 'MAGIC') {
                    // Dano mágico ignora armadura, mitigado apenas pela Inteligência do inimigo
                    const magicDmg = Math.floor(this.player.getTotalStat('int') * 3 * skill.powerMulti);
                    const resist = this.enemy.getTotalStat('int') * 0.5;
                    let finalDmg = Math.floor(magicDmg - resist);
                    if (finalDmg < 1) finalDmg = 1;

                    this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - finalDmg, 0, this.enemy.derivedStats.maxHp);
                    resultMsg = `<span style="color:#a335ee">${this.player.name} conjurou ${skill.name} causando ${finalDmg} de Dano Mágico!</span>`;
                    window.GFX.spawnText(enemyX, enemyY - 50, `-${finalDmg}`, "#a335ee", true);
                    window.GFX.spawnParticles(enemyX, enemyY, "#a335ee", 40, 6, 5);
                    window.Engine.triggerShake(8, 0.2);
                    window.AudioManager.playMagicCast();
                }
                else if (skill.type === 'PHYSICAL') {
                    // Aproveita o cálculo base de ataque físico, com bônus de acerto e multiplicador de poder
                    let hitChance = 110 + (this.player.getTotalStat('acc') * 2) - this.enemy.derivedStats.dodgeChance;
                    if (Utils.chance(hitChance)) {
                        let damage = Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti);
                        let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                        let mitigatedDamage = Math.floor(damage * (1 - reductionPercent));
                        if (mitigatedDamage < 1) mitigatedDamage = 1;

                        this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                        resultMsg = `<span style="color:var(--color-gold)">${this.player.name} executou ${skill.name} causando esmagadores ${mitigatedDamage} de Dano!</span>`;
                        window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#ffcc00", true);
                        window.GFX.spawnParticles(enemyX, enemyY, "#cc0000", 25, 6, 5);
                        window.Engine.triggerShake(10, 0.25);
                        window.AudioManager.playSwordClash();
                    } else {
                        resultMsg = `${this.player.name} usou ${skill.name} mas errou o alvo!`;
                    }
                }
                else if (skill.type === 'BLEED') {
                    let damage = Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti);
                    let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                    let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));

                    this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                    this.enemyState.bleedTurns = skill.duration;
                    this.enemyState.bleedDamage = Math.max(1, Math.floor(this.player.getTotalStat('str') * 0.8));

                    resultMsg = `<span style="color:#ff5555">${this.player.name} usou ${skill.name}, causando ${mitigatedDamage} de dano e sangramento!</span>`;
                    window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#ff3333", false);
                    window.GFX.spawnParticles(enemyX, enemyY, "#8b0000", 25, 5, 4);
                    window.AudioManager.playSwordClash();
                }
                else if (skill.type === 'STUN') {
                    let damage = Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti);
                    let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                    let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));

                    this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                    const stunned = Utils.chance(skill.stunChance);
                    if (stunned) this.enemyState.stunned = true;

                    resultMsg = stunned
                        ? `<span style="color:#3388ff">${this.player.name} usou ${skill.name}: ${mitigatedDamage} de dano e ${this.enemy.name} ficou atordoado!</span>`
                        : `<span style="color:#3388ff">${this.player.name} usou ${skill.name}, causando ${mitigatedDamage} de dano.</span>`;
                    window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#3388ff", false);
                    window.GFX.spawnParticles(enemyX, enemyY, "#3388ff", 25, 5, 4);
                    window.Engine.triggerShake(6, 0.15);
                    window.AudioManager.playSwordClash();
                }
                else if (skill.type === 'LIFESTEAL') {
                    let hitChance = 100 + (this.player.getTotalStat('acc') * 2) - this.enemy.derivedStats.dodgeChance;
                    if (Utils.chance(hitChance)) {
                        let damage = Math.floor(this.player.derivedStats.physicalDamage * skill.powerMulti);
                        let reductionPercent = this.enemy.derivedStats.defenseRating / (this.enemy.derivedStats.defenseRating + 50);
                        let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));

                        this.enemy.currentHp = Utils.clamp(this.enemy.currentHp - mitigatedDamage, 0, this.enemy.derivedStats.maxHp);
                        const healed = Math.floor(mitigatedDamage * (skill.lifestealPercent / 100));
                        this.player.currentHp = Utils.clamp(this.player.currentHp + healed, 0, this.player.derivedStats.maxHp);

                        resultMsg = `<span style="color:#aa0044">${this.player.name} usou ${skill.name}: ${mitigatedDamage} de dano, recuperando ${healed} HP!</span>`;
                        window.GFX.spawnText(enemyX, enemyY - 50, `-${mitigatedDamage}`, "#ff0066", true);
                        window.GFX.spawnText(playerX, playerY - 50, `+${healed}`, "#1eff00", false);
                        window.GFX.spawnParticles(enemyX, enemyY, "#aa0044", 30, 6, 5);
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
            const magicDmg = Math.floor(this.enemy.getTotalStat('int') * 3 * skill.powerMulti);
            const resist = this.player.getTotalStat('int') * 0.5;
            let finalDmg = Math.max(1, Math.floor(magicDmg - resist));
            this.player.currentHp = Utils.clamp(this.player.currentHp - finalDmg, 0, this.player.derivedStats.maxHp);
            message = `<span style="color:#a335ee">${this.enemy.name} conjurou ${skill.name} causando ${finalDmg} de Dano Mágico!</span>`;
            window.GFX.spawnText(playerX, playerY - 50, `-${finalDmg}`, "#a335ee", true);
            window.GFX.spawnParticles(playerX, playerY, "#a335ee", 40, 6, 5);
            window.Engine.triggerShake(8, 0.2);
            window.AudioManager.playMagicCast();
            selfEvent = { type: 'landedHit', crit: false };
        } else if (skill.type === 'PHYSICAL') {
            let hitChance = 110 + (this.enemy.getTotalStat('acc') * 2) - this.player.derivedStats.dodgeChance;
            if (Utils.chance(hitChance)) {
                let damage = Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti);
                let reductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
                let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));
                this.player.currentHp = Utils.clamp(this.player.currentHp - mitigatedDamage, 0, this.player.derivedStats.maxHp);
                message = `<span style="color:var(--color-gold)">${this.enemy.name} executou ${skill.name} causando esmagadores ${mitigatedDamage} de Dano!</span>`;
                window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#ffcc00", true);
                window.GFX.spawnParticles(playerX, playerY, "#cc0000", 25, 6, 5);
                window.Engine.triggerShake(10, 0.25);
                window.AudioManager.playSwordClash();
                selfEvent = { type: 'landedHit', crit: false };
            } else {
                message = `${this.enemy.name} usou ${skill.name} mas errou o alvo!`;
                selfEvent = { type: 'missed' };
            }
        } else if (skill.type === 'BLEED') {
            let damage = Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti);
            let reductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
            let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));
            this.player.currentHp = Utils.clamp(this.player.currentHp - mitigatedDamage, 0, this.player.derivedStats.maxHp);
            this.playerState.bleedTurns = skill.duration;
            this.playerState.bleedDamage = Math.max(1, Math.floor(this.enemy.getTotalStat('str') * 0.8));
            message = `<span style="color:#ff5555">${this.enemy.name} usou ${skill.name}, causando ${mitigatedDamage} de dano e sangramento!</span>`;
            window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#ff3333", false);
            window.GFX.spawnParticles(playerX, playerY, "#8b0000", 25, 5, 4);
            window.AudioManager.playSwordClash();
            selfEvent = { type: 'landedHit', crit: false };
        } else if (skill.type === 'STUN') {
            let damage = Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti);
            let reductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
            let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));
            this.player.currentHp = Utils.clamp(this.player.currentHp - mitigatedDamage, 0, this.player.derivedStats.maxHp);
            const stunned = Utils.chance(skill.stunChance);
            if (stunned) this.playerState.stunned = true;
            message = stunned
                ? `<span style="color:#3388ff">${this.enemy.name} usou ${skill.name}: ${mitigatedDamage} de dano e ${this.player.name} ficou atordoado!</span>`
                : `<span style="color:#3388ff">${this.enemy.name} usou ${skill.name}, causando ${mitigatedDamage} de dano.</span>`;
            window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#3388ff", false);
            window.GFX.spawnParticles(playerX, playerY, "#3388ff", 25, 5, 4);
            window.Engine.triggerShake(6, 0.15);
            window.AudioManager.playSwordClash();
            selfEvent = { type: 'landedHit', crit: false };
        } else if (skill.type === 'LIFESTEAL') {
            let hitChance = 100 + (this.enemy.getTotalStat('acc') * 2) - this.player.derivedStats.dodgeChance;
            if (Utils.chance(hitChance)) {
                let damage = Math.floor(this.enemy.derivedStats.physicalDamage * skill.powerMulti);
                let reductionPercent = this.player.derivedStats.defenseRating / (this.player.derivedStats.defenseRating + 50);
                let mitigatedDamage = Math.max(1, Math.floor(damage * (1 - reductionPercent)));
                this.player.currentHp = Utils.clamp(this.player.currentHp - mitigatedDamage, 0, this.player.derivedStats.maxHp);
                const healed = Math.floor(mitigatedDamage * (skill.lifestealPercent / 100));
                this.enemy.currentHp = Utils.clamp(this.enemy.currentHp + healed, 0, this.enemy.derivedStats.maxHp);
                message = `<span style="color:#aa0044">${this.enemy.name} usou ${skill.name}: ${mitigatedDamage} de dano, recuperando ${healed} HP!</span>`;
                window.GFX.spawnText(playerX, playerY - 50, `-${mitigatedDamage}`, "#ff0066", true);
                window.GFX.spawnText(enemyX, enemyY - 50, `+${healed}`, "#1eff00", false);
                window.GFX.spawnParticles(playerX, playerY, "#aa0044", 30, 6, 5);
                window.Engine.triggerShake(10, 0.2);
                window.AudioManager.playCrit();
                selfEvent = { type: 'landedHit', crit: false };
            } else {
                message = `${this.enemy.name} usou ${skill.name} mas errou o alvo!`;
                selfEvent = { type: 'missed' };
            }
        }

        if (selfEvent && window.AICombat) window.AICombat.onSelfEvent(this, selfEvent.type, selfEvent);
        return message;
    }

    // Cura o inimigo usando uma carga de item "virtual" (ver ai.js — inimigos
    // não têm mochila de verdade, só um número de curas equivalente ao quanto
    // a personalidade gosta de usar itens).
    executeEnemyItem() {
        this.enemy.aiState.itemCharges = Math.max(0, (this.enemy.aiState.itemCharges || 0) - 1);
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
        if (this.enemy.tickCooldowns) this.enemy.tickCooldowns();

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

        const decision = window.AICombat ? window.AICombat.decideAction(this) : { action: 'ATK', message: `${this.enemy.name} ataca!` };
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
            if (window.GFX) window.GFX.playAnim(false, 'run', 700);
        } else if (decision.action === 'RETREAT') {
            const amount = decision.amount !== undefined ? decision.amount : speed.retreatSpeed;
            this.applyDistanceChange(amount);
            if (window.GFX) window.GFX.playAnim(false, 'retreat', 700);
        } else if (decision.action === 'CHARGE') {
            this.applyDistanceChange(-speed.approachSpeed * 2);
            if (window.GFX) window.GFX.playAnim(false, 'charge', 700);
            const range = this.enemy.getWeaponRange();
            if (this.isInRange(range)) {
                const atkResult = this.executeAttack(this.enemy, this.player, this.enemyState, this.playerState, 1.2);
                resultMsg = `${this.enemy.name} investiu contra você! ${atkResult.message}`;
                if (window.AICombat) window.AICombat.onSelfEvent(this, atkResult.hit ? 'landedHit' : 'missed', { crit: atkResult.crit });
            } else {
                resultMsg = `${this.enemy.name} investiu, mas não alcançou você.`;
            }
        } else if (decision.action === 'ATK') {
            const atkResult = this.executeAttack(this.enemy, this.player, this.enemyState, this.playerState);
            resultMsg = atkResult.message;
            if (window.AICombat) window.AICombat.onSelfEvent(this, atkResult.hit ? 'landedHit' : 'missed', { crit: atkResult.crit });
        } else if (decision.action === 'SKILL') {
            resultMsg = this.executeEnemySkill(decision.param);
        } else if (decision.action === 'ITEM') {
            resultMsg = this.executeEnemyItem();
        } else if (decision.action === 'SWAP_INTERNAL') {
            resultMsg = window.AICombat.trySwapWeapon(this);
        } else if (decision.action === 'HOLD') {
            // sem efeito mecânico extra além de flavor — controla espaço/aguarda
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

            const newAchievements = this.player.checkAchievements({
                victory: true, hpPercent, gotLegendary: isLegendary, defeatedRivalId
            });

            // Cura passiva após a batalha (20% do HP max)
            this.player.currentHp = Utils.clamp(this.player.currentHp + Math.floor(this.player.derivedStats.maxHp * 0.2), 0, this.player.derivedStats.maxHp);

            setTimeout(() => window.UI.showBattleResults(true, expGained, goldGained, leveledUp, loot, newAchievements), 2000);

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
