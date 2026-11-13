// Motor com 2 a 4 jogadores: modo Festa (vs, times, coop). O Classico (2 jogadores) tem os testes em logica.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { criaPartida, configura, passo, entrada, pulaPara, registra, jogavel, reinicia, NOITES_COOP, venceu, timeDe, ehCoop, elegiveis, moedasDaRodada, posicionaCantos, posicionaRoda, JOGOS, PONTOS_VITORIA } from './logica.mjs';

const DT = 1 / 60;
const roda = (p, seg) => { for (let i = 0; i < seg * 60; i++) passo(p, DT); };
const sorte = () => 0.3;

// Minijogo de festa de mentira: termina no primeiro quadro com o que a partida mandar em p.dados.resposta.
function falso(id, festa, resposta) {
  return { id, nome: id, dica: 'teste', festa, inicia(p) { p.dados = { resposta }; }, atualiza(p) { return p.dados.resposta; } };
}
const antes = JOGOS.length;
function limpa() { while (JOGOS.length > antes) JOGOS.pop(); }

function jogaRodada(p, jogo, resposta) {
  jogo.atualiza = () => resposta;
  pulaPara(p, jogo);
  while (p.fase !== 'jogando') passo(p, DT);
  passo(p, DT);
}

test('festa: criaPartida cria n jogadores e o classico segue com 2', () => {
  const c = criaPartida(sorte);
  assert.equal(c.jogadores.length, 2);
  assert.equal(c.modo, 'classico');
  assert.equal(c.celular.length, 2);
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'vs' });
    assert.equal(p.jogadores.length, 4);
    assert.equal(p.n, 4);
    assert.equal(p.celular.length, 4);
    assert.deepEqual(p.seq, [0, 0, 0, 0]);
    assert.equal(p.jogo, jogo);
  } finally { limpa(); }
});

test('festa: n e modo invalidos viram erro claro', () => {
  assert.throws(() => criaPartida(sorte, { n: 5, modo: 'vs' }), /jogadores/);
  assert.throws(() => criaPartida(sorte, { n: 1, modo: 'vs' }), /jogadores/);
  assert.throws(() => criaPartida(sorte, { n: 3, modo: 'classico' }), /jogadores/);
  assert.throws(() => criaPartida(sorte, { n: 2, modo: 'xyz' }), /modo/);
});

test('festa: a rotacao filtra pelo modo e pelo numero de jogadores', () => {
  const vs = falso('f-vs', { min: 2, max: 4, modos: ['vs', 'times'] });
  const times = falso('f-times', { min: 4, max: 4, modos: ['times'] });
  const coop = falso('f-coop', { min: 2, max: 4, modos: ['coop'] });
  const dois = falso('f-dois', { min: 2, max: 2, modos: ['vs'] });
  [vs, times, coop, dois].forEach(registra);
  try {
    const ids = (modo, n) => elegiveis(modo, n).map(j => j.id).sort();
    assert.deepEqual(ids('vs', 3), ['f-vs']);
    assert.deepEqual(ids('vs', 2), ['f-dois', 'f-vs']);
    assert.deepEqual(ids('times', 4), ['f-times', 'f-vs']);
    assert.deepEqual(ids('coop', 2), ['f-coop']);
    assert.ok(elegiveis('classico', 2).every(j => !j.festa), 'o classico nunca recebe minijogo de festa');
    const p = criaPartida(sorte, { n: 3, modo: 'vs' });
    const vistos = new Set();
    for (let k = 0; k < 8; k++) { vistos.add(p.jogo.id); p.fase = 'resultado'; p.t = 0; roda(p, 2.6); }
    assert.deepEqual([...vistos], ['f-vs']);
    const q = criaPartida(sorte);
    for (let k = 0; k < 40; k++) { assert.ok(!q.jogo.festa); q.fase = 'resultado'; q.t = 0; roda(q, 2.6); }
  } finally { limpa(); }
});

test('festa: sem minijogo para o modo, o erro diz qual', () => {
  assert.throws(() => criaPartida(sorte, { n: 3, modo: 'vs' }), /minijogo/);
});

