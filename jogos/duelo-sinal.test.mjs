import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './duelo-sinal.mjs';

function aperta(p, i) { entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); }
function nova() {
  const p = partidaCom(jogo);
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, n: 0 });
  return p;
}
function ateVerde(p) {
  for (let k = 0; k < 60 * 12 && p.dados.fase !== 'verde'; k++) passo(p, DT);
  assert.equal(p.dados.fase, 'verde');
}

test('duelo-sinal: o verde chega entre 2 e 6 s com luz e aviso', () => {
  const p = nova();
  assert.ok(p.dados.tVerde >= 2 && p.dados.tVerde <= 6);
  roda(p, 1.5);
  assert.notEqual(p.dados.luz, 'verde');
  ateVerde(p);
  assert.equal(p.dados.luz, 'verde');
  assert.equal(p.dados.aviso, 'Já!');
});

test('duelo-sinal: quem aperta antes do verde perde o round', () => {
  const p = nova();
  roda(p, 0.5);
  aperta(p, 0); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.dados.fase, 'pausa');
  assert.ok(p.jogadores[0].vy > 0 || p.jogadores[0].y > 0, 'quem queimou pula para trás');
});

test('duelo-sinal: o primeiro a apertar no verde ganha o round, quem fizer 3 vence', () => {
  const p = nova();
  ateVerde(p); aperta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.vencedor, undefined);
  aperta(p, 0); passo(p, DT);                      // aperto na pausa não conta nem queima
  assert.deepEqual(p.dados.placar, [0, 1]);
  roda(p, 2);
  assert.equal(p.dados.fase, 'espera');
  for (const [quem, placar] of [[0, [1, 1]], [1, [1, 2]], [0, [2, 2]]]) {
    ateVerde(p); aperta(p, quem); passo(p, DT);
    assert.deepEqual(p.dados.placar, placar);
    assert.equal(p.vencedor, undefined, 'com 2 ainda não acabou');
    roda(p, 2);
  }
  ateVerde(p); aperta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.placar, [2, 3]);
  assert.equal(p.vencedor, 1);
  assert.equal(p.jogadores[0].vivo, false, 'o perdedor sai voando');
});

test('duelo-sinal: avisos em caixa normal', () => {
  const p = nova();
  roda(p, 0.5);
  assert.equal(p.dados.aviso, 'Preparar...');
  aperta(p, 0); passo(p, DT);
  assert.equal(p.dados.aviso, 'Queimou a largada!');
  assert.doesNotMatch(jogo.dica, /VERDE/);
});

test('duelo-sinal: os dois no mesmo quadro no verde, ninguém pontua', () => {
  const p = nova();
  ateVerde(p); aperta(p, 0); aperta(p, 1); passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.equal(p.dados.fase, 'pausa');
});

test('duelo-sinal: sinais falsos nunca acendem o verde e vibram o celular', () => {
  const p = nova();
  p.dados.tVerde = 5;
  p.dados.falsos = [{ t: 1, tipo: 'amarela', quem: 2 }, { t: 2, tipo: 'vibra', quem: 0 }, { t: 3, tipo: 'quase', quem: 2 }];
  roda(p, 1.2); assert.equal(p.dados.luz, 'amarela');
  roda(p, 1); assert.equal(p.celular[0].vibra, 1); assert.equal(p.celular[1].vibra, undefined);
  roda(p, 1); assert.equal(p.dados.aviso, 'Quase...'); assert.equal(p.dados.luz, 'apagada');
  assert.equal(p.dados.fase, 'espera');
});

test('duelo-sinal: parados, empata no limite de tempo', () => {
  const p = nova();
  roda(p, 46);
  assert.equal(p.vencedor, -1);
});

test('duelo-sinal: roda inteiro, parado e com dedos aleatórios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
