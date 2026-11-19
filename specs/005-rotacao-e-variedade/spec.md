# 005 Rotação e variedade

Arquivos de referência: `logica.mjs` (`proximaRodada`, `ordena`, `criaPartida`, `reinicia`, `configura`, `registra`, `GENEROS`, `MODIFICADORES`), `jogos/LEIA.md` (seção "Rotação e variedade"), `tela.html` (histórico no `localStorage`).

## Problema

Com dezenas de minijogos e partidas de 10 pontos, um sorteio simples repete o mesmo jogo cedo demais, junta três jogos do mesmo tipo em seguida e começa toda noite do mesmo ponto. Isso cansa quem joga. Ao mesmo tempo, minijogos novos chegam com a tela aberta e precisam aparecer sem reiniciar nada.

## Para quem

- Quem joga várias partidas na mesma noite ou em noites seguidas.
- Quem escreve um minijogo e só quer declarar um `genero`, sem mexer no sorteio.

## Requisitos

- RF-1. O sorteio usa um baralho (`p.fila`): nenhum minijogo se repete antes de todos os elegíveis saírem.
- RF-2. Ao montar um baralho novo, o que saiu nas últimas rodadas vai para o fim, de modo que o mesmo `id` só volta depois de uma distância mínima de rodadas. A distância mínima vale mais que o gênero.
- RF-3. O gênero é um campo opcional de lista fechada (`GENEROS`: `empurra`, `corrida`, `mira`, `reflexo`, `ritmo`, `memoria`, `blefe`, `gol`, `equilibrio`). Sem o campo, vale o `controle.modo`. Nunca o mesmo gênero 2 vezes seguidas e nunca 3 seguidas com o mesmo `controle.modo`, sempre que o baralho permite.
- RF-4. A memória atravessa partidas: `reinicia` não zera a fila, e o que saiu nas últimas rodadas da noite anterior vai para o fim dela. `configura` (troca de modo ou de número de jogadores) zera a fila.
- RF-5. A tela guarda os ids dos últimos 30 minijogos no `localStorage` (chave `historico-minijogos`) e os passa ao criar a partida. O motor trata esse valor como entrada hostil: só entram ids curtos (`[a-z0-9-]`, até 40 caracteres), e o histórico nunca passa de 30.
- RF-6. Só a rodada que de fato começou entra no histórico. Ao voltar ao menu ou trocar de modo antes de começar, o id sorteado sai.
- RF-7. Um minijogo novo que chega com a tela aberta entra em `p.prioridade` e sai na próxima rodada, uma vez só, antes da fila e do gênero.
- RF-8. Minijogo cooperativo só sai quando cabe: se só um jogador está a 1 ponto de vencer, o sorteio não escolhe cooperativo, para a partida não ser decidida para um só em rodada de equipe.
- RF-9. Com menos de 8 minijogos elegíveis, um que volta na mesma partida volta com um modificador diferente do da vez anterior. Com menos de 6, o alvo da partida é 6 pontos em vez de 10 (`p.alvo`).
- RF-10. No cooperativo, as 5 noites cobrem os minijogos cooperativos distintos antes de repetir um, e a repetida vem com modificador. A rodada de ouro não sai no cooperativo.
- RF-11. Modificadores (`ouro`, `gelo`, `foguete`, `espelho`, `lua`) ficam desligados por padrão, só aparecem depois das primeiras rodadas quando a tela os liga e respeitam o minijogo: os que mexem no movimento não vão para minijogo sem movimento, e `semMod` lista os que um minijogo recusa.
- RF-12. Montar o baralho com 120 minijogos é rápido, no pior caso (todos do mesmo gênero e modo).

## Critérios de aceite

