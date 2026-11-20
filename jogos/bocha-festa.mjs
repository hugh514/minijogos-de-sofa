// Bocha de todos (Festa: todos contra todos ou times). Sao 3 rodadas e em cada uma todos miram e lancam ao mesmo tempo:
// arraste para tras no celular e solte (estilingue). Os discos deslizam e se batem; quando param, o mais perto do centro
// leva 3 pontos, o segundo 2 e o terceiro 1 (disco que cai da pista nao pontua). Quem nao lanca na janela tem o disco
// lancado sozinho, fraco. Vence a maior soma das 3 rodadas (em times, a soma dos dois); soma igual da empate.
import { colide, timeDe, quem } from '../logica.mjs';

export const RODADAS = 3, PONTOS = [3, 2, 1], T_MIRA = 6, T_ROLA = 4, T_PAUSA = 1.6, TEMPO = 36;
export const R_ARENA = 8, R_DISCO = 0.7, SAIDA = 5.6;
const R_BONECO = 7.1, V_MAX = 12, F_SOZINHO = 0.3, ATRITO_K = 1.2, ATRITO_C = 1.5, ARRASTO_CHEIO = 0.9, ARRASTO_MIN = 0.08, SETA = 4;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];
const ANGULOS = { 2: [Math.PI, 0], 3: [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6], 4: [-3 * Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, Math.PI / 4] };

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o ponto: do jogador ou do time
const corDe = (c, i) => (c.p.modo === 'times' ? c.times[timeDe(c.p, i)] : c.cores[i]);
const lugar = (p, i, raio) => { const a = ANGULOS[p.jogadores.length][i]; return { x: Math.cos(a) * raio, z: Math.sin(a) * raio }; };
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };
const texto = (p, i, t) => { if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t }; };

// Estilingue: devolve { dx, dz, f } (direcao oposta ao arrasto, forca de 0,2 a 1) no quadro em que o dedo solta.
function estilingue(m, ent) {
  let tiro = null;
  if (ent.d && !m.d) { m.x0 = ent.x; m.y0 = ent.y; }
  if (ent.d) { m.ax = ent.x - m.x0; m.ay = ent.y - m.y0; }
  else if (m.d) { tiro = pontaria(m); m.ax = m.ay = 0; }
  m.d = ent.d;
  return tiro;
}
function pontaria(m) {
  const len = Math.hypot(m.ax, m.ay);
  if (!(len > ARRASTO_MIN)) return null;
  return { dx: -m.ax / len, dz: -m.ay / len, f: Math.max(0.2, Math.min(1, len / ARRASTO_CHEIO)) };
}

function desliza(o, dt) {
  const v = Math.hypot(o.vx, o.vz);
  if (v < 0.05) { o.vx = o.vz = 0; return; }
  const nv = Math.max(0, v * Math.exp(-ATRITO_K * dt) - ATRITO_C * dt);
  o.vx *= nv / v; o.vz *= nv / v; o.x += o.vx * dt; o.z += o.vz * dt;
}

function novaRodada(p) {
  const d = p.dados;
  d.fase = 'mira'; d.tempo = T_MIRA; d.lider = -1; d.ganhos = p.jogadores.map(() => 0);
  d.discos = p.jogadores.map((_, i) => ({ ...lugar(p, i, SAIDA), vx: 0, vz: 0, dono: i, lancado: false, fora: false, cai: 0 }));
  d.mira = p.jogadores.map(j => ({ d: !!j.ent?.d, x0: j.ent?.x ?? 0, y0: j.ent?.y ?? 0, ax: 0, ay: 0 }));
  d.inventario = p.jogadores.map(() => ['Rodada ' + d.rodada]);
  p.jogadores.forEach((_, i) => { texto(p, i, `Rodada ${d.rodada} de ${RODADAS}: arraste para trás e solte!`); vibra(p, i); });
}

function lanca(p, i, tiro) {
  const o = p.dados.discos[i];
  o.vx = tiro.dx * tiro.f * V_MAX; o.vz = tiro.dz * tiro.f * V_MAX; o.lancado = true;
  texto(p, i, 'Lançou! Olhe para a tela');
  p.eventos.push('dash');
}

