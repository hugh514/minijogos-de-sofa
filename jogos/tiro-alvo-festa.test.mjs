import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TIPOS, TEMPO, lugar, maxAlvos, entreAlvos } from './tiro-alvo-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const alvo = (tipo, x, z) => ({ tipo, x, z, r: TIPOS[tipo].r, vida: 99, t: 1, vx: 0, vz: 0 });
// partida sem alvos nascendo sozinhos, com os alvos dados
function cena(opcoes, ...alvos) {
  const p = partidaCom(jogo, undefined, opcoes);
  p.dados.nasce = 999; p.dados.alvos = alvos;
  return p;
}
const fim = p => { for (let k = 0; k < 60 * 80 && p.fase === 'jogando'; k++) { p.dados.nasce = 999; p.dados.alvos = []; passo(p, DT); } assert.notEqual(p.fase, 'jogando'); };
const GANHO = 1.4, MX = 8.2, MZ = 5.5;
// Faz o jogador i atirar no ponto (x, z) do chao: segura o dedo ate a mira chegar e solta.
function atira(p, i, x, z) {
  const ex = x / MX / GANHO, ey = z / MZ / GANHO;
  for (let k = 0; k < 30; k++) { entrada(p, i, { x: ex, y: ey, d: true }); passo(p, DT); }
  entrada(p, i, { x: ex, y: ey, d: false }); passo(p, DT);
}

test('tiro-alvo-festa: contrato da festa, 30 s, genero e controle de toque', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, 30);
  assert.equal(TEMPO, 30);
  assert.equal(jogo.genero, 'mira');
  assert.equal(jogo.controle.modo, 'toque');
  assert.equal(jogo.rotulo, 'pontos');
});

test('tiro-alvo-festa: textos em caixa normal, sem travessao, sem emoji e dica de uma frase', () => {
  for (const t of [jogo.nome, jogo.dica, jogo.rotulo]) assert.doesNotMatch(t, /[\u2013\u2014]|[A-ZÀ-Ý]{3,}|\p{Extended_Pictographic}/u, t);
  assert.equal((jogo.dica.match(/[.!?]/g) ?? []).length, 1);
});

test('tiro-alvo-festa: com 2, 3 e 4 jogadores cada um tem a propria posicao, a propria mira e a propria fila de tiro', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.equal(new Set(p.jogadores.map(j => `${j.x},${j.z}`)).size, n);
    p.jogadores.forEach((j, i) => {
      assert.equal(Math.sign(j.x), i % 2 ? 1 : -1, 'J1 e J3 na esquerda, J2 e J4 na direita');
      assert.ok(Math.abs(j.x) < p.arena.lx && Math.abs(j.z) < p.arena.lz);
    });
    assert.equal(p.dados.miras.length, n);
    assert.equal(p.dados.recarga.length, n);
    assert.equal(p.dados.placar.length, n);
    assert.equal(new Set(p.dados.miras.map(m => `${m.x},${m.z}`)).size, 2, 'cada lado comeca com a mira do seu lado');
  }
  assert.deepEqual(lugar(2, 1), { x: 10.1, z: 0 });
  assert.equal(lugar(4, 0).z, lugar(4, 1).z);
  assert.equal(lugar(4, 0).z, -lugar(4, 2).z);
});

test('tiro-alvo-festa: mais jogadores, mais alvos (mais vagas e nascem mais depressa)', () => {
  assert.equal(maxAlvos(2), 12);
  assert.ok(maxAlvos(4) > maxAlvos(3) && maxAlvos(3) > maxAlvos(2));
  assert.ok(Math.abs(entreAlvos(2) - 0.7) < 1e-9);
  assert.ok(entreAlvos(4) < entreAlvos(2));
  const nasceram = n => { const p = partidaCom(jogo, undefined, vs(n)); roda(p, 6); return p.dados.total; };
  assert.ok(nasceram(4) > nasceram(2) * 1.5, 'com 4 nascem bem mais alvos');
  const p = partidaCom(jogo, undefined, vs(3));
  roda(p, 6);
  assert.ok(p.dados.alvos.length <= maxAlvos(3));
  assert.ok(p.dados.alvos.every(a => Math.abs(a.x) <= 7.6 && Math.abs(a.z) <= 4.9));
});

test('tiro-alvo-festa: a mira segue o dedo com suavizacao e arrastar nao atira', () => {
  const p = cena(vs(4));
  entrada(p, 2, { x: 0.5, y: -0.3, d: true }); passo(p, DT);
  const logo = p.dados.miras[2].x;
  for (let k = 0; k < 30; k++) { entrada(p, 2, { x: 0.5, y: -0.3, d: true }); passo(p, DT); }
  const m = p.dados.miras[2];
  assert.ok(Math.abs(logo - 0.7 * 8.2) > 0.1 && Math.abs(m.x - 0.7 * 8.2) < 0.05, 'nao pula de uma vez');
  assert.deepEqual(p.dados.tiros, []);
  assert.deepEqual(p.dados.pontos, [0, 0, 0, 0]);
});

