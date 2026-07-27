/**
 * Arquitetura de Itens, Equipamentos, Consumíveis e Sistema de Raridade
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
    MAIN_HAND: 'mainHand', OFF_HAND: 'offHand', AMULET: 'amulet', RING: 'ring',
    // Arma de longo alcance (arco/besta) — slot separado da mainHand, pra dar
    // pra equipar uma arma corpo a corpo E uma de longo alcance ao mesmo
    // tempo (a de longo alcance como "suporte", ver Entity.activeWeaponSlot).
    RANGED: 'ranged'
};

class Equipment {
    constructor(baseTemplate, rarityObj) {
        this.category = 'equipment';
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

        // Bônus diretos de combate (não escalam com raridade de forma linear
        // demais para não quebrar o balanceamento em itens lendários)
        this.critBonus = baseTemplate.critBonus ? +(baseTemplate.critBonus * rarityObj.mult).toFixed(1) : 0;
        this.accBonus = baseTemplate.accBonus ? +(baseTemplate.accBonus * rarityObj.mult).toFixed(1) : 0;
        this.blockChance = baseTemplate.blockChance ? +(baseTemplate.blockChance * rarityObj.mult).toFixed(1) : 0;
        this.armorPierce = baseTemplate.armorPierce || 0; // fixo por arquétipo de arma, não escala com raridade
        this.hpBonus = baseTemplate.hpBonus ? Math.floor(baseTemplate.hpBonus * rarityObj.mult) : 0;
        this.mpBonus = baseTemplate.mpBonus ? Math.floor(baseTemplate.mpBonus * rarityObj.mult) : 0;

        // Alcance e velocidade (relevante para armas equipadas em mainHand; fixo
        // por arquétipo, não escala com raridade — um punhal lendário não fica
        // mais longo, só mais afiado)
        this.minRange = baseTemplate.minRange !== undefined ? baseTemplate.minRange : 0;
        this.maxRange = baseTemplate.maxRange !== undefined ? baseTemplate.maxRange : 1;
        this.atkSpeed = baseTemplate.atkSpeed || 1;
        this.approachSpeed = baseTemplate.approachSpeed || 2;
        this.retreatSpeed = baseTemplate.retreatSpeed || 2;

        // Munição (só armas do slot RANGED) — limita quantos disparos dá pra
        // dar por luta; null em armas sem maxAmmo (corpo a corpo) significa
        // "sem limite de disparos", não precisa checar em lugar nenhum.
        this.maxAmmo = baseTemplate.maxAmmo || null;
        this.ammo = this.maxAmmo;

        // Encantamento aplicado (ver enchantments.js) — null = nenhum. Sistema
        // totalmente independente da Linhagem: nunca altera o corpo do
        // gladiador, só a peça, e pode ser trocado livremente a qualquer momento.
        this.enchantmentId = null;

        // Ajuste de nome para itens raros
        if (rarityObj.id > 1) {
            this.name = `${this.name} ${rarityObj.name}`;
        }
    }
}

// Itens consumíveis: sem slot de equipamento, efeito imediato ao usar
class Consumable {
    constructor(baseTemplate) {
        this.category = 'consumable';
        this.uuid = Utils.generateUUID();
        this.id = baseTemplate.id;
        this.name = baseTemplate.name;
        this.type = baseTemplate.type; // HEAL_HP | HEAL_MP | CURE_FATIGUE
        this.power = baseTemplate.power;
        this.value = baseTemplate.value;
        this.description = baseTemplate.description;
        this.rarity = RARITY.COMMON; // usado apenas para exibir uma cor neutra na UI/tooltip
    }
}

// Banco de Dados de Templates (Escalável)
const ItemDatabase = {
    weapons: {
        shortsword: { id: 'w_01', name: "Espada Curta", slot: SLOTS.MAIN_HAND, damage: 8, weight: 2.5, value: 50, durability: 100, stats: { str: 1, agi: 1 },
            minRange: 0, maxRange: 2, atkSpeed: 1.0, approachSpeed: 2.0, retreatSpeed: 2.0 },
        rustyaxe: { id: 'w_02', name: "Machado Enferrujado", slot: SLOTS.MAIN_HAND, damage: 10, weight: 4.0, value: 30, durability: 60, stats: { str: 3 },
            minRange: 0, maxRange: 2, atkSpeed: 0.8, approachSpeed: 1.5, retreatSpeed: 1.5 },
        dagger: { id: 'w_03', name: "Adaga Sombria", slot: SLOTS.MAIN_HAND, damage: 5, weight: 1.0, value: 40, durability: 80, stats: { agi: 2 }, critBonus: 10,
            minRange: 0, maxRange: 1, atkSpeed: 1.4, approachSpeed: 2.5, retreatSpeed: 2.5 },
        warhammer: { id: 'w_04', name: "Martelo de Guerra", slot: SLOTS.MAIN_HAND, damage: 14, weight: 6.0, value: 90, durability: 90, stats: { str: 4 }, armorPierce: 0.30,
            minRange: 0, maxRange: 2, atkSpeed: 0.6, approachSpeed: 1.2, retreatSpeed: 1.2 },
        spear: { id: 'w_05', name: "Lança Longa", slot: SLOTS.MAIN_HAND, damage: 9, weight: 3.0, value: 65, durability: 100, stats: { acc: 2 }, accBonus: 8,
            minRange: 2, maxRange: 5, atkSpeed: 0.9, approachSpeed: 1.8, retreatSpeed: 2.2 },
        rapier: { id: 'w_06', name: "Rapieira Élfica", slot: SLOTS.MAIN_HAND, damage: 7, weight: 1.5, value: 75, durability: 90, stats: { agi: 2, acc: 1 }, critBonus: 15,
            minRange: 0, maxRange: 3, atkSpeed: 1.3, approachSpeed: 2.2, retreatSpeed: 2.2 },
        longsword: { id: 'w_07', name: "Espada Longa", slot: SLOTS.MAIN_HAND, damage: 11, weight: 3.5, value: 85, durability: 110, stats: { str: 2 },
            minRange: 0, maxRange: 3, atkSpeed: 0.9, approachSpeed: 1.8, retreatSpeed: 1.8 },
        whip: { id: 'w_08', name: "Chicote", slot: SLOTS.MAIN_HAND, damage: 6, weight: 1.5, value: 70, durability: 70, stats: { agi: 1, acc: 1 },
            minRange: 2, maxRange: 6, atkSpeed: 1.1, approachSpeed: 1.5, retreatSpeed: 2.0 },
        // Armas de longo alcance: slot próprio (RANGED, não mainHand) e alcance
        // 0-10 (a distância inteira do mapa de batalha) — servem de suporte
        // pra qualquer arma corpo a corpo equipada junto, sem a limitação
        // antiga de exigir distância mínima pra atirar. maxAmmo limita quantos
        // disparos dá pra dar por luta (recarrega sozinho a cada nova luta,
        // ou na hora com a magia de Recarregar Munição).
        bow: { id: 'w_09', name: "Arco Curto", slot: SLOTS.RANGED, damage: 9, weight: 1.8, value: 95, durability: 80, stats: { acc: 3 },
            minRange: 0, maxRange: 10, atkSpeed: 1.0, approachSpeed: 1.0, retreatSpeed: 2.5, maxAmmo: 8 },
        crossbow: { id: 'w_10', name: "Besta de Aço", slot: SLOTS.RANGED, damage: 12, weight: 3.2, value: 110, durability: 90, stats: { acc: 2 }, armorPierce: 0.15,
            minRange: 0, maxRange: 10, atkSpeed: 0.7, approachSpeed: 1.0, retreatSpeed: 2.0, maxAmmo: 5 }
    },
    armors: {
        leatherchest: { id: 'a_01', name: "Armadura de Couro", slot: SLOTS.CHEST, defense: 5, weight: 3.0, value: 60, durability: 120, stats: { agi: 2 } },
        chainmail: { id: 'a_02', name: "Cota de Malha", slot: SLOTS.CHEST, defense: 9, weight: 5.0, value: 100, durability: 150, stats: { str: 1 } },
        platearmor: { id: 'a_03', name: "Armadura de Placas", slot: SLOTS.CHEST, defense: 14, weight: 8.0, value: 160, durability: 200, stats: { str: 2 } },
        leathercap: { id: 'a_04', name: "Gorro de Couro", slot: SLOTS.HEAD, defense: 2, weight: 1.0, value: 25, durability: 60, stats: { agi: 1 } },
        ironhelm: { id: 'a_05', name: "Elmo de Ferro", slot: SLOTS.HEAD, defense: 5, weight: 2.5, value: 70, durability: 120, stats: { acc: 1 } },
        leathergloves: { id: 'a_06', name: "Luvas de Couro", slot: SLOTS.HANDS, defense: 1, weight: 0.5, value: 20, durability: 50, stats: { agi: 1 } },
        ironvambraces: { id: 'a_07', name: "Braçadeiras de Ferro", slot: SLOTS.HANDS, defense: 3, weight: 1.5, value: 55, durability: 100, stats: { str: 1 } },
        leatherleggings: { id: 'a_08', name: "Calças de Couro", slot: SLOTS.LEGS, defense: 2, weight: 1.5, value: 30, durability: 70, stats: { agi: 1 } },
        irongreaves: { id: 'a_09', name: "Grevas de Ferro", slot: SLOTS.LEGS, defense: 5, weight: 3.0, value: 80, durability: 130, stats: { str: 1 } },
        leatherboots: { id: 'a_10', name: "Botas de Couro", slot: SLOTS.FEET, defense: 1, weight: 1.0, value: 20, durability: 60, stats: { agi: 2 } },
        ironboots: { id: 'a_11', name: "Botas de Ferro", slot: SLOTS.FEET, defense: 3, weight: 2.0, value: 60, durability: 110, stats: { str: 1 } }
    },
    shields: {
        woodenshield: { id: 's_01', name: "Escudo de Madeira", slot: SLOTS.OFF_HAND, defense: 3, weight: 3.0, value: 45, durability: 90, blockChance: 10 },
        ironshield: { id: 's_02', name: "Escudo de Ferro", slot: SLOTS.OFF_HAND, defense: 6, weight: 5.0, value: 90, durability: 140, stats: { str: 1 }, blockChance: 18 },
        towershield: { id: 's_03', name: "Escudo Torre", slot: SLOTS.OFF_HAND, defense: 10, weight: 8.0, value: 150, durability: 200, stats: { str: 2 }, blockChance: 28 }
    },
    trinkets: {
        amuletvigor: { id: 't_01', name: "Amuleto do Vigor", slot: SLOTS.AMULET, weight: 0.2, value: 80, durability: 999, hpBonus: 20 },
        amuletwisdom: { id: 't_02', name: "Amuleto da Sabedoria", slot: SLOTS.AMULET, weight: 0.2, value: 80, durability: 999, stats: { int: 1 }, mpBonus: 15 },
        ringprecision: { id: 't_03', name: "Anel da Precisão", slot: SLOTS.RING, weight: 0.1, value: 70, durability: 999, stats: { acc: 2 } },
        ringfortune: { id: 't_04', name: "Anel da Fortuna", slot: SLOTS.RING, weight: 0.1, value: 70, durability: 999, stats: { luk: 2 } }
    },
    consumables: {
        health_potion: { id: 'c_01', name: "Poção de Vida", type: 'HEAL_HP', power: 40, value: 25, description: "Restaura 40 de HP." },
        greater_health_potion: { id: 'c_02', name: "Poção de Vida Maior", type: 'HEAL_HP', power: 90, value: 55, description: "Restaura 90 de HP." },
        mana_potion: { id: 'c_03', name: "Poção de Mana", type: 'HEAL_MP', power: 25, value: 30, description: "Restaura 25 de MP." },
        bandage: { id: 'c_04', name: "Bandagem", type: 'CURE_FATIGUE', power: 1, value: 40, description: "Cura 1 nível de fadiga." }
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

    createConsumable(templateId) {
        const template = ItemDatabase.consumables[templateId];
        if (!template) {
            console.error(`[ItemFactory] Consumível ${templateId} não encontrado.`);
            return null;
        }
        return new Consumable(template);
    },

    // Gera o estoque procedural do Ferreiro/Mercado, escalando com o nível do jogador
    generateShopInventory(playerLevel) {
        const shopInventory = [];
        const categories = ['weapons', 'armors', 'shields', 'trinkets'];

        // Gera 8 itens de equipamento aleatórios entre as categorias disponíveis
        for (let i = 0; i < 8; i++) {
            const category = categories[Utils.randomInt(0, categories.length - 1)];
            const pool = Object.keys(ItemDatabase[category]);
            const randomId = pool[Utils.randomInt(0, pool.length - 1)];

            // Probabilidade de raridade baseada no nível do jogador
            let rarity = RARITY.COMMON;
            if (Utils.chance(10 + playerLevel)) rarity = RARITY.UNCOMMON;
            if (Utils.chance(2 + playerLevel * 0.5)) rarity = RARITY.RARE;

            const item = this.createEquipment(randomId, category, rarity);
            shopInventory.push(item);
        }
        return shopInventory;
    },

    // Estoque fixo de consumíveis sempre disponível no Mercado (Boticário)
    getConsumableStock() {
        return Object.keys(ItemDatabase.consumables).map(id => this.createConsumable(id));
    }
};
