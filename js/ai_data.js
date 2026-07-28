/**
 * Dados da IA de Combate (Personalidades, Estilos de Luta, Arquétipos Raros, Combos)
 *
 * Tudo aqui é dado puro — nenhuma lógica de decisão mora neste arquivo (isso fica
 * em ai.js). Adicionar um inimigo novo, uma personalidade nova ou um estilo novo
 * é só adicionar uma entrada nova numa destas tabelas; o motor de IA (ai.js) já
 * sabe lidar com qualquer combinação sem precisar de código extra.
 *
 * Cada personalidade é um vetor de pesos comportamentais — nunca um multiplicador
 * de dano. Duas personalidades com o mesmo estilo de luta produzem tomadas de
 * decisão visivelmente diferentes (frequência de ataque, distância ideal,
 * agressividade, uso de habilidades/itens, perseguição, recuo, blefe, etc).
 */

// --- PERSONALIDADES (16 perfis comportamentais) ---
// aggression      : preferência por ações ofensivas (ATK/CHARGE)
// caution         : preferência por DEF/HOLD quando o risco está alto
// pursuitDrive    : disposição para perseguir um oponente que foge/mantém distância
// retreatDrive    : disposição para recuar/reposicionar mesmo sem ser forçado
// skillUsage      : preferência por usar habilidades em vez de ataque básico
// itemUsage       : preferência por usar cargas de item quando ferido
// critHunger      : bônus a ações de alto risco/recompensa (Investida, habilidades fortes)
// resilience      : o quanto o próprio HP baixo reduz a agressividade (0 = ignora, 1 = muito cauteloso)
// moraleSensitivity: o quanto oscilações de moral pesam nas decisões
// bluffChance     : chance de blefar em vez de agir "de verdade"
// comboAffinity   : chance de se comprometer com uma sequência de combo
// weaponSwapTendency: chance de trocar de arma como forma de adaptação
// emotionVolatility: velocidade com que o estado emocional muda
// tauntChance     : chance de provocar em vez de agir normalmente quando confortável
const AI_PERSONALITIES = {
    berserker: { id: 'berserker', name: 'Berserker',
        aggression: 0.95, caution: 0.05, pursuitDrive: 0.90, retreatDrive: 0.05,
        skillUsage: 0.50, itemUsage: 0.10, critHunger: 0.60, resilience: 0.05,
        moraleSensitivity: 0.20, bluffChance: 0.02, comboAffinity: 0.60,
        weaponSwapTendency: 0.05, emotionVolatility: 0.30, tauntChance: 0.10 },

    duelista: { id: 'duelista', name: 'Duelista',
        aggression: 0.55, caution: 0.40, pursuitDrive: 0.50, retreatDrive: 0.30,
        skillUsage: 0.40, itemUsage: 0.20, critHunger: 0.70, resilience: 0.40,
        moraleSensitivity: 0.50, bluffChance: 0.15, comboAffinity: 0.50,
        weaponSwapTendency: 0.10, emotionVolatility: 0.40, tauntChance: 0.30 },

    tatico: { id: 'tatico', name: 'Tático',
        aggression: 0.40, caution: 0.60, pursuitDrive: 0.50, retreatDrive: 0.50,
        skillUsage: 0.60, itemUsage: 0.40, critHunger: 0.30, resilience: 0.50,
        moraleSensitivity: 0.30, bluffChance: 0.25, comboAffinity: 0.70,
        weaponSwapTendency: 0.40, emotionVolatility: 0.20, tauntChance: 0.05 },

    cacador: { id: 'cacador', name: 'Caçador',
        aggression: 0.50, caution: 0.40, pursuitDrive: 0.85, retreatDrive: 0.20,
        skillUsage: 0.45, itemUsage: 0.20, critHunger: 0.55, resilience: 0.35,
        moraleSensitivity: 0.30, bluffChance: 0.20, comboAffinity: 0.50,
        weaponSwapTendency: 0.20, emotionVolatility: 0.30, tauntChance: 0.05 },

    covarde: { id: 'covarde', name: 'Covarde',
        aggression: 0.20, caution: 0.85, pursuitDrive: 0.10, retreatDrive: 0.80,
        skillUsage: 0.30, itemUsage: 0.60, critHunger: 0.10, resilience: 0.90,
        moraleSensitivity: 0.80, bluffChance: 0.35, comboAffinity: 0.10,
        weaponSwapTendency: 0.15, emotionVolatility: 0.70, tauntChance: 0.00 },

    impulsivo: { id: 'impulsivo', name: 'Impulsivo',
        aggression: 0.80, caution: 0.15, pursuitDrive: 0.70, retreatDrive: 0.10,
        skillUsage: 0.55, itemUsage: 0.15, critHunger: 0.40, resilience: 0.20,
        moraleSensitivity: 0.40, bluffChance: 0.05, comboAffinity: 0.30,
        weaponSwapTendency: 0.10, emotionVolatility: 0.80, tauntChance: 0.20 },

    calculista: { id: 'calculista', name: 'Calculista',
        aggression: 0.35, caution: 0.65, pursuitDrive: 0.40, retreatDrive: 0.40,
        skillUsage: 0.65, itemUsage: 0.45, critHunger: 0.50, resilience: 0.55,
        moraleSensitivity: 0.25, bluffChance: 0.30, comboAffinity: 0.60,
        weaponSwapTendency: 0.50, emotionVolatility: 0.15, tauntChance: 0.05 },

    veterano: { id: 'veterano', name: 'Veterano',
        aggression: 0.50, caution: 0.55, pursuitDrive: 0.50, retreatDrive: 0.40,
        skillUsage: 0.50, itemUsage: 0.35, critHunger: 0.45, resilience: 0.60,
        moraleSensitivity: 0.20, bluffChance: 0.20, comboAffinity: 0.55,
        weaponSwapTendency: 0.25, emotionVolatility: 0.15, tauntChance: 0.10 },

    sadico: { id: 'sadico', name: 'Sádico',
        aggression: 0.70, caution: 0.25, pursuitDrive: 0.60, retreatDrive: 0.15,
        skillUsage: 0.60, itemUsage: 0.15, critHunger: 0.65, resilience: 0.30,
        moraleSensitivity: 0.35, bluffChance: 0.20, comboAffinity: 0.50,
        weaponSwapTendency: 0.15, emotionVolatility: 0.40, tauntChance: 0.50 },

    protetor: { id: 'protetor', name: 'Protetor',
        aggression: 0.30, caution: 0.75, pursuitDrive: 0.30, retreatDrive: 0.35,
        skillUsage: 0.40, itemUsage: 0.50, critHunger: 0.20, resilience: 0.60,
        moraleSensitivity: 0.35, bluffChance: 0.10, comboAffinity: 0.40,
        weaponSwapTendency: 0.10, emotionVolatility: 0.25, tauntChance: 0.05 },

    honrado: { id: 'honrado', name: 'Honrado',
        aggression: 0.45, caution: 0.45, pursuitDrive: 0.40, retreatDrive: 0.20,
        skillUsage: 0.35, itemUsage: 0.25, critHunger: 0.50, resilience: 0.50,
        moraleSensitivity: 0.40, bluffChance: 0.03, comboAffinity: 0.40,
        weaponSwapTendency: 0.05, emotionVolatility: 0.30, tauntChance: 0.15 },

    executor: { id: 'executor', name: 'Executor',
        aggression: 0.75, caution: 0.35, pursuitDrive: 0.70, retreatDrive: 0.10,
        skillUsage: 0.65, itemUsage: 0.20, critHunger: 0.60, resilience: 0.35,
        moraleSensitivity: 0.15, bluffChance: 0.15, comboAffinity: 0.75,
        weaponSwapTendency: 0.20, emotionVolatility: 0.10, tauntChance: 0.02 },

    mercenario: { id: 'mercenario', name: 'Mercenário',
        aggression: 0.50, caution: 0.50, pursuitDrive: 0.45, retreatDrive: 0.45,
        skillUsage: 0.50, itemUsage: 0.40, critHunger: 0.40, resilience: 0.55,
        moraleSensitivity: 0.50, bluffChance: 0.25, comboAffinity: 0.45,
        weaponSwapTendency: 0.45, emotionVolatility: 0.35, tauntChance: 0.10 },

    gladiador_experiente: { id: 'gladiador_experiente', name: 'Gladiador Experiente',
        aggression: 0.55, caution: 0.50, pursuitDrive: 0.50, retreatDrive: 0.30,
        skillUsage: 0.55, itemUsage: 0.30, critHunger: 0.55, resilience: 0.55,
        moraleSensitivity: 0.25, bluffChance: 0.20, comboAffinity: 0.65,
        weaponSwapTendency: 0.20, emotionVolatility: 0.20, tauntChance: 0.35 },

    fanatico: { id: 'fanatico', name: 'Fanático',
        aggression: 0.85, caution: 0.10, pursuitDrive: 0.75, retreatDrive: 0.05,
        skillUsage: 0.60, itemUsage: 0.10, critHunger: 0.50, resilience: 0.10,
        moraleSensitivity: 0.10, bluffChance: 0.05, comboAffinity: 0.50,
        weaponSwapTendency: 0.05, emotionVolatility: 0.25, tauntChance: 0.25 },

    sobrevivente: { id: 'sobrevivente', name: 'Sobrevivente',
        aggression: 0.35, caution: 0.60, pursuitDrive: 0.30, retreatDrive: 0.55,
        skillUsage: 0.45, itemUsage: 0.60, critHunger: 0.30, resilience: 0.40,
        moraleSensitivity: 0.45, bluffChance: 0.30, comboAffinity: 0.40,
        weaponSwapTendency: 0.35, emotionVolatility: 0.50, tauntChance: 0.05 },
};

