import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, DT } from '../jogos/_teste.mjs';
import jogo, { forcaEm } from './boliche.mjs';

// Toque no botão com contador: um toque que já chega solto (n subiu e d false).
function toca(p, i, x = 0) {
  const n = p.jogadores[i].n ?? 0;
  entrada(p, i, { x, y: 0, d: false, n });
  entrada(p, i, { x, y: 0, d: false, n: n + 1 });
  passo(p, DT);
}
// Segura o botão por "seg" segundos e solta. A força vale forcaEm(seg).
function segura(p, i, seg, x = 0) {
  const n = p.jogadores[i].n ?? 0;
  entrada(p, i, { x, y: 0, d: false, n }); passo(p, DT);
  for (let k = 0; k < Math.round(seg * 60); k++) { entrada(p, i, { x, y: 0, d: true, n: n + 1 }); passo(p, DT); }
  entrada(p, i, { x, y: 0, d: false, n: n + 1 }); passo(p, DT);
}
const BOA = 0.78;   // força de uns 0,7: no ponto bom da barra
// lança e espera o lance acabar (bola, pinos e contagem)
function joga(p, i, seg = BOA, x = 0) { segura(p, i, seg, x); roda(p, 3.5); }
const jog = (p, i) => p.dados.jog[i];
// partida sem o balanço da seta, para o resultado dos lances ser sempre igual
function cena() { const p = partidaCom(jogo); p.dados.balanco = 0; return p; }

test('boliche: a barra de força sobe e desce enquanto o botão está apertado', () => {
  assert.equal(forcaEm(0), 0);
  assert.ok(forcaEm(0.5) > 0.4 && forcaEm(0.5) < 0.5);
  assert.ok(Math.abs(forcaEm(1 / 0.9) - 1) < 1e-9, 'topo da barra');
  assert.ok(forcaEm(1.5 / 0.9) < 0.6, 'desceu');
  const p = cena();
  entrada(p, 0, { d: true, n: 0 });
  roda(p, 0.5);
  assert.equal(jog(p, 0).fase, 'forca');
  assert.ok(Math.abs(jog(p, 0).forca - forcaEm(0.5)) < 0.05);
});

test('boliche: soltar o botão lança a bola e ela derruba pinos no meio da pista', () => {
  const p = cena();
  segura(p, 0, BOA);
  assert.equal(jog(p, 0).fase, 'rola');
  assert.ok(jog(p, 0).bola.vz < -8, 'a bola vai para os pinos');
  roda(p, 3.5);
  assert.ok(p.dados.placar[0] >= 5, 'bola no meio derruba vários: ' + p.dados.placar[0]);
  assert.equal(p.dados.placar[1], 0);
  assert.equal(jog(p, 0).lances, 1);
});

test('boliche: bola na canaleta não derruba nada', () => {
  const p = cena();
  segura(p, 0, BOA, 1);        // joystick todo para a direita
  assert.equal(jog(p, 0).bola.canal, false);
  roda(p, 3.5);
  assert.equal(p.dados.placar[0], 0);
  assert.equal(jog(p, 0).lances, 1);
  assert.equal(jog(p, 0).bola, null);
});

test('boliche: bola fraca não chega nos pinos', () => {
  const p = cena();
  joga(p, 1, 0.05);
  assert.equal(p.dados.placar[1], 0);
  assert.equal(jog(p, 1).lances, 1);
});

test('boliche: força demais desvia a bola da mira, e força no ponto bom não desvia', () => {
  const p = cena(), q = cena();
  segura(p, 0, 1 / 0.9);   // topo da barra
  segura(q, 0, BOA);
  const ang = b => Math.atan2(b.vx, -b.vz);
  assert.ok(jog(p, 0).forca > 0.99);
  assert.ok(Math.abs(ang(jog(p, 0).bola)) > 0.05, 'escapou: ' + ang(jog(p, 0).bola));
  assert.ok(Math.abs(ang(jog(q, 0).bola)) < 1e-9, 'reta');
});

test('boliche: a força decide: fraca não chega, média derruba alguns, no ponto bom derruba tudo ou quase', () => {
  const pinos = seg => { const p = cena(); joga(p, 0, seg); return p.dados.placar[0]; };
  assert.equal(pinos(0.2), 0);
  assert.ok(pinos(0.55) < pinos(0.9) || pinos(0.55) < 10);
  assert.ok(pinos(0.8) >= 8);
});


