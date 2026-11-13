// Pula-corda: uma corda gigante gira no meio da arena e acelera. Os dois pulam (B) na hora certa.
// Cada tropeço tira 1 de 3 vidas. De vez em quando a corda inverte o sentido ou dá uma finta (recua sem passar).
import { maiorPlacar } from '../logica.mjs';

const TAU = Math.PI * 2;
const L = 9, R_CORDA = 2.1, Y_EIXO = 2.2, CONTAS = 40, X_JOGADOR = 3;
const OMEGA0 = 3, OMEGA_MAX = 6.8, ACEL = 0.1;                 // rad/s, rad/s e rad/s por segundo
const T_PULO = 0.6, H_PULO = 2.2, LIVRE = 0.9, BUFFER = 0.12;  // quem esta acima de LIVRE passa por cima da corda
const CAIDO = 1.1, VIDAS = 3, LIMITE = 40;
const FINTA_T = 0.45, FINTA_VEL = 0.8;                         // na finta a corda anda para tras por um instante

// Distancia (rad) ate a proxima passada da corda pelo chao, no sentido em que ela gira.
function ateOChao(fase, sentido) {
  const m = ((fase % TAU) + TAU) % TAU;
  return sentido > 0 ? TAU - m : (m || TAU);
}

export default {
  id: 'pula-corda', nome: 'Pula-corda', dica: 'Pule a corda com B no tempo certo. 3 tropeços e você perde!',
  controle: { modo: 'padrao', a: 'PULA', b: 'PULA', joystick: false }, semMovimento: true, rotulo: 'vidas', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 6.5, parede: true };
    const sentido = p.rng() < 0.5 ? -1 : 1;
    p.jogadores.forEach((j, i) => { j.x = i ? X_JOGADOR : -X_JOGADOR; j.z = 0; });
    p.dados = {
      placar: [VIDAS, VIDAS], fase: -sentido * 5, sentido, omega: OMEGA0, acel: ACEL, finta: 0,
      proxInv: 6 + p.rng() * 3, proxFinta: 4 + p.rng() * 3,
      caido: [0, 0], noAr: [-1, -1], quer: [0, 0], fx: [], aviso: '', avisoT: 0,
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.omega = Math.min(OMEGA_MAX, d.omega + d.acel * dt);

    // pulo e queda de cada um; o motor não mexe neles (semMovimento), então a altura é daqui
    p.jogadores.forEach((j, i) => {
      d.caido[i] = Math.max(0, d.caido[i] - dt);
      d.quer[i] -= dt;
      if (j.apertouA || j.apertouB) d.quer[i] = BUFFER;           // toque guardado por um instante
      if (d.noAr[i] >= 0) { d.noAr[i] += dt; if (d.noAr[i] >= T_PULO) d.noAr[i] = -1; }
      if (d.noAr[i] < 0 && d.caido[i] <= 0 && d.quer[i] > 0) { d.noAr[i] = 0; d.quer[i] = 0; p.eventos.push('pulo'); }
      const u = d.noAr[i] >= 0 ? d.noAr[i] / T_PULO : 0;
      j.x = i ? X_JOGADOR : -X_JOGADOR; j.z = 0; j.vx = j.vz = 0;
      j.y = 4 * H_PULO * u * (1 - u); j.vy = 0;
    });

    // inversão e finta: sorteadas, e só quando a corda está num ponto em que dá tempo de reagir
    d.proxInv -= dt; d.proxFinta -= dt;
    const dist = ateOChao(d.fase, d.sentido);
    if (d.finta > 0) d.finta = Math.max(0, d.finta - dt);
    else if (d.proxFinta <= 0 && dist > 1 && dist < 1.5) { d.finta = FINTA_T; d.proxFinta = 4 + p.rng() * 3; }
    else if (d.proxInv <= 0 && dist > 2.2 && dist < 4) {
      d.sentido = -d.sentido; d.proxInv = 5 + p.rng() * 4;
      d.aviso = 'INVERTEU!'; d.avisoCor = '#ffd23f'; d.avisoT = 1; p.eventos.push('troca');
    }

    // a corda gira; cada passada pelo chao pega quem estiver abaixo de LIVRE (e não estiver caído)
    const antes = d.fase;
    d.fase += d.sentido * d.omega * (d.finta > 0 ? -FINTA_VEL : 1) * dt;
    if (Math.floor(d.fase / TAU) !== Math.floor(antes / TAU)) {
      p.jogadores.forEach((j, i) => {
        if (d.caido[i] > 0 || j.y >= LIVRE) return;
        d.placar[i]--; d.caido[i] = CAIDO; d.noAr[i] = -1; d.quer[i] = 0;
        d.fx.push({ x: j.x, i });
        p.eventos.push('queda');
        p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
      });
    }

    const [a, b] = d.placar;
    if (a <= 0 || b <= 0) return a <= 0 && b <= 0 ? -1 : a <= 0 ? 1 : 0;
    if (p.t > LIMITE) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.visto = 0;
    const faixa = malha(new THREE.BoxGeometry(L * 2, 0.02, 0.5), 0x2a3550, { emissive: 0x141a2c });
    faixa.position.y = 0.03; faixa.castShadow = false; grupo.add(faixa);
    for (const s of [-1, 1]) {                                  // as duas pontas, onde a corda é girada
      const poste = malha(new THREE.CylinderGeometry(0.22, 0.3, Y_EIXO, 10), 0x8a6a4a);
      poste.position.set(s * (L + 0.6), Y_EIXO / 2, 0);
      const topo = malha(new THREE.SphereGeometry(0.4, 14, 10), 0xe5383b);
      topo.position.set(s * (L + 0.6), Y_EIXO, 0);
      grupo.add(poste, topo);
      const marca = malha(new THREE.CylinderGeometry(0.9, 0.9, 0.02, 24), cores[s < 0 ? 0 : 1], { transparent: true, opacity: 0.35 });
      marca.position.set(s * X_JOGADOR, 0.04, 0); marca.castShadow = false; grupo.add(marca);
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { THREE } = c;
    const contas = c.pool('contas', CONTAS, () => c.malha(new THREE.SphereGeometry(0.2, 10, 8), 0xe9c78f, { emissive: 0x5a4020 }));
    const cos = Math.cos(d.fase), sen = Math.sin(d.fase);
    contas.forEach((m, k) => {
      const x = -L + 2 * L * k / (CONTAS - 1), a = 1 - (x / L) ** 2;
      m.position.set(x, Y_EIXO - R_CORDA * a * cos, R_CORDA * a * sen);
    });
    p.jogadores.forEach((j, i) => {
      const b = c.bonecos[i], caido = d.caido[i];
      const tomba = caido > 0 ? Math.min(1, (CAIDO - caido) * 8) : 0;       // cai de lado e pisca
      b.rotation.z = (i ? -1 : 1) * tomba * Math.PI / 2;
      b.visible = caido <= 0 || Math.floor(t * 14) % 2 === 0;
    });
    for (; c.pecas.visto < d.fx.length; c.pecas.visto++) {
      const e = d.fx[c.pecas.visto];
      c.particulas(e.x, 0.6, 0, 0xffd23f, 16, 7); c.particulas(e.x, 0.6, 0, c.cores[e.i], 10, 5);
    }
  },
};
