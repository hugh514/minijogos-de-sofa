// Teste de ponta a ponta com 5 no sofa: os minijogos sao para ate 4, entao um descansa por rodada (rodizio) e torce pelo celular.
// Uso: PORT=8152 node server.js (em outro terminal) e depois URL_JOGO=http://localhost:8152 node e2e/teste-cinco.js
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.env.URL_JOGO || 'http://localhost:8152';
const FOTOS = path.join(__dirname, 'fotos-cinco');
fs.mkdirSync(FOTOS, { recursive: true });
const erros = [];
let browser;
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] });
  const tela = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tela.on('pageerror', e => erros.push(`tela: ${e}`));
  tela.on('console', m => { if (m.type() === 'error') erros.push(`tela: ${m.text()}`); });
  await tela.goto(URL, { timeout: 90000 });
  await tela.locator('#espera').waitFor({ state: 'visible' });
  const ev = (fn, arg) => tela.evaluate(fn, arg);
  const frente = () => tela.bringToFront();
  const foto = async (nome, alvo = tela) => { if (alvo === tela) await frente(); await alvo.screenshot({ path: path.join(FOTOS, nome + '.png') }); await frente(); console.log('  print ' + nome); };
  const fones = [];
  for (let n = 1; n <= 5; n++) {
    const ctx = await browser.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true });
    const f = await ctx.newPage();
    f.on('pageerror', e => erros.push(`celular ${n}: ${e}`));
    f.on('console', m => { if (m.type() === 'error') erros.push(`celular ${n}: ${m.text()}`); });
    await f.goto(URL + '/c', { timeout: 90000 });
    if (n === 5) await f.screenshot({ path: path.join(FOTOS, '0-escolha-de-lugar-celular.png') });
    await f.getByRole('button', { name: 'Jogador ' + n }).tap();
    f.cdp = await ctx.newCDPSession(f);
    fones.push(f);
  }
  await frente();
  await tela.waitForFunction(() => window.__sala().seguidos === 5, null, { timeout: 10000 });
  await espera(1500);
  await foto('1-espera-5-no-sofa');
  await foto('1b-menu-celular-j1', fones[0]);
  assert.equal(await fones[0].locator('#menuConectados i').count(), 5, 'o menu do Jogador 1 mostra os 5');
  const toque = (page, type, x, y) => page.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });

  await fones[0].locator('#menuLista button[data-m=vs]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'vs', null, { timeout: 4000 });
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  await ev(() => { window.__p.modificadores = false; });
  assert.deepEqual(await ev(() => [window.__p.modo, window.__p.n, window.__p.jogadores.length]), ['vs', 5, 5]);

  const descansaram = [];
  for (const [k, id] of ['tinta-festa', 'sumo-vidas', 'galinhas-festa'].entries()) {
    const antes = await ev(() => window.__p.jogadores.map(j => j.pontos));
    await ev(x => { window.__jogo(x); for (const j of window.__p.jogadores) { j.oferta = null; j.direito = false; } }, id);
    await tela.waitForFunction(x => window.__p.jogo.id === x && window.__p.fase === 'intro', id, { timeout: 5000 });
    const d = await ev(() => window.__p.duelo);
    assert.ok(Array.isArray(d) && d.length === 4, `${id}: quatro jogam: ${d}`);
    const fora = [0, 1, 2, 3, 4].find(i => !d.includes(i));
    descansaram.push(fora);
    await tela.waitForFunction(x => window.__bonecos.every((b, i) => b.visible === x.includes(i)), d, { timeout: 5000 });
    assert.equal(await tela.locator('#placar .cartao').count(), 5, 'o placar mostra os 5');
    await espera(1000); await foto(`${k + 2}-${id}-1-explicacao`);
    assert.ok((await tela.locator('#msg').innerText()).includes('descansa'), 'a explicacao diz quem descansa');
    for (const f of fones) {
      await f.waitForFunction(() => document.getElementById('btG').textContent === 'Entendi' && getComputedStyle(document.getElementById('botao')).display !== 'none', null, { timeout: 15000 });
      await f.locator('#btG').tap(); await frente();
    }
    await tela.waitForFunction(() => window.__p.fase === 'jogando', null, { timeout: 20000 });
    await fones[fora].waitForFunction(() => document.body.innerText.includes('Você descansa nesta'), null, { timeout: 5000 });
    const p0 = await ev(() => window.__p.jogadores.map(j => [j.x, j.z]));
    await Promise.all(fones.map(f => toque(f, 'touchStart', 150, 220)));
    for (let q = 0; q < 25; q++) { await Promise.all(fones.map((f, i) => toque(f, 'touchMove', 150 + Math.cos(q * 0.2 + i * 1.3) * 60, 220 + Math.sin(q * 0.2 + i * 1.3) * 60))); await espera(90); }
    await Promise.all(fones.map(f => toque(f, 'touchEnd')));
    const p1 = await ev(() => window.__p.jogadores.map(j => [j.x, j.z]));
    const andou = p1.map((v, i) => Math.hypot(v[0] - p0[i][0], v[1] - p0[i][1]));
    assert.ok(andou[fora] < 0.01, `${id}: quem descansa nao se move: ${andou.map(v => v.toFixed(2))}`);
    assert.ok(d.every(i => andou[i] > 0.3), `${id}: os quatro da vez se movem: ${andou.map(v => v.toFixed(2))}`);
    await foto(`${k + 2}-${id}-2-meio`); await foto(`${k + 2}-${id}-3-celular-de-quem-descansa`, fones[fora]);
    await ev(() => { const p = window.__p; p.t = Math.max(p.t, (p.jogo.duracao || 40) - 0.4); });
    await tela.waitForFunction(() => ['resultado', 'fim'].includes(window.__p.fase), null, { timeout: 40000 });
    await espera(700);
    const r = await ev(() => ({ v: window.__p.vencedor, pts: window.__p.jogadores.map(j => j.pontos) }));
    assert.ok(r.v === -1 || d.includes(r.v), `${id}: o vencedor e um dos que jogaram: ${r.v}`);
    if (r.v >= 0) assert.deepEqual(r.pts.map((v, i) => v - antes[i]), [0, 1, 2, 3, 4].map(i => (i === r.v ? 1 : 0)), 'so o vencedor pontua');
    await foto(`${k + 2}-${id}-4-fim`);
    console.log(`ok ${id} com 5: jogaram ${d.map(i => 'J' + (i + 1)).join(' ')}, descansou J${fora + 1}, vencedor ${r.v < 0 ? 'empate' : 'J' + (r.v + 1)}`);
  }
  assert.equal(new Set(descansaram).size, 3, 'a cada rodada descansa outra pessoa: ' + descansaram);

  // podio com 5
  await ev(() => { const p = window.__p; p.jogadores.forEach((j, i) => { j.pontos = [p.alvo, 7, 5, 3, 1][i]; }); p.campeoes = [0]; p.fase = 'fim'; p.t = 0; });
  await espera(2600); await foto('5-podio-com-5');

  assert.deepEqual(await ev(() => window.__p.erros), [], 'sem erros dos minijogos');
  assert.deepEqual(erros, [], 'zero erros de console: ' + erros.join(' | '));
  await browser.close();
  console.log('TUDO OK');
})().catch(async e => {
  console.error('FALHOU:', e.stack || e.message); console.error(erros);
  try { await browser?.close(); } catch {}
  process.exit(1);
});
