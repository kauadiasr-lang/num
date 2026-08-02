/**
 * Câmera de mundo — fundação do redesenho do sistema de viagem (ver
 * docs/superpowers/specs/2026-08-02-explorable-world-travel-design.md).
 * Converte coordenadas de MUNDO (onde jogador/prédios/NPCs realmente
 * estão) em coordenadas de TELA (onde desenhar) — o inverso de antes,
 * quando a Praça inteira sempre cabia na tela e não existia distinção
 * entre as duas. Reaproveitado por CityEngine (Praça) e, na Fase 2, pelo
 * mundo da Estrada — um único sistema de câmera pro jogo inteiro.
 */
window.Camera = {
    x: 0,
    y: 0,

    // Centraliza a câmera na entidade (normalmente o jogador) — chamado a
    // cada frame antes de desenhar.
    follow(entity) {
        this.x = entity.x;
        this.y = entity.y;
    },

    // Quanto transladar o canvas (ctx.translate(dx, dy)) pra centralizar o
    // alvo da câmera na tela.
    getOffset(canvasW, canvasH) {
        return { dx: canvasW / 2 - this.x, dy: canvasH / 2 - this.y };
    },

    // Converte um ponto de MUNDO pra coordenada de TELA — usado tanto pra
    // desenhar objeto a objeto (quando não dá pra usar um único
    // ctx.translate) quanto pra converter cliques/toques de volta (ver
    // CityEngine._handleClick).
    toScreen(worldX, worldY, canvasW, canvasH) {
        const offset = this.getOffset(canvasW, canvasH);
        return { x: worldX + offset.dx, y: worldY + offset.dy };
    },

    // true se o ponto de mundo cai dentro da tela (+ margem) — usado pra
    // não desenhar/simular objetos totalmente fora de vista (culling).
    isVisible(worldX, worldY, canvasW, canvasH, margin = 100) {
        const screen = this.toScreen(worldX, worldY, canvasW, canvasH);
        return screen.x >= -margin && screen.x <= canvasW + margin
            && screen.y >= -margin && screen.y <= canvasH + margin;
    }
};
