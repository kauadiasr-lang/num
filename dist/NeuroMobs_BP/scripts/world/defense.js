/**
 * defense.js — Defesa de vila e pânico de rebanho.
 *
 * ALARME DE VILA (villageDefense):
 *  Gatilho: um monstro adquire um aldeão como alvo (via squad.onAggro) ou
 *  um aldeão é ferido por um monstro. Reação:
 *   - Golems (família neuro_defender) num raio de 32 recebem neuro:alert
 *     (caça a monstros sem exigir visão por 15 s) e, se estiverem longe da
 *     ameaça, são DIRECIONADOS até ela por um waypoint compartilhado — o
 *     mesmo mecanismo de busca dos monstros, reutilizado (zero duplicação).
 *   - Aldeões num raio de 16 ganham Velocidade breve: o pânico nativo deles
 *     vira uma dispersão convincente.
 *
 * PÂNICO DE REBANHO (herdPanic):
 *  Qualquer mob pacífico/neutro ferido assusta vizinhos DA MESMA ESPÉCIE
 *  (raio 12, até 6): eles ganham Velocidade e o goal de pânico/fuga nativo
 *  faz o rebanho debandar junto. Funciona em TODOS os mobs do jogo sem
 *  precisar de override — é a camada genérica do "mundo vivo".
 *
 * Custos: só roda em eventos de dano (nenhum polling) e com throttle
 * global, então o impacto por tick é ~zero fora de combate.
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "../core/config.js";
import { recordVillageEvent, traumaLevel } from "./villagemind.js";
import { pressureLevel } from "./wildmind.js";
import { getBrain } from "../core/core.js";
import { startSearch } from "../ai/senses.js";
import { fxAlarmHorn } from "../player/fx.js";
import { bump } from "../player/stats.js";
import * as V from "../core/utils.js";

let lastAlarmTick = 0;
let lastPanicTick = 0;
let lastSwarmTick = 0;

/**
 * Ferir uma abelha enfurece a colmeia: tentamos os eventos de raiva do
 * JSON vanilla (nomes variam entre versões — tryTrigger falha em
 * silêncio) e garantimos ao menos a arrancada com Velocidade.
 */
function swarmAnger(victim) {
  if (system.currentTick - lastSwarmTick < 40) return;
  lastSwarmTick = system.currentTick;
  try {
    const bees = victim.dimension.getEntities({
      location: victim.location,
      maxDistance: 12,
      type: "minecraft:bee"
    });
    let n = 0;
    for (const bee of bees) {
      if (bee.id === victim.id) continue;
      if (n++ >= 6) break;
      const angered =
        V.tryTrigger(bee, "minecraft:become_angry") ||
        V.tryTrigger(bee, "minecraft:bee_angry");
      V.tryEffect(bee, "speed", 140, 0);
      if (!angered) V.tryEffect(bee, "strength", 140, 0);
    }
  } catch {
    /* ignorar */
  }
}

let lastBellTick = 0;
let lastInvestigateTick = 0;

/**
 * Aterrissa um ponto de patrulha: raycast para baixo acha o topo do solo
 * (sinos ficam pendurados em postes — sem isso o posto flutua ou nasce
 * dentro de parede). Fallback: o próprio ponto.
 */
export function groundSnap(dim, p) {
  try {
    const hit = dim.getBlockFromRay(
      { x: p.x, y: p.y + 3, z: p.z },
      { x: 0, y: -1, z: 0 },
      { maxDistance: 12, includeLiquidBlocks: false, includePassableBlocks: false }
    );
    if (hit) {
      return { x: p.x, y: hit.block.location.y + 1, z: p.z };
    }
  } catch {
    /* ignorar */
  }
  return p;
}

/**
 * SINO TÁTICO (tacticalBell): badalar um sino mobiliza a vila inteira —
 * aldeões num raio de 32 dispersam em velocidade e até 3 golems entram em
 * caça ampliada E patrulham em leque (cada um recebe um posto próprio a
 * ~12 blocos do sino, via waypoint). O sino vira ferramenta do jogador:
 * viu um creeper rondando? Badale.
 */
