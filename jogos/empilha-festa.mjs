// Empilha da festa (todos contra todos ou times). Cada um tem a sua torre, lado a lado, e um bloco que balança em cima dela:
// aperte para soltar. O que passar da borda é cortado e cai, e o bloco seguinte fica mais estreito. Errar o bloco inteiro só
// perde o bloco (e um tempinho). Em 30 s vence a torre mais alta; em times vale a soma das duas torres do time.
// O boneco de cada um sobe num elevador atrás da própria torre, para a câmera (que acompanha a mais alta) mostrar quem é quem.
import { timeDe, quem, elimina, RAIO } from '../logica.mjs';

export const TEMPO = 30, L0 = 1.7, AMP = 1.95, ESP = 5.6;
const H = 0.45, PROF = 1.8, Z_BONECO = -2.3;
const V0 = 2, DV = 0.22, V_MAX = 5.5, PERFEITO = 0.08, MINIMO = 0.05, ESPERA = 0.25, ESPERA_ERRO = 0.9, T_RECADO = 0.9;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const emTimes = p => p.modo === 'times';
const dono = (p, i) => (emTimes(p) ? timeDe(p, i) : i);
const lugar = (i, n) => (i - (n - 1) / 2) * ESP;
const velocidade = andares => Math.min(V_MAX, V0 + DV * andares);

function soma(p) {
  const d = p.dados, t = emTimes(p) ? [0, 0] : d.andares.map(() => 0);
  d.andares.forEach((a, i) => { t[dono(p, i)] += a; });
  return t;
}

