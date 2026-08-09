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

// Identidade visual por TIPO de dano contínuo (dot.type) — sangramento,
// veneno e queimadura ficavam todos com o mesmo ícone/cor genéricos de
// "sangramento" na UI de status e na mensagem de tique (bug de auditoria
// visual: efeitos diferentes pareciam idênticos ao jogador). Usado por
// battle.js (applyBleedTick) e ui.js (_buildStatusIconsHtml).
const DOT_VISUALS = {
    sangramento: { icon: '🩸', color: '#c0392b', label: 'sangramento' },
    veneno: { icon: '☠️', color: '#7fbf3f', label: 'veneno' },
    queimadura: { icon: '🔥', color: '#ff5a1e', label: 'queimadura' }
};

const ENCHANTMENTS = {
    fogo: {
        id: 'fogo', name: 'Fogo', color: '#ff5a1e', appliesTo: ['weapon'],
        description: 'Queimadura: dano extra (mitigado pela Defesa do alvo) ao longo de 2 turnos após acertar.',
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
        description: 'Corte profundo (mitigado pela Defesa do alvo): sangramento adicional que se acumula com golpes repetidos.',
        cost: 130,
        onHit(attacker, defender) {
            const bleed = Math.max(2, Math.floor(attacker.getTotalStat('str') * 0.4));
            return { extraDamage: 0, dot: { type: 'sangramento', turns: 2, damage: bleed, stacks: true }, particleColor: '#8b0000' };
        }
    },
    sagrado: {
        id: 'sagrado', name: 'Sagrado', color: '#ffe9a3', appliesTo: ['weapon', 'armor'],
        // Item 12 da auditoria: a descrição nunca mencionava o bônus de
        // +6% de Defesa (ver onDefend abaixo) — só aparecia de verdade
        // quando o jogador equipava numa peça de armadura, sem NENHUM
        // aviso prévio disso na própria descrição mostrada no tooltip/tela
        // de Encantamentos.
        description: 'Dano extra contra inimigos das trevas; cura uma fração do dano causado. Em armadura: +6% de Defesa.',
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
        // Mesmo motivo do Sagrado acima — +4% de esquiva (onDefend) nunca
        // aparecia na descrição.
        description: 'Dano extra contra inimigos sagrados; rouba um pouco de vida. Em armadura: +4% de esquiva.',
        cost: 180,
        onHit(attacker, defender) {
            const isHolyFoe = defender.lineage === 'luz';
            const extra = isHolyFoe ? Math.floor(attacker.derivedStats.physicalDamage * 0.3) : Math.floor(attacker.derivedStats.physicalDamage * 0.1);
            return { extraDamage: extra, lifestealPercent: 10, particleColor: '#5a1e5a' };
        },
        onDefend(defender) {
            return { dodgeBonusPercent: 4 };
        }
    },

    // Rework Econômico item 10/16 (achado da Iteração 3): Encantamentos
    // eram acessíveis de QUALQUER cidade pelo ícone de Inventário da HUD,
    // sem NENHUM gate regional — minava a própria identidade "Elfos =
    // magia" construída nas Iterações 3/6 (Ateliê Élfico). Reaproveita o
    // MESMO campo `region` já usado por items.js pra equipamento regional
    // (ver ui.js renderEnchantments, que agora filtra por região igual
    // ItemFactory._pickRandomEquipmentId já fazia) — primeiro encantamento
    // exclusivo do jogo, só aplicável fisicamente dentro do Santuário
    // Élfico. Efeito baseado em Inteligência (nunca Força/Agilidade),
    // reforçando a identidade "magia" sem reaproveitar o tema físico/
    // defensivo das runas anãs.
    arcano: {
        id: 'arcano', name: 'Arcano', color: '#8a5fff', appliesTo: ['weapon', 'armor'], region: 'santuario_elfico',
        description: 'Dano extra baseado em Inteligência ao acertar. Em armadura: +5% de esquiva (barreira arcana). Só aplicável no Santuário Élfico.',
        cost: 200,
        onHit(attacker, defender) {
            const extra = Math.floor(attacker.getTotalStat('int') * 0.8);
            return { extraDamage: extra, particleColor: '#8a5fff' };
        },
        onDefend(defender) {
            return { dodgeBonusPercent: 5 };
        }
    },

    // --- Mega Atualização item 9: reforço élfico — Arcano (acima) já
    // cobria "magia baseada em Inteligência", mas a diretiva pede
    // encantamentos NO PLURAL pra cada cultura. Os dois abaixo cobrem dois
    // eixos que a diretiva menciona explicitamente e que NENHUM
    // encantamento do jogo ainda tocava: mana (Sopro da Mata) e precisão
    // que ignora armadura (Fenda Élfica) — nunca um segundo "+X dano
    // baseado em INT" reaproveitando a mesma fórmula do Arcano.
    soprodamata: {
        id: 'soprodamata', name: 'Sopro da Mata', color: '#5fcf8a', appliesTo: ['weapon'], region: 'santuario_elfico',
        description: 'A cada acerto, restaura uma pequena quantidade de Mana — a energia da floresta flui de volta pro conjurador. Só aplicável no Santuário Élfico.',
        cost: 210,
        onHit(attacker, defender) {
            // Único encantamento do jogo que restaura MANA (não HP) —
            // battle.js executeAttack ganhou um novo campo mínimo
            // (manaRestoreFlat) só pra isso, simétrico a healPercent já
            // existente. Escala com INT (quanto mais afinado com magia,
            // mais mana o Sopro devolve), nunca um valor fixo solto.
            const restore = Math.max(1, Math.floor(attacker.getTotalStat('int') * 0.25));
            return { extraDamage: 0, manaRestoreFlat: restore, particleColor: '#5fcf8a' };
        }
    },
    fendaelfica: {
        id: 'fendaelfica', name: 'Fenda Élfica', color: '#c9e070', appliesTo: ['weapon'], region: 'santuario_elfico',
        description: 'Golpe preciso o bastante pra encontrar a fenda em qualquer armadura — dano extra proporcional à própria Defesa do alvo (quanto mais couraçado, mais a lâmina rouba). Só aplicável no Santuário Élfico.',
        cost: 220,
        onHit(attacker, defender) {
            // Único encantamento cujo dano escala com a DEFESA do
            // DEFENSOR (todos os outros olham só o atacante ou o dano já
            // calculado) — nunca duplica Peso Brutal (Orc, escala com a
            // DIFERENÇA de Força) nem `armorPierce` (propriedade fixa de
            // algumas armas — martelos, machados, lanças — que reduz a
            // Defesa ANTES da mitigação, ver items.js/battle.js): este
            // efeito soma dano DEPOIS da mitigação, então nunca reduz a
            // Defesa em si, só recupera uma fração dela como dano bônus.
            const pierce = Math.floor(defender.getTotalStat('def') * 0.22);
            return { extraDamage: pierce, particleColor: '#c9e070' };
        }
    },

    // --- Mega Atualização item 7/8: Encantamentos Orcs — força bruta,
    // impacto físico, sobrevivência sob pressão. NUNCA um bônus numérico
    // solto (item 7 da diretiva é explícito: "não faça Encantamento Orc =
    // +10 STR") — os três abaixo cada um usa uma condição/gatilho
    // MECÂNICO diferente, reaproveitando só o vocabulário já consumido
    // por battle.js executeAttack (extraDamage/stunChance/particleColor —
    // ver enchantEff acima em Fogo/Gelo/Eletricidade), nunca exigindo
    // nenhuma mudança em battle.js.
    impactoorc: {
        id: 'impactoorc', name: 'Impacto Orc', color: '#c96a1a', appliesTo: ['weapon'], region: 'fortaleza_orc',
        description: 'Quanto mais pesada a arma na mão, maior a chance de atordoar o alvo com o próprio impacto do golpe. Uma adaga não atordoa ninguém; um martelo, sim. Só aplicável na Fortaleza Orc.',
        cost: 190,
        onHit(attacker, defender) {
            // Peso da arma ATIVA (ver getActiveWeapon, já usado em toda
            // parte do jogo) determina a chance — nunca um valor fixo
            // igual Eletricidade, então a MESMA arma leve nunca atordoa
            // tão bem quanto um martelo de guerra com este encantamento.
            const weapon = attacker.getActiveWeapon ? attacker.getActiveWeapon() : null;
            const weight = weapon ? weapon.weight : 0;
            const stunChance = Utils.clamp(weight * 2.2, 0, 30);
            return { extraDamage: 0, stunChance, particleColor: '#c96a1a' };
        }
    },
    sanguedebatalha: {
        id: 'sanguedebatalha', name: 'Sangue de Batalha', color: '#8b1a1a', appliesTo: ['weapon'], region: 'fortaleza_orc',
        description: 'Um orc ferido luta com mais fúria, não com menos — dano extra que cresce quanto mais perto da morte o usuário estiver. Só aplicável na Fortaleza Orc.',
        cost: 180,
        onHit(attacker, defender) {
            // Único encantamento do jogo cujo efeito depende do HP ATUAL
            // do próprio ATACANTE (todos os outros só olham dano/atributo
            // fixo do item ou do alvo) — nunca duplica Sagrado/Profano
            // (que curam, não ganham dano) nem lifestealPercent de
            // Linhagem (passivo, sempre ativo, não condicional a HP baixo).
            const hpPercent = attacker.derivedStats.maxHp > 0 ? attacker.currentHp / attacker.derivedStats.maxHp : 1;
            const lowHpBonus = hpPercent < 0.5 ? Math.floor(attacker.derivedStats.physicalDamage * (0.5 - hpPercent) * 0.6) : 0;
            return { extraDamage: lowHpBonus, particleColor: '#8b1a1a' };
        }
    },
    pesobrutal: {
        id: 'pesobrutal', name: 'Peso Brutal', color: '#5a4a2a', appliesTo: ['weapon'], region: 'fortaleza_orc',
        description: 'Quanto mais forte o usuário for em comparação ao alvo, mais o golpe esmaga — inútil contra quem é mais forte que você, brutal contra quem é mais fraco. Só aplicável na Fortaleza Orc.',
        cost: 170,
        onHit(attacker, defender) {
            // Único encantamento que lê o atributo do DEFENSOR pra decidir
            // o próprio dano (todos os outros ou são fixos ou dependem só
            // do atacante) — a diferença de STR pode ser negativa (defensor
            // mais forte), então sempre clampado a 0 pra nunca virar um
            // penalizador de dano por acidente.
            const strDiff = attacker.getTotalStat('str') - defender.getTotalStat('str');
            const extra = strDiff > 0 ? Math.floor(strDiff * 1.1) : 0;
            return { extraDamage: extra, particleColor: '#5a4a2a' };
        }
    },

    // --- Mega Atualização item 10: reforça a identidade Anã (metalurgia/
    // durabilidade) com um SEGUNDO encantamento além do que já existe na
    // Forja em si — este é o único encantamento do jogo que interage com
    // `item.durability` (ver battle.js endBattle, único ponto que já lia
    // esse campo). Nunca duplica o sistema de reparo do Ferreiro/Armeiro,
    // só reduz a CHANCE de perder durabilidade a cada luta.
    vinculodoferreiro: {
        id: 'vinculodoferreiro', name: 'Vínculo do Ferreiro', color: '#8a3a1a', appliesTo: ['weapon', 'armor'], region: 'reino_anao',
        description: 'Trabalho de forja tão bem feito que resiste ao próprio desgaste do combate — 40% de chance de a peça não perder durabilidade a cada luta. Só aplicável no Reino Anão.',
        cost: 210,
        // Único campo lido FORA do contrato onHit/onDefend (ver battle.js
        // endBattle) — não é um efeito de combate, é uma propriedade
        // passiva do item em si, então não faz sentido forçar isso no
        // formato onHit só pra manter uma convenção que não se aplica aqui.
        durabilityShieldChance: 40
    }
};
window.ENCHANTMENTS = ENCHANTMENTS;
window.DOT_VISUALS = DOT_VISUALS;

window.EnchantmentSystem = {
    // Só pode encantar itens de equipamento reais (nunca consumíveis), o
    // encantamento precisa aceitar o tipo da peça (arma vs armadura), e —
    // se o encantamento tiver `region` (ver Arcano acima) — o jogador
    // precisa estar FISICAMENTE na cidade certa. Checado aqui (não só na
    // UI que filtra a lista) pra nunca depender só do front-end: mesmo
    // que algo chame apply() diretamente, a regra vale.
    canApply(item, enchantId) {
        if (!item || item.category !== 'equipment') return false;
        const ench = ENCHANTMENTS[enchantId];
        if (!ench) return false;
        if (ench.region) {
            const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
            if (ench.region !== cityId) return false;
        }
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
