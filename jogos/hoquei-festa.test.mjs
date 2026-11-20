import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, MODIFICADORES } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { LX, LZ, VIDAS, TEMPO, T_SEGUNDO } from './hoquei-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const boca = g => (g.eixo === 'x' ? { x: g.s * LX, z: g.c, nx: g.s, nz: 0 } : { x: g.c, z: g.s * LZ, nx: 0, nz: g.s });
const prende = p => { for (const b of p.dados.discos) b.pausa = 1; };       // discos parados no centro: nada de gol por acaso
// Tira todo mundo do caminho e manda o disco para dentro do gol do jogador i (ou para a parede, com desvio).
function chuta(p, i, desvio = 0) {
  const d = p.dados, m = boca(d.gols[i]);
  p.jogadores.forEach((j, k) => { if (j.vivo) Object.assign(j, { x: (k - 1.5) * 2, z: 2.5, vx: 0, vz: 0 }); });
  d.discos.length = 1;
  Object.assign(d.discos[0], { x: m.x - m.nx * 0.7 + m.nz * desvio, z: m.z - m.nz * 0.7 + m.nx * desvio, vx: m.nx * 12, vz: m.nz * 12, pausa: 0 });
  for (let k = 0; k < 12; k++) passo(p, DT);
  prende(p);
}
function ateOFim(p) { for (let k = 0; k < 60 * (TEMPO + 2) && p.fase === 'jogando'; k++) { prende(p); passo(p, DT); } }

test('hoquei-festa: contrato da festa, tempo de jogo de gol, rotulo e genero', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 55);
  assert.equal(jogo.duracao, TEMPO);
  assert.equal(jogo.rotulo, 'vidas');
  assert.equal(jogo.genero, 'gol');
  assert.equal(jogo.semPulo, true, 'pular por cima do disco estragaria a defesa (e tira a lua)');
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('hoquei-festa: comeca com 2, 3 e 4: um gol por jogador, 3 vidas, cada um na frente do seu gol', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(d.gols.length, o.n);
    assert.deepEqual(d.vidas, Array(o.n).fill(VIDAS));
    assert.deepEqual(d.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    assert.equal(d.discos.length, 1);
    d.gols.forEach((g, i) => {
      const m = boca(g), j = p.jogadores[i];
      assert.equal(g.dono, i);
      assert.ok(Math.hypot(j.x - m.x, j.z - m.z) < 3.5, 'perto do proprio gol');
      assert.ok(Math.abs(j.x) < LX && Math.abs(j.z) < LZ);
      const limite = g.eixo === 'x' ? LZ : LX;
      assert.ok(Math.abs(g.c) + g.h <= limite - 0.5, 'a boca cabe na parede, longe do canto');
      d.gols.forEach((o2, k) => { if (k > i && o2.eixo === g.eixo && o2.s === g.s) assert.ok(Math.abs(o2.c - g.c) > o2.h + g.h, 'gols da mesma parede nao se sobrepoem'); });
    });
  }
});

test('hoquei-festa: com 4 cada gol fica num lado da mesa; em times os dois gols da dupla ficam no mesmo lado', () => {
  let d = partidaCom(jogo, undefined, vs(4)).dados;
  assert.equal(new Set(d.gols.map(g => g.eixo + g.s)).size, 4);
  d = partidaCom(jogo, undefined, vs(3)).dados;
  assert.equal(new Set(d.gols.map(g => g.eixo + g.s)).size, 3);
  d = partidaCom(jogo, undefined, times).dados;
  assert.deepEqual(d.gols.map(g => g.eixo + g.s), ['x-1', 'x1', 'x-1', 'x1'], 'dupla A na esquerda, dupla B na direita');
});

test('hoquei-festa: disco no gol tira 1 vida do dono, vibra o celular dele e o disco volta ao centro', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  const antes = p.celular[2].vibra ?? 0;
  chuta(p, 2);
  assert.deepEqual(d.vidas, [3, 3, 2]);
  assert.deepEqual(d.placar, [3, 3, 2]);
  assert.equal(p.celular[2].vibra ?? 0, antes + 1);
  assert.ok(Math.hypot(d.discos[0].x, d.discos[0].z) < 0.01 && d.discos[0].pausa > 0, 'disco de volta ao centro, esperando');
  assert.match(d.aviso, /levou gol!$/);
  assert.match(p.celular[2].texto, /^Vidas: 2\./);
  assert.equal(p.fase, 'jogando');
});

test('hoquei-festa: fora da boca do gol o disco quica na parede e ninguem perde vida', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    for (let i = 0; i < o.n; i++) {
      chuta(p, i, d.gols[i].h + 0.9);
      assert.deepEqual(d.vidas, Array(o.n).fill(VIDAS), `parede ao lado do gol ${i}`);
    }
    const b = d.discos[0];
    assert.ok(Math.abs(b.x) <= LX && Math.abs(b.z) <= LZ, 'o disco nunca sai da mesa');
  }
});

