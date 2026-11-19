# 002 Servidor carteiro e segurança da entrada

Arquivos de referência: `server.js`, `server.test.mjs`.

## Problema

Os celulares falam com o PC pela rede Wi-Fi da casa. Qualquer aparelho nessa rede consegue abrir uma conexão com o servidor e mandar o que quiser. O servidor precisa repassar as entradas dos controles para a tela sem virar um ponto fraco: não pode servir arquivos que não deveria, aceitar corpo de tamanho livre, crescer em memória com cliente lento nem carregar regra de jogo que um cliente pudesse corromper.

## Para quem

- Quem joga em casa e quer que o jogo abra com um clique, sem instalar nada.
- Quem mantém o código e precisa saber exatamente o que o servidor aceita e o que recusa.

## Requisitos

- RF-1. O servidor usa só módulos nativos do Node (`http`, `fs`, `path`, `os`, `crypto`). A única dependência do jogo é o three.js, servido pelo próprio servidor a partir de `node_modules`.
- RF-2. O servidor serve apenas uma lista fechada de arquivos:
  - rotas fixas do objeto `ARQUIVOS` (a tela, o controle, `logica.mjs`, o three.js e três arquivos do carregador glTF);
  - `/modelos/<pacote>/<arquivo>.glb` ou `.png`, validado por expressão regular, nunca a licença;
  - `/fontes/<nome>.woff2`, nunca a licença;
  - `/jogos/<nome>.mjs` com nome `[a-z0-9-]+`, de modo que testes e arquivos de apoio (`*.test.mjs`, `_teste.mjs`) não saem.
- RF-3. O servidor não guarda regra de jogo. Ele repassa mensagens e guarda apenas o último perfil de cada jogador, o último estado de controle mandado pela tela para cada jogador e a última escolha de modo do anfitrião.
- RF-4. O número do jogador (`j`) é um inteiro de 1 a 4. Em `/in` e `/perfil` um valor fora disso é ignorado, e em `/eventos-c` vira resposta 400.
- RF-5. A entrada do celular (por WebSocket ou por `POST /in`) é copiada campo a campo, com coerção de tipo: `x` e `y` viram número (ou 0), `d` e `b` viram booleano, os contadores só passam se forem inteiros, e a reação só passa se for inteiro de 0 a 63.
- RF-6. O corpo de cada rota de escrita tem limite: 500 bytes em `/in` e `/perfil`, 200 em `/modo`, 100 em `/comando` e `/pausa`, 8000 em `/tela`. Acima do limite a conexão é derrubada.
- RF-7. `/modo` e `/comando` só aceitam quem se declara Jogador 1, e só valores das listas fechadas (`MODOS` e `COMANDOS`).
- RF-8. O nome de perfil é cortado em 10 caracteres.
- RF-9. Um cliente de eventos que deixa mais de 64 KB parados na fila é derrubado. Cada tipo de conexão tem no máximo 6: uma tela nova além do limite recebe 503, e um celular novo no mesmo lugar derruba a conexão mais antiga.
- RF-10. O WebSocket é mínimo (RFC 6455) e serve só para receber a entrada dos celulares em `/ws`: aceita apenas quadros de texto mascarados de até 2000 bytes, destrói a conexão se o buffer passar de 8192 bytes e tem tempo limite de 30 s sem sinal.
- RF-11. A escolha de modo guardada é esquecida quando vira partida (`comeca: true`) e quando a tela volta ao menu (`/modo-limpa`). Uma tela que abre depois recebe a escolha marcada como antiga, para não recomeçar nada.
- RF-12. `/lugares` é só leitura e diz quais lugares (1 a 4) têm celular conectado.
- RF-13. Não há autenticação. O jogo assume rede de casa sem exposição à internet, e qualquer aparelho da rede pode se declarar Jogador 1. Esta é uma decisão aceita e está dita em `jogos/LEIA.md`.

## Critérios de aceite

