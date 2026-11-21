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
  return new Function(`${trecho}; return { PALETA, N_CHAPEUS, N_PETS, RASTROS, ACABAMENTO, indice, mesmaCor, semRepetir, corEscura, perfilDaRede };`)();
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
  assert.deepEqual(escuras, [9, 18, 23], 'grafite, bolinhas (azul-marinho) e vinho');
});

test('perfilDaRede: perfil antigo sem pet nem rastro vale, e indice invalido cai em nenhum', () => {
  const { perfilDaRede, N_PETS, RASTROS, PALETA, N_CHAPEUS } = cat;
  assert.deepEqual(perfilDaRede({ j: 2, nome: 'Bia', cor: 5, chapeu: 3 }, 1), { nome: 'Bia', cor: 5, chapeu: 3, pet: 0, rastro: 0 });
  assert.deepEqual(perfilDaRede({ nome: 'Ana', cor: PALETA.length - 1, chapeu: N_CHAPEUS - 1, pet: N_PETS - 1, rastro: RASTROS.length - 1 }, 0),
    { nome: 'Ana', cor: PALETA.length - 1, chapeu: N_CHAPEUS - 1, pet: N_PETS - 1, rastro: RASTROS.length - 1 });
  for (const ruim of [999, -1, 1.5, '2', null, NaN, {}, [], 'length', '__proto__']) {
    const r = perfilDaRede({ nome: 'x', cor: ruim, chapeu: ruim, pet: ruim, rastro: ruim }, 3);
    assert.deepEqual(r, { nome: 'x', cor: 3, chapeu: 0, pet: 0, rastro: 0 }, String(ruim));
  }
  assert.equal(perfilDaRede({ pet: N_PETS }, 0).pet, 0, 'um a mais que o ultimo pet');
  assert.equal(perfilDaRede({ rastro: RASTROS.length }, 0).rastro, 0, 'um a mais que o ultimo rastro');
  assert.deepEqual(perfilDaRede({ nome: 12345678901234 }, 0), { nome: '1234567890', cor: 0, chapeu: 0, pet: 0, rastro: 0 }, 'nome cortado em 10');
  assert.deepEqual(perfilDaRede({}, 2), { nome: '', cor: 2, chapeu: 0, pet: 0, rastro: 0 });
});

test('cores chapadas novas: par em PARECIDAS com quem confunde, e nenhuma confunde com as 4 padrao', () => {
  const { mesmaCor, PALETA } = cat;
  assert.equal(PALETA.length, 28);
  for (let nova = 22; nova < 28; nova++) for (let padrao = 0; padrao < 4; padrao++) assert.equal(mesmaCor(nova, padrao), false, nova + ' x ' + padrao);
  for (const [a, b] of [[22, 6], [23, 7], [24, 13], [25, 5], [26, 4], [26, 20]]) assert.equal(mesmaCor(a, b), true, a + ' x ' + b);
});

// ---------- itens de rodada (spec 009): o aviso curto da TV ----------
test('fraseItem: todo item do motor tem aviso na TV com os nomes de quem jogou e de quem levou', async () => {
  const { ITENS } = await import('./logica.mjs');
  const { fraseItem } = puras('tela.html', ['fraseItem']);
  assert.equal(fraseItem({ id: 'bomba' }, 'Ana', 'Bia'), 'Ana jogou uma bomba em Bia');
  assert.equal(fraseItem({ id: 'gelo' }, 'Ana', 'Bia'), 'Ana congelou Bia');
  assert.equal(fraseItem({ id: 'tinta' }, 'Ana', 'Bia'), 'Ana jogou tinta no celular de Bia');
  assert.equal(fraseItem({ id: 'turbo' }, 'Ana', 'Ana'), 'Ana ligou o turbo');
  assert.equal(fraseItem({ id: 'guarda' }, 'Ana', 'Ana'), 'Ana abriu o guarda-chuva');
  assert.equal(fraseItem({ id: 'bomba', bloqueado: true }, 'Ana', 'Bia'), 'O guarda-chuva de Bia segurou a bomba de Ana');
  for (const k of ITENS) {
    const t = fraseItem({ id: k.id }, 'Ana', 'Bia');
    assert.ok(t.startsWith('Ana ') && t.length <= 40, k.id + ': ' + t);
    if (k.alvo) assert.ok(fraseItem({ id: k.id, bloqueado: true }, 'Ana', 'Bia').includes('Bia segurou'), k.id);
  }
  for (const torto of [undefined, null, {}, { id: 'nada' }, { id: 'constructor' }, { id: '__proto__' }, 5]) assert.equal(fraseItem(torto, 'Ana', 'Bia'), '', JSON.stringify(torto));
});
