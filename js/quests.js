/**
 * Sistema de Missões Secundárias — quadro de missões por Cidade-Hub (novo
 * pedido de auditoria, itens #3/#4). Orientado a dados, igual a todo outro
 * registry do jogo (Encantamentos, Linhagens, Rituais): um tipo de missão
 * novo é só mais uma entrada em QUEST_TYPE_META + um gancho de progresso em
 * QuestSystem, sem precisar reescrever a UI (ver ui.js openQuestBoard).
 *
 * Cada missão (única ou procedural) vira uma INSTÂNCIA independente com seu
 * próprio `instanceId` ao ser oferecida no quadro — mesmo uma missão única
 * (`QUEST_DEFS`) gera uma instância nova toda vez que reaparece disponível
 * (antes de ser aceita), pra nunca colidir com uma instância JÁ aceita ou
 * já concluída/falha do mesmo `defId`.
 *
 * Progresso é rastreado por HOOKS chamados de sistemas que já existem
 * (vitória em batalha, conversa com NPC, chegada numa cidade, novo dia) —
 * nenhum sistema de combate/diálogo/viagem precisa saber que missões
 * existem além de chamar o hook correspondente uma vez.
 */

const QUEST_TYPE_META = {
    HUNT: { name: 'Caça', icon: '🗡️', color: '#c0392b' },
    DELIVERY: { name: 'Entrega', icon: '📦', color: '#8a6a2a' },
    ARENA: { name: 'Arena', icon: '⚔️', color: '#c9a227' },
    ESCORT: { name: 'Escolta', icon: '🛡️', color: '#5a6a7a' },
    RECOVERY: { name: 'Recuperação', icon: '🔍', color: '#6b5a42' },
    INVESTIGATION: { name: 'Investigação', icon: '🕵️', color: '#5a4a6b' },
    COLLECT: { name: 'Coleta', icon: '💎', color: '#2a6a4a' },
    BOUNTY: { name: 'Recompensa', icon: '💰', color: '#7a2a2a' }
};
window.QUEST_TYPE_META = QUEST_TYPE_META;

// Missões ÚNICAS feitas manualmente (uma ou duas por cidade) — nunca
// reaparecem depois de completadas/falhas (ver QuestSystem.getBoardForCity).
const QUEST_DEFS = {
    ph_bandidos_estrada: {
        id: 'ph_bandidos_estrada', cityId: 'porto_helenico', type: 'HUNT',
        name: 'Bandidos na Estrada', giver: 'Capitão da Guarda',
        description: 'Bandidos têm atacado caravanas na estrada para o Coliseu. Vença 3 duelos comuns para dispersá-los.',
        difficulty: 2, targetCount: 3,
        reward: { gold: 150, xp: 90, reputation: 4 }, timeLimitDays: null
    },
    ph_campeao_desafio: {
        id: 'ph_campeao_desafio', cityId: 'porto_helenico', type: 'ARENA',
        name: 'O Desafio do Campeão', giver: 'Mestre de Cerimônias',
        description: 'Prove seu valor vencendo 2 duelos contra Rivais da Ladder.',
        difficulty: 3, targetCount: 2,
        reward: { gold: 220, xp: 140, reputation: 6 }, timeLimitDays: 7
    },
    orc_honra_perdida: {
        id: 'orc_honra_perdida', cityId: 'fortaleza_orc', type: 'RECOVERY',
        name: 'A Honra Perdida', giver: 'Ancião de Gorkhal',
        description: 'Um totem sagrado foi perdido em combate. Vença duelos até recuperá-lo das cinzas de um oponente derrotado.',
        difficulty: 3, targetCount: 1, dropChance: 35,
        reward: { gold: 200, xp: 120, reputation: 8 }, timeLimitDays: null
    },
    orc_provas_forca: {
        id: 'orc_provas_forca', cityId: 'fortaleza_orc', type: 'ESCORT',
        name: 'Provas de Força', giver: 'Guerreiro Veterano',
        description: 'Vença 2 duelos terminando com pelo menos metade do seu HP máximo — só assim provará resistência de verdade.',
        difficulty: 3, targetCount: 2, minHpPercent: 0.5,
        reward: { gold: 180, xp: 110, reputation: 5 }, timeLimitDays: null
    },
    elfico_sussurros_raizes: {
        id: 'elfico_sussurros_raizes', cityId: 'santuario_elfico', type: 'INVESTIGATION',
        name: 'Sussurros das Raízes', giver: 'Guardiã do Santuário',
        description: 'Converse com 4 habitantes do Santuário para reunir os fragmentos de uma antiga profecia.',
        difficulty: 2, targetCount: 4,
        reward: { gold: 140, xp: 100, reputation: 6 }, timeLimitDays: null
    },
    elfico_encomenda_sagrada: {
        id: 'elfico_encomenda_sagrada', cityId: 'santuario_elfico', type: 'DELIVERY',
        name: 'Encomenda Sagrada', giver: 'Mercador de Ervas',
        description: 'Leve uma encomenda urgente até Porto Helênico.',
        difficulty: 2, destinationCityId: 'porto_helenico',
        reward: { gold: 130, xp: 70, reputation: 4 }, timeLimitDays: 5
    }
};
window.QUEST_DEFS = QUEST_DEFS;

