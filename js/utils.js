/**
 * Utilitários do Motor do Jogo
 * Gerenciamento de matemática, RNG (Random Number Generator) e formatações.
 */
class GameUtils {
    // Retorna um número inteiro aleatório entre min e max (inclusivos)
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Retorna um float aleatório
    static randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    // Simula a rolagem de dados (ex: 2d6)
    static rollDice(quantidade, faces) {
        let total = 0;
        for (let i = 0; i < quantidade; i++) {
            total += this.randomInt(1, faces);
        }
        return total;
    }

    // Calcula chance percentual (ex: chance(30) retorna true 30% das vezes)
    static chance(percent) {
        return Math.random() * 100 <= percent;
    }

    // Limita um valor entre um mínimo e um máximo
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    // Interpolação linear (útil para animações fluidas)
    static lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    // Sorteia uma chave de `weights` ({chave: peso}) proporcionalmente ao seu
    // peso — usado pela demografia racial das Cidades-Hub (ver
    // CityDatabase/enemy.js), mas genérico o bastante para qualquer sorteio
    // ponderado futuro. Pesos <= 0 nunca são sorteados. Sem nenhuma entrada
    // com peso > 0, retorna null (quem chama decide o fallback).
    static weightedPick(weights) {
        const entries = Object.entries(weights).filter(([, w]) => w > 0);
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        if (total <= 0) return null;
        let roll = Math.random() * total;
        for (const [key, w] of entries) {
            if (roll < w) return key;
            roll -= w;
        }
        return entries[entries.length - 1][0];
    }

    // Gera um ID único para itens gerados proceduralmente
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Expõe globalmente
window.Utils = GameUtils;
