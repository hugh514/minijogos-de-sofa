import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo, timeDe, RAIO } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, DT } from '../jogos/_teste.mjs';
import jogo from './queimada-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];

function poe(p, i, x, z) { Object.assign(p.jogadores[i], { x, z, vx: 0, vz: 0 }); }
// Partida sem bolas soltas e sem reposicao, para o teste controlar tudo.
function limpa(opcoes) {
  const p = partidaCom(jogo, undefined, opcoes);
  p.dados.bolas = []; p.dados.repoe = 999;
  for (let i = 0; i < opcoes.n; i++) entrada(p, i, { x: 0, y: 0, d: false, n: 0, nb: 0 });
  return p;
}
// Põe uma bola em voo do jogador de, a 1 m do jogador k, indo na direção dele, e roda um quadro.
function acerta(p, de, k) {
  const o = p.jogadores[k];
  p.dados.imune[k] = 0;
  p.dados.bolas.push({ x: o.x - 1, z: o.z, vx: 17, vz: 0, estado: 'voo', dono: de, quiques: 0 });
  passo(p, DT);
}
// Partida com uma única bola no pé do jogador 0, que já a pegou.
function comBola(opcoes, pos) {
  const p = limpa(opcoes);
  pos.forEach(([x, z], i) => poe(p, i, x, z));
  p.dados.bolas = [{ x: pos[0][0], z: pos[0][1], vx: 0, vz: 0, estado: 'chao', dono: -1, quiques: 0 }];
  passo(p, DT);
  assert.equal(p.dados.bolas[0].estado, 'mao');
  assert.equal(p.dados.bolas[0].dono, 0);
  return p;
}
const joga = (p, i, n) => entrada(p, i, { x: 0, y: 0, d: false, n });

test('queimada-festa: contrato, tempo de 20 a 50 s e rotulo', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.rotulo, 'vidas');
  assert.equal(jogo.genero, 'mira');
});

test('queimada-festa: textos sem travessao, sem caixa alta crua e sem nome de variavel', () => {
  const todos = [jogo.nome, jogo.dica];
  for (const o of COMBOS) {
    const p = limpa(o);
    passo(p, DT);
    todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    for (let i = 1; i < o.n; i++) p.dados.vidas[i] = 1;
    p.dados.vidas[0] = 3;
    for (let i = 1; i < o.n; i++) acerta(p, 0, i);
    todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.equal(jogo.dica.split(/[.!?]\s/).length, 1, 'dica em uma frase');
});

test('queimada-festa: a quadra e as posicoes escalam com n; com 2 e em times ha lados, com 3 e 4 a quadra e livre', () => {
  const lzs = [2, 3, 4].map(n => partidaCom(jogo, undefined, vs(n)).arena.lz);
  assert.ok(lzs[0] < lzs[1] && lzs[1] < lzs[2], 'quadra cresce: ' + lzs);
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), { lx, lz } = p.arena;
    assert.equal(p.jogadores.length, o.n);
    assert.deepEqual(p.dados.vidas, Array(o.n).fill(3));
    assert.deepEqual(p.dados.placar, o.modo === 'times' ? [6, 6] : Array(o.n).fill(3));
    for (const j of p.jogadores) assert.ok(Math.abs(j.x) < lx - RAIO && Math.abs(j.z) < lz - RAIO, 'dentro da quadra');
    for (let i = 0; i < o.n; i++) for (let k = i + 1; k < o.n; k++)
      assert.ok(Math.hypot(p.jogadores[i].x - p.jogadores[k].x, p.jogadores[i].z - p.jogadores[k].z) > 4, 'largam separados');
  }
  const t = partidaCom(jogo, undefined, times).jogadores;
  assert.ok(t[0].x < 0 && t[2].x < 0 && t[1].x > 0 && t[3].x > 0, 'em times, a dupla A fica de um lado e a B do outro');
  assert.ok(partidaCom(jogo, undefined, vs(4)).dados.bolas.length >= 4);
});

test('queimada-festa: pega a bola, arremessa parado no rival, que perde 1 vida e fica imune', () => {
  const p = comBola(vs(2), [[-6, 0], [6, 0]]);
  joga(p, 0, 1);
  roda(p, 0.6);
  assert.deepEqual(p.dados.placar, [3, 2]);
  assert.ok(p.dados.imune[1] > 0);
  assert.ok(p.jogadores[1].x > 6, 'foi empurrado para tras');
  assert.notEqual(p.dados.bolas[0].estado, 'voo', 'a bola que acertou deixa de valer');
  assert.match(p.celular[1].texto, /^Vidas: 2\./);
});

