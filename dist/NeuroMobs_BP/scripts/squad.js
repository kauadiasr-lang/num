/**
 * squad.js — Coordenação de grupo.
 *
 * Ponte JSON -> script: os overrides de entidade disparam
 * "neuro:on_target_acquired"/"neuro:on_target_escape" (componentes
 * minecraft:on_target_acquired/escape). Ouvimos via dataDrivenEntityTrigger.
 *
 * Alerta em grupo: ao adquirir um jogador como alvo, o mob "grita" para
 * aliados da família neuro_smart num raio configurável. Aliados recebem o
 * evento neuro:alert (15s de perseguição sem exigir visão) e, se não têm
 * linha de visão, partilham um waypoint de investigação.
 *
 * Papéis: com 3+ mobs no mesmo alvo, metade recebe "flank"
 * (move_around_target: circundar) e metade "direct". Os papéis giram a cada
 * ~3s, produzindo o padrão cercar -> atacar por outro ângulo.
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "./config.js";
import { getBrain, allBrains } from "./core.js";
import { canSee, startSearch } from "./senses.js";
import { adaptiveBuff } from "./adaptive.js";
import { villageAlarm } from "./defense.js";
import { ensureTraits } from "./traits.js";
import { alertFactor, isDeaf, isDaytime } from "./moods.js";
import { fxAlert } from "./fx.js";
import { bump } from "./stats.js";
import * as V from "./utils.js";

const PLAYER = "minecraft:player";
const SOLITARY = new Set(["minecraft:enderman"]); // não gritam para o bando

/**
 * Aranha em modo espreita diurna: OBSERVA, não participa do bando.
 * Checagem viva (tipo + horário) — um flag armazenado dessincronizaria
 * ao anoitecer, quando o alvo persiste e nenhum novo aggro dispara.
 */
export function isObserver(brain) {
  return brain.type === "minecraft:spider" && isDaytime();
}
const roleClock = new Map(); // playerId -> { tick, rotation }

export function initSquad() {
  world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => {
    if (!ev.eventId || !ev.eventId.startsWith("neuro:")) return;
    if (ev.eventId === "neuro:on_target_acquired") {
      onAggro(ev.entity);
    }
    // neuro:on_target_escape: a memória (senses.memoryTick) assume daqui.
  });

  // Levar dano de um jogador também conta como "descobrir" o atacante,
  // mesmo para mobs vanilla não modificados (camada genérica).
  world.afterEvents.entityHurt.subscribe((ev) => {
    if (!getConfig().enabled) return; // núcleo desligado: nenhum cérebro novo
    const src = ev.damageSource && ev.damageSource.damagingEntity;
    if (!src || src.typeId !== PLAYER) return;
    const victim = ev.hurtEntity;
    if (!V.hasFamily(victim, "monster")) return;
    const b = getBrain(victim);
    b.targetId = src.id;
    b.lastKnown = { ...src.location };
    b.lastSeenTick = system.currentTick;
    b.ambushUntil = 0; // apanhou: a emboscada quebra na próxima passada
    if (victim.typeId === "minecraft:spider") {
      V.tryTrigger(victim, "neuro:stalk_stop"); // espreitadora provocada
    }
    onAggro(victim, src);
  });

  // Higiene: sem o jogador, o relógio de papéis dele não serve para nada.
  try {
    world.afterEvents.playerLeave.subscribe((ev) => {
      roleClock.delete(ev.playerId);
    });
  } catch {
    /* evento indisponível: o teto natural de jogadores limita o mapa */
  }
}

function onAggro(mob, knownTarget) {
  const cfg = getConfig();
  if (!cfg.enabled || !V.alive(mob)) return;

  let target = knownTarget || V.safeTarget(mob);
  if (!target) return;
  if (target.typeId !== PLAYER) {
    // Monstro caçando aldeão/comerciante => alarme de vila.
    if (V.isVillagerLike(target)) villageAlarm(mob, target, cfg);
    return;
  }

  const b = getBrain(mob);
  ensureTraits(b, cfg); // personalidade/veterania no 1º engajamento
  if (b.targetId !== target.id) b.freshAggro = system.currentTick;
  b.targetId = target.id;
  b.lastKnown = { ...target.location };
  b.lastSeenTick = system.currentTick;

  // Aranha espreitadora diurna: alvo de OBSERVAÇÃO — sem grito, sem
  // reforço, sem papéis. A agressão real só vem à noite ou se provocada.
  if (isObserver(b)) return;

  adaptiveBuff(mob, target, cfg);

  if (cfg.packAlert && !SOLITARY.has(b.type) && system.currentTick >= b.alertCooldown) {
    b.alertCooldown = system.currentTick + 100; // 5s entre gritos por mob
    fxAlert(mob); // o grito agora se OUVE (voz do próprio mob, aguda)
    bump("alerts");
    // Lua cheia amplia o grito; veteranos gritam 1,5x mais longe.
    const shoutRadius = Math.round(
      cfg.alertRadius * alertFactor() * (b.veteran ? 1.5 : 1)
    );
    let sharedWp = null;
    let alerted = 0;
    try {
      const allies = mob.dimension.getEntities({
        location: mob.location,
        maxDistance: shoutRadius,
        families: ["neuro_smart"]
      });
      for (const ally of allies) {
        if (ally.id === mob.id) continue;
        if (isDeaf(ally.id)) continue; // não ouve o grito
        if (alerted >= 8) break; // teto de custo por grito
        const ab = getBrain(ally);
        ab.targetId = target.id;
        ab.lastKnown = { ...target.location };
        ab.lastSeenTick = system.currentTick;
        V.tryTrigger(ally, "neuro:alert");
        if (
          cfg.memorySearch &&
          !ab.searching &&
          !V.safeTarget(ally) &&
          !canSee(ally, target, shoutRadius + 8)
        ) {
          sharedWp = startSearch(ab, ab.lastKnown, sharedWp);
        }
        alerted++;
      }
    } catch {
      /* área indisponível */
    }
  }

  assignRoles(target, cfg, true);
}

