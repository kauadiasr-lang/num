/**
 * Ateliê Élfico — Santuário Élfico de Sylvaneth (ver citydatabase.js
 * santuario_elfico `hasEssenceSpots`/city.js essenceSpots/items.js
 * ItemDatabase.essences).
 *
 * MEGA REWORK — Economia, Lojas, Identidade Cultural, Iteração 3. Achado
 * da auditoria: o "Ateliê Élfico" era literalmente a mesma função
 * ui.js openShop() usada pela Câmara Rúnica anã, só com rótulo/subShop
 * diferente — nenhuma mecânica de CRIAÇÃO de verdade. A cultura Élfica
 * gira em torno de CRIAR, não COMPRAR: o jogador colhe Essência nas
 * nascentes físicas da praça (ver city.js _spawnEssenceNodesIfNeeded) e
 * combina no Ateliê pra produzir um dos 6 itens élficos EXCLUSIVOS (ver
 * items.js `craftOnly` — nunca aparecem em loja nenhuma, nem na própria
 * cidade élfica).
 *
 * Deliberadamente MECANICAMENTE DISTINTO da Forja anã (ver js/forge.js),
 * não só cosmético (item 11 da diretiva: "podem produzir coisas
 * diferentes... mas a experiência do jogador deve ser distinta"): a Forja
 * consome MATERIAL (minério) + ouro e sorteia uma QUALIDADE variável
 * (0-100) que desloca a raridade — "metalurgia imprevisível". O Ateliê
 * consome ESSÊNCIA (não minério — categoria separada, nunca a mesma
 * mochila que a Forja lê) + ouro e produz SEMPRE a MESMA raridade fixa
 * por receita, sem nenhum sorteio — "precisão artesanal": a mesma receita
 * com os mesmos insumos sempre produz o mesmo resultado, reforçando
 * "personalização e precisão" como identidade élfica em vez da variância
 * anã.
 */
const ElfCraftingSystem = {
    // Cada receita consome essência POR TIER (nunca minério — ver
    // comentário acima) + uma quantia modesta de ouro (a criação em si é
    // o gate, não o preço — item 16 do pedido: "você não pode simplesmente
    // comprar o melhor item, precisa encontrar componentes"). `essence`
    // é uma lista de {tier, amount}. `rarity` é FIXA (nunca sorteada) —
    // ver comentário no topo do arquivo.
    RECIPES: {
        recipe_elvencloak: { name: 'Manto Élfico', category: 'armors', templateId: 'elvencloak', goldCost: 20,
            essence: [{ tier: 1, amount: 3 }], rarity: RARITY.UNCOMMON },
        recipe_livingforestring: { name: 'Anel da Floresta Viva', category: 'trinkets', templateId: 'livingforestring', goldCost: 25,
            essence: [{ tier: 1, amount: 2 }, { tier: 2, amount: 1 }], rarity: RARITY.UNCOMMON },
        recipe_elderwoodamulet: { name: 'Amuleto da Seiva Ancestral', category: 'trinkets', templateId: 'elderwoodamulet', goldCost: 30,
            essence: [{ tier: 2, amount: 2 }], rarity: RARITY.RARE },
        recipe_elvenblade: { name: 'Lâmina Élfica', category: 'weapons', templateId: 'elvenblade', goldCost: 35,
            essence: [{ tier: 1, amount: 1 }, { tier: 2, amount: 2 }], rarity: RARITY.RARE },
        recipe_elvenwindspear: { name: 'Lança dos Ventos Élfica', category: 'weapons', templateId: 'elvenwindspear', goldCost: 40,
            essence: [{ tier: 2, amount: 2 }, { tier: 3, amount: 1 }], rarity: RARITY.RARE },
        // Flagship (mesma ideia do martelo rúnico anão em forge.js) — a
        // receita mais cara/exigente, resultado de topo garantido.
        recipe_elvenlongbow: { name: 'Arco Élfico Longo', category: 'weapons', templateId: 'elvenlongbow', goldCost: 55,
            essence: [{ tier: 3, amount: 2 }], rarity: RARITY.EPIC },
    },

    _countEssence(player, tier) {
        // Bug de auditoria: `class CityEngine` (city.js) NUNCA vira
        // `window.CityEngine` sozinha — só `var`/function no escopo global
        // top-level viram propriedade de window; `class` só cria um
        // binding de escopo (acessível como identificador solto,
        // `CityEngine`, em qualquer script carregado depois). Só a
        // INSTÂNCIA é exposta (`window.City = new CityEngine()`, ver
        // city.js). Usar o identificador solto aqui, nunca window.CityEngine.
        const essenceId = (typeof CityEngine !== 'undefined') ? CityEngine.ESSENCE_TIER_ITEM[tier] : null;
        if (!essenceId) return 0;
        const templateId = ItemDatabase.essences[essenceId].id;
        return player.inventory.filter(i => i.category === 'essence' && i.id === templateId).length;
    },

    // Confere se o jogador consegue pagar a receita SEM consumir nada
    // ainda — mesmo papel que ForgeSystem.canAfford, usado pela UI pra
    // desabilitar botões de receitas inacessíveis.
    canCraft(player, recipeId) {
        const recipe = this.RECIPES[recipeId];
        if (!recipe) return false;
        if (player.gold < recipe.goldCost) return false;
        return recipe.essence.every(req => this._countEssence(player, req.tier) >= req.amount);
    },

    // Criação de verdade — consome essência/ouro, produz SEMPRE a raridade
    // fixa da receita (nunca sorteada, ver comentário no topo do arquivo).
    // Retorna { item } ou null se o jogador não pode pagar/mochila cheia.
    attemptCraft(player, recipeId) {
        const recipe = this.RECIPES[recipeId];
        if (!recipe || !this.canCraft(player, recipeId)) return null;
        if (player.inventory.length >= player.inventoryCapacity) return null;

        player.gold -= recipe.goldCost;
        for (const req of recipe.essence) {
            const essenceId = CityEngine.ESSENCE_TIER_ITEM[req.tier];
            const templateId = ItemDatabase.essences[essenceId].id;
            for (let i = 0; i < req.amount; i++) {
                const idx = player.inventory.findIndex(it => it.category === 'essence' && it.id === templateId);
                if (idx >= 0) player.inventory.splice(idx, 1);
            }
        }

        const item = ItemFactory.createEquipment(recipe.templateId, recipe.category, recipe.rarity);
        player.inventory.push(item);
        return { item };
    },
};
window.ElfCraftingSystem = ElfCraftingSystem;
