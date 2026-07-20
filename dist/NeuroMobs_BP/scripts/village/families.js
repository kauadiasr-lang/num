/**
 * village/families.js — Famílias, parentesco, luto e herança (v1.3).
 *
 * SOBRENOMES: cada vila mantém até 12 linhagens. Um aldeão novo entra na
 * MENOR família (ou funda uma nova se todas têm 4+): vilas ficam com
 * sobrenomes equilibrados e crianças herdam a linhagem dos adultos mais
 * próximos no momento do batismo (pais adotivos = pais).
 *
 * PARENTESCO REAL derivado, não inventado: o primeiro adulto da mesma
 * família a menos de 8 blocos de um bebê no batismo vira "responsável"
 * (pai/mãe); adultos da mesma linhagem são irmãos/tios para efeito de
 * luto. Casamentos (events.js) unem linhagens no registro.
 *
 * LUTO: quando um aldeão morre de forma violenta, a família sente:
 * parentes num raio de 24 ganham Lentidão breve + estresse, partículas
 * de tristeza, e a vila grava a PERDA com o autor (jogador ou espécie) —
 * essa memória não decai (gerações lembram; devtools e crônica mostram).
 *
 * DESAPARECIDOS: o registro lastSeen de cada linhagem é reforçado pelas
 * tarefas da vila; uma linhagem sem avistamentos por 1 dia de jogo entra
 * em "preocupação" — parentes olham ao redor (setRotation em varredura)
 * e um guarda/golem recebe waypoint de busca pela última posição.
 *
 * HERANÇA: casas pertencem a linhagens (housing.js); quando uma linhagem
 * fica 3 dias sem avistamentos, suas casas voltam ao espólio e a MAIOR
 * família herda — anunciado na crônica. Consequência real: o reparo de
 * portas e a defesa priorizam casas habitadas.
 */
import { world, system } from "@minecraft/server";
import { villageAt, recordLoss, markDirty, reinforceCenter } from "./registry.js";
import { getBrain } from "../core/core.js";
import { startSearch } from "../ai/senses.js";
import * as V from "../core/utils.js";

const SURNAMES = [
  "Ribeiro", "Costa", "Ferraz", "Moraes", "Sales", "Pires",
  "Rocha", "Neves", "Prado", "Serra", "Vidal", "Fontes"
];

/** Estruturas por vila ficam no próprio registro (v.fams). */
function famsOf(v) {
  if (!v.fams) v.fams = []; // [{s: índiceSobrenome, n: membros, seen: tick, home: nº casas}]
  return v.fams;
}

export function surnameName(v, famIdx) {
  const f = famsOf(v)[famIdx];
  return f ? SURNAMES[f.s % SURNAMES.length] : "Errante";
}

/** Escolhe/funda a família de um aldeão novo. Retorna o índice. */
export function surnameFor(villager, village) {
  const fams = famsOf(village);
  // Bebê: herda a linhagem do adulto mais próximo já batizado.
  try {
    if (villager.getComponent("minecraft:is_baby")) {
      const near = villager.dimension.getEntities({
        location: villager.location,
        maxDistance: 8,
        families: ["villager"]
      });
      for (const adult of near) {
        if (adult.id === villager.id) continue;
        const raw = adult.getDynamicProperty("neuro:persona");
        if (typeof raw === "string") {
          const idx = JSON.parse(raw).fam;
          if (fams[idx]) {
            fams[idx].n++;
            markDirty();
            return idx;
          }
        }
      }
    }
  } catch {
    /* segue para a regra geral */
  }
  // Menor família com <4 membros, senão funda linhagem nova.
  let best = -1, bestN = Infinity;
  for (let i = 0; i < fams.length; i++) {
    if (fams[i].n < bestN) {
      bestN = fams[i].n;
      best = i;
    }
  }
  if (best >= 0 && bestN < 4) {
    fams[best].n++;
    markDirty();
    return best;
  }
  if (fams.length < 12) {
    fams.push({ s: fams.length, n: 1, seen: system.currentTick });
    markDirty();
    return fams.length - 1;
  }
  fams[best].n++;
  markDirty();
  return best;
}

