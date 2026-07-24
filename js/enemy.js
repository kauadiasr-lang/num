/**
 * Sistema de IA e Inimigos Procedurais
 */

const ENEMY_PERSONALITIES = {
    AGGRESSIVE: 'Agressivo', // Prioriza ataque pesado
    DEFENSIVE: 'Defensivo',  // Prioriza defesa/cura
    BALANCED: 'Equilibrado', // Usa probabilidade padrão
    COWARD: 'Covarde'        // Alta chance de fuga se HP < 30%
};

const ENEMY_NAMES = ["Saqueador", "Gladiador Renegado", "Mercenário", "Assassino", "Bárbaro"];
const ENEMY_ADJECTIVES = ["Brutal", "Cicatrizado", "Implacável", "Veloz", "Sanguinário"];

class Enemy extends Entity {
    constructor(playerLevel) {
        const name = `${ENEMY_NAMES[Utils.randomInt(0, ENEMY_NAMES.length - 1)]} ${ENEMY_ADJECTIVES[Utils.randomInt(0, ENEMY_ADJECTIVES.length - 1)]}`;
        super(name);

        this.level = playerLevel + Utils.randomInt(-1, 1);
        if (this.level < 1) this.level = 1;

        // Distribui pontos de atributo com base no nível gerado
        this.generateStats();

        // Define personalidade aleatória
        const pKeys = Object.keys(ENEMY_PERSONALITIES);
        this.personality = ENEMY_PERSONALITIES[pKeys[Utils.randomInt(0, pKeys.length - 1)]];

        // Recompensa ao ser derrotado
        this.expValue = Math.floor(20 * Math.pow(1.2, this.level));
        this.goldValue = Math.floor(Utils.randomInt(10, 30) * (this.level * 0.5 + 1));
    }

    generateStats() {
        const totalPoints = 35 + (this.level * 5); // Base + escalonamento

        // Distribuição procedural básica
        for (let i = 0; i < totalPoints; i++) {
            const statsArray = Object.keys(this.baseStats);
            const randomStat = statsArray[Utils.randomInt(0, statsArray.length - 1)];
            this.baseStats[randomStat]++;
        }

        // Sorteia uma arma (com seu perfil de alcance/velocidade) para que a IA
        // de posicionamento tenha variedade real também no Duelo Rápido, e não
        // só na Ladder de Rivais.
        this.equipRandomWeapon();

        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
    }

    equipRandomWeapon() {
        const weaponKeys = Object.keys(ItemDatabase.weapons);
        const weaponId = weaponKeys[Utils.randomInt(0, weaponKeys.length - 1)];
        let rarity = RARITY.COMMON;
        if (Utils.chance(15 + this.level)) rarity = RARITY.UNCOMMON;
        this.equipment[SLOTS.MAIN_HAND] = ItemFactory.createEquipment(weaponId, 'weapons', rarity);
    }

    // Chance de dropar um item ao ser derrotado, influenciada pela Sorte do jogador
    generateLoot(playerLuk) {
        const dropChance = 30 + (playerLuk * 2);

        if (Utils.chance(dropChance)) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 2);
            return dropTable[0];
        }
        return null;
    }
}

/**
 * Ladder de Rivais: adversários nomeados e fixos, organizados em ligas
 * progressivas. Diferente do Duelo Rápido (Enemy, acima, totalmente
 * aleatório), cada Rival tem uma distribuição de atributos e equipamento
 * curados de propósito, então enfrentá-lo sempre parece "aquele adversário
 * específico" em vez de um número genérico.
 */
class Rival extends Entity {
    constructor(def) {
        super(def.name);
        this.rivalId = def.id;
        this.level = def.level;
        this.personality = def.personality;
        this.isChampion = !!def.isChampion;
        this.league = def.league;
        this.title = def.title;

        this.distributeStats(def.focus);
        this.equipGear(def.gearRarity);

        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;

        this.expValue = Math.floor(30 * Math.pow(1.25, this.level) * (this.isChampion ? 2 : 1));
        this.goldValue = Math.floor(Utils.randomInt(15, 35) * (this.level * 0.6 + 1) * (this.isChampion ? 1.8 : 1));
    }

    // Distribui pontos de atributo conforme os pesos de foco do rival
    // (ex: um "brutamontes" pesa mais em força/defesa que em agilidade)
    distributeStats(focus) {
        const totalPoints = 30 + this.level * 6;
        let assigned = 0;
        const keys = Object.keys(focus);
        keys.forEach((stat, idx) => {
            if (idx === keys.length - 1) {
                this.baseStats[stat] += (totalPoints - assigned);
            } else {
                const amount = Math.round(totalPoints * focus[stat]);
                this.baseStats[stat] += amount;
                assigned += amount;
            }
        });
    }

