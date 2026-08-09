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

    // Regeneração passiva de mana por turno — REMOVIDA (pedido explícito do
    // usuário: "o player recupera mana em movimentos que não são a defesa e
    // isso tá tornando a mana praticamente infinita"). Existiu antes desta
    // mudança (8%, depois reduzida pra 5% numa tentativa anterior de
    // conter o problema — ver histórico do arquivo), chamada
    // incondicionalmente todo turno em executePlayerTurn/executeEnemyTurn
    // (battle.js) não importa a ação escolhida — mesmo atacando ou usando
    // magia, o jogador sempre recuperava mana de graça, e reduzir a
    // porcentagem só adiava o problema, nunca o resolvia de verdade. Agora
    // mana só volta de duas formas, nenhuma automática: Defender (ver
    // BattleEngine._resolveDefend, sempre menos que uma Poção de Mana) ou
    // consumíveis (ver Player.useConsumable, item HEAL_MP).

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

    // Mega Atualização (item 3/4): "comprar ≠ equipar" — checa
    // `requiredLevel`/`requiredStats` (já calculados no próprio item, ver
    // items.js Equipment) contra o estado ATUAL desta entidade. Vive em
    // Entity (não só Player) de propósito: a geração procedural de
    // equipamento de inimigos (item 12/13 da diretiva, iteração futura)
    // reaproveita exatamente esta função pra nunca dar a um inimigo uma
    // arma que ele mesmo não atende os requisitos — mesma checagem, sem
    // duplicar lógica entre jogador e inimigo. NUNCA usado na compra (ver
    // ui.js openShop, que continua sem nenhum gate de nível/atributo) —
    // só no momento de EQUIPAR de fato.
    canEquip(item) {
        if (!item || item.category !== 'equipment') return { ok: true, missing: [] };
        const missing = [];
        if (this.level < item.requiredLevel) missing.push(`Nível ${item.requiredLevel}`);
        if (item.requiredStats) {
            for (const stat in item.requiredStats) {
                if (this.getTotalStat(stat) < item.requiredStats[stat]) {
                    missing.push(`${item.requiredStats[stat]} ${stat.toUpperCase()}`);
                }
            }
        }
        return { ok: missing.length === 0, missing };
    }

    // Calcula Sub-atributos baseados nos atributos principais
    calculateDerivedStats() {
        const str = this.getTotalStat('str');
        const agi = this.getTotalStat('agi');
        const int = this.getTotalStat('int');
        const def = this.getTotalStat('def');
        const luk = this.getTotalStat('luk');

        // Rebalanceamento pedido pelo usuário: batalhas contra inimigos comuns
        // demoravam demais. HP "padrão" (base + nível) cortado bem mais forte
        // do que o multiplicador por ponto de Força, que sobe um pouco — quem
        // não investe em Força sente uma queda grande de vida (batalhas mais
        // rápidas no caso comum), quem investe pesado continua com bastante
        // vida (o ponto de Força vale mais agora, não menos).
        let maxHp = 15 + (str * 11) + (this.level * 3);
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
                // Bug de auditoria: critBonus somava de QUALQUER arma
                // equipada, sem o mesmo filtro de arma ATIVA que já existia
                // pra damage (ver comentário acima) — trocar pra arco/besta
                // (activeWeaponSlot = RANGED) mantinha de graça o bônus de
                // crítico de uma adaga/rapieira/lâmina no MAIN_HAND, mesmo
                // sem lutar com ela.
                if (item.critBonus && (!isWeaponSlot || key === this.activeWeaponSlot)) critChance += item.critBonus;
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

        // Linhagem SECUNDÁRIA da Natureza (ver nature.js) — soma
        // independente da PRINCIPAL acima, já que as duas podem estar
        // ativas ao mesmo tempo (Natureza nunca ocupa `this.lineage`). Só
        // contribui de verdade enquanto o Amuleto do Guardião estiver
        // equipado (ver NatureSystem.isActive/sumSecondaryPassiveStats).
        const secondaryMutation = (this.secondaryLineage && window.SkillTreeSystem) ? window.SkillTreeSystem.sumSecondaryPassiveStats(this) : null;
        if (secondaryMutation) {
            if (secondaryMutation.defenseBonusPercent) defenseRating *= (1 + secondaryMutation.defenseBonusPercent / 100);
            if (secondaryMutation.dodgeBonusPercent) dodgeChance += secondaryMutation.dodgeBonusPercent;
        }

        // Traço único de raça (ver races.js `passive`) — mesmo formato dos
        // passivos de linhagem acima (statKey/value), então generaliza pra
        // qualquer chave de derivedStats sem precisar de mais nenhum caso
        // especial aqui ou em battle.js. Só Player tem `this.race` (Enemy/
        // Rival nunca definem esse campo), então nunca afeta inimigos.
        const racePassive = (this.race && window.RACES && window.RACES[this.race] && window.RACES[this.race].passive) ? window.RACES[this.race].passive : null;
        const raceBonus = (key) => (racePassive && racePassive.statKey === key) ? racePassive.value : 0;

        // Bônus TEMPORÁRIOS de consumíveis regionais (Hidromel/Banquete
        // Anão/Runas do Reino Anão — ver items.js TEMP_BUFF, useConsumable
        // acima) — mesmo formato statKey/amount dos passivos de raça/
        // mutação acima, reaproveitando a mesma infraestrutura em vez de
        // criar um sistema de buff paralelo (Rework Econômico item 16).
        // Filtra buffs vencidos comparando com o dia atual ANTES de somar
        // — não precisa remover ativamente daqui pra parar de contar, só
        // decai sozinho conforme os dias passam (ver CityEngine.
        // advanceToNewDay, que também faz a limpeza física do array).
        // `>` (não `>=`): comprado no dia D com durationDays=1 grava
        // expiresAtDay=D+1 — deve continuar ativo pelo RESTO do dia D
        // (currentDay ainda === D) e sumir assim que o dia VIRAR pra D+1
        // (currentDay === expiresAtDay). Com `>=` o buff sobrevivia a uma
        // virada de dia inteira a mais do que "dura 1 dia" prometia (bug
        // encontrado em teste, ver /tmp/pw/test_dwarf_identity_iter2.js).
        const currentDay = (window.City && window.City.dayCount) || 0;
        const activeBuffs = (this.activeBuffs || []).filter(b => b.expiresAtDay > currentDay);
        const buffBonus = (key) => activeBuffs.reduce((sum, b) => sum + (b.statKey === key ? b.amount : 0), 0);

        const totalDefenseBonusPercent = raceBonus('defenseBonusPercent') + buffBonus('defenseBonusPercent');
        if (totalDefenseBonusPercent) defenseRating *= (1 + totalDefenseBonusPercent / 100);
        const totalDodgeBonusPercent = raceBonus('dodgeBonusPercent') + buffBonus('dodgeBonusPercent');
        if (totalDodgeBonusPercent) dodgeChance += totalDodgeBonusPercent;
        // Bônus fixos (Banquete Anão/Runa de Força/Cristal de Clareza
        // élfico) — sem equivalente percentual nos passivos de raça/
        // mutação, então somam direto.
        defenseRating += buffBonus('defenseRatingFlat');
        physicalDamage += buffBonus('physicalDamageFlat');
        maxMp += buffBonus('maxMpFlat');

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
        // saber qual linhagem específica está ativa. Soma PRINCIPAL +
        // SECUNDÁRIA (Natureza) + raça, as três fontes empilham livremente.
        const sec = (key) => secondaryMutation ? (secondaryMutation[key] || 0) : 0;
        this.derivedStats.lifestealPercent = (mutation ? mutation.lifestealPercent : 0) + sec('lifestealPercent') + raceBonus('lifestealPercent');
        this.derivedStats.hpRegenPerTurn = (mutation ? mutation.hpRegenPerTurn : 0) + sec('hpRegenPerTurn') + raceBonus('hpRegenPerTurn');
        this.derivedStats.lowHpDamageBonusPercent = (mutation ? mutation.lowHpDamageBonusPercent : 0) + sec('lowHpDamageBonusPercent') + raceBonus('lowHpDamageBonusPercent');
        this.derivedStats.bleedResistPercent = (mutation ? mutation.bleedResistPercent : 0) + sec('bleedResistPercent') + raceBonus('bleedResistPercent');
        this.derivedStats.drainOnCritPercent = (mutation ? mutation.drainOnCritPercent : 0) + sec('drainOnCritPercent') + raceBonus('drainOnCritPercent');
        // Poeira de Estrelas élfica (TEMP_BUFF, ver items.js) soma aqui
        // igual às outras fontes — mesmo agregado, sem caso especial.
        this.derivedStats.healPowerBonusPercent = (mutation ? mutation.healPowerBonusPercent : 0) + sec('healPowerBonusPercent') + raceBonus('healPowerBonusPercent') + buffBonus('healPowerBonusPercent');
        // Sorte ganha aqui uma das interações pedidas na revisão profunda
        // (item 10: "chance de evitar certos efeitos") — nunca mais dano,
        // só resistência real a atordoamento/lentidão/maldição (ver
        // negResist em battle.js, já usado simetricamente por
        // jogador/inimigo). 0.4% de resistência por ponto de Sorte é
        // modesto o bastante pra nunca competir com os bônus "de verdade"
        // de mutação/raça (que chegam a dezenas de %), mas dá um motivo
        // concreto pra investir em Sorte fora de crítico/esquiva/loot —
        // ninguém quer levar Atordoar/Sangramento/Maldição toda vez.
        this.derivedStats.negativeEffectResistPercent = (mutation ? mutation.negativeEffectResistPercent : 0) + sec('negativeEffectResistPercent') + raceBonus('negativeEffectResistPercent') + (luk * 0.4);
        this.derivedStats.critChanceLowHpBonus = (mutation ? mutation.critChanceLowHpBonus : 0) + sec('critChanceLowHpBonus') + raceBonus('critChanceLowHpBonus');
        this.derivedStats.mutationSpecials = [...(mutation ? mutation.specials : []), ...(secondaryMutation ? secondaryMutation.specials : [])];

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

    // A OUTRA arma (a que não está ativa agora) — usada pela IA (ver
    // AICombat.decideAction/_buildCandidates em ai.js) pra avaliar se vale
    // a pena trocar antes de efetivamente trocar.
    getInactiveWeapon() {
        const otherSlot = this.activeWeaponSlot === SLOTS.MAIN_HAND ? SLOTS.RANGED : SLOTS.MAIN_HAND;
        return this.equipment[otherSlot] || null;
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
        return this.getWeaponRangeFor(this.getActiveWeapon());
    }

    // Igual a getWeaponRange(), mas pra uma arma ARBITRÁRIA (não precisa ser
    // a ativa agora) — usada pela IA (ver AICombat.decideAction/
    // _buildCandidates em ai.js) pra avaliar se a arma de RESERVA (ver
    // getInactiveWeapon) resolveria o alcance atual antes de trocar.
    getWeaponRangeFor(weapon) {
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
    // Mega Atualização item 12/13: `rarityChancePercent` (0-100+, herdado da
    // fórmula que cada chamador já calculava — Enemy.equipStyleWeapon,
    // Vampire.equipStyleWeapon) agora alimenta ItemFactory.rollGearRarity
    // (5 raridades ponderadas por "força" do inimigo, em vez do sorteio
    // binário Comum/Incomum de antes) e createEquipmentWithRarityCap
    // (nunca deixa a arma sorteada exigir mais do que a própria entidade
    // atende, ver Entity.canEquip). O nome do parâmetro ficou o mesmo de
    // propósito — todo chamador já passava um número 0-100 nessa escala,
    // não precisou mudar nenhum call site.
    equipStyleWeaponGeneric(rarityChancePercent, enchantChancePercent = 0) {
        const styleId = this.aiStyle ? this.aiStyle.id : 'espadachim';
        const weaponId = window.AICombat.pickWeaponFromStyle(styleId);
        const weapon = ItemFactory.createEquipmentForEntity(this, weaponId, 'weapons', rarityChancePercent);
        // Bug de auditoria (sistema de duas armas): a arma sempre era gravada
        // em equipment[SLOTS.MAIN_HAND] aqui, mesmo quando o próprio item já
        // carrega slot:SLOTS.RANGED (arco/besta, ver items.js) — um Arqueiro
        // nascia com o arco guardado na CHAVE errada do dicionário de
        // equipamento. Não quebrava o ataque (getActiveWeapon() lê por
        // activeWeaponSlot, ajustado logo abaixo pra sempre acompanhar onde
        // a arma REALMENTE está), mas hasDualWeapons() (checa
        // equipment[MAIN_HAND] && equipment[RANGED] literalmente) nunca via
        // essa arma como a principal corpo a corpo — nenhum inimigo
        // conseguia ter duas armas de verdade, e qualquer código que lesse
        // equipment[SLOTS.RANGED] direto (em vez de getActiveWeapon())
        // simplesmente não enxergava o arco do Arqueiro.
        this.equipment[weapon.slot] = weapon;
        this.activeWeaponSlot = weapon.slot;
        if (enchantChancePercent > 0 && typeof Enemy !== 'undefined') {
            Enemy.maybeEnchantWeapon(weapon, enchantChancePercent);
        }
        const shieldId = window.AICombat.pickShieldFromStyle(styleId);
        if (shieldId) this.equipment[SLOTS.OFF_HAND] = ItemFactory.createEquipmentForEntity(this, shieldId, 'shields', rarityChancePercent);

        // Arma secundária (sistema de duas armas, pedido de balanceamento
        // item 2): complementa a principal com uma arma de categoria OPOSTA
        // (corpo a corpo <-> longo alcance) — nunca duas do mesmo tipo, pra
        // que a troca em combate (ver AICombat.decideAction/SWITCH_WEAPON
        // em ai.js) sempre signifique uma mudança tática real de alcance.
        // Chance-gated (nem todo combatente carrega uma reserva) e nunca
        // sobrescreve o slot da arma principal.
        this.maybeEquipSecondaryWeapon(styleId, rarityChancePercent);

        this.calculateDerivedStats();
        this.currentHp = this.derivedStats.maxHp;
        this.currentMp = this.derivedStats.maxMp;
    }

    // Ver comentário em equipStyleWeaponGeneric acima. 35% de chance de
    // carregar uma arma de reserva de categoria oposta à principal — usado
    // por Enemy/Vampire/Ghost (chamam este método com um strengthScore) e
    // por Rival.equipGear (enemy.js, chamado com a raridade curada já
    // resolvida por createEquipmentWithRarityCap — ver lá).
    maybeEquipSecondaryWeapon(styleId, rarityChancePercent) {
        if (!window.AICombat || !Utils.chance(35)) return;
        const secondaryId = window.AICombat.pickSecondaryWeaponFromStyle(styleId);
        if (!secondaryId) return;
        const secondary = ItemFactory.createEquipmentForEntity(this, secondaryId, 'weapons', rarityChancePercent);
        if (secondary.slot === this.activeWeaponSlot) return; // nunca a mesma categoria da principal
        this.equipment[secondary.slot] = secondary;
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

        // Mega Atualização item 14/15: Depósito de Itens do Banco — SEM
        // limite de capacidade de propósito (a diretiva pede que equipamento
        // guardado "nunca desapareça"; um teto aqui só recriaria o mesmo
        // problema de espaço que a Mochila já tem, contrariando o ponto do
        // Banco existir). Só EQUIPAMENTO (arma/armadura/escudo/amuleto —
        // `category === 'equipment'`) pode ser depositado, nunca consumíveis
        // nem matéria-prima (ver ui.js bankDepositItem) — a diretiva descreve
        // o depósito em termos de "armas, armaduras, itens especiais,
        // equipamentos raros", nunca poções ou minério.
        this.bankItems = [];

        this.statPoints = 0;   // Pontos de atributo por nível (distribuição manual)
        this.skillPoints = 0;  // Pontos de talento por nível
        this.learnedSkills = []; // IDs das habilidades aprendidas

        // Loadout de batalha (pedido de balanceamento): `learnedSkills` acima
        // continua sendo TUDO que já foi aprendido/desbloqueado pra sempre —
        // estas duas listas são o SUBCONJUNTO equipado pra uso em batalha
        // (ver window.SKILL_LOADOUT_LIMITS em skills.js: 3 comuns + 2 de
        // árvore de Linhagem). Começam `null`, não `[]`, de propósito: é
        // assim que `_ensureSkillLoadout()` abaixo distingue "save antigo,
        // de antes desta feature existir" (chave ausente no JSON, então
        // `Object.assign` nunca sobrescreve o `null` do construtor) de "save
        // novo que deliberadamente deixou tudo desequipado" (chave presente
        // como `[]`, `Object.assign` sobrescreve o `null` normalmente).
        this.equippedCommonSkills = null;
        this.equippedMutationSkills = null;
        // skillCooldowns já vem inicializado do construtor de Entity

        this.fatigue = 0; // 0-3 estágios de fadiga acumulados por derrotas
        this.nightsWithoutSleep = 0; // zera ao dormir no Curandeiro (ver ui.js healFatigue); a cada 3 noites sem dormir, +1 fadiga automática (ver city.js _updateDayCycle)
        this.wins = 0;
        this.losses = 0;
        this.rivalsDefeated = []; // IDs dos rivais da ladder já derrotados
        this.achievements = []; // IDs das conquistas desbloqueadas
        this.achievementDates = {}; // ID da conquista -> timestamp de desbloqueio
        this.playTimeSeconds = 0; // tempo jogado acumulado, usado na tela de saves

        // Bug de auditoria (item #8 do novo pedido — "melhorar
        // persistência"): CityEngine.dayCount (ver city.js) SEMPRE nascia
        // travado em 1 no construtor, e nenhum lugar do jogo jamais o lia
        // de volta de algum lugar persistido — a cada F5/refresh (que
        // recria o CityEngine do zero), o contador de dias voltava pra 1,
        // mesmo o jogador já tendo passado dezenas de dias na campanha.
        // Como o Quadro de Missões (ver quests.js `expiresAtDay`) calcula o
        // prazo de uma missão como um número ABSOLUTO de dia
        // (dayCount + timeLimitDays no momento de aceitar), um refresh no
        // meio do prazo fazia o contador "voltar no tempo" — uma missão
        // aceita no dia 40 com prazo de 5 dias (expira no dia 45) passava a
        // precisar de 44 dias NOVOS pra expirar depois de um refresh no dia
        // 41, em vez dos 4 dias restantes pretendidos. Persistir o dia
        // aqui (ver city.js onEnterCity/advanceToNewDay, que agora
        // restauram/sincronizam esse valor) corrige de vez — 1 é o padrão
        // neutro pra saves antigos, que nunca tiveram esse campo.
        this.dayCount = 1;

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

        // Viagem manual em andamento (ver roads.js RoadSystem) — null quando
        // o jogador não está no meio de uma travessia por terra entre
        // cidades. Alternativa à viagem rápida do Viajante do Portão (que
        // continua existindo, intacta): aqui a distância é percorrida em
        // etapas reais, com risco/eventos no caminho, em vez de instantânea.
        // null é o padrão neutro pra saves antigos, que nunca tiveram esse
        // campo — carregar um save assim nunca deixa o jogador "preso" numa
        // viagem que nunca existiu.
        this.roadJourney = null;

        // --- Linhagem (Mutação) — ver lineages.js/skilltrees.js/rituals.js ---
        // Sistema TOTALMENTE separado de Encantamentos (que ficam só nos
        // itens, ver enchantments.js). Uma única linhagem por personagem,
        // para sempre, adquirida ao vencer o boss do ritual correspondente.
        this.lineage = null;              // null = nenhuma mutação despertada ainda
        this.lineageAwakenedAt = null;    // timestamp de quando despertou (exibido no menu Mutações)
        this.mutationSkillPoints = 0;     // pontos pra desbloquear nós da árvore da linhagem
        this.skillTreeUnlocked = {};      // { nodeId: true } — nós já desbloqueados (qualquer árvore)
        this.bossesDefeated = [];         // IDs de bosses de ritual derrotados (Conde Vampiro, Anjo Guardião...)

        // Linhagem SECUNDÁRIA da Natureza (ver nature.js) — NUNCA ocupa
        // `this.lineage` acima, de propósito: pode coexistir com QUALQUER
        // linhagem principal (ou nenhuma). Vive metade nesses campos, metade
        // no item real do Amuleto do Guardião (slot AMULET) — o amuleto
        // precisa estar DE FATO equipado pra os poderes valerem (ver
        // NatureSystem.isActive), mas o progresso salvo aqui nunca se perde
        // só por desequipar/vender o amuleto. null/0 são o padrão neutro pra
        // saves antigos, que nunca tiveram este sistema.
        this.secondaryLineage = null;
        this.secondaryLineageAwakenedAt = null;
        this.natureSkillPoints = 0;       // pool PRÓPRIO, separado de mutationSkillPoints acima
        // Progresso de cada ritual, independente de qual linhagem o jogador
        // já despertou — permite acompanhar o progresso de descoberta de
        // TODAS as linhagens ainda não obtidas ao mesmo tempo.
        this.ritualProgress = {
            vampirismo: { vampiricEssences: 0 },
            luz: { potionsUsed: 0, noMagicWins: 0, sacredFragments: 0 }
        };

        // --- Missões Secundárias (ver quests.js) ---
        // activeQuests: instanceId -> instância completa (ver
        // QuestSystem.acceptQuest); completedQuestIds/failedQuestIds:
        // defId (únicas) ou instanceId (procedurais), nunca reaproveitados.
        this.activeQuests = {};
        this.completedQuestIds = [];
        this.failedQuestIds = [];

        // --- Reputação (ver reputation.js ReputationSystem) ---
        // UM ÚNICO número global (pedido explícito do usuário: nunca
        // reputação separada por cidade) — positivo, neutro ou negativo,
        // sem limite artificial nas pontas. Era um objeto `{cityId:
        // número}` antes deste sistema existir; ReputationSystem._ensureFields
        // migra saves antigos automaticamente (soma dos valores por cidade
        // num único total) na primeira leitura, então declarar `0` aqui
        // documenta só o formato NOVO — nunca quebra um save anterior.
        this.reputation = 0;
        this.reputationLog = []; // histórico curto de mudanças recentes, pro HUD (ver ReputationSystem._recordAndNotify)
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
        } else if (item.type === 'TEMP_BUFF') {
            // Hidromel/Banquete/Runas do Reino Anão (ver items.js) — efeito
            // FIXO e temporário, mesmo formato statKey/amount dos passivos
            // de raça/mutação (ver calculateDerivedStats), nunca escala com
            // atributo nenhum. Expira sozinho comparando `expiresAtDay` com
            // `window.City.dayCount` a cada recálculo, sem precisar de timer.
            if (!this.activeBuffs) this.activeBuffs = [];
            const currentDay = (window.City && window.City.dayCount) || 0;
            const durationDays = item.durationDays || 1;
            this.activeBuffs.push({ statKey: item.statKey, amount: item.buffAmount, expiresAtDay: currentDay + durationDays });
            message = `Efeito ativo por ${durationDays} dia(s)`;
            // Estimulantes de "uso pesado" da Fortaleza Orc (ver items.js
            // orc_wild_stimulant) — risco real de fadiga, reaproveitando
            // Player.addFatigue (item 16: não inventar sistema de custo
            // novo). `riskFatigueChance`/`riskFatigueAmount` só existem
            // nesse tipo de item — undefined em qualquer outro consumível,
            // então este bloco nunca roda fora do Estimulante Selvagem.
            if (item.riskFatigueChance && Utils.chance(item.riskFatigueChance)) {
                this.addFatigue(item.riskFatigueAmount || 1);
                message += ` — o corpo sobrecarregou (+${item.riskFatigueAmount || 1} fadiga)`;
            }
            this.calculateDerivedStats();
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
        // Bug de auditoria corrigido: `mutationSkillPoints` (pontos da árvore
        // de Linhagem, ver skilltrees.js) só era concedido UMA VEZ — os +3
        // fixos de lineages.js `awaken()`, no momento do despertar — e nunca
        // mais depois disso, em nenhum outro lugar do código. Como as
        // árvores de Vampirismo/Luz têm ~15 nós somando ~20 de custo total,
        // o jogador ficava permanentemente travado em 3 pontos pro resto da
        // campanha assim que os gastava: um beco sem saída de progressão,
        // não uma limitação intencional. Espelha o MESMO padrão já usado
        // por `skillPoints` acima (+1 por nível), só que condicionado a já
        // ter despertado uma Linhagem — sem isso, nenhuma árvore existe
        // ainda pra gastar o ponto, e o jogador não tem `lineage` definido.
        if (this.lineage) this.mutationSkillPoints = (this.mutationSkillPoints || 0) + 1;
        // Mesmo padrão acima, só que pro pool PRÓPRIO da Linhagem
        // SECUNDÁRIA da Natureza (ver nature.js/skilltrees.js) — os dois
        // pools crescem de forma totalmente independente, já que as duas
        // linhagens podem estar ativas ao mesmo tempo.
        if (this.secondaryLineage) this.natureSkillPoints = (this.natureSkillPoints || 0) + 1;
        this.calculateDerivedStats();
        console.log(`Level Up! Nível atual: ${this.level}. +3 Stats, +1 Skill Point${this.lineage ? ', +1 Ponto de Mutação' : ''}${this.secondaryLineage ? ', +1 Ponto de Natureza' : ''}`);
    }

    learnSkill(skillId) {
        if (!this.learnedSkills.includes(skillId)) {
            this.learnedSkills.push(skillId);
            return true;
        }
        return false;
    }

    // Migração/inicialização preguiçosa do loadout de batalha — ver
    // comentário no construtor sobre por que os campos começam `null`.
    // Saves antigos (de antes desta feature) chegam aqui com as duas listas
    // ainda `null`: em vez de o jogador simplesmente "perder" acesso às
    // habilidades que já tinha aprendido (violaria "nunca remova conteúdo
    // existente"), auto-equipa as primeiras já aprendidas até o novo limite,
    // preservando o comportamento anterior (tudo aprendido = tudo utilizável)
    // o mais fielmente possível dentro do novo teto.
    _ensureSkillLoadout() {
        if (this.equippedCommonSkills && this.equippedMutationSkills) return;
        const common = [];
        const mutation = [];
        const limits = window.SKILL_LOADOUT_LIMITS || { common: 3, mutation: 2 };
        (this.learnedSkills || []).forEach(id => {
            const skill = window.SkillDB && window.SkillDB[id];
            if (!skill || skill.isBossSkill) return;
            if (skill.isMutationSkill) {
                if (mutation.length < limits.mutation) mutation.push(id);
            } else if (common.length < limits.common) {
                common.push(id);
            }
        });
        this.equippedCommonSkills = common;
        this.equippedMutationSkills = mutation;
    }

    // Retorna true/false conforme conseguiu equipar (falha se a habilidade
    // não foi aprendida ainda ou se o loadout do tipo certo já está cheio —
    // ver window.SKILL_LOADOUT_LIMITS). Reequipar uma habilidade já equipada
    // é sempre um no-op bem-sucedido (idempotente).
    equipSkill(skillId) {
        this._ensureSkillLoadout();
        const skill = window.SkillDB && window.SkillDB[skillId];
        if (!skill || !this.learnedSkills.includes(skillId)) return false;
        const limits = window.SKILL_LOADOUT_LIMITS || { common: 3, mutation: 2 };
        const list = skill.isMutationSkill ? this.equippedMutationSkills : this.equippedCommonSkills;
        const limit = skill.isMutationSkill ? limits.mutation : limits.common;
        if (list.includes(skillId)) return true;
        if (list.length >= limit) return false;
        list.push(skillId);
        return true;
    }

    unequipSkill(skillId) {
        this._ensureSkillLoadout();
        const skill = window.SkillDB && window.SkillDB[skillId];
        const list = (skill && skill.isMutationSkill) ? this.equippedMutationSkills : this.equippedCommonSkills;
        const idx = list.indexOf(skillId);
        if (idx === -1) return false;
        list.splice(idx, 1);
        return true;
    }

    isSkillEquipped(skillId) {
        this._ensureSkillLoadout();
        return this.equippedCommonSkills.includes(skillId) || this.equippedMutationSkills.includes(skillId);
    }

    // Lista efetivamente utilizável em batalha (ver ui.js openBattleSkillMenu)
    // — nunca `learnedSkills` diretamente, que pode ser maior que o loadout.
    getEquippedSkills() {
        this._ensureSkillLoadout();
        return [...this.equippedCommonSkills, ...this.equippedMutationSkills];
    }

    // Converte Pontos de Talento (SP) em Inteligência permanente, 1 pra 1
    // (pedido de balanceamento: "o jogador terá a oportunidade de converter
    // sp points em pontos de inteligência"). `amount` é sempre limitado ao
    // que o jogador realmente tem disponível — nunca deixa `skillPoints`
    // negativo. Retorna quantos pontos foram de fato convertidos (0 se não
    // havia nenhum disponível), pra a UI poder confirmar/recusar a ação.
    convertSkillPointToInt(amount = 1) {
        amount = Math.min(amount, this.skillPoints || 0);
        if (amount <= 0) return 0;
        this.skillPoints -= amount;
        this.baseStats.int += amount;
        this.calculateDerivedStats();
        return amount;
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
        if ((this.loreBooksFound || 0) >= 5) tryUnlock('bookworm');
        if ((this.magicStonesFound || 0) >= 5) tryUnlock('stone_collector');
        if ((this.rareAnimalsSighted || 0) >= 5) tryUnlock('naturalist');

        // Reputação (ver reputation.js ReputationSystem) — checado sempre
        // (barato, só leitura de um número) igual ao padrão já usado acima
        // pra conquistas cumulativas (wins/level), nunca preso a um
        // `context` específico porque reputação muda em vários lugares
        // diferentes (batalha, missão, roubo — ver
        // ReputationSystem._recordAndNotify, que chama checkAchievements
        // depois de QUALQUER mudança real).
        if (window.ReputationSystem) {
            const tier = window.ReputationSystem.getTier(this);
            if (tier.id === 'infame') tryUnlock('reputation_infame');
            if (tier.id === 'lendario') tryUnlock('reputation_lendario');
        }

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
    world_explorer: { id: 'world_explorer', name: 'Explorador do Mundo', description: 'Visite todas as Cidades-Hub conhecidas.', rarity: 'épico', icon: '🗺️', goal: Object.keys(window.CityDatabase || {}).length || 1, progress: p => (p.visitedCityIds || []).length },
    // Estatísticas de exploração da Estrada (ver road.js _resolveEvent
    // 'lore_book'/'magic_stone'/'rare_animal', já exibidas na Casa do
    // Jogador desde o Ciclo 37) — até este ciclo eram puramente
    // cosméticas, sem nenhuma Conquista associada. checkAchievements() é
    // chamado direto de road.js logo após cada contador incrementar (não
    // só depois de batalha/viagem, como as outras).
    bookworm: { id: 'bookworm', name: 'Bibliófilo', description: 'Encontre 5 livros esquecidos pela Estrada.', rarity: 'comum', icon: '📖', goal: 5, progress: p => p.loreBooksFound || 0 },
    stone_collector: { id: 'stone_collector', name: 'Colecionador de Pedras', description: 'Encontre 5 pedras mágicas pela Estrada.', rarity: 'comum', icon: '🔮', goal: 5, progress: p => p.magicStonesFound || 0 },
    naturalist: { id: 'naturalist', name: 'Naturalista', description: 'Aviste 5 animais raros pela Estrada.', rarity: 'comum', icon: '🦌', goal: 5, progress: p => p.rareAnimalsSighted || 0 },
    // Reputação (ver reputation.js ReputationSystem) — os dois extremos da
    // faixa, sem limite artificial (ver REPUTATION_TIERS). Checado sempre
    // que a reputação muda de verdade, não só depois de batalha (ver
    // checkAchievements acima e ReputationSystem._recordAndNotify).
    reputation_infame: { id: 'reputation_infame', name: 'Nome Manchado', description: 'Alcance reputação Infame — sua fama é de temer, não de admirar.', rarity: 'épico', icon: '💀' },
    reputation_lendario: { id: 'reputation_lendario', name: 'Ídolo do Povo', description: 'Alcance reputação Lendária — seu nome é sinônimo de confiança em toda cidade.', rarity: 'lendário', icon: '🏅' }
};

window.AchievementDB = AchievementDB;
