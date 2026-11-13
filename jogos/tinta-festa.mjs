// Tinta na Tela (Festa: todos contra todos ou times). Um quadro em branco, um pincel debaixo de cada pé: pinte o chão passando por cima.
// Em 40 s ganha quem (ou o time) tiver mais área. Quem passa por último é o dono do ladrilho; o balde de tinta
// que aparece de vez em quando faz uma mancha grande e é a virada. O placar de cima mostra a porcentagem do chão.
import { posicionaCantos, timeDe, RAIO } from '../logica.mjs';

export const LX = 9, LZ = 7, COLS = 18, LINS = 14, TEMPO = 40;
const R_PINCEL = 1.25, R_BALDE = 3.5, T_BALDE = 12, PRIMEIRO_BALDE = 6, ENTRE_BALDES = 7;
const TOTAL = COLS * LINS;
const NEUTRO = 0xd9d3c4;       // tela em branco

export const indice = (x, z) => Math.min(COLS - 1, Math.max(0, Math.floor(x + LX))) * LINS + Math.min(LINS - 1, Math.max(0, Math.floor(z + LZ)));
const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o ladrilho: do jogador ou do time

function pinta(d, k, de) {
  const antes = d.cor[k];
  if (antes === de) return;
  if (antes >= 0) d.conta[antes]--;
  d.cor[k] = de; d.conta[de]++;
}
// Pinta todo ladrilho cujo centro esta a menos de "raio" do ponto.
function borrifa(d, x, z, raio, de) {
  const i0 = Math.max(0, Math.floor(x - raio + LX)), i1 = Math.min(COLS - 1, Math.floor(x + raio + LX));
  const k0 = Math.max(0, Math.floor(z - raio + LZ)), k1 = Math.min(LINS - 1, Math.floor(z + raio + LZ));
  for (let i = i0; i <= i1; i++)
    for (let k = k0; k <= k1; k++)
      if (Math.hypot(-LX + 0.5 + i - x, -LZ + 0.5 + k - z) < raio) pinta(d, i * LINS + k, de);
}

