// Motor com 2 a 4 jogadores: modo Festa (vs, times, coop). O Classico (2 jogadores) tem os testes em logica.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { vista, timeNaRodada, criaPartida, configura, passo, entrada, pulaPara, registra, jogavel, reinicia, NOITES_COOP, venceu, timeDe, ehCoop, elegiveis, moedasDaRodada, posicionaCantos, posicionaRoda, JOGOS, PONTOS_VITORIA, MODIFICADORES, GENEROS } from './logica.mjs';

const DT = 1 / 60;
const roda = (p, seg) => { for (let i = 0; i < seg * 60; i++) passo(p, DT); };
const sorte = () => 0.3;

// Minijogo de festa de mentira: termina no primeiro quadro com o que a partida mandar em p.dados.resposta.
function falso(id, festa, resposta) {
  return { id, nome: id, dica: 'teste', festa, inicia(p) { p.dados = { resposta }; }, atualiza(p) { return p.dados.resposta; } };
}
const antes = JOGOS.length;
function limpa() { while (JOGOS.length > antes) JOGOS.pop(); }
// Tira da rotacao os minijogos de 2 (sem festa) e devolve a funcao que poe a lista de antes de volta (sem o que o teste registrou depois).
function semClassicos() { const tudo = JOGOS.splice(0); JOGOS.push(...tudo.filter(j => j.festa)); return () => JOGOS.splice(0, JOGOS.length, ...tudo); }

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
    assert.ok(elegiveis('vs', 4).includes(jogo));
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
    assert.deepEqual(ids('vs', 3), ['f-vs'], 'cada um por si com 3: so os que todos jogam juntos');
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
  const volta = semClassicos();       // so os de festa: com 3 ou 4 os de 2 tambem entram (revezamento), aqui o assunto e a regra da Festa
  try {
    assert.throws(() => criaPartida(sorte, { n: 3, modo: 'vs' }), /minijogo/);
  } finally { volta(); }
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
    assert.ok(elegiveis('vs', 4).includes(p.jogo));
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
  assert.throws(torto({ min: 2, max: 6, modos: ['vs'] }), /festa/);
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
  const volta = semClassicos();       // so os de festa: com 3 ou 4 os de 2 tambem entram (revezamento), aqui o assunto e a regra da Festa
  try {
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
  } finally { volta(); }
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
  const volta = semClassicos();       // so os de festa: com 3 ou 4 os de 2 tambem entram (revezamento), aqui o assunto e a regra da Festa
  try {
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
      assert.equal(criaPartida(sorte, { n: 3, modo: 'vs' }).alvo, 8, 'com 6 elegiveis e 3 no sofa o alvo e 8');
      reinicia(p);
      assert.equal(p.alvo, 8, 'reinicia confere de novo');
    } finally { limpa(); }
  } finally { volta(); }
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
  const volta = semClassicos();       // so os de festa: com 3 ou 4 os de 2 tambem entram (revezamento), aqui o assunto e a regra da Festa
  try {
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
  } finally { volta(); }
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
    vista(p).dados.x = 1;
    assert.equal(p.dados.x, 1, 'p.dados e o da partida');
    p.nomes = ['Ana', 'Bia', 'Caio', 'Duda'];
    assert.deepEqual(vista(p).nomes, ['Ana', 'Bia'], 'nomes dos dois da vez');
    jogo.atualiza = q => { q.celular[0] = { texto: 'novo' }; q.celular = [...q.celular]; return 1; };
    assert.equal(p.jogadores.length, 4, 'a partida segue com os 4');
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT);
    assert.equal(p.vencedor, 1);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1], 'ponto para J2 e J4 (time roxo)');
    assert.ok(venceu(p, 3) && !venceu(p, 0));
    assert.equal(p.celular[0].texto, 'novo', 'objeto e lista de celular trocados pelo minijogo chegam na partida');
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
    assert.ok(Math.hypot(p.jogadores[2].x, p.jogadores[2].z) > 10, 'quem assiste fica fora da arena (torcida nao cai no meio da disputa)');
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
    assert.equal(p.jogadores[2].x, -11, 'o parceiro J3 fica parado fora da arena');
    assert.equal(p.jogadores[3].x, 11, 'o parceiro J4 fica parado fora da arena');
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});

test('cada um por si com 3 ou 4: so minijogos em que todos jogam juntos, sem revezamento', () => {
  const sozinhos = JOGOS.splice(0);
  const festa = falso('f-vs', { min: 2, max: 4, modos: ['vs'] }, 2);
  [classico('c-duelo', () => 1), festa].forEach(registra);
  try {
    for (const n of [3, 4]) {
      assert.deepEqual(elegiveis('vs', n).map(j => j.id), ['f-vs'], 'os de 2 nao entram com ' + n);
      const p = criaPartida(sorte, { n, modo: 'vs' });
      assert.equal(p.duelo, null);
      assert.equal(vista(p), p);
    }
    assert.deepEqual(elegiveis('vs', 2).map(j => j.id).sort(), ['c-duelo', 'f-vs'], 'com 2 os de 2 continuam valendo');
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});

// ---------- cartas de poder na Festa (Cada um por si e Duplas): quem jogou e perdeu escolhe uma carta na rodada seguinte ----------
test('cartas na festa: quem perdeu em Cada um por si ganha oferta de carta na rodada seguinte, e o vencedor nao', () => {
  const volta = semClassicos();
  const jogo = falso('f-vs', { min: 2, max: 4, modos: ['vs'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 3, modo: 'vs' });
    assert.ok(p.jogadores.every(j => !j.oferta), 'primeira rodada sem cartas');
    jogaRodada(p, jogo, 1);
    roda(p, 2.6);
    assert.equal(p.fase, 'intro');
    assert.equal(p.jogadores[1].oferta, null, 'quem venceu nao escolhe carta');
    for (const i of [0, 2]) assert.ok(Array.isArray(p.jogadores[i].oferta) && p.jogadores[i].oferta.length > 0, 'quem perdeu escolhe: J' + (i + 1));
  } finally { volta(); }
});

test('cartas na festa: Vale dobro da 2 pontos (ao time inteiro em Duplas) e Escudo de quem perdeu segura o ponto', () => {
  const volta = semClassicos();
  const jogo = falso('f-t', { min: 2, max: 4, modos: ['vs', 'times'] });
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    p.jogadores[2].carta = 'dobro';
    while (p.fase !== 'jogando') passo(p, DT);
    jogo.atualiza = () => 0; passo(p, DT);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [2, 0, 2, 0], 'dobro de um da dupla vale para o time');
    assert.deepEqual(p.jogadores.map(j => j.direito), [false, true, false, true], 'o time que perdeu ganha direito a carta');
    roda(p, 2.6);
    assert.ok(p.jogadores[1].oferta && p.jogadores[3].oferta);
    p.jogadores[3].carta = 'escudo'; p.jogadores[1].oferta = p.jogadores[3].oferta = null;
    while (p.fase !== 'jogando') passo(p, DT);
    jogo.atualiza = () => 0; passo(p, DT);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [2, 0, 2, 0], 'escudo segurou o ponto');
    assert.deepEqual(p.anuncios, [{ tipo: 'escudo', quem: 3 }]);
    const v = criaPartida(sorte, { n: 3, modo: 'vs' });
    v.jogadores[1].carta = 'dobro';
    while (v.fase !== 'jogando') passo(v, DT);
    jogo.atualiza = () => 1; passo(v, DT);
    assert.deepEqual(v.jogadores.map(j => j.pontos), [0, 2, 0]);
    assert.equal(moedasDaRodada(v, 1), 10);
  } finally { volta(); }
});

