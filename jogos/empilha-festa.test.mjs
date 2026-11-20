import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo, MODIFICADORES } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, contexto, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { TEMPO, L0, AMP, ESP } from './empilha-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];

// Partida com os blocos prontos para soltar (sem a espera do começo).
function nova(o) {
  const p = partidaCom(jogo, undefined, o);
  for (const e of p.dados.e) e.espera = 0;
  return p;
}
function toca(p, i) {
  if (p.jogadores[i].n === undefined) entrada(p, i, { x: 0, y: 0, n: 0 });
  entrada(p, i, { x: 0, y: 0, n: p.jogadores[i].n + 1 });
}
// Solta o bloco do jogador i com o centro dele em x (em relação ao centro da torre).
function soltaEm(p, i, x) {
  const e = p.dados.e[i];
  e.espera = 0; e.bx = x; e.v = 0;
  toca(p, i); passo(p, DT);
}
// k andares perfeitos para o jogador i.
function sobe(p, i, k) { for (let q = 0; q < k; q++) soltaEm(p, i, p.dados.e[i].blocos.at(-1).x); }
function ateOFim(p) { for (let k = 0; k < 60 * 60 && p.fase === 'jogando'; k++) passo(p, DT); }

test('empilha-festa: contrato da festa, 30 s, um botão só e nada que o motor mova', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.equal(TEMPO, 30);
  assert.equal(jogo.duracao, TEMPO);
  assert.equal(jogo.genero, 'equilibrio');
  assert.equal(jogo.rotulo, 'andares');
  assert.equal(jogo.controle.modo, 'botao');
  assert.ok(jogo.semMovimento && jogo.semDash && jogo.semPulo);
});

test('empilha-festa: começa com uma torre por jogador, lado a lado, sem uma invadir a outra', () => {
  assert.ok(2 * AMP + L0 <= ESP + 1e-9, 'o bloco que balança não entra na torre do vizinho');
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(d.e.length, o.n);
    assert.deepEqual(d.andares, Array(o.n).fill(0));
    assert.deepEqual(d.placar, o.modo === 'times' ? [0, 0] : Array(o.n).fill(0));
    const xs = p.jogadores.map(j => j.x);
    for (let i = 1; i < o.n; i++) assert.ok(Math.abs(xs[i] - xs[i - 1] - ESP) < 1e-9, 'torres: ' + xs);
    assert.ok(Math.abs(xs[0] + xs[o.n - 1]) < 1e-9, 'centradas');
    for (const e of d.e) assert.deepEqual(e.blocos, [{ x: 0, l: L0 }]);
    assert.match(p.celular[0].texto, /Andares: 0/);
  }
});

test('empilha-festa: o bloco balança de um lado ao outro sem passar da ponta', () => {
  const p = nova(vs(3)), e = p.dados.e[1];
  let menor = Infinity, maior = -Infinity;
  for (let k = 0; k < 60 * 6; k++) { passo(p, DT); menor = Math.min(menor, e.bx); maior = Math.max(maior, e.bx); }
  assert.ok(Math.abs(menor + AMP) < 1e-9 && Math.abs(maior - AMP) < 1e-9, `${menor} a ${maior}`);
});

test('empilha-festa: soltar no centro encaixa sem cortar e sobe um andar só para quem soltou', () => {
  const p = nova(vs(4));
  soltaEm(p, 2, 0.03);
  assert.deepEqual(p.dados.andares, [0, 0, 1, 0]);
  assert.deepEqual(p.dados.placar, [0, 0, 1, 0]);
  assert.deepEqual(p.dados.e[2].blocos[1], { x: 0, l: L0 });
  assert.equal(p.dados.cortes.length, 0);
  assert.match(p.celular[2].texto, /Perfeito! Andares: 1/);
});

test('empilha-festa: o que passa da borda cai e o bloco seguinte fica menor', () => {
  const p = nova(vs(2)), e = p.dados.e[0];
  soltaEm(p, 0, 0.6);
  const b = e.blocos[1];
  assert.ok(Math.abs(b.l - (L0 - 0.6)) < 1e-9, 'largura ' + b.l);
  assert.ok(Math.abs(b.x - 0.3) < 1e-9, 'centro ' + b.x);
  assert.equal(e.l, b.l, 'o próximo bloco já vem menor');
  assert.equal(p.dados.cortes.length, 1);
  assert.ok(Math.abs(p.dados.cortes[0].l - 0.6) < 1e-9);
  soltaEm(p, 0, -0.2);                                         // agora para o outro lado, em cima do bloco menor
  assert.ok(e.blocos[2].l < b.l);
  assert.equal(p.dados.andares[0], 2);
  roda(p, 2.5);
  assert.equal(p.dados.cortes.length, 0, 'os pedaços somem depois de cair');
});

test('empilha-festa: errar o bloco inteiro não sobe, custa um tempinho e vibra o celular', () => {
  const p = nova(vs(3)), e = p.dados.e[1];
  soltaEm(p, 1, AMP);
  assert.equal(p.dados.andares[1], 0);
  assert.equal(e.blocos.length, 1);
  assert.equal(e.l, L0, 'o bloco não encolhe');
  assert.ok(e.espera > 0.5);
  assert.equal(p.celular[1].vibra, 1);
  assert.equal(p.celular[0].vibra, undefined);
  assert.match(p.celular[1].texto, /Errou o bloco! Andares: 0/);
  toca(p, 1); passo(p, DT);
  assert.equal(e.blocos.length, 1, 'toque durante a espera não vale');
});

