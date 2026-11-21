// Sequencia em grupo (Festa: todos contra todos ou times). A tela pisca uma sequencia de cores e depois todos a repetem ao mesmo
// tempo, cada um no seu celular (a tela nao mostra o que cada um toca, so o quanto ja avancou). Errar ou demorar tira 1 vida e
// deixa fora ate a sequencia seguinte; sem vidas, sai. A cada volta a sequencia ganha 2 cores. Quando a volta fecha e so resta um
// (ou um time), ele vence; se todos os que restavam cairam na mesma volta, empata. Aos 50 s vence quem tem mais vidas (em times,
// a soma das duas), e iguais empatam.
import { posicionaCantos, timeDe, quem, elimina } from '../logica.mjs';

export const VIDAS = 2, LIMITE = 50, INICIO = 2, CRESCE = 2;
const CORES = ['Vermelho', 'Azul', 'Verde', 'Amarelo'];
const HEX = [0xe5383b, 0x2f7df6, 0x35c26b, 0xffd23f];
const CSS = ['#ff4a4a', '#4a9bff', '#3ddc7a', '#ffd84d'];
const NOTAS = [262, 330, 392, 523];
const POS = [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]];   // grade 2x2 igual ao celular (1 2 / 3 4)
const T_ANTES = 0.9, T_COR = 0.5, T_DEPOIS = 0.3, T_FECHA = 0.9, LARG = 2.6;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];
export const prazoDe = n => 2.5 + n;                                 // segundos para repetir n cores

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);
const lider = placar => { const m = Math.max(...placar), l = placar.flatMap((v, k) => (v === m ? [k] : [])); return l.length === 1 ? l[0] : -1; };
const cor = p => Math.floor(p.rng() * 4) % 4;
// Placar da rodada: vidas de cada um, ou a soma do time.
function placarDe(p) {
  const d = p.dados, de = dono(p), r = Array(p.modo === 'times' ? 2 : p.jogadores.length).fill(0);
  d.vidas.forEach((v, i) => { r[de(i)] += v; });
  return r;
}

