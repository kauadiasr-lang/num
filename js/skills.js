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
    BUFF: 'BUFF'            // Modificadores de status
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
        Object.assign(this, extra); // campos específicos do tipo: duration, stunChance, lifestealPercent...
    }
}

// Banco de Dados Escalável de Habilidades
const SkillDatabase = {
    'heavy_strike': new Skill('heavy_strike', 'Golpe Pesado', SKILL_TYPES.PHYSICAL, 10, 1.5, 'Um ataque focado que causa 150% do Dano Físico.', 2),
    'quick_heal': new Skill('quick_heal', 'Cura Básica', SKILL_TYPES.HEAL, 15, 1.0, 'Restaura HP baseado na sua Inteligência.', 3),
    'fireball': new Skill('fireball', 'Bola de Fogo', SKILL_TYPES.MAGIC, 25, 2.0, 'Magia elemental causando 200% do Dano Mágico (Inteligência).', 4),
    'fury': new Skill('fury', 'Ataque Furioso', SKILL_TYPES.PHYSICAL, 20, 2.2, 'Um ataque selvagem com 220% do Dano Físico.', 5),
    'bleeding_cut': new Skill('bleeding_cut', 'Corte Sangrento', SKILL_TYPES.BLEED, 15, 0.8, 'Corta o inimigo, causando dano e sangramento por 3 turnos.', 3, { duration: 3 }),
    'shield_bash': new Skill('shield_bash', 'Investida de Escudo', SKILL_TYPES.STUN, 18, 0.8, 'Atordoa o inimigo, fazendo-o perder o próximo turno.', 6, { stunChance: 70 }),
    'vampiric_strike': new Skill('vampiric_strike', 'Golpe Vampírico', SKILL_TYPES.LIFESTEAL, 22, 1.3, 'Ataque brutal que rouba 50% do dano causado como HP.', 7, { lifestealPercent: 50 })
};

window.SkillDB = SkillDatabase;
