/**
 * Mundo da Estrada (Fase 2 — mínimo; Fase 3 — biomas graduais;
 * Fase 4 — eventos físicos + encontros) — Arena of Blades
 *
 * Substitui o loop de dados-por-etapa (js/roads.js RoadSystem.advance/
 * _rollEvent) por um mundo real onde o jogador anda de verdade (WASD/
 * clique, câmera de verdade via js/camera.js) da cidade de origem até a
 * de destino. Reaproveita o mesmo PlayerController (js/playercontroller.js)
 * usado pela Praça — mesma física de movimento, mundo diferente.
 *
 * Biomas (Fase 3): a travessia é dividida em zonas nomeadas com densidade
 * de vegetação crescente. A cor de fundo continua uma mistura CONTÍNUA
 * entre a paleta de origem/destino (ver draw()) — as zonas mudam
 * densidade/nome/cor de vegetação em DEGRAUS ao longo do caminho, nunca a
 * cena inteira de uma vez, então a travessia sente uma transição gradual
 * "Cidade Principal → Campos → Bosque → território do destino", nunca um
 * corte instantâneo.
 *
 * Identidade por par-de-cidade (auditoria desta iteração): a travessia
 * VIRTUAL (Expedição à Floresta Ancestral, `toId` sem entrada em
 * CityDatabase) continua com o gabarito genérico ZONE_TEMPLATE — ela não
 * pertence a nenhuma facção, então não tem "família" nenhuma por design.
 * Já uma travessia REAL entre duas cidades usa `roadFamily` (ver
 * citydatabase.js, ex. porto_helenico='natureza', fortaleza_orc='orc',
 * santuario_elfico='elfico') pra montar zonas que combinam as DUAS
 * pontas: as duas primeiras zonas pertencem à família de ORIGEM, as duas
 * últimas à família de DESTINO (ver ZONE_FAMILY_STAGES/start()) — assim
 * sair de Porto Helênico rumo à Fortaleza Orc mostra "Campos"/"Bosque
 * Verdejante" na primeira metade e "Terras Ressecadas"/"Rochas
 * Vulcânicas" (nome + cor de vegetação avermelhada/seca) na segunda,
 * nunca a mesma mata genérica não importa o destino.
 *
 * Eventos físicos (Fase 4): objetos de mundo (mercador, baú, esconderijo,
 * fogueira, carroça quebrada) espalhados pela travessia — o jogador anda
 * até perto e decide interagir (tecla E / toque no aviso) ou seguir andando,
 * nunca um pop-up automático (ver _generateEvents/_resolveEvent). Bandidos
 * são um objeto físico HOSTIL: patrulham um pequeno trecho e disparam uma
 * batalha de verdade (reaproveita ui.js startBattle) se o jogador chegar
 * perto — contorná-los (ficar fora do raio de detecção) é a forma de evitar
 * a luta, exatamente como pedido ("atacar, fugir, contornar, ignorar").
 * Vitória retoma a travessia na mesma posição (ver ui.js onRoadWorldEncounter/
 * btn-return-hub); derrota encerra a viagem, mesmo padrão já usado pela
 * antiga emboscada de roads.js.
 *
 * A Expedição à Floresta Ancestral (ligada a Natureza/Corrupção)
 * continua no sistema antigo (js/roads.js RoadSystem + tela screen-road)
 * até a migração física dela na Fase 5.
 *
 * Correção pós-Fase-5 (bugs reportados pelo usuário via vídeo): (1)
 * #screen-roadworld não estava na lista de telas com fundo transparente em
 * css/style.css — o canvas desenhava tudo certo, mas ficava escondido atrás
 * de um fundo opaco (ver css/style.css); (2) o movimento aqui era hard-snap
 * (via PlayerController, pensado pra Praça) — agora ACCEL/DECEL/_approach
 * dão aceleração/frenagem de verdade, só nesta engine (ver ACCEL/DECEL/
 * _updateMovement); (3) a câmera usava Camera.follow() (hard-snap) — agora
 * _updateCamera suaviza exponencialmente e escreve Camera.x/y direto; (4)
 * início/fim de cidade ganharam um portão de verdade (área de transição +
 * arco, ver _drawCityGate) no lugar da linha nua; (5) o jogador ganhou uma
 * animação de caminhada procedural (ver _drawPlayer); (6) um HUD de
 * progresso (#roadworld-progress) mostra % do caminho percorrido.
 *
 * Fase 6 (mundo vivo ambiente) + Fase 7 (performance/chunking): viajantes,
 * caravanas, animais e patrulhas (ver AMBIENT_TYPES/_drawAmbientLife) —
 * puramente decorativos (nunca bloqueiam, nunca colidem, nunca entram em
 * _events), com posição calculada a partir do tempo (performance.now()) e
 * de um hash determinístico por chunk, nunca guardada num array — o mesmo
 * princípio já usado pela vegetação esparsa (ver draw()): custo por frame
 * proporcional só aos chunks visíveis perto da câmera (Camera.isVisible),
 * nunca ao WORLD_LENGTH inteiro, então a estrada continua tão rápida com
 * poucos NPCs quanto com centenas espalhados pelos 63000 de mundo.
 */
