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
const [fonteFone, loja] = catalogo('controle.html', ['CORES', 'NOMES_CORES', 'CHAPEUS', 'PETS', 'RASTROS', 'noCatalogo', 'corpoPerfil']);
const [fonteTela, tv] = catalogo('tela.html', ['PALETA', 'N_CHAPEUS', 'N_PETS', 'RASTROS']);

test('catalogo: celular e tela tem o mesmo tamanho e a mesma cor em cada indice', () => {
  assert.equal(loja.CORES.length, tv.PALETA.length);
  assert.equal(loja.NOMES_CORES.length, loja.CORES.length);
  assert.equal(loja.CHAPEUS.length, tv.N_CHAPEUS);
  loja.CORES.forEach(([cor], i) => assert.equal(parseInt(cor.slice(1), 16), tv.PALETA[i], 'cor ' + i));
});

test('catalogo: so se acrescenta no fim (o perfil salvo guarda o indice)', () => {
  assert.deepEqual(loja.NOMES_CORES.slice(0, 14), ['Azul', 'Rosa', 'Verde', 'Amarelo', 'Roxo', 'Laranja', 'Ciano', 'Vermelho', 'Branco', 'Grafite', 'Dourado', 'Arco-íris', 'Galáxia', 'Neon']);
  assert.deepEqual(loja.CHAPEUS.slice(0, 13).map(c => c[0]), ['Nenhum', 'Cartola', 'Coroa', 'Orelhas', 'Chifres', 'Hélice', 'Cone', 'Antenas', 'Pirata', 'Chef', 'Auréola', 'Viking', 'Faixa ninja']);
  assert.deepEqual(loja.NOMES_CORES.slice(14, 22), ['Lava', 'Gelo', 'Cromado', 'Zebra', 'Bolinhas', 'Camuflado', 'Fantasma', 'Melancia']);
  assert.deepEqual(loja.CHAPEUS.slice(13).map(c => c[0]), ['Boné', 'Bruxo', 'Cowboy', 'Flor', 'Gorro', 'Fone', 'Laço', 'Cogumelo', 'Festa', 'Louros']);
  assert.equal(loja.CORES.length, 28, '14 cores antigas, 8 skins e 6 cores chapadas');
  assert.equal(loja.CHAPEUS.length, 23, 'nenhum, 12 antigos e 10 novos');
  assert.equal(new Set(loja.NOMES_CORES).size, loja.NOMES_CORES.length);
  assert.equal(new Set(loja.CHAPEUS.map(c => c[0])).size, loja.CHAPEUS.length);
});