test('cartas na festa: escudo so para quem esta atras de algum rival; coop nunca tem carta', () => {
  const volta = semClassicos();
  const jogo = falso('f-t', { min: 2, max: 4, modos: ['vs', 'times', 'coop'] });
  registra(jogo);
  try {
    const p = criaPartida(semente(5), { n: 4, modo: 'vs' });
    p.jogadores[0].pontos = 3;
    const vistas = new Set();
    for (let k = 0; k < 30; k++) { jogaRodada(p, jogo, 0); p.jogadores[0].pontos = 3; roda(p, 2.6); for (const i of [1, 2, 3]) for (const c of p.jogadores[i].oferta ?? []) vistas.add(c); assert.ok(!(p.jogadores[0].oferta ?? []).includes('escudo')); }
    assert.ok(vistas.has('escudo'), 'quem esta atras ve o escudo: ' + [...vistas]);
    const c = criaPartida(sorte, { n: 3, modo: 'coop' });
    jogaRodada(c, jogo, -1); roda(c, 2.6);
    assert.ok(c.jogadores.every(j => !j.oferta && !j.direito), 'cooperativo sem cartas');
  } finally { volta(); }
});

test('cartas na festa: no revezamento so quem jogou e perdeu ganha a carta, e so recebe a oferta quando voltar a jogar', () => {
  const sozinhos = JOGOS.splice(0);
  registra(classico('c-duelo', () => 0));
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT);                                   // duelo 0-1, J1 vence
    assert.deepEqual(p.jogadores.map(j => j.direito), [false, true, false, false], 'so o J2 jogou e perdeu');
    roda(p, 2.6);                                   // duelo 2-3: J2 esta de fora
    assert.deepEqual(p.duelo, [2, 3]);
    assert.equal(p.jogadores[1].oferta, null, 'de fora nao escolhe carta');
    assert.equal(p.jogadores[1].direito, true, 'o direito espera a vez dele');
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT); roda(p, 2.6);                     // duelo 0-3
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT); roda(p, 2.6);                     // duelo 2-1: agora o J2 joga
    assert.deepEqual(p.duelo, [2, 1]);
    assert.ok(Array.isArray(p.jogadores[1].oferta), 'voltou a jogar: escolhe a carta');
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});

test('cartas na festa: quem ficou de fora no revezamento nao recebe o Escudo duas vezes seguidas', () => {
  const sozinhos = JOGOS.splice(0);
  registra(classico('c-duelo', () => 0));
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'times' });
    p.jogadores[1].carta = 'escudo';                // J2 joga o duelo 0-1 com escudo
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT); roda(p, 2.6);                     // duelo 2-3: J2 de fora, sem carta
    assert.equal(p.jogadores[1].cartaAnterior, 'escudo');
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT); roda(p, 2.6);                     // duelo 0-3
    assert.equal(p.jogadores[1].cartaAnterior, 'escudo', 'de fora de novo: a ultima carta dele segue sendo o escudo');
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});

test('cartas: semCarta do minijogo tira a carta da oferta, e a Helice maluca nao sai Na lua nem oferece a Mola', async () => {
  const volta = semClassicos();
  const jogo = { ...falso('f-sc', { min: 2, max: 4, modos: ['vs'] }), semCarta: ['turbo', 'pulo'] };
  registra(jogo);
  try {
    const p = criaPartida(semente(9), { n: 3, modo: 'vs' });
    for (let k = 0; k < 25; k++) {
      jogaRodada(p, jogo, 0); roda(p, 2.6);
      for (const i of [1, 2]) assert.ok(!(p.jogadores[i].oferta ?? []).some(c => c === 'turbo' || c === 'pulo'), 'oferta: ' + p.jogadores[i].oferta);
    }
    const helice = (await import('./jogos/helice-festa.mjs')).default;
    assert.ok(helice.semMod.includes('lua') && helice.semCarta.includes('pulo'));
  } finally { volta(); }
});

