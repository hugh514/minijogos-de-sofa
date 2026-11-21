// Teste de ponta a ponta dos itens de rodada (spec 009): compra na Loja do celular, uso durante a rodada, limites, efeitos na TV e estoque.
// Uso: PORT=8152 node server.js (em outro terminal) e depois URL_JOGO=http://localhost:8152 node e2e/teste-itens.js
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.env.URL_JOGO || 'http://localhost:8152';
const FOTOS = process.env.FOTOS_ITENS || path.join(__dirname, 'fotos-itens');
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

  // 4 celulares; so os dois primeiros tem moedas (perfil semeado no localStorage, como no teste-reacoes)
  const MOEDAS = [300, 200, 0, 0], fones = [];
  for (let n = 1; n <= 4; n++) {
    const ctx = await browser.newContext({ viewport: { width: 760, height: 360 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(([chave, perfil]) => {
      try { if (!localStorage.getItem('semeado')) { localStorage.setItem(chave, JSON.stringify(perfil)); localStorage.setItem('semeado', '1'); } } catch {}
    }, ['perfil' + n, { nome: ['Ana', 'Bia', 'Caio', 'Duda'][n - 1], moedas: MOEDAS[n - 1] }]);
    const f = await ctx.newPage();
    f.on('pageerror', e => erros.push(`celular ${n}: ${e}`));
    f.on('console', m => { if (m.type() === 'error') erros.push(`celular ${n}: ${m.text()}`); });
    await f.goto(URL + '/c', { timeout: 90000 });
    await f.locator('#lugares button').nth(n - 1).tap();
    f.cdp = await ctx.newCDPSession(f);
    fones.push(f);
  }
  await frente();
  await tela.waitForFunction(() => window.__sala().seguidos === 4, null, { timeout: 10000 });
  // o anfitriao mexe no menu logo: assim a partida nao comeca sozinha enquanto o pessoal esta na Loja
  await fones[0].locator('#menuLista button[data-m=vs]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'vs', null, { timeout: 4000 });
  const toque = (page, type, x, y) => page.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const estoque = f => f.evaluate(() => ({ ...perfil.itens, moedas: perfil.moedas }));
  const barra = f => f.evaluate(() => [...document.querySelectorAll('#barraItens.on button')].map(b => [b.dataset.item, +b.querySelector('b').textContent, !b.classList.contains('off')]));

  // ---- Loja: aba Itens, compra por unidade
  const compra = async (f, ...ids) => { for (const id of ids) { await f.locator(`#lojaItens [data-item=${id}]`).tap(); await espera(120); } };
  await fones[0].locator('#abrePerfil').tap(); await fones[0].locator('#perfil').waitFor({ state: 'visible' });
  await fones[0].locator('.aba', { hasText: 'Itens' }).tap(); await espera(700);
  assert.equal(await fones[0].locator('#lojaItens .itemRod').count(), 5, 'os cinco itens na loja');
  await foto('1-loja-itens-antes', fones[0]);
  await compra(fones[0], 'bomba', 'bomba', 'gelo', 'turbo', 'guarda', 'tinta');
  assert.deepEqual(await estoque(fones[0]), { bomba: 2, gelo: 1, turbo: 1, guarda: 1, tinta: 1, moedas: 300 - 30 - 30 - 25 - 20 - 25 - 15 });
  assert.ok((await fones[0].locator('#lojaItens [data-item=bomba]').innerText()).includes('Você tem 2'));
  await espera(900);
  assert.equal(await fones[0].locator('#moedas').textContent(), '155', 'o saldo do topo desceu');
  await foto('1b-loja-itens-comprados', fones[0]);
  await fones[0].locator('#fechar').tap();
  await fones[1].locator('#abrePerfil').tap(); await fones[1].locator('#perfil').waitFor({ state: 'visible' });
  await fones[1].locator('.aba', { hasText: 'Itens' }).tap(); await espera(700);
  await compra(fones[1], 'bomba', 'turbo', 'guarda', 'tinta');
  assert.deepEqual(await estoque(fones[1]), { bomba: 1, gelo: 0, turbo: 1, guarda: 1, tinta: 1, moedas: 200 - 30 - 20 - 25 - 15 });
  await fones[1].locator('#fechar').tap();
  await fones[2].locator('#abrePerfil').tap(); await fones[2].locator('#perfil').waitFor({ state: 'visible' });
  await fones[2].locator('.aba', { hasText: 'Itens' }).tap(); await espera(700);
  await compra(fones[2], 'tinta');
  assert.deepEqual(await estoque(fones[2]), { bomba: 0, gelo: 0, turbo: 0, guarda: 0, tinta: 0, moedas: 0 }, 'sem moedas nao compra');
  await foto('1c-loja-itens-sem-moedas', fones[2]);
  await fones[2].locator('#fechar').tap();
  // estoque maximo de 9 e o perfil guardado no celular
  assert.equal(await fones[0].evaluate(() => { const p = { moedas: 9999, itens: { ...perfil.itens, tinta: 9 } }; return compraItem(p, 4); }), false, 'estoque cheio');
  assert.equal(await fones[0].evaluate(() => JSON.parse(localStorage.getItem('perfil1')).itens.bomba), 2, 'o estoque fica salvo no celular');

  // ---- Cada um por si
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  await ev(() => { window.__p.modificadores = false; });

  const rodada = async id => {       // forca o minijogo, todos tocam em Entendi e a rodada comeca
    await ev(x => { window.__jogo(x); for (const j of window.__p.jogadores) { j.oferta = null; j.direito = false; } }, id);
    await tela.waitForFunction(x => window.__p.jogo.id === x && window.__p.fase === 'intro', id, { timeout: 5000 });
    for (const f of fones) {
      await f.waitForFunction(() => document.getElementById('btG').textContent === 'Entendi' && getComputedStyle(document.getElementById('botao')).display !== 'none', null, { timeout: 15000 });
      await f.locator('#btG').tap(); await frente();
    }
    await tela.waitForFunction(() => window.__p.fase === 'jogando', null, { timeout: 20000 });
  };
  const liberado = () => tela.waitForFunction(() => window.__p.fase === 'jogando' && window.__p.t >= 3.15, null, { timeout: 10000 });
  const usa = async (i, id) => { await fones[i].locator(`#barraItens [data-item=${id}]`).tap(); await frente(); };
  const usos = () => ev(() => window.__p.itens.map(u => [u.id, u.de, u.para, !!u.bloqueado]));
  const esperaUsos = n => tela.waitForFunction(x => window.__p.itens.length >= x, n, { timeout: 4000 });
  const jog = i => ev(x => { const j = window.__p.jogadores[x]; return { tonto: j.tonto, gelo: j.gelo, liso: j.liso, turbo: j.turboItem, guarda: j.guarda, tinta: j.tinta, imune: j.imuneItem, x: j.x, z: j.z, ent: j.ent, rodada: j.itensRodada, partida: j.itensPartida, vivo: j.vivo }; }, i);
  const maisPerto = de => ev(x => { const js = window.__p.jogadores; return js.map((j, i) => [i, Math.hypot(j.x - js[x].x, j.z - js[x].z)]).filter(([i]) => i !== x).sort((a, b) => a[1] - b[1])[0][0]; }, de);
  const esperaAviso = txt => tela.waitForFunction(t => document.getElementById('hudItens').innerText.trim().startsWith(t), txt, { timeout: 3000 });

  // ---- rodada 1 (sumo-vidas, de joystick): nada nos 3 primeiros segundos; bomba no mais perto; 1 por rodada
  await rodada('sumo-vidas');
  await fones[0].waitForFunction(() => document.querySelectorAll('#barraItens.on button').length === 5, null, { timeout: 4000 });
  assert.ok((await ev(() => window.__p.t)) < 3, 'a rodada mal comecou');
  assert.deepEqual((await barra(fones[0])).map(b => b[2]), [false, false, false, false, false], 'nos 3 primeiros segundos os botoes ficam apagados');
  assert.deepEqual(await barra(fones[2]), [], 'quem nao tem item nao ve a barrinha');
  await foto('2-celular-barrinha-apagada-nos-3s', fones[0]);
  await usa(0, 'bomba'); await espera(300);
  assert.deepEqual(await usos(), [], 'toque antes dos 3 s nao vale');
  assert.equal((await estoque(fones[0])).bomba, 2);
  await liberado();
  await fones[0].waitForFunction(() => !document.querySelector('#barraItens [data-item=bomba]').classList.contains('off'), null, { timeout: 4000 });
  assert.deepEqual(await barra(fones[0]), [['bomba', 2, true], ['gelo', 1, true], ['turbo', 1, true], ['guarda', 1, true], ['tinta', 1, true]]);
  // a barrinha nao cobre o joystick nem os botoes: fica no topo, acima da area do controle
  const caixas = await fones[0].evaluate(() => { const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return { barra: r('barraItens'), topo: r('topo'), padrao: r('padrao'), base: r('base'), btA: r('btA'), reagir: r('reagir') }; });
  assert.ok(caixas.barra[3] <= caixas.topo[3] + 1 && caixas.barra[3] <= caixas.padrao[1] + 1, 'a barrinha fica dentro do topo: ' + JSON.stringify(caixas));
  assert.ok(caixas.barra[2] <= caixas.reagir[0], 'e nao encosta nos botoes do topo');
  assert.ok(caixas.topo[3] <= 64, 'o topo nao cresceu: ' + caixas.topo[3]);
  await toque(fones[0], 'touchStart', 150, 230); await toque(fones[0], 'touchMove', 190, 230);
  await foto('2b-celular-barrinha-na-rodada', fones[0]);
  await toque(fones[0], 'touchEnd');
  const alvo1 = await maisPerto(0);
  await toque(fones[alvo1], 'touchStart', 150, 230); await toque(fones[alvo1], 'touchMove', 200, 230);       // o alvo esta com o joystick puxado
  await tela.waitForFunction(x => window.__p.jogadores[x].ent.x > 0.3, alvo1, { timeout: 3000 });
  await usa(0, 'bomba'); await esperaUsos(1);
  assert.deepEqual(await usos(), [['bomba', 0, alvo1, false]], 'a bomba vai no rival mais perto');
  await foto('3-tv-bomba-voando');
  let a = await jog(alvo1);
  assert.ok(a.tonto > 0 && a.tonto <= 1.5, 'alvo atordoado: ' + a.tonto);
  assert.deepEqual(a.ent, { x: 0, y: 0, d: false, b: false }, 'joystick do alvo zerado');
  await toque(fones[alvo1], 'touchMove', 210, 240); await espera(150);
  assert.equal((await jog(alvo1)).ent.x, 0, 'e continua zerado enquanto dura');
  await esperaAviso(`Ana jogou uma bomba em ${['Ana', 'Bia', 'Caio', 'Duda'][alvo1]}`);
  await espera(250); await foto('3b-tv-atordoado-estrelas');
  assert.ok((await tela.locator(`#placar .cartao[data-i="${alvo1}"]`).innerText()).includes('Tonto'), 'a ficha do efeito aparece no cartao de quem levou');
  await tela.waitForFunction(x => window.__p.jogadores[x].tonto === 0, alvo1, { timeout: 4000 });
  await tela.waitForFunction(x => window.__p.jogadores[x].ent.x > 0.3, alvo1, { timeout: 2000 });       // o joystick que o dedo segurava volta a valer
  await toque(fones[alvo1], 'touchEnd');
  // estoque descontado so depois de aceito; limite de 1 por rodada apaga os botoes
  await fones[0].waitForFunction(() => perfil.itens.bomba === 1, null, { timeout: 4000 });
  await fones[0].waitForFunction(() => [...document.querySelectorAll('#barraItens button')].every(b => b.classList.contains('off')), null, { timeout: 4000 });
  assert.deepEqual(await barra(fones[0]), [['bomba', 1, false], ['gelo', 1, false], ['turbo', 1, false], ['guarda', 1, false], ['tinta', 1, false]]);
  assert.equal(await fones[0].evaluate(() => JSON.parse(localStorage.getItem('perfil1')).itens.bomba), 1, 'e fica salvo');
  await foto('3c-celular-depois-de-usar', fones[0]);
  await usa(0, 'gelo'); await espera(300);
  assert.equal((await usos()).length, 1, 'botao apagado nao manda nada');
  // mesmo forcando o envio (sem passar pelo botao), o motor recusa o segundo item e nada e gasto
  await fones[0].evaluate(() => { it = 1; ni++; envia(); }); await frente();
  await tela.waitForFunction(() => window.__p.jogadores[0].itensNegados >= 1, null, { timeout: 4000 });
  assert.equal((await usos()).length, 1);
  await fones[0].waitForFunction(() => document.getElementById('barraItens').classList.contains('nega'), null, { timeout: 4000 });
  assert.equal((await estoque(fones[0])).gelo, 1, 'recusado nao gasta');
  // Bia abre o guarda-chuva (item em si mesma)
  await usa(1, 'guarda'); await esperaUsos(2);
  assert.deepEqual((await usos())[1], ['guarda', 1, 1, false]);
  assert.equal((await jog(1)).guarda, true);
  await esperaAviso('Bia abriu o guarda-chuva');
  await espera(300); await foto('4-tv-guarda-chuva');
  await fones[1].waitForFunction(() => perfil.itens.guarda === 0, null, { timeout: 4000 });
  assert.deepEqual((await barra(fones[1])).map(b => b[0]), ['bomba', 'turbo', 'tinta'], 'item que acabou sai da barrinha');

  // ---- rodada 2: gelo (congela e depois chao liso) e tinta (mancha o celular do alvo)
  await rodada('sumo-vidas'); await liberado();
  assert.equal((await jog(1)).guarda, false, 'o guarda-chuva vale so na rodada em que foi aberto');
  const alvo2 = await maisPerto(0);
  await usa(0, 'gelo'); await esperaUsos(1);
  assert.deepEqual(await usos(), [['gelo', 0, alvo2, false]]);
  a = await jog(alvo2);
  assert.ok(a.gelo > 0 && a.gelo <= 2 && a.liso > 2, 'congelado e com chao liso depois: ' + JSON.stringify(a));
  await espera(450); await foto('5-tv-gelo');
  await esperaAviso('Ana congelou ');
  // tinta: o Jogador 2 mancha o rival mais perto que nao esta imune
  await tela.waitForFunction(() => !(window.__p.jogadores[1].gelo > 0), null, { timeout: 5000 });       // se a congelada foi a Bia, ela espera descongelar (congelado nao usa item)
  await fones[1].waitForFunction(() => !document.querySelector('#barraItens [data-item=tinta]').classList.contains('off'), null, { timeout: 4000 });
  await usa(1, 'tinta'); await esperaUsos(2);
  const alvo3 = (await usos())[1][2];
  assert.notEqual(alvo3, 1, 'a tinta foi em um rival');
  assert.ok(alvo2 === 1 || alvo3 !== alvo2, 'quem acabou de ser congelado esta imune: a tinta vai em outro rival');
  assert.ok((await jog(alvo3)).tinta > 0);
  await fones[alvo3].waitForFunction(() => document.getElementById('tinta').classList.contains('on'), null, { timeout: 4000 });
  await espera(350); await foto('6-celular-manchado-de-tinta', fones[alvo3]);
  await foto('6b-tv-tinta');
  assert.equal(await fones[alvo3].evaluate(() => getComputedStyle(document.getElementById('tinta')).pointerEvents), 'none', 'a mancha nao segura o toque');
  await fones[alvo3].waitForFunction(() => !document.getElementById('tinta').classList.contains('on'), null, { timeout: 6000 });
  assert.equal((await estoque(fones[1])).tinta, 0);

  // ---- rodada 3: turbo (so quem usou; deixa rastro)
  await rodada('sumo-vidas'); await liberado();
  await toque(fones[0], 'touchStart', 150, 230); await toque(fones[0], 'touchMove', 150, 180);
  await usa(0, 'turbo'); await esperaUsos(1);
  assert.deepEqual(await usos(), [['turbo', 0, 0, false]]);
  assert.ok((await jog(0)).turbo > 3);
  await espera(250); await foto('7-tv-turbo');
  await toque(fones[0], 'touchEnd');
  await esperaAviso('Ana ligou o turbo');
  assert.equal((await jog(0)).partida, 3, 'Ana ja usou 3 nesta partida');

  // ---- rodada 4 (cor-mentirosa-festa, sem joystick): limite de 3 por partida; turbo apagado; a bomba vai no lider do placar
  await rodada('cor-mentirosa-festa');
  await ev(() => { window.__p.jogadores.forEach((j, i) => { j.pontos = [1, 0, 3, 2][i]; }); });
  await liberado();
  await fones[1].waitForFunction(() => document.querySelectorAll('#barraItens.on button:not(.off)').length > 0, null, { timeout: 4000 });
  assert.deepEqual(await barra(fones[0]), [['bomba', 1, false], ['guarda', 1, false], ['tinta', 1, false]], 'com 3 usados na partida, tudo apagado');
  assert.deepEqual(await barra(fones[1]), [['bomba', 1, true], ['turbo', 1, false]], 'turbo apagado em minijogo que o motor nao move o boneco');
  await foto('8-celular-sem-joystick-turbo-apagado', fones[1]);
  await foto('8b-celular-limite-da-partida', fones[0]);
  await fones[0].evaluate(() => { it = 0; ni++; envia(); }); await frente(); await espera(400);
  assert.deepEqual(await usos(), [], 'o quarto item da partida e recusado pelo motor');
  assert.equal((await estoque(fones[0])).bomba, 1);
  await usa(1, 'turbo'); await espera(300);
  assert.deepEqual(await usos(), []);
  assert.equal((await estoque(fones[1])).turbo, 1, 'turbo nao gasta onde nao vale');
  await usa(1, 'bomba'); await esperaUsos(1);
  assert.deepEqual(await usos(), [['bomba', 1, 2, false]], 'sem posicao, a bomba vai no lider do placar');
  assert.ok((await jog(2)).tonto > 0);
  await esperaAviso('Bia jogou uma bomba em Caio');
  await espera(450); await foto('9-tv-sem-joystick-bomba-no-lider');
  assert.ok((await tela.locator('#placar .cartao[data-i="2"]').innerText()).includes('Tonto'));
  await fones[1].waitForFunction(() => perfil.itens.bomba === 0, null, { timeout: 4000 });
  // quem acabou de levar fica imune a outro item por 4 s
  assert.ok((await jog(2)).imune > 3);

  // ---- estoque final: so saiu o que o motor aceitou
  assert.deepEqual(await estoque(fones[0]), { bomba: 1, gelo: 0, turbo: 0, guarda: 1, tinta: 1, moedas: 155 });
  assert.deepEqual(await estoque(fones[1]), { bomba: 0, gelo: 0, turbo: 1, guarda: 0, tinta: 0, moedas: 110 });

  // ---- Duplas com lugares trocados (Ana escolhe Bia): o parceiro nao e alvo e o estoque desce no celular de quem usou
  await fones[0].evaluate(() => fetch('/comando', { method: 'POST', body: JSON.stringify({ j: 1, c: 'menu' }) })); await frente();
  await tela.locator('#espera').waitFor({ state: 'visible', timeout: 8000 });
  await fones[0].locator('#menuLista button[data-m=times]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().escolhaModo === 'times', null, { timeout: 4000 });
  await fones[0].locator('#menuConectados i[data-n="1"]').tap(); await frente();
  await tela.waitForFunction(() => window.__sala().parceiro === 1, null, { timeout: 4000 });
  await fones[0].locator('#menuGo').tap(); await frente();
  await tela.locator('#espera').waitFor({ state: 'hidden', timeout: 8000 });
  await ev(() => { window.__p.modificadores = false; });
  assert.deepEqual(await ev(() => window.__sala().troca), [1, 2], 'Bia (lugar 2) joga no indice 2 e Caio (lugar 3) no indice 1');
  await rodada('sumo-vidas'); await liberado();
  await fones[1].waitForFunction(() => !document.querySelector('#barraItens [data-item=turbo]').classList.contains('off'), null, { timeout: 4000 });
  await usa(1, 'turbo'); await esperaUsos(1);
  assert.deepEqual(await usos(), [['turbo', 2, 2, false]], 'o turbo da Bia vale para o indice em que ela joga');
  await esperaAviso('Bia ligou o turbo');
  await fones[1].waitForFunction(() => perfil.itens.turbo === 0, null, { timeout: 4000 });
  await usa(0, 'bomba'); await esperaUsos(2);
  const alvoDupla = (await usos())[1][2];
  assert.ok([1, 3].includes(alvoDupla), 'a bomba da Ana vai em um rival, nunca na parceira: ' + alvoDupla);
  await fones[0].waitForFunction(() => perfil.itens.bomba === 0, null, { timeout: 4000 });
  await espera(500);
  assert.deepEqual(await estoque(fones[2]), { bomba: 0, gelo: 0, turbo: 0, guarda: 0, tinta: 0, moedas: 0 }, 'o celular do Caio nao perde nem ganha nada');
  assert.deepEqual(await estoque(fones[1]), { bomba: 0, gelo: 0, turbo: 0, guarda: 0, tinta: 0, moedas: 110 });
  assert.deepEqual((await estoque(fones[0])).guarda, 1, 'e o guarda-chuva da Ana continua guardado');

  assert.deepEqual(await ev(() => window.__p.erros), [], 'sem erros dos minijogos');
  assert.deepEqual(erros, [], 'zero erros de console: ' + erros.join(' | '));
  await browser.close();
  console.log('TUDO OK');
})().catch(async e => {
  console.error('FALHOU:', e.stack || e.message); console.error(erros);
  try { await browser?.close(); } catch {}
  process.exit(1);
});
