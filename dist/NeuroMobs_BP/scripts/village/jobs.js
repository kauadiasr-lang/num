/**
 * village/jobs.js — Profissões que trabalham DE VERDADE (v1.3).
 *
 * A profissão de um aldeão vem do variant da entidade (mapa vanilla do
 * villager_v2; leitura com degradação graciosa). Cada fatia de trabalho
 * escolhe UM profissional presente e executa trabalho FÍSICO:
 *
 *  FAZENDEIRO — plantações maduras num raio de 5 são COLHIDAS de
 *   verdade: o bloco volta ao estágio 0 (replantio) e os produtos
 *   aparecem como itens no chão (o fazendeiro/celeiro os recolhe).
 *   Escassez de comida = fazendeiros com Pressa e fatia dupla.
 *  FERREIROS (armeiro/ferramenteiro/armeiro-de-guerra) — "manutenção":
 *   guardas e golems num raio de 12 recebem Regeneração (reparo real de
 *   vida) com som de bigorna ocasional.
 *  FLECHEIRO — abastece a guarda: guardas próximos ganham Força breve.
 *  BIBLIOTECÁRIO — acumula CONHECIMENTO da vila (0..30); nos marcos 10
 *   e 20 os guardas são PROMOVIDOS (grupos JSON tier2/tier3: mais dano
 *   e resistência — progressão real de civilização).
 *  CLÉRIGO — cura os DOENTES da epidemia (events.js): remove o estado,
 *   partículas felizes.
 *  CONSTRUTOR (pedreiro) — repara PORTAS quebradas das casas
 *   registradas (blocos reais, consumindo madeira do celeiro), apaga
 *   FOGO perto das casas e planta TOCHAS nos postos do perímetro à
 *   noite (segurança real: menos spawn hostil).
 *
 * Diligência (persona) modula a chance de agir na fatia — aldeões
 * preguiçosos existem e se notam. Crianças perto de quem trabalha
 * ganham felicidade ("aprendendo o ofício").
 */
import { world, system, ItemStack } from "@minecraft/server";
import { withdraw, isWood } from "./economy.js";
import { repairNextDoor } from "./housing.js";
import { markDirty } from "./registry.js";
import * as V from "../core/utils.js";

const PROF = {
  1: "farmer", 2: "fisherman", 3: "shepherd", 4: "fletcher",
  5: "librarian", 6: "cartographer", 7: "cleric", 8: "smith",
  9: "smith", 10: "smith", 11: "butcher", 12: "leatherworker", 13: "builder"
};

const CROPS = {
  "minecraft:wheat": {
    max: 7, drops: [["minecraft:wheat", 1], ["minecraft:wheat_seeds", 1]]
  },
  "minecraft:carrots": { max: 7, drops: [["minecraft:carrot", 2]] },
  "minecraft:potatoes": { max: 7, drops: [["minecraft:potato", 2]] },
  "minecraft:beetroot": { max: 7, drops: [["minecraft:beetroot", 1]] }
};

function professionOf(villager) {
  try {
    const variant = villager.getComponent("minecraft:variant");
    return PROF[variant ? variant.value : 0] || "none";
  } catch {
    return "none";
  }
}

function diligenceOf(villager) {
  try {
    const raw = villager.getDynamicProperty("neuro:persona");
    if (typeof raw === "string") return JSON.parse(raw).diligent;
  } catch {
    /* ignorar */
  }
  return 5;
}

function workFx(dim, loc, sound) {
  try {
    dim.spawnParticle("minecraft:crop_growth_emitter", {
      x: loc.x, y: loc.y + 1.5, z: loc.z
    });
    if (sound) dim.playSound(sound, loc, { volume: 0.6 });
  } catch {
    /* ignorar */
  }
}

