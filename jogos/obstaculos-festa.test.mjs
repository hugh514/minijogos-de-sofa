import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { META, LIMITE, ATRASO_MAX, centroDe, bate } from './obstaculos-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const textos = p => [p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? '')];
const limpa = p => { p.dados.pista.length = 0; };       // pista sem obstaculos: so a corrida

test('obstaculos-festa: contrato da festa, tempo, rotulo e genero', () => {
  assert.equal(jogo.id, 'obstaculos-festa');
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, LIMITE);
  assert.ok(LIMITE >= 20 && LIMITE <= 50);
  assert.equal(jogo.genero, 'corrida');
  assert.equal(jogo.controle.a, '', 'o botao A nao faz nada: fica escondido');
});

test('obstaculos-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel, e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.b];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    todos.push(...textos(p));
    roda(p, 6); todos.push(...textos(p));
    for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT);
    todos.push(...textos(p));
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('obstaculos-festa: com 2, 3 e 4 cada um larga na sua raia, lado a lado, todos na mesma linha', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(p.jogadores.length, o.n);
    assert.equal(d.dist.length, o.n);
    assert.deepEqual(d.placar, Array(o.modo === 'times' ? 2 : o.n).fill(0));
    p.jogadores.forEach((j, i) => {
      assert.ok(Math.abs(j.x - centroDe(o.n, i)) < 0.2, 'no meio da raia');
      assert.ok(Math.abs(j.x) < p.arena.lx, 'dentro da arena');
      if (i) assert.ok(j.x > p.jogadores[i - 1].x + 3, 'raias separadas');
      assert.equal(j.z, p.jogadores[0].z);
    });
    assert.ok(d.pista.length > 10, 'pista com obstaculos');
    assert.ok(d.pista.every((x, k) => x.s > 8 && x.s < META && (!k || x.s - d.pista[k - 1].s >= 5)), 'obstaculos espacados, depois da largada e antes da chegada');
  }
});

test('obstaculos-festa: todos correm sozinhos ao mesmo tempo e ninguem sai da propria raia', () => {
  const p = partidaCom(jogo, undefined, vs(4)), d = p.dados;
  limpa(p);
  for (let k = 0; k < 180; k++) { entrada(p, 0, { x: 1, y: 1 }); entrada(p, 3, { x: -1, y: -1 }); passo(p, DT); }
  assert.ok(d.dist.every(v => v > 10), 'todos andaram: ' + d.dist);
  assert.equal(new Set(d.dist.map(v => v.toFixed(3))).size, 1, 'sem obstaculo, todos iguais');
  p.jogadores.forEach((j, i) => assert.ok(Math.abs(j.x - centroDe(4, i)) < 2.4, `J${i + 1} na raia`));
  assert.ok(p.jogadores[0].x > centroDe(4, 0) + 0.8 && p.jogadores[3].x < centroDe(4, 3) - 0.8, 'o joystick desvia para o lado');
  assert.equal(p.jogadores[0].z, p.jogadores[1].z, 'o joystick nao adianta nem atrasa');
});

test('obstaculos-festa: bate() pega a barra no chao e o bloco no caminho', () => {
  assert.equal(bate({ barra: true }, 0, 0), true);
  assert.equal(bate({ barra: true }, 0, 0.9), false, 'pulando passa');
  const bloco = { blocos: [[-2.4, -0.1]] };
  assert.equal(bate(bloco, -1, 0), true);
  assert.equal(bate(bloco, 0, 0), true, 'parado no meio bate');
  assert.equal(bate(bloco, 1.2, 0), false, 'desviou');
  assert.equal(bate(bloco, -1, 1.2), true, 'bloco alto: pular nao adianta');
});

test('obstaculos-festa: quem bate na barra tropeca, vibra e fica para tras; quem pula com B passa', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  d.pista.length = 0; d.pista.push({ s: 12, barra: true, caiu: [false, false] });
  entrada(p, 1, { x: 0, y: 0, b: false, nb: 0 });
  let pulou = false;
  for (let k = 0; k < 240; k++) {
    if (!pulou && d.dist[1] > 10.3) { entrada(p, 1, { x: 0, y: 0, b: true, nb: 1 }); pulou = true; }
    passo(p, DT);
  }
  assert.equal(d.pista[0].caiu[0], true, 'J1 derrubou a barra');
  assert.equal(d.pista[0].caiu[1], false, 'J2 pulou');
  assert.equal(p.celular[0].vibra, 1);
  assert.equal(p.celular[1].vibra ?? 0, 0);
  assert.ok(d.dist[1] - d.dist[0] > 2, 'quem tropecou ficou para tras: ' + d.dist);
  assert.ok(p.jogadores[0].z > p.jogadores[1].z + 2, 'e aparece atras na tela');
});

