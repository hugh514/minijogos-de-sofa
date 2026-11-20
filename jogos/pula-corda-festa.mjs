// Pula-corda da festa (todos contra todos ou times). Uma corda gigante gira no meio da arena e acelera; todos, lado a lado,
// pulam na hora certa com o botão. Cada tropeço tira 1 de 3 vidas e quem zera voa para fora. De vez em quando a corda inverte
// o sentido ou dá uma finta (recua sem passar). Vence o último (ou o time) com vida, ou quem tiver mais vidas no fim do tempo.
// Em times as vidas dos dois se somam e o time só perde quando os dois zeram.
import { timeDe, quem, elimina } from '../logica.mjs';

export const TEMPO = 40, VIDAS = 3;
const TAU = Math.PI * 2;
const L = 10, R_CORDA = 2.1, Y_EIXO = 2.2, CONTAS = 48, ESPACO = 4;       // com 4 de espaco os nomes nao se encostam
const OMEGA0 = 3, OMEGA_MAX = 6.8, ACEL = 0.1;                 // rad/s, rad/s e rad/s por segundo
const T_PULO = 0.6, H_PULO = 2.2, LIVRE = 0.9, BUFFER = 0.12;  // quem esta acima de LIVRE passa por cima da corda
const CAIDO = 1.1;
const FINTA_T = 0.45, FINTA_VEL = 0.8;                         // na finta a corda anda para tras por um instante
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e a vida no placar: do jogador ou do time
const lugar = (i, n) => (i - (n - 1) / 2) * ESPACO;                   // todos em fila ao longo da corda, centrados

// Distancia (rad) ate a proxima passada da corda pelo chao, no sentido em que ela gira.
function ateOChao(fase, sentido) {
  const m = ((fase % TAU) + TAU) % TAU;
  return sentido > 0 ? TAU - m : (m || TAU);
}

