import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { prazoDe } from './cor-mentirosa.mjs';

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
  assert.equal(q.vencedor, undefined, 'empate no tempo nao fecha: morte subita');
  roda(q, 12);
  assert.equal(q.vencedor, -1, 'e a morte subita tem fim');
});

test('cor-mentirosa: errar tira 1 ponto (nunca abaixo de zero)', () => {
  const p = nova();
  desafio(p, true); toca(p, 0, 1);
  assert.deepEqual(p.dados.placar, [1, 0]);
  roda(p, 1.2);
  desafio(p, true); toca(p, 0, 0);          // 0 e a palavra: errado no comando TINTA
  assert.deepEqual(p.dados.placar, [0, 0]);
  roda(p, 2.5); desafio(p, true); toca(p, 0, 0);
  assert.deepEqual(p.dados.placar, [0, 0], 'zero continua zero');
});

test('cor-mentirosa: o prazo encurta com o placar do lider, ate um minimo', () => {
  assert.equal(prazoDe([0, 0]), 6);
  assert.equal(prazoDe([2, 4]), 4);
  assert.equal(prazoDe([5, 1]), 3.5);
});

test('cor-mentirosa: na morte subita o primeiro ponto decide e a TV avisa', () => {
  const p = nova();
  roda(p, 46);
  roda(p, 1);
  assert.match(p.dados.aviso + p.dados.comando, /Desempate|TOQUE/);
  desafio(p, true); toca(p, 1, 1);
  assert.equal(p.vencedor, 1);
});

test('cor-mentirosa: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  assert.equal(fumaca(jogo).length, 15);
});

test('cor-mentirosa: os 4 botoes do celular saem em linha e coloridos, na ordem dos blocos da TV', () => {
  const p = nova();
  roda(p, 1);
  const c = p.celular[0];
  assert.equal(c.modo, 'opcoes');
  assert.equal(c.linha, true);
  assert.equal(c.coresOp.length, 4);
  assert.deepEqual(c.opcoes, ['Vermelho', 'Azul', 'Verde', 'Amarelo']);
  assert.ok(c.coresOp.every(x => /^#[0-9a-f]{6}$/i.test(x)));
});

test('cor-mentirosa: a TV diz o comando por escrito (comando exportado para o desenho)', () => {
  const p = nova();
  roda(p, 1);
  assert.equal(p.dados.comando, p.dados.modoTinta ? 'TOQUE A TINTA' : 'TOQUE A PALAVRA');
});
