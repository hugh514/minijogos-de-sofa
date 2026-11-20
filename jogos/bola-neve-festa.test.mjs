import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, VIDAS } from './bola-neve-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
const bola = (j, de) => ({ x: j.x - 1, z: j.z, vx: 12, vz: 0, r: 0.7, dono: de, preso: false, vivo: true, idade: 0, bolona: false });
// Uma bola do jogador "de" nasce colada no jogador "em" e acerta no quadro seguinte.
function bolada(p, de, em) {
  p.dados.imune[em] = 0;
  p.dados.bolas.push(bola(p.jogadores[em], de));
  passo(p, DT);
}

test('bola-neve-festa: contrato da festa, tempo, rotulo e genero', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.duracao, TEMPO);
  assert.equal(jogo.rotulo, 'vidas');
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('bola-neve-festa: comeca com 2, 3 e 4, 3 vidas cada, todos separados e dentro da quadra', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados, js = p.jogadores;
    assert.equal(js.length, o.n);
    assert.deepEqual(d.vidas, Array(o.n).fill(VIDAS));
    assert.deepEqual(d.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    for (let a = 0; a < o.n; a++) {
      assert.ok(Math.abs(js[a].x) < p.arena.lx - 1 && Math.abs(js[a].z) < p.arena.lz - 1);
      for (let b = a + 1; b < o.n; b++) assert.ok(Math.hypot(js[a].x - js[b].x, js[a].z - js[b].z) > 5, 'longe um do outro');
    }
    if (o.modo === 'times') assert.ok(js[0].x < 0 && js[2].x < 0 && js[1].x > 0 && js[3].x > 0, 'duplas de lados opostos');
  }
});

test('bola-neve-festa: segurar Rolar e andar faz a bola crescer; soltar lanca', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  poe(p, 0, -9, 0); poe(p, 1, 8, 5); poe(p, 2, 8, -5);
  entrada(p, 0, { x: 1, y: 0, d: true, n: 1 });
  roda(p, 0.2);
  const b = d.preso[0];
  assert.ok(b && b.preso, 'esta rolando uma bola');
  const r0 = b.r;
  roda(p, 0.8);
  assert.ok(b.r > r0 + 0.1, 'cresceu: ' + r0 + ' -> ' + b.r);
  entrada(p, 0, { x: 1, y: 0, d: false, n: 1 });
  passo(p, DT);
  assert.equal(d.preso[0], null);
  assert.ok(!b.preso && b.vx > 8, 'lancada para a frente');
});

test('bola-neve-festa: bolada tira 1 vida, da um instante de protecao e vibra o celular de quem levou', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  const antes = p.celular[1].vibra ?? 0;
  bolada(p, 0, 1);
  assert.deepEqual(d.vidas, [3, 2, 3]);
  assert.deepEqual(d.placar, [3, 2, 3]);
  assert.equal(p.celular[1].vibra ?? 0, antes + 1);
  assert.ok(p.jogadores[1].vx > 3, 'foi empurrado');
  assert.equal(d.bolas.length, 0, 'a bola se desfez');
  d.bolas.push(bola(p.jogadores[1], 0));
  passo(p, DT);
  assert.equal(d.vidas[1], 2, 'protegido logo depois de levar');
  assert.match(p.celular[1].texto, /^Vidas: 2\./);
});

test('bola-neve-festa: a propria bola nao acerta o dono, e em times nao acerta o parceiro', () => {
  let p = partidaCom(jogo, undefined, vs(2));
  bolada(p, 0, 0);
  assert.deepEqual(p.dados.vidas, [3, 3]);
  p = partidaCom(jogo, undefined, times);
  bolada(p, 0, 2);
  assert.deepEqual(p.dados.vidas, [3, 3, 3, 3], 'parceiro nao leva');
  p.dados.bolas.length = 0;
  bolada(p, 0, 3);
  assert.deepEqual(p.dados.vidas, [3, 3, 3, 2]);
  assert.deepEqual(p.dados.placar, [6, 5]);
});

test('bola-neve-festa: sem vidas sai do jogo e o ultimo de pe vence (vs)', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  for (let k = 0; k < 3; k++) bolada(p, 1, 0);
  assert.equal(p.jogadores[0].vivo, false);
  assert.equal(p.fase, 'jogando');
  assert.match(p.celular[0].texto, /saiu/);
  for (let k = 0; k < 3; k++) bolada(p, 1, 2);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1);
  assert.match(p.dados.aviso, /venceu!$/);
  assert.equal(p.celular[1].texto, 'Você venceu!');
});

test('bola-neve-festa: em times a dupla so perde quando os dois saem, e o retorno e o time', () => {
  const p = partidaCom(jogo, undefined, times);
  for (let k = 0; k < 3; k++) bolada(p, 1, 0);
  assert.equal(p.fase, 'jogando');
  for (let k = 0; k < 3; k++) bolada(p, 3, 2);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('bola-neve-festa: no fim do tempo vence quem tem mais vidas (vs e times); vidas iguais empatam', () => {
  let p = partidaCom(jogo, undefined, vs(4));
  bolada(p, 0, 1); bolada(p, 0, 2); bolada(p, 1, 0); bolada(p, 0, 2);
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, 3, 'so o J4 ficou com 3');
  p = partidaCom(jogo, undefined, times);
  bolada(p, 1, 0);
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, 1);
  p = partidaCom(jogo, undefined, vs(3));
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
});

test('bola-neve-festa: lancar virado para o rival acerta de verdade', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  poe(p, 0, -6, 0); poe(p, 1, 0, 0); poe(p, 2, 8, 6);
  entrada(p, 0, { x: 1, y: 0, d: true, n: 1 });
  roda(p, 0.3);
  entrada(p, 0, { x: 1, y: 0, d: false, n: 1 });
  for (let k = 0; k < 90 && d.vidas[1] === 3; k++) { poe(p, 1, 0, 0); passo(p, DT); }
  assert.equal(d.vidas[1], 2);
});

test('bola-neve-festa: textos sem travessao, caixa alta crua, undefined ou NaN', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    const junta = () => todos.push(p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta(); bolada(p, 0, 1); junta();
    for (let k = 0; k < 2; k++) bolada(p, 0, 1);
    junta();
    roda(p, TEMPO + 1); junta();
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('bola-neve-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('bola-neve-festa: dedos aleatorios terminam em ate 50 s', () => {
  for (const o of COMBOS) { const { segundos } = rodada(jogo, aleatorio, 5, o); assert.ok(segundos <= 50, 'durou ' + segundos); }
});
