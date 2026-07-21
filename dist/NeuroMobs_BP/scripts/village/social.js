/**
 * village/social.js — Vida social visível (v1.3).
 *
 * CONVERSAS COM CORPO: pares de aldeões próximos se ENCARAM de verdade
 * (setRotation mútuo), com som vanilla e emote. Se um dos dois carrega
 * um BOATO de crime (crime.js), a fofoca CONTAGIA: o outro passa a
 * saber, com nuvem de raiva — informação viajando fisicamente pela
 * vila, par a par.
 *
 * CRIANÇAS BRINCAM: bebês a <6 blocos um do outro ganham arrancadas de
 * velocidade, pulinhos (applyImpulse) e partículas felizes — pega-pega
 * emergente com o pathing nativo.
 *
 * PÔR DO SOL: no crepúsculo, aldeões CURIOSOS (persona) se viram para o
 * oeste e contemplam (felicidade +). CHUVA: aconchego — regeneração
 * breve e menos conversa (o ritmo da vila muda com o céu).
 *
 * PRESENTES: aldeões GENEROSOS (persona.giving alta) tiram um pão do
 * celeiro e o entregam fisicamente a um vizinho (item de verdade,
 * pickup de verdade) — generosidade com custo e efeito reais.
 *
 * Tudo roda como UMA tarefa por fatia do escalonador de vilas, com
 * caps duros — custo constante.
 */
import { world, system, ItemStack } from "@minecraft/server";
import { centerOf } from "./registry.js";
import { knowsRumor, plantRumor } from "./crime.js";
import { nudgeMood } from "./persona.js";
import { withdraw } from "./economy.js";
import { weatherOf } from "../world/moods.js";
import * as V from "../core/utils.js";

function faceEachOther(a, b) {
  try {
    const d = V.sub(b.location, a.location);
    const yawA = (Math.atan2(-d.x, d.z) * 180) / Math.PI;
    a.setRotation({ x: 0, y: yawA });
    b.setRotation({ x: 0, y: yawA + 180 });
  } catch {
    /* ignorar */
  }
}

function personaOf(e) {
  try {
    const raw = e.getDynamicProperty("neuro:persona");
    if (typeof raw === "string") return JSON.parse(raw);
  } catch {
    /* ignorar */
  }
  return null;
}

/** Tarefa de vila: um "momento social" por fatia. */
export function socialTask(v, cfg) {
  if (!cfg.villageSocial) return;
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }
  const center = centerOf(v);
  let time = 6000, raining = false;
  try {
    time = world.getTimeOfDay();
  } catch {
    /* segue */
  }

  let adults = [];
  let kids = [];
  try {
    const folks = dim.getEntities({
      location: center, maxDistance: 40, families: ["villager"]
    });
    for (const f of folks) {
      let baby = false;
      try {
        baby = !!f.getComponent("minecraft:is_baby");
      } catch {
        continue;
      }
      (baby ? kids : adults).push(f);
      if (adults.length + kids.length >= 14) break;
    }
  } catch {
    return;
  }

  // 1) Crianças brincando (prioridade: é o momento mais charmoso).
  if (kids.length >= 2) {
    const a = kids[0], b = kids[1];
    if (V.distSq(a.location, b.location) < 64) {
      V.tryEffect(a, "speed", 80, 1);
      V.tryEffect(b, "speed", 80, 1);
      try {
        a.applyImpulse({ x: 0, y: 0.18, z: 0 });
        dim.spawnParticle("minecraft:villager_happy", {
          x: b.location.x, y: b.location.y + 1.4, z: b.location.z
        });
        if (Math.random() < 0.3) {
          dim.playSound("mob.villager.haggle", a.location, {
            volume: 0.5, pitch: 1.6
          });
        }
      } catch {
        /* ignorar */
      }
      nudgeMood(a, 1, 0);
      return;
    }
  }

  // 2) Pôr do sol: curiosos contemplam o oeste.
  if (time >= 11500 && time < 13000) {
    for (const a of adults) {
      const p = personaOf(a);
      if (!p || p.curious < 7) continue;
      try {
        a.setRotation({ x: -10, y: 90 }); // oeste
        dim.spawnParticle("minecraft:villager_happy", {
          x: a.location.x, y: a.location.y + 2, z: a.location.z
        });
      } catch {
        /* ignorar */
      }
      nudgeMood(a, 1, -1);
      return;
    }
  }

  // 3) Chuva: aconchego (e a conversa diminui — só 50% das fatias seguem).
  {
    const w = weatherOf(v.dim);
    raining = w === "Rain" || w === "Thunder";
  }
  if (raining) {
    if (adults.length > 0 && Math.random() < 0.5) {
      const a = adults[Math.floor(Math.random() * adults.length)];
      V.tryEffect(a, "regeneration", 60, 0);
      nudgeMood(a, 1, -1);
      return;
    }
  }

  // 4) Conversa: par mais próximo se encara; fofoca contagia.
  for (let i = 0; i < adults.length; i++) {
    for (let j = i + 1; j < adults.length; j++) {
      const a = adults[i], b = adults[j];
      if (V.distSq(a.location, b.location) > 16) continue;
      const pa = personaOf(a);
      if (pa && pa.social < 3 && Math.random() < 0.6) continue; // tímido
      faceEachOther(a, b);
      const ra = knowsRumor(a.id), rb = knowsRumor(b.id);
      if (ra && !rb) {
        plantRumor(b.id, ra.playerId);
        nudgeMood(b, -1, 1);
        try {
          dim.spawnParticle("minecraft:villager_angry", {
            x: b.location.x, y: b.location.y + 2.2, z: b.location.z
          });
          dim.playSound("mob.villager.no", a.location, { volume: 0.6 });
        } catch {
          /* ignorar */
        }
      } else {
        try {
          dim.playSound(
            Math.random() < 0.5 ? "mob.villager.idle" : "mob.villager.haggle",
            a.location,
            { volume: 0.7 }
          );
          dim.spawnParticle("minecraft:villager_happy", {
            x: a.location.x, y: a.location.y + 2, z: a.location.z
          });
        } catch {
          /* ignorar */
        }
        nudgeMood(a, 1, 0);
      }
      // 5) Presente: generoso + celeiro com sobra → pão físico ao vizinho.
      if (
        pa && pa.giving >= 8 && cfg.villageEconomy &&
        !v.flags.foodShort &&
        system.currentTick - (v.flags.giftTick || 0) > 4800
      ) {
        if (withdraw(v, dim, (id) => id === "minecraft:bread", 1)) {
          v.flags.giftTick = system.currentTick;
          try {
            dim.spawnItem(
              new ItemStack("minecraft:bread", 1),
              { x: b.location.x, y: b.location.y + 1, z: b.location.z }
            );
            dim.spawnParticle("minecraft:heart_particle", {
              x: b.location.x, y: b.location.y + 2, z: b.location.z
            });
          } catch {
            /* ignorar */
          }
        }
      }
      return;
    }
  }
}
