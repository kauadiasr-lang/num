/**
 * Motor de Skill Tree das Linhagens (Mutações) — completamente separado do
 * banco de Habilidades de combate comuns (skills.js/SkillDB), embora
 * reaproveite a MESMA classe Skill para nós ativos (menos código duplicado,
 * e as ativas de linhagem aparecem automaticamente no menu de Habilidade já
 * existente em batalha, sem precisar de nenhuma tela nova).
 *
 * Cada árvore é um grafo (DAG), não uma lista linear: `requires` lista os
 * nós-pré-requisito e QUALQUER UM já desbloqueado libera o nó (permite
 * convergência de builds diferentes) — nunca uma corrente única. Raiz =
 * `requires: []`. Orientado a dados: uma árvore nova é só mais uma entrada
 * em SKILL_TREES, sem tocar no motor (unlockNode/isUnlockable/etc).
 */

// Efeitos passivos possíveis (somados por calculateDerivedStats do Player a
// partir de todos os nós passivos desbloqueados da árvore da linhagem ativa)
// — ver player.js `_applyMutationPassives` e os pontos de uso em battle.js.
const MUTATION_STAT_KEYS = [
    'lifestealPercent', 'hpRegenPerTurn', 'lowHpDamageBonusPercent', 'bleedResistPercent',
    'drainOnCritPercent', 'healPowerBonusPercent', 'negativeEffectResistPercent',
    'defenseBonusPercent', 'dodgeBonusPercent', 'critChanceLowHpBonus'
];
window.MUTATION_STAT_KEYS = MUTATION_STAT_KEYS;

