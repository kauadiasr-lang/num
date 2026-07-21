/**
 * village/events.js — Eventos emergentes da vila (v1.3).
 *
 * Um motor de ELEGIBILIDADE: a cada fatia, os eventos são avaliados em
 * rodízio e o primeiro elegível dispara (cada um com cooldown próprio
 * gravado no registro). Nada é aleatório puro — todo evento nasce do
 * ESTADO REAL da vila (comida, ameaça, prosperidade, crianças, clima):
 *
 *  FESTIVAL — fartura + paz + entardecer: fogos REAIS (entidades),
 *   música, felicidade geral, +prosperidade; consome 4 comidas do
 *   celeiro. Jogadores honrados são convidados pelo chat.
 *  CASAMENTO — dois adultos felizes de linhagens diferentes: sinos,
 *   corações, e o CÔNJUGE MUDA DE SOBRENOME no nameTag (as linhagens
 *   se unem no registro — herança conta os dois lados).
 *  NASCIMENTO — fartura + vila pequena: um casal recebe pão físico
 *   (disposição VANILLA) → bebês nascem pelo mecanismo do próprio jogo;
 *   o nascimento é detectado (entitySpawn) e vira crônica.
 *  EPIDEMIA — escassez + aglomeração: 2 aldeões adoecem (tag
 *   neuro_sick, Náusea/Lentidão visíveis); doentes CONTAGIAM vizinhos;
 *   o CLÉRIGO cura (jobs.js). Sem clérigo, dura um dia.
 *  CRIANÇA PERDIDA — bebê a >40 do centro: preocupação + guarda em
 *   busca REAL (waypoint); se um jogador estiver junto da criança no
 *   reencontro, ganha honra ("trouxe a criança para casa").
 *  CRIAÇÃO DE GADO — fartura + pasto vazio: a vila consome 2 comidas e
 *   um filhote REAL nasce no pasto (corações) — rebanho com custo.
 *  CARAVANA MERCANTE — prosperidade: um comerciante ambulante + llamas
 *   chegam DE VERDADE perto do centro (trades vanilla reais); guardas
 *   escoltam; +prosperidade. Se membros da caravana morreram na última
 *   visita (memória), a próxima vem só de dia e com escolta dobrada.
 *  BANDIDOS (opt-in banditRaids) — noite + paz longa: 2-3 pillagers
 *   surgem no perímetro; todos os sistemas de defesa reagem de verdade.
 */
import { world, system, ItemStack } from "@minecraft/server";
import { centerOf, threatOf, raiseThreat, markDirty, villageAt, rosterOf, prosperityOf, addProsperity } from "./registry.js";
import { withdraw, isFood } from "./economy.js";
import { surnameName } from "./families.js";
import { nudgeMood } from "./persona.js";
import { say } from "./social.js";
import { creditHonor, honorOf } from "./honor.js";
import { getBrain } from "../core/core.js";
import { startSearch } from "../ai/senses.js";
import { bump } from "../player/stats.js";
import * as V from "../core/utils.js";

function due(v, key, cooldown) {
  const t = (v.flags.evCd && v.flags.evCd[key]) || 0;
  return system.currentTick - t >= cooldown;
}

function arm(v, key) {
  if (!v.flags.evCd) v.flags.evCd = {};
  v.flags.evCd[key] = system.currentTick;
  markDirty();
}

function chronicle(line) {
  try {
    world.sendMessage(`§6[Crônica]§r ${line}`);
  } catch {
    /* ignorar */
  }
}

function adultsOf(v, max = 12) {
  const out = [];
  try {
    const folks = rosterOf(v);
    for (const f of folks) {
      try {
        if (f.getComponent("minecraft:is_baby")) continue;
      } catch {
        continue;
      }
      out.push(f);
      if (out.length >= max) break;
    }
  } catch {
    /* ignorar */
  }
  return out;
}

// ------------------------------------------------------------- eventos

