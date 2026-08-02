# Mundo da Estrada Mínimo — Implementation Plan (Fase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o loop de dados-por-etapa (`RoadSystem.advance`/`_rollEvent` + tela `screen-road` como menu) por um mundo real, de uma zona só, onde o jogador anda de verdade (WASD/clique, câmera seguindo) de uma cidade até a próxima — sem eventos/biomas graduais ainda (isso é Fase 3+). Viagem manual real (a pé/a cavalo) some do fluxo de dados; a Expedição à Floresta Ancestral (ligada a Natureza/Corrupção, migração física é Fase 5) continua no sistema antigo intacto, sem regressão.

**Architecture:** Novo `js/road.js` `RoadEngine` — mesmo padrão do `CityEngine`, reaproveitando `Camera` e `PlayerController` (Fase 1) para o movimento/câmera, e `Utils.lerpColor` para a mistura gradual de paleta entre a cidade de origem e destino. Roda numa tela nova (`screen-roadworld`, full-canvas como `screen-hub`), separada da tela antiga `screen-road` (que continua existindo só para a Expedição à Floresta). `player.roadWorldJourney` é o novo campo de estado (distinto de `player.roadJourney`, que fica reservado só pra Expedição à Floresta) — assim as duas jornadas nunca colidem e um save no meio de uma jornada real antiga é resolvido automaticamente ao carregar (não existe mais o formato antigo pra viagem real).

**Tech Stack:** Vanilla JS (mesmo padrão do resto do projeto), Canvas 2D, sem build step. Testes via Playwright em `/tmp/pw/`.

## Global Constraints

- Nunca quebrar a Expedição à Floresta Ancestral (continua 100% no sistema antigo `RoadSystem`/`screen-road`/`player.roadJourney`).
- Nunca quebrar Viagem Rápida (`City.travelToCity` direto, sem passar pela Estrada).
- FPS ≥ 58 dentro do mundo da Estrada (mesmo padrão de medição já usado nesta sessão).
- Save antigo com `player.roadJourney` de uma viagem real (não-floresta) precisa ser resolvido automaticamente ao carregar, sem cobrar passagem de novo, avisando o jogador.
- Distância de uma cidade a outra ≈ 5 minutos andando a pé contínuo, na velocidade base (`walkSpeed = 210px/s` já usada por `CityEngine`/`PlayerController`) → `worldLength ≈ 210 * 300 = 63000` unidades de mundo.

---

### Task 1: `js/road.js` — RoadEngine (mundo, movimento, câmera, chegada)

**Files:**
- Create: `js/road.js`
- Modify: `index.html` (script tag, nova `<div id="screen-roadworld">`)

**Interfaces:**
- Consumes: `window.Camera` (`follow`, `getOffset`, `isVisible`), `window.PlayerController` (`update`, `collides`, `findPath`), `window.CityDatabase`, `Utils.lerpColor`, `Utils.clamp`, `Utils.randomInt`, `Utils.chance`.
- Produces: `window.RoadEngine` com `start(fromId, toId, mode, player)`, `update(dt)`, `draw(ctx, w, h)`, `abandon()`, `_isActive()`, `WORLD_LENGTH` (constante exportada pra teste).

- [ ] **Step 1: Write the failing test**

Create `/tmp/pw/road_engine_unit_check.js`:

```js
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGE: ' + e.message));

    await page.goto('http://localhost:8877/index.html');
    await page.waitForTimeout(400);
    await page.click('#btn-start');
    await page.waitForTimeout(300);
    await page.click('#btn-mm-newgame');
    await page.waitForSelector('#screen-saveslots.active', { timeout: 5000 });
    await page.click('.save-slot-card.empty button[data-action="create"]');
    await page.waitForSelector('#screen-creation.active', { timeout: 5000 });
    await page.fill('#char-name', 'RoadTest');
    await page.waitForTimeout(150);
    const addBtn = await page.$('.btn-add');
    for (let i = 0; i < 10; i++) { await addBtn.click(); }
    await page.click('#btn-finish-creation');
    await page.waitForSelector('#screen-hub.active', { timeout: 5000 });
    await page.waitForTimeout(300);

    const out = await page.evaluate(() => {
        const res = {};
        res.roadEngineExists = typeof window.RoadEngine === 'object';
        return res;
    });

    out.pageErrors = errors;
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/pw && node road_engine_unit_check.js`
Expected: `roadEngineExists: false` (módulo ainda não existe).

