/**
 * Raças jogáveis — escolhidas uma vez na Criação de Personagem (diferente da
 * Linhagem, que é uma mutação conquistada durante a campanha, ver
 * lineages.js). Cada raça é um vetor real de vantagens/desvantagens de
 * atributo, nunca só um rótulo estético — aplicado como uma camada a mais
 * em cima da Força/Agilidade/etc já distribuídas pelo jogador, do mesmo
 * jeito que equipamento soma bônus (ver Entity.getTotalStat em player.js).
 *
 * Registry orientado a dados: uma raça nova é só mais uma entrada aqui, sem
 * tocar no motor (ui.js já itera Object.values(RACES) pra montar o seletor
 * da Criação de Personagem).
 */
const RACES = {
    humano: {
        id: 'humano', name: 'Humano',
        tagline: 'Adaptável e equilibrado — sem vantagens nem fraquezas extremas.',
        description: 'Vindos de todos os cantos da arena, os humanos não têm o dom de nenhum povo em particular, mas também não carregam nenhuma de suas fraquezas.',
        statMods: {}
        // Sem `accent`: humano não ganha nenhuma faixa/adereço cultural no
        // torso (ver graphics.js _drawRaceSash) — é a raça "neutra".
    },
    espartano: {
        id: 'espartano', name: 'Espartano',
        tagline: 'Forjado pra guerra desde a infância. Corpo de aço, mente de soldado.',
        description: 'Criados em disciplina marcial desde os sete anos de idade, os espartanos entram na arena mais fortes e mais resistentes que qualquer rival — mas o treino constante deixou pouco tempo pra retórica ou estratagemas.',
        statMods: { str: 2, def: 1, int: -1 },
        accent: '#a3201c' // vermelho espartano clássico (capa/faixa)
    },
    ateniense: {
        id: 'ateniense', name: 'Ateniense',
        tagline: 'Filósofos e oradores — não menos perigosos por isso.',
        description: 'Educados em retórica, matemática e os primeiros princípios da guerra, os atenienses trazem pra arena uma mente afiada e um carisma que o público adora, mas raramente têm o físico bruto dos povos guerreiros.',
        statMods: { int: 2, cha: 1, str: -1 },
        accent: '#2a5a8a' // azul-violeta, tom "erudito"
    },
    cretense: {
        id: 'cretense', name: 'Cretense',
        tagline: 'Rápidos como o vento de Creta, ágeis como as próprias lendas do labirinto.',
        description: 'Descendentes dos lendários arqueiros e acrobatas de Creta, movem-se pela arena com uma leveza que ninguém mais alcança — ao custo de uma guarda mais frágil sob pressão.',
        statMods: { agi: 2, luk: 1, def: -1 },
        accent: '#1a8a7a' // turquesa egeu
    },
    tebano: {
        id: 'tebano', name: 'Tebano',
        tagline: 'Soldados de elite, escudo contra escudo, ombro a ombro.',
        description: 'Herdeiros da tradição hoplita de Tebas, lutam com uma disciplina defensiva que poucos povos conseguem igualar, ainda que isso custe um pouco da precisão dos golpes mais calculados.',
        statMods: { def: 2, str: 1, acc: -1 },
        accent: '#8a6a2a' // bronze hoplita
    }
};
window.RACES = RACES;

window.RaceSystem = {
    getAll() { return Object.values(RACES); },
    get(id) { return RACES[id] || RACES.humano; }
};
