/**
 * Corrupção → Linhagem das Sombras (segredo pedido na auditoria de mundo
 * vivo) — ver nature.js NatureSystem.isCorruptionEventReady: acumular 8
 * pontos de Natureza SEM gastar nenhum libera um evento raro na Floresta
 * Ancestral (ver roads.js _rollEvent, ui.js showCorruptionChoice): uma
 * entidade profana aparece oferecendo corromper o Amuleto do Guardião.
 *
 * - Aceitar (accept): o MESMO objeto do Amuleto do Guardião muda de
 *   identidade pra Amuleto Profano (nunca cria um item novo, nunca mexe no
 *   slot — assim toda referência já existente continua válida). O amuleto
 *   nunca mais pode ser removido/vendido (ver `removable:false`, checado
 *   em ui.js renderEquipment), e os poderes da Natureza desligam pra
 *   sempre (isNatureAmulet:false — mesmo sem poder remover o amuleto, ele
 *   nunca mais reativa). Em troca, desperta Sombras como Linhagem
 *   PRINCIPAL (mesmas regras de qualquer outra: reaproveita
 *   LineageSystem.awaken, nunca duplica a lógica de despertar aqui).
 * - Recusar: nada muda, a oferta pode reaparecer numa visita futura
 *   enquanto a condição (8 pontos sem gastar) continuar valendo.
 * - BLOQUEADO: se o jogador já tiver uma Linhagem PRINCIPAL, a entidade
 *   reconhece o poder já ligado a ele — a corrupção NUNCA sobrescreve uma
 *   linhagem já escolhida (ver canAccept), a oferta real nunca chega a
 *   acontecer nesse caso (só o texto narrativo de recusa automática).
 */

window.CorruptionSystem = {
    isEventReady(player) {
        return !!(window.NatureSystem && window.NatureSystem.isCorruptionEventReady(player));
    },

    // true só quando o jogador PODE aceitar de verdade — usado por ui.js
    // showCorruptionChoice pra decidir entre mostrar os botões de escolha
    // ou só o texto de bloqueio narrativo (nunca os dois ao mesmo tempo).
    canAccept(player) {
        return this.isEventReady(player) && !player.lineage;
    },

    // Executa a corrupção — NUNCA chamado sem canAccept ter confirmado
    // antes (ver ui.js), mas checa de novo aqui mesmo assim, idempotente e
    // seguro por padrão como todo o resto do registry (ex:
    // NatureSystem.grantGuardianAmulet).
    accept(player) {
        if (!this.canAccept(player)) return false;
        const amulet = player.equipment && player.equipment[SLOTS.AMULET];
        if (!amulet || !amulet.isNatureAmulet) return false;

        amulet.id = 'amuleto_profano';
        amulet.name = 'Amuleto Profano';
        amulet.isNatureAmulet = false; // os poderes de Natureza nunca mais reativam
        amulet.isProfaneAmulet = true;
        amulet.removable = false; // ver ui.js renderEquipment: bloqueia o clique de desequipar
        amulet.value = 0; // nunca vendável (documenta a intenção; nem chegaria à mochila pra vender)
        amulet.rarity = RARITY.LEGENDARY;

        return !!window.LineageSystem.awaken(player, 'sombras');
    }
};
