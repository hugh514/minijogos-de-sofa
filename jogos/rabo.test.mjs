import test from 'node:test';
import assert from 'node:assert/strict';
import { passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './rabo.mjs';

function poeEm(p, i, caixa) { const j = p.jogadores[i]; j.x = caixa.x; j.z = caixa.z; j.vx = j.vz = 0; }

test('rabo: encostar na ultima caixa do outro rouba e ela vai para o fim da propria cauda', () => {
  const p = partidaCom(jogo), d = p.dados;
  const ultima = d.caudas[1].at(-1);
  poeEm(p, 0, ultima); passo(p, DT);
  assert.deepEqual(d.placar, [4, 2]);
  assert.equal(d.caudas[0].at(-1), ultima);
});

test('rabo: encostar em caixa que nao e a ultima nao rouba', () => {
  const p = partidaCom(jogo), d = p.dados;
  p.jogadores[1].x = 0; p.jogadores[1].z = 6;      // tira o dono do caminho
  poeEm(p, 0, d.caudas[1][0]); passo(p, DT);
  assert.deepEqual(d.placar, [3, 3]);
});

test('rabo: depois de um roubo a cauda fica imune por 1 s', () => {
  const p = partidaCom(jogo), d = p.dados;
  poeEm(p, 0, d.caudas[1].at(-1)); passo(p, DT);
  for (let k = 0; k < 50; k++) { poeEm(p, 0, d.caudas[1].at(-1)); passo(p, DT); }
  assert.deepEqual(d.placar, [4, 2], 'ainda imune');
  for (let k = 0; k < 15; k++) { poeEm(p, 0, d.caudas[1].at(-1)); passo(p, DT); }
  assert.deepEqual(d.placar, [5, 1], 'passou 1 s, rouba de novo');
});

test('rabo: caixa solta aparece a cada 6 s e quem encosta leva', () => {
  const p = partidaCom(jogo), d = p.dados;
  roda(p, 5.9); assert.equal(d.soltas.length, 0);
  roda(p, 0.2); assert.equal(d.soltas.length, 1);
  poeEm(p, 1, d.soltas[0]); passo(p, DT);
  assert.deepEqual(d.placar, [3, 4]);
  assert.equal(d.soltas.length, 0);
});

test('rabo: ficar com zero caixas perde na hora', () => {
  const p = partidaCom(jogo), d = p.dados;
  d.caudas[1].length = 1;
  poeEm(p, 0, d.caudas[1][0]); passo(p, DT);
  assert.equal(p.vencedor, 0);
  assert.equal(p.jogadores[1].vivo, false);
});

test('rabo: aos 30 s vence a cauda maior, e igual da empate', () => {
  const empate = partidaCom(jogo);
  empate.dados.prox = 99;
  roda(empate, 30.1);
  assert.equal(empate.vencedor, -1);
  const p = partidaCom(jogo);
  p.dados.prox = 99; p.dados.caudas[1].push({ x: 0, z: 8 });
  roda(p, 29); assert.equal(p.vencedor, undefined);
  roda(p, 1.1); assert.equal(p.vencedor, 1);
});

test('rabo: as caixas seguem o boneco sem se afastar', () => {
  const p = partidaCom(jogo), d = p.dados, j = p.jogadores[0];
  for (let k = 0; k < 120; k++) { j.vx = 0; j.vz = 8; passo(p, DT); }
  const c = d.caudas[0];
  assert.ok(Math.hypot(c[0].x - j.x, c[0].z - j.z) < 1.6, 'primeira caixa colada no boneco');
  assert.ok(Math.hypot(c[2].x - c[1].x, c[2].z - c[1].z) < 1.6, 'ultima caixa colada na anterior');
});

test('rabo: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
