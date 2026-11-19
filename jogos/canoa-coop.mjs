// Canoa Maluca (Festa, cooperativo de 2 a 4 jogadores).
// Objetivo unico: descer o rio ate a linha de chegada antes do tempo acabar. Todos estao no mesmo bote, e cada um rema de um lado
// (o primeiro e o terceiro na esquerda, o segundo e o quarto na direita). Um toque em Remar empurra o bote para a frente e vira para o
// lado contrario ao do remo. Os dois lados iguais seguem reto; remar ao mesmo tempo dos dois lados rende remada junta, mais forte.
// Para desviar de uma pedra, so um dos lados rema por um instante. Pedra batida so atrasa; estrela da um empurrao.
import { RAIO } from '../logica.mjs';

export const LX = 11, LZ = 8, RIO = 6.4, TEMPO = 40;
export const ZB = 2.4;                               // o bote fica parado nesta altura da tela; o rio e que anda
export const IMPULSO = 0.4, GIRO = 0.2, ATRITO = 0.55, VOLTA = 1.1, VMAX = 7, JUNTA = 0.3, ENTRE_TOQUES = 0.14;
export const CORRENTE = 1.6;                           // a correnteza ja leva o bote um pouco, mesmo sem remar
export const LARG = 1.9, COMP = 2.6, R_PEDRA = 1.1;   // meia largura e meio comprimento da area de colisao do bote, e raio da pedra
export const LIMITE_X = 4.4;                           // quanto o centro do bote pode se afastar do meio do rio
const ESTRELA_R = 1.0;

const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };
const noiteDe = p => limita(p.noites?.jogadas ?? 0, 0, 4);
const mod = (a, b) => ((a % b) + b) % b;

// Quanto rio ha para descer: um pouco mais a cada noite.
export const distanciaDe = (n, noite) => 96 + 5 * noite;
// Quantas pedras por trecho: nas primeiras noites so uma, depois portoes e vai-e-volta.
export const padroesDe = noite => (noite >= 3 ? ['uma', 'portao', 'vaivem', 'uma'] : noite >= 1 ? ['uma', 'portao', 'uma'] : ['uma']);
const LANES = [-3.2, -1.6, 0, 1.6, 3.2];

// Posicao de cada lugar no bote (x para a direita, z para tras).
export function assentos(n) {
  const ass = [[-1.05, n <= 2 ? 0.3 : -0.9], [1.05, n <= 2 ? 0.3 : -0.9], [-1.05, 1.5], [1.05, 1.5]];
  return ass.slice(0, n);
}
export const ladoDe = i => (i % 2 === 0 ? -1 : 1);       // -1 esquerda, 1 direita

function geraRio(p, n, noite) {
  const D = distanciaDe(n, noite), padroes = padroesDe(noite), pedras = [], estrelas = [];
  let ultimo = 0;
  for (let s = 18; s < D - 14; s += 11) {
    const tipo = padroes[Math.floor(p.rng() * padroes.length)], jitter = (p.rng() - 0.5) * 3, ss = s + jitter;
    if (tipo === 'portao') {
      pedras.push({ s: ss, x: -4.2, bateu: false }, { s: ss, x: 4.2, bateu: false });
      estrelas.push({ s: ss + 0.2, x: 0, pegou: false });
    } else if (tipo === 'vaivem') {
      const a = p.rng() < 0.5 ? -1 : 1;
      pedras.push({ s: ss, x: a * 2.2, bateu: false }, { s: ss + 6, x: -a * 2.2, bateu: false });
      estrelas.push({ s: ss + 3, x: -a * 2.2 + a * 1, pegou: false });
    } else {
      let k = Math.floor(p.rng() * LANES.length);
      if (k === ultimo) k = (k + 1 + Math.floor(p.rng() * 3)) % LANES.length;
      ultimo = k;
      const x = LANES[k];
      pedras.push({ s: ss, x, bateu: false });
      estrelas.push({ s: ss + 3.2, x: x > 0 ? x - 2.8 : x + 2.8, pegou: false });
    }
  }
  return { pedras, estrelas };
}

