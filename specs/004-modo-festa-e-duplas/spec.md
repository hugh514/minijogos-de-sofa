# 004 Modo festa e duplas

Arquivos de referência: `logica.mjs` (`criaPartida`, `configura`, `elegiveis`, `timeDe`, `venceu`, `moedasDaRodada`), `controle.html` (menu do Jogador 1), `jogos/LEIA.md` (seção "Modo Festa"), `logica-festa.test.mjs`, `e2e/teste-festa.js`.

## Problema

O jogo nasceu para duas pessoas. Em casa quase sempre há mais gente querendo jogar: três ou quatro pessoas, duplas contra duplas, ou todos do mesmo lado contra o jogo. Cada um desses jeitos muda quem pontua, quantos jogadores o minijogo aceita e como a partida termina, e o motor precisa tratar isso sem que cada minijogo reinvente a regra.

## Para quem

- Famílias e grupos de 2 a 4 pessoas no mesmo sofá.
- O Jogador 1, que é o anfitrião e escolhe a brincadeira no celular.
- Quem escreve minijogos, que declara com `festa` o que o seu jogo aceita.

## Requisitos

- RF-1. Há quatro brincadeiras, escolhidas no menu do celular do Jogador 1:
  - Duelo: exatamente 2 jogadores, só minijogos sem o campo `festa` (modo interno `classico`);
  - Cada um por si: 2 a 4 jogadores (modo `vs`), vence quem o minijogo indicar;
  - Duplas: só com 4 jogadores (modo `times`), time A com Jogador 1 e Jogador 3, time B com Jogador 2 e Jogador 4;
  - Todos juntos: 2 a 4 jogadores (modo `coop`), todos vencem ou todos perdem.
- RF-2. O minijogo da Festa declara `festa: { min, max, modos }`, com `min` e `max` de 2 a 4 e modos entre `vs`, `times` e `coop`. A rotação sorteia só os minijogos que servem ao modo e ao número de jogadores.
- RF-3. Em Cada um por si com 2 pessoas, a rotação também usa os minijogos do Duelo, menos os cooperativos, porque os de festa são poucos.
- RF-4. O que `atualiza` devolve e quem recebe o ponto:
  - Cada um por si: índice do vencedor (0 a n-1), só ele pontua;
  - Duplas: `0` ou `1` (o time), os dois do time pontuam;
  - Todos juntos: `2` (todos pontuam) ou `-1` (ninguém);
  - `-1` é empate nos outros modos.
