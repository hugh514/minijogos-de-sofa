// Danca das cadeiras: as cadeiras giram com a musica; quando ela para, so uma e de verdade. Quem sentar nela primeiro marca.
// Empurra (o empurrao padrao) afasta o rival do caminho. A cada rodada ha mais cadeiras falsas.
import { quem } from '../logica.mjs';

const R_CADEIRA = 5.8, RAIO_ARENA = 9, ALCANCE = 1.5;
const META = 4, LIMITE = 45, T_FORCA = 58;
const T_MUSICA = 2.8, T_MUSICA_VAR = 3, T_FREIA = 1.0, VEL = 1.1;
const T_REVELA = 0.5, T_CORRE_MAX = 3.5, T_SENTADO = 1.7, T_BATIDA = 0.25;
const NOTAS = [262, 330, 392, 523, 392, 330, 294, 392];

export default {
  id: 'cadeiras', genero: 'ritmo', nome: 'Dança das cadeiras', dica: 'Corra para a cadeira certa quando a música parar. Empurra afasta o rival!',
  controle: { modo: 'padrao', a: 'Empurra', b: '' }, semPulo: true, rotulo: 'cadeiras', duracao: LIMITE, tema: 1,

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: RAIO_ARENA, parede: true };
    p.jogadores[0].x = -2.4; p.jogadores[1].x = 2.4;
    p.jogadores.forEach(j => { j.z = 0; });
    p.dados = {
      placar: [0, 0], fase: 'musica', rodada: 0, tFase: 0, dur: 0, rot: 0, vel: 0, batidaT: 0, batida: 0,
      cadeiras: [], real: 0, venceu: -1, fx: [], aviso: '', avisoT: 0, textos: ['', ''], morte: false,
    };
    novaRodada(p, p.dados);
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.tFase += dt;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    if (d.fase === 'musica') musica(p, d, dt);
    else if (d.fase === 'corre') corre(p, d);
    else sentado(p, d);

    const [a, b] = d.placar;
    if (d.fase === 'sentado' && d.tFase >= T_SENTADO) {          // fim da rodada: decide ou segue
      if (a >= META || b >= META || (p.t >= LIMITE && a !== b)) return fim(p, d, a > b ? 0 : 1);
      if (p.t >= LIMITE && !d.morte) { d.morte = true; d.aviso = 'Rodada decisiva!'; d.avisoCor = '#ffd23f'; d.avisoT = 1.6; }
      novaRodada(p, d);
    }
    if (p.t >= T_FORCA) return fim(p, d, a === b ? -1 : a > b ? 0 : 1);
    atualizaCelulares(p, d);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    pecas.visto = 0; pecas.vistaBatida = 0; pecas.esc = [];

    const palco = malha(new THREE.CylinderGeometry(RAIO_ARENA, RAIO_ARENA, 0.05, 56), 0x4a2f6b, { roughness: 0.4, emissive: 0x1d0f33, emissiveIntensity: 0.5 });
    palco.position.y = 0.025; palco.castShadow = false; grupo.add(palco);
    const borda = malha(new THREE.TorusGeometry(RAIO_ARENA - 0.25, 0.12, 6, 64), 0xffd23f, { emissive: 0xffd23f, emissiveIntensity: 0.7 });
    borda.rotation.x = Math.PI / 2; borda.position.y = 0.08; borda.castShadow = false; grupo.add(borda);

    // toca-discos no meio: disco girando e notas coloridas em volta
    const disco = malha(new THREE.CylinderGeometry(1.5, 1.5, 0.1, 32), 0x14101f, { roughness: 0.3 });
    disco.position.y = 0.1; disco.castShadow = false; grupo.add(disco);
    const rotulo = malha(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 20), 0xff4a6a, { emissive: 0xff4a6a, emissiveIntensity: 0.6 });
    rotulo.position.y = 0.12; rotulo.castShadow = false; grupo.add(rotulo);
    const braco = malha(new THREE.BoxGeometry(1.5, 0.08, 0.14), 0xe9edf7);
    braco.position.set(0, 0.2, 0); braco.castShadow = false; grupo.add(braco);
    pecas.disco = disco; pecas.rotulo = rotulo; pecas.braco = braco;
    const cores = [0xff4a6a, 0xffd23f, 0x3fe8ff, 0x7dff6a, 0xb56bff, 0xff8a2f];
    pecas.notas = cores.map((cor, k) => {
      const n = malha(new THREE.SphereGeometry(0.34, 12, 8), cor, { emissive: cor, emissiveIntensity: 0.8 });
      n.castShadow = false; n.userData.k = k; grupo.add(n); return n;
    });

    // seis cadeiras: assento, encosto e quatro pernas, de costas para o meio
    pecas.cadeiras = [];
    for (let k = 0; k < 6; k++) {
      const g = new THREE.Group();
      const madeira = 0xb5733a, assento = 0xe8c07a;
      const seat = malha(new THREE.BoxGeometry(1.6, 0.26, 1.6), assento, { roughness: 0.6 }); seat.position.y = 0.95;
      const encosto = malha(new THREE.BoxGeometry(1.6, 1.3, 0.22), madeira, { roughness: 0.6 }); encosto.position.set(0, 1.65, 0.69);
      g.add(seat, encosto);
      for (const sx of [-0.65, 0.65]) for (const sz of [-0.65, 0.65]) {
        const perna = malha(new THREE.BoxGeometry(0.2, 0.95, 0.2), madeira); perna.position.set(sx, 0.47, sz); g.add(perna);
      }
      // seta dourada sobre a cadeira de verdade e anel no chao
      const seta = malha(new THREE.ConeGeometry(0.85, 1.7, 4), 0xffffff, { emissive: 0xffe27a, emissiveIntensity: 1 });
      seta.rotation.x = Math.PI; seta.position.y = 3.4; seta.castShadow = false; seta.visible = false;
      const anel = malha(new THREE.TorusGeometry(1.5, 0.17, 8, 32), 0xffffff, { emissive: 0xffe27a, emissiveIntensity: 1 });
      anel.rotation.x = Math.PI / 2; anel.position.y = 0.12; anel.castShadow = false; anel.visible = false;
      g.add(seta, anel);
      g.userData = { seat, seta, anel, madeira, assento };
      grupo.add(g); pecas.cadeiras.push(g); pecas.esc.push(0);
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas } = c;
    const tocando = d.fase === 'musica';

    // toca-discos e notas
    pecas.disco.rotation.y += d.vel * dt * 2;
    pecas.braco.rotation.y = d.rot * 2;
    pecas.rotulo.material.emissiveIntensity = tocando ? 0.5 + 0.4 * Math.sin(t * 12) : 0.1;
    pecas.notas.forEach((n, k) => {
      const a = d.rot * 1.5 + k * Math.PI / 3, vivo = d.vel > 0.05;
      n.position.set(Math.cos(a) * 3.2, 0.7 + (vivo ? Math.abs(Math.sin(t * 6 + k)) * 0.6 : 0), Math.sin(a) * 3.2);
      n.scale.setScalar(vivo ? 1 + 0.25 * Math.sin(t * 12 + k) : 0.8);
      n.material.emissiveIntensity = vivo ? 0.9 : 0.15;
    });

    // cadeiras
    pecas.cadeiras.forEach((g, k) => {
      const ch = d.cadeiras[k], u = g.userData;
      if (!ch) { g.visible = false; return; }
      const alvo = ch.sumida ? 0 : 1;
      pecas.esc[k] += (alvo - pecas.esc[k]) * Math.min(1, dt * 9);
      g.visible = pecas.esc[k] > 0.03;
      g.position.set(ch.x, 0, ch.z);
      g.rotation.y = Math.PI / 2 - ch.a;
      g.scale.setScalar(Math.max(0.01, pecas.esc[k]));
      const real = k === d.real && d.fase !== 'musica';
      u.seta.visible = u.anel.visible = real;
      if (real) { u.seta.position.y = 3.4 + Math.sin(t * 8) * 0.3; u.seta.rotation.y = t * 3; }
      const dono = k === d.real && d.fase === 'sentado' ? d.venceu : -1;
      u.seat.material.color.set(dono >= 0 ? c.cores[dono] : u.assento);
      u.seat.material.emissive.set(real ? 0xa87a10 : 0x000000);
    });

    // musica: uma nota por batida, mais lenta quando freia
    for (; pecas.vistaBatida < d.batida; pecas.vistaBatida++) c.som(NOTAS[pecas.vistaBatida % NOTAS.length], 0.14, 'triangle', 0.07);

    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'some') { c.particulas(e.x, 1, e.z, 0xc9a06a, 14, 6); c.som(150, 0.18, 'sawtooth', 0.07); }
      else if (e.tipo === 'para') c.som(110, 0.4, 'square', 0.12);
      else if (e.tipo === 'senta') { c.particulas(e.x, 1.4, e.z, c.cores[e.dono], 30, 10); c.particulas(e.x, 1.4, e.z, 0xffe27a, 16, 8); c.som(660, 0.25, 'square', 0.1); }
    }
  },
};

