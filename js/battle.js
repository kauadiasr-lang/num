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

        // Modificadores de estado temporários (ex: Defesa ativada)
        this.playerState = { isDefending: false };
        this.enemyState = { isDefending: false };
    }

    // Calcula dano, acerto e crítico de um ataque físico básico, e dispara VFX/SFX
    executeAttack(attacker, defender, attackerState, defenderState) {
        const isPlayer = attacker === this.player;
        const defX = window.GFX.getEntityX(!isPlayer, window.innerWidth);
        const defY = window.innerHeight / 2;

        // 1. Cálculo de Acerto (Precisão vs Esquiva)
        let hitChance = 90 + (attacker.getTotalStat('acc') * 2) - defender.derivedStats.dodgeChance;
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

        // 4. Mitigação por Defesa
        let defenseRating = defender.derivedStats.defenseRating;
        if (defenderState.isDefending) {
            defenseRating *= 2; // Dobra a defesa se usou a ação "Defender" no turno
        }

        // Fórmula AAA: Armor Damage Reduction = Def / (Def + 50)
        let reductionPercent = defenseRating / (defenseRating + 50);
        let mitigatedDamage = Math.floor(damage * (1 - reductionPercent));

        // Variação de dano (RNG 10%)
        mitigatedDamage = Math.floor(mitigatedDamage * Utils.randomFloat(0.9, 1.1));
        if (mitigatedDamage < 1) mitigatedDamage = 1; // Mínimo 1 de dano

        defender.currentHp -= mitigatedDamage;
        if (defender.currentHp < 0) defender.currentHp = 0;

        // --- Camada Visual/Sonora ---
        if (window.GFX) {
            const textColor = isCrit ? '#ffcc00' : '#ffffff';
            window.GFX.spawnText(defX, defY - 50, `-${mitigatedDamage}`, textColor, isCrit);
            const particleColor = defenderState.isDefending ? '#cccccc' : '#cc0000';
            window.GFX.spawnParticles(defX, defY, particleColor, isCrit ? 30 : 15, isCrit ? 8 : 4);
        }
        if (window.Engine) window.Engine.triggerShake(isCrit ? 15 : 3, isCrit ? 0.3 : 0.1);
        if (window.AudioManager) isCrit ? window.AudioManager.playCrit() : window.AudioManager.playSwordClash();

        let msg = isCrit ? `ACERTO CRÍTICO! ${attacker.name} causou ${mitigatedDamage} de dano.` : `${attacker.name} atacou e causou ${mitigatedDamage} de dano.`;

        return { hit: true, crit: isCrit, damage: mitigatedDamage, message: msg };
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

    // Processa a ação do Jogador (Atacar, Defender ou usar Habilidade)
    executePlayerTurn(actionCode, skillId = null) {
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
        else if (actionCode === 'SKILL' && skillId) {
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

    // Gerencia o fim do combate e a distribuição de recompensas
    endBattle(result) {
        this.isBattleActive = false;

        if (result === 'VICTORY') {
            window.UI.appendBattleLog(`<span style="color:var(--color-gold); font-size:1.2rem;">Vitória! O inimigo caiu!</span>`);

            const expGained = this.enemy.expValue;
            const goldGained = this.enemy.goldValue;
            const levelBefore = this.player.level;

            this.player.gold += goldGained;
            this.player.gainExp(expGained);

            const leveledUp = this.player.level > levelBefore;
            const loot = this.enemy.generateLoot(this.player.getTotalStat('luk'));

            // Cura passiva após a batalha (20% do HP max)
            this.player.currentHp = Utils.clamp(this.player.currentHp + Math.floor(this.player.derivedStats.maxHp * 0.2), 0, this.player.derivedStats.maxHp);

            setTimeout(() => window.UI.showBattleResults(true, expGained, goldGained, leveledUp, loot), 2000);

        } else if (result === 'DEFEAT') {
            window.UI.appendBattleLog(`<span style="color:#8b0000; font-size:1.2rem;">Você foi derrotado...</span>`);

            // Penalidade por morte: Revive no hub com 10% de HP
            this.player.currentHp = Math.floor(this.player.derivedStats.maxHp * 0.1);

            setTimeout(() => window.UI.showBattleResults(false, 0, 0, false, null), 2000);
        }

        window.SaveManager.save(window.Engine.state);
    }
}
