/**
 * Sistema de Ritual — o caminho de descoberta de cada Linhagem (ver
 * lineages.js). O jogador nunca compra uma linhagem: precisa cumprir o
 * ritual específico dela (rastreado aqui) para liberar o combate contra o
 * boss guardião (ver bossai.js); vencê-lo desperta a mutação para sempre.
 *
 * Orientado a dados: um ritual novo é só mais uma entrada em RITUALS, com
 * sua própria função `progress(player)` (0..1) e `isReady(player)` — nenhum
 * `switch` grande precisa saber qual linhagem é qual.
 */

const RITUALS = {
    vampirismo_ritual: {
        id: 'vampirismo_ritual', lineageId: 'vampirismo',
        name: 'Ritual do Sangue Eterno',
        // Só pode ser realizado à noite — os Vampiros só aparecem à noite
        // também (ver city.js/enemy.js), reforçando a atmosfera do ritual.
        requiresNight: true,
        essencesRequired: 10,
        description: 'Reúna 10 Essências Vampíricas, dropadas raramente por Vampiros que só saem à noite. Quando tiver o suficiente, o Ritual poderá ser realizado — mas apenas sob a escuridão.',
        progress(player) {
            const have = (player.ritualProgress.vampirismo && player.ritualProgress.vampirismo.vampiricEssences) || 0;
            return Utils.clamp(have / this.essencesRequired, 0, 1);
        },
        isReady(player) {
            const have = (player.ritualProgress.vampirismo && player.ritualProgress.vampirismo.vampiricEssences) || 0;
            return have >= this.essencesRequired;
        },
        canPerformNow(player) {
            if (!this.isReady(player)) return false;
            if (this.requiresNight && !(window.GFX && window.GFX.arenaTime === 'night')) return false;
            return true;
        }
    },
    luz_ritual: {
        id: 'luz_ritual', lineageId: 'luz',
        name: 'Vigília da Luz',
        requiresNight: false,
        potionsRequired: 15,
        noMagicWinsRequired: 5,
        fragmentsRequired: 5,
        description: 'Prove sua devoção: use ao menos 15 poções de cura, vença 5 batalhas sem usar nenhuma magia ofensiva, e reúna 5 Fragmentos Sagrados espalhados pelo mundo.',
        progress(player) {
            const rp = player.ritualProgress.luz || {};
            const a = Utils.clamp((rp.potionsUsed || 0) / this.potionsRequired, 0, 1);
            const b = Utils.clamp((rp.noMagicWins || 0) / this.noMagicWinsRequired, 0, 1);
            const c = Utils.clamp((rp.sacredFragments || 0) / this.fragmentsRequired, 0, 1);
            return (a + b + c) / 3;
        },
        isReady(player) {
            const rp = player.ritualProgress.luz || {};
            return (rp.potionsUsed || 0) >= this.potionsRequired
                && (rp.noMagicWins || 0) >= this.noMagicWinsRequired
                && (rp.sacredFragments || 0) >= this.fragmentsRequired;
        },
        canPerformNow(player) {
            return this.isReady(player);
        }
    }
};
window.RITUALS = RITUALS;

window.RitualSystem = {
    getAll() { return Object.values(RITUALS); },
    get(id) { return RITUALS[id] || null; },

    // Todos os rituais ainda não concluídos (linhagem correspondente ainda
    // não desperta) — é isso que a UI de Mutações mostra como "em progresso".
    getPendingFor(player) {
        return this.getAll().filter(r => player.lineage !== r.lineageId);
    },

    // --- Eventos que alimentam o progresso (chamados de battle.js/city.js/ui.js) ---

    onVampiricEssenceGained(player, amount = 1) {
        if (!player.ritualProgress.vampirismo) player.ritualProgress.vampirismo = { vampiricEssences: 0 };
        player.ritualProgress.vampirismo.vampiricEssences += amount;
    },

    onPotionUsed(player) {
        if (!player.ritualProgress.luz) player.ritualProgress.luz = { potionsUsed: 0, noMagicWins: 0, sacredFragments: 0 };
        player.ritualProgress.luz.potionsUsed++;
    },

    onBattleWon(player, usedOffensiveMagic) {
        if (usedOffensiveMagic) return;
        if (!player.ritualProgress.luz) player.ritualProgress.luz = { potionsUsed: 0, noMagicWins: 0, sacredFragments: 0 };
        player.ritualProgress.luz.noMagicWins++;
    },

    onSacredFragmentFound(player, amount = 1) {
        if (!player.ritualProgress.luz) player.ritualProgress.luz = { potionsUsed: 0, noMagicWins: 0, sacredFragments: 0 };
        player.ritualProgress.luz.sacredFragments += amount;
    },

    // Executado ao vencer o boss do ritual: desperta a linhagem pra sempre e
    // registra o boss como derrotado — chamado por battle.js/ui.js quando o
    // combate contra o boss termina em vitória.
    completeRitual(player, ritualId) {
        const ritual = RITUALS[ritualId];
        if (!ritual) return false;
        const lineage = window.LineageSystem.get(ritual.lineageId);
        if (!lineage || !lineage.bossId) return false;
        if (!player.bossesDefeated.includes(lineage.bossId)) player.bossesDefeated.push(lineage.bossId);
        return window.LineageSystem.awaken(player, ritual.lineageId);
    }
};
