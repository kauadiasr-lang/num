/**
 * village/housing.js — Casas de verdade: posse, portas e reparos (v1.3).
 *
 * DESCOBERTA: a tarefa de moradia examina a vizinhança 5×3×5 de até 2
 * aldeões por fatia (150 getBlock no pior caso — orçamento fixo) atrás
 * de PORTAS. Cada porta vira uma "casa" registrada com posição, estado
 * (direção da porta, para reparo idêntico) e a LINHAGEM do aldeão que a
 * revelou — posse orgânica: quem vive perto, possui.
 *
 * PORTAS FECHAM: em lockdown (crime/ameaça — crime.js liga a flag) ou
 * ao anoitecer, a tarefa fecha portas abertas das casas registradas
 * (setPermutation open_bit=false) — um dos efeitos mais VISÍVEIS da
 * vila viva: o povoado literalmente se tranca.
 *
 * REPARO: se a porta registrada sumiu (quebrada/roubada), a casa entra
 * na fila `broken`; o CONSTRUTOR (jobs.js) a repara de verdade —
 * repondo os dois blocos da porta com a direção original e consumindo
 * madeira do celeiro. Sem construtor ou sem madeira, a casa fica
 * escancarada (consequência real de economia e de mão de obra).
 */
import { world, BlockPermutation } from "@minecraft/server";
import { markDirty, rosterOf } from "./registry.js";

const DOOR_TYPES = [
  "minecraft:wooden_door", "minecraft:oak_door", "minecraft:spruce_door",
  "minecraft:birch_door", "minecraft:jungle_door", "minecraft:acacia_door",
  "minecraft:dark_oak_door", "minecraft:mangrove_door", "minecraft:cherry_door"
];

function isDoor(typeId) {
  return typeId && typeId.includes("_door") && !typeId.includes("iron");
}

function famOf(villager) {
  try {
    const raw = villager.getDynamicProperty("neuro:persona");
    if (typeof raw === "string") return JSON.parse(raw).fam;
  } catch {
    /* ignorar */
  }
  return -1;
}

/** Tarefa de vila: descobrir casas + fechar portas + detectar quebras. */
export function housingTask(v, cfg) {
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }

  // 1) Descoberta ao redor de até 2 aldeões (roster compartilhado).
  try {
    const folks = rosterOf(v);
    let scanned = 0;
    for (const p of folks) {
      if (scanned++ >= 2) break;
      const base = {
        x: Math.floor(p.location.x),
        y: Math.floor(p.location.y),
        z: Math.floor(p.location.z)
      };
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -2; dz <= 2; dz++) {
            const loc = { x: base.x + dx, y: base.y + dy, z: base.z + dz };
            let block;
            try {
              block = dim.getBlock(loc);
            } catch {
              continue;
            }
            if (!block || !isDoor(block.typeId)) continue;
            // Metade de baixo apenas (upper_block_bit false).
            let upper = false, dir = 0;
            try {
              upper = block.permutation.getState("upper_block_bit") === true;
              dir = block.permutation.getState("direction") ?? 0;
            } catch {
              /* estados indisponíveis: registra mesmo assim */
            }
            if (upper) continue;
            const known = v.houses.find(
              (h) => h.x === loc.x && h.y === loc.y && h.z === loc.z
            );
            if (!known && v.houses.length < 16) {
              v.houses.push({
                x: loc.x, y: loc.y, z: loc.z,
                type: block.typeId, dir,
                fam: famOf(p), broken: false
              });
              markDirty();
            }
          }
        }
      }
    }
  } catch {
    /* área indisponível */
  }

  // 2) Vigília das portas registradas: fechar à noite/lockdown; detectar quebra.
  let night = false;
  try {
    const t = world.getTimeOfDay();
    night = t >= 12000;
  } catch {
    /* segue */
  }
  const shut = night || v.flags.lockdown;
  let work = 0;
  for (const h of v.houses) {
    if (work >= 6) break; // orçamento da fatia
    let block;
    try {
      block = dim.getBlock({ x: h.x, y: h.y, z: h.z });
    } catch {
      continue;
    }
    if (!block) continue;
    if (!isDoor(block.typeId)) {
      if (!h.broken) {
        h.broken = true; // entra na fila do construtor (jobs.js)
        markDirty();
      }
      continue;
    }
    if (h.broken) {
      h.broken = false; // alguém já repôs (jogador?) — sai da fila
      markDirty();
    }
    if (shut) {
      try {
        if (block.permutation.getState("open_bit") === true) {
          // Educação: não bater a porta na cara de quem está passando.
          let playerNear = false;
          const near = dim.getPlayers({
            location: { x: h.x + 0.5, y: h.y, z: h.z + 0.5 },
            maxDistance: 3
          });
          for (const _ of near) {
            playerNear = true;
            break;
          }
          if (playerNear) continue;
          block.setPermutation(
            block.permutation.withState("open_bit", false)
          );
          dim.playSound("close.wooden_door", block.location, { volume: 0.7 });
          work++;
        }
      } catch {
        /* estado indisponível nesta versão */
      }
    }
  }
}

/** Repara a próxima porta quebrada (chamado pelo construtor em jobs.js).
 *  Retorna true se um reparo aconteceu. */
export function repairNextDoor(v, dim) {
  for (const h of v.houses) {
    if (!h.broken) continue;
    try {
      const lower = dim.getBlock({ x: h.x, y: h.y, z: h.z });
      const upper = dim.getBlock({ x: h.x, y: h.y + 1, z: h.z });
      if (!lower || !upper) return false;
      // Nunca sobrescrever construção alheia: só repara em espaço VAZIO.
      if (lower.typeId !== "minecraft:air" || upper.typeId !== "minecraft:air") {
        h.broken = false; // o vão foi ocupado: a "casa" mudou; sai da fila
        markDirty();
        continue;
      }
      const type = DOOR_TYPES.includes(h.type) ? h.type : "minecraft:oak_door";
      lower.setPermutation(
        BlockPermutation.resolve(type, {
          direction: h.dir, upper_block_bit: false, open_bit: false
        })
      );
      upper.setPermutation(
        BlockPermutation.resolve(type, {
          direction: h.dir, upper_block_bit: true, open_bit: false
        })
      );
      h.broken = false;
      markDirty();
      dim.playSound("use.wood", lower.location, { volume: 0.9 });
      try {
        dim.spawnParticle("minecraft:crop_growth_emitter", {
          x: h.x + 0.5, y: h.y + 1, z: h.z + 0.5
        });
      } catch {
        /* sem partícula */
      }
      return true;
    } catch {
      return false; // chunk fora / permutation indisponível
    }
  }
  return false;
}

/** Casas quebradas pendentes (para devtools/eventos). */
export function brokenCount(v) {
  let n = 0;
  for (const h of v.houses) if (h.broken) n++;
  return n;
}
