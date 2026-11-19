// Volei de balao: rede no meio, um balao lento que nao pode cair no seu lado. Bate pula e rebate;
// o joystick escolhe se o balao cai perto da rede ou la no fundo. A cada rebatida ele fica mais rapido.
import { quem } from '../logica.mjs';

const LX = 11, REDE = 2.6, REDE_E = 0.28;           // meia quadra, altura e meia espessura da rede
const R = 0.95, G_BALAO = 9;                         // raio e gravidade do balao (lento)
const VEL = 7.5, ACEL = 14, G_JOGADOR = 28, PULO = 10.5;
const ALCANCE = 2.4, JANELA = 0.34, ESPERA_BATE = 0.5;
const T_BASE = 1.4, T_MIN = 0.5, ACELERA = 0.4;
const ALVO_MIN = 2.2, ALVO_MAX = 9;                  // onde o balao cai no lado de la: perto da rede ate o fundo
const META = 4, LIMITE = 40, LIMITE_OURO = 50, PAUSA = 0.9, SAQUE = 0.6;
const MARGEM = 1.5, FUNDO = 10.3;                    // jogador: de 1,5 da rede ate 10,3

const grav = b => G_BALAO * (1 + 0.2 * Math.min(b.n, 8));        // o balao fica mais pesado e rapido a cada troca
const trava = (v, a, b) => Math.max(a, Math.min(b, v));
const lado = i => (i ? 1 : -1);

function saque(d, perdeu) {
  d.b = { x: lado(perdeu) * 4.8, y: 5.4, vx: 0, vy: 0, espera: SAQUE, ult: -1, pausa: 0, n: 0 };
}

