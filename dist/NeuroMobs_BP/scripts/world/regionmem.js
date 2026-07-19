/**
 * regionmem.js — Fábrica de memória regional persistente (v0.9).
 *
 * Generaliza o mecanismo criado para a memória de vila (v0.8): o mundo é
 * dividido em células quadradas; eventos somam pontos por célula com
 * decaimento por TEMPO ABSOLUTO do mundo, teto LRU de regiões e
 * persistência numa única dynamic property. Consumidores: villagemind
 * (trauma de vila) e wildmind (pressão de caça) — zero duplicação.
 */
import { world } from "@minecraft/server";

export function createRegionalMemory(opts) {
  const prop = opts.prop;
  const cell = opts.cell || 64;
  const maxRegions = opts.maxRegions || 24;
  const decayTicks = opts.decayTicks || 72000;
  const maxPoints = opts.maxPoints || 6;

  let mem = null; // { "dim|cx|cz": { p, t } }

  function now() {
    try {
      return world.getAbsoluteTime();
    } catch {
      return 0;
    }
  }

  function load() {
    if (mem) return mem;
    mem = {};
    try {
      const raw = world.getDynamicProperty(prop);
      if (typeof raw === "string") mem = JSON.parse(raw) || {};
    } catch {
      mem = {};
    }
    return mem;
  }

  function save() {
    try {
      world.setDynamicProperty(prop, JSON.stringify(mem));
    } catch {
      /* mundo indisponível: fica em RAM até a próxima gravação */
    }
  }

  function keyOf(dimension, loc) {
    return `${dimension.id}|${Math.floor(loc.x / cell)}|${Math.floor(loc.z / cell)}`;
  }

  function activePoints(entry, t) {
    if (!entry) return 0;
    if (t > 0 && entry.t > 0 && t - entry.t > decayTicks) return 0;
    return entry.p;
  }

  return {
    /** Soma `weight` pontos na célula do local. */
    record(dimension, loc, weight) {
      load();
      const t = now();
      const k = keyOf(dimension, loc);
      mem[k] = { p: Math.min(maxPoints, activePoints(mem[k], t) + weight), t };
      const keys = Object.keys(mem);
      if (keys.length > maxRegions) {
        keys.sort((a, b) => mem[a].t - mem[b].t);
        for (let i = 0; i < keys.length - maxRegions; i++) delete mem[keys[i]];
      }
      save();
    },
    /** Nível 0–3 da célula do local. */
    level(dimension, loc) {
      load();
      return Math.min(
        3,
        Math.floor(activePoints(mem[keyOf(dimension, loc)], now()) / 2)
      );
    }
  };
}
