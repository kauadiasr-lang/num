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

// Floresta Ancestral (ver nature.js) — item pedido: acesso DIRETO pelo
// Portão da muralha (mesmo NPC/botão do Mestre de Caravanas, ver ui.js
// openCaravan/startForestExpedition), sem precisar esperar o encontro
// raro (4%) durante uma viagem comum entre cidades. `toId` é um id
// "virtual" — nunca existe em CityDatabase, então openRoad/advanceRoad
// (ui.js) tratam essa expedição à parte de uma viagem real entre cidades.
const FOREST_EXPEDITION_ID = 'floresta_ancestral';
const FOREST_EXPEDITION_STEPS = 5;

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
        // Item 18 da revisão profunda: mesma exceção de travelToCity em
        // city.js — uma cidade já visitada (ex: cidade natal por raça)
        // nunca deve travar de novo por causa do gate de nível.
        if (player.level < dest.unlockLevel && !(player.visitedCityIds && player.visitedCityIds.includes(toId))) return false;
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

    // Expedição direta à Floresta Ancestral, iniciada pelo próprio Portão
    // (ver ui.js openCaravan/startForestExpedition) — sempre a pé, sempre
    // de graça (a mata sagrada não pertence a cidade nenhuma pra cobrar
    // passagem), e sempre a partir da cidade atual (o retorno é pra ela
    // mesma, nunca uma viagem real pra outra cidade — ver ui.js
    // advanceRoad). Ainda usa a MESMA estrutura de roadJourney (reaproveita
    // toda a tela/lógica da Estrada já testada), só marcada com
    // `isForestExpedition:true` pra ui.js saber tratar a chegada diferente.
    startForestExpedition(player) {
        if (!player || player.roadJourney) return false;
        const fromId = player.currentCityId || (window.getCurrentCityId ? window.getCurrentCityId() : null);
        if (!fromId) return false;
        player.roadJourney = {
            fromId, toId: FOREST_EXPEDITION_ID,
            mode: 'walk',
            step: 0,
            totalSteps: FOREST_EXPEDITION_STEPS,
            log: [],
            isForestExpedition: true
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
    // Retorna { message, label, arrived, ambush, elite } — `arrived` true
    // quando a etapa que acabou de rodar era a última (quem chama decide o
    // que fazer: ver ui.js advanceRoad, que then chama City.travelToCity).
    // `ambush` true quando o evento decidiu por conta própria iniciar uma
    // batalha (ver ui.js, que já cuida de não deixar chegar na cidade no
    // meio de uma emboscada em andamento); `elite` marca a variante rara e
    // mais dura desse mesmo tipo de evento (chefe opcional do caminho).
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

        const result = this._rollEvent(player, label, !!journey.isForestExpedition);
        journey.log.unshift(result.message);
        if (journey.log.length > 5) journey.log.length = 5;

        const arrived = journey.step >= journey.totalSteps;
        return { message: result.message, label, arrived, ambush: !!result.ambush, elite: !!result.elite, natureDiscovery: !!result.natureDiscovery, corruptionEvent: !!result.corruptionEvent };
    },

    // `isForestExpedition` true só na expedição direta à Floresta Ancestral
    // (ver startForestExpedition acima) — o jogador foi lá DE PROPÓSITO, o
    // que muda dois comportamentos:
    // 1) A descoberta da Linhagem da Natureza nunca é deixada ao acaso
    //    dessa vez (garantida, em vez do 4% de chance de uma viagem comum
    //    entre cidades, ver mais abaixo).
    // 2) É o ÚNICO lugar onde o segredo da Corrupção (ver corruption.js
    //    CorruptionSystem) pode se manifestar — checado logo abaixo, ANTES
    //    até da descoberta da Natureza (as duas condições nunca coexistem
    //    de qualquer forma: a Corrupção exige a Linhagem da Natureza JÁ
    //    descoberta, então a ordem de checagem não importa na prática, mas
    //    a Corrupção sendo mais "avançada" narrativamente vem primeiro).
    // Uma vez já resolvida (descoberta ou corrompida), visitas seguintes à
    // Floresta caem na MESMA tabela de eventos normal (merchant/baú/
    // segredo/emboscada...) — a mata continua sendo um lugar de verdade
    // pra explorar, não só uma cutscene de uma vez só.
    _rollEvent(player, label, isForestExpedition) {
        // Segredo da Corrupção (ver corruption.js CorruptionSystem) — só
        // checado dentro da própria Floresta Ancestral, nunca durante uma
        // viagem comum entre cidades (a entidade profana pertence à mata,
        // não à estrada em geral). `corruptionEvent` não é uma emboscada
        // (nenhuma batalha começa aqui) — ver ui.js advanceRoad/
        // showCorruptionChoice, que mostra a escolha (ou o bloqueio
        // narrativo, se o jogador já tiver uma Linhagem principal) em vez
        // de uma tela de batalha.
        if (isForestExpedition && window.CorruptionSystem && window.CorruptionSystem.isEventReady(player)) {
            return {
                message: `${label}: uma presença profana emerge da névoa, sussurrando uma oferta sombria...`,
                corruptionEvent: true
            };
        }

        // Descoberta da Floresta Ancestral (item pedido: Linhagem SECUNDÁRIA
        // da Natureza, ver nature.js) — checada ANTES da tabela normal,
        // raridade própria e separada, e só pode acontecer uma vez por
        // personagem (nunca mais reaparece depois de já ter a linhagem
        // secundária, corrompida ou não). Ainda usa o mesmo fluxo de
        // "ambush" já testado (batalha real, vencer/perder decide o
        // resultado), só que sinalizado como `natureDiscovery` pra ui.js
        // saber que precisa disparar a cena de descoberta na vitória, em
        // vez de só retomar a viagem normalmente.
        if (window.NatureSystem && window.NatureSystem.isDiscoveryAvailable(player) && (isForestExpedition || Utils.chance(4))) {
            return {
                message: `${label}: a névoa da mata se adensa — um monstro das sombras corrompe as raízes ao seu redor!`,
                ambush: true, natureDiscovery: true
            };
        }

        const roll = Utils.randomInt(1, 100);
        if (roll <= 12) {
            // Emboscada: batalha real contra um inimigo procedural, mesmo
            // padrão de city.js _eventHunters — nunca uma derrota "de
            // surpresa" sem luta, sempre uma luta de verdade que o jogador
            // pode vencer ou perder como qualquer Duelo Rápido (ver ui.js
            // openRoad, que dispara startBattle e retoma a viagem depois).
            return { message: `${label}: passos apressados se aproximam por trás — uma emboscada!`, ambush: true };
        } else if (roll <= 16) {
            // Chefe opcional do caminho (item pedido na auditoria de mundo
            // vivo: "chefes opcionais" durante a exploração) — raro, mais
            // forte que uma emboscada comum (ver ui.js startRoadBattle,
            // nível efetivo +3), recompensa maior compensa o risco extra.
            // Sempre avisado ANTES da luta começar (nunca uma derrota de
            // surpresa sem chance de reação).
            return { message: `${label}: um vulto imponente bloqueia a passagem, avaliando se você é digno de um desafio maior...`, ambush: true, elite: true };
        } else if (roll <= 30) {
            const gift = Utils.randomInt(10, 35);
            player.gold += gift;
            return { message: `${label}: um mercador de passagem compra uma bugiganga sua por ${gift}g.` };
        } else if (roll <= 40) {
            const gift = Utils.randomInt(5, 20);
            player.gold += gift;
            return { message: `${label}: você encontra ${gift}g esquecidos entre as pedras.` };
        } else if (roll <= 48) {
            return this._rollChest(player, label);
        } else if (roll <= 55) {
            // Local secreto (item pedido: "segredos" durante a exploração)
            // — recompensa nitidamente maior que o achado comum acima,
            // condizente com ser um esconderijo escondido, não só moedas
            // caídas à vista.
            const gift = Utils.randomInt(40, 80);
            player.gold += gift;
            return { message: `${label}: um esconderijo secreto guarda ${gift}g abandonados há muito tempo.` };
        } else if (roll <= 68) {
            return { message: `${label}: um viajante solitário troca poucas palavras com você antes de seguir em silêncio.` };
        } else if (roll <= 78 && (player.fatigue || 0) > 0) {
            player.cureFatigue(1);
            return { message: `${label}: você descansa um instante à sombra — 1 nível de fadiga a menos.` };
        } else {
            return { message: `${label}: nada de especial chama sua atenção — apenas o caminho seguindo em frente.` };
        }
    },

    // Baú (item pedido: "baús" durante a exploração) — item de equipamento
    // real via ItemFactory, mesmo pool regional já usado pelo loot de
    // batalha (ver enemy.js generateLoot/_pickRandomEquipmentId). Mochila
    // cheia nunca "perde" o achado silenciosamente: vende no local por
    // metade do valor em vez de descartar.
    _rollChest(player, label) {
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        const picked = window.ItemFactory && window.ItemFactory._pickRandomEquipmentId
            ? window.ItemFactory._pickRandomEquipmentId(cityId, false) : null;
        if (!picked) {
            const gift = Utils.randomInt(15, 30);
            player.gold += gift;
            return { message: `${label}: um baú vazio, só ${gift}g esquecidos no fundo.` };
        }
        const rarity = Utils.chance(20) ? RARITY.UNCOMMON : RARITY.COMMON;
        const item = window.ItemFactory.createEquipment(picked.id, picked.category, rarity);
        if (player.inventory.length < player.inventoryCapacity) {
            player.inventory.push(item);
            return { message: `${label}: um baú escondido entre as pedras guarda ${item.name}!` };
        }
        const soldFor = Math.floor(item.value * 0.5);
        player.gold += soldFor;
        return { message: `${label}: um baú guarda ${item.name}, mas sua mochila está cheia — você vende no local por ${soldFor}g.` };
    }
};
window.RoadSystem = RoadSystem;
window.ROAD_WAYPOINT_LABELS = ROAD_WAYPOINT_LABELS;
window.FOREST_EXPEDITION_ID = FOREST_EXPEDITION_ID;