export default {
  id: 'volei-balao', genero: 'gol', nome: 'Vôlei de balão',
  dica: 'Ande com o joystick e aperte Bate para rebater o balão: não deixe cair do seu lado!',
  controle: { modo: 'padrao', a: 'Bate', b: '' }, semMovimento: true, semDash: true, semPulo: true,
  rotulo: 'pontos', duracao: LIMITE, tema: 0,

  inicia(p) {
    p.arena = { tipo: 'livre', lx: LX, lz: 6, parede: false };
    p.dados = {
      e: [novo(-1), novo(1)], placar: [0, 0], ouro: false,
      aviso: '', avisoCor: '#ffd23f', avisoT: 0, inventario: [['Trocas 0'], ['Trocas 0']],
      golpe: { n: 0, x: 0, y: 0, quem: 0 }, ponto: { n: 0, x: 0, quem: 0 }, rede: { n: 0, x: 0, y: 0 },
    };
    saque(p.dados, p.rng() < 0.5 ? 0 : 1);
    textos(p);
    coloca(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0 && !d.ouro) d.aviso = ''; }
    p.jogadores.forEach((j, i) => jogador(p, d, i, j, dt));
    const v = balao(p, d, dt);
    coloca(p);
    if (v !== undefined) return v;

    if (!d.ouro && p.t >= LIMITE) {
      if (d.placar[0] === d.placar[1]) { d.ouro = true; d.aviso = 'Ponto de ouro!'; d.avisoCor = '#ffd23f'; p.eventos.push('troca'); }
      else return fecha(p, d.placar[0] > d.placar[1] ? 0 : 1);
    }
    if (d.ouro && p.t >= LIMITE_OURO && d.placar[0] === d.placar[1]) return fecha(p, -1);
  },

  camera() { return { x: 0, y: 5.2, z: 16, ox: 0, oy: 3.6, oz: 0 }; },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = { golpe: 0, ponto: 0, rede: 0 };

    // quadra de areia, linhas brancas e uma zona de fundo na cor de cada jogador
    const areia = malha(new THREE.BoxGeometry(LX * 2 + 3, 0.5, 7), 0xf2d58a, { roughness: 1 });
    areia.position.y = -0.25; areia.receiveShadow = true; grupo.add(areia);
    for (const i of [0, 1]) {
      const cor = new THREE.Color(0xf2d58a).lerp(new THREE.Color(cores[i]), 0.6);
      const zona = malha(new THREE.BoxGeometry(1.5, 0.03, 6.2), cor.getHex(), { roughness: 0.9 });
      zona.position.set(lado(i) * (LX - 0.75), 0.02, 0); zona.castShadow = false; grupo.add(zona);
    }
    for (const x of [-LX, LX]) {
      const linha = malha(new THREE.BoxGeometry(0.28, 0.05, 6.2), 0xffffff); linha.position.set(x, 0.04, 0); linha.castShadow = false; grupo.add(linha);
    }
    for (const z of [-3.1, 3.1]) {
      const linha = malha(new THREE.BoxGeometry(LX * 2, 0.05, 0.22), 0xffffff); linha.position.set(0, 0.04, z); linha.castShadow = false; grupo.add(linha);
    }

    // rede: poste listrado, pano e fita no topo
    const rede = new THREE.Group();
    for (let k = 0; k < 7; k++) {
      const trecho = malha(new THREE.BoxGeometry(REDE_E * 2, REDE / 7, 0.8), k % 2 ? 0xffffff : 0xe5383b);
      trecho.position.set(0, REDE / 7 * (k + 0.5), -2.7); rede.add(trecho);
      const trecho2 = trecho.clone(); trecho2.position.z = 2.7; rede.add(trecho2);
    }
    const pano = malha(new THREE.BoxGeometry(REDE_E * 1.4, REDE - 0.7, 5.4), 0xf5f7ff, { transparent: true, opacity: 0.55 });
    pano.position.set(0, 0.35 + (REDE - 0.7) / 2, 0); pano.castShadow = false; rede.add(pano);
    const fita = malha(new THREE.BoxGeometry(REDE_E * 2.4, 0.34, 6.2), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.25 });
    fita.position.set(0, REDE - 0.17, 0); rede.add(fita);
    grupo.add(rede);

    // sombra do balao, marca de onde ele vai cair e a mira de cada jogador
    pecas.sombra = malha(new THREE.CylinderGeometry(1, 1, 0.02, 24), 0x000000, { transparent: true, opacity: 0.28 });
    pecas.sombra.castShadow = false; pecas.sombra.position.y = 0.03; grupo.add(pecas.sombra);
    pecas.queda = malha(new THREE.TorusGeometry(1, 0.1, 6, 36), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 });
    pecas.queda.rotation.x = -Math.PI / 2; pecas.queda.position.y = 0.08; pecas.queda.castShadow = false; grupo.add(pecas.queda);
    pecas.mira = [0, 1].map(i => {
      const m = malha(new THREE.TorusGeometry(0.8, 0.12, 6, 30), cores[i], { emissive: cores[i], emissiveIntensity: 0.9 });
      m.rotation.x = -Math.PI / 2; m.position.y = 0.1; m.castShadow = false; grupo.add(m); return m;
    });

    // balao: corpo, nozinho, barbante e brilho
    const g = new THREE.Group();
    const corpo = malha(new THREE.SphereGeometry(R, 28, 20), 0xffe066, { emissive: 0x553300, emissiveIntensity: 0.4, roughness: 0.3 });
    corpo.scale.y = 1.12;
    const no = malha(new THREE.ConeGeometry(0.2, 0.34, 10), 0xffe066, { emissive: 0x553300, emissiveIntensity: 0.4 });
    no.rotation.x = Math.PI; no.position.y = -R * 1.12 - 0.12;
    const fio = malha(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), 0xffffff);
    fio.position.y = -R * 1.12 - 0.85; fio.castShadow = false;
    const brilho = malha(new THREE.SphereGeometry(0.22, 12, 8), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 });
    brilho.position.set(-0.4, 0.5, 0.65); brilho.scale.set(1, 1.4, 0.5); brilho.castShadow = false;
    g.add(corpo, no, fio, brilho); g.userData = { corpo, no };
    grupo.add(g); pecas.balao = g;
  },

  desenha(c, dt, t) {
    const { THREE, pecas, p } = c, d = p.dados, b = d.b;

    // balao: cor de quem rebateu por ultimo, estica na velocidade, esquenta com a aceleracao
    const g = pecas.balao, corpo = g.userData.corpo, v = Math.hypot(b.vx, b.vy);
    const cor = b.ult >= 0 ? c.cores[b.ult] : 0xffe066, quente = Math.min(1, b.n / 8);
    corpo.material.color.set(cor); g.userData.no.material.color.set(cor);
    corpo.material.emissive.set(quente > 0.5 ? 0xff4a00 : 0x553300); corpo.material.emissiveIntensity = 0.35 + quente * 0.6;
    g.position.set(b.x, b.y + (b.espera > 0 ? Math.sin(t * 6) * 0.12 : 0), 0);
    const estica = 1 + Math.min(0.25, v * 0.015), achata = b.pausa > 0 ? 0.55 : 1;
    g.scale.set((1 / Math.sqrt(estica)) * (b.pausa > 0 ? 1.4 : 1), estica * achata, 1);
    g.rotation.z = Math.atan2(b.vx, Math.max(0.5, Math.abs(b.vy))) * -0.25;
    g.visible = true;

    // sombra e ponto de queda
    const s = pecas.sombra, alt = Math.max(0, b.y - R);
    s.position.x = b.x; s.scale.set(R * (1.25 - Math.min(0.5, alt * 0.06)), 1, R * 0.7);
    const q = pecas.queda, xq = queda(b);
    q.visible = b.pausa <= 0 && b.espera <= 0 && Math.abs(xq) < LX + 2;
    q.position.x = xq; q.scale.set(1.25 + Math.sin(t * 9) * 0.1, 1.25 + Math.sin(t * 9) * 0.1, 1);
    q.material.color.set(cor); q.material.emissive.set(cor);

    // mira: onde a minha rebatida vai cair, so quando o balao esta do meu lado
    p.jogadores.forEach((j, i) => {
      const m = pecas.mira[i], e = d.e[i], noLado = b.x * lado(i) > -0.5 && b.pausa <= 0;
      m.visible = noLado;
      m.position.x = -lado(i) * alvo(j.ent.y);
      const k = 1 + Math.sin(t * 7 + i) * 0.08; m.scale.set(k, k, 1);
      c.bonecos[i].rotation.z = trava(e.vx * -0.012, -0.12, 0.12);
    });

    // arcos de rebatida
    const arcos = c.pool('arcos', 2, () => {
      const m = c.malha(new THREE.TorusGeometry(1.5, 0.16, 6, 24, Math.PI), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.2 });
      m.castShadow = false; return m;
    });
    p.jogadores.forEach((j, i) => {
      const e = d.e[i], m = arcos[i];
      m.visible = e.bate > 0;
      if (!m.visible) return;
      m.position.set(e.x + -lado(i) * 0.4, e.y + 1.5, 0.3);
      m.rotation.z = i ? Math.PI / 2 - 0.5 * (1 - e.bate / JANELA) : -Math.PI / 2 + 0.5 * (1 - e.bate / JANELA);
      m.material.color.set(c.cores[i]); m.material.emissive.set(c.cores[i]);
      m.scale.setScalar(0.8 + 0.5 * (1 - e.bate / JANELA));
    });

    if (d.golpe.n !== pecas.visto.golpe) {
      pecas.visto.golpe = d.golpe.n;
      c.particulas(d.golpe.x, d.golpe.y, 0, c.cores[d.golpe.quem], 14, 8);
      c.particulas(d.golpe.x, d.golpe.y, 0, 0xffffff, 6, 5);
    }
    if (d.ponto.n !== pecas.visto.ponto) {
      pecas.visto.ponto = d.ponto.n;
      c.particulas(d.ponto.x, 0.6, 0, c.cores[d.ponto.quem], 34, 11);
      c.particulas(d.ponto.x, 0.6, 0, 0xffd23f, 16, 8);
    }
    if (d.rede.n !== pecas.visto.rede) {
      pecas.visto.rede = d.rede.n;
      c.particulas(d.rede.x, d.rede.y, 0, 0xffffff, 8, 4);
    }
  },
};

