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

// Ordem crescente por `id` — usada pelo gerador procedural de equipamento
// de inimigos (Mega Atualização item 12/13, ver ItemFactory.rollGearRarity/
// createEquipmentForEntity abaixo) pra sortear uma raridade e, se preciso,
// "descer" um degrau de cada vez até achar algo que o próprio inimigo
// atenda os requisitos.
const RARITY_ORDER = [RARITY.COMMON, RARITY.UNCOMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];

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
        // Mega Atualização item 1 ("cada nova arma deve possuir...
        // descrição"): Equipment nunca teve texto de identidade nenhum —
        // só Consumable/Material tinham `description`. Opcional (`null`
        // se o template não definir), então os ~42 templates já
        // existentes continuam funcionando idênticos; só os itens novos
        // desta iteração (e futuras) preenchem isto. Exibido no tooltip
        // (ver ui.js attachTooltip) igual à descrição de consumível.
        this.description = baseTemplate.description || null;
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

        // Rework de Renderização de Armas, Iteração 2 — bug pego pelo próprio
        // teste automatizado desta iteração: `twoHanded` (ver items.js
        // w_16/w_22/w_25/w_27) nunca era copiado do template pro item de
        // verdade, então `_drawBackArm` (graphics.js) — que lê
        // `mainHandWeapon.twoHanded` pra suprimir o escudo — nunca via o
        // campo, e a supressão de escudo em armas de duas mãos era código
        // morto. Puramente visual, igual `region` acima: nunca afeta
        // equipar/dano/alcance.
        this.twoHanded = !!baseTemplate.twoHanded;

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

        // Rework da Taverna item 1/3: categoria de aba (health/mana/
        // bandage/food/drink) — só usada pra filtrar as 5 abas da Taverna
        // (ver ui.js renderConsumableShop); consumíveis de outras sub-lojas
        // (Câmara Rúnica/Círculo de Treinamento/Ateliê Élfico, subShop !==
        // 'tavern') nunca aparecem na Taverna, então ficam sem categoria —
        // undefined nunca quebra nada, só significa "não filtra em
        // nenhuma aba".
        this.consumableCategory = baseTemplate.consumableCategory;

        // Rework da Taverna item 4/5/6/15: campos novos das bandagens
        // (`outOfCombatOnly`, ver Player.useConsumable) e de Comida/Bebida
        // (`durationBattles`/`foodSlot`/`secondaryStatKey`/
        // `secondaryAmount`, ver mesmo lugar) — mesma classe Consumable de
        // sempre, sem criar um segundo tipo de item só pra essas duas
        // categorias novas.
        this.outOfCombatOnly = baseTemplate.outOfCombatOnly;
        this.durationBattles = baseTemplate.durationBattles;
        this.foodSlot = baseTemplate.foodSlot;
        this.secondaryStatKey = baseTemplate.secondaryStatKey;
        this.secondaryAmount = baseTemplate.secondaryAmount;
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
        // MEGA REWORK Econômico Iteração 9 (item 10/15 da diretiva):
        // achado de auditoria — a Iteração 5 só corrigiu a duplicação de
        // "arma pesada + armorPierce" (idêntica em FORMA ao Martelo/
        // Machado anão, só números trocados) nas 2 armas orcs NOVAS
        // (Corrente Espinhada/Machado Ósseo). Estas 2 originais ficaram
        // pra trás com a fórmula antiga sem nenhuma imprecisão — metade
        // do arsenal orc continuava mecanicamente idêntica em ESPÉCIE à
        // anã. accBonus negativo (menor que as especialistas, pra
        // continuar viável cedo no jogo) fecha a identidade em 100% das
        // armas orcs, não só 50%.
        orcwaraxe: { id: 'w_11', name: "Machado de Guerra Orc", slot: SLOTS.MAIN_HAND, damage: 16, weight: 7.0, value: 140, durability: 110, stats: { str: 5 }, armorPierce: 0.20, accBonus: -2, region: 'fortaleza_orc',
            minRange: 0, maxRange: 2, atkSpeed: 0.55, approachSpeed: 1.1, retreatSpeed: 1.1 },
        // Bug de auditoria corrigido (Rework Econômico item 15): item de
        // nome/tema explicitamente anão estava com `region: 'fortaleza_orc'`
        // — provavelmente um resquício de antes de o Reino Anão existir
        // como cidade própria. Também é o único produto de receita
        // exclusiva da Forja (ver forge.js RECIPES), então o bug escondia
        // o item da loja da própria cidade que o forja.
        dwarvenhammer: { id: 'w_12', name: "Martelo Rúnico Anão", slot: SLOTS.MAIN_HAND, damage: 15, weight: 6.0, value: 170, durability: 160, stats: { str: 2, def: 1 }, armorPierce: 0.25, region: 'reino_anao',
            minRange: 0, maxRange: 2, atkSpeed: 0.65, approachSpeed: 1.3, retreatSpeed: 1.3 },
        // craftOnly (MEGA REWORK econômico, Iteração 3 — Ateliê Élfico):
        // estes 6 itens élficos (ver também elvenwindspear/elvencloak/
        // livingforestring/elderwoodamulet abaixo) DEIXAM de aparecer no
        // sorteio genérico de loja (ver items.js _pickRandomEquipmentId) e
        // só podem ser obtidos criando-os no Ateliê (ver js/elfcrafting.js)
        // — produtos exclusivos de verdade (item 13 do pedido: "não podem
        // ser obtidos normalmente nas outras cidades", aqui levado a sério
        // até DENTRO da própria cidade élfica: nem lá se compram prontos).
        elvenblade: { id: 'w_13', name: "Lâmina Élfica", slot: SLOTS.MAIN_HAND, damage: 9, weight: 1.2, value: 150, durability: 100, stats: { agi: 3, acc: 1 }, critBonus: 18, region: 'santuario_elfico', craftOnly: true,
            minRange: 0, maxRange: 3, atkSpeed: 1.5, approachSpeed: 2.4, retreatSpeed: 2.4 },
        elvenlongbow: { id: 'w_14', name: "Arco Élfico Longo", slot: SLOTS.RANGED, damage: 11, weight: 1.5, value: 160, durability: 90, stats: { agi: 2, acc: 3 }, region: 'santuario_elfico', craftOnly: true,
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
        // `twoHanded` (Rework de Renderização de Armas, Iteração 2) — só um
        // campo VISUAL: js/graphics.js _drawBackArm lê isso pra nunca
        // desenhar um escudo simultâneo a uma arma pesada de duas mãos
        // (bug de clipping/incoerência visual encontrado na auditoria —
        // nada na lógica de equipar impedia as duas coisas ao mesmo
        // tempo). Nunca toca em dano/alcance/regras de equipar — só
        // decide "mostra ou não mostra o escudo desenhado".
        dwarvengreataxe: { id: 'w_16', name: "Machado de Guerra de Kharzum", slot: SLOTS.MAIN_HAND, damage: 20, weight: 9.0, value: 250, durability: 190, stats: { str: 6 }, armorPierce: 0.35, region: 'reino_anao', twoHanded: true,
            minRange: 0, maxRange: 2, atkSpeed: 0.5, approachSpeed: 1.0, retreatSpeed: 1.0 },

        // --- Mega Atualização item 1/2/19: expansão do arsenal — Lanças ---
        // Categoria mais fraca do jogo antes desta iteração (só 1 template,
        // `spear` acima). As 5 novas nunca são só o mesmo número reescalado
        // — cada uma varia um eixo mecânico DIFERENTE em cima da identidade
        // comum de lança (alcance maior que a média): velocidade,
        // profundidade de alcance, perfuração, crítico ou combinação de
        // atributo. `description` é NOVO neste tipo de item (ver Equipment
        // acima) — nenhuma arma anterior a esta tinha texto de identidade
        // próprio, só a ficha de status genérica do tooltip.
        huntingspear: { id: 'w_17', name: "Lança de Caça", slot: SLOTS.MAIN_HAND, damage: 7, weight: 2.0, value: 45, durability: 80, stats: { agi: 1, acc: 1 }, accBonus: 5,
            description: "Arma leve de batedores, feita pra abater presas em movimento antes que cheguem perto — rápida, mas sem força pra atravessar armadura de verdade.",
            minRange: 1, maxRange: 4, atkSpeed: 1.15, approachSpeed: 2.3, retreatSpeed: 2.4 },
        phalanxpike: { id: 'w_18', name: "Pique de Falange", slot: SLOTS.MAIN_HAND, damage: 11, weight: 5.5, value: 120, durability: 130, stats: { str: 3, def: 1 }, armorPierce: 0.15,
            description: "Longa demais pra ser rápida — pensada pra manter o inimigo a distância antes que ele chegue perto o bastante pra revidar. O maior alcance entre todas as armas corpo a corpo do jogo.",
            minRange: 3, maxRange: 7, atkSpeed: 0.6, approachSpeed: 1.3, retreatSpeed: 1.5 },
        trident: { id: 'w_19', name: "Tridente das Marés", slot: SLOTS.MAIN_HAND, damage: 10, weight: 3.5, value: 100, durability: 100, stats: { agi: 2, acc: 1 }, critBonus: 12,
            description: "Três pontas em vez de uma — mais chance de encontrar uma brecha na guarda do adversário a cada golpe certeiro.",
            minRange: 2, maxRange: 5, atkSpeed: 0.85, approachSpeed: 1.7, retreatSpeed: 2.0 },
        // Regional Orc (ver citydatabase.js fortaleza_orc) — identidade
        // "força bruta" da cidade também na categoria lança, não só em
        // machados/martelos.
        orctrollspear: { id: 'w_20', name: "Lança Caça-Trolls", slot: SLOTS.MAIN_HAND, damage: 15, weight: 6.0, value: 160, durability: 140, stats: { str: 5 }, armorPierce: 0.25, accBonus: -2, region: 'fortaleza_orc',
            description: "Forjada pra atravessar o couro grosso de trolls das montanhas — mais curta que um pique de falange, mas capaz de perfurar quase qualquer coisa que respire.",
            minRange: 2, maxRange: 5, atkSpeed: 0.7, approachSpeed: 1.4, retreatSpeed: 1.6 },
        // MEGA REWORK Econômico Iteração 5 (item 4 da diretiva: "armas Orc
        // devem parecer... assimétricas... improvisadas... com correntes...
        // com ossos"). Achado da auditoria: até aqui a Fortaleza Orc só
        // tinha 2 armas próprias (machado/lança), ambas usando a MESMA
        // fórmula "peso alto + armorPierce alto" do Martelo Rúnico Anão —
        // pesadas, sim, mas mecanicamente indistinguíveis de uma arma anã
        // com número trocado. As duas abaixo introduzem uma combinação que
        // NENHUMA outra cultura usa: `accBonus` NEGATIVO (precisão nunca
        // é o ponto — golpe selvagem, cru, improvisado — ver battle.js
        // executeAttack, que já clampa hitChance em 20%-100%, então nunca
        // trava o combate, só torna a arma genuinamente mais difícil de
        // acertar). Isso é o oposto do Anão (armorPierce = perícia técnica
        // de metalurgia) — aqui é FORÇA BRUTA sem refinamento nenhum.
        orcwarchain: { id: 'w_26', name: "Corrente Espinhada", slot: SLOTS.MAIN_HAND, damage: 13, weight: 5.5, value: 120, durability: 90, stats: { str: 3 }, critBonus: 20, accBonus: -4, region: 'fortaleza_orc',
            description: "Elos de ferro reaproveitados de correntes de prisioneiro, com farpas amarradas na ponta — impossível controlar onde exatamente vai acertar, mas quando acerta, estraçalha. Golpe selvagem: alta chance de crítico, baixa precisão.",
            minRange: 1, maxRange: 3, atkSpeed: 0.65, approachSpeed: 1.3, retreatSpeed: 1.3 },
        orcboneaxe: { id: 'w_27', name: "Machado Ósseo Ancestral", slot: SLOTS.MAIN_HAND, damage: 18, weight: 9.5, value: 145, durability: 100, stats: { str: 6 }, armorPierce: 0.30, accBonus: -3, region: 'fortaleza_orc', twoHanded: true,
            description: "Lâmina de pedra vulcânica presa a um cabo de osso de fera — mais pesado que qualquer machado forjado em metal, sem nenhum refinamento de balanço. Bruto demais pra mirar direito, forte demais pra importar.",
            minRange: 0, maxRange: 2, atkSpeed: 0.5, approachSpeed: 1.0, retreatSpeed: 1.0 },
        // Regional Élfico (ver citydatabase.js santuario_elfico) — reforça
        // "leve e preciso" também numa arma de haste, não só em arcos/
        // lâminas.
        elvenwindspear: { id: 'w_21', name: "Lança dos Ventos Élfica", slot: SLOTS.MAIN_HAND, damage: 9, weight: 1.8, value: 155, durability: 95, stats: { agi: 4, acc: 2 }, critBonus: 10, region: 'santuario_elfico', craftOnly: true,
            description: "Talhada em madeira viva do Santuário — tão leve que mal atrasa o golpe seguinte, com alcance que nenhuma outra lança do jogo alcança.",
            minRange: 2, maxRange: 6, atkSpeed: 1.2, approachSpeed: 2.4, retreatSpeed: 2.6 },

        // Item 23 da mega-diretiva Arena+Estilos — armas de identidade
        // própria de Boss Especial da Arena (ver enemy.js ARENA_BOSS_DEFS/
        // createArenaBoss), nunca sorteadas em loja/loot genérico
        // (`arenaExclusive: true`, ver _pickRandomEquipmentId acima). Cada
        // uma é uma versão nomeada e mais forte da arma genérica que o
        // boss já usava, nunca um reescalonamento reto do mesmo número —
        // Grokmar troca perfuração de armadura por dano bruto ainda maior
        // (tema "fúria", quanto mais golpes recebe mais forte fica, então
        // a arma reforça o lado ofensivo puro), Nyxara troca crítico bom
        // por crítico devastador + velocidade ainda maior (tema "furtiva,
        // pontual, decisiva").
        grokmaraxe: { id: 'w_22', name: "Machado de Grokmar", slot: SLOTS.MAIN_HAND, damage: 22, weight: 7.5, value: 320, durability: 150, stats: { str: 7 }, armorPierce: 0.20, critBonus: 8, arenaExclusive: true, twoHanded: true,
            description: "A arma que Grokmar ergueu quando sua fúria despertou pela primeira vez — cada golpe carrega o peso de tudo que ele já sobreviveu na Arena.",
            minRange: 0, maxRange: 2, atkSpeed: 0.55, approachSpeed: 1.1, retreatSpeed: 1.1 },
        nyxaradagger: { id: 'w_23', name: "Adaga de Nyxara", slot: SLOTS.MAIN_HAND, damage: 8, weight: 0.9, value: 320, durability: 130, stats: { agi: 4 }, critBonus: 26, arenaExclusive: true,
            description: "Forjada nas sombras do Manto que a protege — quem a vê chegar já foi atingido. Mais rápida e mais certeira que qualquer adaga comum.",
            minRange: 0, maxRange: 1, atkSpeed: 1.6, approachSpeed: 2.7, retreatSpeed: 2.7 },
        // Sylwyn, Arqueira da Lua Cheia (Iteração 17, ver enemy.js
        // ARENA_BOSS_DEFS.sylwyn_lua) — troca a precisão bruta do Arco
        // Élfico Longo por crítico ainda mais alto, coerente com o pico
        // de crítico da própria mecânica de Ciclo Lunar dela.
        sylwynbow: { id: 'w_24', name: "Arco da Lua Cheia", slot: SLOTS.RANGED, damage: 13, weight: 1.6, value: 320, durability: 100, stats: { agi: 3, acc: 2 }, critBonus: 20, arenaExclusive: true,
            description: "Talhado sob o brilho da lua cheia, canta baixinho quando a mira está perfeita — dizem que nunca erra sob o céu noturno.",
            minRange: 0, maxRange: 10, atkSpeed: 1.1, approachSpeed: 1.0, retreatSpeed: 2.6, maxAmmo: 10 },
        // Brakka Fundefogo, Mestra da Forja (Iteração 18, ver enemy.js
        // ARENA_BOSS_DEFS.brakka_forja) — versão nomeada e ainda mais
        // pesada do Martelo Rúnico Anão, com perfuração maior que a
        // maioria das armas do jogo — coerente com a própria mecânica
        // dela (golpes que "perfuram" mais quanto mais tempero a forja
        // recebeu).
        brakkahammer: { id: 'w_25', name: "Martelo da Forja Eterna", slot: SLOTS.MAIN_HAND, damage: 19, weight: 7.0, value: 320, durability: 180, stats: { str: 4, def: 2 }, armorPierce: 0.30, arenaExclusive: true, twoHanded: true,
            description: "Forjado e reforjado tantas vezes na fornalha de Brakka que já nem parece ferro comum — cada golpe carrega o calor de mil temperagens.",
            minRange: 0, maxRange: 2, atkSpeed: 0.6, approachSpeed: 1.2, retreatSpeed: 1.2 }
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
        elvencloak: { id: 'a_13', name: "Manto Élfico", slot: SLOTS.CHEST, defense: 6, weight: 1.2, value: 140, durability: 90, stats: { agi: 2, int: 1 }, region: 'santuario_elfico', craftOnly: true }
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
        livingforestring: { id: 't_06', name: "Anel da Floresta Viva", slot: SLOTS.RING, weight: 0.1, value: 150, durability: 999, stats: { int: 2 }, mpBonus: 20, region: 'santuario_elfico', craftOnly: true },
        // Item 11 da auditoria de balanceamento ("catálogo de itens
        // exclusivo por cidade"): bug de auditoria encontrado — o Santuário
        // Élfico já tinha arma/arco/capa/anel regionais, mas NENHUM amuleto
        // (só um anel), apesar do pedido original listar "amuletos"
        // explicitamente como categoria própria da Cidade Élfica (junto de
        // arcos/capas/armaduras leves, todos já cobertos). Fortaleza Orc já
        // tinha seu amuleto (Presa de Troll) desde o trabalho original das
        // Cidades-Hub Regionais — o Santuário ficou com essa lacuna.
        elderwoodamulet: { id: 't_07', name: "Amuleto da Seiva Ancestral", slot: SLOTS.AMULET, weight: 0.2, value: 150, durability: 999, stats: { int: 1 }, hpBonus: 20, mpBonus: 25, region: 'santuario_elfico', craftOnly: true },

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
        magmacoreamulet: { id: 't_09', name: "Amuleto do Núcleo de Magma", slot: SLOTS.AMULET, weight: 0.3, value: 210, durability: 999, stats: { def: 2 }, hpBonus: 30, region: 'reino_anao' },

        // Item 23 da mega-diretiva Arena+Estilos — troféu de identidade
        // própria, concedido EXCLUSIVAMENTE por concluir a Arena dos
        // Campeões inteira (5 etapas, ver enemy.js CHAMPIONS_ARENA_STAGES
        // e ui.js _advanceChampionsArena), nunca sorteado em loja/loot
        // genérico (`arenaExclusive: true`). Estatística combinada
        // (força+agilidade+precisão+vida+mana) reflete o próprio desafio
        // que testa TODOS os estilos de combate aprendidos nas ligas —
        // não é um upgrade estritamente melhor que qualquer amuleto
        // regional, é a prova física de ter vencido o modo endgame.
        crownofchampions: { id: 't_10', name: "Coroa dos Campeões", slot: SLOTS.AMULET, weight: 0.4, value: 500, durability: 999, stats: { str: 2, agi: 2, acc: 2 }, hpBonus: 40, mpBonus: 30, arenaExclusive: true,
            description: "Só quem já enfrentou o melhor de cada liga — e ainda assim seguiu andando — tem o direito de usá-la." }
    },
    consumables: {
        health_potion: { id: 'c_01', name: "Poção de Vida", type: 'HEAL_HP', power: 40, value: 25, description: "Restaura 40 de HP.", consumableCategory: 'health' },
        greater_health_potion: { id: 'c_02', name: "Poção de Vida Maior", type: 'HEAL_HP', power: 90, value: 55, description: "Restaura 90 de HP.", consumableCategory: 'health' },
        mana_potion: { id: 'c_03', name: "Poção de Mana", type: 'HEAL_MP', power: 25, value: 30, description: "Restaura 25 de MP.", consumableCategory: 'mana' },
        // Rework da Taverna item 4: bandagem deixou de curar fadiga (agora
        // é só o Curandeiro/hospedagem paga OU Carne Defumada anã, ver
        // subShop:'tavern' abaixo — nenhuma outra mudança nessas duas
        // fontes) e virou recuperação de HP FORA DE COMBATE. `outOfCombatOnly:
        // true` é lido em Player.useConsumable (player.js) — bloqueia o uso
        // durante batalha E remove o bônus de healPowerBonusPercent que
        // poções recebem (a cura é sempre o valor cru do `power`, nunca
        // escala com Linhagem/atributo). ui.js openBattleItemMenu também
        // filtra esses itens da lista de "Usar Item" durante o combate, pra
        // nem aparecerem como opção lá. 3 variedades progressivas — preço
        // por HP deliberadamente MENOR que o das poções (poção "vale mais"
        // por poder ser usada em combate e escalar com Linhagem; bandagem é
        // a opção econômica de recuperação entre lutas, nunca substitui a
        // poção — ver item 4 da diretiva: "não deve substituir as poções").
        bandage: { id: 'c_04', name: "Bandagem Simples", type: 'HEAL_HP', power: 150, outOfCombatOnly: true, value: 45, description: "Recupera 150 HP. Só pode ser usada fora de combate — não recebe bônus de atributos.", consumableCategory: 'bandage' },
        reinforced_bandage: { id: 'c_16', name: "Bandagem Reforçada", type: 'HEAL_HP', power: 300, outOfCombatOnly: true, value: 85, description: "Recupera 300 HP. Só pode ser usada fora de combate — não recebe bônus de atributos.", consumableCategory: 'bandage' },
        medicinal_bandage: { id: 'c_17', name: "Bandagem Medicinal", type: 'HEAL_HP', power: 500, outOfCombatOnly: true, value: 130, description: "Recupera 500 HP. Só pode ser usada fora de combate — não recebe bônus de atributos.", consumableCategory: 'bandage' },

        // Rework da Taverna item 5/6: Comida e Bebida do pool NEUTRO (Porto
        // Helênico — "variedade equilibrada", item 7 da diretiva). NUNCA
        // fome/sede — cada item é um bônus temporário OPCIONAL, reaproveita
        // 100% o mecanismo TEMP_BUFF já existente (statKey/buffAmount,
        // mesmo formato dos passivos de raça/mutação), só com
        // `durationBattles` (em vez de `durationDays`) e `foodSlot`
        // ('food'/'drink', ver Player.useConsumable — limite de 1 efeito
        // de cada por vez). Nunca "cura HP disfarçada" — cada um usa um
        // eixo mecânico diferente dos outros.
        bread: { id: 'c_18', name: "Pão de Taverna", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 2, durationBattles: 2, foodSlot: 'food', value: 15, description: "Simples e barato — não é muita coisa, mas ajuda antes de uma luta. +2 de dano físico por 2 batalhas.", consumableCategory: 'food' },
        roasted_meat: { id: 'c_19', name: "Carne Assada", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 5, durationBattles: 3, foodSlot: 'food', value: 45, description: "Carne assada na brasa — força extra pra quem precisa bater mais forte. +5 de dano físico por 3 batalhas.", consumableCategory: 'food' },
        ale: { id: 'c_20', name: "Cerveja", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 4, secondaryStatKey: 'dodgeBonusPercent', secondaryAmount: -3, durationBattles: 2, foodSlot: 'drink', value: 30, description: "Braço mais pesado, reflexos mais lentos. +4 de dano físico, -3% de esquiva, por 2 batalhas.", consumableCategory: 'drink' },
        wine: { id: 'c_21', name: "Vinho", type: 'TEMP_BUFF', statKey: 'dodgeBonusPercent', buffAmount: 4, durationBattles: 2, foodSlot: 'drink', value: 35, description: "A confiança de uma boa taça acalma os nervos antes da arena. +4% de esquiva por 2 batalhas.", consumableCategory: 'drink' },

        // --- Identidade do Reino Anão (Rework Econômico item 8/9) ---
        // `region`+`subShop` combinados (ver ItemFactory.getConsumableStock
        // abaixo) fazem esses itens SUBSTITUÍREM — nunca somarem a — o pool
        // genérico acima nas sub-lojas da Taverna/Câmara Rúnica anãs. Nunca
        // aparecem em nenhuma outra cidade nem no Mercado geral/Mercador
        // Viajante. Efeitos TEMPORÁRIOS (TEMP_BUFF) usam o mesmo formato
        // statKey/amount dos passivos de raça/mutação (ver
        // player.js calculateDerivedStats) — nunca escalam com atributo
        // nenhum, exatamente como runas/hidromel deveriam funcionar.
        // Rework da Taverna item 15: convertidos de duração por DIA pra
        // duração por BATALHA (`durationBattles`, ver Player.useConsumable)
        // — a diretiva pede consistência entre TODA Comida/Bebida nesse
        // eixo ("sempre que possível... por número de batalhas"), e
        // ganharam `foodSlot` pra entrar no limite de 1 comida + 1 bebida
        // (item 15). Nenhuma outra mudança de efeito/preço.
        mead_strong: { id: 'c_05', name: "Hidromel Forte", type: 'TEMP_BUFF', statKey: 'defenseBonusPercent', buffAmount: 8, durationBattles: 2, foodSlot: 'drink', value: 45, description: "Bebida forte de Kharzum. +8% de resistência por 2 batalhas.", region: 'reino_anao', subShop: 'tavern', consumableCategory: 'drink' },
        dwarven_feast: { id: 'c_06', name: "Banquete Anão", type: 'TEMP_BUFF', statKey: 'defenseRatingFlat', buffAmount: 6, durationBattles: 3, foodSlot: 'food', value: 70, description: "Um banquete de verdade, não uma refeição rápida. +6 de defesa por 3 batalhas.", region: 'reino_anao', subShop: 'tavern', consumableCategory: 'food' },
        smoked_meat: { id: 'c_07', name: "Carne Defumada", type: 'CURE_FATIGUE', power: 1, value: 35, description: "Prato robusto anão de viagem. Cura 1 nível de fadiga.", region: 'reino_anao', subShop: 'tavern', consumableCategory: 'food' },
        // MEGA REWORK Econômico Iteração 4: essas duas runas NÃO têm mais
        // `subShop` — não são mais vendidas em loja nenhuma (a antiga
        // "Câmara Rúnica" foi transformada, ver citydatabase.js
        // reino_anao). Agora só existem via ForgeSystem.RUNE_RECIPES
        // (js/forge.js) — gravadas na Forja com minério, nunca compradas
        // de uma lista.
        rune_protection: { id: 'c_08', name: "Runa de Proteção", type: 'TEMP_BUFF', statKey: 'defenseBonusPercent', buffAmount: 15, durationDays: 1, value: 95, description: "Runa anã de efeito fixo, gravada por artesãos — não depende de Inteligência. +15% de resistência por 1 dia.", region: 'reino_anao' },
        rune_strength: { id: 'c_09', name: "Runa de Força", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 5, durationDays: 1, value: 95, description: "Runa anã de efeito fixo, gravada por artesãos — não depende de Inteligência. +5 de dano físico por 1 dia.", region: 'reino_anao' },

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

        // Rework da Taverna item 5/6/7: até esta iteração, a Taverna do
        // Santuário Élfico vendia a mesma Poção de Vida/Mana genérica de
        // qualquer cidade (achado da auditoria da Iteração 1) — Poeira de
        // Estrelas/Cristal de Clareza acima são do Ateliê Élfico, um prédio
        // DIFERENTE, nunca aparecem na Taverna em si. Os dois abaixo (
        // subShop:'tavern') fecham essa lacuna com tema natureza/magia,
        // nunca copiando o tema físico/forja do Reino Anão.
        elf_herb_bread: { id: 'c_22', name: "Pão de Ervas Élfico", type: 'TEMP_BUFF', statKey: 'maxMpFlat', buffAmount: 20, durationBattles: 3, foodSlot: 'food', value: 50, description: "Pão leve assado com ervas do Santuário — a mente clareia, a mana flui mais fácil. +20 de MP máximo por 3 batalhas.", region: 'santuario_elfico', subShop: 'tavern', consumableCategory: 'food' },
        elf_moon_tea: { id: 'c_23', name: "Chá da Lua Élfica", type: 'TEMP_BUFF', statKey: 'healPowerBonusPercent', buffAmount: 10, durationBattles: 2, foodSlot: 'drink', value: 55, description: "Infusão colhida sob a lua cheia — fortalece qualquer cura que vier depois. +10% de poder de cura por 2 batalhas.", region: 'santuario_elfico', subShop: 'tavern', consumableCategory: 'drink' },

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
        orc_wild_stimulant: { id: 'c_15', name: "Estimulante Selvagem", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 9, durationDays: 1, riskFatigueChance: 40, riskFatigueAmount: 1, value: 70, description: "Extrato natural bruto, sem diluição — +9 de dano físico por 1 dia, mas 40% de chance de sobrecarregar o corpo (+1 nível de fadiga). Uso pesado: risco real.", region: 'fortaleza_orc', subShop: 'training' },

        // Rework da Taverna item 5/6/7: mesma lacuna do Santuário Élfico
        // acima — o Círculo de Treinamento (subShop:'training', itens
        // acima) é um prédio DIFERENTE da Taverna Orc, que até esta
        // iteração vendia a mesma Poção de Vida/Mana genérica. Os dois
        // abaixo (subShop:'tavern') dão à Taverna Orc identidade própria:
        // comida extremamente nutritiva, bebida muito mais forte que
        // qualquer outra do jogo (maior bônus E maior penalidade), tema
        // físico/treinamento — nunca copiando o Reino Anão.
        orc_boar_meat: { id: 'c_24', name: "Carne de Javali", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 6, durationBattles: 3, foodSlot: 'food', value: 50, description: "Prato pesado dos guerreiros de Gorkhal — comida de verdade, não petisco. +6 de dano físico por 3 batalhas.", region: 'fortaleza_orc', subShop: 'tavern', consumableCategory: 'food' },
        orc_black_ale: { id: 'c_25', name: "Cerveja Negra Orc", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 8, secondaryStatKey: 'dodgeBonusPercent', secondaryAmount: -4, durationBattles: 2, foodSlot: 'drink', value: 55, description: "A bebida mais forte da Fortaleza — pesa o braço, atrasa os reflexos, mas ninguém nega o golpe. +8 de dano físico, -4% de esquiva, por 2 batalhas.", region: 'fortaleza_orc', subShop: 'tavern', consumableCategory: 'drink' }
    },

    // Rework da Taverna item 15: "Especialidades da Casa" — produtos
    // EXCLUSIVOS e ROTATIVOS de cada Taverna, nunca disponíveis o tempo
    // todo (ver ItemFactory.getHouseSpecialties/ui.js openShop pra como o
    // reroll diário funciona). Mesma classe Consumable/mesmo mecanismo
    // TEMP_BUFF de items.js consumables acima — NUNCA um sistema de item
    // paralelo, só um registry SEPARADO porque estes não fazem parte do
    // estoque fixo (region+subShop:'tavern' de `consumables` acima sempre
    // está disponível; estes aqui entram e saem). `specialtyWeight` decide
    // a chance relativa de aparecer no reroll — comuns (peso alto) vs raros
    // (peso baixo, efeito mais forte, preço maior), nunca um efeito potente
    // custando pouco (item 15 da diretiva: "preço deve considerar força do
    // efeito... nunca deixar produtos poderosos custarem valores
    // insignificantes"). Cada cidade tem só as SUAS próprias — nunca cópias
    // com nome trocado entre cidades.
    houseSpecialties: {
        porto_helenico: {
            traveler_stew: { id: 'hs_01', name: "Guisado do Viajante", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 3, durationBattles: 2, foodSlot: 'food', consumableCategory: 'food', specialtyWeight: 60, value: 55, description: "Receita comum de qualquer taberna do porto — nada extraordinário, mas sempre disponível." },
            house_wine: { id: 'hs_02', name: "Vinho da Casa", type: 'TEMP_BUFF', statKey: 'dodgeBonusPercent', buffAmount: 5, durationBattles: 2, foodSlot: 'drink', consumableCategory: 'drink', specialtyWeight: 55, value: 50, description: "A garrafa que o taberneiro guarda pra fregueses de confiança." }
        },
        fortaleza_orc: {
            black_boar_meat: { id: 'hs_03', name: "Carne de Javali Negro", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 7, durationBattles: 3, foodSlot: 'food', consumableCategory: 'food', specialtyWeight: 35, value: 90, description: "Só os caçadores mais experientes da Fortaleza voltam com um javali negro inteiro. +7 de dano físico por 3 batalhas.", region: 'fortaleza_orc' },
            iron_fist_brew: { id: 'hs_04', name: "Punho de Ferro", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 10, secondaryStatKey: 'dodgeBonusPercent', secondaryAmount: -5, durationBattles: 2, foodSlot: 'drink', consumableCategory: 'drink', specialtyWeight: 18, value: 130, description: "Destilado reservado pros campeões do Fosso de Guerra — a bebida mais forte que existe. +10 de dano físico, -5% de esquiva, por 2 batalhas.", region: 'fortaleza_orc' }
        },
        santuario_elfico: {
            full_moon_infusion: { id: 'hs_05', name: "Infusão da Lua Cheia", type: 'TEMP_BUFF', statKey: 'healPowerBonusPercent', buffAmount: 15, durationBattles: 2, foodSlot: 'drink', consumableCategory: 'drink', specialtyWeight: 35, value: 95, description: "Colhida uma vez por mês, sob a lua cheia sobre o Santuário. +15% de poder de cura por 2 batalhas.", region: 'santuario_elfico' },
            ancestral_sap_fruit: { id: 'hs_06', name: "Fruta da Seiva Ancestral", type: 'TEMP_BUFF', statKey: 'maxMpFlat', buffAmount: 30, secondaryStatKey: 'healPowerBonusPercent', secondaryAmount: 8, durationBattles: 3, foodSlot: 'food', consumableCategory: 'food', specialtyWeight: 15, value: 140, description: "Fruta rara das árvores mais antigas do Santuário — poucas nascem por ano. +30 de MP máximo e +8% de poder de cura por 3 batalhas.", region: 'santuario_elfico' }
        },
        reino_anao: {
            iron_stew: { id: 'hs_07', name: "Ensopado de Ferro", type: 'TEMP_BUFF', statKey: 'defenseRatingFlat', buffAmount: 10, durationBattles: 3, foodSlot: 'food', consumableCategory: 'food', specialtyWeight: 35, value: 100, description: "Cozido lento nas forjas comunais de Kharzum — pesado o bastante pra grudar nas costelas. +10 de defesa por 3 batalhas.", region: 'reino_anao' },
            black_mead: { id: 'hs_08', name: "Hidromel Negro Anão", type: 'TEMP_BUFF', statKey: 'physicalDamageFlat', buffAmount: 6, secondaryStatKey: 'dodgeBonusPercent', secondaryAmount: -2, durationBattles: 2, foodSlot: 'drink', consumableCategory: 'drink', specialtyWeight: 15, value: 120, description: "Envelhecido em barris de adamante — só sai das adegas mais fundas do Reino em ocasiões raras. +6 de dano físico, -2% de esquiva, por 2 batalhas.", region: 'reino_anao' }
        }
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
    },
    // Essências do Santuário Élfico (MEGA REWORK econômico, Iteração 3 — ver
    // citydatabase.js santuario_elfico/city.js essenceSpots) — a base do
    // Ateliê Élfico (ver js/elfcrafting.js), mesma filosofia de
    // "quantidade pequena, cada uma com função real" já usada pelos 6
    // materiais anões acima. Categoria SEPARADA de `materials` (nunca a
    // mesma classe/campo `category`) de propósito: a Forja só lê itens com
    // `category === 'material'` da mochila (ver ui.js openForge) — se
    // Essência usasse a mesma categoria, apareceria (inutilmente) dentro da
    // tela de Forja do Reino Anão, misturando as duas identidades culturais
    // que o pedido explicitamente quer distintas.
    essences: {
        wild_essence: { id: 'e_01', name: "Essência Selvagem", tier: 1, value: 12, description: "Energia bruta da mata em volta do Santuário — a essência mais comum, ainda assim viva." },
        lunar_essence: { id: 'e_02', name: "Essência Lunar", tier: 2, value: 35, description: "Só se condensa em clareiras iluminadas pela lua cheia — fria ao toque, quase cantando." },
        ancestral_essence: { id: 'e_03', name: "Essência Ancestral", tier: 3, value: 90, description: "Extraída das raízes mais antigas do Santuário — dizem que carrega memória própria." }
    },
    // MEGA REWORK Econômico, Iteração 9 (item 7 da diretiva): "Elfos podem
    // ser os principais criadores de runas... Runa Ígnea/Glacial/Vital/
    // Precisão/Arcana... objetos de criação/personalização, NUNCA outra
    // loja de magia". Deliberadamente NÃO reaproveita ENCHANTMENTS (ver
    // js/enchantments.js) — um Encantamento é um efeito de PROC trocável
    // livremente por ouro puro; uma Runa é uma gravação PERMANENTE,
    // cumulativa (até 2 por peça, ver js/runes.js RuneSystem), consumida
    // ao usar, só obtida por criação no Ateliê (nunca comprada pronta).
    // Isso as torna mecanicamente DISTINTAS de Encantamentos, não uma
    // segunda versão do mesmo sistema (item 11 da diretiva). `appliesTo`
    // ('weapon'/'armor'/'any') e `statKey`/`amount` mutam um campo já
    // suportado pela classe Equipment (critBonus/defense/hpBonus/
    // accBonus/mpBonus) — nenhuma mudança em battle.js foi necessária.
    runes: {
        rune_ignea: { id: 'r_01', name: "Runa Ígnea", appliesTo: 'weapon', statKey: 'critBonus', amount: 4, value: 70, region: 'santuario_elfico', description: "Gravada com fogo élfico — +4% de Crítico permanente. Só aplicável em armas." },
        rune_glacial: { id: 'r_02', name: "Runa Glacial", appliesTo: 'armor', statKey: 'defense', amount: 3, value: 70, region: 'santuario_elfico', description: "Gravada com gelo élfico — +3 de Defesa permanente. Só aplicável em armaduras." },
        rune_vital: { id: 'r_03', name: "Runa Vital", appliesTo: 'any', statKey: 'hpBonus', amount: 15, value: 85, region: 'santuario_elfico', description: "Gravada com a força vital da floresta — +15 de HP Máximo permanente." },
        rune_precisao: { id: 'r_04', name: "Runa de Precisão", appliesTo: 'weapon', statKey: 'accBonus', amount: 3, value: 85, region: 'santuario_elfico', description: "Gravada com precisão élfica — +3 de Precisão permanente. Só aplicável em armas." },
        rune_arcana: { id: 'r_05', name: "Runa Arcana", appliesTo: 'any', statKey: 'mpBonus', amount: 12, value: 90, region: 'santuario_elfico', description: "Gravada com energia arcana — +12 de MP Máximo permanente." }
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

// Essências do Santuário Élfico (ver ItemDatabase.essences acima) — MESMA
// forma que Material (tier/value/description, sem slot/raridade própria),
// só `category` diferente ('essence', nunca 'material') pra nunca se
// misturar com a mochila de matéria-prima que a Forja anã lê.
class Essence {
    constructor(baseTemplate) {
        this.category = 'essence';
        this.uuid = Utils.generateUUID();
        this.id = baseTemplate.id;
        this.name = baseTemplate.name;
        this.tier = baseTemplate.tier;
        this.value = baseTemplate.value;
        this.description = baseTemplate.description;
        this.rarity = RARITY.COMMON;
    }
}

// Runas do Santuário Élfico (ver ItemDatabase.runes acima) — sem slot/tier
// próprio (nunca equipável sozinha, sem quality de Forja); `appliesTo`/
// `statKey`/`amount` são o que js/runes.js RuneSystem.apply() lê pra
// gravar permanentemente num item de equipamento já existente.
class Rune {
    constructor(baseTemplate) {
        this.category = 'rune';
        this.uuid = Utils.generateUUID();
        this.id = baseTemplate.id;
        this.name = baseTemplate.name;
        this.appliesTo = baseTemplate.appliesTo;
        this.statKey = baseTemplate.statKey;
        this.amount = baseTemplate.amount;
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

    // Mega Atualização item 12: sorteia uma raridade pra equipamento
    // PROCEDURAL de inimigo a partir de um `strengthScore` (0-100+, mesma
    // escala que Enemy/Vampire já calculavam pra decidir Comum-vs-Incomum
    // antes desta iteração — ver equipStyleWeaponGeneric em player.js).
    // Cada faixa é uma distribuição ponderada (Utils.weightedPick, já usado
    // pela demografia racial) com as 5 raridades — nunca uma regra
    // absoluta: mesmo um inimigo fraco tem uma chance mínima de Incomum, e
    // mesmo um Elite forte tem boa chance de sair só com Comum/Incomum,
    // exatamente a "tendência, nunca garantia" que a diretiva pede.
    rollGearRarity(strengthScore) {
        let weights;
        if (strengthScore < 15) { // fraco
            weights = { COMMON: 92, UNCOMMON: 8 };
        } else if (strengthScore < 35) { // médio
            weights = { COMMON: 68, UNCOMMON: 27, RARE: 5 };
        } else if (strengthScore < 55) { // forte
            weights = { COMMON: 38, UNCOMMON: 36, RARE: 22, EPIC: 4 };
        } else { // elite/chefe
            weights = { COMMON: 15, UNCOMMON: 28, RARE: 32, EPIC: 20, LEGENDARY: 5 };
        }
        const key = Utils.weightedPick(weights) || 'COMMON';
        return RARITY[key];
    },

    // Mega Atualização item 13: cria um item numa raridade-TETO específica,
    // descendo um degrau por vez (nunca sobe) até a própria `entity`
    // atender `requiredLevel`/`requiredStats` do resultado (Entity.canEquip,
    // ver player.js — construída na Iteração 1 exatamente pra esta
    // reutilização). Separado de `createEquipmentForEntity` abaixo pra que
    // chamadores com raridade já CURADA (ex: Rival.equipGear, cuja raridade
    // vem de `def.gearRarity`, nunca de um sorteio) também ganhem a mesma
    // proteção sem precisar rolar uma raridade nova por cima da curada.
    // Common é o piso: se nem Common couber (nível da entidade abaixo do
    // mínimo do próprio template), o item cai equipado mesmo assim — a
    // alternativa seria a entidade nascer sem nada equipado, pior do que
    // uma peça abaixo do ideal.
    createEquipmentWithRarityCap(entity, templateId, category, maxRarity) {
        let rarity = maxRarity;
        let item = this.createEquipment(templateId, category, rarity);
        while (item && entity.canEquip && !entity.canEquip(item).ok && rarity.id > RARITY.COMMON.id) {
            rarity = RARITY_ORDER[rarity.id - 2]; // um degrau abaixo (ids são 1-indexed)
            item = this.createEquipment(templateId, category, rarity);
        }
        return item;
    },

    // Mega Atualização item 12/13: cria um equipamento procedural pra uma
    // entidade (inimigo/vampiro/fantasma) já respeitando os próprios
    // requisitos dela — sorteia a raridade pelo `strengthScore`
    // (rollGearRarity acima) e aplica o mesmo teto/downgrade de
    // createEquipmentWithRarityCap. Nunca entrega "arma de 40 STR pra um
    // inimigo de 18 STR" (exemplo literal da diretiva).
    createEquipmentForEntity(entity, templateId, category, strengthScore) {
        const rolledRarity = this.rollGearRarity(strengthScore);
        return this.createEquipmentWithRarityCap(entity, templateId, category, rolledRarity);
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

    createEssence(templateId) {
        const template = ItemDatabase.essences[templateId];
        if (!template) {
            console.error(`[ItemFactory] Essência ${templateId} não encontrada.`);
            return null;
        }
        return new Essence(template);
    },

    createRune(templateId) {
        const template = ItemDatabase.runes[templateId];
        if (!template) {
            console.error(`[ItemFactory] Runa ${templateId} não encontrada.`);
            return null;
        }
        return new Rune(template);
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
    // Item 23 da mega-diretiva Arena+Estilos ("nem TODO item deve virar
    // drop exclusivo de arena, mas ALGUNS devem — armas de campeão,
    // troféus, peças de identidade própria"). `arenaExclusive: true` no
    // template exclui o item de QUALQUER pool aleatório/genérico (loja,
    // Mercador Viajante, loot garantido comum de Ritual/Ladder) — ele só
    // pode ser obtido via `createEquipment` chamado diretamente pelo
    // código-fonte do drop específico (ver enemy.js createArenaBoss
    // boss.generateLoot e ui.js _advanceChampionsArena). Sem essa flag,
    // qualquer item novo adicionado às categorias abaixo vazaria
    // automaticamente pra `generateGuaranteedItem` — a MESMA função usada
    // por loot de Boss de Ritual, Campeão da Ladder, Boss Especial da
    // Arena E o bônus de conclusão da Arena dos Campeões — quebrando a
    // exclusividade pretendida.
    _pickRandomEquipmentId(cityId, includeAllRegions, forceCategory = null) {
        const categories = ['weapons', 'armors', 'shields', 'trinkets'];
        // craftOnly (MEGA REWORK econômico, Iteração 3): produtos exclusivos
        // do Ateliê Élfico nunca aparecem no sorteio de loja genérica — só
        // saem criados de verdade (ver js/elfcrafting.js).
        const availableInCity = (template) => !template.arenaExclusive && !template.craftOnly && (includeAllRegions || !template.region || template.region === cityId);
        // Fase 14 do balanceamento (Iteração 19, achado #08 da auditoria
        // original): "loja pode sortear ZERO itens de uma categoria inteira
        // no dia". `forceCategory`, opcional, permite ao chamador (ver
        // generateShopInventory abaixo) pedir uma categoria específica em
        // vez de sortear entre as 4 — usado pra garantir cobertura mínima
        // sem duplicar o filtro de região/craftOnly/arenaExclusive aqui.
        const category = forceCategory || categories[Utils.randomInt(0, categories.length - 1)];
        const pool = Object.keys(ItemDatabase[category]).filter(id => availableInCity(ItemDatabase[category][id]));
        if (pool.length === 0) return null; // categoria sem nenhum item disponível nesta cidade (não deveria ocorrer, mas evita crash)
        return { category, id: pool[Utils.randomInt(0, pool.length - 1)] };
    },

    generateShopInventory(playerLevel, cityId = null, includeAllRegions = false) {
        const shopInventory = [];

        // Fase 14 do balanceamento (Iteração 19) — achado #08 da auditoria
        // original: as 8 vagas antes sorteavam a categoria de forma
        // TOTALMENTE independente pra cada uma (4 categorias, 8 sorteios
        // uniformes) — a chance de uma categoria inteira sair vazia no dia
        // é (3/4)^8 ≈ 10% por categoria, ~34% de pelo menos uma categoria
        // zerada em algum dia (confirmado por cálculo direto da distribuição
        // binomial, não só intuição). Corrigido reservando 1 vaga garantida
        // por categoria (as 4 primeiras, uma de cada uma das 4 categorias
        // reais do jogo) — nunca mais um dia sem NENHUM escudo ou NENHUM
        // acessório à venda — e mantendo as 4 vagas restantes totalmente
        // aleatórias, exatamente como antes, pra preservar a variedade e o
        // número total de itens (8) sem alterar a economia.
        const categories = ['weapons', 'armors', 'shields', 'trinkets'];
        const slotCategories = [...categories, null, null, null, null];

        for (let i = 0; i < 8; i++) {
            const picked = this._pickRandomEquipmentId(cityId, includeAllRegions, slotCategories[i]);
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
            if (regional.length > 0) {
                // Bug de auditoria final do Rework da Taverna: a
                // substituição "tudo ou nada" abaixo sempre funcionou bem
                // pras sub-lojas de categoria única (Câmara Rúnica/Círculo
                // de Treinamento/Ateliê — cada uma vende só UM tipo de
                // coisa, então substituir o pool inteiro é o comportamento
                // certo, e continua sendo). Mas a Taverna (subShop:'tavern')
                // cobre 5 categorias (vida/mana/bandagem/comida/bebida) no
                // MESMO subShop — qualquer cidade com só 1 item regional de
                // comida/bebida (Orc/Elfo/Anão) perdia TODAS as poções de
                // vida/mana e bandagens da Taverna, categorias que nunca
                // deveriam ser tocadas. Só pra 'tavern', a substituição
                // passa a ser POR CATEGORIA: cada categoria com item
                // regional próprio é substituída, as demais continuam
                // mostrando o estoque neutro normal.
                if (subShop === 'tavern') {
                    const neutral = allIds.filter(id => !ItemDatabase.consumables[id].region);
                    const regionalCategories = new Set(regional.map(id => ItemDatabase.consumables[id].consumableCategory));
                    const kept = neutral.filter(id => !regionalCategories.has(ItemDatabase.consumables[id].consumableCategory));
                    return [...kept, ...regional].map(id => this.createConsumable(id));
                }
                return regional.map(id => this.createConsumable(id));
            }
        }
        return allIds.filter(id => !ItemDatabase.consumables[id].region).map(id => this.createConsumable(id));
    },

    // Rework da Taverna item 15: pool bruto de candidatos a Especialidade
    // da Casa da cidade (ver ItemDatabase.houseSpecialties acima) — o
    // SORTEIO ponderado + a chance de permanência entre dias fica em
    // ui.js (mesmo lugar que já cacheia/rerola o estoque da loja, ver
    // openShop `_shopStockCache`), esta função só devolve os templates
    // disponíveis pra essa cidade específica.
    getHouseSpecialtyPool(cityId) {
        return (ItemDatabase.houseSpecialties && ItemDatabase.houseSpecialties[cityId]) || {};
    },

    createHouseSpecialty(cityId, templateKey) {
        const pool = this.getHouseSpecialtyPool(cityId);
        const template = pool[templateKey];
        if (!template) return null;
        return new Consumable(template);
    }
};
