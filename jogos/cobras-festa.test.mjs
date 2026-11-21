import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { LX, LZ, LIMITE, QUEDAS, CARGAS, T_LARGADA, T_FIM_QUEDA } from './cobras-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const textos = p => [p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? '')];
const larga = p => roda(p, T_LARGADA + 0.05);                                       // passa a contagem da largada
const proxima = p => roda(p, T_FIM_QUEDA + T_LARGADA + 0.1);                        // fim da queda + largada da seguinte
// Joga os jogadores da lista na cerca no mesmo quadro.
const mata = (p, ...lista) => { for (const i of lista) if (p.dados.cobras[i]) p.dados.cobras[i].x = LX + 1; passo(p, DT); };
const ateFim = p => { for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT); };

test('cobras-festa: contrato da festa, tempo, rotulo e genero', () => {
  assert.equal(jogo.id, 'cobras-festa');
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, LIMITE);
  assert.ok(LIMITE >= 20 && LIMITE <= 50);
  assert.equal(QUEDAS, 2, 'melhor de 3 quedas');
  assert.equal(jogo.genero, 'reflexo');
  assert.notEqual(jogo.controle.a, jogo.controle.b);
});

test('cobras-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel, e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a, jogo.controle.b];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    todos.push(...textos(p));
    larga(p); todos.push(...textos(p));
    mata(p, 1); todos.push(...textos(p));
    mata(p, 0, 2, 3); todos.push(...textos(p));
    proxima(p); todos.push(...textos(p));
    ateFim(p); todos.push(...textos(p));
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('cobras-festa: com 2, 3 e 4 cada um larga numa linha propria, longe dos outros, e espera a largada', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.equal(d.cobras.length, o.n); assert.equal(d.trilhas.length, o.n);
    assert.deepEqual(d.placar, Array(o.modo === 'times' ? 2 : o.n).fill(0));
    p.jogadores.forEach((j, i) => {
      assert.ok(Math.abs(j.x) < LX - 1 && Math.abs(j.z) < LZ - 1, 'dentro da arena');
      for (let k = 0; k < i; k++) {
        assert.ok(Math.hypot(j.x - p.jogadores[k].x, j.z - p.jogadores[k].z) > 3, 'longe dos outros');
        assert.ok(Math.abs(j.z - p.jogadores[k].z) > 3, 'cada um na sua linha: ninguem larga de frente para outro');
      }
      assert.equal(d.cobras[i].cargas, CARGAS);
    });
    const x0 = p.jogadores.map(j => j.x);
    roda(p, T_LARGADA - 0.2);
    assert.deepEqual(p.jogadores.map(j => j.x), x0, 'ninguem anda antes da largada');
    roda(p, 1);
    p.jogadores.forEach((j, i) => assert.ok(Math.abs(j.x - x0[i]) > 1, 'depois todos andam sozinhos'));
    assert.ok(p.jogadores.every(j => j.vivo));
  }
  const p = partidaCom(jogo, undefined, times);
  assert.ok(p.jogadores[0].x < 0 && p.jogadores[2].x < 0 && p.jogadores[1].x > 0 && p.jogadores[3].x > 0, 'em times cada dupla larga de um lado');
});

test('cobras-festa: o joystick so vira e o rastro fica na arena', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  larga(p);
  const z0 = p.jogadores[0].z;
  for (let k = 0; k < 60; k++) { entrada(p, 0, { x: 0, y: 1 }); passo(p, DT); }
  assert.ok(p.jogadores[0].z > z0 + 1, 'virou para baixo');
  assert.ok(d.trilhas[0].length > 5, 'deixou rastro');
});

test('cobras-festa: bater no rastro de outro tira da queda, vibra e quem sobrou leva a queda', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  larga(p);
  d.trilhas[1] = [{ x: -5, z: -8 }, { x: -5, z: 8 }, { x: 9, z: 7 }];        // um rastro do J2 atravessado na frente do J1
  const v0 = p.celular[0].vibra ?? 0;
  for (let k = 0; k < 180 && p.jogadores[0].vivo; k++) passo(p, DT);
  assert.equal(p.jogadores[0].vivo, false);
  assert.ok(Math.abs(d.cobras[0].x + 5) < 0.6, 'bateu no rastro: ' + d.cobras[0].x);
  assert.equal(p.celular[0].vibra, v0 + 1);
  assert.match(p.celular[0].texto, /bateu/);
  assert.deepEqual(d.placar, [0, 1]);
  assert.match(d.aviso, /venceu a queda/);
  assert.equal(p.fase, 'jogando', 'melhor de 3: uma queda nao decide');
});

