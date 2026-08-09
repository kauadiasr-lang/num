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
    // `qualityValue` (0-100, ver js/forge.js) — NOVO, opcional, default
    // `null`. Todo item de loja/loot continua chamando `new
    // Equipment(template, rarityObj)` sem o 3º argumento, então
    // `this.quality` fica `null` e NENHUM multiplicador extra é aplicado —
    // comportamento 100% idêntico ao de antes deste campo existir. Só a
    // Forja (Reino Anão) passa um valor real aqui. Pedido explícito do
    // usuário: qualidade é um eixo DIFERENTE de raridade, nunca a
    // substitui — por isso o multiplicador extra é discreto (0.85x-1.25x)
    // e some por cima do multiplicador de raridade já existente, nunca no
    // lugar dele.
    constructor(baseTemplate, rarityObj, qualityValue = null) {
        this.category = 'equipment';
        this.uuid = Utils.generateUUID();
        this.id = baseTemplate.id;
        this.name = `${baseTemplate.name}`;
        this.slot = baseTemplate.slot;
        this.rarity = rarityObj;
        this.quality = qualityValue;
        // 0.85x (qualidade 0, forja ruim) a 1.25x (qualidade 100, forja
        // perfeita) — intervalo deliberadamente contido (ver comentário
        // acima do construtor) pra nunca competir em magnitude com o
        // multiplicador de raridade (1.0x-3.0x).
        const qMult = qualityValue !== null ? (0.85 + (qualityValue / 100) * 0.4) : 1;

        // Atributos base multiplicados pela raridade (arredondados)
        this.damage = Math.floor((baseTemplate.damage || 0) * rarityObj.mult * qMult);
        this.defense = Math.floor((baseTemplate.defense || 0) * rarityObj.mult * qMult);
        this.weight = baseTemplate.weight;
        this.value = Math.floor(baseTemplate.value * (rarityObj.mult * 2) * qMult);
        this.durability = baseTemplate.durability;
        this.maxDurability = baseTemplate.durability;

        // Bônus em atributos (Força, Agilidade, etc)
        this.statBonuses = {};
        if (baseTemplate.stats) {
            for (let stat in baseTemplate.stats) {
                this.statBonuses[stat] = Math.floor(baseTemplate.stats[stat] * rarityObj.mult * qMult);
            }
        }

        // Bônus diretos de combate (não escalam com raridade de forma linear
        // demais para não quebrar o balanceamento em itens lendários)
        this.critBonus = baseTemplate.critBonus ? +(baseTemplate.critBonus * rarityObj.mult * qMult).toFixed(1) : 0;
        this.accBonus = baseTemplate.accBonus ? +(baseTemplate.accBonus * rarityObj.mult * qMult).toFixed(1) : 0;
        this.blockChance = baseTemplate.blockChance ? +(baseTemplate.blockChance * rarityObj.mult * qMult).toFixed(1) : 0;
        this.armorPierce = baseTemplate.armorPierce || 0; // fixo por arquétipo de arma, não escala com raridade
        this.hpBonus = baseTemplate.hpBonus ? Math.floor(baseTemplate.hpBonus * rarityObj.mult * qMult) : 0;
        this.mpBonus = baseTemplate.mpBonus ? Math.floor(baseTemplate.mpBonus * rarityObj.mult * qMult) : 0;

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

        // Região de origem (ver citydatabase.js) — null significa item
        // "neutro", vendido em qualquer cidade (todo item cadastrado antes
        // das Cidades-Hub Regionais nunca teve esse campo, então continua
        // neutro automaticamente). Só itens culturais novos (Lâmina Élfica,
        // Armadura Pesada Orc etc) usam isso pra restringir onde aparecem no
        // estoque do Ferreiro/Armeiro (ver ItemFactory.generateShopInventory).
        this.region = baseTemplate.region || null;

        // Ajuste de nome para itens raros
        if (rarityObj.id > 1) {
            this.name = `${this.name} ${rarityObj.name}`;
        }

        // Mega Atualização (item 3/4): requisitos de EQUIPAR (nunca de
        // COMPRAR — ver ui.js openShop/renderShopItems, que continua sem
        // nenhum gate de nível/atributo na compra em si). Derivados do
        // PRÓPRIO poder já calculado da peça (this.damage/defense/
        // statBonuses/critBonus/mpBonus/maxAmmo, todos JÁ multiplicados
        // por raridade/qualidade acima) — nunca uma tabela de requisitos
        // hardcoded por template, então a MESMA arma em raridade Comum vs
        // Lendária (ou qualidade de Forja baixa vs perfeita) automaticamente
        // exige mais, sem duplicar lógica por tier (item 16: reaproveita o
        // eixo raridade/qualidade já existente). O TIPO de requisito
        // reflete o arquétipo real da peça — dano alto/bônus de Força pede
        // STR, crítico/munição/bônus de Agilidade pede AGI, bônus de
        // Mana/Inteligência pede INT, defesa alta pede DEF — nunca
        // arbitrário (item 3 da diretiva).
        const rarityLevelFloor = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 14 }[rarityObj.id] || 1;
        this.requiredLevel = Utils.clamp(rarityLevelFloor + Math.floor((baseTemplate.value || 0) / 60), 1, 20);
        const req = {};
        if (this.damage >= 12 || (this.statBonuses.str || 0) >= 3) {
            req.str = Utils.clamp(Math.round(6 + this.requiredLevel * 1.3 + (this.statBonuses.str || 0) * 1.2), 5, 45);
        }
        if ((this.statBonuses.agi || 0) >= 2 || this.critBonus > 0 || this.maxAmmo) {
            req.agi = Utils.clamp(Math.round(5 + this.requiredLevel * 1.1 + (this.statBonuses.agi || 0) * 1.2), 5, 40);
        }
        if ((this.statBonuses.int || 0) >= 1 || this.mpBonus > 0) {
            req.int = Utils.clamp(Math.round(5 + this.requiredLevel * 1.1 + (this.statBonuses.int || 0) * 1.5), 5, 35);
        }
        if (this.defense >= 8) {
            req.def = Utils.clamp(Math.round(4 + this.requiredLevel * 0.9), 4, 30);
        }
        this.requiredStats = Object.keys(req).length ? req : null;
    }
}

