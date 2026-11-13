import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './cabo.mjs';

function aperta(p, i, vezes) {
  for (let k = 0; k < vezes; k++) { entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); }
}

test('cabo: apertar no verde puxa para o proprio lado e vence', () => {
  const p = partidaCom(jogo);
  p.dados.troca = 99;
  entrada(p, 0, { x: 0, y: 0, n: 0 });
  aperta(p, 0, 5);
  assert.ok(p.dados.corda < -1, 'corda foi para o lado do jogador 1');
  aperta(p, 0, 30);
  assert.equal(p.vencedor, 0);
});

test('cabo: apertar no vermelho escorrega para o lado do outro', () => {
  const p = partidaCom(jogo);
  p.dados.troca = 99; p.dados.vermelho = true;
  entrada(p, 1, { x: 0, y: 0, n: 0 });
  aperta(p, 1, 2);
  assert.ok(p.dados.corda < -1.5, 'jogador 2 apertou no vermelho e perdeu terreno');
});

test('cabo: ninguem aperta, empata no limite de tempo', () => {
  const p = partidaCom(jogo);
  roda(p, 46);
  assert.equal(p.vencedor, -1);
});

test('cabo: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.ok(vencedores.length === 15);
});
