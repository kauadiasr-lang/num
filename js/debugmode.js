/**
 * Modo Debug/Criativo — ativado automaticamente quando o nome do
 * personagem na Criação é EXATAMENTE "MarlenioDeTeste" (ver ui.js
 * finalizeCharacterCreation). Pedido explícito do usuário: um jeito
 * rápido de testar qualquer sistema/conteúdo do jogo sem precisar
 * progredir de verdade (nível, bosses, reputação, missões).
 *
 * Isolamento: NÃO é um sistema de save paralelo — o personagem debug usa
 * exatamente o mesmo SaveManager/slot normal (qualquer campo novo no
 * Player, incluindo `isDebugMode`, já sobrevive ao save/load sem
 * nenhuma mudança em save.js, ver Object.assign na restauração). O
 * isolamento vem de duas garantias: (1) só ativa com o nome EXATO, então
 * nunca afeta um personagem normal por acidente; (2) todo helper aqui só
 * MUTA o player específico que o chama — nunca toca em regra global,
 * fórmula de combate ou balanceamento do jogo normal.
 *
 * Este arquivo só contém a LÓGICA de estado (o que cada ação faz no
 * Player). A tela/formulário fica em ui.js openDebugPanel().
 */
const DebugMode = {
    NAME: 'MarlenioDeTeste',
    INFINITE_GOLD: 999999999,

    isDebugName(name) {
        return name === this.NAME;
    },

    // Chamado uma única vez, dentro de finalizeCharacterCreation, logo
    // depois de `new Player(name)` — nunca substitui o resto do fluxo de
    // criação normal (raça/visual/cidade natal/arma inicial continuam
    // exatamente iguais), só liga a flag e dá o primeiro estoque de ouro.
    setup(player) {
        player.isDebugMode = true;
        player.gold = this.INFINITE_GOLD;
    },

    // "Dinheiro infinito" sem precisar interceptar toda compra do jogo:
    // chamado em pontos de alto tráfego (showScreen/updateHubStats, ver
    // ui.js) — sempre que o ouro cai abaixo do teto, volta pro teto. Gasto
    // real ainda é visível por um instante (nunca trava o jogador vendo um
    // número errado por muito tempo), mas nunca fica baixo o suficiente
    // pra impedir nenhuma compra/criação/forja.
    ensureInfiniteGold(player) {
        if (player && player.isDebugMode && player.gold < this.INFINITE_GOLD) {
            player.gold = this.INFINITE_GOLD;
        }
    },

    // --- Atributos/Progressão ---
    setBaseStats(player, stats) {
        player.baseStats = { ...player.baseStats, ...stats };
        player.calculateDerivedStats();
    },

    setLevel(player, level) {
        player.level = Utils.clamp(Math.floor(level) || 1, 1, 999);
        player.calculateDerivedStats();
    },

    setProgression(player, { exp, statPoints, skillPoints }) {
        if (exp !== undefined) player.exp = Math.max(0, Math.floor(exp));
        if (statPoints !== undefined) player.statPoints = Math.max(0, Math.floor(statPoints));
        if (skillPoints !== undefined) player.skillPoints = Math.max(0, Math.floor(skillPoints));
        player.calculateDerivedStats();
    },

    // --- Linhagens ---
    // `LineageSystem.awaken` recusa silenciosamente se `player.lineage`
    // já existir (regra normal: "uma linhagem por campanha") — o Modo
    // Debug precisa TROCAR livremente, então zera antes de chamar a
    // função real (reaproveitada, nunca duplicada), preservando toda a
    // lógica de visual/mutationSkillPoints que ela já aplica.
    setLineage(player, lineageId) {
        player.lineage = null;
        const ok = window.LineageSystem.awaken(player, lineageId);
        if (ok) player.mutationSkillPoints = 999; // pontos de sobra pra testar a árvore inteira
        player.calculateDerivedStats();
        return ok;
    },

    clearLineage(player) {
        player.lineage = null;
        player.lineageAwakenedAt = null;
        player.mutationSkillPoints = 0;
        player.calculateDerivedStats();
    },

    // Linhagem secundária (só 'natureza' existe hoje, ver nature.js) —
    // nunca ocupa `player.lineage`, coexiste com a principal.
    setSecondaryLineage(player, lineageId) {
        player.secondaryLineage = lineageId;
        player.natureSkillPoints = 999;
        player.calculateDerivedStats();
    },

    clearSecondaryLineage(player) {
        player.secondaryLineage = null;
        player.natureSkillPoints = 0;
        player.calculateDerivedStats();
    },

    // --- Árvores de Habilidade ---
    // Reaproveita SkillTreeSystem.unlockNode (nunca escreve
    // `skillTreeUnlocked`/`learnedSkills` na mão) — só dá pontos de sobra
    // e chama o desbloqueio real em várias passadas até não sobrar nó
    // desbloqueável, o que respeita `requires` automaticamente sem
    // precisar ordenar por tier manualmente.
    unlockAllNodes(player, treeId) {
        const tree = window.SkillTreeSystem.getTree(treeId);
        if (!tree) return 0;
        const pointsField = window.SkillTreeSystem._pointsFieldFor(player, treeId);
        player[pointsField] = 9999;
        let unlockedCount = 0;
        let progressed = true;
        while (progressed) {
            progressed = false;
            for (const node of tree.nodes) {
                if (window.SkillTreeSystem.unlockNode(player, treeId, node.id)) {
                    unlockedCount++;
                    progressed = true;
                }
            }
        }
        player.calculateDerivedStats();
        return unlockedCount;
    },

    // --- Itens ---
    // `category` é a chave de ItemDatabase pro tipo pedido (weapons/
    // armors/shields/trinkets → createEquipment; consumables/materials/
    // essences/runes → sua própria factory). Retorna o item criado ou
    // null se o template não existir/mochila cheia.
    giveItem(player, kind, category, templateId, rarityId) {
        if (player.inventory.length >= player.inventoryCapacity) return null;
        let item = null;
        if (kind === 'equipment') {
            const rarity = RARITY_ORDER.find(r => r.id === Number(rarityId)) || RARITY.COMMON;
            item = ItemFactory.createEquipment(templateId, category, rarity);
        } else if (kind === 'consumable') {
            item = ItemFactory.createConsumable(templateId);
        } else if (kind === 'material') {
            item = ItemFactory.createMaterial(templateId);
        } else if (kind === 'essence') {
            item = ItemFactory.createEssence(templateId);
        } else if (kind === 'rune') {
            item = ItemFactory.createRune(templateId);
        }
        if (item) player.inventory.push(item);
        return item;
    },

    clearInventory(player) {
        player.inventory = [];
    },

    // --- Aparência/Raça ---
    setRace(player, raceId) {
        if (!window.RACES || !window.RACES[raceId]) return false;
        player.race = raceId;
        player.calculateDerivedStats();
        return true;
    },

    setVisuals(player, visualPatch) {
        player.visuals = { ...player.visuals, ...visualPatch };
    },

    // --- Sistemas de progressão (reputação/missões/bosses) ---
    maxReputation(player) {
        player.reputation = 9999;
    },

    minReputation(player) {
        player.reputation = -9999;
    },

    completeAllQuests(player) {
        if (!window.QuestSystem) return 0;
        const ids = Object.keys(player.activeQuests || {});
        let count = 0;
        ids.forEach(id => {
            if (window.QuestSystem.completeQuest(player, id)) count++;
        });
        return count;
    },
};
window.DebugMode = DebugMode;