test('empilha-festa: a cada andar o bloco balança mais rápido, até um teto', () => {
  const p = nova(vs(2)), e = p.dados.e[0], v0 = e.v;
  sobe(p, 0, 1); assert.ok(e.v > v0);
  sobe(p, 0, 60);
  assert.ok(e.v <= 6, 'teto ' + e.v);
  assert.equal(p.dados.andares[0], 61);
});

test('empilha-festa: no fim do tempo vence a torre mais alta (vs), e quem perdeu sai voando', () => {
  for (const n of [2, 3, 4]) for (let w = 0; w < n; w++) {
    const p = nova(vs(n));
    for (let i = 0; i < n; i++) sobe(p, i, i === w ? 4 : 2);
    roda(p, TEMPO - 2); assert.equal(p.fase, 'jogando', 'só o tempo decide');
    ateOFim(p);
    assert.equal(p.vencedor, w, `n ${n}`);
    assert.equal(p.jogadores[w].pontos, 1);
    assert.equal(p.dados.aviso, `Jogador ${w + 1} venceu!`);
    assert.equal(p.celular[w].texto, 'Você venceu!');
    assert.deepEqual(p.jogadores.map(j => j.vivo), p.jogadores.map((_, i) => i === w));
  }
});

test('empilha-festa: em times vale a soma das duas torres e o retorno é o time', () => {
  for (const time of [0, 1]) {
    const p = nova(times);
    sobe(p, time, 1); sobe(p, time + 2, 5);                    // 6 no time
    sobe(p, 1 - time, 3); sobe(p, 3 - time, 2);                // 5 no outro
    assert.deepEqual(p.dados.placar, time === 0 ? [6, 5] : [5, 6]);
    assert.deepEqual(p.dados.inventario.map(l => l[0]), p.dados.andares.map(a => 'Andares ' + a));
    ateOFim(p);
    assert.equal(p.vencedor, time);
    assert.deepEqual(p.jogadores.map(j => j.pontos), time === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1]);
    assert.equal(p.dados.aviso, time === 0 ? 'Time laranja venceu!' : 'Time roxo venceu!');
    assert.equal(p.celular[1 - time].texto, 'O outro time venceu');
  }
  const p = nova(times);
  sobe(p, 1, 7); sobe(p, 0, 4); sobe(p, 2, 4);                 // a torre mais alta é do time B, mas a soma é do A
  ateOFim(p);
  assert.equal(p.vencedor, 0);
});

test('empilha-festa: torres iguais no topo dão empate e ninguém voa', () => {
  for (const o of COMBOS) {
    const p = nova(o);
    ateOFim(p);
    assert.equal(p.vencedor, -1, JSON.stringify(o));
    assert.equal(p.dados.aviso, 'Empate!');
    assert.ok(p.jogadores.every(j => j.vivo));
  }
  const p = nova(vs(3));
  sobe(p, 0, 3); sobe(p, 2, 3); sobe(p, 1, 1);
  ateOFim(p);
  assert.equal(p.vencedor, -1, 'dois empatados na frente');
});

test('empilha-festa: a câmera acompanha a torre mais alta e afasta com mais gente', () => {
  const p = nova(vs(4)), a = jogo.camera(p);
  sobe(p, 3, 10);
  const b = jogo.camera(p);
  assert.ok(b.y > a.y && b.oy > a.oy);
  assert.ok(jogo.camera(nova(vs(2))).z < a.z);
  for (const v of Object.values(b)) assert.ok(Number.isFinite(v));
  assert.equal(jogo.camera({}), null);
});

test('empilha-festa: textos sem travessão, sem caixa alta crua e dica em uma frase', () => {
  const todos = [jogo.nome, jogo.dica, jogo.controle.a];
  for (const o of COMBOS) {
    const p = nova(o);
    const junta = () => todos.push(p.dados.aviso, ...p.celular.map(c => c.texto ?? ''));
    junta(); soltaEm(p, 0, 0); junta(); soltaEm(p, 1, AMP); junta(); soltaEm(p, 0, 0.5); junta();
    ateOFim(p); junta();
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('empilha-festa: dedos aleatórios até o fim, sem NaN, no tempo e com vencedor válido', () => {
  for (const o of COMBOS) for (const semente of [3, 4, 5, 6]) {
    const { p, segundos } = rodada(jogo, aleatorio, semente, o), d = p.dados;
    assert.ok(Math.abs(segundos - TEMPO) < 0.1, `${JSON.stringify(o)} durou ${segundos}`);
    for (const e of d.e) for (const b of e.blocos) assert.ok(Number.isFinite(b.x) && b.l > 0 && b.l <= L0, JSON.stringify(b));
    assert.ok(d.placar.every(Number.isInteger));
    assert.ok((o.modo === 'times' ? [-1, 0, 1] : [-1, ...Array(o.n).keys()]).includes(p.vencedor));
  }
});

test('empilha-festa: nenhum modificador de movimento serve (o motor não move ninguém) e a rodada de ouro roda inteira', () => {
  for (const m of MODIFICADORES.filter(x => x.anda)) assert.ok(jogo.semMovimento && jogo.controle.modo !== 'padrao', m.id);
  for (const m of MODIFICADORES) for (const o of COMBOS) {
    const p = partidaCom(jogo, sorteio(11), o), rng = sorteio(12), c = contexto(p);
    p.mod = m;
    jogo.monta(c);
    for (let q = 0; q < 40 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      if (p.fase === 'jogando') jogo.desenha(c, DT, q * DT);
    }
    assert.notEqual(p.fase, 'jogando', m.id);
    assert.deepEqual(p.erros, []);
    for (const j of p.jogadores) for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(Number.isFinite(j[k]), m.id + ' ' + k);
  }
});

test('empilha-festa: fumaça (monta e desenha de verdade) com 2, 3 e 4 jogadores e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});
