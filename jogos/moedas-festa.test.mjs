import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, META_VS, META_TIMES, raioDe, qtdMoedas } from './moedas-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const comum = p => p.dados.moedas.findIndex(m => m.valor === 1);
// Poe o jogador i em cima de uma moeda (a comum, ou a grande) e deixa o motor rodar um quadro.
function pega(p, i, grande = false) {
  const m = p.dados.moedas.find(q => (q.valor > 1) === grande);
  Object.assign(p.jogadores[i], { x: m.x, z: m.z, y: 0, vx: 0, vz: 0 });
  passo(p, DT);
}
function ate(p, i, alvo) { while (p.fase === 'jogando' && p.dados.pessoais[i] < alvo) pega(p, i); }
const parados = (p, s) => { for (let k = 0; k < s * 60 && p.fase === 'jogando'; k++) { p.jogadores.forEach(j => Object.assign(j, { vx: 0, vz: 0 })); passo(p, DT); } };

test('moedas-festa: contrato da festa, tempo de 20 a 50 s, genero e dica em uma frase', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.genero, 'corrida');
  assert.equal(jogo.rotulo, 'moedas');
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
  assert.doesNotMatch(jogo.nome + jogo.dica, /[\u2013\u2014]|[A-ZÀ-Ý]{3,}/u);
});

test('moedas-festa: arena, moedas no chao e posicoes iniciais crescem com n e cabem na arena', () => {
  let anterior = 0, qtd = 0;
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.equal(p.arena.raio, raioDe(n));
    assert.ok(p.arena.raio > anterior); anterior = p.arena.raio;
    assert.equal(p.dados.moedas.length, qtdMoedas(n));
    assert.ok(p.dados.moedas.length > qtd); qtd = p.dados.moedas.length;
    assert.equal(p.jogadores.length, n);
    for (const j of p.jogadores) assert.ok(Math.hypot(j.x, j.z) < p.arena.raio - 1);
    for (const m of p.dados.moedas) assert.ok(Math.hypot(m.x, m.z) <= p.arena.raio - 1.5 + 1e-9);
    assert.equal(p.dados.placar.length, n);
  }
});

test('moedas-festa: pegar uma moeda comum vale 1 e ela reaparece em outro ponto', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  const k = comum(p), antes = { ...p.dados.moedas[k] };
  pega(p, 1);
  assert.deepEqual(p.dados.placar, [0, 1, 0]);
  assert.equal(p.dados.moedas.length, qtdMoedas(3));
  assert.notDeepEqual([p.dados.moedas[k].x, p.dados.moedas[k].z], [antes.x, antes.z]);
  assert.match(p.celular[1].texto, /^Você: 1 de 30 moedas$/);
});

test('moedas-festa: a moeda grande vale 3, aparece depois de alguns segundos e some sozinha', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  assert.ok(!p.dados.moedas.some(m => m.valor > 1), 'no comeco so ha moedas comuns');
  roda(p, 6.5);
  assert.equal(p.dados.moedas.filter(m => m.valor === 3).length, 1);
  pega(p, 0, true);
  assert.equal(p.dados.placar[0], 3);
  assert.ok(!p.dados.moedas.some(m => m.valor > 1), 'depois de pega, some');
  roda(p, 8.5);
  assert.equal(p.dados.moedas.filter(m => m.valor === 3).length, 1, 'volta uma nova');
  parados(p, 7.5);
  assert.ok(!p.dados.moedas.some(m => m.valor > 1), 'ninguem pegou: sumiu');
});

test('moedas-festa: vs devolve o indice de quem chega a meta (cada jogador, com 2, 3 e 4)', () => {
  for (const n of [2, 3, 4]) for (let i = 0; i < n; i++) {
    const p = partidaCom(jogo, undefined, vs(n));
    ate(p, i, META_VS);
    assert.equal(p.fase, 'resultado', `n ${n}, jogador ${i}`);
    assert.equal(p.vencedor, i);
    assert.equal(p.jogadores[i].pontos, 1);
    assert.equal(p.jogadores.filter(j => j.pontos).length, 1, 'so o vencedor pontua');
  }
});

test('moedas-festa: nenhuma moeda sozinha acaba a rodada cedo, e a meta so se alcanca depois de varias', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  ate(p, 0, META_VS - 1);
  assert.equal(p.fase, 'jogando', 'uma moeda antes da meta ainda nao decide');
});

test('moedas-festa: ao decidir, celular e aviso ja estao no estado final', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  ate(p, 1, META_VS);
  assert.equal(p.celular[1].texto, 'Você venceu!');
  assert.equal(p.celular[0].texto, 'Jogador 2 venceu');
  assert.equal(p.dados.aviso, 'Jogador 2 venceu!');
});

