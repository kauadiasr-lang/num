/**
 * IA exclusiva de Bosses de Ritual — NUNCA reutiliza AICombat (personalidade/
 * estilo/emoção/memória do inimigo comum, ver ai.js). Cada boss é uma árvore
 * de decisão totalmente própria, registrada aqui por id (BOSS_AI), com suas
 * próprias habilidades exclusivas (registradas em window.SkillDB, mas nunca
 * incluídas em nenhum `aiStyle.skillPool` comum — só o próprio boss as usa).
 *
 * O único ponto em comum com o combate normal é o gate físico de alcance
 * (é física da distância/arma, não "inteligência") e o executor genérico de
 * dano/cura/efeitos de battle.js (executeAttack/executeEnemySkill) — reaproveitar
 * fórmulas de dano já testadas não é "reusar a IA", é não reinventar matemática.
 */

// --- Habilidades exclusivas de bosses (nunca aparecem em aiStyle.skillPool
// comum, então nenhum inimigo normal pode usá-las) ---
function registerBossSkills() {
    if (!window.SkillDB) return;
    // Bug de auditoria (relatado pelo usuário — "magia infinita"): TODA
    // habilidade de boss tinha mpCost:0, e o `ready()` de cada árvore de
    // decisão (ver BOSS_AI abaixo) só checava cooldown, nunca mana — um
    // boss nunca ficava sem mágica de verdade, só limitado por cooldown
    // (que sempre volta a zero). Custos agora proporcionais ao poder de
    // cada habilidade (mesma escala das habilidades comuns, ver skills.js:
    // 10-32 MP), e `ready()` em cada boss agora exige MP suficiente também.
    const defs = [
        // Conde Vampiro
        { id: 'conde_garras_sombrias', name: 'Garras Sombrias', type: 'PHYSICAL', mpCost: 18, powerMulti: 1.9,
            description: 'As garras do Conde rasgam a carne com força sobrenatural.', extra: { cooldown: 2, animation: 'attack' } },
        { id: 'conde_sugar_vida', name: 'Sugar Vida', type: 'LIFESTEAL', mpCost: 25, powerMulti: 1.5,
            description: 'O Conde drena a vitalidade da vítima.', extra: { lifestealPercent: 80, cooldown: 3, animation: 'attack' } },
        { id: 'conde_enxame_morcegos', name: 'Enxame de Morcegos', type: 'MAGIC', mpCost: 30, powerMulti: 2.0,
            description: 'Uma nuvem de morcegos sanguinários ataca de qualquer distância.', extra: { cooldown: 4, range: 10, animation: 'boss_bats' } },
        { id: 'conde_garra_final', name: 'Garra Imortal', type: 'STUN', mpCost: 28, powerMulti: 1.7,
            description: 'Um golpe final que paralisa a vítima de puro terror.', extra: { stunChance: 80, cooldown: 3, animation: 'boss_slam' } },

        // Anjo Guardião
        { id: 'anjo_raio_sagrado', name: 'Raio Sagrado', type: 'MAGIC', mpCost: 30, powerMulti: 2.1,
            description: 'Um feixe de luz pura desce dos céus.', extra: { cooldown: 3, range: 10, animation: 'cast' } },
        { id: 'anjo_cura_divina', name: 'Cura Divina', type: 'HEAL', mpCost: 26, powerMulti: 2.2,
            description: 'O Anjo restaura sua própria vitalidade com luz celestial.', extra: { cooldown: 4, animation: 'cast' } },
        { id: 'anjo_barreira', name: 'Barreira Celestial', type: 'SHIELD', mpCost: 24, powerMulti: 1,
            description: 'Uma barreira de luz absorve grande parte do próximo dano.', extra: { shieldPercent: 50, duration: 2, cooldown: 4, animation: 'cast' } },
        { id: 'anjo_julgamento_final', name: 'Julgamento Final', type: 'MAGIC', mpCost: 45, powerMulti: 3.2,
            description: 'O julgamento definitivo — luz capaz de reduzir um pecador a cinzas.', extra: { cooldown: 5, range: 10, animation: 'boss_judgment' } },

        // Grokmar, a Fúria Desperta (Boss Especial da Arena — ver enemy.js
        // ARENA_BOSS_DEFS) — golpe de machado próprio, um atordoamento que
        // só usa depois de encolerizado, e um golpe final desesperado que
        // só sai com fúria no teto.
        { id: 'grokmar_machadada_dupla', name: 'Machadada Dupla', type: 'PHYSICAL', mpCost: 16, powerMulti: 1.8,
            description: 'Grokmar golpeia duas vezes seguidas com seu machado de guerra.', extra: { cooldown: 2, animation: 'attack' } },
        { id: 'grokmar_investida_furiosa', name: 'Investida Furiosa', type: 'STUN', mpCost: 22, powerMulti: 1.6,
            description: 'Um investida bruta que derruba a vítima, guiada pela fúria acumulada.', extra: { stunChance: 65, cooldown: 3, animation: 'boss_slam' } },
        { id: 'grokmar_ultimo_fio', name: 'Último Fio de Fúria', type: 'LIFESTEAL', mpCost: 30, powerMulti: 2.0,
            description: 'No auge da fúria, Grokmar golpeia sem qualquer defesa, drenando a força da vítima.', extra: { lifestealPercent: 60, cooldown: 3, animation: 'attack' } }
    ];
    defs.forEach(d => {
        if (!window.SkillDB[d.id]) {
            window.SkillDB[d.id] = new Skill(d.id, d.name, d.type, d.mpCost, d.powerMulti, d.description, 1, d.extra || {});
            // Marca como exclusiva de boss — ui.js openSkillTree() (Mercado
            // Arcano) filtra por essa flag. Sem isso, essas 8 habilidades
            // apareciam como aprendíveis por QUALQUER jogador usando pontos
            // de talento comuns, desde o nível 1 (exploit real encontrado em
            // auditoria: dava pra "comprar" Julgamento Final do Anjo Guardião
            // sem nunca ter enfrentado o boss).
            window.SkillDB[d.id].isBossSkill = true;
        }
    });
}
registerBossSkills();

