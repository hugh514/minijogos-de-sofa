import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './esconderijo.mjs';

function escolhe(p, i, op) {
  const j = p.jogadores[i];
  if (j.nop === undefined) entrada(p, i, { nop: 0 });
  entrada(p, i, { op, nop: j.nop + 1 });
  passo(p, DT);
}
const fimDoRound = p => roda(p, 2.6);

test('esconderijo: so o Esconde escolhe; depois so ele sabe a caixa e o Procura recebe as 4 opcoes', () => {
  const p = partidaCom(jogo), d = p.dados, e = d.esconde, r = 1 - e;
  assert.equal(p.celular[e].opcoes, undefined, 'sem botoes antes de valer');
  passo(p, DT);
  assert.equal(p.celular[e].modo, 'opcoes');
  assert.equal(p.celular[r].modo, 'espera');
  escolhe(p, r, 1);
  assert.equal(d.fase, 'esconde', 'toque do Procura nao esconde nada');
  escolhe(p, e, 2);
  assert.equal(d.tesouro, 2);
  assert.equal(d.fase, 'procura');
  assert.match(p.celular[e].texto, /Verde/);
  assert.equal(p.celular[e].modo, 'espera');
  assert.equal(p.celular[r].opcoes.length, 4);
  assert.doesNotMatch(p.celular[r].texto + p.celular[r].opcoes.join(), /vazia/);
  passo(p, DT);
  assert.doesNotMatch(d.aviso, /Vermelha|Amarela|Verde|Roxa/, 'a tela nao entrega a caixa');
});

test('esconderijo: achar de primeira vale 2 pontos e no segundo palpite vale 1', () => {
  for (const palpites of [[2], [0, 2]]) {
    const p = partidaCom(jogo), d = p.dados, e = d.esconde, r = 1 - e;
    escolhe(p, e, 2);
    for (const op of palpites) escolhe(p, r, op);
    assert.equal(d.fase, 'revela');
    assert.equal(d.achou, true);
    assert.equal(d.placar[r], palpites.length === 1 ? 2 : 1);
    assert.match(d.aviso, palpites.length === 1 ? /De primeira: 2 pontos/ : /Ponto do Jogador/);
  }
});

test('esconderijo: errar os 2 palpites da ponto ao Esconde; caixa ja aberta nao gasta palpite', () => {
  const p = partidaCom(jogo), d = p.dados, e = d.esconde, r = 1 - e;
  escolhe(p, e, 3);
  escolhe(p, r, 0);
  assert.deepEqual(d.abertas, [true, false, false, false]);
  assert.match(p.celular[r].opcoes[0], /vazia/);
  escolhe(p, r, 0);
  assert.equal(d.palpites, 1, 'repetir a caixa vazia nao conta');
  escolhe(p, r, 1);
  assert.equal(d.fase, 'revela');
  assert.equal(d.achou, false);
  assert.equal(d.placar[e], 1);
});

test('esconderijo: 2 a 0 em dois rounds com papeis trocados encerra', () => {
  const p = partidaCom(jogo), d = p.dados, a = d.esconde, b = 1 - a;
  escolhe(p, a, 0); escolhe(p, b, 1); escolhe(p, b, 2);       // b nao achou: ponto de a
  fimDoRound(p);
  assert.equal(d.round, 2);
  assert.equal(d.esconde, b, 'papeis trocaram');
  escolhe(p, b, 1); escolhe(p, a, 1);                         // a achou de primeira: 2 a 0
  roda(p, 1.7);
  assert.equal(p.vencedor, a);
  assert.equal(p.jogadores[b].vivo, false);
});

test('esconderijo: 1 a 1 leva ao desempate, que decide', () => {
  const p = partidaCom(jogo), d = p.dados, a = d.esconde, b = 1 - a;
  escolhe(p, a, 0); escolhe(p, b, 0);                         // b achou
  fimDoRound(p);
  escolhe(p, b, 0); escolhe(p, a, 0);                         // a achou: 1 a 1
  fimDoRound(p);
  assert.equal(p.vencedor, undefined);
  assert.equal(d.round, 3);
  passo(p, DT);
  assert.match(d.aviso, /Desempate/);
  const e = d.esconde;
  escolhe(p, e, 1); escolhe(p, 1 - e, 1);                     // Procura acha
  roda(p, 1.7);
  assert.equal(p.vencedor, 1 - e);
});

test('esconderijo: ninguem toca em nada e a rodada termina sozinha em menos de 60 s, com vencedor', () => {
  const p = partidaCom(jogo);
  let s = 0;
  for (; s < 70 && p.fase === 'jogando'; s += DT) passo(p, DT);
  assert.ok(s < 60, 'durou ' + s);
  assert.ok(p.vencedor === 0 || p.vencedor === 1);
});

test('esconderijo: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => v === 0 || v === 1));
});
