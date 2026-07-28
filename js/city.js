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

        // Eventos aleatórios enquanto explora a cidade (mercadores, ladrões,
        // duelistas, mensageiros, nobres, promoções, artistas, pregoeiros) —
        // um temporizador simples, sem fila/histórico: só um toast (e, no
        // caso do duelista, uma batalha de verdade) de vez em quando.
        this._eventTimer = Utils.randomFloat(35, 60);

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
        ];

        // Decorações puramente visuais (sem colisão, exceto a fonte central).
        this.fountain = { xFrac: 0.5, rowOffset: 130, r: 34 };
        this.statues = [
            { xFrac: 0.38, rowOffset: 125 },
            { xFrac: 0.62, rowOffset: 125 },
        ];
        // Vegetação (ver _drawVegetation) — a praça nunca teve NENHUMA planta
        // até agora (só fonte + estátuas), apesar de "vegetação" ser parte
        // explícita da identidade de Mundo greco-romana. Ciprestes nas bordas
        // (silhueta clássica mediterrânea) enquadram a cena sem competir com
        // nenhum prédio; loureiros pequenos ladeiam a fonte central.
        this.vegetation = [
            { type: 'cypress', xFrac: 0.025, rowOffset: 55, scale: 1.2 },
            { type: 'cypress', xFrac: 0.975, rowOffset: 55, scale: 1.2 },
            { type: 'laurel', xFrac: 0.44, rowOffset: 148 },
            { type: 'laurel', xFrac: 0.56, rowOffset: 148 },
        ];

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
        }
        this._spawnNpcsIfNeeded();
        if (window.AudioManager) window.AudioManager.startCityAmbience();
        this._interactPromptEl = document.getElementById('city-interact-prompt');
        this._hintEl = document.getElementById('city-hint');
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
    }

    _makeNpc(pin = null) {
        const w = window.Engine.width, h = window.Engine.height;
        const skinTones = ['#ffcc99', '#e0a878', '#a86b3f', '#7a4a2a'];
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
                    skinTone: skinTones[Utils.randomInt(0, skinTones.length - 1)],
                    hairStyle: Utils.randomInt(1, 15),
                    hairColor: hairColors[Utils.randomInt(0, hairColors.length - 1)],
                    beardStyle: 0, eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {},
                __teamColor: tunicColors[Utils.randomInt(0, tunicColors.length - 1)]
            },
            anim: { type: 'idle', start: performance.now(), duration: 0 }
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

    _updateNpcs(dt, list = this.npcs, speed = 45) {
        const h = window.Engine.height;
        for (const npc of list) {
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

    // --- Entrada (clique/toque + teclado) ---

    _setupInput() {
        const screenEl = document.getElementById('screen-hub');
        screenEl.addEventListener('click', (e) => {
            if (!this._isActive()) return;
            if (e.target.closest('button')) return; // não interfere com ☰/🎒/prompt
            this._handleClick(e.clientX, e.clientY);
        });
        // Toque dedicado (evita atraso de "ghost click" em alguns navegadores móveis)
        screenEl.addEventListener('touchend', (e) => {
            if (!this._isActive()) return;
            if (e.target.closest('button')) return;
            if (e.changedTouches && e.changedTouches[0]) {
                const t = e.changedTouches[0];
                this._handleClick(t.clientX, t.clientY);
            }
        }, { passive: true });

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

        // Clicar num NPC puxa uma fala rápida (ver _talkToNpc) — antes os
        // NPCs eram puramente decorativos, sem NENHUMA reação a clique,
        // então clicar neles só fazia o jogador andar até lá em silêncio.
        const npc = this._npcAtPoint(x, y);
        if (npc) {
            this._talkToNpc(npc);
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

    // NPC mais próximo do clique, dentro de um raio pequeno (não deveria
    // "roubar" cliques destinados a andar pelo chão logo ao lado dele).
    _npcAtPoint(x, y) {
        const radius = 34 * this._cityScale(window.Engine.height);
        let closest = null, closestDist = radius;
        const isNight = window.GFX && window.GFX.arenaTime === 'night';
        const pool = isNight ? this.nightWanderers : this.npcs;
        for (const npc of pool) {
            const d = Math.hypot(npc.x - x, npc.y - y);
            if (d <= closestDist) { closest = npc; closestDist = d; }
        }
        return closest;
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
        const wins = p ? (p.wins || 0) : 0;
        let pool = CityEngine.NPC_DIALOGUE.generic;
        let speaker = null; // prefixo "Profissão: " no toast — só faz sentido pro pool de profissão
        // Linhagem despertada (ver lineages.js) muda a APARÊNCIA de verdade
        // (presas/pele pálida do Vampirismo, aura dourada da Luz — ver
        // graphics.js _drawFangs/_drawLineageAura), mas nenhum NPC jamais
        // comentava sobre isso: reputação (wins) e mutação visível ficavam
        // sem nenhuma diferença nas falas, mesmo a mutação sendo o que
        // qualquer um cruzando a praça literalmente VERIA primeiro.
        if (p && p.lineage && CityEngine.NPC_DIALOGUE[p.lineage]) {
            pool = CityEngine.NPC_DIALOGUE[p.lineage];
        } else if (wins >= 25) pool = CityEngine.NPC_DIALOGUE.legendary;
        else if (wins >= 10) pool = CityEngine.NPC_DIALOGUE.famous;
        // Sem fama ainda: cada NPC fala como a profissão que É, não como um
        // figurante genérico (ver NPC_PROFESSIONS/_makeNpc). NPCs mais
        // antigos que por algum motivo não tenham `profession` (não deveria
        // acontecer, mas evita quebrar) caem de volta no pool genérico.
        else if (npc.profession && CityEngine.NPC_PROFESSIONS[npc.profession]) {
            pool = CityEngine.NPC_PROFESSIONS[npc.profession].lines;
            speaker = CityEngine.NPC_PROFESSIONS[npc.profession].name;
        }

        const line = pool[Utils.randomInt(0, pool.length - 1)];
        // A profissão (ver NPC_PROFESSIONS, iteração 15) nunca aparecia na
        // fala em si — o jogador só descobriria que falou com um "Mercador"
        // lendo o código-fonte. Prefixar com quem está falando fecha essa
        // lacuna sem exigir nenhum sistema de nome próprio por NPC.
        this._toast(speaker ? `${speaker}: ${line}` : line, 'info');
        if (window.AudioManager) window.AudioManager.playConfirm();
        // Vira de frente pro jogador por um instante — pequeno detalhe de
        // vida, sem precisar de nenhum estado de animação novo.
        npc.facing = (npc.x > this.player.x) ? -1 : 1;
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
            default: break;
        }
    }

    // --- Atualização por frame ---
    update(dt) {
        if (!this._isActive() || !this._initialized) return;

        this._updateDayCycle(dt);
        this._updateMovement(dt);
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
    }

    _updateDayCycle(dt) {
        this.dayPhaseTimer += dt;
        if (this.dayPhaseTimer >= this.dayPhaseDuration) {
            this.dayPhaseTimer = 0;
            const enteringNight = this.dayPhases[this.dayPhaseIndex] !== 'night' && this.dayPhases[(this.dayPhaseIndex + 1) % this.dayPhases.length] === 'night';
            const enteringDawn = this.dayPhases[this.dayPhaseIndex] !== 'dawn' && this.dayPhases[(this.dayPhaseIndex + 1) % this.dayPhases.length] === 'dawn';
            this.dayPhaseIndex = (this.dayPhaseIndex + 1) % this.dayPhases.length;
            if (enteringNight) this._onNightFalls();
            if (enteringDawn) {
                this.dayCount++; // novo dia — ver openShop (ui.js)
                this.nightWanderers = []; // vampiros se recolhem com a luz do sol
            }
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
    }

    // Clima da praça: alterna entre 'clear' e 'rain' em ciclos temporizados
    // independentes do dia/noite. Enquanto chove, pinga chuva (ver
    // GraphicsEngine.spawnRainDrop) espalhada pelo topo da tela.
    _updateWeather(dt) {
        this._weatherTimer -= dt;
        if (this._weatherTimer <= 0) {
            if (this.weather === 'clear') {
                this.weather = Utils.chance(35) ? 'rain' : 'clear';
                this._weatherTimer = this.weather === 'rain' ? Utils.randomFloat(30, 55) : Utils.randomFloat(45, 90);
                if (this.weather === 'rain') this._toast('Nuvens escuras cobrem a praça — começa a chover.', 'info');
            } else {
                this.weather = 'clear';
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
            // Rumores sobre as Linhagens (Mutações) — pistas veladas, nunca
            // explica o mecanismo diretamente (ver rituals.js/lineages.js).
            // Só aparece pra quem ainda não despertou nenhuma linhagem.
            { w: (p && !p.lineage) ? 3 : 0, run: () => this._eventLineageRumor(p) }
        ];
        if (p && p.wins > 0) table.push({ w: 3, run: () => this._eventVictoryComment(p) });

        // Vampiros só saem à noite (Ritual do Vampirismo, ver rituals.js) —
        // peso relevante só quando window.GFX.arenaTime === 'night'.
        if (p && !p.lineage && window.GFX && window.GFX.arenaTime === 'night') {
            table.push({ w: 4, run: () => this._eventVampireEncounter(p) });
        }

        // Perigo noturno geral: andar pela cidade à noite é arriscado pra
        // QUALQUER jogador, com ou sem Linhagem despertada (diferente do
        // encontro com Vampiro acima, que é só sobre o Ritual). As ruas já
        // ficam visualmente vazias à noite (ver draw()/_updateNpcs) — isso
        // dá uma razão mecânica real pra essa sensação de perigo.
        if (p && window.GFX && window.GFX.arenaTime === 'night') {
            table.push({ w: 3, run: () => this._eventNightMugging(p) });
            table.push({ w: 3, run: () => this._eventNightMonsterAttack(p) });
        }

        // Fragmentos Sagrados (Ritual da Luz) — encontrados a qualquer hora,
        // raramente, enquanto o jogador ainda não completou o requisito.
        if (p && !p.lineage && (!p.ritualProgress.luz || p.ritualProgress.luz.sacredFragments < 5)) {
            table.push({ w: 2, run: () => this._eventSacredFragment(p) });
        }

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
        this._toast('Uma figura pálida observa você das sombras antes de atacar...', 'error');
        setTimeout(() => {
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
        const isVampire = Utils.chance(50);
        this._toast(isVampire
            ? 'Uma figura pálida surge da escuridão, sedenta por sangue...'
            : 'Um vulto etéreo atravessa a rua vazia, gélido e uivante...', 'error');
        setTimeout(() => {
            if (this._isActive() && window.UI && window.UI.beginBattleWith) {
                const arenaMenu = document.getElementById('city-arena-menu');
                if (arenaMenu) arenaMenu.classList.add('hidden');
                const monster = isVampire ? new Vampire(p.level) : new Ghost(p.level);
                window.UI.beginBattleWith(monster);
            }
        }, 1800);
    }

    // Fragmento Sagrado — recurso do Ritual da Luz, encontrado por acaso na
    // cidade (nunca comprado, nunca explicado diretamente ao jogador).
    _eventSacredFragment(p) {
        window.RitualSystem.onSacredFragmentFound(p, 1);
        const have = p.ritualProgress.luz.sacredFragments;
        this._toast(`Você encontra um Fragmento Sagrado brilhando entre as pedras da praça... (${have}/5)`, 'success');
        if (window.AudioManager) window.AudioManager.playConfirm();
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
    _eventRareMerchant(p) {
        const cha = (p && p.getTotalStat) ? p.getTotalStat('cha') : 5;
        const chaMult = 1 + Utils.clamp((cha - 5) * 0.04, 0, 0.8);
        const gain = Math.floor(Utils.randomInt(15, 40) * chaMult);
        if (p) p.gold += gain;
        this._toast(`Um mercador raro passou pela praça — você fez um bom negócio (+${gain}g)!`, 'success');
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
            this._toast(`Você subiu para o nível ${p.level}! (+3 Atributos, +1 Talento)`, 'success');
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

    _eventPromotion() {
        const shops = ['Ferreiro', 'Armeiro', 'Taverna', 'Mercado Arcano'];
        const shop = shops[Utils.randomInt(0, shops.length - 1)];
        this._toast(`Promoção no ${shop}: preços especiais só por hoje!`, 'info');
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
        // uma escolha arriscada, não só estética.
        const isNight = window.GFX && window.GFX.arenaTime === 'night';
        const drawables = [
            ...this.buildings.map(b => ({ y: this._doorPoint(b).y, draw: () => this._drawBuilding(ctx, w, h, b) })),
            ...(isNight ? this.nightWanderers : this.npcs).map(n => ({ y: n.y, draw: () => this._drawNpc(ctx, n) })),
            { y: this.player.y, draw: () => this._drawPlayer(ctx) },
        ];
        drawables.sort((a, b) => a.y - b.y);
        drawables.forEach(d => d.draw());
    }

    _drawPlazaGround(ctx, w, h, horizon) {
        const grad = ctx.createLinearGradient(0, horizon, 0, h);
        grad.addColorStop(0, '#8a8070');
        grad.addColorStop(1, '#5a5448');
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

    _drawFountain(ctx, w, h) {
        const scale = this._cityScale(h);
        const x = this.fountain.xFrac * w, y = this._horizon(h) + this.fountain.rowOffset * scale;
        const r = this.fountain.r * scale;
        ctx.fillStyle = '#8891a0';
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a6a8a';
        ctx.beginPath(); ctx.ellipse(x, y, r * 0.78, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        // Jato de água central (anima com o tempo)
        const t = performance.now() * 0.003;
        ctx.strokeStyle = 'rgba(200,225,255,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.2);
        ctx.lineTo(x, y - r * 0.2 - 22 - Math.sin(t) * 3);
        ctx.stroke();
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(x - 4, y - r * 0.2 - 30, 8, 10);
    }

    _drawStatue(ctx, w, h, s) {
        const scale = this._cityScale(h);
        const x = s.xFrac * w, y = this._horizon(h) + s.rowOffset * scale;
        ctx.fillStyle = '#c9c2b0';
        ctx.fillRect(x - 10 * scale, y - 6 * scale, 20 * scale, 8 * scale); // pedestal
        ctx.fillRect(x - 5 * scale, y - 46 * scale, 10 * scale, 40 * scale); // corpo
        ctx.beginPath(); ctx.arc(x, y - 50 * scale, 6 * scale, 0, Math.PI * 2); ctx.fill(); // cabeça
    }

    // Vegetação orientada a dados (ver this.vegetation) — cipreste (silhueta
    // alta e afunilada, marco registrado da paisagem mediterrânea) ou
    // loureiro (arbusto baixo e arredondado, planta sagrada de Apolo,
    // tradicionalmente associada a vitória/coroas de louro — bem a calhar
    // numa praça de gladiadores).
    _drawVegetation(ctx, w, h, v) {
        const scale = this._cityScale(h) * (v.scale || 1);
        const x = v.xFrac * w, y = this._horizon(h) + v.rowOffset * scale;

        if (v.type === 'cypress') {
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
        } else if (v.type === 'laurel') {
            ctx.fillStyle = '#5a4530';
            ctx.fillRect(x - 2 * scale, y - 4 * scale, 4 * scale, 6 * scale);
            ctx.fillStyle = '#5a7a4a';
            const puffs = [[-8, -10, 8], [8, -10, 8], [0, -18, 9], [-6, -2, 7], [6, -2, 7]];
            puffs.forEach(([dx, dy, r]) => {
                ctx.beginPath();
                ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }

    // Prédio procedural greco-romano: base + colunas + telhado triangular +
    // porta + tochas nas laterais. As dimensões já vêm escaladas de
    // _buildingRect (telas baixas encolhem os prédios pra sempre caberem
    // entre o horizonte e o rodapé da praça).
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

        // Sombra no chão
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(door.x, door.y + 4, bw * 0.55, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Corpo do prédio
        ctx.fillStyle = b.wall;
        ctx.fillRect(left, top, bw, bh);

        // Colunas de mármore
        const colCount = Math.max(3, Math.floor(bw / 32));
        ctx.fillStyle = 'rgba(230,224,208,0.9)';
        for (let i = 0; i < colCount; i++) {
            const cx = left + (bw / (colCount - 1)) * i;
            ctx.fillRect(cx - 4, top + 6, 8, bh - 12);
        }

        // Telhado triangular (pediment)
        ctx.fillStyle = b.roof;
        ctx.beginPath();
        ctx.moveTo(left - 10, top);
        ctx.lineTo(door.x, top - bh * 0.3);
        ctx.lineTo(left + bw + 10, top);
        ctx.closePath();
        ctx.fill();

        // Porta
        ctx.fillStyle = '#2a1c10';
        const doorW = bw * 0.22, doorH = bh * 0.42;
        ctx.fillRect(door.x - doorW / 2, door.y - doorH, doorW, doorH);

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
    // ~160px (_legLen 58 + _torsoH 62 + _headR*2 40), quase 4x a altura da
    // porta de um prédio (~44px num prédio da fileira do meio) — bem maior
    // que um prédio de verdade. NPC_EXTRA_SHRINK aproxima a altura deles da
    // porta.
    static get NPC_EXTRA_SHRINK() { return 0.32; }

    // O jogador usava só _cityScale (sem encolhimento extra), o que na
    // prática o deixava mais alto que a própria casa inteira (~160px de
    // personagem contra ~105px de prédio) — um "gigante" andando pela
    // cidade, e não um herói em destaque como pretendido. PLAYER_EXTRA_SHRINK
    // é maior que o dos NPCs (0.32) pra ele continuar visivelmente mais
    // proeminente que os cidadãos comuns, mas pequeno o bastante pra caber
    // na escala real dos prédios ao seu redor.
    static get PLAYER_EXTRA_SHRINK() { return 0.4; }

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
            ] }
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
