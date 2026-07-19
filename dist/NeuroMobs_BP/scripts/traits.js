/**
 * traits.js — Personalidade individual e veteranos.
 *
 * PERSONALIDADE (personalities): no primeiro engajamento, cada monstro
 * sorteia um perfil — 25% cauteloso ("shy"), 50% normal, 25% audaz
 * ("bold") — persistido em dynamic property DA ENTIDADE (sobrevive a
 * reloads e à evicção do cérebro; consistente em multiplayer).
 * Efeitos: velocidade base ±, viés de papel no cerco (audaz vai direto,
 * cauteloso flanqueia) e limiar do modo furtivo do creeper.
 *
 * VETERANOS (veterans): ~5% dos monstros (2× na lua cheia) viram
 * "Veterano" ao engajar: nome dourado visível (telegrafado ao jogador),
 * Resistência I permanente, +8% de velocidade, resistência a knockback
 * (grupo JSON neuro:veteran) e grito de alerta com raio 1,5×.
 * Mobs já batizados pelo jogador não são renomeados.
 *
 * Custo: roda UMA vez por mob (no primeiro aggro); zero polling.
 */
import { fullMoon } from "./moods.js";
import { tryEffect, tryTrigger } from "./utils.js";

const VETERAN_CHANCE = 0.05;

/** Multiplicadores de velocidade por perfil. */
const SPEED = { shy: 0.95, normal: 1.0, bold: 1.12 };

/**
 * Garante que o cérebro tenha personalidade/veterania resolvidas.
 * Idempotente e barato; chamado pelo squad no engajamento.
 */
export function ensureTraits(brain, cfg) {
  if (brain.traitsDone) return;
  brain.traitsDone = true;

  const mob = brain.entity;
  try {
    if (!mob.matches({ families: ["monster"] })) return;
  } catch {
    return;
  }

  // ---------------------------------------------------------- personalidade
  let trait = "normal";
  let rolledTrait = false;
  if (cfg.personalities) {
    try {
      const saved = mob.getDynamicProperty("neuro:trait");
      if (typeof saved === "string") {
        trait = saved;
      } else {
        const r = Math.random();
        trait = r < 0.25 ? "shy" : r < 0.75 ? "normal" : "bold";
        mob.setDynamicProperty("neuro:trait", trait);
        rolledTrait = true;
      }
    } catch {
      /* entidade sem suporte: segue "normal" */
    }
  }
  brain.personality = trait;

  // -------------------------------------------------------------- veterania
  let vet = false;
  let rolledVet = false;
  try {
    vet = mob.getDynamicProperty("neuro:vet") === true;
  } catch {
    /* ignorar */
  }
  if (!vet && cfg.veterans) {
    const chance = VETERAN_CHANCE * (cfg.moonEvents && fullMoon() ? 2 : 1);
    if (Math.random() < chance) {
      vet = true;
      rolledVet = true;
      try {
        mob.setDynamicProperty("neuro:vet", true);
      } catch {
        /* ignorar */
      }
    }
  }
  brain.veteran = vet;

  // Aplicações one-shot (só quando o traço acabou de ser sorteado; efeitos,
  // nome e atributos persistem no save — reidratação não reaplica nada).
  if (rolledVet) {
    try {
      if (!mob.nameTag) mob.nameTag = "§6Veterano";
    } catch {
      /* ignorar */
    }
    tryEffect(mob, "resistance", 20000000, 0); // ~permanente
    tryTrigger(mob, "neuro:make_veteran"); // knockback_resistance via JSON
  }

  const factor = (SPEED[trait] ?? 1) * (rolledVet ? 1.08 : 1);
  if ((rolledTrait || rolledVet) && factor !== 1) {
    try {
      const mv = mob.getComponent("minecraft:movement");
      if (mv) mv.setCurrentValue(mv.currentValue * factor);
    } catch {
      /* atributo indisponível */
    }
  }
}
