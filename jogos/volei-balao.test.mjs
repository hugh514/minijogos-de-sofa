import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo from './volei-balao.mjs';

const bate = (p, i, y = 0) => { entrada(p, i, { x: 0, y, d: false, n: p.jogadores[i].n ?? 0 }); entrada(p, i, { x: 0, y, d: false, n: (p.jogadores[i].n ?? 0) + 1 }); passo(p, DT); };
const bola = (p, x, y, vx = 0, vy = 0, extra = {}) => { Object.assign(p.dados.b, { x, y, vx, vy, espera: 0, pausa: 0, ult: -1, n: 0 }, extra); };
const parados = p => { p.dados.e[0].x = -5; p.dados.e[1].x = 5; };

// roda ate o balao tocar o chao e devolve o x onde caiu
function ondeCai(p) {
  for (let k = 0; k < 600; k++) { passo(p, DT); if (p.dados.b.pausa > 0 || p.fase !== 'jogando') return p.dados.b.x; }
  return NaN;
}

test('volei: genero gol, botao Bate e dica que cita o botao', () => {
  assert.equal(jogo.genero, 'gol');
  assert.equal(jogo.controle.a, 'Bate');
  assert.ok(jogo.dica.includes('Bate'));
  assert.ok(!/[—–]/.test(jogo.dica + jogo.nome));
});

test('volei: rebater manda o balao para o lado do outro e conta a troca', () => {
  const p = partidaCom(jogo);
  parados(p); bola(p, -5, 2.2, 0, -1);
  bate(p, 0);
  const b = p.dados.b;
  assert.ok(b.vx > 0, 'vai para a direita');
  assert.equal(b.ult, 0);
  assert.equal(b.n, 1);
  assert.ok(ondeCai(p) > 0, 'cai do lado do jogador 2');
  assert.equal(p.dados.placar[0], 1, 'o outro nao rebateu: ponto de quem bateu');
});

test('volei: bater longe do balao nao faz nada', () => {
  const p = partidaCom(jogo);
  parados(p); bola(p, -5, 6.5, 0, 0);
  bate(p, 0);
  assert.equal(p.dados.b.n, 0);
  assert.equal(p.dados.b.vx, 0);
});

test('volei: o balao do outro lado da rede nao pode ser rebatido', () => {
  const p = partidaCom(jogo);
  p.dados.e[0].x = -1.6; bola(p, 2.5, 2, 0, 0);
  bate(p, 0);
  assert.equal(p.dados.b.n, 0);
});

test('volei: o mesmo jogador nao rebate duas vezes seguidas', () => {
  const p = partidaCom(jogo);
  parados(p); bola(p, -5, 2.2, 0, -1);
  bate(p, 0);
  for (let k = 0; k < 40; k++) { Object.assign(p.dados.b, { x: -5, y: 2.2, vx: 0, vy: 0 }); passo(p, DT); }
  Object.assign(p.dados.b, { x: -5, y: 2.2, vx: 0, vy: 0 });
  bate(p, 0);
  assert.equal(p.dados.b.n, 1);
  assert.equal(p.dados.b.vx, 0, 'o balao nao foi rebatido de novo');
});

test('volei: joystick para cima manda longe e para baixo manda curto', () => {
  const longe = partidaCom(jogo), curto = partidaCom(jogo);
  for (const [p, y] of [[longe, -1], [curto, 1]]) { parados(p); bola(p, -5, 2.2, 0, -1); bate(p, 0, y); p.dados.e[1].x = 10; }
  const xl = ondeCai(longe), xc = ondeCai(curto);
  assert.ok(xl > 7.5, 'longe: ' + xl);
  assert.ok(xc < 4 && xc > 0, 'curto: ' + xc);
});

test('volei: a cada rebatida o balao fica mais rapido (menos tempo no ar)', () => {
  const tempo = n => {
    const p = partidaCom(jogo);
    parados(p); bola(p, -5, 2.2, 0, -1, { n }); bate(p, 0); p.dados.e[1].x = 10;
    let k = 0;
    while (k < 600 && p.dados.b.pausa <= 0) { passo(p, DT); k++; }
    return k * DT;
  };
  assert.ok(tempo(6) < tempo(0) * 0.85, `${tempo(6)} contra ${tempo(0)}`);
});

