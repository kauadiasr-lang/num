/**
 * Sistema de Viagem Manual (Estrada) — alternativa à viagem instantânea do
 * Viajante do Portão (ver city.js travelToCity/ui.js openCaravan, que
 * continuam existindo intactos). Em vez de pagar e chegar na hora, o
 * jogador percorre a distância entre cidades em ETAPAS reais — a pé (de
 * graça, mas custa fadiga e tempo) ou a cavalo (mais rápido, custa uma
 * fração da passagem) — cada etapa com chance de um evento no caminho
 * (mercador, achado, emboscada, descanso). Orientado a dados, igual a todo
 * outro registry do jogo (Encantamentos, Linhagens, Missões...): uma
 * cidade nova automaticamente ganha uma rota funcional, sem precisar de
 * conteúdo específico por par de cidade.
 */

const ROAD_STEPS_WALK = 6;   // a pé: mais etapas, de graça, custa fadiga
const ROAD_STEPS_HORSE = 4;  // a cavalo: menos etapas, custa uma fração da passagem
const ROAD_HORSE_COST_PERCENT = 0.4;

// Pontos de interesse "de passagem" — flavor de progresso mostrado na
// trilha da tela (ver ui.js openRoad) a cada etapa avançada.
const ROAD_WAYPOINT_LABELS = [
    'Bifurcação na estrada', 'Clareira aberta', 'Travessia de rio', 'Ruínas cobertas de musgo',
    'Acampamento abandonado', 'Ponte de pedra antiga', 'Pequeno templo à beira do caminho', 'Trilha secreta'
];

const RoadSystem = {
    getStepCount(mode) {
        return mode === 'horse' ? ROAD_STEPS_HORSE : ROAD_STEPS_WALK;
    },

    getHorseCost(destDef) {
        return Math.max(1, Math.round((destDef.travelCost || 0) * ROAD_HORSE_COST_PERCENT));
    },

    // Inicia uma travessia manual. O aluguel do cavalo é cobrado já na
    // largada (a pé nunca cobra ouro nenhum — a exploração livre precisa
    // ser sempre uma opção acessível). Retorna false sem nenhum efeito
    // colateral se algo impedir (nível/ouro insuficiente, mesma cidade,
    // já em viagem).
    startJourney(player, fromId, toId, mode) {
        if (!player || player.roadJourney) return false;
        const dest = window.CityDatabase && window.CityDatabase[toId];
        if (!dest || toId === fromId) return false;
        if (player.level < dest.unlockLevel) return false;
        const isHorse = mode === 'horse';
        if (isHorse) {
            const cost = this.getHorseCost(dest);
            if (player.gold < cost) return false;
            player.gold -= cost;
        }
        player.roadJourney = {
            fromId, toId,
            mode: isHorse ? 'horse' : 'walk',
            step: 0,
            totalSteps: this.getStepCount(mode),
            log: []
        };
        return true;
    },

    // Abandonar sempre é possível e nunca penaliza além do que já foi
    // gasto pra iniciar (mesmo princípio já usado em QuestSystem.abandonQuest)
    // — o jogador simplesmente volta a estar "parado" na cidade de origem.
    abandonJourney(player) {
        if (!player || !player.roadJourney) return false;
        player.roadJourney = null;
        return true;
    },

    // Avança uma etapa: sorteia um evento de caminho e aplica o efeito.
    // Retorna { message, label, arrived, ambush } — `arrived` true quando a
    // etapa que acabou de rodar era a última (quem chama decide o que fazer:
    // ver ui.js advanceRoad, que then chama City.travelToCity). `ambush`
    // true quando o evento decidiu por conta própria iniciar uma batalha
    // (ver ui.js, que já cuida de não deixar chegar na cidade no meio de
    // uma emboscada em andamento).
    advance(player) {
        const journey = player.roadJourney;
        if (!journey) return null;

        journey.step++;
        const label = ROAD_WAYPOINT_LABELS[Utils.randomInt(0, ROAD_WAYPOINT_LABELS.length - 1)];

        // Fadiga só no modo a pé — o cavalo poupa o esforço físico do
        // jogador, é literalmente o que se paga por ele.
        if (journey.mode === 'walk' && Utils.chance(35)) {
            player.fatigue = Math.min(3, (player.fatigue || 0) + 1);
        }

        const result = this._rollEvent(player, label);
        journey.log.unshift(result.message);
        if (journey.log.length > 5) journey.log.length = 5;

        const arrived = journey.step >= journey.totalSteps;
        return { message: result.message, label, arrived, ambush: !!result.ambush };
    },

    _rollEvent(player, label) {
        const roll = Utils.randomInt(1, 100);
        if (roll <= 15) {
            // Emboscada: batalha real contra um inimigo procedural, mesmo
            // padrão de city.js _eventHunters — nunca uma derrota "de
            // surpresa" sem luta, sempre uma luta de verdade que o jogador
            // pode vencer ou perder como qualquer Duelo Rápido (ver ui.js
            // openRoad, que dispara startBattle e retoma a viagem depois).
            return { message: `${label}: passos apressados se aproximam por trás — uma emboscada!`, ambush: true };
        } else if (roll <= 30) {
            const gift = Utils.randomInt(10, 35);
            player.gold += gift;
            return { message: `${label}: um mercador de passagem compra uma bugiganga sua por ${gift}g.` };
        } else if (roll <= 40) {
            const gift = Utils.randomInt(5, 20);
            player.gold += gift;
            return { message: `${label}: você encontra ${gift}g esquecidos entre as pedras.` };
        } else if (roll <= 55) {
            return { message: `${label}: um viajante solitário troca poucas palavras com você antes de seguir em silêncio.` };
        } else if (roll <= 65 && (player.fatigue || 0) > 0) {
            player.cureFatigue(1);
            return { message: `${label}: você descansa um instante à sombra — 1 nível de fadiga a menos.` };
        } else {
            return { message: `${label}: nada de especial chama sua atenção — apenas o caminho seguindo em frente.` };
        }
    }
};
window.RoadSystem = RoadSystem;
window.ROAD_WAYPOINT_LABELS = ROAD_WAYPOINT_LABELS;
