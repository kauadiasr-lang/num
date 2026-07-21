/**
 * village/crime.js — Testemunhas, boatos e lockdown (v1.3).
 *
 * UM CRIME SÓ EXISTE SE ALGUÉM VIU. Ferir aldeão ou quebrar porta/cama/
 * baú dentro da vila procura TESTEMUNHAS com linha de visão REAL
 * (canSee: cone + raycast — o mesmo olho dos monstros). Sem testemunha:
 * só um rastro fraco de "evidência" (honra -1). Com testemunhas: pena
 * cheia, pânico local, e a notícia VIAJA — cada testemunha carrega o
 * boato, e as conversas do social.js o espalham para novos aldeões
 * (contágio de informação de verdade, com contador de quem já sabe).
 *
 * REAÇÃO: guardas/golems recebem waypoint para a cena; a vila entra em
 * LOCKDOWN (flag) por alguns minutos: portas fecham (housing.js), a
 * partilha para (economy.js), aldeões medrosos ganham velocidade para
 * correr para casa (os corajosos — persona.courage alta — ficam).
 *
 * EVIDÊNCIA DECAI: crimes menores somem do registro após 3 dias de
 * jogo; ASSASSINATOS ficam para sempre (memória de perdas da família).
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "../core/config.js";
import { villageAt, raiseThreat, markDirty } from "./registry.js";
import { creditHonor } from "./honor.js";
import { canSee, startSearch } from "../ai/senses.js";
import { getBrain } from "../core/core.js";
import { nudgeMood } from "./persona.js";
import { say } from "./social.js";
import * as V from "../core/utils.js";

const rumors = new Map(); // villagerId -> {playerId, until} (quem sabe do crime)

export function knowsRumor(villagerId) {
  const r = rumors.get(villagerId);
  if (!r) return null;
  if (system.currentTick > r.until) {
    rumors.delete(villagerId);
    return null;
  }
  return r;
}

export function plantRumor(villagerId, playerId) {
  rumors.set(villagerId, {
    playerId,
    until: system.currentTick + 72000 // 3 dias de jogo
  });
  if (rumors.size > 64) {
    // Poda o boato mais antigo (ordem de inserção do Map).
    const first = rumors.keys().next().value;
    rumors.delete(first);
  }
}

/** Procura testemunhas com visão real do ponto do crime. */
function findWitnesses(dim, loc, offender, max = 4) {
  const out = [];
  try {
    const folks = dim.getEntities({
      location: loc,
      maxDistance: 20,
      families: ["villager"]
    });
    for (const w of folks) {
      if (out.length >= max) break;
      if (canSee(w, offender, 24, 160)) out.push(w);
    }
  } catch {
    /* área indisponível */
  }
  return out;
}

