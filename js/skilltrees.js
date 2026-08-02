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

// Registra uma definição de habilidade ativa de Mutação no MESMO banco
// usado pelas habilidades comuns (window.SkillDB) — assim ela aparece
// automaticamente no menu de Habilidade já existente em batalha, sem
// precisar de nenhuma tela nova. Extraído pra função própria (ver
// registerAllMutationSkillDefs no fim do arquivo) pra nunca duplicar essa
// lógica entre o registro incondicional no boot e o registro pontual
// dentro de unlockNode.
// Imbuições de arma temporárias (item 14 da auditoria de balanceamento):
// mesmo formato onHit(attacker, defender) do registry ENCHANTMENTS (ver
// enchantments.js) — attach nele diretamente NÃO seria certo, pois ui.js
// (openInventory/renderEnchantments) monta o menu de Encantamentos
// iterando Object.keys(ENCHANTMENTS) inteiro; uma entrada ali viraria
// comprável/aplicável em QUALQUER item pela loja comum, quebrando a regra
// de que uma imbuição de Linhagem só existe temporariamente, via
// habilidade da árvore de Mutação (ver SKILL_TYPES.IMBUE_WEAPON). Registry
// próprio e completamente separado; battle.js executeAttack só lê o
// formato (duck typing), então nenhuma mudança é necessária na lógica de
// consumo de encantamento já existente.
const LINEAGE_IMBUES = {
    fio_sanguinario: {
        id: 'fio_sanguinario', name: 'Fio Sanguinário', color: '#8a1030',
        description: 'Imbuição de Vampirismo: cada acerto rouba uma fração extra do dano causado como HP.',
        onHit(attacker, defender) {
            return { extraDamage: 0, lifestealPercent: 22, particleColor: '#8a1030' };
        }
    },
    fio_consagrado: {
        id: 'fio_consagrado', name: 'Fio Consagrado', color: '#fff2c0',
        description: 'Imbuição da Luz: cada acerto causa dano sagrado extra (mais contra inimigos das trevas) e cura uma fração do dano causado.',
        onHit(attacker, defender) {
            const isDarkfoe = defender.lineage === 'vampirismo' || defender.lineage === 'sombras';
            const extra = isDarkfoe ? Math.floor(attacker.derivedStats.physicalDamage * 0.25) : Math.floor(attacker.derivedStats.physicalDamage * 0.12);
            return { extraDamage: extra, healPercent: 10, particleColor: '#fff2c0' };
        }
    }
};
window.LINEAGE_IMBUES = LINEAGE_IMBUES;

