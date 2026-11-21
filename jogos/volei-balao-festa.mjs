// Balao nao pode cair (Festa: todos contra todos ou times). A quadra redonda e dividida em um setor por jogador (metades com 2,
// tercos com 3, quadrantes com 4) ou meia quadra por time, e ninguem sai do seu. Um balao cai devagar (aos 14 s chega o segundo,
// e os dois vao ficando mais rapidos). Bate (A) perto do balao rebate para onde o joystick aponta (sem joystick, para o meio);
// encostar nele da so um toquinho para cima. Balao no chao do seu setor: menos uma vida (sao 3; em times, 3 do time).
// Quem fica sem vidas sai e o setor dele vira trampolim. Vence o ultimo com vida, ou quem tem mais vidas aos 45 s; igual da empate.
import { posicionaCantos, timeDe, elimina, quem, RAIO } from '../logica.mjs';

export const TEMPO = 45, VIDAS = 3, T_SEGUNDO = 14, R_ARENA = 9, R_BALAO = 0.95;
const G = 8, V_QUEDA = 3, V_QUEDA_MAIS = 3, TETO = 6.5, AR = 0.5;
const ANDAR = 0.55;                                    // o boneco anda mais devagar que o normal: correr ate o balao e a graca
const ALCANCE = 2.3, ALTURA_BATE = 4.6, JANELA = 0.28, ESPERA_BATE = 0.55, V_BATE = 7.5, SOBE_BATE = 6, PULINHO = 6.5;
const V_TOQUE = 3, SOBE_TOQUE = 3.8, T_TOQUE = 0.45, PAUSA = 0.9, SAQUE = 0.7, R_SAQUE = 4.2, R_LARGADA = 4.6;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];
const CORES_BALAO = [0xf4f1e6, 0x2b2d42];              // creme e azul-noite: nenhuma cor de jogador nem de time
const CENTROS = { 2: [Math.PI, 0], 3: [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6], 4: [-3 * Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, Math.PI / 4] };

const times = p => p.modo === 'times';
const nSetores = p => (times(p) ? 2 : p.jogadores.length);
const dono = p => i => (times(p) ? timeDe(p, i) : i);  // de quem e o setor e a vida: do jogador ou do time
const corDono = (c, k) => (times(c.p) ? c.times[k] : c.cores[k]);
const unit = (x, z) => { const l = Math.hypot(x, z); return l > 1e-6 ? { x: x / l, z: z / l } : null; };
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };
const nomeDono = (p, k) => (times(p) ? NOMES_TIMES[k] : quem(p, k));
const velQueda = t => V_QUEDA + V_QUEDA_MAIS * Math.min(1, t / TEMPO) ** 2;       // os baloes ficam mais pesados com o tempo

// Direcao (vetor de tamanho 1) do meio do setor k.
export const centro = (p, k) => { const a = CENTROS[nSetores(p)][k]; return { x: Math.cos(a), z: Math.sin(a) }; };
// De quem e o chao no ponto (x, z): o setor cujo meio aponta mais para la.
export function setorDe(p, x, z) {
  let melhor = 0, maior = -Infinity;
  for (let k = 0; k < nSetores(p); k++) { const c = centro(p, k), v = x * c.x + z * c.z; if (v > maior + 1e-9) { maior = v; melhor = k; } }
  return melhor;
}

// Mantem o boneco dentro do proprio setor (uma fatia da quadra), a um corpo de distancia das linhas.
function prende(p, j, k) {
  const c = CENTROS[nSetores(p)][k], h = Math.PI / nSetores(p);
  for (const a of [c + h - Math.PI / 2, c - h + Math.PI / 2]) {
    const nx = Math.cos(a), nz = Math.sin(a), s = j.x * nx + j.z * nz - RAIO;
    if (s >= 0) continue;
    j.x -= nx * s; j.z -= nz * s;
    const v = j.vx * nx + j.vz * nz;
    if (v < 0) { j.vx -= v * nx; j.vz -= v * nz; }
  }
}

const comVida = d => d.vidas.flatMap((v, k) => (v > 0 ? [k] : []));

