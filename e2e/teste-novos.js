// Teste de ponta a ponta dos seis minijogos novos da Festa: cozinha-coop, ponte-coop, defesa-coop (cooperativo, 4 celulares),
// pega-bandeira-festa, batata-festa e corrida-revezamento (times 2x2, 4 celulares) e depois pega-bandeira-festa e batata-festa
// em todos contra todos com 3 celulares. Chromium sem janela (headless com GPU), celulares com toque de verdade.
// Uso: PORT=8163 node server.js (em outro terminal) e depois PW=<caminho do playwright> URL_JOGO=http://localhost:8163 node teste-novos.js
// Salva os prints em fotos-novos/ e falha se houver qualquer erro de console ou de minijogo.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.env.URL_JOGO || 'http://localhost:8163';
const FOTOS = path.join(__dirname, 'fotos-novos');
fs.mkdirSync(FOTOS, { recursive: true });
const erros = [];
let browser;       // fechado tambem quando o teste falha (senao o Chromium fica rodando)
const espera = ms => new Promise(r => setTimeout(r, ms));

async function celular(browser, n) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => erros.push(`celular ${n}: ${e}`));
  page.on('console', m => { if (m.type() === 'error') erros.push(`celular ${n}: ${m.text()}`); });
  await page.goto(URL + '/c', { timeout: 90000 });
  await page.getByRole('button', { name: 'Jogador ' + n }).tap();
  page.cdp = await ctx.newCDPSession(page);
  page.ctx = ctx;
  return page;
}

