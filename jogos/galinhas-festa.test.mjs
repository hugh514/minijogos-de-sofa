import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, GALINHAS } from './galinhas-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
// O jogador i encosta no galinheiro k (um quadro).
function vaiAo(p, i, k) { const g = p.dados.casas[k]; poe(p, i, g.x, g.z); passo(p, DT); }
const empurra = (p, i) => { const j = p.jogadores[i], n = (j.n ?? 0) + 1; entrada(p, i, { x: 0, y: 0, d: false, n: n - 1 }); entrada(p, i, { x: 0, y: 0, d: true, n }); };
// Todas as galinhas do jogo: guardadas, na cabeca de alguem e soltas.
const total = p => p.dados.placar.reduce((s, v) => s + v, 0) + p.dados.com.filter(Boolean).length + p.dados.soltas.length;

test('galinhas-festa: contrato da festa, 45 s, rotulo e genero', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, 45);
  assert.equal(TEMPO, 45);
  assert.equal(jogo.rotulo, 'galinhas');
  assert.equal(jogo.genero, 'corrida');
});

test('galinhas-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel, e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    vaiAo(p, 0, 1);
    todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    p.dados.placar[0] += 2; roda(p, TEMPO + 0.5);
    todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('galinhas-festa: cada galinheiro comeca com 3 galinhas e cada um larga perto do seu, longe dos rivais', () => {
  assert.equal(GALINHAS, 3);
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados, donos = o.modo === 'times' ? 2 : o.n;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(d.placar, Array(donos).fill(3));
    assert.equal(d.casas.length, donos);
    assert.deepEqual(d.com, Array(o.n).fill(false));
    assert.equal(d.soltas.length, 0);
    for (const g of d.casas) assert.ok(Math.hypot(g.x, g.z) < p.arena.raio - 2, 'galinheiro dentro da arena');
    for (let a = 0; a < donos; a++) for (let b = a + 1; b < donos; b++)
      assert.ok(Math.hypot(d.casas[a].x - d.casas[b].x, d.casas[a].z - d.casas[b].z) > 8, 'galinheiros separados');
    p.jogadores.forEach((j, i) => {
      const dist = d.casas.map(g => Math.hypot(j.x - g.x, j.z - g.z)), meu = o.modo === 'times' ? i % 2 : i;
      assert.equal(dist.indexOf(Math.min(...dist)), meu, `J${i + 1} larga perto do proprio galinheiro`);
      assert.ok(dist.every((v, k) => k === meu || v > 4), 'longe dos galinheiros rivais');
    });
    roda(p, 2);
    assert.deepEqual(d.placar, Array(donos).fill(3), 'parados, ninguem pega nada');
  }
});

test('galinhas-festa: encostar no galinheiro do rival pega 1, e guardar no seu soma no placar', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  vaiAo(p, 0, 1);
  assert.equal(d.com[0], true);
  assert.deepEqual(d.placar, [3, 2, 3]);
  assert.equal(p.celular[0].vibra, 1, 'vibra ao pegar');
  assert.equal(p.celular[1].vibra, 1, 'vibra ao perder');
  assert.match(p.celular[0].texto, /Leve/);
  assert.ok(p.jogadores[0].turbo < 1, 'quem carrega anda mais devagar');
  vaiAo(p, 0, 2);
  assert.deepEqual(d.placar, [3, 2, 3], 'carrega uma por vez');
  vaiAo(p, 0, 0);
  assert.equal(d.com[0], false);
  assert.deepEqual(d.placar, [4, 2, 3]);
  assert.equal(p.jogadores[0].turbo, 1);
  assert.match(p.celular[0].texto, /4/);
});

test('galinhas-festa: nao pega do proprio galinheiro, nem de galinheiro vazio', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  vaiAo(p, 0, 0);
  assert.equal(d.com[0], false);
  assert.deepEqual(d.placar, [3, 3]);
  d.placar[1] = 0;
  vaiAo(p, 0, 1);
  assert.equal(d.com[0], false);
  assert.deepEqual(d.placar, [3, 0]);
});

