// Boliche: cada um na sua pista. Mire com o joystick, SEGURE o botão (a barra de força sobe e desce) e SOLTE no ponto bom.
// 5 lançamentos, os 10 pinos voltam em pé a cada um. Quem derrubar mais pinos vence.
import { maiorPlacar } from '../logica.mjs';

const LIMITE = 55;
export const LANCES = 5;
const PX = 5.5, PISTA = 1.55, CANAL = 2.05;                       // centro da pista de cada um, meia-largura útil e com canaleta
const Z_SAI = 6.5, Z_FUNDO = -8.6, Z_CABECA = -4.8, Z_BARRA = 7.7;
const R_BOLA = 0.45, R_PINO = 0.28, ESP_X = 0.7, ESP_Z = 0.75;
const ANG_MAX = 0.2, BALANCO = 0.09;                              // mira: joystick mais um balanço da seta
const V_MIN = 5, V_MAX = 20, FREIO = 5, F_TOQUE = 0.3, F_EXCESSO = 0.85, GIRO = 0.9, SEGURA_MAX = 6, T_ASSENTA = 1.3;

const lado = i => (i ? 1 : -1);
const limita = (v, max) => Math.max(-max, Math.min(max, v));
// Força (0 a 1) depois de "h" segundos segurando: sobe, desce, sobe...
export const forcaEm = h => { const m = (h * GIRO) % 2; return m < 1 ? m : 2 - m; };

function novosPinos(i) {
  const pinos = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c <= r; c++)
      pinos.push({ x: lado(i) * PX + (c - r / 2) * ESP_X, z: Z_CABECA - r * ESP_Z, vx: 0, vz: 0, caido: false, t: 0, dx: 0, dz: -1 });
  return pinos;
}

function texto(p, i, t, modo = 'padrao') {
  if (p.celular[i].texto === t && p.celular[i].modo === modo) return;
  p.celular[i] = { ...p.celular[i], modo, a: 'SEGURA', b: '', texto: t };
}

function derruba(p, i, pino, vx, vz) {
  const v = Math.hypot(vx, vz);
  pino.caido = true; pino.vx = vx; pino.vz = vz; pino.t = 0;
  pino.dx = v > 0.01 ? vx / v : 0; pino.dz = v > 0.01 ? vz / v : -1;
  p.dados.fx.push({ x: pino.x, y: 0.6, z: pino.z, cor: i, q: 6, forca: 4 });
}

function lanca(p, i, f) {
  const jg = p.dados.jog[i], v = V_MIN + (V_MAX - V_MIN) * f;
  let a = jg.ang;
  if (f > F_EXCESSO) a += (p.rng() * 2 - 1) * (f - F_EXCESSO) * 4;       // força demais: a bola escapa
  jg.bola = { x: lado(i) * PX, z: Z_SAI, vx: Math.sin(a) * v, vz: -Math.cos(a) * v, v, canal: false, giro: 0 };
  jg.forca = f; jg.fase = 'rola'; jg.t = 0;
  p.eventos.push('dash');
}

function rola(p, i, dt) {
  const jg = p.dados.jog[i], b = jg.bola;
  const v = Math.hypot(b.vx, b.vz), nv = Math.max(0, v - FREIO * dt);
  if (v > 0) { b.vx *= nv / v; b.vz *= nv / v; }
  b.v = nv; b.giro += nv * dt;
  b.x += b.vx * dt; b.z += b.vz * dt;
  if (!b.canal && Math.abs(b.x - lado(i) * PX) > PISTA) {
    b.canal = true; b.vz = -Math.abs(b.vz); b.vx = 0; b.x = lado(i) * PX + limita(b.x - lado(i) * PX, 1.8);
    p.eventos.push('queda');
  }
  if (!b.canal)
    for (const pino of jg.pinos) {
      if (pino.caido) continue;
      const dx = pino.x - b.x, dz = pino.z - b.z, dist = Math.hypot(dx, dz);
      if (dist >= R_BOLA + R_PINO) continue;
      const nx = dist > 0 ? dx / dist : 0, nz = dist > 0 ? dz / dist : -1, sp = Math.max(b.v, 2) * 0.9;
      derruba(p, i, pino, nx * sp * 0.45 + b.vx * 0.35, nz * sp * 0.45 + b.vz * 0.35);
      b.vx *= 0.94; b.vz *= 0.94;
      p.eventos.push('batida');
    }
  if (b.z < Z_FUNDO || b.v < 0.7) { jg.fase = 'espera'; jg.t = 0; }
}

