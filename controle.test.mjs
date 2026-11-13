// Funcoes puras do controle (curva do joystick e qual botao esta na posicao): o teste le o trecho @puras do controle.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./controle.html', import.meta.url), 'utf8');
const trecho = html.split('// @puras')[1].split('// @fim-puras')[0].replace(/^[^\n]*\n/, '');
const { forcaJoystick, botaoNaPos, ZONA_MORTA } = new Function(`${trecho}; return { forcaJoystick, botaoNaPos, ZONA_MORTA };`)();

test('joystick: zona morta fica em zero e o fim da corrida da 1', () => {
  assert.equal(forcaJoystick(0), 0);
  assert.equal(forcaJoystick(ZONA_MORTA - 0.01), 0);
  assert.equal(forcaJoystick(1), 1);
});

test('joystick: a 20% de deflexao a forca e menor que a linear, e a curva nunca desce', () => {
  const linear = len => (len - ZONA_MORTA) / (1 - ZONA_MORTA);
  assert.ok(forcaJoystick(0.2) > 0 && forcaJoystick(0.2) < linear(0.2));
  let antes = 0;
  for (let len = 0; len <= 1.0001; len += 0.01) { const f = forcaJoystick(len); assert.ok(f >= antes - 1e-12 && f <= 1); antes = f; }
});

test('joystick: a diagonal no maximo tambem chega a 1 (mesmo calculo do mover)', () => {
  const dx = Math.SQRT1_2, dy = Math.SQRT1_2, len = Math.hypot(dx, dy);
  const k = forcaJoystick(len) / len;
  assert.ok(Math.abs(Math.hypot(dx * k, dy * k) - 1) < 1e-9);
});

test('botaoNaPos: divide pela posicao e, sem B, a area toda vale A', () => {
  const ca = { x: 300, y: 100 }, cb = { x: 100, y: 100 };
  assert.equal(botaoNaPos(290, 100, ca, cb), 'A');
  assert.equal(botaoNaPos(110, 100, ca, cb), 'B');
  assert.equal(botaoNaPos(200.1, 300, ca, cb), 'A');      // entre os dois, fora do desenho
  assert.equal(botaoNaPos(199.9, 0, ca, cb), 'B');
  assert.equal(botaoNaPos(100, 100, ca, cb, true, false), 'A');
  assert.equal(botaoNaPos(300, 100, ca, cb, false, true), 'B');
  // empilhados (em pe): B em cima, A embaixo
  assert.equal(botaoNaPos(50, 700, { x: 50, y: 700 }, { x: 50, y: 500 }), 'A');
  assert.equal(botaoNaPos(50, 450, { x: 50, y: 700 }, { x: 50, y: 500 }), 'B');
});

test('botaoNaPos: nenhum botao visivel nao devolve botao (nada conta)', () => {
  const ca = { x: 300, y: 100 }, cb = { x: 100, y: 100 };
  assert.equal(botaoNaPos(290, 100, ca, cb, false, false), null);
  assert.equal(botaoNaPos(110, 100, ca, cb, false, false, 'A'), null);
});

test('botaoNaPos: histerese, o dedo so troca de botao 18% da distancia dos centros alem da divisa', () => {
  const ca = { x: 300, y: 100 }, cb = { x: 100, y: 100 };      // divisa em x = 200, distancia 200, 18% = 36 px
  assert.equal(botaoNaPos(190, 100, ca, cb, true, true, 'A'), 'A');     // passou da divisa, mas so 10 px
  assert.equal(botaoNaPos(170, 100, ca, cb, true, true, 'A'), 'A');     // 30 px alem
  assert.equal(botaoNaPos(160, 100, ca, cb, true, true, 'A'), 'B');     // 40 px alem: troca
  assert.equal(botaoNaPos(210, 100, ca, cb, true, true, 'B'), 'B');
  assert.equal(botaoNaPos(240, 100, ca, cb, true, true, 'B'), 'A');
  // dedo esfregando na divisa nunca alterna
  let q = 'A';
  for (const x of [205, 195, 202, 198, 190, 210, 200, 185, 215]) q = botaoNaPos(x, 100, ca, cb, true, true, q);
  assert.equal(q, 'A');
  // sem atual: o mais perto, como antes
  assert.equal(botaoNaPos(199, 100, ca, cb), 'B');
});
