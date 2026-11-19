# ADR 0002: Minijogo como arquivo único com contrato

Status: aceita.

## Contexto

O jogo cresce por minijogos novos, escritos em momentos diferentes. Um minijogo que lança exceção, devolve um valor estranho ou nunca termina não pode derrubar a partida na frente da família. E o desenho em three.js não pode impedir que a regra seja testada sem navegador.

## Decisão

1. Um minijogo é um arquivo `jogos/<id>.mjs` com `export default { ... }`, mais o teste `jogos/<id>.test.mjs`. O contrato (campos obrigatórios, o que `atualiza` pode devolver, o que é `p`) está em `jogos/LEIA.md`.
2. Regra e desenho ficam separados dentro do arquivo: `inicia` e `atualiza` rodam também em Node, sem `window`, `document` ou three.js, e todo estado da rodada mora em `p.dados`. `monta` e `desenha` cuidam do 3D.
3. O motor aplica o contrato: `registra` recusa minijogo sem campos obrigatórios, `festa` malformado e `genero` fora da lista fechada, e `passo` tira da rotação o minijogo que lança exceção ou devolve valor inválido (`descarta`). A partida continua.
4. A tela confere a pasta `jogos/` a cada 8 s e põe o arquivo novo ou alterado na rotação sem reiniciar.
5. Todo minijogo tem um teste que chama `fumaca` (`jogos/_teste.mjs`): rodada parada e 15 rodadas com dedos aleatórios, com `monta` e `desenha` de verdade.

## Consequências

- Acrescentar um minijogo não exige mexer no motor, no servidor nem na tela. A rotação, os modos e a trava de 5 s valem para ele sem código novo.
- Um minijogo defeituoso sai da rotação com um aviso, e o erro fica em `p.erros`.
- Os testes de regra são rápidos: rodam em Node com `node --test`.
- `fumaca` só prova que o jogo não quebra, não termina vazio e não gera `NaN`. A legibilidade na TV, a câmera e a graça do jogo dependem de revisão e de prints (`jogos/ESTILO.md`), e não são verificadas por teste automatizado.
- O custo é um contrato extenso (`jogos/LEIA.md` tem perto de 240 linhas) e o risco de um minijogo escrito direto em `jogos/` entrar na rotação antes de ficar pronto, porque a tela o carrega sozinha. O manual sugere trabalhar em uma pasta à parte e copiar quando o teste passar.

Ver [`specs/001-contrato-do-minijogo`](../../specs/001-contrato-do-minijogo/spec.md) e [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