function novo(l) { return { x: l * 5.5, vx: 0, y: 0, vy: 0, bate: 0, cd: 0 }; }

// profundidade da jogada pelo joystick: para cima manda longe, para baixo manda curto
function alvo(entY) {
  const u = (1 - trava(Number.isFinite(entY) ? entY : 0, -1, 1)) / 2;
  return ALVO_MIN + u * (ALVO_MAX - ALVO_MIN);
}

// onde o balao toca o chao se ninguem bater (parabola)
function queda(b) {
  const a = 0.5 * grav(b), c0 = b.y - R;
  const t = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 4 * a * Math.max(0, c0)))) / (2 * a);
  return trava(b.x + b.vx * t, -LX - 3, LX + 3);
}

function coloca(p) {
  p.jogadores.forEach((j, i) => { const e = p.dados.e[i]; j.x = e.x; j.y = e.y; j.z = 0; j.vx = j.vz = 0; j.vy = e.vy; });
}

function jogador(p, d, i, j, dt) {
  const e = d.e[i], l = lado(i);
  const dir = trava(j.ent.x, -1, 1);
  e.vx += (dir * VEL - e.vx) * Math.min(1, ACEL * dt);
  const livre = e.x + e.vx * dt;
  e.x = trava(livre, l > 0 ? MARGEM : -FUNDO, l > 0 ? FUNDO : -MARGEM);
  if (e.x !== livre) e.vx = 0;                       // encostou na rede ou no fundo
  e.cd = Math.max(0, e.cd - dt); e.bate = Math.max(0, e.bate - dt);
  if (e.y > 0 || e.vy > 0) { e.vy -= G_JOGADOR * dt; e.y = Math.max(0, e.y + e.vy * dt); if (e.y === 0) e.vy = 0; }
  if (j.apertouA && e.cd <= 0) {
    e.cd = ESPERA_BATE; e.bate = JANELA;
    if (e.y === 0) { e.vy = PULO; p.eventos.push('pulo'); }
  }
  if (e.bate > 0) rebate(p, d, i, e);
}

