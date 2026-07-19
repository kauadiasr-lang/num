# O que mudou? — IA vanilla vs. NeuroMobs (v1.1.0)

## Sistemas globais (mobs da onda 1)

| Aspecto | Vanilla | NeuroMobs |
|---|---|---|
| Perder o jogador de vista | Esquece em segundos e volta a vagar | Lembra a última posição por até 30 s e **vai investigar o local exato**; se reavistar (visão real), reengaja na hora |
| Comunicação | Zumbis podem convocar reforços por spawn; o resto ignora aliados | Qualquer mob esperto **alerta até 8 aliados num raio de 24 blocos**; quem não vê o alvo recebe um ponto de investigação compartilhado |
| Perseguição em grupo | Fila indiana atrás do jogador | Com 3+ mobs no mesmo alvo, metade **flanqueia circundando** e os papéis giram a cada ~3 s — cercam em vez de enfileirar |
| Rotas e perigos | Pisam em magma/cacto/bagas, caem de penhascos atrás do alvo | `avoid_damage_blocks` + custo 50 nesses blocos no `preferred_path`; quedas voluntárias limitadas a 3 blocos |
| Alcance de perseguição | Curto (ex.: esqueleto ~16 blocos) e esquecimento rápido | `follow_range` 32–56 e memória de alvo de 30–60 s |
| Sons | Nenhuma reação a blocos | Quebrar/colocar blocos atrai até 4 mobs ociosos ao **ponto exato do som** (raio 20) |
| Escolha de alvo | Jogador mais próximo | Com 2+ jogadores, a matilha **prioriza o mais vulnerável** (menos armadura/vida — tag `neuro_prio`) |
| Dificuldade | Fixa | Contra alvos bem equipados os mobs ganham Velocidade (e Resistência no Difícil); nada muda no Fácil/Pacífico |
| Torres/pilares | Corpo a corpo se amontoa inutilmente na base | **Anti-torre**: corpo a corpo cerca a 4–9 blocos esperando você descer; **creepers detonam a base do pilar**; à distância atiram; enderman teleporta até você |
| Individualidade | Todo zumbi é idêntico | **Personalidades** (cauteloso/normal/audaz) mudam velocidade, papel no cerco e furtividade; **Veteranos** nomeados com resistência e grito 1,5× |
| Lua e clima | Nenhum efeito na IA | Lua cheia amplia alertas e veteranos; **chuva corta a audição pela metade**; trovoada agita; raios espantam rebanhos |
| Explosões | Nenhum efeito na IA | Monstros próximos ficam **5 s surdos** — explodir algo abre uma janela de silêncio |
| Abelhas | Só a abelha ferida ataca | **O enxame inteiro se enfurece** |
| Alcateias | Lobos caçam "cada um por si" | Ataque de um lobo faz a **alcateia inteira arrancar junta**; presas debandam em rebanho — caçadas de verdade |
| Carcaças | Morte de animal não tem consequência | **O abate atrai monstros necrófagos** ao ponto exato — caçar à noite tem preço |
| Filhotes | Ferir um bebê = ferir um adulto | Rebanho reage **mais longe e por mais tempo**; bebês de vaca/galinha fogem antes e mais rápido |
| Sino | Só assusta aldeões por perto (e só em raid) | **Ferramenta tática**: badalar dispersa aldeões num raio de 32 e manda golems patrulharem em leque ao redor do sino |
| Aldeão perseguido | Golem só reage se o monstro passar perto | O "sequestrador" é **marcado** e vira prioridade absoluta do golem (resgate); em vilas sem golem, os jogadores próximos recebem alerta no HUD |
| Encontro solitário | Mob te vê = corre em linha reta | **Emboscada**: sozinho e não visto, ele SEGURA o bote e espera aliados se posicionarem — o silêncio é o aviso |
| Mob quase morto | Luta até morrer | **Retirada tática**: sem apoio, desengaja, busca reforço e VOLTA acompanhado |
| Veteranos | Só mais fortes | **Líderes**: inspiram o bando por perto; matá-los causa hesitação e debandada dos cautelosos |
| Aranha de dia | Ignora você | **Espreita a 10–14 blocos** até anoitecer (ou até você provocá-la) |
| Vila atacada de novo | Cada ataque é igual ao primeiro | **Memória regional**: vilas atacadas recentemente respondem mais forte (golems de mais longe, dispersão maior, aviso no HUD quando sitiada) — e a morte de um aldeão marca a região em dobro |
| Explosão perto da vila | Ninguém liga | O **golem investiga** o local |
| Aldeões ociosos | Estátuas com sons aleatórios | Pares próximos **"conversam"** (ambiência com sons vanilla) |
| Caçar sempre no mesmo lugar | Sem consequência | **Pressão de caça**: a fauna da região fica arisca por 1 dia de jogo — pânico maior e vacas/galinhas evitando você por 20 s |
| Fazenda à noite | Igual ao dia | **Descanso noturno**: o bando anda menos e mais devagar |
| Configuração | — | Menu no jogo (`/scriptevent neuro:menu`), tudo persistente e desligável recurso a recurso |

## Mob a mob

### Zumbi
| Vanilla | NeuroMobs |
|---|---|
| Persegue ~35 blocos com visão obrigatória | Alcance 40 (56 alertado), 15 s de perseguição às cegas após alerta, busca ativa ao perder contato |
| Anda em linha reta até o alvo | Participa do cerco rotativo (flanqueia) |
| Pisa em qualquer perigo | Evita magma, cacto, bagas, fogueiras; respeita penhascos |
| Mantido | Bebês (5%), conversão para drowned na água, quebra de portas no Difícil, queima de dia |

