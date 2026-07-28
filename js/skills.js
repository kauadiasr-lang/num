/**
 * Motor de Habilidades e Magias
 */

const SKILL_TYPES = {
    PHYSICAL: 'PHYSICAL',   // Escala com Força (Dano de Arma)
    MAGIC: 'MAGIC',         // Escala com Inteligência
    HEAL: 'HEAL',           // Escala com Inteligência (Cura)
    BLEED: 'BLEED',         // Dano inicial + sangramento contínuo por N turnos
    STUN: 'STUN',           // Dano + chance de atordoar (inimigo perde o turno seguinte)
    LIFESTEAL: 'LIFESTEAL', // Dano físico que cura o atacante por uma % causada
    BUFF: 'BUFF',           // Modificadores de status
    TELEPORT_ENEMY: 'TELEPORT_ENEMY', // Magia básica: teleporta o jogador para o corpo a corpo do inimigo
    TELEPORT_FAR: 'TELEPORT_FAR',     // Magia básica: teleporta o jogador para o ponto mais distante do inimigo
    AMMO_RECALL: 'AMMO_RECALL',       // Magia básica: recarrega a munição da arma de longo alcance equipada
    SHIELD: 'SHIELD',                 // Reduz % do dano recebido por N turnos (árvore de Linhagem: Luz)
    EVASION: 'EVASION'                // Aumenta a esquiva por N turnos (árvore de Linhagem: Vampirismo)
};

class Skill {
    constructor(id, name, type, mpCost, powerMulti, description, levelReq, extra = {}) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.mpCost = mpCost;
        this.powerMulti = powerMulti; // Multiplicador de dano/cura
        this.description = description;
        this.levelReq = levelReq; // Nível exigido do jogador para desbloquear

        // Habilidades físicas (PHYSICAL/BLEED/STUN/LIFESTEAL) usam o alcance da
        // arma equipada; `range` só é relevante para magias (MAGIC), que atacam
        // à distância independente de arma. `aoe` reserva o campo de área de
        // efeito para quando o jogo tiver múltiplos alvos por batalha.
        this.range = null;
        this.aoe = false;
        this.cooldown = 1;
        this.animation = type === 'MAGIC' || type === 'HEAL' ? 'cast' : 'attack';

        Object.assign(this, extra); // campos específicos do tipo: duration, stunChance, lifestealPercent, range, cooldown...
    }
}

// Banco de Dados Escalável de Habilidades
const SkillDatabase = {
    'heavy_strike': new Skill('heavy_strike', 'Golpe Pesado', SKILL_TYPES.PHYSICAL, 10, 1.5, 'Um ataque focado que causa 150% do Dano Físico. Usa o alcance da sua arma.', 2, { cooldown: 1 }),
    'quick_heal': new Skill('quick_heal', 'Cura Básica', SKILL_TYPES.HEAL, 15, 1.0, 'Restaura HP baseado na sua Inteligência. Pode ser usada a qualquer distância.', 3, { cooldown: 2 }),
    'fireball': new Skill('fireball', 'Bola de Fogo', SKILL_TYPES.MAGIC, 25, 2.0, 'Magia elemental de longo alcance (8m), causando 200% do Dano Mágico (Inteligência).', 4, { cooldown: 3, range: 8 }),
    'fury': new Skill('fury', 'Ataque Furioso', SKILL_TYPES.PHYSICAL, 20, 2.2, 'Um ataque selvagem com 220% do Dano Físico. Usa o alcance da sua arma.', 5, { cooldown: 3 }),
    'bleeding_cut': new Skill('bleeding_cut', 'Corte Sangrento', SKILL_TYPES.BLEED, 15, 0.8, 'Corta o inimigo, causando dano e sangramento por 3 turnos. Usa o alcance da sua arma.', 3, { duration: 3, cooldown: 3 }),
    'shield_bash': new Skill('shield_bash', 'Investida de Escudo', SKILL_TYPES.STUN, 18, 0.8, 'Atordoa o inimigo, fazendo-o perder o próximo turno. Usa o alcance da sua arma.', 6, { stunChance: 70, cooldown: 4 }),
    'vampiric_strike': new Skill('vampiric_strike', 'Golpe Vampírico', SKILL_TYPES.LIFESTEAL, 22, 1.3, 'Ataque brutal que rouba 50% do dano causado como HP. Usa o alcance da sua arma.', 7, { lifestealPercent: 50, cooldown: 4 }),

    // Magias básicas, baratas (1-5 MP) e liberadas desde o nível 1 — dão ao
    // jogador ferramentas táticas simples de mobilidade/suporte sem exigir
    // progressão, complementando as habilidades de dano/cura mais caras acima.
    'blink_strike': new Skill('blink_strike', 'Lampejo de Investida', SKILL_TYPES.TELEPORT_ENEMY, 3, 1.0, 'Magia básica: teleporta você instantaneamente para o corpo a corpo do inimigo.', 1, { cooldown: 2 }),
    'blink_retreat': new Skill('blink_retreat', 'Lampejo de Fuga', SKILL_TYPES.TELEPORT_FAR, 3, 1.0, 'Magia básica: teleporta você instantaneamente para o ponto mais distante do inimigo.', 1, { cooldown: 2 }),
    'ammo_recall': new Skill('ammo_recall', 'Recolher Munição', SKILL_TYPES.AMMO_RECALL, 4, 1.0, 'Magia básica: recupera magicamente toda a munição da sua arma de longo alcance equipada.', 1, { cooldown: 3 }),

    // Habilidades de alto nível: antes vampiric_strike (Nv.7) era a última
    // habilidade comum a ser desbloqueada — qualquer jogador acima disso
    // (rotina até no nível 10, ver AchievementDB.legend) acumulava Pontos de
    // Talento sem NENHUMA opção nova de combate pra gastar, só o respec.
    'execution_blow': new Skill('execution_blow', 'Golpe Final', SKILL_TYPES.PHYSICAL, 24, 2.6, 'Um golpe devastador com 260% do Dano Físico. Usa o alcance da sua arma.', 9, { cooldown: 4 }),
    'arcane_storm': new Skill('arcane_storm', 'Tempestade Arcana', SKILL_TYPES.MAGIC, 32, 2.8, 'Magia elemental de longo alcance (9m), causando 280% do Dano Mágico (Inteligência).', 11, { cooldown: 4, range: 9 })
};

window.SkillDB = SkillDatabase;
