// Pescaria da Turma (Festa, 2 a 4 jogadores: todos contra todos ou duplas). Um lago no meio e um pier para cada um, nas duas margens.
// A boia afunda em momentos sorteados (diferentes para cada um) e o celular vibra: apertar em ate 0,6 s fisga; apertar antes
// espanta os peixes por 2 s. Fisgou: martelar o botao para vencer a barra de luta. Em 35 s vence quem (ou a dupla) pescar mais quilos.
import { timeDe } from '../logica.mjs';

export const TEMPO = 35, JANELA = 0.6, T_SUSTO = 2, BARRA_INICIAL = 0.35;
// ganho: quanto a barra sobe por toque. puxa: quanto o peixe tira da barra por segundo.
export const TIPOS = [
  { id: 'pequeno', peso: 1, ganho: 0.2, puxa: 0.15, chance: 0.45, cor: 0xffa033, tam: 0.6 },
  { id: 'medio', peso: 2, ganho: 0.12, puxa: 0.22, chance: 0.28, cor: 0x3ddc84, tam: 0.9 },
  { id: 'grande', peso: 4, ganho: 0.085, puxa: 0.3, chance: 0.15, cor: 0xb46bff, tam: 1.4 },
  { id: 'bota', peso: 0, ganho: 0.15, puxa: 0.1, chance: 0.12, cor: 0x7a4a21, tam: 1 },
];
const LX = 10.5, XJ = 8.4, X_BOIA = 3, X_BALDE = 8.7, Z_BALDE = 2.7, T_VOO = 0.8, T_CALMA = 0.8, NO_BALDE = 12, FILA = 3;

// Com 2 jogadores o lago e largo e cada um fica numa margem. Com 3 ou 4 a arena ganha fundo e cada margem recebe dois piers
// (J1 e J3 na esquerda, J2 e J4 na direita, a dupla A na esquerda), todos do mesmo tamanho e de frente para o lago.
export const lzDe = n => (n > 2 ? 8.5 : 6.5);
export function lugar(n, i) { return { lado: i % 2 ? 1 : -1, z: n <= 2 ? 0 : i < 2 ? -FILA : FILA }; }

function sorteia(p) {
  let r = p.rng();
  for (let n = 0; n < TIPOS.length; n++) if ((r -= TIPOS[n].chance) < 0) return n;
  return 0;
}

// calma: logo depois de uma luta os toques nao contam, senao quem martelava o botao levaria susto sem querer.
const espera = (p, calma = 0) => ({ fase: 'espera', t: 1.2 + p.rng() * 3, tipo: -1, barra: 0, calma });

const donoDe = (p, i) => (p.modo === 'times' ? timeDe(p, i) : i);
function recalcula(p) {
  const d = p.dados;
  d.placar = d.placar.map(() => 0);
  d.pesos.forEach((kg, i) => { d.placar[donoDe(p, i)] += kg; });
}
function vencedor(placar) {
  const maior = Math.max(...placar), lideres = placar.flatMap((v, k) => (v === maior ? [k] : []));
  return lideres.length === 1 ? lideres[0] : -1;
}
function texto(p, i, fim) {
  const d = p.dados, s = d.pesc[i], times = p.modo === 'times';
  const dica = fim ? 'Acabou o tempo!' : s.fase === 'mordida' ? 'Aperte agora!' : s.fase === 'luta' ? 'Martele o botão!' : s.fase === 'susto' ? 'Os peixes fugiram, espere' : 'Espere a boia afundar';
  return `${times ? 'Sua dupla' : 'Você'}: ${d.placar[donoDe(p, i)]} kg. ${dica}`;
}

