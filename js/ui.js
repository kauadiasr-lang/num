/**
 * Gerenciador de Interface de Usuário
 */
class UIManager {
    constructor() {
        this.screens = document.querySelectorAll('.screen');

        // Dados temporários para a criação de personagem
        this.creationData = {
            pointsLeft: 10,
            stats: { str: 5, agi: 5, int: 5, def: 5, acc: 5, luk: 5, cha: 5 },
            names: { str: "Força", agi: "Agilidade", int: "Inteligência", def: "Defesa", acc: "Precisão", luk: "Sorte", cha: "Carisma" },
            visuals: {
                gender: 'Masculino', skinTone: '#ffcc99', hairStyle: 1, hairColor: '#2a1c10',
                beardStyle: 0, beardColor: '#2a1c10', eyebrowColor: '#2a1c10', eyeColor: '#1a1a1a', faceShape: 1
            }
        };

        this.genderOptions = ['Masculino', 'Feminino'];
        // Índice = hairStyle (1-based). "genders" restringe a opção a um
        // gênero só por identidade visual (Sims/WoW-style) — puramente
        // estético, nunca afeta atributos, dano ou qualquer vantagem.
        this.hairOptions = [
            { name: 'Sayajin Espetado', genders: ['Masculino', 'Feminino'] },
            { name: 'Sayajin Longo', genders: ['Masculino', 'Feminino'] },
            { name: 'Moicano', genders: ['Masculino'] },
            { name: 'Samurai', genders: ['Masculino'] },
            { name: 'Rabo de Cavalo', genders: ['Masculino', 'Feminino'] },
            { name: 'Cabelo Preso', genders: ['Feminino'] },
            { name: 'Cacheado', genders: ['Masculino', 'Feminino'] },
            { name: 'Afro', genders: ['Masculino', 'Feminino'] },
            { name: 'Longo Liso', genders: ['Masculino', 'Feminino'] },
            { name: 'Tranças', genders: ['Feminino'] },
            { name: 'Cabelo Raspado', genders: ['Masculino', 'Feminino'] },
            { name: 'Careca', genders: ['Masculino', 'Feminino'] },
            { name: 'Franja', genders: ['Masculino', 'Feminino'] },
            { name: 'Cabelo Bagunçado', genders: ['Masculino', 'Feminino'] },
            { name: 'Gladiador Romano', genders: ['Masculino', 'Feminino'] }
        ];
        // Índice = beardStyle (0 = nenhuma, sempre disponível pros dois).
        this.beardOptions = [
            { name: 'Nenhuma', genders: ['Masculino', 'Feminino'] },
            { name: 'Cavanhaque', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Curta', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Média', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Longa', genders: ['Masculino'] },
            { name: 'Bigode', genders: ['Masculino', 'Feminino'] },
            { name: 'Bigode Imperial', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Cheia', genders: ['Masculino', 'Feminino'] },
            { name: 'Costeletas', genders: ['Masculino', 'Feminino'] },
            { name: 'Barba Viking', genders: ['Masculino'] },
            { name: 'Barba Trançada', genders: ['Masculino'] },
            { name: 'Barba por Fazer', genders: ['Masculino', 'Feminino'] }
        ];
        this.faceOptions = ['Redondo', 'Oval', 'Anguloso'];
        this._previewRAFId = null;

        this.currentShopItems = [];

        this.initEventListeners();
    }

    // `transition` escolhe a animação de entrada: 'fade' (padrão), 'zoom',
    // 'slide' ou 'darken'. Nunca instantâneo — toda troca de tela anima.
    showScreen(screenId, transition = 'fade') {
        const target = document.getElementById(screenId);
        this.screens.forEach(s => {
            s.classList.remove('active');
            s.classList.remove('transition-zoom', 'transition-slide', 'transition-darken');
        });
        if (transition !== 'fade') target.classList.add(`transition-${transition}`);
        target.classList.add('active');

        // Uma tela anterior mais alta que a viewport pode ter forçado o navegador
        // a rolar a página (ex: ao focar um campo/botão perto do fim do conteúdo).
        // Essa rolagem residual "gruda" e desloca visualmente a próxima tela, mesmo
        // sendo ela 100% do viewport — então zeramos toda rolagem a cada troca de tela.
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document.getElementById('game-container').scrollTop = 0;
        document.getElementById(screenId).scrollTop = 0;

        // Sincroniza estado para o Motor Gráfico saber o que renderizar
        if (screenId === 'screen-battle') {
            window.Engine.state.screen = 'BATTLE';
        } else {
            window.Engine.state.screen = screenId.toUpperCase().replace('SCREEN-', '');
            // Limpa partículas antigas ao sair da batalha
            if (window.GFX) {
                window.GFX.particles = [];
                window.GFX.floatingTexts = [];
            }
        }
    }

    initEventListeners() {
        // --- Navegação do Hub ---
        document.getElementById('btn-arena').addEventListener('click', () => this.startBattle());
        document.getElementById('btn-ladder').addEventListener('click', () => this.openLadder());
        document.getElementById('btn-shop').addEventListener('click', () => this.openShop());
        document.getElementById('btn-inventory').addEventListener('click', () => this.openInventory());
        document.getElementById('btn-skills').addEventListener('click', () => this.openSkillTree());
        document.getElementById('btn-healer').addEventListener('click', () => this.openHealer());
        document.getElementById('btn-achievements').addEventListener('click', () => this.openAchievements('hub'));

        // --- Fechar painéis ---
        document.getElementById('btn-close-inv').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-shop').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-skills').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-ladder').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-healer').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-achievements').addEventListener('click', () => {
            // Se foi aberta a partir do Menu Principal (sem sessão de jogo ativa,
            // só espiando o save mais recente), volta pro menu e descarta o
            // personagem temporário em vez de "entrar" na Cidade sem querer.
            if (this._achievementsSource === 'mainmenu') {
                if (window.MainMenu && window.MainMenu._peekingPlayer) {
                    window.Engine.state.player = null;
                    window.MainMenu._peekingPlayer = false;
                }
                window.MainMenu.showMainMenu();
            } else {
                this.showScreen('screen-hub');
            }
        });

        // --- Ações de Batalha ---
        document.getElementById('btn-atk').addEventListener('click', () => {
            if (window.BattleEngine) window.BattleEngine.executePlayerTurn('ATK');
        });
        document.getElementById('btn-def').addEventListener('click', () => {
            if (window.BattleEngine) window.BattleEngine.executePlayerTurn('DEF');
        });
        document.getElementById('btn-skill').addEventListener('click', () => this.openBattleSkillMenu());
        document.getElementById('btn-item').addEventListener('click', () => this.openBattleItemMenu());
        document.getElementById('btn-close-skill-menu').addEventListener('click', () => {
            document.getElementById('battle-skills-menu').classList.add('hidden');
        });
        document.getElementById('btn-close-item-menu').addEventListener('click', () => {
            document.getElementById('battle-items-menu').classList.add('hidden');
        });

        // --- Movimentação Tática (Aproximar, Recuar, Correr, Investida, Manter Distância) ---
        document.getElementById('btn-move').addEventListener('click', () => {
            document.getElementById('battle-move-menu').classList.remove('hidden');
        });
        document.getElementById('btn-close-move-menu').addEventListener('click', () => {
            document.getElementById('battle-move-menu').classList.add('hidden');
        });
        const moveActions = { 'btn-move-approach': 'APPROACH', 'btn-move-retreat': 'RETREAT', 'btn-move-run': 'RUN', 'btn-move-charge': 'CHARGE', 'btn-move-hold': 'HOLD' };
        for (let btnId in moveActions) {
            document.getElementById(btnId).addEventListener('click', () => {
                document.getElementById('battle-move-menu').classList.add('hidden');
                if (window.BattleEngine) window.BattleEngine.executePlayerTurn(moveActions[btnId]);
            });
        }

        // --- Retorno da Tela de Resultados ---
        document.getElementById('btn-return-hub').addEventListener('click', () => {
            window.SaveManager.save(window.Engine.state);
            this.updateHubStats();
            this.showScreen('screen-hub');
        });

        // --- Tooltip segue o mouse (Desktop) ---
        document.addEventListener('mousemove', (e) => {
            const tt = document.getElementById('item-tooltip');
            if (!tt.classList.contains('hidden')) {
                tt.style.left = `${e.clientX}px`;
                tt.style.top = `${e.clientY}px`;
            }
        });

        // --- Seletores Visuais do Criador de Personagem (todos atualizam o preview ao vivo) ---
        document.getElementById('btn-gender').addEventListener('click', (e) => {
            const idx = (this.genderOptions.indexOf(this.creationData.visuals.gender) + 1) % this.genderOptions.length;
            this.creationData.visuals.gender = this.genderOptions[idx];
            e.target.innerText = this.creationData.visuals.gender;
            // Cabelo/barba atuais podem não existir para o novo gênero (identidade
            // visual apenas — nunca afeta atributos/combate); ajusta se preciso.
            this._ensureValidHairBeardForGender();
        });
        // Cor de pele livre: qualquer cor é aceita, incluindo tons não convencionais (verde, azul, etc)
        document.getElementById('char-skin-color').addEventListener('input', (e) => {
            this.creationData.visuals.skinTone = e.target.value;
        });
        document.getElementById('btn-hair').addEventListener('click', () => this._cycleHair(1));
        document.getElementById('char-hair-color').addEventListener('input', (e) => {
            this.creationData.visuals.hairColor = e.target.value;
        });
        document.getElementById('btn-beard').addEventListener('click', () => this._cycleBeard(1));
        document.getElementById('char-beard-color').addEventListener('input', (e) => {
            this.creationData.visuals.beardColor = e.target.value;
        });
        document.getElementById('char-eye-color').addEventListener('input', (e) => {
            this.creationData.visuals.eyeColor = e.target.value;
        });
        const btnRandomize = document.getElementById('btn-randomize-look');
        if (btnRandomize) btnRandomize.addEventListener('click', () => this.randomizeAppearance());
        document.getElementById('btn-face').addEventListener('click', (e) => {
            const idx = this.creationData.visuals.faceShape % this.faceOptions.length;
            this.creationData.visuals.faceShape = idx + 1;
            e.target.innerText = this.faceOptions[idx];
        });

        // --- Configuração: sangue nos combates (opcional, desligado por padrão) ---
        document.getElementById('btn-toggle-blood').addEventListener('click', (e) => {
            window.GFX.bloodEnabled = !window.GFX.bloodEnabled;
            e.target.innerText = window.GFX.bloodEnabled ? 'Ligado' : 'Desligado';
        });

        // --- Sonorização Global de UI ---
        // Delegado no document (fase de captura, já que mouseenter/mouseleave não
        // borbulham) em vez de anexado a cada <button> individualmente: botões
        // criados dinamicamente depois da inicialização (Comprar na loja, Aprender
        // no talento, +/- de atributos no inventário, etc) também tocam o som,
        // o que não acontecia quando os listeners eram presos só aos botões
        // existentes no DOM no momento da construção do UIManager.
        document.addEventListener('mouseenter', (e) => {
            const btn = e.target.closest && e.target.closest('button');
            if (btn && !btn.disabled && window.AudioManager.initialized) window.AudioManager.playUIHover();
        }, true);
        document.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('button');
            if (btn && !btn.disabled && window.AudioManager.initialized) window.AudioManager.playUIClick();
        }, true);
    }

    // --- Identidade Visual (Cabelo/Barba) ---
    // Avança para o próximo estilo de cabelo disponível para o gênero atual
    // (pula opções exclusivas do outro gênero em vez de travar nelas).
    _cycleHair(direction = 1) {
        const gender = this.creationData.visuals.gender;
        const n = this.hairOptions.length;
        let idx = this.creationData.visuals.hairStyle - 1;
        for (let i = 0; i < n; i++) {
            idx = (idx + direction + n) % n;
            if (this.hairOptions[idx].genders.includes(gender)) break;
        }
        this.creationData.visuals.hairStyle = idx + 1;
        document.getElementById('btn-hair').innerText = this.hairOptions[idx].name;
    }

    _cycleBeard(direction = 1) {
        const gender = this.creationData.visuals.gender;
        const n = this.beardOptions.length;
        let idx = this.creationData.visuals.beardStyle;
        for (let i = 0; i < n; i++) {
            idx = (idx + direction + n) % n;
            if (this.beardOptions[idx].genders.includes(gender)) break;
        }
        this.creationData.visuals.beardStyle = idx;
        document.getElementById('btn-beard').innerText = this.beardOptions[idx].name;
    }

    // Chamado ao trocar de gênero: se o cabelo/barba selecionado for
    // exclusivo do outro gênero, avança para a próxima opção válida.
    _ensureValidHairBeardForGender() {
        const gender = this.creationData.visuals.gender;
        const hair = this.hairOptions[this.creationData.visuals.hairStyle - 1];
        if (!hair || !hair.genders.includes(gender)) this._cycleHair(1);
        const beard = this.beardOptions[this.creationData.visuals.beardStyle];
        if (!beard || !beard.genders.includes(gender)) this._cycleBeard(1);
    }

    // Botão "Aleatório": sorteia uma aparência completa de uma vez (gênero,
    // rosto, cabelo/barba já respeitando o gênero sorteado, e todas as
    // cores), pra facilitar explorar a variedade sem clicar em cada opção.
    randomizeAppearance() {
        const v = this.creationData.visuals;
        const randColor = () => '#' + Utils.randomInt(0, 0xffffff).toString(16).padStart(6, '0');

        v.gender = this.genderOptions[Utils.randomInt(0, this.genderOptions.length - 1)];
        document.getElementById('btn-gender').innerText = v.gender;

        const validHair = this.hairOptions.map((h, i) => i).filter(i => this.hairOptions[i].genders.includes(v.gender));
        const hairIdx = validHair[Utils.randomInt(0, validHair.length - 1)];
        v.hairStyle = hairIdx + 1;
        document.getElementById('btn-hair').innerText = this.hairOptions[hairIdx].name;

        const validBeard = this.beardOptions.map((b, i) => i).filter(i => this.beardOptions[i].genders.includes(v.gender));
        const beardIdx = validBeard[Utils.randomInt(0, validBeard.length - 1)];
        v.beardStyle = beardIdx;
        document.getElementById('btn-beard').innerText = this.beardOptions[beardIdx].name;

        const faceIdx = Utils.randomInt(0, this.faceOptions.length - 1);
        v.faceShape = faceIdx + 1;
        document.getElementById('btn-face').innerText = this.faceOptions[faceIdx];

        v.skinTone = randColor();
        v.hairColor = randColor();
        v.beardColor = randColor();
        v.eyeColor = randColor();
        document.getElementById('char-skin-color').value = v.skinTone;
        document.getElementById('char-hair-color').value = v.hairColor;
        document.getElementById('char-beard-color').value = v.beardColor;
        document.getElementById('char-eye-color').value = v.eyeColor;

        if (window.AudioManager && window.AudioManager.initialized) window.AudioManager.playConfirm();
    }

    // --- CRIAÇÃO DE PERSONAGEM ---
    buildCreationScreen() {
        // Reseta os dados de criação para uma nova jornada
        this.creationData.pointsLeft = 10;
        this.creationData.stats = { str: 5, agi: 5, int: 5, def: 5, acc: 5, luk: 5, cha: 5 };
        this.creationData.visuals = {
            gender: 'Masculino', skinTone: '#ffcc99', hairStyle: 1, hairColor: '#2a1c10',
            beardStyle: 0, beardColor: '#2a1c10', eyebrowColor: '#2a1c10', eyeColor: '#1a1a1a', faceShape: 1
        };

        document.getElementById('char-name').value = '';
        document.getElementById('points-left').innerText = this.creationData.pointsLeft;
        document.getElementById('char-skin-color').value = this.creationData.visuals.skinTone;
        document.getElementById('btn-gender').innerText = this.creationData.visuals.gender;
        document.getElementById('btn-hair').innerText = this.hairOptions[0].name;
        document.getElementById('char-hair-color').value = this.creationData.visuals.hairColor;
        document.getElementById('btn-beard').innerText = this.beardOptions[0].name;
        document.getElementById('char-beard-color').value = this.creationData.visuals.beardColor;
        document.getElementById('char-eye-color').value = this.creationData.visuals.eyeColor;
        document.getElementById('btn-face').innerText = this.faceOptions[0];

        this.startCreatorPreviewLoop();

        const container = document.getElementById('stats-container');
        container.innerHTML = ''; // Limpa

        for (let key in this.creationData.stats) {
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <span class="stat-name">${this.creationData.names[key]}</span>
                <div class="stat-controls">
                    <button class="btn-sub" data-stat="${key}">-</button>
                    <span id="val-${key}" style="display:inline-block; width:20px; text-align:center;">${this.creationData.stats[key]}</span>
                    <button class="btn-add" data-stat="${key}">+</button>
                </div>
            `;
            container.appendChild(row);
        }

        // Delegação de eventos para os botões +/-
        container.onclick = (e) => {
            if (e.target.classList.contains('btn-add')) this.modifyStat(e.target.dataset.stat, 1);
            if (e.target.classList.contains('btn-sub')) this.modifyStat(e.target.dataset.stat, -1);
        };

        // Monitorar nome
        document.getElementById('char-name').oninput = () => this.validateCreation();

        this.validateCreation();
    }

    modifyStat(statKey, amount) {
        const currentVal = this.creationData.stats[statKey];

        if (amount > 0 && this.creationData.pointsLeft > 0 && currentVal < 15) {
            this.creationData.stats[statKey]++;
            this.creationData.pointsLeft--;
        } else if (amount < 0 && currentVal > 5) {
            this.creationData.stats[statKey]--;
            this.creationData.pointsLeft++;
        }

        document.getElementById(`val-${statKey}`).innerText = this.creationData.stats[statKey];
        document.getElementById('points-left').innerText = this.creationData.pointsLeft;
        this.validateCreation();
    }

    validateCreation() {
        const nameInput = document.getElementById('char-name').value.trim();
        const btnFinish = document.getElementById('btn-finish-creation');

        if (nameInput.length >= 3 && this.creationData.pointsLeft === 0) {
            btnFinish.classList.remove('disabled');
            btnFinish.onclick = () => this.finalizeCharacterCreation();
        } else {
            btnFinish.classList.add('disabled');
            btnFinish.onclick = null;
        }
    }

    // Preview em tempo real do gladiador no criador: reaproveita o MESMO
    // renderizador modular usado na batalha (graphics.js), então qualquer
    // mudança de visual/equipamento aparece igual nos dois lugares.
    startCreatorPreviewLoop() {
        this.stopCreatorPreviewLoop();
        const canvas = document.getElementById('creator-preview-canvas');
        const ctx = canvas.getContext('2d');

        if (!this._previewSword) {
            this._previewSword = ItemFactory.createEquipment('shortsword', 'weapons', RARITY.COMMON);
        }
        const idleAnim = { type: 'idle', start: 0, duration: 0 };

        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, 0);
            ctx.scale(0.85, 0.85);
            const previewEntity = {
                visuals: this.creationData.visuals,
                equipment: { [SLOTS.MAIN_HAND]: this._previewSword }
            };
            window.GFX.drawGladiator(ctx, 0, canvas.height - 30, previewEntity, true, idleAnim, null);
            ctx.restore();
            this._previewRAFId = requestAnimationFrame(loop);
        };
        loop();
    }

    stopCreatorPreviewLoop() {
        if (this._previewRAFId) {
            cancelAnimationFrame(this._previewRAFId);
            this._previewRAFId = null;
        }
    }

    finalizeCharacterCreation() {
        this.stopCreatorPreviewLoop();

        const name = document.getElementById('char-name').value.trim();
        window.Engine.state.player = new Player(name);

        // Passa os atributos e visual customizados
        window.Engine.state.player.baseStats = { ...this.creationData.stats };
        window.Engine.state.player.visuals = { ...this.creationData.visuals };

        // Dá uma arma inicial ao jogador
        const initialSword = ItemFactory.createEquipment('shortsword', 'weapons', RARITY.COMMON);
        window.Engine.state.player.equipment[SLOTS.MAIN_HAND] = initialSword;

        // Calcula a vida/dano atual com os atributos novos
        window.Engine.state.player.calculateDerivedStats();

        // Salva o progresso inicial
        window.SaveManager.save(window.Engine.state);

        this.updateHubStats();
        this.showScreen('screen-hub'); // Transição perfeita para a cidade
    }

    // --- HUB DA CIDADE ---
    updateHubStats() {
        const p = window.Engine.state.player;
        document.getElementById('hub-player-name').innerText = p.name;
        document.getElementById('hub-player-level').innerText = p.level;
        document.getElementById('hub-player-gold').innerText = p.gold;
        document.getElementById('hub-player-exp').innerText = p.exp;
        document.getElementById('hub-player-max-exp').innerText = p.getExpRequired();
        document.getElementById('hub-player-fatigue').innerText = p.fatigue || 0;
    }

    // --- BATALHA ---
    startBattle() {
        const p = window.Engine.state.player;
        // Gera inimigo baseado no nível do jogador
        const enemy = new Enemy(p.level);
        this.beginBattleWith(enemy);
    }

    // Prepara a tela de batalha para qualquer tipo de oponente (Enemy ou Rival)
    beginBattleWith(opponent) {
        const p = window.Engine.state.player;

        // Instancia a Engine de Batalha Global
        window.BattleEngine = new BattleSystem(p, opponent);

        // Sorteia a atmosfera da arena (céu/horário) e zera animações dos combatentes
        if (window.GFX) window.GFX.resetForNewBattle();

        // Atualiza UI
        document.getElementById('battle-player-name').innerText = p.name;
        document.getElementById('enemy-name').innerText = `${opponent.name} (Nv. ${opponent.level})`;

        this.updateBattleBars();

        // Limpa log anterior
        const log = document.getElementById('battle-log');
        log.innerHTML = `<p>Você encontrou ${opponent.name} (${opponent.personality})!</p>`;

        // Reseta botões
        document.querySelectorAll('.btn-action').forEach(btn => btn.disabled = false);
        document.getElementById('battle-skills-menu').classList.add('hidden');
        document.getElementById('battle-items-menu').classList.add('hidden');
        document.getElementById('battle-move-menu').classList.add('hidden');

        this.updateDistanceDisplay();
        this.showScreen('screen-battle');
    }

    // --- LADDER DE ADVERSÁRIOS ---
    openLadder() {
        const p = window.Engine.state.player;
        const container = document.getElementById('ladder-container');
        container.innerHTML = '';

        // Um rival só está disponível se todos os anteriores da ladder já
        // tiverem sido derrotados (progressão sequencial entre e dentro das ligas)
        const allRivals = [];
        window.RivalDatabase.leagues.forEach(league => league.rivals.forEach(r => allRivals.push(r)));

        window.RivalDatabase.leagues.forEach(league => {
            const leagueDiv = document.createElement('div');
            leagueDiv.className = 'ladder-league';
            leagueDiv.innerHTML = `<h3>${league.name}</h3>`;

            const grid = document.createElement('div');
            grid.className = 'ladder-grid';

            league.rivals.forEach(rivalDef => {
                const globalIdx = allRivals.indexOf(rivalDef);
                const isDefeated = p.rivalsDefeated.includes(rivalDef.id);
                const isUnlocked = globalIdx === 0 || p.rivalsDefeated.includes(allRivals[globalIdx - 1].id);

                const personalityName = (window.AI_PERSONALITIES[rivalDef.personalityId] || {}).name || rivalDef.personalityId;
                const styleName = (window.AI_FIGHTING_STYLES[rivalDef.styleId] || {}).name || rivalDef.styleId;

                const card = document.createElement('div');
                card.className = `rival-card ${rivalDef.isChampion ? 'champion' : ''} ${isDefeated ? 'defeated' : ''} ${!isUnlocked ? 'locked' : ''}`;
                card.innerHTML = `
                    <h4>${rivalDef.name}</h4>
                    <p>Nível ${rivalDef.level} · ${personalityName} · ${styleName}</p>
                    <p class="rival-status" style="color:${isDefeated ? '#1eff00' : (isUnlocked ? 'var(--color-gold)' : '#666')}">
                        ${isDefeated ? 'Derrotado' : (isUnlocked ? (rivalDef.isChampion ? 'Campeão' : 'Disponível') : 'Bloqueado')}
                    </p>
                `;

                if (isUnlocked) {
                    card.onclick = () => {
                        const rival = new Rival(rivalDef);
                        this.beginBattleWith(rival);
                    };
                }

                grid.appendChild(card);
            });

            leagueDiv.appendChild(grid);
            container.appendChild(leagueDiv);
        });

        this.showScreen('screen-ladder');
    }

    updateBattleBars() {
        const b = window.BattleEngine;
        if (!b) return;

        // Animação de Barras (Player)
        const pHP = (b.player.currentHp / b.player.derivedStats.maxHp) * 100;
        const pMP = (b.player.currentMp / b.player.derivedStats.maxMp) * 100;
        document.getElementById('player-hp-bar').style.width = `${pHP}%`;
        document.getElementById('player-mp-bar').style.width = `${pMP}%`;
        document.getElementById('player-hp-text').innerText = `${b.player.currentHp}/${b.player.derivedStats.maxHp}`;
        document.getElementById('player-mp-text').innerText = `${b.player.currentMp}/${b.player.derivedStats.maxMp}`;

        // Animação de Barras (Enemy)
        const eHP = (b.enemy.currentHp / b.enemy.derivedStats.maxHp) * 100;
        document.getElementById('enemy-hp-bar').style.width = `${eHP}%`;
        document.getElementById('enemy-hp-text').innerText = `${b.enemy.currentHp}/${b.enemy.derivedStats.maxHp}`;

        this.updateDistanceDisplay();
    }

    // Atualiza a barra de distância, a zona de alcance da arma do jogador e o
    // aviso de "fora de alcance"; também reforça o gate de alcance no botão Atacar.
    updateDistanceDisplay() {
        const b = window.BattleEngine;
        if (!b) return;

        const range = b.player.getWeaponRange();
        const inRange = b.isInRange(range);

        document.getElementById('distance-value').innerText = b.distance.toFixed(1);
        document.getElementById('distance-marker').style.left = `${(b.distance / 10) * 100}%`;

        const zone = document.getElementById('distance-range-zone');
        const zoneMax = Math.min(range.max, 10);
        zone.style.left = `${(range.min / 10) * 100}%`;
        zone.style.width = `${Math.max(0, (zoneMax - range.min) / 10) * 100}%`;

        document.getElementById('range-warning').classList.toggle('hidden', inRange);

        this.applyRangeGate();
    }

    // Sincroniza o botão Atacar com o alcance atual: desabilita quando fora
    // de alcance e reabilita assim que o jogador se aproxima o suficiente
    // (chamado a cada atualização de distância, não só no início do turno).
    // Nunca mexe no botão fora do turno do jogador, para não reabilitá-lo
    // por engano enquanto o inimigo ainda está agindo.
    applyRangeGate() {
        const b = window.BattleEngine;
        if (!b || !b.isPlayerTurn) return;
        const atkBtn = document.getElementById('btn-atk');
        if (!atkBtn) return;
        const range = b.player.getWeaponRange();
        atkBtn.disabled = !b.isInRange(range);
    }

    toggleBattleButtons(isActive) {
        const buttons = document.querySelectorAll('.btn-action');
        buttons.forEach(btn => btn.disabled = !isActive);
        if (isActive) this.applyRangeGate(); // Atacar continua bloqueado se ainda fora de alcance
    }

    appendBattleLog(messageHTML) {
        const logContainer = document.getElementById('battle-log');
        const p = document.createElement('p');
        p.innerHTML = messageHTML;
        logContainer.appendChild(p);

        // Mantém apenas as últimas 5 mensagens para não vazar memória ou poluir a UI
        if (logContainer.children.length > 5) {
            logContainer.removeChild(logContainer.firstChild);
        }

        // Rola automaticamente para baixo
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // --- MENU DE HABILIDADES NA BATALHA ---
    openBattleSkillMenu() {
        const p = window.Engine.state.player;
        const menu = document.getElementById('battle-skills-menu');
        const list = document.getElementById('battle-skills-list');

        if (p.learnedSkills.length === 0) {
            this.appendBattleLog("Você ainda não aprendeu nenhuma habilidade!");
            return;
        }

        list.innerHTML = ''; // Limpa anterior

        const b = window.BattleEngine;

        p.learnedSkills.forEach(skillId => {
            const skill = window.SkillDB[skillId];
            const btn = document.createElement('button');
            btn.className = 'btn-battle-skill';

            // Bloqueia botão se não tiver mana suficiente, estiver em recarga ou fora de alcance
            const onCooldown = p.skillCooldowns && p.skillCooldowns[skillId] > 0;
            const hasMana = p.currentMp >= skill.mpCost;

            let skillRange = null;
            if (b) {
                if (skill.type === 'PHYSICAL' || skill.type === 'BLEED' || skill.type === 'STUN' || skill.type === 'LIFESTEAL') {
                    skillRange = p.getWeaponRange();
                } else if (skill.type === 'MAGIC' && skill.range !== undefined) {
                    skillRange = { min: 0, max: skill.range };
                }
            }
            const inRange = !skillRange || b.isInRange(skillRange);

            const canCast = hasMana && !onCooldown && inRange;
            if (!canCast) btn.disabled = true;

            let statusLabel = `${skill.mpCost} MP`;
            let statusColor = '#3388ff';
            if (onCooldown) { statusLabel = `Recarregando (${p.skillCooldowns[skillId]})`; statusColor = '#888'; }
            else if (!hasMana) { statusColor = '#888'; }
            else if (!inRange) { statusLabel = 'Fora de alcance'; statusColor = '#ff5555'; }

            btn.innerHTML = `
                <strong>${skill.name}</strong><br>
                <span style="font-size: 0.8rem; color:${statusColor}">${statusLabel}</span>
            `;

            btn.onclick = () => {
                menu.classList.add('hidden');
                if (window.BattleEngine) window.BattleEngine.executePlayerTurn('SKILL', skillId);
            };
            list.appendChild(btn);
        });

        menu.classList.remove('hidden');
    }

    // --- MENU DE ITENS NA BATALHA ---
    openBattleItemMenu() {
        const p = window.Engine.state.player;
        const menu = document.getElementById('battle-items-menu');
        const list = document.getElementById('battle-items-list');

        const consumableIndexes = [];
        p.inventory.forEach((item, idx) => { if (item.category === 'consumable') consumableIndexes.push(idx); });

        if (consumableIndexes.length === 0) {
            this.appendBattleLog("Você não possui itens consumíveis!");
            return;
        }

        list.innerHTML = '';

        consumableIndexes.forEach(idx => {
            const item = p.inventory[idx];
            const btn = document.createElement('button');
            btn.className = 'btn-battle-skill';
            btn.innerHTML = `
                <strong>${item.name}</strong><br>
                <span style="font-size: 0.8rem; color:#33cc99">${item.description}</span>
            `;
            btn.onclick = () => {
                menu.classList.add('hidden');
                if (window.BattleEngine) window.BattleEngine.executePlayerTurn('ITEM', idx);
            };
            list.appendChild(btn);
        });

        menu.classList.remove('hidden');
    }

    showBattleResults(isVictory, exp, gold, leveledUp, loot = null, newAchievements = []) {
        this.showScreen('screen-results');

        const title = document.getElementById('result-title');
        const lvlUpText = document.getElementById('result-levelup');
        const lootContainer = document.getElementById('result-loot');
        const achievementsContainer = document.getElementById('result-achievements');
        lootContainer.innerHTML = ''; // Limpa loot anterior
        achievementsContainer.innerHTML = '';

        if (isVictory) {
            title.innerText = "Vitória Gloriosa!";
            title.style.color = "var(--color-gold)";
            document.getElementById('result-exp').innerText = `+${exp}`;
            document.getElementById('result-gold').innerText = `+${gold}`;

            if (leveledUp) {
                lvlUpText.classList.remove('hidden');
                window.AudioManager.playLevelUp();
            } else {
                lvlUpText.classList.add('hidden');
            }

            if (newAchievements && newAchievements.length > 0) {
                if (!leveledUp) window.AudioManager.playLevelUp(); // fanfarra também para conquistas
                newAchievements.forEach(ach => {
                    const toast = document.createElement('div');
                    toast.className = 'achievement-toast';
                    toast.innerText = `Conquista Desbloqueada: ${ach.name}`;
                    achievementsContainer.appendChild(toast);
                });
            }

            // Exibe o Loot
            if (loot) {
                const lootTitle = document.createElement('h4');
                lootTitle.innerText = "Itens Encontrados:";
                lootTitle.style.width = '100%';

                const itemDiv = document.createElement('div');
                itemDiv.className = 'bag-item';
                itemDiv.style.borderColor = loot.rarity.color;
                itemDiv.style.color = loot.rarity.color;
                itemDiv.innerText = "I"; // Ícone placeholder
                this.attachTooltip(itemDiv, loot);

                itemDiv.onclick = () => {
                    const p = window.Engine.state.player;
                    if (p.inventory.length < p.inventoryCapacity) {
                        p.inventory.push(loot);
                        itemDiv.style.display = 'none';
                        this.hideTooltip();
                        window.AudioManager.playTone(1000, 'sine', 0.1, 0.5);
                        window.SaveManager.save(window.Engine.state);
                    } else {
                        window.AudioManager.playError();
                        this.appendBattleLog("Mochila Cheia! Não foi possível pegar o item.");
                    }
                };

                lootContainer.appendChild(lootTitle);
                lootContainer.appendChild(itemDiv);
            }

        } else {
            title.innerText = "Derrota Esmagadora";
            title.style.color = "#8b0000";
            document.getElementById('result-exp').innerText = "0";
            document.getElementById('result-gold').innerText = "0";
            lvlUpText.classList.add('hidden');
        }
    }

    // --- SISTEMA DE INVENTÁRIO E STATUS ---
    openInventory() {
        this.updateInventoryStats();
        this.renderEquipment();
        this.renderBag();
        this.showScreen('screen-inventory');
    }

    updateInventoryStats() {
        const p = window.Engine.state.player;
        p.calculateDerivedStats(); // Garante atualização

        document.getElementById('inv-stat-points').innerText = p.statPoints || 0;

        // Renderiza lista de botões de upar status
        const container = document.getElementById('inv-stats-list');
        container.innerHTML = '';

        const statNames = { str: "Força", agi: "Agil.", int: "Intel.", def: "Defesa", acc: "Prec.", luk: "Sorte", cha: "Carisma" };

        for (let key in p.baseStats) {
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <span>${statNames[key]}</span>
                <div class="stat-controls">
                    <span style="display:inline-block; width:30px; text-align:center;">${p.getTotalStat(key)}</span>
                    <button class="btn-add" ${p.statPoints > 0 ? '' : 'disabled'}>+</button>
                </div>
            `;

            // Lógica de subir status
            row.querySelector('.btn-add').addEventListener('click', () => {
                if (p.statPoints > 0) {
                    p.baseStats[key]++;
                    p.statPoints--;
                    p.calculateDerivedStats();
                    this.updateInventoryStats();
                    window.SaveManager.save(window.Engine.state); // Salva a alocação
                }
            });
            container.appendChild(row);
        }

        // Estatísticas de combate reais
        document.getElementById('stat-hp').innerText = p.derivedStats.maxHp;
        document.getElementById('stat-dmg').innerText = p.derivedStats.physicalDamage;
        document.getElementById('stat-def').innerText = p.derivedStats.defenseRating;
        document.getElementById('stat-dodge').innerText = Math.floor(p.derivedStats.dodgeChance);
        document.getElementById('stat-crit').innerText = Math.floor(p.derivedStats.critChance);
        document.getElementById('stat-block').innerText = Math.floor(p.derivedStats.blockChance || 0);
        document.getElementById('stat-fatigue').innerText = p.fatigue || 0;
    }

    renderEquipment() {
        const p = window.Engine.state.player;

        for (let slotKey in p.equipment) {
            const slotEl = document.getElementById(`slot-${slotKey}`);
            const item = p.equipment[slotKey];

            if (item) {
                slotEl.innerText = item.name.substring(0, 3) + ".."; // Abreviado
                slotEl.style.borderColor = item.rarity.color;
                slotEl.style.color = item.rarity.color;
                slotEl.classList.add('filled');

                // Hover e Clique para desequipar
                this.attachTooltip(slotEl, item);
                slotEl.onclick = () => {
                    if (p.inventory.length < p.inventoryCapacity) {
                        p.inventory.push(item);
                        p.equipment[slotKey] = null;
                        p.calculateDerivedStats();
                        window.SaveManager.save(window.Engine.state);
                        this.hideTooltip();
                        this.openInventory(); // Refresh
                    } else {
                        window.AudioManager.playError();
                        alert("Mochila Cheia! Libere espaço antes de desequipar.");
                    }
                };
            } else {
                // Slot vazio
                slotEl.innerText = slotKey;
                slotEl.style.borderColor = '#444';
                slotEl.style.color = '#666';
                slotEl.classList.remove('filled');
                slotEl.onmouseenter = null;
                slotEl.onclick = null;
            }
        }
    }

    renderBag() {
        const p = window.Engine.state.player;
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';

        for (let i = 0; i < p.inventoryCapacity; i++) {
            const itemSlot = document.createElement('div');
            itemSlot.className = 'bag-item';

            if (i < p.inventory.length) {
                const item = p.inventory[i];
                const isConsumable = item.category === 'consumable';

                itemSlot.innerText = isConsumable ? "P" : "I"; // P = Poção/consumível, I = item equipável
                itemSlot.style.borderColor = isConsumable ? '#33cc99' : item.rarity.color;
                itemSlot.style.color = isConsumable ? '#33cc99' : item.rarity.color;

                this.attachTooltip(itemSlot, item);

                if (isConsumable) {
                    // Clique usa o consumível imediatamente (fora de batalha)
                    itemSlot.onclick = () => {
                        const result = p.useConsumable(i);
                        p.calculateDerivedStats();
                        window.SaveManager.save(window.Engine.state);
                        this.hideTooltip();
                        this.openInventory(); // Refresh
                    };
                } else {
                    // Clique equipa o item (substituindo o atual se existir)
                    itemSlot.onclick = () => {
                        const currentEquipped = p.equipment[item.slot];
                        p.equipment[item.slot] = item;
                        p.inventory.splice(i, 1); // Remove da bolsa
                        if (currentEquipped) {
                            p.inventory.push(currentEquipped); // Devolve o antigo pra bolsa
                        }
                        p.calculateDerivedStats();
                        window.SaveManager.save(window.Engine.state);
                        this.hideTooltip();
                        this.openInventory(); // Refresh
                    };
                }
            }
            grid.appendChild(itemSlot);
        }
    }

    // --- SISTEMA DE MERCADO (SHOP) ---
    openShop() {
        const p = window.Engine.state.player;
        document.getElementById('shop-player-gold').innerText = p.gold;

        this.renderConsumableShop();

        // Gera estoque caso a loja não tenha (Reseta a cada visita por enquanto)
        this.currentShopItems = ItemFactory.generateShopInventory(p.level);

        const container = document.getElementById('shop-items-container');
        container.innerHTML = '';

        this.currentShopItems.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';

            const statsText = item.damage ? `Dano: ${item.damage}` : `Def: ${item.defense}`;

            card.innerHTML = `
                <div>
                    <h4 style="color: ${item.rarity.color}">${item.name}</h4>
                    <p style="font-size: 0.8rem; color: #aaa;">${statsText}</p>
                </div>
                <button class="btn btn-small">Comprar (${item.value}g)</button>
            `;

            this.attachTooltip(card, item);

            card.querySelector('button').onclick = () => {
                if (p.gold >= item.value && p.inventory.length < p.inventoryCapacity) {
                    p.gold -= item.value;
                    p.inventory.push(item);
                    this.currentShopItems.splice(index, 1); // Remove da loja
                    window.SaveManager.save(window.Engine.state);
                    this.hideTooltip();
                    this.openShop(); // Refresh
                } else if (p.gold < item.value) {
                    window.AudioManager.playError();
                    alert("Ouro insuficiente!");
                } else {
                    window.AudioManager.playError();
                    alert("Inventário Cheio!");
                }
            };

            container.appendChild(card);
        });

        this.showScreen('screen-shop');
    }

    // Estoque fixo do Boticário (sempre disponível, não é consumido da lista)
    renderConsumableShop() {
        const p = window.Engine.state.player;
        const container = document.getElementById('shop-consumables-container');
        container.innerHTML = '';

        ItemFactory.getConsumableStock().forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-item-card';

            card.innerHTML = `
                <div>
                    <h4 style="color: #33cc99">${item.name}</h4>
                    <p style="font-size: 0.8rem; color: #aaa;">${item.description}</p>
                </div>
                <button class="btn btn-small">Comprar (${item.value}g)</button>
            `;

            this.attachTooltip(card, item);

            card.querySelector('button').onclick = () => {
                if (p.gold >= item.value && p.inventory.length < p.inventoryCapacity) {
                    p.gold -= item.value;
                    p.inventory.push(item);
                    window.SaveManager.save(window.Engine.state);
                    this.hideTooltip();
                    document.getElementById('shop-player-gold').innerText = p.gold;
                } else if (p.gold < item.value) {
                    window.AudioManager.playError();
                    alert("Ouro insuficiente!");
                } else {
                    window.AudioManager.playError();
                    alert("Inventário Cheio!");
                }
            };

            container.appendChild(card);
        });
    }

    // --- ÁRVORE DE TALENTOS ---
    openSkillTree() {
        const p = window.Engine.state.player;
        document.getElementById('skill-points').innerText = p.skillPoints || 0;

        const container = document.getElementById('skills-container');
        container.innerHTML = '';

        for (let key in window.SkillDB) {
            const skill = window.SkillDB[key];
            const isUnlocked = p.learnedSkills.includes(key);
            const canUnlock = p.level >= skill.levelReq && p.skillPoints > 0 && !isUnlocked;

            const card = document.createElement('div');
            card.className = `skill-card ${isUnlocked ? 'unlocked' : 'locked'}`;

            let btnHTML = '';
            if (isUnlocked) {
                btnHTML = `<p style="color:var(--color-gold); margin-top:10px;">Adquirida</p>`;
            } else {
                btnHTML = `<button class="btn btn-small" style="margin-top:10px;" ${!canUnlock ? 'disabled' : ''}>Aprender (Nv.${skill.levelReq})</button>`;
            }

            card.innerHTML = `
                <div>
                    <h3 style="color:${skill.type === 'MAGIC' ? '#a335ee' : skill.type === 'HEAL' ? '#1eff00' : '#fff'}">${skill.name}</h3>
                    <p class="skill-cost">Custo: ${skill.mpCost} MP</p>
                    <p style="font-size: 0.85rem; margin-top: 5px; color:#aaa;">${skill.description}</p>
                </div>
                ${btnHTML}
            `;

            if (!isUnlocked && canUnlock) {
                card.querySelector('button').onclick = () => {
                    p.skillPoints--;
                    p.learnSkill(key);
                    window.SaveManager.save(window.Engine.state);
                    this.openSkillTree(); // Refresh UI
                };
            }
            container.appendChild(card);
        }

        this.showScreen('screen-skills');
    }

    // --- CURANDEIRO ---
    openHealer() {
        this.updateHealerScreen();
        this.showScreen('screen-healer');
    }

    updateHealerScreen() {
        const p = window.Engine.state.player;
        const fatigue = p.fatigue || 0;
        const cost = fatigue * 30;

        document.getElementById('healer-fatigue-level').innerText = fatigue;
        document.getElementById('healer-cost').innerText = cost;
        document.getElementById('healer-message').innerText = '';

        const btn = document.getElementById('btn-heal-fatigue');
        btn.disabled = fatigue === 0 || p.gold < cost;
        btn.onclick = () => this.healFatigue();
    }

    healFatigue() {
        const p = window.Engine.state.player;
        const fatigue = p.fatigue || 0;
        const cost = fatigue * 30;

        if (fatigue === 0) return;
        if (p.gold < cost) {
            window.AudioManager.playError();
            document.getElementById('healer-message').innerText = 'Ouro insuficiente!';
            return;
        }

        p.gold -= cost;
        p.cureFatigue(fatigue);
        window.SaveManager.save(window.Engine.state);
        window.AudioManager.playHeal();

        document.getElementById('healer-message').innerText = 'Fadiga totalmente curada! Você está pronto para lutar.';
        this.updateHealerScreen();
        this.updateHubStats();
    }

    // --- CONQUISTAS ---
    openAchievements(source = 'hub') {
        this._achievementsSource = source;
        const p = window.Engine.state.player;
        const container = document.getElementById('achievements-container');
        container.innerHTML = '';

        const total = Object.keys(window.AchievementDB).length;
        const unlockedCount = p.achievements.length;
        document.getElementById('achievements-summary').innerText = `${unlockedCount} / ${total} desbloqueadas`;

        for (let id in window.AchievementDB) {
            const ach = window.AchievementDB[id];
            const isUnlocked = p.achievements.includes(id);

            const card = document.createElement('div');
            const rarityClass = ach.rarity ? ach.rarity.normalize('NFD').replace(/[̀-ͯ]/g, '') : 'comum';
            card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'} rarity-${rarityClass}`;

            if (!isUnlocked) {
                // Conquistas bloqueadas aparecem ocultas — só o contorno e "???"
                card.innerHTML = `
                    <div class="achievement-icon">❔</div>
                    <h4>???</h4>
                    <p class="achievement-desc">Conquista ainda não descoberta.</p>
                `;
            } else {
                const date = p.achievementDates && p.achievementDates[id] ? new Date(p.achievementDates[id]) : null;
                const dateStr = date ? date.toLocaleDateString('pt-BR') : '';
                let progressHtml = '';
                if (ach.goal) {
                    const current = Math.min(ach.goal, ach.progress ? ach.progress(p) : ach.goal);
                    const pct = Math.round((current / ach.goal) * 100);
                    progressHtml = `
                        <div class="achievement-progress-bar"><div class="achievement-progress-fill" style="width:${pct}%"></div></div>
                        <p class="achievement-progress-text">${current}/${ach.goal} (${pct}%)</p>
                    `;
                }
                card.innerHTML = `
                    <div class="achievement-icon">${ach.icon || '🏆'}</div>
                    <h4>${ach.name}</h4>
                    <p class="achievement-desc">${ach.description}</p>
                    ${progressHtml}
                    <p class="achievement-rarity">${ach.rarity || 'comum'}</p>
                    ${dateStr ? `<p class="achievement-date">Desbloqueada em ${dateStr}</p>` : ''}
                `;
            }
            container.appendChild(card);
        }

        this.showScreen('screen-achievements');
    }

    // --- TOOLTIP LOGIC ---
    attachTooltip(element, item) {
        element.onmouseenter = () => {
            const tt = document.getElementById('item-tooltip');
            document.getElementById('tt-name').innerText = item.name;
            document.getElementById('tt-name').style.color = item.category === 'consumable' ? '#33cc99' : item.rarity.color;

            let statsHtml = '';
            if (item.category === 'consumable') {
                document.getElementById('tt-type').innerText = 'Consumível';
                statsHtml += `<p style="color:#33cc99">${item.description}</p>`;
            } else {
                document.getElementById('tt-type').innerText = `Slot: ${item.slot.toUpperCase()}`;
                if (item.damage) statsHtml += `<p>Dano Base: ${item.damage}</p>`;
                if (item.defense) statsHtml += `<p>Defesa Base: ${item.defense}</p>`;
                for (let stat in item.statBonuses) {
                    statsHtml += `<p style="color:#1eff00">+${item.statBonuses[stat]} ${stat.toUpperCase()}</p>`;
                }
                if (item.critBonus) statsHtml += `<p style="color:#ffcc00">+${item.critBonus}% Crítico</p>`;
                if (item.accBonus) statsHtml += `<p style="color:#ffcc00">+${item.accBonus} Precisão</p>`;
                if (item.armorPierce) statsHtml += `<p style="color:#ff8000">Perfura ${Math.floor(item.armorPierce * 100)}% da armadura</p>`;
                if (item.blockChance) statsHtml += `<p style="color:#88ccff">+${item.blockChance}% Bloqueio</p>`;
                if (item.hpBonus) statsHtml += `<p style="color:#ff4444">+${item.hpBonus} HP Máximo</p>`;
                if (item.mpBonus) statsHtml += `<p style="color:#3388ff">+${item.mpBonus} MP Máximo</p>`;
            }
            document.getElementById('tt-stats').innerHTML = statsHtml;
            document.getElementById('tt-price').innerText = `Valor: ${item.value}g`;

            tt.classList.remove('hidden');
        };
        element.onmouseleave = () => this.hideTooltip();
    }

    hideTooltip() {
        document.getElementById('item-tooltip').classList.add('hidden');
    }
}

// Inicializa a UI globalmente
window.addEventListener('DOMContentLoaded', () => {
    window.UI = new UIManager();
});