function rebate(p, d, i, e) {
  const b = d.b, l = lado(i);
  if (b.pausa > 0 || b.ult === i || b.x * l < -0.3) return;
  if (Math.hypot(b.x - e.x, b.y - (e.y + 1.4)) > ALCANCE) return;
  const xt = -l * alvo(p.jogadores[i].ent.y);
  let T = Math.max(T_MIN, T_BASE / (1 + ACELERA * b.n)), vx = 0, vy = 0;
  b.n++;                                                   // o balao ja esta mais pesado nesta jogada
  for (let k = 0; k < 16; k++) {                           // jogada curta e alta: aumenta o tempo ate passar por cima da rede
    vx = (xt - b.x) / T; vy = (R - b.y + 0.5 * grav(b) * T * T) / T;
    if (passaPorCima(b, vx, vy)) break;
    T += 0.08;
  }
  b.vx = vx; b.vy = vy; b.ult = i; b.espera = 0; e.bate = 0;
  d.golpe = { n: d.golpe.n + 1, x: b.x, y: b.y, quem: i };
  d.inventario = [[`Trocas ${b.n}`], [`Trocas ${b.n}`]];
  p.eventos.push('batida');
  p.celular[1 - i] = { ...p.celular[1 - i], vibra: (p.celular[1 - i].vibra ?? 0) + 1 };
}

// o balao com essa velocidade passa pela rede sem bater nela?
function passaPorCima(b, vx, vy) {
  for (let t = 0; t < 3; t += 0.02) {
    const x = b.x + vx * t, y = b.y + vy * t - 0.5 * grav(b) * t * t;
    if (y - R <= 0) return true;
    if (Math.hypot(x, y - trava(y, 0, REDE)) < R + REDE_E + 0.15) return false;
  }
  return true;
}

function balao(p, d, dt) {
  const b = d.b;
  if (b.pausa > 0) {                       // ponto marcado: o balao fica no chao um instante
    b.pausa -= dt;
    if (b.pausa <= 0) saque(d, d.perdeu);
    return;
  }
  if (b.espera > 0) { b.espera -= dt; return; }
  b.vy -= grav(b) * dt; b.x += b.vx * dt; b.y += b.vy * dt;
  if (Math.abs(b.x) > LX + 0.5 - R) { b.x = Math.sign(b.x) * (LX + 0.5 - R); b.vx *= -0.5; }
  if (b.y > 11) { b.y = 11; b.vy = Math.min(b.vy, 0); }
  colideRede(p, d, b);
  if (b.y - R <= 0) return ponto(p, d, b);
}

// a rede e uma haste vertical da altura REDE: o balao bate nela e volta
function colideRede(p, d, b) {
  const topo = trava(b.y, 0, REDE), dx = b.x, dy = b.y - topo, dist = Math.hypot(dx, dy);
  if (dist >= R + REDE_E) return;
  const nx = dist > 1e-6 ? dx / dist : (b.vx > 0 ? -1 : 1), ny = dist > 1e-6 ? dy / dist : 0;
  b.x = nx * (R + REDE_E); b.y = topo + ny * (R + REDE_E);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.4 * vn * nx; b.vy -= 1.4 * vn * ny; }
  b.ult = -1;
  d.rede = { n: d.rede.n + 1, x: 0, y: Math.min(b.y, REDE) };
  p.eventos.push('troca');
}

function ponto(p, d, b) {
  const lado0 = b.x < 0 ? 0 : 1;           // caiu no lado de quem perdeu
  const quemFez = 1 - lado0;
  b.y = R; b.vx = b.vy = 0; b.pausa = PAUSA; d.perdeu = lado0;
  d.placar[quemFez]++;
  d.ponto = { n: d.ponto.n + 1, x: b.x, quem: quemFez };
  d.inventario = [['Trocas 0'], ['Trocas 0']]; b.n = 0;
  d.aviso = `Ponto de ${quem(p, quemFez)}!`; d.avisoCor = quemFez ? '#ff7ab8' : '#6fb4ff'; d.avisoT = PAUSA;
  p.eventos.push('ponto');
  textos(p);
  if (d.placar[quemFez] >= META) return fecha(p, quemFez);
  if (d.ouro && d.placar[0] !== d.placar[1]) return fecha(p, quemFez);
}

function textos(p) {
  const d = p.dados;
  for (const i of [0, 1])
    p.celular[i] = { ...p.celular[i], texto: `Você ${d.placar[i]} x ${d.placar[1 - i]}. Joystick para cima manda longe` };
}

function fecha(p, v) {
  const d = p.dados;
  d.aviso = v < 0 ? 'Empate no vôlei' : quem(p, v) + ' venceu!'; d.avisoCor = '#ffd23f'; d.avisoT = 99;
  for (const i of [0, 1]) p.celular[i] = { ...p.celular[i], texto: v < 0 ? 'Empate' : v === i ? 'Você venceu!' : 'Não foi dessa vez' };
  return v;
}