const QuestFactory = {
    // Nomes de NPC genéricos por tipo de missão procedural (o "quem pediu",
    // já que missões proceduais não têm um NPC nomeado fixo como as únicas).
    _proceduralGivers: ['Morador Local', 'Comerciante da Praça', 'Guarda da Cidade', 'Viajante Cansado', 'Sacerdote do Templo'],

    _pickGiver() {
        return this._proceduralGivers[Utils.randomInt(0, this._proceduralGivers.length - 1)];
    },

    _rewardFor(difficulty, playerLevel) {
        return {
            gold: Math.round(30 * difficulty * (1 + playerLevel * 0.08)),
            xp: Math.round(18 * difficulty * (1 + playerLevel * 0.1)),
            reputation: difficulty
        };
    },

    // Cidades alcançáveis (já desbloqueadas pelo nível) diferentes da atual
    // — uma missão de Entrega pedindo pra viajar a um lugar ainda travado
    // pro nível do próprio jogador nunca seria cumprível.
    _reachableOtherCities(cityId, playerLevel) {
        return Object.values(window.CityDatabase)
            .filter(c => c.id !== cityId && playerLevel >= c.unlockLevel)
            .map(c => c.id);
    },

    // Sorteia um Rival da Ladder ainda não derrotado, com nível parecido
    // com o do jogador (± 4), pra missões de Recompensa (BOUNTY).
    _pickBountyTarget(player) {
        const allRivals = [];
        window.RivalDatabase.leagues.forEach(league => league.rivals.forEach(r => allRivals.push(r)));
        const undefeated = allRivals.filter(r => !player.rivalsDefeated.includes(r.id) && Math.abs(r.level - player.level) <= 4);
        const pool = undefeated.length > 0 ? undefeated : allRivals.filter(r => !player.rivalsDefeated.includes(r.id));
        if (pool.length === 0) return null;
        return pool[Utils.randomInt(0, pool.length - 1)];
    },

    // Gera uma missão procedural de um tipo específico (ou sorteado, se
    // `typeId` for omitido) pra uma cidade/jogador — nunca aceita ainda,
    // só uma OFERTA disponível no quadro (ver QuestSystem.acceptQuest).
    generate(cityId, player, typeId = null) {
        const difficulty = Utils.clamp(1 + Math.floor(player.level / 6), 1, 5);
        const availableTypes = ['HUNT', 'ARENA', 'INVESTIGATION', 'COLLECT', 'ESCORT', 'RECOVERY', 'BOUNTY', 'DELIVERY'];
        let type = typeId || availableTypes[Utils.randomInt(0, availableTypes.length - 1)];

        // DELIVERY e BOUNTY exigem pré-condições (cidade alcançável / rival
        // disponível) — sem isso, cai de volta pra HUNT, que sempre é possível.
        const reachable = this._reachableOtherCities(cityId, player.level);
        if (type === 'DELIVERY' && reachable.length === 0) type = 'HUNT';
        const bountyTarget = type === 'BOUNTY' ? this._pickBountyTarget(player) : null;
        if (type === 'BOUNTY' && !bountyTarget) type = 'HUNT';

        const instanceId = `q_${cityId}_${type}_${Date.now()}_${Utils.randomInt(1000, 9999)}`;
        const base = {
            instanceId, defId: null, cityId, type, unique: false,
            giver: this._pickGiver(), difficulty,
            reward: this._rewardFor(difficulty, player.level),
            timeLimitDays: Utils.chance(40) ? Utils.randomInt(3, 6) : null
        };

        switch (type) {
            case 'HUNT':
                return { ...base, name: 'Contrato de Caça', targetCount: 1 + difficulty,
                    description: `Vença ${1 + difficulty} duelos comuns na Arena.` };
            case 'ARENA':
                return { ...base, name: 'Duelo Marcado', targetCount: Math.max(1, Math.floor(difficulty / 2)),
                    description: `Vença ${Math.max(1, Math.floor(difficulty / 2))} duelo(s) contra Rivais da Ladder.` };
            case 'INVESTIGATION':
                return { ...base, name: 'Perguntas na Praça', targetCount: 2 + difficulty,
                    description: `Converse com ${2 + difficulty} habitantes da cidade.` };
            case 'COLLECT':
                return { ...base, name: 'Acúmulo de Glória', targetCount: 1 + difficulty,
                    description: `Conquiste ${1 + difficulty} vitórias em duelo (de qualquer tipo).` };
            case 'ESCORT':
                return { ...base, name: 'Proteção de Comboio', targetCount: Math.max(1, Math.floor(difficulty / 2)), minHpPercent: 0.5,
                    description: `Vença ${Math.max(1, Math.floor(difficulty / 2))} duelo(s) terminando com pelo menos metade do HP máximo.` };
            case 'RECOVERY':
                return { ...base, name: 'Item Perdido', targetCount: 1, dropChance: 25 + difficulty * 5,
                    description: 'Vença duelos até recuperar um item perdido das cinzas de um oponente.' };
            case 'BOUNTY':
                return { ...base, name: `Recompensa: ${bountyTarget.name}`, rivalId: bountyTarget.id,
                    description: `Derrote ${bountyTarget.name} (${bountyTarget.title}) na Ladder por uma recompensa extra.`,
                    reward: { ...base.reward, gold: base.reward.gold * 2 } };
            case 'DELIVERY': {
                const destId = reachable[Utils.randomInt(0, reachable.length - 1)];
                const destName = window.CityDatabase[destId].name;
                return { ...base, name: 'Entrega Urgente', destinationCityId: destId,
                    description: `Leve uma encomenda até ${destName}.` };
            }
        }
    }
};
window.QuestFactory = QuestFactory;

