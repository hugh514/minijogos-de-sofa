// Tiro ao Alvo da Turma (Festa, 2 a 4 jogadores: todos contra todos ou duplas). Cada um arrasta a mira da sua cor pelo celular e SOLTA
// o dedo para atirar. Todos disputam os mesmos alvos: disco comum vale 1, dourado (pequeno e ligeiro) vale 3 e a bomba vermelha tira 2.
// Quanto mais gente, mais alvos nascem. Em 30 s vence quem (ou a dupla) fizer mais pontos.
import { timeDe } from '../logica.mjs';

const LX = 11, LZ = 6.5, BX = 10.1, RZ = 3.4, MX = 8.2, MZ = 5.5, AX = 7.6, AZ = 4.9;      // boneco, fileiras, alcance da mira, area dos alvos
export const TEMPO = 30;
const T_DOBRO = 8, RECARGA = 0.4, GANHO = 1.4, SUAVE = 20, FOLGA = 0.45, T_SOBE = 0.15;
export const TIPOS = {
  comum: { pontos: 1, r: 1, vida: 2.4, vel: 0 },
  dourado: { pontos: 3, r: 0.62, vida: 1.5, vel: 3.5 },
  bomba: { pontos: -2, r: 0.9, vida: 2.6, vel: 0 },
};

// Com 2 jogadores cada um fica de um lado, no meio. Com 3 ou 4 os atiradores ficam em duas fileiras:
// J1 e J3 na esquerda, J2 e J4 na direita (a dupla A na esquerda), J1 e J2 em cima.
export function lugar(n, i) { return { x: (i % 2 ? 1 : -1) * BX, z: n <= 2 ? 0 : i < 2 ? -RZ : RZ }; }
export const maxAlvos = n => 8 + 2 * n;                 // 12 com 2 jogadores
export const entreAlvos = n => 1.4 / n;                 // 0,7 s com 2 jogadores; mais gente, mais alvos

const limita = (v, max) => Math.max(-max, Math.min(max, v));
const donoDe = (p, i) => (p.modo === 'times' ? timeDe(p, i) : i);
function vibra(p, i) { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; }
function recalcula(p) {
  const d = p.dados;
  d.placar = d.placar.map(() => 0);
  d.pontos.forEach((v, i) => { d.placar[donoDe(p, i)] += v; });
}
function vencedor(placar) {
  const maior = Math.max(...placar), lideres = placar.flatMap((v, k) => (v === maior ? [k] : []));
  return lideres.length === 1 ? lideres[0] : -1;
}
function texto(p, i, fim) {
  const v = p.dados.placar[donoDe(p, i)];
  return `${p.modo === 'times' ? 'Sua dupla' : 'Você'}: ${v} ${Math.abs(v) === 1 ? 'ponto' : 'pontos'}. ${fim ? 'Acabou o tempo!' : 'Arraste e solte para atirar'}`;
}

function nasce(p) {
  const d = p.dados, r = p.rng(), tipo = r < 0.6 ? 'comum' : r < 0.8 ? 'dourado' : 'bomba', def = TIPOS[tipo];
  let x = 0, z = 0;
  for (let k = 0; k < 8; k++) {                              // procura um lugar que nao encavale em outro alvo
    x = (p.rng() * 2 - 1) * AX; z = (p.rng() * 2 - 1) * AZ;
    if (!d.alvos.some(a => Math.hypot(a.x - x, a.z - z) < a.r + def.r + 0.4)) break;
  }
  const ang = p.rng() * Math.PI * 2;
  d.alvos.push({ tipo, x, z, r: def.r, vida: def.vida, t: 0, vx: Math.cos(ang) * def.vel, vz: Math.sin(ang) * def.vel });
  d.total++;
}

