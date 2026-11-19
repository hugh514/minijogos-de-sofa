// Motor com 2 a 4 jogadores: modo Festa (vs, times, coop). O Classico (2 jogadores) tem os testes em logica.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { vista, criaPartida, configura, passo, entrada, pulaPara, registra, jogavel, reinicia, NOITES_COOP, venceu, timeDe, ehCoop, elegiveis, moedasDaRodada, posicionaCantos, posicionaRoda, JOGOS, PONTOS_VITORIA, MODIFICADORES, GENEROS } from './logica.mjs';

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
    const classicos = JOGOS.filter(j => !j.festa && !j.coop).map(j => j.id);
    assert.deepEqual(ids('vs', 2), ['f-dois', 'f-vs', ...classicos].sort(), 'todos contra todos com 2 usa tambem os do Classico');
    assert.deepEqual(ids('times', 4), ['f-times', 'f-vs', ...classicos].sort(), 'duplas com 4 usa tambem os do Classico, em revezamento');
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

test('festa: rodada especial (modificador) sai na Festa com p.modificadores ligado e nunca desligado', () => {
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  jogo.atualiza = () => undefined;
  registra(jogo);
  try {
    const p = criaPartida(() => 0.1, { n: 3, modo: 'vs' });
    p.rodada = 50;
    for (let k = 0; k < 30; k++) { p.fase = 'resultado'; p.t = 2.6; passo(p, DT); assert.equal(p.mod, null, 'desligado, rodada ' + k); }
    p.modificadores = true;
    let teve = false;
    for (let k = 0; k < 30; k++) { p.fase = 'resultado'; p.t = 2.6; passo(p, DT); teve ||= !!p.mod; }
    assert.ok(teve, 'ligado, a Festa sorteia modificador');
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
  const sozinhos = JOGOS.splice(0);       // so o minijogo de teste (Duplas tambem usa os do Classico)
  const jogo = falso('f-times', { min: 4, max: 4, modos: ['times'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    assert.equal(p.alvo, 6, 'so ha 1 minijogo de times: partida curta');
    for (const i of [0, 2]) p.jogadores[i].pontos = p.alvo - 1;
    jogaRodada(p, jogo, 0);
    assert.equal(p.fase, 'fim');
    assert.deepEqual(p.campeoes, [0, 2]);
    assert.equal(moedasDaRodada(p, 0), 40);
    assert.equal(moedasDaRodada(p, 1), 3);
    roda(p, 7.1);
    assert.equal(p.fase, 'intro', 'a partida recomeca');
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 0]);
    assert.equal(p.modo, 'times');
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
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
    for (const j of p.jogadores) j.pontos = p.alvo - 1;
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

// ---------- variedade na Festa (secao 3 da proposta): poucos elegiveis ----------
function semente(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quatro = (modo, prefixo) => ['a', 'b', 'c', 'd'].map((x, i) => ({ ...falso(prefixo + x, { min: 2, max: 4, modos: [modo] }), genero: GENEROS[i], atualiza: () => undefined }));
// Joga a partida por pulaPara() e devolve o que saiu em cada rodada.
function sequencia(p, rodadas) {
  const vistos = [{ id: p.jogo.id, mod: p.mod?.id ?? null, repete: p.repete }];
  for (let k = 1; k < rodadas; k++) { pulaPara(p); vistos.push({ id: p.jogo.id, mod: p.mod?.id ?? null, repete: p.repete }); }
  return vistos;
}

test('festa vs com 4 elegiveis: todo minijogo repetido na mesma partida volta com modificador diferente do da vez anterior', () => {
  const jogos = quatro('vs', 'v');
  jogos.forEach(registra);
  try {
    for (const semi of [1, 2, 3, 4, 5]) {
      const p = criaPartida(semente(semi), { n: 3, modo: 'vs' });
      p.modificadores = true;
      const ultimo = {};
      let repetidos = 0;
      for (const [k, r] of sequencia(p, 120).entries()) {
        if (k > 0 && r.id in ultimo) { repetidos++; assert.notEqual(r.mod, ultimo[r.id], `semente ${semi}, rodada ${k}, ${r.id}`); assert.ok(r.mod && r.repete, 'volta temperado'); }
        ultimo[r.id] = r.mod;
      }
      assert.ok(repetidos > 50);
    }
  } finally { limpa(); }
});

test('festa: o modificador de repeticao respeita o minijogo (sem movimento nao recebe gelo) e reinicia zera a memoria', () => {
  const jogos = quatro('vs', 'm');
  jogos[0].semMovimento = true;
  jogos.forEach(registra);
  try {
    const p = criaPartida(semente(9), { n: 3, modo: 'vs' });
    p.modificadores = true;
    for (const r of sequencia(p, 80)) if (r.id === 'ma' && r.mod) assert.ok(!MODIFICADORES.find(m => m.id === r.mod).anda, r.mod);
    reinicia(p);
    assert.equal(Object.keys(p.modsVistos).length, 1, 'a partida nova comeca sem memoria de modificador');
  } finally { limpa(); }
});

test('festa coop: as 5 noites cobrem os 4 minijogos coop distintos e a quinta volta com modificador', () => {
  const jogos = quatro('coop', 'c');
  jogos.forEach(registra);
  try {
    for (let semi = 1; semi <= 40; semi++) {
      const p = criaPartida(semente(semi), { n: 3, modo: 'coop' });
      p.modificadores = true;
      const noites = [{ id: p.jogo.id, mod: p.mod?.id ?? null, repete: p.repete }];
      for (let rodada = p.rodada; p.fase !== 'fim'; ) {
        passo(p, DT);
        if (p.rodada !== rodada) { rodada = p.rodada; noites.push({ id: p.jogo.id, mod: p.mod?.id ?? null, repete: p.repete }); }
      }
      assert.equal(noites.length, NOITES_COOP);
      assert.equal(new Set(noites.slice(0, 4).map(x => x.id)).size, 4, 'semente ' + semi);
      assert.ok(noites[4].mod && noites[4].repete, 'a quinta e repetida e temperada');
      assert.notEqual(noites[4].mod, noites.find(x => x.id === noites[4].id).mod);
      assert.ok(noites.every(x => x.mod !== 'ouro'), 'ouro nao entra nas 5 noites do coop');
    }
  } finally { limpa(); }
});

test('festa: alvo de pontos (p.alvo) e 6 com menos de 6 elegiveis e 10 com 6 ou mais, e a partida acaba nele', () => {
  const quatroVs = quatro('vs', 'p');
  quatroVs.forEach(registra);
  try {
    const p = criaPartida(sorte, { n: 3, modo: 'vs' });
    assert.equal(elegiveis('vs', 3).length, 4);
    assert.equal(p.alvo, 6);
    const jogo = quatroVs[0];
    jogo.atualiza = () => 1;
    const joga = () => { pulaPara(p, jogo); while (p.fase === 'intro') passo(p, DT); passo(p, DT); };
    for (let k = 0; k < 5; k++) { joga(); assert.equal(p.fase, 'resultado'); }
    assert.equal(p.jogadores[1].pontos, 5);
    joga();
    assert.equal(p.fase, 'fim');
    assert.deepEqual(p.campeoes, [1]);
    assert.equal(p.jogadores[1].pontos, 6);
    ['pe', 'pf'].forEach(x => registra(falso(x, { min: 2, max: 4, modos: ['vs'] })));
    assert.equal(criaPartida(sorte, { n: 3, modo: 'vs' }).alvo, PONTOS_VITORIA, 'com 6 elegiveis volta aos 10');
    reinicia(p);
    assert.equal(p.alvo, PONTOS_VITORIA, 'reinicia confere de novo');
  } finally { limpa(); }
});

test('festa: todos contra todos com 2 pessoas sorteia tambem minijogos do Classico, e coop do Classico nunca entra', () => {
  const festa = quatro('vs', 'q');
  festa.forEach(registra);
  const coopClassico = { id: 'q-coop', nome: 'q', dica: 'q', coop: true, inicia() {}, atualiza: () => undefined };
  registra(coopClassico);
  try {
    const p = criaPartida(semente(3), { n: 2, modo: 'vs' });
    const vistos = new Set(sequencia(p, 200).map(r => r.id));
    assert.ok([...vistos].some(id => JOGOS.find(j => j.id === id && !j.festa)), 'saiu algum do Classico');
    assert.ok(festa.every(j => vistos.has(j.id)), 'e os de festa continuam saindo');
    assert.ok(!vistos.has('q-coop'));
    assert.deepEqual(elegiveis('vs', 3).map(j => j.id).sort(), festa.map(j => j.id).sort(), 'com 3 so os de festa');
  } finally { limpa(); }
});

test('festa: configura zera a fila (outro modo), reinicia nao', () => {
  const festa = quatro('vs', 'r');
  festa.forEach(registra);
  try {
    const p = criaPartida(semente(4), { n: 3, modo: 'vs' });
    const fila = [...p.fila];
    assert.ok(fila.length > 0);
    reinicia(p);
    assert.ok(p.fila.every(j => festa.includes(j)));
    assert.ok(p.fila.length > 0, 'a fila segue depois de reiniciar');
    configura(p, { n: 4, modo: 'vs' });
    assert.equal(p.n, 4);
    assert.equal(p.fila.length, 0, 'fila zerada; a rodada nao comecada volta pela prioridade');
    pulaPara(p);
    assert.equal(p.fila.length, 3, 'baralho novo de 4 menos o da rodada que comecou');
  } finally { limpa(); }
});

// ---------- Duplas com minijogo de 2 (revezamento): joga um de cada dupla por rodada, o ponto e da dupla ----------
function classico(id, resposta) {
  return { id, nome: id, dica: 'Jogador 1 contra Jogador 2', inicia(p) { p.dados = { n: p.jogadores.length }; p.celular[1].texto = 'oi'; },
    atualiza(p) { return resposta(p); } };
}

test('duplas: minijogo de 2 roda so com os dois da vez e a dupla de quem venceu leva o ponto', () => {
  const sozinhos = JOGOS.splice(0);       // so o minijogo de teste na rodada
  const jogo = classico('c-duelo', () => 1);
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    assert.equal(p.jogo, jogo);
    assert.deepEqual(p.duelo, [0, 1], 'primeiro duelo: J1 (laranja) contra J2 (roxo)');
    const v = vista(p);
    assert.equal(v.jogadores.length, 2);
    assert.equal(v.jogadores[0], p.jogadores[0]);
    assert.equal(v.jogadores[1], p.jogadores[1]);
    assert.equal(v.n, 2);
    assert.equal(p.dados.n, 2, 'o minijogo so enxerga os dois da vez');
    assert.equal(p.celular[1].texto, 'oi', 'o que o minijogo escreve no celular chega no celular de verdade');
    assert.equal(p.jogadores.length, 4, 'a partida segue com os 4');
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT);
    assert.equal(p.vencedor, 1);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1], 'ponto para J2 e J4 (time roxo)');
    assert.ok(venceu(p, 3) && !venceu(p, 0));
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});

test('duplas: os parceiros revezam e todo mundo enfrenta todo mundo', () => {
  const sozinhos = JOGOS.splice(0);
  registra(classico('c-duelo', () => 0));
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    const vistos = [];
    for (let k = 0; k < 4; k++) { vistos.push(p.duelo.join('-')); pulaPara(p); }
    assert.deepEqual(vistos, ['0-1', '2-3', '0-3', '2-1']);
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT);
    assert.equal(p.vencedor, 0);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0], 'J3 venceu: ponto do time laranja');
    reinicia(p);
    assert.deepEqual(p.duelo, [0, 1], 'partida nova comeca o revezamento do zero');
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});