- CA-1. Todos os minijogos saem antes de qualquer um repetir (RF-1).
- CA-2. Em 500 rodadas do Duelo, com várias sementes, o mesmo `id` não volta em seguida nem dentro da janela `min(elegíveis, 10)` (RF-2).
- CA-3. Com poucos minijogos, o baralho continua sem repetir antes de todos saírem, e com 5 elegíveis o mesmo `id` nunca volta antes de 4 rodadas (RF-1, RF-2).
- CA-4. Em composições pequenas sorteadas (2 a 10 minijogos, gêneros e modos aleatórios), a distância mínima sempre vale (RF-2).
- CA-5. O baralho novo põe os recentes no fim, do mais antigo para o mais novo (RF-2).
- CA-6. Em 500 rodadas e várias sementes, nunca o mesmo gênero 2 vezes seguidas nem 3 seguidas com o mesmo modo de controle (RF-3).
- CA-7. Sem o campo `genero` vale o `controle.modo`, e um gênero fora da lista é recusado por `registra` (RF-3).
- CA-8. `reinicia` mantém a fila e a noite nova não repete o fim da anterior, e `configura` zera a fila (RF-4).
- CA-9. O histórico chega em `p.historico`, fica em 30 e a partida seguinte não repete o fim dele (RF-4, RF-5).
- CA-10. O histórico vindo do `localStorage` é tratado como hostil: só ids curtos viram histórico (RF-5).
- CA-11. Só jogo já jogado entra no histórico: a rodada sorteada e não começada sai ao reiniciar ou reconfigurar (RF-6).
- CA-12. Um minijogo novo registrado sai na próxima rodada, uma vez só, mesmo com o mesmo gênero e modo do último; e um `p.prioridade` que não cabe volta em vez de sumir (RF-7).
- CA-13. Cooperativo só sai quando cabe: com um só jogador a 1 ponto não sai, com os dois a 1 ponto volta a sair, e o recurso de reserva (fallback) não repete o último minijogo (RF-8).
- CA-14. Com menos de 6 elegíveis o alvo é 6, com 6 ou mais é 10, e o alvo acompanha a lista que cresce enquanto a pasta carrega, mas só enquanto todos têm 0 pontos (RF-9).
- CA-15. Com 4 elegíveis, todo minijogo repetido volta com modificador diferente, e o minijogo sem movimento não recebe gelo (RF-9).
- CA-16. As 5 noites do cooperativo cobrem os minijogos cooperativos distintos, a quinta volta com modificador e o ouro não entra (RF-10).
- CA-17. Em várias partidas seguidas na mesma tela, as 4 primeiras noites do cooperativo cobrem 4 minijogos distintos (RF-10).
- CA-18. Modificadores ficam desligados por padrão, ligados aparecem depois da 2ª rodada e respeitam o minijogo; ouro vale 2 pontos, espelho inverte, gelo escorrega (RF-11).
- CA-19. `semMod` recusa os modificadores que não fazem sentido no minijogo, também na repetição, e o `zumbis-coop` declara `semMod` para `espelho` e `foguete` (RF-11).
- CA-20. Montar o baralho com 120 minijogos é rápido (RF-12).
- CA-21. O histórico é gravado e lido do `localStorage` pela tela (RF-5). Sem teste automatizado: os testes cobrem o motor recebendo o histórico, não a leitura e a escrita no navegador.

## Fora do escopo

