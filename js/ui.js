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
        this.hairOptions = ['Estilo 1', 'Estilo 2', 'Estilo 3'];
        this.beardOptions = ['Nenhuma', 'Bigode', 'Cavanhaque', 'Barba Cheia'];
        this.faceOptions = ['Redondo', 'Oval', 'Anguloso'];
        this._previewRAFId = null;

        this.currentShopItems = [];

        this.initEventListeners();
    }

    showScreen(screenId) {
        this.screens.forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');

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
        document.getElementById('btn-achievements').addEventListener('click', () => this.openAchievements());

        // --- Fechar painéis ---
        document.getElementById('btn-close-inv').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-shop').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-skills').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-ladder').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-healer').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-achievements').addEventListener('click', () => this.showScreen('screen-hub'));

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
        });
        // Cor de pele livre: qualquer cor é aceita, incluindo tons não convencionais (verde, azul, etc)
        document.getElementById('char-skin-color').addEventListener('input', (e) => {
            this.creationData.visuals.skinTone = e.target.value;
        });
        document.getElementById('btn-hair').addEventListener('click', (e) => {
            const idx = this.creationData.visuals.hairStyle % this.hairOptions.length;
            this.creationData.visuals.hairStyle = idx + 1;
            e.target.innerText = this.hairOptions[idx];
        });
        document.getElementById('char-hair-color').addEventListener('input', (e) => {
            this.creationData.visuals.hairColor = e.target.value;
        });
        document.getElementById('btn-beard').addEventListener('click', (e) => {
            const idx = (this.creationData.visuals.beardStyle + 1) % this.beardOptions.length;
            this.creationData.visuals.beardStyle = idx;
            e.target.innerText = this.beardOptions[idx];
        });
        document.getElementById('char-beard-color').addEventListener('input', (e) => {
            this.creationData.visuals.beardColor = e.target.value;
        });
        document.getElementById('char-eye-color').addEventListener('input', (e) => {
            this.creationData.visuals.eyeColor = e.target.value;
        });
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
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if (!btn.disabled && window.AudioManager.initialized) window.AudioManager.playUIHover();
            });
            btn.addEventListener('click', () => {
                if (!btn.disabled && window.AudioManager.initialized) window.AudioManager.playUIClick();
            });
        });
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
        document.getElementById('btn-hair').innerText = this.hairOptions[0];
        document.getElementById('char-hair-color').value = this.creationData.visuals.hairColor;
        document.getElementById('btn-beard').innerText = this.beardOptions[0];
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

                const card = document.createElement('div');
                card.className = `rival-card ${rivalDef.isChampion ? 'champion' : ''} ${isDefeated ? 'defeated' : ''} ${!isUnlocked ? 'locked' : ''}`;
                card.innerHTML = `
                    <h4>${rivalDef.name}</h4>
                    <p>Nível ${rivalDef.level} · ${rivalDef.personality}</p>
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
    }

    toggleBattleButtons(isActive) {
        const buttons = document.querySelectorAll('.btn-action');
        buttons.forEach(btn => btn.disabled = !isActive);
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

        p.learnedSkills.forEach(skillId => {
            const skill = window.SkillDB[skillId];
            const btn = document.createElement('button');
            btn.className = 'btn-battle-skill';

            // Bloqueia botão se não tiver mana suficiente
            const canCast = p.currentMp >= skill.mpCost;
            if (!canCast) btn.disabled = true;

            btn.innerHTML = `
                <strong>${skill.name}</strong><br>
                <span style="font-size: 0.8rem; color:${canCast ? '#3388ff' : '#888'}">${skill.mpCost} MP</span>
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
    openAchievements() {
        const p = window.Engine.state.player;
        const container = document.getElementById('achievements-container');
        container.innerHTML = '';

        for (let id in window.AchievementDB) {
            const ach = window.AchievementDB[id];
            const isUnlocked = p.achievements.includes(id);

            const card = document.createElement('div');
            card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
            card.innerHTML = `
                <h4 style="color:${isUnlocked ? 'var(--color-gold)' : '#888'}">${ach.name}</h4>
                <p>${ach.description}</p>
            `;
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
