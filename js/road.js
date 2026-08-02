/**
 * Mundo da Estrada (Fase 2 — mínimo) — Arena of Blades
 *
 * Substitui o loop de dados-por-etapa (js/roads.js RoadSystem.advance/
 * _rollEvent) por uma zona única de mundo real onde o jogador anda de
 * verdade (WASD/clique, câmera de verdade via js/camera.js) da cidade de
 * origem até a de destino. Reaproveita o mesmo PlayerController (js/
 * playercontroller.js) usado pela Praça — mesma física de movimento,
 * mundo diferente. Ainda SEM eventos físicos/biomas graduais (ver
 * docs/superpowers/specs/2026-08-02-explorable-world-travel-design.md,
 * Fases 3-7) — só o trajeto em si, substituindo o caminho crítico da
 * viagem manual real entre duas cidades. A Expedição à Floresta Ancestral
 * (ligada a Natureza/Corrupção) continua no sistema antigo (js/roads.js
 * RoadSystem + tela screen-road) até a migração física dela na Fase 5.
 */
window.RoadEngine = {
    WORLD_LENGTH: 63000, // ~5min andando contínuo a pé (walkSpeed=210px/s * 300s)
    LANE_HALF_HEIGHT: 140, // faixa caminhável acima/abaixo da linha central da estrada

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

    // Inicia a travessia. `mode` é 'walk' ou 'horse' (custo do cavalo já
    // cobrado por quem chama, ver ui.js startRoadJourney — igual ao
    // RoadSystem antigo). `player` é o Player real (pra fadiga/gold).
    start(fromId, toId, mode, player) {
        this.fromId = fromId;
        this.toId = toId;
        this.mode = mode === 'horse' ? 'horse' : 'walk';
        this.player = player;
        this._player = { x: 40, y: 0, targetX: null, targetY: null, facing: 1, moving: false, pathQueue: [] };
        this.keysHeld = { up: false, down: false, left: false, right: false };
        this._running = false;
        this._nextFatigueTickAt = this._fatigueTickEvery;
        this._arrived = false;
        this.active = true;
        window.Camera.follow(this._player);
    },

    abandon() {
        this.active = false;
        this.player = null;
        this._player = null;
    },

    _isActive() {
        return this.active && window.Engine && window.Engine.state.screen === 'ROADWORLD';
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
        if (!this.active) return;
        const p = this._player;
        window.PlayerController.update(p, this.keysHeld, dt, this._speed(), this._bounds(), []);
        window.Camera.follow(p);

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
        }
    },

    draw(ctx, w, h) {
        if (!this.active) return;
        const fromDef = window.CityDatabase[this.fromId];
        const toDef = window.CityDatabase[this.toId];
        const t = Utils.clamp(this._player.x / this.WORLD_LENGTH, 0, 1);
        const colors = Utils.lerpColor && fromDef && toDef
            ? [Utils.lerpColor(fromDef.groundColors[0], toDef.groundColors[0], t), Utils.lerpColor(fromDef.groundColors[1], toDef.groundColors[1], t)]
            : ['#5a6a48', '#3a4530'];

        const horizon = h * 0.4;
        const grad = ctx.createLinearGradient(0, horizon, 0, h);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, horizon, w, h - horizon);
        ctx.fillStyle = '#7fa8d9';
        ctx.fillRect(0, 0, w, horizon);

        window.Camera.follow(this._player);
        const offset = window.Camera.getOffset(w, h);
        ctx.save();
        ctx.translate(offset.dx, offset.dy);

        // Marco de partida/chegada — só orientação visual nesta fase
        // mínima (sem props/eventos físicos ainda, ver Fases 3-4).
        this._drawMarker(ctx, 0, fromDef ? fromDef.name : '');
        this._drawMarker(ctx, this.WORLD_LENGTH, toDef ? toDef.name : '');

        // Vegetação esparsa, só decorativa — gerada de forma determinística
        // (sem array guardado em memória) e cullada via Camera.isVisible,
        // então o custo por frame não cresce com WORLD_LENGTH.
        const spacing = 220;
        const firstIdx = Math.max(0, Math.floor((this._player.x - w) / spacing));
        const lastIdx = Math.ceil((this._player.x + w) / spacing);
        for (let i = firstIdx; i <= lastIdx; i++) {
            const vx = i * spacing;
            if (vx < 0 || vx > this.WORLD_LENGTH) continue;
            const side = (i % 2 === 0) ? -1 : 1;
            const vy = side * (this.LANE_HALF_HEIGHT - 20);
            if (!window.Camera.isVisible(vx, vy, w, h)) continue;
            ctx.fillStyle = 'rgba(20,40,15,0.55)';
            ctx.beginPath();
            ctx.ellipse(vx, vy, 14, 22, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        this._drawPlayer(ctx);
        ctx.restore();
    },

    _drawMarker(ctx, x, label) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x - 3, -this.LANE_HALF_HEIGHT, 6, this.LANE_HALF_HEIGHT * 2);
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, -this.LANE_HALF_HEIGHT - 12);
    },

    _drawPlayer(ctx) {
        const p = this._player;
        ctx.fillStyle = '#e8c99b';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fill();
    }
};