- [ ] **Step 3: Write `js/road.js`**

```js
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
        // por cima de qualquer um dos dois modos.
        const base = this.mode === 'horse' ? 210 * 1.5 : 210;
        const running = this.keysHeld && (this.keysHeld.up || this.keysHeld.down || this.keysHeld.left || this.keysHeld.right) && this._running;
        return running ? base * 1.6 : base;
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

    handleClick(worldX, worldY) {
        if (!this._isActive()) return;
        const p = this._player;
        const bounds = this._bounds();
        const clampedY = Utils.clamp(worldY, bounds.minY, bounds.maxY);
        const path = window.PlayerController.findPath(p.x, p.y, this.WORLD_LENGTH, clampedY, [], bounds);
        // Anda até o ponto clicado (não até o fim do mundo) — igual ao
        // clique-pra-andar da Praça: usamos findPath só pra manter o
        // mesmo contrato de retorno (lista de waypoints), sem obstáculos
        // na Estrada ainda (Fase 2 não tem props físicos colidíveis).
        p.targetX = Utils.clamp(worldX, bounds.minX, bounds.maxX);
        p.targetY = clampedY;
        p.pathQueue = [];
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
```

- [ ] **Step 4: Add the `<script>` tag**

In `index.html`, right after `<script src="js/city.js"></script>`, add:

```html
<script src="js/road.js"></script>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /tmp/pw && node road_engine_unit_check.js`
Expected: `roadEngineExists: true`, `pageErrors: []`.

- [ ] **Step 6: Commit**

```bash
git add js/road.js index.html
git commit -m "feat(estrada): motor do Mundo da Estrada (js/road.js) — trajeto real entre cidades"
```

---

### Task 2: Nova tela `screen-roadworld` + wiring em `main.js`/`graphics.js`

**Files:**
- Modify: `index.html` (nova `<div id="screen-roadworld">`)
- Modify: `js/main.js` (`update(dt)`)
- Modify: `js/graphics.js` (`draw()` dispatch)

**Interfaces:**
- Consumes: `window.RoadEngine.update/draw/_isActive` (Task 1).
- Produces: tela `ROADWORLD` reconhecida pelo loop principal e por `GraphicsEngine.draw`.

- [ ] **Step 1: Markup da tela (full-canvas, mesmo padrão de `screen-hub`)**

Em `index.html`, logo depois do `</div>` que fecha `screen-road` (linha ~663), adicionar:

```html
<!-- TELA: MUNDO DA ESTRADA (Fase 2 — trajeto real entre cidades, ver
     js/road.js RoadEngine). Full-canvas como screen-hub — o jogador
     controla o personagem de verdade, não é um menu. -->
<div id="screen-roadworld" class="screen screen-city">
    <div class="hud-top">
        <div class="player-info">
            <h3 id="roadworld-title" class="highlight-gold">Estrada</h3>
            <p id="roadworld-mode">A pé</p>
        </div>
    </div>
    <p id="roadworld-hint" class="city-hint">Toque no chão para andar (ou WASD/setas, Shift para correr)</p>
    <button id="btn-abandon-roadworld" class="btn btn-small" style="position:absolute; bottom:20px; right:20px;">Abandonar Viagem</button>
</div>
```

- [ ] **Step 2: `js/main.js` — atualizar o RoadEngine no loop principal**

Em `update(dt)` (linha ~165, logo depois de `if (window.City) window.City.update(dt);`):

```js
        if (window.RoadEngine) window.RoadEngine.update(dt);
```

- [ ] **Step 3: `js/graphics.js` — desenhar o RoadEngine quando a tela for ROADWORLD**

Em `draw()`, logo depois do bloco `else if (screen === 'HUB') { ... }` (linha ~698):

```js
        } else if (screen === 'ROADWORLD') {
            if (window.RoadEngine) window.RoadEngine.draw(ctx, canvasWidth, canvasHeight);
```