test('obstaculos-festa: desviar do bloco com o joystick nao tropeca', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  d.pista.length = 0; d.pista.push({ s: 14, blocos: [[-2.4, -0.1]], caiu: [false, false, false] });
  for (let k = 0; k < 240; k++) { entrada(p, 0, { x: 1, y: 0 }); passo(p, DT); }
  assert.deepEqual(d.pista[0].caiu, [false, true, true]);
});

test('obstaculos-festa: quem fica muito para tras e puxado pelo pelotao (da para virar ate o fim)', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  limpa(p);
  d.dist[0] = 60; passo(p, DT);
  assert.ok(d.dist[0] - d.dist[1] <= ATRASO_MAX + 1e-6 && d.dist[0] - d.dist[1] > ATRASO_MAX - 1, 'atraso maximo: ' + d.dist);
  for (const j of p.jogadores) assert.ok(Math.abs(j.z) < p.arena.lz - 0.8, 'todos aparecem na tela');
});

test('obstaculos-festa: em vs vence quem cruza a chegada primeiro', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = partidaCom(jogo, undefined, vs(n)), d = p.dados;
    limpa(p);
    d.dist[w] = META - 1.5;
    passo(p, DT); assert.equal(p.fase, 'jogando');
    roda(p, 1);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, w, `n ${n}`);
    assert.equal(p.jogadores[w].pontos, 1);
    assert.match(p.celular[w].texto, /venceu/);
  }
});

test('obstaculos-festa: em times vale a soma da dupla quando o primeiro cruza a chegada', () => {
  // J1 (time A) cruza, mas a dupla B esta junta logo atras e a soma dela e maior
  let p = partidaCom(jogo, undefined, times), d = p.dados;
  limpa(p);
  d.dist = [META - 1, META - 3, META - 8, META - 3];
  roda(p, 1);
  assert.equal(p.vencedor, 1, 'time B: soma maior');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
  p = partidaCom(jogo, undefined, times); d = p.dados;
  limpa(p);
  d.dist = [META - 1, META - 6, META - 3, META - 5];
  roda(p, 1);
  assert.equal(p.vencedor, 0, 'o time, nunca o indice');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  assert.equal(d.placar.length, 2);
});

test('obstaculos-festa: no fim do tempo vence quem foi mais longe', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  limpa(p);
  d.vel.fill(0); d.tonto.fill(999);        // todos travados: ninguem chega
  d.dist = [20, 26, 22];
  roda(p, LIMITE - 0.5); assert.equal(p.fase, 'jogando');
  roda(p, 0.7);
  assert.equal(p.vencedor, 1);
});

test('obstaculos-festa: empate da -1 (todos parados batem em tudo igual, em vs e em times)', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, -1, JSON.stringify(o));
    assert.match(p.dados.aviso, /Empate/);
  }
});

test('obstaculos-festa: o celular mostra o lugar e quanto falta', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  limpa(p);
  d.dist = [30, 34, 32]; passo(p, DT);
  assert.match(p.celular[1].texto, /^1º lugar\. Faltam \d+ m$/);
  assert.match(p.celular[0].texto, /^3º lugar/);
  assert.match(p.celular[2].texto, /^2º lugar/);
});

test('obstaculos-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times, sem NaN', () => {
  for (const o of COMBOS) {
    const vencedores = fumaca(jogo, o);
    assert.equal(vencedores.length, 15);
  }
});

test('obstaculos-festa: dedos aleatorios terminam no tempo, com placar finito', () => {
  for (const o of COMBOS) {
    const { p, segundos } = rodada(jogo, aleatorio, 5, o);
    assert.ok(segundos <= LIMITE + 0.1 && segundos > 15, 'durou ' + segundos);
    assert.ok(p.dados.placar.every(Number.isFinite));
  }
});
