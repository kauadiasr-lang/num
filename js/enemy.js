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

        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
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