- Preferência por jogos favoritos, votação ou lista de jogos banidos.
- Rotação em rede ou entre PCs. O histórico é do navegador da tela.
- Garantir variedade quando há poucos minijogos elegíveis. Nesse caso o motor repete e usa modificador, e o alvo cai para 6 pontos.

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `logica.test.mjs` | `todos os minijogos aparecem antes de repetir` |
| CA-2 | `logica.test.mjs` | `rotacao: 500 rodadas no Duelo nunca repetem o id em seguida nem dentro de min(elegiveis, 10)` |
| CA-3 | `logica.test.mjs` | `rotacao: ainda sem repetir antes de todos sairem (baralho) mesmo com poucos minijogos` |
| CA-3 | `logica.test.mjs` | `rotacao: com 5 elegiveis o mesmo id nunca volta antes de 4 rodadas (a distancia vale mais que o genero)` |
| CA-4 | `logica.test.mjs` | `rotacao: fuzz de composicoes pequenas (2 a 10 minijogos, generos e modos sorteados): distancia minima sempre vale` |
| CA-5 | `logica.test.mjs` | `rotacao: o baralho novo poe os recentes no fim, do mais antigo para o mais novo` |
| CA-6 | `logica.test.mjs` | `rotacao: nunca o mesmo genero 2 vezes seguidas nem 3 seguidas com o mesmo controle.modo (500 rodadas, varias sementes)` |
| CA-7 | `logica.test.mjs` | `rotacao: sem o campo genero vale o controle.modo; genero fora da lista fechada o registra recusa` |
| CA-8 | `logica.test.mjs` | `rotacao: reiniciar nao zera a fila e a noite nova nao repete o fim da anterior (primeiras floor(n/2) rodadas)` |
| CA-8 | `logica.test.mjs` | `rotacao: reiniciar mantem a fila que sobrava; configura (outro modo) zera` |
| CA-8 | `logica-festa.test.mjs` | `festa: configura zera a fila (outro modo), reinicia nao` |
| CA-9 | `logica.test.mjs` | `rotacao: o historico (ids) chega em p.historico, fica em 30 e a partida seguinte nao repete o fim dele` |
| CA-10 | `logica.test.mjs` | `rotacao: o historico que vem do localStorage e hostil: so ids curtos viram historico` |
| CA-11 | `logica.test.mjs` | `rotacao: so jogo ja jogado entra no historico: a rodada sorteada e nao comecada sai ao reiniciar ou reconfigurar` |
| CA-12 | `logica.test.mjs` | `rotacao: minijogo novo (registra e p.prioridade), ate com o mesmo genero e modo do ultimo, sai na proxima rodada e so uma vez` |
| CA-12 | `logica.test.mjs` | `rotacao: p.prioridade que nao cabe (coop bloqueado) ou rodada desfeita por esquece volta, nao some` |
| CA-13 | `logica.test.mjs` | `rotacao: minijogo cooperativo do Classico continua so saindo quando cabe (coopCabe)` |
| CA-13 | `logica.test.mjs` | `rotacao: so ha coop no baralho e so um esta a 1 ponto: sai outro minijogo, nunca o coop` |
| CA-13 | `logica.test.mjs` | `rotacao: o fallback do coop bloqueado nao repete o ultimo minijogo` |
| CA-14 | `logica.test.mjs` | `rotacao: alvo de pontos e 6 com menos de 6 elegiveis e 10 a partir de 6` |
| CA-14 | `logica.test.mjs` | `rotacao: p.alvo acompanha a lista que cresce (pasta carregando) enquanto ninguem pontuou mais de 1, e nao muda depois` |
| CA-14 | `logica.test.mjs` | `rotacao: p.alvo so e recalculado enquanto todos tem 0 pontos` |
| CA-15 | `logica-festa.test.mjs` | `festa vs com 4 elegiveis: todo minijogo repetido na mesma partida volta com modificador diferente do da vez anterior` |
| CA-15 | `logica-festa.test.mjs` | `festa: o modificador de repeticao respeita o minijogo (sem movimento nao recebe gelo) e reinicia zera a memoria` |
| CA-16 | `logica-festa.test.mjs` | `festa coop: as 5 noites cobrem os 4 minijogos coop distintos e a quinta volta com modificador` |
| CA-17 | `logica.test.mjs` | `coop: 3 partidas seguidas na mesma tela, em varias sementes, cobrem os 4 coop nas 4 primeiras noites de cada uma` |
| CA-18 | `logica.test.mjs` | `modificadores: desligados por padrao; ligados aparecem depois da 2a rodada e respeitam o minijogo` |
| CA-18 | `logica.test.mjs` | `modificadores: ouro vale 2 pontos, espelho inverte, gelo escorrega` |
| CA-18 | `logica-festa.test.mjs` | `festa: rodada especial (modificador) sai na Festa com p.modificadores ligado e nunca desligado` |
| CA-19 | `logica.test.mjs` | `modificador: semMod do minijogo recusa os modificadores que nao fazem sentido nele, tambem na repeticao` |
| CA-19 | `logica.test.mjs` | `modificador: zumbis-coop declara semMod para espelho e foguete` |
| CA-20 | `logica.test.mjs` | `rotacao: montar o baralho com 120 minijogos (todos padrao, pior caso) e rapido` |
| CA-21 | sem teste automatizado | |

Os testes de CA-16 e CA-17 usam quatro minijogos cooperativos de teste (arquivos reais são 10 hoje); o que se verifica é a regra do baralho, não os minijogos específicos.
