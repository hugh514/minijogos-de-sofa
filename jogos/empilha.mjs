// Empilha: cada um tem a sua torre. Um bloco desliza de um lado para o outro em cima dela; APERTE para soltar.
// O que passar da borda é cortado e cai, e o próximo bloco fica mais estreito. Errar o bloco inteiro perde na hora.
// Em 30 s vence a torre mais alta.
import { elimina, maiorPlacar } from '../logica.mjs';

const DUR = 30, PX = 5.5, AMP = 3.2, H = 0.45, PROF = 2;
export const L0 = 2.4, V0 = 2.6;
const DV = 0.3, V_MAX = 8, PERFEITO = 0.1, MINIMO = 0.05, ESPERA = 0.25;

const lado = i => (i ? 1 : -1);
const velocidade = n => Math.min(V_MAX, V0 + DV * n);

function novoEstado() {
  return { blocos: [{ x: 0, l: L0 }], bx: -AMP, dir: 1, v: V0, l: L0, espera: 0.8 };
}

// Solta o bloco do jogador i. Devolve true se errou o bloco inteiro.
function solta(p, i) {
  const d = p.dados, e = d.e[i], topo = e.blocos[e.blocos.length - 1];
  const nivel = e.blocos.length * H + H / 2;
  const ae = Math.max(topo.x - topo.l / 2, e.bx - e.l / 2), ad = Math.min(topo.x + topo.l / 2, e.bx + e.l / 2);
  const sobra = ad - ae;
  if (sobra <= MINIMO) {                                   // errou tudo: o bloco inteiro cai
    d.cortes.push({ i, x: e.bx, y: nivel, l: e.l, vx: 1.5 * Math.sign(e.bx - topo.x || 1), vy: 2, rot: 0, vr: 2 * Math.sign(e.bx - topo.x || 1), t: 0 });
    e.queda = true;
    p.eventos.push('queda');
    return true;
  }
  if (Math.abs(e.bx - topo.x) <= PERFEITO) {               // quase no centro: encaixa sem cortar
    e.blocos.push({ x: topo.x, l: topo.l });
    d.aviso = 'PERFEITO!'; d.avisoCor = '#ffd84d'; d.tAviso = 0.7;
    p.eventos.push('moeda');
  } else {
    const esq = e.bx < topo.x, borda = esq ? e.bx - e.l / 2 : e.bx + e.l / 2, lim = esq ? ae : ad;
    d.cortes.push({ i, x: (borda + lim) / 2, y: nivel, l: Math.abs(borda - lim), vx: esq ? -1.5 : 1.5, vy: 1, rot: 0, vr: esq ? 3 : -3, t: 0 });
    e.blocos.push({ x: (ae + ad) / 2, l: sobra });
    p.eventos.push('batida');
  }
  d.placar[i] = e.blocos.length - 1;
  const novo = e.blocos[e.blocos.length - 1];
  e.l = novo.l; e.v = velocidade(d.placar[i]); e.espera = ESPERA;
  e.dir = -e.dir; e.bx = e.dir > 0 ? -AMP : AMP;           // o próximo vem do lado oposto
  return false;
}

