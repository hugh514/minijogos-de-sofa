// Chute simultaneo: os dois miram com estilingue e sao lancados juntos. 3 gols vencem; no fim do tempo, quem fez mais.
import { posiciona, colide, elimina, maiorPlacar, RAIO } from '../logica.mjs';

const LX = 11, LZ = 6.5, GOL = 3.6, R_BOLA = 0.6, M_BOLA = 0.3;
const T_MIRA = 4, T_ROLA = 4, LIMITE = 55, TETO = 60, GOLS = 3, V_MAX = 20, V_BOLA_MAX = 26;
const FREIO = 2, BOLA_K = 1.1, PARADO = 0.3;
const ARRASTO_CHEIO = 0.9, ARRASTO_MIN = 0.08, SETA = 5;

// Estilingue: devolve { dx, dz, f } (direcao oposta ao arrasto, forca de 0 a 1) no quadro em que o dedo solta.
function estilingue(m, ent) {
  let tiro = null;
  if (ent.d && !m.d) { m.x0 = ent.x; m.y0 = ent.y; }
  if (ent.d) { m.ax = ent.x - m.x0; m.ay = ent.y - m.y0; }
  else if (m.d) { tiro = pontaria(m); m.ax = m.ay = 0; }
  m.d = ent.d;
  return tiro;
}
function pontaria(m) {
  const len = Math.hypot(m.ax, m.ay);
  if (!(len > ARRASTO_MIN)) return null;
  return { dx: -m.ax / len, dz: -m.ay / len, f: Math.max(0.2, Math.min(1, len / ARRASTO_CHEIO)) };
}

function texto(p, i, t) {
  t = `Gols ${p.dados.placar[0]} x ${p.dados.placar[1]}. ${t}`;
  if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
}

// Freio constante somado ao atrito: faz as coisas pararem de vez em vez de deslizar para sempre.
function freia(o, dt, k = 0) {
  const v = Math.hypot(o.vx, o.vz);
  if (v === 0) return;
  const nv = Math.max(0, Math.min(v, V_BOLA_MAX) * Math.exp(-k * dt) - FREIO * dt);
  o.vx *= nv / v; o.vz *= nv / v;
}

function novaMira(p, vibra) {
  const d = p.dados;
  d.fase = 'mira'; d.tempo = T_MIRA; d.tiros = [null, null];
  d.miras = [0, 1].map(() => ({ d: false, x0: 0, y0: 0, ax: 0, ay: 0 }));
  for (const i of [0, 1])
    p.celular[i] = { ...p.celular[i], texto: 'Mire: arraste para trás e solte', vibra: (p.celular[i].vibra ?? 0) + (vibra ? 1 : 0) };
}

// A mira que vale para o jogador i agora: o arrasto em andamento ou a ultima que ele soltou.
function miraDe(d, i) { return (d.miras[i].d ? pontaria(d.miras[i]) : null) ?? d.tiros[i]; }

