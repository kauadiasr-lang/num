/**
 * village/economy.js — Celeiro, coleta, partilha e escassez (v1.3).
 *
 * O CELEIRO é um baú REAL: o primeiro baú encontrado perto do centro da
 * vila vira o depósito comunal. Nada é simulado — o livro-razão da vila
 * (v.ledger) é um ESPELHO do conteúdo físico do baú, reescaneado em
 * rodízio. O jogador pode abrir o baú e ver a riqueza da vila.
 *
 * COLETA ("os aldeões arrumam a vila"): itens LARGADOS no chão perto do
 * centro são recolhidos para o celeiro (a entidade do item some, o item
 * aparece no baú). Se um JOGADOR está por perto quando a coleta pega
 * comida/valores, conta como DOAÇÃO testemunhada: +honra (honor.js).
 *
 * PARTILHA: com fartura de comida (e fome de crescimento), a vila
 * distribui pão FÍSICO: tira do baú e solta perto de aldeões — que o
 * PEGAM DE VERDADE (pickup vanilla), ficando dispostos a ter filhos:
 * nascimentos 100% reais pelo mecanismo nativo de disposição.
 *
 * ESCASSEZ: flags derivadas do estoque real mudam o comportamento:
 * pouca comida → fazendeiros com prioridade (jobs.js) e partilha
 * suspensa; sem madeira → reparos pausam; ferro/esmeralda financiam
 * guardas (guards.js debita do baú). Economia com consequência física.
 */
import { world, system, ItemStack } from "@minecraft/server";
import { markDirty } from "./registry.js";
import { creditHonor } from "./honor.js";

const FOOD = new Set([
  "minecraft:bread", "minecraft:carrot", "minecraft:potato",
  "minecraft:beetroot", "minecraft:wheat", "minecraft:baked_potato",
  "minecraft:apple", "minecraft:pumpkin", "minecraft:melon_slice"
]);
const WOOD = (id) => id.includes("planks") || id.includes("log");
const TOOL = (id) =>
  id.includes("_axe") || id.includes("_hoe") || id.includes("_shovel") ||
  id.includes("_pickaxe") || id.includes("_sword");

/** Localiza (uma vez) o baú do celeiro perto do centro. */
function findGranary(v, dim) {
  if (v.granary) {
    try {
      const b = dim.getBlock(v.granary);
      if (b && b.typeId === "minecraft:chest") return b;
    } catch {
      return null; // chunk fora agora; tenta na próxima fatia
    }
    v.granary = null; // baú sumiu: procurar outro
    markDirty();
  }
  // Varredura em anel raso ao redor do centro (7×7×4 = 196 blocos, uma
  // vez por fatia de economia até achar — depois nunca mais).
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dy = -1; dy <= 2; dy++) {
        const loc = { x: v.x + dx, y: 63 + dy, z: v.z + dz };
        let b;
        try {
          b = dim.getBlock(loc);
        } catch {
          continue;
        }
        if (b && b.typeId === "minecraft:chest") {
          v.granary = { x: loc.x, y: loc.y, z: loc.z };
          markDirty();
          return b;
        }
      }
    }
  }
  return null;
}

function containerOf(block) {
  try {
    const inv = block.getComponent("minecraft:inventory");
    return inv ? inv.container : null;
  } catch {
    return null;
  }
}

/** Reescaneia o baú e espelha no livro-razão. */
function recount(v, container) {
  const ledger = { food: 0, wood: 0, iron: 0, emeralds: 0, tools: 0 };
  for (let i = 0; i < container.size; i++) {
    let it;
    try {
      it = container.getItem(i);
    } catch {
      continue;
    }
    if (!it) continue;
    const id = it.typeId;
    if (FOOD.has(id)) ledger.food += it.amount;
    else if (WOOD(id)) ledger.wood += it.amount;
    else if (id === "minecraft:iron_ingot") ledger.iron += it.amount;
    else if (id === "minecraft:emerald") ledger.emeralds += it.amount;
    else if (TOOL(id)) ledger.tools += it.amount;
  }
  v.ledger = ledger;
  v.flags.foodShort = ledger.food < 8;
  v.flags.woodShort = ledger.wood < 4;
  markDirty();
}