    // Equipa arma e armadura correspondentes à raridade da liga do rival
    equipGear(rarity) {
        const weaponKeys = Object.keys(ItemDatabase.weapons);
        const armorKeys = Object.keys(ItemDatabase.armors);
        const weaponId = weaponKeys[Utils.randomInt(0, weaponKeys.length - 1)];
        const armorId = armorKeys[Utils.randomInt(0, armorKeys.length - 1)];
        this.equipment[SLOTS.MAIN_HAND] = ItemFactory.createEquipment(weaponId, 'weapons', rarity);
        this.equipment[SLOTS.CHEST] = ItemFactory.createEquipment(armorId, 'armors', rarity);

        if (this.isChampion) {
            const shieldKeys = Object.keys(ItemDatabase.shields);
            const shieldId = shieldKeys[Utils.randomInt(0, shieldKeys.length - 1)];
            this.equipment[SLOTS.OFF_HAND] = ItemFactory.createEquipment(shieldId, 'shields', rarity);
        }
    }

    // Campeões sempre deixam loot de alta raridade; rivais comuns têm chance normal
    generateLoot(playerLuk) {
        const dropChance = this.isChampion ? 100 : 40 + playerLuk;
        if (!Utils.chance(dropChance)) return null;

        const minRarityId = this.isChampion ? RARITY.EPIC.id : RARITY.UNCOMMON.id;
        const pool = window.ItemFactory.generateShopInventory(this.level + 2);
        const goodItems = pool.filter(i => i.rarity.id >= minRarityId);
        return goodItems.length > 0 ? goodItems[0] : pool[0];
    }
}

// Banco de Rivais: 3 ligas progressivas, cada uma com 3 desafiantes + 1 campeão
const RivalDatabase = {
    leagues: [
        {
            id: 'bronze', name: 'Liga de Bronze',
            rivals: [
                { id: 'gorlak', name: 'Gorlak, o Novato', title: 'Novato', level: 2, focus: { str: 0.5, def: 0.3, agi: 0.2 }, personality: 'Agressivo', gearRarity: RARITY.COMMON },
                { id: 'vesna', name: 'Vesna, a Ágil', title: 'Ágil', level: 3, focus: { agi: 0.5, acc: 0.3, luk: 0.2 }, personality: 'Equilibrado', gearRarity: RARITY.COMMON },
                { id: 'thom', name: 'Thom Punho-de-Ferro', title: 'Punho-de-Ferro', level: 4, focus: { str: 0.6, def: 0.4 }, personality: 'Agressivo', gearRarity: RARITY.UNCOMMON },
                { id: 'bronze_champion', name: 'Karg, Campeão de Bronze', title: 'Campeão de Bronze', level: 5, focus: { str: 0.3, def: 0.3, agi: 0.2, acc: 0.2 }, personality: 'Defensivo', gearRarity: RARITY.UNCOMMON, isChampion: true }
            ]
        },
        {
            id: 'silver', name: 'Liga de Prata',
            rivals: [
                { id: 'ysolda', name: 'Ysolda, Lâmina Veloz', title: 'Lâmina Veloz', level: 6, focus: { agi: 0.4, luk: 0.3, acc: 0.3 }, personality: 'Equilibrado', gearRarity: RARITY.UNCOMMON },
                { id: 'bruntok', name: 'Bruntok, o Touro', title: 'o Touro', level: 7, focus: { str: 0.5, def: 0.35, cha: 0.15 }, personality: 'Agressivo', gearRarity: RARITY.UNCOMMON },
                { id: 'nyx', name: 'Nyx, a Sombria', title: 'a Sombria', level: 8, focus: { int: 0.35, acc: 0.35, luk: 0.3 }, personality: 'Covarde', gearRarity: RARITY.RARE },
                { id: 'silver_champion', name: 'Draven, Campeão de Prata', title: 'Campeão de Prata', level: 10, focus: { str: 0.3, def: 0.3, agi: 0.2, acc: 0.2 }, personality: 'Defensivo', gearRarity: RARITY.RARE, isChampion: true }
            ]
        },
        {
            id: 'gold', name: 'Liga de Ouro',
            rivals: [
                { id: 'freya', name: 'Freya Tempestade', title: 'Tempestade', level: 11, focus: { agi: 0.45, acc: 0.35, luk: 0.2 }, personality: 'Equilibrado', gearRarity: RARITY.RARE },
                { id: 'moloch', name: 'Moloch, o Destruidor', title: 'o Destruidor', level: 12, focus: { str: 0.65, def: 0.35 }, personality: 'Agressivo', gearRarity: RARITY.EPIC },
                { id: 'sable', name: 'Sable, a Serpente', title: 'a Serpente', level: 13, focus: { luk: 0.4, agi: 0.35, acc: 0.25 }, personality: 'Covarde', gearRarity: RARITY.EPIC },
                { id: 'gold_champion', name: 'Aurelion, o Imortal', title: 'o Imortal', level: 15, focus: { str: 0.28, def: 0.28, agi: 0.22, acc: 0.22 }, personality: 'Defensivo', gearRarity: RARITY.LEGENDARY, isChampion: true }
            ]
        }
    ]
};

// Marca cada rival com o id da própria liga (facilita checagens de progressão)
RivalDatabase.leagues.forEach(league => {
    league.rivals.forEach(rival => { rival.league = league.id; });
});

window.RivalDatabase = RivalDatabase;