test('queimada-festa: parado, o arremesso vai no rival mais perto (vs com 4)', () => {
  const p = comBola(vs(4), [[-6, 0], [5, 0], [0, 6], [-6, -5]]);      // o 4o esta mais perto, para cima
  joga(p, 0, 1);
  roda(p, 0.8);
  assert.deepEqual(p.dados.vidas, [3, 3, 3, 2]);
});

test('queimada-festa: com joystick o arremesso vai na direcao do dedo', () => {
  const p = comBola(vs(3), [[-6, 0], [6, 0], [-6, 5]]);
  poe(p, 0, -6, 0);
  entrada(p, 0, { x: 0, y: 1, d: false, n: 1 });                       // para baixo na tela e z positivo: no jogador 3
  passo(p, DT);
  roda(p, 0.5);
  assert.equal(p.dados.vidas[2], 2);
  assert.equal(p.dados.vidas[1], 3);
});

test('queimada-festa: pular desvia e a bola quica no fundo e vira bola de chao', () => {
  const p = comBola(vs(2), [[-6, 0], [6, 0]]);
  joga(p, 0, 1);
  while (p.dados.bolas[0].x < 2) passo(p, DT);
  entrada(p, 1, { x: 0, y: 0, n: 0, nb: 1 });
  roda(p, 3);
  assert.deepEqual(p.dados.placar, [3, 3]);
  assert.equal(p.dados.bolas[0].estado, 'chao');
});

test('queimada-festa: bola que erra para no chao e nao tira vida', () => {
  const p = comBola(vs(3), [[-6, 0], [6, 0], [0, 6]]);
  p.jogadores[1].z = 5; p.jogadores[2].z = 6;
  entrada(p, 0, { x: 1, y: 0, d: false, n: 1 });                        // reto para a direita: nenhum rival na linha
  roda(p, 0.2);
  assert.deepEqual(p.dados.vidas, [3, 3, 3]);
});

test('queimada-festa: em times a bola atravessa o parceiro e acerta o rival', () => {
  const p = comBola(times, [[-6, 0], [6, 0], [-3, 0], [6, 5]]);
  joga(p, 0, 1);
  roda(p, 1);
  assert.equal(p.dados.vidas[2], 3, 'parceiro nao leva dano');
  assert.equal(p.dados.vidas[1], 2, 'o rival da linha leva');
  assert.deepEqual(p.dados.placar, [6, 5]);
});

test('queimada-festa: ninguem cruza a linha do meio com 2 e em times; com 3 ou 4 a quadra e livre', () => {
  for (const o of [vs(2), times]) {
    const p = limpa(o);
    for (let i = 0; i < o.n; i++) entrada(p, i, { x: timeDe(p, i) || o.n === 2 && i ? -1 : 1, y: 0 });
    roda(p, 3);
    p.jogadores.forEach((j, i) => {
      const lado = o.modo === 'times' ? timeDe(p, i) * 2 - 1 : i * 2 - 1;
      assert.ok(j.x * lado >= RAIO - 1e-9, `${JSON.stringify(o)} jogador ${i} cruzou: ${j.x}`);
    });
  }
  const p = limpa(vs(3));
  entrada(p, 0, { x: 1, y: 0 });
  roda(p, 3);
  assert.ok(p.jogadores[0].x > 0, 'a quadra livre deixa passar do meio');
});

test('queimada-festa: vs, cada jogador pode ser o ultimo de pe (n 2, 3 e 4)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = limpa(vs(n)), outros = [...Array(n).keys()].filter(i => i !== w);
    for (const o of outros) {
      assert.equal(p.fase, 'jogando', `n ${n}: ainda ha rival de pe`);
      for (let k = 0; k < 3; k++) acerta(p, w, o);
      assert.equal(p.jogadores[o].vivo, false, 'sem vidas, sai');
    }
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, w, `n ${n}`);
    assert.equal(p.jogadores[w].pontos, 1);
  }
});

test('queimada-festa: com 3 ou mais, quem sai espera, solta a bola e a rodada segue', () => {
  const p = limpa(vs(4));
  p.dados.bolas.push({ x: 4, z: 0, vx: 0, vz: 0, estado: 'mao', dono: 1, quiques: 0 });
  poe(p, 1, 4, 0);
  for (let k = 0; k < 3; k++) acerta(p, 0, 1);
  assert.equal(p.jogadores[1].vivo, false);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.dados.bolas[0].estado, 'chao', 'largou a bola');
  assert.match(p.celular[1].texto, /Você saiu/);
  assert.deepEqual(p.dados.placar, [3, 0, 3, 3]);
});

