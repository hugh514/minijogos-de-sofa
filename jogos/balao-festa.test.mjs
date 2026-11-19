import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { DURACAO, limiteDe } from './balao-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };

function aperta(p, i, vezes = 1) {
  for (let k = 0; k < vezes; k++) { entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); }
}
function nova(o, limite = 40) {
  const p = partidaCom(jogo, undefined, o);
  for (let i = 0; i < o.n; i++) entrada(p, i, { x: 0, y: 0, n: 0 });
  p.dados.limite = limite;
  return p;
}
const textos = p => p.jogadores.map((_, i) => p.celular[i].texto);

test('balao-festa: contrato da festa vs e times, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(DURACAO, 30);
  assert.equal(jogo.genero, 'blefe');
});

test('balao-festa: o limite escondido cresce com o numero de jogadores no mesmo balao', () => {
  assert.equal(limiteDe(2, 'vs', 0), 100);
  assert.equal(limiteDe(2, 'vs', 1), 180);
  assert.equal(limiteDe(4, 'vs', 0), 200);
  assert.equal(limiteDe(4, 'times', 0), 100, 'cada dupla tem o seu balao');
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const p = partidaCom(jogo, undefined, o);
    assert.ok(Number.isInteger(p.dados.limite) && p.dados.limite >= 100 && p.dados.limite <= 360);
  }
});

test('balao-festa: dedos humanos (6 apertos por segundo cada) nao estouram o balao em menos de 8 s', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const sopradores = o.modo === 'times' ? 2 : o.n;
    assert.ok(limiteDe(o.n, o.modo, 0) / (sopradores * 6) >= 8, `${o.modo} ${o.n}`);
  }
});

test('balao-festa: vs, todos sopram no mesmo balao e cada um soma os seus', () => {
  const p = nova(vs(3));
  aperta(p, 0, 3); aperta(p, 1, 2); aperta(p, 2, 4);
  assert.equal(p.dados.baloes.length, 1);
  assert.equal(p.dados.baloes[0].ar, 9);
  assert.deepEqual(p.dados.placar, [3, 2, 4]);
  assert.equal(p.vencedor, undefined);
  assert.match(textos(p)[2], /^Seus sopros: 4\./);
});

test('balao-festa: vs, quem da o aperto que estoura perde e vence quem soprou mais entre os outros', () => {
  const p = nova(vs(3), 20);
  aperta(p, 0, 6); aperta(p, 1, 3); aperta(p, 2, 5);
  assert.equal(p.vencedor, undefined);
  aperta(p, 1, 6);                                   // J2 chega a 9 sopros e estoura no 20o
  assert.equal(p.dados.estourouQuem, 1);
  assert.equal(p.jogadores[1].vivo, false, 'quem estourou sai voando');
  assert.equal(p.vencedor, 0, 'J1 soprou 6 contra 5 de J3, mesmo J2 tendo mais');
  assert.equal(p.jogadores[0].pontos, 1);
  assert.equal(p.jogadores[1].pontos, 0);
});

test('balao-festa: vs com 2 jogadores, o outro vence mesmo com menos sopros', () => {
  const p = nova(vs(2), 10);
  aperta(p, 1, 1); aperta(p, 0, 9);
  assert.equal(p.vencedor, 1);
});

test('balao-festa: vs, estourar com os outros empatados nos sopros da empate', () => {
  const p = nova(vs(4), 20);
  aperta(p, 1, 4); aperta(p, 2, 4); aperta(p, 3, 4);
  aperta(p, 0, 8);
  assert.equal(p.dados.estourouQuem, 0);
  assert.equal(p.vencedor, -1);
});

test('balao-festa: times, cada dupla enche o seu balao e os sopros dos dois valem para a dupla', () => {
  const p = nova(times);
  aperta(p, 0, 3); aperta(p, 2, 4); aperta(p, 1, 2); aperta(p, 3, 1);
  assert.deepEqual(p.dados.baloes.map(b => b.ar), [7, 3]);
  assert.deepEqual(p.dados.placar, [7, 3]);
  assert.match(textos(p)[0], /Sua dupla: 7\./);
  assert.match(textos(p)[1], /Sua dupla: 3\./);
});

