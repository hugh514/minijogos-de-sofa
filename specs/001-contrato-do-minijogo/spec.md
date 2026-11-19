# 001 Contrato do minijogo

Arquivos de referência: `logica.mjs` (`registra`, `passo`, `descarta`), `jogos/LEIA.md`, `jogos/_teste.mjs`.

## Problema

O jogo cresce por arquivos novos em `jogos/`. Se cada minijogo falasse com o motor do seu jeito, um erro em um deles travaria a partida inteira na frente da família. É preciso um formato único, pequeno e verificável, e uma regra clara para o que acontece quando um minijogo falha.

## Para quem

- Quem escreve um minijogo novo.
- O motor (`logica.mjs`), que sorteia, roda e pontua os minijogos.
- A tela (`tela.html`), que carrega os arquivos da pasta e desenha cada rodada.

## Requisitos

- RF-1. Um minijogo é um arquivo `jogos/<id>.mjs` com `export default { ... }` e os campos obrigatórios `id`, `nome`, `dica`, `inicia` e `atualiza`. `registra` lança erro se faltar algum.
- RF-2. `inicia` e `atualiza` rodam também no Node, sem navegador. Tudo que é visual fica em `monta` e `desenha`.
- RF-3. `atualiza` devolve `undefined` (a rodada segue), `-1` (empate), o índice do vencedor (Duelo e Cada um por si), `0` ou `1` (o time, em Duplas) ou `2` (todos venceram, em Todos juntos). Qualquer outro valor é retorno inválido.
- RF-4. Exceção ou retorno inválido tira o minijogo da rotação e a partida continua. A mensagem fica em `p.erros`. Se era o único minijogo do modo, `p.semJogo` fica ligado e o modo deixa de poder começar.
- RF-5. Toda rodada termina sozinha. Se `atualiza` nunca decide, o motor encerra em empate aos 75 s.
- RF-6. O minijogo usa `p.rng()` no lugar de `Math.random()`, para os testes se repetirem iguais.
- RF-7. `registra` troca a versão de um minijogo que já existe com o mesmo `id`, recusa um campo `festa` malformado e recusa um `genero` fora da lista fechada `GENEROS`.
- RF-8. O toque do celular chega ao minijogo por `j.apertouA`, `j.apertouB` e `j.escolha`, e cada valor vale por um passo só.
- RF-9. Todo minijogo da pasta tem um teste que chama `fumaca`: uma rodada com os jogadores parados e 15 rodadas com dedos aleatórios, chamando `monta` e `desenha` de verdade (three.js sem WebGL). Falha em caso de erro, valor `NaN` ou rodada que não termina.
- RF-10. Todo texto que o minijogo põe na tela ou no celular passa por `textoSeguro`: só texto e número finito chegam, e restos como `undefined`, `NaN`, `null` e `[object Object]` são removidos.

## Critérios de aceite

- CA-1. `registra` lança erro para um minijogo sem os campos obrigatórios (RF-1).
- CA-2. Registrar de novo um `id` existente troca a versão, sem duplicar na lista (RF-7).
- CA-3. Um `atualiza` que lança exceção tira o minijogo da rotação, guarda a mensagem em `p.erros`, encerra a rodada como empate e a partida segue para a rodada seguinte (RF-4).
- CA-4. Um `atualiza` que devolve valor fora da tabela do modo tira o minijogo da rotação: índice fora de 0 a n-1 em Cada um por si, `2` em minijogo que não é cooperativo, `0` ou `1` em minijogo cooperativo (RF-3, RF-4).
- CA-5. Um minijogo que nunca decide é encerrado pelo motor com empate (RF-5).
- CA-6. Todos os minijogos embutidos em `logica.mjs` terminam sozinhos com os dois jogadores parados (RF-5).
- CA-7. Uma arena inválida devolvida pelo minijogo não trava o passo do motor (RF-4).
- CA-8. A escolha feita no celular chega ao minijogo em um passo e some no seguinte (RF-8).
- CA-9. Sem o campo `genero`, vale o `controle.modo`. Um `genero` fora da lista fechada é recusado por `registra`, e todo minijogo da pasta e todo embutido tem um gênero da lista (RF-7).
- CA-10. `registra` recusa um `festa` malformado (RF-7).
- CA-11. Cada arquivo `jogos/<id>.test.mjs` chama `fumaca`, e a rodada completa com `monta` e `desenha` passa sem erro (RF-2, RF-9).
- CA-12. `textoSeguro` devolve vazio para tudo que não é texto ou número finito e remove restos crus de dentro do texto (RF-10).
- CA-13. Os textos de cartas e modificadores são curtos, sem caixa alta gritada e sem travessão (RF-10, regra de texto de `jogos/ESTILO.md`).

