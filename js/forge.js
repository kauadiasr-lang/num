/**
 * Sistema de Forja — Reino Subterrâneo de Kharzum (ver citydatabase.js
 * reino_anao `hasForge`/city.js oreVeins/items.js ItemDatabase.materials).
 *
 * Pedido explícito do usuário: a Forja NÃO cria um item perfeito na hora.
 * Material + técnica (aproximada aqui pelo nível do jogador, única medida
 * de experiência acumulada que já existe no jogo — nenhum stat novo
 * inventado só pra isso) + processo (uma dose de variação aleatória,
 * representando a imprevisibilidade real de qualquer forja) somam uma
 * QUALIDADE final (0-100). Qualidade é um eixo SEPARADO de raridade (ver
 * Equipment.quality em items.js) — nunca a determina sozinha, só desloca
 * as CHANCES de cada tier pra cima, sempre com Comum como piso possível e
 * nunca com Lendário garantido, mesmo em qualidade 100. Reaproveita
 * inteiramente o banco de itens já existente (ItemDatabase) — a Forja
 * nunca inventa um novo template de arma/armadura, só decide COM QUE
 * MATERIAL, RECEITA e RESULTADO (raridade + qualidade) um template
 * existente é produzido.
 */
const ForgeSystem = {
    // Receitas — deliberadamente poucas (pedido explícito: "não crie
    // dezenas de recursos/receitas inúteis"), priorizando armaduras/
    // escudos (especialização anã, ver items.js `region`/city de origem
    // de cada template) com só uma arma-bandeira. Cada `materials` é
    // {materialId, amount} — sempre gasto por completo na tentativa,
    // sucesso ou não faz diferença nenhuma (forjar sempre produz algo,
    // nunca "falha" e perde os materiais à toa — a variância está na
    // QUALIDADE do resultado, não em "funcionar ou não").
    RECIPES: {
        recipe_ironhelm: { name: 'Elmo de Ferro', category: 'armors', templateId: 'ironhelm', goldCost: 15,
            materials: [{ materialId: 'iron_ore', amount: 2 }] },
        recipe_irongreaves: { name: 'Grevas de Ferro', category: 'armors', templateId: 'irongreaves', goldCost: 18,
            materials: [{ materialId: 'iron_ore', amount: 2 }, { materialId: 'coal', amount: 1 }] },
        recipe_platearmor: { name: 'Armadura de Placas', category: 'armors', templateId: 'platearmor', goldCost: 45,
            materials: [{ materialId: 'steel_ingot', amount: 2 }, { materialId: 'iron_ore', amount: 1 }] },
        recipe_ironshield: { name: 'Escudo de Ferro', category: 'shields', templateId: 'ironshield', goldCost: 20,
            materials: [{ materialId: 'iron_ore', amount: 2 }, { materialId: 'coal', amount: 1 }] },
        recipe_towershield: { name: 'Escudo Torre', category: 'shields', templateId: 'towershield', goldCost: 50,
            materials: [{ materialId: 'steel_ingot', amount: 2 }, { materialId: 'common_ore', amount: 2 }] },
        recipe_dwarvenhammer: { name: 'Martelo Rúnico Anão', category: 'weapons', templateId: 'dwarvenhammer', goldCost: 90,
            materials: [{ materialId: 'steel_ingot', amount: 2 }, { materialId: 'arcane_crystal', amount: 1 }] }
    },

    // Confere se o jogador consegue pagar a receita SEM consumir nada
    // ainda — usado pela UI pra desabilitar botões de receitas
    // inacessíveis (ver ui.js openForge).
    canAfford(player, recipeId) {
        const recipe = this.RECIPES[recipeId];
        if (!recipe) return false;
        if (player.gold < recipe.goldCost) return false;
        return recipe.materials.every(req => this._countMaterial(player, req.materialId) >= req.amount);
    },

    _countMaterial(player, materialId) {
        return player.inventory.filter(i => i.category === 'material' && i.id === ItemDatabase.materials[materialId].id).length;
    },

    // Qualidade final (0-100) — Material (tier médio dos insumos, 1-5) +
    // Técnica (nível do jogador, proxy de experiência acumulada) +
    // Processo (variação aleatória, sempre presente — a MESMA receita com
    // os MESMOS materiais nunca produz qualidade idêntica duas vezes).
    _computeQuality(player, recipe) {
        const tiers = recipe.materials.map(req => ItemDatabase.materials[req.materialId].tier);
        const avgTier = tiers.reduce((a, b) => a + b, 0) / tiers.length;
        const materialScore = avgTier * 15; // tier 1 -> 15, tier 5 -> 75
        const techniqueScore = Utils.clamp(player.level * 0.5, 0, 15);
        const processVariance = Utils.randomInt(-12, 12);
        return Utils.clamp(Math.round(materialScore + techniqueScore + processVariance), 0, 100);
    },

    // Raridade sorteada a partir da qualidade — MESMA filosofia de
    // ItemFactory.generateShopInventory (chances crescentes e
    // independentes por tier, nunca uma única raridade garantida mesmo no
    // teto). Qualidade é só UM dos fatores que a raridade real do jogo já
    // considera (ver comentário no topo do arquivo) — aqui ela substitui
    // o papel que `playerLevel` tem em generateShopInventory, mas o
    // MECANISMO de sorteio é o mesmo, não um sistema paralelo novo.
    _rollRarityFromQuality(quality) {
        let rarity = RARITY.COMMON;
        const uncommonChance = Utils.clamp(quality * 0.5, 0, 55);
        const rareChance = quality >= 35 ? Utils.clamp((quality - 35) * 0.6, 0, 30) : 0;
        const epicChance = quality >= 60 ? Utils.clamp((quality - 60) * 0.4, 0, 12) : 0;
        const legendaryChance = quality >= 85 ? Utils.clamp((quality - 85) * 0.25, 0, 4) : 0;
        if (Utils.chance(uncommonChance)) rarity = RARITY.UNCOMMON;
        if (Utils.chance(rareChance)) rarity = RARITY.RARE;
        if (Utils.chance(epicChance)) rarity = RARITY.EPIC;
        if (Utils.chance(legendaryChance)) rarity = RARITY.LEGENDARY;
        return rarity;
    },

    // Rótulo de qualidade em texto — só cosmético (ver ui.js openForge),
    // reflete a linguagem pedida explicitamente ("Forja ruim/boa/
    // excelente/perfeita").
    qualityLabel(quality) {
        if (quality >= 90) return 'Forja Perfeita';
        if (quality >= 70) return 'Forja Excelente';
        if (quality >= 45) return 'Forja Boa';
        if (quality >= 20) return 'Forja Mediana';
        return 'Forja Ruim';
    },

    // Tentativa de forja de verdade — consome materiais/ouro, sempre
    // produz um item (nunca "falha" por completo, ver comentário em
    // RECIPES acima), retorna { item, quality, label } ou null se o
    // jogador não pode pagar (chamador já deveria ter checado via
    // canAfford, mas confere de novo aqui por segurança — nunca confia só
    // na UI pra manter a integridade do estado, mesmo padrão do resto do
    // jogo, ver city.js travelToCity).
    attemptForge(player, recipeId) {
        const recipe = this.RECIPES[recipeId];
        if (!recipe || !this.canAfford(player, recipeId)) return null;
        if (player.inventory.length >= player.inventoryCapacity) return null; // mochila cheia — nada a fazer

        player.gold -= recipe.goldCost;
        for (const req of recipe.materials) {
            const templateId = ItemDatabase.materials[req.materialId].id;
            for (let i = 0; i < req.amount; i++) {
                const idx = player.inventory.findIndex(it => it.category === 'material' && it.id === templateId);
                if (idx >= 0) player.inventory.splice(idx, 1);
            }
        }

        const quality = this._computeQuality(player, recipe);
        const rarity = this._rollRarityFromQuality(quality);
        const item = ItemFactory.createEquipment(recipe.templateId, recipe.category, rarity, quality);
        player.inventory.push(item);

        return { item, quality, label: this.qualityLabel(quality) };
    }
};
window.ForgeSystem = ForgeSystem;
