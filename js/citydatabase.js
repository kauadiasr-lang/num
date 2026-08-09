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
        treelineColor: 'rgba(24,34,22,0.55)',
        // Tingimento do céu (ver graphics.js _blendCityPalette) — mistura
        // uma cor por cima do céu dia/noite normal, em QUALQUER hora do
        // dia, dando "iluminação própria" por cidade (pedido explícito:
        // item de identidade da cidade). Porto Helênico fica `null` — sem
        // tingimento nenhum, céu dia/noite padrão intocado ("natureza
        // equilibrada", nem quente nem fria).
        skyTint: null
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
        // Especialização econômica (ver items.js ItemFactory.
        // generateShopInventory) — Fortaleza Orc tem chance MAIOR (nunca
        // garantida) de vender armas de alta raridade, condizente com
        // "melhor qualidade média em equipamentos ofensivos e armas"
        // pedido explicitamente pelo usuário. Isso NÃO significa que só
        // aqui se encontra uma arma boa — só que a probabilidade aqui é
        // maior que nas outras cidades.
        specialization: ['weapons'],
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
        treelineColor: 'rgba(48,38,26,0.35)',
        // Tingimento do céu (ver porto_helenico.skyTint acima) — laranja-
        // fogo por cima do céu em QUALQUER hora do dia, atendendo ao
        // pedido explícito "a iluminação deve adquirir tons quentes" no
        // território Orc — nunca só um evento pontual, é a identidade
        // permanente do céu desta cidade.
        skyTint: { color: '#ff5a1e', strength: 0.16 }
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
        // Especialização econômica (ver fortaleza_orc.specialization acima
        // pra explicação completa do campo) — amuletos/anéis (categoria
        // `trinkets`, os itens "mágicos" do jogo), condizente com "melhor
        // qualidade média em amuletos, itens mágicos" pedido pelo usuário.
        specialization: ['trinkets'],
        // Identidade econômica própria (Rework Econômico item 10): o
        // prédio 'arcane' (que em toda outra cidade só abre a Árvore de
        // Talentos genérica) vira o ATELIÊ ÉLFICO — mesmo mecanismo
        // genérico `hasMagicSubShop`/`magicSubShopId`/`magicSubShopLabel`
        // criado na Iteração 2 pro Reino Anão (ver ui.js openSkillTree/
        // btn-open-rune-shop), só trocando o rótulo/sub-loja/itens (nunca
        // duplicando o botão ou a lógica de visibilidade — item 16 da
        // diretiva: "reaproveite, expanda, especialize"). Vende
        // componentes mágicos/artefatos élficos (ver items.js
        // ItemDatabase.consumables subShop:'atelier'), nunca metalurgia —
        // reforça a diferença de identidade com a Câmara Rúnica anã
        // (magia arcana/encantamento vs. tecnologia de forja/runa).
        hasMagicSubShop: true,
        magicSubShopId: 'atelier',
        magicSubShopLabel: '✨ Ateliê Élfico (Artefatos)',
        buildingNames: {
            arcane: 'Ateliê Élfico'
        },
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
        treelineColor: 'rgba(20,50,26,0.7)',
        // Tingimento do céu (ver porto_helenico.skyTint acima) — verde-
        // esmeralda por cima do céu em QUALQUER hora do dia, atendendo à
        // paleta pedida explicitamente pra cidade élfica ("verde esmeralda,
        // azul claro, branco dourado").
        skyTint: { color: '#7be8b0', strength: 0.14 }
    },
    // Reino Subterrâneo de Kharzum (4ª Cidade-Hub, pedido explícito do
    // usuário: "cidade dos anões... o lugar MAIS PERIGOSO do mundo
    // atual... NÃO uma cópia da estrutura das cidades existentes"). Ao
    // contrário das 3 cidades acima (todas ao ar livre, mesmo layout de 9
    // prédios só reskinado), esta é subterrânea — escavada dentro de uma
    // montanha, sem chuva/tempestade nenhuma possível (ver `weather`
    // abaixo) e com `buildingNames`/`buildingIcons`/`buildingColors`
    // (ver city.js `_syncBuildingsToCity`, mecanismo NOVO nesta
    // atualização) reflavorando cada prédio civil pra função/cultura anã
    // — sem duplicar o array de prédios das outras cidades, só
    // sobrepondo nome/ícone/cor em cima da MESMA posição/colisão de
    // sempre. `unlockLevel`/`travelCost` mais altos que qualquer cidade
    // existente (10/380 vs o teto anterior de 6/220 do Santuário Élfico)
    // — condizente com "a cidade mais difícil de evoluir" pedida.
    reino_anao: {
        id: 'reino_anao',
        name: 'Reino Subterrâneo de Kharzum',
        description: 'Escavado nas profundezas de uma cordilheira inteira — túneis, pontes de corrente, minas ativas e forjas que nunca esfriam. Nenhuma muralha aqui protege quem não sabe se defender: o próprio Reino cobra esse preço todos os dias.',
        unlockLevel: 10,
        travelCost: 380,
        // Família de bioma da Estrada (ver porto_helenico.roadFamily acima e
        // road.js ZONE_FAMILY_STAGES.anao) — "Trilhas de Pedra" → "Portal da
        // Montanha", a travessia terrestre até a entrada da mina.
        roadFamily: 'anao',
        // Estilo de arquitetura (ver porto_helenico.buildingStyle acima) —
        // alvenaria de pedra maciça + pilares de ferro com friso rúnico
        // incandescente + correntes penduradas + telhado plano de laje com
        // brilho de forja na borda (ver city.js _bakeBuildingShellAnao),
        // distinto tanto do mármore grego quanto do ferro bruto orc quanto
        // da madeira viva élfica.
        buildingStyle: 'anao',
        // Substitui o céu aberto por um teto de caverna de verdade (ver
        // graphics.js _drawSky/_drawCavernCeiling) — sem sol, lua, nuvens
        // ou pássaros, só rocha escura + pontos de brilho de cristal/tocha.
        // NUNCA usado pela Arena de combate (Duelo Rápido continua podendo
        // sortear um bioma ao ar livre, ver `arenaBiomes` abaixo) — só a
        // Cidade explorável em si é subterrânea.
        isUnderground: true,
        // Veios de Minério físicos na Praça (ver city.js
        // _spawnOreVeinsIfNeeded/items.js ItemDatabase.materials) — a base
        // de recursos do sistema de Forja (próxima iteração desta mesma
        // atualização). Nenhuma das outras 3 cidades tem esse campo, então
        // continuam sem nenhum veio, como sempre.
        hasOreVeins: true,
        // Prédio 'blacksmith' abre a tela de Forja (ver js/forge.js/ui.js
        // openForge) em vez da loja padrão de armas — economia baseada em
        // produção, não em "abrir loja → comprar da lista" (pedido
        // explícito do usuário, item 8 da especificação).
        hasForge: true,
        // Especialização econômica (ver fortaleza_orc.specialization acima
        // pra explicação completa do campo) — armaduras E escudos
        // (defensivos), condizente com "melhor qualidade média em
        // armaduras, equipamentos defensivos e itens provenientes de
        // forja" pedido explicitamente pelo usuário.
        specialization: ['armors', 'shields'],
        // Prédio 'armorer' vira o Negociante de Minérios de verdade (ver
        // city.js interact/ui.js openOreTrader) — comércio de matéria-
        // prima, não a loja de equipamento padrão. Pedido explícito do
        // usuário: "a cidade dos anões NÃO deve possuir lojas iguais às
        // outras".
        hasOreTrader: true,
        // Prédio 'arcane' (Câmara Rúnica, ver buildingNames abaixo) continua
        // abrindo a MESMA Árvore de Talentos de qualquer cidade (Rework
        // Econômico item 8: "não remova mecânica importante sem substituir
        // por algo melhor" — Mutação não tem equivalente em runas ainda) —
        // mas agora com um botão extra dentro da própria tela (ver
        // ui.js openSkillTree/index.html #btn-open-rune-shop) que abre a
        // sub-loja de runas consumíveis de efeito fixo (ver items.js
        // ItemDatabase.consumables subShop:'runes'). Mecanismo genérico
        // `hasMagicSubShop`/`magicSubShopId`/`magicSubShopLabel` (ver
        // também santuario_elfico.hasMagicSubShop, Iteração 3) — o MESMO
        // botão/lógica de visibilidade serve qualquer cidade com sub-loja
        // mágica própria, só trocando rótulo/subShop/itens (item 16 da
        // diretiva: nunca duplicar sistema). Nas outras cidades sem essa
        // flag, a Câmara Arcana continua exatamente como sempre foi.
        hasMagicSubShop: true,
        magicSubShopId: 'runes',
        magicSubShopLabel: '🔮 Câmara Rúnica (Runas)',
        // Bandidos anões (ver city.js _eventDwarfBandit/_makeBandit) —
        // "a cidade não deve ser segura" pedido explicitamente pelo
        // usuário. Entra no MESMO sorteio ponderado de eventos ambientes
        // que já rege Mercador Viajante/Ladrão/Duelista/etc (ver
        // _updateRandomEvents) — nunca um timer paralelo, mesma cadência
        // (~50-100s) e mesma competição por peso contra os outros ~15
        // eventos possíveis, garantindo frequência equilibrada sem
        // precisar de nenhuma lógica de "não repetir demais" nova.
        hasBandits: true,
        // `forja_anao` (ver graphics.js ARENA_BIOMES) é a identidade visual
        // PRÓPRIA da arena do Reino Anão, adicionada nesta iteração.
        // `officialArenaBiome` é SEMPRE o bioma de fato usado em toda luta
        // desta cidade (ver graphics.js resetForNewBattle — "cada arena
        // possui UM cenário oficial, nunca alterna aleatoriamente"), então
        // 'vulcanica'/'montanhas'/'ruinas' aqui em `arenaBiomes` não são
        // mais sorteados; servem só como lista de compatibilidade temática
        // (validada em main.js) e fallback caso `officialArenaBiome` algum
        // dia fique indefinido. Antes desta mudança, `officialArenaBiome`
        // apontava pra 'montanhas' — o MESMO bioma que a Fortaleza Orc usa
        // em seu próprio `arenaBiomes` — deixando a arena "oficial" do
        // Reino Anão visualmente indistinguível da Fortaleza Orc.
        arenaBiomes: ['forja_anao', 'vulcanica', 'montanhas', 'ruinas'],
        officialArenaBiome: 'forja_anao',
        arenaName: 'Fosso do Martelo',
        // Subterrâneo — chuva/tempestade não fazem sentido físico aqui
        // (ver city.js _updateWeather, que só sabe sortear entre
        // 'clear'/'rain'); 0% em ambos os campos nunca deixa o clima sair
        // do estado neutro nesta cidade, sem precisar ensinar
        // _updateWeather sobre um terceiro estado "subterrâneo" novo.
        weather: { rainChance: 0, stormChance: 0 },
        raceDemographics: { anao: 75, orc: 10, humano: 8, elfo: 4, ateniense: 3 },
        accentColor: '#4a5a68', // aço/ferro azulado, frio, distinto do cobre/ferrugem orc
        // Piso de pedra escura de caverna, quase sem luz própria — mesmo
        // motivo do campo acima (ver Fortaleza Orc/Santuário Élfico).
        groundColors: ['#3a3a42', '#1c1c22'],
        // Estalagmite com veio de cristal (borda) + aglomerado de cristais
        // brutos brilhantes (centro) — NUNCA planta/árvore, coerente com
        // "subterrâneo" (ver city.js _paintVegetation, tipos novos
        // 'stalagmite'/'crystalCluster').
        vegetationTypes: { edge: 'stalagmite', center: 'crystalCluster' },
        // Estátuas de granito escuro entalhado — mesmo motivo do campo
        // acima (ver city.js _drawStatue).
        statueColor: '#5a5560',
        // A "fonte" central vira um braseiro de metal fundido — mesmo
        // motivo do campo acima (ver Fortaleza Orc, que já reinterpreta o
        // mesmo slot como brasas; aqui é metal líquido de forja, não fogo
        // de guerra).
        fountainColors: { rim: '#2a2622', basin: '#7a2e10', jet: 'rgba(255,150,60,0.8)', spout: '#1a1613' },
        // Muralha/torres de pedra de montanha escura, mais fria e maciça
        // que a pedra vulcânica orc — mesmo motivo do campo acima.
        wallColors: { base: 'rgba(40,38,44,0.94)', tower: 'rgba(30,28,34,0.96)' },
        // Sem floresta nenhuma lá fora (é uma montanha) — a mesma "silhueta
        // de fundo" vira a escuridão profunda da caverna, não uma cor de
        // copa de árvore (ver graphics.js drawCityBackdrop/_drawTreeline).
        treelineColor: 'rgba(15,15,20,0.75)',
        // Tingimento do céu (ver porto_helenico.skyTint acima) — azul-aço
        // frio por cima do céu em QUALQUER hora do dia, simulando a luz de
        // cristais bioluminescentes/tochas distantes numa caverna sem sol
        // de verdade, nunca o calor alaranjado orc nem o verde-esmeralda
        // élfico.
        skyTint: { color: '#385a7a', strength: 0.22 },
        // Reflavor dos MESMOS 9 prédios civis de sempre (posição/colisão
        // idênticas — ver city.js this._defaultBuildings/_syncBuildingsToCity)
        // — NUNCA duplica o array de prédios, só sobrepõe nome/ícone/cor por
        // id. Pedido explícito do usuário: "a cidade deve parecer construída
        // pelos anões" mesmo nos prédios civis reaproveitados (Banco vira
        // Tesouraria escavada na rocha, Taverna vira Salão da Cervejaria
        // etc) — a ARENA e o comércio de verdade (Forja/matéria-prima)
        // ficam pra iterações seguintes deste /loop (ver TaskCreate #187/#188).
        buildingNames: {
            arena: 'Fosso do Martelo', blacksmith: 'Ferreiro', armorer: 'Negociante de Minérios',
            arcane: 'Câmara Rúnica', tavern: 'Salão da Cervejaria', bank: 'Tesouraria da Montanha',
            house: 'Sua Câmara', halloffame: 'Salão dos Campeões', questboard: 'Quadro de Contratos'
        },
        buildingIcons: {
            arena: '⚒️', armorer: '⛏️', tavern: '🍖'
        },
        buildingColors: {
            arena: { wall: '#4a4650', roof: '#6a3a1a' },
            blacksmith: { wall: '#4a4650', roof: '#6a3a1a' },
            armorer: { wall: '#4a4650', roof: '#5a5a62' },
            arcane: { wall: '#3a4650', roof: '#4a5a68' },
            tavern: { wall: '#4a4650', roof: '#7a4a2a' },
            bank: { wall: '#5a5560', roof: '#4a5a68' },
            halloffame: { wall: '#5a5560', roof: '#6a3a1a' },
            house: { wall: '#4a4650', roof: '#5a5a62' },
            questboard: { wall: '#4a4650', roof: '#5a5a62' }
        }
    }
};
window.CityDatabase = CityDatabase;

