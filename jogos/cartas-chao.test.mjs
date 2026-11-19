import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, sorteio, DT } from '../jogos/_teste.mjs';
import jogo from './cartas-chao.mjs';

function nova(semente = 1) {
  const p = partidaCom(jogo, sorteio(semente));
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, nb: 0 });
  return p;
}
const ateOFim = p => { for (let k = 0; k < 50 * 60 && p.fase === 'jogando'; k++) passo(p, DT); assert.equal(p.fase, 'resultado'); };
const acabaEspia = p => { for (let k = 0; k < 600 && p.dados.espia > 0; k++) passo(p, DT); };
const para = (p, i, k) => { const j = p.jogadores[i], c = p.dados.cartas[k]; j.x = c.x; j.z = c.z; j.vx = j.vz = 0; };
function vira(p, i, k) {
  para(p, i, k);
  entrada(p, i, { x: 0, y: 0, nb: p.jogadores[i].nb + 1 });
  passo(p, DT);
}
const parDe = (p, k) => p.dados.cartas.findIndex((o, n) => n !== k && o.par === p.dados.cartas[k].par);

test('cartas-chao: 14 cartas em 7 pares, todas no tabuleiro e a casa do meio vazia', () => {
  for (let s = 1; s <= 30; s++) {
    const d = nova(s).dados, cont = {};
    assert.equal(d.cartas.length, 14);
    for (const c of d.cartas) { cont[c.par] = (cont[c.par] ?? 0) + 1; assert.ok(Math.abs(c.x) <= 7.6 && Math.abs(c.z) <= 3.8); assert.ok(c.x !== 0 || c.z !== 0); }
    assert.deepEqual(Object.values(cont), [2, 2, 2, 2, 2, 2, 2]);
  }
});

test('cartas-chao: no comeco todas as cartas aparecem e depois viram para baixo', () => {
  const p = nova();
  assert.ok(p.dados.cartas.every(c => c.estado === 'alto'));
  vira(p, 0, 0);
  assert.equal(p.dados.cartas[0].estado, 'alto', 'durante a espiada nao vira nada');
  assert.equal(p.dados.placar[0], 0);
  assert.ok(/Decore/.test(p.dados.aviso));
  acabaEspia(p);
  assert.ok(p.dados.cartas.every(c => c.estado === 'baixo'));
});

test('cartas-chao: virar uma carta sem par aberto deixa ela aberta e depois fecha', () => {
  const p = nova(); acabaEspia(p);
  vira(p, 0, 0);
  assert.equal(p.dados.cartas[0].estado, 'alto');
  assert.deepEqual(p.dados.placar, [0, 0]);
  roda(p, 3.3);
  assert.equal(p.dados.cartas[0].estado, 'baixo');
});

test('cartas-chao: virar o par de uma carta aberta leva o ponto, mesmo que a primeira seja do rival', () => {
  const p = nova(); acabaEspia(p);
  vira(p, 0, 3);
  vira(p, 1, parDe(p, 3));
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.dados.cartas[3].estado, 'ganha');
  assert.equal(p.dados.cartas[3].dono, 1);
  assert.match(p.dados.aviso, /fez um par/);
  assert.match(p.celular[1].texto, /você 1, rival 0/);
  assert.ok(p.dados.fx.some(f => f.tipo === 'par' && f.quem === 1));
});

test('cartas-chao: duas figuras diferentes abertas nao fazem par e carta ganha nao vira mais', () => {
  const p = nova(); acabaEspia(p);
  const a = 0, b = p.dados.cartas.findIndex(c => c.par !== p.dados.cartas[0].par);
  vira(p, 0, a); roda(p, 0.4); vira(p, 1, b);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.equal(p.dados.cartas[b].estado, 'alto');
  vira(p, 0, parDe(p, a));
  assert.deepEqual(p.dados.placar, [1, 0]);
  roda(p, 0.4);
  vira(p, 1, a);
  assert.deepEqual(p.dados.placar, [1, 0], 'carta ganha fica quieta');
});

test('cartas-chao: fora de qualquer carta o botao nao faz nada', () => {
  const p = nova(); acabaEspia(p);
  const j = p.jogadores[0]; j.x = 10; j.z = 0;
  entrada(p, 0, { x: 0, y: 0, nb: 1 }); passo(p, DT);
  assert.ok(p.dados.cartas.every(c => c.estado === 'baixo'));
});

test('cartas-chao: empurrado para o vao entre as cartas, o botao nao vira nada', () => {
  const p = nova(); acabaEspia(p);
  para(p, 0, 0); p.jogadores[0].x += 1.9;
  entrada(p, 0, { x: 0, y: 0, nb: 1 }); passo(p, DT);
  assert.ok(p.dados.cartas.every(c => c.estado === 'baixo'));
  assert.equal(p.dados.sob[0], -1);
});

test('cartas-chao: no maximo 4 cartas abertas ao mesmo tempo', () => {
  const p = nova(); acabaEspia(p);
  const unicas = [], vistos = new Set();
  p.dados.cartas.forEach((c, k) => { if (!vistos.has(c.par)) { vistos.add(c.par); unicas.push(k); } });
  for (const k of unicas.slice(0, 6)) { vira(p, 0, k); roda(p, 0.4); }
  assert.ok(p.dados.cartas.filter(c => c.estado === 'alto').length <= 4);
});

test('cartas-chao: quem faz mais pares vence quando todos acabam (retorno 0 e 1)', () => {
  for (const [lider, esperado] of [[0, 0], [1, 1]]) {
    const p = nova(); acabaEspia(p);
    const feitos = new Set();
    let n = 0;
    for (let k = 0; k < 14 && p.fase === 'jogando'; k++) {
      if (feitos.has(k)) continue;
      const o = parDe(p, k); feitos.add(k); feitos.add(o);
      const quem = n < 4 ? lider : 1 - lider;      // 4 pares para o lider e 3 para o outro
      vira(p, 1 - quem, k); roda(p, 0.4); vira(p, quem, o); roda(p, 0.4); n++;
    }
    assert.equal(p.dados.placar[lider], 4);
    assert.equal(p.vencedor, esperado);
    assert.match(p.dados.aviso, /venceu/);
  }
});

test('cartas-chao: no limite de tempo vence quem tem mais pares; igual e empate', () => {
  const p = nova(); acabaEspia(p);
  vira(p, 0, 0); roda(p, 0.4); vira(p, 0, parDe(p, 0));
  ateOFim(p);
  assert.equal(p.dados.placar[0], 1);
  assert.equal(p.vencedor, 0);
  const q = nova(); acabaEspia(q);
  ateOFim(q);
  assert.equal(q.vencedor, -1);
  assert.match(q.dados.aviso, /Empate/);
  assert.match(q.celular[0].texto, /Empate/);
});

test('cartas-chao: a rodada nao acaba por um toque no comeco e o limite aparece', () => {
  const p = nova(); acabaEspia(p);
  vira(p, 1, 5);
  roda(p, 5);
  assert.equal(p.fase, 'jogando');
  assert.equal(jogo.duracao, 40);
  assert.ok(jogo.dica.length <= 90);
  assert.doesNotMatch(jogo.dica + jogo.nome, /[–—]/);
});

test('cartas-chao: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
