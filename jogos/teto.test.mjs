import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada } from '../logica.mjs';
import { partidaCom, roda, fumaca } from '../jogos/_teste.mjs';
import jogo, { SUBIDAS } from './teto.mjs';

function partida(teto = 6.5) {
  const p = partidaCom(jogo);
  p.dados.teto = teto;
  for (const i of [0, 1]) entrada(p, i, { x: 0, y: 0, d: false, n: 0 });
  roda(p, 0.05);
  return p;
}
const segura = (p, i) => entrada(p, i, { x: 0, y: 0, d: true, n: p.jogadores[i].n + 1 });
const solta = (p, i) => entrada(p, i, { x: 0, y: 0, d: false, n: p.jogadores[i].n });
// Uma subida inteira: os dois seguram, cada um solta depois de seg[i] segundos (null = segura ate bater). Espera a revelacao.
function subida(p, seg, teto = 6.5) {
  p.dados.teto = teto;
  segura(p, 0); segura(p, 1);
  const ordem = [0, 1].filter(i => seg[i] !== null).sort((a, b) => seg[a] - seg[b]);
  let t = 0;
  for (const i of ordem) { roda(p, seg[i] - t); t = seg[i]; solta(p, i); }
  const n = p.dados.subida;
  for (let q = 0; q < 8 * 60 && p.fase === 'jogando' && p.dados.subida === n; q++) roda(p, 1 / 60);
}

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

test('teto: sao 3 subidas, cada uma com teto novo, e a altura soma no placar', () => {
  const p = partida();
  assert.equal(SUBIDAS, 3);
  subida(p, [1, 1.5]);
  assert.equal(p.vencedor, undefined, 'uma subida so nao decide');
  assert.equal(p.dados.subida, 2);
  assert.deepEqual(p.dados.e.map(e => e.estado), ['espera', 'espera']);
  assert.deepEqual(p.dados.e.map(e => e.alt), [0, 0]);
  const depois1 = [...p.dados.placar];
  assert.ok(depois1[1] > depois1[0] && depois1[0] > 100);
  subida(p, [1, 1.5]);
  assert.ok(p.dados.placar[0] > depois1[0] * 1.9, 'somou a segunda');
  subida(p, [1, 1.5]);
  assert.equal(p.vencedor, 1);
});

test('teto: bater no teto zera so aquela subida; da para virar nas outras', () => {
  const p = partida();
  subida(p, [null, 1], 3);                        // o 1 bate, o 2 trava baixo
  assert.equal(p.dados.placar[0], 0);
  assert.ok(p.dados.placar[1] > 0);
  subida(p, [2.5, 1], 7);
  subida(p, [2.5, 1], 7);
  assert.equal(p.vencedor, 0);
});

test('teto: alturas iguais da empate', () => {
  const p = partida();
  for (let k = 0; k < SUBIDAS; k++) subida(p, [1.5, 1.5]);
  assert.equal(p.vencedor, -1);
});

test('teto: quem nao comeca em 5 s sobe sozinho; um toque trava', () => {
  const p = partida(7);
  roda(p, 4.8);
  assert.equal(p.dados.e[0].estado, 'espera');
  roda(p, 1.1);
  assert.equal(p.dados.e[0].estado, 'sobe');
  assert.ok(p.dados.e[0].alt > 0.5, 'subiu sem ninguem segurar');
  segura(p, 0); solta(p, 0); roda(p, 0.1);          // toque curto: aperta e solta entre dois quadros
  assert.equal(p.dados.e[0].estado, 'travou');
});

test('teto: dedo ainda no botao quando comeca a subida nova nao trava nada', () => {
  const p = partida();
  segura(p, 0); segura(p, 1); roda(p, 1);
  solta(p, 1); roda(p, 0.5);
  roda(p, 6);                                        // o 1 segura ate bater e continua segurando
  assert.equal(p.dados.subida, 2);
  assert.equal(p.dados.e[0].estado, 'espera', 'precisa soltar e apertar de novo');
});

test('teto: os dois parados batem no teto nas 3 subidas e empatam antes de 60 s', () => {
  const p = partidaCom(jogo);
  let quadros = 0;
  while (p.fase === 'jogando' && quadros < 60 * 60) { roda(p, 1 / 60); quadros++; }
  assert.equal(p.vencedor, -1);
  assert.ok(quadros < 60 * 60 && quadros > 20 * 60, 'durou ' + quadros / 60);
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
