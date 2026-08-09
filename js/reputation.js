/**
 * Sistema de Reputação — UMA ÚNICA reputação GLOBAL do gladiador, válida
 * nas três Cidades-Hub ao mesmo tempo (nunca reputação por cidade).
 *
 * Antes deste sistema, `player.reputation` já existia (ver player.js), mas
 * era um objeto `{cityId: número}` só usado por QuestSystem (ver
 * quests.js) — pedido explícito do usuário: reputação separada por cidade
 * não deve existir. Este arquivo substitui aquele formato por um único
 * número, com migração automática e silenciosa de saves antigos (soma dos
 * valores por cidade num único total — ver _ensureFields), sem quebrar
 * nenhum save existente.
 *
 * Toda mudança de reputação do jogo inteiro deve passar por applyChange()
 * (ou _applyFinalDelta, usado só por onBattleDefeat) — único funil de
 * escrita, pra nunca haver soma duplicada, log duplicado, nem o
 * multiplicador de linhagem aplicado mais de uma vez na mesma mudança.
 *
 * Sem limite artificial de piso/teto: a reputação pode ficar positiva,
 * neutra ou negativa sem nenhum clamp de 0 (só a PERDA por derrota, por
 * pedido explícito, nunca cria reputação negativa nova sozinha — ver
 * onBattleDefeat).
 */

// Faixas de reputação — usadas pro rótulo do HUD e por qualquer sistema que
// precise saber "quão bem visto o jogador é" (loja, NPCs, missões). Sem
// limite artificial nas pontas: `max: Infinity`/`-Infinity` cobre qualquer
// valor extremo que o jogador alcançar.
const REPUTATION_TIERS = [
    { id: 'infame', label: 'Infame', max: -50, badge: '💀', tone: 'negative' },
    { id: 'malvisto', label: 'Malvisto', max: -15, badge: '⚠️', tone: 'negative' },
    { id: 'neutro', label: 'Neutro', max: 14, badge: '➖', tone: 'neutral' },
    { id: 'respeitado', label: 'Respeitado', max: 49, badge: '⭐', tone: 'positive' },
    { id: 'lendario', label: 'Lendário', max: Infinity, badge: '🏆', tone: 'positive' }
];
window.REPUTATION_TIERS = REPUTATION_TIERS;

