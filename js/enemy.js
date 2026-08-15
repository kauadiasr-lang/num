/**
 * Sistema de IA e Inimigos Procedurais
 *
 * A personalidade/estilo de luta/memória/emoção de cada inimigo é resolvida
 * pelo motor de IA (ai.js + ai_data.js) — este arquivo só cuida de gerar
 * estatísticas, equipamento e recompensas, e delega a "mente" de cada
 * combatente para AICombat.assignProfile().
 */

// Pool ampliado (10x11 = 110 combinações, contra as 25 originais) — reduz
// bastante a sensação de repetição no Duelo Rápido, sem precisar de
// nenhum sistema novo (só mais dados no mesmo registry).
const ENEMY_NAMES = ["Saqueador", "Gladiador Renegado", "Mercenário", "Assassino", "Bárbaro",
    "Fugitivo", "Escravo Rebelde", "Bandido", "Guerreiro Errante", "Desertor"];
const ENEMY_ADJECTIVES = ["Brutal", "Cicatrizado", "Implacável", "Veloz", "Sanguinário",
    "Faminto", "Traiçoeiro", "Feroz", "Silencioso", "Amaldiçoado", "Desprezível"];

// Pools de nome por raça (ver races.js/citydatabase.js) — item 8 da revisão
// profunda: nomes ainda seguiam o mesmo padrão genérico "arquétipo +
// adjetivo" que o pedido original cita como exemplo do que EVITAR ("Orc
// Guerreiro", "Bandido Forte") — só com vocabulário mais temático por raça
// ("Guerreiro de Gorkhal Sanguinário" continua sendo um TÍTULO, nunca um
// nome próprio de verdade). `names` agora é um pool de NOMES PRÓPRIOS reais
// por cultura (gregos pras 5 raças "humanas", ver races.js `species`;
// ásperos/guturais pro Orc; élficos fluidos pro Elfo; robustos/nórdicos pro
// Anão), combinado com `adjectives` (mantido — já era o pool de
// epítetos/apelidos) na MESMA fórmula de sempre (`${name} ${adjective}`,
// ver constructor abaixo) — vira "[Nome próprio] + [apelido]" (ex: "Grosh
// Sanguinário", "Pericles Implacável"), exatamente a estrutura pedida.
// Cobre as 8 raças jogáveis cadastradas em races.js; qualquer raça nova
// sem entrada aqui cai no pool genérico ENEMY_NAMES/ENEMY_ADJECTIVES,
// preservando o comportamento de sempre pra quem ainda não foi migrado.
const RACE_ENEMY_NAMES = {
    humano: {
        names: ["Nikos", "Dimitra", "Alexios", "Elena", "Kostas", "Theodora", "Yannis", "Sofia", "Petros", "Irene", "Markos", "Calista"],
        adjectives: ["Bravo", "Cicatrizado", "Determinado", "Astuto", "Resiliente", "Ousado", "Vigoroso"]
    },
    espartano: {
        names: ["Leônidas", "Górgo", "Brásidas", "Cinisca", "Lisandro", "Quilônis", "Agesilau", "Damo", "Cleômbroto"],
        adjectives: ["Inflexível", "Disciplinado", "Implacável", "Marcial", "Sanguinário", "Indomável"]
    },
    ateniense: {
        names: ["Péricles", "Aspásia", "Sófocles", "Diotima", "Alcibíades", "Xantipa", "Temístocles", "Cleis"],
        adjectives: ["Astuto", "Calculista", "Eloquente", "Implacável", "Traiçoeiro", "Perspicaz"]
    },
    cretense: {
        names: ["Minos", "Ariadne", "Idomeneu", "Britomartis", "Talos", "Pasífae", "Glauco", "Acale"],
        adjectives: ["Veloz", "Ágil", "Escorregadio", "Certeiro", "Astuto", "Implacável"]
    },
    tebano: {
        names: ["Epaminondas", "Ismênia", "Pelópidas", "Manto", "Cadmo", "Antígona", "Tirésias", "Harmonia"],
        adjectives: ["Disciplinado", "Firme", "Impenetrável", "Bravo", "Resiliente", "Implacável"]
    },
    orc: {
        names: ["Grosh", "Ukra", "Mordak", "Zharga", "Krug", "Uzka", "Thokk", "Vraga", "Gnash", "Morka"],
        adjectives: ["Sanguinário", "Implacável", "Cicatrizado", "Feroz", "Brutal", "Selvagem"]
    },
    elfo: {
        names: ["Sylvaris", "Elenwë", "Thranduil", "Ithrandir", "Galadwen", "Faelivrin", "Aerendyl", "Nimloth"],
        adjectives: ["Silencioso", "Veloz", "Traiçoeiro", "Etéreo", "Implacável"]
    },
    anao: {
        names: ["Thorin", "Dagna", "Balin", "Grimhild", "Dwalin", "Freya", "Gundren", "Helka"],
        adjectives: ["Teimoso", "Inabalável", "Robusto", "Implacável", "Resistente", "Feroz"]
    }
};

// Inimigo Elite do Duelo Rápido: um combatente raro, bem mais forte e
// recompensador que o comum, mas ainda usando a IA comum (AICombat) — não é
// um boss (esses têm IA própria em bossai.js, ver Conde Vampiro/Anjo
// Guardião). Existe pra dar ao Duelo Rápido repetido uma chance ocasional de
// "vale a pena continuar tentando a sorte", igual a um monstro raro de
// qualquer RPG de loot.
// Balanceamento (pedido do usuário: "o jogo tá ficando fácil, deixe
// levemente a moderadamente mais difícil com inimigos mais fortes") — era
// 8%, subiu pra 12%. Elite já soma +2 níveis e ~2.2x em quase todo stat/
// recompensa (ver generateStatsFromStyle/expValue/goldValue abaixo), então
// só a chance precisa mudar pra esse tipo de encontro mais duro aparecer
// com mais frequência, sem precisar duplicar a fórmula de força do Elite
// em lugar nenhum.
const ELITE_ENEMY_CHANCE = 12; // % por Duelo Rápido gerado

// Antes deste sistema, Enemy/Rival não tinham NENHUM `visuals` (a classe
// base Entity não define o campo, só Player) — todo inimigo caía no
// fallback padrão do GraphicsEngine e ficava visualmente IDÊNTICO a
// qualquer outro, só variando equipamento. Isso gera uma aparência
// completa e coerente (gênero, cores, cicatriz e arquétipo — ver
// FIGHTER_ARCHETYPES em graphics.js) pra cada inimigo do Duelo Rápido.
const ENEMY_SKIN_TONES = ['#ffcc99', '#e8b382', '#c68642', '#8d5524', '#f0d5b8', '#7a4a2f'];
const ENEMY_HAIR_COLORS = ['#2a1c10', '#4a2f1a', '#6b4423', '#8a6a3a', '#c9a876', '#1a1a1a', '#7a7a7a', '#8b1a1a'];
const ENEMY_EYE_COLORS = ['#1a1a1a', '#3a2a1a', '#2a4a6a', '#4a6a2a', '#5a2a4a'];
// Estilo de luta -> arquétipo visualmente coerente (não é garantido, só
// preferido — ver randomFighterVisuals) já que a identidade visual é
// puramente estética e não precisa bater 1:1 com a IA.
const STYLE_TO_ARCHETYPE = {
    espadachim: 'cavaleiro', assassino: 'assassino', brutamontes: 'barbaro',
    gladiador: 'campeao', guardiao: 'cavaleiro', mago: 'mercenario', arqueiro: 'mercenario'
};

// `raceId` (item 7 da auditoria: pool de pele por raça, ver races.js
// RaceSystem.pickSkinTone) é opcional — sem ele (ou sem RaceSystem
// carregado), cai no pool genérico ENEMY_SKIN_TONES de sempre, preservando
// o comportamento anterior a esta mudança pra qualquer chamador que ainda
// não conheça a raça no momento da chamada.
function randomFighterVisuals(styleId, raceId) {
    const gender = Utils.chance(50) ? 'Masculino' : 'Feminino';
    const archetypeIds = Object.keys(window.FIGHTER_ARCHETYPES || { veterano: 1 });
    const preferred = STYLE_TO_ARCHETYPE[styleId];
    const archetype = (preferred && Utils.chance(70)) ? preferred : archetypeIds[Utils.randomInt(0, archetypeIds.length - 1)];
    const hairColor = ENEMY_HAIR_COLORS[Utils.randomInt(0, ENEMY_HAIR_COLORS.length - 1)];
    const skinTone = (raceId && window.RaceSystem)
        ? window.RaceSystem.pickSkinTone(raceId)
        : ENEMY_SKIN_TONES[Utils.randomInt(0, ENEMY_SKIN_TONES.length - 1)];
    return {
        gender,
        skinTone,
        hairStyle: Utils.randomInt(1, 15),
        hairColor,
        beardStyle: Utils.randomInt(0, 11),
        beardColor: hairColor,
        eyebrowColor: hairColor,
        eyeColor: ENEMY_EYE_COLORS[Utils.randomInt(0, ENEMY_EYE_COLORS.length - 1)],
        faceShape: Utils.randomInt(1, 3),
        archetype,
        scarStyle: Utils.chance(40) ? Utils.randomInt(1, 4) : 0 // veteranos de arena costumam ter marcas
    };
}

// Fórmula ÚNICA de pontos totais de atributo por nível, compartilhada por
// TODO combatente procedural (Enemy/Vampire/Ghost) — ver auditoria de
// balanceamento: antes cada classe tinha sua própria fórmula (Enemy 35+5L,
// Vampire 40+5L, Ghost 38+5L) e o Elite ainda somava +40 pontos FIXOS por
// cima da fórmula do Enemy comum. Resultado: dois inimigos no MESMO nível
// podiam ter totais de atributo bem diferentes só por causa do tipo/flag,
// nunca de escolhas legítimas (distribuição/equipamento/encantamento/
// mutação/raça/habilidade) — exatamente o cenário que o pedido de
// balanceamento proíbe ("nunca por receber pontos extras aleatórios").
// Diferença de dificuldade entre os tipos continua existindo (Elite sobe
// +2 níveis, Vampiro/Fantasma têm piso de nível mais alto que o Enemy
// comum), só que agora só por meio do NÍVEL EFETIVO, nunca de um bônus
// solto por cima da mesma fórmula.
// Fase 3 da diretiva de balanceamento (Iteração 10) — a fórmula própria
// que existia aqui (35 + nível*5) crescia numa taxa DIFERENTE da real
// progressão de pontos de atributo do jogador (45 no nível 1, +3 por
// level up — ver player.js), uma divergência que nunca tinha sido
// cruzada entre os dois lados e crescia sem limite (nível 100: inimigo
// tinha +56% de pontos sobre o jogador do MESMO nível). Delega pra
// BalanceCore.getTotalStatPoints — ver o comentário completo lá —, que
// agora É a fórmula real do jogador, garantindo que "mesmo nível" volte
// a significar "mesmo total de pontos de atributo" nos dois lados.
function totalStatPointsForLevel(level) {
    return window.BalanceCore.getTotalStatPoints(level);
}
window.totalStatPointsForLevel = totalStatPointsForLevel;

// Auditoria de Combate e Escalonamento (Iteração 4) — Seção 3: fora do
// Duelo Rápido (ver ui.js startBattle() SEM argumento, Seção 4 — exceção
// explícita, nunca usa esta função), inimigo nenhum deve mais escalar com
// o nível do jogador. O mundo passa a ter progressão própria por região
// (ver CityDatabase[cityId].normalEnemyLevelRange em citydatabase.js) —
// bandidos da Estrada, duelistas/caçadores da praça, todos usam a faixa
// da cidade de ORIGEM/DESTINO em vez de `p.level + X`. `biasHigh` empurra
// o sorteio pra metade superior da faixa (chefe opcional da Estrada, ver
// ui.js startEliteRoadBattle — antes `p.level + 3`, sempre um degrau
// acima do jogador; agora sempre um degrau acima da REGIÃO). Cidade sem
// `normalEnemyLevelRange` cadastrado (id desconhecido, ex.: contexto
// neutro) cai pra 1-10 — nunca quebra, só fica conservador.
function getRegionEnemyLevel(cityId, biasHigh = false) {
    const def = window.CityDatabase && window.CityDatabase[cityId];
    const range = (def && def.normalEnemyLevelRange) || [1, 10];
    const [min, max] = range;
    if (biasHigh) {
        const mid = min + Math.floor((max - min) / 2);
        return Utils.randomInt(mid, max);
    }
    return Utils.randomInt(min, max);
}
window.getRegionEnemyLevel = getRegionEnemyLevel;

// ============================================================================
// FERAS (correção crítica da auditoria mestre) — lobos deixam de herdar a
// construção humana. Antes, `new Enemy(level)` era o ÚNICO caminho de
// construção pra QUALQUER inimigo não-boss, lobo incluído: mesmo sorteio de
// nome/raça humana, mesmo AICombat.assignProfile genérico (estilo humano
// aleatório), mesmo equipStyleWeapon()/equipArmor() incondicional — um lobo
// podia literalmente nascer empunhando espada e vestindo armadura, porque
// nada na Entity/Enemy jamais soube que "espécie" o inimigo era. `species`
// (ver Enemy constructor abaixo) é o único gate arquitetural novo: quando
// !== 'humanoid', pula TODO o pipeline de identidade humana (nome/raça,
// AICombat.assignProfile aleatório, randomFighterVisuals, equipStyleWeapon,
// equipArmor) e usa o caminho de fera abaixo, sempre no MESMO construtor —
// nunca um `if (enemy.type === 'wolf')` espalhado por battle.js/ai.js (a
// arquitetura de alcance/AI/combate continua 100% compartilhada, só a
// IDENTIDADE da entidade muda).
const BEAST_NAME_POOL = {
    wolf: { names: ['Lobo Cinzento', 'Lobo das Sombras', 'Lobo Faminto', 'Lobo Uivante', 'Lobo Sarnento'], adjectives: [] },
    alpha_wolf: { names: ['Lobo Alfa'], adjectives: [] },
};

// Habilidades naturais de fera — registradas no MESMO window.SkillDB
// compartilhado (mesmo motor de execução de battle.js, zero duplicação),
// mas com `origin: 'BEAST'`/`isBeastSkill: true` pra NUNCA aparecer como
// aprendível pelo jogador via Mercado Arcano (mesmo padrão exato de
// bossai.js registerBossSkills/isBossSkill — ver skills.js pelo motivo
// completo do campo `origin`). Reaproveita os SKILL_TYPES já existentes
// (PHYSICAL pra mordida, STUN pra investida) — nenhum tipo novo no motor.
function registerBeastSkills() {
    const defs = [
        { id: 'mordida_lobo', name: 'Mordida', type: 'PHYSICAL', mpCost: 8, powerMulti: 1.3,
            description: 'Um ataque de mordida selvagem que causa 130% do Dano Físico.', extra: { cooldown: 1, animation: 'attack' } },
        { id: 'investida_lobo', name: 'Investida', type: 'STUN', mpCost: 12, powerMulti: 0.9,
            description: 'Uma investida brutal que pode derrubar o alvo, atordoando-o por um turno.', extra: { stunChance: 35, cooldown: 3, animation: 'attack' } },
    ];
    defs.forEach(d => {
        if (!window.SkillDB[d.id]) {
            window.SkillDB[d.id] = new Skill(d.id, d.name, d.type, d.mpCost, d.powerMulti, d.description, 1, d.extra || {});
            window.SkillDB[d.id].isBeastSkill = true;
            window.SkillDB[d.id].origin = 'BEAST';
        }
    });
}
registerBeastSkills();