- CA-1. `/eventos-c` aceita `j` de 1 a 4 e responde 400 para `0`, `5`, `x`, `2.5`, `-1`, vazio e ausente (RF-4).
- CA-2. `/in` repassa à tela os jogadores 1 a 4 e ignora `j` fora da faixa, em texto, nulo ou decimal (RF-4, RF-5).
- CA-3. `/perfil` guarda o perfil de cada lugar válido e entrega os guardados a uma tela que abre depois (RF-3, RF-4).
- CA-4. `/modo` só repassa a escolha do Jogador 1 com modo conhecido e ignora corpo que não é JSON (RF-7).
- CA-5. A escolha de modo é esquecida quando vira partida e quando a tela pede o menu de novo (RF-11).
- CA-6. Um corpo de `/modo` acima do limite é descartado (RF-6).
- CA-7. `/tela` entrega o estado ao celular de cada um dos 4 lugares (RF-3).
- CA-8. `/modelos` serve `.glb` e `.png` com o tipo certo (RF-2).
- CA-9. `/modelos` responde 404 para travessia de diretório, maiúsculas, a licença, extensão errada e arquivo inexistente, sem devolver conteúdo (RF-2).
- CA-10. Os módulos do carregador glTF saem como JavaScript (RF-2).
- CA-11. `/fontes` serve só o `.woff2` e responde 404 para a licença e para caminhos tortos (RF-2).
- CA-12. `/lugares` reflete as conexões, libera o lugar de quem saiu e não aceita escrita (RF-12).
- CA-13. `/comando` só repassa o Jogador 1 com comando da lista, e descarta corpo grande (RF-6, RF-7).
- CA-14. `/pausa` repassa quem pediu e se é para continuar, ignora `j` inválido e descarta corpo grande (RF-6).
- CA-15. No motor, uma entrada com `x` e `y` inválidos vira zero e um vetor maior que 1 é normalizado; entrada infinita não estraga a posição (defesa em profundidade para RF-5).
- CA-16. O servidor não importa nada além de módulos nativos, e o `package.json` lista o three.js como única dependência de execução (RF-1). Sem teste automatizado.
- CA-17. WebSocket: quadro sem máscara, quadro maior que 2000 bytes ou buffer acima de 8192 bytes destroem a conexão (RF-10). Sem teste automatizado.
- CA-18. Limites de conexões simultâneas e de fila de eventos (RF-9). Sem teste automatizado.
- CA-19. Limite de corpo de `/in` e `/perfil` e corte do nome em 10 caracteres (RF-6, RF-8). Sem teste automatizado.
- CA-20. A listagem de `/jogos` mostra só arquivos que casam com `[a-z0-9-]+.mjs` (RF-2). Sem teste automatizado.

## Fora do escopo

- Autenticação, senha ou criptografia (a rede é a de casa e o tráfego é HTTP e WebSocket sem TLS).
- Expor o jogo na internet.
- Guardar partidas, placares ou contas no servidor. O que é "salvo" fica no `localStorage` do navegador de cada aparelho.

## Rastreabilidade

| Critério | Arquivo de teste | Teste (nome exato) |
|---|---|---|
| CA-1 | `server.test.mjs` | `servidor: /eventos-c aceita j de 1 a 4 e recusa o resto` |
| CA-2 | `server.test.mjs` | `servidor: /in repassa os slots 1 a 4 e ignora j invalido` |
| CA-3 | `server.test.mjs` | `servidor: /perfil guarda o perfil de cada slot e ignora j invalido` |
| CA-4 | `server.test.mjs` | `servidor: /modo so aceita o anfitriao (j 1) e modos conhecidos, e repassa para a tela` |
| CA-5 | `server.test.mjs` | `servidor: a escolha de modo e esquecida quando vira partida (comeca) ou quando a tela limpa` |
| CA-6 | `server.test.mjs` | `servidor: corpo de /modo acima do limite e descartado` |
| CA-7 | `server.test.mjs` | `servidor: /tela entrega o estado ao celular de cada um dos 4 slots` |
| CA-8 | `server.test.mjs` | `servidor: /modelos serve o glb e a textura com o tipo certo` |
| CA-9 | `server.test.mjs` | `servidor: /modelos recusa caminho fora da regex (traversal, maiusculas, licenca, extensao, arquivo que nao existe)` |
| CA-10 | `server.test.mjs` | `servidor: os modulos do GLTFLoader sao servidos como javascript` |
| CA-11 | `server.test.mjs` | `servidor: /fontes serve so a fonte woff2 da pasta, nunca a licenca nem caminho torto` |
| CA-12 | `server.test.mjs` | `servidor: /lugares diz quais lugares tem celular conectado, so leitura` |
| CA-13 | `server.test.mjs` | `servidor: /comando so aceita o j 1, a lista fechada e corpo pequeno` |
| CA-14 | `server.test.mjs` | `servidor: /pausa sem corpo alterna como antes; com corpo diz quem pediu e se e para continuar` |
| CA-15 | `logica.test.mjs` | `entrada invalida vira zero e vetor grande e limitado` |
| CA-15 | `logica.test.mjs` | `entrada infinita nao estraga a posicao` |
| CA-16 | sem teste automatizado | |
| CA-17 | sem teste automatizado | |
| CA-18 | sem teste automatizado | |
| CA-19 | sem teste automatizado | |
| CA-20 | sem teste automatizado | |

Os testes de navegador (`e2e/`) usam o caminho do WebSocket de verdade, porque o controle conecta por `/ws` ao abrir. Isso exercita a conexão feliz, mas não verifica as recusas de CA-17.