// Itens consumíveis: sem slot de equipamento, efeito imediato ao usar
class Consumable {
    constructor(baseTemplate) {
        this.category = 'consumable';
        this.uuid = Utils.generateUUID();
        this.id = baseTemplate.id;
        this.name = baseTemplate.name;
        this.type = baseTemplate.type; // HEAL_HP | HEAL_MP | CURE_FATIGUE | TEMP_BUFF
        this.power = baseTemplate.power;
        this.value = baseTemplate.value;
        this.description = baseTemplate.description;
        this.rarity = RARITY.COMMON; // usado apenas para exibir uma cor neutra na UI/tooltip
        // Só usados por TEMP_BUFF (ver player.js useConsumable/
        // calculateDerivedStats) — efeito FIXO e pré-definido, nunca
        // escala com INT ou qualquer atributo (Rework Econômico item 9:
        // runas anãs são "tecnologia artesã", não uma cópia da magia
        // convencional de outra cidade).
        this.statKey = baseTemplate.statKey;
        this.buffAmount = baseTemplate.buffAmount;
        this.durationDays = baseTemplate.durationDays;
        // Só usados pelos estimulantes de "uso pesado" da Fortaleza Orc
        // (ver player.js useConsumable) — risco real de fadiga ao usar,
        // distinguindo uso seguro (Treino, sem risco) de uso pesado
        // (bônus maior, mas rola uma chance de custo). undefined em todo
        // outro consumível, então nunca entra em jogo fora daqui.
        this.riskFatigueChance = baseTemplate.riskFatigueChance;
        this.riskFatigueAmount = baseTemplate.riskFatigueAmount;
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
            minRange: 0, maxRange: 10, atkSpeed: 0.7, approachSpeed: 1.0, retreatSpeed: 2.0, maxAmmo: 5 },

        // --- Armas regionais (Cidades-Hub Regionais) ---
        // `region` restringe onde aparecem no estoque diário do Ferreiro/
        // Armeiro (ver ItemFactory.generateShopInventory) — nunca aparecem
        // fora da cidade indicada, mas continuam 100% equipáveis por
        // qualquer personagem depois de compradas (raça do dono é
        // irrelevante pro item em si, igual acontece com qualquer arma).
        orcwaraxe: { id: 'w_11', name: "Machado de Guerra Orc", slot: SLOTS.MAIN_HAND, damage: 16, weight: 7.0, value: 140, durability: 110, stats: { str: 5 }, armorPierce: 0.20, region: 'fortaleza_orc',
            minRange: 0, maxRange: 2, atkSpeed: 0.55, approachSpeed: 1.1, retreatSpeed: 1.1 },
        // Bug de auditoria corrigido (Rework Econômico item 15): item de
        // nome/tema explicitamente anão estava com `region: 'fortaleza_orc'`
        // — provavelmente um resquício de antes de o Reino Anão existir
        // como cidade própria. Também é o único produto de receita
        // exclusiva da Forja (ver forge.js RECIPES), então o bug escondia
        // o item da loja da própria cidade que o forja.
        dwarvenhammer: { id: 'w_12', name: "Martelo Rúnico Anão", slot: SLOTS.MAIN_HAND, damage: 15, weight: 6.0, value: 170, durability: 160, stats: { str: 2, def: 1 }, armorPierce: 0.25, region: 'reino_anao',
            minRange: 0, maxRange: 2, atkSpeed: 0.65, approachSpeed: 1.3, retreatSpeed: 1.3 },
        elvenblade: { id: 'w_13', name: "Lâmina Élfica", slot: SLOTS.MAIN_HAND, damage: 9, weight: 1.2, value: 150, durability: 100, stats: { agi: 3, acc: 1 }, critBonus: 18, region: 'santuario_elfico',
            minRange: 0, maxRange: 3, atkSpeed: 1.5, approachSpeed: 2.4, retreatSpeed: 2.4 },
        elvenlongbow: { id: 'w_14', name: "Arco Élfico Longo", slot: SLOTS.RANGED, damage: 11, weight: 1.5, value: 160, durability: 90, stats: { agi: 2, acc: 3 }, region: 'santuario_elfico',
            minRange: 0, maxRange: 10, atkSpeed: 1.1, approachSpeed: 1.0, retreatSpeed: 2.6, maxAmmo: 10 },

