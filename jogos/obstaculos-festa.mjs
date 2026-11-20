// Corrida de obstaculos (Festa: todos contra todos ou times). Versao para 2 a 4 da Pista maluca: uma raia por jogador, lado a lado.
// Todos correm sozinhos ao mesmo tempo, na mesma pista: B pula a barreira, o joystick desvia da pilha de pneus. Quem bate tropeca
// (para um instante e perde terreno). A tela acompanha o pelotao: quem esta na frente aparece mais acima, e quem fica mais de
// 6 m atras do lider e puxado junto (da para virar ate o fim). Vence quem cruza a chegada primeiro; em times, quando o primeiro
// cruza vale a soma das distancias da dupla. No fim do tempo vence quem (ou a dupla que) foi mais longe.
import { timeDe, quem, RAIO } from '../logica.mjs';

export const META = 170, LIMITE = 45, ATRASO_MAX = 6;
export const LARGURA = 5.4, MEIA = 2.4;
const V0 = 5, ACELERA = 0.06, RETOMA = 8, T_TONTO = 0.5, T_IMUNE = 1.1;
const FOLGA = 0.5, ALTURA_BARRA = 0.45, FUNDO = 0.5, LZ = 9, Z_MEIO = 3.5;
const BLOCOS = [[[-MEIA, -0.1]], [[0.1, MEIA]]];          // pneus na metade esquerda ou na direita da raia
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

export const centroDe = (n, i) => (i - (n - 1) / 2) * LARGURA;
export const velocidade = t => V0 + ACELERA * t;
const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);
const corDe = (c, i) => (c.p.modo === 'times' ? c.times[timeDe(c.p, i)] : c.cores[i]);

// O obstaculo "o" pega quem esta em x (medido do meio da raia) e na altura y?
export function bate(o, x, y) {
  if (o.barra) return y < ALTURA_BARRA;
  return o.blocos.some(([x0, x1]) => x > x0 - FOLGA && x < x1 + FOLGA);
}

// Distancia por dono do placar: de cada um, ou a soma da dupla.
function totais(p) {
  const d = p.dados, de = dono(p), t = Array(p.modo === 'times' ? 2 : p.jogadores.length).fill(0);
  d.dist.forEach((v, i) => { t[de(i)] += v; });
  return t;
}

