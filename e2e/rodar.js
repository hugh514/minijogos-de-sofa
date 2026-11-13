// Sobe o servidor numa porta livre de teste, roda cada teste de navegador contra ele e desliga no fim.
// Uso: npm run e2e   (antes, uma vez: npm install && npx playwright install chromium)
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const PORTA = Number(process.env.PORTA_E2E) || 8170;
const URL_JOGO = `http://127.0.0.1:${PORTA}`;
const TESTES = ['teste-boost.js', 'teste-festa.js', 'teste-controles.js', 'teste-reacoes.js', 'teste-kart.js'];
const raiz = path.join(__dirname, '..');

function responde() {
  return new Promise(ok => http.get(URL_JOGO + '/ip', r => { r.resume(); ok(r.statusCode === 200); }).on('error', () => ok(false)));
}

(async () => {
  const servidor = spawn(process.execPath, ['server.js'], { cwd: raiz, env: { ...process.env, PORT: String(PORTA) }, stdio: 'ignore' });
  let falhas = 0;
  try {
    let pronto = false;
    for (let k = 0; k < 50 && !pronto; k++) { pronto = await responde(); if (!pronto) await new Promise(r => setTimeout(r, 200)); }
    if (!pronto) throw new Error(`o servidor nao respondeu na porta ${PORTA}`);
    for (const t of TESTES) {
      console.log(`\n== ${t}`);
      const r = spawnSync(process.execPath, [path.join(__dirname, t)], { stdio: 'inherit', env: { ...process.env, URL_JOGO } });
      if (r.status !== 0) { falhas++; console.log(`FALHOU: ${t}`); }
    }
  } catch (e) {
    falhas++; console.error(e.message);
  } finally {
    servidor.kill();
  }
  console.log(falhas ? `\n${falhas} teste(s) de navegador falharam` : '\nTodos os testes de navegador passaram');
  process.exit(falhas ? 1 : 0);
})();
