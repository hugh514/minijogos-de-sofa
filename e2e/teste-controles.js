// Teste dos controles do celular: area de toque dos botoes, deslizar entre A e B, curva do joystick, multitoque, em pe e deitado.
// Uso: PORT=8154 node server.js (em outro terminal) e depois URL_JOGO=http://localhost:8154 node teste-controles.js
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.env.URL_JOGO || 'http://localhost:8154';
const FOTOS = path.join(__dirname, 'fotos-controle');
const erros = [];
const espera = ms => new Promise(r => setTimeout(r, ms));

async function celular(browser, botao) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => erros.push(`${botao}: ${e}`));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('cancelable=false')) erros.push(`${botao}: ${m.text()}`); });   // aviso do toque sintetico do CDP, nao do controle
  await page.goto(URL + '/c');
  await page.getByRole('button', { name: botao }).tap();
  page.cdp = await ctx.newCDPSession(page);
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const tela = await (await browser.newContext({ viewport: { width: 1100, height: 600 } })).newPage();
  tela.on('pageerror', e => erros.push(`tela: ${e}`));
  await tela.goto(URL);
  await tela.locator('#espera').waitFor({ state: 'visible' });
  const um = await celular(browser, 'Jogador 1'), dois = await celular(browser, 'Jogador 2');
  await tela.locator('#espera').waitFor({ state: 'hidden' });
  await tela.evaluate(() => { window.__p.modificadores = false; window.__jogo('moedas'); });
  await tela.waitForFunction(() => window.__p.fase === 'intro', null, { timeout: 15000 });
  const prontos = async () => {
    for (const [i, f] of [um, dois].entries()) {                    // os dois apertam PRONTO
      await f.waitForFunction(() => document.getElementById('btG').textContent === 'Entendi' && getComputedStyle(document.getElementById('botao')).display !== 'none', null, { timeout: 15000 });
      for (let k = 0; k < 5; k++) {
        await f.locator('#btG').tap();
        try { await tela.waitForFunction(x => window.__p.jogadores[x].pronto || window.__p.fase !== 'intro', i, { timeout: 1500 }); break; } catch {}
      }
    }
    await tela.waitForFunction(() => window.__p.fase === 'jogando', null, { timeout: 15000 });
  };
  await prontos();
  await um.waitForFunction(() => getComputedStyle(document.getElementById('padrao')).display === 'flex', null, { timeout: 5000 });
  console.log('ok rodada de moedas em andamento, celular 1 no modo padrao');

  const ent = () => tela.evaluate(() => { const e = window.__p.jogadores[0].ent; return { x: e.x, y: e.y, d: e.d, b: e.b }; });
  const entAte = async (cond, rotulo) => {      // a tela recebe o estado pela rede: espera chegar
    let e;
    for (let k = 0; k < 40; k++) { e = await ent(); if (cond(e)) return e; await espera(50); }
    throw new Error(`${rotulo}: a tela viu ${JSON.stringify(e)}`);
  };
  const lido = f => f.evaluate(() => ({ n, nb, d, b, x, y }));
  const geo = f => f.evaluate(() => {
    const c = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
    return { a: c('btA'), b: c('btB'), zona: c('botoes'), base: c('base') };
  });
  // dedos: lista de quem esta na tela agora; cada chamada manda o estado completo
  let dedos = [];
  const manda = (f, tipo, pts = dedos) => f.cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: pts.map(p => ({ x: p.x, y: p.y, id: p.id })) });
  const poe = async (f, id, x, y) => { const novo = !dedos.some(p => p.id === id); dedos = [...dedos.filter(p => p.id !== id), { id, x, y }]; await manda(f, novo ? 'touchStart' : 'touchMove'); };
  const tira = async f => { dedos = []; await manda(f, 'touchEnd', []); };
  // o CDP so solta todos os dedos de uma vez: para soltar um so, manda um touchend de verdade (sintetico) so para ele
  const soltaUm = (f, id, alvo) => f.evaluate(([i, x, y]) => {
    const t = new Touch({ identifier: i, target: document.getElementById('btA'), clientX: x, clientY: y });
    document.getElementById('btA').dispatchEvent(new TouchEvent('touchend', { changedTouches: [t], touches: [], bubbles: true, cancelable: true }));
  }, [id, alvo.x, alvo.y]);
  const vira = async vp => { await um.evaluate(() => document.fullscreenElement && document.exitFullscreen()).catch(() => {}); await espera(200); await um.setViewportSize(vp); };
  const sinal = v => Math.sign(v) || 1;

  for (const [nome, vp] of [['deitado', { width: 844, height: 390 }], ['em-pe', { width: 390, height: 844 }]]) {
    await vira(vp); await espera(300);
    const g = await geo(um), raio = g.base.w / 2;
    assert.ok(g.zona.w >= vp.width * 0.45 && g.zona.h >= (vp.height - 120) * 0.8, `${nome}: #botoes deveria ser a metade inteira, veio ${JSON.stringify(g.zona)}`);
    console.log(`ok ${nome}: viewport ${vp.width}x${vp.height}, #botoes ${Math.round(g.zona.w)}x${Math.round(g.zona.h)}, base ${Math.round(g.base.w)}px`);

    // 1) toque fora do circulo A (na borda da area, longe do desenho) e entre A e B contam
    let a0 = await lido(um);
    const dx = g.a.x - g.b.x, dy = g.a.y - g.b.y;
    const fora = { x: g.a.x + sinal(dx) * Math.min(g.zona.w / 2 - 4, g.a.w * 0.75) * (Math.abs(dx) > Math.abs(dy) ? 1 : 0), y: g.a.y + sinal(dy) * Math.min(g.zona.h / 2 - 4, g.a.h * 0.75) * (Math.abs(dy) >= Math.abs(dx) ? 1 : 0) };
    await poe(um, 1, fora.x, fora.y);
    await entAte(e => e.d && !e.b, `${nome}: toque na borda de A`);
    let a1 = await lido(um); assert.equal(a1.n, a0.n + 1, `${nome}: n deveria subir`); assert.equal(a1.nb, a0.nb);
    await tira(um); await entAte(e => !e.d, `${nome}: soltou A`);
    const meio = { x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2 };
    await poe(um, 1, meio.x + dx * 0.03, meio.y + dy * 0.03);      // vao entre os dois, um pouco para o lado de A
    await entAte(e => e.d && !e.b, `${nome}: toque entre A e B (lado A)`);
    await tira(um);
    await poe(um, 1, meio.x - dx * 0.03, meio.y - dy * 0.03);      // idem, lado de B
    await entAte(e => e.b && !e.d, `${nome}: toque entre A e B (lado B)`);
    await tira(um); await entAte(e => !e.b, `${nome}: soltou B`);
    console.log(`ok ${nome}: toque na borda e entre A e B contam`);

    // 2) deslizar de A para B e de volta
    a0 = await lido(um);
    await poe(um, 1, g.a.x, g.a.y); await entAte(e => e.d && !e.b, `${nome}: dedo em A`);
    for (let k = 1; k <= 6; k++) await poe(um, 1, g.a.x + (g.b.x - g.a.x) * k / 6, g.a.y + (g.b.y - g.a.y) * k / 6);
    await entAte(e => e.b && !e.d, `${nome}: deslizou A para B (solta A, aperta B)`);
    a1 = await lido(um); assert.equal(a1.n, a0.n + 1); assert.equal(a1.nb, a0.nb + 1);
    for (let k = 1; k <= 6; k++) await poe(um, 1, g.b.x + (g.a.x - g.b.x) * k / 6, g.b.y + (g.a.y - g.b.y) * k / 6);
    await entAte(e => e.d && !e.b, `${nome}: deslizou B para A`);
    a1 = await lido(um); assert.equal(a1.n, a0.n + 2); assert.equal(a1.nb, a0.nb + 1);
    await tira(um); await entAte(e => !e.d && !e.b, `${nome}: soltou tudo`);
    console.log(`ok ${nome}: deslizar A para B solta A e aperta B (e o contrario), contadores n+2 e nb+1`);

    // 2b) histerese: um pouco alem da divisa o dedo continua em A; dedo esfregando na divisa nao gera aperto novo; bem alem troca
    a0 = await lido(um);
    const tA = f => ({ x: g.a.x + (g.b.x - g.a.x) * f, y: g.a.y + (g.b.y - g.a.y) * f });      // f = 0 em A, 0.5 na divisa, 1 em B
    await poe(um, 1, g.a.x, g.a.y); await entAte(e => e.d && !e.b, `${nome}: dedo em A (histerese)`);
    for (const f of [0.55, 0.45, 0.6, 0.5, 0.58, 0.42, 0.62, 0.5]) await poe(um, 1, tA(f).x, tA(f).y);
    await espera(200);
    a1 = await lido(um); assert.equal(a1.n, a0.n + 1, `${nome}: esfregar na divisa nao pode apertar de novo`); assert.equal(a1.nb, a0.nb, `${nome}: esfregar na divisa nao pode apertar B`);
    assert.ok((await ent()).d && !(await ent()).b, `${nome}: o dedo segue em A`);
    await poe(um, 1, tA(0.75).x, tA(0.75).y); await entAte(e => e.b && !e.d, `${nome}: bem alem da divisa troca para B`);
    await tira(um); await entAte(e => !e.d && !e.b, `${nome}: soltou (histerese)`);
    console.log(`ok ${nome}: histerese, esfregar na divisa nao alterna A e B, 25% alem da divisa troca`);

    // 3) curva do joystick: o dedo nasce no centro da base e anda uma fracao do raio
    const cx = g.base.x, cy = g.base.y;
    await poe(um, 2, cx, cy); await poe(um, 2, cx + raio * 0.2, cy);
    let e = await entAte(v => v.x > 0.02, `${nome}: joystick a 20%`);
    const lin = (0.2 - 0.1) / 0.9;
    assert.ok(e.x > 0 && e.x < lin * 0.8, `${nome}: a 20% a forca deveria ser menor que a linear (${lin.toFixed(3)}), veio ${e.x}`);
    const x20 = e.x;
    await poe(um, 2, cx + raio, cy);
    e = await entAte(v => v.x > 0.99, `${nome}: joystick a 100%`);
    assert.equal(e.x, 1);
    await poe(um, 2, cx + raio * 0.9, cy + raio * 0.9);            // diagonal acima do raio
    e = await entAte(v => Math.hypot(v.x, v.y) > 0.99, `${nome}: diagonal`);
    assert.ok(Math.abs(Math.hypot(e.x, e.y) - 1) < 0.01, `${nome}: diagonal ${JSON.stringify(e)}`);
    console.log(`ok ${nome}: 20% da ${x20.toFixed(3)} (linear seria ${lin.toFixed(3)}); 100% da 1; diagonal da ${Math.hypot(e.x, e.y).toFixed(3)}`);

    // 4) multitoque: joystick (dedo 2) e botoes A e B juntos, com o print do meio da rodada
    await poe(um, 2, cx + raio * 0.7, cy - raio * 0.3);
    await poe(um, 3, g.a.x, g.a.y);
    await entAte(v => v.d && Math.hypot(v.x, v.y) > 0.3, `${nome}: multitoque`);
    await poe(um, 4, g.b.x, g.b.y);
    await entAte(v => v.d && v.b && Math.hypot(v.x, v.y) > 0.3, `${nome}: tres dedos`);
    await espera(250);
    await um.screenshot({ path: path.join(FOTOS, `controle-${nome}.png`) });
    await soltaUm(um, 3, g.a); await entAte(v => !v.d && v.b && Math.hypot(v.x, v.y) > 0.3, `${nome}: solta A, o resto segue`);
    await tira(um); await entAte(v => !v.d && !v.b && v.x === 0 && v.y === 0, `${nome}: solta tudo`);
    console.log(`ok ${nome}: joystick + A + B ao mesmo tempo, e soltar um nao solta os outros`);
    assert.equal(await tela.evaluate(() => window.__p.fase), 'jogando', 'a rodada nao pode ter acabado no meio do teste');
  }

  // 5) pausa e perfil na rodada pedem segurar 0,5 s
  await vira({ width: 844, height: 390 }); await espera(200);
  const pausado = () => tela.evaluate(() => getComputedStyle(document.getElementById('pausa')).display !== 'none');
  const bp = await um.locator('#pausar').boundingBox(), px = bp.x + bp.width / 2, py = bp.y + bp.height / 2;
  const antes = await pausado();
  dedos = []; await poe(um, 1, px, py); await espera(150); await tira(um); await espera(400);
  assert.equal(await pausado(), antes, 'toque curto na pausa nao deveria pausar na rodada');
  await um.locator('#abrePerfil').tap(); await espera(300);
  assert.equal(await um.evaluate(() => getComputedStyle(document.getElementById('perfil')).display), 'none', 'toque curto no perfil nao deveria abrir na rodada');
  await poe(um, 1, px, py); await espera(900); await tira(um); await espera(400);
  assert.notEqual(await pausado(), antes, 'segurar 0,5 s deveria pausar');
  await poe(um, 1, px, py); await espera(900); await tira(um); await espera(400);   // continua
  assert.equal(await pausado(), antes, 'segurar de novo deveria continuar');
  console.log('ok pausa e perfil: toque curto na rodada nao pega, segurar 0,5 s pega');

  // 6) botoes que se alternam (sem joystick, como o corrida-dedos): deslizar NAO troca de botao, so tirar o dedo e tocar de novo
  await tela.evaluate(() => window.__jogo('corrida-dedos'));
  await tela.waitForFunction(() => window.__p.fase === 'intro', null, { timeout: 15000 });
  await prontos();
  await um.waitForFunction(() => document.getElementById('padrao').classList.contains('semjoy') && getComputedStyle(document.getElementById('padrao')).display === 'flex', null, { timeout: 5000 });
  const gs = await geo(um);
  let s0 = await lido(um);
  dedos = []; await poe(um, 1, gs.a.x, gs.a.y); await entAte(e => e.d && !e.b, 'semjoy: dedo em A');
  for (let k = 1; k <= 8; k++) await poe(um, 1, gs.a.x + (gs.b.x - gs.a.x) * k / 8, gs.a.y + (gs.b.y - gs.a.y) * k / 8);     // desliza ate o centro de B
  await espera(250);
  let s1 = await lido(um);
  assert.equal(s1.n, s0.n + 1, 'semjoy: so o toque em A conta'); assert.equal(s1.nb, s0.nb, 'semjoy: deslizar para B nao aperta B');
  assert.ok(s1.d && !s1.b, 'semjoy: o dedo segue em A');
  await tira(um); await entAte(e => !e.d && !e.b, 'semjoy: soltou');
  await poe(um, 1, gs.b.x, gs.b.y); await entAte(e => e.b && !e.d, 'semjoy: toque novo em B'); await tira(um);
  s1 = await lido(um); assert.equal(s1.n, s0.n + 1); assert.equal(s1.nb, s0.nb + 1, 'semjoy: tirar o dedo e tocar B conta');
  console.log('ok semjoy (corrida-dedos): deslizar de A para B nao troca nem aperta B; tocar de novo conta');

  assert.deepEqual(erros, [], 'erros no console: ' + erros.join(' | '));
  console.log('\nTUDO OK (teste-controles)');
  await browser.close();
})().catch(e => { console.error('FALHOU:', e.message || e); process.exit(1); });
