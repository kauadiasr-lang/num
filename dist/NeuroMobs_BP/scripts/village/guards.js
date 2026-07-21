/**
 * village/guards.js — A guarda da vila (v1.3).
 *
 * GUARDAS são uma entidade própria (neuro:guard — JSON 100% nosso, sem
 * mexer no villager_v2): perseguem monstros, protegem o perímetro e
 * ATACAM jogadores fora-da-lei (tag neuro_outlaw — honra ≤ -30). Por
 * pertencerem à família neuro_defender, TODOS os sistemas existentes já
 * os reconhecem: alarme de vila, leque do sino, investigação de
 * explosões, waypoints de busca.
 *
 * RECRUTAMENTO com custo real: ameaça ou prosperidade justificam vaga
 * (teto: 1 + aldeões/4 + bônus de ameaça, máx 4); cada recruta DEBITA
 * do celeiro 2 ferro OU 3 esmeraldas — sem fundos, sem guarda (a
 * economia manda). Morte de guarda vira crônica e vaga reaberta após
 * cooldown.
 *
 * TURNOS: metade da guarda descansa à noite (evento neuro:rest — anda
 * devagar, recebe Regeneração perto do centro), metade patrulha
 * (neuro:duty). As metades ALTERNAM por paridade do dia — escala real.
 *
 * ESCOLTAS: com ameaça ativa, um guarda recebe waypoint para o
 * aglomerado de CRIANÇAS; gado perdido (a >40 do centro) recebe a
 * visita de um guarda (investigação real por waypoint).
 */
import { world, system } from "@minecraft/server";
import { centerOf, threatOf, markDirty } from "./registry.js";
import { withdraw } from "./economy.js";
import { getBrain } from "../core/core.js";
import { startSearch } from "../ai/senses.js";
import { bump } from "../player/stats.js";
import * as V from "../core/utils.js";

const GUARD = "neuro:guard";

