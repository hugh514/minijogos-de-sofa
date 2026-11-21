// Ladrao de galinhas (Festa: todos contra todos ou times). Cada um (ou cada time) tem um galinheiro com 3 galinhas. Encostar no
// galinheiro de um rival pega 1 galinha, que vai na cabeca (uma por vez, e quem carrega anda mais devagar); levar ate o proprio
// galinheiro guarda. O empurrao (A) de um rival perto de quem carrega derruba a galinha: ela fica solta, andando devagar, e
// qualquer um pega encostando. Aos 45 s vence quem (ou o time que) tiver mais galinhas guardadas; igual da empate.
import { posicionaCantos, timeDe, quem, RAIO } from '../logica.mjs';

export const TEMPO = 45, GALINHAS = 3;
const R_ARENA = 9.5, R_CASAS = 6.6, R_GAL = 1.8, R_TOCA = R_GAL + 0.3, R_PEGA = RAIO + 0.7, R_DERRUBA = 2.8;
const LENTO = 0.82, T_SEM_PEGAR = 1, T_EMPURROU = 0.35, VEL_SOLTA = 1.5, VOO = 7;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o galinheiro: do jogador ou do time
const perto = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) < r;
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

// Entre os jogadores que passam em "pode", o mais perto do ponto dentro do raio (-1 se ninguem): sem favorecer o J1.
function maisPerto(p, ponto, raio, pode) {
  let melhor = -1, dist = raio;
  p.jogadores.forEach((j, i) => {
    const r = Math.hypot(j.x - ponto.x, j.z - ponto.z);
    if (pode(i) && r < dist) { dist = r; melhor = i; }
  });
  return melhor;
}