function bellRung(player, block) {
  const cfg = getConfig();
  if (!cfg.enabled || !cfg.tacticalBell) return;
  if (system.currentTick - lastBellTick < 200) return; // 10 s entre toques
  lastBellTick = system.currentTick;
  bump("bells");

  const loc = {
    x: block.location.x + 0.5,
    y: block.location.y,
    z: block.location.z + 0.5
  };
  const dim = block.dimension;
  try {
    // 1) Aldeões correm.
    const villagers = dim.getEntities({
      location: loc,
      maxDistance: 32,
      families: ["villager"]
    });
    let n = 0;
    for (const v of villagers) {
      if (n++ >= 12) break;
      V.tryEffect(v, "speed", 200, 0);
    }

    // 2) Golems: caça ampliada + postos de patrulha em leque.
    const golems = dim.getEntities({
      location: loc,
      maxDistance: 48,
      families: ["neuro_defender"]
    });
    let g = 0;
    for (const golem of golems) {
      if (g >= 3) break;
      V.tryTrigger(golem, "neuro:alert");
      const gb = getBrain(golem);
      if (!V.safeTarget(golem) && !gb.searching) {
        // O leque GIRA a cada toque (spin derivado do tick): toques
        // sucessivos cobrem pontos diferentes do perímetro.
        const spin = (system.currentTick % 628) / 100; // 0..2π
        const ang = (g / 3) * Math.PI * 2 + spin;
        const post = groundSnap(dim, {
          x: loc.x + Math.cos(ang) * 12,
          y: loc.y,
          z: loc.z + Math.sin(ang) * 12
        });
        gb.lastKnown = post;
        gb.lastSeenTick = system.currentTick;
        startSearch(gb, post); // waypoint próprio: cada golem, um posto
      }
      g++;
    }

    if (player) {
      try {
        player.onScreenDisplay.setActionBar("§e[Sino] A vila foi alertada!");
      } catch {
        /* sem HUD */
      }
    }
  } catch {
    /* área indisponível */
  }
}

/** Alarme de vila. `threat` = monstro; `victim` = aldeão/comerciante. */
export function villageAlarm(threat, victim, cfg) {
  if (!cfg.villageDefense) return;
  if (system.currentTick - lastAlarmTick < 60) return; // 3 s entre alarmes
  lastAlarmTick = system.currentTick;
  fxAlarmHorn(victim.location, victim.dimension); // corneta baixa (10 s de intervalo próprio)
  bump("alarms");

  // MEMÓRIA DA VILA: regiões atacadas recentemente respondem mais forte.
  let trauma = 0;
  if (cfg.villageMemory) {
    trauma = traumaLevel(victim.dimension, victim.location);
    recordVillageEvent(victim.dimension, victim.location, 1);
  }

  // RESGATE: marca o "sequestrador" — os golems têm entrada de alvo
  // prioritária para a tag neuro_threat (interrompem a caça ao aldeão
  // antes de qualquer outra coisa). A marca expira em 30 s.
  try {
    threat.addTag("neuro_threat");
    system.runTimeout(() => {
      try {
        threat.removeTag("neuro_threat");
      } catch {
        /* já morreu/descarregou */
      }
    }, 600);
  } catch {
    /* ignorar */
  }

  const threatLoc = { ...threat.location };

  // PINÇA: os dois primeiros defensores convergem por LADOS OPOSTOS da
  // ameaça (postos perpendiculares a ±5 blocos); o terceiro vai direto.
  // O monstro se vê cercado em vez de enfileirar os defensores.
  const tdx = threatLoc.x - victim.location.x;
  const tdz = threatLoc.z - victim.location.z;
  const tlen = Math.sqrt(tdx * tdx + tdz * tdz) || 1;
  const ppx = -tdz / tlen, ppz = tdx / tlen; // perpendicular unitária
  const posts = [
    { x: threatLoc.x + ppx * 5, y: threatLoc.y, z: threatLoc.z + ppz * 5 },
    { x: threatLoc.x - ppx * 5, y: threatLoc.y, z: threatLoc.z - ppz * 5 },
    threatLoc
  ];

  try {
    // 1) Defensores: alertar e direcionar em pinça até a ameaça.
    const golems = victim.dimension.getEntities({
      location: victim.location,
      maxDistance: 32 + trauma * 4,
      families: ["neuro_defender"]
    });
    let g = 0;
    for (const golem of golems) {
      if (g >= 3) break;
      V.tryTrigger(golem, "neuro:alert");
      const gb = getBrain(golem);
      gb.lastKnown = threatLoc;
      gb.lastSeenTick = system.currentTick;
      const far = V.distSq(golem.location, threatLoc) > 12 * 12;
      if (far && !gb.searching && !V.safeTarget(golem)) {
        startSearch(gb, groundSnap(victim.dimension, posts[g]));
      }
      g++;
    }

    // 2) Aldeões próximos: dispersão (o pânico nativo faz o resto).
    const villagers = victim.dimension.getEntities({
      location: victim.location,
      maxDistance: 16,
      families: ["villager"]
    });
    let n = 0;
    for (const v of villagers) {
      if (n++ >= 8) break;
      V.tryEffect(v, "speed", 160 + trauma * 40, 0);
    }

    // 3) Vila SEM golem: os jogadores são a defesa — aviso no HUD de quem
    // está por perto (multiplayer: todos num raio de 48 são avisados).
    if (g === 0 || trauma >= 2) {
      const players = victim.dimension.getPlayers({
        location: victim.location,
        maxDistance: 48
      });
      let k = 0;
      for (const p of players) {
        if (k++ >= 8) break;
        try {
          p.onScreenDisplay.setActionBar("§c[Alerta] Aldeões sob ataque nas redondezas!");
        } catch {
          /* sem HUD */
        }
      }
    }
  } catch {
    /* área/dimensão indisponível */
  }
}

