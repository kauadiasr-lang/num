/**
 * Sistemas de Entidade, Atributos e Jogador.
 * Cálculos matemáticos reais, sem hardcoding.
 */

// Perfil de alcance/velocidade de combatentes desarmados (punhos)
const UNARMED_RANGE = { min: 0, max: 1 };
const UNARMED_SPEED = { atkSpeed: 1, approachSpeed: 2, retreatSpeed: 2 };

class Entity {
    constructor(name) {
        this.name = name;
        this.level = 1;
        this.baseStats = {
            str: 5, // Força: Aumenta dano físico e capacidade de peso
            agi: 5, // Agilidade: Esquiva, chance crítica e velocidade de turno
            int: 5, // Inteligência: Dano mágico, Mana máxima e resistência mágica
            def: 5, // Defesa: Mitigação de dano base
            acc: 5, // Precisão: Chance de acerto ignorando esquiva inimiga
            luk: 5, // Sorte: Loot rate, acertos críticos extremos
            cha: 5  // Carisma: Preços na loja, interação em eventos
        };

        this.equipment = {
            [SLOTS.HEAD]: null, [SLOTS.CHEST]: null, [SLOTS.HANDS]: null,
            [SLOTS.LEGS]: null, [SLOTS.FEET]: null, [SLOTS.MAIN_HAND]: null,
            [SLOTS.OFF_HAND]: null, [SLOTS.AMULET]: null, [SLOTS.RING]: null,
            [SLOTS.RANGED]: null
        };

        // Qual arma está "na mão" pra atacar agora: mainHand (corpo a corpo)
        // ou ranged (arco/besta, se equipado) — trocar custa o turno inteiro
        // (ver BattleSystem, ação SWITCH_WEAPON). Sem arma corpo a corpo nem
        // ranged equipados, ataca desarmado (UNARMED_RANGE/SPEED).
        this.activeWeaponSlot = SLOTS.MAIN_HAND;

        this.derivedStats = {};
        this.currentHp = 0;
        this.currentMp = 0;

        // Recargas de habilidade: em Entity (não só em Player) para que
        // inimigos também possam usar habilidades com cooldown via IA de combate.
        this.skillCooldowns = {};
    }

    // Coloca uma habilidade em recarga por N turnos
    setSkillCooldown(skillId, turns) {
        if (!this.skillCooldowns) this.skillCooldowns = {};
        this.skillCooldowns[skillId] = turns;
    }

    isSkillReady(skillId) {
        return !this.skillCooldowns || !this.skillCooldowns[skillId] || this.skillCooldowns[skillId] <= 0;
    }

    // Avança as recargas de todas as habilidades em 1 turno
    tickCooldowns() {
        if (!this.skillCooldowns) return;
        for (let id in this.skillCooldowns) {
            if (this.skillCooldowns[id] > 0) this.skillCooldowns[id]--;
        }
    }

    // Calcula os atributos reais (Base + Raça + Equipamentos)
    getTotalStat(statName) {
        let total = this.baseStats[statName];
        // Raça (ver races.js) — só Player tem `this.race`; Enemy/Rival nunca
        // definem esse campo, então o bônus/penalidade nunca afeta inimigos.
        if (this.race && window.RACES && window.RACES[this.race]) {
            const mod = window.RACES[this.race].statMods[statName];
            if (mod) total += mod;
        }
        for (let key in this.equipment) {
            let item = this.equipment[key];
            if (item && item.statBonuses && item.statBonuses[statName]) {
                total += item.statBonuses[statName];
            }
        }
        return total;
    }

