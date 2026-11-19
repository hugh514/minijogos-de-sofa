# 003 Controle no celular

Arquivos de referência: `controle.html`, `controle.test.mjs`, `tela.test.mjs`, `e2e/teste-controles.js`.

## Problema

Quem joga olha para a TV, não para o celular. O controle precisa funcionar sem olhar: o joystick tem de nascer onde o dedo encosta, os botões têm de ser grandes e o dedo não pode apertar o botão errado só por deslizar. Além disso, a página roda em celulares muito diferentes e recebe texto vindo dos minijogos, que não pode aparecer cru na tela.

## Para quem

- Cada jogador, no próprio celular, em pé ou deitado, com a TV na frente.
- Crianças, que apertam rápido e esfregam o dedo na tela.

## Requisitos

- RF-1. O celular abre `/c`, o jogador escolhe o lugar (1 a 4) e a escolha fica guardada no `localStorage`. Trocar de lugar exige segurar o botão por 1 s.
- RF-2. O joystick é flutuante: nasce onde o dedo encosta, fora dos botões, e se o dedo passa da borda o centro vai junto.
- RF-3. O joystick tem zona morta de 10%. Depois dela a força mistura resposta linear e quadrática, de modo que o movimento pequeno é fino e empurrar até o fim dá 1. A diagonal no máximo também dá 1.
- RF-4. A metade inteira da área dos botões vale como botão. O botão é o mais próximo do toque. Sem B, a área toda vale A. Sem nenhum botão visível, nada conta.
- RF-5. Deslizar o dedo de A para B solta A e aperta B, e o contrário. Há histerese: o dedo só troca de botão depois de passar 18% da distância entre os centros além da divisa, então esfregar o dedo na divisa não alterna.
- RF-6. O toque curto conta pelo contador (`n` para A, `nb` para B), mesmo que chegue já solto.
- RF-7. O envio usa WebSocket e, se ele não conectar, cai para `POST /in` com um envio por vez. A conexão é refeita a cada 1 s e há um sinal de vida quando passam 400 ms sem mensagem.
- RF-8. Pausa e perfil não abrem com toque curto durante a rodada. Só abrem segurando por 0,5 s, para um toque sem querer não parar a partida.
- RF-9. O controle de cada minijogo vem do campo `controle` (`padrao`, `botao`, `toque`, `opcoes` ou `espera`), e o celular de cada jogador pode mostrar texto e opções próprias, inclusive secretas.
- RF-10. Em pancada forte o celular vibra. Onde não há vibração pelo navegador (como no iPhone), a borda da tela pisca. A vibração é tempero, nunca a única pista.
- RF-11. O texto de minijogo que chega ao celular passa por `textoSeguro`, e `milhar` formata o saldo de moedas. O celular esconde o nome de um minijogo que é só o id do arquivo (`pareceId`).
- RF-12. Se o servidor avisa que o `controle.html` mudou, a página aberta se recarrega sozinha.

## Critérios de aceite