test('moedas-festa: times devolvem o time (0 ou 1), somam as moedas dos dois e os dois do time pontuam', () => {
  const a = partidaCom(jogo, undefined, times);       // time A: J1 e J3
  while (a.fase === 'jogando') { pega(a, a.dados.placar[0] % 2 ? 2 : 0); }
  assert.equal(a.vencedor, 0);
  assert.deepEqual(a.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  assert.ok(a.dados.pessoais[0] > 0 && a.dados.pessoais[2] > 0, 'os dois do time contribuiram');
  assert.equal(a.dados.placar[0], a.dados.pessoais[0] + a.dados.pessoais[2]);
  const b = partidaCom(jogo, undefined, times);       // time B: J2 e J4
  while (b.fase === 'jogando') { pega(b, b.dados.placar[1] % 2 ? 3 : 1); }
  assert.equal(b.vencedor, 1);
  assert.deepEqual(b.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
  assert.equal(b.dados.placar.length, 2);
  assert.ok(b.dados.placar[1] >= META_TIMES);
});

test('moedas-festa: em times o celular mostra o time e o proprio total', () => {
  const p = partidaCom(jogo, undefined, times);
  pega(p, 0); pega(p, 2); pega(p, 2);
  assert.equal(p.celular[0].texto, `Seu time: 3 de ${META_TIMES} (você: 1)`);
  assert.equal(p.celular[2].texto, `Seu time: 3 de ${META_TIMES} (você: 2)`);
  assert.equal(p.celular[1].texto, `Seu time: 0 de ${META_TIMES} (você: 0)`);
});

test('moedas-festa: empate no tempo limite (todos zerados) e chegada juntos a meta devolvem -1', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  parados(p, TEMPO + 1);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
  assert.equal(p.celular[0].texto, 'Empate!');
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0, 0]);
  const q = partidaCom(jogo, undefined, vs(2));
  q.dados.placar = [META_VS - 1, META_VS - 1]; q.dados.pessoais = [...q.dados.placar];
  const [m0, m1] = q.dados.moedas.filter(m => m.valor === 1);
  Object.assign(q.jogadores[0], { x: m0.x, z: m0.z, vx: 0, vz: 0 }); Object.assign(q.jogadores[1], { x: m1.x, z: m1.z, vx: 0, vz: 0 });
  passo(q, DT);
  assert.deepEqual(q.dados.placar, [META_VS, META_VS]);
  assert.equal(q.vencedor, -1);
});

test('moedas-festa: no tempo limite vence quem tem mais moedas, em vs e em times', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  ate(p, 2, 3); ate(p, 0, 2);
  parados(p, TEMPO + 1);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 2);
  const t = partidaCom(jogo, undefined, times);
  ate(t, 1, 2); ate(t, 0, 1);
  parados(t, TEMPO + 1);
  assert.equal(t.vencedor, 1, 'time B tem 2 e o A tem 1');
  const e = partidaCom(jogo, undefined, times);
  ate(e, 0, 2); ate(e, 3, 2);
  parados(e, TEMPO + 1);
  assert.equal(e.vencedor, -1, 'dois a dois');
});

test('moedas-festa: duas pessoas na mesma moeda no mesmo quadro, so a mais perto leva', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  const m = p.dados.moedas[comum(p)];
  Object.assign(p.jogadores[0], { x: m.x + 0.5, z: m.z, vx: 0, vz: 0 }); Object.assign(p.jogadores[1], { x: m.x - 0.1, z: m.z, vx: 0, vz: 0 });
  passo(p, DT);
  assert.deepEqual(p.dados.placar, [0, 1]);
});

test('moedas-festa: pular por cima nao pega a moeda', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  const m = p.dados.moedas[0];
  Object.assign(p.jogadores[0], { x: m.x, z: m.z, y: 2, vx: 0, vz: 0, vy: 0 });
  p.jogadores[0].ent.b = false;
  passo(p, DT);
  assert.equal(p.dados.placar[0], 0);
});

test('moedas-festa: botoes do celular nao quebram nada', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  entrada(p, 0, { x: 1, y: 0, d: false, n: 0, nb: 0 });
  entrada(p, 0, { x: 1, y: 0, d: true, n: 1, nb: 1 });
  roda(p, 1);
  assert.deepEqual(p.erros, []);
});

test('moedas-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores em vs e 4 em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});

test('moedas-festa: rodada de dedos aleatorios sempre termina em ate 50 s, em cada modo', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const { segundos } = rodada(jogo, undefined, 3, o);
    assert.ok(segundos <= 50, 'durou ' + segundos);
  }
});