test('boliche: toque curto, que já chega solto, também lança (contador não se perde)', () => {
  const p = cena();
  toca(p, 1);
  assert.equal(jog(p, 1).fase, 'rola');
  assert.ok(Math.abs(jog(p, 1).forca - 0.3) < 1e-9);
  assert.equal(jog(p, 0).fase, 'mira', 'o outro jogador não é afetado');
  // contador que pula vários de uma vez ainda vale um único lance
  const q = cena();
  entrada(q, 0, { n: 0 }); entrada(q, 0, { n: 3 }); passo(q, DT);
  assert.equal(jog(q, 0).fase, 'rola');
  roda(q, 3.5);
  assert.equal(jog(q, 0).lances, 1);
});

test('boliche: toque rápido logo depois de um lance também é aproveitado', () => {
  const p = cena();
  joga(p, 0);
  assert.equal(jog(p, 0).fase, 'mira');
  toca(p, 0);
  assert.equal(jog(p, 0).fase, 'rola');
});

test('boliche: botão ainda apertado quando o lance acaba só conta depois de soltar', () => {
  const p = cena();
  segura(p, 0, 0.1);
  entrada(p, 0, { d: true });   // o dedo volta a apertar durante a rolagem, sem toque novo
  roda(p, 3.5);
  assert.equal(jog(p, 0).lances, 1);
  assert.equal(jog(p, 0).fase, 'mira', 'não começou a segurar sozinho');
});

test('boliche: pinos voltam em pé a cada lance e o placar soma os três', () => {
  const p = cena();
  let soma = 0;
  for (let k = 1; k <= 3; k++) {
    joga(p, 0, BOA, 0);
    soma = p.dados.placar[0];
    assert.equal(jog(p, 0).lances, k);
    if (k < 3) assert.equal(jog(p, 0).pinos.filter(x => x.caido).length, 0, 'pinos reerguidos');
  }
  assert.equal(jog(p, 0).fase, 'fim');
  assert.ok(soma > 10, 'mais de uma rodada de pinos somados: ' + soma);
  toca(p, 0);                       // depois dos 3 lances nada acontece
  roda(p, 1);
  assert.equal(jog(p, 0).lances, 3);
  assert.equal(p.dados.placar[0], soma);
});

test('boliche: vence o jogador 1 quando o outro só faz canaleta', () => {
  const p = cena();
  for (let k = 0; k < 3; k++) joga(p, 0);
  for (let k = 0; k < 3; k++) joga(p, 1, BOA, 1);
  assert.equal(p.vencedor, 0);
});

test('boliche: vence o jogador 2 quando faz mais pinos', () => {
  const p = cena();
  for (let k = 0; k < 3; k++) joga(p, 0, BOA, 1);
  for (let k = 0; k < 3; k++) joga(p, 1);
  assert.equal(p.vencedor, 1);
});

test('boliche: lances idênticos nas duas pistas empatam', () => {
  const p = cena();
  for (let k = 0; k < 3; k++) { joga(p, 0, BOA, 0); joga(p, 1, BOA, 0); }
  assert.equal(p.dados.placar[0], p.dados.placar[1]);
  assert.equal(p.vencedor, -1);
});

test('boliche: só um joga e o tempo acaba, o placar decide', () => {
  const p = cena();
  joga(p, 1);
  roda(p, 45);
  assert.equal(p.fase, 'jogando', 'ainda dentro do limite de 50 s');
  roda(p, 3);
  assert.equal(p.vencedor, 1);
});

test('boliche: ninguém joga, empata no limite de tempo', () => {
  const p = cena();
  roda(p, 49);
  assert.equal(p.fase, 'jogando');
  roda(p, 2);
  assert.equal(p.vencedor, -1);
});

test('boliche: roda inteiro, parado e com dedos aleatórios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});

test('boliche: a seta balança sozinha e o joystick desloca a mira', () => {
  const p = partidaCom(jogo);
  const angs = new Set();
  for (let k = 0; k < 120; k++) { passo(p, DT); angs.add(jog(p, 0).ang.toFixed(3)); }
  assert.ok(angs.size > 20, 'a seta oscila');
  const q = cena();
  entrada(q, 0, { x: 1 }); passo(q, DT);
  entrada(q, 1, { x: -1 }); passo(q, DT);
  assert.ok(jog(q, 0).ang > 0.15 && jog(q, 1).ang < -0.15);
});
