// Servidor sem dependencias. Tudo fica na rede local, nada passa pela internet.
// Celular -> POST /in -> tela (SSE /eventos).   Tela -> POST /tela -> celulares (SSE /eventos-c).
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;    // PORT=81xx sobe uma copia de teste sem mexer na partida de verdade
const HTML = 'text/html; charset=utf-8', JS = 'text/javascript; charset=utf-8';
// Lista fechada de arquivos servidos (nada de caminho vindo da URL).
const ARQUIVOS = {
  '/': ['tela.html', HTML],
  '/c': ['controle.html', HTML],
  '/logica.mjs': ['logica.mjs', JS],
  '/three/three.module.js': ['node_modules/three/build/three.module.js', JS],
  '/three/three.core.js': ['node_modules/three/build/three.core.js', JS],
  // carregador de modelos glTF (o importmap da tela aponta 'three/addons/' para ca); so o que o GLTFLoader importa
  '/three/addons/loaders/GLTFLoader.js': ['node_modules/three/examples/jsm/loaders/GLTFLoader.js', JS],
  '/three/addons/utils/BufferGeometryUtils.js': ['node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', JS],
  '/three/addons/utils/SkeletonUtils.js': ['node_modules/three/examples/jsm/utils/SkeletonUtils.js', JS],
};
const PASTA_JOGOS = path.join(__dirname, 'jogos');
const PASTA_MODELOS = path.join(__dirname, 'modelos');
const MODELO = /^\/modelos\/([a-z0-9_-]+)\/([a-z0-9_-]+)\.(glb|png)$/;     // so modelos/<pacote>/<arquivo>.glb ou .png (a textura); licenca e o resto nao saem
const TIPO_MODELO = { glb: 'model/gltf-binary', png: 'image/png' };
const NOME_JOGO = /^[a-z0-9-]+\.mjs$/;          // so minijogos prontos; testes e apoio (_x, x.test) ficam de fora
const PASTA_FONTES = path.join(__dirname, 'fontes');
const FONTE = /^\/fontes\/([a-z0-9_-]+)\.woff2$/;    // so fontes/<nome>.woff2; a licenca OFL fica ao lado e nao sai
const COMANDOS = ['pula', 'reinicia', 'menu', 'continua'];      // o que o Jogador 1 pode pedir pela pausa do celular

let telas = [];
const SLOTS = 4;                                // de 1 a 4 jogadores (o Classico usa so os dois primeiros)
const celulares = Array.from({ length: SLOTS }, () => new Set());       // conexoes SSE de cada jogador
const perfis = Array(SLOTS).fill(null);         // ultimo perfil (nome e skin) de cada jogador, ja em JSON
const estado = Array(SLOTS).fill('{}');         // ultimo estado de controle mandado pela tela, por jogador
const MODOS = ['classico', 'vs', 'times', 'coop'];
let escolha = null;                             // ultima escolha de modo do anfitriao (Jogador 1), ja em JSON

// Rede de casa costuma ser 192.168; 10.x e 172.16-31 vem depois (VPN tambem usa essas faixas).
function ip() {
  const todos = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
  return todos.find(a => a.startsWith('192.168.'))
    ?? todos.find(a => /^(10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)) ?? 'localhost';
}

// Cliente que nao le (ou le devagar) nao pode fazer a memoria do servidor crescer: acima de 64 KB parado, cai.
function manda(res, msg) {
  if (res.writableLength > 64 * 1024) return res.destroy();
  res.write(`data: ${msg}\n\n`);
}

// Poucas conexoes de cada tipo bastam numa casa; a mais antiga sai quando passa do limite.
const MAX_CONEXOES = 6;

function sse(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('\n');
}

function leCorpo(req, limite, usa) {
  let corpo = '';
  req.on('data', d => { corpo += d; if (corpo.length > limite) req.destroy(); });
  req.on('end', () => { try { usa(JSON.parse(corpo)); } catch {} });
}

function inteiro(v) { return Number.isInteger(v) ? v : undefined; }
function slot(v) { return Number.isInteger(v) && v >= 1 && v <= SLOTS ? v : undefined; }       // numero do jogador, de 1 a 4
function reacao(v) { return Number.isInteger(v) && v >= 0 && v <= 63 ? v : undefined; }   // indice na lista fixa de emojis da tela
function contador(v) { return Number.isInteger(v) && v >= 0 && v <= 1e9 ? v : undefined; }    // contador que so cresce (torcida)

function listaJogos() {
  try {
    return fs.readdirSync(PASTA_JOGOS).filter(n => NOME_JOGO.test(n))
      .map(n => ({ arq: n, v: Math.round(fs.statSync(path.join(PASTA_JOGOS, n)).mtimeMs) }));
  } catch { return []; }
}