class Enemy extends Entity {
    // `opts.species` (correção crítica da auditoria mestre) — 'humanoid'
    // (padrão, comportamento 100% inalterado) ou 'wolf'/'alpha_wolf'. É o
    // ÚNICO ponto de decisão de toda a construção: cada bloco abaixo checa
    // `isBeast` UMA vez, nunca um `if (species === 'wolf')` espalhado por
    // fora deste construtor.
    constructor(playerLevel, opts = {}) {
        const species = opts.species || 'humanoid';
        const isBeast = species !== 'humanoid';

        // Raça/nome sorteados ANTES do super() (precisa existir antes de
        // qualquer atribuição em `this`). Fera pula inteiramente a
        // demografia humana — nunca teve raça, nunca deveria ter nome de
        // "Nikos Bravo"/"Grosh Sanguinário".
        let pickedRace = null;
        let name;
        if (isBeast) {
            const beastPool = BEAST_NAME_POOL[species] || BEAST_NAME_POOL.wolf;
            name = beastPool.names[Utils.randomInt(0, beastPool.names.length - 1)];
        } else {
            const cityDefForName = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
            const demographicsForName = (cityDefForName && cityDefForName.raceDemographics) ? cityDefForName.raceDemographics : null;
            const raceIdsForName = window.RACES ? Object.keys(window.RACES) : ['humano'];
            pickedRace = (demographicsForName && window.Utils.weightedPick)
                ? (Utils.weightedPick(demographicsForName) || 'humano')
                : raceIdsForName[Utils.randomInt(0, raceIdsForName.length - 1)];
            const namePool = RACE_ENEMY_NAMES[pickedRace] || { names: ENEMY_NAMES, adjectives: ENEMY_ADJECTIVES };
            name = `${namePool.names[Utils.randomInt(0, namePool.names.length - 1)]} ${namePool.adjectives[Utils.randomInt(0, namePool.adjectives.length - 1)]}`;
        }
        super(name);

        this.species = species;
        this.isBeast = isBeast;

        // Balanceamento (pedido do usuário: jogo ficando fácil demais) —
        // era `randomInt(-1, 1)` (média = nível do jogador, podia até vir
        // mais fraco). Agora nunca vem mais fraco que o jogador, só igual
        // ou até 2 níveis acima — empurra a dificuldade média pra cima sem
        // criar picos absurdos (isso já é papel do bônus de Elite acima).
        this.level = playerLevel + Utils.randomInt(0, 2);
        if (this.level < 1) this.level = 1;

        // Elite é uma fantasia HUMANA ("★ ... o Elite", aura dourada,
        // equipamento raro) — feras têm sua própria escala de ameaça via
        // `species` (comum vs. alfa, ver BEAST_NAME_POOL/ui.js
        // onWolfEncounter), nunca precisou do sistema de Elite por cima.
        // Fase 6 da diretiva de balanceamento (Iteração 6) — achado #6 da
        // auditoria: taxa fixa em qualquer nível deixava um Elite (+2
        // níveis por cima do jitter normal) acessível já no nível 1, sem
        // o jogador ter nenhuma ferramenta pra lidar com isso. Ver
        // BalanceCore.getEliteChance: zero nos 3 primeiros níveis, rampa
        // até a taxa cheia no nível 10, taxa cheia inalterada dali em
        // diante (mesmo comportamento de sempre pro resto do jogo).
        if (isBeast) {
            this.isElite = false;
        } else {
            const eliteChance = window.BalanceCore ? window.BalanceCore.getEliteChance(this.level, ELITE_ENEMY_CHANCE) : ELITE_ENEMY_CHANCE;
            this.isElite = Utils.chance(eliteChance);
            if (this.isElite) {
                this.name = `★ ${this.name}, o Elite`;
                this.level += 2;
            }
        }

        // Personalidade + estilo de luta via motor de IA. Fera usa
        // `forcedStyle: BEAST_FIGHTING_STYLES.fera` (ver ai.js
        // assignProfile) — nunca o sorteio humano, e nunca um arquétipo
        // raro por cima (rasos como "Trocador de Armas" não fazem sentido
        // sem inventário). Personalidade (cauteloso/agressivo/veterano)
        // continua sorteada normalmente — dá variação real de
        // comportamento entre lobos sem precisar de nenhum sistema novo.
        if (isBeast) {
            window.AICombat.assignProfile(this, { level: this.level, forcedStyle: window.BEAST_FIGHTING_STYLES.fera, allowRareArchetype: false });
        } else {
            // `raceId: pickedRace` (item 21 — ver RACE_STYLE_WEIGHTS em
            // ai_data.js): já sorteada mais acima pro pool de nomes, então dá
            // pra enviesar o ESTILO pela raça no mesmo passo, antes mesmo de
            // `this.race` ser atribuído formalmente logo abaixo.
            window.AICombat.assignProfile(this, { level: this.level, raceId: pickedRace });
        }

        // Raça (ver races.js) — antes só o Jogador tinha `.race` (escolhida
        // na Criação de Personagem); Entity.getTotalStat já soma o
        // modificador racial de forma genérica pra qualquer entidade que
        // tenha o campo, então bastava atribuir um aqui pros inimigos do
        // Duelo Rápido também terem identidade racial de verdade (não só
        // visual), sem precisar mudar nenhuma fórmula de combate. Fera
        // nunca teve raça (null — Entity.getTotalStat já trata ausência de
        // `.race` como "sem bônus racial", nenhum caso especial extra
        // precisa existir por causa disso).
        this.race = pickedRace;

        // Distribui pontos de atributo com base no nível gerado, enviesados
        // pelo estilo de luta já sorteado (agora `fera` pra feras — STR/AGI
        // altos, INT/CHA zerados, ver ai_data.js BEAST_FIGHTING_STYLES).
        this.generateStats();

        // Aparência: fera ainda usa o gerador de visual humano por ora —
        // um renderizador de quadrúpede próprio pra batalha é trabalho de
        // Prioridade 4 (polimento visual) da auditoria mestre, fora do
        // escopo desta correção arquitetural. O que MUDA de verdade em
        // combate (nome "Lobo Cinzento", zero equipamento, habilidades
        // próprias) já resolve a parte crítica do achado.
        this.visuals = isBeast ? randomFighterVisuals(null, null) : randomFighterVisuals(this.aiStyle ? this.aiStyle.id : null, this.race);

        // Aura dourada do Elite — `this.isElite` já é sempre `false` pra
        // fera (acima), então este bloco nunca dispara pra elas.
        if (this.isElite) {
            this.visuals.hasAura = true;
            this.visuals.auraColor = '#ffd700';
            this.visuals.particle = 'elite_sparks';
        }

        // CORREÇÃO CRÍTICA: fera nunca equipa NADA — nem arma (mordida/
        // investida são habilidades naturais, não golpes de arma) nem
        // armadura/capacete/trinket/runa/comida (todo o pipeline de
        // `equipArmor()` é equipamento humano). `generateStats()` acima já
        // finalizou HP/MP a partir dos atributos base (ver
        // Entity.generateStatsFromStyle), então não falta nenhuma
        // recalculação — só os humanos passam pelo equipamento.
        if (!isBeast) {
            // Arma coerente com o estilo sorteado (a menos que o arquétipo raro
            // "Lutador de Punho Nu" já tenha recusado armas em assignProfile)
            if (!this.aiRareArchetype || this.aiRareArchetype.id !== 'lutador_desarmado') {
                this.equipStyleWeapon();
            }
            // Armadura independe do arquétipo — "Lutador de Punho Nu" recusa
            // ARMA, não armadura (thematicamente é bem normal um brigão de
            // punho nu ainda vestir proteção no torso). equipArmor() já faz a
            // recalculação final de stats/HP/MP, então cobre os dois ramos
            // acima sem precisar duplicar a chamada.
            this.equipArmor();
        }

        // Recompensa ao ser derrotado — Elite vale bem mais que o dobro,
        // pra recompensar de verdade o risco extra de enfrentá-lo (sempre
        // 1x pra fera, já que `isElite` é sempre false pra elas).
        this.expValue = Math.floor(20 * Math.pow(1.2, this.level) * (this.isElite ? 2.2 : 1));
        this.goldValue = Math.floor(Utils.randomInt(10, 30) * (this.level * 0.5 + 1) * (this.isElite ? 2.2 : 1));
    }

    generateStats() {
        // Base + escalonamento; ver Entity.generateStatsFromStyle (player.js)
        // pela distribuição enviesada pelo `statFocus` do estilo já sorteado
        // — um "Mago" tende a nascer com INT alto, um "Brutamontes" com STR
        // alto, etc, sem deixar de ser aleatório. Elite não ganha mais um
        // bônus de pontos soltos aqui — o nível já subiu +2 na criação, e a
        // fórmula compartilhada (totalStatPointsForLevel) já escala com ele;
        // a vantagem do Elite vem do nível efetivo + melhor raridade de
        // equipamento/encantamento (ver equipStyleWeapon/equipArmor), nunca
        // de pontos extra fora da fórmula (ver auditoria de balanceamento).
        this.generateStatsFromStyle(totalStatPointsForLevel(this.level));
    }

    // Equipa uma arma coerente com o estilo de luta já atribuído (chamado
    // depois de assignProfile, já que a escolha depende do estilo sorteado).
    // Ver Entity.equipStyleWeaponGeneric (player.js) pela lógica
    // compartilhada com Vampire/Ghost; 20% de chance de Encantamento (ver
    // enchantments.js) — antes só o Jogador podia ter arma encantada, mesmo
    // battle.js já lendo encantamento de QUALQUER `entity` genericamente.
    // Elite tem chance de raridade e de encantamento bem maiores.
    //
    // Chance de raridade Incomum escalada com o nível (0% em nível 1-2,
    // crescendo devagar depois) — antes era `15 + nível`, ou seja, um
    // inimigo de nível 1 já tinha 16% de chance de Incomum, o que
    // contribuía pra sensação de "arena de nível 1-3 já aparece com item
    // bom" reportada pelo jogador. Elite (raro por si só, ver
    // ELITE_ENEMY_CHANCE) mantém a fórmula antiga — é justo que ele seja
    // sempre notavelmente mais bem equipado.
    equipStyleWeapon() {
        const rarityChance = this.isElite
            ? (15 + this.level + 30)
            : Utils.clamp((this.level - 2) * 5, 0, 40);
        this.equipStyleWeaponGeneric(rarityChance, this.isElite ? 45 : 20);
    }

    // Armadura (peitoral) — antes só Rivais nomeados da Ladder (ver
    // Rival.equipGear) tinham algo no slot CHEST; o Duelo Rápido comum
    // (Enemy) nunca equipava nada ali, apesar de graphics.js _drawTorso já
    // ler `equipment[SLOTS.CHEST]` de QUALQUER entidade genericamente pra
    // colorir/metalizar o torso — todo oponente comum da arena sempre
    // desenhava um torso "civil" sem armadura visível nenhuma, mesmo o
    // sistema já suportando isso havia muitas iterações. Mesma curva de
    // raridade "tamed" e mesmo filtro regional já usados pra arma (ver
    // equipStyleWeapon acima e AICombat.pickArmor) — nunca reintroduz o
    // problema de "item bom demais cedo demais" que o balanceamento
    // anterior corrigiu, e nunca equipa armadura de outra cidade.
    // Mega Atualização item 12/13: `rarityChance` (0-100+) agora alimenta o
    // mesmo sorteio ponderado de 5 raridades usado pela arma (ver
    // ItemFactory.rollGearRarity/createEquipmentForEntity em items.js),
    // nunca mais um coinflip Comum/Incomum — e nunca entrega uma armadura
    // que o próprio inimigo não atenda os requisitos (Entity.canEquip).
    equipArmor() {
        const rarityChance = this.isElite
            ? (15 + this.level + 30)
            : Utils.clamp((this.level - 2) * 5, 0, 40);
        const armorId = window.AICombat.pickArmor();
        this.equipment[SLOTS.CHEST] = ItemFactory.createEquipmentForEntity(this, armorId, 'armors', rarityChance);
        // Auditoria de Combate e Escalonamento — amuleto/anel (ver
        // Entity.maybeEquipTrinkets em player.js), nunca equipados antes
        // por nenhum inimigo do jogo. Chance de equipar cresce com o nível
        // (nunca garantida), Elite sempre bem mais provável de carregar os
        // dois — mesmo espírito de "tendência, não garantia" já usado pela
        // raridade acima.
        const trinketChance = this.isElite ? 60 : Utils.clamp(15 + this.level * 2, 15, 55);
        this.maybeEquipTrinkets(trinketChance, rarityChance);
        // Auditoria de Combate e Escalonamento (Iteração 2) — resto do
        // conjunto de armadura (ver Entity.maybeEquipFullArmorSet em
        // player.js), mesma chance da arma/trinket já calculada acima.
        this.maybeEquipFullArmorSet(trinketChance, rarityChance);
        // Runas (ver Entity.maybeApplyRunes) — só entra em vigor no
        // Santuário Élfico, identidade regional das runas (ver runes.js).
        this.maybeApplyRunes(trinketChance);
        // Comida/buff (ver Entity.maybeApplyFoodBuff) — mesma chance dos
        // trinkets/armadura; inimigo "bem preparado" carrega provisão.
        this.maybeApplyFoodBuff(trinketChance);
        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
    }

    // Chance de dropar um item ao ser derrotado, influenciada pela Sorte do
    // jogador. Elite SEMPRE dropa algo, de um nível bem mais alto — o
    // desafio extra precisa se traduzir num prêmio garantido, não só numa
    // chance melhor.
    //
    // cityId (ver citydatabase.js) SEMPRE repassado pro sorteio de loot —
    // antes generateShopInventory era chamado sem esse argumento em TODO
    // generateLoot do arquivo, e como o filtro de região trata `region ===
    // cityId` com cityId ausente (undefined) como "não bate", isso excluía
    // CATEGORICAMENTE qualquer item regional (Lâmina Élfica, Machado de
    // Guerra Orc...) do drop de loot em QUALQUER cidade, inclusive a
    // própria cidade de origem do item — só dava pra conseguir esses itens
    // comprando na loja certa. Loot agora respeita a mesma regra de região
    // já usada pelas lojas.
    generateLoot(playerLuk) {
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        if (this.isElite) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 5, cityId);
            return dropTable[0];
        }

        const dropChance = 30 + (playerLuk * 2);
        if (Utils.chance(dropChance)) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 2, cityId);
            return dropTable[0];
        }
        return null;
    }

    // Compartilhado por Enemy e Rival (ver equipGear abaixo) — sorteia um
    // encantamento elemental aleatório (fogo/gelo/eletricidade/etc, ver
    // enchantments.js) pra arma equipada, com `chancePercent`% de chance.
    // No-op se o item não aceitar encantamento de arma.
    static maybeEnchantWeapon(weapon, chancePercent) {
        if (!weapon || !window.EnchantmentSystem || !window.ENCHANTMENTS) return;
        if (!Utils.chance(chancePercent)) return;
        const weaponEnchants = Object.keys(window.ENCHANTMENTS).filter(id => window.ENCHANTMENTS[id].appliesTo.includes('weapon'));
        if (weaponEnchants.length === 0) return;
        const enchantId = weaponEnchants[Utils.randomInt(0, weaponEnchants.length - 1)];
        window.EnchantmentSystem.apply(weapon, enchantId);
    }
}

/**
 * Vampiro — inimigo especial do Ritual do Vampirismo (ver rituals.js). Só
 * aparece à noite na Cidade (ver city.js) e tem chance pequena de dropar uma
 * Essência Vampírica, o recurso que o jogador precisa reunir (10 no total)
 * pra liberar o botão "Realizar Ritual". Usa a MESMA IA comum de combate
 * (AICombat) que qualquer inimigo — não é um boss, é só um adversário
 * temático; só o boss do ritual (Conde Vampiro) tem IA exclusiva (ver bossai.js).
 */
// Auditoria de Combate e Escalonamento (Iteração 4) — Seção 5: vampiro
// noturno NÃO deve mais escalar com o nível do jogador — ganha uma
// patente própria, com nível fixo por patente, independente do jogador.
// Patentes inferiores são bem mais comuns que a nobre (ver
// VAMPIRE_RANK_WEIGHTS), então a maioria dos encontros ainda é um desafio
// comum — a raridade da patente nobre é o que a torna memorável. Nomes
// existentes de VAMPIRE_NAMES (removida) foram distribuídos por patente
// em vez de sorteados soltos — "Nobre da Noite Eterna" pertence à patente
// nobre, "Servo do Conde"/"Filho das Trevas" às inferiores, fazendo o
// próprio nome já sinalizar o perigo antes da luta começar. O Conde
// Vampiro DE VERDADE continua sendo o boss único de bossai.js/BOSS_DEFS
// (nível próprio dele, não mexido aqui) — este Vampiro AMBIENTE (perigo
// noturno da cidade) nunca usa o título "Conde", só as 3 patentes abaixo.
const VAMPIRE_RANKS = {
    inferior: { names: ['Servo do Conde', 'Filho das Trevas'], levelRange: [5, 8] },
    guerreiro: { names: ['Vampiro Renascido', 'Sanguessuga Ancestral'], levelRange: [8, 11] },
    nobre: { names: ['Nobre da Noite Eterna'], levelRange: [11, 14] }
};
const VAMPIRE_RANK_WEIGHTS = { inferior: 55, guerreiro: 30, nobre: 15 };
class Vampire extends Entity {
    // `playerLevel` não decide mais o nível (ver Seção 5 acima) — parâmetro
    // mantido só pra não quebrar os chamadores existentes (city.js
    // _eventVampireEncounter/_eventNightDanger), que continuam passando
    // `p.level` sem saber que agora é ignorado.
    constructor(playerLevel) {
        const rankId = (Utils.weightedPick && Utils.weightedPick(VAMPIRE_RANK_WEIGHTS)) || 'inferior';
        const rank = VAMPIRE_RANKS[rankId];
        super(rank.names[Utils.randomInt(0, rank.names.length - 1)]);
        this.isVampireEnemy = true; // flag que battle.js usa pra sortear a Essência ao derrotá-lo
        this.lineage = 'vampirismo'; // usado por LineageSystem.getWeaknessMultiplier em battle.js (jogadores da Linhagem Luz causam +25% de dano nele)

        this.vampireRank = rankId; // lido por IA/depuração — não afeta cálculo nenhum
        this.level = Utils.randomInt(rank.levelRange[0], rank.levelRange[1]);

        // Estilo sorteado ANTES dos atributos, pelo mesmo motivo do Enemy
        // comum: permite que generateStats enviese os pontos pelo statFocus
        // do estilo (um Vampiro "brutamontes" nasce forte de verdade).
        window.AICombat.assignProfile(this, { level: this.level, styleId: Utils.chance(50) ? 'assassino' : 'brutamontes' });
        this.generateStats();
        this.equipStyleWeapon();
        this.equipArmor();

        // Identidade visual de vampiro (mesma paleta descrita em
        // LINEAGES.vampirismo.visual) — pele pálida, olhos vermelhos, presas.
        this.visuals = {
            gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
            skinTone: '#e8dce8', eyeColor: '#c81e2a', eyebrowColor: '#2a1c10',
            hairStyle: Utils.randomInt(1, 15), hairColor: '#1a1218', beardStyle: 0, beardColor: '#1a1218',
            faceShape: Utils.randomInt(1, 3), archetype: 'assassino', scarStyle: 0,
            hasFangs: true // lido por graphics.js pra desenhar as presas
        };

        this.expValue = Math.floor(24 * Math.pow(1.2, this.level));
        this.goldValue = Math.floor(Utils.randomInt(12, 32) * (this.level * 0.5 + 1));
    }

