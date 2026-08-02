/**
 * Cidade Explorável (novo Hub) — Arena of Blades
 *
 * Substitui o antigo menu de botões por uma praça greco-romana onde o
 * jogador anda de verdade (clique/toque para mover, ou WASD/setas) e entra
 * em cada prédio pra acessar as telas que já existiam (Mercado, Talentos,
 * Curandeiro, Ladder, etc) — nenhuma dessas telas foi reescrita, só ganharam
 * uma "porta física" no mapa em vez de um botão.
 *
 * Arquitetura: sem câmera/rolagem — a praça inteira sempre cabe na tela
 * (posições em fração da largura, ancoradas ao horizonte do céu que já
 * existe em GraphicsEngine.drawArenaBackground), a mesma abordagem já usada
 * pelo fundo cinematográfico da arena/menu principal. Isso mantém o desenho
 * simples e evita construir um sistema de câmera/mundo grande só pra isso.
 * O céu, o coliseu ao fundo, a plateia, tochas e pássaros são reaproveitados
 * de GraphicsEngine — a cidade "mora" bem em frente ao próprio coliseu.
 */
class CityEngine {
    constructor() {
        // Posição do jogador em pixels de tela (não fração — precisa de uma
        // velocidade de caminhada consistente independente da resolução).
        this.player = { x: 0, y: 0, targetX: null, targetY: null, facing: 1, moving: false, pathQueue: [] };
        this.walkSpeed = 210; // px/s

        this.keysHeld = { up: false, down: false, left: false, right: false };
        this._mouseX = null;
        this._initialized = false;
        this._hintShown = true;
        // Ver _setupInput: timestamp do último toque tratado, usado pra
        // ignorar o clique de compatibilidade que o navegador dispara
        // depois de um toque real (ghost click).
        this._lastTouchHandledAt = -Infinity;

        // NPC que o jogador clicou pra conversar, mas ainda não chegou perto
        // o bastante (ver _approachAndTalk/_updatePendingTalk) — antes
        // clicar num NPC de longe puxava a fala instantaneamente, sem o
        // personagem sequer se mover até ele.
        this._pendingTalkNpc = null;

        // Ciclo dia/noite: percorre as 4 mesmas paletas já usadas pela
        // arena (dawn/day/sunset/night), sincronizando GFX.arenaTime.
        this.dayPhases = ['dawn', 'day', 'sunset', 'night'];
        this.dayPhaseIndex = 1; // começa de dia
        this.dayPhaseTimer = 0;
        this.dayPhaseDuration = 75; // segundos por fase (~5min o ciclo completo)
        // Contador de "dias" (incrementado ao entrar em 'dawn' vindo de
        // 'night', ver _updateDayCycle) — usado pelo Ferreiro/Armeiro pra
        // saber quando o estoque deve ser sorteado de novo (ver ui.js
        // openShop): antes o estoque era sorteado TODA VEZ que a loja era
        // aberta, mesmo revisitando no mesmo dia.
        this.dayCount = 1;

        this.npcs = [];
        // Vampiros visíveis vagando pela praça à noite (ver _onNightFalls/
        // _updateNpcs/draw) — antes a noite só tinha NPCs comuns SOMENDO
        // (ver comentário em draw()) e um encontro de vampiro totalmente
        // invisível (um toast + timeout em _eventVampireEncounter), então o
        // jogador nunca via de fato uma criatura da noite andando por aí.
        this.nightWanderers = [];
        this._npcSpawnDone = false;
        this._smokeTimer = 0;
        this._ambientSoundTimer = 0;
        this._nearBuilding = null;
        this._footstepTimer = 0; // ver _updateMovement — som de passo ao andar

        // Clima da praça (ver _updateWeather) — antes a cidade só variava
        // por dia/noite; o céu nunca ficava nublado nem chovia, mesmo tendo
        // biomas de arena com neve/areia/vento (ver ARENA_BIOMES em
        // graphics.js). "Clima" está listada nas subáreas obrigatórias de
        // Mundo e faltava por completo na Cidade.
        this.weather = 'clear';
        this._weatherTimer = Utils.randomFloat(45, 90);
        this._rainSpawnTimer = 0;
        // Tempestade: variante rara da chuva com raios (flash de tela) e
        // trovão — antes a chuva era sempre igual, sem NENHUMA variação de
        // intensidade, mesmo "clima" prometendo mais que só chuva/sol.
        this.isStorm = false;
        this._lightningTimer = 0;

        // Eventos aleatórios enquanto explora a cidade (mercadores, ladrões,
        // duelistas, mensageiros, nobres, promoções, artistas, pregoeiros) —
        // um temporizador simples, sem fila/histórico: só um toast (e, no
        // caso do duelista, uma batalha de verdade) de vez em quando.
        this._eventTimer = Utils.randomFloat(35, 60);

        // Promoção temporária de loja (ver _eventPromotion): antes esse
        // evento só mostrava o toast "preços especiais só por hoje" sem
        // NENHUM desconto real acontecer em lugar nenhum — o jogador ia até
        // o Ferreiro/Armeiro/Taverna e via os mesmos preços de sempre.
        // `activePromotion` guarda qual loja e por quanto tempo o desconto
        // real dura (ver ui.js _shopDiscount).
        this.activePromotion = null;

        // Emboscada noturna garantida (ver _onNightFalls/_updateNightAmbush)
        this._nightAmbushTimer = null;
        // Trava simples pra nunca deixar dois encontros noturnos forçados
        // (o sorteio ambiental de _updateRandomEvents E a emboscada
        // garantida) chamarem beginBattleWith quase ao mesmo tempo — cada
        // um seta isso antes do próprio setTimeout e limpa depois.
        this._nightEncounterPending = false;

        // Mercador Viajante (ver _eventRareMerchant/_makeTravelingMerchant):
        // antes esse evento era só um toast instantâneo de +ouro, sem
        // NENHUMA presença real no mundo — "um mercador raro passou" mas o
        // jogador nunca via nem falava com ninguém. Agora ele de fato
        // aparece como um NPC andando pela praça, com uma loja própria
        // (ver ui.js openShop('Mercador Viajante')) enquanto durar, e vai
        // embora sozinho depois de um tempo se ninguém o visitar.
        this.travelingMerchant = null;

        // xFrac/larguras calculados pra sempre sobrar uma folga clara entre
        // prédios vizinhos (inclusive entre fileiras diferentes, já que só a
        // posição Y muda — nada de escala por profundidade). Antes o Banco e
        // a Casa ficavam encaixados bem no meio de dois prédios da fileira do
        // meio e acabavam colidindo com as bordas dos dois ao mesmo tempo.
        this.buildings = [
            { id: 'arena', name: 'Arena', icon: '⚔️', xFrac: 0.5, rowOffset: 40, w: 240, h: 175, wall: '#8a7a5a', roof: '#8a2a2a', row: 'back' },
            { id: 'blacksmith', name: 'Ferreiro', icon: '🔨', xFrac: 0.11, rowOffset: 95, w: 130, h: 105, wall: '#6b5a42', roof: '#7a4a2a', row: 'mid' },
            { id: 'armorer', name: 'Armeiro', icon: '🛡️', xFrac: 0.30, rowOffset: 95, w: 130, h: 105, wall: '#6b5a42', roof: '#5a6a7a', row: 'mid' },
            { id: 'tavern', name: 'Taverna', icon: '🍺', xFrac: 0.70, rowOffset: 95, w: 130, h: 105, wall: '#6b5a42', roof: '#8a5a2a', row: 'mid' },
            { id: 'arcane', name: 'Mercado Arcano', icon: '🔮', xFrac: 0.89, rowOffset: 95, w: 130, h: 105, wall: '#5a4a6b', roof: '#3a2a5a', row: 'mid' },
            { id: 'bank', name: 'Banco', icon: '💰', xFrac: 0.205, rowOffset: 165, w: 95, h: 78, wall: '#8891a0', roof: '#c9a227', row: 'front' },
            { id: 'halloffame', name: 'Hall da Fama', icon: '🏆', xFrac: 0.5, rowOffset: 185, w: 110, h: 85, wall: '#9a8a70', roof: '#c9a227', row: 'front' },
            { id: 'house', name: 'Sua Casa', icon: '🏠', xFrac: 0.795, rowOffset: 165, w: 95, h: 78, wall: '#6b5a42', roof: '#7a4a2a', row: 'front' },
            // Quadro de Missões (novo pedido de auditoria, item #4) — entre o
            // Banco e o Hall da Fama na fileira da frente, sem colidir com
            // nenhum prédio nem com as Pedras de Luz (xFrac 0.05/0.5/0.95).
            { id: 'questboard', name: 'Quadro de Missões', icon: '📜', xFrac: 0.35, rowOffset: 165, w: 95, h: 78, wall: '#7a6a52', roof: '#8a6a2a', row: 'front' },
        ];

        // Decorações puramente visuais (sem colisão, exceto a fonte central).
        this.fountain = { xFrac: 0.5, rowOffset: 130, r: 34 };
        this.statues = [
            { xFrac: 0.38, rowOffset: 125 },
            { xFrac: 0.62, rowOffset: 125 },
        ];
        // Vegetação (ver _drawVegetation) — a praça nunca teve NENHUMA planta
        // até agora (só fonte + estátuas), apesar de "vegetação" ser parte
        // explícita da identidade de Mundo greco-romana. Posições fixas por
        // "slot" (edge = bordas da tela, center = ladeando a fonte); o TIPO
        // de planta em cada slot é lido de CityDatabase.vegetationTypes (ver
        // citydatabase.js) e resolvido a cada frame em _drawVegetation, não
        // fixado aqui — assim viajar de cidade troca a vegetação sem precisar
        // reconstruir a praça inteira, do mesmo jeito que groundColors já
        // funciona pra cor do piso. Porto Helênico usa cipreste/loureiro
        // (silhueta clássica mediterrânea + planta sagrada de Apolo).
        this.vegetation = [
            { slot: 'edge', xFrac: 0.025, rowOffset: 55, scale: 1.2 },
            { slot: 'edge', xFrac: 0.975, rowOffset: 55, scale: 1.2 },
            { slot: 'center', xFrac: 0.44, rowOffset: 148 },
            { slot: 'center', xFrac: 0.56, rowOffset: 148 },
        ];

        // Pedras de Luz (item 13 da auditoria de balanceamento): recurso do
        // Ritual da Luz (Fragmentos Sagrados, ver rituals.js) que antes só
        // existia como um evento aleatório TOTALMENTE INVISÍVEL (_eventSacredFragment,
        // removido nesta iteração) — um toast "você encontra um fragmento"
        // sem NENHUMA presença física no mundo, exatamente o mesmo problema
        // que o Mercador Viajante já teve corrigido (ver _makeTravelingMerchant).
        // Agora pedras físicas em posições FIXAS na praça (não sorteadas)
        // brilham visivelmente enquanto o Ritual da Luz não foi concluído; o
        // jogador anda até uma e clica pra coletar (ver
        // _approachAndCollectStone/_updatePendingCollectStone, mesmo fluxo de
        // aproximação já usado por _approachAndTalk/_updatePendingTalk).
        // `collected`/`respawnTimer` são estado de sessão (como clima e
        // promoção de loja) — só o PROGRESSO em si
        // (player.ritualProgress.luz.sacredFragments) é persistido no save,
        // através do Player que já existe.
        this.lightStoneSpots = [
            { xFrac: 0.05, rowOffset: 175 },
            { xFrac: 0.95, rowOffset: 175 },
            { xFrac: 0.5, rowOffset: 225 },
        ];
        this.lightStones = [];
        this._pendingCollectStone = null;
        this._lightStoneSparkleTimer = 0;

        this._interactPromptEl = null;
        this._hintEl = null;
    }

    // --- Ciclo de vida ---

    // Chamado (via UIManager.showScreen) toda vez que se entra na Cidade.
    // Idempotente: não reseta a posição se o jogador já está explorando,
    // só posiciona no primeiro uso desta sessão.
    onEnterCity() {
        const w = window.Engine ? window.Engine.width : window.innerWidth;
        const h = window.Engine ? window.Engine.height : window.innerHeight;
        if (!this._initialized) {
            this.player.x = w * 0.5;
            this.player.y = this._plazaBottom(h);
            this._initialized = true;
            this._setupInput();
            // Restaura o contador de dias persistido no Player (ver item #8
            // do novo pedido de auditoria — "melhorar persistência") — sem
            // isso, todo refresh de página recriava o CityEngine com
            // dayCount travado em 1, desfazendo o progresso de dias já
            // vivido (e, junto com ele, o prazo de qualquer missão com
            // tempo limite ativa, ver quests.js `expiresAtDay`).
            const savedPlayer = window.Engine && window.Engine.state && window.Engine.state.player;
            if (savedPlayer && savedPlayer.dayCount) this.dayCount = savedPlayer.dayCount;
        }
        this._spawnNpcsIfNeeded();
        this._spawnLightStonesIfNeeded();
        if (window.AudioManager) window.AudioManager.startCityAmbience();
        this._interactPromptEl = document.getElementById('city-interact-prompt');
        this._hintEl = document.getElementById('city-hint');
    }

    // Bug reportado: personagem "sumindo" na praça depois de um resize da
    // janela (ex: barra de endereço do celular aparecendo/sumindo ao voltar
    // de uma batalha). Prédios usam xFrac/rowOffset recalculados a cada
    // frame a partir do tamanho ATUAL da tela (ver draw()), mas o jogador e
    // os NPCs guardam posição em pixel absoluto, fixada só uma vez — depois
    // de um resize essas coordenadas ficavam desproporcionais ao novo
    // tamanho e ninguém as corrigia. Chamado por GameEngine.resize()
    // (main.js) sempre que width/height mudam de verdade.
    handleResize(oldW, oldH, newW, newH) {
        if (!this._initialized || !oldW || !oldH) return;
        const fx = newW / oldW, fy = newH / oldH;
        if (fx === 1 && fy === 1) return;

        const rescale = (entity) => {
            entity.x *= fx;
            entity.y *= fy;
            if (entity.targetX !== null && entity.targetX !== undefined) entity.targetX *= fx;
            if (entity.targetY !== null && entity.targetY !== undefined) entity.targetY *= fy;
            if (entity.pathQueue) entity.pathQueue.forEach(p => { p.x *= fx; p.y *= fy; });
            // NPCs "presos" a um ponto de ancoragem (ver _spawnNpcsIfNeeded,
            // espectadores da arena): sem reescalar o pin junto, eles
            // voltariam a vagar em torno da posição ANTIGA assim que o
            // waitTimer expirasse, desfazendo o reajuste aos poucos.
            if (entity.pin) { entity.pin.x *= fx; entity.pin.y *= fy; }
        };

        rescale(this.player);
        this.player.x = Utils.clamp(this.player.x, 30, newW - 30);
        this.npcs.forEach(rescale);
        this.nightWanderers.forEach(rescale);
    }

    _plazaBottom(h) {
        return h - 70;
    }

    _horizon(h) {
        return h * 0.62;
    }

    _isActive() {
        return window.Engine && window.Engine.state.screen === 'HUB';
    }

    // --- NPCs ambiente (só decorativos, sem interação) ---

    _spawnNpcsIfNeeded() {
        const p = window.Engine.state.player;
        // Mais NPCs conforme o jogador progride (nível), até um teto razoável.
        const targetCount = Utils.clamp(2 + Math.floor((p ? p.level : 1) / 2), 2, 8);
        while (this.npcs.length < targetCount) {
            this.npcs.push(this._makeNpc());
        }

        // Arena "viva": um espectador e um gladiador treinando, sempre perto
        // da entrada (raio pequeno, "pinado" em vez de vagar pela praça
        // inteira) — dá a sensação de movimento constante junto à Arena.
        if (!this._arenaNpcsSpawned) {
            this._arenaNpcsSpawned = true;
            const arena = this.buildings.find(b => b.id === 'arena');
            const door = this._doorPoint(arena);
            this.npcs.push(this._makeNpc({ x: door.x - 95, y: door.y + 50, radius: 28 }));
            this.npcs.push(this._makeNpc({ x: door.x + 95, y: door.y + 50, radius: 28 }));
        }

        // Viajante do Portão (ver Cidades-Hub Regionais) — substitui o antigo
        // prédio Estábulo: em vez de "entrar" num prédio, o jogador conversa
        // com uma pessoa de verdade parada no vão da muralha lateral (ver
        // GraphicsEngine._drawCityWall, MESMO CityEngine.GATE_XFRAC) pra
        // comprar passagem entre cidades.
        if (!this._gateTravelerSpawned) {
            this._gateTravelerSpawned = true;
            this.npcs.push(this._makeCaravanTraveler());
        }
    }

    // Recria as pedras de luz (todas não coletadas) só se o jogador ainda
    // precisa de Fragmentos Sagrados — nenhuma Linhagem despertada e menos
    // de 5 já reunidos (ver rituals.js RITUALS.luz_ritual). Idempotente
    // igual _spawnNpcsIfNeeded: não recria (nem reresseta o respawnTimer de
    // pedras já coletadas) se já existem pedras nesta cidade/sessão — só
    // limpa tudo quando o jogador deixa de precisar (despertou a Luz ou já
    // tem os 5), removendo a "decoração morta" da praça.
    _spawnLightStonesIfNeeded() {
        const p = window.Engine.state.player;
        const rp = p ? p.ritualProgress.luz : null;
        const eligible = p && !p.lineage && (!rp || rp.sacredFragments < 5);
        if (!eligible) { this.lightStones = []; return; }
        if (this.lightStones.length > 0) return;
        this.lightStones = this.lightStoneSpots.map((spot, i) => ({ id: i, spot, collected: false, respawnTimer: 0 }));
    }

