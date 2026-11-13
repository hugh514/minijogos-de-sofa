// Quase no teto: segure para o elevador subir e solte para travar. O teto e invisivel ate alguem chegar perto.
import { posiciona, RAIO } from '../logica.mjs';

const TETO_MIN = 3, TETO_MAX = 7, T_AUTO = 6, LIMITE = 20, T_MOSTRA = 1.8;
const V0 = 1.4, ACEL = 0.3, GRAVIDADE = 25, PERTO = 2, X = 4, BASE = 0.3;
const cm = alt => Math.round(alt * 100);
const pontos = e => e.estado === 'caindo' || e.estado === 'caiu' ? 0 : cm(e.alt);

function fala(p, i, texto, vibra = 0) {
  p.celular[i] = { texto, vibra: (p.celular[i].vibra ?? 0) + vibra };
}

function trava(p, i) {
  const e = p.dados.e[i];
  e.estado = 'travou'; p.eventos.push('moeda');
  fala(p, i, `Travou em ${cm(e.alt)} cm`);
}

export default {
  id: 'teto', nome: 'Quase no teto', dica: 'Segure para subir e solte para travar. Quem bater no teto invisível zera!',
  semMovimento: true, controle: { modo: 'botao', a: 'SEGURA' }, rotulo: 'altura',

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9, lz: 5, parede: true };
    posiciona(p, X);
    p.dados = {
      teto: TETO_MIN + p.rng() * (TETO_MAX - TETO_MIN),
      e: [0, 1].map(() => ({ estado: 'espera', alt: 0, ts: 0, v: 0, auto: false, segurava: false })),
      placar: [0, 0], fim: 0, aviso: '', avisoCor: '#ff4a4a',
    };
    for (const i of [0, 1]) fala(p, i, 'Segure para subir. Soltar trava de vez!');
  },

  atualiza(p, dt) {
    const d = p.dados;
    p.jogadores.forEach((j, i) => {
      const e = d.e[i], segura = j.ent.d;
      j.x = i ? X : -X; j.z = 0; j.vx = j.vz = 0;
      if (e.estado === 'espera') {
        if (j.apertouA || segura) { e.estado = 'sobe'; p.eventos.push('pulo'); }
        else if (p.t >= T_AUTO) {                   // demorou: sobe sozinho, e um toque (ou soltar) trava
          e.estado = 'sobe'; e.auto = true; p.eventos.push('pulo');
          fala(p, i, 'Subindo sozinho! Toque para travar', 1);
        }
      } else if (e.estado === 'sobe') {
        const soltou = e.auto ? !segura && (e.segurava || j.apertouA > 0) : !segura;
        if (soltou) trava(p, i);
        else {
          e.ts += dt; e.alt += (V0 + ACEL * e.ts) * dt;
          if (e.alt >= d.teto) {                    // bateu: despenca e zera
            e.alt = d.teto; e.estado = 'caindo'; e.v = 0; p.eventos.push('explosao');
            fala(p, i, 'Bateu no teto! Zerou', 1);
          }
        }
      } else if (e.estado === 'caindo') {
        e.v += GRAVIDADE * dt; e.alt -= e.v * dt;
        if (e.alt <= 0) { e.alt = 0; e.estado = 'caiu'; p.eventos.push('batida'); }
      }
      e.segurava = segura;
    });

    if (p.t >= LIMITE) d.e.forEach((e, i) => { if (e.estado === 'sobe' || e.estado === 'espera') trava(p, i); });
    d.placar = d.e.map(pontos);
    d.aviso = d.e.some(e => e.estado === 'caindo') ? 'BATEU NO TETO!' : ''; d.avisoCor = '#ff4a4a';

    if (d.e.every(e => e.estado === 'travou' || e.estado === 'caiu')) {   // mostra onde estava o teto e decide
      d.fim += dt;
      d.aviso = `O teto estava em ${cm(d.teto)} cm`; d.avisoCor = '#ffd84d';
      const [a, b] = d.placar;
      if (d.fim >= T_MOSTRA) return a === b ? -1 : a > b ? 0 : 1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.plat = []; pecas.pistao = []; pecas.visto = ['espera', 'espera'];
    for (const i of [0, 1]) {
      const x = i ? X : -X;
      const plat = malha(new THREE.BoxGeometry(2.6, BASE, 2.6), cores[i], { emissive: cores[i], emissiveIntensity: 0.15 });
      const pistao = malha(new THREE.CylinderGeometry(0.35, 0.35, 1, 16), 0xb8c2d9, { metalness: 0.5, roughness: 0.35 });
      plat.position.set(x, BASE / 2, 0); pistao.position.set(x, 0, 0);
      const regua = malha(new THREE.BoxGeometry(0.22, 9.4, 0.22), 0x59627f); regua.position.set(x, 4.7, -1.9);
      grupo.add(plat, pistao, regua);
      for (let k = 1; k <= 9; k++) {                // marcas da regua, uma por metro
        const marca = malha(new THREE.BoxGeometry(k % 5 ? 0.7 : 1.1, 0.09, 0.14), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 });
        marca.position.set(x, BASE + k, -1.78); grupo.add(marca);
      }
      pecas.plat.push(plat); pecas.pistao.push(pistao);
    }
    // o teto: laje vermelha translucida, na altura em que a cabeca do boneco encosta
    pecas.teto = malha(new THREE.BoxGeometry(13, 0.3, 3.2), 0xff3b3b, { emissive: 0xff2a2a, emissiveIntensity: 0.8, transparent: true, opacity: 0, depthWrite: false });
    pecas.teto.castShadow = pecas.teto.receiveShadow = false;
    pecas.teto.visible = false;
    grupo.add(pecas.teto);
  },

  desenha(c, dt, t) {
    const { pecas, cores, bonecos } = c, d = c.p.dados;
    let perto = 0;                                  // 0 a 1: o quanto o elevador mais alto esta chegando no teto
    d.e.forEach((e, i) => {
      const x = i ? X : -X, caido = e.estado === 'caindo' || e.estado === 'caiu';
      const treme = e.estado === 'sobe' ? Math.sin(t * 45 + i) * 0.015 : 0;
      pecas.plat[i].position.y = e.alt + BASE / 2 + treme;
      pecas.plat[i].material.emissiveIntensity = e.estado === 'travou' ? 0.9 : 0.15;
      pecas.pistao[i].scale.y = Math.max(0.01, e.alt); pecas.pistao[i].position.y = e.alt / 2;
      bonecos[i].position.y = RAIO + BASE + e.alt + treme;
      if (caido) bonecos[i].scale.set(1.25, 0.55, 1.25);   // amassado pela pancada
      if (!caido) perto = Math.max(perto, 1 - (d.teto - e.alt) / PERTO);

      if (pecas.visto[i] !== e.estado) {            // faiscas e sons nas viradas de estado
        if (e.estado === 'travou') c.particulas(x, e.alt + BASE, 0, cores[i], 14, 6);
        if (e.estado === 'caindo') { c.particulas(x, d.teto + BASE + 1.6, 0, 0xffc531, 30, 11); c.particulas(x, d.teto + BASE + 1.6, 0, 0xff4a2a, 16, 8); }
        if (e.estado === 'caiu') c.particulas(x, BASE, 0, 0xdfe6f5, 16, 7);
        pecas.visto[i] = e.estado;
      }
    });
    const revelado = d.fim > 0 || d.e.some(e => e.estado === 'caindo' || e.estado === 'caiu');
    const opac = revelado ? 0.6 : Math.max(0, Math.min(1, perto)) * 0.55;
    pecas.teto.visible = opac > 0.01;
    pecas.teto.material.opacity = opac;
    pecas.teto.position.set(0, d.teto + BASE + 2 * RAIO + 0.15, 0);
  },
};
