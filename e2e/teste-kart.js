// Teste jogando de verdade: tela do PC (janela visivel) + dois celulares com toque, pilotando o kart pelo joystick.
// Uso: node teste-kart.js  (servidor da copia rodando: PORT=8160 node server.js)
// Variaveis: URL_JOGO (padrao http://localhost:8160), PW (pasta do playwright, se nao estiver instalado aqui).
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const PW_PADRAO = 'playwright';
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PW || PW_PADRAO)); }
const URL = process.env.URL_JOGO || 'http://localhost:8160';
const FOTOS = path.join(__dirname, 'fotos');
const volta = a => Math.atan2(Math.sin(a), Math.cos(a));
const limita = (v, m) => Math.max(-m, Math.min(m, v));
const espera = ms => new Promise(r => setTimeout(r, ms));

// Celular com toque de verdade (CDP): dedo 1 no joystick flutuante, dedo 2 segura o B, dedo 3 toca o A.
// No CDP, touchStart leva todos os dedos na tela e touchEnd leva so o dedo que saiu (senao solta todos).
async function celular(browser, botao) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  await page.goto(URL + '/c');
  await page.getByRole('button', { name: botao }).tap();
  const cdp = await ctx.newCDPSession(page);
  const centro = async sel => { const b = await page.locator(sel).boundingBox(); return b && { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 }; };
  const dedos = new Map();       // id -> ponto
  let base = null, origem = null;
  const lista = () => [...dedos.values()];
  const manda = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  return {
    page, erros,
    // joystick: x, y de -1 a 1 (y negativo = para cima)
    async joy(x, y) {
      const len = Math.hypot(x, y);
      if (len < 0.05) { if (dedos.has(1)) { const d = dedos.get(1); dedos.delete(1); await manda('touchEnd', [d]); origem = null; } return; }
      if (!origem) {
        base ??= await centro('#base');
        if (!base) return;
        origem = { x: base.x, y: base.y };
        dedos.set(1, { x: origem.x, y: origem.y, id: 1 });
        await manda('touchStart', lista());
      }
      const k = Math.min(1, len), dist = (0.1 + 0.9 * k) * base.r;       // a zona morta do joystick e 10% do raio
      dedos.set(1, { x: origem.x + x / len * dist, y: origem.y + y / len * dist, id: 1 });
      await manda('touchMove', lista());
    },
    async seguraB(sim) {
      if (sim === dedos.has(2)) return;
      if (sim) { const c = await centro('#btB'); if (!c) return; dedos.set(2, { x: c.x, y: c.y, id: 2 }); await manda('touchStart', lista()); }
      else { const d = dedos.get(2); dedos.delete(2); await manda('touchEnd', [d]); }
    },
    async tocaA() {
      const c = await centro('#btA');
      if (!c) return;
      const d = { x: c.x, y: c.y, id: 3 };
      dedos.set(3, d); await manda('touchStart', lista());
      await espera(25);                                  // toque bem curto, de proposito
      dedos.delete(3); await manda('touchEnd', [d]);
    },
    async toca(sel) { const c = await centro(sel); if (!c) return; await manda('touchStart', [{ x: c.x, y: c.y, id: 9 }]); await espera(25); await manda('touchEnd', []); },
    async soltaTudo() { dedos.clear(); origem = null; await manda('touchEnd', []); },
  };
}

