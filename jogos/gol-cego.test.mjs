import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './gol-cego.mjs';

function segura(p, i, x, y) {
  entrada(p, i, { x: 0, y: 0, d: true }); passo(p, DT);
  entrada(p, i, { x, y, d: true }); passo(p, DT);
}
function arrasta(p, i, x, y) { segura(p, i, x, y); entrada(p, i, { x, y, d: false }); passo(p, DT); }
const vel = j => Math.hypot(j.vx, j.vz);

test('gol-cego: um so soltar nao lanca; quando os dois soltam, saem juntos na direcao oposta ao arrasto', () => {
  const p = partidaCom(jogo), [a, b] = p.jogadores;
  arrasta(p, 0, -0.5, 0);
  roda(p, 0.5);
  assert.equal(p.dados.fase, 'mira');
  assert.equal(vel(a), 0, 'o primeiro espera o outro');
  arrasta(p, 1, 0, -0.9);
  assert.equal(p.dados.fase, 'rola');
  assert.ok(a.vx > 5 && Math.abs(a.vz) < 1e-9, 'jogador 1 arrastou para a esquerda e saiu para a direita');
  assert.ok(b.vz > 10 && Math.abs(b.vx) < 1e-9, 'jogador 2 arrastou para cima e saiu para baixo');
  assert.ok(vel(b) > vel(a), 'arrasto maior, mais forca');
});

test('gol-cego: acabou o tempo da mira, vale o arrasto em andamento e quem nao mirou fica parado', () => {
  const p = partidaCom(jogo), [a, b] = p.jogadores;
  segura(p, 0, -0.6, 0);
  assert.equal(p.dados.aviso, '4');
  roda(p, 2);
  assert.equal(p.dados.aviso, '2');
  roda(p, 2);
  assert.equal(p.dados.fase, 'rola');
  assert.equal(p.dados.aviso, '');
  assert.ok(a.x > -6, 'saiu para a direita');
  assert.equal(b.x, 6);
});

test('gol-cego: o disco bate na bola, tudo para e vem nova mira de onde ficaram', () => {
  const p = partidaCom(jogo), [a] = p.jogadores;
  arrasta(p, 1, 0.3, 0);          // jogador 2 recua um pouco
  arrasta(p, 0, -0.9, 0);         // jogador 1 vai com tudo na bola
  roda(p, 1);
  assert.ok(p.dados.bola.x > 1, 'a bola foi para a direita');
  roda(p, 4);
  if (p.fase === 'jogando') {
    assert.equal(p.dados.fase, 'mira');
    assert.equal(vel(a), 0);
    assert.ok(a.x > -4, 'continua de onde parou');
  } else assert.equal(p.vencedor, 0);
});

function gol(p, vx) {
  Object.assign(p.dados, { fase: 'rola', tempo: 0, bola: { x: Math.sign(vx) * 8, z: 1, vx, vz: 0 } });
  roda(p, 1);
}

test('gol-cego: um gol so soma 1, nao encerra, e a bola volta ao meio com nova mira', () => {
  for (const [vx, esperado] of [[15, [1, 0]], [-15, [0, 1]]]) {
    const p = partidaCom(jogo);
    gol(p, vx);
    assert.deepEqual(p.dados.placar, esperado);
    assert.equal(p.fase, 'jogando');
    assert.equal(p.jogadores.every(j => j.vivo), true);
    assert.equal(p.dados.fase, 'mira');
    assert.deepEqual([p.dados.bola.x, p.dados.bola.z], [0, 0]);
    assert.deepEqual(p.jogadores.map(j => j.x), [-6, 6], 'cada um volta ao seu lado');
  }
});

test('gol-cego: o terceiro gol vence e quem levou voa; da para virar', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [2, 2];
  gol(p, -15);                       // gol no lado do jogador 1: ponto do jogador 2
  assert.equal(p.vencedor, 1);
  assert.equal(p.jogadores[0].vivo, false, 'quem levou o gol voa');
  const q = partidaCom(jogo);
  q.dados.placar = [2, 0];
  gol(q, 15);
  assert.equal(q.vencedor, 0);
});

test('gol-cego: aos 55 s vence quem fez mais gols; igual empata', () => {
  const p = partidaCom(jogo);
  p.dados.placar = [0, 1];
  roda(p, 54);
  assert.equal(p.fase, 'jogando');
  roda(p, 1.5);
  assert.equal(p.vencedor, 1);
  const q = partidaCom(jogo);
  roda(q, 54);
  assert.equal(q.fase, 'jogando');
  roda(q, 1.5);
  assert.equal(q.vencedor, -1);
});

test('gol-cego: placar de gols na tela e no celular, 55 s e a regra na dica', () => {
  const p = partidaCom(jogo);
  assert.equal(jogo.rotulo, 'gols');
  assert.equal(jogo.duracao, 55);
  assert.match(jogo.dica, /3 gols/);
  assert.deepEqual(p.dados.placar, [0, 0]);
  p.dados.placar = [1, 0];
  gol(p, 15);
  assert.deepEqual(p.dados.placar, [2, 0]);
  assert.match(p.celular[0].texto, /2 x 0/);
  assert.match(p.celular[1].texto, /2 x 0/);
});

test('gol-cego: fora do vao do gol a bola quica na parede', () => {
  const p = partidaCom(jogo);
  Object.assign(p.dados, { fase: 'rola', tempo: 0, bola: { x: 8, z: 5, vx: 15, vz: 0 } });
  roda(p, 0.5);
  assert.equal(p.fase, 'jogando');
  assert.ok(p.dados.bola.vx < 0 || p.dados.bola.x < 10.4);
});

test('gol-cego: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
