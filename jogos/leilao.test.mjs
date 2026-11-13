import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { lances, resolve, decide } from './leilao.mjs';

function escolhe(p, i, op) {
  const j = p.jogadores[i];
  if (j.nop === undefined) entrada(p, i, { nop: 0 });
  entrada(p, i, { op, nop: j.nop + 1 });
  passo(p, DT);
}
// da o lance de valor "v" (procura o botao com esse valor)
function lance(p, i, v) {
  const op = p.dados.ops[i].indexOf(v);
  assert.ok(op >= 0, `jogador ${i + 1} nao tem o lance ${v}: ${p.dados.ops[i]}`);
  escolhe(p, i, op);
}
const revela = p => roda(p, 0.8 + 0.9 + 0.1);        // suspense + fichas voando
const proximo = p => roda(p, 2.2);                   // resto da revelacao
function leilao(p, a, b) { lance(p, 0, a); lance(p, 1, b); revela(p); }

test('leilao: opcoes de lance saem do que o jogador tem', () => {
  assert.deepEqual(lances(10), [0, 1, 5, 10]);
  assert.deepEqual(lances(7), [0, 1, 3, 7]);
  assert.deepEqual(lances(3), [0, 1, 2, 3]);
  assert.deepEqual(lances(2), [0, 1, 2]);
  assert.deepEqual(lances(1), [0, 1]);
  assert.deepEqual(lances(0), [0]);
});

test('leilao: maior paga e leva, perdedor nao paga, empate cobra metade dos dois', () => {
  assert.deepEqual(resolve(5, 1), { dono: 0, pago: [5, 0] });
  assert.deepEqual(resolve(0, 10), { dono: 1, pago: [0, 10] });
  assert.deepEqual(resolve(5, 5), { dono: -1, pago: [2, 2] });
  assert.deepEqual(resolve(0, 0), { dono: -1, pago: [0, 0] });
});

test('leilao: celular mostra as fichas e 4 lances; o lance fica travado e secreto', () => {
  const p = partidaCom(jogo), d = p.dados;
  assert.equal(p.celular[0].opcoes, undefined, 'sem botoes antes de valer');
  assert.match(p.celular[0].texto, /10 fichas/);
  passo(p, DT);
  assert.deepEqual(p.celular[0].opcoes, ['0 fichas', '1 ficha', '5 fichas', '10 fichas (tudo)']);
  assert.match(p.celular[1].texto, /10 fichas/);
  escolhe(p, 0, 7);
  assert.equal(d.lance[0], -1, 'opcao invalida ignorada');
  lance(p, 0, 5); lance(p, 0, 1);
  assert.equal(d.lance[0], 5);
  assert.equal(d.fase, 'lance', 'espera o outro');
  assert.doesNotMatch(d.aviso, /5 fichas/, 'a tela nao entrega o lance');
  assert.equal(p.celular[0].modo, 'espera');
});

test('leilao: quem da o maior lance leva o premio e so ele paga', () => {
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 5, 1);
  assert.deepEqual(d.placar, [1, 0]);
  assert.deepEqual(d.fichas, [5, 10]);
  assert.deepEqual(d.premios, [0, null, null]);
  assert.match(p.celular[0].texto, /5 fichas/);
  proximo(p);
  assert.equal(d.round, 1);
  passo(p, DT);
  assert.deepEqual(p.celular[0].opcoes, ['0 fichas', '1 ficha', '2 fichas', '5 fichas (tudo)']);
});

test('leilao: empate de lances: ninguem leva e os dois pagam metade', () => {
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 5, 5);
  assert.deepEqual(d.placar, [0, 0]);
  assert.deepEqual(d.fichas, [8, 8]);
  assert.equal(d.premios[0], -1);
});

test('leilao: mais premios vence e a rodada acaba cedo com 2 a 0', () => {
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 1, 5); proximo(p);
  leilao(p, 1, 5);
  assert.deepEqual(d.placar, [0, 2]);
  roda(p, 2.2 + 2.5);
  assert.equal(p.vencedor, 1);
  assert.equal(p.jogadores[0].vivo, false, 'quem perdeu sai voando');
});

test('leilao: empate em premios decide por fichas; tudo igual e empate', () => {
  assert.equal(decide({ placar: [1, 1], fichas: [3, 6] }), 1);
  assert.equal(decide({ placar: [2, 1], fichas: [0, 9] }), 0);
  assert.equal(decide({ placar: [1, 1], fichas: [4, 4] }), -1);
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 5, 0); proximo(p);                      // J1 leva por 5 (5 x 10)
  leilao(p, 0, 1); proximo(p);                      // J2 leva por 1 (5 x 9)
  leilao(p, 0, 0);                                  // ninguem leva
  assert.deepEqual(d.placar, [1, 1]);
  roda(p, 2.2 + 2.5);
  assert.equal(p.vencedor, 1, 'J2 sobrou com mais fichas');
});

test('leilao: ninguem escolhe: lances zero, empate total em menos de 60 s', () => {
  const p = partidaCom(jogo);
  let s = 0;
  for (; s < 70 && p.fase === 'jogando'; s += DT) passo(p, DT);
  assert.equal(p.vencedor, -1);
  assert.deepEqual(p.dados.fichas, [10, 10]);
  assert.ok(s < 45, 'durou ' + s);
});

test('leilao: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.some(v => v >= 0), 'alguem ganha de vez em quando');
});
