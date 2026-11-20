// Labirinto de bombas na festa (todos contra todos ou times). Versao para 2 a 4 do Labirinto de bombas: um em cada canto de uma
// grade com pilares fixos (1) e caixas que quebram (2). A solta a bomba, que explode em cruz depois de 2 s; caixa quebrada as
// vezes solta item (mais bombas, mais fogo, patins, atravessar caixas). Cada um tem 2 vidas: quem e pego pelo fogo (de qualquer
// bomba, ate a propria) perde uma e volta ao seu canto, protegido por 1,5 s; sem vidas, sai. Vence o ultimo com vida (em times,
// a dupla que ainda tem alguem) ou, no fim do tempo, quem tem mais vidas (em times, somadas). Os blocos quem segura e o motor
// (p.arena.grade, com p.dados.grade e p.dados.poder), igual ao labirinto de 2.
import { posicionaCantos, timeDe, elimina, quem } from '../logica.mjs';

export const COLS = 11, LINS = 9, VIDAS = 2, LIMITE = 50, T_BOMBA = 2;
const ALCANCE = 2, T_FOGO = 0.5, BOMBAS = 2, T_VOLTA = 1.5, T_PROTECAO = 1.5;
const CHANCE_ITEM = 0.35, MAX_PODER = { bombas: 5, fogo: 6, patins: 3 }, TURBO = 0.6, TURBO_PATINS = 0.15;
const CAMPO_ITEM = { bomba: 'bombas', fogo: 'fogo', patins: 'patins' };
const CANTOS_VS = [[-1, -1], [1, 1], [-1, 1], [1, -1]];          // com 2, cantos opostos
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

export const celula = (x, z) => ({ i: Math.round((x + COLS - 1) / 2), k: Math.round((z + LINS - 1) / 2) });
export const centro = (i, k) => [-COLS + 1 + i * 2, -LINS + 1 + k * 2];
const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);
const corDe = (c, i) => (c.p.modo === 'times' ? c.times[timeDe(c.p, i)] : c.cores[i]);
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };
const temFogo = (d, c) => d.fogo.some(f => f.i === c.i && f.k === c.k);

function somaVidas(p) {
  const de = dono(p), t = Array(p.modo === 'times' ? 2 : p.jogadores.length).fill(0);
  p.dados.vidas.forEach((v, i) => { t[de(i)] += v; });
  return t;
}

function explode(p, b) {
  const d = p.dados;
  b.fim = true;
  d.fogo.push({ i: b.i, k: b.k, t: T_FOGO });
  for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    for (let n = 1; n <= b.alcance; n++) {
      const i = b.i + di * n, k = b.k + dk * n, c = d.grade[i]?.[k];
      if (c === undefined || c === 1) break;                // fora da grade ou pilar: o fogo para
      d.fogo.push({ i, k, t: T_FOGO });
      if (c === 2) {                                        // caixa quebra, segura o fogo e as vezes solta item
        d.grade[i][k] = 0;
        if (p.rng() < CHANCE_ITEM) { const r = p.rng(); d.itens.push({ i, k, tipo: r < 0.36 ? 'bomba' : r < 0.72 ? 'fogo' : r < 0.92 ? 'patins' : 'passa', t: T_FOGO + 0.1 }); }
        break;
      }
    }
  d.fx.push({ tipo: 'bum', i: b.i, k: b.k });
  p.eventos.push('explosao');
}

// Itens no chao: t protege o item do fogo da explosao que acabou de solta-lo. Depois disso o fogo queima o item.
function pegaItens(p, dt) {
  const d = p.dados;
  for (const it of d.itens) {
    it.t -= dt;
    if (it.t <= 0 && temFogo(d, it)) { it.fim = true; d.fx.push({ tipo: 'queimou', i: it.i, k: it.k }); continue; }
    p.jogadores.forEach((j, n) => {
      const c = celula(j.x, j.z);
      if (it.fim || !j.vivo || c.i !== it.i || c.k !== it.k) return;
      const o = d.poder[n];
      if (it.tipo === 'passa') o.passa = true;
      else { const campo = CAMPO_ITEM[it.tipo]; o[campo] = Math.min(MAX_PODER[campo], o[campo] + 1); }
      j.turbo = TURBO + o.patins * TURBO_PATINS;
      it.fim = true; d.fx.push({ tipo: 'pegou', i: it.i, k: it.k, quem: n }); p.eventos.push('moeda'); vibra(p, n);
    });
  }
  d.itens = d.itens.filter(it => !it.fim);
}

