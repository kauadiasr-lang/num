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
    // a entidade pode estar. `obstacleRects` é a lista de retângulos/
    // círculos de colisão (quem monta a lista é o chamador).
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
        // O algoritmo de grafo de visibilidade só entende retângulos —
        // círculos (ver PlayerController.collides) viram um quadrado
        // equivalente que os contém (bounding box), igual à aproximação já
        // usada pela fonte central em js/city.js _obstacleRects original.
        // NUNCA descartar um círculo aqui (só tratá-lo como retângulo pra
        // este cálculo): descartar faria o "linha reta livre" abaixo achar
        // um caminho reto atravessando o obstáculo circular por inteiro.
        const rects = obstacleRects.map(r => r.isCircle
            ? { left: r.cx - r.radius, right: r.cx + r.radius, top: r.cy - r.radius, bottom: r.cy + r.radius }
            : r);
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
