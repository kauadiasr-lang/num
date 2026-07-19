/**
 * welcome.js — Boas-vindas e novidades (v1.2).
 *
 * PRIMEIRA ENTRADA: título "NeuroMobs AI" + subtítulo com a versão e um
 * guia rápido no chat (menu, crônica, modo dev). O jogador descobre o
 * addon — e como configurá-lo — sem abrir documentação externa.
 *
 * PÓS-ATUALIZAÇÃO: se o jogador já foi recebido por uma versão anterior,
 * recebe UMA linha discreta com o que mudou. Nada de popup bloqueante.
 *
 * O estado vive numa dynamic property DO JOGADOR ("neuro:hello" = versão
 * que o recebeu): por jogador, persistente e correto em multiplayer.
 * Custos: 1 evento (playerSpawn inicial) + 1 timeout curto. Zero ticks.
 */
import { world, system } from "@minecraft/server";
import { getConfig, VERSION } from "../core/config.js";

const PROP = "neuro:hello";

/** Uma linha por versão — o resumo pós-atualização mostra só a atual. */
const NEWS = {
  "1.2.1":
    "novidades: menu abre direto do chat, creeper demolidor corrigido, " +
    "sons/particulas taticas, aviso de cacada e cronica do mundo " +
    "(§e/scriptevent neuro:cronica§r).",
  "1.2.0":
    "novidades: sons e partículas nos momentos táticos, aviso de caçada, " +
    "crônica do mundo (§e/scriptevent neuro:cronica§r) e menu por categorias."
};

function greet(player, prevVersion) {
  try {
    if (!prevVersion) {
      // Primeira vez: título + guia rápido.
      try {
        player.onScreenDisplay.setTitle("§aNeuroMobs AI", {
          subtitle: `§7v${VERSION} — os mobs estão mais espertos`,
          fadeInDuration: 10,
          stayDuration: 70,
          fadeOutDuration: 20
        });
      } catch {
        /* sem HUD: o chat abaixo cobre */
      }
      player.sendMessage(
        "§a[NeuroMobs]§r ativo neste mundo! Os mobs agora gritam por " +
          "aliados, lembram de você, flanqueiam, emboscam e recuam.\n" +
          "§7• §e/scriptevent neuro:menu§r §7— configurações (por categoria)\n" +
          "§7• §e/scriptevent neuro:cronica§r §7— a história da IA neste mundo\n" +
          "§7• §e/scriptevent neuro:ajuda§r §7— todos os comandos"
      );
    } else if (prevVersion !== VERSION) {
      const news = NEWS[VERSION] || "ajustes internos e correções.";
      player.sendMessage(`§a[NeuroMobs]§r atualizado para §ev${VERSION}§r — ${news}`);
    }
    player.setDynamicProperty(PROP, VERSION);
  } catch {
    /* jogador saiu no meio: recebe na próxima entrada */
  }
}

export function initWelcome() {
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.welcomeMessages) return;
    const player = ev.player;
    let prev;
    try {
      const raw = player.getDynamicProperty(PROP);
      if (typeof raw === "string") prev = raw;
    } catch {
      /* segue como primeira vez */
    }
    if (prev === VERSION) return; // nada novo a dizer
    // Espera o HUD montar (entrar no mundo leva alguns ticks).
    system.runTimeout(() => greet(player, prev), 60);
  });
}