test('festa: times so existe com 4 jogadores', () => {
  assert.throws(() => criaPartida(sorte, { n: 3, modo: 'times' }), /jogadores/);
  assert.throws(() => criaPartida(sorte, { n: 2, modo: 'times' }), /jogadores/);
});

test('festa: rodada especial (modificador) nunca sai, mesmo depois de muitas rodadas e com p.modificadores ligado', () => {
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  jogo.atualiza = () => undefined;
  registra(jogo);
  try {
    const p = criaPartida(() => 0.1, { n: 3, modo: 'vs' });
    p.modificadores = true; p.rodada = 50;
    for (let k = 0; k < 30; k++) { p.fase = 'resultado'; p.t = 2.6; passo(p, DT); assert.equal(p.mod, null, 'rodada ' + k); }
    const c = criaPartida(() => 0.1);
    c.modificadores = true; c.rodada = 50;
    let teve = false;
    for (let k = 0; k < 30; k++) { c.fase = 'resultado'; c.t = 2.6; passo(c, DT); teve ||= !!c.mod; }
    assert.ok(teve, 'o Classico continua sorteando modificador');
  } finally { limpa(); }
});

test('festa: se o unico minijogo do modo falha, a partida avisa (semJogo) em vez de repetir o erro sem fim', () => {
  const ruim = falso('f-ruim', { min: 2, max: 4, modos: ['coop'] });
  registra(ruim);
  try {
    const p = criaPartida(sorte, { n: 2, modo: 'coop' });
    assert.ok(!p.semJogo);
    jogaRodada(p, ruim, 5);
    assert.equal(p.semJogo, true);
    assert.ok(JOGOS.includes(ruim), 'o unico do modo fica na lista (a tela volta ao menu)');
  } finally { limpa(); }
});

test('festa: o empurrao sem direcao vai para quem esta em pe e mais perto, e nao para quem caiu', () => {
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  jogo.atualiza = () => undefined;
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 3, modo: 'vs' });
    pulaPara(p, jogo);
    while (p.fase !== 'jogando') passo(p, DT);
    Object.assign(p.jogadores[0], { x: 0, z: 0 }); Object.assign(p.jogadores[1], { x: 1.5, z: 0, vivo: false }); Object.assign(p.jogadores[2], { x: -5, z: 0 });
    entrada(p, 0, { x: 0, y: 0, d: false, n: 0 }); entrada(p, 0, { x: 0, y: 0, d: true, n: 1 });
    passo(p, DT);
    assert.ok(p.jogadores[0].vx < -5, 'foi para o J3, que esta em pe: vx ' + p.jogadores[0].vx);
  } finally { limpa(); }
});

test('festa vs: o indice do vencedor da o ponto so a ele', () => {
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'vs' });
    jogaRodada(p, jogo, 2);
    assert.equal(p.fase, 'resultado');
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 1, 0]);
    assert.deepEqual([0, 1, 2, 3].map(i => venceu(p, i)), [false, false, true, false]);
    assert.deepEqual([0, 1, 2, 3].map(i => moedasDaRodada(p, i)), [3, 3, 10, 3]);
    jogaRodada(p, jogo, -1);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 1, 0], 'empate nao pontua');
    assert.deepEqual([0, 1, 2, 3].map(i => moedasDaRodada(p, i)), [5, 5, 5, 5]);
  } finally { limpa(); }
});

test('festa vs: retorno fora de 0 a n-1 tira o minijogo da rotacao', () => {
  const ruim = falso('f-ruim', { min: 2, max: 4, modos: ['vs'] });
  const bom = falso('f-bom', { min: 2, max: 4, modos: ['vs'] });
  [ruim, bom].forEach(registra);
  try {
    const p = criaPartida(sorte, { n: 3, modo: 'vs' });
    jogaRodada(p, ruim, 3);
    assert.ok(p.erros.some(e => e.includes('f-ruim')));
    assert.ok(!JOGOS.includes(ruim));
    assert.equal(p.vencedor, -1);
    const q = criaPartida(sorte, { n: 4, modo: 'vs' });
    jogaRodada(q, bom, 3);
    assert.equal(q.jogadores[3].pontos, 1, 'o indice 3 vale com 4 jogadores');
  } finally { limpa(); }
});

