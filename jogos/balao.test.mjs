import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './balao.mjs';

function aperta(p, i, vezes = 1) {
  for (let k = 0; k < vezes; k++) { entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); }
}
function nova(limite = 20) {
  const p = partidaCom(jogo);
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, n: 0 });
  p.dados.limite = limite;
  return p;
}

test('balao: o limite sorteado fica entre 15 e 45', () => {
  const p = partidaCom(jogo);
  assert.ok(Number.isInteger(p.dados.limite) && p.dados.limite >= 15 && p.dados.limite <= 45);
});

test('balao: cada aperto enche e soma 1 para quem apertou', () => {
  const p = nova();
  aperta(p, 0, 3); aperta(p, 1, 2);
  assert.equal(p.dados.ar, 5);
  assert.deepEqual(p.dados.placar, [3, 2]);
  assert.equal(p.vencedor, undefined);
});

test('balao: quem dá o aperto que estoura perde, mesmo com mais sopros', () => {
  const p = nova(10);
  aperta(p, 0, 9);
  assert.equal(p.vencedor, undefined);
  aperta(p, 0, 1);
  assert.equal(p.vencedor, 1);
  assert.equal(p.dados.estourou, 0);
  assert.equal(p.jogadores[0].vivo, false, 'quem estourou sai voando');
});

test('balao: sem estouro, em 25 s ganha quem encheu mais', () => {
  const p = nova(40);
  aperta(p, 0, 2); aperta(p, 1, 5);
  roda(p, 26);
  assert.equal(p.vencedor, 1);
});

test('balao: sopros iguais (ou ninguém apertou) dá empate', () => {
  const p = nova(40);
  aperta(p, 0, 4); aperta(p, 1, 4);
  roda(p, 26);
  assert.equal(p.vencedor, -1);
  const q = nova();
  roda(q, 26);
  assert.equal(q.vencedor, -1);
});

test('balao: 3 s sem apertos e o balão murcha, sem tirar pontos', () => {
  const p = nova(40);
  aperta(p, 0, 6);
  roda(p, 2.5);
  assert.equal(p.dados.ar, 6);
  roda(p, 1);
  assert.equal(p.dados.ar, 3);
  assert.deepEqual(p.dados.placar, [6, 0]);
});

test('balao: a tensão sobe perto do limite', () => {
  const p = nova(20);
  assert.equal(p.dados.tensao, 0);
  aperta(p, 1, 19);
  assert.equal(p.dados.tensao, 2);
});

test('balao: roda inteiro, parado e com dedos aleatórios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
