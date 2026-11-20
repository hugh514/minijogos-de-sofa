// Funcoes puras de texto da tela (textoSeguro e trocaNomes): o teste le o trecho @puras-texto do tela.html e do controle.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function puras(arquivo, nomes) {
  const html = fs.readFileSync(new URL('./' + arquivo, import.meta.url), 'utf8');
  const trecho = html.split('// @puras-texto')[1].split('// @fim-puras-texto')[0].replace(/^[^\n]*\n/, '');
  return new Function(`${trecho}; return { ${nomes.join(', ')} };`)();
}
const tela = puras('tela.html', ['textoSeguro', 'trocaNomes', 'milhar', 'lugarDe']);

test('lugarDe: a dupla escolhida troca dois lugares, vale nos dois sentidos e nunca mexe no Jogador 1', () => {
  assert.deepEqual([0, 1, 2, 3].map(s => tela.lugarDe(null, s)), [0, 1, 2, 3], 'sem troca cada um no seu lugar');
  assert.deepEqual([0, 1, 2, 3].map(s => tela.lugarDe([1, 2], s)), [0, 2, 1, 3], 'J2 de dupla: o lugar 2 joga no indice 2 e o lugar 3 no indice 1');
  assert.deepEqual([0, 1, 2, 3].map(s => tela.lugarDe([3, 2], s)), [0, 1, 3, 2], 'J4 de dupla');
  for (const t of [[1, 2], [3, 2]]) for (const s of [0, 1, 2, 3]) assert.equal(tela.lugarDe(t, tela.lugarDe(t, s)), s, 'ida e volta');
});
const fone = puras('controle.html', ['textoSeguro', 'milhar', 'pareceId']);

for (const [onde, { textoSeguro }] of [['tela', tela], ['celular', fone]]) {
  test(`textoSeguro (${onde}): so texto e numero finito passam, o resto vira vazio`, () => {
    assert.equal(textoSeguro('Pegue a bola'), 'Pegue a bola');
    assert.equal(textoSeguro(7), '7');
    assert.equal(textoSeguro(1234.5), '1.234,5');
    for (const ruim of [undefined, null, NaN, Infinity, true, false, {}, [], { toString: () => 'x' }, () => 1, Symbol('s')])
      assert.equal(textoSeguro(ruim), '', String(typeof ruim));
  });

  test(`textoSeguro (${onde}): tira restos crus de dentro do texto e corta no tamanho`, () => {
    assert.equal(textoSeguro('Vidas: undefined'), 'Vidas:');
    assert.equal(textoSeguro('Placar NaN x null'), 'Placar x');
    assert.equal(textoSeguro('Item [object Object] pego'), 'Item pego');
    assert.equal(textoSeguro('a'.repeat(300)).length, 120);
    assert.equal(textoSeguro('abcdef', 3), 'abc');
    assert.equal(textoSeguro('  dois   espacos  '), 'dois espacos');
  });
}

test('trocaNomes: Jogador N vira o nome do perfil, sem artigo, so quando ha nome', () => {
  const { trocaNomes } = tela, nomes = ['Ana', '', 'Bia', 'Caio'];
  assert.equal(trocaNomes('Jogador 2 cria o ritmo!', ['Ana', 'Bia']), 'Bia cria o ritmo!');
  assert.equal(trocaNomes('Vez do Jogador 1', nomes), 'Vez de Ana');
  assert.equal(trocaNomes('Bandeira da Jogador 3', nomes), 'Bandeira de Bia');
  assert.equal(trocaNomes('Jogador 2 e Jogador 4', nomes), 'Jogador 2 e Caio', 'sem nome no lugar 2: fica Jogador 2');
  assert.equal(trocaNomes('do Jogador 2', nomes), 'do Jogador 2');
  assert.equal(trocaNomes('Jogador 5 e Jogador 12', nomes), 'Jogador 5 e Jogador 12', 'so de 1 a 4');
  assert.equal(trocaNomes('Jogadores 1 e 3', nomes), 'Jogadores 1 e 3');
  assert.equal(trocaNomes(42, nomes), 42, 'o que nao e texto passa como veio (o textoSeguro cuida)');
  assert.equal(trocaNomes('Jogador 1', undefined), 'Jogador 1');
});

test('milhar: saldo com separador de milhar do Brasil, e so inteiro', () => {
  for (const { milhar } of [tela, fone]) {
    assert.equal(milhar(12345), '12.345');
    assert.equal(milhar(7), '7');
    assert.equal(milhar(NaN), '0');
    assert.equal(milhar('99'), '0');
  }
});