function textos(p, r) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  if (r !== undefined) d.aviso = r < 0 ? 'Empate!' : (times ? NOMES_TIMES[r] : quem(p, r)) + ' venceu!';
  d.inventario = d.poder.map((o, i) => [`Vidas ${d.vidas[i]}`, `Bombas ${o.bombas}`, `Fogo ${o.fogo}`, ...(o.patins ? [`Patins ${o.patins}`] : []), ...(o.passa ? ['Atravessa'] : [])]);
  p.jogadores.forEach((_, i) => {
    const t = r !== undefined ? (r < 0 ? 'Empate!' : de(i) === r ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, r) + ' venceu')
      : d.vidas[i] <= 0 ? 'Sem vidas. Torça!' : d.fora[i] ? 'Pegou fogo! Volta em ' + Math.ceil(Math.max(0.01, d.volta[i])) + ' s' : 'Vidas: ' + d.vidas[i];
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
  return r;
}

export default {
  id: 'labirinto-festa', genero: 'mira', nome: 'Labirinto de bombas na festa',
  dica: 'Solte bombas com A e fuja do fogo: cada um tem 2 vidas e o último de pé vence.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Bomba', b: '' }, semDash: true, semPulo: true,
  rotulo: 'vidas', duracao: LIMITE,
  // Camera bem alta e quase a pino (a mesma do labirinto de 2): o boneco nao some atras das caixas.
  camera() { return { x: 0, y: 29, z: 8.5, ox: 0, oy: 0, oz: -0.3 }; },

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: COLS, lz: LINS, parede: true, grade: true };
    if (p.modo === 'times') posicionaCantos(p, COLS - 1, LINS - 1);       // cada dupla de um lado
    else p.jogadores.forEach((j, i) => { j.x = CANTOS_VS[i][0] * (COLS - 1); j.z = CANTOS_VS[i][1] * (LINS - 1); });
    const grade = [];
    for (let i = 0; i < COLS; i++) {
      grade.push([]);
      for (let k = 0; k < LINS; k++) {
        const canto = Math.min(i, COLS - 1 - i) + Math.min(k, LINS - 1 - k) <= 1;       // area livre em cada canto
        grade[i].push(i % 2 && k % 2 ? 1 : !canto && p.rng() < 0.65 ? 2 : 0);
      }
    }
    p.dados = {
      grade, bombas: [], fogo: [], itens: [], fx: [], aviso: '',
      cantos: p.jogadores.map(j => ({ x: j.x, z: j.z })),
      vidas: Array(n).fill(VIDAS), fora: Array(n).fill(false), volta: Array(n).fill(0), protecao: Array(n).fill(0),
      poder: p.jogadores.map(() => ({ bombas: BOMBAS, fogo: ALCANCE, patins: 0, passa: false })),
      placar: [], inventario: [],
    };
    for (const j of p.jogadores) j.turbo = TURBO;
    p.dados.placar = somaVidas(p);
    textos(p);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    js.forEach((j, i) => {
      if (!j.vivo || !j.apertouA) return;
      const c = celula(j.x, j.z), minhas = d.bombas.filter(b => b.dono === i).length;
      if (minhas < d.poder[i].bombas && !d.bombas.some(b => b.i === c.i && b.k === c.k)) {
        d.bombas.push({ ...c, t: T_BOMBA, dono: i, alcance: d.poder[i].fogo }); p.eventos.push('troca');
      }
    });
    for (const b of d.bombas) {
      b.t -= dt;
      if (b.t <= 0 || temFogo(d, b)) explode(p, b);          // fogo de outra bomba detona em cadeia
    }
    d.bombas = d.bombas.filter(b => !b.fim);
    for (const f of d.fogo) f.t -= dt;
    d.fogo = d.fogo.filter(f => f.t > 0);
    pegaItens(p, dt);

    js.forEach((j, i) => {
      d.protecao[i] = Math.max(0, d.protecao[i] - dt);
      if (d.fora[i]) {
        if (d.vidas[i] <= 0) return;
        d.volta[i] -= dt;
        if (d.volta[i] > 0) return;
        Object.assign(j, { vivo: true, x: d.cantos[i].x, z: d.cantos[i].z, y: 0, vx: 0, vy: 0, vz: 0 });       // volta ao seu canto, protegido
        d.fora[i] = false; d.protecao[i] = T_PROTECAO;
        d.fx.push({ tipo: 'voltou', x: j.x, z: j.z, quem: i }); p.eventos.push('troca');
        return;
      }
      if (d.protecao[i] > 0 || !temFogo(d, celula(j.x, j.z))) return;
      d.vidas[i]--; d.fora[i] = true; d.volta[i] = T_VOLTA;
      d.fx.push({ tipo: 'pego', x: j.x, z: j.z, quem: i });
      elimina(p, j, 10); p.eventos.push('queda'); vibra(p, i);
    });
    d.placar = somaVidas(p);

    // acabou quando sobra um dono (jogador ou dupla) com vida; no tempo, quem tem mais
    const restam = d.placar.flatMap((v, k) => (v > 0 ? [k] : []));
    if (restam.length <= 1) return textos(p, restam.length ? restam[0] : -1);
    if (p.t >= LIMITE) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      return textos(p, lideres.length === 1 ? lideres[0] : -1);
    }
    textos(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, d = p.dados;
    const caixa = (lx, ly, lz, cor, x, y, z, extra, pai = grupo) => {
      const m = malha(new THREE.BoxGeometry(lx, ly, lz), cor, extra); m.position.set(x, y, z); pai.add(m);
      return m;
    };
    // a casa de cada um: o canto para onde volta, na cor do dono (ou do time)
    d.cantos.forEach((canto, i) => {
      const cor = corDe(c, i);
      caixa(1.9, 0.04, 1.9, cor, canto.x, 0.03, canto.z, { emissive: cor, emissiveIntensity: 0.45 }).castShadow = false;
    });
    pecas.caixas = [];
    d.grade.forEach((col, i) => col.forEach((tipo, k) => {
      if (!tipo) return;
      const [x, z] = centro(i, k);
      if (tipo === 1) {                                       // pilar de pedra (ESTILO.md: parede de labirinto com no maximo 0,8 de altura)
        const m = caixa(2, 0.8, 2, 0x59627f, x, 0.4, z, { roughness: 0.8 });
        caixa(1.5, 0.1, 1.5, 0x8792b8, 0, 0.42, 0, { roughness: 0.6 }, m).castShadow = false;
        return;
      }
      const g = new THREE.Group(); g.position.set(x, 0, z); grupo.add(g);      // caixote de madeira com moldura e duas ripas em X em cima
      caixa(1.8, 0.8, 1.8, 0xb9793f, 0, 0.4, 0, { roughness: 0.85 }, g);
      caixa(1.4, 0.06, 1.4, 0xd9a05b, 0, 0.82, 0, { roughness: 0.85 }, g).castShadow = false;
      for (const s of [-1, 1]) { const ripa = caixa(1.85, 0.08, 0.2, 0x7a4a22, 0, 0.86, 0, { roughness: 0.9 }, g); ripa.rotation.y = s * Math.PI / 4; ripa.castShadow = false; }
      pecas.caixas.push({ g, i, k, x, z });
    }));
    // vidas: coracoes (bolinhas vermelhas) em cima de cada um
    pecas.vidas = c.bonecos.map(() => {
      const g = new THREE.Group();
      const pips = Array.from({ length: VIDAS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.36, 14, 10), 0xff3b30, { emissive: 0xff3b30, emissiveIntensity: 0.9 }); m.castShadow = false; m.position.x = (k - 0.5) * 0.9; g.add(m); return m;
      });
      grupo.add(g); return { g, pips };
    });
  },

  desenha(c, dt, t) {
    const { THREE, malha, pecas, p } = c, d = p.dados;
    for (const cx of pecas.caixas) {
      if (cx.g.visible && d.grade[cx.i][cx.k] !== 2) { cx.g.visible = false; c.particulas(cx.x, 0.8, cx.z, 0xb9793f, 12, 6); }
    }
    // bomba: bola preta com uma cinta na cor de quem soltou, pavio e faisca; pulsa cada vez mais rapido
    const bs = c.pool('bombas', d.bombas.length, () => {
      const g = new THREE.Group();
      const bola = malha(new THREE.SphereGeometry(0.62, 16, 12), 0x1c1c24, { roughness: 0.35, emissive: 0xff2a00, emissiveIntensity: 0 });
      const cinta = malha(new THREE.TorusGeometry(0.66, 0.11, 8, 20), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 }); cinta.rotation.x = Math.PI / 2; cinta.castShadow = false;
      const pavio = malha(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 6), 0xd9b98a); pavio.position.y = 0.75;
      const faisca = malha(new THREE.SphereGeometry(0.2, 8, 6), 0xffe14d, { emissive: 0xffb300, emissiveIntensity: 1.6 }); faisca.position.y = 1; faisca.castShadow = false;
      g.add(bola, cinta, pavio, faisca); g.userData = { bola, cinta, faisca };
      return g;
    });
    d.bombas.forEach((b, n) => {
      const [x, z] = centro(b.i, b.k), pulso = (Math.sin(t * (8 + 12 / (b.t + 0.3))) + 1) / 2, u = bs[n].userData, cor = corDe(c, b.dono);
      bs[n].position.set(x, 0.65, z); bs[n].scale.setScalar(1 + pulso * 0.3);
      u.bola.material.emissiveIntensity = pulso; u.cinta.material.color.set(cor); u.cinta.material.emissive.set(cor);
      u.faisca.scale.setScalar(0.8 + Math.random() * 0.9);
    });
    const fs = c.pool('fogo', d.fogo.length, () => {
      const g = new THREE.Group();
      const fora = malha(new THREE.BoxGeometry(1.9, 0.8, 1.9), 0xff6a00, { emissive: 0xff5500, emissiveIntensity: 0.45, roughness: 1 }); fora.castShadow = false;
      const miolo = malha(new THREE.BoxGeometry(1.1, 0.9, 1.1), 0xffd23f, { emissive: 0xffb300, emissiveIntensity: 0.5, roughness: 1 }); miolo.castShadow = false;
      g.add(fora, miolo);
      return g;
    });
    d.fogo.forEach((f, n) => {
      const [x, z] = centro(f.i, f.k), s = 0.4 + Math.max(0, f.t) * 1.2;
      fs[n].scale.set(1, s, 1); fs[n].position.set(x, 0.4 * s, z);
      if (Math.random() < dt * 12) c.particulas(x, 0.8, z, 0xffd84d, 1, 5);
    });
    // itens: prato branco com a peca de cada tipo em cima, girando
    const PECA = {
      bomba: () => malha(new THREE.SphereGeometry(0.42, 12, 10), 0x1c1c24, { roughness: 0.35 }),
      fogo: () => malha(new THREE.ConeGeometry(0.42, 0.9, 7), 0xff5a1a, { emissive: 0xff3a00, emissiveIntensity: 1.1 }),
      patins: () => {
        const g = new THREE.Group(), prancha = malha(new THREE.BoxGeometry(1, 0.16, 0.46), 0x19d3c5, { emissive: 0x0a6a62 });
        g.add(prancha);
        for (const s of [-1, 1]) { const roda = malha(new THREE.CylinderGeometry(0.14, 0.14, 0.56, 10), 0x16161c); roda.rotation.x = Math.PI / 2; roda.position.set(s * 0.32, -0.14, 0); g.add(roda); }
        return g;
      },
      passa: () => {
        const g = new THREE.Group(), cx = malha(new THREE.BoxGeometry(0.62, 0.62, 0.62), 0xb9793f), seta = malha(new THREE.ConeGeometry(0.3, 0.6, 8), 0xffffff, { emissive: 0xaaaaaa });
        seta.rotation.z = -Math.PI / 2; seta.position.set(0.5, 0, 0); g.add(cx, seta);
        return g;
      },
    };
    for (const tipo of Object.keys(PECA)) {
      const lista = d.itens.filter(it => it.tipo === tipo);
      const ps = c.pool('item-' + tipo, lista.length, () => {
        const g = new THREE.Group(), prato = malha(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 20), 0xffffff, { emissive: 0x999999 }), m = PECA[tipo]();
        prato.castShadow = false; m.position.y = 0.55; g.add(prato, m); g.userData.m = m;
        return g;
      });
      lista.forEach((it, n) => {
        const [x, z] = centro(it.i, it.k);
        ps[n].position.set(x, 0.1, z); ps[n].userData.m.rotation.y = t * 2; ps[n].userData.m.position.y = 0.6 + Math.sin(t * 3 + it.i + it.k) * 0.12;
      });
    }

    c.bonecos.forEach((b, i) => {
      const alvo = pecas.vidas[i], dentro = !d.fora[i];
      b.visible = b.position.y > -12 && !(dentro && d.protecao[i] > 0 && p.fase === 'jogando' && Math.floor(t * 12) % 2 === 0);     // protegido pisca
      alvo.g.visible = dentro && d.vidas[i] > 0;
      alvo.g.position.set(b.position.x, 3.2, b.position.z - 1.2);       // acima do nome, visto do alto
      alvo.pips.forEach((m, k) => { m.visible = k < d.vidas[i]; });
    });
    for (const e of d.fx.splice(0)) {
      const [x, z] = e.x === undefined ? centro(e.i, e.k) : [e.x, e.z];
      if (e.tipo === 'bum') { c.particulas(x, 0.9, z, 0xff7a1a, 14, 9); }
      else if (e.tipo === 'pego') { c.particulas(x, 1, z, corDe(c, e.quem), 22, 10); c.particulas(x, 1, z, 0xffffff, 10, 7); }
      else if (e.tipo === 'pegou') { c.particulas(x, 1, z, 0xffffff, 18, 7); c.som(880, 0.12, 'square', 0.12); }
      else if (e.tipo === 'voltou') c.particulas(x, 1, z, 0xffffff, 16, 6);
      else c.particulas(x, 0.8, z, 0x999999, 10, 5);
    }
  },
};
