import test from 'node:test';
import assert from 'node:assert/strict';
import { passo } from '../logica.mjs';
import { partidaCom, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, META } from './colina-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
// Um quadro por vez: quem esta em "dentro" fica na zona (lado a lado, sem encostar) e os outros em fila do lado de fora, para o lado do centro da arena.
function segura(p, dentro, segundos) {
  for (let k = 0; k < segundos * 60 && p.fase === 'jogando'; k++) {
    const z = p.dados.zona, m = Math.hypot(z.x, z.z), lado = m > 0.1 ? [-z.x / m, -z.z / m] : [1, 0];
    let fila = 0;
    p.jogadores.forEach((_, i) => {
      const pos = dentro.indexOf(i);
      if (pos >= 0) poe(p, i, z.x + (pos - (dentro.length - 1) / 2) * 1.8 * lado[1], z.z - (pos - (dentro.length - 1) / 2) * 1.8 * lado[0]);
      else { const dist = z.r + 1.5 + fila++ * 1.8; poe(p, i, z.x + lado[0] * dist, z.z + lado[1] * dist); }
    });
    passo(p, DT);
  }
}

test('colina-festa: contrato da festa, tempo, rotulo e genero', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.duracao, TEMPO);
  assert.equal(jogo.genero, 'empurra');
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('colina-festa: comeca com 2, 3 e 4, placar zerado, todos fora da zona e a mesma distancia dela', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(d.placar, Array(o.modo === 'times' ? 2 : o.n).fill(0));
    const dist = p.jogadores.map(j => Math.hypot(j.x - d.zona.x, j.z - d.zona.z));
    assert.ok(dist.every(v => v > d.zona.r + 1 && Math.abs(v - dist[0]) < 0.3), 'largada justa: ' + dist);
  }
});

test('colina-festa: sozinho na zona soma segundos; com um rival dentro ninguem soma', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  segura(p, [1], 2);
  assert.ok(Math.abs(d.placar[1] - 2) < 0.1, 'somou 2 s: ' + d.placar);
  assert.equal(d.placar[0], 0); assert.equal(d.placar[2], 0);
  assert.equal(d.dono, 1);
  assert.match(p.celular[1].texto, /somando/);
  segura(p, [1, 2], 1);
  assert.ok(Math.abs(d.placar[1] - 2) < 0.1, 'disputada: parou de somar');
  assert.equal(d.placar[2], 0);
  assert.equal(d.dono, -1);
  assert.equal(d.disputa, true);
  assert.match(p.celular[2].texto, /[Dd]isputa/);
});

test('colina-festa: em times dois do mesmo time na zona somam para o time (uma vez so); com rival dentro, nada', () => {
  const p = partidaCom(jogo, undefined, times), d = p.dados;
  segura(p, [0, 2], 2);
  assert.ok(Math.abs(d.placar[0] - 2) < 0.1, 'time A somou 2 s: ' + d.placar);
  assert.equal(d.placar[1], 0);
  segura(p, [0, 1], 1);
  assert.ok(Math.abs(d.placar[0] - 2) < 0.1);
  assert.equal(d.placar[1], 0);
});

test('colina-festa: a zona muda de lugar, sempre dentro da arena', () => {
  const p = partidaCom(jogo, undefined, vs(4)), d = p.dados, vistos = new Set();
  for (let k = 0; k < 30 * 60; k++) {
    passo(p, DT);
    assert.ok(Math.hypot(d.zona.x, d.zona.z) + d.zona.r <= p.arena.raio + 1e-6, 'zona dentro da arena');
    vistos.add(Math.round(d.zona.x) + ',' + Math.round(d.zona.z));
  }
  assert.ok(d.trocas >= 4, 'trocou ' + d.trocas + ' vezes em 30 s');
  assert.ok(vistos.size > 6);
});

test('colina-festa: quem chega a meta vence na hora (vs e times)', () => {
  let p = partidaCom(jogo, undefined, vs(4));
  segura(p, [2], META + 1);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 1, 0]);
  assert.match(p.dados.aviso, /venceu!$/);
  assert.equal(p.celular[2].texto, 'Você venceu!');
  p = partidaCom(jogo, undefined, times);
  segura(p, [3], META + 1);
  assert.equal(p.vencedor, 1, 'devolve o time, nao o jogador');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('colina-festa: no fim do tempo vence quem tem mais segundos; ninguem na zona da empate', () => {
  let p = partidaCom(jogo, undefined, vs(3));
  segura(p, [0], 3); segura(p, [2], 5); segura(p, [], TEMPO);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  p = partidaCom(jogo, undefined, times);
  segura(p, [1], 4); segura(p, [0], 2); segura(p, [], TEMPO);
  assert.equal(p.vencedor, 1);
  p = partidaCom(jogo, undefined, vs(4));
  segura(p, [], TEMPO + 1);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
});

test('colina-festa: textos sem travessao, caixa alta crua, undefined ou NaN', () => {
  const todos = [jogo.nome, jogo.dica];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    const junta = () => todos.push(p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta(); segura(p, [0], 1); junta(); segura(p, [0, 1], 1); junta(); segura(p, [1], META + 1); junta();
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('colina-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('colina-festa: dedos aleatorios terminam em ate 50 s', () => {
  for (const o of COMBOS) { const { segundos } = rodada(jogo, aleatorio, 5, o); assert.ok(segundos <= 50, 'durou ' + segundos); }
});
