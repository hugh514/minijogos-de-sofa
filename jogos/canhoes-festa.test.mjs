import test from 'node:test';
import assert from 'node:assert/strict';
import { passo, entrada, MODIFICADORES } from '../logica.mjs';
import { partidaCom, roda, fumaca, rodada, aleatorio, sorteio, DT } from '../jogos/_teste.mjs';
import jogo, { LX, LZ, CAIXAS, TEMPO } from './canhoes-festa.mjs';

const vs = n => ({ n, modo: 'vs' });
const times = { n: 4, modo: 'times' };
const COMBOS = [vs(2), vs(3), vs(4), times];
const dePe = (p, i) => p.dados.caixas.filter(c => c.dono === i && !c.caiu);
// Uma bola do jogador "de" cai em cima de uma caixa do jogador "em".
function derruba(p, de, em) {
  const alvo = dePe(p, em).sort((a, b) => b.nivel - a.nivel)[0];
  p.dados.bolas.push({ x: alvo.x, y: alvo.y + 1, z: alvo.z, vx: 0, vy: -6, vz: 0, dono: de });
  for (let k = 0; k < 8; k++) passo(p, DT);
}
// Estilingue de verdade: põe o dedo, arrasta (ax, ay) e solta.
function atira(p, i, ax, ay) {
  entrada(p, i, { x: 0, y: 0, d: true }); passo(p, DT);
  entrada(p, i, { x: ax, y: ay, d: true }); passo(p, DT);
  entrada(p, i, { x: ax, y: ay, d: false }); passo(p, DT);
}

test('canhoes-festa: contrato da festa, tempo, rotulo, genero e controle de toque', () => {
  assert.deepEqual(jogo.festa, { min: 2, max: 4, modos: ['vs', 'times'] });
  assert.ok(jogo.duracao >= 20 && jogo.duracao <= 50);
  assert.equal(jogo.duracao, TEMPO);
  assert.equal(jogo.rotulo, 'caixas');
  assert.equal(jogo.genero, 'mira');
  assert.equal(jogo.controle.modo, 'toque');
  assert.ok(jogo.semMovimento && jogo.semDash && jogo.semPulo, 'ninguem anda: modificadores e cartas de andar nao entram');
  assert.match(jogo.dica, /^[A-ZÀ-Ý][^.!?]*[.!?]$/, 'uma frase');
});

test('canhoes-festa: comeca com 2, 3 e 4: cada um com o seu canhao e a sua pilha de caixas, sem misturar', () => {
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o), d = p.dados;
    assert.equal(d.bases.length, o.n);
    assert.equal(d.caixas.length, o.n * CAIXAS);
    assert.deepEqual(d.placar, o.modo === 'times' ? [CAIXAS * 2, CAIXAS * 2] : Array(o.n).fill(CAIXAS));
    for (let i = 0; i < o.n; i++) {
      const b = d.bases[i], minhas = dePe(p, i);
      assert.equal(minhas.length, CAIXAS);
      for (const c of minhas) assert.ok(Math.abs(c.x) < LX - 0.7 && Math.abs(c.z) < LZ - 0.7, 'caixa dentro da arena');
      assert.ok(Math.hypot(b.cx, b.cz) < Math.hypot(b.x, b.z), 'o canhao fica na frente das caixas, mais perto do centro');
      assert.ok(Math.abs(p.jogadores[i].x) < LX && Math.abs(p.jogadores[i].z) < LZ);
      for (const c of minhas) for (const r of d.caixas) if (r.dono !== i && r.nivel === c.nivel) assert.ok(Math.hypot(c.x - r.x, c.z - r.z) > 1.5, 'caixas de donos diferentes nao se encostam');
    }
    if (o.modo === 'times') assert.ok(d.bases[0].x < 0 && d.bases[2].x < 0 && d.bases[1].x > 0 && d.bases[3].x > 0, 'duplas de lados opostos');
  }
});