test('queimada-festa: times devolve o time e so acaba quando os dois do outro time estao fora', () => {
  for (const [ganha, perde] of [[0, [1, 3]], [1, [0, 2]]]) {
    const p = limpa(times);
    for (let k = 0; k < 3; k++) acerta(p, ganha, perde[0]);
    assert.equal(p.fase, 'jogando', 'o parceiro ainda segura a dupla');
    for (let k = 0; k < 3; k++) acerta(p, ganha, perde[1]);
    assert.equal(p.fase, 'resultado');
    assert.equal(p.vencedor, ganha, 'o time, nunca o indice');
    assert.deepEqual(p.jogadores.map(j => j.pontos), ganha === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
  }
});

test('queimada-festa: o empate por eliminacao simultanea da -1', () => {
  for (const o of [vs(2), times]) {
    const p = limpa(o);
    p.dados.vidas.fill(1);
    p.jogadores.forEach((o2, k) => { p.dados.imune[k] = 0; p.dados.bolas.push({ x: o2.x - 1, z: o2.z, vx: 17, vz: 0, estado: 'voo', dono: o.modo === 'times' ? (timeDe(p, k) ? 0 : 1) : 1 - k, quiques: 0 }); });
    passo(p, DT);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
    assert.equal(p.dados.aviso, 'Empate!');
  }
});

test('queimada-festa: no tempo vence quem tem mais vidas em vs (n 2, 3 e 4)', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = limpa(vs(n));
    p.dados.vidas.fill(2); p.dados.vidas[w] = 3;
    roda(p, 39); assert.equal(p.fase, 'jogando', 'antes do tempo segue');
    roda(p, 1.2);
    assert.equal(p.vencedor, w, `n ${n}`);
  }
});

test('queimada-festa: no tempo, a dupla com mais vidas somadas vence', () => {
  for (const time of [0, 1]) {
    const p = limpa(times);
    p.dados.vidas = p.jogadores.map((_, i) => (timeDe(p, i) === time ? 3 : 1));
    roda(p, 41);
    assert.equal(p.vencedor, time);
  }
});

test('queimada-festa: empate no tempo da -1 em todos os modos e com lideres empatados', () => {
  for (const o of COMBOS) {
    const p = limpa(o);
    roda(p, 41);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
  }
  const p = limpa(vs(3));
  p.dados.vidas = [3, 2, 3];
  roda(p, 41);
  assert.equal(p.vencedor, -1, 'dois lideres empatados e um atras');
});

test('queimada-festa: o resultado deixa aviso e celular finais prontos', () => {
  let p = limpa(vs(3));
  for (const o of [1, 2]) for (let k = 0; k < 3; k++) acerta(p, 0, o);
  assert.equal(p.dados.aviso, 'Jogador 1 venceu!');
  assert.equal(p.celular[0].texto, 'Você venceu!');
  assert.equal(p.celular[2].texto, 'Você perdeu. Boa tentativa!');
  p = limpa(times); p.dados.vidas = [3, 1, 3, 1]; roda(p, 41);
  assert.equal(p.dados.aviso, 'A dupla laranja venceu!');
  assert.equal(p.celular[1].texto, 'Você perdeu. Boa tentativa!');
});

test('queimada-festa: aparece bola no lado ou na quadra que ficou sem nenhuma, e nao passa do limite', () => {
  let p = partidaCom(jogo, undefined, vs(2));
  p.dados.bolas = []; p.dados.repoe = 0.1;
  roda(p, 0.2);
  assert.ok(p.dados.bolas.some(b => b.x < 0) && p.dados.bolas.some(b => b.x > 0));
  p = partidaCom(jogo, undefined, times);
  p.dados.bolas = []; p.dados.repoe = 0.1;
  roda(p, 0.2);
  assert.ok(p.dados.bolas.some(b => b.x < 0) && p.dados.bolas.some(b => b.x > 0));
  p = partidaCom(jogo, undefined, vs(3));
  p.dados.bolas = []; p.dados.repoe = 0.1;
  roda(p, 0.2);
  assert.equal(p.dados.bolas.length, 1);
  p.dados.bolas.forEach(b => { b.estado = 'mao'; b.dono = 0; });       // ninguem sobra no chao
  for (let k = 0; k < 40; k++) { p.dados.repoe = 0; passo(p, DT); p.dados.bolas.forEach(b => { b.estado = 'mao'; b.dono = 0; }); }
  assert.ok(p.dados.bolas.length <= 6);
});

test('queimada-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('queimada-festa: dedos aleatorios sempre terminam em ate 50 s, com 2, 3 e 4', () => {
  for (const o of COMBOS) for (const semente of [3, 4]) {
    const { segundos } = rodada(jogo, aleatorio, semente, o);
    assert.ok(segundos <= 50, `${JSON.stringify(o)} durou ${segundos}`);
  }
});
