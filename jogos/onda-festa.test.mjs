import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo, MODIFICADORES } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, contexto, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, VIDAS, DIST } from './onda-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];

// Partida sem os anéis sorteados: o teste solta os que quiser.
function nova(o) {
  const p = partidaCom(jogo, undefined, o);
  p.dados.prox = Infinity;
  return p;
}
function pula(p, i) {
  if (p.jogadores[i].nb === undefined) entrada(p, i, { x: 0, y: 0, nb: 0 });
  entrada(p, i, { x: 0, y: 0, nb: p.jogadores[i].nb + 1 });
}
// Um anel que chega aos jogadores (todos à mesma distância do centro) em 0,3 s; quem está em "pulam" pula agora, no tempo certo.
// Cada um volta para o lugar antes, para o empurrão do golpe anterior não mudar a conta.
function anel(p, alta, pulam = []) {
  const d = p.dados, n = p.jogadores.length;
  p.jogadores.forEach((j, i) => {
    if (!j.vivo) return;
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    Object.assign(j, { x: Math.cos(a) * DIST, z: Math.sin(a) * DIST, y: 0, vx: 0, vy: 0, vz: 0 });
  });
  d.imune = d.imune.map(() => 0);
  d.ondas.push({ r: DIST - 1.78, v: 5, alta });
  for (const i of pulam) if (p.jogadores[i].vivo) pula(p, i);
  roda(p, 0.9);
}
const todosMenos = (p, fora) => [...p.jogadores.keys()].filter(i => !fora.includes(i));
function ateOFim(p) { for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT); }

test('onda-festa: contrato da festa, tempo de 20 a 50 s, joystick com Empurra e Pula, sem lua e sem a carta Mola', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, TEMPO);
  assert.ok(TEMPO >= 20 && TEMPO <= 50);
  assert.equal(jogo.genero, 'ritmo');
  assert.equal(jogo.rotulo, 'vidas');
  assert.deepEqual(jogo.controle, { modo: 'padrao', a: 'Empurra', b: 'Pula' });
  assert.deepEqual(jogo.semMod, ['lua'], 'na lua o pulo dura 2 s e o anel alto pega sempre');
  assert.deepEqual(jogo.semCarta, ['pulo'], 'a Mola alonga o pulo e muda a regra só para um');
});

test('onda-festa: começa com 3 vidas para cada um, todos em roda à mesma distância do centro', () => {
  assert.equal(VIDAS, 3);
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(d.vidas, Array(o.n).fill(3));
    assert.deepEqual(d.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    for (const j of p.jogadores) assert.ok(Math.abs(Math.hypot(j.x, j.z) - DIST) < 1e-9);
    assert.equal(d.ondas.length, 0);
    assert.match(p.celular[0].texto, /Vidas: 3/);
  }
});

test('onda-festa: quem pula o anel do chão passa; quem fica no chão perde uma vida, é jogado para trás e o celular vibra', () => {
  const p = nova(vs(3));
  anel(p, false, [0, 2]);
  assert.deepEqual(p.dados.vidas, [3, 2, 3]);
  assert.deepEqual(p.dados.placar, [3, 2, 3]);
  assert.equal(p.celular[1].vibra, 1);
  assert.equal(p.celular[0].vibra, undefined);
  assert.match(p.celular[1].texto, /Vidas: 2/);
  assert.ok(Math.hypot(p.jogadores[1].x, p.jogadores[1].z) > DIST + 0.5, 'a onda empurra para fora');
  assert.equal(p.fase, 'jogando', 'o primeiro erro não elimina');
});

test('onda-festa: o anel alto passa por cima de quem está no chão e pega quem pulou', () => {
  const p = nova(vs(4));
  anel(p, true, [1, 3]);
  assert.deepEqual(p.dados.vidas, [3, 2, 3, 2]);
  assert.match(p.celular[1].texto, /anel alto/);
  assert.equal(p.celular[0].vibra, undefined);
});