/** Registra os gatilhos orientados a evento. */
export function initDefense() {
  world.afterEvents.entityHurt.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled) return;

    const victim = ev.hurtEntity;
    const src = ev.damageSource && ev.damageSource.damagingEntity;

    // --- Alarme de vila: aldeão ferido por monstro ---
    if (src && V.isVillagerLike(victim) && V.hasFamily(src, "monster")) {
      villageAlarm(src, victim, cfg);
      return;
    }

    // --- Enxame: ferir uma abelha enfurece a colmeia (não dispersa) ---
    if (cfg.beeSwarm && victim.typeId === "minecraft:bee") {
      swarmAnger(victim);
      return;
    }

    // --- Pânico de rebanho: pacífico/neutro ferido assusta a espécie ---
    if (!cfg.herdPanic) return;
    if (system.currentTick - lastPanicTick < 20) return;
    if (!V.alive(victim)) return;
    if (victim.typeId === "minecraft:player") return;
    if (V.hasFamily(victim, "monster")) return;
    if (V.hasFamily(victim, "inanimate")) return; // waypoints
    lastPanicTick = system.currentTick;
    // Filhote ferido? (babyGuard) O rebanho reage mais longe e por mais
    // tempo — adultos debandam JUNTO com a cria (o follow_parent do bebê
    // o mantém colado nos adultos: escolta natural, sem polling).
    let isBaby = false;
    try {
      isBaby = cfg.babyGuard && !!victim.getComponent("minecraft:is_baby");
    } catch {
      /* ignorar */
    }
    // PRESSÃO DE CAÇA: fauna de região muito caçada é ARISCA — pânico
    // mais amplo/longo e (vaca/galinha) evita jogadores por 20 s.
    let pressure = 0;
    if (cfg.huntingPressure) {
      pressure = pressureLevel(victim.dimension, victim.location);
    }
    const radius = Math.min(21, (isBaby ? 18 : 12) + pressure * 3);
    const boost = (isBaby ? 240 : 120) + pressure * 40;
    const cap = (isBaby ? 10 : 6) + pressure;
    try {
      const peers = victim.dimension.getEntities({
        location: victim.location,
        maxDistance: radius,
        type: victim.typeId
      });
      let n = 0;
      for (const p of peers) {
        if (p.id === victim.id) continue;
        if (n++ >= cap) break;
        V.tryEffect(p, "speed", boost, 0);
        if (pressure >= 1) V.tryTrigger(p, "neuro:wary_on");
      }
      if (pressure >= 1) V.tryTrigger(victim, "neuro:wary_on");
    } catch {
      /* ignorar */
    }
  });

  // Sino tático: qualquer interação com um sino conta como badalar.
  try {
    world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
      if (!ev.block || ev.block.typeId !== "minecraft:bell") return;
      bellRung(ev.player, ev.block);
    });
  } catch {
    /* evento indisponível nesta versão: sino tático inativo */
  }

  // Sino também toca por projétil (flechada no sino, como no vanilla).
  try {
    world.afterEvents.projectileHitBlock.subscribe((ev) => {
      try {
        const hit = ev.getBlockHit && ev.getBlockHit();
        const block = hit && hit.block;
        if (!block || block.typeId !== "minecraft:bell") return;
        const shooter =
          ev.source && ev.source.typeId === "minecraft:player"
            ? ev.source
            : undefined;
        bellRung(shooter, block);
      } catch {
        /* ignorar */
      }
    });
  } catch {
    /* evento indisponível */
  }

  // LUTO: aldeão MORTO por monstro é o evento mais grave — trauma +2 e
  // alarme completo (que soma +1; morte marca a região com força tripla).
  world.afterEvents.entityDie.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.villageDefense) return;
    const dead = ev.deadEntity;
    const killer = ev.damageSource && ev.damageSource.damagingEntity;
    if (!dead || !killer) return;
    if (!V.isVillagerLike(dead) || !V.hasFamily(killer, "monster")) return;
    if (cfg.villageMemory) {
      recordVillageEvent(dead.dimension, dead.location, 2);
    }
    villageAlarm(killer, dead, cfg);
  });

  // INVESTIGADOR: explosão perto de aldeões manda o golem ocioso mais
  // próximo inspecionar o local (assinatura própria — chamar a partir de
  // moods.js criaria ciclo de import moods->defense->senses->moods).
  try {
    world.afterEvents.explosion.subscribe((ev) => {
      const cfg = getConfig();
      if (!cfg.enabled || !cfg.villageDefense) return;
      if (system.currentTick - lastInvestigateTick < 200) return; // 10 s
      const blast = V.explosionOrigin(ev);
      if (!blast) return;
      const origin = blast.origin;
      const dim = blast.dimension;
      try {
        // Só interessa se há aldeões por perto (é assunto da vila).
        const near = dim.getEntities({
          location: origin,
          maxDistance: 24,
          families: ["villager"]
        });
        let hasVillager = false;
        for (const _ of near) {
          hasVillager = true;
          break;
        }
        if (!hasVillager) return;
        lastInvestigateTick = system.currentTick;
        const golems = dim.getEntities({
          location: origin,
          maxDistance: 32,
          families: ["neuro_defender"]
        });
        for (const golem of golems) {
          if (V.safeTarget(golem)) continue;
          const gb = getBrain(golem);
          if (gb.searching) continue;
          gb.lastKnown = { ...origin };
          gb.lastSeenTick = system.currentTick;
          startSearch(gb, origin);
          break; // um investigador basta
        }
      } catch {
        /* ignorar */
      }
    });
  } catch {
    /* evento indisponível */
  }

  // VIDA SOCIAL: a cada 30 s, um par de aldeões próximos "conversa"
  // (sons vanilla) perto de cada jogador — ambiência barata (1 consulta
  // por jogador a cada 600 ticks, teto de 8 jogadores e 6 aldeões).
  system.runInterval(() => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.villageAmbience) return;
    try {
      const players = world.getAllPlayers();
      let pi = 0;
      for (const p of players) {
        if (pi++ >= 8) break;
        const found = p.dimension.getEntities({
          location: p.location,
          maxDistance: 20,
          families: ["villager"]
        });
        const list = [];
        for (const v of found) {
          list.push(v);
          if (list.length >= 6) break;
        }
        let done = false;
        for (let i = 0; i < list.length && !done; i++) {
          for (let j = i + 1; j < list.length; j++) {
            if (V.distSq(list[i].location, list[j].location) < 9) {
              const snd =
                system.currentTick % 2 === 0
                  ? "mob.villager.idle"
                  : "mob.villager.haggle";
              try {
                p.dimension.playSound(snd, list[i].location, { volume: 0.8 });
              } catch {
                /* som indisponível */
              }
              done = true;
              break;
            }
          }
        }
      }
    } catch {
      /* ignorar */
    }
  }, 600);
}