    generateStats() {
        // Mesma fórmula compartilhada do Enemy comum (ver
        // totalStatPointsForLevel acima) — a dificuldade do Vampiro vem
        // inteira do nível fixo da patente sorteada (ver VAMPIRE_RANKS no
        // construtor), nunca de pontos extras soltos por cima disso.
        this.generateStatsFromStyle(totalStatPointsForLevel(this.level));
    }

    // Ver Entity.equipStyleWeaponGeneric (player.js) pela lógica
    // compartilhada com Enemy/Ghost. 20% de chance de Encantamento — igual
    // ao Duelo Rápido comum (Enemy), fechando uma lacuna: Vampire nunca
    // tinha essa chance antes, mesmo sendo um combatente comum pra fins de
    // IA/equipamento (só o boss do Ritual, Conde Vampiro, tem IA exclusiva).
    equipStyleWeapon() {
        this.equipStyleWeaponGeneric(20, 20);
    }

    // Armadura (peitoral) — bug de auditoria: o boss deste mesmo arquétipo
    // (Conde Vampiro, ver BOSS_DEFS mais abaixo) usa cota de malha
    // Lendária, deixando claro que um vampiro corpóreo pode perfeitamente
    // vestir armadura, mas o Vampiro comum do perigo noturno (ver city.js
    // _eventNightDanger) nunca tinha recebido a mesma migração que Enemy.
    // equipArmor() já ganhou — o torso dele sempre desenhava "civil" mesmo
    // graphics.js _drawTorso já lendo equipment[SLOTS.CHEST] de qualquer
    // entidade genericamente. Mesma curva de raridade "tamed" e mesmo
    // filtro regional de Enemy.equipArmor() (ver AICombat.pickArmor()).
    // Fantasma (ver classe Ghost abaixo) fica de fora de propósito: é
    // incorpóreo/etéreo (ver visuals.hasAura), nunca vestiria armadura
    // física — Vampiro é um morto-vivo com corpo de verdade.
    // Mega Atualização item 12/13: mesmo sorteio ponderado de 5 raridades +
    // checagem de requisitos do Enemy.equipArmor acima (ver comentário lá).
    equipArmor() {
        const rarityChance = Utils.clamp((this.level - 2) * 5, 0, 40);
        const armorId = window.AICombat.pickArmor();
        this.equipment[SLOTS.CHEST] = ItemFactory.createEquipmentForEntity(this, armorId, 'armors', rarityChance);
        // Auditoria de Combate e Escalonamento — ver comentário completo em
        // Enemy.equipArmor acima; Vampiro nunca tinha amuleto/anel/resto da
        // armadura também.
        const trinketChance = Utils.clamp(15 + this.level * 2, 15, 55);
        this.maybeEquipTrinkets(trinketChance, rarityChance);
        this.maybeEquipFullArmorSet(trinketChance, rarityChance);
        this.maybeApplyRunes(trinketChance);
        this.maybeApplyFoodBuff(trinketChance);
        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
    }

    // Chance pequena e independente do loot normal de itens — checado em
    // battle.js no fim da luta quando `this.enemy.isVampireEnemy` é true.
    rollEssenceDrop() {
        return Utils.chance(18);
    }

    generateLoot(playerLuk) {
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        const dropChance = 80; // pedido do usuário: taxa de drop de item do vampiro fixa em 80%
        if (Utils.chance(dropChance)) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 2, cityId);
            return dropTable[0];
        }
        return null;
    }
}

/**
 * Fantasma — o outro perigo noturno da cidade (ver city.js _eventNightDanger),
 * ao lado do Vampiro. Usa a MESMA IA comum de combate (AICombat) que
 * qualquer inimigo — não é um boss, é só um adversário temático que só
 * aparece à noite. `lineage: 'sombras'` é só reaproveitamento de dado: a
 * Linhagem Sombras já define sua fraqueza como Luz em lineages.js (ainda
 * bloqueada como mutação jogável), então um jogador da Linhagem Luz já
 * causa +25% de dano num Fantasma de graça, via
 * LineageSystem.getWeaknessMultiplier — sem precisar duplicar essa regra aqui.
 */
const GHOST_NAMES = ['Fantasma Errante', 'Alma Penada', 'Sombra Uivante', 'Espectro sem Nome', 'Eco dos Mortos'];
class Ghost extends Entity {
    constructor(playerLevel) {
        super(GHOST_NAMES[Utils.randomInt(0, GHOST_NAMES.length - 1)]);
        this.isGhostEnemy = true; // flag informativa (paralela a isVampireEnemy), sem drop próprio por enquanto
        this.lineage = 'sombras';

        this.level = playerLevel + Utils.randomInt(0, 2);
        if (this.level < 2) this.level = 2;

        // Fantasmas favorecem esquiva/crítico (estilo assassino) — golpeiam
        // e desaparecem antes de revidar, nunca encaram um combate direto.
        window.AICombat.assignProfile(this, { level: this.level, styleId: 'assassino' });
        this.generateStats();
        this.equipStyleWeapon();

        // Identidade visual etérea: pele e olhos muito pálidos, com a MESMA
        // aura genérica usada pela Linhagem Luz (ver _drawLineageAura em
        // graphics.js), só que num azul-esbranquiçado frio em vez de dourado
        // — nenhum código novo de renderização precisou ser escrito.
        this.visuals = {
            gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
            skinTone: '#dce8f0', eyeColor: '#eaf6ff', eyebrowColor: '#c8dce8',
            hairStyle: Utils.randomInt(1, 15), hairColor: '#c8dce8', beardStyle: 0, beardColor: '#c8dce8',
            faceShape: Utils.randomInt(1, 3), archetype: 'assassino', scarStyle: 0,
            hasAura: true, auraColor: 'rgba(168,216,255,0.4)'
        };

        this.expValue = Math.floor(22 * Math.pow(1.2, this.level));
        this.goldValue = Math.floor(Utils.randomInt(10, 28) * (this.level * 0.5 + 1));
    }

    generateStats() {
        // Mesma fórmula compartilhada do Enemy comum (ver auditoria de
        // balanceamento acima) — Fantasma já é mais difícil por ter piso de
        // nível 2 e um nível efetivo mais alto (playerLevel + 0~2), não
        // precisa de mais +3 pontos soltos por cima disso.
        this.generateStatsFromStyle(totalStatPointsForLevel(this.level));
    }

    // Ver Entity.equipStyleWeaponGeneric (player.js) pela lógica
    // compartilhada com Enemy/Vampire. 20% de chance de Encantamento,
    // igual ao resto do Duelo Rápido — Ghost nunca tinha essa chance antes.
    equipStyleWeapon() {
        this.equipStyleWeaponGeneric(15, 20);
    }

    generateLoot(playerLuk) {
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        const dropChance = 22 + (playerLuk * 2);
        if (Utils.chance(dropChance)) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 2, cityId);
            return dropTable[0];
        }
        return null;
    }
}

/**
 * Bosses de Ritual (Conde Vampiro, Anjo Guardião) — muito mais fortes que
 * qualquer inimigo comum, com IA 100% exclusiva (ver bossai.js, nunca usa
 * AICombat). Orientado a dados: BOSS_DEFS é o registry; adicionar um boss
 * novo é só registrar uma entrada aqui + a IA correspondente em bossai.js.
 */
const BOSS_DEFS = {
    conde_vampiro: {
        id: 'conde_vampiro', name: 'Conde Vampiro', title: 'Senhor da Noite Eterna',
        levelBonus: 8, statMult: 1.9,
        weaponId: 'dagger', weaponRarity: 'LEGENDARY',
        armorId: 'chainmail', armorRarity: 'LEGENDARY',
        visuals: { gender: 'Masculino', skinTone: '#ded0de', eyeColor: '#ff1a2a', eyebrowColor: '#1a1218',
            hairStyle: 4, hairColor: '#1a1218', beardStyle: 0, beardColor: '#1a1218', faceShape: 3, archetype: 'assassino', scarStyle: 0, hasFangs: true },
        lineage: 'vampirismo'
    },
    anjo_guardiao: {
        id: 'anjo_guardiao', name: 'Anjo Guardião', title: 'Sentinela da Luz Eterna',
        levelBonus: 8, statMult: 1.9,
        weaponId: 'spear', weaponRarity: 'LEGENDARY',
        armorId: 'platearmor', armorRarity: 'LEGENDARY',
        visuals: { gender: 'Feminino', skinTone: '#fff6ea', eyeColor: '#fff6d8', eyebrowColor: '#d8c890',
            hairStyle: 9, hairColor: '#f0e6c0', beardStyle: 0, beardColor: '#f0e6c0', faceShape: 2, archetype: 'campeao', scarStyle: 0, hasAura: true },
        lineage: 'luz'
    }
};
window.BOSS_DEFS = BOSS_DEFS;

// Cria a instância de combate do boss (Entity completo, com stats/
// equipamento/visual próprios) — bossId vem de LINEAGES[x].bossId.
function createBoss(bossId, playerLevel) {
    const def = BOSS_DEFS[bossId];
    if (!def) return null;

    const boss = new Entity(def.name);
    boss.title = def.title;
    boss.personality = def.title; // usado pela tela de batalha ("Você encontrou X (título)!")
    boss.isBoss = true;
    boss.bossId = bossId;
    boss.lineage = def.lineage;
    // Bosses nunca passam por AICombat.assignProfile (IA 100% exclusiva, ver
    // bossai.js), então nunca ganhavam `.aiSkills` como qualquer inimigo
    // comum — a barra de mana (ver ui.js updateBattleBars) usa esse campo
    // genericamente pra achar a habilidade mais barata do combatente, sem
    // precisar de nenhum caso especial pra bosses.
    boss.aiSkills = (window.BOSS_SKILL_IDS && window.BOSS_SKILL_IDS[bossId]) || [];
    boss.level = Math.max(playerLevel + def.levelBonus, 10);

    // Distribuição de atributos generosa e equilibrada (bosses não têm
    // fraquezas de build como os inimigos comuns — são desafios completos)
    const totalPoints = Math.floor((40 + boss.level * 6) * def.statMult);
    const keys = Object.keys(boss.baseStats);
    for (let i = 0; i < totalPoints; i++) boss.baseStats[keys[Utils.randomInt(0, keys.length - 1)]]++;

    boss.equipment[SLOTS.MAIN_HAND] = ItemFactory.createEquipment(def.weaponId, 'weapons', RARITY[def.weaponRarity]);
    boss.equipment[SLOTS.CHEST] = ItemFactory.createEquipment(def.armorId, 'armors', RARITY[def.armorRarity]);
    boss.visuals = { ...def.visuals };

    boss.calculateDerivedStats();
    // Bosses são MUITO mais resistentes que a fórmula base de atributos
    // sozinha daria — reforça que não são "só mais um inimigo forte".
    boss.derivedStats.maxHp = Math.floor(boss.derivedStats.maxHp * 2.2);
    boss.currentHp = boss.derivedStats.maxHp;
    boss.derivedStats.maxMp = Math.floor(boss.derivedStats.maxMp * 1.5);
    boss.currentMp = boss.derivedStats.maxMp;

    boss.expValue = Math.floor(80 * Math.pow(1.15, boss.level));
    boss.goldValue = Math.floor(150 + boss.level * 12);

    // Recompensa de loot garantida e lendária, além do desbloqueio da Linhagem
    //
    // Bug de auditoria: buscar um item RARITY.LEGENDARY dentro de um pool de
    // generateShopInventory nunca encontrava nada de verdade (essa função
    // nunca produzia nada acima de Raro, ver items.js), então o fallback
    // `pool[0]` era executado SEMPRE — um boss de Linhagem podia deixar
    // loot Comum, contrariando o próprio comentário "garantida e lendária".
    // generateGuaranteedItem (ver items.js) cria o item já na raridade certa
    // direto, sem depender de sorte num pool que nunca alcançava esse tier.
    boss.generateLoot = function (playerLuk) {
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        return window.ItemFactory.generateGuaranteedItem(cityId, RARITY.LEGENDARY);
    };

    return boss;
}
window.createBoss = createBoss;

/**
 * Bosses Especiais da Arena (item 6 da mega-diretiva Arena+Estilos) —
 * diferente dos Campeões da Ladder (que já testam o jogador via troca de
 * personalidade em `phases`, ver RivalDatabase) e dos Bosses de Ritual
 * acima (BOSS_DEFS/createBoss, ligados a uma Linhagem), estes são desafios
 * OPCIONAIS extras, desbloqueados ao derrotar o campeão de uma liga
 * específica (ver ui.js openLadder — seção "Bosses Especiais"), cada um
 * com IA 100% exclusiva (bossai.js) e UMA mecânica de combate própria,
 * nunca só "+HP+STR+DEF" (pedido explícito da diretiva).
 *
 * `furyPerHit`/`furyMax` (lidos por battle.js executeAttack) ligam a
 * mecânica de Fúria Crescente: cada golpe recebido acumula fúria até o
 * teto; a IA do próprio boss (bossai.js) decide o que fazer com isso —
 * este registry só declara QUE o boss tem a mecânica, nunca a lógica dela.
 */
