// Corrida de voltas: pista em anel (duas retas e duas curvas). Fora do asfalto a grama segura o boneco.
// Sentido: na reta de baixo (perto da camera) corre-se para a direita; na tela, anti-horario.
import { RAIO } from '../logica.mjs';

export const L = 3.4, R_DENTRO = 3.2, R_FORA = 7.0, R_MEIO = (R_DENTRO + R_FORA) / 2;
export const VOLTAS = 3, LIMITE = 55;
const TURBO = 1.15, GRAMA = 0.01, R_MANCHA = 1.1, IMPULSO = 13;
const COMPRIMENTO = 2 * Math.PI * R_MEIO + 4 * L;

// Distancia ate o "osso" da pista (segmento de -L a L no eixo x). Asfalto: R_DENTRO <= dist <= R_FORA.
export function distPista(x, z) { return Math.hypot(x - Math.max(-L, Math.min(L, x)), z); }
const naPista = (x, z) => { const d = distPista(x, z); return d >= R_DENTRO && d <= R_FORA; };

// Ponto da pista: u de 0 a 1 ao longo da volta (0 = linha de chegada), r = distancia do osso. Devolve posicao e tangente.
export function pontoPista(u, r = R_MEIO) {
  let s = ((u % 1) + 1) % 1 * COMPRIMENTO;
  const curva = Math.PI * R_MEIO;
  if (s < L) return { x: s, z: r, tx: 1, tz: 0 };
  s -= L;
  if (s < curva) { const a = s / R_MEIO; return { x: L + Math.sin(a) * r, z: Math.cos(a) * r, tx: Math.cos(a), tz: -Math.sin(a) }; }
  s -= curva;
  if (s < 2 * L) return { x: L - s, z: -r, tx: -1, tz: 0 };
  s -= 2 * L;
  if (s < curva) { const a = s / R_MEIO; return { x: -L - Math.sin(a) * r, z: -Math.cos(a) * r, tx: -Math.cos(a), tz: Math.sin(a) }; }
  s -= curva;
  return { x: -L + s, z: r, tx: 1, tz: 0 };
}

// Os 4 pontos de controle, na ordem da volta. 0 e a linha de chegada. Cruzar so vale no sentido certo e fora do miolo.
const PORTOES = [
  (a, b) => a.x < 0 && b.x >= 0 && b.z > 0,      // chegada: reta de baixo, indo para a direita
  (a, b) => a.z > 0 && b.z <= 0 && b.x > 0,      // curva da direita, subindo
  (a, b) => a.x > 0 && b.x <= 0 && b.z < 0,      // reta de cima, indo para a esquerda
  (a, b) => a.z < 0 && b.z >= 0 && b.x < 0,      // curva da esquerda, descendo
];