function aviso(d, texto, cor = '#ffffff', t = 2) { d.aviso = texto; d.avisoCor = cor; d.avisoT = t; }

// Qual a proxima pedra no caminho e para que lado o bote deve ir para desviar (-1 esquerda, 1 direita).
export function ameaca(d) {
  let melhor = null;
  for (const pe of d.pedras) {
    const ahead = pe.s - d.s;
    if (pe.bateu || ahead < -1 || ahead > 14 || Math.abs(d.x - pe.x) > LARG + R_PEDRA + 0.5) continue;
    if (!melhor || ahead < melhor.ahead) melhor = { pe, ahead };
  }
  if (!melhor) return null;
  const pe = melhor.pe;
  const vizinha = d.pedras.find(o => o !== pe && Math.abs(o.s - pe.s) < 1 && !o.bateu);       // portao: o caminho e o meio
  let dir = d.x < pe.x ? -1 : 1;
  if (Math.abs(d.x - pe.x) < 0.4) dir = pe.x > 0 ? -1 : pe.x < 0 ? 1 : (d.x <= 0 ? -1 : 1);
  if (vizinha) dir = d.x < 0 ? 1 : d.x > 0 ? -1 : 0;
  const alvoX = vizinha ? 0 : limita(pe.x + dir * (LARG + R_PEDRA + 0.4), -LIMITE_X, LIMITE_X);
  const quer = Math.abs(alvoX - d.x) < 0.5 ? 0 : Math.sign(alvoX - d.x);
  return { pe, ahead: melhor.ahead, quer };
}

function textoDe(p, d, i) {
  const lado = d.lado[i] < 0 ? 'esquerdo' : 'direito';
  if (p.t < 3) return 'Você rema no lado ' + lado + '. Toque Remar!';
  if (d.boost > 0) return 'Estrela! O bote está voando.';
  const a = d.ame;
  if (a && a.quer !== 0) {
    const quem = -a.quer < 0 ? 'esquerdo' : 'direito';                     // o lado que rema para virar para onde se quer ir
    return 'Pedra à frente! Só o lado ' + quem + ' rema.';
  }
  if (a) return 'Pedra à frente! Remem juntos e sigam reto.';
  if (d.sinc > 0 && d.juntas >= 3) return 'Remando juntos! Continuem assim.';
  return 'Lado ' + lado + '. Remem juntos para ir reto.';
}

function toque(p, d, i) {
  const lado = d.lado[i], peso = d.peso[lado], oposto = -lado;
  const pareada = d.usado[oposto] === false && p.t - d.ultimo[oposto] < JUNTA;
  if (pareada) { d.usado[oposto] = true; d.usado[lado] = true; d.juntas++; d.sinc = 0.6; p.eventos.push('troca'); }
  else d.usado[lado] = false;
  d.ultimo[lado] = p.t;
  d.v += IMPULSO * peso * (pareada ? 1.6 : 1) * (d.boost > 0 ? 1.4 : 1);
  d.th += -lado * GIRO * peso;
  d.remo[i] = 0.4;
  const lz = d.ass[i][1], c = Math.cos(d.th), s = Math.sin(d.th), r = lado * 3.0;
  d.fx.push({ tipo: 'remo', x: d.x + r * c - lz * s, z: ZB + r * s + lz * c, i });
  if (pareada) d.fx.push({ tipo: 'junta', x: d.x, z: ZB });
}

function bate(p, d, pe) {
  pe.bateu = true; d.v *= 0.4; d.batidas++;
  const lado = d.x < pe.x ? -1 : d.x > pe.x ? 1 : (pe.x > 0 ? -1 : 1);
  d.kick = lado * 3.2; d.th += lado * 0.28;
  d.fx.push({ tipo: 'pedra', x: pe.x, z: ZB - (pe.s - d.s) });
  p.eventos.push('batida'); p.jogadores.forEach((_, i) => vibra(p, i));
  aviso(d, 'Bateu na pedra! Remem juntos.', '#ffb13b', 1.2);
}

