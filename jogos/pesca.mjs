// Pescaria: cada um numa margem do lago. A boia afunda em momentos sorteados (diferentes para cada um) e o celular vibra:
// apertar em ate 0,6 s fisga; apertar antes espanta os peixes por 2 s. Fisgou: martelar o botao para vencer a barra de luta.
import { maiorPlacar } from '../logica.mjs';

export const TEMPO = 35, JANELA = 0.6, T_SUSTO = 2, BARRA_INICIAL = 0.35;
// ganho: quanto a barra sobe por toque. puxa: quanto o peixe tira da barra por segundo.
export const TIPOS = [
  { id: 'pequeno', peso: 1, ganho: 0.2, puxa: 0.15, chance: 0.45, cor: 0xffa033, tam: 0.6 },
  { id: 'medio', peso: 2, ganho: 0.12, puxa: 0.22, chance: 0.28, cor: 0x3ddc84, tam: 0.9 },
  { id: 'grande', peso: 4, ganho: 0.085, puxa: 0.3, chance: 0.15, cor: 0xb46bff, tam: 1.4 },
  { id: 'bota', peso: 0, ganho: 0.15, puxa: 0.1, chance: 0.12, cor: 0x7a4a21, tam: 1 },
];
const LX = 10.5, LZ = 6.5, XJ = 8.4, X_BOIA = 3, X_BALDE = 8.7, Z_BALDE = 2.7, T_VOO = 0.8, T_CALMA = 0.8, NO_BALDE = 12;

function sorteia(p) {
  let r = p.rng();
  for (let n = 0; n < TIPOS.length; n++) if ((r -= TIPOS[n].chance) < 0) return n;
  return 0;
}

// calma: logo depois de uma luta os toques nao contam, senao quem martelava o botao levaria susto sem querer.
const espera = (p, calma = 0) => ({ fase: 'espera', t: 1.2 + p.rng() * 3, tipo: -1, barra: 0, calma });