window.QuestSystem = {
    // Garante os campos de save de missões em jogadores antigos (mesmo
    // padrão defensivo de `p.fatigue || 0` usado em todo o jogo) — chamado
    // no início de qualquer operação pública, nunca assume que já existem.
    _ensureFields(player) {
        if (!player.activeQuests) player.activeQuests = {};
        if (!player.completedQuestIds) player.completedQuestIds = [];
        if (!player.failedQuestIds) player.failedQuestIds = [];
        if (!player.reputation) player.reputation = {};
    },

    getReputation(player, cityId) {
        this._ensureFields(player);
        return player.reputation[cityId] || 0;
    },

    // Progresso inicial por tipo — cada tipo lê um subconjunto diferente
    // (ver os hooks onBattleVictory/onNpcTalked/onCityArrival abaixo).
    _initialProgress(quest, player) {
        if (quest.type === 'COLLECT') return { count: 0, startWins: player.wins || 0 };
        if (quest.type === 'RECOVERY') return { found: false };
        if (quest.type === 'DELIVERY') return { delivered: false };
        if (quest.type === 'BOUNTY') return { defeated: false };
        return { count: 0 };
    },

    // Pool procedural do dia para uma cidade — cacheado por
    // `${cityId}::${dayCount}` (mesmo padrão de ui.js openShop `cacheKey`):
    // só sorteia de novo quando o dia muda de verdade (ver city.js
    // advanceToNewDay), nunca a cada vez que o quadro é reaberto no MESMO dia.
    _proceduralCache: {},
    _getProceduralPool(cityId, player) {
        const day = window.City ? window.City.dayCount : 1;
        const key = `${cityId}::${day}`;
        if (!this._proceduralCache[key]) {
            const pool = [];
            for (let i = 0; i < 3; i++) pool.push(QuestFactory.generate(cityId, player));
            this._proceduralCache[key] = pool;
        }
        return this._proceduralCache[key];
    },

    // Missões disponíveis (ainda não aceitas/concluídas/falhas) + ativas,
    // pra montar o quadro da cidade atual (ver ui.js openQuestBoard).
    getBoardForCity(player, cityId) {
        this._ensureFields(player);
        const isFree = (defId) => !player.completedQuestIds.includes(defId) && !player.failedQuestIds.includes(defId)
            && !Object.values(player.activeQuests).some(q => q.defId === defId);

        const uniqueAvailable = Object.values(QUEST_DEFS)
            .filter(d => d.cityId === cityId && isFree(d.id))
            .map(d => ({ ...d, instanceId: `unique_${d.id}`, defId: d.id, unique: true }));

        const proceduralAvailable = this._getProceduralPool(cityId, player)
            .filter(q => !player.activeQuests[q.instanceId]); // já aceita não aparece 2x no quadro

        const active = Object.values(player.activeQuests).filter(q => q.cityId === cityId);

        return { available: [...uniqueAvailable, ...proceduralAvailable], active };
    },

    acceptQuest(player, questOffer) {
        this._ensureFields(player);
        if (player.activeQuests[questOffer.instanceId]) return false;
        const day = window.City ? window.City.dayCount : 1;
        const instance = {
            ...questOffer,
            defId: questOffer.unique ? questOffer.defId : null,
            acceptedAtDay: day,
            expiresAtDay: questOffer.timeLimitDays ? day + questOffer.timeLimitDays : null,
            progress: this._initialProgress(questOffer, player)
        };
        player.activeQuests[instance.instanceId] = instance;
        return true;
    },

    // Abandonar nunca tem penalidade (ver pedido: "abandonar" é uma opção
    // livre do quadro) — só remove de ativas, sem contar como falha.
    abandonQuest(player, instanceId) {
        this._ensureFields(player);
        if (!player.activeQuests[instanceId]) return false;
        delete player.activeQuests[instanceId];
        return true;
    },

    getProgressPercent(quest, player) {
        const p = quest.progress || {};
        if (quest.type === 'RECOVERY') return p.found ? 100 : 0;
        if (quest.type === 'DELIVERY') return p.delivered ? 100 : 0;
        if (quest.type === 'BOUNTY') return p.defeated ? 100 : 0;
        if (quest.type === 'COLLECT') {
            const current = Math.max(0, ((player && player.wins) || 0) - p.startWins);
            return Utils.clamp(Math.floor((current / quest.targetCount) * 100), 0, 100);
        }
        return Utils.clamp(Math.floor(((p.count || 0) / quest.targetCount) * 100), 0, 100);
    },

    // Texto curto de progresso pro quadro (ver ui.js openQuestBoard) — cada
    // tipo mostra a unidade certa (turnos não fazem sentido pra Entrega, por
    // exemplo), sem exigir que a UI conheça os detalhes de cada tipo.
    getProgressLabel(quest, player) {
        const p = quest.progress || {};
        if (quest.type === 'RECOVERY') return p.found ? 'Item recuperado!' : 'Item ainda não recuperado';
        if (quest.type === 'DELIVERY') return p.delivered ? 'Entregue!' : `Destino: ${window.CityDatabase[quest.destinationCityId].name}`;
        if (quest.type === 'BOUNTY') return p.defeated ? 'Alvo derrotado!' : 'Alvo ainda não derrotado';
        if (quest.type === 'COLLECT') {
            const current = Math.max(0, ((player && player.wins) || 0) - p.startWins);
            return `${Math.min(current, quest.targetCount)}/${quest.targetCount} vitórias`;
        }
        return `${Math.min(p.count || 0, quest.targetCount)}/${quest.targetCount}`;
    },

    isComplete(quest, player) {
        const p = quest.progress || {};
        if (quest.type === 'RECOVERY') return !!p.found;
        if (quest.type === 'DELIVERY') return !!p.delivered;
        if (quest.type === 'BOUNTY') return !!p.defeated;
        if (quest.type === 'COLLECT') return ((player.wins || 0) - p.startWins) >= quest.targetCount;
        return (p.count || 0) >= quest.targetCount;
    },

    // Concede a recompensa e move de ativas pra concluídas — chamado
    // automaticamente pelos hooks assim que isComplete() vira true (nunca
    // precisa de um botão manual de "entregar", simplificando o fluxo).
    completeQuest(player, instanceId) {
        this._ensureFields(player);
        const quest = player.activeQuests[instanceId];
        if (!quest) return null;
        delete player.activeQuests[instanceId];
        player.completedQuestIds.push(quest.defId || instanceId);

        player.gold += quest.reward.gold;
        player.gainExp(quest.reward.xp);
        player.reputation[quest.cityId] = (player.reputation[quest.cityId] || 0) + quest.reward.reputation;

        if (window.MainMenu) window.MainMenu.showToast(`Missão concluída: "${quest.name}"! +${quest.reward.gold}g, +${quest.reward.xp}XP, +${quest.reward.reputation} reputação.`, 'success');
        if (window.SaveManager) window.SaveManager.save(window.Engine.state);
        return quest;
    },

    // --- Ganchos de progresso (chamados por outros sistemas já existentes) ---

    // Chamado do fim de toda batalha vencida (ver battle.js endBattle) —
    // isVsRival distingue ARENA (Rival da Ladder) de HUNT (Enemy comum).
    onBattleVictory(player, opponent, meta = {}) {
        this._ensureFields(player);
        const isVsRival = !!opponent.rivalId;
        const hpPercentAtEnd = meta.hpPercentAtEnd !== undefined ? meta.hpPercentAtEnd : 1;

        Object.values(player.activeQuests).forEach(quest => {
            if (quest.type === 'HUNT' && !isVsRival) quest.progress.count = (quest.progress.count || 0) + 1;
            else if (quest.type === 'ARENA' && isVsRival) quest.progress.count = (quest.progress.count || 0) + 1;
            else if (quest.type === 'ESCORT' && hpPercentAtEnd >= (quest.minHpPercent || 0.5)) quest.progress.count = (quest.progress.count || 0) + 1;
            else if (quest.type === 'RECOVERY' && !quest.progress.found && Utils.chance(quest.dropChance || 30)) quest.progress.found = true;
            else if (quest.type === 'BOUNTY' && isVsRival && opponent.rivalId === quest.rivalId) quest.progress.defeated = true;

            if (this.isComplete(quest, player)) this.completeQuest(player, quest.instanceId);
        });
    },

    // Chamado de city.js _talkToNpc a cada conversa real com um NPC de
    // ambiente (nunca vampiro/mercador/viajante — só gente comum).
    onNpcTalked(player) {
        this._ensureFields(player);
        Object.values(player.activeQuests).forEach(quest => {
            if (quest.type !== 'INVESTIGATION') return;
            quest.progress.count = (quest.progress.count || 0) + 1;
            if (this.isComplete(quest, player)) this.completeQuest(player, quest.instanceId);
        });
    },

    // Chamado de city.js travelToCity ao CHEGAR numa cidade nova.
    onCityArrival(player, cityId) {
        this._ensureFields(player);
        Object.values(player.activeQuests).forEach(quest => {
            if (quest.type !== 'DELIVERY' || quest.destinationCityId !== cityId) return;
            quest.progress.delivered = true;
            if (this.isComplete(quest, player)) this.completeQuest(player, quest.instanceId);
        });
    },

    // Chamado de city.js advanceToNewDay() — falha (e remove de ativas)
    // qualquer missão cujo prazo (ver `expiresAtDay`) já tenha vencido.
    onNewDay(player) {
        this._ensureFields(player);
        const day = window.City ? window.City.dayCount : 1;
        Object.values(player.activeQuests).forEach(quest => {
            if (quest.expiresAtDay !== null && quest.expiresAtDay !== undefined && day > quest.expiresAtDay) {
                delete player.activeQuests[quest.instanceId];
                player.failedQuestIds.push(quest.defId || quest.instanceId);
                if (window.MainMenu) window.MainMenu.showToast(`Missão fracassada: "${quest.name}" — o prazo expirou.`, 'error');
            }
        });
    }
};
