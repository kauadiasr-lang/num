/**
 * Mundo da Estrada (Fase 2 — mínimo; Fase 3 — biomas graduais) —
 * Arena of Blades
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
 * mudam densidade/nome, nunca a cena inteira de uma vez. Ainda SEM
 * eventos físicos (ver Fase 4) nem NPCs/caravanas ambiente (Fase 6).
 * A Expedição à Floresta Ancestral (ligada a Natureza/Corrupção)
 * continua no sistema antigo (js/roads.js RoadSystem + tela screen-road)
 * até a migração física dela na Fase 5.
 */
window.RoadEngine = {
    WORLD_LENGTH: 63000, // ~5min andando contínuo a pé (walkSpeed=210px/s * 300s)
    LANE_HALF_HEIGHT: 140, // faixa caminhável acima/abaixo da linha central da estrada

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

        const toDef = window.CityDatabase[toId];
        this._zones = this.ZONE_TEMPLATE.map((z, i) => ({
            name: i === this.ZONE_TEMPLATE.length - 1 ? `Arredores de ${toDef ? toDef.name : 'chegada'}` : z.name,
            vegDensity: z.vegDensity
        }));
        this._zoneLength = this.WORLD_LENGTH / this._zones.length;
        this._lastZoneIndex = -1;
        this._updateZoneLabel(0);

        window.Camera.follow(this._player);
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
    _hash(i) {
        let x = (i * 2654435761) >>> 0;
        x ^= x >>> 15;
        return x % 100;
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

        // Bioma atual (Fase 3) — só escreve no DOM quando a zona muda (não
        // a cada frame), já que o nome não muda com o jogador parado.
        const zoneIdx = this._zoneIndexAt(p.x);
        if (zoneIdx !== this._lastZoneIndex) {
            this._lastZoneIndex = zoneIdx;
            this._updateZoneLabel(zoneIdx);
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
        // mínima (sem props/eventos físicos ainda, ver Fase 4).
        this._drawMarker(ctx, 0, fromDef ? fromDef.name : '');
        this._drawMarker(ctx, this.WORLD_LENGTH, toDef ? toDef.name : '');

        // Placas de bioma (Fase 3) — um marco em cada fronteira de zona,
        // com o nome da zona que começa ali. A cor de fundo já muda de
        // forma contínua (mistura acima) — isso só rotula fisicamente as
        // seções, nunca troca o cenário de uma vez.
        for (let i = 1; i < this._zones.length; i++) {
            this._drawMarker(ctx, i * this._zoneLength, this._zones[i].name);
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
