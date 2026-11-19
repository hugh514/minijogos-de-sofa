// Sobe o servidor numa porta livre de teste, roda cada teste de navegador contra ele e desliga no fim.
// Uso: npm run e2e   (antes, uma vez: npm install && npx playwright install chromium)
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const PORTA = Number(process.env.PORTA_E2E) || 8170;
const URL_JOGO = `http://127.0.0.1:${PORTA}`;
const TESTES = ['teste-boost.js', 'teste-festa.js', 'teste-controles.js', 'teste-textos.js', 'teste-novos.js', 'teste-robo.js', 'teste-reacoes.js', 'teste-kart.js'];
const TEMPO_POR_TESTE = 10 * 60 * 1000;      // um navegador travado nao segura o runner para sempre
const raiz = path.join(__dirname, '..');

function responde() {
  return new Promise(ok => http.get(URL_JOGO + '/ip', r => { r.resume(); ok(r.statusCode === 200); }).on('error', () => ok(false)));
}

(async () => {
  // Se ja tem alguem na porta, os testes rodariam contra ele (talvez um servidor velho ou a partida de verdade)
  if (await responde()) {
    console.error(`A porta ${PORTA} ja esta em uso. Feche o que esta nela ou escolha outra com PORTA_E2E.`);
    process.exit(1);
  }
  const servidor = spawn(process.execPath, ['server.js'], { cwd: raiz, env: { ...process.env, PORT: String(PORTA) }, stdio: ['ignore', 'ignore', 'inherit'] });
  let caiu = false;
  servidor.on('exit', () => { caiu = true; });
  let falhas = 0;
  try {
    let pronto = false;
    for (let k = 0; k < 50 && !pronto && !caiu; k++) { pronto = await responde(); if (!pronto) await new Promise(r => setTimeout(r, 200)); }
    if (!pronto || caiu) throw new Error(`o servidor nao subiu na porta ${PORTA}`);
    for (const t of TESTES) {
      console.log(`\n== ${t}`);
      const r = spawnSync(process.execPath, [path.join(__dirname, t)], { stdio: 'inherit', env: { ...process.env, URL_JOGO }, timeout: TEMPO_POR_TESTE });
      if (r.status !== 0) { falhas++; console.log(`FALHOU: ${t}${r.error ? ' (' + r.error.code + ')' : ''}`); }
      if (caiu) throw new Error('o servidor de teste caiu no meio');
    }
  } catch (e) {
    falhas++; console.error(e.message);
  } finally {
    servidor.kill();
  }
  console.log(falhas ? `\n${falhas} teste(s) de navegador falharam` : '\nTodos os testes de navegador passaram');
  process.exit(falhas ? 1 : 0);
})();