test('balao-festa: times, a dupla que estoura perde, devolve o time e nunca o indice', () => {
  const p = nova(times, 10);
  aperta(p, 0, 4); aperta(p, 2, 5);
  assert.equal(p.vencedor, undefined);
  aperta(p, 2, 1);                                   // J3 estoura o balao da dupla A
  assert.equal(p.vencedor, 1);
  assert.equal(p.dados.estourou, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
  assert.equal(p.jogadores[2].vivo, false);

  const q = nova(times, 10);
  aperta(q, 1, 5); aperta(q, 3, 5);
  assert.equal(q.vencedor, 0, 'estourou o balao do time B');
  assert.deepEqual(q.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('balao-festa: ao estourar, aviso e celulares ja estao no estado final', () => {
  const p = nova(vs(3), 10);
  aperta(p, 2, 3); aperta(p, 1, 2); aperta(p, 0, 5);
  assert.equal(p.vencedor, 2);
  assert.match(p.dados.aviso, /estourou o balão!$/);
  assert.equal(p.celular[0].texto, 'Você estourou o balão!');
  assert.equal(p.celular[2].texto, 'Você venceu!');
  assert.equal(p.celular[1].texto, 'Fim da rodada. Você não venceu.');
  const q = nova(times, 10);
  aperta(q, 0, 10);
  assert.equal(q.celular[0].texto, 'Você estourou o balão!');
  assert.equal(q.celular[2].texto, 'Sua dupla estourou o balão.');
  assert.equal(q.celular[1].texto, 'Você venceu!');
  assert.equal(q.celular[3].texto, 'Você venceu!');
});

test('balao-festa: tempo limite, vs ganha quem encheu mais, e sopros iguais ou ninguem soprando da empate', () => {
  const p = nova(vs(3), 90);
  aperta(p, 0, 2); aperta(p, 1, 5); aperta(p, 2, 3);
  roda(p, DURACAO + 1);
  assert.equal(p.vencedor, 1);
  assert.equal(p.celular[1].texto, 'Você venceu!');
  const q = nova(vs(4), 90);
  aperta(q, 0, 4); aperta(q, 3, 4);
  roda(q, DURACAO + 1);
  assert.equal(q.vencedor, -1);
  assert.equal(q.dados.aviso, 'Empate!');
  const r = nova(vs(2));
  roda(r, DURACAO + 1);
  assert.equal(r.vencedor, -1);
});

test('balao-festa: tempo limite em times soma a dupla, e empate da -1', () => {
  const p = nova(times, 90);
  aperta(p, 0, 2); aperta(p, 2, 2); aperta(p, 1, 5);          // dupla A 4 contra dupla B 5
  roda(p, DURACAO + 1);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
  const q = nova(times, 90);
  aperta(q, 0, 2); aperta(q, 3, 2);
  roda(q, DURACAO + 1);
  assert.equal(q.vencedor, -1);
  assert.equal(q.celular[0].texto, 'Empate!');
});

test('balao-festa: ninguem parado fecha a rodada antes de 30 s', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const p = nova(o);
    roda(p, 29.5);
    assert.equal(p.fase, 'jogando', `${o.modo} ${o.n}`);
  }
});

test('balao-festa: 3 s sem apertos e o balao murcha, sem tirar sopros; em times cada balao murcha sozinho', () => {
  const p = nova(vs(3));
  aperta(p, 0, 6);
  roda(p, 2.5);
  assert.equal(p.dados.baloes[0].ar, 6);
  roda(p, 1);
  assert.equal(p.dados.baloes[0].ar, 3);
  assert.deepEqual(p.dados.placar, [6, 0, 0]);
  assert.equal(p.dados.aviso, 'Murchando...');
  const q = nova(times);
  aperta(q, 0, 6);
  roda(q, 2);
  aperta(q, 1, 6);
  roda(q, 1.5);
  assert.deepEqual(q.dados.baloes.map(b => b.ar), [3, 6], 'so o balao parado ha mais tempo murchou');
});

test('balao-festa: a tensao sobe perto do limite', () => {
  const p = nova(vs(2), 20);
  assert.equal(p.dados.baloes[0].tensao, 0);
  aperta(p, 1, 19);
  assert.equal(p.dados.baloes[0].tensao, 2);
});

test('balao-festa: posicoes escalam com n e todos ficam dentro da arena', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const p = partidaCom(jogo, undefined, o);
    assert.equal(p.jogadores.length, o.n);
    for (const j of p.jogadores) {
      if (p.arena.tipo === 'circulo') assert.ok(Math.hypot(j.x, j.z) < p.arena.raio, `${o.modo} ${o.n}`);
      else assert.ok(Math.abs(j.x) < p.arena.lx && Math.abs(j.z) < p.arena.lz, `${o.modo} ${o.n}`);
    }
  }
});

test('balao-festa: dedos aleatorios dao resultado valido em todos os modos', () => {
  for (const o of [vs(2), vs(3), vs(4), times])
    for (let s = 1; s <= 20; s++) {
      const { p } = rodada(jogo, aleatorio, s, o);
      const validos = o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()];
      assert.ok(validos.includes(p.vencedor), `${o.modo} ${o.n} semente ${s}: ${p.vencedor}`);
    }
});

test('balao-festa: fumaca com 2, 3, 4 jogadores e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});
