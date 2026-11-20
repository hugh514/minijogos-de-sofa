// Funcoes puras do controle (curva do joystick e qual botao esta na posicao): o teste le o trecho @puras do controle.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./controle.html', import.meta.url), 'utf8');
const trecho = html.split('// @puras')[1].split('// @fim-puras')[0].replace(/^[^\n]*\n/, '');
const { forcaJoystick, botaoNaPos, ZONA_MORTA } = new Function(`${trecho}; return { forcaJoystick, botaoNaPos, ZONA_MORTA };`)();

test('joystick: zona morta fica em zero e o fim da corrida da 1', () => {
  assert.equal(forcaJoystick(0), 0);
  assert.equal(forcaJoystick(ZONA_MORTA - 0.01), 0);
  assert.equal(forcaJoystick(1), 1);
});

test('joystick: a 20% de deflexao a forca e menor que a linear, e a curva nunca desce', () => {
  const linear = len => (len - ZONA_MORTA) / (1 - ZONA_MORTA);
  assert.ok(forcaJoystick(0.2) > 0 && forcaJoystick(0.2) < linear(0.2));
  let antes = 0;
  for (let len = 0; len <= 1.0001; len += 0.01) { const f = forcaJoystick(len); assert.ok(f >= antes - 1e-12 && f <= 1); antes = f; }
});

test('joystick: a diagonal no maximo tambem chega a 1 (mesmo calculo do mover)', () => {
  const dx = Math.SQRT1_2, dy = Math.SQRT1_2, len = Math.hypot(dx, dy);
  const k = forcaJoystick(len) / len;
  assert.ok(Math.abs(Math.hypot(dx * k, dy * k) - 1) < 1e-9);
});

test('botaoNaPos: divide pela posicao e, sem B, a area toda vale A', () => {
  const ca = { x: 300, y: 100 }, cb = { x: 100, y: 100 };
  assert.equal(botaoNaPos(290, 100, ca, cb), 'A');
  assert.equal(botaoNaPos(110, 100, ca, cb), 'B');
  assert.equal(botaoNaPos(200.1, 300, ca, cb), 'A');      // entre os dois, fora do desenho
  assert.equal(botaoNaPos(199.9, 0, ca, cb), 'B');
  assert.equal(botaoNaPos(100, 100, ca, cb, true, false), 'A');
  assert.equal(botaoNaPos(300, 100, ca, cb, false, true), 'B');
  // empilhados (em pe): B em cima, A embaixo
  assert.equal(botaoNaPos(50, 700, { x: 50, y: 700 }, { x: 50, y: 500 }), 'A');
  assert.equal(botaoNaPos(50, 450, { x: 50, y: 700 }, { x: 50, y: 500 }), 'B');
});

test('botaoNaPos: nenhum botao visivel nao devolve botao (nada conta)', () => {
  const ca = { x: 300, y: 100 }, cb = { x: 100, y: 100 };
  assert.equal(botaoNaPos(290, 100, ca, cb, false, false), null);
  assert.equal(botaoNaPos(110, 100, ca, cb, false, false, 'A'), null);
});

test('botaoNaPos: histerese, o dedo so troca de botao 18% da distancia dos centros alem da divisa', () => {
  const ca = { x: 300, y: 100 }, cb = { x: 100, y: 100 };      // divisa em x = 200, distancia 200, 18% = 36 px
  assert.equal(botaoNaPos(190, 100, ca, cb, true, true, 'A'), 'A');     // passou da divisa, mas so 10 px
  assert.equal(botaoNaPos(170, 100, ca, cb, true, true, 'A'), 'A');     // 30 px alem
  assert.equal(botaoNaPos(160, 100, ca, cb, true, true, 'A'), 'B');     // 40 px alem: troca
  assert.equal(botaoNaPos(210, 100, ca, cb, true, true, 'B'), 'B');
  assert.equal(botaoNaPos(240, 100, ca, cb, true, true, 'B'), 'A');
  // dedo esfregando na divisa nunca alterna
  let q = 'A';
  for (const x of [205, 195, 202, 198, 190, 210, 200, 185, 215]) q = botaoNaPos(x, 100, ca, cb, true, true, q);
  assert.equal(q, 'A');
  // sem atual: o mais perto, como antes
  assert.equal(botaoNaPos(199, 100, ca, cb), 'B');
});

