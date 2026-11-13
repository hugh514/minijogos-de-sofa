import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './canhoes.mjs';

// encosta em (0, 0), arrasta ate (x, y) e solta
function arrasta(p, i, x, y) {
  entrada(p, i, { x: 0, y: 0, d: true }); passo(p, DT);
  entrada(p, i, { x, y, d: true }); passo(p, DT);
  entrada(p, i, { x, y, d: false }); passo(p, DT);
}
const bolaEm = (c, dono) => ({ x: c.x, y: c.y + 1, z: c.z, vx: 0, vy: 0, vz: 0, dono });
const de = (p, dono) => p.dados.caixas.filter(c => c.dono === dono);

test('canhoes: soltar atira na direcao oposta ao arrasto e a bola voa em arco', () => {
  const p = partidaCom(jogo);
  arrasta(p, 0, -0.4, 0);
  const b = p.dados.bolas[0];
  assert.ok(b && b.vx > 0 && Math.abs(b.vz) < 1e-9, 'arrastou para a esquerda, saiu para a direita');
  const y0 = b.y;
  roda(p, 0.4);
  assert.ok(b.y > y0 + 1, 'sobe');
  roda(p, 1.5);
  assert.equal(p.dados.bolas.length, 0, 'caiu no chao e sumiu');
  assert.deepEqual(p.dados.placar, [6, 6], 'tiro fraco nao chega nas caixas');
});

test('canhoes: tiro na medida derruba uma caixa do outro, dos dois lados', () => {
  for (const i of [0, 1]) {
    const p = partidaCom(jogo);
    arrasta(p, i, i ? 0.8 : -0.8, 0);
    roda(p, 2);
    const esperado = [6, 6]; esperado[1 - i] = 5;
    assert.deepEqual(p.dados.placar, esperado);
  }
});

test('canhoes: recarga segura o segundo tiro, que sai depois', () => {
  const p = partidaCom(jogo);
  arrasta(p, 0, -0.3, 0);
  arrasta(p, 0, -0.3, 0);
  assert.equal(p.dados.bolas.length, 1);
  roda(p, 0.8);
  assert.equal(p.dados.bolas.length, 2);
});

test('canhoes: derrubar a caixa de baixo faz a de cima descer', () => {
  const p = partidaCom(jogo);
  const [baixo, cima] = de(p, 1);
  assert.equal(baixo.nivel, 0); assert.equal(cima.nivel, 1);
  p.dados.bolas.push({ x: baixo.x - 1, y: baixo.y, z: baixo.z, vx: 8, vy: 0, vz: 0, dono: 0 });
  roda(p, 1);
  assert.ok(baixo.caiu && !cima.caiu);
  assert.equal(cima.nivel, 0);
  assert.ok(Math.abs(cima.y - 0.7) < 1e-9, 'a de cima pousou no chao');
});

test('canhoes: derrubar todas as caixas do outro vence na hora', () => {
  const p = partidaCom(jogo);
  const caixas = de(p, 1);
  for (const c of caixas.slice(1)) c.caiu = true;
  p.dados.bolas.push(bolaEm(caixas[0], 0));
  roda(p, 1);
  assert.equal(p.vencedor, 0);
  assert.equal(p.jogadores[1].vivo, false, 'o perdedor voa');
});

test('canhoes: no tempo, vence quem derrubou mais; igual e empate', () => {
  const p = partidaCom(jogo);
  de(p, 0)[1].caiu = true;
  roda(p, 41);
  assert.equal(p.vencedor, 1);
  const q = partidaCom(jogo);
  roda(q, 41);
  assert.equal(q.vencedor, -1);
});

test('canhoes: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
