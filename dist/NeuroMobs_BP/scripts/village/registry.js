/**
 * village/registry.js — Identidade, memória e escalonador das vilas (v1.3).
 *
 * UMA VILA = um registro vivo: centro (média móvel das posições de
 * aldeões), livro-razão econômico, honra por jogador, memória de crimes
 * e perdas, nível de conhecimento, prosperidade e ameaça. Registros são
 * descobertos de forma preguiçosa (o primeiro evento envolvendo um
 * aldeão numa área nova cria a vila) e persistidos numa única dynamic
 * property com gravação suja (mesmo padrão do stats.js).
 *
 * LOD + ESCALONADOR: um único runInterval (10 ticks) percorre as vilas
 * em rodízio e executa UMA tarefa de UMA vila por fatia — o custo por
 * tick é constante, independente do número de vilas. Vilas sem jogador
 * num raio de 128 ficam DORMENTES: nenhuma tarefa roda, só o decaimento
 * temporal natural (que é calculado por carimbo de tempo, custo zero).
 *
 * As tarefas são registradas pelos módulos (jobs, economia, social…)
 * via onVillageTask(fn) — o registry não conhece os sistemas, só os
 * agenda. Ordem estável, orçamento medido em ms (teto configurável).
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "../core/config.js";

const KEY = "neuro:villages";
const MAX_VILLAGES = 8;
const MERGE_DIST = 80; // eventos a <80 do centro pertencem à vila
const ACTIVE_DIST = 128; // LOD: jogador a <128 mantém a vila acordada

let villages = null; // [{id,dim,x,z,n, honor:{}, ledger:{}, crimes:[], losses:[], knowledge, threat, prosperity, flags:{}, seenTick}]
let dirty = false;
let nextId = 1;

function load() {
  if (villages) return villages;
  villages = [];
  try {
    const raw = world.getDynamicProperty(KEY);
    if (typeof raw === "string") {
      const data = JSON.parse(raw);
      villages = data.list || [];
      nextId = data.next || villages.length + 1;
    }
  } catch {
    villages = [];
  }
  return villages;
}

export function markDirty() {
  dirty = true;
}

/** Vila responsável por um ponto (cria se não existir). */
export function villageAt(dimension, loc, createIfMissing = true) {
  load();
  let best = null;
  let bestD = Infinity;
  for (const v of villages) {
    if (v.dim !== dimension.id) continue;
    const dx = v.x - loc.x, dz = v.z - loc.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (best && bestD <= MERGE_DIST * MERGE_DIST) return best;
  if (!createIfMissing) return null;
  const v = {
    id: nextId++,
    dim: dimension.id,
    x: Math.round(loc.x),
    z: Math.round(loc.z),
    n: 1, // amostras do centro (média móvel)
    honor: {}, // playerId -> pontos
    ledger: { food: 0, wood: 0, iron: 0, emeralds: 0, tools: 0 },
    granary: null, // {x,y,z} do baú do celeiro
    houses: [], // [{x,y,z,doorDir,fam,broken}]
    crimes: [], // [{p:playerId, kind, t}] (ring buffer)
    losses: [], // [{name, by, t}] mortes de aldeões (gerações lembram)
    knowledge: 0, // bibliotecário acumula; destrava níveis dos guardas
    threat: 0, // ataques recentes elevam; decai por tempo
    prosperity: 0, // comércio/festivais elevam
    guards: 0, // guardas vivos recrutados
    flags: {}, // sinalizações voláteis dos sistemas (escassez, lockdown…)
    seenTick: system.currentTick
  };
  villages.push(v);
  if (villages.length > MAX_VILLAGES) {
    // LRU: descarta a vila vista há mais tempo.
    villages.sort((a, b) => a.seenTick - b.seenTick);
    villages.shift();
  }
  dirty = true;
  return v;
}

/** Reforça o centro da vila com uma nova posição de aldeão (média móvel). */
export function reinforceCenter(v, loc) {
  const w = Math.min(v.n, 24); // peso saturado: o centro estabiliza
  v.x = Math.round((v.x * w + loc.x) / (w + 1));
  v.z = Math.round((v.z * w + loc.z) / (w + 1));
  v.n++;
  v.seenTick = system.currentTick;
}

export function allVillages() {
  return load();
}

export function centerOf(v) {
  return { x: v.x, y: 64, z: v.z };
}

/** Ameaça registrada (ataques): sobe agora, decai por carimbo de tempo. */
export function raiseThreat(v, amount) {
  v.threat = Math.min(10, threatOf(v) + amount);
  v.threatTick = system.currentTick;
  dirty = true;
}

export function threatOf(v) {
  const age = system.currentTick - (v.threatTick || 0);
  const decayed = v.threat - Math.floor(age / 24000); // -1 por dia de jogo
  return Math.max(0, decayed);
}

/** Memória de perdas: quem morreu e quem matou (persiste por gerações). */
export function recordLoss(v, name, by) {
  v.losses.push({ name, by, t: system.currentTick });
  if (v.losses.length > 12) v.losses.shift();
  dirty = true;
}

// ---------------------------------------------------------- escalonador
const tasks = []; // [{name, fn(village, cfg)}] — registrados pelos módulos
let vPtr = 0;
let tPtr = 0;
const activeCache = new Map(); // villageId -> {tick, active}

/** Registra uma tarefa por vila: fn(village, cfg) chamada em rodízio. */
export function onVillageTask(name, fn) {
  tasks.push({ name, fn });
}

/** A vila tem jogador por perto? (cache de 100 ticks — LOD barato) */
export function isActive(v) {
  const c = activeCache.get(v.id);
  if (c && system.currentTick - c.tick < 100) return c.active;
  let active = false;
  try {
    const dim = world.getDimension(v.dim);
    const players = dim.getPlayers({
      location: centerOf(v),
      maxDistance: ACTIVE_DIST
    });
    for (const _ of players) {
      active = true;
      break;
    }
  } catch {
    active = false;
  }
  activeCache.set(v.id, { tick: system.currentTick, active });
  if (activeCache.size > 32) {
    const first = activeCache.keys().next().value;
    activeCache.delete(first); // vilas evictadas não deixam rastro
  }
  return active;
}

export function initRegistry() {
  load();
  // DESCOBERTA: a cada 15 s, se um jogador está entre 3+ aldeões numa
  // área ainda sem vila, uma vila nasce ali (centroide dos aldeões).
  system.runInterval(() => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.villageAI) return;
    let players;
    try {
      players = world.getAllPlayers();
    } catch {
      return;
    }
    for (const p of players) {
      try {
        if (villageAt(p.dimension, p.location, false)) continue;
        const folks = p.dimension.getEntities({
          location: p.location,
          maxDistance: 48,
          families: ["villager"]
        });
        let n = 0, sx = 0, sz = 0;
        for (const f of folks) {
          n++;
          sx += f.location.x;
          sz += f.location.z;
          if (n >= 6) break;
        }
        if (n >= 3) {
          villageAt(
            p.dimension,
            { x: sx / n, y: p.location.y, z: sz / n },
            true
          );
          try {
            world.sendMessage(
              "§6[Crônica]§r Uma vila entrou para os registros do mundo."
            );
          } catch {
            /* ignorar */
          }
        }
      } catch {
        continue;
      }
    }
  }, 300);
  // Rodízio: a cada 10 ticks, UMA tarefa de UMA vila ativa.
  system.runInterval(() => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.villageAI) return;
    if (villages.length === 0 || tasks.length === 0) return;
    // Avança para a próxima vila ativa (no máximo 1 checagem por vila).
    for (let i = 0; i < villages.length; i++) {
      const v = villages[(vPtr + i) % villages.length];
      if (!isActive(v)) continue;
      vPtr = (vPtr + i + 1) % villages.length;
      const task = tasks[tPtr % tasks.length];
      tPtr++;
      try {
        task.fn(v, cfg);
      } catch (e) {
        if (cfg.debug) console.warn(`[NeuroMobs] vila/${task.name}: ${e}`);
      }
      return; // uma fatia = uma tarefa
    }
  }, 10);

  // Persistência preguiçosa (1×/30 s, só quando algo mudou).
  system.runInterval(() => {
    if (!dirty) return;
    dirty = false;
    try {
      world.setDynamicProperty(
        KEY,
        JSON.stringify({ list: villages, next: nextId })
      );
    } catch {
      dirty = true;
    }
  }, 600);
}