function festival(v, dim, cfg) {
  let time = 0;
  try {
    time = world.getTimeOfDay();
  } catch {
    return false;
  }
  if (time < 11000 || time > 13500) return false; // só no entardecer
  if (threatOf(v) > 0 || v.flags.lockdown) return false;
  if ((v.ledger.food || 0) < 24) return false;
  if (!due(v, "festival", 72000)) return false; // 3 dias
  if (!withdraw(v, dim, isFood, 4)) return false;
  arm(v, "festival");
  addProsperity(v, 1);
  const center = centerOf(v);
  try {
    for (let i = 0; i < 3; i++) {
      dim.spawnEntity("minecraft:fireworks_rocket", {
        x: center.x + (i - 1) * 3, y: center.y + 1, z: center.z + (i - 1) * 2
      });
    }
    dim.playSound("random.levelup", center, { volume: 0.8, pitch: 0.9 });
  } catch {
    /* sem fogos: a festa segue */
  }
  for (const a of adultsOf(v)) {
    nudgeMood(a, 2, -2);
    V.tryEffect(a, "speed", 300, 0);
    if (Math.random() < 0.4) say(a, "festival", cfg);
    try {
      dim.spawnParticle("minecraft:villager_happy", {
        x: a.location.x, y: a.location.y + 2, z: a.location.z
      });
    } catch {
      /* ignorar */
    }
  }
  try {
    for (const p of dim.getPlayers({ location: center, maxDistance: 64 })) {
      if (honorOf(v, p.id) >= 0) {
        p.sendMessage("§d[Vila]§r Festival hoje! Você é bem-vindo na praça.");
      }
    }
  } catch {
    /* ignorar */
  }
  chronicle("A vila celebra um festival da colheita.");
  bump("festivals");
  return true;
}

function wedding(v, dim, cfg) {
  if (!cfg.villageFamilies) return false;
  if (!due(v, "wedding", 48000)) return false; // 2 dias
  if (threatOf(v) > 1 || v.flags.lockdown) return false;
  const center = centerOf(v);
  const adults = adultsOf(v);
  let bride = null, groom = null, pb = null, pg = null;
  for (const a of adults) {
    let p;
    try {
      const raw = a.getDynamicProperty("neuro:persona");
      p = typeof raw === "string" ? JSON.parse(raw) : null;
      if (!p || a.getDynamicProperty("neuro:married")) continue;
    } catch {
      continue;
    }
    if (!bride) {
      bride = a;
      pb = p;
    } else if (p.fam !== pb.fam) {
      groom = a;
      pg = p;
      break;
    }
  }
  if (!bride || !groom) return false;
  arm(v, "wedding");
  try {
    bride.setDynamicProperty("neuro:married", true);
    groom.setDynamicProperty("neuro:married", true);
    // O cônjuge adota o sobrenome: linhagens se unem à vista de todos.
    const newSurname = surnameName(v, pb.fam);
    if (v.fams && v.fams[pg.fam]) {
      v.fams[pg.fam].n = Math.max(0, v.fams[pg.fam].n - 1); // deixa a antiga
    }
    pg.fam = pb.fam;
    groom.setDynamicProperty("neuro:persona", JSON.stringify(pg));
    if (cfg.villagerNames) groom.nameTag = `§f${pg.name} ${newSurname}§r`;
    if (v.fams && v.fams[pb.fam]) v.fams[pb.fam].n++;
    markDirty();
  } catch {
    return false;
  }
  try {
    for (const e of [bride, groom]) {
      dim.spawnParticle("minecraft:heart_particle", {
        x: e.location.x, y: e.location.y + 2, z: e.location.z
      });
      nudgeMood(e, 3, -3);
    }
    dim.playSound("random.levelup", bride.location, { volume: 0.6, pitch: 1.4 });
  } catch {
    /* ignorar */
  }
  chronicle(
    `Casamento na vila: §e${pb.name}§r e §e${pg.name}§r agora são ${surnameName(v, pb.fam)}.`
  );
  bump("weddings");
  return true;
}

