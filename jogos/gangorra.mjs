// Gangorra na lagoa: dois em cima de uma tabua apoiada num barril. O peso de cada um inclina a tabua,
// as moedas rolam para o lado que desce, e quem escorrega para fora toma banho (o outro ganha pontos).
// Pula da um tranco: quem estiver no chao, longe do centro, e lancado para fora.
import { quem } from '../logica.mjs';

const L = 8.5;                         // meia tabua
const H0 = 2.6;                        // altura do apoio sobre a agua
const AGUA = 0.25;
const A_MAX = 0.32, K_PESO = 0.07, OMEGA = 5, ZETA = 0.65;      // inclinacao: segue o desequilibrio como uma mola
const ANDA = 4.6, GANHO = 3, ESCORREGA = 15, FREIO_BORDA = 0.6;
const GRAV = 24, PULO = 8.4, RECUPERA = 0.14, AR = 5;
const DMIN = 3.2;                      // distancia minima entre os dois na tabua
const LIMITE = 35, LIMITE_OURO = 50, BANHO = 3, SUMIDO = 1.3, INVULNERAVEL = 1.6;
const MOEDA_R = 1.6;

const SEN = Math.sin, COS = Math.cos;
const trava = (v, a, b) => Math.max(a, Math.min(b, v));
const chao = (d, s) => H0 + s * SEN(d.a);

function novoJogador(lado) {
  return { s: lado * 3, vs: 0, wy: chao({ a: 0 }, 0), vy: 0, solo: true, salto: false, rec: 0, caiu: 0, inv: 0 };
}

function novaMoeda(d, s, valor) {
  return { s, vs: 0, h: 3, vh: 0, valor, giro: 0 };
}

