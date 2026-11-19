// Regra do ESTILO.md: nenhuma rodada fecha antes de 5 s, nem por toque sem querer nem por jogada perfeita.
// A tela aplica comMinimo em todo minijogo; aqui se confere a trava, que a tela a aplica, e cada minijogo com ela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { passo, entrada, pulaPara, criaPartida, comMinimo, JOGOS } from '../logica.mjs';
import { rodada, aleatorio, partidaCom, ateFechar, DT } from './_teste.mjs';
import corMentirosa from './cor-mentirosa.mjs';
import corridaDedos from './corrida-dedos.mjs';

// Toque em todo quadro (o pior caso para jogos de mirar e soltar, como a bocha)
function frenetico(p, quadro, rng) { aleatorio(p, quadro * 12, rng); }

function modosDe(jogo) {
  if (!jogo.festa) return [{}];
  const r = [];
  for (const modo of jogo.festa.modos) for (let n = jogo.festa.min; n <= jogo.festa.max; n++) if (modo !== 'times' || n === 4) r.push({ n, modo });
  return r;
}

// Roda ate fechar, conferindo a cada quadro que nao fechou antes de 5 s (p.t zera quando a rodada fecha)
function jogaConferindo(p, joga) {
  for (let k = 0; k < 8 * 60 && p.fase === 'jogando'; k++) {
    joga(p, k);
    passo(p, DT);
    if ((k + 1) * DT < 4.95) assert.equal(p.fase, 'jogando', `fechou com ${((k + 1) * DT).toFixed(2)} s`);
  }
  ateFechar(p);
}

test('a tela aplica comMinimo nos embutidos e em cada minijogo que chega da pasta', () => {
  const tela = readFileSync(new URL('../tela.html', import.meta.url), 'utf8');
  const codigo = tela.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');      // linha comentada nao vale
  assert.match(codigo, /^\s*JOGOS\.forEach\(comMinimo\);/m);
  const chamadas = [...codigo.matchAll(/\bregistra\(/g)].map(r => codigo.slice(r.index, r.index + 'registra(comMinimo('.length));
  assert.ok(chamadas.length >= 2, 'a tela registra os minijogos da pasta e o __registra');
  for (const c of chamadas) assert.equal(c, 'registra(comMinimo(', 'toda chamada a registra na tela passa pela trava');
});

test('comMinimo: resultado valido antes de 5 s fica guardado e sai igual aos 5 s; aplicar duas vezes nao muda nada', () => {
  let chamadas = 0;
  const jogo = comMinimo(comMinimo({ id: 'cedo', nome: 'cedo', dica: 'cedo', inicia() {}, atualiza(q) { chamadas++; return q.t > 0.1 ? 1 : undefined; } }));
  const p = criaPartida(() => 0.3);
  pulaPara(p, jogo);
  while (p.fase !== 'jogando') passo(p, DT);
  jogaConferindo(p, () => {});
  assert.equal(p.vencedor, 1);
  assert.ok(chamadas < 20, 'depois de decidir o minijogo nao e mais atualizado');
});

for (const [nome, ruim] of [['inteiro invalido', () => 7], ['exception', () => { throw new Error('de proposito'); }]]) {
  test(`comMinimo: ${nome} encerra na hora, sem esperar os 5 s`, () => {
    const p = criaPartida(() => 0.3);
    pulaPara(p, comMinimo({ id: 'ruim', nome: 'ruim', dica: 'ruim', inicia() {}, atualiza: ruim }));
    while (p.fase !== 'jogando') passo(p, DT);
    passo(p, DT);
    assert.equal(p.fase, 'resultado');
    assert.ok(p.erros.length > 0);
  });
}

const ids = readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.mjs') && !f.endsWith('.test.mjs') && !f.startsWith('_')).map(f => f.slice(0, -4));
const embutidos = JOGOS.slice();      // os que moram no logica.mjs (sumo, labirinto...)
for (const id of [...ids, ...embutidos.map(j => j.id)]) {
  test(`${id}: com a trava da tela, nenhuma rodada acaba antes de 5 s`, async () => {
    const jogo = comMinimo(embutidos.find(j => j.id === id) ?? (await import(`./${id}.mjs`)).default);
    for (const op of modosDe(jogo)) {
      let menor = Infinity;
      for (let s = 1; s <= 30; s++) menor = Math.min(menor, rodada(jogo, aleatorio, s, op).segundos);
      for (let s = 1; s <= 10; s++) menor = Math.min(menor, rodada(jogo, frenetico, s, op).segundos);
      assert.ok(menor >= 5, `${id} ${JSON.stringify(op)}: rodada de ${menor.toFixed(2)} s`);
    }
  });
}

// Jogadores perfeitos: o rival fica parado e um acerta tudo o mais rapido possivel
test('cor-mentirosa: acertando cada desafio assim que aparece, a rodada so fecha aos 5 s', () => {
  const p = partidaCom(comMinimo(corMentirosa)), d = p.dados;
  let nop = 0;
  jogaConferindo(p, q => { if (!(d.pausa > 0) && !d.placar.some(v => v >= 5)) entrada(q, 0, { x: 0, y: 0, op: d.modoTinta ? d.tinta : d.palavra, nop: ++nop }); });
  assert.equal(p.vencedor, 0);
});

test('corrida-dedos: alternando DIR e ESQ a 15 toques por segundo, a rodada so fecha aos 5 s', () => {
  const p = partidaCom(comMinimo(corridaDedos));
  let n = 0, nb = 0;
  jogaConferindo(p, (q, k) => { if (k % 4 === 0) { if ((k / 4) % 2) nb++; else n++; entrada(q, 0, { x: 0, y: 0, n, nb, d: false, b: false }); } });
  assert.equal(p.vencedor, 0);
});