function somaVidas(p) {
  const d = p.dados, totais = p.modo === 'times' ? [0, 0] : d.vidas.map(() => 0), de = dono(p);
  d.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

function celulares(p, fim) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  p.jogadores.forEach((_, i) => {
    const vidas = `Vidas: ${d.vidas[i]}` + (times ? ` (time: ${d.placar[de(i)]})` : '');
    const t = fim ? fim[i] : d.vidas[i] <= 0 ? 'Sem vidas. Torça!' : d.caido[i] > 0 ? `Tropeçou! ${vidas}` : vidas;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff'; d.avisoT = 0;
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

export default {
  id: 'pula-corda-festa', genero: 'ritmo', nome: 'Pula-corda da festa',
  dica: 'Aperte para pular a corda no tempo certo, porque cada tropeço tira uma das 3 vidas.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'botao', a: 'Pula' }, semMovimento: true, rotulo: 'vidas', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length, sentido = p.rng() < 0.5 ? -1 : 1;
    p.arena = { tipo: 'ret', lx: 11, lz: 6.5, parede: true };
    p.jogadores.forEach((j, i) => { j.x = lugar(i, n); j.z = 0; });
    p.dados = {
      vidas: Array(n).fill(VIDAS), placar: [], inventario: [], fase: -sentido * 5, sentido, omega: OMEGA0, acel: ACEL, finta: 0,
      proxInv: 6 + p.rng() * 3, proxFinta: 4 + p.rng() * 3,
      caido: Array(n).fill(0), noAr: Array(n).fill(-1), quer: Array(n).fill(0), fx: [], aviso: '', avisoT: 0,
    };
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }
    d.omega = Math.min(OMEGA_MAX, d.omega + d.acel * dt);

    // pulo e queda de cada um; o motor nao mexe neles (semMovimento), entao a altura e daqui
    p.jogadores.forEach((j, i) => {
      if (!j.vivo) return;
      d.caido[i] = Math.max(0, d.caido[i] - dt);
      d.quer[i] -= dt;
      if (j.apertouA || j.apertouB) d.quer[i] = BUFFER;           // toque guardado por um instante
      if (d.noAr[i] >= 0) { d.noAr[i] += dt; if (d.noAr[i] >= T_PULO) d.noAr[i] = -1; }
      if (d.noAr[i] < 0 && d.caido[i] <= 0 && d.quer[i] > 0) { d.noAr[i] = 0; d.quer[i] = 0; p.eventos.push('pulo'); }
      const u = d.noAr[i] >= 0 ? d.noAr[i] / T_PULO : 0;
      Object.assign(j, { x: lugar(i, n), z: 0, vx: 0, vz: 0, vy: 0, y: 4 * H_PULO * u * (1 - u) });
    });

    // inversao e finta: sorteadas, e so quando a corda esta num ponto em que da tempo de reagir
    d.proxInv -= dt; d.proxFinta -= dt;
    const dist = ateOChao(d.fase, d.sentido);
    if (d.finta > 0) d.finta = Math.max(0, d.finta - dt);
    else if (d.proxFinta <= 0 && dist > 1 && dist < 1.5) { d.finta = FINTA_T; d.proxFinta = 4 + p.rng() * 3; }
    else if (d.proxInv <= 0 && dist > 2.2 && dist < 4) {
      d.sentido = -d.sentido; d.proxInv = 5 + p.rng() * 4;
      d.aviso = 'Inverteu!'; d.avisoCor = '#ffd23f'; d.avisoT = 1; p.eventos.push('troca');
    }

    // a corda gira; cada passada pelo chao pega quem estiver abaixo de LIVRE (e nao estiver caido)
    const antes = d.fase;
    d.fase += d.sentido * d.omega * (d.finta > 0 ? -FINTA_VEL : 1) * dt;
    if (Math.floor(d.fase / TAU) !== Math.floor(antes / TAU)) {
      p.jogadores.forEach((j, i) => {
        if (!j.vivo || d.caido[i] > 0 || j.y >= LIVRE) return;
        d.vidas[i]--; d.caido[i] = CAIDO; d.noAr[i] = -1; d.quer[i] = 0;
        d.fx.push({ x: j.x, i });
        p.eventos.push('queda');
        p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
        if (d.vidas[i] <= 0) { elimina(p, j, 13); j.vx = Math.sign(j.x || 1) * 3; j.vz = 5; }       // sem vidas: a corda joga para fora
      });
    }
    d.placar = somaVidas(p);
    d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    celulares(p);

    // acabou quando sobra um dono (jogador ou time) com vida
    const restam = d.placar.flatMap((v, k) => (v > 0 ? [k] : []));
    if (restam.length <= 1) return fechaComo(p, restam.length ? restam[0] : -1);
    if (p.t >= TEMPO) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      return fechaComo(p, lideres.length === 1 ? lideres[0] : -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, n = p.jogadores.length;
    const cor = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    pecas.visto = 0;
    const faixa = malha(new THREE.BoxGeometry(L * 2, 0.02, 0.5), 0x2a3550, { emissive: 0x141a2c });
    faixa.position.y = 0.03; faixa.castShadow = false; grupo.add(faixa);
    for (const s of [-1, 1]) {                                  // as duas pontas, onde a corda e girada
      const poste = malha(new THREE.CylinderGeometry(0.22, 0.3, Y_EIXO, 10), 0x8a6a4a);
      poste.position.set(s * (L + 0.6), Y_EIXO / 2, 0);
      const topo = malha(new THREE.SphereGeometry(0.4, 14, 10), 0xe9edf7);
      topo.position.set(s * (L + 0.6), Y_EIXO, 0);
      grupo.add(poste, topo);
    }
    // de cada um: a marca no chao onde ele pula e, na frente, a plaquinha com as vidas (lampadas brancas)
    pecas.vidas = p.jogadores.map((_, i) => {
      const x = lugar(i, n);
      const marca = malha(new THREE.CylinderGeometry(1.05, 1.05, 0.04, 28), cor(i), { roughness: 0.8 });
      marca.position.set(x, 0.04, 0); marca.castShadow = false;
      const placa = malha(new THREE.BoxGeometry(2.3, 0.3, 0.95), cor(i), { roughness: 0.6 });
      placa.position.set(x, 0.15, 3.6);
      grupo.add(marca, placa);
      return Array.from({ length: VIDAS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.3, 12, 8), 0xffffff, { emissive: 0xfff3c4, emissiveIntensity: 0.9 });
        m.position.set(x + (k - 1) * 0.72, 0.5, 3.6); m.castShadow = false; grupo.add(m); return m;
      });
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { THREE } = c;
    const contas = c.pool('contas', CONTAS, () => c.malha(new THREE.SphereGeometry(0.25, 10, 8), 0xe9c78f, { emissive: 0x5a4020 }));
    const cos = Math.cos(d.fase), sen = Math.sin(d.fase);
    contas.forEach((m, k) => {
      const x = -L + 2 * L * k / (CONTAS - 1), a = 1 - (x / L) ** 4;      // barriga larga: a corda passa rente ao chao para todos
      m.position.set(x, Y_EIXO - R_CORDA * a * cos, R_CORDA * a * sen);
    });
    p.jogadores.forEach((j, i) => {
      const b = c.bonecos[i], caido = j.vivo ? d.caido[i] : 0;
      const tomba = caido > 0 ? Math.min(1, (CAIDO - caido) * 8) : 0;       // cai de lado e pisca
      b.rotation.z = (i % 2 ? -1 : 1) * tomba * Math.PI / 2;
      b.visible = j.vivo ? caido <= 0 || Math.floor(t * 14) % 2 === 0 : b.position.y > -12;
      c.pecas.vidas[i].forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });
    for (; c.pecas.visto < d.fx.length; c.pecas.visto++) {
      const e = d.fx[c.pecas.visto];
      c.particulas(e.x, 0.6, 0, 0xffd23f, 16, 7); c.particulas(e.x, 0.6, 0, p.modo === 'times' ? c.times[timeDe(p, e.i)] : c.cores[e.i], 10, 5);
    }
  },
};
