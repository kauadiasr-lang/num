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
            visuals: { gender: 'Masculino', skinTone: '#ffcc99', hairStyle: 1 }
        };

        this.genderOptions = ['Masculino', 'Feminino'];
        this.skinOptions = [
            { name: 'Clara', hex: '#ffcc99' },
            { name: 'Média', hex: '#e0ac69' },
            { name: 'Escura', hex: '#8d5524' }
        ];
        this.hairOptions = ['Estilo 1', 'Estilo 2', 'Estilo 3'];

        this.currentShopItems = [];

        this.initEventListeners();
    }

    showScreen(screenId) {
        this.screens.forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');

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
        document.getElementById('btn-shop').addEventListener('click', () => this.openShop());
        document.getElementById('btn-inventory').addEventListener('click', () => this.openInventory());
        document.getElementById('btn-skills').addEventListener('click', () => this.openSkillTree());

        // --- Fechar painéis ---
        document.getElementById('btn-close-inv').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-shop').addEventListener('click', () => this.showScreen('screen-hub'));
        document.getElementById('btn-close-skills').addEventListener('click', () => this.showScreen('screen-hub'));

        // --- Ações de Batalha ---
        document.getElementById('btn-atk').addEventListener('click', () => {
            if (window.BattleEngine) window.BattleEngine.executePlayerTurn('ATK');
        });
        document.getElementById('btn-def').addEventListener('click', () => {
            if (window.BattleEngine) window.BattleEngine.executePlayerTurn('DEF');
        });
        document.getElementById('btn-skill').addEventListener('click', () => this.openBattleSkillMenu());
        document.getElementById('btn-item').addEventListener('click', () => {
            this.appendBattleLog('Nenhum item consumível disponível no momento.');
        });
        document.getElementById('btn-close-skill-menu').addEventListener('click', () => {
            document.getElementById('battle-skills-menu').classList.add('hidden');
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

        // --- Seletores Visuais do Criador de Personagem ---
        document.getElementById('btn-gender').addEventListener('click', (e) => {
            const idx = (this.genderOptions.indexOf(this.creationData.visuals.gender) + 1) % this.genderOptions.length;
            this.creationData.visuals.gender = this.genderOptions[idx];
            e.target.innerText = this.creationData.visuals.gender;
        });
        document.getElementById('btn-skin').addEventListener('click', (e) => {
            const current = this.skinOptions.findIndex(s => s.hex === this.creationData.visuals.skinTone);
            const idx = (current + 1) % this.skinOptions.length;
            this.creationData.visuals.skinTone = this.skinOptions[idx].hex;
            e.target.innerText = this.skinOptions[idx].name;
        });
        document.getElementById('btn-hair').addEventListener('click', (e) => {
            const idx = this.creationData.visuals.hairStyle % this.hairOptions.length;
            this.creationData.visuals.hairStyle = idx + 1;
            e.target.innerText = this.hairOptions[idx];
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

        document.getElementById('char-name').value = '';
        document.getElementById('points-left').innerText = this.creationData.pointsLeft;

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

    finalizeCharacterCreation() {
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
    }

    // --- BATALHA ---
    startBattle() {
        const p = window.Engine.state.player;
        // Gera inimigo baseado no nível do jogador
        const enemy = new Enemy(p.level);

        // Instancia a Engine de Batalha Global
        window.BattleEngine = new BattleSystem(p, enemy);

        // Atualiza UI
        document.getElementById('battle-player-name').innerText = p.name;
        document.getElementById('enemy-name').innerText = `${enemy.name} (Nv. ${enemy.level})`;

        this.updateBattleBars();

        // Limpa log anterior
        const log = document.getElementById('battle-log');
        log.innerHTML = `<p>Você encontrou um ${enemy.name} (${enemy.personality})!</p>`;

        // Reseta botões
        document.querySelectorAll('.btn-action').forEach(btn => btn.disabled = false);
        document.getElementById('battle-skills-menu').classList.add('hidden');

        this.showScreen('screen-battle');
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

    showBattleResults(isVictory, exp, gold, leveledUp, loot = null) {
        this.showScreen('screen-results');

        const title = document.getElementById('result-title');
        const lvlUpText = document.getElementById('result-levelup');
        const lootContainer = document.getElementById('result-loot');
        lootContainer.innerHTML = ''; // Limpa loot anterior

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
                itemSlot.innerText = "I"; // Placeholder de Ícone (Substituído por Sprites no Canvas futuramente)
                itemSlot.style.borderColor = item.rarity.color;
                itemSlot.style.color = item.rarity.color;

                this.attachTooltip(itemSlot, item);

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
            grid.appendChild(itemSlot);
        }
    }

    // --- SISTEMA DE MERCADO (SHOP) ---
    openShop() {
        const p = window.Engine.state.player;
        document.getElementById('shop-player-gold').innerText = p.gold;

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

    // --- TOOLTIP LOGIC ---
    attachTooltip(element, item) {
        element.onmouseenter = () => {
            const tt = document.getElementById('item-tooltip');
            document.getElementById('tt-name').innerText = item.name;
            document.getElementById('tt-name').style.color = item.rarity.color;
            document.getElementById('tt-type').innerText = `Slot: ${item.slot.toUpperCase()}`;

            let statsHtml = '';
            if (item.damage) statsHtml += `<p>Dano Base: ${item.damage}</p>`;
            if (item.defense) statsHtml += `<p>Defesa Base: ${item.defense}</p>`;
            for (let stat in item.statBonuses) {
                statsHtml += `<p style="color:#1eff00">+${item.statBonuses[stat]} ${stat.toUpperCase()}</p>`;
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
