/**
 * Sistemas de Entidade, Atributos e Jogador.
 * Cálculos matemáticos reais, sem hardcoding.
 */

// Perfil de alcance/velocidade de combatentes desarmados (punhos)
const UNARMED_RANGE = { min: 0, max: 1 };
const UNARMED_SPEED = { atkSpeed: 1, approachSpeed: 2, retreatSpeed: 2 };

class Entity {
    constructor(name) {
        this.name = name;
        this.level = 1;
        this.baseStats = {
            str: 5, // Força: Aumenta dano físico e capacidade de peso
            agi: 5, // Agilidade: Esquiva, chance crítica e velocidade de turno
            int: 5, // Inteligência: Dano mágico, Mana máxima e resistência mágica
            def: 5, // Defesa: Mitigação de dano base
            acc: 5, // Precisão: Chance de acerto ignorando esquiva inimiga
            luk: 5, // Sorte: Loot rate, acertos críticos extremos
            cha: 5  // Carisma: Preços na loja, interação em eventos
        };

        this.equipment = {
            [SLOTS.HEAD]: null, [SLOTS.CHEST]: null, [SLOTS.HANDS]: null,
            [SLOTS.LEGS]: null, [SLOTS.FEET]: null, [SLOTS.MAIN_HAND]: null,
            [SLOTS.OFF_HAND]: null, [SLOTS.AMULET]: null, [SLOTS.RING]: null
        };

        this.derivedStats = {};
        this.currentHp = 0;
        this.currentMp = 0;
    }

    // Calcula os atributos reais (Base + Equipamentos)
    getTotalStat(statName) {
        let total = this.baseStats[statName];
        for (let key in this.equipment) {
            let item = this.equipment[key];
            if (item && item.statBonuses && item.statBonuses[statName]) {
                total += item.statBonuses[statName];
            }
        }
        return total;
    }

    // Calcula Sub-atributos baseados nos atributos principais
    calculateDerivedStats() {
        const str = this.getTotalStat('str');
        const agi = this.getTotalStat('agi');
        const int = this.getTotalStat('int');
        const def = this.getTotalStat('def');
        const luk = this.getTotalStat('luk');

        let maxHp = 50 + (str * 10) + (this.level * 5);
        let maxMp = 20 + (int * 8) + (this.level * 3);

        // Fórmulas de combate
        let physicalDamage = Math.floor(str * 1.5);
        let dodgeChance = Utils.clamp((agi * 0.5) + (luk * 0.1), 0, 45); // Max 45% esquiva natural
        let critChance = Utils.clamp((agi * 0.2) + (luk * 0.5), 1, 50);
        let defenseRating = def * 2;
        let blockChance = 0;

        // Soma bônus diretos de equipamentos: dano/defesa das peças, HP/MP de
        // amuletos, crítico/precisão de armas e chance de bloqueio de escudos
        for (let key in this.equipment) {
            let item = this.equipment[key];
            if (item) {
                if (item.damage) physicalDamage += item.damage;
                if (item.defense) defenseRating += item.defense;
                if (item.hpBonus) maxHp += item.hpBonus;
                if (item.mpBonus) maxMp += item.mpBonus;
                if (item.critBonus) critChance += item.critBonus;
                if (item.blockChance) blockChance += item.blockChance;
            }
        }

        // Fadiga (acúmulo de ferimentos por derrotas): penaliza levemente
        // dano e reflexos até ser curada no Curandeiro ou com bandagem
        const fatigueStacks = this.fatigue || 0;
        const fatigueMult = 1 - (fatigueStacks * 0.08);
        physicalDamage = Math.floor(physicalDamage * fatigueMult);
        dodgeChance = dodgeChance * fatigueMult;

        this.derivedStats.maxHp = maxHp;
        this.derivedStats.maxMp = maxMp;
        this.derivedStats.physicalDamage = physicalDamage;
        this.derivedStats.dodgeChance = Utils.clamp(dodgeChance, 0, 45);
        this.derivedStats.critChance = Utils.clamp(critChance, 1, 65);
        this.derivedStats.defenseRating = defenseRating;
        this.derivedStats.blockChance = Utils.clamp(blockChance, 0, 60);

        // Se HP/MP atual for 0 (nova entidade) ou maior que o novo máximo, ajusta.
        if (this.currentHp === 0 || this.currentHp > this.derivedStats.maxHp) {
            this.currentHp = this.derivedStats.maxHp;
        }
        if (this.currentMp === 0 || this.currentMp > this.derivedStats.maxMp) {
            this.currentMp = this.derivedStats.maxMp;
        }
    }

