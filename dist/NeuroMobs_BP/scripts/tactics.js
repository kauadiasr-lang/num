/**
 * tactics.js — Emboscadas, retirada tática e liderança (v0.7).
 *
 * EMBOSCADA (ambush): um corpo a corpo que engaja SOZINHO, longe e sem
 * ser visto pelo jogador, SEGURA o ataque (grupo neuro:ambush congela o
 * avanço) enquanto o grito de alerta — que continua acontecendo — traz
 * aliados. O bote sai quando: 2+ aliados chegam, o jogador o encara,
 * chega perto demais, ele apanha, ou após 8 s. Audazes e veteranos nunca
 * emboscam (avançam — sinergia com personalidades).
 *
 * RETIRADA TÁTICA (retreat): ferido abaixo do limiar do seu perfil
 * (cauteloso 40% / normal 30% / audaz 20%) e SEM apoio, o mob desengaja
 * (grupo neuro:retreat: foge do jogador) e corre até o aliado ocioso mais
 * próximo (waypoint próprio); ao chegar, "recruta": alerta o grupo com a
 * última posição do jogador e volta com reforços. Veteranos, creepers e
 * endermen nunca recuam. Durante a retirada este módulo gerencia o
 * próprio waypoint (memoryTick nos ignora — ver guarda em senses.js).
 *
 * LIDERANÇA (leadership): matar um VETERANO quebra a moral — o bando num
 * raio de 16 hesita (Lentidão) e os cautelosos debandam. A aura do líder
 * vivo (pulso de Velocidade no bando) vive no squad.squadTick.
 *
 * Custos: ambushTick/retreatTick entram no escalonador com orçamento
 * (mesmo custo por tick de sempre); moral é evento de morte com teto.
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "./config.js";
import { allBrains, peekBrain } from "./core.js";
import { canSee, startSearch } from "./senses.js";
import { isObserver } from "./squad.js";
import { fxPounce, fxRetreat, fxMoralBreak } from "./fx.js";
import { bump } from "./stats.js";
import * as V from "./utils.js";

const PLAYER = "minecraft:player";
const AMBUSH_SET = new Set([
  "minecraft:zombie",
  "minecraft:husk",
  "minecraft:spider",
  "minecraft:cave_spider",
  "minecraft:drowned",
  "minecraft:wither_skeleton"
]);
const NO_RETREAT = new Set(["minecraft:creeper", "minecraft:enderman"]);

/** Quantos OUTROS cérebros perseguem o mesmo alvo perto de refLoc. */
function alliesOnTarget(brain, targetId, radius, refLoc) {
  let n = 0;
  for (const [, b] of allBrains()) {
    if (b.id === brain.id) continue;
    if (b.targetId !== targetId) continue;
    if (!V.alive(b.entity)) continue;
    if (V.distSq(b.entity.location, refLoc) > radius * radius) continue;
    if (isObserver(b)) continue; // espreitadora não conta como apoio
    n++;
  }
  return n;
}

/** O jogador está olhando para o mob (com visão real)? */
function watchedBy(player, mob) {
  try {
    const toMob = V.norm(V.sub(mob.location, player.location));
    if (V.dot(player.getViewDirection(), toMob) < 0.5) return false;
    return canSee(player, mob, 32, 150);
  } catch {
    return false;
  }
}

function healthFrac(mob) {
  try {
    const h = mob.getComponent("minecraft:health");
    if (!h) return 1;
    const max = h.effectiveMax || h.defaultValue || 20;
    return h.currentValue / max;
  } catch {
    return 1;
  }
}

function endAmbush(brain, pounce) {
  brain.ambushing = false;
  V.tryTrigger(brain.entity, "neuro:ambush_stop");
  if (pounce) {
    V.tryEffect(brain.entity, "speed", 60, 0); // o bote!
    fxPounce(brain.entity); // voz aguda + faíscas: o "gotcha" agora se sente
  }
}

/** Handler por cérebro: máquina de estados da emboscada. */
export function ambushTick(brain, cfg) {
  if (!cfg.ambush) {
    if (brain.ambushing) endAmbush(brain, false);
    return;
  }
  if (!AMBUSH_SET.has(brain.type)) return;
  const mob = brain.entity;
  const target = V.safeTarget(mob);
  if (!target || target.typeId !== PLAYER) {
    if (brain.ambushing) endAmbush(brain, false);
    return;
  }

  if (brain.ambushing) {
    const tooClose = V.distSq(mob.location, target.location) < 36;
    const seen = watchedBy(target, mob);
    const backup =
      alliesOnTarget(brain, target.id, 16, target.location) >= 2;
    if (tooClose || seen || backup || system.currentTick > brain.ambushUntil) {
      endAmbush(brain, true);
    } else {
      V.tryTrigger(mob, "neuro:ambush_start"); // re-sustenta o timer (10 s)
    }
    return;
  }

  // Entrada: só na janela dos 3 s após adquirir o alvo, longe (>8),
  // sozinho, sem ser visto — e nunca para audazes/veteranos.
  if (brain.personality === "bold" || brain.veteran) return;
  if (isObserver(brain)) return; // espreita, não embosca
  if (system.currentTick - (brain.freshAggro || 0) > 60) return;
  if (V.distSq(mob.location, target.location) < 64) return;
  if (watchedBy(target, mob)) return;
  if (alliesOnTarget(brain, target.id, 16, target.location) > 0) return;

  brain.ambushing = true;
  brain.ambushUntil = system.currentTick + 160; // 8 s no máximo
  V.tryTrigger(mob, "neuro:ambush_start");
  bump("ambushes");
}

