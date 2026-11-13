import test from 'node:test';
import assert from 'node:assert/strict';
import { passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { indice, COLS, LINS, TEMPO } from './tinta-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const TOTAL = COLS * LINS;
function poe(p, i, x, z) { Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 }); }
// Pinta um retangulo de celulas do jeito do jogo: o jogador passa por cima e o motor segue valendo.
function varre(p, i, x0, x1, z0, z1) {
  for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) { poe(p, i, x, z); passo(p, DT); }
}
const donos = p => p.dados.cor.filter(c => c >= 0).length;
const confere = p => {   // a contagem guardada bate com o chao de verdade
  const real = p.dados.conta.map((_, k) => p.dados.cor.filter(c => c === k).length);
  assert.deepEqual(p.dados.conta, real);
};
const fim = p => { for (let k = 0; k < 60 * 80 && p.fase === 'jogando'; k++) passo(p, DT); assert.notEqual(p.fase, 'jogando'); };
const semBalde = p => { p.dados.proxBalde = Infinity; return p; };

test('tinta-festa: contrato da festa, 40 s e porcentagem no placar', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, 40);
  assert.equal(TEMPO, 40);
  assert.equal(jogo.sufixo, '%');
  assert.equal(TOTAL, 252);
});

test('tinta-festa: o chao comeca limpo e o placar tem um valor por jogador (vs) ou por time', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  assert.equal(p.dados.cor.length, TOTAL);
  assert.ok(p.dados.cor.every(c => c === -1 || c >= 0));
  assert.equal(p.dados.placar.length, 3);
  const q = partidaCom(jogo, undefined, times);
  assert.equal(q.dados.placar.length, 2);
});

test('tinta-festa: passar por cima pinta, a cor do ultimo que passou vale e o placar mostra a porcentagem', () => {
  const p = semBalde(partidaCom(jogo, undefined, vs(2)));
  const k = indice(0.5, 0.5);
  poe(p, 0, 0.5, 0.5); poe(p, 1, 8, 6); passo(p, DT);
  assert.equal(p.dados.cor[k], 0);
  const antes = p.dados.placar[0];
  assert.ok(antes > 0 && antes < 10, 'um pincel pinta so uma parte: ' + antes);
  poe(p, 0, 8, -6); poe(p, 1, 0.5, 0.5); passo(p, DT);
  assert.equal(p.dados.cor[k], 1, 'o segundo cobriu');
  confere(p);
  assert.ok(p.dados.placar[1] > 0);
});

test('tinta-festa: jogador no ar ou caido nao pinta', () => {
  const p = semBalde(partidaCom(jogo, undefined, vs(2)));
  poe(p, 0, -2, 0); p.jogadores[0].y = 2; poe(p, 1, 8, 6);
  passo(p, DT);
  assert.equal(p.dados.cor[indice(-1.5, 0.5)], -1);
  p.jogadores[0].y = 0; p.jogadores[0].vivo = false; passo(p, DT);
  assert.equal(donos(p) > 0, true, 'o outro continua pintando o proprio canto');
  assert.ok(!p.dados.cor.some(c => c === 0));
});

test('tinta-festa: vs, mais area no fim dos 40 s ganha, mesmo com a rodada decidida cedo no placar', () => {
  const p = semBalde(partidaCom(jogo, undefined, vs(3)));
  varre(p, 1, -8, 8, -6, 6);                  // J2 pinta quase tudo logo no comeco
  assert.equal(p.fase, 'jogando', 'pintar tudo cedo nao encerra a rodada');
  assert.ok(p.t < 5);
  poe(p, 1, 8.5, 6.5);
  fim(p);
  assert.equal(p.vencedor, 1);
  assert.equal(p.jogadores[1].pontos, 1);
  assert.ok(Math.floor(p.dados.placar[1]) > 80, 'mostra mais de 80%: ' + p.dados.placar[1]);
});

test('tinta-festa: virada, quem cobre a area do lider no fim passa na frente', () => {
  const p = semBalde(partidaCom(jogo, undefined, vs(2)));
  varre(p, 0, -8, 0, -6, 6);
  poe(p, 0, -8.5, 6.5);
  roda(p, 30);
  assert.ok(p.dados.conta[0] > p.dados.conta[1]);
  varre(p, 1, -8, 8, -6, 6);                  // o outro cobre o chao todo
  poe(p, 1, 8.5, 6.5);
  fim(p);
  assert.equal(p.vencedor, 1);
  confere(p);
});

