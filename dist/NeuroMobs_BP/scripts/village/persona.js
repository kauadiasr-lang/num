/**
 * village/persona.js — Alma individual de cada aldeão (v1.3).
 *
 * No primeiro contato com os sistemas da vila, cada aldeão sorteia UMA
 * VEZ (persistido na própria entidade — sobrevive a reload e vale em
 * multiplayer):
 *  - nome + sobrenome de família (nameTag visível: "Iara Ribeiro");
 *  - 5 traços 0..9: coragem, sociabilidade, generosidade, curiosidade
 *    e diligência (eficiência de profissão);
 *  - humor dinâmico: felicidade e estresse (0..9), que os sistemas
 *    reforçam/curam e que DECAI para o neutro por carimbo de tempo
 *    (zero polling — o decaimento é calculado na leitura).
 *
 * Consequências reais: sociáveis conversam mais (social.js), generosos
 * dão presentes, curiosos assistem ao pôr do sol, corajosos não se
 * escondem no lockdown, diligentes trabalham com bônus (jobs.js) e o
 * estresse alto deixa a vila irritadiça (eventos e fofoca de crime).
 */
import { world, system } from "@minecraft/server";
import { surnameFor, surnameName } from "./families.js";
import { rosterOf } from "./registry.js";

const NAMES = [
  "Iara", "Caio", "Bruna", "Davi", "Lia", "Otto", "Nina", "Ravi",
  "Alba", "Enzo", "Rosa", "Tiago", "Vera", "Igor", "Sofia", "Pedro",
  "Luz", "Bento", "Clara", "Noah", "Dora", "Ivo", "Ana", "Gael"
];

/** Lê a persona (ou cria e persiste). Retorna null se a entidade caiu. */
export function ensurePersona(villager, village) {
  try {
    let raw = villager.getDynamicProperty("neuro:persona");
    if (typeof raw === "string") return JSON.parse(raw);
    const p = {
      name: NAMES[Math.floor(Math.random() * NAMES.length)],
      fam: surnameFor(villager, village), // índice do sobrenome na família
      courage: Math.floor(Math.random() * 10),
      social: Math.floor(Math.random() * 10),
      giving: Math.floor(Math.random() * 10),
      curious: Math.floor(Math.random() * 10),
      diligent: Math.floor(Math.random() * 10)
    };
    villager.setDynamicProperty("neuro:persona", JSON.stringify(p));
    return p;
  } catch {
    return null;
  }
}

/** Aplica o nameTag "Nome Sobrenome" (uma vez; não sobrescreve batismo). */
export function applyName(villager, persona, surname, cfg) {
  if (!cfg.villagerNames) return;
  try {
    if (!villager.nameTag) {
      villager.nameTag = `§f${persona.name} ${surname}§r`;
    }
  } catch {
    /* ignorar */
  }
}

// ------------------------------------------------------ humor dinâmico
// Guardado como {h, s, t} — decaimento para o neutro (5) calculado na
// leitura pela idade do carimbo: 1 ponto por meio-dia de jogo.
function moodOf(villager) {
  try {
    const raw = villager.getDynamicProperty("neuro:mood");
    if (typeof raw === "string") return JSON.parse(raw);
  } catch {
    /* segue */
  }
  return { h: 5, s: 0, t: system.currentTick };
}

function decay(value, ageTicks, toward) {
  const steps = Math.floor(ageTicks / 12000);
  if (value > toward) return Math.max(toward, value - steps);
  return Math.min(toward, value + steps);
}

export function readMood(villager) {
  const m = moodOf(villager);
  const age = system.currentTick - (m.t || 0);
  return { happiness: decay(m.h, age, 5), stress: decay(m.s, age, 0) };
}

/** Ajusta humor (dh/ds podem ser negativos) e persiste com carimbo novo. */
export function nudgeMood(villager, dh, ds) {
  try {
    const cur = readMood(villager);
    const m = {
      h: Math.max(0, Math.min(9, cur.happiness + dh)),
      s: Math.max(0, Math.min(9, cur.stress + ds)),
      t: system.currentTick
    };
    villager.setDynamicProperty("neuro:mood", JSON.stringify(m));
  } catch {
    /* entidade descarregou */
  }
}

/** Tarefa de vila: batiza até 4 aldeões sem persona por fatia. */
export function personaTask(v, cfg) {
  let dim;
  try {
    dim = world.getDimension(v.dim);
  } catch {
    return;
  }
  try {
    const folks = rosterOf(v);
    let named = 0;
    for (const f of folks) {
      if (named >= 4) break;
      let has = false;
      try {
        has = typeof f.getDynamicProperty("neuro:persona") === "string";
      } catch {
        continue;
      }
      if (has) continue;
      const p = ensurePersona(f, v);
      if (!p) continue;
      applyName(f, p, surnameName(v, p.fam), cfg);
      named++;
    }
  } catch {
    /* área indisponível */
  }
}