// Balao novo (ou de volta) no alto, em cima de um setor que ainda tem dono: o que recebeu menos saques, sorteando no empate.
function saque(p, b, avisa = true) {
  const d = p.dados, vivos = comVida(d), menos = Math.min(...vivos.map(k => d.saques[k])), opcoes = vivos.filter(k => d.saques[k] === menos);
  const k = opcoes[Math.floor(p.rng() * opcoes.length)] ?? 0, c = centro(p, k);
  d.saques[k]++;
  Object.assign(b, { x: c.x * R_SAQUE + (p.rng() - 0.5) * 2, z: c.z * R_SAQUE + (p.rng() - 0.5) * 2, y: TETO, vx: 0, vy: 0, vz: 0, espera: SAQUE, pausa: 0, toque: p.jogadores.map(() => 0), quer: [] });
  if (avisa) p.jogadores.forEach((j, i) => { if (dono(p)(i) === k && j.vivo) vibra(p, i); });       // vai cair na area deles
  return b;
}

// Onde o balao toca o chao se ninguem encostar (para a marca na tela).
export function queda(p, b) {
  const o = { ...b }, vq = velQueda(p.t), max = R_ARENA - R_BALAO;
  for (let k = 0; k < 160 && o.y - R_BALAO > 0; k++) {
    o.vy = Math.max(o.vy - G * 0.05, -vq); o.vx *= Math.exp(-AR * 0.05); o.vz *= Math.exp(-AR * 0.05);
    o.x += o.vx * 0.05; o.y = Math.min(TETO, o.y + o.vy * 0.05); o.z += o.vz * 0.05;
    const r = Math.hypot(o.x, o.z);
    if (r > max) { o.x *= max / r; o.z *= max / r; }
  }
  return { x: o.x, z: o.z };
}

