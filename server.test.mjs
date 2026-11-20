// Servidor: slots de 1 a 4, validacao do jogador (j) e a rota /modo do anfitriao. Sobe uma copia na porta 8158.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = 8158, base = { host: '127.0.0.1', port: PORT };
let proc;
const espera = ms => new Promise(r => setTimeout(r, ms));

function pede(metodo, caminho, corpo) {
  return new Promise((ok, erro) => {
    const r = http.request({ ...base, method: metodo, path: caminho }, res => { res.resume(); res.on('end', () => ok(res.statusCode)); });
    r.on('error', erro); r.end(corpo);
  });
}
// Abre um SSE e junta as mensagens que chegarem.
function escuta(caminho) {
  const msgs = [];
  const req = http.get({ ...base, path: caminho }, res => {
    res.setEncoding('utf8');
    res.on('data', d => { for (const l of d.split('\n')) if (l.startsWith('data: ')) msgs.push(JSON.parse(l.slice(6))); });
  });
  req.on('error', () => {});
  return { msgs, fecha: () => req.destroy() };
}

test.before(async () => {
  proc = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  for (let k = 0; k < 40; k++) { try { await pede('GET', '/ip'); return; } catch { await espera(100); } }
  throw new Error('servidor nao subiu');
});
test.after(() => proc?.kill());

test('servidor: /eventos-c aceita j de 1 a 4 e recusa o resto', async () => {
  for (const j of [1, 2, 3, 4]) {
    const s = escuta('/eventos-c?j=' + j);
    await espera(80);
    assert.ok(s.msgs.length >= 1, 'o slot ' + j + ' recebeu o estado inicial');
    s.fecha();
  }
  for (const j of ['0', '5', 'x', '2.5', '-1', '']) assert.equal(await pede('GET', '/eventos-c?j=' + j), 400, 'j=' + j);
  assert.equal(await pede('GET', '/eventos-c'), 400);
});

test('servidor: /in repassa os slots 1 a 4 e ignora j invalido', async () => {
  const tela = escuta('/eventos');
  await espera(80);
  for (const j of [1, 2, 3, 4, 0, 5, '3', null, 2.5]) await pede('POST', '/in', JSON.stringify({ j, x: 0.5, y: 0, d: true }));
  await espera(150);
  assert.deepEqual(tela.msgs.filter(m => m.j).map(m => m.j), [1, 2, 3, 4]);
  tela.fecha();
});

test('servidor: /perfil guarda o perfil de cada slot e ignora j invalido', async () => {
  const quem = [];
  for (const j of [1, 3, 4, 5, 0]) await pede('POST', '/perfil', JSON.stringify({ j, nome: 'N' + j, cor: j, chapeu: 0 }));
  const tela = escuta('/eventos');
  await espera(120);
  quem.push(...tela.msgs.filter(m => m.perfil).map(m => m.perfil.j));
  assert.deepEqual(quem, [1, 3, 4], 'a tela nova recebe os perfis guardados, so dos slots validos');
  tela.fecha();
});

test('servidor: /perfil repassa pet e rastro, perfil antigo ganha 0 e o que nao e inteiro vira 0', async () => {
  await pede('POST', '/perfil', JSON.stringify({ j: 1, nome: 'Ana', cor: 27, chapeu: 22, pet: 8, rastro: 5 }));
  await pede('POST', '/perfil', JSON.stringify({ j: 2, nome: 'Bia', cor: 1, chapeu: 2 }));       // celular com a versao antiga na memoria
  await pede('POST', '/perfil', JSON.stringify({ j: 3, nome: 'Caio', cor: 'x', chapeu: 1.5, pet: '3', rastro: { a: 1 } }));
  await pede('POST', '/perfil', JSON.stringify({ j: 4, nome: '\u{1F600}'.repeat(5), cor: 27, chapeu: 22, pet: 8, rastro: 5 }));       // o maior corpo que o celular manda cabe nos 500 bytes
  const tela = escuta('/eventos');
  await espera(120);
  const perfis = tela.msgs.filter(m => m.perfil).map(m => m.perfil);
  assert.deepEqual(perfis.find(q => q.j === 1), { j: 1, nome: 'Ana', cor: 27, chapeu: 22, pet: 8, rastro: 5 });
  assert.deepEqual(perfis.find(q => q.j === 2), { j: 2, nome: 'Bia', cor: 1, chapeu: 2, pet: 0, rastro: 0 });
  assert.deepEqual(perfis.find(q => q.j === 3), { j: 3, nome: 'Caio', cor: 2, chapeu: 0, pet: 0, rastro: 0 });
  assert.deepEqual(perfis.find(q => q.j === 4), { j: 4, nome: '\u{1F600}'.repeat(5), cor: 27, chapeu: 22, pet: 8, rastro: 5 });
  tela.fecha();
});

