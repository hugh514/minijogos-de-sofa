import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from './_teste.mjs';
import jogo from './domino.mjs';

const OFF = 0.8, PER = 0.7;                     // primeira batida e intervalo entre batidas
const reta = () => ({ torta: false, t: 0 }), torta = () => ({ torta: true, t: 0 });
const retas = n => Array.from({ length: n }, reta);

// Toque com contador: o primeiro envio so fixa a base, o segundo e o toque (vezes = quantos toques de uma vez).
function toca(p, i, campo = 'n', vezes = 1) {
  if (p.jogadores[i][campo] === undefined) entrada(p, i, { x: 0, y: 0, [campo]: 0 });
  entrada(p, i, { x: 0, y: 0, [campo]: p.jogadores[i][campo] + vezes });
}

// Vai ate o instante da batida k (mais "folga" segundos) e deixa os toques de quem esta em "quem" chegarem nele.
function aperta(p, k, quem, folga = 0) {
  p.t = OFF + k * PER + folga - DT;
  for (const i of quem) toca(p, i);
  passo(p, DT);
}

// B so derruba depois de segurado por 1 s.
function segura(p, quem, seg = 1.05) {
  for (const i of quem) entrada(p, i, { x: 0, y: 0, b: true });
  roda(p, seg);
  for (const i of quem) entrada(p, i, { x: 0, y: 0, b: false });
}

test('domino: um toque curto em B nao derruba a fileira', () => {
  const p = partidaCom(jogo);
  p.dados.fila[0] = retas(5);
  segura(p, [0], 0.5);
  assert.equal(p.dados.estado[0], 'monta');
  segura(p, [0], 0.3);          // soltou no meio: o tempo recomeca
  assert.equal(p.dados.estado[0], 'monta');
});

test('domino: A no ritmo coloca uma peca reta na fileira de quem apertou', () => {
  const p = partidaCom(jogo);
  aperta(p, 1, [0]);
  aperta(p, 2, [0]);
  assert.equal(p.dados.fila[0].length, 2);
  assert.ok(p.dados.fila[0].every(x => !x.torta));
  assert.equal(p.dados.fila[1].length, 0);
  assert.equal(p.dados.placar[0], 2);
});

test('domino: A fora do ritmo coloca peca torta e vibra o celular', () => {
  const p = partidaCom(jogo);
  aperta(p, 1, [0]);
  aperta(p, 2, [0], PER / 2);
  assert.deepEqual(p.dados.fila[0].map(x => x.torta), [false, true]);
  assert.equal(p.celular[0].vibra, 1);
  assert.equal(p.celular[1].vibra, undefined);
  assert.equal(p.dados.placar[0], 1, 'so conta a fileira ate a peca torta');
});

test('domino: apertar antes da primeira batida tambem sai torto', () => {
  const p = partidaCom(jogo);
  p.t = 0.05; toca(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.fila[1].map(x => x.torta), [true]);
});

test('domino: o proximo toque no ritmo endireita a peca torta, sem peca nova', () => {
  const p = partidaCom(jogo);
  aperta(p, 1, [0]);
  aperta(p, 2, [0], PER / 2);
  aperta(p, 4, [0]);
  assert.deepEqual(p.dados.fila[0].map(x => x.torta), [false, false]);
  aperta(p, 5, [0]);
  assert.equal(p.dados.fila[0].length, 3);
});

test('domino: dois toques na mesma batida: o segundo sai torto (nao vale socar o botao)', () => {
  const p = partidaCom(jogo);
  p.t = OFF + 2 * PER - DT;
  toca(p, 0, 'n', 2);
  passo(p, DT);
  assert.deepEqual(p.dados.fila[0].map(x => x.torta), [false, true]);
});

test('domino: toque curto de A (contador) nao se perde', () => {
  const p = partidaCom(jogo);
  p.t = OFF + PER - DT;
  entrada(p, 1, { x: 0, y: 0, n: 0 });
  entrada(p, 1, { x: 0, y: 0, n: 1, d: false });      // apertou e soltou antes do quadro
  passo(p, DT);
  assert.equal(p.dados.fila[1].length, 1);
});