// ---------- 5 no sofa: os minijogos sao para ate 4, entao a cada rodada um descansa (rodizio) e os outros 4 jogam ----------
test('cinco jogadores: em Cada um por si quatro jogam e um descansa, em rodizio, e o ponto vai para o lugar de verdade', () => {
  const volta = semClassicos();
  const jogo = { ...falso('f-5', { min: 2, max: 4, modos: ['vs', 'coop'] }), inicia(p) { p.dados = { n: p.jogadores.length, quem: p.n }; p.celular[3].texto = 'oi'; } };
  registra(jogo);
  try {
    assert.deepEqual(elegiveis('vs', 5).map(j => j.id), ['f-5'], 'minijogo de ate 4 vale com 5 no sofa');
    const p = criaPartida(sorte, { n: 5, modo: 'vs' });
    assert.equal(p.jogadores.length, 5);
    assert.equal(p.celular.length, 5);
    assert.deepEqual(p.duelo, [0, 1, 2, 3], 'primeira rodada: o Jogador 5 descansa');
    assert.deepEqual(p.jogadores.map(j => j.pronto), [false, false, false, false, true], 'quem descansa ja conta como pronto: a rodada nao espera por ele');
    assert.equal(p.dados.n, 4, 'o minijogo so enxerga os 4 da vez');
    assert.equal(p.dados.quem, 4);
    assert.equal(vista(p).jogadores[3], p.jogadores[3]);
    const fora = [];
    for (let k = 0; k < 5; k++) { fora.push([0, 1, 2, 3, 4].find(i => !p.duelo.includes(i))); pulaPara(p); }
    assert.deepEqual(fora, [4, 3, 2, 1, 0], 'cada um descansa uma vez a cada 5 rodadas');
    assert.deepEqual(p.duelo, [0, 1, 2, 3]);
    pulaPara(p);                                    // agora descansa o lugar 4 (indice 3): jogam 0, 1, 2 e 4
    assert.deepEqual(p.duelo, [0, 1, 2, 4]);
    assert.equal(p.celular[4].texto, 'oi', 'o quarto da vez e o Jogador 5: o celular dele recebe o texto');
    while (p.fase !== 'jogando') passo(p, DT);
    jogo.atualiza = () => 3; passo(p, DT);          // o minijogo diz "venceu o quarto"
    assert.equal(p.vencedor, 4, 'o vencedor e o lugar de verdade (Jogador 5)');
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 0, 1]);
    assert.ok(venceu(p, 4) && !venceu(p, 3));
    assert.deepEqual(p.jogadores.map(j => j.direito), [true, true, true, false, false], 'quem descansou nao perdeu: sem carta');
  } finally { volta(); }
});

test('cinco jogadores: resultado fora dos 4 da vez tira o minijogo da rotacao, e no cooperativo todos os 5 pontuam', () => {
  const volta = semClassicos();
  const jogo = falso('f-5', { min: 2, max: 4, modos: ['vs', 'coop'] });
  const outro = falso('f-6', { min: 2, max: 4, modos: ['vs'] });
  [jogo, outro].forEach(registra);
  try {
    const p = criaPartida(sorte, { n: 5, modo: 'vs' });
    jogaRodada(p, jogo, 4);                         // indice 4 nao existe entre os 4 da vez
    assert.equal(p.vencedor, -1);
    assert.equal(p.erros.length, 1);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 0, 0]);
    const junto = falso('f-c', { min: 2, max: 4, modos: ['coop'] });
    registra(junto);
    const c = criaPartida(sorte, { n: 5, modo: 'coop' });
    jogaRodada(c, junto, 2);
    assert.deepEqual(c.jogadores.map(j => j.pontos), [1, 1, 1, 1, 1], 'vitoria da equipe vale para quem descansou tambem');
  } finally { volta(); }
});

test('cinco jogadores: minijogo que aceita 5 (festa.max 5) roda com todos, e 6 jogadores ou Duplas com 5 viram erro claro', () => {
  const volta = semClassicos();
  const todos = falso('f-todos', { min: 2, max: 5, modos: ['vs'] });
  registra(todos);
  try {
    const p = criaPartida(sorte, { n: 5, modo: 'vs' });
    assert.equal(p.duelo, null);
    assert.equal(vista(p), p);
    assert.equal(vista(p).jogadores.length, 5);
    jogaRodada(p, todos, 4);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 0, 1]);
    assert.throws(() => criaPartida(sorte, { n: 6, modo: 'vs' }), /jogadores/);
    assert.throws(() => criaPartida(sorte, { n: 3, modo: 'times' }), /jogadores/);
    assert.throws(() => registra(falso('f-x', { min: 2, max: 6, modos: ['vs'] })), /festa torto/);
    assert.deepEqual(elegiveis('vs', 3).map(j => j.id), ['f-todos'], 'com 3 nada muda');
  } finally { volta(); }
});

test('cinco jogadores: quem descansa fica parado fora da arena e minijogo so para 2 ou 3 nao entra', () => {
  const volta = semClassicos();
  const jogo = { ...falso('f-5', { min: 2, max: 4, modos: ['vs'] }), atualiza: () => undefined };
  const tres = falso('f-3', { min: 2, max: 3, modos: ['vs'] });
  [jogo, tres].forEach(registra);
  try {
    assert.deepEqual(elegiveis('vs', 5).map(j => j.id), ['f-5']);
    const p = criaPartida(sorte, { n: 5, modo: 'vs' });
    while (p.fase !== 'jogando') passo(p, DT);
    for (const i of [0, 1, 2, 3, 4]) entrada(p, i, { x: 1, y: 0, d: false, b: false });
    const antes = [p.jogadores[4].x, p.jogadores[4].z];
    roda(p, 0.5);
    assert.ok(p.jogadores[0].x > 1, 'quem joga anda');
    assert.deepEqual([p.jogadores[4].x, p.jogadores[4].z], antes, 'quem descansa nao se move');
    assert.ok(Math.hypot(...antes) > 10, 'e fica fora da arena');
  } finally { volta(); }
});

test('escudo com freio: so para quem esta em ultimo, uma vez por jogador na partida e nunca logo depois de um escudo segurar o ponto', () => {
  const volta = semClassicos();
  const jogo = { ...falso('f-e', { min: 2, max: 4, modos: ['vs'] }), semMovimento: true, semDash: true, semPulo: true };       // sem cartas de andar: sobram dobro, moedas e escudo
  registra(jogo);
  try {
    const p = criaPartida(semente(3), { n: 3, modo: 'vs' });
    const oferta = i => p.jogadores[i].oferta ?? [];
    p.jogadores[0].pontos = 4; p.jogadores[1].pontos = 2; p.jogadores[2].pontos = 0;
    jogaRodada(p, jogo, 0); roda(p, 2.6);           // J1 vence: J2 e J3 escolhem carta
    assert.ok(!oferta(1).includes('escudo'), 'J2 esta atras do J1, mas nao e o ultimo: sem escudo');
    assert.ok(oferta(2).includes('escudo'), 'J3 e o ultimo: pode pegar o escudo');
    const qual = oferta(2).indexOf('escudo');
    entrada(p, 2, { x: 0, y: 0, op: qual, nop: 1 }); entrada(p, 2, { x: 0, y: 0, op: qual, nop: 2 });       // o primeiro envio so acerta a base do contador; o segundo e o toque
    assert.equal(p.jogadores[2].carta, 'escudo', 'J3 pegou o escudo pelo celular');
    assert.equal(p.jogadores[2].escudos, 1, 'o escudo conta na hora em que e escolhido');
    p.jogadores[1].oferta = null;
    while (p.fase !== 'jogando') passo(p, DT);
    jogo.atualiza = () => 0; passo(p, DT);          // J1 vence de novo, o escudo do J3 segura
    assert.equal(p.jogadores[0].pontos, 5, 'o primeiro ponto valeu (5), o segundo o escudo segurou');
    assert.equal(p.escudoSegurou, true);
    roda(p, 2.6);
    assert.ok(!oferta(1).includes('escudo') && !oferta(2).includes('escudo'), 'logo depois de um escudo segurar, ninguem recebe escudo');
    for (const j of p.jogadores) j.oferta = null;
    while (p.fase !== 'jogando') passo(p, DT);
    jogo.atualiza = () => 0; passo(p, DT); roda(p, 2.6);       // ponto normal: o freio da rodada solta
    assert.equal(p.escudoSegurou, false);
    assert.ok(!oferta(2).includes('escudo'), 'J3 ja usou o dele nesta partida');
    reinicia(p);
    assert.ok(p.jogadores.every(j => j.escudos === 0) && p.escudoSegurou === false, 'partida nova: cada um tem um escudo de novo');
  } finally { volta(); }
});