test('galinhas-festa: o empurrao de um rival perto derruba a galinha, ela fica solta e outro pode pegar', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  vaiAo(p, 0, 1);
  poe(p, 0, 0, 0); poe(p, 1, 1.7, 0); poe(p, 2, 0, 6);
  empurra(p, 1);
  passo(p, DT);
  assert.equal(d.com[0], false, 'caiu');
  assert.equal(d.soltas.length, 1);
  assert.equal(p.celular[0].vibra, 2, 'vibra ao perder a galinha');
  assert.equal(p.jogadores[0].turbo, 1);
  assert.deepEqual(d.placar, [3, 2, 3], 'solta nao e de ninguem');
  // quem perdeu nao pega de volta na hora
  Object.assign(d.soltas[0], { x: -4, z: 0, vx: 0, vz: 0 }); poe(p, 0, -4, 0); poe(p, 1, 5, 0);
  passo(p, DT);
  assert.equal(d.com[0], false);
  // outro jogador encosta e leva
  Object.assign(d.soltas[0], { x: 0, z: 3, vx: 0, vz: 0 }); poe(p, 0, -6, -3); poe(p, 2, 0, 3);
  passo(p, DT);
  assert.equal(d.com[2], true);
  assert.equal(d.soltas.length, 0);
  vaiAo(p, 2, 2);
  assert.deepEqual(d.placar, [3, 2, 4]);
});

test('galinhas-festa: a galinha solta anda devagar e nunca sai da arena', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  vaiAo(p, 0, 1);
  poe(p, 0, 0, 0); poe(p, 1, 1.7, 0);
  empurra(p, 1); passo(p, DT);
  const antes = { ...d.soltas[0] };
  for (let k = 0; k < 600; k++) {
    poe(p, 0, d.casas[0].x, d.casas[0].z); poe(p, 1, d.casas[1].x, d.casas[1].z);
    passo(p, DT);
    if (!d.soltas.length) break;       // entrou sozinha no caminho de alguem
    assert.ok(Math.hypot(d.soltas[0].x, d.soltas[0].z) <= p.arena.raio - 0.9, 'dentro da arena');
  }
  if (d.soltas.length) assert.notDeepEqual([d.soltas[0].x, d.soltas[0].z], [antes.x, antes.z], 'ela anda');
});

test('galinhas-festa: empurrao de longe nao derruba', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  vaiAo(p, 0, 1);
  poe(p, 0, 0, -5); poe(p, 1, 0, 5);
  empurra(p, 1); passo(p, DT);
  assert.equal(d.com[0], true);
});

test('galinhas-festa: em times ha um galinheiro por time, o parceiro nao pega nem derruba, e a galinha vai para o time', () => {
  const p = partidaCom(jogo, undefined, times), d = p.dados;
  vaiAo(p, 2, 0);                                    // J3 no galinheiro do proprio time (J1 + J3)
  assert.equal(d.com[2], false);
  vaiAo(p, 2, 1);
  assert.equal(d.com[2], true);
  assert.deepEqual(d.placar, [3, 2]);
  assert.equal(p.celular[1].vibra, 1); assert.equal(p.celular[3].vibra, 1);
  poe(p, 2, 0, 0); poe(p, 0, 1.7, 0); poe(p, 1, 0, 7); poe(p, 3, 3, 7);
  empurra(p, 0); passo(p, DT);
  assert.equal(d.com[2], true, 'o parceiro nao derruba');
  roda(p, 1.2);                                      // recarga do empurrao e bonecos se afastam
  poe(p, 2, 0, 0); poe(p, 0, -6, -6); poe(p, 1, 1.7, 0);
  empurra(p, 1); passo(p, DT);
  assert.equal(d.com[2], false, 'o adversario derruba');
  d.soltas.length = 0; d.com[2] = true;
  vaiAo(p, 2, 0);
  assert.deepEqual(d.placar, [4, 2]);
  assert.match(p.celular[0].texto, /4/, 'o parceiro ve as galinhas do time');
});

