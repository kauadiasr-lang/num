/**
 * Motor de IA de Combate (Utility AI)
 *
 * Arquitetura: cada turno do inimigo é resolvido calculando uma pontuação de
 * utilidade para cada ação candidata (ATK, cada habilidade disponível, DEF,
 * HOLD, ITEM, RETREAT/APPROACH voluntários, troca de arma) e escolhendo entre
 * as melhores com um pouco de aleatoriedade — nunca um bloco grande de
 * if/else, e nunca uma decisão puramente aleatória. A pontuação de cada ação
 * é o produto de:
 *   viés do estilo de luta (ai_data.js) × peso da personalidade (ai_data.js)
 *   × modificador emocional × modificador de risco × modificador de moral
 *   × modificador de memória/anti-exploração × um pouco de ruído (variabilidade)
 *
 * O gate físico de alcance (perto/longe demais para a arma) continua sendo a
 * primeira verificação, exatamente como no sistema tático de distância — isso
 * preserva 100% do comportamento já testado (inclusive a correção do impasse
 * de recuo forçado). A camada de personalidade/estilo/emoção/memória só decide
 * ENTRE as ações já fisicamente possíveis.
 *
 * Nada aqui é salvo no jogo: todo estado de IA vive em `enemy.aiState` e
 * `battle.playerActionHistory`, que existem apenas em memória durante a luta
 * (o SaveSystem só serializa `Engine.state.player`), então não há nenhum
 * risco de compatibilidade com saves antigos ou novos.
 */