function registerMutationSkillDef(d) {
    if (!window.SkillDB[d.id]) {
        window.SkillDB[d.id] = new Skill(d.id, d.name, d.type, d.mpCost, d.powerMulti, d.description, 1, d.extra || {});
        // Marca como exclusiva de Linhagem — ui.js openSkillTree() (Mercado
        // Arcano, o menu de habilidades COMUM) filtra por essa flag, senão
        // a habilidade "vazava" pra lá depois de desbloqueada pela árvore
        // de Mutação, confundindo as duas árvores (que devem ficar
        // completamente separadas).
        window.SkillDB[d.id].isMutationSkill = true;
    }
}

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
            // Maldição Sanguínea (item 9 da auditoria de balanceamento):
            // antes o ramo vigília->instinto (tier 1->2) só levava a nós
            // PASSIVOS (furia_fome/sanguinario, tier 3/4) — nenhum dos 3
            // caminhos de raiz da árvore de Vampirismo tinha uma habilidade
            // ATIVA própria nascendo do "instinto predatório", só do "sede"
            // (presas) e do "sangue" (sangue_por_sangue). Além de fechar
            // essa lacuna estrutural, cobre a identidade "maldição" pedida
            // explicitamente (junto de roubo de vida/sangramento/mordida já
            // cobertos, e névoa/sombras já coberto por Véu da Noite abaixo)
            // — a Luz nunca amaldiçoa o oponente, só cura/protege/nuka à
            // distância, então este é o primeiro nó de QUALQUER árvore que
            // enfraquece o ALVO em vez de fortalecer quem lança.
            { id: 'vam_maldicao_sanguinea', name: 'Maldição Sanguínea', tier: 3, type: 'active', cost: 1, requires: ['vam_instinto'],
                description: 'Desbloqueia Maldição Sanguínea: amaldiçoa o inimigo, enfraquecendo sua Defesa por vários turnos.',
                skillDef: { id: 'maldicao_sanguinea', name: 'Maldição Sanguínea', type: 'CURSE', mpCost: 18, powerMulti: 0.7,
                    description: 'Amaldiçoa o inimigo: causa dano e reduz sua Defesa em 25% por 3 turnos. Usa o alcance da sua arma.', extra: { curseDefensePercent: 25, duration: 3, cooldown: 3 } } },
            // Fio Sanguinário (item 14 da auditoria de balanceamento): antes
            // NENHUM nó de nenhuma árvore imbuía a própria arma temporariamente
            // — só existiam bônus passivos permanentes (statMods) e golpes
            // avulsos (LIFESTEAL/BLEED/CURSE, dano numa tacada só). Este nó
            // muda o que a arma FAZ em todo acerto físico por várias tacadas
            // seguidas, igual trocar de Encantamento por N turnos (ver
            // skilltrees.js LINEAGE_IMBUES e battle.js executeAttack) — nó
            // novo, puramente aditivo, não altera nenhum requires existente.
            { id: 'vam_fio_sanguinario', name: 'Fio Sanguinário', tier: 3, type: 'active', cost: 1, requires: ['vam_presas'],
                description: 'Desbloqueia Fio Sanguinário: imbui sua arma com sede de sangue por vários turnos.',
                skillDef: { id: 'fio_sanguinario_skill', name: 'Fio Sanguinário', type: 'IMBUE_WEAPON', mpCost: 16, powerMulti: 1,
                    description: 'Imbui sua arma equipada: todo acerto físico rouba 22% do dano causado como HP, por 4 turnos.', extra: { imbueEnchantId: 'fio_sanguinario', duration: 4, cooldown: 5 } } },

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
            // Fio Consagrado (item 14 da auditoria de balanceamento): mesmo
            // motivo do Fio Sanguinário na árvore de Vampirismo — a Luz tinha
            // cura/proteção/dano à distância, mas nada que imbuísse a própria
            // arma equipada por um período. Nó novo (tier 2, ramo da
            // Couraça), puramente aditivo.
            { id: 'luz_fio_consagrado', name: 'Fio Consagrado', tier: 2, type: 'active', cost: 1, requires: ['luz_root_couraca'],
                description: 'Desbloqueia Fio Consagrado: imbui sua arma com poder sagrado por vários turnos.',
                skillDef: { id: 'fio_consagrado_skill', name: 'Fio Consagrado', type: 'IMBUE_WEAPON', mpCost: 16, powerMulti: 1,
                    description: 'Imbui sua arma equipada: todo acerto físico causa dano sagrado extra (mais contra inimigos das trevas) e cura uma fração do dano causado, por 4 turnos.', extra: { imbueEnchantId: 'fio_consagrado', duration: 4, cooldown: 5 } } },
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
    },

    // Árvore da Linhagem SECUNDÁRIA da Natureza (ver nature.js) — focada em
    // suporte (cura, raízes, espinhos, regeneração, resistências,
    // espíritos), NUNCA compete diretamente com o dano de uma linhagem
    // PRINCIPAL (Vampirismo/Luz/Sombras/Titã). Todos os ids têm o prefixo
    // `nat_` de propósito: o mesmo dicionário `player.skillTreeUnlocked` é
    // compartilhado entre TODAS as árvores do jogo (ver comentário em
    // player.js), então prefixos distintos por linhagem são o que evita
    // colisão de chave entre árvores diferentes.
    natureza: {
        id: 'natureza', name: 'Árvore da Natureza',
        nodes: [
            // --- Tier 1: raízes ---
            { id: 'nat_root_cura', name: 'Seiva Curativa', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Aumenta em 10% o poder de cura de poções e habilidades.', statMods: { healPowerBonusPercent: 10 } },
            { id: 'nat_root_raizes', name: 'Raízes Profundas', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Aumenta a Defesa em 8%.', statMods: { defenseBonusPercent: 8 } },
            { id: 'nat_root_regen', name: 'Regeneração Silvestre', tier: 1, type: 'passive', cost: 1, requires: [],
                description: 'Regenera 2% do HP máximo no início de cada turno.', statMods: { hpRegenPerTurn: 2 } },

            // --- Tier 2 ---
            { id: 'nat_toque_vital', name: 'Toque Vital', tier: 2, type: 'active', cost: 1, requires: ['nat_root_cura'],
                description: 'Desbloqueia Toque Vital: cura uma boa quantidade de HP com o poder da Natureza.',
                skillDef: { id: 'nat_toque_vital_skill', name: 'Toque Vital', type: 'HEAL', mpCost: 18, powerMulti: 1.5,
                    description: 'Cura o próprio gladiador com o poder curativo da Natureza.' } },
            { id: 'nat_espinhos', name: 'Investida de Espinhos', tier: 2, type: 'active', cost: 1, requires: ['nat_root_raizes'],
                description: 'Desbloqueia Investida de Espinhos: um golpe de raízes afiadas que causa sangramento contínuo.',
                skillDef: { id: 'nat_espinhos_skill', name: 'Investida de Espinhos', type: 'BLEED', mpCost: 16, powerMulti: 0.95,
                    description: 'Golpe de raízes afiadas que causa sangramento contínuo no alvo.', extra: { duration: 3, bleedMulti: 0.35 } } },
            { id: 'nat_resistencia', name: 'Casca Resistente', tier: 2, type: 'passive', cost: 1, requires: ['nat_root_regen'],
                description: 'Reduz em 15% os efeitos negativos sofridos (venenos, maldições, atordoamentos).', statMods: { negativeEffectResistPercent: 15 } },

            // --- Tier 3 ---
            { id: 'nat_purificacao', name: 'Purificação', tier: 3, type: 'active', cost: 2, requires: ['nat_toque_vital'],
                description: 'Desbloqueia Casulo de Espinhos: uma barreira de raízes reduz o dano recebido por alguns turnos.',
                skillDef: { id: 'nat_casulo_skill', name: 'Casulo de Espinhos', type: 'SHIELD', mpCost: 20, powerMulti: 1,
                    description: 'Uma barreira de raízes e espinhos reduz o dano recebido por alguns turnos.', extra: { duration: 3, shieldPercent: 30 } } },
            { id: 'nat_espiritos', name: 'Espíritos Guardiões', tier: 3, type: 'passive', cost: 2, requires: ['nat_espinhos', 'nat_resistencia'],
                description: 'Reduz em 25% o dano recebido de sangramento.', statMods: { bleedResistPercent: 25 } },

            // --- Tier 4: capstone ---
            { id: 'nat_guardiao_floresta', name: 'Guardião da Floresta', tier: 4, type: 'passive', cost: 3, requires: ['nat_purificacao', 'nat_espiritos'],
                description: 'Regenera mais 4% do HP máximo no início de cada turno (soma com a Regeneração Silvestre).', statMods: { hpRegenPerTurn: 4 } }
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
    // jogador — PRINCIPAL (player.lineage) OU SECUNDÁRIA
    // (player.secondaryLineage, ver nature.js: a Linhagem da Natureza NUNCA
    // ocupa player.lineage, pra poder coexistir com qualquer linhagem
    // principal) — ele ainda não foi desbloqueado, o jogador tem pontos
    // suficientes NO POOL CERTO (ver _pointsFieldFor), e (é raiz OU pelo
    // menos um pré-requisito já foi desbloqueado) — é essa condição "OR"
    // que torna a árvore um grafo ramificado de verdade, nunca uma
    // corrente linear única.
    isUnlockable(player, treeId, nodeId) {
        const node = this.getNode(treeId, nodeId);
        if (!node) return false;
        if (player.lineage !== treeId && player.secondaryLineage !== treeId) return false;
        if (player.skillTreeUnlocked && player.skillTreeUnlocked[nodeId]) return false;
        const pointsField = this._pointsFieldFor(player, treeId);
        if ((player[pointsField] || 0) < node.cost) return false;
        if (node.requires.length === 0) return true;
        return node.requires.some(reqId => player.skillTreeUnlocked && player.skillTreeUnlocked[reqId]);
    },

    // Qual campo do Player guarda os pontos de talento de uma árvore
    // específica — a Linhagem PRINCIPAL sempre gasta de
    // `mutationSkillPoints`; a Linhagem SECUNDÁRIA da Natureza tem seu
    // PRÓPRIO pool (`natureSkillPoints`), inteiramente separado, já que as
    // duas podem estar ativas ao mesmo tempo no mesmo personagem — gastar
    // pontos de uma nunca deve afetar a outra.
    _pointsFieldFor(player, treeId) {
        return player.secondaryLineage === treeId ? 'natureSkillPoints' : 'mutationSkillPoints';
    },

    unlockNode(player, treeId, nodeId) {
        if (!this.isUnlockable(player, treeId, nodeId)) return false;
        const node = this.getNode(treeId, nodeId);

        player.skillTreeUnlocked = player.skillTreeUnlocked || {};
        player.skillTreeUnlocked[nodeId] = true;
        const pointsField = this._pointsFieldFor(player, treeId);
        player[pointsField] -= node.cost;

        if (node.type === 'active' && node.skillDef) {
            // Registra a habilidade ativa no MESMO banco usado pelas
            // habilidades comuns (window.SkillDB) — assim ela aparece
            // automaticamente no menu de Habilidade já existente em
            // batalha, sem precisar de nenhuma tela nova. A própria
            // definição já é registrada incondicionalmente no boot (ver
            // registerAllMutationSkillDefs() no fim do arquivo), então
            // esta chamada aqui é só uma segunda garantia idempotente.
            registerMutationSkillDef(node.skillDef);
            if (!player.learnedSkills.includes(node.skillDef.id)) player.learnedSkills.push(node.skillDef.id);
        }

        player.calculateDerivedStats();
        return true;
    },

    // Soma os statMods de UMA árvore específica (nós passivos já
    // desbloqueados) — extraído de sumPassiveStats/sumSecondaryPassiveStats
    // abaixo pra nunca duplicar essa lógica de agregação entre a Linhagem
    // PRINCIPAL e a SECUNDÁRIA.
    _sumTreePassives(player, treeId) {
        const totals = {};
        MUTATION_STAT_KEYS.forEach(k => totals[k] = 0);
        totals.specials = [];
        const tree = SKILL_TREES[treeId];
        if (!tree || !player.skillTreeUnlocked) return totals;

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

    // Soma todos os statMods dos nós passivos desbloqueados da árvore da
    // linhagem PRINCIPAL ativa do jogador — chamado por
    // Player.calculateDerivedStats(). Também retorna quais nós "especiais"
    // (sem statMods numéricos simples, ex: auto_revive_heal) estão ativos,
    // pra battle.js consultar.
    sumPassiveStats(player) {
        if (!player.lineage) {
            const empty = {};
            MUTATION_STAT_KEYS.forEach(k => empty[k] = 0);
            empty.specials = [];
            return empty;
        }
        return this._sumTreePassives(player, player.lineage);
    },

    // Mesma soma, mas para a Linhagem SECUNDÁRIA da Natureza (ver
    // nature.js) — só contribui enquanto o Amuleto do Guardião estiver DE
    // FATO EQUIPADO (NatureSystem.isActive). Removê-lo (pra mochila) ou
    // vendê-lo desativa os poderes imediatamente, mas NUNCA apaga o
    // progresso já salvo em skillTreeUnlocked/natureSkillPoints —
    // reequipar (ou obter outro) reativa tudo de novo, do zero de estado
    // salvo, sem perder nenhum nó já desbloqueado.
    sumSecondaryPassiveStats(player) {
        const empty = {};
        MUTATION_STAT_KEYS.forEach(k => empty[k] = 0);
        empty.specials = [];
        if (!player.secondaryLineage || !window.NatureSystem || !window.NatureSystem.isActive(player)) return empty;
        return this._sumTreePassives(player, player.secondaryLineage);
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

// Registra TODAS as habilidades ativas de Mutação em window.SkillDB
// incondicionalmente no carregamento do script — mesmo padrão de
// bossai.js registerBossSkills() (registro no boot, independente de
// histórico de sessão).
//
// Bug de auditoria: antes, a ÚNICA forma de uma dessas habilidades entrar
// em SkillDB era unlockNode() rodar de verdade, no momento exato do
// desbloqueio. Como window.SkillDB é reconstruído do zero a cada load da
// página (ver skills.js, só as ~9 habilidades comuns), um jogador que já
// tinha desbloqueado uma habilidade de Mutação (ex: Presas Longas) e desse
// F5/recarregasse a página perdia a entrada em SkillDB, mas
// `player.learnedSkills` (persistido no save) continuava listando o id —
// o menu de habilidades de batalha (ui.js openBattleSkillMenu) e a
// execução de habilidade (battle.js) leem `window.SkillDB[skillId]` sem
// checar undefined, então travavam com TypeError na primeira vez que o
// jogador abrisse o menu de batalha depois do reload. Registrar todas
// incondicionalmente no boot, como qualquer habilidade comum, resolve de
// vez — independe de quando/se o nó já foi desbloqueado nesta sessão.
(function registerAllMutationSkillDefs() {
    for (const treeId in SKILL_TREES) {
        SKILL_TREES[treeId].nodes.forEach(node => {
            if (node.type === 'active' && node.skillDef) {
                registerMutationSkillDef(node.skillDef);
            }
        });
    }
})();
