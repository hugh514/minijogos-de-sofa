// Eco: um cria um ritmo de 4 batidas, a tela toca de volta uma vez e o outro repete de ouvido. Depois trocam.
// Na segunda vez a TV e o celular mostram a nota que o segundo precisa passar, e nota igual desempata pelo erro em milissegundos.
import { RAIO } from '../logica.mjs';

const N = 4, JANELA = 4, T_ESPERA = 3, T_PREP = 1.5, T_PAUSA = 0.9, T_DEPOIS = 0.5, T_FOLGA = 1, T_SOBRA = 0.5;
const T_NOTA = 2.2, T_FIM = 2.5, REBOTE = 0.1, PENA = 0.5, ERRO_ZERO = 0.4;
const T_PREP_1 = 3.2;                                   // o primeiro aviso (ligar o som) fica mais tempo
const X = 5.5, Z = 1.6, PISTA_X0 = -4.2, PISTA_ESC = 1.5, PISTA_MAX = 4.4;

// Erro medio (em segundos) entre os intervalos do ritmo e os da imitacao. Batida faltando ou sobrando custa PENA.
export function erroMedio(ritmo, bat) {
  let soma = 0;
  for (let i = 1; i < ritmo.length; i++)
    soma += i < bat.length ? Math.min(PENA, Math.abs((ritmo[i] - ritmo[i - 1]) - (bat[i] - bat[i - 1]))) : PENA;
  soma += PENA * Math.max(0, bat.length - ritmo.length);
  return soma / (ritmo.length - 1);
}
// Quem venceu pelas notas; nota igual desempata pelo erro (menor ganha, se a diferenca passar de 5 ms). -1 e empate.
export function quemVenceu(notas, erros) {
  if (notas[0] !== notas[1]) return notas[0] > notas[1] ? 0 : 1;
  if (Math.abs(erros[0] - erros[1]) <= 0.005) return -1;
  return erros[0] < erros[1] ? 0 : 1;
}
export const nota = erro => Math.round(100 * Math.max(0, 1 - erro / ERRO_ZERO));

// Menos de 4 batidas: completa com batidas regulares (no passo medio do que ja foi batido).
export function completa(bat) {
  const r = bat.map(t => t - (bat[0] ?? 0));
  const passo = r.length >= 2 ? Math.max(0.2, Math.min(0.6, r[r.length - 1] / (r.length - 1))) : 0.5;
  while (r.length < N) r.push(r.length ? r[r.length - 1] + passo : 0);
  return r;
}

function pulso(p, quem) { const d = p.dados; d.pulso = { n: d.pulso.n + 1, quem }; }

function fase(p, nome) { const d = p.dados; d.fase = nome; d.k = 0; d.ini = null; d.bat = []; d.tocadas = 0; }

// Na segunda vez, quem imita precisa passar a nota que o outro tirou na primeira.
const aBater = p => (p.dados.turno === 1 ? p.dados.notas[p.dados.criador] : null);

function celulares(p) {
  const d = p.dados, cr = d.criador, im = 1 - cr, v = d.vibra = (d.vibra ?? 0) + 1;
  const espera = texto => ({ modo: 'espera', texto });
  const som = d.turno === 0 && d.fase === 'prepara' ? 'Ligue o som da TV. ' : '';      // jogo de ouvido
  if (d.fase === 'prepara' || d.fase === 'cria') {
    p.celular[cr] = { modo: 'botao', a: 'BATE', texto: som + 'Você cria o ritmo: bata 4 vezes!', vibra: v };
    p.celular[im] = espera(som + 'O outro está criando o ritmo. Escute bem: depois é você quem repete!');
  } else if (d.fase === 'toca') {
    p.celular[cr] = espera('Seu ritmo está tocando. Agora o outro tem que repetir.');
    p.celular[im] = espera('Escute o eco na tela. Já já você repete!');
  } else if (d.fase === 'imita') {
    p.celular[cr] = espera('O outro está tentando repetir o seu ritmo.');
    p.celular[im] = { modo: 'botao', a: 'BATE', texto: aBater(p) === null ? 'Repita o ritmo: 4 batidas no mesmo compasso!' : `Repita o ritmo. Passe de ${aBater(p)} para vencer!`, vibra: v };
  } else {
    for (const i of [0, 1]) p.celular[i] = espera(d.notas[i] === null ? 'Olhe para a tela!' : `Sua precisão: ${d.notas[i]}`);
  }
}

