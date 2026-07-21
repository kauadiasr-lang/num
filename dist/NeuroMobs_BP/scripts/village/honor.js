/**
 * village/honor.js — Honra por jogador, por vila (v1.3).
 *
 * Cada vila mantém uma pontuação por jogador (persistida no registro).
 * FONTES (todas eventos reais): matar monstro perto da vila (+2, +4 se
 * havia aldeão ameaçado), doar itens ao celeiro (+2, economy.js),
 * comerciar com aldeão (+1, com teto diário), reparar dano indireto…
 * NEGATIVAS: ferir aldeão (-8 com testemunha, crime.js), matar aldeão
 * (-40, permanente via memória de perdas), matar golem/guarda (-20),
 * quebrar porta/cama/baú da vila (-6 com testemunha).
 *
 * CONSEQUÊNCIAS REAIS:
 *  - herói (>= +20): recepção com corações + sino de boas-vindas ao
 *    entrar; prioridade na partilha; convite audível para festivais.
 *  - suspeito (<= -10): aldeões mostram raiva, guardas te SEGUEM
 *    (waypoint de vigilância de verdade).
 *  - fora-da-lei (<= -30): tag neuro_outlaw — os GUARDAS TE ATACAM
 *    (entrada de alvo no JSON do guarda). Redenção: honra sobe de
 *    volta por boas ações; a tag cai ao cruzar o limiar.
 *
 * Limite de engine documentado: preços de trade não são alteráveis por
 * script — o "desconto" dos justos é dado em partilha e presentes
 * físicos, não em emeralds de interface.
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "../core/config.js";
import { villageAt, markDirty, centerOf } from "./registry.js";
import * as V from "../core/utils.js";

const OUTLAW = "neuro_outlaw";
const HERO_AT = 20;
const SUSPECT_AT = -10;
const OUTLAW_AT = -30;

export function honorOf(v, playerId) {
  return (v.honor && v.honor[playerId]) || 0;
}

/** Credita/debita honra e aplica os limiares (tag de fora-da-lei). */
export function creditHonor(v, player, delta, reason) {
  if (!v.honor) v.honor = {};
  const cur = (v.honor[player.id] || 0) + delta;
  v.honor[player.id] = Math.max(-99, Math.min(99, cur));
  // Poda: mantém só os 8 jogadores mais relevantes por vila.
  const keys = Object.keys(v.honor);
  if (keys.length > 8) {
    keys.sort((a, b) => Math.abs(v.honor[a]) - Math.abs(v.honor[b]));
    delete v.honor[keys[0]];
  }
  markDirty();
  try {
    const score = v.honor[player.id];
    const has = player.hasTag(OUTLAW);
    if (score <= OUTLAW_AT && !has) {
      player.addTag(OUTLAW);
      player.sendMessage(
        "§4[Vila]§r Você é um FORA-DA-LEI aqui. Os guardas não vão conversar."
      );
    } else if (score > OUTLAW_AT && has) {
      player.removeTag(OUTLAW);
      player.sendMessage("§6[Vila]§r Sua dívida foi perdoada… por ora.");
    }
    if (delta < -3) {
      player.onScreenDisplay.setActionBar(
        `§c${reason}: a vila não esquece (${score})`
      );
    } else if (delta >= 2) {
      player.onScreenDisplay.setActionBar(
        `§a${reason}: a vila agradece (${score})`
      );
    }
  } catch {
    /* jogador saiu */
  }
}

// Teto diário de honra por comércio (playerId -> {day, n}).
const tradeCap = new Map();

