# Civilização das Vilas (v1.3)

A camada `scripts/village/` transforma vilas em sociedades vivas. O
princípio de projeto é **zero IA falsa**: cada sistema é implementado
sobre mecânicas que a engine executa DE VERDADE — baús físicos, blocos
repostos, nascimentos pelo mecanismo vanilla de disposição, guardas como
entidade própria. Onde a engine não coopera, o sistema é redesenhado
para um equivalente real (documentado abaixo), nunca simulado por texto.

## Arquitetura e desempenho

- **Registro** (`registry.js`): cada vila é um registro persistente —
  centro (média móvel), livro-razão, honra por jogador, crimes, perdas,
  conhecimento, ameaça, prosperidade. Descoberta preguiçosa (3+ aldeões
  perto de um jogador), teto LRU de 8 vilas, gravação suja 1×/30 s.
- **Escalonador LOD**: um único intervalo (10 ticks) roda UMA tarefa de
  UMA vila por fatia, em rodízio. Vilas sem jogador num raio de 128
  ficam dormentes (decaimentos são por carimbo de tempo — custo zero).
  Custo por tick constante, independente do número de vilas.

## Sistemas

| Sistema | Mecânica real |
|---|---|
| **Personas** | 5 traços + humor por aldeão (dynamic properties); nome+sobrenome no nameTag |
| **Famílias** | linhagens equilibradas; bebês herdam dos adultos próximos; luto com efeitos; herança de casas anunciada |
| **Casas** | portas descobertas por varredura orçada; fecham à noite/lockdown (setPermutation); reparo físico com madeira do celeiro |
| **Economia** | celeiro = baú real perto do centro; livro-razão espelha o conteúdo; coleta de itens do chão; partilha de pão físico |
| **Profissões** | fazendeiro colhe/replanta blocos reais; ferreiro regenera defensores; flecheiro fortalece guardas; bibliotecário acumula conhecimento (promove guardas); clérigo cura doentes; construtor repara portas, apaga fogo e planta tochas |
| **Honra** | pontos por vila/jogador; herói (recepção), suspeito (vigilância), fora-da-lei (guardas ATACAM — tag `neuro_outlaw`) |
| **Crime** | testemunhas com linha de visão real (canSee); boatos contagiam nas conversas; lockdown fecha portas; evidência decai (assassinato nunca) |
| **Guardas** | entidade `neuro:guard` (JSON próprio, família `neuro_defender` — integra com alarme/sino/waypoints); recrutamento DEBITA ferro/esmeralda do celeiro; turnos alternam por dia; tiers por conhecimento |
| **Social** | pares se ENCARAM (setRotation); crianças brincam (impulso+efeitos); pôr do sol para curiosos; aconchego na chuva; presentes físicos |
| **Eventos** | festival (fogos reais, consome comida), casamento (cônjuge muda de sobrenome), nascimento (pão→disposição vanilla→bebê real), epidemia (tag+sintomas, clérigo cura), criança perdida (busca real + honra), gado (custo→filhote), caravana (trader vanilla+escolta+memória de emboscada), bandidos (opt-in) |

## Aprendizado adaptativo

Ameaça (ataques/crimes) sobe o teto de guardas e mantém escolta de
crianças; emboscada de caravana muda as chegadas para o dia com escolta
dobrada; escassez de comida prioriza fazendeiros e pausa partilha;
escassez de madeira pausa reparos. Tudo decai com o tempo de paz.

## Limites de engine (honestos)

- **Preços de trade** não são alteráveis por script — a recompensa de
  honra é dada em partilha, presentes e convites, não em desconto.
- **Pathing de aldeões** não é controlável sem sobrescrever o
  villager_v2 (arriscado demais — ver LIMITES §21). Movimentos são
  expressos por efeitos, olhar (setRotation) e waypoints de DEFENSORES.
- **Construção de edifícios novos** exigiria colar schematics —
  adiado por design (reparos, tochas e portas são blocos reais).
- **Visual do guarda** referencia geometria/animações vanilla do
  vindicator; numa versão futura pode ganhar modelo próprio.

## Comandos úteis

`/scriptevent neuro:cronica` — inclui os contadores da civilização.
`/scriptevent neuro:ver` — olhar para um aldeão mostra persona e humor.
Menu → categoria **Vila** — 15 opções da civilização (tudo desligável).