export default {
  id: 'pesca-festa', genero: 'reflexo', nome: 'Pescaria da Turma',
  dica: 'Aperte quando a boia afundar e martele o botão: quem pescar mais quilos vence.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'botao', a: 'Puxa' }, semMovimento: true, rotulo: 'quilos', sufixo: ' kg', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length, donos = p.modo === 'times' ? 2 : n;
    p.arena = { tipo: 'ret', lx: LX, lz: lzDe(n), parede: true };
    p.jogadores.forEach((j, i) => { const l = lugar(n, i); j.x = l.lado * XJ; j.z = l.z; });
    p.dados = {
      pesc: p.jogadores.map(() => espera(p)), pesos: Array(n).fill(0), placar: Array(donos).fill(0), pegos: p.jogadores.map(() => []),
      voos: [], fx: [], aviso: '', avisoCor: '#ffd84d', avisoT: 0,
    };
    p.jogadores.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: texto(p, i) }; });
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    const efeito = (tipo, i) => { if (d.fx.length < 16) d.fx.push({ tipo, i }); };
    const vibra = i => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

    p.jogadores.forEach((j, i) => {
      const l = lugar(n, i);
      j.x = l.lado * XJ; j.z = l.z; j.vx = j.vz = 0;
      const s = d.pesc[i], toques = j.apertouA;
      s.t -= dt;
      if (s.fase === 'espera') {
        s.calma -= dt;
        if (toques && s.calma <= 0) { d.pesc[i] = { ...espera(p), fase: 'susto', t: T_SUSTO }; j.vy = 7; p.eventos.push('pulo'); efeito('susto', i); }
        else if (s.t <= 0) { s.fase = 'mordida'; s.t = JANELA; vibra(i); p.eventos.push('troca'); efeito('mordida', i); }
      } else if (s.fase === 'mordida') {
        if (toques) { s.fase = 'luta'; s.tipo = sorteia(p); s.barra = BARRA_INICIAL; p.eventos.push('dash'); efeito('fisgou', i); }
        else if (s.t <= 0) { d.pesc[i] = espera(p); efeito('fugiu', i); }
      } else if (s.fase === 'luta') {
        const tipo = TIPOS[s.tipo];
        s.barra += toques * tipo.ganho - tipo.puxa * dt;
        if (s.barra >= 1) {
          d.pesos[i] += tipo.peso; d.pegos[i].push(s.tipo); d.voos.push({ i, tipo: s.tipo, t: 0 });
          if (tipo.id === 'bota') { d.aviso = 'Bota velha!'; d.avisoCor = '#c98a4a'; d.avisoT = 1.3; p.eventos.push('queda'); p.jogadores.forEach((_, k) => vibra(k)); efeito('bota', i); }
          else {
            if (tipo.id === 'grande') { d.aviso = 'Peixão!'; d.avisoCor = '#b46bff'; d.avisoT = 1.1; }
            p.eventos.push('moeda'); efeito('pegou', i);
          }
          d.pesc[i] = espera(p, T_CALMA);
        } else if (s.barra <= 0) { d.pesc[i] = espera(p, T_CALMA); p.eventos.push('batida'); efeito('fugiu', i); }
      } else if (s.t <= 0) d.pesc[i] = espera(p);          // fim do susto
    });
    recalcula(p);

    for (const v of d.voos) v.t += dt;
    d.voos = d.voos.filter(v => v.t < T_VOO);
    if (d.avisoT > 0 && (d.avisoT -= dt) <= 0) d.aviso = '';

    const fim = p.t >= TEMPO;
    p.jogadores.forEach((_, i) => {       // o celular repete os quilos e o que fazer agora
      const t = texto(p, i, fim);
      if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
    });
    if (fim) {
      d.aviso = 'Acabou o tempo!'; d.avisoCor = '#ffd84d'; d.avisoT = 999;
      return vencedor(d.placar);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c, p = c.p, n = p.jogadores.length, times = p.modo === 'times';
    const corDe = i => (times ? c.times[timeDe(p, i)] : c.cores[i]);
    const lz = lzDe(n), lagoZ = n > 2 ? 6.6 : 4.8, fz = lz / 6.5;
    const poe = (m, x, y, z, sombra = false) => { m.position.set(x, y, z); m.castShadow = sombra; grupo.add(m); return m; };
    const caixa = (lx, ly, lzz, cor, x, y, z, extra) => poe(malha(new THREE.BoxGeometry(lx, ly, lzz), cor, extra), x, y, z);
    const disco = (r, alt, cor, extra) => malha(new THREE.CylinderGeometry(r, r, alt, 48), cor, extra);

    caixa(LX * 2, 0.02, lz * 2, 0x3f9b4f, 0, 0.01, 0, { roughness: 0.95 }).receiveShadow = true;                 // grama
    poe(disco(1, 0.04, 0xe2c98a, { roughness: 1 }), 0, 0.03, 0).scale.set(6.6, 1, lagoZ + 0.6);                  // areia
    pecas.agua = poe(disco(1, 0.04, 0x2aa7e0, { emissive: 0x0a4a80, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.92 }), 0, 0.05, 0);
    pecas.agua.scale.set(6, 1, lagoZ);

    pecas.sombras = []; pecas.juncos = []; pecas.folhas = []; pecas.lanternas = []; pecas.vagalumes = [];
    for (let k = 0; k < 4 * n; k++) {                                                                         // peixes: sombras nadando em volta de cada boia
      const m = poe(malha(new THREE.SphereGeometry(1, 14, 8), 0x0b2a4a, { transparent: true, opacity: 0.55 }), 0, 0.085, 0);
      m.scale.set(0.5 + (k % 3) * 0.12, 0.02, 0.18 + (k % 3) * 0.04); pecas.sombras.push(m);
    }
    for (let k = 0; k < 12; k++) {                                                                            // juncos na margem do fundo
      const ang = Math.PI + 0.6 + k * (Math.PI - 1.2) / 11, alt = 1.3 + (k * 7 % 5) * 0.2;
      const g = new THREE.Group();
      const haste = malha(new THREE.CylinderGeometry(0.05, 0.07, alt, 6), 0x2f7d3a); haste.position.y = alt / 2;
      const ponta = malha(new THREE.CylinderGeometry(0.11, 0.11, 0.45, 8), 0x6b3f1d); ponta.position.y = alt;
      g.add(haste, ponta); g.position.set(Math.cos(ang) * 6.3, 0, Math.sin(ang) * (lagoZ + 0.3)); grupo.add(g); pecas.juncos.push(g);
    }
    for (const [k, [x, z]] of [[-1.2, -3.4], [1.6, 3.3], [0, -1.9], [-4.2, 2.4], [4.3, -2.5], [0.3, 2]].entries()) {   // vitorias-regias
      const g = new THREE.Group();
      g.add(disco(0.5, 0.04, 0x2f9e44));
      if (k % 2 === 0) { const flor = malha(new THREE.SphereGeometry(0.17, 10, 8), 0xff8fc7, { emissive: 0xff4fa3, emissiveIntensity: 0.5 }); flor.position.y = 0.14; g.add(flor); }
      g.position.set(x, 0.09, z * fz); g.userData = { x, z: z * fz }; grupo.add(g); pecas.folhas.push(g);
    }
    for (const [x, z, r] of [[-5.6, 4.3, 0.6], [5.9, 4.1, 0.45], [2.4, 5.4, 0.5], [-2.8, 5.5, 0.35], [6.6, -3.6, 0.5], [-6.5, -3.8, 0.4]])
      poe(malha(new THREE.DodecahedronGeometry(r), 0x8a8f9c, { roughness: 1 }), x, r * 0.5, z * fz * (n > 2 ? 1.12 : 1), true);   // pedras
    for (let k = 0; k < 8; k++) pecas.vagalumes.push(poe(malha(new THREE.SphereGeometry(0.08, 8, 6), 0xfff27a, { emissive: 0xfff27a, emissiveIntensity: 1.5 }), 0, 2, 0));

    pecas.pesc = p.jogadores.map((_, i) => {
      const { lado, z } = lugar(n, i), cor = corDe(i), u = {};
      caixa(4.6, 0.06, 2.2, 0x9a6b3c, lado * 7.5, 0.06, z, { roughness: 0.9 }).receiveShadow = true;              // pier
      for (let k = 0; k < 6; k++) caixa(0.06, 0.07, 2.2, 0x6b4423, lado * (5.5 + k * 0.8), 0.065, z);
      for (const dz of [-1.1, 1.1]) caixa(0.22, 0.7, 0.22, 0x6b4423, lado * 5.4, 0.3, z + dz).castShadow = true;
      caixa(1.1, 0.08, 2.2, cor, lado * 9.4, 0.12, z, { emissive: cor, emissiveIntensity: 0.35 });               // tapete da cor de quem pesca
      caixa(0.16, 1.9, 0.16, 0x4a3320, lado * 9.9, 0.95, z - 1.5).castShadow = true;                            // lanterna do pier
      u.lanterna = poe(malha(new THREE.SphereGeometry(0.3, 14, 10), 0xffd27a, { emissive: 0xffb02e, emissiveIntensity: 1 }), lado * 9.9, 2.1, z - 1.5);
      pecas.lanternas.push(u.lanterna);

      const balde = malha(new THREE.CylinderGeometry(0.75, 0.55, 0.9, 20, 1, true), cor, { side: THREE.DoubleSide, emissive: cor, emissiveIntensity: 0.25 });
      poe(balde, lado * X_BALDE, 0.45, z + Z_BALDE, true);
      poe(malha(new THREE.TorusGeometry(0.75, 0.06, 8, 24), 0xdfe6f0), lado * X_BALDE, 0.9, z + Z_BALDE).rotation.x = Math.PI / 2;

      u.vara = poe(malha(new THREE.CylinderGeometry(0.05, 0.09, 1, 8), 0x5a3a1a), 0, 0, 0, true);
      u.linha = poe(malha(new THREE.CylinderGeometry(0.03, 0.03, 1, 5), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 }), 0, 0, 0);
      u.boia = new THREE.Group();
      const baixo = malha(new THREE.SphereGeometry(0.32, 16, 12), cor, { emissive: cor, emissiveIntensity: 0.5 });
      const cima = malha(new THREE.SphereGeometry(0.24, 14, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 }); cima.position.y = 0.22;
      const pino = malha(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), 0xff3b3b, { emissive: 0xff3b3b, emissiveIntensity: 0.8 }); pino.position.y = 0.55;
      u.boia.add(baixo, cima, pino); u.boia.scale.setScalar(1.7); grupo.add(u.boia);       // maior, para se ver do sofá
      u.ondas = [0, 1].map(() => {
        const m = malha(new THREE.RingGeometry(0.8, 0.9, 28), 0xffffff, { transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        m.rotation.x = -Math.PI / 2; return poe(m, lado * X_BOIA, 0.09, z);
      });
      u.vulto = poe(malha(new THREE.SphereGeometry(1, 14, 8), 0x06203a, { transparent: true, opacity: 0.7 }), lado * X_BOIA, 0.088, z);   // o peixe fisgado, por baixo da boia
      u.alerta = new THREE.Group();                                                                           // exclamacao amarela quando a boia afunda
      const traco = malha(new THREE.ConeGeometry(0.28, 0.9, 10), 0xffe14d, { emissive: 0xffc400, emissiveIntensity: 1.2 }); traco.rotation.x = Math.PI; traco.position.y = 0.55;
      const ponto = malha(new THREE.SphereGeometry(0.17, 10, 8), 0xffe14d, { emissive: 0xffc400, emissiveIntensity: 1.2 });
      u.alerta.add(traco, ponto); grupo.add(u.alerta);
      u.fundo = caixa(2.7, 0.42, 0.08, 0x141a2a, lado * X_BOIA, 2.5, z - 0.05);                                  // barra de luta
      u.barra = caixa(1, 0.28, 0.1, cor, 0, 2.5, z, { emissive: cor, emissiveIntensity: 0.8 });
      return u;
    });
    pecas.v = { a: new THREE.Vector3(), b: new THREE.Vector3(), cima: new THREE.Vector3(0, 1, 0) };
  },

  desenha(c, dt, t) {
    const { THREE, malha, pecas, p } = c, d = p.dados, v = pecas.v, n = p.jogadores.length, times = p.modo === 'times';
    const corDe = i => (times ? c.times[timeDe(p, i)] : c.cores[i]);
    const entre = (m, ax, ay, az, bx, by, bz) => {             // estica um cilindro de altura 1 entre dois pontos
      v.a.set(ax, ay, az); v.b.set(bx - ax, by - ay, bz - az);
      const len = v.b.length() || 0.001;
      m.position.copy(v.a).addScaledVector(v.b, 0.5); m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(v.cima, v.b.divideScalar(len));
    };

    d.pesc.forEach((s, i) => {
      const u = pecas.pesc[i], { lado, z: zr } = lugar(n, i), j = p.jogadores[i], bx0 = lado * X_BOIA;
      const luta = s.fase === 'luta', mordida = s.fase === 'mordida', susto = s.fase === 'susto';
      let bx = bx0, bz = zr, by = 0.22 + Math.sin(t * 2.5 + i * 2) * 0.05;
      if (mordida) by = -0.22 + Math.sin(t * 30) * 0.04;
      if (luta) { bx += Math.sin(t * 13 + i) * 0.55; bz += Math.cos(t * 9 + i) * 0.7; by = 0.02; }
      u.boia.position.set(bx, by, bz); u.boia.rotation.z = luta ? Math.sin(t * 20) * 0.5 : Math.sin(t * 2 + i) * 0.1;

      const puxao = luta ? 0.5 + s.barra * 0.5 + Math.sin(t * 25) * 0.08 : mordida ? 0.35 : 0;   // a vara enverga
      const px = lado * (5.7 + puxao * 0.5), py = 3.5 - puxao * 1.1 + j.y * 0.6;
      entre(u.vara, lado * (XJ - 0.75), 1.1 + j.y, zr + 0.2, px, py, zr);
      entre(u.linha, px, py, zr, bx, by + 0.6, bz);
      const corpo = c.bonecos[i].userData?.corpo;
      if (corpo) { corpo.rotation.y = -lado * Math.PI / 2; corpo.rotation.z = luta ? lado * (0.15 + Math.sin(t * 25) * 0.05) : 0; }

      u.ondas.forEach((m, k) => {
        const f = (t * (mordida || luta ? 2.2 : 0.6) + k * 0.5) % 1;
        m.position.set(bx, 0.09, bz); m.scale.setScalar(0.5 + f * (luta ? 2 : 1.2)); m.material.opacity = (1 - f) * 0.6;
      });
      u.alerta.visible = mordida;
      u.alerta.position.set(bx0, 1.5 + Math.abs(Math.sin(t * 16)) * 0.35, zr); u.alerta.scale.setScalar(1.2 + Math.sin(t * 24) * 0.2);
      u.vulto.visible = luta;
      if (luta) { const tam = TIPOS[s.tipo].tam; u.vulto.position.set(bx, 0.088, bz); u.vulto.scale.set(tam, 0.02, tam * 0.45); u.vulto.rotation.y = Math.sin(t * 9) * 0.8; }
      u.fundo.visible = u.barra.visible = luta;
      if (luta) {
        const b = Math.max(0.02, Math.min(1, s.barra));
        u.barra.scale.x = 2.5 * b; u.barra.position.x = bx0 - 1.25 + 1.25 * b;
        u.barra.material.emissiveIntensity = b < 0.25 ? 0.4 + Math.abs(Math.sin(t * 18)) : 0.8;   // pisca quando o peixe esta escapando
      }
      if (luta && Math.random() < 0.3) c.particulas(bx, 0.2, bz, 0xcfefff, 1, 3);
      if (susto && Math.random() < 0.1) c.particulas(j.x, 2.2, zr, 0xffffff, 1, 2);
      u.lanterna.material.emissiveIntensity = 0.7 + Math.sin(t * 3 + i * 2) * 0.3;
    });

    pecas.sombras.forEach((m, k) => {                          // os peixes de quem se assustou somem por um tempo
      const i = k % n, idx = Math.floor(k / n), { lado, z } = lugar(n, i);
      const sentido = k % 4 < 2 ? 1 : -1, r = (n > 2 ? 0.9 : 1.2) + (idx % 4) * (n > 2 ? 0.35 : 0.5);
      const ang = sentido * t * (0.5 + k * 0.07) + k * 1.7;
      m.position.set(lado * X_BOIA + Math.cos(ang) * r * 1.05, 0.085, z + Math.sin(ang) * r);
      m.rotation.y = -ang - sentido * Math.PI / 2;
      const alvo = d.pesc[i].fase === 'susto' ? 0.04 : 0.55;
      m.material.opacity += (alvo - m.material.opacity) * Math.min(1, dt * 6);
    });
    pecas.juncos.forEach((g, k) => { g.rotation.z = Math.sin(t * 1.3 + k) * 0.09; });
    pecas.folhas.forEach((g, k) => { g.position.set(g.userData.x + Math.sin(t * 0.4 + k) * 0.25, 0.09, g.userData.z + Math.cos(t * 0.3 + k * 2) * 0.2); g.rotation.y = t * 0.2 + k; });
    pecas.vagalumes.forEach((m, k) => {
      m.position.set(Math.sin(t * 0.5 + k * 2.1) * 8.5, 1.4 + Math.sin(t * 1.1 + k) * 0.7, -(n > 2 ? 5.5 : 3.5) + Math.cos(t * 0.37 + k * 1.3) * 2.5);
      m.material.emissiveIntensity = 0.6 + Math.abs(Math.sin(t * 2 + k)) * 1.4;
    });
    pecas.agua.material.emissiveIntensity = 0.5 + Math.sin(t * 1.5) * 0.12;

    // o que foi pescado voa em arco da boia ate o balde, girando
    const voos = c.pool('voos', d.voos.length, () => {
      const g = new THREE.Group(), peixe = new THREE.Group(), bota = new THREE.Group();
      const corpo = malha(new THREE.SphereGeometry(0.5, 16, 12), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.35 }); corpo.scale.set(1, 0.6, 0.4);
      const rabo = malha(new THREE.ConeGeometry(0.3, 0.45, 4), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.35 }); rabo.rotation.z = -Math.PI / 2; rabo.position.x = -0.65; rabo.scale.z = 0.4;
      const olho = malha(new THREE.SphereGeometry(0.07, 8, 6), 0x111111); olho.position.set(0.3, 0.08, 0.17);
      peixe.add(corpo, rabo, olho);
      const cano = malha(new THREE.BoxGeometry(0.42, 0.75, 0.4), 0x7a4a21); cano.position.set(-0.15, 0.25, 0);
      const sola = malha(new THREE.BoxGeometry(0.85, 0.3, 0.42), 0x4a2c12); sola.position.set(0.05, -0.2, 0);
      bota.add(cano, sola);
      g.add(peixe, bota); g.userData = { peixe, bota, corpo, rabo };
      return g;
    });
    d.voos.forEach((voo, k) => {
      const g = voos[k], u = g.userData, tipo = TIPOS[voo.tipo], { lado, z } = lugar(n, voo.i), f = Math.min(1, voo.t / T_VOO);
      u.bota.visible = tipo.id === 'bota'; u.peixe.visible = !u.bota.visible;
      u.corpo.material.color.set(tipo.cor); u.corpo.material.emissive.set(tipo.cor); u.rabo.material.color.set(tipo.cor); u.rabo.material.emissive.set(tipo.cor);
      g.position.set(lado * (X_BOIA + (X_BALDE - X_BOIA) * f), 0.4 + Math.sin(f * Math.PI) * 4.2 + f * 0.6, z + Z_BALDE * f);
      g.rotation.z = voo.t * 11; g.scale.setScalar(tipo.tam * 1.2);
    });

    // balde: uma bolinha da cor do peixe por pescado (a bota fica marrom por cima)
    const noBalde = d.pegos.map((lista, i) => Math.min(NO_BALDE, lista.length - d.voos.filter(voo => voo.i === i).length));
    const bolas = c.pool('pegos', noBalde.reduce((a, b) => a + b, 0), () => malha(new THREE.SphereGeometry(0.24, 12, 8), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }));
    let q = 0;
    noBalde.forEach((total, i) => {
      const { lado, z } = lugar(n, i);
      for (let k = 0; k < total; k++) {
        const m = bolas[q++], cor = TIPOS[d.pegos[i][k]].cor;
        m.material.color.set(cor); m.material.emissive.set(cor);
        m.position.set(lado * X_BALDE + ((k % 3) - 1) * 0.3, 0.75 + Math.floor(k / 3) * 0.3, z + Z_BALDE + ((k * 2) % 3 - 1) * 0.22);
      }
    });

    for (const f of d.fx.splice(0)) {
      const { lado, z } = lugar(n, f.i), x = lado * X_BOIA;
      if (f.tipo === 'mordida') { c.particulas(x, 0.3, z, 0xcfefff, 16, 6); c.som(880, 0.12, 'square', 0.15); }
      if (f.tipo === 'fisgou') { c.particulas(x, 0.3, z, 0xffffff, 12, 7); c.som(520, 0.1, 'triangle', 0.2); }
      if (f.tipo === 'pegou') { c.particulas(x, 0.5, z, corDe(f.i), 22, 9); c.particulas(x, 0.3, z, 0xcfefff, 14, 7); c.som(660, 0.25, 'triangle', 0.2); }
      if (f.tipo === 'bota') { c.particulas(x, 0.5, z, 0x7a4a21, 26, 9); c.som(140, 0.5, 'sawtooth', 0.25); }
      if (f.tipo === 'fugiu') { c.particulas(x, 0.2, z, 0x2aa7e0, 8, 4); c.som(200, 0.15, 'sine', 0.15); }
      if (f.tipo === 'susto') { c.particulas(lado * XJ, 2, z, 0xffffff, 14, 6); c.particulas(x, 0.2, z, 0x0b2a4a, 10, 5); c.som(300, 0.2, 'sawtooth', 0.15); }
    }
  },
};
