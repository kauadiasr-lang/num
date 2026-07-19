/**
 * villagemind.js — Memória persistente das vilas.
 *
 * v0.9: a lógica interna foi movida para regionmem.js (fábrica genérica)
 * SEM mudança de chave ("neuro:villmem"), formato ({p,t}) ou parâmetros
 * (células 64, decaimento 72 000, teto 24, pontos 6) — mundos existentes
 * mantêm o trauma acumulado. API pública inalterada.
 */
import { createRegionalMemory } from "./regionmem.js";

const village = createRegionalMemory({
  prop: "neuro:villmem",
  cell: 64,
  maxRegions: 24,
  decayTicks: 72000, // 3 dias de jogo
  maxPoints: 6
});

/** Registra um evento hostil na região (ataque 1, morte 2). */
export function recordVillageEvent(dimension, loc, weight) {
  village.record(dimension, loc, weight);
}

/** Nível de trauma da região: 0 (calma) a 3 (sitiada). */
export function traumaLevel(dimension, loc) {
  return village.level(dimension, loc);
}