function celulares(p, fim) {
  const d = p.dados, de = dono(p);
  p.jogadores.forEach((_, i) => {
    const v = d.vidas[de(i)];
    const t = fim ? fim[i] : v <= 0 ? 'Você ficou sem vidas' : `${times(p) ? 'Vidas do time' : 'Vidas'}: ${v}. Rebata o balão para longe!`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fecha(p, v) {
  const d = p.dados, de = dono(p);
  d.aviso = v < 0 ? 'Empate!' : nomeDono(p, v) + ' venceu!'; d.avisoCor = '#ffd23f'; d.tAviso = 99;
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times(p) ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

// Anda (devagar), fica no setor, bate (A) e encosta nos baloes.
function jogador(p, d, i, j, dt) {
  const e = d.e[i];
  e.cd = Math.max(0, e.cd - dt); e.bate = Math.max(0, e.bate - dt);
  if (!j.vivo) return;
  j.turbo = ANDAR;
  prende(p, j, dono(p)(i));
  if (j.apertouA && e.cd <= 0) {
    e.cd = ESPERA_BATE; e.bate = JANELA;
    if (j.y === 0) j.vy = PULINHO;
    p.eventos.push('pulo');
  }
  for (const b of d.baloes) {
    if (b.pausa > 0 || b.espera > 0) continue;
    const dist = Math.hypot(b.x - j.x, b.z - j.z);
    if (e.bate > 0 && b.toque[i] <= 0 && dist < ALCANCE && b.y < ALTURA_BATE) b.quer.push({ i, dist, forte: 1, r: p.rng() });
    else if (b.toque[i] <= 0 && dist < RAIO + R_BALAO * 0.9 && b.y - R_BALAO < 2 * RAIO + j.y) b.quer.push({ i, dist, forte: 0, r: p.rng() });
  }
}

// Dois no mesmo balao no mesmo quadro: vale a rebatida (A) antes do toque, depois quem esta mais perto, e no empate um sorteio.
// Nunca a ordem dos lugares.
function resolve(p, d, b) {
  const q = b.quer.sort((x, y) => y.forte - x.forte || x.dist - y.dist || x.r - y.r)[0];
  if (!q) return;
  for (const o of b.quer) { b.toque[o.i] = T_TOQUE; if (o.forte) d.e[o.i].bate = 0; }       // quem perdeu a disputa nao rebate no quadro seguinte
  b.quer = [];
  const i = q.i, j = p.jogadores[i];
  if (q.forte) {
    // rebatida: para onde o joystick aponta (com o andar invertido, a mira inverte junto); sem joystick, para o meio da quadra
    const s = p.mod?.inverte ? -1 : 1, len = Math.hypot(j.ent.x, j.ent.y), c = centro(p, dono(p)(i));
    const dir = len > 0.3 ? { x: s * j.ent.x / len, z: s * j.ent.y / len } : unit(-j.x, -j.z) ?? { x: -c.x, z: -c.z };
    b.vx = dir.x * V_BATE; b.vz = dir.z * V_BATE; b.vy = SOBE_BATE;
    d.fx.push({ tipo: 'bate', x: b.x, y: b.y, z: b.z, i });
    p.eventos.push('batida');
  } else {
    const dir = unit(b.x - j.x, b.z - j.z) ?? centro(p, dono(p)(i));
    b.vx = dir.x * V_TOQUE + j.vx * 0.3; b.vz = dir.z * V_TOQUE + j.vz * 0.3; b.vy = Math.max(b.vy, SOBE_TOQUE);
    d.fx.push({ tipo: 'toque', x: b.x, y: b.y, z: b.z, i });
    p.eventos.push('troca');
  }
}

function voa(p, d, b, dt) {
  b.toque = b.toque.map(v => Math.max(0, v - dt));
  if (b.pausa > 0) { b.pausa -= dt; if (b.pausa <= 0) saque(p, b); return; }      // caiu: fica murcho no chao um instante
  if (b.espera > 0) { b.espera -= dt; return; }
  const ar = Math.exp(-AR * dt), max = R_ARENA - R_BALAO;
  b.vy = Math.max(b.vy - G * dt, -velQueda(p.t)); b.vx *= ar; b.vz *= ar;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.y > TETO) { b.y = TETO; b.vy = Math.min(b.vy, 0); }
  const r = Math.hypot(b.x, b.z);
  if (r > max) {                                       // bate na cerca e volta
    const nx = b.x / r, nz = b.z / r, vn = b.vx * nx + b.vz * nz;
    b.x = nx * max; b.z = nz * max;
    if (vn > 0) { b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz; }
  }
  if (b.y - R_BALAO <= 0) chao(p, d, b);
}

function chao(p, d, b) {
  const k = setorDe(p, b.x, b.z), de = dono(p);
  b.y = R_BALAO;
  if (d.vidas[k] <= 0) {                               // setor de quem ja saiu: trampolim, o balao quica para um setor com dono
    const vivos = comVida(d), c = centro(p, vivos[Math.floor(p.rng() * vivos.length)] ?? 0);
    const dir = unit(c.x * R_SAQUE - b.x, c.z * R_SAQUE - b.z) ?? c;
    b.vx = dir.x * V_BATE; b.vz = dir.z * V_BATE; b.vy = SOBE_BATE;
    d.fx.push({ tipo: 'quica', x: b.x, y: 0.4, z: b.z, i: -1 });
    p.eventos.push('pulo');
    return;
  }
  d.vidas[k]--; b.vx = b.vy = b.vz = 0; b.pausa = PAUSA;
  d.fx.push({ tipo: 'chao', x: b.x, y: 0.5, z: b.z, i: k });
  d.aviso = nomeDono(p, k) + ' perdeu uma vida!'; d.avisoCor = '#ff6b5e'; d.tAviso = 1.1;
  p.eventos.push('queda');
  p.jogadores.forEach((j, i) => { if (de(i) === k) vibra(p, i); });
  if (d.vidas[k] === 0 && !times(p)) { elimina(p, p.jogadores[k], 12); p.eventos.push('explosao'); }
}

export default {
  id: 'volei-balao-festa', genero: 'reflexo', nome: 'Balão não pode cair',
  dica: 'Corra até o balão e aperte Bate para mandá-lo longe: se ele cair na sua área, você perde uma vida!',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Bate', b: '' }, semDash: true, semPulo: true,
  rotulo: 'vidas', duracao: TEMPO, tema: 0,

  inicia(p) {
    const n = p.jogadores.length, vidas = Array(nSetores(p)).fill(VIDAS);
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: true };
    if (times(p)) posicionaCantos(p, 4.2, 3);
    else p.jogadores.forEach((j, i) => { const c = centro(p, i); j.x = c.x * R_LARGADA; j.z = c.z * R_LARGADA; });
    p.dados = {
      vidas, placar: vidas, saques: vidas.map(() => 0), baloes: [], e: Array.from({ length: n }, () => ({ cd: 0, bate: 0 })),
      fx: [], aviso: 'Não deixe cair!', avisoCor: '#ffd23f', tAviso: 2.2,
    };
    p.dados.baloes.push(saque(p, {}, false));
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    if (d.tAviso > 0) { d.tAviso -= dt; if (d.tAviso <= 0) d.aviso = ''; }
    if (d.baloes.length < 2 && p.t >= T_SEGUNDO) {
      d.baloes.push(saque(p, {}));
      d.aviso = 'Mais um balão!'; d.avisoCor = '#ffd23f'; d.tAviso = 1.2;
      p.eventos.push('troca');
    }
    p.jogadores.forEach((j, i) => jogador(p, d, i, j, dt));
    for (const b of d.baloes) { resolve(p, d, b); voa(p, d, b, dt); }
    celulares(p);

    const vivos = comVida(d);
    if (vivos.length <= 1) return fecha(p, vivos[0] ?? -1);
    if (p.t >= TEMPO) {
      const maior = Math.max(...d.vidas), lideres = d.vidas.flatMap((v, k) => (v === maior ? [k] : []));
      return fecha(p, lideres.length === 1 ? lideres[0] : -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, S = nSetores(p), h = Math.PI / S;
    pecas.visto = 0;
    // um setor por dono, na cor dele clareada, com linhas brancas entre os setores e 3 baloezinhos (as vidas) do lado de fora da cerca
    pecas.setores = CENTROS[S].map((a, k) => {
      const cor = corDono(c, k), tinta = new THREE.Color(cor).lerp(new THREE.Color(0xffffff), 0.45).getHex();       // a cor do dono, clareada
      const chao = malha(new THREE.CircleGeometry(R_ARENA - 0.15, 28, -(a + h), 2 * h), tinta, { roughness: 1 });
      chao.rotation.x = -Math.PI / 2; chao.position.y = 0.03; chao.castShadow = false; grupo.add(chao);
      const linha = malha(new THREE.BoxGeometry(R_ARENA - 0.15, 0.06, 0.24), 0xffffff, { roughness: 0.8 });
      linha.position.set(Math.cos(a + h) * (R_ARENA - 0.15) / 2, 0.06, Math.sin(a + h) * (R_ARENA - 0.15) / 2); linha.rotation.y = -(a + h); linha.castShadow = false; grupo.add(linha);
      const vidas = Array.from({ length: VIDAS }, (_, q) => {
        const g = new THREE.Group(), b = a + (q - 1) * 0.2;
        const vara = malha(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), 0xffffff); vara.position.y = 0.55;
        const bola = malha(new THREE.SphereGeometry(0.42, 12, 9), cor, { emissive: cor, emissiveIntensity: 0.35, roughness: 0.4 }); bola.position.y = 1.4; bola.scale.y = 1.15;
        g.add(vara, bola); g.position.set(Math.cos(b) * (R_ARENA + 0.7), 0, Math.sin(b) * (R_ARENA + 0.7)); grupo.add(g);
        return g;
      });
      return { chao, tinta, vidas };
    });
    const borda = malha(new THREE.TorusGeometry(R_ARENA - 0.15, 0.12, 6, 64), 0xffffff, { roughness: 0.8 });
    borda.rotation.x = Math.PI / 2; borda.position.y = 0.06; borda.castShadow = false; grupo.add(borda);
    // guarda-sois atras da quadra (so enfeite, fora da arena)
    [-0.72, -0.5, -0.28].forEach((f, k) => {
      const a = Math.PI * f, r = R_ARENA + 2.2, g = new THREE.Group();
      const haste = malha(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), 0xffffff); haste.position.y = 1.3;
      const lona = malha(new THREE.ConeGeometry(1.7, 0.7, 8), k % 2 ? 0xf4f1e6 : 0xe5383b, { flatShading: true }); lona.position.y = 2.8;
      g.add(haste, lona); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); grupo.add(g);
    });
  },

  desenha(c, dt, t) {
    const { THREE, malha, pecas, p } = c, d = p.dados;
    pecas.setores.forEach((s, k) => {
      s.chao.material.color.set(d.vidas[k] > 0 ? s.tinta : 0x5c5a57);          // setor sem dono fica cinza
      s.vidas.forEach((g, q) => { g.visible = q < d.vidas[k]; g.position.y = Math.sin(t * 2 + q + k) * 0.06; });
    });

    // balao (corpo, nozinho e barbante), sombra embaixo dele e a marca de onde vai cair
    const baloes = c.pool('baloes', d.baloes.length, n => {
      const g = new THREE.Group(), cor = CORES_BALAO[n % 2], faixa = CORES_BALAO[1 - (n % 2)];
      const corpo = malha(new THREE.SphereGeometry(R_BALAO, 20, 14), cor, { roughness: 0.3, emissive: cor, emissiveIntensity: 0.15 }); corpo.scale.y = 1.12;
      const cinta = malha(new THREE.TorusGeometry(R_BALAO * 0.99, 0.09, 6, 24), faixa); cinta.rotation.x = Math.PI / 2;
      const no = malha(new THREE.ConeGeometry(0.2, 0.34, 8), cor); no.rotation.x = Math.PI; no.position.y = -R_BALAO * 1.12 - 0.12;
      const fio = malha(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), 0xffffff); fio.position.y = -R_BALAO * 1.12 - 0.8; fio.castShadow = false;
      g.add(corpo, cinta, no, fio);
      return g;
    });
    const sombras = c.pool('sombras', d.baloes.length, () => {
      const m = malha(new THREE.CylinderGeometry(1, 1, 0.02, 20), 0x000000, { transparent: true, opacity: 0.3 }); m.castShadow = false; return m;
    });
    const marcas = c.pool('marcas', d.baloes.length, () => {
      const g = new THREE.Group();
      const aro = malha(new THREE.TorusGeometry(1.15, 0.12, 6, 30), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }); aro.rotation.x = Math.PI / 2; aro.castShadow = false;
      const miolo = malha(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }); miolo.castShadow = false;
      g.add(aro, miolo); return g;
    });
    d.baloes.forEach((b, n) => {
      const g = baloes[n], murcho = b.pausa > 0, alt = Math.max(0, b.y - R_BALAO);
      g.position.set(b.x, b.y + (b.espera > 0 ? Math.sin(t * 6 + n) * 0.12 : 0), b.z);
      g.scale.set(murcho ? 1.35 : 1, murcho ? 0.5 : 1, murcho ? 1.35 : 1);
      g.rotation.z = Math.max(-0.3, Math.min(0.3, -b.vx * 0.04)); g.rotation.x = Math.max(-0.3, Math.min(0.3, b.vz * 0.04));
      const s = R_BALAO * (1.15 - Math.min(0.55, alt * 0.09));
      sombras[n].position.set(b.x, 0.07, b.z); sombras[n].scale.set(s, 1, s);
      const q = queda(p, b), pulso = 1 + Math.sin(t * 9 + n) * 0.1;
      marcas[n].visible = !murcho;
      marcas[n].position.set(q.x, 0.12, q.z); marcas[n].scale.set(pulso, 1, pulso);
    });

    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const f = d.fx[pecas.visto];
      if (f.tipo === 'chao') { c.particulas(f.x, f.y, f.z, corDono(c, f.i), 30, 10); c.particulas(f.x, f.y, f.z, 0xffffff, 12, 6); }
      else if (f.tipo === 'bate') { c.particulas(f.x, f.y, f.z, times(p) ? c.times[timeDe(p, f.i)] : c.cores[f.i], 12, 7); c.particulas(f.x, f.y, f.z, 0xffffff, 6, 5); }
      else c.particulas(f.x, f.y, f.z, 0xffffff, 6, 4);
    }
  },
};
