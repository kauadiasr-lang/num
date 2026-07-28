/**
 * Menu Principal, Slots de Save, Configurações e Créditos
 *
 * Mantido separado de ui.js (que cuida das telas de jogo propriamente ditas)
 * por modularidade: tudo relacionado à "porta de entrada" do jogo — antes de
 * qualquer personagem existir na memória — vive aqui.
 */
class MainMenuManager {
    constructor() {
        this._creditsRAF = null;
        this._autosaveTimer = null;
        this._peekingPlayer = false;
        this._pendingImportSlot = null;
        this.initEventListeners();
        this.initAutosave();
    }

    // ==========================================================================
    // MENU PRINCIPAL
    // ==========================================================================

    showMainMenu() {
        window.GFX.initMenuAmbience();
        window.UI.showScreen('screen-mainmenu');
        window.AudioManager.startAmbientMusic();
        this.refreshContinueButton();
    }

    refreshContinueButton() {
        const btn = document.getElementById('btn-mm-continue');
        btn.disabled = window.SaveManager.getMostRecentSlotId() === null;
    }

    handleContinue() {
        const slotId = window.SaveManager.getMostRecentSlotId();
        if (slotId === null) return;
        this.loadSlotAndEnterHub(slotId);
    }

    loadSlotAndEnterHub(slotId) {
        const savedData = window.SaveManager.loadSlot(slotId);
        if (!savedData) {
            this.showToast('Não foi possível carregar esse registro. O arquivo pode estar corrompido.', 'error');
            return;
        }
        window.Engine.restorePlayerFromSave(savedData);
        window.AudioManager.stopAmbientMusic();
        window.UI.updateHubStats();
        window.UI.showScreen('screen-hub', 'zoom');
        this.showToast(`Bem-vindo de volta, ${window.Engine.state.player.name}!`, 'success');
    }

    // Abre a criação de personagem já mirando um slot específico — todo save
    // feito durante a criação/jogo vai automaticamente pra esse slot, já que
    // SaveManager.save()/load() sempre operam sobre `currentSlotId`.
    openCreationForSlot(slotId) {
        window.SaveManager.currentSlotId = slotId;
        window.AudioManager.stopAmbientMusic();
        window.UI.buildCreationScreen();
        window.UI.showScreen('screen-creation', 'zoom');
    }

    returnToMainMenu() {
        // Salva o progresso atual (se houver uma partida ativa) antes de sair
        if (window.Engine.state.player && window.SaveManager.currentSlotId !== null) {
            this.saveWithIndicator();
        }
        window.Engine.state.player = null;
        window.SaveManager.currentSlotId = null;
        this.showMainMenu();
    }

    quitGame() {
        this.showConfirm(
            'Sair do Jogo',
            'Arena of Blades roda inteiramente no seu navegador — não existe um processo pra "fechar" à parte. Feche esta aba para sair. Deseja tentar fechar agora?',
            () => {
                // window.close() só funciona se a aba foi aberta via script; na
                // maioria dos navegadores isso falha silenciosamente por segurança,
                // então o aviso acima já deixou claro o que fazer.
                window.close();
            },
            null,
            'Fechar Aba'
        );
    }

    // ==========================================================================
    // SLOTS DE SAVE
    // ==========================================================================

    openSaveSlots() {
        window.AudioManager.stopAmbientMusic();
        this.renderSaveSlots();
        window.UI.showScreen('screen-saveslots', 'slide');
        window.AudioManager.startAmbientMusic();
    }

