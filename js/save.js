/**
 * Sistema de Salvamento em LocalStorage — múltiplos slots
 *
 * Compatibilidade: mantém a mesma API save(gameState)/load() usada em todo o
 * resto do jogo (battle.js, ui.js), que agora atuam sobre um "slot atual"
 * (this.currentSlotId) em vez de uma única chave global. Saves no formato
 * antigo (uma única partida, sem slots) são migrados automaticamente para o
 * Slot 1 na primeira execução desta versão — nenhum progresso é perdido.
 */
class SaveSystem {
    constructor() {
        this.legacyKey = 'ArenaOfBlades_SaveData'; // formato anterior (slot único)
        this.slotsKey = 'ArenaOfBlades_SaveSlots';  // formato atual (multi-slot)
        this.settingsKey = 'ArenaOfBlades_Settings'; // configurações, independente de personagem
        this.version = '2.0.0';
        this.maxSlots = 5;
        this.currentSlotId = null; // definido ao carregar ou criar um personagem num slot

        this._migrateLegacySave();
    }

    // --- Migração do formato antigo (não destrutiva: a chave antiga nunca é apagada) ---
    _migrateLegacySave() {
        const existing = this._readSlotsRaw();
        if (existing) return; // já existe o formato novo, nada a migrar

        const legacy = localStorage.getItem(this.legacyKey);
        if (!legacy) return; // instalação nova, sem save nenhum

        try {
            const jsonString = decodeURIComponent(escape(atob(legacy)));
            const parsed = JSON.parse(jsonString);
            if (!parsed || !this._isValidGameState(parsed.data)) return;

            const slots = this._emptySlotArray();
            slots[0] = this._buildSlotEntry(parsed.data, parsed.version || '1.0.0', parsed.timestamp || Date.now());
            this._writeSlotsRaw(slots);
            console.log('[SaveSystem] Save antigo migrado automaticamente para o Slot 1.');
        } catch (e) {
            console.error('[SaveSystem] Não foi possível migrar o save antigo (mantido intacto):', e);
        }
    }

    _isValidGameState(gameState) {
        return !!(gameState && gameState.player && typeof gameState.player.name === 'string' && gameState.player.baseStats);
    }

    _emptySlotArray() {
        return new Array(this.maxSlots).fill(null);
    }

    _readSlotsRaw() {
        try {
            const raw = localStorage.getItem(this.slotsKey);
            if (!raw) return null;
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : null;
        } catch (e) {
            console.error('[SaveSystem] Lista de slots corrompida:', e);
            return null;
        }
    }

    _writeSlotsRaw(slots) {
        localStorage.setItem(this.slotsKey, JSON.stringify(slots));
    }

    // Retorna os 5 slots (null = vazio), sempre no tamanho fixo maxSlots
    getSlots() {
        const slots = this._readSlotsRaw() || this._emptySlotArray();
        while (slots.length < this.maxSlots) slots.push(null);
        return slots.slice(0, this.maxSlots);
    }

    // Arquétipo cosmético derivado do maior atributo base (não é uma mecânica
    // real, só um rótulo de identidade pro slot de save)
    _deriveArchetype(p) {
        const labels = { str: 'Guerreiro', agi: 'Duelista', int: 'Arcano', def: 'Guardião', acc: 'Atirador', luk: 'Sortudo', cha: 'Carismático' };
        let best = 'str', bestVal = -1;
        for (let stat in labels) {
            const val = (p.baseStats && p.baseStats[stat]) || 0;
            if (val > bestVal) { bestVal = val; best = stat; }
        }
        return labels[best];
    }

    _screenLabel(screen) {
        const labels = {
            HUB: 'Cidade', BATTLE: 'Em Combate', SHOP: 'Mercado', LADDER: 'Adversários',
            SKILLS: 'Talentos', INVENTORY: 'Inventário', HEALER: 'Curandeiro',
            ACHIEVEMENTS: 'Conquistas', RESULTS: 'Resultados', CREATION: 'Criação de Personagem'
        };
        return labels[screen] || 'Cidade';
    }

