// Tanques na festa (todos contra todos ou times): todos na mesma arena com blocos de cobertura. O tanque gira para onde anda,
// Atirar solta um projétil que quica 1 vez. 3 vidas cada; o próprio tiro não fere o dono e em times não há fogo amigo (o tiro passa pelo parceiro).
// Vence o último tanque (ou a dupla que ainda tem um), ou quem tiver mais vidas no fim do tempo (em times, vidas da dupla somadas).
import { posiciona, posicionaCantos, timeDe, elimina, quem, RAIO } from '../logica.mjs';

export const LX = 11, LZ = 7, VIDAS = 3, TEMPO = 45;
const R_TIRO = 0.3, V_TIRO = 13, V_TANQUE = 7, GIRO = 14, ZONA_MORTA = 0.15;
const RECARGA = 0.8, BUFFER = 0.25, T_IMUNE = 1.2, EMPURRAO = 9, T_TIRO = 6, ESCALA = 1.5;
const R_ACERTO = RAIO * 1.1 + R_TIRO;                 // acompanha o tanque 1,5x maior
const NOME_TIME = ['laranja', 'roxa'];
const BRANCO = 0xffffff;

// Blocos de cobertura (meia largura hx e meia profundidade hz). Simétricos e longe dos pontos de saída.
export const BLOCOS = [
  { x: 0, z: 0, hx: 1.1, hz: 1.1 },
  { x: -5, z: -2.8, hx: 0.9, hz: 0.9 }, { x: 5, z: -2.8, hx: 0.9, hz: 0.9 },
  { x: -5, z: 2.8, hx: 0.9, hz: 0.9 }, { x: 5, z: 2.8, hx: 0.9, hz: 0.9 },
];

const times = p => p.modo === 'times';
const dono = p => i => (times(p) ? timeDe(p, i) : i);       // de quem é a vida no placar: do jogador ou da dupla
const inimigos = (p, a, b) => a !== b && (!times(p) || timeDe(p, a) !== timeDe(p, b));
const corDe = (c, i) => (times(c.p) ? c.times[timeDe(c.p, i)] : c.cores[i]);
const limita = (v, m) => Math.max(-m, Math.min(m, v));
const volta = a => Math.atan2(Math.sin(a), Math.cos(a));

// Empurra o círculo (a) para fora de qualquer bloco. Devolve a normal do último bloco tocado (ou undefined).
function saiDosBlocos(a, raio) {
  let tocou;
  for (const b of BLOCOS) {
    const px = Math.max(b.x - b.hx, Math.min(b.x + b.hx, a.x)), pz = Math.max(b.z - b.hz, Math.min(b.z + b.hz, a.z));
    const dx = a.x - px, dz = a.z - pz, dist = Math.hypot(dx, dz);
    if (dist >= raio) continue;
    let nx, nz;
    if (dist > 1e-6) { nx = dx / dist; nz = dz / dist; a.x = px + nx * raio; a.z = pz + nz * raio; }
    else {                                       // centro dentro do bloco: sai pelo lado mais perto
      const ex = b.hx - Math.abs(a.x - b.x), ez = b.hz - Math.abs(a.z - b.z);
      if (ex < ez) { nx = Math.sign(a.x - b.x) || 1; nz = 0; a.x = b.x + nx * (b.hx + raio); }
      else { nx = 0; nz = Math.sign(a.z - b.z) || 1; a.z = b.z + nz * (b.hz + raio); }
    }
    tocou = { nx, nz };
  }
  return tocou;
}