### Esqueleto
| Vanilla | NeuroMobs |
|---|---|
| Atira parado; deixa o jogador colar | **Kiting**: recua em disparada quando o jogador chega a < 4 blocos, sem parar de atirar |
| Alcance ~16 blocos | 32 (48 alertado) + cadência 1,0–2,2 s no raio de 16 |
| Caminha pelo sol | Navegação com `avoid_sun`: prefere sombra ao traçar rotas |
| — | Arco garantido via loot table própria; memória/busca/alerta completos |

### Creeper
| Vanilla | NeuroMobs |
|---|---|
| Avança sempre no mesmo ritmo, fácil de ver chegando | **Furtivo**: congela quando você olha na direção dele a média distância e avança quando você desvia o olhar |
| Detecta a ~16 blocos | 24 (40 alertado) + busca ativa |
| Mantido | Explosão (potência 3 / 6 carregado), carregamento por raio, ignição com pederneira, medo de gatos/jaguatiricas |

### Aranha
| Vanilla | NeuroMobs |
|---|---|
| Persegue e pronto | Cerco rotativo (circunda o alvo) + salto sobre o alvo mantido |
| Esquece rápido | Memória, busca ativa e resposta a alertas |
| Mantido | Escalada de paredes, neutralidade diurna (aprox. por horário), hostilidade se atacada |

### Husk
| Vanilla | NeuroMobs |
|---|---|
| Zumbi do deserto com Fome no golpe | Mantido, + todos os sistemas do zumbi (cerco, memória, alerta, anti-torre) e conversão em zumbi na água |

### Stray
| Vanilla | NeuroMobs |
|---|---|
| Esqueleto gélido com flecha de lentidão | Mantido (aux 18), + kiting, navegação na sombra, memória/busca/alerta |

### Aranha-de-caverna
| Vanilla | NeuroMobs |
|---|---|
| Pequena, venenosa, persegue direto | Veneno mantido, + flanco rotativo, cerco anti-torre, busca ativa |

### Drowned
| Vanilla | NeuroMobs |
|---|---|
| Nada e anda, alguns com tridente | Navegação anfíbia unificada, 15% com tridente arremessável, busca água de dia, cerco/memória/alerta completos |

### Enderman
| Vanilla | NeuroMobs |
|---|---|
| Ataca quem encara, teleporta | Mantidos (encarar via `lookat`, imunidade a flechas, dano por água) + **perseguição vertical por teleporte** — pilar não salva — memória e busca ativa. Solitário: não grita para o bando |

### Bruxa
| Vanilla | NeuroMobs |
|---|---|
| Arremessa poções variadas, bebe curas | Arremesso de poção nociva mantendo distância (kiting) + memória/busca/alerta. *Beber poções e seleção situacional de poção ficam para etapa futura* |

### Golem de ferro
| Vanilla | NeuroMobs |
|---|---|
| Reage quando o monstro chega perto | Caça monstros num raio de 24 (ignora creepers) e, num ataque à vila, é **direcionado até a ameaça** pelo alarme; alcance 32 quando alertado |
| Reparo com ferro | Mantido (+25 de vida por barra) |
| Pode retaliar jogadores | Nunca retalia jogadores (escolha segura — ver LIMITES §14) |

### Vaca e galinha
| Vanilla | NeuroMobs |
|---|---|
| Só fogem DEPOIS de apanhar | **Fuga proativa**: galinhas fogem de raposas/gatos a 10 blocos; ambas evitam monstros; pânico contagia o rebanho |
| Ordenha, ovos, reprodução | Tudo preservado; rotas evitam lava/cacto/penhasco |

### Todos os animais do jogo (sem override)
| Vanilla | NeuroMobs |
|---|---|
| Ferir 1 animal não afeta os outros | **Pânico de rebanho universal**: a mesma espécie num raio de 12 debanda junto |

### Aldeões (camada segura)
| Vanilla | NeuroMobs |
|---|---|
| Cada um por si | Ataque à vila dispara **alarme**: aldeões dispersam em velocidade e golems convergem para a ameaça. (Trocas, profissões e gossip intocados — sem override do villager_v2) |

### Esqueleto Wither
| Vanilla | NeuroMobs |
|---|---|
| Espadachim lento de fortaleza | Matilha completa (alerta, cerco, emboscada, retirada, veterania), Wither no golpe, imune a fogo — atravessa magma sem desviar |

## Exemplo prático (cenário típico)

Você minera à noite perto de uma caverna. Um zumbi te vê: **grita** — o
esqueleto na cornija e o creeper atrás da parede recebem o alerta e a sua
última posição. Você corre e dobra uma esquina: os três **não desistem** —
vão até onde te viram pela última vez e vasculham. O esqueleto que te
reencontra mantém distância **recuando enquanto atira**; dois zumbis chegam
e começam a **circular por lados opostos**; o creeper **para de se mover
sempre que você olha para ele**… e avança quando você se distrai. Em pânico,
você ergue um pilar de 4 blocos: os zumbis **não se amontoam** — abrem um
cerco ao redor esperando; o esqueleto continua atirando; e um creeper
encosta na base e **explode o seu apoio**. Cada peça disso pode ser
desligada no menu.

*(Tabelas com números finos, GIFs e vídeos entram na Etapa 4, junto do site.)*
