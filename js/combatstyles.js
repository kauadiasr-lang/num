/**
 * Estilos de Combate — Mega Atualização Arena + Estilos, item 11-21.
 *
 * Sistema TOTALMENTE separado de Linhagem (lineages/skilltrees.js): nunca
 * ocupa `player.lineage`/`player.secondaryLineage`, nunca lê/escreve
 * `player.skillTreeUnlocked`/`mutationSkillPoints`. Um jogador pode ter
 * Linhagem + Estilo ao mesmo tempo, cada um com sua própria progressão.
 *
 * Arquitetura espelha DELIBERADAMENTE skilltrees.js (mesmo formato de nó —
 * id/tier/type/cost/requires/description/statMods|skillDef —, mesma
 * semântica de pré-requisito "requires: QUALQUER UM já desbloqueado
 * libera o nó", mesmo motor isUnlockable/unlockNode/getTreeForDisplay) —
 * mas um registry PRÓPRIO (COMBAT_STYLE_TREES, nunca misturado em
 * SKILL_TREES) porque o jogador pode ter aprendido vários estilos ao
 * mesmo tempo (progresso de cada um preservado independentemente), só UM
 * fica ATIVO por vez (player.combatStyle) — diferente de Linhagem
 * principal/secundária, que são dois slots fixos.
 *
 * Habilidades ativas de estilo reaproveitam os MESMOS SKILL_TYPES já
 * existentes (PHYSICAL/STUN/SHIELD) — nenhum tipo novo em skills.js,
 * nenhuma mudança no switch de execução de habilidade em battle.js.
 */

// Cada estilo define: id, nome, ícone, descrição, cityId (onde é
// aprendido pela primeira vez — reaproveita o MESMO padrão de
// city-gating já usado por region em items.js/enchantments.js), e
// isCompatible(entity) — checagem de equipamento (item 19 da diretiva).
// Nunca remove equipamento sozinho: só informa se o estilo está
// ativo/inativo no momento (ver Player.getActiveStyleStatus).
const LIGHT_WEAPON_IDS = ['dagger', 'rapier', 'elvenblade', 'shortsword'];

const COMBAT_STYLES = {
    colosso: {
        id: 'colosso', name: 'Punho do Colosso', icon: '👊', cityId: 'fortaleza_orc',
        tagline: 'Combate desarmado, golpes pesados, controle de espaço.',
        description: 'Estilo desarmado dos treinadores da Fortaleza Orc — nunca usa arma equipada no MAIN_HAND/RANGED, quanto mais puramente físico o combate, mais forte fica. Independente da (futura) Linhagem Titã.',
        isCompatible(entity) {
            return !entity.equipment[SLOTS.MAIN_HAND] && !entity.equipment[SLOTS.RANGED];
        },
        incompatibleMessage: 'Punho do Colosso exige lutar DESARMADO — desequipe a arma pra reativar o estilo.'
    },
    danca: {
        id: 'danca', name: 'Dança das Lâminas', icon: '🗡️', cityId: 'porto_helenico',
        tagline: 'Armas leves, mobilidade, ataques consecutivos.',
        description: 'Tradição de duelistas do Coliseu Imperial — exige uma arma leve (adaga, rapieira, espada curta/élfica) equipada no MAIN_HAND.',
        isCompatible(entity) {
            const w = entity.equipment[SLOTS.MAIN_HAND];
            return !!(w && LIGHT_WEAPON_IDS.includes(w.id));
        },
        incompatibleMessage: 'Dança das Lâminas exige uma arma LEVE equipada (adaga, rapieira, espada curta/élfica).'
    },
    muralha: {
        id: 'muralha', name: 'Muralha de Ferro', icon: '🛡️', cityId: 'reino_anao',
        tagline: 'Escudo, defesa, bloqueio, contra-ataque.',
        description: 'Disciplina defensiva dos veteranos de Kharzum — exige um escudo equipado no OFF_HAND. Defender ganha sinergia especial (chance extra de contra-ataque no próximo golpe recebido).',
        isCompatible(entity) {
            const shield = entity.equipment[SLOTS.OFF_HAND];
            return !!(shield && shield.blockChance);
        },
        incompatibleMessage: 'Muralha de Ferro exige um ESCUDO equipado.'
    },
    predador: {
        id: 'predador', name: 'Caminho do Predador', icon: '🏹', cityId: 'santuario_elfico',
        tagline: 'Arcos, bestas, alcance, controle de distância.',
        description: 'Ensinamento dos caçadores do Santuário Élfico — exige uma arma de longo alcance equipada (RANGED). Quanto maior a distância no momento do ataque, maior o bônus.',
        isCompatible(entity) {
            return !!entity.equipment[SLOTS.RANGED] && entity.activeWeaponSlot === SLOTS.RANGED;
        },
        incompatibleMessage: 'Caminho do Predador exige uma arma de LONGO ALCANCE equipada e ativa.'
    }
};
window.COMBAT_STYLES = COMBAT_STYLES;

