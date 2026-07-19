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
import { loadConfig, getConfig, VERSION } from "./config.js";
import { startScheduler, onBrainTick, getBrain, dropBrain } from "./core.js";
import { memoryTick, initHearing } from "./senses.js";
import { initSquad, squadTick } from "./squad.js";
import { initAdaptive } from "./adaptive.js";
import { siegeTick } from "./siege.js";
import { initDefense } from "./defense.js";
import { initMoods } from "./moods.js";
import { initFauna } from "./fauna.js";
import { ambushTick, retreatTick, initTactics } from "./tactics.js";
import { initDevtools } from "./devtools.js";
import { initUI } from "./ui.js";
import { initFx } from "./fx.js";
import { initStats } from "./stats.js";
import { initWelcome } from "./welcome.js";

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
  initFauna();
  initTactics();
  initDevtools();
  initHearing(getBrain);
  initAdaptive();
  initUI();
  initFx();      // feedback audiovisual + indicador de caçada
  initStats();   // crônica do mundo (gravação preguiçosa)
  initWelcome(); // boas-vindas na 1ª entrada + novidades pós-update
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