- RF-5. Moedas por rodada: 10 para quem venceu (ou para o time, ou para todos), 3 para os outros, 5 em caso de empate e 3 para todos quando a equipe fracassa no cooperativo. Quem vence a partida leva 30 a mais.
- RF-6. A partida vai a `p.alvo` pontos: 10, ou 6 quando há menos de 6 minijogos elegíveis no modo. Em Duplas o ponto é do time.
- RF-7. O cooperativo não vai a pontos: dura 5 rodadas (`NOITES_COOP`). Se a equipe vence mais da metade, todos são campeões; senão ninguém é.
- RF-8. Trocar o número de jogadores ou o modo recomeça a partida (`configura`) sem perder o objeto de cada jogador nem os contadores de toque dos celulares que já estavam conectados.
- RF-9. Valores inválidos viram erro claro: `n` fora de 2 a 4, modo desconhecido, Duelo com `n` diferente de 2, Duplas com `n` diferente de 4.
- RF-10. Se o único minijogo de um modo falhar, a partida avisa (`p.semJogo`) e a tela volta ao menu, em vez de repetir o erro. O modo fica desabilitado até a página do minijogo ser recarregada com uma versão nova.
- RF-11. O empurrão sem direção, em partida com mais de 2 jogadores, vai para o jogador em pé mais próximo, nunca para quem já caiu.
- RF-12. O menu do Jogador 1 mostra as quatro brincadeiras. Duplas aparece desabilitada, com o motivo, enquanto não houver 4 celulares conectados. Só o celular do Jogador 1 tem o menu.
- RF-13. Com os Jogadores 1 e 2 conectados e ninguém mexendo no menu, o Duelo começa sozinho depois de 6 s, com contagem na TV e no celular. Com um modo da Festa escolhido, nada começa sozinho.
- RF-14. O Jogador 1 é quem se declara Jogador 1 ao abrir o controle. Não há autenticação (ver `specs/002-servidor-carteiro`).
- RF-18. O sofá tem 5 lugares (`MAX_JOGADORES`). Cada um por si e Todos juntos aceitam de 2 a 5; Duplas continua com 4 (com 5 no sofá o quinto torce) e o Duelo com 2. O minijogo de festa declara `max` de 2 a 5. Com 5 no sofá, minijogo feito para até 4 também entra: a cada rodada um descansa, em rodízio (J5, J4, J3, J2, J1), e os outros quatro jogam pela `vista(p)` (`p.duelo` traz os índices de quem joga). O resultado do minijogo aponta um dos quatro da vez e o ponto vai para o lugar de verdade; no cooperativo todos os 5 pontuam. Quem descansa fica fora da arena, vê no celular que volta na próxima e não ganha carta de poder por essa rodada.
- RF-17. Em Duplas o Jogador 1 escolhe quem joga com ele: no menu do celular, com Duplas marcada, ele toca na pílula de um dos outros três (`par` no `POST /modo`, lugar 2, 3 ou 4; sem escolha vale o lugar 3). Por dentro o time A segue sendo os índices 0 e 2: ao começar a partida a tela troca de índice a pessoa escolhida com quem está no índice 2 (`sentaDupla`, `lugar`), levando junto nome, cor, chapéu e os contadores do celular, e desfaz a troca na volta ao menu. Quem não tem nome continua aparecendo como "Jogador N" do lugar em que se sentou.
- RF-16. Cartas de poder em Cada um por si e em Duplas (nunca em Todos juntos): quem jogou e perdeu a rodada escolhe uma carta na próxima rodada em que jogar (no revezamento, quem está de fora guarda o direito). Vale dobro de quem venceu soma 1 ponto, para o time inteiro em Duplas. Escudo de quem jogou e perdeu segura o ponto e só é oferecido a quem está atrás de algum rival (o parceiro não é rival), nunca duas vezes seguidas.
- RF-15. Em Duplas a rotação também usa os minijogos do Duelo, menos os cooperativos. Numa rodada dessas joga um de cada dupla (`p.duelo`, o primeiro sempre do time A), na ordem J1 x J2, J3 x J4, J1 x J4, J3 x J2, que recomeça a cada partida. O minijogo recebe `vista(p)`: a mesma partida com `jogadores`, `celular` e `nomes` só dos dois da vez e `n` igual a 2. O placar, os pontos e os celulares seguem com os 4: o resultado `0` ou `1` é o time, os dois da dupla pontuam, só os dois da vez aparecem na arena e o celular do parceiro diz de quem é a vez e que ele torce.

## Critérios de aceite

- CA-1. `criaPartida` cria `n` jogadores e o Duelo segue com 2 (RF-1).
- CA-2. `n` e modo inválidos viram erro com mensagem clara, e Duplas só existe com 4 jogadores (RF-9).
- CA-3. A rotação filtra pelo modo e pelo número de jogadores, e o Duelo nunca recebe minijogo de festa (RF-2).
- CA-4. Em Cada um por si, só o vencedor indicado pontua, e o índice 3 só vale com 4 jogadores (RF-4).
- CA-5. Em Duplas, os jogadores 1 e 3 formam o time A e os jogadores 2 e 4 o time B, os dois do time pontuam e as moedas são 10 e 3 (RF-1, RF-4, RF-5).
- CA-6. Em Duplas, a partida acaba quando um time chega ao alvo, com os dois campeões e 40 moedas para cada um, e a partida recomeça no mesmo modo (RF-6, RF-5).
- CA-7. Em Todos juntos, `2` dá 1 ponto a todos e 10 moedas, `-1` não dá ponto e dá 3 moedas, e todos no alvo viram campeões (RF-4, RF-5).
- CA-8. A partida cooperativa dura 5 noites, conta as vencidas e acaba na quinta, com campeões só se a equipe venceu a maioria (RF-7).
- CA-9. O alvo de pontos é 6 com menos de 6 elegíveis e 10 com 6 ou mais, e a partida acaba nele (RF-6).
- CA-10. Cada um por si com 2 pessoas sorteia também minijogos do Duelo, e o cooperativo do Duelo nunca entra (RF-3).
- CA-11. `configura` troca `n` e modo, recomeça a partida e mantém os contadores dos celulares (RF-8).
- CA-12. Se o único minijogo do modo falha, a partida marca `semJogo`, e um modo cujo único minijogo quebrou deixa de estar jogável até chegar uma versão nova (RF-10).
- CA-13. O empurrão sem direção vai ao jogador em pé mais próximo (RF-11).
- CA-14. Com 3 celulares, o menu do Jogador 1 mostra Duplas desabilitada; com 4, habilitada; só o Jogador 1 tem o menu; com 4 conectados nada começa sozinho (RF-12, RF-13).
- CA-15. Um jogo completo de Duplas, de Cada um por si com 3 jogadores e de Todos juntos com 2 e com 4 jogadores roda no navegador com celulares de toque, termina e dá os pontos certos (RF-1, RF-4).
- CA-16. O Duelo com 2 jogadores segue com o placar de sempre e nenhum minijogo de festa entra na rotação (RF-1).
- CA-17. O Duelo começa sozinho depois de 6 s com os Jogadores 1 e 2 conectados (RF-13). Sem teste automatizado.
- CA-18. Valor de moedas em empate no Duelo e em Cada um por si: o teste cobre 5 moedas só para o Duelo, não para os modos da Festa (RF-5).
- CA-23. Com 5 celulares, o sofá, o menu do Jogador 1, o placar e o pódio mostram os 5; em cada rodada quatro jogam e um descansa (outra pessoa a cada rodada), só os quatro aparecem e se movem na arena, o celular de quem descansa avisa que ele volta na próxima, e só um dos que jogaram pode vencer (RF-18).
- CA-22. O Jogador 1 toca em quem joga com ele; a TV mostra as duplas escolhidas, o placar põe a dupla dele do lado laranja, cada celular controla o próprio boneco e recebe o resultado da sua dupla, e no menu cada um volta ao seu lugar (RF-17).
- CA-21. Em Cada um por si e em Duplas, quem jogou e perdeu escolhe uma carta na próxima rodada em que jogar; Vale dobro e Escudo mudam o ponto como no Duelo, com os pontos da dupla sempre iguais; no cooperativo não há cartas (RF-16).
- CA-19. Em Duplas entram os minijogos do Duelo sem os cooperativos; numa rodada deles só os dois da vez jogam e se movem, um de cada dupla, na ordem J1 x J2, J3 x J4, J1 x J4, J3 x J2, e os dois da dupla vencedora pontuam. Minijogo da Festa continua com os 4 (RF-15).
- CA-20. No navegador, uma rodada do Duelo em Duplas mostra só os dois da vez na arena, o placar com os 4, "Nesta rodada: X contra Y" na explicação e "Daqui você torce" no celular de quem está de fora, sem erro de minijogo nem de console (RF-15).