    // Calcula Sub-atributos baseados nos atributos principais
    calculateDerivedStats() {
        const str = this.getTotalStat('str');
        const agi = this.getTotalStat('agi');
        const int = this.getTotalStat('int');
        const def = this.getTotalStat('def');
        const luk = this.getTotalStat('luk');

        let maxHp = 50 + (str * 10) + (this.level * 5);
        let maxMp = 20 + (int * 8) + (this.level * 3);

        // Fórmulas de combate
        let physicalDamage = Math.floor(str * 1.5);
        let dodgeChance = Utils.clamp((agi * 0.5) + (luk * 0.1), 0, 45); // Max 45% esquiva natural
        let critChance = Utils.clamp((agi * 0.2) + (luk * 0.5), 1, 50);
        let defenseRating = def * 2;
        let blockChance = 0;

        // Soma bônus diretos de equipamentos: dano/defesa das peças, HP/MP de
        // amuletos, crítico/precisão de armas e chance de bloqueio de escudos.
        // Dano de arma só conta da arma ATIVA (mainHand ou ranged, conforme
        // activeWeaponSlot) — equipar as duas ao mesmo tempo não deveria
        // somar o dano das duas, só dar a opção de trocar entre elas em
        // combate (ver getActiveWeapon/BattleSystem SWITCH_WEAPON).
        let currentLoad = 0;
        for (let key in this.equipment) {
            let item = this.equipment[key];
            if (item) {
                const isWeaponSlot = (key === SLOTS.MAIN_HAND || key === SLOTS.RANGED);
                // Peça "quebrada" (durabilidade zerada pelo desgaste de
                // batalha, ver battle.js endBattle) só entrega metade do
                // dano/defesa até ser reparada no Ferreiro/Armeiro.
                const wear = (item.maxDurability && item.durability <= 0) ? 0.5 : 1;
                if (item.damage && (!isWeaponSlot || key === this.activeWeaponSlot)) physicalDamage += Math.floor(item.damage * wear);
                if (item.defense) defenseRating += Math.floor(item.defense * wear);
                if (item.hpBonus) maxHp += item.hpBonus;
                if (item.mpBonus) maxMp += item.mpBonus;
                if (item.critBonus) critChance += item.critBonus;
                if (item.blockChance) blockChance += item.blockChance;
                if (item.weight) currentLoad += item.weight;
            }
        }

        // Capacidade de carga (segunda função real da Força, além do dano
        // físico): equipar peças mais pesadas do que a própria Força aguenta
        // reduz a esquiva. `item.weight` já existia em todo template de
        // items.js mas nunca era lido em lugar nenhum — Força agora também
        // define "peso carregável", não só dano.
        const carryCapacity = 15 + str * 3;
        const overloadRatio = Utils.clamp((currentLoad - carryCapacity) / carryCapacity, 0, 1);
        if (overloadRatio > 0) dodgeChance *= (1 - overloadRatio * 0.3);

        // Fadiga (acúmulo de ferimentos por derrotas): penaliza levemente
        // dano e reflexos até ser curada no Curandeiro ou com bandagem
        const fatigueStacks = this.fatigue || 0;
        const fatigueMult = 1 - (fatigueStacks * 0.08);
        physicalDamage = Math.floor(physicalDamage * fatigueMult);
        dodgeChance = dodgeChance * fatigueMult;

        // Linhagem (Mutação): soma os passivos da árvore de habilidades da
        // linhagem ativa (ver skilltrees.js) — sistema TOTALMENTE separado
        // dos encantamentos de equipamento. `this.lineage` só existe no
        // Player (Enemy/Rival nunca têm mutação), então isso não afeta em
        // nada os inimigos comuns.
        const mutation = (this.lineage && window.SkillTreeSystem) ? window.SkillTreeSystem.sumPassiveStats(this) : null;
        if (mutation) {
            if (mutation.defenseBonusPercent) defenseRating *= (1 + mutation.defenseBonusPercent / 100);
            if (mutation.dodgeBonusPercent) dodgeChance += mutation.dodgeBonusPercent;
        }

        // Traço único de raça (ver races.js `passive`) — mesmo formato dos
        // passivos de linhagem acima (statKey/value), então generaliza pra
        // qualquer chave de derivedStats sem precisar de mais nenhum caso
        // especial aqui ou em battle.js. Só Player tem `this.race` (Enemy/
        // Rival nunca definem esse campo), então nunca afeta inimigos.
        const racePassive = (this.race && window.RACES && window.RACES[this.race] && window.RACES[this.race].passive) ? window.RACES[this.race].passive : null;
        const raceBonus = (key) => (racePassive && racePassive.statKey === key) ? racePassive.value : 0;
        if (raceBonus('defenseBonusPercent')) defenseRating *= (1 + raceBonus('defenseBonusPercent') / 100);
        if (raceBonus('dodgeBonusPercent')) dodgeChance += raceBonus('dodgeBonusPercent');

        this.derivedStats.maxHp = maxHp;
        this.derivedStats.maxMp = maxMp;
        this.derivedStats.physicalDamage = physicalDamage;
        this.derivedStats.dodgeChance = Utils.clamp(dodgeChance, 0, 45);
        this.derivedStats.critChance = Utils.clamp(critChance, 1, 65);
        this.derivedStats.defenseRating = defenseRating;
        this.derivedStats.blockChance = Utils.clamp(blockChance, 0, 60);
        this.derivedStats.carryCapacity = carryCapacity;
        this.derivedStats.currentLoad = Math.round(currentLoad * 10) / 10;
        this.derivedStats.isOverloaded = overloadRatio > 0;

        // Estatísticas derivadas da Linhagem (0 se não houver mutação ativa)
        // — expostas de forma genérica pra battle.js consumir sem precisar
        // saber qual linhagem específica está ativa.
        this.derivedStats.lifestealPercent = (mutation ? mutation.lifestealPercent : 0) + raceBonus('lifestealPercent');
        this.derivedStats.hpRegenPerTurn = (mutation ? mutation.hpRegenPerTurn : 0) + raceBonus('hpRegenPerTurn');
        this.derivedStats.lowHpDamageBonusPercent = (mutation ? mutation.lowHpDamageBonusPercent : 0) + raceBonus('lowHpDamageBonusPercent');
        this.derivedStats.bleedResistPercent = (mutation ? mutation.bleedResistPercent : 0) + raceBonus('bleedResistPercent');
        this.derivedStats.drainOnCritPercent = (mutation ? mutation.drainOnCritPercent : 0) + raceBonus('drainOnCritPercent');
        this.derivedStats.healPowerBonusPercent = (mutation ? mutation.healPowerBonusPercent : 0) + raceBonus('healPowerBonusPercent');
        this.derivedStats.negativeEffectResistPercent = (mutation ? mutation.negativeEffectResistPercent : 0) + raceBonus('negativeEffectResistPercent');
        this.derivedStats.critChanceLowHpBonus = (mutation ? mutation.critChanceLowHpBonus : 0) + raceBonus('critChanceLowHpBonus');
        this.derivedStats.mutationSpecials = mutation ? mutation.specials : [];

        // Se HP/MP atual for 0 (nova entidade) ou maior que o novo máximo, ajusta.
        if (this.currentHp === 0 || this.currentHp > this.derivedStats.maxHp) {
            this.currentHp = this.derivedStats.maxHp;
        }
        if (this.currentMp === 0 || this.currentMp > this.derivedStats.maxMp) {
            this.currentMp = this.derivedStats.maxMp;
        }
    }