function celulares(p, fim) {
  const d = p.dados;
  p.jogadores.forEach((_, i) => {
    const lugar = 1 + d.dist.filter(v => v > d.dist[i] + 0.05).length, falta = Math.max(0, Math.ceil((META - d.dist[i]) / 10) * 10);
    const t = fim ? fim[i] : `${lugar}º lugar. Faltam ${falta} m`;
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
  id: 'obstaculos-festa', genero: 'corrida', nome: 'Corrida de obstáculos',
  dica: 'Pule as barreiras com B e desvie dos pneus com o joystick para cruzar a chegada primeiro.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: '', b: 'Pula' }, semDash: true,
  rotulo: 'metros', duracao: LIMITE, tema: 0,
  semNome: true,        // o nome flutuante ficaria em cima do obstaculo que vem na frente; a raia ja tem a cor do dono
  // Camera propria, mais perto que a padrao: a pista enche a tela e os obstaculos ficam grandes.
  camera() { return { x: 0, y: 19.5, z: 16, ox: 0, oy: 0, oz: 1 }; },

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: n * LARGURA / 2 + 0.2, lz: LZ, parede: true };
    p.jogadores.forEach((j, i) => { j.x = centroDe(n, i); j.z = Z_MEIO; j.turbo = 1.4; });
    // a mesma pista para todos: barreira (pula) ou pneus de um lado (desvia), a cada 6 a 9 m
    const pista = [];
    for (let s = 14; s < META - 8; s += 6 + p.rng() * 3) {
      const r = p.rng();
      pista.push({ s, ...(r < 0.45 ? { barra: true } : { blocos: BLOCOS[r < 0.725 ? 0 : 1] }), caiu: Array(n).fill(false) });
    }
    p.dados = {
      pista, dist: Array(n).fill(0), vel: Array(n).fill(V0), tonto: Array(n).fill(0), imune: Array(n).fill(0), prox: Array(n).fill(0),
      ref: 0, placar: [], fx: [], aviso: '',
    };
    p.dados.placar = totais(p).map(Math.floor);
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, n = js.length, v = velocidade(p.t);
    d.aviso = p.t < 2.5 ? (p.modo === 'times' ? 'Vale a soma da dupla!' : 'Pule e desvie!') : '';

    js.forEach((j, i) => {
      // cada um preso na propria raia: o joystick so anda para os lados
      const cx = centroDe(n, i), min = cx - MEIA + RAIO, max = cx + MEIA - RAIO;
      if (j.x < min) { j.x = min; j.vx = Math.max(0, j.vx); }
      if (j.x > max) { j.x = max; j.vx = Math.min(0, j.vx); }

      d.tonto[i] = Math.max(0, d.tonto[i] - dt); d.imune[i] = Math.max(0, d.imune[i] - dt);
      d.vel[i] = d.tonto[i] > 0 ? 0 : Math.min(v, d.vel[i] + RETOMA * dt);
      d.dist[i] += d.vel[i] * dt;

      let o;
      while ((o = d.pista[d.prox[i]]) && d.dist[i] > o.s + FUNDO) d.prox[i]++;          // passou
      if (!o || d.dist[i] < o.s - FUNDO || d.imune[i] > 0 || !bate(o, j.x - cx, j.y)) return;
      o.caiu[i] = true; d.prox[i]++;
      d.tonto[i] = T_TONTO; d.imune[i] = T_IMUNE; d.vel[i] = 0;
      if (d.fx.length < 12) d.fx.push({ i, barra: !!o.barra });
      p.eventos.push('batida');
      p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
    });

    const lider = Math.max(...d.dist);
    d.dist = d.dist.map(x => Math.max(x, lider - ATRASO_MAX));                            // o pelotao puxa quem ficou muito para tras
    d.ref = (lider + Math.min(...d.dist)) / 2;                                           // a tela acompanha o meio do pelotao
    js.forEach((j, i) => { j.z = Z_MEIO + d.ref - d.dist[i]; j.vz = 0; });

    const t = totais(p);
    d.placar = t.map(Math.floor);
    celulares(p);
    if (lider >= META || p.t >= LIMITE) {
      const maior = Math.max(...t), lideres = t.flatMap((x, k) => (x === maior ? [k] : []));
      return fechaComo(p, lideres.length === 1 ? lideres[0] : -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, n = p.jogadores.length, larg = n * LARGURA;
    const caixa = (lx, ly, lz, cor, x, y, z, extra) => {
      const m = malha(new THREE.BoxGeometry(lx, ly, lz), cor, extra); m.position.set(x, y, z); m.castShadow = false; grupo.add(m);
      return m;
    };
    // pista de atletismo: piso cor de tijolo, uma raia por jogador com a guia na cor do dono (ou do time)
    caixa(larg, 0.04, LZ * 2, 0xa8503a, 0, 0.02, 0, { roughness: 0.95 }).receiveShadow = true;
    p.jogadores.forEach((_, i) => {
      const cx = centroDe(n, i), cor = corDe(c, i);
      for (const s of [-1, 1]) caixa(0.22, 0.3, LZ * 2, cor, cx + s * (LARGURA / 2 - 0.13), 0.15, 0, { emissive: cor, emissiveIntensity: 0.3 });
      caixa(1.6, 0.03, 0.5, cor, cx, 0.06, LZ - 0.5, { emissive: cor, emissiveIntensity: 0.4 });      // marca do dono no pe da raia
    });
    pecas.riscos = Array.from({ length: 6 }, () => caixa(larg, 0.02, 0.16, 0xffffff, 0, 0.05, 0, { transparent: true, opacity: 0.45 }));     // riscos que correm com a pista
    // chegada: faixa quadriculada de ponta a ponta e uma bandeira de cada lado
    const g = pecas.chegada = new THREE.Group();
    const colunas = Math.round(larg / 0.9), lado = larg / colunas;
    for (let k = 0; k < colunas; k++) for (const f of [0, 1]) {
      const q = malha(new THREE.BoxGeometry(lado, 0.05, 0.8), (k + f) % 2 ? 0x16161c : 0xffffff, { roughness: 0.6 });
      q.position.set(-larg / 2 + lado * (k + 0.5), 0.07, (f - 0.5) * 0.8); q.castShadow = false; g.add(q);
    }
    for (const s of [-1, 1]) {
      const mastro = malha(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 8), 0xf2f2f2); mastro.position.set(s * (larg / 2 + 0.5), 1.3, 0);
      const pano = malha(new THREE.BoxGeometry(1.1, 0.7, 0.06), 0xffffff, { emissive: 0x555555 }); pano.position.set(s * (larg / 2 + 0.5) + 0.55, 2.2, 0);
      const quadro = malha(new THREE.BoxGeometry(0.55, 0.35, 0.08), 0x16161c); quadro.position.set(s * (larg / 2 + 0.5) + 0.28, 2.37, 0);
      g.add(mastro, pano, quadro);
    }
    grupo.add(g);
  },

  desenha(c, dt, t) {
    const { THREE, malha, pecas, p } = c, d = p.dados, js = p.jogadores, n = js.length;
    const zDe = s => Z_MEIO + d.ref - s;                    // onde um ponto da pista aparece na tela
    pecas.riscos.forEach((m, k) => { m.position.z = ((k * 6 + d.ref) % 36 + 36) % 36 - 18; m.visible = Math.abs(m.position.z) < LZ; });
    pecas.chegada.position.z = zDe(META); pecas.chegada.visible = Math.abs(zDe(META)) < LZ - 0.4;

    // a mesma fileira aparece em todas as raias; barreira derrubada fica deitada e pneu batido se espalha
    const barras = [], pneus = [];
    for (const o of d.pista) {
      const z = zDe(o.s);
      if (Math.abs(z) > LZ - 0.6) continue;
      js.forEach((_, i) => {
        const cx = centroDe(n, i);
        if (o.barra) barras.push({ x: cx, z, caiu: o.caiu[i] });
        else for (const [x0, x1] of o.blocos) pneus.push({ x: cx + (x0 + x1) / 2, z, caiu: o.caiu[i] });
      });
    }
    const entra = z => Math.min(1, Math.max(0.05, (z + LZ - 0.6) / 2), Math.max(0.05, (LZ - 0.6 - z) / 1.2));      // sobe do chao ao entrar e afunda ao sair
    const mb = c.pool('barras', barras.length, () => {
      const g = new THREE.Group(), tabua = new THREE.Group();
      for (let k = 0; k < 7; k++) {       // tabua listrada de branco e preto
        const m = malha(new THREE.BoxGeometry((MEIA * 2 - 0.5) / 7, 0.34, 0.14), k % 2 ? 0x16161c : 0xffffff, { emissive: k % 2 ? 0x000000 : 0x555555 });
        m.position.x = (k - 3) * (MEIA * 2 - 0.5) / 7; tabua.add(m);
      }
      tabua.position.y = 0.62;
      for (const s of [-1, 1]) { const pe = malha(new THREE.BoxGeometry(0.16, 0.8, 0.5), 0xdfe3ea); pe.position.set(s * (MEIA - 0.3), 0.4, 0); g.add(pe); }
      g.add(tabua);
      return g;
    });
    barras.forEach((b, k) => { const g = mb[k]; g.position.set(b.x, 0, b.z); g.scale.y = b.caiu ? 0.2 : entra(b.z); g.rotation.x = b.caiu ? -0.3 : 0; });
    const mp = c.pool('pneus', pneus.length, () => {
      const g = new THREE.Group();
      for (let col = -1; col <= 1; col++) for (let andar = 0; andar < 4; andar++) {
        const pneu = malha(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12), 0x1d2028, { roughness: 0.9 }); pneu.position.set(col * 0.8, 0.18 + andar * 0.35, 0);
        const faixa = malha(new THREE.CylinderGeometry(0.43, 0.43, 0.1, 12), andar % 2 ? 0xe5383b : 0xffffff, { emissive: andar % 2 ? 0x7a0a0a : 0x666666 }); faixa.position.copy(pneu.position);
        g.add(pneu, faixa);
      }
      return g;
    });
    pneus.forEach((b, k) => { const g = mp[k]; g.position.set(b.x, 0, b.z); g.scale.set(1, b.caiu ? 0.35 : entra(b.z), b.caiu ? 1.6 : 1); });

    js.forEach((j, i) => {
      const b = c.bonecos[i];
      b.visible = p.fase !== 'jogando' || d.imune[i] <= 0 || Math.floor(t * 14) % 2 === 0;       // pisca depois do tropeco
      const corpo = b.userData?.corpo;
      if (corpo) corpo.rotation.y = Math.PI - Math.max(-0.6, Math.min(0.6, j.vx * 0.06));         // corre de costas para a camera
      if (j.y === 0 && d.vel[i] > 1 && p.fase === 'jogando' && Math.random() < 0.15) c.particulas(j.x, 0.1, j.z + 0.7, 0xe8c9b0, 1, 2);   // poeira
    });
    for (const f of d.fx.splice(0)) {
      const j = js[f.i];
      c.particulas(j.x, 1, j.z, 0xffffff, 12, 8); c.particulas(j.x, 0.6, j.z - 0.4, f.barra ? 0xdfe3ea : 0x1d2028, 10, 6);
      c.som(f.barra ? 240 : 130, 0.18, 'square', 0.18);
    }
  },
};