function farmerWork(v, dim, farmer) {
  const base = {
    x: Math.floor(farmer.location.x),
    y: Math.floor(farmer.location.y),
    z: Math.floor(farmer.location.z)
  };
  let harvested = 0;
  for (let dx = -5; dx <= 5 && harvested < 4; dx++) {
    for (let dz = -5; dz <= 5 && harvested < 4; dz++) {
      for (let dy = -1; dy <= 0; dy++) {
        let block;
        try {
          block = dim.getBlock({ x: base.x + dx, y: base.y + dy, z: base.z + dz });
        } catch {
          continue;
        }
        if (!block) continue;
        const crop = CROPS[block.typeId];
        if (!crop) continue;
        let growth = 0;
        try {
          growth = block.permutation.getState("growth") ?? 0;
        } catch {
          continue;
        }
        if (growth < crop.max) continue;
        // Colheita real: volta ao estágio 0 e materializa os produtos.
        try {
          block.setPermutation(block.permutation.withState("growth", 0));
          for (const [id, n] of crop.drops) {
            dim.spawnItem(new ItemStack(id, n), {
              x: block.location.x + 0.5,
              y: block.location.y + 0.5,
              z: block.location.z + 0.5
            });
          }
          harvested++;
        } catch {
          continue;
        }
      }
    }
  }
  if (harvested > 0) {
    workFx(dim, farmer.location, "mob.villager.yes");
    if (v.flags.foodShort) V.tryEffect(farmer, "haste", 200, 1);
  }
  return harvested > 0;
}

function smithWork(dim, smith) {
  let repaired = 0;
  try {
    const wards = dim.getEntities({
      location: smith.location, maxDistance: 12, families: ["neuro_defender"]
    });
    for (const w of wards) {
      if (repaired++ >= 3) break;
      V.tryEffect(w, "regeneration", 100, 1);
    }
  } catch {
    return false;
  }
  if (repaired > 0) workFx(dim, smith.location, "random.anvil_use");
  return repaired > 0;
}

function fletcherWork(dim, fletcher) {
  let supplied = 0;
  try {
    const guards = dim.getEntities({
      location: fletcher.location, maxDistance: 16, families: ["neuro_guard"]
    });
    for (const g of guards) {
      if (supplied++ >= 3) break;
      V.tryEffect(g, "strength", 400, 0);
    }
  } catch {
    return false;
  }
  if (supplied > 0) workFx(dim, fletcher.location);
  return supplied > 0;
}

function librarianWork(v, dim, librarian) {
  v.knowledge = Math.min(30, (v.knowledge || 0) + 1);
  markDirty();
  workFx(dim, librarian.location, "item.book.page_turn");
  // Promoção dos guardas nos marcos de conhecimento.
  if (v.knowledge === 10 || v.knowledge === 20) {
    const tier = v.knowledge === 10 ? "neuro:tier2" : "neuro:tier3";
    try {
      const guards = dim.getEntities({
        location: { x: v.x, y: 64, z: v.z },
        maxDistance: 64,
        families: ["neuro_guard"]
      });
      for (const g of guards) V.tryTrigger(g, tier);
      world.sendMessage(
        `§6[Crônica]§r A vila estudou: guardas promovidos (${tier === "neuro:tier2" ? "nível 2" : "nível 3"}).`
      );
    } catch {
      /* ignorar */
    }
  }
  return true;
}

function clericWork(dim, cleric) {
  let cured = 0;
  try {
    const sick = dim.getEntities({
      location: cleric.location, maxDistance: 12, families: ["villager"]
    });
    for (const s of sick) {
      if (!s.hasTag("neuro_sick")) continue;
      s.removeTag("neuro_sick");
      V.tryEffect(s, "regeneration", 100, 1);
      try {
        dim.spawnParticle("minecraft:heart_particle", {
          x: s.location.x, y: s.location.y + 2, z: s.location.z
        });
      } catch {
        /* ignorar */
      }
      cured++;
      if (cured >= 2) break;
    }
  } catch {
    return false;
  }
  if (cured > 0) workFx(dim, cleric.location, "random.orb");
  return cured > 0;
}

