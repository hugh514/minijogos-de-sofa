import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TIPOS, TEMPO, BARRA_INICIAL, lugar, lzDe } from './pesca-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const tipo = id => TIPOS.findIndex(x => x.id === id);

function aperta(p, i, vezes = 1) {
  for (let k = 0; k < vezes; k++) { entrada(p, i, { x: 0, y: 0, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); }
}
// Partida com os celulares ja "conectados" (contador de toques em 0) e sem mordida sozinha.
function partida(opcoes) {
  const p = partidaCom(jogo, undefined, opcoes);
  p.jogadores.forEach((_, i) => { entrada(p, i, { x: 0, y: 0, n: 0 }); p.dados.pesc[i].t = 99; });
  return p;
}
const fisga = (p, i, id) => { p.dados.pesc[i] = { fase: 'luta', t: 0, tipo: tipo(id), barra: BARRA_INICIAL }; };
// Pesca um peixe do tipo dado para o jogador i.
const fim = p => { for (let k = 0; k < 60 * 80 && p.fase === 'jogando'; k++) passo(p, DT); assert.notEqual(p.fase, 'jogando'); };
const pesca = (p, i, id) => { fisga(p, i, id); aperta(p, i, 40); };

test('pesca-festa: contrato da festa, 35 s, quilos no placar e genero', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(jogo.duracao, 35);
  assert.equal(TEMPO, 35);
  assert.equal(jogo.rotulo, 'quilos');
  assert.equal(jogo.genero, 'reflexo');
  assert.equal(jogo.controle.modo, 'botao');
});

test('pesca-festa: textos em caixa normal, sem travessao, sem emoji e dica de uma frase', () => {
  const textos = [jogo.nome, jogo.dica, jogo.controle.a, jogo.rotulo];
  for (const t of textos) assert.doesNotMatch(t, /[\u2013\u2014]|[A-ZÀ-Ý]{3,}|\p{Extended_Pictographic}/u, t);
  assert.equal((jogo.dica.match(/[.!?]/g) ?? []).length, 1);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][a-zà-ý]/u);
});

test('pesca-festa: com 2, 3 e 4 jogadores cada um tem o proprio pier, na margem certa e sem dividir lugar', () => {
  for (const n of [2, 3, 4]) {
    const p = partidaCom(jogo, undefined, vs(n));
    assert.equal(p.arena.lz, lzDe(n));
    const lugares = p.jogadores.map(j => `${j.x},${j.z}`);
    assert.equal(new Set(lugares).size, n, 'lugares distintos com ' + n);
    p.jogadores.forEach((j, i) => {
      assert.equal(Math.sign(j.x), i % 2 ? 1 : -1, 'J1 e J3 na esquerda, J2 e J4 na direita');
      assert.ok(Math.abs(j.x) < p.arena.lx && Math.abs(j.z) < p.arena.lz);
    });
    assert.equal(p.dados.pesc.length, n);
    assert.equal(p.dados.placar.length, n);
  }
  assert.deepEqual(lugar(2, 0), { lado: -1, z: 0 });
  assert.equal(lugar(4, 0).z, -lugar(4, 2).z);
});

test('pesca-festa: as boias de cada um afundam em momentos diferentes', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  assert.equal(new Set(p.dados.pesc.map(s => s.t)).size, 4);
});

test('pesca-festa: a boia afunda, so o celular de quem teve a mordida vibra e apertar na janela fisga', () => {
  const p = partida(vs(3));
  p.dados.pesc[2].t = 0.1;
  roda(p, 0.2);
  assert.equal(p.dados.pesc[2].fase, 'mordida');
  assert.equal(p.celular[2].vibra, 1);
  assert.equal(p.celular[0].vibra, undefined);
  assert.equal(p.celular[1].vibra, undefined);
  assert.match(p.celular[2].texto, /Aperte agora/);
  aperta(p, 2);
  assert.equal(p.dados.pesc[2].fase, 'luta');
});

