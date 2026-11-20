// Chão de lava da festa (todos contra todos ou times). O piso pisado racha (fica laranja) e cai pouco depois; todos andam
// ao mesmo tempo, então o chão some depressa. Quem cai na lava perde 1 de 3 vidas e volta 1,5 s depois num piso inteiro.
// O piso que caiu volta sozinho depois de alguns segundos (mais rápido com mais gente) e racha cada vez mais depressa.
// Vence o último (ou o time) com vida, ou quem tiver mais vidas no fim do tempo. Em times as vidas dos dois se somam.
// A arena 'pisos' é a do minijogo lava: o motor tira o chão de quem pisa num buraco e a tela desenha os pisos e a lava
// a partir de p.dados.pisos (7 x 7, lado 2,4; os dois números têm que ser os do motor).
import { posicionaCantos, timeDe, quem } from '../logica.mjs';

export const TEMPO = 45, VIDAS = 3;
const N_PISOS = 7, LADO_PISO = 2.4, MEIO = (N_PISOS - 1) / 2;
const T_PISO = 2, T_PISO_FIM = 1.1, T_PISO_INICIO = 2.5, TURBO_LAVA = 0.6;      // nos primeiros 2,5 s nada racha e todos andam mais devagar
const BORDA_PISOS = N_PISOS / 2 * LADO_PISO - 0.01, FOLGA_BORDA = 0.5;         // o boneco para meio corpo antes da beirada
const VOLTA = 1.5, T_PROTECAO = 1.2, T_SOBE = 0.5;
const COR_PISO = [0x444f74, 0x566288];      // as mesmas da tela (montaBase), para o piso que volta
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

export const tempoVolta = n => 6 - n;                                           // segundos ate o piso caido voltar: 4 com 2, 3 com 3 e 2 com 4
const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);                // de quem e a vida no placar: do jogador ou do time
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

function pisoEm(p, x, z) {
  const i = Math.round(x / LADO_PISO) + MEIO, k = Math.round(z / LADO_PISO) + MEIO;
  if (i < 0 || k < 0 || i >= N_PISOS || k >= N_PISOS) return null;
  const piso = p.dados.pisos[i * N_PISOS + k];
  return piso.caiu ? null : piso;
}

function somaVidas(p) {
  const d = p.dados, totais = p.modo === 'times' ? [0, 0] : d.vidas.map(() => 0), de = dono(p);
  d.vidas.forEach((v, i) => { totais[de(i)] += v; });
  return totais;
}

// Volta no piso inteiro mais perto do centro que nao tenha ninguem em cima; se nao sobrou nenhum, o do centro e refeito.
function renasce(p, d, i) {
  const j = p.jogadores[i];
  const livres = d.pisos.filter(x => !x.caiu && x.t < 0 && p.jogadores.every(o => !o.vivo || Math.hypot(o.x - x.x, o.z - x.z) > LADO_PISO * 0.9));
  livres.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const piso = livres[0] ?? Object.assign(d.pisos[(d.pisos.length - 1) / 2], { t: -1, caiu: false, volta: 0 });
  Object.assign(j, { vivo: true, x: piso.x, z: piso.z, y: 0, vx: 0, vy: 0, vz: 0 });
  d.fora[i] = false; d.protecao[i] = T_PROTECAO;
  d.fx.push({ tipo: 'volta', i, x: j.x, z: j.z });
  p.eventos.push('troca');
}