test('hoquei-festa: sem vidas o gol fecha (o disco quica nele) e o dono sai', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  for (let k = 0; k < 3; k++) chuta(p, 0);
  assert.equal(d.vidas[0], 0);
  assert.equal(p.jogadores[0].vivo, false);
  assert.equal(p.fase, 'jogando', 'ainda ha dois com vida');
  assert.match(p.celular[0].texto, /saiu/);
  chuta(p, 0);
  assert.deepEqual(d.vidas, [0, 3, 3], 'gol fechado nao conta');
  assert.ok(d.discos[0].pausa > 0 || Math.abs(d.discos[0].x) < LX, 'quicou');
});

test('hoquei-festa: o ultimo com vida vence (vs devolve o indice)', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  for (let k = 0; k < 3; k++) chuta(p, 0);
  for (let k = 0; k < 3; k++) chuta(p, 2);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0]);
  assert.match(p.dados.aviso, /venceu!$/);
  assert.equal(p.celular[1].texto, 'Você venceu!');
});

test('hoquei-festa: em times as vidas somam, a dupla so perde com os dois gols fechados e o retorno e o time', () => {
  const p = partidaCom(jogo, undefined, times), d = p.dados;
  for (let k = 0; k < 3; k++) chuta(p, 1);
  assert.deepEqual(d.placar, [6, 3]);
  assert.equal(p.fase, 'jogando', 'o J4 ainda segura a dupla B');
  for (let k = 0; k < 3; k++) chuta(p, 3);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('hoquei-festa: no fim do tempo vence quem tem mais vidas (vs e times) e vidas iguais empatam', () => {
  let p = partidaCom(jogo, undefined, vs(4));
  chuta(p, 0); chuta(p, 1); chuta(p, 3); chuta(p, 3);
  ateOFim(p);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2, 'so o J3 ficou com 3');
  p = partidaCom(jogo, undefined, times);
  chuta(p, 0);
  ateOFim(p);
  assert.equal(p.vencedor, 1);
  p = partidaCom(jogo, undefined, vs(3));
  ateOFim(p);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
});

test('hoquei-festa: o segundo disco entra mais tarde', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  for (let k = 0; k < 60 * (T_SEGUNDO - 1); k++) { prende(p); passo(p, DT); }
  assert.equal(d.discos.length, 1);
  for (let k = 0; k < 90; k++) { prende(p); passo(p, DT); }
  assert.equal(d.discos.length, 2);
});

test('hoquei-festa: a tacada (empurrao do motor) bate no disco e ele anda', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados, b = d.discos[0];
  Object.assign(b, { x: 0, z: 0, vx: 0, vz: 0, pausa: 0 });
  Object.assign(p.jogadores[0], { x: -1.2, z: 0, vx: 9, vz: 0 });
  roda(p, 0.2);
  assert.ok(b.vx > 3, 'disco empurrado: ' + b.vx);
});

test('hoquei-festa: textos sem travessao, caixa alta crua, undefined ou NaN', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    const junta = () => todos.push(p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta(); chuta(p, 1); junta();
    for (let k = 0; k < 2; k++) chuta(p, 1);
    junta(); ateOFim(p); junta();
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('hoquei-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('hoquei-festa: dedos aleatorios com cada modificador permitido terminam sem NaN', () => {
  const mods = MODIFICADORES.filter(m => !(m.pulo && jogo.semPulo) && !jogo.semMod?.includes(m.id));
  assert.deepEqual(mods.map(m => m.id), ['ouro', 'gelo', 'foguete', 'espelho']);
  for (const mod of mods) for (const o of COMBOS) {
    const p = partidaCom(jogo, sorteio(7), o), rng = sorteio(3);
    p.mod = mod;
    let q = 0;
    for (; q < 60 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      for (const b of p.jogo === jogo ? p.dados.discos : []) assert.ok([b.x, b.z, b.vx, b.vz].every(Number.isFinite), 'disco invalido com ' + mod.id);
      for (const j of p.jogadores) assert.ok([j.x, j.z, j.vx, j.vz].every(Number.isFinite), 'jogador invalido com ' + mod.id);
    }
    assert.notEqual(p.fase, 'jogando', mod.id + ': nao terminou');
    assert.deepEqual(p.erros, []);
  }
});

test('hoquei-festa: dedos aleatorios terminam em ate 55 s', () => {
  for (const o of COMBOS) { const { segundos } = rodada(jogo, aleatorio, 5, o); assert.ok(segundos <= 55, 'durou ' + segundos); }
});