test('alvo da partida: em Cada um por si encolhe com mais gente no sofa (2: 10, 3: 8, 4 e 5: 6); Duplas e Duelo seguem em 10', () => {
  const volta = semClassicos();
  [0, 1, 2, 3, 4, 5].forEach(k => registra(falso('f-a' + k, { min: 2, max: 4, modos: ['vs', 'times'] })));
  try {
    assert.deepEqual([2, 3, 4, 5].map(n => criaPartida(sorte, { n, modo: 'vs' }).alvo), [10, 8, 6, 6]);
    assert.equal(criaPartida(sorte, { n: 4, modo: 'times' }).alvo, 10, 'em Duplas o ponto e do time: segue em 10');
    const p = criaPartida(sorte, { n: 4, modo: 'vs' });
    p.jogadores[2].pontos = 5;
    const jogo = JOGOS.find(j => j.id === 'f-a0');
    jogaRodada(p, jogo, 2);
    assert.equal(p.fase, 'fim', 'com 4, o sexto ponto fecha a partida');
    assert.deepEqual(p.campeoes, [2]);
    configura(p, { n: 2, modo: 'vs' });
    assert.equal(p.alvo, 10, 'trocou para 2 jogadores: o alvo acompanha');
  } finally { volta(); }
});

// ---------- Duplas com 5: um descansa e os outros quatro formam duplas que mudam a cada rodada; o ponto e de cada um ----------
test('duplas com 5: a cada rodada um descansa, as duplas mudam e cada um da dupla vencedora ganha o seu ponto', () => {
  const sozinhos = JOGOS.splice(0);
  const jogo = { ...falso('f-d5', { min: 4, max: 4, modos: ['times'] }), inicia(p) { p.dados = { n: p.jogadores.length, modo: p.modo }; } };
  [jogo, classico('c-duelo', () => 0)].forEach(registra);
  try {
    assert.deepEqual(elegiveis('times', 5).map(j => j.id), ['f-d5'], 'com 5 so minijogo de festa: os de 2 ficam para as Duplas de 4');
    const p = criaPartida(sorte, { n: 5, modo: 'times' });
    assert.equal(p.alvo, 6);
    assert.deepEqual(p.duelo, [0, 2, 1, 3], 'primeira rodada: J5 descansa, J1 e J2 contra J3 e J4 (time A nos indices 0 e 2 da vista)');
    assert.deepEqual(p.dados, { n: 4, modo: 'times' }, 'o minijogo ve uma partida de Duplas com 4');
    assert.deepEqual([0, 1, 2, 3, 4].map(i => timeNaRodada(p, i)), [0, 0, 1, 1, -1]);
    while (p.fase !== 'jogando') passo(p, DT);
    jogo.atualiza = () => 0; passo(p, DT);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 1, 0, 0, 0], 'J1 e J2 venceram juntos: um ponto para cada');
    assert.ok(venceu(p, 0) && venceu(p, 1) && !venceu(p, 2) && !venceu(p, 4));
    assert.deepEqual(p.jogadores.map(j => j.direito), [false, false, true, true, false], 'quem descansou nao perdeu');
    // em 15 rodadas cada um descansa 3 vezes e faz dupla 3 vezes com cada um dos outros
    reinicia(p);
    const descansos = [0, 0, 0, 0, 0], juntos = {};
    for (let k = 0; k < 15; k++) {
      const d = p.duelo;
      descansos[[0, 1, 2, 3, 4].find(i => !d.includes(i))]++;
      for (const [a, b] of [[d[0], d[2]], [d[1], d[3]]]) { const ch = [a, b].sort().join('-'); juntos[ch] = (juntos[ch] ?? 0) + 1; }
      pulaPara(p);
    }
    assert.deepEqual(descansos, [3, 3, 3, 3, 3]);
    assert.equal(Object.keys(juntos).length, 10, 'todo mundo faz dupla com todo mundo');
    assert.ok(Object.values(juntos).every(v => v === 3), JSON.stringify(juntos));
  } finally { JOGOS.splice(0, JOGOS.length, ...sozinhos); }
});

// ---------- quem saiu do sofa nao entra na rodada (a tela marca p.ausentes) ----------
test('ausentes: quem saiu do sofa fica de fora da rodada e volta quando reconectar', () => {
  const volta = semClassicos();
  const jogo = { ...falso('f-au', { min: 2, max: 4, modos: ['vs', 'coop'] }), inicia(p) { p.dados = { n: p.jogadores.length }; } };
  registra(jogo);
  try {
    const p = criaPartida(sorte, { n: 4, modo: 'vs' });
    assert.equal(p.duelo, null);
    p.ausentes = [false, false, true, false];
    pulaPara(p);
    assert.deepEqual(p.duelo, [0, 1, 3], 'J3 saiu: jogam os outros tres');
    assert.equal(p.dados.n, 3);
    assert.equal(p.jogadores[2].pronto, true, 'ninguem espera o Entendi de quem saiu');
    while (p.fase !== 'jogando') passo(p, DT);
    jogo.atualiza = () => 2; passo(p, DT);          // venceu o terceiro dos que jogaram
    assert.equal(p.vencedor, 3);
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0, 1]);
    p.ausentes = [false, false, false, false];
    roda(p, 2.6);
    assert.equal(p.duelo, null, 'J3 voltou: a rodada seguinte e com os quatro');
    p.ausentes = [false, true, true, true];
    pulaPara(p);
    assert.equal(p.duelo, null, 'so sobrou um: a ausencia nao vale para o motor (a tela e que encerra a partida)');
    const c = criaPartida(sorte, { n: 5, modo: 'vs' });
    c.ausentes = [false, false, false, true, false];
    pulaPara(c);
    assert.deepEqual(c.duelo, [0, 1, 2, 4], 'com 5 no sofa e um ausente, ninguem precisa descansar');
  } finally { volta(); }
});