function atira(p, i, x, z) {
  const d = p.dados, j = p.jogadores[i];
  let alvo = null, menor = Infinity;
  for (const a of d.alvos) {
    const dist = Math.hypot(a.x - x, a.z - z);
    if (a.t >= T_SOBE && dist < a.r + FOLGA && dist < menor) { menor = dist; alvo = a; }
  }
  d.recarga[i] = RECARGA;
  d.tiros.push({ dono: i, x, z, t: 0 });
  if (!alvo) {
    d.fx.push({ x, y: 0.2, z, cor: -1, q: 6, forca: 3 });
    p.eventos.push('dash');
    return;
  }
  d.alvos.splice(d.alvos.indexOf(alvo), 1);
  d.pontos[i] += TIPOS[alvo.tipo].pontos;
  if (alvo.tipo === 'bomba') {
    d.fx.push({ x: alvo.x, y: 0.8, z: alvo.z, cor: -3, q: 40, forca: 11 }, { x: alvo.x, y: 0.8, z: alvo.z, cor: -2, q: 16, forca: 6 });
    p.eventos.push('explosao');
    d.susto[i] = 0.7; vibra(p, i);
  } else {
    const ouro = alvo.tipo === 'dourado';
    d.fx.push({ x: alvo.x, y: 0.7, z: alvo.z, cor: ouro ? -2 : -1, q: ouro ? 26 : 12, forca: ouro ? 8 : 5 }, { x: alvo.x, y: 0.9, z: alvo.z, cor: i, q: 10, forca: 5 });
    p.eventos.push(ouro ? 'gol' : 'moeda');
    if (j.y === 0) j.vy = ouro ? 9 : 6.5;                    // quem acerta comemora pulando
  }
}