test('pesca-festa: demorar mais de 0,6 s perde a mordida; apertar antes espanta os peixes por 2 s', () => {
  const p = partida(vs(2));
  p.dados.pesc[0].t = 0.1;
  roda(p, 0.5);
  assert.equal(p.dados.pesc[0].fase, 'mordida');
  roda(p, 0.4);
  assert.equal(p.dados.pesc[0].fase, 'espera');
  aperta(p, 1);
  assert.equal(p.dados.pesc[1].fase, 'susto');
  assert.ok(p.jogadores[1].vy > 0);
  roda(p, 1.5);
  assert.equal(p.dados.pesc[1].fase, 'susto');
  roda(p, 0.6);
  assert.equal(p.dados.pesc[1].fase, 'espera');
  assert.deepEqual(p.dados.placar, [0, 0]);
});

test('pesca-festa: martelar o botao puxa o peixe e soma o peso, peixe maior exige mais toques', () => {
  for (const [id, peso] of [['pequeno', 1], ['medio', 2], ['grande', 4], ['bota', 0]]) {
    const p = partida(vs(4));
    pesca(p, 3, id);
    assert.deepEqual(p.dados.placar, [0, 0, 0, peso], id);
    assert.deepEqual(p.dados.pegos[3], [tipo(id)]);
  }
  const toques = id => { const p = partida(vs(3)); fisga(p, 0, id); let n = 0; while (p.dados.pesc[0].fase === 'luta' && n < 100) { aperta(p, 0); n++; } return n; };
  const [a, b, c] = ['pequeno', 'medio', 'grande'].map(toques);
  assert.ok(a < b && b < c, `${a} < ${b} < ${c}`);
});

test('pesca-festa: sem apertar o peixe escapa; a bota velha vale zero, avisa e vibra todo mundo', () => {
  const p = partida(vs(3));
  fisga(p, 0, 'grande');
  roda(p, 2);
  assert.equal(p.dados.pesc[0].fase, 'espera');
  assert.deepEqual(p.dados.placar, [0, 0, 0]);
  pesca(p, 1, 'bota');
  assert.equal(p.dados.aviso, 'Bota velha!');
  assert.ok(p.celular.every(c => c.vibra >= 1));
  roda(p, 2);
  assert.equal(p.dados.aviso, '', 'o aviso some');
});

test('pesca-festa: vs, aos 35 s vence o maior peso e devolve o indice de quem pescou mais', () => {
  for (let i = 0; i < 4; i++) {
    const p = partida(vs(4));
    pesca(p, i, 'medio');
    roda(p, TEMPO - 1);
    assert.equal(p.fase, 'jogando');
    roda(p, 1.2);
    assert.equal(p.vencedor, i);
    assert.equal(p.jogadores[i].pontos, 1);
  }
});

test('pesca-festa: vs, o peso decide e nao o numero de peixes', () => {
  const p = partida(vs(3));
  pesca(p, 0, 'pequeno'); pesca(p, 0, 'pequeno'); pesca(p, 2, 'grande');
  assert.deepEqual(p.dados.placar, [2, 0, 4]);
  roda(p, TEMPO + 0.5);
  assert.equal(p.vencedor, 2);
});

test('pesca-festa: empate no peso (vs) e rodada em branco dao -1', () => {
  const p = partida(vs(4));
  pesca(p, 0, 'medio'); pesca(p, 3, 'medio');
  roda(p, TEMPO + 0.5);
  assert.equal(p.vencedor, -1);
  const q = partidaCom(jogo, undefined, vs(2));
  roda(q, TEMPO + 0.5);
  assert.equal(q.vencedor, -1);
  // dois empatados no alto perdem para um terceiro maior
  const r = partida(vs(3));
  pesca(r, 0, 'medio'); pesca(r, 1, 'medio'); pesca(r, 2, 'grande');
  roda(r, TEMPO + 0.5);
  assert.equal(r.vencedor, 2);
});

