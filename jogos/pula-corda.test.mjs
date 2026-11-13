import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from './_teste.mjs';
import jogo from './pula-corda.mjs';

// Congela os sorteios (inversao e finta) e a aceleracao, para o teste controlar a corda.
function limpa(p) {
  const d = p.dados;
  d.proxInv = Infinity; d.proxFinta = Infinity; d.acel = 0; d.omega = 3; d.sentido = 1; d.finta = 0;
}

// Toque no botao com contador: o primeiro envio so fixa a base, o segundo e o toque de verdade.
function toca(p, i, campo = 'nb') {
  if (p.jogadores[i][campo] === undefined) entrada(p, i, { x: 0, y: 0, [campo]: 0 });
  entrada(p, i, { x: 0, y: 0, [campo]: p.jogadores[i][campo] + 1 });
}

// Um giro: a corda fica 0.3 rad antes do chao (passa em 0.1 s); quem esta em "pulam" aperta B na hora.
function giro(p, pulam = []) {
  const d = p.dados;
  d.fase = -0.3; d.omega = 3; d.caido = [0, 0]; d.noAr = [-1, -1];
  for (const i of pulam) toca(p, i);
  roda(p, 0.6);
}

test('pula-corda: quem pula passa a corda sem perder vida', () => {
  const p = partidaCom(jogo); limpa(p);
  giro(p, [0, 1]);
  assert.deepEqual(p.dados.placar, [3, 3]);
  assert.equal(p.fase, 'jogando');
});

test('pula-corda: quem nao pula tropeca e perde uma vida, so ele', () => {
  const p = partidaCom(jogo); limpa(p);
  giro(p, [1]);
  assert.deepEqual(p.dados.placar, [2, 3]);
  assert.ok(p.dados.caido[0] > 0, 'o boneco tropecado fica caido');
  assert.equal(p.celular[0].vibra, 1, 'o celular de quem tropecou vibra');
  assert.equal(p.celular[1].vibra, undefined);
});

test('pula-corda: 3 tropecos do jogador 1 dao a vitoria ao jogador 2', () => {
  const p = partidaCom(jogo); limpa(p);
  giro(p, [1]); giro(p, [1]);
  assert.equal(p.fase, 'jogando');
  giro(p, [1]);
  assert.equal(p.vencedor, 1);
});

test('pula-corda: 3 tropecos do jogador 2 dao a vitoria ao jogador 1', () => {
  const p = partidaCom(jogo); limpa(p);
  giro(p, [0]); giro(p, [0]); giro(p, [0]);
  assert.equal(p.vencedor, 0);
});

test('pula-corda: os dois tropecando no mesmo giro, ultima vida de cada um, empatam', () => {
  const p = partidaCom(jogo); limpa(p);
  p.dados.placar = [1, 1];
  giro(p, []);
  assert.equal(p.vencedor, -1);
});

test('pula-corda: no limite de tempo vence quem tem mais vidas; igual empata', () => {
  const congela = placar => {
    const p = partidaCom(jogo); limpa(p);
    p.dados.omega = 0; p.dados.fase = Math.PI; p.dados.placar = placar;
    return p;
  };
  let p = congela([3, 3]);
  roda(p, 39);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, -1);
  p = congela([2, 3]); roda(p, 41);
  assert.equal(p.vencedor, 1);
  p = congela([3, 1]); roda(p, 41);
  assert.equal(p.vencedor, 0);
});

test('pula-corda: toque curto de B nao se perde (A tambem pula)', () => {
  let p = partidaCom(jogo); limpa(p);
  toca(p, 0); passo(p, DT); passo(p, DT); passo(p, DT);
  assert.ok(p.jogadores[0].y > 0, 'saiu do chao com um toque de um quadro');
  assert.equal(p.jogadores[1].y, 0);
  p = partidaCom(jogo); limpa(p);
  toca(p, 1, 'n'); passo(p, DT); passo(p, DT); passo(p, DT);
  assert.ok(p.jogadores[1].y > 0);
});

test('pula-corda: o pulo tem altura, termina e so recomeca depois de pousar', () => {
  const p = partidaCom(jogo); limpa(p);
  let max = 0;
  toca(p, 0);
  for (let q = 0; q < 20; q++) { passo(p, DT); max = Math.max(max, p.jogadores[0].y); }
  assert.ok(max > 1.5, 'altura ' + max);
  toca(p, 0); passo(p, DT);                       // ainda no ar: o toque fica guardado so um instante
  roda(p, 1);
  assert.equal(p.jogadores[0].y, 0);
});

test('pula-corda: boneco caido nao tropeca de novo logo em seguida e nao consegue pular', () => {
  const p = partidaCom(jogo); limpa(p);
  giro(p, []);
  assert.deepEqual(p.dados.placar, [2, 2]);
  p.dados.fase = -0.3; p.dados.omega = 3;          // outra corda passa enquanto estao caidos
  toca(p, 0); roda(p, 0.3);
  assert.deepEqual(p.dados.placar, [2, 2]);
  assert.equal(p.dados.noAr[0], -1);
  roda(p, 1.5);
  assert.equal(p.dados.caido[0], 0, 'levanta depois de um tempo');
});

test('pula-corda: a corda inverte o sentido so quando esta longe do chao', () => {
  const p = partidaCom(jogo); limpa(p);
  p.dados.fase = -0.5; p.dados.omega = 0.01; p.dados.proxInv = 0;      // perto do chao: espera
  passo(p, DT);
  assert.equal(p.dados.sentido, 1);
  p.dados.fase = -3.0;
  passo(p, DT);
  assert.equal(p.dados.sentido, -1);
  assert.ok(p.dados.proxInv > 3, 'sorteia a proxima inversao');
});

test('pula-corda: a finta recua a corda sem tocar o chao e depois ela volta a passar', () => {
  const p = partidaCom(jogo); limpa(p);
  p.dados.fase = -1.2; p.dados.proxFinta = 0;
  roda(p, 0.4);
  assert.ok(p.dados.fase < -1.2, 'recuou: ' + p.dados.fase);
  assert.deepEqual(p.dados.placar, [3, 3]);
  roda(p, 1.5);
  assert.deepEqual(p.dados.placar, [2, 2], 'depois da finta a corda de verdade passa');
});

test('pula-corda: a corda acelera aos poucos e para num maximo', () => {
  const p = partidaCom(jogo);
  p.dados.proxInv = Infinity; p.dados.proxFinta = Infinity; p.dados.placar = [99, 99];
  const v0 = p.dados.omega;
  roda(p, 15);
  const v1 = p.dados.omega;
  assert.ok(v1 > v0 + 0.5);
  roda(p, 20);
  assert.ok(p.dados.omega >= v1 && p.dados.omega <= 7 + 1e-9);
});

test('pula-corda: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
  assert.ok(vencedores.every(v => [-1, 0, 1].includes(v)));
});