(async () => {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] });
  const tela = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  tela.on('pageerror', e => erros.push(`tela: ${e}`));
  tela.on('crash', () => erros.push('tela: a pagina da tela travou (crash do renderizador)'));
  tela.on('console', m => { if (m.type() === 'error') erros.push(`tela: ${m.text()}`); });
  await tela.goto(URL, { timeout: 90000 });
  await tela.locator('#espera').waitFor({ state: 'visible' });
  const ev = (fn, arg) => tela.evaluate(fn, arg);
  const frente = () => tela.bringToFront();       // pagina em segundo plano para de desenhar quadros
  const foto = async (nome, alvo = tela) => { if (alvo === tela) await frente(); await alvo.screenshot({ path: path.join(FOTOS, nome + '.png') }); await frente(); console.log('  print ' + nome); };
  const fase = f => tela.waitForFunction(x => window.__p.fase === x, f, { timeout: 30000 });
  const estado = () => ev(() => ({ fase: window.__p.fase, t: window.__p.t, jogo: window.__p.jogo.id, modo: window.__p.modo, n: window.__p.n, erros: window.__p.erros }));
  globalThis.__estado = estado;
  const fones = [];
  const toque = (page, type, x, y) => page.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });

  async function anda(lista, ms, dir) {
    await Promise.all(lista.map(f => toque(f, 'touchStart', 150, 220)));
    const fim = Date.now() + ms;
    for (let k = 0; Date.now() < fim; k++) {
      await Promise.all(lista.map((f, i) => { const [dx, dy] = dir(i, k); return toque(f, 'touchMove', 150 + dx, 220 + dy); }));
      await espera(90);
    }
    await Promise.all(lista.map(f => toque(f, 'touchEnd')));
  }
  const roda = (i, k, fase0 = 0) => [Math.cos(k * 0.18 + i * 1.6 + fase0) * 62, Math.sin(k * 0.18 + i * 1.6 + fase0) * 62];

  async function prontoDe(i) {
    await frente();
    if (await ev(k => window.__p.jogadores[k].pronto, i)) return;
    const f = fones[i];
    // Quem perdeu a rodada pode receber cartas de poder no meio da explicacao: escolhe uma e segue para o PRONTO
    const cartaVisivel = () => f.locator('#opcoes button.carta').first().isVisible().catch(() => false);
    const prontoVisivel = () => f.evaluate(() => document.getElementById('btG').textContent === 'Entendi' && getComputedStyle(document.getElementById('botao')).display !== 'none');
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      if (await cartaVisivel()) { await f.locator('#opcoes button.carta').first().tap({ timeout: 3000 }).catch(() => {}); await espera(300); }
      if (!(await prontoVisivel())) { await espera(500); continue; }
      await f.locator('#btG').tap({ timeout: 3000 }).catch(() => {});
      await frente();
      try { await tela.waitForFunction(k => window.__p.jogadores[k].pronto || window.__p.fase !== 'intro', i, { timeout: 1500 }); return; } catch {}
    }
    throw new Error('PRONTO nao chegou do jogador ' + (i + 1));
  }
  // Forca o minijogo (a tela le a pasta jogos/ a cada 8 s, entao espera o arquivo novo entrar), explica e espera todos prontos.
  async function comeca(id, fotoExplica) {
    await tela.waitForFunction(() => ['intro', 'resultado', 'fim', 'jogando'].includes(window.__p.fase), null, { timeout: 30000 });
    const fim = Date.now() + 30000;
    for (;;) {
      const ok = await ev(x => { try { window.__jogo(x); return window.__p.jogo.id === x; } catch { return false; } }, id);
      if (ok) break;
      if (Date.now() > fim) throw new Error(id + ' nao entrou na rotacao da tela em 30 s');
      await espera(1000);
    }
    await tela.waitForFunction(x => window.__p.jogo.id === x && window.__p.fase === 'intro', id, { timeout: 5000 });
    if (fotoExplica) { await espera(1500); await foto(fotoExplica); }
    for (let i = 0; i < fones.length; i++) await prontoDe(i);
    await fase('jogando');
  }
  const termina = async () => { await tela.waitForFunction(() => ['resultado', 'fim'].includes(window.__p.fase), null, { timeout: 60000 }); await espera(900); };
  const semErro = async rotulo => {
    const e = await ev(() => window.__p.erros);
    assert.deepEqual(e, [], rotulo + ': erro de minijogo ' + e.join(' | '));
    assert.deepEqual(erros, [], rotulo + ': erro de console ' + erros.join(' | '));
  };
  const todosApareceram = n => tela.waitForFunction(k => window.__bonecos.slice(0, k).every(b => b.visible), n, { timeout: 5000 });
  const pontos = () => ev(() => window.__p.jogadores.map(j => j.pontos));
  const soma = (a, b) => a.map((v, i) => v - b[i]);
  const vencedor = () => ev(() => window.__p.vencedor);
  const poe = (i, x, z) => ev(([k, a, b]) => Object.assign(window.__p.jogadores[k], { x: a, z: b, vx: 0, vz: 0 }), [i, x, z]);
  // Abre o menu do Jogador 1, escolhe o modo e comeca.
  async function escolheModo(modo, n) {
    await tela.keyboard.press('KeyV');
    await tela.locator('#espera').waitFor({ state: 'visible' });
    await fones[0].locator(`#menuLista button[data-m=${modo}][aria-disabled=false]`).waitFor({ timeout: 6000 });
    await fones[0].locator(`#menuLista button[data-m=${modo}]`).tap(); await frente();
    await tela.waitForFunction(m => window.__sala().escolhaModo === m, modo, { timeout: 4000 });
    await fones[0].locator('#menuGo').tap(); await frente();
    await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
    const e = await estado();
    assert.deepEqual([e.modo, e.n], [modo, n]);
    await ev(() => { window.__p.modificadores = false; });
  }

  // =================================================== 4 celulares, cooperativo
  fones.push(await celular(browser, 1), await celular(browser, 2), await celular(browser, 3), await celular(browser, 4)); await frente();
  await tela.waitForFunction(() => window.__sala().seguidos === 4, null, { timeout: 8000 });
  await fones[0].locator('#menu').waitFor({ state: 'visible' });
  await fones[0].locator('#menuLista button[data-m=coop]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'coop', null, { timeout: 4000 });
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  let e = await estado();
  assert.deepEqual([e.modo, e.n], ['coop', 4]);
  await ev(() => { window.__p.modificadores = false; });
  const pontos0 = await pontos();

  // ---------- 1. cozinha-coop
  await comeca('cozinha-coop', 'cozinha-0-explicacao');
  await anda(fones, 2500, (i, k) => roda(i, k));
  await foto('cozinha-1-comeco'); await foto('cozinha-celular-j2', fones[1]);
  // meio: tres pegam um ingrediente cada e o quarto entrega o que pegou
  await ev(() => { const p = window.__p; p.dados.proximo = 99; });
  await poe(0, -7.6, -3.7); await poe(1, -7.6, -0.4); await poe(2, -7.6, 2.9); await poe(3, 6.5, -1);
  await espera(700); await todosApareceram(4);
  assert.deepEqual(await ev(() => window.__p.dados.leva.slice(0, 3)), [0, 1, 2], 'cada um pegou um ingrediente');
  await foto('cozinha-2-meio-ingredientes');
  await ev(() => { window.__p.dados.pedidos.unshift({ total: [0, 0], feito: [false, false], id: 98 }); });
  await poe(0, 6.6, -1.2); await espera(700);
  assert.ok(await ev(() => window.__p.dados.pedidos[0].feito.some(Boolean) || window.__p.dados.entregues > 0), 'a entrega valeu');
  await foto('cozinha-2b-meio-entrega');
  await ev(() => { const p = window.__p; p.dados.entregues = p.dados.meta; });
  await termina();
  assert.equal(await vencedor(), 2);
  assert.deepEqual(soma(await pontos(), pontos0), [1, 1, 1, 1]);
  await todosApareceram(4); await foto('cozinha-3-fim');
  await semErro('cozinha-coop');
  console.log('ok cozinha-coop com 4: pegou ingrediente, entregou no balcao, meta fechada, vitoria de todos');

  // ---------- 2. ponte-coop
  let antes = await pontos();
  await comeca('ponte-coop', 'ponte-0-explicacao');
  await anda(fones, 2500, (i, k) => roda(i, k));
  await foto('ponte-1-comeco'); await foto('ponte-celular-j3', fones[2]);
  await tela.waitForFunction(() => window.__p.t > 5.3, null, { timeout: 10000 });
  await ev(() => { const d = window.__p.dados; d.tabuas[0].x = -1.6; d.tabuas[0].z = 0; d.tabuas[1].x = 0.9; d.tabuas[1].z = 0; d.tabuas.forEach(t => { t.trava = 2; t.vx = t.vz = 0; }); d.tabuas[2].z = 30; d.tabuas[3].z = 30; });
  await poe(0, -1.6, -0.9); await poe(1, 0.9, 0.9); await poe(2, 3.5, 3); await poe(3, 0, 4);   // J4 cai na agua (fora de tabua), J3 quase na margem
  await espera(450); await todosApareceram(3).catch(() => {});
  await foto('ponte-2-meio-ponte-e-queda');
  assert.ok(await ev(() => window.__p.dados.agua[3] > 0), 'o jogador 4 caiu na agua');
  await ev(() => { const p = window.__p; p.dados.agua[3] = 0; p.jogadores.forEach((j, i) => Object.assign(j, { x: 7.5 + i * 0.3, z: (i - 1.5) * 2, vx: 0, vz: 0, y: 0, vy: 0 })); });       // tudo no mesmo quadro: ninguem cai de novo na agua no meio do caminho
  await termina();
  assert.equal(await vencedor(), 2, 'ponte: ' + JSON.stringify(await ev(() => ({ chegou: window.__p.dados.chegou, agua: window.__p.dados.agua, x: window.__p.jogadores.map(j => [j.x, j.y]) }))));
  assert.deepEqual(soma(await pontos(), antes), [1, 1, 1, 1]);
  await todosApareceram(4); await foto('ponte-3-fim');
  await semErro('ponte-coop');
  console.log('ok ponte-coop com 4: porteira, tabuas travadas, queda na agua e vitoria de todos na outra margem');

  // ---------- 3. defesa-coop
  antes = await pontos();
  await comeca('defesa-coop', 'defesa-0-explicacao');
  await anda(fones, 2500, (i, k) => roda(i, k));
  await foto('defesa-1-comeco'); await foto('defesa-celular-j1', fones[0]);
  await tela.waitForFunction(() => window.__p.t > 10.5, null, { timeout: 15000 });       // o primeiro bando chega aos 10 s
  for (let k = 0; k < 4; k++) { await Promise.all(fones.map(f => f.locator('#btA').tap())); await espera(250); }
  await todosApareceram(4);
  assert.ok(await ev(() => window.__p.dados.bichos.length >= 3), 'ha besouros em campo');
  assert.ok(await ev(() => window.__p.dados.fx.some(x => x.tipo === 'onda')), 'o toque no A soltou a onda de choque');
  await foto('defesa-2-meio');
  await ev(() => { const p = window.__p, d = p.dados; d.torre = Math.max(d.torre, 9); p.t = p.jogo.duracao - 0.6; });
  await termina();
  assert.equal(await vencedor(), 2);
  assert.deepEqual(soma(await pontos(), antes), [1, 1, 1, 1]);
  await todosApareceram(4); await foto('defesa-3-fim');
  await semErro('defesa-coop');
  console.log('ok defesa-coop com 4: besouros, onda de choque pelo A, torre aguentou e vitoria de todos');

  // =================================================== 4 celulares, times 2x2
  await escolheModo('times', 4);

  // ---------- 4. pega-bandeira-festa em times
  antes = await pontos();
  await comeca('pega-bandeira-festa', 'bandeira-0-explicacao');
  await anda(fones, 2500, (i, k) => roda(i, k));
  await foto('bandeira-1-comeco'); await foto('bandeira-celular-j4', fones[3]);
  await tela.waitForFunction(() => window.__p.t > 1.8, null, { timeout: 5000 });
  await ev(() => { const p = window.__p, b = p.dados.bandeira; p.jogadores.forEach((j, i) => Object.assign(j, { x: i === 0 ? b.x + 0.4 : 5 * Math.cos(i), z: i === 0 ? b.z : 5 * Math.sin(i), vx: 0, vz: 0 })); });
  await espera(1500); await todosApareceram(4);
  assert.equal(await ev(() => window.__p.dados.com), 0, 'J1 pegou a bandeira');
  await foto('bandeira-2-meio-carregando');
  await ev(() => { const p = window.__p, c = p.jogadores[0]; Object.assign(p.jogadores[1], { x: c.x + 1.5, z: c.z, vx: 0, vz: 0 }); });   // J2, do time B, ao lado de quem leva
  await fones[1].locator('#btA').tap();
  await tela.waitForFunction(() => window.__p.dados.com !== 0, null, { timeout: 3000 });
  await espera(250); await foto('bandeira-2b-meio-derrubou');
  await ev(() => { const p = window.__p; p.dados.pontos = [14, 22]; p.t = p.jogo.duracao - 0.6; p.dados.com = -1; p.dados.nopega = p.dados.nopega.map(() => 9); });
  await termina();
  assert.equal(await vencedor(), 1, 'o time B tinha mais pontos');
  assert.deepEqual(soma(await pontos(), antes), [0, 1, 0, 1]);
  await todosApareceram(4); await foto('bandeira-3-fim');
  await semErro('pega-bandeira-festa times');
  console.log('ok pega-bandeira-festa em times: pegou, adversario derrubou pelo toque no A, o time com mais pontos venceu');

  // ---------- 5. batata-festa em times
  antes = await pontos();
  await comeca('batata-festa', 'batata-0-explicacao');
  await anda(fones, 2500, (i, k) => roda(i, k));
  await foto('batata-1-comeco'); await foto('batata-celular-j1', fones[0]);
  await ev(() => { window.__p.dados.pavio = 60; });          // o estouro nao acontece sozinho antes do print do meio
  await anda(fones, 3000, (i, k) => roda(i, k, 2));
  assert.ok(await ev(() => window.__p.dados.com >= 0), 'alguem esta com a batata');
  await ev(() => { const d = window.__p.dados; d.pavioMax = 5; d.pavio = 1.8; });       // batata quase estourando, para o print
  await todosApareceram(4); await foto('batata-2-meio-com-batata');
  await ev(() => { window.__p.dados.pavio = 60; window.__p.dados.pavioMax = 60; });
  const vidas0 = await ev(() => window.__p.dados.vidas.reduce((a, b) => a + b, 0));
  await ev(() => { window.__p.dados.pavio = 0.01; });
  await espera(350); await foto('batata-2b-meio-estouro');
  await tela.waitForFunction(v => window.__p.dados.vidas.reduce((a, b) => a + b, 0) === v - 1, vidas0, { timeout: 3000 });
  await ev(() => { const p = window.__p; p.dados.vidas = [2, 1, 2, 1]; p.dados.pausa = 99; p.t = p.jogo.duracao - 0.6; });
  await termina();
  assert.equal(await vencedor(), 0, 'time A com 4 vidas contra 2');
  assert.deepEqual(soma(await pontos(), antes), [1, 0, 1, 0]);
  await foto('batata-3-fim');
  await semErro('batata-festa times');
  console.log('ok batata-festa em times: batata, estouro tirou 1 vida, o time com mais vidas venceu');

  // ---------- 6. corrida-revezamento
  antes = await pontos();
  await comeca('corrida-revezamento', 'corrida-0-explicacao');
  await anda(fones, 2500, i => (i < 2 ? [62, 0] : [-62, 0]));         // J1 e J2 correm para a direita; J3 e J4 tentam sair da zona e nao conseguem
  await foto('corrida-1-comeco'); await foto('corrida-celular-j3', fones[2]);
  assert.ok(await ev(() => window.__p.jogadores[2].x > 6.5 && window.__p.jogadores[3].x > 6.5), 'J3 e J4 continuam presos na zona');
  await ev(() => { const p = window.__p; Object.assign(p.jogadores[0], { x: 6.4, z: -3.8, vx: 0, vz: 0 }); });
  await tela.waitForFunction(() => window.__p.dados.trecho[0] === 1, null, { timeout: 4000 });       // J1 encostou em J3: o bastao passou
  await ev(() => { const p = window.__p; p.dados.trecho = [3, 2]; Object.assign(p.jogadores[0], { x: -7.5, z: -3.8 }); Object.assign(p.jogadores[2], { x: -2, z: -3.5 }); Object.assign(p.jogadores[1], { x: 3, z: 3.5 }); Object.assign(p.jogadores[3], { x: 8.2, z: 3.5 }); });
  await espera(600); await todosApareceram(4);
  await foto('corrida-2-meio');
  await ev(() => { const p = window.__p; p.dados.trecho[1] = 6; Object.assign(p.jogadores[1], { x: 7.4, z: 3.8, vx: 0, vz: 0 }); });
  await termina();
  assert.equal(await vencedor(), 1, 'o time B completou os sete trechos');
  assert.deepEqual(soma(await pontos(), antes), [0, 1, 0, 1]);
  await todosApareceram(4); await foto('corrida-3-fim');
  await semErro('corrida-revezamento');
  console.log('ok corrida-revezamento em times: parceiro preso na zona, bastao passou ao encostar, time B completou a prova');

  // =================================================== 3 celulares, todos contra todos
  await fones[3].ctx.close(); fones.pop();
  await tela.waitForFunction(() => window.__sala().seguidos === 3, null, { timeout: 8000 });
  await escolheModo('vs', 3);

  // ---------- pega-bandeira-festa em vs com 3
  antes = await pontos();
  await comeca('pega-bandeira-festa', 'bandeira-vs3-0-explicacao');
  await anda(fones, 2500, (i, k) => roda(i, k));
  await foto('bandeira-vs3-1-comeco');
  await ev(() => { const p = window.__p, b = p.dados.bandeira; Object.assign(p.jogadores[2], { x: b.x + 0.4, z: b.z, vx: 0, vz: 0 }); });
  await espera(1800); await foto('bandeira-vs3-2-meio');
  await ev(() => { const p = window.__p; p.dados.pontos = [5, 9, 16]; p.t = p.jogo.duracao - 0.6; });
  await termina();
  assert.equal(await vencedor(), 2);
  assert.deepEqual(soma(await pontos(), antes), [0, 0, 1], 'so o vencedor pontua');
  await foto('bandeira-vs3-3-fim');
  await semErro('pega-bandeira-festa vs 3');
  console.log('ok pega-bandeira-festa em vs com 3: so o vencedor pontua');

  // ---------- batata-festa em vs com 3
  antes = await pontos();
  await comeca('batata-festa', 'batata-vs3-0-explicacao');
  await anda(fones, 2500, (i, k) => roda(i, k));
  await foto('batata-vs3-1-comeco');
  await ev(() => { window.__p.dados.pavio = 60; });
  await anda(fones, 2500, (i, k) => roda(i, k, 1));
  await ev(() => { const d = window.__p.dados; d.pavioMax = 5; d.pavio = 2.5; });
  await foto('batata-vs3-2-meio');
  await ev(() => { const p = window.__p; p.dados.vidas = [1, 2, 1]; p.dados.pausa = 99; p.dados.com = -1; p.t = p.jogo.duracao - 0.6; });
  await termina();
  assert.equal(await vencedor(), 1);
  assert.deepEqual(soma(await pontos(), antes), [0, 1, 0]);
  await foto('batata-vs3-3-fim');
  await semErro('batata-festa vs 3');
  console.log('ok batata-festa em vs com 3: o jogador com mais vidas venceu');

  const finais = await ev(() => window.__p.erros);
  assert.deepEqual(finais, [], 'sem erros dos minijogos');
  assert.deepEqual(erros, [], 'zero erros de console: ' + erros.join(' | '));
  console.log('ok zero erros de console e de pagina');
  await browser.close();
  console.log('TUDO OK');
})().catch(async e => {
  console.error('FALHOU:', e.stack || e.message); console.error(erros);
  try { console.error('estado:', JSON.stringify(await Promise.race([globalThis.__estado?.(), espera(5000).then(() => 'tela sem resposta em 5 s')]))); } catch (x) { console.error('estado indisponivel:', x.message.slice(0, 100)); }
  try { await browser?.close(); } catch {}
  process.exit(1);
});