function celulares(p, fim) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  p.jogadores.forEach((_, i) => {
    const t = fim ? fim[i] : d.vidas[i] <= 0 ? 'Sem vidas. Torça!' : d.fora[i] ? 'Caiu! Volta em ' + Math.ceil(Math.max(0.01, d.volta[i])) + ' s'
      : `Vidas: ${d.vidas[i]}` + (times ? ` (time: ${d.placar[de(i)]})` : '');
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
  id: 'lava-festa', genero: 'equilibrio', nome: 'Chão de lava da festa',
  dica: 'Não pare: o piso pisado racha e cai, e cada queda na lava tira uma das 3 vidas.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Empurra', b: 'Pula' }, rotulo: 'vidas', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'pisos', parede: false, n: N_PISOS, lado: LADO_PISO };
    posicionaCantos(p, 2 * LADO_PISO, 2 * LADO_PISO);
    const pisos = [];
    for (let i = 0; i < N_PISOS; i++)
      for (let k = 0; k < N_PISOS; k++)
        pisos.push({ x: (i - MEIO) * LADO_PISO, z: (k - MEIO) * LADO_PISO, t: -1, caiu: false, volta: 0 });
    p.dados = {
      pisos, vidas: Array(n).fill(VIDAS), placar: [], inventario: [], volta: Array(n).fill(0), fora: Array(n).fill(false),
      protecao: Array(n).fill(0), fx: [], aviso: 'O chão vai cair!',
    };
    p.dados.placar = somaVidas(p);
    p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
    for (const j of p.jogadores) j.turbo = TURBO_LAVA;
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    d.aviso = p.t < T_PISO_INICIO ? 'O chão vai cair!' : '';
    const tPiso = T_PISO - (T_PISO - T_PISO_FIM) * Math.min(1, p.t / TEMPO);       // racha cada vez mais depressa

    p.jogadores.forEach((j, i) => {
      d.protecao[i] = Math.max(0, d.protecao[i] - dt);
      if (d.fora[i]) {
        if (d.vidas[i] <= 0) return;
        d.volta[i] -= dt;
        if (d.volta[i] <= 0) renasce(p, d, i);
        return;
      }
      if (!j.vivo) {                                                    // o motor ja tirou o chao dele: caiu na lava
        d.fora[i] = true; d.vidas[i]--; d.volta[i] = VOLTA;
        d.fx.push({ tipo: 'caiu', i, x: j.x, z: j.z });
        vibra(p, i);
        return;
      }
      for (const e of ['x', 'z']) if (Math.abs(j[e]) > BORDA_PISOS - FOLGA_BORDA) { j[e] = Math.sign(j[e]) * (BORDA_PISOS - FOLGA_BORDA); j['v' + e] = 0; }
      const piso = j.y <= 0 && p.t >= T_PISO_INICIO && d.protecao[i] <= 0 && pisoEm(p, j.x, j.z);
      if (piso && piso.t < 0) piso.t = 0;
    });
    for (const piso of d.pisos) {
      if (piso.caiu) { piso.volta -= dt; if (piso.volta <= 0) { piso.caiu = false; piso.t = -1; piso.volta = 0; } }
      else if (piso.t >= 0) { piso.t += dt; if (piso.t > tPiso) { piso.caiu = true; piso.volta = tempoVolta(n); } }
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
    const { THREE, malha, grupo, pecas } = c;
    pecas.visto = 0;
    // vidas: bolinhas claras acima de cada um (vermelho sumiria no brilho da lava)
    pecas.vidas = c.bonecos.map(() => {
      const g = new THREE.Group();
      const pips = Array.from({ length: VIDAS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.3, 14, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }); m.castShadow = false; m.position.x = (k - 1) * 0.8; g.add(m); return m;
      });
      grupo.add(g); return { g, pips };
    });
  },

  desenha(c, dt, t) {
    const { p, pecas } = c, d = p.dados;
    // A tela so desenha o piso rachando e caindo. Aqui: o que vai voltar sobe da lava em brasa no ultimo meio segundo
    // (ainda sem segurar ninguem) e o que ja voltou fica inteiro, na cor de antes.
    c.base.pisos?.forEach((m, i) => {
      const piso = d.pisos[i];
      if (!piso) return;
      if (piso.caiu) {
        if (piso.volta > T_SOBE) return;
        m.visible = true; m.position.y = -0.25 - piso.volta * 12; m.material.color.set(0x8a2a12); m.material.emissiveIntensity = 0.5;
      } else if (piso.t < 0) { m.visible = true; m.position.y = -0.25; m.material.color.set(COR_PISO[i % 2]); m.material.emissiveIntensity = 0; }
    });
    c.bonecos.forEach((b, i) => {
      const alvo = pecas.vidas[i];
      b.visible = b.position.y > -12 && !(d.protecao[i] > 0 && Math.floor(t * 12) % 2);       // pisca enquanto esta protegido
      alvo.g.visible = !d.fora[i] && d.vidas[i] > 0;
      alvo.g.position.set(b.position.x, b.position.y + 3.9 + Math.sin(t * 4 + i) * 0.08, b.position.z);      // acima da plaquinha do nome
      alvo.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto], cor = p.modo === 'times' ? c.times[timeDe(p, e.i)] : c.cores[e.i];
      if (e.tipo === 'caiu') { c.particulas(e.x, 0.4, e.z, 0xff7a1a, 22, 9); c.particulas(e.x, 0.4, e.z, cor, 10, 6); }
      else {
        c.particulas(e.x, 1, e.z, 0xffffff, 20, 7);
        const u = c.bonecos[e.i].userData;
        if (u?.corpo) u.corpo.rotation.x = 0;       // acabou de rodopiar na queda
      }
    }
  },
};