    // Arma "na mão" agora (mainHand corpo a corpo ou ranged, conforme
    // activeWeaponSlot) — todas as consultas de arma (dano/alcance/
    // velocidade/precisão/perfuração) passam por aqui, então trocar de arma
    // em combate (SWITCH_WEAPON) já afeta tudo automaticamente.
    getActiveWeapon() {
        return this.equipment[this.activeWeaponSlot] || null;
    }

    // Só true se houver uma arma corpo a corpo (mainHand) E uma de longo
    // alcance (ranged) equipadas ao mesmo tempo — só nesse caso faz sentido
    // mostrar a ação de trocar de arma em combate.
    hasDualWeapons() {
        return !!(this.equipment[SLOTS.MAIN_HAND] && this.equipment[SLOTS.RANGED]);
    }

    // Bônus de precisão vinda da arma equipada (usado no cálculo de acerto em batalha)
    getWeaponAccBonus() {
        const weapon = this.getActiveWeapon();
        return weapon && weapon.accBonus ? weapon.accBonus : 0;
    }

    // Fração de armadura ignorada pela arma equipada (perfuração)
    getWeaponArmorPierce() {
        const weapon = this.getActiveWeapon();
        return weapon && weapon.armorPierce ? weapon.armorPierce : 0;
    }

