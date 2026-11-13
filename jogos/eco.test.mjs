import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { erroMedio, nota, completa } from './eco.mjs';

function bate(p, i) {
  const j = p.jogadores[i];
  if (j.n === undefined) entrada(p, i, { n: 0 });
  entrada(p, i, { n: j.n + 1 }); passo(p, DT);
}
function ate(p, fase, limite = 20) {
  for (let s = 0; s < limite && p.dados.fase !== fase && p.fase === 'jogando'; s += DT) passo(p, DT);
  assert.equal(p.dados.fase, fase);
}
// bate nos intervalos dados (o primeiro toque sai na hora)
function ritmo(p, i, intervalos) {
  bate(p, i);
  for (const s of intervalos) { roda(p, s - DT); bate(p, i); }
}
// um turno inteiro: o criador bate "cria" e o imitador bate "imita"
function turno(p, cria, imita) {
  ate(p, 'cria');
  const cr = p.dados.criador;
  ritmo(p, cr, cria);
  ate(p, 'imita'); if (imita) ritmo(p, 1 - cr, imita);
  ate(p, 'nota');
}

test('eco: nota compara intervalos; batida faltando ou sobrando pesa muito', () => {
  const r = [0, 0.5, 1, 1.5];
  assert.equal(nota(erroMedio(r, [0, 0.5, 1, 1.5])), 100);
  assert.equal(nota(erroMedio(r, [3, 3.5, 4, 4.5])), 100, 'tempo absoluto nao importa');
  const perto = nota(erroMedio(r, [0, 0.55, 1.0, 1.55])), falta = nota(erroMedio(r, [0, 0.5, 1])), sobra = nota(erroMedio(r, [0, 0.5, 1, 1.5, 1.8]));
  assert.ok(perto > 80 && perto < 100, 'perto: ' + perto);
  assert.ok(falta < 60 && sobra < 60, `falta ${falta}, sobra ${sobra}`);
  assert.equal(nota(erroMedio(r, [])), 0);
});

test('eco: ritmo incompleto e completado com batidas regulares', () => {
  assert.deepEqual(completa([]), [0, 0.5, 1, 1.5]);
  const r = completa([1, 1.4]);
  assert.equal(r.length, 4);
  assert.ok(Math.abs(r[3] - 1.2) < 1e-9, 'segue o passo de 0,4 s: ' + r);
});

test('eco: celulares: quem cria tem o botao, o outro espera; na imitacao inverte', () => {
  const p = partidaCom(jogo), d = p.dados, cr = d.criador;
  assert.equal(p.celular[cr].modo, 'botao');
  assert.equal(p.celular[1 - cr].modo, 'espera');
  assert.ok(p.celular[1 - cr].texto.length > 10);
  ate(p, 'cria'); ritmo(p, cr, [0.4, 0.4, 0.4]);
  assert.equal(d.fase, 'toca');
  assert.equal(p.celular[0].modo, 'espera'); assert.equal(p.celular[1].modo, 'espera');
  ate(p, 'imita');
  assert.equal(p.celular[1 - cr].modo, 'botao');
  assert.equal(p.celular[cr].modo, 'espera');
});

test('eco: o eco toca as 4 batidas uma vez, nos mesmos intervalos', () => {
  const p = partidaCom(jogo), d = p.dados;
  ate(p, 'cria'); ritmo(p, d.criador, [0.3, 0.6, 0.3]);
  const antes = d.pulso.n, tempos = [];
  let n = antes;
  while (d.fase === 'toca') { passo(p, DT); if (d.pulso.n !== n) { n = d.pulso.n; tempos.push(p.t); assert.equal(d.pulso.quem, -1); } }
  assert.equal(tempos.length, 4);
  assert.ok(Math.abs(tempos[2] - tempos[1] - 0.6) < 0.04, 'intervalo do meio: ' + (tempos[2] - tempos[1]));
});

test('eco: quem imita melhor vence e os papeis trocam', () => {
  const p = partidaCom(jogo), d = p.dados, a = d.criador, b = 1 - a;
  turno(p, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);       // b imita perfeito
  assert.ok(d.notas[b] >= 95, 'nota de b: ' + d.notas[b]);
  assert.equal(d.placar[b], d.notas[b]);
  ate(p, 'prepara');
  assert.equal(d.criador, b, 'papeis trocaram');
  turno(p, [0.3, 0.8, 0.3], [0.6, 0.4, 0.6]);       // a imita torto
  assert.ok(d.notas[a] < 60, 'nota de a: ' + d.notas[a]);
  roda(p, 5);
  assert.equal(p.vencedor, b);
});

test('eco: batida sobrando derruba a nota', () => {
  const p = partidaCom(jogo), d = p.dados, b = 1 - d.criador;
  turno(p, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.3]);
  assert.ok(d.notas[b] < 60, 'nota: ' + d.notas[b]);
});

test('eco: notas iguais dao empate', () => {
  const p = partidaCom(jogo);
  turno(p, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
  turno(p, [0.4, 0.7, 0.4], [0.4, 0.7, 0.4]);
  assert.equal(p.dados.notas[0], p.dados.notas[1]);
  roda(p, 5);
  assert.equal(p.vencedor, -1);
});

test('eco: ninguem bate: ritmo automatico, nota zero, empate em menos de 60 s', () => {
  const p = partidaCom(jogo);
  ate(p, 'toca');
  assert.deepEqual(p.dados.ritmo, [0, 0.5, 1, 1.5]);
  let s = 0;
  for (; s < 70 && p.fase === 'jogando'; s += DT) passo(p, DT);
  assert.equal(p.vencedor, -1);
  assert.ok(p.t < 1 && s < 55, 'durou ' + s);
});

test('eco: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
