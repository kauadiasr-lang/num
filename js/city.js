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
        this.player = { x: 0, y: 0, targetX: null, targetY: null, facing: 1, moving: false };
        this.walkSpeed = 210; // px/s

        this.keysHeld = { up: false, down: false, left: false, right: false };
        this._initialized = false;
        this._hintShown = true;

        // Ciclo dia/noite: percorre as 4 mesmas paletas já usadas pela
        // arena (dawn/day/sunset/night), sincronizando GFX.arenaTime.
        this.dayPhases = ['dawn', 'day', 'sunset', 'night'];
        this.dayPhaseIndex = 1; // começa de dia
        this.dayPhaseTimer = 0;
        this.dayPhaseDuration = 75; // segundos por fase (~5min o ciclo completo)

        this.npcs = [];
        this._npcSpawnDone = false;
        this._smokeTimer = 0;
        this._ambientSoundTimer = 0;
        this._nearBuilding = null;

        this.buildings = [
            { id: 'arena', name: 'Arena', icon: '⚔️', xFrac: 0.5, rowOffset: 40, w: 240, h: 175, wall: '#8a7a5a', roof: '#8a2a2a', row: 'back' },
            { id: 'blacksmith', name: 'Ferreiro', icon: '🔨', xFrac: 0.13, rowOffset: 95, w: 130, h: 105, wall: '#6b5a42', roof: '#7a4a2a', row: 'mid' },
            { id: 'armorer', name: 'Armeiro', icon: '🛡️', xFrac: 0.29, rowOffset: 95, w: 130, h: 105, wall: '#6b5a42', roof: '#5a6a7a', row: 'mid' },
            { id: 'tavern', name: 'Taverna', icon: '🍺', xFrac: 0.71, rowOffset: 95, w: 130, h: 105, wall: '#6b5a42', roof: '#8a5a2a', row: 'mid' },
            { id: 'arcane', name: 'Mercado Arcano', icon: '🔮', xFrac: 0.87, rowOffset: 95, w: 130, h: 105, wall: '#5a4a6b', roof: '#3a2a5a', row: 'mid' },
            { id: 'bank', name: 'Banco', icon: '💰', xFrac: 0.22, rowOffset: 165, w: 115, h: 90, wall: '#8891a0', roof: '#c9a227', row: 'front' },
            { id: 'halloffame', name: 'Hall da Fama', icon: '🏆', xFrac: 0.5, rowOffset: 172, w: 130, h: 95, wall: '#9a8a70', roof: '#c9a227', row: 'front' },
            { id: 'house', name: 'Sua Casa', icon: '🏠', xFrac: 0.78, rowOffset: 165, w: 115, h: 90, wall: '#6b5a42', roof: '#7a4a2a', row: 'front' },
        ];

        // Decorações puramente visuais (sem colisão, exceto a fonte central).
        this.fountain = { xFrac: 0.5, rowOffset: 130, r: 34 };
        this.statues = [
            { xFrac: 0.38, rowOffset: 125 },
            { xFrac: 0.62, rowOffset: 125 },
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
    }

    _makeNpc() {
        const w = window.Engine.width, h = window.Engine.height;
        const skinTones = ['#ffcc99', '#e0a878', '#a86b3f', '#7a4a2a'];
        const hairColors = ['#2a1c10', '#5a3a1a', '#1a1a1a', '#8a5a2b'];
        const x = Utils.randomFloat(w * 0.1, w * 0.9);
        const y = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
        return {
            x, y, targetX: x, targetY: y,
            waitTimer: Utils.randomFloat(1, 4),
            facing: Utils.chance(50) ? 1 : -1,
            entity: {
                visuals: {
                    gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
                    skinTone: skinTones[Utils.randomInt(0, skinTones.length - 1)],
                    hairStyle: Utils.randomInt(1, 15),
                    hairColor: hairColors[Utils.randomInt(0, hairColors.length - 1)],
                    beardStyle: 0, eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {}
            },
            anim: { type: 'idle', start: performance.now(), duration: 0 }
        };
    }

    _updateNpcs(dt) {
        const h = window.Engine.height;
        for (const npc of this.npcs) {
            npc.waitTimer -= dt;
            const dx = npc.targetX - npc.x, dy = npc.targetY - npc.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 4) {
                const speed = 45;
                npc.x += (dx / dist) * speed * dt;
                npc.y += (dy / dist) * speed * dt;
                npc.facing = dx >= 0 ? 1 : -1;
                npc.anim.type = 'walk';
            } else {
                npc.anim.type = 'idle';
                if (npc.waitTimer <= 0) {
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

        // Clicou num prédio? Anda até a porta e entra sozinho ao chegar.
        const building = this._buildingAtPoint(x, y);
        if (building) {
            const door = this._doorPoint(building);
            if (this._distanceTo(door) < this._interactRadius) {
                this.interact(building.id);
            } else {
                this.player.targetX = door.x;
                this.player.targetY = door.y + 24; // parar um pouco à frente da porta, não em cima dela
                this._pendingInteract = building.id;
            }
            return;
        }

        this._pendingInteract = null;
        this.player.targetX = x;
        this.player.targetY = Utils.clamp(y, this._horizon(window.Engine.height) + 10, this._plazaBottom(window.Engine.height) + 20);
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
                window.UI.openShop([SLOTS.MAIN_HAND], 'Ferreiro');
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
        this._updateNpcs(dt);
        this._updateProximity();
        this._updateAmbientEffects(dt);
    }

    _updateDayCycle(dt) {
        this.dayPhaseTimer += dt;
        if (this.dayPhaseTimer >= this.dayPhaseDuration) {
            this.dayPhaseTimer = 0;
            this.dayPhaseIndex = (this.dayPhaseIndex + 1) % this.dayPhases.length;
        }
        if (window.GFX) window.GFX.arenaTime = this.dayPhases[this.dayPhaseIndex];
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
        } else if (this.player.targetX !== null) {
            const dx = this.player.targetX - this.player.x;
            const dy = this.player.targetY - this.player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 4) {
                this.player.targetX = null;
                this.player.targetY = null;
                if (this._pendingInteract) {
                    const id = this._pendingInteract;
                    this._pendingInteract = null;
                    this.interact(id);
                }
            } else {
                vx = (dx / dist) * this.walkSpeed;
                vy = (dy / dist) * this.walkSpeed;
            }
        }

        this.player.moving = vx !== 0 || vy !== 0;
        if (vx !== 0) this.player.facing = vx > 0 ? 1 : -1;

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

    // --- Desenho ---
    // Chamado por GraphicsEngine.draw() quando state.screen === 'HUB', logo
    // depois de drawArenaBackground() (céu/coliseu/plateia já desenhados).
    draw(ctx, w, h) {
        if (!this._initialized) return;
        const horizon = this._horizon(h);

        this._drawPlazaGround(ctx, w, h, horizon);
        this._drawFountain(ctx, w, h);
        this.statues.forEach(s => this._drawStatue(ctx, w, h, s));

        // Ordena tudo que fica "no chão" (prédios, NPCs, jogador) por Y, pra
        // quem está mais embaixo na tela ser desenhado por cima (profundidade).
        const drawables = [
            ...this.buildings.map(b => ({ y: this._doorPoint(b).y, draw: () => this._drawBuilding(ctx, w, h, b) })),
            ...this.npcs.map(n => ({ y: n.y, draw: () => this._drawNpc(ctx, n) })),
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

        // Tochas nas laterais (reaproveita o desenho já usado na arena)
        if (window.GFX && window.GFX._drawTorch) {
            const tClock = window.GFX._torchClock || 0;
            window.GFX._drawTorch(ctx, left + 6, door.y, tClock);
            window.GFX._drawTorch(ctx, left + bw - 6, door.y, tClock);
        }

        // Ícone/placa identificando o prédio
        ctx.font = `bold ${iconSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(b.icon, door.x, top - bh * 0.32 - 6);
        ctx.font = `bold ${nameSize}px sans-serif`;
        ctx.fillStyle = '#f2d98a';
        ctx.fillText(b.name, door.x, top - 6);
    }

    // Jogador e NPCs usam o mesmo GFX.drawGladiator() da arena, que desenha
    // em tamanho fixo em pixels — por isso escalamos com um save/translate/
    // scale aqui (só na cidade) pra eles encolherem junto com os prédios em
    // telas menores, sem tocar em nenhuma chamada de drawGladiator da arena.
    _drawNpc(ctx, npc) {
        if (window.GFX && window.GFX.drawGladiator) {
            const scale = this._cityScale(window.Engine.height);
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
        const scale = this._cityScale(window.Engine.height);
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
