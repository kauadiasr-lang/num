/**
 * fx.js — Feedback audiovisual dos momentos táticos (v1.2).
 *
 * A IA do NeuroMobs sempre foi invisível: o grito de alerta, o bote da
 * emboscada, a promoção a veterano — tudo acontecia "por dentro". Este
 * módulo dá corpo a esses momentos com o VOCABULÁRIO DO PRÓPRIO JOGO
 * (vozes vanilla dos mobs, partículas conhecidas), para que o jogador
 * SINTA a IA sem precisar do modo dev:
 *
 *  - GRITO DE GUERRA (fxAlert): a voz do próprio mob, mais aguda e alta —
 *    o jogador aprende que "grito estranho" = o bando foi acordado.
 *  - BOTE (fxPounce): voz aguda + faíscas de acerto crítico no emboscador.
 *  - RETIRADA (fxRetreat): baque de fuga + fumaça — "ele desistiu? NÃO:
 *    foi buscar reforço".
 *  - PROMOÇÃO A VETERANO (fxVeteran): acorde de encantamento + nuvem de
 *    raiva — nasce um chefe (o nome dourado já telegrafava; agora tem som).
 *  - MORAL QUEBRADA (fxMoralBreak): faíscas de fogo de artifício sobre o
 *    veterano morto — recompensa audível por abater o líder.
 *  - CORNETA DA VILA (fxAlarmHorn): a corneta de raid, baixa, quando a
 *    vila entra em alarme — os jogadores próximos entendem na hora.
 *  - INDICADOR DE CAÇADA: com 3+ cérebros no seu rastro, um aviso
 *    discreto no HUD ("N caçadores na sua trilha") a cada mudança.
 *
 * Custos: tudo é chamado a partir de eventos já existentes (nenhum
 * gatilho novo); o indicador de caçada roda 1×/80 ticks e só percorre o
 *  mapa de cérebros (≤ maxTracked). Sons/partículas ausentes numa versão
 * degradam em silêncio (try/catch).
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "./config.js";
import { allBrains } from "./core.js";
import { alive } from "./utils.js";

/** Voz vanilla de cada espécie (o grito usa a própria voz do mob). */
const VOICE = {
  "minecraft:zombie": "mob.zombie.say",
  "minecraft:husk": "mob.zombie.say",
  "minecraft:drowned": "mob.drowned.say",
  "minecraft:skeleton": "mob.skeleton.say",
  "minecraft:stray": "mob.skeleton.say",
  "minecraft:wither_skeleton": "mob.skeleton.say",
  "minecraft:spider": "mob.spider.say",
  "minecraft:cave_spider": "mob.spider.say",
  "minecraft:creeper": "mob.creeper.say",
  "minecraft:witch": "mob.witch.ambient"
};

function fxOn() {
  const cfg = getConfig();
  return cfg.enabled && cfg.feedbackFx;
}

function sound(dimension, id, loc, volume, pitch) {
  try {
    dimension.playSound(id, loc, { volume, pitch });
  } catch {
    /* som indisponível nesta versão */
  }
}

function particle(dimension, id, loc, count = 1, spreadY = 0) {
  try {
    for (let i = 0; i < count; i++) {
      dimension.spawnParticle(id, {
        x: loc.x,
        y: loc.y + 1 + i * spreadY,
        z: loc.z
      });
    }
  } catch {
    /* partícula indisponível */
  }
}

/** Grito de guerra: o mob alerta o bando (chamado pelo squad no shout). */
export function fxAlert(mob) {
  if (!fxOn()) return;
  try {
    const voice = VOICE[mob.typeId];
    if (voice) sound(mob.dimension, voice, mob.location, 1.0, 1.3);
    particle(mob.dimension, "minecraft:villager_angry", mob.location);
  } catch {
    /* mob descarregou */
  }
}

/** O bote da emboscada saiu. */
export function fxPounce(mob) {
  if (!fxOn()) return;
  try {
    const voice = VOICE[mob.typeId];
    if (voice) sound(mob.dimension, voice, mob.location, 1.0, 1.45);
    particle(mob.dimension, "minecraft:critical_hit_emitter", mob.location, 3, 0.3);
  } catch {
    /* ignorar */
  }
}

/** Retirada tática iniciada: fumaça de desengajamento. */
export function fxRetreat(mob) {
  if (!fxOn()) return;
  try {
    particle(mob.dimension, "minecraft:basic_smoke_particle", mob.location, 4, 0.25);
  } catch {
    /* ignorar */
  }
}

/** Um mob acabou de ser promovido a veterano. */
export function fxVeteran(mob) {
  if (!fxOn()) return;
  try {
    sound(mob.dimension, "mob.evocation_illager.cast_spell", mob.location, 0.6, 0.9);
    particle(mob.dimension, "minecraft:villager_angry", mob.location, 3, 0.35);
  } catch {
    /* ignorar */
  }
}

/** Veterano morto: a moral do bando quebra (recompensa audível). */
export function fxMoralBreak(loc, dimension) {
  if (!fxOn()) return;
  sound(dimension, "firework.twinkle", loc, 0.8, 1.0);
  particle(dimension, "minecraft:critical_hit_emitter", loc, 4, 0.3);
}

/** Corneta baixa quando a vila entra em alarme. */
let lastHornTick = 0;
export function fxAlarmHorn(loc, dimension) {
  if (!fxOn()) return;
  if (system.currentTick - lastHornTick < 200) return; // 10 s entre cornetas
  lastHornTick = system.currentTick;
  sound(dimension, "raid.horn", loc, 0.4, 1.0);
}

// ------------------------------------------------- indicador de caçada
// "Você está sendo caçado": com 3+ cérebros mirando o mesmo jogador, um
// aviso discreto no action bar — some sozinho, reaparece só quando o
// número MUDA (ou a cada 30 s se a caçada persistir).
const lastHunt = new Map(); // playerId -> { count, tick }

export function initFx() {
  system.runInterval(() => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.huntedIndicator) return;
    if (allBrains().size === 0) return;

    let players;
    try {
      players = world.getAllPlayers();
    } catch {
      return;
    }
    for (const p of players) {
      let count = 0;
      for (const [, b] of allBrains()) {
        if (b.targetId === p.id && alive(b.entity)) count++;
      }
      const prev = lastHunt.get(p.id);
      const changed = !prev || prev.count !== count;
      const stale = prev && system.currentTick - prev.tick > 600;
      if (count >= 3 && (changed || stale)) {
        lastHunt.set(p.id, { count, tick: system.currentTick });
        try {
          if (p.hasTag("neuro_dev")) continue; // HUD do modo dev tem prioridade
          p.onScreenDisplay.setActionBar(
            `§c${count} caçadores na sua trilha…§r`
          );
        } catch {
          /* sem HUD */
        }
      } else if (count < 3 && prev) {
        lastHunt.delete(p.id); // caçada dissolvida: silêncio
      }
    }
  }, 80);

  try {
    world.afterEvents.playerLeave.subscribe((ev) => {
      lastHunt.delete(ev.playerId);
    });
  } catch {
    /* evento indisponível */
  }
}
