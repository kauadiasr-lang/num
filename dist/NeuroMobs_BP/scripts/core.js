/**
 * core.js — Registro de cérebros e escalonador do NeuroMobs.
 *
 * Modelo de desempenho:
 *  - Só criamos um "cérebro" quando o mob entra em combate/alerta (lazy).
 *  - O escalonador processa no máximo `budgetPerTick` cérebros por tick,
 *    em rodízio, então o custo por tick é constante e independe de quantos
 *    mobs existem no mundo.
 *  - `maxTracked` limita a memória total; o cérebro mais antigo é descartado.
 */
import { system } from "@minecraft/server";
import { getConfig } from "./config.js";
import { alive } from "./utils.js";

const brains = new Map(); // entityId -> brain

export const perf = { lastMs: 0, peakMs: 0 };

/** Cria (ou retorna) o cérebro de uma entidade. */
export function getBrain(entity) {
  let b = brains.get(entity.id);
  if (!b) {
    const cfg = getConfig();
    if (brains.size >= cfg.maxTracked) evictOldest();
    b = {
      id: entity.id,
      entity,
      type: entity.typeId,
      targetId: null,      // id do jogador perseguido
      lastKnown: null,     // última posição conhecida do alvo
      lastSeenTick: 0,     // tick da última visão confirmada
      searching: false,    // em busca ativa (indo até um waypoint)
      waypointId: null,    // waypoint atual, se houver
      role: "direct",      // "direct" | "flank"
      frozen: false,       // creeper em modo furtivo
      sieging: false,      // em modo cerco anti-torre
      towerTicks: 0,       // passadas consecutivas com alvo "torreado"
      personality: "normal", // "shy" | "normal" | "bold" (traits.js)
      veteran: false,      // chefe natural (traits.js)
      traitsDone: false,   // traços já resolvidos para esta entidade
      freshAggro: 0,       // tick da última troca de alvo (janela de emboscada)
      ambushing: false,    // segurando o bote (tactics.js)
      ambushUntil: 0,      // limite da emboscada
      retreating: false,   // em retirada tática (tactics.js)
      retreatUntil: 0,     // limite da retirada
      auraTick: 0,         // último pulso de liderança do veterano
      alertCooldown: 0,    // próximo tick em que pode alertar aliados
      created: system.currentTick
    };
    brains.set(entity.id, b);
  }
  b.entity = entity; // referência fresca
  return b;
}

export function peekBrain(entityId) {
  return brains.get(entityId);
}

export function dropBrain(entityId) {
  brains.delete(entityId);
}

export function allBrains() {
  return brains;
}

function evictOldest() {
  let oldestId = null, oldestTick = Infinity;
  for (const [id, b] of brains) {
    if (b.created < oldestTick) {
      oldestTick = b.created;
      oldestId = id;
    }
  }
  if (oldestId !== null) brains.delete(oldestId);
}

// ---------------------------------------------------------------- escalonador
const tickHandlers = [];
let order = [];
let ptr = 0;

/** Registra um handler chamado como fn(brain, cfg) a cada passada. */
export function onBrainTick(fn) {
  tickHandlers.push(fn);
}

export function startScheduler() {
  system.runInterval(() => {
    const cfg = getConfig();
    if (!cfg.enabled || brains.size === 0) {
      perf.lastMs = 0;
      return;
    }
    if (ptr >= order.length) {
      order = [...brains.keys()];
      ptr = 0;
    }
    const start = Date.now();
    let processed = 0;
    while (processed < cfg.budgetPerTick && ptr < order.length) {
      const b = brains.get(order[ptr++]);
      if (!b) continue;
      if (!alive(b.entity)) {
        brains.delete(b.id);
        continue;
      }
      for (const h of tickHandlers) {
        try {
          h(b, cfg);
        } catch (e) {
          if (cfg.debug) console.warn(`[NeuroMobs] handler: ${e}`);
        }
      }
      processed++;
    }
    perf.lastMs = Date.now() - start;
    if (perf.lastMs > perf.peakMs) perf.peakMs = perf.lastMs;
  }, 1);
}
