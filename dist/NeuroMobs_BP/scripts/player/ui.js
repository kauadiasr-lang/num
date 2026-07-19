/**
 * ui.js — Configuração e comandos no jogo (v1.2).
 *
 * Comandos (digite no chat com barra):
 *   /scriptevent neuro:menu    -> menu de configurações POR CATEGORIA
 *   /scriptevent neuro:cronica -> crônica do mundo (estatísticas da IA)
 *   /scriptevent neuro:ajuda   -> lista de comandos (alias: neuro:help)
 *   /scriptevent neuro:stats   -> desempenho do núcleo (cérebros, ms)
 *   /scriptevent neuro:on|off  -> liga/desliga o núcleo
 *   /scriptevent neuro:reset   -> restaura as configurações padrão
 *
 * O menu antigo era UMA lista com ~30 botões — impossível de escanear.
 * Agora: 6 categorias temáticas com descrição, estado colorido por
 * botão e "Voltar". Usa ActionFormData (botões) para máxima
 * compatibilidade entre versões estáveis do @minecraft/server-ui.
 */
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getConfig, setConfig, resetConfig, VERSION } from "../core/config.js";
import { perf, allBrains } from "../core/core.js";
import { chronicleText } from "./stats.js";

const LABELS = {
  enabled: "Núcleo de IA",
  packAlert: "Alerta em grupo",
  memorySearch: "Memória e busca ativa",
  hearing: "Audição (investigar sons)",
  tactics: "Táticas de cerco (flanquear)",
  creeperStalk: "Creeper furtivo",
  antiTower: "Anti-torre (modo cerco)",
  creeperBreach: "Creeper demolidor de pilar",
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
  adaptive: "Dificuldade adaptativa",
  priorityTargeting: "Priorizar alvo vulnerável",
  feedbackFx: "Sons e partículas táticas",
  huntedIndicator: "Aviso de caçada no HUD",
  welcomeMessages: "Boas-vindas e novidades",
  milestones: "Marcos da crônica",
  debug: "Modo debug"
};

/** Ajustes numéricos cíclicos: chave -> passos. */
const STEPPERS = {
  alertRadius: { label: "Raio de alerta", steps: [12, 24, 36], unit: "blocos" },
  budgetPerTick: { label: "Orçamento por tick", steps: [4, 6, 10], unit: "cérebros" }
};

const CATEGORIES = [
  {
    title: "§4Combate e tática",
    desc: "Como os monstros lutam: gritos, cerco, emboscada e retirada.",
    keys: [
      "packAlert", "tactics", "ambush", "retreat", "leadership",
      "antiTower", "creeperBreach", "creeperStalk",
      "adaptive", "priorityTargeting"
    ],
    steppers: ["alertRadius"]
  },
  {
    title: "§3Percepção e memória",
    desc: "O que os mobs veem, ouvem e lembram de você.",
    keys: ["memorySearch", "hearing", "blastDeafen"],
    steppers: []
  },
  {
    title: "§2Mundo vivo",
    desc: "Fauna, clima, lua e os perfis individuais de cada mob.",
    keys: [
      "herdPanic", "babyGuard", "wolfPacks", "carrionScent", "beeSwarm",
      "huntingPressure", "personalities", "veterans", "moonEvents",
      "weatherMoods"
    ],
    steppers: []
  },
  {
    title: "§6Vila",
    desc: "Alarme com golems, sino tático, trauma regional e ambiência.",
    keys: ["villageDefense", "tacticalBell", "villageMemory", "villageAmbience"],
    steppers: []
  },
  {
    title: "§dFeedback e interface",
    desc: "Sons, partículas, avisos no HUD, boas-vindas e marcos.",
    keys: ["feedbackFx", "huntedIndicator", "welcomeMessages", "milestones"],
    steppers: []
  },
  {
    title: "§8Sistema",
    desc: "Núcleo, orçamento de desempenho e diagnóstico.",
    keys: ["enabled", "debug"],
    steppers: ["budgetPerTick"]
  }
];