test('pesca-festa: times, a dupla soma os quilos e o retorno e o time (0 ou 1), nunca o jogador', () => {
  const p = partida(times);
  assert.equal(p.dados.placar.length, 2);
  pesca(p, 0, 'medio'); pesca(p, 2, 'medio');         // J1 + J3 (time A): 4
  pesca(p, 1, 'grande');                              // J2 (time B): 4
  assert.deepEqual(p.dados.placar, [4, 4]);
  pesca(p, 3, 'pequeno');                             // J4 (time B): 5
  assert.deepEqual(p.dados.placar, [4, 5]);
  fim(p);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);

  const q = partida(times);
  pesca(q, 0, 'pequeno'); pesca(q, 2, 'grande');      // time A: 5 contra 4 de um so do B
  pesca(q, 3, 'grande');
  fim(q);
  assert.equal(q.vencedor, 0);
  assert.deepEqual(q.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('pesca-festa: times, empate entre as duplas da -1', () => {
  const p = partida(times);
  pesca(p, 0, 'medio'); pesca(p, 3, 'medio');
  fim(p);
  assert.equal(p.vencedor, -1);
  const q = partidaCom(jogo, undefined, times);
  fim(q);
  assert.equal(q.vencedor, -1);
});

test('pesca-festa: tempo limite, a rodada segue ate os 35 s e termina sozinha mesmo com todos parados', () => {
  const p = partidaCom(jogo, undefined, vs(4));
  roda(p, TEMPO - 0.5);
  assert.equal(p.fase, 'jogando');
  roda(p, 1);
  assert.notEqual(p.fase, 'jogando');
});

test('pesca-festa: o celular repete os quilos (de cada um ou da dupla) e termina no estado final, com aviso', () => {
  const p = partida(vs(3));
  assert.match(p.celular[0].texto, /^Você: 0 kg\. /);
  pesca(p, 0, 'grande');
  assert.match(p.celular[0].texto, /^Você: 4 kg\. /);
  assert.match(p.celular[1].texto, /^Você: 0 kg\. /);
  const q = partida(times);
  pesca(q, 0, 'medio');
  assert.match(q.celular[2].texto, /^Sua dupla: 2 kg\. /, 'o parceiro ve o quilo da dupla');
  assert.match(q.celular[1].texto, /^Sua dupla: 0 kg\. /);
  // estado final deixado antes de devolver o resultado
  p.t = TEMPO;
  const res = jogo.atualiza(p, DT);
  assert.equal(res, 0);
  assert.equal(p.dados.aviso, 'Acabou o tempo!');
  assert.match(p.celular[0].texto, /Acabou o tempo!/);
  assert.match(p.celular[2].texto, /Acabou o tempo!/);
});

test('pesca-festa: nenhum texto de tela ou de celular traz id, undefined, NaN nem caixa alta crua', () => {
  const p = partida(times);
  pesca(p, 0, 'grande'); pesca(p, 1, 'bota');
  const textos = [p.dados.aviso, ...p.celular.map(c => c.texto)];
  for (const t of textos) assert.doesNotMatch(String(t), /undefined|NaN|null|[\u2013\u2014]|[A-ZÀ-Ý]{3,}|pesca-festa/u, String(t));
});

test('pesca-festa: fumaca com cada n e modo declarados (vs 2, 3, 4 e times 4)', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15, JSON.stringify(o));
});

test('pesca-festa: dedos aleatorios nao quebram, a rodada dura 35 s e o vencedor e valido', () => {
  for (const o of [vs(3), vs(4), times]) {
    for (let s = 1; s <= 4; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, o);
      assert.ok(segundos >= 34.9 && segundos <= 36.5, 'durou ' + segundos);
      assert.ok(p.dados.placar.every(Number.isFinite));
    }
  }
});
