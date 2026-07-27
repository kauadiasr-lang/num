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
    const defs = [
        // Conde Vampiro
        { id: 'conde_garras_sombrias', name: 'Garras Sombrias', type: 'PHYSICAL', mpCost: 0, powerMulti: 1.9,
            description: 'As garras do Conde rasgam a carne com força sobrenatural.', extra: { cooldown: 2, animation: 'attack' } },
        { id: 'conde_sugar_vida', name: 'Sugar Vida', type: 'LIFESTEAL', mpCost: 0, powerMulti: 1.5,
            description: 'O Conde drena a vitalidade da vítima.', extra: { lifestealPercent: 80, cooldown: 3, animation: 'attack' } },
        { id: 'conde_enxame_morcegos', name: 'Enxame de Morcegos', type: 'MAGIC', mpCost: 0, powerMulti: 2.0,
            description: 'Uma nuvem de morcegos sanguinários ataca de qualquer distância.', extra: { cooldown: 4, range: 10, animation: 'boss_bats' } },
        { id: 'conde_garra_final', name: 'Garra Imortal', type: 'STUN', mpCost: 0, powerMulti: 1.7,
            description: 'Um golpe final que paralisa a vítima de puro terror.', extra: { stunChance: 80, cooldown: 3, animation: 'boss_slam' } },

        // Anjo Guardião
        { id: 'anjo_raio_sagrado', name: 'Raio Sagrado', type: 'MAGIC', mpCost: 0, powerMulti: 2.1,
            description: 'Um feixe de luz pura desce dos céus.', extra: { cooldown: 3, range: 10, animation: 'cast' } },
        { id: 'anjo_cura_divina', name: 'Cura Divina', type: 'HEAL', mpCost: 0, powerMulti: 2.2,
            description: 'O Anjo restaura sua própria vitalidade com luz celestial.', extra: { cooldown: 4, animation: 'cast' } },
        { id: 'anjo_barreira', name: 'Barreira Celestial', type: 'SHIELD', mpCost: 0, powerMulti: 1,
            description: 'Uma barreira de luz absorve grande parte do próximo dano.', extra: { shieldPercent: 50, duration: 2, cooldown: 4, animation: 'cast' } },
        { id: 'anjo_julgamento_final', name: 'Julgamento Final', type: 'MAGIC', mpCost: 0, powerMulti: 3.2,
            description: 'O julgamento definitivo — luz capaz de reduzir um pecador a cinzas.', extra: { cooldown: 5, range: 10, animation: 'boss_judgment' } }
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

            // Gate físico: fora de alcance, sempre avança (o Conde nunca recua)
            if (!battle.isInRange(range)) {
                return { action: 'APPROACH', message: `${boss.name} avança com fome insaciável!` };
            }

            const ready = id => boss.isSkillReady(id);
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
            const ready = id => boss.isSkillReady(id);

            // Corrigido: antes isso disparava Raio Sagrado incondicionalmente
            // fora de alcance, ignorando o próprio cooldown da habilidade —
            // um jogador que só mantivesse distância forçava o boss a lançar
            // o feixe TODO turno, sem nunca respeitar o intervalo de 3 turnos
            // que o resto da IA (inclusive o caso "em alcance" logo abaixo)
            // já respeitava.
            if (!battle.isInRange(range)) {
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
    }
};
window.BossAI = {
    decide(bossId, battle) {
        const brain = BOSS_AI[bossId];
        if (!brain) return { action: 'ATK', message: `${battle.enemy.name} ataca!` };
        return brain.decideAction(battle);
    }
};