    // Alcance mínimo/máximo da arma equipada (punhos nus se não houver arma).
    // Funciona automaticamente para qualquer arma futura, desde que ela
    // carregue minRange/maxRange (ver items.js).
    getWeaponRange() {
        const weapon = this.getActiveWeapon();
        if (weapon && weapon.minRange !== undefined) {
            return { min: weapon.minRange, max: weapon.maxRange };
        }
        return UNARMED_RANGE;
    }

    // Velocidades de ataque/aproximação/recuo da arma equipada
    getWeaponSpeed() {
        const weapon = this.getActiveWeapon();
        if (weapon && weapon.atkSpeed !== undefined) {
            return { atkSpeed: weapon.atkSpeed, approachSpeed: weapon.approachSpeed, retreatSpeed: weapon.retreatSpeed };
        }
        return UNARMED_SPEED;
    }

    // Distribuição procedural de atributos enviesada pelo estilo de luta já
    // sorteado (ver ai_data.js `statFocus`) — antes copiada e colada quase
    // idêntica em Enemy/Vampire/Ghost (enemy.js), cada um só variando a
    // fórmula de `totalPoints` por nível. Sem `statFocus` (estilo
    // desconhecido), cai de volta pro sorteio uniforme entre todos os atributos.
    generateStatsFromStyle(totalPoints) {
        const statsArray = Object.keys(this.baseStats);
        const focus = this.aiStyle && this.aiStyle.statFocus;
        const weightedPool = [];
        statsArray.forEach(stat => {
            const weight = focus ? (focus[stat] || 1) : 1;
            for (let w = 0; w < weight; w++) weightedPool.push(stat);
        });
        for (let i = 0; i < totalPoints; i++) {
            const randomStat = weightedPool[Utils.randomInt(0, weightedPool.length - 1)];
            this.baseStats[randomStat]++;
        }
        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
    }

    // Equipa arma (+ escudo, se o estilo preferir um) coerentes com o estilo
    // de luta já sorteado — antes copiada e colada quase idêntica em Enemy/
    // Vampire/Ghost, cada um só variando `rarityChancePercent`. Só o Duelo
    // Rápido comum (Enemy) tinha chance de a arma sair encantada (ver
    // Enemy.maybeEnchantWeapon) simplesmente porque Vampire/Ghost tinham sua
    // própria cópia colada dessa função, sem a chamada; `enchantChancePercent`
    // (0 por padrão) deixa qualquer subclasse optar por essa chance também.
    equipStyleWeaponGeneric(rarityChancePercent, enchantChancePercent = 0) {
        const styleId = this.aiStyle ? this.aiStyle.id : 'espadachim';
        const weaponId = window.AICombat.pickWeaponFromStyle(styleId);
        const rarity = Utils.chance(rarityChancePercent) ? RARITY.UNCOMMON : RARITY.COMMON;
        this.equipment[SLOTS.MAIN_HAND] = ItemFactory.createEquipment(weaponId, 'weapons', rarity);
        if (enchantChancePercent > 0 && typeof Enemy !== 'undefined') {
            Enemy.maybeEnchantWeapon(this.equipment[SLOTS.MAIN_HAND], enchantChancePercent);
        }
        const shieldId = window.AICombat.pickShieldFromStyle(styleId);
        if (shieldId) this.equipment[SLOTS.OFF_HAND] = ItemFactory.createEquipment(shieldId, 'shields', rarity);
        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
    }
}