// ---------- itens de rodada (spec 009): comprados na Loja do celular, usados durante a rodada, com limite ----------
import { ITENS, usaItem, itemLiberado, ITENS_POR_RODADA, ITENS_POR_PARTIDA, T_SEM_ITEM, T_IMUNE_ITEM } from './logica.mjs';

// Rodada de mentira que nunca acaba sozinha, ja na fase 'jogando' e depois dos 3 s sem item. Jogadores em fila no eixo x (J1 em 0, J2 em 3, J3 em 6...).
function rodadaItens({ n = 4, modo = 'vs', extra = {}, festa = { min: 2, max: 5, modos: ['vs', 'times', 'coop'] }, t = T_SEM_ITEM + 0.5 } = {}) {
  const jogo = { ...falso('f-itens', festa), ...extra, inicia(p) { p.dados = {}; p.arena = { tipo: 'ret', lx: 40, lz: 40, parede: true }; p.jogadores.forEach((j, i) => { j.x = i * 3; }); } };
  if (!festa) delete jogo.festa;
  registra(jogo);
  const p = criaPartida(sorte, { n, modo });
  p.duelos = 0;       // a rodada sorteada na criacao nao conta: o revezamento comeca do primeiro par
  pulaPara(p, jogo);
  while (p.fase !== 'jogando') passo(p, DT);
  roda(p, t);
  return p;
}
const parado = { x: 0, y: 0, d: false, b: false };

test('itens: catalogo com os cinco itens e os limites', () => {
  assert.deepEqual(ITENS.map(k => k.id), ['bomba', 'gelo', 'turbo', 'guarda', 'tinta']);
  for (const k of ITENS) assert.ok(typeof k.nome === 'string' && k.nome && typeof k.dica === 'string' && k.dica, k.id);
  assert.equal(new Set(ITENS.map(k => k.nome)).size, ITENS.length);
  assert.ok(!ITENS.some(k => k.nome === 'Escudo'), 'nao confunde com a carta de poder Escudo');
  assert.deepEqual([ITENS_POR_RODADA, ITENS_POR_PARTIDA, T_SEM_ITEM, T_IMUNE_ITEM], [1, 3, 3, 4]);
});

test('itens: a bomba acerta o rival mais proximo e o atordoa por 1,5 s (joystick zerado, botoes e escolhas ignorados)', () => {
  try {
    const p = rodadaItens();
    entrada(p, 1, { x: 1, y: 0, d: false, n: 0, nb: 0, nop: 0 });
    assert.equal(usaItem(p, 0, 'bomba'), true);
    const alvo = p.jogadores[1];
    assert.ok(Math.abs(alvo.tonto - 1.5) < 1e-9, 'o mais perto de J1 e J2');
    assert.equal(p.jogadores[2].tonto ?? 0, 0);
    assert.deepEqual(alvo.ent, parado, 'joystick zerado na hora');
    entrada(p, 1, { x: 1, y: 0, d: true, n: 1, b: true, nb: 1, op: 2, nop: 1 });
    assert.deepEqual(alvo.ent, parado, 'joystick segue zerado');
    assert.equal(alvo.apertouA, 0); assert.equal(alvo.apertouB, 0); assert.equal(alvo.escolha, -1);
    alvo.vx = 0;
    const x0 = alvo.x;
    roda(p, 1.4);
    assert.ok(Math.abs(alvo.x - x0) < 0.2, 'atordoado nao anda: ' + (alvo.x - x0));
    assert.ok(alvo.tonto > 0);
    roda(p, 0.2);
    assert.equal(alvo.tonto, 0);
    assert.equal(alvo.ent.x, 1, 'o joystick que o dedo segurava volta a valer sozinho');
    roda(p, 0.5);
    assert.ok(alvo.x - x0 > 1, 'e ele anda de novo');
    entrada(p, 1, { x: 0, y: 0, d: true, n: 2, nb: 1, op: 1, nop: 2 });
    assert.equal(alvo.apertouA, 1); assert.equal(alvo.escolha, 1);
  } finally { limpa(); }
});

test('itens: o mais proximo e medido pela posicao, nao pelo indice', () => {
  try {
    const p = rodadaItens();
    p.jogadores[3].x = 0.5; p.jogadores[3].z = 1;
    assert.equal(usaItem(p, 0, 'bomba'), true);
    assert.ok(p.jogadores[3].tonto > 0);
    assert.equal(p.jogadores[1].tonto ?? 0, 0);
  } finally { limpa(); }
});

test('itens: em minijogo sem posicao (semMovimento ou sem joystick) o alvo e o lider do placar', () => {
  try {
    for (const extra of [{ semMovimento: true }, { controle: { modo: 'opcoes' } }]) {
      const p = rodadaItens({ extra });
      p.jogadores[2].pontos = 4; p.jogadores[1].pontos = 2;
      assert.equal(usaItem(p, 0, 'bomba'), true);
      assert.ok(p.jogadores[2].tonto > 0, 'lider');
      assert.equal(p.jogadores[1].tonto ?? 0, 0);
      limpa();
    }
  } finally { limpa(); }
});

