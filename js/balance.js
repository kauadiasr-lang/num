/**
 * Balance Core — fonte única de verdade pra fórmulas de progressão.
 *
 * MEGA ATUALIZAÇÃO de Balanceamento (Iteração 1, Fases 1-2 da diretiva):
 * a auditoria de gameplay nível 1-100 encontrou que a curva de XP
 * necessário (antes só em player.js `getExpRequired`) crescia numa base
 * exponencial (1.5) mais rápida que QUALQUER fonte de recompensa do jogo
 * (Duelo Rápido ~1.2^nível, chefes ~1.15^nível, ver enemy.js `expValue`)
 * — o número de batalhas necessárias por nível divergia exponencialmente
 * pra sempre, tornando o nível 100 (e na prática qualquer coisa acima de
 * ~40) matematicamente inatingível por qualquer grind razoável (nível 30
 * sozinho já exigia ~13.500 duelos cumulativos; nível 60, ~11 milhões).
 *
 * Este arquivo centraliza esse tipo de fórmula (começando por XP; outras
 * fases da diretiva — Power Budget, dano esperado por nível, etc. — devem
 * ser adicionadas AQUI em iterações futuras, nunca espalhadas de novo por
 * Player/Enemy/Battle/Skills com números redigitados à mão) — ver
 * CLAUDE.md "Balance Core" pra o racional completo.
 */

// Recompensa de XP REAL do Duelo Rápido comum (ver enemy.js `expValue`,
// inalterado por esta correção — 20-30 * 1.2-1.25^nível dependendo do
// arquétipo). Usado aqui só como REFERÊNCIA de calibração pra curva de
// custo, nunca reimplementa a recompensa em si (a fonte de verdade da
// recompensa continua sendo enemy.js).
function expectedRewardAt(level) {
    return 25 * Math.pow(1.2, level);
}

// Meta de "quantas batalhas do próprio nível" um jogador precisa pra subir
// UM nível, crescendo suavemente por faixa (linear dentro de cada uma,
// as bordas se encontram — nunca um salto abrupto na transição de faixa):
//   1-10   : 3  -> 6  batalhas/nível  ("relativamente rápido")
//   11-30  : 6  -> 15 batalhas/nível  ("progressão moderada")
//   31-60  : 15 -> 30 batalhas/nível  ("mais lenta")
//   61+    : 30 -> 55 batalhas/nível em 100 ("longa, mas viável")
// Calibrado por simulação matemática (não por tentativa e erro): com essa
// meta, o total ACUMULADO de batalhas do nível 1 ao 100 fica em ~2.600 —
// muito, mas genuinamente alcançável em várias sessões de jogo real, bem
// longe da ordem de grandeza anterior (~10^19).
function battlesPerLevelTarget(level) {
    if (level <= 10) return 3 + (level - 1) * (6 - 3) / 9;
    if (level <= 30) return 6 + (level - 10) * (15 - 6) / 20;
    if (level <= 60) return 15 + (level - 30) * (30 - 15) / 30;
    return 30 + (level - 60) * (55 - 30) / 40;
}

// Curva de mitigação REAL usada em TODO dano físico do jogo (ver battle.js
// `reductionPercent = defenseRating / (defenseRating + 50)`, repetida em
// pelo menos 10 lugares diferentes) — dano mágico era a ÚNICA exceção
// (Iteração 2 da diretiva de balanceamento): `finalDmg = magicDmg -
// (defenderInt * 0.5)`, uma subtração FLAT em vez dessa mesma curva
// percentual, e sem NENHUMA contribuição de `defenseRating` — armadura
// literalmente não fazia diferença nenhuma contra magia. Root cause do
// achado #4 da auditoria (Bola de Fogo causando 612-722 de dano contra
// 958 HP máximo): um conjurador inimigo com INT alto multiplicava sem
// nenhum teto percentual, e a resistência da vítima não escalava com
// nada que o jogador pudesse realmente construir (armadura).
const MAGIC_MITIGATION_K = 50; // mesma constante da curva física, mesmo "feel" de diminishing returns

function getMagicResistRating(defender) {
    // INT pesa mais (resistência mágica "de verdade", como já era a
    // intenção original do código) — mas defenseRating (armadura/nível)
    // agora também contribui de verdade, então investir em equipamento
    // físico deixa de ser irrelevante contra conjuradores.
    const int = defender.getTotalStat ? defender.getTotalStat('int') : 5;
    const def = (defender.derivedStats && defender.derivedStats.defenseRating) || 0;
    return int * 1.5 + def * 0.5;
}

const BalanceCore = {
    // Substitui a fórmula antiga (`100 * 1.5^(nível-1)`) — ver player.js
    // `getExpRequired()`, que agora delega pra cá em vez de calcular
    // inline. XP necessário pra sair de `level` para `level+1`.
    getXPRequired(level) {
        return Math.round(battlesPerLevelTarget(level) * expectedRewardAt(level));
    },

    // Substitui a subtração flat de dano mágico (ver battle.js, os dois
    // pontos — jogador conjurando no inimigo e vice-versa) pela MESMA
    // curva percentual de diminishing returns usada em todo dano físico.
    // `rawMagicDamage` já deve vir com o multiplicador de INT/powerMulti
    // aplicado (essa parte não muda — só a mitigação).
    mitigateMagicDamage(rawMagicDamage, defender) {
        const resistRating = getMagicResistRating(defender);
        const reductionPercent = resistRating / (resistRating + MAGIC_MITIGATION_K);
        return Math.max(1, Math.floor(rawMagicDamage * (1 - reductionPercent)));
    },

    // Fase 5 da diretiva de balanceamento (Iteração 4): estimativa de
    // ameaça pra prévia do Duelo Rápido — o jogador nunca sabia se ia
    // enfrentar algo tratável ou brutal até já estar dentro da luta
    // (achado #9 da auditoria). Poder aproximado de uma entidade
    // (jogador ou inimigo) combinando HP, dano físico e defesa num único
    // número — os pesos só existem pra colocar as três grandezas na
    // mesma escala (HP tipicamente na casa das centenas, dano/defesa na
    // casa das dezenas), a RAZÃO entre os dois lados é o que importa,
    // não o valor absoluto.
    _powerScore(entity) {
        const s = entity.derivedStats;
        return (s.maxHp * 0.5) + (s.physicalDamage * 10) + (s.defenseRating * 3);
    },

    // Retorna { ratio, label } comparando o poder do inimigo contra o do
    // jogador. Nunca revela números exatos de stat (só a categoria) —
    // dá informação suficiente pra uma decisão consciente sem entregar a
    // luta inteira de bandeja.
    getThreatLevel(player, enemy) {
        const ratio = this._powerScore(enemy) / Math.max(1, this._powerScore(player));
        let label;
        if (ratio < 0.75) label = 'BAIXA';
        else if (ratio < 1.15) label = 'MÉDIA';
        else if (ratio < 1.6) label = 'ALTA';
        else label = 'EXTREMA';
        return { ratio, label };
    },

    // Exposto pra testes/simulação e pra futuras Fases (Power Budget etc.)
    // reaproveitarem a mesma referência de recompensa sem reimplementar.
    _expectedRewardAt: expectedRewardAt,
    _battlesPerLevelTarget: battlesPerLevelTarget,
    _getMagicResistRating: getMagicResistRating,
};

window.BalanceCore = BalanceCore;
