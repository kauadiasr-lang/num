/**
 * world/warmind.js — Memória de guerra regional (v1.4).
 *
 * Os monstros APRENDEM com o resultado dos combates, por região
 * (células de 64 blocos, mesma fábrica regionmem de vila/fauna):
 *
 *  PAVOR (dread): cada monstro morto por jogador soma 1 ponto na célula.
 *   Farmar mobs no mesmo lugar ensina os sobreviventes: ali eles recuam
 *   mais cedo, emboscam mais e preferem flanquear a avançar de frente.
 *  VALOR (valor): cada JOGADOR morto por monstro soma 2 pontos — vitórias
 *   deixam os bandos da região audazes (recuam menos).
 *
 * A CAUTELA efetiva de um cérebro = nível de pavor − nível de valor
 * (−3..+3), cacheada no próprio cérebro por 200 ticks (duas leituras de
 * mapa em RAM — custo por passada ~zero). Ambas as memórias decaem em
 * 1 dia de jogo: a lição esquece com o tempo de paz, como tudo aqui.
 *
 * Consumidores: tactics.js (limiar de retirada e elegibilidade de
 * emboscada), squad.js (viés de flanco) e devtools (linha "cautela").
 */
import { world, system } from "@minecraft/server";
import { createRegionalMemory } from "./regionmem.js";
import { getConfig } from "../core/config.js";
import { hasFamily } from "../core/utils.js";

const dread = createRegionalMemory({
  prop: "neuro:dreadmem",
  cell: 64,
  maxRegions: 24,
  decayTicks: 24000, // 1 dia de jogo
  maxPoints: 6
});

const valor = createRegionalMemory({
  prop: "neuro:valormem",
  cell: 64,
  maxRegions: 24,
  decayTicks: 24000,
  maxPoints: 6
});

/** Cautela da região (−3 audaz .. +3 apavorado). */
export function cautionAt(dimension, loc) {
  return dread.level(dimension, loc) - valor.level(dimension, loc);
}

/** Cautela do cérebro, cacheada por 200 ticks (leitura barata). */
export function cautionOf(brain) {
  const cfg = getConfig();
  if (!cfg.combatLearning) return 0;
  const now = system.currentTick;
  if (
    brain.caution !== undefined &&
    brain.cautionTick !== undefined &&
    now - brain.cautionTick < 200
  ) {
    return brain.caution;
  }
  let c = 0;
  try {
    c = cautionAt(brain.entity.dimension, brain.entity.location);
  } catch {
    c = 0;
  }
  brain.caution = c;
  brain.cautionTick = now;
  return c;
}

export function initWarmind() {
  world.afterEvents.entityDie.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.combatLearning) return;
    const dead = ev.deadEntity;
    const killer = ev.damageSource && ev.damageSource.damagingEntity;
    if (!dead || !killer) return;
    try {
      if (
        killer.typeId === "minecraft:player" &&
        hasFamily(dead, "monster")
      ) {
        // Um massacre por vez: o pavor cresce ponto a ponto.
        dread.record(dead.dimension, dead.location, 1);
      } else if (
        dead.typeId === "minecraft:player" &&
        hasFamily(killer, "monster")
      ) {
        // A vitória pesa mais que a derrota — e vira lenda local.
        valor.record(dead.dimension, dead.location, 2);
      }
    } catch {
      /* dimensão indisponível */
    }
  });
}
