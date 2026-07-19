/**
 * adaptive.js — Dificuldade adaptativa e priorização de alvo.
 *
 * adaptiveBuff(): ao engajar, o mob recebe reforços curtos proporcionais à
 * dificuldade do mundo e ao quão equipado o alvo está (jogador de armadura
 * completa enfrenta mobs mais rápidos/tenazes; iniciantes não são punidos).
 *
 * Priorização: a cada 10s, o jogador "mais vulnerável" (menos armadura +
 * menos vida) de cada dimensão recebe a tag "neuro_prio". Os overrides de
 * entidade listam esse filtro primeiro no nearest_attackable_target, então
 * grupos trocam de alvo para o elo mais fraco — comportamento clássico de
 * matilha.
 */
import { world, system, EquipmentSlot } from "@minecraft/server";
import { getConfig } from "../core/config.js";
import { tryEffect } from "../core/utils.js";

const TAG = "neuro_prio";
const ARMOR_SLOTS = [
  EquipmentSlot.Head,
  EquipmentSlot.Chest,
  EquipmentSlot.Legs,
  EquipmentSlot.Feet
];

function difficultyLevel() {
  try {
    const d = String(world.getDifficulty()).toLowerCase();
    if (d.includes("hard")) return 2;
    if (d.includes("normal")) return 1;
    return 0; // peaceful/easy
  } catch {
    return 1;
  }
}

function armorCount(player) {
  try {
    const eq = player.getComponent("minecraft:equippable");
    if (!eq) return 0;
    let n = 0;
    for (const slot of ARMOR_SLOTS) {
      if (eq.getEquipment(slot)) n++;
    }
    return n;
  } catch {
    return 0;
  }
}

function healthOf(entity) {
  try {
    const h = entity.getComponent("minecraft:health");
    return h ? h.currentValue : 20;
  } catch {
    return 20;
  }
}

/** Reforço curto no momento do engajamento (chamado pelo squad). */
export function adaptiveBuff(mob, targetPlayer, cfg) {
  if (!cfg.adaptive) return;
  const diff = difficultyLevel();
  if (diff === 0) return;

  const threat = armorCount(targetPlayer) + (healthOf(targetPlayer) > 14 ? 1 : 0);
  // threat: 0..5 — só reforça alvos bem preparados.
  if (threat >= 3) tryEffect(mob, "speed", 300, 0);
  if (threat >= 5 && diff === 2) tryEffect(mob, "resistance", 200, 0);
}

/** Loop lento (a cada 200 ticks) que mantém a tag de prioridade. */
export function initAdaptive() {
  system.runInterval(() => {
    const cfg = getConfig();
    const players = world.getAllPlayers();

    if (!cfg.enabled || !cfg.priorityTargeting || players.length < 2) {
      for (const p of players) {
        try {
          if (p.hasTag(TAG)) p.removeTag(TAG);
        } catch {
          /* ignorar */
        }
      }
      return;
    }

    // Menor pontuação = mais vulnerável = vira prioridade da matilha.
    const byDimension = new Map();
    for (const p of players) {
      const key = p.dimension.id;
      const score = armorCount(p) * 10 + healthOf(p);
      const cur = byDimension.get(key);
      if (!cur || score < cur.score) byDimension.set(key, { player: p, score });
    }
    const chosen = new Set([...byDimension.values()].map((v) => v.player.id));
    for (const p of players) {
      try {
        const has = p.hasTag(TAG);
        if (chosen.has(p.id) && !has) p.addTag(TAG);
        else if (!chosen.has(p.id) && has) p.removeTag(TAG);
      } catch {
        /* jogador saindo */
      }
    }
  }, 200);
}