export default {
  id: 'canoa-coop', genero: 'ritmo', nome: 'Canoa Maluca',
  dica: 'Toquem Remar juntos para descer o rio e desviem das pedras!',
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'botao', a: 'Remar' }, semMovimento: true, semDash: true, semPulo: true,
  rotulo: 'do rio', sufixo: '%', duracao: TEMPO, semNome: true,

  camera: () => ({ x: 0, y: 20, z: 10.5, ox: 0, oy: 0, oz: 0.3 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    const n = p.jogadores.length, noite = noiteDe(p), cada = f => p.jogadores.map((_, i) => f(i));
    const ass = assentos(n), lados = cada(ladoDe), cont = { '-1': 0, 1: 0 };
    lados.forEach(l => { cont[l]++; });
    const rio = geraRio(p, n, noite);
    p.jogadores.forEach((j, i) => { j.x = ass[i][0]; j.z = ZB + ass[i][1]; j.vx = j.vz = 0; });
    p.dados = {
      placar: [0], inventario: cada(i => [lados[i] < 0 ? 'Remo esquerdo' : 'Remo direito']), aviso: 'Remem juntos até a chegada!', avisoCor: '#ffd23f', avisoT: 3, fx: [],
      D: distanciaDe(n, noite), s: 0, x: 0, th: 0, v: 0, kick: 0, boost: 0, sinc: 0, juntas: 0, batidas: 0, estrelasPegas: 0, fim: '',
      pedras: rio.pedras, estrelas: rio.estrelas, ass, lado: lados, peso: { '-1': 1 / Math.max(1, cont['-1']), 1: 1 / Math.max(1, cont[1]) },
      ultimo: { '-1': -9, 1: -9 }, usado: { '-1': true, 1: true }, remo: cada(() => 0), tap: cada(() => 0), ame: null, texto: cada(() => ''),
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.sinc = Math.max(0, d.sinc - dt); d.boost = Math.max(0, d.boost - dt);
    js.forEach((j, i) => {
      d.remo[i] = Math.max(0, d.remo[i] - dt); d.tap[i] = Math.max(0, d.tap[i] - dt);
      if (j.apertouA > 0 && d.tap[i] <= 0) { d.tap[i] = ENTRE_TOQUES; toque(p, d, i); }
    });

    // o bote: atrito, vira de volta para a correnteza, anda; a correnteza traz para o meio do rio
    d.v = limita(d.v * Math.exp(-ATRITO * (1 + 2 * Math.abs(d.th)) * dt), 0, VMAX * (d.boost > 0 ? 1.25 : 1));       // bote torto freia: de lado a agua segura
    d.th = limita(d.th * Math.exp(-VOLTA * dt), -0.8, 0.8);
    d.kick *= Math.exp(-3 * dt);
    d.x += ((d.v + CORRENTE) * Math.sin(d.th) + d.kick) * dt - d.x * 0.1 * dt;
    if (Math.abs(d.x) > LIMITE_X) { d.x = Math.sign(d.x) * LIMITE_X; d.v *= Math.exp(-1.5 * dt); }       // raspando na margem
    d.s += (d.v + CORRENTE) * Math.cos(d.th) * dt;

    for (const pe of d.pedras) {
      if (pe.bateu) continue;
      const dx = (d.x - pe.x) / (LARG + R_PEDRA), ds = (d.s - pe.s) / (COMP + R_PEDRA);
      if (dx * dx + ds * ds < 1) bate(p, d, pe);
    }
    for (const e of d.estrelas) {
      if (e.pegou || Math.hypot(d.x - e.x, (d.s - e.s) * 0.7) > LARG + ESTRELA_R) continue;
      e.pegou = true; d.boost = 1.8; d.estrelasPegas++; d.v += 1.2;
      d.fx.push({ tipo: 'estrela', x: e.x, z: ZB - (e.s - d.s) }); p.eventos.push('moeda');
    }
    d.ame = ameaca(d);

    // os jogadores sentam no bote, que gira junto
    const c = Math.cos(d.th), s = Math.sin(d.th);
    js.forEach((j, i) => {
      const [lx, lz] = d.ass[i];
      j.x = d.x + lx * c - lz * s; j.z = ZB + lx * s + lz * c; j.vx = j.vz = 0;
    });

    d.placar = [Math.min(100, Math.floor(100 * d.s / d.D))];
    js.forEach((_, i) => { const texto = textoDe(p, d, i); if (texto !== d.texto[i]) { d.texto[i] = texto; p.celular[i] = { ...p.celular[i], a: d.lado[i] < 0 ? 'Remar à esquerda' : 'Remar à direita', texto }; } });

    if (d.s >= d.D) {
      d.fim = 'chegou'; aviso(d, 'Chegaram! Que descida!', '#6bff9a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'Chegaram! Vocês remaram juntos até o fim!' }; });
      return 2;
    }
    if (p.t >= TEMPO) {
      d.fim = 'tempo'; aviso(d, 'O tempo acabou. Faltou pouco do rio.', '#ff4a4a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'O tempo acabou. Na próxima, toquem Remar juntos, sem parar.' }; });
      return -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    const sem = m => { m.castShadow = false; return m; };
    pecas.visto = 0;

    // rio e margens
    const agua = sem(malha(caixa(RIO * 2, 0.05, LZ * 2 + 2), 0x2f8fdc, { roughness: 0.25, metalness: 0.1 })); agua.position.y = 0.03; grupo.add(agua);
    for (const lado of [-1, 1]) {
      const margem = sem(malha(caixa(LX - RIO + 0.5, 0.2, LZ * 2 + 2), 0x72bd55, { roughness: 1 })); margem.position.set(lado * (RIO + (LX - RIO + 0.5) / 2), 0.1, 0); grupo.add(margem);
      const areia = sem(malha(caixa(0.7, 0.22, LZ * 2 + 2), 0xe9d49a, { roughness: 1 })); areia.position.set(lado * (RIO + 0.35), 0.11, 0); grupo.add(areia);
    }
    // coisas que andam com o rio: marcas na agua, arvores, flores, pedras, estrelas e a chegada
    pecas.marcas = Array.from({ length: 16 }, (_, k) => {
      const m = sem(malha(caixa(0.12, 0.02, 0.9 + (k % 3) * 0.5), 0xcdeaff, { emissive: 0x6aa8dc, emissiveIntensity: 0.4 }));
      m.userData = { x: -RIO + 0.8 + (k * 2.17) % (RIO * 2 - 1.6), fase: k * 1.3 }; m.position.y = 0.08; grupo.add(m); return m;
    });
    pecas.arvores = [];
    for (const lado of [-1, 1]) for (let k = 0; k < 8; k++) {
      const h = 3 + ((k * 7 + (lado > 0 ? 3 : 0)) % 5) * 0.35, g = new THREE.Group();
      const tronco = malha(new THREE.CylinderGeometry(0.25, 0.35, h * 0.4, 8), 0x7a5230); tronco.position.y = h * 0.2;
      const copa = malha(new THREE.ConeGeometry(h * 0.34, h * 0.78, 9), k % 3 ? 0x2f8a46 : 0x3f9b3a, { roughness: 1 }); copa.position.y = h * 0.62;
      g.add(tronco, copa); g.userData = { x: lado * (RIO + 1.6 + (k % 3) * 1.15), off: k * 2.5 + (lado > 0 ? 1.1 : 0) }; grupo.add(g); pecas.arvores.push(g);
    }
    pecas.flores = Array.from({ length: 20 }, (_, k) => {
      const m = sem(malha(new THREE.SphereGeometry(0.17, 8, 6), [0xffffff, 0xffd23f, 0xff8fb8, 0xb28cff][k % 4]));
      m.userData = { x: (k % 2 ? 1 : -1) * (RIO + 0.9 + ((k * 5) % 4) * 0.9), off: k * 1.07 }; m.position.y = 0.3; grupo.add(m); return m;
    });
    
    // chegada: dois postes, uma faixa quadriculada e uma ponte de madeira (some e aparece conforme o rio chega)
    const ch = new THREE.Group();
    for (const s of [-1, 1]) { const poste = malha(caixa(0.5, 4.2, 0.5), 0xe8e4d8); poste.position.set(s * (RIO - 0.2), 2.1, 0); ch.add(poste); }
    const faixa = new THREE.Group();
    for (let k = 0; k < 16; k++) for (let r = 0; r < 2; r++) {
      const q = sem(malha(caixa((RIO * 2 - 1) / 16, 0.7, 0.12), (k + r) % 2 ? 0x1a1a1a : 0xffffff)); q.position.set(-RIO + 0.5 + (k + 0.5) * (RIO * 2 - 1) / 16, 3.55 - r * 0.7, 0); faixa.add(q);
    }
    ch.add(faixa);
    const chao = sem(malha(caixa(RIO * 2, 0.06, 1.2), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.5 })); chao.position.set(0, 0.09, 0); ch.add(chao);
    ch.visible = false; grupo.add(ch); pecas.chegada = ch;

    // barra do rio na margem direita: vai de baixo (saida) a cima (chegada)
    const trilha = sem(malha(caixa(0.55, 0.28, 12.4), 0x3a2b1e)); trilha.position.set(RIO + 0.35, 0.35, 0); grupo.add(trilha);
    pecas.fill = sem(malha(caixa(0.5, 0.34, 1), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.8 })); pecas.fill.position.set(RIO + 0.35, 0.38, 6); grupo.add(pecas.fill);
    const bandeira = new THREE.Group(), mastro = malha(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), 0xe8e4d8); mastro.position.y = 1.2;
    const pano = sem(malha(caixa(1.1, 0.7, 0.06), 0xd9301f)); pano.position.set(0.6, 2.0, 0); bandeira.add(mastro, pano); bandeira.position.set(RIO + 0.35, 0, -6.2); grupo.add(bandeira);
    pecas.iconeRio = sem(malha(new THREE.ConeGeometry(0.55, 1.1, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 })); pecas.iconeRio.rotation.x = -Math.PI / 2; grupo.add(pecas.iconeRio);

    // o bote: casco de madeira com proa, bancos, remos na cor de cada jogador, esteira e aro de remada junta
    const forma = new THREE.Shape();
    forma.moveTo(-2.1, 2.8); forma.lineTo(2.1, 2.8); forma.lineTo(2.1, -1.0); forma.quadraticCurveTo(1.9, -2.3, 0, -3.5); forma.quadraticCurveTo(-1.9, -2.3, -2.1, -1.0); forma.lineTo(-2.1, 2.8);
    const casco = malha(new THREE.ExtrudeGeometry(forma, { depth: 0.55, bevelEnabled: false }), 0xc07a3a, { roughness: 0.85 });
    casco.rotation.x = Math.PI / 2; casco.position.y = 0.4;       // o contorno vira planta (y do desenho vira z do mundo); a extrusao desce
    const miolo = new THREE.Shape();
    miolo.moveTo(-1.8, 2.5); miolo.lineTo(1.8, 2.5); miolo.lineTo(1.8, -0.9); miolo.quadraticCurveTo(1.6, -2.0, 0, -3.1); miolo.quadraticCurveTo(-1.6, -2.0, -1.8, -0.9); miolo.lineTo(-1.8, 2.5);
    const fundo = sem(malha(new THREE.ExtrudeGeometry(miolo, { depth: 0.08, bevelEnabled: false }), 0xe8c48a, { roughness: 1 })); fundo.rotation.x = Math.PI / 2; fundo.position.y = 0.48;
    const bote = new THREE.Group(); bote.add(casco, fundo);
    const proa = sem(malha(new THREE.SphereGeometry(0.35, 10, 8), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.6 })); proa.position.set(0, 0.8, -3.5); bote.add(proa);
    pecas.remos = c.bonecos.map((_, i) => {
      const lado = ladoDe(i), pivo = new THREE.Group(), tomb = new THREE.Group();
      const haste = malha(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8), 0xe8d9b0); haste.position.y = -0.4;
      const pa = malha(caixa(0.2, 1.2, 0.85), c.cores[i], { emissive: c.cores[i], emissiveIntensity: 0.5 }); pa.position.y = -2.4;
      tomb.add(haste, pa); tomb.rotation.z = lado * 1.0; pivo.add(tomb); bote.add(pivo); return { pivo, tomb, lado };
    });
    pecas.esteira = [-1, 1].map(s => { const m = sem(malha(caixa(0.18, 0.04, 1), 0xffffff, { emissive: 0xcfe8ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 })); m.userData.s = s; bote.add(m); return m; });
    pecas.aro = sem(malha(new THREE.TorusGeometry(3.2, 0.1, 6, 36), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 1, transparent: true, opacity: 0 })); pecas.aro.rotation.x = Math.PI / 2; pecas.aro.position.y = 0.2; bote.add(pecas.aro);
    grupo.add(bote); pecas.bote = bote;
  },

  desenha(c, dt, t) {
    const { THREE, pecas } = c, p = c.p, d = p.dados;
    if (!pecas.bote || !d.pedras) return;
    const s = d.s, v = d.v, zDe = sObj => ZB - (sObj - s);
    const pos = (z, folga = 1.2) => z > -LZ - 0.9 && z < LZ + folga;
    const entra = z => limita((z + LZ + 0.9) / 2.2, 0, 1);

    // bote: balanca, vira, remos batem
    pecas.bote.position.set(d.x, 0.04 * Math.sin(t * 3.1), ZB); pecas.bote.rotation.y = -d.th; pecas.bote.rotation.z = 0.035 * Math.sin(t * 2.3) - d.kick * 0.015;
    pecas.remos.forEach((r, i) => {
      const lz = (d.ass[i] ?? [0, 0])[1], u = Math.max(0, d.remo[i]) / 0.4, golpe = Math.sin((1 - u) * Math.PI);
      r.pivo.position.set(r.lado * 2.05, 1.5, lz + 0.1);
      r.pivo.rotation.y = d.remo[i] > 0 ? golpe * 0.55 * -1 : 0;
      r.tomb.rotation.z = r.lado * (0.95 + (d.remo[i] > 0 ? golpe * 0.1 : 0));
    });
    pecas.esteira.forEach(m => { const f = limita(v / 4, 0.1, 1.6); m.scale.z = f * 2.2; m.position.set(m.userData.s * 0.9 * (1 + f * 0.25), 0.13, 3.2 + f * 1.1); m.rotation.y = m.userData.s * (0.18 + 0.05 * f); });
    pecas.aro.material.opacity = d.sinc > 0 ? 0.9 * (d.sinc / 0.6) : 0; pecas.aro.scale.setScalar(1 + (0.6 - d.sinc) * 0.6);

    // o rio anda para baixo
    pecas.marcas.forEach(m => { m.position.set(m.userData.x, 0.08, mod(m.userData.fase * 1.7 + s * 1.0, LZ * 2 + 2) - LZ - 1); });
    pecas.arvores.forEach(g => { const z = mod(g.userData.off * 2.1 - s, LZ * 2 + 2) - LZ - 1; g.position.set(g.userData.x, 0, z); g.scale.setScalar(Math.max(0.01, entra(z))); });
    pecas.flores.forEach(m => { const z = mod(m.userData.off * 1.9 - s, LZ * 2 + 2) - LZ - 1; m.position.set(m.userData.x, 0.3, z); m.scale.setScalar(Math.max(0.01, entra(z))); });

    // pedras e estrelas
    const pedras = c.pool('pedras', d.pedras.length, () => {
      const g = new THREE.Group();
      const rocha = c.malha(new THREE.DodecahedronGeometry(1.35, 0), 0x8d939e, { roughness: 1 }); rocha.scale.set(1.05, 0.85, 1); rocha.position.y = 0.5;
      const topo = c.malha(new THREE.DodecahedronGeometry(0.8, 0), 0xa2a8b2, { roughness: 1 }); topo.position.set(-0.3, 1.2, 0.2);
      const musgo = c.malha(new THREE.SphereGeometry(0.5, 8, 6), 0x5c9a4a, { roughness: 1 }); musgo.scale.set(1, 0.4, 1); musgo.position.set(0.4, 1.0, -0.3);
      const espuma = c.malha(new THREE.TorusGeometry(1.7, 0.14, 6, 24), 0xf2fbff, { emissive: 0x9ad0ff, emissiveIntensity: 0.5 }); espuma.rotation.x = Math.PI / 2; espuma.position.y = 0.12; espuma.castShadow = false;
      g.add(rocha, topo, musgo, espuma); g.userData.espuma = espuma; return g;
    });
    d.pedras.forEach((pe, k) => {
      const g = pedras[k], z = zDe(pe.s); g.visible = pos(z) && !(pe.bateu && z > LZ);
      g.position.set(pe.x, 0, z); g.scale.setScalar(Math.max(0.01, entra(z))); g.rotation.y = k * 1.7;
      g.userData.espuma.scale.setScalar(1 + 0.08 * Math.sin(t * 4 + k));
    });
    const estrelas = c.pool('estrelas', d.estrelas.length, () => {
      const forma = new THREE.Shape(), R = 0.95, r = 0.42;
      for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, m = k % 2 ? r : R; forma[k ? 'lineTo' : 'moveTo'](Math.cos(a) * m, Math.sin(a) * m); }
      const e = c.malha(new THREE.ExtrudeGeometry(forma, { depth: 0.25, bevelEnabled: false }), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.9 }); e.castShadow = false;
      e.rotation.x = -Math.PI / 2; return e;
    });
    d.estrelas.forEach((e, k) => {
      const m = estrelas[k], z = zDe(e.s); m.visible = !e.pegou && pos(z);
      m.position.set(e.x, 0.7 + 0.15 * Math.sin(t * 4 + k), z); m.scale.setScalar(Math.max(0.01, entra(z)) * (1 + 0.08 * Math.sin(t * 6 + k)));
      m.rotation.z = t * 2 + k;
    });

    // chegada
    const zc = zDe(d.D);
    pecas.chegada.visible = zc > -LZ - 3 && zc < LZ + 4; pecas.chegada.position.set(0, 0, zc);

    // barra do rio
    const f = limita(s / d.D, 0, 1), z0 = 6, z1 = -6, zi = z0 + (z1 - z0) * f;
    pecas.fill.scale.z = Math.max(0.05, z0 - zi); pecas.fill.position.z = (z0 + zi) / 2;
    pecas.iconeRio.position.set(RIO + 0.35, 0.9, zi);

    // faiscas
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'remo') c.particulas(e.x, 0.3, e.z, 0xdff3ff, 7, 4);
      else if (e.tipo === 'junta') c.particulas(e.x, 1.2, e.z, 0xffd23f, 18, 7);
      else if (e.tipo === 'pedra') c.particulas(e.x, 0.9, e.z, 0xbfe3ff, 24, 8);
      else if (e.tipo === 'estrela') c.particulas(e.x, 1, e.z, 0xffd23f, 26, 9);
    }
  },
};
