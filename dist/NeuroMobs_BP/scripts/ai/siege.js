/**
 * siege.js — Resposta anti-torre.
 *
 * Detecção: o alvo está 3+ blocos acima do mob e a menos de 6 blocos na
 * horizontal por várias passadas consecutivas do cérebro (~alguns segundos)
 * => o jogador subiu num pilar/plataforma.
 *
 * Reações por classe:
 *  - Corpo a corpo (zumbi, husk, aranhas, drowned): "modo cerco" — em vez de
 *    se amontoar inutilmente na base, circulam a 4–9 blocos aguardando
 *    (grupo neuro:siege). Descer do pilar = ser cercado.
 *  - Creeper (opcional, `creeperBreach`): se conseguir encostar na base do
 *    pilar, detona — derruba o apoio do jogador. A destruição de blocos
 *    respeita o gamerule mobGriefing (destroy_affected_by_griefing).
 *  - À distância (esqueleto/stray/bruxa): nada a fazer — já atiram para cima.
 *  - Enderman: teleporta até o alvo (perseguição vertical nativa do
 *    componente minecraft:teleport).
 */
import { isObserver } from "./squad.js";
import { bump } from "../player/stats.js";
import * as V from "../core/utils.js";

const PLAYER = "minecraft:player";

/** Mobs corpo a corpo que possuem o grupo neuro:siege no JSON. */
const MELEE_SIEGE = new Set([
  "minecraft:zombie",
  "minecraft:husk",
  "minecraft:spider",
  "minecraft:cave_spider",
  "minecraft:drowned",
  "minecraft:wither_skeleton"
]);

function clearSiege(brain) {
  brain.towerTicks = 0;
  brain.breachFired = false; // creeper pode detonar de novo num próximo cerco
  if (brain.sieging) {
    brain.sieging = false;
    V.tryTrigger(brain.entity, "neuro:siege_stop");
  }
}

/** Handler por cérebro (registrado no escalonador). */
export function siegeTick(brain, cfg) {
  if (!cfg.antiTower) {
    clearSiege(brain);
    return;
  }
  const mob = brain.entity;
  const target = V.safeTarget(mob);
  if (!target || target.typeId !== PLAYER) {
    clearSiege(brain);
    return;
  }
  if (isObserver(brain)) {
    clearSiege(brain); // espreitadora diurna não entra em modo cerco
    return;
  }

  const dy = target.location.y - mob.location.y;
  const dx = target.location.x - mob.location.x;
  const dz = target.location.z - mob.location.z;
  const horiz2 = dx * dx + dz * dz;

  const towered = dy >= 3 && horiz2 < 36; // 3+ acima, < 6 na horizontal
  if (!towered) {
    clearSiege(brain);
    return;
  }

  // Exige ~3 passadas consecutivas (histerese contra pulos/escadas).
  brain.towerTicks = (brain.towerTicks || 0) + 1;
  if (brain.towerTicks < 3) return;

  if (brain.type === "minecraft:creeper") {
    // Encostou na base do pilar? Detona o apoio — UMA vez por cerco:
    // re-disparar a cada passada re-adiciona o grupo forced_exploding e
    // RESETA o pavio de 1,5 s (passadas vêm a cada ~0,4 s), deixando o
    // creeper chiando para sempre sem explodir.
    if (cfg.creeperBreach && horiz2 < 2.9 && !brain.breachFired) {
      brain.breachFired = true;
      V.tryTrigger(mob, "minecraft:start_exploding_forced");
    }
    return;
  }

  if (MELEE_SIEGE.has(brain.type)) {
    if (!brain.sieging) bump("sieges"); // conta só a ENTRADA no cerco
    brain.sieging = true;
    // Re-dispara a cada passada: sustenta o timer de segurança (15 s).
    V.tryTrigger(mob, "neuro:siege_start");
  }
}
