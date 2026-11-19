// Bolhas da Equipe (Festa: cooperativo, 2 a 4 jogadores).
// Bolhas coloridas nascem na beirada de baixo e sobem pelo chao ate a grade la em cima. Cada bolha de uma cor so estoura pelo
// jogador daquela cor (Estourar perto dela). Bolha de duas cores pede os DOIS: o primeiro que aperta segura a bolha (ela quase
// para) e o outro tem pouco tempo para chegar e apertar tambem. Quem nao tem bolha por perto pode apertar perto da bolha de um
// amigo para empurra-la de volta. Estourem a meta antes que escapem bolhas demais.
import { posicionaRoda, quem, RAIO } from '../logica.mjs';

export const LX = 10.5, LZ = 6.5, TEMPO = 40;
export const R_POP = 3.0, JANELA = 2.5, BR = 1.15;
const V_ANDA = 7.5, Y_BOLHA = 1.7;
const GRADE = -LZ + 0.7;                               // passou daqui, a bolha escapou
const TOTAL = [18, 23, 28];                            // bolhas que nascem, para 2, 3 e 4 jogadores

const limita = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const noiteDe = p => limita(p.noites?.jogadas ?? 0, 0, 4);
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

// Dificuldade: mais bolhas com mais jogadores; nas noites seguintes elas sobem mais depressa e a meta pede mais acertos.
export const totalDe = n => TOTAL[limita(n, 2, 4) - 2];
export const metaDe = (n, noite = 0) => Math.ceil(totalDe(n) * (0.27 + 0.02 * noite));
export const vidasDe = (n, noite = 0) => totalDe(n) - metaDe(n, noite) + 1;       // com esse tanto de bolhas fugidas a meta nao fecha mais
export const velocidade = noite => 0.9 + 0.15 * noite;

function aviso(d, texto, cor = '#ffffff', t = 2) { d.aviso = texto; d.avisoCor = cor; d.avisoT = t; }

// Proxima bolha: um baralho garante que cada jogador recebe a mesma quantidade de bolhas da sua cor, mais as de duas cores.
function proximoTipo(p, d) {
  if (!d.saco.length) {
    const n = p.jogadores.length, c = d.ciclo++;
    const lista = p.jogadores.map((_, i) => [i]);
    for (let k = 0; k < Math.max(1, Math.round(n / 2)); k++) lista.push([(c + k) % n, (c + k + 1) % n]);
    for (let k = lista.length - 1; k > 0; k--) { const m = Math.floor(p.rng() * (k + 1)); [lista[k], lista[m]] = [lista[m], lista[k]]; }
    d.saco = lista;
  }
  return d.saco.pop();
}

function nasce(p, d) {
  let x = 0, melhor = -1;
  for (let k = 0; k < 3; k++) {              // entre tres sorteios, o mais longe da ultima bolha
    const cand = (p.rng() * 2 - 1) * (LX - 1.8), longe = Math.abs(cand - d.ultimoX);
    if (longe > melhor) { melhor = longe; x = cand; }
  }
  d.ultimoX = x;
  const tipo = proximoTipo(p, d);
  d.nascidas.push(tipo);
  d.bolhas.push({ id: d.nasc++, x, z: LZ - 0.5, tipo, pegou: p.jogadores.map(() => 0), sz: 0, fase: p.rng() * 6.28 });
  if (tipo.length > 1 && !d.avisouDupla) { d.avisouDupla = true; aviso(d, 'Bolha de duas cores: os dois juntos!', '#ffd23f', 2.4); }
}

function estoura(p, d, b) {
  d.bolhas.splice(d.bolhas.indexOf(b), 1);
  d.estouradas++;
  d.fx.push({ tipo: 'pop', x: b.x, z: b.z, tipo2: b.tipo });
  p.eventos.push(b.tipo.length > 1 ? 'ponto' : 'moeda');
  for (const i of b.tipo) vibra(p, i);
  if (d.estouradas === Math.ceil(d.meta / 2)) aviso(d, 'Metade da meta! Continuem!', '#ffd23f', 1.6);
}

