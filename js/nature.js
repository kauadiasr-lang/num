/**
 * Linhagem SECUNDÁRIA da Natureza — item pedido na auditoria de "mundo
 * vivo" (Floresta Ancestral, descoberta ao derrotar o monstro das sombras
 * que a corrompe durante uma viagem pela Estrada, ver roads.js/ui.js).
 *
 * Diferente das linhagens PRINCIPAIS (Vampirismo, Luz, Sombras, Titã — ver
 * lineages.js, sempre únicas e mutuamente exclusivas via `player.lineage`),
 * Natureza NUNCA ocupa esse campo: vive inteiramente em
 * `player.secondaryLineage` + um item real de equipamento, o Amuleto do
 * Guardião (slot AMULET). O amuleto É a linhagem em forma de item:
 * - Equipado: os poderes da árvore estão ATIVOS (ver skilltrees.js
 *   sumSecondaryPassiveStats/player.js calculateDerivedStats).
 * - Removido pra mochila: os poderes desligam, mas TODO o progresso salvo
 *   (skillTreeUnlocked, natureSkillPoints) continua intacto — reequipar
 *   (ou obter outro Amuleto do Guardião) reativa tudo de novo.
 * - Pode ser vendido por um preço extremamente alto (ver `value` abaixo) —
 *   uma decisão real do jogador, não uma perda permanente da linhagem em
 *   si (o progresso continua existindo, só fica "desligado" até haver um
 *   amuleto equipado de novo).
 *
 * Pode coexistir com QUALQUER linhagem principal (inclusive nenhuma) — as
 * duas árvores nunca competem pelo mesmo pool de pontos nem pelo mesmo
 * slot de personagem.
 *
 * PONTO DE EXTENSÃO (item ainda pendente, deliberadamente fora do escopo
 * desta iteração — ver relatório): o "segredo da corrupção" (8 pontos de
 * Natureza acumulados sem gastar nenhum libera uma entidade profana que
 * oferece corromper o Amuleto, destruindo-o e desbloqueando a Linhagem das
 * Sombras como PRINCIPAL) tem sua checagem de dados pronta abaixo
 * (isCorruptionEventReady), mas o EVENTO em si (diálogo da entidade
 * profana, a escolha, o Amuleto Profano fundido ao corpo, e a própria
 * implementação completa da Linhagem das Sombras — árvore + ritual + boss,
 * hoje só um stub `locked:true` em lineages.js) fica para uma iteração
 * futura dedicada: é conteúdo grande o bastante pra merecer sua própria
 * auditoria e ciclo de testes completo, sem arriscar entregar algo
 * meio-pronto only pra "bater todos os itens" de uma vez.
 */

const NATURE_LINEAGE = {
    id: 'natureza',
    name: 'Natureza',
    tagline: 'A floresta lembra de quem a protege.',
    specialty: ['Cura', 'Regeneração', 'Purificação', 'Resistências', 'Espíritos'],
    skillTreeId: 'natureza'
};
window.NATURE_LINEAGE = NATURE_LINEAGE;

window.NatureSystem = {
    get() {
        return NATURE_LINEAGE;
    },

    // true só antes de o jogador já ter a Linhagem secundária — o encontro
    // na Floresta Ancestral (ver roads.js) nunca se repete depois disso,
    // corrompida ou não (uma vez resolvido o arco de Natureza, o jogador
    // não "descobre" ele de novo).
    isDiscoveryAvailable(player) {
        return !player.secondaryLineage;
    },

    // Concede o Amuleto do Guardião + inicia a Linhagem secundária —
    // chamado ao derrotar o monstro das sombras que corrompe a Floresta
    // Ancestral (ver ui.js _resolveNatureDiscoveryVictory). Idempotente:
    // nunca concede duas vezes (retorna null se já tiver a linhagem).
    grantGuardianAmulet(player) {
        if (player.secondaryLineage) return null;
        player.secondaryLineage = NATURE_LINEAGE.id;
        player.secondaryLineageAwakenedAt = Date.now();
        // Pontos iniciais de talento da árvore — mesmo ponto de partida já
        // usado pelas linhagens principais em lineages.js awaken().
        player.natureSkillPoints = (player.natureSkillPoints || 0) + 3;

        const amulet = this._createAmulet();
        // Item único e crítico pra narrativa: sempre entra na mochila,
        // mesmo cheia (nunca "perde" a linhagem recém-descoberta por falta
        // de espaço) — o jogador decide depois quando equipar.
        player.inventory.push(amulet);
        return amulet;
    },

    _createAmulet() {
        return {
            category: 'equipment', uuid: Utils.generateUUID(), id: 'amuleto_guardiao',
            name: 'Amuleto do Guardião', slot: SLOTS.AMULET, rarity: RARITY.LEGENDARY,
            damage: 0, defense: 0, weight: 0.5,
            value: 2000, // "preço extremamente alto" pedido — vender desliga a Linhagem até haver outro amuleto equipado
            durability: 999, maxDurability: 999, statBonuses: {},
            critBonus: 0, accBonus: 0, blockChance: 0, armorPierce: 0, hpBonus: 0, mpBonus: 0,
            minRange: 0, maxRange: 1, atkSpeed: 1, approachSpeed: 2, retreatSpeed: 2,
            maxAmmo: null, ammo: null, enchantmentId: null, region: null,
            isNatureAmulet: true
        };
    },

    // true enquanto o Amuleto do Guardião estiver DE FATO equipado — é
    // isso que ativa os poderes da árvore (ver skilltrees.js
    // sumSecondaryPassiveStats/player.js calculateDerivedStats).
    isActive(player) {
        const amulet = player.equipment && player.equipment[SLOTS.AMULET];
        return !!(player.secondaryLineage && amulet && amulet.isNatureAmulet);
    },

    // Segredo pedido: 8 pontos de Natureza acumulados SEM gastar nenhum
    // libera o evento de corrupção (ver comentário do arquivo acima sobre
    // o porquê do evento em si ficar para uma iteração futura).
    isCorruptionEventReady(player) {
        if (!player.secondaryLineage) return false;
        const spent = Object.keys(player.skillTreeUnlocked || {}).filter(id => id.startsWith('nat_')).length;
        return (player.natureSkillPoints || 0) >= 8 && spent === 0;
    }
};
