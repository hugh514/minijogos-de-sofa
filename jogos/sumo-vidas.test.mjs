import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, DT } from '../jogos/_teste.mjs';
import jogo from './sumo-vidas.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
// Joga o jogador i para fora da arena pelo caminho real: o motor tira o chao dele e a vida cai no quadro seguinte.
function derruba(p, i) { Object.assign(p.jogadores[i], { x: p.arena.raio + 3, z: 0, vx: 0, vz: 0 }); roda(p, 0.1); }
function segura(p, i, x = 0, z = 0) { Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 }); }

test('sumo-vidas: contrato da festa, tempo de 20 a 50 s e rotulo do placar', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.rotulo, 'vidas');
});

test('sumo-vidas: cada um comeca com 3 vidas, em roda, e a arena fora da borda derruba', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  assert.deepEqual(p.dados.vidas, [3, 3, 3, 3]);
  assert.deepEqual(p.dados.placar, [3, 3, 3, 3]);
  assert.equal(p.arena.parede, false, 'sem parede: quem sai cai');
  for (const j of p.jogadores) assert.ok(Math.abs(Math.hypot(j.x, j.z) - 5) < 0.2, 'roda de raio 5');
});

test('sumo-vidas: quem cai perde 1 vida, nao e eliminado e volta 2 s depois no centro', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  derruba(p, 1);
  assert.equal(p.jogadores[1].vivo, false);
  assert.deepEqual(p.dados.vidas, [3, 2, 3]);
  assert.equal(p.fase, 'jogando', 'a primeira queda nao acaba a rodada');
  roda(p, 1.7);
  assert.equal(p.jogadores[1].vivo, false, 'ainda nao passaram 2 s');
  roda(p, 0.5);
  const j = p.jogadores[1];
  assert.equal(j.vivo, true);
  assert.ok(Math.hypot(j.x, j.z) < 2.5, 'voltou perto do centro: ' + Math.hypot(j.x, j.z));
  assert.equal(j.y, 0);
  assert.equal(j.vy, 0);
  assert.deepEqual(p.dados.vidas, [3, 2, 3]);
});

test('sumo-vidas: sem vida nao volta, e o ultimo com vida vence na hora (vs)', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  for (let k = 0; k < 3; k++) { derruba(p, 0); roda(p, 2.2); if (k < 2) assert.equal(p.jogadores[0].vivo, true); }
  assert.equal(p.dados.vidas[0], 0);
  assert.equal(p.jogadores[0].vivo, false, 'sem vidas fica fora');
  assert.equal(p.fase, 'jogando', 'ainda ha dois com vida');
  for (let k = 0; k < 3; k++) { derruba(p, 2); if (k < 2) roda(p, 2.2); }
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1, 'o jogador 2 sobrou');
  assert.equal(p.jogadores[1].pontos, 1);
});

test('sumo-vidas: nenhum empurrao no comeco acaba a rodada antes de 5 s', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  derruba(p, 0);
  roda(p, 2.2); derruba(p, 0);
  assert.equal(p.fase, 'jogando', 'duas vidas perdidas ainda nao decidem');
  assert.ok(p.t < 5);
});

test('sumo-vidas: em times o time so perde quando os dois ficam sem vida', () => {
  const p = partidaCom(jogo, undefined, times);
  for (let k = 0; k < 3; k++) { derruba(p, 1); roda(p, 2.2); }       // J2 (time B) sem vidas
  assert.equal(p.dados.vidas[1], 0);
  assert.equal(p.fase, 'jogando', 'o J4 ainda segura o time B');
  assert.deepEqual(p.dados.placar, [6, 3], 'placar em times soma as vidas do time');
  for (let k = 0; k < 3; k++) { derruba(p, 3); if (k < 2) roda(p, 2.2); }
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 0, 'time A (J1 + J3)');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('sumo-vidas: no fim do tempo vence quem tem mais vidas', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  derruba(p, 0); roda(p, 2.2);
  derruba(p, 2); roda(p, 2.2);
  for (let s = 0; s < 60 * 50 && p.fase === 'jogando'; s++) { p.jogadores.forEach((q, i) => { if (q.vivo) segura(p, i, i - 1, 0); }); passo(p, DT); }
  assert.equal(p.fase, 'resultado');
  assert.ok(p.t < 1, 'acabou no quadro certo');
  assert.equal(p.vencedor, 1, 'o jogador 2 manteve as 3 vidas');
});

test('sumo-vidas: empate de vidas no fim do tempo da -1', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  roda(p, jogo.duracao + 1);
  assert.equal(p.vencedor, -1);
});

test('sumo-vidas: em times soma as vidas no fim do tempo', () => {
  const p = partidaCom(jogo, undefined, times);
  derruba(p, 0); roda(p, 2.2);
  derruba(p, 1); roda(p, 2.2);
  derruba(p, 1); roda(p, 2.2);
  for (let s = 0; s < 60 * 50 && p.fase === 'jogando'; s++) { p.jogadores.forEach((q, i) => { if (q.vivo) segura(p, i, (i - 1.5) * 1.5, 0); }); passo(p, DT); }
  assert.equal(p.vencedor, 0, 'time A perdeu 1 vida e o B perdeu 2');
});

test('sumo-vidas: a arena encolhe devagar ate um minimo que ainda cabe todo mundo', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  const r0 = p.arena.raio;
  roda(p, 4);
  assert.equal(p.arena.raio, r0, 'nao encolhe nos primeiros segundos');
  roda(p, 10);
  assert.ok(p.arena.raio < r0 && p.arena.raio > r0 - 2, 'encolhe devagar: ' + p.arena.raio);
  for (let k = 0; k < 60 * 40 && p.fase === 'jogando'; k++) passo(p, DT);       // so a rodada: a seguinte pode ser outro minijogo
  assert.ok(p.arena.raio >= 4.5, 'minimo de 4,5: ' + p.arena.raio);
});

test('sumo-vidas: o celular repete as vidas e avisa quando volta', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  passo(p, DT);
  assert.equal(p.celular[0].texto, 'Vidas: 3');
  derruba(p, 1);
  assert.match(p.celular[1].texto, /^Caiu! Volta em [12] s$/);
  roda(p, 2.2);
  assert.equal(p.celular[1].texto, 'Vidas: 2');
});

test('sumo-vidas: toque de botao nao quebra nada e o motor mantem o empurrao', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  entrada(p, 0, { x: 1, y: 0, d: false, n: 0 });
  entrada(p, 0, { x: 1, y: 0, d: true, n: 1 });
  roda(p, 1);
  assert.ok(p.jogadores[0].empurroes >= 1);
});

test('sumo-vidas: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const vencedores = fumaca(jogo, o);
    assert.equal(vencedores.length, 15);
  }
});

test('sumo-vidas: rodada de dedos aleatorios sempre termina em ate 50 s', () => {
  const { segundos } = rodada(jogo, undefined, 3, vs(4));
  assert.ok(segundos <= 50, 'durou ' + segundos);
});