test('itens: o lider usa o item no melhor colocado dos outros; empate vai para o proximo na roda', () => {
  try {
    const p = rodadaItens({ extra: { semMovimento: true } });
    p.jogadores[2].pontos = 4; p.jogadores[1].pontos = 2;
    assert.equal(usaItem(p, 2, 'bomba'), true);
    assert.ok(p.jogadores[1].tonto > 0, 'o lider acerta o segundo');
    const q = rodadaItens({ extra: { semMovimento: true } });
    assert.equal(usaItem(q, 2, 'bomba'), true);
    assert.ok(q.jogadores[3].tonto > 0, 'todos empatados: o proximo depois de quem jogou');
  } finally { limpa(); }
});

test('itens: quem esta atordoado ou congelado nao usa item', () => {
  try {
    const p = rodadaItens();
    assert.equal(usaItem(p, 0, 'bomba'), true);
    assert.equal(itemLiberado(p, 1, 'bomba'), false);
    assert.equal(usaItem(p, 1, 'bomba'), false);
    assert.equal(p.jogadores[1].itensRodada ?? 0, 0);
  } finally { limpa(); }
});

test('itens: gelo congela por 2 s e deixa o chao liso por mais 3 s em minijogo de joystick; nos outros, 1,2 s parado', () => {
  try {
    const p = rodadaItens();
    assert.equal(usaItem(p, 0, 'gelo'), true);
    const alvo = p.jogadores[1];
    assert.ok(Math.abs(alvo.gelo - 2) < 1e-9); assert.ok(Math.abs(alvo.liso - 5) < 1e-9);
    entrada(p, 1, { x: 1, y: 0, d: true, n: 5 });
    assert.deepEqual(alvo.ent, parado);
    roda(p, 2.1);
    assert.equal(alvo.gelo, 0); assert.ok(alvo.liso > 2.8);
    // liso: com o mesmo empurrao, desliza bem mais que o normal
    const livre = p.jogadores[3];
    for (const j of [alvo, livre]) { j.ent = { ...parado }; j.vx = 8; j.vz = 0; j.z += 20 * (j === alvo ? 1 : -1); }
    const xa = alvo.x, xl = livre.x;
    roda(p, 1);
    assert.ok(alvo.x - xa > (livre.x - xl) * 1.5, `liso ${alvo.x - xa} x normal ${livre.x - xl}`);
    roda(p, 2.2);
    assert.equal(alvo.liso, 0);
    const q = rodadaItens({ extra: { semMovimento: true } });
    assert.equal(usaItem(q, 0, 'gelo'), true);
    const b = q.jogadores.find(j => j.gelo > 0);
    assert.ok(Math.abs(b.gelo - 1.2) < 1e-9); assert.equal(b.liso ?? 0, 0);
  } finally { limpa(); }
});

test('itens: turbo deixa quem usou mais rapido por 4 s e so vale em minijogo em que o motor move o boneco', () => {
  try {
    const p = rodadaItens();
    for (const i of [0, 3]) { p.jogadores[i].z = i ? 20 : -20; p.jogadores[i].x = 0; entrada(p, i, { x: 1, y: 0 }); }
    assert.equal(usaItem(p, 0, 'turbo'), true);
    assert.ok(Math.abs(p.jogadores[0].turboItem - 4) < 1e-9);
    roda(p, 2);
    assert.ok(p.jogadores[0].x > p.jogadores[3].x * 1.25, `turbo ${p.jogadores[0].x} x normal ${p.jogadores[3].x}`);
    roda(p, 2.1);
    assert.equal(p.jogadores[0].turboItem, 0);
    for (const extra of [{ semMovimento: true }, { controle: { modo: 'botao' } }, { controle: { joystick: false } }]) {
      const q = rodadaItens({ extra });
      assert.equal(itemLiberado(q, 0, 'turbo'), false);
      assert.equal(usaItem(q, 0, 'turbo'), false);
      assert.equal(q.jogadores[0].itensRodada ?? 0, 0, 'recusado nao conta no limite');
      assert.equal(itemLiberado(q, 0, 'bomba'), true);
      limpa();
    }
  } finally { limpa(); }
});

test('itens: o guarda-chuva bloqueia o proximo item jogado em quem abriu, e so um', () => {
  try {
    const p = rodadaItens();
    assert.equal(usaItem(p, 1, 'guarda'), true);
    assert.equal(p.jogadores[1].guarda, true);
    assert.equal(usaItem(p, 0, 'bomba'), true, 'quem jogou gasta o item mesmo bloqueado');
    assert.equal(p.jogadores[1].tonto ?? 0, 0);
    assert.equal(p.jogadores[1].guarda, false);
    assert.equal(p.itens.at(-1).bloqueado, true);
    assert.ok(p.eventos.includes('item-bloqueio'));
    roda(p, T_IMUNE_ITEM + 0.1);
    p.jogadores[2].x = 3.1; p.jogadores[2].z = 5;       // J3 perto de J2
    assert.equal(usaItem(p, 2, 'bomba'), true);
    assert.ok(p.jogadores[1].tonto > 0, 'o segundo item passa');
  } finally { limpa(); }
});

test('itens: o guarda-chuva vale so na rodada em que foi aberto', () => {
  try {
    const p = rodadaItens();
    assert.equal(usaItem(p, 1, 'guarda'), true);
    pulaPara(p, JOGOS.find(j => j.id === 'f-itens'));
    assert.ok(!p.jogadores[1].guarda);
  } finally { limpa(); }
});

test('itens: a tinta marca o alvo por 3 s e nao mexe no controle', () => {
  try {
    const p = rodadaItens();
    entrada(p, 1, { x: 1, y: 0 });
    assert.equal(usaItem(p, 0, 'tinta'), true);
    const alvo = p.jogadores[1];
    assert.ok(Math.abs(alvo.tinta - 3) < 1e-9);
    assert.equal(alvo.ent.x, 1);
    assert.equal(alvo.tonto ?? 0, 0);
    roda(p, 3.1);
    assert.equal(alvo.tinta, 0);
  } finally { limpa(); }
});

