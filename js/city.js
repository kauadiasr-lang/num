/**
 * Cidade Explorável (novo Hub) — Arena of Blades
 *
 * Substitui o antigo menu de botões por uma praça greco-romana onde o
 * jogador anda de verdade (clique/toque para mover, ou WASD/setas) e entra
 * em cada prédio pra acessar as telas que já existiam (Mercado, Talentos,
 * Curandeiro, Ladder, etc) — nenhuma dessas telas foi reescrita, só ganharam
 * uma "porta física" no mapa em vez de um botão.
 *
 * Arquitetura (atualizada — ver docs/superpowers/specs/2026-08-02-
 * explorable-world-travel-design.md, Fase 1): o mundo da Praça é mais
 * largo que a tela (ver _worldWidth) e a câmera (window.Camera, ver
 * js/camera.js) acompanha o jogador de verdade — antes a praça inteira
 * sempre cabia na tela (posições em fração da largura), o que nunca dava
 * espaço nenhum pra uma câmera existir. O CONTEÚDO da cidade não mudou em
 * nada (nenhum prédio/NPC novo) — só o mundo ficou fisicamente maior ao
 * redor do mesmo conteúdo de sempre, e o desenho passou a rodar através
 * de um único ctx.translate (ver draw()) em vez de posições fixas de
 * tela. Movimento/colisão/pathfinding vivem em js/playercontroller.js
 * (extraído, reaproveitado também pelo mundo da Estrada na Fase 2). O
 * céu, o coliseu ao fundo, a plateia, tochas e pássaros continuam
 * reaproveitados de GraphicsEngine (fundo em coordenada de TELA, nunca
 * rola com a câmera — é um degradê uniforme, sempre visualmente idêntico
 * independente de onde a câmera estiver) — a cidade "mora" bem em frente
 * ao próprio coliseu.
 */
class CityEngine {
    constructor() {
        // Posição do jogador em pixels de tela (não fração — precisa de uma
        // velocidade de caminhada consistente independente da resolução).
        this.player = { x: 0, y: 0, vx: 0, vy: 0, targetX: null, targetY: null, facing: 1, moving: false, pathQueue: [] };
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

        // Bandido Anão (ver _eventDwarfBandit/_makeBandit/_banditEncounter)
        // — perigo urbano físico, MESMO padrão do Mercador Viajante acima
        // (nasce como NPC de verdade na praça, some sozinho se ignorado,
        // só um por vez). Só em cidades com `hasBandits` (ver
        // citydatabase.js reino_anao) — nenhuma das 3 cidades antigas tem
        // esse campo, então continuam sem nenhum bandido, como sempre.
        this.bandit = null;

        // Mineiro Preso (ver _eventTrappedMiner/_makeTrappedMiner) —
        // contraponto POSITIVO ao bandido, MESMO padrão de spawn físico
        // único (nasce na praça, some sozinho se ignorado). Só em cidades
        // com `hasOreVeins` (hoje só o Reino Anão) — nenhuma cidade antiga
        // ganha esse campo, então continuam sem nenhum mineiro preso.
        this.trappedMiner = null;

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
        // Snapshot dos valores ORIGINAIS de name/icon/wall/roof — nunca
        // mutado depois disso. `_syncBuildingsToCity` (ver abaixo) sempre
        // deriva `this.buildings` A PARTIR deste snapshot + do override da
        // cidade atual (ver citydatabase.js `buildingNames`/`buildingIcons`/
        // `buildingColors`, usado pela primeira vez pelo Reino Anão), nunca
        // mutando os objetos em cima uns dos outros — assim viajar de volta
        // a uma cidade sem override (ex: Porto Helênico) sempre restaura os
        // valores de sempre, em vez de herdar sobras da cidade anterior.
        // Posição/tamanho/id (xFrac, rowOffset, w, h, row) NUNCA mudam por
        // cidade — só a pele (nome/ícone/cor) é reskinável; a colisão e o
        // layout físico da Praça continuam sendo os mesmos 9 prédios em
        // todo lugar, exatamente como documentado em citydatabase.js.
        this._defaultBuildings = this.buildings.map(b => ({ ...b }));

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

        // Veios de Minério (Reino Subterrâneo de Kharzum, ver
        // citydatabase.js `hasOreVeins`/items.js ItemDatabase.materials) —
        // MESMO padrão físico de coleta que as Pedras de Luz acima
        // (aproximação + clique, ver _approachAndCollectOre/
        // _updatePendingCollectOre abaixo), reaproveitado em vez de
        // duplicado. Diferem em UMA coisa: nenhuma condição de
        // elegibilidade (qualquer jogador pode minerar, sempre — a Pedra
        // de Luz exige ausência de Linhagem/ritual incompleto) e cada veio
        // sorteia seu próprio `tier` (1-5) ao nascer/renascer, não um
        // recurso fixo único (ver _rollOreTier). Só existem em cidades que
        // declararem `hasOreVeins: true` (ver _spawnOreVeinsIfNeeded) —
        // nenhuma das 3 cidades antigas tem esse campo, então continuam
        // sem nenhum veio, como sempre.
        this.oreVeinSpots = [
            { xFrac: 0.12, rowOffset: 145 },
            { xFrac: 0.88, rowOffset: 145 },
            { xFrac: 0.5, rowOffset: 205 },
        ];
        this.oreVeins = [];
        this._pendingCollectOre = null;

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
        // Sempre recomputado (nunca só na primeira vez): cobre tanto um jogo
        // novo quanto um save CARREGADO direto numa cidade com reskin (ex:
        // reabrir a página com um Anão salvo no Reino de Kharzum) — sem
        // isso, `this.buildings` ficaria travado nos valores padrão até a
        // primeira viagem de verdade.
        this._syncBuildingsToCity();
        this._spawnNpcsIfNeeded();
        this._spawnLightStonesIfNeeded();
        this._spawnOreVeinsIfNeeded();
        if (window.AudioManager) window.AudioManager.startCityAmbience();
        this._interactPromptEl = document.getElementById('city-interact-prompt');
        this._hintEl = document.getElementById('city-hint');
    }

    // Deriva `this.buildings` a partir de `_defaultBuildings` (imutável) +
    // do override opcional da cidade atual (ver citydatabase.js
    // `buildingNames`/`buildingIcons`/`buildingColors`) — só troca a PELE
    // (nome/ícone/cor da parede/telhado) de cada prédio, nunca a posição/
    // tamanho/colisão (`xFrac`/`rowOffset`/`w`/`h`/`row` sempre vêm do
    // default, intocados). Chamado em toda entrada na Cidade (onEnterCity)
    // e ao concluir uma viagem (travelToCity) — os dois únicos pontos em
    // que "qual é a cidade atual" pode ter mudado.
    _syncBuildingsToCity() {
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const names = (cityDef && cityDef.buildingNames) || {};
        const icons = (cityDef && cityDef.buildingIcons) || {};
        const colors = (cityDef && cityDef.buildingColors) || {};
        this.buildings = this._defaultBuildings.map(def => {
            const b = { ...def };
            if (names[b.id]) b.name = names[b.id];
            if (icons[b.id]) b.icon = icons[b.id];
            const c = colors[b.id];
            if (c) {
                if (c.wall) b.wall = c.wall;
                if (c.roof) b.roof = c.roof;
            }
            return b;
        });
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

        // Bug reportado pelo usuário ("o player some do nada... aparece em
        // lugares aleatórios, atrás de casas"): este clamp usava `newW`
        // bruto como se a faixa caminhável fosse do tamanho exato do
        // canvas, mas a Praça é deliberadamente mais LARGA que o canvas
        // (ver _worldWidth(), 1.4x, pra dar espaço real da câmera panorâmica
        // — o mesmo bound que _updateMovement já aplica todo frame). Um
        // jogador explorando a beirada do mundo alargado (ex: x perto de
        // _worldWidth()-30, só alcançável com a câmera panorâmica) tinha
        // sua posição reescalada corretamente e depois FORÇADA de volta pra
        // dentro de `newW` — bem mais estreito que o mundo de verdade —
        // teletransportando pra um x completamente diferente de onde
        // estava (podia coincidir com o meio de um prédio, aparecendo
        // "atrás" dele). Também nunca clampava Y — um resize que mudasse a
        // ALTURA desproporcionalmente (barra de endereço do celular
        // sumindo, teclado virtual abrindo, Ctrl +/- de zoom) podia deixar
        // o jogador acima do horizonte (dentro do cenário de fundo,
        // "próximo à floresta") ou abaixo do chão da Praça, já que
        // `_plazaBottom(h) = h - 70` não escala linearmente com `h`
        // (diferente de `_horizon(h) = h*0.62`), então multiplicar Y por
        // `fy` não preserva a posição relativa dentro da faixa andável.
        // Usa exatamente os mesmos bounds de _updateMovement (o clamp que
        // já roda todo frame durante o jogo normal), nunca um cálculo
        // paralelo — assim os dois nunca podem voltar a divergir.
        const bounds = { minX: 30, maxX: this._worldWidth() - 30, minY: this._horizon(newH) + 20, maxY: this._plazaBottom(newH) + 30 };
        const clampToBounds = (entity) => {
            entity.x = Utils.clamp(entity.x, bounds.minX, bounds.maxX);
            entity.y = Utils.clamp(entity.y, bounds.minY, bounds.maxY);
        };

        rescale(this.player);
        clampToBounds(this.player);
        this.npcs.forEach(rescale);
        this.npcs.forEach(clampToBounds);
        this.nightWanderers.forEach(rescale);
    }

    _plazaBottom(h) {
        return h - 70;
    }

    _horizon(h) {
        return h * 0.62;
    }

    // Largura do MUNDO caminhável da Praça — sempre maior que o canvas
    // atual (nunca um valor fixo em pixels, senão telas grandes não teriam
    // pra onde a câmera rolar e telas pequenas teriam mundo demais). 1.4x é
    // deliberadamente modesto: o conteúdo da cidade continua o mesmo de
    // sempre (nenhum prédio/NPC novo), só ganha uma margem real pra andar
    // até as bordas e ver a câmera de fato acompanhar — ver design doc
    // (docs/superpowers/specs/2026-08-02-explorable-world-travel-design.md),
    // seção "Resolução da ambiguidade". Nunca cacheado — lido fresco a
    // cada chamada, igual a todo outro valor derivado de
    // window.Engine.width/height neste arquivo (mesmo motivo do bug de
    // resize documentado em handleResize acima).
    _worldWidth() {
        return (window.Engine ? window.Engine.width : window.innerWidth) * 1.4;
    }

    _isActive() {
        return window.Engine && window.Engine.state.screen === 'HUB';
    }

    // --- NPCs ambiente (só decorativos, sem interação) ---

