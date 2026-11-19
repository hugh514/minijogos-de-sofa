import test from 'node:test';
import assert from 'node:assert/strict';
import { passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, VIDAS, pavio } from './batata-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
// Roda ate a rodada acabar e devolve os segundos de jogo.
function jogaAte(p, antes = () => {}, max = 75) { let t = 0; while (p.fase === 'jogando' && t < max) { antes(p); passo(p, DT); t += DT; } return t; }
// Espera a batata ter dono (depois da pausa) e devolve quem e.
function comBatata(p) { for (let k = 0; k < 600 && p.dados.com < 0; k++) passo(p, DT); return p.dados.com; }
const estoura = p => { p.dados.pavio = 0.01; roda(p, 0.1); };

test('batata-festa: contrato da festa vs e times, de 2 a 4, e tempo de 20 a 50 s', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(TEMPO, 45);
});

test('batata-festa: o pavio da primeira rodada tem pelo menos 4,8 s e nunca fica abaixo de 2,8 s', () => {
  assert.ok(pavio(0, 0) >= 4.8);
  for (let r = 0; r < 40; r++) assert.ok(pavio(r, 0) >= 2.8);
  assert.ok(pavio(8, 0) < pavio(0, 0), 'rodadas mais curtas');
});

test('batata-festa: cada um comeca com 2 vidas e a batata so aparece depois de uma pausa', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  assert.deepEqual(p.dados.vidas, [VIDAS, VIDAS, VIDAS]);
  assert.deepEqual(p.dados.placar, [2, 2, 2]);
  roda(p, 1);
  assert.equal(p.dados.com, -1);
  const h = comBatata(p);
  assert.ok(h >= 0 && h < 3);
  assert.match(p.celular[h].texto, /^Você está com a batata!/);
  assert.match(p.celular[(h + 1) % 3].texto, /^Fuja da batata!/);
});

test('batata-festa: encostar em outro passa a batata, e quem passou nao recebe de volta na hora', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  const h = comBatata(p), o = 1 - h;
  roda(p, 1);
  poe(p, h, 0, 0); poe(p, o, 1.3, 0);
  roda(p, 0.1);
  assert.equal(p.dados.com, o, 'passou');
  assert.ok(p.dados.semReceber[h] > 1);
  poe(p, h, 0, 0); poe(p, o, 1.3, 0);
  roda(p, 0.5);
  assert.equal(p.dados.com, o, 'o primeiro nao pegou de volta de imediato');
});

test('batata-festa: quando o pavio acaba, quem esta com a batata perde 1 vida e depois da pausa ela volta a outro', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  const h = comBatata(p);
  estoura(p);
  assert.equal(p.dados.vidas[h], 1);
  assert.equal(p.dados.com, -1);
  assert.equal(p.jogadores[h].vivo, true, 'a primeira vida nao elimina');
  assert.equal(p.fase, 'jogando');
  roda(p, 1.8);
  assert.ok(p.dados.com >= 0 && p.dados.com !== h, 'nova batata em outro jogador');
});

test('batata-festa: sem vida o jogador e eliminado e o ultimo que sobra vence (vs)', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  comBatata(p);
  const a = p.dados.com;
  estoura(p);
  roda(p, 1.8);
  assert.equal(p.fase, 'jogando', 'uma vida a menos ainda nao decide');
  p.dados.com = a; p.dados.pavio = 0.01; roda(p, 0.1);
  assert.equal(p.jogadores[a].vivo, false);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1 - a);
  assert.equal(p.jogadores[1 - a].pontos, 1);
});

test('batata-festa: em times o time so perde quando os dois ficam sem vida e vence o time inteiro', () => {
  const p = partidaCom(jogo, undefined, times);
  comBatata(p);
  for (const alvo of [1, 1, 3]) {                       // J2 perde as 2 vidas, J4 ainda segura o time B
    roda(p, 2);
    p.dados.com = alvo; p.dados.pavio = 0.01; p.dados.pausa = 0; roda(p, 0.1);
    if (alvo === 1 && p.dados.vidas[1] === 1) assert.equal(p.fase, 'jogando');
  }
  assert.deepEqual(p.dados.placar, [4, 1]);
  assert.equal(p.fase, 'jogando', 'J4 ainda tem 1 vida');
  roda(p, 2);
  p.dados.com = 3; p.dados.pavio = 0.01; roda(p, 0.1);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 0);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('batata-festa: termina pelo tempo, vence quem tem mais vidas, e empate da -1', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  p.dados.vidas = [1, 2, 1];
  p.dados.pausa = 999;
  const t = jogaAte(p);
  assert.ok(Math.abs(t - TEMPO) < 0.1, 'acabou aos ' + t);
  assert.equal(p.vencedor, 1);
  const q = partidaCom(jogo, undefined, vs(2)); q.dados.pausa = 999;
  jogaAte(q);
  assert.equal(q.vencedor, -1);
  const r = partidaCom(jogo, undefined, times); r.dados.vidas = [2, 1, 2, 1]; r.dados.pausa = 999;
  jogaAte(r);
  assert.equal(r.vencedor, 0, 'o time A soma 4 vidas contra 2');
  assert.deepEqual(r.jogadores.map(j => j.pontos), [1, 0, 1, 0]);
});

test('batata-festa: ninguem parado acaba antes de 9 s, pois eliminar alguem pede dois estouros', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) {
    const p = partidaCom(jogo, undefined, o);
    const t = jogaAte(p);
    assert.ok(t >= 9, `${o.modo} ${o.n}: ${t}`);
  }
});

test('batata-festa: dedos aleatorios nunca acabam em menos de 5 s (40 sementes, vs 2, 3, 4 e times)', () => {
  for (const o of [vs(2), vs(3), vs(4), times])
    for (let s = 1; s <= 40; s++) {
      const { p, segundos } = rodada(jogo, aleatorio, s, o);
      assert.ok(segundos >= 5, `${o.modo} ${o.n} semente ${s}: ${segundos}`);
      const validos = o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()];
      assert.ok(validos.includes(p.vencedor));
    }
});

test('batata-festa: fumaca com 2, 3, 4 jogadores e em times', () => {
  for (const o of [vs(2), vs(3), vs(4), times]) assert.equal(fumaca(jogo, o).length, 15);
});

test('batata-festa: com dois no alcance, a batata vai para o mais perto, nao para o primeiro da lista', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  const h = comBatata(p);
  roda(p, 1);
  const [longe, perto] = [0, 1, 2].filter(i => i !== h);      // o mais longe vem antes na lista
  poe(p, h, 0, 0); poe(p, longe, -1.9, 0); poe(p, perto, 1.3, 0);
  passo(p, DT);
  assert.equal(p.dados.com, perto);
});