class Player extends Entity {
    constructor(name) {
        super(name);
        this.exp = 0;
        this.gold = 100;
        this.bankGold = 0; // Ouro guardado no Banco da cidade — fica de fora de `gold` (o que se carrega)
        this.inventory = [];
        this.inventoryCapacity = 20; // Expansível com mochilas/força no futuro

        this.statPoints = 0;   // Pontos de atributo por nível (distribuição manual)
        this.skillPoints = 0;  // Pontos de talento por nível
        this.learnedSkills = []; // IDs das habilidades aprendidas
        // skillCooldowns já vem inicializado do construtor de Entity

        this.fatigue = 0; // 0-3 estágios de fadiga acumulados por derrotas
        this.nightsWithoutSleep = 0; // zera ao dormir no Curandeiro (ver ui.js healFatigue); a cada 3 noites sem dormir, +1 fadiga automática (ver city.js _updateDayCycle)
        this.wins = 0;
        this.losses = 0;
        this.rivalsDefeated = []; // IDs dos rivais da ladder já derrotados
        this.achievements = []; // IDs das conquistas desbloqueadas
        this.achievementDates = {}; // ID da conquista -> timestamp de desbloqueio
        this.playTimeSeconds = 0; // tempo jogado acumulado, usado na tela de saves

        this.visuals = {
            gender: 'Masculino',
            skinTone: '#ffcc99',
            hairStyle: 1,
            hairColor: '#2a1c10',
            beardStyle: 0,     // 0 = nenhuma; ver UIManager.beardOptions (12 estilos) em ui.js
            beardColor: '#2a1c10',
            eyebrowColor: '#2a1c10',
            eyeColor: '#1a1a1a',
            faceShape: 1,      // 1 = redondo, 2 = oval, 3 = anguloso
            archetype: 'veterano', // identidade visual (silhueta/paleta) — ver FIGHTER_ARCHETYPES em graphics.js
            scarStyle: 0       // 0 = nenhuma; ver SCAR_STYLES em graphics.js
        };

        // Raça (ver races.js) — escolhida uma única vez na Criação de
        // Personagem, diferente da Linhagem (conquistada durante a
        // campanha). 'humano' é o padrão neutro pra saves antigos, que
        // nunca tiveram esse campo.
        this.race = 'humano';

        // Cidade-Hub atual (ver citydatabase.js/city.js CityEngine.travelToCity)
        // — 'porto_helenico' é o padrão neutro pra saves antigos, que nunca
        // tiveram esse campo (mesmo padrão de compatibilidade de `race`).
        this.currentCityId = window.DEFAULT_CITY_ID || 'porto_helenico';
        // Cidades já visitadas (ver conquista 'world_explorer' abaixo e
        // CityEngine.travelToCity) — começa só com a cidade inicial, já que
        // o personagem sempre nasce lá.
        this.visitedCityIds = [window.DEFAULT_CITY_ID || 'porto_helenico'];

        // --- Linhagem (Mutação) — ver lineages.js/skilltrees.js/rituals.js ---
        // Sistema TOTALMENTE separado de Encantamentos (que ficam só nos
        // itens, ver enchantments.js). Uma única linhagem por personagem,
        // para sempre, adquirida ao vencer o boss do ritual correspondente.
        this.lineage = null;              // null = nenhuma mutação despertada ainda
        this.lineageAwakenedAt = null;    // timestamp de quando despertou (exibido no menu Mutações)
        this.mutationSkillPoints = 0;     // pontos pra desbloquear nós da árvore da linhagem
        this.skillTreeUnlocked = {};      // { nodeId: true } — nós já desbloqueados (qualquer árvore)
        this.bossesDefeated = [];         // IDs de bosses de ritual derrotados (Conde Vampiro, Anjo Guardião...)
        // Progresso de cada ritual, independente de qual linhagem o jogador
        // já despertou — permite acompanhar o progresso de descoberta de
        // TODAS as linhagens ainda não obtidas ao mesmo tempo.
        this.ritualProgress = {
            vampirismo: { vampiricEssences: 0 },
            luz: { potionsUsed: 0, noMagicWins: 0, sacredFragments: 0 }
        };
    }

