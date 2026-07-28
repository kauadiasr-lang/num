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

// Inimigo Elite do Duelo Rápido: um combatente raro, bem mais forte e
// recompensador que o comum, mas ainda usando a IA comum (AICombat) — não é
// um boss (esses têm IA própria em bossai.js, ver Conde Vampiro/Anjo
// Guardião). Existe pra dar ao Duelo Rápido repetido uma chance ocasional de
// "vale a pena continuar tentando a sorte", igual a um monstro raro de
// qualquer RPG de loot.
const ELITE_ENEMY_CHANCE = 8; // % por Duelo Rápido gerado

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

function randomFighterVisuals(styleId) {
    const gender = Utils.chance(50) ? 'Masculino' : 'Feminino';
    const archetypeIds = Object.keys(window.FIGHTER_ARCHETYPES || { veterano: 1 });
    const preferred = STYLE_TO_ARCHETYPE[styleId];
    const archetype = (preferred && Utils.chance(70)) ? preferred : archetypeIds[Utils.randomInt(0, archetypeIds.length - 1)];
    const hairColor = ENEMY_HAIR_COLORS[Utils.randomInt(0, ENEMY_HAIR_COLORS.length - 1)];
    return {
        gender,
        skinTone: ENEMY_SKIN_TONES[Utils.randomInt(0, ENEMY_SKIN_TONES.length - 1)],
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

class Enemy extends Entity {
    constructor(playerLevel) {
        const name = `${ENEMY_NAMES[Utils.randomInt(0, ENEMY_NAMES.length - 1)]} ${ENEMY_ADJECTIVES[Utils.randomInt(0, ENEMY_ADJECTIVES.length - 1)]}`;
        super(name);

        this.level = playerLevel + Utils.randomInt(-1, 1);
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
        window.AICombat.assignProfile(this, { level: this.level });

        // Raça (ver races.js) — antes só o Jogador tinha `.race` (escolhida
        // na Criação de Personagem); Entity.getTotalStat já soma o
        // modificador racial de forma genérica pra qualquer entidade que
        // tenha o campo, então bastava atribuir um aqui pros inimigos do
        // Duelo Rápido também terem identidade racial de verdade (não só
        // visual), sem precisar mudar nenhuma fórmula de combate.
        const raceIds = window.RACES ? Object.keys(window.RACES) : ['humano'];
        this.race = raceIds[Utils.randomInt(0, raceIds.length - 1)];

        // Distribui pontos de atributo com base no nível gerado, enviesados
        // pelo estilo de luta já sorteado.
        this.generateStats();

        // Aparência completa e coerente com o estilo sorteado — cada
        // inimigo do Duelo Rápido agora parece um lutador diferente, não uma
        // cópia idêntica só com equipamento trocado.
        this.visuals = randomFighterVisuals(this.aiStyle ? this.aiStyle.id : null);

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
        } else {
            this.calculateDerivedStats();
            this.currentHp = this.derivedStats.maxHp;
            this.currentMp = this.derivedStats.maxMp;
        }

        // Recompensa ao ser derrotado — Elite vale bem mais que o dobro,
        // pra recompensar de verdade o risco extra de enfrentá-lo.
        this.expValue = Math.floor(20 * Math.pow(1.2, this.level) * (this.isElite ? 2.2 : 1));
        this.goldValue = Math.floor(Utils.randomInt(10, 30) * (this.level * 0.5 + 1) * (this.isElite ? 2.2 : 1));
    }

    generateStats() {
        // Base + escalonamento; ver Entity.generateStatsFromStyle (player.js)
        // pela distribuição enviesada pelo `statFocus` do estilo já sorteado
        // — um "Mago" tende a nascer com INT alto, um "Brutamontes" com STR
        // alto, etc, sem deixar de ser aleatório. Elite ganha 40 pontos extra
        // de atributo, além do nível já ter subido +2 na criação.
        this.generateStatsFromStyle(35 + (this.level * 5) + (this.isElite ? 40 : 0));
    }

    // Equipa uma arma coerente com o estilo de luta já atribuído (chamado
    // depois de assignProfile, já que a escolha depende do estilo sorteado).
    // Ver Entity.equipStyleWeaponGeneric (player.js) pela lógica
    // compartilhada com Vampire/Ghost; 20% de chance de Encantamento (ver
    // enchantments.js) — antes só o Jogador podia ter arma encantada, mesmo
    // battle.js já lendo encantamento de QUALQUER `entity` genericamente.
    // Elite tem chance de raridade e de encantamento bem maiores.
    equipStyleWeapon() {
        this.equipStyleWeaponGeneric(15 + this.level + (this.isElite ? 30 : 0), this.isElite ? 45 : 20);
    }

    // Chance de dropar um item ao ser derrotado, influenciada pela Sorte do
    // jogador. Elite SEMPRE dropa algo, de um nível bem mais alto — o
    // desafio extra precisa se traduzir num prêmio garantido, não só numa
    // chance melhor.
    generateLoot(playerLuk) {
        if (this.isElite) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 5);
            return dropTable[0];
        }

        const dropChance = 30 + (playerLuk * 2);
        if (Utils.chance(dropChance)) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 2);
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
        if (this.level < 2) this.level = 2;

        // Estilo sorteado ANTES dos atributos, pelo mesmo motivo do Enemy
        // comum: permite que generateStats enviese os pontos pelo statFocus
        // do estilo (um Vampiro "brutamontes" nasce forte de verdade).
        window.AICombat.assignProfile(this, { level: this.level, styleId: Utils.chance(50) ? 'assassino' : 'brutamontes' });
        this.generateStats();
        this.equipStyleWeapon();

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
        this.generateStatsFromStyle(40 + (this.level * 5));
    }

    // Ver Entity.equipStyleWeaponGeneric (player.js) pela lógica
    // compartilhada com Enemy/Ghost. 20% de chance de Encantamento — igual
    // ao Duelo Rápido comum (Enemy), fechando uma lacuna: Vampire nunca
    // tinha essa chance antes, mesmo sendo um combatente comum pra fins de
    // IA/equipamento (só o boss do Ritual, Conde Vampiro, tem IA exclusiva).
    equipStyleWeapon() {
        this.equipStyleWeaponGeneric(20, 20);
    }

    // Chance pequena e independente do loot normal de itens — checado em
    // battle.js no fim da luta quando `this.enemy.isVampireEnemy` é true.
    rollEssenceDrop() {
        return Utils.chance(18);
    }

    generateLoot(playerLuk) {
        const dropChance = 25 + (playerLuk * 2);
        if (Utils.chance(dropChance)) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 2);
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
        this.generateStatsFromStyle(38 + (this.level * 5));
    }

    // Ver Entity.equipStyleWeaponGeneric (player.js) pela lógica
    // compartilhada com Enemy/Vampire. 20% de chance de Encantamento,
    // igual ao resto do Duelo Rápido — Ghost nunca tinha essa chance antes.
    equipStyleWeapon() {
        this.equipStyleWeaponGeneric(15, 20);
    }

    generateLoot(playerLuk) {
        const dropChance = 22 + (playerLuk * 2);
        if (Utils.chance(dropChance)) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 2);
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
    boss.generateLoot = function (playerLuk) {
        const pool = window.ItemFactory.generateShopInventory(boss.level + 4);
        const legendary = pool.find(i => i.rarity && i.rarity.id === RARITY.LEGENDARY.id);
        return legendary || pool[0];
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

        // Aparência: cada rival nomeado tem gênero/arquétipo/cicatriz
        // AUTORAIS (def.visuals, ver RivalDatabase abaixo) — reforça que é
        // "aquele adversário específico", não um número genérico — e o
        // resto (cores, cabelo, rosto) é preenchido aleatoriamente por cima.
        this.visuals = Object.assign(randomFighterVisuals(this.aiStyle ? this.aiStyle.id : null), def.visuals || {});

        // Aura sutil por liga nos Campeões (reaproveita o mesmo hook de
        // graphics.js _drawLineageAura já usado pela Linhagem do jogador e
        // pelo Elite do Duelo Rápido) — só um glow calmo, sem partícula
        // (nunca setamos `visuals.particle`), pra nunca ser confundido com
        // o brilho errático do Elite nem com as motes ascendentes da
        // Linhagem Luz. Antes um Campeão da Ladder (o clímax de cada liga,
        // já com recompensas/loot/IA de fases exclusivas) não tinha NENHUMA
        // distinção visual além do próprio equipamento.
        if (this.isChampion) {
            const leagueAuraColors = { bronze: 'rgba(205,127,50,0.35)', silver: 'rgba(200,208,216,0.4)', gold: 'rgba(240,185,35,0.4)' };
            this.visuals.hasAura = true;
            this.visuals.auraColor = leagueAuraColors[this.league] || leagueAuraColors.gold;
        }

        // Raça (ver races.js) — o Duelo Rápido (Enemy, acima) já sorteia uma
        // raça por combatente desde a iteração 6, mas Rivais nomeados da
        // Ladder ficaram de fora só por nunca terem recebido o campo. Como
        // os outros campos de identidade (personalityId/styleId/visuals),
        // `def.race` deixa um rival específico ser curado; sem isso, sorteia
        // como qualquer outro inimigo.
        const raceIds = window.RACES ? Object.keys(window.RACES) : ['humano'];
        this.race = def.race || raceIds[Utils.randomInt(0, raceIds.length - 1)];

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
    equipGear(rarity) {
        const armorKeys = Object.keys(ItemDatabase.armors);
        const weaponId = window.AICombat.pickWeaponFromStyle(this.aiStyle.id);
        const armorId = armorKeys[Utils.randomInt(0, armorKeys.length - 1)];
        this.equipment[SLOTS.MAIN_HAND] = ItemFactory.createEquipment(weaponId, 'weapons', rarity);
        this.equipment[SLOTS.CHEST] = ItemFactory.createEquipment(armorId, 'armors', rarity);
        // Campeões carregam arma encantada com mais frequência que rivais
        // comuns — reforça que enfrentar um Campeão é diferente (ver
        // Enemy.maybeEnchantWeapon acima, compartilhado com o Duelo Rápido).
        Enemy.maybeEnchantWeapon(this.equipment[SLOTS.MAIN_HAND], this.isChampion ? 35 : 18);

        // Escudo por preferência de ESTILO (gladiador/guardião), igual a
        // Enemy/Vampire — antes só Campeões ganhavam escudo, deixando
        // rivais comuns de estilo "escudeiro" (ex: Brenna, Ágil da Prata
        // com guardiao/gladiador) sem o escudo que sua própria IA já espera
        // (ver AI_FIGHTING_STYLES.preferShield em ai_data.js).
        const shieldId = window.AICombat.pickShieldFromStyle(this.aiStyle.id);
        if (this.isChampion || shieldId) {
            const shieldKeys = Object.keys(ItemDatabase.shields);
            const finalShieldId = shieldId || shieldKeys[Utils.randomInt(0, shieldKeys.length - 1)];
            this.equipment[SLOTS.OFF_HAND] = ItemFactory.createEquipment(finalShieldId, 'shields', rarity);
        }
    }

    // Campeões sempre deixam loot de alta raridade; rivais comuns têm chance normal
    generateLoot(playerLuk) {
        const dropChance = this.isChampion ? 100 : 40 + playerLuk;
        if (!Utils.chance(dropChance)) return null;

        const minRarityId = this.isChampion ? RARITY.EPIC.id : RARITY.UNCOMMON.id;
        const pool = window.ItemFactory.generateShopInventory(this.level + 2);
        const goodItems = pool.filter(i => i.rarity.id >= minRarityId);
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
        }
    ]
};

// Marca cada rival com o id da própria liga (facilita checagens de progressão)
RivalDatabase.leagues.forEach(league => {
    league.rivals.forEach(rival => { rival.league = league.id; });
});

window.RivalDatabase = RivalDatabase;
