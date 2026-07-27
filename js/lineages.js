/**
 * Sistema de Linhagens (Mutações) — o segundo sistema mágico do jogo,
 * completamente independente dos Encantamentos (ver enchantments.js).
 *
 * Uma Linhagem é uma mutação PERMANENTE do próprio gladiador (nunca um item):
 * escolhida uma única vez, ao derrotar o boss do ritual correspondente, e
 * válida para o resto daquela campanha. Registry orientado a dados — uma
 * linhagem nova é só mais uma entrada aqui (+ sua árvore em skilltrees.js,
 * seu ritual em rituals.js e seu boss em bossai.js), sem tocar em nenhum
 * `switch`/`if` grande espalhado pelo resto do código.
 *
 * Sombras e Titã têm a arquitetura pronta (id, fraqueza, visual, árvore
 * reservada) mas ficam `locked: true` nesta atualização — não têm ritual nem
 * boss implementados ainda, conforme pedido explicitamente.
 */

const LINEAGES = {
    vampirismo: {
        id: 'vampirismo',
        name: 'Vampirismo',
        locked: false,
        tagline: 'Poder através do sangue alheio.',
        specialty: ['Roubo de vida', 'Regeneração', 'Bônus com HP baixo', 'Resistência a sangramento', 'Drenagem de vida'],
        weaknessId: 'luz', // dano/efeitos da linhagem "luz" causam bônus contra esta
        weaknessName: 'Luz',
        visual: { skinTone: '#e8dce8', eyeColor: '#c81e2a', accent: '#7a1030', hasFangs: true, particle: null },
        skillTreeId: 'vampirismo',
        ritualId: 'vampirismo_ritual',
        bossId: 'conde_vampiro'
    },
    luz: {
        id: 'luz',
        name: 'Luz',
        locked: false,
        tagline: 'Um farol contra a escuridão da arena.',
        specialty: ['Cura', 'Purificação', 'Resistência a maldições', 'Resistência a efeitos negativos', 'Proteção'],
        weaknessId: 'sombras',
        weaknessName: 'Sombras',
        visual: { auraColor: '#fff2c0', eyeColor: '#fff6d8', accent: '#ffe9a3', hasAura: true, particle: 'light_motes' },
        skillTreeId: 'luz',
        ritualId: 'luz_ritual',
        bossId: 'anjo_guardiao'
    },
    sombras: {
        id: 'sombras',
        name: 'Sombras',
        locked: true, // arquitetura pronta, ritual/boss ainda não implementados
        tagline: 'O medo é a lâmina mais afiada.',
        specialty: ['Esquiva', 'Críticos', 'Medo', 'Furtividade', 'Mobilidade'],
        weaknessId: 'luz',
        weaknessName: 'Luz',
        visual: { skinTone: '#3a3040', eyeColor: '#8a3ae0', accent: '#1a1420', hasSmoke: true, particle: 'shadow_wisp' },
        skillTreeId: null,
        ritualId: null,
        bossId: null
    },
    tita: {
        id: 'tita',
        name: 'Titã',
        locked: true,
        tagline: 'Uma montanha não recua.',
        specialty: ['HP enorme', 'Defesa elevada', 'Resistência física', 'Resistência a empurrões', 'Estabilidade'],
        weaknessId: 'mobilidade',
        weaknessName: 'Baixa mobilidade',
        visual: { skinTone: '#8a8478', accent: '#5a5650', hasStoneSkin: true, particle: null },
        skillTreeId: null,
        ritualId: null,
        bossId: null
    }
};
window.LINEAGES = LINEAGES;

window.LineageSystem = {
    getAvailable() {
        return Object.values(LINEAGES).filter(l => !l.locked);
    },

    get(id) {
        return LINEAGES[id] || null;
    },

    // Aplica a mutação permanente ao jogador (chamado só uma vez, ao vencer o
    // boss do ritual — ver bossai.js/battle.js). Falha silenciosamente (não
    // sobrescreve) se o jogador já tiver uma linhagem, reforçando a regra de
    // "apenas UMA linhagem por campanha".
    awaken(player, lineageId) {
        if (player.lineage) return false;
        const lineage = LINEAGES[lineageId];
        if (!lineage || lineage.locked) return false;
        player.lineage = lineageId;
        player.lineageAwakenedAt = Date.now();
        // Pontos iniciais de talento da árvore de mutação — o jogador começa
        // podendo abrir os primeiros nós imediatamente, não zerado.
        player.mutationSkillPoints = (player.mutationSkillPoints || 0) + 3;

        // Identidade visual PERMANENTE da mutação: sobrescreve pele/olhos e
        // liga as flags de adereço (presas/aura) direto em player.visuals —
        // assim o mesmo código de graphics.js que já desenha vampiros/o Anjo
        // Guardião passa a desenhar o jogador mutado também, sem precisar de
        // um caminho de renderização separado. Preserva o resto da aparência
        // escolhida na criação (cabelo, rosto, cicatriz, arquétipo...).
        if (lineage.visual) {
            if (lineage.visual.skinTone) player.visuals.skinTone = lineage.visual.skinTone;
            if (lineage.visual.eyeColor) player.visuals.eyeColor = lineage.visual.eyeColor;
            player.visuals.hasFangs = !!lineage.visual.hasFangs;
            player.visuals.hasAura = !!lineage.visual.hasAura;
            player.visuals.hasSmoke = !!lineage.visual.hasSmoke;
            player.visuals.hasStoneSkin = !!lineage.visual.hasStoneSkin;
            player.visuals.auraColor = lineage.visual.auraColor || null;
        }

        player.calculateDerivedStats();
        return true;
    },

    // Bônus de dano quando a linhagem do DEFENSOR declara a linhagem do
    // ATACANTE como sua fraqueza (ex: um atacante "luz" contra um defensor
    // "vampirismo", já que vampirismo.weaknessId === 'luz') — usado em
    // battle.js, mantém a regra "cada linhagem tem uma fraqueza real".
    getWeaknessMultiplier(attackerLineageId, defenderLineageId) {
        if (!attackerLineageId || !defenderLineageId) return 1;
        const defender = LINEAGES[defenderLineageId];
        if (!defender) return 1;
        return defender.weaknessId === attackerLineageId ? 1.25 : 1;
    }
};
