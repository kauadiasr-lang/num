/**
 * senses.js — Percepção, memória e busca ativa.
 *
 * canSee(): campo de visão realista = distância + cone frontal (produto
 * escalar) + raycast de oclusão contra blocos.
 *
 * Memória: enquanto o mob vê o alvo, gravamos posição/tick. Ao perder o
 * alvo, o mob entra em busca: um waypoint invisível é criado na última
 * posição conhecida e um component group faz o mob "caçar" o waypoint
 * (o pathfinder nativo cuida da rota). Chegando lá — ou ao reavistar o
 * jogador por LOS real — a busca termina.
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "./config.js";
import { hearingFactor, isDeaf } from "./moods.js";
import { bump } from "./stats.js";
import * as V from "./utils.js";

const PLAYER = "minecraft:player";
const WAYPOINT = "neuro:waypoint";

/** Linha de visão: cone frontal + oclusão por blocos. */
export function canSee(mob, target, maxDist = 48, fovDeg = 140) {
  try {
    const eye = mob.getHeadLocation();
    const tEye = target.getHeadLocation();
    const delta = V.sub(tEye, eye);
    const dist = V.len(delta);
    if (dist > maxDist) return false;
    if (dist < 1.5) return true;

    const dir = V.norm(delta);
    const facing = mob.getViewDirection();
    if (V.dot(dir, facing) < Math.cos((fovDeg * Math.PI) / 360)) return false;

    const hit = mob.dimension.getBlockFromRay(eye, dir, {
      maxDistance: dist,
      includeLiquidBlocks: false,
      includePassableBlocks: false
    });
    if (hit) {
      const l = hit.block.location;
      const hitDist = V.len(V.sub({ x: l.x + 0.5, y: l.y + 0.5, z: l.z + 0.5 }, eye));
      if (hitDist < dist - 0.9) return false; // bloco sólido entre os dois
    }
    return true;
  } catch {
    return false;
  }
}

// Dedupe leve: waypoints ativos recentes (evita pilhas no mesmo ponto).
const activeWaypoints = [];

function findNearbyWaypoint(dimension, loc) {
  for (let i = activeWaypoints.length - 1; i >= 0; i--) {
    const w = activeWaypoints[i];
    try {
      const e = world.getEntity(w.id);
      if (!e || !e.isValid) {
        activeWaypoints.splice(i, 1);
        continue;
      }
      if (e.dimension.id !== dimension.id) continue;
      if (V.distSq(e.location, loc) < 9) return w.id; // já existe um a <3
    } catch {
      activeWaypoints.splice(i, 1);
    }
  }
  return null;
}

/**
 * Inicia busca ativa até `loc`. Se `sharedWaypointId` for de um waypoint
 * ainda válido, reutiliza-o (alertas em grupo compartilham o destino).
 * Retorna o id do waypoint usado, ou null.
 *
 * CORREÇÃO DO TESTE EM CAMPO: nunca criamos waypoint COLADO (<4) num
 * jogador — se o jogador está ali, os mobs o caçam por visão/alerta; o
 * waypoint serve para onde ele ESTEVE. (Antes, minerar/caçar empilhava
 * waypoints no pé do jogador: bloqueava colocar blocos e absorvia
 * golpes.) Também reutilizamos waypoints a <3 blocos (dedupe).
 */
export function startSearch(brain, loc, sharedWaypointId) {
  const mob = brain.entity;
  try {
    let wpId = null;
    if (sharedWaypointId) {
      const wp = world.getEntity(sharedWaypointId);
      if (wp && wp.isValid) wpId = sharedWaypointId;
    }
    if (!wpId) {
      try {
        const near = mob.dimension.getPlayers({ location: loc, maxDistance: 4 });
        for (const _ of near) {
          brain.searching = false;
          brain.waypointId = null;
          return null; // jogador presente: sem waypoint (memória fica)
        }
      } catch {
        /* segue e tenta criar */
      }
      wpId = findNearbyWaypoint(mob.dimension, loc);
    }
    if (!wpId) {
      const wp = mob.dimension.spawnEntity(WAYPOINT, {
        x: loc.x,
        y: loc.y + 0.5,
        z: loc.z
      });
      wpId = wp.id;
      activeWaypoints.push({ id: wpId });
      if (activeWaypoints.length > 24) activeWaypoints.shift();
    }
    brain.waypointId = wpId;
    brain.searching = true;
    V.tryTrigger(mob, "neuro:start_search");
    bump("hunts");
    return wpId;
  } catch {
    brain.searching = false;
    brain.waypointId = null;
    return null;
  }
}