// --- ESTILOS DE LUTA (8 arquétipos de combate) ---
// preferredRangeBand é só uma etiqueta descritiva (o alcance de verdade vem da
// arma equipada); weaponPool guia a escolha de arma; skillPool restringe quais
// habilidades esse estilo pode receber (filtradas depois pelo nível do inimigo);
// actionBias são multiplicadores base por tipo de ação, aplicados por cima dos
// pesos de personalidade. `statFocus` é um peso relativo (não precisa somar 1)
// usado por Enemy.generateStats() pra enviesar a distribuição procedural de
// atributos — sem isso, um "Mago" podia nascer com INT baixíssimo só por azar
// da rolagem, o que quebrava a identidade do estilo (ver auditoria: estilo e
// atributos rolavam de forma totalmente desconectada um do outro).
const AI_FIGHTING_STYLES = {
    espadachim: { id: 'espadachim', name: 'Espadachim', preferredRangeBand: 'melee_short',
        weaponPool: ['shortsword', 'longsword', 'rapier'], preferShield: false,
        skillPool: ['heavy_strike', 'bleeding_cut'],
        actionBias: { ATK: 1.0, SKILL: 0.8, DEF: 0.6, APPROACH: 0.7, RETREAT: 0.4, HOLD: 0.3 },
        statFocus: { str: 3, agi: 2, acc: 2, def: 1, int: 1, luk: 1, cha: 1 } },

    lanceiro: { id: 'lanceiro', name: 'Lanceiro', preferredRangeBand: 'reach',
        weaponPool: ['spear'], preferShield: false,
        skillPool: ['heavy_strike', 'fury'],
        actionBias: { ATK: 0.9, SKILL: 0.6, DEF: 0.5, APPROACH: 0.3, RETREAT: 0.6, HOLD: 0.8 },
        statFocus: { str: 3, def: 2, acc: 2, agi: 1, int: 1, luk: 1, cha: 1 } },

    arqueiro: { id: 'arqueiro', name: 'Arqueiro', preferredRangeBand: 'ranged',
        weaponPool: ['bow', 'crossbow'], preferShield: false,
        skillPool: ['heavy_strike', 'bleeding_cut'],
        actionBias: { ATK: 0.9, SKILL: 0.5, DEF: 0.3, APPROACH: 0.1, RETREAT: 0.9, HOLD: 0.7 },
        statFocus: { agi: 3, acc: 3, luk: 2, str: 1, int: 1, def: 1, cha: 1 } },

    brutamontes: { id: 'brutamontes', name: 'Brutamontes', preferredRangeBand: 'melee_short',
        weaponPool: ['warhammer', 'rustyaxe'], preferShield: false,
        skillPool: ['fury', 'heavy_strike'],
        actionBias: { ATK: 1.0, SKILL: 0.6, DEF: 0.2, APPROACH: 0.9, RETREAT: 0.1, HOLD: 0.1 },
        statFocus: { str: 4, def: 1, agi: 1, acc: 1, int: 1, luk: 1, cha: 1 } },

    assassino: { id: 'assassino', name: 'Assassino', preferredRangeBand: 'melee_short',
        weaponPool: ['dagger'], preferShield: false,
        skillPool: ['bleeding_cut', 'vampiric_strike'],
        actionBias: { ATK: 0.8, SKILL: 0.9, DEF: 0.2, APPROACH: 0.8, RETREAT: 0.7, HOLD: 0.2 },
        hitAndRun: true,
        statFocus: { agi: 3, luk: 3, acc: 2, str: 1, int: 1, def: 1, cha: 1 } },

    gladiador: { id: 'gladiador', name: 'Gladiador', preferredRangeBand: 'melee_short',
        weaponPool: ['shortsword', 'rapier'], preferShield: true,
        skillPool: ['heavy_strike', 'shield_bash'],
        actionBias: { ATK: 0.85, SKILL: 0.65, DEF: 0.55, APPROACH: 0.6, RETREAT: 0.35, HOLD: 0.4 },
        statFocus: { str: 2, def: 2, agi: 2, acc: 1, int: 1, luk: 1, cha: 1 } },

    guardiao: { id: 'guardiao', name: 'Guardião', preferredRangeBand: 'melee_short',
        weaponPool: ['shortsword', 'rustyaxe'], preferShield: true,
        skillPool: ['shield_bash', 'quick_heal'],
        actionBias: { ATK: 0.55, SKILL: 0.6, DEF: 0.9, APPROACH: 0.3, RETREAT: 0.3, HOLD: 0.85 },
        statFocus: { def: 4, str: 1, agi: 1, acc: 1, int: 1, luk: 1, cha: 1 } },

    mago: { id: 'mago', name: 'Mago', preferredRangeBand: 'caster',
        weaponPool: ['dagger', 'rapier'], preferShield: false,
        skillPool: ['fireball', 'quick_heal'],
        actionBias: { ATK: 0.3, SKILL: 1.0, DEF: 0.4, APPROACH: 0.2, RETREAT: 0.8, HOLD: 0.6 },
        statFocus: { int: 4, luk: 1, acc: 1, agi: 1, str: 1, def: 1, cha: 1 } },
};