test('domino: B derruba a propria fileira em cascata, uma peca por vez', () => {
  const p = partidaCom(jogo);
  p.dados.fila[0] = retas(5);
  segura(p, [0]);
  assert.equal(p.dados.estado[0], 'cai');
  assert.equal(p.dados.estado[1], 'monta', 'a fileira do outro segue em pe');
  roda(p, 0.3);
  assert.ok(p.dados.caiu[0] > 0 && p.dados.caiu[0] < 5, 'meio da cascata: ' + p.dados.caiu[0]);
  roda(p, 1);
  assert.equal(p.dados.caiu[0], 5);
  assert.equal(p.dados.estado[0], 'fim');
  assert.equal(p.dados.placar[0], 5);
});

test('domino: peca torta quebra a cascata ali', () => {
  const p = partidaCom(jogo);
  p.dados.fila[0] = [...retas(4), torta(), ...retas(3)];
  segura(p, [0]);
  roda(p, 2);
  assert.equal(p.dados.caiu[0], 4);
  assert.equal(p.dados.estado[0], 'fim');
  assert.equal(p.celular[0].vibra, 1, 'vibra quando a cascata quebra');
});

test('domino: ao fim de 20 s todas as fileiras caem sozinhas', () => {
  const p = partidaCom(jogo);
  p.dados.fila[0] = retas(3); p.dados.fila[1] = retas(2);
  roda(p, 19.8);
  assert.equal(p.dados.estado[0], 'monta');
  roda(p, 0.25);
  assert.equal(p.dados.estado[0], 'cai');
  assert.equal(p.dados.estado[1], 'cai');
});

test('domino: fileira cheia derruba sozinha', () => {
  const p = partidaCom(jogo);
  p.dados.fila[0] = retas(25);
  aperta(p, 3, [0]);
  assert.equal(p.dados.fila[0].length, 26);
  assert.equal(p.dados.estado[0], 'cai');
});

test('domino: jogador 1 derruba mais pecas e vence', () => {
  const p = partidaCom(jogo);
  for (let k = 1; k <= 6; k++) aperta(p, k, k <= 3 ? [0, 1] : [0]);
  segura(p, [0, 1]);
  const d = p.dados;
  roda(p, 3);
  assert.deepEqual(d.placar, [6, 3]);
  assert.equal(p.vencedor, 0);
});

test('domino: jogador 2 derruba mais pecas e vence', () => {
  const p = partidaCom(jogo);
  for (let k = 1; k <= 5; k++) aperta(p, k, k <= 2 ? [0, 1] : [1]);
  segura(p, [0, 1]);
  const d = p.dados;
  roda(p, 3);
  assert.deepEqual(d.placar, [2, 5]);
  assert.equal(p.vencedor, 1);
});

test('domino: quebrar antes faz perder para quem manteve o ritmo', () => {
  const p = partidaCom(jogo);
  aperta(p, 1, [0, 1]); aperta(p, 2, [0, 1]); aperta(p, 3, [0, 1]);
  aperta(p, 4, [1]); aperta(p, 5, [1]); aperta(p, 5, [0], PER / 2);   // o de indice 0 errou o ritmo e nao concertou
  segura(p, [0, 1]);
  const d = p.dados;
  roda(p, 3);
  assert.deepEqual(d.placar, [3, 5]);
  assert.equal(p.vencedor, 1);
});

test('domino: mesma quantidade derrubada empata; sem ninguem jogar, empata no limite de tempo', () => {
  let p = partidaCom(jogo);
  p.dados.fila[0] = retas(4); p.dados.fila[1] = retas(4);
  roda(p, 22.5);
  assert.equal(p.vencedor, -1);
  p = partidaCom(jogo);
  roda(p, 19);
  assert.equal(p.fase, 'jogando');
  roda(p, 2.5);
  assert.equal(p.vencedor, -1);
});

test('domino: no limite de tempo vence quem tem mais pecas em pe e retas', () => {
  const p = partidaCom(jogo);
  p.dados.fila[0] = retas(4); p.dados.fila[1] = [...retas(2), torta(), ...retas(6)];
  const d = p.dados;
  roda(p, 22.5);
  assert.deepEqual(d.placar, [4, 2]);
  assert.equal(p.vencedor, 0);
});

test('domino: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => [-1, 0, 1].includes(v)));
});
