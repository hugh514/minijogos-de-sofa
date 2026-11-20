import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada, MODIFICADORES, RAIO } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { BLOCOS, LX, LZ, VIDAS, TEMPO } from './tanques-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const poe = (p, i, x, z) => Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 });
const bala = (x, z, vx, vz, de) => ({ x, z, vx, vz, dono: de, quica: 1, idade: 0, vivo: true });
// Um tiro do jogador "de" nasce colado no tanque "em" e acerta em seguida.
function acerta(p, de, em) {
  const j = p.jogadores[em], lado = j.x > 0 ? 1 : -1;
  p.dados.imune[em] = 0;
  p.dados.tiros.push(bala(j.x - lado * 1.6, j.z, lado * 13, 0, de));
  for (let k = 0; k < 6; k++) passo(p, DT);
}
const noBloco = (x, z, r) => BLOCOS.some(b => Math.abs(x - b.x) < b.hx + r && Math.abs(z - b.z) < b.hz + r);

test('tanques-festa: contrato da festa, tempo, rotulo, genero e controle sem o movimento do motor', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.duracao, TEMPO);
  assert.equal(jogo.rotulo, 'vidas');
  assert.equal(jogo.genero, 'mira');
  assert.ok(jogo.semMovimento && jogo.semDash && jogo.semPulo, 'o tanque anda pela regra do minijogo: gelo, foguete, espelho, lua e as cartas de andar nao entram');
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('tanques-festa: comeca com 2, 3 e 4, 3 vidas cada, longe um do outro, fora dos blocos e virado para o centro', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados, js = p.jogadores;
    assert.deepEqual(d.vidas, Array(o.n).fill(VIDAS));
    assert.deepEqual(d.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    js.forEach((j, a) => {
      assert.ok(Math.abs(j.x) <= LX - RAIO && Math.abs(j.z) <= LZ - RAIO);
      assert.ok(!noBloco(j.x, j.z, RAIO), 'nasce fora dos blocos');
      assert.ok(Math.cos(d.ang[a]) * -j.x + Math.sin(d.ang[a]) * -j.z > 0, 'cano virado para o centro');
      for (let b = a + 1; b < o.n; b++) assert.ok(Math.hypot(j.x - js[b].x, j.z - js[b].z) > 8, 'longe um do outro');
    });
    if (o.modo === 'times') assert.ok(js[0].x < 0 && js[2].x < 0 && js[1].x > 0 && js[3].x > 0, 'duplas de lados opostos');
  }
});

test('tanques-festa: o joystick anda e gira o tanque, Atirar solta um tiro para onde o cano aponta e ha recarga', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  poe(p, 0, -8, 5.5);
  entrada(p, 0, { x: 1, y: 0, d: false, n: 0 });
  roda(p, 0.5);
  assert.ok(p.jogadores[0].x > -7, 'andou para a direita');
  assert.ok(Math.abs(d.ang[0]) < 0.05, 'cano para a direita');
  entrada(p, 0, { x: 0, y: 0, d: true, n: 1 });
  passo(p, DT);
  assert.equal(d.tiros.length, 1);
  assert.ok(d.tiros[0].vx > 10 && Math.abs(d.tiros[0].vz) < 1 && d.tiros[0].dono === 0);
  entrada(p, 0, { x: 0, y: 0, d: true, n: 2 });
  passo(p, DT); passo(p, DT);
  assert.equal(d.tiros.length, 1, 'recarregando');
  roda(p, 1);
  assert.ok(d.tiros.filter(t => t.dono === 0).length <= 2, 'o toque guardado solta no maximo mais um');
});

test('tanques-festa: o tiro quica uma vez na parede e some na segunda batida', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados;
  d.tiros.push(bala(0, LZ - 1, 0, 13, 0));
  roda(p, 0.2);
  assert.equal(d.tiros.length, 1);
  assert.ok(d.tiros[0].vz < 0 && d.tiros[0].quica === 0, 'quicou e voltou');
  d.tiros[0].x = 3;                      // longe do bloco do centro, direto para a parede de cima
  roda(p, 1.5);
  assert.equal(d.tiros.length, 0, 'sumiu na segunda parede');
});

test('tanques-festa: o tiro quica no bloco e o tanque nao atravessa bloco', () => {
  const p = partidaCom(jogo, undefined, vs(2)), d = p.dados, b = BLOCOS[0];
  d.tiros.push(bala(b.x - b.hx - 1.5, b.z, 13, 0, 0));
  roda(p, 0.2);
  assert.ok(d.tiros[0].vx < 0, 'voltou do bloco');
  d.tiros.length = 0;
  poe(p, 0, b.x - b.hx - 1.2, b.z);
  entrada(p, 0, { x: 1, y: 0, d: false, n: 0 });
  roda(p, 1);
  assert.ok(p.jogadores[0].x <= b.x - b.hx - RAIO + 0.01, 'parou no bloco');
});

