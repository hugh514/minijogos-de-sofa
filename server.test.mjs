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
