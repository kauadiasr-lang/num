/**
 * Pipeline de Sprites/Atlas/RenderManager — infraestrutura da migração
 * gráfica de "formas geométricas desenhadas toda hora" para "sprites
 * bakeados uma vez e reutilizados" (ver assets/README.md para a visão
 * geral e a convenção de pastas/nomes).
 *
 * Generaliza um padrão que já existia isolado em graphics.js
 * (`_buildArenaGroundTexture`, que já desenhava o chão da arena UMA VEZ
 * num `<canvas>` offscreen e reaproveitava via drawImage todo frame) —
 * aqui isso vira uma API reutilizável por QUALQUER parte do renderizador
 * (personagens, inimigos, prédios, ícones...), em vez de cada sistema
 * reinventar seu próprio cache ad-hoc.
 *
 * Este arquivo é 100% aditivo: não altera nenhuma regra de jogo (combate,
 * IA, save, economia, progressão). Só decide COMO os pixels chegam na
 * tela, nunca O QUE acontece na simulação.
 */

// Ações de animação reservadas pelo pipeline de sprites (ver
// assets/README.md "Spritesheets de animação"). Espelha os `anim.type`
// que `computePose` (graphics.js) já sabe interpretar; algumas (Heavy
// Attack, Critical, Equip, Unequip) ainda não têm uma pose procedural
// distinta hoje — ficam reservadas aqui pra quando uma spritesheet real
// justificar diferenciá-las, sem exigir nenhuma mudança de gameplay.
const ANIMATION_TYPES = {
    IDLE: 'idle', WALK: 'walk', RUN: 'run', ATTACK: 'attack', HEAVY_ATTACK: 'heavy_attack',
    HIT: 'hurt', BLOCK: 'block', DODGE: 'dodge', CRITICAL: 'critical', DEATH: 'death',
    VICTORY: 'victory', CAST: 'cast', CHARGE: 'charge', EQUIP: 'equip', UNEQUIP: 'unequip',
    // Defender (item 8 da auditoria de balanceamento) — ver graphics.js
    // computePose 'defend': gesto breve de recolhimento ao assumir a
    // postura defensiva, distinto do `pose.guard` contínuo (braço do
    // escudo erguido durante todo o turno).
    DEFEND: 'defend'
};

// ==========================================================================
// SpriteCache — "bake uma vez, reutiliza sempre". Dado um `key` (assinatura
// visual: cor + equipamento + arquétipo + raça + o que mais influenciar os
// PIXELS, nunca a pose/animação do frame atual) e uma função de desenho,
// devolve um <canvas> offscreen já pronto — na primeira chamada desenha de
// verdade (reaproveitando o código procedural existente), nas seguintes só
// devolve o bitmap já pronto do cache.
// ==========================================================================
const SpriteCache = {
    _cache: new Map(),
    _maxEntries: 400, // teto generoso; cada personagem/inimigo só gera um punhado de combinações reais

    // `drawFn(ctx, w, h)` desenha no canvas offscreen (já com w/h definidos);
    // deve desenhar com origem (0,0) no canto superior-esquerdo do bitmap —
    // quem chama `get` é responsável por saber o offset de ancoragem ao
    // usar `drawImage` depois (ver `RenderManager.blit`).
    get(key, w, h, drawFn) {
        let entry = this._cache.get(key);
        if (entry && entry.w === w && entry.h === h) {
            // Reordena pra fim do Map (aproxima LRU: Map preserva ordem de inserção)
            this._cache.delete(key);
            this._cache.set(key, entry);
            return entry.canvas;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(w));
        canvas.height = Math.max(1, Math.ceil(h));
        const ctx = canvas.getContext('2d');
        drawFn(ctx, canvas.width, canvas.height);
        entry = { canvas, w, h };
        this._cache.set(key, entry);
        this._evictIfNeeded();
        return canvas;
    },

    _evictIfNeeded() {
        while (this._cache.size > this._maxEntries) {
            const oldestKey = this._cache.keys().next().value;
            this._cache.delete(oldestKey);
        }
    },

    // Descarta tudo (ex.: troca de configurações que afetam cor/qualidade
    // visual global) — nunca chamado automaticamente hoje, só disponível
    // pra uso futuro.
    clear() { this._cache.clear(); },

    size() { return this._cache.size; }
};