const ARENA_BOSS_DEFS = {
    grokmar_furia: {
        id: 'grokmar_furia', name: 'Grokmar, a Fúria Desperta', title: 'Fúria Desperta',
        unlocksAfterRival: 'orc_champion', // precisa ter derrotado Gorkhal primeiro
        levelBonus: 6, statMult: 1.6,
        weaponId: 'orcwaraxe', weaponRarity: 'LEGENDARY',
        armorId: 'orcheavyarmor', armorRarity: 'LEGENDARY',
        trophyId: 'grokmaraxe', trophyCategory: 'weapons', // item 23 da diretiva — arma nomeada exclusiva, ver items.js
        furyPerHit: 12, furyMax: 100,
        // Item 27 da mega-diretiva ("atualizar o livro de instruções, não
        // esquecer") + item 32 ("mecânica precisa ser legível") — texto
        // curto voltado ao JOGADOR (sem jargão de código), lido ao vivo
        // por guide.js _renderArena() no bloco de cada Boss Especial.
        mechanicName: 'Fúria Crescente',
        mechanicDescription: 'Cada golpe que ele RECEBE acumula fúria — ao cruzar certos limiares, fica permanentemente mais forte e mais imprudente pelo resto da luta. Termine rápido ou prepare-se pra fúria total.',
        race: 'orc',
        visuals: { gender: 'Masculino', skinTone: '#4a6a2a', eyeColor: '#ff2a1a', eyebrowColor: '#1a1a0a',
            hairStyle: 3, hairColor: '#1a1a0a', beardStyle: 2, beardColor: '#1a1a0a', faceShape: 4, archetype: 'barbaro', scarStyle: 4 }
    },
    // Boss de Linhagem (item 7 da mega-diretiva) — Nyxara representa a
    // Linhagem Sombras (ver lineages.js LINEAGES.sombras), que NUNCA teve
    // ritual/boss próprio (só é despertada via Corrupção, ver
    // corruption.js) — este NÃO é o boss que desperta a linhagem, é um
    // desafio opcional temático dela na Arena. `lineage: 'sombras'` é
    // usado por ui.js openLadder pra aplicar a regra explícita da
    // diretiva: um jogador que JÁ possui uma linhagem nunca deve poder
    // enfrentar o boss temático dessa MESMA linhagem.
    nyxara_sombras: {
        id: 'nyxara_sombras', name: 'Nyxara, Senhora das Sombras', title: 'Senhora das Sombras',
        unlocksAfterRival: 'anao_champion', // último campeão de liga — desafio opcional mais tardio que Grokmar
        levelBonus: 10, statMult: 1.75,
        weaponId: 'dagger', weaponRarity: 'LEGENDARY',
        armorId: 'leatherchest', armorRarity: 'LEGENDARY',
        trophyId: 'nyxaradagger', trophyCategory: 'weapons', // item 23 da diretiva — arma nomeada exclusiva, ver items.js
        lineage: 'sombras',
        shadowStackMax: 4, shadowDodgeBonusPerStack: 12,
        mechanicName: 'Manto de Sombras',
        mechanicDescription: 'Cada turno DELA sem ser atingida acumula um véu de sombras que aumenta a esquiva — um golpe certeiro dissipa tudo na hora. Manter pressão constante é a única forma de evitar que ela fique quase intocável.',
        visuals: { gender: 'Feminino', skinTone: '#3a3040', eyeColor: '#8a3ae0', eyebrowColor: '#1a1420',
            hairStyle: 6, hairColor: '#1a1420', beardStyle: 0, beardColor: '#1a1420', faceShape: 2, archetype: 'assassino', scarStyle: 0, hasSmoke: true }
    },
    // Sylwyn, Arqueira da Lua Cheia (Iteração 17, item 6 da mega-diretiva —
    // "bosses especiais além dos campeões, cada um com mecânica própria,
    // NUNCA só +HP+STR+DEF"). Desbloqueada depois do Campeão Élfico,
    // espelhando como Grokmar desbloqueia depois do Orc — mas com uma
    // mecânica de NATUREZA totalmente diferente das outras duas: CICLO
    // LUNAR, guiado por TEMPO (turnos DELA), não por dano recebido (Fúria
    // de Grokmar) nem por ausência de dano recebido (Manto de Sombras de
    // Nyxara). A lógica do ciclo mora inteira em bossai.js (ver
    // BOSS_AI.sylwyn_lua) — aqui só os campos de estado inicial, mesmo
    // padrão de furyPerHit/shadowStackMax acima.
    sylwyn_lua: {
        id: 'sylwyn_lua', name: 'Sylwyn, Arqueira da Lua Cheia', title: 'Arqueira da Lua Cheia',
        unlocksAfterRival: 'elfica_champion',
        levelBonus: 8, statMult: 1.7,
        weaponId: 'elvenlongbow', weaponRarity: 'LEGENDARY',
        armorId: 'elvencloak', armorRarity: 'LEGENDARY',
        trophyId: 'sylwynbow', trophyCategory: 'weapons', // item 23 da diretiva — arma nomeada exclusiva, ver items.js
        moonCycle: true,
        mechanicName: 'Ciclo Lunar',
        mechanicDescription: 'Sua força varia num ciclo previsível: mais fraca sob a Lua Nova (e se curando aos poucos), normal na Crescente, e muito mais perigosa — com a flecha mais forte dela garantida — na Lua Cheia. Aprenda o ritmo.',
        race: 'elfo',
        visuals: { gender: 'Feminino', skinTone: '#d8c8b8', eyeColor: '#c8d8f0', eyebrowColor: '#e0e0e8',
            hairStyle: 4, hairColor: '#e8e8f0', beardStyle: 0, beardColor: '#e8e8f0', faceShape: 1, archetype: 'guerreira', scarStyle: 0 }
    },
    // Brakka Fundefogo, Mestra da Forja (Iteração 18, item 6 da
    // mega-diretiva — exemplo conceitual do próprio usuário "Dwarf
    // Mestre da Forja", reimaginado com mecânica própria, nunca copiado
    // literalmente). Desbloqueada depois do Campeão de Prata — DELIBERADAMENTE
    // mais cedo que Grokmar/Sylwyn/Nyxara (todos pós-liga-final), pra dar
    // ao jogador uma primeira Boss Especial opcional ainda no meio do
    // jogo, não só no fim. Mecânica própria: FORJA VIVA, guiada pela
    // PRÓPRIA ESCOLHA da boss (nem dano recebido como Grokmar, nem
    // ausência de dano como Nyxara, nem tempo como Sylwyn) — cada vez que
    // ela ergue o Escudo Rúnico, acumula uma carga; ao atingir o teto,
    // descarrega tudo num único golpe (Marreta Incandescente) com dano
    // proporcional às cargas gastas, depois volta ao normal. O jogador
    // aprende a reconhecer o padrão "ela está defendendo → está
    // carregando o próximo golpe forte" e decide se pressiona pra
    // interromper o ciclo ou se guarda recursos pro golpe que vem.
    brakka_forja: {
        id: 'brakka_forja', name: 'Brakka Fundefogo, Mestra da Forja', title: 'Mestra da Forja',
        unlocksAfterRival: 'silver_champion',
        levelBonus: 5, statMult: 1.5,
        weaponId: 'dwarvenhammer', weaponRarity: 'LEGENDARY',
        armorId: 'platearmor', armorRarity: 'LEGENDARY',
        trophyId: 'brakkahammer', trophyCategory: 'weapons', // item 23 da diretiva — arma nomeada exclusiva, ver items.js
        runeForge: true,
        mechanicName: 'Forja Viva',
        mechanicDescription: 'Cada vez que ela ergue o Escudo Rúnico, acumula uma carga na forja interior — ao encher o limite, descarrega tudo num único golpe devastador. Fique de olho em quando ela se defende: é aí que o próximo golpe forte está sendo preparado.',
        race: 'anao',
        visuals: { gender: 'Feminino', skinTone: '#c8a888', eyeColor: '#e8a020', eyebrowColor: '#4a3020',
            hairStyle: 2, hairColor: '#8a4020', beardStyle: 3, beardColor: '#8a4020', faceShape: 3, archetype: 'veterano', scarStyle: 2 }
    }
};
window.ARENA_BOSS_DEFS = ARENA_BOSS_DEFS;

// Cria a instância de combate de um Boss Especial da Arena — estrutura
// gêmea de createBoss (acima), mas sem vínculo com Linhagem/Ritual: raça
// própria (pro passivo racial correto) e campos de Fúria inicializados.
function createArenaBoss(bossId, playerLevel) {
    const def = ARENA_BOSS_DEFS[bossId];
    if (!def) return null;

    const boss = new Entity(def.name);
    boss.title = def.title;
    boss.personality = def.title;
    boss.isBoss = true;
    boss.bossId = bossId;
    boss.race = def.race || null;
    boss.lineage = def.lineage || null; // lido por ui.js openLadder pra bloquear o boss contra jogadores da MESMA linhagem (item 7 da diretiva)
    boss.aiSkills = (window.BOSS_SKILL_IDS && window.BOSS_SKILL_IDS[bossId]) || [];
    boss.level = Math.max(playerLevel + def.levelBonus, 22);

    boss.furyPerHit = def.furyPerHit || 0;
    boss.furyMax = def.furyMax || 100;
    boss.furyStacks = 0;
    boss.furyTier = 0;

    // Mecânica de Forja Viva (Brakka, Iteração 18) — ver bossai.js
    // BOSS_AI.brakka_forja pra toda a lógica de acúmulo/descarga; aqui só
    // o estado inicial, mesmo padrão de furyStacks/shadowStacks/moonPhase
    // acima. `runeBaseDamage` capturado logo após calculateDerivedStats,
    // mais abaixo, igual a `moonBaseCrit`/`moonBaseDamage`.
    boss.runeForge = !!def.runeForge;
    boss.runeCharges = 0;
    boss.runeChargeMax = 3;
    boss.runeBaseDamage = 0;

    // Mecânica de Manto de Sombras (Nyxara) — cresce enquanto o boss NÃO é
    // atingido, reseta no instante em que um golpe acerta (ver battle.js
    // executeAttack e bossai.js nyxara_sombras.decideAction). `shadowStacks`
    // acumula em cima de `baseDodgeChance` (capturado logo após
    // calculateDerivedStats, mais abaixo) pra nunca sofrer drift por
    // reaplicação cumulativa, diferente do bônus de dano de Grokmar acima.
    boss.shadowStackMax = def.shadowStackMax || 0;
    boss.shadowDodgeBonusPerStack = def.shadowDodgeBonusPerStack || 0;
    boss.shadowStacks = 0;
    boss.wasHitThisRound = false;

    // Mecânica de Ciclo Lunar (Sylwyn, Iteração 17) — ver bossai.js
    // BOSS_AI.sylwyn_lua pra toda a lógica de fase; aqui só o estado
    // inicial, mesmo padrão de furyStacks/shadowStacks acima.
    // `moonBaseCrit`/`moonBaseDamage` capturados logo após
    // calculateDerivedStats, mais abaixo, igual a `baseDodgeChance`.
    boss.moonCycle = !!def.moonCycle;
    boss.moonPhase = 'nova';
    // 3, não 2: bossai.js decrementa ANTES de agir a cada turno dela (pra
    // poder reagir já no turno em que uma fase termina), então o primeiro
    // decremento consumiria 1 dos 2 turnos nominais da Nova inicial antes
    // mesmo dela agir — com 3, a Nova inicial dura os mesmos 2 turnos
    // reais que qualquer Nova seguinte no ciclo (achado testando o rastro
    // completo de 8 turnos: sem isso a primeiríssima Nova da luta durava
    // só 1 turno em vez de 2, um ritmo inconsistente com o resto do ciclo).
    boss.moonPhaseTurnsLeft = 3;
    boss.moonBaseCrit = 0;
    boss.moonBaseDamage = 0;

    const totalPoints = Math.floor((40 + boss.level * 6) * def.statMult);
    const keys = Object.keys(boss.baseStats);
    for (let i = 0; i < totalPoints; i++) boss.baseStats[keys[Utils.randomInt(0, keys.length - 1)]]++;

    // Bug de auditoria (Iteração 17): esta linha sempre equipou a arma no
    // MAIN_HAND, não importa o `slot` real do template — inofensivo pra
    // Grokmar/Nyxara (machado/adaga, ambos MAIN_HAND mesmo), mas quebraria
    // silenciosamente qualquer futuro Boss Especial com arma RANGED
    // (Sylwyn usa arco): o item entraria no slot errado e
    // `activeWeaponSlot` (default MAIN_HAND, ver Entity constructor)
    // nunca apontaria pro arco, então `getWeaponRange()`/mecânica de
    // munição nunca reconheceriam a arma de verdade equipada. Agora lê o
    // `slot` do próprio template e ajusta `activeWeaponSlot` de acordo.
    const weaponTemplate = ItemDatabase.weapons[def.weaponId];
    const weaponSlot = (weaponTemplate && weaponTemplate.slot === SLOTS.RANGED) ? SLOTS.RANGED : SLOTS.MAIN_HAND;
    boss.equipment[weaponSlot] = ItemFactory.createEquipment(def.weaponId, 'weapons', RARITY[def.weaponRarity]);
    boss.activeWeaponSlot = weaponSlot;
    boss.equipment[SLOTS.CHEST] = ItemFactory.createEquipment(def.armorId, 'armors', RARITY[def.armorRarity]);
    boss.visuals = { ...def.visuals };

    boss.calculateDerivedStats();
    boss.derivedStats.maxHp = Math.floor(boss.derivedStats.maxHp * 2.0);
    boss.currentHp = boss.derivedStats.maxHp;
    boss.derivedStats.maxMp = Math.floor(boss.derivedStats.maxMp * 1.5);
    boss.currentMp = boss.derivedStats.maxMp;
    boss.baseDodgeChance = boss.derivedStats.dodgeChance; // ponto de referência do Manto de Sombras (Nyxara)
    if (boss.moonCycle) {
        boss.moonBaseCrit = boss.derivedStats.critChance; // ponto de referência do Ciclo Lunar (Sylwyn)
        boss.moonBaseDamage = boss.derivedStats.physicalDamage;
        // A luta sempre COMEÇA na fase Lua Nova (ver moonPhase acima), mas
        // sem esta linha o modificador de -40% de crítico só seria aplicado
        // na PRÓXIMA vez que o ciclo entrasse em Nova (bossai.js só reage a
        // TRANSIÇÕES de fase, nunca ao estado inicial) — os 2 primeiros
        // turnos dela ficariam com força de Lua Crescente por engano,
        // inconsistente com toda futura passagem por Nova. Aplicado aqui
        // pra já nascer coerente com a própria mecânica.
        boss.derivedStats.critChance = Math.max(5, boss.moonBaseCrit * 0.6);
    }
    if (boss.runeForge) {
        boss.runeBaseDamage = boss.derivedStats.physicalDamage; // ponto de referência da Forja Viva (Brakka)
    }

    // Item 22 da mega-diretiva ("recompensas devem considerar dificuldade")
    // — bug de balanceamento encontrado em auditoria: a fórmula original
    // aqui (`75 * 1.15^nível`) foi copiada do BOSS_DEFS de Ritual acima
    // (conteúdo único, enfrentado uma vez na vida pra despertar uma
    // Linhagem, nunca pensado como alvo de farm repetido). Bosses
    // Especiais da Arena são EXATAMENTE o oposto — desafios opcionais
    // REFARMÁVEIS, desbloqueados só depois de já ter vencido um Campeão de
    // liga — então precisam usar a MESMA família de fórmula dos Rivais/
    // Campeões (`base * 1.25^nível`), não a dos bosses de Ritual. No
    // nível 30, a fórmula antiga dava só ~10% do XP de um Campeão comum
    // pela mesma luta — o oposto do que "harder content" deveria
    // significar. Multiplicador 2.2x (acima do 1.8x de Campeão comum)
    // reforça que são conteúdo ainda mais especial que um Campeão normal.
    boss.expValue = Math.floor(30 * Math.pow(1.25, boss.level) * 2.2);
    boss.goldValue = Math.floor(Utils.randomInt(15, 35) * (boss.level * 0.6 + 1) * 2.2);
    // Item 23 da mega-diretiva: cada Boss Especial da Arena agora dropa sua
    // própria arma nomeada (`def.trophyId`/`trophyCategory`, ver items.js
    // `arenaExclusive`) em vez do antigo loot genérico e aleatório
    // (`generateGuaranteedItem`, que sorteava QUALQUER item Lendário do
    // jogo — sem nenhuma identidade própria de quem derrotou o boss).
    boss.generateLoot = function (playerLuk) {
        if (def.trophyId && def.trophyCategory) {
            return window.ItemFactory.createEquipment(def.trophyId, def.trophyCategory, RARITY.LEGENDARY);
        }
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        return window.ItemFactory.generateGuaranteedItem(cityId, RARITY.LEGENDARY);
    };

    return boss;
}
window.createArenaBoss = createArenaBoss;

/**
 * Ladder de Rivais: adversários nomeados e fixos, organizados em ligas
 * progressivas. Diferente do Duelo Rápido (Enemy, acima, totalmente
 * aleatório), cada Rival tem uma distribuição de atributos e equipamento
 * curados de propósito, então enfrentá-lo sempre parece "aquele adversário
 * específico" em vez de um número genérico.
 */
