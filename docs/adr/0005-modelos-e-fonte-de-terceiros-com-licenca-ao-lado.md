# ADR 0005: Modelos e fonte de terceiros com a licença ao lado

Status: aceita.

## Contexto

O jogo usa modelos 3D prontos (zumbi animado, lápides, árvores, móveis da sala de espera) e uma fonte para os textos. A casa onde se joga pode estar sem internet, então nada pode ser baixado na hora. E o repositório é público: cada arquivo de terceiros precisa ter a origem e a licença à vista.

## Decisão

1. Só entram modelos com licença CC0. Hoje há três pacotes da Kenney, em `modelos/furniture-kit`, `modelos/graveyard-kit` e `modelos/survival-kit`, cada um com o `License.txt` original ao lado dos arquivos `.glb` e da textura. A fonte Baloo 2 está em `fontes/baloo2.woff2`, com a licença SIL OFL em `fontes/OFL.txt`.
2. Tudo é local. O servidor entrega os arquivos de `modelos/` e `fontes/`, e o three.js vem de `node_modules`.
3. O servidor serve só o que a lista fechada permite: `/modelos/<pacote>/<arquivo>.glb` ou `.png`, e `/fontes/<nome>.woff2`. A licença fica ao lado e não é servida. Os testes de `server.test.mjs` verificam que pedir a licença ou um caminho torto devolve 404.
4. O minijogo que usa modelos os lista em `modelos: [...]`, e o teste confere que cada nome existe e que o `License.txt` do pacote contém o texto "Creative Commons Zero, CC0" (feito em `jogos/zumbis-coop.test.mjs`).
5. Todo uso de modelo tem um desenho de reserva: `c.modelo(...)` devolve `null` se o arquivo não carregou, e o minijogo desenha uma forma simples. Os testes de `fumaca` rodam as sementes ímpares sem modelos e as pares com modelos de mentira.
6. O pacote do Windows leva as licenças junto: `scripts/empacotar.ps1` copia `modelos/` e `fontes/` inteiros, com as licenças, e inclui a licença do three.js e a do Node.

## Consequências

- Quem baixa o repositório ou o zip vê de onde vem cada arquivo de terceiros e sob qual licença.
- O jogo funciona sem internet.
- Acrescentar um modelo novo exige conferir a licença do pacote, copiar só os arquivos usados e a textura e manter nomes em minúsculas, números, `-` e `_`, para casar com a expressão regular do servidor.
- A verificação de licença CC0 por teste existe hoje só no `zumbis-coop`. Não é uma regra geral aplicada a todo arquivo de `modelos/`, e um pacote novo sem teste correspondente depende da revisão.
- O pacote `survival-kit` está na pasta, mas nenhum arquivo de código o referencia hoje (só o manual `jogos/LEIA.md` o cita).

Ver [`README.md`](../../README.md), seção "Créditos e licenças".
