// Corrida dos Dedos da Festa: cada um na sua raia, correndo com os dedos. Um toque em cada botão, alternando (pé esquerdo, pé direito).
// Repetir o mesmo botão é pisar duas vezes com o mesmo pé: tropeça. A pista vale 100 metros de verdade (o desenho é só a vista dela),
// bem mais que o cem metros do Clássico, para a rodada durar de 15 a 45 s mesmo com dedo rápido.
// Todos contra todos: vence quem chega primeiro. Em duplas (soma): cada um corre na sua raia e os metros dos dois se somam;
// vence a dupla que juntar 170 metros primeiro. Ninguém espera a vez, e um tropeço custa caro à dupla.
import { timeDe, quem } from '../logica.mjs';

export const LARGADA = -9.3, CHEGADA = 9, LIMITE = 45, PISTA = 100, ALVO_DUPLA = 170;
const ESP = 3, IMPULSO = 0.7, ATRITO = 0.35, TROPECO = 0.35, V_MAX = 12, M_MAX = 130;
const dupla = p => p.modo === 'times';
const zDe = (i, n) => (i - (n - 1) / 2) * ESP;
const xDe = m => LARGADA + Math.min(m, PISTA + 3.3) / PISTA * (CHEGADA - LARGADA);       // depois da linha o boneco fica parado nela

function totais(p, d) {
  const m = d.m.map(v => Math.min(v, M_MAX));
  if (!dupla(p)) return m;
  const t = [0, 0];
  m.forEach((v, i) => { t[timeDe(p, i)] += v; });
  return t;
}

// Quem tem o maior valor, ou -1 se empatar no topo.
function lider(v) {
  const maior = Math.max(...v), topo = v.flatMap((x, k) => (x === maior ? [k] : []));
  return topo.length === 1 ? topo[0] : -1;
}

// Resultado final: deixa a tela e os celulares no estado final antes de devolver.
function encerra(p, d, res) {
  const n = p.jogadores.length;
  const par = res >= 0 && dupla(p) && n > res + 2;           // os dois da dupla vencedora (J1 e J3, ou J2 e J4)
  d.aviso = res === -1 ? 'Empate!' : par ? `${quem(p, res)} e ${quem(p, res + 2)} venceram a corrida!` : `${quem(p, res)} venceu a corrida!`;
  d.avisoCor = '#ffd21f';
  p.jogadores.forEach((_, i) => {
    const meu = dupla(p) ? timeDe(p, i) : i;
    p.celular[i] = { ...p.celular[i], texto: res === -1 ? 'Empate!' : meu === res ? 'Você venceu!' : 'Fim da corrida. Você não venceu.' };
  });
  return res;
}

function texto(p, d, i) {
  const pct = Math.min(100, Math.floor(d.m[i] / PISTA * 100));
  const tropeco = d.tropeco[i] > 0 ? 'Tropeçou! ' : '';
  if (dupla(p)) {
    const linha = d.m[i] >= PISTA ? ' Passou da linha: siga correndo pela dupla.' : '';
    return `${tropeco}Sua dupla: ${d.placar[timeDe(p, i)]}%. Você: ${pct}%.${linha}`;
  }
  const lugar = 1 + d.m.filter(v => v > d.m[i]).length;
  return `${tropeco}${lugar}º lugar, ${pct}% da pista.`;
}