(async () => {
  const kart = await import(pathToFileURL(path.join(__dirname, '..', 'jogos', 'kart.mjs')).href);
  const { PISTA, N, V_MAX } = kart;
  fs.mkdirSync(FOTOS, { recursive: true });
  const erros = [];
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-position=30,30', '--window-size=1280,760',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] });
  const tela = await (await browser.newContext({ viewport: null })).newPage();
  tela.on('pageerror', e => erros.push(String(e)));
  tela.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await tela.goto(URL);
  await tela.locator('#espera').waitFor({ state: 'visible' });
  const cel = [await celular(browser, 'Jogador 1'), await celular(browser, 'Jogador 2')];
  await tela.bringToFront();
  await tela.locator('#espera').waitFor({ state: 'hidden' });
  console.log('ok os dois celulares conectaram');

  await tela.waitForFunction(() => { window.__jogo('kart'); return window.__p.jogo?.id === 'kart'; }, null, { timeout: 30000, polling: 500 });
  await tela.waitForFunction(() => document.getElementById('msg').textContent.includes('Entendi'));
  for (const c of cel) { await c.page.locator('#btG').waitFor({ state: 'visible' }); await c.toca('#btG'); }
  const fotos = {};
  const foto = async (nome, cond = true) => {
    if (!cond || fotos[nome]) return;
    fotos[nome] = true;
    await tela.screenshot({ path: path.join(FOTOS, `kart-${nome}.png`) });
    console.log('foto', nome);
  };
  // contagem da largada
  await tela.waitForFunction(() => window.__p.fase === 'intro' && window.__p.liberado && window.__p.t > 1.6, null, { timeout: 15000 });
  await foto('largada-contagem');
  await tela.waitForFunction(() => window.__p.jogo.id === 'kart' && window.__p.fase === 'jogando', null, { timeout: 10000 });
  console.log('ok a corrida comecou');

  const estado = () => tela.evaluate(() => {
    const p = window.__p, d = p.dados;
    return {
      fase: p.fase, t: p.t, jogo: p.jogo.id, erros: p.erros, vencedor: p.vencedor,
      j: p.jogadores.map(j => ({ x: j.x, z: j.z, ent: j.ent })),
      k: d.k?.map(k => ({ ang: k.ang, v: Math.hypot(k.vx, k.vz), drift: k.drift, nivel: k.nivel, turboT: k.turboT, spinT: k.spinT })),
      idx: d.idx, item: d.item, voltas: d.voltas, tempos: d.tempos, pos: d.pos, misseis: d.misseis?.length, pocas: d.pocas?.length,
      escudo: d.escudo, naPista: d.naPista, progresso: d.progresso,
    };
  });

  // piloto: mira um ponto a frente na pista e converte o angulo para o x do joystick; o jogador 1 derrapa nas curvas
  const segurouItem = [0, 0], ultimaVolta = [0, 0], parado = [0, 0], re = [0, 0];
  let s = await estado(), usouItem = 0, quadros = 0;
  const t0 = Date.now();
  while (s.fase === 'jogando' && s.jogo === 'kart' && Date.now() - t0 < (process.env.DEPURA ? 40000 : 80000)) {
    for (const i of [0, 1]) {
      const j = s.j[i], k = s.k[i], olha = Math.round(14 + k.v * 0.7);
      const alvo = PISTA[(s.idx[i] + olha) % N];
      const dif = volta(Math.atan2(alvo.z - j.z, alvo.x - j.x) - k.ang);
      let curva = 0;
      for (let a = 4; a < 30; a++) curva += PISTA[(s.idx[i] + a) % N].curva;
      const derrapa = i === 0 && Math.abs(curva) > 1.6 && k.v > 8;
      const x = limita(dif * 2.4 + (k.drift ? -k.drift * 0.15 : 0), 1);
      // como um polegar de verdade: inclina para o lado sem deixar de empurrar; preso, puxa para baixo e da re
      parado[i] = k.v < 1.5 && s.t > 2 ? parado[i] + 1 : 0;
      if (parado[i] > 40 || re[i] > 0) { re[i] = re[i] > 0 ? re[i] - 1 : 30; await cel[i].joy(-x * 0.8, 0.9); }
      else await cel[i].joy(x, -Math.sqrt(Math.max(0.05, 1 - x * x)));
      await cel[i].seguraB(derrapa || (k.drift !== 0 && Math.abs(curva) > 0.9));
      // item: espera um pouco depois de pegar (como um humano) e usa
      if (s.item[i]) { segurouItem[i]++; if (segurouItem[i] > (i ? 25 : 12)) { await cel[i].tocaA(); segurouItem[i] = 0; usouItem++; } }
      else segurouItem[i] = 0;
    }
    s = await estado(); quadros++;
    if (process.env.DEPURA && quadros % 200 === 0) console.log(s.t.toFixed(1), await tela.evaluate(() => document.visibilityState + ' foco=' + document.hasFocus()), JSON.stringify(s.j.map((j, i) => [j.x.toFixed(1), j.z.toFixed(1), s.k[i].v.toFixed(1), s.idx[i], s.progresso[i].toFixed(2), j.ent.x.toFixed(2), j.ent.y.toFixed(2)])));
    const dist = Math.hypot(s.j[0].x - s.j[1].x, s.j[0].z - s.j[1].z);
    if (s.t > 0.3 && s.t < 1.2) await foto('largada');
    if (s.k.some(k => k.nivel >= 1 && k.drift)) await foto('drift-faiscas');
    if (s.k.some((k, i) => Math.abs(PISTA[s.idx[i]].curva) > 0.15 && !k.drift)) await foto('curva');
    if (s.misseis > 0 || s.pocas > 0 || s.escudo.some(e => e > 13) || s.k.some(k => k.spinT > 0.6)) await foto('item-em-uso');
    if (dist > 22) await foto('karts-separados');
    if (s.item[0] && !fotos['cel-item']) { fotos['cel-item'] = true; await cel[0].page.screenshot({ path: path.join(FOTOS, 'kart-cel-1.png') }); await cel[1].page.screenshot({ path: path.join(FOTOS, 'kart-cel-2.png') }); console.log('foto celulares'); }
    for (const i of [0, 1]) if (s.voltas[i] > ultimaVolta[i]) { ultimaVolta[i] = s.voltas[i]; console.log(`jogador ${i + 1} fechou a volta ${s.voltas[i]} em ${s.t.toFixed(1)} s`); }
    if (s.erros.length) break;
  }
  console.log(`quadros de controle: ${quadros} (${(quadros / ((Date.now() - t0) / 1000)).toFixed(1)} por segundo), itens usados: ${usouItem}`);
  for (const c of cel) await c.soltaTudo();
  await tela.waitForFunction(() => window.__p.fase === 'resultado', null, { timeout: 15000 });
  await espera(400);
  await foto('resultado');
  const fim = await tela.evaluate(() => ({ vencedor: window.__p.vencedor, erros: window.__p.erros, d: { voltas: window.__p.dados.voltas, tempos: window.__p.dados.tempos } }));
  const voltas = fim.d.tempos.map(t => t.map((v, k) => +(v - (t[k - 1] ?? 0)).toFixed(1)));
  console.log('voltas (s):', JSON.stringify(voltas), 'vencedor:', fim.vencedor);
  const faltou = ['largada-contagem', 'largada', 'curva', 'drift-faiscas', 'item-em-uso', 'karts-separados', 'resultado'].filter(n => !fotos[n]);
  const falhas = [];
  if (faltou.length) falhas.push('fotos que faltaram: ' + faltou.join(', '));
  if (fim.erros.length || erros.length || cel.some(c => c.erros.length)) falhas.push('erros: ' + JSON.stringify([fim.erros, erros, cel.map(c => c.erros)]));
  if (![0, 1].includes(fim.vencedor) || Math.max(...fim.d.voltas) < 3) falhas.push('ninguem completou as 3 voltas');
  if (!usouItem) falhas.push('nenhum item usado');
  if (falhas.length) { console.log('FALHOU:', falhas.join(' | ')); process.exitCode = 1; }
  else console.log('TUDO PASSOU: sem erro na tela nem nos celulares, todas as fotos tiradas, voltas (s)', JSON.stringify(voltas));
  await browser.close();
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