test('tiro-alvo-festa: vs, soltar atira onde a mira esta; comum vale 1, dourado 3, bomba tira 2, vazio nao pontua', () => {
  const p = cena(vs(4), alvo('comum', 0, 0), alvo('dourado', 5, 1), alvo('bomba', -4, -2), alvo('comum', 6, 4));
  atira(p, 0, 0, 0);
  assert.ok(p.jogadores[0].vy > 0 || p.jogadores[0].y > 0, 'quem acerta comemora pulando');
  atira(p, 1, 5, 1);
  atira(p, 3, -4, -2);
  atira(p, 2, -6, 4);                          // no vazio
  assert.deepEqual(p.dados.pontos, [1, 3, 0, -2]);
  assert.deepEqual(p.dados.placar, [1, 3, 0, -2]);
  assert.equal(p.dados.alvos.length, 1, 'so o alvo longe sobrou');
  assert.ok(p.celular[3].vibra >= 1, 'a bomba vibra o celular de quem acertou');
  assert.ok(p.eventos.includes('explosao') || p.dados.fx.some(f => f.cor === -3));
});

test('tiro-alvo-festa: dois no mesmo alvo, so um leva, e nao e sempre o mesmo jogador', () => {
  const quem = new Set();
  for (let s = 0; s < 8; s++) {
    const p = cena(vs(4), alvo('comum', 0, 0));
    p.dados.vez = s;
    for (let k = 0; k < 30; k++) { for (const i of [0, 1, 2, 3]) entrada(p, i, { x: 0, y: 0, d: true }); passo(p, DT); }
    for (const i of [0, 1, 2, 3]) entrada(p, i, { x: 0, y: 0, d: false });
    passo(p, DT);
    assert.equal(p.dados.pontos.reduce((a, b) => a + b, 0), 1);
    quem.add(p.dados.pontos.indexOf(1));
  }
  assert.ok(quem.size > 1, 'o desempate gira entre os jogadores');
});

test('tiro-alvo-festa: recarga de 0,4 s e toque curto atira no lugar do dedo', () => {
  const p = cena(vs(3), alvo('comum', 0, 0), alvo('comum', 0, 3));
  atira(p, 0, 0, 0);
  assert.equal(p.dados.pontos[0], 1);
  for (let k = 0; k < 12; k++) { entrada(p, 0, { x: 0, y: 3 / 5.5 / 1.4, d: true }); passo(p, DT); }
  entrada(p, 0, { x: 0, y: 3 / 5.5 / 1.4, d: false }); passo(p, DT);
  assert.equal(p.dados.pontos[0], 1, 'ainda recarregando');
  roda(p, 0.3);
  assert.equal(p.dados.pontos[0], 2, 'o tiro guardado sai quando a recarga acaba');
  const q = cena(vs(3), alvo('comum', 4, -2));
  entrada(q, 1, { x: 0, y: 0, d: false, n: 0 }); passo(q, DT);
  entrada(q, 1, { x: 4 / 8.2 / 1.4, y: -2 / 5.5 / 1.4, d: false, n: 1 }); passo(q, DT);
  assert.deepEqual(q.dados.pontos, [0, 1, 0]);
});

test('tiro-alvo-festa: alvos em dobro nos 8 s finais', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  roda(p, TEMPO - 8 - 0.5);
  assert.equal(p.dados.dobro, false);
  roda(p, 1);
  assert.equal(p.dados.dobro, true);
  assert.equal(p.dados.aviso, 'Alvos em dobro!');
});

test('tiro-alvo-festa: vs, no tempo limite vence o maior placar e devolve o indice de cada jogador', () => {
  for (let i = 0; i < 4; i++) {
    const p = cena(vs(4));
    p.dados.pontos[i] = 3; p.dados.pontos[(i + 1) % 4] = 2;
    fim(p);
    assert.equal(p.vencedor, i);
    assert.equal(p.jogadores[i].pontos, 1);
  }
  const q = cena(vs(3));
  q.dados.pontos = [1, -2, 0];                  // placar negativo tambem decide
  fim(q);
  assert.equal(q.vencedor, 0);
});