test('festa times: o time A e J1+J3, o B e J2+J4, e os dois do time pontuam', () => {
  assert.deepEqual([0, 1, 2, 3].map(i => timeDe(null, i)), [0, 1, 0, 1]);
  const jogo = falso('f-times', { min: 4, max: 4, modos: ['times'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    jogaRodada(p, jogo, 1);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
    assert.deepEqual([0, 1, 2, 3].map(i => venceu(p, i)), [false, true, false, true]);
    assert.deepEqual([0, 1, 2, 3].map(i => moedasDaRodada(p, i)), [3, 10, 3, 10]);
    jogaRodada(p, jogo, 0);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 1, 1, 1]);
    jogaRodada(p, jogo, 2);
    assert.ok(p.erros.some(e => e.includes('f-times')), 'em times so 0 ou 1');
  } finally { limpa(); }
});

test('festa times: 10 pontos do time encerram a partida com os dois campeoes', () => {
  const jogo = falso('f-times', { min: 4, max: 4, modos: ['times'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    for (const i of [0, 2]) p.jogadores[i].pontos = PONTOS_VITORIA - 1;
    jogaRodada(p, jogo, 0);
    assert.equal(p.fase, 'fim');
    assert.deepEqual(p.campeoes, [0, 2]);
    assert.equal(moedasDaRodada(p, 0), 40);
    assert.equal(moedasDaRodada(p, 1), 3);
    roda(p, 7.1);
    assert.equal(p.fase, 'intro', 'a partida recomeca');
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 0]);
    assert.equal(p.modo, 'times');
  } finally { limpa(); }
});

test('festa coop: 2 faz todos pontuarem, -1 ninguem, e 10 pontos fazem todos campeoes', () => {
  const jogo = falso('f-coop', { min: 2, max: 4, modos: ['coop'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 3, modo: 'coop' });
    assert.ok(ehCoop(p));
    jogaRodada(p, jogo, 2);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 1, 1]);
    assert.deepEqual([0, 1, 2].map(i => moedasDaRodada(p, i)), [10, 10, 10]);
    jogaRodada(p, jogo, -1);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 1, 1]);
    assert.deepEqual([0, 1, 2].map(i => moedasDaRodada(p, i)), [3, 3, 3]);
    for (const j of p.jogadores) j.pontos = PONTOS_VITORIA - 1;
    jogaRodada(p, jogo, 2);
    assert.equal(p.fase, 'fim');
    assert.deepEqual(p.campeoes, [0, 1, 2]);
    jogaRodada(p, jogo, 0);
    assert.ok(p.erros.some(e => e.includes('f-coop')), 'em coop so 2 ou -1');
  } finally { limpa(); }
});

test('festa: configura troca n e modo e recomeca a partida sem perder os contadores dos celulares', () => {
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte);
    entrada(p, 0, { x: 0, y: 0, n: 5 });
    const j0 = p.jogadores[0];
    configura(p, { n: 4, modo: 'vs' });
    assert.equal(p.jogadores.length, 4);
    assert.equal(p.jogadores[0], j0, 'o jogador 1 e o mesmo objeto');
    assert.equal(p.jogadores[0].n, 5);
    assert.equal(p.celular.length, 4);
    assert.equal(p.jogo, jogo);
    assert.equal(p.fase, 'intro');
    configura(p, { n: 2, modo: 'classico' });
    assert.equal(p.jogadores.length, 2);
    assert.ok(!p.jogo.festa);
  } finally { limpa(); }
});

test('festa: entrada de jogador que nao existe e ignorada', () => {
  const p = criaPartida(sorte);
  assert.doesNotThrow(() => entrada(p, 3, { x: 1, y: 0 }));
});

test('festa: 4 jogadores empilhados em pares se empurram e nenhum vira NaN', () => {
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  jogo.atualiza = () => undefined;
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'vs' });
    pulaPara(p, jogo);
    while (p.fase !== 'jogando') passo(p, DT);
    p.jogadores.forEach((j, i) => { j.x = i * 0.5; j.z = 0; entrada(p, i, { x: i % 2 ? -1 : 1, y: 0 }); });
    roda(p, 2);
    for (const j of p.jogadores) for (const k of ['x', 'z', 'vx', 'vz']) assert.ok(Number.isFinite(j[k]));
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const d = Math.hypot(p.jogadores[a].x - p.jogadores[b].x, p.jogadores[a].z - p.jogadores[b].z);
      assert.ok(d > 1.2, `jogadores ${a} e ${b} se atravessaram: ${d.toFixed(2)}`);
    }
  } finally { limpa(); }
});