export default {
  id: 'gangorra', genero: 'equilibrio', nome: 'Gangorra na lagoa',
  dica: 'Ande com o joystick, pegue moedas sem cair e aperte Pula para dar um tranco no outro!',
  controle: { modo: 'padrao', a: 'Pula', b: '' }, semMovimento: true, semDash: true, semPulo: true,
  rotulo: 'pontos', duracao: LIMITE, tema: 0,

  inicia(p) {
    p.arena = { tipo: 'livre', lx: 11, lz: 7, parede: false };
    p.dados = {
      a: 0, w: 0, e: [novoJogador(-1), novoJogador(1)], placar: [0, 0],
      moedas: [novaMoeda(null, p.rng() < 0.5 ? -3.5 : 3.5, 1)], nMoeda: 1, espera: 0,
      aviso: '', avisoCor: '#ffd23f', avisoT: 0, ouro: false,
      splash: { n: 0, x: 0 }, pega: { n: 0, x: 0, y: 0, quem: 0, valor: 1 }, tranco: { n: 0, x: 0, y: 0, quem: 0 },
    };
    for (const j of p.jogadores) { j.x = 0; j.z = 0; j.vx = j.vz = j.vy = 0; }
    textosCelular(p);
    coloca(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0 && !d.ouro) d.aviso = ''; }

    // inclinacao: so o peso de quem esta no chao conta
    let soma = 0;
    for (const e of d.e) if (e.solo && e.caiu <= 0) soma += e.s;
    const alvo = trava(-K_PESO * soma, -A_MAX, A_MAX);
    d.w += (OMEGA * OMEGA * (alvo - d.a) - 2 * ZETA * OMEGA * d.w) * dt;
    d.a = trava(d.a + d.w * dt, -A_MAX, A_MAX);

    const antes = [d.placar[0], d.placar[1]];
    p.jogadores.forEach((j, i) => passoJogador(p, d, i, j, dt));
    separa(d);
    moedas(p, d, dt);
    coloca(p);

    if (d.placar[0] !== antes[0] || d.placar[1] !== antes[1]) textosCelular(p);

    if (!d.ouro && p.t >= LIMITE) {
      if (d.placar[0] === d.placar[1]) {
        d.ouro = true; d.aviso = 'Ponto de ouro!'; d.avisoCor = '#ffd23f'; p.eventos.push('troca');
      } else return fecha(p, d.placar[0] > d.placar[1] ? 0 : 1);
    }
    if (d.ouro) {
      if (d.placar[0] !== d.placar[1]) return fecha(p, d.placar[0] > d.placar[1] ? 0 : 1);
      if (p.t >= LIMITE_OURO) return fecha(p, -1);
    }
  },

  camera() { return { x: 0, y: 8.2, z: 18, ox: 0, oy: 1.8, oz: 0 }; },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = { splash: 0, pega: 0, tranco: 0 };
    pecas.aneis = [];

    // lagoa
    const agua = malha(new THREE.CircleGeometry(26, 48), 0x2aa4dc, { emissive: 0x0b4a78, emissiveIntensity: 0.55, roughness: 0.9, metalness: 0 });
    agua.rotation.x = -Math.PI / 2; agua.position.y = 0.05; agua.castShadow = false; grupo.add(agua);
    pecas.agua = agua;
    pecas.boias = [];
    for (const [x, z] of [[-13, -6], [13, -7], [-11, 5], [12, 6], [0, -11]]) {      // boias listradas balancando
      const boia = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const faixa = malha(new THREE.TorusGeometry(0.9, 0.3, 8, 6, Math.PI / 2), k % 2 ? 0xffffff : 0xe5383b);
        faixa.rotation.z = k * Math.PI / 2; boia.add(faixa);
      }
      boia.rotation.x = -Math.PI / 2 + 0.25; boia.position.set(x, 0.2, z); grupo.add(boia); pecas.boias.push(boia);
    }

    // barril de apoio, em pe na agua, com duas cintas
    const barril = new THREE.Group();
    const corpo = malha(new THREE.CylinderGeometry(1.05, 1.05, H0 - 0.3, 20), 0xa8642d);
    barril.add(corpo);
    for (const y of [-0.55, 0.55]) {
      const cinta = malha(new THREE.TorusGeometry(1.06, 0.08, 8, 28), 0x3a3f4d);
      cinta.rotation.x = Math.PI / 2; cinta.position.y = y; barril.add(cinta);
    }
    barril.position.set(0, (H0 - 0.34) / 2, 0); grupo.add(barril); pecas.barril = barril;

    // tabua: gira em volta do apoio. A face de cima fica em y = 0 do grupo.
    const tabua = new THREE.Group(); tabua.position.set(0, H0, 0); grupo.add(tabua); pecas.tabua = tabua;
    const madeira = new THREE.Color(0xd9a15f);
    const base = malha(new THREE.BoxGeometry(L * 2 + 0.6, 0.34, 4.6), 0xb87f3f); base.position.y = -0.17; tabua.add(base);
    for (const i of [0, 1]) {                       // cada metade tem a cor do dono
      const cor = madeira.clone().lerp(new THREE.Color(cores[i]), 0.55);
      const metade = malha(new THREE.BoxGeometry(L, 0.06, 4.4), cor.getHex(), { roughness: 0.6 });
      metade.position.set((i ? 1 : -1) * L / 2, 0.01, 0); metade.castShadow = false; tabua.add(metade);
    }
    for (let k = -7; k <= 7; k++) {                 // emendas das tabuas
      const emenda = malha(new THREE.BoxGeometry(0.07, 0.08, 4.4), 0x8a5a2a);
      emenda.position.set(k * 1.15, 0.03, 0); emenda.castShadow = false; tabua.add(emenda);
    }
    for (const lado of [-1, 1]) {                   // listras de perigo nas pontas
      for (let k = 0; k < 4; k++) {
        const lista = malha(new THREE.BoxGeometry(0.34, 0.09, 4.4), k % 2 ? 0xffffff : 0xe5383b);
        lista.position.set(lado * (L - 0.2 - k * 0.34), 0.045, 0); lista.castShadow = false; tabua.add(lista);
      }
      const ponta = malha(new THREE.CylinderGeometry(0.32, 0.32, 4.7, 12), 0xf5f0e6);
      ponta.rotation.x = Math.PI / 2; ponta.position.set(lado * (L + 0.3), -0.1, 0); tabua.add(ponta);
    }
  },

  desenha(c, dt, t) {
    const { THREE, pecas, p } = c, d = p.dados;
    coloca(p);                      // depois do fim da rodada o motor derruba os bonecos: aqui eles voltam para a tabua
    pecas.tabua.rotation.z = d.a;
    pecas.barril.position.y = (H0 - 0.34) / 2 + Math.sin(t * 2.2) * 0.03;
    pecas.agua.material.emissiveIntensity = 0.5 + Math.sin(t * 1.7) * 0.08;
    pecas.boias.forEach((b, k) => { b.position.y = 0.2 + Math.sin(t * 1.6 + k * 1.9) * 0.12; b.rotation.z = Math.sin(t * 0.9 + k) * 0.3; });

    // moedas
    const lista = c.pool('moedas', d.moedas.length, () => {
      const g = new THREE.Group();
      const aro = c.malha(new THREE.CylinderGeometry(1, 1, 0.22, 24), 0xc27a00, { emissive: 0x6a3d00, emissiveIntensity: 0.5 });
      const face = c.malha(new THREE.CylinderGeometry(0.8, 0.8, 0.26, 24), 0xffd23f, { emissive: 0xffb300, emissiveIntensity: 0.9 });
      const estrela = c.malha(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 5), 0xfff1a8, { emissive: 0xffe066, emissiveIntensity: 0.9 });
      for (const m of [aro, face, estrela]) m.rotation.x = Math.PI / 2;
      g.add(aro, face, estrela);
      return g;
    });
    d.moedas.forEach((m, k) => {
      const g = lista[k], r = m.valor > 1 ? 0.95 : 0.65;
      const [x, y] = ponto(d.a, m.s, m.h + r);
      g.position.set(x, y, 0); g.scale.setScalar(r); g.rotation.z = -m.giro;
      g.children[1].material.color.set(m.valor > 1 ? 0xff9f1c : 0xffd23f);
      g.children[2].material.color.set(m.valor > 1 ? 0xffe9a0 : 0xfff1a8);
    });

    // bonecos: ficam de pe na tabua, piscam ao voltar da agua
    p.jogadores.forEach((j, i) => {
      const e = d.e[i], b = c.bonecos[i];
      b.visible = e.caiu <= 0 && (e.inv <= 0 || Math.floor(t * 14) % 2 === 0);
      b.rotation.z = e.solo ? d.a * 0.85 : 0;
    });

    // aneis de agua e faiscas
    if (d.splash.n !== pecas.visto.splash) {
      pecas.visto.splash = d.splash.n;
      c.particulas(d.splash.x, 0.6, 0, 0xbfeaff, 26, 9);
      c.particulas(d.splash.x, 0.4, 0, 0xffffff, 10, 6);
      anel(c, d.splash.x, 0.12, 0xffffff, 1.3);
    }
    if (d.pega.n !== pecas.visto.pega) {
      pecas.visto.pega = d.pega.n;
      c.particulas(d.pega.x, d.pega.y + 0.8, 0, 0xffd23f, d.pega.valor > 1 ? 24 : 12, 7);
    }
    if (d.tranco.n !== pecas.visto.tranco) {
      pecas.visto.tranco = d.tranco.n;
      c.particulas(d.tranco.x, d.tranco.y + 0.3, 0, c.cores[d.tranco.quem], 20, 8);
      c.particulas(d.tranco.x, d.tranco.y + 0.3, 0, 0xffffff, 8, 5);
    }
    for (let k = pecas.aneis.length - 1; k >= 0; k--) {
      const a = pecas.aneis[k]; a.t += dt;
      const f = a.t / 1.1;
      if (f >= 1) { c.grupo.remove(a.m); pecas.aneis.splice(k, 1); continue; }
      a.m.scale.setScalar(a.r0 + f * 3.2); a.m.material.opacity = 1 - f;
    }
  },
};

