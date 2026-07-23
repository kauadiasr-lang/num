/**
 * Motor de Habilidades e Magias
 */

const SKILL_TYPES = {
    PHYSICAL: 'PHYSICAL', // Escala com Força (Dano de Arma)
    MAGIC: 'MAGIC',       // Escala com Inteligência
    HEAL: 'HEAL',         // Escala com Inteligência (Cura)
    BUFF: 'BUFF'          // Modificadores de status
};

class Skill {
    constructor(id, name, type, mpCost, powerMulti, description, levelReq) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.mpCost = mpCost;
        this.powerMulti = powerMulti; // Multiplicador de dano/cura
        this.description = description;
        this.levelReq = levelReq; // Nível exigido do jogador para desbloquear
    }
}

// Banco de Dados Escalável de Habilidades
const SkillDatabase = {
    'heavy_strike': new Skill('heavy_strike', 'Golpe Pesado', SKILL_TYPES.PHYSICAL, 10, 1.5, 'Um ataque focado que causa 150% do Dano Físico.', 2),
    'quick_heal': new Skill('quick_heal', 'Cura Básica', SKILL_TYPES.HEAL, 15, 1.0, 'Restaura HP baseado na sua Inteligência.', 3),
    'fireball': new Skill('fireball', 'Bola de Fogo', SKILL_TYPES.MAGIC, 25, 2.0, 'Magia elemental causando 200% do Dano Mágico (Inteligência).', 4),
    'fury': new Skill('fury', 'Ataque Furioso', SKILL_TYPES.PHYSICAL, 20, 2.2, 'Um ataque selvagem com 220% do Dano Físico.', 5)
};

window.SkillDB = SkillDatabase;