(mantém o `else { ctx.fillStyle='#000000'; ... }` original como último `else` da cadeia.)

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check js/main.js && node --check js/graphics.js && node --check index.html 2>/dev/null; echo OK` (index.html não é JS — só confirmar visualmente que a tag fechou certo lendo o arquivo).

- [ ] **Step 5: Commit**

```bash
git add index.html js/main.js js/graphics.js
git commit -m "feat(estrada): tela screen-roadworld + wiring do RoadEngine no loop principal"
```

---

### Task 3: `js/ui.js` — iniciar/abandonar/chegar na viagem real via RoadEngine

**Files:**
- Modify: `js/ui.js`
- Modify: `index.html` (listener do botão abandonar + input global)

**Interfaces:**
- Consumes: `window.RoadEngine.start/abandon/handleKey/handleClick` (Task 1).
- Produces: `UI.onRoadWorldArrival(toId)` (chamado pelo RoadEngine — Task 1's `update()` já assume que existe).

- [ ] **Step 1: `startRoadJourney` passa a abrir o Mundo da Estrada pra viagens reais**

Em `js/ui.js`, substituir o corpo de `startRoadJourney` (linha ~2618):

```js
    // Inicia uma travessia real entre cidades (ver js/road.js RoadEngine) —
    // substitui o antigo RoadSystem.startJourney (dados-por-etapa) no
    // caminho crítico (Fase 2 do redesenho de viagem). A Expedição à
    // Floresta Ancestral continua em startForestExpedition/RoadSystem,
    // intocada (migração física dela é Fase 5).
    startRoadJourney(cityId, mode) {
        const p = window.Engine.state.player;
        const dest = window.CityDatabase[cityId];
        if (!dest || !window.RoadEngine) return;
        if (mode === 'horse' && window.RoadSystem && p.gold < window.RoadSystem.getHorseCost(dest)) {
            window.AudioManager.playError();
            if (window.MainMenu) window.MainMenu.showToast('Ouro insuficiente para alugar um cavalo!', 'error');
            return;
        }
        if (mode === 'horse' && window.RoadSystem) {
            p.gold -= window.RoadSystem.getHorseCost(dest);
        }
        const fromId = window.getCurrentCityId();
        p.roadWorldJourney = { fromId, toId: cityId, mode };
        window.RoadEngine.start(fromId, cityId, mode, p);
        window.SaveManager.save(window.Engine.state);
        document.getElementById('roadworld-title').innerText = `${window.CityDatabase[fromId].name} → ${dest.name}`;
        document.getElementById('roadworld-mode').innerText = mode === 'horse' ? 'A cavalo' : 'A pé';
        this.showScreen('screen-roadworld');
    },
```

- [ ] **Step 2: Abandonar e chegar**

Logo depois do método acima, adicionar:

```js
    abandonRoadWorld() {
        const p = window.Engine.state.player;
        p.roadWorldJourney = null;
        if (window.RoadEngine) window.RoadEngine.abandon();
        window.SaveManager.save(window.Engine.state);
        this.showScreen('screen-hub');
    },

    // Chamado pelo RoadEngine (js/road.js update()) quando o jogador chega
    // fisicamente ao fim do mundo da Estrada — equivalente ao antigo
    // `result.arrived` de RoadSystem.advance, só que disparado por posição
    // real no mapa, não por contagem de etapas.
    onRoadWorldArrival(toId) {
        const p = window.Engine.state.player;
        p.roadWorldJourney = null;
        if (window.RoadEngine) window.RoadEngine.abandon();
        const success = window.City.travelToCity(toId, true); // skipCost=true: passagem já resolvida (a cavalo cobrado no início; a pé sempre grátis)
        if (success) {
            window.AudioManager.playConfirm();
            if (window.MainMenu) window.MainMenu.showToast(`Você chegou em ${window.CityDatabase[toId].name}!`, 'success');
            this.updateHubStats();
        }
        this.showScreen('screen-hub');
    },