test('catalogo: precos na faixa e toda skin especial tem amostra propria na loja', () => {
  loja.CHAPEUS.slice(1).forEach(([nome, preco]) => assert.ok(Number.isInteger(preco) && preco >= 20 && preco <= 80, nome));
  loja.CORES.slice(22).forEach(([, preco, amostra], k) => {       // cores chapadas baratas: sem amostra propria
    assert.ok(Number.isInteger(preco) && preco >= 15 && preco <= 30, loja.NOMES_CORES[k + 22]);
    assert.equal(amostra, undefined, loja.NOMES_CORES[k + 22]);
  });
  loja.CORES.slice(10, 22).forEach(([, preco, amostra], k) => {
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

// ---------- pets, rastros e reacoes: categorias novas da loja ----------
test('pets e rastros: celular e tela tem o mesmo tamanho, 0 e "Nenhum" de graca e os precos ficam na faixa', () => {
  assert.equal(loja.PETS.length, tv.N_PETS);
  assert.equal(loja.RASTROS.length, tv.RASTROS.length);
  assert.equal(loja.PETS.length, 9, 'nenhum e 8 pets');
  assert.equal(loja.RASTROS.length, 6, 'nenhum e 5 rastros');
  for (const lista of [loja.PETS, loja.RASTROS]) {
    assert.deepEqual(lista[0], ['Nenhum', 0]);
    assert.equal(new Set(lista.map(c => c[0])).size, lista.length);
  }
  loja.PETS.slice(1).forEach(([nome, preco]) => assert.ok(Number.isInteger(preco) && preco >= 80 && preco <= 250, nome));
  loja.RASTROS.slice(1).forEach(([nome, preco]) => assert.ok(Number.isInteger(preco) && preco >= 40 && preco <= 120, nome));
  assert.equal(tv.RASTROS[0], null, 'rastro 0 na tela: nenhum');
});

test('pets e rastros: todo item tem desenho no celular e na tela', () => {
  const corpo = (fonte, nome) => fonte.split('function ' + nome + '(')[1].split('\nfunction ')[0];
  for (let i = 1; i < loja.PETS.length; i++) {
    assert.ok(corpo(fonteFone, 'pet2d').includes(`tipo === ${i})`), 'celular: ' + loja.PETS[i][0]);
    assert.ok(corpo(fonteTela, 'pet').includes(`tipo === ${i})`), 'tela: ' + loja.PETS[i][0]);
  }
  for (let i = 1; i < loja.RASTROS.length; i++) {
    assert.equal(loja.RASTROS[i][2], tv.RASTROS[i][0], 'mesma forma no celular e na tela: ' + loja.RASTROS[i][0]);
    assert.ok(corpo(fonteFone, 'forma2d').includes(`'${tv.RASTROS[i][0]}')`), 'celular: ' + loja.RASTROS[i][0]);
    assert.ok(fonteTela.includes(`  ${tv.RASTROS[i][0]}: textura(`), 'tela: textura do rastro ' + loja.RASTROS[i][0]);
    assert.ok(tv.RASTROS[i][1].length > 0 && tv.RASTROS[i][1].every(Number.isInteger), 'cores do rastro ' + loja.RASTROS[i][0]);
  }
});

test('corpoPerfil: leva pet e rastro e cabe com folga no limite de 500 bytes do /perfil', () => {
  const pior = { nome: '\u{1F600}'.repeat(5), cor: loja.CORES.length - 1, chapeu: loja.CHAPEUS.length - 1, pet: loja.PETS.length - 1, rastro: loja.RASTROS.length - 1, moedas: 99999, cores: [1, 2, 3] };
  const corpo = loja.corpoPerfil(4, pior);
  assert.deepEqual(JSON.parse(corpo), { j: 4, nome: pior.nome, cor: 27, chapeu: 22, pet: 8, rastro: 5 }, 'so o que a tela usa viaja (nada de moedas nem listas)');
  assert.ok(Buffer.byteLength(corpo) < 250, Buffer.byteLength(corpo) + ' bytes');
});

test('reacoes: celular e tela tem a mesma lista na mesma ordem, e todo pacote aponta para emoji que existe', () => {
  const lista = (fonte, nome) => new Function(`return ${fonte.split(`const ${nome} = `)[1].split('];')[0]}]`)();
  const fone = lista(fonteFone, 'REACOES'), tela = lista(fonteTela, 'REACOES'), pacotes = lista(fonteFone, 'PACOTES');
  const sons = fonteTela.split('const SOM_REA = [')[1].split(/\r?\n\];/)[0].split('\n').filter(l => l.trim().startsWith('{')).length;
  assert.deepEqual(fone.map(r => r[0]), tela);
  assert.equal(sons, tela.length, 'um som por reacao');
  assert.ok(tela.length <= 64, 'o servidor so repassa indice de 0 a 63');
  assert.equal(new Set(tela).size, tela.length);
  assert.deepEqual(pacotes.slice(0, 3).map(p => p[0]), ['Provocação', 'Festa', 'Bichos'], 'so se acrescenta no fim');
  assert.equal(pacotes.length, 5);
  const usados = [0, 1, 2, 3, 4, 5, ...pacotes.flatMap(p => p[2])];
  assert.deepEqual(usados, [...tela.keys()], 'cada emoji esta em um pacote so (ou e de graca)');
});

// ---------- itens de rodada (spec 009): catalogo e estoque no celular ----------
import { ITENS as ITENS_MOTOR } from './logica.mjs';
const itensFone = catalogo('controle.html', ['ITENS', 'ESTOQUE_MAX', 'estoqueLimpo', 'compraItem', 'gastaItem'])[1];

test('itens: celular e motor tem os mesmos itens na mesma ordem (so o indice viaja pela rede), com preco na faixa', () => {
  assert.deepEqual(itensFone.ITENS.map(k => k[0]), ITENS_MOTOR.map(k => k.id));
  assert.deepEqual(itensFone.ITENS.map(k => k[1]), ITENS_MOTOR.map(k => k.nome));
  // quem perde ganha 3 moedas e quem vence ganha 10: um item custa de 2 a 3 rodadas ganhas, nunca mais que isso
  for (const [id, , preco, dica] of itensFone.ITENS) { assert.ok(Number.isInteger(preco) && preco >= 15 && preco <= 30, id); assert.ok(typeof dica === 'string' && dica.length > 5 && dica.length <= 40, id); }
  assert.equal(itensFone.ESTOQUE_MAX, 9);
  assert.ok(itensFone.ITENS.length <= 16, 'o servidor so repassa indice de 0 a 15');
});

test('itens: todo item tem icone no celular', () => {
  for (const k of itensFone.ITENS) assert.ok(fonteFone.includes(`<symbol id="i-${k[4]}"`), k[0]);
});

test('itens: compra por unidade, so com saldo e ate 9 de cada', () => {
  const { compraItem, estoqueLimpo } = itensFone;
  const perfil = { moedas: 70, itens: estoqueLimpo(null) };
  assert.deepEqual(perfil.itens, { bomba: 0, gelo: 0, turbo: 0, guarda: 0, tinta: 0 });
  assert.equal(compraItem(perfil, 0), true);
  assert.deepEqual([perfil.moedas, perfil.itens.bomba], [40, 1]);
  assert.equal(compraItem(perfil, 0), true);
  assert.equal(compraItem(perfil, 0), false, 'saldo de 10 nao compra bomba de 30');
  assert.deepEqual([perfil.moedas, perfil.itens.bomba], [10, 2]);
  for (const torto of [-1, 5, 1.5, '0', null, undefined, 'length']) assert.equal(compraItem(perfil, torto), false, String(torto));
  const rico = { moedas: 9999, itens: estoqueLimpo(null) };
  for (let k = 0; k < 9; k++) assert.equal(compraItem(rico, 4), true);
  assert.equal(compraItem(rico, 4), false, 'estoque cheio');
  assert.deepEqual([rico.itens.tinta, rico.moedas], [9, 9999 - 9 * 15]);
});

test('itens: o estoque so desconta quando a tela confirma o uso, e cada confirmacao conta uma vez', () => {
  const { gastaItem, estoqueLimpo } = itensFone;
  const perfil = { moedas: 0, itens: { ...estoqueLimpo(null), bomba: 2, tinta: 1 }, gastos: [] };
  assert.equal(gastaItem(perfil, { id: 'a-1', k: 0 }), true);
  assert.equal(perfil.itens.bomba, 1);
  for (let k = 0; k < 5; k++) assert.equal(gastaItem(perfil, { id: 'a-1', k: 0 }), false, 'o mesmo estado chega varias vezes');
  assert.equal(perfil.itens.bomba, 1);
  assert.equal(gastaItem(perfil, { id: 'a-2', k: 4 }), true);
  assert.equal(perfil.itens.tinta, 0);
  assert.equal(gastaItem(perfil, { id: 'a-3', k: 4 }), true, 'confirmacao sem estoque: registra e nao fica negativo');
  assert.equal(perfil.itens.tinta, 0);
  for (const torto of [undefined, null, 'x', 7, {}, { id: 5, k: 0 }, { id: '', k: 0 }, { id: 'b-1', k: 9 }, { id: 'b-2', k: 'bomba' }, { id: 'x'.repeat(80), k: 0 }, { id: 'b-3' }])
    assert.equal(gastaItem(perfil, torto), false, JSON.stringify(torto));
  assert.equal(perfil.itens.bomba, 1);
  for (let k = 0; k < 40; k++) gastaItem(perfil, { id: 'c-' + k, k: 1 });
  assert.ok(perfil.gastos.length <= 12, 'a lista de confirmacoes vistas nao cresce sem fim');
});

test('itens: estoque salvo torto volta ao padrao (so inteiro de 0 a 9 por item do catalogo)', () => {
  const { estoqueLimpo } = itensFone;
  assert.deepEqual(estoqueLimpo({ bomba: 3, gelo: 99, turbo: -2, guarda: '4', tinta: 2.7, outro: 5, __proto__: { x: 1 } }), { bomba: 3, gelo: 9, turbo: 0, guarda: 0, tinta: 0 });
  for (const torto of [undefined, null, 5, 'abc', [1, 2, 3]]) assert.deepEqual(estoqueLimpo(torto), { bomba: 0, gelo: 0, turbo: 0, guarda: 0, tinta: 0 }, String(torto));
});

test('itens: confirmacao que nao e de um toque deste celular so fica registrada, sem descontar (outro aparelho no mesmo lugar)', () => {
  const { gastaItem, estoqueLimpo } = itensFone;
  const perfil = { moedas: 0, itens: { ...estoqueLimpo(null), bomba: 2 }, gastos: [] };
  assert.equal(gastaItem(perfil, { id: 'z-1', k: 0 }, false), false);
  assert.equal(perfil.itens.bomba, 2);
  assert.equal(gastaItem(perfil, { id: 'z-1', k: 0 }, true), false, 'e a mesma confirmacao nao desconta depois, quando este celular usar um item');
  assert.equal(perfil.itens.bomba, 2);
  assert.equal(gastaItem(perfil, { id: 'z-2', k: 0 }, true), true);
  assert.equal(perfil.itens.bomba, 1);
});
