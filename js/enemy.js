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
function totalStatPointsForLevel(level) {
    return 35 + level * 5;
}
window.totalStatPointsForLevel = totalStatPointsForLevel;

class Enemy extends Entity {
    constructor(playerLevel) {
        // Raça sorteada ANTES do nome (ver RACE_ENEMY_NAMES acima) pra que o
        // pool de nomes já reflita a identidade regional — mesma demografia
        // ponderada por Cidade-Hub usada mais abaixo pra atribuir `this.race`,
        // só que precisa ser calculada aqui em cima porque `super(name)` tem
        // que rodar antes de qualquer atribuição em `this`.
        const cityDefForName = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const demographicsForName = (cityDefForName && cityDefForName.raceDemographics) ? cityDefForName.raceDemographics : null;
        const raceIdsForName = window.RACES ? Object.keys(window.RACES) : ['humano'];
        const pickedRace = (demographicsForName && window.Utils.weightedPick)
            ? (Utils.weightedPick(demographicsForName) || 'humano')
            : raceIdsForName[Utils.randomInt(0, raceIdsForName.length - 1)];
        const namePool = RACE_ENEMY_NAMES[pickedRace] || { names: ENEMY_NAMES, adjectives: ENEMY_ADJECTIVES };
        const name = `${namePool.names[Utils.randomInt(0, namePool.names.length - 1)]} ${namePool.adjectives[Utils.randomInt(0, namePool.adjectives.length - 1)]}`;
        super(name);

        // Balanceamento (pedido do usuário: jogo ficando fácil demais) —
        // era `randomInt(-1, 1)` (média = nível do jogador, podia até vir
        // mais fraco). Agora nunca vem mais fraco que o jogador, só igual
        // ou até 2 níveis acima — empurra a dificuldade média pra cima sem
        // criar picos absurdos (isso já é papel do bônus de Elite acima).
        this.level = playerLevel + Utils.randomInt(0, 2);
        if (this.level < 1) this.level = 1;

        // Elite: raro, mais forte, recompensa maior e nome de destaque (ver
        // ELITE_ENEMY_CHANCE acima) — sorteado ANTES de generateStats/
        // equipStyleWeapon/recompensas pra que todos eles já saibam reagir
        // ao bônus sem precisar de nenhum caso especial fora daqui.
        this.isElite = Utils.chance(ELITE_ENEMY_CHANCE);
        if (this.isElite) {
            this.name = `★ ${this.name}, o Elite`;
            this.level += 2;
        }

        // Personalidade + estilo de luta (+ raramente um arquétipo raro) via
        // motor de IA — nunca mais um simples multiplicador de dano. Sorteado
        // ANTES da distribuição de atributos, de propósito: assim os pontos
        // podem ser enviesados pelo `statFocus` do estilo (ver generateStats),
        // e um "Mago" de verdade nasce com INT alto, um "Brutamontes" com
        // STR alto, etc — antes disso os dois sistemas rolavam sem se
        // conhecer, e um estilo podia nascer com o atributo que o define
        // baixíssimo, por puro azar da rolagem uniforme.
        //
        // `raceId: pickedRace` (item 21 — ver RACE_STYLE_WEIGHTS em
        // ai_data.js): já sorteada mais acima pro pool de nomes, então dá
        // pra enviesar o ESTILO pela raça no mesmo passo, antes mesmo de
        // `this.race` ser atribuído formalmente logo abaixo.
        window.AICombat.assignProfile(this, { level: this.level, raceId: pickedRace });

        // Raça (ver races.js) — antes só o Jogador tinha `.race` (escolhida
        // na Criação de Personagem); Entity.getTotalStat já soma o
        // modificador racial de forma genérica pra qualquer entidade que
        // tenha o campo, então bastava atribuir um aqui pros inimigos do
        // Duelo Rápido também terem identidade racial de verdade (não só
        // visual), sem precisar mudar nenhuma fórmula de combate.
        //
        // Demografia por Cidade-Hub (ver citydatabase.js `raceDemographics`):
        // a vasta maioria dos oponentes na Fortaleza Orc deve ser Orc, no
        // Santuário Élfico deve ser Elfo, etc — sorteio ponderado em vez de
        // uniforme entre todas as raças. Sem cidade definida (ou demografia
        // ausente), cai no sorteio uniforme original entre todas as raças
        // cadastradas, preservando o comportamento de antes do sistema de
        // cidades existir. Já sorteada acima (`pickedRace`) pra poder
        // escolher o pool de nome regional antes do `super(name)`.
        this.race = pickedRace;

        // Distribui pontos de atributo com base no nível gerado, enviesados
        // pelo estilo de luta já sorteado.
        this.generateStats();

        // Aparência completa e coerente com o estilo sorteado — cada
        // inimigo do Duelo Rápido agora parece um lutador diferente, não uma
        // cópia idêntica só com equipamento trocado. `this.race` (linha
        // acima) já está definido, então a pele já nasce coerente com a
        // raça sorteada (ver races.js RaceSystem.pickSkinTone).
        this.visuals = randomFighterVisuals(this.aiStyle ? this.aiStyle.id : null, this.race);

        // Aura dourada do Elite (reaproveita o mesmo hook visual da aura de
        // Linhagem, ver graphics.js _drawLineageAura — `hasAura`/`auraColor`/
        // `particle` já eram lidos genericamente ali; só nunca tinham sido
        // setados por nada além do jogador com Linhagem despertada). Sem
        // isso, o "★ ... o Elite" no nome era o ÚNICO sinal visual de que
        // esse combatente é diferente — fácil de não perceber em batalha.
        if (this.isElite) {
            this.visuals.hasAura = true;
            this.visuals.auraColor = '#ffd700';
            this.visuals.particle = 'elite_sparks';
        }

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

        // Recompensa ao ser derrotado — Elite vale bem mais que o dobro,
        // pra recompensar de verdade o risco extra de enfrentá-lo.
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
    equipArmor() {
        const rarityChance = this.isElite
            ? (15 + this.level + 30)
            : Utils.clamp((this.level - 2) * 5, 0, 40);
        const armorId = window.AICombat.pickArmor();
        const rarity = Utils.chance(rarityChance) ? RARITY.UNCOMMON : RARITY.COMMON;
        this.equipment[SLOTS.CHEST] = ItemFactory.createEquipment(armorId, 'armors', rarity);
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
const VAMPIRE_NAMES = ['Vampiro Renascido', 'Nobre da Noite Eterna', 'Servo do Conde', 'Sanguessuga Ancestral', 'Filho das Trevas'];
class Vampire extends Entity {
    constructor(playerLevel) {
        super(VAMPIRE_NAMES[Utils.randomInt(0, VAMPIRE_NAMES.length - 1)]);
        this.isVampireEnemy = true; // flag que battle.js usa pra sortear a Essência ao derrotá-lo
        this.lineage = 'vampirismo'; // usado por LineageSystem.getWeaknessMultiplier em battle.js (jogadores da Linhagem Luz causam +25% de dano nele)

        this.level = playerLevel + Utils.randomInt(0, 2); // vampiros são um desafio um degrau acima do normal
        if (this.level < 5) this.level = 5; // pedido do usuário: vampiro nunca abaixo do nível 5, mesmo contra jogador iniciante

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
        // Mesma fórmula compartilhada do Enemy comum (ver auditoria de
        // balanceamento acima) — Vampiro já é mais difícil por ter piso de
        // nível 5 e um nível efetivo mais alto (playerLevel + 0~2), não
        // precisa de mais +5 pontos soltos por cima disso.
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
    equipArmor() {
        const rarityChance = Utils.clamp((this.level - 2) * 5, 0, 40);
        const armorId = window.AICombat.pickArmor();
        const rarity = Utils.chance(rarityChance) ? RARITY.UNCOMMON : RARITY.COMMON;
        this.equipment[SLOTS.CHEST] = ItemFactory.createEquipment(armorId, 'armors', rarity);
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

        this.distributeStats(def.focus);

        // Personalidade e estilo de luta curados por rival (não aleatórios,
        // preservando a identidade narrativa de cada adversário da ladder);
        // arquétipos raros ficam reservados ao Duelo Rápido.
        window.AICombat.assignProfile(this, {
            personalityId: def.personalityId, styleId: def.styleId,
            level: this.level, allowRareArchetype: false
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
            const leagueAuraColors = {
                bronze: 'rgba(205,127,50,0.35)', silver: 'rgba(200,208,216,0.4)', gold: 'rgba(240,185,35,0.4)',
                orc: 'rgba(58,90,26,0.4)', elfica: 'rgba(74,138,58,0.4)'
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
    equipGear(rarity) {
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        const weaponId = window.AICombat.pickWeaponFromStyle(this.aiStyle.id);
        const armorId = window.AICombat.pickArmor();
        // Bug de auditoria (sistema de duas armas, ver Entity.
        // equipStyleWeaponGeneric em player.js pelo mesmo bug e explicação
        // completa): a arma sempre era gravada em equipment[SLOTS.MAIN_HAND]
        // aqui, mesmo pra um Rival de estilo Arqueiro cuja arma sorteada
        // (arco/besta) já carrega slot:SLOTS.RANGED — hasDualWeapons() nunca
        // via essa arma como a principal. activeWeaponSlot ajustado junto
        // pra sempre acompanhar onde a arma realmente está.
        const weapon = ItemFactory.createEquipment(weaponId, 'weapons', rarity);
        this.equipment[weapon.slot] = weapon;
        this.activeWeaponSlot = weapon.slot;
        this.equipment[SLOTS.CHEST] = ItemFactory.createEquipment(armorId, 'armors', rarity);
        // Campeões carregam arma encantada com mais frequência que rivais
        // comuns — reforça que enfrentar um Campeão é diferente (ver
        // Enemy.maybeEnchantWeapon acima, compartilhado com o Duelo Rápido).
        Enemy.maybeEnchantWeapon(weapon, this.isChampion ? 35 : 18);

        // Arma secundária (item 2 da auditoria de balanceamento) — mesma
        // regra do Duelo Rápido comum (ver Entity.maybeEquipSecondaryWeapon
        // em player.js): categoria oposta à principal, chance-gated. Rivais
        // Campeões têm chance bem maior de carregar uma reserva de verdade,
        // reforçando que enfrentar um Campeão é um combate mais completo.
        if (window.AICombat && Utils.chance(this.isChampion ? 55 : 30)) {
            const secondaryId = window.AICombat.pickSecondaryWeaponFromStyle(this.aiStyle.id);
            if (secondaryId) {
                const secondary = ItemFactory.createEquipment(secondaryId, 'weapons', rarity);
                if (secondary.slot !== this.activeWeaponSlot) this.equipment[secondary.slot] = secondary;
            }
        }

        // Escudo por preferência de ESTILO (gladiador/guardião), igual a
        // Enemy/Vampire — antes só Campeões ganhavam escudo, deixando
        // rivais comuns de estilo "escudeiro" (ex: Brenna, Ágil da Prata
        // com guardiao/gladiador) sem o escudo que sua própria IA já espera
        // (ver AI_FIGHTING_STYLES.preferShield em ai_data.js).
        const shieldId = window.AICombat.pickShieldFromStyle(this.aiStyle.id);
        if (this.isChampion || shieldId) {
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
            this.equipment[SLOTS.OFF_HAND] = ItemFactory.createEquipment(finalShieldId, 'shields', rarity);
        }
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
                { id: 'bronze_champion', name: 'Karg, Campeão de Bronze', title: 'Campeão de Bronze', level: 5, focus: { str: 0.3, def: 0.3, agi: 0.2, acc: 0.2 },
                    personalityId: 'protetor', styleId: 'gladiador', gearRarity: RARITY.UNCOMMON, isChampion: true,
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
                { id: 'silver_champion', name: 'Draven, Campeão de Prata', title: 'Campeão de Prata', level: 10, focus: { str: 0.3, def: 0.3, agi: 0.2, acc: 0.2 },
                    personalityId: 'veterano', styleId: 'guardiao', gearRarity: RARITY.RARE, isChampion: true,
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
                { id: 'moloch', name: 'Moloch, o Destruidor', title: 'o Destruidor', level: 12, focus: { str: 0.65, def: 0.35 },
                    personalityId: 'fanatico', styleId: 'brutamontes', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 3 } },
                { id: 'sable', name: 'Sable, a Serpente', title: 'a Serpente', level: 13, focus: { luk: 0.4, agi: 0.35, acc: 0.25 },
                    personalityId: 'sadico', styleId: 'assassino', gearRarity: RARITY.EPIC,
                    visuals: { gender: 'Feminino', archetype: 'assassino', scarStyle: 2 } },
                { id: 'gold_champion', name: 'Aurelion, o Imortal', title: 'o Imortal', level: 15, focus: { str: 0.28, def: 0.28, agi: 0.22, acc: 0.22 },
                    personalityId: 'honrado', styleId: 'gladiador', gearRarity: RARITY.LEGENDARY, isChampion: true,
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
                { id: 'skarza', name: 'Skarza, Lança Vulcânica', title: 'Lança Vulcânica', level: 17, focus: { str: 0.4, agi: 0.35, acc: 0.25 },
                    personalityId: 'cacador', styleId: 'lanceiro', gearRarity: RARITY.EPIC, race: 'orc',
                    visuals: { gender: 'Feminino', archetype: 'barbaro', scarStyle: 2 } },
                { id: 'bruk', name: 'Brûk, o Inabalável', title: 'o Inabalável', level: 18, focus: { def: 0.5, str: 0.35, cha: 0.15 },
                    personalityId: 'protetor', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, race: 'orc',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 3 } },
                { id: 'orc_champion', name: 'Gorkhal, Senhor da Guerra', title: 'Senhor da Guerra', level: 20, focus: { str: 0.35, def: 0.3, agi: 0.2, acc: 0.15 },
                    personalityId: 'fanatico', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, isChampion: true, race: 'orc',
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
                { id: 'thalindor', name: 'Thalindor, Lâmina da Clareira', title: 'Lâmina da Clareira', level: 22, focus: { agi: 0.45, luk: 0.3, acc: 0.25 },
                    personalityId: 'duelista', styleId: 'assassino', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Masculino', archetype: 'assassino', scarStyle: 0 } },
                { id: 'ilwenna', name: 'Ilwenna, Voz das Raízes', title: 'Voz das Raízes', level: 23, focus: { int: 0.45, acc: 0.3, luk: 0.25 },
                    personalityId: 'calculista', styleId: 'mago', gearRarity: RARITY.LEGENDARY, race: 'elfo',
                    visuals: { gender: 'Feminino', archetype: 'mercenario', scarStyle: 0 } },
                { id: 'elfica_champion', name: 'Sylvaneth, Guardiã Ancestral', title: 'Guardiã Ancestral', level: 25, focus: { agi: 0.3, int: 0.25, acc: 0.25, luk: 0.2 },
                    personalityId: 'tatico', styleId: 'arqueiro', gearRarity: RARITY.LEGENDARY, isChampion: true, race: 'elfo',
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
                { id: 'thrain', name: 'Thrain, Escudo da Montanha', title: 'Escudo da Montanha', level: 26, focus: { def: 0.5, str: 0.35, cha: 0.15 },
                    personalityId: 'protetor', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Masculino', archetype: 'cavaleiro', scarStyle: 2 } },
                { id: 'borga', name: 'Borga Machado-Duplo', title: 'Machado-Duplo', level: 27, focus: { str: 0.6, def: 0.3, agi: 0.1 },
                    personalityId: 'berserker', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Masculino', archetype: 'barbaro', scarStyle: 4 } },
                { id: 'dagna', name: 'Dagna, Martelo de Kharzum', title: 'Martelo de Kharzum', level: 28, focus: { str: 0.45, def: 0.4, acc: 0.15 },
                    personalityId: 'veterano', styleId: 'brutamontes', gearRarity: RARITY.LEGENDARY, race: 'anao',
                    visuals: { gender: 'Feminino', archetype: 'barbaro', scarStyle: 1 } },
                { id: 'anao_champion', name: 'Thorgrim, Rei da Forja', title: 'Rei da Forja', level: 30, focus: { def: 0.35, str: 0.35, agi: 0.15, acc: 0.15 },
                    personalityId: 'honrado', styleId: 'guardiao', gearRarity: RARITY.LEGENDARY, isChampion: true, race: 'anao',
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
