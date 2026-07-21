/**
 * main.js — Ponto de entrada do NeuroMobs AI.
 *
 * Ordem de inicialização:
 *  1. Carrega a configuração persistida.
 *  2. Registra os handlers por cérebro (memória -> esquadrão).
 *  3. Liga os subsistemas orientados a eventos (esquadrão, audição,
 *     adaptativo, UI).
 *  4. Inicia o escalonador com orçamento por tick.
 *  5. Higiene: remove cérebros de entidades mortas/descarregadas.
 */
import { world, system } from "@minecraft/server";
import { loadConfig, getConfig, VERSION } from "./core/config.js";
import { startScheduler, onBrainTick, getBrain, dropBrain } from "./core/core.js";
import { memoryTick, initHearing } from "./ai/senses.js";
import { initSquad, squadTick } from "./ai/squad.js";
import { initAdaptive } from "./ai/adaptive.js";
import { siegeTick } from "./ai/siege.js";
import { initDefense } from "./world/defense.js";
import { initMoods } from "./world/moods.js";
import { initWarmind } from "./world/warmind.js";
import { initFauna } from "./world/fauna.js";
import { ambushTick, retreatTick, initTactics } from "./ai/tactics.js";
import { initDevtools } from "./player/devtools.js";
import { initUI } from "./player/ui.js";
import { initFx } from "./player/fx.js";
import { initStats } from "./player/stats.js";
import { initWelcome } from "./player/welcome.js";
import { initRegistry, onVillageTask } from "./village/registry.js";
import { personaTask } from "./village/persona.js";
import { familyCensus, initMourning } from "./village/families.js";
import { housingTask } from "./village/housing.js";
import { economyTask } from "./village/economy.js";
import { jobsTask } from "./village/jobs.js";
import { honorTask, initHonor } from "./village/honor.js";
import { crimeTask, initCrime } from "./village/crime.js";
import { guardsTask } from "./village/guards.js";
import { socialTask } from "./village/social.js";
import { eventsTask, initEvents } from "./village/events.js";

system.run(() => {
  loadConfig();

  onBrainTick(memoryTick);
  onBrainTick(retreatTick); // antes do squad: retirada tem prioridade
  onBrainTick(squadTick);
  onBrainTick(siegeTick);
  onBrainTick(ambushTick);

  initSquad();
  initDefense();
  initMoods();
  initWarmind(); // memória de guerra regional (pavor × valor)
  initFauna();
  initTactics();
  initDevtools();
  initHearing(getBrain);
  initAdaptive();
  initUI();
  initFx();      // feedback audiovisual + indicador de caçada
  initStats();   // crônica do mundo (gravação preguiçosa)
  initWelcome(); // boas-vindas na 1ª entrada + novidades pós-update

  // Civilização das vilas (v1.3): registro + eventos + tarefas em rodízio.
  initRegistry();
  initMourning();
  initHonor();
  initCrime();
  initEvents();
  onVillageTask("persona", personaTask);
  onVillageTask("familias", familyCensus);
  onVillageTask("moradia", housingTask);
  onVillageTask("economia", economyTask);
  onVillageTask("trabalho", jobsTask);
  onVillageTask("honra", honorTask);
  onVillageTask("crime", crimeTask);
  onVillageTask("guarda", guardsTask);
  onVillageTask("social", socialTask);
  onVillageTask("eventos", eventsTask);

  startScheduler();

  // Limpeza de cérebros.
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      dropBrain(ev.deadEntity.id);
    } catch {
      /* ignorar */
    }
  });
  try {
    world.afterEvents.entityRemove.subscribe((ev) => {
      dropBrain(ev.removedEntityId);
    });
  } catch {
    /* evento indisponível: o escalonador já descarta cérebros inválidos */
  }

  if (getConfig().debug) {
    console.warn(`[NeuroMobs] núcleo de IA iniciado (v${VERSION})`);
  }
});