// --- ARQUÉTIPOS RAROS (comportamentos únicos, chance muito baixa de aparecer) ---
// Cada um sobrepõe regras específicas por cima de personalidade/estilo normais.
const AI_RARE_ARCHETYPES = {
    nunca_recua: { id: 'nunca_recua', name: 'O Inabalável',
        description: 'Nunca recua, custe o que custar.' },
    nunca_defende: { id: 'nunca_defende', name: 'O Imprudente',
        description: 'Nunca assume postura defensiva.' },
    so_habilidades: { id: 'so_habilidades', name: 'O Devoto das Artes',
        description: 'Só recorre ao ataque básico quando não há outra opção.' },
    lutador_desarmado: { id: 'lutador_desarmado', name: 'O Punho Nu',
        description: 'Recusa armas e luta só com os próprios punhos.' },
    imitador: { id: 'imitador', name: 'O Espelho',
        description: 'Tenta reproduzir a última ação do oponente.' },
    trocador_de_armas: { id: 'trocador_de_armas', name: 'O Inconstante',
        description: 'Troca de arma constantemente em pleno combate.' },
};
const RARE_ARCHETYPE_CHANCE = 3; // % de chance por Duelo Rápido gerado

// --- COMBOS (sequências pré-planejadas por estilo de luta) ---
// Cada passo é um actionCode existente (ou "SKILL:<id>" se a habilidade estiver
// disponível para o inimigo); combos usam só ações já testadas do motor de
// batalha, então nenhuma mecânica nova precisa existir para eles funcionarem —
// é a IA se comprometendo com uma sequência, com falas próprias por passo.
//
// _maybeStartCombo (ai.js) já sorteia aleatoriamente entre TODOS os combos de
// `comboSet` (array) — a arquitetura sempre esperou múltiplas variantes por
// estilo, mas até agora cada estilo só tinha exatamente 1 entrada, então o
// "sorteio" nunca teve escolha real. Cada estilo ganha uma 2ª variante
// (usando a outra habilidade do próprio skillPool em ai_data.js), dobrando a
// variedade de sequências que um jogador vê ao longo de várias lutas.
const AI_COMBOS = {
    espadachim: [
        { steps: ['APPROACH', 'ATK', 'SKILL:heavy_strike'],
            flavor: ['Avança em posição de ataque!', 'Golpeia com precisão!', 'Finaliza com um golpe pesado!'] },
        { steps: ['ATK', 'SKILL:bleeding_cut', 'ATK'],
            flavor: ['Testa sua guarda com um golpe rápido!', 'Abre um corte certeiro!', 'Pressiona antes que o sangramento estanque!'] },
    ],
    lanceiro: [
        { steps: ['HOLD', 'ATK', 'ATK'],
            flavor: ['Planta os pés e nivela a lança!', 'Estoca!', 'Estoca de novo, sem dar espaço!'] },
        { steps: ['APPROACH', 'SKILL:fury', 'ATK'],
            flavor: ['Avança quebrando a distância!', 'Golpeia com fúria contida!', 'Encerra a sequência com mais uma estocada!'] },
    ],
    arqueiro: [
        { steps: ['RETREAT', 'ATK', 'ATK'],
            flavor: ['Recua para abrir linha de tiro!', 'Dispara!', 'Dispara outra flecha em sequência!'] },
        { steps: ['HOLD', 'SKILL:bleeding_cut', 'RETREAT'],
            flavor: ['Mira com calma antes de atirar!', 'Acerta um tiro que corta fundo!', 'Recua mantendo distância segura!'] },
    ],
    brutamontes: [
        { steps: ['APPROACH', 'CHARGE', 'ATK'],
            flavor: ['Avança pesadamente!', 'Investe com todo o peso do corpo!', 'Desfere um golpe final devastador!'] },
        { steps: ['ATK', 'SKILL:fury', 'ATK'],
            flavor: ['Golpeia sem dó!', 'Explode em fúria bruta!', 'Termina com outro golpe pesado!'] },
    ],
    assassino: [
        { steps: ['RUN', 'ATK', 'RETREAT'],
            flavor: ['Corre para as sombras do seu ponto cego!', 'Crava a lâmina!', 'Desaparece antes que você reaja!'] },
        { steps: ['APPROACH', 'SKILL:vampiric_strike', 'RETREAT'],
            flavor: ['Se aproxima pelas sombras!', 'Crava a lâmina, roubando vida!', 'Desaparece antes que você reaja!'] },
    ],
    gladiador: [
        { steps: ['SKILL:shield_bash', 'ATK', 'ATK'],
            flavor: ['Investida de escudo!', 'Aproveita a brecha!', 'Continua o combo com outro golpe!'] },
        { steps: ['ATK', 'SKILL:heavy_strike', 'ATK'],
            flavor: ['Testa sua defesa!', 'Golpe pesado calculado!', 'Aproveita a abertura com outro golpe!'] },
    ],
    guardiao: [
        { steps: ['HOLD', 'DEF', 'SKILL:shield_bash'],
            flavor: ['Firma o escudo e espera!', 'Absorve o impacto sem ceder!', 'Contra-ataca com o escudo!'] },
        { steps: ['DEF', 'SKILL:quick_heal', 'HOLD'],
            flavor: ['Absorve o primeiro golpe sem ceder!', 'Recupera o fôlego com uma cura rápida!', 'Volta a se posicionar com cautela!'] },
    ],
    mago: [
        { steps: ['RETREAT', 'SKILL:fireball', 'SKILL:fireball'],
            flavor: ['Recua conjurando!', 'Bola de fogo!', 'Outra explosão arcana antes que você se aproxime!'] },
        { steps: ['HOLD', 'SKILL:quick_heal', 'SKILL:fireball'],
            flavor: ['Concentra energia arcana!', 'Cura-se antes de continuar!', 'Lança uma bola de fogo certeira!'] },
    ],
};