// Fim da rodada: 3, 2 e 1 pela ordem de distancia do centro. Mesma distancia, mesmos pontos; disco que caiu nao pontua.
function pontua(p) {
  const d = p.dados, de = dono(p), dist = d.discos.map(o => (o.fora ? Infinity : Math.hypot(o.x, o.z)));
  let primeiro = -1;
  p.jogadores.forEach((_, i) => {
    const pos = dist[i] === Infinity ? -1 : dist.filter(v => v < dist[i] - 1e-6).length;
    d.ganhos[i] = PONTOS[pos] ?? 0; d.pontos[i] += d.ganhos[i]; d.placar[de(i)] += d.ganhos[i];
    if (pos === 0 && primeiro < 0) primeiro = i;
    texto(p, i, pos < 0 ? `Seu disco caiu. Total: ${d.pontos[i]}` : `${pos + 1}º lugar: ${d.ganhos[i]} ponto${d.ganhos[i] === 1 ? '' : 's'}. Total: ${d.pontos[i]}`);
  });
  d.aviso = primeiro < 0 ? 'Ninguém pontuou!' : quem(p, primeiro) + ' mais perto!';
  if (primeiro >= 0) { vibra(p, primeiro); d.fx.push({ x: d.discos[primeiro].x, y: 0.6, z: d.discos[primeiro].z, cor: -2, q: 26, forca: 7 }); }
  p.eventos.push('ponto');
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fecha(p) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : [])), v = lideres.length === 1 ? lideres[0] : -1;
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!';
  p.jogadores.forEach((_, i) => texto(p, i, v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu'));
  return v;
}

export default {
  id: 'bocha-festa', genero: 'mira', nome: 'Bocha de todos',
  dica: 'Todos ao mesmo tempo: arraste para trás, solte e deixe o seu disco o mais perto do centro!',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'toque' }, semMovimento: true, semDash: true, semPulo: true,
  semNome: true,        // o nome flutuante ficaria em cima do disco de quem esta na frente
  rotulo: 'pontos', duracao: TEMPO,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: false };
    p.jogadores.forEach((j, i) => Object.assign(j, lugar(p, i, R_BONECO)));
    p.dados = { rodada: 1, pontos: Array(n).fill(0), placar: Array(p.modo === 'times' ? 2 : n).fill(0), fx: [], aviso: '', avisoCor: '#ffd84d' };
    novaRodada(p);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores;
    js.forEach((j, i) => Object.assign(j, lugar(p, i, R_BONECO), { vx: 0, vz: 0 }));

    if (d.fase === 'mira') {
      d.tempo -= dt;
      js.forEach((j, i) => {
        if (d.discos[i].lancado) return;
        let tiro = estilingue(d.mira[i], j.ent);
        if (!tiro && d.tempo <= 0) {                           // acabou a janela: sai com a mira atual, ou fraco e meio torto rumo ao centro
          const o = d.discos[i], a = Math.atan2(-o.z, -o.x) + (p.rng() - 0.5) * 0.5;
          tiro = pontaria(d.mira[i]) ?? { dx: Math.cos(a), dz: Math.sin(a), f: F_SOZINHO };
        }
        if (tiro) lanca(p, i, tiro);
      });
      d.aviso = d.tempo > T_MIRA - 1.2 ? `Rodada ${d.rodada} de ${RODADAS}` : d.tempo <= 3 && d.tempo > 0 ? String(Math.ceil(d.tempo)) : '';
      if (d.discos.every(o => o.lancado)) { d.fase = 'rola'; d.tempo = 0; d.aviso = ''; }
    } else if (d.fase === 'rola') d.tempo += dt;

    // fisica dos discos: deslizam, se batem e caem da pista
    // disco ainda nao lancado nao e atingido: ninguem perde a rodada antes de jogar
    const vivos = d.discos.filter(o => !o.fora && o.lancado);
    for (const o of vivos) desliza(o, dt);
    for (let i = 0; i < vivos.length; i++)
      for (let k = i + 1; k < vivos.length; k++) {
        const a = vivos[i], b = vivos[k], forca = Math.hypot(a.vx - b.vx, a.vz - b.vz);
        if (colide(a, b, R_DISCO, R_DISCO, 1, 1, 2) && forca > 0.5) {
          p.eventos.push('batida');
          d.fx.push({ x: (a.x + b.x) / 2, y: 0.4, z: (a.z + b.z) / 2, cor: -1, q: 10, forca: Math.min(6, 2 + forca * 0.3) });
        }
      }
    for (const o of d.discos) {
      if (o.fora) { o.cai += dt; o.x += o.vx * dt; o.z += o.vz * dt; continue; }
      if (Math.hypot(o.x, o.z) > R_ARENA) {
        o.fora = true; p.eventos.push('queda'); vibra(p, o.dono);
        d.fx.push({ x: o.x, y: 0.3, z: o.z, cor: o.dono, q: 16, forca: 5 });
      }
    }

    // quem esta mais perto do centro agora, entre os ja lancados (so para o destaque)
    d.lider = -1;
    let menor = Infinity;
    d.discos.forEach((o, i) => {
      const r = Math.hypot(o.x, o.z);
      if (o.lancado && !o.fora && r < menor) { menor = r; d.lider = i; }
    });

    if (d.fase === 'rola' && (d.tempo > T_ROLA || vivos.every(o => o.vx === 0 && o.vz === 0))) {
      for (const o of d.discos) if (!o.fora) o.vx = o.vz = 0;
      pontua(p); d.fase = 'pausa'; d.tempo = T_PAUSA;
    } else if (d.fase === 'pausa') {
      d.tempo -= dt;
      if (d.tempo <= 0) {
        if (d.rodada >= RODADAS) return fecha(p);
        d.rodada++; d.aviso = ''; novaRodada(p); p.eventos.push('troca');
      }
    }
    if (p.t >= TEMPO) return fecha(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const chapa = (r0, r1, cor, y, extra) => {
      const m = malha(new THREE.RingGeometry(r0, r1, 56), cor, { side: THREE.DoubleSide, roughness: 0.8, ...extra });
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.castShadow = false; grupo.add(m); return m;
    };
    // pista de feltro verde com o alvo pintado: faixas claras e o miolo dourado
    chapa(0, R_ARENA - 0.12, 0x1f7a5c, 0.02);
    chapa(R_ARENA - 0.5, R_ARENA - 0.12, 0xb8823f, 0.03);
    chapa(0, 3.6, 0x2f9c76, 0.03); chapa(3.45, 3.6, 0xf4f1e6, 0.04);
    chapa(0, 2.1, 0xf4f1e6, 0.05);
    chapa(0, 0.85, 0xffc531, 0.06, { emissive: 0xffa400, emissiveIntensity: 0.5 });
    // lugar de saida de cada um, na cor dele (em times, do time)
    p.jogadores.forEach((_, i) => { const l = lugar(p, i, SAIDA); chapa(R_DISCO + 0.12, R_DISCO + 0.34, corDe(c, i), 0.05).position.set(l.x, 0.05, l.z); });

    pecas.lider = malha(new THREE.TorusGeometry(R_DISCO + 0.22, 0.11, 8, 32), 0xffd84d, { emissive: 0xffd84d, emissiveIntensity: 1 });
    pecas.lider.rotation.x = Math.PI / 2; pecas.lider.castShadow = false; grupo.add(pecas.lider);
    pecas.kit = p.jogadores.map((_, i) => {
      const cor = corDe(c, i), g = new THREE.Group();
      // disco: base na cor do dono, aro claro e um pino no meio
      const base = malha(new THREE.CylinderGeometry(R_DISCO, R_DISCO, 0.3, 28), cor, { roughness: 0.35 });
      const tampa = malha(new THREE.CylinderGeometry(R_DISCO * 0.62, R_DISCO * 0.62, 0.06, 24), 0xf4f1e6, { roughness: 0.4 }); tampa.position.y = 0.17;
      const pino = malha(new THREE.CylinderGeometry(0.16, 0.2, 0.26, 12), cor, { roughness: 0.35 }); pino.position.y = 0.3;
      g.add(base, tampa, pino);
      const vez = malha(new THREE.TorusGeometry(R_DISCO + 0.3, 0.09, 8, 32), cor, { emissive: cor, emissiveIntensity: 0.8 });
      vez.rotation.x = Math.PI / 2; vez.castShadow = false;
      const seta = new THREE.Group();
      const haste = malha(new THREE.BoxGeometry(1, 0.12, 0.3), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 });
      const ponta = malha(new THREE.ConeGeometry(0.45, 0.9, 12), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.7 }); ponta.rotation.z = -Math.PI / 2;
      seta.add(haste, ponta);
      grupo.add(g, vez, seta);
      return { g, vez, seta, haste, ponta };
    });
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const { pecas, p } = c, d = p.dados;
    pecas.kit.forEach((k, i) => {
      const o = d.discos[i], mirando = d.fase === 'mira' && !o.lancado;
      k.g.position.set(o.x, 0.2 - 12 * o.cai * o.cai, o.z);
      k.g.rotation.x = o.fora ? o.cai * 6 : 0;
      k.g.visible = o.cai < 1.5;
      k.vez.visible = mirando;
      if (mirando) { k.vez.position.set(o.x, 0.12, o.z); k.vez.scale.setScalar(1 + 0.15 * Math.sin(t * 8 + i)); }
      const tiro = mirando && d.mira[i].d ? pontaria(d.mira[i]) : null;
      k.seta.visible = !!tiro;
      if (!tiro) return;
      const comp = 0.8 + tiro.f * SETA, cor = tiro.f > 0.85 ? 0xff4a4a : 0xffffff;       // vermelho: forca quase no maximo
      k.seta.position.set(o.x, 0.6, o.z);
      k.seta.rotation.y = Math.atan2(-tiro.dz, tiro.dx);
      k.haste.scale.x = comp; k.haste.position.x = R_DISCO + comp / 2;
      k.ponta.position.x = R_DISCO + comp + 0.4;
      for (const m of [k.haste, k.ponta]) { m.material.color.set(cor); m.material.emissive.set(cor); }
    });
    const lider = d.discos[d.lider];
    pecas.lider.visible = !!lider;
    if (lider) { pecas.lider.position.set(lider.x, 0.5, lider.z); pecas.lider.scale.setScalar(d.fase === 'pausa' ? 1.15 + 0.15 * Math.sin(t * 10) : 1); }

    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx];
      c.particulas(f.x, f.y, f.z, f.cor === -1 ? 0xffffff : f.cor === -2 ? 0xffd84d : corDe(c, f.cor), f.q, f.forca);
    }
  },
};