/** Distribui/rotaciona papéis entre todos os cérebros focados no jogador. */
function assignRoles(player, cfg, force) {
  if (!cfg.tactics || !V.alive(player)) return;

  let clock = roleClock.get(player.id);
  if (!clock) {
    clock = { tick: 0, rotation: 0 };
    roleClock.set(player.id, clock);
  }
  if (!force && system.currentTick - clock.tick < 60) return;
  clock.tick = system.currentTick;
  clock.rotation++;

  const pack = [];
  for (const [, b] of allBrains()) {
    if (b.targetId !== player.id) continue;
    if (!V.alive(b.entity)) continue;
    if (b.sieging) continue; // cerco anti-torre tem prioridade sobre papéis
    if (b.ambushing || b.retreating) continue; // emboscada/retirada idem
    if (isObserver(b)) continue; // espreitadora observa, não cerca
    if (V.distSq(b.entity.location, player.location) > 32 * 32) continue;
    pack.push(b);
  }

  if (pack.length < cfg.flankMinPack) {
    for (const b of pack) setRole(b, "direct");
    return;
  }
  pack.sort((a, z) => (a.id < z.id ? -1 : 1));
  pack.forEach((b, i) => {
    // Viés de personalidade: audazes vão direto, cautelosos flanqueiam,
    // normais mantêm a rotação clássica (cercar -> atacar).
    let role;
    if (b.personality === "bold") role = "direct";
    else if (b.personality === "shy") role = "flank";
    else role = (i + clock.rotation) % 2 === 1 ? "flank" : "direct";
    setRole(b, role);
  });
}

function setRole(brain, role) {
  const changed = brain.role !== role;
  brain.role = role;
  if (role === "flank") {
    // Re-dispara sempre: sustenta o timer de segurança do grupo (12 s).
    V.tryTrigger(brain.entity, "neuro:role_flank");
  } else if (changed) {
    V.tryTrigger(brain.entity, "neuro:role_direct");
  }
}

/** Handler por cérebro: manutenção de papéis + furtividade do creeper. */
export function squadTick(brain, cfg) {
  const mob = brain.entity;
  const target = V.safeTarget(mob);

  // Sem alvo: garantir estados limpos.
  if (!target || target.typeId !== PLAYER) {
    if (brain.frozen) {
      brain.frozen = false;
      V.tryTrigger(mob, "neuro:unfreeze");
    }
    if (brain.role === "flank") setRole(brain, "direct");
    return;
  }

  if (cfg.tactics && !brain.sieging && !brain.ambushing && !brain.retreating) {
    assignRoles(target, cfg, false);
  }

  // Liderança: veterano em combate inspira o bando (pulso a cada ~5 s).
  if (cfg.leadership && brain.veteran && system.currentTick - brain.auraTick > 100) {
    brain.auraTick = system.currentTick;
    try {
      const pack = mob.dimension.getEntities({
        location: mob.location,
        maxDistance: 12,
        families: ["neuro_smart"]
      });
      let n = 0;
      for (const ally of pack) {
        if (ally.id === mob.id) continue;
        if (n++ >= 6) break;
        V.tryEffect(ally, "speed", 120, 0);
      }
    } catch {
      /* ignorar */
    }
  }

  // Creeper furtivo: congela quando o jogador está olhando na direção dele
  // a média distância; volta a andar quando o jogador desvia o olhar.
  if (cfg.creeperStalk && brain.type === "minecraft:creeper") {
    try {
      const toCreeper = V.norm(V.sub(mob.location, target.location));
      // Audaz quase não congela; cauteloso congela com olhar de relance.
      const threshold =
        brain.personality === "bold" ? 0.75 :
        brain.personality === "shy" ? 0.4 : 0.55;
      const watched = V.dot(target.getViewDirection(), toCreeper) > threshold;
      const d2 = V.distSq(mob.location, target.location);
      const shouldFreeze = watched && d2 > 25 && d2 < 26 * 26 && canSee(target, mob, 30, 160);
      if (shouldFreeze) {
        brain.frozen = true;
        // Re-dispara a cada passada: sustenta o timer de segurança (8 s)
        // e se autocorrige se o estado dessincronizar.
        V.tryTrigger(mob, "neuro:freeze");
      } else if (brain.frozen) {
        brain.frozen = false;
        V.tryTrigger(mob, "neuro:unfreeze");
      }
    } catch {
      /* alvo descarregou no meio do cálculo */
    }
  }
}