function beginRetreat(brain) {
  const mob = brain.entity;
  brain.retreating = true;
  brain.retreatUntil = system.currentTick + 300; // 15 s no máximo
  // Uma busca herdada (memória do jogador) apontaria para o waypoint
  // ERRADO: chegar nele contaria como "recrutou" e mandaria o ferido de
  // volta ao combate sem reforço algum. A retirada começa sem busca.
  brain.searching = false;
  brain.waypointId = null;
  V.tryTrigger(mob, "neuro:retreat_start");
  V.tryEffect(mob, "speed", 100, 0); // adrenalina da fuga
  fxRetreat(mob); // fumaça: desengajou (foi buscar reforço, não desistiu)
  bump("retreats");

  // Procura um aliado ocioso para recrutar (waypoint até ele).
  try {
    const allies = mob.dimension.getEntities({
      location: mob.location,
      maxDistance: 32,
      families: ["neuro_smart"]
    });
    for (const ally of allies) {
      if (ally.id === mob.id) continue;
      const ab = peekBrain(ally.id);
      if (ab && (ab.searching || ab.retreating)) continue;
      if (V.safeTarget(ally)) continue;
      startSearch(brain, ally.location); // NÃO toca em lastKnown (pos. do jogador)
      break;
    }
  } catch {
    /* sem recrutas: o grupo de fuga + timers encerram sozinhos */
  }
}

function finishRetreat(brain, cfg, recruited) {
  const mob = brain.entity;
  brain.retreating = false;
  brain.searching = false;
  brain.waypointId = null;
  V.tryTrigger(mob, "neuro:stop_search");
  V.tryTrigger(mob, "neuro:retreat_stop");

  if (recruited && cfg.packAlert && brain.lastKnown) {
    // Recrutamento: acorda o grupo com a última posição do jogador.
    try {
      const pack = mob.dimension.getEntities({
        location: mob.location,
        maxDistance: 12,
        families: ["neuro_smart"]
      });
      let n = 0;
      for (const ally of pack) {
        if (ally.id === mob.id) continue; // não se recruta a si mesmo
        if (n++ >= 5) break;
        V.tryTrigger(ally, "neuro:alert");
        const ab = peekBrain(ally.id);
        if (ab) {
          ab.lastKnown = { ...brain.lastKnown };
          ab.lastSeenTick = system.currentTick;
        }
      }
    } catch {
      /* ignorar */
    }
    V.tryTrigger(mob, "neuro:alert"); // volta com o reforço
  }
}

/** Handler por cérebro: máquina de estados da retirada. */
export function retreatTick(brain, cfg) {
  const mob = brain.entity;

  if (brain.retreating) {
    if (system.currentTick > brain.retreatUntil) {
      finishRetreat(brain, cfg, false);
      return;
    }
    if (brain.searching) {
      const wp = brain.waypointId ? world.getEntity(brain.waypointId) : undefined;
      if (!wp || !wp.isValid) {
        finishRetreat(brain, cfg, false); // ponto de encontro expirou
        return;
      }
      if (V.distSq(mob.location, wp.location) < 9) {
        finishRetreat(brain, cfg, true); // chegou: recruta e volta
        return;
      }
    }
    // Sem recruta a fuga pura continua até retreatUntil (15 s).
    V.tryTrigger(mob, "neuro:retreat_start"); // re-sustenta o timer
    return;
  }

  if (!cfg.retreat) return;
  if (brain.veteran || NO_RETREAT.has(brain.type)) return;
  const target = V.safeTarget(mob);
  if (!target || target.typeId !== PLAYER) return;

  const thr =
    brain.personality === "shy" ? 0.4 :
    brain.personality === "bold" ? 0.2 : 0.3;
  if (healthFrac(mob) > thr) return;
  if (alliesOnTarget(brain, target.id, 20, mob.location) > 0) return; // com apoio, luta

  beginRetreat(brain);
}

/** Moral: matar um veterano desorganiza o bando. */
export function initTactics() {
  world.afterEvents.entityDie.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.leadership) return;
    const dead = ev.deadEntity;
    if (!dead) return;
    let vet = false;
    const b = peekBrain(dead.id);
    if (b && b.veteran) vet = true;
    else {
      try {
        vet = dead.getDynamicProperty("neuro:vet") === true;
      } catch {
        /* ignorar */
      }
    }
    if (!vet) return;
    try {
      fxMoralBreak(dead.location, dead.dimension); // recompensa audível
    } catch {
      /* dimensão indisponível */
    }
    bump("vetKilled");
    try {
      const pack = dead.dimension.getEntities({
        location: dead.location,
        maxDistance: 16,
        families: ["neuro_smart"]
      });
      let n = 0;
      for (const ally of pack) {
        if (n++ >= 6) break;
        V.tryEffect(ally, "slowness", 80, 0); // hesitação
        const ab = peekBrain(ally.id);
        if (ab && ab.personality === "shy" && !NO_RETREAT.has(ab.type)) {
          // Cautelosos debandam (fire-and-forget: o timer JSON limpa).
          V.tryTrigger(ally, "neuro:retreat_start");
        }
      }
    } catch {
      /* ignorar */
    }
  });
}