function novaRodada(p, d) {
  const n = Math.min(6, 3 + d.rodada);
  const a0 = p.rng() * Math.PI * 2;
  d.cadeiras = Array.from({ length: n }, (_, k) => ({ base: a0 + k * Math.PI * 2 / n, a: 0, x: 0, z: 0, sumida: false }));
  d.real = Math.floor(p.rng() * n);
  d.rot = 0; d.fase = 'musica'; d.tFase = 0; d.venceu = -1;
  d.dur = T_MUSICA + p.rng() * T_MUSICA_VAR;
  d.dir = d.rodada % 2 ? -1 : 1;
  d.vel = VEL; d.rodada++;
  posicionaCadeiras(d);
}

function posicionaCadeiras(d) {
  for (const ch of d.cadeiras) {
    ch.a = ch.base + d.rot;
    ch.x = Math.cos(ch.a) * R_CADEIRA; ch.z = Math.sin(ch.a) * R_CADEIRA;
  }
}

function musica(p, d, dt) {
  const resta = d.dur - d.tFase;
  d.vel = resta <= 0 ? 0 : VEL * Math.min(1, resta / T_FREIA);        // freia no ultimo segundo: a pista de que vai parar
  d.rot += d.dir * d.vel * dt;
  posicionaCadeiras(d);
  d.batidaT += dt * d.vel / VEL;
  if (d.batidaT >= T_BATIDA) { d.batidaT -= T_BATIDA; d.batida++; }
  if (resta > 0) return;
  d.fase = 'corre'; d.tFase = 0; d.vel = 0;
  d.aviso = 'Parou!'; d.avisoCor = '#ffd23f'; d.avisoT = 0.9;
  d.fx.push({ tipo: 'para', x: 0, z: 0 });
  p.eventos.push('troca');
}