    // Bônus de precisão vinda da arma equipada (usado no cálculo de acerto em batalha)
    getWeaponAccBonus() {
        const weapon = this.equipment[SLOTS.MAIN_HAND];
        return weapon && weapon.accBonus ? weapon.accBonus : 0;
    }

    // Fração de armadura ignorada pela arma equipada (perfuração)
    getWeaponArmorPierce() {
        const weapon = this.equipment[SLOTS.MAIN_HAND];
        return weapon && weapon.armorPierce ? weapon.armorPierce : 0;
    }

    // Alcance mínimo/máximo da arma equipada (punhos nus se não houver arma).
    // Funciona automaticamente para qualquer arma futura, desde que ela
    // carregue minRange/maxRange (ver items.js).
    getWeaponRange() {
        const weapon = this.equipment[SLOTS.MAIN_HAND];
        if (weapon && weapon.minRange !== undefined) {
            return { min: weapon.minRange, max: weapon.maxRange };
        }
        return UNARMED_RANGE;
    }

    // Velocidades de ataque/aproximação/recuo da arma equipada
    getWeaponSpeed() {
        const weapon = this.equipment[SLOTS.MAIN_HAND];
        if (weapon && weapon.atkSpeed !== undefined) {
            return { atkSpeed: weapon.atkSpeed, approachSpeed: weapon.approachSpeed, retreatSpeed: weapon.retreatSpeed };
        }
        return UNARMED_SPEED;
    }
}

class Player extends Entity {
    constructor(name) {
        super(name);
        this.exp = 0;
        this.gold = 100;
        this.inventory = [];
        this.inventoryCapacity = 20; // Expansível com mochilas/força no futuro

        this.statPoints = 0;   // Pontos de atributo por nível (distribuição manual)
        this.skillPoints = 0;  // Pontos de talento por nível
        this.learnedSkills = []; // IDs das habilidades aprendidas
        this.skillCooldowns = {}; // ID da habilidade -> turnos restantes de recarga

        this.fatigue = 0; // 0-3 estágios de fadiga acumulados por derrotas
        this.wins = 0;
        this.losses = 0;
        this.rivalsDefeated = []; // IDs dos rivais da ladder já derrotados
        this.achievements = []; // IDs das conquistas desbloqueadas

        this.visuals = {
            gender: 'Masculino',
            skinTone: '#ffcc99',
            hairStyle: 1,
            hairColor: '#2a1c10',
            beardStyle: 0,     // 0 = nenhuma, 1 = bigode, 2 = cavanhaque, 3 = barba cheia
            beardColor: '#2a1c10',
            eyebrowColor: '#2a1c10',
            eyeColor: '#1a1a1a',
            faceShape: 1       // 1 = redondo, 2 = oval, 3 = anguloso
        };
    }

    addFatigue(amount) {
        this.fatigue = Utils.clamp((this.fatigue || 0) + amount, 0, 3);
        this.calculateDerivedStats();
    }

    cureFatigue(amount) {
        this.fatigue = Utils.clamp((this.fatigue || 0) - amount, 0, 3);
        this.calculateDerivedStats();
    }

    unlockAchievement(id) {
        if (!this.achievements.includes(id)) {
            this.achievements.push(id);
            return true;
        }
        return false;
    }

    // Aplica o efeito de um consumível e o remove do inventário
    useConsumable(index) {
        const item = this.inventory[index];
        if (!item || item.category !== 'consumable') return null;

        let message = '';
        if (item.type === 'HEAL_HP') {
            const before = this.currentHp;
            this.currentHp = Utils.clamp(this.currentHp + item.power, 0, this.derivedStats.maxHp);
            message = `Recuperou ${this.currentHp - before} HP`;
        } else if (item.type === 'HEAL_MP') {
            const before = this.currentMp;
            this.currentMp = Utils.clamp(this.currentMp + item.power, 0, this.derivedStats.maxMp);
            message = `Recuperou ${this.currentMp - before} MP`;
        } else if (item.type === 'CURE_FATIGUE') {
            this.cureFatigue(item.power);
            message = `Curou ${item.power} nível(is) de fadiga`;
        }

        this.inventory.splice(index, 1);
        return { name: item.name, message };
    }