function builderWork(v, dim, builder) {
  // 1) Porta quebrada? Repara consumindo madeira do celeiro.
  if (!v.flags.woodShort) {
    let pending = false;
    for (const h of v.houses) if (h.broken) pending = true;
    if (pending && withdraw(v, dim, isWood, 2) && repairNextDoor(v, dim)) {
      workFx(dim, builder.location, "use.wood");
      return true;
    }
  }
  // 2) Fogo perto de uma casa? Apaga (bloco a bloco, de verdade).
  for (const h of v.houses) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = 0; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          let b;
          try {
            b = dim.getBlock({ x: h.x + dx, y: h.y + dy, z: h.z + dz });
          } catch {
            continue;
          }
          if (b && b.typeId === "minecraft:fire") {
            try {
              b.setType("minecraft:air");
              dim.playSound("random.fizz", b.location, { volume: 0.8 });
              return true;
            } catch {
              continue;
            }
          }
        }
      }
    }
  }
  // 3) Noite: tochas nos 4 postos do perímetro (segurança real).
  let night = false;
  try {
    night = world.getTimeOfDay() >= 12000;
  } catch {
    /* segue */
  }
  if (night && !v.flags.woodShort) {
    const posts = [
      { x: v.x + 14, z: v.z }, { x: v.x - 14, z: v.z },
      { x: v.x, z: v.z + 14 }, { x: v.x, z: v.z - 14 }
    ];
    for (const post of posts) {
      for (let y = 70; y >= 60; y--) {
        let b, below;
        try {
          b = dim.getBlock({ x: post.x, y, z: post.z });
          below = dim.getBlock({ x: post.x, y: y - 1, z: post.z });
        } catch {
          break;
        }
        if (!b || !below) break;
        if (b.typeId !== "minecraft:air") {
          if (b.typeId === "minecraft:torch") break; // já iluminado
          continue;
        }
        if (below.typeId === "minecraft:air") continue;
        try {
          b.setType("minecraft:torch");
          workFx(dim, { x: post.x, y, z: post.z }, "use.wood");
          return true;
        } catch {
          break;
        }
      }
    }
  }
  return false;
}

/** Tarefa de vila: uma fatia de trabalho de UM profissional. */
export function jobsTask(v, cfg) {
  if (!cfg.villageJobs) return;
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }
  // Só se trabalha de dia (clérigo atende sempre; construtor apaga fogo sempre).
  let day = true;
  try {
    day = world.getTimeOfDay() < 12000;
  } catch {
    /* segue */
  }
  try {
    const folks = dim.getEntities({
      location: { x: v.x, y: 64, z: v.z },
      maxDistance: 48,
      families: ["villager"]
    });
    const rot = v.flags.jobRot || 0;
    const list = [];
    for (const p of folks) {
      list.push(p);
      if (list.length >= 12) break;
    }
    for (let i = 0; i < list.length; i++) {
      const worker = list[(rot + i) % list.length];
      const prof = professionOf(worker);
      if (prof === "none") continue;
      // Preguiça é um traço real: diligência baixa pula fatias.
      if (Math.random() * 14 > diligenceOf(worker) + 5) continue;
      let did = false;
      if (prof === "farmer" && day) did = farmerWork(v, dim, worker);
      else if (prof === "smith") did = smithWork(dim, worker);
      else if (prof === "fletcher" && day) did = fletcherWork(dim, worker);
      else if (prof === "librarian" && day) did = librarianWork(v, dim, worker);
      else if (prof === "cleric") did = clericWork(dim, worker);
      else if (prof === "builder") did = builderWork(v, dim, worker);
      if (did) {
        v.flags.jobRot = (rot + i + 1) % list.length;
        // Criança por perto aprende olhando (felicidade + partícula).
        try {
          const kids = dim.getEntities({
            location: worker.location, maxDistance: 6, families: ["villager"]
          });
          for (const k of kids) {
            if (k.getComponent("minecraft:is_baby")) {
              dim.spawnParticle("minecraft:villager_happy", {
                x: k.location.x, y: k.location.y + 1.5, z: k.location.z
              });
              break;
            }
          }
        } catch {
          /* ignorar */
        }
        return; // uma ação por fatia
      }
    }
  } catch {
    /* área indisponível */
  }
}
