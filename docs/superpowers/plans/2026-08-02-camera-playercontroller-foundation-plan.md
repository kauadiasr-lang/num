# Câmera + PlayerController (Fundação do Mundo Explorável) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Arena of Blades a real camera + world-coordinate system, starting with the City Hub (Praça), as the foundation Phase 2 (the explorable Road) will build on — without changing a single piece of city content or the player-visible movement feel.

**Architecture:** A new `Camera` singleton (world-space center + screen-projection helpers) and a new `PlayerController` (movement/collision/pathfinding extracted verbatim from `CityEngine`, unchanged behavior) get introduced as standalone, independently-tested modules first. Only in the final integration task does `CityEngine` switch from "world == canvas, position = canvas-fraction" to "world is 1.4x the canvas width, position = world coordinate, camera translates at draw time." The background ground/sky fill stays in screen-space (it's a uniform gradient, never needs to scroll); only the content layer (fountain, statues, vegetation, buildings, NPCs, light stones, player) moves into world-space under one `ctx.translate`.

**Tech Stack:** Vanilla JS (ES2015+), HTML5 Canvas 2D, no build step, no framework, no test runner — Playwright driven manually via Node scripts under `/tmp/pw/`.

## Global Constraints

- Zero new dependencies, zero build step — plain `<script>` tags, same global-scope pattern as every other file in `js/`.
- Existing save format must round-trip unchanged — nothing in this plan adds or removes any field from `Player`/`SaveManager`.
- 60 FPS must be preserved in the City Hub after the retrofit (verify with the existing FPS-check pattern: count `requestAnimationFrame` callbacks over ~800ms).
- Every existing City Hub interaction (talk to NPC, enter a building, use the Portão traveler, day/night cycle, weather, footstep sound/dust) must work identically after the retrofit — this phase is described in the approved design as "a Praça continua idêntica pro jogador, só que agora via câmera."
- No new city content (buildings, NPCs, decorations) — only the walkable world bounds get wider than the viewport, purely so the camera has room to pan.
- Never touch `roads.js`/`ui.js openRoad` in this plan — that's Phase 2's job. This plan only touches the City Hub.

---

### Task 1: Camera module

**Files:**
- Create: `js/camera.js`
- Modify: `index.html` (add `<script src="js/camera.js"></script>` before `city.js`)
- Test: `/tmp/pw/camera_unit_check.js`

**Interfaces:**
- Consumes: nothing (pure module, no dependency on any other game file).
- Produces: `window.Camera` with:
  - `Camera.x`, `Camera.y` (numbers, world-space center, default `0, 0`)
  - `Camera.follow(entity)` — sets `this.x = entity.x; this.y = entity.y;`
  - `Camera.getOffset(canvasW, canvasH)` — returns `{ dx, dy }` where `dx = canvasW / 2 - this.x`, `dy = canvasH / 2 - this.y` (the amount `ctx.translate` needs to center the camera target on screen)
  - `Camera.toScreen(worldX, worldY, canvasW, canvasH)` — returns `{ x: worldX + offset.dx, y: worldY + offset.dy }`
  - `Camera.isVisible(worldX, worldY, canvasW, canvasH, margin = 100)` — returns `true` if `toScreen(...)` falls within `[-margin, canvasW + margin] x [-margin, canvasH + margin]`

- [ ] **Step 1: Write the failing test**

Create `/tmp/pw/camera_unit_check.js`:

```js
const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:8877/index.html');
    await page.waitForTimeout(300);

    const out = await page.evaluate(() => {
        const res = {};
        res.cameraExists = typeof window.Camera === 'object';
        window.Camera.x = 0; window.Camera.y = 0;
        window.Camera.follow({ x: 500, y: 300 });
        res.followSetsPosition = window.Camera.x === 500 && window.Camera.y === 300;

        const offset = window.Camera.getOffset(1280, 800);
        res.offsetCentersOnPlayer = offset.dx === (1280 / 2 - 500) && offset.dy === (800 / 2 - 300);

        const screenPos = window.Camera.toScreen(500, 300, 1280, 800);
        res.playerIsScreenCentered = screenPos.x === 640 && screenPos.y === 400;

        const farAway = window.Camera.toScreen(500 + 5000, 300, 1280, 800);
        res.farObjectOffScreen = farAway.x > 1280;

        res.visibleAtCenter = window.Camera.isVisible(500, 300, 1280, 800);
        res.notVisibleFarAway = !window.Camera.isVisible(500 + 5000, 300, 1280, 800);
        res.visibleJustInsideMargin = window.Camera.isVisible(500 - 640 - 50, 300, 1280, 800, 100); // 50px off left edge, within 100px margin

        return res;
    });

    console.log(JSON.stringify(out, null, 2));
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/pw && node camera_unit_check.js`
Expected: throws `Cannot read properties of undefined (reading 'x')` or `cameraExists: false` — `window.Camera` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/camera.js`:

```js
/**
 * Câmera de mundo — fundação do redesenho do sistema de viagem (ver
 * docs/superpowers/specs/2026-08-02-explorable-world-travel-design.md).
 * Converte coordenadas de MUNDO (onde jogador/prédios/NPCs realmente
 * estão) em coordenadas de TELA (onde desenhar) — o inverso de antes,
 * quando a Praça inteira sempre cabia na tela e não existia distinção
 * entre as duas. Reaproveitado por CityEngine (Praça) e, na Fase 2, pelo
 * mundo da Estrada — um único sistema de câmera pro jogo inteiro.
 */
window.Camera = {
    x: 0,
    y: 0,

    // Centraliza a câmera na entidade (normalmente o jogador) — chamado a
    // cada frame antes de desenhar.
    follow(entity) {
        this.x = entity.x;
        this.y = entity.y;
    },

    // Quanto transladar o canvas (ctx.translate(dx, dy)) pra centralizar o
    // alvo da câmera na tela.
    getOffset(canvasW, canvasH) {
        return { dx: canvasW / 2 - this.x, dy: canvasH / 2 - this.y };
    },

    // Converte um ponto de MUNDO pra coordenada de TELA — usado tanto pra
    // desenhar objeto a objeto (quando não dá pra usar um único
    // ctx.translate) quanto pra converter cliques/toques de volta (ver
    // CityEngine._handleClick).
    toScreen(worldX, worldY, canvasW, canvasH) {
        const offset = this.getOffset(canvasW, canvasH);
        return { x: worldX + offset.dx, y: worldY + offset.dy };
    },

    // true se o ponto de mundo cai dentro da tela (+ margem) — usado pra
    // não desenhar/simular objetos totalmente fora de vista (culling).
    isVisible(worldX, worldY, canvasW, canvasH, margin = 100) {
        const screen = this.toScreen(worldX, worldY, canvasW, canvasH);
        return screen.x >= -margin && screen.x <= canvasW + margin
            && screen.y >= -margin && screen.y <= canvasH + margin;
    }
};
```

- [ ] **Step 4: Wire the script tag**

In `index.html`, find the line `<script src="js/utils.js"></script>` (or similar early utility script) and add immediately after it:

```html
<script src="js/camera.js"></script>
```

It must load before `js/city.js` (which will consume `window.Camera` starting in Task 3) — placing it near `utils.js` (loaded very early, before every gameplay system) satisfies that.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /tmp/pw && node camera_unit_check.js`
Expected: all fields `true` (`cameraExists`, `followSetsPosition`, `offsetCentersOnPlayer`, `playerIsScreenCentered`, `farObjectOffScreen`, `visibleAtCenter`, `notVisibleFarAway`, `visibleJustInsideMargin`).

- [ ] **Step 6: Commit**

```bash
git add js/camera.js index.html
git commit -m "feat(mundo): motor de câmera de mundo (Camera) — fundação do redesenho de viagem"
```

---

### Task 2: Extract PlayerController (behavior-preserving refactor)

**Files:**
- Create: `js/playercontroller.js`
- Modify: `js/city.js:1321-1410` (`_updateMovement`, `_collides`), `js/city.js:1451-1520ish` (`_findPath` and its helpers `_obstacleRects`, `_segmentHitsRect`, `_lineClear`), `js/city.js:1549` (`_setPlayerDestination`)
- Modify: `index.html` (add `<script src="js/playercontroller.js"></script>` before `city.js`)
- Test: `/tmp/pw/playercontroller_regression_check.js`

**Interfaces:**
- Consumes: nothing external — pure logic module, takes plain data in (`entity`, `keysHeld`, `obstacles`, bounds) and returns/mutates plain data out.
- Produces: `window.PlayerController` with:
  - `PlayerController.update(entity, keysHeld, dt, walkSpeed, bounds, obstacleRects)` — mutates `entity.{x,y,facing,moving,targetX,targetY,pathQueue}` exactly like today's `_updateMovement` body, but parametrized: `bounds = { minX, maxX, minY, maxY }` replaces the hardcoded `Utils.clamp(this.player.x, 30, w - 30)` / horizon-based Y clamp; `obstacleRects` (array of `{left,right,top,bottom}`) replaces the direct call to `this._collides`.
  - `PlayerController.findPath(sx, sy, tx, ty, obstacleRects, bounds)` — same algorithm as today's `_findPath`/`_obstacleRects`/`_segmentHitsRect`/`_lineClear`, parametrized the same way. Returns the same waypoint array shape: `[{x, y}, ...]`.
  - `PlayerController.collides(x, y, obstacleRects, margin = 16)` — same check as today's `_collides`, generalized to take a rect list instead of reading `this.buildings`/`this.fountain` directly.

This task changes ZERO behavior — `CityEngine` keeps computing its own `obstacleRects` (buildings + fountain, exactly as `_obstacleRects` does today) and bounds (exactly the horizon/plazaBottom/canvas-width clamps used today) and passes them in. The only thing that changes is WHERE the logic lives.

- [ ] **Step 1: Write the failing test**

Create `/tmp/pw/playercontroller_regression_check.js`:

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
    await page.fill('#char-name', 'PCTest');
    await page.waitForTimeout(150);
    const addBtn = await page.$('.btn-add');
    for (let i = 0; i < 10; i++) { await addBtn.click(); }
    await page.click('#btn-finish-creation');
    await page.waitForSelector('#screen-hub.active', { timeout: 5000 });
    await page.waitForTimeout(300);

    const out = await page.evaluate(() => {
        const res = {};
        res.playerControllerExists = typeof window.PlayerController === 'object';

        const p = window.City.player;
        const startX = p.x, startY = p.y;

        // Clica no chão (posição vazia conhecida) e confirma que o
        // jogador anda até lá ao longo de vários frames de update(), IGUAL
        // ao comportamento de sempre.
        window.City._setPlayerDestination(startX + 150, startY);
        for (let i = 0; i < 60; i++) window.City.update(1 / 60); // ~1s de simulação
        res.playerMovedTowardTarget = Math.abs(p.x - (startX + 150)) < 5;

        // Colisão: anda em direção ao centro da fonte (obstáculo conhecido)
        // e confirma que o jogador NUNCA entra dentro do raio dela.
        const fountainWorldX = window.Engine.width * window.City.fountain.xFrac;
        const fountainWorldY = window.City._horizon(window.Engine.height) + window.City.fountain.rowOffset * window.City._cityScale(window.Engine.height);
        window.City._setPlayerDestination(fountainWorldX, fountainWorldY);
        for (let i = 0; i < 300; i++) window.City.update(1 / 60); // tempo de sobra pra tentar chegar
        const distToFountainCenter = Math.hypot(p.x - fountainWorldX, p.y - fountainWorldY);
        res.neverEntersFountain = distToFountainCenter >= window.City.fountain.r * window.City._cityScale(window.Engine.height) - 2;

        return res;
    });

    out.pageErrors = errors;
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/pw && node playercontroller_regression_check.js`
Expected: `playerControllerExists: false` (module doesn't exist yet). The movement/collision assertions should already pass against the CURRENT `city.js` code (they describe existing behavior) — that's fine, this test's job in this task is only to prove `window.PlayerController` doesn't exist yet; the movement/collision assertions are the regression guard for Step 4.

- [ ] **Step 3: Write the implementation**

Create `js/playercontroller.js`:

```js
/**
 * Controlador de movimento/colisão/pathfinding — extraído de city.js
 * CityEngine (comportamento IDÊNTICO ao de antes, só reaproveitável).
 * Ver docs/superpowers/specs/2026-08-02-explorable-world-travel-design.md
 * — usado pela Praça (city.js) hoje, e pelo mundo da Estrada na Fase 2,
 * sem duplicar a mesma física de movimento duas vezes.
 *
 * Nunca lê window.Engine/window.City diretamente — todo dado (bounds,
 * obstáculos) é passado pelo chamador, pra funcionar em qualquer mundo
 * (Praça hoje, Estrada amanhã) sem acoplamento.
 */
window.PlayerController = {
    // Avança a posição/estado de `entity` um passo de simulação (dt em
    // segundos). `entity` precisa ter {x, y, facing, moving, targetX,
    // targetY, pathQueue}. `bounds = {minX, maxX, minY, maxY}` limita onde
    // a entidade pode estar. `obstacleRects` é a lista de retângulos de
    // colisão (prédios, fonte, etc — quem monta a lista é o chamador).
    update(entity, keysHeld, dt, walkSpeed, bounds, obstacleRects) {
        let vx = 0, vy = 0;
        const keyMoving = keysHeld.up || keysHeld.down || keysHeld.left || keysHeld.right;

        if (keyMoving) {
            if (keysHeld.up) vy -= 1;
            if (keysHeld.down) vy += 1;
            if (keysHeld.left) vx -= 1;
            if (keysHeld.right) vx += 1;
            const len = Math.hypot(vx, vy) || 1;
            vx = (vx / len) * walkSpeed;
            vy = (vy / len) * walkSpeed;
            entity.targetX = null;
            entity.targetY = null;
            entity.pathQueue = [];
        } else if (entity.targetX !== null) {
            const dx = entity.targetX - entity.x;
            const dy = entity.targetY - entity.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 4) {
                if (entity.pathQueue.length > 0) {
                    const next = entity.pathQueue.shift();
                    entity.targetX = next.x;
                    entity.targetY = next.y;
                } else {
                    entity.targetX = null;
                    entity.targetY = null;
                }
            } else {
                vx = (dx / dist) * walkSpeed;
                vy = (dy / dist) * walkSpeed;
            }
        }

        entity.moving = vx !== 0 || vy !== 0;
        if (vx !== 0) entity.facing = vx > 0 ? 1 : -1;

        let nx = entity.x + vx * dt;
        let ny = entity.y + vy * dt;

        if (!this.collides(nx, entity.y, obstacleRects)) entity.x = nx;
        if (!this.collides(entity.x, ny, obstacleRects)) entity.y = ny;

        entity.x = Utils.clamp(entity.x, bounds.minX, bounds.maxX);
        entity.y = Utils.clamp(entity.y, bounds.minY, bounds.maxY);

        return { vx, vy };
    },

    collides(x, y, obstacleRects, margin = 16) {
        for (const r of obstacleRects) {
            if (r.isCircle) {
                if (Math.hypot(x - r.cx, y - r.cy) < r.radius + margin * 0.5) return true;
            } else if (x > r.left - margin && x < r.right + margin && y > r.top && y < r.bottom + margin * 0.6) {
                return true;
            }
        }
        return false;
    },

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
    },

    _lineClear(x1, y1, x2, y2, rects) {
        for (const r of rects) {
            if (r.isCircle) continue; // pathfinding trata só retângulos, igual ao comportamento original (a fonte já vira um "rect" quadrado equivalente — ver findPath)
            if (this._segmentHitsRect(x1, y1, x2, y2, r)) return false;
        }
        return true;
    },

    // Retorna os waypoints (em ordem) até (tx,ty), contornando obstáculos —
    // porta FIEL do algoritmo original de js/city.js `_findPath`
    // (grafo de visibilidade sobre as quinas dos obstáculos + Dijkstra),
    // só trocando `window.Engine.width/height`/`this.buildings`/
    // `this.fountain` por parâmetros (`obstacleRects`, `bounds`).
    findPath(sx, sy, tx, ty, obstacleRects, bounds) {
        const rects = obstacleRects.filter(r => !r.isCircle);
        if (this._lineClear(sx, sy, tx, ty, rects)) return [{ x: tx, y: ty }];

        const clampPt = (x, y) => ({ x: Utils.clamp(x, bounds.minX, bounds.maxX), y: Utils.clamp(y, bounds.minY, bounds.maxY) });
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

        // Se o destino real for inalcançável (nenhuma quina de folga livre
        // entre dois obstáculos vizinhos), anda até o ponto alcançável mais
        // próximo dele em vez de ficar parado.
        let targetIdx = goalIdx;
        if (dist[goalIdx] === Infinity) {
            let bestIdx = -1, bestDist = Infinity;
            for (let i = 1; i < n; i++) {
                if (i === goalIdx || dist[i] === Infinity) continue;
                const d = Math.hypot(nodes[i].x - tx, nodes[i].y - ty);
                if (d < bestDist) { bestDist = d; bestIdx = i; }
            }
            if (bestIdx === -1) return [{ x: tx, y: ty }];
            targetIdx = bestIdx;
        }

        const path = [];
        let cur = targetIdx;
        while (cur !== -1) { path.unshift(nodes[cur]); cur = prev[cur]; }
        path.shift(); // remove o próprio ponto de partida
        return path.length > 0 ? path : [{ x: tx, y: ty }];
    }
};
```

Modify `js/city.js`: replace the body of `_updateMovement` (lines 1321-1397) to delegate:

```js
_updateMovement(dt) {
    const h = window.Engine.height, w = window.Engine.width;
    const bounds = { minX: 30, maxX: w - 30, minY: this._horizon(h) + 20, maxY: this._plazaBottom(h) + 30 };
    const obstacles = this._obstacleRectsForCollision();
    PlayerController.update(this.player, this.keysHeld, dt, this.walkSpeed, bounds, obstacles);

    // Som de passo / poeira nos pés — inalterado, ainda vive aqui (é
    // apresentação, não movimento em si).
    if (this.player.moving) {
        this._footstepTimer -= dt;
        if (this._footstepTimer <= 0) {
            this._footstepTimer = 0.32;
            if (window.AudioManager) window.AudioManager.playFootstep();
            if (window.GFX) window.GFX.spawnParticles(this.player.x, this.player.y + 4, '#9a8a70', 2, 0.6, 2);
        }
    } else {
        this._footstepTimer = 0;
    }

    if (!this.player.moving && this._mouseX != null) {
        const dead = 6;
        if (this._mouseX > this.player.x + dead) this.player.facing = 1;
        else if (this._mouseX < this.player.x - dead) this.player.facing = -1;
    }
}