window.ReputationSystem = {
    // Seção 15 (pedido explícito do usuário): Vampirismo e Sombras sofrem
    // o DOBRO de perda de reputação em qualquer ação que já causaria
    // perda — a sociedade reage com mais severidade a essas linhagens,
    // nunca "a linhagem já nasce criminosa" (só multiplica perdas já
    // calculadas, nunca cria uma perda do nada, nunca multiplica ganhos).
    LINEAGE_LOSS_MULTIPLIER: { vampirismo: 2, sombras: 2 },

    // --- Campos defensivos (mesmo padrão de QuestSystem._ensureFields:
    // chamado no topo de todo método público, nunca uma migração central
    // única — assim funciona pra saves de QUALQUER versão anterior, sem
    // precisar de um passo de migração separado no boot do jogo). ---
    _ensureFields(player) {
        if (!player) return;
        if (typeof player.reputation !== 'number' || isNaN(player.reputation)) {
            if (player.reputation && typeof player.reputation === 'object') {
                // Save antigo (formato pré-reputação-global, ver cabeçalho):
                // soma o que já existia em cada cidade num único valor
                // global, em vez de descartar o progresso do jogador.
                const sum = Object.values(player.reputation).reduce((a, b) => a + (Number(b) || 0), 0);
                player.reputation = isNaN(sum) ? 0 : sum;
            } else {
                player.reputation = 0;
            }
        }
        // Log curto de mudanças recentes (seção 6: "tendência, alterações
        // recentes" no HUD) — nunca cresce sem limite, sempre truncado em
        // applyChange.
        if (!Array.isArray(player.reputationLog)) player.reputationLog = [];
    },

    _lineageMultiplier(player) {
        return this.LINEAGE_LOSS_MULTIPLIER[player.lineage] || 1;
    },

    getValue(player) {
        this._ensureFields(player);
        return player.reputation;
    },

    getTier(player) {
        const v = this.getValue(player);
        return REPUTATION_TIERS.find(t => v <= t.max) || REPUTATION_TIERS[REPUTATION_TIERS.length - 1];
    },

    // Registra a mudança no log curto + dispara o toast padronizado (seção
    // 6: "+8 Reputação — Seu triunfo aumentou sua fama."). Uso interno,
    // nunca soma `player.reputation` de novo (isso já aconteceu em quem
    // chamou) — só cuida do efeito colateral (log/toast), sempre o MESMO
    // pra qualquer chamador, pra nunca ter dois formatos de mensagem.
    _recordAndNotify(player, amount, opts) {
        if (amount === 0) return;
        player.reputationLog.unshift({
            amount,
            reason: opts.reason || 'outro',
            day: (window.City && window.City.dayCount) || 0
        });
        if (player.reputationLog.length > 8) player.reputationLog.length = 8;

        if (opts.toastMessage) {
            const sign = amount >= 0 ? '+' : '';
            const kind = amount >= 0 ? 'success' : 'error';
            if (window.MainMenu) window.MainMenu.showToast(`${sign}${amount} Reputação — ${opts.toastMessage}`, kind);
        }

        // Conquistas de reputação (ver player.js AchievementDB
        // reputation_infame/reputation_lendario) — checado aqui, no ÚNICO
        // funil de escrita, em vez de em cada chamador (battle.js, quests.js,
        // ui.js roubo) — garante que a conquista aparece na hora certa não
        // importa QUAL ação mudou a reputação, sem duplicar a checagem em
        // 3+ lugares diferentes. checkAchievements já é idempotente
        // (unlockAchievement só desbloqueia uma vez), então chamar toda
        // mudança de reputação é seguro e barato (só leitura de número).
        if (typeof player.checkAchievements === 'function') {
            const unlocked = player.checkAchievements({ reputationChanged: true });
            unlocked.forEach(a => {
                if (window.MainMenu) window.MainMenu.showToast(`🏆 Conquista desbloqueada: ${a.name}!`, 'success');
            });
        }
    },

    // Funil ÚNICO de escrita pra qualquer ganho/perda "simples" (missões,
    // vitórias, roubos, conquistas...) — o multiplicador de linhagem é
    // calculado UMA vez aqui, só quando `rawAmount` já é negativo (nunca em
    // ganhos, nunca aplicado duas vezes). Derrota é a ÚNICA exceção: usa
    // _applyFinalDelta (abaixo) porque precisa clampar o resultado DEPOIS
    // de multiplicar, mas ANTES de somar (ver onBattleDefeat).
    applyChange(player, rawAmount, opts = {}) {
        this._ensureFields(player);
        if (typeof rawAmount !== 'number' || !isFinite(rawAmount)) return 0; // guard: nunca deixa NaN/Infinity chegar a somar
        let amount = rawAmount;
        if (amount < 0) amount *= this._lineageMultiplier(player);
        amount = Math.round(amount);
        if (amount === 0) return 0;

        player.reputation += amount;
        this._recordAndNotify(player, amount, opts);
        return amount;
    },

    // Usado só por onBattleDefeat: aplica um delta JÁ FINAL (já multiplicado
    // e já clampado por quem chamou) sem recalcular o multiplicador de novo
    // — existe separado de applyChange justamente pra nunca multiplicar
    // duas vezes a mesma perda.
    _applyFinalDelta(player, delta, opts = {}) {
        this._ensureFields(player);
        if (typeof delta !== 'number' || !isFinite(delta) || delta === 0) return 0;
        delta = Math.round(delta);
        if (delta === 0) return 0;
        player.reputation += delta;
        this._recordAndNotify(player, delta, opts);
        return delta;
    },

    // --- "Importância" de um oponente — reaproveitada tanto pro ganho de
    // vitória (seção 4) quanto pra perda de derrota (seção 2), mesma régua
    // pras duas direções em vez de duas lógicas separadas decidindo o que
    // é "uma luta importante". Usa campos que já existem em Enemy/Rival/
    // Boss (ver enemy.js: isElite, rivalId, isChampion, isBoss) — nenhum
    // campo novo precisou ser criado nos inimigos. ---
    _opponentWeight(opponent) {
        if (!opponent) return 0;
        if (opponent.isBoss) return 5;
        if (opponent.rivalId && opponent.isChampion) return 3.5;
        if (opponent.rivalId) return 2;
        // Bandido Anão (ver city.js _makeBanditEnemy/reino_anao
        // `hasBandits`) — mesmo peso do Rival comum: derrotar um
        // criminoso de verdade É notícia, mesmo sem ser Elite por sorte
        // (pedido explícito do usuário, item 15 da especificação:
        // "derrotar criminosos" afeta reputação). Checado ANTES de
        // isElite de propósito: um bandido raramente Elite continua
        // contando como "importante" pelo próprio contexto, não só pela
        // sorte do sorteio de raridade do inimigo.
        if (opponent.isBandit) return 2;
        if (opponent.isElite) return 1;
        return 0; // duelo comum contra inimigo genérico: nem "importante" pra ganhar fama nem pra perder muita
    },

    // --- Seção 4: formas de ganhar reputação — só vitórias IMPORTANTES.
    // Um duelo comum (Duelo Rápido contra um Enemy genérico, sem Elite) não
    // deve mover a reputação: vencer é rotina pra um gladiador, não notícia.
    onBattleVictory(player, opponent) {
        this._ensureFields(player);
        const weight = this._opponentWeight(opponent);
        if (weight <= 0) return 0;
        const gain = Math.round(2 + weight * 2.6); // elite≈4-5, rival≈7, campeão≈11, boss≈15
        let label;
        if (opponent.isBoss) label = 'Sua vitória sobre um Chefe de Ritual virou lenda.';
        else if (opponent.rivalId && opponent.isChampion) label = `Você derrotou o campeão ${opponent.name} — sua fama cresce.`;
        else if (opponent.rivalId) label = `Vitória sobre ${opponent.name}, da Ladder de Rivais.`;
        else label = 'Sua vitória contra um adversário de elite chamou atenção.';
        return this.applyChange(player, gain, { reason: 'vitoria_importante', toastMessage: label });
    },

    // --- Seção 2: derrota em combate. A perda-base nunca é negativa
    // ("reputação perdida = máximo(0, valor calculado)"), e o resultado
    // FINAL (já com o multiplicador de linhagem) é sempre limitado pra
    // nunca deixar a derrota, sozinha, criar reputação negativa nova — só
    // reduz reputação positiva até 0. Se o jogador já estava negativo (por
    // roubos/crimes), a derrota não afunda mais (fica exatamente onde
    // estava): "reputação negativa deve vir PRINCIPALMENTE de ações
    // criminosas", nunca de perder lutas. ---
    onBattleDefeat(player, opponent) {
        this._ensureFields(player);
        const weight = this._opponentWeight(opponent);
        const rawLoss = 3 + weight * 2; // comum=3, elite=5, rival=7, campeão=10, boss=13
        const baseLoss = Math.max(0, rawLoss); // nunca negativo — derrota nunca DÁ reputação

        const before = player.reputation;
        const multiplied = baseLoss * this._lineageMultiplier(player);
        const floor = Math.min(before, 0); // nunca deixa a derrota sozinha criar um negativo NOVO
        const wanted = before - multiplied;
        const clamped = Math.max(floor, wanted);
        const delta = clamped - before; // já inclui o multiplicador, sempre <= 0

        return this._applyFinalDelta(player, delta, { reason: 'derrota', toastMessage: 'Sua derrota manchou sua fama.' });
    },

    // --- Seção 3: roubos e crimes — a PRINCIPAL via pra reputação
    // negativa de verdade (nunca sujeita ao piso de 0 do combate: um crime
    // pode empurrar o jogador pra reputação negativa sozinho, de propósito).
    // Severidade orientada a dados (mesmo padrão de EVENT_TYPES/QUEST_TYPE_META
    // no resto do jogo) — gravidade maior sempre custa mais reputação,
    // nunca um valor aleatório sem lógica.
    THEFT_SEVERITY: {
        petty: { goldMin: 8, goldMax: 20, repLoss: 6, label: 'um pequeno furto' },
        moderate: { goldMin: 25, goldMax: 55, repLoss: 14, label: 'um roubo' },
        major: { goldMin: 60, goldMax: 120, repLoss: 28, label: 'um roubo grave' }
    },

    // Limite diário de roubos (Rework Econômico, item 15 — "reroll
    // abusivo"/"exploits de dinheiro"): antes deste limite, o painel de
    // roubo em QUALQUER loja podia ser reaberto e clicado indefinidamente
    // — "roubo grave" sozinho rendia 60-120g por clique, sem cooldown
    // nenhum, e a única penalidade (reputação) não tem piso e o pior efeito
    // encontrado é só +16% de sobretaxa nas lojas (ver shopPriceModifier
    // abaixo) — irrelevante depois de acumular ouro suficiente. Contado por
    // `dayCount` (ver city.js advanceToNewDay, agora protegido contra spam
    // de "dormir" por sua própria trava de 20s reais), então o limite só
    // reseta quando um dia de verdade se passa, nunca por spam de clique.
    THEFTS_PER_DAY: 2,

    commitTheft(player, severityId) {
        this._ensureFields(player);
        const severity = this.THEFT_SEVERITY[severityId];
        if (!severity) return { gold: 0, reputationLoss: 0, blocked: false };

        const dayCount = (window.City && window.City.dayCount) || 0;
        if (player.theftDayCount !== dayCount) {
            player.theftDayCount = dayCount;
            player.theftsToday = 0;
        }
        if (player.theftsToday >= this.THEFTS_PER_DAY) {
            return { gold: 0, reputationLoss: 0, blocked: true };
        }
        player.theftsToday++;

        const gold = Utils.randomInt(severity.goldMin, severity.goldMax);
        player.gold += gold;
        const applied = this.applyChange(player, -severity.repLoss, {
            reason: 'roubo_' + severityId,
            toastMessage: `Você cometeu ${severity.label}.`
        });
        if (window.SaveManager) window.SaveManager.save(window.Engine.state);
        return { gold, reputationLoss: applied, blocked: false };
    },

    // --- Seção 5: impacto econômico da reputação nas lojas — chamado por
    // ui.js `_shopDiscount` (soma-se aos descontos já existentes de
    // fama/Carisma, nunca os substitui). Positiva = desconto extra;
    // negativa = sobretaxa (comerciantes cobram mais de quem tem má fama),
    // nunca bloqueia a compra inteiramente ("não bloqueie o jogo inteiro
    // por reputação negativa").
    shopPriceModifier(player) {
        const tier = this.getTier(player);
        if (tier.id === 'lendario') return -0.08; // desconto extra
        if (tier.id === 'respeitado') return -0.04;
        if (tier.id === 'malvisto') return 0.08; // sobretaxa
        if (tier.id === 'infame') return 0.16;
        return 0;
    }
};