    renderSaveSlots() {
        const container = document.getElementById('saveslots-container');
        container.innerHTML = '';
        const slots = window.SaveManager.getSlots();

        slots.forEach((entry, slotId) => {
            const card = document.createElement('div');
            card.className = 'save-slot-card' + (entry ? '' : ' empty');

            if (entry && entry.meta) {
                const m = entry.meta;
                const date = new Date(entry.timestamp);
                const dateStr = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                card.innerHTML = `
                    <div class="save-slot-thumb"><canvas class="save-slot-canvas" width="72" height="72"></canvas></div>
                    <div class="save-slot-info">
                        <h4>${m.name}</h4>
                        <p>Nível ${m.level} · ${m.archetype}</p>
                        <p class="save-slot-meta">${m.hoursPlayed}h jogadas · ${m.gold}g · ${m.wins || 0} vitórias</p>
                        <p class="save-slot-meta">${m.location} · ${dateStr}</p>
                    </div>
                    <div class="save-slot-actions">
                        <button class="btn btn-small primary" data-action="continue">Continuar</button>
                        <button class="btn btn-small" data-action="overwrite">Sobrescrever</button>
                        <button class="btn btn-small" data-action="duplicate">Duplicar</button>
                        <button class="btn btn-small" data-action="export">Exportar</button>
                        <button class="btn btn-small danger" data-action="delete">Excluir</button>
                    </div>
                `;
                this._drawSlotThumbnail(card.querySelector('.save-slot-canvas'), entry.data.player);
            } else {
                card.innerHTML = `
                    <div class="save-slot-info empty-info">
                        <h4>Slot ${slotId + 1} Vazio</h4>
                        <p>Nenhum gladiador registrado.</p>
                    </div>
                    <div class="save-slot-actions">
                        <button class="btn btn-small primary" data-action="create">Criar Novo</button>
                        <button class="btn btn-small" data-action="import">Importar</button>
                    </div>
                `;
            }

            card.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handleSlotAction(slotId, btn.dataset.action);
                });
            });

            container.appendChild(card);
        });
    }

    _drawSlotThumbnail(canvas, playerData) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height - 6);
        ctx.scale(0.5, 0.5);
        const idleAnim = { type: 'idle', start: 0, duration: 0 };
        const previewEntity = { visuals: playerData.visuals || {}, equipment: playerData.equipment || {} };
        try {
            window.GFX.drawGladiator(ctx, 0, 0, previewEntity, true, idleAnim, null);
        } catch (e) { /* miniatura é cosmética — nunca impede a listagem de slots */ }
        ctx.restore();
    }

    handleSlotAction(slotId, action) {
        const slots = window.SaveManager.getSlots();
        const entry = slots[slotId];

        if (action === 'create') {
            this.openCreationForSlot(slotId);
        } else if (action === 'import') {
            this.promptImport(slotId);
        } else if (action === 'continue') {
            this.loadSlotAndEnterHub(slotId);
        } else if (action === 'overwrite') {
            this.showConfirm(
                'Sobrescrever Registro',
                `Isso vai apagar permanentemente "${entry.meta.name}" (Nível ${entry.meta.level}) e criar um gladiador novo nesse slot. Essa ação não pode ser desfeita.`,
                () => this.openCreationForSlot(slotId)
            );
        } else if (action === 'duplicate') {
            const targetId = slots.findIndex(s => !s);
            if (targetId === -1) {
                this.showToast('Não há slots vazios para duplicar. Exclua ou libere um slot primeiro.', 'error');
                return;
            }
            window.SaveManager.duplicateSlot(slotId, targetId);
            this.showToast(`"${entry.meta.name}" duplicado para o Slot ${targetId + 1}.`, 'success');
            this.renderSaveSlots();
        } else if (action === 'delete') {
            this.showConfirm(
                'Excluir Registro',
                `Tem certeza que deseja excluir "${entry.meta.name}" permanentemente? Essa ação não pode ser desfeita.`,
                () => {
                    window.SaveManager.deleteSlot(slotId);
                    this.showToast('Registro excluído.', 'success');
                    this.renderSaveSlots();
                    this.refreshContinueButton();
                }
            );
        } else if (action === 'export') {
            const exported = window.SaveManager.exportSlot(slotId);
            if (!exported) {
                this.showToast('Não foi possível exportar esse save.', 'error');
                return;
            }
            this.showExportModal(entry.meta.name, exported);
        }
    }

    promptImport(slotId) {
        this._pendingImportSlot = slotId;
        const extra = `<textarea id="import-textarea" class="import-textarea" placeholder="Cole aqui o código exportado..."></textarea>`;
        this.showConfirm(
            'Importar Save',
            `Cole abaixo o código de um save exportado anteriormente para restaurá-lo no Slot ${slotId + 1}.`,
            () => {
                const text = document.getElementById('import-textarea').value;
                const ok = window.SaveManager.importToSlot(slotId, text);
                if (ok) {
                    this.showToast('Save importado com sucesso!', 'success');
                    this.renderSaveSlots();
                    this.refreshContinueButton();
                } else {
                    this.showToast('Código inválido ou corrompido. Nada foi alterado.', 'error');
                }
            },
            extra,
            'Importar'
        );
    }

    showExportModal(name, exportedString) {
        const extra = `<textarea id="export-textarea" class="import-textarea" readonly>${exportedString}</textarea>
            <button id="btn-copy-export" class="btn btn-small" style="margin-top:8px;">Copiar para a Área de Transferência</button>`;
        this.showConfirm(
            'Exportar Save',
            `Código de "${name}" — copie e guarde em um lugar seguro. Você pode importá-lo de volta em qualquer slot vazio, inclusive em outro navegador.`,
            null,
            extra,
            'Fechar'
        );
        setTimeout(() => {
            const btn = document.getElementById('btn-copy-export');
            if (!btn) return;
            btn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(exportedString);
                    this.showToast('Copiado para a área de transferência!', 'success');
                } catch (e) {
                    this.showToast('Não foi possível copiar automaticamente. Selecione o texto manualmente.', 'error');
                }
            });
        }, 0);
    }

    // ==========================================================================
    // CONFIGURAÇÕES
    // ==========================================================================

    openSettings() {
        this.renderSettings();
        window.UI.showScreen('screen-settings', 'slide');
    }

    renderSettings() {
        const container = document.getElementById('settings-container');
        container.innerHTML = '';
        const S = window.Settings;

        const row = (label, inputHtml) => {
            const div = document.createElement('div');
            div.className = 'setting-row';
            div.innerHTML = `<span class="setting-label">${label}</span><div class="setting-control">${inputHtml}</div>`;
            return div;
        };

        const slider = (key, min, max, step) => `<input type="range" min="${min}" max="${max}" step="${step}" value="${S.get(key)}" data-key="${key}" class="setting-slider">
            <span class="setting-value" data-value-for="${key}">${Math.round(S.get(key) * 100)}%</span>`;

        container.appendChild(row('Volume Geral', slider('masterVolume', 0, 1, 0.05)));
        container.appendChild(row('Música', slider('musicVolume', 0, 1, 0.05)));
        container.appendChild(row('Efeitos Sonoros', slider('sfxVolume', 0, 1, 0.05)));

        container.appendChild(row('Idioma', `
            <select data-key="language" class="setting-select">
                <option value="pt-BR" ${S.get('language') === 'pt-BR' ? 'selected' : ''}>Português (Brasil)</option>
                <option value="en" ${S.get('language') === 'en' ? 'selected' : ''}>English (em breve)</option>
            </select>`));

        container.appendChild(row('Tela Cheia', `<button id="btn-toggle-fullscreen" class="btn-small">${document.fullscreenElement ? 'Sair da Tela Cheia' : 'Ativar'}</button>`));

        container.appendChild(row('Qualidade Gráfica', `
            <select data-key="graphicsQuality" class="setting-select">
                <option value="baixa" ${S.get('graphicsQuality') === 'baixa' ? 'selected' : ''}>Baixa</option>
                <option value="media" ${S.get('graphicsQuality') === 'media' ? 'selected' : ''}>Média</option>
                <option value="alta" ${S.get('graphicsQuality') === 'alta' ? 'selected' : ''}>Alta</option>
            </select>`));

        container.appendChild(row('Escala da Interface', `<input type="range" min="0.85" max="1.25" step="0.05" value="${S.get('uiScale')}" data-key="uiScale" class="setting-slider">
            <span class="setting-value" data-value-for="uiScale">${Math.round(S.get('uiScale') * 100)}%</span>`));

        container.appendChild(row('Mostrar FPS', `<input type="checkbox" data-key="showFPS" class="setting-checkbox" ${S.get('showFPS') ? 'checked' : ''}>`));
        container.appendChild(row('Mostrar Dano Flutuante', `<input type="checkbox" data-key="showFloatingDamage" class="setting-checkbox" ${S.get('showFloatingDamage') ? 'checked' : ''}>`));

        container.appendChild(row('Velocidade das Animações', `<input type="range" min="0.5" max="2" step="0.1" value="${S.get('animationSpeed')}" data-key="animationSpeed" class="setting-slider">
            <span class="setting-value" data-value-for="animationSpeed">${S.get('animationSpeed').toFixed(1)}x</span>`));

        container.appendChild(row('Reduzir Efeitos Visuais', `<input type="checkbox" data-key="reduceEffects" class="setting-checkbox" ${S.get('reduceEffects') ? 'checked' : ''}>`));

        container.appendChild(row('Tremor de Câmera', `<input type="checkbox" data-key="screenShake" class="setting-checkbox" ${S.get('screenShake') ? 'checked' : ''}>`));

        // Referência rápida de controles de teclado — nunca documentados em
        // lugar nenhum da interface antes (WASD/setas e Esc funcionavam
        // desde as primeiras iterações, mas só quem lesse o código-fonte
        // saberia que existem).
        const controlsHeader = document.createElement('h4');
        controlsHeader.className = 'settings-section-header';
        controlsHeader.innerText = 'Controles';
        container.appendChild(controlsHeader);
        container.appendChild(row('Mover na Cidade', '<span class="setting-static">WASD ou Setas</span>'));
        container.appendChild(row('Interagir com Prédio Próximo', '<span class="setting-static">E</span>'));
        container.appendChild(row('Fechar Janela/Menu', '<span class="setting-static">Esc</span>'));

        // Liga os eventos de todos os controles gerados
        container.querySelectorAll('[data-key]').forEach(el => {
            const key = el.dataset.key;
            const eventName = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
            el.addEventListener(eventName, () => {
                let value = el.type === 'checkbox' ? el.checked : el.value;
                if (el.type === 'range') value = parseFloat(value);
                window.Settings.set(key, value);
                const valueLabel = container.querySelector(`[data-value-for="${key}"]`);
                if (valueLabel) {
                    if (key === 'animationSpeed') valueLabel.innerText = `${value.toFixed(1)}x`;
                    else valueLabel.innerText = `${Math.round(value * 100)}%`;
                }
            });
        });

        const fsBtn = document.getElementById('btn-toggle-fullscreen');
        fsBtn.addEventListener('click', () => this.toggleFullscreen(fsBtn));
    }

    toggleFullscreen(btn) {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                btn.innerText = 'Sair da Tela Cheia';
            }).catch(() => {
                this.showToast('Não foi possível ativar tela cheia neste ambiente.', 'error');
            });
        } else {
            document.exitFullscreen().then(() => { btn.innerText = 'Ativar'; });
        }
    }

    // ==========================================================================
    // CONQUISTAS (a partir do Menu Principal — leitura do save mais recente)
    // ==========================================================================

    openAchievementsFromMenu() {
        if (!window.Engine.state.player) {
            const slotId = window.SaveManager.getMostRecentSlotId();
            if (slotId !== null) {
                const savedData = window.SaveManager.getSlots()[slotId].data;
                // Carrega só pra leitura — não altera currentSlotId nem entra no jogo
                const tempPlayer = new Player(savedData.player.name);
                Object.assign(tempPlayer, savedData.player);
                tempPlayer.calculateDerivedStats();
                window.Engine.state.player = tempPlayer;
                this._peekingPlayer = true;
            }
        }
        if (!window.Engine.state.player) {
            this.showToast('Crie um gladiador primeiro para ver suas conquistas.', 'error');
            return;
        }
        window.UI.openAchievements('mainmenu');
    }

    // ==========================================================================
    // CRÉDITOS
    // ==========================================================================

    openCredits() {
        window.AudioManager.stopAmbientMusic();
        const content = document.getElementById('credits-scroll-content');
        content.innerHTML = `
            <h2>ARENA OF BLADES</h2>
            <p class="credits-role">Um RPG de Arena Gladiatorial</p>
            <br><br>
            <h3>Direção &amp; Design</h3>
            <p>Concebido e construído com Claude Code</p>
            <br>
            <h3>Sistemas de Jogo</h3>
            <p>Combate Tático · Alcance &amp; Posicionamento</p>
            <p>Inteligência Artificial de Combate</p>
            <p>Personalidades, Estilos de Luta &amp; Memória de Batalha</p>
            <p>Ladder de Rivais &amp; Chefes com Fases</p>
            <p>Progressão, Talentos &amp; Conquistas</p>
            <br>
            <h3>Arte &amp; Apresentação</h3>
            <p>Renderização Procedural em Canvas 2D</p>
            <p>Identidade Visual: Grécia Antiga &amp; Coliseus Romanos</p>
            <br>
            <h3>Áudio</h3>
            <p>Sintetizador Procedural via Web Audio API</p>
            <br><br>
            <h3>Agradecimentos</h3>
            <p>A todos os gladiadores que ousaram entrar na arena.</p>
            <br><br><br>
            <p class="credits-thanks">Obrigado por jogar.</p>
        `;
        window.UI.showScreen('screen-credits', 'fade');
        window.AudioManager.startAmbientMusic();
        this._startCreditsScroll();
    }

    _startCreditsScroll() {
        this._stopCreditsScroll();
        const wrap = document.querySelector('.credits-scroll-wrap');
        const content = document.getElementById('credits-scroll-content');
        content.style.transform = `translateY(${wrap.clientHeight}px)`;
        let y = wrap.clientHeight;
        const speed = 22; // px por segundo
        let lastT = performance.now();

        const step = (t) => {
            const dt = (t - lastT) / 1000;
            lastT = t;
            y -= speed * dt;
            content.style.transform = `translateY(${y}px)`;
            if (y < -content.scrollHeight) {
                y = wrap.clientHeight; // recomeça em loop suave
            }
            this._creditsRAF = requestAnimationFrame(step);
        };
        this._creditsRAF = requestAnimationFrame(step);
    }

    _stopCreditsScroll() {
        if (this._creditsRAF) {
            cancelAnimationFrame(this._creditsRAF);
            this._creditsRAF = null;
        }
    }

    // ==========================================================================
    // AUTOSAVE
    // ==========================================================================

    initAutosave() {
        this._autosaveTimer = setInterval(() => {
            if (window.Engine.state.player && window.SaveManager.currentSlotId !== null &&
                window.Engine.state.screen !== 'BATTLE' && window.Engine.state.screen !== 'CREATION') {
                this.saveWithIndicator();
            }
        }, 45000); // autosave discreto a cada 45s fora de combate/criação
    }

    saveWithIndicator() {
        const indicator = document.getElementById('saving-indicator');
        indicator.classList.remove('hidden');
        indicator.classList.add('visible');
        const ok = window.SaveManager.save(window.Engine.state);
        setTimeout(() => {
            indicator.classList.remove('visible');
            setTimeout(() => indicator.classList.add('hidden'), 300);
        }, 500);
        return ok;
    }

    // ==========================================================================
    // TOASTS (feedback de ações) E MODAL DE CONFIRMAÇÃO
    // ==========================================================================

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        if (window.AudioManager.initialized) {
            if (type === 'error') window.AudioManager.playError();
            else window.AudioManager.playConfirm();
        }
        setTimeout(() => toast.classList.add('toast-out'), 2600);
        setTimeout(() => toast.remove(), 3000);
    }

    // onConfirm === null significa "modal informativo", sem ação de confirmação real
    showConfirm(title, message, onConfirm, extraHtml = null, confirmLabel = 'Confirmar') {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-modal-title').innerText = title;
        document.getElementById('confirm-modal-message').innerText = message;
        document.getElementById('confirm-modal-extra').innerHTML = extraHtml || '';
        const okBtn = document.getElementById('confirm-modal-ok');
        const cancelBtn = document.getElementById('confirm-modal-cancel');
        okBtn.innerText = confirmLabel;
        cancelBtn.classList.toggle('hidden', onConfirm === null);

        const close = () => modal.classList.add('hidden');
        const newOkBtn = okBtn.cloneNode(true); // remove listeners anteriores
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        newOkBtn.addEventListener('click', () => { close(); if (onConfirm) onConfirm(); });
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', close);

        modal.classList.remove('hidden');
    }

    // ==========================================================================
    // EVENTOS
    // ==========================================================================

    initEventListeners() {
        document.getElementById('btn-mm-continue').addEventListener('click', () => this.handleContinue());
        document.getElementById('btn-mm-newgame').addEventListener('click', () => this.openSaveSlots());
        document.getElementById('btn-mm-loadgame').addEventListener('click', () => this.openSaveSlots());
        document.getElementById('btn-mm-settings').addEventListener('click', () => this.openSettings());
        document.getElementById('btn-mm-achievements').addEventListener('click', () => this.openAchievementsFromMenu());
        document.getElementById('btn-mm-credits').addEventListener('click', () => this.openCredits());
        document.getElementById('btn-mm-quit').addEventListener('click', () => this.quitGame());

        document.getElementById('btn-close-saveslots').addEventListener('click', () => {
            window.AudioManager.stopAmbientMusic();
            this.showMainMenu();
        });
        document.getElementById('btn-close-settings').addEventListener('click', () => this.showMainMenu());
        document.getElementById('btn-settings-reset').addEventListener('click', () => {
            window.Settings.resetToDefaults();
            this.renderSettings();
            this.showToast('Configurações restauradas.', 'success');
        });
        document.getElementById('btn-close-credits').addEventListener('click', () => {
            this._stopCreditsScroll();
            window.AudioManager.stopAmbientMusic();
            this.showMainMenu();
        });

        document.getElementById('btn-hub-mainmenu').addEventListener('click', () => this.returnToMainMenu());

        document.getElementById('confirm-modal').addEventListener('click', (e) => {
            if (e.target.id === 'confirm-modal') e.target.classList.add('hidden'); // clique fora fecha
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.MainMenu = new MainMenuManager();
});
