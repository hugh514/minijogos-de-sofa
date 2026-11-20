// Sumiu! em grupo (Festa: todos contra todos ou times). Formas diferentes, cada uma de uma cor, aparecem por alguns segundos e somem.
// A mesma pergunta vai para a TV e para todos os celulares ("Qual cor era o cone?" ou "Qual forma era vermelha?") e todos respondem
// ao mesmo tempo, uma vez so. Acerto vale 1 ponto e o primeiro a acertar leva mais 1 de bonus; erro nao tira ponto. Sao 4 rodadas,
// cada uma com mais formas e menos tempo para decorar, e a ultima vale em dobro. Vence a maior soma (em times, a soma da dupla);
// somas iguais empatam.
import { timeDe, quem } from '../logica.mjs';

export const RODADAS = 4, LIMITE = 44;
export const FORMAS = [{ nome: 'bola', art: 'a' }, { nome: 'cubo', art: 'o' }, { nome: 'cone', art: 'o' }, { nome: 'estrela', art: 'a' }, { nome: 'anel', art: 'o' }];
// cores das formas: nenhuma e cor de jogador (azul, rosa, verde, amarelo) nem de time (laranja, roxo)
export const CORES = [
  { nome: 'Vermelho', o: 'vermelho', a: 'vermelha', hex: 0xe5383b, css: '#ff5a5a' },
  { nome: 'Branco', o: 'branco', a: 'branca', hex: 0xf4f4f4, css: '#f4f4f4' },
  { nome: 'Turquesa', o: 'turquesa', a: 'turquesa', hex: 0x12c9c0, css: '#2fd9d0' },
  { nome: 'Marrom', o: 'marrom', a: 'marrom', hex: 0xa85a1e, css: '#b06a35' },
];
const N_OBJS = [3, 4, 5, 5], T_MOSTRA = [4, 3.5, 3, 3], T_PERGUNTA = 5, T_REVELA = 2.2, T_INTRO = 1.2;
const XS = [-7, -3.5, 0, 3.5, 7], Z_OBJ = -1.4, PASSO_X = 4.4, Z = 4.4;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o ponto: do jogador ou do time
const lider = placar => { const m = Math.max(...placar), l = placar.flatMap((v, k) => (v === m ? [k] : [])); return l.length === 1 ? l[0] : -1; };
const sorteia = (p, n) => Math.floor(p.rng() * n) % n;
const valorDe = d => (d.rodada === RODADAS - 1 ? 2 : 1);              // a ultima rodada vale em dobro: da para virar
const maiuscula = s => s[0].toUpperCase() + s.slice(1);
function embaralha(p, lista) {
  const l = lista.slice();
  for (let k = l.length - 1; k > 0; k--) { const r = sorteia(p, k + 1); [l[k], l[r]] = [l[r], l[k]]; }
  return l;
}

function novaRodada(p) {
  const d = p.dados, n = N_OBJS[d.rodada];
  const formas = embaralha(p, FORMAS.map((_, f) => f)), lugares = embaralha(p, XS);
  const cores = embaralha(p, CORES.flatMap((_, c) => [c, c]));       // no maximo duas formas da mesma cor
  d.objs = Array.from({ length: n }, (_, k) => ({ forma: formas[k], cor: cores[k], x: lugares[k], z: Z_OBJ }));
  const unicas = d.objs.flatMap((o, k) => (d.objs.filter(x => x.cor === o.cor).length === 1 ? [k] : []));
  if (unicas.length && p.rng() < 0.45) {                 // "Qual forma era vermelha?": so quando uma forma so tinha a cor
    const alvo = unicas[sorteia(p, unicas.length)], o = d.objs[alvo];
    const outras = embaralha(p, FORMAS.map((_, f) => f).filter(f => f !== o.forma)).slice(0, 3);
    const ops = embaralha(p, [o.forma, ...outras]);
    d.perg = { tipo: 'forma', alvo, texto: `Qual forma era ${CORES[o.cor].a}?`, opcoes: ops.map(f => maiuscula(FORMAS[f].nome)), resp: ops.indexOf(o.forma), era: `Era ${FORMAS[o.forma].art} ${FORMAS[o.forma].nome}!` };
  } else {
    const alvo = sorteia(p, n), o = d.objs[alvo], f = FORMAS[o.forma];
    d.perg = { tipo: 'cor', alvo, texto: `Qual cor era ${f.art} ${f.nome}?`, opcoes: CORES.map(c => c.nome), resp: o.cor, era: `Era ${CORES[o.cor][f.art]}!` };
  }
  d.resp = p.jogadores.map(() => null); d.teveCerto = false;
  d.fase = 'mostra'; d.tempo = T_MOSTRA[d.rodada];
  d.aviso = d.rodada === RODADAS - 1 ? 'Última rodada: vale em dobro!' : 'Decore!'; d.avisoCor = '#ffd84d';
}

