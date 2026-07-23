/**
 * Sistemas de Entidade, Atributos e Jogador.
 * Cálculos matemáticos reais, sem hardcoding.
 */

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

        this.derivedStats.maxHp = 50 + (str * 10) + (this.level * 5);
        this.derivedStats.maxMp = 20 + (int * 8) + (this.level * 3);

        // Se HP atual for 0 (novo char) ou maior que o max, ajusta.
        if (this.currentHp === 0 || this.currentHp > this.derivedStats.maxHp) {
            this.currentHp = this.derivedStats.maxHp;
        }
        if (this.currentMp === 0 || this.currentMp > this.derivedStats.maxMp) {
            this.currentMp = this.derivedStats.maxMp;
        }

        // Fórmulas de combate
        this.derivedStats.physicalDamage = Math.floor(str * 1.5);
        this.derivedStats.dodgeChance = Utils.clamp((agi * 0.5) + (luk * 0.1), 0, 45); // Max 45% esquiva natural
        this.derivedStats.critChance = Utils.clamp((agi * 0.2) + (luk * 0.5), 1, 50);
        this.derivedStats.defenseRating = def * 2;

        // Soma dano das armas e defesa das armaduras
        for (let key in this.equipment) {
            let item = this.equipment[key];
            if (item) {
                if (item.damage) this.derivedStats.physicalDamage += item.damage;
                if (item.defense) this.derivedStats.defenseRating += item.defense;
            }
        }
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

        this.visuals = {
            gender: 'Masculino',
            skinTone: '#ffcc99',
            hairStyle: 1
        };
    }

    gainExp(amount) {
        this.exp += amount;
        const expToNext = this.getExpRequired();
        if (this.exp >= expToNext) {
            this.levelUp();
        }
    }

    getExpRequired() {
        return Math.floor(100 * Math.pow(1.5, this.level - 1));
    }

    levelUp() {
        this.level++;
        this.exp = 0; // Vamos manter 0 para RPG clássico
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
}