test('itens: cada jogador usa 1 por rodada e 3 por partida; a partida nova zera', () => {
  try {
    const p = rodadaItens();
    const jogo = JOGOS.find(j => j.id === 'f-itens');
    const novaRodada = () => { pulaPara(p, jogo); while (p.fase !== 'jogando') passo(p, DT); roda(p, T_SEM_ITEM + 0.5); };
    assert.equal(usaItem(p, 0, 'guarda'), true);
    assert.equal(itemLiberado(p, 0, 'bomba'), false);
    assert.equal(usaItem(p, 0, 'bomba'), false, 'segundo item na mesma rodada');
    assert.equal(usaItem(p, 1, 'guarda'), true, 'o limite e de cada um');
    novaRodada(); assert.equal(usaItem(p, 0, 'guarda'), true);
    novaRodada(); assert.equal(usaItem(p, 0, 'guarda'), true);
    assert.equal(p.jogadores[0].itensPartida, 3);
    novaRodada();
    assert.equal(itemLiberado(p, 0, 'guarda'), false);
    assert.equal(usaItem(p, 0, 'guarda'), false, 'quarto item da partida');
    assert.equal(usaItem(p, 1, 'guarda'), true);
    reinicia(p);
    assert.deepEqual(p.jogadores.map(j => j.itensPartida), [0, 0, 0, 0], 'partida nova');
    assert.ok(p.jogadores.every(j => j.itemGasto === null), 'e o ultimo gasto nao fica para a partida seguinte');
  } finally { limpa(); }
});

test('itens: nada nos primeiros 3 s da rodada, na explicacao, nem depois que a rodada acabou', () => {
  try {
    const p = rodadaItens({ t: 0 });
    assert.equal(usaItem(p, 0, 'bomba'), false);
    roda(p, T_SEM_ITEM - 0.2);
    assert.equal(itemLiberado(p, 0, 'bomba'), false);
    assert.equal(usaItem(p, 0, 'bomba'), false);
    roda(p, 0.3);
    assert.equal(itemLiberado(p, 0, 'bomba'), true);
    p.dados.fimCedo = 1;       // decidida antes dos 5 s (comMinimo): ja acabou para efeito de item
    assert.equal(usaItem(p, 0, 'bomba'), false);
    delete p.dados.fimCedo;
    p.dados.resposta = 1; passo(p, DT);
    assert.equal(p.fase, 'resultado');
    assert.equal(usaItem(p, 0, 'bomba'), false);
    assert.equal(p.jogadores[0].itensRodada ?? 0, 0);
    pulaPara(p, JOGOS.find(j => j.id === 'f-itens'));
    assert.equal(p.fase, 'intro');
    assert.equal(usaItem(p, 0, 'bomba'), false);
  } finally { limpa(); }
});

test('itens: quem foi atingido fica imune por 4 s; o item vai para outro rival e, sem rival livre, nao gasta', () => {
  try {
    const p = rodadaItens({ n: 3 });
    assert.equal(usaItem(p, 0, 'bomba'), true);       // J2 (mais perto de J1)
    assert.ok(Math.abs(p.jogadores[1].imuneItem - T_IMUNE_ITEM) < 1e-9);
    assert.equal(usaItem(p, 2, 'tinta'), true);       // J3 esta mais perto de J2, mas J2 esta imune: vai em J1
    assert.equal(p.jogadores[1].tinta ?? 0, 0);
    assert.ok(p.jogadores[0].tinta > 0);
    limpa();
    const q = rodadaItens({ n: 2, festa: { min: 2, max: 2, modos: ['vs'] } });
    assert.equal(usaItem(q, 0, 'tinta'), true);
    q.jogadores[0].itensRodada = 0;       // so para isolar a imunidade do limite da rodada
    assert.equal(usaItem(q, 0, 'bomba'), false, 'unico rival imune');
    assert.equal(q.jogadores[0].itensRodada, 0);
    assert.equal(q.jogadores[1].tonto ?? 0, 0);
    roda(q, T_IMUNE_ITEM + 0.1);
    assert.equal(usaItem(q, 0, 'bomba'), true);
  } finally { limpa(); }
});

test('itens: nao valem no cooperativo', () => {
  try {
    const p = rodadaItens({ modo: 'coop', festa: { min: 2, max: 5, modos: ['coop'] } });
    assert.equal(p.jogo.id, 'f-itens');
    for (const k of ITENS) { assert.equal(itemLiberado(p, 0, k.id), false, k.id); assert.equal(usaItem(p, 0, k.id), false, k.id); }
    assert.deepEqual(p.itens, []);
  } finally { limpa(); }
});

test('itens: em Duplas o parceiro nunca e alvo', () => {
  try {
    const p = rodadaItens({ modo: 'times' });
    p.jogadores[2].x = 0.5; p.jogadores[2].z = 2;       // o parceiro de J1 (J3) perto dele; rivais J2 em 3 e J4 em 9
    assert.equal(usaItem(p, 0, 'bomba'), true);
    assert.equal(p.jogadores[2].tonto ?? 0, 0);
    assert.ok(p.jogadores[1].tonto > 0);
    limpa();
    const q = rodadaItens({ modo: 'times', extra: { semMovimento: true } });
    q.jogadores[2].pontos = 5;       // forca um "lider" no time de quem joga
    assert.equal(usaItem(q, 0, 'bomba'), true);
    assert.equal(q.jogadores[2].tonto ?? 0, 0);
  } finally { limpa(); }
});

test('itens: quem esta de fora da rodada nao usa nem e alvo (Duplas com minijogo de 2 e rodizio com 5)', () => {
  const volta = semClassicos();
  try {
    const p = rodadaItens({ modo: 'times', festa: null });       // minijogo de 2: joga um de cada dupla
    assert.deepEqual(p.duelo, [0, 1]);
    assert.equal(itemLiberado(p, 2, 'bomba'), false);
    assert.equal(usaItem(p, 2, 'bomba'), false);
    assert.equal(usaItem(p, 0, 'bomba'), true);
    assert.ok(p.jogadores[1].tonto > 0);
    limpa();
    const q = rodadaItens({ n: 5, festa: { min: 2, max: 4, modos: ['vs'] } });
    assert.deepEqual(q.duelo, [0, 1, 2, 3]);
    assert.equal(usaItem(q, 4, 'bomba'), false, 'quem descansa nao usa');
    q.jogadores[4].x = 9.2; q.jogadores[4].z = 0;       // quem descansa "ao lado" de J4 nao vira alvo
    assert.equal(usaItem(q, 3, 'bomba'), true);
    assert.equal(q.jogadores[4].tonto ?? 0, 0);
    assert.ok(q.jogadores[2].tonto > 0);
  } finally { limpa(); volta(); }
});

test('itens: minijogo que declara semItens recusa todos', () => {
  try {
    const p = rodadaItens({ extra: { semItens: true } });
    for (const k of ITENS) { assert.equal(itemLiberado(p, 0, k.id), false); assert.equal(usaItem(p, 0, k.id), false); }
  } finally { limpa(); }
});

