import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { intervalo, calor, achou } from './detector.mjs';

// poe o jogador i em (x, z) e o tesouro em (tx, tz); o outro fica longe, no canto
function cena(i, x, z, tx, tz) {
  const p = partidaCom(jogo);
  Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
  Object.assign(p.jogadores[1 - i], { x: -7, z: -4, vx: 0, vz: 0 });
  p.dados.tesouro = { x: tx, z: tz };
  entrada(p, 0, { x: 0, y: 0, n: 0 }); entrada(p, 1, { x: 0, y: 0, n: 0 });
  return p;
}
function cava(p, i) { entrada(p, i, { x: 0, y: 0, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); }

test('detector: o intervalo entre vibracoes cresce com a distancia', () => {
  assert.ok(intervalo(0) < 0.2, 'em cima: varias por segundo');
  assert.ok(intervalo(3) > intervalo(1));
  assert.equal(intervalo(15), 2, 'longe: uma a cada 2 s');
});

test('detector: o celular de quem esta perto vibra bem mais que o de quem esta longe', () => {
  const p = cena(0, 3, 3, 3, 3);
  Object.assign(p.jogadores[1], { x: -6, z: -5 });
  roda(p, 3);
  const [perto, longe] = [p.celular[0].vibra, p.celular[1].vibra];
  assert.ok(perto >= 12, 'em cima vibrou ' + perto);
  assert.ok(longe >= 1 && longe <= 3, 'longe vibrou ' + longe);
  assert.match(p.celular[0].texto, /CAVAR/, 'o texto do celular continua');
});

test('detector: cavar em cima do tesouro marca ponto e sorteia outro', () => {
  const p = cena(1, 2, -1, 2.6, -1);
  cava(p, 1);
  assert.ok(p.dados.cava[1] > 0, 'comecou a cavar');
  assert.deepEqual(p.dados.placar, [0, 0], 'so marca quando termina de cavar');
  roda(p, 1);
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.dados.baus.length, 1, 'o bau sobe');
  assert.equal(p.dados.buracos.length, 1);
  const t = p.dados.tesouro;
  assert.ok(Math.hypot(t.x - 2.6, t.z + 1) >= 1.3, 'o novo tesouro esta em outro lugar');
  assert.ok(Math.hypot(t.x, t.z) <= 6.8 + 1e-9, 'e dentro da arena');
});

test('detector: cavar longe so deixa o buraco', () => {
  const p = cena(0, 0, 0, 4, 0);
  cava(p, 0);
  roda(p, 1);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.equal(p.dados.buracos.length, 1);
  assert.deepEqual(p.dados.tesouro, { x: 4, z: 0 }, 'o tesouro continua la');
});

test('detector: cavando o boneco fica parado, e apertar de novo nao recomeca', () => {
  const p = cena(0, 1, 1, 6, 0);
  cava(p, 0);
  for (let k = 0; k < 24; k++) { entrada(p, 0, { x: 1, y: 0, n: p.jogadores[0].n + (k === 5 ? 1 : 0) }); passo(p, DT); }
  assert.ok(Math.abs(p.jogadores[0].x - 1) < 1e-9 && Math.abs(p.jogadores[0].z - 1) < 1e-9, 'nao saiu do lugar');
  for (let k = 0; k < 40; k++) { entrada(p, 0, { x: 1, y: 0, n: p.jogadores[0].n }); passo(p, DT); }
  assert.equal(p.dados.buracos.length, 1, 'um buraco so');
  assert.ok(p.jogadores[0].x > 1.5, 'depois de cavar volta a andar');
});

test('detector: o terceiro tesouro vence na hora', () => {
  const p = cena(1, 0, 3, 0, 3);
  p.dados.placar = [2, 2];
  cava(p, 1);
  roda(p, 1);
  assert.equal(p.vencedor, 1);
});

test('detector: aos 50 s vence o maior placar', () => {
  let p = partidaCom(jogo);
  roda(p, 49);
  assert.equal(p.fase, 'jogando');
  p = partidaCom(jogo);
  p.dados.placar = [1, 2];
  roda(p, 50.2);
  assert.equal(p.vencedor, 1);
});

test('detector: empatado aos 50 s vale o proximo tesouro; sem achar ate 60 s, empate', () => {
  const p = cena(0, 3, 3, 3, 3);
  roda(p, 51);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.dados.aviso, 'Morte súbita!');
  cava(p, 0); roda(p, 1);
  assert.deepEqual(p.dados.placar, [1, 0]);
  assert.equal(p.vencedor, 0);
  const q = partidaCom(jogo);
  roda(q, 59);
  assert.equal(q.fase, 'jogando');
  roda(q, 2);
  assert.equal(q.vencedor, -1);
});

test('detector: sem ninguem achar, o buraco que acha o tesouro fica maior ate 3 m', () => {
  assert.equal(achou({ sem: 5 }), 1.3);
  assert.ok(achou({ sem: 20 }) > 1.9 && achou({ sem: 20 }) < 2.2);
  assert.ok(Math.abs(achou({ sem: 100 }) - 3) < 1e-9);
  const p = cena(0, 0, 0, 2.4, 0);
  p.dados.sem = 26;
  cava(p, 0); roda(p, 1);
  assert.deepEqual(p.dados.placar, [1, 0], 'a 2,4 m ja acha depois de 20 s sem tesouro');
  assert.equal(p.dados.sem < 1.5, true, 'o raio volta ao normal depois de achar');
});

test('detector: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});

test('detector: sem vibracao tambem da para saber (o celular escreve QUENTE, MORNO ou FRIO e calor() cresce ao chegar perto)', () => {
  assert.ok(calor(0) === 1 && calor(2) > calor(5) && calor(5) > calor(9) && calor(30) === 0);
  const p = cena(0, 3, 3, 3, 3);
  Object.assign(p.jogadores[1], { x: -6, z: -5 });
  roda(p, 0.2);
  assert.match(p.celular[0].texto, /Quente/);
  assert.match(p.celular[1].texto, /Frio/);
  assert.match(p.celular[0].texto, /CAVAR/);
  p.jogadores[0].x = -3; p.jogadores[0].z = -3;
  roda(p, 0.2);
  assert.match(p.celular[0].texto, /Morno|Frio/, 'longe do tesouro o texto esfria');
});