function telas(p, fim) {
  const d = p.dados, n = d.seq.length;
  p.jogadores.forEach((_, i) => {
    const vidas = `Vidas: ${d.vidas[i]}`, e = d.estado[i];
    const texto = fim ? fim[i] : e === 'fora' ? 'Você saiu. Agora é torcer!' : e === 'errou' ? `Errou! ${vidas}` : e === 'certo' ? `Acertou! ${vidas}`
      : d.fase === 'repete' ? `Repita: cor ${d.pos[i] + 1} de ${n}. ${vidas}` : `Olhe a TV e decore ${n} cores. ${vidas}`;
    p.celular[i] = !fim && e === 'joga' && d.fase === 'repete' ? { modo: 'opcoes', texto, opcoes: CORES, coresOp: CSS, vibra: d.vibra[i] } : { modo: 'espera', texto, vibra: d.vibra[i] };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.placar = placarDe(p);
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff';
  telas(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

function novaVolta(p, quantas) {
  const d = p.dados;
  for (let k = 0; k < quantas; k++) d.seq.push(cor(p));
  d.fase = 'mostra'; d.t = 0; d.mostrou = 0;
  d.pos = d.vidas.map(() => 0);
  d.estado = d.vidas.map(v => (v > 0 ? 'joga' : 'fora'));
}

function erra(p, i) {
  const d = p.dados;
  d.vidas[i]--; d.vibra[i]++;
  d.estado[i] = d.vidas[i] > 0 ? 'errou' : 'fora';
  d.fx.push({ erro: i });
  if (d.vidas[i] > 0) p.eventos.push('queda');
  else { p.eventos.push('explosao'); elimina(p, p.jogadores[i]); }
}

export default {
  id: 'sequencia-festa', genero: 'memoria', nome: 'Sequência em grupo',
  dica: 'Decore as cores que piscam na TV e repita no celular. Errou, perde 1 vida. O último de pé vence.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  semMovimento: true, controle: { modo: 'espera' }, rotulo: 'vidas', duracao: LIMITE,
  tema: 2,              // noite: o cenario sorteado (roxo) engolia a cor do time roxo

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: 9.5, lz: 6, parede: true };
    posicionaCantos(p, 7.2, 3);
    for (const j of p.jogadores) j.z -= 0.6;
    p.dados = { seq: [], vidas: Array(n).fill(VIDAS), vibra: Array(n).fill(0), fx: [], aviso: '', avisoCor: '#ffffff' };
    novaVolta(p, INICIO);
    p.dados.placar = placarDe(p);
    telas(p);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, n = d.seq.length;
    d.t += dt;
    if (p.t >= LIMITE) return fechaComo(p, lider(placarDe(p)));
    if (d.fase === 'mostra') {
      d.aviso = d.t < T_ANTES ? 'Decore!' : '';
      while (d.mostrou < n && d.t >= T_ANTES + d.mostrou * T_COR) d.fx.push({ cor: d.seq[d.mostrou++] });
      if (d.t >= T_ANTES + n * T_COR + T_DEPOIS) {
        d.fase = 'repete'; d.t = 0;
        d.estado.forEach((e, i) => { if (e === 'joga') d.vibra[i]++; });       // hora de olhar o celular
      }
    } else if (d.fase === 'repete') {
      d.aviso = d.t < 0.9 ? 'Repitam!' : '';
      js.forEach((j, i) => {
        const e = j.escolha;
        if (d.estado[i] !== 'joga' || e < 0 || e > 3) return;
        if (e !== d.seq[d.pos[i]]) return erra(p, i);
        d.fx.push({ toque: i });
        if (++d.pos[i] < n) return;
        d.estado[i] = 'certo'; d.fx.push({ certo: i }); p.eventos.push('moeda');
        if (j.y === 0) j.vy = 6;
      });
      if (d.t >= prazoDe(n)) d.estado.forEach((e, i) => { if (e === 'joga') erra(p, i); });
      if (!d.estado.includes('joga')) {                                         // a volta fechou: quem ainda tem vida?
        const lados = [...new Set(d.vidas.flatMap((v, i) => (v > 0 ? [dono(p)(i)] : [])))];
        if (lados.length < 2) return fechaComo(p, lados[0] ?? -1);
        d.fase = 'fecha'; d.t = 0; d.aviso = '';
      }
    } else if (d.t >= T_FECHA) novaVolta(p, CRESCE);
    d.placar = placarDe(p);
    telas(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    const base = malha(new THREE.BoxGeometry(7.4, 0.2, 7.4), 0x23233a); base.position.y = 0.1; grupo.add(base);
    pecas.blocos = HEX.map((cor, i) => {
      const m = malha(new THREE.BoxGeometry(3, 1, 3), cor, { emissive: cor, emissiveIntensity: 0.15 });
      m.position.set(POS[i][0], 0.7, POS[i][1]); grupo.add(m); return m;
    });
    pecas.brilho = [0, 0, 0, 0]; pecas.visto = 0;
    // barra do prazo para repetir, na frente
    pecas.prazo = malha(new THREE.BoxGeometry(7.4, 0.3, 0.5), 0x35c26b, { emissive: 0x35c26b, emissiveIntensity: 0.6 });
    pecas.prazo.position.set(0, 0.15, 4.6); grupo.add(pecas.prazo);
    // de cada jogador: tapete na cor dele (do time, em times), trilho na frente com a barra do quanto ja repetiu e, do lado de dentro, as bolas das vidas
    pecas.barras = []; pecas.vidas = []; pecas.pisca = p.jogadores.map(() => 0);
    p.jogadores.forEach((j, i) => {
      const cor = corDe(i), zf = j.z + 1.9, dentro = j.x - (Math.sign(j.x) || 1) * 2.25;
      const tapete = malha(new THREE.CylinderGeometry(1.35, 1.35, 0.08, 28), cor); tapete.position.set(j.x, 0.04, j.z); grupo.add(tapete);
      const trilho = malha(new THREE.BoxGeometry(LARG + 0.3, 0.14, 0.8), 0x3a3f5a); trilho.position.set(j.x, 0.07, zf); grupo.add(trilho);
      const barra = malha(new THREE.BoxGeometry(LARG, 0.4, 0.5), cor, { emissive: cor, emissiveIntensity: 0.5 });
      barra.position.set(j.x, 0.3, zf); grupo.add(barra); pecas.barras[i] = barra;
      pecas.vidas[i] = Array.from({ length: VIDAS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.44, 14, 10), cor, { emissive: cor, emissiveIntensity: 0.5 });
        m.position.set(dentro, 0.45, j.z + (k - (VIDAS - 1) / 2) * 1.1); grupo.add(m); return m;
      });
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, pc = c.pecas, js = p.jogadores, n = d.seq.length;
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    for (; pc.visto < d.fx.length; pc.visto++) {
      const f = d.fx[pc.visto];
      if (f.cor !== undefined) {
        pc.brilho[f.cor] = 1;
        c.som(NOTAS[f.cor], 0.3, 'sine', 0.25);
        c.particulas(POS[f.cor][0], 1.6, POS[f.cor][1], HEX[f.cor], 14, 5);
      } else if (f.toque !== undefined) c.som(660, 0.06, 'square', 0.08);
      else if (f.certo !== undefined) { const j = js[f.certo]; c.som(880, 0.2, 'triangle', 0.2); c.particulas(j.x, 1.5, j.z, corDe(f.certo), 24, 7); }
      else { const j = js[f.erro]; pc.pisca[f.erro] = 1; c.som(110, 0.5, 'sawtooth', 0.25); c.particulas(j.x, 1.2, j.z, 0xff2a2a, 34, 9); }
    }
    pc.blocos.forEach((m, i) => {
      pc.brilho[i] = Math.max(0, pc.brilho[i] - dt * 2.6);
      m.material.color.set(HEX[i]).multiplyScalar(0.45 + 0.55 * pc.brilho[i]);      // apagado e escuro; o da vez acende de verdade
      m.material.emissiveIntensity = 0.05 + pc.brilho[i] * 1.9;
      m.scale.y = 1 + pc.brilho[i] * 0.8;               // o bloco da vez sobe e acende
      m.position.y = 0.2 + 0.5 * m.scale.y;
    });
    const f = d.fase === 'repete' ? Math.max(0, Math.min(1, 1 - d.t / prazoDe(n))) : 0, corPrazo = f > 0.5 ? 0x35c26b : f > 0.25 ? 0xffd23f : 0xff2a2a;
    pc.prazo.visible = f > 0; pc.prazo.scale.x = Math.max(0.001, f); pc.prazo.material.color.set(corPrazo); pc.prazo.material.emissive.set(corPrazo);
    js.forEach((j, i) => {
      const e = d.estado[i], feito = e === 'certo' ? 1 : n ? d.pos[i] / n : 0, barra = pc.barras[i];
      pc.pisca[i] = Math.max(0, pc.pisca[i] - dt * 1.5);
      const corBarra = e === 'errou' || e === 'fora' || pc.pisca[i] > 0 ? 0xff2a2a : e === 'certo' ? 0xffffff : corDe(i);
      barra.visible = feito > 0 || e === 'errou'; barra.scale.x = Math.max(0.001, e === 'errou' ? 1 : feito);
      barra.position.x = j.x - LARG / 2 + LARG * barra.scale.x / 2;             // cresce da esquerda para a direita
      barra.material.color.set(corBarra); barra.material.emissive.set(corBarra);
      pc.vidas[i].forEach((m, k) => { m.visible = k < d.vidas[i]; m.position.y = 0.45 + (pc.pisca[i] > 0 ? Math.abs(Math.sin(t * 18)) * 0.25 : 0); });
    });
  },
};