export default {
  id: 'corrida-dedos-festa', genero: 'ritmo', nome: 'Corrida dos Dedos da Festa', dica: 'Alterne Esquerda e Direita bem rápido: repetir o mesmo botão faz tropeçar.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  rotulo: 'da pista', sufixo: '%', duracao: LIMITE, semMovimento: true, semDash: true, semPulo: true, semNome: true,
  controle: { modo: 'padrao', a: 'Direita', b: 'Esquerda', joystick: false },

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: 11, lz: 1.5 * n + 1.5, parede: true };
    p.jogadores.forEach((j, i) => { j.x = LARGADA; j.z = zDe(i, n); });
    p.dados = { m: Array(n).fill(0), v: Array(n).fill(0), ultimo: Array(n).fill(''), tropeco: Array(n).fill(0), placar: [], fx: [], aviso: '', avisoCor: '#ffd21f' };
    p.dados.placar = totais(p, p.dados).map(v => Math.floor(v / (dupla(p) ? ALVO_DUPLA : PISTA) * 100));
    p.jogadores.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: texto(p, p.dados, i) }; });
  },

  atualiza(p, dt) {
    const d = p.dados, n = p.jogadores.length;
    p.jogadores.forEach((j, i) => {
      // toques deste quadro: enquanto der para alternar conta passo; o que sobrar do mesmo botão é tropeço
      let a = j.apertouA, b = j.apertouB;
      while (a + b > 0) {
        const pe = (d.ultimo[i] !== 'a' && a) || !b ? 'a' : 'b';
        if (pe === 'a') a--; else b--;
        if (pe !== d.ultimo[i]) {
          d.v[i] = Math.min(V_MAX, d.v[i] + IMPULSO);
          if (j.y === 0) j.vy = 2.5;                     // pulinho de passada
        } else {
          d.v[i] *= TROPECO; d.tropeco[i] = 0.5; j.vy = 5;
          p.eventos.push('queda'); fx(d, j.x, j.z, i, 8);
          p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
        }
        d.ultimo[i] = pe;
      }
      d.v[i] *= Math.pow(ATRITO, dt);
      d.tropeco[i] = Math.max(0, d.tropeco[i] - dt);
      d.m[i] = Math.min(M_MAX, d.m[i] + d.v[i] * dt);
      j.x = xDe(d.m[i]); j.z = zDe(i, n); j.vx = j.vz = 0;
    });
    const t = totais(p, d);
    d.placar = t.map(v => Math.max(0, Math.min(100, Math.floor(v / (dupla(p) ? ALVO_DUPLA : PISTA) * 100))));
    p.jogadores.forEach((_, i) => { const s = texto(p, d, i); if (p.celular[i].texto !== s) p.celular[i] = { ...p.celular[i], texto: s }; });
    const chegou = dupla(p) ? t.some(v => v >= ALVO_DUPLA) : d.m.some(v => v >= PISTA);
    if (chegou || p.t > LIMITE) {
      const res = lider(t);
      if (chegou) {
        p.eventos.push('gol');
        if (res >= 0) { const q = dupla(p) ? [...Array(n).keys()].find(k => timeDe(p, k) === res) : res; fx(d, p.jogadores[q].x, p.jogadores[q].z, q, 30); }
      }
      return encerra(p, d, res);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const n = p.jogadores.length, W = n * ESP / 2, a = p.arena;
    const corDe = i => (dupla(p) ? c.times[timeDe(p, i)] : c.cores[i]);
    const chapa = (lx, lz, cor, x, z, y, extra) => {
      const m = malha(new THREE.BoxGeometry(lx, 0.02, lz), cor, extra); m.position.set(x, y, z); m.castShadow = false; grupo.add(m);
      return m;
    };
    chapa(a.lx * 2, a.lz * 2, 0x2f9e4f, 0, 0, 0.01, { roughness: 1 });                 // gramado em volta
    chapa(a.lx * 2, W * 2 + 0.3, 0xc9553a, 0, 0, 0.03, { roughness: 0.9 });             // pista de atletismo
    for (let k = 0; k <= n; k++) chapa(a.lx * 2, 0.14, 0xffffff, 0, -W + k * ESP, 0.05);     // linhas das raias
    for (let m = 10; m < 100; m += 10)                                                   // marcas a cada 10 por cento da pista
      chapa(0.07, W * 2, 0xf0b9a8, LARGADA + (CHEGADA - LARGADA) * m / 100, 0, 0.045);
    chapa(0.2, W * 2, 0xffffff, LARGADA + 0.9, 0, 0.05);                                 // linha de largada
    for (let i = 0; i < n; i++) {                                                        // cada raia com a cor do dono (ou da dupla)
      const z = zDe(i, n), cor = corDe(i);
      chapa(1.3, ESP - 0.5, cor, LARGADA - 0.2, z, 0.05, { emissive: cor, emissiveIntensity: 0.25 });
      chapa(CHEGADA - LARGADA - 1.4, 0.22, cor, (CHEGADA + LARGADA) / 2 + 0.5, z - ESP / 2 + 0.3, 0.05, { transparent: true, opacity: 0.7 });
    }

    // chegada: faixa quadriculada no chão, postes e fita
    const linhas = n * 7, q = W * 2 / linhas, x0 = CHEGADA + 0.8;     // o centro do boneco cruza em CHEGADA; a faixa fica na barriga dele
    for (let k = 0; k < linhas; k++)
      for (let col = 0; col < 3; col++)
        chapa(q, q, (k + col) % 2 ? 0x111111 : 0xffffff, x0 + (col - 1) * q, -W + (k + 0.5) * q, 0.06);
    for (const z of [-W - 0.25, W + 0.25]) {
      const poste = malha(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 10), 0xdfe6f5); poste.position.set(x0, 1.4, z); grupo.add(poste);
    }
    for (let k = 0; k < linhas; k++) {
      const b = malha(new THREE.BoxGeometry(0.1, 0.4, (W * 2 + 0.5) / linhas), k % 2 ? 0x111111 : 0xffd84d);
      b.position.set(x0, 2.8, -W - 0.25 + (k + 0.5) * (W * 2 + 0.5) / linhas); grupo.add(b);
    }

    // arquibancada no fundo, com a plateia de cubos
    const CORES = [0xffc531, 0xff7a2f, 0x35c26b, 0x8a5cff, 0xf2f2f2, 0x33c8d9, 0xe5383b];
    pecas.plateia = [];
    for (let fila = 0; fila < 3; fila++) {
      const z = -a.lz - 1.2 - fila * 1.1, alto = 0.5 + fila * 0.6;
      const degrau = malha(new THREE.BoxGeometry(a.lx * 2, alto, 1.1), fila % 2 ? 0x59627f : 0x4a5578); degrau.position.set(0, alto / 2, z); grupo.add(degrau);
      for (let k = 0; k < 15; k++) {
        const m = fila * 15 + k;
        const cubo = malha(new THREE.BoxGeometry(0.75, 0.75, 0.75), CORES[(m * 3 + fila) % CORES.length]);
        cubo.position.set(-a.lx + 0.75 + k * (a.lx * 2 - 1.5) / 14 + (fila % 2 ? 0.35 : 0), alto + 0.375, z); grupo.add(cubo);
        pecas.plateia.push({ cubo, base: alto + 0.375, fase: (m * 2.399) % 6.283, ritmo: 5 + (m * 7 % 5) });
      }
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados;
    const fim = p.fase !== 'jogando' && p.fase !== 'intro';
    const animo = fim ? 1 : Math.min(1, 0.25 + Math.max(...d.v) / 6);                    // a plateia pula mais quando a corrida esquenta
    for (const e of c.pecas.plateia) {
      e.cubo.position.y = e.base + Math.abs(Math.sin(t * e.ritmo * (fim ? 1.6 : 1) + e.fase)) * 0.7 * animo;
      e.cubo.rotation.y = Math.sin(t * 2 + e.fase) * 0.3;
    }
    p.jogadores.forEach((j, i) => {
      const corpo = c.bonecos[i].userData?.corpo;
      if (!corpo) return;
      // olha para a chegada, inclina o corpo correndo e dá uma cambalhota no tropeço (a ordem ZYX faz a inclinação ser para a frente)
      const giro = c.pecas.giro ??= new c.THREE.Euler(0, 0, 0, 'ZYX');
      giro.set(0, Math.PI / 2, -(d.tropeco[i] / 0.5 * Math.PI * 2 + Math.min(0.35, d.v[i] * 0.05)), 'ZYX');
      corpo.quaternion.setFromEuler(giro);
    });
    for (const f of d.fx.splice(0)) c.particulas(f.x, 0.6, f.z, f.n > 20 ? 0xffffff : dupla(p) ? c.times[timeDe(p, f.i)] : c.cores[f.i], f.n, f.n > 20 ? 11 : 6);
  },
};

function fx(d, x, z, i, n) { if (d.fx.length < 12) d.fx.push({ x, z, i, n }); }