function arquivo(res, caminho, tipo) {
  let conteudo;
  try { conteudo = fs.readFileSync(caminho); }
  catch { res.writeHead(500); return res.end('arquivo ausente'); }
  res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
  res.end(conteudo);
}

// Entrada de um celular (vinda por POST /in ou pelo WebSocket): limpa e repassa para a tela.
function recebeEntrada(m) {
  if (!m || typeof m !== 'object' || !slot(m.j)) return;
  const msg = JSON.stringify({
    j: m.j, x: +m.x || 0, y: +m.y || 0, d: !!m.d, b: !!m.b,
    n: inteiro(m.n), nb: inteiro(m.nb), op: inteiro(m.op), nop: inteiro(m.nop), s: inteiro(m.s), q: inteiro(m.q),
    r: reacao(m.r), nr: inteiro(m.nr), nt: contador(m.nt),
  });
  for (const t of telas) manda(t, msg);
}

// WebSocket minimo, so para receber as entradas do celular: quadros de texto curtos e mascarados (RFC 6455).
function websocket(req, socket) {
  const chave = req.headers['sec-websocket-key'];
  if (req.url !== '/ws' || !chave) return socket.destroy();
  const aceite = crypto.createHash('sha1').update(chave + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${aceite}\r\n\r\n`);
  socket.setNoDelay(true);
  socket.setTimeout(30000, () => socket.destroy());     // celular manda sinal de vida a cada 400 ms
  let buf = Buffer.alloc(0);
  socket.on('error', () => {});
  socket.on('data', pedaco => {
    buf = Buffer.concat([buf, pedaco]);
    if (buf.length > 8192) return socket.destroy();
    while (buf.length >= 2) {
      const op = buf[0] & 15, mascarado = buf[1] & 128;
      let tam = buf[1] & 127, cab = 2;
      if (tam === 126) { if (buf.length < 4) return; tam = buf.readUInt16BE(2); cab = 4; }
      if (!mascarado || tam === 127 || tam > 2000) return socket.destroy();     // cliente de navegador sempre mascara
      if (buf.length < cab + 4 + tam) return;
      const mascara = buf.subarray(cab, cab + 4), dados = Buffer.from(buf.subarray(cab + 4, cab + 4 + tam));
      for (let k = 0; k < tam; k++) dados[k] ^= mascara[k & 3];
      buf = buf.subarray(cab + 4 + tam);
      if (op === 8) return socket.end();
      if (op === 1) { try { recebeEntrada(JSON.parse(dados.toString('utf8'))); } catch {} }
    }
  });
}

const servidor = http.createServer((req, res) => {
  const [url, consulta = ''] = req.url.split('?');
  if (Object.hasOwn(ARQUIVOS, url)) return arquivo(res, path.join(__dirname, ARQUIVOS[url][0]), ARQUIVOS[url][1]);
  const modelo = MODELO.exec(url);
  if (modelo) {
    const caminho = path.join(PASTA_MODELOS, modelo[1], modelo[2] + '.' + modelo[3]);
    if (!fs.existsSync(caminho)) { res.writeHead(404); return res.end(); }
    return arquivo(res, caminho, TIPO_MODELO[modelo[3]]);
  }
  const fonte = FONTE.exec(url);
  if (fonte) {
    const caminho = path.join(PASTA_FONTES, fonte[1] + '.woff2');
    if (!fs.existsSync(caminho)) { res.writeHead(404); return res.end(); }
    return arquivo(res, caminho, 'font/woff2');
  }
  if (url === '/ip') return res.end(`http://${ip()}:${PORT}/c`);

  if (url === '/lugares' && req.method === 'GET') {     // quais lugares tem celular conectado agora (a escolha do lugar no celular mostra "ocupado")
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(celulares.map(c => c.size > 0)));
  }

  if (url === '/jogos') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify(listaJogos()));
  }
  if (url.startsWith('/jogos/')) {
    const nome = url.slice(7);
    if (!NOME_JOGO.test(nome)) { res.writeHead(404); return res.end(); }
    return arquivo(res, path.join(PASTA_JOGOS, nome), JS);
  }

  if (url === '/eventos') {
    if (telas.length >= MAX_CONEXOES) { res.writeHead(503); return res.end(); }   // recusa a sobra em vez de derrubar a tela que ja esta
    sse(res);
    for (const perfil of perfis) if (perfil) res.write(`data: ${perfil}\n\n`);
    if (escolha) res.write(`data: ${escolha}\n\n`);
    telas.push(res);
    req.on('close', () => { telas = telas.filter(t => t !== res); });
    return;
  }

  if (url === '/eventos-c') {                   // celular escuta o que a tela manda para ele
    const achou = /(^|&)j=(\d{1,3})(&|$)/.exec(consulta), i = slot(achou ? Number(achou[2]) : undefined) - 1;
    if (!(i >= 0)) { res.writeHead(400); return res.end(); }
    // todas as conexoes do slot sao do mesmo jogador: a mais antiga (provavel zumbi de celular que dormiu) sai
    if (celulares[i].size >= MAX_CONEXOES) {
      const velha = celulares[i].values().next().value;
      celulares[i].delete(velha); velha.destroy();
    }
    let v = 0;
    try { v = Math.round(fs.statSync(path.join(__dirname, 'controle.html')).mtimeMs); } catch {}
    sse(res);
    if (v) res.write(`data: ${JSON.stringify({ versao: v })}\n\n`);      // pagina desatualizada se recarrega sozinha
    res.write(`data: ${estado[i]}\n\n`);
    celulares[i].add(res);
    req.on('close', () => celulares[i].delete(res));
    return;
  }

  if (url === '/in' && req.method === 'POST') {
    leCorpo(req, 500, recebeEntrada);
    req.on('end', () => res.end('ok'));
    return;
  }

  if (url === '/perfil' && req.method === 'POST') {   // nome e skin escolhidos no celular
    leCorpo(req, 500, m => {
      if (!slot(m?.j)) return;
      const i = m.j - 1;
      perfis[i] = JSON.stringify({ perfil: { j: i + 1, nome: String(m.nome ?? '').slice(0, 10), cor: inteiro(m.cor) ?? i, chapeu: inteiro(m.chapeu) ?? 0 } });
      for (const t of telas) manda(t, perfis[i]);
    });
    req.on('end', () => res.end('ok'));
    return;
  }

  if (url === '/modo' && req.method === 'POST') {     // o Jogador 1 (anfitriao) escolhe o modo e manda comecar
    leCorpo(req, 200, m => {
      if (m?.j !== 1 || !MODOS.includes(m.modo)) return;
      const msg = JSON.stringify({ escolha: { modo: m.modo, comeca: m.comeca === true } });
      for (const t of telas) manda(t, msg);
      // tela que abrir depois sabe o modo, mas nao recomeca nem cancela o inicio automatico; ao virar partida (comeca) a escolha e esquecida
      escolha = m.comeca === true ? null : JSON.stringify({ escolha: { modo: m.modo, comeca: false, antiga: true } });
    });
    req.on('end', () => res.end('ok'));
    return;
  }

  if (url === '/modo-limpa' && req.method === 'POST') {   // a tela voltou ao menu (ou a partida acabou): esquece a escolha velha
    escolha = null;
    req.resume();
    return res.end('ok');
  }

  if (url === '/pausa' && req.method === 'POST') {    // botao de pausa do celular; corpo opcional { j, continua }: quem pediu e se e so para continuar
    let corpo = '', grande = false;
    req.on('data', d => { corpo += d; if (corpo.length > 100) { grande = true; req.destroy(); } });
    req.on('end', () => {
      if (grande) return;
      let m = {};
      try { m = corpo ? JSON.parse(corpo) : {}; } catch {}
      const msg = { pausa: true };
      if (slot(m?.j)) msg.j = m.j;
      if (m?.continua === true) msg.continua = true;
      for (const t of telas) manda(t, JSON.stringify(msg));
      res.end('ok');
    });
    return;
  }

  if (url === '/comando' && req.method === 'POST') {  // pausa do celular do Jogador 1: pular, recomecar, voltar ao menu ou continuar
    leCorpo(req, 100, m => {
      if (m?.j !== 1 || !COMANDOS.includes(m.c)) return;
      for (const t of telas) manda(t, JSON.stringify({ comando: m.c }));
    });
    req.on('end', () => res.end('ok'));
    return;
  }

  if (url === '/tela' && req.method === 'POST') {     // { c: [estado do jogador 1, 2, 3 e 4] }
    leCorpo(req, 8000, m => {
      for (let i = 0; i < SLOTS; i++) {
        if (!m.c?.[i]) continue;
        estado[i] = JSON.stringify(m.c[i]);
        for (const c of celulares[i]) manda(c, estado[i]);
      }
    });
    req.on('end', () => res.end('ok'));
    return;
  }
  res.writeHead(404); res.end();
});
servidor.on('upgrade', websocket);
servidor.listen(PORT, '0.0.0.0', () => {
  console.log(`Tela do PC:  http://localhost:${PORT}`);
  console.log(`Celulares:   http://${ip()}:${PORT}/c`);
});