// Batidas novas do jogador neste quadro (com filtro de toque duplo). Devolve true se bateu.
function bate(p, i) {
  const d = p.dados, j = p.jogadores[i];
  if (!j.apertouA) return false;
  if (d.ini === null) d.ini = d.k;
  const t = d.k - d.ini;
  if (d.bat.length && t - d.bat[d.bat.length - 1] < REBOTE) return false;
  d.bat.push(t); pulso(p, i);
  if (j.y <= 0) j.vy = 3.5;                         // o boneco da um pulinho a cada batida
  return true;
}

// Um quadro do jogo (o atualiza abaixo so acrescenta as luzes da TV depois).
function passoEco(p, dt) {
  const d = p.dados, cr = d.criador, im = 1 - cr;
  p.jogadores.forEach((j, i) => { j.x = i ? X : -X; j.z = Z; j.vx = j.vz = 0; });
  d.k += dt;

  if (d.fase === 'prepara') {
    const primeira = d.turno === 0;
    d.aviso = primeira ? 'Ligue o som da TV!' : `Jogador ${cr + 1} cria o ritmo! O outro precisa passar de ${aBater(p)}`; d.avisoCor = primeira ? '#ffd84d' : '#ffffff';
    if (d.k >= (primeira ? T_PREP_1 : T_PREP)) { d.ritmo = []; d.eco = []; fase(p, 'cria'); }
  } else if (d.fase === 'cria') {
    bate(p, cr);
    d.aviso = `Jogador ${cr + 1}: bata ${N} vezes! (${d.bat.length}/${N})`; d.avisoCor = '#ffd84d';
    const acabou = d.bat.length >= N || (d.ini === null ? d.k >= T_ESPERA : d.k - d.ini >= JANELA);
    if (acabou) {
      d.ritmo = completa(d.bat.slice(0, N));
      fase(p, 'toca'); celulares(p); p.eventos.push('troca');
    }
  } else if (d.fase === 'toca') {
    d.aviso = `Escute o eco... ${d.tocadas}/${N}`; d.avisoCor = '#7ad7ff';
    while (d.tocadas < N && d.k >= T_PAUSA + d.ritmo[d.tocadas]) { d.tocadas++; pulso(p, -1); }
    if (d.k >= T_PAUSA + d.ritmo[N - 1] + T_DEPOIS) { fase(p, 'imita'); celulares(p); }
  } else if (d.fase === 'imita') {
    bate(p, im);
    d.eco = d.bat;
    d.aviso = `Jogador ${im + 1}: repita! (${Math.min(N, d.bat.length)}/${N})`; d.avisoCor = '#ffd84d';
    const t = d.ini === null ? 0 : d.k - d.ini;
    const acabou = d.ini === null ? d.k >= T_ESPERA
      : t >= d.ritmo[N - 1] + T_FOLGA || (d.bat.length >= N && t - d.bat[N - 1] >= T_SOBRA);
    if (acabou) {
      d.erros[im] = erroMedio(d.ritmo, d.bat);
      d.notas[im] = d.placar[im] = nota(d.erros[im]);
      fase(p, 'nota'); d.eco = d.eco.length ? d.eco : []; celulares(p);
      p.eventos.push(d.notas[im] >= 70 ? 'gol' : d.notas[im] >= 35 ? 'moeda' : 'queda');
      if (d.notas[im] >= 70) p.jogadores[im].vy = 8;
    }
  } else if (d.fase === 'nota') {
    d.aviso = `Precisão do Jogador ${im + 1}: ${d.notas[im]}`; d.avisoCor = '#ffd84d';
    if (d.k >= T_NOTA) {
      if (++d.turno < 2) { d.criador = im; fase(p, 'prepara'); celulares(p); }
      else {
        
        d.vencedor = quemVenceu(d.notas, d.erros);
        fase(p, 'fim');
        if (d.vencedor >= 0) { p.jogadores[d.vencedor].vy = 9; p.eventos.push('gol'); }
      }
    }
  } else {
    d.aviso = d.vencedor < 0 ? `Empate no ritmo: ${d.notas[0]} a ${d.notas[1]}` : `Jogador ${d.vencedor + 1} tem o melhor ouvido! ${d.notas[0]} a ${d.notas[1]}`; d.avisoCor = '#ffd84d';
    if (d.k >= T_FIM) return d.vencedor;
  }

}