test('itens: quem caiu (fora do jogo) nao usa nem e alvo', () => {
  try {
    const p = rodadaItens();
    p.jogadores[1].vivo = false;
    assert.equal(usaItem(p, 1, 'bomba'), false);
    assert.equal(usaItem(p, 0, 'bomba'), true);
    assert.equal(p.jogadores[1].tonto ?? 0, 0);
    assert.ok(p.jogadores[2].tonto > 0);
  } finally { limpa(); }
});

test('itens: pelo celular (it e contador ni), cada toque conta uma vez e o gasto so e registrado quando o motor aceita', () => {
  try {
    const p = rodadaItens();
    const j = p.jogadores[0];
    entrada(p, 0, { x: 0, y: 0, it: 0, ni: 7 });       // primeira mensagem: so a base do contador
    assert.equal(j.itensRodada ?? 0, 0); assert.equal(j.itemGasto ?? null, null);
    entrada(p, 0, { x: 0, y: 0, it: 0, ni: 8 });
    assert.equal(j.itensRodada, 1);
    assert.equal(j.itemGasto.id, 'bomba');
    const serie = j.itemGasto.n;
    assert.ok(p.jogadores[1].tonto > 0);
    for (let k = 0; k < 3; k++) entrada(p, 0, { x: 0, y: 0, it: 0, ni: 8 });       // o mesmo toque repetido (sinal de vida)
    assert.equal(j.itensPartida, 1); assert.equal(j.itemGasto.n, serie);
    entrada(p, 0, { x: 0, y: 0, it: 4, ni: 9 });       // segundo item na rodada: recusado, nada gasto
    assert.equal(j.itemGasto.n, serie); assert.equal(j.itensPartida, 1);
    assert.equal(j.itensNegados, 1);
    entrada(p, 2, { x: 0, y: 0, it: 3, ni: 1 }); entrada(p, 2, { x: 0, y: 0, it: 3, ni: 2 });
    assert.equal(p.jogadores[2].itemGasto.id, 'guarda');
    assert.ok(p.jogadores[2].itemGasto.n > serie, 'cada gasto tem um numero de serie proprio na partida');
    entrada(p, 0, { x: 0, y: 0, it: 0, ni: 3 });       // contador menor (celular recarregou): so acerta a base
    assert.equal(j.itensNegados, 1);
  } finally { limpa(); }
});

test('itens: pausado (semToque) o contador acompanha e o toque nao vale depois', () => {
  try {
    const p = rodadaItens();
    entrada(p, 0, { x: 0, y: 0, it: 0, ni: 1 });
    entrada(p, 0, { x: 0, y: 0, it: 0, ni: 2 }, true);
    entrada(p, 0, { x: 0, y: 0, it: 0, ni: 2 });
    assert.equal(p.jogadores[0].itensRodada ?? 0, 0);
    assert.deepEqual(p.itens, []);
  } finally { limpa(); }
});

test('itens: valores tortos vindos da rede nao quebram nem gastam', () => {
  try {
    const p = rodadaItens();
    const j = p.jogadores[0];
    entrada(p, 0, { x: 0, y: 0, it: 0, ni: 1 });
    let ni = 1;
    for (const it of [-1, 5, 99, 1.5, '0', null, undefined, {}, [], 'constructor', '__proto__', 'length', NaN, Infinity, true])
      assert.doesNotThrow(() => entrada(p, 0, { x: 0, y: 0, it, ni: ++ni }), String(it));
    for (const torto of ['9999', 1e12 + 0.5, null, {}, NaN, -3, Infinity])
      assert.doesNotThrow(() => entrada(p, 0, { x: 0, y: 0, it: 0, ni: torto }), String(torto));
    assert.equal(j.itensRodada ?? 0, 0); assert.equal(j.itemGasto ?? null, null);
    assert.deepEqual(p.itens, []);
    for (const id of [undefined, null, 'nada', 'constructor', '__proto__', 0, {}]) assert.equal(usaItem(p, 0, id), false);
    for (const i of [-1, 9, 1.5, 'x', undefined]) { assert.equal(usaItem(p, i, 'bomba'), false); assert.equal(itemLiberado(p, i, 'bomba'), false); }
    assert.ok(Number.isInteger(j.ni), 'o contador guardado continua inteiro');
    entrada(p, 0, { x: 0, y: 0, it: 0, ni: j.ni + 1 });
    assert.equal(j.itensRodada, 1, 'e o proximo toque de verdade vale');
  } finally { limpa(); }
});

test('itens: cada uso vira evento de som e entra no registro p.itens da rodada (quem, em quem, quando)', () => {
  try {
    const p = rodadaItens();
    p.eventos.length = 0;
    usaItem(p, 0, 'bomba'); usaItem(p, 1, 'tinta'); usaItem(p, 2, 'turbo'); usaItem(p, 3, 'guarda');
    assert.deepEqual(p.eventos, ['item-bomba', 'item-turbo', 'item-guarda'], 'J2 atordoado nao jogou a tinta');
    assert.deepEqual(p.itens.map(u => [u.id, u.de, u.para]), [['bomba', 0, 1], ['turbo', 2, 2], ['guarda', 3, 3]]);
    assert.ok(p.itens.every(u => Math.abs(u.t - p.t) < 1e-9 && !u.bloqueado));
    pulaPara(p, JOGOS.find(j => j.id === 'f-itens'));
    assert.deepEqual(p.itens, [], 'rodada nova, registro novo');
    for (const j of p.jogadores) for (const k of ['tonto', 'gelo', 'liso', 'turboItem', 'tinta', 'imuneItem']) assert.equal(j[k], 0, k);
  } finally { limpa(); }
});

test('itens: funcionam no Duelo (classico) e nao em minijogo cooperativo do Duelo', () => {
  try {
    const p = rodadaItens({ n: 2, modo: 'classico', festa: null });
    assert.equal(usaItem(p, 1, 'gelo'), true);
    assert.ok(p.jogadores[0].gelo > 0);
    limpa();
    const q = rodadaItens({ n: 2, modo: 'classico', festa: null, extra: { coop: true } });
    assert.equal(usaItem(q, 0, 'bomba'), false);
  } finally { limpa(); }
});