function telas(p, fim) {
  const d = p.dados, de = dono(p), q = d.perg;
  p.jogadores.forEach((_, i) => {
    const pontos = `Pontos: ${d.placar[de(i)]}`, r = d.resp[i];
    const foi = !r ? 'Você não respondeu.' : !r.certa ? 'Você errou.' : r.bonus ? `Certo e com bônus de mais rápido: +${r.ganho}!` : `Certo: +${r.ganho}!`;
    if (fim) p.celular[i] = { modo: 'espera', texto: fim[i], vibra: d.vibra[i] };
    else if (d.fase === 'mostra') p.celular[i] = { modo: 'espera', texto: `Olhe a TV e decore as formas e as cores. ${pontos}`, vibra: d.vibra[i] };
    else if (d.fase === 'revela') p.celular[i] = { modo: 'espera', texto: `${q.era} ${foi} ${pontos}`, vibra: d.vibra[i] };
    else if (r) p.celular[i] = { modo: 'espera', texto: `${r.certa ? foi : 'Errou!'} ${pontos}`, vibra: d.vibra[i] };
    else p.celular[i] = { modo: 'opcoes', texto: q.texto, opcoes: q.opcoes, ...(q.tipo === 'cor' ? { coresOp: CORES.map(c => c.css), linha: true } : {}), vibra: d.vibra[i] };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff';
  telas(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

export default {
  id: 'sumiu-festa', genero: 'memoria', nome: 'Sumiu! em grupo',
  dica: 'Decore as formas e as cores. Quando sumirem, responda no celular. O mais rápido leva bônus.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  semMovimento: true, controle: { modo: 'espera' }, rotulo: 'pontos', duracao: LIMITE,
  tema: 2,              // noite, com um palco cinza-azulado embaixo das formas: as quatro cores aparecem bem nele

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: 10, lz: 6.2, parede: true };
    p.jogadores.forEach((j, i) => { j.x = (i - (n - 1) / 2) * PASSO_X; j.z = Z; });
    p.dados = { placar: Array(p.modo === 'times' ? 2 : n).fill(0), rodada: 0, vibra: Array(n).fill(0), fx: [] };
    novaRodada(p);
    telas(p);
  },

  atualiza(p, dt) {
    const d = p.dados, de = dono(p);
    d.tempo -= dt;
    if (p.t >= LIMITE) return fechaComo(p, lider(d.placar));
    if (d.fase === 'mostra') {
      if (d.tempo < T_MOSTRA[d.rodada] - T_INTRO) d.aviso = '';
      if (d.tempo <= 0) {
        d.fase = 'pergunta'; d.tempo = T_PERGUNTA; d.aviso = d.perg.texto; d.avisoCor = '#ffffff';
        d.vibra = d.vibra.map(v => v + 1); p.eventos.push('troca');
      }
    } else if (d.fase === 'pergunta') {
      const certos = [];
      p.jogadores.forEach((j, i) => {
        const e = j.escolha;
        if (e < 0 || e > 3 || d.resp[i]) return;
        if (e === d.perg.resp) return certos.push(i);
        d.resp[i] = { certa: false, ganho: 0 }; d.vibra[i]++;
        if (j.y === 0) j.vy = 7;                         // susto
        d.fx.push({ tipo: 'erro', quem: i }); p.eventos.push('batida');
      });
      const bonus = certos.length > 0 && !d.teveCerto;   // no mesmo quadro, todos os primeiros levam o bonus
      for (const i of certos) {
        const ganho = valorDe(d) * (bonus ? 2 : 1);
        d.resp[i] = { certa: true, ganho, bonus }; d.placar[de(i)] += ganho; d.teveCerto = true;
        d.fx.push({ tipo: bonus ? 'bonus' : 'ok', quem: i });
        if (p.jogadores[i].y === 0) p.jogadores[i].vy = bonus ? 9 : 6;
      }
      if (certos.length) p.eventos.push(bonus ? 'ponto' : 'moeda');
      if (d.tempo <= 0 || d.resp.every(Boolean)) {
        d.fase = 'revela'; d.tempo = T_REVELA; d.aviso = d.perg.era; d.avisoCor = '#ffd84d';
      }
    } else if (d.tempo <= 0) {
      if (d.rodada + 1 >= RODADAS) return fechaComo(p, lider(d.placar));
      d.rodada++; novaRodada(p);
    }
    telas(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    const estrela = new THREE.Shape();                   // estrela de cinco pontas
    for (let k = 0; k < 10; k++) {
      const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.55 : 1.3;
      if (k === 0) estrela.moveTo(Math.cos(a) * r, Math.sin(a) * r); else estrela.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    estrela.closePath();
    // na ordem de FORMAS: bola, cubo, cone, estrela, anel. A estrela e o anel ficam em pe, inclinados para a camera
    pecas.geos = [new THREE.SphereGeometry(1.1, 24, 16), new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.ConeGeometry(1.1, 2.3, 24),
      new THREE.ExtrudeGeometry(estrela, { depth: 0.45, bevelEnabled: false }), new THREE.TorusGeometry(0.9, 0.36, 14, 32)];
    pecas.altura = [1.1, 0.9, 1.15, 1.35, 1.35];
    pecas.objs = []; pecas.visto = 0; pecas.escala = 0; pecas.fase = '';
    pecas.barra = malha(new THREE.BoxGeometry(14, 0.3, 0.4), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 });
    pecas.barra.position.set(0, 0.15, -5.4);
    const palco = malha(new THREE.BoxGeometry(18.4, 0.12, 4.4), 0x6f7cab, { roughness: 1 }); palco.position.set(0, 0.06, Z_OBJ); palco.castShadow = false;
    grupo.add(pecas.barra, palco);
    // tapete de cada jogador, na cor dele (do time, em times): acende quando ele ja respondeu
    pecas.tapetes = p.jogadores.map((j, i) => {
      const m = malha(new THREE.CylinderGeometry(1.4, 1.4, 0.08, 28), corDe(i), { emissive: corDe(i), emissiveIntensity: 0 });
      m.position.set(j.x, 0.04, j.z); grupo.add(m); return m;
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, pc = c.pecas, js = p.jogadores;
    if (pc.objsDe !== d.objs) {                           // rodada nova: troca as formas
      pc.objsDe = d.objs;
      for (const m of pc.objs) { c.grupo.remove(m); m.material.dispose(); }
      pc.objs = d.objs.map(o => {
        const cor = CORES[o.cor].hex, m = c.malha(pc.geos[o.forma], cor, { emissive: cor, emissiveIntensity: 0.3 });
        m.position.set(o.x, pc.altura[o.forma], o.z); m.rotation.set(o.forma >= 3 ? -0.45 : 0, o.forma === 1 ? 0.5 : 0, 0);
        c.grupo.add(m); return m;
      });
      pc.escala = 0;
    }
    if (pc.fase !== d.fase) {
      pc.fase = d.fase;
      if (d.fase === 'pergunta') for (const o of d.objs) c.particulas(o.x, 1, o.z, 0xffffff, 8, 5);   // fumaca do sumico
      if (d.fase === 'revela') { c.som(523, 0.15, 'triangle', 0.15); c.som(784, 0.25, 'triangle', 0.15); }
    }
    const alvo = d.fase === 'pergunta' ? 0 : 1;
    pc.escala += (alvo - pc.escala) * Math.min(1, dt * 12);
    pc.objs.forEach((m, k) => {
      const o = d.objs[k], destaque = d.fase === 'revela' && k === d.perg.alvo;      // a forma da pergunta pula na revelacao
      m.visible = pc.escala > 0.03; m.scale.setScalar(Math.max(0.001, pc.escala * (destaque ? 1.4 : 1.15)));
      m.position.y = pc.altura[o.forma] * 1.15 + 0.12 + (destaque ? Math.abs(Math.sin(t * 7)) * 1.1 : 0);
    });

    for (; pc.visto < d.fx.length; pc.visto++) {
      const f = d.fx[pc.visto], j = js[f.quem];
      if (f.tipo === 'ok') { c.som(880, 0.2, 'triangle', 0.2); c.particulas(j.x, 1.5, j.z, 0x3ddc7a, 26, 8); }
      else if (f.tipo === 'bonus') { c.som(880, 0.15, 'triangle', 0.2); c.som(1175, 0.35, 'triangle', 0.2); c.particulas(j.x, 2, j.z, 0xffffff, 40, 11); }
      else { c.som(140, 0.35, 'sawtooth', 0.2); c.particulas(j.x, 1.5, j.z, 0xff2a2a, 26, 8); }
    }
    pc.tapetes.forEach((m, i) => { m.material.emissiveIntensity = d.fase === 'pergunta' && d.resp[i] ? 0.9 : 0; });

    const dur = d.fase === 'mostra' ? T_MOSTRA[d.rodada] : d.fase === 'pergunta' ? T_PERGUNTA : T_REVELA;
    const f = Math.max(0, Math.min(1, d.tempo / dur));
    const cor = d.fase === 'mostra' ? 0xffffff : d.fase === 'revela' ? 0x9aa3b8 : f > 0.4 ? 0xffffff : 0xff2a2a;
    pc.barra.scale.x = Math.max(0.001, f); pc.barra.material.color.set(cor); pc.barra.material.emissive.set(cor);
  },
};