test('tanques-festa: tiro de rival tira 1 vida, empurra, protege por um instante e vibra o celular', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  const antes = p.celular[1].vibra ?? 0;
  acerta(p, 0, 1);
  assert.deepEqual(d.vidas, [3, 2, 3]);
  assert.deepEqual(d.placar, [3, 2, 3]);
  assert.equal(p.celular[1].vibra ?? 0, antes + 1);
  assert.ok(d.imune[1] > 0);
  const j = p.jogadores[1];
  d.tiros.push(bala(j.x - 1.6, j.z, 13, 0, 0));
  for (let k = 0; k < 6; k++) passo(p, DT);
  assert.equal(d.vidas[1], 2, 'protegido logo depois de levar');
  assert.match(p.celular[1].texto, /^Vidas: 2\./);
});

test('tanques-festa: o proprio tiro nao fere o dono e em times nao ha fogo amigo', () => {
  let p = partidaCom(jogo, undefined, vs(2));
  acerta(p, 0, 0);
  assert.deepEqual(p.dados.vidas, [3, 3]);
  p = partidaCom(jogo, undefined, times);
  acerta(p, 0, 2);
  assert.deepEqual(p.dados.vidas, [3, 3, 3, 3], 'parceiro nao leva');
  assert.ok(p.dados.tiros.some(t => t.dono === 0), 'o tiro passa pelo parceiro e segue');
  p.dados.tiros.length = 0;
  acerta(p, 0, 3);
  assert.deepEqual(p.dados.vidas, [3, 3, 3, 2]);
  assert.deepEqual(p.dados.placar, [6, 5]);
});

test('tanques-festa: sem vidas o tanque sai e o ultimo vence (vs devolve o indice)', () => {
  const p = partidaCom(jogo, undefined, vs(3));
  for (let k = 0; k < 3; k++) acerta(p, 1, 0);
  assert.equal(p.jogadores[0].vivo, false);
  assert.equal(p.fase, 'jogando');
  assert.match(p.celular[0].texto, /saiu/);
  for (let k = 0; k < 3; k++) acerta(p, 1, 2);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1);
  assert.match(p.dados.aviso, /venceu!$/);
  assert.equal(p.celular[1].texto, 'Você venceu!');
});

test('tanques-festa: tanque destruido nao atira mais', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  for (let k = 0; k < 3; k++) acerta(p, 1, 0);
  d.tiros.length = 0;
  entrada(p, 0, { x: 0, y: 0, d: true, n: 5 });
  roda(p, 0.3);
  assert.equal(d.tiros.length, 0);
});

test('tanques-festa: em times a dupla so perde quando os dois saem, e o retorno e o time', () => {
  const p = partidaCom(jogo, undefined, times);
  for (let k = 0; k < 3; k++) acerta(p, 1, 0);
  assert.equal(p.fase, 'jogando');
  for (let k = 0; k < 3; k++) acerta(p, 3, 2);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('tanques-festa: no fim do tempo vence quem tem mais vidas (vs e times); vidas iguais empatam', () => {
  let p = partidaCom(jogo, undefined, vs(4));
  acerta(p, 0, 1); acerta(p, 0, 2); acerta(p, 1, 0); acerta(p, 0, 2);
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, 3, 'so o J4 ficou com 3');
  p = partidaCom(jogo, undefined, times);
  acerta(p, 1, 0);
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, 1);
  p = partidaCom(jogo, undefined, vs(3));
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
});

test('tanques-festa: textos sem travessao, caixa alta crua, undefined ou NaN', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    const junta = () => todos.push(p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta(); acerta(p, 0, 1); junta();
    for (let k = 0; k < 2; k++) acerta(p, 0, 1);
    junta(); roda(p, TEMPO + 1); junta();
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('tanques-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('tanques-festa: so o ouro serve de modificador, e a rodada de ouro termina sem NaN', () => {
  const j = jogo, mods = MODIFICADORES.filter(m => !m.anda);       // "anda" pede o movimento do motor, que este minijogo desliga
  assert.deepEqual(mods.map(m => m.id), ['ouro']);
  for (const o of COMBOS) {
    const p = partidaCom(j, sorteio(7), o), rng = sorteio(3);
    p.mod = mods[0];
    for (let q = 0; q < 60 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      for (const t of p.jogo === j ? p.dados.tiros : []) assert.ok([t.x, t.z, t.vx, t.vz].every(Number.isFinite));
      for (const k of p.jogadores) assert.ok([k.x, k.z].every(Number.isFinite));
    }
    assert.notEqual(p.fase, 'jogando');
    assert.deepEqual(p.erros, []);
  }
});

test('tanques-festa: dedos aleatorios terminam em ate 50 s', () => {
  for (const o of COMBOS) { const { segundos } = rodada(jogo, aleatorio, 5, o); assert.ok(segundos <= 50, 'durou ' + segundos); }
});
