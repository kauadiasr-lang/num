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
//
// Iteração 15 — bug de auditoria crítico encontrado (item 31 da
// mega-diretiva): esta lista guardava as CHAVES de template de
// ItemDatabase.weapons ('dagger', 'rapier', ...), mas `entity.equipment
// [MAIN_HAND].id` é o campo `id` do PRÓPRIO template (`w_03`, `w_06`,
// ...), nunca a chave (ver items.js Equipment constructor: `this.id =
// baseTemplate.id`). `LIGHT_WEAPON_IDS.includes(w.id)` comparava 'w_03'
// contra a string 'dagger' — SEMPRE falso, pra QUALQUER arma leve
// equipada. Resultado: Dança das Lâminas nunca esteve realmente "ativa"
// desde que o sistema de Estilos foi implementado (Iteração 1 desta
// mega-atualização) — nenhum statMods de skill tree (lightWeapon*) e
// nenhuma habilidade de estilo dela jamais funcionaram em jogo, apesar
// de tudo estar corretamente cadastrado. Corrigido derivando os ids reais
// a partir das mesmas chaves de template (auto-corrige se qualquer um dos
// 4 templates mudar de `id` no futuro, nunca mais duplica o valor à mão).
const LIGHT_WEAPON_TEMPLATE_KEYS = ['dagger', 'rapier', 'elvenblade', 'shortsword'];
const LIGHT_WEAPON_IDS = LIGHT_WEAPON_TEMPLATE_KEYS.map(k => ItemDatabase.weapons[k].id);