## Fora do escopo

- A aparência do minijogo (legibilidade na TV, câmera, tema). Isso está em `jogos/ESTILO.md` e é conferido por prints, não por teste automatizado.
- O equilíbrio de cada jogo (quanto a sorte pesa, se a rodada tem virada).
- Carregar minijogos de fora da pasta `jogos/` ou de outra máquina.

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `logica.test.mjs` | `registra troca a versao de um minijogo com o mesmo id` (o `assert.throws` no fim do teste cobre o minijogo sem campos) |
| CA-2 | `logica.test.mjs` | `registra troca a versao de um minijogo com o mesmo id` |
| CA-3 | `logica.test.mjs` | `minijogo que da erro sai da rotacao e a partida continua` |
| CA-4 | `logica.test.mjs` | `retorno invalido do atualiza tira o minijogo em vez de travar` |
| CA-4 | `logica-festa.test.mjs` | `festa vs: retorno fora de 0 a n-1 tira o minijogo da rotacao` |
| CA-4 | `logica.test.mjs` | `coop: retorno 2 em minijogo que nao e coop continua invalido; coop nao pode devolver 0 ou 1` |
| CA-5 | `logica.test.mjs` | `minijogo que nunca decide e encerrado pelo motor com empate` |
| CA-6 | `logica.test.mjs` | `todo minijogo termina sozinho com os dois parados` |
| CA-7 | `logica.test.mjs` | `arena quebrada pelo minijogo nao trava o passo` |
| CA-8 | `logica.test.mjs` | `escolha feita no celular chega ao minijogo por um passo so` |
| CA-9 | `logica.test.mjs` | `rotacao: sem o campo genero vale o controle.modo; genero fora da lista fechada o registra recusa` |
| CA-9 | `logica.test.mjs` | `rotacao: todo minijogo embutido e os da pasta jogos/ (menos os _*) tem genero da lista fechada` |
| CA-10 | `logica-festa.test.mjs` | `festa: registra recusa o contrato festa torto` |
| CA-11 | `jogos/bola-neve.test.mjs` | `bola-neve: roda inteiro, parado e com dedos aleatorios, sem erro` (exemplo; os 70 arquivos `jogos/*.test.mjs` de minijogos chamam `fumaca`, conferido com `grep`) |
| CA-11 | `jogos/zumbis-coop.test.mjs` | `zumbis-coop: com 2, 3 e 4 jogadores roda inteiro, parado e com dedos aleatorios, desenhando, sem erro` (exemplo com `n` e modo da Festa) |
| CA-12 | `tela.test.mjs` | `textoSeguro (tela): so texto e numero finito passam, o resto vira vazio` |
| CA-12 | `tela.test.mjs` | `textoSeguro (tela): tira restos crus de dentro do texto e corta no tamanho` |
| CA-12 | `tela.test.mjs` | `textoSeguro (celular): so texto e numero finito passam, o resto vira vazio` |
| CA-13 | `logica.test.mjs` | `textos das cartas e dos modificadores: curtos, sem caixa alta gritada e sem travessao` |

Observação: os 10 minijogos embutidos em `logica.mjs` não têm arquivo de teste próprio com `fumaca`. Eles são exercitados com `monta` e `desenha` pelo teste `<id>: com a trava da tela, nenhuma rodada acaba antes de 5 s` de `jogos/minimo-5s.test.mjs`, que usa a mesma função `rodada` do apoio de teste.