    _spawnNpcsIfNeeded() {
        const p = window.Engine.state.player;
        // Mais NPCs conforme o jogador progride (nível), até um teto razoável.
        // Piso/teto dobrados (eram 2/8) — item 19 da revisão profunda:
        // mesmo com raceDemographics já corretamente enviesado (ver
        // citydatabase.js — Porto Helênico já sorteia 100% de raças
        // humanas/culturas gregas pra cada NPC gerado aqui, nenhuma raça de
        // fantasia entra no pool dessa cidade), uma população de só 2-8
        // NPCs (2 no nível 1, quando o jogador VÊ a cidade pela primeira
        // vez) fazia QUALQUER cidade, inclusive a humana, parecer vazia —
        // "poucos humanos" era, na prática, "poucos NPCs de qualquer raça".
        // O bug não era a demografia (já certa), era a densidade.
        const targetCount = Utils.clamp(4 + Math.floor((p ? p.level : 1) / 2), 4, 14);
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

    // Veios de Minério (ver comentário completo em this.oreVeinSpots no
    // construtor) — só nasce em cidades com `hasOreVeins: true` (hoje só o
    // Reino Anão). Chamado nos MESMOS pontos que _spawnLightStonesIfNeeded
    // (onEnterCity/travelToCity), nunca um ciclo de vida próprio separado.
    _spawnOreVeinsIfNeeded() {
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        if (!cityDef || !cityDef.hasOreVeins) { this.oreVeins = []; return; }
        if (this.oreVeins.length > 0) return;
        this.oreVeins = this.oreVeinSpots.map((spot, i) => ({ id: i, spot, tier: this._rollOreTier(), collected: false, respawnTimer: 0 }));
    }

    // Sorteia o tier (1-5, ver items.js ItemDatabase.materials) de um veio
    // ao nascer/renascer — gradiente decrescente de raridade (mesma
    // filosofia "raro de verdade, nunca garantido" já usada em
    // ItemFactory.generateShopInventory pra raridade de equipamento),
    // nunca uniforme entre os 5 tiers.
    _rollOreTier() {
        const roll = Math.random() * 100;
        if (roll < 55) return 1;
        if (roll < 80) return 2;
        if (roll < 93) return 3;
        if (roll < 99) return 4;
        return 5;
    }

    // NPC fixo no vão do portão da muralha — raio de "pin" bem pequeno, já
    // que ele deveria estar sempre visível bem ali, não vagando pela praça
    // inteira como os NPCs comuns. Precisa da MESMA largura usada por
    // GraphicsEngine._drawCityWall (agora chamado de dentro de
    // CityEngine.draw() com _worldWidth(), ver Fase 1) — usar a largura do
    // canvas aqui de novo faria o Viajante voltar a "sumir" (ficar
    // desalinhado do vão de verdade da muralha assim que a câmera se move).
    _makeCaravanTraveler() {
        const w = this._worldWidth(), h = window.Engine.height;
        const gateX = w * CityEngine.GATE_XFRAC;
        const gateY = this._horizon(h) + 45;
        // Raça ponderada pela demografia da Cidade-Hub atual (Ciclo 28 —
        // mesmo mecanismo já usado por _makeNpc, ver _pickNpcRace acima).
        // Achado nesta revisão: o Viajante do Portão ficou pra trás quando
        // _makeNpc ganhou essa coerência (comentário lá já documenta "faz a
        // praça REALMENTE parecer outro povo ao viajar") — continuava com
        // um pool de pele genérico fixo e SEM `race` nenhuma, então nunca
        // aparecia como orc/elfo/anão mesmo chegando na Fortaleza Orc ou no
        // Santuário Élfico. Já era seguro (GFX cai em fallback humano
        // quando `race` está ausente, nunca lançava exceção), mas visualmente
        // incoerente com todo o resto da praça.
        const npcRace = this._pickNpcRace();
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
                    skinTone: window.RaceSystem ? window.RaceSystem.pickSkinTone(npcRace) : '#ffcc99',
                    hairStyle: Utils.randomInt(1, 15),
                    hairColor: hairColors[Utils.randomInt(0, hairColors.length - 1)],
                    beardStyle: 0, eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {},
                __teamColor: '#4a3a2a', // manto de viagem, cor terrosa de estrada
                race: npcRace
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
    // Raça ponderada pela demografia da Cidade-Hub atual (Ciclo 29, mesmo
    // achado/correção do Viajante do Portão no Ciclo 28) — diferente do
    // Vampiro noturno acima (identidade visual FIXA da Linhagem
    // Vampirismo, nunca deve variar por cidade), o Mercador Viajante é só
    // uma pessoa comum sem motivo nenhum pra sempre ter a mesma pele.
    _makeTravelingMerchant() {
        const w = window.Engine.width, h = window.Engine.height;
        const x = Utils.randomFloat(w * 0.15, w * 0.85);
        const y = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
        const npcRace = this._pickNpcRace();
        return {
            x, y, targetX: x, targetY: y, pin: null,
            waitTimer: Utils.randomFloat(1, 3),
            facing: Utils.chance(50) ? 1 : -1,
            isTravelingMerchant: true,
            despawnTimer: Utils.randomFloat(70, 110),
            entity: {
                visuals: {
                    gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
                    skinTone: window.RaceSystem ? window.RaceSystem.pickSkinTone(npcRace) : '#c99a6a',
                    hairStyle: Utils.randomInt(1, 15),
                    hairColor: '#2a1c10', beardStyle: Utils.chance(60) ? Utils.randomInt(1, 4) : 0,
                    eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {},
                __teamColor: '#7a2a8a',
                race: npcRace
            },
            anim: { type: 'idle', start: performance.now(), duration: 0 }
        };
    }

    // Bandido Anão (Reino Subterrâneo de Kharzum, ver
    // citydatabase.js `hasBandits`/_eventDwarfBandit) — MESMA estrutura de
    // _makeTravelingMerchant acima (NPC físico, some sozinho se ignorado),
    // sempre raça anão (é um bandido LOCAL, não um viajante de fora) e
    // sempre masculino/barba (silhueta "criminoso" mais reconhecível à
    // distância), cor de equipe escura/vermelha em vez da roxa do
    // mercador — identidade visual de ameaça, não de oportunidade.
    _makeBandit() {
        const w = window.Engine.width, h = window.Engine.height;
        const x = Utils.randomFloat(w * 0.15, w * 0.85);
        const y = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
        return {
            x, y, targetX: x, targetY: y, pin: null,
            waitTimer: Utils.randomFloat(1, 3),
            facing: Utils.chance(50) ? 1 : -1,
            isBandit: true,
            despawnTimer: Utils.randomFloat(45, 70), // some mais rápido que o Mercador — é uma ameaça passageira, não uma oportunidade
            entity: {
                visuals: {
                    gender: 'Masculino',
                    skinTone: window.RaceSystem ? window.RaceSystem.pickSkinTone('anao') : '#c99a6a',
                    hairStyle: Utils.randomInt(1, 15),
                    hairColor: '#1a1a1a', beardStyle: Utils.randomInt(1, 4),
                    eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {},
                __teamColor: '#5a1a1a',
                race: 'anao'
            },
            anim: { type: 'idle', start: performance.now(), duration: 0 }
        };
    }

    // Mineiro Preso (ver citydatabase.js `hasOreVeins`/_eventTrappedMiner)
    // — MESMA estrutura física de NPC que _makeBandit acima, mas o
    // contraponto POSITIVO pedido explicitamente na especificação ("ajudar
    // um mineiro" afeta a reputação existente, sempre GLOBAL, nunca um
    // sistema paralelo). Pose 'hurt' (mesma já usada por qualquer entidade
    // ferida em batalha) sinaliza à distância que precisa de ajuda, antes
    // mesmo do aviso de interação normal aparecer.
    _makeTrappedMiner() {
        const w = window.Engine.width, h = window.Engine.height;
        const x = Utils.randomFloat(w * 0.15, w * 0.85);
        const y = Utils.randomFloat(this._horizon(h) + 30, this._plazaBottom(h));
        return {
            x, y, targetX: x, targetY: y, pin: null,
            waitTimer: Utils.randomFloat(1, 3),
            facing: Utils.chance(50) ? 1 : -1,
            isTrappedMiner: true,
            despawnTimer: Utils.randomFloat(60, 90),
            entity: {
                visuals: {
                    gender: Utils.chance(50) ? 'Masculino' : 'Feminino',
                    skinTone: window.RaceSystem ? window.RaceSystem.pickSkinTone('anao') : '#c99a6a',
                    hairStyle: Utils.randomInt(1, 15),
                    hairColor: '#2a1c10', beardStyle: Utils.randomInt(0, 4),
                    eyeColor: '#1a1a1a', faceShape: 1
                },
                equipment: {},
                __teamColor: '#5a4a2a',
                race: 'anao'
            },
            anim: { type: 'hurt', start: performance.now(), duration: 0 }
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
            const screenX = e.clientX - rect.left;
            const offset = window.Camera.getOffset(window.Engine.width, window.Engine.height);
            this._mouseX = screenX - offset.dx; // mundo, comparável a this.player.x
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
        const screenX = clientX - rect.left, screenY = clientY - rect.top;
        const offset = window.Camera.getOffset(window.Engine.width, window.Engine.height);
        // Bug corrigido: a Praça só rola a câmera no eixo X (ver draw(),
        // `ctx.translate(offset.dx, 0)` — o eixo Y NUNCA é transladado,
        // igual antes do bug do "campo de riscos"). Usar `offset.dy` aqui
        // (calculado a partir de player.y, pensado pro mundo da Estrada, que
        // TEM uma faixa vertical de verdade) somava um deslocamento vertical
        // de até ~300px em toda conversão de clique pra coordenada de mundo
        // — exatamente o bug reportado ("o personagem anda pra uma direção
        // errada, como pra baixo"), e também a causa raiz de cliques em
        // NPCs/prédios/pedras de luz próximos ao topo da praça (Viajante do
        // Portão incluído) quase nunca acertarem o raio de detecção certo.
        const x = screenX - offset.dx, y = screenY; // agora em coordenadas de MUNDO
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

        // Veio de Minério (ver _spawnOreVeinsIfNeeded) — mesmo fluxo de
        // aproximação física do bloco de Pedra de Luz acima, reaproveitado
        // em vez de duplicado.
        const vein = this._oreVeinAtPoint(x, y);
        if (vein) {
            this._approachAndCollectOre(vein);
            return;
        }

        // Estruturas abrem na hora do clique — diferente de NPCs/Pedras de
        // Luz (que continuam exigindo aproximação física acima). Pedido
        // explícito: "Estruturas: CLICK → INTERAÇÃO IMEDIATA / NPCs: CLICK →
        // CAMINHAR ATÉ NPC → INTERAGIR. Não misture os dois sistemas." Antes
        // clicar num prédio mandava o jogador andar até a porta primeiro
        // (_approachAndInteractBuilding/_updatePendingInteractBuilding,
        // ambos removidos) — fazia sentido pra NPCs (alguém que precisa ser
        // abordado), mas não pra uma loja/portal, que não é uma pessoa.
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

    // Ponto de aproximação seguro — bug corrigido: o ponto ingênuo (a
    // distância fixa `preferredDist` do alvo, do lado de onde o jogador já
    // vem) podia cair DENTRO de uma zona de colisão (do próprio prédio-alvo
    // OU de um vizinho perto demais). Caso real reportado pelo usuário: o
    // Viajante do Portão fica perto o bastante do Mercado Arcano pra o
    // ponto de aproximação padrão cair sempre dentro da margem de colisão
    // do prédio vizinho — o jogador nunca conseguia "chegar" (targetX nunca
    // ficava null), então _pendingTalkNpc/_pendingCollectStone nunca
    // limpavam e a interação nunca disparava, por mais que o clique em si
    // estivesse certo. Tenta a distância pedida primeiro, depois
    // distâncias maiores (escapa da colisão do PRÓPRIO alvo, se
    // `preferredDist` foi subestimado) e menores (escapa da colisão de um
    // VIZINHO perto demais do alvo), até achar um ponto livre; no pior caso
    // (cercado por todos os lados), aponta direto pro alvo — melhor chegar
    // perto demais do que ficar preso pra sempre num ponto inalcançável.
    //
    // Segundo bug corrigido pelo mesmo motivo: um alvo perto o bastante da
    // BORDA do mundo (ex: o Viajante do Portão, perto do limite direito)
    // também podia gerar um ponto de aproximação além de `_worldWidth()` —
    // com o jogador já parado exatamente na borda (bounds de
    // _updateMovement), a distância até esse ponto nunca cai abaixo de 4px
    // (preso contra a parede invisível do mundo, não uma colisão de
    // prédio), travando "chegada" pra sempre do mesmo jeito. Por isso cada
    // candidato aqui é sempre grampeado dentro dos MESMOS limites usados
    // por _setPlayerDestination antes de testar colisão.
    _safeApproachPoint(targetX, targetY, dir, preferredDist) {
        const minX = 40, maxX = this._worldWidth() - 40;
        const candidates = [preferredDist, preferredDist * 1.5, preferredDist * 2.2, preferredDist * 0.66, preferredDist * 0.33, 0];
        for (const d of candidates) {
            const x = Utils.clamp(targetX + dir * d, minX, maxX);
            if (!this._collides(x, targetY)) return { x, y: targetY };
        }
        return { x: Utils.clamp(targetX, minX, maxX), y: targetY };
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
        const dir = (npc.x >= this.player.x) ? -1 : 1;
        const pos = this._safeApproachPoint(npc.x, npc.y, dir, 42);
        this._setPlayerDestination(pos.x, pos.y);
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
        const w = this._worldWidth(), h = window.Engine.height;
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
        const stonePos = this._lightStonePos(stone);
        const dir = (stonePos.x >= this.player.x) ? -1 : 1;
        const pos = this._safeApproachPoint(stonePos.x, stonePos.y, dir, 34);
        this._setPlayerDestination(pos.x, pos.y);
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

    // Posição de tela de um Veio de Minério — mesma convenção de
    // _lightStonePos acima, reaproveitada.
    _oreVeinPos(vein) {
        const w = this._worldWidth(), h = window.Engine.height;
        const scale = this._cityScale(h);
        return { x: vein.spot.xFrac * w, y: this._horizon(h) + vein.spot.rowOffset * scale };
    }

    // Veio de Minério mais próximo do clique — mesma ideia de
    // _lightStoneAtPoint acima.
    _oreVeinAtPoint(x, y) {
        const radius = 30 * this._cityScale(window.Engine.height);
        let closest = null, closestDist = radius;
        for (const vein of this.oreVeins) {
            if (vein.collected) continue;
            const pos = this._oreVeinPos(vein);
            const d = Math.hypot(pos.x - x, pos.y - y);
            if (d <= closestDist) { closest = vein; closestDist = d; }
        }
        return closest;
    }

    // Manda o jogador andar até perto do veio clicado — mesma ideia de
    // _approachAndCollectStone.
    _approachAndCollectOre(vein) {
        if (this._pendingCollectOre === vein) return;
        this._pendingCollectOre = vein;
        const veinPos = this._oreVeinPos(vein);
        const dir = (veinPos.x >= this.player.x) ? -1 : 1;
        const pos = this._safeApproachPoint(veinPos.x, veinPos.y, dir, 34);
        this._setPlayerDestination(pos.x, pos.y);
    }

    // Chamado a cada frame (ver update()) — mesmo padrão de
    // _updatePendingCollectStone.
    _updatePendingCollectOre() {
        if (!this._pendingCollectOre) return;
        const vein = this._pendingCollectOre;
        const stillExists = this.oreVeins.includes(vein) && !vein.collected;
        if (!stillExists) { this._pendingCollectOre = null; return; }

        const arrived = this.player.targetX === null && this.player.pathQueue.length === 0;
        if (!arrived) return;

        this._pendingCollectOre = null;
        const pos = this._oreVeinPos(vein);
        if (this._distanceTo(pos) > 60) return; // desviado no meio do caminho, desiste
        this._collectOreVein(vein);
    }

    // Coleta de verdade: 1-3 unidades da matéria-prima correspondente ao
    // `tier` sorteado do veio (ver items.js ItemDatabase.materials/
    // ItemFactory.createMaterial), respeitando `inventoryCapacity` (mesmo
    // cuidado já usado pelo loot de inimigo derrotado, ver ui.js
    // showBattleResults "Mochila cheia") — nunca sobrescreve/ignora o
    // limite normal da mochila só porque é um recurso de mundo.
    _collectOreVein(vein) {
        const p = window.Engine.state.player;
        if (!p) return;
        const materialPool = CityEngine.ORE_TIER_MATERIAL[vein.tier];
        const materialId = materialPool[Utils.randomInt(0, materialPool.length - 1)];
        const template = ItemDatabase.materials[materialId];
        const amount = Utils.randomInt(1, 3);
        let gained = 0;
        for (let i = 0; i < amount; i++) {
            if (p.inventory.length >= p.inventoryCapacity) break;
            p.inventory.push(ItemFactory.createMaterial(materialId));
            gained++;
        }
        vein.collected = true;
        // Mesma janela de tempo (50-100s) que a Pedra de Luz usa pra
        // respawn — mantém o mesmo ritmo de exploração já testado.
        vein.respawnTimer = Utils.randomFloat(50, 100);

        const pos = this._oreVeinPos(vein);
        const tierColors = { 1: '#a8a8a8', 2: '#c8905a', 3: '#88ccee', 4: '#b088ee', 5: '#ffd85a' };
        const glowColor = tierColors[vein.tier] || '#a8a8a8';
        if (window.GFX) {
            window.GFX.spawnParticles(pos.x, pos.y - 10, glowColor, 16, 4, 3);
            if (gained > 0) window.GFX.spawnText(pos.x, pos.y - 40, `+${gained} ${template.name}`, glowColor, false);
        }
        if (window.AudioManager) window.AudioManager.playLightPickup();
        if (gained > 0) {
            this._toast(`Você extrai ${gained}x ${template.name} do veio.`, 'success');
            window.SaveManager.save(window.Engine.state);
        } else {
            this._toast('Mochila cheia! Não há espaço pra guardar o minério.', 'error');
        }
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

    // Decrementa o respawn de cada veio já minerado e o faz reaparecer na
    // MESMA posição, com um `tier` NOVO sorteado (ver _rollOreTier) — a
    // recompensa varia a cada ciclo, mesmo padrão de _updateLightStones.
    _updateOreVeins(dt) {
        if (this.oreVeins.length === 0) return;
        for (const vein of this.oreVeins) {
            if (!vein.collected) continue;
            vein.respawnTimer -= dt;
            if (vein.respawnTimer <= 0) {
                vein.collected = false;
                vein.tier = this._rollOreTier();
            }
        }
    }

    // Fala rápida de um NPC ambiente — nunca revela mecanismos de jogo
    // diretamente (isso já é papel dos rumores de Linhagem, ver
    // _eventLineageRumor), só reage à fama do jogador (vitórias) ou solta
    // uma observação genérica sobre a vida na praça.
    _talkToNpc(npc) {
        const p = window.Engine.state.player;
        // Bandido Anão (ver _eventDwarfBandit/_makeBandit) — clicar nele
        // (depois de andar até perto, mesmo fluxo de qualquer NPC) abre o
        // menu de escolha real (Pagar/Lutar/Recusar) em vez de uma fala
        // genérica ou um combate automático — é o ÚNICO encontro do jogo
        // com essa decisão de 3 vias.
        if (npc.isBandit) {
            this._banditEncounter(npc);
            return;
        }
        // Mineiro Preso (ver _eventTrappedMiner/_makeTrappedMiner) —
        // contraponto positivo do bandido: clicar nele resolve a ajuda na
        // hora (sem menu de escolha, é sempre um gesto de boa vontade,
        // nunca uma decisão de risco como pagar/lutar/recusar).
        if (npc.isTrappedMiner) {
            this._helpTrappedMiner(npc);
            return;
        }
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

        // Reputação (ver reputation.js) — eixo separado de fama de vitórias
        // acima. `infame` tem prioridade sobre a fama de vitórias (pedido
        // explícito, seção 5: "NPCs demonstram desconfiança" mesmo que o
        // jogador seja um campeão de arena); `respeitado` só entra se o
        // jogador ainda não tem fama de vitórias própria (senão a fala de
        // vitórias, mais específica/dramática, continua tendo prioridade).
        const repTier = window.ReputationSystem ? window.ReputationSystem.getTier(p) : null;

        if (p && p.lineage && CityEngine.NPC_DIALOGUE[p.lineage]) {
            pool = CityEngine.NPC_DIALOGUE[p.lineage];
        } else if (repTier && repTier.tone === 'negative') {
            pool = CityEngine.NPC_DIALOGUE.infame;
        } else if (wins >= 25) pool = CityEngine.NPC_DIALOGUE.legendary;
        else if (wins >= 10) pool = CityEngine.NPC_DIALOGUE.famous;
        else if (repTier && repTier.tone === 'positive') pool = CityEngine.NPC_DIALOGUE.respeitado;
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
            // NPC_PROFESSIONS_REGIONAL acima) — Fortaleza Orc/Santuário
            // Élfico só trocam o CONTEÚDO (array de falas), mantendo o
            // `name` genérico de exibição ("Mercador", "Sacerdote"...).
            // Reino Anão (ver entrada abaixo) precisa também trocar o
            // PRÓPRIO título exibido ("Ferreiro", "Mineiro", "Guarda da
            // Montanha"...) — os 6 ofícios pedidos explicitamente na
            // especificação não têm equivalente direto nos 8 nomes gregos
            // genéricos. Formato antigo (array de falas) continua
            // funcionando sem nenhuma mudança nas duas cidades existentes;
            // formato novo (`{ name, lines }`) é só uma extensão opcional
            // detectada por `Array.isArray`.
            const regionalProfessions = CityEngine.NPC_PROFESSIONS_REGIONAL[cityId];
            const regionalEntry = regionalProfessions && regionalProfessions[npc.profession];
            if (regionalEntry && !Array.isArray(regionalEntry)) {
                pool = regionalEntry.lines;
                speaker = regionalEntry.name;
            } else {
                pool = regionalEntry || CityEngine.NPC_PROFESSIONS[npc.profession].lines;
                speaker = CityEngine.NPC_PROFESSIONS[npc.profession].name;
            }
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
        const w = this._worldWidth(), h = window.Engine.height;
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

    // Caixa de clique que acompanha o CONTORNO VISUAL de verdade do prédio
    // (telhado triangular + sombra no chão, ver _bakeBuildingShell — mesmos
    // `halfW`/`topY`/`botY` usados lá pra bakear a fachada), não só o corpo
    // retangular das paredes (_buildingRect, usado pra colisão de
    // caminhada). Bug corrigido: a caixa antiga (paredes + uma margem fixa
    // de 20/10px) nunca cobria o telhado inteiro (ele sobe ~30% da altura
    // do prédio acima do topo das paredes) nem as beiradas (~12px pra cada
    // lado) — cliques no telhado ou na beirada da sombra "erravam" o
    // prédio, exatamente o "área de interação incorreta/desalinhada da
    // imagem real" reportado.
    _buildingHitRect(building) {
        const door = this._doorPoint(building);
        const scale = this._cityScale(window.Engine.height);
        const bw = building.w * scale, bh = building.h * scale;
        const halfW = bw / 2 + 12;
        return {
            left: door.x - halfW,
            right: door.x + halfW,
            top: door.y - (bh * 1.3 + 4),
            bottom: door.y + 18,
        };
    }

    _buildingAtPoint(x, y) {
        for (const b of this.buildings) {
            const r = this._buildingHitRect(b);
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b;
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
            case 'blacksmith': {
                // Reino Anão: Ferreiro vira a Forja de verdade (ver
                // js/forge.js/ui.js openForge) — economia baseada em
                // produção com matéria-prima, não loja padrão. Qualquer
                // outra cidade (sem `hasForge`) continua exatamente como
                // sempre foi.
                const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
                if (cityDef && cityDef.hasForge && window.UI.openForge) window.UI.openForge();
                else window.UI.openShop([SLOTS.MAIN_HAND, SLOTS.RANGED], 'Ferreiro');
                break;
            }
            case 'armorer': {
                // Reino Anão: Negociante de Minérios vende matéria-prima de
                // verdade (ver ui.js openOreTrader), não a loja de
                // equipamento padrão — mesma lógica de 'blacksmith' acima.
                const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
                if (cityDef && cityDef.hasOreTrader && window.UI.openOreTrader) window.UI.openOreTrader();
                else window.UI.openShop([SLOTS.HEAD, SLOTS.CHEST, SLOTS.HANDS, SLOTS.LEGS, SLOTS.FEET, SLOTS.OFF_HAND, SLOTS.AMULET, SLOTS.RING], 'Armeiro');
                break;
            }
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
        // Item 18 da revisão profunda: cidade natal por raça (ver
        // RACE_HOME_CITY em citydatabase.js) pode ter unlockLevel > 1 —
        // sem a segunda condição, esse gate por nível bloquearia a VIAGEM
        // DE VERDADE (não só o botão na UI, ver openCaravan em ui.js) de um
        // personagem tentando voltar pra própria cidade natal antes de
        // atingir o nível normalmente exigido pra descobri-la.
        if (p.level < dest.unlockLevel && !(p.visitedCityIds && p.visitedCityIds.includes(cityId))) return false; // ainda não desbloqueada
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
        // Reskin dos prédios civis pra identidade da cidade de chegada (ver
        // _syncBuildingsToCity) — precisa rodar ANTES do resto do reset
        // abaixo só por consistência de leitura, mas a ordem exata não
        // importa (nenhum dos resets seguintes lê `this.buildings`).
        this._syncBuildingsToCity();
        this.npcs = [];
        this.nightWanderers = [];
        this._arenaNpcsSpawned = false;
        this._gateTravelerSpawned = false;
        this.travelingMerchant = null;
        // Bandido Anão (ver _makeBandit acima no construtor) — mesma
        // razão do Mercador Viajante acima: não faz sentido "atravessar"
        // a viagem com o jogador, já foi removido de `this.npcs` junto
        // com o reset `this.npcs = []` logo acima.
        this.bandit = null;
        // Mineiro Preso (ver _makeTrappedMiner acima no construtor) —
        // mesma razão do bandido logo acima.
        this.trappedMiner = null;
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
        // Veios de Minério (ver _spawnOreVeinsIfNeeded) — mesma razão do
        // resto do ambiente acima.
        this.oreVeins = [];
        this._pendingCollectOre = null;
        this._spawnNpcsIfNeeded();
        this._spawnLightStonesIfNeeded();
        this._spawnOreVeinsIfNeeded();

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
        this._updatePendingCollectOre();
        this._updateOreVeins(dt);
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
        this._updateBandit(dt);
        this._updateTrappedMiner(dt);
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
        // Trava anti-spam (Rework Econômico, item 15 — "duplicação de
        // dinheiro"/"exploits de progressão"): antes desta trava, QUALQUER
        // clique em "dormir" com fadiga 0 (grátis, sem custo nenhum, ver
        // ui.js healFatigue/_healerCost) disparava esta função inteira de
        // novo, incluindo _applyBankInterest() — clicar repetidamente
        // rendia juros de 2% compostos ILIMITADAS vezes por sessão, ouro
        // efetivamente infinito com qualquer valor guardado no Banco. Como
        // esta é a ÚNICA função que executa QUALQUER consequência de "um
        // dia se passou" (juros do Banco, reroll de estoque de loja via
        // dayCount, quadro de missões, NPCs/Viajante/Mercador novos — ver
        // comentário "PONTO DE EXTENSÃO" abaixo), travar bem AQUI protege
        // todos esses sistemas de uma vez, sem precisar de uma trava
        // separada em cada um. `lastDayAdvanceAt` usa Date.now() (não
        // performance.now()) e vive no Player — sobrevive a save/load e
        // reload de página, então recarregar a página pra "resetar" o
        // relógio não escapa da trava. 20s reais nunca atrapalha o ciclo
        // natural dia/noite (uma transição real a cada 300s, ver
        // dayPhaseDuration=75 * 4 fases), só barra clique repetido.
        const p = window.Engine && window.Engine.state && window.Engine.state.player;
        const now = Date.now();
        const MIN_INTERVAL_MS = 20000;
        if (p && p.lastDayAdvanceAt && now - p.lastDayAdvanceAt < MIN_INTERVAL_MS) return;
        if (p) p.lastDayAdvanceAt = now;

        this.dayCount++; // novo dia — ver openShop (ui.js), invalida o cache de estoque sozinho
        // Persiste o novo valor no Player (item #8 do novo pedido de
        // auditoria — ver onEnterCity/player.js `dayCount`), senão um
        // refresh logo depois desfaria este incremento (o contador
        // "voltaria no tempo" pra 1, mesmo o dia tendo passado de verdade).
        const dayCountPlayer = p;
        if (dayCountPlayer) dayCountPlayer.dayCount = this.dayCount;
        this._applyBankInterest();

        // Limpeza física dos buffs temporários vencidos (Hidromel/Banquete/
        // Runas do Reino Anão, ver items.js TEMP_BUFF/player.js
        // calculateDerivedStats) — calculateDerivedStats já FILTRA buffs
        // vencidos antes de somar, então isso não é necessário pra
        // correção, só evita o array crescer pra sempre no save do jogador
        // ao longo de uma partida longa.
        // Rework da Taverna item 15: buffs de Comida/Bebida (ver player.js
        // useConsumable) podem ter `expiresAfterBattles` em vez de
        // `expiresAtDay` — sem essa checagem, QUALQUER avanço de dia
        // (inclusive dormir na Taverna) apagava esses buffs na hora, mesmo
        // ainda tendo batalhas restantes (undefined > número é sempre
        // false). A limpeza física de buffs por BATALHA continua em
        // battle.js endBattle, nunca aqui.
        if (dayCountPlayer && dayCountPlayer.activeBuffs) {
            dayCountPlayer.activeBuffs = dayCountPlayer.activeBuffs.filter(b => b.expiresAtDay === undefined || b.expiresAtDay > this.dayCount);
        }

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
        // Bandido Anão — mesmo motivo do Mercador Viajante acima.
        this.bandit = null;
        // Mineiro Preso — mesmo motivo.
        this.trappedMiner = null;
        this.activePromotion = null;

        // Pedras de Luz (ver _spawnLightStonesIfNeeded/item 13): força uma
        // rodada nova, todas não coletadas, se o jogador ainda precisar delas.
        this.lightStones = [];
        this._pendingCollectStone = null;

        // Veios de Minério (ver _spawnOreVeinsIfNeeded) — mesmo motivo do
        // campo acima: um novo dia sorteia uma leva nova, nunca "atravessa"
        // congelada.
        this.oreVeins = [];
        this._pendingCollectOre = null;

        this._spawnNpcsIfNeeded();
        this._spawnLightStonesIfNeeded();
        this._spawnOreVeinsIfNeeded();

        // Missões Secundárias (ver quests.js) — falha qualquer missão ativa
        // cujo prazo tenha vencido; o quadro da cidade também sorteia uma
        // nova leva procedural sozinho no próximo openQuestBoard (cacheado
        // por dia, mesmo padrão do estoque de loja).
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

    // Move `current` em direção a `target`, no máximo `maxDelta` por
    // chamada — mesmo helper usado por RoadEngine._approach (ver js/road.js)
    // pra suavizar aceleração/frenagem, agora também na Praça.
    _approach(current, target, maxDelta) {
        if (current < target) return Math.min(current + maxDelta, target);
        if (current > target) return Math.max(current - maxDelta, target);
        return current;
    }

    // Movimento da Praça — NUNCA delega mais pra PlayerController.update
    // (hard-snap: a velocidade saltava direto pro alvo, sem nenhuma
    // aceleração/frenagem). Pedido do usuário: "adicionar movimento suave
    // com aceleração e desaceleração... evitar mudanças instantâneas de
    // direção". A velocidade REAL (this.player.vx/vy) persegue a
    // velocidade-alvo (WASD ou clique-pra-andar, incluindo os waypoints de
    // `pathQueue` calculados por PlayerController.findPath em
    // _setPlayerDestination — findPath continua compartilhado, só a
    // integração de posição por frame passou a ser local) via _approach,
    // mesma técnica já usada por RoadEngine._updateMovement (ver js/road.js)
    // — ACCEL/DECEL abaixo usam os MESMOS valores, pra caminhar na cidade e
    // na estrada ter a mesma sensação. `bounds`/`obstacleRects` continuam
    // montados aqui (únicos da Praça); só a colisão em si (PlayerController.
    // collides, via this._collides) continua compartilhada.
    static get ACCEL() { return 900; } // px/s² ao acelerar (sair do zero ou mudar de direção)
    static get DECEL() { return 1400; } // px/s² ao soltar as teclas/chegar no alvo — freia mais rápido do que acelera

    _updateMovement(dt) {
        const h = window.Engine.height;
        const bounds = { minX: 30, maxX: this._worldWidth() - 30, minY: this._horizon(h) + 20, maxY: this._plazaBottom(h) + 30 };
        const p = this.player;
        let targetVx = 0, targetVy = 0;
        const keyMoving = this.keysHeld.up || this.keysHeld.down || this.keysHeld.left || this.keysHeld.right;

        if (keyMoving) {
            if (this.keysHeld.up) targetVy -= 1;
            if (this.keysHeld.down) targetVy += 1;
            if (this.keysHeld.left) targetVx -= 1;
            if (this.keysHeld.right) targetVx += 1;
            const len = Math.hypot(targetVx, targetVy) || 1;
            targetVx = (targetVx / len) * this.walkSpeed;
            targetVy = (targetVy / len) * this.walkSpeed;
            p.targetX = null;
            p.targetY = null;
            p.pathQueue = [];
        } else if (p.targetX !== null) {
            const dx = p.targetX - p.x, dy = p.targetY - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 4) {
                if (p.pathQueue.length > 0) {
                    const next = p.pathQueue.shift();
                    p.targetX = next.x;
                    p.targetY = next.y;
                } else {
                    p.targetX = null;
                    p.targetY = null;
                }
            } else {
                targetVx = (dx / dist) * this.walkSpeed;
                targetVy = (dy / dist) * this.walkSpeed;
            }
        }

        const rate = (targetVx !== 0 || targetVy !== 0) ? CityEngine.ACCEL : CityEngine.DECEL;
        p.vx = this._approach(p.vx || 0, targetVx, rate * dt);
        p.vy = this._approach(p.vy || 0, targetVy, rate * dt);

        const realSpeed = Math.hypot(p.vx, p.vy);
        p.moving = realSpeed > 5;
        if (Math.abs(p.vx) > 5) p.facing = p.vx > 0 ? 1 : -1;

        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
        if (!this._collides(nx, p.y)) p.x = nx;
        if (!this._collides(p.x, ny)) p.y = ny;
        p.x = Utils.clamp(p.x, bounds.minX, bounds.maxX);
        p.y = Utils.clamp(p.y, bounds.minY, bounds.maxY);

        // Som de passo / poeira nos pés — apresentação, não movimento em
        // si, continua vivendo aqui.
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

    // Retângulos/círculos de colisão pra ESTE frame — prédios (ver
    // _buildingRect) + a fonte central como círculo (`isCircle`, ver
    // PlayerController.collides). Compartilhado entre _updateMovement,
    // _collides e _setPlayerDestination (findPath) pra nunca duplicar a
    // montagem da lista de obstáculos.
    _obstacleRectsForCollision() {
        const margin = 20;
        const rects = this.buildings.map(b => {
            const r = this._buildingRect(b);
            return { left: r.left - margin, right: r.right + margin, top: r.top, bottom: r.bottom + margin * 0.6 };
        });
        const w = this._worldWidth(), h = window.Engine.height;
        const scale = this._cityScale(h);
        rects.push({
            isCircle: true,
            cx: this.fountain.xFrac * w,
            cy: this._horizon(h) + this.fountain.rowOffset * scale,
            radius: this.fountain.r * scale
        });
        return rects;
    }

    _collides(x, y) {
        return PlayerController.collides(x, y, this._obstacleRectsForCollision());
    }

    // Define o destino final do jogador, calculando o trajeto (com desvios,
    // se preciso) e guardando os waypoints restantes na fila — delegado a
    // PlayerController.findPath (ver js/playercontroller.js).
    _setPlayerDestination(x, y) {
        const h = window.Engine.height;
        const bounds = { minX: 32, maxX: this._worldWidth() - 32, minY: this._horizon(h) + 24, maxY: this._plazaBottom(h) + 26 };
        const path = PlayerController.findPath(this.player.x, this.player.y, x, y, this._obstacleRectsForCollision(), bounds);
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

        // Bandido Anão (ver citydatabase.js `hasBandits`/_eventDwarfBandit)
        // — só entra no sorteio em cidades que declararem o perigo urbano;
        // qualquer outra cidade nunca tem essa entrada na tabela, então
        // nunca sorteia. Mesmo peso do Duelista/Ladrão (2) — não deve
        // dominar o sorteio nem virar a maioria dos encontros.
        const cityDefForBandit = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        if (p && cityDefForBandit && cityDefForBandit.hasBandits) {
            table.push({ w: 2, run: () => this._eventDwarfBandit(p) });
        }

        // Mineiro Preso (ver citydatabase.js `hasOreVeins`/_eventTrappedMiner)
        // — contraponto positivo, mesma cidade que já tem o bandido
        // (Reino Anão), mesmo peso (2) pra não dominar o sorteio.
        if (p && cityDefForBandit && cityDefForBandit.hasOreVeins) {
            table.push({ w: 2, run: () => this._eventTrappedMiner(p) });
        }

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

    // Bandido Anão aparece na praça (ver _makeBandit) — mesmo tratamento
    // de "só um por vez" que o Mercador Viajante (_eventRareMerchant)
    // acima, chamado do MESMO sorteio ponderado de _updateRandomEvents
    // (só entra na tabela em cidades com `hasBandits`, ver ali).
    _eventDwarfBandit(p) {
        if (this.bandit) {
            this._toast('Um bandido ainda ronda a praça — cuidado por onde anda.', 'info');
            return;
        }
        const bandit = this._makeBandit();
        this.bandit = bandit;
        this.npcs.push(bandit);
        this._toast('Um bandido anão te encara de longe, mão no cabo do machado...', 'error');
        if (window.AudioManager) window.AudioManager.playError();
    }

    // Some sozinho se ignorado (ver _makeBandit `despawnTimer`) — mesmo
    // tratamento de _updateTravelingMerchant acima, sem toast de aviso
    // (diferente do mercador: o jogador não "perdeu uma oportunidade" ao
    // evitar um bandido, então não faz sentido narrativo avisar).
    _updateBandit(dt) {
        if (!this.bandit) return;
        this.bandit.despawnTimer -= dt;
        if (this.bandit.despawnTimer <= 0) {
            const idx = this.npcs.indexOf(this.bandit);
            if (idx >= 0) this.npcs.splice(idx, 1);
            this.bandit = null;
        }
    }

    // Mineiro Preso aparece na praça (ver _makeTrappedMiner) — mesmo
    // tratamento de "só um por vez" do Bandido Anão acima, chamado do MESMO
    // sorteio ponderado de _updateRandomEvents (só entra na tabela em
    // cidades com `hasOreVeins`, ver ali). Contraponto positivo explícito
    // da especificação original ("ajudar um mineiro preso" afeta a
    // reputação existente).
    _eventTrappedMiner(p) {
        if (this.trappedMiner) return; // silencioso — diferente do bandido, não é uma ameaça que exige aviso
        const miner = this._makeTrappedMiner();
        this.trappedMiner = miner;
        this.npcs.push(miner);
        this._toast('Você ouve um gemido de dor vindo de perto — um mineiro está preso sob os escombros!', 'info');
        if (window.AudioManager) window.AudioManager.playConfirm();
    }

    // Some sozinho se ignorado (ver _makeTrappedMiner `despawnTimer`) —
    // mesmo tratamento de _updateBandit acima, sem toast de aviso (o
    // jogador só "perde a chance" se realmente ignorar, sem punição extra).
    _updateTrappedMiner(dt) {
        if (!this.trappedMiner) return;
        this.trappedMiner.despawnTimer -= dt;
        if (this.trappedMiner.despawnTimer <= 0) {
            const idx = this.npcs.indexOf(this.trappedMiner);
            if (idx >= 0) this.npcs.splice(idx, 1);
            this.trappedMiner = null;
        }
    }

    // Resolve a ajuda ao Mineiro Preso — item explícito da especificação
    // original ("ajudar um mineiro" afeta a reputação GLOBAL existente,
    // nunca um sistema paralelo). Reaproveita o MESMO funil único de
    // escrita já usado por vitórias/roubos/missões (ver reputation.js
    // applyChange) em vez de somar `player.reputation` direto.
    _helpTrappedMiner(npc) {
        const p = window.Engine.state.player;
        if (!p) return;
        const idx = this.npcs.indexOf(npc);
        if (idx >= 0) this.npcs.splice(idx, 1);
        this.trappedMiner = null;

        const gift = Utils.randomInt(20, 45);
        p.gold += gift;
        if (window.ReputationSystem) {
            window.ReputationSystem.applyChange(p, Utils.randomInt(3, 6), {
                reason: 'ajuda_mineiro',
                toastMessage: `Você liberta o mineiro dos escombros — ele agradece com ${gift}g e sua fama de gladiador honrado cresce.`
            });
        } else {
            this._toast(`Você liberta o mineiro dos escombros — ele agradece com ${gift}g.`, 'success');
        }
        window.SaveManager.save(window.Engine.state);
        if (window.AudioManager) window.AudioManager.playConfirm();
    }

    // Gera o inimigo da luta contra o bandido — reaproveita Enemy inteiro
    // (mesma geração procedural de stats/equipamento/loot/raça/nome/
    // sorteio de Elite de qualquer Duelo Rápido, nunca uma classe/lógica
    // de combate paralela). Bug evitado nesta iteração: forçar
    // `isElite`/`race` DEPOIS de `new Enemy(...)` não funcionaria — o
    // construtor já decide nível efetivo, nome, aura visual E raça (que
    // por sua vez decide a aparência sorteada) tudo internamente, ANTES
    // de qualquer código externo poder reagir; sobrescrever depois deixa
    // level/nome/visual dessincronizados uns dos outros. Em vez disso,
    // só o NÍVEL de entrada sobe (+1, mesmo padrão já usado por
    // startEliteRoadBattle pros chefes opcionais da Estrada) — o resto
    // (raça majoritariamente anã pela demografia de reino_anao, chance
    // normal de Elite) sai natural da geração procedural de sempre.
    // `isBandit` é só uma tag NOVA e inofensiva (não influencia stats/
    // visual nenhum) lida por reputation.js `_opponentWeight` — derrotar
    // conta como "importante" mesmo quando o sorteio de Elite não bate.
    _makeBanditEnemy(p) {
        const enemy = new Enemy(p.level + 1);
        enemy.isBandit = true;
        return enemy;
    }

    // Menu de decisão do Bandido Anão (Pagar/Lutar/Recusar) — clicado
    // depois do jogador andar até perto dele (mesmo fluxo de aproximação
    // de qualquer NPC, ver _talkToNpc). ÚNICO encontro do jogo com uma
    // escolha real de 3 vias em vez de resolução automática ou combate
    // direto — pedido explícito do usuário ("o jogador pode: pagar;
    // recusar; lutar").
    _banditEncounter(npc) {
        const p = window.Engine.state.player;
        if (!p) return;
        const demand = Math.min(p.gold, Utils.randomInt(15, 35) + p.level * 3);
        const menu = document.getElementById('city-bandit-menu');
        const textEl = document.getElementById('city-bandit-text');
        if (!menu || !textEl) return;
        textEl.innerText = `"Sua bolsa ou seu sangue. ${demand} de ouro, agora."`;
        menu.classList.remove('hidden');

        const closeAndRemove = () => {
            menu.classList.add('hidden');
            const idx = this.npcs.indexOf(npc);
            if (idx >= 0) this.npcs.splice(idx, 1);
            this.bandit = null;
        };

        const startFight = () => {
            closeAndRemove();
            this._toast('O bandido avança pra cima de você!', 'error');
            setTimeout(() => {
                if (this._isActive() && window.UI && window.UI.beginBattleWith) {
                    const arenaMenu = document.getElementById('city-arena-menu');
                    if (arenaMenu) arenaMenu.classList.add('hidden');
                    window.UI.beginBattleWith(this._makeBanditEnemy(p));
                }
            }, 1400);
        };

        document.getElementById('btn-bandit-pay').onclick = () => {
            p.gold -= demand;
            window.SaveManager.save(window.Engine.state);
            closeAndRemove();
            this._toast(`Você paga ${demand}g e o bandido se afasta, satisfeito.`, 'info');
            if (window.AudioManager) window.AudioManager.playConfirm();
        };

        document.getElementById('btn-bandit-fight').onclick = () => startFight();

        // Recusar tenta se afastar sem pagar — Carisma dá uma chance real
        // de o bandido desistir (mesmo mecanismo de negociação já usado
        // em _eventThief), mas sem garantia: pode escalar pra luta do
        // mesmo jeito (pedido explícito: "se recusar, PODE iniciar
        // batalha" — nunca 100% de um lado ou do outro).
        document.getElementById('btn-bandit-refuse').onclick = () => {
            const cha = p.getTotalStat ? p.getTotalStat('cha') : 5;
            if (Utils.chance(cha * 3)) {
                closeAndRemove();
                this._toast('Suas palavras convencem o bandido a procurar outro alvo.', 'success');
                if (window.AudioManager) window.AudioManager.playConfirm();
            } else {
                startFight();
            }
        };
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

        // Só o céu/montanhas/floresta distante (ver GraphicsEngine.
        // drawCityBackdrop) continuam em coordenada de TELA — são um
        // degradê/silhueta bem ao fundo, igual pra qualquer posição da
        // câmera. O CHÃO da praça (piso com juntas de pedra) e a muralha
        // com o portão precisam rolar JUNTO com prédios/vegetação/NPCs —
        // bug reportado: deixar o piso em coordenada de tela fazia os
        // prédios "flutuarem" deslizando por cima de um chão parado, e o
        // Viajante do Portão (posicionado em coordenada de MUNDO) ficava
        // desalinhado de uma muralha ainda desenhada em coordenada de
        // tela por GraphicsEngine. Por isso os dois entram AQUI DENTRO,
        // no mesmo ctx.translate de tudo mais, usando _worldWidth() em
        // vez da largura do canvas.
        // Só o eixo X pan de verdade na Praça — o mundo da cidade sempre foi
        // desenhado só MAIS LARGO que a tela (ver _worldWidth), nunca mais
        // alto, então usar offset.dy (calculado por Camera.getOffset a
        // partir de player.y, pensado pro Mundo da Estrada, que TEM uma
        // faixa vertical de verdade) empurrava chão/muralha/prédios pra
        // cima/baixo por até ~300px — abrindo uma fresta na base do canvas
        // (chão não cobria mais até o fim) que revelava o que sobrou lá
        // (bug reportado: "campo cheio de riscos" sob a praça).
        window.Camera.follow(this.player);
        // Trava a câmera pra nunca revelar além de [0, _worldWidth()] — a
        // face externa das muralhas laterais (ver graphics.js
        // _drawCitySideWall) fica exatamente nesses dois limites, então
        // travar a câmera ali garante que a muralha seja sempre a última
        // coisa visível, sem nenhuma fresta vazia depois dela.
        //
        // Bug corrigido (relatado pelo usuário com print): esta função
        // chegou a desenhar um chão+vegetação "externo" PRÓPRIO além da
        // muralha — mas o jogo JÁ tinha uma paisagem de fundo pra "o que
        // existe além da cidade" (ver GraphicsEngine.drawCityBackdrop:
        // montanhas + linha de árvores + escadaria), só que ela é desenhada
        // em coordenada de TELA (sempre na MESMA posição do canvas,
        // independente de onde a câmera está — decisão de bem antes da
        // câmera de mundo existir). Ter as DUAS camadas ao mesmo tempo (uma
        // rolando com o mundo, outra fixa na tela) fazia a vegetação de
        // fundo "flutuar" fora de sincronia com a muralha nova, parecendo
        // uma muralha malposicionada com um pedaço de cenário quebrado
        // logo atrás. A correção é simples: sem nenhum chão/vegetação
        // extra daqui pra fora, só travar a câmera bem na muralha — o
        // fundo de tela já cuidava (e continua cuidando) da sensação de
        // "o mundo continua além da cidade".
        const worldW = this._worldWidth();
        const halfScreen = w / 2;
        const minCamX = halfScreen, maxCamX = worldW - halfScreen;
        window.Camera.x = (minCamX <= maxCamX) ? Utils.clamp(window.Camera.x, minCamX, maxCamX) : worldW / 2;
        const offset = window.Camera.getOffset(w, h);
        ctx.save();
        ctx.translate(offset.dx, 0);

        this._drawPlazaGround(ctx, worldW, h, horizon);
        if (window.GFX && window.GFX._drawCityWall) window.GFX._drawCityWall(ctx, worldW, horizon, this._plazaBottom(h));

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
            // Veios de Minério (ver _spawnOreVeinsIfNeeded) — mesmo
            // ordenamento por profundidade que as Pedras de Luz acima.
            ...this.oreVeins.filter(v => !v.collected).map(v => ({ y: this._oreVeinPos(v).y, draw: () => this._drawOreVein(ctx, v) })),
            { y: this.player.y, draw: () => this._drawPlayer(ctx) },
        ];
        drawables.sort((a, b) => a.y - b.y);
        drawables.forEach(d => d.draw());

        ctx.restore();
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
        const worldW = this._worldWidth();
        const x = this.fountain.xFrac * worldW, y = this._horizon(h) + this.fountain.rowOffset * scale;
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
        const x = s.xFrac * this._worldWidth(), y = this._horizon(h) + s.rowOffset * scale;
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

    // Veio de Minério (Reino Anão) — mesma estrutura de _drawLightStone
    // acima (rocha + brilho pulsante, sem bake), mas com uma silhueta
    // maior e mais "achatada" (um afloramento de rocha, não uma pedra
    // solta) e a cor do brilho variando pelo `tier` sorteado (ver
    // CityEngine.ORE_TIER_MATERIAL) — cinza opaco pro minério comum até
    // dourado pro Adamante Anão, dando uma pista visual de valor antes
    // mesmo de clicar.
    _drawOreVein(ctx, vein) {
        const h = window.Engine.height;
        const pos = this._oreVeinPos(vein);
        const scale = this._cityScale(h);
        const t = performance.now() * 0.0025;
        const pulse = 0.6 + Math.sin(t + vein.id * 1.7) * 0.4;
        const r = 11 * scale;
        const tierColors = { 1: '170,170,170', 2: '220,150,90', 3: '140,210,240', 4: '190,140,240', 5: '255,220,110' };
        const rgb = tierColors[vein.tier] || tierColors[1];

        ctx.save();
        const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 2.6);
        glow.addColorStop(0, `rgba(${rgb},${0.45 * pulse})`);
        glow.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 2.6, 0, Math.PI * 2); ctx.fill();

        // Afloramento de rocha — mais largo/baixo que a Pedra de Luz, como
        // um pedaço de parede mineral saindo do chão.
        ctx.fillStyle = '#4a4650';
        ctx.beginPath();
        ctx.moveTo(pos.x - r * 1.3, pos.y);
        ctx.lineTo(pos.x - r * 0.8, pos.y - r * 0.55);
        ctx.lineTo(pos.x - r * 0.1, pos.y - r * 0.85);
        ctx.lineTo(pos.x + r * 0.7, pos.y - r * 0.5);
        ctx.lineTo(pos.x + r * 1.3, pos.y);
        ctx.closePath();
        ctx.fill();

        // Veios minerais visíveis na rocha, na cor do tier.
        ctx.strokeStyle = `rgba(${rgb},${0.75 + pulse * 0.25})`;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(pos.x - r * 0.7, pos.y - r * 0.1);
        ctx.lineTo(pos.x - r * 0.2, pos.y - r * 0.5);
        ctx.moveTo(pos.x + r * 0.1, pos.y - r * 0.2);
        ctx.lineTo(pos.x + r * 0.6, pos.y - r * 0.55);
        ctx.stroke();
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
        const x = v.xFrac * this._worldWidth(), y = this._horizon(h) + v.rowOffset * scale;
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
        } else if (type === 'stalagmite') {
            // Formação rochosa afiada com um veio de cristal brilhando por
            // dentro (Reino Anão) — usada nos slots 'edge', em vez de
            // árvore/planta: não há vegetação nenhuma dentro de uma montanha.
            ctx.fillStyle = '#4a4650';
            ctx.beginPath();
            ctx.moveTo(x - 14 * scale, y - 2 * scale);
            ctx.lineTo(x - 4 * scale, y - 70 * scale);
            ctx.lineTo(x + 6 * scale, y - 2 * scale);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#6a6672';
            ctx.beginPath();
            ctx.moveTo(x + 2 * scale, y - 2 * scale);
            ctx.lineTo(x + 8 * scale, y - 40 * scale);
            ctx.lineTo(x + 13 * scale, y - 2 * scale);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(110,200,255,0.75)';
            ctx.lineWidth = 2 * scale;
            ctx.beginPath();
            ctx.moveTo(x - 6 * scale, y - 6 * scale);
            ctx.lineTo(x - 2 * scale, y - 42 * scale);
            ctx.stroke();
        } else if (type === 'crystalCluster') {
            // Aglomerado de cristais mágicos brutos, brilho azul-ciano
            // pulsante (Reino Anão) — usado nos slots 'center', ladeando o
            // braseiro de metal fundido em vez da fonte de água.
            const facets = [[-8, -2, 10], [6, -4, 14], [0, -16, 18], [-4, -22,10], [9, -14, 9]];
            facets.forEach(([dx, dy, hgt]) => {
                ctx.fillStyle = 'rgba(70,180,220,0.55)';
                ctx.beginPath();
                ctx.moveTo(x + dx * scale - 4 * scale, y + dy * scale);
                ctx.lineTo(x + dx * scale, y + dy * scale - hgt * scale);
                ctx.lineTo(x + dx * scale + 4 * scale, y + dy * scale);
                ctx.closePath();
                ctx.fill();
            });
            ctx.fillStyle = 'rgba(180,240,255,0.8)';
            ctx.beginPath();
            ctx.arc(x, y - 14 * scale, 4 * scale, 0, Math.PI * 2);
            ctx.fill();
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

    // Escurece uma cor hex em direção ao preto por `percent` (0-1) — usado
    // pela fachada BRUTA da Fortaleza Orc (ver _bakeBuildingShell), que
    // precisa de um tom bem mais escuro/duro que o gradiente clareado
    // padrão dos outros estilos de arquitetura.
    _darkenHex(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const mix = c => Math.max(0, Math.round(c * (1 - percent)));
        const r = mix((num >> 16) & 0xff), g = mix((num >> 8) & 0xff), b = mix(num & 0xff);
        return `rgb(${r},${g},${b})`;
    }

    // Mistura uma cor hex em direção a OUTRA cor hex (não preto/branco) por
    // `percent` (0-1) — usado pela fachada ÉLFICA (ver
    // _bakeBuildingShellElfico) pra tingir a parede de verde de verdade.
    // `_lightenHex` sozinho só deixava a MESMA cor marrom mais clara (bug
    // desta iteração: o comentário dizia "parede tingida de verde" mas o
    // código nunca misturava verde nenhum, só clareava a cor original —
    // confirmado com um teste de pixel comparando Porto Helênico x
    // Santuário Élfico, que voltavam quase idênticos).
    _tintHex(hex, targetHex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const tnum = parseInt(targetHex.replace('#', ''), 16);
        const mix = (c, t) => Math.round(c + (t - c) * percent);
        const r = mix((num >> 16) & 0xff, (tnum >> 16) & 0xff);
        const g = mix((num >> 8) & 0xff, (tnum >> 8) & 0xff);
        const b = mix(num & 0xff, tnum & 0xff);
        return `rgb(${r},${g},${b})`;
    }


    // Prédio procedural — a "forma" (colunas retas + telhado triangular
    // grego) era IDÊNTICA em toda cidade, então mesmo com paleta de cores
    // própria por cidade (ver citydatabase.js `wallColors`/`accentColor`)
    // a Fortaleza Orc e o Santuário Élfico continuavam parecendo Porto
    // Helênico repintado — nunca uma arquitetura realmente própria, como
    // pedido explicitamente pelo usuário ("Toda arquitetura [orc] deve
    // parecer brutal" / "Arquitetura elegante [élfica]. Raízes. Madeira
    // viva."). `buildingStyle` (ver citydatabase.js) escolhe entre 3
    // formas de fachada abaixo — 'greco' (padrão, Porto Helênico,
    // intocado), 'orc' (paredes escurecidas, vigas de ferro em vez de
    // colunas de mármore, telhado plano com ameias serrilhadas) e 'elfico'
    // (paredes tingidas de verde, raízes retorcidas em vez de colunas
    // retas, telhado em cúpula orgânica com um brilho de espírito no
    // cume). As dimensões já vêm escaladas de _buildingRect (telas baixas
    // encolhem os prédios pra sempre caberem entre o horizonte e o
    // rodapé da praça).
    // Migração p/ pipeline de sprites (ver js/spritesystem.js): a fachada
    // inteira do prédio (sombra, parede em gradiente, colunas, telhado,
    // porta) é 100% estática pra um dado prédio numa dada tela — só
    // recalculada quando o tamanho da janela muda (bw/bh vêm de
    // _buildingRect, que já reage a isso) ou o jogador viaja pra uma
    // cidade com outro `buildingStyle` (por isso `style` entra na chave
    // do cache — sem isso, viajar mostraria a fachada da cidade ANTERIOR
    // até o tamanho da janela mudar). Bakear evita recriar ~5-8
    // gradientes lineares por prédio a cada um dos 60 quadros por segundo.
    // Tochas (chama animada) e texto (nome, ícone, mural do campeão — que
    // pode mudar a qualquer vitória) continuam desenhados ao vivo por cima.
    _bakeBuildingShell(b, bw, bh) {
        const halfW = bw / 2 + 12;
        const topY = -(bh * 1.3) - 4;
        const botY = 18;
        const w = halfW * 2, h = botY - topY;
        const anchorX = halfW, anchorY = -topY;
        const cityDef = window.getCurrentCityDef ? window.getCurrentCityDef() : null;
        const style = (cityDef && cityDef.buildingStyle) || 'greco';
        const key = `building:${b.id}|${Math.round(bw)}|${Math.round(bh)}|${b.wall}|${b.roof}|${style}`;
        return {
            canvas: window.SpriteCache.get(key, w, h, (bctx) => {
                bctx.translate(anchorX, anchorY);
                const left = -bw / 2, top = -bh;

                // Sombra no chão — igual nos 3 estilos.
                bctx.fillStyle = 'rgba(0,0,0,0.25)';
                bctx.beginPath();
                bctx.ellipse(0, 4, bw * 0.55, 10, 0, 0, Math.PI * 2);
                bctx.fill();

                if (style === 'orc') this._bakeBuildingShellOrc(bctx, b, bw, bh, left, top);
                else if (style === 'elfico') this._bakeBuildingShellElfico(bctx, b, bw, bh, left, top);
                else if (style === 'anao') this._bakeBuildingShellAnao(bctx, b, bw, bh, left, top);
                else this._bakeBuildingShellGreco(bctx, b, bw, bh, left, top);

                // Porta — igual nos 3 estilos.
                bctx.fillStyle = '#2a1c10';
                const doorW = bw * 0.22, doorH = bh * 0.42;
                bctx.fillRect(-doorW / 2, -doorH, doorW, doorH);
            }),
            anchorX, anchorY
        };
    }

    // Estilo padrão (Porto Helênico e qualquer cidade futura sem
    // `buildingStyle` definido) — EXATAMENTE o desenho greco-romano
    // original (base + colunas de mármore + telhado triangular/pediment),
    // intocado, pra nenhuma cidade existente mudar de aparência sem querer.
    _bakeBuildingShellGreco(bctx, b, bw, bh, left, top) {
        const wallGrad = bctx.createLinearGradient(0, top, 0, top + bh);
        wallGrad.addColorStop(0, this._lightenHex(b.wall, 0.22));
        wallGrad.addColorStop(1, b.wall);
        bctx.fillStyle = wallGrad;
        bctx.fillRect(left, top, bw, bh);

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
    }

    // Estilo BRUTO (Fortaleza Orc, pedido explícito do usuário: "toda
    // arquitetura deve parecer brutal") — parede escurecida (pedra/ferro
    // sujo, sem o clareado "polido" grego), vigas de ferro grossas nos
    // cantos em vez de colunas de mármore finas, telhado PLANO (sem
    // pediment elegante) com ameias serrilhadas na beirada e uma viga
    // cruzada de reforço — silhueta mais pesada e angulosa de propósito.
    _bakeBuildingShellOrc(bctx, b, bw, bh, left, top) {
        const wallGrad = bctx.createLinearGradient(0, top, 0, top + bh);
        wallGrad.addColorStop(0, b.wall);
        wallGrad.addColorStop(1, this._darkenHex(b.wall, 0.35));
        bctx.fillStyle = wallGrad;
        bctx.fillRect(left, top, bw, bh);

        // Vigas de ferro nos cantos + uma central — grossas e escuras, sem
        // o brilho de mármore polido das colunas gregas.
        const beamW = Math.max(8, bw * 0.07);
        const beamXs = [left + beamW * 0.4, 0, left + bw - beamW * 1.4];
        bctx.fillStyle = 'rgba(20,18,16,0.85)';
        for (const bx of beamXs) bctx.fillRect(bx, top + 4, beamW, bh - 8);
        // Rebites (pequenos círculos) ao longo das vigas laterais — reforça
        // a sensação de "ferro remendado", não madeira/pedra lisa.
        bctx.fillStyle = 'rgba(90,85,75,0.9)';
        for (const bx of [beamXs[0], beamXs[2]]) {
            for (let ry = top + 12; ry < top + bh - 8; ry += 18) {
                bctx.beginPath();
                bctx.arc(bx + beamW / 2, ry, 2.2, 0, Math.PI * 2);
                bctx.fill();
            }
        }

        // Telhado plano e escuro (sem triângulo elegante) com ameias
        // serrilhadas — mais fortaleza de guerra que templo.
        const roofY = top - bh * 0.14;
        bctx.fillStyle = this._darkenHex(b.roof, 0.1);
        bctx.fillRect(left - 8, roofY, bw + 16, top - roofY + 6);
        const merlonW = Math.max(10, bw / 8);
        bctx.fillStyle = this._darkenHex(b.roof, 0.25);
        for (let mx = left - 8; mx < left + bw + 8; mx += merlonW * 1.6) {
            bctx.fillRect(mx, roofY - 8, merlonW, 10);
        }
    }

    // Estilo ÉLFICO (Santuário Élfico, pedido explícito do usuário:
    // "Arquitetura elegante. Raízes... Árvores gigantes. Madeira viva.")
    // — parede tingida de verde (madeira viva, não pedra/mármore), raízes
    // retorcidas (curvas orgânicas) em vez de colunas retas, telhado em
    // forma de cúpula/copa de árvore (arco suave, não um triângulo reto)
    // com um brilho de espírito da floresta no cume.
    _bakeBuildingShellElfico(bctx, b, bw, bh, left, top) {
        const wallGrad = bctx.createLinearGradient(0, top, 0, top + bh);
        wallGrad.addColorStop(0, this._tintHex(b.wall, '#6a9a5a', 0.45));
        wallGrad.addColorStop(1, this._tintHex(b.wall, '#2a4a2a', 0.5));
        bctx.fillStyle = wallGrad;
        bctx.fillRect(left, top, bw, bh);

        // Raízes retorcidas ladeando a fachada — curvas orgânicas em vez de
        // colunas retas, afinando conforme sobem (mesmo espírito visual das
        // raízes já usadas alhures na identidade élfica).
        bctx.strokeStyle = '#3a4a2a';
        bctx.lineCap = 'round';
        const rootXs = [left + bw * 0.08, left + bw * 0.5, left + bw * 0.92];
        for (const rx of rootXs) {
            bctx.lineWidth = 7;
            bctx.beginPath();
            bctx.moveTo(rx, top + bh);
            bctx.quadraticCurveTo(rx + (rx < 0 ? -10 : 10), top + bh * 0.45, rx, top + 4);
            bctx.stroke();
        }

        // Telhado em cúpula orgânica (copa de árvore) — arco suave em vez
        // do pediment triangular reto do estilo grego, tingido de verde
        // (copa viva) em vez do tom de telhado original sem mistura.
        const roofGrad = bctx.createLinearGradient(0, top - bh * 0.32, 0, top);
        roofGrad.addColorStop(0, this._tintHex(b.roof, '#6ab568', 0.55));
        roofGrad.addColorStop(1, this._tintHex(b.roof, '#2a5a2a', 0.4));
        bctx.fillStyle = roofGrad;
        bctx.beginPath();
        bctx.moveTo(left - 10, top);
        bctx.quadraticCurveTo(0, top - bh * 0.55, left + bw + 10, top);
        bctx.closePath();
        bctx.fill();

        // Brilho de espírito da floresta no cume — mesmo tom já usado nas
        // raízes ancestrais da identidade élfica (ver graphics.js/nature.js).
        bctx.fillStyle = 'rgba(140,230,150,0.75)';
        bctx.beginPath();
        bctx.arc(0, top - bh * 0.32, 3.5, 0, Math.PI * 2);
        bctx.fill();
    }

    // Estilo ANÃO (Reino Subterrâneo de Kharzum, pedido explícito do
    // usuário: "a cidade deve parecer construída pelos anões" — pedra
    // maciça, metal, correntes, brilho de forja). Terceira variação real de
    // fachada (depois de orc/elfico): alvenaria de blocos de pedra entalhada
    // (frisos horizontais, nunca lisa como o mármore grego nem escurecida
    // como o ferro orc), pilares retangulares grossos com um friso central
    // brilhando em tom de brasa (rúnico, não decorativo à toa — remete à
    // Forja), uma corrente pendurada entre os pilares laterais (identidade
    // "correntes" pedida explicitamente) e um telhado de LAJE PLANA de
    // pedra (sem pediment nem ameias) com uma fresta de brilho alaranjado
    // na borda, como se o calor da forja escapasse por dentro.
    _bakeBuildingShellAnao(bctx, b, bw, bh, left, top) {
        const wallGrad = bctx.createLinearGradient(0, top, 0, top + bh);
        wallGrad.addColorStop(0, this._lightenHex(b.wall, 0.12));
        wallGrad.addColorStop(1, this._darkenHex(b.wall, 0.3));
        bctx.fillStyle = wallGrad;
        bctx.fillRect(left, top, bw, bh);

        // Frisos horizontais de alvenaria (blocos de pedra entalhados).
        bctx.strokeStyle = 'rgba(10,10,14,0.5)';
        bctx.lineWidth = 1.5;
        const rows = Math.max(2, Math.floor(bh / 22));
        for (let i = 1; i < rows; i++) {
            const sy = top + (bh / rows) * i;
            bctx.beginPath();
            bctx.moveTo(left, sy);
            bctx.lineTo(left + bw, sy);
            bctx.stroke();
        }

        // Pilares retangulares grossos (pedra maciça, não colunas finas de
        // mármore) com um friso rúnico brilhante (brasa) no centro de cada um.
        const pillarW = Math.max(9, bw * 0.08);
        const pillarXs = [left + pillarW * 0.5, 0, left + bw - pillarW * 1.5];
        for (const px of pillarXs) {
            bctx.fillStyle = this._darkenHex(b.wall, 0.15);
            bctx.fillRect(px, top + 4, pillarW, bh - 8);
            bctx.strokeStyle = 'rgba(255,170,80,0.55)';
            bctx.lineWidth = 1.4;
            bctx.beginPath();
            bctx.moveTo(px + pillarW / 2, top + 10);
            bctx.lineTo(px + pillarW / 2, top + bh - 12);
            bctx.stroke();
        }

        // Corrente pendurada entre os dois pilares laterais, perto do topo —
        // identidade "correntes" pedida explicitamente pelo usuário.
        bctx.strokeStyle = 'rgba(55,50,46,0.85)';
        bctx.lineWidth = 2;
        const chainY = top + 9;
        bctx.beginPath();
        let toggle = false;
        for (let cx = pillarXs[0] + pillarW; cx <= pillarXs[2]; cx += 9) {
            const y = chainY + (toggle ? 4 : 0);
            if (cx === pillarXs[0] + pillarW) bctx.moveTo(cx, y); else bctx.lineTo(cx, y);
            toggle = !toggle;
        }
        bctx.stroke();

        // Telhado de laje plana e pesada (sem pediment, sem ameias) — mais
        // maciço/horizontal que os outros 3 estilos, condizente com uma
        // construção escavada dentro da própria montanha.
        const roofH = bh * 0.16;
        const roofGrad = bctx.createLinearGradient(0, top - roofH, 0, top);
        roofGrad.addColorStop(0, this._lightenHex(b.roof, 0.18));
        roofGrad.addColorStop(1, this._darkenHex(b.roof, 0.2));
        bctx.fillStyle = roofGrad;
        bctx.fillRect(left - 14, top - roofH, bw + 28, roofH + 6);

        // Fresta de brilho de forja na borda do telhado — calor escapando
        // de dentro, identidade "iluminação de forjas" pedida explicitamente.
        bctx.fillStyle = 'rgba(255,140,50,0.55)';
        bctx.fillRect(left - 14, top - 2, bw + 28, 3);
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

    // Mapa tier→id(s) de material (ver items.js ItemDatabase.materials/
    // _collectOreVein acima) — um veio guarda o TIER sorteado (número), não
    // o id do template diretamente. Tier 2 lista DOIS materiais (Ferro e
    // Carvão) — sem isso, Carvão nunca seria minerável em lugar nenhum do
    // jogo (nenhum outro sistema o produz), um recurso cadastrado e
    // completamente inalcançável.
    static get ORE_TIER_MATERIAL() {
        return { 1: ['common_ore'], 2: ['iron_ore', 'coal'], 3: ['steel_ingot'], 4: ['arcane_crystal'], 5: ['dwarven_adamant'] };
    }

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
            // Reação à REPUTAÇÃO (ver reputation.js ReputationSystem) — eixo
            // separado da fama de vitórias acima (`famous`/`legendary`):
            // um gladiador pode ter um recorde impecável na arena e ainda
            // assim ser malvisto (roubos, crimes), ou o contrário. `infame`
            // tem prioridade sobre a fama de vitórias no _talkToNpc (a
            // desconfiança fala mais alto que o hype de vitórias), pedido
            // explícito da seção 5: "NPCs demonstram desconfiança".
            infame: [
                'Fica longe de mim. Já ouvi o suficiente sobre você pra não confiar.',
                'Guarda bem sua bolsa por perto — dizem que gente como você não hesita.',
                'Não é bem-vindo nesta conversa. Vá incomodar outro alguém.',
                'Seu nome anda pela cidade, mas não do jeito que você gostaria de ouvir.'
            ],
            // `respeitado` reage a reputação alta (mas sem depender do
            // contador de vitórias, que já tem seu próprio pool acima) —
            // pedido explícito: "NPCs podem reconhecê-lo" mesmo sem ser um
            // campeão de arena, só por agir bem pelo mundo.
            respeitado: [
                'Ouvi falar bem de você por aí — gente como você faz falta nesta cidade.',
                'Um gladiador de bom nome. É raro encontrar um desses de verdade.',
                'Minha filha fala de você como exemplo. Continue assim.'
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
            },
            // Reino Anão (Reino Subterrâneo de Kharzum) — item explícito da
            // mega-diretiva ("NPCs variados: ferreiros, mineiros,
            // mercadores, guardas, artesãos, exploradores"). Diferente de
            // Fortaleza Orc/Santuário Élfico acima (só reskin de conteúdo,
            // mesmo `name` grego), aqui os 8 slots genéricos ganham
            // TÍTULOS anões próprios (ver formato `{name, lines}` novo,
            // _talkToNpc) — sem isso, um NPC de Kharzum continuaria se
            // apresentando como "Mercador"/"Sacerdote" gregos dentro de uma
            // cidade subterrânea anã.
            reino_anao: {
                mercador: { name: 'Mercador de Minérios', lines: [
                    'Ferro, carvão, cristal bruto — se vem das minas, eu já negociei com isso.',
                    'Não venda seu minério pro primeiro que aparecer. Eu pago o preço justo, sempre.',
                    'Uma carroça inteira chegou ontem de uma veia nova. Ainda tenho o melhor lote.'
                ] },
                sacerdote: { name: 'Sacerdote da Forja', lines: [
                    'A chama da forja nunca apaga desde que meu avô a acendeu. Isso é fé de verdade.',
                    'Rezamos ao martelo e à bigorna — eles nunca nos abandonaram, nem nos dias mais duros.',
                    'Cada arma forjada aqui carrega uma bênção. Cuide bem da sua.'
                ] },
                soldado: { name: 'Guarda da Montanha', lines: [
                    'Vigio os túneis desde que era jovem demais pra erguer um machado de verdade.',
                    'Bandido nenhum passa por essa passagem sem que eu saiba. A montanha inteira me avisa.',
                    'Prefiro perder o sono a perder um mineiro pra emboscada nos corredores escuros.'
                ] },
                artesao: { name: 'Ferreiro', lines: [
                    'Cada machado que sai da minha forja carrega meu nome gravado no cabo.',
                    'Aço anão não lasca. Se lascar, devolvo seu ouro e forjo de novo, de graça.',
                    'Passei o dia inteiro na bigorna. As mãos tremem, mas o resultado vale cada golpe.'
                ] },
                campones: { name: 'Mineiro', lines: [
                    'Passei o turno inteiro nos veios mais fundos. Voltei com as costas doendo e os bolsos cheios.',
                    'Quanto mais fundo você cava, melhor o minério — e mais perigoso o que espreita lá embaixo.',
                    'Prefiro o silêncio da mina ao barulho da praça. Lá embaixo, pelo menos, sei o que me espera.'
                ] },
                poeta: { name: 'Explorador de Cavernas', lines: [
                    'Encontrei uma caverna essa semana que nenhum anão vivo tinha visto antes. Ainda estou tonto.',
                    'Cada túnel novo esconde ou um tesouro ou uma armadilha. Aprendi a gostar dos dois.',
                    'Levo giz e corda pra todo lado. Quem se perde nas profundezas raramente volta a contar a história.'
                ] },
                veterano: { name: 'Veterano da Arena', lines: [
                    'Já lutei no Fosso do Martelo antes de você nascer. A pedra ainda lembra do meu sangue.',
                    'Um campeão anão não cai fácil — o peso do martelo cansa o braço do adversário primeiro.',
                    'Vi gladiadores de todas as terras passarem por Kharzum. Poucos entenderam o que é lutar sob a montanha.'
                ] },
                banqueiro: { name: 'Tesoureiro da Montanha', lines: [
                    'Nosso cofre fica atrás de três portas de pedra maciça. Nem um exército inteiro forçaria aquilo.',
                    'Ouro anão rende juros justos — não confiamos em promessas vazias, só em metal contado.',
                    'Guardamos riqueza como guardamos minério: fundo, seguro, e longe de olhos gananciosos.'
                ] }
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
