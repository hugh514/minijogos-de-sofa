import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { COFRES } from './cofre.mjs';

function aperta(p, i) { entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); }
// Termina o cofre atual e espera o proximo comecar (ou a rodada acabar).
function proximo(p) { const n = p.dados.cofre; for (let k = 0; k < 20 * 60 && p.fase === 'jogando' && p.dados.cofre === n; k++) passo(p, DT); }
function nova(explode = 90) {
  const p = partidaCom(jogo);
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, n: 0 });
  p.dados.explode = explode;
  return p;
}

test('cofre: o ponto de explosão fica entre 20 e 100 e o valor sobe acelerando', () => {
  const p = partidaCom(jogo);
  assert.ok(p.dados.explode >= 20 && p.dados.explode <= 100);
  p.dados.explode = 1000;
  roda(p, 1); const v1 = p.dados.valor;
  roda(p, 1); const v2 = p.dados.valor - v1;
  assert.ok(v1 > 0 && v2 > v1, 'o segundo segundo rende mais que o primeiro');
});

test('cofre: pegar garante o valor atual, uma vez só', () => {
  const p = nova();
  roda(p, 3);
  const valor = Math.floor(p.dados.valor);
  aperta(p, 0); passo(p, DT);
  assert.equal(p.dados.placar[0], valor);
  assert.equal(p.dados.saiu[0], true);
  assert.equal(p.vencedor, undefined, 'segue até o outro pegar ou explodir');
  roda(p, 1); aperta(p, 0); passo(p, DT);
  assert.equal(p.dados.placar[0], valor, 'o segundo aperto não muda nada');
});

test('cofre: quem pega primeiro trava o outro por um instante', () => {
  const p = nova(1000);
  roda(p, 2);
  aperta(p, 0); passo(p, DT);
  assert.equal(p.celular[1].a, 'TRAVADO!');
  aperta(p, 1); passo(p, DT);
  assert.equal(p.dados.saiu[1], false, 'travado não pega');
  roda(p, 1.6);
  assert.equal(p.celular[1].a, 'PEGA!');
  aperta(p, 1); passo(p, DT);
  assert.equal(p.dados.saiu[1], true);
  assert.ok(p.dados.placar[1] > p.dados.placar[0], 'pegou depois, pegou mais');
});

test('cofre: explodiu, quem não pegou fica com zero naquele cofre e vem o próximo', () => {
  const p = nova(30);
  roda(p, 3);
  aperta(p, 1); passo(p, DT);
  const garantido = p.dados.placar[1];
  assert.ok(garantido > 0);
  for (let k = 0; k < 60 * 14 && !p.dados.explodiu; k++) passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, garantido]);
  assert.equal(p.vencedor, undefined, 'um cofre só não decide');
  assert.ok(p.jogadores[0].vivo);
  proximo(p);
  assert.equal(p.dados.cofre, 2);
  assert.equal(p.dados.valor, 0);
  assert.deepEqual(p.dados.saiu, [false, false]);
  assert.match(p.celular[0].texto, /Cofre 2 de 3/);
});

test('cofre: são 3 cofres, as moedas somam e vence quem juntou mais', () => {
  assert.equal(COFRES, 3);
  const p = nova(1000);
  for (let k = 0; k < COFRES; k++) {
    p.dados.explode = 1000;
    roda(p, 2); aperta(p, 0); passo(p, DT);
    roda(p, 1.6); aperta(p, 1); passo(p, DT);
    if (k < COFRES - 1) proximo(p);
  }
  const [a, b] = p.dados.total;
  assert.ok(b > a && a > 0, `total ${a} x ${b}`);
  proximo(p);
  assert.equal(p.vencedor, 1);
  assert.equal(p.jogadores[0].vivo, false, 'o mais pobre sai voando');
});

test('cofre: ninguém pega nunca, os 3 explodem e empata com zero antes de 60 s', () => {
  const p = nova(100);
  let q = 0;
  for (; q < 60 * 60 && p.fase === 'jogando'; q++) passo(p, DT);
  assert.deepEqual(p.dados.total, [0, 0]);
  assert.equal(p.vencedor, -1);
  assert.ok(q < 60 * 60 && q > 20 * 60, 'durou ' + q / 60);
});

test('cofre: os dois pegam no mesmo quadro, empatam naquele cofre e ele fecha', () => {
  const p = nova();
  roda(p, 4);
  aperta(p, 0); aperta(p, 1); passo(p, DT);
  assert.equal(p.dados.placar[0], p.dados.placar[1]);
  assert.ok(p.dados.placar[0] > 0);
  for (const i of [0, 1]) assert.match(p.celular[i].texto, /Neste cofre/, 'o celular nao promete explosao que nao vem');
  assert.match(p.dados.aviso, /Os dois pegaram/);
  proximo(p);
  assert.equal(p.dados.cofre, 2);
});

test('cofre: roda inteiro, parado e com dedos aleatórios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