    // NPC fixo no vão do portão da muralha — raio de "pin" bem pequeno, já
    // que ele deveria estar sempre visível bem ali, não vagando pela praça
    // inteira como os NPCs comuns.
    _makeCaravanTraveler() {
        const w = window.Engine.width, h = window.Engine.height;
        const gateX = w * CityEngine.GATE_XFRAC;
        const gateY = this._horizon(h) + 45;
        const skinTones = ['#ffcc99', '#e0a878', '#a86b3f', '#7a4a2a'];
        const hairColors = ['#2a1c10', '#5a3a1a', '#1a1a1a', '#8a5a2b'];
        return {
            x: gateX, y: gateY, targetX: gateX, targetY: gateY,
            pin: { x: gateX, y: gateY, radius: 18 },
            waitTimer: Utils.randomFloat(1, 4),
            facing: -1, // de costas pro portão, olhando pra dentro da praça
            isCaravanTraveler: true,
            entity: {
                visuals: {
                    gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
                    skinTone: skinTones[Utils.randomInt(0, skinTones.length - 1)],
                    hairStyle: Utils.randomInt(1, 15),
                    hairColor: hairColors[Utils.randomInt(0, hairColors.length - 1)],
                    beardStyle: 0, eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {},
                __teamColor: '#4a3a2a' // manto de viagem, cor terrosa de estrada
            },
            anim: { type: 'idle', start: performance.now(), duration: 0 }
        };
    }

    // Raça de um NPC ambiente novo, ponderada pela demografia da Cidade-Hub
    // atual (ver citydatabase.js `raceDemographics`, Utils.weightedPick — o
    // mesmo mecanismo já usado pelos inimigos procedurais em enemy.js). Sem
    // cidade definida (ou demografia ausente), sorteia uniformemente entre
    // todas as raças cadastradas.
    _pickNpcRace() {
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const demographics = (cityDef && cityDef.raceDemographics) ? cityDef.raceDemographics : null;
        if (demographics) return Utils.weightedPick(demographics) || 'humano';
        const raceIds = window.RACES ? Object.keys(window.RACES) : ['humano'];
        return raceIds[Utils.randomInt(0, raceIds.length - 1)];
    }

    _makeNpc(pin = null) {
        const w = window.Engine.width, h = window.Engine.height;
        // Raça sorteada ANTES da pele (bug de auditoria corrigido nesta
        // iteração: `skinTone` usava um pool fixo genérico aqui embaixo,
        // calculado ANTES da raça — mesmo problema já corrigido em
        // enemy.js Rival — então nunca conseguia ficar coerente com a raça
        // sorteada por _pickNpcRace(), ver races.js RaceSystem.pickSkinTone:
        // Orc verde/raramente vermelho-roxo dessaturado, Elfo sempre claro,
        // Humano/Anão com gradiente pardo/negro).
        const npcRace = this._pickNpcRace();
        const hairColors = ['#2a1c10', '#5a3a1a', '#1a1a1a', '#8a5a2b'];
        let x, y;
        // Túnicas de tons gregos/romanos — antes TODO NPC caía no fallback
        // padrão de _drawTorso (graphics.js), '#5a4632', porque `__teamColor`
        // era lido lá mas nunca setado em lugar nenhum: a cidade inteira era
        // um "exército de clones" com a mesma roupa marrom. Cada NPC agora
        // sorteia a própria cor, dando variedade real de vestimenta à praça.
        const tunicColors = ['#e8dcc0', '#c9a876', '#8a3a2a', '#6b7a4a', '#8a6a2a', '#5a6a7a', '#7a3a4a'];
        if (pin) {
            x = Utils.randomFloat(pin.x - pin.radius, pin.x + pin.radius);
            y = Utils.randomFloat(pin.y - pin.radius * 0.4, pin.y + pin.radius * 0.4);
        } else {
            x = Utils.randomFloat(w * 0.1, w * 0.9);
            y = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
        }
        const professionIds = Object.keys(CityEngine.NPC_PROFESSIONS);
        return {
            x, y, targetX: x, targetY: y, pin,
            waitTimer: Utils.randomFloat(1, 4),
            facing: Utils.chance(50) ? 1 : -1,
            // Profissão (ver NPC_PROFESSIONS/_talkToNpc) — antes todo NPC
            // ambiente tinha as MESMAS falas genéricas, sem nenhuma identidade
            // além da roupa/aparência sorteada; agora cada um "é" alguém (um
            // mercador, um sacerdote, um soldado...) com falas próprias.
            profession: professionIds[Utils.randomInt(0, professionIds.length - 1)],
            entity: {
                visuals: {
                    gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
                    skinTone: window.RaceSystem ? window.RaceSystem.pickSkinTone(npcRace) : '#ffcc99',
                    hairStyle: Utils.randomInt(1, 15),
                    hairColor: hairColors[Utils.randomInt(0, hairColors.length - 1)],
                    beardStyle: 0, eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {},
                __teamColor: tunicColors[Utils.randomInt(0, tunicColors.length - 1)],
                // Raça (ver races.js `accent`/_drawRaceSash em graphics.js)
                // ponderada pela demografia da Cidade-Hub atual (ver
                // citydatabase.js) — puramente cosmética aqui (NPCs de
                // ambiente não são Entity, não lutam), mas faz a praça
                // REALMENTE parecer outro povo ao viajar: a Fortaleza Orc
                // vira uma praça majoritariamente Orc, não só o discurso dos
                // eventos aleatórios mudando de nome.
                race: npcRace
            },
            anim: { type: 'idle', start: performance.now(), duration: 0 },
            // Rotina de vida (item #5 do novo pedido de auditoria — ver
            // _updateNpcs/_sendNpcToVisitBuilding/_rollNpcBuildingVisits):
            // 'wandering' (padrão) | 'visiting' (a caminho de uma loja) |
            // 'inside' (parado e invisível, "dentro" da loja).
            routineState: 'wandering', invisible: false, insideTimer: 0
        };
    }

    // Vampiro visível vagando pela praça à noite — mesma "forma" de objeto
    // NPC (x/targetX/waitTimer/facing/entity/anim) pra reaproveitar
    // _updateNpcs/_drawNpc sem duplicar lógica de movimento/desenho, só com
    // visual da Linhagem Vampirismo (ver lineages.js `visual`: pele pálida,
    // olhos vermelhos, presas) e marcado com isVampireWanderer pra
    // _talkToNpc saber que um clique nele deve puxar uma batalha, não uma
    // fala genérica.
    _makeVampireWanderer() {
        const w = window.Engine.width, h = window.Engine.height;
        const x = Utils.randomFloat(w * 0.1, w * 0.9);
        const y = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
        return {
            x, y, targetX: x, targetY: y, pin: null,
            waitTimer: Utils.randomFloat(1, 3),
            facing: Utils.chance(50) ? 1 : -1,
            isVampireWanderer: true,
            entity: {
                visuals: {
                    gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
                    skinTone: '#e8dce8', hairStyle: Utils.randomInt(1, 15),
                    hairColor: '#1a1418', beardStyle: 0, eyeColor: '#c81e2a', faceShape: 1,
                    hasFangs: true
                },
                equipment: {},
                __teamColor: '#3a1420'
            },
            anim: { type: 'idle', start: performance.now(), duration: 0 }
        };
    }

    // Mercador Viajante — mesma "forma" de objeto NPC que _makeNpc/
    // _makeVampireWanderer (x/targetX/waitTimer/facing/entity/anim) pra
    // reaproveitar _updateNpcs/_drawNpc/draw() sem duplicar nada; só marcado
    // com isTravelingMerchant (pra _talkToNpc abrir a loja especial em vez
    // de puxar uma fala genérica) e despawnTimer (ver _updateTravelingMerchant).
    // Manto roxo vistoso o distingue à distância dos NPCs comuns da praça.
    _makeTravelingMerchant() {
        const w = window.Engine.width, h = window.Engine.height;
        const x = Utils.randomFloat(w * 0.15, w * 0.85);
        const y = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
        return {
            x, y, targetX: x, targetY: y, pin: null,
            waitTimer: Utils.randomFloat(1, 3),
            facing: Utils.chance(50) ? 1 : -1,
            isTravelingMerchant: true,
            despawnTimer: Utils.randomFloat(70, 110),
            entity: {
                visuals: {
                    gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
                    skinTone: '#c99a6a', hairStyle: Utils.randomInt(1, 15),
                    hairColor: '#2a1c10', beardStyle: Utils.chance(60) ? Utils.randomInt(1, 4) : 0,
                    eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {},
                __teamColor: '#7a2a8a'
            },
            anim: { type: 'idle', start: performance.now(), duration: 0 }
        };
    }

    _updateNpcs(dt, list = this.npcs, speed = 45) {
        const h = window.Engine.height;
        for (const npc of list) {
            // Rotina de vida (item #5 do novo pedido de auditoria — "NPCs
            // vivos"): enquanto "dentro" de uma loja/taverna, o NPC fica
            // parado e invisível (ver _sendNpcToVisitBuilding/
            // _npcLeavesBuilding) — não participa do movimento normal
            // nenhum até o tempo de visita acabar.
            if (npc.routineState === 'inside') {
                npc.insideTimer -= dt;
                if (npc.insideTimer <= 0) this._npcLeavesBuilding(npc);
                continue;
            }

            npc.waitTimer -= dt;
            const dx = npc.targetX - npc.x, dy = npc.targetY - npc.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 4) {
                npc.x += (dx / dist) * speed * dt;
                npc.y += (dy / dist) * speed * dt;
                npc.facing = dx >= 0 ? 1 : -1;
                npc.anim.type = 'walk';
            } else {
                npc.anim.type = 'idle';
                // Chegou à porta do prédio que estava visitando — entra.
                if (npc.routineState === 'visiting') {
                    npc.routineState = 'inside';
                    npc.invisible = true;
                    npc.insideTimer = Utils.randomFloat(18, 45);
                    continue;
                }
                if (npc.waitTimer <= 0 && npc.pin) {
                    npc.targetX = Utils.randomFloat(npc.pin.x - npc.pin.radius, npc.pin.x + npc.pin.radius);
                    npc.targetY = Utils.randomFloat(npc.pin.y - npc.pin.radius * 0.4, npc.pin.y + npc.pin.radius * 0.4);
                    npc.waitTimer = Utils.randomFloat(2, 6);
                } else if (npc.waitTimer <= 0) {
                    const w = window.Engine.width;
                    npc.targetX = Utils.randomFloat(w * 0.1, w * 0.9);
                    npc.targetY = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
                    npc.waitTimer = Utils.randomFloat(2, 6);
                }
            }
        }
    }

    // Manda um NPC comum visitar uma loja/taverna da praça (ver
    // _rollNpcBuildingVisits) — reaproveita o MESMO campo targetX/targetY já
    // usado pelo wander normal, só muda o QUE acontece na chegada (ver
    // _updateNpcs `routineState === 'visiting'`), sem duplicar nenhuma
    // lógica de movimento.
    _sendNpcToVisitBuilding(npc) {
        const visitable = this.buildings.filter(b => ['blacksmith', 'armorer', 'tavern', 'arcane'].includes(b.id));
        if (visitable.length === 0) return;
        const building = visitable[Utils.randomInt(0, visitable.length - 1)];
        const door = this._doorPoint(building);
        npc.routineState = 'visiting';
        npc.targetX = door.x;
        npc.targetY = door.y;
    }

    // Chamado quando o tempo de visita acaba (ver _updateNpcs) — volta a
    // vagar normalmente pela praça, como qualquer NPC recém-nascido.
    _npcLeavesBuilding(npc) {
        npc.invisible = false;
        npc.routineState = 'wandering';
        const w = window.Engine.width, h = window.Engine.height;
        npc.targetX = Utils.randomFloat(w * 0.1, w * 0.9);
        npc.targetY = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
        npc.waitTimer = 0;
    }

    // Rotina de vida dos NPCs (item #5 do novo pedido de auditoria): a cada
    // troca de fase do dia (exceto ao entrar na noite, quando todos os
    // comuns já somem sozinhos — ver draw()), uma fração dos moradores
    // comuns decide visitar uma loja/taverna por um tempo, simulando ter
    // vida própria além de vagar a esmo pela praça. NPCs "presos"
    // (espectadores da Arena, Viajante do Portão) nunca têm rotina — eles
    // existem só pra dar movimento constante num ponto fixo da praça.
    _rollNpcBuildingVisits() {
        this.npcs.forEach(npc => {
            if (npc.pin || npc.isCaravanTraveler) return;
            if (npc.routineState === 'inside' || npc.routineState === 'visiting') return;
            if (Utils.chance(35)) this._sendNpcToVisitBuilding(npc);
        });
    }

    // --- Entrada (clique/toque + teclado) ---

    _setupInput() {
        const screenEl = document.getElementById('screen-hub');
        screenEl.addEventListener('click', (e) => {
            if (!this._isActive()) return;
            if (e.target.closest('button')) return; // não interfere com ☰/🎒/prompt
            // Trava de segurança contra o "clique" de compatibilidade que
            // navegadores disparam alguns instantes depois de um toque real
            // (ver touchend abaixo) — mesmo com preventDefault() lá, alguns
            // navegadores/webviews ainda disparam esse clique sintético de
            // qualquer forma. Ignorar qualquer clique logo após um toque já
            // tratado fecha essa brecha de vez, sem depender de nenhuma
            // API específica de navegador se comportar do jeito esperado.
            // Era exatamente essa falha que fazia falar com um NPC (ou
            // qualquer clique) "executar duas vezes" no toque.
            if (performance.now() - this._lastTouchHandledAt < 600) return;
            this._handleClick(e.clientX, e.clientY);
        });
        // Toque dedicado (evita atraso de "ghost click" em alguns navegadores móveis).
        screenEl.addEventListener('touchend', (e) => {
            if (!this._isActive()) return;
            if (e.target.closest('button')) return;
            if (e.changedTouches && e.changedTouches[0]) {
                e.preventDefault();
                this._lastTouchHandledAt = performance.now();
                const t = e.changedTouches[0];
                this._handleClick(t.clientX, t.clientY);
            }
        }, { passive: false });

        // Enquanto parado, o gladiador acompanha o mouse com o olhar (vira
        // pro lado onde o cursor está) — só cosmético, não interfere no
        // clique-para-andar nem na colisão.
        screenEl.addEventListener('mousemove', (e) => {
            if (!this._isActive()) return;
            const canvas = document.getElementById('game-canvas');
            const rect = canvas.getBoundingClientRect();
            this._mouseX = e.clientX - rect.left;
        });

        window.addEventListener('keydown', (e) => this._handleKey(e, true));
        window.addEventListener('keyup', (e) => this._handleKey(e, false));
    }

    _handleKey(e, isDown) {
        if (!this._isActive()) return;
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': this.keysHeld.up = isDown; break;
            case 'ArrowDown': case 's': case 'S': this.keysHeld.down = isDown; break;
            case 'ArrowLeft': case 'a': case 'A': this.keysHeld.left = isDown; break;
            case 'ArrowRight': case 'd': case 'D': this.keysHeld.right = isDown; break;
            case 'e': case 'E':
                if (isDown && this._nearBuilding) this.interact(this._nearBuilding.id);
                break;
            default: return;
        }
        if (isDown) this._dismissHint();
    }

    _dismissHint() {
        if (this._hintShown) {
            this._hintShown = false;
            if (this._hintEl) this._hintEl.classList.add('hidden');
        }
    }

    _handleClick(clientX, clientY) {
        const canvas = document.getElementById('game-canvas');
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left, y = clientY - rect.top;
        this._dismissHint();

        // Clicar num NPC manda o jogador andar até perto dele primeiro (ver
        // _approachAndTalk/_updatePendingTalk) — antes a fala (ver
        // _talkToNpc) disparava instantaneamente no clique, não importa a
        // distância, o que não fazia sentido narrativo nenhum (o personagem
        // "falava" com alguém do outro lado da praça sem se mexer).
        const npc = this._npcAtPoint(x, y);
        if (npc) {
            this._approachAndTalk(npc);
            return;
        }

        // Clicar numa Pedra de Luz (ver _spawnLightStonesIfNeeded) manda o
        // jogador andar até perto dela primeiro, mesmo fluxo de aproximação
        // do NPC acima — coletar um Fragmento Sagrado sem sequer se
        // aproximar dele não faria sentido físico nenhum, e o objeto todo
        // desta iteração é justamente dar presença FÍSICA a esse recurso.
        const stone = this._lightStoneAtPoint(x, y);
        if (stone) {
            this._approachAndCollectStone(stone);
            return;
        }

        // Clicar direto num prédio entra nele na hora, sem precisar andar até
        // lá primeiro — só cliques no chão (fora de qualquer estrutura) fazem
        // o jogador caminhar. Continua dando pra "passear de verdade" com
        // WASD/setas ou clicando no chão; o clique direto na estrutura é só
        // um atalho.
        const building = this._buildingAtPoint(x, y);
        if (building) {
            this.interact(building.id);
            return;
        }

        const clampedY = Utils.clamp(y, this._horizon(window.Engine.height) + 10, this._plazaBottom(window.Engine.height) + 20);
        this._setPlayerDestination(x, clampedY);
    }

    // NPCs comuns somem à noite (ver draw()), mas o Viajante do Portão
    // (isCaravanTraveler, ver _makeCaravanTraveler) é a ÚNICA forma de
    // viajar entre Cidades-Hub — ele nunca deveria desaparecer junto com o
    // resto da praça, senão a mecânica inteira de viagem fica travada
    // sempre que a noite cai, sem nenhum aviso ao jogador (o portão de uma
    // cidade de verdade não fecha só porque escureceu). Reaproveitado tanto
    // pra detecção de clique (_npcAtPoint) quanto pro desenho (draw()).
    _nightVisibleNpcs() {
        return this.nightWanderers.concat(this.npcs.filter(n => n.isCaravanTraveler));
    }

    // NPC mais próximo do clique, dentro de um raio pequeno (não deveria
    // "roubar" cliques destinados a andar pelo chão logo ao lado dele).
    _npcAtPoint(x, y) {
        const radius = 34 * this._cityScale(window.Engine.height);
        let closest = null, closestDist = radius;
        const isNight = window.GFX && window.GFX.arenaTime === 'night';
        const pool = isNight ? this._nightVisibleNpcs() : this.npcs;
        for (const npc of pool) {
            // Rotina de vida (item #5): um NPC "dentro" de uma loja/taverna
            // não pode ser clicado/conversado — ele simplesmente não está
            // na praça agora (ver _updateNpcs/draw()).
            if (npc.invisible) continue;
            const d = Math.hypot(npc.x - x, npc.y - y);
            if (d <= closestDist) { closest = npc; closestDist = d; }
        }
        return closest;
    }

    // Manda o jogador andar até perto do NPC clicado, sem falar ainda — a
    // fala de verdade só dispara quando ele chega (ver _updatePendingTalk).
    // Clicar de novo no MESMO NPC enquanto já está a caminho não reinicia o
    // trajeto (evita ficar recalculando o caminho a cada clique repetido).
    _approachAndTalk(npc) {
        if (this._pendingTalkNpc === npc) return;
        this._pendingTalkNpc = npc;
        // Para a uma distância confortável de conversa, do lado de onde o
        // jogador já está vindo (não em cima do NPC).
        const approachDist = 42;
        const dir = (npc.x >= this.player.x) ? -1 : 1;
        const destX = npc.x + dir * approachDist;
        this._setPlayerDestination(destX, npc.y);
    }

    // Chamado a cada frame (ver update()): assim que o jogador termina de
    // andar até o destino de _approachAndTalk, os dois se encaram e só
    // ENTÃO a fala de verdade dispara (_talkToNpc). Se o NPC sumiu no meio
    // do caminho (mercador foi embora, vampiro se recolheu ao amanhecer) ou
    // o jogador acabou ficando longe demais (obstáculo no meio do trajeto,
    // ou um clique novo o desviou pra outro lugar), desiste silenciosamente.
    _updatePendingTalk() {
        if (!this._pendingTalkNpc) return;
        const npc = this._pendingTalkNpc;
        const stillExists = this.npcs.includes(npc) || this.nightWanderers.includes(npc);
        if (!stillExists) { this._pendingTalkNpc = null; return; }

        const arrived = this.player.targetX === null && this.player.pathQueue.length === 0;
        if (!arrived) return;

        this._pendingTalkNpc = null;
        if (this._distanceTo({ x: npc.x, y: npc.y }) > 70) return; // desviado no meio do caminho, desiste

        // Os dois se encaram antes de qualquer fala.
        this.player.facing = (npc.x >= this.player.x) ? 1 : -1;
        npc.facing = (npc.x > this.player.x) ? -1 : 1;
        this._talkToNpc(npc);
    }

    // Posição de tela de uma Pedra de Luz — mesma convenção de xFrac/
    // rowOffset escalados por _cityScale já usada por fonte/estátuas/vegetação.
    _lightStonePos(stone) {
        const w = window.Engine.width, h = window.Engine.height;
        const scale = this._cityScale(h);
        return { x: stone.spot.xFrac * w, y: this._horizon(h) + stone.spot.rowOffset * scale };
    }

    // Pedra de Luz mais próxima do clique, dentro de um raio pequeno (mesma
    // ideia de _npcAtPoint) — só considera pedras ainda não coletadas.
    _lightStoneAtPoint(x, y) {
        const radius = 30 * this._cityScale(window.Engine.height);
        let closest = null, closestDist = radius;
        for (const stone of this.lightStones) {
            if (stone.collected) continue;
            const pos = this._lightStonePos(stone);
            const d = Math.hypot(pos.x - x, pos.y - y);
            if (d <= closestDist) { closest = stone; closestDist = d; }
        }
        return closest;
    }

    // Manda o jogador andar até perto da pedra clicada, mesma ideia de
    // _approachAndTalk — a coleta de verdade só dispara na chegada (ver
    // _updatePendingCollectStone).
    _approachAndCollectStone(stone) {
        if (this._pendingCollectStone === stone) return;
        this._pendingCollectStone = stone;
        const pos = this._lightStonePos(stone);
        const approachDist = 34;
        const dir = (pos.x >= this.player.x) ? -1 : 1;
        this._setPlayerDestination(pos.x + dir * approachDist, pos.y);
    }

    // Chamado a cada frame (ver update()): assim que o jogador termina de
    // andar até o destino de _approachAndCollectStone, coleta de verdade
    // (_collectLightStone). Se a pedra sumiu no meio do caminho (já
    // coletada por... nada mais a coleta além do próprio jogador, mas o
    // Ritual pode ter sido concluído nesse meio-tempo, ver
    // _updateLightStones) ou o jogador ficou longe demais, desiste
    // silenciosamente — mesmo padrão de _updatePendingTalk.
    _updatePendingCollectStone() {
        if (!this._pendingCollectStone) return;
        const stone = this._pendingCollectStone;
        const stillExists = this.lightStones.includes(stone) && !stone.collected;
        if (!stillExists) { this._pendingCollectStone = null; return; }

        const arrived = this.player.targetX === null && this.player.pathQueue.length === 0;
        if (!arrived) return;

        this._pendingCollectStone = null;
        const pos = this._lightStonePos(stone);
        if (this._distanceTo(pos) > 60) return; // desviado no meio do caminho, desiste
        this._collectLightStone(stone);
    }

    // Coleta de verdade: soma o Fragmento Sagrado ao progresso do Ritual da
    // Luz (mesmo RitualSystem.onSacredFragmentFound que o antigo evento
    // aleatório já chamava — o RECURSO em si não muda, só ganhou presença
    // física de verdade), com VFX/som próprios, e agenda o respawn (ver
    // _updateLightStones) na MESMA posição fixa — nunca uma nova pedra em
    // lugar aleatório.
    _collectLightStone(stone) {
        const p = window.Engine.state.player;
        if (!p) return;
        stone.collected = true;
        // Mesma janela de tempo (50-100s) que o evento aleatório substituído
        // usava para sortear de novo — preserva o ritmo de raridade original.
        stone.respawnTimer = Utils.randomFloat(50, 100);

        window.RitualSystem.onSacredFragmentFound(p, 1);
        const have = p.ritualProgress.luz.sacredFragments;
        const pos = this._lightStonePos(stone);
        if (window.GFX) {
            window.GFX.spawnParticles(pos.x, pos.y - 10, '#fff2b8', 18, 4, 3);
            window.GFX.spawnText(pos.x, pos.y - 40, '+1 Fragmento Sagrado', '#ffe9a3', false);
        }
        if (window.AudioManager) window.AudioManager.playLightPickup();
        this._toast(`Você recolhe um Fragmento Sagrado que brilhava entre as pedras... (${have}/5)`, 'success');

        // Já reuniu tudo que precisava — a última pedra some de vez (sem
        // respawn) e o resto da praça também some no próximo
        // _spawnLightStonesIfNeeded (ver onEnterCity/travelToCity).
        if (have >= 5) this.lightStones.forEach(s => { s.collected = true; s.respawnTimer = Infinity; });
    }

    // Decrementa o respawn de cada pedra já coletada (ver update()) e a
    // faz reaparecer na MESMA posição — só se o jogador ainda precisar dela
    // (ritual ainda incompleto, nenhuma Linhagem despertada nesse meio-tempo).
    _updateLightStones(dt) {
        if (this.lightStones.length === 0) return;
        const p = window.Engine.state.player;
        for (const stone of this.lightStones) {
            if (!stone.collected) continue;
            stone.respawnTimer -= dt;
            if (stone.respawnTimer <= 0) {
                const rp = p ? p.ritualProgress.luz : null;
                const stillEligible = p && !p.lineage && (!rp || rp.sacredFragments < 5);
                if (stillEligible) stone.collected = false;
            }
        }
    }

    // Fala rápida de um NPC ambiente — nunca revela mecanismos de jogo
    // diretamente (isso já é papel dos rumores de Linhagem, ver
    // _eventLineageRumor), só reage à fama do jogador (vitórias) ou solta
    // uma observação genérica sobre a vida na praça.
    _talkToNpc(npc) {
        const p = window.Engine.state.player;
        // Aproximar-se de um vampiro vagando pela noite não puxa uma fala —
        // puxa a briga (mesmo fluxo de _eventVampireEncounter, só que
        // iniciado pelo jogador clicando na criatura em vez de um dado
        // aleatório de fundo).
        if (npc.isVampireWanderer) {
            this._toast('A figura pálida sibila e avança contra você...', 'error');
            if (window.AudioManager) window.AudioManager.playError();
            setTimeout(() => {
                if (this._isActive() && window.UI && window.UI.beginBattleWith) {
                    const arenaMenu = document.getElementById('city-arena-menu');
                    if (arenaMenu) arenaMenu.classList.add('hidden');
                    window.UI.beginBattleWith(new Vampire(p ? p.level : 1));
                }
            }, 1200);
            return;
        }
        // Mercador Viajante (ver _eventRareMerchant/_makeTravelingMerchant):
        // clicar nele abre a loja especial em vez de puxar uma fala
        // genérica — reaproveita window.UI.openShop tal como Ferreiro/
        // Armeiro/Taverna, só com título próprio (também plugado no
        // desconto de Carisma/vitórias em _shopDiscount de graça).
        // Viajante do Portão (ver _makeCaravanTraveler) — substitui o antigo
        // prédio Estábulo: conversar com ele abre o menu de viagem entre
        // Cidades-Hub (ver ui.js openCaravan/CityEngine.travelToCity),
        // exatamente a mesma tela e lógica de antes, só disparada por um
        // NPC de verdade parado no portão em vez de "entrar" num prédio.
        if (npc.isCaravanTraveler) {
            this._toast('Viajante do Portão: "Pague a passagem e te levo pra qualquer canto que já tenha visitado, gladiador."', 'info');
            if (window.AudioManager) window.AudioManager.playConfirm();
            if (window.UI && window.UI.openCaravan) window.UI.openCaravan();
            return;
        }
        if (npc.isTravelingMerchant) {
            this._toast('Mercador Viajante: "Chegou bem a tempo — veja o que trouxe de terras distantes!"', 'info');
            if (window.AudioManager) window.AudioManager.playConfirm();
            if (window.UI && window.UI.openShop) window.UI.openShop(null, 'Mercador Viajante');
            return;
        }
        const wins = p ? (p.wins || 0) : 0;
        let pool = CityEngine.NPC_DIALOGUE.generic;
        let speaker = null; // prefixo "Profissão: " no toast — só faz sentido pro pool de profissão
        // Linhagem despertada (ver lineages.js) muda a APARÊNCIA de verdade
        // (presas/pele pálida do Vampirismo, aura dourada da Luz — ver
        // graphics.js _drawFangs/_drawLineageAura), mas nenhum NPC jamais
        // comentava sobre isso: reputação (wins) e mutação visível ficavam
        // sem nenhuma diferença nas falas, mesmo a mutação sendo o que
        // qualquer um cruzando a praça literalmente VERIA primeiro.
        // Cidade-Hub atual (ver citydatabase.js) — moradores das novas
        // cidades regionais comentam sobre onde vivem de verdade, não só o
        // discurso genérico de praça grega. Só a cidade natal (Porto
        // Helênico) fica sem esse comentário: os gregos já têm bastante
        // identidade própria no resto das falas (profissões, eventos).
        const cityId = window.getCurrentCityId ? window.getCurrentCityId() : null;
        const cityDialoguePool = (cityId && cityId !== 'porto_helenico') ? CityEngine.NPC_DIALOGUE[cityId] : null;

        if (p && p.lineage && CityEngine.NPC_DIALOGUE[p.lineage]) {
            pool = CityEngine.NPC_DIALOGUE[p.lineage];
        } else if (wins >= 25) pool = CityEngine.NPC_DIALOGUE.legendary;
        else if (wins >= 10) pool = CityEngine.NPC_DIALOGUE.famous;
        // Chance de comentar sobre a própria cidade em vez da profissão —
        // não every vez, pra profissão continuar sendo a identidade
        // principal de cada NPC na maior parte das conversas.
        else if (cityDialoguePool && Utils.chance(35)) {
            pool = cityDialoguePool;
        }
        // Rumores (item #6 do novo pedido de auditoria): chance menor que a
        // fala de cidade acima, pra continuar sendo um "achado" ocasional,
        // não a norma — nunca compete com a identidade de fama/linhagem/
        // cidade, só entra quando nenhuma delas já decidiu a fala.
        else if (Utils.chance(20)) {
            pool = CityEngine.NPC_DIALOGUE.rumors;
        }
        // Sem fama ainda: cada NPC fala como a profissão que É, não como um
        // figurante genérico (ver NPC_PROFESSIONS/_makeNpc). NPCs mais
        // antigos que por algum motivo não tenham `profession` (não deveria
        // acontecer, mas evita quebrar) caem de volta no pool genérico.
        else if (npc.profession && CityEngine.NPC_PROFESSIONS[npc.profession]) {
            // Versão regional da fala de profissão (ver
            // NPC_PROFESSIONS_REGIONAL acima) — mesmo `name` de exibição,
            // conteúdo próprio da cultura local quando existir; sem entrada
            // pra essa cidade/profissão, cai no pool genérico de sempre.
            const regionalProfessions = CityEngine.NPC_PROFESSIONS_REGIONAL[cityId];
            const regionalLines = regionalProfessions && regionalProfessions[npc.profession];
            pool = regionalLines || CityEngine.NPC_PROFESSIONS[npc.profession].lines;
            speaker = CityEngine.NPC_PROFESSIONS[npc.profession].name;
        }

        const line = pool[Utils.randomInt(0, pool.length - 1)];
        // A profissão (ver NPC_PROFESSIONS, iteração 15) nunca aparecia na
        // fala em si — o jogador só descobriria que falou com um "Mercador"
        // lendo o código-fonte. Prefixar com quem está falando fecha essa
        // lacuna sem exigir nenhum sistema de nome próprio por NPC.
        this._toast(speaker ? `${speaker}: ${line}` : line, 'info');
        if (window.AudioManager) window.AudioManager.playConfirm();
        // NPC e jogador já se encaram antes de chegar aqui (ver
        // _updatePendingTalk, que chama _talkToNpc só depois de ajustar os
        // dois `facing`) — nada a fazer com direção neste método.

        // Progresso de missões de Investigação (ver quests.js) — só conversas
        // GENÉRICAS de ambiente contam (nunca vampiro/mercador/viajante, que
        // já têm fluxos próprios acima e não são "moradores comuns" pra fins
        // de missão).
        if (window.QuestSystem && p) window.QuestSystem.onNpcTalked(p);
    }

    get _interactRadius() { return 70; }

    // Os prédios foram desenhados pensando numa janela ~800px de altura e
    // ~1100px de largura. Em telas bem mais baixas (celular deitado) o
    // horizonte (h*0.62) sobra muito menos espaço acima dele; em telas bem
    // mais estreitas (celular em pé) as 4 casas da fileira do meio (130px
    // cada) não cabem lado a lado. Encolhemos pela dimensão mais restritiva
    // das duas para garantir que prédios, jogador e NPCs sempre caibam.
    _cityScale(h) {
        const w = window.Engine ? window.Engine.width : window.innerWidth;
        const horizon = this._horizon(h);
        const heightScale = Utils.clamp(horizon / 496, 0.45, 1); // 496 = horizonte de referência (h=800)
        const widthScale = Utils.clamp(w / 1100, 0.34, 1); // 1100 = largura de referência
        return Math.min(heightScale, widthScale);
    }

    _doorPoint(building) {
        const w = window.Engine.width, h = window.Engine.height;
        const scale = this._cityScale(h);
        const baseY = this._horizon(h) + building.rowOffset * scale;
        return { x: building.xFrac * w, y: baseY };
    }

    _buildingRect(building) {
        const door = this._doorPoint(building);
        const scale = this._cityScale(window.Engine.height);
        const bw = building.w * scale, bh = building.h * scale;
        return { left: door.x - bw / 2, right: door.x + bw / 2, top: door.y - bh, bottom: door.y, w: bw, h: bh };
    }

    _buildingAtPoint(x, y) {
        for (const b of this.buildings) {
            const r = this._buildingRect(b);
            if (x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 10) return b;
        }
        return null;
    }

    _distanceTo(point) {
        return Math.hypot(this.player.x - point.x, this.player.y - point.y);
    }

    // --- Interação: chama diretamente os métodos que já existem em ui.js ---
    interact(buildingId) {
        if (window.AudioManager) window.AudioManager.playConfirm();
        switch (buildingId) {
            case 'arena':
                document.getElementById('city-arena-menu').classList.remove('hidden');
                break;
            case 'blacksmith':
                window.UI.openShop([SLOTS.MAIN_HAND, SLOTS.RANGED], 'Ferreiro');
                break;
            case 'armorer':
                window.UI.openShop([SLOTS.HEAD, SLOTS.CHEST, SLOTS.HANDS, SLOTS.LEGS, SLOTS.FEET, SLOTS.OFF_HAND, SLOTS.AMULET, SLOTS.RING], 'Armeiro');
                break;
            case 'arcane':
                window.UI.openSkillTree();
                break;
            case 'tavern':
                window.UI.openHealer();
                break;
            case 'bank':
                window.UI.openBank();
                break;
            case 'house':
                window.UI.openPlayerHouse();
                break;
            case 'halloffame':
                window.UI.openHallOfFame();
                break;
            case 'questboard':
                window.UI.openQuestBoard();
                break;
            default: break;
        }
    }

    // --- Cidades-Hub Regionais: viagem entre cidades (ver ui.js openCaravan,
    // citydatabase.js) ---
    // Única função autorizada a de fato trocar de cidade: cobra o preço em
    // ouro, atualiza a cidade persistida no save, e recarrega tudo que
    // depende da cidade atual (NPCs, clima, estoque de loja, mercador
    // viajante) — nenhum outro lugar do código deve setar
    // `player.currentCityId` diretamente. Retorna `true` em caso de sucesso,
    // `false` se a viagem não pôde ser feita (validado de novo aqui mesmo
    // que a UI já valide antes, pra nunca depender só da tela pra manter a
    // integridade do estado).
    // `skipCost` (ver roads.js RoadSystem/ui.js openRoad): a viagem manual
    // por terra já cobra (ou não, no caso de ir a pé) o próprio custo de
    // deslocamento AO LONGO do caminho — descontar `travelCost` de novo
    // aqui na chegada cobraria a passagem em dobro. Default `false`
    // preserva 100% do comportamento original pro único chamador que já
    // existia (ui.js travelToCity, o Viajante do Portão/viagem rápida).
    travelToCity(cityId, skipCost = false) {
        const p = window.Engine.state.player;
        const dest = window.CityDatabase ? window.CityDatabase[cityId] : null;
        if (!p || !dest) return false;
        if (cityId === window.getCurrentCityId()) return false; // já está lá
        if (p.level < dest.unlockLevel) return false; // ainda não desbloqueada
        if (!skipCost) {
            if (p.gold < dest.travelCost) return false; // ouro insuficiente
            p.gold -= dest.travelCost;
        }
        p.currentCityId = cityId;

        // Registro de cidades visitadas (ver conquista 'world_explorer' em
        // player.js) — saves antigos nunca tiveram esse campo, então
        // inicializa defensivamente igual ao resto dos campos novos deste
        // sistema (mesmo padrão de `p.fatigue || 0` usado em todo o jogo).
        if (!p.visitedCityIds) p.visitedCityIds = [window.DEFAULT_CITY_ID];
        if (!p.visitedCityIds.includes(cityId)) p.visitedCityIds.push(cityId);
        const visitedAll = Object.keys(window.CityDatabase).every(id => p.visitedCityIds.includes(id));
        if (visitedAll) {
            const unlocked = p.checkAchievements({ visitedAllCities: true });
            if (unlocked.length > 0) {
                setTimeout(() => this._toast(`🏆 Conquista desbloqueada: ${unlocked[0].name}!`, 'success'), 1600);
            }
        }

        // Recarrega o ambiente da nova cidade: NPCs comuns e "presos"
        // (espectadores da Arena) somem e renascem já com a demografia
        // racial certa (ver _makeNpc); vampiros noturnos, mercador viajante
        // e promoção de loja ativa não fazem sentido "atravessar" a viagem
        // com o jogador. O clima reseta pro estado neutro — o próprio
        // _updateWeather já vai sortear de novo usando os modificadores da
        // cidade nova no timer seguinte.
        // Bug crítico de auditoria (item 1 — Viajante do Portão desaparecendo
        // após viajar entre cidades): `this.npcs = []` logo abaixo apaga o
        // objeto NPC do Viajante do Portão do array, mas a flag de
        // "spawnou uma vez" (`_gateTravelerSpawned`) NUNCA era resetada —
        // ao contrário de `_arenaNpcsSpawned` (linha abaixo), que já era
        // corretamente resetada. `_spawnNpcsIfNeeded()` só recria o
        // Viajante quando `!this._gateTravelerSpawned`, então depois da
        // PRIMEIRA viagem essa flag ficava travada em `true` para sempre —
        // o Viajante sumia da praça e nunca mais era recriado em nenhuma
        // cidade seguinte, mesmo continuando a viajar mais vezes. Só um
        // refresh da página (que recria o CityEngine do zero, com a flag
        // de volta a `false`) trazia ele de volta — exatamente o sintoma
        // reportado. Resetar aqui, no mesmo lugar que `_arenaNpcsSpawned`,
        // corrige de vez.
        this.npcs = [];
        this.nightWanderers = [];
        this._arenaNpcsSpawned = false;
        this._gateTravelerSpawned = false;
        this.travelingMerchant = null;
        this.activePromotion = null;
        this.weather = 'clear';
        this._weatherTimer = Utils.randomFloat(45, 90);
        this.isStorm = false;
        // Pedras de Luz (ver _spawnLightStonesIfNeeded) — mesma razão do
        // resto do ambiente acima: não faz sentido "atravessar" a viagem com
        // o jogador, então força uma nova rodada (todas não coletadas) na
        // cidade de chegada.
        this.lightStones = [];
        this._pendingCollectStone = null;
        this._spawnNpcsIfNeeded();
        this._spawnLightStonesIfNeeded();

        // Troca o MOOD da trilha ambiente pra da nova cidade (ver
        // audio.js CITY_MUSIC_MOODS) — startAmbientMusic() é um no-op se já
        // houver uma trilha tocando, então sem parar e recomeçar aqui o
        // drone da cidade antiga continuaria tocando pra sempre, mesmo
        // depois de viajar pra uma cidade com identidade sonora diferente.
        if (window.AudioManager) {
            window.AudioManager.stopCityAmbience();
            window.AudioManager.startCityAmbience();
        }

        // Estoque de loja é cacheado por cidade também (ver ui.js openShop
        // `cacheKey`), então não precisa ser limpo aqui — só nunca reutiliza
        // o estoque de outra cidade por engano.

        // Progresso de missões de Entrega (ver quests.js) — completa ao
        // CHEGAR na cidade de destino pedida.
        if (window.QuestSystem) window.QuestSystem.onCityArrival(p, cityId);

        window.SaveManager.save(window.Engine.state);
        this._toast(`Você chega a ${dest.name}!`, 'success');
        return true;
    }

    // --- Atualização por frame ---
    update(dt) {
        if (!this._isActive() || !this._initialized) return;

        this._updateDayCycle(dt);
        this._updateMovement(dt);
        this._updatePendingTalk();
        this._updatePendingCollectStone();
        this._updateLightStones(dt);
        const isNight = window.GFX && window.GFX.arenaTime === 'night';
        // NPCs comuns recolhem-se de noite (ver draw()) — não há por que
        // continuar simulando o passeio de alguém que ninguém vê.
        if (!isNight) this._updateNpcs(dt);
        // Vampiros vagam mais devagar que a gente comum — reforça a
        // sensação de algo observando, não só passando por perto.
        else this._updateNpcs(dt, this.nightWanderers, 28);
        this._updateProximity();
        this._updateAmbientEffects(dt);
        this._updateWeather(dt);
        this._updateRandomEvents(dt);
        this._updatePromotion(dt);
        this._updateNightAmbush(dt);
        this._updateTravelingMerchant(dt);
    }

    // Conta regressiva da promoção de loja ativa (ver _eventPromotion) — some
    // sozinha quando o tempo acaba, sem precisar de nenhum toast de aviso
    // (o mesmo tratamento silencioso que o clima já recebe em _updateWeather).
    _updatePromotion(dt) {
        if (!this.activePromotion) return;
        this.activePromotion.timer -= dt;
        if (this.activePromotion.timer <= 0) this.activePromotion = null;
    }

    // Juros diários do ouro guardado no Banco (ver ui.js openBank/
    // bankDeposit/bankWithdraw) — antes `bankGold` só existia pra proteger
    // ouro de ladrões/assaltos noturnos (nenhum evento de roubo nunca mexe
    // nele), sem NENHUMA razão pra realmente preferir guardar lá em vez de
    // só carregar tudo. +2% a cada amanhecer dá um motivo de verdade pra
    // usar o Banco como um lugar de poupança, não só um cofre.
    _applyBankInterest() {
        const p = window.Engine.state.player;
        if (!p || !p.bankGold || p.bankGold <= 0) return;
        const interest = Math.floor(p.bankGold * 0.02);
        if (interest <= 0) return;
        p.bankGold += interest;
        this._toast(`O Banco rendeu juros durante a noite: +${interest}g guardados.`, 'success');
    }

    // Avança o mundo pra um novo dia de verdade (novo pedido de auditoria,
    // item 2: "dormir não atualiza o mundo") — único ponto que executa TODAS
    // as consequências de "um dia se passou", chamado tanto pelo ciclo
    // natural dia/noite (_updateDayCycle, ao entrar em 'dawn' vindo de
    // 'night') quanto por qualquer forma de "dormir" que pule direto pro
    // período oposto (ver ui.js healFatigue/freeRest).
    //
    // Bug de auditoria encontrado: dormir só pulava `dayPhaseIndex` pro
    // período oposto do ciclo, sem rodar NENHUMA consequência de novo dia —
    // `dayCount` nunca incrementava (e o estoque de loja em ui.js openShop
    // só sorteia de novo quando `cachedStock.day !== dayCount` muda, então
    // ficava travado no mesmo estoque pra sempre), juros do Banco nunca
    // eram creditados, e os NPCs comuns/Viajante do Portão nunca eram
    // trocados por gente nova. Um jogador que sempre dormisse no Curandeiro
    // (em vez de esperar o ciclo ambiente correr sozinho) via a cidade
    // inteira "congelada" pra sempre, mesmo pagando pra descansar de
    // verdade — exatamente o sintoma reportado.
    //
    // PONTO DE EXTENSÃO: futuros sistemas diários (missões do quadro,
    // rumores, eventos aleatórios — itens #3/#6/#7 do mesmo pedido) devem
    // plugar seu próprio "reroll de novo dia" AQUI, nunca duplicar esta
    // função em outro lugar.
    advanceToNewDay() {
        this.dayCount++; // novo dia — ver openShop (ui.js), invalida o cache de estoque sozinho
        // Persiste o novo valor no Player (item #8 do novo pedido de
        // auditoria — ver onEnterCity/player.js `dayCount`), senão um
        // refresh logo depois desfaria este incremento (o contador
        // "voltaria no tempo" pra 1, mesmo o dia tendo passado de verdade).
        const dayCountPlayer = window.Engine && window.Engine.state && window.Engine.state.player;
        if (dayCountPlayer) dayCountPlayer.dayCount = this.dayCount;
        this._applyBankInterest();

        // Vampiros noturnos se recolhem com a luz do sol.
        this.nightWanderers = [];

        // NPCs comuns/presos e Viajante do Portão são trocados por gente
        // nova — mesmo padrão (e mesmas flags) já usado ao trocar de
        // cidade (ver travelToCity), reaproveitado aqui em vez de duplicado.
        this.npcs = [];
        this._arenaNpcsSpawned = false;
        this._gateTravelerSpawned = false;

        // Mercador Viajante e promoção de loja não "sobrevivem" a um dia
        // inteiro passado — um novo dia pode trazer (ou não) um mercador/
        // promoção diferente pelo sorteio normal de _updateRandomEvents.
        this.travelingMerchant = null;
        this.activePromotion = null;

        // Pedras de Luz (ver _spawnLightStonesIfNeeded/item 13): força uma
        // rodada nova, todas não coletadas, se o jogador ainda precisar delas.
        this.lightStones = [];
        this._pendingCollectStone = null;

        this._spawnNpcsIfNeeded();
        this._spawnLightStonesIfNeeded();

        // Missões Secundárias (ver quests.js) — falha qualquer missão ativa
        // cujo prazo tenha vencido; o quadro da cidade também sorteia uma
        // nova leva procedural sozinho no próximo openQuestBoard (cacheado
        // por dia, mesmo padrão do estoque de loja).
        const p = window.Engine && window.Engine.state && window.Engine.state.player;
        if (window.QuestSystem && p) window.QuestSystem.onNewDay(p);
    }

    _updateDayCycle(dt) {
        this.dayPhaseTimer += dt;
        if (this.dayPhaseTimer >= this.dayPhaseDuration) {
            this.dayPhaseTimer = 0;
            const enteringNight = this.dayPhases[this.dayPhaseIndex] !== 'night' && this.dayPhases[(this.dayPhaseIndex + 1) % this.dayPhases.length] === 'night';
            const enteringDawn = this.dayPhases[this.dayPhaseIndex] !== 'dawn' && this.dayPhases[(this.dayPhaseIndex + 1) % this.dayPhases.length] === 'dawn';
            this.dayPhaseIndex = (this.dayPhaseIndex + 1) % this.dayPhases.length;
            if (enteringNight) this._onNightFalls();
            if (enteringDawn) this.advanceToNewDay();
            // Rotina de vida dos NPCs (item #5 do novo pedido de auditoria) —
            // dispara em toda troca de fase, EXCETO ao entrar na noite (os
            // comuns já somem sozinhos nesse instante, ver draw(); mandá-los
            // "visitar uma loja" bem quando estão prestes a desaparecer não
            // faria sentido nenhum).
            if (!enteringNight) this._rollNpcBuildingVisits();
        }
        if (window.GFX) {
            window.GFX.arenaTime = this.dayPhases[this.dayPhaseIndex];
            // Progresso contínuo (0..1) do ciclo inteiro (dawn→day→sunset→
            // night→dawn...) — é isso que faz o sol/lua se moverem em arco de
            // verdade pelo céu em vez de só trocar de posição a cada fase.
            const phaseFrac = Utils.clamp(this.dayPhaseTimer / this.dayPhaseDuration, 0, 1);
            window.GFX.cityDayProgress = (this.dayPhaseIndex + phaseFrac) / this.dayPhases.length;
        }
    }

    // Chamado exatamente no instante em que a noite cai (transição de
    // qualquer fase para 'night'). Se o jogador passar 3 noites seguidas sem
    // dormir no Curandeiro (ver ui.js healFatigue, que zera o contador), a
    // fadiga aumenta automaticamente — reforça que "dormir" é uma decisão
    // real, não só uma forma de gastar ouro.
    _onNightFalls() {
        // Vampiros aparecem vagando pela praça vazia — antes a noite só
        // fazia os NPCs comuns sumirem (ver draw()), deixando a cidade
        // visualmente morta em vez de "perigosa": nenhuma criatura da noite
        // era visível, só um encontro invisível por dado (ver
        // _eventVampireEncounter/_eventNightMonsterAttack).
        const count = Utils.randomInt(1, 2);
        for (let i = 0; i < count; i++) this.nightWanderers.push(this._makeVampireWanderer());

        // Emboscada noturna garantida (ver _updateNightAmbush): antes o
        // ÚNICO jeito de topar com uma batalha noturna forçada era o sorteio
        // lento de _updateRandomEvents (rolagem a cada 50-100s, e só ~25% do
        // tempo mesmo é noite) — na prática, um jogador podia passar várias
        // noites inteiras na cidade sem NUNCA ser emboscado, mesmo o sistema
        // existindo. Agora toda vez que a noite cai, há uma chance real e
        // independente de uma emboscada acontecer pouco depois, sem
        // depender daquele sorteio ambiental raro.
        this._nightAmbushTimer = Utils.chance(55) ? Utils.randomFloat(8, 22) : null;

        const p = window.Engine.state.player;
        if (!p) return;
        p.nightsWithoutSleep = (p.nightsWithoutSleep || 0) + 1;
        if (p.nightsWithoutSleep >= 3) {
            p.nightsWithoutSleep = 0;
            if (p.fatigue < 3) {
                p.addFatigue(1);
                this._toast('Três noites sem dormir cobram seu preço — sua fadiga aumentou.', 'error');
            }
        }
    }

    // Decrementa o temporizador da emboscada noturna garantida (ver
    // _onNightFalls) e a dispara quando chega a zero — reaproveitando a
    // mesma lógica de _eventNightMonsterAttack (Vampiro ou Fantasma,
    // ambos com IA própria em enemy.js), só que sem depender do sorteio
    // ambiental lento. Cancela silenciosamente se a noite já tiver
    // acabado antes do timer disparar (o jogador dormiu ou o dia virou).
    _updateNightAmbush(dt) {
        if (this._nightAmbushTimer === null) return;
        if (!window.GFX || window.GFX.arenaTime !== 'night') { this._nightAmbushTimer = null; return; }
        this._nightAmbushTimer -= dt;
        if (this._nightAmbushTimer <= 0) {
            this._nightAmbushTimer = null;
            if (this._nightEncounterPending) return; // já tem um encontro a caminho, não empilha
            const p = window.Engine.state.player;
            if (p) this._eventNightMonsterAttack(p);
        }
    }

    _updateMovement(dt) {
        const h = window.Engine.height, w = window.Engine.width;
        let vx = 0, vy = 0;
        const keyMoving = this.keysHeld.up || this.keysHeld.down || this.keysHeld.left || this.keysHeld.right;

        if (keyMoving) {
            if (this.keysHeld.up) vy -= 1;
            if (this.keysHeld.down) vy += 1;
            if (this.keysHeld.left) vx -= 1;
            if (this.keysHeld.right) vx += 1;
            const len = Math.hypot(vx, vy) || 1;
            vx = (vx / len) * this.walkSpeed;
            vy = (vy / len) * this.walkSpeed;
            this.player.targetX = null;
            this.player.targetY = null;
            this.player.pathQueue = [];
        } else if (this.player.targetX !== null) {
            const dx = this.player.targetX - this.player.x;
            const dy = this.player.targetY - this.player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 4) {
                if (this.player.pathQueue.length > 0) {
                    // Ainda há trechos do trajeto contornando obstáculos — segue pro próximo.
                    const next = this.player.pathQueue.shift();
                    this.player.targetX = next.x;
                    this.player.targetY = next.y;
                } else {
                    this.player.targetX = null;
                    this.player.targetY = null;
                }
            } else {
                vx = (dx / dist) * this.walkSpeed;
                vy = (dy / dist) * this.walkSpeed;
            }
        }

        this.player.moving = vx !== 0 || vy !== 0;

        // Som de passo — só toca enquanto anda de verdade, num intervalo
        // fixo (independente de FPS, por isso o `dt`). A praça inteira era
        // silenciosa durante o movimento, com ou sem som ambiente ligado.
        if (this.player.moving) {
            this._footstepTimer -= dt;
            if (this._footstepTimer <= 0) {
                this._footstepTimer = 0.32;
                if (window.AudioManager) window.AudioManager.playFootstep();
                // Poeira nos pés a cada passo (mesmo instante do som) — o
                // chão de pedra/mármore da praça (ver _drawPlazaGround) nunca
                // reagia em nada ao jogador andar por cima, mesmo a Arena de
                // combate já tendo poeira ambiente própria (drawArenaBackground).
                if (window.GFX) window.GFX.spawnParticles(this.player.x, this.player.y + 4, '#9a8a70', 2, 0.6, 2);
            }
        } else {
            this._footstepTimer = 0;
        }

        if (vx !== 0) {
            this.player.facing = vx > 0 ? 1 : -1;
        } else if (!this.player.moving && this._mouseX != null) {
            // Parado: olha na direção do cursor (com uma pequena zona morta
            // pra não ficar tremendo quando o mouse está quase em cima dele).
            const dead = 6;
            if (this._mouseX > this.player.x + dead) this.player.facing = 1;
            else if (this._mouseX < this.player.x - dead) this.player.facing = -1;
        }

        let nx = this.player.x + vx * dt;
        let ny = this.player.y + vy * dt;

        // Colisão simples (eixo a eixo) contra prédios e a fonte central
        if (!this._collides(nx, this.player.y)) this.player.x = nx;
        if (!this._collides(this.player.x, ny)) this.player.y = ny;

        // Mantém o jogador dentro da praça
        this.player.x = Utils.clamp(this.player.x, 30, w - 30);
        this.player.y = Utils.clamp(this.player.y, this._horizon(h) + 20, this._plazaBottom(h) + 30);
    }