const HELP_TEXT =
  `§a[NeuroMobs]§r v${VERSION} — comandos (§7/scriptevent …§r):\n` +
  "§e neuro:menu§r    — configurações por categoria\n" +
  "§e neuro:cronica§r — crônica do mundo (a história da IA)\n" +
  "§e neuro:stats§r   — desempenho do núcleo\n" +
  "§e neuro:ver§r     — visão de desenvolvedor (waypoints + cérebros)\n" +
  "§e neuro:on / neuro:off§r — liga/desliga o núcleo\n" +
  "§e neuro:reset§r   — restaura os padrões";

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
        case "neuro:cronica":
          if (player) player.sendMessage(chronicleText());
          break;
        case "neuro:ajuda":
        case "neuro:help":
          if (player) player.sendMessage(HELP_TEXT);
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

/**
 * O comando vem do CHAT — quando o form tenta abrir, a tela de chat
 * ainda está na frente e o show() volta na hora com "UserBusy" (o menu
 * parecia simplesmente não funcionar). Espera educada: re-tenta a cada
 * meio segundo até o jogador fechar o chat (teto de 10 s).
 */
async function showWhenReady(form, player) {
  for (let i = 0; i < 20; i++) {
    const res = await form.show(player);
    if (String(res.cancelationReason) !== "UserBusy") return res;
    await new Promise((resolve) => system.runTimeout(resolve, 10));
  }
  return undefined;
}

/** Quantos toggles da categoria estão ativos (resumo no botão). */
function activeCount(cat, cfg) {
  let on = 0;
  for (const k of cat.keys) if (cfg[k]) on++;
  return `${on}/${cat.keys.length}`;
}

async function openMenu(player) {
  const cfg = getConfig();
  const form = new ActionFormData()
    .title(`NeuroMobs v${VERSION} — Configurações`)
    .body(
      `Núcleo: ${stateOf(cfg.enabled)} §7|§r Cérebros ativos: §e${allBrains().size}§r\n` +
        "Escolha uma categoria:"
    );

  for (const cat of CATEGORIES) {
    form.button(`${cat.title}§r\n§7${activeCount(cat, cfg)} opções ativas`);
  }
  form.button("§6Crônica do mundo§r\n§7a história da IA nesta seed");
  form.button("§cRestaurar padrões");
  form.button("§8Fechar");

  let res;
  try {
    res = await showWhenReady(form, player);
  } catch {
    return;
  }
  if (!res || res.canceled || res.selection === undefined) return;

  const s = res.selection;
  if (s < CATEGORIES.length) {
    openCategory(player, s);
  } else if (s === CATEGORIES.length) {
    player.sendMessage(chronicleText());
  } else if (s === CATEGORIES.length + 1) {
    resetConfig();
    player.sendMessage("§a[NeuroMobs]§r configurações restauradas.");
    openMenu(player);
  }
  // Fechar: sai em silêncio.
}

async function openCategory(player, idx) {
  const cat = CATEGORIES[idx];
  const cfg = getConfig();
  const form = new ActionFormData()
    .title(`NeuroMobs — ${cat.title.replace(/§./g, "")}`)
    .body(`§7${cat.desc}§r\nToque numa opção para alterná-la.`);

  for (const key of cat.keys) {
    form.button(`${LABELS[key]}\n${stateOf(cfg[key])}`);
  }
  for (const sk of cat.steppers) {
    const st = STEPPERS[sk];
    form.button(`${st.label}\n§e${cfg[sk]}§r ${st.unit} (alternar)`);
  }
  form.button("§8« Voltar");

  let res;
  try {
    res = await showWhenReady(form, player);
  } catch {
    return;
  }
  if (!res || res.canceled || res.selection === undefined) return;

  const s = res.selection;
  if (s < cat.keys.length) {
    const key = cat.keys[s];
    setConfig({ [key]: !cfg[key] });
    openCategory(player, idx); // permanece na categoria: vários ajustes seguidos
  } else if (s < cat.keys.length + cat.steppers.length) {
    const sk = cat.steppers[s - cat.keys.length];
    const steps = STEPPERS[sk].steps;
    const i = steps.indexOf(cfg[sk]);
    setConfig({ [sk]: steps[(i + 1) % steps.length] });
    openCategory(player, idx);
  } else {
    openMenu(player); // Voltar
  }
}
