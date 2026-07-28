/**
 * Configurações do Jogo — persistidas independentemente dos slots de save
 * (afetam o navegador/dispositivo, não um personagem específico).
 *
 * SettingsManager guarda os valores e sabe como "aplicá-los de fato" nos
 * outros sistemas (áudio, gráficos, interface). Qualquer alteração feita na
 * tela de Configurações chama `set()`, que já salva automaticamente.
 */
class SettingsManager {
    constructor() {
        this.defaults = {
            masterVolume: 0.5,
            musicVolume: 0.4,
            sfxVolume: 0.6,
            language: 'pt-BR',
            graphicsQuality: 'alta',   // baixa | media | alta
            uiScale: 1.0,              // 0.85 - 1.25
            showFPS: false,
            showFloatingDamage: true,
            animationSpeed: 1.0,       // 0.5 - 2.0
            reduceEffects: false,
            screenShake: true,         // tremor de câmera no impacto (ver graphics.js _triggerScreenShake)
        };
        const saved = window.SaveManager.loadSettings();
        this.values = Object.assign({}, this.defaults, saved || {});
    }

    get(key) { return this.values[key]; }

    set(key, value) {
        this.values[key] = value;
        window.SaveManager.saveSettings(this.values);
        this.applyOne(key);
    }

    // Aplica todas as configurações atuais nos sistemas correspondentes —
    // chamado uma vez na inicialização e sempre que um save é carregado.
    applyAll() {
        Object.keys(this.values).forEach(key => this.applyOne(key));
    }

    applyOne(key) {
        const v = this.values[key];
        switch (key) {
            case 'masterVolume':
                if (window.AudioManager) { window.AudioManager.masterVolume = v; window.AudioManager.updateMusicVolume(); }
                break;
            case 'musicVolume':
                if (window.AudioManager) { window.AudioManager.musicVolume = v; window.AudioManager.updateMusicVolume(); }
                break;
            case 'sfxVolume':
                if (window.AudioManager) window.AudioManager.sfxVolume = v;
                break;
            case 'graphicsQuality':
                if (window.GFX) window.GFX.qualityLevel = v;
                break;
            case 'uiScale':
                document.documentElement.style.fontSize = `${16 * v}px`;
                break;
            case 'showFPS':
                document.getElementById('fps-counter').classList.toggle('hidden', !v);
                break;
            case 'showFloatingDamage':
                if (window.GFX) window.GFX.showFloatingDamage = v;
                break;
            case 'animationSpeed':
                if (window.GFX) window.GFX.animationSpeedMultiplier = v;
                break;
            case 'reduceEffects':
                if (window.GFX) window.GFX.reduceEffects = v;
                break;
            case 'screenShake':
                if (window.Engine) window.Engine.screenShakeEnabled = v;
                break;
            // 'language' e 'fullscreen' não têm estado contínuo pra aplicar aqui
        }
    }

    resetToDefaults() {
        this.values = Object.assign({}, this.defaults);
        window.SaveManager.saveSettings(this.values);
        this.applyAll();
    }
}

window.Settings = new SettingsManager();
