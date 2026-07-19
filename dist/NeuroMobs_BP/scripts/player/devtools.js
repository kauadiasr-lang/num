/**
 * devtools.js — Kit de teste no jogo (v1.1).
 *
 * `/scriptevent neuro:ver` liga/desliga a VISÃO DE DESENVOLVEDOR para o
 * jogador que digitou (tag por jogador — em multiplayer, cada um decide).
 * Com a visão ligada:
 *  1. Todo waypoint de busca ativo vira uma coluna de partículas — dá
 *     para VER para onde cada mob está indo investigar.
 *  2. Olhar para um mob mostra o cérebro dele no HUD: tipo,
 *     personalidade, papel, e os estados ativos (VET, buscando,
 *     emboscada, retirada, cerco, congelado). Sem mob na mira, mostra o
 *     resumo global (cérebros ativos + pico de ms).
 *
 * Custo: o intervalo (10 ticks) retorna imediatamente se NENHUM jogador
 * tem a tag — em produção o módulo é inerte.
 */
import { world, system } from "@minecraft/server";
import { getConfig } from "../core/config.js";
import { allBrains, peekBrain, perf } from "../core/core.js";

const TAG = "neuro_dev";
const PERSONA = { shy: "cauteloso", normal: "normal", bold: "audaz" };

export function initDevtools() {
  // Toggle por jogador.
  system.afterEvents.scriptEventReceive.subscribe(
    (ev) => {
      if (ev.id !== "neuro:ver") return;
      const p = ev.sourceEntity;
      if (!p || p.typeId !== "minecraft:player") return;
      try {
        if (p.hasTag(TAG)) {
          p.removeTag(TAG);
          p.sendMessage("§a[NeuroMobs]§r visão de desenvolvedor: §4desligada§r.");
        } else {
          p.addTag(TAG);
          p.sendMessage(
            "§a[NeuroMobs]§r visão de desenvolvedor: §2ligada§r. Olhe para um mob para inspecionar o cérebro; waypoints de busca ficam visíveis."
          );
        }
      } catch {
        /* ignorar */
      }
    },
    { namespaces: ["neuro"] }
  );

  system.runInterval(() => {
    const cfg = getConfig();
    if (!cfg.enabled) return;

    let devs = [];
    try {
      devs = world.getAllPlayers().filter((p) => {
        try {
          return p.hasTag(TAG);
        } catch {
          return false;
        }
      });
    } catch {
      return;
    }
    if (devs.length === 0) return; // inerte sem desenvolvedores

    // 1) Waypoints visíveis.
    for (const [, b] of allBrains()) {
      if (!b.searching || !b.waypointId) continue;
      try {
        const wp = world.getEntity(b.waypointId);
        if (!wp || !wp.isValid) continue;
        for (let i = 0; i < 3; i++) {
          wp.dimension.spawnParticle("minecraft:endrod", {
            x: wp.location.x,
            y: wp.location.y + i * 0.8,
            z: wp.location.z
          });
        }
      } catch {
        /* partícula/entidade indisponível: segue sem o visual */
      }
    }

    // 2) Inspetor de cérebro no HUD.
    for (const p of devs) {
      let line = `cérebros:${allBrains().size} · pico:${perf.peakMs}ms`;
      try {
        const hits = p.getEntitiesFromViewDirection({ maxDistance: 24 });
        const ent = hits && hits[0] && hits[0].entity;
        if (ent) {
          const b = peekBrain(ent.id);
          if (b) {
            const flags = [
              b.veteran ? "VET" : null,
              b.searching ? "buscando" : null,
              b.ambushing ? "emboscada" : null,
              b.retreating ? "retirada" : null,
              b.sieging ? "cerco" : null,
              b.frozen ? "congelado" : null
            ]
              .filter(Boolean)
              .join(" ");
            line =
              `${b.type.replace("minecraft:", "")} · ` +
              `${PERSONA[b.personality] || b.personality} · papel:${b.role}` +
              (b.targetId ? " · alvo:sim" : "") +
              (flags ? ` · ${flags}` : "");
          } else {
            line = `${ent.typeId.replace("minecraft:", "")} · sem cérebro (ocioso)`;
          }
          // Diagnóstico: o mob na mira carrega as famílias do NeuroMobs?
          // Monstro sem elas = override NÃO carregou (outro pack por
          // cima, ou versão do jogo abaixo do mínimo).
          try {
            const hasNeuro =
              ent.matches({ families: ["neuro_smart"] }) ||
              ent.matches({ families: ["neuro_defender"] });
            if (hasNeuro) line += " §2· override:OK§r";
            else if (
              ent.matches({ families: ["monster"] }) ||
              ent.matches({ families: ["irongolem"] })
            ) {
              line += " §c· override:AUSENTE§r";
            }
          } catch {
            /* ignorar */
          }
        }
      } catch {
        /* ignorar */
      }
      try {
        p.onScreenDisplay.setActionBar(`§7[dev]§r ${line}`);
      } catch {
        /* sem HUD */
      }
    }
  }, 10);
}
