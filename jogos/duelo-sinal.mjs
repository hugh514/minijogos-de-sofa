// Duelo do sinal: espere a luz VERDE e aperte primeiro. Quem aperta antes queima a largada. Melhor de 3.
import { posiciona, maiorPlacar, elimina } from '../logica.mjs';

const X = 4, VITORIAS = 2, PAUSA = 1.8, T_FALSO = 0.5, T_DORME = 3, LIMITE = 45;
const FALSOS = ['amarela', 'vermelha', 'quase', 'vibra'];
const CORES = { apagada: 0x2a3040, amarela: 0xffd21f, vermelha: 0xff2a2a, verde: 0x2bff6a };

function novoRound(p) {
  const d = p.dados;
  posiciona(p, X);
  for (const j of p.jogadores) { j.vx = j.vz = j.vy = 0; j.y = 0; }
  d.fase = 'espera'; d.t = 0; d.luz = 'apagada';
  d.tVerde = 2 + p.rng() * 4;
  d.falsos = [];
  for (let t = 0.9 + p.rng() * 0.8; t < d.tVerde - 0.6; t += 0.7 + p.rng() * 1.1)
    if (p.rng() < 0.75) d.falsos.push({ t, tipo: FALSOS[Math.floor(p.rng() * FALSOS.length)], quem: Math.floor(p.rng() * 3), feito: false });
}

// vencedor: 0 ou 1 (o outro perde o round) ou -1 (ninguem pontua). "voam": quem leva o tranco.
function fimRound(p, vencedor, voam, aviso, cor) {
  const d = p.dados;
  d.fase = 'pausa'; d.t = 0; d.luz = 'apagada'; d.aviso = aviso; d.avisoCor = cor;
  if (vencedor >= 0) d.placar[vencedor]++;
  const acabou = vencedor >= 0 && d.placar[vencedor] >= VITORIAS;
  for (const i of voam) {
    const j = p.jogadores[i], lado = i ? 1 : -1;
    j.vx = lado * 7; j.vy = 9;
    if (acabou) elimina(p, j, 12);
    d.fx.push({ x: j.x, z: j.z, i });
  }
  p.eventos.push(voam.length ? 'batida' : 'troca');
  if (voam.length) p.eventos.push('queda');
  if (acabou) return vencedor;
}

export default {
  id: 'duelo-sinal', nome: 'Duelo do sinal', dica: 'Espere a luz VERDE e aperte primeiro. Apertou antes? Queimou a largada!',
  semMovimento: true, controle: { modo: 'botao', a: 'JÁ!' }, rotulo: 'rounds',

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9, lz: 5, parede: true };
    p.dados = { placar: [0, 0], fx: [], aviso: '', avisoCor: '#ffffff' };
    novoRound(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.t += dt;
    if (p.t > LIMITE) return maiorPlacar(p);
    if (d.fase === 'pausa') { if (d.t >= PAUSA) novoRound(p); return; }

    const a = p.jogadores[0].apertouA > 0, b = p.jogadores[1].apertouA > 0;
    if (d.fase === 'espera') {
      if (a && b) return fimRound(p, -1, [0, 1], 'OS DOIS QUEIMARAM!', '#ff4a4a');
      if (a || b) return fimRound(p, a ? 1 : 0, [a ? 0 : 1], 'QUEIMOU A LARGADA!', '#ff4a4a');
      d.luz = 'apagada'; d.aviso = d.t < 1 ? 'PREPARAR...' : ''; d.avisoCor = '#ffffff';
      for (const f of d.falsos) {
        if (d.t < f.t) continue;
        if (!f.feito) {
          f.feito = true; p.eventos.push('troca');
          if (f.tipo === 'vibra') for (const i of [0, 1]) if (f.quem === 2 || f.quem === i) p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
        }
        if (d.t >= f.t + T_FALSO) continue;
        if (f.tipo === 'quase') { d.aviso = 'QUASE...'; d.avisoCor = '#ffd21f'; }
        else if (f.tipo !== 'vibra') d.luz = f.tipo;
      }
      if (d.t >= d.tVerde) { d.fase = 'verde'; d.t = 0; d.luz = 'verde'; d.aviso = 'JÁ!'; d.avisoCor = '#2bff6a'; p.eventos.push('gol'); }
      return;
    }
    // verde
    if (a && b) return fimRound(p, -1, [], 'EMPATE! DE NOVO', '#ffffff');
    if (a || b) return fimRound(p, a ? 0 : 1, [a ? 1 : 0], 'MAIS RÁPIDO!', '#2bff6a');
    if (d.t >= T_DORME) return fimRound(p, -1, [], 'DORMIRAM? DE NOVO', '#ffffff');
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const poste = malha(new THREE.CylinderGeometry(0.2, 0.3, 3.2, 12), 0x555c70);
    poste.position.set(0, 1.6, -3);
    pecas.luz = malha(new THREE.SphereGeometry(1.3, 24, 16), CORES.apagada, { emissive: CORES.apagada, emissiveIntensity: 1 });
    pecas.luz.position.set(0, 4.2, -3);
    pecas.disco = malha(new THREE.CylinderGeometry(1.8, 1.8, 0.06, 32), CORES.apagada, { emissive: CORES.apagada, emissiveIntensity: 0.8 });
    pecas.disco.position.y = 0.03;
    grupo.add(poste, pecas.luz, pecas.disco);
    pecas.marcas = [];
    for (const i of [0, 1]) {
      const lado = i ? 1 : -1;
      const base = malha(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 24), cores[i]);   // onde cada um fica
      base.position.set(lado * X, 0.04, 0); grupo.add(base);
      pecas.marcas[i] = [];
      for (let k = 0; k < VITORIAS; k++) {                                              // rounds ganhos, na frente de cada um
        const m = malha(new THREE.SphereGeometry(0.4, 16, 12), 0x333a4d, { emissive: 0x000000 });
        m.position.set(lado * (X - 0.6 + k * 1.2), 0.4, 3.4); grupo.add(m);
        pecas.marcas[i].push(m);
      }
    }
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const d = c.p.dados, { pecas, cores } = c, cor = CORES[d.luz] ?? CORES.apagada;
    for (const m of [pecas.luz, pecas.disco]) { m.material.color.set(cor); m.material.emissive.set(cor); }
    pecas.luz.scale.setScalar(d.luz === 'verde' ? 1.15 + Math.sin(t * 20) * 0.1 : d.luz === 'apagada' ? 1 : 1.1);
    for (const i of [0, 1]) {
      pecas.marcas[i].forEach((m, k) => {
        const aceso = d.placar[i] > k;
        m.material.color.set(aceso ? cores[i] : 0x333a4d); m.material.emissive.set(aceso ? cores[i] : 0x000000);
      });
      const corpo = c.bonecos[i].userData?.corpo;                                        // um de frente para o outro
      if (corpo && c.p.jogadores[i].vivo) corpo.rotation.y = i ? -Math.PI / 2 : Math.PI / 2;
    }
    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, 1.2, f.z, cores[f.i], 30, 9);
      c.particulas(f.x, 1.2, f.z, 0xffe14a, 14, 6);
    }
  },
};