/** Tarefa de vila: recepção na entrada (herói/suspeito) — barata. */
export function honorTask(v, cfg) {
  if (!cfg.villageHonor) return;
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }
  try {
    const players = dim.getPlayers({ location: centerOf(v), maxDistance: 40 });
    for (const p of players) {
      const score = honorOf(v, p.id);
      const lastGreet = (v.flags.greet && v.flags.greet[p.id]) || 0;
      if (system.currentTick - lastGreet < 6000) continue; // 5 min
      if (!v.flags.greet) v.flags.greet = {};
      v.flags.greet[p.id] = system.currentTick;
      const gk = Object.keys(v.flags.greet);
      if (gk.length > 16) {
        gk.sort((a, b) => v.flags.greet[a] - v.flags.greet[b]);
        delete v.flags.greet[gk[0]]; // esquece a saudação mais antiga
      }
      if (score >= HERO_AT) {
        try {
          dim.playSound("random.levelup", p.location, { volume: 0.4, pitch: 1.3 });
          dim.spawnParticle("minecraft:heart_particle", {
            x: p.location.x, y: p.location.y + 2, z: p.location.z
          });
          p.sendMessage("§a[Vila]§r Os aldeões sorriem quando você chega.");
        } catch {
          /* ignorar */
        }
      } else if (score <= SUSPECT_AT) {
        try {
          dim.spawnParticle("minecraft:villager_angry", {
            x: p.location.x, y: p.location.y + 2.2, z: p.location.z
          });
          p.sendMessage("§c[Vila]§r Portas se fecham. Olhares te seguem.");
        } catch {
          /* ignorar */
        }
      }
    }
  } catch {
    /* área indisponível */
  }
}

export function initHonor() {
  // Matar monstros perto da vila = proteção (+2/+4).
  world.afterEvents.entityDie.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.villageAI || !cfg.villageHonor) return;
    const dead = ev.deadEntity;
    const killer = ev.damageSource && ev.damageSource.damagingEntity;
    if (!dead || !killer || killer.typeId !== "minecraft:player") return;

    // Matar aldeão/defensor: a queda pesada.
    if (V.hasFamily(dead, "villager")) {
      const v = villageAt(dead.dimension, dead.location, false);
      if (v) creditHonor(v, killer, -40, "Assassinato");
      return;
    }
    if (V.hasFamily(dead, "irongolem") || V.hasFamily(dead, "neuro_guard")) {
      const v = villageAt(dead.dimension, dead.location, false);
      if (v) creditHonor(v, killer, -20, "Matou um protetor");
      return;
    }
    if (!V.hasFamily(dead, "monster")) return;
    const v = villageAt(dead.dimension, dead.location, false);
    if (!v) return;
    const d2 =
      (dead.location.x - v.x) ** 2 + (dead.location.z - v.z) ** 2;
    if (d2 > 64 * 64) return;
    // Havia aldeão perto do monstro? Então foi um RESGATE.
    let rescue = false;
    try {
      const near = dead.dimension.getEntities({
        location: dead.location, maxDistance: 10, families: ["villager"]
      });
      for (const _ of near) {
        rescue = true;
        break;
      }
    } catch {
      /* ignorar */
    }
    creditHonor(v, killer, rescue ? 4 : 2, rescue ? "Resgate" : "Caçada");
  });

  // Comércio justo: interagir com aldeão (teto de +3/dia por jogador).
  try {
    world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
      const cfg = getConfig();
      if (!cfg.enabled || !cfg.villageAI || !cfg.villageHonor) return;
      const t = ev.target;
      if (!t || !V.hasFamily(t, "villager")) return;
      const p = ev.player;
      const day = Math.floor(system.currentTick / 24000);
      const cap = tradeCap.get(p.id);
      if (cap && cap.day === day && cap.n >= 3) return;
      tradeCap.set(p.id, { day, n: cap && cap.day === day ? cap.n + 1 : 1 });
      const v = villageAt(t.dimension, t.location, false);
      if (v) creditHonor(v, p, 1, "Comércio");
    });
  } catch {
    /* evento indisponível */
  }

  try {
    world.afterEvents.playerLeave.subscribe((ev) => {
      tradeCap.delete(ev.playerId);
    });
  } catch {
    /* ignorar */
  }
}