// Chaves de statMods possíveis nos nós passivos — mesmo formato da
// MUTATION_STAT_KEYS de skilltrees.js, mas com o próprio vocabulário de
// Estilos (nunca reaproveita as mesmas chaves de Linhagem: são sistemas
// separados, mesmo que a AGREGAÇÃO use o mesmo mecanismo).
const COMBAT_STYLE_STAT_KEYS = [
    'unarmedDamageBonusPercent', 'unarmedDodgeBonusPercent',
    'lightWeaponDodgeBonusPercent', 'lightWeaponCritBonus',
    'shieldBlockChanceBonusFlat', 'shieldCounterChanceBonusFlat',
    'rangedDistanceDamageBonusPercent', 'rangedRetreatSpeedBonusFlat'
];
window.COMBAT_STYLE_STAT_KEYS = COMBAT_STYLE_STAT_KEYS;

function registerStyleSkillDef(d, styleId) {
    if (!window.SkillDB[d.id]) {
        window.SkillDB[d.id] = new Skill(d.id, d.name, d.type, d.mpCost, d.powerMulti, d.description, 1, d.extra || {});
        // Marca como exclusiva de Estilo — ui.js openSkillTree() (Mercado
        // Arcano, menu de habilidades COMUM) filtra por essa flag, mesmo
        // padrão de isMutationSkill/isBossSkill (nunca vaza pra lá).
        window.SkillDB[d.id].isStyleSkill = true;
        // A que estilo pertence — battle.js/ui.js usam pra checar
        // CombatStyleSystem.isStyleCompatible antes de deixar usar em
        // combate (ver "item 19 da diretiva": nunca remove o equipamento
        // sozinho, só bloqueia a habilidade incompatível).
        window.SkillDB[d.id].styleId = styleId;
    }
}