        // Item 12 da revisão profunda ("itens com identidade, nunca só
        // +10/+20/+30 do mesmo atributo") — pedido pelo exemplo conceitual
        // do próprio usuário: "Arco do Olho Partido: +Precisão, +chance de
        // atingir pontos fracos, -defesa". "Chance de atingir pontos
        // fracos" vira `critBonus` (mesmo mecanismo que toda outra arma de
        // crítico já usa, ver rapier/elvenblade acima) — um crítico É
        // literalmente acertar o ponto fraco do alvo. A penalidade de
        // defesa é um `stats.def` NEGATIVO (primeiro do jogo; ver o
        // conserto de exibição em ui.js attachTooltip pro sinal não duplicar
        // "+-3"), então quem usa esse arco entra em combate estruturalmente
        // mais frágil — a troca é real, não cosmética.
        brokeneyebow: { id: 'w_15', name: "Arco do Olho Partido", slot: SLOTS.RANGED, damage: 9, weight: 1.4, value: 140, durability: 75, stats: { acc: 5, def: -3 }, critBonus: 20,
            minRange: 0, maxRange: 10, atkSpeed: 1.0, approachSpeed: 1.0, retreatSpeed: 2.4, maxAmmo: 8 },

        // Rework Econômico item 4/5 — expansão da Forja: arma pesada
        // EXCLUSIVA (nunca aparece em loja nenhuma, só via
        // forge.js RECIPES recipe_dwarvengreataxe) — a receita gasta
        // Adamante Anão (tier 5, o material mais raro do jogo, só minerado
        // nos veios mais profundos), então só quem já explorou bastante a
        // mineração consegue sequer TENTAR forjar esta. Mais pesada e mais
        // lenta que o Martelo Rúnico Anão (a outra exclusiva), trade-off
        // de dano bruto por velocidade — nunca um upgrade estritamente
        // melhor, uma escolha de estilo diferente.
        dwarvengreataxe: { id: 'w_16', name: "Machado de Guerra de Kharzum", slot: SLOTS.MAIN_HAND, damage: 20, weight: 9.0, value: 250, durability: 190, stats: { str: 6 }, armorPierce: 0.35, region: 'reino_anao',
            minRange: 0, maxRange: 2, atkSpeed: 0.5, approachSpeed: 1.0, retreatSpeed: 1.0 }
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
        ironboots: { id: 'a_11', name: "Botas de Ferro", slot: SLOTS.FEET, defense: 3, weight: 2.0, value: 60, durability: 110, stats: { str: 1 } },