class Rival extends Entity {
    constructor(def) {
        super(def.name);
        this.rivalId = def.id;
        this.level = def.level;
        this.isChampion = !!def.isChampion;
        this.league = def.league;
        this.title = def.title;
        // Campeões com `phases` definido ganham IA exclusiva de chefe (mudança
        // de personalidade/habilidades/emoção ao cruzar limiares de HP) — opt-in,
        // rivais comuns simplesmente não têm esse campo e não são afetados.
        this.phases = def.phases || null;
        // Rivalidades (item 4 da mega-diretiva Arena+Estilos): `rivalOf`
        // aponta pro id de outro rival da ladder — se o jogador já o
        // derrotou (player.rivalsDefeated), a tela de batalha reconhece
        // isso com uma linha própria (ver ui.js beginBattleWith). `intro`
        // é uma fala curta e opcional pra lutadores importantes (item 24),
        // mostrada no mesmo local. Nenhum dos dois afeta mecânica de
        // combate — é só identidade/personalidade, como o pedido explícito
        // "pequenas interações são suficientes, não um sistema gigantesco
        // de diálogo".
        this.rivalOf = def.rivalOf || null;
        this.introLine = def.intro || null;

        this.distributeStats(def.focus);

        // Personalidade e estilo de luta curados por rival (não aleatórios,
        // preservando a identidade narrativa de cada adversário da ladder);
        // arquétipos raros ficam reservados ao Duelo Rápido.
        // `def.forcedRareArchetypeId` (Arena dos Campeões — ver
        // CHAMPIONS_ARENA_STAGES mais abaixo) é a ÚNICA forma de um Rival
        // nomeado usar um arquétipo raro (ex: lutador_desarmado); sem essa
        // flag explícita, `allowRareArchetype: false` continua bloqueando
        // exatamente como antes, preservando a identidade narrativa
        // curada de todo Rival comum da Ladder.
        window.AICombat.assignProfile(this, {
            personalityId: def.personalityId, styleId: def.styleId,
            level: this.level, allowRareArchetype: false,
            forcedRareArchetypeId: def.forcedRareArchetypeId || null
        });

        // Raça (ver races.js) — precisa ser resolvida ANTES de `visuals`
        // logo abaixo (bug de auditoria corrigido nesta iteração: a raça só
        // era atribuída a `this.race` bem depois de `this.visuals` já ter
        // sido montado, então randomFighterVisuals nunca sabia a raça a
        // tempo de sortear um tom de pele coerente, ver races.js
        // RaceSystem.pickSkinTone). `def.race` deixa um rival específico ser
        // curado, igual aos outros campos de identidade (personalityId/
        // styleId/visuals); sem isso, sorteia como qualquer outro inimigo.
        const raceIds = window.RACES ? Object.keys(window.RACES) : ['humano'];
        this.race = def.race || raceIds[Utils.randomInt(0, raceIds.length - 1)];

        // Aparência: cada rival nomeado tem gênero/arquétipo/cicatriz
        // AUTORAIS (def.visuals, ver RivalDatabase abaixo) — reforça que é
        // "aquele adversário específico", não um número genérico — e o
        // resto (cores, cabelo, rosto) é preenchido aleatoriamente por cima,
        // já coerente com `this.race` pra pele.
        this.visuals = Object.assign(randomFighterVisuals(this.aiStyle ? this.aiStyle.id : null, this.race), def.visuals || {});

        // Aura sutil por liga nos Campeões (reaproveita o mesmo hook de
        // graphics.js _drawLineageAura já usado pela Linhagem do jogador e
        // pelo Elite do Duelo Rápido) — só um glow calmo, sem partícula
        // (nunca setamos `visuals.particle`), pra nunca ser confundido com
        // o brilho errático do Elite nem com as motes ascendentes da
        // Linhagem Luz. Antes um Campeão da Ladder (o clímax de cada liga,
        // já com recompensas/loot/IA de fases exclusivas) não tinha NENHUMA
        // distinção visual além do próprio equipamento.
        if (this.isChampion) {
            // Item 10 da auditoria (ligas contínuas): bug de auditoria
            // encontrado — antes só existiam 3 ligas (bronze/silver/gold),
            // então qualquer liga NOVA caía no fallback `leagueAuraColors.gold`
            // (âmbar), fazendo o Campeão Orc e o Campeão Élfico brilharem
            // com a MESMA cor do Campeão de Ouro, apesar de serem ligas
            // visualmente/tematicamente distintas. `orc`/`elfica` usam a
            // MESMA cor de `accent` já estabelecida pra cada raça (ver
            // races.js) — a identidade visual da liga combina com a da
            // raça que a domina, em vez de uma cor arbitrária nova.
            // `anao` estava faltando aqui (bug de auditoria encontrado nesta
            // iteração) — Thorgrim, Rei da Forja, caía no fallback
            // `leagueAuraColors.gold` (âmbar) igual Aurelion, apesar de a
            // Liga Anã já existir há um bom tempo com identidade própria.
            // Mesmo padrão das outras: usa o `accent` já cadastrado pra raça
            // Anão em races.js (cobre/ferrugem da forja).
            const leagueAuraColors = {
                bronze: 'rgba(205,127,50,0.35)', silver: 'rgba(200,208,216,0.4)', gold: 'rgba(240,185,35,0.4)',
                orc: 'rgba(58,90,26,0.4)', elfica: 'rgba(74,138,58,0.4)', anao: 'rgba(138,58,26,0.4)'
            };
            this.visuals.hasAura = true;
            this.visuals.auraColor = leagueAuraColors[this.league] || leagueAuraColors.gold;
        }

        this.equipGear(def.gearRarity);

        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;

        this.expValue = Math.floor(30 * Math.pow(1.25, this.level) * (this.isChampion ? 2 : 1));
        this.goldValue = Math.floor(Utils.randomInt(15, 35) * (this.level * 0.6 + 1) * (this.isChampion ? 1.8 : 1));
    }

    // Distribui pontos de atributo conforme os pesos de foco do rival
    // (ex: um "brutamontes" pesa mais em força/defesa que em agilidade)
    distributeStats(focus) {
        const totalPoints = 30 + this.level * 6;
        let assigned = 0;
        const keys = Object.keys(focus);
        keys.forEach((stat, idx) => {
            if (idx === keys.length - 1) {
                this.baseStats[stat] += (totalPoints - assigned);
            } else {
                const amount = Math.round(totalPoints * focus[stat]);
                this.baseStats[stat] += amount;
                assigned += amount;
            }
        });
    }

    // Equipa arma (coerente com o estilo de luta atribuído) e armadura,
    // correspondentes à raridade da liga do rival
    //
    // Bug de auditoria: `equipArmor()` do Enemy comum foi migrado pra usar
    // `AICombat.pickArmor()` (filtra por slot CHEST e por região, ver
    // comentário lá em cima) precisamente pra imitar o que Rival.equipGear
    // já fazia — mas o próprio Rival nunca foi migrado junto, e continuava
    // sorteando de QUALQUER categoria de `ItemDatabase.armors` sem filtro
    // nenhum. Isso deixava dois problemas exclusivos dos Rivais nomeados da
    // Ladder (justamente os inimigos de maior destaque do jogo): 1) um item
    // de outro slot (ex: "Botas de Couro") podia ser equipado visualmente
    // no peitoral; 2) um Rival da Fortaleza Orc podia nascer de Manto
    // Élfico, quebrando a identidade regional. `pickArmor()` já resolve os
    // dois de uma vez, então basta reusar a mesma função.
    // Mega Atualização item 13: `rarity` continua CURADA por liga (não
    // sorteada — ver RivalDatabase), mas agora passa pelo mesmo teto/
    // downgrade de createEquipmentWithRarityCap (ver items.js) — nunca
    // entrega ao próprio Rival uma peça que ele mesmo não atenda os
    // requisitos, mesmo quando a liga pede uma raridade curada alta.
    equipGear(rarity) {
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        // "Lutador de Punho Nu" (ver ai.js assignProfile/
        // opts.forcedRareArchetypeId, usado pela Arena dos Campeões) já
        // recusa arma ali, deixando equipment[MAIN_HAND] null de propósito
        // — bug de auditoria encontrado nesta iteração: equipGear() sempre
        // reequipava uma arma por cima logo em seguida, desfazendo isso
        // silenciosamente (Enemy.equipStyleWeapon já tinha essa mesma
        // guarda, ver mais acima; Rival nunca precisou dela até agora,
        // porque rivais nomeados nunca podiam receber arquétipos raros
        // antes desta atualização).
        const isUnarmed = this.aiRareArchetype && this.aiRareArchetype.id === 'lutador_desarmado';
        if (!isUnarmed) {
            const weaponId = window.AICombat.pickWeaponFromStyle(this.aiStyle.id);
            // Bug de auditoria (sistema de duas armas, ver Entity.
            // equipStyleWeaponGeneric em player.js pelo mesmo bug e explicação
            // completa): a arma sempre era gravada em equipment[SLOTS.MAIN_HAND]
            // aqui, mesmo pra um Rival de estilo Arqueiro cuja arma sorteada
            // (arco/besta) já carrega slot:SLOTS.RANGED — hasDualWeapons() nunca
            // via essa arma como a principal. activeWeaponSlot ajustado junto
            // pra sempre acompanhar onde a arma realmente está.
            const weapon = ItemFactory.createEquipmentWithRarityCap(this, weaponId, 'weapons', rarity);
            this.equipment[weapon.slot] = weapon;
            this.activeWeaponSlot = weapon.slot;
            // Campeões carregam arma encantada com mais frequência que rivais
            // comuns — reforça que enfrentar um Campeão é diferente (ver
            // Enemy.maybeEnchantWeapon acima, compartilhado com o Duelo Rápido).
            Enemy.maybeEnchantWeapon(weapon, this.isChampion ? 35 : 18);
        }
        const armorId = window.AICombat.pickArmor();
        this.equipment[SLOTS.CHEST] = ItemFactory.createEquipmentWithRarityCap(this, armorId, 'armors', rarity);

        // Arma secundária (item 2 da auditoria de balanceamento) — mesma
        // regra do Duelo Rápido comum (ver Entity.maybeEquipSecondaryWeapon
        // em player.js): categoria oposta à principal, chance-gated. Rivais
        // Campeões têm chance bem maior de carregar uma reserva de verdade,
        // reforçando que enfrentar um Campeão é um combate mais completo.
        // Punho Nu nunca recebe arma secundária, pelo mesmo motivo de não
        // receber a principal.
        if (!isUnarmed && window.AICombat && Utils.chance(this.isChampion ? 55 : 30)) {
            const secondaryId = window.AICombat.pickSecondaryWeaponFromStyle(this.aiStyle.id);
            if (secondaryId) {
                const secondary = ItemFactory.createEquipmentWithRarityCap(this, secondaryId, 'weapons', rarity);
                if (secondary.slot !== this.activeWeaponSlot) this.equipment[secondary.slot] = secondary;
            }
        }

        // Escudo por preferência de ESTILO (gladiador/guardião), igual a
        // Enemy/Vampire — antes só Campeões ganhavam escudo, deixando
        // rivais comuns de estilo "escudeiro" (ex: Brenna, Ágil da Prata
        // com guardiao/gladiador) sem o escudo que sua própria IA já espera
        // (ver AI_FIGHTING_STYLES.preferShield em ai_data.js). Punho Nu
        // também nunca carrega escudo — mãos precisam ficar livres.
        const shieldId = !isUnarmed ? window.AICombat.pickShieldFromStyle(this.aiStyle.id) : null;
        if (!isUnarmed && (this.isChampion || shieldId)) {
            // Mesmo filtro regional do pickShieldFromStyle, aplicado aqui
            // também pro fallback forçado de Campeão (que ignora
            // preferShield) — sem isso um Campeão sem preferência de escudo
            // ainda podia herdar um Escudo Reforçado Orc estando no
            // Santuário Élfico.
            const shieldKeys = Object.keys(ItemDatabase.shields).filter(id => {
                const t = ItemDatabase.shields[id];
                return !t.region || t.region === cityId;
            });
            const finalShieldId = shieldId || shieldKeys[Utils.randomInt(0, shieldKeys.length - 1)];
            this.equipment[SLOTS.OFF_HAND] = ItemFactory.createEquipmentWithRarityCap(this, finalShieldId, 'shields', rarity);
        }

        // Auditoria de Combate e Escalonamento — ver comentário completo em
        // Entity.maybeEquipTrinkets (player.js): nenhum Rival da Ladder
        // jamais equipava amuleto/anel. `rarity` aqui já é um objeto RARITY
        // curado (não um percentual 0-100, ver `def.gearRarity`), então usa
        // createEquipmentWithRarityCap diretamente em vez do helper
        // genérico (que espera um strengthScore) — mesma técnica já usada
        // pra arma/escudo acima. Campeões têm chance bem maior, reforçando
        // que enfrentar um deles é um combate mais completo.
        const trinketChance = this.isChampion ? 65 : 30;
        if (Utils.chance(trinketChance)) {
            const amuletId = window.AICombat.pickTrinket(SLOTS.AMULET);
            if (amuletId) this.equipment[SLOTS.AMULET] = ItemFactory.createEquipmentWithRarityCap(this, amuletId, 'trinkets', rarity);
        }
        if (Utils.chance(trinketChance)) {
            const ringId = window.AICombat.pickTrinket(SLOTS.RING);
            if (ringId) this.equipment[SLOTS.RING] = ItemFactory.createEquipmentWithRarityCap(this, ringId, 'trinkets', rarity);
        }

        // Auditoria de Combate e Escalonamento (Iteração 2) — resto do
        // conjunto de armadura (HEAD/HANDS/LEGS/FEET, ver
        // Entity.maybeEquipFullArmorSet em player.js), mesma técnica
        // createEquipmentWithRarityCap do amuleto/anel acima (rarity já é
        // objeto RARITY curado, não um strengthScore).
        [SLOTS.HEAD, SLOTS.HANDS, SLOTS.LEGS, SLOTS.FEET].forEach(slot => {
            if (!Utils.chance(trinketChance)) return;
            const pieceId = window.AICombat.pickArmor(slot);
            if (pieceId) this.equipment[slot] = ItemFactory.createEquipmentWithRarityCap(this, pieceId, 'armors', rarity);
        });

        // Runas (ver Entity.maybeApplyRunes) — mesmo gate regional do
        // Santuário Élfico das outras chamadas acima.
        this.maybeApplyRunes(trinketChance);
        // Comida/buff (ver Entity.maybeApplyFoodBuff) — Rivals da Ladder
        // também podem carregar provisão, mesma chance dos trinkets acima.
        this.maybeApplyFoodBuff(trinketChance);
    }

    // Campeões sempre deixam loot de alta raridade; rivais comuns têm chance normal
    //
    // Bug de auditoria: pra Campeões, `minRarityId = RARITY.EPIC.id` (4)
    // filtrado contra um pool de generateShopInventory cujo teto real nunca
    // passava de RARE (3, ver items.js) — `goodItems` ficava SEMPRE vazio,
    // e o fallback `pool[0]` (um item comum/incomum qualquer) rodava toda
    // vez, contrariando o próprio comentário "sempre deixam loot de alta
    // raridade". Campeões agora usam generateGuaranteedItem (ver items.js)
    // pra criar o item já em EPIC de verdade, sem depender de sorte num
    // pool que nunca alcançava esse tier.
    generateLoot(playerLuk) {
        const dropChance = this.isChampion ? 100 : 40 + playerLuk;
        if (!Utils.chance(dropChance)) return null;

        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        if (this.isChampion) {
            return window.ItemFactory.generateGuaranteedItem(cityId, RARITY.EPIC);
        }
        const pool = window.ItemFactory.generateShopInventory(this.level + 2, cityId);
        const goodItems = pool.filter(i => i.rarity.id >= RARITY.UNCOMMON.id);
        return goodItems.length > 0 ? goodItems[0] : pool[0];
    }
}