function celulares(p, fim) {
  const d = p.dados;
  p.jogadores.forEach((_, i) => {
    const andares = `Andares: ${d.andares[i]}` + (emTimes(p) ? ` (time: ${d.placar[dono(p, i)]})` : '');
    const t = fim ? fim[i] : (d.tRecado[i] > 0 ? d.recado[i] + ' ' : '') + andares;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Solta o bloco do jogador i em cima da torre dele.
function solta(p, i) {
  const d = p.dados, e = d.e[i], topo = e.blocos[e.blocos.length - 1];
  const nivel = e.blocos.length * H + H / 2, fora = e.bx - topo.x, sinal = Math.sign(fora || 1);
  const ae = Math.max(topo.x - topo.l / 2, e.bx - e.l / 2), ad = Math.min(topo.x + topo.l / 2, e.bx + e.l / 2);
  const sobra = ad - ae;
  e.dir = -e.dir;                                                    // o próximo vem do lado oposto
  if (sobra <= MINIMO && Math.abs(fora) > PERFEITO) {                // errou tudo: o bloco inteiro cai e a torre fica igual
    d.cortes.push({ i, x: e.bx, y: nivel, l: e.l, vx: 1.5 * sinal, vy: 2, rot: 0, vr: 2 * sinal, t: 0 });
    p.eventos.push('queda');
    d.recado[i] = 'Errou o bloco!'; d.tRecado[i] = T_RECADO;
    p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
    e.espera = ESPERA_ERRO; e.bx = e.dir > 0 ? -AMP : AMP;
    return;
  }
  if (Math.abs(fora) <= PERFEITO) {                                  // quase no centro: encaixa sem cortar
    e.blocos.push({ x: topo.x, l: topo.l });
    d.recado[i] = 'Perfeito!'; d.tRecado[i] = T_RECADO;
    d.fx.push({ i, y: nivel });
    p.eventos.push('moeda');
  } else {
    const borda = e.bx + sinal * e.l / 2, lim = sinal < 0 ? ae : ad;
    d.cortes.push({ i, x: (borda + lim) / 2, y: nivel, l: Math.abs(borda - lim), vx: 1.5 * sinal, vy: 1, rot: 0, vr: -3 * sinal, t: 0 });
    e.blocos.push({ x: (ae + ad) / 2, l: sobra });
    p.eventos.push('batida');
  }
  d.andares[i] = e.blocos.length - 1;
  e.l = e.blocos[e.blocos.length - 1].l; e.v = velocidade(d.andares[i]); e.espera = ESPERA;
  e.bx = e.dir > 0 ? -AMP : AMP;
}

// Estado final da tela e dos celulares, escrito antes de devolver o resultado.
function fecha(p) {
  const d = p.dados, maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
  const v = lideres.length === 1 ? lideres[0] : -1;
  d.aviso = v < 0 ? 'Empate!' : (emTimes(p) ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff';
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : dono(p, i) === v ? 'Você venceu!' : emTimes(p) ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  if (v >= 0) p.jogadores.forEach((j, i) => { if (dono(p, i) !== v) elimina(p, j); });       // quem perdeu sai voando
  return v;
}

export default {
  id: 'empilha-festa', genero: 'equilibrio', nome: 'Empilha da festa',
  dica: 'Aperte para soltar o bloco em cima da sua torre, porque o que passar da borda cai e a torre mais alta vence.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'botao', a: 'Solta' }, semMovimento: true, semDash: true, semPulo: true, rotulo: 'andares', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: 11, lz: 4, parede: true };
    p.jogadores.forEach((j, i) => { j.x = lugar(i, n); j.z = Z_BONECO; });
    p.dados = {
      andares: Array(n).fill(0), placar: [], cortes: [], fx: [], aviso: '', avisoCor: '#ffffff',
      recado: Array(n).fill(''), tRecado: Array(n).fill(0),
      // os blocos saem de lados alternados, para as torres não balançarem todas juntas
      e: p.jogadores.map((_, i) => ({ blocos: [{ x: 0, l: L0 }], dir: i % 2 ? -1 : 1, bx: i % 2 ? AMP : -AMP, v: V0, l: L0, espera: 0.8 })),
    };
    p.dados.placar = soma(p);
    if (emTimes(p)) p.dados.inventario = p.dados.andares.map(a => ['Andares ' + a]);
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    p.jogadores.forEach((j, i) => {
      const e = d.e[i];
      Object.assign(j, { x: lugar(i, n), z: Z_BONECO, vx: 0, vz: 0 });
      d.tRecado[i] = Math.max(0, d.tRecado[i] - dt);
      if (e.espera > 0) e.espera -= dt;                              // logo depois de soltar, toque não vale (evita erro por toque duplo)
      else if (j.apertouA > 0) solta(p, i);
      if (e.espera > 0) return;
      e.bx += e.dir * e.v * dt;
      if (e.bx > AMP) { e.bx = AMP; e.dir = -1; }
      else if (e.bx < -AMP) { e.bx = -AMP; e.dir = 1; }
    });
    for (const c of d.cortes) { c.t += dt; c.vy -= 25 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.rot += c.vr * dt; }
    d.cortes = d.cortes.filter(c => c.t < 1.8);
    d.placar = soma(p);
    if (emTimes(p)) d.inventario = d.andares.map(a => ['Andares ' + a]);
    celulares(p);
    if (p.t >= TEMPO) return fecha(p);
  },

  // Câmera de frente, um pouco acima do topo da torre mais alta, e mais longe quanto mais torres houver.
  camera(p) {
    const e = p.dados?.e;
    if (!e) return null;
    const topo = Math.max(...e.map(x => x.blocos.length)) * H;
    return { x: 0, y: topo + 7.5, z: 11 + e.length * 2.3, ox: 0, oy: Math.max(0.6, topo - 0.6), oz: -0.5 };
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, n = p.jogadores.length;
    const cor = i => (emTimes(p) ? c.times[timeDe(p, i)] : c.cores[i]);
    pecas.cor = cor; pecas.tinta = new THREE.Color(); pecas.elev = [];
    p.jogadores.forEach((_, i) => {
      const x = lugar(i, n), larg = 2 * AMP + L0 - 0.3;
      const base = malha(new THREE.BoxGeometry(larg, 0.3, PROF + 1.2), 0x3a3f5c, { roughness: 0.8 }); base.position.set(x, -0.14, 0);
      const faixa = malha(new THREE.BoxGeometry(larg, 0.06, 0.3), cor(i), { emissive: cor(i), emissiveIntensity: 0.6 });
      faixa.position.set(x, 0.04, PROF / 2 + 0.4); faixa.castShadow = false;
      // elevador de obra atrás da torre: o mastro estica e o estrado leva o boneco até o topo
      const mastro = malha(new THREE.BoxGeometry(0.3, 1, 0.3), 0xf2b21c, { roughness: 0.6 }); mastro.position.set(x, 0, Z_BONECO - 1.1);
      const estrado = malha(new THREE.BoxGeometry(2, 0.18, 1.9), 0x8d95ad, { roughness: 0.7 }); estrado.position.set(x, 0, Z_BONECO);
      grupo.add(base, faixa, mastro, estrado);
      pecas.elev.push({ mastro, estrado, y: 0 });
    });
  },

  desenha(c, dt, t) {
    const { THREE, pecas, p } = c, d = p.dados, n = p.jogadores.length, tinta = pecas.tinta;
    p.jogadores.forEach((j, i) => {
      const e = d.e[i], x0 = lugar(i, n), k = e.blocos.length + 1;
      const lista = c.pool('torre' + i, k, () => c.malha(new THREE.BoxGeometry(1, H, PROF), 0xffffff, { roughness: 0.5 }));
      lista.forEach((m, q) => {
        if (q >= k) return;                                          // peças a mais do pool ficam escondidas
        const movel = q >= e.blocos.length, b = movel ? { x: e.bx, l: e.l } : e.blocos[q];
        m.position.set(x0 + b.x, q * H + H / 2, 0);
        m.scale.set(Math.max(0.01, b.l), 1, 1);
        tinta.set(pecas.cor(i)).offsetHSL(0, 0, (q % 2 ? 0.08 : -0.06) + (movel ? 0.1 : 0));
        m.material.color.copy(tinta); m.material.emissive.copy(tinta); m.material.emissiveIntensity = movel ? 0.5 : 0.12;
        m.visible = !(movel && e.espera > 0);
      });
      // o elevador sobe macio até a altura da torre e o boneco vai em cima dele
      const el = pecas.elev[i], alvo = e.blocos.length * H;
      el.y += (alvo - el.y) * Math.min(1, dt * 8);
      el.estrado.position.y = el.y - 0.09;
      el.mastro.scale.y = Math.max(0.01, el.y + 0.3); el.mastro.position.y = (el.y + 0.3) / 2 - 0.3;
      c.bonecos[i].position.y = RAIO + j.y + el.y;
    });
    const caem = c.pool('cortes', d.cortes.length, () => c.malha(new THREE.BoxGeometry(1, H, PROF), 0xffffff));
    d.cortes.forEach((q, k) => {
      const m = caem[k];
      m.position.set(lugar(q.i, n) + q.x, q.y, 0); m.scale.set(Math.max(0.01, q.l), 1, 1); m.rotation.z = q.rot;
      tinta.set(pecas.cor(q.i)).offsetHSL(0, 0, -0.12); m.material.color.copy(tinta);
    });
    for (const f of d.fx.splice(0)) c.particulas(lugar(f.i, n), f.y, PROF / 2, 0xffe680, 14, 6);
  },
};
