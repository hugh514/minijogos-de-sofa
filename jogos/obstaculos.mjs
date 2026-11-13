// Pista maluca: cada um na sua esteira, lado a lado. O boneco corre sozinho (parado na tela) e os obstaculos vem do fundo.
// Bloco vermelho: desvie para o lado. Barra amarela: pule (B). Os dois recebem exatamente a mesma sequencia.
import { RAIO, elimina, quemSobrou, maiorPlacar } from '../logica.mjs';

export const CENTRO = [-4.5, 4.5], MEIA = 3.5, Z_BONECO = 4.5, Z_NASCE = -7.4, Z_SOME = 6.2;
export const VIDAS = 3, LIMITE = 45, T_IMUNE = 1;
const V0 = 6, ACELERA = 0.17, FOLGA = 0.55, ALTURA_BARRA = 0.45;
export const velocidade = t => V0 + ACELERA * t;

// Fileiras possiveis: uma barra baixa de ponta a ponta ou blocos altos (intervalos de x dentro da raia).
const PADROES = [
  { blocos: [[-MEIA, 0.6]] }, { blocos: [[-0.6, MEIA]] }, { blocos: [[-1.6, 1.6]] }, { blocos: [[-MEIA, -1.4], [1.4, MEIA]] },
];

// A fileira "o" pega o boneco que esta em x (dentro da raia) e altura y?
export function bate(o, x, y) {
  if (Math.abs(o.z - Z_BONECO) > (o.barra ? 0.5 : 0.8)) return false;
  if (o.barra) return y < ALTURA_BARRA;
  return o.blocos.some(([x0, x1]) => x > x0 - FOLGA && x < x1 + FOLGA);
}