test('tiro-alvo-festa: empate (vs) e rodada sem tiros dao -1, e dois empatados no alto perdem para um terceiro maior', () => {
  for (const n of [2, 3, 4]) { const p = cena(vs(n)); fim(p); assert.equal(p.vencedor, -1, 'n ' + n); }
  const p = cena(vs(4));
  p.dados.pontos = [3, 0, 3, 1];
  fim(p);
  assert.equal(p.vencedor, -1);
  const q = cena(vs(4));
  q.dados.pontos = [3, 0, 3, 5];
  fim(q);
  assert.equal(q.vencedor, 3);
});

test('tiro-alvo-festa: times, a dupla soma os pontos e o retorno e o time (0 ou 1), nunca o jogador', () => {
  const p = cena(times, alvo('comum', 0, 0), alvo('dourado', 5, 1), alvo('comum', -5, 3));
  atira(p, 0, 0, 0);       // J1, time A: 1
  atira(p, 2, -5, 3);      // J3, time A: 1
  atira(p, 1, 5, 1);       // J2, time B: 3
  assert.deepEqual(p.dados.placar, [2, 3]);
  fim(p);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);

  const q = cena(times);
  q.dados.pontos = [2, 1, 2, 1];                // A 4 contra B 2: ninguem sozinho no time B passaria
  fim(q);
  assert.equal(q.vencedor, 0);
  assert.deepEqual(q.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
  const r = cena(times);
  r.dados.pontos = [0, 5, 0, -1];               // J2 sozinho faz 5, mas a dupla B soma 4 contra 0 do A
  fim(r);
  assert.equal(r.vencedor, 1);
});

test('tiro-alvo-festa: times, empate entre as duplas da -1, e bomba de um desconta da dupla', () => {
  const p = cena(times);
  p.dados.pontos = [3, 1, 0, 2];
  fim(p);
  assert.equal(p.vencedor, -1);
  const q = cena(times, alvo('bomba', 0, 0));
  q.dados.pontos = [3, 0, 0, 0];
  atira(q, 2, 0, 0);                            // J3 erra feio, a dupla A cai de 3 para 1
  assert.deepEqual(q.dados.placar, [1, 0]);
});

test('tiro-alvo-festa: tempo limite, a rodada segue ate os 30 s e acaba sozinha mesmo com todos parados', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  roda(p, TEMPO - 0.5);
  assert.equal(p.fase, 'jogando');
  roda(p, 1);
  assert.notEqual(p.fase, 'jogando');
});

test('tiro-alvo-festa: o celular repete os pontos (do jogador ou da dupla) e termina no estado final, com aviso', () => {
  const p = cena(vs(3), alvo('dourado', 0, 0));
  assert.match(p.celular[0].texto, /^Você: 0 pontos\. Arraste e solte para atirar$/);
  atira(p, 1, 0, 0);
  assert.match(p.celular[1].texto, /^Você: 3 pontos\. /);
  assert.match(p.celular[0].texto, /^Você: 0 pontos\. /);
  const q = cena(times, alvo('comum', 0, 0));
  atira(q, 0, 0, 0);
  assert.match(q.celular[2].texto, /^Sua dupla: 1 ponto\. /, 'o parceiro ve os pontos da dupla');
  assert.match(q.celular[1].texto, /^Sua dupla: 0 pontos\. /);
  // estado final deixado antes de devolver o resultado
  p.t = TEMPO;
  const res = jogo.atualiza(p, DT);
  assert.equal(res, 1);
  assert.equal(p.dados.aviso, 'Acabou o tempo!');
  assert.match(p.celular[1].texto, /Acabou o tempo!/);
  assert.match(p.celular[2].texto, /Acabou o tempo!/);
});

test('tiro-alvo-festa: nenhum texto de tela ou de celular traz id, undefined, NaN nem caixa alta crua', () => {
  const p = cena(times, alvo('bomba', 0, 0));
  atira(p, 0, 0, 0);
  p.dados.tAviso = 0;
  roda(p, 23);
  for (const t of [p.dados.aviso, ...p.celular.map(c => c.texto)]) assert.doesNotMatch(String(t), /undefined|NaN|null|[\u2013\u2014]|[A-ZÀ-Ý]{3,}|tiro-alvo-festa/u, String(t));
});

test('tiro-alvo-festa: fumaca com cada n e modo declarados (vs 2, 3, 4 e times 4)', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15, JSON.stringify(o));
});

test('tiro-alvo-festa: dedos aleatorios nao quebram, a rodada dura 30 s e os pontos ficam finitos', () => {
  for (const o of [vs(3), vs(4), times]) {
    for (let s = 1; s <= 4; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, o);
      assert.ok(segundos >= 29.9 && segundos <= 31.5, 'durou ' + segundos);
      assert.ok(p.dados.placar.every(Number.isFinite));
    }
  }
});