// posicao de cada boneco no mundo (a tela o desenha em (x, RAIO + y, z))
function coloca(p) {
  const d = p.dados;
  p.jogadores.forEach((j, i) => {
    const e = d.e[i];
    j.x = e.s * COS(d.a); j.y = e.caiu > 0 ? -4 : e.wy; j.z = 0; j.vx = j.vz = 0; j.vy = e.solo ? 0 : e.vy;
  });
}

// ponto na face da tabua: s ao longo dela, h acima dela
function ponto(a, s, h) {
  return [s * COS(a) - h * SEN(a), H0 + s * SEN(a) + h * COS(a)];
}

function anel(c, x, y, cor, r0) {
  const m = new c.THREE.Mesh(new c.THREE.TorusGeometry(1, 0.07, 6, 36), new c.THREE.MeshBasicMaterial({ color: cor, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, 0); m.scale.setScalar(r0);
  c.grupo.add(m); c.pecas.aneis.push({ m, t: 0, r0 });
}

function passoJogador(p, d, i, j, dt) {
  const e = d.e[i];
  if (e.caiu > 0) {                       // na agua: some e volta
    e.caiu -= dt;
    if (e.caiu <= 0) renasce(d, i);
    return;
  }
  e.inv = Math.max(0, e.inv - dt); e.rec = Math.max(0, e.rec - dt);
  const dir = trava(j.ent.x, -1, 1);
  if (e.solo) {
    let vt = dir * ANDA;
    if (vt * Math.sign(e.s) > 0 && Math.abs(e.s) > L - FREIO_BORDA) vt = 0;      // o dedo sozinho nao leva para fora
    e.vs += (vt - e.vs) * GANHO * dt - ESCORREGA * SEN(d.a) * dt;
    e.s += e.vs * dt;
    e.wy = chao(d, e.s); e.vy = 0;
    if (Math.abs(e.s) > L) { e.solo = false; e.salto = false; }                 // escorregou para fora
    else if (j.apertouA && e.rec <= 0) {
      e.solo = false; e.salto = true; e.vy = PULO; p.eventos.push('pulo');
    }
    return;
  }
  e.vy -= GRAV * dt; e.wy += e.vy * dt;
  e.vs += trava(dir * AR * dt, -AR * dt, AR * dt);
  e.s += e.vs * dt;
  if (e.vy <= 0 && Math.abs(e.s) <= L && e.wy <= chao(d, e.s)) aterrissa(p, d, i);
  else if (e.wy <= AGUA && (e.vy <= 0)) mergulha(p, d, i);
}

function aterrissa(p, d, i) {
  const e = d.e[i];
  e.solo = true; e.vy = 0; e.wy = chao(d, e.s); e.rec = RECUPERA;
  if (!e.salto) return;
  e.salto = false;
  const f = trava(Math.abs(e.s) / 5, 0.35, 1);
  d.w -= 1.6 * (e.s / L);                 // a tabua afunda do lado de quem caiu
  p.eventos.push('batida');
  const o = d.e[1 - i];
  const [x, y] = ponto(d.a, e.s, 0);
  d.tranco = { n: d.tranco.n + 1, x, y, quem: i };
  if (o.solo && o.caiu <= 0 && o.inv <= 0) {      // o outro esta no chao: e lancado para fora
    o.solo = false; o.salto = false;
    o.vy = 6 + 3 * f;
    o.vs = (o.s === 0 ? (i ? -1 : 1) : Math.sign(o.s)) * (3.5 + 3.5 * f);
    d.aviso = 'Tranco!'; d.avisoCor = '#ffd23f'; d.avisoT = 0.9;
    p.celular[1 - i] = { ...p.celular[1 - i], vibra: (p.celular[1 - i].vibra ?? 0) + 1 };
  }
}

function mergulha(p, d, i) {
  const e = d.e[i];
  e.caiu = SUMIDO; e.solo = false; e.salto = false; e.vs = 0; e.vy = 0;
  const x = e.s * COS(d.a);
  d.splash = { n: d.splash.n + 1, x };
  d.placar[1 - i] += BANHO;
  d.aviso = quem(p, i) + ' caiu na água!'; d.avisoCor = '#7fd4ff'; d.avisoT = 1.3;
  p.eventos.push('queda');
  p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
}

function renasce(d, i) {
  const e = d.e[i];
  e.s = (i ? 1 : -1) * 3; e.vs = 0; e.wy = chao(d, e.s) + 3.5; e.vy = 0;
  e.solo = false; e.salto = false; e.inv = INVULNERAVEL;
}

// os dois nao se atravessam na tabua (pulando, um passa por cima do outro)
function separa(d) {
  const [a, b] = d.e;
  if (!(a.solo && b.solo) || a.caiu > 0 || b.caiu > 0) return;
  const [baixo, alto] = a.s <= b.s ? [a, b] : [b, a];
  if (alto.s - baixo.s >= DMIN) return;
  const meio = (a.s + b.s) / 2;
  baixo.s = meio - DMIN / 2; alto.s = meio + DMIN / 2;
  const v = (a.vs + b.vs) / 2; baixo.vs = Math.min(baixo.vs, v); alto.vs = Math.max(alto.vs, v);
}

function moedas(p, d, dt) {
  d.espera -= dt;
  for (let k = d.moedas.length - 1; k >= 0; k--) {
    const m = d.moedas[k];
    if (m.h > 0 || m.vh > 0) { m.vh -= 20 * dt; m.h = Math.max(0, m.h + m.vh * dt); if (m.h === 0) m.vh = 0; }
    else { m.vs += -0.7 * ESCORREGA * SEN(d.a) * dt; m.vs *= Math.pow(0.55, dt); }
    m.s += m.vs * dt; m.giro += m.vs * dt / 0.65;
    if (Math.abs(m.s) > L + 0.3) { d.moedas.splice(k, 1); d.espera = 0.7; continue; }      // rolou para a agua
    for (const [i, e] of d.e.entries()) {
      if (e.caiu > 0 || Math.abs(e.s - m.s) > MOEDA_R || e.wy - chao(d, e.s) > 1.8) continue;
      const [x, y] = ponto(d.a, m.s, m.h);
      d.placar[i] += m.valor;
      d.pega = { n: d.pega.n + 1, x, y, quem: i, valor: m.valor };
      p.eventos.push('moeda');
      d.moedas.splice(k, 1); d.espera = 0.5;
      break;
    }
  }
  if (d.moedas.length < 1 && d.espera <= 0) {
    let s = 0;
    for (let tent = 0; tent < 8; tent++) {
      s = (p.rng() < 0.5 ? -1 : 1) * (1.5 + p.rng() * 5);
      if (d.e.every(e => Math.abs(e.s - s) > 2)) break;
    }
    d.nMoeda++;
    d.moedas.push(novaMoeda(d, s, d.nMoeda % 3 === 0 ? 2 : 1));
    d.espera = 0.4;
  }
}

function textosCelular(p) {
  const d = p.dados;
  for (const i of [0, 1])
    p.celular[i] = { ...p.celular[i], texto: `Você ${d.placar[i]} x ${d.placar[1 - i]}. Fique longe da ponta da tábua` };
}

function fecha(p, v) {
  const d = p.dados;
  d.aviso = v < 0 ? 'Empate na lagoa' : quem(p, v) + ' venceu!'; d.avisoCor = '#ffd23f'; d.avisoT = 99;
  for (const i of [0, 1]) p.celular[i] = { ...p.celular[i], texto: v < 0 ? 'Empate' : v === i ? 'Você venceu!' : 'Não foi dessa vez' };
  return v;
}
