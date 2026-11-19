// Teste de navegador do robo de treino (tecla B ou ?bot) e do modo padrao da sala de espera.
// Uso: PORT=8153 node server.js (em outro terminal) e depois URL_JOGO=http://localhost:8153 node teste-robo.js
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.env.URL_JOGO || 'http://localhost:8153';
const NOME = 'Robô';
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const navegador = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const erros = [];
  const abreTela = async (endereco = '/?bot') => {
    const tela = await navegador.newPage({ viewport: { width: 1600, height: 900 } });
    tela.on('pageerror', e => erros.push(e.message));
    await tela.goto(URL + endereco); await espera(5000);
    return tela;
  };
  const celular = async lugar => {
    const c = await navegador.newPage({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true });
    await c.goto(URL + '/c');
    await c.getByText('Jogador ' + lugar, { exact: true }).first().tap();
    return c;
  };
  const nomes = tela => tela.evaluate(() => window.__perfis.map(x => x.nome));
  const sala = tela => tela.evaluate(() => window.__sala());
  const controle = (tela, i) => tela.evaluate(k => { const e = window.__p.jogadores[k].ent; return [e.x, e.y]; }, i);
  const naIntro = tela => tela.waitForFunction(() => window.__sala().iniciou && window.__p.fase === 'intro', null, { timeout: 30000 });
  // a pessoa simulada so libera a rodada: dispensa a carta e fica pronta
  const liberaPessoa = (tela, i) => tela.evaluate(k => { const j = window.__p.jogadores[k]; j.oferta = null; j.pronto = true; }, i);

  // 1. Com dois celulares de verdade o robo nao ocupa lugar, nem quando um deles some no meio da partida
  let tela = await abreTela();
  const um = await celular(1); await espera(1500);
  assert.deepEqual(await nomes(tela), ['', NOME, '', ''], 'com um celular no lugar 1, o robo senta no lugar 2');
  const dois = await celular(2); await espera(2500);
  assert.deepEqual(await nomes(tela), ['', '', '', ''], 'chegou o segundo celular: o robo levanta e devolve o nome');
  assert.equal((await sala(tela)).lugarRobo, -1, 'robo sem lugar');
  await naIntro(tela);
  await um.close(); await espera(6000);
  assert.deepEqual(await nomes(tela), ['', '', '', ''], 'celular sumiu no meio da partida: o robo nao assume o lugar');
  assert.deepEqual(await tela.evaluate(() => window.__p.jogadores.map(j => !!j.pronto)), [false, false], 'ninguem apertou pronto por outra pessoa');
  await dois.close(); await tela.close();
  console.log('ok com dois celulares o robo so assiste');

  // 2. Com um celular so, em qualquer dos dois lugares, o robo senta no outro, joga de verdade e fecha a rodada
  for (const lugar of [1, 2]) {
    tela = await abreTela();
    const c = await celular(lugar); await espera(1500);
    const dele = 2 - lugar, esperado = ['', '', '', '']; esperado[dele] = NOME;
    assert.deepEqual(await nomes(tela), esperado, `celular no lugar ${lugar}: o robo no outro`);
    await naIntro(tela);
    await tela.waitForFunction(i => window.__p.jogadores[i].pronto, dele, { timeout: 15000 });       // o robo le e diz que entendeu sozinho
    await liberaPessoa(tela, lugar - 1);
    await tela.waitForFunction(() => window.__p.fase === 'jogando', null, { timeout: 20000 });
    // ele mexe o joystick: nao e so a rodada fechando pelo tempo
    await tela.waitForFunction(i => { const e = window.__p.jogadores[i].ent; return e.x !== 0 || e.y !== 0; }, dele, { timeout: 15000 });
    await tela.waitForFunction(() => window.__p.fase !== 'jogando', null, { timeout: 90000 });
    assert.equal(await tela.evaluate(() => window.__p.erros.length), 0, 'a rodada com o robo fecha sem erro de minijogo');
    await c.close(); await tela.close();
    console.log(`ok celular no lugar ${lugar}: o robo jogou a rodada inteira`);
  }

  // 3. Um celular de verdade entra no lugar do robo no meio da partida e depois some: o lugar continua da pessoa
  tela = await abreTela();
  const anfitriao = await celular(1); await espera(1500);
  await naIntro(tela);
  const atrasado = await celular(2); await espera(2500);
  assert.equal((await sala(tela)).lugarRobo, -1, 'chegou gente no lugar do robo: ele levanta');
  assert.deepEqual(await nomes(tela), ['', '', '', ''], 'e devolve o nome');
  await atrasado.close(); await espera(5000);
  assert.equal((await sala(tela)).lugarRobo, -1, 'o celular sumiu, mas o robo nao volta no meio da partida');
  const parado = await controle(tela, 1);
  await espera(2000);
  assert.deepEqual(await controle(tela, 1), parado, 'ninguem mexe no controle do lugar 2');
  await anfitriao.close(); await tela.close();
  console.log('ok celular que entra no lugar do robo fica com o lugar ate o fim da partida');

  // 4. Desligar com B enquanto ele esta sentado devolve o nome e o lugar
  tela = await abreTela();
  const sozinho = await celular(1); await espera(1500);
  assert.equal((await sala(tela)).lugarRobo, 1);
  await tela.keyboard.press('KeyB'); await espera(2500);
  assert.equal((await sala(tela)).lugarRobo, -1, 'B com o robo sentado: ele levanta');
  assert.deepEqual(await nomes(tela), ['', '', '', ''], 'e o nome do lugar volta a ficar vazio');
  assert.equal((await sala(tela)).iniciou, false, 'sem o robo, um celular so nao comeca partida');
  await sozinho.close(); await tela.close();
  console.log('ok a tecla B tira o robo do lugar');

  // 5. Sem robo: escolha antiga de modo, repetida a uma tela recarregada, nao desliga o padrao por quantos estao no sofa
  tela = await abreTela('/');
  const a = await celular(1), b = await celular(2); await espera(1000);
  await a.locator('#menuLista [data-m="vs"]').tap(); await espera(1200);       // o anfitriao escolhe Cada um por si agora
  let s = await sala(tela);
  assert.equal(s.escolhaModo, 'vs');
  assert.equal(s.semAuto, true, 'escolha feita agora desliga o comeco automatico');
  assert.equal(s.lugarRobo, -1, 'sem ?bot nao ha robo');
  await espera(7500);
  assert.equal((await sala(tela)).iniciou, false, 'e a partida nao comeca sozinha');
  await tela.reload(); await espera(6000);       // a tela nova recebe a escolha antiga do servidor
  s = await sala(tela);
  assert.equal(s.escolhaModo, 'classico', 'com 2 no sofa o padrao volta a ser o Duelo');
  await tela.waitForFunction(() => window.__sala().iniciou, null, { timeout: 15000 });
  assert.equal(await tela.evaluate(() => window.__p.modo), 'classico', 'e ele comeca sozinho');
  await a.close(); await b.close(); await tela.close();
  console.log('ok escolha antiga de modo nao prende a sala');

  assert.deepEqual(erros, [], 'sem erro de pagina');
  await navegador.close();
  console.log('TUDO OK (teste-robo)');
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
