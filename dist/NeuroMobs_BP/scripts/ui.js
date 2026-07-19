/**
 * ui.js — Configuração no jogo.
 *
 * Comandos (digite no chat com barra):
 *   /scriptevent neuro:menu   -> abre o menu de configurações
 *   /scriptevent neuro:stats  -> estatísticas de desempenho do núcleo
 *   /scriptevent neuro:on     -> liga o núcleo
 *   /scriptevent neuro:off    -> desliga o núcleo
 *   /scriptevent neuro:reset  -> restaura as configurações padrão
 *
 * Usa ActionFormData (botões) em vez de formulários com toggles para máxima
 * compatibilidade entre versões estáveis do @minecraft/server-ui.
 */
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getConfig, setConfig, resetConfig } from "./config.js";
import { perf, allBrains } from "./core.js";

const LABELS = {
  enabled: "Núcleo de IA",
  packAlert: "Alerta em grupo",
  memorySearch: "Memória e busca ativa",
  hearing: "Audição (investigar sons)",
  tactics: "Táticas de cerco (flanquear)",
  creeperStalk: "Creeper furtivo",
  antiTower: "Anti-torre (modo cerco)",
  villageDefense: "Defesa de vila (golems)",
  herdPanic: "Pânico de rebanho",
  personalities: "Personalidades individuais",
  veterans: "Mobs veteranos",
  moonEvents: "Efeitos da lua cheia",
  weatherMoods: "Clima influencia a IA",
  blastDeafen: "Explosões ensurdecem",
  beeSwarm: "Defesa do enxame (abelhas)",
  wolfPacks: "Alcateias de lobos",
  carrionScent: "Cheiro de carcaça",
  babyGuard: "Proteção de filhotes",
  tacticalBell: "Sino tático (alarme geral)",
  ambush: "Emboscadas coordenadas",
  retreat: "Retirada tática",
  leadership: "Liderança de veteranos",
  villageMemory: "Memória da vila (trauma)",
  villageAmbience: "Vida social dos aldeões",
  huntingPressure: "Pressão de caça (fauna arisca)",
  creeperBreach: "Creeper demolidor de pilar",
  adaptive: "Dificuldade adaptativa",
  priorityTargeting: "Priorizar alvo vulnerável",
  debug: "Modo debug"
};
const TOGGLE_KEYS = Object.keys(LABELS);
const RADIUS_STEPS = [12, 24, 36];
const BUDGET_STEPS = [4, 6, 10];

export function initUI() {
  system.afterEvents.scriptEventReceive.subscribe(
    (ev) => {
      const player =
        ev.sourceEntity && ev.sourceEntity.typeId === "minecraft:player"
          ? ev.sourceEntity
          : undefined;

      switch (ev.id) {
        case "neuro:menu":
          if (player) openMenu(player);
          break;
        case "neuro:stats":
          if (player) {
            player.sendMessage(
              `§a[NeuroMobs]§r cérebros ativos: ${allBrains().size} | último tick: ${perf.lastMs} ms | pico: ${perf.peakMs} ms`
            );
          }
          break;
        case "neuro:on":
          setConfig({ enabled: true });
          if (player) player.sendMessage("§a[NeuroMobs]§r núcleo LIGADO.");
          break;
        case "neuro:off":
          setConfig({ enabled: false });
          if (player) player.sendMessage("§a[NeuroMobs]§r núcleo DESLIGADO.");
          break;
        case "neuro:reset":
          resetConfig();
          if (player) player.sendMessage("§a[NeuroMobs]§r configurações restauradas.");
          break;
      }
    },
    { namespaces: ["neuro"] }
  );
}

function stateOf(v) {
  return v ? "§2ATIVADO§r" : "§4desativado§r";
}

async function openMenu(player) {
  const cfg = getConfig();
  const form = new ActionFormData()
    .title("NeuroMobs — Configurações")
    .body(
      "Toque em uma opção para alterná-la.\n" +
        `Raio de alerta: §e${cfg.alertRadius}§r blocos | Orçamento: §e${cfg.budgetPerTick}§r cérebros/tick`
    );

  for (const key of TOGGLE_KEYS) {
    form.button(`${LABELS[key]}: ${stateOf(cfg[key])}`);
  }
  form.button(`Raio de alerta: ${cfg.alertRadius} (alternar)`);
  form.button(`Orçamento por tick: ${cfg.budgetPerTick} (alternar)`);
  form.button("§8Fechar");

  let res;
  try {
    res = await form.show(player);
  } catch {
    return;
  }
  if (!res || res.canceled || res.selection === undefined) return;

  const s = res.selection;
  if (s < TOGGLE_KEYS.length) {
    const key = TOGGLE_KEYS[s];
    setConfig({ [key]: !cfg[key] });
  } else if (s === TOGGLE_KEYS.length) {
    const i = RADIUS_STEPS.indexOf(cfg.alertRadius);
    setConfig({ alertRadius: RADIUS_STEPS[(i + 1) % RADIUS_STEPS.length] });
  } else if (s === TOGGLE_KEYS.length + 1) {
    const i = BUDGET_STEPS.indexOf(cfg.budgetPerTick);
    setConfig({ budgetPerTick: BUDGET_STEPS[(i + 1) % BUDGET_STEPS.length] });
  } else {
    return; // Fechar
  }
  openMenu(player); // reabre para permitir vários ajustes seguidos
}