test('tinta-festa: empate exato da -1', () => {
  const p = semBalde(partidaCom(jogo, undefined, vs(2)));
  poe(p, 0, -8.5, -6.5); poe(p, 1, 8.5, 6.5);
  p.jogadores.forEach(j => { j.vivo = false; });    // ninguem pinta
  fim(p);
  assert.equal(p.vencedor, -1);
});

test('tinta-festa: em times a area dos dois do time soma e o resultado e 0 ou 1', () => {
  const p = semBalde(partidaCom(jogo, undefined, times));
  varre(p, 0, -8, -4, -6, 6);       // J1 (time A)
  varre(p, 2, -3, 0, -6, 6);        // J3 (time A)
  varre(p, 1, 5, 8, -6, 0);         // J2 (time B)
  p.jogadores.forEach((j, i) => poe(p, i, [-8.5, 8.5, -8.5, 8.5][i], [-6.5, -6.5, 6.5, 6.5][i]));
  p.jogadores.forEach(j => { j.vivo = false; });
  assert.ok(p.dados.conta[0] > p.dados.conta[1]);
  assert.ok(p.dados.cor.every(c => c === -1 || c === 0 || c === 1), 'o dono do chao e o time');
  fim(p);
  assert.equal(p.vencedor, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  confere(p);
});

test('tinta-festa: o balde de tinta pinta uma mancha grande para quem pegou', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  poe(p, 0, -8, -6); poe(p, 1, 8, 6);
  p.dados.balde = { x: 0, z: 0, t: 10 };
  poe(p, 1, 0, 0);
  passo(p, DT);
  assert.equal(p.dados.balde, null, 'o balde sumiu');
  assert.ok(p.dados.conta[1] > 25, 'mancha grande: ' + p.dados.conta[1]);
  confere(p);
  assert.ok(p.dados.proxBalde > 3, 'o proximo balde demora');
});

test('tinta-festa: o balde nasce depois de uns segundos, nao fica para sempre e nunca passa de um', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  p.jogadores.forEach(j => { j.vivo = false; });
  assert.equal(p.dados.balde, null);
  roda(p, 8);
  assert.ok(p.dados.balde, 'nasceu');
  assert.ok(Math.abs(p.dados.balde.x) < 9 && Math.abs(p.dados.balde.z) < 7);
  roda(p, 13);
  assert.ok(!p.dados.balde || p.dados.balde.t > 0);
});

test('tinta-festa: o celular repete a porcentagem em texto (do jogador ou do time)', () => {
  const p = semBalde(partidaCom(jogo, undefined, vs(2)));
  poe(p, 0, 0.5, 0.5); poe(p, 1, 8, 6); passo(p, DT);
  assert.match(p.celular[0].texto, /^Você: \d+% do chão$/);
  const q = semBalde(partidaCom(jogo, undefined, times));
  passo(q, DT);
  assert.match(q.celular[3].texto, /^Seu time: \d+% do chão$/);
});

test('tinta-festa: dois no balde no mesmo quadro: sorteia quem leva, sem favorecer o J1', () => {
  const quem = new Set();
  for (let s = 1; s <= 40; s++) {
    const p = partidaCom(jogo, sorteio(s), vs(2));
    poe(p, 0, 0, 0); poe(p, 1, 0.3, 0);
    p.dados.balde = { x: 0.1, z: 0, t: 10 };
    passo(p, DT);
    quem.add(p.dados.fx[0].dono);
  }
  assert.equal(quem.size, 2, 'os dois ja levaram o balde');
});

test('tinta-festa: fumaca (monta e desenha de verdade) com 2, 3, 4 jogadores e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});

test('tinta-festa: rodada de dedos aleatorios termina no tempo e a contagem nunca se perde', () => {
  const { p, segundos } = rodada(jogo, undefined, 5, vs(4));
  assert.ok(segundos >= 39.9 && segundos <= 41, 'durou ' + segundos);
  confere(p);
});