test('duplas: minijogo de festa usa os 4 e minijogo coop de 2 nao entra', () => {
  const sozinhos = JOGOS.splice(0);
  const festa = falso('f-times', { min: 4, max: 4, modos: ['times'] }, 0);
  const coop = { ...classico('c-coop', () => 2), coop: true };
  [festa, coop].forEach(registra);
  try {
    assert.deepEqual(elegiveis('times', 4).map(j => j.id), ['f-times']);
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    assert.equal(p.jogo, festa);
    assert.equal(p.duelo, null);
    assert.equal(vista(p), p);
    assert.equal(vista(p).jogadores.length, 4);
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});

test('duplas: so quem esta na vez se move no minijogo de 2', () => {
  const sozinhos = JOGOS.splice(0);
  registra(classico('c-duelo', () => undefined));
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    while (p.fase !== 'jogando') passo(p, DT);
    for (const i of [0, 1, 2, 3]) entrada(p, i, { x: 1, y: 0, d: false, b: false });
    roda(p, 0.5);
    assert.ok(p.jogadores[0].x > 1 && p.jogadores[1].x > 1, 'os da vez andam');
    assert.equal(p.jogadores[2].x, 0, 'o parceiro J3 fica parado');
    assert.equal(p.jogadores[3].x, 0, 'o parceiro J4 fica parado');
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});