test('pareceId: o celular esconde nome de minijogo que e so o id do arquivo', () => {
  const { pareceId } = fone;
  assert.equal(pareceId('corrida-dedos'), true);
  assert.equal(pareceId('sumo'), true);
  assert.equal(pareceId('Corrida de dedos'), false);
  assert.equal(pareceId('Sumô'), false);
});

test('rotulo: botao em caixa alta do minijogo vira caixa normal; o resto passa', () => {
  const { rotulo } = puras('tela.html', ['rotulo']);
  assert.equal(rotulo('ENCHE!'), 'Enche!');
  assert.equal(rotulo('ARRANCA'), 'Arranca');
  assert.equal(rotulo('JÁ'), 'Já');
  assert.equal(rotulo('Empurra'), 'Empurra');
  assert.equal(rotulo('A'), 'A', 'uma letra so fica');
  assert.equal(rotulo('3x'), '3x');
  assert.equal(rotulo('!!'), '!!', 'sem letra nao muda');
  assert.equal(rotulo(undefined), '');
  assert.equal(rotulo('MUITO LONGO DEMAIS PARA BOTAO', 10), 'Muito long');
});

test('trocaNomes: ao, pelo e no Jogador N viram a, por e em {nome}', () => {
  const { trocaNomes } = tela, nomes = ['Ana', 'Bia', '', 'Duda'];
  assert.equal(trocaNomes('Passe ao Jogador 2', nomes), 'Passe a Bia');
  assert.equal(trocaNomes('Pego pelo Jogador 1', nomes), 'Pego por Ana');
  assert.equal(trocaNomes('A bola esta no Jogador 4', nomes), 'A bola esta em Duda');
  assert.equal(trocaNomes('Passe ao Jogador 3', nomes), 'Passe ao Jogador 3', 'sem nome: fica como veio');
  assert.equal(trocaNomes('pela Jogador 2 e na Jogador 1', nomes), 'por Bia e em Ana');
});

// ---------- catalogo de cores e chapeus da tela: perfil que chega pela rede e cor repetida ----------
const cat = (() => {
  const html = fs.readFileSync(new URL('./tela.html', import.meta.url), 'utf8');
  const trecho = html.split('// @catalogo')[1].split('// @fim-catalogo')[0].replace(/^[^\n]*\n/, '');
  return new Function(`${trecho}; return { PALETA, N_CHAPEUS, ACABAMENTO, indice, mesmaCor, semRepetir, corEscura };`)();
})();

test('indice: cor ou chapeu invalido vindo da rede cai no padrao e nunca quebra', () => {
  const { indice, N_CHAPEUS } = cat;
  assert.equal(indice(0, N_CHAPEUS, 0), 0);
  assert.equal(indice(N_CHAPEUS - 1, N_CHAPEUS, 0), N_CHAPEUS - 1);
  for (const ruim of [N_CHAPEUS, 999, -1, 2.5, '3', null, undefined, NaN, Infinity, {}, [], 'length', '__proto__']) assert.equal(indice(ruim, N_CHAPEUS, 0), 0, String(ruim));
  assert.equal(indice(99, cat.PALETA.length, 2), 2, 'cor fora do catalogo: a padrao do lugar');
});

test('mesmaCor: as 4 cores padrao nao se confundem e a relacao vale nos dois sentidos', () => {
  const { mesmaCor, PALETA } = cat;
  for (let a = 0; a < PALETA.length; a++) for (let b = 0; b < PALETA.length; b++) {
    assert.equal(mesmaCor(a, b), mesmaCor(b, a));
    if (a < 4 && b < 4 && a !== b) assert.equal(mesmaCor(a, b), false);
  }
  assert.equal(mesmaCor(7, 7), true);
});

test('semRepetir: quaisquer 4 cores pedidas viram 4 cores validas que ninguem confunde', () => {
  const { semRepetir, mesmaCor, PALETA } = cat, n = PALETA.length;
  assert.deepEqual(semRepetir([0, 1, 2, 3]), [0, 1, 2, 3]);
  assert.deepEqual(semRepetir([5, 5, 2, 3]), [5, 1, 2, 3], 'repetiu: cai na cor padrao do lugar');
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) for (let d = 0; d < n; d++) {
    const r = semRepetir([a, b, c, d]);
    if (r[0] !== a || r.some((x, k) => PALETA[x] === undefined || r.slice(0, k).some(o => mesmaCor(o, x)))) assert.fail(`${[a, b, c, d]} virou ${r}`);
  }
});

test('corEscura: so as cores escuras do catalogo pedem contorno claro no nome', () => {
  const escuras = cat.PALETA.flatMap((c, i) => cat.corEscura(c) ? [i] : []);
  assert.deepEqual(escuras, [9, 18], 'grafite e bolinhas (azul-marinho)');
});
