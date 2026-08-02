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
 * Biomas (Fase 3): a travessia é dividida em zonas nomeadas (Campos,
 * Bosque, Floresta, Arredores-de-<destino>) com densidade de vegetação
 * crescente — GENÉRICAS por design, não por par-de-cidade (a mesma
 * decisão arquitetural já usada em roads.js: "uma cidade nova
 * automaticamente ganha uma rota funcional, sem precisar de conteúdo
 * específico por par de cidade"). A cor de fundo continua uma mistura
 * CONTÍNUA entre a paleta de origem/destino (ver draw()) — as zonas
 * mudam densidade/nome, nunca a cena inteira de uma vez.
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

    // Movimento suave (pedido do usuário: "evitar mudanças instantâneas de
    // direção") — a velocidade REAL (p.vx/p.vy) persegue a velocidade-alvo
    // (WASD/clique) em vez de saltar pra ela, ver _approach/update(). Essa
    // lógica fica só aqui (RoadEngine-local), nunca em PlayerController —
    // a Praça continua com o movimento rígido original, intocado.
    ACCEL: 900, // px/s² ao acelerar (sair do zero ou mudar de direção)
    DECEL: 1400, // px/s² ao soltar as teclas/chegar no alvo — freia mais rápido do que acelera, sensação mais natural
    CAMERA_SMOOTH_TIME: 0.12, // constante de tempo da câmera suavizada (ver update()) — quanto menor, mais "grudada" no jogador
    GATE_ZONE_RADIUS: 130, // largura da área de transição desenhada em volta de cada portão de cidade (ver _drawCityGate)
    WALK_CYCLE_SPEED_DIVISOR: 35, // converte px/s de movimento real em rad/s do ciclo de passada (ver _drawPlayer)

    // Mundo vivo ambiente (Fase 6) — cada "chunk" de mundo (unidade de
    // geração/culling, não um pedaço de save) tem uma chance de conter UMA
    // entidade decorativa entre os 4 tipos pedidos no design (viajante a
    // pé, caravana, animal, patrulha de guarda). Nunca colide com o
    // jogador, nunca interrompe a travessia — só "vida" ao fundo (ver
    // _drawAmbientLife).
    AMBIENT_CHUNK_SIZE: 2500,
    AMBIENT_SPAWN_CHANCE: 55, // % dos chunks que têm alguma entidade (de 0 a 100, ver _hash)
    AMBIENT_TYPES: ['npc_traveler', 'caravan', 'animal', 'patrol'],

    // Gabarito genérico de zonas — o nome da última é preenchido em
    // start() com o nome da cidade de destino ("Arredores de X"), as
    // outras três são sempre as mesmas (mato rasteiro → mato mais denso
    // → floresta fechada), independente de quais cidades estão ligadas.
    ZONE_TEMPLATE: [
        { name: 'Campos', vegDensity: 1.0 },
        { name: 'Bosque', vegDensity: 1.4 },
        { name: 'Floresta', vegDensity: 1.9 },
        { name: null, vegDensity: 1.2 } // nome real vem de start()
    ],

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
        traveler: { icon: '🧳', label: 'Conversar com o viajante' }
    },
    // Tipos de missão oferecidos pelo viajante — os três que já existiam em
    // QuestFactory mais próximos do pedido explícito ("escoltar", "caçar
    // uma criatura", "encontrar um objeto perdido"): ESCORT (Proteção de
    // Comboio), HUNT (Contrato de Caça), RECOVERY (Item Perdido).
    TRAVELER_QUEST_TYPES: ['ESCORT', 'HUNT', 'RECOVERY'],
    EVENT_COUNT: 6, // eventos pacíficos + bandidos espalhados pela travessia inteira

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
        this._walkCycle = 0;
        this._lastProgressPct = -1;
        // A câmera parte já centrada na posição inicial do jogador (nunca em
        // 0,0) — evita um "salto"/slide-in visível no primeiro frame da
        // travessia (ponto inicial da cidade de origem precisa continuar
        // exatamente onde o jogador está, sem bug de câmera).
        this._camX = this._player.x;
        this._camY = this._player.y;

        const toDef = window.CityDatabase[toId];
        // A Expedição à Floresta Ancestral (ver roads.js FOREST_EXPEDITION_ID)
        // é um destino VIRTUAL — nunca existe em CityDatabase — então nome
        // de zona/marco de chegada precisam de um nome próprio em vez de
        // `toDef.name` (que seria undefined).
        this._destLabel = toDef ? toDef.name : (toId === window.FOREST_EXPEDITION_ID ? 'Floresta Ancestral' : 'Chegada');
        this._zones = this.ZONE_TEMPLATE.map((z, i) => ({
            name: i === this.ZONE_TEMPLATE.length - 1 ? `Arredores de ${this._destLabel}` : z.name,
            vegDensity: z.vegDensity
        }));
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

        // Ciclo de passada avança com a velocidade REAL (pós-suavização), não
        // a velocidade-alvo — perna acompanha o corpo acelerando/freando de
        // verdade, nunca troca de fase instantaneamente ao parar/começar.
        if (p.moving) this._walkCycle += dt * (realSpeed / this.WALK_CYCLE_SPEED_DIVISOR);
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
        ctx.fillStyle = corrupted ? '#241830' : '#7fa8d9';
        ctx.fillRect(0, 0, w, horizon);

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

        // Vegetação esparsa, só decorativa — gerada de forma determinística
        // (sem array guardado em memória, sem Math.random) e cullada via
        // Camera.isVisible, então o custo por frame não cresce com
        // WORLD_LENGTH. A densidade varia por zona (Bosque/Floresta têm
        // mais chance de planta por slot que Campos) via _hash().
        const spacing = 220;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        for (let i = firstIdx; i <= lastIdx; i++) {
            const vx = i * spacing;
            if (vx < 0 || vx > this.WORLD_LENGTH) continue;
            const density = this._zones[this._zoneIndexAt(vx)].vegDensity;
            if (this._hash(i) >= 40 * density) continue;
            const side = (i % 2 === 0) ? -1 : 1;
            const vy = side * (this.LANE_HALF_HEIGHT - 20);
            if (!window.Camera.isVisible(vx, vy, w, h)) continue;
            // Folhas escurecidas enquanto a floresta estiver corrompida —
            // mesmas silhuetas, só tingidas de roxo doentio em vez do verde
            // saudável normal.
            ctx.fillStyle = corrupted ? 'rgba(45,20,55,0.6)' : 'rgba(20,40,15,0.55)';
            ctx.beginPath();
            ctx.ellipse(vx, vy, 14, 22, 0, 0, Math.PI * 2);
            ctx.fill();
        }

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
    _drawAmbientLife(ctx, w, h) {
        const chunkSize = this.AMBIENT_CHUNK_SIZE;
        const px = this._player.x;
        const firstChunk = Math.max(0, Math.floor((px - w) / chunkSize) - 1);
        const lastChunk = Math.min(Math.ceil(this.WORLD_LENGTH / chunkSize), Math.ceil((px + w) / chunkSize) + 1);
        const t = performance.now() / 1000;
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';

        for (let c = firstChunk; c <= lastChunk; c++) {
            if (this._hash(c * 13 + 5000) >= this.AMBIENT_SPAWN_CHANCE) continue;
            const kind = this.AMBIENT_TYPES[this._hash(c * 29 + 6000) % this.AMBIENT_TYPES.length];
            const seed = this._hash(c * 47 + 7000);
            const chunkStart = c * chunkSize;
            let x, y, icon;

            if (kind === 'caravan') {
                // Atravessa o MUNDO INTEIRO (não só o chunk) e reaparece do
                // início ao sair — "caravanas devem viajar" entre cidades de
                // verdade, sem precisar guardar posição entre frames.
                x = (t * 90 + seed * 500) % this.WORLD_LENGTH;
                y = -40;
                icon = '🚚';
            } else if (kind === 'npc_traveler') {
                // Anda continuamente numa direção dentro do próprio chunk
                // (módulo do tempo), nunca oscila vai-e-volta como
                // bandido/patrulha — dá a sensação de estar realmente indo
                // de um lugar a outro, não só decorando o mesmo ponto.
                x = chunkStart + ((t * 40 + seed * 25) % chunkSize);
                y = (seed % 2 === 0 ? -1 : 1) * 95;
                icon = '🚶';
            } else if (kind === 'animal') {
                const cx = chunkStart + chunkSize * 0.5;
                x = cx + Math.sin(t * 0.4 + seed) * 180;
                y = Math.cos(t * 0.3 + seed) * 55;
                icon = '🦌';
            } else { // patrol — guarda vai-e-volta, mesmo padrão do bandido (_updateBandits) mas sem raio de detecção nenhum (nunca dispara batalha)
                const cx = chunkStart + chunkSize * 0.5;
                x = cx + Math.sin(t * 0.5 + seed) * 220;
                y = (seed % 2 === 0 ? -1 : 1) * 115;
                icon = '🛡️';
            }

            if (!window.Camera.isVisible(x, y, w, h, 150)) continue;
            ctx.fillText(icon, x, y + 8);
        }
    },

    _drawEvent(ctx, ev) {
        const fillByType = {
            bandit: 'rgba(120,20,20,0.85)',
            nature_spirit: 'rgba(40,110,60,0.85)',
            corruption: 'rgba(60,20,70,0.85)'
        };
        const iconByType = { bandit: '⚔️', nature_spirit: '🌿' };
        ctx.fillStyle = fillByType[ev.type] || 'rgba(60,45,30,0.85)';
        ctx.beginPath();
        ctx.arc(ev.x, ev.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        const def = this.EVENT_TYPES[ev.type] || this.FOREST_EVENT_TYPES[ev.type];
        const icon = iconByType[ev.type] || (def ? def.icon : '❓');
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

    // Figura animada de bastão (sem sprites, mesmo estilo 100% procedural
    // do resto do jogo) — pernas/braços balançam com _walkCycle (avança de
    // acordo com a velocidade REAL de _updateMovement, então andar mais
    // rápido = passada mais rápida) e um leve "bob" vertical enquanto anda,
    // atendendo ao pedido "criar uma animação de caminhada fluida" /
    // "fazer o personagem parecer que realmente está andando".
    _drawPlayer(ctx) {
        const p = this._player;
        const swing = p.moving ? Math.sin(this._walkCycle) * 14 : 0;
        const bob = p.moving ? Math.abs(Math.sin(this._walkCycle)) * 3 : 0;
        const cx = p.x, cy = p.y - bob;
        const facing = p.facing || 1;

        ctx.strokeStyle = '#3a2c1e';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(cx, cy + 6);
        ctx.lineTo(cx + swing * 0.5, cy + 26);
        ctx.moveTo(cx, cy + 6);
        ctx.lineTo(cx - swing * 0.5, cy + 26);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx - swing * 0.4, cy + 12);
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx + swing * 0.4, cy + 12);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx, cy + 8);
        ctx.stroke();

        ctx.fillStyle = '#e8c99b';
        ctx.beginPath();
        ctx.arc(cx + facing * 2, cy - 16, 12, 0, Math.PI * 2);
        ctx.fill();
    }
};
