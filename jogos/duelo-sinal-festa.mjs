// Duelo do sinal (Festa: todos contra todos ou times). Todos esperam a luz VERDE; o primeiro a apertar depois dela ganha o ponto da
// rodada. Quem aperta antes queima a largada e fica fora daquela rodada; se so sobra um lado sem queimar, o ponto e dele, e se todos
// queimam ninguem pontua. Ha sinais falsos (luz amarela, vermelha, "Quase..." e vibracao). Primeiro a 3 vence; aos 45 s vence quem
// estiver na frente sozinho, e lideres iguais empatam. Em times o ponto e do time.
import { timeDe, quem, elimina } from '../logica.mjs';

export const VITORIAS = 3, LIMITE = 45;
const PAUSA = 1.5, T_FALSO = 0.5, T_DORME = 3, PASSO_X = 4.4, Z = 0.8;
const FALSOS = ['amarela', 'vermelha', 'quase', 'vibra'];
const LUZ = { apagada: 0x9aa3b8, amarela: 0xffd21f, vermelha: 0xff2a2a, verde: 0x2bff6a };
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o ponto: do jogador ou do time
const lider = placar => { const m = Math.max(...placar), l = placar.flatMap((v, k) => (v === m ? [k] : [])); return l.length === 1 ? l[0] : -1; };
const nomeDe = (p, k) => (p.modo === 'times' ? NOMES_TIMES[k] : quem(p, k));
const lugar = (p, i) => (i - (p.jogadores.length - 1) / 2) * PASSO_X;       // todos em fila, de frente para o sinal
const vibra = (p, i) => { p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 }; };

function telas(p, fim) {
  const d = p.dados, de = dono(p);
  p.jogadores.forEach((_, i) => {
    const pontos = `Pontos: ${d.placar[de(i)]} de ${VITORIAS}`;
    const t = fim ? fim[i] : d.fora[i] ? `Queimou a largada! Fora desta rodada. ${pontos}`
      : d.fase === 'pausa' ? (d.ganhou < 0 ? `Ninguém pontuou. ${pontos}` : d.ganhou === de(i) ? `Ponto! ${pontos}` : `Ponto do rival. ${pontos}`)
      : d.fase === 'verde' ? 'Já! Aperte!' : `Espere a luz verde. ${pontos}`;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t, modo: !fim && !d.fora[i] ? 'botao' : 'espera' };       // quem queimou fica sem o botao ate a proxima largada
  });
}