```

- [ ] **Step 3: Listeners de input (clique/toque/tecla) e botão de abandonar**

Em `js/ui.js`, dentro do mesmo método que já registra `screenEl.addEventListener('click', ...)`/`keydown` pra `City` (procurar `window.addEventListener('keydown', (e) => this._handleKey`, ou o equivalente em `_setupInput` do próprio `city.js` — aqui é preciso um listener GLOBAL equivalente pro RoadEngine, já que ele não tem seu próprio `_setupInput`). Adicionar, no local onde os outros listeners globais de UI são registrados (perto de onde `btn-close-road`/`btn-road-advance` são ligados, método que roda no boot da UI):

```js
        document.getElementById('btn-abandon-roadworld').addEventListener('click', () => this.abandonRoadWorld());

        window.addEventListener('keydown', (e) => { if (window.RoadEngine) window.RoadEngine.handleKey(e, true); });
        window.addEventListener('keyup', (e) => { if (window.RoadEngine) window.RoadEngine.handleKey(e, false); });

        document.getElementById('game-canvas').addEventListener('click', (e) => {
            if (!window.RoadEngine || !window.RoadEngine._isActive()) return;
            const canvas = document.getElementById('game-canvas');
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left, screenY = e.clientY - rect.top;
            const offset = window.Camera.getOffset(window.Engine.width, window.Engine.height);
            window.RoadEngine.handleClick(screenX - offset.dx, screenY - offset.dy);
        });
```

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check js/ui.js`
Expected: sem erro.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js index.html
git commit -m "feat(estrada): ui.js liga viagem real ao RoadEngine (iniciar/abandonar/chegar)"
```

---

### Task 4: Compat de save (viagem real antiga) + regressão completa

**Files:**
- Modify: `js/mainmenu.js` (`loadSlotAndEnterHub`)
- Test: `/tmp/pw/road_world_journey_check.js`, `/tmp/pw/road_world_full_regression.js`

**Interfaces:**
- Consumes: tudo das Tasks 1-3.
- Produces: nada novo — migração de save + verificação.

- [ ] **Step 1: Migração do save antigo**

Em `js/mainmenu.js`, em `loadSlotAndEnterHub` (linha ~40), logo depois de `window.Engine.restorePlayerFromSave(savedData);`:

```js
        // Compat: um save antigo pode ter uma viagem real (não-Floresta)
        // presa no formato antigo de RoadSystem (step/totalSteps/log) —
        // esse formato não existe mais pra viagens reais (ver js/road.js
        // RoadEngine, Fase 2 do redesenho). Resolve automaticamente pro
        // destino, sem cobrar passagem de novo (já foi paga ao iniciar),
        // e avisa o jogador. Expedição à Floresta Ancestral não é afetada
        // (continua no sistema antigo intacto).
        const p = window.Engine.state.player;
        if (p.roadJourney && !p.roadJourney.isForestExpedition) {
            const toId = p.roadJourney.toId;
            p.roadJourney = null;
            if (window.CityDatabase[toId]) window.City.travelToCity(toId, true);
            this.showToast('Sua viagem em andamento foi concluída automaticamente (o mundo da Estrada mudou).', 'info');
        }
```

- [ ] **Step 2: Write the journey test**

Create `/tmp/pw/road_world_journey_check.js`:

```js
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGE: ' + e.message));

    await page.goto('http://localhost:8877/index.html');
    await page.waitForTimeout(400);
    await page.click('#btn-start');
    await page.waitForTimeout(300);
    await page.click('#btn-mm-newgame');
    await page.waitForSelector('#screen-saveslots.active', { timeout: 5000 });
    await page.click('.save-slot-card.empty button[data-action="create"]');
    await page.waitForSelector('#screen-creation.active', { timeout: 5000 });
    await page.fill('#char-name', 'RoadJourney');
    await page.waitForTimeout(150);
    const addBtn = await page.$('.btn-add');
    for (let i = 0; i < 10; i++) { await addBtn.click(); }
    await page.click('#btn-finish-creation');
    await page.waitForSelector('#screen-hub.active', { timeout: 5000 });
    await page.waitForTimeout(300);

    const out = await page.evaluate(() => {
        const res = {};
        const p = window.Engine.state.player;
        p.level = 10; p.gold = 999999;

        window.UI.startRoadJourney('fortaleza_orc', 'walk');
        res.screenIsRoadworld = document.getElementById('screen-roadworld').classList.contains('active');
        res.engineActive = window.RoadEngine.active;
        res.startedAtCorrectCity = window.RoadEngine.fromId === 'porto_helenico' && window.RoadEngine.toId === 'fortaleza_orc';

        // Corre até o fim do mundo (Shift + direita), várias iterações.
        window.RoadEngine.keysHeld.right = true;
        window.RoadEngine._running = true;
        for (let i = 0; i < 20000 && window.RoadEngine.active; i++) {
            window.RoadEngine.update(1 / 60);
        }
        res.arrivedAtDestination = window.getCurrentCityId() === 'fortaleza_orc';
        res.engineDeactivatedAfterArrival = !window.RoadEngine.active;
        res.backOnHubScreen = document.getElementById('screen-hub').classList.contains('active');

        return res;
    });

    out.pageErrors = errors;
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd /tmp/pw && node road_world_journey_check.js`
Expected: `screenIsRoadworld: true`, `engineActive: true`, `startedAtCorrectCity: true`, `arrivedAtDestination: true`, `engineDeactivatedAfterArrival: true`, `backOnHubScreen: true`, `pageErrors: []`.

- [ ] **Step 4: FPS check dentro do Mundo da Estrada**

Create `/tmp/pw/road_world_full_regression.js` (mesmo padrão de `camera_foundation_full_regression.js`, mas medindo FPS com `window.RoadEngine` ativo em vez de `window.City`):

```js
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push('PAGE: ' + e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('404')) errors.push('CONSOLE: ' + msg.text()); });

    await page.goto('http://localhost:8877/index.html');
    await page.waitForTimeout(400);
    await page.click('#btn-start');
    await page.waitForTimeout(300);
    await page.click('#btn-mm-newgame');
    await page.waitForSelector('#screen-saveslots.active', { timeout: 5000 });
    await page.click('.save-slot-card.empty button[data-action="create"]');
    await page.waitForSelector('#screen-creation.active', { timeout: 5000 });
    await page.fill('#char-name', 'RoadFPS');
    await page.waitForTimeout(150);
    const addBtn = await page.$('.btn-add');
    for (let i = 0; i < 10; i++) { await addBtn.click(); }
    await page.click('#btn-finish-creation');
    await page.waitForSelector('#screen-hub.active', { timeout: 5000 });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
        const p = window.Engine.state.player;
        p.level = 10; p.gold = 999999;
        window.UI.startRoadJourney('fortaleza_orc', 'walk');
    });
    await page.waitForTimeout(300);

    const out = {};
    out.fps = await page.evaluate(() => new Promise(resolve => {
        let frames = 0;
        const start = performance.now();
        function tick() {
            frames++;
            if (performance.now() - start < 800) requestAnimationFrame(tick);
            else resolve(Math.round(frames / ((performance.now() - start) / 1000)));
        }
        requestAnimationFrame(tick);
    }));

    out.abandonWorks = await page.evaluate(() => {
        window.UI.abandonRoadWorld();
        return document.getElementById('screen-hub').classList.contains('active') && !window.RoadEngine.active;
    });

    out.pageErrors = errors;
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
```

Run: `cd /tmp/pw && node road_world_full_regression.js`
Expected: `fps >= 58`, `abandonWorks: true`, `pageErrors: []`.

- [ ] **Step 5: Rodar toda a suíte de regressão já existente**

Run cada teste em `/tmp/pw/` já usado nesta sessão (`regression_iter35.js`, `corruption_*`, `forest_gate_access_check.js`, `normal_road_regression_check.js`, `quest_*`, `road_scenery_check.js`, `verify_*`, `camera_*`, `playercontroller_regression_check.js`) — nenhum deve regredir (a Expedição à Floresta em particular precisa continuar 100% funcional, já que ela NÃO passa pelo RoadEngine).

- [ ] **Step 6: Git-safety diff review**

```bash
git fetch origin claude/arena-of-blades-rpg-7upo4h
git status --short
git diff origin/claude/arena-of-blades-rpg-7upo4h -- js/ui.js js/mainmenu.js js/main.js js/graphics.js index.html | grep -nE "^-[^-]"
```

Confirmar manualmente que toda linha removida é uma substituição intencional (corpo antigo de `startRoadJourney`, o `else` da cadeia de `graphics.js`).

- [ ] **Step 7: Commit e push**

```bash
git add js/mainmenu.js
git commit -m "feat(estrada): compat de save pra viagem real presa no formato antigo"
git push -u origin claude/arena-of-blades-rpg-7upo4h
git fetch origin claude/arena-of-blades-rpg-7upo4h
git log origin/claude/arena-of-blades-rpg-7upo4h --oneline -8
```

---

## What comes after this plan

Fase 3 (biomas graduais + múltiplas zonas), Fase 4 (eventos físicos + encontros), Fase 5 (missões de viagem + Natureza/Corrupção físicas — inclui migrar a Expedição à Floresta pro RoadEngine), Fase 6 (mundo vivo ambiente) e Fase 7 (chunking/performance sob carga real) continuam fora do escopo deste plano, cada uma com seu próprio detalhamento quando chegar a vez.
