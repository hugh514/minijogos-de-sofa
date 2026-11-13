// Rebate: cada um defende o seu gol com uma raquete que anda só de lado. Entra uma bola nova a cada 6 s (até 4).
// A dá um golpe forte por um instante (com recarga). Cada gol sofrido tira 1 de 5 vidas.
import { posiciona, maiorPlacar, colide } from '../logica.mjs';

const LX = 9, LZ = 6.5, ZR = 5.6, MEIA = 1.5, ESPESSURA = 0.3, ALCANCE_FORTE = 0.55, R = 0.45;
const V_PAD = 13, ACEL_PAD = 90, V0 = 7.5, V_MIN = 6, V_MAX = 17, V_FORTE = 20, MAX_ANGULO = 0.95;
const VIDAS = 5, T_BOLA = 6, MAX_BOLAS = 4, LIMITE = 45, PAUSA = 0.8;
const T_GOLPE = 0.28, RECARGA = 1.3, BUFFER = 0.2;
const AMARELO = 0xffd23f;

const limita = (v, m) => Math.max(-m, Math.min(m, v));

// Bola nova no centro: espera um instante e sai para o lado do gol dado (-1 gol de cima, 1 gol de baixo).
function novaBola(p, lado) {
  return { x: 0, z: 0, vx: 0, vz: 0, pausa: PAUSA, lado, sx: (p.rng() * 2 - 1) * 4, dono: -1, som: 0 };
}

// Um sub-passo de uma bola. Devolve o índice de quem levou o gol, ou -1.
function passoBola(p, d, b, h) {
  if (b.pausa > 0) {
    b.pausa -= h;
    if (b.pausa <= 0) { b.vx = b.sx; b.vz = b.lado * V0; }
    return -1;
  }
  b.som -= h;
  b.x += b.vx * h; b.z += b.vz * h;
  if (Math.abs(b.x) > LX - R) { b.x = Math.sign(b.x) * (LX - R); b.vx = -b.vx; }
  if (Math.abs(b.vz) < 2.5) b.vz = (b.vz < 0 ? -1 : 1) * 2.5;                   // nunca fica só de lado

  for (const [i, j] of p.jogadores.entries()) {
    const lado = i ? 1 : -1, forte = d.golpe[i] > 0;
    const frente = ZR - ESPESSURA - (forte ? ALCANCE_FORTE : 0), fundo = ZR + ESPESSURA;
    const prof = b.z * lado;
    if (b.vz * lado <= 0 || prof + R < frente || prof - R > fundo || Math.abs(b.x - j.x) > MEIA + R * 0.6) continue;
    // rebatida: a posição na raquete dá o ângulo (borda = diagonal); o golpe forte e a velocidade da raquete somam
    const v = Math.hypot(b.vx, b.vz);
    let nova = Math.min(V_MAX, v * 1.04 + 0.3);
    if (forte) nova = Math.min(V_FORTE, Math.max(nova * 1.5, 14));
    const ang = limita((b.x - j.x) / MEIA, 1) * MAX_ANGULO;
    let vx = Math.sin(ang) * nova + d.vraq[i] * 0.15, vz = -lado * Math.cos(ang) * nova;
    const len = Math.hypot(vx, vz) || 1;
    b.vx = vx / len * nova; b.vz = vz / len * nova;
    b.z = lado * (frente - R);
    b.dono = i;
    if (b.som <= 0) {
      b.som = 0.12; p.eventos.push(forte ? 'dash' : 'batida');
      d.fx.push({ tipo: forte ? 'forte' : 'rebate', x: b.x, z: b.z, cor: i });
    }
    return -1;
  }

  for (const i of [0, 1]) {
    const lado = i ? 1 : -1;
    if (b.z * lado < LZ) continue;
    d.placar[i] = Math.max(0, d.placar[i] - 1);
    d.fx.push({ tipo: 'gol', x: b.x, z: lado * LZ, cor: i });
    p.eventos.push('gol');
    p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
    Object.assign(b, novaBola(p, lado));          // volta ao centro e sai para quem levou o gol
    return i;
  }
  return -1;
}

