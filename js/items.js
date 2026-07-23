/**
 * Arquitetura de Itens, Equipamentos e Sistema de Raridade
 */

const RARITY = {
    COMMON: { id: 1, name: "Comum", mult: 1.0, color: "#ffffff" },
    UNCOMMON: { id: 2, name: "Incomum", mult: 1.2, color: "#1eff00" },
    RARE: { id: 3, name: "Raro", mult: 1.5, color: "#0070dd" },
    EPIC: { id: 4, name: "Épico", mult: 2.0, color: "#a335ee" },
    LEGENDARY: { id: 5, name: "Lendário", mult: 3.0, color: "#ff8000" }
};

const SLOTS = {
    HEAD: 'head', CHEST: 'chest', HANDS: 'hands', LEGS: 'legs', FEET: 'feet',
    MAIN_HAND: 'mainHand', OFF_HAND: 'offHand', AMULET: 'amulet', RING: 'ring'
};

class Equipment {
    constructor(baseTemplate, rarityObj) {
        this.uuid = Utils.generateUUID();
        this.id = baseTemplate.id;
        this.name = `${baseTemplate.name}`;
        this.slot = baseTemplate.slot;
        this.rarity = rarityObj;

        // Atributos base multiplicados pela raridade (arredondados)
        this.damage = Math.floor((baseTemplate.damage || 0) * rarityObj.mult);
        this.defense = Math.floor((baseTemplate.defense || 0) * rarityObj.mult);
        this.weight = baseTemplate.weight;
        this.value = Math.floor(baseTemplate.value * (rarityObj.mult * 2));
        this.durability = baseTemplate.durability;
        this.maxDurability = baseTemplate.durability;

        // Bônus em atributos (Força, Agilidade, etc)
        this.statBonuses = {};
        if (baseTemplate.stats) {
            for (let stat in baseTemplate.stats) {
                this.statBonuses[stat] = Math.floor(baseTemplate.stats[stat] * rarityObj.mult);
            }
        }

        // Ajuste de nome para itens raros
        if (rarityObj.id > 1) {
            this.name = `${this.name} ${rarityObj.name}`;
        }
    }
}

// Banco de Dados de Templates (Escalável)
const ItemDatabase = {
    weapons: {
        shortsword: { id: 'w_01', name: "Espada Curta", slot: SLOTS.MAIN_HAND, damage: 8, weight: 2.5, value: 50, durability: 100, stats: { str: 1, agi: 1 } },
        rustyaxe: { id: 'w_02', name: "Machado Enferrujado", slot: SLOTS.MAIN_HAND, damage: 10, weight: 4.0, value: 30, durability: 60, stats: { str: 3 } }
    },
    armors: {
        leatherchest: { id: 'a_01', name: "Armadura de Couro", slot: SLOTS.CHEST, defense: 5, weight: 3.0, value: 60, durability: 120, stats: { agi: 2 } }
    }
};

window.ItemFactory = {
    createEquipment(templateId, category, rarityObj = RARITY.COMMON) {
        const template = ItemDatabase[category][templateId];
        if (!template) {
            console.error(`[ItemFactory] Template ${templateId} não encontrado.`);
            return null;
        }
        return new Equipment(template, rarityObj);
    },

    // Gera o estoque procedural do Ferreiro/Mercado, escalando com o nível do jogador
    generateShopInventory(playerLevel) {
        const shopInventory = [];
        const weaponsKeys = Object.keys(ItemDatabase.weapons);
        const armorKeys = Object.keys(ItemDatabase.armors);

        // Gera 6 itens aleatórios
        for (let i = 0; i < 6; i++) {
            const isWeapon = Utils.chance(50);
            const pool = isWeapon ? weaponsKeys : armorKeys;
            const category = isWeapon ? 'weapons' : 'armors';
            const randomId = pool[Utils.randomInt(0, pool.length - 1)];

            // Probabilidade de raridade baseada no nível do jogador
            let rarity = RARITY.COMMON;
            if (Utils.chance(10 + playerLevel)) rarity = RARITY.UNCOMMON;
            if (Utils.chance(2 + playerLevel * 0.5)) rarity = RARITY.RARE;

            const item = this.createEquipment(randomId, category, rarity);
            shopInventory.push(item);
        }
        return shopInventory;
    }
};