// ID da cidade padrão — usado como fallback para saves antigos (sem
// `player.currentCityId`) e como cidade inicial de personagens sem raça
// mapeada em RACE_HOME_CITY (ver logo abaixo).
window.DEFAULT_CITY_ID = 'porto_helenico';

// Item 18 da revisão profunda ("cidades de spawn por povo/cultura"): cada
// raça escolhida na Criação de Personagem nasce na cidade coerente com sua
// própria demografia (ver `raceDemographics` de cada cidade acima) — um Orc
// nasce na Fortaleza Orc (78% orc), um Elfo no Santuário Élfico (70% elfo),
// em vez de todo personagem novo, de qualquer raça, começar sempre em Porto
// Helênico. As 5 culturas humanas (humano/espartano/ateniense/cretense/
// tebano) continuam todas nascendo em Porto Helênico, que é 100% delas.
//
// Anão agora nasce no Reino Subterrâneo de Kharzum (75% anão, ver acima) —
// antes (Cidades-Hub Regionais, quando só existiam 3 cidades) usava a
// Fortaleza Orc como lar por falta de opção melhor (10% de presença anã na
// demografia orc); a nova 4ª cidade é o lar de verdade. Um Anão nível 1
// nascendo direto numa cidade de unlockLevel 10 é seguro (mesmo mecanismo
// já usado por Orc/Elfo: ui.js finishCreation seta `visitedCityIds` na
// hora, então o gate de nível de CityEngine.travelToCity nunca bloqueia a
// cidade natal do próprio personagem).
window.RACE_HOME_CITY = {
    humano: 'porto_helenico',
    espartano: 'porto_helenico',
    ateniense: 'porto_helenico',
    cretense: 'porto_helenico',
    tebano: 'porto_helenico',
    orc: 'fortaleza_orc',
    anao: 'reino_anao',
    elfo: 'santuario_elfico'
};

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