/** Encerra a busca (o waypoint expira sozinho ou some ao ser "alcançado"). */
export function stopSearch(brain) {
  brain.searching = false;
  brain.waypointId = null;
  V.tryTrigger(brain.entity, "neuro:stop_search");
}

/** Handler por cérebro: atualiza memória e a máquina de estados da busca. */
export function memoryTick(brain, cfg) {
  if (brain.retreating) return; // a retirada (tactics.js) assume o cérebro
  const mob = brain.entity;
  const target = V.safeTarget(mob);

  if (target && target.typeId === PLAYER) {
    // Em combate: atualizar memória enquanto houver visão real.
    brain.targetId = target.id;
    if (canSee(mob, target)) {
      brain.lastKnown = { ...target.location };
      brain.lastSeenTick = system.currentTick;
      if (brain.searching) stopSearch(brain);
    }
    return;
  }

  if (target && target.typeId !== WAYPOINT) {
    // Combate real com alvo não-jogador (golem, aldeão): nunca
    // sobrescrever uma luta em andamento com uma busca por jogador.
    if (brain.searching) stopSearch(brain);
    return;
  }

  // Sem alvo de combate.
  if (!cfg.memorySearch) return;

  if (brain.searching) {
    // Reavistou o jogador lembrado? (LOS real, sem trapaça de parede)
    if (brain.targetId) {
      const remembered = world.getEntity(brain.targetId);
      if (remembered && remembered.isValid && canSee(mob, remembered, 40)) {
        brain.lastKnown = { ...remembered.location };
        brain.lastSeenTick = system.currentTick;
        stopSearch(brain);
        V.tryTrigger(mob, "neuro:alert"); // reengaja imediatamente
        return;
      }
    }
    // Chegou ao waypoint (ou ele expirou/foi consumido)?
    const wp = brain.waypointId ? world.getEntity(brain.waypointId) : undefined;
    if (!wp || !wp.isValid) {
      brain.lastKnown = null;
      stopSearch(brain);
      return;
    }
    if (V.distSq(mob.location, wp.location) < 4) {
      brain.lastKnown = null;
      stopSearch(brain);
    }
    return;
  }

  // Acabou de perder o alvo: janela de memória de 1s a 30s.
  if (brain.lastKnown) {
    const age = system.currentTick - brain.lastSeenTick;
    if (age > 20 && age < 20 * 30) {
      startSearch(brain, brain.lastKnown);
    } else if (age >= 20 * 30) {
      brain.lastKnown = null; // memória expirou
      brain.targetId = null;  // ...e o vínculo com o alvo também
    }
  }
}

/**
 * Audição: quebrar/colocar blocos gera um "ruído" que faz mobs espertos
 * ociosos irem investigar o ponto exato do som.
 */
export function initHearing(getBrainFn) {
  let lastNoiseTick = 0;

  const investigate = (loc, dimension) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.hearing) return;
    if (system.currentTick - lastNoiseTick < 40) return; // anti-spam global
    lastNoiseTick = system.currentTick;

    // Chuva/trovoada abafam o som (moods.hearingFactor).
    const radius = Math.max(4, Math.round(cfg.hearingRadius * hearingFactor(dimension.id)));
    let sharedWp = null;
    let sent = 0;
    try {
      const mobs = dimension.getEntities({
        location: loc,
        maxDistance: radius,
        families: ["neuro_smart"]
      });
      for (const m of mobs) {
        if (sent >= 4) break;
        if (isDeaf(m.id)) continue; // ensurdecido por explosão
        if (V.safeTarget(m)) continue; // em combate não fareja sons
        const b = getBrainFn(m); // cria cérebro só para candidatos reais
        if (b.searching) continue; // já investigando algo
        b.lastKnown = { x: loc.x, y: loc.y, z: loc.z };
        b.lastSeenTick = system.currentTick;
        sharedWp = startSearch(b, b.lastKnown, sharedWp);
        sent++;
      }
    } catch {
      /* dimensão/área indisponível */
    }
  };

  world.afterEvents.playerBreakBlock.subscribe((ev) => {
    investigate(ev.block.location, ev.dimension);
  });
  try {
    world.afterEvents.playerPlaceBlock.subscribe((ev) => {
      investigate(ev.block.location, ev.dimension);
    });
  } catch {
    /* evento indisponível nesta versão: audição fica só na quebra */
  }
}