export default {
  id: 'obstaculos', nome: 'Pista maluca', dica: 'Desvie dos blocos vermelhos e pule as barras amarelas. Quem perder as 3 vidas sai voando!',
  rotulo: 'vidas', duracao: LIMITE, semDash: true,
  controle: { modo: 'padrao', a: '· · ·', b: 'PULA' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 8.5, lz: 8, parede: true };
    p.jogadores.forEach((j, i) => { j.x = CENTRO[i]; j.z = Z_BONECO; j.turbo = 1.5; });
    p.dados = { pista: [], falta: 6, andou: 0, placar: [VIDAS, VIDAS], imune: [0, 0], fx: [] };
  },

  atualiza(p, dt) {
    const d = p.dados, v = velocidade(p.t);
    d.andou += v * dt; d.falta -= v * dt;
    if (d.falta <= 0) {                                        // nova fileira, igual para os dois
      const o = p.rng() < 0.3 ? { barra: true } : PADROES[Math.floor(p.rng() * PADROES.length) % PADROES.length];
      d.pista.push({ ...o, z: Z_NASCE });
      d.falta += 9 - Math.min(2, p.t * 0.04);
    }
    for (const o of d.pista) o.z += v * dt;
    d.pista = d.pista.filter(o => o.z < Z_SOME);

    p.jogadores.forEach((j, i) => {
      // o boneco fica preso na propria raia; so anda para os lados
      const min = CENTRO[i] - MEIA + RAIO, max = CENTRO[i] + MEIA - RAIO;
      if (j.x < min) { j.x = min; j.vx = Math.max(0, j.vx); }
      if (j.x > max) { j.x = max; j.vx = Math.min(0, j.vx); }
      j.z = Z_BONECO; j.vz = 0;

      d.imune[i] = Math.max(0, d.imune[i] - dt);
      if (d.imune[i] > 0 || !d.pista.some(o => bate(o, j.x - CENTRO[i], j.y))) return;
      d.placar[i]--; d.imune[i] = T_IMUNE;
      p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
      if (d.fx.length < 12) d.fx.push({ x: j.x, i });
      if (d.placar[i] <= 0) { elimina(p, j, 12); j.vz = 6; p.eventos.push('explosao'); }
      else p.eventos.push('batida');
    });

    return quemSobrou(p) ?? (p.t > LIMITE ? maiorPlacar(p) : undefined);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores, p } = c;
    const a = p.arena;
    const caixa = (lx, ly, lz, cor, x, y, z, extra) => {
      const m = malha(new THREE.BoxGeometry(lx, ly, lz), cor, extra); m.position.set(x, y, z); grupo.add(m);
      return m;
    };
    pecas.listras = []; pecas.vidas = [[], []];
    CENTRO.forEach((cx, i) => {
      caixa(MEIA * 2, 0.02, a.lz * 2, 0x353b4d, cx, 0.01, 0, { roughness: 0.9 }).castShadow = false;      // esteira
      for (const s of [-1, 1])                                                                               // guias na cor do dono
        caixa(0.3, 0.35, a.lz * 2, cores[i], cx + s * (MEIA + 0.15), 0.175, 0, { emissive: cores[i], emissiveIntensity: 0.3 });
      for (let k = 0; k < 8; k++) {                                                                          // listras que correm com a esteira
        const l = caixa(MEIA * 2, 0.02, 0.35, k % 4 ? 0x4a5268 : cores[i], cx, 0.03, 0, k % 4 ? {} : { transparent: true, opacity: 0.6 });
        l.castShadow = false; pecas.listras.push({ l, k });
      }
      const marca = caixa(1.9, 0.02, 0.12, 0xffffff, cx, 0.04, Z_BONECO + 1.1, { transparent: true, opacity: 0.35 });
      marca.castShadow = false;
      for (let k = 0; k < VIDAS; k++) {                                                                      // vidas: bolas vermelhas na beira da frente
        const vida = malha(new THREE.SphereGeometry(0.38, 16, 12), 0xff3b4a, { emissive: 0xff1a2a, emissiveIntensity: 0.6 });
        vida.position.set(cx + (k - 1) * 1.1, 0.5, a.lz - 0.9); grupo.add(vida); pecas.vidas[i].push(vida);
      }
    });
    caixa(CENTRO[1] - CENTRO[0] - MEIA * 2 - 0.6, 0.5, a.lz * 2, 0x1c2030, 0, 0.25, 0);                      // canteiro entre as duas raias
    for (let k = 0; k < 8; k++) caixa(0.5, 0.06, 0.9, 0xffd84d, 0, 0.5, -a.lz + 1 + k * 2, { emissive: 0x6b5200 });
    const portal = caixa(a.lx * 2, 1.2, 0.5, 0x8a5cff, 0, 2.6, -a.lz - 0.2, { emissive: 0x3a1a7a, emissiveIntensity: 0.7 });   // de onde saem os obstaculos
    portal.castShadow = false;
    for (const x of [-a.lx, 0, a.lx]) caixa(0.5, 3.2, 0.5, 0x59627f, x, 1.6, -a.lz - 0.2);
  },

  desenha(c, dt, t) {
    const { THREE, malha, pecas, p } = c, d = p.dados;
    for (const { l, k } of pecas.listras) l.position.z = ((k * 2 + d.andou) % 16) - 8;

    // obstaculos: a mesma fileira aparece nas duas raias
    const blocos = [], barras = [];
    for (const o of d.pista)
      for (const cx of CENTRO) {
        if (o.barra) barras.push({ x: cx, z: o.z });
        else for (const [x0, x1] of o.blocos) blocos.push({ x: cx + (x0 + x1) / 2, z: o.z, lx: x1 - x0 });
      }
    const nasce = z => Math.min(1, Math.max(0.05, (z - Z_NASCE) / 2.5), Math.max(0.05, Z_SOME - z));      // sobe do chao ao entrar e afunda ao sair
    const mb = c.pool('blocos', blocos.length, () => malha(new THREE.BoxGeometry(1, 1.7, 1), 0xe5383b, { emissive: 0x7a0a0a, emissiveIntensity: 0.6 }));
    blocos.forEach((b, n) => { const s = nasce(b.z); mb[n].scale.set(b.lx - 0.1, s, 1); mb[n].position.set(b.x, 0.85 * s, b.z); });
    const mr = c.pool('barras', barras.length, () => {
      const g = new THREE.Group();
      const trave = malha(new THREE.BoxGeometry(MEIA * 2 - 0.1, 0.3, 0.3), 0xffd84d, { emissive: 0x8a6a00, emissiveIntensity: 0.8 }); trave.position.y = 0.4; g.add(trave);
      for (let k = -3; k <= 3; k++) { const pe = malha(new THREE.BoxGeometry(0.32, 0.55, 0.34), k % 2 ? 0x111111 : 0xffd84d); pe.position.set(k * 1.05, 0.275, 0); g.add(pe); }
      return g;
    });
    barras.forEach((b, n) => { mr[n].position.set(b.x, 0, b.z); mr[n].scale.y = nasce(b.z); });

    p.jogadores.forEach((j, i) => {
      const b = c.bonecos[i];
      b.visible = !j.vivo || p.fase !== 'jogando' || d.imune[i] <= 0 || Math.floor(t * 14) % 2 === 0;        // pisca enquanto esta invulneravel
      const corpo = b.userData?.corpo;
      if (corpo && j.vivo) corpo.rotation.y = Math.PI - Math.max(-0.6, Math.min(0.6, j.vx * 0.06));   // corre de costas para a camera, virando um pouco
      pecas.vidas[i].forEach((vida, k) => {
        vida.visible = k < d.placar[i];
        vida.position.y = 0.5 + Math.abs(Math.sin(t * 4 + k)) * 0.15;
      });
      if (j.vivo && j.y === 0 && p.fase === 'jogando' && Math.random() < 0.15) c.particulas(j.x, 0.1, j.z + 0.7, 0xb8c0d8, 1, 2);   // poeira da corrida
    });
    for (const f of d.fx.splice(0)) {
      c.particulas(f.x, 1, Z_BONECO, 0xffffff, 10, 9); c.particulas(f.x, 1, Z_BONECO, c.cores[f.i], 12, 7);
      if (d.placar[f.i] <= 0) c.particulas(f.x, 1, Z_BONECO, 0xff7a2f, 30, 12);
    }
  },
};