export default {
  id: 'tinta-festa', nome: 'Tinta na Tela', dica: 'Pinte o chão passando por cima. Quem tiver mais área em 40 segundos vence!',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'ARRANCA', b: '' }, semPulo: true,
  rotulo: 'do chão', sufixo: '%', duracao: TEMPO,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posicionaCantos(p, 6, 4);
    const donos = p.modo === 'times' ? 2 : p.jogadores.length;
    p.dados = { cor: Array(TOTAL).fill(-1), conta: Array(donos).fill(0), placar: Array(donos).fill(0), balde: null, proxBalde: PRIMEIRO_BALDE, fx: [] };
  },

  atualiza(p, dt) {
    const d = p.dados, de = dono(p);
    p.jogadores.forEach((j, i) => { if (j.vivo && j.y <= 0.05) borrifa(d, j.x, j.z, R_PINCEL, de(i)); });

    // balde de tinta: aparece num ponto livre, some se ninguem pegar, e quem toca faz uma mancha enorme
    if (d.balde) {
      d.balde.t -= dt;
      const pegaram = p.jogadores.flatMap((j, k) => (j.vivo && j.y <= 0.8 && Math.hypot(j.x - d.balde.x, j.z - d.balde.z) < RAIO + 0.9 ? [k] : []));
      if (pegaram.length) {
        const i = pegaram[Math.floor(p.rng() * pegaram.length)];       // dois no mesmo quadro: sorteia, sem favorecer o J1
        borrifa(d, d.balde.x, d.balde.z, R_BALDE, de(i));
        d.fx.push({ tipo: 'mancha', x: d.balde.x, z: d.balde.z, dono: de(i) });
        p.eventos.push('explosao');
        d.balde = null; d.proxBalde = ENTRE_BALDES;
      } else if (d.balde.t <= 0) { d.balde = null; d.proxBalde = 4; }
    } else {
      d.proxBalde -= dt;
      if (d.proxBalde <= 0) { d.balde = { x: (p.rng() * 2 - 1) * (LX - 2.5), z: (p.rng() * 2 - 1) * (LZ - 2.5), t: T_BALDE }; p.eventos.push('troca'); }
    }

    d.placar = d.conta.map(c => c * 100 / TOTAL);
    p.jogadores.forEach((_, i) => {       // o celular repete a porcentagem
      const t = (p.modo === 'times' ? 'Seu time: ' : 'Você: ') + Math.round(d.placar[de(i)]) + '% do chão';
      if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
    });
    if (p.t >= TEMPO) {
      const maior = Math.max(...d.conta), lideres = d.conta.flatMap((c, k) => (c === maior ? [k] : []));
      return lideres.length === 1 ? lideres[0] : -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    // ladrilhos do chao: uma malha instanciada, cada um com a propria cor
    const geo = new THREE.BoxGeometry(0.94, 0.1, 0.94);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const chao = pecas.chao = new THREE.InstancedMesh(geo, mat, TOTAL);
    chao.receiveShadow = true;
    const m = new THREE.Matrix4(), cor = new THREE.Color(NEUTRO);
    for (let i = 0; i < COLS; i++) for (let k = 0; k < LINS; k++) {
      m.makeTranslation(-LX + 0.5 + i, 0.05, -LZ + 0.5 + k); chao.setMatrixAt(i * LINS + k, m); chao.setColorAt(i * LINS + k, cor);
    }
    grupo.add(chao);
    pecas.dono = Array(TOTAL).fill(-1); pecas.pop = new Map(); pecas.visto = 0;
    // moldura de madeira do quadro, em volta do chao
    for (const [w, l, x, z] of [[2 * LX + 3, 0.7, 0, -LZ - 1.4], [2 * LX + 3, 0.7, 0, LZ + 1.4], [0.7, 2 * LZ + 3, -LX - 1.4, 0], [0.7, 2 * LZ + 3, LX + 1.4, 0]]) {
      const t = malha(new THREE.BoxGeometry(w, 0.3, l), 0x8a5a2b, { roughness: 0.85 }); t.position.set(x, 0.1, z); t.castShadow = false; grupo.add(t);
    }
    // latas de tinta empilhadas fora do quadro (so enfeite)
    for (const [x, z] of [[-LX - 2.6, -LZ - 0.5], [LX + 2.6, LZ + 0.5], [-LX - 2.6, LZ + 1.5]]) {
      for (let n = 0; n < 2; n++) {
        const lata = malha(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 14), 0xb9bfd0, { roughness: 0.4, metalness: 0.4 }); lata.position.set(x + n * 1.2, 0.4, z + n * 0.3); grupo.add(lata);
        const faixa = malha(new THREE.CylinderGeometry(0.62, 0.62, 0.25, 14), 0x2b2f3a); faixa.position.set(x + n * 1.2, 0.4, z + n * 0.3); faixa.castShadow = false; grupo.add(faixa);
      }
    }
    // balde de tinta (o item): lata preta com faixa branca e um halo no chao
    const balde = pecas.balde = new THREE.Group();
    const corpo = malha(new THREE.CylinderGeometry(0.75, 0.62, 1.25, 16), 0x2b2f3a, { roughness: 0.35, metalness: 0.3 });
    const faixa = malha(new THREE.CylinderGeometry(0.77, 0.77, 0.28, 16), 0xffffff, { emissive: 0x666666 }); faixa.position.y = 0.1;
    const tampa = malha(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 16), 0xf4f1e6, { emissive: 0x555555 }); tampa.position.y = 0.68;
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.65, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.12;
    corpo.position.y = 0.62; faixa.position.y += 0.62; tampa.position.y += 0.62;
    balde.add(corpo, faixa, tampa, halo); balde.userData = { corpo, halo }; balde.visible = false; grupo.add(balde);
  },

  desenha(c, dt, t) {
    const { THREE, p, pecas } = c, d = p.dados;
    const times = p.modo === 'times', cores = times ? c.times : c.cores, chao = pecas.chao;
    const cor = pecas.cor ??= new THREE.Color(), m = pecas.m ??= new THREE.Matrix4();
    let mudou = false;
    for (let k = 0; k < TOTAL; k++) {
      if (pecas.dono[k] === d.cor[k]) continue;
      pecas.dono[k] = d.cor[k]; mudou = true;
      chao.setColorAt(k, cor.set(d.cor[k] < 0 ? NEUTRO : cores[d.cor[k]]));
      if (d.cor[k] >= 0) pecas.pop.set(k, 1);
    }
    if (mudou) chao.instanceColor.needsUpdate = true;
    for (const [k, v] of pecas.pop) {          // o ladrilho recem pintado da um pulinho
      const nv = v - dt * 5, i = Math.floor(k / LINS), z = k % LINS, s = Math.max(0, nv);
      m.makeScale(1, 1 + s * 2.5, 1).setPosition(-LX + 0.5 + i, 0.05 + s * 0.12, -LZ + 0.5 + z);
      chao.setMatrixAt(k, m);
      if (nv <= 0) pecas.pop.delete(k); else pecas.pop.set(k, nv);
    }
    if (pecas.pop.size || mudou) chao.instanceMatrix.needsUpdate = true;

    const b = pecas.balde;
    b.visible = !!d.balde && (d.balde.t > 3 || Math.floor(t * 8) % 2 === 0);
    if (d.balde) {
      b.position.set(d.balde.x, 0.3 + Math.abs(Math.sin(t * 3)) * 0.35, d.balde.z); b.rotation.y = t * 1.5;
      b.userData.halo.scale.setScalar(1 + Math.sin(t * 6) * 0.1);
    }
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      c.particulas(e.x, 1, e.z, cores[e.dono], 50, 12); c.particulas(e.x, 1.5, e.z, 0xffffff, 14, 9);
    }
    // gotinhas atras de quem anda
    p.jogadores.forEach((j, i) => {
      if (j.vivo && j.y <= 0.05 && Math.hypot(j.vx, j.vz) > 3 && Math.random() < dt * 14) c.particulas(j.x, 0.2, j.z, cores[times ? timeDe(p, i) : i], 1, 2.5);
    });
  },
};