/** Tarefa de vila: censo da guarda, recrutamento, turnos e escoltas. */
export function guardsTask(v, cfg) {
  if (!cfg.villageGuards) return;
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }
  const center = centerOf(v);

  // 1) Censo: guardas e aldeões vivos no perímetro.
  let guards = [];
  let villagers = 0;
  try {
    for (const g of dim.getEntities({
      location: center, maxDistance: 64, type: GUARD
    })) {
      guards.push(g);
    }
    for (const _ of dim.getEntities({
      location: center, maxDistance: 64, families: ["villager"]
    })) {
      villagers++;
      if (villagers >= 24) break;
    }
  } catch {
    return;
  }
  // Censo com "despertar": após um hiato (vila dormente/mundo fechado),
  // a diferença vem de chunks descarregados, não de mortes — resync mudo.
  const sinceGuardCensus = system.currentTick - (v.flags.guardCensusTick || 0);
  v.flags.guardCensusTick = system.currentTick;
  if (v.guards > guards.length && sinceGuardCensus <= 2400) {
    try {
      world.sendMessage("§6[Crônica]§r Um guarda da vila tombou em serviço.");
    } catch {
      /* ignorar */
    }
    v.flags.guardLossTick = system.currentTick;
  }
  v.guards = guards.length;
  markDirty();

  // 2) Recrutamento (com custo, cooldown pós-perda e justificativa).
  const threat = threatOf(v);
  const cap = Math.min(4, 1 + Math.floor(villagers / 4) + Math.min(2, Math.floor(threat / 3)));
  const lossCooldown =
    system.currentTick - (v.flags.guardLossTick || 0) < 6000; // 5 min
  const justified = threat >= 1 || v.prosperity >= 2 || villagers >= 8;
  if (guards.length < cap && justified && !lossCooldown && villagers >= 3) {
    const paid =
      withdraw(v, dim, (id) => id === "minecraft:iron_ingot", 2) ||
      withdraw(v, dim, (id) => id === "minecraft:emerald", 3);
    if (paid) {
      try {
        const g = dim.spawnEntity(GUARD, {
          x: center.x + 1.5, y: center.y + 1, z: center.z + 1.5
        });
        g.nameTag = "§bGuarda da Vila§r";
        // Herda o nível de conhecimento atual da vila.
        if ((v.knowledge || 0) >= 20) V.tryTrigger(g, "neuro:tier3");
        else if ((v.knowledge || 0) >= 10) V.tryTrigger(g, "neuro:tier2");
        dim.playSound("random.anvil_use", center, { volume: 0.7 });
        world.sendMessage(
          "§6[Crônica]§r A vila armou um novo §bGuarda§r (pagando do celeiro)."
        );
        bump("guards");
      } catch {
        /* spawn falhou (área protegida?): o débito vale como custo afundado */
      }
    }
  }

  // 3) Turnos: à noite, metade descansa; as metades alternam por dia.
  let night = false, day = 0;
  try {
    night = world.getTimeOfDay() >= 12000;
    day = Math.floor(world.getAbsoluteTime() / 24000);
  } catch {
    /* segue */
  }
  guards.sort((a, b) => (a.id < b.id ? -1 : 1)); // ordem estável
  for (let i = 0; i < guards.length; i++) {
    const g = guards[i];
    const resting = night && (i + day) % 2 === 0 && threat < 3;
    // Só dispara o evento na TRANSIÇÃO (tag marca o estado atual):
    // re-adicionar grupos toda fatia resetava o passeio à toa.
    try {
      const wasResting = g.hasTag("neuro_resting");
      if (resting && !wasResting) {
        g.addTag("neuro_resting");
        V.tryTrigger(g, "neuro:rest");
      } else if (!resting && wasResting) {
        g.removeTag("neuro_resting");
        V.tryTrigger(g, "neuro:duty");
      }
    } catch {
      continue;
    }
    if (resting) {
      V.tryEffect(g, "regeneration", 200, 0);
      // Descanso é NO posto: longe do centro, waypoint de volta.
      if (V.distSq(g.location, center) > 20 * 20) {
        const b = getBrain(g);
        if (!b.searching && !V.safeTarget(g)) {
          b.lastKnown = { ...center };
          b.lastSeenTick = system.currentTick;
          startSearch(b, center);
        }
      }
    }
  }

  // 4) Escoltas: crianças (sob ameaça) e gado perdido.
  if (guards.length > 0) {
    try {
      if (threat >= 1) {
        const kids = dim.getEntities({
          location: center, maxDistance: 48, families: ["villager"]
        });
        for (const k of kids) {
          let baby = false;
          try {
            baby = !!k.getComponent("minecraft:is_baby");
          } catch {
            continue;
          }
          if (!baby) continue;
          const g = guards[0];
          const b = getBrain(g);
          if (!b.searching && !V.safeTarget(g) &&
              V.distSq(g.location, k.location) > 10 * 10) {
            b.lastKnown = { ...k.location };
            b.lastSeenTick = system.currentTick;
            startSearch(b, k.location);
          }
          break;
        }
      }
      // Gado longe demais: um guarda visita (pastoreio honesto).
      const lastShep = v.flags.shepherdTick || 0;
      if (system.currentTick - lastShep > 4800 && guards.length > 1) {
        for (const type of ["minecraft:cow", "minecraft:sheep", "minecraft:chicken"]) {
          const strays = dim.getEntities({
            location: center, maxDistance: 80, type
          });
          for (const s of strays) {
            if (V.distSq(s.location, center) < 40 * 40) continue;
            const g = guards[guards.length - 1];
            const b = getBrain(g);
            if (!b.searching && !V.safeTarget(g)) {
              v.flags.shepherdTick = system.currentTick;
              b.lastKnown = { ...s.location };
              b.lastSeenTick = system.currentTick;
              startSearch(b, s.location);
            }
            return;
          }
        }
      }
    } catch {
      /* ignorar */
    }
  }
}
