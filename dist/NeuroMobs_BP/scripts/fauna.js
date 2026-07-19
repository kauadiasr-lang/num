/**
 * fauna.js — Cadeia alimentar v1: alcateias e carcaças.
 *
 * EXCITAÇÃO DE ALCATEIA (wolfPacks): quando um lobo ataca uma presa (ou é
 * atacado), os lobos num raio de 16 entram em surto de caça (Velocidade
 * breve). Combinado com a raiva de bando nativa da Bedrock e com o pânico
 * de rebanho das presas (v0.3), o resultado visível é a alcateia
 * arrancando JUNTA atrás do rebanho que debanda JUNTO.
 * Nota de engenharia: o override completo do lobo (flanquear, papéis) foi
 * avaliado e ADIADO — o arquivo vanilla carrega variantes por bioma,
 * armadura de lobo, sentar/domar e coleira tingível; reescrevê-lo de
 * memória arriscaria regressões visíveis (ver LIMITES §21).
 *
 * CHEIRO DE CARCAÇA (carrionScent): a morte violenta de um animal
 * terrestre deixa um "cheiro" — até 3 monstros espertos OCIOSOS num raio
 * de 24 investigam o local exato da morte (reutiliza o sistema de
 * waypoint/busca — zero duplicação). Caçar à noite passa a ter preço:
 * o abate atrai os mortos. Água dispersa o cheiro.
 *
 * Custo: 100% orientado a evento (entityHurt/entityDie) com throttle;
 * nada entra no escalonador por tick.
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "./config.js";
import { getBrain } from "./core.js";
import { recordHunt } from "./wildmind.js";
import { startSearch } from "./senses.js";
import * as V from "./utils.js";

let lastPackTick = 0;
let lastCarrionTick = 0;
let lastHuntTick = 0;

/** Surto de caça: lobos próximos aceleram juntos. */
function packSurge(wolf) {
  try {
    const pack = wolf.dimension.getEntities({
      location: wolf.location,
      maxDistance: 16,
      type: "minecraft:wolf"
    });
    let n = 0;
    for (const w of pack) {
      if (w.id === wolf.id) continue;
      if (n++ >= 5) break;
      V.tryEffect(w, "speed", 120, 0);
    }
  } catch {
    /* área indisponível */
  }
}

/** O abate atrai necrófagos ociosos ao ponto exato. */
function carrionScent(victim) {
  const loc = { ...victim.location };
  try {
    const scavengers = victim.dimension.getEntities({
      location: loc,
      maxDistance: 24,
      families: ["neuro_smart"]
    });
    let shared = null;
    let n = 0;
    for (const m of scavengers) {
      if (n >= 3) break;
      if (V.safeTarget(m)) continue; // ocupado não fareja
      const b = getBrain(m); // cria cérebro só para candidatos reais
      if (b.searching) continue;
      b.lastKnown = loc;
      b.lastSeenTick = system.currentTick;
      shared = startSearch(b, loc, shared);
      n++;
    }
  } catch {
    /* ignorar */
  }
}

export function initFauna() {
  // Lobo atacando ou apanhando => surto da alcateia.
  world.afterEvents.entityHurt.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.wolfPacks) return;
    const src = ev.damageSource && ev.damageSource.damagingEntity;
    const wolf =
      src && src.typeId === "minecraft:wolf"
        ? src
        : ev.hurtEntity && ev.hurtEntity.typeId === "minecraft:wolf"
          ? ev.hurtEntity
          : null;
    if (!wolf) return;
    if (system.currentTick - lastPackTick < 60) return;
    lastPackTick = system.currentTick;
    packSurge(wolf);
  });

  // Morte violenta de animal terrestre => cheiro de carcaça.
  world.afterEvents.entityDie.subscribe((ev) => {
    const cfg = getConfig();
    if (!cfg.enabled) return; // carrionScent é checado adiante — a pressão
    const victim = ev.deadEntity; // de caça registra mesmo com carcaça off
    if (!victim || victim.typeId === "minecraft:player") return;
    if (V.hasFamily(victim, "monster")) return;
    if (V.hasFamily(victim, "villager")) return;
    if (V.hasFamily(victim, "inanimate")) return;
    if (!V.hasFamily(victim, "mob")) return; // exige "mob" vivo e válido
    try {
      if (victim.isInWater) return; // água dispersa o cheiro
    } catch {
      return;
    }

    // PRESSÃO DE CAÇA: só abates POR JOGADOR contam (influência do
    // jogador, não da cadeia alimentar). Throttle leve de 1 s.
    const killer = ev.damageSource && ev.damageSource.damagingEntity;
    if (
      cfg.huntingPressure &&
      killer &&
      killer.typeId === "minecraft:player" &&
      system.currentTick - lastHuntTick >= 20
    ) {
      lastHuntTick = system.currentTick;
      recordHunt(victim.dimension, victim.location);
    }

    if (!cfg.carrionScent) return;
    if (system.currentTick - lastCarrionTick < 200) return; // 10 s
    lastCarrionTick = system.currentTick;
    carrionScent(victim);
  });
}