function celulares(p, fim) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  p.jogadores.forEach((_, i) => {
    const tem = `${times ? 'Galinhas do time' : 'Suas galinhas'}: ${d.placar[de(i)]}.`;
    const t = fim ? fim[i] : d.com[i] ? `${tem} Leve a galinha para o seu galinheiro!` : `${tem} Pegue uma no galinheiro de um rival!`;
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

// A galinha solta voa do empurrao, depois cisca devagar numa direcao que muda de tempos em tempos, sempre dentro da arena.
function moveSolta(p, g, dt) {
  const f = Math.exp(-3 * dt), max = R_ARENA - 1;
  g.vira -= dt;
  if (g.vira <= 0) { g.ang = p.rng() * Math.PI * 2; g.vira = 1 + p.rng() * 1.5; }
  g.vx *= f; g.vz *= f;
  g.x += (g.vx + Math.cos(g.ang) * VEL_SOLTA) * dt; g.z += (g.vz + Math.sin(g.ang) * VEL_SOLTA) * dt;
  const r = Math.hypot(g.x, g.z);
  if (r > max) { g.x *= max / r; g.z *= max / r; g.vx = g.vz = 0; g.ang = Math.atan2(-g.z, -g.x); }       // na cerca, vira para o meio
}

export default {
  id: 'galinhas-festa', genero: 'corrida', nome: 'Ladrão de galinhas',
  dica: 'Pegue galinhas no galinheiro dos rivais, leve para o seu e empurre quem foge com uma.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Empurra', b: '' }, semPulo: true,
  semNome: true,        // o nome flutuante ficaria em cima da galinha que vai na cabeca
  rotulo: 'galinhas', duracao: TEMPO, tema: 0,

  inicia(p) {
    const n = p.jogadores.length, times = p.modo === 'times', donos = times ? 2 : n;
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: true };
    // galinheiros em roda (com 4, nos quatro cantos; em times, um de cada lado) e cada um larga na frente do seu
    const a0 = donos === 4 ? -3 * Math.PI / 4 : Math.PI;
    const casas = Array.from({ length: donos }, (_, k) => { const a = a0 + k * 2 * Math.PI / donos; return { x: Math.cos(a) * R_CASAS, z: Math.sin(a) * R_CASAS }; });
    if (times) posicionaCantos(p, 4.2, 2.4);
    else p.jogadores.forEach((j, i) => { j.x = casas[i].x * 4.2 / R_CASAS; j.z = casas[i].z * 4.2 / R_CASAS; });
    p.dados = {
      casas, placar: Array(donos).fill(GALINHAS), com: Array(n).fill(false), soltas: [],
      nopega: Array(n).fill(0), emp: Array(n).fill(0), fx: [], aviso: 'Roube as galinhas!',
    };
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, de = dono(p);
    d.aviso = p.t < 2.5 ? 'Roube as galinhas!' : '';
    d.nopega = d.nopega.map(v => Math.max(0, v - dt));
    const livre = i => js[i].vivo && !d.com[i] && d.nopega[i] <= 0;
    const pega = (i, tipo) => { d.com[i] = true; d.fx.push({ tipo, x: js[i].x, z: js[i].z, i }); vibra(p, i); };

    // empurrao de um rival perto de quem carrega: a galinha cai e voa para longe de quem empurrou
    js.forEach((j, i) => {
      if (j.empurroes <= d.emp[i]) return;
      d.emp[i] = j.empurroes;
      js.forEach((o, k) => {
        if (!d.com[k] || de(k) === de(i) || !perto(j, o, R_DERRUBA)) return;
        const m = Math.hypot(o.x - j.x, o.z - j.z) || 1;
        d.soltas.push({ x: o.x, z: o.z, vx: (o.x - j.x) / m * VOO, vz: (o.z - j.z) / m * VOO, ang: p.rng() * Math.PI * 2, vira: 0.8 });
        d.com[k] = false; d.nopega[k] = T_SEM_PEGAR; d.nopega[i] = Math.max(d.nopega[i], T_EMPURROU);
        d.fx.push({ tipo: 'caiu', x: o.x, z: o.z, i: k });
        p.eventos.push('queda'); vibra(p, k);
      });
    });

    // guardar: quem carrega e encosta no proprio galinheiro
    js.forEach((j, i) => {
      if (!d.com[i] || !perto(j, d.casas[de(i)], R_TOCA)) return;
      d.com[i] = false; d.placar[de(i)]++;
      d.fx.push({ tipo: 'guardou', x: d.casas[de(i)].x, z: d.casas[de(i)].z, i });
      p.eventos.push('moeda');
    });

    // galinha solta: anda, e o mais perto de maos vazias leva
    for (let k = d.soltas.length - 1; k >= 0; k--) {
      const g = d.soltas[k];
      moveSolta(p, g, dt);
      const i = maisPerto(p, g, R_PEGA, livre);
      if (i < 0) continue;
      d.soltas.splice(k, 1); pega(i, 'pegou'); p.eventos.push('troca');
    }

    // roubo: galinheiro com galinha da 1 ao rival de maos vazias mais perto
    d.casas.forEach((casa, k) => {
      if (d.placar[k] <= 0) return;
      const i = maisPerto(p, casa, R_TOCA, q => livre(q) && de(q) !== k);
      if (i < 0) return;
      d.placar[k]--; pega(i, 'roubou'); p.eventos.push('troca');
      js.forEach((_, q) => { if (de(q) === k) vibra(p, q); });
    });

    js.forEach((j, i) => { j.turbo = d.com[i] ? LENTO : 1; });      // quem carrega corre menos: da para alcancar
    celulares(p);

    if (p.t >= TEMPO) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      return fechaComo(p, lideres.length === 1 ? lideres[0] : -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, d = p.dados;
    pecas.visto = 0;
    const grama = malha(new THREE.CylinderGeometry(R_ARENA - 0.2, R_ARENA - 0.2, 0.04, 44), 0x5aa84a, { roughness: 1 });
    grama.position.y = 0.03; grama.castShadow = false; grupo.add(grama);
    // um cercadinho por dono, na cor dele: palha no chao, estacas, duas tabuas em volta e uma bandeirinha
    d.casas.forEach((casa, k) => {
      const cor = p.modo === 'times' ? c.times[k] : c.cores[k], g = new THREE.Group();
      const palha = malha(new THREE.CylinderGeometry(R_GAL, R_GAL, 0.06, 28), 0xd9b65a, { roughness: 1 }); palha.position.y = 0.07; palha.castShadow = false; g.add(palha);
      for (let e = 0; e < 10; e++) {
        const a = e * Math.PI / 5, estaca = malha(new THREE.CylinderGeometry(0.1, 0.12, 0.8, 6), cor, { roughness: 0.7 });
        estaca.position.set(Math.cos(a) * R_GAL, 0.4, Math.sin(a) * R_GAL); g.add(estaca);
      }
      for (const y of [0.3, 0.62]) {
        const tabua = malha(new THREE.TorusGeometry(R_GAL, 0.06, 5, 28), cor, { roughness: 0.7 });
        tabua.rotation.x = Math.PI / 2; tabua.position.y = y; g.add(tabua);
      }
      // bandeirinha atras do cercado (longe da camera), para aparecer por cima dele
      const mastro = malha(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), 0x6b4a2f); mastro.position.set(0, 1.2, -R_GAL - 0.1);
      const pano = malha(new THREE.BoxGeometry(1, 0.6, 0.06), cor, { emissive: cor, emissiveIntensity: 0.35 }); pano.position.set(0.5, 2.1, -R_GAL - 0.1);
      g.add(mastro, pano);
      g.position.set(casa.x, 0, casa.z); grupo.add(g);
    });
  },

  desenha(c, dt, t) {
    const { THREE, malha, p, pecas } = c, d = p.dados, js = p.jogadores;
    const branco = { roughness: 0.9, flatShading: true };
    // galinha de primitivas, olhando para +z: corpo branco, crista vermelha, bico laranja
    const cria = () => {
      const g = new THREE.Group(), cabeca = new THREE.Group();
      const corpo = malha(new THREE.SphereGeometry(0.45, 7, 5), 0xffffff, branco); corpo.scale.set(1, 0.9, 1.25); corpo.position.y = 0.6;
      const rabo = malha(new THREE.ConeGeometry(0.22, 0.5, 5), 0xffffff, branco); rabo.position.set(0, 0.9, -0.52); rabo.rotation.x = -0.7;
      const asas = [-1, 1].map(s => { const a = malha(new THREE.SphereGeometry(0.26, 5, 4), 0xe9e4d8, branco); a.scale.set(0.35, 0.8, 1.1); a.position.set(s * 0.42, 0.62, -0.02); return a; });
      const pernas = [-1, 1].map(s => { const m = malha(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 5), 0xf08a1c); m.position.set(s * 0.16, 0.15, 0.02); return m; });
      const cranio = malha(new THREE.SphereGeometry(0.26, 6, 5), 0xffffff, branco); cranio.position.set(0, 0.3, 0.12);
      const crista = malha(new THREE.BoxGeometry(0.1, 0.22, 0.3), 0xe0281e, { emissive: 0x5a0a06 }); crista.position.set(0, 0.6, 0.1);
      const bico = malha(new THREE.ConeGeometry(0.1, 0.28, 5), 0xf08a1c, { emissive: 0x5a3000 }); bico.rotation.x = Math.PI / 2; bico.position.set(0, 0.28, 0.46);
      const papo = malha(new THREE.BoxGeometry(0.08, 0.14, 0.08), 0xe0281e); papo.position.set(0, 0.12, 0.36);
      const olhos = [-1, 1].map(s => { const o = malha(new THREE.SphereGeometry(0.05, 5, 4), 0x16161c); o.position.set(s * 0.2, 0.36, 0.26); o.castShadow = false; return o; });
      cabeca.add(cranio, crista, bico, papo, ...olhos); cabeca.position.set(0, 0.78, 0.36);
      g.add(corpo, rabo, ...asas, ...pernas, cabeca); g.scale.setScalar(1.15); g.userData = { cabeca, asas };
      return g;
    };
    const total = d.placar.reduce((s, v) => s + v, 0) + d.com.filter(Boolean).length + d.soltas.length;
    const aves = c.pool('galinhas', total, cria);
    let k0 = 0;
    // poe a proxima galinha do pool no lugar; bica = quanto a cabeca desce (ciscando), bate = asas abertas
    const poe = (x, y, z, giro, tomba, bica, bate) => {
      const g = aves[k0++], u = g.userData;
      g.position.set(x, y, z); g.rotation.set(0, giro, tomba);
      u.cabeca.rotation.x = bica;
      u.asas.forEach((a, s) => { a.rotation.z = (s ? -1 : 1) * bate; });
    };
    // guardadas: uma no meio e cinco em volta; da setima em diante, empoleiradas em cima das outras
    d.casas.forEach((casa, k) => {
      for (let q = 0; q < d.placar[k]; q++) {
        const lugar = q % 6, andar = Math.floor(q / 6), a = lugar * Math.PI * 2 / 5 + k, r = lugar === 5 ? 0 : 1.08, fase = t * 2.4 + q * 1.7 + k * 0.9;
        poe(casa.x + Math.cos(a) * r, 0.1 + andar * 1.05 + Math.abs(Math.sin(fase * 0.5)) * 0.04, casa.z + Math.sin(a) * r, a * 2 + q, 0, Math.max(0, Math.sin(fase)) * 0.9, 0);
      }
    });
    // na cabeca de quem carrega: se debate
    js.forEach((j, i) => {
      if (d.com[i]) poe(j.x, RAIO * 2 + 0.1 + j.y + Math.abs(Math.sin(t * 9 + i)) * 0.12, j.z, Math.atan2(j.vx, j.vz || 1e-6), Math.sin(t * 13 + i) * 0.22, 0, 0.9 + Math.sin(t * 22) * 0.6);
    });
    // soltas: correm aos pulinhos, de asa aberta
    d.soltas.forEach((g, k) => poe(g.x, 0.1 + Math.abs(Math.sin(t * 10 + k)) * 0.3, g.z, Math.atan2(g.vx + Math.cos(g.ang), g.vz + Math.sin(g.ang)), Math.sin(t * 16 + k) * 0.18, 0, 0.7 + Math.sin(t * 20 + k) * 0.5));

    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'caiu') c.particulas(e.x, 1.6, e.z, 0xffffff, 20, 8);              // penas
      else if (e.tipo === 'guardou') c.particulas(e.x, 0.8, e.z, p.modo === 'times' ? c.times[timeDe(p, e.i)] : c.cores[e.i], 14, 6);
      else c.particulas(e.x, 1.2, e.z, 0xfff3c4, 8, 4);
    }
  },
};