- CA-1. Abaixo da zona morta a força é 0, e no fim do curso é 1 (RF-3).
- CA-2. A 20% de deflexão a força é menor que a linear, e a curva nunca desce (RF-3).
- CA-3. A diagonal no máximo também chega a 1 (RF-3).
- CA-4. `botaoNaPos` divide pela posição, usa a área toda para o único botão que existe e funciona com os botões lado a lado e empilhados (RF-4).
- CA-5. Sem nenhum botão visível, `botaoNaPos` não devolve botão (RF-4).
- CA-6. Com histerese, o dedo só troca de botão 18% da distância dos centros além da divisa, e um dedo esfregando na divisa nunca alterna (RF-5).
- CA-7. Em um celular de verdade simulado (toque por CDP no Chromium), a metade da tela vale como botão, tocar na borda e entre A e B conta, deslizar de A para B solta A e aperta B, e a curva do joystick medida na página dá menos que a linear a 20%, dá 1 no fim do curso e dá 1 na diagonal (RF-3, RF-4, RF-5, RF-6).
- CA-8. Joystick, A e B funcionam ao mesmo tempo, e soltar um dedo não solta os outros (RF-4).
- CA-9. Toque curto na pausa e no perfil não abre durante a rodada, e segurar por 0,5 s abre (RF-8).
- CA-10. Em minijogo sem joystick, deslizar de A para B não aperta B, e tocar de novo conta (RF-4, RF-5).
- CA-11. `textoSeguro` do celular devolve vazio para valor que não é texto ou número finito, remove restos crus e corta em 120 caracteres (RF-11).
- CA-12. `milhar` escreve o saldo com separador de milhar brasileiro e devolve 0 para o que não é inteiro; `pareceId` reconhece id de arquivo e deixa passar nome de verdade (RF-11).
- CA-13. A conexão por WebSocket, o recuo para `POST /in` e a reconexão (RF-7). Sem teste automatizado dedicado; o caminho feliz é exercitado por todos os testes de navegador.
- CA-14. Vibração e piscada de borda no iPhone (RF-10). Sem teste automatizado.
- CA-15. Recarga automática quando o `controle.html` muda (RF-12). Sem teste automatizado.
- CA-16. Guardar o lugar no `localStorage` e trocar segurando 1 s (RF-1). Sem teste automatizado.

## Fora do escopo

- Aplicativo nativo. O controle é uma página do navegador.
- Teste em aparelhos físicos. Os testes de navegador simulam toque com o Chromium; o comportamento em cada marca de celular não é verificado.
- Reconhecimento de gestos além de joystick, dois botões, toque livre e opções.

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `controle.test.mjs` | `joystick: zona morta fica em zero e o fim da corrida da 1` |
| CA-2 | `controle.test.mjs` | `joystick: a 20% de deflexao a forca e menor que a linear, e a curva nunca desce` |
| CA-3 | `controle.test.mjs` | `joystick: a diagonal no maximo tambem chega a 1 (mesmo calculo do mover)` |
| CA-4 | `controle.test.mjs` | `botaoNaPos: divide pela posicao e, sem B, a area toda vale A` |
| CA-5 | `controle.test.mjs` | `botaoNaPos: nenhum botao visivel nao devolve botao (nada conta)` |
| CA-6 | `controle.test.mjs` | `botaoNaPos: histerese, o dedo so troca de botao 18% da distancia dos centros alem da divisa` |
| CA-7 | `e2e/teste-controles.js` | linhas de saída `ok ...: toque na borda e entre A e B contam`, `ok ...: deslizar A para B solta A e aperta B (e o contrario), contadores n+2 e nb+1` e `ok ...: 20% da ...` (o nome do viewport entra no lugar das reticências) |
| CA-8 | `e2e/teste-controles.js` | `ok ...: joystick + A + B ao mesmo tempo, e soltar um nao solta os outros` |
| CA-9 | `e2e/teste-controles.js` | `ok pausa e perfil: toque curto na rodada nao pega, segurar 0,5 s pega` |
| CA-10 | `e2e/teste-controles.js` | `ok semjoy (corrida-dedos): deslizar de A para B nao troca nem aperta B; tocar de novo conta` |
| CA-11 | `tela.test.mjs` | `textoSeguro (celular): so texto e numero finito passam, o resto vira vazio` |
| CA-11 | `tela.test.mjs` | `textoSeguro (celular): tira restos crus de dentro do texto e corta no tamanho` |
| CA-12 | `tela.test.mjs` | `milhar: saldo com separador de milhar do Brasil, e so inteiro` |
| CA-12 | `tela.test.mjs` | `pareceId: o celular esconde nome de minijogo que e so o id do arquivo` |
| CA-13 | sem teste automatizado dedicado | |
| CA-14 | sem teste automatizado | |
| CA-15 | sem teste automatizado | |
| CA-16 | sem teste automatizado | |

Os testes de navegador são scripts, não têm um nome de teste como o `node --test`. Por isso a coluna cita a linha que o script imprime quando a verificação passa, e cada uma dessas linhas vem logo depois de um `assert` no mesmo arquivo. Eles rodam com `npm run e2e` e não fazem parte do `npm test` nem do CI.