function birthBoost(v, dim, cfg) {
  if (!cfg.villageEconomy) return false;
  if (v.flags.foodShort || (v.ledger.food || 0) < 16) return false;
  if (!due(v, "birth", 36000)) return false; // 1,5 dia
  const center = centerOf(v);
  const adults = adultsOf(v, 8);
  if (adults.length < 2 || adults.length > 14) return false;
  if (!withdraw(v, dim, (id) => id === "minecraft:bread", 4)) return false;
  arm(v, "birth");
  // Pão físico para um casal: disposição vanilla → bebê real. O que sai
  // do baú (4) é exatamente o que aparece no chão (2+2) — zero criação.
  for (let i = 0; i < 2; i++) {
    const a = adults[i];
    try {
      dim.spawnItem(new ItemStack("minecraft:bread", 2), {
        x: a.location.x, y: a.location.y + 1, z: a.location.z
      });
      dim.spawnParticle("minecraft:heart_particle", {
        x: a.location.x, y: a.location.y + 2, z: a.location.z
      });
    } catch {
      /* ignorar */
    }
  }
  return true;
}

function epidemic(v, dim, cfg) {
  if (!v.flags.foodShort) return false;
  if (!due(v, "epidemic", 96000)) return false; // 4 dias
  const center = centerOf(v);
  const adults = adultsOf(v);
  if (adults.length < 6) return false;
  arm(v, "epidemic");
  let sick = 0;
  for (const a of adults) {
    if (sick >= 2) break;
    try {
      a.addTag("neuro_sick");
      V.tryEffect(a, "nausea", 1200, 0);
      V.tryEffect(a, "slowness", 1200, 0);
      nudgeMood(a, -2, 3);
      sick++;
    } catch {
      continue;
    }
  }
  if (sick > 0) {
    chronicle("Uma febre se espalha pela vila — o clérigo tem trabalho.");
    bump("epidemics");
    return true;
  }
  return false;
}

/** Contágio + cura espontânea da epidemia (rodada nas fatias). */
function epidemicSpread(v, dim) {
  const center = centerOf(v);
  try {
    const folks = dim.getEntities({
      location: center, maxDistance: 40, families: ["villager"]
    });
    let sickCount = 0;
    const sickOnes = [];
    for (const f of folks) {
      if (f.hasTag("neuro_sick")) {
        sickCount++;
        sickOnes.push(f);
      }
    }
    if (sickCount === 0) return false;
    // Fim natural: um dia depois do surto, todos saram.
    const started = (v.flags.evCd && v.flags.evCd.epidemic) || 0;
    if (system.currentTick - started > 24000) {
      for (const s of sickOnes) s.removeTag("neuro_sick");
      chronicle("A febre passou.");
      return true;
    }
    // Contágio: 1 doente pode passar para 1 vizinho (teto 4 doentes).
    if (sickCount < 4) {
      for (const s of sickOnes) {
        const near = dim.getEntities({
          location: s.location, maxDistance: 4, families: ["villager"]
        });
        for (const n of near) {
          if (n.id === s.id || n.hasTag("neuro_sick")) continue;
          if (Math.random() < 0.3) {
            n.addTag("neuro_sick");
            V.tryEffect(n, "nausea", 1200, 0);
            V.tryEffect(n, "slowness", 1200, 0);
          }
          return true;
        }
      }
    }
    // Sintomas visíveis persistem.
    for (const s of sickOnes) {
      V.tryEffect(s, "slowness", 300, 0);
      try {
        dim.spawnParticle("minecraft:basic_smoke_particle", {
          x: s.location.x, y: s.location.y + 1.8, z: s.location.z
        });
      } catch {
        /* ignorar */
      }
    }
    return true;
  } catch {
    return false;
  }
}