function pinos(p, i, dt) {
  const lista = p.dados.jog[i].pinos, cx = lado(i) * PX, atrito = Math.exp(-1.6 * dt);
  for (const m of lista) {
    if (!m.caido) continue;
    m.t += dt;
    if (Math.hypot(m.vx, m.vz) > 2.5)
      for (const s of lista) {
        if (s.caido || Math.hypot(s.x - m.x, s.z - m.z) >= 2 * R_PINO + 0.05) continue;
        derruba(p, i, s, m.vx * 0.62, m.vz * 0.62);
        m.vx *= 0.85; m.vz *= 0.85;
      }
    m.x += m.vx * dt; m.z += m.vz * dt;
    m.vx *= atrito; m.vz *= atrito;
    if (Math.abs(m.x - cx) > CANAL) { m.x = cx + limita(m.x - cx, CANAL); m.vx *= -0.3; }
    if (m.z < -8.9 || m.z > 3) { m.z = Math.max(-8.9, Math.min(3, m.z)); m.vz *= -0.3; }
  }
}

export default {
  id: 'boliche', genero: 'mira', nome: 'Boliche', dica: 'Mire, segure o botão e solte no ponto verde da barra. Mais pinos em 5 lances vence!',
  controle: { modo: 'padrao', a: 'SEGURA', b: '' }, semMovimento: true, semDash: true, semPulo: true, rotulo: 'pinos',

  // Camera atras da linha de falta, baixa e olhando pista adentro: os pinos do fundo aparecem grandes (a camera padrao os deixava com 10 px).
  camera() { return { x: 0, y: 14.5, z: 18.5, ox: 0, oy: 0, oz: -1.6 }; },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 9, parede: true };
    p.jogadores.forEach((j, i) => { j.x = lado(i) * (PX + 2.6); j.z = Z_SAI; });
    p.dados = {
      placar: [0, 0], fx: [], balanco: BALANCO, aviso: '', avisoCor: '#ffd84d', tAviso: 0,
      jog: [0, 1].map(i => ({ fase: 'mira', lances: 0, hold: 0, forca: 0, ang: 0, livre: false, t: 0, bola: null, pinos: novosPinos(i), ultimo: 0 })),
    };
    for (const i of [0, 1]) texto(p, i, 'Lance 1 de ' + LANCES + '. Mire e segure o botão');
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.tAviso -= dt;
    if (d.tAviso <= 0) d.aviso = '';
    p.jogadores.forEach((j, i) => {
      const jg = d.jog[i], e = j.ent;
      j.vx = j.vz = 0;
      jg.ang = limita(e.x * 1.2, 1) * ANG_MAX + Math.sin(p.t * 2.1 + i * 1.3) * d.balanco;
      if (jg.fase === 'mira') {
        if (!e.d) jg.livre = true;
        if (j.apertouA > 0 && !e.d) lanca(p, i, F_TOQUE);              // toque que chegou já solto
        else if (e.d && (jg.livre || j.apertouA > 0)) { jg.fase = 'forca'; jg.hold = 0; jg.forca = 0; }
      } else if (jg.fase === 'forca') {
        jg.hold += dt; jg.forca = forcaEm(jg.hold);
        if (!e.d || jg.hold >= SEGURA_MAX) lanca(p, i, jg.forca);
      } else if (jg.fase === 'rola') {
        const sub = Math.ceil(dt * 120);
        for (let k = 0; k < sub && jg.fase === 'rola'; k++) rola(p, i, dt / sub);
      } else if (jg.fase === 'espera') {
        jg.t += dt;
        if (jg.t >= T_ASSENTA) {
          const n = jg.pinos.filter(x => x.caido).length;
          d.placar[i] += n; jg.lances++; jg.ultimo = n; jg.livre = false; jg.bola = null;
          if (n === 10) { d.aviso = 'Strike!'; d.tAviso = 1.4; p.eventos.push('gol'); }
          if (jg.lances >= LANCES) { jg.fase = 'fim'; texto(p, i, 'Fim dos lances: ' + d.placar[i] + ' pinos', 'espera'); }
          else { jg.fase = 'mira'; jg.pinos = novosPinos(i); texto(p, i, 'Lance ' + (jg.lances + 1) + ' de ' + LANCES + '. Mire e segure o botão'); }
        }
      }
      const passos = Math.ceil(dt * 120);
      for (let k = 0; k < passos; k++) pinos(p, i, dt / passos);
    });
    if (d.jog.every(jg => jg.fase === 'fim') || p.t >= LIMITE) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const caixa = (lx, ly, lz, cor, x, y, z, extra) => { const m = malha(new THREE.BoxGeometry(lx, ly, lz), cor, extra); m.position.set(x, y, z); grupo.add(m); return m; };
    pecas.bola = []; pecas.seta = []; pecas.barra = [];
    for (const i of [0, 1]) {
      const cx = lado(i) * PX, comp = Z_SAI - Z_FUNDO + 3, zc = (Z_SAI + 1.5 + Z_FUNDO) / 2;
      const semSombra = m => { m.castShadow = false; return m; };
      semSombra(caixa(PISTA * 2, 0.1, comp, 0xc98a4b, cx, -0.03, zc, { roughness: 0.55 }));                   // pista de madeira
      for (let k = -3; k <= 3; k++) semSombra(caixa(0.03, 0.02, comp, 0x9c6430, cx + k * 0.4, 0.03, zc));       // tábuas
      for (const s of [-1, 1]) {
        semSombra(caixa(CANAL - PISTA, 0.06, comp, 0x23232b, cx + s * (PISTA + CANAL) / 2, -0.12, zc));        // canaletas
        semSombra(caixa(0.12, 0.35, comp, 0x3a3a46, cx + s * (CANAL + 0.06), 0.1, zc));                        // muretas
      }
      caixa(CANAL * 2 + 0.3, 1.2, 0.3, 0x2a2f4a, cx, 0.5, Z_FUNDO - 0.35);                              // fundo da pista
      for (let k = 0; k < 7; k++) {                                                                     // setas de mira no piso
        const s = malha(new THREE.ConeGeometry(0.12, 0.35, 3), 0x7a4a1e); s.rotation.x = -Math.PI / 2;
        s.position.set(cx + (k - 3) * 0.32, 0.02, 2 - Math.abs(k - 3) * 0.3); grupo.add(s);
      }
      caixa(PISTA * 2, 0.02, 0.1, cores[i], cx, 0.04, Z_SAI + 0.7, { emissive: cores[i], emissiveIntensity: 0.6 });   // linha de falta
      const bola = malha(new THREE.SphereGeometry(R_BOLA, 20, 14), cores[i], { emissive: cores[i], emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.3 });
      for (const [ax, ay] of [[0.2, 0.38], [-0.12, 0.4], [0.05, 0.28]]) {      // furos
        const f = malha(new THREE.SphereGeometry(0.07, 8, 6), 0x111118); f.position.set(ax, ay, 0.4); bola.add(f);
      }
      grupo.add(bola); pecas.bola.push(bola);
      const seta = new THREE.Group();
      const haste = malha(new THREE.BoxGeometry(0.12, 0.05, 2.2), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 }); haste.position.set(0, 0, -1.6);
      const ponta = malha(new THREE.ConeGeometry(0.3, 0.6, 3), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 }); ponta.rotation.x = -Math.PI / 2; ponta.position.set(0, 0, -3.0);
      seta.add(haste, ponta); seta.traverse(o => { o.castShadow = false; }); grupo.add(seta); pecas.seta.push(seta);
      caixa(PISTA * 2, 0.08, 0.5, 0x1b1d2b, cx, 0.04, Z_BARRA);                                      // barra de força
      caixa(PISTA * 2 * 0.35, 0.1, 0.52, 0x35c26b, cx - PISTA + PISTA * 2 * 0.725, 0.045, Z_BARRA, { emissive: 0x1b6b3a });   // faixa boa (0,55 a 0,9)
      const enche = malha(new THREE.BoxGeometry(1, 0.14, 0.4), cores[i], { emissive: cores[i], emissiveIntensity: 0.8 });
      enche.position.set(cx - PISTA, 0.1, Z_BARRA); enche.castShadow = false; grupo.add(enche); pecas.barra.push(enche);
    }
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const { THREE, pecas, cores, p } = c, d = p.dados;
    const eixo = new THREE.Vector3();
    for (const i of [0, 1]) {
      const jg = d.jog[i], cx = lado(i) * PX;
      const lista = c.pool('pinos' + i, jg.pinos.length, () => {
        const g = new THREE.Group();
        const corpo = c.malha(new THREE.CylinderGeometry(0.17, 0.26, 0.62, 14), 0xf5f5f0); corpo.position.y = 0.31;
        const listra = c.malha(new THREE.CylinderGeometry(0.2, 0.21, 0.07, 14), 0xe02424); listra.position.y = 0.52;
        const pescoco = c.malha(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 12), 0xf5f5f0); pescoco.position.y = 0.72;
        const cabeca = c.malha(new THREE.SphereGeometry(0.14, 12, 10), 0xf5f5f0); cabeca.position.y = 0.9;
        const faixa = c.malha(new THREE.CylinderGeometry(0.105, 0.1, 0.05, 12), 0xe02424); faixa.position.y = 0.8;
        g.add(corpo, listra, pescoco, cabeca, faixa); g.scale.setScalar(1.3); return g;       // so o desenho cresce: a fisica segue R_PINO
      });
      jg.pinos.forEach((pn, k) => {
        const g = lista[k];
        const ang = pn.caido ? Math.min(1, pn.t / 0.35) * Math.PI / 2 : 0;
        g.position.set(pn.x, 0.24 * ang / (Math.PI / 2), pn.z);
        eixo.set(pn.dz, 0, -pn.dx);
        g.quaternion.setFromAxisAngle(eixo, ang);
      });
      const bola = pecas.bola[i], b = jg.bola, mira = jg.fase === 'mira' || jg.fase === 'forca';
      bola.visible = jg.fase !== 'fim';
      if (b) {
        bola.position.set(b.x, b.canal ? 0.25 : R_BOLA, Math.max(b.z, Z_FUNDO - 0.5));
        bola.rotation.x = -b.giro / R_BOLA;
      } else bola.position.set(cx, R_BOLA, Z_SAI);
      const seta = pecas.seta[i];
      seta.visible = mira; seta.position.set(cx, 0.06, Z_SAI - 0.5); seta.rotation.y = -jg.ang;
      const f = jg.fase === 'forca' ? jg.forca : 0, barra = pecas.barra[i];
      barra.visible = jg.fase === 'forca'; barra.scale.x = Math.max(0.01, f * PISTA * 2);
      barra.position.x = cx - PISTA + barra.scale.x / 2;
      const cor = f > F_EXCESSO ? 0xff3b30 : f >= 0.6 ? 0x35c26b : 0xffd84d;
      barra.material.color.set(cor); barra.material.emissive.set(cor);
      c.bonecos[i].position.x = p.jogadores[i].x;
    }
    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const e = d.fx[pecas.nfx];
      c.particulas(e.x, e.y, e.z, cores[e.cor], e.q, e.forca);
    }
  },
};