// O botao de i: estoura a bolha da sua cor, segura a de duas cores, ou empurra de volta a de um amigo.
function aperta(p, d, i) {
  const j = p.jogadores[i];
  const perto = d.bolhas.filter(b => dist(b, j) <= R_POP).sort((a, b) => dist(a, j) - dist(b, j));
  const minha = perto.find(b => b.tipo.includes(i));
  if (minha) {
    if (minha.tipo.length === 1) return estoura(p, d, minha);
    minha.pegou[i] = JANELA;
    if (minha.tipo.every(k => minha.pegou[k] > 0)) return estoura(p, d, minha);
    d.fx.push({ tipo: 'segura', x: minha.x, z: minha.z, i });
    p.eventos.push('troca');
    return;
  }
  const alheia = perto[0];
  if (alheia && d.sopro[i] <= 0) {
    d.sopro[i] = 0.5; alheia.sz = 7;
    d.fx.push({ tipo: 'sopro', x: alheia.x, z: alheia.z, i });
    p.eventos.push('batida');
  }
}

// O texto de cada celular: o que fazer agora.
function textoDe(p, d, i) {
  const j = p.jogadores[i];
  const seguro = d.bolhas.find(b => b.pegou[i] > 0);
  if (seguro) {
    const falta = seguro.tipo.find(k => k !== i && !(seguro.pegou[k] > 0));
    return 'Segurando! Chame ' + quem(p, falta ?? i) + ' para apertar Estourar também.';
  }
  const minhas = d.bolhas.filter(b => b.tipo.includes(i)).sort((a, b) => a.z - b.z);
  const perigo = d.bolhas.find(b => !b.tipo.includes(i) && b.tipo.length === 1 && b.z < GRADE + 3.5 && dist(b, j) < 5);
  if (perigo) return 'A bolha de ' + quem(p, perigo.tipo[0]) + ' vai escapar! Aperte Estourar perto dela.';
  const alvo = minhas[0];
  if (!alvo) return 'Espere a próxima bolha da sua cor.';
  if (alvo.tipo.length > 1) return 'Bolha de duas cores! Cheguem juntos e apertem Estourar.';
  return dist(alvo, j) <= R_POP ? 'Aperte Estourar!' : 'Chegue perto da sua bolha e aperte Estourar.';
}