    _collides(x, y) {
        const margin = 16; // "largura" aproximada do gladiador
        for (const b of this.buildings) {
            const r = this._buildingRect(b);
            if (x > r.left - margin && x < r.right + margin && y > r.top && y < r.bottom + margin * 0.6) return true;
        }
        const w = window.Engine.width, h = window.Engine.height;
        const scale = this._cityScale(h);
        const f = { x: this.fountain.xFrac * w, y: this._horizon(h) + this.fountain.rowOffset * scale };
        if (Math.hypot(x - f.x, y - f.y) < this.fountain.r * scale + margin * 0.5) return true;
        return false;
    }

    // --- Caminho até o destino (grafo de visibilidade simples) ---
    // Antes o jogador tentava andar em linha reta até o alvo e, se um prédio
    // (ou a fonte) estivesse no meio do caminho, ficava "preso" deslizando na
    // parede sem nunca contornar o obstáculo. Agora, se a linha reta esbarra
    // em algo, calculamos o caminho mais curto contornando as quinas dos
    // obstáculos (com uma pequena folga) e o jogador anda por esse trajeto,
    // ponto a ponto, até o destino clicado.
    _obstacleRects() {
        const margin = 20; // mesma folga usada em _collides, pra nunca gerar um trajeto que roça a parede
        const rects = this.buildings.map(b => {
            const r = this._buildingRect(b);
            return { left: r.left - margin, right: r.right + margin, top: r.top, bottom: r.bottom + margin * 0.6 };
        });
        const w = window.Engine.width, h = window.Engine.height;
        const scale = this._cityScale(h);
        const fx = this.fountain.xFrac * w, fy = this._horizon(h) + this.fountain.rowOffset * scale;
        const fr = this.fountain.r * scale + margin * 0.5;
        rects.push({ left: fx - fr, right: fx + fr, top: fy - fr, bottom: fy + fr });
        return rects;
    }

