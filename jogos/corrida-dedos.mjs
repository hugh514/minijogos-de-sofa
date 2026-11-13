// Cem metros: cada um na sua raia, correndo com os dedos. Um toque em cada botao, alternando (pe esquerdo, pe direito).
// Repetir o mesmo botao e pisar duas vezes com o mesmo pe: tropeca.

export const LARGADA = -9.3, CHEGADA = 9, RAIA = 1.7, LIMITE = 30;
const IMPULSO = 0.5, ATRITO = 0.35, TROPECO = 0.35, V_MAX = 9;

export default {
  id: 'corrida-dedos', nome: 'Cem metros', dica: 'Aperte ESQ e DIR alternando, bem rápido. Repetir o mesmo botão faz tropeçar!',
  rotulo: 'metros', semMovimento: true, semDash: true, semPulo: true,
  controle: { modo: 'padrao', a: 'DIR', b: 'ESQ', joystick: false },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 5.5, parede: true };
    p.jogadores.forEach((j, i) => { j.x = LARGADA; j.z = i ? RAIA : -RAIA; });
    p.dados = { v: [0, 0], ultimo: ['', ''], tropeco: [0, 0], placar: [0, 0], fx: [] };
  },

  atualiza(p, dt) {
    const d = p.dados;
    p.jogadores.forEach((j, i) => {
      // toques deste quadro: enquanto der para alternar conta passo; o que sobrar do mesmo botao e tropeco
      let a = j.apertouA, b = j.apertouB;
      while (a + b > 0) {
        const pe = (d.ultimo[i] !== 'a' && a) || !b ? 'a' : 'b';
        if (pe === 'a') a--; else b--;
        if (pe !== d.ultimo[i]) {
          d.v[i] = Math.min(V_MAX, d.v[i] + IMPULSO);
          if (j.y === 0) j.vy = 2.5;                     // pulinho de passada
        } else {
          d.v[i] *= TROPECO; d.tropeco[i] = 0.5; j.vy = 5;
          p.eventos.push('queda'); fx(d, j.x, j.z, 0xffffff, 8);
          p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
        }
        d.ultimo[i] = pe;
      }
      d.v[i] *= Math.pow(ATRITO, dt);
      d.tropeco[i] = Math.max(0, d.tropeco[i] - dt);
      j.x = Math.min(CHEGADA + 0.6, j.x + d.v[i] * dt); j.z = i ? RAIA : -RAIA; j.vx = j.vz = 0;
      d.placar[i] = Math.max(0, Math.min(100, Math.floor((j.x - LARGADA) / (CHEGADA - LARGADA) * 100)));
    });
    const [x0, x1] = p.jogadores.map(j => j.x);
    const frente = x0 === x1 ? -1 : x0 > x1 ? 0 : 1;
    if (x0 >= CHEGADA || x1 >= CHEGADA) {
      p.eventos.push('gol');
      const q = p.jogadores[Math.max(frente, 0)]; fx(d, q.x, q.z, Math.max(frente, 0), 30);
      return frente;
    }
    if (p.t > LIMITE) return frente;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores, p } = c;
    const chapa = (lx, lz, cor, x, z, y, extra) => {
      const m = malha(new THREE.BoxGeometry(lx, 0.02, lz), cor, extra); m.position.set(x, y, z); m.castShadow = false; grupo.add(m);
      return m;
    };
    const larg = RAIA * 2, a = p.arena;
    chapa(a.lx * 2, a.lz * 2, 0x2f9e4f, 0, 0, 0.01, { roughness: 1 });                 // gramado em volta
    chapa(a.lx * 2, larg * 2 + 0.3, 0xc9553a, 0, 0, 0.03, { roughness: 0.9 });          // pista de atletismo
    for (const z of [-larg, 0, larg]) chapa(a.lx * 2, 0.14, 0xffffff, 0, z, 0.05);      // linhas das raias
    for (let m = 10; m < 100; m += 10)                                                   // marcas a cada 10 metros
      chapa(0.07, larg * 2, 0xf0b9a8, LARGADA + (CHEGADA - LARGADA) * m / 100, 0, 0.045);
    chapa(0.2, larg * 2, 0xffffff, LARGADA + 0.9, 0, 0.05);                              // linha de largada
    for (const i of [0, 1]) {                                                            // cada raia com a cor do dono
      const z = i ? RAIA : -RAIA;
      chapa(1.3, larg - 0.5, cores[i], LARGADA - 0.2, z, 0.05, { emissive: cores[i], emissiveIntensity: 0.25 });
      chapa(CHEGADA - LARGADA - 1.4, 0.22, cores[i], (CHEGADA + LARGADA) / 2 + 0.5, z + (i ? 1 : -1) * (RAIA - 0.35), 0.05, { transparent: true, opacity: 0.7 });
    }

    // chegada: faixa quadriculada no chao, postes e fita
    const q = larg * 2 / 14, x0 = CHEGADA + 0.8;       // o centro do boneco cruza em CHEGADA; a faixa fica na barriga dele
    for (let k = 0; k < 14; k++)
      for (let col = 0; col < 3; col++)
        chapa(q, q, (k + col) % 2 ? 0x111111 : 0xffffff, x0 + (col - 1) * q, -larg + (k + 0.5) * q, 0.06);
    for (const z of [-larg - 0.25, larg + 0.25]) {
      const poste = malha(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 10), 0xdfe6f5); poste.position.set(x0, 1.4, z); grupo.add(poste);
    }
    for (let k = 0; k < 14; k++) {
      const b = malha(new THREE.BoxGeometry(0.1, 0.4, (larg * 2 + 0.5) / 14), k % 2 ? 0x111111 : 0xffd84d);
      b.position.set(x0, 2.8, -larg - 0.25 + (k + 0.5) * (larg * 2 + 0.5) / 14); grupo.add(b);
    }

    // arquibancada no fundo, com a plateia de cubos
    const CORES = [0xffc531, 0xff7a2f, 0x35c26b, 0x8a5cff, 0xf2f2f2, 0x33c8d9, 0xe5383b];
    pecas.plateia = [];
    for (let fila = 0; fila < 3; fila++) {
      const z = -a.lz - 1.2 - fila * 1.1, alto = 0.5 + fila * 0.6;
      const degrau = malha(new THREE.BoxGeometry(a.lx * 2, alto, 1.1), fila % 2 ? 0x59627f : 0x4a5578); degrau.position.set(0, alto / 2, z); grupo.add(degrau);
      for (let k = 0; k < 15; k++) {
        const n = fila * 15 + k;
        const cubo = malha(new THREE.BoxGeometry(0.75, 0.75, 0.75), CORES[(n * 3 + fila) % CORES.length]);
        cubo.position.set(-a.lx + 0.75 + k * (a.lx * 2 - 1.5) / 14 + (fila % 2 ? 0.35 : 0), alto + 0.375, z); grupo.add(cubo);
        pecas.plateia.push({ cubo, base: alto + 0.375, fase: (n * 2.399) % 6.283, ritmo: 5 + (n * 7 % 5) });
      }
    }
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados;
    const fim = p.fase !== 'jogando' && p.fase !== 'intro';
    const animo = fim ? 1 : Math.min(1, 0.25 + Math.max(d.v[0], d.v[1]) / 6);            // a plateia pula mais quando a corrida esquenta
    for (const e of c.pecas.plateia) {
      e.cubo.position.y = e.base + Math.abs(Math.sin(t * e.ritmo * (fim ? 1.6 : 1) + e.fase)) * 0.7 * animo;
      e.cubo.rotation.y = Math.sin(t * 2 + e.fase) * 0.3;
    }
    p.jogadores.forEach((j, i) => {
      const corpo = c.bonecos[i].userData?.corpo;
      if (!corpo) return;
      // olha para a chegada, inclina o corpo correndo e da uma cambalhota no tropeco (a ordem ZYX faz a inclinacao ser para a frente)
      const giro = c.pecas.giro ??= new c.THREE.Euler(0, 0, 0, 'ZYX');
      giro.set(0, Math.PI / 2, -(d.tropeco[i] / 0.5 * Math.PI * 2 + Math.min(0.35, d.v[i] * 0.05)), 'ZYX');
      corpo.quaternion.setFromEuler(giro);
    });
    for (const f of d.fx.splice(0)) c.particulas(f.x, 0.6, f.z, f.cor < 2 ? c.cores[f.cor] : f.cor, f.n, f.n > 20 ? 11 : 6);
  },
};

function fx(d, x, z, cor, n) { if (d.fx.length < 12) d.fx.push({ x, z, cor, n }); }