        // --- Armaduras regionais (Cidades-Hub Regionais) ---
        orcheavyarmor: { id: 'a_12', name: "Armadura Pesada Orc", slot: SLOTS.CHEST, defense: 18, weight: 10.0, value: 190, durability: 220, stats: { str: 3 }, region: 'fortaleza_orc' },
        elvencloak: { id: 'a_13', name: "Manto Élfico", slot: SLOTS.CHEST, defense: 6, weight: 1.2, value: 140, durability: 90, stats: { agi: 2, int: 1 }, region: 'santuario_elfico' }
    },
    shields: {
        woodenshield: { id: 's_01', name: "Escudo de Madeira", slot: SLOTS.OFF_HAND, defense: 3, weight: 3.0, value: 45, durability: 90, blockChance: 10 },
        ironshield: { id: 's_02', name: "Escudo de Ferro", slot: SLOTS.OFF_HAND, defense: 6, weight: 5.0, value: 90, durability: 140, stats: { str: 1 }, blockChance: 18 },
        towershield: { id: 's_03', name: "Escudo Torre", slot: SLOTS.OFF_HAND, defense: 10, weight: 8.0, value: 150, durability: 200, stats: { str: 2 }, blockChance: 28 },
        orcreinforcedshield: { id: 's_04', name: "Escudo Reforçado Orc", slot: SLOTS.OFF_HAND, defense: 9, weight: 6.5, value: 130, durability: 170, stats: { str: 2 }, blockChance: 22, region: 'fortaleza_orc' }
    },
    trinkets: {
        amuletvigor: { id: 't_01', name: "Amuleto do Vigor", slot: SLOTS.AMULET, weight: 0.2, value: 80, durability: 999, hpBonus: 20 },
        amuletwisdom: { id: 't_02', name: "Amuleto da Sabedoria", slot: SLOTS.AMULET, weight: 0.2, value: 80, durability: 999, stats: { int: 1 }, mpBonus: 15 },
        ringprecision: { id: 't_03', name: "Anel da Precisão", slot: SLOTS.RING, weight: 0.1, value: 70, durability: 999, stats: { acc: 2 } },
        ringfortune: { id: 't_04', name: "Anel da Fortuna", slot: SLOTS.RING, weight: 0.1, value: 70, durability: 999, stats: { luk: 2 } },

        // --- Amuletos/anéis regionais (Cidades-Hub Regionais) ---
        trolltusk: { id: 't_05', name: "Presa de Troll", slot: SLOTS.AMULET, weight: 0.3, value: 150, durability: 999, hpBonus: 35, region: 'fortaleza_orc' },
        livingforestring: { id: 't_06', name: "Anel da Floresta Viva", slot: SLOTS.RING, weight: 0.1, value: 150, durability: 999, stats: { int: 2 }, mpBonus: 20, region: 'santuario_elfico' },
        // Item 11 da auditoria de balanceamento ("catálogo de itens
        // exclusivo por cidade"): bug de auditoria encontrado — o Santuário
        // Élfico já tinha arma/arco/capa/anel regionais, mas NENHUM amuleto
        // (só um anel), apesar do pedido original listar "amuletos"
        // explicitamente como categoria própria da Cidade Élfica (junto de
        // arcos/capas/armaduras leves, todos já cobertos). Fortaleza Orc já
        // tinha seu amuleto (Presa de Troll) desde o trabalho original das
        // Cidades-Hub Regionais — o Santuário ficou com essa lacuna.
        elderwoodamulet: { id: 't_07', name: "Amuleto da Seiva Ancestral", slot: SLOTS.AMULET, weight: 0.2, value: 150, durability: 999, stats: { int: 1 }, hpBonus: 20, mpBonus: 25, region: 'santuario_elfico' },

        // Item 12 da revisão profunda, segundo exemplo conceitual do próprio
        // usuário: "Amuleto do Acaso: +Sorte, efeito especial baseado em
        // probabilidade". O "efeito baseado em probabilidade" vira
        // `critBonus` — igual ao Arco do Olho Partido acima, reaproveita um
        // mecanismo já existente e testado em vez de inventar um sistema de
        // proc novo, mas aqui funciona em QUALQUER slot de amuleto
        // (critBonus de trinket nunca depende de arma ativa, ver o filtro
        // `!isWeaponSlot` em Entity.calculateDerivedStats) — um crítico
        // "de sorte", não de precisão de arma. HP negativo é o trade-off:
        // risco real (mais frágil) pela recompensa de mais chance de
        // crítico, puxando pro tema "risco/recompensa" pedido pra Sorte no
        // item 10, não só "+Sorte" solto como o já existente Anel da Fortuna.
        luckyamulet: { id: 't_08', name: "Amuleto do Acaso", slot: SLOTS.AMULET, weight: 0.2, value: 130, durability: 999, stats: { luk: 5 }, critBonus: 12, hpBonus: -15 },

        // Rework Econômico item 4/5 — "componente especial" forjável
        // EXCLUSIVO (ver forge.js recipe_magmacoreamulet): gasta Cristal
        // Mágico (tier 4) em dobro — caro em mineração, não em ouro —
        // reforçando defesa E vigor ao mesmo tempo, mais forte que
        // qualquer amuleto genérico de loja, mas só existe pra quem forja.
        magmacoreamulet: { id: 't_09', name: "Amuleto do Núcleo de Magma", slot: SLOTS.AMULET, weight: 0.3, value: 210, durability: 999, stats: { def: 2 }, hpBonus: 30, region: 'reino_anao' }
    },
    consumables: {
        health_potion: { id: 'c_01', name: "Poção de Vida", type: 'HEAL_HP', power: 40, value: 25, description: "Restaura 40 de HP." },
        greater_health_potion: { id: 'c_02', name: "Poção de Vida Maior", type: 'HEAL_HP', power: 90, value: 55, description: "Restaura 90 de HP." },
        mana_potion: { id: 'c_03', name: "Poção de Mana", type: 'HEAL_MP', power: 25, value: 30, description: "Restaura 25 de MP." },
        bandage: { id: 'c_04', name: "Bandagem", type: 'CURE_FATIGUE', power: 1, value: 40, description: "Cura 1 nível de fadiga." },

        // --- Identidade do Reino Anão (Rework Econômico item 8/9) ---
        // `region`+`subShop` combinados (ver ItemFactory.getConsumableStock
        // abaixo) fazem esses itens SUBSTITUÍREM — nunca somarem a — o pool
        // genérico acima nas sub-lojas da Taverna/Câmara Rúnica anãs. Nunca
        // aparecem em nenhuma outra cidade nem no Mercado geral/Mercador
        // Viajante. Efeitos TEMPORÁRIOS (TEMP_BUFF) usam o mesmo formato
        // statKey/amount dos passivos de raça/mutação (ver
        // player.js calculateDerivedStats) — nunca escalam com atributo
        // nenhum, exatamente como runas/hidromel deveriam funcionar.
        mead_strong: { id: 'c_05', name: "Hidromel Forte", type: 'TEMP_BUFF', statKey: 'defenseBonusPercent', buffAmount: 8, durationDays: 1, value: 45, description: "Bebida forte de Kharzum. +8% de resistência por 1 dia.", region: 'reino_anao', subShop: 'tavern' },
        dwarven_feast: { id: 'c_06', name: "Banquete Anão", type: 'TEMP_BUFF', statKey: 'defenseRatingFlat', buffAmount: 6, durationDays: 1, value: 70, description: "Um banquete de verdade, não uma refeição rápida. +6 de defesa por 1 dia.", region: 'reino_anao', subShop: 'tavern' },
        smoked_meat: { id: 'c_07', name: "Carne Defumada", type: 'CURE_FATIGUE', power: 1, value: 35, description: "Prato robusto anão de viagem. Cura 1 nível de fadiga.", region: 'reino_anao', subShop: 'tavern' },
        rune_protection: { id: 'c_08', name: "Runa de Proteção", type: 'TEMP_BUFF', statKey: 'defenseBonusPercent', buffAmount: 15, durationDays: 1, value: 95, description: "Runa anã de efeito fixo, gravada por artesãos — não depende de Inteligência. +15% de resistência por 1 dia.", region: 'reino_anao', subShop: 'runes' },
        rune_strength: { id: 'c_09', name: "Runa de Força", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 5, durationDays: 1, value: 95, description: "Runa anã de efeito fixo, gravada por artesãos — não depende de Inteligência. +5 de dano físico por 1 dia.", region: 'reino_anao', subShop: 'runes' },

        // --- Identidade do Santuário Élfico (Rework Econômico item 10) ---
        // Mesmo mecanismo `region`+`subShop` da Iteração 2 (ver
        // ItemFactory.getConsumableStock) — o Ateliê Élfico SUBSTITUI o
        // pool genérico da sua sub-loja, nunca soma. Ao contrário das
        // runas anãs (efeito defensivo/físico, "tecnologia de forja"),
        // os artefatos élficos afetam MANA e cura mágica — a mesma
        // distinção de identidade pedida no item 12 ("cada cidade deve ter
        // algo que o jogador não pode simplesmente comprar em outro
        // lugar"), sem copiar o tema anão.
        stardust: { id: 'c_10', name: "Poeira de Estrelas", type: 'TEMP_BUFF', statKey: 'healPowerBonusPercent', buffAmount: 12, durationDays: 1, value: 90, description: "Pó colhido sob a lua cheia de Sylvaneth — +12% de poder de cura mágica por 1 dia.", region: 'santuario_elfico', subShop: 'atelier' },
        clarity_crystal: { id: 'c_11', name: "Cristal de Clareza", type: 'TEMP_BUFF', statKey: 'maxMpFlat', buffAmount: 15, durationDays: 1, value: 90, description: "Cristal élfico que amplia a reserva de mana — +15 de MP máximo por 1 dia.", region: 'santuario_elfico', subShop: 'atelier' },

        // --- Identidade da Fortaleza Orc (Rework Econômico item 11) ---
        // Círculo de Treinamento (ver citydatabase.js buildingNames/
        // hasMagicSubShop) — mesmo mecanismo region+subShop, mas o Orc
        // ganha uma DISTINÇÃO estrutural que Anões/Elfos não têm: os 3
        // treinos são uso SEGURO (bônus pequeno, sem custo além do ouro),
        // enquanto o Estimulante Selvagem é uso PESADO — bônus maior, mas
        // `riskFatigueChance`/`riskFatigueAmount` (ver player.js
        // useConsumable) rola uma chance real de custar fadiga, reaproveita
        // o sistema de fadiga JÁ existente (Player.addFatigue) em vez de
        // inventar um "custo de uso pesado" novo do zero (item 16).
        orc_training_str: { id: 'c_12', name: "Treino de Força", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 4, durationDays: 1, value: 55, description: "Sessão de treino sob supervisão dos veteranos de Gorkhal — +4 de dano físico por 1 dia. Uso seguro, sem risco.", region: 'fortaleza_orc', subShop: 'training' },
        orc_training_res: { id: 'c_13', name: "Treino de Resistência", type: 'TEMP_BUFF', statKey: 'defenseRatingFlat', buffAmount: 4, durationDays: 1, value: 55, description: "Exercícios de resistência ao golpe — +4 de defesa por 1 dia. Uso seguro, sem risco.", region: 'fortaleza_orc', subShop: 'training' },
        orc_training_combat: { id: 'c_14', name: "Treino de Combate", type: 'TEMP_BUFF', statKey: 'dodgeBonusPercent', buffAmount: 5, durationDays: 1, value: 55, description: "Prática de reflexos e esquiva no Fosso de Guerra — +5% de esquiva por 1 dia. Uso seguro, sem risco.", region: 'fortaleza_orc', subShop: 'training' },
        orc_wild_stimulant: { id: 'c_15', name: "Estimulante Selvagem", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 9, durationDays: 1, riskFatigueChance: 40, riskFatigueAmount: 1, value: 70, description: "Extrato natural bruto, sem diluição — +9 de dano físico por 1 dia, mas 40% de chance de sobrecarregar o corpo (+1 nível de fadiga). Uso pesado: risco real.", region: 'fortaleza_orc', subShop: 'training' }
    },
    // Matérias-primas do Reino Subterrâneo de Kharzum (ver citydatabase.js
    // reino_anao / city.js oreVeinSpots) — a base do sistema de Forja (ver
    // js/forge.js). Deliberadamente só 6 (pedido explícito: "não adicione
    // dezenas de recursos inúteis, cada recurso deve possuir função real")
    // — cada um mapeado a UM `tier` (1-5) que a Forja usa pra calcular a
    // qualidade final do item forjado (ver ForgeSystem._computeQuality).
    // Sem slot/dano/defesa — nunca equipável, só consumido como insumo.
    materials: {
        common_ore: { id: 'm_01', name: "Minério Comum", tier: 1, value: 4, description: "Rocha com veios metálicos visíveis a olho nu — a matéria-prima mais básica de qualquer forja." },
        iron_ore: { id: 'm_02', name: "Ferro", tier: 2, value: 9, description: "Minério de ferro já parcialmente puro, pronto pra fundição." },
        coal: { id: 'm_03', name: "Carvão", tier: 2, value: 7, description: "Combustível denso — sem ele, nenhuma forja atinge temperatura pra nada além do trabalho mais grosseiro." },
        steel_ingot: { id: 'm_04', name: "Lingote de Aço", tier: 3, value: 22, description: "Ferro e carvão já fundidos e trabalhados — a base de qualquer equipamento anão de verdade." },
        arcane_crystal: { id: 'm_05', name: "Cristal Mágico", tier: 4, value: 55, description: "Cristal bruto que ainda pulsa com energia própria — raro fora das cavernas mais profundas do Reino." },
        dwarven_adamant: { id: 'm_06', name: "Adamante Anão", tier: 5, value: 140, description: "O material mais denso e raro conhecido nas minas de Kharzum — lendas entre os próprios anões." }
    }
};

