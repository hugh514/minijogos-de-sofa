// Teste de ponta a ponta da escolha de duplas: o Jogador 1 toca em quem joga com ele, e a partida de Duplas respeita a escolha.
// Uso: PORT=8152 node server.js (em outro terminal) e depois URL_JOGO=http://localhost:8152 node e2e/teste-duplas.js
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.env.URL_JOGO || 'http://localhost:8152';
const FOTOS = path.join(__dirname, 'fotos-duplas');
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
  for (let n = 1; n <= 4; n++) {
    const ctx = await browser.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true });
    const f = await ctx.newPage();
    f.on('pageerror', e => erros.push(`celular ${n}: ${e}`));
    f.on('console', m => { if (m.type() === 'error') erros.push(`celular ${n}: ${m.text()}`); });
    await f.goto(URL + '/c', { timeout: 90000 });
    await f.getByRole('button', { name: 'Jogador ' + n }).tap();
    f.cdp = await ctx.newCDPSession(f);
    fones.push(f);
  }
  await frente();
  await tela.waitForFunction(() => window.__sala().seguidos === 4, null, { timeout: 10000 });
  const toque = (page, type, x, y) => page.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const menu = fones[0];
  const pilula = n => menu.locator(`#menuConectados i[data-n="${n}"]`);
  const ladoDoPlacar = k => tela.locator('#placar .lado').nth(k).locator('.nm').allTextContents();

  // Entendi no celular de cada lugar (o indice na partida pode ser outro: a tela diz quando todos estao prontos)
  async function todosProntos() {
    for (const f of fones) {
      await f.waitForFunction(() => document.getElementById('btG').textContent === 'Entendi' && getComputedStyle(document.getElementById('botao')).display !== 'none', null, { timeout: 15000 });
      await f.locator('#btG').tap(); await frente();
    }
    await tela.waitForFunction(() => window.__p.fase === 'jogando', null, { timeout: 20000 });
  }
  async function partidaCom(n, esquerda, direita, rotulo) {
    await menu.locator('#menuLista button[data-m=times][aria-disabled=false]').waitFor({ timeout: 8000 });
    await menu.locator('#menuLista button[data-m=times]').tap(); await frente();
    await tela.waitForFunction(() => window.__sala().escolhaModo === 'times', null, { timeout: 4000 });
    await menu.locator('#menuDuplaTx').waitFor({ state: 'visible', timeout: 4000 });
    await pilula(n).tap(); await frente();
    await tela.waitForFunction(x => window.__sala().parceiro === x, n, { timeout: 4000 });
    assert.ok((await pilula(n).getAttribute('class')).includes('par'), 'a pilula da dupla fica marcada');
    assert.ok((await pilula(0).getAttribute('class')).includes('par'), 'a do Jogador 1 tambem');
    await tela.waitForFunction(t => document.getElementById('espera').innerText.includes(t), `Jogador 1 e Jogador ${n + 1} contra`, { timeout: 5000 });       // a TV diz as duplas
    await foto(`${rotulo}-1-menu-celular`, menu); await foto(`${rotulo}-2-espera-tv`);
    await menu.locator('#menuGo').tap(); await frente();
    await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
    await ev(() => { window.__p.modificadores = false; window.__jogo('tinta-festa'); });
    await tela.waitForFunction(() => window.__p.jogo.id === 'tinta-festa' && window.__bonecos.filter(b => b.visible).length === 4, null, { timeout: 8000 });
    assert.deepEqual(await ladoDoPlacar(0), esquerda, 'time laranja no lado esquerdo do placar');
    assert.deepEqual(await ladoDoPlacar(1), direita, 'time roxo no lado direito');
    await espera(1200); await foto(`${rotulo}-3-explicacao-tv`);
    await todosProntos();
  }
  const voltaAoMenu = async () => {
    await tela.keyboard.press('KeyV');
    await tela.locator('#espera').waitFor({ state: 'visible' });
    assert.equal(await ev(() => window.__sala().troca), null, 'no menu cada um volta ao seu lugar');
  };

  // ---- 1. Jogador 1 escolhe o Jogador 2 de dupla
  await partidaCom(1, ['Jogador 1', 'Jogador 2'], ['Jogador 3', 'Jogador 4'], 'j2');
  assert.deepEqual(await ev(() => window.__sala().troca), [1, 2]);
  // o celular do lugar 2 mexe o boneco do indice 2 (o parceiro do J1), e so ele
  const antes = await ev(() => window.__p.jogadores.map(j => [j.x, j.z]));
  await toque(fones[1], 'touchStart', 150, 220);
  for (let k = 0; k < 12; k++) { await toque(fones[1], 'touchMove', 210, 220); await espera(80); }
  await toque(fones[1], 'touchEnd');
  const depois = await ev(() => window.__p.jogadores.map(j => [j.x, j.z]));
  const andou = depois.map((d, i) => Math.hypot(d[0] - antes[i][0], d[1] - antes[i][1]));
  assert.ok(andou[2] > 1 && andou[0] < 0.2 && andou[1] < 0.2 && andou[3] < 0.2, 'so o boneco da dupla andou: ' + andou.map(v => v.toFixed(2)));
  await foto('j2-4-meio-tv');
  await ev(() => { const p = window.__p; p.t = p.jogo.duracao - 0.4; });
  await tela.waitForFunction(() => ['resultado', 'fim'].includes(window.__p.fase), null, { timeout: 30000 });
  const r = await ev(() => ({ v: window.__p.vencedor, pts: window.__p.jogadores.map(j => j.pontos) }));
  if (r.v >= 0) {
    const ganhou = r.v === 0 ? [0, 1] : [2, 3], perdeu = r.v === 0 ? [2, 3] : [0, 1];       // lugares dos celulares: J1+J2 sao o time laranja
    for (const k of ganhou) await fones[k].waitForFunction(() => document.body.innerText.includes('Ponto da sua dupla'), null, { timeout: 5000 });
    for (const k of perdeu) await fones[k].waitForFunction(() => document.body.innerText.includes('Quase'), null, { timeout: 5000 });
  }
  await espera(600); await foto('j2-5-fim-tv'); await foto('j2-6-fim-celular-lugar2', fones[1]);
  console.log(`ok dupla J1 + J2: placar, controle e resultado no celular certos (vencedor ${r.v}, pontos ${r.pts.join(',')})`);

  // ---- 2. volta ao menu e escolhe o Jogador 4
  await voltaAoMenu();
  await partidaCom(3, ['Jogador 1', 'Jogador 4'], ['Jogador 2', 'Jogador 3'], 'j4');
  assert.deepEqual(await ev(() => window.__sala().troca), [3, 2]);
  console.log('ok dupla J1 + J4');

  // ---- 3. volta e escolhe o Jogador 3 (a ordem de sempre, sem troca)
  await voltaAoMenu();
  await partidaCom(2, ['Jogador 1', 'Jogador 3'], ['Jogador 2', 'Jogador 4'], 'j3');
  assert.equal(await ev(() => window.__sala().troca), null);
  console.log('ok dupla J1 + J3 (a de sempre)');

  assert.deepEqual(await ev(() => window.__p.erros), [], 'sem erros dos minijogos');
  assert.deepEqual(erros, [], 'zero erros de console: ' + erros.join(' | '));
  await browser.close();
  console.log('TUDO OK');
})().catch(async e => {
  console.error('FALHOU:', e.stack || e.message); console.error(erros);
  try { await browser?.close(); } catch {}
  process.exit(1);
});
