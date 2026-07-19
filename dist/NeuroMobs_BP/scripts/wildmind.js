/**
 * wildmind.js — Pressão de caça (influência do jogador na fauna, v0.9).
 *
 * Cada animal terrestre ABATIDO POR UM JOGADOR soma 1 ponto na célula
 * (64×64). Decaimento de 1 dia de jogo (24 000 ticks). Efeitos (lidos em
 * defense.js, no pânico de rebanho): regiões muito caçadas têm fauna
 * ARISCA — o pânico alcança mais longe e dura mais, e vacas/galinhas
 * passam a evitar jogadores por 20 s (grupo neuro:wary).
 * Caçar sempre no mesmo pasto passa a ter custo; rodar a área, não.
 */
import { createRegionalMemory } from "./regionmem.js";

const wild = createRegionalMemory({
  prop: "neuro:wildmem",
  cell: 64,
  maxRegions: 24,
  decayTicks: 24000, // 1 dia de jogo
  maxPoints: 6
});

/** Registra um abate por jogador na região. */
export function recordHunt(dimension, loc) {
  wild.record(dimension, loc, 1);
}

/** Nível de pressão de caça da região: 0 a 3. */
export function pressureLevel(dimension, loc) {
  return wild.level(dimension, loc);
}
