/**
 * Sistema de Salvamento em LocalStorage
 * Possui versionamento para permitir atualizações futuras do jogo sem quebrar saves antigos.
 */
class SaveSystem {
    constructor() {
        this.saveKey = 'ArenaOfBlades_SaveData';
        this.version = '1.0.0';
    }

    // Salva o estado atual do jogo
    save(gameState) {
        try {
            const dataToSave = {
                version: this.version,
                timestamp: Date.now(),
                data: gameState
            };
            const jsonString = JSON.stringify(dataToSave);
            // Codificação base64 simples para ofuscar o save
            const encodedData = btoa(unescape(encodeURIComponent(jsonString)));
            localStorage.setItem(this.saveKey, encodedData);
            console.log("[SaveSystem] Progresso salvo com sucesso.");
            return true;
        } catch (e) {
            console.error("[SaveSystem] Erro crítico ao salvar:", e);
            return false;
        }
    }

    // Carrega o estado do jogo
    load() {
        try {
            const encodedData = localStorage.getItem(this.saveKey);
            if (!encodedData) return null; // Novo jogo

            const jsonString = decodeURIComponent(escape(atob(encodedData)));
            const parsedData = JSON.parse(jsonString);

            // Aqui, no futuro, implementaremos migração de dados caso a versão do save mude
            console.log(`[SaveSystem] Save carregado (Versão: ${parsedData.version})`);
            return parsedData.data;
        } catch (e) {
            console.error("[SaveSystem] Erro crítico ao carregar (Save corrompido):", e);
            return null;
        }
    }

    deleteSave() {
        localStorage.removeItem(this.saveKey);
        console.log("[SaveSystem] Save deletado.");
    }
}

window.SaveManager = new SaveSystem();