// Um sub-passo do tiro: anda, quica (ou some) na parede e no bloco, fere o primeiro rival que tocar.
function passoTiro(p, d, t, h) {
  t.idade += h;
  if (t.idade > T_TIRO) { t.vivo = false; return; }
  t.x += t.vx * h; t.z += t.vz * h;
  const bate = (nx, nz) => {                     // choque: quica se ainda pode, senão some
    d.fx.push({ x: t.x, z: t.z, tipo: 'quique' });
    p.eventos.push('batida');
    if (t.quica > 0) {
      t.quica--;
      const v = t.vx * nx + t.vz * nz;
      if (v < 0) { t.vx -= 2 * v * nx; t.vz -= 2 * v * nz; }
    } else t.vivo = false;
  };
  if (Math.abs(t.x) > LX - R_TIRO) { t.x = Math.sign(t.x) * (LX - R_TIRO); bate(-Math.sign(t.x), 0); }
  if (t.vivo && Math.abs(t.z) > LZ - R_TIRO) { t.z = Math.sign(t.z) * (LZ - R_TIRO); bate(0, -Math.sign(t.z)); }
  if (!t.vivo) return;
  const n = saiDosBlocos(t, R_TIRO);
  if (n) { bate(n.nx, n.nz); if (!t.vivo) return; }

  const i = p.jogadores.findIndex((j, k) => j.vivo && inimigos(p, t.dono, k) && d.imune[k] <= 0 && Math.hypot(j.x - t.x, j.z - t.z) <= R_ACERTO);
  if (i < 0) return;
  const j = p.jogadores[i], len = Math.hypot(t.vx, t.vz) || 1;
  t.vivo = false;
  d.vidas[i]--;
  d.imune[i] = T_IMUNE;
  d.kb[i] = { x: t.vx / len * EMPURRAO, z: t.vz / len * EMPURRAO };
  d.fx.push({ x: j.x, z: j.z, i, tipo: 'acerto' });
  p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
  if (d.vidas[i] <= 0) { elimina(p, j, 8); p.eventos.push('explosao'); d.aviso = `${quem(p, i)} saiu!`; d.avisoCor = '#ff4a4a'; d.avisoT = 1.5; }
  else p.eventos.push('batida');
}