const AICombat = {

    // ==========================================================================
    // ATRIBUIÇÃO DE PERFIL (chamado uma vez, ao criar o Enemy/Rival)
    // ==========================================================================

    // Escolhe personalidade + estilo de luta (+ raramente um arquétipo raro) e
    // monta uma cópia "com jitter" dos pesos, exclusiva daquela instância — é
    // isso que garante que dois inimigos com a mesma personalidade e o mesmo
    // estilo nunca se comportem de forma idêntica (variabilidade).
    assignProfile(entity, opts = {}) {
        const personalityIds = Object.keys(AI_PERSONALITIES);
        const styleIds = Object.keys(AI_FIGHTING_STYLES);

        const personalityId = opts.personalityId || personalityIds[Utils.randomInt(0, personalityIds.length - 1)];
        const styleId = opts.styleId || styleIds[Utils.randomInt(0, styleIds.length - 1)];

        const basePersonality = AI_PERSONALITIES[personalityId] || AI_PERSONALITIES.veterano;
        const style = AI_FIGHTING_STYLES[styleId] || AI_FIGHTING_STYLES.espadachim;

        // Jitter de ±15% por peso, único para esta instância (nunca a mesma
        // referência da tabela global — cada inimigo tem sua própria cópia).
        const jittered = {};
        for (let key in basePersonality) {
            if (typeof basePersonality[key] === 'number') {
                jittered[key] = Utils.clamp(basePersonality[key] * Utils.randomFloat(0.85, 1.15), 0, 1.5);
            }
        }
        jittered.id = basePersonality.id;
        jittered.name = basePersonality.name;

        entity.aiPersonality = jittered;
        entity.aiStyle = style;
        entity.personality = basePersonality.name; // mantém compatível com o campo exibido na UI
        entity.fightingStyleName = style.name;

        // Arquétipo raro: só para Duelo Rápido, a menos que explicitamente pedido
        entity.aiRareArchetype = null;
        if (opts.allowRareArchetype !== false && Utils.chance(opts.rareChance !== undefined ? opts.rareChance : RARE_ARCHETYPE_CHANCE)) {
            const rareIds = Object.keys(AI_RARE_ARCHETYPES);
            entity.aiRareArchetype = AI_RARE_ARCHETYPES[rareIds[Utils.randomInt(0, rareIds.length - 1)]];
        }

        // Pool de habilidades do inimigo: as do estilo, filtradas pelo nível
        // (um inimigo de nível baixo não recebe habilidades "avançadas demais").
        const level = opts.level || entity.level || 1;
        entity.aiSkills = style.skillPool.filter(id => {
            const skill = window.SkillDB[id];
            return skill && level >= skill.levelReq;
        });
        if (entity.aiRareArchetype && entity.aiRareArchetype.id === 'so_habilidades' && entity.aiSkills.length === 0) {
            // Garante que "O Devoto das Artes" sempre tenha ao menos 1 habilidade disponível
            entity.aiSkills = [style.skillPool[0]];
        }

        // "Lutador de Punho Nu": desequipa a arma principal (mantém o resto do
        // equipamento intacto). Usa o alcance/velocidade de punhos já existente.
        if (entity.aiRareArchetype && entity.aiRareArchetype.id === 'lutador_desarmado') {
            entity.equipment[SLOTS.MAIN_HAND] = null;
        }

        // Cargas de item "virtuais": o inimigo não tem mochila de verdade, só
        // um número de curas equivalentes, proporcional ao quanto a
        // personalidade gosta de usar itens.
        entity.aiState = entity.aiState || {};
        entity.aiState.itemCharges = Math.round(jittered.itemUsage * 3);

        return entity;
    },

    // Escolhe um id de arma dentro do pool do estilo (com uma pequena chance de
    // fugir do pool, para manter surpresa mesmo dentro do mesmo estilo).
    pickWeaponFromStyle(styleId) {
        const style = AI_FIGHTING_STYLES[styleId] || AI_FIGHTING_STYLES.espadachim;
        const allWeapons = Object.keys(ItemDatabase.weapons);
        if (Utils.chance(10)) return allWeapons[Utils.randomInt(0, allWeapons.length - 1)];
        const pool = style.weaponPool.length > 0 ? style.weaponPool : allWeapons;
        return pool[Utils.randomInt(0, pool.length - 1)];
    },

    // Sorteia um escudo (ou null) conforme `preferShield` do estilo — bug de
    // auditoria: essa flag existia em ai_data.js desde a criação do motor de
    // IA mas nunca era lida em lugar nenhum, então Gladiadores e Guardiões
    // (os dois únicos estilos com preferShield: true, ambos com shield_bash
    // no skillPool) nunca carregavam escudo de verdade, nem visual nem
    // mecanicamente (sem o blockChance do item).
    pickShieldFromStyle(styleId) {
        const style = AI_FIGHTING_STYLES[styleId];
        if (!style || !style.preferShield) return null;
        const shieldKeys = Object.keys(ItemDatabase.shields);
        return shieldKeys[Utils.randomInt(0, shieldKeys.length - 1)];
    },

    // ==========================================================================
    // ESTADO DE BATALHA (memória, emoção, moral, combo)
    // ==========================================================================

    initBattleState(battle) {
        const enemy = battle.enemy;
        enemy.aiState = enemy.aiState || {};
        Object.assign(enemy.aiState, {
            emotion: 'confiante',
            morale: 60,
            turnCount: 0,
            comboQueue: [],
            comboFlavor: [],
            missStreak: 0,
            hitStreak: 0,
            lastSwapTurn: 0,
            bossPhase: 0,
        });
        enemy.aiState.memory = {
            playerActionCounts: {},     // actionCode -> quantas vezes o jogador usou
            playerSkillCounts: {},      // skillId -> quantas vezes
            playerDodgedEnemyAttacks: 0,
            playerBlockedEnemyAttacks: 0,
            playerLowHpActions: [],     // actionCodes usados pelo jogador quando estava com HP baixo
            recentPlayerActions: [],    // últimos N actionCodes (para detectar padrões)
        };
        battle.playerActionHistory = [];
    },

    // ==========================================================================
    // MEMÓRIA — chamado do fim de executePlayerTurn a cada turno do jogador
    // ==========================================================================

    recordPlayerAction(battle, actionCode, param, meta = {}) {
        const enemy = battle.enemy;
        if (!enemy || !enemy.aiState) return;
        const mem = enemy.aiState.memory;

        mem.playerActionCounts[actionCode] = (mem.playerActionCounts[actionCode] || 0) + 1;
        if (actionCode === 'SKILL' && param) {
            mem.playerSkillCounts[param] = (mem.playerSkillCounts[param] || 0) + 1;
        }

        mem.recentPlayerActions.push(actionCode);
        if (mem.recentPlayerActions.length > 6) mem.recentPlayerActions.shift();
        battle.playerActionHistory.push(actionCode);
        if (battle.playerActionHistory.length > 6) battle.playerActionHistory.shift();

        // O jogador atacou e o golpe do inimigo (nesta análise, o dano causado
        // ao inimigo) indica se a defesa/esquiva do inimigo funcionou — serve
        // de contexto para o próprio inimigo perceber se está "sobrevivendo bem".
        if (meta.enemyHpBefore !== undefined) {
            const dmgDealt = meta.enemyHpBefore - enemy.currentHp;
            if (dmgDealt > 0) this.onSelfEvent(battle, 'tookDamage', { amount: dmgDealt });
        }

        // Memória de "o jogador foge quando está fraco"
        if (meta.playerHpAtDecision !== undefined && battle.player.derivedStats.maxHp > 0) {
            const hpPercent = meta.playerHpAtDecision / battle.player.derivedStats.maxHp;
            if (hpPercent <= 0.3) {
                mem.playerLowHpActions.push(actionCode);
                if (mem.playerLowHpActions.length > 8) mem.playerLowHpActions.shift();
            }
        }
    },

    // O jogador mantém distância ("kita") com frequência?
    playerKeepsDistance(mem) {
        const kite = (mem.playerActionCounts['RETREAT'] || 0) + (mem.playerActionCounts['HOLD'] || 0);
        const close = (mem.playerActionCounts['APPROACH'] || 0) + (mem.playerActionCounts['RUN'] || 0) + (mem.playerActionCounts['CHARGE'] || 0);
        return kite > close + 1;
    },

    // O jogador foge sempre que fica com pouco HP?
    playerFleesWhenLow(mem) {
        if (mem.playerLowHpActions.length < 2) return false;
        const fleeing = mem.playerLowHpActions.filter(a => a === 'RETREAT' || a === 'HOLD' || a === 'ITEM').length;
        return fleeing / mem.playerLowHpActions.length > 0.6;
    },

    // Detecta padrão repetitivo (anti-exploração): mesma ação 4+ vezes nos
    // últimos 5 turnos do jogador.
    detectRepeatedPattern(mem) {
        const recent = mem.recentPlayerActions;
        if (recent.length < 4) return null;
        const last5 = recent.slice(-5);
        const counts = {};
        last5.forEach(a => counts[a] = (counts[a] || 0) + 1);
        for (let action in counts) {
            if (counts[action] >= 4) return action;
        }
        return null;
    },

    // ==========================================================================
    // MORAL E EMOÇÃO
    // ==========================================================================

    // Eventos que o próprio inimigo vive (acertou, errou, foi atingido, etc),
    // usados para atualizar moral/sequências.
    onSelfEvent(battle, type, data = {}) {
        const ai = battle.enemy.aiState;
        if (!ai) return;
        const chaBonus = (battle.enemy.getTotalStat ? battle.enemy.getTotalStat('cha') : 5) * 0.15; // CHA sustenta a moral

        if (type === 'landedHit') {
            ai.morale = Utils.clamp(ai.morale + 5 + (data.crit ? 8 : 0) + chaBonus * 0.2, 0, 100);
            ai.hitStreak++; ai.missStreak = 0;
        } else if (type === 'missed') {
            ai.morale = Utils.clamp(ai.morale - 3, 0, 100);
            ai.missStreak++; ai.hitStreak = 0;
        } else if (type === 'tookDamage') {
            const severity = Utils.clamp((data.amount || 0) / Math.max(1, battle.enemy.derivedStats.maxHp) * 100, 0, 40);
            ai.morale = Utils.clamp(ai.morale - severity - (data.crit ? 10 : 0), 0, 100);
        }
    },

    // Reavalia a emoção atual a partir de HP%, moral e sequências recentes.
    // Personalidades voláteis reavaliam quase todo turno; as estáveis mudam
    // de emoção bem mais devagar (ficam "presas" no estado atual por mais tempo).
    updateEmotion(battle) {
        const enemy = battle.enemy;
        const ai = enemy.aiState;
        const p = enemy.aiPersonality;
        if (!Utils.chance(30 + p.emotionVolatility * 60)) return; // nem todo turno reavalia

        const hpPercent = enemy.currentHp / enemy.derivedStats.maxHp;
        // `moraleSensitivity` (ai_data.js) existia em todas as 16
        // personalidades desde a criação do motor, mas nunca era lida — bug
        // de auditoria: toda personalidade reagia a oscilações de moral
        // exatamente igual, mesmo uma tendo sido desenhada como "abalada
        // fácil" (covarde: 0.80) e outra como "fria e estável" (executor:
        // 0.15). Os três termos abaixo que dependem de `ai.morale` agora
        // escalam por essa sensibilidade.
        const moraleSens = p.moraleSensitivity !== undefined ? p.moraleSensitivity : 0.5;
        const scores = {
            confiante: (hpPercent - 0.5) * 2 + (ai.morale - 50) / 50 * moraleSens + ai.hitStreak * 0.3,
            assustado: (1 - hpPercent) * (0.3 + p.resilience) + (50 - ai.morale) / 50 * 0.6 * moraleSens,
            frustrado: ai.missStreak * 0.5 - hpPercent * 0.2,
            enfurecido: (p.aggression - 0.5) * 2 * (1 - hpPercent < 0.5 ? 1 : 0.4) + (ai.hitStreak === 0 && ai.missStreak > 1 ? 0.3 : 0),
            desesperado: (1 - hpPercent) * (1.2 - p.resilience) * (hpPercent < 0.25 ? 1.5 : 0.3),
            determinado: 0.4 + (ai.morale - 40) / 100 * moraleSens,
        };
        let best = 'determinado', bestScore = -Infinity;
        for (let key in scores) { if (scores[key] > bestScore) { bestScore = scores[key]; best = key; } }
        ai.emotion = best;
    },

    // ==========================================================================
    // AVALIAÇÃO DE RISCO
    // ==========================================================================

    // Retorna 0 (sem risco algum) a 1 (risco extremo) combinando HP próprio,
    // ameaça do jogador (dano/fadiga), adequação de distância, mana disponível
    // e postura — tudo isso ANTES de decidir qualquer ação (nunca aleatório puro).
    assessRisk(battle) {
        const enemy = battle.enemy, player = battle.player;
        const hpPercent = enemy.currentHp / enemy.derivedStats.maxHp;
        let risk = (1 - hpPercent) * 0.45;

        // Ameaça ofensiva do jogador, atenuada pela fadiga dele (um jogador
        // fatigado é objetivamente mais fraco — a IA "sente" isso)
        const playerFatigueMult = 1 - ((player.fatigue || 0) * 0.15);
        const threatRatio = Utils.clamp((player.derivedStats.physicalDamage * playerFatigueMult) / Math.max(1, enemy.derivedStats.maxHp) * 4, 0, 1);
        risk += threatRatio * 0.25;

        // Estar fora do próprio alcance ideal (precisa se reposicionar) é
        // percebido como vulnerabilidade
        const range = enemy.getWeaponRange();
        if (!battle.isInRange(range)) risk += 0.1;

        // Poucos recursos (mana para habilidades, cargas de item) aumenta o risco
        const mpPercent = enemy.derivedStats.maxMp > 0 ? enemy.currentMp / enemy.derivedStats.maxMp : 1;
        if (mpPercent < 0.2 && enemy.aiSkills.length > 0) risk += 0.05;
        if ((enemy.aiState.itemCharges || 0) === 0) risk += 0.05;

        // Moral baixa amplifica a percepção de risco
        risk += (50 - enemy.aiState.morale) / 50 * 0.15;

        return Utils.clamp(risk, 0, 1);
    },

    // ==========================================================================
    // TROCA DE ARMA (adaptação em pleno combate)
    // ==========================================================================

    trySwapWeapon(battle) {
        const enemy = battle.enemy;
        const oldName = enemy.equipment[SLOTS.MAIN_HAND] ? enemy.equipment[SLOTS.MAIN_HAND].name : 'as próprias mãos';
        const rarity = (enemy.equipment[SLOTS.MAIN_HAND] && enemy.equipment[SLOTS.MAIN_HAND].rarity) || RARITY.COMMON;
        const newId = this.pickWeaponFromStyle(enemy.aiStyle.id);
        enemy.equipment[SLOTS.MAIN_HAND] = ItemFactory.createEquipment(newId, 'weapons', rarity);
        enemy.calculateDerivedStats();
        enemy.aiState.lastSwapTurn = enemy.aiState.turnCount;
        return `${enemy.name} descarta ${oldName} e saca ${enemy.equipment[SLOTS.MAIN_HAND].name}!`;
    },

    // ==========================================================================
    // FASES DE CHEFE
    // ==========================================================================

    // Chamado no início do turno do inimigo. Só faz algo se o Rival tiver um
    // array `phases` definido (opt-in — a maioria dos inimigos não tem, então
    // isso nunca afeta nada além dos campeões que explicitamente o recebem).
    checkBossPhase(battle) {
        const enemy = battle.enemy;
        if (!enemy.phases || enemy.phases.length === 0) return null;
        const hpPercent = enemy.currentHp / enemy.derivedStats.maxHp;
        const ai = enemy.aiState;

        for (let i = 0; i < enemy.phases.length; i++) {
            const phase = enemy.phases[i];
            if (ai.bossPhase <= i && hpPercent <= phase.hpPercent) {
                ai.bossPhase = i + 1;
                if (phase.personalityId) {
                    const base = AI_PERSONALITIES[phase.personalityId];
                    if (base) {
                        const jittered = {};
                        for (let key in base) { if (typeof base[key] === 'number') jittered[key] = base[key]; }
                        jittered.id = base.id; jittered.name = base.name;
                        enemy.aiPersonality = jittered;
                        enemy.personality = base.name;
                    }
                }
                if (phase.unlockSkill && !enemy.aiSkills.includes(phase.unlockSkill)) {
                    enemy.aiSkills.push(phase.unlockSkill);
                }
                if (phase.emotion) ai.emotion = phase.emotion;
                if (phase.healPercent) {
                    enemy.currentHp = Utils.clamp(enemy.currentHp + Math.floor(enemy.derivedStats.maxHp * phase.healPercent), 0, enemy.derivedStats.maxHp);
                }
                ai.morale = Utils.clamp(ai.morale + 20, 0, 100);
                return phase.message || `${enemy.name} entra em uma nova fase de combate!`;
            }
        }
        return null;
    },

    // ==========================================================================
    // DECISÃO PRINCIPAL
    // ==========================================================================

    // Retorna { action, param, message, amount } — battle.js executa a partir
    // disso. `action` é sempre um dos códigos já suportados pelo motor de
    // batalha (ATK, DEF, APPROACH, RETREAT, RUN, CHARGE, HOLD, SKILL, ITEM, SWAP).
    decideAction(battle) {
        const enemy = battle.enemy;
        const ai = enemy.aiState;
        const p = enemy.aiPersonality;
        const style = enemy.aiStyle;
        const rare = enemy.aiRareArchetype;
        ai.turnCount++;

        this.updateEmotion(battle);
        const emotionMods = AI_EMOTIONS[ai.emotion] || AI_EMOTIONS.determinado;
        const risk = this.assessRisk(battle);
        const mem = ai.memory;
        const range = enemy.getWeaponRange();
        const speed = enemy.getWeaponSpeed();

        // --- Continuação de combo já em andamento tem prioridade máxima,
        // desde que o próximo passo ainda seja executável agora ---
        if (ai.comboQueue.length > 0) {
            const nextStep = ai.comboQueue.shift();
            const flavor = ai.comboFlavor.shift();
            const resolved = this._resolveComboStep(battle, nextStep);
            if (resolved) return { ...resolved, message: flavor };
            // passo inválido agora (ex: habilidade em recarga) — descarta o resto do combo
            ai.comboQueue = []; ai.comboFlavor = [];
        }

        // --- Gate físico de alcance (preserva exatamente o comportamento já
        // testado do sistema de distância/alcance, incluindo a correção do
        // impasse de recuo forçado) ---
        if (battle.distance < range.min) {
            if (rare && rare.id === 'nunca_recua') {
                return { action: 'HOLD', message: `${enemy.name} recusa-se a recuar, mesmo perto demais para lutar!` };
            }
            const needed = range.min - battle.distance;
            const amount = Math.min(speed.retreatSpeed, Math.max(needed, 0.5));
            return { action: 'RETREAT', amount, message: `${enemy.name} recua para reposicionar.` };
        }
        if (battle.distance > range.max) {
            // Perseguidores natos preferem Correr quando a distância a fechar é grande
            if (p.pursuitDrive > 0.65 && (battle.distance - range.max) > 3 && Utils.chance(50)) {
                return { action: 'RUN', message: `${enemy.name} corre para encurtar distância!` };
            }
            return { action: 'APPROACH', message: `${enemy.name} avança para ficar ao alcance.` };
        }

        // --- Arquétipo "Espelho": tenta repetir a última ação do jogador ---
        if (rare && rare.id === 'imitador' && battle.playerActionHistory.length > 0) {
            const lastPlayerAction = battle.playerActionHistory[battle.playerActionHistory.length - 1];
            const mimic = this._tryMimic(battle, lastPlayerAction);
            if (mimic && Utils.chance(75)) return mimic;
        }

        // --- Blefe: substitui a ação "de verdade" por uma variante encenada,
        // só quando o risco não é alto demais para brincadeiras ---
        if (Utils.chance(p.bluffChance * 100) && risk < 0.55) {
            const bluff = this._pickBluff(battle);
            if (bluff) return bluff;
        }

        // --- Início de combo (compromisso com uma sequência pré-planejada) ---
        if (risk < 0.6 && Utils.chance(p.comboAffinity * 40)) {
            const combo = this._maybeStartCombo(battle);
            if (combo) return combo;
        }

        // --- Anti-exploração: identifica padrão repetitivo do jogador ---
        const repeatedPattern = this.detectRepeatedPattern(mem);

        // --- Pontuação de utilidade entre as ações fisicamente possíveis ---
        const candidates = this._buildCandidates(battle, { risk, repeatedPattern, emotionMods });
        return this._pickWeighted(candidates, enemy);
    },

    // Resolve um passo de combo ("ATK", "SKILL:heavy_strike", etc) verificando
    // se ainda é executável; retorna null se não for (aborta o combo com segurança).
    _resolveComboStep(battle, step) {
        const enemy = battle.enemy;
        if (step.startsWith('SKILL:')) {
            const skillId = step.slice(6);
            if (!enemy.aiSkills.includes(skillId)) return null;
            if (!this._skillUsable(battle, skillId)) return null;
            return { action: 'SKILL', param: skillId };
        }
        if (step === 'ATK' || step === 'SKILL') {
            const range = battle.enemy.getWeaponRange();
            if (!battle.isInRange(range)) return null;
            return { action: 'ATK' };
        }
        if (['DEF', 'HOLD', 'RETREAT', 'APPROACH', 'RUN', 'CHARGE'].includes(step)) {
            return { action: step };
        }
        return null;
    },

    _skillUsable(battle, skillId) {
        const enemy = battle.enemy;
        const skill = window.SkillDB[skillId];
        if (!skill) return false;
        if (enemy.skillCooldowns && enemy.skillCooldowns[skillId] > 0) return false;
        if (enemy.currentMp < skill.mpCost) return false;
        let skillRange = null;
        if (skill.type === 'PHYSICAL' || skill.type === 'BLEED' || skill.type === 'STUN' || skill.type === 'LIFESTEAL') {
            skillRange = enemy.getWeaponRange();
        } else if (skill.type === 'MAGIC' && skill.range !== undefined) {
            skillRange = { min: 0, max: skill.range };
        }
        if (skillRange && !battle.isInRange(skillRange)) return false;
        return true;
    },

    _tryMimic(battle, lastPlayerAction) {
        if (lastPlayerAction === 'ATK') {
            const range = battle.enemy.getWeaponRange();
            if (battle.isInRange(range)) return { action: 'ATK', message: `${battle.enemy.name} imita seu golpe!` };
        } else if (['DEF', 'HOLD', 'RETREAT', 'APPROACH', 'RUN', 'CHARGE'].includes(lastPlayerAction)) {
            return { action: lastPlayerAction, message: `${battle.enemy.name} espelha seus movimentos!` };
        } else if (lastPlayerAction === 'SKILL') {
            const usable = battle.enemy.aiSkills.find(id => this._skillUsable(battle, id));
            if (usable) return { action: 'SKILL', param: usable, message: `${battle.enemy.name} tenta reproduzir sua técnica!` };
        }
        return null;
    },

    _pickBluff(battle) {
        const enemy = battle.enemy;
        const roll = Utils.randomInt(0, 2);
        if (roll === 0) {
            return { action: 'RETREAT', message: `${enemy.name} finge recuar, testando sua reação!` };
        } else if (roll === 1) {
            return { action: 'HOLD', message: `${enemy.name} prepara um golpe... e hesita, observando você.` };
        }
        return { action: 'DEF', message: `${enemy.name} zomba de você, confiante!` };
    },

    _maybeStartCombo(battle) {
        const enemy = battle.enemy;
        const comboSet = AI_COMBOS[enemy.aiStyle.id];
        if (!comboSet || comboSet.length === 0) return null;
        const combo = comboSet[Utils.randomInt(0, comboSet.length - 1)];
        const first = this._resolveComboStep(battle, combo.steps[0]);
        if (!first) return null;
        battle.enemy.aiState.comboQueue = combo.steps.slice(1);
        battle.enemy.aiState.comboFlavor = combo.flavor.slice(1);
        return { ...first, message: combo.flavor[0] };
    },

    // Monta a lista de candidatos com pontuação de utilidade
    _buildCandidates(battle, ctx) {
        const enemy = battle.enemy;
        const p = enemy.aiPersonality;
        const style = enemy.aiStyle;
        const rare = enemy.aiRareArchetype;
        const em = ctx.emotionMods;
        const mem = enemy.aiState.memory;
        const list = [];

        const add = (action, param, baseScore, message) => {
            if (baseScore <= 0) return;
            list.push({ action, param, score: baseScore * Utils.randomFloat(0.85, 1.15), message });
        };

        // ATK
        let atkScore = style.actionBias.ATK * (0.4 + p.aggression) * (em.ATK || 1);
        if (rare && rare.id === 'so_habilidades') atkScore *= 0.05;
        if (ctx.risk > 0.6) atkScore *= (1 - p.resilience * 0.6);
        if (ctx.repeatedPattern === 'DEF') atkScore *= 1.6; // jogador vive se defendendo: pressiona mais
        add('ATK', null, atkScore, `${enemy.name} ataca!`);

        // Habilidades
        enemy.aiSkills.forEach(skillId => {
            if (!this._skillUsable(battle, skillId)) return;
            let s = style.actionBias.SKILL * (0.4 + p.skillUsage) * (em.SKILL || 1) * (0.6 + p.critHunger * 0.5);
            if (ctx.repeatedPattern === skillId) s *= 0.5; // evita repetir a mesma skill que já virou padrão
            add('SKILL', skillId, s, `${enemy.name} usa ${window.SkillDB[skillId].name}!`);
        });

        // DEF
        if (!(rare && rare.id === 'nunca_defende')) {
            let defScore = style.actionBias.DEF * (0.3 + p.caution) * (em.DEF || 1) * (0.5 + ctx.risk);
            if (ctx.repeatedPattern === 'ATK') defScore *= 1.5; // jogador sempre ataca: passa a se defender mais
            add('DEF', null, defScore, `${enemy.name} assume uma postura defensiva.`);
        }

        // HOLD (controle de espaço, sem se mover)
        let holdScore = style.actionBias.HOLD * (0.3 + p.caution * 0.6) * (em.HOLD || 1);
        add('HOLD', null, holdScore, `${enemy.name} se posiciona com cautela.`);

        // RETREAT voluntário (mesmo já em alcance, algumas personalidades preferem manter distância de vantagem)
        let retreatScore = style.actionBias.RETREAT * (0.2 + p.retreatDrive) * (em.RETREAT || 1) * (0.4 + ctx.risk);
        if (rare && rare.id === 'nunca_recua') retreatScore = 0;
        if (ctx.repeatedPattern === 'APPROACH' || ctx.repeatedPattern === 'RUN' || ctx.repeatedPattern === 'CHARGE') retreatScore *= 1.4;
        // Estilos "hitAndRun" (ver ai_data.js, ex: assassino) reforçam MUITO a
        // fuga logo depois de acertar um golpe — bug de auditoria: essa flag
        // existia há tempos mas nunca era lida em lugar nenhum, então
        // assassinos nunca recuavam de propósito fora do combo pré-roteirizado.
        if (style.hitAndRun && enemy.aiState.hitStreak > 0) retreatScore *= 2.2;
        add('RETREAT', null, retreatScore, `${enemy.name} recua, mantendo distância segura.`);

        // APPROACH voluntário (perseguição extra quando o jogador kita)
        let approachScore = style.actionBias.APPROACH * (0.2 + p.pursuitDrive * 0.5) * (em.ATK || 1) * 0.5;
        if (this.playerKeepsDistance(mem)) approachScore *= 1.8;
        add('APPROACH', null, approachScore, `${enemy.name} avança, recusando-se a perder distância.`);

        // ITEM
        const hpPercent = enemy.currentHp / enemy.derivedStats.maxHp;
        if ((enemy.aiState.itemCharges || 0) > 0 && hpPercent < 0.6) {
            let itemScore = p.itemUsage * (1 - hpPercent) * 2 * (em.ITEM || 1);
            add('ITEM', null, itemScore, `${enemy.name} usa um item de cura!`);
        }

        // Troca de arma (adaptação): mais provável quando frustrado ou sob padrão detectado
        let swapScore = p.weaponSwapTendency * 0.3;
        if (enemy.aiState.missStreak >= 3) swapScore *= 2.2;
        // "O Inconstante" (trocador_de_armas) existia em ai_data.js prometendo
        // trocar de arma constantemente, mas nada em ai.js checava esse
        // arquétipo raro — na prática ele se comportava como um inimigo
        // qualquer. Agora ele ignora o cooldown normal de troca e mantém uma
        // pontuação alta e constante de SWAP.
        const isInconstante = rare && rare.id === 'trocador_de_armas';
        if (isInconstante) {
            swapScore = 0.8;
        } else if (enemy.aiState.turnCount - (enemy.aiState.lastSwapTurn || 0) < 3) {
            swapScore = 0; // não troca toda hora
        }
        add('SWAP', null, swapScore, null);

        // Provocar (flavor puro, reaproveita DEF/HOLD com mensagem diferente e leve ganho de moral)
        // — cada personalidade tem sua própria frase (ver AI_TAUNT_LINES em
        // ai_data.js); antes TODAS usavam o mesmo texto genérico, desperdiçando
        // a diferenciação de tom que tauntChance já sugeria por perfil.
        if (Utils.chance(p.tauntChance * 100) && ctx.risk < 0.4) {
            const lines = (window.AI_TAUNT_LINES && window.AI_TAUNT_LINES[p.id]) || ['{name} provoca você, confiante na vitória!'];
            const line = lines[Utils.randomInt(0, lines.length - 1)].replace('{name}', enemy.name);
            add('TAUNT', null, 0.35, line);
        }

        return list;
    },

    // Escolhe entre os melhores candidatos com um pouco de aleatoriedade
    // (nunca 100% determinístico, nunca 100% aleatório).
    _pickWeighted(candidates, enemy) {
        if (candidates.length === 0) return { action: 'ATK', message: `${enemy.name} ataca!` };
        candidates.sort((a, b) => b.score - a.score);
        const top = candidates.slice(0, Math.min(3, candidates.length));
        const totalWeight = top.reduce((sum, c) => sum + Math.max(0.01, c.score), 0);
        let roll = Math.random() * totalWeight;
        for (const c of top) {
            roll -= Math.max(0.01, c.score);
            if (roll <= 0) {
                if (c.action === 'TAUNT') {
                    enemy.aiState.morale = Utils.clamp(enemy.aiState.morale + 6, 0, 100);
                    return { action: 'HOLD', message: c.message };
                }
                if (c.action === 'SWAP') {
                    return { action: 'SWAP_INTERNAL' }; // resolvido por battle.js chamando trySwapWeapon
                }
                return c;
            }
        }
        return top[0];
    },
};

window.AICombat = AICombat;
