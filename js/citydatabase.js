/**
 * Cidades-Hub Regionais — registro orientado a dados de todas as cidades
 * visitáveis (ver CityEngine em city.js, que lê estes dados em vez de ter
 * qualquer valor de clima/bioma/demografia fixo no motor). Uma cidade nova é
 * só mais uma entrada aqui: `arenaBiomes` filtra o sorteio de cenário de
 * batalha (ver graphics.js resetForNewBattle), `weather` substitui as
 * chances fixas de chuva/tempestade da Cidade (ver city.js _updateWeather),
 * `raceDemographics` pondera a raça sorteada nos inimigos do Duelo Rápido
 * (ver enemy.js Enemy, Utils.weightedPick) e `unlockLevel`/`travelCost`
 * alimentam o Viajante do Portão (ver ui.js openCaravan).
 *
 * Nenhum prédio físico muda entre cidades (Ferreiro, Armeiro, Taverna, Banco,
 * Hall da Fama, Casa, Mercado Arcano continuam existindo em toda cidade —
 * são a infraestrutura civil que qualquer assentamento grande tem, e o
 * Viajante do Portão — ver city.js _makeCaravanTraveler — está sempre lá
 * também, parado no vão da muralha); o que muda de verdade ao viajar é:
 * quem mora lá (demografia + NPCs, ver city.js _makeNpc), quem se enfrenta
 * na Arena (raça dos inimigos), o que se compra (region em items.js) e como
 * o céu se comporta (clima/bioma).
 */
const CityDatabase = {
    porto_helenico: {
        id: 'porto_helenico',
        name: 'Porto Helênico',
        description: 'A cidade natal de todo gladiador que começa sua jornada na Arena — praças de mármore, oliveiras centenárias e o Coliseu Imperial erguido no centro de tudo.',
        unlockLevel: 1, // sempre disponível — cidade inicial de qualquer personagem novo
        travelCost: 0,  // "voltar pra casa" nunca cobra passagem
        arenaBiomes: ['coliseu', 'areia', 'ruinas', 'templo', 'castelo'],
        weather: { rainChance: 35, stormChance: 30 }, // valores originais da Cidade, preservados como padrão
        raceDemographics: { humano: 55, espartano: 15, ateniense: 15, cretense: 8, tebano: 7 },
        accentColor: '#c9a227' // dourado/mármore
    },
    fortaleza_orc: {
        id: 'fortaleza_orc',
        name: 'Fortaleza Orc de Gorkhal',
        description: 'Muralhas de pedra bruta e ferro enferrujado erguidas sobre rocha vulcânica — aqui só prospera quem prova força de verdade, todos os dias.',
        unlockLevel: 3,
        travelCost: 120,
        arenaBiomes: ['vulcanica', 'montanhas', 'ruinas', 'castelo'],
        weather: { rainChance: 15, stormChance: 45 }, // clima seco a maior parte do tempo, mas tempestades bem mais violentas quando chega a chover
        raceDemographics: { orc: 78, anao: 10, humano: 8, espartano: 4 },
        accentColor: '#6b3a2a'
    },
    santuario_elfico: {
        id: 'santuario_elfico',
        name: 'Santuário Élfico de Sylvaneth',
        description: 'Uma cidade erguida entre raízes ancestrais e cascatas silenciosas, onde a fronteira entre floresta e civilização praticamente não existe.',
        unlockLevel: 6,
        travelCost: 220,
        arenaBiomes: ['floresta', 'templo', 'montanhas', 'congelada'],
        weather: { rainChance: 65, stormChance: 20 }, // chove muito mais que nas outras cidades (identidade climática pedida)
        raceDemographics: { elfo: 70, humano: 10, ateniense: 10, cretense: 10 },
        accentColor: '#2a6a4a'
    }
};
window.CityDatabase = CityDatabase;

// ID da cidade padrão — usado como fallback para saves antigos (sem
// `player.currentCityId`) e como cidade inicial de qualquer personagem novo.
window.DEFAULT_CITY_ID = 'porto_helenico';

// Acesso central ao id/def da cidade atual, com fallback seguro: cobre saves
// antigos (campo ausente) e qualquer `currentCityId` salvo que não exista
// mais no registro (ex: cidade removida numa atualização futura) — nenhum
// outro arquivo precisa reimplementar essa checagem.
window.getCurrentCityId = function() {
    const p = window.Engine && window.Engine.state && window.Engine.state.player;
    const id = p && p.currentCityId;
    return (id && CityDatabase[id]) ? id : window.DEFAULT_CITY_ID;
};
window.getCurrentCityDef = function() {
    return CityDatabase[window.getCurrentCityId()];
};

// Lista de cidades já desbloqueadas pelo nível atual do jogador — usada pelo
// Viajante do Portão (ver ui.js openCaravan). Não existe um array salvo de
// "cidades descobertas": o desbloqueio é computado a partir do nível, então
// não há nenhum campo novo de save a manter compatível.
window.getUnlockedCities = function(playerLevel) {
    return Object.values(CityDatabase).filter(c => playerLevel >= c.unlockLevel);
};