    // Interseção segmento×retângulo (Liang-Barsky).
    _segmentHitsRect(x1, y1, x2, y2, rect) {
        const dx = x2 - x1, dy = y2 - y1;
        let tmin = 0, tmax = 1;
        const p = [-dx, dx, -dy, dy];
        const q = [x1 - rect.left, rect.right - x1, y1 - rect.top, rect.bottom - y1];
        for (let i = 0; i < 4; i++) {
            if (p[i] === 0) {
                if (q[i] < 0) return false;
            } else {
                const t = q[i] / p[i];
                if (p[i] < 0) { if (t > tmax) return false; if (t > tmin) tmin = t; }
                else { if (t < tmin) return false; if (t < tmax) tmax = t; }
            }
        }
        return tmin < tmax;
    }

    _lineClear(x1, y1, x2, y2, rects) {
        for (const r of rects) {
            if (this._segmentHitsRect(x1, y1, x2, y2, r)) return false;
        }
        return true;
    }

    // Retorna a lista de pontos (waypoints) que o jogador deve seguir, em
    // ordem, até (tx,ty). Se a linha reta já for livre, é só um ponto (o
    // próprio destino) — o caso comum, sem custo extra de cálculo.
    _findPath(sx, sy, tx, ty) {
        const rects = this._obstacleRects();
        if (this._lineClear(sx, sy, tx, ty, rects)) return [{ x: tx, y: ty }];

        // As quinas de um prédio alto (ex.: a Arena) podem ficar acima do
        // horizonte ou fora da faixa onde o jogador tem permissão de andar
        // (mesmo limite aplicado em _updateMovement) — usar essa quina como
        // waypoint travava o jogador contra o próprio limite da praça, sem
        // nunca chegar lá. Por isso descartamos quinas fora da área andável
        // ou que, depois de encostadas nela, ainda caiam dentro de algum
        // obstáculo (nesse caso o contorno tem que usar as outras quinas).
        const h = window.Engine.height, w = window.Engine.width;
        const minY = this._horizon(h) + 24, maxY = this._plazaBottom(h) + 26;
        const minX = 32, maxX = w - 32;
        const clampPt = (x, y) => ({ x: Utils.clamp(x, minX, maxX), y: Utils.clamp(y, minY, maxY) });
        const insideAnyRect = (x, y) => rects.some(r => x > r.left && x < r.right && y > r.top && y < r.bottom);

        const nodes = [{ x: sx, y: sy }];
        const pad = 3;
        rects.forEach(r => {
            const corners = [
                clampPt(r.left - pad, r.top - pad),
                clampPt(r.right + pad, r.top - pad),
                clampPt(r.left - pad, r.bottom + pad),
                clampPt(r.right + pad, r.bottom + pad),
            ];
            corners.forEach(c => { if (!insideAnyRect(c.x, c.y)) nodes.push(c); });
        });
        const goalIdx = nodes.length;
        nodes.push({ x: tx, y: ty });

        const n = nodes.length;
        const adj = Array.from({ length: n }, () => []);
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = nodes[i], b = nodes[j];
                if (this._lineClear(a.x, a.y, b.x, b.y, rects)) {
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    adj[i].push([j, d]);
                    adj[j].push([i, d]);
                }
            }
        }

        // Dijkstra (grafo pequeno — poucas dezenas de nós — então busca
        // linear pelo menor "dist" a cada passo é simples e rápida o bastante).
        const dist = new Array(n).fill(Infinity);
        const prev = new Array(n).fill(-1);
        const visited = new Array(n).fill(false);
        dist[0] = 0;
        for (let iter = 0; iter < n; iter++) {
            let u = -1, best = Infinity;
            for (let i = 0; i < n; i++) if (!visited[i] && dist[i] < best) { best = dist[i]; u = i; }
            if (u === -1 || u === goalIdx) break;
            visited[u] = true;
            for (const [v, wgt] of adj[u]) {
                if (dist[u] + wgt < dist[v]) { dist[v] = dist[u] + wgt; prev[v] = u; }
            }
        }

        // Em pontos bem apertados entre dois prédios vizinhos pode não sobrar
        // nenhuma quina de folga livre — nesse caso, em vez de desistir e
        // mandar o jogador andar reto de novo (recriando o "preso na parede"
        // original), ele anda até o ponto alcançável mais próximo do destino
        // real. Sempre chega o mais perto possível, nunca fica parado.
        let targetIdx = goalIdx;
        if (dist[goalIdx] === Infinity) {
            let bestIdx = -1, bestDist = Infinity;
            // i=0 (o próprio ponto de partida) não conta — "chegar" ali de
            // volta não é progresso nenhum.
            for (let i = 1; i < n; i++) {
                if (i === goalIdx || dist[i] === Infinity) continue;
                const d = Math.hypot(nodes[i].x - tx, nodes[i].y - ty);
                if (d < bestDist) { bestDist = d; bestIdx = i; }
            }
            if (bestIdx === -1) return [{ x: tx, y: ty }]; // nem uma quina vizinha alcançável; tenta direto
            targetIdx = bestIdx;
        }

        const path = [];
        let cur = targetIdx;
        while (cur !== -1) { path.unshift(nodes[cur]); cur = prev[cur]; }
        path.shift(); // remove o próprio ponto de partida
        return path.length > 0 ? path : [{ x: tx, y: ty }];
    }

    // Define o destino final do jogador, calculando o trajeto (com desvios,
    // se preciso) e guardando os waypoints restantes na fila.
    _setPlayerDestination(x, y) {
        const path = this._findPath(this.player.x, this.player.y, x, y);
        this.player.pathQueue = path.slice(1);
        const first = path[0];
        this.player.targetX = first.x;
        this.player.targetY = first.y;
    }

    _updateProximity() {
        let nearest = null, nearestDist = this._interactRadius;
        for (const b of this.buildings) {
            const d = this._distanceTo(this._doorPoint(b));
            if (d < nearestDist) { nearest = b; nearestDist = d; }
        }
        this._nearBuilding = nearest;
        if (this._interactPromptEl) {
            if (nearest) {
                this._interactPromptEl.innerText = `${nearest.icon} Entrar em ${nearest.name}`;
                this._interactPromptEl.classList.add('visible');
                this._interactPromptEl.onclick = () => this.interact(nearest.id);
            } else {
                this._interactPromptEl.classList.remove('visible');
            }
        }
    }

    _updateAmbientEffects(dt) {
        if (!window.GFX) return;
        // Fumaça subindo da forja do Ferreiro
        this._smokeTimer -= dt;
        if (this._smokeTimer <= 0) {
            this._smokeTimer = Utils.randomFloat(0.4, 0.9);
            const blacksmith = this.buildings.find(b => b.id === 'blacksmith');
            if (blacksmith && window.GFX.qualityLevel !== 'baixa') {
                const r = this._buildingRect(blacksmith);
                const smokeX = r.right - r.w * 0.2;
                const smokeY = r.top - 10;
                window.GFX.spawnParticles(smokeX, smokeY, 'rgba(120,120,120,0.35)', 1, 0.6, 5);
            }
        }
        // Som ambiente: martelo/multidão/água ocasionais, além do drone contínuo
        this._ambientSoundTimer -= dt;
        if (this._ambientSoundTimer <= 0 && window.AudioManager) {
            this._ambientSoundTimer = Utils.randomFloat(3, 7);
            window.AudioManager.playCityAmbientOneshot();
        }

        // Fagulhas de luz subindo de cada Pedra ainda não coletada (ver
        // _drawLightStone) — reforça o "brilho" mesmo parado, do mesmo jeito
        // que a fumaça da forja acima já anima o Ferreiro em repouso.
        if (this.lightStones.length > 0) {
            this._lightStoneSparkleTimer -= dt;
            if (this._lightStoneSparkleTimer <= 0 && window.GFX.qualityLevel !== 'baixa') {
                this._lightStoneSparkleTimer = Utils.randomFloat(0.5, 1.1);
                for (const stone of this.lightStones) {
                    if (stone.collected) continue;
                    const pos = this._lightStonePos(stone);
                    window.GFX.spawnParticles(pos.x, pos.y - 6, '#fff2b8', 1, 0.5, 2);
                }
            }
        }
    }

    // Clima da praça: alterna entre 'clear' e 'rain' em ciclos temporizados
    // independentes do dia/noite. Enquanto chove, pinga chuva (ver
    // GraphicsEngine.spawnRainDrop) espalhada pelo topo da tela.
    _updateWeather(dt) {
        this._weatherTimer -= dt;
        if (this._weatherTimer <= 0) {
            // Modificadores climáticos por Cidade-Hub (ver citydatabase.js
            // `weather.rainChance/stormChance`) — o Santuário Élfico chove
            // muito mais que Porto Helênico, a Fortaleza Orc é mais seca mas
            // com tempestades mais violentas quando chove. Sem cidade
            // definida (ou campo ausente), cai nos valores originais fixos
            // (35%/30%), preservando o comportamento de antes do sistema de
            // cidades existir.
            const cityWeather = (window.getCurrentCityDef ? window.getCurrentCityDef() : null);
            const rainChance = (cityWeather && cityWeather.weather && typeof cityWeather.weather.rainChance === 'number') ? cityWeather.weather.rainChance : 35;
            const stormChance = (cityWeather && cityWeather.weather && typeof cityWeather.weather.stormChance === 'number') ? cityWeather.weather.stormChance : 30;
            if (this.weather === 'clear') {
                this.weather = Utils.chance(rainChance) ? 'rain' : 'clear';
                this._weatherTimer = this.weather === 'rain' ? Utils.randomFloat(30, 55) : Utils.randomFloat(45, 90);
                if (this.weather === 'rain') {
                    // Tempestade: variante rara e mais intensa da chuva, com
                    // raios e trovão — chance própria por cidade (ver acima).
                    this.isStorm = Utils.chance(stormChance);
                    this._lightningTimer = Utils.randomFloat(6, 14);
                    this._toast(this.isStorm ? 'O céu escurece de vez — uma tempestade se aproxima!' : 'Nuvens escuras cobrem a praça — começa a chover.', 'info');
                }
            } else {
                this.weather = 'clear';
                this.isStorm = false;
                this._weatherTimer = Utils.randomFloat(45, 90);
                this._toast('A chuva passa e o sol volta a espiar entre as nuvens.', 'info');
            }
        }

        if (this.weather === 'rain' && window.GFX) {
            this._rainSpawnTimer -= dt;
            if (this._rainSpawnTimer <= 0) {
                this._rainSpawnTimer = 0.02;
                const w = window.Engine.width;
                window.GFX.spawnRainDrop(Utils.randomFloat(0, w), -10);
            }
        }

        if (this.weather === 'rain' && this.isStorm) {
            this._lightningTimer -= dt;
            if (this._lightningTimer <= 0) {
                this._lightningTimer = Utils.randomFloat(8, 20);
                if (window.GFX) window.GFX.triggerLightningFlash();
                if (window.AudioManager) window.AudioManager.playThunder();
            }
        }
    }

    // --- Eventos aleatórios da cidade ---
    // Cada evento é só um toast (window.MainMenu.showToast) mais, em alguns
    // casos, um efeito mecânico simples que já existe no jogo (ouro, exp,
    // uma batalha via UI.startBattle) — sem inventar sistemas novos de
    // diálogo/missão só pra isso.
    _updateRandomEvents(dt) {
        this._eventTimer -= dt;
        if (this._eventTimer > 0) return;
        this._eventTimer = Utils.randomFloat(50, 100);

        const p = window.Engine.state.player;
        const table = [
            { w: 3, run: () => this._eventRareMerchant(p) },
            { w: 2, run: () => this._eventThief(p) },
            { w: 2, run: () => this._eventDuelist(p) },
            { w: 2, run: () => this._eventMessenger(p) },
            { w: 2, run: () => this._eventNoble() },
            { w: 2, run: () => this._eventPromotion() },
            { w: 2, run: () => this._eventPerformer() },
            { w: 2, run: () => this._eventCrier() },
            // Item #7 do novo pedido de auditoria ("eventos aleatórios
            // durante viagens/caminhada"): a lista pedida (viajante
            // perdido, mercador ambulante, ladrões, caçadores, sacerdote,
            // vampiro, patrulha, animais) já cobria mercador/ladrões/
            // vampiro através dos eventos acima/abaixo — faltavam viajante
            // perdido, caçadores, sacerdote, patrulha e animais.
            { w: 2, run: () => this._eventLostTraveler(p) },
            { w: 2, run: () => this._eventHunters() },
            { w: 2, run: () => this._eventPriestBlessing(p) },
            { w: 2, run: () => this._eventPatrol() },
            { w: 2, run: () => this._eventWildAnimal(p) },
            // Rumores sobre as Linhagens (Mutações) — pistas veladas, nunca
            // explica o mecanismo diretamente (ver rituals.js/lineages.js).
            // Só aparece pra quem ainda não despertou nenhuma linhagem.
            { w: (p && !p.lineage) ? 3 : 0, run: () => this._eventLineageRumor(p) }
        ];
        if (p && p.wins > 0) table.push({ w: 3, run: () => this._eventVictoryComment(p) });

        // Vampiros só saem à noite (Ritual do Vampirismo, ver rituals.js) —
        // peso relevante só quando window.GFX.arenaTime === 'night'. Nunca
        // sorteia um SEGUNDO encontro forçado enquanto um já está a
        // caminho (ver _nightEncounterPending/_updateNightAmbush).
        if (p && !p.lineage && !this._nightEncounterPending && window.GFX && window.GFX.arenaTime === 'night') {
            table.push({ w: 4, run: () => this._eventVampireEncounter(p) });
        }

        // Perigo noturno geral: andar pela cidade à noite é arriscado pra
        // QUALQUER jogador, com ou sem Linhagem despertada (diferente do
        // encontro com Vampiro acima, que é só sobre o Ritual). As ruas já
        // ficam visualmente vazias à noite (ver draw()/_updateNpcs) — isso
        // dá uma razão mecânica real pra essa sensação de perigo.
        if (p && window.GFX && window.GFX.arenaTime === 'night') {
            table.push({ w: 3, run: () => this._eventNightMugging(p) });
            if (!this._nightEncounterPending) table.push({ w: 3, run: () => this._eventNightMonsterAttack(p) });
        }

        // Fragmentos Sagrados (Ritual da Luz): item 13 da auditoria de
        // balanceamento — antes um evento aleatório aqui mesmo
        // (_eventSacredFragment, removido) entregava o fragmento
        // instantaneamente via toast, sem NENHUMA presença física no mundo.
        // Agora são Pedras de Luz físicas, visíveis e clicáveis, espalhadas
        // em posições fixas pela praça sempre que o Ritual da Luz ainda não
        // foi concluído (ver _spawnLightStonesIfNeeded/_collectLightStone) —
        // não fazem mais parte deste sorteio de eventos.

        const totalW = table.reduce((s, e) => s + e.w, 0);
        if (totalW <= 0) return;
        let roll = Utils.randomFloat(0, totalW);
        for (const entry of table) {
            if (roll < entry.w) { entry.run(); return; }
            roll -= entry.w;
        }
    }

    // Encontro com um Vampiro — só à noite, só enquanto o jogador ainda não
    // despertou nenhuma Linhagem. Ganha uma batalha comum (Vampire estende
    // Entity com IA normal, ver enemy.js) que dropa Essência Vampírica com
    // chance pequena ao ser derrotado.
    _eventVampireEncounter(p) {
        this._nightEncounterPending = true;
        this._toast('Uma figura pálida observa você das sombras antes de atacar...', 'error');
        setTimeout(() => {
            this._nightEncounterPending = false;
            if (this._isActive() && window.UI && window.UI.startBattle) {
                const arenaMenu = document.getElementById('city-arena-menu');
                if (arenaMenu) arenaMenu.classList.add('hidden');
                const vampire = new Vampire(p.level);
                window.UI.beginBattleWith(vampire);
            }
        }, 1800);
    }

    // Assalto noturno: mais grave que o furto diurno (_eventThief) — as ruas
    // vazias à noite não têm testemunhas. Carisma ainda pode evitar o pior,
    // mas com menos chance que durante o dia.
    _eventNightMugging(p) {
        if (!p || p.gold <= 0) return;
        const loss = Math.min(p.gold, Utils.randomInt(15, 40));
        const cha = p.getTotalStat ? p.getTotalStat('cha') : 5;
        if (Utils.chance(cha)) {
            this._toast('Sombras se aproximam na rua deserta, mas suas palavras firmes as afastam.', 'success');
            if (window.AudioManager) window.AudioManager.playConfirm();
            return;
        }
        p.gold -= loss;
        if (window.AudioManager) window.AudioManager.playError();
        this._toast(`Assaltado na escuridão da rua vazia! Perdeu ${loss}g antes de conseguir fugir.`, 'error');
    }

    // Ataque de monstro noturno: independente do Ritual do Vampirismo (ver
    // _eventVampireEncounter acima) — perigo real de andar pela cidade à
    // noite, com ou sem Linhagem já despertada. Sorteia entre Vampiro e
    // Fantasma (ambos em enemy.js), cada um com sua própria identidade.
    _eventNightMonsterAttack(p) {
        this._nightEncounterPending = true;
        const isVampire = Utils.chance(50);
        this._toast(isVampire
            ? 'Uma figura pálida surge da escuridão, sedenta por sangue...'
            : 'Um vulto etéreo atravessa a rua vazia, gélido e uivante...', 'error');
        setTimeout(() => {
            this._nightEncounterPending = false;
            if (this._isActive() && window.UI && window.UI.beginBattleWith) {
                const arenaMenu = document.getElementById('city-arena-menu');
                if (arenaMenu) arenaMenu.classList.add('hidden');
                const monster = isVampire ? new Vampire(p.level) : new Ghost(p.level);
                window.UI.beginBattleWith(monster);
            }
        }, 1800);
    }

    // Rumores veIados sobre as Linhagens — nunca explicam o mecanismo
    // (essências/rituais/bosses) diretamente, só incentivam a explorar e
    // prestar atenção à noite/aos próprios hábitos de luta.
    _eventLineageRumor(p) {
        const lines = [
            'Um bêbado na taverna jura ter visto "olhos vermelhos brilhando na escuridão perto da arena, só depois que o sol se põe".',
            'Um velho pergaminho fala de guerreiros que "beberam da própria dor até se tornarem outra coisa".',
            'Um sacerdote sussurra: "aqueles que só curam, nunca ferem com magia, e perseveram... um dia serão chamados."',
            'Dizem que um Conde esquecido ainda caça pela noite, esperando por um digno de seu sangue.',
            'Uma criança conta que viu "uma luz descer dos céus" perto de um templo em ruínas, mas ninguém acreditou nela.',
            'Um mercador estrangeiro comenta: "fragmentos sagrados... alguns dizem que ainda estão espalhados por aí, esperando por quem os mereça".'
        ];
        this._toast(lines[Utils.randomInt(0, lines.length - 1)], 'info');
    }

    _toast(msg, type = 'info') {
        if (window.MainMenu) window.MainMenu.showToast(msg, type);
    }

    // Carisma negocia de verdade aqui: cada ponto acima de 5 aumenta o ganho
    // (até +80% com Carisma bem alto) — o mesmo atributo que dá desconto na
    // loja (ver ui.js _shopDiscount) também rende mais nesse tipo de evento.
    // Antes esse evento era só um toast instantâneo de "+ouro" sem nenhuma
    // presença de verdade no mundo — o "mercador raro" nunca existia como
    // algo visível/clicável. Agora ele de fato aparece na praça (ver
    // _makeTravelingMerchant) com uma loja própria enquanto durar; se um já
    // estiver por lá, não sorteia outro em cima, só lembra o jogador.
    _eventRareMerchant(p) {
        if (this.travelingMerchant) {
            this._toast('O mercador viajante ainda está na praça — vá até ele antes que parta!', 'info');
            return;
        }
        const merchant = this._makeTravelingMerchant();
        this.travelingMerchant = merchant;
        this.npcs.push(merchant);
        this._toast('Um mercador viajante chegou à praça com mercadorias raras de terras distantes!', 'success');
        if (window.AudioManager) window.AudioManager.playConfirm();
    }

    // Some sozinho depois de um tempo se ninguém visitar (ver
    // _eventRareMerchant/_makeTravelingMerchant) — mesmo tratamento
    // silencioso-mas-avisado que as outras janelas temporárias do jogo
    // (promoção de loja soma silenciosamente, aqui avisamos porque é uma
    // oportunidade que o jogador pode ter perdido sem querer).
    _updateTravelingMerchant(dt) {
        if (!this.travelingMerchant) return;
        this.travelingMerchant.despawnTimer -= dt;
        if (this.travelingMerchant.despawnTimer <= 0) {
            const idx = this.npcs.indexOf(this.travelingMerchant);
            if (idx >= 0) this.npcs.splice(idx, 1);
            this.travelingMerchant = null;
            this._toast('O mercador viajante partiu da praça rumo à próxima cidade.', 'info');
        }
    }

    // Carisma dá uma chance de convencer o ladrão a devolver parte do
    // roubado (ou desistir por completo, com Carisma muito alto) — sem
    // isso, o evento era puramente punitivo e nenhum atributo o influenciava.
    _eventThief(p) {
        if (!p || p.gold <= 0) { this._eventPerformer(); return; }
        const loss = Math.min(p.gold, Utils.randomInt(5, 20));
        const cha = p.getTotalStat ? p.getTotalStat('cha') : 5;
        if (Utils.chance(cha * 2)) {
            this._toast('Um ladrão tentou roubar sua bolsa, mas suas palavras o convenceram a desistir!', 'success');
            if (window.AudioManager) window.AudioManager.playConfirm();
            return;
        }
        p.gold -= loss;
        if (window.AudioManager) window.AudioManager.playError();
        this._toast(`Um ladrão aproveitou a multidão e roubou ${loss}g da sua bolsa!`, 'error');
    }

    _eventDuelist(p) {
        this._toast('Um duelista te desafiou no meio da praça!', 'info');
        setTimeout(() => {
            if (this._isActive() && window.UI && window.UI.startBattle) {
                // Se o jogador tinha o menu "Entrar na Arena" aberto quando o
                // evento disparou, esconde-o antes de ir pra batalha — do
                // contrário ele fica com a classe "hidden" removida e volta a
                // aparecer por cima da cidade quando a luta terminar (só os 3
                // botões desse menu escondiam ele antes, não startBattle()).
                const arenaMenu = document.getElementById('city-arena-menu');
                if (arenaMenu) arenaMenu.classList.add('hidden');
                window.UI.startBattle();
            }
        }, 1800);
    }

    _eventMessenger(p) {
        const exp = Utils.randomInt(5, 15);
        const levelBefore = p ? p.level : 0;
        if (p && p.gainExp) p.gainExp(exp);
        this._toast(`Um mensageiro trouxe notícias de terras distantes (+${exp} exp).`, 'success');
        // Subir de nível fora de batalha (único jeito hoje: este evento) só
        // tinha o mesmo console.log esquecido em player.js.levelUp() como
        // aviso — o jogador nunca via NADA além do toast genérico de EXP,
        // diferente de subir de nível numa batalha (que já mostra banner +
        // fanfarra, ver ui.js showBattleResults).
        if (p && p.level > levelBefore) {
            // Ponto de Mutação (ver player.js levelUp — bug de auditoria
            // corrigido junto: antes esse ponto nem existia por nível
            // nenhum, só o texto some agora precisa refletir quando ele é
            // concedido) só aparece pra quem já despertou uma Linhagem.
            const mutationPart = p.lineage ? ', +1 Ponto de Mutação' : '';
            this._toast(`Você subiu para o nível ${p.level}! (+3 Atributos, +1 Talento${mutationPart})`, 'success');
            if (window.AudioManager) window.AudioManager.playLevelUp();
        }
    }

    _eventNoble() {
        const lines = [
            'Um nobre observou seus treinos com interesse silencioso...',
            'Um nobre comentou que ouviu falar do seu nome nas tabernas da região.',
            'Um nobre local prometeu "lembrar de você" caso continue vencendo.'
        ];
        this._toast(lines[Utils.randomInt(0, lines.length - 1)], 'info');
    }

    // Bug de auditoria corrigido: este evento anunciava "preços especiais só
    // por hoje" mas nunca aplicava NENHUM desconto real em lugar nenhum — o
    // jogador ia até a loja anunciada e via os mesmos preços de sempre. Só
    // Ferreiro/Armeiro/Taverna têm um preço em ouro de verdade pra descontar
    // (o Mercado Arcano abre a árvore de Talentos comuns, que custa Pontos
    // de Talento, nunca ouro — por isso saiu do sorteio). O desconto real é
    // lido em ui.js `_shopDiscount` (loja) e `updateHealerScreen`/
    // `healFatigue` (Taverna/Curandeiro).
    _eventPromotion() {
        const shops = [
            { name: 'Ferreiro' }, { name: 'Armeiro' }, { name: 'Taverna' }
        ];
        const shop = shops[Utils.randomInt(0, shops.length - 1)];
        const discountPercent = Utils.randomInt(15, 30);
        this.activePromotion = { shopName: shop.name, discountPercent, timer: Utils.randomFloat(90, 160) };
        this._toast(`Promoção no ${shop.name}: -${discountPercent}% em tudo, só por hoje!`, 'info');
    }

    _eventPerformer() {
        const lines = [
            'Um artista de rua se apresenta na praça, arrancando aplausos da multidão.',
            'Um malabarista entretém os transeuntes perto da fonte.',
            'Um músico ambulante toca uma melodia animada na praça.'
        ];
        this._toast(lines[Utils.randomInt(0, lines.length - 1)], 'info');
    }

    _eventCrier() {
        const lines = [
            'Pregoeiro anuncia: um grande torneio se aproxima na Arena!',
            'Pregoeiro anuncia: novos desafiantes chegaram para a Ladder!',
            'Pregoeiro anuncia: a fama de todo campeão é registrada no Hall da Fama!'
        ];
        this._toast(lines[Utils.randomInt(0, lines.length - 1)], 'info');
    }

    // Viajante Perdido (item #7 do novo pedido de auditoria) — ajudar
    // alguém perdido a encontrar o caminho rende uma pequena gratificação,
    // mesmo padrão mecânico de _eventMessenger (efeito simples que já
    // existe: ouro), só com identidade/flavor própria.
    _eventLostTraveler(p) {
        if (!p) return;
        const gift = Utils.randomInt(8, 25);
        p.gold += gift;
        this._toast(`Um viajante perdido pediu ajuda para achar o caminho — agradecido, deixou ${gift}g antes de seguir viagem.`, 'success');
        if (window.AudioManager) window.AudioManager.playConfirm();
    }

    // Caçadores (item #7) — desafiam o jogador a provar sua pontaria/força,
    // mesmo padrão de _eventDuelist (puxa uma batalha de verdade via
    // UI.startBattle), só com identidade própria (caçadores, não duelistas
    // da arena).
    _eventHunters() {
        this._toast('Um bando de caçadores zomba da sua postura e propõe testar sua força de verdade!', 'info');
        setTimeout(() => {
            if (this._isActive() && window.UI && window.UI.startBattle) {
                const arenaMenu = document.getElementById('city-arena-menu');
                if (arenaMenu) arenaMenu.classList.add('hidden');
                window.UI.startBattle();
            }
        }, 1800);
    }

    // Bênção do Sacerdote (item #7) — reduz 1 nível de fadiga de graça, a
    // única forma de cura "de graça" fora do Curandeiro/dormir no chão
    // (ver ui.js healFatigue/freeRest) — mecânica real, não só flavor,
    // condizente com a identidade de um sacerdote abençoando um gladiador.
    _eventPriestBlessing(p) {
        if (!p || (p.fatigue || 0) <= 0) {
            this._toast('Um sacerdote te abençoa em silêncio antes de seguir seu caminho.', 'info');
            return;
        }
        p.cureFatigue(1);
        this._toast('Um sacerdote te abençoa, aliviando um pouco do seu cansaço acumulado.', 'success');
        if (window.AudioManager) window.AudioManager.playHeal();
    }

    // Patrulha da Guarda (item #7) — puramente flavor, mesmo tratamento já
    // aceito por _eventNoble/_eventPerformer/_eventCrier (nem todo evento
    // precisa de efeito mecânico pra ter identidade própria).
    _eventPatrol() {
        const lines = [
            'Uma patrulha da guarda cruza a praça, atenta a qualquer sinal de encrenca.',
            'Guardas trocam cumprimentos formais com você antes de seguir a ronda.',
            'A patrulha da noite passada capturou um ladrão local — a praça respira um pouco mais tranquila.'
        ];
        this._toast(lines[Utils.randomInt(0, lines.length - 1)], 'info');
    }

    // Animal Selvagem (item #7) — um bicho cavando por perto desenterra
    // algo de valor, mesmo padrão mecânico de _eventLostTraveler/
    // _eventMessenger (efeito simples: ouro), com identidade própria.
    _eventWildAnimal(p) {
        if (!p) return;
        if (Utils.chance(50)) {
            const gift = Utils.randomInt(5, 18);
            p.gold += gift;
            this._toast(`Um cão vira-lata desenterra algo brilhante perto da fonte — você encontra ${gift}g no meio da terra.`, 'success');
        } else {
            this._toast('Um bando de pássaros alça voo de repente perto da muralha, sem motivo aparente.', 'info');
        }
    }

    _eventVictoryComment(p) {
        const lines = [
            `"Ouvi dizer que ${p.name} venceu outro duelo!"`,
            `"O nome de ${p.name} anda em todas as tabernas..."`,
            `"Dizem que ${p.name} já soma ${p.wins} vitórias na Arena!"`
        ];
        this._toast(lines[Utils.randomInt(0, lines.length - 1)], 'info');
    }

    // --- Evolução da cidade conforme a fama do jogador ---
    _fameTitle(p) {
        if (!p) return null;
        if (p.wins >= 30) return 'Lenda da Arena';
        if (p.wins >= 15) return 'Grande Campeão';
        if (p.wins >= 5) return 'Campeão em Ascensão';
        return null;
    }

    // --- Desenho ---
    // Chamado por GraphicsEngine.draw() quando state.screen === 'HUB', logo
    // depois de drawArenaBackground() (céu/coliseu/plateia já desenhados).
    draw(ctx, w, h) {
        if (!this._initialized) return;
        const horizon = this._horizon(h);

        this._drawPlazaGround(ctx, w, h, horizon);
        this._drawFountain(ctx, w, h);
        this.statues.forEach(s => this._drawStatue(ctx, w, h, s));
        this.vegetation.forEach(v => this._drawVegetation(ctx, w, h, v));

        // Ordena tudo que fica "no chão" (prédios, NPCs, jogador) por Y, pra
        // quem está mais embaixo na tela ser desenhado por cima (profundidade).
        // NPCs comuns somem à noite — as ruas ficam vazias (e perigosas, ver
        // _onNightFalls/_eventNightDanger), reforçando que sair à noite é
        // uma escolha arriscada, não só estética. O Viajante do Portão fica
        // de fora dessa regra (ver _nightVisibleNpcs) — viajar entre
        // Cidades-Hub é mecânica central, não devia travar toda noite.
        const isNight = window.GFX && window.GFX.arenaTime === 'night';
        const drawables = [
            ...this.buildings.map(b => ({ y: this._doorPoint(b).y, draw: () => this._drawBuilding(ctx, w, h, b) })),
            // Rotina de vida (item #5): um NPC "dentro" de uma loja/taverna
            // nunca é desenhado — ele simplesmente não está na praça agora.
            ...(isNight ? this._nightVisibleNpcs() : this.npcs).filter(n => !n.invisible).map(n => ({ y: n.y, draw: () => this._drawNpc(ctx, n) })),
            // Pedras de Luz (ver _spawnLightStonesIfNeeded/item 13 da
            // auditoria) entram no MESMO ordenamento por profundidade que
            // prédios/NPCs/jogador — diferente de fonte/estátuas/vegetação
            // acima (sempre desenhadas por baixo), uma pedra perto do
            // jogador precisa poder ficar tanto atrás quanto na frente dele
            // dependendo de quem está mais "embaixo" na tela.
            ...this.lightStones.filter(s => !s.collected).map(s => ({ y: this._lightStonePos(s).y, draw: () => this._drawLightStone(ctx, s) })),
            { y: this.player.y, draw: () => this._drawPlayer(ctx) },
        ];
        drawables.sort((a, b) => a.y - b.y);
        drawables.forEach(d => d.draw());
    }

    // Cor do piso lida da Cidade-Hub atual (ver citydatabase.js
    // `groundColors`) — antes fixa em tom de mármore grego pra TODA cidade,
    // então a Fortaleza Orc (descrita como erguida "sobre rocha vulcânica")
    // e o Santuário Élfico (erguido "entre raízes ancestrais") mostravam a
    // mesma praça de mármore de Porto Helênico. Fallback pro mármore
    // original sem cidade carregada/cidade sem o campo (save antigo).
    _drawPlazaGround(ctx, w, h, horizon) {
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const colors = (cityDef && cityDef.groundColors) || ['#8a8070', '#5a5448'];
        const grad = ctx.createLinearGradient(0, horizon, 0, h);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, horizon, w, h - horizon);

        // Juntas de pedra/mármore (grade simples, leve, barata em qualidade baixa)
        if (window.GFX && window.GFX.qualityLevel !== 'baixa') {
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 1;
            const step = 60;
            for (let x = -((performance.now() * 0.0001) % step); x < w; x += step) {
                ctx.beginPath(); ctx.moveTo(x, horizon); ctx.lineTo(x, h); ctx.stroke();
            }
            for (let y = horizon + 30; y < h; y += step * 0.7) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }
        }
    }

    // Cores da fonte lidas da Cidade-Hub atual (ver citydatabase.js
    // `fountainColors`) — mesmo motivo do groundColors/vegetationTypes/
    // statueColor: antes era sempre a MESMA fonte de água azul mediterrânea
    // pra TODA cidade, então a Fortaleza Orc (rocha vulcânica) mostrava a
    // mesma fonte serena de Porto Helênico, e o Santuário Élfico não tinha
    // nada de mágico/natural na própria fonte da praça. Fallback pras cores
    // originais sem cidade carregada/cidade sem o campo (save antigo).
    // Bacia+borda da fonte são 100% estáticas pra um dado raio/cor — só o
    // jato central (anima via performance.now(), ver _drawFountain) e o cano
    // continuam vivos por cima do bake (ver js/spritesystem.js SpriteCache).
    _bakeFountainBasin(r, colors) {
        const pad = 4;
        const w = r * 2 + pad * 2, h = r * 0.9 + pad * 2;
        const anchorX = r + pad, anchorY = r * 0.45 + pad;
        const key = `fountain:${Math.round(r * 100)}:${colors.rim}:${colors.basin}`;
        return {
            canvas: window.SpriteCache.get(key, w, h, (bctx) => {
                bctx.fillStyle = colors.rim;
                bctx.beginPath(); bctx.ellipse(anchorX, anchorY, r, r * 0.45, 0, 0, Math.PI * 2); bctx.fill();
                bctx.fillStyle = colors.basin;
                bctx.beginPath(); bctx.ellipse(anchorX, anchorY, r * 0.78, r * 0.35, 0, 0, Math.PI * 2); bctx.fill();
            }),
            anchorX, anchorY
        };
    }

    _drawFountain(ctx, w, h) {
        const scale = this._cityScale(h);
        const x = this.fountain.xFrac * w, y = this._horizon(h) + this.fountain.rowOffset * scale;
        const r = this.fountain.r * scale;
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const colors = (cityDef && cityDef.fountainColors) || { rim: '#8891a0', basin: '#3a6a8a', jet: 'rgba(200,225,255,0.7)', spout: '#6b7280' };
        const basin = this._bakeFountainBasin(r, colors);
        window.RenderManager.blit(ctx, basin.canvas, x, y, basin.anchorX, basin.anchorY);
        // Jato central (anima com o tempo)
        const t = performance.now() * 0.003;
        ctx.strokeStyle = colors.jet;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.2);
        ctx.lineTo(x, y - r * 0.2 - 22 - Math.sin(t) * 3);
        ctx.stroke();
        ctx.fillStyle = colors.spout;
        ctx.fillRect(x - 4, y - r * 0.2 - 30, 8, 10);
    }

    // Cor da estátua lida da Cidade-Hub atual (ver citydatabase.js
    // `statueColor`) — mesmo motivo do groundColors/vegetationTypes: antes
    // fixa em mármore grego pra TODA cidade, então a Fortaleza Orc e o
    // Santuário Élfico mostravam as MESMAS estátuas de mármore de Porto
    // Helênico. Fallback pro mármore original sem cidade carregada/cidade
    // sem o campo (save antigo).
    // Estátua inteira (pedestal+corpo+cabeça) é 100% estática pra uma dada
    // escala/cor — sem nenhuma animação, então bake completo, sem elemento
    // vivo por cima (ver js/spritesystem.js SpriteCache).
    _bakeStatueSprite(scale, color) {
        const pad = 4;
        const w = 20 * scale + pad * 2, h = 56 * scale + 2 * scale + pad * 2;
        const anchorX = 10 * scale + pad, anchorY = 56 * scale + pad;
        const key = `statue:${Math.round(scale * 100)}:${color}`;
        return {
            canvas: window.SpriteCache.get(key, w, h, (bctx) => {
                bctx.fillStyle = color;
                bctx.fillRect(anchorX - 10 * scale, anchorY - 6 * scale, 20 * scale, 8 * scale); // pedestal
                bctx.fillRect(anchorX - 5 * scale, anchorY - 46 * scale, 10 * scale, 40 * scale); // corpo
                bctx.beginPath(); bctx.arc(anchorX, anchorY - 50 * scale, 6 * scale, 0, Math.PI * 2); bctx.fill(); // cabeça
            }),
            anchorX, anchorY
        };
    }

    _drawStatue(ctx, w, h, s) {
        const scale = this._cityScale(h);
        const x = s.xFrac * w, y = this._horizon(h) + s.rowOffset * scale;
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const color = (cityDef && cityDef.statueColor) || '#c9c2b0';
        const sprite = this._bakeStatueSprite(scale, color);
        window.RenderManager.blit(ctx, sprite.canvas, x, y, sprite.anchorX, sprite.anchorY);
    }

    // Pedra de Luz (item 13 da auditoria de balanceamento) — pulsa um brilho
    // suave (halo radial, mesma técnica já usada pelo flicker das tochas em
    // graphics.js) pra ficar visível de longe na praça mesmo entre os
    // prédios/NPCs; a rocha em si é pequena e simples (não é um monumento,
    // só um achado). Nunca é baked (SpriteCache): o pulso anima a cada
      // frame via performance.now(), então não haveria nada de "estático" pra
    // cachear, ao contrário da fonte/estátuas/vegetação acima.
    _drawLightStone(ctx, stone) {
        const w = window.Engine.width, h = window.Engine.height;
        const pos = this._lightStonePos(stone);
        const scale = this._cityScale(h);
        const t = performance.now() * 0.0025;
        const pulse = 0.65 + Math.sin(t + stone.id * 2.1) * 0.35;
        const r = 9 * scale;

        ctx.save();
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 3.2);
        glow.addColorStop(0, `rgba(255,240,180,${0.5 * pulse})`);
        glow.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 3.2, 0, Math.PI * 2); ctx.fill();

        // Rocha pequena e irregular (silhueta simples, sem bake) sob o brilho.
        ctx.fillStyle = '#5a5448';
        ctx.beginPath();
        ctx.moveTo(pos.x - r * 0.9, pos.y);
        ctx.lineTo(pos.x - r * 0.4, pos.y - r * 0.7);
        ctx.lineTo(pos.x + r * 0.5, pos.y - r * 0.5);
        ctx.lineTo(pos.x + r * 0.9, pos.y);
        ctx.closePath();
        ctx.fill();

        // Núcleo luminoso, o "fragmento" propriamente dito, cravado na rocha.
        ctx.fillStyle = `rgba(255,242,192,${0.75 + pulse * 0.25})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - r * 0.5, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Vegetação orientada a dados (ver this.vegetation + CityDatabase
    // .vegetationTypes) — cada slot ('edge'/'center') resolve um tipo de
    // planta diferente por cidade: Porto Helênico usa cipreste (silhueta
    // alta e afunilada, marco registrado da paisagem mediterrânea) e
    // loureiro (arbusto baixo e arredondado, planta sagrada de Apolo,
    // tradicionalmente associada a vitória/coroas de louro); Fortaleza Orc
    // usa árvore morta (nada sobrevive direito sobre rocha vulcânica) e
    // arbusto em brasa; Santuário Élfico usa arco de raiz ancestral e samambaia
    // luminescente. Antes as 4 plantas eram fixas em cipreste/loureiro pra
    // TODA cidade, então a Fortaleza Orc e o Santuário Élfico mostravam a
    // mesma vegetação mediterrânea de Porto Helênico apesar de suas
    // descrições falarem de rocha vulcânica / raízes ancestrais.
    // Cada planta é 100% estática pra um dado tipo/escala — sem animação
    // própria — então bakeia a silhueta inteira uma vez por combinação e
    // reusa (ver js/spritesystem.js SpriteCache). bbox generoso e único pra
    // todos os tipos (em vez de um por tipo) porque são poucas combinações
    // reais em cache (6 tipos x poucas escalas distintas por resize).
    _bakeVegetationSprite(scale, type) {
        const pad = 4;
        const anchorX = 30 * scale + pad, anchorY = 85 * scale + pad;
        const w = anchorX * 2, h = anchorY + 12 * scale + pad;
        const key = `veg:${type}:${Math.round(scale * 100)}`;
        return {
            canvas: window.SpriteCache.get(key, w, h, (bctx) => this._paintVegetation(bctx, anchorX, anchorY, scale, type)),
            anchorX, anchorY
        };
    }

    _drawVegetation(ctx, w, h, v) {
        const scale = this._cityScale(h) * (v.scale || 1);
        const x = v.xFrac * w, y = this._horizon(h) + v.rowOffset * scale;
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const vegTypes = (cityDef && cityDef.vegetationTypes) || { edge: 'cypress', center: 'laurel' };
        const type = vegTypes[v.slot] || (v.slot === 'edge' ? 'cypress' : 'laurel');
        const sprite = this._bakeVegetationSprite(scale, type);
        window.RenderManager.blit(ctx, sprite.canvas, x, y, sprite.anchorX, sprite.anchorY);
    }

    _paintVegetation(ctx, x, y, scale, type) {
        if (type === 'cypress') {
            ctx.fillStyle = '#4a3a26';
            ctx.fillRect(x - 3 * scale, y - 6 * scale, 6 * scale, 10 * scale); // base do tronco
            ctx.fillStyle = '#2f4a2a';
            ctx.beginPath();
            ctx.moveTo(x, y - 78 * scale);
            ctx.bezierCurveTo(x - 16 * scale, y - 55 * scale, x - 13 * scale, y - 15 * scale, x - 8 * scale, y - 4 * scale);
            ctx.lineTo(x + 8 * scale, y - 4 * scale);
            ctx.bezierCurveTo(x + 13 * scale, y - 15 * scale, x + 16 * scale, y - 55 * scale, x, y - 78 * scale);
            ctx.closePath();
            ctx.fill();
            // Leve realce (luz vindo da esquerda, mesma convenção do resto do jogo)
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.moveTo(x, y - 78 * scale);
            ctx.bezierCurveTo(x - 12 * scale, y - 50 * scale, x - 10 * scale, y - 15 * scale, x - 6 * scale, y - 4 * scale);
            ctx.lineTo(x, y - 4 * scale);
            ctx.closePath();
            ctx.fill();
        } else if (type === 'laurel') {
            ctx.fillStyle = '#5a4530';
            ctx.fillRect(x - 2 * scale, y - 4 * scale, 4 * scale, 6 * scale);
            ctx.fillStyle = '#5a7a4a';
            const puffs = [[-8, -10, 8], [8, -10, 8], [0, -18, 9], [-6, -2, 7], [6, -2, 7]];
            puffs.forEach(([dx, dy, r]) => {
                ctx.beginPath();
                ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
                ctx.fill();
            });
        } else if (type === 'deadTree') {
            // Árvore morta e retorcida (Fortaleza Orc) — tronco e galhos nus
            // de silhueta angular, nada de folha: só rocha vulcânica por perto.
            ctx.strokeStyle = '#2a221c';
            ctx.lineWidth = 4 * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y - 2 * scale);
            ctx.lineTo(x - 2 * scale, y - 48 * scale);
            ctx.stroke();
            const branches = [
                [-2, -48, -16, -66], [-2, -48, 10, -60],
                [-2, -34, -14, -44], [-2, -34, 12, -40],
                [-2, -20, -12, -26]
            ];
            ctx.lineWidth = 2.2 * scale;
            branches.forEach(([sx, sy, ex, ey]) => {
                ctx.beginPath();
                ctx.moveTo(x + sx * scale, y + sy * scale);
                ctx.lineTo(x + ex * scale, y + ey * scale);
                ctx.stroke();
            });
        } else if (type === 'emberBush') {
            // Arbusto em brasa (Fortaleza Orc) — folhagem baixa com brilho
            // avermelhado por dentro, como se ainda guardasse calor vulcânico.
            ctx.fillStyle = '#3a241c';
            ctx.fillRect(x - 2 * scale, y - 3 * scale, 4 * scale, 5 * scale);
            ctx.fillStyle = '#5a3226';
            const puffs = [[-7, -8, 7], [7, -8, 7], [0, -14, 8], [0, -3, 6]];
            puffs.forEach(([dx, dy, r]) => {
                ctx.beginPath();
                ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.fillStyle = 'rgba(230,110,40,0.55)';
            ctx.beginPath();
            ctx.arc(x, y - 9 * scale, 3.5 * scale, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'ancientRoot') {
            // Arco de raiz ancestral (Santuário Élfico) — grossa, musgosa,
            // saindo do chão e voltando a mergulhar nele como um portal natural.
            ctx.strokeStyle = '#4a3a20';
            ctx.lineWidth = 9 * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x - 20 * scale, y - 2 * scale);
            ctx.quadraticCurveTo(x, y - 62 * scale, x + 20 * scale, y - 2 * scale);
            ctx.stroke();
            ctx.fillStyle = 'rgba(110,140,80,0.5)'; // musgo por cima da raiz
            ctx.beginPath();
            ctx.arc(x - 12 * scale, y - 20 * scale, 6 * scale, 0, Math.PI * 2);
            ctx.arc(x + 6 * scale, y - 44 * scale, 5 * scale, 0, Math.PI * 2);
            ctx.arc(x + 15 * scale, y - 12 * scale, 5 * scale, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === 'glowFern') {
            // Samambaia luminescente (Santuário Élfico) — flora mágica da
            // floresta élfica, folhas com brilho esverdeado suave.
            ctx.fillStyle = '#3a4a2a';
            ctx.fillRect(x - 2 * scale, y - 3 * scale, 4 * scale, 5 * scale);
            const fronds = [[-10, -6, -1], [10, -6, 1], [-6, -16, -1], [6, -16, 1], [0, -22, 0]];
            ctx.strokeStyle = '#6a9a5a';
            ctx.lineWidth = 2 * scale;
            fronds.forEach(([ex, ey, dir]) => {
                ctx.beginPath();
                ctx.moveTo(x, y - 2 * scale);
                ctx.quadraticCurveTo(x + dir * 6 * scale, y + (ey * 0.5) * scale, x + ex * scale, y + ey * scale);
                ctx.stroke();
                ctx.fillStyle = 'rgba(140,230,150,0.6)';
                ctx.beginPath();
                ctx.arc(x + ex * scale, y + ey * scale, 3 * scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#6a9a5a';
            });
        }
    }

    // Clareia uma cor hex (#rrggbb) em direção ao branco por `percent`
    // (0-1) — usado pro topo iluminado da fachada dos prédios (ver
    // _drawBuilding). Cada `wall` na lista de prédios já é hex puro, então
    // não precisa de suporte a rgba() aqui (diferente do _hazeTint das
    // montanhas em graphics.js).
    _lightenHex(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const mix = c => Math.min(255, Math.round(c + (255 - c) * percent));
        const r = mix((num >> 16) & 0xff), g = mix((num >> 8) & 0xff), b = mix(num & 0xff);
        return `rgb(${r},${g},${b})`;
    }

    // Prédio procedural greco-romano: base + colunas + telhado triangular +
    // porta + tochas nas laterais. As dimensões já vêm escaladas de
    // _buildingRect (telas baixas encolhem os prédios pra sempre caberem
    // entre o horizonte e o rodapé da praça).
    // Migração p/ pipeline de sprites (ver js/spritesystem.js): a fachada
    // inteira do prédio (sombra, parede em gradiente, colunas, telhado,
    // porta) é 100% estática pra um dado prédio numa dada tela — só
    // recalculada quando o tamanho da janela muda (bw/bh vêm de
    // _buildingRect, que já reage a isso). Bakear evita recriar ~5-8
    // gradientes lineares por prédio a cada um dos 60 quadros por segundo.
    // Tochas (chama animada) e texto (nome, ícone, mural do campeão — que
    // pode mudar a qualquer vitória) continuam desenhados ao vivo por cima.
    _bakeBuildingShell(b, bw, bh) {
        const halfW = bw / 2 + 12;
        const topY = -(bh * 1.3) - 4;
        const botY = 18;
        const w = halfW * 2, h = botY - topY;
        const anchorX = halfW, anchorY = -topY;
        const key = `building:${b.id}|${Math.round(bw)}|${Math.round(bh)}|${b.wall}|${b.roof}`;
        return {
            canvas: window.SpriteCache.get(key, w, h, (bctx) => {
                bctx.translate(anchorX, anchorY);
                const left = -bw / 2, top = -bh;

                // Sombra no chão
                bctx.fillStyle = 'rgba(0,0,0,0.25)';
                bctx.beginPath();
                bctx.ellipse(0, 4, bw * 0.55, 10, 0, 0, Math.PI * 2);
                bctx.fill();

                // Corpo do prédio — gradiente vertical (mais claro no topo,
                // como se pegasse sol; a própria cor da parede na base).
                const wallGrad = bctx.createLinearGradient(0, top, 0, top + bh);
                wallGrad.addColorStop(0, this._lightenHex(b.wall, 0.22));
                wallGrad.addColorStop(1, b.wall);
                bctx.fillStyle = wallGrad;
                bctx.fillRect(left, top, bw, bh);

                // Colunas de mármore — gradiente horizontal por coluna
                // (mais escuro nas bordas, brilho claro no meio).
                const colCount = Math.max(3, Math.floor(bw / 32));
                for (let i = 0; i < colCount; i++) {
                    const cx = left + (bw / (colCount - 1)) * i;
                    const colGrad = bctx.createLinearGradient(cx - 4, 0, cx + 4, 0);
                    colGrad.addColorStop(0, 'rgba(188,180,158,0.9)');
                    colGrad.addColorStop(0.5, 'rgba(248,243,228,0.95)');
                    colGrad.addColorStop(1, 'rgba(188,180,158,0.9)');
                    bctx.fillStyle = colGrad;
                    bctx.fillRect(cx - 4, top + 6, 8, bh - 12);
                }

                // Telhado triangular (pediment) — cume clareado, beirada na
                // cor original de b.roof.
                const roofGrad = bctx.createLinearGradient(0, top - bh * 0.3, 0, top);
                roofGrad.addColorStop(0, this._lightenHex(b.roof, 0.3));
                roofGrad.addColorStop(1, b.roof);
                bctx.fillStyle = roofGrad;
                bctx.beginPath();
                bctx.moveTo(left - 10, top);
                bctx.lineTo(0, top - bh * 0.3);
                bctx.lineTo(left + bw + 10, top);
                bctx.closePath();
                bctx.fill();

                // Porta
                bctx.fillStyle = '#2a1c10';
                const doorW = bw * 0.22, doorH = bh * 0.42;
                bctx.fillRect(-doorW / 2, -doorH, doorW, doorH);
            }),
            anchorX, anchorY
        };
    }

    _drawBuilding(ctx, w, h, b) {
        const rect = this._buildingRect(b);
        const door = this._doorPoint(b);
        const bw = rect.w, bh = rect.h;
        const left = door.x - bw / 2, top = door.y - bh;
        const scale = this._cityScale(h);
        // Em telas estreitas os prédios ficam bem menores; a fonte encolhe
        // junto (com um piso mínimo pra continuar legível) pra não sobrar
        // maior que o próprio prédio e colidir com o nome do vizinho.
        const iconSize = Math.max(11, Math.round(20 * scale));
        const nameSize = Math.max(8, Math.round(12 * scale));

        const shell = this._bakeBuildingShell(b, bw, bh);
        window.RenderManager.blit(ctx, shell.canvas, door.x, door.y, shell.anchorX, shell.anchorY);

        // Tochas nas laterais (reaproveita o desenho já usado na arena, mas
        // bem menores e escaladas — a chama no tamanho da arena, com 16
        // tochas espalhadas pela praça (2 por prédio × 8), poluía a cena;
        // e sem escalar pela tela ela também acabava cobrindo o letreiro em
        // prédios bem encolhidos por telas estreitas).
        if (window.GFX && window.GFX._drawTorch) {
            const tClock = window.GFX._torchClock || 0;
            const torchSizeMul = 0.55;
            ctx.save();
            ctx.translate(left + 6, door.y);
            ctx.scale(scale, scale);
            window.GFX._drawTorch(ctx, 0, 0, tClock, torchSizeMul);
            ctx.restore();
            ctx.save();
            ctx.translate(left + bw - 6, door.y);
            ctx.scale(scale, scale);
            window.GFX._drawTorch(ctx, 0, 0, tClock, torchSizeMul);
            ctx.restore();
        }

        // Ícone/placa identificando o prédio
        ctx.font = `bold ${iconSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(b.icon, door.x, top - bh * 0.32 - 6);
        ctx.font = `bold ${nameSize}px sans-serif`;
        ctx.fillStyle = '#f2d98a';
        ctx.fillText(b.name, door.x, top - 6);

        // Mural do Campeão — placa na fachada da Arena com o nome do
        // jogador (e um título de fama, conforme seu número de vitórias
        // sobe), ou "Nenhum campeão ainda" antes da primeira vitória.
        if (b.id === 'arena') this._drawChampionMural(ctx, door, top, nameSize, scale);
    }

    _drawChampionMural(ctx, door, top, nameSize, scale) {
        const p = window.Engine.state.player;
        const title = this._fameTitle(p);
        const text = p && p.wins > 0
            ? `🏆 Campeão: ${p.name}${title ? ' (' + title + ')' : ''}`
            : '🏆 Nenhum campeão ainda';
        const fontSize = Math.max(9, Math.round(11 * scale));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        const muralY = top - 6 + nameSize + 5;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(door.x - textWidth / 2 - 6, muralY - fontSize, textWidth + 12, fontSize + 5);
        ctx.fillStyle = '#ffe08a';
        ctx.fillText(text, door.x, muralY);
    }

    // Jogador e NPCs usam o mesmo GFX.drawGladiator() da arena, que desenha
    // em tamanho fixo em pixels — por isso escalamos com um save/translate/
    // scale aqui (só na cidade) pra eles encolherem junto com os prédios em
    // telas menores, sem tocar em nenhuma chamada de drawGladiator da arena.
    //
    // Os NPCs (cidadãos) recebem um encolhimento extra além de _cityScale:
    // um gladiador desenhado em tamanho nativo (pés ao topo da cabeça) mede
    // ~160px pra uma raça "humana" (_legLen 58 + _torsoH 62 + _headR*2 40 —
    // Orc/Elfo/Anão escalam esse total pra mais ou pra menos via
    // races.js `bodyScale`, ver item 7 da auditoria de balanceamento),
    // quase 4x a altura da porta de um prédio (~44px num prédio da fileira
    // do meio) — bem maior que um prédio de verdade. NPC_EXTRA_SHRINK
    // aproxima a altura deles da porta; por ser um fator FIXO (não por
    // raça), um Orc continua proporcionalmente mais alto/largo que um
    // Anão na cidade, exatamente como na Arena — só a escala de base muda,
    // nunca a proporção entre raças.
    static get NPC_EXTRA_SHRINK() { return 0.32; }

    // O jogador usava só _cityScale (sem encolhimento extra), o que na
    // prática o deixava mais alto que a própria casa inteira (~160px de
    // personagem contra ~105px de prédio) — um "gigante" andando pela
    // cidade, e não um herói em destaque como pretendido. PLAYER_EXTRA_SHRINK
    // é maior que o dos NPCs (0.32) pra ele continuar visivelmente mais
    // proeminente que os cidadãos comuns, mas pequeno o bastante pra caber
    // na escala real dos prédios ao seu redor.
    static get PLAYER_EXTRA_SHRINK() { return 0.4; }

    // Posição (fração da largura) do vão do portão na muralha da cidade —
    // usado tanto por GraphicsEngine._drawCityWall (desenha a estrutura)
    // quanto por _makeCaravanTraveler (posiciona o NPC exatamente dentro do
    // vão), pra nunca dessincronizar visual e posição de interação.
    static get GATE_XFRAC() { return 0.965; }

    // Falas rápidas de NPCs ambiente ao serem clicados (ver _talkToNpc) —
    // nunca revelam mecanismos de jogo, só reagem à fama (vitórias) do
    // jogador ou soltam uma observação genérica sobre a praça/arena.
    // Orientado a dados: adicionar mais falas é só engordar os arrays.
    static get NPC_DIALOGUE() {
        return {
            generic: [
                'Que os deuses te sorriam hoje, gladiador.',
                'Cuidado por onde anda — dizem que roubaram uma bolsa perto da forja essa semana.',
                'Vi um novo lote de armas no Ferreiro, se estiver com ouro sobrando.',
                'A plateia estava selvagem no último duelo. Você viu?',
                'Não sei como aguentam lutar por diversão. Eu prefiro vender pão.',
                'Já ouviu falar do Coliseu? Dizem que nem os deuses perdem uma luta lá.',
                'Bons ventos hoje. Bom presságio pra quem vai à arena.'
            ],
            famous: [
                'Ora, se não é você! Já ouvi seu nome em mais de uma taverna.',
                'Meus filhos falam de suas vitórias como se fossem lendas antigas.',
                'Um gladiador de verdade! Dá sorte só de cruzar seu caminho.',
                'Vim de longe só pra ver a arena — e olha quem encontro na praça.'
            ],
            legendary: [
                'Por Zeus... é você mesmo? Achei que só existia em histórias.',
                'Vou contar aos meus netos que troquei uma palavra com uma lenda viva.',
                'A cidade inteira fala do seu nome. Você é motivo de orgulho pra essa arena.'
            ],
            // Reação à Linhagem despertada (ver lineages.js/_talkToNpc) — a
            // mutação já muda a aparência de verdade (presas/pele pálida,
            // aura dourada, ver graphics.js), mas nenhum NPC comentava sobre
            // isso, mesmo sendo o tipo de coisa que qualquer um na praça
            // notaria antes mesmo de saber o nome do jogador.
            vampirismo: [
                'Seus olhos... por que brilham desse jeito vermelho? Fico incomodado perto de você.',
                'Dizem que criaturas da noite andam por aí. Você... não é uma delas, é?',
                'Há algo estranho em você — não ofensa, só um frio na espinha.'
            ],
            luz: [
                'Há uma luz em você que não é natural. Os deuses te tocaram?',
                'Sinto um calor estranho perto de você, como se estivesse perto de algo sagrado.',
                'As crianças da cidade já falam de um gladiador que brilha como o sol.'
            ],
            // Comentários sobre a própria cidade (ver Cidades-Hub Regionais,
            // citydatabase.js) — antes nenhum NPC reagia a ONDE estava, só
            // ao jogador; agora quem mora na Fortaleza Orc ou no Santuário
            // Élfico fala como alguém que vive ali de verdade.
            fortaleza_orc: [
                'Rocha vulcânica sob os pés, ferro enferrujado na mão — é assim que se cresce em Gorkhal.',
                'Não é fácil viver aqui, mas quem sobrevive vira forte de verdade, não só no nome.',
                'Já vi forasteiro fraco entrar por aquele portão. Poucos voltam a sair pelo mesmo.',
                'O chão treme de vez em quando, lá pelas fornalhas. Ninguém mais nem repara.',
                'Cicatriz é currículo por aqui — quem não tem nenhuma ainda não provou nada.',
                'Bebemos o que dá pra beber e lutamos pelo que sobra. É assim desde sempre.',
                'Um chefe de guerra fraco não dura uma estação. Os nossos duram porque sangram junto com a tropa.'
            ],
            santuario_elfico: [
                'A chuva quase nunca para por aqui — a floresta bebe antes de nós, e não reclamamos.',
                'Nascemos entre raízes que já eram velhas antes dos nossos avós nascerem.',
                'Sylvaneth guarda seus segredos bem — poucos forasteiros veem além da fronteira da mata.',
                'O silêncio da mata à noite não é vazio — é só um jeito de ouvir mais longe.',
                'Vivemos tanto que aprendemos a não ter pressa com nada, nem com a guerra.',
                'Dizem que forasteiros acham nosso povo frio. Só somos pacientes com o que importa.',
                'A chuva lava as pegadas de quem não deveria ter passado por aqui.'
            ],
            // Rumores (item #6 do novo pedido de auditoria — "conversar com
            // NPCs pode revelar segredos do mundo"): nunca explica NENHUM
            // mecanismo diretamente (mesma filosofia de _eventLineageRumor,
            // que já fazia isso só pra Linhagens) — cada linha aponta pra um
            // sistema que já existe de verdade no jogo (Pedras de Luz, ver
            // item 13; bosses de Ritual, ver rituals.js/bossai.js; Mercador
            // Viajante, ver _makeTravelingMerchant; Quadro de Missões, ver
            // quests.js; ligas contínuas/arenas regionais, ver enemy.js
            // RivalDatabase), incentivando explorar em vez de entregar de
            // bandeja.
            rumors: [
                'Um velho jura ter visto pedras brilhando sozinhas entre as pedras da praça, à luz do dia — somem antes que alguém chegue perto.',
                'Dizem que algo poderoso se esconde além do que os olhos veem por aqui — só quem prova o suficiente de si mesmo chega perto o bastante pra descobrir o quê.',
                'De vez em quando um mercador de terras distantes aparece na praça sem aviso — quem não estiver por perto na hora certa perde a chance.',
                'Vi um quadro cheio de pedidos afixado perto do Banco — dizem que quem ajuda sempre sai ganhando mais do que esperava.',
                'Guerreiros de povos distantes têm suas próprias arenas e adversários, ouvi dizer — só quem viaja bastante chega a enfrentá-los de verdade.'
            ]
        };
    }

    // Profissões dos NPCs ambiente (ver _makeNpc/_talkToNpc) — cada uma com
    // falas próprias, usadas enquanto o jogador ainda não tem fama (wins <
    // 10, ver NPC_DIALOGUE.famous/legendary acima, que continuam universais
    // porque são sobre a fama do JOGADOR, não sobre quem fala).
    static get NPC_PROFESSIONS() {
        return {
            mercador: { name: 'Mercador', lines: [
                'Especiarias do Oriente, tecidos finos... tudo pelo melhor preço da praça!',
                'Já fechei negócio com metade dos gladiadores que passam por aqui.',
                'Compro e vendo de tudo — só não aceito moeda de outra cidade.'
            ] },
            sacerdote: { name: 'Sacerdote', lines: [
                'Que os deuses guiem sua lâmina e perdoem seus excessos, gladiador.',
                'Fiz uma oferenda esta manhã. Os presságios para a arena são... incertos.',
                'O templo sempre tem as portas abertas, mesmo para quem vive pela espada.'
            ] },
            soldado: { name: 'Soldado', lines: [
                'Se fosse mais jovem, estaria na arena com você. Ou contra você.',
                'Guarda a postura. Vi muitos morrerem por baixar a guarda cedo demais.',
                'A cidade dorme tranquila enquanto homens como nós ficam de vigia.'
            ] },
            artesao: { name: 'Artesão', lines: [
                'Cada peça que sai da minha oficina carrega meu nome — e meu orgulho.',
                'Se seu equipamento está gasto, conheço quem possa consertar direito.',
                'Passei a manhã inteira polindo bronze. As mãos já nem sentem mais.'
            ] },
            campones: { name: 'Camponês', lines: [
                'Vim vender o que sobrou da colheita antes que estrague no calor.',
                'A cidade grande me assusta um pouco, mas a arena... isso é outro mundo.',
                'Prefiro a terra e o gado a essa multidão toda gritando por sangue.'
            ] },
            poeta: { name: 'Poeta', lines: [
                'Estou compondo versos sobre os duelos da arena. Você seria um bom tema.',
                'A glória é passageira, mas um bom poema... esse pode ser eterno.',
                'Ouça bem: a plateia esquece o vencedor de ontem mais rápido do que imagina.'
            ] },
            // Veterano da Arena — a única profissão que fala especificamente
            // sobre a Ladder/Rivais (ver enemy.js RivalDatabase), dando à
            // praça alguém que reage ao MUNDO do jogo, não só observações
            // genéricas de ofício.
            veterano: { name: 'Veterano da Arena', lines: [
                'Já vi campeões subirem e caírem. A Ladder não perdoa quem hesita.',
                'Enfrentei um dos campeões faz anos. Ainda sinto a cicatriz quando chove.',
                'Todo gladiador novo acha que vai chegar ao topo rápido. Poucos chegam.'
            ] },
            // Banqueiro — a única profissão que comenta sobre o Banco (ver
            // ui.js openBank/_applyBankInterest), reagindo a outro sistema
            // real do mundo em vez de só flavor genérico de ofício.
            banqueiro: { name: 'Banqueiro', lines: [
                'Guarde seu ouro conosco — o que não é gasto hoje, rende amanhã.',
                'Muitos gladiadores gastam tudo antes do pôr do sol. Os sábios guardam.',
                'Nossos cofres são mais seguros que qualquer bolso na rua à noite.'
            ] }
        };
    }

    // Falas de profissão por Cidade-Hub (ver NPC_PROFESSIONS acima e
    // NPC_DIALOGUE.fortaleza_orc/santuario_elfico) — o comentário sobre a
    // CIDADE em si já tinha versão regional (35% de chance, ver
    // _talkToNpc), mas a fala de PROFISSÃO — a que domina a maior parte das
    // conversas antes do jogador ganhar fama — continuava 100% grega
    // (deuses, bronze, templo, Coliseu) mesmo com o jogador andando pela
    // Fortaleza Orc ou pelo Santuário Élfico. Mesmas 8 profissões de
    // NPC_PROFESSIONS, mesmo `name` de exibição, só o conteúdo muda; cidades
    // sem entrada aqui (Porto Helênico, saves antigos, cidade desconhecida)
    // caem no pool genérico normalmente via _talkToNpc.
    static get NPC_PROFESSIONS_REGIONAL() {
        return {
            fortaleza_orc: {
                mercador: ['Ferro, couro cru, pedra vulcânica polida — só não me traga papo de forasteiro fraco.',
                    'Aqui não se regateia — o preço é o preço, e quem reclama demais leva menos na próxima.',
                    'Trago sal e carne curada da última caravana. O resto essa terra dá conta sozinha.'],
                sacerdote: ['Os espíritos da fornalha só respeitam quem já sangrou por Gorkhal.',
                    'Queimei osso e gordura essa manhã. As chamas disseram que a arena vai ser violenta hoje.',
                    'Não rezamos por paz aqui — rezamos por força pra aguentar o que vem.'],
                soldado: ['Se a muralha cair, cai comigo em cima dela. Não conheço outro jeito de guardar um portão.',
                    'Treinei com machado antes de aprender a andar direito. Aqui é assim com todo mundo.',
                    'Forasteiro fraco que passa por aquele portão vira história rápido. Vi acontecer mais de uma vez.'],
                artesao: ['Forjo sobre rocha ainda morna da última erupção — dizem que dá um fio melhor no aço.',
                    'Não faço nada bonito. Faço o que aguenta um machado de guerra sem lascar.',
                    'Minhas mãos já não sentem o calor da forja. Depois de anos, isso vira parte de você.'],
                campones: ['A terra aqui é dura e cinzenta, mas o que cresce nela cresce forte, que nem nós.',
                    'Perdi metade da plantação pra fumaça da montanha esse ano. Já é o de sempre.',
                    'Prefiro cavar pedra a ir pra arena, mas ninguém em Gorkhal escapa de escolher um lado.'],
                poeta: ['Aqui ninguém quer verso bonito — quer história de cicatriz e de sangue derramado.',
                    'Canto sobre chefes de guerra que morreram de pé. É o único tipo de fim que respeitamos.',
                    'Um poema fraco aqui vira piada rápido. Aprendi a escrever mais grosso.'],
                veterano: ['Enfrentei um campeão orc antes de você nascer. A cicatriz ainda dói quando a montanha treme.',
                    'Ladder nenhuma assusta quem já sobreviveu a um inverno inteiro em Gorkhal.',
                    'Todo jovem forte quer provar valor rápido. Os que duram são os que aprendem a esperar.'],
                banqueiro: ['Ouro não segura golpe de machado, mas ajuda a comprar um melhor.',
                    'Guardamos metal em cofre de pedra vulcânica — nem fogo nem ladrão passam fácil por ali.',
                    'Aqui quem gasta rápido demais vira motivo de piada na próxima fogueira.']
            },
            santuario_elfico: {
                mercador: ['Seiva de árvore-mãe, fios de teia élfica, ervas que só crescem sob a chuva daqui.',
                    'Não apresso negócio — as coisas boas de Sylvaneth levam tempo pra amadurecer.',
                    'Troco raramente com forasteiros, mas reconheço quem trata a floresta com respeito.'],
                sacerdote: ['As raízes ancestrais ouvem mais do que falam. Aprenda a fazer o mesmo.',
                    'Fizemos oferenda à árvore-mãe esta manhã, sob a chuva de sempre.',
                    'Não pedimos favor aos espíritos da mata — só pedimos que continuem a nos tolerar.'],
                soldado: ['Guardamos a fronteira sem fazer barulho. A floresta já faz barulho o bastante.',
                    'Um arco élfico bem cuidado dura mais que o soldado que o carrega.',
                    'Vigiamos de cima, entre os galhos. Forasteiro nenhum atravessa sem que a gente saiba.'],
                artesao: ['Cada arco que faço leva uma estação inteira — não apresso o que precisa de tempo.',
                    'Trabalho a madeira que a própria floresta oferece, nunca a que eu derrubo.',
                    'Meus mestres viveram séculos aperfeiçoando isso. Ainda tenho muito o que aprender.'],
                campones: ['Colhemos o que a mata nos empresta, nunca mais que isso.',
                    'A chuva atrasa a colheita, mas também é ela que faz tudo crescer tão bem aqui.',
                    'Vivemos devagar, do jeito da floresta. Forasteiro acha isso estranho no começo.'],
                poeta: ['Nossos versos levam gerações pra serem terminados. Um humano acharia isso loucura.',
                    'Componho sobre o silêncio da mata à noite — é mais eloquente que qualquer palavra.',
                    'A pressa da arena não combina com a paciência que aprendemos entre as raízes.'],
                veterano: ['Vivi o bastante pra ver três chefes de guerra orc caírem. Nenhum durou o que dura uma árvore.',
                    'Não corro pra Ladder nenhuma. Quem tem séculos pela frente aprende a não ter pressa.',
                    'Enfrentei perigos antes de qualquer campeão nascer. A paciência venceu onde a força falharia.'],
                banqueiro: ['Guardamos riqueza como guardamos sementes — pouca pressa, muita paciência.',
                    'O ouro forasteiro nos interessa menos que um bom acordo de longo prazo.',
                    'Aqui ninguém enriquece da noite pro dia. Nem a floresta cresce assim.']
            }
        };
    }

    _drawNpc(ctx, npc) {
        if (window.GFX && window.GFX.drawGladiator) {
            const scale = this._cityScale(window.Engine.height) * CityEngine.NPC_EXTRA_SHRINK;
            ctx.save();
            ctx.translate(npc.x, npc.y);
            ctx.scale(scale, scale);
            window.GFX.drawGladiator(ctx, 0, 0, npc.entity, npc.facing > 0, npc.anim, null);
            ctx.restore();
        }
    }

    _drawPlayer(ctx) {
        const p = window.Engine.state.player;
        if (!p || !window.GFX) return;
        const anim = this._playerAnim || (this._playerAnim = { type: 'idle', start: performance.now(), duration: 0 });
        anim.type = this.player.moving ? 'walk' : 'idle';
        const scale = this._cityScale(window.Engine.height) * CityEngine.PLAYER_EXTRA_SHRINK;
        ctx.save();
        ctx.translate(this.player.x, this.player.y);
        ctx.scale(scale, scale);
        window.GFX.drawGladiator(ctx, 0, 0, p, this.player.facing > 0, anim, null);
        ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.City = new CityEngine();
});