// Banco de Rivais: 3 ligas progressivas, cada uma com 3 desafiantes + 1 campeão.
// personalityId/styleId vêm do banco de dados da IA (ai_data.js) — cada rival
// tem uma identidade comportamental própria, não um "nível de dificuldade".
// Campeões (isChampion) recebem `phases`: limiares de HP em que a IA do chefe
// muda de personalidade, ganha novas habilidades e reage emocionalmente —
// uma luta contra um campeão deve parecer 2 ou 3 lutas diferentes em sequência.
const RivalDatabase = {
    leagues: [
        {
            id: 'bronze', name: 'Liga de Bronze',
            rivals: [
                { id: 'gorlak', name: 'Gorlak, o Novato', title: 'Novato', level: 2, focus: { str: 0.5, def: 0.3, agi: 0.2 },
                    personalityId: 'impulsivo', styleId: 'espadachim', gearRarity: RARITY.COMMON,
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 0 } },
                { id: 'vesna', name: 'Vesna, a Ágil', title: 'Ágil', level: 3, focus: { agi: 0.5, acc: 0.3, luk: 0.2 },
                    personalityId: 'duelista', styleId: 'assassino', gearRarity: RARITY.COMMON,
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 2 } },
                { id: 'thom', name: 'Thom Punho-de-Ferro', title: 'Punho-de-Ferro', level: 4, focus: { str: 0.6, def: 0.4 },
                    personalityId: 'berserker', styleId: 'brutamontes', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 4 } },
                // Item 3 da mega-diretiva (~12 lutadores por liga, evitando
                // clones de stats): Petra preenche o arquétipo "defensor"
                // (ainda ausente na Bronze) e Ren o "arqueiro" — nenhum dos
                // dois reaproveita personalidade/estilo já usados nesta liga.
                { id: 'petra', name: 'Petra, Muralha Jovem', title: 'Muralha Jovem', level: 3, focus: { def: 0.5, str: 0.3, cha: 0.2 },
                    personalityId: 'sobrevivente', styleId: 'guardiao', gearRarity: RARITY.COMMON,
                    visuals: { gender: 'Feminino', archetype: 'cavaleiro', scarStyle: 1 } },
                { id: 'ren', name: 'Ren, Flecha Errante', title: 'Flecha Errante', level: 4, focus: { agi: 0.4, acc: 0.4, luk: 0.2 },
                    personalityId: 'mercenario', styleId: 'arqueiro', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 0 } },
                // Iteração 14 (item 3 da mega-diretiva, rumo a ~12
                // lutadores/liga): Dain preenche "lanceiro" e Elin "mago" —
                // os dois únicos estilos ainda ausentes na Bronze depois da
                // Iteração 2.
                { id: 'dain', name: 'Dain, Guarda de Fronteira', title: 'Guarda de Fronteira', level: 3, focus: { str: 0.35, acc: 0.35, def: 0.3 },
                    personalityId: 'tatico', styleId: 'lanceiro', gearRarity: RARITY.COMMON,
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 1 } },
                { id: 'elin', name: 'Elin, Chama Novata', title: 'Chama Novata', level: 4, focus: { int: 0.45, acc: 0.3, def: 0.25 },
                    personalityId: 'covarde', styleId: 'mago', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Feminino', archetype: 'mercenario', scarStyle: 0 } },
                // Iteração 16 (item 3 da mega-diretiva, rumo a ~12
                // lutadores/liga): os 8 estilos base já estão todos
                // cobertos na Bronze desde a Iteração 14 — a partir daqui,
                // identidade vem de REAPROVEITAR um estilo com
                // personalidade/foco/visual genuinamente diferentes
                // (nunca um clone reescalado). Fenrik reaproveita
                // "assassino" (já usado por Vesna/duelista) com
                // "caçador"/foco em sorte — persegue por instinto, não por
                // técnica de duelo. Morna reaproveita "brutamontes" (já
                // usado por Thom/berserker) com "sádico" — tortura
                // devagar, não explode em fúria.
                { id: 'fenrik', name: 'Fenrik, o Rastreador', title: 'o Rastreador', level: 3, focus: { agi: 0.4, luk: 0.35, acc: 0.25 },
                    personalityId: 'cacador', styleId: 'assassino', gearRarity: RARITY.COMMON,
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 2 } },
                { id: 'morna', name: 'Morna, a Cruel', title: 'a Cruel', level: 4, focus: { str: 0.5, def: 0.3, luk: 0.2 },
                    personalityId: 'sadico', styleId: 'brutamontes', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Feminino', archetype: 'barbaro', scarStyle: 3 } },
                // Iteração 21 (item 3 da mega-diretiva, fechando ~12
                // lutadores/liga): os 8 estilos base já estão todos
                // cobertos há duas iterações — Ilsa reaproveita "gladiador"
                // (só o Campeão Karg usava, protetor) com "calculista",
                // versátil e metódica em vez de protetora. Bram reaproveita
                // "arqueiro" (Ren/mercenário) com "fanático" — atira por fé
                // cega, não por dinheiro.
                { id: 'ilsa', name: 'Ilsa, Cálculo de Arena', title: 'Cálculo de Arena', level: 4, focus: { str: 0.28, def: 0.28, agi: 0.24, acc: 0.2 },
                    personalityId: 'calculista', styleId: 'gladiador', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Feminino', archetype: 'campeao', scarStyle: 0 } },
                { id: 'bram', name: 'Bram, Flecha da Fé', title: 'Flecha da Fé', level: 5, focus: { agi: 0.4, acc: 0.4, luk: 0.2 },
                    personalityId: 'fanatico', styleId: 'arqueiro', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 1 } },
                { id: 'bronze_champion', name: 'Karg, Campeão de Bronze', title: 'Campeão de Bronze', level: 5, focus: { str: 0.3, def: 0.3, agi: 0.2, acc: 0.2 },
                    personalityId: 'protetor', styleId: 'gladiador', gearRarity: RARITY.UNCOMMON, isChampion: true,
                    intro: 'Chegou longe pra um novato. Vamos ver se sua sorte aguenta o Campeão de Bronze.',
                    visuals: { gender: 'Masculino', archetype: 'campeao', scarStyle: 1 },
                    phases: [
                        { hpPercent: 0.6, personalityId: 'executor', unlockSkill: 'shield_bash', emotion: 'determinado',
                            message: 'Karg abandona a cautela e avança com fúria calculada!' },
                        { hpPercent: 0.25, personalityId: 'berserker', unlockSkill: 'fury', emotion: 'desesperado', healPercent: 0.1,
                            message: 'Ferido e encurralado, Karg entra em fúria desesperada!' }
                    ] }
            ]
        },
        {
            id: 'silver', name: 'Liga de Prata',
            rivals: [
                { id: 'ysolda', name: 'Ysolda, Lâmina Veloz', title: 'Lâmina Veloz', level: 6, focus: { agi: 0.4, luk: 0.3, acc: 0.3 },
                    personalityId: 'cacador', styleId: 'assassino', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 0 } },
                { id: 'bruntok', name: 'Bruntok, o Touro', title: 'o Touro', level: 7, focus: { str: 0.5, def: 0.35, cha: 0.15 },
                    personalityId: 'fanatico', styleId: 'brutamontes', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 1 } },
                { id: 'nyx', name: 'Nyx, a Sombria', title: 'a Sombria', level: 8, focus: { int: 0.35, acc: 0.35, luk: 0.3 },
                    personalityId: 'covarde', styleId: 'mago', gearRarity: RARITY.RARE,
                    visuals: { gender: 'Feminino', archetype: 'mercenario', scarStyle: 3 } },
                // Kellan preenche o arquétipo "controle de distância/reach"
                // (lanceiro, ainda ausente na Prata); rivalOf aponta pra
                // Skarza (Liga Orc, mais à frente na sequência) — o
                // reconhecimento acontece quando o jogador chega em Skarza
                // já tendo derrotado Kellan (ver ui.js beginBattleWith).
                { id: 'kellan', name: 'Kellan, Lança do Norte', title: 'Lança do Norte', level: 7, focus: { str: 0.4, def: 0.35, acc: 0.25 },
                    personalityId: 'tatico', styleId: 'lanceiro', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Masculino', archetype: 'cavaleiro', scarStyle: 2 } },
                { id: 'rurik', name: 'Rurik, o Inflexível', title: 'o Inflexível', level: 9, focus: { def: 0.5, str: 0.35, cha: 0.15 },
                    personalityId: 'sobrevivente', styleId: 'guardiao', gearRarity: RARITY.RARE,
                    visuals: { gender: 'Masculino', archetype: 'veterano', scarStyle: 3 } },
                // Iteração 14 (item 3 da mega-diretiva): Cassian preenche
                // "espadachim" e Vesper "arqueiro" — os dois únicos estilos
                // ainda ausentes na Prata. Vesper reconhece Ren (Liga de
                // Bronze, já derrotado a esta altura) — a mesma arma, duas
                // filosofias opostas: Ren caça por instinto, Vesper por
                // cálculo frio.
                { id: 'cassian', name: 'Cassian, Lâmina Cortesã', title: 'Lâmina Cortesã', level: 7, focus: { agi: 0.4, acc: 0.35, str: 0.25 },
                    personalityId: 'duelista', styleId: 'espadachim', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 0 } },
                { id: 'vesper', name: 'Vesper, Olhar Frio', title: 'Olhar Frio', level: 8, focus: { agi: 0.35, acc: 0.45, luk: 0.2 },
                    personalityId: 'sadico', styleId: 'arqueiro', gearRarity: RARITY.RARE, rivalOf: 'ren',
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 2 } },
                // Iteração 16 (item 3 da mega-diretiva): Petro reaproveita
                // "mago" (já usado por Nyx/covarde) com "impulsivo" — arrisca
                // feitiços grandes demais cedo demais, o oposto do
                // conservadorismo medroso de Nyx. Wren reaproveita
                // "guardião" (já usado por Rurik/sobrevivente e o próprio
                // Campeão Draven/veterano) com "calculista" — escuda com
                // precisão cirúrgica, nunca por instinto de sobrevivência.
                { id: 'petro', name: 'Petro, Chama Impulsiva', title: 'Chama Impulsiva', level: 6, focus: { int: 0.4, str: 0.3, acc: 0.3 },
                    personalityId: 'impulsivo', styleId: 'mago', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 1 } },
                { id: 'wren', name: 'Wren, o Metódico', title: 'o Metódico', level: 9, focus: { def: 0.45, acc: 0.3, str: 0.25 },
                    personalityId: 'calculista', styleId: 'guardiao', gearRarity: RARITY.RARE,
                    visuals: { gender: 'Masculino', archetype: 'cavaleiro', scarStyle: 0 } },
                // Iteração 21 (item 3 da mega-diretiva): Alaric reaproveita
                // "mago" (Nyx/covarde, Petro/impulsivo) com "honrado" — cura
                // e apoia por devoção, nunca por medo nem imprudência.
                // Renata reaproveita "assassino" (Ysolda/caçadora) com
                // "executor" — mata com eficiência fria, sem o instinto de
                // caça de Ysolda.
                { id: 'alaric', name: 'Alaric, Cântico Solene', title: 'Cântico Solene', level: 7, focus: { int: 0.4, def: 0.35, acc: 0.25 },
                    personalityId: 'honrado', styleId: 'mago', gearRarity: RARITY.UNCOMMON,
                    visuals: { gender: 'Masculino', archetype: 'veterano', scarStyle: 0 } },
                { id: 'renata', name: 'Renata, Fio da Navalha', title: 'Fio da Navalha', level: 8, focus: { agi: 0.4, luk: 0.3, acc: 0.3 },
                    personalityId: 'executor', styleId: 'assassino', gearRarity: RARITY.RARE,
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 1 } },
                { id: 'silver_champion', name: 'Draven, Campeão de Prata', title: 'Campeão de Prata', level: 10, focus: { str: 0.3, def: 0.3, agi: 0.2, acc: 0.2 },
                    personalityId: 'veterano', styleId: 'guardiao', gearRarity: RARITY.RARE, isChampion: true,
                    intro: 'Cada oponente me ensina algo. Hoje, você é a lição.',
                    visuals: { gender: 'Masculino', archetype: 'cavaleiro', scarStyle: 1 },
                    phases: [
                        { hpPercent: 0.65, personalityId: 'calculista', unlockSkill: 'heavy_strike', emotion: 'determinado',
                            message: 'Draven reavalia sua estratégia e adapta seu estilo de luta!' },
                        { hpPercent: 0.3, personalityId: 'executor', unlockSkill: 'vampiric_strike', emotion: 'enfurecido', healPercent: 0.12,
                            message: 'Com a vitória escapando, Draven luta com brutalidade fria!' }
                    ] }
            ]
        },
        {
            id: 'gold', name: 'Liga de Ouro',
            rivals: [
                { id: 'freya', name: 'Freya Tempestade', title: 'Tempestade', level: 11, focus: { agi: 0.45, acc: 0.35, luk: 0.2 },
                    personalityId: 'cacador', styleId: 'arqueiro', gearRarity: RARITY.RARE,
                    visuals: { gender: 'Feminino', archetype: 'guerreira', scarStyle: 0 } },
                // rivalOf: Moloch reconhece Thom (Liga de Bronze, já
                // derrotado a esta altura da ladder sequencial) — dois
                // brutamontes, mesma linhagem de fúria física.
                { id: 'moloch', name: 'Moloch, o Destruidor', title: 'o Destruidor', level: 12, focus: { str: 0.65, def: 0.35 },
                    personalityId: 'fanatico', styleId: 'brutamontes', gearRarity: RARITY.EPIC, rivalOf: 'thom',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 3 } },
                { id: 'sable', name: 'Sable, a Serpente', title: 'a Serpente', level: 13, focus: { luk: 0.4, agi: 0.35, acc: 0.25 },
                    personalityId: 'sadico', styleId: 'assassino', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 2 } },
                // Corvin preenche "controle de distância" com um estilo mais
                // furtivo que Kellan (calculista, não tático); Wynne é o
                // arquétipo "usuário de magia auxiliar" (mago/tático,
                // focado em defesa própria em vez de dano puro).
                { id: 'corvin', name: 'Corvin, o Fantasma', title: 'o Fantasma', level: 12, focus: { str: 0.35, agi: 0.35, acc: 0.3 },
                    personalityId: 'calculista', styleId: 'lanceiro', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Masculino', archetype: 'assassino', scarStyle: 2 } },
                { id: 'wynne', name: 'Wynne, Cântico de Ferro', title: 'Cântico de Ferro', level: 14, focus: { int: 0.4, acc: 0.3, def: 0.3 },
                    personalityId: 'tatico', styleId: 'mago', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Feminino', archetype: 'mercenario', scarStyle: 1 } },
                // Iteração 14 (item 3 da mega-diretiva): Perrin preenche
                // "guardião" e Thessaly "espadachim" — os dois únicos
                // estilos ainda ausentes na Ouro.
                { id: 'perrin', name: 'Perrin, Bastião Dourado', title: 'Bastião Dourado', level: 12, focus: { def: 0.45, str: 0.3, cha: 0.25 },
                    personalityId: 'protetor', styleId: 'guardiao', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Masculino', archetype: 'cavaleiro', scarStyle: 1 } },
                { id: 'thessaly', name: 'Thessaly, Espada Cortesã', title: 'Espada Cortesã', level: 13, focus: { agi: 0.35, acc: 0.35, str: 0.3 },
                    personalityId: 'veterano', styleId: 'espadachim', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Feminino', archetype: 'guerreira', scarStyle: 2 } },
                // Iteração 16 (item 3 da mega-diretiva): Ilyra reaproveita
                // "assassino" (já usado por Sable/sádico) com "executor" —
                // mata rápido e sem prazer nenhum, o oposto do gosto de
                // Sable por prolongar. Doran reaproveita "arqueiro" (já
                // usado por Freya/caçador) com "mercenário" — atira por
                // contrato, nunca por instinto de caça.
                { id: 'ilyra', name: 'Ilyra, a Precisa', title: 'a Precisa', level: 12, focus: { agi: 0.4, luk: 0.3, acc: 0.3 },
                    personalityId: 'executor', styleId: 'assassino', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 1 } },
                { id: 'doran', name: 'Doran, Flecha à Venda', title: 'Flecha à Venda', level: 13, focus: { agi: 0.4, acc: 0.4, luk: 0.2 },
                    personalityId: 'mercenario', styleId: 'arqueiro', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 2 } },
                // Iteração 21 (item 3 da mega-diretiva): Bors reaproveita
                // "brutamontes" (Moloch/fanático) com "veterano" — força
                // bruta temperada por décadas de arena, não fervor cego.
                // Selene reaproveita "lanceiro" (Corvin/calculista) com
                // "gladiador_experiente" — domina a lança pela experiência
                // de arena, não pelo cálculo frio de Corvin.
                { id: 'bors', name: 'Bors, Cicatriz de Ferro', title: 'Cicatriz de Ferro', level: 11, focus: { str: 0.55, def: 0.35, luk: 0.1 },
                    personalityId: 'veterano', styleId: 'brutamontes', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Masculino', archetype: 'veterano', scarStyle: 4 } },
                { id: 'selene', name: 'Selene, Lança da Arena', title: 'Lança da Arena', level: 14, focus: { str: 0.35, agi: 0.35, acc: 0.3 },
                    personalityId: 'gladiador_experiente', styleId: 'lanceiro', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Feminino', archetype: 'guerreira', scarStyle: 2 } },
                { id: 'gold_champion', name: 'Aurelion, o Imortal', title: 'o Imortal', level: 15, focus: { str: 0.28, def: 0.28, agi: 0.22, acc: 0.22 },
                    personalityId: 'honrado', styleId: 'gladiador', gearRarity: RARITY.LEGENDARY, isChampion: true,
                    intro: 'Séculos de arena, e ainda procuro alguém digno. Talvez seja você.',
                    visuals: { gender: 'Masculino', archetype: 'campeao', scarStyle: 1 },
                    phases: [
                        { hpPercent: 0.7, personalityId: 'gladiador_experiente', unlockSkill: 'shield_bash', emotion: 'confiante',
                            message: 'Aurelion, o Imortal, desperta de verdade!' },
                        { hpPercent: 0.4, personalityId: 'executor', unlockSkill: 'heavy_strike', emotion: 'determinado',
                            message: 'Séculos de combate falam através de cada golpe de Aurelion!' },
                        { hpPercent: 0.15, personalityId: 'berserker', unlockSkill: 'fury', emotion: 'desesperado', healPercent: 0.15,
                            message: 'Aurelion recusa a mortalidade — a fúria imortal desperta!' }
                    ] }
            ]
        },
        // --- Item 10 da auditoria de balanceamento: ligas contínuas ---
        // Bug de auditoria encontrado: a Ladder inteira acabava em Aurelion
        // (nível 15) — depois de derrotá-lo, a tela de Ladder simplesmente
        // mostrava tudo como "Derrotado" e não havia absolutamente NADA
        // mais pra fazer ali, contrariando o pedido explícito de progressão
        // contínua ("a próxima liga começa onde a anterior terminou").
        // O motor de desbloqueio sequencial (ver ui.js _getAllRivals/
        // openLadder: `isUnlocked = globalIdx === 0 || rivalsDefeated
        // .includes(anterior)`) já suporta QUALQUER número de ligas sem
        // nenhuma mudança de código — só faltava o conteúdo. As duas novas
        // ligas usam as raças/cidades-hub regionais já existentes (Orc/
        // Elfo, ver races.js e citydatabase.js) como identidade temática,
        // continuando a progressão de nível exatamente de onde a Liga de
        // Ouro parou (15), sem nenhum reinício de dificuldade.
        {
            id: 'orc', name: 'Liga Orc',
            rivals: [
                { id: 'grukthar', name: 'Grukthar, Punho de Gorkhal', title: 'Punho de Gorkhal', level: 16, focus: { str: 0.6, def: 0.4 },
                    personalityId: 'berserker', styleId: 'brutamontes', gearRarity: RARITY.EPIC, race: 'orc',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 4 } },
                // rivalOf: Skarza reconhece Kellan (Liga de Prata, já
                // derrotado a esta altura) — a mesma arma (lança), duas
                // filosofias diferentes de usá-la.
                { id: 'skarza', name: 'Skarza, Lança Vulcânica', title: 'Lança Vulcânica', level: 17, focus: { str: 0.4, agi: 0.35, acc: 0.25 },
                    personalityId: 'cacador', styleId: 'lanceiro', gearRarity: RARITY.EPIC, race: 'orc', rivalOf: 'kellan',
                    visuals: { gender: 'Feminino', archetype: 'barbaro', scarStyle: 2 } },
                { id: 'bruk', name: 'Brûk, o Inabalável', title: 'o Inabalável', level: 18, focus: { def: 0.5, str: 0.35, cha: 0.15 },
                    personalityId: 'protetor', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, race: 'orc',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 3 } },
                // Vrag preenche "assassino" (ainda ausente na Orc) e Uzgar o
                // "usuário de magia auxiliar" numa chave orc/xamânica —
                // nenhuma liga deve virar só variações de brutamontes.
                { id: 'vrag', name: 'Vrag, Presa Negra', title: 'Presa Negra', level: 17, focus: { agi: 0.4, luk: 0.35, acc: 0.25 },
                    personalityId: 'sadico', styleId: 'assassino', gearRarity: RARITY.EPIC, race: 'orc',
                    visuals: { gender: 'Masculino', archetype: 'assassino', scarStyle: 4 } },
                { id: 'uzgar', name: 'Uzgar, Voz dos Tambores', title: 'Voz dos Tambores', level: 19, focus: { int: 0.4, def: 0.3, str: 0.3 },
                    personalityId: 'executor', styleId: 'mago', gearRarity: RARITY.LEGENDARY, race: 'orc',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 3 } },
                // Iteração 14 (item 3 da mega-diretiva): Krag preenche
                // "arqueiro" e Thokka "espadachim" — os dois únicos estilos
                // ainda ausentes na Orc, quebrando de propósito o estereótipo
                // "orc = corpo a corpo pesado" que a própria liga já tem de
                // sobra (Grukthar/Gorkhal). Krag reconhece Freya (Liga de
                // Ouro, já derrotada) — duelo de arqueiros entre raças.
                // Thokka é uma orc que despreza a brutalidade dos seus pares
                // e só respeita duelo de lâmina — quebra de identidade
                // deliberada, não um clone com pele orc.
                { id: 'krag', name: 'Krag, Flecha do Trovão', title: 'Flecha do Trovão', level: 17, focus: { str: 0.3, agi: 0.35, acc: 0.35 },
                    personalityId: 'duelista', styleId: 'arqueiro', gearRarity: RARITY.EPIC, race: 'orc', rivalOf: 'freya',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 2 } },
                { id: 'thokka', name: 'Thokka, Lâmina de Honra', title: 'Lâmina de Honra', level: 18, focus: { str: 0.35, agi: 0.3, acc: 0.35 },
                    personalityId: 'honrado', styleId: 'espadachim', gearRarity: RARITY.EPIC, race: 'orc',
                    visuals: { gender: 'Feminino', archetype: 'guerreira', scarStyle: 3 } },
                // Iteração 16 (item 3 da mega-diretiva): Ghazuk reaproveita
                // "guardião" (já usado por Brûk/protetor) com "veterano" —
                // escuda por experiência de mil arenas, não por instinto
                // protetor. Nazgra reaproveita "mago" (já usado por Uzgar/
                // executor) com "tático" — xamã que planeja com antecedência,
                // o oposto da execução implacável e imediata de Uzgar.
                { id: 'ghazuk', name: 'Ghazuk, Veterano de Mil Arenas', title: 'Veterano de Mil Arenas', level: 17, focus: { def: 0.45, str: 0.4, cha: 0.15 },
                    personalityId: 'veterano', styleId: 'guardiao', gearRarity: RARITY.EPIC, race: 'orc',
                    visuals: { gender: 'Masculino', archetype: 'veterano', scarStyle: 4 } },
                { id: 'nazgra', name: 'Nazgra, Olho de Corvo', title: 'Olho de Corvo', level: 19, focus: { int: 0.4, def: 0.3, acc: 0.3 },
                    personalityId: 'tatico', styleId: 'mago', gearRarity: RARITY.LEGENDARY, race: 'orc',
                    visuals: { gender: 'Feminino', archetype: 'barbaro', scarStyle: 2 } },
                // Iteração 21 (item 3 da mega-diretiva): Drog reaproveita
                // "brutamontes" (Grukthar/berserker, Gorkhal campeão/
                // fanático) com "calculista" — um orc raro que PLANEJA a
                // violência em vez de só desencadeá-la, quebra de
                // estereótipo deliberada. Vrenna reaproveita "guardião"
                // (Brûk/protetor, Ghazuk/veterano) com "sádico" — escuda
                // devagar de propósito, saboreando o desgaste do inimigo.
                { id: 'drog', name: 'Drog, o Estrategista', title: 'o Estrategista', level: 17, focus: { str: 0.4, def: 0.35, int: 0.25 },
                    personalityId: 'calculista', styleId: 'brutamontes', gearRarity: RARITY.EPIC, race: 'orc',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 1 } },
                { id: 'vrenna', name: 'Vrenna, Escudo Sangrento', title: 'Escudo Sangrento', level: 18, focus: { def: 0.5, str: 0.3, luk: 0.2 },
                    personalityId: 'sadico', styleId: 'guardiao', gearRarity: RARITY.EPIC, race: 'orc',
                    visuals: { gender: 'Feminino', archetype: 'cavaleiro', scarStyle: 3 } },
                { id: 'orc_champion', name: 'Gorkhal, Senhor da Guerra', title: 'Senhor da Guerra', level: 20, focus: { str: 0.35, def: 0.3, agi: 0.2, acc: 0.15 },
                    personalityId: 'fanatico', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, isChampion: true, race: 'orc',
                    intro: 'Você chegou longe demais pelas terras de Gorkhal.',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 4 },
                    phases: [
                        { hpPercent: 0.65, personalityId: 'executor', unlockSkill: 'fury', emotion: 'determinado',
                            message: 'Gorkhal ruge e a própria fornalha da Fortaleza parece tremer!' },
                        { hpPercent: 0.3, personalityId: 'berserker', unlockSkill: 'execution_blow', emotion: 'desesperado', healPercent: 0.12,
                            message: 'Sangrando, Gorkhal ataca com a fúria de um vulcão prestes a explodir!' }
                    ] }
            ]
        },
        {
            id: 'elfica', name: 'Liga Élfica',
            rivals: [
                { id: 'sylara', name: 'Sylara, Flecha Ancestral', title: 'Flecha Ancestral', level: 21, focus: { agi: 0.4, acc: 0.4, luk: 0.2 },
                    personalityId: 'cacador', styleId: 'arqueiro', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Feminino', archetype: 'guerreira', scarStyle: 0 } },
                // rivalOf: Thalindor reconhece Sable (Liga de Ouro, já
                // derrotada a esta altura) — duelo antigo entre assassinos.
                { id: 'thalindor', name: 'Thalindor, Lâmina da Clareira', title: 'Lâmina da Clareira', level: 22, focus: { agi: 0.45, luk: 0.3, acc: 0.25 },
                    personalityId: 'duelista', styleId: 'assassino', gearRarity: RARITY.LEGENDARY, race: 'elfo', rivalOf: 'sable',
                    visuals: { gender: 'Masculino', archetype: 'assassino', scarStyle: 0 } },
                { id: 'ilwenna', name: 'Ilwenna, Voz das Raízes', title: 'Voz das Raízes', level: 23, focus: { int: 0.45, acc: 0.3, luk: 0.25 },
                    personalityId: 'calculista', styleId: 'mago', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Feminino', archetype: 'mercenario', scarStyle: 0 } },
                // Aerindil preenche "duelista de espada" (mobilidade/AGI, o
                // arquétipo mais próximo de Dança das Lâminas nesta liga) e
                // Faelwen o "defensor" — a Élfica antes só tinha
                // arqueiro/assassino/mago, sem nenhum tanque.
                { id: 'aerindil', name: 'Aerindil, Lâmina do Vento', title: 'Lâmina do Vento', level: 22, focus: { agi: 0.45, acc: 0.35, str: 0.2 },
                    personalityId: 'duelista', styleId: 'espadachim', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Masculino', archetype: 'guerreira', scarStyle: 0 } },
                { id: 'faelwen', name: 'Faelwen, Escudo Ancestral', title: 'Escudo Ancestral', level: 24, focus: { def: 0.45, agi: 0.3, cha: 0.25 },
                    personalityId: 'protetor', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Feminino', archetype: 'cavaleiro', scarStyle: 0 } },
                // Iteração 14 (item 3 da mega-diretiva): Caelistra preenche
                // "lanceiro" e Gaurwen "brutamontes" — os dois únicos
                // estilos ainda ausentes na Élfica. Gaurwen quebra de
                // propósito o estereótipo "elfo = ágil e frágil": um elfo
                // que canaliza séculos de força da floresta antiga em
                // golpes brutos, nunca um clone de Grukthar/Borga com
                // orelhas pontudas — a fúria dele é ritual, não instintiva.
                { id: 'caelistra', name: 'Caelistra, Lança Solar', title: 'Lança Solar', level: 22, focus: { agi: 0.4, acc: 0.35, str: 0.25 },
                    personalityId: 'veterano', styleId: 'lanceiro', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Feminino', archetype: 'guerreira', scarStyle: 0 } },
                { id: 'gaurwen', name: 'Gaurwen, Fúria da Floresta Antiga', title: 'Fúria da Floresta Antiga', level: 23, focus: { str: 0.5, def: 0.3, agi: 0.2 },
                    personalityId: 'fanatico', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 1 } },
                // Iteração 16 (item 3 da mega-diretiva): Nimrieth reaproveita
                // "assassino" (já usado por Thalindor/duelista) com
                // "sobrevivente" — só mata quando não há outra saída, o
                // oposto do duelo ritualizado de Thalindor. Fendrel
                // reaproveita "espadachim" (já usado por Aerindil/duelista)
                // com "mercenário" — luta por contrato, quebrando ainda
                // mais o estereótipo nobre-élfico que Gaurwen já começou.
                { id: 'nimrieth', name: 'Nimrieth, Última Saída', title: 'Última Saída', level: 22, focus: { agi: 0.4, luk: 0.3, def: 0.3 },
                    personalityId: 'sobrevivente', styleId: 'assassino', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 2 } },
                { id: 'fendrel', name: 'Fendrel, Lâmina de Aluguel', title: 'Lâmina de Aluguel', level: 24, focus: { agi: 0.4, acc: 0.35, str: 0.25 },
                    personalityId: 'mercenario', styleId: 'espadachim', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 1 } },
                // Iteração 21 (item 3 da mega-diretiva): Thalorin
                // reaproveita "mago" (Ilwenna/calculista) com "honrado" —
                // canta pela devoção ao Santuário, não pelo cálculo frio de
                // Ilwenna. Miriel reaproveita "guardião" (Faelwen/protetor)
                // com "gladiador_experiente" — domina o escudo pela
                // experiência de incontáveis arenas, não pelo instinto
                // protetor de Faelwen.
                { id: 'thalorin', name: 'Thalorin, Voz da Lua', title: 'Voz da Lua', level: 21, focus: { int: 0.45, acc: 0.3, def: 0.25 },
                    personalityId: 'honrado', styleId: 'mago', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 0 } },
                { id: 'miriel', name: 'Miriel, Veterana do Santuário', title: 'Veterana do Santuário', level: 24, focus: { def: 0.45, agi: 0.3, cha: 0.25 },
                    personalityId: 'gladiador_experiente', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Feminino', archetype: 'cavaleiro', scarStyle: 1 } },
                { id: 'elfica_champion', name: 'Sylvaneth, Guardiã Ancestral', title: 'Guardiã Ancestral', level: 25, focus: { agi: 0.3, int: 0.25, acc: 0.25, luk: 0.2 },
                    personalityId: 'tatico', styleId: 'arqueiro', gearRarity: RARITY.LEGENDARY, isChampion: true, race: 'elfo',
                    intro: 'O Santuário não cai pra qualquer mercenário. Prove que é diferente.',
                    visuals: { gender: 'Feminino', archetype: 'guerreira', scarStyle: 0 },
                    phases: [
                        { hpPercent: 0.65, personalityId: 'cacador', unlockSkill: 'vampiric_strike', emotion: 'determinado',
                            message: 'Sylvaneth invoca a força de raízes centenárias para defender o Santuário!' },
                        { hpPercent: 0.3, personalityId: 'executor', unlockSkill: 'arcane_storm', emotion: 'desesperado', healPercent: 0.15,
                            message: 'A última guardiã do Santuário recusa cair — a floresta inteira parece lutar ao seu lado!' }
                    ] }
            ]
        },
        // Liga do Reino Anão — item explícito da mega-diretiva ("sua própria
        // liga de lutadores usando a geração procedural já existente,
        // builds variados: armadura pesada, armas gigantes, builds
        // defensivos, martelos, machados, escudos"). MESMA estrutura de
        // liga já usada por orc/elfica acima (nunca uma classe de rival
        // paralela), continuando a progressão de nível de onde a Liga
        // Élfica parou (25). `styleId` reaproveita 'guardiao' e
        // 'brutamontes' — os dois estilos pros quais RACE_STYLE_WEIGHTS.anao
        // (ver ai_data.js) já pesa MUITO mais que qualquer outro
        // (guardiao: 2.3, brutamontes: 1.3), então esta liga é a mesma
        // identidade defensiva/pesada que qualquer anão procedural comum já
        // tende a ter, só que curada nos rivais nomeados — nunca um estilo
        // de combate inventado do zero.
        {
            id: 'anao', name: 'Liga Anã',
            rivals: [
                // rivalOf: Thrain reconhece Brûk (Liga Orc, já derrotado a
                // esta altura) — dois "muralhas" defensivas de ligas
                // diferentes, cada um convencido de que a sua é mais firme.
                { id: 'thrain', name: 'Thrain, Escudo da Montanha', title: 'Escudo da Montanha', level: 26, focus: { def: 0.5, str: 0.35, cha: 0.15 },
                    personalityId: 'protetor', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, race: 'anao', rivalOf: 'bruk',
                    visuals: { gender: 'Masculino', archetype: 'cavaleiro', scarStyle: 2 } },
                { id: 'borga', name: 'Borga Machado-Duplo', title: 'Machado-Duplo', level: 27, focus: { str: 0.6, def: 0.3, agi: 0.1 },
                    personalityId: 'berserker', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 4 } },
                { id: 'dagna', name: 'Dagna, Martelo de Kharzum', title: 'Martelo de Kharzum', level: 28, focus: { str: 0.45, def: 0.4, acc: 0.15 },
                    personalityId: 'veterano', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Feminino', archetype: 'barbaro', scarStyle: 1 } },
                // Ivar preenche "arqueiro" (a Anã antes era só
                // guardiao/brutamontes — nenhum especialista em alcance) e
                // reconhece Sylara (Liga Élfica, já derrotada) — rivalidade
                // de atiradores entre as duas raças mais associadas a arco.
                // Sunna é o "usuário de magia auxiliar" da liga, com tema de
                // runas/forja coerente com os itens já regionais de
                // reino_anao (ver items.js rune_protection/rune_strength).
                { id: 'ivar', name: 'Ivar, Flecha da Mina', title: 'Flecha da Mina', level: 28, focus: { agi: 0.35, acc: 0.4, def: 0.25 },
                    personalityId: 'calculista', styleId: 'arqueiro', gearRarity: RARITY.LEGENDARY, race: 'anao', rivalOf: 'sylara',
                    visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 2 } },
                { id: 'sunna', name: 'Sunna, Cântico da Forja', title: 'Cântico da Forja', level: 29, focus: { int: 0.4, def: 0.35, str: 0.25 },
                    personalityId: 'sobrevivente', styleId: 'mago', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Feminino', archetype: 'veterano', scarStyle: 1 } },
                // Iteração 14 (item 3 da mega-diretiva): Grimna preenche
                // "assassino" e Baldrik "lanceiro" — dois estilos ainda
                // ausentes na Anã. Grimna quebra o estereótipo "anão =
                // tanque pesado" com um perfil furtivo de mineira que
                // aprendeu a golpear nos túneis mais estreitos, onde
                // armadura pesada só atrapalha.
                { id: 'grimna', name: 'Grimna, Punhal da Mina Funda', title: 'Punhal da Mina Funda', level: 27, focus: { agi: 0.35, luk: 0.3, acc: 0.35 },
                    personalityId: 'sadico', styleId: 'assassino', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 3 } },
                { id: 'baldrik', name: 'Baldrik, Pique de Kharzum', title: 'Pique de Kharzum', level: 28, focus: { str: 0.4, def: 0.35, acc: 0.25 },
                    personalityId: 'tatico', styleId: 'lanceiro', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Masculino', archetype: 'veterano', scarStyle: 2 } },
                // Iteração 16 (item 3 da mega-diretiva): Modrek reaproveita
                // "guardião" (já usado por Thrain/protetor e o próprio
                // Campeão Thorgrim/honrado) com "fanático" — escuda por
                // devoção religiosa ao deus-forja, não por instinto
                // protetor nem honra pessoal. Krona reaproveita
                // "brutamontes" (já usado por Borga/berserker e Dagna/
                // veterano) com "executor" — mata com eficiência fria de
                // carrasco, sem a fúria de um nem a cautela do outro.
                { id: 'modrek', name: 'Modrek, Punho Sagrado', title: 'Punho Sagrado', level: 26, focus: { def: 0.45, str: 0.4, cha: 0.15 },
                    personalityId: 'fanatico', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Masculino', archetype: 'cavaleiro', scarStyle: 3 } },
                { id: 'krona', name: 'Krona, a Algoz', title: 'a Algoz', level: 27, focus: { str: 0.55, def: 0.3, acc: 0.15 },
                    personalityId: 'executor', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Feminino', archetype: 'barbaro', scarStyle: 4 } },
                // Iteração 21 (item 3 da mega-diretiva, fecha a Anã em 12):
                // Thrud reaproveita "arqueiro" (Ivar/calculista) com
                // "berserker" — atira avançando aos gritos, o oposto do
                // cálculo frio de Ivar. Drenna reaproveita "mago" (Sunna/
                // sobrevivente) com "fanático" — runas de devoção ao
                // deus-forja, ecoando o mesmo tema religioso de Modrek
                // (guardião/fanático) numa chave de estilo diferente.
                { id: 'thrud', name: 'Thrud, Fúria da Mina', title: 'Fúria da Mina', level: 28, focus: { str: 0.35, agi: 0.35, acc: 0.3 },
                    personalityId: 'berserker', styleId: 'arqueiro', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Feminino', archetype: 'barbaro', scarStyle: 3 } },
                { id: 'drenna', name: 'Drenna, Chama da Forja Sagrada', title: 'Chama da Forja Sagrada', level: 29, focus: { int: 0.4, def: 0.35, str: 0.25 },
                    personalityId: 'fanatico', styleId: 'mago', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Feminino', archetype: 'veterano', scarStyle: 2 } },
                { id: 'anao_champion', name: 'Thorgrim, Rei da Forja', title: 'Rei da Forja', level: 30, focus: { def: 0.35, str: 0.35, agi: 0.15, acc: 0.15 },
                    personalityId: 'honrado', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, isChampion: true, race: 'anao',
                    intro: 'Toda lâmina se quebra contra a pedra de Kharzum. Vamos ver a sua.',
                    visuals: { gender: 'Masculino', archetype: 'campeao', scarStyle: 3 },
                    phases: [
                        { hpPercent: 0.65, personalityId: 'protetor', unlockSkill: 'shield_bash', emotion: 'determinado',
                            message: 'Thorgrim ergue o escudo forjado por seus ancestrais — a defesa de Kharzum começa!' },
                        { hpPercent: 0.3, personalityId: 'berserker', unlockSkill: 'heavy_strike', emotion: 'desesperado', healPercent: 0.12,
                            message: 'O Rei da Forja larga a cautela — cada golpe agora carrega o peso da montanha inteira!' }
                    ] }
            ]
        }
    ]
};

// Marca cada rival com o id da própria liga (facilita checagens de progressão)
RivalDatabase.leagues.forEach(league => {
    league.rivals.forEach(rival => { rival.league = league.id; });
});

window.RivalDatabase = RivalDatabase;

/**
 * Desafios de Campeão (item 8 da mega-diretiva Arena+Estilos) — versões
 * "hard mode" opcionais dos Campeões de liga, desbloqueadas depois de
 * derrotá-los na Ladder normal. Pedido explícito da diretiva: NUNCA
 * "mesmo inimigo + 10 níveis" — cada Desafio troca o ESTILO de luta
 * principal do campeão original (não só os números), reforçado por uma
 * fase extra de `phases` (3 em vez de 2) que representa a evolução da
 * estratégia dele depois da derrota. Reaproveita a classe Rival e o
 * mecanismo de fases já existente (AICombat.checkBossPhase) — nenhuma IA
 * nova precisa ser escrita, já que o próprio sistema de fases já entrega
 * "comportamento diferente + habilidades adicionais", exatamente o que a
 * diretiva pede.
 *
 * Ids únicos e distintos dos campeões originais — battle.js já rastreia
 * QUALQUER Rival derrotado via `rivalId` em player.rivalsDefeated
 * genericamente, então nenhum campo novo de save é necessário aqui.
 */
const CHAMPION_CHALLENGES = [
    // Karg (bronze_champion) era gladiador/protetor com escudo — o Desafio
    // troca pra guardiao/calculista: em vez de improvisar no meio da luta
    // (fase 2 original), ele agora começa CALCULANDO uma defesa fechada
    // desde o primeiro golpe, só recorrendo à fúria bruta como último
    // recurso (fase 3, nova).
    { id: 'bronze_champion_challenge', challengeOf: 'bronze_champion',
        name: 'Karg, o Retorno do Bronze', title: 'Desafio do Bronze', level: 10,
        focus: { def: 0.4, str: 0.3, agi: 0.15, acc: 0.15 },
        personalityId: 'calculista', styleId: 'guardiao', gearRarity: RARITY.RARE, isChampion: true,
        intro: 'Da última vez, eu improvisei. Não vai se repetir.',
        visuals: { gender: 'Masculino', archetype: 'campeao', scarStyle: 3 },
        phases: [
            { hpPercent: 0.7, personalityId: 'executor', unlockSkill: 'shield_bash', emotion: 'confiante',
                message: 'Karg mantém a guarda fechada, testando cada abertura com paciência.' },
            { hpPercent: 0.4, personalityId: 'protetor', unlockSkill: 'heavy_strike', emotion: 'determinado',
                message: 'Karg intensifica a pressão, sem abrir mão da defesa.' },
            { hpPercent: 0.15, personalityId: 'berserker', unlockSkill: 'fury', emotion: 'desesperado', healPercent: 0.12,
                message: 'O cálculo falha — Karg abandona tudo e ataca com fúria desesperada!' }
        ] },
    // Gorkhal (orc_champion) era brutamontes/fanatico, pura investida bruta
    // — o Desafio troca pra lanceiro/tatico: ele aprendeu a controlar
    // alcance e distância em vez de só avançar, um jogo de posicionamento
    // completamente diferente da luta original. A fúria original só volta
    // no fim, como último recurso (fase 3, nova) — um eco do Gorkhal que o
    // jogador já venceu uma vez.
    { id: 'orc_champion_challenge', challengeOf: 'orc_champion',
        name: 'Gorkhal, o Senhor Ressurgido', title: 'Desafio Orc', level: 25, race: 'orc',
        focus: { str: 0.3, agi: 0.3, acc: 0.25, def: 0.15 },
        personalityId: 'tatico', styleId: 'lanceiro', gearRarity: RARITY.LEGENDARY, isChampion: true,
        intro: 'A fúria me derrubou uma vez. Hoje eu controlo a distância.',
        visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 4 },
        phases: [
            { hpPercent: 0.7, personalityId: 'calculista', unlockSkill: 'heavy_strike', emotion: 'confiante',
                message: 'Gorkhal mede cada passo, controlando a distância com a lança.' },
            { hpPercent: 0.4, personalityId: 'executor', unlockSkill: 'execution_blow', emotion: 'determinado',
                message: 'Gorkhal encontra as aberturas — cada golpe agora busca terminar a luta.' },
            { hpPercent: 0.15, personalityId: 'fanatico', unlockSkill: 'fury', emotion: 'desesperado', healPercent: 0.15,
                message: 'O controle desmorona — a velha fúria de Gorkhal desperta pela última vez!' }
        ] },
    // Draven (silver_champion) era guardiao/veterano, escudo em punho — o
    // Desafio troca pra assassino/duelista: ele larga o escudo pela
    // velocidade, escolhendo atacar primeiro em vez de esperar a abertura.
    { id: 'silver_champion_challenge', challengeOf: 'silver_champion',
        name: 'Draven, o Duelista Renascido', title: 'Desafio da Prata', level: 15,
        focus: { agi: 0.4, luk: 0.3, acc: 0.3 },
        personalityId: 'duelista', styleId: 'assassino', gearRarity: RARITY.EPIC, isChampion: true,
        intro: 'O escudo me protegeu, mas nunca me fez vencer mais rápido. Hoje eu ataco primeiro.',
        visuals: { gender: 'Masculino', archetype: 'assassino', scarStyle: 2 },
        phases: [
            { hpPercent: 0.7, personalityId: 'calculista', unlockSkill: 'vampiric_strike', emotion: 'confiante',
                message: 'Draven testa cada abertura com golpes rápidos e precisos.' },
            { hpPercent: 0.4, personalityId: 'executor', unlockSkill: 'heavy_strike', emotion: 'determinado',
                message: 'Draven intensifica o ritmo, sem dar nenhum respiro.' },
            { hpPercent: 0.15, personalityId: 'sadico', unlockSkill: 'fury', emotion: 'desesperado', healPercent: 0.12,
                message: 'Sem o escudo pra recuar, Draven ataca com desespero puro!' }
        ] },
    // Aurelion (gold_champion) era gladiador/honrado, o clássico espadachim
    // com escudo — o Desafio troca pra mago/calculista: séculos de arena
    // não bastavam mais, então ele canalizou magia arcana também. A maior
    // mudança de identidade entre todos os Desafios (corpo a corpo pra
    // conjurador), com uma 4ª fase — o mais longo dos Desafios até agora.
    { id: 'gold_champion_challenge', challengeOf: 'gold_champion',
        name: 'Aurelion, o Arcano Imortal', title: 'Desafio do Ouro', level: 20,
        focus: { int: 0.4, acc: 0.3, def: 0.3 },
        personalityId: 'calculista', styleId: 'mago', gearRarity: RARITY.LEGENDARY, isChampion: true,
        intro: 'Séculos de lâmina não bastavam mais. Aprendi algo novo.',
        visuals: { gender: 'Masculino', archetype: 'mercenario', scarStyle: 1 },
        phases: [
            { hpPercent: 0.75, personalityId: 'calculista', unlockSkill: 'quick_heal', emotion: 'confiante',
                message: 'Aurelion testa o próprio poder arcano recém-descoberto.' },
            { hpPercent: 0.5, personalityId: 'executor', unlockSkill: 'arcane_storm', emotion: 'determinado',
                message: 'A magia de Aurelion se intensifica, imprevisível e poderosa.' },
            { hpPercent: 0.25, personalityId: 'honrado', unlockSkill: 'heavy_strike', emotion: 'determinado',
                message: 'Aurelion volta brevemente à lâmina — séculos de hábito não desaparecem.' },
            { hpPercent: 0.1, personalityId: 'berserker', unlockSkill: 'fury', emotion: 'desesperado', healPercent: 0.15,
                message: 'Magia e lâmina se fundem numa última fúria imortal!' }
        ] },
    // Sylvaneth (elfica_champion) era arqueiro/tático, especialista em
    // manter distância — o Desafio troca pra espadachim/duelista: ela
    // abandona o arco, escolhendo terminar cada duelo de perto.
    { id: 'elfica_champion_challenge', challengeOf: 'elfica_champion',
        name: 'Sylvaneth, Lâmina do Santuário', title: 'Desafio Élfico', level: 30, race: 'elfo',
        focus: { agi: 0.4, acc: 0.35, int: 0.25 },
        personalityId: 'duelista', styleId: 'espadachim', gearRarity: RARITY.LEGENDARY, isChampion: true,
        intro: 'O arco cria distância. Hoje eu escolho terminar isso de perto.',
        visuals: { gender: 'Feminino', archetype: 'guerreira', scarStyle: 0 },
        phases: [
            { hpPercent: 0.7, personalityId: 'calculista', unlockSkill: 'heavy_strike', emotion: 'confiante',
                message: 'Sylvaneth avança com a lâmina, testando o alcance do duelo.' },
            { hpPercent: 0.4, personalityId: 'executor', unlockSkill: 'vampiric_strike', emotion: 'determinado',
                message: 'Sylvaneth não recua mais — cada troca de golpes é decisiva.' },
            { hpPercent: 0.15, personalityId: 'cacador', unlockSkill: 'fury', emotion: 'desesperado', healPercent: 0.15,
                message: 'O instinto de caçadora original desperta — Sylvaneth ataca sem hesitar!' }
        ] },
    // Thorgrim (anao_champion) era guardiao/honrado, a muralha defensiva
    // definitiva — o Desafio troca pra brutamontes/berserker: ele decide
    // que a melhor defesa é nunca precisar de uma.
    { id: 'anao_champion_challenge', challengeOf: 'anao_champion',
        name: 'Thorgrim, Punho de Kharzum', title: 'Desafio Anão', level: 35, race: 'anao',
        focus: { str: 0.55, def: 0.3, agi: 0.15 },
        personalityId: 'berserker', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, isChampion: true,
        intro: 'Escudo nenhum jamais venceu uma luta sozinho. Hoje eu ataco.',
        visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 3 },
        phases: [
            { hpPercent: 0.7, personalityId: 'executor', unlockSkill: 'heavy_strike', emotion: 'confiante',
                message: 'Thorgrim avança com o martelo, abandonando toda cautela.' },
            { hpPercent: 0.4, personalityId: 'fanatico', unlockSkill: 'fury', emotion: 'determinado',
                message: 'Thorgrim golpeia com o peso de toda a montanha atrás dele.' },
            { hpPercent: 0.15, personalityId: 'honrado', unlockSkill: 'shield_bash', emotion: 'desesperado', healPercent: 0.15,
                message: 'No limite, Thorgrim volta a erguer o escudo que jurou nunca mais precisar.' }
        ] }
];
CHAMPION_CHALLENGES.forEach(c => { c.league = 'desafio'; }); // nunca pertence a nenhuma liga normal da Ladder
window.CHAMPION_CHALLENGES = CHAMPION_CHALLENGES;

/**
 * Arena dos Campeões (item 9 da mega-diretiva Arena+Estilos) — modalidade
 * de endgame, desbloqueada só depois de derrotar os 6 Campeões de liga
 * (ver ui.js openLadder/startChampionsArena). Reúne o conhecimento
 * adquirido nas diferentes ligas: uma sequência fixa e curada de 5
 * adversários, enfrentados um atrás do outro sem voltar ao Hub entre eles
 * (ver ui.js _beginChampionsArenaStage/btn-return-hub), com variedade
 * REAL de raça/estilo — nunca adversários genéricos/aleatórios/sem
 * identidade (pedido explícito da diretiva):
 *   1. Freya Tempestade — humana, especialista em alcance (arqueiro)
 *   2. Kael, o Punho Sem Nome — especialista desarmado de verdade (usa o
 *      arquétipo raro `lutador_desarmado` já existente, ver ai.js
 *      assignProfile/opts.forcedRareArchetypeId — nova flag desta
 *      iteração que permite curar esse arquétipo pra um lutador
 *      específico, em vez de só sortear no Duelo Rápido)
 *   3. Dagna, Martelo de Kharzum — anã, build pesada/defensiva
 *   4. Ilwenna, Voz das Raízes — élfica, híbrida de magia auxiliar
 *   5. Grokmar, a Fúria Desperta — Boss Especial da Arena (Fúria
 *      Crescente), representando a categoria "boss com mecânica própria"
 *
 * `type: 'rival'` reaproveita defs já existentes do RivalDatabase (`id`
 * aponta pro Rival original — instanciado de novo aqui, então ganha vida
 * própria nesta corrida, sem interferir com o Rival "original" da Ladder);
 * `type: 'custom'` usa uma def independente (o especialista desarmado, que
 * não existe em nenhuma liga); `type: 'arenaBoss'` usa
 * window.createArenaBoss. Deliberadamente NÃO inclui os bosses de Ritual
 * (Conde Vampiro/Anjo Guardião) — battle.js despertaria a Linhagem
 * correspondente em qualquer vitória contra `isBoss` com esse `bossId`,
 * o que permitiria despertar uma Linhagem pela Arena dos Campeões sem
 * nunca ter feito o Ritual de verdade (exploit real, evitado por
 * construção ao usar só bosses que nunca aparecem em LINEAGES[x].bossId).
 */
const CHAMPIONS_ARENA_STAGES = [
    { type: 'rival', sourceLeague: 'gold', sourceId: 'freya' },
    { type: 'custom', level: 30, def: {
        id: 'champions_arena_unarmed', name: 'Kael, o Punho Sem Nome', title: 'Punho Sem Nome',
        level: 30, focus: { str: 0.45, agi: 0.35, def: 0.2 },
        personalityId: 'berserker', styleId: 'brutamontes', gearRarity: RARITY.EPIC,
        forcedRareArchetypeId: 'lutador_desarmado',
        intro: 'Armas quebram. Punhos, não.',
        visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 4 }
    } },
    { type: 'rival', sourceLeague: 'anao', sourceId: 'dagna' },
    { type: 'rival', sourceLeague: 'elfica', sourceId: 'ilwenna' },
    { type: 'arenaBoss', sourceId: 'grokmar_furia' }
];
window.CHAMPIONS_ARENA_STAGES = CHAMPIONS_ARENA_STAGES;
