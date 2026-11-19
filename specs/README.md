# Especificações

Esta pasta guarda as especificações das funcionalidades centrais da Almofadada. Cada uma é uma pasta `NNN-nome/` com um arquivo `spec.md`.

## O que uma especificação tem aqui

Todas seguem o mesmo molde:

1. **Problema**: o que dá errado sem a funcionalidade.
2. **Para quem**: quem usa ou mantém.
3. **Requisitos** numerados (`RF-1`, `RF-2`, ...): o que o sistema faz.
4. **Critérios de aceite** numerados (`CA-1`, `CA-2`, ...): cada um é uma frase que se verifica rodando alguma coisa.
5. **Fora do escopo**: o que a funcionalidade não promete.
6. **Rastreabilidade**: uma tabela que liga cada critério ao arquivo de teste e ao nome exato do teste que o cobre.

## O ciclo de trabalho

O ciclo real do projeto, em ordem:

1. **Especificação com critérios de aceite.** Antes do código, escreve-se o que precisa ser verdade, em frases que dá para conferir. Um critério como "nenhuma rodada acaba em menos de 5 segundos" é verificável. Um como "o jogo é divertido" não é, e fica fora da lista.
2. **Teste que falha.** Cada critério vira um teste do `node --test`. O teste roda antes do código e precisa falhar pelo motivo certo. Um teste que passa sem código novo não prova nada.
3. **Código mínimo.** Escreve-se só o que faz o teste passar. O motor (`logica.mjs`) e os minijogos não dependem de navegador, então esse ciclo é rápido: `node --test arquivo.test.mjs`. O exemplo de um teste que passa de vermelho a verde está em [`docs/TESTES.md`](../docs/TESTES.md).
4. **Verificação na tela.** O que é visual ou depende de vários aparelhos juntos não cabe em teste de unidade. Para isso há scripts de navegador (`npm run e2e`) que abrem a tela do PC e celulares simulados com toque no Chromium, jogam rodadas inteiras e tiram prints. Os prints são abertos e conferidos contra `jogos/ESTILO.md`.
5. **Revisão independente.** Antes de mesclar, alguém que não escreveu o código lê o diff junto com a especificação, sem receber a conclusão de quem escreveu, e devolve achados por gravidade. Os críticos e os importantes são resolvidos antes do merge. Alguns testes de `logica.test.mjs` têm no comentário a origem "correções da revisão".

## Uma nota de honestidade

Parte destas especificações foi consolidada depois do código, a partir das decisões tomadas durante o desenvolvimento. O jogo foi sendo construído em ciclos curtos, com testes, e as regras foram aparecendo e sendo ajustadas no caminho: a regra dos 5 segundos, por exemplo, veio de uma auditoria dos minijogos, não de um documento anterior.

Por isso, não leia estes arquivos como um documento que sempre veio antes do código. Leia como o registro do que o sistema promete hoje. O valor deles está em outra coisa: **cada critério de aceite aponta para o teste que o cobra**. Se um teste muda ou some, a tabela mostra qual critério ficou sem cobertura. Se um critério não tem teste, a tabela escreve "sem teste automatizado" em vez de fingir que tem.

## Como ler a tabela de rastreabilidade

- A coluna "Teste (nome exato)" traz o texto que o `node --test` imprime. Dá para achar o teste com `grep -rn "parte do nome" *.test.mjs jogos/*.test.mjs`.
- Para os testes de navegador (`e2e/`), que são scripts e não têm nome de teste, a coluna traz a linha `ok ...` que o script imprime logo depois do `assert` correspondente.
- Os nomes dos testes estão escritos sem acento, como no código.
- Todos os nomes de `node --test` citados foram conferidos contra a saída de `npm test`.

## Índice

| Spec | Funcionalidade | Testes automatizados |
|---|---|---|
| [001](001-contrato-do-minijogo/spec.md) | Contrato do minijogo | motor, `fumaca` em cada minijogo |
| [002](002-servidor-carteiro/spec.md) | Servidor carteiro e segurança da entrada | `server.test.mjs`, motor |
| [003](003-controle-no-celular/spec.md) | Controle no celular | `controle.test.mjs`, `tela.test.mjs`, navegador |
| [004](004-modo-festa-e-duplas/spec.md) | Modo festa e duplas | `logica-festa.test.mjs`, navegador |
| [005](005-rotacao-e-variedade/spec.md) | Rotação e variedade | `logica.test.mjs`, `logica-festa.test.mjs` |
| [006](006-regra-dos-5-segundos/spec.md) | Regra dos 5 segundos mínimos | `jogos/minimo-5s.test.mjs`, `logica.test.mjs` |
| [007](007-cooperativo-para-dupla-lenta/spec.md) | Cooperativo acessível para dupla lenta | `jogos/*-coop.test.mjs` |
| [008](008-robo-de-treino/spec.md) | Robô de treino | só navegador (`e2e/teste-robo.js`) |

## Como acrescentar uma especificação

1. Crie `specs/NNN-nome/spec.md` com o próximo número e o molde acima.
2. Escreva os critérios antes do código. Cada um deve poder ser verificado por um comando.
3. Escreva o teste de cada critério e veja-o falhar.
4. Preencha a tabela de rastreabilidade com o arquivo e o nome exato do teste. Se um critério não tiver teste, escreva "sem teste automatizado".
5. Acrescente a linha no índice acima.

Quem for criar um minijogo novo encontra o passo a passo em [`CONTRIBUTING.md`](../CONTRIBUTING.md).