function novoRound(p) {
  const d = p.dados, n = p.jogadores.length;
  p.jogadores.forEach((j, i) => { j.x = lugar(p, i); j.z = Z; j.vx = j.vz = j.vy = 0; j.y = 0; });
  d.fase = 'espera'; d.t = 0; d.luz = 'apagada'; d.ganhou = -1;
  d.fora = Array(n).fill(false);
  d.tVerde = 1.8 + p.rng() * 3.2;
  d.falsos = [];
  for (let t = 0.9 + p.rng() * 0.8; t < d.tVerde - 0.6; t += 0.7 + p.rng() * 1.1)
    if (p.rng() < 0.75) d.falsos.push({ t, tipo: FALSOS[Math.floor(p.rng() * FALSOS.length) % FALSOS.length], quem: Math.floor(p.rng() * (n + 1)), feito: false });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : nomeDe(p, v) + ' venceu!'; d.avisoCor = '#ffffff'; d.luz = 'apagada';
  telas(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

// lado: o jogador (ou o time) que leva o ponto da rodada, ou -1 (ninguem pontua). Devolve o vencedor quando alguem chega a 3.
function fimRound(p, lado, aviso, cor) {
  const d = p.dados, de = dono(p);
  d.fase = 'pausa'; d.t = 0; d.luz = 'apagada'; d.aviso = aviso; d.avisoCor = cor; d.ganhou = lado;
  if (lado < 0) { p.eventos.push('troca'); telas(p); return; }
  d.placar[lado]++;
  p.eventos.push('ponto');
  const acabou = d.placar[lado] >= VITORIAS;
  p.jogadores.forEach((j, i) => {
    if (de(i) === lado) { if (j.y === 0) j.vy = 8; d.fx.push({ tipo: 'ponto', i }); }
    else if (acabou) elimina(p, j, 12);
  });
  if (acabou) return fechaComo(p, lado);
  telas(p);
}

export default {
  id: 'duelo-sinal-festa', genero: 'reflexo', nome: 'Largada relâmpago',
  dica: 'Espere a luz verde e aperte primeiro. Apertou antes? Fica fora da rodada. Quem fizer 3 vence.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  semMovimento: true, controle: { modo: 'botao', a: 'Já!' }, rotulo: 'largadas', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 9.5, lz: 5, parede: true };
    p.dados = { placar: Array(p.modo === 'times' ? 2 : p.jogadores.length).fill(0), fx: [], aviso: '', avisoCor: '#ffffff' };
    novoRound(p);
    telas(p);
  },

  atualiza(p, dt) {
    const d = p.dados, js = p.jogadores, de = dono(p);
    d.t += dt;
    if (p.t >= LIMITE) return fechaComo(p, lider(d.placar));
    if (d.fase === 'pausa') { if (d.t >= PAUSA) { novoRound(p); telas(p); } return; }

    const apertou = js.flatMap((j, i) => (j.apertouA > 0 && !d.fora[i] ? [i] : []));
    if (d.fase === 'espera') {
      for (const i of apertou) {
        d.fora[i] = true; js[i].vy = 9; js[i].vz = -5;       // pula para tras: saiu da largada
        d.fx.push({ tipo: 'queimou', i }); p.eventos.push('queda'); vibra(p, i);
      }
      if (apertou.length) {
        const lados = [...new Set(js.flatMap((_, i) => (d.fora[i] ? [] : [de(i)])))];
        if (!lados.length) return fimRound(p, -1, 'Todos queimaram!', '#ff4a4a');
        if (lados.length === 1) return fimRound(p, lados[0], `Só sobrou ${nomeDe(p, lados[0])}: ponto!`, '#ffd21f');
      }
      const queimou = d.fora.includes(true);
      d.luz = 'apagada'; d.aviso = queimou ? 'Queimou a largada!' : d.t < 1 ? 'Preparar...' : ''; d.avisoCor = queimou ? '#ff4a4a' : '#ffffff';
      for (const f of d.falsos) {
        if (d.t < f.t) continue;
        if (!f.feito) {
          f.feito = true; p.eventos.push('troca');
          if (f.tipo === 'vibra') js.forEach((_, i) => { if (!d.fora[i] && (f.quem === js.length || f.quem === i)) vibra(p, i); });
        }
        if (d.t >= f.t + T_FALSO) continue;
        if (f.tipo === 'quase') { d.aviso = 'Quase...'; d.avisoCor = '#ffd21f'; }
        else if (f.tipo !== 'vibra') d.luz = f.tipo;
      }
      if (d.t >= d.tVerde) { d.fase = 'verde'; d.t = 0; d.luz = 'verde'; d.aviso = 'Já!'; d.avisoCor = '#2bff6a'; p.eventos.push('gol'); }
      telas(p);
      return;
    }
    // verde
    const lados = [...new Set(apertou.map(de))];
    if (lados.length > 1) return fimRound(p, -1, 'Empate! De novo', '#ffffff');
    if (lados.length === 1) return fimRound(p, lados[0], `${nomeDe(p, lados[0])} foi mais rápido!`, '#2bff6a');
    if (d.t >= T_DORME) return fimRound(p, -1, 'Dormiram? De novo', '#ffffff');
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    // semaforo de largada no fundo: poste, caixa escura e a luz grande; a faixa no chao acende junto
    const poste = malha(new THREE.CylinderGeometry(0.22, 0.32, 3.4, 12), 0x555c70); poste.position.set(0, 1.7, -3.6);
    const caixa = malha(new THREE.BoxGeometry(3.4, 3.2, 1), 0x1c2030); caixa.position.set(0, 4.3, -3.9);
    pecas.luz = malha(new THREE.SphereGeometry(1.3, 24, 16), LUZ.apagada, { emissive: LUZ.apagada, emissiveIntensity: 1 });
    pecas.luz.position.set(0, 4.3, -3.4);
    pecas.faixa = malha(new THREE.BoxGeometry(18, 0.06, 1.3), LUZ.apagada, { emissive: LUZ.apagada, emissiveIntensity: 0.8 });
    pecas.faixa.position.set(0, 0.03, Z - 3);
    grupo.add(poste, caixa, pecas.luz, pecas.faixa);
    // de cada jogador: a base de largada na cor dele (do time, em times), as 3 lampadas dos pontos na frente e o X de quem queimou
    pecas.bases = []; pecas.marcas = []; pecas.xis = [];
    p.jogadores.forEach((_, i) => {
      const x = lugar(p, i), cor = corDe(i);
      const base = malha(new THREE.CylinderGeometry(1.35, 1.5, 0.16, 28), cor); base.position.set(x, 0.08, Z); grupo.add(base);
      pecas.bases[i] = base;
      pecas.marcas[i] = Array.from({ length: VITORIAS }, (_, k) => {
        const m = malha(new THREE.SphereGeometry(0.42, 16, 12), 0x333a4d, { emissive: 0x000000 });
        m.position.set(x + (k - (VITORIAS - 1) / 2) * 1.05, 0.42, Z + 2.9); grupo.add(m); return m;
      });
      const xis = new THREE.Group();
      for (const giro of [-1, 1]) { const b = malha(new THREE.BoxGeometry(2.2, 0.3, 0.42), 0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 0.7 }); b.rotation.y = giro * Math.PI / 4; xis.add(b); }
      xis.position.set(x, 0.3, Z); xis.visible = false; grupo.add(xis);
      pecas.xis[i] = xis;
    });
    pecas.nfx = 0;
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas } = c, cor = LUZ[d.luz] ?? LUZ.apagada, times = p.modo === 'times';
    const corDe = i => (times ? c.times[timeDe(p, i)] : c.cores[i]);
    for (const m of [pecas.luz, pecas.faixa]) { m.material.color.set(cor); m.material.emissive.set(cor); }
    pecas.luz.scale.setScalar(d.luz === 'verde' ? 1.15 + Math.sin(t * 20) * 0.1 : d.luz === 'apagada' ? 1 : 1.1);
    p.jogadores.forEach((_, i) => {
      const pontos = d.placar[times ? timeDe(p, i) : i], fora = !!d.fora?.[i];
      pecas.marcas[i].forEach((m, k) => {
        const aceso = pontos > k;
        m.material.color.set(aceso ? corDe(i) : 0x333a4d); m.material.emissive.set(aceso ? corDe(i) : 0x000000);
        m.scale.setScalar(aceso ? 1.15 : 1);
      });
      pecas.xis[i].visible = fora;
      if (!fora && c.bonecos[i]?.userData) c.bonecos[i].userData.alvoY = 0;       // quem pulou para tras volta a olhar para a frente
      pecas.bases[i].material.color.set(fora ? 0x3a3f50 : corDe(i));
    });
    for (; pecas.nfx < d.fx.length; pecas.nfx++) {
      const f = d.fx[pecas.nfx], x = lugar(p, f.i);
      if (f.tipo === 'queimou') { c.particulas(x, 1.2, Z, 0xff2a2a, 26, 8); c.som(150, 0.3, 'sawtooth', 0.2); }
      else { c.particulas(x, 1.2, Z, corDe(f.i), 30, 9); c.particulas(x, 1.2, Z, 0xffe14a, 14, 6); c.som(990, 0.18, 'triangle', 0.2); }
    }
  },
};