const COMBAT_STYLES = {
    colosso: {
        id: 'colosso', name: 'Punho do Colosso', icon: '👊', cityId: 'fortaleza_orc',
        tagline: 'Lutador corpo a corpo móvel e agressivo — avança rápido, encadeia golpes, contra-ataca.',
        description: 'Estilo desarmado dos treinadores da Fortaleza Orc — nunca usa arma equipada no MAIN_HAND/RANGED. Não é "personagem sem arma": é uma identidade própria de combate, construída em cima de mobilidade (avanços e recuos muito mais rápidos que qualquer arma), agressividade (dano cresce com sequências de golpes e com a proximidade do alvo) e versatilidade elemental (punhos podem ser imbuídos com fogo, gelo, luz ou sombra). Em troca, abre mão do alcance e dos encantamentos permanentes de uma arma de verdade. Independente da (futura) Linhagem Titã.',
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
    // BUFF do Punho do Colosso (item explícito do pedido do usuário — "o
    // bônus de força é insuficiente"): antes o único jeito de fortalecer
    // punhos era um % sobre `str*1.5` (a mesma base fraca de sempre); um
    // usuário de arma soma um `item.damage` FIXO em cima disso, que só
    // cresce com raridade/região — nada no lado desarmado compensava essa
    // ausência estrutural. `unarmedFlatDamageBonus` é o equivalente direto
    // (soma flat, não percentual, ver player.js calculateDerivedStats),
    // `unarmedApproachSpeedBonusFlat`/`unarmedRetreatSpeedBonusFlat`
    // aceleram a movimentação em combate (mesmo padrão de
    // rangedRetreatSpeedBonusFlat do Predador, ver getWeaponSpeed),
    // `unarmedComboDamageBonusPercent` escala com golpes desarmados
    // consecutivos ACERTADOS na mesma batalha (ver battle.js executeAttack
    // `colossoComboStreak`), `unarmedCloseRangeDamageBonusPercent` escala
    // com o quão perto do alvo o golpe foi desferido (distância 0 = bônus
    // cheio, distância 1 = alcance máximo desarmado = bônus zero) —
    // recompensa mecanicamente a identidade de "avançar e golpear de
    // perto", não só narrativamente.
    'unarmedFlatDamageBonus', 'unarmedApproachSpeedBonusFlat', 'unarmedRetreatSpeedBonusFlat',
    'unarmedComboDamageBonusPercent', 'unarmedCloseRangeDamageBonusPercent',
    'lightWeaponDodgeBonusPercent', 'lightWeaponCritBonus',
    'shieldBlockChanceBonusFlat', 'shieldCounterChanceBonusFlat',
    'rangedDistanceDamageBonusPercent', 'rangedRetreatSpeedBonusFlat'
];
window.COMBAT_STYLE_STAT_KEYS = COMBAT_STYLE_STAT_KEYS;

// Punhos Encantados (BUFF do Punho do Colosso — pedido explícito do
// usuário: "permita ENCANTAR OS PRÓPRIOS PUNHOS, fazendo com que ataques
// desarmados possam receber efeitos como fogo, gelo, luz, sombra"). Mesmo
// formato onHit(attacker, defender) do registry ENCHANTMENTS (enchantments.js)
// e de LINEAGE_IMBUES (skilltrees.js) — battle.js _getEffectiveEnchantment
// consome qualquer um dos três por duck typing, nenhuma lógica nova de
// consumo precisa existir. Registry PRÓPRIO (nunca misturado em
// LINEAGE_IMBUES, que pertence a Linhagem) pelo mesmo motivo de
// COMBAT_STYLE_TREES ser separado de SKILL_TREES: Estilo e Linhagem são
// sistemas totalmente independentes. As 4 fórmulas de onHit abaixo
// reaproveitam formatos JÁ testados e em produção — nunca um efeito
// inventado do zero: fogo espelha o encantamento `fogo` (dot de
// queimadura), gelo espelha `gelo` (slowChance), luz espelha
// `fio_consagrado` (dano extra vs. trevas + cura), sombra espelha
// `fio_sombrio` (dano extra escala com o quanto o alvo já está ferido).
const COMBAT_STYLE_IMBUES = {
    colosso_fogo: {
        id: 'colosso_fogo', name: 'Punhos Flamejantes', color: '#ff5a1e',
        description: 'Imbui os punhos com fogo: cada acerto causa dano extra e queima o alvo por 2 turnos.',
        onHit(attacker, defender) {
            const burn = Math.max(2, Math.floor(attacker.getTotalStat('str') * 0.5));
            return { extraDamage: Math.floor(attacker.derivedStats.physicalDamage * 0.15), dot: { type: 'queimadura', turns: 2, damage: burn }, particleColor: '#ff5a1e' };
        }
    },
    colosso_gelo: {
        id: 'colosso_gelo', name: 'Punhos Gélidos', color: '#7ec8e3',
        description: 'Imbui os punhos com gelo: chance de reduzir a velocidade de reação do alvo por 1 turno.',
        onHit(attacker, defender) {
            return { extraDamage: Math.floor(attacker.derivedStats.physicalDamage * 0.08), slowChance: 30, particleColor: '#7ec8e3' };
        }
    },
    colosso_luz: {
        id: 'colosso_luz', name: 'Punhos Radiantes', color: '#fff2c0',
        description: 'Imbui os punhos com luz: dano extra (maior contra inimigos das trevas) e cura uma fração do dano causado.',
        onHit(attacker, defender) {
            const isDarkfoe = defender.lineage === 'vampirismo' || defender.lineage === 'sombras';
            const extra = isDarkfoe ? Math.floor(attacker.derivedStats.physicalDamage * 0.28) : Math.floor(attacker.derivedStats.physicalDamage * 0.10);
            return { extraDamage: extra, healPercent: 10, particleColor: '#fff2c0' };
        }
    },
    colosso_sombra: {
        id: 'colosso_sombra', name: 'Punhos Sombrios', color: '#8a3ae0',
        description: 'Imbui os punhos com sombra: dano extra, tanto maior quanto mais ferido já estiver o alvo.',
        onHit(attacker, defender) {
            const missingPercent = 1 - Utils.clamp(defender.currentHp / defender.derivedStats.maxHp, 0, 1);
            const extra = Math.floor(attacker.derivedStats.physicalDamage * (0.10 + missingPercent * 0.30));
            return { extraDamage: extra, particleColor: '#8a3ae0' };
        }
    }
};
window.COMBAT_STYLE_IMBUES = COMBAT_STYLE_IMBUES;

function registerStyleSkillDef(d, styleId) {
    if (!window.SkillDB[d.id]) {
        window.SkillDB[d.id] = new Skill(d.id, d.name, d.type, d.mpCost, d.powerMulti, d.description, 1, d.extra || {});
        // Marca como exclusiva de Estilo — ui.js openSkillTree() (Mercado
        // Arcano, menu de habilidades COMUM) filtra por essa flag, mesmo
        // padrão de isMutationSkill/isBossSkill (nunca vaza pra lá).
        window.SkillDB[d.id].isStyleSkill = true;
        // Fase 18 da diretiva de balanceamento (Iteração 9) — ver
        // comentário completo em skills.js perto de `window.SkillDB =
        // SkillDatabase`: campo de origem de primeira classe, ao lado da
        // flag booleana já existente (nunca a substitui).
        window.SkillDB[d.id].origin = 'COMBAT_STYLE';
        // A que estilo pertence — battle.js/ui.js usam pra checar
        // CombatStyleSystem.isStyleCompatible antes de deixar usar em
        // combate (ver "item 19 da diretiva": nunca remove o equipamento
        // sozinho, só bloqueia a habilidade incompatível).
        window.SkillDB[d.id].styleId = styleId;
    }
}

const COMBAT_STYLE_TREES = {
    // BUFF COMPLETO do Punho do Colosso (pedido explícito do usuário: "o
    // estilo está muito fraco... transforme em uma opção de combate
    // realmente viável e diferente das armas"). Redesenhada do zero (6 nós
    // rasos → 15 nós em 6 tiers) em torno de uma identidade clara —
    // "lutador corpo a corpo MÓVEL e AGRESSIVO", nunca "personagem sem
    // arma" — em vez de só subir os mesmos dois números de sempre:
    //
    // Tier 1 (raiz dupla): poder bruto (Punho Pesado) e mobilidade (Passo
    // do Touro) nascem SEPARADOS de propósito — o jogador escolhe qual
    // identidade puxar primeiro, os dois convergem de novo no Tier 4.
    // Tier 2: cada raiz se ramifica em uma opção ativa e uma passiva
    // (Investida Bruta+Pele de Pedra da força; Recuo Ágil da mobilidade).
    // Tier 3: aproximação (Avanço Fulminante, "avança mais casas E golpeia"),
    // defesa reativa (Contra-Golpe, esquiva vira contra-ataque) e evasão
    // ativa (Reviravolta, recuo + esquiva temporária) — as 3 mecânicas de
    // "recuo/esquiva própria do estilo" e "contra-ataque" pedidas.
    // Tier 4: as duas metades convergem — Golpe Sísmico (poder, agora com
    // perfuração de armadura de verdade, não só na descrição) e Fúria do
    // Combate (combo consecutivo + bônus de proximidade, as duas mecânicas
    // "dano aumenta conforme se aproxima/mantém sequência").
    // Tier 5: escolha real entre 4 imbuições elementais (Punhos Encantados,
    // pedido explícito) — cada uma custa pontos própria, nunca todas de
    // graça juntas.
    // Tier 6: capstone, exige qualquer imbuição já escolhida.
    colosso: {
        id: 'colosso', name: 'Árvore do Punho do Colosso',
        nodes: [
            // --- Tier 1: raiz dupla (poder vs. mobilidade) ---
            { id: 'colosso_punho_pesado', name: 'Punho Pesado', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Lutando desarmado, +22% de dano físico e +5 de dano físico direto (o "peso de arma" que os punhos nunca tinham).',
                statMods: { unarmedDamageBonusPercent: 22, unarmedFlatDamageBonus: 5 } },
            { id: 'colosso_passo_do_touro', name: 'Passo do Touro', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Lutando desarmado, +1.5 de velocidade ao avançar — fecha distância muito mais rápido que qualquer arma.',
                statMods: { unarmedApproachSpeedBonusFlat: 1.5 } },
            // --- Tier 2: cada raiz se ramifica ---
            { id: 'colosso_investida_bruta', name: 'Investida Bruta', tier: 2, type: 'active', cost: 2, requires: ['colosso_punho_pesado'],
                description: 'Golpe desarmado pesado com chance de atordoar o alvo e empurrá-lo pra trás com o impacto.',
                skillDef: { id: 'colosso_investida_bruta', name: 'Investida Bruta', type: 'STUN', mpCost: 14, powerMulti: 1.4,
                    description: 'Golpe desarmado pesado — dano físico, 30% de chance de atordoar e empurra o alvo pra trás.', extra: { stunChance: 30, knockbackAmount: 1.5, cooldown: 3 } } },
            { id: 'colosso_pele_de_pedra', name: 'Pele de Pedra', tier: 2, type: 'passive', cost: 2, requires: ['colosso_punho_pesado'],
                description: 'Lutando desarmado, +8% de esquiva (reflexos livres de peso de arma).', statMods: { unarmedDodgeBonusPercent: 8 } },
            { id: 'colosso_recuo_agil', name: 'Recuo Ágil', tier: 2, type: 'passive', cost: 2, requires: ['colosso_passo_do_touro'],
                description: 'Lutando desarmado, +1.5 de velocidade ao recuar — abre distância pra respirar ou preparar o próximo avanço.',
                statMods: { unarmedRetreatSpeedBonusFlat: 1.5 } },
            // --- Tier 3: aproximação, defesa reativa, evasão ativa ---
            { id: 'colosso_avanco_fulminante', name: 'Avanço Fulminante', tier: 3, type: 'active', cost: 3, requires: ['colosso_passo_do_touro'],
                description: 'Fecha a distância inteira num único movimento fulminante e golpeia o alvo em seguida — a técnica de aproximação rápida do estilo.',
                skillDef: { id: 'colosso_avanco_fulminante', name: 'Avanço Fulminante', type: 'PHYSICAL', mpCost: 18, powerMulti: 1.3,
                    description: 'Avança várias casas de uma vez em direção ao alvo e desfere um golpe desarmado — funciona de qualquer distância.', extra: { range: 10, rushDistance: 6.5, cooldown: 2 } } },
            { id: 'colosso_contra_golpe', name: 'Contra-Golpe', tier: 3, type: 'passive', cost: 3, requires: ['colosso_pele_de_pedra'],
                description: 'Lutando desarmado, esquivar com sucesso dá chance de contra-atacar imediatamente — a esquiva vira oportunidade, não só defesa.' },
            { id: 'colosso_reviravolta', name: 'Reviravolta', tier: 3, type: 'active', cost: 3, requires: ['colosso_recuo_agil'],
                description: 'Recua com um salto brusco e fica com reflexos afiados por 2 turnos — a técnica de recuo/esquiva própria do estilo.',
                skillDef: { id: 'colosso_reviravolta', name: 'Reviravolta', type: 'EVASION', mpCost: 16, powerMulti: 0,
                    description: 'Recua bruscamente e ganha +22% de esquiva por 2 turnos.', extra: { evasionBonus: 22, duration: 2, retreatDistance: 3, cooldown: 4 } } },
            // --- Tier 4: convergência (poder vs. mobilidade se encontram) ---
            { id: 'colosso_golpe_sismico', name: 'Golpe Sísmico', tier: 4, type: 'active', cost: 3, requires: ['colosso_investida_bruta'],
                description: 'Golpe desarmado devastador que realmente ignora parte da armadura do alvo.',
                skillDef: { id: 'colosso_golpe_sismico', name: 'Golpe Sísmico', type: 'PHYSICAL', mpCost: 22, powerMulti: 2.3,
                    description: 'Golpe desarmado devastador — dano físico bruto e pesado, ignorando 25% da Defesa do alvo.', extra: { armorPierce: 0.25, cooldown: 3 } } },
            { id: 'colosso_furia_do_combate', name: 'Fúria do Combate', tier: 4, type: 'passive', cost: 3, requires: ['colosso_contra_golpe', 'colosso_reviravolta'],
                description: 'Lutando desarmado, cada golpe consecutivo ACERTADO na batalha aumenta o próximo em dano (até um teto), e golpear bem de perto (colado no alvo) causa ainda mais dano — a identidade "avançar e golpear" vira número de verdade.',
                statMods: { unarmedComboDamageBonusPercent: 5, unarmedCloseRangeDamageBonusPercent: 14 } },
            // --- Tier 5: Punhos Encantados — escolha real entre 4 elementos ---
            { id: 'colosso_punhos_flamejantes', name: 'Punhos Flamejantes', tier: 5, type: 'active', cost: 4, requires: ['colosso_furia_do_combate', 'colosso_golpe_sismico'],
                description: 'Desbloqueia Punhos Flamejantes: imbui os próprios punhos com fogo por vários turnos.',
                skillDef: { id: 'colosso_punhos_flamejantes_skill', name: 'Punhos Flamejantes', type: 'IMBUE_WEAPON', mpCost: 16, powerMulti: 1,
                    description: 'Imbui os punhos com fogo: todo acerto desarmado causa dano extra e queima o alvo por 2 turnos, por 4 turnos.', extra: { imbueEnchantId: 'colosso_fogo', duration: 4, cooldown: 5 } } },
            { id: 'colosso_punhos_gelidos', name: 'Punhos Gélidos', tier: 5, type: 'active', cost: 4, requires: ['colosso_furia_do_combate', 'colosso_golpe_sismico'],
                description: 'Desbloqueia Punhos Gélidos: imbui os próprios punhos com gelo por vários turnos.',
                skillDef: { id: 'colosso_punhos_gelidos_skill', name: 'Punhos Gélidos', type: 'IMBUE_WEAPON', mpCost: 16, powerMulti: 1,
                    description: 'Imbui os punhos com gelo: todo acerto desarmado tem chance de reduzir a reação do alvo, por 4 turnos.', extra: { imbueEnchantId: 'colosso_gelo', duration: 4, cooldown: 5 } } },
            { id: 'colosso_punhos_radiantes', name: 'Punhos Radiantes', tier: 5, type: 'active', cost: 4, requires: ['colosso_furia_do_combate', 'colosso_golpe_sismico'],
                description: 'Desbloqueia Punhos Radiantes: imbui os próprios punhos com luz por vários turnos.',
                skillDef: { id: 'colosso_punhos_radiantes_skill', name: 'Punhos Radiantes', type: 'IMBUE_WEAPON', mpCost: 16, powerMulti: 1,
                    description: 'Imbui os punhos com luz: todo acerto desarmado causa dano extra (mais contra inimigos das trevas) e cura você, por 4 turnos.', extra: { imbueEnchantId: 'colosso_luz', duration: 4, cooldown: 5 } } },
            { id: 'colosso_punhos_sombrios', name: 'Punhos Sombrios', tier: 5, type: 'active', cost: 4, requires: ['colosso_furia_do_combate', 'colosso_golpe_sismico'],
                description: 'Desbloqueia Punhos Sombrios: imbui os próprios punhos com sombra por vários turnos.',
                skillDef: { id: 'colosso_punhos_sombrios_skill', name: 'Punhos Sombrios', type: 'IMBUE_WEAPON', mpCost: 16, powerMulti: 1,
                    description: 'Imbui os punhos com sombra: todo acerto desarmado causa mais dano quanto mais ferido o alvo já estiver, por 4 turnos.', extra: { imbueEnchantId: 'colosso_sombra', duration: 4, cooldown: 5 } } },
            // --- Tier 6: capstone ---
            { id: 'colosso_avatar_da_montanha', name: 'Avatar da Montanha', tier: 6, type: 'passive', cost: 5,
                requires: ['colosso_punhos_flamejantes', 'colosso_punhos_gelidos', 'colosso_punhos_radiantes', 'colosso_punhos_sombrios'],
                description: 'Lutando desarmado, +12% de dano físico, +5 de dano físico direto e +8% de esquiva — a força bruta de Gorkhal em pessoa.',
                statMods: { unarmedDamageBonusPercent: 12, unarmedFlatDamageBonus: 5, unarmedDodgeBonusPercent: 8 } }
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
                description: 'Com arma leve, +10% de esquiva e +10 de crítico — a lâmina se torna extensão do corpo.', statMods: { lightWeaponDodgeBonusPercent: 10, lightWeaponCritBonus: 10 } },
            // Mecânica nova (pedido explícito: "quero mecânicas novas em
            // cada um", não só mais um bônus percentual) — Fluxo: um
            // contador que sobe a cada ESQUIVA bem-sucedida nesta batalha
            // (ver battle.js executeAttack, ramo de esquiva/`dancaFluxoStreak`)
            // e zera ao ser atingido — o oposto de `colossoComboStreak`
            // (que sobe ao ACERTAR). Investida do Vazio consome todo o
            // Fluxo acumulado num só golpe: recompensa reflexo defensivo, não
            // agressão pura, dando à Dança uma identidade mecânica própria em
            // vez de reciclar a do Punho do Colosso com nomes diferentes.
            { id: 'danca_investida_do_vazio', name: 'Investida do Vazio', tier: 5, type: 'active', cost: 4, requires: ['danca_mestre_duelista'],
                description: 'Ataque fulminante que consome todo o Fluxo acumulado por esquivas bem-sucedidas nesta batalha — quanto mais você desviou, mais forte o golpe (efeito consumido ao usar).',
                skillDef: { id: 'danca_investida_do_vazio', name: 'Investida do Vazio', type: 'PHYSICAL', mpCost: 20, powerMulti: 1.3,
                    description: 'Ataque de arma leve que consome o Fluxo (esquivas bem-sucedidas) — dano físico escalado pelo Fluxo acumulado.',
                    extra: { consumesStreak: 'dancaFluxoStreak', streakDamageMultPerStack: 12, streakDamageCapPercent: 60 } } },
            { id: 'danca_espirito_etereo', name: 'Espírito Etéreo', tier: 6, type: 'passive', cost: 5, requires: ['danca_investida_do_vazio'],
                description: 'Com arma leve, +12% de esquiva e +12 de crítico — o corpo se torna quase intangível em pleno combate.', statMods: { lightWeaponDodgeBonusPercent: 12, lightWeaponCritBonus: 12 } }
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
                description: 'Com escudo equipado, +8 de bloqueio e +15% de resistência a efeitos negativos — a muralha que Kharzum nunca derrubou.', statMods: { shieldBlockChanceBonusFlat: 8, negativeEffectResistPercent: 15 } },
            // Mecânica nova — Postura: um contador que sobe a cada
            // BLOQUEIO bem-sucedido nesta batalha (ver battle.js
            // executeAttack, ramo de bloqueio/`muralhaPosturaStacks`) e
            // zera quando um golpe passa sem ser bloqueado. Diferente de
            // `muralhaCounterBonus` (bônus de UM turno só, concedido só por
            // escolher Defender) — Postura acumula ao longo da batalha
            // inteira e é descarregada de propósito em Fúria Retida,
            // recompensando quem segura a linha por vários turnos seguidos.
            { id: 'muralha_furia_retida', name: 'Fúria Retida', tier: 5, type: 'active', cost: 4, requires: ['muralha_guardiao_inabalavel'],
                description: 'Descarrega toda a Postura acumulada por bloqueios bem-sucedidos nesta batalha num golpe de escudo devastador (efeito consumido ao usar).',
                skillDef: { id: 'muralha_furia_retida', name: 'Fúria Retida', type: 'PHYSICAL', mpCost: 20, powerMulti: 1.1,
                    description: 'Golpe de escudo que consome a Postura (bloqueios bem-sucedidos) — dano físico escalado pela Postura acumulada.',
                    extra: { consumesStreak: 'muralhaPosturaStacks', streakDamageMultPerStack: 15, streakDamageCapPercent: 75 } } },
            { id: 'muralha_baluarte_eterno', name: 'Baluarte Eterno', tier: 6, type: 'passive', cost: 5, requires: ['muralha_furia_retida'],
                description: 'Com escudo equipado, +10 de bloqueio e +20% de resistência a efeitos negativos — a muralha que se tornou lenda.', statMods: { shieldBlockChanceBonusFlat: 10, negativeEffectResistPercent: 20 } }
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
                description: 'Com arma de longo alcance ativa, dano à distância +12% adicional e recuo +1 de velocidade — o predador nunca deixa o alvo escolher a distância.', statMods: { rangedDistanceDamageBonusPercent: 12, rangedRetreatSpeedBonusFlat: 1 } },
            // Mecânica nova — Tensão: um contador que sobe a cada turno em
            // que o jogador escolhe Manter Distância ou Recuar nesta
            // batalha (ver battle.js executePlayerTurn/`predadorTensaoStacks`)
            // e zera ao escolher Aproximar/Correr/Investida (fechar a
            // distância de propósito) — recompensa POSICIONAMENTO paciente,
            // não só "atire mais forte": um jogador que passa o combate
            // todo mantendo distância acumula um tiro final devastador.
            { id: 'predador_tiro_da_paciencia', name: 'Tiro da Paciência', tier: 5, type: 'active', cost: 4, requires: ['predador_cacador_supremo'],
                description: 'Um tiro carregado por cada turno de paciência mantendo distância nesta batalha — quanto mais você esperou, mais devastador (efeito consumido ao usar).',
                skillDef: { id: 'predador_tiro_da_paciencia', name: 'Tiro da Paciência', type: 'PHYSICAL', mpCost: 20, powerMulti: 1.2,
                    description: 'Disparo à distância que consome a Tensão (turnos mantendo distância) — dano físico escalado pela Tensão acumulada.',
                    extra: { consumesStreak: 'predadorTensaoStacks', streakDamageMultPerStack: 14, streakDamageCapPercent: 70 } } },
            { id: 'predador_olho_paciente', name: 'Olho Paciente', tier: 6, type: 'passive', cost: 5, requires: ['predador_tiro_da_paciencia'],
                description: 'Com arma de longo alcance ativa, dano à distância +15% adicional e recuo +1.5 de velocidade — a presa nunca escapa de quem sabe esperar.', statMods: { rangedDistanceDamageBonusPercent: 15, rangedRetreatSpeedBonusFlat: 1.5 } }
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
    // Balanceamento (Iteração 21) — achado #11 do Diagnóstico da Arena:
    // o primeiro Estilo colide direto com o Problema #5 (crise de ouro
    // cedo no jogo) bem no momento em que o jogador mais precisaria de
    // uma vantagem. A solução recomendada era reduzir o custo OU torná-lo
    // gratuito — mas o próprio comentário acima ("nunca de graça no
    // início do jogo, item 18 da diretiva") registra uma decisão de
    // design deliberada de uma diretiva anterior. Em vez de violar essa
    // regra, aplica a outra metade da recomendação: metade do preço só
    // no PRIMEIRO estilo aprendido (nunca fica de graça, mas fica
    // acessível). A viagem em si nunca foi o problema real (testes do
    // Diagnóstico confirmaram aprendizado bem-sucedido na cidade natal).
    FIRST_STYLE_DISCOUNT: 0.5,
    learnStyle(player, styleId) {
        const style = COMBAT_STYLES[styleId];
        if (!style) return { ok: false, reason: 'Estilo inexistente.' };
        player.combatStylesLearned = player.combatStylesLearned || {};
        if (player.combatStylesLearned[styleId]) return { ok: false, reason: 'Você já aprendeu este estilo.' };
        const currentCityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        if (currentCityId !== style.cityId) return { ok: false, reason: `Só é possível aprender ${style.name} em sua cidade de origem.` };
        const isFirstStyle = Object.keys(player.combatStylesLearned).length === 0;
        const cost = isFirstStyle ? Math.round(this.LEARN_COST * this.FIRST_STYLE_DISCOUNT) : this.LEARN_COST;
        if (player.gold < cost) return { ok: false, reason: 'Ouro insuficiente.' };

        player.gold -= cost;
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