const SKILL_TREES = {
    vampirismo: {
        id: 'vampirismo', name: 'Árvore do Vampirismo',
        nodes: [
            // --- Tier 1: raízes (3 caminhos possíveis desde o início) ---
            { id: 'vam_root_sede', name: 'Sede de Sangue', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Rouba 6% do dano físico causado como HP.', statMods: { lifestealPercent: 6 } },
            { id: 'vam_root_sangue', name: 'Sangue Espesso', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Reduz em 20% o dano recebido de sangramento.', statMods: { bleedResistPercent: 20 } },
            { id: 'vam_root_vigilia', name: 'Vigília Noturna', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Regenera 2% do HP máximo no início de cada turno.', statMods: { hpRegenPerTurn: 2 } },

            // --- Tier 2 ---
            { id: 'vam_presas', name: 'Presas Longas', tier: 2, type: 'active', cost: 1, requires: ['vam_root_sede'],
                description: 'Desbloqueia Mordida Voraz: ataque que rouba muita vida.',
                skillDef: { id: 'mordida_voraz', name: 'Mordida Voraz', type: 'LIFESTEAL', mpCost: 14, powerMulti: 1.2,
                    description: 'Ataque vampírico que rouba 55% do dano causado como HP. Usa o alcance da sua arma.', extra: { lifestealPercent: 55, cooldown: 2 } } },
            { id: 'vam_coagulacao', name: 'Coagulação Acelerada', tier: 2, type: 'passive', cost: 1, requires: ['vam_root_sangue'],
                description: 'Mais 20% de resistência a sangramento e +1% de regeneração por turno.', statMods: { bleedResistPercent: 20, hpRegenPerTurn: 1 } },
            { id: 'vam_instinto', name: 'Instinto Predatório', tier: 2, type: 'passive', cost: 1, requires: ['vam_root_vigilia'],
                description: 'Com HP abaixo de 30%, causa 15% de dano físico a mais.', statMods: { lowHpDamageBonusPercent: 15 } },

            // --- Tier 3 ---
            { id: 'vam_regeneracao', name: 'Regeneração Vampírica', tier: 3, type: 'passive', cost: 1, requires: ['vam_coagulacao'],
                description: 'Mais 3% de regeneração de HP por turno.', statMods: { hpRegenPerTurn: 3 } },
            { id: 'vam_golpe_sanguessuga', name: 'Golpe Sanguessuga', tier: 3, type: 'active', cost: 2, requires: ['vam_presas'],
                description: 'Desbloqueia Golpe Sanguessuga: golpe pesado com roubo de vida ainda maior.',
                skillDef: { id: 'golpe_sanguessuga', name: 'Golpe Sanguessuga', type: 'LIFESTEAL', mpCost: 20, powerMulti: 1.6,
                    description: 'Golpe brutal que rouba 65% do dano causado como HP. Usa o alcance da sua arma.', extra: { lifestealPercent: 65, cooldown: 3 } } },
            { id: 'vam_furia_fome', name: 'Fúria da Fome', tier: 3, type: 'passive', cost: 1, requires: ['vam_instinto'],
                description: 'Mais 20% de dano físico (total 35%) com HP abaixo de 30%.', statMods: { lowHpDamageBonusPercent: 20 } },
            { id: 'vam_sangue_por_sangue', name: 'Sangue por Sangue', tier: 3, type: 'active', cost: 1, requires: ['vam_root_sangue', 'vam_coagulacao'],
                description: 'Desbloqueia Sangue por Sangue: corte vampírico que também causa sangramento.',
                skillDef: { id: 'sangue_por_sangue', name: 'Sangue por Sangue', type: 'BLEED', mpCost: 16, powerMulti: 0.9,
                    description: 'Corte vampírico: dano e sangramento por 3 turnos. Usa o alcance da sua arma.', extra: { duration: 3, cooldown: 3 } } },

            // --- Tier 4 ---
            { id: 'vam_imortalidade', name: 'Imortalidade Parcial', tier: 4, type: 'passive', cost: 2, requires: ['vam_regeneracao', 'vam_furia_fome'],
                description: 'Mais 10% de roubo de vida e +15% de roubo de vida extra em acertos críticos.', statMods: { lifestealPercent: 10, drainOnCritPercent: 15 } },
            { id: 'vam_veu_noite', name: 'Véu da Noite', tier: 4, type: 'active', cost: 2, requires: ['vam_golpe_sanguessuga'],
                description: 'Desbloqueia Véu da Noite: manto de sombras que aumenta muito a esquiva por 2 turnos.',
                skillDef: { id: 'veu_da_noite', name: 'Véu da Noite', type: 'EVASION', mpCost: 12, powerMulti: 1,
                    description: 'Envolve-se em sombras: +30% de esquiva por 2 turnos.', extra: { evasionBonus: 30, duration: 2, cooldown: 4 } } },
            { id: 'vam_sanguinario', name: 'Sanguinário', tier: 4, type: 'passive', cost: 1, requires: ['vam_furia_fome'],
                description: 'Com HP abaixo de 30%, +12% de chance crítica.', statMods: { critChanceLowHpBonus: 12 } },

            // --- Tier 5: capstones ---
            { id: 'vam_senhor_sangue', name: 'Senhor do Sangue', tier: 5, type: 'passive', cost: 2, requires: ['vam_imortalidade'],
                description: 'Mais 15% de roubo de vida e +4% de regeneração por turno.', statMods: { lifestealPercent: 15, hpRegenPerTurn: 4 } },
            { id: 'vam_abraco_trevas', name: 'Abraço das Trevas', tier: 5, type: 'active', cost: 2, requires: ['vam_veu_noite', 'vam_sanguinario'],
                description: 'Desbloqueia Abraço das Trevas: o golpe vampírico definitivo.',
                skillDef: { id: 'abraco_das_trevas', name: 'Abraço das Trevas', type: 'LIFESTEAL', mpCost: 28, powerMulti: 2.1,
                    description: 'O golpe vampírico definitivo: dano avassalador e rouba 70% como HP. Usa o alcance da sua arma.', extra: { lifestealPercent: 70, cooldown: 5 } } }
        ]
    },
    luz: {
        id: 'luz', name: 'Árvore da Luz',
        nodes: [
            // --- Tier 1 ---
            { id: 'luz_root_interior', name: 'Luz Interior', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Suas curas são 15% mais fortes.', statMods: { healPowerBonusPercent: 15 } },
            { id: 'luz_root_couraca', name: 'Couraça Sagrada', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Sua Defesa é 8% maior.', statMods: { defenseBonusPercent: 8 } },
            { id: 'luz_root_resiliencia', name: 'Resiliência', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Reduz em 20% a chance de efeitos negativos (atordoar/lentidão) contra você.', statMods: { negativeEffectResistPercent: 20 } },

            // --- Tier 2 ---
            { id: 'luz_toque_curador', name: 'Toque Curador', tier: 2, type: 'active', cost: 1, requires: ['luz_root_interior'],
                description: 'Desbloqueia Toque Curador: cura poderosa a qualquer distância.',
                skillDef: { id: 'toque_curador', name: 'Toque Curador', type: 'HEAL', mpCost: 16, powerMulti: 1.3,
                    description: 'Cura poderosa baseada na sua Inteligência. Pode ser usada a qualquer distância.', extra: { cooldown: 2 } } },
            { id: 'luz_chama_sagrada', name: 'Chama Sagrada', tier: 2, type: 'passive', cost: 1, requires: ['luz_root_interior'],
                description: 'Mais 10% de poder de cura (total 25%).', statMods: { healPowerBonusPercent: 10 } },
            { id: 'luz_barreira', name: 'Barreira Luminosa', tier: 2, type: 'passive', cost: 1, requires: ['luz_root_couraca'],
                description: 'Mais 8% de Defesa e +3% de esquiva.', statMods: { defenseBonusPercent: 8, dodgeBonusPercent: 3 } },
            { id: 'luz_purificacao', name: 'Purificação', tier: 2, type: 'passive', cost: 1, requires: ['luz_root_resiliencia'],
                description: 'Mais 20% de resistência a efeitos negativos (total 40%).', statMods: { negativeEffectResistPercent: 20 } },

            // --- Tier 3 ---
            { id: 'luz_bencao_maior', name: 'Bênção Maior', tier: 3, type: 'passive', cost: 1, requires: ['luz_toque_curador', 'luz_chama_sagrada'],
                description: 'Mais 20% de poder de cura.', statMods: { healPowerBonusPercent: 20 } },
            { id: 'luz_escudo_dourado', name: 'Escudo Dourado', tier: 3, type: 'active', cost: 2, requires: ['luz_barreira'],
                description: 'Desbloqueia Escudo Dourado: barreira que reduz muito o dano recebido por 2 turnos.',
                skillDef: { id: 'escudo_dourado', name: 'Escudo Dourado', type: 'SHIELD', mpCost: 14, powerMulti: 1,
                    description: 'Conjura uma barreira sagrada: -35% de dano recebido por 2 turnos.', extra: { shieldPercent: 35, duration: 2, cooldown: 4 } } },
            { id: 'luz_resistencia_amaldicoada', name: 'Resistência Amaldiçoada', tier: 3, type: 'passive', cost: 1, requires: ['luz_purificacao'],
                description: 'Mais 15% de resistência a efeitos negativos.', statMods: { negativeEffectResistPercent: 15 } },
            { id: 'luz_santuario', name: 'Santuário', tier: 3, type: 'active', cost: 1, requires: ['luz_purificacao'],
                description: 'Desbloqueia Santuário: purifica sangramentos/venenos ativos e cura uma pequena quantia.',
                skillDef: { id: 'santuario', name: 'Santuário', type: 'HEAL', mpCost: 10, powerMulti: 0.6,
                    description: 'Purifica efeitos negativos ativos e cura uma quantia baseada na sua Inteligência.', extra: { cooldown: 3, cleanse: true } } },
            { id: 'luz_penitente', name: 'Luz Penitente', tier: 3, type: 'active', cost: 1, requires: ['luz_root_interior', 'luz_toque_curador'],
                description: 'Desbloqueia Luz Penitente: raio sagrado ofensivo de longo alcance.',
                skillDef: { id: 'luz_penitente', name: 'Luz Penitente', type: 'MAGIC', mpCost: 22, powerMulti: 1.8,
                    description: 'Magia sagrada de longo alcance (8m), causando 180% do Dano Mágico.', extra: { cooldown: 3, range: 8 } } },

            // --- Tier 4 ---
            { id: 'luz_renascimento', name: 'Renascimento', tier: 4, type: 'passive', cost: 2, requires: ['luz_bencao_maior', 'luz_resistencia_amaldicoada'],
                description: 'Uma vez por batalha, ao cair abaixo de 20% de HP, cura 25% do HP máximo automaticamente.', statMods: {}, special: 'auto_revive_heal' },
            { id: 'luz_julgamento', name: 'Julgamento', tier: 4, type: 'active', cost: 2, requires: ['luz_penitente'],
                description: 'Desbloqueia Julgamento: magia sagrada avassaladora.',
                skillDef: { id: 'julgamento', name: 'Julgamento', type: 'MAGIC', mpCost: 30, powerMulti: 2.4,
                    description: 'Magia sagrada avassaladora de longo alcance (9m), causando 240% do Dano Mágico.', extra: { cooldown: 4, range: 9 } } },
            { id: 'luz_guarda_inabalavel', name: 'Guarda Inabalável', tier: 4, type: 'passive', cost: 1, requires: ['luz_escudo_dourado'],
                description: 'Mais 6% de Defesa e +4% de esquiva.', statMods: { defenseBonusPercent: 6, dodgeBonusPercent: 4 } },

            // --- Tier 5: capstones ---
            { id: 'luz_avatar', name: 'Avatar da Luz', tier: 5, type: 'passive', cost: 2, requires: ['luz_renascimento'],
                description: 'Mais 25% de poder de cura e +25% de resistência a efeitos negativos.', statMods: { healPowerBonusPercent: 25, negativeEffectResistPercent: 25 } },
            { id: 'luz_ira_celestial', name: 'Ira Celestial', tier: 5, type: 'active', cost: 2, requires: ['luz_julgamento', 'luz_guarda_inabalavel'],
                description: 'Desbloqueia Ira Celestial: a magia sagrada definitiva.',
                skillDef: { id: 'ira_celestial', name: 'Ira Celestial', type: 'MAGIC', mpCost: 38, powerMulti: 3.0,
                    description: 'A magia sagrada definitiva: dano cataclísmico de longo alcance (10m).', extra: { cooldown: 5, range: 10 } } }
        ]
    }
};
window.SKILL_TREES = SKILL_TREES;

window.SkillTreeSystem = {
    getTree(treeId) {
        return SKILL_TREES[treeId] || null;
    },

    getNode(treeId, nodeId) {
        const tree = SKILL_TREES[treeId];
        if (!tree) return null;
        return tree.nodes.find(n => n.id === nodeId) || null;
    },

    // Um nó é desbloqueável se: a árvore pertence à linhagem ativa do
    // jogador, ele ainda não foi desbloqueado, o jogador tem pontos
    // suficientes, e (é raiz OU pelo menos um pré-requisito já foi
    // desbloqueado) — é essa condição "OR" que torna a árvore um grafo
    // ramificado de verdade, nunca uma corrente linear única.
    isUnlockable(player, treeId, nodeId) {
        const node = this.getNode(treeId, nodeId);
        if (!node) return false;
        if (player.lineage !== treeId) return false;
        if (player.skillTreeUnlocked && player.skillTreeUnlocked[nodeId]) return false;
        if ((player.mutationSkillPoints || 0) < node.cost) return false;
        if (node.requires.length === 0) return true;
        return node.requires.some(reqId => player.skillTreeUnlocked && player.skillTreeUnlocked[reqId]);
    },

    unlockNode(player, treeId, nodeId) {
        if (!this.isUnlockable(player, treeId, nodeId)) return false;
        const node = this.getNode(treeId, nodeId);

        player.skillTreeUnlocked = player.skillTreeUnlocked || {};
        player.skillTreeUnlocked[nodeId] = true;
        player.mutationSkillPoints -= node.cost;

        if (node.type === 'active' && node.skillDef) {
            // Registra a habilidade ativa no MESMO banco usado pelas
            // habilidades comuns (window.SkillDB) — assim ela aparece
            // automaticamente no menu de Habilidade já existente em
            // batalha, sem precisar de nenhuma tela nova.
            const d = node.skillDef;
            if (!window.SkillDB[d.id]) {
                window.SkillDB[d.id] = new Skill(d.id, d.name, d.type, d.mpCost, d.powerMulti, d.description, 1, d.extra || {});
                // Marca como exclusiva de Linhagem — ui.js openSkillTree()
                // (Mercado Arcano, o menu de habilidades COMUM) filtra por
                // essa flag, senão a habilidade "vazava" pra lá depois de
                // desbloqueada pela árvore de Mutação, confundindo as duas
                // árvores (que devem ficar completamente separadas).
                window.SkillDB[d.id].isMutationSkill = true;
            }
            if (!player.learnedSkills.includes(d.id)) player.learnedSkills.push(d.id);
        }

        player.calculateDerivedStats();
        return true;
    },

    // Soma todos os statMods dos nós passivos desbloqueados da árvore da
    // linhagem ativa do jogador — chamado por Player.calculateDerivedStats().
    // Também retorna quais nós "especiais" (sem statMods numéricos simples,
    // ex: auto_revive_heal) estão ativos, pra battle.js consultar.
    sumPassiveStats(player) {
        const totals = {};
        MUTATION_STAT_KEYS.forEach(k => totals[k] = 0);
        totals.specials = [];
        if (!player.lineage || !player.skillTreeUnlocked) return totals;
        const tree = SKILL_TREES[player.lineage];
        if (!tree) return totals;

        tree.nodes.forEach(node => {
            if (node.type !== 'passive' || !player.skillTreeUnlocked[node.id]) return;
            if (node.statMods) {
                for (let key in node.statMods) {
                    if (totals[key] !== undefined) totals[key] += node.statMods[key];
                }
            }
            if (node.special) totals.specials.push(node.special);
        });
        return totals;
    },

    // Nós desbloqueados agrupados por tier, pra renderização da árvore na UI.
    getTreeForDisplay(player, treeId) {
        const tree = SKILL_TREES[treeId];
        if (!tree) return null;
        return {
            id: tree.id, name: tree.name,
            nodes: tree.nodes.map(n => ({
                ...n,
                unlocked: !!(player.skillTreeUnlocked && player.skillTreeUnlocked[n.id]),
                unlockable: this.isUnlockable(player, treeId, n.id)
            }))
        };
    }
};
