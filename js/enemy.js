/**
 * Sistema de IA e Inimigos Procedurais
 *
 * A personalidade/estilo de luta/memória/emoção de cada inimigo é resolvida
 * pelo motor de IA (ai.js + ai_data.js) — este arquivo só cuida de gerar
 * estatísticas, equipamento e recompensas, e delega a "mente" de cada
 * combatente para AICombat.assignProfile().
 */

const ENEMY_NAMES = ["Saqueador", "Gladiador Renegado", "Mercenário", "Assassino", "Bárbaro"];
const ENEMY_ADJECTIVES = ["Brutal", "Cicatrizado", "Implacável", "Veloz", "Sanguinário"];

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

        // Distribui pontos de atributo com base no nível gerado
        this.generateStats();

        // Personalidade + estilo de luta (+ raramente um arquétipo raro) via
        // motor de IA — nunca mais um simples multiplicador de dano.
        window.AICombat.assignProfile(this, { level: this.level });

        // Aparência completa e coerente com o estilo sorteado — cada
        // inimigo do Duelo Rápido agora parece um lutador diferente, não uma
        // cópia idêntica só com equipamento trocado.
        this.visuals = randomFighterVisuals(this.aiStyle ? this.aiStyle.id : null);

        // Arma coerente com o estilo sorteado (a menos que o arquétipo raro
        // "Lutador de Punho Nu" já tenha recusado armas em assignProfile)
        if (!this.aiRareArchetype || this.aiRareArchetype.id !== 'lutador_desarmado') {
            this.equipStyleWeapon();
        } else {
            this.calculateDerivedStats();
            this.currentHp = this.derivedStats.maxHp;
            this.currentMp = this.derivedStats.maxMp;
        }

        // Recompensa ao ser derrotado
        this.expValue = Math.floor(20 * Math.pow(1.2, this.level));
        this.goldValue = Math.floor(Utils.randomInt(10, 30) * (this.level * 0.5 + 1));
    }

    generateStats() {
        const totalPoints = 35 + (this.level * 5); // Base + escalonamento

        // Distribuição procedural básica
        for (let i = 0; i < totalPoints; i++) {
            const statsArray = Object.keys(this.baseStats);
            const randomStat = statsArray[Utils.randomInt(0, statsArray.length - 1)];
            this.baseStats[randomStat]++;
        }

        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
    }

    // Equipa uma arma coerente com o estilo de luta já atribuído (chamado
    // depois de assignProfile, já que a escolha depende do estilo sorteado).
    equipStyleWeapon() {
        const styleId = this.aiStyle ? this.aiStyle.id : 'espadachim';
        const weaponId = window.AICombat.pickWeaponFromStyle(styleId);
        let rarity = RARITY.COMMON;
        if (Utils.chance(15 + this.level)) rarity = RARITY.UNCOMMON;
        this.equipment[SLOTS.MAIN_HAND] = ItemFactory.createEquipment(weaponId, 'weapons', rarity);
        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
    }

    // Chance de dropar um item ao ser derrotado, influenciada pela Sorte do jogador
    generateLoot(playerLuk) {
        const dropChance = 30 + (playerLuk * 2);

        if (Utils.chance(dropChance)) {
            const dropTable = window.ItemFactory.generateShopInventory(this.level + 2);
            return dropTable[0];
        }
        return null;
    }
}

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

        if (this.isChampion) {
            const shieldKeys = Object.keys(ItemDatabase.shields);
            const shieldId = shieldKeys[Utils.randomInt(0, shieldKeys.length - 1)];
            this.equipment[SLOTS.OFF_HAND] = ItemFactory.createEquipment(shieldId, 'shields', rarity);
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