export default {
  id: 'corrida', genero: 'corrida', nome: 'Corrida de voltas', dica: 'Dê 3 voltas na pista. A grama freia, o óleo escorrega e a seta amarela acelera!',
  rotulo: 'voltas', semPulo: true, duracao: LIMITE, controle: { modo: 'padrao', a: 'EMPURRA', b: '' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 8.5, parede: true };
    const dentro = p.rng() < 0.5 ? 0 : 1;          // sorteia quem larga por dentro; o de dentro sai um pouco atras
    p.jogadores.forEach((j, i) => {
      j.x = i === dentro ? 0.9 : 1.7; j.z = i === dentro ? R_MEIO - 0.95 : R_MEIO + 0.95; j.turbo = TURBO;
    });
    const mancha = (tipo, u0, u1) => ({ tipo, ...pontoPista(u0 + p.rng() * (u1 - u0), R_MEIO + (p.rng() - 0.5) * 2) });
    p.dados = {
      placar: [0, 0], prox: [1, 1], progresso: [0, 0],
      antes: p.jogadores.map(j => ({ x: j.x, z: j.z })), sobre: [-1, -1],
      manchas: [mancha('oleo', 0.14, 0.38), mancha('turbo', 0.44, 0.56), mancha('oleo', 0.62, 0.86)],
      fx: [], aviso: '', tAviso: 0,
    };
  },

  atualiza(p, dt) {
    const d = p.dados;
    let venceu;
    if (p.tocou) fx(d, (p.jogadores[0].x + p.jogadores[1].x) / 2, (p.jogadores[0].z + p.jogadores[1].z) / 2, 0xffffff, 10);
    p.jogadores.forEach((j, i) => {
      // grama: freio forte
      if (!naPista(j.x, j.z)) { const f = Math.pow(GRAMA, dt); j.vx *= f; j.vz *= f; }

      // manchas: oleo tira o controle e o atrito (desliza reto); turbo da um tranco no sentido da pista
      const n = d.manchas.findIndex(m => Math.hypot(j.x - m.x, j.z - m.z) < R_MANCHA + 0.2);
      const m = d.manchas[n];
      j.turbo = TURBO;
      if (m?.tipo === 'oleo') { j.turbo = 0.1; const f = Math.pow(p.mod?.atrito ?? 0.1, dt); j.vx /= f; j.vz /= f; }     // 0.1 = atrito do motor: no oleo ele some
      if (n !== d.sobre[i] && m) {
        if (m.tipo === 'turbo') { j.vx += m.tx * IMPULSO; j.vz += m.tz * IMPULSO; p.eventos.push('dash'); fx(d, j.x, j.z, 0xffd84d, 14); }
        else { p.eventos.push('queda'); fx(d, j.x, j.z, 0x8a5cff, 8); }
      }
      d.sobre[i] = n;

      // pontos de controle em ordem
      const a = d.antes[i];
      if (PORTOES[d.prox[i]](a, j) && distPista(j.x, j.z) >= R_DENTRO - 0.4) {
        d.progresso[i]++;
        if (d.prox[i] === 0) {
          d.placar[i]++; p.eventos.push('moeda'); fx(d, j.x, j.z, i, 16);
          if (d.placar[i] >= VOLTAS) venceu ??= i;
          else if (d.placar[i] === VOLTAS - 1 && d.placar[1 - i] < VOLTAS - 1) { d.aviso = 'Última volta!'; d.avisoCor = '#ffd84d'; d.tAviso = 1.5; }
        }
        d.prox[i] = (d.prox[i] + 1) % 4;
      }
      a.x = j.x; a.z = j.z;
    });
    if (d.tAviso > 0 && (d.tAviso -= dt) <= 0) d.aviso = '';
    if (venceu !== undefined) { p.eventos.push('gol'); return venceu; }
    if (p.t > LIMITE) { const [a, b] = d.progresso; return a === b ? -1 : a > b ? 0 : 1; }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const chapa = (rFora, rDentro, cor, y) => {     // anel em forma de estadio, deitado no chao
      const forma = (r, s) => { s.moveTo(-L, -r); s.lineTo(L, -r); s.absarc(L, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-L, r); s.absarc(-L, 0, r, Math.PI / 2, Math.PI * 1.5, false); return s; };
      const s = forma(rFora, new THREE.Shape());
      if (rDentro) s.holes.push(forma(rDentro, new THREE.Path()));
      const m = malha(new THREE.ShapeGeometry(s, 24), cor, { roughness: 0.9 });
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = false; grupo.add(m);
      return m;
    };
    const faixa = (lx, lz, cor, x, z, y = 0.07, giro = 0) => {
      const m = malha(new THREE.BoxGeometry(lx, 0.02, lz), cor); m.position.set(x, y, z); m.rotation.y = giro; m.castShadow = false; grupo.add(m);
      return m;
    };
    const dentro = R_DENTRO - 0.4, fora = R_FORA + 0.4;      // o asfalto desenhado sobra um pouco: o que vale e o centro do boneco
    const grama = malha(new THREE.BoxGeometry(p.arena.lx * 2, 0.02, p.arena.lz * 2), 0x2f9e4f, { roughness: 1 });
    grama.position.y = 0.01; grama.castShadow = false; grupo.add(grama);
    chapa(fora + 0.25, dentro - 0.25, 0xffffff, 0.03);        // borda branca
    chapa(fora, dentro, 0x3a3f4b, 0.05);                      // asfalto
    chapa(dentro - 0.25, 0, 0x37b85c, 0.03);                  // miolo de grama mais clara

    // zebras vermelhas e brancas nas curvas (por fora e por dentro)
    for (const lado of [-1, 1])
      for (const [r, n] of [[fora + 0.05, 16], [dentro - 0.05, 7]])
        for (let k = 0; k < n; k++) {
          const a = (k + 0.5) / n * Math.PI - Math.PI / 2;      // de -90 a 90 graus
          faixa(0.5, Math.PI * r / n, k % 2 ? 0xffffff : 0xe5383b, lado * (L + Math.cos(a) * r), Math.sin(a) * r, 0.08, lado > 0 ? -a : a);
        }

    // tracejado do meio e setas amarelas do sentido
    const N = 36;
    for (let k = 0; k < N; k++) {
      const q = pontoPista((k + 0.5) / N);
      if (Math.abs(q.x) < 0.9 && q.z > 0) continue;            // nao risca a linha de chegada
      faixa(0.7, 0.14, 0xf2f2f2, q.x, q.z, 0.07, Math.atan2(-q.tz, q.tx));
    }
    const seta = new THREE.Shape(); seta.moveTo(0.6, 0); seta.lineTo(-0.4, 0.55); seta.lineTo(-0.1, 0); seta.lineTo(-0.4, -0.55);
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.92])
      for (const r of [R_MEIO - 1.3, R_MEIO + 1.3]) {
        const q = pontoPista(u, r), giro = new THREE.Group();
        const m = malha(new THREE.ShapeGeometry(seta), 0xffd84d, { transparent: true, opacity: 0.55 });
        m.rotation.x = -Math.PI / 2; m.castShadow = false;
        giro.add(m); giro.position.set(q.x, 0.075, q.z); giro.rotation.y = Math.atan2(-q.tz, q.tx); grupo.add(giro);
      }

    // linha de chegada quadriculada, com dois postes e uma faixa por cima
    const lado = (fora - dentro) / 10;
    for (let k = 0; k < 10; k++)
      for (let col = 0; col < 2; col++)
        faixa(lado, lado, (k + col) % 2 ? 0x111111 : 0xffffff, (col - 0.5) * lado, dentro + (k + 0.5) * lado, 0.085);
    for (const z of [dentro - 0.3, fora + 0.3]) {
      const poste = malha(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10), 0xdfe6f5); poste.position.set(0, 1.3, z); grupo.add(poste);
    }
    for (let k = 0; k < 10; k++) {
      const q = malha(new THREE.BoxGeometry(0.12, 0.45, (fora - dentro + 0.6) / 10), k % 2 ? 0x111111 : 0xffffff);
      q.position.set(0, 2.6, dentro - 0.3 + (k + 0.5) * (fora - dentro + 0.6) / 10); grupo.add(q);
    }

    // manchas: oleo (poca roxa escura brilhante) e turbo (placa amarela com setas)
    pecas.manchas = p.dados.manchas.map(m => {
      const g = new THREE.Group(); g.position.set(m.x, 0.09, m.z);
      if (m.tipo === 'oleo') {
        for (const [dx, dz, r] of [[0, 0, 0.85], [0.55, 0.3, 0.5], [-0.5, -0.35, 0.55], [-0.3, 0.55, 0.4]]) {
          const poca = malha(new THREE.CylinderGeometry(R_MANCHA * r, R_MANCHA * r, 0.03, 20), 0x1a1033, { roughness: 0.05, metalness: 0.8, emissive: 0x3a1a7a, emissiveIntensity: 0.5 });
          poca.position.set(dx * R_MANCHA, 0, dz * R_MANCHA); poca.castShadow = false; g.add(poca);
        }
      } else {
        g.rotation.y = Math.atan2(-m.tz, m.tx);
        const placa = malha(new THREE.CylinderGeometry(R_MANCHA, R_MANCHA, 0.03, 24), 0xff9a1f, { emissive: 0xff7a00, emissiveIntensity: 0.6 });
        placa.castShadow = false; g.add(placa);
        for (const dx of [-0.45, 0.25]) {
          const s = malha(new THREE.ShapeGeometry(seta), 0xffffff, { emissive: 0xffffaa, emissiveIntensity: 0.8 });
          s.rotation.x = -Math.PI / 2; s.position.set(dx, 0.03, 0); s.castShadow = false; g.add(s);
        }
      }
      grupo.add(g);
      return g;
    });
  },

  desenha(c, dt, t) {
    const d = c.p.dados;
    c.pecas.manchas.forEach((g, n) => {
      if (d.manchas[n].tipo === 'turbo') g.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
    });
    for (const f of d.fx.splice(0)) c.particulas(f.x, 0.8, f.z, typeof f.cor === 'number' && f.cor < 2 ? c.cores[f.cor] : f.cor, f.n, 8);
  },
};

// Faiscas pedidas pela regra e soltas pelo desenho (cor 0 ou 1 = cor do jogador).
function fx(d, x, z, cor, n) { if (d.fx.length < 12) d.fx.push({ x, z, cor, n }); }
