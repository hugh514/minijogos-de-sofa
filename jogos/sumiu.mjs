// Sumiu!: formas coloridas aparecem por 5 s e somem. Cada celular recebe uma pergunta diferente sobre o que
// havia na arena, com 4 numeros. Acerto vale 1; se os dois acertam, quem respondeu primeiro leva +1 de bonus.
import { posiciona, maiorPlacar } from '../logica.mjs';

const FORMAS = [['Quantas', 'esferas', 0], ['Quantas', 'caixas', 0], ['Quantos', 'cones', 1]];   // [pergunta, nome, masculino]
const NOME_COR = [['vermelhas', 'vermelhos'], ['azuis', 'azuis'], ['amarelas', 'amarelos']];
const HEX = [0xe5383b, 0x2f7df6, 0xffd23f];
const RODADAS = 3, T_MOSTRA = 5, T_PERGUNTA = 7, T_REVELA = 1.5;
const XS = [-6, -3, 0, 3, 6], ZS = [-2.6, 1.4];
const DUR = { mostra: T_MOSTRA, pergunta: T_PERGUNTA, revela: T_REVELA };

function perguntas(objs) {
  const conta = f => objs.filter(f).length, l = [{ texto: 'Quantos objetos ao todo?', resp: objs.length }];
  FORMAS.forEach(([q, nome, masc], f) => {
    l.push({ texto: `${q} ${nome}?`, resp: conta(o => o.forma === f) });
    NOME_COR.forEach((nc, c) => l.push({ texto: `${q} ${nome} ${nc[masc]}?`, resp: conta(o => o.forma === f && o.cor === c) }));
  });
  NOME_COR.forEach((nc, c) => l.push({ texto: `Quantos objetos ${nc[1]}?`, resp: conta(o => o.cor === c) }));
  return l;
}

function novaRodada(p) {
  const d = p.dados, n = 6 + Math.floor(p.rng() * 5) % 5;
  const vagas = XS.flatMap(x => ZS.map(z => [x, z]));
  d.objs = [];
  for (let k = 0; k < n; k++) {
    const [[x, z]] = vagas.splice(Math.floor(p.rng() * vagas.length) % vagas.length, 1);
    d.objs.push({ forma: Math.floor(p.rng() * 3) % 3, cor: Math.floor(p.rng() * 3) % 3, x: x + (p.rng() - 0.5) * 0.8, z: z + (p.rng() - 0.5) * 0.8 });
  }
  const l = perguntas(d.objs), a = Math.floor(p.rng() * l.length) % l.length;
  const b = (a + 1 + Math.floor(p.rng() * (l.length - 1)) % (l.length - 1)) % l.length;      // sempre diferente de a
  d.perg = [l[a], l[b]].map(q => {
    const ini = Math.max(0, q.resp - Math.floor(p.rng() * 4) % 4);
    return { ...q, opcoes: [0, 1, 2, 3].map(k => String(ini + k)) };
  });
  d.resp = [null, null];
  d.fase = 'mostra'; d.tempo = T_MOSTRA; d.aviso = '';
  for (const i of [0, 1]) p.celular[i] = { modo: 'espera', texto: 'Olhe a tela e decore as formas e as cores!', vibra: d.vibra[i] };
}

function espera(p, i, texto) { p.celular[i] = { modo: 'espera', texto, vibra: p.dados.vibra[i] }; }

