# ADR 0004: Dificuldade do cooperativo travada por robô lento em teste

Status: aceita.

## Contexto

Todos juntos é a brincadeira para quem quer jogar sem disputa, e muita gente que a escolhe é criança ou está aprendendo. Se o jogo for difícil demais, a equipe perde as 5 noites sem chance. Dificuldade ajustada "no olho" muda a cada ajuste de código, e ninguém percebe quando uma mudança torna o jogo impossível para quem joga devagar.

## Decisão

1. Cada minijogo cooperativo tem, no próprio arquivo de teste, um robô lento: um jogador simulado que reage a cada 0,5 s e se distrai em 40% das vezes, mas foge do perigo, usa a ação do jogo e ajuda o amigo. Na `canoa-coop` o robô lento erra 40% dos toques.
2. O teste roda dezenas de partidas com sementes fixas e exige uma taxa mínima de vitória. No `zumbis-coop`, no `barco-coop` e no `trem-coop`, o piso com 2 jogadores é 85% na 1ª noite e 60% na 5ª. Os outros cooperativos têm pisos descritos nos nomes dos testes por expressões como "quase sempre" e "a maioria", e os valores estão no código de cada teste.
3. A 5ª noite precisa ser mais difícil que a 1ª: o teste compara as duas taxas.
4. Com 3 e 4 jogadores o robô lento também deve vencer a maioria, e jogadores parados devem perder.

## Consequências

- Um ajuste de número que torna o jogo difícil demais para quem joga devagar quebra um teste, na hora, em vez de aparecer semanas depois numa noite de jogo.
- Como as sementes são fixas, o resultado é o mesmo em toda execução. Não há teste intermitente por sorte.
- Os testes são mais lentos que os de regra pura, porque jogam muitas partidas completas. Isso pesa no minuto, mais ou menos, que o `npm test` leva.
- O robô é uma aproximação de uma pessoa distraída, não uma pessoa. O teste garante que o jogo é vencível por quem joga devagar, mas não que seja divertido. Essa parte só se verifica jogando.
- Mudar um piso é uma decisão de projeto e deve ser discutida na revisão, não um ajuste para fazer o teste passar.

Ver [`specs/007-cooperativo-para-dupla-lenta`](../../specs/007-cooperativo-para-dupla-lenta/spec.md).
