// Teste de ponta a ponta do modo Festa (2 a 4 jogadores): tela do PC + celulares com toque, Chromium sem janela (headless com GPU).
// Uso: PORT=8152 node server.js (em outro terminal) e depois URL_JOGO=http://localhost:8152 node teste-festa.js
// Salva os prints em fotos-festa/. O Classico com 2 continua coberto pelo teste-boost.js (rode os dois).
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.env.URL_JOGO || 'http://localhost:8152';
const FOTOS = path.join(__dirname, 'fotos-festa');
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
  // A tela do PC precisa ficar na frente: pagina em segundo plano para de desenhar quadros (como no teste-boost).
  const frente = () => tela.bringToFront();
  const foto = async (nome, alvo = tela) => { if (alvo === tela) await frente(); await alvo.screenshot({ path: path.join(FOTOS, nome + '.png') }); await frente(); console.log('  print ' + nome); };
  const fase = f => tela.waitForFunction(x => window.__p.fase === x, f, { timeout: 30000 });
  const estado = () => ev(() => ({ fase: window.__p.fase, t: window.__p.t, jogo: window.__p.jogo.id, modo: window.__p.modo, n: window.__p.n, erros: window.__p.erros, sala: window.__sala() }));
  globalThis.__estado = estado;
  const fones = [];
  const toque = (page, type, x, y) => page.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });

  // O joystick de cada celular anda na direcao que "dir(i, k)" devolve (dx, dy, de -60 a 60) por "ms" milissegundos.
  async function anda(lista, ms, dir) {
    await Promise.all(lista.map((f, i) => toque(f, 'touchStart', 150, 220)));
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
    await f.waitForFunction(() => document.getElementById('btG').textContent === 'Entendi' && getComputedStyle(document.getElementById('botao')).display !== 'none', null, { timeout: 15000 });
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      await f.locator('#btG').tap();
      await frente();
      try { await tela.waitForFunction(k => window.__p.jogadores[k].pronto || window.__p.fase !== 'intro', i, { timeout: 1500 }); return; } catch {}
    }
    throw new Error('PRONTO nao chegou do jogador ' + (i + 1));
  }
  // Comeca a rodada de um minijogo e espera todos apertarem PRONTO. Devolve quando a rodada esta valendo.
  // Quem perdeu a rodada anterior recebe a oferta de carta: sem "comCartas" o teste dispensa a oferta (o assunto da etapa e outro).
  async function comeca(id, fotoExplica, comCartas = false) {
    await tela.waitForFunction(() => ['intro', 'resultado', 'fim'].includes(window.__p.fase) || window.__p.fase === 'jogando', null, { timeout: 30000 });
    await ev(x => window.__jogo(x), id);
    await tela.waitForFunction(x => window.__p.jogo.id === x && window.__p.fase === 'intro', id, { timeout: 5000 });
    if (!comCartas) await ev(() => { for (const j of window.__p.jogadores) { j.oferta = null; j.direito = false; } });
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
  // com a imunidade ligada pelo teste o boneco pisca: o print espera um quadro em que todos aparecem
  const todosApareceram = n => tela.waitForFunction(k => window.__bonecos.slice(0, k).every(b => b.visible), n, { timeout: 5000 });
  const pontos = () => ev(() => window.__p.jogadores.map(j => j.pontos));
  const soma = (a, b) => a.map((v, i) => v - b[i]);       // pontos ganhos desde "antes"
  const cartoes = () => tela.locator('#placar .cartao').count();
  const visiveis = () => ev(() => window.__bonecos.filter(b => b.visible).length);

  // =================================================== 1. quatro celulares escolhem os lugares 1 a 4
  fones.push(await celular(browser, 1), await celular(browser, 2), await celular(browser, 3)); await frente();
  await tela.waitForFunction(() => window.__sala().seguidos === 3, null, { timeout: 8000 });
  await fones[0].locator('#menu').waitFor({ state: 'visible' });
  assert.equal(await fones[0].locator('#menuLista button[data-m=times]').getAttribute('aria-disabled'), 'true', 'times 2x2 desabilitado com 3 conectados');
  assert.equal(await fones[0].locator('#menuLista button[data-m=vs]').getAttribute('aria-disabled'), 'false');
  console.log('ok 3 conectados: o menu do Jogador 1 mostra o times 2x2 desabilitado');
  fones.push(await celular(browser, 4)); await frente();
  await tela.waitForFunction(() => window.__sala().seguidos === 4, null, { timeout: 8000 });
  await fones[0].locator('#menuLista button[data-m=times][aria-disabled=false]').waitFor({ timeout: 4000 });
  const chips = await tela.locator('#espera .chip b.ok').count();
  assert.equal(chips, 4, 'os 4 conectados aparecem na espera');
  assert.deepEqual(await ev(() => window.__cores.slice()), [0, 1, 2, 3], 'cores padrao: azul, rosa, verde, amarelo');
  assert.equal(await ev(() => [0, 1, 2, 3].some(a => [0, 1, 2, 3].some(b => a < b && window.__mesmaCor(a, b)))), false, 'nenhuma cor padrao e parecida com outra (par PARECIDAS)');
  assert.equal(await ev(() => window.__sala().iniciou), false, 'com 4 conectados nada comeca sozinho');
  await espera(1200);
  await foto('01-espera-4-conectados');
  await foto('02-menu-celular-j1', fones[0]);
  assert.equal(await fones[1].locator('#menu').isVisible(), false, 'so o Jogador 1 tem o menu');
  console.log('ok 4 celulares em 1 a 4; cores padrao diferentes; menu so no Jogador 1; times habilitado com 4');

  // =================================================== 2. J1 escolhe times 2x2 e comeca
  await fones[0].locator('#menuLista button[data-m=times]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'times', null, { timeout: 4000 });
  await espera(700);
  await foto('03-espera-modo-times');
  await foto('04-menu-celular-times-escolhido', fones[0]);
  assert.ok((await tela.locator('#modoEsp').textContent()).includes('Duplas'));
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  let e = await estado();
  assert.equal(e.modo, 'times'); assert.equal(e.n, 4);
  if (!(await ev(() => !!window.__p.jogo.festa))) {       // Duplas tambem sorteia os de 2 (revezamento): estas checagens sao da rodada com os 4
    await ev(() => window.__jogo('tinta-festa'));
    await tela.waitForFunction(() => window.__p.jogo.id === 'tinta-festa' && window.__bonecos.filter(b => b.visible).length === 4, null, { timeout: 5000 });
  }
  assert.equal(await cartoes(), 4, 'placar com 4 cartoes');
  assert.equal(await tela.locator('#placar .cartao.time').count(), 4, 'em times cada cartao tem a cor do time');
  assert.equal(await tela.locator('#placar .lado').count(), 2, 'dois cartoes de cada lado');
  assert.equal(await visiveis(), 4, '4 bonecos na arena');
  assert.equal(await ev(() => window.__bonecos.filter(b => b.userData.anelTime.visible).length), 4, 'anel do time no chao de cada um');
  console.log('ok J1 escolheu times 2x2 e comecou: 4 cartoes com cor de time, 4 bonecos e aneis de time');
  await ev(() => { window.__p.modificadores = false; });

  // =================================================== 3. tinta-festa em times
  await comeca('tinta-festa', '05-placar-4-times-explicacao');
  await anda(fones, 2500, (i, k) => roda(i, k));
  await foto('tinta-festa-1-comeco'); await foto('tinta-festa-celular-j3', fones[2]);
  await anda(fones, 9000, (i, k) => roda(i, k, 2));
  const pl = await tela.locator('#rodadaPl').textContent();
  assert.ok(/%/.test(pl), 'o placar ao vivo mostra a porcentagem: ' + pl);
  const parcial = await ev(() => window.__p.dados.placar);
  assert.ok(parcial.length === 2 && parcial[0] + parcial[1] > 10, 'quem passou pintou: ' + parcial);
  await foto('tinta-festa-2-meio');
  await ev(() => { window.__p.t = window.__p.jogo.duracao - 0.6; });
  await termina();
  e = await ev(() => ({ v: window.__p.vencedor, pts: window.__p.jogadores.map(j => j.pontos), cor: window.__p.dados.conta }));
  assert.ok([0, 1, -1].includes(e.v));
  if (e.v >= 0) assert.deepEqual(e.pts, e.v === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1], 'os dois do time pontuam');
  await foto('tinta-festa-3-fim');
  await semErro('tinta-festa');
  console.log(`ok tinta-festa em times: vencedor ${e.v}, areas ${e.cor.join(' x ')}, pontos ${e.pts.join(',')}`);

  // =================================================== 4. sumo-vidas em times
  let antes = await pontos();
  await comeca('sumo-vidas');
  // cada um anda em volta da arena (tangente a roda), sem se amontoar no centro
  const emVolta = n => i => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [-Math.sin(a) * 28, Math.cos(a) * 28]; };
  await espera(500);
  await foto('sumo-vidas-1-comeco');
  await anda(fones, 1500, emVolta(4));
  await foto('sumo-vidas-celular-j2', fones[1]);
  const v0 = await ev(() => window.__p.dados.vidas[1]);
  await ev(() => { const p = window.__p; Object.assign(p.jogadores[1], { x: p.arena.raio + 3, z: 0, vx: 0, vz: 0 }); });
  await tela.waitForFunction(v => window.__p.dados.vidas[1] === v - 1, v0, { timeout: 3000 });
  await tela.waitForFunction(() => window.__p.jogadores.every(j => j.vivo), null, { timeout: 8000 });       // o que caiu voltou em 2 s
  assert.ok(await ev(() => Math.hypot(window.__p.jogadores[1].x, window.__p.jogadores[1].z) < 9), 'voltou para a arena');
  await espera(900);
  await foto('sumo-vidas-2-meio');
  assert.ok((await tela.locator('#placar .extras').allTextContents()).some(t => /Vidas/.test(t)), 'vidas aparecem no HUD');
  await ev(() => { const p = window.__p; p.dados.vidas = [3, 1, 3, 2]; p.t = p.jogo.duracao - 0.6; });
  await termina();
  e = await ev(() => ({ v: window.__p.vencedor, vidas: window.__p.dados.vidas, pts: window.__p.jogadores.map(j => j.pontos) }));
  assert.equal(e.v, 0, 'o time A tem mais vidas');
  assert.deepEqual(soma(e.pts, antes), [1, 0, 1, 0], 'os dois do time A pontuam');
  await foto('sumo-vidas-3-fim');
  await semErro('sumo-vidas');
  console.log('ok sumo-vidas em times: caiu, voltou em 2 s, o time com mais vidas venceu');

  // =================================================== 5. futebol-times
  antes = await pontos();
  await comeca('futebol-times');
  await anda(fones, 3000, i => [i % 2 ? -60 : 60, (i < 2 ? -1 : 1) * 25]);
  await foto('futebol-times-1-comeco');
  await foto('futebol-times-celular-j4', fones[3]);
  const g0 = await ev(() => window.__p.dados.placar[0]);
  await ev(() => { const b = window.__p.dados.bola; Object.assign(b, { x: 8, z: 0.5, vx: 11, vz: 0 }); });
  await tela.waitForFunction(g => window.__p.dados.placar[0] === g + 1, g0, { timeout: 4000 });
  await espera(500);
  await foto('futebol-times-2-meio-gol');
  assert.ok(await ev(() => window.__p.dados.saque > 0 || window.__p.dados.aviso !== ''), 'saque depois do gol');
  await espera(2200);
  await foto('futebol-times-2b-meio-saque-depois');
  await ev(() => { const p = window.__p; p.dados.placar = [2, 1]; p.t = p.jogo.duracao - 0.6; });
  await termina();
  e = await ev(() => ({ v: window.__p.vencedor, placar: window.__p.dados.placar, pts: window.__p.jogadores.map(j => j.pontos) }));
  assert.equal(e.v, 0, 'o time A estava na frente: ' + e.placar);
  assert.deepEqual(soma(e.pts, antes), [1, 0, 1, 0], 'os dois do time A pontuam');
  await foto('futebol-times-3-fim');
  await semErro('futebol-times');
  console.log(`ok futebol-times: gol no placar ${e.placar.join(' x ')}, fim por tempo, time A venceu`);

  // =================================================== 5b. Duplas com minijogo de 2: um de cada dupla joga, o parceiro torce
  for (const id of ['sumo', 'bomba', 'kart']) {
    antes = await pontos();
    await comeca(id, `duelo-${id}-1-explicacao`);
    const d = await ev(() => window.__p.duelo);
    assert.ok(Array.isArray(d) && d.length === 2 && d[0] % 2 === 0 && d[1] % 2 === 1, `${id}: duelo com um de cada dupla: ${d}`);
    assert.equal(await ev(() => window.__p.jogadores.length), 4, 'a partida segue com os 4');
    assert.equal(await cartoes(), 4, 'o placar continua com os 4');
    await tela.waitForFunction(d => window.__bonecos.every((b, i) => b.visible === d.includes(i)), d, { timeout: 5000 }).catch(() => {});
    assert.deepEqual(await ev(() => window.__bonecos.flatMap((b, i) => b.visible ? [i] : [])), [...d].sort(), 'so os dois da vez na arena');
    const fora = [0, 1, 2, 3].filter(i => !d.includes(i));
    for (const i of fora) await fones[i].waitForFunction(() => document.body.innerText.includes('Daqui você torce'), null, { timeout: 5000 });
    await anda(d.map(i => fones[i]), 2500, (i, k) => roda(i, k));
    await foto(`duelo-${id}-2-meio`);
    await foto(`duelo-${id}-3-celular-de-fora-j${fora[0] + 1}`, fones[fora[0]]);
    await foto(`duelo-${id}-4-celular-da-vez-j${d[0] + 1}`, fones[d[0]]);
    await ev(() => { const p = window.__p; p.t = Math.max(p.t, (p.jogo.duracao || 60) - 0.4); });
    await ev(() => { const p = window.__p; if (window.__p.jogo.id === 'sumo') { p.dados.placar = [1, 0]; p.t = 6; p.jogadores[p.duelo[1]].vivo = false; } });
    await tela.waitForFunction(() => ['resultado', 'fim'].includes(window.__p.fase), null, { timeout: 80000 });
    await espera(900);
    const r = await ev(() => ({ v: window.__p.vencedor, pts: window.__p.jogadores.map(j => j.pontos) }));
    if (id === 'sumo') assert.equal(r.v, 0, 'sumo: o da vez do time laranja derrubou o rival');
    if (r.v >= 0) assert.deepEqual(soma(r.pts, antes), r.v === 0 ? [1, 0, 1, 0] : [0, 1, 0, 1], `${id}: ponto para os dois da dupla`);
    await foto(`duelo-${id}-5-fim`);
    await semErro('duelo ' + id);
    console.log(`ok ${id} em Duplas: J${d[0] + 1} contra J${d[1] + 1}, parceiros torcendo, vencedor ${r.v}, pontos ${r.pts.join(',')}`);
  }

  // =================================================== 6. podio com 4 (um time chega a 10 pontos)
  await ev(() => { for (const i of [0, 2]) window.__p.jogadores[i].pontos = 9; });
  await comeca('tinta-festa');
  await ev(() => { const d = window.__p.dados; d.cor.fill(0); d.conta = [d.cor.length, 0]; window.__p.t = window.__p.jogo.duracao - 0.5; });
  await tela.waitForFunction(() => window.__p.fase === 'fim', null, { timeout: 10000 });
  await tela.locator('#fim.on').waitFor({ timeout: 8000 });
  await espera(900);
  assert.deepEqual(await ev(() => window.__p.campeoes), [0, 2]);
  await foto('06-podio-4-time-campeao');
  console.log('ok o time com 10 pontos fecha a partida e o podio mostra os 4');

  // O coop sorteia entre varios jogos; para as fotos dos zumbis, forca o zumbis-coop mantendo modo e jogadores
  async function zumbisNoCoop(n) {
    await tela.waitForFunction(() => { if (window.__p.jogo?.id !== 'zumbis-coop') window.__jogo('zumbis-coop'); return window.__p.jogo?.id === 'zumbis-coop'; }, null, { timeout: 30000, polling: 500 });
    const e = await estado();
    assert.deepEqual([e.modo, e.n, e.jogo], ['coop', n, 'zumbis-coop']);
    return e;
  }
  // =================================================== 7. zumbis em coop com 4
  await tela.keyboard.press('KeyV');
  await tela.locator('#espera').waitFor({ state: 'visible' });
  await fones[0].locator('#menuLista button[data-m=coop]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'coop', null, { timeout: 4000 });
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  e = await estado();
  assert.ok(e.modo === 'coop' && e.n === 4 && e.jogo.endsWith('-coop'), 'em coop com 4 so sai jogo coop: ' + e.jogo);
  e = await zumbisNoCoop(4);
  assert.equal(await tela.locator('#placar .cartao.time').count(), 0, 'sem cor de time fora do modo times');
  await tela.waitForFunction(() => window.__p.fase === 'intro');
  await espera(600); await foto('zumbis-coop-0-explicacao');
  for (let i = 0; i < 4; i++) await prontoDe(i);
  await fase('jogando');
  await anda(fones, 3500, (i, k) => roda(i, k));
  await foto('zumbis-coop-4-1-comeco'); await foto('zumbis-coop-celular-j1', fones[0]);
  await ev(() => { const d = window.__p.dados; d.imune = d.imune.map(() => 99); });       // a rodada nao acaba antes do print do meio
  await anda(fones, 9500, (i, k) => roda(i, k, 3));
  // a 2a onda sai aos 12,5 s de jogo; com a maquina carregada o jogo anda mais devagar que o relogio do teste
  assert.ok(await tela.waitForFunction(() => window.__p.dados.zumbis.length >= 4, null, { timeout: 15000 }).then(() => true, () => false), 'zumbis em campo');
  await todosApareceram(4); await foto('zumbis-coop-4-2-meio');
  await ev(() => { const p = window.__p, d = p.dados; p.t = p.jogo.duracao - 0.6; d.caido[0] = false; d.imune = d.imune.map(() => 99); });       // pelo menos um em pe aos 45 s: vitoria de todos
  await termina();
  e = await ev(() => ({ v: window.__p.vencedor, pts: window.__p.jogadores.map(j => j.pontos) }));
  assert.equal(e.v, 2); assert.deepEqual(e.pts, [1, 1, 1, 1]);
  await todosApareceram(4); await foto('zumbis-coop-4-3-fim');
  await semErro('zumbis-coop 4');
  console.log('ok zumbis-coop com 4: vitoria de todos, 1 ponto para cada');

  // =================================================== 8. 3 jogadores, todos contra todos
  await fones[3].ctx.close(); fones.pop();
  await tela.waitForFunction(() => window.__sala().seguidos === 3, null, { timeout: 8000 });
  await tela.keyboard.press('KeyV');
  await tela.locator('#espera').waitFor({ state: 'visible' });
  assert.equal(await fones[0].locator('#menuLista button[data-m=times]').getAttribute('aria-disabled'), 'true');
  await fones[0].locator('#menuLista button[data-m=vs]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'vs', null, { timeout: 4000 });
  await foto('07-espera-3-conectados-vs');
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  e = await estado();
  assert.deepEqual([e.modo, e.n], ['vs', 3]);
  if (!(await ev(() => !!window.__p.jogo.festa))) await ev(() => window.__jogo('tinta-festa'));       // com 3 tambem saem os de 2 (revezamento): estas checagens sao da rodada com os 3
  await tela.waitForFunction(() => window.__p.jogo.id === 'tinta-festa' && window.__bonecos.filter(b => b.visible).length === 3, null, { timeout: 5000 });
  assert.equal(await cartoes(), 3); assert.equal(await visiveis(), 3);
  assert.equal(await tela.locator('#placar .cartao.time').count(), 0);
  await comeca('tinta-festa', '08-placar-3-vs-explicacao');
  await anda(fones, 3000, (i, k) => roda(i, k));
  await foto('tinta-festa-vs3-1-comeco');
  await anda(fones, 6000, (i, k) => roda(i, k, 1));
  await foto('tinta-festa-vs3-2-meio');
  await ev(() => { window.__p.t = window.__p.jogo.duracao - 0.6; });
  await termina();
  e = await ev(() => ({ v: window.__p.vencedor, placar: window.__p.dados.placar, pts: window.__p.jogadores.map(j => j.pontos) }));
  assert.ok(e.v >= -1 && e.v <= 2);
  if (e.v >= 0) assert.equal(e.pts[e.v], 1, 'so o vencedor pontua');
  await foto('tinta-festa-vs3-3-fim');
  // cartas de poder na Festa: quem perdeu escolhe uma carta no celular antes da rodada seguinte
  if (e.v >= 0) {
    const perdeu = [0, 1, 2].filter(i => i !== e.v);
    assert.deepEqual(await ev(() => window.__p.jogadores.map(j => j.direito)), [0, 1, 2].map(i => i !== e.v), 'quem perdeu tem direito a carta');
    await ev(() => window.__jogo('sumo-vidas'));       // ainda no resultado: a rodada seguinte e a que entrega a oferta
    await tela.waitForFunction(k => window.__p.jogo.id === 'sumo-vidas' && window.__p.jogadores[k].oferta?.length > 0, perdeu[0], { timeout: 5000 });
    assert.equal(await ev(k => window.__p.jogadores[k].oferta, e.v), null, 'quem venceu nao escolhe carta');
    await ev(() => { for (const j of window.__p.jogadores) if (j.oferta) j.oferta = ['dobro', 'turbo', 'moedas']; });
    const f = fones[perdeu[0]];
    await f.locator('#opcoes button.carta', { hasText: 'Vale dobro' }).waitFor({ timeout: 5000 });
    await foto('cartas-festa-1-oferta-celular', f); await foto('cartas-festa-2-tv-escolhendo');
    await f.locator('#opcoes button.carta', { hasText: 'Turbo' }).tap(); await frente();
    await tela.waitForFunction(k => window.__p.jogadores[k].carta === 'turbo', perdeu[0], { timeout: 4000 });
    await ev(k => { window.__p.jogadores[k].oferta = null; }, perdeu[1]);
    for (let i = 0; i < fones.length; i++) await prontoDe(i);
    await fase('jogando');
    await espera(600); await foto('cartas-festa-3-tv-com-carta');
    assert.ok((await tela.locator('#placar .chipCarta').allTextContents()).some(t => /Turbo/.test(t)), 'a carta ativa aparece no cartao do jogador');
    console.log(`ok cartas na Festa: J${perdeu[0] + 1} perdeu, escolheu Turbo no celular e a carta apareceu na TV`);
  }
  await comeca('sumo-vidas');
  await espera(500); await foto('sumo-vidas-vs3-1-comeco');
  await anda(fones, 1500, i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return [-Math.sin(a) * 40, Math.cos(a) * 40]; });
  await foto('sumo-vidas-vs3-2-meio');
  await ev(() => { const p = window.__p; for (let k = 0; k < 3; k++) p.dados.vidas[k] = k === 2 ? 3 : 1; p.t = p.jogo.duracao - 0.6; });
  await termina();
  assert.equal(await ev(() => window.__p.vencedor), 2, 'o jogador 3 tinha mais vidas');
  await semErro('vs 3');
  console.log('ok partida de 3 em todos contra todos: placar com 3, tinta e sumo, so o vencedor pontua');

  // =================================================== 9. 2 jogadores, cooperativo
  await fones[2].ctx.close(); fones.pop();
  await tela.waitForFunction(() => window.__sala().seguidos === 2, null, { timeout: 8000 });
  await tela.keyboard.press('KeyV');
  await tela.locator('#espera').waitFor({ state: 'visible' });
  await fones[0].locator('#menuLista button[data-m=coop]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'coop', null, { timeout: 4000 });
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  e = await estado();
  assert.ok(e.modo === 'coop' && e.n === 2 && e.jogo.endsWith('-coop'), 'em coop com 2 so sai jogo coop: ' + e.jogo);
  e = await zumbisNoCoop(2);
  await tela.waitForFunction(() => window.__p.fase === 'intro');
  for (let i = 0; i < 2; i++) await prontoDe(i);
  await fase('jogando');
  await anda(fones, 4000, (i, k) => roda(i, k, 1));
  await todosApareceram(2); await foto('zumbis-coop-2-1-comeco');
  await ev(() => { const d = window.__p.dados; d.imune = d.imune.map(() => 99); });       // a rodada nao acaba antes do print do meio
  await anda(fones, 6000, (i, k) => roda(i, k, 4));
  await todosApareceram(2); await foto('zumbis-coop-2-2-meio');
  await ev(() => { const p = window.__p, d = p.dados; p.t = p.jogo.duracao - 0.6; d.caido[0] = false; d.imune = d.imune.map(() => 99); });
  await termina();
  assert.equal(await ev(() => window.__p.vencedor), 2);
  assert.deepEqual(await ev(() => window.__p.jogadores.map(j => j.pontos)), [1, 1]);
  await todosApareceram(2); await foto('zumbis-coop-2-3-fim');
  await semErro('coop 2');
  console.log('ok partida de 2 em cooperativo: zumbis, vitoria de todos');

  // =================================================== 10. o Classico com 2 continua funcionando
  await tela.keyboard.press('KeyV');
  await tela.locator('#espera').waitFor({ state: 'visible' });
  await fones[0].locator('#menuLista button[data-m=classico]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'classico', null, { timeout: 4000 });
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  e = await estado();
  assert.deepEqual([e.modo, e.n], ['classico', 2]);
  assert.ok(await ev(() => !window.__p.jogo.festa), 'o Classico nao sorteia minijogo de festa');
  await ev(() => { window.__p.modificadores = false; });
  await comeca('sumo');
  await ev(() => { window.__p.dados.placar = [1, 0]; window.__p.jogadores[1].vivo = false; });       // melhor de 3 quedas: a decisiva so encerra depois de 5 s de jogo
  await tela.waitForFunction(() => window.__p.fase === 'resultado', null, { timeout: 12000 });
  assert.deepEqual(await ev(() => window.__p.jogadores.map(j => j.pontos)), [1, 0]);
  assert.equal(await cartoes(), 2);
  assert.equal(await tela.locator('#placar .lado').count(), 0, 'no Classico o placar e o de sempre');
  await espera(700); await foto('09-classico-2-continua-igual');
  // o que um minijogo faz no boneco (escala, giro) nao passa para a rodada seguinte
  await ev(() => { const b = window.__bonecos[0]; b.scale.setScalar(0.4); b.rotation.z = 1.2; window.__jogo('sumo'); });
  await tela.waitForFunction(() => window.__bonecos[0].scale.x === 1 && window.__bonecos[0].rotation.z === 0, null, { timeout: 8000 });
  console.log('ok o boneco volta ao normal na rodada seguinte');
  // sorteia varias rodadas do Classico: nunca cai minijogo de festa
  for (let k = 0; k < 14; k++) { await tela.keyboard.press('KeyN'); await espera(100); assert.ok(await ev(() => !window.__p.jogo.festa), 'o Classico sorteou ' + await ev(() => window.__p.jogo.id)); }       // N pula para o proximo da rotacao
  await semErro('classico');
  console.log('ok Classico com 2: partida, ponto, placar de sempre e nenhum minijogo de festa na rotacao');

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