test('volei: a rede segura o balao que bate nela e ele volta', () => {
  const p = partidaCom(jogo);
  parados(p); bola(p, -1.6, 2.6, 6, 0, { ult: 0 });
  roda(p, 0.4);
  assert.ok(p.dados.b.vx < 0, 'voltou');
  assert.ok(p.dados.rede.n >= 1);
  assert.equal(p.dados.b.ult, -1, 'quem bateu pode rebater de novo');
});

test('volei: um balao rebatido de perto da rede ainda passa por cima dela', () => {
  const p = partidaCom(jogo);
  p.dados.e[0].x = -2.4; p.dados.e[1].x = 10; bola(p, -2.4, 3.6, 0, 0);
  bate(p, 0, 1);
  const x = ondeCai(p);
  assert.ok(x > 0, 'passou: ' + x);
  assert.equal(p.dados.rede.n, 0);
});

test('volei: balao no chao e ponto de quem esta do outro lado, e quem perdeu saca', () => {
  const p = partidaCom(jogo);
  parados(p); bola(p, -6, 1.5, 0, -3);
  roda(p, 0.5);
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.ok(p.dados.aviso.includes('Ponto'));
  roda(p, 1.2);
  assert.ok(p.dados.b.x < 0, 'quem perdeu saca do seu lado');
  assert.equal(p.dados.b.pausa, 0);
});

test('volei: retorno 0 e 1 no ponto que fecha o placar', () => {
  const a = partidaCom(jogo); parados(a); a.dados.placar = [3, 1]; bola(a, 6, 1.5, 0, -3); roda(a, 0.5);
  assert.equal(a.vencedor, 0);
  const b = partidaCom(jogo); parados(b); b.dados.placar = [1, 3]; bola(b, -6, 1.5, 0, -3); roda(b, 0.5);
  assert.equal(b.vencedor, 1);
});

test('volei: no fim do tempo vence quem esta na frente', () => {
  const p = partidaCom(jogo);
  parados(p); p.dados.placar = [1, 2]; p.t = 39.9; bola(p, 0.2, 8, 0, 0);
  roda(p, 0.3);
  assert.equal(p.vencedor, 1);
});

test('volei: empate no tempo vira ponto de ouro, e o ponto de ouro decide', () => {
  const p = partidaCom(jogo);
  parados(p); p.dados.placar = [2, 2]; p.t = 39.9; p.dados.b.espera = 50;
  roda(p, 0.3);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.dados.ouro, true);
  bola(p, 6, 1.5, 0, -3); roda(p, 0.5);
  assert.equal(p.vencedor, 0);
});

test('volei: empate que dura ate o limite do ouro termina em -1', () => {
  const p = partidaCom(jogo);
  parados(p); p.dados.placar = [2, 2]; p.t = 39.9; p.dados.b.espera = 99;
  roda(p, 11);
  assert.equal(p.vencedor, -1);
  assert.ok(p.dados.aviso && p.celular[0].texto && p.celular[1].texto);
});

test('volei: ninguem decide a rodada em menos de 5 s', () => {
  const p = partidaCom(jogo);
  for (let k = 0; k < 4.9 * 60; k++) {
    if (k % 5 === 0) entrada(p, k % 2, { x: (k % 3) - 1, y: 0, d: false, n: k });
    passo(p, DT);
  }
  assert.equal(p.fase, 'jogando');
});

test('volei: texto final sem undefined nem travessao', () => {
  const { p } = rodada(jogo, aleatorio, 5);
  assert.ok(!/undefined|NaN|[—–]/.test([p.dados.aviso, ...p.celular.map(c => c.texto)].join(' ')));
});

test('volei: jogador nao passa da rede nem do fundo', () => {
  const p = partidaCom(jogo);
  for (let k = 0; k < 180; k++) { entrada(p, 0, { x: 1, y: 0, d: false, n: 0 }); entrada(p, 1, { x: 1, y: 0, d: false, n: 0 }); passo(p, DT); }
  assert.ok(p.dados.e[0].x <= -1.49 && p.dados.e[1].x <= 10.31 && p.dados.e[1].x >= 1.49);
});

test('volei: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  assert.equal(fumaca(jogo).length, 15);
});