test('canhoes-festa: arrastar para tras e soltar atira para o lado oposto ao arrasto, e ha recarga', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  atira(p, 0, -0.5, 0);
  assert.equal(d.bolas.length, 1);
  assert.ok(d.bolas[0].vx > 3 && Math.abs(d.bolas[0].vz) < 0.01 && d.bolas[0].dono === 0, 'arrastou para a esquerda, a bola vai para a direita');
  atira(p, 0, 0, -0.5);
  assert.equal(d.bolas.filter(b => b.dono === 0).length, 1, 'recarregando: o segundo tiro espera');
  roda(p, 1);
  assert.equal(d.bolas.filter(b => b.dono === 0 && b.vz > 3).length, 1, 'o tiro guardado sai quando a recarga acaba');
});

test('canhoes-festa: toque curto sem arrastar nao atira', () => {
  const p = partidaCom(jogo, undefined, vs(2));
  atira(p, 0, 0.02, 0);
  assert.equal(p.dados.bolas.length, 0);
});

test('canhoes-festa: de qualquer canhao da para acertar as caixas de qualquer rival', () => {
  for (const o of COMBOS) for (let i = 0; i < o.n; i++) for (let k = 0; k < o.n; k++) {
    if (k === i || (o.modo === 'times' && k % 2 === i % 2)) continue;
    let acertou = false;
    for (let f = 0.1; f <= 1 && !acertou; f += 0.02) {
      const p = partidaCom(jogo, undefined, o), d = p.dados, b = d.bases[i], alvo = d.bases[k];
      const dx = alvo.x - b.cx, dz = alvo.z - b.cz, len = Math.hypot(dx, dz);
      atira(p, i, -dx / len * f, -dz / len * f);
      roda(p, 2.5);
      acertou = dePe(p, k).length < CAIXAS;
    }
    assert.ok(acertou, `${JSON.stringify(o)}: o canhao ${i} nao alcanca as caixas de ${k}`);
  }
});

test('canhoes-festa: bola de rival derruba a caixa, a de cima desce, o placar cai e o celular do dono vibra', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  const antes = p.celular[1].vibra ?? 0, baixo = dePe(p, 1).find(c => c.nivel === 0), cima = dePe(p, 1).find(c => c.nivel === 1 && c.col === baixo.col);
  d.bolas.push({ x: baixo.x, y: baixo.y, z: baixo.z, vx: 0, vy: 0, vz: 0, dono: 0 });
  roda(p, 1);
  assert.equal(baixo.caiu, true);
  assert.equal(cima.caiu, false);
  assert.equal(cima.nivel, 0, 'a de cima desceu');
  assert.ok(cima.y < 1, 'e ja esta no chao');
  assert.deepEqual(d.placar, [CAIXAS, CAIXAS - 1, CAIXAS]);
  assert.equal(p.celular[1].vibra ?? 0, antes + 1);
  assert.match(p.celular[1].texto, new RegExp(`^Caixas: ${CAIXAS - 1}\\.`));
});

test('canhoes-festa: a propria bola nao derruba as caixas do dono, e em times nao derruba as do parceiro', () => {
  let p = partidaCom(jogo, undefined, vs(2));
  derruba(p, 0, 0);
  assert.deepEqual(p.dados.placar, [CAIXAS, CAIXAS]);
  p = partidaCom(jogo, undefined, times);
  derruba(p, 0, 2);
  assert.deepEqual(p.dados.placar, [CAIXAS * 2, CAIXAS * 2], 'parceiro nao perde caixa');
  derruba(p, 0, 3);
  assert.deepEqual(p.dados.placar, [CAIXAS * 2, CAIXAS * 2 - 1]);
});

