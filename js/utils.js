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

    // Mistura duas cores por canal, usando o mesmo lerp acima — usado pela
    // transição gradual de bioma na Estrada (ver roads.js/ui.js openRoad,
    // graphics.js drawRoadScenery: a cor de fundo/cena passa a refletir o
    // quanto do caminho já foi percorrido, em vez de trocar de paleta de
    // uma vez ao chegar). `amt` fora de [0,1] é automaticamente limitado.
    //
    // Aceita TANTO hex ("#rrggbb") QUANTO rgb()/rgba() — bug de auditoria
    // corrigido: citydatabase.js `treelineColor` de toda cidade é rgba()
    // (carrega opacidade real, parte da identidade visual da névoa/floresta
    // ao fundo de cada cidade), mas a versão original só entendia hex; misturar
    // dois rgba() através dela silenciosamente produzia `NaN` nos 3 canais
    // (fillStyle inválido = canvas ignora e mantém a cor anterior, nunca uma
    // exceção — por isso passava despercebido). Sempre devolve no MESMO
    // "formato de saída" da entrada: hex se as duas entradas eram hex
    // opacas, rgba() se qualquer uma delas já carregava opacidade (nunca
    // descarta a transparência original).
    static lerpColor(colorA, colorB, amt) {
        const t = this.clamp(amt, 0, 1);
        const toRgba = (c) => {
            if (c.startsWith('rgb')) {
                const nums = c.match(/[\d.]+/g).map(Number);
                return [nums[0], nums[1], nums[2], nums.length > 3 ? nums[3] : 1];
            }
            const clean = c.replace('#', '');
            return [
                parseInt(clean.substring(0, 2), 16),
                parseInt(clean.substring(2, 4), 16),
                parseInt(clean.substring(4, 6), 16),
                1
            ];
        };
        const [r1, g1, b1, a1] = toRgba(colorA);
        const [r2, g2, b2, a2] = toRgba(colorB);
        const r = Math.round(this.lerp(r1, r2, t));
        const g = Math.round(this.lerp(g1, g2, t));
        const b = Math.round(this.lerp(b1, b2, t));
        const a = this.lerp(a1, a2, t);
        if (a1 === 1 && a2 === 1 && !colorA.startsWith('rgb') && !colorB.startsWith('rgb')) {
            return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
        }
        return `rgba(${r},${g},${b},${a.toFixed(3)})`;
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