export default {
  id: 'empilha', nome: 'Empilha', dica: 'Aperte para soltar o bloco na torre. O que passar da borda cai. Errar tudo perde!',
  controle: { modo: 'botao', a: 'SOLTA!' }, semMovimento: true, semDash: true, semPulo: true, rotulo: 'andares', duracao: DUR,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 6, parede: true };
    p.jogadores.forEach((j, i) => { j.x = lado(i) * 9.6; j.z = 3.6; });
    p.dados = { placar: [0, 0], e: [novoEstado(), novoEstado()], cortes: [], aviso: '', avisoCor: '#ffd84d', tAviso: 0 };
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.tAviso -= dt;
    if (d.tAviso <= 0) d.aviso = '';
    const errou = [false, false];
    p.jogadores.forEach((j, i) => {
      const e = d.e[i];
      j.vx = j.vz = 0;
      if (e.espera > 0) e.espera -= dt;                    // logo depois de soltar, toques não valem (evita erro por toque duplo)
      else if (j.apertouA > 0) { errou[i] = solta(p, i); if (errou[i]) return; }
      if (e.espera > 0 || errou[i]) return;
      e.bx += e.dir * e.v * dt;
      if (e.bx > AMP) { e.bx = AMP; e.dir = -1; }
      else if (e.bx < -AMP) { e.bx = -AMP; e.dir = 1; }
    });
    for (const c of d.cortes) { c.t += dt; c.vy -= 25 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.rot += c.vr * dt; }
    d.cortes = d.cortes.filter(c => c.t < 1.8);
    if (errou[0] && errou[1]) { elimina(p, p.jogadores[0]); elimina(p, p.jogadores[1]); return maiorPlacar(p); }
    for (const i of [0, 1]) if (errou[i]) { elimina(p, p.jogadores[i]); return 1 - i; }
    if (p.t >= DUR) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.sobe = 0;
    for (const i of [0, 1]) {                              // base de pedra de cada torre, na cor de quem joga
      const b = malha(new THREE.BoxGeometry(AMP * 2 + L0 + 1, 0.3, PROF + 1.2), 0x3a3f5c, { roughness: 0.8 }); b.position.set(lado(i) * PX, -0.15, 0);
      const faixa = malha(new THREE.BoxGeometry(AMP * 2 + L0 + 1, 0.04, 0.2), cores[i], { emissive: cores[i], emissiveIntensity: 0.6 }); faixa.position.set(lado(i) * PX, 0.01, PROF / 2 + 0.7);
      grupo.add(b, faixa);
    }
    // marcas nas pontas do deslizamento
    for (const i of [0, 1]) for (const s of [-1, 1]) {
      const m = malha(new THREE.BoxGeometry(0.1, 0.5, PROF + 0.4), 0xffffff, { transparent: true, opacity: 0.25 });
      m.position.set(lado(i) * PX + s * (AMP + L0 / 2 + 0.3), 0.25, 0); m.castShadow = false; grupo.add(m);
    }
  },

  // Camera de frente, um pouco acima do topo da torre mais alta: da para ver as duas crescendo.
  camera(p) {
    const e = p.dados?.e;
    if (!e) return null;
    const topo = Math.max(...e.map(x => x.blocos.length)) * H;
    return { x: 0, y: topo + 8, z: 15.5, ox: 0, oy: Math.max(0, topo - 0.8), oz: -0.5 };
  },

  desenha(c, dt, t) {
    const { THREE, pecas, cores, p } = c, d = p.dados;
    pecas.sobe = 0;                     // a torre cresce de verdade; quem sobe e a camera (camera abaixo)
    const cor = new THREE.Color();
    for (const i of [0, 1]) {
      const e = d.e[i], n = e.blocos.length + (e.queda ? 0 : 1);
      const lista = c.pool('torre' + i, n, () => { const m = c.malha(new THREE.BoxGeometry(1, H, PROF), 0xffffff, { roughness: 0.5 }); return m; });
      lista.forEach((m, k) => {
        if (k >= n) return;                 // pecas a mais do pool ficam escondidas
        const b = k < e.blocos.length ? e.blocos[k] : { x: e.bx, l: e.l };
        const movel = k >= e.blocos.length;
        m.position.set(lado(i) * PX + b.x, k * H + H / 2 - pecas.sobe, 0);
        m.scale.set(Math.max(0.01, b.l), 1, 1);
        cor.set(cores[i]).offsetHSL(0, 0, (k % 2 ? 0.07 : -0.05) + (movel ? 0.1 : 0));
        m.material.color.copy(cor); m.material.emissive.copy(cor); m.material.emissiveIntensity = movel ? 0.5 : 0.12;
        m.visible = !(movel && e.espera > 0);
      });
    }
    const caem = c.pool('cortes', d.cortes.length, () => { const m = c.malha(new THREE.BoxGeometry(1, H, PROF), 0xffffff); return m; });
    d.cortes.forEach((q, k) => {
      const m = caem[k];
      m.position.set(lado(q.i) * PX + q.x, q.y - pecas.sobe, 0); m.scale.set(Math.max(0.01, q.l), 1, 1); m.rotation.z = q.rot;
      cor.set(cores[q.i]).offsetHSL(0, 0, -0.1); m.material.color.copy(cor);
    });
  },
};