window.RoadEngine = {
    WORLD_LENGTH: 63000, // ~5min andando contínuo a pé (walkSpeed=210px/s * 300s)
    LANE_HALF_HEIGHT: 140, // faixa caminhável acima/abaixo da linha central da estrada
    INTERACT_RADIUS: 60, // distância pra mostrar o aviso de interação (eventos pacíficos)
    BANDIT_DETECT_RADIUS: 75, // distância pra disparar a emboscada automaticamente
    BANDIT_PATROL_RANGE: 150, // quanto o bandido anda de cada lado do seu ponto de origem

    // Marcos de terreno puramente visuais (pedido explícito do usuário na
    // seção "EXPLORAÇÃO ENTRE CIDADES": "rios", "árvores gigantes" — o mapa
    // NÃO deve parecer um corredor uniforme) — ver _drawRiverCrossing/
    // _drawGiantTrees. Nunca colidem, nunca entram em `_events` (são
    // paisagem, não interação), então não competem com bandido/mercador/
    // baú etc. Vale tanto pra travessia real entre cidades quanto pra
    // Expedição à Floresta Ancestral (que já é descrita como tendo "raízes
    // gigantes"/"cachoeiras" — as mesmas silhuetas combinam com os dois).
    RIVER_X_FRAC: 0.55, // fração do WORLD_LENGTH onde o rio cruza a estrada
    GIANT_TREE_SPACING: 2600, // bem mais esparso que a vegetação normal (220) — são marcos raros, não decoração de fundo
    CAMP_SPACING: 5200, // acampamentos — mais esparsos ainda que as árvores gigantes (cenário raro, não repetitivo)
    CLEARING_SPACING: 4400, // clareiras — trechos de chão mais claro/aberto entre a vegetação, pedido explícito ("clareiras")
    TOWER_SPACING: 7800, // torres de vigia de fronteira — mais raras ainda que os acampamentos, marco único por travessia na maioria das rotas curtas
    LOG_MUSHROOM_SPACING: 480, // troncos caídos/cogumelos — mais comuns que os marcos raros acima, decoram o caminho sem virar repetição (pedido explícito: "espalhe naturalmente pelo caminho: troncos caídos; cogumelos")
    LEAF_DECAL_SPACING: 150, // folhas caídas no chão — mais comuns ainda que troncos/cogumelos (clutter de chão, não marco), podem cair dentro da faixa caminhável inteira (pedido explícito da seção "Caminho": "folhas caídas")

    // Movimento suave (pedido do usuário: "evitar mudanças instantâneas de
    // direção") — a velocidade REAL (p.vx/p.vy) persegue a velocidade-alvo
    // (WASD/clique) em vez de saltar pra ela, ver _approach/update(). Essa
    // lógica fica só aqui (RoadEngine-local), nunca em PlayerController —
    // a Praça continua com o movimento rígido original, intocado.
    ACCEL: 900, // px/s² ao acelerar (sair do zero ou mudar de direção)
    DECEL: 1400, // px/s² ao soltar as teclas/chegar no alvo — freia mais rápido do que acelera, sensação mais natural
    CAMERA_SMOOTH_TIME: 0.12, // constante de tempo da câmera suavizada (ver update()) — quanto menor, mais "grudada" no jogador
    GATE_ZONE_RADIUS: 130, // largura da área de transição desenhada em volta de cada portão de cidade (ver _drawCityGate)
    // Escala do personagem na Estrada (ver _drawPlayer) — mesmo valor
    // PLAYER_EXTRA_SHRINK usado por city.js na Praça (ver
    // CityEngine.PLAYER_EXTRA_SHRINK), garantindo que o jogador tenha
    // exatamente o mesmo "tamanho visual" andando pela Estrada ou pela
    // Praça — nunca um personagem diferente ou desproporcional.
    PLAYER_SCALE: 0.4,

    // Paletas de céu por horário (mesmas 4 fases do relógio global, ver
    // CityEngine.dayPhases/window.GFX.arenaTime) — antes o céu da Estrada
    // era sempre a mesma cor de dia fixa, mesmo viajando de noite.
    SKY_PALETTES: {
        dawn: ['#2b3a67', '#f2b866'],
        day: ['#5f96d9', '#9fc3e8'],
        sunset: ['#1b1035', '#e8843f'],
        night: ['#04050f', '#1c2140']
    },

    // Mundo vivo ambiente (Fase 6) — cada "chunk" de mundo (unidade de
    // geração/culling, não um pedaço de save) tem uma chance de conter UMA
    // entidade decorativa entre os tipos pedidos no design (viajante a
    // pé, caravana, animal, patrulha de guarda, gladiador rival — este
    // último acrescentado no Ciclo 22, "outros gladiadores podem estar
    // viajando"). Nunca colide com o jogador, nunca interrompe a
    // travessia — só "vida" ao fundo (ver _drawAmbientLife).
    AMBIENT_CHUNK_SIZE: 2500,
    AMBIENT_SPAWN_CHANCE: 55, // % dos chunks que têm alguma entidade (de 0 a 100, ver _hash)
    AMBIENT_TYPES: ['npc_traveler', 'caravan', 'animal', 'patrol', 'rival_gladiator'],

    // Gabarito genérico de zonas — usado SÓ pela Expedição à Floresta
    // Ancestral (destino virtual, sem `roadFamily` — ela não pertence a
    // nenhuma facção). O nome da última é preenchido em start() com o
    // nome da cidade de destino ("Arredores de X"), as outras três são
    // sempre as mesmas (mato rasteiro → mato mais denso → floresta
    // fechada verde-mística), independente de quais cidades estão ligadas.
    // Travessias REAIS entre cidades usam ZONE_FAMILY_STAGES abaixo.
    ZONE_TEMPLATE: [
        { name: 'Campos', vegDensity: 1.0, vegColor: 'rgba(20,40,15,0.55)' },
        { name: 'Bosque', vegDensity: 1.4, vegColor: 'rgba(20,40,15,0.55)' },
        { name: 'Floresta', vegDensity: 1.9, vegColor: 'rgba(20,40,15,0.55)' },
        { name: null, vegDensity: 1.2, vegColor: 'rgba(20,40,15,0.55)' } // nome real vem de start()
    ],

    // Duas etapas nomeadas + coloridas por família de bioma (ver
    // citydatabase.js `roadFamily`) — usadas em start() pra montar as
    // zonas de uma travessia REAL entre cidades (nunca a Expedição à
    // Floresta, que é virtual e usa ZONE_TEMPLATE). Cada família cobre
    // METADE do caminho a partir da sua ponta (origem ou destino), então
    // o jogador vê a paisagem mudar gradualmente de uma identidade pra
    // outra em vez de um corte instantâneo entre cidades. Pedido do
    // usuário ("grama seca, pedras escuras, terra avermelhada" pro
    // território Orc; "vegetação viva, verde esmeralda" pro território
    // Élfico) — cor aqui é só da vegetação esparsa da estrada (ver draw());
    // o gradiente contínuo de chão já existia antes e continua intocado.
    ZONE_FAMILY_STAGES: {
        natureza: [
            { name: 'Campos', vegColor: 'rgba(20,60,20,0.55)' },
            { name: 'Bosque Verdejante', vegColor: 'rgba(15,50,18,0.6)' }
        ],
        orc: [
            { name: 'Terras Ressecadas', vegColor: 'rgba(95,70,35,0.55)' },
            { name: 'Rochas Vulcânicas', vegColor: 'rgba(60,35,25,0.6)' }
        ],
        elfico: [
            { name: 'Trilha Élfica', vegColor: 'rgba(45,150,110,0.5)' },
            { name: 'Bosque Luminoso', vegColor: 'rgba(70,210,160,0.45)' }
        ]
    },

    // Tipos de evento pacífico — o bandido (hostil) não entra aqui porque
    // não tem aviso de interação nenhum, ver _updateBandits. `traveler`
    // (Fase 5 — missões de viagem) oferece uma missão de verdade ao
    // interagir (ver _resolveEvent), reaproveitando QuestFactory/
    // QuestSystem já existentes (só muda ONDE a missão é oferecida — pelo
    // quadro da cidade OU por um viajante encontrado na estrada).
    EVENT_TYPES: {
        merchant: { icon: '🧺', label: 'Negociar com o comerciante' },
        chest: { icon: '📦', label: 'Abrir baú' },
        secret: { icon: '💰', label: 'Investigar o esconderijo' },
        campfire: { icon: '🔥', label: 'Descansar na fogueira' },
        cart: { icon: '🛒', label: 'Examinar a carroça quebrada' },
        traveler: { icon: '🧳', label: 'Conversar com o viajante' },
        // Marcos físicos explicitamente pedidos pelo usuário ("ruínas,
        // cavernas, pontes, pequenos templos") — mesma arquitetura de
        // evento pacífico (aviso de interação, nunca pop-up), só com
        // recompensa/flavor própria por tipo (ver _resolveEvent).
        ruins: { icon: '🏛️', label: 'Explorar as ruínas antigas' },
        cave: { icon: '🕳️', label: 'Entrar na caverna escura' },
        bridge: { icon: '🌉', label: 'Atravessar a ponte de pedra' },
        shrine: { icon: '⛩️', label: 'Rezar no pequeno templo' },
        // Colecionáveis (pedido explícito do usuário: "colecionáveis, pedras
        // mágicas, livros") — nunca competem com o loot comum (chest/ruins
        // dão equipamento, secret/cave dão ouro); a recompensa aqui é
        // NARRATIVA (ver LORE_ENTRIES/_resolveEvent), registrada num
        // contador permanente no Player (magicStonesFound/loreBooksFound),
        // salvo automaticamente pelo mesmo SaveManager.save genérico que já
        // persiste qualquer campo novo do Player sem precisar de migração.
        magic_stone: { icon: '🔮', label: 'Recolher a pedra mágica' },
        lore_book: { icon: '📖', label: 'Ler o livro esquecido' },
        // Tesouro escondido — SÓ existe na parte alargada de uma clareira
        // (ver _laneHalfHeightAt/Ciclo 12), nunca na faixa normal da
        // estrada. Recompensa própria (melhor que os equivalentes comuns)
        // como incentivo de verdade pra "sair da estrada" pedido pelo
        // usuário, não só decoração — ver _generateClearingTreasures.
        clearing_treasure: { icon: '💎', label: 'Cavar o tesouro escondido' },
        // "Gladiador ferido" — item explícito da lista original de eventos
        // do usuário ("carroça quebrada, comerciante parado, ..., gladiador
        // ferido, altar antigo, animal raro, ...") que ainda não tinha
        // ganho um evento próprio. Reaproveita GFX.drawGladiator com anim
        // 'hurt' (mesma pose já usada em batalha, ver _drawEventIcon) em
        // vez de inventar uma pose nova — nunca um emoji/placeholder.
        wounded_gladiator: { icon: '🩹', label: 'Ajudar o gladiador ferido' },
        // "Animal raro" — último item ainda pendente da lista original de
        // eventos do usuário. Diferente do 'animal' AMBIENT_TYPES comum
        // (genérico, some ao fundo, nunca interativo), este é um evento
        // físico de verdade: geometria própria (cervo pálido/dourado com
        // brilho, ver _drawEventIcon) e recompensa narrativa, nunca um
        // emoji/placeholder.
        rare_animal: { icon: '🦌', label: 'Observar o animal raro' },
        // "Árvore oca" — item explícito da lista de objetos da Reformulação
        // da Floresta ("árvores ocas, ruínas antigas, altares esquecidos");
        // ruins/shrine já existiam, árvore oca ainda faltava. Geometria
        // própria (tronco grosso com um buraco escuro na base, ver
        // _drawEventIcon) — nunca um emoji/placeholder.
        hollow_tree: { icon: '🌳', label: 'Explorar a árvore oca' }
    },
    // Tipos de missão oferecidos pelo viajante — ESCORT (Proteção de
    // Comboio), HUNT (Contrato de Caça) e RECOVERY (Item Perdido) cobrem o
    // pedido explícito ("escoltar", "caçar uma criatura", "encontrar um
    // objeto perdido"); COLLECT (Acúmulo de Glória), ARENA (Duelo Marcado),
    // BOUNTY (Recompensa) e DELIVERY (Entrega Urgente) foram adicionados
    // depois pra dar mais variedade — todos completam via duelo/chegada em
    // cidade (nunca "conversar com N habitantes DA CIDADE", que é como
    // INVESTIGATION funciona — não faz sentido narrativo vindo de um
    // viajante encontrado NA ESTRADA, por isso NUNCA entra nesta lista).
    // BOUNTY sem Rival disponível e DELIVERY sem cidade alcançável já caem
    // em HUNT sozinhos dentro de QuestFactory.generate, sem risco de oferta
    // quebrada.
    TRAVELER_QUEST_TYPES: ['ESCORT', 'HUNT', 'RECOVERY', 'COLLECT', 'ARENA', 'BOUNTY', 'DELIVERY'],
    // Trechos de lore descobertos nos livros esquecidos (ver _resolveEvent)
    // — flavor text sobre o mundo (Coliseu, Gorkhal, Sylvaneth, Floresta
    // Ancestral), escolhido de forma determinística pela posição do livro
    // (mesmo hash de sempre), nunca Math.random puro. Ciclo 26 acrescentou
    // mais 6 trechos (mesmo motivo já usado no Ciclo 11 pra
    // TRAVELER_QUEST_TYPES: "mais variedade" reduz a repetição óbvia em
    // travessias longas ou replays) — nenhum outro código precisa mudar,
    // `_hash(...) % LORE_ENTRIES.length` já escala sozinho com o array.
    LORE_ENTRIES: [
        'Um fragmento de crônica antiga fala do primeiro Campeão do Coliseu Imperial, que nunca perdeu um duelo — e desapareceu sem deixar rastro na véspera de enfrentar um desafiante desconhecido.',
        'Uma página amarelada descreve como os orcs de Gorkhal forjam aço sobre rocha vulcânica ainda morna, dizendo que o fogo da montanha "lembra" a forma de cada lâmina.',
        'Um verso élfico fala de Sylvaneth como um lugar onde "o tempo caminha devagar de propósito", e que quem apressa a floresta nunca aprende o que ela tem a ensinar.',
        'Um relato sem autor descreve luzes verdes dançando entre as árvores mais antigas da Floresta Ancestral — "nem amigas, nem inimigas, só antigas demais para se importar".',
        'Uma anotação em tinta apagada adverte: "todo amuleto guarda um preço — alguns cobram na entrega, outros esperam anos para cobrar".',
        'Um trecho de poema fala de uma entidade profana que "só aparece pra quem já provou que não precisa de ajuda nenhuma" — e que aceitar sua oferta muda mais que a aparência.',
        'Um manual de arquivista de Porto Helênico observa que o Coliseu Imperial nunca foi reconstruído duas vezes da mesma forma — cada incêndio ou cerco vira desculpa pra uma arquibancada nova, "como se a cidade tivesse vergonha de ficar parada".',
        'Um diário de caravaneiro registra a mesma frase repetida em três entradas diferentes: "a estrada muda quem anda por ela nem que seja só um pouco — ninguém chega igual a como saiu".',
        'Uma nota de guarda de fronteira reclama que patrulhar a estrada à noite é "vigiar o escuro pra ninguém em particular", já que os bandidos conhecem os horários de ronda melhor que os próprios guardas novatos.',
        'Um pergaminho élfico meio-traduzido descreve como Sylvaneth cresceu ao redor de uma raiz só, tão antiga que "nenhum élfico vivo se lembra de plantá-la nem de vê-la ser plantada".',
        'Um relato desconjuntado de um gladiador aposentado diz que a Ladder de Rivais existe há mais tempo do que qualquer campeão que já a venceu — "os nomes mudam, o topo continua vazio esperando o próximo".',
        'Uma inscrição gasta perto de Gorkhal afirma que todo orc nascido perto da montanha carrega "o calor da forja no sangue", e que por isso raramente sentem frio mesmo em noites de neve.'
    ],

    // Variantes de flavor text (Ciclo 27) — mesmo princípio de LORE_ENTRIES
    // acima e de TRAVELER_QUEST_TYPES (Ciclo 11): cart/bridge/secret
    // sempre mostravam o MESMO toast, palavra por palavra, em toda
    // travessia (diferente de shrine/campfire, que já alternam por
    // estado). Escolhidas de forma determinística por posição (ver
    // _pickFlavor abaixo), nunca Math.random puro.
    CART_LINES: [
        'A carroça quebrada não guarda nada de útil — só madeira estilhaçada.',
        'Um eixo partido e rodas cobertas de mato: essa carroça está aqui há muito mais tempo do que parece.',
        'Restos de uma carga qualquer se perderam entre as tábuas quebradas — nada que valha a pena carregar.'
    ],
    BRIDGE_LINES: [
        'A ponte de pedra range sob seus passos, mas te leva em segurança até o outro lado.',
        'Musgo cobre metade das pedras da ponte, mas a estrutura ainda aguenta seu peso sem hesitar.',
        'De cima da ponte, dá pra ver a água correndo bem mais rápido do que parecia da margem.'
    ],
    SECRET_LINES: [
        'Um esconderijo secreto guarda {gift}g abandonados há muito tempo.',
        'Escondido atrás de pedras soltas, você encontra {gift}g que alguém preferiu esquecer a arriscar buscar de volta.',
        'Um pequeno buraco disfarçado no barranco guarda {gift}g — provavelmente a poupança de alguém que nunca voltou.'
    ],
    // "Árvore oca" (Ciclo 50) — já nasce com variedade desde o início (mesmo
    // princípio de CART_LINES/BRIDGE_LINES/SECRET_LINES, ver _pickFlavor),
    // sem precisar de um ciclo futuro só pra corrigir isso depois.
    HOLLOW_TREE_LINES: [
        'Dentro do tronco oco, você encontra {gift}g escondidos entre as raízes ressecadas.',
        'Um esquilo foge assustado quando você enfia a mão no oco da árvore e encontra {gift}g esquecidos ali dentro.',
        'O interior apodrecido da árvore guarda uma bolsinha de couro com {gift}g, intacta apesar dos anos.'
    ],
    // Ciclo 34 — mesma lacuna do Ciclo 27, só que em 'cave'/'shrine':
    // 'cave' sempre mostrava o MESMO toast (com {gift} variável, mas o
    // texto ao redor nunca mudava); 'shrine' já alternava por estado
    // (curado/não-curado) mas cada estado tinha só UMA linha fixa.
    CAVE_LINES: [
        'No fundo da caverna escura, você encontra {gift}g perdidos há anos.',
        'Entre as pedras úmidas da caverna, uma bolsa apodrecida ainda guarda {gift}g.',
        'O eco da caverna escura esconde um pequeno tesouro esquecido: {gift}g.'
    ],
    SHRINE_HEALED_LINES: [
        'Uma bênção silenciosa do pequeno templo alivia seu corpo — fadiga e ferimentos diminuem.',
        'O ar parado do templo antigo traz um alívio inesperado ao seu corpo cansado.',
        'Uma luz fraca no altar do templo aquece seus ferimentos e sua exaustão por um instante.'
    ],
    SHRINE_FULL_LINES: [
        'Você reza um instante no pequeno templo, mas já está em plena forma.',
        'O templo antigo permanece silencioso — seu corpo já não precisa de bênção nenhuma agora.',
        'Uma pausa breve diante do altar, mas você já chega aqui em plena forma.'
    ],
    // Ciclo 39 — mesma lacuna do Ciclo 34, só que em 'wounded_gladiator':
    // sempre mostrava o MESMO toast fixo (com {xp} variável, mas o texto ao
    // redor nunca mudava).
    WOUNDED_GLADIATOR_LINES: [
        'Você presta socorro ao gladiador ferido. Grato, ele compartilha truques de combate antes de seguir para a cidade mais próxima. +{xp} XP.',
        'O gladiador ferido aceita sua ajuda em silêncio. Antes de partir, ensina uma manobra que aprendeu duramente na Arena. +{xp} XP.',
        'Você amarra um curativo improvisado no gladiador ferido. Ele agradece com um conselho de combate que só quem já sangrou na Arena conhece. +{xp} XP.'
    ],
    // Ciclo 41 — pendência explícita do Ciclo 27: o único toast que
    // sobrava 100% estático (zero conteúdo dinâmico, nem valor numérico)
    // no arquivo inteiro era a "conversa fiada" do viajante quando não há
    // oferta de missão disponível.
    TRAVELER_SMALLTALK_LINES: [
        'O viajante só quer trocar algumas palavras antes de seguir seu caminho.',
        'O viajante comenta o clima da estrada e segue adiante, sem nada de especial a pedir.',
        'Vocês trocam um aceno e algumas palavras sobre a viagem — o viajante segue seu caminho logo em seguida.'
    ],
    // Escolhe uma variante de forma determinística pela posição do evento
    // (mesmo hash de sempre) — o mesmo ponto do mapa sempre mostra a MESMA
    // variante, mas pontos diferentes tendem a mostrar variantes diferentes.
    _pickFlavor(lines, x, salt) {
        return lines[this._hash(Math.floor(x) + salt) % lines.length];
    },
    // Subiu de 6 pra 12 ao adicionar ruins/cave/bridge/shrine/magic_stone/
    // lore_book (12 tipos pacíficos + bandido = 13 no pool de
    // _generateEvents), depois de 12 pra 14 no Ciclo 25 ao perceber que
    // wounded_gladiator (Ciclo 17) e rare_animal (Ciclo 23) elevaram o
    // pool pra 14 tipos pacíficos + bandido = 15 sem nenhum ajuste
    // correspondente aqui — a MESMA regressão que motivou o bump anterior:
    // confirmado deterministicamente que a travessia porto_helenico →
    // fortaleza_orc não sorteava NENHUM bandido com o pool diluído (12
    // slots pra 15 tipos). Mantém a MESMA densidade relativa de marcos por
    // trecho de mundo (o custo por frame continua O(eventos visíveis),
    // nunca O(EVENT_COUNT) sozinho), só evita que um tipo inteiro (incluindo
    // o bandido) nunca apareça numa viagem só por causa do sorteio ter
    // poucos slots pro tamanho do pool.
    EVENT_COUNT: 14, // eventos pacíficos + bandidos espalhados pela travessia inteira

    // Entidades exclusivas da Expedição à Floresta Ancestral (Fase 5, ver
    // _generateForestEncounter) — nunca entram no pool aleatório de
    // _generateEvents (por isso ficam num mapa separado de EVENT_TYPES).
    // `corruption` tem aviso de interação normal (é uma escolha narrativa,
    // nunca uma emboscada); `nature_spirit` não tem — ele é detectado por
    // proximidade igual a um bandido (ver _updateBandits).
    FOREST_EVENT_TYPES: {
        corruption: { icon: '👹', label: 'Uma presença sombria te chama' }
    },

    active: false,
    fromId: null,
    toId: null,
    mode: 'walk',
    player: null,
    _player: null, // { x, y, targetX, targetY, facing, moving, pathQueue }
    keysHeld: null,
    _running: false,
    _fatigueTickEvery: 63000 / 6, // mesma cadência da Fase antiga (6 "etapas" a pé)
    _nextFatigueTickAt: 0,
    _arrived: false,
    _zones: null,
    _zoneLength: 0,
    _lastZoneIndex: -1,
    _events: null,
    _nearEvent: null,
    _weather: 'clear',
    _weatherTimer: 0,
    _isStorm: false,
    _rainSpawnTimer: 0,
    _lightningTimer: 0,

    // Inicia a travessia. `mode` é 'walk' ou 'horse' (custo do cavalo já
    // cobrado por quem chama, ver ui.js startRoadJourney — igual ao
    // RoadSystem antigo). `player` é o Player real (pra fadiga/gold).
    start(fromId, toId, mode, player) {
        this.fromId = fromId;
        this.toId = toId;
        this.mode = mode === 'horse' ? 'horse' : 'walk';
        this.player = player;
        this._player = { x: 40, y: 0, vx: 0, vy: 0, targetX: null, targetY: null, facing: 1, moving: false, pathQueue: [] };
        this.keysHeld = { up: false, down: false, left: false, right: false };
        this._running = false;
        this._nextFatigueTickAt = this._fatigueTickEvery;
        this._arrived = false;
        this.active = true;
        this._nearEvent = null;
        this._playerAnim = null;
        this._lastProgressPct = -1;
        // Clima da travessia (mundo vivo pedido pela mega-diretiva) — mesmo
        // sistema de chuva/tempestade da Praça (ver CityEngine._updateWeather),
        // sempre parte limpo no início de cada viagem.
        this._weather = 'clear';
        this._weatherTimer = Utils.randomFloat(45, 90);
        this._isStorm = false;
        this._rainSpawnTimer = 0;
        this._lightningTimer = 0;
        // Bug corrigido no Ciclo 20 (achado nesta revisão, introduzido pelo
        // próprio Ciclo 18): `_ambientEntityCache` guarda a entidade racial
        // regional do `npc_traveler` ambiente por índice de chunk (ver
        // _drawAmbientHuman), mas nunca era limpo aqui — abandonar uma
        // viagem rumo à Fortaleza Orc e iniciar outra rumo ao Santuário
        // Élfico deixava viajantes ambiente da NOVA travessia com a raça
        // ORC "vazada" da viagem anterior, sempre que o índice de chunk
        // colidisse (bem provável, já que AMBIENT_CHUNK_SIZE é uma
        // constante fixa, independente do WORLD_LENGTH de cada travessia).
        this._ambientEntityCache = {};
        this._ambientAnimCache = {};
        // A câmera parte já centrada na posição inicial do jogador (nunca em
        // 0,0) — evita um "salto"/slide-in visível no primeiro frame da
        // travessia (ponto inicial da cidade de origem precisa continuar
        // exatamente onde o jogador está, sem bug de câmera).
        this._camX = this._player.x;
        this._camY = this._player.y;

        const fromDef = window.CityDatabase[fromId];
        const toDef = window.CityDatabase[toId];
        // A Expedição à Floresta Ancestral (ver roads.js FOREST_EXPEDITION_ID)
        // é um destino VIRTUAL — nunca existe em CityDatabase — então nome
        // de zona/marco de chegada precisam de um nome próprio em vez de
        // `toDef.name` (que seria undefined).
        this._destLabel = toDef ? toDef.name : (toId === window.FOREST_EXPEDITION_ID ? 'Floresta Ancestral' : 'Chegada');
        if (toDef) {
            // Travessia real entre cidades — mistura a família de ORIGEM
            // (primeira metade) com a de DESTINO (segunda metade), ver
            // comentário completo em ZONE_FAMILY_STAGES acima. Fallback pra
            // 'natureza' cobre qualquer cidade futura sem `roadFamily` ainda
            // definido, sem quebrar a travessia.
            const fromFamily = this.ZONE_FAMILY_STAGES[(fromDef && fromDef.roadFamily) || 'natureza'];
            const toFamily = this.ZONE_FAMILY_STAGES[(toDef && toDef.roadFamily) || 'natureza'];
            this._zones = [
                { name: fromFamily[0].name, vegDensity: 1.0, vegColor: fromFamily[0].vegColor },
                { name: fromFamily[1].name, vegDensity: 1.4, vegColor: fromFamily[1].vegColor },
                { name: toFamily[0].name, vegDensity: 1.7, vegColor: toFamily[0].vegColor },
                { name: `Arredores de ${this._destLabel}`, vegDensity: 1.2, vegColor: toFamily[1].vegColor }
            ];
        } else {
            this._zones = this.ZONE_TEMPLATE.map((z, i) => ({
                name: i === this.ZONE_TEMPLATE.length - 1 ? `Arredores de ${this._destLabel}` : z.name,
                vegDensity: z.vegDensity,
                vegColor: z.vegColor
            }));
        }
        this._zoneLength = this.WORLD_LENGTH / this._zones.length;
        this._lastZoneIndex = -1;
        this._updateZoneLabel(0);
        this._generateEvents(fromId, toId);
        this._generateClearingTreasures();
        // Espírito da Natureza / Corrupção (Fase 5, ver
        // docs/superpowers/specs/2026-08-02-explorable-world-travel-design.md)
        // só existem fisicamente na Expedição à Floresta Ancestral — a mesma
        // regra `isForestExpedition` que o antigo roads.js._rollEvent já usava
        // pra garantir (em vez de sortear) esses dois eventos ali.
        if (toId === window.FOREST_EXPEDITION_ID) this._generateForestEncounter(player);
        this._updateInteractPrompt();

        window.Camera.follow(this._player);
    },

    // No máximo UM dos dois pode estar disponível ao mesmo tempo na prática
    // (Corrupção exige a Linhagem da Natureza JÁ descoberta, ver
    // nature.js/corruption.js) — Corrupção checada primeiro só por ser mais
    // "avançada" narrativamente, mesmo critério já usado no roads.js
    // original. Uma vez resolvido (descoberto ou corrompido), nenhum dos
    // dois volta a aparecer (mesmas condições de isEventReady/
    // isDiscoveryAvailable), mas a mata continua com o pool normal de
    // eventos (merchant/chest/bandido/etc, ver _generateEvents).
    _generateForestEncounter(player) {
        const x = this._zoneLength * 2.5; // meio da zona "Floresta" (a mais densa)
        if (window.CorruptionSystem && window.CorruptionSystem.isEventReady(player)) {
            this._events.push({ type: 'corruption', x, y: 0, spawnX: x, consumed: false });
        } else if (window.NatureSystem && window.NatureSystem.isDiscoveryAvailable(player)) {
            this._events.push({ type: 'nature_spirit', x, y: 0, spawnX: x, consumed: false });
        }
    },

    // Posições determinísticas (sem Math.random) espalhadas ao longo da
    // travessia inteira — o mesmo par de cidades sempre gera os mesmos
    // eventos nos mesmos pontos, mas pares diferentes de cidade têm uma
    // "semente" própria (_stringHash de fromId+toId), então a viagem pra
    // Fortaleza Orc não tem exatamente a mesma sequência da viagem pro
    // Santuário Élfico.
    _generateEvents(fromId, toId) {
        const seed = this._stringHash(fromId + '->' + toId);
        // `clearing_treasure` fica de fora do sorteio comum de propósito —
        // ele só pode nascer numa clareira de verdade, na parte ALARGADA da
        // faixa (ver _generateClearingTreasures/_laneHalfHeightAt), nunca
        // na faixa normal onde este sorteio posiciona seus eventos (y=±70,
        // sempre dentro de LANE_HALF_HEIGHT). Continuar no pool geral
        // colocaria o mesmo "tesouro exclusivo de quem sai da estrada" bem
        // no meio do caminho normal, contradizendo o propósito dele.
        const types = Object.keys(this.EVENT_TYPES).filter(t => t !== 'clearing_treasure').concat(['bandit']);
        const segment = this.WORLD_LENGTH / this.EVENT_COUNT;
        this._events = [];
        for (let i = 0; i < this.EVENT_COUNT; i++) {
            const h = this._hash(i * 7 + seed);
            const type = types[h % types.length];
            const x = Utils.clamp(i * segment + segment * 0.5 + (h % 400) - 200, 400, this.WORLD_LENGTH - 400);
            const side = (i % 2 === 0) ? -1 : 1;
            const y = side * 70;
            const ev = { type, x, y, spawnX: x, consumed: false };
            if (type === 'bandit') ev.entity = this._makeBanditEntity(x, fromId, toId);
            else if (type === 'traveler') ev.entity = this._makeTravelerEntity(x, fromId, toId);
            else if (type === 'merchant') ev.entity = this._makeMerchantEntity(x, fromId, toId);
            this._events.push(ev);
        }
        // Garante pelo menos 1 bandido por travessia (achado no Ciclo 25:
        // medindo a distribuição real do sorteio acima, ~40% das
        // travessias não tinham NENHUM bandido, mesmo depois de subir
        // EVENT_COUNT de 12 pra 14 — "bandidos esperando emboscada" é item
        // explícito da lista original do usuário, não pode ficar 100%
        // sujeito à sorte do hash). Só força a conversão quando o sorteio
        // normal não gerou nenhum; a posição forçada é ela própria
        // determinística (baseada no seed da travessia, nunca um índice
        // fixo) pra não criar um padrão óbvio de "o evento X é sempre
        // bandido".
        if (!this._events.some(ev => ev.type === 'bandit')) {
            const forced = this._events[this._hash(seed + 99999) % this.EVENT_COUNT];
            forced.type = 'bandit';
            forced.entity = this._makeBanditEntity(forced.x, fromId, toId);
        }
    },

    _stringHash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
        return h;
    },

    _zoneIndexAt(x) {
        return Utils.clamp(Math.floor(x / this._zoneLength), 0, this._zones.length - 1);
    },

    _updateZoneLabel(zoneIdx) {
        const el = document.getElementById('roadworld-zone');
        if (el && this._zones[zoneIdx]) el.innerText = this._zones[zoneIdx].name;
    },

    // Hash determinístico (sem Math.random) — mesma vegetação sempre
    // aparece no mesmo ponto do mundo, geração sempre reproduzível.
    // Sempre retorna 0-99: `^` no JS opera em int32 SIGNED, então sem o
    // `>>> 0` final `x % 100` podia sair negativo (ex.: entradas cujo hash
    // cai na metade "negativa" do int32) — isso corrompia índices de
    // array em qualquer chamador (`types[h % types.length]`,
    // `AMBIENT_TYPES[...]` etc. viravam `undefined` sempre que o hash desse
    // negativo, sem nenhum erro visível, só um ícone/tipo faltando).
    _hash(i) {
        let x = (i * 2654435761) >>> 0;
        x ^= x >>> 15;
        return (x >>> 0) % 100;
    },

    abandon() {
        this.active = false;
        this.player = null;
        this._player = null;
    },

    _isActive() {
        return this.active && window.Engine && window.Engine.state.screen === 'ROADWORLD';
    },

    // Impacto visual da corrupção (pedido do usuário) — true enquanto o
    // monstro das sombras que corrompe a Floresta Ancestral (evento
    // `nature_spirit`, ver _generateForestEncounter) ainda existir e não
    // tiver sido derrotado. Nunca guarda estado próprio: lida sempre fresco
    // a partir de `_events`, então volta ao normal sozinho assim que o
    // evento for consumido (vitória) — sem precisar zerar nada explicitamente.
    _isForestCorrupted() {
        return this.toId === window.FOREST_EXPEDITION_ID
            && this._events.some(ev => ev.type === 'nature_spirit' && !ev.consumed);
    },

    _speed() {
        // A cavalo é mais rápido que a pé (mesma proporção do antigo
        // ROAD_STEPS_HORSE/ROAD_STEPS_WALK = 4/6); correr (Shift) multiplica
        // por cima de qualquer um dos dois modos, ande por WASD ou clique.
        const base = this.mode === 'horse' ? 210 * 1.5 : 210;
        return this._running ? base * 1.6 : base;
    },

    handleKey(e, isDown) {
        if (!this._isActive()) return;
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': this.keysHeld.up = isDown; break;
            case 'ArrowDown': case 's': case 'S': this.keysHeld.down = isDown; break;
            case 'ArrowLeft': case 'a': case 'A': this.keysHeld.left = isDown; break;
            case 'ArrowRight': case 'd': case 'D': this.keysHeld.right = isDown; break;
            case 'Shift': this._running = isDown; break;
            case 'e': case 'E':
                if (isDown && this._nearEvent) this._resolveEvent(this._nearEvent);
                break;
            default: return;
        }
    },

    // Clique-pra-andar (sem obstáculos ainda nesta fase — ver Fase 4 pra
    // objetos físicos colidíveis) — só clampa dentro da faixa caminhável.
    handleClick(worldX, worldY) {
        if (!this._isActive()) return;
        // Valida contra a faixa NO PONTO CLICADO (nunca a faixa de onde o
        // jogador está agora) — clicar bem no meio de uma clareira distante
        // pra ficar em pé na beirada alargada dela (y até LANE_HALF_HEIGHT+60,
        // ver _laneHalfHeightAt) não pode ser recusado só porque a faixa é
        // mais estreita perto de onde o jogador está parado agora; o
        // trajeto em si continua clampado quadro a quadro pela faixa de
        // cada ponto percorrido (ver _updateMovement), então nunca atravessa
        // uma parede invisível no meio do caminho.
        const bounds = this._bounds(worldX);
        this._player.targetX = Utils.clamp(worldX, bounds.minX, bounds.maxX);
        this._player.targetY = Utils.clamp(worldY, bounds.minY, bounds.maxY);
        this._player.pathQueue = [];
    },

    _bounds(x = this._player.x) {
        const half = this._laneHalfHeightAt(x);
        return { minX: 0, maxX: this.WORLD_LENGTH, minY: -half, maxY: half };
    },

    // Clareiras alargam a faixa caminhável DE VERDADE (pedido do usuário:
    // "sair da estrada, entrar na floresta" durante a exploração) — antes
    // eram só decoração visual (um brilho mais largo que a faixa andável,
    // ver _drawClearings), sem nenhum efeito em onde o jogador podia
    // realmente pisar; a faixa ficava sempre com a mesma largura fixa
    // (LANE_HALF_HEIGHT) o mapa inteiro. Reaproveita o MESMO cálculo
    // determinístico de _drawClearings (mesmo spacing/hash/raio), então a
    // faixa alargada sempre corresponde exatamente ao brilho já desenhado
    // no chão — nunca um espaço "invisível" liberado nem uma parte do
    // brilho que continua bloqueada.
    _laneHalfHeightAt(x) {
        const spacing = this.CLEARING_SPACING;
        const i = Math.round(x / spacing);
        const clx = i * spacing;
        if (clx < 300 || clx > this.WORLD_LENGTH - 300) return this.LANE_HALF_HEIGHT;
        if (this._hash(i * 61 + 13000) >= 45) return this.LANE_HALF_HEIGHT;
        if (Math.abs(x - clx) > 220) return this.LANE_HALF_HEIGHT;
        return this.LANE_HALF_HEIGHT + 60;
    },

    // Tesouro escondido nas clareiras (incentivo real de exploração, ver
    // _laneHalfHeightAt acima) — varre os MESMOS índices de clareira que
    // _drawClearings/_laneHalfHeightAt usam (nunca reinventa o sorteio),
    // mas só uma fração delas (hash extra) ganha um tesouro de verdade,
    // senão toda clareira teria uma recompensa igual e deixaria de parecer
    // uma descoberta. Posicionado a y = ±(LANE_HALF_HEIGHT+40) — DENTRO da
    // faixa alargada da clareira, mas ALÉM da faixa normal (140), então só
    // é alcançável saindo mesmo da linha central da estrada.
    _generateClearingTreasures() {
        const spacing = this.CLEARING_SPACING;
        const lastIdx = Math.floor((this.WORLD_LENGTH - 300) / spacing);
        for (let i = 1; i <= lastIdx; i++) {
            const clx = i * spacing;
            if (clx < 300 || clx > this.WORLD_LENGTH - 300) continue;
            if (this._hash(i * 61 + 13000) >= 45) continue; // não é uma clareira válida
            if (this._hash(i * 83 + 14500) >= 40) continue; // só ~40% das clareiras têm tesouro
            const side = (this._hash(i * 97 + 15200) % 2 === 0) ? -1 : 1;
            const y = side * (this.LANE_HALF_HEIGHT + 40);
            this._events.push({ type: 'clearing_treasure', x: clx, y, spawnX: clx, consumed: false });
        }
    },

    update(dt) {
        // Corrige um bug que existia desde a Fase 2: só checar `this.active`
        // (sem checar a TELA) deixava o RoadEngine continuando a mover o
        // jogador/consumir fadiga/checar chegada em segundo plano mesmo
        // depois da tela trocar pra BATTLE (ver _updateBandits abaixo) — o
        // Mundo da Estrada precisava ficar pausado de verdade durante uma
        // emboscada, do mesmo jeito que CityEngine já faz (ver city.js
        // update(), que também usa _isActive() e não só um bool solto).
        if (!this._isActive()) return;
        const p = this._player;
        this._updateMovement(p, dt);
        this._updateCamera(p, dt);

        // Fadiga ao longo da distância (só a pé) — mesma cadência/chance
        // (35%) do antigo RoadSystem.advance, só que disparada por
        // distância percorrida em vez de "etapas" discretas.
        if (this.mode === 'walk' && p.x >= this._nextFatigueTickAt) {
            this._nextFatigueTickAt += this._fatigueTickEvery;
            if (Utils.chance(35) && this.player) {
                this.player.fatigue = Math.min(3, (this.player.fatigue || 0) + 1);
            }
        }

        if (!this._arrived && p.x >= this.WORLD_LENGTH - 60) {
            this._arrived = true;
            if (window.UI && window.UI.onRoadWorldArrival) window.UI.onRoadWorldArrival(this.toId);
            return;
        }

        // Bioma atual (Fase 3) — só escreve no DOM quando a zona muda (não
        // a cada frame), já que o nome não muda com o jogador parado.
        const zoneIdx = this._zoneIndexAt(p.x);
        if (zoneIdx !== this._lastZoneIndex) {
            this._lastZoneIndex = zoneIdx;
            this._updateZoneLabel(zoneIdx);
        }

        this._updateBandits();
        this._updateInteractPrompt();
        this._updateProgressLabel();
        this._updateWeather(dt);
    },

    // Clima da Estrada (mundo vivo pedido pela mega-diretiva) — mesmo
    // sistema de chuva/tempestade já usado na Praça (ver
    // CityEngine._updateWeather), agora também durante a travessia entre
    // cidades, nunca só na cidade parada. Usa o clima da cidade de DESTINO
    // (rainChance/stormChance, ver citydatabase.js) — viajar rumo ao
    // Santuário Élfico já pode começar a chover antes de chegar lá. Sem
    // cidade de destino real (Expedição à Floresta Ancestral, toDef
    // undefined), cai nos valores originais fixos (35%/30%), o mesmo
    // fallback usado em CityEngine e no resto deste arquivo.
    _updateWeather(dt) {
        this._weatherTimer -= dt;
        if (this._weatherTimer <= 0) {
            const toDef = window.CityDatabase[this.toId];
            const rainChance = (toDef && toDef.weather && typeof toDef.weather.rainChance === 'number') ? toDef.weather.rainChance : 35;
            const stormChance = (toDef && toDef.weather && typeof toDef.weather.stormChance === 'number') ? toDef.weather.stormChance : 30;
            if (this._weather === 'clear') {
                this._weather = Utils.chance(rainChance) ? 'rain' : 'clear';
                this._weatherTimer = this._weather === 'rain' ? Utils.randomFloat(30, 55) : Utils.randomFloat(45, 90);
                if (this._weather === 'rain') {
                    this._isStorm = Utils.chance(stormChance);
                    this._lightningTimer = Utils.randomFloat(6, 14);
                    if (window.MainMenu) window.MainMenu.showToast(this._isStorm ? 'O céu escurece de vez — uma tempestade se aproxima!' : 'Nuvens escuras cobrem o caminho — começa a chover.', 'info');
                }
            } else {
                this._weather = 'clear';
                this._isStorm = false;
                this._weatherTimer = Utils.randomFloat(45, 90);
                if (window.MainMenu) window.MainMenu.showToast('A chuva passa e o sol volta a espiar entre as nuvens.', 'info');
            }
        }

        if (this._weather === 'rain' && window.GFX) {
            this._rainSpawnTimer -= dt;
            if (this._rainSpawnTimer <= 0) {
                this._rainSpawnTimer = 0.02;
                const w = window.Engine.width;
                window.GFX.spawnRainDrop(Utils.randomFloat(0, w), -10);
            }
        }

        if (this._weather === 'rain' && this._isStorm) {
            this._lightningTimer -= dt;
            if (this._lightningTimer <= 0) {
                this._lightningTimer = Utils.randomFloat(8, 20);
                if (window.GFX) window.GFX.triggerLightningFlash();
                if (window.AudioManager) window.AudioManager.playThunder();
            }
        }
    },

    // Move current em direção a target, no máximo maxDelta por chamada —
    // a mesma lógica de "persegue a velocidade-alvo" usada pra suavizar
    // aceleração/frenagem (ver _updateMovement) e a câmera (ver _updateCamera).
    _approach(current, target, maxDelta) {
        if (current < target) return Math.min(current + maxDelta, target);
        if (current > target) return Math.max(current - maxDelta, target);
        return current;
    },

    // Movimento local da Estrada — NUNCA delega pra PlayerController.update
    // (que é hard-snap, sem aceleração): o pedido do usuário foi
    // explicitamente "adicionar movimento suave com aceleração e
    // desaceleração" e "evitar mudanças instantâneas de direção", então essa
    // física fica só aqui, sem arriscar regredir o movimento (intocado) da
    // Praça, que continua usando PlayerController normalmente.
    _updateMovement(p, dt) {
        const bounds = this._bounds();
        const speed = this._speed();
        let targetVx = 0, targetVy = 0;
        const keyMoving = this.keysHeld.up || this.keysHeld.down || this.keysHeld.left || this.keysHeld.right;

        if (keyMoving) {
            if (this.keysHeld.up) targetVy -= 1;
            if (this.keysHeld.down) targetVy += 1;
            if (this.keysHeld.left) targetVx -= 1;
            if (this.keysHeld.right) targetVx += 1;
            const len = Math.hypot(targetVx, targetVy) || 1;
            targetVx = (targetVx / len) * speed;
            targetVy = (targetVy / len) * speed;
            p.targetX = null;
            p.targetY = null;
        } else if (p.targetX !== null) {
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 4) {
                p.targetX = null;
                p.targetY = null;
            } else {
                targetVx = (dx / dist) * speed;
                targetVy = (dy / dist) * speed;
            }
        }

        // Persegue a velocidade-alvo em vez de saltar pra ela — acelera mais
        // devagar do que freia (ACCEL < DECEL), sensação mais natural de pé
        // saindo do chão vs. parando de repente.
        const rate = (targetVx !== 0 || targetVy !== 0) ? this.ACCEL : this.DECEL;
        p.vx = this._approach(p.vx, targetVx, rate * dt);
        p.vy = this._approach(p.vy, targetVy, rate * dt);

        const realSpeed = Math.hypot(p.vx, p.vy);
        p.moving = realSpeed > 5;
        if (Math.abs(p.vx) > 5) p.facing = p.vx > 0 ? 1 : -1;

        p.x = Utils.clamp(p.x + p.vx * dt, bounds.minX, bounds.maxX);
        p.y = Utils.clamp(p.y + p.vy * dt, bounds.minY, bounds.maxY);

    },

    // Câmera suavizada (exponencial, independente de FPS) — bypassa
    // Camera.follow() de propósito (esse hard-snap pro CityEngine da Praça
    // continua igual) e escreve Camera.x/y direto, só pra este mundo. Ver
    // pedido do usuário: "a câmera deve acompanhar suavemente o jogador, sem
    // travamentos ou movimentos bruscos".
    _updateCamera(p, dt) {
        const factor = 1 - Math.exp(-dt / this.CAMERA_SMOOTH_TIME);
        this._camX += (p.x - this._camX) * factor;
        this._camY += (p.y - this._camY) * factor;
        window.Camera.x = this._camX;
        window.Camera.y = this._camY;
    },

    // Sensação de distância percorrida (pedido do usuário) — atualiza o HUD
    // #roadworld-progress só quando o percentual inteiro muda, mesmo padrão
    // de _updateZoneLabel (nunca escreve no DOM todo frame à toa).
    _updateProgressLabel() {
        const pct = Math.round(Utils.clamp(this._player.x / this.WORLD_LENGTH, 0, 1) * 100);
        if (pct === this._lastProgressPct) return;
        this._lastProgressPct = pct;
        const el = document.getElementById('roadworld-progress');
        if (el) el.innerText = `${pct}% do caminho`;
    },

    // Bandidos (e o Espírito da Natureza, ver _generateForestEncounter)
    // patrulham um pequeno trecho (vai e volta) ao redor do ponto onde
    // nasceram — puramente visual até o jogador chegar perto o bastante
    // (ver BANDIT_DETECT_RADIUS), quando a emboscada dispara sozinha (mesmo
    // espírito de "o jogador vê o inimigo andando pelo mapa" pedido no
    // design, sem nenhuma mensagem de texto substituindo a cena). Ficar
    // fora do raio (ou correr direto) é como se contorna/ignora — nenhum
    // código extra precisa disso, só não entrar no raio. `corruption` NÃO
    // entra aqui — é uma escolha narrativa, nunca uma emboscada (ver
    // _updateInteractPrompt/_resolveEvent).
    _updateBandits() {
        const p = this._player;
        for (const ev of this._events) {
            if (ev.consumed || (ev.type !== 'bandit' && ev.type !== 'nature_spirit')) continue;
            ev.x = ev.spawnX + Math.sin(performance.now() / 1000 * 0.6 + ev.spawnX) * this.BANDIT_PATROL_RANGE;
            const dist = Math.hypot(p.x - ev.x, p.y - ev.y);
            if (dist < this.BANDIT_DETECT_RADIUS) {
                ev.consumed = true;
                if (ev.type === 'bandit') {
                    if (window.UI && window.UI.onRoadWorldEncounter) window.UI.onRoadWorldEncounter();
                } else if (window.UI && window.UI.onRoadWorldNatureDiscovery) {
                    window.UI.onRoadWorldNatureDiscovery();
                }
                return; // a tela muda pra BATTLE agora — nada mais a fazer neste frame
            }
        }
    },

    // Evento pacífico (ou a escolha da Corrupção) mais próximo dentro do
    // raio de interação — mesmo padrão do aviso de "entrar em prédio" da
    // Praça (ver city.js _updateProximity/#city-interact-prompt),
    // reaproveitando a MESMA classe CSS (.city-interact-prompt) num
    // elemento próprio da Estrada. `bandit`/`nature_spirit` nunca aparecem
    // aqui — são detectados por proximidade automática (ver _updateBandits).
    _updateInteractPrompt() {
        const p = this._player;
        let nearest = null, nearestDist = this.INTERACT_RADIUS;
        for (const ev of this._events) {
            if (ev.consumed || ev.type === 'bandit' || ev.type === 'nature_spirit') continue;
            const d = Math.hypot(p.x - ev.x, p.y - ev.y);
            if (d < nearestDist) { nearest = ev; nearestDist = d; }
        }
        this._nearEvent = nearest;
        const el = document.getElementById('roadworld-interact-prompt');
        if (!el) return;
        if (nearest) {
            const def = this.EVENT_TYPES[nearest.type] || this.FOREST_EVENT_TYPES[nearest.type];
            el.innerText = `${def.icon} ${def.label}`;
            el.classList.add('visible');
            el.onclick = () => this._resolveEvent(nearest);
        } else {
            el.classList.remove('visible');
        }
    },

    // Resolve um evento pacífico ao interagir — sempre consumido depois (só
    // acontece uma vez), sempre com um toast explicando o que aconteceu.
    // Reaproveita a mesma lógica de recompensa que roads.js _rollEvent/
    // _rollChest já usava pro equivalente sorteado, agora disparada por
    // proximidade física em vez de dados.
    _resolveEvent(ev) {
        ev.consumed = true;
        this._nearEvent = null;
        const el = document.getElementById('roadworld-interact-prompt');
        if (el) el.classList.remove('visible');
        const p = this.player;
        const toast = (msg, kind = 'info') => { if (window.MainMenu) window.MainMenu.showToast(msg, kind); };

        // Corrupção (ver corruption.js CorruptionSystem) — nunca uma
        // recompensa comum, é a escolha narrativa em si (ui.js
        // showCorruptionChoice, chamada via onRoadWorldCorruptionEvent).
        if (ev.type === 'corruption') {
            if (window.UI && window.UI.onRoadWorldCorruptionEvent) window.UI.onRoadWorldCorruptionEvent();
            return;
        }

        // Viajante (Fase 5 — missões de viagem) — oferece uma missão
        // real via QuestFactory/QuestSystem (as mesmas usadas pelo quadro
        // da cidade), aceita na hora (sem quadro de escolha nesta versão
        // mínima). O progresso já funciona sozinho: QuestSystem.
        // onBattleVictory é chamado de dentro de battle.js pra QUALQUER
        // vitória, incluindo as disparadas por um bandido na Estrada.
        if (ev.type === 'traveler') {
            const type = this.TRAVELER_QUEST_TYPES[this._hash(Math.floor(ev.x)) % this.TRAVELER_QUEST_TYPES.length];
            const offer = window.QuestFactory && window.QuestFactory.generate(this.fromId, p, type);
            if (offer && window.QuestSystem && window.QuestSystem.acceptQuest(p, offer)) {
                toast(`Nova missão de um viajante: ${offer.name}. ${offer.description}`, 'success');
            } else {
                toast(this._pickFlavor(this.TRAVELER_SMALLTALK_LINES, ev.x, 10300), 'info');
            }
            window.SaveManager.save(window.Engine.state);
            return;
        }

        if (ev.type === 'merchant') {
            const gift = Utils.randomInt(10, 35);
            p.gold += gift;
            toast(`O comerciante compra uma bugiganga sua por ${gift}g.`, 'success');
        } else if (ev.type === 'secret') {
            const gift = Utils.randomInt(40, 80);
            p.gold += gift;
            const line = this._pickFlavor(this.SECRET_LINES, ev.x, 9800).replace('{gift}', gift);
            toast(line, 'success');
        } else if (ev.type === 'campfire') {
            if ((p.fatigue || 0) > 0) {
                p.cureFatigue(1);
                toast('Você descansa um instante à fogueira — 1 nível de fadiga a menos.', 'success');
            } else {
                toast('A fogueira ainda aquece, mas você não sente nenhum cansaço agora.', 'info');
            }
        } else if (ev.type === 'cart') {
            toast(this._pickFlavor(this.CART_LINES, ev.x, 9500), 'info');
        } else if (ev.type === 'bridge') {
            // Marco puramente cênico (pedido do usuário: "pontes" como
            // ponto físico de exploração) — mesmo espírito do 'cart' acima,
            // sem recompensa, só ambientação de travessia segura.
            toast(this._pickFlavor(this.BRIDGE_LINES, ev.x, 9700), 'info');
        } else if (ev.type === 'cave') {
            // Recompensa em ouro, faixa maior que 'secret' — risco maior
            // percebido ("caverna escura") justifica um prêmio melhor.
            const gift = Utils.randomInt(50, 100);
            p.gold += gift;
            toast(this._pickFlavor(this.CAVE_LINES, ev.x, 9600).replace('{gift}', gift), 'success');
        } else if (ev.type === 'shrine') {
            // Bênção do pequeno templo (pedido do usuário) — cura fadiga E
            // um pouco de HP, mesma lógica de "suporte" da linhagem da
            // Natureza mas disponível pra QUALQUER jogador, sem precisar da
            // linhagem — é só um santuário físico no caminho.
            let healed = false;
            if ((p.fatigue || 0) > 0) { p.cureFatigue(1); healed = true; }
            if (p.currentHp < p.derivedStats.maxHp) {
                p.currentHp = Utils.clamp(p.currentHp + Math.floor(p.derivedStats.maxHp * 0.15), 0, p.derivedStats.maxHp);
                healed = true;
            }
            toast(this._pickFlavor(healed ? this.SHRINE_HEALED_LINES : this.SHRINE_FULL_LINES, ev.x, 9900), 'success');
        } else if (ev.type === 'ruins') {
            // Item antigo, mesma mecânica do 'chest' mas com chance de
            // raridade melhor (pedido do usuário: ruínas como marco de
            // exploração com recompensa própria de "colecionável").
            const cityId = this.fromId;
            const picked = window.ItemFactory && window.ItemFactory._pickRandomEquipmentId
                ? window.ItemFactory._pickRandomEquipmentId(cityId, false) : null;
            if (!picked) {
                toast('As ruínas antigas guardam só pó e silêncio.', 'info');
                return;
            }
            const rarity = Utils.chance(20) ? RARITY.RARE : (Utils.chance(35) ? RARITY.UNCOMMON : RARITY.COMMON);
            const item = window.ItemFactory.createEquipment(picked.id, picked.category, rarity);
            if (p.inventory.length < p.inventoryCapacity) {
                p.inventory.push(item);
                toast(`Entre pilares tombados, você encontra ${item.name}, esquecido há eras!`, 'success');
            } else {
                const soldFor = Math.floor(item.value * 0.5);
                p.gold += soldFor;
                toast(`As ruínas guardam ${item.name}, mas sua mochila está cheia — vendido no local por ${soldFor}g.`, 'success');
            }
        } else if (ev.type === 'magic_stone') {
            // Colecionável permanente (pedido do usuário: "pedras mágicas")
            // — nunca dá ouro/item, só conta pra um contador persistido no
            // Player (mesmo padrão de fatigue/natureSkillPoints: campo novo
            // sem migração de save nenhuma, salvo pelo SaveManager.save
            // genérico já chamado ao fim deste método).
            p.magicStonesFound = (p.magicStonesFound || 0) + 1;
            toast(`Uma pedra mágica pulsa fracamente em sua mão — ${p.magicStonesFound}ª encontrada até agora.`, 'success');
        } else if (ev.type === 'lore_book') {
            // Colecionável narrativo (pedido do usuário: "livros") — mesmo
            // princípio da pedra mágica, mas com um trecho de lore do mundo
            // escolhido deterministicamente pela posição do livro (nunca
            // Math.random puro), então o mesmo livro sempre mostra o mesmo
            // trecho se o jogador passar pelo mesmo ponto de novo.
            p.loreBooksFound = (p.loreBooksFound || 0) + 1;
            const entry = this.LORE_ENTRIES[this._hash(Math.floor(ev.x)) % this.LORE_ENTRIES.length];
            toast(`📖 ${entry}`, 'success');
        } else if (ev.type === 'chest') {
            const cityId = this.fromId;
            const picked = window.ItemFactory && window.ItemFactory._pickRandomEquipmentId
                ? window.ItemFactory._pickRandomEquipmentId(cityId, false) : null;
            if (!picked) {
                const gift = Utils.randomInt(15, 30);
                p.gold += gift;
                toast(`Um baú vazio guarda só ${gift}g esquecidos no fundo.`, 'success');
                return;
            }
            const rarity = Utils.chance(20) ? RARITY.UNCOMMON : RARITY.COMMON;
            const item = window.ItemFactory.createEquipment(picked.id, picked.category, rarity);
            if (p.inventory.length < p.inventoryCapacity) {
                p.inventory.push(item);
                toast(`Um baú escondido entre as pedras guarda ${item.name}!`, 'success');
            } else {
                const soldFor = Math.floor(item.value * 0.5);
                p.gold += soldFor;
                toast(`Um baú guarda ${item.name}, mas sua mochila está cheia — vendido no local por ${soldFor}g.`, 'success');
            }
        } else if (ev.type === 'clearing_treasure') {
            // Recompensa melhor que os equivalentes comuns (chest/secret) —
            // incentivo de verdade pra ter saído da faixa normal da estrada
            // (ver _laneHalfHeightAt/_generateClearingTreasures, Ciclo 12),
            // nunca alcançável sem realmente entrar na parte alargada da
            // clareira. Sempre tenta dar um item primeiro (rariedade melhor
            // que 'chest'), só cai pra ouro se ItemFactory não retornar nada.
            const cityId = this.fromId;
            const picked = window.ItemFactory && window.ItemFactory._pickRandomEquipmentId
                ? window.ItemFactory._pickRandomEquipmentId(cityId, false) : null;
            if (!picked) {
                const gift = Utils.randomInt(60, 120);
                p.gold += gift;
                toast(`Longe da estrada, você desenterra ${gift}g escondidos sob raízes antigas.`, 'success');
                return;
            }
            const rarity = Utils.chance(30) ? RARITY.RARE : (Utils.chance(50) ? RARITY.UNCOMMON : RARITY.COMMON);
            const item = window.ItemFactory.createEquipment(picked.id, picked.category, rarity);
            if (p.inventory.length < p.inventoryCapacity) {
                p.inventory.push(item);
                toast(`Longe da estrada, escondido na clareira, você encontra ${item.name}!`, 'success');
            } else {
                const soldFor = Math.floor(item.value * 0.6);
                p.gold += soldFor;
                toast(`Você encontra ${item.name} na clareira, mas sua mochila está cheia — vendido no local por ${soldFor}g.`, 'success');
            }
        } else if (ev.type === 'wounded_gladiator') {
            // "Gladiador ferido" — item explícito da lista original de
            // eventos do usuário. Recompensa em experiência (p.gainExp,
            // ver player.js), não em ouro/item, já que a ajuda aqui é
            // narrativa (curar/socorrer), não um saque — consistente com
            // o tom de shrine (bênção) em vez de chest/clearing_treasure.
            const xp = Utils.randomInt(20, 40);
            p.gainExp(xp);
            toast(this._pickFlavor(this.WOUNDED_GLADIATOR_LINES, ev.x, 10100).replace('{xp}', xp), 'success');
        } else if (ev.type === 'rare_animal') {
            // "Animal raro" — último item pendente da lista original de
            // eventos do usuário. Colecionável narrativo, mesmo padrão de
            // magicStonesFound/loreBooksFound (contador permanente no
            // Player, sem migração de save, salvo pelo SaveManager.save
            // genérico já chamado ao fim deste método) — nunca compete com
            // o loot comum de chest/clearing_treasure.
            p.rareAnimalsSighted = (p.rareAnimalsSighted || 0) + 1;
            toast(`Um animal raríssimo observa você por um instante antes de desaparecer na vegetação — ${p.rareAnimalsSighted}ª vez que você avista um assim.`, 'success');
        } else if (ev.type === 'hollow_tree') {
            // "Árvore oca" — item explícito da lista de objetos da
            // Reformulação da Floresta. Recompensa em ouro modesta (achado
            // casual escondido dentro do tronco, tom mais parecido com
            // 'secret'/'cave' do que com o saque de equipamento de
            // chest/clearing_treasure).
            const gift = Utils.randomInt(10, 25);
            p.gold += gift;
            toast(this._pickFlavor(this.HOLLOW_TREE_LINES, ev.x, 10400).replace('{gift}', gift), 'success');
        }

        // Conquistas de exploração (Ciclo 38 — 'bookworm'/'stone_collector'/
        // 'naturalist' em player.js AchievementDB) — chamado incondicionalmente
        // aqui, não só dentro de cada branch acima, porque checkAchievements()
        // já é idempotente (unlockAchievement só desbloqueia uma vez) e barato
        // (só leitura de contadores); mais simples que replicar a chamada nos
        // 3 branches (magic_stone/lore_book/rare_animal) que podem tê-la
        // desbloqueado. Nenhum outro tipo de evento tem contador nenhum, então
        // nunca desbloqueia nada indevido pros outros tipos.
        if (p.checkAchievements) {
            const unlocked = p.checkAchievements();
            unlocked.forEach(a => toast(`🏆 Conquista desbloqueada: ${a.name}!`, 'success'));
        }

        window.SaveManager.save(window.Engine.state);
    },

    draw(ctx, w, h) {
        if (!this.active) return;
        const fromDef = window.CityDatabase[this.fromId];
        const toDef = window.CityDatabase[this.toId];
        const t = Utils.clamp(this._player.x / this.WORLD_LENGTH, 0, 1);
        const corrupted = this._isForestCorrupted();
        // Sem toDef (Expedição à Floresta Ancestral, destino virtual) a
        // paleta cai numa mistura fixa verde-mística, condizente com a
        // cor de fundo que a tela antiga screen-road já usava pra ela.
        const colors = Utils.lerpColor && fromDef && toDef
            ? [Utils.lerpColor(fromDef.groundColors[0], toDef.groundColors[0], t), Utils.lerpColor(fromDef.groundColors[1], toDef.groundColors[1], t)]
            : ['#1a3a15', '#0d1f0d'];

        // Ciclo dia/noite (pedido "mundo vivo" da mega-diretiva): o Mundo da
        // Estrada sempre desenhava um céu de dia fixo, mesmo que o jogador
        // tivesse saído da cidade de noite — quebrava a consistência com o
        // ciclo dia/noite já estabelecido na Praça (ver CityEngine, que
        // escreve em window.GFX.arenaTime). Lê o MESMO relógio global
        // (congelado no horário de quando a viagem começou, já que
        // CityEngine.update — dono do avanço do relógio — não roda fora da
        // Praça) em vez de inventar um relógio próprio só pra Estrada.
        const timeOfDay = (window.GFX && window.GFX.arenaTime) || 'day';
        const isNight = timeOfDay === 'night';

        const horizon = h * 0.4;
        const grad = ctx.createLinearGradient(0, horizon, 0, h);
        // Impacto visual da corrupção (pedido do usuário): enquanto o
        // monstro das sombras que corrompe a Floresta Ancestral ainda não
        // foi derrotado (ver _isForestCorrupted), o chão vira quase preto
        // com tinta roxa em vez do verde-mística normal, e o céu escurece —
        // volta ao normal sozinho assim que o evento `nature_spirit` for
        // consumido (vitória), sem precisar de nenhum estado extra
        // persistido (a checagem já é sempre fresca a partir de _events).
        // Corrupção sempre tem prioridade sobre o horário (narrativamente é
        // uma névoa doentia, não muda com o relógio).
        if (corrupted) {
            grad.addColorStop(0, '#2a1230');
            grad.addColorStop(1, '#0a0510');
        } else if (isNight && Utils.lerpColor) {
            grad.addColorStop(0, Utils.lerpColor(colors[0], '#000000', 0.45));
            grad.addColorStop(1, Utils.lerpColor(colors[1], '#000000', 0.45));
        } else {
            grad.addColorStop(0, colors[0]);
            grad.addColorStop(1, colors[1]);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, horizon, w, h - horizon);

        // Céu (bug corrigido nesta iteração: era uma cor sólida ÚNICA sem
        // absolutamente nada mais, dando a sensação de cenário vazio/
        // incompleto reportada pelo usuário, "fundo azul sólido"). Agora um
        // gradiente + montanhas distantes (reaproveita o MESMO desenho já
        // usado pela Cidade, ver graphics.js _drawMountains — consistência
        // visual com o resto do jogo, sem inventar um estilo próprio) +
        // nuvens à deriva, tudo em coordenada de TELA (fundo infinitamente
        // distante, mesmo princípio de drawCityBackdrop — não faz parte do
        // mundo/colisão, só ambientação).
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
        if (corrupted) {
            skyGrad.addColorStop(0, '#120a18');
            skyGrad.addColorStop(1, '#241830');
        } else {
            const pal = this.SKY_PALETTES[timeOfDay] || this.SKY_PALETTES.day;
            skyGrad.addColorStop(0, pal[0]);
            skyGrad.addColorStop(1, pal[1]);
        }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizon);
        if (window.GFX && window.GFX._drawMountains) window.GFX._drawMountains(ctx, w, horizon);
        this._drawSkyClouds(ctx, w, horizon, corrupted, isNight);

        // Reformulação da Floresta (nova diretriz do usuário) — fundação de
        // PARALLAX real: até este ciclo só existiam 2 velocidades de scroll,
        // 0 (céu/montanhas/nuvens, fixos na tela) e 1.0 (tudo dentro do
        // ctx.translate(offset.dx,...) logo abaixo). Esta linha de árvores
        // distantes na altura do horizonte se move a uma FRAÇÃO da
        // velocidade do mundo (ver _drawDistantTreeline), criando uma 3ª
        // camada de profundidade entre o fundo totalmente fixo e o cenário
        // principal — exatamente o "cada camada deve mover-se em velocidade
        // diferente" pedido. Desenhada ANTES do ctx.translate (como o céu),
        // com seu próprio deslocamento parcial calculado manualmente.
        this._drawDistantTreeline(ctx, w, horizon, corrupted, isNight);

        // A câmera já foi suavizada em update()/_updateCamera — chamar
        // Camera.follow() aqui de novo seria um hard-snap por cima da
        // suavização (desfazendo o trabalho todo), então draw() só LÊ o
        // offset já calculado.
        const offset = window.Camera.getOffset(w, h);
        ctx.save();
        ctx.translate(offset.dx, offset.dy);

        // Portões de cidade (partida/chegada) — área de transição real
        // (chão mistura estrada/cidade) + arco com dois postes, em vez de
        // uma linha nua, atendendo ao pedido "cidades devem ter
        // limites/bordas claras, com áreas de transição entre estrada,
        // campo e cidade".
        this._drawCityGate(ctx, 0, fromDef ? fromDef.name : '', isNight);
        this._drawCityGate(ctx, this.WORLD_LENGTH, this._destLabel, isNight);

        // Rio atravessando a estrada (pedido do usuário: "rios" — o mapa
        // não deve parecer um corredor uniforme) — feição de terreno fixa,
        // desenhada cedo (antes de eventos/vegetação) pra parecer parte do
        // CHÃO, não um objeto flutuando por cima.
        this._drawRiverCrossing(ctx, w, h);

        // Clareiras (pedido do usuário: "clareiras" — o mapa deve
        // incentivar exploração) — trechos de chão mais claro/aberto,
        // também desenhados cedo (parte do CHÃO), pra a vegetação normal
        // que vem depois parecer realmente "rarear" ali.
        this._drawClearings(ctx, w, h, corrupted);

        // Placas de bioma (Fase 3) — um marco em cada fronteira de zona,
        // com o nome da zona que começa ali. A cor de fundo já muda de
        // forma contínua (mistura acima) — isso só rotula fisicamente as
        // seções, nunca troca o cenário de uma vez.
        for (let i = 1; i < this._zones.length; i++) {
            this._drawMarker(ctx, i * this._zoneLength, this._zones[i].name, this._zones[i].vegColor);
        }

        // Eventos físicos (Fase 4) — mercador/baú/esconderijo/fogueira/
        // carroça/bandido, todos objetos reais no mapa (nunca um pop-up).
        for (const ev of this._events) {
            if (ev.consumed) continue;
            if (!window.Camera.isVisible(ev.x, ev.y, w, h, 150)) continue;
            this._drawEvent(ctx, ev, corrupted, isNight);
        }

        // Detalhes de solo (pedido do usuário: "florestas praticamente
        // vazias... detalhes de solo" — precisa de mais que só vegetação
        // esparsa) — manchas escuras sutis quebrando a uniformidade do
        // gradiente de chão, desenhadas ANTES da vegetação (camada de
        // baixo). Mesmo princípio determinístico/cullado de todo o resto
        // do arquivo, espaçamento próprio (mais raro que a vegetação) pra
        // não custar praticamente nada extra por frame.
        const groundSpacing = 340;
        const gFirst = Math.max(0, Math.floor((this._player.x - w) / groundSpacing));
        const gLast = Math.ceil((this._player.x + w) / groundSpacing);
        for (let i = gFirst; i <= gLast; i++) {
            const gx = i * groundSpacing;
            if (gx < 0 || gx > this.WORLD_LENGTH) continue;
            if (this._hash(i * 19 + 17000) >= 55) continue;
            const gy = (this._hash(i * 23 + 17500) % 2 === 0 ? -1 : 1) * (this.LANE_HALF_HEIGHT * 0.5);
            if (!window.Camera.isVisible(gx, gy, w, h)) continue;
            ctx.fillStyle = corrupted ? 'rgba(20,10,25,0.25)' : 'rgba(0,0,0,0.12)';
            ctx.beginPath();
            ctx.ellipse(gx, gy, 30, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Folhas caídas no chão (pedido explícito da seção "Caminho": ver
        // _drawFallenLeaves abaixo).
        this._drawFallenLeaves(ctx, w, h, corrupted);

        // Vegetação esparsa, só decorativa — gerada de forma determinística
        // (sem array guardado em memória, sem Math.random) e cullada via
        // Camera.isVisible, então o custo por frame não cresce com
        // WORLD_LENGTH. A densidade varia por zona (Bosque/Floresta têm
        // mais chance de planta por slot que Campos) via _hash(). Cada slot
        // sorteia UM de 4 tipos de detalhe (pedido do usuário: "vegetação,
        // arbustos, pedras, flores" — a floresta não pode ter só um tipo de
        // planta repetido) em vez de sempre a mesma elipse — mesmo custo
        // por frame de antes (1 forma por slot), só mais variedade visual.
        const spacing = 220;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        for (let i = firstIdx; i <= lastIdx; i++) {
            const vx = i * spacing;
            if (vx < 0 || vx > this.WORLD_LENGTH) continue;
            const zone = this._zones[this._zoneIndexAt(vx)];
            const density = zone.vegDensity;
            if (this._hash(i) >= 40 * density) continue;
            const side = (i % 2 === 0) ? -1 : 1;
            const vy = side * (this.LANE_HALF_HEIGHT - 20);
            if (!window.Camera.isVisible(vx, vy, w, h)) continue;

            // Sombra no chão (pedido do usuário: "sombras" entre os
            // elementos de preenchimento visual da floresta) — última peça
            // do trio iniciado nas árvores gigantes (Ciclo 31) e nos
            // acampamentos (Ciclo 32): a vegetação pequena (pedra/planta/
            // arbusto/flor) é o elemento mais numeroso do cenário e ainda
            // não tinha sombra própria, só os marcos raros tinham. Elipse
            // BEM menor que as dos marcos (objeto rasteiro, sombra discreta),
            // desenhada antes de qualquer detalhe, mesmo custo de 1 forma a
            // mais por slot já visível (sem slot novo, sem hash novo).
            ctx.fillStyle = corrupted ? 'rgba(15,8,20,0.25)' : 'rgba(0,0,0,0.16)';
            ctx.beginPath();
            ctx.ellipse(vx, vy + 10, 13, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Cor da vegetação varia por zona/família de bioma (identidade
            // visual por par-de-cidade, ver ZONE_FAMILY_STAGES) — exceto
            // enquanto a floresta estiver corrompida, quando SEMPRE vira
            // roxo doentio por cima de qualquer família (prioridade da
            // corrupção sobre a identidade normal da zona).
            const detailType = this._hash(i * 83 + 15000) % 4;

            // Revisão de "sistema modular" (Reformulação da Floresta):
            // antes desta fatia, toda pedra tinha o EXATO mesmo tamanho de
            // toda outra pedra, todo arbusto o mesmo tamanho de todo outro
            // arbusto — só o TIPO variava (Ciclo original), nunca a escala
            // nem a inclinação de cada instância. Escala (0.75x-1.25x) e
            // leve rotação (±0.3 rad) determinísticas por slot, aplicadas
            // via `ctx.scale`/`ctx.rotate` num sistema de coordenadas
            // local transladado pra (vx,vy), evitam que duas pedras/arbustos
            // vizinhos pareçam clones exatos um do outro — mesmo princípio
            // já usado no `lean` das árvores gigantes (Ciclo 44), agora
            // estendido à vegetação pequena. A sombra (desenhada ANTES
            // deste bloco, ver acima) fica de fora de propósito: continua
            // com raio fixo (13,4) pra não quebrar a identificação exata
            // já usada por testes existentes, e o desalinhamento sutil
            // entre sombra e objeto escalado é imperceptível no jogo.
            const scale = 0.75 + (this._hash(i * 173 + 40000) % 51) / 100;
            const rot = ((this._hash(i * 67 + 40500) % 21) - 10) * 0.03;
            ctx.save();
            ctx.translate(vx, vy);
            ctx.rotate(rot);
            ctx.scale(scale, scale);
            if (detailType === 1) {
                // Pedra — cor neutra de rocha, nunca muda por zona/família
                // (pedras são inertes, não fazem parte da identidade de
                // bioma como a vegetação faz).
                ctx.fillStyle = corrupted ? 'rgba(40,35,45,0.75)' : 'rgba(110,105,98,0.85)';
                ctx.beginPath();
                ctx.moveTo(-10, 6);
                ctx.lineTo(-5, -6);
                ctx.lineTo(7, -8);
                ctx.lineTo(11, 3);
                ctx.lineTo(2, 9);
                ctx.closePath();
                ctx.fill();
            } else if (detailType === 2 && !corrupted) {
                // Flores — não sobrevivem à corrupção (cai no tipo padrão
                // abaixo quando corrompido, já tingido de roxo doentio).
                ctx.fillStyle = 'rgba(230,190,90,0.85)';
                for (const [fx, fy] of [[-8, -4], [8, -4], [0, -10], [-4, 4], [4, 4]]) {
                    ctx.beginPath();
                    ctx.arc(fx, fy, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (detailType === 3) {
                // Arbusto — trio de círculos baixos, cor de zona (mais
                // largo/baixo que a planta padrão, dá variedade de silhueta).
                ctx.fillStyle = corrupted ? 'rgba(45,20,55,0.6)' : zone.vegColor;
                ctx.beginPath(); ctx.arc(-8, 4, 9, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(8, 4, 9, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, -2, 10, 0, Math.PI * 2); ctx.fill();
            } else {
                // Planta padrão (elipse original).
                ctx.fillStyle = corrupted ? 'rgba(45,20,55,0.6)' : zone.vegColor;
                ctx.beginPath();
                ctx.ellipse(0, 0, 14, 22, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // Árvores gigantes (pedido do usuário) — marcos raros e bem mais
        // esparsos que a vegetação normal acima, sempre fora da faixa
        // caminhável (nunca bloqueiam nem colidem).
        this._drawGiantTrees(ctx, w, h, corrupted, isNight);

        // Acampamentos abandonados (pedido do usuário: "acampamentos" — o
        // mapa não deve parecer um corredor) — marco de terreno puramente
        // decorativo, mesmo princípio de _drawGiantTrees (determinístico,
        // fora da faixa caminhável, cullado por Camera.isVisible).
        this._drawTravelCamps(ctx, w, h, corrupted, isNight);

        // Torres de vigia de fronteira — mesmo princípio dos acampamentos
        // acima, marco físico raro que dá corpo ao lore já existente sobre
        // guardas de fronteira (ver LORE_ENTRIES).
        this._drawWatchtowers(ctx, w, h, corrupted, isNight);

        // Troncos caídos e cogumelos — mais comuns que os marcos acima,
        // decoram o caminho de perto (pedido explícito da reformulação, na
        // seção "Objetos": "espalhe naturalmente pelo caminho ... troncos
        // caídos; cogumelos"). Objetos físicos de cenário, não efeito de
        // luz/clima, então sempre desenhados independente de dia/noite.
        this._drawFallenLogsAndMushrooms(ctx, w, h, corrupted);

        // Mundo vivo ambiente (Fase 6) — viajantes, caravanas, animais e
        // patrulhas caminhando ao fundo, puramente decorativos. "Animais
        // fogem" enquanto a floresta estiver corrompida (pedido do
        // usuário) — nenhuma vida ambiente aparece até o monstro das
        // sombras ser derrotado.
        if (!corrupted) this._drawAmbientLife(ctx, w, h, isNight);
        else this._drawCorruptionMist(ctx, w, h);

        // Vagalumes noturnos (pedido do usuário: floresta "viva", preenchida
        // — reforça o mesmo objetivo de _drawAmbientLife, só que ligado ao
        // ciclo dia/noite já existente em vez de à vida ambiente). Some
        // durante o dia e enquanto a floresta estiver corrompida (mesmo
        // critério de "animais fogem" já usado por _drawAmbientLife acima —
        // nenhuma vida ambiente, nem vagalume, sobrevive à corrupção). Ciclo
        // 42: também some durante chuva/tempestade — inseto nenhum voa
        // debaixo de chuva, mesmo princípio de coerência com o clima
        // dinâmico já usado no resto do arquivo (ver _weather).
        if (isNight && !corrupted && this._weather !== 'rain') this._drawFireflies(ctx, w, h);
        // Poeira/pólen: diferente dos vagalumes acima, faz sentido de dia E
        // de noite (é a luz — solar ou lunar — que revela a partícula
        // flutuando, não a partícula que emite luz própria), então só
        // desliga durante corrupção, igual todo o resto da vida ambiente.
        if (!corrupted) this._drawDustMotes(ctx, w, h);
        // Borboletas: só fazem sentido de dia (ao contrário dos vagalumes,
        // que brilham no escuro) e não voam debaixo de chuva/tempestade,
        // mesmo critério de coerência climática já usado nos vagalumes.
        if (!isNight && !corrupted && this._weather !== 'rain') this._drawButterflies(ctx, w, h);

        this._drawMount(ctx);
        this._drawPlayer(ctx);
        ctx.restore();

        // Reformulação da Floresta — camada de PRIMEIRO plano (completa o
        // par de parallax junto com _drawDistantTreeline, Ciclo 43): galhos
        // com folhagem pendurados da borda de cima da tela, bem mais
        // próximos da câmera que qualquer coisa dentro do ctx.translate
        // principal. Desenhada em coordenada de TELA, DEPOIS do
        // ctx.restore() (por cima de tudo, inclusive do jogador — exatamente
        // como "folhas próximas da câmera" deveriam aparecer, passando na
        // frente da cena). Se move mais RÁPIDO que o mundo
        // (PARALLAX_FOREGROUND_FACTOR > 1), o oposto da linha de árvores
        // distantes (que se move mais devagar) — junto, as duas estabelecem
        // 4 velocidades de scroll distintas nesta tela (0 pro céu, 0.35 pro
        // fundo, 1.0 pro mundo principal, 1.8 pro primeiro plano).
        this._drawForegroundLeaves(ctx, w, h, corrupted, isNight);
    },

    // Nuvens à deriva no céu da Estrada (parte da correção do "fundo azul
    // sólido" reportado pelo usuário) — puramente decorativas, tela-fixa
    // (não fazem parte do mundo), deslocamento baseado só no tempo
    // (performance.now()) pra nunca depender de estado extra guardado nem
    // de onde o jogador está no mundo.
    _drawSkyClouds(ctx, w, horizon, corrupted, isNight) {
        const t = performance.now() / 1000;
        ctx.fillStyle = corrupted ? 'rgba(120,90,150,0.22)' : (isNight ? 'rgba(150,160,200,0.16)' : 'rgba(255,255,255,0.32)');
        for (let i = 0; i < 5; i++) {
            const speed = 5 + (i % 3) * 3;
            const cx = ((i * 340 + t * speed) % (w + 500)) - 250;
            const cy = horizon * (0.12 + 0.14 * (i % 3));
            const scale = 0.7 + (i % 3) * 0.35;
            [-1, 0, 1].forEach(off => {
                ctx.beginPath();
                ctx.ellipse(cx + off * 28 * scale, cy + Math.abs(off) * 4 * scale, 32 * scale, 14 * scale, 0, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    },

    // Linha de árvores distantes (Reformulação da Floresta — nova diretriz
    // do usuário: "árvores ao fundo; floresta distante", múltiplas camadas
    // de parallax se movendo a velocidades diferentes). Desenhada em
    // coordenada de TELA (como o céu/nuvens), mas com deslocamento PRÓPRIO
    // igual a uma FRAÇÃO de `this._camX` (PARALLAX_TREELINE_FACTOR) — bem
    // mais lento que o cenário principal (que se move 1:1 com a câmera
    // dentro do ctx.translate logo abaixo), criando a sensação real de
    // profundidade que faltava. Silhuetas simples e translúcidas (neblina
    // atmosférica de distância), posições determinísticas via _hash (nunca
    // Math.random), padrão de "ladrilho infinito" — não amarrado a
    // WORLD_LENGTH como o resto do cenário, já que é um pano de fundo
    // sempre visível de qualquer ponto da travessia, igual ao céu.
    PARALLAX_TREELINE_FACTOR: 0.35,
    _drawDistantTreeline(ctx, w, horizon, corrupted, isNight) {
        const tile = 130;
        const camX = this._camX * this.PARALLAX_TREELINE_FACTOR;
        const firstIdx = Math.floor((camX - w) / tile);
        const lastIdx = Math.ceil((camX + w) / tile);
        ctx.fillStyle = corrupted ? 'rgba(70,40,95,0.5)' : (isNight ? 'rgba(15,28,20,0.55)' : 'rgba(30,60,35,0.5)');
        for (let i = firstIdx; i <= lastIdx; i++) {
            const wx = i * tile;
            const screenX = wx - camX;
            if (screenX < -70 || screenX > w + 70) continue;
            const treeH = 36 + (this._hash(i * 71 + 20000) % 34);
            ctx.beginPath();
            ctx.moveTo(screenX - 44, horizon + 2);
            ctx.quadraticCurveTo(screenX - 22, horizon - treeH * 1.05, screenX, horizon - treeH);
            ctx.quadraticCurveTo(screenX + 22, horizon - treeH * 1.05, screenX + 44, horizon + 2);
            ctx.closePath();
            ctx.fill();
        }
    },

    // Folhagem em primeiro plano (Reformulação da Floresta, Ciclo 45) —
    // completa o par de parallax junto com _drawDistantTreeline acima:
    // galhos com folhas pendurados da borda de cima da tela, se movendo
    // MAIS RÁPIDO que o mundo (fator > 1, o oposto da linha de árvores
    // distantes, que é mais lenta) — dá a sensação de galhos bem próximos
    // da câmera passando por cima da cena, "folhas próximas da câmera"
    // pedido explicitamente. Mesmo padrão de ladrilho infinito determinístico
    // (_hash, nunca Math.random) da linha de árvores distantes, só que
    // ancorado na borda SUPERIOR da tela em vez do horizonte.
    PARALLAX_FOREGROUND_FACTOR: 1.8,
    _drawForegroundLeaves(ctx, w, h, corrupted, isNight) {
        const tile = 260;
        const camX = this._camX * this.PARALLAX_FOREGROUND_FACTOR;
        const firstIdx = Math.floor((camX - w) / tile);
        const lastIdx = Math.ceil((camX + w) / tile);
        ctx.fillStyle = corrupted ? 'rgba(45,20,55,0.55)' : (isNight ? 'rgba(6,14,8,0.6)' : 'rgba(10,28,10,0.55)');
        for (let i = firstIdx; i <= lastIdx; i++) {
            const wx = i * tile;
            const screenX = wx - camX;
            if (screenX < -180 || screenX > w + 180) continue;
            const dropH = 70 + (this._hash(i * 61 + 24000) % 50);
            ctx.beginPath();
            ctx.moveTo(screenX - 90, 0);
            ctx.quadraticCurveTo(screenX - 40, dropH * 0.5, screenX, dropH);
            ctx.quadraticCurveTo(screenX + 40, dropH * 0.5, screenX + 90, 0);
            ctx.closePath();
            ctx.fill();
        }
    },

    // Névoa roxa da corrupção (pedido do usuário: "névoa roxa, espíritos
    // desaparecem, animais fogem") — algumas manchas translúcidas grandes
    // seguindo o jogador (posição relativa fixa, então nunca precisa achar
    // "onde" desenhar por chunk como a vegetação/vida ambiente) por cima
    // de tudo, dando a sensação de neblina doentia cobrindo a cena.
    _drawCorruptionMist(ctx, w, h) {
        const px = this._player.x;
        ctx.fillStyle = 'rgba(90,30,120,0.12)';
        for (let i = -2; i <= 2; i++) {
            const mx = px + i * 260;
            const my = Math.sin(performance.now() / 1400 + i) * 30;
            ctx.beginPath();
            ctx.ellipse(mx, my, 220, 70, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Vida ambiente (Fase 6) — nunca guarda estado num array (a posição de
    // cada entidade é uma função pura de tempo decorrido + hash do chunk),
    // e só é calculada/desenhada pros poucos chunks perto da câmera (Fase
    // 7 — o mesmo princípio de chunking/culling que já vale pra vegetação
    // acima, aplicado a NPCs): o custo por frame nunca cresce com
    // WORLD_LENGTH, só com o quanto cabe na tela.
    // Entidades humanas da vida ambiente (bug corrigido: viajante/patrulha
    // eram só um emoji 🚶/🛡️ flutuando, nunca um personagem de verdade —
    // mesmo motivo/mesma solução de CREATURE_ENTITIES acima, reaproveitando
    // GFX.drawGladiator). Caravana/animal não são humanoides — ganharam
    // formas procedurais próprias (_drawAmbientCaravan/_drawAmbientAnimal)
    // em vez de um emoji, no mesmo estilo 100% desenhado à mão já usado
    // pelo resto do arquivo (árvores gigantes, acampamentos, rio).
    AMBIENT_ENTITIES: {
        npc_traveler: {
            visuals: { gender: 'Feminino', skinTone: '#d8b088', hairStyle: 5, hairColor: '#5a3a1a', beardStyle: 0, eyeColor: '#3a2a1a', faceShape: 1 },
            equipment: {}, __teamColor: '#7a6a4a', race: 'humano'
        },
        patrol: {
            visuals: { gender: 'Masculino', skinTone: '#c8a878', hairStyle: 3, hairColor: '#2a2418', beardStyle: 2, eyeColor: '#2a1a14', faceShape: 1 },
            equipment: {}, __teamColor: '#4a5a3a', race: 'humano'
        },
        // "Outros gladiadores podem estar viajando" — item explícito da
        // lista original do usuário de "mundo vivo" que ainda não tinha
        // ganho um tipo ambiente próprio (só existia o `npc_traveler`
        // genérico, sem nenhuma arma). Diferença visual chave: uma arma de
        // verdade equipada em `equipment.mainHand` (mesmo campo/pipeline
        // que já renderiza a arma do jogador em batalha, ver graphics.js
        // _drawFrontArm/_drawWeapon) — reconhecível como "outro lutador",
        // não só mais um viajante comum.
        rival_gladiator: {
            visuals: { gender: 'Masculino', skinTone: '#b8895a', hairStyle: 6, hairColor: '#1a1410', beardStyle: 3, eyeColor: '#2a1a14', faceShape: 1 },
            equipment: { mainHand: { id: 'w_01' } }, __teamColor: '#7a2a2a', race: 'humano'
        }
    },

    _drawAmbientHuman(ctx, x, y, kind, seed, facing, isNight, chunkX) {
        if (!window.GFX || !window.GFX.drawGladiator) return;
        // Viajante ambiente ganha a mesma identidade racial regional do
        // evento interativo `traveler` (ver TRAVELER_VARIANTS/
        // _makeTravelerEntity, Ciclo 18) — usa `chunkX` (posição FIXA do
        // chunk, não a posição de desenho que oscila dentro dele) pra
        // decidir a família, cacheada por chunk pra nunca recalcular por
        // quadro. Patrulha (Ciclo 20) ganha a identidade da cidade de
        // ORIGEM (ver PATROL_VARIANTS/_makePatrolEntity acima) — uma
        // única entrada de cache pra travessia inteira, já que nunca
        // varia com a posição (ao contrário do viajante).
        const entityCache = this._ambientEntityCache || (this._ambientEntityCache = {});
        let entity = this.AMBIENT_ENTITIES[kind];
        if (kind === 'npc_traveler') {
            const ekey = 'npc_traveler_' + chunkX;
            entity = entityCache[ekey] || (entityCache[ekey] = this._makeTravelerEntity(chunkX, this.fromId, this.toId));
        } else if (kind === 'patrol') {
            entity = entityCache.patrol || (entityCache.patrol = this._makePatrolEntity(this.fromId, this.toId));
        } else if (kind === 'rival_gladiator') {
            // Mesmo princípio do viajante ambiente (chunk fixo, não a
            // posição que oscila) — ver RIVAL_GLADIATOR_VARIANTS acima.
            const ekey = 'rival_gladiator_' + chunkX;
            entity = entityCache[ekey] || (entityCache[ekey] = this._makeRivalGladiatorEntity(chunkX, this.fromId, this.toId));
        }
        const cache = this._ambientAnimCache || (this._ambientAnimCache = {});
        const key = kind + '_' + seed;
        const anim = cache[key] || (cache[key] = { type: 'walk', start: performance.now(), duration: 0 });
        // Lanterna da patrulha à noite (ver Ciclo 9: "só a patrulha da
        // guarda continua rondando à noite") — reforça visualmente POR QUE
        // ela é a única presença ainda de pé no escuro, mesma linguagem de
        // luz quente já usada em fogueiras/tochas, só que se movendo junto
        // com o guarda em vez de fixa num poste.
        if (kind === 'patrol' && isNight) {
            const glow = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, 55);
            glow.addColorStop(0, 'rgba(255,200,120,0.28)');
            glow.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(x, y - 30, 55, 0, Math.PI * 2); ctx.fill();
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(this.PLAYER_SCALE * 0.85, this.PLAYER_SCALE * 0.85);
        window.GFX.drawGladiator(ctx, 0, 0, entity, facing > 0, anim, null);
        ctx.restore();
    },

    _drawAmbientCaravan(ctx, x, y, seed) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(-26, -14, 52, 22);
        ctx.fillStyle = '#c9b48a';
        ctx.beginPath();
        ctx.ellipse(0, -18, 28, 12, 0, Math.PI, 0, true);
        ctx.fill();
        ctx.fillStyle = '#2a1c10';
        ctx.beginPath(); ctx.arc(-16, 10, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, 10, 7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // Condutor em pessoa, sentado na frente da carroça (ver
        // CARAVAN_DRIVER_ENTITY/_makeCaravanDriverEntity acima) — raça
        // recalculada pela posição MUNDIAL real (x, não relativa à
        // carroça), já que a caravana atravessa o mundo inteiro.
        if (window.GFX && window.GFX.drawGladiator) {
            const driverEntity = this._makeCaravanDriverEntity(x, this.fromId, this.toId);
            const cache = this._ambientAnimCache || (this._ambientAnimCache = {});
            const key = 'caravan_driver_' + seed;
            const anim = cache[key] || (cache[key] = { type: 'idle', start: performance.now(), duration: 0 });
            ctx.save();
            ctx.translate(x + 22, y - 4);
            ctx.scale(this.PLAYER_SCALE * 0.55, this.PLAYER_SCALE * 0.55);
            window.GFX.drawGladiator(ctx, 0, 0, driverEntity, true, anim, null);
            ctx.restore();
        }
    },

    // Espécies do animal ambiente comum (pedido "animais devem circular" —
    // até este ciclo, SEMPRE a mesma silhueta de cervo genérico se repetia
    // por toda a Estrada, só alternando presença de chifres; mesma classe
    // de repetição já corrigida em lore/flavor text nos Ciclos 26/27/34,
    // agora aplicada à silhueta em vez de texto). `seed % 3` escolhe a
    // espécie de forma determinística (sem Math.random), mesmo princípio
    // de todo o resto do arquivo.
    _drawAmbientAnimal(ctx, x, y, seed) {
        const species = seed % 3;
        ctx.save();
        ctx.translate(x, y);
        if (species === 1) {
            // Coelho — corpo pequeno e baixo, orelhas compridas, sem pernas
            // visíveis (bicho rasteiro, não um mamífero de porte médio).
            ctx.fillStyle = '#9a8a6a';
            ctx.beginPath();
            ctx.ellipse(0, 6, 11, 7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(9, 1, 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(6, -8, 2, 8, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(11, -8, 2, 8, 0.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (species === 2) {
            // Pássaro voando — silhueta em V simples, sem corpo/pernas no
            // chão (a posição (x,y) já oscila livremente acima/abaixo da
            // faixa, ver _drawAmbientLife, então "voar" é só desenhar
            // diferente na mesma posição, sem lógica de movimento nova).
            ctx.strokeStyle = '#3a3428';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-4, -8, 0, 0);
            ctx.quadraticCurveTo(4, -8, 12, 0);
            ctx.stroke();
        } else {
            // Cervo/mamífero genérico (silhueta original) — chifres
            // continuam alternando por seed, agora usando um hash diferente
            // do que decide a espécie (senão todo cervo teria sempre
            // chifres ou nunca, já que os dois usariam o mesmo `seed % 3`).
            ctx.fillStyle = '#7a5a3a';
            ctx.beginPath();
            ctx.ellipse(0, 4, 16, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(14, -4, 7, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#5a3e26';
            ctx.lineWidth = 2;
            for (const lx of [-8, 8]) {
                ctx.beginPath(); ctx.moveTo(lx, 10); ctx.lineTo(lx, 18); ctx.stroke();
            }
            if (Math.floor(seed / 3) % 2 === 0) {
                ctx.beginPath();
                ctx.moveTo(16, -9); ctx.lineTo(19, -15);
                ctx.moveTo(20, -9); ctx.lineTo(23, -15);
                ctx.stroke();
            }
        }
        ctx.restore();
    },

    _drawAmbientLife(ctx, w, h, isNight) {
        const chunkSize = this.AMBIENT_CHUNK_SIZE;
        const px = this._player.x;
        const firstChunk = Math.max(0, Math.floor((px - w) / chunkSize) - 1);
        const lastChunk = Math.min(Math.ceil(this.WORLD_LENGTH / chunkSize), Math.ceil((px + w) / chunkSize) + 1);
        const t = performance.now() / 1000;

        for (let c = firstChunk; c <= lastChunk; c++) {
            if (this._hash(c * 13 + 5000) >= this.AMBIENT_SPAWN_CHANCE) continue;
            const kind = this.AMBIENT_TYPES[this._hash(c * 29 + 6000) % this.AMBIENT_TYPES.length];
            // À noite só a patrulha da guarda continua (mesmo princípio já
            // usado na Praça, ver CityEngine._nightVisibleNpcs/"NPCs somem
            // à noite" — viajante comum, caravana de comércio e animais não
            // ficam expostos na estrada escura, só a ronda da guarda).
            if (isNight && kind !== 'patrol') continue;
            const seed = this._hash(c * 47 + 7000);
            const chunkStart = c * chunkSize;
            let x, y, facing = 1;

            if (kind === 'caravan') {
                // Atravessa o MUNDO INTEIRO (não só o chunk) e reaparece do
                // início ao sair — "caravanas devem viajar" entre cidades de
                // verdade, sem precisar guardar posição entre frames.
                x = (t * 90 + seed * 500) % this.WORLD_LENGTH;
                y = -40;
            } else if (kind === 'npc_traveler') {
                // Anda continuamente numa direção dentro do próprio chunk
                // (módulo do tempo), nunca oscila vai-e-volta como
                // bandido/patrulha — dá a sensação de estar realmente indo
                // de um lugar a outro, não só decorando o mesmo ponto.
                x = chunkStart + ((t * 40 + seed * 25) % chunkSize);
                y = (seed % 2 === 0 ? -1 : 1) * 95;
                facing = (seed % 2 === 0) ? 1 : -1;
            } else if (kind === 'animal') {
                const cx = chunkStart + chunkSize * 0.5;
                x = cx + Math.sin(t * 0.4 + seed) * 180;
                y = Math.cos(t * 0.3 + seed) * 55;
            } else if (kind === 'patrol') { // guarda vai-e-volta, mesmo padrão do bandido (_updateBandits) mas sem raio de detecção nenhum (nunca dispara batalha)
                const cx = chunkStart + chunkSize * 0.5;
                x = cx + Math.sin(t * 0.5 + seed) * 220;
                y = (seed % 2 === 0 ? -1 : 1) * 115;
                facing = Math.cos(t * 0.5 + seed) >= 0 ? 1 : -1;
            } else { // rival_gladiator — "outros gladiadores podem estar
                // viajando" (pedido do usuário, mundo vivo) — anda
                // continuamente dentro do próprio chunk igual o viajante
                // comum, só que mais rápido (passo decidido, não passeio),
                // reforçando a diferença de postura além da arma visível.
                x = chunkStart + ((t * 55 + seed * 35) % chunkSize);
                y = (seed % 2 === 0 ? -1 : 1) * 130;
                facing = (seed % 2 === 0) ? 1 : -1;
            }

            if (!window.Camera.isVisible(x, y, w, h, 150)) continue;
            if (kind === 'npc_traveler' || kind === 'patrol' || kind === 'rival_gladiator') this._drawAmbientHuman(ctx, x, y, kind, seed, facing, isNight, chunkStart + chunkSize * 0.5);
            else if (kind === 'caravan') this._drawAmbientCaravan(ctx, x, y, seed);
            else this._drawAmbientAnimal(ctx, x, y, seed);
        }
    },

    // Rio atravessando a estrada, com uma ponte de madeira sobre a faixa
    // caminhável (pedido do usuário: "rios" como feição física da
    // travessia, não um evento sorteado) — posição FIXA (mesma fração do
    // mundo em toda travessia, real ou Expedição à Floresta), então o
    // jogador sempre encontra exatamente um rio no meio do caminho. Puramente
    // visual: a ponte não colide com nada, o jogador simplesmente anda por
    // cima dela como qualquer outro trecho da faixa.
    _drawRiverCrossing(ctx, w, h) {
        const rx = this.WORLD_LENGTH * this.RIVER_X_FRAC;
        if (!window.Camera.isVisible(rx, 0, w, h, 300)) return;
        const half = this.LANE_HALF_HEIGHT + 40;
        const riverHalfW = 70;
        const grad = ctx.createLinearGradient(rx - riverHalfW, 0, rx + riverHalfW, 0);
        grad.addColorStop(0, 'rgba(60,120,170,0)');
        grad.addColorStop(0.5, 'rgba(70,150,195,0.75)');
        grad.addColorStop(1, 'rgba(60,120,170,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(rx - riverHalfW, -half, riverHalfW * 2, half * 2);

        // Ponte de madeira sobre a faixa caminhável — só a largura da faixa
        // em si, o rio continua visível além dela dos dois lados.
        const bridgeW = 26;
        ctx.fillStyle = '#5a4230';
        ctx.fillRect(rx - bridgeW / 2, -this.LANE_HALF_HEIGHT, bridgeW, this.LANE_HALF_HEIGHT * 2);
        ctx.strokeStyle = '#3a2c1e';
        ctx.lineWidth = 3;
        for (let py = -this.LANE_HALF_HEIGHT; py <= this.LANE_HALF_HEIGHT; py += 24) {
            ctx.beginPath();
            ctx.moveTo(rx - bridgeW / 2, py);
            ctx.lineTo(rx + bridgeW / 2, py);
            ctx.stroke();
        }
    },

    // Clareiras esparsas (pedido do usuário: "clareiras" — o mapa deve
    // incentivar exploração, não parecer um corredor uniforme) — um brilho
    // suave e largo no chão (gradiente radial) sugerindo um trecho mais
    // aberto/iluminado entre a vegetação, mesmo princípio determinístico
    // (sem array guardado, cullado por Camera.isVisible) dos outros marcos
    // de terreno acima. Tingido de roxo doentio (em vez do dourado normal
    // de luz solar) quando a Floresta Ancestral estiver corrompida.
    _drawClearings(ctx, w, h, corrupted) {
        const spacing = this.CLEARING_SPACING;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        for (let i = firstIdx; i <= lastIdx; i++) {
            const clx = i * spacing;
            if (clx < 300 || clx > this.WORLD_LENGTH - 300) continue;
            if (this._hash(i * 61 + 13000) >= 45) continue; // nem todo slot vira clareira
            if (!window.Camera.isVisible(clx, 0, w, h, 260)) continue;

            const radius = 220;
            const rgb = corrupted ? '90,60,120' : '255,244,200';
            const grad = ctx.createRadialGradient(clx, 0, 0, clx, 0, radius);
            grad.addColorStop(0, `rgba(${rgb},0.35)`);
            grad.addColorStop(1, `rgba(${rgb},0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(clx, 0, radius, this.LANE_HALF_HEIGHT + 60, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Árvores gigantes esparsas (pedido do usuário: "árvores gigantes" —
    // marcos de terreno raros, bem diferentes da vegetação normal/pequena
    // já desenhada acima) — determinístico via _hash (mesmo padrão da
    // vegetação: sem array guardado, sem Math.random, custo só pros chunks
    // visíveis perto da câmera). Sempre fora da faixa caminhável (`side *
    // (LANE_HALF_HEIGHT + 70)`), nunca colide, nunca aparece perto demais
    // dos portões de cidade (evita competir visualmente com a cena de
    // chegada/partida).
    _drawGiantTrees(ctx, w, h, corrupted, isNight) {
        const spacing = this.GIANT_TREE_SPACING;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        for (let i = firstIdx; i <= lastIdx; i++) {
            const gx = i * spacing;
            if (gx < 400 || gx > this.WORLD_LENGTH - 400) continue;
            if (this._hash(i * 97 + 9000) >= 55) continue; // nem todo slot tem uma árvore gigante
            const side = (this._hash(i * 53 + 9500) % 2 === 0) ? -1 : 1;
            const gy = side * (this.LANE_HALF_HEIGHT + 70);
            if (!window.Camera.isVisible(gx, gy, w, h, 200)) continue;

            // Sombra no chão (pedido do usuário: "sombras" entre os
            // elementos de preenchimento visual da floresta — nenhum objeto
            // do cenário projetava sombra até este ciclo, só as manchas de
            // solo genéricas). Elipse achatada na base do tronco, sempre
            // desenhada ANTES do tronco/copa (camada de baixo, mesmo
            // princípio dos detalhes de solo acima).
            ctx.fillStyle = corrupted ? 'rgba(15,8,20,0.35)' : 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(gx, gy + 4, 46, 14, 0, 0, Math.PI * 2);
            ctx.fill();

            // Reformulação da Floresta (nova diretriz do usuário: "árvores
            // grandes e grossas", "troncos com formatos naturais e
            // irregulares", "raízes aparentes", "copas densas formando um
            // teto verde") — o tronco reto/fino de antes (um retângulo só)
            // vira uma forma orgânica mais grossa, com leve inclinação
            // determinística por árvore (`lean`, via _hash — nunca duas
            // árvores gigantes idênticas) em vez de sempre perfeitamente
            // vertical, mais raízes visíveis na base e um par de galhos
            // bifurcados antes da copa (a referência mostra os troncos se
            // abrindo em galhos bem antes da folhagem).
            const trunkH = 78;
            const trunkW = 24;
            const lean = ((this._hash(i * 83 + 9600) % 21) - 10) * 0.7;
            const trunkColor = corrupted ? '#1a1410' : '#4a3624';
            ctx.fillStyle = trunkColor;
            ctx.beginPath();
            ctx.moveTo(gx - trunkW / 2, gy);
            ctx.quadraticCurveTo(gx - trunkW / 2 - 5, gy - trunkH * 0.55, gx - trunkW / 2 + lean, gy - trunkH);
            ctx.lineTo(gx + trunkW / 2 + lean, gy - trunkH);
            ctx.quadraticCurveTo(gx + trunkW / 2 + 5, gy - trunkH * 0.55, gx + trunkW / 2, gy);
            ctx.closePath();
            ctx.fill();

            // Raízes aparentes na base, torcendo pro chão dos dois lados.
            ctx.strokeStyle = trunkColor;
            ctx.lineWidth = 5;
            for (const rdx of [-16, 16]) {
                ctx.beginPath();
                ctx.moveTo(gx + rdx * 0.25, gy - 6);
                ctx.lineTo(gx + rdx, gy + 9);
                ctx.stroke();
            }

            // Galhos bifurcados, logo antes da copa começar.
            const branchY = gy - trunkH + 16;
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(gx + lean * 0.5, branchY);
            ctx.lineTo(gx + lean - 24, branchY - 28);
            ctx.moveTo(gx + lean * 0.5, branchY);
            ctx.lineTo(gx + lean + 22, branchY - 24);
            ctx.stroke();

            // Copa densa em camadas (base escura sob os blobs pra dar peso/
            // volume, blobs sobrepostos de tamanhos variados, e um realce
            // translúcido por cima simulando luz filtrada pelas folhas —
            // "iluminação filtrada pelas folhas" pedida na reformulação).
            const canopyY = gy - trunkH - 14;
            const cx = gx + lean;
            ctx.fillStyle = corrupted ? 'rgba(25,10,32,0.85)' : 'rgba(14,38,15,0.85)';
            ctx.beginPath(); ctx.arc(cx, canopyY + 6, 50, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = corrupted ? 'rgba(35,15,45,0.85)' : 'rgba(20,55,20,0.85)';
            ctx.beginPath(); ctx.arc(cx, canopyY, 48, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx - 36, canopyY + 16, 34, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 38, canopyY + 12, 36, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx - 14, canopyY - 22, 30, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 18, canopyY - 20, 28, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = corrupted ? 'rgba(70,40,90,0.35)' : 'rgba(60,110,55,0.35)';
            ctx.beginPath(); ctx.arc(cx - 10, canopyY - 14, 26, 0, Math.PI * 2); ctx.fill();

            // Raios de luz atravessando a copa (pedido explícito da
            // reformulação: "raios de luz atravessando as copas", na seção
            // de Iluminação). A escuridão da corrupção bloqueia a luz --
            // mesmo critério de "nenhuma vida ambiente sobrevive à
            // corrupção" já usado no resto do arquivo -- então some junto
            // com tudo mais quando `corrupted`.
            if (!corrupted) this._drawCanopyLightRays(ctx, cx, canopyY, i, isNight);
        }
    },

    // Feixes finos e translúcidos descendo da copa até o chão, tonalidade
    // quente/dourada de dia e fria/prateada à noite -- "durante a noite,
    // adaptar automaticamente a iluminação" pedido na mesma diretriz.
    // Determinístico por árvore (via _hash), nunca `Math.random`.
    _drawCanopyLightRays(ctx, cx, canopyY, i, isNight) {
        const rayCount = 2 + (this._hash(i * 131 + 30000) % 2); // 2 ou 3 raios
        const color = isNight ? 'rgba(180,200,255,' : 'rgba(255,240,180,';
        const baseOpacity = isNight ? 0.05 : 0.10;
        for (let r = 0; r < rayCount; r++) {
            const offset = ((this._hash(i * 173 + 31000 + r * 37) % 41) - 20);
            const width = 10 + (this._hash(i * 191 + 32000 + r * 37) % 8);
            const length = 130 + (this._hash(i * 211 + 33000 + r * 37) % 60);
            const topX = cx + offset;
            const topY = canopyY - 6;
            const grad = ctx.createLinearGradient(topX, topY, topX, topY + length);
            grad.addColorStop(0, color + (baseOpacity * 1.6) + ')');
            grad.addColorStop(1, color + '0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(topX - width * 0.25, topY);
            ctx.lineTo(topX + width * 0.25, topY);
            ctx.lineTo(topX + width, topY + length);
            ctx.lineTo(topX - width, topY + length);
            ctx.closePath();
            ctx.fill();
        }
    },

    // Acampamentos abandonados esparsos (pedido do usuário: "acampamentos"
    // como marco de terreno físico) — 2 tendas triangulares + o brilho de
    // uma fogueira apagando, sempre fora da faixa caminhável, nunca
    // colidem. Puramente cênico (distinto do evento `campfire`, que É
    // interativo — aqui não há aviso de interação nenhum, é só paisagem
    // "alguém acampou aqui recentemente").
    _drawTravelCamps(ctx, w, h, corrupted, isNight) {
        const spacing = this.CAMP_SPACING;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        for (let i = firstIdx; i <= lastIdx; i++) {
            const cx = i * spacing;
            if (cx < 500 || cx > this.WORLD_LENGTH - 500) continue;
            if (this._hash(i * 71 + 11000) >= 40) continue; // acampamento raro, nem todo slot tem um
            const side = (this._hash(i * 41 + 11500) % 2 === 0) ? -1 : 1;
            const cy = side * (this.LANE_HALF_HEIGHT + 60);
            if (!window.Camera.isVisible(cx, cy, w, h, 200)) continue;

            // Sombra no chão (pedido do usuário: "sombras" entre os
            // elementos de preenchimento visual da floresta — mesmo
            // princípio já aplicado às árvores gigantes em
            // _drawGiantTrees, aqui alargada pra cobrir as duas tendas).
            ctx.fillStyle = corrupted ? 'rgba(15,8,20,0.3)' : 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 6, 62, 16, 0, 0, Math.PI * 2);
            ctx.fill();

            // Halo de luz quente à noite (mesmo princípio do campfire de
            // _drawEventIcon — um acampamento aceso deve iluminar o entorno
            // à noite, não só ter uma brasa desenhada num fundo escuro).
            if (isNight && !corrupted) {
                const glow = ctx.createRadialGradient(cx, cy - 4, 0, cx, cy - 4, 70);
                glow.addColorStop(0, 'rgba(255,150,50,0.3)');
                glow.addColorStop(1, 'rgba(255,150,50,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(cx, cy - 4, 70, 0, Math.PI * 2); ctx.fill();
            }

            // Brasas ainda vivas no meio do acampamento — mesmo tom
            // avermelhado usado no resto do jogo pra fogo, tingido de roxo
            // se a floresta estiver corrompida (animais/viajantes já
            // fugiram, só resta a fogueira apagando sozinha).
            ctx.fillStyle = corrupted ? 'rgba(90,40,110,0.5)' : 'rgba(255,120,40,0.5)';
            ctx.beginPath(); ctx.arc(cx, cy - 4, 12, 0, Math.PI * 2); ctx.fill();

            // Duas tendas triangulares simples, uma de cada lado da fogueira.
            ctx.fillStyle = corrupted ? '#2a2028' : '#6b5a3a';
            for (const dx of [-38, 34]) {
                ctx.beginPath();
                ctx.moveTo(cx + dx, cy + 4);
                ctx.lineTo(cx + dx + 20, cy + 4);
                ctx.lineTo(cx + dx + 10, cy - 34);
                ctx.closePath();
                ctx.fill();
            }
        }
    },

    // Torres de vigia de fronteira (pedido de "mundo vivo" — o lore já
    // menciona guardas de fronteira patrulhando à noite, ver LORE_ENTRIES em
    // _resolveEvent, mas nenhuma estrutura física correspondia a isso, só a
    // patrulha móvel `AMBIENT_ENTITIES.patrol`) — marco de terreno raro,
    // mesmo princípio determinístico/cullado de _drawGiantTrees/
    // _drawTravelCamps, sempre fora da faixa caminhável, nunca colide.
    // Torre de madeira simples com plataforma no topo; lanterna acesa à
    // noite (mesma linguagem visual da tocha de _drawCityGate) e sombra na
    // base (mesmo padrão já usado pelas árvores gigantes/acampamentos).
    _drawWatchtowers(ctx, w, h, corrupted, isNight) {
        const spacing = this.TOWER_SPACING;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        for (let i = firstIdx; i <= lastIdx; i++) {
            const tx = i * spacing;
            if (tx < 600 || tx > this.WORLD_LENGTH - 600) continue;
            if (this._hash(i * 113 + 13000) >= 45) continue; // torre rara, nem todo slot tem uma
            const side = (this._hash(i * 67 + 13500) % 2 === 0) ? -1 : 1;
            const ty = side * (this.LANE_HALF_HEIGHT + 90);
            if (!window.Camera.isVisible(tx, ty, w, h, 220)) continue;

            const towerH = 130;

            // Sombra no chão, antes de qualquer parte da torre.
            ctx.fillStyle = corrupted ? 'rgba(15,8,20,0.3)' : 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(tx, ty + 6, 34, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            // Quatro pernas de madeira em X, sustentando a plataforma.
            ctx.strokeStyle = corrupted ? '#2a2028' : '#4a3624';
            ctx.lineWidth = 6;
            for (const dx of [-22, 22]) {
                ctx.beginPath();
                ctx.moveTo(tx + dx * 0.3, ty);
                ctx.lineTo(tx + dx, ty - towerH);
                ctx.stroke();
            }

            // Plataforma + guarda-corpo no topo.
            ctx.fillStyle = corrupted ? '#3a2c30' : '#6b5a3a';
            ctx.fillRect(tx - 30, ty - towerH - 10, 60, 12);
            ctx.fillStyle = corrupted ? '#2a2028' : '#42352a';
            ctx.fillRect(tx - 30, ty - towerH - 26, 6, 16);
            ctx.fillRect(tx + 24, ty - towerH - 26, 6, 16);

            // Lanterna acesa à noite, mesma linguagem visual da tocha de
            // _drawCityGate — nunca some, só apaga o brilho de dia.
            if (isNight && !corrupted) {
                const glow = ctx.createRadialGradient(tx, ty - towerH - 32, 0, tx, ty - towerH - 32, 55);
                glow.addColorStop(0, 'rgba(255,200,90,0.35)');
                glow.addColorStop(1, 'rgba(255,200,90,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(tx, ty - towerH - 32, 55, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = isNight && !corrupted ? '#ffd27a' : '#8a7a5a';
            ctx.beginPath(); ctx.arc(tx, ty - towerH - 32, 6, 0, Math.PI * 2); ctx.fill();
        }
    },

    // Troncos caídos e cogumelos (Reformulação da Floresta — pedido
    // explícito na seção "Objetos": "espalhe naturalmente pelo caminho ...
    // troncos caídos; cogumelos"). Mais comuns que os marcos raros acima
    // (árvores gigantes/acampamentos/torres), mas ainda esparsos o
    // suficiente pra não virarem repetição óbvia. Determinístico via
    // _hash, nunca Math.random.
    _drawFallenLogsAndMushrooms(ctx, w, h, corrupted) {
        const spacing = this.LOG_MUSHROOM_SPACING;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        for (let i = firstIdx; i <= lastIdx; i++) {
            const px = i * spacing;
            if (px < 0 || px > this.WORLD_LENGTH) continue;
            if (this._hash(i * 101 + 36000) >= 45) continue; // nem todo slot tem um objeto
            const side = (this._hash(i * 59 + 36500) % 2 === 0) ? -1 : 1;
            const py = side * (this.LANE_HALF_HEIGHT + 30 + (this._hash(i * 43 + 37000) % 30));
            if (!window.Camera.isVisible(px, py, w, h, 60)) continue;

            const isLog = this._hash(i * 71 + 37500) % 2 === 0;
            if (isLog) {
                // Tronco caído — cor de casca neutra, como as pedras (não
                // muda com corrupção; é madeira morta/inerte, não "vida
                // ambiente" que foge/desaparece).
                const lean = ((this._hash(i * 89 + 38000) % 21) - 10);
                ctx.fillStyle = '#5a4530';
                ctx.beginPath();
                ctx.moveTo(px - 34, py + 6 + lean * 0.2);
                ctx.lineTo(px + 34, py - 6 - lean * 0.2);
                ctx.lineTo(px + 32, py + 2 - lean * 0.2);
                ctx.lineTo(px - 32, py + 14 + lean * 0.2);
                ctx.closePath();
                ctx.fill();
                // Topo cortado, mostrando os anéis do tronco.
                ctx.fillStyle = '#7a6142';
                ctx.beginPath(); ctx.ellipse(px + 34, py - 6 - lean * 0.2, 8, 6, -0.4, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#5a4530';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.ellipse(px + 34, py - 6 - lean * 0.2, 4, 3, -0.4, 0, Math.PI * 2); ctx.stroke();
            } else {
                // Cogumelos — cluster de 3, tingidos de roxo doentio quando
                // a floresta estiver corrompida (fungo prospera na
                // escuridão, mesmo princípio de "corrupção tinge tudo de
                // roxo" já usado em flores/arbustos/plantas).
                const capColor = corrupted ? 'rgba(90,40,110,0.85)' : 'rgba(190,60,50,0.85)';
                for (const [mdx, mdy, scale] of [[-6, 4, 1], [6, 5, 0.8], [0, -2, 1.2]]) {
                    const r = 5 * scale;
                    ctx.fillStyle = '#e8dcc8';
                    ctx.fillRect(px + mdx - 1, py + mdy, 2, 5 * scale);
                    ctx.fillStyle = capColor;
                    ctx.beginPath();
                    ctx.arc(px + mdx, py + mdy, r, Math.PI, 0);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
    },

    // Vagalumes noturnos (pedido do usuário: "floresta viva", mesma faixa de
    // slots/hash/culling já usada pela vegetação em draw() acima, só que
    // escalada por zone.vegDensity — Bosque/Floresta ganham bem mais
    // vagalumes que Campos, reforçando a mesma diferença de densidade já
    // usada pra vegetação/árvores gigantes). Nunca guarda array próprio: a
    // posição de cada vagalume é determinística (_hash do índice do slot) e
    // só o brilho pulsa com performance.now(), mesmo princípio das nuvens
    // (_drawSkyClouds) — puramente decorativo, sem colisão, fora de _events.
    _drawFireflies(ctx, w, h) {
        const spacing = 140;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        const t = performance.now() / 1000;
        for (let i = firstIdx; i <= lastIdx; i++) {
            const fx = i * spacing;
            if (fx < 0 || fx > this.WORLD_LENGTH) continue;
            const zone = this._zones[this._zoneIndexAt(fx)];
            if (this._hash(i * 137 + 21000) >= 22 * zone.vegDensity) continue;
            const side = (this._hash(i * 61 + 21500) % 2 === 0) ? -1 : 1;
            const fy = side * (this.LANE_HALF_HEIGHT - 30) - (this._hash(i * 29 + 22000) % 40);
            if (!window.Camera.isVisible(fx, fy, w, h)) continue;

            // Cada vagalume tem sua própria fase/altura de flutuação (a
            // partir do próprio índice do slot, sem estado guardado) pra não
            // piscarem todos em sincronia — flutuação vertical leve +
            // pulsação de opacidade, igual um inseto real de verdade voando.
            const phase = (i * 2.399) % (Math.PI * 2);
            const floatY = Math.sin(t * 1.3 + phase) * 8;
            const pulse = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.6 + phase * 1.7));
            const gx = fx + Math.cos(t * 0.7 + phase) * 6;
            const gy = fy + floatY;

            const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 9);
            glow.addColorStop(0, `rgba(210,255,140,${pulse})`);
            glow.addColorStop(1, 'rgba(210,255,140,0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(gx, gy, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255,255,220,${Math.min(1, pulse + 0.3)})`;
            ctx.beginPath(); ctx.arc(gx, gy, 1.6, 0, Math.PI * 2); ctx.fill();
        }
    },

    // Poeira/pólen flutuando (Reformulação da Floresta — pedido explícito:
    // "partículas de poeira e pólen"). Diferente dos vagalumes acima (só à
    // noite), poeira/pólen faz sentido o dia INTEIRO — a luz do sol é que
    // faz esse tipo de partícula ficar visível, então aparece de dia e de
    // noite, sem depender do relógio. Especks pálidos/dourados bem
    // pequenos, deriva lenta senoidal (mesmo princípio de fase própria por
    // índice, sem estado guardado, dos vagalumes) — bem mais sutil (raio
    // menor, opacidade mais baixa) já que é poeira, não um inseto
    // brilhando.
    _drawDustMotes(ctx, w, h) {
        const spacing = 95;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        const t = performance.now() / 1000;
        for (let i = firstIdx; i <= lastIdx; i++) {
            const mx = i * spacing;
            if (mx < 0 || mx > this.WORLD_LENGTH) continue;
            const zone = this._zones[this._zoneIndexAt(mx)];
            if (this._hash(i * 149 + 27000) >= 16 * zone.vegDensity) continue;
            const side = (this._hash(i * 79 + 27500) % 2 === 0) ? -1 : 1;
            const my = side * (this._hash(i * 37 + 28000) % this.LANE_HALF_HEIGHT);
            if (!window.Camera.isVisible(mx, my, w, h)) continue;

            const phase = (i * 1.847) % (Math.PI * 2);
            const floatY = Math.sin(t * 0.35 + phase) * 22;
            const floatX = Math.cos(t * 0.22 + phase * 1.4) * 14;
            const opacity = 0.14 + 0.14 * (0.5 + 0.5 * Math.sin(t * 0.6 + phase * 0.9));

            ctx.fillStyle = `rgba(255,240,200,${opacity})`;
            ctx.beginPath();
            ctx.arc(mx + floatX, my + floatY, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Borboletas (Reformulação da Floresta — pedido explícito: "borboletas"
    // na lista de ambientação viva, ao lado de pássaros e insetos). Só faz
    // sentido de dia -- ao contrário dos vagalumes, que brilham no escuro --
    // e não voa debaixo de chuva/tempestade (mesmo critério de coerência
    // climática já usado no resto do arquivo). Par de asas em elipses que
    // abrem/fecham com o tempo (`sin`) simulando o bater de asas, cor
    // variando por índice (determinístico via _hash, nunca Math.random)
    // entre 3 paletas comuns de borboleta. Trajetória "esvoaçante" -- soma
    // de senos/cossenos em frequências diferentes -- deliberadamente mais
    // errática que a deriva lenta e suave da poeira/pólen acima.
    _drawButterflies(ctx, w, h) {
        const spacing = 210;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        const t = performance.now() / 1000;
        for (let i = firstIdx; i <= lastIdx; i++) {
            const bx = i * spacing;
            if (bx < 0 || bx > this.WORLD_LENGTH) continue;
            const zone = this._zones[this._zoneIndexAt(bx)];
            if (this._hash(i * 157 + 34000) >= 14 * zone.vegDensity) continue;
            const side = (this._hash(i * 89 + 34500) % 2 === 0) ? -1 : 1;
            const by0 = side * (this._hash(i * 47 + 35000) % this.LANE_HALF_HEIGHT);

            const phase = (i * 3.11) % (Math.PI * 2);
            const flitX = Math.sin(t * 0.9 + phase) * 26 + Math.cos(t * 2.1 + phase * 1.6) * 8;
            const flitY = Math.cos(t * 0.6 + phase * 1.3) * 18;
            const bxPos = bx + flitX;
            const byPos = by0 + flitY;
            if (!window.Camera.isVisible(bxPos, byPos, w, h)) continue;

            const palette = this._hash(i * 71 + 35500) % 3;
            const wingColor = palette === 0 ? 'rgba(255,170,40,0.85)' : (palette === 1 ? 'rgba(255,255,255,0.85)' : 'rgba(120,170,255,0.85)');
            const flap = 0.3 + 0.7 * Math.abs(Math.sin(t * 8 + phase));
            const wingW = 5 + flap * 3;

            ctx.fillStyle = wingColor;
            ctx.beginPath(); ctx.ellipse(bxPos - wingW * 0.5, byPos, wingW, 4, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(bxPos + wingW * 0.5, byPos, wingW, 4, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(40,30,20,0.8)';
            ctx.beginPath(); ctx.arc(bxPos, byPos, 1.2, 0, Math.PI * 2); ctx.fill();
        }
    },

    // Folhas caídas no chão (Reformulação da Floresta — pedido explícito na
    // seção "Caminho": "folhas caídas"). Diferente da folhagem em parallax
    // pendurada dos galhos (_drawForegroundLeaves, Ciclo 45, sempre em
    // coordenada de TELA, nunca no mundo), estas são decalques PLANOS no
    // CHÃO de verdade — podem cair dentro da faixa caminhável inteira (não
    // só nas laterais como a vegetação esparsa comum), já que folha caída
    // não bloqueia passagem. Sempre estáticas (folha no chão não flutua,
    // ao contrário das borboletas/vagalumes acima) e tingidas de roxo
    // doentio durante corrupção, mesmo critério já usado no resto do
    // arquivo.
    _drawFallenLeaves(ctx, w, h, corrupted) {
        const spacing = this.LEAF_DECAL_SPACING;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        const palette = corrupted
            ? ['rgba(70,35,85,0.55)', 'rgba(55,25,70,0.5)', 'rgba(85,45,100,0.6)']
            : ['rgba(200,120,40,0.55)', 'rgba(180,60,40,0.5)', 'rgba(210,170,50,0.55)'];
        for (let i = firstIdx; i <= lastIdx; i++) {
            const lx = i * spacing;
            if (lx < 0 || lx > this.WORLD_LENGTH) continue;
            const zone = this._zones[this._zoneIndexAt(lx)];
            if (this._hash(i * 179 + 41000) >= 30 * zone.vegDensity) continue; // nem todo slot tem folha
            const ly = (this._hash(i * 97 + 41500) % (this.LANE_HALF_HEIGHT * 2)) - this.LANE_HALF_HEIGHT;
            if (!window.Camera.isVisible(lx, ly, w, h)) continue;

            const colorIdx = this._hash(i * 53 + 42000) % palette.length;
            const rot = (this._hash(i * 29 + 42500) % 63) * 0.1;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(rot);
            ctx.fillStyle = palette[colorIdx];
            ctx.beginPath();
            ctx.moveTo(0, -5);
            ctx.quadraticCurveTo(4, 0, 0, 5);
            ctx.quadraticCurveTo(-4, 0, 0, -5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    },

    // Entidades "de verdade" (bug corrigido: bandido/Espírito da Natureza/
    // presença da Corrupção eram só um círculo colorido com um emoji em
    // cima, nunca um personagem — "NPCs, criaturas... representados por
    // emojis", pedido do usuário). Reaproveita o MESMO GFX.drawGladiator()
    // usado pelo jogador/NPCs da Praça, com um `entity` sintético mínimo
    // (visuals/equipment/raça) — nunca lutam como Entity de verdade (o
    // combate continua disparado por proximidade, ver _updateBandits), só
    // agora têm a MESMA linguagem visual do resto do jogo em vez de um
    // ícone flutuando sobre uma bolinha.
    CREATURE_ENTITIES: {
        bandit: {
            visuals: { gender: 'Masculino', skinTone: '#c89a72', hairStyle: 4, hairColor: '#1a1410', beardStyle: 3, eyeColor: '#2a1414', faceShape: 1 },
            equipment: {}, __teamColor: '#3a2e26', race: 'humano'
        },
        nature_spirit: {
            visuals: { gender: 'Feminino', skinTone: '#9ee8ac', hairStyle: 6, hairColor: '#2a6a34', beardStyle: 0, eyeColor: '#d8ffe0', faceShape: 1 },
            equipment: {}, __teamColor: '#3a6a44', race: 'elfo'
        },
        corruption: {
            visuals: { gender: 'Masculino', skinTone: '#4a2050', hairStyle: 2, hairColor: '#1a0a20', beardStyle: 0, eyeColor: '#c020e0', faceShape: 1 },
            equipment: {}, __teamColor: '#2a1030', race: 'humano'
        }
    },

    // Identidade regional do bandido (pedido "identidade visual" da
    // mega-diretiva) — antes TODO bandido usava exatamente a mesma raça/
    // aparência humana fixa (CREATURE_ENTITIES.bandit), não importa se a
    // travessia era rumo à Fortaleza Orc ou ao Santuário Élfico, ao
    // contrário do Duelo Rápido (que já pondera raça pelo raceDemographics
    // da cidade, ver enemy.js). `null` = mantém a aparência humana padrão
    // (natureza/cidade sem roadFamily ainda). Tons de pele lidos de
    // window.RACES (races.js) — nunca duplica a paleta, só referencia.
    BANDIT_VARIANTS: {
        natureza: null,
        orc: { race: 'orc', hairColor: '#1a1410' },
        elfico: { race: 'elfo', hairColor: '#2a3a1a' }
    },

    // Mesmo princípio acima, agora pro viajante comum (evento interativo
    // `traveler` E o `npc_traveler` ambiente que só passa andando, ver
    // _drawAmbientLife) — pendência explícita deixada no Ciclo 16
    // ("considerar estender BANDIT_VARIANTS pra outros encontros"). Um
    // viajante rumo à Fortaleza Orc ou saindo dela faz mais sentido sendo
    // um orc de verdade do que sempre a mesma humana fixa.
    TRAVELER_VARIANTS: {
        natureza: null,
        orc: { race: 'orc', hairColor: '#2a2010' },
        elfico: { race: 'elfo', hairColor: '#3a2a4a' }
    },

    // Helper compartilhado por _makeBanditEntity/_makeTravelerEntity — dada
    // uma entidade base + mapa de variantes por família, decide a família
    // certa (primeira metade da travessia = cidade de ORIGEM, segunda
    // metade = DESTINO, mesmo critério de zonas/BANDIT_VARIANTS) e monta
    // uma cópia só quando existe variante; sem variante, retorna a MESMA
    // referência da base, preservando 100% o comportamento antigo.
    _makeRegionalEntity(base, variants, x, fromId, toId, hashSalt) {
        const familyId = x < this.WORLD_LENGTH / 2
            ? ((window.CityDatabase[fromId] && window.CityDatabase[fromId].roadFamily) || 'natureza')
            : ((window.CityDatabase[toId] && window.CityDatabase[toId].roadFamily) || 'natureza');
        const variant = variants[familyId];
        if (!variant) return base;
        const raceDef = window.RACES && window.RACES[variant.race];
        const skinTones = raceDef && raceDef.skinTones;
        const skinTone = skinTones ? skinTones[this._hash(Math.floor(x) + hashSalt) % skinTones.length] : base.visuals.skinTone;
        return {
            // Bug corrigido no Ciclo 22 (achado durante o design do
            // `rival_gladiator`, ver AMBIENT_ENTITIES abaixo): antes o
            // clone regional sempre zerava `equipment` pra `{}`, inofensivo
            // até agora porque nenhuma base existente (bandido/viajante/
            // comerciante/patrulha/condutor) tinha equipamento nenhum — mas
            // silenciosamente descartaria a arma visível de qualquer base
            // futura que tivesse. `base.equipment || {}` preserva o
            // equipamento da base em qualquer variante, com o MESMO
            // resultado de antes pras entidades que já não tinham nada.
            visuals: { ...base.visuals, skinTone, hairColor: variant.hairColor },
            equipment: base.equipment || {}, __teamColor: base.__teamColor, race: variant.race
        };
    },

    // Gera um bandido com a identidade regional certa (ver
    // BANDIT_VARIANTS/_makeRegionalEntity acima).
    _makeBanditEntity(x, fromId, toId) {
        return this._makeRegionalEntity(this.CREATURE_ENTITIES.bandit, this.BANDIT_VARIANTS, x, fromId, toId, 9100);
    },

    // Gera um viajante com a identidade regional certa (ver
    // TRAVELER_VARIANTS/_makeRegionalEntity acima) — usado tanto pelo
    // evento interativo `traveler` quanto pelo `npc_traveler` ambiente.
    _makeTravelerEntity(x, fromId, toId) {
        return this._makeRegionalEntity(this.AMBIENT_ENTITIES.npc_traveler, this.TRAVELER_VARIANTS, x, fromId, toId, 9400);
    },

    // Identidade regional da PATRULHA (pendência explícita deixada no
    // Ciclo 18: "se um dia fizer sentido variar a patrulha por cidade de
    // ORIGEM apenas") — ao contrário de bandido/viajante/comerciante
    // (que trocam de família na METADE da travessia, ver
    // _makeRegionalEntity), a patrulha representa a guarda da cidade de
    // ORIGEM escoltando a própria estrada de saída, então usa SEMPRE a
    // família de `fromId`, do início ao fim da travessia, nunca a de
    // destino. Reaproveita _makeRegionalEntity passando x=0 (sempre cai
    // no ramo "primeira metade" = origem) em vez de duplicar a lógica de
    // seleção de família.
    PATROL_VARIANTS: {
        natureza: null,
        orc: { race: 'orc', hairColor: '#1a1410' },
        elfico: { race: 'elfo', hairColor: '#2a3a2a' }
    },
    _makePatrolEntity(fromId, toId) {
        return this._makeRegionalEntity(this.AMBIENT_ENTITIES.patrol, this.PATROL_VARIANTS, 0, fromId, toId, 9900);
    },

    // Identidade regional do gladiador rival ambiente (Ciclo 22) — mesmo
    // critério de metade da travessia já usado por bandido/viajante/
    // comerciante (posição fixa dentro do chunk, ver _drawAmbientLife).
    RIVAL_GLADIATOR_VARIANTS: {
        natureza: null,
        orc: { race: 'orc', hairColor: '#1a1410' },
        elfico: { race: 'elfo', hairColor: '#2a2a4a' }
    },
    _makeRivalGladiatorEntity(x, fromId, toId) {
        return this._makeRegionalEntity(this.AMBIENT_ENTITIES.rival_gladiator, this.RIVAL_GLADIATOR_VARIANTS, x, fromId, toId, 9200);
    },

    // Condutor da caravana (Ciclo 21) — antes a caravana ambiente era só a
    // carroça desenhada à mão, sem NENHUMA pessoa a conduzindo, mesmo
    // atravessando o mundo inteiro continuamente ("caravanas devem
    // viajar", pedido do usuário). Ao contrário de bandido/viajante/
    // comerciante (posição FIXA, família decidida uma vez na geração do
    // evento) e da patrulha (família fixa na origem), a caravana se move
    // pelo MUNDO INTEIRO em loop (ver _drawAmbientLife), então sua
    // identidade regional é recalculada A CADA QUADRO a partir da posição
    // atual — o condutor muda de aparência conforme a caravana atravessa
    // cada metade da travessia, reforçando visualmente a mesma transição
    // de região já usada em zonas/placas/bandidos.
    CARAVAN_DRIVER_ENTITY: {
        visuals: { gender: 'Masculino', skinTone: '#c8a068', hairStyle: 2, hairColor: '#4a3018', beardStyle: 2, eyeColor: '#2a1a14', faceShape: 1 },
        equipment: {}, __teamColor: '#6b4a2a', race: 'humano'
    },
    CARAVAN_VARIANTS: {
        natureza: null,
        orc: { race: 'orc', hairColor: '#1a1410' },
        elfico: { race: 'elfo', hairColor: '#3a2a4a' }
    },
    _makeCaravanDriverEntity(x, fromId, toId) {
        return this._makeRegionalEntity(this.CARAVAN_DRIVER_ENTITY, this.CARAVAN_VARIANTS, x, fromId, toId, 9600);
    },

    _drawCreature(ctx, ev) {
        const entity = ev.entity || this.CREATURE_ENTITIES[ev.type];
        if (!entity || !window.GFX || !window.GFX.drawGladiator) return;
        const anim = ev._anim || (ev._anim = { type: 'idle', start: performance.now(), duration: 0 });
        ctx.save();
        ctx.translate(ev.x, ev.y);
        ctx.scale(this.PLAYER_SCALE, this.PLAYER_SCALE);
        window.GFX.drawGladiator(ctx, 0, 0, entity, true, anim, null);
        ctx.restore();
    },

    // Ícones de objetos físicos (bug corrigido: chest/bridge/shrine/etc.
    // eram só um círculo colorido com um emoji em cima — "eventos
    // aleatórios ainda representados por emojis", pedido do usuário).
    // Cada tipo agora tem uma forma própria 100% desenhada à mão, no MESMO
    // estilo já usado pelo resto do arquivo (rio, árvores gigantes,
    // acampamentos) — nunca um ícone de fonte, sempre geometria real.
    // `traveler` e `wounded_gladiator` são PESSOA pura (GFX.drawGladiator()
    // de _drawCreature/_drawAmbientHuman em vez de um objeto); `merchant` é
    // híbrido — mantém a barraca/tenda desenhada à mão E ganha um
    // comerciante de verdade ao lado dela (ver MERCHANT_ENTITY abaixo).
    WOUNDED_GLADIATOR_ENTITY: {
        visuals: { gender: 'Masculino', skinTone: '#d8a878', hairStyle: 8, hairColor: '#3a2a1a', beardStyle: 1, eyeColor: '#2a1a14', faceShape: 1 },
        equipment: {}, __teamColor: '#6b2a2a', race: 'humano'
    },

    // Comerciante da estrada (evento `merchant`) — antes só a barraca/tenda
    // era desenhada, sem NENHUMA pessoa ao lado, mesmo o toast de
    // _resolveEvent falando de "o comerciante compra uma bugiganga sua"
    // (implica alguém ali, não só um móvel vazio). Ganha identidade regional
    // igual bandido/viajante (Ciclos 16/18, mesmo helper _makeRegionalEntity)
    // — um comerciante rumo à Fortaleza Orc faz mais sentido sendo um orc de
    // verdade do que sempre a mesma humana fixa.
    MERCHANT_ENTITY: {
        visuals: { gender: 'Feminino', skinTone: '#e0b088', hairStyle: 7, hairColor: '#6a3a1a', beardStyle: 0, eyeColor: '#2a1a14', faceShape: 1 },
        equipment: {}, __teamColor: '#8a5a2a', race: 'humano'
    },
    MERCHANT_VARIANTS: {
        natureza: null,
        orc: { race: 'orc', hairColor: '#1a1410' },
        elfico: { race: 'elfo', hairColor: '#4a3a1a' }
    },
    _makeMerchantEntity(x, fromId, toId) {
        return this._makeRegionalEntity(this.MERCHANT_ENTITY, this.MERCHANT_VARIANTS, x, fromId, toId, 9700);
    },
    _drawEventIcon(ctx, ev, corrupted, isNight) {
        const t = ev.type;
        if (t === 'traveler') {
            const entity = ev.entity || this.AMBIENT_ENTITIES.npc_traveler;
            if (window.GFX && window.GFX.drawGladiator) {
                const anim = ev._anim || (ev._anim = { type: 'idle', start: performance.now(), duration: 0 });
                ctx.save();
                ctx.translate(ev.x, ev.y);
                ctx.scale(this.PLAYER_SCALE * 0.85, this.PLAYER_SCALE * 0.85);
                window.GFX.drawGladiator(ctx, 0, 0, entity, true, anim, null);
                ctx.restore();
            }
            return;
        }
        if (t === 'wounded_gladiator') {
            // Item explícito da lista original do usuário ("gladiador
            // ferido") — pose 'hurt' fixa (nunca idle/walk, ele não está
            // de pé) reaproveita a MESMA animação de dano já usada em
            // batalha, sem precisar desenhar uma pose nova do zero. Cruz
            // vermelha simples flutuando acima sinaliza "precisa de ajuda"
            // à distância, antes do jogador chegar perto o bastante pro
            // aviso de interação normal aparecer.
            const entity = this.WOUNDED_GLADIATOR_ENTITY;
            if (window.GFX && window.GFX.drawGladiator) {
                const anim = ev._anim || (ev._anim = { type: 'hurt', start: performance.now(), duration: 0 });
                ctx.save();
                ctx.translate(ev.x, ev.y);
                ctx.scale(this.PLAYER_SCALE * 0.85, this.PLAYER_SCALE * 0.85);
                window.GFX.drawGladiator(ctx, 0, 0, entity, true, anim, null);
                ctx.restore();
            }
            ctx.save();
            ctx.translate(ev.x, ev.y - 55);
            ctx.fillStyle = 'rgba(220,50,50,0.9)';
            ctx.fillRect(-2, -8, 4, 16);
            ctx.fillRect(-8, -2, 16, 4);
            ctx.restore();
            return;
        }
        ctx.save();
        ctx.translate(ev.x, ev.y);
        if (t === 'merchant') {
            ctx.fillStyle = '#8a5a2a';
            ctx.fillRect(-14, 2, 28, 8);
            ctx.fillStyle = corrupted ? '#5a3a4a' : '#c9445a';
            ctx.beginPath();
            ctx.moveTo(-16, 2); ctx.lineTo(0, -14); ctx.lineTo(16, 2);
            ctx.closePath(); ctx.fill();
            // Comerciante em pessoa, parado ao lado da própria barraca (ver
            // MERCHANT_ENTITY/_makeMerchantEntity acima) — antes só a
            // tenda/móvel aparecia, sem ninguém ali pra negociar de verdade.
            const merchantEntity = ev.entity || this.MERCHANT_ENTITY;
            if (window.GFX && window.GFX.drawGladiator) {
                const anim = ev._anim || (ev._anim = { type: 'idle', start: performance.now(), duration: 0 });
                ctx.save();
                ctx.translate(28, 8);
                ctx.scale(this.PLAYER_SCALE * 0.8, this.PLAYER_SCALE * 0.8);
                window.GFX.drawGladiator(ctx, 0, 0, merchantEntity, false, anim, null);
                ctx.restore();
            }
        } else if (t === 'chest') {
            ctx.fillStyle = '#6b4a2a';
            ctx.fillRect(-14, -4, 28, 14);
            ctx.fillStyle = '#8a6a3a';
            ctx.beginPath(); ctx.ellipse(0, -4, 14, 6, 0, Math.PI, 0, true); ctx.fill();
            ctx.fillStyle = '#d4af37';
            ctx.fillRect(-3, -6, 6, 6);
        } else if (t === 'secret') {
            ctx.fillStyle = '#5a4a34';
            ctx.beginPath(); ctx.ellipse(0, 6, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,120,0.9)';
            ctx.beginPath(); ctx.arc(2, 0, 4, 0, Math.PI * 2); ctx.fill();
        } else if (t === 'campfire') {
            // Halo de luz quente (pedido "mundo vivo": uma fogueira à noite
            // deve parecer ACESA, iluminando o entorno, não só ter uma
            // chama desenhada em cima de um fundo escuro) — só de noite e
            // só sem corrupção (fogueira corrompida já é "apagando
            // sozinha", ver _drawTravelCamps).
            if (isNight && !corrupted) {
                const glow = ctx.createRadialGradient(0, -2, 0, 0, -2, 46);
                glow.addColorStop(0, 'rgba(255,150,50,0.35)');
                glow.addColorStop(1, 'rgba(255,150,50,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(0, -2, 46, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#4a4a4a';
            [[-10, 4], [10, 4], [0, 9]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill(); });
            ctx.fillStyle = '#ff8a1e';
            ctx.beginPath();
            ctx.moveTo(0, 6); ctx.quadraticCurveTo(-6, -4, 0, -14); ctx.quadraticCurveTo(6, -4, 0, 6);
            ctx.fill();
        } else if (t === 'cart') {
            ctx.save();
            ctx.rotate(0.25);
            ctx.fillStyle = '#5a3e26';
            ctx.fillRect(-16, -6, 32, 14);
            ctx.restore();
            ctx.fillStyle = '#2a1c10';
            ctx.beginPath(); ctx.arc(-12, 10, 6, 0, Math.PI * 2); ctx.fill();
        } else if (t === 'ruins') {
            ctx.fillStyle = corrupted ? '#4a4038' : '#a89a82';
            ctx.fillRect(-14, -10, 6, 20);
            ctx.fillRect(2, -4, 6, 14);
            ctx.fillRect(-4, -16, 6, 26);
        } else if (t === 'cave') {
            ctx.fillStyle = '#1a1a1e';
            ctx.beginPath();
            ctx.moveTo(-14, 10); ctx.lineTo(-14, -2); ctx.quadraticCurveTo(0, -16, 14, -2); ctx.lineTo(14, 10);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#3a352e'; ctx.lineWidth = 3; ctx.stroke();
        } else if (t === 'bridge') {
            ctx.strokeStyle = '#7a7264'; ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(0, 10, 14, Math.PI, 0); ctx.stroke();
        } else if (t === 'shrine') {
            ctx.fillStyle = '#c9a876';
            ctx.fillRect(-10, -2, 20, 10);
            ctx.fillRect(-6, -12, 12, 10);
            ctx.fillStyle = 'rgba(180,150,60,0.9)';
            ctx.beginPath(); ctx.arc(0, -14, 4, 0, Math.PI * 2); ctx.fill();
        } else if (t === 'hollow_tree') {
            // "Árvore oca" — tronco grosso e curto (reaproveita a mesma
            // linguagem visual orgânica das árvores gigantes, ver
            // _drawGiantTrees) com um buraco escuro na base, sempre
            // visível mesmo de longe, sinalizando "isso pode ser
            // explorado" antes do jogador chegar perto o bastante pro
            // aviso de interação normal aparecer.
            ctx.fillStyle = corrupted ? '#241c14' : '#4a3624';
            ctx.beginPath();
            ctx.moveTo(-16, 14);
            ctx.quadraticCurveTo(-18, -6, -8, -18);
            ctx.lineTo(8, -18);
            ctx.quadraticCurveTo(18, -6, 16, 14);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = corrupted ? '#0d0810' : '#1a1410';
            ctx.beginPath();
            ctx.ellipse(0, 8, 7, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (t === 'magic_stone') {
            ctx.fillStyle = 'rgba(150,80,220,0.9)';
            ctx.beginPath();
            ctx.moveTo(0, -14); ctx.lineTo(8, -2); ctx.lineTo(4, 12); ctx.lineTo(-4, 12); ctx.lineTo(-8, -2);
            ctx.closePath(); ctx.fill();
        } else if (t === 'lore_book') {
            ctx.fillStyle = '#8a6a3a';
            ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-14, -4); ctx.lineTo(-14, 8); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(14, -4); ctx.lineTo(14, 8); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
        } else if (t === 'clearing_treasure') {
            // Montinho de terra revirada + gemas brilhando pra fora — visual
            // distinto de 'secret' (esconderijo comum, na faixa normal da
            // estrada), sinalizando "isso só existe porque você saiu do
            // caminho". Brilho pulsante (seno do tempo) chama atenção de
            // longe, incentivo real de ir até a beirada da clareira.
            const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 260);
            ctx.fillStyle = '#4a3a28';
            ctx.beginPath(); ctx.ellipse(0, 8, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
            const gems = [[-8, 0, '#8a3ae0'], [0, -4, '#3ac0e0'], [8, 1, '#e0a83a']];
            gems.forEach(([gx, gy, color]) => {
                ctx.fillStyle = color;
                ctx.globalAlpha = pulse;
                ctx.beginPath(); ctx.arc(gx, gy, 4, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
            });
        } else if (t === 'rare_animal') {
            // "Animal raro" (último item pendente da lista original) —
            // reaproveita a MESMA silhueta de cervo já usada pelo 'animal'
            // ambiente comum (_drawAmbientAnimal), mas com pelagem
            // pálida/dourada em vez de castanha comum, chifres SEMPRE
            // presentes (o ambiente comum só tem chifre em metade dos
            // casos) e um brilho suave pulsante ao redor — a diferença
            // visual precisa ser clara à distância pra "raro" significar
            // algo, nunca só um animal comum reaproveitado sem alteração.
            const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 500);
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
            glow.addColorStop(0, `rgba(255,230,150,${0.28 * pulse})`);
            glow.addColorStop(1, 'rgba(255,230,150,0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e8d8a8';
            ctx.beginPath();
            ctx.ellipse(0, 4, 16, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(14, -4, 7, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#c8a868';
            ctx.lineWidth = 2;
            for (const lx of [-8, 8]) {
                ctx.beginPath(); ctx.moveTo(lx, 10); ctx.lineTo(lx, 18); ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(16, -9); ctx.lineTo(19, -15);
            ctx.moveTo(20, -9); ctx.lineTo(23, -15);
            ctx.moveTo(17, -10); ctx.lineTo(21, -13);
            ctx.stroke();
        } else {
            // Fallback pra qualquer tipo futuro sem ícone próprio ainda —
            // um marcador neutro simples, nunca um emoji.
            ctx.fillStyle = 'rgba(60,45,30,0.85)';
            ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    },

    _drawEvent(ctx, ev, corrupted, isNight) {
        if (this.CREATURE_ENTITIES[ev.type]) { this._drawCreature(ctx, ev); return; }
        this._drawEventIcon(ctx, ev, corrupted, isNight);
    },

    // Placa de fronteira de zona — a barra agora usa a MESMA vegColor da
    // zona que começa ali (ver ZONE_FAMILY_STAGES/citydatabase.js) em vez
    // de branco genérico sempre, dando uma pista de identidade regional já
    // na própria placa (nunca só no texto) — mesmo princípio do HUD com
    // --road-accent (Ciclo 10), agora dentro do próprio mundo. Alpha
    // forçado alto (0.9) pra continuar legível independente da opacidade
    // original da cor (vegColor normalmente é bem translúcida, pensada pra
    // tingir vegetação, não pra ser uma barra sólida).
    _drawMarker(ctx, x, label, tintColor) {
        ctx.fillStyle = tintColor ? tintColor.replace(/[\d.]+\)$/, '0.9)') : 'rgba(255,255,255,0.85)';
        ctx.fillRect(x - 3, -this.LANE_HALF_HEIGHT, 6, this.LANE_HALF_HEIGHT * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, -this.LANE_HALF_HEIGHT - 12);
    },

    // Portão de cidade (início/fim da travessia) — uma faixa de chão que
    // mistura cor de estrada com um tom de pedra (gradiente, sem trocar o
    // cenário de golpe) mais um arco simples de dois postes + lintel, dando
    // a sensação de atravessar um limite de verdade em vez de uma linha
    // nua. Fronteiras internas de bioma (Campos/Bosque/Floresta) continuam
    // usando o _drawMarker simples — só início/fim de cidade ganham o portão.
    _drawCityGate(ctx, x, label, isNight) {
        const half = this.LANE_HALF_HEIGHT;
        const r = this.GATE_ZONE_RADIUS;

        const grad = ctx.createLinearGradient(x - r, 0, x + r, 0);
        grad.addColorStop(0, 'rgba(130,120,105,0)');
        grad.addColorStop(0.5, 'rgba(130,120,105,0.55)');
        grad.addColorStop(1, 'rgba(130,120,105,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, -half, r * 2, half * 2);

        const postW = 14, postH = 90, postGap = 46;
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(x - postGap - postW / 2, -postH, postW, postH * 2);
        ctx.fillRect(x + postGap - postW / 2, -postH, postW, postH * 2);
        ctx.fillStyle = '#42352a';
        ctx.fillRect(x - postGap - postW / 2 - 4, -postH - 16, postGap * 2 + postW + 8, 16);

        // Tochas nos dois postes (pedido "mundo vivo"/identidade visual: o
        // portão da Praça já é todo iluminado à noite, ver
        // CityEngine._drawCityWall/_drawTorch — o portão da Estrada, a
        // MESMA estrutura vista do lado de fora, ficava sempre apagado,
        // mesma linguagem visual do halo já usado em fogueiras/acampamentos
        // (ver _drawEventIcon/_drawTravelCamps), só que fixo no poste em
        // vez de tremular junto com uma chama animada — mantém o custo por
        // frame mínimo (sem Particle/flicker extra, só um brilho radial).
        const torchY = -postH * 0.55; // meio do poste, longe da viga de cima e do chão
        for (const side of [-1, 1]) {
            const tx = x + side * (postGap + postW / 2 + 8); // colada na face externa de cada poste, nunca sobre a madeira
            if (isNight) {
                const glow = ctx.createRadialGradient(tx, torchY, 0, tx, torchY, 40);
                glow.addColorStop(0, 'rgba(255,160,60,0.32)');
                glow.addColorStop(1, 'rgba(255,160,60,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(tx, torchY, 40, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#ff8a1e';
            ctx.beginPath(); ctx.ellipse(tx, torchY, 6, 10, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe08a';
            ctx.beginPath(); ctx.ellipse(tx, torchY + 1, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, -postH - 26);
    },

    // Personagem de verdade (pedido do usuário: "a aparência deve
    // permanecer exatamente a mesma em qualquer ambiente") — bug corrigido
    // nesta iteração: a Estrada NUNCA usava o mesmo GFX.drawGladiator() da
    // Praça/Arena, desenhava um boneco de bastão genérico próprio (linhas +
    // um círculo de cor de pele fixa), então o jogador literalmente TROCAVA
    // de aparência (perdia raça, cabelo, equipamento visível, tudo) assim
    // que entrava numa travessia — incluindo a Floresta Ancestral. Agora
    // reaproveita `this.player` (o Player REAL, com visuals/equipment/raça
    // — nunca `this._player`, que é só o estado de movimento local x/y/vx/
    // vy) exatamente como city.js _drawPlayer já faz na Praça, com a MESMA
    // escala (PLAYER_SCALE = CityEngine.PLAYER_EXTRA_SHRINK) pra nunca
    // parecer um personagem "diferente" de tamanho ao viajar.
    _drawPlayer(ctx) {
        const p = this._player;
        if (!this.player || !window.GFX || !window.GFX.drawGladiator) return;
        const anim = this._playerAnim || (this._playerAnim = { type: 'idle', start: performance.now(), duration: 0 });
        anim.type = p.moving ? 'walk' : 'idle';
        const scale = this.PLAYER_SCALE;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(scale, scale);
        window.GFX.drawGladiator(ctx, 0, 0, this.player, (p.facing || 1) > 0, anim, null);
        ctx.restore();
    },

    // Montaria (pedido explícito da mega-diretiva: "utilizar montarias
    // quando desbloqueadas") — `mode === 'horse'` já existia (afeta
    // velocidade/fadiga, ver start()/_updateMovement) mas o jogador
    // continuava visualmente IDÊNTICO a pé ou a cavalo, sem nenhum cavalo
    // desenhado. Camada 100% separada, desenhada ANTES de `_drawPlayer`
    // (nunca dentro dela) pra jamais tocar em `GFX.drawGladiator` — o
    // código que corrigiu o bug de aparência do jogador nas florestas
    // (bug #1) é sensível demais pra arriscar qualquer alteração aqui.
    _drawMount(ctx) {
        if (this.mode !== 'horse') return;
        const p = this._player;
        const scale = this.PLAYER_SCALE;
        const facing = (p.facing || 1) > 0 ? 1 : -1;
        const t = performance.now() / 1000;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(scale * facing, scale);
        // Corpo
        ctx.fillStyle = '#5a3a24';
        ctx.beginPath();
        ctx.ellipse(-6, -18, 34, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pescoço + cabeça, esticados na direção do movimento
        ctx.beginPath();
        ctx.moveTo(20, -28);
        ctx.quadraticCurveTo(38, -34, 44, -50);
        ctx.quadraticCurveTo(46, -54, 42, -56);
        ctx.quadraticCurveTo(32, -50, 24, -38);
        ctx.quadraticCurveTo(18, -30, 18, -22);
        ctx.closePath();
        ctx.fill();
        // Crina
        ctx.strokeStyle = '#2a1c10';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(26, -42); ctx.lineTo(18, -30);
        ctx.moveTo(33, -46); ctx.lineTo(25, -34);
        ctx.stroke();
        // Rabo
        ctx.beginPath();
        ctx.moveTo(-38, -22);
        ctx.quadraticCurveTo(-50, -8, -44, 8);
        ctx.stroke();
        // Pernas — passada alternada só quando o jogador está de fato
        // andando (mesmo campo `p.moving` que já controla a animação de
        // caminhada do jogador em _drawPlayer, nunca duplicando estado).
        ctx.strokeStyle = '#3a2415';
        ctx.lineWidth = 6;
        const legX = [-22, -8, 8, 20];
        legX.forEach((lx, i) => {
            const swing = p.moving ? Math.sin(t * 10 + i * Math.PI / 2) * 6 : 0;
            ctx.beginPath();
            ctx.moveTo(lx, -6);
            ctx.lineTo(lx + swing, 18);
            ctx.stroke();
        });
        ctx.restore();
    }
};