test('galinhas-festa: a rodada so acaba no tempo, e vence quem tem mais galinhas guardadas (vs)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = partidaCom(jogo, undefined, vs(n));
    p.dados.placar[w] = 5;
    roda(p, TEMPO - 0.5); assert.equal(p.fase, 'jogando', 'antes do tempo segue');
    roda(p, 0.7);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, w, `n ${n}`);
    assert.equal(p.jogadores[w].pontos, 1);
  }
});

test('galinhas-festa: galinha na cabeca no fim do tempo nao conta', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  vaiAo(p, 0, 1);
  poe(p, 0, 0, 0);
  roda(p, TEMPO + 0.2);
  assert.equal(p.vencedor, 0, 'J1 tem 3 guardadas e J2 ficou com 2: ' + p.dados.placar);
});

test('galinhas-festa: em times vence o time com mais galinhas e os dois pontuam', () => {
  for (const time of [0, 1]) {
    const p = partidaCom(jogo, undefined, times);
    p.dados.placar[time] = 4; p.dados.placar[1 - time] = 2;
    roda(p, TEMPO + 0.2);
    assert.equal(p.vencedor, time, 'o time, nunca o indice');
    assert.deepEqual(p.jogadores.map(j => j.pontos), time === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
  }
});

test('galinhas-festa: empate da -1 (todos iguais, lideres empatados e times)', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    roda(p, TEMPO + 0.2);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
  }
  const p = partidaCom(jogo, undefined, vs(3));
  p.dados.placar = [4, 1, 4];
  roda(p, TEMPO + 0.2);
  assert.equal(p.vencedor, -1, 'dois lideres empatados e um atras');
});

test('galinhas-festa: o resultado deixa aviso e celular finais prontos', () => {
  let p = partidaCom(jogo, undefined, vs(3));
  p.dados.placar[2] = 6; roda(p, TEMPO + 0.2);
  assert.equal(p.dados.aviso, 'Jogador 3 venceu!');
  assert.equal(p.celular[2].texto, 'Você venceu!');
  assert.equal(p.celular[0].texto, 'Jogador 3 venceu');
  p = partidaCom(jogo, undefined, times); p.dados.placar[1] = 5; roda(p, TEMPO + 0.2);
  assert.equal(p.dados.aviso, 'Time roxo venceu!');
  assert.equal(p.celular[0].texto, 'O outro time venceu');
  assert.equal(p.celular[3].texto, 'Você venceu!');
  p = partidaCom(jogo, undefined, vs(2)); roda(p, TEMPO + 0.2);
  assert.equal(p.dados.aviso, 'Empate!');
  assert.equal(p.celular[1].texto, 'Empate!');
});

test('galinhas-festa: dedos aleatorios por 45 s nao geram NaN, nenhuma galinha some e o vencedor vale para o modo', () => {
  for (const o of COMBOS) for (const semente of [3, 4, 5, 6]) {
    const { p, segundos } = rodada(jogo, aleatorio, semente, o), d = p.dados;
    assert.ok(Math.abs(segundos - TEMPO) < 0.1, `${JSON.stringify(o)} durou ${segundos}`);
    assert.equal(total(p), GALINHAS * d.casas.length, 'galinhas conservadas');
    for (const v of d.placar) assert.ok(Number.isInteger(v) && v >= 0, 'placar ' + d.placar);
    for (const g of d.soltas) for (const campo of ['x', 'z', 'vx', 'vz']) assert.ok(Number.isFinite(g[campo]), 'galinha solta com ' + campo + ' invalido');
    assert.ok((o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()]).includes(p.vencedor));
  }
});

test('galinhas-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});