const COMBAT_STYLE_TREES = {
    colosso: {
        id: 'colosso', name: 'Árvore do Punho do Colosso',
        nodes: [
            { id: 'colosso_punho_pesado', name: 'Punho Pesado', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Lutando desarmado, +18% de dano físico.', statMods: { unarmedDamageBonusPercent: 18 } },
            { id: 'colosso_investida_bruta', name: 'Investida Bruta', tier: 2, type: 'active', cost: 2, requires: ['colosso_punho_pesado'],
                description: 'Golpe desarmado pesado com chance de atordoar o alvo.',
                skillDef: { id: 'colosso_investida_bruta', name: 'Investida Bruta', type: 'STUN', mpCost: 14, powerMulti: 1.3,
                    description: 'Golpe desarmado pesado — dano físico + 30% de chance de atordoar.', extra: { stunChance: 30 } } },
            { id: 'colosso_pele_de_pedra', name: 'Pele de Pedra', tier: 2, type: 'passive', cost: 2, requires: ['colosso_punho_pesado'],
                description: 'Lutando desarmado, +6% de esquiva (reflexos livres de peso de arma).', statMods: { unarmedDodgeBonusPercent: 6 } },
            { id: 'colosso_golpe_sismico', name: 'Golpe Sísmico', tier: 3, type: 'active', cost: 3, requires: ['colosso_investida_bruta'],
                description: 'Golpe desarmado devastador que ignora parte da armadura do alvo.',
                skillDef: { id: 'colosso_golpe_sismico', name: 'Golpe Sísmico', type: 'PHYSICAL', mpCost: 22, powerMulti: 2.1,
                    description: 'Golpe desarmado devastador — dano físico bruto e pesado.' } },
            { id: 'colosso_furia_inquebrantavel', name: 'Fúria Inquebrantável', tier: 3, type: 'passive', cost: 3, requires: ['colosso_pele_de_pedra'],
                description: 'Lutando desarmado com menos de 30% de HP, +15% de dano físico adicional.', statMods: { unarmedDamageBonusPercent: 15 }, lowHpOnly: true },
            { id: 'colosso_avatar_da_montanha', name: 'Avatar da Montanha', tier: 4, type: 'passive', cost: 4, requires: ['colosso_golpe_sismico', 'colosso_furia_inquebrantavel'],
                description: 'Lutando desarmado, +12% de dano físico e +6% de esquiva — a força bruta de Gorkhal em pessoa.', statMods: { unarmedDamageBonusPercent: 12, unarmedDodgeBonusPercent: 6 } }
        ]
    },
    danca: {
        id: 'danca', name: 'Árvore da Dança das Lâminas',
        nodes: [
            { id: 'danca_passos_ligeiros', name: 'Passos Ligeiros', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Com arma leve, +7% de esquiva.', statMods: { lightWeaponDodgeBonusPercent: 7 } },
            { id: 'danca_investida_precisa', name: 'Investida Precisa', tier: 2, type: 'active', cost: 2, requires: ['danca_passos_ligeiros'],
                description: 'Ataque rápido de arma leve com chance elevada de crítico.',
                skillDef: { id: 'danca_investida_precisa', name: 'Investida Precisa', type: 'PHYSICAL', mpCost: 12, powerMulti: 1.15,
                    description: 'Ataque rápido de arma leve — dano físico com técnica de duelo.' } },
            { id: 'danca_reflexos_afiados', name: 'Reflexos Afiados', tier: 2, type: 'passive', cost: 2, requires: ['danca_passos_ligeiros'],
                description: 'Com arma leve, +8 de chance de crítico.', statMods: { lightWeaponCritBonus: 8 } },
            { id: 'danca_valsa_das_laminas', name: 'Valsa das Lâminas', tier: 3, type: 'active', cost: 3, requires: ['danca_investida_precisa'],
                description: 'Sequência de cortes rápidos de arma leve.',
                skillDef: { id: 'danca_valsa_das_laminas', name: 'Valsa das Lâminas', type: 'PHYSICAL', mpCost: 20, powerMulti: 1.9,
                    description: 'Sequência de cortes rápidos — dano físico multiplicado pela técnica.' } },
            { id: 'danca_corte_fatal', name: 'Corte Fatal', tier: 3, type: 'passive', cost: 3, requires: ['danca_reflexos_afiados'],
                description: 'Com arma leve, +10 de chance de crítico adicional.', statMods: { lightWeaponCritBonus: 10 } },
            { id: 'danca_mestre_duelista', name: 'Mestre Duelista', tier: 4, type: 'passive', cost: 4, requires: ['danca_valsa_das_laminas', 'danca_corte_fatal'],
                description: 'Com arma leve, +10% de esquiva e +10 de crítico — a lâmina se torna extensão do corpo.', statMods: { lightWeaponDodgeBonusPercent: 10, lightWeaponCritBonus: 10 } }
        ]
    },
    muralha: {
        id: 'muralha', name: 'Árvore da Muralha de Ferro',
        nodes: [
            { id: 'muralha_postura_defensiva', name: 'Postura Defensiva', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Com escudo equipado, +8 de chance de bloqueio.', statMods: { shieldBlockChanceBonusFlat: 8 } },
            { id: 'muralha_contra_ataque', name: 'Contra-Ataque Ensaiado', tier: 2, type: 'passive', cost: 2, requires: ['muralha_postura_defensiva'],
                description: 'Usar Defender (com escudo equipado) garante +25% de chance de contra-atacar no próximo golpe recebido.', statMods: { shieldCounterChanceBonusFlat: 25 } },
            { id: 'muralha_resistencia_inabalavel', name: 'Resistência Inabalável', tier: 2, type: 'passive', cost: 2, requires: ['muralha_postura_defensiva'],
                description: 'Com escudo equipado, +15% de resistência a efeitos negativos.', statMods: { negativeEffectResistPercent: 15 } },
            { id: 'muralha_escudo_vivo', name: 'Escudo Vivo', tier: 3, type: 'active', cost: 3, requires: ['muralha_contra_ataque'],
                description: 'Ergue uma barreira que reduz 30% do dano recebido por 2 turnos.',
                skillDef: { id: 'muralha_escudo_vivo', name: 'Escudo Vivo', type: 'SHIELD', mpCost: 18, powerMulti: 0,
                    description: 'Barreira defensiva — reduz 30% do dano recebido por 2 turnos.', extra: { shieldPercent: 30, duration: 2 } } },
            { id: 'muralha_baluarte', name: 'Baluarte', tier: 3, type: 'passive', cost: 3, requires: ['muralha_resistencia_inabalavel'],
                description: 'Com escudo equipado, +10 de chance de bloqueio adicional.', statMods: { shieldBlockChanceBonusFlat: 10 } },
            { id: 'muralha_guardiao_inabalavel', name: 'Guardião Inabalável', tier: 4, type: 'passive', cost: 4, requires: ['muralha_escudo_vivo', 'muralha_baluarte'],
                description: 'Com escudo equipado, +8 de bloqueio e +15% de resistência a efeitos negativos — a muralha que Kharzum nunca derrubou.', statMods: { shieldBlockChanceBonusFlat: 8, negativeEffectResistPercent: 15 } }
        ]
    },
    predador: {
        id: 'predador', name: 'Árvore do Caminho do Predador',
        nodes: [
            { id: 'predador_instinto_cacador', name: 'Instinto Caçador', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Com arma de longo alcance ativa, dano à distância +8% (escala com a distância atual em combate).', statMods: { rangedDistanceDamageBonusPercent: 8 } },
            { id: 'predador_passo_fantasma', name: 'Passo Fantasma', tier: 2, type: 'passive', cost: 2, requires: ['predador_instinto_cacador'],
                description: 'Com arma de longo alcance ativa, +1.5 de velocidade ao recuar (recupera distância mais rápido).', statMods: { rangedRetreatSpeedBonusFlat: 1.5 } },
            { id: 'predador_mira_calculada', name: 'Mira Calculada', tier: 2, type: 'passive', cost: 2, requires: ['predador_instinto_cacador'],
                description: 'Com arma de longo alcance ativa, dano à distância +10% adicional (escala com a distância atual).', statMods: { rangedDistanceDamageBonusPercent: 10 } },
            { id: 'predador_tiro_de_precisao', name: 'Tiro de Precisão', tier: 3, type: 'active', cost: 3, requires: ['predador_passo_fantasma'],
                description: 'Disparo poderoso, mais forte quanto maior a distância do alvo.',
                skillDef: { id: 'predador_tiro_de_precisao', name: 'Tiro de Precisão', type: 'PHYSICAL', mpCost: 16, powerMulti: 1.6,
                    description: 'Disparo à distância carregado — dano físico com a arma ativa.' } },
            { id: 'predador_chuva_de_flechas', name: 'Chuva de Flechas', tier: 3, type: 'active', cost: 3, requires: ['predador_mira_calculada'],
                description: 'Rajada de disparos consecutivos à distância.',
                skillDef: { id: 'predador_chuva_de_flechas', name: 'Chuva de Flechas', type: 'PHYSICAL', mpCost: 24, powerMulti: 2.0,
                    description: 'Rajada de disparos consecutivos — dano físico multiplicado.' } },
            { id: 'predador_cacador_supremo', name: 'Caçador Supremo', tier: 4, type: 'passive', cost: 4, requires: ['predador_tiro_de_precisao', 'predador_chuva_de_flechas'],
                description: 'Com arma de longo alcance ativa, dano à distância +12% adicional e recuo +1 de velocidade — o predador nunca deixa o alvo escolher a distância.', statMods: { rangedDistanceDamageBonusPercent: 12, rangedRetreatSpeedBonusFlat: 1 } }
        ]
    }
};
window.COMBAT_STYLE_TREES = COMBAT_STYLE_TREES;

window.CombatStyleSystem = {
    getStyle(styleId) {
        return COMBAT_STYLES[styleId] || null;
    },

    getTree(styleId) {
        return COMBAT_STYLE_TREES[styleId] || null;
    },

    getNode(styleId, nodeId) {
        const tree = COMBAT_STYLE_TREES[styleId];
        if (!tree) return null;
        return tree.nodes.find(n => n.id === nodeId) || null;
    },

    // O jogador precisa ter APRENDIDO o estilo (player.combatStylesLearned)
    // — não precisa ser o estilo ATIVO no momento pra continuar gastando
    // pontos nele (progresso de cada estilo aprendido é preservado
    // independentemente, só a PARTE ATIVA — passivos/habilidades em
    // batalha — depende de qual é o `player.combatStyle` no momento).
    isUnlockable(player, styleId, nodeId) {
        const node = this.getNode(styleId, nodeId);
        if (!node) return false;
        if (!player.combatStylesLearned || !player.combatStylesLearned[styleId]) return false;
        if (player.styleTreeUnlocked && player.styleTreeUnlocked[nodeId]) return false;
        const points = (player.styleSkillPoints && player.styleSkillPoints[styleId]) || 0;
        if (points < node.cost) return false;
        if (node.requires.length === 0) return true;
        return node.requires.some(reqId => player.styleTreeUnlocked && player.styleTreeUnlocked[reqId]);
    },

    unlockNode(player, styleId, nodeId) {
        if (!this.isUnlockable(player, styleId, nodeId)) return false;
        const node = this.getNode(styleId, nodeId);

        player.styleTreeUnlocked = player.styleTreeUnlocked || {};
        player.styleTreeUnlocked[nodeId] = true;
        player.styleSkillPoints = player.styleSkillPoints || {};
        player.styleSkillPoints[styleId] = (player.styleSkillPoints[styleId] || 0) - node.cost;

        if (node.type === 'active' && node.skillDef) {
            registerStyleSkillDef(node.skillDef, styleId);
            if (!player.learnedSkills.includes(node.skillDef.id)) player.learnedSkills.push(node.skillDef.id);
        }

        player.calculateDerivedStats();
        return true;
    },

    getTreeForDisplay(player, styleId) {
        const tree = COMBAT_STYLE_TREES[styleId];
        if (!tree) return null;
        return {
            id: tree.id, name: tree.name,
            nodes: tree.nodes.map(n => ({
                ...n,
                unlocked: !!(player.styleTreeUnlocked && player.styleTreeUnlocked[n.id]),
                unlockable: this.isUnlockable(player, styleId, n.id)
            }))
        };
    },

    // Estilo compatível AGORA (equipamento certo) — item 19 da diretiva:
    // nunca remove equipamento, só informa/bloqueia. Chamado tanto pra
    // decidir se os passivos entram em calculateDerivedStats quanto pra
    // filtrar habilidades de estilo do menu de batalha (ver
    // ui.js openBattleItemMenu/openBattleSkillMenu e battle.js).
    isStyleCompatible(entity, styleId) {
        const style = COMBAT_STYLES[styleId];
        if (!style) return false;
        return style.isCompatible(entity);
    },

    // Soma os statMods dos nós passivos desbloqueados do estilo ATIVO —
    // SÓ conta se o equipamento atual for compatível (ver isStyleCompatible)
    // e, no caso de `lowHpOnly`, só se o HP atual estiver abaixo de 30%.
    // Chamado por Player.calculateDerivedStats().
    sumActiveStylePassives(player) {
        const totals = {};
        COMBAT_STYLE_STAT_KEYS.forEach(k => totals[k] = 0);
        if (!player.combatStyle || !this.isStyleCompatible(player, player.combatStyle)) return totals;
        const tree = COMBAT_STYLE_TREES[player.combatStyle];
        if (!tree || !player.styleTreeUnlocked) return totals;
        const hpFrac = player.derivedStats && player.derivedStats.maxHp ? (player.currentHp / player.derivedStats.maxHp) : 1;

        tree.nodes.forEach(node => {
            if (node.type !== 'passive' || !player.styleTreeUnlocked[node.id]) return;
            if (node.lowHpOnly && hpFrac > 0.3) return;
            if (node.statMods) {
                for (let key in node.statMods) {
                    if (totals[key] !== undefined) totals[key] += node.statMods[key];
                }
            }
        });
        return totals;
    },

    // Nó específico desbloqueado E pertencente ao estilo ATIVO E
    // compatível com o equipamento atual — usado por battle.js pra
    // mecânicas pontuais (ex: Contra-Ataque Ensaiado da Muralha de Ferro,
    // sinergia com Defender) que não são um statMod simples somável em
    // calculateDerivedStats.
    hasActiveStyleNode(entity, nodeId) {
        if (!entity.combatStyle || !this.isStyleCompatible(entity, entity.combatStyle)) return false;
        return !!(entity.styleTreeUnlocked && entity.styleTreeUnlocked[nodeId]);
    },

    // Aprende um estilo novo (pela primeira vez) — só na cidade certa (ver
    // COMBAT_STYLES[id].cityId), custo em ouro fixo, nunca de graça no
    // início do jogo (item 18 da diretiva). Se for o primeiro estilo
    // aprendido, já vira o ATIVO automaticamente; senão, fica disponível
    // pra ativar manualmente (ver Player.setActiveCombatStyle).
    LEARN_COST: 150,
    learnStyle(player, styleId) {
        const style = COMBAT_STYLES[styleId];
        if (!style) return { ok: false, reason: 'Estilo inexistente.' };
        player.combatStylesLearned = player.combatStylesLearned || {};
        if (player.combatStylesLearned[styleId]) return { ok: false, reason: 'Você já aprendeu este estilo.' };
        const currentCityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        if (currentCityId !== style.cityId) return { ok: false, reason: `Só é possível aprender ${style.name} em sua cidade de origem.` };
        if (player.gold < this.LEARN_COST) return { ok: false, reason: 'Ouro insuficiente.' };

        player.gold -= this.LEARN_COST;
        player.combatStylesLearned[styleId] = true;
        player.styleSkillPoints = player.styleSkillPoints || {};
        player.styleSkillPoints[styleId] = (player.styleSkillPoints[styleId] || 0) + 1;
        if (!player.combatStyle) player.combatStyle = styleId;
        player.calculateDerivedStats();
        return { ok: true };
    }
};

// Registra TODAS as habilidades ativas de Estilo em window.SkillDB
// incondicionalmente no carregamento do script — mesmo padrão e mesmo
// motivo de skilltrees.js registerAllMutationSkillDefs (window.SkillDB é
// reconstruído do zero a cada load da página; sem isto, um jogador que já
// tinha desbloqueado uma habilidade de Estilo e desse F5 travaria com
// TypeError na primeira vez que abrisse o menu de batalha).
(function registerAllStyleSkillDefs() {
    for (const styleId in COMBAT_STYLE_TREES) {
        COMBAT_STYLE_TREES[styleId].nodes.forEach(node => {
            if (node.type === 'active' && node.skillDef) {
                registerStyleSkillDef(node.skillDef, styleId);
            }
        });
    }
})();
