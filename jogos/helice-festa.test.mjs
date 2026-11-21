import test from 'node:test';
import assert from 'node:assert/strict';
import { passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, VIDAS, T_ALTA } from './helice-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const poe = (p, i, x, z, y = 0) => Object.assign(p.jogadores[i], { x, z, y, vx: 0, vz: 0, vy: 0 });
// Derruba pelo caminho real: fora do disco o motor tira o chao e a vida cai no quadro seguinte.
function derruba(p, i) { seguros(p); poe(p, i, p.arena.raio + 3, 0); passo(p, DT); espera(p, 0.1); }
// Passa o tempo com todo mundo a salvo da barra.
function espera(p, segundos) { for (let k = 0; k < segundos * 60 && p.fase === 'jogando'; k++) { seguros(p); passo(p, DT); } }
// Poe todo mundo em pe num ponto que a barra baixa acabou de passar (ninguem pula, ninguem apanha).
function seguros(p) {
  p.jogadores.forEach((j, i) => {
    if (!j.vivo) return;
    const a = p.dados.ang - 0.9 + (i % 2) * Math.PI, r = 2 + (i >> 1) * 1.8;
    poe(p, i, Math.cos(a) * r, Math.sin(a) * r);
  });
}
const ateOFim = p => espera(p, 60);

test('helice-festa: contrato da festa, tempo, rotulo e genero', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.duracao, TEMPO);
  assert.equal(jogo.rotulo, 'vidas');
  assert.equal(jogo.genero, 'equilibrio');
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('helice-festa: comeca com 2, 3 e 4, cada um com 3 vidas, e parado ninguem apanha no primeiro segundo', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(d.vidas, Array(o.n).fill(VIDAS));
    assert.deepEqual(d.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    assert.equal(p.arena.parede, false);
    roda(p, 1);
    assert.ok(d.tonto.every(t => t === 0), 'ninguem apanhou em 1 s');
    assert.ok(p.jogadores.every(j => j.vivo));
  }
});

test('helice-festa: a barra baixa arremessa quem esta no chao e poupa quem pulou', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  roda(p, 0.5);
  poe(p, 2, 0, 3);       // longe da barra (que vai estar no eixo x)
  d.ang = 0;
  poe(p, 0, 4, 0);
  poe(p, 1, -4, 0, 1.1);
  passo(p, DT);
  const [a, b] = p.jogadores;
  assert.ok(Math.hypot(a.vx, a.vz) > 5, 'quem estava no chao foi arremessado');
  assert.ok(d.tonto[0] > 0, 'e ficou tonto');
  assert.ok(Math.hypot(b.vx, b.vz) < 1, 'quem pulou passou por cima');
  assert.equal(d.tonto[1], 0);
});

test('helice-festa: a barra alta so entra depois e pega quem esta no ar, nao quem esta no chao', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  const noBraco = (i, y) => { const a = d.ang + Math.PI / 2; poe(p, i, Math.cos(a) * 4, Math.sin(a) * 4, y); };
  roda(p, 2);
  noBraco(0, 1.2); poe(p, 1, 0, 0);
  passo(p, DT);
  assert.equal(d.tonto[0], 0, 'antes da hora a barra alta nao existe');
  p.t = T_ALTA + 1;
  noBraco(0, 1.2);
  passo(p, DT);
  assert.ok(d.tonto[0] > 0, 'no ar: apanhou da barra alta');
  assert.ok(Math.hypot(p.jogadores[0].vx, p.jogadores[0].vz) > 5);
  d.tonto[1] = 0; d.imune[1] = 0;
  noBraco(1, 0);
  passo(p, DT);
  assert.equal(d.tonto[1], 0, 'no chao: a barra alta passa por cima');
});

test('helice-festa: quem cai perde 1 vida e volta 2 s depois perto do centro, protegido', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  derruba(p, 1);
  assert.deepEqual(d.vidas, [3, 2, 3]);
  assert.equal(p.jogadores[1].vivo, false);
  assert.equal(p.fase, 'jogando');
  assert.match(p.celular[1].texto, /^Caiu! Volta em [12] s$/);
  const j = p.jogadores[1];
  espera(p, 1.7);
  assert.equal(j.vivo, false, 'ainda nao passaram 2 s');
  for (let k = 0; k < 40 && !j.vivo; k++) passo(p, DT);
  assert.equal(j.vivo, true);
  assert.ok(Math.hypot(j.x, j.z) < 4.5, 'perto do centro');
  assert.ok(d.imune[1] > 0, 'protegido ao voltar');
  assert.match(p.celular[1].texto, /^Vidas: 2\./);
});

test('helice-festa: sem vidas nao volta e o ultimo de pe vence (vs)', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  for (let k = 0; k < 3; k++) { derruba(p, 0); espera(p, 2.2); }
  assert.equal(p.dados.vidas[0], 0);
  assert.equal(p.jogadores[0].vivo, false);
  assert.equal(p.fase, 'jogando');
  for (let k = 0; k < 3; k++) { derruba(p, 1); espera(p, 2.2); }
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  assert.match(p.dados.aviso, /venceu!$/);
});

test('helice-festa: em times as vidas somam e o time so perde quando os dois ficam sem vida', () => {
  const p = partidaCom(jogo, undefined, times);
  const tira = i => { for (let k = 0; k < 3; k++) { derruba(p, i); espera(p, 2.2); } };
  tira(1);
  assert.equal(p.fase, 'jogando', 'o J4 ainda segura o time B');
  assert.deepEqual(p.dados.placar, [6, 3]);
  tira(3);
  assert.equal(p.vencedor, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('helice-festa: no fim do tempo vence quem tem mais vidas (vs e times) e vidas iguais empatam', () => {
  let p = partidaCom(jogo, undefined, vs(3));
  derruba(p, 0); derruba(p, 2);
  ateOFim(p);
  assert.equal(p.vencedor, 1);
  p = partidaCom(jogo, undefined, times);
  derruba(p, 0);
  ateOFim(p);
  assert.equal(p.vencedor, 1, 'time B com 6 vidas contra 5');
  p = partidaCom(jogo, undefined, vs(4));
  ateOFim(p);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
});

test('helice-festa: a barra acelera, mas nunca passa do limite em que ainda da para pular', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  roda(p, 3); const v3 = d.vel;
  p.t = 30; passo(p, DT); const v30 = d.vel;
  p.t = 44; passo(p, DT);
  assert.ok(v3 < v30 && v30 <= d.vel);
  assert.ok(d.vel <= 3.01, 'limite: ' + d.vel);
});

test('helice-festa: parados, a barra tira vida de alguem antes do tempo acabar', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  roda(p, 30);
  assert.ok(p.dados.vidas.some(v => v < VIDAS), 'vidas: ' + p.dados.vidas);
});

test('helice-festa: textos sem travessao, caixa alta crua, undefined ou NaN', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.b];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    const junta = () => todos.push(p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta(); derruba(p, 0); junta();
    p.t = T_ALTA; passo(p, DT); junta();
    ateOFim(p); junta();
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('helice-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('helice-festa: dedos aleatorios terminam em ate 50 s', () => {
  for (const o of COMBOS) { const { segundos } = rodada(jogo, aleatorio, 5, o); assert.ok(segundos <= 50, 'durou ' + segundos); }
});
