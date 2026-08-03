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

    // Mundo vivo ambiente (Fase 6) — cada "chunk" de mundo (unidade de
    // geração/culling, não um pedaço de save) tem uma chance de conter UMA
    // entidade decorativa entre os 4 tipos pedidos no design (viajante a
    // pé, caravana, animal, patrulha de guarda). Nunca colide com o
    // jogador, nunca interrompe a travessia — só "vida" ao fundo (ver
    // _drawAmbientLife).
    AMBIENT_CHUNK_SIZE: 2500,
    AMBIENT_SPAWN_CHANCE: 55, // % dos chunks que têm alguma entidade (de 0 a 100, ver _hash)
    AMBIENT_TYPES: ['npc_traveler', 'caravan', 'animal', 'patrol'],

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
        lore_book: { icon: '📖', label: 'Ler o livro esquecido' }
    },
    // Tipos de missão oferecidos pelo viajante — os três que já existiam em
    // QuestFactory mais próximos do pedido explícito ("escoltar", "caçar
    // uma criatura", "encontrar um objeto perdido"): ESCORT (Proteção de
    // Comboio), HUNT (Contrato de Caça), RECOVERY (Item Perdido).
    TRAVELER_QUEST_TYPES: ['ESCORT', 'HUNT', 'RECOVERY'],
    // Trechos de lore descobertos nos livros esquecidos (ver _resolveEvent)
    // — flavor text sobre o mundo (Coliseu, Gorkhal, Sylvaneth, Floresta
    // Ancestral), escolhido de forma determinística pela posição do livro
    // (mesmo hash de sempre), nunca Math.random puro.
    LORE_ENTRIES: [
        'Um fragmento de crônica antiga fala do primeiro Campeão do Coliseu Imperial, que nunca perdeu um duelo — e desapareceu sem deixar rastro na véspera de enfrentar um desafiante desconhecido.',
        'Uma página amarelada descreve como os orcs de Gorkhal forjam aço sobre rocha vulcânica ainda morna, dizendo que o fogo da montanha "lembra" a forma de cada lâmina.',
        'Um verso élfico fala de Sylvaneth como um lugar onde "o tempo caminha devagar de propósito", e que quem apressa a floresta nunca aprende o que ela tem a ensinar.',
        'Um relato sem autor descreve luzes verdes dançando entre as árvores mais antigas da Floresta Ancestral — "nem amigas, nem inimigas, só antigas demais para se importar".',
        'Uma anotação em tinta apagada adverte: "todo amuleto guarda um preço — alguns cobram na entrega, outros esperam anos para cobrar".',
        'Um trecho de poema fala de uma entidade profana que "só aparece pra quem já provou que não precisa de ajuda nenhuma" — e que aceitar sua oferta muda mais que a aparência.'
    ],
    // Subiu de 6 pra 12 ao adicionar ruins/cave/bridge/shrine/magic_stone/
    // lore_book (agora 12 tipos pacíficos + bandido = 13 no pool de
    // _generateEvents) — mantém a MESMA densidade relativa de marcos por
    // trecho de mundo (o custo por frame continua O(eventos visíveis),
    // nunca O(EVENT_COUNT) sozinho), só evita que metade dos tipos nunca
    // apareça numa viagem só por causa do sorteio ter poucos slots.
    EVENT_COUNT: 12, // eventos pacíficos + bandidos espalhados pela travessia inteira

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
        const types = Object.keys(this.EVENT_TYPES).concat(['bandit']);
        const segment = this.WORLD_LENGTH / this.EVENT_COUNT;
        this._events = [];
        for (let i = 0; i < this.EVENT_COUNT; i++) {
            const h = this._hash(i * 7 + seed);
            const type = types[h % types.length];
            const x = Utils.clamp(i * segment + segment * 0.5 + (h % 400) - 200, 400, this.WORLD_LENGTH - 400);
            const side = (i % 2 === 0) ? -1 : 1;
            const y = side * 70;
            this._events.push({ type, x, y, spawnX: x, consumed: false });
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
        const bounds = this._bounds();
        this._player.targetX = Utils.clamp(worldX, bounds.minX, bounds.maxX);
        this._player.targetY = Utils.clamp(worldY, bounds.minY, bounds.maxY);
        this._player.pathQueue = [];
    },

    _bounds() {
        return { minX: 0, maxX: this.WORLD_LENGTH, minY: -this.LANE_HALF_HEIGHT, maxY: this.LANE_HALF_HEIGHT };
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
                toast('O viajante só quer trocar algumas palavras antes de seguir seu caminho.', 'info');
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
            toast(`Um esconderijo secreto guarda ${gift}g abandonados há muito tempo.`, 'success');
        } else if (ev.type === 'campfire') {
            if ((p.fatigue || 0) > 0) {
                p.cureFatigue(1);
                toast('Você descansa um instante à fogueira — 1 nível de fadiga a menos.', 'success');
            } else {
                toast('A fogueira ainda aquece, mas você não sente nenhum cansaço agora.', 'info');
            }
        } else if (ev.type === 'cart') {
            toast('A carroça quebrada não guarda nada de útil — só madeira estilhaçada.', 'info');
        } else if (ev.type === 'bridge') {
            // Marco puramente cênico (pedido do usuário: "pontes" como
            // ponto físico de exploração) — mesmo espírito do 'cart' acima,
            // sem recompensa, só ambientação de travessia segura.
            toast('A ponte de pedra range sob seus passos, mas te leva em segurança até o outro lado.', 'info');
        } else if (ev.type === 'cave') {
            // Recompensa em ouro, faixa maior que 'secret' — risco maior
            // percebido ("caverna escura") justifica um prêmio melhor.
            const gift = Utils.randomInt(50, 100);
            p.gold += gift;
            toast(`No fundo da caverna escura, você encontra ${gift}g perdidos há anos.`, 'success');
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
            toast(healed
                ? 'Uma bênção silenciosa do pequeno templo alivia seu corpo — fadiga e ferimentos diminuem.'
                : 'Você reza um instante no pequeno templo, mas já está em plena forma.', 'success');
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

        const horizon = h * 0.4;
        const grad = ctx.createLinearGradient(0, horizon, 0, h);
        // Impacto visual da corrupção (pedido do usuário): enquanto o
        // monstro das sombras que corrompe a Floresta Ancestral ainda não
        // foi derrotado (ver _isForestCorrupted), o chão vira quase preto
        // com tinta roxa em vez do verde-mística normal, e o céu escurece —
        // volta ao normal sozinho assim que o evento `nature_spirit` for
        // consumido (vitória), sem precisar de nenhum estado extra
        // persistido (a checagem já é sempre fresca a partir de _events).
        if (corrupted) {
            grad.addColorStop(0, '#2a1230');
            grad.addColorStop(1, '#0a0510');
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
            skyGrad.addColorStop(0, '#5f96d9');
            skyGrad.addColorStop(1, '#9fc3e8');
        }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizon);
        if (window.GFX && window.GFX._drawMountains) window.GFX._drawMountains(ctx, w, horizon);
        this._drawSkyClouds(ctx, w, horizon, corrupted);

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
        this._drawCityGate(ctx, 0, fromDef ? fromDef.name : '');
        this._drawCityGate(ctx, this.WORLD_LENGTH, this._destLabel);

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
            this._drawMarker(ctx, i * this._zoneLength, this._zones[i].name);
        }

        // Eventos físicos (Fase 4) — mercador/baú/esconderijo/fogueira/
        // carroça/bandido, todos objetos reais no mapa (nunca um pop-up).
        for (const ev of this._events) {
            if (ev.consumed) continue;
            if (!window.Camera.isVisible(ev.x, ev.y, w, h, 150)) continue;
            this._drawEvent(ctx, ev);
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

            // Cor da vegetação varia por zona/família de bioma (identidade
            // visual por par-de-cidade, ver ZONE_FAMILY_STAGES) — exceto
            // enquanto a floresta estiver corrompida, quando SEMPRE vira
            // roxo doentio por cima de qualquer família (prioridade da
            // corrupção sobre a identidade normal da zona).
            const detailType = this._hash(i * 83 + 15000) % 4;
            if (detailType === 1) {
                // Pedra — cor neutra de rocha, nunca muda por zona/família
                // (pedras são inertes, não fazem parte da identidade de
                // bioma como a vegetação faz).
                ctx.fillStyle = corrupted ? 'rgba(40,35,45,0.75)' : 'rgba(110,105,98,0.85)';
                ctx.beginPath();
                ctx.moveTo(vx - 10, vy + 6);
                ctx.lineTo(vx - 5, vy - 6);
                ctx.lineTo(vx + 7, vy - 8);
                ctx.lineTo(vx + 11, vy + 3);
                ctx.lineTo(vx + 2, vy + 9);
                ctx.closePath();
                ctx.fill();
            } else if (detailType === 2 && !corrupted) {
                // Flores — não sobrevivem à corrupção (cai no tipo padrão
                // abaixo quando corrompido, já tingido de roxo doentio).
                ctx.fillStyle = 'rgba(230,190,90,0.85)';
                for (const [fx, fy] of [[-8, -4], [8, -4], [0, -10], [-4, 4], [4, 4]]) {
                    ctx.beginPath();
                    ctx.arc(vx + fx, vy + fy, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (detailType === 3) {
                // Arbusto — trio de círculos baixos, cor de zona (mais
                // largo/baixo que a planta padrão, dá variedade de silhueta).
                ctx.fillStyle = corrupted ? 'rgba(45,20,55,0.6)' : zone.vegColor;
                ctx.beginPath(); ctx.arc(vx - 8, vy + 4, 9, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(vx + 8, vy + 4, 9, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(vx, vy - 2, 10, 0, Math.PI * 2); ctx.fill();
            } else {
                // Planta padrão (elipse original).
                ctx.fillStyle = corrupted ? 'rgba(45,20,55,0.6)' : zone.vegColor;
                ctx.beginPath();
                ctx.ellipse(vx, vy, 14, 22, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Árvores gigantes (pedido do usuário) — marcos raros e bem mais
        // esparsos que a vegetação normal acima, sempre fora da faixa
        // caminhável (nunca bloqueiam nem colidem).
        this._drawGiantTrees(ctx, w, h, corrupted);

        // Acampamentos abandonados (pedido do usuário: "acampamentos" — o
        // mapa não deve parecer um corredor) — marco de terreno puramente
        // decorativo, mesmo princípio de _drawGiantTrees (determinístico,
        // fora da faixa caminhável, cullado por Camera.isVisible).
        this._drawTravelCamps(ctx, w, h, corrupted);

        // Mundo vivo ambiente (Fase 6) — viajantes, caravanas, animais e
        // patrulhas caminhando ao fundo, puramente decorativos. "Animais
        // fogem" enquanto a floresta estiver corrompida (pedido do
        // usuário) — nenhuma vida ambiente aparece até o monstro das
        // sombras ser derrotado.
        if (!corrupted) this._drawAmbientLife(ctx, w, h);
        else this._drawCorruptionMist(ctx, w, h);

        this._drawPlayer(ctx);
        ctx.restore();
    },

    // Nuvens à deriva no céu da Estrada (parte da correção do "fundo azul
    // sólido" reportado pelo usuário) — puramente decorativas, tela-fixa
    // (não fazem parte do mundo), deslocamento baseado só no tempo
    // (performance.now()) pra nunca depender de estado extra guardado nem
    // de onde o jogador está no mundo.
    _drawSkyClouds(ctx, w, horizon, corrupted) {
        const t = performance.now() / 1000;
        ctx.fillStyle = corrupted ? 'rgba(120,90,150,0.22)' : 'rgba(255,255,255,0.32)';
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
        }
    },

    _drawAmbientHuman(ctx, x, y, kind, seed, facing) {
        if (!window.GFX || !window.GFX.drawGladiator) return;
        const entity = this.AMBIENT_ENTITIES[kind];
        const cache = this._ambientAnimCache || (this._ambientAnimCache = {});
        const key = kind + '_' + seed;
        const anim = cache[key] || (cache[key] = { type: 'walk', start: performance.now(), duration: 0 });
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(this.PLAYER_SCALE * 0.85, this.PLAYER_SCALE * 0.85);
        window.GFX.drawGladiator(ctx, 0, 0, entity, facing > 0, anim, null);
        ctx.restore();
    },

    _drawAmbientCaravan(ctx, x, y) {
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
    },

    _drawAmbientAnimal(ctx, x, y, seed) {
        ctx.save();
        ctx.translate(x, y);
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
        if (seed % 2 === 0) {
            ctx.beginPath();
            ctx.moveTo(16, -9); ctx.lineTo(19, -15);
            ctx.moveTo(20, -9); ctx.lineTo(23, -15);
            ctx.stroke();
        }
        ctx.restore();
    },

    _drawAmbientLife(ctx, w, h) {
        const chunkSize = this.AMBIENT_CHUNK_SIZE;
        const px = this._player.x;
        const firstChunk = Math.max(0, Math.floor((px - w) / chunkSize) - 1);
        const lastChunk = Math.min(Math.ceil(this.WORLD_LENGTH / chunkSize), Math.ceil((px + w) / chunkSize) + 1);
        const t = performance.now() / 1000;

        for (let c = firstChunk; c <= lastChunk; c++) {
            if (this._hash(c * 13 + 5000) >= this.AMBIENT_SPAWN_CHANCE) continue;
            const kind = this.AMBIENT_TYPES[this._hash(c * 29 + 6000) % this.AMBIENT_TYPES.length];
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
            } else { // patrol — guarda vai-e-volta, mesmo padrão do bandido (_updateBandits) mas sem raio de detecção nenhum (nunca dispara batalha)
                const cx = chunkStart + chunkSize * 0.5;
                x = cx + Math.sin(t * 0.5 + seed) * 220;
                y = (seed % 2 === 0 ? -1 : 1) * 115;
                facing = Math.cos(t * 0.5 + seed) >= 0 ? 1 : -1;
            }

            if (!window.Camera.isVisible(x, y, w, h, 150)) continue;
            if (kind === 'npc_traveler' || kind === 'patrol') this._drawAmbientHuman(ctx, x, y, kind, seed, facing);
            else if (kind === 'caravan') this._drawAmbientCaravan(ctx, x, y);
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
    _drawGiantTrees(ctx, w, h, corrupted) {
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

            const trunkH = 70;
            ctx.fillStyle = corrupted ? '#1a1410' : '#4a3624';
            ctx.fillRect(gx - 9, gy - trunkH, 18, trunkH);

            const canopyY = gy - trunkH - 10;
            ctx.fillStyle = corrupted ? 'rgba(35,15,45,0.85)' : 'rgba(20,55,20,0.85)';
            ctx.beginPath(); ctx.arc(gx, canopyY, 46, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(gx - 32, canopyY + 14, 32, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(gx + 34, canopyY + 10, 34, 0, Math.PI * 2); ctx.fill();
        }
    },

    // Acampamentos abandonados esparsos (pedido do usuário: "acampamentos"
    // como marco de terreno físico) — 2 tendas triangulares + o brilho de
    // uma fogueira apagando, sempre fora da faixa caminhável, nunca
    // colidem. Puramente cênico (distinto do evento `campfire`, que É
    // interativo — aqui não há aviso de interação nenhum, é só paisagem
    // "alguém acampou aqui recentemente").
    _drawTravelCamps(ctx, w, h, corrupted) {
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

    _drawCreature(ctx, ev) {
        const entity = this.CREATURE_ENTITIES[ev.type];
        if (!entity || !window.GFX || !window.GFX.drawGladiator) return;
        const anim = ev._anim || (ev._anim = { type: 'idle', start: performance.now(), duration: 0 });
        ctx.save();
        ctx.translate(ev.x, ev.y);
        ctx.scale(this.PLAYER_SCALE, this.PLAYER_SCALE);
        window.GFX.drawGladiator(ctx, 0, 0, entity, true, anim, null);
        ctx.restore();
    },

    _drawEvent(ctx, ev) {
        if (this.CREATURE_ENTITIES[ev.type]) { this._drawCreature(ctx, ev); return; }
        const fillByType = {
            // Marcos físicos (identidade visual própria por tipo, em vez do
            // marrom genérico de fallback usado por merchant/chest/etc.).
            ruins: 'rgba(120,110,95,0.85)',
            cave: 'rgba(25,25,30,0.9)',
            bridge: 'rgba(110,95,75,0.85)',
            shrine: 'rgba(180,150,60,0.85)',
            magic_stone: 'rgba(120,60,200,0.85)',
            lore_book: 'rgba(90,70,40,0.85)'
        };
        ctx.fillStyle = fillByType[ev.type] || 'rgba(60,45,30,0.85)';
        ctx.beginPath();
        ctx.arc(ev.x, ev.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        const def = this.EVENT_TYPES[ev.type] || this.FOREST_EVENT_TYPES[ev.type];
        const icon = def ? def.icon : '❓';
        ctx.fillText(icon, ev.x, ev.y + 7);
    },

    _drawMarker(ctx, x, label) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x - 3, -this.LANE_HALF_HEIGHT, 6, this.LANE_HALF_HEIGHT * 2);
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
    _drawCityGate(ctx, x, label) {
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
    }
};
