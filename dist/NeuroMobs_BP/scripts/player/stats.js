/**
 * stats.js — Crônica do mundo (v1.2).
 *
 * Contadores persistentes dos grandes momentos da IA: gritos de alerta,
 * investigações, emboscadas, retiradas, cercos, veteranos nascidos e
 * abatidos, alarmes de vila e toques de sino. O jogador vê tudo em
 * `/scriptevent neuro:cronica` (ou pelo menu) — o mundo ganha história
 * ("nesta seed, 12 veteranos caíram") e o jogador ganha noção de quanto
 * a IA realmente trabalha.
 *
 * MARCOS (milestones): certos totais anunciam uma linha de crônica no
 * chat de todos (1º veterano abatido, 10º, 50º…). Desligável.
 *
 * Custos: bump() só incrementa um número em RAM e marca sujeira; a
 * gravação (1 dynamic property JSON) roda no máximo 1×/30 s e só quando
 * algo mudou. Zero polling além disso.
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "../core/config.js";

const KEY = "neuro:stats";
const ZERO = {
  alerts: 0,    // gritos de alerta
  hunts: 0,     // buscas/investigações iniciadas
  ambushes: 0,  // emboscadas armadas
  retreats: 0,  // retiradas táticas
  sieges: 0,    // cercos anti-torre
  vetBorn: 0,   // veteranos surgidos
  vetKilled: 0, // veteranos abatidos
  alarms: 0,    // alarmes de vila
  bells: 0,     // toques de sino tático
  guards: 0,    // guardas recrutados (v1.3)
  festivals: 0, // festivais celebrados
  weddings: 0,  // casamentos
  births: 0,    // nascimentos
  epidemics: 0, // surtos de febre
  caravans: 0   // caravanas recebidas
};

let stats = null;
let dirty = false;

function load() {
  if (stats) return stats;
  stats = { ...ZERO };
  try {
    const raw = world.getDynamicProperty(KEY);
    if (typeof raw === "string") stats = { ...ZERO, ...JSON.parse(raw) };
  } catch {
    stats = { ...ZERO };
  }
  return stats;
}

/** Marcos: total -> linha de crônica anunciada a todos. */
const MILESTONES = {
  vetKilled: {
    1: "§6[Crônica]§r O primeiro §6Veterano§r deste mundo foi abatido.",
    10: "§6[Crônica]§r Dez §6Veteranos§r já caíram — os bandos aprenderam a temer.",
    50: "§6[Crônica]§r Cinquenta §6Veteranos§r abatidos. Uma lenda local."
  },
  alerts: {
    100: "§6[Crônica]§r Cem gritos de alerta já ecoaram nesta terra.",
    1000: "§6[Crônica]§r Mil gritos de alerta — a noite inteira fala de você."
  },
  ambushes: {
    25: "§6[Crônica]§r Vinte e cinco emboscadas armadas nas sombras deste mundo."
  }
};

/** Incrementa um contador (e anuncia marco, se cruzado). */
export function bump(key) {
  const s = load();
  if (!(key in s)) return;
  s[key]++;
  dirty = true;
  const cfg = getConfig();
  if (cfg.milestones) {
    const line = MILESTONES[key] && MILESTONES[key][s[key]];
    if (line) {
      try {
        world.sendMessage(line);
        for (const p of world.getAllPlayers()) {
          try {
            p.playSound("random.levelup", { volume: 0.5, pitch: 1.0 });
          } catch {
            /* sem áudio */
          }
        }
      } catch {
        /* mundo indisponível */
      }
    }
  }
}

/** Texto pronto da crônica (usado pelo comando e pelo menu). */
export function chronicleText() {
  const s = load();
  return (
    "§6— Crônica do mundo —§r\n" +
    `§eGritos de alerta:§r ${s.alerts}  §eInvestigações:§r ${s.hunts}\n` +
    `§eEmboscadas:§r ${s.ambushes}  §eRetiradas:§r ${s.retreats}  §eCercos:§r ${s.sieges}\n` +
    `§6Veteranos surgidos:§r ${s.vetBorn}  §6abatidos:§r ${s.vetKilled}\n` +
    `§eAlarmes de vila:§r ${s.alarms}  §eSinos táticos:§r ${s.bells}\n` +
    `§d— Civilização —§r\n` +
    `§eGuardas:§r ${s.guards}  §eFestivais:§r ${s.festivals}  §eCasamentos:§r ${s.weddings}\n` +
    `§eNascimentos:§r ${s.births}  §eFebres:§r ${s.epidemics}  §eCaravanas:§r ${s.caravans}`
  );
}

export function initStats() {
  load();
  // Gravação preguiçosa: no máximo 1×/30 s, e só se algo mudou.
  system.runInterval(() => {
    if (!dirty) return;
    dirty = false;
    try {
      world.setDynamicProperty(KEY, JSON.stringify(stats));
    } catch {
      dirty = true; // mundo indisponível: tenta na próxima janela
    }
  }, 600);
}
