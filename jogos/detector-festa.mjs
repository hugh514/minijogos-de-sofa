// Caca aos tesouros (Festa: todos contra todos ou times). Ha 2 ou 3 tesouros invisiveis enterrados na ilha. O celular de cada um
// vibra mais rapido quanto mais perto ELE esta do tesouro mais proximo, o anel no chao e a antena piscam no mesmo ritmo (da para
// espionar os outros) e o celular escreve Quente, Morno ou Frio. Cavar (A) em cima vale 1 tesouro e surge outro em outro lugar;
// buraco vazio deixa o jogador parado um instante. Aos 40 s vence quem (ou o time que) achou mais; igual da empate.
import { posicionaRoda, posicionaCantos, timeDe, pontoNoCirculo, quem, RAIO } from '../logica.mjs';

export const TEMPO = 40, T_CAVA = 0.7, T_ERRO = 1.2, ACHOU = 1.3;
const LONGE = 3.5, MAX_BURACOS = 40;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

export const raioDe = n => 8 + n * 0.5;                               // 9 com 2, 9,5 com 3 e 10 com 4
export const qtdTesouros = n => (n >= 4 ? 3 : 2);                     // enterrados ao mesmo tempo
// segundos entre duas vibracoes: em cima do tesouro, 7 por segundo; do outro lado da ilha, 1 a cada 2 s
export const intervalo = dist => Math.min(2, 0.14 + dist * 0.17);
// 0 (longe) a 1 (em cima do tesouro): alimenta o brilho na TV e o Quente, Morno ou Frio do celular
export const calor = dist => Math.max(0, Math.min(1, 1 - dist / 10));
// raio do buraco que acha o tesouro: cresce se ninguem acerta ha 12 s, para a rodada nao morrer em 0 x 0
const achou = d => ACHOU + Math.max(0, Math.min(1.7, (d.sem - 12) * 0.1));
const faixa = k => (k > 0.7 ? 'Quente! Cave aqui' : k > 0.4 ? 'Morno, chegue mais perto' : 'Frio, procure em outro lugar');

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o tesouro: do jogador ou do time
const corDe = (c, i) => (c.p.modo === 'times' ? c.times[timeDe(c.p, i)] : c.cores[i]);
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };
// O tesouro mais perto do ponto: { k, dist }.
function maisPerto(d, x, z) {
  let k = -1, dist = Infinity;
  d.tesouros.forEach((t, q) => { const r = Math.hypot(t.x - x, t.z - z); if (r < dist) { dist = r; k = q; } });
  return { k, dist };
}

// Tesouro novo: longe dos jogadores, dos outros tesouros e de onde estava o que acabou de sair (tenta algumas vezes).
function sorteia(p, antes) {
  let t = { x: 0, z: 0 };
  for (let k = 0; k < 30; k++) {
    t = pontoNoCirculo(p, p.arena.raio - 2);
    const perto = [...p.jogadores, ...p.dados.tesouros, ...(antes ? [antes] : [])].some(o => Math.hypot(o.x - t.x, o.z - t.z) < LONGE);
    if (!perto) break;
  }
  return t;
}

