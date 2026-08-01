/**
 * Raças jogáveis — escolhidas uma vez na Criação de Personagem (diferente da
 * Linhagem, que é uma mutação conquistada durante a campanha, ver
 * lineages.js). Cada raça é um vetor real de vantagens/desvantagens de
 * atributo, nunca só um rótulo estético — aplicado como uma camada a mais
 * em cima da Força/Agilidade/etc já distribuídas pelo jogador, do mesmo
 * jeito que equipamento soma bônus (ver Entity.getTotalStat em player.js).
 * Além dos `statMods` fixos, cada raça (exceto Humano) tem um `passive`
 * único no MESMO formato dos passivos de linhagem — statKey/value somados
 * genericamente em Entity.calculateDerivedStats, sem caso especial em
 * battle.js.
 *
 * Registry orientado a dados: uma raça nova é só mais uma entrada aqui, sem
 * tocar no motor (ui.js já itera Object.values(RACES) pra montar o seletor
 * da Criação de Personagem).
 */
// Pool de tons de pele por raça (item 7 da auditoria de balanceamento,
// continuação de `bodyScale` — ver RaceSystem.pickSkinTone abaixo). Antes,
// TODA geração procedural de pele (Enemy/Rival/NPC de cidade) sorteava de um
// único pool genérico, sem nenhuma relação com a raça sorteada — um Elfo
// podia nascer com pele tão escura quanto um Orc, ou um Orc podia nascer com
// o mesmo tom "europeu claro" de qualquer humano, quebrando a identidade
// visual que `bodyScale` acabou de estabelecer. Esse pool NUNCA restringe a
// Criação de Personagem do jogador (ver ui.js `char-skin-color`/randColor() —
// permanece deliberadamente livre, incluindo cores não convencionais), só a
// geração ALEATÓRIA de Enemy/Rival/NPC ambiente.
//
// Compartilhado por Humano + as 4 culturas gregas + Anão (pedido explícito:
// "humanos e anões mais pardos/negros") — gradiente completo de claro a bem
// escuro, ao contrário do pool antigo de ENEMY_SKIN_TONES (enemy.js), que
// tinha só 2 tons realmente escuros entre 6 opções.
const HUMAN_SKIN_TONES = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#6b4226', '#4a2f1f', '#2e1c12'];