// ==========================================================================
// AssetLoader — tenta carregar um PNG real de assets/<categoria>/<id>.png;
// se não existir (404, o caso de hoje pra tudo), falha em silêncio e quem
// pediu o asset continua usando o placeholder procedural via SpriteCache.
// Nunca bloqueia o boot do jogo nem lança erro pro resto do código.
// ==========================================================================
const AssetLoader = {
    _images: new Map(), // path -> HTMLImageElement (só entra depois de confirmado carregado)
    _pending: new Map(), // path -> Promise

    // Caminho canônico de um asset, a partir da categoria (pasta) e do id
    // (ver assets/README.md, tabela de convenção de nomes).
    pathFor(category, id) {
        return `assets/${category}/${id}.png`;
    },

    // Devolve a imagem SE já estiver carregada (uso síncrono em loops de
    // desenho); nunca dispara o carregamento sozinho — chame `preload`
    // antes, tipicamente no boot do jogo, se/quando existir arte real.
    getIfLoaded(category, id) {
        return this._images.get(this.pathFor(category, id)) || null;
    },

    // Carrega uma lista de {category, id} em paralelo, sem travar nada:
    // cada uma resolve (sucesso) ou é ignorada (404/erro) independentemente.
    preload(list) {
        const promises = list.map(({ category, id }) => this._loadOne(this.pathFor(category, id)));
        return Promise.all(promises);
    },

    _loadOne(path) {
        if (this._images.has(path)) return Promise.resolve(this._images.get(path));
        if (this._pending.has(path)) return this._pending.get(path);
        const promise = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this._images.set(path, img); resolve(img); };
            img.onerror = () => { resolve(null); }; // asset ainda não existe — placeholder procedural continua valendo
            img.src = path;
        });
        this._pending.set(path, promise);
        return promise;
    }
};

// ==========================================================================
// RenderManager — coordenação central de camadas/desenho. Hoje é
// deliberadamente fino (um helper de blit + nomes de camada padronizados)
// porque `GraphicsEngine.draw()` (graphics.js) já desenha na ordem certa de
// profundidade; centralizar aqui documenta essa ordem num só lugar e dá um
// ponto único pra crescer (iluminação/partículas globais) sem espalhar mais
// lógica gráfica pelo resto do projeto.
// ==========================================================================
const RenderManager = {
    // Ordem canônica de profundidade — mesma ordem que o código de desenho
    // já segue hoje (fundo primeiro, HUD/UI por último). Puramente
    // documental por enquanto: nenhum código itera esta lista ainda, mas
    // qualquer novo passo de desenho (ex.: uma camada de iluminação global)
    // deve se encaixar nela.
    LAYERS: ['background', 'midground', 'backdrop_props', 'foreground', 'characters', 'projectiles', 'particles', 'lighting', 'ui'],

    // Desenha um bitmap já bakeado (ver SpriteCache) centralizado
    // horizontalmente em (x,y), com o topo do bitmap em `y - anchorY`
    // (padrão: ancorado pela base, como os personagens já são desenhados
    // em graphics.js — origem no "chão" do personagem).
    blit(ctx, canvas, x, y, anchorX = canvas.width / 2, anchorY = canvas.height) {
        ctx.drawImage(canvas, x - anchorX, y - anchorY);
    }
};

window.ANIMATION_TYPES = ANIMATION_TYPES;
window.SpriteCache = SpriteCache;
window.AssetLoader = AssetLoader;
window.RenderManager = RenderManager;