function missingChild(v, dim, cfg) {
  const center = centerOf(v);
  try {
    const kids = dim.getEntities({
      location: center, maxDistance: 80, families: ["villager"]
    });
    let anyBaby = false;
    for (const k of kids) {
      let baby = false;
      try {
        baby = !!k.getComponent("minecraft:is_baby");
      } catch {
        continue;
      }
      if (!baby) continue;
      anyBaby = true;
      const d2 = V.distSq(k.location, center);
      if (v.flags.lostChild) {
        // Reencontro?
        if (d2 < 24 * 24) {
          v.flags.lostChild = false;
          markDirty();
          chronicle("A criança perdida voltou para casa.");
          try {
            const near = dim.getPlayers({
              location: k.location, maxDistance: 12
            });
            for (const p of near) {
              creditHonor(v, p, 3, "Trouxe a criança");
              break;
            }
          } catch {
            /* ignorar */
          }
          return true;
        }
        return false; // segue perdida; busca já armada
      }
      if (d2 > 40 * 40 && due(v, "lost", 24000)) {
        arm(v, "lost");
        v.flags.lostChild = true;
        markDirty();
        chronicle("Uma criança sumiu! A guarda saiu em busca.");
        try {
          const guards = dim.getEntities({
            location: center, maxDistance: 64, families: ["neuro_defender"]
          });
          for (const g of guards) {
            if (V.safeTarget(g)) continue;
            const b = getBrain(g);
            if (b.searching) continue;
            b.lastKnown = { ...k.location };
            b.lastSeenTick = system.currentTick;
            startSearch(b, k.location);
            break;
          }
        } catch {
          /* ignorar */
        }
        return true;
      }
    }
    // Não há mais bebê nenhum: a busca termina (a crônica lamenta).
    if (v.flags.lostChild && !anyBaby) {
      v.flags.lostChild = false;
      markDirty();
      chronicle("§cA criança perdida nunca voltou.§r A vila está de luto.");
    }
  } catch {
    /* ignorar */
  }
  return false;
}

function livestock(v, dim, cfg) {
  if (!cfg.villageEconomy) return false;
  if (v.flags.foodShort || (v.ledger.food || 0) < 20) return false;
  if (!due(v, "livestock", 48000)) return false;
  const center = centerOf(v);
  let animals = 0;
  try {
    for (const type of ["minecraft:cow", "minecraft:sheep", "minecraft:chicken"]) {
      for (const _ of dim.getEntities({
        location: center, maxDistance: 32, type
      })) {
        animals++;
        if (animals >= 4) break;
      }
    }
  } catch {
    return false;
  }
  if (animals >= 4) return false;
  if (!withdraw(v, dim, isFood, 2)) return false;
  arm(v, "livestock");
  try {
    const baby = dim.spawnEntity(
      Math.random() < 0.5 ? "minecraft:chicken" : "minecraft:cow",
      { x: v.x + 8, y: 65, z: v.z + 8 }
    );
    V.tryTrigger(baby, "minecraft:entity_born");
    dim.spawnParticle("minecraft:heart_particle", {
      x: v.x + 8, y: 66, z: v.z + 8
    });
  } catch {
    return false;
  }
  chronicle("A vila investiu em criação: um filhote novo no pasto.");
  return true;
}

function caravan(v, dim, cfg) {
  if (prosperityOf(v) < 2) return false;
  if (!due(v, "caravan", 48000)) return false;
  const ambushed = v.flags.caravanAmbushed;
  let day = true;
  try {
    day = world.getTimeOfDay() < 12000;
  } catch {
    /* segue */
  }
  if (ambushed && !day) return false; // rota lembrada: só chegam de dia
  if (threatOf(v) >= 3) return false;
  arm(v, "caravan");
  const center = centerOf(v);
  const at = { x: center.x + 12, y: center.y + 1, z: center.z };
  try {
    dim.spawnEntity("minecraft:wandering_trader", at);
    for (let i = 0; i < 2; i++) {
      dim.spawnEntity("minecraft:trader_llama", {
        x: at.x + 1 + i, y: at.y, z: at.z + 1
      });
    }
    // Escolta: guardas ao ponto de chegada (dobrada se houve emboscada).
    const guards = dim.getEntities({
      location: center, maxDistance: 64, families: ["neuro_guard"]
    });
    let e = 0;
    for (const g of guards) {
      if (e++ >= (ambushed ? 2 : 1)) break;
      const b = getBrain(g);
      if (!b.searching && !V.safeTarget(g)) {
        b.lastKnown = { ...at };
        b.lastSeenTick = system.currentTick;
        startSearch(b, at);
      }
    }
    dim.playSound("mob.villager.haggle", at, { volume: 1.0, pitch: 0.8 });
  } catch {
    return false;
  }
  addProsperity(v, 1);
  chronicle("Uma caravana mercante chegou à vila — bons negócios!");
  bump("caravans");
  return true;
}