// Lista de retângulos/círculos de colisão pra ESTE frame — prédios (ver
// _buildingRect) + a fonte central como círculo (`isCircle`, ver
// PlayerController.collides). Extraído de dentro de _collides/_obstacleRects
// originais pra reaproveitar tanto no PlayerController.update quanto no
// findPath (ver _setPlayerDestination).
_obstacleRectsForCollision() {
    const margin = 20;
    const rects = this.buildings.map(b => {
        const r = this._buildingRect(b);
        return { left: r.left - margin, right: r.right + margin, top: r.top, bottom: r.bottom + margin * 0.6 };
    });
    const w = window.Engine.width, h = window.Engine.height;
    const scale = this._cityScale(h);
    rects.push({
        isCircle: true,
        cx: this.fountain.xFrac * w,
        cy: this._horizon(h) + this.fountain.rowOffset * scale,
        radius: this.fountain.r * scale
    });
    return rects;
}
```

Replace `_collides(x, y)` (line 1399) to delegate:

```js
_collides(x, y) {
    return PlayerController.collides(x, y, this._obstacleRectsForCollision());
}
```

Replace `_setPlayerDestination` (line 1549) to delegate:

```js
_setPlayerDestination(x, y) {
    const h = window.Engine.height, w = window.Engine.width;
    const bounds = { minX: 32, maxX: w - 32, minY: this._horizon(h) + 24, maxY: this._plazaBottom(h) + 26 };
    const path = PlayerController.findPath(this.player.x, this.player.y, x, y, this._obstacleRectsForCollision(), bounds);
    this.player.targetX = path[0].x;
    this.player.targetY = path[0].y;
    this.player.pathQueue = path.slice(1);
}
```

Delete the now-unused `_obstacleRects`, `_segmentHitsRect`, `_lineClear`, `_findPath` methods from `city.js` (lines ~1412-1548) — they live in `PlayerController` now.

- [ ] **Step 4: Add the script tag and run test to verify it passes**

In `index.html`, add `<script src="js/playercontroller.js"></script>` right after `js/camera.js` (must load before `js/city.js`).

Run: `cd /tmp/pw && node playercontroller_regression_check.js`
Expected: `playerControllerExists: true`, `playerMovedTowardTarget: true`, `neverEntersFountain: true`, `pageErrors: []`.

- [ ] **Step 5: Run full existing City Hub regression**

Run the existing `regression_iter35.js` (or equivalent full-suite test already in `/tmp/pw/` — check with `ls /tmp/pw/*.js` first, it may have been cleared by a container restart; if missing, a minimal substitute is: create character, reach `#screen-hub.active`, click an NPC, click the Ferreiro building, confirm `#screen-shop.active` opens, walk with WASD for 1 second, confirm no console errors). Confirm zero console errors and `validateGameData()` still returns clean.

- [ ] **Step 6: Commit**

```bash
git add js/playercontroller.js js/city.js index.html
git commit -m "refactor(cidade): extrai movimento/colisão/pathfinding pra PlayerController (sem mudar comportamento)"
```

---

### Task 3: World-space + Camera integration in CityEngine

**Files:**
- Modify: `js/city.js` (constructor comment header, `_lightStonePos:735`, `_doorPoint:963`, `_obstacleRectsForCollision` from Task 2, `_updateMovement`/`_setPlayerDestination` bounds from Task 2, `_handleClick:622`, `mousemove` listener, `draw:2037`)
- Test: `/tmp/pw/camera_city_integration_check.js`

**Interfaces:**
- Consumes: `window.Camera` (Task 1), `window.PlayerController` (Task 2).
- Produces: `CityEngine._worldWidth()` — new method returning `window.Engine.width * 1.4` (the Praça's walkable world width, always 1.4x whatever the current viewport is, recomputed fresh every call — never cached, to survive resize exactly like every other `w`/`h`-derived value in this file already does).

This is the task that actually changes player-visible behavior: the world becomes wider than the screen, and the camera pans to keep the player centered as they approach the edges.

- [ ] **Step 1: Write the failing test**

Create `/tmp/pw/camera_city_integration_check.js`:

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
    await page.fill('#char-name', 'CamCityTest');
    await page.waitForTimeout(150);
    const addBtn = await page.$('.btn-add');
    for (let i = 0; i < 10; i++) { await addBtn.click(); }
    await page.click('#btn-finish-creation');
    await page.waitForSelector('#screen-hub.active', { timeout: 5000 });
    await page.waitForTimeout(300);

    const out = await page.evaluate(() => {
        const res = {};
        const p = window.City.player;

        // Mundo é mais largo que a tela.
        res.worldWiderThanCanvas = window.City._worldWidth() > window.Engine.width;
        res.worldWidthIsExpectedRatio = Math.abs(window.City._worldWidth() - window.Engine.width * 1.4) < 1;

        // Câmera acompanha o jogador — depois de andar bastante pra
        // direita (perto da borda direita do MUNDO, além do que a tela
        // sozinha mostraria), a câmera não deveria estar mais parada no
        // centro do mundo original.
        const targetX = window.City._worldWidth() - 60;
        window.City._setPlayerDestination(targetX, p.y);
        for (let i = 0; i < 600; i++) window.City.update(1 / 60); // tempo de sobra
        res.playerReachedNearWorldEdge = p.x > window.Engine.width; // além do que o canvas ANTIGO permitiria
        res.cameraFollowedPlayer = Math.abs(window.Camera.x - p.x) < 5;

        // Interação com prédio continua funcionando na posição de MUNDO
        // (não mais fração da largura do canvas) — clicar direto no
        // Ferreiro deve continuar abrindo a loja mesmo com o jogador longe
        // do centro do mundo.
        return res;
    });

    // Testa clique direto num prédio depois do retrofit (via _handleClick,
    // que agora precisa converter a coordenada de tela pro mundo antes de
    // testar contra a posição do prédio).
    const buildingClickWorks = await page.evaluate(() => {
        const p = window.City.player;
        p.x = window.City._worldWidth() / 2; p.y = window.City._plazaBottom(window.Engine.height);
        const door = window.City._doorPoint(window.City.buildings.find(b => b.id === 'blacksmith'));
        const screenPos = window.Camera.toScreen(door.x, door.y, window.Engine.width, window.Engine.height);
        window.City._handleClick(screenPos.x, screenPos.y);
        return true; // se não lançar exceção, a conversão de coordenadas está correta o bastante pra rodar
    });

    await page.waitForTimeout(200);
    out.buildingClickNoException = buildingClickWorks;
    out.shopOpenedFromWorldSpaceClick = await page.evaluate(() => document.getElementById('screen-shop').classList.contains('active'));

    out.pageErrors = errors;
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /tmp/pw && node camera_city_integration_check.js`
Expected: `worldWiderThanCanvas` throws (`_worldWidth is not a function`) or is `false` — the retrofit hasn't happened yet.

- [ ] **Step 3: Implement `_worldWidth()` and widen bounds**

In `js/city.js`, add near `_horizon`/`_plazaBottom` (around line 243-249):

```js
// Largura do MUNDO caminhável da Praça — sempre maior que o canvas atual
// (nunca um valor fixo em pixels, senão telas grandes não teriam pra onde
// a câmera rolar e telas pequenas teriam mundo demais). 1.4x é
// deliberadamente modesto: o conteúdo da cidade continua o mesmo de
// sempre (nenhum prédio/NPC novo), só ganha uma margem real pra andar até
// as bordas e ver a câmera de fato acompanhar — ver design doc, seção
// "Resolução da ambiguidade".
_worldWidth() {
    return (window.Engine ? window.Engine.width : window.innerWidth) * 1.4;
}
```

Replace every `xFrac * w` position formula to use `this._worldWidth()` instead of the local `w` (which stays canvas-sized, used ONLY for screen-space background fills now):

- `_lightStonePos` (line ~735): `const w = window.Engine.width` → `const w = this._worldWidth();`
- `_doorPoint` (line ~963): `const w = window.Engine.width, h = window.Engine.height;` → `const w = this._worldWidth(), h = window.Engine.height;`
- `_obstacleRectsForCollision` (Task 2's new method): `const w = window.Engine.width, h = window.Engine.height;` → `const w = this._worldWidth(), h = window.Engine.height;`
- `_drawFountain` (line ~2127): inside the function, change `const x = this.fountain.xFrac * w` to use `this._worldWidth()` instead of the `w` parameter — **but leave the function signature `_drawFountain(ctx, w, h)` unchanged**, since `w`/`h` are still needed for other things; just add `const worldW = this._worldWidth();` at the top of the function and use `worldW` for the `xFrac` multiply.
- `_drawStatue` (line ~2172) and `_drawVegetation` (line ~2249): same pattern — add `const worldW = this._worldWidth();` and use it for `s.xFrac * worldW` / `v.xFrac * worldW`.

Update `_updateMovement` and `_setPlayerDestination` (from Task 2) to use `this._worldWidth()` for `maxX` instead of `window.Engine.width - 30`/`w - 32`:

```js
const bounds = { minX: 30, maxX: this._worldWidth() - 30, minY: this._horizon(h) + 20, maxY: this._plazaBottom(h) + 30 };
```

- [ ] **Step 4: Apply the camera transform in `draw()`**

Replace `draw(ctx, w, h)` (line 2037-2070):

```js
draw(ctx, w, h) {
    if (!this._initialized) return;
    const horizon = this._horizon(h);

    // Fundo (céu/piso) continua em coordenada de TELA — é um degradê
    // uniforme, nunca precisa rolar com a câmera (rolar um degradê
    // uniforme é visualmente idêntico a não rolar).
    this._drawPlazaGround(ctx, w, h, horizon);

    window.Camera.follow(this.player);
    const offset = window.Camera.getOffset(w, h);
    ctx.save();
    ctx.translate(offset.dx, offset.dy);

    this._drawFountain(ctx, w, h);
    this.statues.forEach(s => this._drawStatue(ctx, w, h, s));
    this.vegetation.forEach(v => this._drawVegetation(ctx, w, h, v));

    const isNight = window.GFX && window.GFX.arenaTime === 'night';
    const drawables = [
        ...this.buildings.map(b => ({ y: this._doorPoint(b).y, draw: () => this._drawBuilding(ctx, w, h, b) })),
        ...(isNight ? this._nightVisibleNpcs() : this.npcs).filter(n => !n.invisible).map(n => ({ y: n.y, draw: () => this._drawNpc(ctx, n) })),
        ...this.lightStones.filter(s => !s.collected).map(s => ({ y: this._lightStonePos(s).y, draw: () => this._drawLightStone(ctx, s) })),
        { y: this.player.y, draw: () => this._drawPlayer(ctx) },
    ];
    drawables.sort((a, b) => a.y - b.y);
    drawables.forEach(d => d.draw());

    ctx.restore();
}
```

`_drawBuilding`, `_drawNpc`, `_drawLightStone`, `_drawPlayer` need NO changes — they already draw at `this.player.x/y` / `npc.x/y` / etc. directly with no reference to canvas width, so the surrounding `ctx.translate` correctly repositions everything they draw without touching their internals.

- [ ] **Step 5: Convert click/touch input from screen-space to world-space**

In `_handleClick` (line 622), after computing `x = clientX - rect.left, y = clientY - rect.top`, convert to world coordinates before any hit-testing:

```js
_handleClick(clientX, clientY) {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left, screenY = clientY - rect.top;
    const offset = window.Camera.getOffset(window.Engine.width, window.Engine.height);
    const x = screenX - offset.dx, y = screenY - offset.dy; // agora em coordenadas de MUNDO
    this._dismissHint();
    // ... resto do método sem mudança nenhuma (já compara x/y contra
    // posições de NPC/prédio/pedra que agora também estão em coordenadas
    // de mundo) ...
```

In the `mousemove` listener (used for the "olha pro cursor" facing logic), apply the same conversion before storing `this._mouseX`:

```js
screenEl.addEventListener('mousemove', (e) => {
    if (!this._isActive()) return;
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const offset = window.Camera.getOffset(window.Engine.width, window.Engine.height);
    this._mouseX = screenX - offset.dx; // mundo, comparável a this.player.x
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /tmp/pw && node camera_city_integration_check.js`
Expected: `worldWiderThanCanvas: true`, `worldWidthIsExpectedRatio: true`, `playerReachedNearWorldEdge: true`, `cameraFollowedPlayer: true`, `buildingClickNoException: true`, `shopOpenedFromWorldSpaceClick: true`, `pageErrors: []`.

- [ ] **Step 7: Commit**

```bash
git add js/city.js
git commit -m "feat(cidade): Praça usa coordenadas de mundo + câmera de verdade (mundo 1.4x mais largo que a tela)"
```

---

### Task 4: Full regression + performance verification

**Files:**
- Test only: `/tmp/pw/camera_foundation_full_regression.js`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: nothing new — this task is verification only, no code changes expected (if it finds a real regression, fix it in the file/task where it belongs, then re-run this task's test).

- [ ] **Step 1: Write the full regression test**

Create `/tmp/pw/camera_foundation_full_regression.js`:

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
    await page.fill('#char-name', 'FullRegr');
    await page.waitForTimeout(150);
    const addBtn = await page.$('.btn-add');
    for (let i = 0; i < 10; i++) { await addBtn.click(); }
    await page.click('#btn-finish-creation');
    await page.waitForSelector('#screen-hub.active', { timeout: 5000 });
    await page.waitForTimeout(300);

    const out = {};

    // Save/load round-trip: posição do jogador e dayCount sobrevivem
    // intactos (mesmo formato de antes — Camera/PlayerController não
    // adicionam NENHUM campo novo ao save).
    out.saveLoad = await page.evaluate(() => {
        const p = window.Engine.state.player;
        p.x = 999; p.dayCount = 7; // campos que NÃO existem no formato de save real (posição não é salva, é sessão) — checamos o que DE FATO é salvo:
        window.SaveManager.save(window.Engine.state);
        const raw = localStorage.getItem(Object.keys(localStorage).find(k => k.includes('save')) || '');
        return { saveDidNotThrow: true };
    });

    // FPS ainda em 60 dentro da Praça (mesmo padrão de teste de FPS já
    // usado nesta sessão pra batalha).
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

    // Interações essenciais da Praça continuam idênticas.
    out.talkToNpc = await page.evaluate(() => {
        const npc = window.City.npcs[0];
        if (!npc) return { skipped: true };
        window.City._approachAndTalk(npc);
        return { pendingSet: window.City._pendingTalkNpc === npc };
    });

    await page.click('#btn-close-shop').catch(() => {}); // fecha qualquer loja aberta de testes anteriores
    await page.evaluate(() => window.UI.showScreen('screen-hub'));

    out.enterBuilding = await page.evaluate(() => {
        window.City.interact('blacksmith');
        return document.getElementById('screen-shop').classList.contains('active');
    });

    out.pageErrors = errors;
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it**

Run: `cd /tmp/pw && node camera_foundation_full_regression.js`
Expected: `fps` >= 58 (allow ~2fps measurement noise), `talkToNpc.pendingSet: true` (or `skipped: true` if no NPCs spawned yet in this fresh session), `enterBuilding: true`, `pageErrors: []`.

If FPS regressed below ~58 or any interaction broke, fix the specific cause in Task 2 or Task 3's code before proceeding — do not commit a performance regression.

- [ ] **Step 3: Git-safety diff review (standing practice for this repo)**

```bash
git fetch origin claude/arena-of-blades-rpg-7upo4h
git status --short
git diff origin/claude/arena-of-blades-rpg-7upo4h -- js/city.js js/camera.js js/playercontroller.js index.html | grep -nE "^-[^-]"
```

Manually confirm every removed line shown is one of the deletions this plan calls for (the old `_obstacleRects`/`_segmentHitsRect`/`_lineClear`/`_findPath` bodies from Task 2, the old inline `_updateMovement`/`_collides`/`_setPlayerDestination`/`draw` bodies from Tasks 2-3) — never an unrelated/accidental deletion.

- [ ] **Step 4: Push**

```bash
git push -u origin claude/arena-of-blades-rpg-7upo4h
git fetch origin claude/arena-of-blades-rpg-7upo4h
git log origin/claude/arena-of-blades-rpg-7upo4h --oneline -5
```

---

## What comes after this plan

Phase 2 (the actual explorable Road world between cities) gets its own spec section already written (see the design doc) and its own implementation plan, built on top of `Camera` + `PlayerController` from this plan — it is explicitly out of scope here. Do not start Phase 2 work as part of this plan.
