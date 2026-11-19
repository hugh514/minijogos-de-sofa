// Teste de ponta a ponta das cartas de poder, faixas de arcade, torcida, provocacao, rodada cooperativa e itens do labirinto.
// Tela do PC + dois celulares com toque, navegador visivel.
// Uso: PORT=8150 node server.js (em outro terminal) e depois URL_JOGO=http://localhost:8150 node teste-boost.js
const assert = require('node:assert/strict');
const path = require('path');
let chromium;
({ chromium } = require(process.env.PW || 'playwright'));

const URL = process.env.URL_JOGO || 'http://localhost:8150';
const FOTOS = path.join(__dirname, 'fotos');
const erros = [];
const espera = ms => new Promise(r => setTimeout(r, ms));

async function celular(browser, botao, seed, pos) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([chave, perfil]) => {
    try { if (!localStorage.getItem('semeado')) { localStorage.setItem(chave, JSON.stringify(perfil)); localStorage.setItem('semeado', '1'); } } catch {}
  }, [botao === 'Jogador 1' ? 'perfil1' : 'perfil2', seed]);
  const page = await ctx.newPage();
  page.on('pageerror', e => erros.push(`${botao}: ${e}`));
  page.on('console', m => { if (m.type() === 'error') erros.push(`${botao}: ${m.text()}`); });
  await page.goto(URL + '/c');
  await page.getByRole('button', { name: botao }).tap();
  page.cdp = await ctx.newCDPSession(page);
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-position=40,40', '--window-size=1100,640',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'] });
  const tela = await (await browser.newContext({ viewport: { width: 1100, height: 600 } })).newPage();
  tela.on('pageerror', e => erros.push(`tela: ${e}`));
  tela.on('console', m => { if (m.type() === 'error') erros.push(`tela: ${m.text()}`); });
  await tela.goto(URL);
  await tela.locator('#espera').waitFor({ state: 'visible' });
  const foto = async (nome, alvo = tela) => { if (alvo === tela) await tela.bringToFront(); await alvo.screenshot({ path: path.join(FOTOS, nome + '.png') }); };
  const ev = (fn, arg) => tela.evaluate(fn, arg);
  globalThis.__estado = () => tela.evaluate(() => ({ fase: window.__p.fase, t: window.__p.t, pronto: window.__p.jogadores.map(j => j.pronto), oferta: window.__p.jogadores.map(j => j.oferta), conta: document.getElementById('conta').textContent, jogo: window.__p.jogo.id }));
  const fase = f => tela.waitForFunction(x => window.__p.fase === x, f, { timeout: 20000 });

  const um = await celular(browser, 'Jogador 1', { moedas: 0, pacotes: [0] });
  const dois = await celular(browser, 'Jogador 2', { moedas: 0 });
  const fones = [um, dois];
  await tela.locator('#espera').waitFor({ state: 'hidden' });
  await ev(() => { window.__p.modificadores = false; window.__jogo('sumo'); });      // rodadas previsiveis: sem tempero, sempre sumo
  console.log('ok partida comecou; rodadas de sumo sem modificador');

  async function prontoDe(i) {
    if (await ev(k => window.__p.jogadores[k].pronto, i)) return;      // ja apertou
    const f = fones[i];
    await f.waitForFunction(() => document.getElementById('btG').textContent === 'Entendi' && getComputedStyle(document.getElementById('botao')).display !== 'none', null, { timeout: 15000 });
    for (let tentativa = 0; tentativa < 5; tentativa++) {        // toque na tela velha (jogo trocado na hora) se perde: tenta de novo
      await f.locator('#btG').tap();
      try { await tela.waitForFunction(k => window.__p.jogadores[k].pronto || window.__p.fase !== 'intro', i, { timeout: 1500 }); return; } catch {}
    }
    throw new Error('PRONTO nao chegou do jogador ' + (i + 1));
  }
  // o celular precisa mostrar exatamente a oferta trocada pelo teste, na ordem (senao o toque cai na carta errada)
  const NOMES = { dobro: 'Vale dobro', moedas: 'Cofre em dobro', escudo: 'Escudo', turbo: 'Turbo', dash: 'Empurrão ligeiro', pulo: 'Mola' };
  const esperaOferta = (f, ids) => f.waitForFunction(n => JSON.stringify([...document.querySelectorAll('#opcoes button.carta b')].map(b => b.textContent)) === n,
    JSON.stringify(ids.map(id => NOMES[id])), { timeout: 5000 });
  // explicacao: quem tem oferta pega "Moedas em dobro" (nao mexe no ponto), e os dois apertam PRONTO
  async function prontos() {
    await tela.waitForFunction(() => window.__p.fase === 'intro', null, { timeout: 15000 });
    await ev(() => { for (const j of window.__p.jogadores) if (j.oferta) j.oferta = ['moedas', 'turbo', 'dash']; });
    for (const i of [0, 1]) {
      if (await ev(k => !!window.__p.jogadores[k].oferta, i)) await esperaOferta(fones[i], ['moedas', 'turbo', 'dash']), await fones[i].locator('#opcoes button.carta', { hasText: 'Cofre em dobro' }).tap();
      await prontoDe(i);
    }
  }
  // comeca a rodada e garante que a proxima tambem seja sumo
  async function joga() {
    await prontos();
    await fase('jogando');
    await ev(() => window.__p.prioridade.push(window.__p.jogo));       // p.prioridade: o motor sorteia isto antes da fila e do genero
  }
  // termina a rodada: o perdedor cai da arena (caminho real do motor: quemSobrou)
  async function vence(i) {
    // melhor de 3 quedas: a de k ja valia 1, esta decide (so encerra depois de 5 s de jogo). Repete a queda ate fechar:
    // logo depois de voltar ao centro o jogador fica 1,5 s protegido e a queda nao conta.
    await tela.waitForFunction(k => {
      const p = window.__p;
      if (p.fase === 'jogando') { p.dados.placar[k] = 1; p.jogadores[1 - k].vivo = false; }
      return ['resultado', 'fim'].includes(p.fase);
    }, i, { polling: 500, timeout: 30000 });
  }
  const anuncios = () => tela.locator('#resultado .anun').allTextContents();
  const pontos = () => ev(() => window.__p.jogadores.map(j => j.pontos));
  // escolhe a carta no celular do perdedor: a oferta e trocada por uma conhecida para o teste nao depender da sorte
  async function escolhe(i, oferta, nome) {
    await tela.waitForFunction(k => window.__p.fase === 'intro' && window.__p.jogadores[k].oferta?.length === 3, i);
    await ev(([k, o]) => { window.__p.jogadores[k].oferta = o; }, [i, oferta]);
    const f = fones[i];
    await esperaOferta(f, oferta);
    return f;
  }

  // ---- rodada 1: J1 vence. Celular do vencedor ganha 3 reacoes rapidas (provocacao)
  await joga();
  await vence(0);
  await um.locator('#provoca.on button').first().waitFor({ timeout: 4000 });
  assert.equal(await um.locator('#provoca button').count(), 3, '3 reacoes rapidas para o vencedor');
  assert.equal(await dois.locator('#provoca.on').count(), 0, 'quem perdeu nao provoca');
  const rea0 = await ev(() => window.__reacoes[0]);
  await um.locator('#provoca button').first().tap();
  await tela.waitForFunction(n => window.__reacoes[0] > n, rea0, { timeout: 4000 });
  await foto('provocacao-celular-vencedor', um);
  console.log('ok vencedor recebe 3 reacoes rapidas no celular e a provocacao aparece na tela');

  // ---- explicacao da rodada 2: J1 aperta PRONTO e fica em espera; dali torce enquanto J2 escolhe a carta
  let f = await escolhe(1, ['turbo', 'dobro', 'escudo'], 'Turbo');
  await prontoDe(0);
  await um.locator('#torcer').waitFor({ state: 'visible' });
  await um.locator('#torcer').tap();
  await tela.waitForFunction(() => window.__torcidas[0] >= 1, null, { timeout: 4000 });
  assert.ok(await tela.locator('.torcida').count() > 5, 'confete da torcida na tela');
  await espera(250);
  await foto('torcida-confete-tela');
  await foto('torcer-celular', um);
  await espera(600);
  const t0 = await ev(() => window.__torcidas[0]);
  for (let k = 0; k < 4; k++) await um.locator('#torcer').tap();          // toques seguidos: o limite segura
  await espera(500);
  const t1 = await ev(() => window.__torcidas[0]);
  assert.ok(t1 - t0 >= 1 && t1 - t0 <= 2, `torcida limitada: ${t1 - t0} de 4 toques`);
  console.log(`ok torcer no celular em espera solta confete na tela (limite: ${t1 - t0} de 4 toques rapidos)`);

  // ---- rodada 2: J2 perdeu e escolhe Turbo; o turbo vale na rodada e aparece no HUD, no boneco e no celular
  await espera(300);
  await foto('cartas-oferta-celular', f);
  await foto('cartas-oferta-tela');
  await f.locator('#opcoes button.carta', { hasText: 'Turbo' }).tap();
  await tela.waitForFunction(() => window.__p.jogadores[1].carta === 'turbo');
  await tela.locator('#placar .cartao.dir .chipCarta', { hasText: 'Turbo' }).waitFor();
  await dois.locator('#cartaChip.on', { hasText: 'Turbo' }).waitFor();
  assert.equal(await ev(() => window.__bonecos[1].userData.aura.visible), true, 'brilho no boneco');
  console.log('ok carta Turbo escolhida no celular; aparece no HUD, no celular e brilha no boneco');
  await joga();
  // os dois puxam o joystick para baixo ao mesmo tempo; quem tem turbo anda mais rapido
  const toque = (page, type, y) => page.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 150, y, id: 1 }] });
  await Promise.all(fones.map(p => toque(p, 'touchStart', 200)));
  await Promise.all(fones.map(p => toque(p, 'touchMove', 300)));
  await espera(350);
  const vel = await ev(() => window.__p.jogadores.map(j => Math.hypot(j.vx, j.vz)));
  await foto('carta-turbo-arena');
  await Promise.all(fones.map(p => toque(p, 'touchEnd')));
  assert.ok(vel[1] > vel[0] * 1.15, `turbo mais rapido: ${vel.map(v => v.toFixed(1))}`);
  console.log(`ok turbo vale no movimento: velocidade J1 ${vel[0].toFixed(1)}, J2 com turbo ${vel[1].toFixed(1)}`);
  await vence(0);
  await tela.locator('#resultado .anun').first().waitFor();
  assert.ok((await anuncios()).some(t => /fez 2 seguidas/i.test(t)), 'faixa de 2 seguidas: ' + await anuncios());
  await espera(400);
  await foto('faixa-2-seguidas');
  console.log('ok faixa "fez 2 seguidas" depois de duas vitorias');

  // ---- rodada 3: J2 escolhe Vale dobro e vence: 2 pontos, empata 2 x 2 depois de estar 2 atras = virada
  f = await escolhe(1, ['dobro', 'moedas', 'turbo'], 'Vale dobro');
  await f.locator('#opcoes button.carta', { hasText: 'Vale dobro' }).tap();
  await tela.locator('#placar .cartao.dir .chipCarta', { hasText: 'Vale dobro' }).waitFor();
  await joga();
  await vence(1);
  assert.deepEqual(await pontos(), [2, 2], 'vale dobro deu 2 pontos');
  assert.ok((await anuncios()).some(t => /virou!/i.test(t)), 'faixa de virada: ' + await anuncios());
  await espera(400);
  await foto('faixa-virada');
  console.log('ok Vale dobro deu 2 pontos e a faixa de virada apareceu (2 x 2)');

  // ---- rodadas 4 e 5: placar empatado avancado ate 3 do fim; J2 vence duas, faz 3 seguidas e fica a 1 ponto
  const PV = await ev(() => document.querySelectorAll('#placar .cartao.esq .pips i').length);      // pontos para vencer (estrelas do placar)
  await ev(n => { for (const j of window.__p.jogadores) j.pontos = n; }, PV - 3);
  await joga(); await vence(1);
  assert.ok((await anuncios()).some(t => /2 seguidas/i.test(t)));
  await joga(); await vence(1);
  const a5 = await anuncios();
  assert.ok(a5.some(t => /fez 3 seguidas. Alguém para essa pessoa!/i.test(t)), 'on fire: ' + a5);
  assert.ok(a5.some(t => /a um ponto do título/i.test(t)), 'ponto da partida: ' + a5);
  await tela.locator('#placar .cartao.dir.quase').waitFor();
  await espera(400);
  await foto('faixa-on-fire-e-ponto-da-partida');
  console.log(`ok faixas "fez 3 seguidas" e "a um ponto do título" (${(await pontos()).join(' x ')})`);

  // ---- contagem vibrante e ponto decisivo em camera lenta
  // J1 perdeu: recusa a carta com "Sem carta", que ja conta como PRONTO
  await tela.waitForFunction(() => window.__p.fase === 'intro' && window.__p.jogadores[0].oferta?.length === 3, null, { timeout: 15000 });
  await ev(() => { window.__p.jogadores[0].oferta = ['moedas', 'turbo', 'dash']; });
  await esperaOferta(um, ['moedas', 'turbo', 'dash']);
  await foto('cartas-sem-carta-celular', um);
  await um.locator('#opcoes button', { hasText: 'Não quero carta' }).tap();
  await tela.waitForFunction(() => window.__p.jogadores[0].pronto && !window.__p.jogadores[0].oferta && !window.__p.jogadores[0].carta);
  console.log('ok "Não quero carta" recusa a oferta e ja deixa o jogador pronto');
  await prontoDe(1);
  await tela.waitForFunction(() => document.querySelector('#conta span')?.textContent === '1', null, { timeout: 6000 });
  await foto('contagem-1');
  await tela.waitForFunction(() => document.querySelector('#conta span')?.textContent === 'JÁ!', null, { timeout: 4000 });
  await foto('contagem-ja');
  await fase('jogando');
  await vence(1);
  assert.equal(await ev(() => window.__p.fase), 'fim');
  await tela.waitForFunction(() => window.__lento() > 0 && document.querySelector('#hud.lento'), null, { timeout: 2000 });
  await foto('camera-lenta-ponto-decisivo');
  await tela.locator('#fim.on').waitFor({ timeout: 8000 });
  await espera(600);
  await foto('podio');
  console.log('ok contagem 3, 2, 1, JÁ! e camera lenta no ponto decisivo; podio de J2');

  // ---- rodada cooperativa: minijogo de teste registrado na hora; vitoria em equipe da ponto aos dois
  await tela.waitForFunction(() => window.__p.fase === 'intro', null, { timeout: 25000 });
  await ev(() => {
    window.__registra({ id: 'coop-teste', nome: 'Juntos', dica: 'Fiquem vivos juntos por 2 segundos', coop: true,
      inicia(p) { p.arena = { tipo: 'circulo', raio: 8, parede: true }; }, atualiza: p => (p.t > 2 ? 2 : undefined) });
    window.__jogo('coop-teste');
  });
  await tela.locator('#msg .coop').waitFor();
  await foto('coop-cartao');
  for (const i of [0, 1]) await prontoDe(i);
  await tela.waitForFunction(() => window.__p.fase === 'resultado', null, { timeout: 25000 });
  await tela.locator('#resultado .faixa.equipe', { hasText: 'Deu certo!' }).waitFor();
  assert.deepEqual(await pontos(), [1, 1]);
  await espera(400);
  await foto('coop-vitoria-equipe');
  console.log('ok rodada cooperativa: cartao "Todo mundo do mesmo lado", faixa "Deu certo!" e 1 ponto para cada um');

  // ---- labirinto: itens no chao, coleta e selos de itens no HUD
  await tela.waitForFunction(() => window.__p.fase === 'intro', null, { timeout: 8000 });
  await ev(() => window.__jogo('labirinto'));
  for (const i of [0, 1]) await prontoDe(i);
  await fase('jogando');
  await ev(() => {
    const p = window.__p, d = p.dados;
    for (const [i, k] of [[0, 2], [2, 0], [1, 0], [0, 1], [10, 6], [8, 8]]) d.grade[i][k] = 0;
    d.itens.push({ i: 0, k: 2, tipo: 'bomba', t: 0 }, { i: 2, k: 0, tipo: 'fogo', t: 0 }, { i: 10, k: 6, tipo: 'patins', t: 0 }, { i: 8, k: 8, tipo: 'passa', t: 0 });
  });
  await espera(700);
  await foto('labirinto-itens');
  await ev(() => { const p = window.__p; Object.assign(p.jogadores[0], { x: -p.arena.lx + 1, z: -p.arena.lz + 1 + 4 }); });
  await tela.waitForFunction(() => window.__p.dados.poder?.[0].bombas === 3, null, { timeout: 3000 });
  await tela.locator('#placar .cartao.esq .inv', { hasText: 'Bombas' }).waitFor();
  assert.ok((await tela.locator('#placar .cartao.esq .inv').allTextContents()).includes('Bombas 3'));
  await espera(300);
  await foto('labirinto-coleta-hud');
  console.log('ok labirinto: itens no chao, coleta da bomba extra e selo "Bombas 3" no HUD');

  await espera(500);
  const sim = await ev(() => window.__p.erros);
  assert.deepEqual(sim, [], 'sem erros dos minijogos');
  assert.deepEqual(erros, [], 'zero erros de console: ' + erros.join(' | '));
  console.log('ok zero erros de console e de pagina');
  await browser.close();
  console.log('TUDO OK');
})().catch(async e => {
  console.error('FALHOU:', e.message); console.error(erros);
  try { console.error('estado:', await globalThis.__estado?.()); } catch {}
  process.exit(1);
});