export default {
  id: 'gol-cego', genero: 'gol', nome: 'Chute simultâneo', dica: 'Arraste para trás e solte para lançar o seu boneco na bola. Os dois saem juntos. 3 gols vencem. Empate no fim: vale o próximo gol!',
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'gols', duracao: LIMITE,
  controle: { modo: 'toque' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true, gol: GOL };
    posiciona(p, 6);
    p.dados = { bola: { x: 0, z: 0, vx: 0, vz: 0 }, fx: [], aviso: '', avisoCor: '#ffffff', lances: 0, placar: [0, 0] };
    novaMira(p, false);
  },

  atualiza(p, dt) {
    const d = p.dados, b = d.bola;

    if (d.fase === 'mira') {
      d.tempo -= dt;
      p.jogadores.forEach((j, i) => {
        j.vx = j.vz = 0;
        const tiro = estilingue(d.miras[i], j.ent);
        if (tiro) { d.tiros[i] = tiro; p.eventos.push('troca'); }
        texto(p, i, d.tiros[i] && !d.miras[i].d ? 'Mira travada! Arraste de novo para mudar' : 'Mire: arraste para trás e solte');
      });
      const prontos = [0, 1].every(i => d.tiros[i] && !d.miras[i].d);
      if (d.tempo <= 0 || prontos) {
        p.jogadores.forEach((j, i) => {
          const tiro = miraDe(d, i);
          if (tiro) { j.vx = tiro.dx * tiro.f * V_MAX; j.vz = tiro.dz * tiro.f * V_MAX; }
          texto(p, i, 'Valendo! Olhe para a tela');
        });
        d.fase = 'rola'; d.tempo = 0; d.aviso = ''; d.lances++;
        p.eventos.push('dash');
      } else d.aviso = String(Math.ceil(d.tempo));
    } else {
      d.tempo += dt;
      for (const j of p.jogadores) {
        freia(j, dt);
        const antes = Math.hypot(j.vx - b.vx, j.vz - b.vz);
        if (colide(j, b, RAIO, R_BOLA, 1, M_BOLA) && antes > 0.5) {
          p.eventos.push('batida');
          d.fx.push({ x: b.x, y: 0.6, z: b.z, cor: -1, q: 10, forca: Math.min(7, 2 + antes * 0.25) });
        }
      }
      freia(b, dt, BOLA_K);
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.abs(b.z) > LZ - R_BOLA) { b.z = Math.sign(b.z) * (LZ - R_BOLA); b.vz *= -0.8; }
      if (Math.abs(b.x) > LX - R_BOLA) {
        if (Math.abs(b.z) < GOL) {
          if (Math.abs(b.x) > LX - 0.2) {                    // gol: quem defende esse lado perde
            const perdedor = b.x > 0 ? 1 : 0;
            p.eventos.push('gol');
            d.fx.push({ x: b.x, y: 1, z: b.z, cor: 1 - perdedor, q: 40, forca: 9 });
            if (++d.placar[1 - perdedor] >= GOLS || p.t > LIMITE) { elimina(p, p.jogadores[perdedor], 12); return 1 - perdedor; }
            Object.assign(b, { x: 0, z: 0, vx: 0, vz: 0 });          // bola ao meio, cada um volta ao seu lado, nova mira
            posiciona(p, 6);
            for (const j of p.jogadores) j.vx = j.vz = 0;
            novaMira(p, true);
            return;
          }
        } else { b.x = Math.sign(b.x) * (LX - R_BOLA); b.vx *= -0.8; }
      }
      const parado = Math.hypot(b.vx, b.vz) < PARADO && p.jogadores.every(j => Math.hypot(j.vx, j.vz) < PARADO);
      if (parado || d.tempo > T_ROLA) {
        b.vx = b.vz = 0;
        for (const j of p.jogadores) j.vx = j.vz = 0;
        novaMira(p, true);
      }
    }
    if (p.t > LIMITE && d.placar[0] === d.placar[1]) {            // empatado no fim do tempo: o proximo gol decide
      if (p.t > TETO) return -1;
    } else if (p.t > LIMITE) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const linha = malha(new THREE.BoxGeometry(0.15, 0.02, LZ * 2), 0xffffff); linha.position.y = 0.01; grupo.add(linha);
    const roda = malha(new THREE.RingGeometry(2.2, 2.35, 48), 0xffffff, { side: THREE.DoubleSide });
    roda.rotation.x = -Math.PI / 2; roda.position.y = 0.02; grupo.add(roda);
    for (const s of [-1, 1]) {                               // o gol da direita e do jogador 2, o da esquerda do jogador 1
      const gol = malha(new THREE.BoxGeometry(1.2, 1.6, GOL * 2), cores[s > 0 ? 1 : 0], { transparent: true, opacity: 0.55 });
      gol.position.set(s * (LX + 0.6), 0.8, 0); grupo.add(gol);
    }
    pecas.bola = malha(new THREE.SphereGeometry(R_BOLA, 24, 16), 0xffffff, { roughness: 0.3 }); grupo.add(pecas.bola);

    pecas.discos = [0, 1].map(i => {
      const m = malha(new THREE.CylinderGeometry(RAIO + 0.2, RAIO + 0.2, 0.14, 28), cores[i], { emissive: cores[i], emissiveIntensity: 0.3 });
      grupo.add(m); return m;
    });
    pecas.setas = [0, 1].map(i => {
      const seta = new THREE.Group(), brilho = { emissive: cores[i], emissiveIntensity: 0.8 };
      const haste = malha(new THREE.BoxGeometry(1, 0.12, 0.3), cores[i], brilho);
      const ponta = malha(new THREE.ConeGeometry(0.48, 0.95, 12), cores[i], brilho); ponta.rotation.z = -Math.PI / 2;
      seta.add(haste, ponta); grupo.add(seta);
      return { seta, haste, ponta };
    });
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const { pecas, cores } = c, p = c.p, d = p.dados, b = d.bola;
    pecas.bola.position.set(b.x, R_BOLA, b.z);
    pecas.bola.rotation.z -= b.vx * dt / R_BOLA; pecas.bola.rotation.x += b.vz * dt / R_BOLA;

    p.jogadores.forEach((j, i) => {
      const disco = pecas.discos[i], { seta, haste, ponta } = pecas.setas[i];
      disco.visible = j.vivo; disco.position.set(j.x, 0.07, j.z);
      const tiro = d.fase === 'mira' ? miraDe(d, i) : null;
      seta.visible = !!tiro;
      if (!tiro) return;
      const travada = !d.miras[i].d, comp = 0.8 + tiro.f * SETA;
      seta.position.set(j.x, 0.35, j.z);
      seta.rotation.y = Math.atan2(-tiro.dz, tiro.dx);
      haste.scale.x = comp; haste.position.x = RAIO + 0.2 + comp / 2; ponta.position.x = RAIO + 0.2 + comp + 0.45;
      const brilho = travada ? 0.8 : 0.5 + 0.4 * Math.sin(t * 12);   // pisca enquanto arrasta, fixa quando trava
      const cor = travada ? 0xffffff : cores[i];
      for (const m of [haste, ponta]) { m.material.color.set(cor); m.material.emissiveIntensity = brilho; }
    });

    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, f.y, f.z, f.cor < 0 ? 0xffffff : cores[f.cor], f.q, f.forca);
    }
  },
};