// --- ESTADOS EMOCIONAIS ---
// Cada emoção aplica multiplicadores simples às pontuações de utilidade por
// tipo de ação. Valores > 1 reforçam a ação, < 1 a inibem.
const AI_EMOTIONS = {
    confiante: { ATK: 1.15, SKILL: 1.1, DEF: 0.9, RETREAT: 0.8, HOLD: 0.9, ITEM: 0.8 },
    assustado: { ATK: 0.7, SKILL: 0.85, DEF: 1.25, RETREAT: 1.4, HOLD: 1.1, ITEM: 1.3 },
    frustrado: { ATK: 0.9, SKILL: 1.25, DEF: 0.85, RETREAT: 0.9, HOLD: 0.8, ITEM: 1.0 },
    enfurecido: { ATK: 1.35, SKILL: 1.15, DEF: 0.6, RETREAT: 0.4, HOLD: 0.5, ITEM: 0.7 },
    desesperado: { ATK: 1.1, SKILL: 1.3, DEF: 0.8, RETREAT: 0.7, HOLD: 0.6, ITEM: 1.4 },
    determinado: { ATK: 1.1, SKILL: 1.05, DEF: 1.05, RETREAT: 0.85, HOLD: 1.0, ITEM: 1.0 },
};

window.AI_PERSONALITIES = AI_PERSONALITIES;
window.AI_FIGHTING_STYLES = AI_FIGHTING_STYLES;
window.AI_RARE_ARCHETYPES = AI_RARE_ARCHETYPES;
window.RARE_ARCHETYPE_CHANCE = RARE_ARCHETYPE_CHANCE;
window.AI_COMBOS = AI_COMBOS;
window.AI_EMOTIONS = AI_EMOTIONS;
