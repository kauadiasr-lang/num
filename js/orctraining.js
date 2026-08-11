/**
 * Mestres de Treinamento — Fortaleza Orc (MEGA REWORK: Economia, Lojas,
 * Identidade Cultural). Substitui o antigo "Círculo de Treinamento", que
 * era só a função genérica ui.js openShop() com um rótulo Orc por cima
 * (ver auditoria da Iteração 1: os próprios comentários do código já
 * admitiam "mesmo mecanismo genérico... só trocando rótulo/subShop/
 * itens", e o comentário do Orc dizia explicitamente que ele "vendia"
 * treino — o oposto do pedido do usuário).
 *
 * A cultura Orc gira em torno de CONQUISTA, não COMPRA: 6 Mestres em
 * cadeia (o último exige os outros 5 concluídos primeiro), cada um exige
 * cumprir uma condição real de combate na PRÓXIMA luta depois de aceitar
 * o desafio (nunca ouro). Recompensa reaproveita `player.statPoints`
 * (mesmo pool já gasto na ficha de atributos existente) — nenhuma
 * stat-bonus paralela nova pra manter sincronizada com
 * calculateDerivedStats.
 *
 * Instrumentação de combate (ver battle.js executePlayerTurn/endBattle):
 * `damageDealt` acumula via o MESMO `enemyHpBefore` já capturado pra IA
 * (window.AICombat.recordPlayerAction) — nenhum contador paralelo de
 * dano. `usedMagic` reaproveita `this.usedOffensiveMagic`, que já existia
 * pro Ritual da Luz ("vencer sem magia ofensiva") — mesma leitura, dois
 * consumidores. Só `usedAnySkill` é um flag novo (nada parecido existia).
 */
const TRAINING_MASTERS = [
    {
        id: 'punho', name: 'Mestre do Punho', icon: '👊',
        description: 'Vença um combate sem lançar nenhuma habilidade mágica — só força e aço.',
        check: (stats) => stats.victory && !stats.usedMagic,
        reward: 2,
    },
    {
        id: 'forca', name: 'Mestre da Força', icon: '💪',
        description: 'Vença um combate causando pelo menos 140 de dano total.',
        check: (stats) => stats.victory && stats.damageDealt >= 140,
        reward: 2,
    },
    {
        id: 'resistencia', name: 'Mestre da Resistência', icon: '🛡️',
        description: 'Vença um combate que dure pelo menos 8 turnos — prove que aguenta a briga.',
        check: (stats) => stats.victory && stats.turnsSurvived >= 8,
        reward: 2,
    },
    {
        id: 'agilidade', name: 'Mestre da Agilidade', icon: '⚡',
        description: 'Vença um combate em no máximo 4 turnos — velocidade também é força.',
        check: (stats) => stats.victory && stats.turnsSurvived <= 4,
        reward: 2,
    },
    {
        id: 'armas', name: 'Mestre de Armas', icon: '🪓',
        description: 'Vença um combate sem usar nenhuma habilidade — só ataques básicos de arma.',
        check: (stats) => stats.victory && !stats.usedAnySkill,
        reward: 3,
    },
    {
        id: 'arena', name: 'Mestre da Arena', icon: '🏆',
        description: 'Vença um Rival da Ladder ou um Campeão — prove seu valor contra os melhores. Exige todos os outros Mestres concluídos.',
        check: (stats) => stats.victory && (!!stats.isRival || !!stats.isBoss),
        reward: 5,
        requiresAllPrevious: true,
    },
];

const OrcTrainingSystem = {
    MASTERS: TRAINING_MASTERS,

    // Save antigo sem este campo (ou personagem que nunca visitou a
    // Fortaleza Orc) — mesma convenção de inicialização preguiçosa já
    // usada por outros campos novos do Player neste jogo (nunca exige
    // migração de save.js, só garante um valor padrão seguro no primeiro uso).
    _ensureState(player) {
        if (!player.orcTraining) player.orcTraining = { completedMasters: [], activeChallengeId: null };
        return player.orcTraining;
    },

    isCompleted(player, masterId) {
        return this._ensureState(player).completedMasters.includes(masterId);
    },

    // Um Mestre normal está sempre disponível (exceto se já concluído); o
    // capstone (`requiresAllPrevious`) só libera com todos os outros já
    // batidos — dá uma progressão real em vez de 6 desafios soltos.
    isUnlocked(player, master) {
        const state = this._ensureState(player);
        if (state.completedMasters.includes(master.id)) return false;
        if (master.requiresAllPrevious) {
            return this.MASTERS.filter(m => m.id !== master.id).every(m => state.completedMasters.includes(m.id));
        }
        return true;
    },

    getActiveChallenge(player) {
        const state = this._ensureState(player);
        if (!state.activeChallengeId) return null;
        return this.MASTERS.find(m => m.id === state.activeChallengeId) || null;
    },

    startChallenge(player, masterId) {
        this._ensureState(player).activeChallengeId = masterId;
    },

    cancelChallenge(player) {
        this._ensureState(player).activeChallengeId = null;
    },

    // Chamado por battle.js endBattle() SÓ na vitória (mesmo ponto de
    // integração que QuestSystem.onBattleVictory/ReputationSystem.
    // onBattleVictory já usam — nunca um hook paralelo). Se não houver
    // desafio ativo, não faz nada. Falhar a condição NÃO cancela o
    // desafio — o jogador pode simplesmente tentar de novo na próxima
    // luta, sem perder o progresso de "qual Mestre escolhi".
    onBattleVictory(player, enemy, stats) {
        const state = this._ensureState(player);
        if (!state.activeChallengeId) return null;
        const master = this.MASTERS.find(m => m.id === state.activeChallengeId);
        if (!master) { state.activeChallengeId = null; return null; }

        const fullStats = { ...stats, victory: true, isRival: !!enemy.rivalId, isBoss: !!enemy.isBoss };
        if (master.check(fullStats)) {
            state.completedMasters.push(master.id);
            state.activeChallengeId = null;
            player.statPoints = (player.statPoints || 0) + master.reward;
            return { success: true, master };
        }
        return { success: false, master };
    },
};

window.TRAINING_MASTERS = TRAINING_MASTERS;
window.OrcTrainingSystem = OrcTrainingSystem;
