/**
 * moods.js — O mundo influencia a IA.
 *
 * LUA CHEIA (moonEvents): raio efetivo dos gritos de alerta ×1,25 e
 * chance de veterano ×2. Fase checada 1×/min (custo ~zero).
 *
 * CLIMA (weatherMoods): rastreado por dimensão via weatherChange.
 *  - Chuva/trovoada: audição dos mobs cai pela metade (a chuva abafa —
 *    janela furtiva para o jogador TAMBÉM).
 *  - Virada para trovoada: frenesi breve (Speed) nos hostis perto de
 *    cada jogador — a tempestade agita a noite.
 *  - Raio caindo: criaturas num raio de 16 se assustam (Speed curto:
 *    pacíficos debandam pelo pânico nativo, hostis aceleram).
 *
 * EXPLOSÕES (blastDeafen): monstros num raio de 10 ficam 5 s "surdos" —
 * não ouvem blocos nem os gritos de alerta dos aliados. Creeper vira
 * ferramenta tática dupla: te delata E abre uma janela de silêncio.
 *
 * Tudo orientado a evento + 1 intervalo lento; APIs incertas entre
 * versões são assinadas dentro de try/catch (degradação graciosa).
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "./config.js";
import { tryEffect, explosionOrigin } from "./utils.js";

let moonFull = false;
const weatherByDim = new Map(); // dimensionId -> "Clear" | "Rain" | "Thunder"
const deafUntil = new Map(); // entityId -> tick limite

export function fullMoon() {
  return moonFull;
}

/** Dia "de jogo" (mesma faixa usada pelo sensor das aranhas). */
export function isDaytime() {
  try {
    const t = world.getTimeOfDay();
    return t >= 0 && t < 11000;
  } catch {
    return false;
  }
}

/** Multiplicador do raio de audição na dimensão (chuva abafa). */
export function hearingFactor(dimensionId) {
  const cfg = getConfig();
  if (!cfg.weatherMoods) return 1;
  const w = weatherByDim.get(dimensionId);
  return w && w !== "Clear" ? 0.5 : 1;
}

/** Multiplicador do raio dos gritos de alerta (lua cheia amplia). */
export function alertFactor() {
  const cfg = getConfig();
  return cfg.moonEvents && moonFull ? 1.25 : 1;
}

export function markDeaf(entityId, ticks) {
  deafUntil.set(entityId, system.currentTick + ticks);
}

export function isDeaf(entityId) {
  const t = deafUntil.get(entityId);
  if (t === undefined) return false;
  if (system.currentTick > t) {
    deafUntil.delete(entityId);
    return false;
  }
  return true;
}

let lastBoltTick = 0;

function lightningScare(bolt) {
  if (system.currentTick - lastBoltTick < 40) return;
  lastBoltTick = system.currentTick;
  try {
    const near = bolt.dimension.getEntities({
      location: bolt.location,
      maxDistance: 16
    });
    let n = 0;
    for (const e of near) {
      if (n >= 12) break;
      let isPlayer = false;
      let isMonster = false;
      try {
        isPlayer = e.typeId === "minecraft:player";
        isMonster = !isPlayer && e.matches({ families: ["monster"] });
      } catch {
        continue;
      }
      if (isPlayer) continue;
      tryEffect(e, "speed", isMonster ? 100 : 120, 0);
      n++;
    }
  } catch {
    /* área indisponível */
  }
}

function thunderFrenzy() {
  try {
    for (const p of world.getAllPlayers()) {
      const mobs = p.dimension.getEntities({
        location: p.location,
        maxDistance: 24,
        families: ["monster"]
      });
      let n = 0;
      for (const m of mobs) {
        if (n++ >= 8) break;
        tryEffect(m, "speed", 100, 0);
      }
    }
  } catch {
    /* ignorar */
  }
}

export function initMoods() {
  // Fase da lua: 1×/min + leitura inicial.
  const readMoon = () => {
    try {
      moonFull = world.getMoonPhase() === 0; // 0 = FullMoon
    } catch {
      moonFull = false;
    }
    // Expurgo do mapa de surdez: isDeaf() só limpa entradas consultadas;
    // mobs que morrem surdos ficariam no mapa para sempre (leak lento).
    const t = system.currentTick;
    for (const [id, until] of deafUntil) {
      if (t > until) deafUntil.delete(id);
    }
  };
  system.run(readMoon);
  system.runInterval(readMoon, 1200);

  // Leitura inicial do clima do overworld (se a API existir).
  system.run(() => {
    try {
      const ow = world.getDimension("overworld");
      weatherByDim.set(ow.id, String(ow.getWeather()));
    } catch {
      /* sem getWeather nesta versão: estado chega pelo weatherChange */
    }
  });

  // Mudanças de clima por dimensão.
  try {
    world.afterEvents.weatherChange.subscribe((ev) => {
      const rawDim = ev.dimension;
      const dimId = typeof rawDim === "string" ? rawDim : rawDim && rawDim.id;
      const w = String(ev.newWeather ?? "");
      if (dimId) weatherByDim.set(dimId, w);
      const cfg = getConfig();
      if (cfg.enabled && cfg.weatherMoods && w === "Thunder") thunderFrenzy();
    });
  } catch {
    /* evento indisponível */
  }

  // Raios (são entidades ao spawnar).
  try {
    world.afterEvents.entitySpawn.subscribe((ev) => {
      if (!ev.entity || ev.entity.typeId !== "minecraft:lightning_bolt") return;
      const cfg = getConfig();
      if (cfg.enabled && cfg.weatherMoods) lightningScare(ev.entity);
    });
  } catch {
    /* ignorar */
  }

  // Explosões ensurdecem monstros próximos.
  try {
    world.afterEvents.explosion.subscribe((ev) => {
      const cfg = getConfig();
      if (!cfg.enabled || !cfg.blastDeafen) return;
      const blast = explosionOrigin(ev);
      if (!blast) return;
      try {
        const mobs = blast.dimension.getEntities({
          location: blast.origin,
          maxDistance: 10,
          families: ["monster"]
        });
        let n = 0;
        for (const m of mobs) {
          if (n++ >= 12) break;
          markDeaf(m.id, 100); // 5 s
        }
      } catch {
        /* ignorar */
      }
    });
  } catch {
    /* evento indisponível nesta versão */
  }
}
