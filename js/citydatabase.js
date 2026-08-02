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
        // Família de bioma da Estrada (ver js/road.js ZONE_FAMILY_STAGES) —
        // usada só pra nomear/colorir as zonas da travessia MANUAL entre
        // cidades (WASD/clique), nunca pela viagem rápida. Nunca usada
        // sozinha: cada trecho mistura a família de ORIGEM com a de
        // DESTINO, então sair de Porto Helênico rumo à Fortaleza Orc
        // aparece com essa família aqui só na PRIMEIRA metade do caminho.
        roadFamily: 'natureza',
        // Estilo de arquitetura dos prédios da praça (ver city.js
        // _bakeBuildingShell/_bakeBuildingShellGreco) — Porto Helênico
        // preserva a fachada greco-romana original (colunas + pediment)
        // de antes deste campo existir.
        buildingStyle: 'greco',
        arenaBiomes: ['coliseu', 'areia', 'ruinas', 'templo', 'castelo'],
        // Cenário OFICIAL e FIXO desta arena (item 5 da auditoria de
        // balanceamento) — bug de auditoria: antes graphics.js sorteava um
        // bioma ALEATÓRIO dentre `arenaBiomes` a cada luta, então a mesma
        // Cidade-Hub podia mostrar cenários completamente diferentes de
        // duelo pra duelo, sem identidade fixa nenhuma. `arenaBiomes`
        // continua existindo (documenta quais biomas são tematicamente
        // compatíveis com esta cidade, e a validação em main.js exige a
        // lista não-vazia), mas a escolha de exibição agora é sempre esta
        // ÚNICA entrada — nunca mais um sorteio. Coliseu Imperial já é
        // citado na própria descrição da cidade acima, então é literalmente
        // o cenário oficial, não uma escolha arbitrária nova.
        officialArenaBiome: 'coliseu',
        arenaName: 'Coliseu Imperial',
        weather: { rainChance: 35, stormChance: 30 }, // valores originais da Cidade, preservados como padrão
        raceDemographics: { humano: 55, espartano: 15, ateniense: 15, cretense: 8, tebano: 7 },
        accentColor: '#c9a227', // dourado/mármore
        // Cor do piso da praça (ver city.js _drawPlazaGround) — [topo, base
        // do gradiente]. Porto Helênico preserva EXATAMENTE os valores
        // originais de antes deste campo existir (mesma cor de mármore de
        // sempre), garantindo que o visual da cidade padrão não mude nada.
        groundColors: ['#8a8070', '#5a5448'],
        // Tipo de planta por slot de vegetação (ver city.js _drawVegetation)
        // — 'edge' são as 2 plantas nas bordas da tela, 'center' são as 2
        // ladeando a fonte. Porto Helênico preserva cipreste/loureiro, os
        // mesmos valores de antes deste campo existir.
        vegetationTypes: { edge: 'cypress', center: 'laurel' },
        // Cor das estátuas da praça (ver city.js _drawStatue) — Porto
        // Helênico preserva o mármore original de antes deste campo existir.
        statueColor: '#c9c2b0',
        // Cores da fonte central da praça (ver city.js _drawFountain) —
        // Porto Helênico preserva a fonte de água azul original.
        fountainColors: { rim: '#8891a0', basin: '#3a6a8a', jet: 'rgba(200,225,255,0.7)', spout: '#6b7280' },
        // Cores da muralha/torres (ver graphics.js _drawCityWall) — Porto
        // Helênico preserva a pedra cinza original de antes deste campo existir.
        wallColors: { base: 'rgba(94,88,76,0.92)', tower: 'rgba(82,76,64,0.95)' },
        // Cor da floresta silenciosa fora da muralha (ver graphics.js
        // drawCityBackdrop/_drawTreeline) — Porto Helênico preserva a cor
        // original de antes deste campo existir.
        treelineColor: 'rgba(24,34,22,0.55)'
    },
    fortaleza_orc: {
        id: 'fortaleza_orc',
        name: 'Fortaleza Orc de Gorkhal',
        description: 'Muralhas de pedra bruta e ferro enferrujado erguidas sobre rocha vulcânica — aqui só prospera quem prova força de verdade, todos os dias.',
        unlockLevel: 3,
        travelCost: 120,
        // Família de bioma da Estrada (ver porto_helenico.roadFamily acima
        // para a explicação completa do campo).
        roadFamily: 'orc',
        // Estilo de arquitetura (ver porto_helenico.buildingStyle acima) —
        // vigas de ferro nos cantos + telhado plano com ameias em vez de
        // colunas de mármore + pediment, atendendo ao pedido explícito
        // "toda arquitetura [orc] deve parecer brutal".
        buildingStyle: 'orc',
        arenaBiomes: ['vulcanica', 'montanhas', 'ruinas', 'castelo'],
        // Cenário oficial e fixo desta arena (ver comentário completo em
        // porto_helenico.officialArenaBiome acima) — rocha vulcânica já é a
        // própria fundação da fortaleza, descrita na própria descrição da
        // cidade, então "Fosso de Guerra" sobre o bioma vulcânico é o
        // cenário coerente, não uma escolha arbitrária nova.
        officialArenaBiome: 'vulcanica',
        arenaName: 'Fosso de Guerra',
        weather: { rainChance: 15, stormChance: 45 }, // clima seco a maior parte do tempo, mas tempestades bem mais violentas quando chega a chover
        raceDemographics: { orc: 78, anao: 10, humano: 8, espartano: 4 },
        accentColor: '#6b3a2a',
        // Piso de rocha vulcânica escura, não mármore — a praça inteira
        // (metade da tela explorável) usava a MESMA cor de mármore grego de
        // Porto Helênico em toda cidade, apesar da própria descrição da
        // Fortaleza falar de "rocha vulcânica" (ver city.js _drawPlazaGround).
        groundColors: ['#5a4a42', '#332a24'],
        // Árvore morta + arbusto em brasa, não cipreste/loureiro mediterrâneo
        // — mesmo motivo do campo acima (ver city.js _drawVegetation).
        vegetationTypes: { edge: 'deadTree', center: 'emberBush' },
        // Estátuas de rocha vulcânica escura entalhada, não mármore — mesmo
        // motivo do campo acima (ver city.js _drawStatue).
        statueColor: '#4a453e',
        // Braseiro de pedra vulcânica com brasas vivas no centro, não uma
        // fonte de água azul serena — mesmo motivo do campo acima (ver
        // city.js _drawFountain).
        fountainColors: { rim: '#3a2f28', basin: '#8a3a1a', jet: 'rgba(255,140,50,0.75)', spout: '#2a221c' },
        // Muralha de rocha vulcânica escura, mais bruta que a pedra cinza
        // padrão — mesmo motivo do campo acima (ver graphics.js _drawCityWall).
        wallColors: { base: 'rgba(58,46,40,0.92)', tower: 'rgba(48,38,32,0.95)' },
        // Vegetação escassa e ressecada fora da muralha, não a mesma mata
        // cerrada do Santuário Élfico — condizente com a própria descrição
        // da Fortaleza ("rocha vulcânica"), ver graphics.js _drawTreeline.
        treelineColor: 'rgba(48,38,26,0.35)'
    },
    santuario_elfico: {
        id: 'santuario_elfico',
        name: 'Santuário Élfico de Sylvaneth',
        description: 'Uma cidade erguida entre raízes ancestrais e cascatas silenciosas, onde a fronteira entre floresta e civilização praticamente não existe.',
        unlockLevel: 6,
        travelCost: 220,
        // Família de bioma da Estrada (ver porto_helenico.roadFamily acima
        // para a explicação completa do campo).
        roadFamily: 'elfico',
        // Estilo de arquitetura (ver porto_helenico.buildingStyle acima) —
        // raízes retorcidas + telhado em cúpula orgânica em vez de colunas
        // de mármore + pediment, atendendo ao pedido explícito
        // "arquitetura elegante... raízes... madeira viva" da cidade élfica.
        buildingStyle: 'elfico',
        arenaBiomes: ['floresta', 'templo', 'montanhas', 'congelada'],
        // Cenário oficial e fixo desta arena (ver comentário completo em
        // porto_helenico.officialArenaBiome acima) — a cidade já é descrita
        // como "erguida entre raízes ancestrais", então uma clareira de
        // floresta é o cenário coerente, não uma escolha arbitrária nova.
        officialArenaBiome: 'floresta',
        arenaName: 'Clareira Sagrada',
        weather: { rainChance: 65, stormChance: 20 }, // chove muito mais que nas outras cidades (identidade climática pedida)
        raceDemographics: { elfo: 70, humano: 10, ateniense: 10, cretense: 10 },
        accentColor: '#2a6a4a',
        // Piso esverdeado/terroso (raízes e musgo), não mármore — mesmo
        // motivo do campo acima (ver Fortaleza Orc).
        groundColors: ['#5a6a48', '#3a4530'],
        // Arco de raiz ancestral + samambaia luminescente, não cipreste/
        // loureiro — mesmo motivo do campo acima.
        vegetationTypes: { edge: 'ancientRoot', center: 'glowFern' },
        // Estátuas de pedra antiga tomada por musgo, não mármore — mesmo
        // motivo do campo acima (ver city.js _drawStatue).
        statueColor: '#6a7a5a',
        // Nascente natural com brilho mágico esverdeado, não uma fonte de
        // pedra/água azul comum — mesmo motivo do campo acima (ver city.js
        // _drawFountain).
        fountainColors: { rim: '#4a5a3a', basin: '#2a5a52', jet: 'rgba(180,255,210,0.65)', spout: '#3a2a18' },
        // Muralha viva de madeira/raiz entrelaçada com musgo, não pedra
        // cinza comum — mesmo motivo do campo acima (ver graphics.js
        // _drawCityWall).
        wallColors: { base: 'rgba(74,90,56,0.9)', tower: 'rgba(60,74,44,0.92)' },
        // Floresta densa e vívida fora da muralha, mais rica que a mata
        // padrão — condizente com a própria descrição do Santuário ("entre
        // raízes ancestrais"), ver graphics.js _drawTreeline.
        treelineColor: 'rgba(20,50,26,0.7)'
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
