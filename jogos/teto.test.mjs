import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca } from '../jogos/_teste.mjs';
import jogo from './teto.mjs';

function partida(teto = 6.5) {
  const p = partidaCom(jogo);
  p.dados.teto = teto;
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, d: false, n: 0 });
  return p;
}
const segura = (p, i) => entrada(p, i, { x: 0, y: 0, d: true, n: p.jogadores[i].n + 1 });
const solta = (p, i) => entrada(p, i, { x: 0, y: 0, d: false, n: p.jogadores[i].n });

test('teto: segurar sobe, soltar trava de vez', () => {
  const p = partida(), e = p.dados.e[0];
  segura(p, 0); roda(p, 1);
  assert.equal(e.estado, 'sobe');
  assert.ok(e.alt > 1.3 && e.alt < 2, 'subiu ' + e.alt);
  solta(p, 0); roda(p, 0.1);
  assert.equal(e.estado, 'travou');
  const travado = p.dados.placar[0];
  segura(p, 0); roda(p, 0.5);
  assert.equal(p.dados.placar[0], travado, 'apertar de novo nao sobe mais');
  assert.ok(travado > 130);
});

test('teto: quem trava mais alto vence', () => {
  const p = partida();
  segura(p, 0); segura(p, 1); roda(p, 1);
  solta(p, 0); roda(p, 1);
  solta(p, 1); roda(p, 1);
  assert.equal(p.vencedor, undefined, 'ainda mostrando o teto');
  roda(p, 1);
  assert.equal(p.vencedor, 1);
});

test('teto: bater no teto zera e perde para quem travou', () => {
  const p = partida(3);
  segura(p, 0); segura(p, 1); roda(p, 0.5);
  solta(p, 1); roda(p, 2);
  assert.ok(['caindo', 'caiu'].includes(p.dados.e[0].estado));
  assert.equal(p.dados.placar[0], 0);
  assert.ok(p.dados.placar[1] > 0);
  roda(p, 3);
  assert.equal(p.vencedor, 1);
});

test('teto: alturas iguais da empate', () => {
  const p = partida();
  segura(p, 0); segura(p, 1); roda(p, 1.5);
  solta(p, 0); solta(p, 1); roda(p, 2.5);
  assert.equal(p.vencedor, -1);
});

test('teto: quem nao comeca em 6 s sobe sozinho; um toque trava', () => {
  const p = partida(7);
  roda(p, 5.9);
  assert.equal(p.dados.e[0].estado, 'espera');
  roda(p, 1.1);
  assert.equal(p.dados.e[0].estado, 'sobe');
  assert.ok(p.dados.e[0].alt > 1, 'subiu sem ninguem segurar');
  segura(p, 0); solta(p, 0); roda(p, 0.1);          // toque curto: aperta e solta entre dois quadros
  assert.equal(p.dados.e[0].estado, 'travou');
  roda(p, 6);                                        // o outro, parado, bate no teto
  assert.equal(p.vencedor, 0);
});

test('teto: os dois parados batem no teto e empatam antes de 20 s', () => {
  const p = partidaCom(jogo);
  let quadros = 0;
  while (p.fase === 'jogando' && quadros < 20 * 60) { roda(p, 1 / 60); quadros++; }
  assert.equal(p.vencedor, -1);
  assert.ok(quadros < 20 * 60);
});

test('teto: o teto e sorteado dentro da faixa e muda de rodada para rodada', () => {
  const tetos = [1, 2, 3, 4, 5].map(s => { let a = s * 0.19; return partidaCom(jogo, () => (a = (a + 0.37) % 1)).dados.teto; });
  for (const t of tetos) assert.ok(t >= 3 && t <= 7, 'teto ' + t);
  assert.ok(new Set(tetos.map(t => t.toFixed(2))).size > 1);
});

test('teto: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});