test('canhoes-festa: quem perde todas as caixas sai, nao atira mais, e o ultimo com caixas vence (vs)', () => {
  const p = partidaCom(jogo, undefined, vs(3)), d = p.dados;
  for (let k = 0; k < CAIXAS; k++) derruba(p, 1, 0);
  assert.equal(p.jogadores[0].vivo, false);
  assert.equal(p.fase, 'jogando', 'ainda ha dois com caixas');
  assert.match(p.celular[0].texto, /saiu/);
  d.bolas.length = 0;
  atira(p, 0, -0.5, 0); roda(p, 1);
  assert.equal(d.bolas.filter(b => b.dono === 0).length, 0, 'canhao de quem saiu fica mudo');
  for (let k = 0; k < CAIXAS; k++) derruba(p, 1, 2);
  assert.equal(p.fase, 'resultado');
  assert.equal(p.vencedor, 1);
  assert.match(p.dados.aviso, /venceu!$/);
  assert.equal(p.celular[1].texto, 'Você venceu!');
});

test('canhoes-festa: em times as caixas somam, a dupla so perde sem nenhuma, e o retorno e o time', () => {
  const p = partidaCom(jogo, undefined, times);
  for (let k = 0; k < CAIXAS; k++) derruba(p, 1, 0);
  assert.deepEqual(p.dados.placar, [CAIXAS, CAIXAS * 2]);
  assert.equal(p.fase, 'jogando');
  for (let k = 0; k < CAIXAS; k++) derruba(p, 3, 2);
  assert.equal(p.vencedor, 1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 1, 0, 1]);
});

test('canhoes-festa: no fim do tempo vence quem tem mais caixas (vs e times); caixas iguais empatam', () => {
  let p = partidaCom(jogo, undefined, vs(4));
  derruba(p, 0, 1); derruba(p, 0, 2); derruba(p, 1, 0); derruba(p, 0, 2);
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, 3, 'so o J4 ficou com todas');
  p = partidaCom(jogo, undefined, times);
  derruba(p, 1, 0);
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, 1);
  p = partidaCom(jogo, undefined, vs(3));
  roda(p, TEMPO + 1);
  assert.equal(p.vencedor, -1);
  assert.equal(p.dados.aviso, 'Empate!');
});

test('canhoes-festa: textos sem travessao, caixa alta crua, undefined ou NaN', () => {
  const todos = [jogo.nome, jogo.dica];
  for (const o of COMBOS) {
    const p = partidaCom(jogo, undefined, o);
    const junta = () => todos.push(p.dados.aviso ?? '', ...p.celular.map(c => c.texto ?? ''));
    passo(p, DT); junta(); derruba(p, 0, 1); junta();
    for (let k = 1; k < CAIXAS; k++) derruba(p, 0, 1);
    junta(); roda(p, TEMPO + 1); junta();
  }
  for (const t of todos) assert.doesNotMatch(t, /[–—]|[A-ZÀ-Ý]{3,}|[a-z][A-Z]|_|\bundefined\b|\bNaN\b/u, t);
});

test('canhoes-festa: fumaca (monta e desenha de verdade) com 2, 3 e 4 e em times', () => {
  for (const o of COMBOS) assert.equal(fumaca(jogo, o).length, 15);
});

test('canhoes-festa: so o ouro serve de modificador, e a rodada de ouro termina sem NaN', () => {
  const mods = MODIFICADORES.filter(m => !m.anda);       // "anda" pede o movimento do motor, que este minijogo desliga
  assert.deepEqual(mods.map(m => m.id), ['ouro']);
  for (const o of COMBOS) {
    const p = partidaCom(jogo, sorteio(7), o), rng = sorteio(3);
    p.mod = mods[0];
    for (let q = 0; q < 60 * 60 && p.fase === 'jogando'; q++) {
      aleatorio(p, q, rng); passo(p, DT);
      if (p.jogo !== jogo) break;
      for (const b of p.dados.bolas) assert.ok([b.x, b.y, b.z].every(Number.isFinite));
      for (const c of p.dados.caixas) assert.ok([c.x, c.y, c.z].every(Number.isFinite));
    }
    assert.notEqual(p.fase, 'jogando');
    assert.deepEqual(p.erros, []);
  }
});

test('canhoes-festa: dedos aleatorios terminam em ate 50 s', () => {
  for (const o of COMBOS) { const { segundos } = rodada(jogo, aleatorio, 5, o); assert.ok(segundos <= 50, 'durou ' + segundos); }
});
