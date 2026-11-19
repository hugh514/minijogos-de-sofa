// Teste de texto cru: joga rodadas com perfis que tem nome e le o texto da TV e dos celulares a cada meio segundo.
// Falha se aparecer undefined, NaN, null, "[object", '{"', "Jogador N" (todos os perfis tem nome) ou id de minijogo (corrida-dedos).
// Uso: PORT=8191 node server.js (em outro terminal) e depois URL_JOGO=http://localhost:8191 node teste-textos.js
// Salva os prints de cada tela mexida em fotos-textos/.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.env.URL_JOGO || 'http://localhost:8191';
const FOTOS = path.join(__dirname, 'fotos-textos');
fs.mkdirSync(FOTOS, { recursive: true });
const NOMES = ['Ana', 'Bia', 'Caio', 'Duda'];
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
  const ids = await ev(() => window.__ids());
  const comHifen = ids.filter(id => id.includes('-'));       // id de uma palavra so (sumo, cofre, igual) e palavra de verdade: nao da para cobrar

  // celular com os 4 perfis salvos (o mesmo aparelho da casa): a escolha do lugar mostra os nomes
  async function celular(n, comNome = true) {
    const ctx = await browser.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true });
    if (comNome) await ctx.addInitScript(nomes => nomes.forEach((nome, k) => localStorage.setItem('perfil' + (k + 1), JSON.stringify({ nome }))), NOMES);
    const page = await ctx.newPage();
    page.on('pageerror', e => erros.push(`celular ${n}: ${e}`));
    page.on('console', m => { if (m.type() === 'error') erros.push(`celular ${n}: ${m.text()}`); });
    await page.goto(URL + '/c', { timeout: 90000 });
    page.ctx = ctx;
    return page;
  }
  const fones = [];
  const RUIM = /\bundefined\b|\bNaN\b|\bnull\b|\[object|\{"/;
  async function confere(rotulo) {
    const textos = [['TV', await tela.evaluate(() => document.body.innerText)]];
    for (const [k, f] of fones.entries()) textos.push(['celular ' + (k + 1), await f.evaluate(() => document.body.innerText)]);
    for (const [onde, t] of textos) {
      const cru = t.match(RUIM);
      assert.ok(!cru, `${rotulo}: ${onde} mostra "${cru?.[0]}" em: ${t.slice(Math.max(0, cru?.index - 60), cru?.index + 60)}`);
      const jog = t.match(/\bJogador [1-4]\b/);
      assert.ok(!jog, `${rotulo}: ${onde} mostra "${jog?.[0]}" com perfil de nome: ${t.slice(Math.max(0, jog?.index - 60), jog?.index + 60)}`);
      const id = comHifen.find(x => new RegExp(`(^|[^\\w-])${x}($|[^\\w-])`).test(t));
      assert.ok(!id, `${rotulo}: ${onde} mostra o id "${id}"`);
    }
  }
  const amostra = async (rotulo, vezes = 4) => { for (let k = 0; k < vezes; k++) { await confere(rotulo); await espera(500); } };
  // fora da rodada (explicacao, pausa sem rodada, podio) nao sobra inventario, selo nem placar do minijogo anterior
  const semSobra = async rotulo => {
    const s = await ev(() => ({ inv: document.querySelectorAll('#placar .inv').length, selo: document.getElementById('selo').textContent, pl: document.getElementById('rodadaPl').textContent }));
    assert.deepEqual(s, { inv: 0, selo: '', pl: '' }, rotulo + ': sobrou coisa do minijogo na tela');
  };
  const fase = (f, timeout = 30000) => tela.waitForFunction(x => window.__p.fase === x, f, { timeout });
  const posta = (f, rota, corpo) => f.evaluate(([r, c]) => fetch(r, { method: 'POST', body: JSON.stringify(c) }), [rota, corpo]);
  async function entendi(i) {
    if (await ev(k => window.__p.jogadores[k].pronto, i)) return;
    const f = fones[i];
    await f.waitForFunction(() => document.getElementById('btG').textContent === 'Entendi' && getComputedStyle(document.getElementById('botao')).display !== 'none', null, { timeout: 15000 });
    for (let t = 0; t < 5; t++) {
      await f.locator('#btG').tap(); await frente();
      try { await tela.waitForFunction(k => window.__p.jogadores[k].pronto || window.__p.fase !== 'intro', i, { timeout: 1500 }); return; } catch {}
    }
    throw new Error('Entendi nao chegou do lugar ' + (i + 1));
  }
  async function rodada(id, n, fotos) {
    await tela.waitForFunction(() => ['intro', 'jogando', 'resultado', 'fim'].includes(window.__p.fase), null, { timeout: 30000 });
    await ev(x => window.__jogo(x), id);
    await tela.waitForFunction(x => window.__p.jogo.id === x && window.__p.fase === 'intro', id, { timeout: 5000 });
    await espera(900);
    await confere(id + ' explicacao'); await semSobra(id + ' explicacao');
    if (fotos) { await foto('tv-explicacao'); await foto('cel-explicacao', fones[1]); }
    for (let i = 0; i < n; i++) {
      await entendi(i);
      if (fotos && i === 0) { await espera(400); await foto('cel-espera-dos-outros', fones[0]); await confere(id + ' espera dos outros'); }
    }
    await fase('jogando');
    await amostra(id + ' rodada');
    if (fotos) { await foto('tv-rodada'); await foto('cel-rodada', fones[0]); }
    assert.deepEqual(await ev(() => window.__p.erros), [], id + ': erro de minijogo');
  }

  // ===== 1. espera: escolha do lugar (com e sem nome), passo do nome, menu do J1 e espera dos outros
  const semNome = await celular(9, false);
  await semNome.locator('#lugares button').first().waitFor();
  await foto('cel-escolha-sem-nome', semNome);
  await semNome.getByRole('button', { name: 'Jogador 4' }).tap();
  await semNome.locator('#nomeIni').waitFor({ state: 'visible' });
  await foto('cel-passo-nome', semNome);
  await semNome.ctx.close();
  for (let n = 1; n <= 4; n++) {
    const f = await celular(n);
    if (n === 2) { await f.locator('#lugares button.ocupado').first().waitFor({ timeout: 3000 }); await foto('cel-escolha', f); }
    await f.getByRole('button', { name: NOMES[n - 1] }).tap();
    fones.push(f);
    if (n === 2) {       // o Duelo comeca sozinho 6 s depois do 2o celular: print da contagem e o J1 ja escolhe Cada um por si
      await fones[0].locator('#menu').waitFor({ state: 'visible' }); await espera(1200);
      await foto('tv-espera-contagem'); await foto('cel-menu-j1', fones[0]);
      await fones[0].locator('#menuLista button[data-m=vs]').tap(); await frente();
      await tela.waitForFunction(() => window.__sala().escolhaModo === 'vs', null, { timeout: 4000 });
    }
  }
  await frente();
  await tela.waitForFunction(() => window.__sala().seguidos === 4, null, { timeout: 8000 });
  await fones[0].locator('#menu').waitFor({ state: 'visible' });
  await espera(1500);
  await amostra('espera');
  await foto('tv-espera'); await foto('cel-menu-j1-vs', fones[0]); await foto('cel-espera', fones[1]);
  console.log('ok espera, escolha do lugar e menu sem texto cru');


  // loja (perfil) de quem espera
  await fones[1].locator('#visual').tap();
  await fones[1].locator('#perfil').waitFor({ state: 'visible' });
  await espera(500); await foto('cel-loja', fones[1]);
  await fones[1].locator('.aba', { hasText: 'Troféus' }).tap(); await espera(700); await foto('cel-trofeus', fones[1]);
  await confere('loja');
  await fones[1].locator('#fechar').tap();
  // ajustes do PC
  await frente(); await tela.keyboard.press('KeyO'); await espera(500); await foto('tv-ajustes'); await confere('ajustes');
  await tela.keyboard.press('KeyO'); await espera(300);

  // ===== 2. Cada um por si com 4: todos os minijogos de festa que cabem
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  const festa = await ev(() => import('/logica.mjs').then(m => m.elegiveis('vs', 4).map(j => j.id)));
  for (const [k, id] of festa.entries()) await rodada(id, 4, k === 0);
  console.log(`ok ${festa.length} minijogos de festa com 4 nomes, sem texto cru: ${festa.join(', ')}`);

  // pausa pedida pelo lugar 2: TV, celular do J1 (com as acoes) e do 2
  await posta(fones[1], '/pausa', { j: 2 });
  await fones[0].locator('#pausaCel').waitFor({ state: 'visible', timeout: 4000 });
  await espera(600);
  await foto('tv-pausa'); await foto('cel-pausa-j1', fones[0]); await foto('cel-pausa-j2', fones[1]);
  await amostra('pausa', 3);
  assert.ok((await tela.locator('#pausaTx').textContent()).startsWith('Bia pediu um tempo'));
  await fones[1].locator('#continuar').tap();
  await fones[0].locator('#pausaCel').waitFor({ state: 'hidden', timeout: 4000 });
  console.log('ok pausa: "Bia pediu um tempo" e Continuar no celular');

  // ===== 3. resultado e podio: uma rodada que acaba sozinha, depois a que fecha a partida
  await ev(() => window.__jogo('sumo-vidas'));
  await tela.waitForFunction(() => window.__p.fase === 'intro', null, { timeout: 5000 });
  for (let i = 0; i < 4; i++) await entendi(i);
  await fase('jogando');
  await ev(() => { const v = window.__p.dados.vidas; for (let k = 1; k < v.length; k++) v[k] = 0; });
  await tela.waitForFunction(() => ['resultado', 'fim'].includes(window.__p.fase), null, { timeout: 60000 });
  await espera(900);
  await foto('tv-resultado'); await foto('cel-resultado', fones[0]); await confere('resultado');
  await tela.waitForFunction(() => window.__p.fase === 'intro', null, { timeout: 15000 });
  const PV = await ev(() => window.__p.alvo);       // o placar final depende de quantos jogam (6 ou 10)
  await ev(n => { for (const j of window.__p.jogadores) j.pontos = n; }, PV - 1);
  await ev(() => window.__jogo('sumo-vidas'));
  await tela.waitForFunction(() => window.__p.fase === 'intro', null, { timeout: 5000 });
  for (let i = 0; i < 4; i++) await entendi(i);
  await fase('jogando');
  await ev(() => { const v = window.__p.dados.vidas; for (let k = 1; k < v.length; k++) v[k] = 0; });
  await fase('fim', 60000);
  await tela.waitForFunction(() => window.__p.t > 2.2, null, { timeout: 8000 });
  await espera(1200);
  await foto('tv-podio'); await foto('cel-podio-j1', fones[0]); await foto('cel-podio-j2', fones[1]);
  await amostra('podio', 3); await semSobra('podio vindo do sumo-vidas (que tem inventario)');
  // pausa durante o podio: o texto continua limpo e o podio segue esperando
  await posta(fones[2], '/pausa', { j: 3 });
  await fones[0].locator('#pausaCel').waitFor({ state: 'visible', timeout: 4000 });
  await espera(500); await foto('tv-podio-pausa'); await amostra('podio em pausa', 3); await semSobra('podio em pausa');
  await fones[2].locator('#continuar').tap();
  await fones[0].locator('#pausaCel').waitFor({ state: 'hidden', timeout: 4000 });
  await fones[1].locator('#opcoes button', { hasText: 'Quero revanche' }).tap();
  await espera(800); await foto('tv-podio-revanche-pedida'); await confere('podio, revanche pedida');
  assert.equal(await ev(() => window.__p.fase), 'fim', 'o podio espera a escolha (nao recomeca sozinho em 7 s)');
  await fones[0].locator('#opcoes button', { hasText: 'Revanche' }).tap();
  await tela.waitForFunction(() => window.__p.fase === 'intro' && window.__p.jogadores.every(j => j.pontos === 0), null, { timeout: 6000 });
  console.log('ok resultado, podio com medalhas e revanche pelo celular do J1');

  // ===== 4. volta ao menu pelo celular do J1 (comando) e Duelo: todos os minijogos do Classico
  await posta(fones[0], '/comando', { j: 1, c: 'menu' });
  await fones[0].locator('#menu').waitFor({ state: 'visible', timeout: 6000 });
  await fones[0].locator('#menuLista button[data-m=classico]').tap();
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  const classico = await ev(() => import('/logica.mjs').then(m => m.elegiveis('classico', 2).map(j => j.id)));
  for (const id of classico) await rodada(id, 2, false);
  console.log(`ok ${classico.length} minijogos do Duelo com nomes, sem texto cru`);

  assert.deepEqual(erros, [], 'erros de console: ' + erros.join(' | '));
  console.log('ok zero erros de console e de pagina');
  console.log('\nTUDO OK (teste-textos)');
  await browser.close();
})().catch(async e => {
  console.error('FALHOU: ' + e.message);
  if (erros.length) console.error(erros);
  await browser?.close();
  process.exit(1);
});