export default {
  id: 'rebate', nome: 'Rebate', dica: 'Deslize a raquete e não deixe as bolas passarem. A dá uma rebatida forte. 5 vidas!',
  controle: { modo: 'padrao', a: 'FORTE', b: '' }, semMovimento: true, semDash: true, semPulo: true, rotulo: 'vidas', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posiciona(p, 0, ZR);
    p.dados = {
      placar: [VIDAS, VIDAS], bolas: [novaBola(p, p.rng() < 0.5 ? -1 : 1)], proxBola: T_BOLA,
      vraq: [0, 0], golpe: [0, 0], cd: [0, 0], quer: [0, 0], fx: [], aviso: '', avisoT: 0,
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }

    p.jogadores.forEach((j, i) => {              // a raquete só anda de lado, com um pouco de inércia
      j.vx = 0; j.vz = 0;
      const alvo = limita(j.ent.x, 1) * V_PAD;
      d.vraq[i] += limita(alvo - d.vraq[i], ACEL_PAD * dt);
      j.x = limita(j.x + d.vraq[i] * dt, LX - MEIA);
      if (Math.abs(j.x) >= LX - MEIA) d.vraq[i] = 0;
      j.z = (i ? 1 : -1) * ZR;

      d.golpe[i] = Math.max(0, d.golpe[i] - dt); d.cd[i] -= dt; d.quer[i] -= dt;
      if (j.apertouA > 0) d.quer[i] = BUFFER;    // toque guardado por um instante, se ainda estiver recarregando
      if (d.quer[i] > 0 && d.cd[i] <= 0) { d.quer[i] = 0; d.golpe[i] = T_GOLPE; d.cd[i] = RECARGA; }
    });

    if (d.bolas.length < MAX_BOLAS && p.t >= d.proxBola) {       // bola nova a cada T_BOLA segundos
      d.proxBola += T_BOLA;
      d.bolas.push(novaBola(p, p.rng() < 0.5 ? -1 : 1));
      d.aviso = 'MAIS UMA BOLA!'; d.avisoCor = '#ffd23f'; d.avisoT = 1.2;
      p.eventos.push('troca');
    }

    const n = Math.max(1, Math.ceil(dt * 60 - 1e-6)), h = dt / n;   // passos curtos: a bola nunca atravessa a raquete
    for (let s = 0; s < n; s++)
      for (const b of d.bolas) {
        passoBola(p, d, b, h);
        for (const o of d.bolas) if (o !== b && o.pausa <= 0 && b.pausa <= 0) colide(b, o, R, R, 1, 1);
        const v = Math.hypot(b.vx, b.vz);
        if (b.pausa <= 0 && v > V_FORTE) { b.vx *= V_FORTE / v; b.vz *= V_FORTE / v; }
        else if (b.pausa <= 0 && v < V_MIN) { b.vx *= V_MIN / (v || 1); b.vz *= V_MIN / (v || 1); }
        b.x = limita(b.x, LX - R); b.z = limita(b.z, LZ);
      }

    const [a, b] = d.placar;
    if (a <= 0 || b <= 0) return a <= 0 && b <= 0 ? -1 : a <= 0 ? 1 : 0;
    if (p.t > LIMITE) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = 0; pecas.raquetes = []; pecas.luzes = [[], []]; pecas.faixas = []; pecas.brilho = [0, 0];

    const chao = malha(new THREE.BoxGeometry(LX * 2, 0.04, LZ * 2), 0x12304a, { roughness: 0.4, emissive: 0x0a1a2a, emissiveIntensity: 0.6 });
    chao.position.y = 0.02; chao.castShadow = false; grupo.add(chao);
    const meio = malha(new THREE.BoxGeometry(LX * 2, 0.02, 0.14), 0x4aa8ff, { emissive: 0x4aa8ff, emissiveIntensity: 0.6 });
    meio.position.y = 0.05; meio.castShadow = false; grupo.add(meio);

    for (const i of [0, 1]) {
      const lado = i ? 1 : -1, cor = cores[i];
      // zona do gol com a cor do dono e a linha de gol brilhando
      const zona = malha(new THREE.BoxGeometry(LX * 2, 0.02, 1.4), cor, { transparent: true, opacity: 0.22 });
      zona.position.set(0, 0.05, lado * (LZ - 0.7)); zona.castShadow = false; grupo.add(zona);
      const linha = malha(new THREE.BoxGeometry(LX * 2, 0.1, 0.16), cor, { emissive: cor, emissiveIntensity: 1 });
      linha.position.set(0, 0.07, lado * (LZ - 0.08)); linha.castShadow = false; grupo.add(linha);
      pecas.faixas.push(linha);

      // raquete: corpo na cor do dono com faixa clara na frente
      const g = new THREE.Group();
      const corpo = malha(new THREE.BoxGeometry(MEIA * 2, 0.5, ESPESSURA * 2), cor, { roughness: 0.4, emissive: cor, emissiveIntensity: 0.25 });
      corpo.position.y = 0.3;
      const faixa = malha(new THREE.BoxGeometry(MEIA * 2 - 0.2, 0.14, 0.1), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 });
      faixa.position.set(0, 0.62, -lado * (ESPESSURA - 0.04));
      const ponta = new THREE.BoxGeometry(0.28, 0.7, ESPESSURA * 2 + 0.1);
      for (const s of [-1, 1]) { const m = malha(ponta, 0xe9edf7); m.position.set(s * MEIA, 0.35, 0); g.add(m); }
      g.add(corpo, faixa); grupo.add(g);
      pecas.raquetes.push({ g, corpo, faixa });

      // vidas: cinco lâmpadas atrás do gol
      for (let k = 0; k < VIDAS; k++) {
        const luz = malha(new THREE.SphereGeometry(0.34, 14, 10), 0x30343f, { emissive: cor, emissiveIntensity: 0 });
        luz.position.set((k - (VIDAS - 1) / 2) * 1.5, 0.45, lado * (LZ + 0.8)); grupo.add(luz); pecas.luzes[i].push(luz);
      }
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c;

    p.jogadores.forEach((j, i) => {
      c.bonecos[i].visible = false;
      const r = pecas.raquetes[i], forte = d.golpe[i] > 0, lado = i ? 1 : -1;
      r.g.position.set(j.x, 0, j.z - lado * (forte ? ALCANCE_FORTE / 2 : 0));
      r.g.scale.z = forte ? 1 + ALCANCE_FORTE / ESPESSURA / 1.2 : 1;
      r.corpo.material.emissiveIntensity = forte ? 1.6 : (d.cd[i] <= 0 ? 0.4 : 0.1);
      r.faixa.material.emissiveIntensity = forte ? 2 : 0.5;
      pecas.luzes[i].forEach((m, k) => {
        const aceso = k < d.placar[i];
        m.material.color.set(aceso ? c.cores[i] : 0x30343f);
        m.material.emissiveIntensity = aceso ? 1.1 + Math.sin(t * 6 + k) * 0.2 : 0;
      });
      pecas.brilho[i] = Math.max(0, pecas.brilho[i] - dt);
      pecas.faixas[i].material.emissiveIntensity = pecas.brilho[i] > 0 && Math.floor(t * 16) % 2 === 0 ? 3 : 1;
    });

    const ms = c.pool('bolas', d.bolas.length, () => {
      const g = new THREE.Group();
      const esfera = c.malha(new THREE.SphereGeometry(R, 18, 12), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.3 });
      const halo = c.malha(new THREE.CylinderGeometry(1, 1, 0.02, 24), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1, transparent: true, opacity: 0.3 });
      halo.position.y = -0.3; halo.castShadow = false;
      g.add(esfera, halo); g.userData = { esfera, halo };
      return g;
    });
    d.bolas.forEach((b, n) => {
      const g = ms[n], v = Math.hypot(b.vx, b.vz), cor = b.dono >= 0 ? c.cores[b.dono] : 0xffffff;
      g.position.set(b.x, 0.5, b.z);
      g.visible = b.pausa <= 0 || Math.floor(t * 12) % 2 === 0;                // pisca enquanto espera no centro
      g.userData.esfera.material.emissive.set(cor);
      g.userData.esfera.material.emissiveIntensity = 0.5 + v / V_FORTE;
      g.userData.halo.material.color.set(cor); g.userData.halo.material.emissive.set(cor);
      g.userData.halo.scale.set(R * (1.3 + v / V_FORTE), 1, R * (1.3 + v / V_FORTE));
    });

    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto], cor = c.cores[e.cor] ?? AMARELO;
      if (e.tipo === 'gol') { pecas.brilho[e.cor] = 1.2; c.particulas(e.x, 0.6, e.z, cor, 28, 10); c.particulas(e.x, 0.6, e.z, AMARELO, 12, 8); }
      else if (e.tipo === 'forte') { c.particulas(e.x, 0.6, e.z, AMARELO, 16, 9); c.particulas(e.x, 0.6, e.z, cor, 10, 7); }
      else c.particulas(e.x, 0.5, e.z, 0xffffff, 6, 5);
    }
  },
};