function corre(p, d) {
  if (d.tFase >= T_REVELA) {
    d.cadeiras.forEach((ch, k) => {
      if (k !== d.real && !ch.sumida) { ch.sumida = true; d.fx.push({ tipo: 'some', x: ch.x, z: ch.z }); p.eventos.push('queda'); }
    });
  }
  const ch = d.cadeiras[d.real];
  const dist = p.jogadores.map(j => Math.hypot(j.x - ch.x, j.z - ch.z));
  const tocou = dist.map(v => v < ALCANCE);
  let quem1 = -1;
  if (tocou[0] || tocou[1]) quem1 = tocou[0] && tocou[1] ? (dist[0] <= dist[1] ? 0 : 1) : tocou[0] ? 0 : 1;
  else if (d.tFase >= T_CORRE_MAX) quem1 = dist[0] <= dist[1] ? 0 : 1;      // ninguem chegou: vale o mais perto
  if (quem1 < 0) return;
  d.venceu = quem1; d.placar[quem1]++; d.fase = 'sentado'; d.tFase = 0;
  d.aviso = `${quem(p, quem1)} sentou!`; d.avisoCor = '#ffffff'; d.avisoT = 1.4;
  d.fx.push({ tipo: 'senta', x: ch.x, z: ch.z, dono: quem1 });
  p.eventos.push('ponto');
  const perdeu = 1 - quem1;
  p.celular[perdeu] = { ...p.celular[perdeu], vibra: (p.celular[perdeu].vibra ?? 0) + 1 };
}

function sentado(p, d) {
  const ch = d.cadeiras[d.real], j = p.jogadores[d.venceu];
  j.x = ch.x; j.z = ch.z; j.vx = j.vz = 0; j.vy = 0; j.y = 0.6;       // fica sentado na cadeira
}

function atualizaCelulares(p, d) {
  const dica = d.fase === 'musica' ? 'Música tocando: fique perto do meio.' : d.fase === 'corre' ? 'Corra para a cadeira com a seta!' : 'Prepare-se.';
  p.jogadores.forEach((_, i) => {
    const texto = `Você ${d.placar[i]} x ${d.placar[1 - i]}. ${dica}`;
    if (d.textos[i] !== texto) { d.textos[i] = texto; p.celular[i] = { ...p.celular[i], texto }; }
  });
}

function fim(p, d, vencedor) {
  d.aviso = vencedor === -1 ? 'Empate!' : `${quem(p, vencedor)} venceu!`; d.avisoCor = '#ffffff'; d.avisoT = 0;
  p.jogadores.forEach((_, i) => {
    p.celular[i] = { ...p.celular[i], texto: `Fim: você ${d.placar[i]} x ${d.placar[1 - i]}.` };
  });
  return vencedor;
}
