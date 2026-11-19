import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { resolve, decide } from './leilao.mjs';

// A = +1, B = -1, e segurar os dois por 1 s fecha o lance.
function toca(p, i, botao) {
  entrada(p, i, { [botao]: true }); passo(p, DT);
  entrada(p, i, { [botao]: false }); passo(p, DT);
}
const mais = (p, i, n = 1) => { for (let k = 0; k < n; k++) toca(p, i, 'd'); roda(p, 0.15); };
const menos = (p, i, n = 1) => { for (let k = 0; k < n; k++) toca(p, i, 'b'); roda(p, 0.15); };
function fecha(p, i, s = 1.05) { entrada(p, i, { d: true, b: true }); roda(p, s); entrada(p, i, { d: false, b: false }); passo(p, DT); }
// da o lance de valor v: sobe com A e segura os dois
function lance(p, i, v) { mais(p, i, v); fecha(p, i); }
const revela = p => roda(p, 0.8 + 0.9 + 0.1);        // suspense + fichas voando
const proximo = p => roda(p, 2.2);                   // resto da revelacao
function leilao(p, a, b) { lance(p, 0, a); lance(p, 1, b); revela(p); }

test('leilao: maior paga e leva, perdedor nao paga, empate cobra metade dos dois', () => {
  assert.deepEqual(resolve(5, 1), { dono: 0, pago: [5, 0] });
  assert.deepEqual(resolve(0, 10), { dono: 1, pago: [0, 10] });
  assert.deepEqual(resolve(5, 5), { dono: -1, pago: [2, 2] });
  assert.deepEqual(resolve(0, 0), { dono: -1, pago: [0, 0] });
});

test('leilao: o celular tem + (A) e - (B), sem joystick, e escreve o lance atual', () => {
  assert.deepEqual([jogo.controle.a, jogo.controle.b, jogo.controle.joystick], ['+', '-', false]);
  const p = partidaCom(jogo);
  roda(p, 0.1);
  const c = p.celular[0];
  assert.equal(c.modo, 'padrao');
  assert.equal(c.joy, false);
  assert.match(c.texto, /Lance 0 de 10/);
  mais(p, 0, 3);
  assert.match(p.celular[0].texto, /Lance 3 de 10/);
  assert.match(p.celular[1].texto, /Lance 0 de 10/, 'o do outro nao muda');
});

test('leilao: A soma 1, B tira 1, sem passar de 0 nem do que o jogador tem', () => {
  const p = partidaCom(jogo), d = p.dados;
  roda(p, 0.1);
  menos(p, 0, 2);
  assert.equal(d.alvo[0], 0, 'nao fica negativo');
  mais(p, 0, 4); menos(p, 0);
  assert.equal(d.alvo[0], 3);
  mais(p, 0, 20);
  assert.equal(d.alvo[0], 10, 'no maximo as 10 fichas');
});

test('leilao: so fecha o lance segurando A e B juntos por 1 s; antes disso o lance fica aberto', () => {
  const p = partidaCom(jogo), d = p.dados;
  roda(p, 0.1);
  mais(p, 0, 2);
  entrada(p, 0, { d: true, b: true }); roda(p, 0.7);
  assert.equal(d.lance[0], -1, '0,7 s ainda nao fecha');
  entrada(p, 0, { d: false, b: false }); passo(p, DT);
  roda(p, 0.5);
  entrada(p, 0, { d: true, b: true }); roda(p, 0.7);
  assert.equal(d.lance[0], -1, 'soltar zera o tempo de segurar');
  roda(p, 0.4);
  assert.equal(d.lance[0], 2, 'fechou em 2');
  assert.equal(d.alvo[0], 2, 'o gesto de fechar nao somou nada');
  assert.equal(p.celular[0].modo, 'espera');
  assert.equal(d.fase, 'lance', 'espera o outro');
  assert.doesNotMatch(d.aviso, /2 fichas/, 'a tela nao entrega o lance');
});