test('servidor: /modo so aceita o anfitriao (j 1) e modos conhecidos, e repassa para a tela', async () => {
  const tela = escuta('/eventos');
  await espera(80);
  await pede('POST', '/modo', JSON.stringify({ j: 2, modo: 'vs', comeca: true }));
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'hack', comeca: true }));
  await pede('POST', '/modo', 'nao e json');
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'times', comeca: false }));
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'coop', comeca: false }));
  await espera(150);
  assert.deepEqual(tela.msgs.filter(m => m.escolha).map(m => m.escolha), [{ modo: 'times', comeca: false }, { modo: 'coop', comeca: false }]);
  tela.fecha();
  const nova = escuta('/eventos');
  await espera(120);
  assert.deepEqual(nova.msgs.filter(m => m.escolha).map(m => m.escolha), [{ modo: 'coop', comeca: false, antiga: true }], 'tela nova sabe o modo, mas como escolha antiga: nao recomeca');
  nova.fecha();
});

test('servidor: /modo repassa a dupla escolhida pelo anfitriao (par: lugar 2, 3 ou 4) e ignora valor torto', async () => {
  const tela = escuta('/eventos');
  await espera(80);
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'times', comeca: false, par: 2 }));
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'times', comeca: false, par: 4 }));
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'times', comeca: false, par: 1 }));
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'times', comeca: false, par: '3; drop' }));
  await espera(150);
  assert.deepEqual(tela.msgs.filter(m => m.escolha && !m.escolha.antiga).map(m => m.escolha.par), [2, 4, undefined, undefined]);
  tela.fecha();
  await pede('POST', '/modo-limpa', '{}');
});

test('servidor: a escolha de modo e esquecida quando vira partida (comeca) ou quando a tela limpa', async () => {
  const vista = async () => { const t = escuta('/eventos'); await espera(120); t.fecha(); return t.msgs.filter(m => m.escolha).map(m => m.escolha); };
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'vs', comeca: false }));
  assert.deepEqual(await vista(), [{ modo: 'vs', comeca: false, antiga: true }]);
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'vs', comeca: true }));
  assert.deepEqual(await vista(), [], 'virou partida: tela nova nao recebe a escolha velha');
  await pede('POST', '/modo', JSON.stringify({ j: 1, modo: 'times', comeca: false }));
  await pede('POST', '/modo-limpa', '{}');
  assert.deepEqual(await vista(), [], 'a tela pediu o menu de novo: a escolha velha some');
});

test('servidor: corpo de /modo acima do limite e descartado', async () => {
  const tela = escuta('/eventos');
  await espera(80);
  const longo = JSON.stringify({ j: 1, modo: 'vs', comeca: true, lixo: 'x'.repeat(400) });
  await pede('POST', '/modo', longo).catch(() => {});
  await espera(150);
  assert.deepEqual(tela.msgs.filter(m => m.escolha?.comeca), [], 'o corpo grande nao chegou');
  tela.fecha();
});

test('servidor: /tela entrega o estado ao celular de cada um dos 4 slots', async () => {
  const cels = [1, 2, 3, 4].map(j => escuta('/eventos-c?j=' + j));
  await espera(100);
  await pede('POST', '/tela', JSON.stringify({ c: [1, 2, 3, 4].map(k => ({ jogo: 'j' + k, modo: 'espera' })) }));
  await espera(150);
  cels.forEach((c, k) => assert.ok(c.msgs.some(m => m.jogo === 'j' + (k + 1)), 'slot ' + (k + 1)));
  cels.forEach(c => c.fecha());
});

// Modelos 3D (CC0): so arquivos de dentro de modelos/<pacote>/, com nome em regex fechada.
function baixa(caminho) {
  return new Promise((ok, erro) => {
    http.get({ ...base, path: caminho }, res => {
      const partes = [];
      res.on('data', d => partes.push(d));
      res.on('end', () => ok({ status: res.statusCode, tipo: res.headers['content-type'], corpo: Buffer.concat(partes) }));
    }).on('error', erro);
  });
}

test('servidor: /modelos serve o glb e a textura com o tipo certo', async () => {
  const glb = await baixa('/modelos/graveyard-kit/character-zombie.glb');
  assert.equal(glb.status, 200);
  assert.equal(glb.tipo, 'model/gltf-binary');
  assert.equal(glb.corpo.subarray(0, 4).toString('latin1'), 'glTF', 'cabecalho de glb');
  const png = await baixa('/modelos/graveyard-kit/colormap.png');
  assert.equal(png.status, 200);
  assert.equal(png.tipo, 'image/png');
  assert.equal(png.corpo.subarray(1, 4).toString('latin1'), 'PNG');
});

