import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './cor-mentirosa.mjs';

function nova() {
  const p = partidaCom(jogo);
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, nop: 0 });
  return p;
}
// Desafio fixo: palavra 0 (Vermelho) escrita com tinta 1 (Azul).
function desafio(p, modoTinta) { Object.assign(p.dados, { pausa: 0, prazo: 99, modoTinta, palavra: 0, tinta: 1 }); }
function toca(p, i, op) { entrada(p, i, { x: 0, y: 0, op, nop: p.jogadores[i].nop + 1 }); passo(p, DT); }

test('cor-mentirosa: o desafio sorteado tem tinta diferente da palavra e o comando alterna', () => {
  const p = nova();
  roda(p, 1);
  const d = p.dados, modo = d.modoTinta;
  assert.notEqual(d.palavra, d.tinta);
  assert.equal(d.aviso, ['VERMELHO', 'AZUL', 'VERDE', 'AMARELO'][d.palavra]);
  assert.equal(p.celular[0].texto, modo ? 'Toque a cor da TINTA' : 'Toque a PALAVRA');
  toca(p, 0, modo ? d.tinta : d.palavra);
  assert.deepEqual(d.placar, [1, 0]);
  roda(p, 1.2);
  assert.equal(d.modoTinta, !modo);
  assert.notEqual(d.palavra, d.tinta);
});

test('cor-mentirosa: no comando TINTA vale a cor da tinta; no comando PALAVRA vale a palavra', () => {
  const p = nova();
  desafio(p, true); toca(p, 1, 1);
  assert.deepEqual(p.dados.placar, [0, 1]);
  desafio(p, false); toca(p, 0, 0);
  assert.deepEqual(p.dados.placar, [1, 1]);
});

test('cor-mentirosa: quem erra congela 2 s e nao consegue responder', () => {
  const p = nova();
  desafio(p, true);
  toca(p, 0, 0);                                   // tocou a palavra no comando TINTA
  assert.ok(p.dados.gelo[0] > 1.9);
  assert.equal(p.celular[0].modo, 'espera');
  toca(p, 0, 1);                                   // certa, mas congelado
  assert.deepEqual(p.dados.placar, [0, 0]);
  roda(p, 2.1);
  assert.equal(p.dados.gelo[0], 0);
  assert.equal(p.celular[0].modo, 'opcoes');
  desafio(p, true); toca(p, 0, 1);
  assert.deepEqual(p.dados.placar, [1, 0]);
});

test('cor-mentirosa: primeiro a 5 acertos vence', () => {
  const p = nova();
  for (let k = 0; k < 5; k++) { assert.equal(p.fase, 'jogando'); desafio(p, true); toca(p, 1, 1); }
  assert.equal(p.vencedor, 1);
});

test('cor-mentirosa: em 45 s vence o maior placar; igual, empata', () => {
  const p = nova();
  desafio(p, false); toca(p, 0, 0);
  roda(p, 46);
  assert.equal(p.vencedor, 0);
  const q = nova();
  roda(q, 46);
  assert.equal(q.vencedor, -1);
});

test('cor-mentirosa: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  assert.equal(fumaca(jogo).length, 15);
});