export default {
  id: 'tiro-alvo-festa', genero: 'mira', nome: 'Tiro ao Alvo da Turma',
  dica: 'Arraste a mira e solte para atirar: dourado vale 3 e bomba vermelha tira 2.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'toque' }, semMovimento: true, semDash: true, semPulo: true, rotulo: 'pontos', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length, donos = p.modo === 'times' ? 2 : n;
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    p.jogadores.forEach((j, i) => { const l = lugar(n, i); j.x = l.x; j.z = l.z; });
    p.dados = {
      pontos: Array(n).fill(0), placar: Array(donos).fill(0), alvos: [], tiros: [], fx: [], total: 0, nasce: 0.3, dobro: false, vez: 0,
      miras: p.jogadores.map((_, i) => ({ x: i % 2 ? 3 : -3, z: 0 })), ant: Array(n).fill(false), recarga: Array(n).fill(0), fila: Array(n).fill(null), susto: Array(n).fill(0),
      aviso: '', avisoCor: '#ffd84d', tAviso: 0,
    };
    p.jogadores.forEach((_, i) => { p.celular[i] = { texto: texto(p, i), vibra: 0 }; });
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    d.tAviso -= dt;
    if (d.tAviso <= 0) d.aviso = '';
    if (!d.dobro && p.t >= TEMPO - T_DOBRO) { d.dobro = true; d.aviso = 'Alvos em dobro!'; d.tAviso = 1.3; p.eventos.push('troca'); }

    // alvos: nascem, andam (os dourados) e somem sozinhos
    d.nasce -= dt;
    if (d.nasce <= 0) {
      d.nasce = entreAlvos(n);
      for (let k = 0; k < (d.dobro ? 2 : 1); k++) if (d.alvos.length < maxAlvos(n)) nasce(p);
    }
    for (const a of d.alvos) {
      a.t += dt; a.x += a.vx * dt; a.z += a.vz * dt;
      if (Math.abs(a.x) > AX) { a.x = limita(a.x, AX); a.vx = -a.vx; }
      if (Math.abs(a.z) > AZ) { a.z = limita(a.z, AZ); a.vz = -a.vz; }
    }
    d.alvos = d.alvos.filter(a => a.t < a.vida);
    for (const t of d.tiros) t.t += dt;
    d.tiros = d.tiros.filter(t => t.t < 0.14);

    // miras e tiros; a cada quadro troca quem e conferido primeiro, para o empate no mesmo quadro nao ter dono fixo
    d.vez = (d.vez + 1) % n;
    for (let k = 0; k < n; k++) {
      const i = (d.vez + k) % n, j = p.jogadores[i], e = j.ent, m = d.miras[i], l = lugar(n, i);
      j.x = l.x; j.z = l.z; j.vx = j.vz = 0;
      d.susto[i] = Math.max(0, d.susto[i] - dt);
      const ax = limita(e.x * GANHO, 1) * MX, az = limita(e.y * GANHO, 1) * MZ;
      const toqueCurto = j.apertouA > 0 && !e.d && !d.ant[i];        // encostou e soltou entre dois quadros
      if (e.d) { const f = 1 - Math.exp(-SUAVE * dt); m.x += (ax - m.x) * f; m.z += (az - m.z) * f; }
      if (toqueCurto) { m.x = ax; m.z = az; }
      if ((d.ant[i] && !e.d) || toqueCurto) d.fila[i] = { x: m.x, z: m.z };
      d.ant[i] = e.d;
      d.recarga[i] -= dt;
      if (d.fila[i] && d.recarga[i] <= 0) { const f = d.fila[i]; d.fila[i] = null; atira(p, i, f.x, f.z); }
    }
    recalcula(p);

    const fim = p.t >= TEMPO;
    p.jogadores.forEach((_, i) => {       // o celular repete os pontos
      const t = texto(p, i, fim);
      if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
    });
    if (fim) {
      d.aviso = 'Acabou o tempo!'; d.avisoCor = '#ffd84d'; d.tAviso = 999;
      return vencedor(d.placar);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c, p = c.p, n = p.jogadores.length, times = p.modo === 'times';
    const corDe = i => (times ? c.times[timeDe(p, i)] : c.cores[i]);
    const caixa = (lx, ly, lz, cor, x, y, z, extra) => { const m = malha(new THREE.BoxGeometry(lx, ly, lz), cor, extra); m.position.set(x, y, z); grupo.add(m); return m; };
    // barraca de parque no fundo: lona listrada, toldo, lampadas e cata-ventos
    for (let k = 0; k < 11; k++) caixa(2, 3.4, 0.3, k % 2 ? 0xffffff : 0xe5352b, -10 + k * 2, 1.7, -LZ - 0.7, { roughness: 0.9 });
    caixa(22.6, 0.5, 1.4, 0x2a2f4a, 0, 3.6, -LZ - 0.3);
    for (let k = 0; k < 15; k++) {                           // bandeirinhas penduradas no toldo
      const b = malha(new THREE.ConeGeometry(0.42, 0.8, 3), [0xffd84d, 0x35c26b, 0x22c7d6, 0xff7a2f][k % 4]);
      b.rotation.x = Math.PI; b.position.set(-10.5 + k * 1.5, 2.95, -LZ + 0.45); grupo.add(b);
    }
    pecas.lampadas = [];
    for (let k = 0; k < 14; k++) {
      const cor = [0xffd84d, 0xff4a4a, 0x35c26b, 0x22c7d6][k % 4];
      const l = malha(new THREE.SphereGeometry(0.22, 10, 8), cor, { emissive: cor, emissiveIntensity: 1 });
      l.position.set(-10.4 + k * 1.6, 4.05, -LZ + 0.2); l.castShadow = false; grupo.add(l); pecas.lampadas.push(l);
    }
    pecas.ventos = [-6, 6].map(x => {
      const g = new THREE.Group(); g.position.set(x, 2, -LZ - 0.45);
      for (let k = 0; k < 4; k++) {
        const pa = malha(new THREE.BoxGeometry(1.5, 0.5, 0.1), [0xffd84d, 0x22c7d6, 0xff7a2f, 0x35c26b][k], { emissive: [0xffd84d, 0x22c7d6, 0xff7a2f, 0x35c26b][k], emissiveIntensity: 0.4 });
        pa.position.set(Math.cos(k * Math.PI / 2) * 0.75, Math.sin(k * Math.PI / 2) * 0.75, 0); pa.rotation.z = k * Math.PI / 2;
        g.add(pa);
      }
      const miolo = malha(new THREE.SphereGeometry(0.28, 10, 8), 0xffffff); g.add(miolo);
      grupo.add(g); return g;
    });
    // chao: marcas de tinta e o balcao de cada atirador, na cor dele (ou da dupla)
    for (let k = 0; k < 6; k++) {
      const m = malha(new THREE.RingGeometry(0.9, 1.05, 28), 0xffffff, { transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
      m.rotation.x = -Math.PI / 2; m.position.set(-6.2 + k * 2.5, 0.02, k % 2 ? 2.6 : -2.4); m.castShadow = false; grupo.add(m);
    }
    const comp = n <= 2 ? 3.2 : 2.8;
    for (let i = 0; i < n; i++) {
      const { x, z } = lugar(n, i), s = Math.sign(x), cor = corDe(i);
      caixa(0.5, 1, comp, cor, s * 8.95, 0.5, z, { emissive: cor, emissiveIntensity: 0.25 });
      caixa(0.7, 0.12, comp + 0.2, 0xffffff, s * 8.95, 1.06, z);
      caixa(0.12, 0.03, n <= 2 ? LZ * 2 - 0.6 : comp, cor, s * 8.5, 0.02, z, { emissive: cor, emissiveIntensity: 0.7 });
    }

    // mira de cada jogador: desenhada por cima de tudo. Em duplas as duas miras da dupla tem a mesma cor, e o segundo da dupla ganha um aro a mais
    pecas.miras = p.jogadores.map((_, i) => {
      const cor = corDe(i), g = new THREE.Group(), mat = { emissive: cor, emissiveIntensity: 1, transparent: true, depthTest: false, depthWrite: false };
      const aro = malha(new THREE.TorusGeometry(0.72, 0.09, 8, 32), cor, mat); aro.rotation.x = Math.PI / 2;
      g.add(aro);
      if (times && i >= 2) { const aro2 = malha(new THREE.TorusGeometry(0.46, 0.07, 8, 28), cor, mat); aro2.rotation.x = Math.PI / 2; g.add(aro2); }
      for (let k = 0; k < 4; k++) {
        const risco = malha(new THREE.BoxGeometry(0.5, 0.08, 0.12), cor, mat);
        risco.position.set(Math.cos(k * Math.PI / 2) * 0.72, 0, Math.sin(k * Math.PI / 2) * 0.72); risco.rotation.y = -k * Math.PI / 2;
        g.add(risco);
      }
      const centro = malha(new THREE.SphereGeometry(0.13, 10, 8), 0xffffff, { ...mat, emissive: 0xffffff }); g.add(centro);
      g.traverse(o => { o.renderOrder = 10 + i; o.castShadow = false; o.receiveShadow = false; });
      grupo.add(g); return g;
    });
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const { THREE, pecas, p } = c, d = p.dados, n = p.jogadores.length, times = p.modo === 'times';
    const corDe = i => (times ? c.times[timeDe(p, i)] : c.cores[i]);
    const pisca = d.dobro ? 14 : 4;
    pecas.lampadas.forEach((l, k) => { l.material.emissiveIntensity = 0.35 + 1.3 * (Math.sin(t * pisca + k * 1.7) > 0 ? 1 : 0); });
    pecas.ventos.forEach((g, k) => { g.rotation.z = (k ? -1 : 1) * t * (d.dobro ? 7 : 2.2); });

    // alvos: um pool por tipo
    const cria = {
      comum: () => {
        const g = new THREE.Group();
        const poste = c.malha(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), 0x6b7280); poste.position.y = -0.3;
        const disco = new THREE.Group(); disco.rotation.x = 0.5;
        [[1, 0xffffff, 0.2], [0.72, 0x35c26b, 0.24], [0.44, 0xffffff, 0.28], [0.18, 0x35c26b, 0.32]].forEach(([r, cor, h]) =>
          disco.add(c.malha(new THREE.CylinderGeometry(r, r, h, 28), cor, { emissive: cor, emissiveIntensity: 0.25 })));
        g.add(poste, disco); return g;
      },
      dourado: () => {
        const g = new THREE.Group();
        const disco = c.malha(new THREE.CylinderGeometry(0.62, 0.62, 0.2, 24), 0xffd84d, { emissive: 0xffc531, emissiveIntensity: 1, metalness: 0.7, roughness: 0.25 }); disco.rotation.x = 0.5;
        const estrela = c.malha(new THREE.OctahedronGeometry(0.34), 0xfff2a8, { emissive: 0xffe066, emissiveIntensity: 1.6 }); estrela.position.y = 0.55;
        g.add(disco, estrela); return g;
      },
      bomba: () => {
        const g = new THREE.Group();
        const corpo = c.malha(new THREE.SphereGeometry(0.8, 20, 14), 0xe02424, { emissive: 0xff1a1a, emissiveIntensity: 0.4, roughness: 0.35 }); corpo.position.y = 0.3;
        const cinta = c.malha(new THREE.TorusGeometry(0.8, 0.09, 8, 24), 0x1c1c22); cinta.rotation.x = Math.PI / 2; cinta.position.y = 0.3;
        const pavio = c.malha(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6), 0x1c1c22); pavio.position.y = 1.25;
        const chama = c.malha(new THREE.SphereGeometry(0.16, 8, 6), 0xffd84d, { emissive: 0xffa500, emissiveIntensity: 2 }); chama.position.y = 1.55;
        g.add(corpo, cinta, pavio, chama); return g;
      },
    };
    for (const tipo of Object.keys(TIPOS)) {
      const lista = d.alvos.filter(a => a.tipo === tipo), pool = c.pool('alvo-' + tipo, lista.length, cria[tipo]);
      lista.forEach((a, k) => {
        const g = pool[k], resta = a.vida - a.t;
        const f = Math.max(0.01, Math.min(1, a.t / T_SOBE, resta / 0.25));        // sobe do chao e afunda no fim
        g.position.set(a.x, -0.6 + f * 1.15, a.z);
        g.scale.setScalar(f * (resta < 0.7 ? 0.9 + 0.1 * Math.sin(t * 30) : 1));
        if (tipo === 'dourado') { g.children[1].rotation.y = t * 6; g.rotation.y = t * 2; }
        if (tipo === 'bomba') { g.children[0].material.emissiveIntensity = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * 12)); g.children[3].scale.setScalar(0.8 + 0.5 * Math.abs(Math.sin(t * 20))); }
      });
    }

    // miras e riscos dos tiros
    for (let i = 0; i < n; i++) {
      const g = pecas.miras[i], m = d.miras[i], carregando = d.recarga[i] > 0;
      g.position.set(m.x, 0.7, m.z);
      g.rotation.y = t * 1.5 * (i % 2 ? -1 : 1);
      g.scale.setScalar(carregando ? 0.6 + 0.4 * (1 - d.recarga[i] / RECARGA) : 1 + 0.06 * Math.sin(t * 8 + i));
      g.traverse(o => { if (o.material) o.material.opacity = carregando ? 0.55 : 1; });
      c.bonecos[i].position.x = p.jogadores[i].x + (d.susto[i] > 0 ? Math.sin(t * 60) * 0.18 : 0);       // tremedeira de quem acertou a bomba
    }
    const raios = c.pool('raios', d.tiros.length, () => {
      const m = c.malha(new THREE.BoxGeometry(0.14, 0.14, 1), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.5 }); m.castShadow = false; return m;
    });
    d.tiros.forEach((tr, k) => {
      const j = p.jogadores[tr.dono], m = raios[k], x0 = j.x, y0 = 1.4 + j.y, z0 = j.z, cor = corDe(tr.dono);
      const comp = Math.max(0.01, Math.hypot(tr.x - x0, 0.5 - y0, tr.z - z0));
      m.position.set((x0 + tr.x) / 2, (y0 + 0.5) / 2, (z0 + tr.z) / 2);
      m.lookAt(tr.x, 0.5, tr.z);
      m.scale.set(1, 1, comp);
      m.material.color.set(cor); m.material.emissive.set(cor);
    });

    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, f.y, f.z, f.cor === -1 ? 0xffffff : f.cor === -2 ? 0xffd84d : f.cor === -3 ? 0xff3b30 : corDe(f.cor), f.q, f.forca);
    }
  },
};