    addFatigue(amount) {
        this.fatigue = Utils.clamp((this.fatigue || 0) + amount, 0, 3);
        this.calculateDerivedStats();
    }

    cureFatigue(amount) {
        this.fatigue = Utils.clamp((this.fatigue || 0) - amount, 0, 3);
        this.calculateDerivedStats();
    }

    unlockAchievement(id) {
        if (!this.achievements.includes(id)) {
            this.achievements.push(id);
            if (!this.achievementDates) this.achievementDates = {};
            this.achievementDates[id] = Date.now();
            return true;
        }
        return false;
    }

    // Aplica o efeito de um consumível e o remove do inventário
    useConsumable(index) {
        const item = this.inventory[index];
        if (!item || item.category !== 'consumable') return null;

        let message = '';
        if (item.type === 'HEAL_HP') {
            // Poder de cura da Linhagem (Luz) também fortalece poções, não só
            // magias de cura — reforça a especialidade "cura" da árvore inteira.
            const healMult = 1 + ((this.derivedStats.healPowerBonusPercent || 0) / 100);
            const before = this.currentHp;
            this.currentHp = Utils.clamp(this.currentHp + Math.floor(item.power * healMult), 0, this.derivedStats.maxHp);
            message = `Recuperou ${this.currentHp - before} HP`;
            // Ritual da Luz: conta poções de cura usadas (ver rituals.js) —
            // silenciosamente, mesmo antes de a Linhagem existir.
            if (window.RitualSystem) window.RitualSystem.onPotionUsed(this);
        } else if (item.type === 'HEAL_MP') {
            const before = this.currentMp;
            this.currentMp = Utils.clamp(this.currentMp + item.power, 0, this.derivedStats.maxMp);
            message = `Recuperou ${this.currentMp - before} MP`;
        } else if (item.type === 'CURE_FATIGUE') {
            this.cureFatigue(item.power);
            message = `Curou ${item.power} nível(is) de fadiga`;
        }

        this.inventory.splice(index, 1);
        return { name: item.name, message };
    }

    gainExp(amount) {
        this.exp += amount;
        // Repete enquanto o excedente ainda cobrir o próximo nível, preservando o
        // resto (em vez de descartá-lo) e permitindo múltiplos níveis de uma vez
        // quando a recompensa de uma única batalha for grande o suficiente.
        while (this.exp >= this.getExpRequired()) {
            this.exp -= this.getExpRequired();
            this.levelUp();
        }
    }

    getExpRequired() {
        return Math.floor(100 * Math.pow(1.5, this.level - 1));
    }

    levelUp() {
        this.level++;
        this.statPoints += 3;  // Ganha 3 pontos para distribuir por nível
        this.skillPoints += 1; // 1 Ponto de Talento por nível
        this.calculateDerivedStats();
        console.log(`Level Up! Nível atual: ${this.level}. +3 Stats, +1 Skill Point`);
    }

    learnSkill(skillId) {
        if (!this.learnedSkills.includes(skillId)) {
            this.learnedSkills.push(skillId);
            return true;
        }
        return false;
    }

    // setSkillCooldown/isSkillReady/tickCooldowns agora vêm de Entity