const RACES = {
    humano: {
        id: 'humano', name: 'Humano',
        tagline: 'Adaptável e equilibrado — sem vantagens nem fraquezas extremas.',
        description: 'Vindos de todos os cantos da arena, os humanos não têm o dom de nenhum povo em particular, mas também não carregam nenhuma de suas fraquezas.',
        statMods: {},
        skinTones: HUMAN_SKIN_TONES
        // Sem `accent` nem `passive`: humano não ganha nenhuma faixa/adereço
        // cultural no torso (ver graphics.js _drawRaceSash) nem traço de
        // combate único — é a raça "neutra".
    },
    espartano: {
        id: 'espartano', name: 'Espartano',
        tagline: 'Forjado pra guerra desde a infância. Corpo de aço, mente de soldado.',
        description: 'Criados em disciplina marcial desde os sete anos de idade, os espartanos entram na arena mais fortes e mais resistentes que qualquer rival — mas o treino constante deixou pouco tempo pra retórica ou estratagemas.',
        statMods: { str: 2, def: 1, int: -1 },
        accent: '#a3201c', // vermelho espartano clássico (capa/faixa)
        // Traço único da raça (ver Entity.calculateDerivedStats em player.js)
        // — no MESMO formato dos passivos de linhagem (statKey/value), então
        // se soma aos derivedStats sem precisar de nenhum caso especial em
        // battle.js: "Fúria Espartana", luta ainda mais forte encurralado.
        passive: { statKey: 'lowHpDamageBonusPercent', value: 8, label: 'Fúria Espartana: +8% de dano físico com HP abaixo de 30%.' },
        skinTones: HUMAN_SKIN_TONES
    },
    ateniense: {
        id: 'ateniense', name: 'Ateniense',
        tagline: 'Filósofos e oradores — não menos perigosos por isso.',
        description: 'Educados em retórica, matemática e os primeiros princípios da guerra, os atenienses trazem pra arena uma mente afiada e um carisma que o público adora, mas raramente têm o físico bruto dos povos guerreiros.',
        statMods: { int: 2, cha: 1, str: -1 },
        accent: '#2a5a8a', // azul-violeta, tom "erudito"
        passive: { statKey: 'negativeEffectResistPercent', value: 10, label: 'Mente Afiada: +10% de resistência a efeitos negativos (atordoar/lentidão).' },
        skinTones: HUMAN_SKIN_TONES
    },
    cretense: {
        id: 'cretense', name: 'Cretense',
        tagline: 'Rápidos como o vento de Creta, ágeis como as próprias lendas do labirinto.',
        description: 'Descendentes dos lendários arqueiros e acrobatas de Creta, movem-se pela arena com uma leveza que ninguém mais alcança — ao custo de uma guarda mais frágil sob pressão.',
        statMods: { agi: 2, luk: 1, def: -1 },
        accent: '#1a8a7a', // turquesa egeu
        passive: { statKey: 'dodgeBonusPercent', value: 5, label: 'Leveza do Labirinto: +5% de esquiva.' },
        skinTones: HUMAN_SKIN_TONES
    },
    tebano: {
        id: 'tebano', name: 'Tebano',
        tagline: 'Soldados de elite, escudo contra escudo, ombro a ombro.',
        description: 'Herdeiros da tradição hoplita de Tebas, lutam com uma disciplina defensiva que poucos povos conseguem igualar, ainda que isso custe um pouco da precisão dos golpes mais calculados.',
        statMods: { def: 2, str: 1, acc: -1 },
        accent: '#8a6a2a', // bronze hoplita
        passive: { statKey: 'defenseBonusPercent', value: 6, label: 'Falange Tebana: +6% de Defesa.' },
        skinTones: HUMAN_SKIN_TONES
    },

    // --- Raças de Alta Fantasia (Cidades-Hub Regionais) ---
    // Nativas das novas cidades-hub (ver citydatabase.js `raceDemographics`),
    // mas jogáveis por qualquer personagem desde a Criação — igual às 4
    // raças gregas acima, sem nenhuma restrição de origem/cidade. Cada
    // `passive.statKey` é reaproveitado de um campo já 100% genérico em
    // Entity.calculateDerivedStats/battle.js (nunca hardcoded pro jogador),
    // já que raça também é sorteada em inimigos procedurais (ver enemy.js
    // Enemy.race) — um statKey preso só ao lado do jogador (como
    // hpRegenPerTurn/healPowerBonusPercent, ligados à mensagem de Linhagem
    // em battle.js) criaria um passivo mudo sempre que um inimigo dessa
    // raça nascesse.
    orc: {
        id: 'orc', name: 'Orc',
        tagline: 'Força bruta forjada nas fornalhas de Gorkhal — poucos sobrevivem para contar a história.',
        description: 'Vindos das muralhas de rocha vulcânica da Fortaleza Orc, os orcs medem valor por cicatrizes e vitórias. Fracos de espírito não duram uma estação lá.',
        statMods: { str: 3, def: 1, int: -2 },
        accent: '#3a5a1a', // verde-oliva escuro, couro/rocha vulcânica
        passive: { statKey: 'drainOnCritPercent', value: 12, label: 'Fúria Sanguinária: acertos críticos roubam +12% do dano como HP.' }, // item 7 da auditoria de balanceamento ("raças mais diferentes"): antes as 8 raças
        // eram estatisticamente diferentes mas fisicamente IDÊNTICAS na
        // renderização — mesma altura, mesma largura de ombro, mesmo
        // corpo, só a `accent` (cor da faixa) mudava. Orc/Elfo/Anão (as
        // três raças de fantasia, com identidades físicas bem marcadas na
        // própria lore) ganham `bodyScale` — lido por graphics.js
        // (_legLen/_torsoH/_armLen/_headR/_bodyMetrics) pra escalar altura
        // e largura de verdade no renderizador. As 5 raças "humanas"
        // (Humano + as 4 culturas gregas) ficam sem o campo de propósito —
        // fisicamente são a mesma espécie, então continuam com a MESMA
        // silhueta de sempre (bodyScale ausente = {height:1,width:1} via
        // fallback), preservando o visual de antes desta mudança.
        bodyScale: { height: 1.14, width: 1.28 }, // mais alto e MUITO mais largo/musculoso
        // Pele verde-oliva é a norma do orc (ver `accent` acima, mesma
        // família de tom); `rareSkinTones` é uma mutação rara e deliberada
        // (pedido: "podem spawnar com pele de outras cores também não
        // usuais, como vermelho e roxo, mas cuidado pra não pôr cores vivas
        // demais") — por isso os tons abaixo são bem DESSATURADOS
        // (vermelho-terroso/roxo-acinzentado, nunca um vermelho ou roxo
        // "neon"), e só aparecem em `rareSkinToneChance`% dos casos; o resto
        // continua no verde-oliva padrão da raça.
        skinTones: ['#6b8e4e', '#597a3f', '#7a9a5a', '#4f6b38', '#6e8850'],
        rareSkinTones: ['#8a5566', '#6e5573'],
        rareSkinToneChance: 12
    },
    elfo: {
        id: 'elfo', name: 'Elfo',
        tagline: 'Séculos de vida entre raízes ancestrais afiam os sentidos além do que qualquer mortal alcança.',
        description: 'Nascidos sob o dossel eterno do Santuário Élfico, movem-se com uma graça quase sobrenatural e enxergam falhas na guarda alheia que ninguém mais percebe — mas carregam pouco da força bruta dos povos guerreiros.',
        statMods: { agi: 2, int: 2, str: -2 },
        accent: '#4a8a3a', // verde floresta vívido
        passive: { statKey: 'critChanceLowHpBonus', value: 15, label: 'Precisão Élfica: +15% de chance de crítico com HP abaixo de 30%.' },
        bodyScale: { height: 1.07, width: 0.86 }, // mais alto e visivelmente mais esguio
        // Elfos SEMPRE claros (pedido explícito) — sem entrada escura
        // nenhuma no pool, ao contrário de Humano/Anão.
        skinTones: ['#ffe0bd', '#ffdab9', '#fbe3c5', '#f5d5ae', '#eecfb4']
    },
    anao: {
        id: 'anao', name: 'Anão',
        tagline: 'Feito da mesma pedra dos salões que escavou — nada abala um Anão de pé firme.',
        description: 'Clãs de mineradores e ferreiros das montanhas próximas à Fortaleza Orc, os anões trazem pra arena uma resistência quase teimosa e uma paciência forjada em décadas sob a rocha.',
        statMods: { def: 3, str: 1, agi: -2 },
        accent: '#8a3a1a', // cobre/ferrugem, forja anã
        passive: { statKey: 'bleedResistPercent', value: 30, label: 'Pele de Pedra: 30% de resistência a sangramento.' },
        bodyScale: { height: 0.76, width: 1.18 }, // baixo e atarracado, torso largo
        // Mesmo pool "pardo/negro" do Humano (pedido explícito agrupa os
        // dois) — Anão não tem identidade de pele própria na lore aqui, ao
        // contrário de Orc (verde) e Elfo (sempre claro).
        skinTones: HUMAN_SKIN_TONES
    }
};
window.RACES = RACES;

window.RaceSystem = {
    getAll() { return Object.values(RACES); },
    get(id) { return RACES[id] || RACES.humano; },

    // Sorteia um tom de pele coerente com a raça (ver `skinTones`/
    // `rareSkinTones` acima) — usado por TODA geração procedural de
    // aparência (Enemy/Rival em enemy.js, NPC ambiente em city.js). NUNCA
    // usado pela Criação de Personagem do jogador (ui.js), que continua de
    // propósito 100% livre (`char-skin-color`/randColor()). Sem raça
    // reconhecida, ou raça sem `skinTones` definido (não deveria acontecer
    // hoje, já que as 8 raças cadastradas têm o campo, mas é uma raça nova
    // futura sem o campo ainda), cai no pool humano como fallback neutro.
    pickSkinTone(raceId) {
        const race = this.get(raceId);
        if (race.rareSkinTones && race.rareSkinTones.length && Utils.chance(race.rareSkinToneChance || 0)) {
            return race.rareSkinTones[Utils.randomInt(0, race.rareSkinTones.length - 1)];
        }
        const pool = (race.skinTones && race.skinTones.length) ? race.skinTones : HUMAN_SKIN_TONES;
        return pool[Utils.randomInt(0, pool.length - 1)];
    }
};