export default {
  id: 'sumiu', nome: 'Sumiu!',
  dica: 'Decore as formas e as cores. Quando sumirem, responda a pergunta no seu celular!',
  semMovimento: true, controle: { modo: 'espera' }, rotulo: 'pontos',

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 10, lz: 6.2, parede: true };
    posiciona(p, 8.6, 0);
    for (const j of p.jogadores) j.z = 4.6;
    p.dados = { placar: [0, 0], rodada: 0, vibra: [0, 0], fx: [] };
    novaRodada(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.tempo -= dt;
    if (d.fase === 'mostra') {
      if (d.tempo > 0) return;
      d.fase = 'pergunta'; d.tempo = T_PERGUNTA; d.aviso = 'SUMIU!'; d.avisoCor = '#ffd84d';
      p.eventos.push('troca');
      for (const i of [0, 1]) p.celular[i] = { modo: 'opcoes', texto: d.perg[i].texto, opcoes: d.perg[i].opcoes, vibra: ++d.vibra[i] };
    } else if (d.fase === 'pergunta') {
      p.jogadores.forEach((j, i) => {
        const e = j.escolha, q = d.perg[i];
        if (e < 0 || e > 3 || d.resp[i]) return;
        const certa = q.opcoes[e] === String(q.resp);
        d.resp[i] = { certa, t: p.t };
        d.fx.push({ tipo: certa ? 'ok' : 'erro', quem: i });
        if (certa) { d.placar[i]++; p.eventos.push('moeda'); espera(p, i, `Certo! A resposta era ${q.resp}`); }
        else {
          if (j.y === 0) j.vy = 7;                       // susto
          d.vibra[i]++; p.eventos.push('batida'); espera(p, i, `Errou! A resposta era ${q.resp}`);
        }
      });
      const [a, b] = d.resp;
      if (d.tempo > 0 && !(a && b)) return;
      if (a?.certa && b?.certa && a.t !== b.t) {         // os dois acertaram: bonus para o mais rapido
        const i = a.t < b.t ? 0 : 1;
        d.placar[i]++; d.fx.push({ tipo: 'bonus', quem: i }); p.eventos.push('gol');
        espera(p, i, `Certo e mais rápido: bônus de +1! A resposta era ${d.perg[i].resp}`);
      }
      for (const i of [0, 1]) if (!d.resp[i]) espera(p, i, `Tempo esgotado! A resposta era ${d.perg[i].resp}`);
      d.fase = 'revela'; d.tempo = T_REVELA; d.aviso = '';
    } else if (d.tempo <= 0) {
      if (++d.rodada >= RODADAS) return maiorPlacar(p);
      novaRodada(p);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    pecas.geos = [new THREE.SphereGeometry(0.95, 22, 16), new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.ConeGeometry(0.95, 1.9, 22)];
    pecas.objs = []; pecas.visto = 0; pecas.escala = 0; pecas.fase = '';
    pecas.barra = malha(new THREE.BoxGeometry(12, 0.3, 0.4), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 });
    pecas.barra.position.set(0, 0.15, 5.7);
    grupo.add(pecas.barra);
  },

  desenha(c, dt, t) {
    const d = c.p.dados, pc = c.pecas, js = c.p.jogadores;
    if (pc.objsDe !== d.objs) {                           // rodada nova: troca as formas
      pc.objsDe = d.objs;
      for (const m of pc.objs) { c.grupo.remove(m); m.material.dispose(); }
      pc.objs = d.objs.map(o => {
        const m = c.malha(pc.geos[o.forma], HEX[o.cor], { emissive: HEX[o.cor], emissiveIntensity: 0.25 });
        m.position.set(o.x, o.forma === 1 ? 0.8 : 0.95, o.z); m.rotation.y = o.forma === 1 ? o.x : 0;
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
    for (const m of pc.objs) { m.visible = pc.escala > 0.03; m.scale.setScalar(Math.max(0.001, pc.escala)); }

    for (; pc.visto < d.fx.length; pc.visto++) {
      const f = d.fx[pc.visto], j = js[f.quem];
      if (f.tipo === 'ok') { c.som(880, 0.2, 'triangle', 0.2); c.particulas(j.x, 1.5, j.z, 0x3ddc7a, 26, 8); }
      else if (f.tipo === 'bonus') { c.som(1175, 0.35, 'triangle', 0.2); c.particulas(j.x, 2, j.z, 0xffd23f, 40, 11); }
      else { c.som(140, 0.35, 'sawtooth', 0.2); c.particulas(j.x, 1.5, j.z, 0xff2a2a, 26, 8); }
    }

    const f = Math.max(0, Math.min(1, d.tempo / DUR[d.fase]));
    const cor = d.fase === 'mostra' ? 0xffffff : d.fase === 'revela' ? 0x3ddc7a : f > 0.4 ? 0xffd23f : 0xff2a2a;
    pc.barra.scale.x = Math.max(0.001, f); pc.barra.material.color.set(cor); pc.barra.material.emissive.set(cor);
  },
};