test('servidor: /modelos recusa caminho fora da regex (traversal, maiusculas, licenca, extensao, arquivo que nao existe)', async () => {
  const ruins = [
    '/modelos/../server.js', '/modelos/graveyard-kit/../../server.js', '/modelos/graveyard-kit/..%2f..%2fserver.js',
    '/modelos/graveyard-kit/%2e%2e/%2e%2e/server.js', '/modelos/..%2fnode_modules/x.glb', '/modelos//graveyard-kit/character-zombie.glb',
    '/modelos/graveyard-kit/License.txt', '/modelos/graveyard-kit/Character-Zombie.glb', '/modelos/Graveyard-kit/character-zombie.glb',
    '/modelos/graveyard-kit/character-zombie.glb/x', '/modelos/graveyard-kit/character-zombie.js', '/modelos/graveyard-kit/nao-existe.glb',
    '/modelos/graveyard-kit/character-zombie.glb%00.png', '/modelos/graveyard-kit/', '/modelos/',
  ];
  for (const c of ruins) {
    const r = await baixa(c);
    assert.equal(r.status, 404, c + ' deveria ser 404 e foi ' + r.status);
    assert.ok(!r.corpo.includes('createServer') && !r.corpo.includes('glTF'), c + ' nao devolve arquivo');
  }
});

test('servidor: os modulos do GLTFLoader sao servidos como javascript', async () => {
  for (const m of ['loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js']) {
    const r = await baixa('/three/addons/' + m);
    assert.equal(r.status, 200, m);
    assert.match(r.tipo, /javascript/);
    assert.ok(r.corpo.length > 1000, m);
  }
  assert.equal((await baixa('/three/addons/loaders/../../../../server.js')).status, 404);
});

test('servidor: /lugares diz quais lugares tem celular conectado, so leitura', async () => {
  const vazio = await baixa('/lugares');
  assert.equal(vazio.status, 200);
  assert.match(vazio.tipo, /application\/json/);
  assert.deepEqual(JSON.parse(vazio.corpo), [false, false, false, false]);
  const c2 = escuta('/eventos-c?j=2'), c4 = escuta('/eventos-c?j=4');
  await espera(100);
  assert.deepEqual(JSON.parse((await baixa('/lugares')).corpo), [false, true, false, true]);
  c2.fecha(); c4.fecha();
  await espera(100);
  assert.deepEqual(JSON.parse((await baixa('/lugares')).corpo), [false, false, false, false], 'quem saiu libera o lugar');
  assert.equal(await pede('POST', '/lugares', '{}'), 404, 'nada se escreve em /lugares');
});

test('servidor: /comando so aceita o j 1, a lista fechada e corpo pequeno', async () => {
  const tela = escuta('/eventos');
  await espera(80);
  const ruins = [
    JSON.stringify({ j: 2, c: 'pula' }), JSON.stringify({ j: '1', c: 'pula' }), JSON.stringify({ c: 'pula' }),
    JSON.stringify({ j: 1, c: 'hack' }), JSON.stringify({ j: 1, c: 'constructor' }), JSON.stringify({ j: 1, c: ['pula'] }),
    'nao e json', JSON.stringify({ j: 1, c: 'menu', lixo: 'x'.repeat(200) }),
  ];
  for (const corpo of ruins) await pede('POST', '/comando', corpo).catch(() => {});
  await pede('GET', '/comando');
  for (const c of ['pula', 'reinicia', 'menu', 'continua']) await pede('POST', '/comando', JSON.stringify({ j: 1, c }));
  await espera(150);
  assert.deepEqual(tela.msgs.filter(m => m.comando).map(m => m.comando), ['pula', 'reinicia', 'menu', 'continua']);
  tela.fecha();
});

test('servidor: /pausa sem corpo alterna como antes; com corpo diz quem pediu e se e para continuar', async () => {
  const tela = escuta('/eventos');
  await espera(80);
  await pede('POST', '/pausa');
  await pede('POST', '/pausa', JSON.stringify({ j: 3 }));
  await pede('POST', '/pausa', JSON.stringify({ j: 9, continua: 'sim' }));
  await pede('POST', '/pausa', JSON.stringify({ j: 2, continua: true }));
  await pede('POST', '/pausa', 'x'.repeat(300)).catch(() => {});
  await espera(150);
  assert.deepEqual(tela.msgs.filter(m => m.pausa), [
    { pausa: true }, { pausa: true, j: 3 }, { pausa: true }, { pausa: true, j: 2, continua: true },
  ]);
  tela.fecha();
});

test('servidor: /fontes serve so a fonte woff2 da pasta, nunca a licenca nem caminho torto', async () => {
  const f = await baixa('/fontes/baloo2.woff2');
  assert.equal(f.status, 200);
  assert.equal(f.tipo, 'font/woff2');
  assert.equal(f.corpo.subarray(0, 4).toString('latin1'), 'wOF2');
  for (const c of ['/fontes/OFL.txt', '/fontes/../server.js', '/fontes/..%2fserver.js', '/fontes/Baloo2.woff2', '/fontes/baloo2.ttf',
    '/fontes/nao-existe.woff2', '/fontes/', '/fontes//baloo2.woff2', '/fontes/baloo2.woff2/x', '/fontes/baloo2.woff2%00']) {
    const r = await baixa(c);
    assert.equal(r.status, 404, c + ' deveria ser 404 e foi ' + r.status);
  }
});