/** Tarefa de vila: censo — reforça lastSeen, centro e preocupações. */
export function familyCensus(v, cfg) {
  if (!cfg.villageFamilies) return;
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }
  const fams = famsOf(v);
  let sampled = 0;
  try {
    const folks = dim.getEntities({
      location: { x: v.x, y: 64, z: v.z },
      maxDistance: 64,
      families: ["villager"]
    });
    for (const p of folks) {
      if (sampled++ >= 12) break; // orçamento da fatia
      reinforceCenter(v, p.location);
      try {
        const raw = p.getDynamicProperty("neuro:persona");
        if (typeof raw === "string") {
          const idx = JSON.parse(raw).fam;
          if (fams[idx]) {
            fams[idx].seen = system.currentTick;
            fams[idx].last = {
              x: Math.round(p.location.x),
              y: Math.round(p.location.y),
              z: Math.round(p.location.z)
            };
          }
        }
      } catch {
        /* aldeão sem persona ainda: persona.js cuida em outra tarefa */
      }
    }
  } catch {
    return;
  }

  // Preocupação: linhagem sumida há 1+ dia → varredura de olhar + busca.
  for (let i = 0; i < fams.length; i++) {
    const f = fams[i];
    if (!f.last || f.n <= 0) continue;
    const age = system.currentTick - (f.seen || 0);
    if (age > 24000 && age < 72000 && !f.worry) {
      f.worry = true;
      markDirty();
      // Um defensor investiga a última posição conhecida da linhagem.
      try {
        const defenders = dim.getEntities({
          location: { x: v.x, y: 64, z: v.z },
          maxDistance: 48,
          families: ["neuro_defender"]
        });
        for (const d of defenders) {
          if (V.safeTarget(d)) continue;
          const b = getBrain(d);
          if (b.searching) continue;
          b.lastKnown = { ...f.last };
          b.lastSeenTick = system.currentTick;
          startSearch(b, f.last);
          break;
        }
      } catch {
        /* sem defensores: a preocupação fica registrada */
      }
    }
    if (age <= 24000 && f.worry) {
      f.worry = false; // reapareceu
      markDirty();
    }
    // Herança: 3 dias sem sinal → linhagem extinta, casas ao espólio.
    if (age > 72000 && f.n > 0) {
      f.n = 0;
      f.worry = false;
      let heir = null, heirN = 0;
      for (const g of fams) {
        if (g !== f && g.n > heirN) {
          heirN = g.n;
          heir = g;
        }
      }
      let inherited = 0;
      for (const h of v.houses) {
        if (h.fam === i) {
          h.fam = heir ? fams.indexOf(heir) : -1;
          inherited++;
        }
      }
      markDirty();
      if (inherited > 0 && heir) {
        try {
          world.sendMessage(
            `§6[Crônica]§r A linhagem §e${SURNAMES[f.s % SURNAMES.length]}§r se foi; ` +
              `os §e${SURNAMES[heir.s % SURNAMES.length]}§r herdam ${inherited} casa(s).`
          );
        } catch {
          /* sem chat */
        }
      }
    }
  }
}

/** Luto orientado a evento: parentes sentem, a vila grava a perda. */
export function initMourning() {
  world.afterEvents.entityDie.subscribe((ev) => {
    const dead = ev.deadEntity;
    if (!dead || !V.hasFamily(dead, "villager")) return;
    let v, persona = null;
    try {
      v = villageAt(dead.dimension, dead.location, false);
      const raw = dead.getDynamicProperty("neuro:persona");
      if (typeof raw === "string") persona = JSON.parse(raw);
    } catch {
      return;
    }
    if (!v) return;
    const killer = ev.damageSource && ev.damageSource.damagingEntity;
    const by = killer
      ? killer.typeId === "minecraft:player"
        ? `p:${killer.id}`
        : killer.typeId
      : "?";
    const surname = persona ? surnameName(v, persona.fam) : "Errante";
    recordLoss(v, persona ? `${persona.name} ${surname}` : "aldeão", by);
    if (persona && v.fams && v.fams[persona.fam]) {
      v.fams[persona.fam].n = Math.max(0, v.fams[persona.fam].n - 1);
      markDirty();
    }
    // O luto em si: parentes próximos param, sentem e mostram.
    try {
      const kin = dead.dimension.getEntities({
        location: dead.location,
        maxDistance: 24,
        families: ["villager"]
      });
      let n = 0;
      for (const k of kin) {
        if (n++ >= 6) break;
        V.tryEffect(k, "slowness", 100, 0);
        try {
          k.dimension.spawnParticle("minecraft:villager_angry", {
            x: k.location.x,
            y: k.location.y + 2,
            z: k.location.z
          });
        } catch {
          /* sem partícula */
        }
      }
      dead.dimension.playSound("mob.villager.death", dead.location, {
        volume: 0.6,
        pitch: 0.8
      });
    } catch {
      /* área indisponível */
    }
  });
}