function somaVidas(p) {
  const de = dono(p), totais = Array(times(p) ? 2 : p.jogadores.length).fill(0);
  p.dados.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

// Último dono (jogador ou dupla) com vida; no tempo, o de mais vidas (igual dá empate).
function resultado(p) {
  const pl = p.dados.placar, restam = pl.flatMap((v, k) => (v > 0 ? [k] : []));
  if (restam.length <= 1) return restam.length ? restam[0] : -1;
  if (p.t >= TEMPO) {
    const maior = Math.max(...pl), lideres = pl.flatMap((v, k) => (v === maior ? [k] : []));
    return lideres.length === 1 ? lideres[0] : -1;
  }
}

// Textos do celular e da tela. Com resultado, deixa o estado final pronto antes de devolvê-lo.
function textos(p, r) {
  const d = p.dados, de = dono(p);
  if (r !== undefined) { d.aviso = r < 0 ? 'Empate!' : times(p) ? `A dupla ${NOME_TIME[r]} venceu!` : `${quem(p, r)} venceu!`; d.avisoCor = '#ffd23f'; }
  p.jogadores.forEach((_, i) => {
    let t;
    if (r !== undefined) t = r < 0 ? 'Empate!' : de(i) === r ? 'Você venceu!' : 'Você perdeu. Boa tentativa!';
    else if (d.vidas[i] <= 0) t = times(p) ? 'Você saiu. Torça pela dupla!' : 'Você saiu. Torça!';
    else t = `Vidas: ${d.vidas[i]}.${times(p) ? ` Dupla: ${d.placar[de(i)]}.` : ''} Ande e atire!`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

export default {
  id: 'tanques-festa', genero: 'mira', nome: 'Tanques em guerra', dica: 'Ande com o tanque e atire nos rivais: o tiro quica uma vez e cada um tem 3 vidas.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  // semMovimento: o tanque anda pela regra daqui (velocidade fixa, gira para onde anda), então gelo, foguete, espelho, lua e as cartas de andar não são sorteados.
  controle: { modo: 'padrao', a: 'Atirar', b: '' }, semMovimento: true, semDash: true, semPulo: true, rotulo: 'vidas', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    if (n === 2) posiciona(p, 8.5);
    else { posicionaCantos(p, 8.5, 5); if (n === 3) { p.jogadores[2].x = 0; p.jogadores[2].z = 5.3; } }       // em times, dupla A à esquerda e dupla B à direita
    p.dados = {
      vidas: Array(n).fill(VIDAS), ang: p.jogadores.map(j => Math.atan2(-j.z, -j.x)),      // todos começam com o cano para o centro
      cd: Array(n).fill(0), quer: Array(n).fill(0), imune: Array(n).fill(0), kb: p.jogadores.map(() => ({ x: 0, z: 0 })),
      tiros: [], fx: [], placar: [], inventario: [], aviso: '', avisoCor: '#ffd23f', avisoT: 0,
    };
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }

    p.jogadores.forEach((j, i) => {
      if (!j.vivo) return;
      j.vx = 0; j.vz = 0;
      d.cd[i] -= dt; d.quer[i] -= dt; d.imune[i] -= dt;
      const { x, y } = j.ent, mag = Math.hypot(x, y);
      let vx = 0, vz = 0;
      if (mag > ZONA_MORTA) {
        vx = x * V_TANQUE; vz = y * V_TANQUE;
        d.ang[i] = volta(d.ang[i] + limita(volta(Math.atan2(y, x) - d.ang[i]), GIRO * dt));
      }
      const kb = d.kb[i], fator = Math.pow(0.02, dt);
      j.x += (vx + kb.x) * dt; j.z += (vz + kb.z) * dt;
      kb.x *= fator; kb.z *= fator;
      saiDosBlocos(j, RAIO);
      j.x = limita(j.x, LX - RAIO); j.z = limita(j.z, LZ - RAIO);

      if (j.apertouA > 0) d.quer[i] = BUFFER;    // toque guardado por um instante, se ainda estiver recarregando
      if (d.quer[i] > 0 && d.cd[i] <= 0) {
        d.quer[i] = 0; d.cd[i] = RECARGA;
        const dx = Math.cos(d.ang[i]), dz = Math.sin(d.ang[i]);
        const t = { x: j.x + dx * 1.1 * ESCALA, z: j.z + dz * 1.1 * ESCALA, vx: dx * V_TIRO, vz: dz * V_TIRO, dono: i, quica: 1, idade: 0, vivo: true };
        t.x = limita(t.x, LX - R_TIRO); t.z = limita(t.z, LZ - R_TIRO);
        d.tiros.push(t);
        d.fx.push({ x: t.x, z: t.z, tipo: 'tiro' });
        p.eventos.push('dash');
      }
    });

    const n = Math.max(1, Math.ceil(dt * 60 - 1e-6)), h = dt / n;   // passos curtos: o tiro nunca atravessa nada
    for (let s = 0; s < n; s++) for (const t of d.tiros) if (t.vivo) passoTiro(p, d, t, h);
    d.tiros = d.tiros.filter(t => t.vivo);

    d.placar = somaVidas(p);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    const r = resultado(p);
    textos(p, r);
    return r;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    pecas.visto = 0;

    // blocos de cobertura: sacos de areia baixos (não escondem os tanques) com tampo claro
    for (const b of BLOCOS) {
      const corpo = malha(new THREE.BoxGeometry(b.hx * 2, 0.6, b.hz * 2), 0x56607f, { roughness: 0.6 });
      corpo.position.set(b.x, 0.3, b.z); grupo.add(corpo);
      const topo = malha(new THREE.BoxGeometry(b.hx * 2 + 0.1, 0.12, b.hz * 2 + 0.1), 0xcfd6e6, { emissive: 0xcfd6e6, emissiveIntensity: 0.25 });
      topo.position.set(b.x, 0.62, b.z); topo.castShadow = false; grupo.add(topo);
    }

    // um tanque low-poly por jogador, na cor dele (ou da dupla), com as vidas em bolinhas por cima
    pecas.tanques = c.bonecos.map((_, i) => {
      const cor = corDe(c, i), g = new THREE.Group(), escuro = 0x1d2233;
      const casco = malha(new THREE.BoxGeometry(1.5, 0.5, 1.1), cor, { roughness: 0.5 }); casco.position.y = 0.45;
      const frente = malha(new THREE.BoxGeometry(0.5, 0.36, 0.9), cor, { roughness: 0.5 }); frente.position.set(0.55, 0.5, 0);
      const esteiraA = malha(new THREE.BoxGeometry(1.7, 0.4, 0.28), escuro), esteiraB = malha(new THREE.BoxGeometry(1.7, 0.4, 0.28), escuro);
      esteiraA.position.set(0, 0.28, 0.62); esteiraB.position.set(0, 0.28, -0.62);
      const torre = malha(new THREE.CylinderGeometry(0.4, 0.46, 0.34, 8), cor, { roughness: 0.4 }); torre.position.y = 0.88;
      const cano = malha(new THREE.BoxGeometry(1.0, 0.17, 0.17), 0xe9edf7, { emissive: cor, emissiveIntensity: 0.2 });
      cano.position.set(0.8, 0.9, 0);
      g.add(casco, frente, esteiraA, esteiraB, torre, cano);
      g.scale.setScalar(ESCALA);                       // tanque 1,5x maior na TV (a física segue igual)
      grupo.add(g);
      const vidas = new THREE.Group();
      const pips = Array.from({ length: VIDAS }, (_, k) => {
        const q = malha(new THREE.SphereGeometry(0.3, 14, 10), cor, { emissive: cor, emissiveIntensity: 0.8 });
        q.castShadow = false; q.position.x = (k - 1) * 0.8; vidas.add(q); return q;
      });
      grupo.add(vidas);
      return { g, cano, vidas, pips };
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas, THREE } = c;

    p.jogadores.forEach((j, i) => {
      c.bonecos[i].visible = false;
      const { g, cano, vidas, pips } = pecas.tanques[i];
      g.position.set(j.x, j.y, j.z);
      g.rotation.y = -d.ang[i];
      if (!j.vivo) { g.rotation.x += dt * 6; g.rotation.z += dt * 4; }
      g.visible = j.y > -12 && (!j.vivo || p.fase !== 'jogando' || !(d.imune[i] > 0 && Math.floor(t * 14) % 2 === 0));    // pisca depois de levar tiro (no resultado fica aceso)
      cano.material.emissiveIntensity = d.cd[i] <= 0 ? 0.35 : 0;       // cano aceso: pronto para atirar
      vidas.visible = j.vivo && d.vidas[i] > 0;
      vidas.position.set(j.x, 3.2 + Math.sin(t * 4 + i) * 0.08, j.z);      // logo acima do tanque (o nome some junto com o boneco)
      pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });

    // tiros com rastro na cor de quem atirou (sem estado: pontinhos que encolhem para trás da velocidade)
    const ts = d.tiros, NR = 5;
    const ms = c.pool('tiros', ts.length, () => {
      const m = c.malha(new THREE.SphereGeometry(R_TIRO, 12, 8), BRANCO, { emissive: BRANCO, emissiveIntensity: 1 });
      m.castShadow = false; return m;
    });
    const rs = c.pool('rastro', ts.length * NR, () => {
      const m = c.malha(new THREE.SphereGeometry(R_TIRO, 8, 6), BRANCO, { emissive: BRANCO, emissiveIntensity: 1, transparent: true, opacity: 0.5 });
      m.castShadow = false; return m;
    });
    ts.forEach((s, k) => {
      const cor = corDe(c, s.dono);
      ms[k].position.set(s.x, 1.1, s.z);
      ms[k].material.emissive.set(cor);
      const len = Math.hypot(s.vx, s.vz) || 1;
      for (let r = 0; r < NR; r++) {
        const m = rs[k * NR + r], f = 1 - (r + 1) / (NR + 1);
        m.position.set(s.x - s.vx / len * (r + 1) * 0.4, 1.1, s.z - s.vz / len * (r + 1) * 0.4);
        m.scale.setScalar(f); m.material.color.set(cor); m.material.emissive.set(cor); m.material.opacity = 0.55 * f;
      }
    });

    // faíscas e som: tiro saindo, quique e acerto
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'acerto') { c.particulas(e.x, 0.8, e.z, corDe(c, e.i), 26, 10); c.particulas(e.x, 0.8, e.z, BRANCO, 12, 8); c.som(110, 0.3, 'sawtooth', 0.14); }
      else if (e.tipo === 'quique') c.particulas(e.x, 0.7, e.z, BRANCO, 8, 5);
      else { c.particulas(e.x, 0.9, e.z, BRANCO, 4, 3); c.som(320, 0.07, 'square', 0.06); }
    }
  },
};