    // Monta a entrada completa de um slot (metadados de exibição + dados reais)
    _buildSlotEntry(gameState, version, timestamp) {
        const p = gameState.player;
        return {
            version: version || this.version,
            timestamp: timestamp || Date.now(),
            meta: {
                name: p.name,
                level: p.level,
                archetype: this._deriveArchetype(p),
                gold: p.gold,
                hoursPlayed: Math.round(((p.playTimeSeconds || 0) / 3600) * 10) / 10,
                location: this._screenLabel(gameState.screen),
                wins: p.wins || 0,
            },
            data: gameState,
        };
    }

    // --- API usada pelo resto do jogo — salva/carrega sempre no slot atual ---
    save(gameState) {
        if (this.currentSlotId === null) return false;
        try {
            const slots = this.getSlots();
            slots[this.currentSlotId] = this._buildSlotEntry(gameState, this.version, Date.now());
            this._writeSlotsRaw(slots);
            return true;
        } catch (e) {
            console.error('[SaveSystem] Erro crítico ao salvar:', e);
            return false;
        }
    }

    load() {
        if (this.currentSlotId === null) return null;
        return this.loadSlot(this.currentSlotId);
    }

    // --- API de gerenciamento de slots ---
    loadSlot(slotId) {
        const slots = this.getSlots();
        const entry = slots[slotId];
        if (!this._validateEntry(entry)) return null;
        this.currentSlotId = slotId;
        return entry.data;
    }

    _validateEntry(entry) {
        return !!(entry && this._isValidGameState(entry.data));
    }

    deleteSlot(slotId) {
        const slots = this.getSlots();
        slots[slotId] = null;
        this._writeSlotsRaw(slots);
        if (this.currentSlotId === slotId) this.currentSlotId = null;
    }

    duplicateSlot(fromId, toId) {
        const slots = this.getSlots();
        if (!this._validateEntry(slots[fromId])) return false;
        const copy = JSON.parse(JSON.stringify(slots[fromId]));
        copy.timestamp = Date.now();
        slots[toId] = copy;
        this._writeSlotsRaw(slots);
        return true;
    }

    // Exporta um slot como texto codificado (o jogador pode copiar/baixar e
    // colar de volta depois, inclusive em outro navegador/dispositivo)
    exportSlot(slotId) {
        const slots = this.getSlots();
        const entry = slots[slotId];
        if (!this._validateEntry(entry)) return null;
        try {
            return btoa(unescape(encodeURIComponent(JSON.stringify(entry))));
        } catch (e) {
            console.error('[SaveSystem] Erro ao exportar slot:', e);
            return null;
        }
    }

    // Importa um texto exportado anteriormente para um slot (com verificação
    // de integridade — nunca aceita um texto corrompido ou de formato errado)
    importToSlot(slotId, exportedString) {
        try {
            const jsonString = decodeURIComponent(escape(atob(exportedString.trim())));
            const entry = JSON.parse(jsonString);
            if (!this._validateEntry(entry)) throw new Error('Formato de save inválido');
            const slots = this.getSlots();
            slots[slotId] = entry;
            this._writeSlotsRaw(slots);
            return true;
        } catch (e) {
            console.error('[SaveSystem] Erro ao importar save:', e);
            return false;
        }
    }

    getMostRecentSlotId() {
        const slots = this.getSlots();
        let bestId = null, bestTime = -1;
        slots.forEach((entry, i) => {
            if (this._validateEntry(entry) && entry.timestamp > bestTime) { bestTime = entry.timestamp; bestId = i; }
        });
        return bestId;
    }

    hasAnySave() {
        return this.getSlots().some(s => this._validateEntry(s));
    }

    // --- Configurações (voláteis a parte, independentes de personagem/slot) ---
    saveSettings(settings) {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('[SaveSystem] Erro ao salvar configurações:', e);
            return false;
        }
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(this.settingsKey);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('[SaveSystem] Configurações corrompidas, usando padrão:', e);
            return null;
        }
    }

    // Mantido por compatibilidade retroativa (ex: eventuais chamadas externas antigas)
    deleteSave() {
        if (this.currentSlotId !== null) this.deleteSlot(this.currentSlotId);
    }
}

window.SaveManager = new SaveSystem();