    gainExp(amount) {
        this.exp += amount;
        // Repete enquanto o excedente ainda cobrir o próximo nível, preservando o
        // resto (em vez de descartá-lo) e permitindo múltiplos níveis de uma vez
        // quando a recompensa de uma única batalha for grande o suficiente.
        while (this.exp >= this.getExpRequired()) {
            this.exp -= this.getExpRequired();
            this.levelUp();
        }
    }

    getExpRequired() {
        return Math.floor(100 * Math.pow(1.5, this.level - 1));
    }

    levelUp() {
        this.level++;
        this.statPoints += 3;  // Ganha 3 pontos para distribuir por nível
        this.skillPoints += 1; // 1 Ponto de Talento por nível
        this.calculateDerivedStats();
        console.log(`Level Up! Nível atual: ${this.level}. +3 Stats, +1 Skill Point`);
    }

    learnSkill(skillId) {
        if (!this.learnedSkills.includes(skillId)) {
            this.learnedSkills.push(skillId);
            return true;
        }
        return false;
    }

    // Coloca uma habilidade em recarga por N turnos (do próprio jogador)
    setSkillCooldown(skillId, turns) {
        if (!this.skillCooldowns) this.skillCooldowns = {};
        this.skillCooldowns[skillId] = turns;
    }

    isSkillReady(skillId) {
        return !this.skillCooldowns || !this.skillCooldowns[skillId] || this.skillCooldowns[skillId] <= 0;
    }

    // Avança as recargas de todas as habilidades em 1 turno (chamado a cada
    // turno do jogador em battle.js)
    tickCooldowns() {
        if (!this.skillCooldowns) return;
        for (let id in this.skillCooldowns) {
            if (this.skillCooldowns[id] > 0) this.skillCooldowns[id]--;
        }
    }

    // Avalia as conquistas com base no estado atual + contexto do evento que acabou
    // de acontecer (fim de batalha, loot recebido, etc), retornando as recém-desbloqueadas.
    checkAchievements(context = {}) {
        const unlocked = [];
        const tryUnlock = (id) => { if (this.unlockAchievement(id)) unlocked.push(AchievementDB[id]); };

        if (context.victory && this.wins >= 1) tryUnlock('first_blood');
        if (this.wins >= 10) tryUnlock('unbreakable');
        if (this.level >= 5) tryUnlock('veteran');
        if (this.level >= 10) tryUnlock('legend');
        if (context.victory && context.hpPercent !== undefined && context.hpPercent > 0 && context.hpPercent <= 0.1) tryUnlock('survivor');
        if (context.gotLegendary) tryUnlock('legendary_finder');
        if (context.defeatedRivalId === 'bronze_champion') tryUnlock('champion_bronze');
        if (context.defeatedRivalId === 'silver_champion') tryUnlock('champion_silver');
        if (context.defeatedRivalId === 'gold_champion') tryUnlock('champion_gold');

        return unlocked;
    }
}

// Banco de Conquistas (título + descrição exibidos na tela de Conquistas)
const AchievementDB = {
    first_blood: { id: 'first_blood', name: 'Primeiro Sangue', description: 'Vença sua primeira batalha.' },
    veteran: { id: 'veteran', name: 'Veterano', description: 'Alcance o nível 5.' },
    legend: { id: 'legend', name: 'Lenda Viva', description: 'Alcance o nível 10.' },
    unbreakable: { id: 'unbreakable', name: 'Inquebrável', description: 'Vença 10 batalhas.' },
    survivor: { id: 'survivor', name: 'Sobrevivente', description: 'Vença uma batalha com 10% de HP ou menos.' },
    legendary_finder: { id: 'legendary_finder', name: 'Caçador de Lendas', description: 'Obtenha um item Lendário.' },
    champion_bronze: { id: 'champion_bronze', name: 'Campeão de Bronze', description: 'Derrote o Campeão da Liga de Bronze.' },
    champion_silver: { id: 'champion_silver', name: 'Campeão de Prata', description: 'Derrote o Campeão da Liga de Prata.' },
    champion_gold: { id: 'champion_gold', name: 'Campeão de Ouro', description: 'Derrote o Campeão da Liga de Ouro.' }
};

window.AchievementDB = AchievementDB;