function banditRaid(v, dim, cfg) {
  if (!cfg.banditRaids) return false;
  let night = false;
  try {
    night = world.getTimeOfDay() >= 13000;
  } catch {
    return false;
  }
  if (!night) return false;
  if (!due(v, "bandits", 120000)) return false; // 5 dias
  if (Math.random() < 0.5) {
    arm(v, "bandits"); // metade das janelas passa em paz
    return false;
  }
  arm(v, "bandits");
  const center = centerOf(v);
  const n = 2 + Math.floor(Math.random() * 2);
  try {
    for (let i = 0; i < n; i++) {
      dim.spawnEntity("minecraft:pillager", {
        x: center.x + 40 - i * 2, y: center.y + 2, z: center.z + 40
      });
    }
  } catch {
    return false;
  }
  raiseThreat(v, 3);
  chronicle("§cBandidos rondam a vila!§r A guarda foi mobilizada.");
  return true;
}

// ---------------------------------------------------------- tarefa/init
const EVENTS = [
  festival, wedding, birthBoost, epidemic, missingChild,
  livestock, caravan, banditRaid
];

export function eventsTask(v, cfg) {
  if (!cfg.villageEvents) return;
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }
  // A epidemia ativa tem manutenção própria antes de novos eventos —
  // mas só vale a consulta se houve surto no último dia de jogo.
  const lastPlague = (v.flags.evCd && v.flags.evCd.epidemic) || 0;
  if (
    lastPlague > 0 &&
    system.currentTick - lastPlague <= 26000 &&
    epidemicSpread(v, dim)
  ) {
    return;
  }
  const start = v.flags.evRot || 0;
  for (let i = 0; i < EVENTS.length; i++) {
    const idx = (start + i) % EVENTS.length;
    if (EVENTS[idx](v, dim, cfg)) {
      v.flags.evRot = (idx + 1) % EVENTS.length;
      return;
    }
  }
  v.flags.evRot = (start + 1) % EVENTS.length;
}

export function initEvents() {
  // Nascimento real detectado: crônica + boas-vindas.
  try {
    world.afterEvents.entitySpawn.subscribe((ev) => {
      const e = ev.entity;
      if (!e || !V.hasFamily(e, "villager")) return;
      let baby = false;
      try {
        baby = !!e.getComponent("minecraft:is_baby");
      } catch {
        return;
      }
      if (!baby) return;
      const v = villageAt(e.dimension, e.location, false);
      if (!v) return;
      chronicle("Um bebê nasceu na vila!");
      bump("births");
      try {
        e.dimension.spawnParticle("minecraft:heart_particle", {
          x: e.location.x, y: e.location.y + 1.5, z: e.location.z
        });
      } catch {
        /* ignorar */
      }
    });
  } catch {
    /* evento indisponível */
  }

  // Memória de emboscada: caravana morta perto da vila marca a rota.
  world.afterEvents.entityDie.subscribe((ev) => {
    const dead = ev.deadEntity;
    if (!dead) return;
    if (
      dead.typeId !== "minecraft:wandering_trader" &&
      dead.typeId !== "minecraft:trader_llama"
    ) {
      return;
    }
    const v = villageAt(dead.dimension, dead.location, false);
    if (!v) return;
    v.flags.caravanAmbushed = true;
    raiseThreat(v, 2);
    markDirty();
    chronicle("§cA caravana foi emboscada!§r As próximas virão apenas de dia.");
  });
}