export default {
  id: 'pesca', genero: 'reflexo', nome: 'Pescaria', dica: 'Quando a sua boia afundar e aparecer o sinal amarelo, aperte. Depois martele para puxar. Apertar antes espanta os peixes.',
  controle: { modo: 'botao', a: 'PUXA' }, semMovimento: true, rotulo: 'quilos', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    p.jogadores.forEach((j, i) => { j.x = (i ? 1 : -1) * XJ; j.z = 0; });
    p.dados = { pesc: [espera(p), espera(p)], placar: [0, 0], pegos: [[], []], voos: [], fx: [], aviso: '', avisoCor: '#ffd84d', avisoT: 0 };
  },

  atualiza(p, dt) {
    const d = p.dados;
    const efeito = (tipo, i) => { if (d.fx.length < 12) d.fx.push({ tipo, i }); };
    const vibra = i => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

    p.jogadores.forEach((j, i) => {
      j.x = (i ? 1 : -1) * XJ; j.z = 0; j.vx = j.vz = 0;
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
          d.placar[i] += tipo.peso; d.pegos[i].push(s.tipo); d.voos.push({ i, tipo: s.tipo, t: 0 });
          if (tipo.id === 'bota') { d.aviso = 'Bota velha!'; d.avisoCor = '#c98a4a'; d.avisoT = 1.3; p.eventos.push('queda'); vibra(0); vibra(1); efeito('bota', i); }
          else {
            if (tipo.id === 'grande') { d.aviso = 'Peixão!'; d.avisoCor = '#b46bff'; d.avisoT = 1.1; }
            p.eventos.push('moeda'); efeito('pegou', i);
          }
          d.pesc[i] = espera(p, T_CALMA);
        } else if (s.barra <= 0) { d.pesc[i] = espera(p, T_CALMA); p.eventos.push('batida'); efeito('fugiu', i); }
      } else if (s.t <= 0) d.pesc[i] = espera(p);          // fim do susto
    });

    for (const v of d.voos) v.t += dt;
    d.voos = d.voos.filter(v => v.t < T_VOO);
    if (d.avisoT > 0 && (d.avisoT -= dt) <= 0) d.aviso = '';
    if (p.t >= TEMPO) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const poe = (m, x, y, z, sombra = false) => { m.position.set(x, y, z); m.castShadow = sombra; grupo.add(m); return m; };
    const caixa = (lx, ly, lz, cor, x, y, z, extra) => poe(malha(new THREE.BoxGeometry(lx, ly, lz), cor, extra), x, y, z);
    const disco = (r, alt, cor, extra) => malha(new THREE.CylinderGeometry(r, r, alt, 48), cor, extra);

    caixa(LX * 2, 0.02, LZ * 2, 0x3f9b4f, 0, 0.01, 0, { roughness: 0.95 }).receiveShadow = true;                 // grama
    poe(disco(1, 0.04, 0xe2c98a, { roughness: 1 }), 0, 0.03, 0).scale.set(6.6, 1, 5.4);                         // areia
    pecas.agua = poe(disco(1, 0.04, 0x2aa7e0, { emissive: 0x0a4a80, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.92 }), 0, 0.05, 0);
    pecas.agua.scale.set(6, 1, 4.8);

    pecas.sombras = []; pecas.juncos = []; pecas.folhas = []; pecas.lanternas = []; pecas.vagalumes = [];
    for (let k = 0; k < 8; k++) {                                                                             // peixes: sombras nadando em volta de cada boia
      const m = poe(malha(new THREE.SphereGeometry(1, 14, 8), 0x0b2a4a, { transparent: true, opacity: 0.55 }), 0, 0.085, 0);
      m.scale.set(0.5 + (k % 3) * 0.12, 0.02, 0.18 + (k % 3) * 0.04); pecas.sombras.push(m);
    }
    for (let k = 0; k < 12; k++) {                                                                            // juncos na margem do fundo
      const ang = Math.PI + 0.25 + k * (Math.PI - 0.5) / 11, alt = 1.3 + (k * 7 % 5) * 0.2;
      const g = new THREE.Group();
      const haste = malha(new THREE.CylinderGeometry(0.05, 0.07, alt, 6), 0x2f7d3a); haste.position.y = alt / 2;
      const ponta = malha(new THREE.CylinderGeometry(0.11, 0.11, 0.45, 8), 0x6b3f1d); ponta.position.y = alt;
      g.add(haste, ponta); g.position.set(Math.cos(ang) * 6.3, 0, Math.sin(ang) * 5.1); grupo.add(g); pecas.juncos.push(g);
    }
    for (const [k, [x, z]] of [[-1.2, -3.4], [1.6, 3.3], [0, -1.9], [-4.2, 2.4], [4.3, -2.5], [0.3, 2]].entries()) {   // vitorias-regias
      const g = new THREE.Group();
      g.add(disco(0.5, 0.04, 0x2f9e44));
      if (k % 2 === 0) { const flor = malha(new THREE.SphereGeometry(0.17, 10, 8), 0xff8fc7, { emissive: 0xff4fa3, emissiveIntensity: 0.5 }); flor.position.y = 0.14; g.add(flor); }
      g.position.set(x, 0.09, z); g.userData = { x, z }; grupo.add(g); pecas.folhas.push(g);
    }
    for (const [x, z, r] of [[-5.6, 4.3, 0.6], [5.9, 4.1, 0.45], [2.4, 5.4, 0.5], [-2.8, 5.5, 0.35], [6.6, -3.6, 0.5], [-6.5, -3.8, 0.4]])
      poe(malha(new THREE.DodecahedronGeometry(r), 0x8a8f9c, { roughness: 1 }), x, r * 0.5, z, true);          // pedras
    for (let k = 0; k < 8; k++) pecas.vagalumes.push(poe(malha(new THREE.SphereGeometry(0.08, 8, 6), 0xfff27a, { emissive: 0xfff27a, emissiveIntensity: 1.5 }), 0, 2, 0));

    pecas.pesc = [0, 1].map(i => {
      const lado = i ? 1 : -1, cor = cores[i], u = {};
      caixa(4.6, 0.06, 2.2, 0x9a6b3c, lado * 7.5, 0.06, 0, { roughness: 0.9 }).receiveShadow = true;             // pier
      for (let k = 0; k < 6; k++) caixa(0.06, 0.07, 2.2, 0x6b4423, lado * (5.5 + k * 0.8), 0.065, 0);
      for (const z of [-1.1, 1.1]) caixa(0.22, 0.7, 0.22, 0x6b4423, lado * 5.4, 0.3, z).castShadow = true;
      caixa(0.16, 1.9, 0.16, 0x4a3320, lado * 9.9, 0.95, -1.5).castShadow = true;                             // lanterna do pier
      u.lanterna = poe(malha(new THREE.SphereGeometry(0.3, 14, 10), 0xffd27a, { emissive: 0xffb02e, emissiveIntensity: 1 }), lado * 9.9, 2.1, -1.5);
      pecas.lanternas.push(u.lanterna);

      const balde = malha(new THREE.CylinderGeometry(0.75, 0.55, 0.9, 20, 1, true), cor, { side: THREE.DoubleSide, emissive: cor, emissiveIntensity: 0.25 });
      poe(balde, lado * X_BALDE, 0.45, Z_BALDE, true);
      poe(malha(new THREE.TorusGeometry(0.75, 0.06, 8, 24), 0xdfe6f0), lado * X_BALDE, 0.9, Z_BALDE).rotation.x = Math.PI / 2;

      u.vara = poe(malha(new THREE.CylinderGeometry(0.05, 0.09, 1, 8), 0x5a3a1a), 0, 0, 0, true);
      u.linha = poe(malha(new THREE.CylinderGeometry(0.03, 0.03, 1, 5), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 }), 0, 0, 0);
      u.boia = new THREE.Group();
      const baixo = malha(new THREE.SphereGeometry(0.32, 16, 12), cor, { emissive: cor, emissiveIntensity: 0.5 });
      const cima = malha(new THREE.SphereGeometry(0.24, 14, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 }); cima.position.y = 0.22;
      const pino = malha(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6), 0xff3b3b, { emissive: 0xff3b3b, emissiveIntensity: 0.8 }); pino.position.y = 0.55;
      u.boia.add(baixo, cima, pino); grupo.add(u.boia);
      u.ondas = [0, 1].map(() => {
        const m = malha(new THREE.RingGeometry(0.8, 0.9, 28), 0xffffff, { transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        m.rotation.x = -Math.PI / 2; return poe(m, lado * X_BOIA, 0.09, 0);
      });
      u.vulto = poe(malha(new THREE.SphereGeometry(1, 14, 8), 0x06203a, { transparent: true, opacity: 0.7 }), lado * X_BOIA, 0.088, 0);   // o peixe fisgado, por baixo da boia
      u.alerta = new THREE.Group();                                                                           // "!" amarelo quando a boia afunda
      const traco = malha(new THREE.ConeGeometry(0.28, 0.9, 10), 0xffe14d, { emissive: 0xffc400, emissiveIntensity: 1.2 }); traco.rotation.x = Math.PI; traco.position.y = 0.55;
      const ponto = malha(new THREE.SphereGeometry(0.17, 10, 8), 0xffe14d, { emissive: 0xffc400, emissiveIntensity: 1.2 });
      u.alerta.add(traco, ponto); grupo.add(u.alerta);
      u.fundo = caixa(2.7, 0.42, 0.08, 0x141a2a, lado * X_BOIA, 2.5, -0.05);                                    // barra de luta
      u.barra = caixa(1, 0.28, 0.1, cor, 0, 2.5, 0, { emissive: cor, emissiveIntensity: 0.8 });
      u.fase = 'espera';
      return u;
    });
    pecas.v = { a: new THREE.Vector3(), b: new THREE.Vector3(), cima: new THREE.Vector3(0, 1, 0) };
  },

  desenha(c, dt, t) {
    const { THREE, malha, pecas, cores, p } = c, d = p.dados, v = pecas.v;
    const entre = (m, ax, ay, az, bx, by, bz) => {             // estica um cilindro de altura 1 entre dois pontos
      v.a.set(ax, ay, az); v.b.set(bx - ax, by - ay, bz - az);
      const len = v.b.length() || 0.001;
      m.position.copy(v.a).addScaledVector(v.b, 0.5); m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(v.cima, v.b.divideScalar(len));
    };

    d.pesc.forEach((s, i) => {
      const u = pecas.pesc[i], lado = i ? 1 : -1, j = p.jogadores[i], bx0 = lado * X_BOIA;
      const luta = s.fase === 'luta', mordida = s.fase === 'mordida', susto = s.fase === 'susto';
      let bx = bx0, bz = 0, by = 0.22 + Math.sin(t * 2.5 + i * 2) * 0.05;
      if (mordida) by = -0.22 + Math.sin(t * 30) * 0.04;
      if (luta) { bx += Math.sin(t * 13 + i) * 0.55; bz = Math.cos(t * 9 + i) * 0.7; by = 0.02; }
      u.boia.position.set(bx, by, bz); u.boia.rotation.z = luta ? Math.sin(t * 20) * 0.5 : Math.sin(t * 2 + i) * 0.1;

      const puxao = luta ? 0.5 + s.barra * 0.5 + Math.sin(t * 25) * 0.08 : mordida ? 0.35 : 0;   // a vara enverga
      const px = lado * (5.7 + puxao * 0.5), py = 3.5 - puxao * 1.1 + j.y * 0.6;
      entre(u.vara, lado * (XJ - 0.75), 1.1 + j.y, 0.2, px, py, 0);
      entre(u.linha, px, py, 0, bx, by + 0.6, bz);
      const corpo = c.bonecos[i].userData?.corpo;
      if (corpo) { corpo.rotation.y = -lado * Math.PI / 2; corpo.rotation.z = luta ? lado * (0.15 + Math.sin(t * 25) * 0.05) : 0; }

      u.ondas.forEach((m, k) => {
        const f = (t * (mordida || luta ? 2.2 : 0.6) + k * 0.5) % 1;
        m.position.set(bx, 0.09, bz); m.scale.setScalar(0.5 + f * (luta ? 2 : 1.2)); m.material.opacity = (1 - f) * 0.6;
      });
      u.alerta.visible = mordida;
      u.alerta.position.set(bx0, 1.5 + Math.abs(Math.sin(t * 16)) * 0.35, 0); u.alerta.scale.setScalar(1.2 + Math.sin(t * 24) * 0.2);
      u.vulto.visible = luta;
      if (luta) { const tam = TIPOS[s.tipo].tam; u.vulto.position.set(bx, 0.088, bz); u.vulto.scale.set(tam, 0.02, tam * 0.45); u.vulto.rotation.y = Math.sin(t * 9) * 0.8; }
      u.fundo.visible = u.barra.visible = luta;
      if (luta) {
        const b = Math.max(0.02, Math.min(1, s.barra));
        u.barra.scale.x = 2.5 * b; u.barra.position.x = bx0 - 1.25 + 1.25 * b;
        u.barra.material.emissiveIntensity = b < 0.25 ? 0.4 + Math.abs(Math.sin(t * 18)) : 0.8;   // pisca quando o peixe esta escapando
      }
      if (luta && Math.random() < 0.3) c.particulas(bx, 0.2, bz, 0xcfefff, 1, 3);
      if (susto && Math.random() < 0.1) c.particulas(j.x, 2.2, 0, 0xffffff, 1, 2);
      u.lanterna.material.emissiveIntensity = 0.7 + Math.sin(t * 3 + i * 2) * 0.3;
    });

    pecas.sombras.forEach((m, k) => {                          // os peixes de quem se assustou somem por um tempo
      const i = k % 2, lado = i ? 1 : -1, sentido = k % 4 < 2 ? 1 : -1, r = 1.2 + (k >> 1) * 0.5;
      const ang = sentido * t * (0.5 + k * 0.07) + k * 1.7;
      m.position.set(lado * X_BOIA + Math.cos(ang) * r * 1.05, 0.085, Math.sin(ang) * r);
      m.rotation.y = -ang - sentido * Math.PI / 2;
      const alvo = d.pesc[i].fase === 'susto' ? 0.04 : 0.55;
      m.material.opacity += (alvo - m.material.opacity) * Math.min(1, dt * 6);
    });
    pecas.juncos.forEach((g, k) => { g.rotation.z = Math.sin(t * 1.3 + k) * 0.09; });
    pecas.folhas.forEach((g, k) => { g.position.set(g.userData.x + Math.sin(t * 0.4 + k) * 0.25, 0.09, g.userData.z + Math.cos(t * 0.3 + k * 2) * 0.2); g.rotation.y = t * 0.2 + k; });
    pecas.vagalumes.forEach((m, k) => {
      m.position.set(Math.sin(t * 0.5 + k * 2.1) * 8.5, 1.4 + Math.sin(t * 1.1 + k) * 0.7, -3.5 + Math.cos(t * 0.37 + k * 1.3) * 2.5);
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
    d.voos.forEach((voo, n) => {
      const g = voos[n], u = g.userData, tipo = TIPOS[voo.tipo], lado = voo.i ? 1 : -1, f = Math.min(1, voo.t / T_VOO);
      u.bota.visible = tipo.id === 'bota'; u.peixe.visible = !u.bota.visible;
      u.corpo.material.color.set(tipo.cor); u.corpo.material.emissive.set(tipo.cor); u.rabo.material.color.set(tipo.cor); u.rabo.material.emissive.set(tipo.cor);
      g.position.set(lado * (X_BOIA + (X_BALDE - X_BOIA) * f), 0.4 + Math.sin(f * Math.PI) * 4.2 + f * 0.6, Z_BALDE * f);
      g.rotation.z = voo.t * 11; g.scale.setScalar(tipo.tam * 1.2);
    });

    // balde: uma bolinha da cor do peixe por pescado (a bota fica marrom por cima)
    const noBalde = [0, 1].map(i => Math.min(NO_BALDE, d.pegos[i].length - d.voos.filter(voo => voo.i === i).length));
    const bolas = c.pool('pegos', noBalde[0] + noBalde[1], () => malha(new THREE.SphereGeometry(0.24, 12, 8), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }));
    let n = 0;
    for (const i of [0, 1])
      for (let k = 0; k < noBalde[i]; k++) {
        const m = bolas[n++], cor = TIPOS[d.pegos[i][k]].cor;
        m.material.color.set(cor); m.material.emissive.set(cor);
        m.position.set((i ? 1 : -1) * X_BALDE + ((k % 3) - 1) * 0.3, 0.75 + Math.floor(k / 3) * 0.3, Z_BALDE + ((k * 2) % 3 - 1) * 0.22);
      }

    for (const f of d.fx.splice(0)) {
      const lado = f.i ? 1 : -1, x = lado * X_BOIA;
      if (f.tipo === 'mordida') { c.particulas(x, 0.3, 0, 0xcfefff, 16, 6); c.som(880, 0.12, 'square', 0.15); }
      if (f.tipo === 'fisgou') { c.particulas(x, 0.3, 0, 0xffffff, 12, 7); c.som(520, 0.1, 'triangle', 0.2); }
      if (f.tipo === 'pegou') { c.particulas(x, 0.5, 0, cores[f.i], 22, 9); c.particulas(x, 0.3, 0, 0xcfefff, 14, 7); c.som(660, 0.25, 'triangle', 0.2); }
      if (f.tipo === 'bota') { c.particulas(x, 0.5, 0, 0x7a4a21, 26, 9); c.som(140, 0.5, 'sawtooth', 0.25); }
      if (f.tipo === 'fugiu') { c.particulas(x, 0.2, 0, 0x2aa7e0, 8, 4); c.som(200, 0.15, 'sine', 0.15); }
      if (f.tipo === 'susto') { c.particulas(lado * XJ, 2, 0, 0xffffff, 14, 6); c.particulas(x, 0.2, 0, 0x0b2a4a, 10, 5); c.som(300, 0.2, 'sawtooth', 0.15); }
    }
  },
};
