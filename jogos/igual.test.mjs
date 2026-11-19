import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './igual.mjs';

function escolhe(p, i, op) {
  const j = p.jogadores[i];
  if (j.nop === undefined) entrada(p, i, { nop: 0 });
  entrada(p, i, { op, nop: j.nop + 1 });
  passo(p, DT);
}
const fimDoRound = p => roda(p, 2.6);

test('igual: cada celular mostra o proprio papel e 3 cores', () => {
  const p = partidaCom(jogo), d = p.dados;
  assert.equal(p.celular[0].opcoes, undefined, 'sem botoes antes de valer');
  passo(p, DT);
  assert.match(p.celular[d.igual].texto, /o Igual:/);
  assert.match(p.celular[1 - d.igual].texto, /o Diferente:/);
  assert.equal(p.celular[0].opcoes.length, 3);
});

test('igual: cores iguais dao 2 pontos ao Igual, diferentes dao 1 ao Diferente, e os papeis trocam', () => {
  const p = partidaCom(jogo), d = p.dados, a = d.igual, b = 1 - a;
  escolhe(p, 0, 1);
  assert.equal(d.fase, 'escolhe', 'espera o segundo jogador');
  assert.doesNotMatch(d.aviso, /Vermelho|Amarelo|Verde/, 'a tela nao mostra a cor antes da hora');
  escolhe(p, 1, 1);
  assert.equal(d.fase, 'revela');
  assert.equal(d.placar[a], 2);
  fimDoRound(p);
  assert.equal(d.igual, b, 'papeis trocaram');
  escolhe(p, 0, 0); escolhe(p, 1, 2);
  assert.equal(d.placar[a], 3, 'agora "a" e o Diferente e marcou 1');
  assert.equal(d.placar[b], 0);
});

test('igual: escolha travada (segundo toque nao muda) e opcao invalida ignorada', () => {
  const p = partidaCom(jogo), d = p.dados;
  escolhe(p, 0, 3);
  assert.equal(d.esc[0], -1);
  escolhe(p, 0, 2); escolhe(p, 0, 0);
  assert.equal(d.esc[0], 2);
});

test('igual: primeiro a 4 pontos vence', () => {
  const p = partidaCom(jogo), d = p.dados, a = d.igual;
  escolhe(p, 0, 0); escolhe(p, 1, 0);               // a: 2
  fimDoRound(p);
  escolhe(p, 0, 0); escolhe(p, 1, 1);               // a (agora Diferente): 3
  fimDoRound(p);
  escolhe(p, 0, 2); escolhe(p, 1, 2);               // a (Igual de novo): 5
  roda(p, 1.7);
  assert.equal(p.vencedor, a);
  assert.equal(p.jogadores[1 - a].vivo, false, 'quem perdeu sai voando');
});

test('igual: 6 rounds empatados em 3 a 3 levam a um round de desempate', () => {
  const p = partidaCom(jogo), d = p.dados;
  for (let r = 0; r < 6; r++) {                     // sempre diferentes: cada um marca 1 por round alternado
    assert.equal(p.vencedor, undefined);
    escolhe(p, 0, 0); escolhe(p, 1, 1);
    if (r < 5) fimDoRound(p);
  }
  assert.deepEqual(d.placar, [3, 3]);
  assert.equal(d.final, false);
  fimDoRound(p);
  assert.equal(d.round, 7);
  passo(p, DT);
  assert.match(d.aviso, /Desempate/);
  escolhe(p, 0, 0); escolhe(p, 1, 1);
  roda(p, 1.7);
  assert.ok(p.vencedor === 0 || p.vencedor === 1, 'o desempate decide');
});

test('igual: as cores ja usadas aparecem na tela depois de cada round', () => {
  const p = partidaCom(jogo), d = p.dados;
  assert.deepEqual(d.inventario, [[], []]);
  escolhe(p, 0, 0); escolhe(p, 1, 2);
  assert.deepEqual(d.inventario, [['Vermelho 1'], ['Verde 1']]);
  fimDoRound(p);
  escolhe(p, 0, 0); escolhe(p, 1, 0);
  assert.deepEqual(d.inventario[0], ['Vermelho 2']);
  assert.match(jogo.dica, /rival já usou/);
});

test('igual: ninguem escolhe, o sorteio escolhe e a rodada termina em menos de 60 s', () => {
  const p = partidaCom(jogo);
  roda(p, 4.6);
  assert.equal(p.dados.fase, 'revela');
  let s = 4.6;
  for (; s < 60 && p.fase === 'jogando'; s += DT) passo(p, DT);
  assert.ok(s < 50, 'durou ' + s);
});

test('igual: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
