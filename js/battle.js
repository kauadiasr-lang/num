/**
 * Motor de Combate (Turn-based Math + Ciclo de Turnos + IA + VFX/Áudio)
 */

class BattleSystem {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.turnCount = 1;
        this.isPlayerTurn = true;
        this.isBattleActive = true;

        // Modificadores de estado temporários (defesa, sangramento, atordoamento)
        this.playerState = { isDefending: false, bleedTurns: 0, bleedDamage: 0, stunned: false };
        this.enemyState = { isDefending: false, bleedTurns: 0, bleedDamage: 0, stunned: false };
    }

    // Calcula dano, acerto e crítico de um ataque físico básico, e dispara VFX/SFX
    executeAttack(attacker, defender, attackerState, defenderState) {
        const isPlayer = attacker === this.player;
        const defX = window.GFX.getEntityX(!isPlayer, window.innerWidth);
        const defY = window.innerHeight / 2;

        // 1. Cálculo de Acerto (Precisão vs Esquiva), com bônus de precisão da arma
        const weaponAcc = attacker.getWeaponAccBonus ? attacker.getWeaponAccBonus() : 0;
        let hitChance = 90 + (attacker.getTotalStat('acc') * 2) + weaponAcc - defender.derivedStats.dodgeChance;
        hitChance = Utils.clamp(hitChance, 20, 100); // Mínimo de 20% de chance de acerto

        if (!Utils.chance(hitChance)) {
            if (window.GFX) window.GFX.spawnText(defX, defY - 50, "ESQUIVOU!", "#aaaaaa");
            return { hit: false, crit: false, damage: 0, message: `${attacker.name} errou o ataque!` };
        }

        // 2. Cálculo de Crítico
        let isCrit = Utils.chance(attacker.derivedStats.critChance);

        // 3. Cálculo de Dano Base
        let damage = attacker.derivedStats.physicalDamage;
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
        }
        if (window.Engine) window.Engine.triggerShake(isCrit ? 15 : 3, isCrit ? 0.3 : 0.1);
        if (window.AudioManager) isCrit ? window.AudioManager.playCrit() : window.AudioManager.playSwordClash();

        let msg;
        if (isCrit) msg = `ACERTO CRÍTICO! ${attacker.name} causou ${mitigatedDamage} de dano.`;
        else if (blocked) msg = `${defender.name} bloqueou parcialmente o ataque com o escudo! (${mitigatedDamage} de dano)`;
        else msg = `${attacker.name} atacou e causou ${mitigatedDamage} de dano.`;

        return { hit: true, crit: isCrit, blocked, damage: mitigatedDamage, message: msg };
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

    // Processa a ação do Jogador (Atacar, Defender, Habilidade ou Item)
    executePlayerTurn(actionCode, param = null) {
        if (!this.isBattleActive || !this.isPlayerTurn) return;

        this.isPlayerTurn = false;
        this.playerState.isDefending = false; // Reseta a defesa do turno anterior
        window.UI.toggleBattleButtons(false); // Bloqueia a UI

        const playerX = window.GFX.getEntityX(true, window.innerWidth);
        const playerY = window.innerHeight / 2;
        const enemyX = window.GFX.getEntityX(false, window.innerWidth);
        const enemyY = window.innerHeight / 2;

        let resultMsg = "";

        if (actionCode === 'ATK') {
            const atkResult = this.executeAttack(this.player, this.enemy, this.playerState, this.enemyState);
            resultMsg = atkResult.message;
        }
        else if (actionCode === 'DEF') {
            this.playerState.isDefending = true;
            resultMsg = `${this.player.name} assumiu uma postura defensiva!`;
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

            if (this.player.currentMp >= skill.mpCost) {
                this.player.currentMp -= skill.mpCost;

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

        const status = this.checkWinCondition();
        if (status !== 'ONGOING') {
            this.endBattle(status);
            return;
        }

        // Passa a vez para o inimigo após 1.2 segundos (Feedback visual)
        setTimeout(() => this.executeEnemyTurn(), 1200);
    }

    // Processa a Inteligência Artificial do Inimigo
    executeEnemyTurn() {
        if (!this.isBattleActive) return;

        this.enemyState.isDefending = false;

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

        let resultMsg = "";

        // --- IA Baseada em Personalidade ---
        let action = 'ATK';
        const hpPercent = this.enemy.currentHp / this.enemy.derivedStats.maxHp;

        if (this.enemy.personality === 'Defensivo' && hpPercent < 0.5 && Utils.chance(60)) {
            action = 'DEF';
        } else if (this.enemy.personality === 'Covarde' && hpPercent < 0.3 && Utils.chance(80)) {
            action = 'DEF'; // No futuro, pode tentar fugir
        } else if (this.enemy.personality === 'Agressivo') {
            action = 'ATK'; // 100% chance de ataque
        }

        // Execução da Ação da IA
        if (action === 'ATK') {
            const atkResult = this.executeAttack(this.enemy, this.player, this.enemyState, this.playerState);
            resultMsg = atkResult.message;
        } else {
            this.enemyState.isDefending = true;
            resultMsg = `${this.enemy.name} está recuando e se defendendo!`;
        }

        window.UI.appendBattleLog(`<span style="color:#ff4444">${resultMsg}</span>`);
        window.UI.updateBattleBars();

        const status = this.checkWinCondition();
        if (status !== 'ONGOING') {
            this.endBattle(status);
            return;
        }

        // Retorna o turno ao jogador
        this.turnCount++;
        this.isPlayerTurn = true;

        setTimeout(() => {
            if (this.isBattleActive) window.UI.toggleBattleButtons(true);
        }, 500);
    }

    // Gerencia o fim do combate, distribuição de recompensas e conquistas
    endBattle(result) {
        this.isBattleActive = false;

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
