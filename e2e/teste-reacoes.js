// Teste de ponta a ponta das reacoes, chapeus e cores novos: tela do PC + dois celulares com toque, navegador visivel.
// Uso: PORT=8130 node server.js (em outro terminal) e depois node teste-reacoes.js
const assert = require('node:assert/strict');
const path = require('path');
let chromium;
({ chromium } = require(process.env.PW || 'playwright'));

const URL = process.env.URL_JOGO || 'http://localhost:8130';
const FOTOS = path.join(__dirname, 'fotos');
const erros = [];
const espera = ms => new Promise(r => setTimeout(r, ms));

async function celular(browser, botao, seed) {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([chave, perfil]) => {
    try { if (!localStorage.getItem('semeado')) { localStorage.setItem(chave, JSON.stringify(perfil)); localStorage.setItem('semeado', '1'); } } catch {}
  }, [botao === 'Jogador 1' ? 'perfil1' : 'perfil2', seed]);
  const page = await ctx.newPage();
  page.on('pageerror', e => erros.push(`${botao}: ${e}`));
  page.on('console', m => { if (m.type() === 'error') erros.push(`${botao}: ${m.text()}`); });
  await page.goto(URL + '/c');
  await page.getByRole('button', { name: botao }).tap();
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
  const contagem = i => tela.evaluate(k => window.__reacoes[k], i);
  const esperaReacoes = (i, n) => tela.waitForFunction(([k, q]) => window.__reacoes[k] >= q, [i, n], { timeout: 4000 });

  // ---- celular 2 sozinho: tem todos os itens (semeado), serve para exibir cada chapeu e cor novos no palco da tela
  const dois = await celular(browser, 'Jogador 2', { cores: [...Array(14).keys()], chapeus: [...Array(13).keys()], moedas: 0 });
  const abre = async (page, aba) => { await page.locator('#abrePerfil').tap(); await page.locator('#perfil').waitFor({ state: 'visible' }); await page.locator('.aba').nth(aba).tap(); await espera(500); };
  await abre(dois, 1);
  const NOMES_CHAPEUS = ['pirata', 'chef', 'aureola', 'viking', 'ninja'];
  for (let k = 0; k < 5; k++) {
    await dois.locator('#lojaChapeus .item').nth(8 + k).tap();
    await tela.waitForFunction(i => window.__perfis[1].chapeu === i, 8 + k, { timeout: 4000 });
    await espera(500);
    await foto(`chapeu-${8 + k}-${NOMES_CHAPEUS[k]}-tela`);
    await foto(`chapeu-${8 + k}-${NOMES_CHAPEUS[k]}-celular`, dois.locator('#palco'));
  }
  console.log('ok 5 chapeus novos aparecem no celular e no boneco 3D da tela (fotos chapeu-*)');
  await dois.locator('.aba').nth(0).tap(); await espera(500);
  const NOMES_CORES = ['dourado', 'arcoiris', 'galaxia', 'neon'];
  for (let k = 0; k < 4; k++) {
    await dois.locator('#lojaCores .item').nth(10 + k).tap();
    await tela.waitForFunction(i => window.__perfis[1].cor === i, 10 + k, { timeout: 4000 });
    await espera(600);
    await foto(`cor-${10 + k}-${NOMES_CORES[k]}-tela`);
    await foto(`cor-${10 + k}-${NOMES_CORES[k]}-celular`, dois.locator('#palco'));
  }
  console.log('ok 4 cores novas aparecem no celular e no boneco 3D da tela (fotos cor-*)');
  await dois.locator('.aba').nth(1).tap(); await espera(400);
  await dois.locator('#lojaChapeus .item').nth(8).tap();                        // volta para pirata
  await dois.locator('.aba').nth(0).tap(); await espera(400);
  await dois.locator('#lojaCores .item').nth(11).tap();                         // e arco-iris, que anima
  await dois.locator('#fechar').tap();

  // ---- reacao do celular 2 com a tela ainda no palco de espera (sprite sobre o boneco grande)
  await dois.locator('#reagir').tap();
  assert.equal(await dois.locator('#barraRea button').count(), 6, 'sem pacotes: so as 6 reacoes gratis');
  await dois.locator('#barraRea button').nth(3).tap();
  await esperaReacoes(1, 1);
  assert.equal(await dois.locator('#barraRea.on').count(), 0, 'a barra fecha ao tocar numa reacao');
  await espera(350);
  await foto('reacao-palco-tela');
  console.log('ok reacao no palco de espera');

  // ---- celular 1 entra: a partida comeca. Tem 300 moedas para comprar.
  const um = await celular(browser, 'Jogador 1', { cores: [0, 1], chapeus: [0], moedas: 300 });
  await tela.locator('#espera').waitFor({ state: 'hidden' });
  await um.waitForFunction(() => document.getElementById('btG').textContent === 'PRONTO!' && getComputedStyle(document.getElementById('botao')).display !== 'none');
  console.log('ok os dois celulares conectaram e a partida comecou');

  // botao de carinha visivel e tocavel (nada por cima) em todos os modos, inclusive no PRONTO
  const livre = page => page.evaluate(() => { const b = document.getElementById('reagir').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return b.width > 0 && !!e?.closest('#reagir'); });
  assert.ok(await livre(um), 'botao de reacao livre no PRONTO');
  for (const modo of ['padrao', 'botao', 'toque', 'opcoes', 'espera']) {
    await um.evaluate(m => aplica({ modo: m, opcoes: ['A', 'B'] }), modo);
    assert.ok(await livre(um), 'botao de reacao livre no modo ' + modo);
    await um.locator('#reagir').tap();
    assert.equal(await um.locator('#barraRea.on').count(), 1, 'barra abre no modo ' + modo);
    await um.locator('#reagir').tap();
    assert.equal(await um.locator('#barraRea.on').count(), 0);
  }
  console.log('ok botao de reacao visivel e a barra abre em padrao, botao, toque, opcoes, espera e PRONTO');

  // ---- reacoes dos dois celulares na arena, mais HUD
  await um.locator('#reagir').tap();
  await foto('celular-barra-gratis', um);
  await um.locator('#barraRea button').nth(0).tap();
  await esperaReacoes(0, 1);
  await tela.waitForFunction(() => document.getElementById('reaHud0').classList.contains('on'));
  await espera(300);
  await dois.locator('#reagir').tap(); await dois.locator('#barraRea button').nth(2).tap();
  await esperaReacoes(1, 2);
  await espera(300);
  await foto('reacao-arena-tela');
  assert.equal(await tela.locator('#reaHud1').textContent(), '\u{1F621}');
  console.log('ok reacoes dos dois celulares aparecem na tela (sprite 3D e ao lado do cartao)');

  // ---- toques rapidos: o contador do celular sobe em todos, a tela mostra no maximo 1 a cada 0,7 s e nao perde o contador
  await espera(900);
  const antes = await contagem(0), nr0 = await um.evaluate(() => nr);
  for (let k = 0; k < 4; k++) { await um.locator('#reagir').tap(); await um.locator('#barraRea button').nth(k).tap(); }
  const nr1 = await um.evaluate(() => nr);
  assert.equal(nr1 - nr0, 4, 'celular contou 4 toques');
  await espera(500);
  assert.equal(await tela.evaluate(() => window.__nrVisto[0]), nr1, 'a tela recebeu o contador final (toque nao se perde)');
  const rapido = (await contagem(0)) - antes;
  assert.ok(rapido >= 1 && rapido <= 2, `limite de 1 reacao a cada 0,7 s: mostrou ${rapido} de 4 toques rapidos`);
  await espera(800);
  await um.locator('#reagir').tap(); await um.locator('#barraRea button').nth(5).tap();
  await esperaReacoes(0, antes + rapido + 1);
  console.log(`ok toques rapidos: 4 toques, ${rapido} mostrada(s) pelo limite; depois de 0,8 s a proxima aparece`);

  // ---- compra de pacote e de chapeu
  await abre(um, 2);
  const moedas = () => um.evaluate(() => perfil.moedas);
  assert.equal(await moedas(), 300);
  await foto('loja-reacoes-celular');
  await um.locator('#lojaReacoes .item').nth(0).tap();             // Provocacao, 25
  await um.waitForFunction(() => perfil.pacotes.includes(0));
  assert.equal(await moedas(), 275);
  await um.locator('#lojaReacoes .item').nth(1).tap();             // Festa, 35
  await um.waitForFunction(() => perfil.pacotes.includes(1));
  assert.equal(await moedas(), 240);
  await espera(400);
  await foto('loja-reacoes-celular-comprado', um);
  await um.locator('.aba').nth(1).tap(); await espera(500);
  await um.locator('#lojaChapeus .item').nth(11).tap();            // Viking, 45
  await tela.waitForFunction(() => window.__perfis[0].chapeu === 11, null, { timeout: 4000 });
  assert.equal(await moedas(), 195);
  await espera(500);
  await foto('compra-chapeu-viking-celular', um.locator('#palco'));
  await um.locator('.aba').nth(0).tap(); await espera(500);
  await um.locator('#lojaCores .item').nth(12).tap();              // Galaxia, 70
  await tela.waitForFunction(() => window.__perfis[0].cor === 12, null, { timeout: 4000 });
  assert.equal(await moedas(), 125);
  await um.locator('#fechar').tap();
  await espera(600);
  await foto('compra-viking-galaxia-tela');
  console.log('ok comprou 2 pacotes, 1 chapeu e 1 cor com moedas; a tela trocou o chapeu (viking) e a cor (galaxia)');

  // ---- usa uma reacao comprada, e confere que a posse fica salva no perfil
  await um.locator('#reagir').tap();
  assert.equal(await um.locator('#barraRea button').count(), 6 + 4 + 4);
  await foto('celular-barra-com-pacotes', um);
  const n0 = await contagem(0);
  await um.locator('#barraRea button[aria-label="Palhaço"]').tap();
  await esperaReacoes(0, n0 + 1);
  assert.equal(await tela.locator('#reaHud0').textContent(), '\u{1F921}');
  const salvo = await um.evaluate(() => JSON.parse(localStorage.getItem('perfil1')));
  assert.deepEqual(salvo.pacotes, [0, 1]);
  await um.reload();
  await um.waitForFunction(() => typeof perfil !== 'undefined' && perfil && perfil.pacotes.length === 2);
  await espera(1000);
  await um.locator('#reagir').tap();
  assert.equal(await um.locator('#barraRea button').count(), 14, 'posse continua depois de recarregar');
  const n1 = await contagem(0);
  await espera(800);
  await um.locator('#barraRea button').nth(13).tap();                // celular recarregou: contador voltou a 0 e a nova reacao conta
  await esperaReacoes(0, n1 + 1);
  console.log('ok reacao comprada funciona, posse salva no localStorage e vale depois de recarregar');

  // ---- jogo segue: os dois apertam PRONTO e a rodada comeca com os visuais novos
  for (const page of [um, dois]) await page.locator('#btG').tap().catch(() => {});
  await espera(4500);
  await foto('arena-final-tela');

  const sim = await tela.evaluate(() => window.__p.erros);
  assert.deepEqual(sim, [], 'sem erros dos minijogos');
  assert.deepEqual(erros, [], 'zero erros de console: ' + erros.join(' | '));
  console.log('ok zero erros de console e de pagina');
  await browser.close();
  console.log('TUDO OK');
})().catch(e => { console.error('FALHOU:', e.message); console.error(erros); process.exit(1); });
