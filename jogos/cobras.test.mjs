import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { CARGAS, LIMITE, distSeg } from './cobras.mjs';

// Parede de luz do jogador 2 atravessada na frente do jogador 1 (que nasce em z = -3 indo para a direita).
const parede = p => { p.dados.trilhas[1].unshift({ x: -2, z: -7 }, { x: -2, z: 1 }); };

test('cobras: distancia de ponto a segmento', () => {
  assert.equal(distSeg(0, 2, { x: -1, z: 0 }, { x: 1, z: 0 }), 2);
  assert.equal(distSeg(4, 0, { x: -1, z: 0 }, { x: 1, z: 0 }), 3);
  assert.equal(distSeg(1, 1, { x: 0, z: 0 }, { x: 0, z: 0 }), Math.hypot(1, 1));   // segmento de tamanho zero nao gera NaN
});

test('cobras: sem joystick anda reto sozinho e deixa trilha', () => {
  const p = partidaCom(jogo);
  const x0 = p.jogadores[0].x;
  roda(p, 1);
  assert.ok(p.jogadores[0].x > x0 + 3, 'andou para a direita');
  assert.ok(Math.abs(p.jogadores[0].z + 3) < 0.01, 'sem desviar');
  assert.ok(p.dados.trilhas[0].length > 5, 'a trilha cresceu');
  assert.equal(p.vencedor, undefined);
});

test('cobras: o joystick vira aos poucos, sem girar na hora', () => {
  const p = partidaCom(jogo);
  entrada(p, 0, { x: 0, y: 1 });
  roda(p, 0.1);
  const ang = p.dados.cobras[0].ang;
  assert.ok(ang > 0.1 && ang < 1, 'virou um pouco: ' + ang);
  roda(p, 0.6);
  assert.ok(Math.abs(p.dados.cobras[0].ang - Math.PI / 2) < 0.01, 'chegou na direcao do joystick e parou de girar');
});

test('cobras: bater na parede de luz do outro elimina', () => {
  const p = partidaCom(jogo);
  parede(p);
  roda(p, 2);
  assert.equal(p.vencedor, 1);
  assert.equal(p.jogadores[0].vivo, false);
});

test('cobras: bater na propria trilha elimina', () => {
  const p = partidaCom(jogo);
  p.dados.trilhas[0].unshift({ x: -2, z: -7 }, { x: -2, z: 1 });
  entrada(p, 1, { x: 0, y: -1 });       // o jogador 2 sobe e depois volta, para nao bater antes
  roda(p, 0.6);
  entrada(p, 1, { x: 1, y: 0 });
  roda(p, 1.4);
  assert.equal(p.vencedor, 1);
});

test('cobras: o pulo (B) passa por cima de uma parede, uma vez so', () => {
  const p = partidaCom(jogo);
  parede(p);
  p.dados.cobras[0].x = -3.6;
  entrada(p, 0, { x: 0, y: 0, n: 0, nb: 0 });
  entrada(p, 0, { x: 0, y: 0, n: 0, nb: 1 });
  roda(p, 0.7);
  assert.ok(p.jogadores[0].vivo, 'passou por cima');
  assert.ok(p.dados.cobras[0].x > -1.5);
  assert.equal(p.dados.cobras[0].pulos, 0);
  entrada(p, 0, { x: 0, y: 0, n: 0, nb: 2 });
  passo(p, DT);
  assert.equal(p.jogadores[0].vy, 0, 'sem segundo pulo');
});

test('cobras: o turbo acelera por 1 s e gasta as 3 cargas', () => {
  const normal = partidaCom(jogo), p = partidaCom(jogo);
  entrada(p, 0, { x: 0, y: 0, n: 0 });
  entrada(p, 0, { x: 0, y: 0, n: 1 });
  roda(normal, 1); roda(p, 1);
  assert.ok(p.dados.cobras[0].x > normal.dados.cobras[0].x + 2, 'andou mais com turbo');
  assert.equal(p.dados.cobras[0].cargas, CARGAS - 1);
  assert.match(p.celular[0].texto, /Turbo: 2/);
  for (let n = 2; n <= 5; n++) {            // volta os dois para a largada, com a arena limpa, para a rodada nao acabar
    Object.assign(p.dados.cobras[0], { x: -8, z: -7 + n * 0.5 }); Object.assign(p.dados.cobras[1], { x: 8, z: 6.5 - n * 0.5 });
    p.dados.trilhas = p.dados.cobras.map(c => [{ x: c.x, z: c.z }]);
    entrada(p, 0, { x: 0, y: 0, n }); roda(p, 1.1);
  }
  assert.equal(p.vencedor, undefined);
  assert.equal(p.dados.cobras[0].cargas, 0, 'nunca fica negativo');
});

test('cobras: a cerca da borda elimina, e os dois no mesmo quadro empatam', () => {
  const p = partidaCom(jogo);
  roda(p, 6);
  assert.equal(p.vencedor, -1);
  assert.ok(!p.jogadores[0].vivo && !p.jogadores[1].vivo);
});

test('cobras: de frente um para o outro, empate', () => {
  const p = partidaCom(jogo);
  p.dados.cobras[0].z = p.dados.cobras[1].z = 0;
  roda(p, 3);
  assert.equal(p.vencedor, -1);
});

test('cobras: no limite de tempo com os dois vivos, empate', () => {
  const p = partidaCom(jogo);
  p.t = LIMITE;
  passo(p, DT);
  assert.equal(p.vencedor, -1);
  assert.ok(p.jogadores[0].vivo && p.jogadores[1].vivo);
});

test('cobras: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