export default {
  id: 'eco', genero: 'memoria', nome: 'Eco', dica: 'Jogo de ouvido: ligue o som da TV. Um bate 4 toques, o outro escuta e repete. Depois troca!',
  semMovimento: true, semDash: true, semPulo: true, rotulo: 'precisão', controle: { modo: 'botao', a: 'BATE' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9, lz: 5, parede: true };
    p.dados = {
      placar: [0, 0], notas: [null, null], erros: [null, null], turno: 0, criador: p.rng() < 0.5 ? 0 : 1,
      ritmo: [], eco: [], pulso: { n: 0, quem: -1 }, luzes: 0, aviso: '', avisoCor: '#ffffff',
    };
    fase(p, 'prepara');
    celulares(p);
  },

  atualiza(p, dt) {
    const r = passoEco(p, dt);
    const d = p.dados;
    d.luzes = d.fase === 'toca' ? d.tocadas : d.fase === 'cria' || d.fase === 'imita' ? d.bat.length : 0;     // notas ja soadas nesta fase: acendem as luzes da TV
    return r;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    const brilho = (cor, forca = 0.6) => ({ emissive: cor, emissiveIntensity: forca });
    pecas.n = 0; pecas.bate = [0, 0, 0]; pecas.ondas = []; pecas.fase = '';

    // tambor gigante no centro: a pele acende a cada batida
    const corpo = malha(new THREE.CylinderGeometry(1.7, 1.45, 1.1, 28), 0x8a3b1e); corpo.position.set(0, 0.55, 0.4);
    pecas.pele = malha(new THREE.CylinderGeometry(1.62, 1.62, 0.12, 28), 0xf4e6c8, brilho(0xffd84d, 0));
    pecas.pele.position.set(0, 1.14, 0.4);
    grupo.add(corpo, pecas.pele);
    for (const y of [0.2, 0.95]) {
      const aro = malha(new THREE.TorusGeometry(1.62, 0.09, 8, 32), 0xffc531, { metalness: 0.6, roughness: 0.3 });
      aro.rotation.x = Math.PI / 2; aro.position.set(0, y, 0.4); grupo.add(aro);
    }

    // tambor, baquetas e anel de vez de cada jogador
    pecas.tambor = []; pecas.anel = [];
    for (const i of [0, 1]) {
      const x = i ? X : -X, dentro = i ? -1 : 1;
      const t = malha(new THREE.CylinderGeometry(0.75, 0.6, 0.9, 20), cores[i], brilho(cores[i], 0.15));
      t.position.set(x + dentro * 1.7, 0.45, Z + 0.3);
      const pele = malha(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 20), 0xf4e6c8); pele.position.y = 0.47; t.add(pele);
      const anel = malha(new THREE.TorusGeometry(1.25, 0.1, 8, 30), cores[i], brilho(cores[i], 1));
      anel.rotation.x = Math.PI / 2; anel.position.set(x, 0.06, Z);
      grupo.add(t, anel); pecas.tambor.push(t); pecas.anel.push(anel);
    }

    // duas pistas no fundo: em cima o ritmo original (dourado), embaixo a imitacao (cor de quem imita)
    const pista = (y, z, cor) => {
      const b = malha(new THREE.BoxGeometry(9.6, 0.16, 0.3), cor, brilho(cor, 0.25)); b.position.set(0, y, z); grupo.add(b);
      for (const x of [-4.9, 4.9]) {
        const poste = malha(new THREE.CylinderGeometry(0.1, 0.14, y, 8), 0x59627f); poste.position.set(x, y / 2, z); grupo.add(poste);
      }
      return b;
    };
    pecas.pistas = [pista(3.1, -3.6, 0x4a4f6e), pista(1.9, -3.0, 0x4a4f6e)];
    const marca = (cor, y, z) => [0, 1, 2, 3, 4, 5, 6, 7].map(() => {
      const m = malha(new THREE.SphereGeometry(0.36, 16, 12), cor, brilho(cor, 0.8));
      m.position.set(0, y, z); m.visible = false; grupo.add(m); return m;
    });
    pecas.marcasRitmo = marca(0xffd84d, 3.1, -3.6).slice(0, N);
    pecas.marcasEco = marca(0xffffff, 1.9, -3.0);
    pecas.cursor = malha(new THREE.BoxGeometry(0.12, 2.1, 0.12), 0xffffff, brilho(0xffffff, 1));
    pecas.cursor.visible = false; grupo.add(pecas.cursor);

    // 4 luzes grandes na frente do tambor: cada nota (de quem cria, do eco e de quem imita) acende a proxima. Sinal visual para quem esta sem som.
    pecas.pips = [0, 1, 2, 3].map(k => {
      const m = malha(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 24), 0x39405e, { emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });
      m.position.set((k - 1.5) * 1.7, 0.08, 3.5); grupo.add(m); return m;
    });

    // caixas de som nos cantos (o cone pulsa) e cordao de luzes
    pecas.cones = [];
    for (const lado of [-1, 1]) {
      const cx = malha(new THREE.BoxGeometry(1.5, 2.4, 1.2), 0x23273a); cx.position.set(lado * 7.6, 1.2, -3.6);
      cx.rotation.y = -lado * 0.5;
      for (const [y, r] of [[0.55, 0.38], [-0.45, 0.55]]) {
        const cone = malha(new THREE.CylinderGeometry(r, r * 0.6, 0.18, 18), 0x9aa3c2, brilho(0x7ad7ff, 0.2));
        cone.rotation.x = Math.PI / 2; cone.position.set(0, y, 0.62); cx.add(cone); pecas.cones.push(cone);
      }
      grupo.add(cx);
    }
    pecas.luzes = [];
    const TONS = [0xff4a4a, 0xffd84d, 0x35c26b, 0x7ad7ff, 0xa259ff];
    for (let k = 0; k < 11; k++) {
      const l = malha(new THREE.SphereGeometry(0.16, 10, 8), TONS[k % 5], brilho(TONS[k % 5], 1));
      const u = k / 10 - 0.5;
      l.position.set(u * 16, 4.3 - Math.cos(u * Math.PI) * 0.5, -4.4); grupo.add(l); pecas.luzes.push(l);
    }
  },

  desenha(c, dt, t) {
    const { THREE, pecas: q, cores, malha, grupo } = c, d = c.p.dados, cr = d.criador, im = 1 - cr;
    const px = s => Math.min(PISTA_MAX, PISTA_X0 + s * PISTA_ESC);

    if (d.pulso.n !== q.n) {                        // batida nova: som, faisca e onda
      q.n = d.pulso.n;
      const quem = d.pulso.quem, cor = quem < 0 ? 0xffd84d : cores[quem];
      q.bate[2] = 1; if (quem >= 0) q.bate[quem] = 1;
      if (quem < 0) { c.som(330, 0.16, 'triangle', 0.3); c.som(165, 0.2, 'sine', 0.3); c.particulas(0, 1.4, 0.4, cor, 16, 6); }
      else {
        c.som(quem === cr && d.fase === 'cria' ? 330 : 247, 0.14, 'triangle', 0.3); c.som(110, 0.12, 'sine', 0.25);
        const tb = q.tambor[quem].position; c.particulas(tb.x, 1.1, tb.z, cor, 10, 5);
      }
      let onda = q.ondas.find(o => !o.visible);
      if (!onda && q.ondas.length < 8) {
        onda = malha(new THREE.TorusGeometry(1, 0.07, 6, 40), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 1, transparent: true });
        onda.rotation.x = Math.PI / 2; onda.castShadow = false; grupo.add(onda); q.ondas.push(onda);
      }
      if (onda) {
        onda.visible = true; onda.userData.k = 0;
        onda.material.color.set(cor); onda.material.emissive.set(cor);
        onda.position.set(quem < 0 ? 0 : q.tambor[quem].position.x, 0.08, quem < 0 ? 0.4 : q.tambor[quem].position.z);
      }
    }
    for (const o of q.ondas) {
      if (!o.visible) continue;
      o.userData.k += dt * 1.6;
      o.scale.setScalar(0.8 + o.userData.k * 6); o.material.opacity = Math.max(0, 1 - o.userData.k);
      if (o.userData.k >= 1) o.visible = false;
    }
    for (let i = 0; i < 3; i++) q.bate[i] = Math.max(0, q.bate[i] - dt * 5);

    const corLuz = d.fase === 'toca' ? 0xffd84d : cores[d.fase === 'imita' ? im : cr];
    q.pips.forEach((m, k) => {
      const acesa = k < d.luzes, nova = acesa && k === d.luzes - 1 ? q.bate[2] + q.bate[0] + q.bate[1] : 0;
      m.material.color.set(acesa ? corLuz : 0x39405e); m.material.emissive.set(corLuz);
      m.material.emissiveIntensity = acesa ? 0.9 + Math.min(1, nova) * 1.6 : 0;
      m.scale.set(1 + Math.min(1, nova) * 0.35, 1 + Math.min(1, nova) * 1.2, 1 + Math.min(1, nova) * 0.35);
    });

    q.pele.material.emissiveIntensity = q.bate[2] * 1.2;
    q.pele.position.y = 1.14 - q.bate[2] * 0.1;
    q.cones.forEach(k => k.scale.setScalar(1 + q.bate[2] * 0.35));
    q.luzes.forEach((l, k) => { l.material.emissiveIntensity = 0.35 + 0.65 * (Math.sin(t * 5 + k * 1.3) > 0 ? 1 : 0) + q.bate[2]; });

    // de quem e a vez: anel aceso no chao e tambor que afunda na batida
    const vez = d.fase === 'cria' || d.fase === 'prepara' ? cr : d.fase === 'imita' ? im : -1;
    for (const i of [0, 1]) {
      q.anel[i].visible = vez === i;
      q.anel[i].scale.setScalar(1 + Math.sin(t * 7) * 0.06);
      q.tambor[i].scale.set(1 + q.bate[i] * 0.15, 1 - q.bate[i] * 0.25, 1 + q.bate[i] * 0.15);
      q.tambor[i].material.emissiveIntensity = 0.15 + q.bate[i] + (vez === i ? 0.25 : 0);
      c.bonecos[i].position.y = RAIO + c.p.jogadores[i].y;
    }

    // pista de cima: o ritmo. Aparece enquanto e criado e tocado, some na imitacao e volta na nota para comparar
    const criando = d.fase === 'cria', mostraRitmo = d.fase === 'toca' || d.fase === 'nota';
    const ritmo = criando ? d.bat : d.ritmo;
    q.marcasRitmo.forEach((m, k) => {
      m.visible = (criando || mostraRitmo) && k < ritmo.length;
      if (!m.visible) return;
      m.position.x = px(ritmo[k]);
      const tocando = d.fase === 'toca' ? Math.max(0, 1 - Math.abs(d.k - T_PAUSA - ritmo[k]) * 5) : 0;
      m.scale.setScalar(1 + tocando * 0.7);
      m.material.emissiveIntensity = d.fase === 'toca' ? 0.3 + tocando * 1.5 : 0.8;
    });
    // pista de baixo: as batidas de quem imita, alinhadas pela primeira
    const mostraEco = d.fase === 'imita' || d.fase === 'nota';
    q.marcasEco.forEach((m, k) => {
      m.visible = mostraEco && k < d.eco.length;
      if (!m.visible) return;
      m.position.x = px(d.eco[k]);
      const sobra = k >= N;
      m.material.color.set(sobra ? 0xff4a4a : cores[im]); m.material.emissive.set(sobra ? 0xff2a2a : cores[im]);
      m.scale.setScalar(d.fase === 'nota' ? 1 + Math.sin(t * 8 + k) * 0.1 : 1);
    });
    q.pistas[0].material.emissive.set(0xffd84d); q.pistas[0].material.color.set(d.fase === 'imita' ? 0x2b2e42 : 0x6b5a2a);
    q.pistas[1].material.emissive.set(cores[im]); q.pistas[1].material.emissiveIntensity = mostraEco ? 0.6 : 0.1;

    // cursor: varre a pista de cima no eco e a de baixo na imitacao
    const s = d.fase === 'toca' ? d.k - T_PAUSA : d.fase === 'imita' && d.ini !== null ? d.k - d.ini : d.fase === 'cria' && d.ini !== null ? d.k - d.ini : -1;
    q.cursor.visible = s >= 0;
    if (s >= 0) {
      const baixo = d.fase === 'imita';
      q.cursor.scale.y = 0.45;
      q.cursor.position.set(px(s), baixo ? 1.9 : 3.1, baixo ? -2.95 : -3.55);
    }

    if (q.fase !== d.fase) {                        // viradas de fase
      if (d.fase === 'nota') {
        const n = d.notas[im] ?? 0, b = c.bonecos[im].position;
        c.particulas(b.x, 2, b.z, n >= 70 ? 0xffd84d : n >= 35 ? cores[im] : 0x8a8fa8, n >= 70 ? 50 : 18, n >= 70 ? 11 : 6);
        c.som(n >= 70 ? 880 : n >= 35 ? 523 : 147, 0.35, n >= 35 ? 'triangle' : 'sawtooth', 0.2);
      }
      if (d.fase === 'fim' && d.vencedor >= 0) c.particulas(d.vencedor ? X : -X, 2.5, Z, cores[d.vencedor], 60, 12);
      q.fase = d.fase;
    }
    for (const i of [0, 1]) {                       // nota baixa: boneco murcho. Boa: boneco esticado
      const n = d.notas[i], murcho = (d.fase === 'nota' && i === im && n < 35) || (d.fase === 'fim' && d.vencedor === 1 - i);
      c.bonecos[i].scale.set(murcho ? 1.15 : 1, murcho ? 0.7 : 1, murcho ? 1.15 : 1);
    }
  },
};