test('leilao: a TV usa texto curto de uma linha no aviso', () => {
  const p = partidaCom(jogo), d = p.dados;
  roda(p, 0.5);
  assert.ok(d.aviso.length <= 26, d.aviso);
  leilao(p, 5, 1);
  assert.ok(d.aviso.length <= 30, d.aviso);
  proximo(p);
  leilao(p, 3, 3);
  assert.ok(d.aviso.length <= 30, d.aviso);
});

test('leilao: quem da o maior lance leva o premio e so ele paga', () => {
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 5, 1);
  assert.deepEqual(d.placar, [1, 0]);
  assert.deepEqual(d.fichas, [5, 10]);
  assert.deepEqual(d.premios, [0, null, null]);
  assert.match(p.celular[0].texto, /5 fichas/);
  proximo(p);
  assert.equal(d.round, 1);
  roda(p, 0.1);
  assert.match(p.celular[0].texto, /Lance 0 de 5/, 'o limite agora e o que sobrou');
});

test('leilao: empate de lances: ninguem leva e os dois pagam metade', () => {
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 5, 5);
  assert.deepEqual(d.placar, [0, 0]);
  assert.deepEqual(d.fichas, [8, 8]);
  assert.equal(d.premios[0], -1);
});

test('leilao: o ultimo premio vale 2: dar para virar um 0 a 2', () => {
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 1, 2); proximo(p);
  leilao(p, 1, 2);
  assert.deepEqual(d.placar, [0, 2]);
  proximo(p);
  assert.equal(d.round, 2, 'nao acabou: ainda da para virar');
  roda(p, 0.1);
  assert.match(d.aviso, /Último, vale 2/);
  leilao(p, 3, 0);
  assert.deepEqual(d.placar, [2, 2]);
  assert.match(p.celular[0].texto, /2 pontos/);
  roda(p, 2.2 + 2.5);
  assert.equal(p.vencedor, 0, 'empate em pontos: J1 tem mais fichas');
  assert.equal(p.jogadores[1].vivo, false, 'quem perdeu sai voando');
});

test('leilao: quem leva o ultimo premio sem virar fecha o placar', () => {
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 1, 2); proximo(p);
  leilao(p, 1, 2); proximo(p);
  leilao(p, 0, 1);
  assert.deepEqual(d.placar, [0, 4]);
  roda(p, 2.2 + 2.5);
  assert.equal(p.vencedor, 1);
  assert.match(jogo.dica, /último vale 2/);
});

test('leilao: empate em premios decide por fichas; tudo igual e empate', () => {
  assert.equal(decide({ placar: [1, 1], fichas: [3, 6] }), 1);
  assert.equal(decide({ placar: [2, 1], fichas: [0, 9] }), 0);
  assert.equal(decide({ placar: [1, 1], fichas: [4, 4] }), -1);
  const p = partidaCom(jogo), d = p.dados;
  leilao(p, 5, 0); proximo(p);                      // J1 leva por 5 (5 x 10)
  leilao(p, 0, 1); proximo(p);                      // J2 leva por 1 (5 x 9)
  leilao(p, 0, 0);                                  // ninguem leva
  assert.deepEqual(d.placar, [1, 1]);
  roda(p, 2.2 + 2.5);
  assert.equal(p.vencedor, 1, 'J2 sobrou com mais fichas');
});

test('leilao: o tempo acabou sem fechar: vale o lance que estava no visor', () => {
  const p = partidaCom(jogo), d = p.dados;
  roda(p, 0.1);
  mais(p, 0, 3);
  roda(p, 10);
  assert.deepEqual(d.lance, [3, 0]);
  assert.equal(d.fase === 'suspense' || d.fase === 'revela', true);
});

test('leilao: ninguem mexe: lances zero, empate total em menos de 60 s', () => {
  const p = partidaCom(jogo);
  let s = 0;
  for (; s < 70 && p.fase === 'jogando'; s += DT) passo(p, DT);
  assert.equal(p.vencedor, -1);
  assert.deepEqual(p.dados.fichas, [10, 10]);
  assert.ok(s < 50, 'durou ' + s);
  assert.ok(s > 20, 'durou ' + s);
});

test('leilao: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.some(v => v >= 0), 'alguem ganha de vez em quando');
});