/** Registra o crime e dispara todas as reações. */
function commitCrime(dim, loc, offender, kind, penalty) {
  const v = villageAt(dim, loc, false);
  if (!v) return;
  const witnesses = findWitnesses(dim, loc, offender);
  if (witnesses.length === 0) {
    creditHonor(v, offender, -1, "Rastro suspeito");
    return;
  }
  creditHonor(v, offender, penalty, kind);
  v.crimes.push({ p: offender.id, kind, t: system.currentTick });
  if (v.crimes.length > 12) v.crimes.shift();
  raiseThreat(v, 1);
  v.flags.lockdown = true;
  v.flags.lockdownUntil = system.currentTick + 3600; // 3 min de portas fechadas
  markDirty();

  const cfgNow = getConfig();
  for (const w of witnesses) {
    plantRumor(w.id, offender.id);
    nudgeMood(w, -1, +2);
    say(w, "fear", cfgNow);
    try {
      dim.spawnParticle("minecraft:villager_angry", {
        x: w.location.x, y: w.location.y + 2.2, z: w.location.z
      });
      // A testemunha ENCARA o criminoso (setRotation na direção dele).
      const d = V.sub(offender.location, w.location);
      const yaw = (Math.atan2(-d.x, d.z) * 180) / Math.PI;
      w.setRotation({ x: 0, y: yaw });
    } catch {
      /* ignorar */
    }
  }
  try {
    dim.playSound("mob.villager.no", loc, { volume: 1.0, pitch: 0.9 });
  } catch {
    /* ignorar */
  }

  // Guardas/golems à cena do crime.
  try {
    const defenders = dim.getEntities({
      location: loc,
      maxDistance: 48,
      families: ["neuro_defender"]
    });
    let g = 0;
    for (const d of defenders) {
      if (g++ >= 2) break;
      V.tryTrigger(d, "neuro:alert");
      const b = getBrain(d);
      if (!V.safeTarget(d) && !b.searching) {
        b.lastKnown = { ...loc };
        b.lastSeenTick = system.currentTick;
        startSearch(b, loc);
      }
    }
  } catch {
    /* ignorar */
  }

  // Medrosos correm; corajosos ficam olhando feio.
  try {
    const folks = dim.getEntities({
      location: loc, maxDistance: 16, families: ["villager"]
    });
    let n = 0;
    for (const f of folks) {
      if (n++ >= 6) break;
      let courage = 5;
      try {
        const raw = f.getDynamicProperty("neuro:persona");
        if (typeof raw === "string") courage = JSON.parse(raw).courage;
      } catch {
        /* ignorar */
      }
      if (courage < 6) V.tryEffect(f, "speed", 160, 1);
    }
  } catch {
    /* ignorar */
  }
}

/** Tarefa de vila: expira lockdown e crimes antigos. */
export function crimeTask(v, cfg) {
  if (v.flags.lockdown && system.currentTick > (v.flags.lockdownUntil || 0)) {
    v.flags.lockdown = false;
    markDirty();
  }
  // Evidência decai: crimes menores com 3+ dias saem do registro.
  const cutoff = system.currentTick - 72000;
  const before = v.crimes.length;
  v.crimes = v.crimes.filter((c) => c.t > cutoff || c.kind === "Assassinato");
  if (v.crimes.length !== before) markDirty();
}

export function initCrime() {
  // Ferir aldeão.
  world.afterEvents.entityHurt.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.villageAI || !cfg.villageCrime) return;
    const src = ev.damageSource && ev.damageSource.damagingEntity;
    if (!src || src.typeId !== "minecraft:player") return;
    const victim = ev.hurtEntity;
    if (!V.hasFamily(victim, "villager")) return;
    commitCrime(victim.dimension, victim.location, src, "Agressão", -8);
  });

  // Quebrar porta/cama/baú dentro da vila.
  world.afterEvents.playerBreakBlock.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.villageAI || !cfg.villageCrime) return;
    const id = ev.brokenBlockPermutation
      ? ev.brokenBlockPermutation.type.id
      : "";
    const isDoor = id.includes("_door");
    const isBed = id.includes("bed") && !id.includes("bedrock");
    const isChest = id === "minecraft:chest";
    if (!isDoor && !isBed && !isChest) return;
    const v = villageAt(ev.dimension, ev.block.location, false);
    if (!v) return;
    const loc = ev.block.location;
    // Só PROPRIEDADE da vila é crime — a base do próprio jogador a 50
    // blocos do centro não é da conta dos aldeões:
    //  porta: precisa estar REGISTRADA como casa;
    //  baú:   precisa ser o celeiro;
    //  cama:  só bem perto do centro (a 24 — o dormitório da vila).
    let isProperty = false;
    if (isDoor) {
      isProperty = v.houses.some(
        (h) => h.x === loc.x && (h.y === loc.y || h.y === loc.y - 1) && h.z === loc.z
      );
    } else if (isChest) {
      isProperty =
        !!v.granary &&
        v.granary.x === loc.x && v.granary.y === loc.y && v.granary.z === loc.z;
    } else if (isBed) {
      const d2 = (loc.x - v.x) ** 2 + (loc.z - v.z) ** 2;
      isProperty = d2 <= 24 * 24;
    }
    if (!isProperty) return;
    commitCrime(ev.dimension, loc, ev.player, "Vandalismo", -6);
  });
}