test('cobras-festa: o pulo (B, 1 por queda) passa por cima do rastro e o turbo (A) gasta carga', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  larga(p);
  d.trilhas[1] = [{ x: -5, z: -8 }, { x: -5, z: 8 }, { x: 9, z: 7 }];
  entrada(p, 0, { x: 0, y: 0, b: false, nb: 0, d: false, n: 0 });
  let pulou = false;
  for (let k = 0; k < 240 && d.cobras[0].x < -3; k++) {
    if (!pulou && d.cobras[0].x > -5.7) { entrada(p, 0, { x: 0, y: 0, b: true, nb: 1, n: 0 }); pulou = true; }
    passo(p, DT);
  }
  assert.equal(p.jogadores[0].vivo, true, 'passou por cima');
  assert.equal(d.cobras[0].pulos, 0);
  const x0 = d.cobras[0].x, x1 = d.cobras[1].x;
  entrada(p, 0, { x: 0, y: 0, d: true, n: 1, nb: 1 });
  roda(p, 0.5);
  assert.equal(d.cobras[0].cargas, CARGAS - 1);
  assert.ok(d.cobras[0].x - x0 > (x1 - d.cobras[1].x) * 1.3, 'turbo anda mais');
  assert.match(p.celular[0].texto, /Turbo: 2/);
});

test('cobras-festa: bater na cerca tira da queda; a queda seguinte recomeca com todos e cargas novas', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  larga(p);
  d.cobras[0].cargas = 0;
  mata(p, 1);
  assert.equal(p.jogadores[1].vivo, false);
  assert.deepEqual(d.placar, [0, 0, 0], 'ainda ha dois: a queda segue');
  mata(p, 2);
  assert.deepEqual(d.placar, [1, 0, 0]);
  proxima(p);
  assert.ok(p.jogadores.every(j => j.vivo), 'todos de volta');
  assert.equal(d.queda, 2);
  assert.equal(d.cobras[0].cargas, CARGAS);
  assert.ok(d.trilhas.every(t => t.length < 5), 'rastros limpos');
});

test('cobras-festa: em vs vence quem leva 2 quedas', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = partidaCom(jogo, undefined, vs(n)), outros = [...Array(n).keys()].filter(i => i !== w);
    larga(p); mata(p, ...outros);
    assert.equal(p.fase, 'jogando');
    proxima(p); mata(p, ...outros);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, w, `n ${n}`);
    assert.equal(p.jogadores[w].pontos, 1);
    assert.match(p.dados.aviso, /venceu/);
  }
});

test('cobras-festa: em times a queda e da dupla que ainda tem alguem, e os dois pontuam', () => {
  const p = partidaCom(jogo, undefined, times), d = p.dados;
  larga(p); mata(p, 1);
  assert.deepEqual(d.placar, [0, 0], 'J4 ainda segura a dupla B');
  mata(p, 0); assert.deepEqual(d.placar, [0, 0]);
  mata(p, 3);
  assert.deepEqual(d.placar, [1, 0]);
  proxima(p); mata(p, 1, 3);
  assert.equal(p.vencedor, 0, 'o time, nunca o indice');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  const q = partidaCom(jogo, undefined, times);
  larga(q); mata(q, 0, 2); proxima(q); mata(q, 0, 2);
  assert.equal(q.vencedor, 1);
});

test('cobras-festa: no fim do tempo vence quem tem mais quedas', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  larga(p); mata(p, 0, 1);
  p.t = LIMITE - 0.3;
  roda(p, 0.5);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
});

test('cobras-festa: empate da -1 (os ultimos batem juntos e ninguem leva a queda; tempo com quedas iguais)', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  larga(p); mata(p, 0, 1, 2);
  assert.deepEqual(d.placar, [0, 0, 0]);
  assert.match(d.aviso, /Ninguém/);
  for (const o of COMBOS) {
    const q = partidaCom(jogo, undefined, o);
    ateFim(q);                                        // parados, todos batem na cerca no mesmo quadro, queda apos queda
    assert.equal(q.vencedor, -1, JSON.stringify(o));
    assert.match(q.dados.aviso, /Empate/);
  }
});

test('cobras-festa: de frente um no outro, os dois batem', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  larga(p);
  Object.assign(d.cobras[0], { x: -1, z: 0, ang: 0 }); Object.assign(d.cobras[1], { x: 1, z: 0, ang: Math.PI });
  d.trilhas[0] = [{ x: -1, z: 0 }]; d.trilhas[1] = [{ x: 1, z: 0 }];
  roda(p, 0.3);
  assert.equal(p.jogadores[0].vivo, false); assert.equal(p.jogadores[1].vivo, false);
  assert.deepEqual(d.placar, [0, 0, 1]);
});

test('cobras-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times, sem NaN', () => {
  for (const o of COMBOS) {
    const vencedores = fumaca(jogo, o);
    assert.equal(vencedores.length, 15);
  }
});

test('cobras-festa: dedos aleatorios terminam no tempo, com placar finito', () => {
  for (const o of COMBOS) {
    const { p, segundos } = rodada(jogo, aleatorio, 5, o);
    assert.ok(segundos <= LIMITE + 0.1, 'durou ' + segundos);
    assert.ok(p.dados.placar.every(Number.isFinite));
  }
});