    // Avalia as conquistas com base no estado atual + contexto do evento que acabou
    // de acontecer (fim de batalha, loot recebido, etc), retornando as recém-desbloqueadas.
    checkAchievements(context = {}) {
        const unlocked = [];
        const tryUnlock = (id) => { if (this.unlockAchievement(id)) unlocked.push(AchievementDB[id]); };

        if (context.victory && this.wins >= 1) tryUnlock('first_blood');
        if (this.wins >= 10) tryUnlock('unbreakable');
        if (this.level >= 5) tryUnlock('veteran');
        if (this.level >= 10) tryUnlock('legend');
        if (context.victory && context.hpPercent !== undefined && context.hpPercent > 0 && context.hpPercent <= 0.1) tryUnlock('survivor');
        if (context.gotLegendary) tryUnlock('legendary_finder');
        if (context.defeatedRivalId === 'bronze_champion') tryUnlock('champion_bronze');
        if (context.defeatedRivalId === 'silver_champion') tryUnlock('champion_silver');
        if (context.defeatedRivalId === 'gold_champion') tryUnlock('champion_gold');
        if (context.awakenedLineage) tryUnlock('lineage_awakened');
        if (context.defeatedElite) tryUnlock('elite_hunter');
        if (context.visitedAllCities) tryUnlock('world_explorer');

        return unlocked;
    }
}

// Banco de Conquistas (título + descrição + raridade exibidos na tela de
// Conquistas). `goal` habilita uma barra de progresso (current/goal) pras
// conquistas cumulativas; conquistas sem `goal` são binárias (feito ou não).
const AchievementDB = {
    first_blood: { id: 'first_blood', name: 'Primeiro Sangue', description: 'Vença sua primeira batalha.', rarity: 'comum', icon: '⚔️' },
    veteran: { id: 'veteran', name: 'Veterano', description: 'Alcance o nível 5.', rarity: 'comum', icon: '🛡️', goal: 5, progress: p => p.level },
    legend: { id: 'legend', name: 'Lenda Viva', description: 'Alcance o nível 10.', rarity: 'raro', icon: '👑', goal: 10, progress: p => p.level },
    unbreakable: { id: 'unbreakable', name: 'Inquebrável', description: 'Vença 10 batalhas.', rarity: 'raro', icon: '💪', goal: 10, progress: p => p.wins || 0 },
    survivor: { id: 'survivor', name: 'Sobrevivente', description: 'Vença uma batalha com 10% de HP ou menos.', rarity: 'épico', icon: '❤️' },
    legendary_finder: { id: 'legendary_finder', name: 'Caçador de Lendas', description: 'Obtenha um item Lendário.', rarity: 'épico', icon: '💎' },
    champion_bronze: { id: 'champion_bronze', name: 'Campeão de Bronze', description: 'Derrote o Campeão da Liga de Bronze.', rarity: 'raro', icon: '🥉' },
    champion_silver: { id: 'champion_silver', name: 'Campeão de Prata', description: 'Derrote o Campeão da Liga de Prata.', rarity: 'épico', icon: '🥈' },
    champion_gold: { id: 'champion_gold', name: 'Campeão de Ouro', description: 'Derrote o Campeão da Liga de Ouro.', rarity: 'lendário', icon: '🥇' },
    lineage_awakened: { id: 'lineage_awakened', name: 'Sangue Renovado', description: 'Derrote um boss de Ritual e desperte sua Linhagem.', rarity: 'lendário', icon: '🧬' },
    elite_hunter: { id: 'elite_hunter', name: 'Caçador de Elites', description: 'Derrote um inimigo Elite no Duelo Rápido.', rarity: 'épico', icon: '⭐' },
    // Cidades-Hub Regionais (ver citydatabase.js/city.js travelToCity) — a
    // única conquista que não é checada em checkAchievements(context) vindo
    // de uma batalha, e sim diretamente de travelToCity, já que viajar não
    // acontece em combate nenhum.
    world_explorer: { id: 'world_explorer', name: 'Explorador do Mundo', description: 'Visite todas as Cidades-Hub conhecidas.', rarity: 'épico', icon: '🗺️', goal: Object.keys(window.CityDatabase || {}).length || 1, progress: p => (p.visitedCityIds || []).length }
};

window.AchievementDB = AchievementDB;