function celulares(p, fim) {
  const d = p.dados, de = dono(p);
  p.jogadores.forEach((_, i) => {
    const t = fim ? fim[i] : `${p.modo === 'times' ? 'Tesouros do time' : 'Tesouros'}: ${d.placar[de(i)]}. ${d.tonto[i] > 0 ? 'Buraco vazio! Espere' : faixa(d.calor[i])}`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!';
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

export default {
  id: 'detector-festa', genero: 'ritmo', nome: 'Caça aos tesouros',
  dica: 'Quanto mais perto de um tesouro, mais o anel pisca e o celular vibra: aperte Cavar em cima dele!',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Cavar', b: '' }, semDash: true, semPulo: true,
  rotulo: 'tesouros', duracao: TEMPO, tema: 0,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'circulo', raio: raioDe(n), parede: true };
    if (p.modo === 'times') posicionaCantos(p, 4.2, 3.4); else posicionaRoda(p, p.arena.raio * 0.55);
    p.dados = {
      placar: Array(p.modo === 'times' ? 2 : n).fill(0), tesouros: [], sem: 0, buracos: [], baus: [], fx: [],
      calor: Array(n).fill(0), pulso: Array(n).fill(0.6), desde: Array(n).fill(9), iv: Array(n).fill(2),
      cava: Array(n).fill(0), tonto: Array(n).fill(0), onde: Array(n).fill(null), areia: Array(n).fill(0),
      aviso: '', avisoCor: '#ffd84d', tAviso: 0,
    };
    for (let k = 0; k < qtdTesouros(n); k++) p.dados.tesouros.push(sorteia(p, null));
    p.jogadores.forEach((j, i) => { p.dados.calor[i] = calor(maisPerto(p.dados, j.x, j.z).dist); });
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, de = dono(p), prontos = [];
    d.tAviso -= dt; d.sem += dt;
    if (d.tAviso <= 0) d.aviso = p.t < 2.5 ? 'Ache os tesouros!' : '';
    for (const b of d.baus) b.t += dt;
    d.baus = d.baus.filter(b => b.t < 2);

    js.forEach((j, i) => {
      // detector: vibra e pisca no ritmo da distancia do tesouro mais proximo
      const dist = maisPerto(d, j.x, j.z).dist;
      d.iv[i] = intervalo(dist); d.calor[i] = calor(dist);
      d.pulso[i] = Math.min(d.pulso[i] - dt, d.iv[i]);
      d.desde[i] += dt;
      if (d.pulso[i] <= 0) { d.pulso[i] = d.iv[i]; d.desde[i] = 0; vibra(p, i); }

      if (d.cava[i] > 0 || d.tonto[i] > 0) {                 // cavando, ou olhando o buraco vazio: parado no lugar
        const o = d.onde[i];
        j.x = o.x; j.z = o.z; j.vx = j.vz = 0;
        if (d.tonto[i] > 0) { d.tonto[i] = Math.max(0, d.tonto[i] - dt); return; }
        d.cava[i] = Math.max(0, d.cava[i] - dt); d.areia[i] -= dt;
        if (d.areia[i] <= 0) { d.areia[i] = 0.18; d.fx.push({ x: o.x, y: 0.3, z: o.z, cor: -1, q: 5, forca: 4 }); }
        if (d.cava[i] <= 0) prontos.push(i);
      } else if (j.apertouA && j.vivo) {
        d.cava[i] = T_CAVA; d.onde[i] = { x: j.x, z: j.z }; d.areia[i] = 0;
        j.vx = j.vz = 0;
        p.eventos.push('dash');
      }
    });

    // buracos que ficaram prontos neste quadro: quem cavou mais perto do tesouro confere primeiro (sem favorecer o J1)
    prontos.sort((a, b) => maisPerto(d, d.onde[a].x, d.onde[a].z).dist - maisPerto(d, d.onde[b].x, d.onde[b].z).dist);
    for (const i of prontos) {
      const o = d.onde[i], { k, dist } = maisPerto(d, o.x, o.z);
      d.buracos.push({ x: o.x, z: o.z, dono: i });
      if (d.buracos.length > MAX_BURACOS) d.buracos.shift();
      if (dist < achou(d)) {
        const t = d.tesouros[k];
        d.placar[de(i)]++;
        d.baus.push({ x: t.x, z: t.z, t: 0 });
        d.fx.push({ x: t.x, y: 1, z: t.z, cor: -2, q: 30, forca: 8 }, { x: t.x, y: 1.4, z: t.z, cor: i, q: 14, forca: 5 });
        p.eventos.push('moeda', 'ponto');
        js[i].vy = 8; vibra(p, i);
        d.aviso = quem(p, i) + ' achou!'; d.tAviso = 1.1;
        d.tesouros.splice(k, 1); d.tesouros.splice(k, 0, sorteia(p, t)); d.sem = 0;
      } else {
        d.tonto[i] = T_ERRO;
        p.eventos.push('batida');
        d.fx.push({ x: o.x, y: 0.3, z: o.z, cor: -1, q: 10, forca: 3 });
      }
    }
    celulares(p);

    if (p.t >= TEMPO) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      return fechaComo(p, lideres.length === 1 ? lideres[0] : -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, R = p.arena.raio;
    const plano = (geo, cor, y, extra) => {
      const m = malha(geo, cor, { roughness: 1, ...extra });
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = false; grupo.add(m); return m;
    };
    // ilha de areia cercada de mar, com manchas de areia mais escura e mais clara
    plano(new THREE.CircleGeometry(R, 64), 0xecd08a, 0.03);
    for (let k = 0; k < 14; k++) {
      const ang = k * 2.4, r = 1.5 + (k * 1.37) % (R - 2.8);
      plano(new THREE.CircleGeometry(0.5 + (k % 3) * 0.3, 14), k % 2 ? 0xdcbb70 : 0xf6e2a6, 0.04).position.set(Math.cos(ang) * r, 0.04, Math.sin(ang) * r);
    }
    plano(new THREE.RingGeometry(R + 0.2, R + 6, 64), 0x1fa3d6, -0.02, { emissive: 0x0b5f8a, emissiveIntensity: 0.5, roughness: 0.3, side: THREE.DoubleSide });
    pecas.onda = plano(new THREE.RingGeometry(R + 0.3, R + 0.7, 64), 0xffffff, 0, { emissive: 0xffffff, emissiveIntensity: 0.5, side: THREE.DoubleSide });
    // palmeiras atras e dos lados, fora da arena (nao tapam a visao)
    pecas.copas = [];
    for (let k = 0; k < 6; k++) {
      const ang = -Math.PI * (0.08 + k * 0.168), r = R + 1.3 + (k % 2) * 0.7, h = 3 + (k % 3) * 0.5;
      const g = new THREE.Group(); g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
      const tronco = malha(new THREE.CylinderGeometry(0.16, 0.28, h, 8), 0x9a6a3a); tronco.position.y = h / 2;
      const copa = new THREE.Group(); copa.position.y = h;
      for (let f = 0; f < 6; f++) {
        const folha = malha(new THREE.SphereGeometry(1, 8, 6), f % 2 ? 0x2a8f4c : 0x23743f), a = f * Math.PI / 3;
        folha.scale.set(1.1, 0.07, 0.36); folha.position.set(Math.cos(a) * 0.95, -0.12, Math.sin(a) * 0.95);
        folha.rotation.y = -a; folha.rotation.z = -0.35;
        copa.add(folha);
      }
      g.add(tronco, copa); g.rotation.z = (k % 2 ? 1 : -1) * 0.08; grupo.add(g); pecas.copas.push(copa);
    }
    // pedras e conchas na beirada (so enfeite)
    for (let k = 0; k < 9; k++) {
      const ang = 0.5 + k * 0.7, r = R - 0.9 + (k % 2) * 0.4, s = 0.28 + (k % 3) * 0.1, concha = k % 3 === 0;
      const m = malha(concha ? new THREE.ConeGeometry(0.22, 0.3, 8) : new THREE.DodecahedronGeometry(s), concha ? 0xffd9e6 : k % 2 ? 0x8d9199 : 0xa7abb3, { roughness: 1, flatShading: true });
      m.position.set(Math.cos(ang) * r, concha ? 0.14 : s * 0.5, Math.sin(ang) * r); m.rotation.set(concha ? 0 : k, k * 2, 0); grupo.add(m);
    }
    // de cada jogador, na cor dele (em times, do time): antena detectora, anel do radar no chao e pa
    pecas.kit = p.jogadores.map((_, i) => {
      const cor = corDe(c, i), antena = new THREE.Group();
      const haste = malha(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), 0xdddddd); haste.position.y = 0.4;
      const luz = malha(new THREE.SphereGeometry(0.24, 14, 10), cor, { emissive: cor, emissiveIntensity: 0.2 }); luz.position.y = 0.9;
      antena.add(haste, luz);
      const radar = malha(new THREE.TorusGeometry(1, 0.09, 6, 40), cor, { emissive: cor, emissiveIntensity: 1 });
      radar.rotation.x = Math.PI / 2; radar.castShadow = false;
      const pa = new THREE.Group();
      const cabo = malha(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), 0x8a5a2b); cabo.position.y = 0.75;
      const lamina = malha(new THREE.BoxGeometry(0.42, 0.5, 0.06), 0xc8ccd4, { metalness: 0.6, roughness: 0.3 }); lamina.position.y = 0.2;
      pa.add(cabo, lamina);
      // tres estrelinhas que giram em cima de quem achou um buraco vazio
      const tonto = new THREE.Group();
      for (let k = 0; k < 3; k++) { const e = malha(new THREE.OctahedronGeometry(0.17), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }); e.position.set(Math.cos(k * 2.1) * 0.7, 0, Math.sin(k * 2.1) * 0.7); e.castShadow = false; tonto.add(e); }
      grupo.add(antena, radar, pa, tonto);
      return { antena, luz, radar, pa, tonto };
    });
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const { THREE, pecas, p } = c, d = p.dados;
    const s0 = 1 + 0.03 * (0.5 + 0.5 * Math.sin(t * 1.3)); pecas.onda.scale.set(s0, s0, 1);
    pecas.copas.forEach((copa, k) => { copa.rotation.z = 0.07 * Math.sin(t * 1.4 + k); copa.rotation.y = 0.2 * Math.sin(t * 0.6 + k * 2); });

    p.jogadores.forEach((j, i) => {
      const { antena, luz, radar, pa, tonto } = pecas.kit[i];
      const k = Math.max(0, 1 - d.desde[i] / Math.min(0.5, d.iv[i] * 0.6)), q = d.calor[i];     // k: 1 no instante do pulso, apaga ate o proximo
      antena.visible = j.vivo;
      antena.position.set(j.x, RAIO * 2 + j.y - 0.1, j.z);
      luz.material.emissiveIntensity = 0.15 + k * 2.2;
      luz.scale.setScalar(1.3 + k * (0.7 + q * 1.1));               // perto do tesouro: antena e anel maiores e mais fortes (sinal visual, sem vibracao)
      const s = 1.1 + (1 - k) * (0.8 + q * 2.2);
      radar.visible = k > 0.04;
      radar.position.set(j.x, 0.1, j.z); radar.scale.set(s, s, 1 + q);
      pa.visible = d.cava[i] > 0;
      if (pa.visible) {
        const fase = Math.sin(t * 22), lado = i % 2 ? -1 : 1;
        pa.position.set(j.x + lado * 0.95, 0.25 + 0.3 * Math.max(0, fase), j.z + 0.3);
        pa.rotation.z = lado * (0.5 + 0.35 * fase);
      }
      tonto.visible = d.tonto[i] > 0;
      tonto.position.set(j.x, RAIO * 2 + 0.9, j.z); tonto.rotation.y = t * 7;
      c.bonecos[i].rotation.z = d.tonto[i] > 0 ? Math.sin(t * 14) * 0.18 : 0;
    });

    const buracos = c.pool('buracos', d.buracos.length, () => {
      const g = new THREE.Group();
      const fundo = c.malha(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 18), 0x4a3216, { roughness: 1 }); fundo.castShadow = false;
      const monte = c.malha(new THREE.TorusGeometry(0.68, 0.13, 6, 18), 0xcfa85c, { roughness: 1 }); monte.rotation.x = Math.PI / 2;
      g.add(fundo, monte); return g;
    });
    d.buracos.forEach((b, n) => { buracos[n].position.set(b.x, 0.06, b.z); });

    const baus = c.pool('baus', d.baus.length, () => {
      const g = new THREE.Group();
      const caixa = c.malha(new THREE.BoxGeometry(1.2, 0.7, 0.8), 0x9a5a22);
      const tampa = c.malha(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12, 1, false, 0, Math.PI), 0xb06a2a); tampa.rotation.set(0, 0, Math.PI / 2); tampa.position.y = 0.35;
      const cinta = c.malha(new THREE.BoxGeometry(0.22, 0.86, 0.84), 0xffd84d, { emissive: 0xffc531, emissiveIntensity: 0.8, metalness: 0.6 }); cinta.position.y = 0.06;
      const ouro = c.malha(new THREE.SphereGeometry(0.34, 12, 8), 0xffd84d, { emissive: 0xffd84d, emissiveIntensity: 1.4 }); ouro.position.y = 1;
      g.add(caixa, tampa, cinta, ouro); return g;
    });
    d.baus.forEach((b, n) => {
      const sobe = Math.min(1, b.t / 0.45), some = Math.max(0, (b.t - 1.6) / 0.4);
      baus[n].position.set(b.x, -0.6 + sobe * 1.5 + 0.15 * Math.sin(t * 6), b.z + 1.5);       // sobe na frente de quem cavou, para o boneco nao tapar
      baus[n].rotation.y = b.t * 3;
      baus[n].scale.setScalar(Math.max(0.01, (0.4 + 0.6 * sobe) * (1 - some)) * 1.5);
    });

    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, f.y, f.z, f.cor === -1 ? 0xe2c074 : f.cor === -2 ? 0xffd84d : corDe(c, f.cor), f.q, f.forca);
    }
  },
};
