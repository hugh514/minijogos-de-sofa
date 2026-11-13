import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, fumaca, DT } from '../jogos/_teste.mjs';
import jogo from './relogio.mjs';

function partida() {
  const p = partidaCom(jogo);
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, d: false, n: 0 });
  return p;
}
// Avanca ate o quadro "n" da rodada (p.t = n / 60). O toque dado antes vale no quadro seguinte.
function ate(p, n) { while (p.fase === 'jogando' && Math.round(p.t * 60) < n) passo(p, DT); }
const aperta = (p, i) => entrada(p, i, { x: 0, y: 0, d: false, n: p.jogadores[i].n + 1 });
// Faz o jogador i parar o relogio exatamente no quadro n.
function para(p, i, n) { ate(p, n - 1); aperta(p, i); ate(p, n); }

test('relogio: o cronometro aparece ate 3 s e depois some', () => {
  const p = partida();
  ate(p, 150);
  assert.equal(p.dados.aviso, '2,5');
  ate(p, 240);
  assert.equal(p.dados.aviso, '?,?');
});

test('relogio: vence quem para mais perto de 10 s, e os tempos sao revelados com 2 casas', () => {
  const p = partida();
  para(p, 1, 540);                                   // 9,00
  assert.ok(p.jogadores[1].vy > 0 || p.jogadores[1].y > 0, 'o boneco pula quando para');
  assert.equal(p.dados.aviso, '?,?', 'so um parou: nada revelado');
  para(p, 0, 618);                                   // 10,30
  assert.equal(p.dados.aviso, '10,30 s  x  9,00 s');
  assert.match(p.celular[0].texto, /10,30 s \(erro de 0,30 s\)/);
  assert.match(p.celular[1].texto, /9,00 s \(erro de 1,00 s\)/);
  assert.equal(p.vencedor, undefined, 'fica um tempo mostrando os dois tempos');
  ate(p, 618 + 220);
  assert.equal(p.vencedor, 0);
});

test('relogio: so o primeiro aperto vale', () => {
  const p = partida();
  para(p, 0, 300);
  para(p, 0, 600);
  assert.ok(Math.abs(p.dados.parou[0] - 5) < 1e-6);
});

test('relogio: erros iguais (um antes, outro depois) da empate', () => {
  const p = partida();
  para(p, 0, 570);                                   // 9,50
  para(p, 1, 630);                                   // 10,50
  ate(p, 630 + 220);
  assert.equal(p.vencedor, -1);
});

test('relogio: um quadro e meio de diferenca no erro ja decide', () => {
  const p = partida();
  para(p, 0, 598);                                   // erro 0,033
  para(p, 1, 600);                                   // erro 0
  ate(p, 600 + 220);
  assert.equal(p.vencedor, 1);
});

test('relogio: quem nao aperta fica com 15,00', () => {
  const p = partida();
  para(p, 1, 780);                                   // 13,00: erro 3, contra erro 5 de quem nao apertou
  ate(p, 905);
  assert.equal(p.dados.parou[0], 15);
  assert.equal(p.dados.aviso, '15,00 s  x  13,00 s');
  ate(p, 905 + 220);
  assert.equal(p.vencedor, 1);
});

test('relogio: ninguem aperta, empata logo depois dos 15 s', () => {
  const p = partida();
  ate(p, 19 * 60);
  assert.equal(p.vencedor, -1);
  assert.notEqual(p.fase, 'jogando');
});

test('relogio: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
