/**
 * Sistema de Runas — Santuário Élfico de Sylvaneth (ver citydatabase.js
 * santuario_elfico/js/items.js ItemDatabase.runes/js/elfcrafting.js
 * ElfCraftingSystem.RUNE_RECIPES).
 *
 * MEGA REWORK Econômico, Iteração 9 (item 7 da diretiva): runas élficas
 * como "objetos de criação/personalização", DISTINTAS de Encantamentos
 * (js/enchantments.js) — não uma segunda versão do mesmo sistema (item
 * 11). Diferença mecânica real: um Encantamento é um efeito de PROC
 * (onHit/onDefend) livremente TROCÁVEL por ouro, sem limite de vezes; uma
 * Runa é uma gravação PERMANENTE e CUMULATIVA (até MAX_RUNES_PER_ITEM por
 * peça) que soma direto num campo estático do item (critBonus/defense/
 * hpBonus/accBonus/mpBonus, todos já suportados pela classe Equipment) —
 * uma vez gravada, nunca é removida. A Runa em si só existe via criação
 * no Ateliê (nunca comprada pronta em loja nenhuma).
 */
const RuneSystem = {
    // Duas runas por peça — o suficiente pra "personalizar" sem virar
    // powercreep infinito (craftar/aplicar a mesma runa dezenas de vezes).
    MAX_RUNES_PER_ITEM: 2,

    canApply(item, rune) {
        if (!item || item.category !== 'equipment') return false;
        if (!rune) return false;
        const isWeapon = item.slot === SLOTS.MAIN_HAND || item.slot === SLOTS.RANGED;
        if (rune.appliesTo === 'weapon' && !isWeapon) return false;
        if (rune.appliesTo === 'armor' && isWeapon) return false;
        const applied = item.appliedRunes || [];
        if (applied.length >= this.MAX_RUNES_PER_ITEM) return false;
        if (applied.includes(rune.id)) return false; // nunca duas vezes a MESMA runa na mesma peça
        return true;
    },

    // Grava de verdade — muta o campo estático do item (nunca passa por
    // battle.js/onHit, ao contrário de EnchantmentSystem.apply). Retorna
    // true/false; quem chama é responsável por consumir a Runa da mochila.
    apply(item, rune) {
        if (!this.canApply(item, rune)) return false;
        item[rune.statKey] = (item[rune.statKey] || 0) + rune.amount;
        item.appliedRunes = item.appliedRunes || [];
        item.appliedRunes.push(rune.id);
        return true;
    }
};
window.RuneSystem = RuneSystem;