export default {
  id: 'bolhas-coop', genero: 'mira', nome: 'Bolhas da Equipe',
  dica: 'Cada um estoura as bolhas da sua cor com Estourar, e as de duas cores só estouram com os dois juntos!',
  festa: { min: 2, max: 4, modos: ['coop'] },
  controle: { modo: 'padrao', a: 'Estourar', b: '' }, semPulo: true, semDash: true,
  semMod: ['espelho', 'foguete'],       // espelho e foguete tiram a graça de perseguir bolhas com o dedão
  rotulo: 'bolhas estouradas', duracao: TEMPO, semNome: true,   // os bonecos se juntam na bolha de duas cores: o nome flutuante a cobria, a cor das bolhas ja diz quem e

  camera: () => ({ x: 0, y: 19.2, z: 15.8, ox: 0, oy: 0, oz: -0.9 }),

  inicia(p) {
    p.arena = { tipo: 'ret', lx: LX, lz: LZ, parede: true };
    posicionaRoda(p, 2.4);
    const n = p.jogadores.length, noite = noiteDe(p), total = totalDe(n), cada = f => p.jogadores.map((_, i) => f(i));
    p.dados = {
      placar: [0], aviso: 'Estourem as bolhas da cor de vocês!', avisoCor: '#ffd23f', avisoT: 3.2, fx: [], avisouDupla: false, avisou10: false,
      total, meta: metaDe(n, noite), vidas: vidasDe(n, noite), noite, v: velocidade(noite), gap: (TEMPO - 9) / (total - 1),
      bolhas: [], nascidas: [], nasc: 0, proxT: 1, saco: [], ciclo: 0, ultimoX: 0, estouradas: 0, escaparam: 0,
      sopro: cada(() => 0), inventario: cada(() => []),
    };
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    if (d.avisoT > 0) { d.avisoT -= dt; if (d.avisoT <= 0) d.aviso = ''; }

    js.forEach((j, i) => {
      d.sopro[i] -= dt;
      const v = Math.hypot(j.vx, j.vz);
      if (v > V_ANDA) { j.vx *= V_ANDA / v; j.vz *= V_ANDA / v; }
      j.x = limita(j.x, -LX + RAIO, LX - RAIO); j.z = limita(j.z, -LZ + RAIO, LZ - RAIO);
    });

    while (d.nasc < d.total && p.t >= d.proxT) { nasce(p, d); d.proxT += d.gap; }
    js.forEach((j, i) => { if (j.apertouA > 0) aperta(p, d, i); });

    for (const b of [...d.bolhas]) {
      const preso = b.pegou.some(s => s > 0);
      b.pegou = b.pegou.map(s => Math.max(0, s - dt));
      b.z += (-d.v * (preso ? 0.1 : 1) + b.sz) * dt; b.sz *= Math.pow(0.04, dt);
      b.x = limita(b.x + Math.sin(p.t * 1.4 + b.fase) * 0.6 * dt, -LX + BR, LX - BR);
      b.z = Math.min(b.z, LZ - 0.2);
      if (b.z > GRADE) continue;
      d.bolhas.splice(d.bolhas.indexOf(b), 1);
      d.escaparam++;
      d.fx.push({ tipo: 'foi', x: b.x, z: GRADE, tipo2: b.tipo });
      p.eventos.push('queda');
      if (d.escaparam < d.vidas) aviso(d, 'Uma bolha escapou!', '#ff6a4a', 1.2);
    }
    if (!d.avisou10 && p.t >= TEMPO - 10) { d.avisou10 = true; aviso(d, 'Faltam 10 segundos!', '#ffb13b', 1.8); }

    d.placar = [d.estouradas];
    js.forEach((_, i) => {
      d.inventario[i] = ['Meta ' + d.estouradas + ' de ' + d.meta, 'Escaparam ' + d.escaparam + ' de ' + d.vidas];
      const texto = textoDe(p, d, i);
      if (p.celular[i].texto !== texto) p.celular[i] = { ...p.celular[i], texto };
    });

    if (d.estouradas >= d.meta) {
      aviso(d, 'Bolhas estouradas! Vocês conseguiram!', '#6bff9a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'Bolhas estouradas! Vocês foram uma ótima equipe!' }; });
      return 2;
    }
    if (d.escaparam >= d.vidas || p.t >= TEMPO) {
      aviso(d, 'Escaparam bolhas demais.', '#ff6a4a', 3);
      js.forEach((_, i) => { p.celular[i] = { ...p.celular[i], texto: 'Escaparam bolhas demais. Na próxima, ajudem um ao outro.' }; });
      return -1;
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const caixa = (w, h, l) => new THREE.BoxGeometry(w, h, l);
    const sem = m => { m.castShadow = false; return m; };
    pecas.visto = 0;

    // piso de ladrilhos lilas em xadrez, espuma branca embaixo
    for (let i = 0; i < 7; i++) for (let k = 0; k < 5; k++) {
      const l = sem(malha(caixa(LX * 2 / 7, 0.03, LZ * 2 / 5), (i + k) % 2 ? 0xe4d9f7 : 0xf3ecfd, { roughness: 0.7 }));
      l.position.set(-LX + LX / 7 + i * LX * 2 / 7, 0.03, -LZ + LZ / 5 + k * LZ * 2 / 5); grupo.add(l);
    }
    for (let k = 0; k < 11; k++) {
      const e = sem(malha(new THREE.SphereGeometry(0.7 + (k % 3) * 0.2, 10, 8), 0xffffff, { roughness: 1 }));
      e.scale.y = 0.5; e.position.set(-LX + 1 + k * 2, 0.2, LZ - 0.2 + (k % 2) * 0.15); grupo.add(e);
    }
    // grade de saida la em cima: faixa escura com setas
    const grade = malha(caixa(LX * 2, 0.5, 1.2), 0x4a3a7a, { roughness: 0.6 }); grade.position.set(0, 0.25, -LZ + 0.2); grupo.add(grade);
    for (let k = 0; k < 9; k++) { const s = sem(malha(new THREE.ConeGeometry(0.32, 0.7, 3), 0xff6a4a, { emissive: 0xff6a4a, emissiveIntensity: 0.6 })); s.position.set(-LX + 1.4 + k * 2.3, 0.62, -LZ + 0.2); s.rotation.x = -Math.PI / 2; s.rotation.z = Math.PI; grupo.add(s); }

    // prateleira do placar: vidas a esquerda (bolhas brancas que apagam quando uma escapa) e a barra da meta a direita
    const prat = malha(caixa(LX * 2 - 0.2, 0.3, 1.5), 0x5b4a9a, { roughness: 0.8 }); prat.position.set(0, 1.2, -LZ - 1.5); grupo.add(prat);
    pecas.vidas = [];
    for (let k = 0; k < 12; k++) {
      const m = sem(malha(new THREE.SphereGeometry(0.4, 12, 10), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 })); m.position.set(-LX + 1.2 + k * 0.95, 1.7, -LZ - 1.5); grupo.add(m); pecas.vidas.push(m);
    }
    const trilha = sem(malha(caixa(8.4, 0.34, 0.5), 0x3a2f66)); trilha.position.set(5.2, 1.65, -LZ - 1.5); grupo.add(trilha);
    pecas.barra = sem(malha(caixa(1, 0.4, 0.55), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.8 })); pecas.barra.position.set(1, 1.65, -LZ - 1.5); grupo.add(pecas.barra);
    pecas.estrela = sem(malha(new THREE.SphereGeometry(0.5, 12, 10), 0xffd23f, { emissive: 0xffa800, emissiveIntensity: 0.9 })); pecas.estrela.position.set(9.9, 1.7, -LZ - 1.5); grupo.add(pecas.estrela);

    // por jogador: anel da cor no chao
    pecas.aneis = c.bonecos.map((_, i) => {
      const a = sem(malha(new THREE.RingGeometry(1.1, 1.35, 28), c.cores[i], { emissive: c.cores[i], emissiveIntensity: 0.7, side: THREE.DoubleSide })); a.rotation.x = -Math.PI / 2; grupo.add(a); return a;
    });
    pecas.geo = { esfera: new THREE.SphereGeometry(BR, 22, 16), meia: new THREE.SphereGeometry(BR * 1.03, 22, 16, 0, Math.PI), brilho: new THREE.SphereGeometry(0.28, 8, 6), anel: new THREE.TorusGeometry(BR + 0.35, 0.09, 8, 28), sombra: new THREE.CylinderGeometry(0.95, 0.95, 0.03, 20), seta: new THREE.ConeGeometry(0.4, 0.8, 10) };
  },

  desenha(c, dt, t) {
    const { p, pecas, THREE } = c, d = p.dados, g = pecas.geo;
    if (!g) return;
    const cor = i => c.cores[i] ?? 0xffffff;

    // aneis no chao dos jogadores (ajuda a ver quem e quem no meio das bolhas)
    c.bonecos.forEach((b, i) => { pecas.aneis[i].position.set(b.position.x, 0.08, b.position.z); });

    // vidas e barra da meta
    pecas.vidas.forEach((m, k) => {
      m.visible = k < d.vidas; const perdida = k >= d.vidas - d.escaparam;
      m.material.color.set(perdida ? 0x3a2f66 : 0xffffff); m.material.emissive.set(perdida ? 0x000000 : 0xffffff); m.scale.setScalar(perdida ? 0.55 : 1);
    });
    const fr = limita(d.estouradas / d.meta, 0, 1), larg = Math.max(0.001, 8.4 * fr);
    pecas.barra.scale.x = larg; pecas.barra.position.x = 1 + larg / 2;
    pecas.estrela.scale.setScalar(1 + (fr >= 1 ? 0.3 * Math.sin(t * 9) : 0));

    // bolhas: esfera da primeira cor, metade da segunda (de duas cores), brilho, sombra no chao, anel e seta de quem segura
    const bs = c.pool('bolhas', d.bolhas.length, () => {
      const o = new THREE.Group();
      const a = c.malha(g.esfera, 0xffffff, { roughness: 0.25, emissive: 0x111111 }), m = c.malha(g.meia, 0xffffff, { roughness: 0.25, emissive: 0x111111 });
      const br = c.malha(g.brilho, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }); br.position.set(-0.45, 0.55, 0.55); br.castShadow = false;
      const an = c.malha(g.anel, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }); an.rotation.x = Math.PI / 2; an.castShadow = false;
      const se = c.malha(g.seta, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }); se.rotation.x = Math.PI; se.castShadow = false;
      const so = c.malha(g.sombra, 0xb9a6e0, { roughness: 1 }); so.castShadow = false;
      so.position.y = 0.07 - Y_BOLHA;
      o.add(a, m, br, an, se, so); o.userData = { a, m, an, se, so };
      return o;
    });
    d.bolhas.forEach((b, n) => {
      const o = bs[n], u = o.userData, dupla = b.tipo.length > 1, preso = b.pegou.some(s => s > 0);
      const y = Y_BOLHA + 0.18 * Math.sin(t * 3 + b.fase);
      o.position.set(b.x, y, b.z); o.rotation.y = t * 0.8 + b.fase;
      o.scale.setScalar(1 + (preso ? 0.06 * Math.sin(t * 20) : 0));
      u.a.material.color.set(cor(b.tipo[0])); u.a.material.emissive.set(cor(b.tipo[0])); u.a.material.emissiveIntensity = 0.28;
      u.m.visible = dupla; if (dupla) { u.m.material.color.set(cor(b.tipo[1])); u.m.material.emissive.set(cor(b.tipo[1])); u.m.material.emissiveIntensity = 0.28; u.m.rotation.y = Math.PI * 0.5; }
      const dono = preso ? b.pegou.findIndex(s => s > 0) : -1;
      u.an.visible = u.se.visible = preso;
      if (preso) { u.an.material.color.set(cor(dono)); u.an.material.emissive.set(cor(dono)); u.an.scale.setScalar(1 + 0.12 * Math.sin(t * 9)); u.se.position.y = BR + 1.1 + 0.25 * Math.sin(t * 8); u.se.material.color.set(cor(dono)); u.se.material.emissive.set(cor(dono)); }
      u.so.scale.setScalar(0.9 + 0.1 * Math.sin(t * 3 + b.fase));
    });

    // faiscas
    for (; pecas.visto < d.fx.length; pecas.visto++) {
      const e = d.fx[pecas.visto];
      if (e.tipo === 'pop') e.tipo2.forEach(i => c.particulas(e.x, Y_BOLHA, e.z, cor(i), e.tipo2.length > 1 ? 18 : 14, 8));
      else if (e.tipo === 'foi') c.particulas(e.x, 1.2, e.z, 0xff6a4a, 10, 5);
      else if (e.tipo === 'segura') c.particulas(e.x, Y_BOLHA, e.z, cor(e.i), 8, 4);
      else c.particulas(e.x, 1.2, e.z, 0xffffff, 6, 4);
    }
  },
};
