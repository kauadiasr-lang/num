/**
 * config.js — Configuração do NeuroMobs.
 * Persistida em uma dynamic property do mundo ("neuro:cfg"), com merge sobre
 * os padrões para que novas opções de versões futuras ganhem valor default.
 */
import { world } from "@minecraft/server";

/** Versão única do addon — main/ui/welcome leem daqui (zero deriva). */
export const VERSION = "1.4.0";

export const DEFAULTS = {
  enabled: true,          // liga/desliga todo o núcleo de script
  packAlert: true,        // mobs alertam aliados próximos ao ver um jogador
  alertRadius: 24,        // raio (blocos) do alerta em grupo
  memorySearch: true,     // memória da última posição vista + busca ativa
  hearing: true,          // mobs "ouvem" quebra/colocação de blocos
  hearingRadius: 20,      // raio (blocos) da audição
  tactics: true,          // papéis de combate (flanquear vs. atacar direto)
  flankMinPack: 3,        // nº mínimo de mobs no mesmo alvo p/ ativar flanco
  creeperStalk: true,     // creeper congela quando o jogador olha para ele
  antiTower: true,        // resposta a pilares: corpo a corpo cerca a distância
  creeperBreach: true,    // creeper detona a base do pilar (respeita mobGriefing)
  villageDefense: true,   // alarme de vila: golems direcionados, aldeões dispersam
  herdPanic: true,        // ferir um animal assusta a mesma espécie por perto
  personalities: true,    // perfis individuais: cauteloso / normal / audaz
  veterans: true,         // ~5% viram "Veterano" (nome, resistência, grito 1,5x)
  moonEvents: true,       // lua cheia: alerta x1,25 e veteranos x2
  weatherMoods: true,     // chuva abafa audição; trovoada/raios agitam
  blastDeafen: true,      // explosões deixam monstros surdos por 5 s
  beeSwarm: true,         // ferir uma abelha enfurece a colmeia
  wolfPacks: true,        // lobos entram em surto de caça juntos
  carrionScent: true,     // abates atraem monstros necrófagos ao local
  babyGuard: true,        // ferir um filhote intensifica a reação do rebanho
  tacticalBell: true,     // badalar o sino mobiliza aldeões e golems
  ambush: true,           // solitários seguram o bote até aliados chegarem
  retreat: true,          // feridos sem apoio recuam e buscam reforços
  leadership: true,       // aura do veterano + quebra de moral ao matá-lo
  villageMemory: true,    // regiões atacadas respondem mais forte (persiste)
  villageAmbience: true,  // sons de conversa entre aldeões próximos
  huntingPressure: true,  // caça excessiva deixa a fauna da região arisca
  adaptive: true,         // reforços conforme dificuldade/equipamento do alvo
  priorityTargeting: true,// grupos priorizam o jogador mais vulnerável
  combatLearning: true,   // regiões lembram massacres/vitórias (pavor × valor)
  // ------------------------------------------------ civilização (v1.3)
  villageAI: true,        // liga a camada inteira de civilização das vilas
  villagerNames: true,    // aldeões ganham nome + sobrenome de família visíveis
  villageFamilies: true,  // famílias: parentesco, luto, herança de casas
  villageEconomy: true,   // celeiro (baús reais), coleta, partilha, escassez
  villageJobs: true,      // profissões trabalham de verdade (colheita, reparos…)
  villageHonor: true,     // honra por jogador e por vila, com consequências
  villageCrime: true,     // testemunhas, boatos, guardas chamados, lockdown
  villageGuards: true,    // guardas dedicados: turnos, patrulha, recrutamento
  villageEvents: true,    // eventos: festival, casamento, nascimento, funeral…
  villageSocial: true,    // conversas com olhar, crianças brincando, presentes
  banditRaids: false,     // ataques de bandidos raros (2-3 pillagers) — opt-in
  feedbackFx: true,       // sons/partículas nos momentos táticos (grito, bote…)
  huntedIndicator: true,  // aviso no HUD quando 3+ mobs caçam você
  welcomeMessages: true,  // boas-vindas na 1ª entrada + resumo pós-atualização
  milestones: true,       // marcos da crônica do mundo (anunciados no chat)
  budgetPerTick: 6,       // nº de "cérebros" processados por tick (desempenho)
  maxTracked: 48,         // teto de cérebros simultâneos em memória
  debug: false            // logs e mensagens de diagnóstico
};

const KEY = "neuro:cfg";
let cfg = { ...DEFAULTS };
let loaded = false;

export function loadConfig() {
  if (loaded) return cfg;
  try {
    const raw = world.getDynamicProperty(KEY);
    if (typeof raw === "string") {
      cfg = { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {
    cfg = { ...DEFAULTS };
  }
  loaded = true;
  return cfg;
}

export function getConfig() {
  return loaded ? cfg : loadConfig();
}

export function setConfig(patch) {
  cfg = { ...getConfig(), ...patch };
  try {
    world.setDynamicProperty(KEY, JSON.stringify(cfg));
  } catch {
    /* mundo ainda não pronto: mantém apenas em memória */
  }
  return cfg;
}

export function resetConfig() {
  cfg = { ...DEFAULTS };
  try {
    world.setDynamicProperty(KEY, undefined);
  } catch {
    /* ignorar */
  }
  return cfg;
}