/** Debita N itens de um tipo do celeiro (true se conseguiu). */
export function withdraw(v, dim, matchFn, count) {
  const chest = v.granary && findGranary(v, dim);
  if (!chest) return false;
  const c = containerOf(chest);
  if (!c) return false;
  let left = count;
  for (let i = 0; i < c.size && left > 0; i++) {
    let it;
    try {
      it = c.getItem(i);
    } catch {
      continue;
    }
    if (!it || !matchFn(it.typeId)) continue;
    const take = Math.min(left, it.amount);
    left -= take;
    try {
      if (it.amount - take <= 0) c.setItem(i, undefined);
      else {
        it.amount -= take;
        c.setItem(i, it);
      }
    } catch {
      return false;
    }
  }
  if (left < count) recount(v, c);
  return left === 0;
}

export const isWood = WOOD;
export const isFood = (id) => FOOD.has(id);

/** Tarefa de vila: celeiro + coleta + partilha. */
export function economyTask(v, cfg) {
  if (!cfg.villageEconomy) return;
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }
  const chest = findGranary(v, dim);
  if (!chest) return; // vila sem baú central: economia adormece
  const container = containerOf(chest);
  if (!container) return;

  // 1) Coleta: itens no chão perto do centro entram no baú (físico).
  let collected = 0;
  let donorNear = false;
  try {
    const drops = dim.getEntities({
      location: { x: v.x, y: 64, z: v.z },
      maxDistance: 16,
      type: "minecraft:item"
    });
    for (const drop of drops) {
      if (collected >= 4) break; // orçamento da fatia
      let stack;
      try {
        stack = drop.getComponent("minecraft:item").itemStack;
      } catch {
        continue;
      }
      if (!stack) continue;
      try {
        const leftover = container.addItem(stack);
        if (!leftover) {
          drop.remove();
          collected++;
        }
      } catch {
        break; // baú cheio/indisponível
      }
    }
    if (collected > 0) {
      const players = dim.getPlayers({
        location: { x: v.x, y: 64, z: v.z },
        maxDistance: 12
      });
      for (const p of players) {
        donorNear = true;
        creditHonor(v, p, 2, "doação"); // doação testemunhada
        break;
      }
      dim.playSound("random.pop", { x: v.x, y: 65, z: v.z }, { volume: 0.5 });
    }
  } catch {
    /* área indisponível */
  }

  // 2) Recontagem (espelho fiel do baú).
  recount(v, container);

  // 3) Partilha: fartura → pão físico para aldeões (disposição REAL).
  if (!v.flags.foodShort && v.ledger.food >= 16 && !v.flags.lockdown) {
    const last = v.flags.shareTick || 0;
    if (system.currentTick - last >= 2400) { // 2 min entre partilhas
      v.flags.shareTick = system.currentTick;
      markDirty();
      if (withdraw(v, dim, (id) => FOOD.has(id), 2)) {
        try {
          const folks = dim.getEntities({
            location: { x: v.x, y: 64, z: v.z },
            maxDistance: 24,
            families: ["villager"]
          });
          let fed = 0;
          for (const p of folks) {
            if (fed++ >= 2) break;
            dim.spawnItem(
              new ItemStack("minecraft:bread", 1),
              { x: p.location.x, y: p.location.y + 1, z: p.location.z }
            );
            try {
              dim.spawnParticle("minecraft:heart_particle", {
                x: p.location.x, y: p.location.y + 2, z: p.location.z
              });
            } catch {
              /* sem partícula */
            }
          }
        } catch {
          /* ignorar */
        }
      }
    }
  }
}