const BOSS_AI = {
    // ==================================================================
    // CONDE VAMPIRO — agressivo, sedento, fica mais selvagem e imprevisível
    // conforme perde HP (nunca foge, nunca hesita).
    // ==================================================================
    conde_vampiro: {
        decideAction(battle) {
            const boss = battle.enemy;
            const hpFrac = boss.currentHp / boss.derivedStats.maxHp;
            const range = boss.getWeaponRange ? boss.getWeaponRange() : { min: 0, max: 2 };
            // Bug de auditoria ("magia infinita"): antes só checava cooldown
            // — agora também exige mana suficiente (ver mpCost em
            // registerBossSkills acima), senão o boss recorre a ATK como
            // qualquer inimigo comum sem mana pra suas habilidades.
            const ready = id => boss.isSkillReady(id) && boss.currentMp >= window.SkillDB[id].mpCost;

            // Gate físico: fora do alcance da adaga (minRange 0, maxRange 1),
            // sempre avança (o Conde nunca recua) — EXCETO que, antes disso,
            // dá chance ao Enxame de Morcegos. Bug de auditoria: essa
            // habilidade tem seu próprio `range: 10` e o tooltip promete
            // explicitamente "ataca de qualquer distância", mas o gate de
            // alcance melee sempre disparava APPROACH primeiro sempre que o
            // jogador ficasse a mais de 1m — nenhum código abaixo (onde a
            // skill é normalmente escolhida) era alcançado, então a
            // habilidade nunca podia ser usada exatamente na situação em que
            // seu próprio texto promete funcionar.
            const enxameSkill = window.SkillDB && window.SkillDB.conde_enxame_morcegos;
            if (!battle.isInRange(range)) {
                if (enxameSkill && ready('conde_enxame_morcegos') && battle.isInRange({ min: 0, max: enxameSkill.range })) {
                    return { action: 'SKILL', param: 'conde_enxame_morcegos', message: `${boss.name} invoca um enxame de morcegos sanguinários à distância!` };
                }
                return { action: 'APPROACH', message: `${boss.name} avança com fome insaciável!` };
            }

            const enraged = hpFrac <= 0.5; // Fase 2: mais selvagem e imprevisível

            if (enraged && ready('conde_garra_final') && Utils.chance(45)) {
                return { action: 'SKILL', param: 'conde_garra_final', message: `${boss.name} cravado pela fúria imortal, ataca para paralisar!` };
            }
            if (hpFrac < 0.6 && ready('conde_sugar_vida') && Utils.chance(55)) {
                return { action: 'SKILL', param: 'conde_sugar_vida', message: `${boss.name} crava as presas, sedento por vida!` };
            }
            if (ready('conde_enxame_morcegos') && Utils.chance(enraged ? 40 : 25)) {
                return { action: 'SKILL', param: 'conde_enxame_morcegos', message: `${boss.name} invoca um enxame de morcegos sanguinários!` };
            }
            if (ready('conde_garras_sombrias') && Utils.chance(50)) {
                return { action: 'SKILL', param: 'conde_garras_sombrias', message: `${boss.name} ataca com garras sombrias!` };
            }
            return { action: 'ATK', message: `${boss.name} ataca com brutalidade vampírica!` };
        }
    },

    // ==================================================================
    // ANJO GUARDIÃO — disciplinado e defensivo: protege-se, se cura, e só
    // desfere seu golpe mais forte quando encurralado.
    // ==================================================================
    anjo_guardiao: {
        decideAction(battle) {
            const boss = battle.enemy;
            const hpFrac = boss.currentHp / boss.derivedStats.maxHp;
            const range = boss.getWeaponRange ? boss.getWeaponRange() : { min: 0, max: 10 };
            // Bug de auditoria ("magia infinita"): ver mesmo comentário em
            // conde_vampiro acima — agora também exige mana suficiente.
            const ready = id => boss.isSkillReady(id) && boss.currentMp >= window.SkillDB[id].mpCost;

            // Bug de auditoria: Anjo Guardião usa lança (spear: minRange 2,
            // maxRange 5), mas essa árvore só tratava "longe demais" — nunca
            // "perto demais". Um jogador que avançasse até distância 0-1
            // prendia o boss pra sempre: !isInRange(range) ficava true (por
            // estar ABAIXO do mínimo, não acima do máximo), então ela só
            // tentava Raio Sagrado (cooldown de 3 turnos) ou "avançar" (sem
            // efeito real, já que aproximar de quem já está colado não muda
            // nada) — nunca reabria distância pra usar cura/barreira/ataque/
            // julgamento final, todos só alcançáveis no branch "em alcance"
            // abaixo. Agora espelha o gate de duas vias já usado pela IA
            // comum (ver ai.js, decideAction): recua quando perto demais,
            // só cai no caso "longe demais" quando realmente está acima do
            // alcance máximo.
            if (battle.distance < range.min) {
                const speed = boss.getWeaponSpeed();
                const needed = range.min - battle.distance;
                const amount = Math.min(speed.retreatSpeed, Math.max(needed, 0.5));
                return { action: 'RETREAT', amount, message: `${boss.name} recua, reabrindo espaço para lutar com sua lança.` };
            }
            if (battle.distance > range.max) {
                if (ready('anjo_raio_sagrado')) {
                    return { action: 'SKILL', param: 'anjo_raio_sagrado', message: `${boss.name} pune à distância com luz pura!` };
                }
                return { action: 'APPROACH', message: `${boss.name} avança para restabelecer a distância de combate.` };
            }

            const desperate = hpFrac <= 0.3;

            if (desperate && ready('anjo_julgamento_final') && Utils.chance(55)) {
                return { action: 'SKILL', param: 'anjo_julgamento_final', message: `${boss.name} invoca o Julgamento Final!` };
            }
            if (hpFrac < 0.45 && ready('anjo_cura_divina') && Utils.chance(60)) {
                return { action: 'SKILL', param: 'anjo_cura_divina', message: `${boss.name} se envolve em luz curativa!` };
            }
            if (!battle.enemyState.shieldTurns && ready('anjo_barreira') && Utils.chance(35)) {
                return { action: 'SKILL', param: 'anjo_barreira', message: `${boss.name} ergue uma barreira celestial!` };
            }
            if (ready('anjo_raio_sagrado') && Utils.chance(55)) {
                return { action: 'SKILL', param: 'anjo_raio_sagrado', message: `${boss.name} desfere um Raio Sagrado!` };
            }
            return { action: 'ATK', message: `${boss.name} golpeia com força celestial!` };
        }
    },

    // ==================================================================
    // GROKMAR, A FÚRIA DESPERTA — Boss Especial da Arena Orc (ver enemy.js
    // ARENA_BOSS_DEFS). Mecânica própria: FÚRIA CRESCENTE. Cada golpe que
    // Grokmar RECEBE acumula fúria (ver battle.js executeAttack); ao cruzar
    // cada limiar, ele fica permanentemente mais forte e mais imprudente
    // pelo resto da luta — o jogador precisa decidir entre terminar rápido
    // (arriscando enfrentar a fúria máxima) ou jogar com cautela (dando
    // tempo pra fúria crescer sozinha a cada troca de golpes). Nenhum HP/
    // STR/DEF extra é dado de graça — só o que a própria fúria concede.
    grokmar_furia: {
        decideAction(battle) {
            const boss = battle.enemy;
            const hpFrac = boss.currentHp / boss.derivedStats.maxHp;
            const range = boss.getWeaponRange ? boss.getWeaponRange() : { min: 0, max: 2 };
            const ready = id => boss.isSkillReady(id) && boss.currentMp >= window.SkillDB[id].mpCost;
            const fury = boss.furyStacks || 0;

            // Transição de limiar de fúria — aplicada UMA VEZ por limiar
            // (guardado por boss.furyTier), nunca reaplicada a cada turno.
            // Tier 1 (fúria >= 40): +25% de dano físico. Tier 2 (fúria >=
            // 75): mais +30% de dano (cumulativo) e +15% de crítico —
            // Grokmar abandona toda cautela. A mudança é sempre anunciada
            // no log (mecânica precisa ser LEGÍVEL, pedido explícito da
            // diretiva), igual à transição de fase dos Campeões da Ladder.
            const targetTier = fury >= 75 ? 2 : (fury >= 40 ? 1 : 0);
            if (targetTier > boss.furyTier) {
                boss.furyTier = targetTier;
                if (targetTier === 1) {
                    boss.derivedStats.physicalDamage = Math.floor(boss.derivedStats.physicalDamage * 1.25);
                    return { action: 'ATK', message: `${boss.name} sente o próprio sangue escorrer e ENTRA EM FÚRIA! Seus golpes ficam mais brutais!` };
                }
                boss.derivedStats.physicalDamage = Math.floor(boss.derivedStats.physicalDamage * 1.3);
                boss.derivedStats.critChance = Math.min(95, (boss.derivedStats.critChance || 0) + 15);
                return { action: 'ATK', message: `${boss.name} perde toda a cautela — FÚRIA TOTAL! Cada golpe agora é implacável!` };
            }

            if (!battle.isInRange(range)) {
                return { action: 'APPROACH', message: `${boss.name} avança pesadamente, machado em punho!` };
            }

            const enraged = boss.furyTier >= 1;
            const desperate = boss.furyTier >= 2;

            // Na fúria máxima, arrisca o golpe final desesperado com mais
            // frequência, mesmo com HP alto — a fúria, não o HP, o guia.
            if (desperate && ready('grokmar_ultimo_fio') && Utils.chance(50)) {
                return { action: 'SKILL', param: 'grokmar_ultimo_fio', message: `${boss.name} golpeia sem qualquer defesa, movido pela fúria total!` };
            }
            if (enraged && ready('grokmar_investida_furiosa') && Utils.chance(45)) {
                return { action: 'SKILL', param: 'grokmar_investida_furiosa', message: `${boss.name} investe com fúria bruta!` };
            }
            if (ready('grokmar_machadada_dupla') && Utils.chance(enraged ? 50 : 35)) {
                return { action: 'SKILL', param: 'grokmar_machadada_dupla', message: `${boss.name} golpeia duas vezes com o machado de guerra!` };
            }
            return { action: 'ATK', message: `${boss.name} ataca com força orc bruta!` };
        }
    }
};
window.BossAI = {
    decide(bossId, battle) {
        const brain = BOSS_AI[bossId];
        if (!brain) return { action: 'ATK', message: `${battle.enemy.name} ataca!` };
        return brain.decideAction(battle);
    }
};

// Lista de habilidades exclusivas por boss — usada por createBoss (enemy.js)
// pra preencher boss.aiSkills, e por ui.js (barra de mana) pra achar a
// habilidade mais barata do combatente sem precisar de nenhum caso especial
// pra bosses (que nunca passam por AICombat.assignProfile, então nunca
// ganhavam `.aiSkills` como qualquer outro inimigo).
window.BOSS_SKILL_IDS = {
    conde_vampiro: ['conde_garras_sombrias', 'conde_sugar_vida', 'conde_enxame_morcegos', 'conde_garra_final'],
    anjo_guardiao: ['anjo_raio_sagrado', 'anjo_cura_divina', 'anjo_barreira', 'anjo_julgamento_final'],
    grokmar_furia: ['grokmar_machadada_dupla', 'grokmar_investida_furiosa', 'grokmar_ultimo_fio']
};