// Matérias-primas (ver ItemDatabase.materials acima) — sem slot de
// equipamento, sem raridade própria (usa RARITY.COMMON só pra cor neutra
// de tooltip/bolsa, mesmo padrão de Consumable acima), nunca clicável pra
// "equipar" no inventário (ver ui.js renderBag, que já distingue por
// `category`). `tier` é o único campo que realmente importa pra fora
// desta classe — é o que a Forja (js/forge.js) lê pra calcular qualidade.
class Material {
    constructor(baseTemplate) {
        this.category = 'material';
        this.uuid = Utils.generateUUID();
        this.id = baseTemplate.id;
        this.name = baseTemplate.name;
        this.tier = baseTemplate.tier;
        this.value = baseTemplate.value;
        this.description = baseTemplate.description;
        this.rarity = RARITY.COMMON;
    }
}

window.ItemFactory = {
    // `qualityValue` (ver Equipment acima/js/forge.js) — opcional, só usado
    // pela Forja. Todo chamador existente (loja, loot) passa só os 3
    // primeiros argumentos, então continua criando itens sem quality
    // nenhuma, exatamente como antes.
    createEquipment(templateId, category, rarityObj = RARITY.COMMON, qualityValue = null) {
        const template = ItemDatabase[category][templateId];
        if (!template) {
            console.error(`[ItemFactory] Template ${templateId} não encontrado.`);
            return null;
        }
        return new Equipment(template, rarityObj, qualityValue);
    },

    createConsumable(templateId) {
        const template = ItemDatabase.consumables[templateId];
        if (!template) {
            console.error(`[ItemFactory] Consumível ${templateId} não encontrado.`);
            return null;
        }
        return new Consumable(template);
    },

    createMaterial(templateId) {
        const template = ItemDatabase.materials[templateId];
        if (!template) {
            console.error(`[ItemFactory] Material ${templateId} não encontrado.`);
            return null;
        }
        return new Material(template);
    },

    // Gera o estoque procedural do Ferreiro/Mercado, escalando com o nível do
    // jogador. `cityId` (ver citydatabase.js) filtra o catálogo de cada
    // categoria pra só considerar itens neutros (sem `region`, disponíveis
    // em qualquer cidade) + itens culturais da cidade atual. Chamadores que
    // não passam `cityId` (ex: geração de loot de inimigo em enemy.js) só
    // veem os itens neutros — exatamente os mesmos que existiam antes desta
    // feature, já que TODO item cadastrado antes das Cidades-Hub Regionais
    // não tem `region`: nenhum comportamento de loot pré-existente muda.
    // `includeAllRegions`: usado pelo Mercador Viajante (ver ui.js openShop/
    // city.js _eventRareMerchant) — sua própria fala já diz que traz
    // mercadoria "de terras distantes", mas sem essa flag ele reusaria o
    // MESMO filtro regional do Ferreiro/Armeiro locais e nunca venderia
    // nada de fora da cidade atual, contradizendo a própria flavor text.
    // Com a flag, TODO item entra no sorteio (regional de qualquer cidade
    // + neutro), dando ao Mercador Viajante uma razão mecânica real de
    // existir: é a única forma de comprar item de outra região sem viajar.
    // Sorteia categoria+id de equipamento respeitando o filtro regional —
    // extraído do corpo de generateShopInventory pra ser reaproveitado
    // também por generateGuaranteedItem (ver abaixo), sem duplicar a lógica
    // de categoria/pool/filtro por cidade.
    _pickRandomEquipmentId(cityId, includeAllRegions) {
        const categories = ['weapons', 'armors', 'shields', 'trinkets'];
        const availableInCity = (template) => includeAllRegions || !template.region || template.region === cityId;
        const category = categories[Utils.randomInt(0, categories.length - 1)];
        const pool = Object.keys(ItemDatabase[category]).filter(id => availableInCity(ItemDatabase[category][id]));
        if (pool.length === 0) return null; // categoria sem nenhum item disponível nesta cidade (não deveria ocorrer, mas evita crash)
        return { category, id: pool[Utils.randomInt(0, pool.length - 1)] };
    },

    generateShopInventory(playerLevel, cityId = null, includeAllRegions = false) {
        const shopInventory = [];

        // Gera 8 itens de equipamento aleatórios entre as categorias disponíveis
        for (let i = 0; i < 8; i++) {
            const picked = this._pickRandomEquipmentId(cityId, includeAllRegions);
            if (!picked) continue;

            // Probabilidade de raridade baseada no nível do jogador — curva
            // dura no início de propósito (ver pedido do jogador: lutadores
            // fracos não deveriam já encontrar equipamento raro nos primeiros
            // níveis). Antes disso, mesmo nível 1 já tinha 11% de chance de
            // Incomum e 2.5% de Raro — pouco isoladamente, mas contribuía
            // pra sensação de "inimigos de nível 1-3 já aparecem com item bom
            // e armadura" quando somado a várias lutas. Agora Incomum só
            // começa a aparecer a partir do nível 3 (0% em 1-2) e Raro só a
            // partir do nível 6, ambos crescendo gradualmente depois e com
            // teto pra nunca virar garantido.
            //
            // Épico/Lendário (ver bug de auditoria: RARITY tem 5 tiers desde
            // sempre, mas esta era a ÚNICA função que gera equipamento de
            // verdade no jogo — todo loot/estoque do jogo inteiro NUNCA
            // conseguia produzir nada acima de Raro, deixando a conquista
            // 'legendary_finder' matematicamente impossível de obter em
            // qualquer partida normal, e fazendo o loot "garantido e
            // lendário" de boss/Campeão da Ladder (ver enemy.js) cair sempre
            // no fallback comum). Só aparecem em níveis bem altos e com teto
            // bem mais raro que os tiers anteriores, mantendo a mesma
            // filosofia "raro de verdade, nunca garantido" das faixas de
            // baixo nível.
            // Especialização econômica por cidade (ver citydatabase.js
            // `specialization` — Fortaleza Orc/Santuário Élfico/Reino Anão),
            // pedido explícito do usuário: "cidade Orc possui maior
            // probabilidade de oferecer uma espada ofensiva excepcional...
            // NÃO deve significar que só aquela cidade consegue produzir".
            // Só MULTIPLICA a curva por nível já existente (1.4x) e sobe o
            // teto um pouco — nunca substitui o cálculo por nível, nunca
            // determina raridade sozinha, nunca "cidade X = sempre item
            // perfeito" (item 10 do pedido).
            const cityDefForSpec = cityId && window.CityDatabase ? window.CityDatabase[cityId] : null;
            const isSpecialized = cityDefForSpec && cityDefForSpec.specialization && cityDefForSpec.specialization.includes(picked.category);
            const specMult = isSpecialized ? 1.4 : 1;
            let rarity = RARITY.COMMON;
            const uncommonChance = Utils.clamp((playerLevel - 2) * 3 * specMult, 0, isSpecialized ? 48 : 35);
            const rareChance = Utils.clamp((playerLevel - 5) * 2 * specMult, 0, isSpecialized ? 28 : 20);
            const epicChance = Utils.clamp((playerLevel - 10) * 1.5 * specMult, 0, isSpecialized ? 12 : 8);
            const legendaryChance = Utils.clamp((playerLevel - 15) * 0.5 * specMult, 0, isSpecialized ? 3 : 2);
            if (Utils.chance(uncommonChance)) rarity = RARITY.UNCOMMON;
            if (Utils.chance(rareChance)) rarity = RARITY.RARE;
            if (Utils.chance(epicChance)) rarity = RARITY.EPIC;
            if (Utils.chance(legendaryChance)) rarity = RARITY.LEGENDARY;

            const item = this.createEquipment(picked.id, picked.category, rarity);
            shopInventory.push(item);
        }
        return shopInventory;
    },

    // Gera um único item de raridade GARANTIDA (não sorteada) — usado pelo
    // loot "garantido e lendário" de boss (ver enemy.js createBoss) e pelo
    // loot "sempre de alta raridade" de Campeão da Ladder (ver enemy.js
    // Rival.generateLoot). Antes, os dois dependiam de sortear um pool
    // comum via generateShopInventory e TORCER que algum item aleatório do
    // pool batesse com a raridade prometida (EPIC/LEGENDARY) — como
    // generateShopInventory nunca produzia nada acima de Raro (ver comentário
    // acima), a promessa nunca se cumpria de verdade, e ambos caíam
    // silenciosamente no fallback `pool[0]`, contrariando o próprio texto
    // "garantida"/"sempre". Reaproveita _pickRandomEquipmentId pra nunca
    // duplicar o filtro de categoria/região.
    generateGuaranteedItem(cityId, rarityObj, includeAllRegions = false) {
        const picked = this._pickRandomEquipmentId(cityId, includeAllRegions);
        if (!picked) return null;
        return this.createEquipment(picked.id, picked.category, rarityObj);
    },

    // Estoque de consumíveis. Sem argumentos (Mercado geral/Mercador
    // Viajante), continua vendo só o pool neutro de sempre (os 4 itens sem
    // `region`) — nenhum comportamento pré-existente muda. Com `cityId`+
    // `subShop` (ver ui.js openShop/renderConsumableShop), uma sub-loja com
    // consumíveis PRÓPRIOS cadastrados (ex: Taverna/Câmara Rúnica do Reino
    // Anão, ver ItemDatabase.consumables acima) SUBSTITUI o pool neutro por
    // completo — nunca soma os dois (Rework Econômico item 8: "a Taverna
    // Anã não deve vender as mesmas poções de qualquer outra cidade"). Uma
    // cidade/sub-loja sem nenhum item regional cadastrado (Orc, Elfo,
    // Central, ou uma sub-loja anã futura ainda vazia) cai automaticamente
    // de volta pro pool neutro, sem precisar de nenhum caso especial aqui.
    getConsumableStock(cityId = null, subShop = null) {
        const allIds = Object.keys(ItemDatabase.consumables);
        if (subShop) {
            const regional = allIds.filter(id => {
                const t = ItemDatabase.consumables[id];
                return t.region === cityId && t.subShop === subShop;
            });
            if (regional.length > 0) return regional.map(id => this.createConsumable(id));
        }
        return allIds.filter(id => !ItemDatabase.consumables[id].region).map(id => this.createConsumable(id));
    }
};