## Fora do escopo

- Mais de 5 jogadores.
- Jogadores com times de tamanhos desiguais (Duplas é sempre 2 contra 2).
- Revezamento em Cada um por si com 3 ou 4 jogadores (lá só entram os minijogos feitos para a Festa).
- Cartas de poder em Todos juntos e anúncios de arcade (sequência, virada) na Festa.
- Placar entre partidas guardado fora do navegador do PC.

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `logica-festa.test.mjs` | `festa: criaPartida cria n jogadores e o classico segue com 2` |
| CA-2 | `logica-festa.test.mjs` | `festa: n e modo invalidos viram erro claro` |
| CA-2 | `logica-festa.test.mjs` | `festa: times so existe com 4 jogadores` |
| CA-3 | `logica-festa.test.mjs` | `festa: a rotacao filtra pelo modo e pelo numero de jogadores` |
| CA-4 | `logica-festa.test.mjs` | `festa vs: o indice do vencedor da o ponto so a ele` |
| CA-5 | `logica-festa.test.mjs` | `festa times: o time A e J1+J3, o B e J2+J4, e os dois do time pontuam` |
| CA-6 | `logica-festa.test.mjs` | `festa times: 10 pontos do time encerram a partida com os dois campeoes` |
| CA-7 | `logica-festa.test.mjs` | `festa coop: 2 faz todos pontuarem, -1 ninguem, e 10 pontos fazem todos campeoes` |
| CA-8 | `logica-festa.test.mjs` | `festa coop: a partida dura 5 noites, conta as vencidas e acaba na quinta` |
| CA-9 | `logica-festa.test.mjs` | `festa: alvo de pontos (p.alvo) e 6 com menos de 6 elegiveis e 10 com 6 ou mais, e a partida acaba nele` |
| CA-10 | `logica-festa.test.mjs` | `festa: todos contra todos com 2 pessoas sorteia tambem minijogos do Classico, e coop do Classico nunca entra` |
| CA-11 | `logica-festa.test.mjs` | `festa: configura troca n e modo e recomeca a partida sem perder os contadores dos celulares` |
| CA-12 | `logica-festa.test.mjs` | `festa: se o unico minijogo do modo falha, a partida avisa (semJogo) em vez de repetir o erro sem fim` |
| CA-12 | `logica-festa.test.mjs` | `festa: modo cujo unico minijogo quebrou nao esta jogavel, e uma versao nova do minijogo volta a valer` |
| CA-13 | `logica-festa.test.mjs` | `festa: o empurrao sem direcao vai para quem esta em pe e mais perto, e nao para quem caiu` |
| CA-14 | `e2e/teste-festa.js` | `ok 3 conectados: o menu do Jogador 1 mostra o times 2x2 desabilitado` |
| CA-14 | `e2e/teste-festa.js` | `ok 4 celulares em 1 a 4; cores padrao diferentes; menu so no Jogador 1; times habilitado com 4` |
| CA-15 | `e2e/teste-festa.js` | `ok J1 escolheu times 2x2 e comecou: 4 cartoes com cor de time, 4 bonecos e aneis de time` |
| CA-15 | `e2e/teste-festa.js` | `ok partida de 3 em todos contra todos: placar com 3, tinta e sumo, so o vencedor pontua` |
| CA-15 | `e2e/teste-festa.js` | `ok zumbis-coop com 4: vitoria de todos, 1 ponto para cada` |
| CA-15 | `e2e/teste-festa.js` | `ok partida de 2 em cooperativo: zumbis, vitoria de todos` |
| CA-16 | `e2e/teste-festa.js` | `ok Classico com 2: partida, ponto, placar de sempre e nenhum minijogo de festa na rotacao` |
| CA-17 | sem teste automatizado | |
| CA-23 | `logica-festa.test.mjs` | `cinco jogadores: em Cada um por si quatro jogam e um descansa, em rodizio, e o ponto vai para o lugar de verdade` |
| CA-23 | `logica-festa.test.mjs` | `cinco jogadores: resultado fora dos 4 da vez tira o minijogo da rotacao, e no cooperativo todos os 5 pontuam` |
| CA-23 | `logica-festa.test.mjs` | `cinco jogadores: minijogo que aceita 5 (festa.max 5) roda com todos, e 6 jogadores ou Duplas com 5 viram erro claro` |
| CA-23 | `logica-festa.test.mjs` | `cinco jogadores: quem descansa fica parado fora da arena e minijogo so para 2 ou 3 nao entra` |
| CA-23 | `e2e/teste-cinco.js` | `ok tinta-festa com 5: ...`, `ok sumo-vidas com 5: ...` e `ok galinhas-festa com 5: ...` |
| CA-22 | `server.test.mjs` | `servidor: /modo repassa a dupla escolhida pelo anfitriao (par: lugar 2, 3 ou 4) e ignora valor torto` |
| CA-22 | `e2e/teste-duplas.js` | `ok dupla J1 + J2: ...`, `ok dupla J1 + J4` e `ok dupla J1 + J3 (a de sempre)` |
| CA-21 | `logica-festa.test.mjs` | `cartas na festa: quem perdeu em Cada um por si ganha oferta de carta na rodada seguinte, e o vencedor nao` |
| CA-21 | `logica-festa.test.mjs` | `cartas na festa: Vale dobro da 2 pontos (ao time inteiro em Duplas) e Escudo de quem perdeu segura o ponto` |
| CA-21 | `logica-festa.test.mjs` | `cartas na festa: escudo so para quem esta atras de algum rival; coop nunca tem carta` |
| CA-21 | `logica-festa.test.mjs` | `cartas na festa: no revezamento so quem jogou e perdeu ganha a carta, e so recebe a oferta quando voltar a jogar` |
| CA-21 | `e2e/teste-festa.js` | `ok cartas na Festa: ...` (só quando a rodada anterior tem vencedor) |
| CA-19 | `logica-festa.test.mjs` | `duplas: minijogo de 2 roda so com os dois da vez e a dupla de quem venceu leva o ponto` |
| CA-19 | `logica-festa.test.mjs` | `duplas: os parceiros revezam e todo mundo enfrenta todo mundo` |
| CA-19 | `logica-festa.test.mjs` | `duplas: minijogo de festa usa os 4 e minijogo coop de 2 nao entra` |
| CA-19 | `logica-festa.test.mjs` | `duplas: so quem esta na vez se move no minijogo de 2` |
| CA-19 | `logica-festa.test.mjs` | `festa: a rotacao filtra pelo modo e pelo numero de jogadores` |
| CA-20 | `e2e/teste-festa.js` | `ok sumo em Duplas: ...`, `ok bomba em Duplas: ...` e `ok kart em Duplas: ...` (o texto segue com os jogadores da vez e o placar) |
| CA-18 | `logica.test.mjs` | `cartas: moedas em dobro e valores das moedas da rodada` (cobre 5 moedas para empate no Duelo; não há teste equivalente para a Festa) |

Os nomes `ok ...` de `e2e/teste-festa.js` são linhas que o script imprime depois do `assert` correspondente, porque os testes de navegador são scripts e não têm nome de teste do `node --test`. Alguns textos ainda dizem "times 2x2", que é o nome antigo de Duplas.
