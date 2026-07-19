/**
 * utils.js — Funções utilitárias do NeuroMobs.
 * Matemática de vetores e wrappers "seguros" (entidades podem descarregar
 * a qualquer momento, então toda chamada arriscada é envolvida em try/catch).
 */

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function len(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function norm(v) {
  const l = len(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function distSq(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/** Verifica se a entidade ainda existe e está carregada. */
export function alive(e) {
  try {
    return !!e && e.isValid;
  } catch {
    return false;
  }
}

/** Dispara um evento de entidade sem quebrar caso o mob não o defina. */
export function tryTrigger(e, eventId) {
  try {
    e.triggerEvent(eventId);
    return true;
  } catch {
    return false;
  }
}

/** Aplica um efeito de status ignorando falhas (entidade inválida etc.). */
export function tryEffect(e, effectId, durationTicks, amplifier) {
  try {
    e.addEffect(effectId, durationTicks, { amplifier, showParticles: false });
  } catch {
    /* silencioso */
  }
}

/** Leitura segura de entity.target (pode lançar se o alvo descarregou). */
export function safeTarget(e) {
  try {
    const t = e.target;
    return t && t.isValid ? t : undefined;
  } catch {
    return undefined;
  }
}