test('onda-festa: logo depois de apanhar há um instante de proteção', () => {
  const p = nova(vs(2)), d = p.dados;
  d.ondas.push({ r: DIST - 0.3, v: 5, alta: false }, { r: DIST - 0.9, v: 5, alta: false });
  roda(p, 0.6);
  assert.deepEqual(d.vidas, [2, 2], 'o segundo anel, colado no primeiro, não tira outra vida');
});

test('onda-festa: os anéis saem sozinhos do centro, cada vez mais juntos e mais rápidos, e parte deles é alta', () => {
  const p = partidaCom(jogo, sorteio(5), vs(2)), d = p.dados;
  d.vidas = [99, 99];
  let soltos = 0, altos = 0, antes = 0, ultimo = 0, primeiroGap = 0, ultimoGap = 0, v0 = 0, v1 = 0, primeiroT = 0;
  for (let k = 0; k < 60 * (TEMPO - 1); k++) {
    passo(p, DT);
    if (d.soltos > antes) {
      const o = d.ondas.at(-1);
      soltos++; if (o.alta) altos++;
      if (!primeiroT) primeiroT = p.t;
      if (soltos === 1) v0 = o.v;
      if (soltos === 2) primeiroGap = p.t - ultimo;
      if (soltos > 2) ultimoGap = p.t - ultimo;
      if (soltos <= 2) assert.equal(o.alta, false, 'os dois primeiros ensinam o pulo');
      v1 = o.v; ultimo = p.t; antes = d.soltos;
    }
  }
  assert.ok(primeiroT >= 2, 'tempo para se preparar: ' + primeiroT);
  assert.ok(soltos >= 25, 'anéis: ' + soltos);
  assert.ok(altos >= 4 && altos < soltos / 2, `altos: ${altos} de ${soltos}`);
  assert.ok(ultimoGap < primeiroGap && ultimoGap >= 0.7, `${primeiroGap} -> ${ultimoGap}`);
  assert.ok(v1 > v0 && v1 <= 10, `${v0} -> ${v1}`);
});

test('onda-festa: o núcleo avisa a cor do próximo anel antes de soltar', () => {
  const p = partidaCom(jogo, sorteio(5), vs(2)), d = p.dados;
  d.vidas = [99, 99];
  for (let k = 0; k < 60 * 30; k++) {
    const aviso = d.proxAlta, antes = d.soltos;
    passo(p, DT);
    if (d.soltos > antes) assert.equal(d.ondas.at(-1).alta, aviso);
  }
});

test('onda-festa: sem vidas voa para fora e o último de pé vence (vs)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = nova(vs(n));
    for (let i = 0; i < n; i++) {
      if (i === w) continue;
      for (let k = 0; k < 3; k++) { assert.equal(p.fase, 'jogando'); anel(p, false, todosMenos(p, [i])); }
      assert.equal(p.jogadores[i].vivo, false);
    }
    assert.equal(p.fase, 'resultado', `n ${n}`);
    assert.equal(p.vencedor, w);
    assert.equal(p.jogadores[w].pontos, 1);
    assert.equal(p.dados.aviso, `Jogador ${w + 1} venceu!`);
    assert.equal(p.celular[w].texto, 'Você venceu!');
  }
});

test('onda-festa: os que restam perdendo a última vida no mesmo anel empatam', () => {
  const p = nova(vs(3));
  p.dados.vidas = [1, 1, 1];
  anel(p, false, []);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
});