// ---------- catalogo da loja (cores e chapeus): o celular e a tela usam os mesmos indices ----------
const catalogo = (arquivo, nomes) => {
  const fonte = fs.readFileSync(new URL('./' + arquivo, import.meta.url), 'utf8');
  return [fonte, new Function('THREE', `${fonte.split('// @catalogo')[1].split('// @fim-catalogo')[0].replace(/^[^\n]*\n/, '')}; return { ${nomes.join(', ')} };`)()];
};
const [fonteFone, loja] = catalogo('controle.html', ['CORES', 'NOMES_CORES', 'CHAPEUS', 'noCatalogo']);
const [fonteTela, tv] = catalogo('tela.html', ['PALETA', 'N_CHAPEUS']);

test('catalogo: celular e tela tem o mesmo tamanho e a mesma cor em cada indice', () => {
  assert.equal(loja.CORES.length, tv.PALETA.length);
  assert.equal(loja.NOMES_CORES.length, loja.CORES.length);
  assert.equal(loja.CHAPEUS.length, tv.N_CHAPEUS);
  loja.CORES.forEach(([cor], i) => assert.equal(parseInt(cor.slice(1), 16), tv.PALETA[i], 'cor ' + i));
});

test('catalogo: so se acrescenta no fim (o perfil salvo guarda o indice)', () => {
  assert.deepEqual(loja.NOMES_CORES.slice(0, 14), ['Azul', 'Rosa', 'Verde', 'Amarelo', 'Roxo', 'Laranja', 'Ciano', 'Vermelho', 'Branco', 'Grafite', 'Dourado', 'Arco-íris', 'Galáxia', 'Neon']);
  assert.deepEqual(loja.CHAPEUS.slice(0, 13).map(c => c[0]), ['Nenhum', 'Cartola', 'Coroa', 'Orelhas', 'Chifres', 'Hélice', 'Cone', 'Antenas', 'Pirata', 'Chef', 'Auréola', 'Viking', 'Faixa ninja']);
  assert.equal(loja.CORES.length, 22, '14 cores antigas e 8 skins novas');
  assert.equal(loja.CHAPEUS.length, 23, 'nenhum, 12 antigos e 10 novos');
  assert.equal(new Set(loja.NOMES_CORES).size, loja.NOMES_CORES.length);
  assert.equal(new Set(loja.CHAPEUS.map(c => c[0])).size, loja.CHAPEUS.length);
});

test('catalogo: precos na faixa e toda skin especial tem amostra propria na loja', () => {
  loja.CHAPEUS.slice(1).forEach(([nome, preco]) => assert.ok(Number.isInteger(preco) && preco >= 20 && preco <= 80, nome));
  loja.CORES.slice(10).forEach(([, preco, amostra], k) => {
    assert.ok(Number.isInteger(preco) && preco >= 50 && preco <= 100, loja.NOMES_CORES[k + 10]);
    assert.ok(typeof amostra === 'string' && amostra.includes('gradient'), loja.NOMES_CORES[k + 10]);
  });
});

test('catalogo: todo chapeu tem desenho no celular e na tela', () => {
  const corpo = (fonte, nome) => fonte.split('function ' + nome + '(')[1].split('\nfunction ')[0];
  for (let i = 1; i < loja.CHAPEUS.length; i++) {
    assert.ok(corpo(fonteFone, 'chapeu2d').includes(`tipo === ${i})`), 'celular: ' + loja.CHAPEUS[i][0]);
    assert.ok(corpo(fonteTela, 'chapeu').includes(`tipo === ${i})`), 'tela: ' + loja.CHAPEUS[i][0]);
  }
});

test('noCatalogo: so indice inteiro que existe na lista passa (perfil salvo torto volta ao padrao)', () => {
  const { noCatalogo, CHAPEUS } = loja;
  assert.equal(noCatalogo(CHAPEUS, 0), true);
  assert.equal(noCatalogo(CHAPEUS, CHAPEUS.length - 1), true);
  for (const ruim of [CHAPEUS.length, -1, 1.5, '1', 'length', null, undefined, NaN, {}]) assert.equal(noCatalogo(CHAPEUS, ruim), false, String(ruim));
});
