/**
 * Sistema de Encantamentos — magia aplicada exclusivamente a equipamentos.
 *
 * Independente do sistema de Linhagens (ver lineages.js): um encantamento
 * nunca altera o corpo do gladiador, só a arma/armadura em que é aplicado, e
 * pode ser trocado livremente a qualquer momento (ao contrário da Linhagem,
 * que é escolhida uma única vez e permanece para sempre). Registry orientado
 * a dados — adicionar um encantamento novo é só registrar mais uma entrada
 * aqui, sem tocar em battle.js.
 */

const ENCHANTMENTS = {
    fogo: {
        id: 'fogo', name: 'Fogo', color: '#ff5a1e', appliesTo: ['weapon'],
        description: 'Queimadura: dano extra ao longo de 2 turnos após acertar.',
        cost: 120,
        // Aplicado em cada acerto físico do item encantado (ver battle.js
        // executeAttack). Retorna { extraDamage, statusEffect } — statusEffect
        // é opcional (aplica um efeito contínuo no alvo, ex: sangramento/queimadura).
        onHit(attacker, defender) {
            const burn = Math.max(2, Math.floor(attacker.getTotalStat('int') * 0.6));
            return { extraDamage: Math.floor(attacker.derivedStats.physicalDamage * 0.15), dot: { type: 'queimadura', turns: 2, damage: burn }, particleColor: '#ff5a1e' };
        }
    },
    gelo: {
        id: 'gelo', name: 'Gelo', color: '#7ec8e3', appliesTo: ['weapon'],
        description: 'Chance de reduzir a velocidade de ataque do alvo por 1 turno.',
        cost: 120,
        onHit(attacker, defender) {
            const slowChance = 25;
            return { extraDamage: Math.floor(attacker.derivedStats.physicalDamage * 0.08), slowChance, particleColor: '#7ec8e3' };
        }
    },
    eletricidade: {
        id: 'eletricidade', name: 'Eletricidade', color: '#f4e04d', appliesTo: ['weapon'],
        description: 'Chance de atordoar brevemente o alvo ao acertar.',
        cost: 150,
        onHit(attacker, defender) {
            return { extraDamage: Math.floor(attacker.derivedStats.physicalDamage * 0.1), stunChance: 15, particleColor: '#f4e04d' };
        }
    },
    veneno: {
        id: 'veneno', name: 'Veneno', color: '#7fbf3f', appliesTo: ['weapon'],
        description: 'Envenenamento: dano contínuo que ignora armadura.',
        cost: 130,
        onHit(attacker, defender) {
            const poison = Math.max(2, Math.floor(attacker.getTotalStat('agi') * 0.5));
            return { extraDamage: 0, dot: { type: 'veneno', turns: 3, damage: poison, ignoresArmor: true }, particleColor: '#7fbf3f' };
        }
    },
    sangramento: {
        id: 'sangramento', name: 'Sangramento', color: '#c0392b', appliesTo: ['weapon'],
        description: 'Corte profundo: sangramento adicional que se acumula com golpes repetidos.',
        cost: 130,
        onHit(attacker, defender) {
            const bleed = Math.max(2, Math.floor(attacker.getTotalStat('str') * 0.4));
            return { extraDamage: 0, dot: { type: 'sangramento', turns: 2, damage: bleed, stacks: true }, particleColor: '#8b0000' };
        }
    },
    sagrado: {
        id: 'sagrado', name: 'Sagrado', color: '#ffe9a3', appliesTo: ['weapon', 'armor'],
        description: 'Dano extra contra inimigos das trevas; cura uma fração do dano causado.',
        cost: 180,
        onHit(attacker, defender) {
            const isDarkfoe = defender.lineage === 'vampirismo' || defender.lineage === 'sombras';
            const extra = isDarkfoe ? Math.floor(attacker.derivedStats.physicalDamage * 0.3) : Math.floor(attacker.derivedStats.physicalDamage * 0.1);
            return { extraDamage: extra, healPercent: 8, particleColor: '#ffe9a3' };
        },
        // Bônus passivo quando aplicado numa peça de armadura (defensivo)
        onDefend(defender) {
            return { defenseBonusPercent: 6 };
        }
    },
    profano: {
        id: 'profano', name: 'Profano', color: '#5a1e5a', appliesTo: ['weapon', 'armor'],
        description: 'Dano extra contra inimigos sagrados; rouba um pouco de vida.',
        cost: 180,
        onHit(attacker, defender) {
            const isHolyFoe = defender.lineage === 'luz';
            const extra = isHolyFoe ? Math.floor(attacker.derivedStats.physicalDamage * 0.3) : Math.floor(attacker.derivedStats.physicalDamage * 0.1);
            return { extraDamage: extra, lifestealPercent: 10, particleColor: '#5a1e5a' };
        },
        onDefend(defender) {
            return { dodgeBonusPercent: 4 };
        }
    }
};
window.ENCHANTMENTS = ENCHANTMENTS;

window.EnchantmentSystem = {
    // Só pode encantar itens de equipamento reais (nunca consumíveis) e o
    // encantamento precisa aceitar o tipo da peça (arma vs armadura).
    canApply(item, enchantId) {
        if (!item || item.category !== 'equipment') return false;
        const ench = ENCHANTMENTS[enchantId];
        if (!ench) return false;
        const isWeapon = item.slot === SLOTS.MAIN_HAND || item.slot === SLOTS.RANGED;
        return ench.appliesTo.includes(isWeapon ? 'weapon' : 'armor');
    },

    // Troca é sempre livre (substitui o anterior sem custo de "remoção") —
    // o custo em ouro é cobrado por quem chama isso (ui.js), não aqui.
    apply(item, enchantId) {
        if (!this.canApply(item, enchantId)) return false;
        item.enchantmentId = enchantId;
        return true;
    },

    remove(item) {
        if (item) item.enchantmentId = null;
    },

    get(item) {
        return item && item.enchantmentId ? ENCHANTMENTS[item.enchantmentId] : null;
    }
};