test('onda-festa: em times o time só perde quando os dois ficam sem vida, e o retorno é o time', () => {
  for (const time of [0, 1]) {
    const p = nova(times), rival = 1 - time;
    for (let k = 0; k < 3; k++) anel(p, false, todosMenos(p, [rival]));
    assert.equal(p.dados.vidas[rival], 0);
    assert.equal(p.fase, 'jogando', 'o parceiro ainda segura o time');
    assert.deepEqual(p.dados.placar, time === 0 ? [6, 3] : [3, 6]);
    for (let k = 0; k < 3; k++) anel(p, false, todosMenos(p, [rival + 2]));
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, time);
    assert.deepEqual(p.jogadores.map(j => j.pontos), time === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
    assert.equal(p.dados.aviso, time === 0 ? 'Time laranja venceu!' : 'Time roxo venceu!');
    assert.equal(p.celular[rival].texto, 'O outro time venceu');
  }
});

test('onda-festa: no fim do tempo vence quem tem mais vidas (vs e times) e vidas iguais dão empate', () => {
  let p = nova(vs(4));
  anel(p, false, [1, 2]); anel(p, false, [0, 2, 3]);
  assert.deepEqual(p.dados.vidas, [2, 2, 3, 2]);
  roda(p, TEMPO - 6); assert.equal(p.fase, 'jogando');
  ateOFim(p);
  assert.equal(p.vencedor, 2);
  p = nova(times);
  anel(p, false, [0, 1, 2]);
  ateOFim(p);
  assert.equal(p.vencedor, 0);
  for (const o of COMBOS) {
    p = nova(o);
    ateOFim(p);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
  }
});

test('onda-festa: ninguém fica em cima do núcleo', () => {
  const p = nova(vs(2)), j = p.jogadores[0];
  j.x = 0; j.z = 0; passo(p, DT);
  assert.ok(Math.hypot(j.x, j.z) >= 1.7);
  assert.ok(Number.isFinite(j.x) && Number.isFinite(j.z));
});

test('onda-festa: parados, a rodada acaba sozinha, sem NaN', () => {
  for (const o of COMBOS) {
    const { p, segundos } = rodada(jogo, () => {}, 2, o);
    assert.ok(segundos > 5 && segundos <= TEMPO + 0.1, 'durou ' + segundos);
    assert.ok((o.modo === 'times' ? [-1, 0, 1] : [-1, ...p.jogadores.keys()]).includes(p.vencedor));
  }
});

test('onda-festa: textos sem travessão, sem caixa alta crua e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a, jogo.controle.b];
  for (const o of COMBOS) {
    const p = nova(o);
    const junta = () => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    junta(); anel(p, false, [1]); junta(); anel(p, true, [1]); junta(); anel(p, false, [1]); anel(p, false, [1]); junta();
    if (p.fase === 'jogando') { ateOFim(p); junta(); }
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('onda-festa: dedos aleatórios até o fim com cada modificador permitido (ouro, gelo, foguete, espelho) e com as cartas turbo e dash', () => {
  const mods = [null, ...MODIFICADORES.filter(m => !jogo.semMod.includes(m.id))];
  assert.deepEqual(mods.slice(1).map(m => m.id), ['ouro', 'gelo', 'foguete', 'espelho']);
  for (const m of mods) for (const o of COMBOS) for (const semente of [3, 4]) {
    const p = partidaCom(jogo, sorteio(semente + 20), o), rng = sorteio(semente), c = contexto(p), d = p.dados;
    p.mod = m;
    p.jogadores.forEach((j, i) => { j.carta = [null, 'turbo', 'dash', 'turbo'][i]; });
    jogo.monta(c);
    let q = 0;
    for (; q < 60 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      if (p.fase === 'jogando') jogo.desenha(c, DT, q * DT);
      for (const j of p.jogadores) for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(Number.isFinite(j[k]), `${m?.id} ${k}`);
    }
    assert.notEqual(p.fase, 'jogando', `${m?.id}: não terminou`);
    assert.ok(q * DT <= TEMPO + 0.1);
    assert.deepEqual(p.erros, []);
    for (const v of d.vidas) assert.ok(Number.isInteger(v) && v >= 0 && v <= VIDAS);
    assert.ok((o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()]).includes(p.vencedor));
  }
});

test('onda-festa: fumaça (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});