test('festa: posicionaCantos e posicionaRoda espalham os jogadores sem sobrepor', () => {
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  registra(jogo);
  try {
    for (const n of [2, 3, 4]) {
      const p = criaPartida(sorte, { n, modo: 'vs' });
      posicionaCantos(p, 6, 3);
      assert.deepEqual(p.jogadores.slice(0, 2).map(j => [j.x, j.z]), [[-6, -3], [6, -3]]);
      if (n > 2) assert.deepEqual([p.jogadores[2].x, p.jogadores[2].z], [-6, 3]);
      posicionaRoda(p, 5);
      for (const j of p.jogadores) assert.ok(Math.abs(Math.hypot(j.x, j.z) - 5) < 1e-9);
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++)
        assert.ok(Math.hypot(p.jogadores[a].x - p.jogadores[b].x, p.jogadores[a].z - p.jogadores[b].z) > 3);
    }
  } finally { limpa(); }
});

test('festa: registra recusa o contrato festa torto', () => {
  const torto = festa => () => registra(falso('f-torto', festa));
  assert.throws(torto({ min: 1, max: 4, modos: ['vs'] }), /festa/);
  assert.throws(torto({ min: 2, max: 5, modos: ['vs'] }), /festa/);
  assert.throws(torto({ min: 4, max: 2, modos: ['vs'] }), /festa/);
  assert.throws(torto({ min: 2, max: 4, modos: [] }), /festa/);
  assert.throws(torto({ min: 2, max: 4, modos: ['classico'] }), /festa/);
  assert.throws(torto('vs'), /festa/);
  assert.ok(!JOGOS.some(j => j.id === 'f-torto'));
});

test('festa: modo cujo unico minijogo quebrou nao esta jogavel, e uma versao nova do minijogo volta a valer', () => {
  const ruim = falso('f-quebrado', { min: 2, max: 4, modos: ['coop'] });
  registra(ruim);
  try {
    const p = criaPartida(sorte, { n: 2, modo: 'coop' });
    assert.equal(jogavel('coop', 2), true);
    jogaRodada(p, ruim, 5);
    assert.equal(p.semJogo, true);
    assert.equal(jogavel('coop', 2), false, 'o unico do modo quebrou: a tela nao deixa comecar de novo');
    assert.equal(jogavel('classico', 2), true, 'outros modos seguem');
    registra(falso('f-quebrado', { min: 2, max: 4, modos: ['coop'] }, 2));
    assert.equal(jogavel('coop', 2), true, 'versao nova do mesmo id entra limpa');
  } finally { limpa(); }
});

test('festa coop: a partida dura 5 noites, conta as vencidas e acaba na quinta', () => {
  const jogo = falso('f-coop5', { min: 2, max: 4, modos: ['coop'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 3, modo: 'coop' });
    assert.deepEqual(p.noites, { jogadas: 0, vencidas: 0 });
    const resp = [2, -1, 2, 2];
    for (const r of resp) jogaRodada(p, jogo, r);
    assert.equal(p.fase, 'resultado', 'ate a quarta noite a partida segue');
    assert.deepEqual(p.noites, { jogadas: 4, vencidas: 3 });
    jogaRodada(p, jogo, -1);
    assert.equal(p.fase, 'fim', 'a quinta noite encerra');
    assert.deepEqual(p.noites, { jogadas: 5, vencidas: 3 });
    assert.deepEqual(p.campeoes, [0, 1, 2], '3 de 5: a equipe venceu a partida');
    reinicia(p);
    assert.deepEqual(p.noites, { jogadas: 0, vencidas: 0 });
    for (let k = 0; k < NOITES_COOP; k++) jogaRodada(p, jogo, k < 2 ? 2 : -1);
    assert.equal(p.fase, 'fim');
    assert.deepEqual(p.campeoes, [], '2 de 5: a equipe perdeu a partida');
  } finally { limpa(); }
});
