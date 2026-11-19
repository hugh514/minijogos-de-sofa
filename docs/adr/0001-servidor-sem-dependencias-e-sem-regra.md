# ADR 0001: Servidor sem dependências e sem regra de jogo

Status: aceita.

## Contexto

O jogo roda na sala de casa. O PC liga um servidor, a TV mostra a tela e os celulares viram controles pelo Wi-Fi. Quem joga não é programador: o caminho ideal é baixar um zip, dar dois cliques em `JOGAR.bat` e jogar. O servidor precisa fazer pouco (entregar arquivos e passar mensagens), e qualquer aparelho da rede pode falar com ele.

## Decisão

1. O servidor (`server.js`) usa só módulos nativos do Node: `http`, `fs`, `path`, `os` e `crypto`. A única dependência de execução do projeto é o three.js, que o servidor entrega a partir de `node_modules`. O Playwright é dependência de desenvolvimento.
2. O servidor não guarda regra de jogo. Ele valida, limita e repassa mensagens. A regra mora em `logica.mjs` e nos minijogos, e é executada na tela.
3. O WebSocket para receber as entradas dos celulares é implementado à mão, em um subconjunto mínimo do RFC 6455: só quadros de texto mascarados, curtos.

## Consequências

- Não há dependência de execução além do three.js, e o pacote do Windows leva o Node e o three.js dentro do zip (`scripts/empacotar.ps1`).
- A superfície de ataque é pequena e está toda em um arquivo de cerca de 260 linhas. As regras de segurança (lista fechada de arquivos, limites de corpo, validação do jogador) cabem em uma leitura e têm testes em `server.test.mjs`.
- O motor pode ser testado em Node sem subir servidor, porque o servidor não participa da regra.
- O servidor confia na tela para a regra do jogo. Isso é aceitável porque a tela é o PC da casa.
- O WebSocket escrito à mão é código para manter. Os limites (quadro mascarado, 2000 bytes, buffer de 8192 bytes) não têm teste automatizado dedicado, só o uso real nos testes de navegador.
- Não há autenticação nem TLS. O projeto assume rede de casa e não deve ser exposto à internet.
- O projeto exige Node 22 ou mais novo (`engines` no `package.json`).

Ver [`docs/ARQUITETURA.md`](../ARQUITETURA.md) e [`specs/002-servidor-carteiro`](../../specs/002-servidor-carteiro/spec.md).
