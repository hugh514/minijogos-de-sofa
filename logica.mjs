// Regras e fisica dos minijogos, sem nada de tela. Roda no navegador e no node (testes).
export const RAIO = 0.8;
export const NOITES_COOP = 5;             // a partida cooperativa dura 5 rodadas (noites), sorteadas entre os minijogos coop
export const PONTOS_VITORIA = 10;         // partida mais longa: mais minijogos por partida
// Aceleracao alta com atrito alto: o boneco responde rapido ao dedo e para logo, com a mesma velocidade maxima (~13).
const ACEL = 30, ATRITO = 0.1, DASH = 16, RECARGA = 1.0, GRAVIDADE = 30, PULO = 9;
const ESPERA_BOTAO = 0.15, LIMITE_MOTOR = 75;
const BATIDA_MIN = 3;     // velocidade de aproximacao (m/s) a partir da qual o choque vira 'batida'
const T_PRONTO = 60;      // espera maxima pelo "pronto" dos dois antes de comecar sozinho
const T_INTRO = 3.5, T_RESULTADO = 2.5, T_FIM = 7;
const HISTORICO_MAX = 30;         // ids dos ultimos minijogos, que a tela guarda no localStorage para a rotacao lembrar entre noites
const JANELA = 6;                 // a fila procura nos 6 primeiros um minijogo que respeite o genero
const POUCOS_ELEGIVEIS = 8;       // menos que isso: minijogo repetido volta com modificador diferente
const ELEGIVEIS_ALVO_CURTO = 6, PONTOS_CURTO = 6;     // com menos de 6 elegiveis a partida vai a 6 pontos em vez de 10

// ---------- modos: 'classico' (exatamente 2 jogadores, minijogos sem "festa") e a Festa (2 a 4 jogadores) ----------
// Festa: 'vs' (todos contra todos), 'times' (A = J1+J3, B = J2+J4) e 'coop' (todos juntos). Cada minijogo de festa declara
// festa: { min, max, modos } e devolve de atualiza: vs = indice do vencedor, times = 0 ou 1 (o time), coop = 2 (todos vencem); -1 = empate ou fracasso.
export const MODOS = ['classico', 'vs', 'times', 'coop'];
export const timeDe = (p, i) => i % 2;
// Nome de quem joga, para texto de minijogo: o do perfil (a tela poe em p.nomes) ou "Jogador N".
export const quem = (p, i) => (typeof p.nomes?.[i] === 'string' && p.nomes[i]) || 'Jogador ' + (i + 1);
export function ehCoop(p) { return p.modo === 'coop' || (p.modo === 'classico' && !!p.jogo?.coop); }
// O jogador i ganhou a rodada que acabou de terminar?
export function venceu(p, i) {
  const v = p.vencedor;
  if (v === undefined || v < 0) return false;
  if (ehCoop(p)) return true;
  return p.modo === 'times' ? v === timeDe(p, i) : v === i;
}
// Minijogos que podem sair na rotacao deste modo com n jogadores.
// "Todos contra todos" com 2 pessoas usa tambem os do Classico (sem os cooperativos): os minijogos de festa sao poucos.
export function elegiveis(modo, n) {
  if (modo === 'classico') return JOGOS.filter(j => !j.festa);
  const festa = JOGOS.filter(j => j.festa && n >= j.festa.min && n <= j.festa.max && j.festa.modos.includes(modo));
  return modo === 'vs' && n === 2 ? [...festa, ...JOGOS.filter(j => !j.festa && !j.coop)] : festa;
}
// Minijogo que quebrou sozinho no modo (nao havia outro para cobrir): fica na lista, mas o modo nao pode comecar.
const QUEBRADOS = new Set();
export const jogavel = (modo, n) => elegiveis(modo, n).some(j => !QUEBRADOS.has(j));
function confereModo(n, modo) {
  if (!MODOS.includes(modo)) throw new Error('modo invalido: ' + modo);
  if (!Number.isInteger(n) || n < 2 || n > 4 || (modo === 'classico' && n !== 2) || (modo === 'times' && n !== 4)) throw new Error(`${n} jogadores nao servem para o modo ${modo}`);
}
const novoJogador = () => ({ pontos: 0, direito: false, ent: { x: 0, y: 0, d: false, b: false } });

// ---------- modificadores: de vez em quando uma rodada vem "temperada", para a mesma brincadeira nao enjoar ----------
// So valem com p.modificadores ligado (a tela liga). "anda" = so serve para minijogo em que o motor move o boneco.
export const MODIFICADORES = [
  { id: 'ouro', nome: 'Rodada de ouro', dica: 'Vale 2 pontos', pontos: 2 },
  { id: 'gelo', nome: 'No gelo!', dica: 'Freie antes da curva', anda: true, atrito: 0.55 },
  { id: 'foguete', nome: 'Foguete', dica: 'Todo mundo voando', anda: true, acel: 1.7 },
  { id: 'espelho', nome: 'De ponta-cabeça', dica: 'Esquerda virou direita', anda: true, inverte: true },
  { id: 'lua', nome: 'Na lua', dica: 'Pulo alto e lento', anda: true, pulo: true, gravidade: 9 },
];
const CHANCE_MOD = 0.3;

function deJoystick(j) { return !j.semMovimento && (j.controle?.modo ?? 'padrao') === 'padrao' && j.controle?.joystick !== false; }

// Minijogo que volta na mesma partida (so quando ha poucos elegiveis) sempre volta com um modificador diferente do da ultima vez.
function sorteiaModificador(p) {
  const j = p.jogo, ultimo = p.modsVistos[j.id];
  const repete = !!p.modificadores && Object.hasOwn(p.modsVistos, j.id) && elegiveis(p.modo, p.n).length < POUCOS_ELEGIVEIS;
  let mod = null;
  if (p.modificadores && (repete || (p.rodada >= 3 && p.rng() <= CHANCE_MOD))) {
    const serve = m => (!m.anda || deJoystick(j)) && (!m.pulo || !j.semPulo) && !j.semMod?.includes(m.id)
      && (!m.pontos || (p.modo !== 'coop' && (!j.coop || coopCabe(p, m.pontos))));      // ouro nao cabe nas 5 noites do coop, nem em coop que daria a partida para um so
    const sem = (lista, ids) => lista.filter(m => !ids.includes(m.id));
    const todas = MODIFICADORES.filter(serve), nao = repete ? [ultimo, p.modAnterior] : [p.modAnterior];
    const servem = sem(todas, nao).length ? sem(todas, nao) : sem(todas, [ultimo]);
    mod = servem[Math.floor(p.rng() * servem.length)] ?? null;
    if (mod) p.modAnterior = mod.id;
  }
  p.repete = repete && !!mod;
  p.modsVistos[j.id] = mod?.id ?? null;
  return mod;
}

// ---------- cartas de poder: quem perde uma rodada escolhe 1 de 3 cartas, que vale so na rodada seguinte ----------
// O modificador (p.mod) e da rodada inteira; a carta (j.carta) e de um jogador so. Os dois se somam.
// anda: so em minijogo de joystick. atras: so para quem esta atras no placar. Sem dash/pulo: precisa do botao.
export const CARTAS = [
  { id: 'dobro', nome: 'Vale dobro', dica: 'Venceu, leva 2' },
  { id: 'moedas', nome: 'Cofre em dobro', dica: 'Moedas em dobro nesta' },
  { id: 'escudo', nome: 'Escudo', dica: 'Se perder, ninguém pontua', atras: true },
  { id: 'turbo', nome: 'Turbo', dica: 'Pernas ligeiras', anda: true, acel: 1.35 },
  { id: 'dash', nome: 'Empurrão ligeiro', dica: 'Recarrega na metade', anda: true, recarga: 0.5, precisaDash: true },
  { id: 'pulo', nome: 'Mola', dica: 'Pula bem mais alto', anda: true, pulo: 1.45, precisaPulo: true },
];
const CARTA = Object.fromEntries(CARTAS.map(c => [c.id, c]));
const N_OFERTA = 3, ESPERA_CARTA = 0.35;     // segundos em que o toque na carta, se chegar atrasado, nao vale como escolha do minijogo

function sorteiaCartas(p, i) {
  const j = p.jogo, eu = p.jogadores[i], outro = p.jogadores[1 - i];
  const servem = CARTAS.filter(c => (!c.anda || deJoystick(j)) && (!c.precisaDash || !j.semDash) && (!c.precisaPulo || !j.semPulo)
    && (!c.atras || (eu.pontos < outro.pontos && eu.cartaAnterior !== c.id)));
  return embaralha(servem, p.rng).slice(0, N_OFERTA).map(c => c.id);
}

// Moedas que cada jogador ganha na rodada que acabou de terminar (a tela entrega ao celular).
export function moedasDaRodada(p, i) {
  const v = p.vencedor, coop = ehCoop(p);
  let valor = v < 0 ? (coop ? 3 : 5) : venceu(p, i) ? 10 : 3;
  if (p.fase === 'fim' && (p.campeoes ?? []).includes(i)) valor += 30;
  if (p.jogadores[i].carta === 'moedas') valor *= 2;
  return valor;
}

// ---------- minijogos ----------
// Cada um: inicia(p) monta a arena; atualiza(p, dt) devolve o indice do vencedor, -1 (empate) ou undefined.
// Quando existe p.dados.placar, a tela mostra o placar da rodada com o texto de "rotulo".

// Melhor de 3 quedas (sumo, lava, helice, meteoros e, com explosao no lugar da queda, o labirinto): cada queda vale 1 para o outro, 2 vencem, aos 50 s vence quem derrubou mais.
// Quem caiu some caindo e volta ao centro com 1,5 s de protecao (nesse tempo nao cai). volta(j, i, nova) poe o jogador de pe.
const QUEDAS = 2, T_PROTECAO = 1.5, T_QUEDAS = 50, T_MIN_QUEDAS = 5;     // a queda que decide so encerra depois de 5 s de jogo (antes, so conta no placar)
const novoPlacarQuedas = () => ({ placar: [0, 0], protecao: [0, 0], caiu: [false, false], decidiu: -1 });
function contaQuedas(p, dt, volta) {
  const d = p.dados, novas = [];
  for (const [i, j] of p.jogadores.entries()) {
    d.protecao[i] = Math.max(0, d.protecao[i] - dt);
    if (j.vivo) continue;
    if (d.protecao[i] > 0) { Object.assign(j, { vivo: true, y: 0, vy: 0, vx: 0, vz: 0 }); volta(j, i, false); continue; }   // protegido: nao cai
    if (!d.caiu[i]) { d.caiu[i] = true; novas.push(i); }
    else if (j.y < -6) { Object.assign(j, { vivo: true, y: 0, vy: 0, vx: 0, vz: 0 }); volta(j, i, true); d.protecao[i] = T_PROTECAO; d.caiu[i] = false; }
  }
  if (d.decidiu < 0 && novas.length === 1) {       // os dois no mesmo quadro: ninguem pontua
    d.placar[1 - novas[0]]++;
    if (d.placar[1 - novas[0]] >= QUEDAS) d.decidiu = 1 - novas[0];     // quem chega primeiro a 2 vence; dai o placar para de somar
  }
  if (d.decidiu < 0 && d.placar.some(x => x >= QUEDAS)) d.decidiu = d.placar.indexOf(Math.max(...d.placar));
  if (d.decidiu >= 0 && p.t >= T_MIN_QUEDAS) return d.decidiu;
  if (p.t >= T_QUEDAS) return maiorPlacar(p);
}
const noCentro = (j, i) => { j.x = i ? 1.5 : -1.5; j.z = 0; };

const sumo = {
  id: 'sumo', genero: 'empurra', nome: 'Sumô', dica: 'Melhor de 3 quedas: derrube o outro 2 vezes. Quem cai volta ao centro', rotulo: 'quedas', duracao: T_QUEDAS,
  inicia(p) { p.arena = { tipo: 'circulo', raio: 8, parede: false }; posiciona(p, 4); p.dados = { ...novoPlacarQuedas(), t0: 0 }; },
  atualiza(p, dt) {
    const d = p.dados;
    if (p.t - d.t0 > 6) p.arena.raio = Math.max(2.2, p.arena.raio - dt * 0.3);   // encolhe ate quase nao caber os dois
    return contaQuedas(p, dt, (j, i, nova) => { noCentro(j, i); if (nova) { p.arena.raio = 8; d.t0 = p.t; } });
  },
};

// Uma moeda por vez: os dois correm para a mesma e disputam no empurrao (com 3 moedas e 5 para vencer a rodada durava 4 s).
const MOEDAS_VENCE = 10, T_MOEDAS = 45;
const moedas = {
  id: 'moedas', genero: 'corrida', nome: 'Caça-moedas', dica: 'Corra até a moeda antes do outro. Quem pegar 10 vence', rotulo: 'moedas', duracao: T_MOEDAS,
  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 9, parede: true };
    posiciona(p, 5);
    p.dados = { moedas: [pontoNoCirculo(p, p.arena.raio - 1.5)], placar: [0, 0] };
  },
  atualiza(p) {
    const d = p.dados;
    for (const [i, j] of p.jogadores.entries())
      for (const [k, m] of d.moedas.entries())
        if (Math.hypot(j.x - m.x, j.z - m.z) < RAIO + 0.6) {
          d.placar[i]++; d.moedas[k] = pontoNoCirculo(p, p.arena.raio - 1.5); p.eventos.push('moeda');
          if (d.placar[i] >= MOEDAS_VENCE) return i;
        }
    if (p.t > T_MOEDAS) return maiorPlacar(p);
  },
};

const bomba = {
  id: 'bomba', genero: 'reflexo', nome: 'Batata quente', empurrao: 2.3, dica: 'Encoste no outro para passar a bomba antes de explodir',
  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 7, parede: true };
    posiciona(p, 4);
    p.dados = { dono: p.rng() < 0.5 ? 0 : 1, pavio: 15 + p.rng() * 8, troca: 1 };
  },
  atualiza(p, dt) {
    const d = p.dados;
    d.pavio -= dt; d.troca -= dt;
    if (p.tocou && d.troca <= 0) { d.dono = 1 - d.dono; d.troca = 0.8; p.eventos.push('troca'); }
    p.jogadores[d.dono].turbo = 1.25;       // quem esta com a bomba corre mais para alcancar
    p.jogadores[1 - d.dono].turbo = 1;
    if (d.pavio <= 0) {
      elimina(p, p.jogadores[d.dono], 14); p.eventos.push('explosao');
      return 1 - d.dono;
    }
  },
};

// Chao de lava: o piso pisado racha (fica laranja) e cai 2 s depois. Nos primeiros 2,5 s nada racha, a borda de fora segura
// o boneco (so cai quem pisa num buraco) e todo mundo anda mais devagar: com piso de 0,9 s e velocidade cheia a rodada fechava em 5 s.
const N_PISOS = 7, LADO_PISO = 2.4, T_PISO = 2, T_PISO_INICIO = 2.5, TURBO_LAVA = 0.6;
const BORDA_PISOS = N_PISOS / 2 * LADO_PISO - 0.01, FOLGA_BORDA = 0.5;     // o boneco para meio corpo antes da beirada
const naBorda = v => Math.max(-BORDA_PISOS, Math.min(BORDA_PISOS, v));
const COR_PISO = [0x444f74, 0x566288];      // as mesmas da tela (montaBase), para o piso que volta
const lava = {
  id: 'lava', genero: 'equilibrio', nome: 'Chão de lava', dica: 'Melhor de 3: quem cair 2 vezes perde. O piso pisado racha e cai, não volte por ele', rotulo: 'quedas', duracao: T_QUEDAS,
  inicia(p) {
    p.arena = { tipo: 'pisos', parede: false, n: N_PISOS, lado: LADO_PISO };
    posiciona(p, 4.8, 4.8);
    const pisos = [];
    for (let i = 0; i < N_PISOS; i++)
      for (let k = 0; k < N_PISOS; k++)
        pisos.push({ x: (i - 3) * LADO_PISO, z: (k - 3) * LADO_PISO, t: -1, caiu: false });
    p.dados = { pisos, ...novoPlacarQuedas() };
    for (const j of p.jogadores) j.turbo = TURBO_LAVA;
  },
  atualiza(p, dt) {
    for (const j of p.jogadores) {
      if (j.vivo) for (const e of ['x', 'z']) if (Math.abs(j[e]) > BORDA_PISOS - FOLGA_BORDA) { j[e] = Math.sign(j[e]) * (BORDA_PISOS - FOLGA_BORDA); j['v' + e] = 0; }
      const piso = j.vivo && j.y <= 0 && p.t >= T_PISO_INICIO && pisoEm(p, j.x, j.z);
      if (piso && piso.t < 0) piso.t = 0;
    }
    for (const piso of p.dados.pisos)
      if (piso.t >= 0) { piso.t += dt; if (piso.t > T_PISO) piso.caiu = true; }
    return contaQuedas(p, dt, (j, i, nova) => {
      if (nova) for (const piso of p.dados.pisos) { piso.t = -1; piso.caiu = false; }      // o piso volta inteiro
      noCentro(j, i);
      if (!pisoEm(p, j.x, j.z)) {                                                          // protegido sobre um buraco: vai ao piso inteiro mais perto
        const vivos = p.dados.pisos.filter(x => !x.caiu);
        vivos.sort((a, b) => Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z));
        if (vivos[0]) { j.x = vivos[0].x; j.z = vivos[0].z; }
      }
    });
  },
  // A tela so desenha o piso rachando e caindo; o que volta inteiro depois de uma queda e reposto aqui (senao fica sumido ou laranja).
  desenha(c) {
    c.base.pisos?.forEach((m, i) => {
      const piso = c.p.dados.pisos[i];
      if (!piso || piso.caiu || piso.t >= 0) return;
      m.visible = true; m.position.y = -0.25; m.material.color.set(COR_PISO[i % 2]); m.material.emissiveIntensity = 0;
    });
  },
};

const RAIO_BOLA = 0.6, GOL = 2.5, GOLS = 3, T_FUTEBOL = 55;
const futebol = {
  id: 'futebol', genero: 'gol', nome: 'Futebol', dica: 'Chute a bola no gol da cor do outro. 3 gols vencem; no fim do tempo, quem fez mais', rotulo: 'gols', duracao: T_FUTEBOL,
  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 6.5, parede: true, gol: GOL };
    posiciona(p, 6);
    p.dados = { bola: { x: 0, z: 0, vx: 0, vz: (p.rng() - 0.5) * 4 }, placar: [0, 0] };
  },
  atualiza(p, dt) {
    const d = p.dados, b = d.bola, a = p.arena;
    for (const j of p.jogadores) if (j.y < 0.9 && colide(j, b, RAIO, RAIO_BOLA, 1, 0.3)) p.eventos.push('batida');
    const at = Math.pow(0.3, dt), v = Math.hypot(b.vx, b.vz);
    if (v > 14) { b.vx *= 14 / v; b.vz *= 14 / v; }   // bola nao passa de 14 m/s
    b.vx *= at; b.vz *= at; b.x += b.vx * dt; b.z += b.vz * dt;
    if (Math.abs(b.z) > a.lz - RAIO_BOLA) { b.z = Math.sign(b.z) * (a.lz - RAIO_BOLA); b.vz *= -0.8; }
    if (Math.abs(b.x) > a.lx - RAIO_BOLA) {
      if (Math.abs(b.z) < GOL) {
        if (Math.abs(b.x) > a.lx) {
          const quem = b.x > 0 ? 0 : 1;
          p.eventos.push('gol');
          if (++d.placar[quem] >= GOLS) return quem;
          Object.assign(b, { x: 0, z: 0, vx: quem ? -3 : 3, vz: (p.rng() - 0.5) * 4 });    // volta ao meio e sai para quem levou
        }
      }
      else { b.x = Math.sign(b.x) * (a.lx - RAIO_BOLA); b.vx *= -0.8; }
    }
    if (p.t > T_FUTEBOL) return maiorPlacar(p);
  },
};

// Labirinto de bombas: grade com pilares fixos (1) e caixas que quebram (2). O botao A solta bomba.
const COLS = 11, LINS = 9, T_BOMBA = 2, ALCANCE = 2, T_FOGO = 0.5, MAX_BOMBAS = 2;
const labirinto = {
  id: 'labirinto', genero: 'mira', nome: 'Labirinto de bombas', dica: 'Solte bombas e pegue o outro na explosão. Quem for pego 2 vezes perde',
  rotulo: 'pontos', duracao: T_QUEDAS,
  semDash: true, semPulo: true, controle: { a: 'BOMBA', b: '' },
  // Camera propria: bem mais alta e quase a pino, para o boneco nao sumir atras das caixas e ficar grande o bastante na TV.
  camera() { return { x: 0, y: 29, z: 8.5, ox: 0, oy: 0, oz: -0.3 }; },
  inicia(p) {
    p.arena = { tipo: 'ret', lx: COLS, lz: LINS, parede: true, grade: true };
    posiciona(p, COLS - 1, LINS - 1);
    const grade = [];
    for (let i = 0; i < COLS; i++) {
      grade.push([]);
      for (let k = 0; k < LINS; k++) {
        const canto = Math.min(i, COLS - 1 - i) + Math.min(k, LINS - 1 - k) <= 1;   // area livre de cada jogador
        grade[i].push(i % 2 && k % 2 ? 1 : !canto && p.rng() < 0.65 ? 2 : 0);
      }
    }
    // poder de cada um (cresce com os itens). coletas e queimados so crescem: a tela anima o que for novo.
    p.dados = { grade, bombas: [], fogo: [], itens: [], coletas: [], queimados: [], ...novoPlacarQuedas(),
      poder: [0, 1].map(() => ({ bombas: MAX_BOMBAS, fogo: ALCANCE, patins: 0, passa: false })) };
    for (const j of p.jogadores) j.turbo = TURBO_LAB;
  },
  atualiza(p, dt) {
    const d = p.dados;
    for (const [i, j] of p.jogadores.entries()) {
      if (!j.vivo || !j.apertouA) continue;
      const c = celula(p, j.x, j.z);
      const minhas = d.bombas.filter(b => b.dono === i).length;
      if (minhas < d.poder[i].bombas && !d.bombas.some(b => b.i === c.i && b.k === c.k)) {
        d.bombas.push({ ...c, t: T_BOMBA, dono: i, alcance: d.poder[i].fogo }); p.eventos.push('troca');
      }
    }
    for (const b of d.bombas) {
      b.t -= dt;
      if (b.t <= 0 || d.fogo.some(f => f.i === b.i && f.k === b.k)) explode(p, b);   // fogo de outra bomba detona em cadeia
    }
    d.bombas = d.bombas.filter(b => !b.fim);
    for (const f of d.fogo) f.t -= dt;
    d.fogo = d.fogo.filter(f => f.t > 0);
    pegaItens(p, dt);
    for (const [i, j] of p.jogadores.entries()) {
      if (!j.vivo || d.protecao[i] > 0) continue;
      const c = celula(p, j.x, j.z);
      if (d.fogo.some(f => f.i === c.i && f.k === c.k)) { elimina(p, j, 10); p.eventos.push('queda'); }
    }
    d.inventario = d.poder.map(o => [`Bombas ${o.bombas}`, `Fogo ${o.fogo}`, ...(o.patins ? [`Patins ${o.patins}`] : []), ...(o.passa ? ['Atravessa'] : [])]);
    // melhor de 3 (como as quedas): quem e pego da 1 ponto ao outro e volta ao seu canto com protecao
    return contaQuedas(p, dt, (j, i) => { j.x = (i ? 1 : -1) * (COLS - 1); j.z = (i ? 1 : -1) * (LINS - 1); });
  },
};

// Itens do labirinto: caem de caixa quebrada. t = protecao contra o fogo da explosao que acabou de soltar o item.
const CAMPO_ITEM = { bomba: 'bombas', fogo: 'fogo', patins: 'patins' };
const CHANCE_ITEM = 0.35, MAX_PODER = { bombas: 5, fogo: 6, patins: 3 }, TURBO_LAB = 0.6, TURBO_PATINS = 0.15;
function soltaItem(p, i, k) {
  if (p.rng() >= CHANCE_ITEM) return;
  const r = p.rng(), tipo = r < 0.36 ? 'bomba' : r < 0.72 ? 'fogo' : r < 0.92 ? 'patins' : 'passa';
  p.dados.itens.push({ i, k, tipo, t: T_FOGO + 0.1 });
}
function pegaItens(p, dt) {
  const d = p.dados;
  for (const it of d.itens) {
    it.t -= dt;
    if (it.t <= 0 && d.fogo.some(f => f.i === it.i && f.k === it.k)) { it.fim = true; d.queimados.push({ i: it.i, k: it.k, tipo: it.tipo }); continue; }
    for (const [n, j] of p.jogadores.entries()) {
      const c = celula(p, j.x, j.z);
      if (it.fim || !j.vivo || c.i !== it.i || c.k !== it.k) continue;
      const o = d.poder[n];
      if (it.tipo === 'passa') o.passa = true;
      else { const k = CAMPO_ITEM[it.tipo]; o[k] = Math.min(MAX_PODER[k], o[k] + 1); }
      j.turbo = TURBO_LAB + o.patins * TURBO_PATINS;
      it.fim = true; d.coletas.push({ quem: n, i: it.i, k: it.k, tipo: it.tipo }); p.eventos.push('moeda');
    }
  }
  d.itens = d.itens.filter(it => !it.fim);
}

function celula(p, x, z) {
  return { i: Math.round((x + p.arena.lx - 1) / 2), k: Math.round((z + p.arena.lz - 1) / 2) };
}

function explode(p, b) {
  const d = p.dados;
  b.fim = true;
  d.fogo.push({ i: b.i, k: b.k, t: T_FOGO });
  for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
    for (let n = 1; n <= (b.alcance ?? ALCANCE); n++) {
      const i = b.i + di * n, k = b.k + dk * n, c = d.grade[i]?.[k];
      if (c === undefined || c === 1) break;      // fora da grade ou pilar: o fogo para
      d.fogo.push({ i, k, t: T_FOGO });
      if (c === 2) { d.grade[i][k] = 0; if (d.itens) soltaItem(p, i, k); break; }  // caixa quebra, segura o fogo e as vezes solta item
    }
  p.eventos.push('explosao');
}

// Helice: uma barra gira rente ao chao. Pule (B) ou seja arremessado: quem leva a barra fica tonto (sem controle) por um instante,
// senao o joystick anulava o golpe e ninguem caia.
const GOLPE_BARRA = 15, T_TONTO = 0.7, T_PULOU = 0.8, MEIA_BARRA = 0.5;     // barra fina: um pulo no lugar passa por cima mesmo com ela devagar
const helice = {
  // sem empurrao: com ele quase toda queda era o proprio empurrao errado (rodada de 6 a 10 s); agora quem derruba e a barra
  id: 'helice', genero: 'equilibrio', nome: 'Hélice', dica: 'Pule a barra com B. Melhor de 3: quem cair 2 vezes perde', rotulo: 'quedas', duracao: T_QUEDAS,
  semDash: true, controle: { a: '', b: 'PULA' },
  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 7, parede: false };
    posiciona(p, 2.5, 2.5);       // perto do eixo: o primeiro golpe arremessa, mas ainda nao derruba
    p.dados = { ang: -Math.PI / 4, vel: 0.6, tonto: [0, 0], ...novoPlacarQuedas() };      // jogadores nascem na diagonal oposta a da barra
  },
  atualiza(p, dt) {
    const d = p.dados;
    d.vel = Math.min(4, 0.8 + p.t * 0.08);
    d.ang += d.vel * dt;
    const cos = Math.cos(d.ang), sin = Math.sin(d.ang);
    for (const [i, j] of p.jogadores.entries()) {
      j.imune -= dt;
      d.tonto[i] = Math.max(0, d.tonto[i] - dt);
      j.turbo = d.tonto[i] > 0 ? 0 : 1;
      const lado = j.x * cos + j.z * sin, dist = -j.x * sin + j.z * cos;   // ao longo e atraves da barra
      if (!j.vivo || j.imune > 0 || Math.abs(dist) > MEIA_BARRA) continue;
      if (j.y > 0.6) { j.imune = T_PULOU; continue; }      // pulou por cima: esta passada da barra nao pega mais (perto do eixo ela demora a passar)
      const s = Math.sign(lado) || 1;             // a barra anda em sentidos opostos de cada lado do centro
      const golpe = GOLPE_BARRA * Math.min(1, Math.max(0.4, Math.abs(lado) / 4));      // perto do eixo a barra passa devagar e bate mais fraco
      j.vx += -sin * s * golpe; j.vz += cos * s * golpe; j.imune = 0.5; d.tonto[i] = T_TONTO;
      p.eventos.push('batida');
    }
    // volta perto do centro, em angulos diferentes: lado a lado a barra pegava os dois no mesmo quadro (queda dupla nao pontua) para sempre
    return contaQuedas(p, dt, (j, i, nova) => { j.x = i ? 0.8 : -1.5; j.z = i ? 2.2 : 0; j.imune = T_PROTECAO; d.tonto[i] = 0; });
  },
};

// Rei da colina: fique sozinho na zona amarela para somar tempo.
const T_COLINA = 8, T_LIMITE_COLINA = 45;
const colina = {
  id: 'colina', genero: 'empurra', nome: 'Rei da colina', dica: 'Fique sozinho na zona amarela. Empurre o outro para fora!', rotulo: 'segundos na zona', duracao: T_LIMITE_COLINA,
  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 9, parede: true };
    posiciona(p, 6);
    p.dados = { zona: { x: 0, z: 0, r: 2.4 }, alvo: { x: 0, z: 0 }, muda: 5, placar: [0, 0] };
  },
  atualiza(p, dt) {
    const d = p.dados, z = d.zona;
    d.muda -= dt;
    if (d.muda <= 0) { d.alvo = pontoNoCirculo(p, p.arena.raio - z.r); d.muda = 6; }
    const dx = d.alvo.x - z.x, dz = d.alvo.z - z.z, dist = Math.hypot(dx, dz);
    if (dist > 0.05) { const anda = Math.min(dist, 4 * dt); z.x += dx / dist * anda; z.z += dz / dist * anda; }
    const dentro = p.jogadores.map(j => Math.hypot(j.x - z.x, j.z - z.z) < z.r);
    for (const i of [0, 1])
      if (dentro[i] && !dentro[1 - i]) { d.placar[i] += dt; if (d.placar[i] >= T_COLINA) return i; }
    if (p.t > T_LIMITE_COLINA) return maiorPlacar(p);
  },
};

// Chuva de meteoros: a sombra avisa onde vai cair.
const T_METEORO = 1.3, RAIO_METEORO = 1.8;
const meteoros = {
  id: 'meteoros', genero: 'reflexo', nome: 'Chuva de meteoros', dica: 'Fuja das sombras vermelhas. Melhor de 3 quedas: leve o outro para baixo de uma 2 vezes', rotulo: 'quedas', duracao: T_QUEDAS,
  inicia(p) {
    p.arena = { tipo: 'circulo', raio: 8, parede: true };
    posiciona(p, 4);
    p.dados = { lista: [], prox: 1, ...novoPlacarQuedas() };
  },
  atualiza(p, dt) {
    const d = p.dados;
    d.prox -= dt;
    if (d.prox <= 0) {
      const alvo = p.jogadores[p.rng() < 0.5 ? 0 : 1];
      const ponto = p.rng() < 0.6 ? { x: alvo.x + (p.rng() - 0.5) * 3, z: alvo.z + (p.rng() - 0.5) * 3 } : pontoNoCirculo(p, p.arena.raio);
      d.lista.push({ ...ponto, t: T_METEORO, r: RAIO_METEORO });
      d.prox = Math.max(0.22, 0.9 - p.t * 0.02);     // cai cada vez mais rapido
    }
    for (const m of d.lista) {
      const antes = m.t;
      m.t -= dt;
      if (antes > 0 && m.t <= 0) {                   // impacto
        p.eventos.push('batida');
        for (const [i, j] of p.jogadores.entries())
          if (j.vivo && d.protecao[i] <= 0 && Math.hypot(j.x - m.x, j.z - m.z) < m.r) { elimina(p, j, 10); p.eventos.push('queda'); }
      }
    }
    d.lista = d.lista.filter(m => m.t > -0.3);       // a cratera fica um instante na tela
    return contaQuedas(p, dt, noCentro);
  },
};

// Pintura: o piso fica da cor de quem pisou por ultimo.
const P_COLS = 9, P_LINS = 7, T_PINTURA = 25;
const pintura = {
  id: 'pintura', genero: 'mira', nome: 'Guerra de tinta', dica: 'Pinte o chão passando por cima. Quem tiver mais pisos no fim vence!',
  rotulo: 'pisos', duracao: T_PINTURA,
  inicia(p) {
    p.arena = { tipo: 'ret', lx: P_COLS, lz: P_LINS, parede: true, pintura: true };
    posiciona(p, 6);
    p.dados = { cor: Array(P_COLS * P_LINS).fill(-1), placar: [0, 0] };
  },
  atualiza(p) {
    const d = p.dados;
    for (const [n, j] of p.jogadores.entries()) {
      if (j.y > 0) continue;
      const i = Math.min(P_COLS - 1, Math.max(0, Math.floor((j.x + P_COLS) / 2)));
      const k = Math.min(P_LINS - 1, Math.max(0, Math.floor((j.z + P_LINS) / 2)));
      d.cor[i * P_LINS + k] = n;
    }
    d.placar = [0, 1].map(n => d.cor.filter(c => c === n).length);
    if (p.t > T_PINTURA) return maiorPlacar(p);
  },
};

export const JOGOS = [sumo, moedas, bomba, lava, futebol, labirinto, helice, colina, meteoros, pintura];

// ---------- apoio ----------
export function posiciona(p, x, z = 0) {
  p.jogadores[0].x = -x; p.jogadores[0].z = -z;
  p.jogadores[1].x = x; p.jogadores[1].z = z;
}

// Festa: cantos (J1 em cima a esquerda, J2 em cima a direita, J3 embaixo a esquerda, J4 embaixo a direita). O time A fica na esquerda e o B na direita.
export function posicionaCantos(p, x, z = 0) {
  const lugares = [[-x, -z], [x, -z], [-x, z], [x, z]];
  p.jogadores.forEach((j, i) => { [j.x, j.z] = lugares[i]; });
}
// Festa: em roda, J1 em cima e os outros no sentido horario. Com 4 os times ficam nas diagonais (J1 e J3 de frente um para o outro).
export function posicionaRoda(p, raio) {
  const n = p.jogadores.length;
  p.jogadores.forEach((j, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; j.x = Math.cos(a) * raio; j.z = Math.sin(a) * raio; });
}

export function pontoNoCirculo(p, raio) {
  const ang = p.rng() * Math.PI * 2, r = Math.sqrt(p.rng()) * raio;
  return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
}

export function maiorPlacar(p) {
  const [a, b] = p.dados.placar;
  return a === b ? -1 : a > b ? 0 : 1;
}

export function elimina(p, j, salto = 10) { j.vivo = false; j.vy = salto; }

function pisoEm(p, x, z) {
  const i = Math.round(x / LADO_PISO) + 3, k = Math.round(z / LADO_PISO) + 3;
  if (i < 0 || k < 0 || i >= N_PISOS || k >= N_PISOS) return null;
  const piso = p.dados.pisos[i * N_PISOS + k];
  return piso.caiu ? null : piso;
}

function temChao(p, x, z) {
  if (p.arena.tipo === 'circulo') return Math.hypot(x, z) <= p.arena.raio;
  if (p.arena.tipo === 'pisos') return !!pisoEm(p, naBorda(x), naBorda(z));
  return true;
}

export function quemSobrou(p) {
  const [a, b] = p.jogadores;
  if (!a.vivo && !b.vivo) return -1;
  if (!a.vivo) return 1;
  if (!b.vivo) return 0;
}

// Choque entre dois circulos (com "mola" extra para o empurrao ficar divertido). Devolve true se encostou.
// k: forca do choque (1 = inelastico, os dois seguem juntos; 2 = bola de bilhar, bate e volta; o motor usa p.jogo.empurrao ?? 1.2).
export function colide(a, b, ra, rb, ma, mb, k = 2.3) {
  const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), soma = ra + rb;
  if (dist >= soma || dist === 0) return false;
  const nx = dx / dist, nz = dz / dist, sobra = soma - dist, total = ma + mb;
  a.x -= nx * sobra * mb / total; a.z -= nz * sobra * mb / total;
  b.x += nx * sobra * ma / total; b.z += nz * sobra * ma / total;
  const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (rel > 0) {
    const imp = k * rel / (1 / ma + 1 / mb);
    a.vx -= imp * nx / ma; a.vz -= imp * nz / ma;
    b.vx += imp * nx / mb; b.vz += imp * nz / mb;
  }
  return true;
}

function paredes(p, j) {
  const a = p.arena;
  if (a.tipo === 'circulo') {
    const dist = Math.hypot(j.x, j.z), max = a.raio - RAIO;
    if (dist > max) {
      const nx = j.x / dist, nz = j.z / dist, v = j.vx * nx + j.vz * nz;
      j.x = nx * max; j.z = nz * max;
      if (v > 0) { j.vx -= 1.5 * v * nx; j.vz -= 1.5 * v * nz; }
    }
  } else {
    if (Math.abs(j.x) > a.lx - RAIO) { j.x = Math.sign(j.x) * (a.lx - RAIO); j.vx *= -0.5; }
    if (Math.abs(j.z) > a.lz - RAIO) { j.z = Math.sign(j.z) * (a.lz - RAIO); j.vz *= -0.5; }
  }
}

// Pilares e caixas do labirinto: empurra o jogador para fora do bloco (raio um pouco menor para passar folgado).
function blocos(p, j) {
  const R = 0.7, c = celula(p, j.x, j.z), passa = !!p.dados.poder?.[p.jogadores.indexOf(j)]?.passa;
  for (let i = c.i - 1; i <= c.i + 1; i++)
    for (let k = c.k - 1; k <= c.k + 1; k++) {
      const tipo = p.dados.grade[i]?.[k];
      if (!tipo || (tipo === 2 && passa)) continue;     // com o item "atravessa", caixa nao segura (pilar sim)
      const bx = -p.arena.lx + 1 + i * 2, bz = -p.arena.lz + 1 + k * 2;
      const px = Math.max(bx - 1, Math.min(bx + 1, j.x)), pz = Math.max(bz - 1, Math.min(bz + 1, j.z));
      const dx = j.x - px, dz = j.z - pz, dist = Math.hypot(dx, dz);
      if (dist >= R || dist === 0) continue;
      const nx = dx / dist, nz = dz / dist, v = j.vx * nx + j.vz * nz;
      j.x = px + nx * R; j.z = pz + nz * R;
      if (v < 0) { j.vx -= v * nx; j.vz -= v * nz; }
    }
}

function move(p, i, j, dt) {
  const ativo = p.fase === 'jogando' && !p.jogo.semMovimento;
  const mod = p.mod ?? {}, sinal = mod.inverte ? -1 : 1;
  const ex = ativo ? j.ent.x * sinal : 0, ez = ativo ? j.ent.y * sinal : 0;
  const carta = CARTA[j.carta] ?? {};
  const acel = ACEL * j.turbo * (mod.acel ?? 1) * (carta.acel ?? 1);
  j.vx += ex * acel * dt; j.vz += ez * acel * dt;

  // pulo (B)
  if (j.y > 0 || j.vy > 0) {
    j.vy -= (mod.gravidade ?? GRAVIDADE) * dt; j.y += j.vy * dt;
    if (j.y <= 0) { j.y = 0; j.vy = 0; }
  }
  j.querPulo -= dt;
  if (j.querPulo > 0 && j.y === 0 && ativo && !p.jogo.semPulo) { j.vy = PULO * (carta.pulo ?? 1); j.querPulo = 0; p.eventos.push('pulo'); }

  // empurrao (A); no labirinto o proprio minijogo usa o botao para a bomba
  j.cd -= dt; j.querDash -= dt;
  if (j.querDash > 0 && j.cd <= 0 && ativo && !p.jogo.semDash) {
    let dx = ex, dz = ez;
    if (!dx && !dz) {       // sem direcao: vai para cima de quem esta mais perto e em pe (se ninguem esta, de quem esta mais perto)
      let perto = Infinity;
      for (const [k, o] of p.jogadores.entries()) {
        const m = Math.hypot(o.x - j.x, o.z - j.z) + (o.vivo ? 0 : 1e6);
        if (k !== i && m < perto) { perto = m; dx = o.x - j.x; dz = o.z - j.z; }
      }
    }
    const len = Math.hypot(dx, dz) || 1;
    j.vx += dx / len * DASH; j.vz += dz / len * DASH; j.cd = RECARGA * (carta.recarga ?? 1); j.querDash = 0; j.empurroes++;
    p.eventos.push('dash');
  }

  const at = Math.pow(mod.atrito ?? ATRITO, dt);
  j.vx *= at; j.vz *= at; j.x += j.vx * dt; j.z += j.vz * dt;
  if (p.arena.grade) blocos(p, j);
  if (p.arena.parede) paredes(p, j);
  else if (j.y <= 0 && !temChao(p, j.x, j.z)) { j.vivo = false; p.eventos.push('queda'); }
}

function fisica(p, dt) {
  for (const [i, j] of p.jogadores.entries()) {
    if (j.vivo) move(p, i, j, dt);
    else { j.vy -= GRAVIDADE * dt; j.y += j.vy * dt; j.x += j.vx * dt; j.z += j.vz * dt; }   // caindo
  }
  let tocou = false, bate = false;
  const js = p.jogadores;
  for (let m = 0; m < js.length; m++)       // todos os pares (com 2 jogadores e um so)
    for (let k = m + 1; k < js.length; k++) {
      const a = js[m], b = js[k];
      const dist = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const chega = ((a.vx - b.vx) * (b.x - a.x) + (a.vz - b.vz) * (b.z - a.z)) / dist;     // velocidade com que se aproximam, antes do choque
      if (!(a.vivo && b.vivo && Math.abs(a.y - b.y) < 1.2 && colide(a, b, RAIO, RAIO, 1, 1, p.jogo.empurrao ?? 1.2))) continue;
      tocou = true;
      if (p.arena.parede) { paredes(p, a); paredes(p, b); }
      if (chega > BATIDA_MIN) bate = true;      // encostados e empurrando nao fazem som nem tremor a cada quadro
    }
  p.tocou = tocou;
  if (bate) p.eventos.push('batida');
}

function fisicaSegura(p, dt) { try { fisica(p, dt); } catch (e) { descarta(p, p.jogo, e); } }

function embaralha(lista, rng) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1));
    [l[i], l[k]] = [l[k], l[i]];
  }
  return l;
}

// Minijogo que deu erro sai da rotacao em vez de travar a partida.
export function descarta(p, jogo, erro) {
  const n = JOGOS.indexOf(jogo);
  if (n >= 0 && elegiveis(p.modo, p.n).length > 1) JOGOS.splice(n, 1);
  else { p.semJogo = true; QUEBRADOS.add(jogo); }       // era o unico do modo: a tela avisa e volta ao menu em vez de repetir o erro para sempre; escolher o modo de novo e barrado (jogavel)
  p.fila = p.fila.filter(x => x !== jogo);
  p.erros.push(`${jogo.id}: ${erro?.message ?? erro}`);
}

// ---------- rotacao: baralho sem repeticao, distancia minima, genero e memoria entre partidas ----------
// Genero: campo opcional do minijogo (lista fechada GENEROS); sem ele vale o controle.modo. Nunca o mesmo genero 2 vezes seguidas
// nem 3 seguidas com o mesmo controle.modo, sempre que a fila permite.
export const GENEROS = ['empurra', 'corrida', 'mira', 'reflexo', 'ritmo', 'memoria', 'blefe', 'gol', 'equilibrio'];
export const generoDe = j => j.genero ?? j.controle?.modo ?? 'padrao';
const modoDe = j => j.controle?.modo ?? 'padrao';
const ultimosJogos = (p, k) => p.historico.slice(-k).map(id => JOGOS.find(j => j.id === id)).filter(Boolean);

// Poe a lista em ordem que respeita o genero (no maximo 1 seguido) e o modo de controle (no maximo 2 seguidos), a partir dos ultimos
// jogados, e mantem a ordem recebida quando nada impede. Antes de cada escolha confere (com contagens, sem refazer o resto) que o que
// sobra ainda tem como ser separado.
const LIMITES = [[generoDe, 1], [modoDe, 2]];
function ordena(lista, anteriores) {
  const saida = [], resto = [...lista], hist = [...anteriores];
  const cont = LIMITES.map(([chave]) => { const m = new Map(); for (const x of resto) m.set(chave(x), (m.get(chave(x)) ?? 0) + 1); return m; });
  const seguidos = (chave, c) => { let n = 1; for (let i = hist.length - 1; i >= 0 && n <= 3 && chave(hist[i]) === chave(c); i--) n++; return n; };
  const cabe = (c, l) => {
    const [chave, max] = LIMITES[l], vc = chave(c), n = seguidos(chave, c), total = resto.length - 1;
    if (n > max) return false;
    for (const [v, q0] of cont[l]) { const q = v === vc ? q0 - 1 : q0; if (q > (v === vc ? max - n : max) + max * (total - q)) return false; }
    return true;
  };
  const cabeTudo = c => cabe(c, 0) && cabe(c, 1);
  const permite = c => seguidos(generoDe, c) <= 1 && seguidos(modoDe, c) <= 2;
  while (resto.length) {
    const b = hist.at(-2), longe = c => !b || generoDe(c) !== generoDe(b);
    const testes = [c => cabeTudo(c) && longe(c), cabeTudo, permite, c => seguidos(generoDe, c) <= 1];
    let k = -1;
    for (const t of testes) if ((k = resto.findIndex(t)) >= 0) break;
    const [c] = resto.splice(Math.max(k, 0), 1);
    LIMITES.forEach(([chave], l) => cont[l].set(chave(c), cont[l].get(chave(c)) - 1));
    saida.push(c); hist.push(c);
  }
  return saida;
}

function geradorDe(texto) {
  let a = 0;
  for (const c of texto) a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function defeitosDe(ordem, antes) {
  const h = [...antes, ...ordem];
  let n = 0;
  for (let i = antes.length; i < h.length; i++) {
    if (i > 0 && generoDe(h[i]) === generoDe(h[i - 1])) n++;
    if (i > 1 && modoDe(h[i]) === modoDe(h[i - 1]) && modoDe(h[i]) === modoDe(h[i - 2])) n++;
  }
  return n;
}

// Embaralha e poe no fim os que sairam nas ultimas k rodadas, do mais antigo para o mais novo (assim a distancia nao depende do genero).
// No baralho novo k = max(min(4, n-1) - 1, n/2): o mesmo id so volta depois de min(4, n-1) rodadas, e depois de metade do total quando n e grande.
// So o resto (quem nao saiu ha pouco) e ordenado por genero e modo; se travar, sorteia de novo, mas para no primeiro sem defeito.
function baralho(p, lista, k = Math.min(lista.length - 1, Math.max(Math.min(4, lista.length - 1) - 1, lista.length >> 1))) {
  const fim = [];
  for (const id of k > 0 ? p.historico.slice(-k) : []) {
    const x = lista.find(y => y.id === id);
    if (x) { const antigo = fim.indexOf(x); if (antigo >= 0) fim.splice(antigo, 1); fim.push(x); }
  }
  const antes = ultimosJogos(p, 2), tentativas = Math.max(2, Math.min(30, Math.floor(240 / lista.length)));
  let melhor = null, menos = Infinity, rng = p.rng;
  for (let tentativa = 0; tentativa < tentativas && menos > 0; tentativa++) {       // a ordem de genero e modo e gulosa: se travar, sorteia de novo
    const sorteada = embaralha(lista, rng);
    if (!tentativa) rng = geradorDe(sorteada.map(x => x.id).join());       // as outras tentativas nao gastam o p.rng: o resto da rodada sorteia igual a antes
    const ordem = ordena(sorteada.filter(x => !fim.includes(x)), antes);
    const defeitos = defeitosDe([...ordem, ...fim], antes);
    if (defeitos < menos) { melhor = [...ordem, ...fim]; menos = defeitos; }
  }
  return melhor;
}

// Reiniciar a partida nao zera a fila: so poe no fim o que saiu nas ultimas floor(n/2) rodadas, para a noite nova nao repetir o fim da anterior.
function recicla(p) {
  if (!p.fila.length) return;
  const todos = elegiveis(p.modo, p.n), k = todos.length >> 1, recentes = new Set(k > 0 ? p.historico.slice(-k) : []);
  const lista = [...p.fila];
  const faltam = k - lista.filter(x => !recentes.has(x.id)).length;
  if (faltam > 0) lista.push(...embaralha(todos.filter(x => !recentes.has(x.id) && !lista.includes(x)), p.rng).slice(0, faltam));
  p.fila = baralho(p, lista, k);
}

// Uma rodada sorteada que nunca comecou (a tela voltou ao menu ou o anfitriao trocou de modo) nao conta como jogada.
function esquece(p) {
  if (p.fase === 'intro' && p.jogo && p.historico.at(-1) === p.jogo.id) {
    p.historico.pop(); p.noitesVistas.pop();
    if (!p.prioridade.includes(p.jogo)) p.prioridade.unshift(p.jogo);       // nao jogado: volta ao comeco, nao some
  }
}

// O proximo minijogo. Primeiro p.prioridade (minijogo que chegou com a tela aberta; a tela poe la), depois a fila. Da fila sai o primeiro que
// passa nos filtros, nesta ordem de forca: coop que cabe e distancia minima (fixos, o genero nunca vence a distancia), depois genero e modo
// (procura primeiro nos 6 primeiros). O que for escolhido sai da fila.
function sorteiaProximo(p) {
  const todos = elegiveis(p.modo, p.n);
  const livre = c => !c.coop || coopCabe(p);        // ponto decisivo de um so nao sai de rodada cooperativa
  const esperam = [];
  while (p.prioridade.length) {
    const novo = p.prioridade.shift(), k = p.fila.indexOf(novo);
    if (!todos.includes(novo)) continue;
    if (!livre(novo)) { esperam.push(novo); continue; }       // coop bloqueado: espera a vez em vez de sumir
    if (k >= 0) p.fila.splice(k, 1);
    p.prioridade.unshift(...esperam);
    return novo;
  }
  p.prioridade.push(...esperam);
  if (!p.fila.length) {
    p.fila = baralho(p, todos);
    if (!p.fila.length) throw new Error(`nenhum minijogo para o modo ${p.modo} com ${p.n} jogadores`);
  }
  const [a, b] = ultimosJogos(p, 2).reverse();
  const recentes = new Set(p.historico.slice(-Math.max(1, Math.min(4, todos.length - 1) - 1)));
  const longe = c => !recentes.has(c.id);
  const vistos = new Set(p.noitesVistas);       // no coop, as noites da partida cobrem todos os coop antes de repetir um
  const nova = p.modo === 'coop' && todos.some(c => livre(c) && !vistos.has(c.id)) ? c => !vistos.has(c.id) : () => true;
  const genero = c => !a || generoDe(c) !== generoDe(a);
  const modo = c => !(a && b && modoDe(a) === modoDe(b) && modoDe(c) === modoDe(a));
  const camadas = [[p.fila.slice(0, JANELA), [livre, nova, longe, genero, modo]], [p.fila, [livre, nova, longe, genero, modo]], [p.fila, [livre, nova, longe, genero]], [p.fila, [livre, nova, longe]], [p.fila, [livre, nova]]];
  let jogo;
  for (const [lista, regras] of camadas) if ((jogo = lista.find(c => regras.every(r => r(c))))) break;
  jogo ??= embaralha(todos.filter(c => livre(c) && nova(c) && longe(c) && !p.fila.includes(c)), p.rng)[0] ?? p.fila.find(c => livre(c) && nova(c)) ?? todos.find(c => livre(c) && nova(c) && longe(c)) ?? p.fila.find(livre) ?? embaralha(todos.filter(livre), p.rng)[0] ?? p.fila[0];
  const k = p.fila.indexOf(jogo);
  if (k >= 0) p.fila.splice(k, 1);
  return jogo;
}

function proximaRodada(p, forcado) {
  // carta usada na ultima rodada competitiva (coop no meio nao conta); calculada uma vez, antes de qualquer nova tentativa
  const anterior = p.jogadores.map(j => (p.jogo?.coop ? j.cartaAnterior : j.carta) ?? null);
  if (p.jogadores.every(j => j.pontos === 0)) p.alvo = alvoDe(p);       // a pasta de minijogos ainda pode estar carregando: o alvo acompanha a lista ate o placar andar
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    p.jogo = forcado ?? sorteiaProximo(p);
    forcado = undefined;
    for (const [i, j] of p.jogadores.entries())
      Object.assign(j, {
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, cd: 0, empurroes: 0, vivo: true, turbo: 1, querDash: 0, querPulo: 0, imune: 0,
        apertouA: 0, apertouB: 0, escolha: -1, pronto: false, cartaAnterior: anterior[i], carta: null, oferta: null, escolhaDesde: 0,
      });
    p.liberado = false;
    p.dados = {}; p.celular = p.jogadores.map(() => ({})); p.tocou = false; p.vencedor = undefined; p.anuncios = [];
    p.arena = { tipo: 'circulo', raio: 8, parede: true };
    p.fase = 'intro'; p.t = 0; p.rodada++;
    p.mod = null;
    try {
      p.jogo.inicia(p); p.mod = sorteiaModificador(p);
      p.historico.push(p.jogo.id); p.historico.splice(0, p.historico.length - HISTORICO_MAX); p.noitesVistas.push(p.jogo.id);
      if (!p.jogo.coop)             // em rodada cooperativa ninguem vence o outro: a carta fica guardada para a proxima
        for (const [i, j] of p.jogadores.entries()) if (j.direito) { j.oferta = sorteiaCartas(p, i); j.direito = false; }
      return;
    } catch (e) { descarta(p, p.jogo, e); }
  }
}

// Rodada cooperativa so entra quando nao decide a partida para um so: ninguem a "vale" pontos do fim, ou os dois.
function coopCabe(p, vale = 1) {
  const quase = p.jogadores.filter(j => j.pontos >= p.alvo - vale).length;
  return quase === 0 || quase === p.jogadores.length;
}

// vencedor: 0 ou 1, -1 (empate ou fracasso cooperativo) ou 2 (vitoria em equipe, so em minijogo coop).
function termina(p, vencedor) {
  p.vencedor = vencedor; p.t = 0; p.fase = 'resultado';
  if (p.modo !== 'classico') return terminaFesta(p);
  const js = p.jogadores, antes = js.map(j => j.pontos), vale = p.mod?.pontos ?? 1;
  const anuncios = p.anuncios = [];
  if (vencedor === 2) {
    for (const j of js) j.pontos = Math.min(p.alvo, j.pontos + vale);
    anuncios.push({ tipo: 'equipe' });
  } else if (vencedor >= 0) {
    const j = js[vencedor], o = 1 - vencedor;
    const escudo = js[o].carta === 'escudo';
    if (escudo) anuncios.push({ tipo: 'escudo', quem: o });
    else j.pontos = Math.min(p.alvo, j.pontos + vale + (j.carta === 'dobro' ? 1 : 0));
    js[o].direito = true;
    if (!escudo) p.seq[vencedor]++;     // ponto segurado nao soma na sequencia
    p.seq[o] = 0;
    if (!escudo && p.seq[vencedor] >= 2) anuncios.push({ tipo: 'seq', quem: vencedor, n: p.seq[vencedor] });
    const agora = js.map(x => x.pontos);
    if ((agora[vencedor] === agora[o] && p.deficit[vencedor] >= 2) || (agora[vencedor] > agora[o] && antes[vencedor] < antes[o])) {
      anuncios.push({ tipo: 'virada', quem: vencedor }); p.deficit[vencedor] = 0;
    }
  }
  for (const i of [0, 1]) p.deficit[i] = Math.max(p.deficit[i], js[1 - i].pontos - js[i].pontos);
  const campeoes = js.map(j => j.pontos >= p.alvo);
  if (campeoes[0] || campeoes[1]) {
    p.fase = 'fim'; p.campeao = campeoes[0] && campeoes[1] ? 2 : campeoes[0] ? 0 : 1;
    p.campeoes = campeoes[0] && campeoes[1] ? [0, 1] : [p.campeao];
    for (const j of js) j.direito = false;
  } else {
    p.campeoes = [];
    const quase = js.map(j => j.pontos === p.alvo - 1);
    if (quase[0] || quase[1]) anuncios.push({ tipo: 'match', quem: quase[0] && quase[1] ? 2 : quase[0] ? 0 : 1 });
  }
  p.eventos.push('ponto');
}

// Festa: quem venceu (ele, o time ou todos, pelo modo) ganha o ponto; sem cartas de poder nem anuncios nesta versao.
function terminaFesta(p) {
  const vale = p.mod?.pontos ?? 1;
  p.anuncios = [];
  p.jogadores.forEach((j, i) => { if (venceu(p, i)) j.pontos = Math.min(p.alvo, j.pontos + vale); });
  p.campeoes = p.jogadores.flatMap((j, i) => j.pontos >= p.alvo ? [i] : []);
  if (p.campeoes.length) p.fase = 'fim';
  if (p.modo === 'coop' && p.fase !== 'fim') {       // cooperativo: a partida dura NOITES_COOP rodadas
    p.noites.jogadas++;
    if (p.vencedor === 2) p.noites.vencidas++;
    if (p.noites.jogadas >= NOITES_COOP) {
      p.fase = 'fim';
      p.campeoes = p.noites.vencidas * 2 > NOITES_COOP ? p.jogadores.map((_, i) => i) : [];       // a equipe vence a partida com mais da metade das noites
    }
  }
  p.eventos.push('ponto');
}

// Houve toque no botao? Com contador (n/nb) vale a mudanca dele, assim toque curto nunca se perde;
// sem contador (teclado) vale a passagem de solto para apertado.
// Devolve quantos toques novos chegaram. Contador menor que o anterior (celular recarregou a pagina) so acerta o passo.
function tocouBotao(j, m, estado, contador) {
  const temContador = m[contador] !== undefined && j[contador] !== undefined;
  const toques = temContador ? Math.max(0, Math.min(5, m[contador] - j[contador])) : (!!m[estado] && !j.ent[estado] ? 1 : 0);
  if (m[contador] !== undefined) j[contador] = m[contador];
  return toques;
}

// ---------- API ----------
// historico: ids dos ultimos minijogos (a tela guarda no localStorage); so valem textos curtos de id.
const limpaHistorico = h => (Array.isArray(h) ? h.filter(id => typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id)) : []).slice(-HISTORICO_MAX);

// Alvo de pontos da partida: 10, ou 6 quando ha menos de 6 minijogos elegiveis no modo (a tela mostra p.alvo).
const alvoDe = p => (elegiveis(p.modo, p.n).length < ELEGIVEIS_ALVO_CURTO ? PONTOS_CURTO : PONTOS_VITORIA);

export function criaPartida(rng = Math.random, { n = 2, modo = 'classico', historico = [] } = {}) {
  confereModo(n, modo);
  const p = {
    rng, fila: [], prioridade: [], noitesVistas: [], jogo: null, historico: limpaHistorico(historico), modsVistos: {}, rodada: 0, eventos: [], erros: [], anuncios: [], n, modo,
    noites: { jogadas: 0, vencidas: 0 }, seq: Array(n).fill(0), deficit: Array(n).fill(0), campeao: undefined,       // vitorias seguidas e maior desvantagem (para "virada")
    jogadores: Array.from({ length: n }, novoJogador),
  };
  p.alvo = alvoDe(p);
  proximaRodada(p);
  return p;
}

export function reinicia(p) {
  for (const j of p.jogadores) { j.pontos = 0; j.direito = false; j.carta = null; }
  p.seq = p.jogadores.map(() => 0); p.deficit = p.jogadores.map(() => 0); p.campeao = undefined; p.campeoes = undefined;
  esquece(p); p.noitesVistas = [];
  p.noites = { jogadas: 0, vencidas: 0 }; p.modsVistos = {}; p.alvo = alvoDe(p);
  recicla(p);
  proximaRodada(p);
}

// Troca o numero de jogadores e o modo e recomeca a partida (quem ja estava mantem o objeto e os contadores do celular).
export function configura(p, { n = p.n, modo = p.modo } = {}) {
  confereModo(n, modo);
  p.n = n; p.modo = modo;
  while (p.jogadores.length < n) p.jogadores.push(novoJogador());
  p.jogadores.length = n;
  p.fila = [];       // outro modo ou outro numero de jogadores: o baralho de antes nao serve (o esquece fica no reinicia)
  reinicia(p);
}

// Coloca um minijogo (novo ou versao nova do mesmo id) na rotacao.
export function registra(jogo) {
  for (const campo of ['id', 'nome', 'dica', 'inicia', 'atualiza']) if (!jogo?.[campo]) throw new Error('minijogo sem ' + campo);
  if (jogo.festa !== undefined) {
    const f = jogo.festa, ok = n => Number.isInteger(n) && n >= 2 && n <= 4;
    if (!f || !ok(f.min) || !ok(f.max) || f.min > f.max || !Array.isArray(f.modos) || !f.modos.length || !f.modos.every(m => m === 'vs' || m === 'times' || m === 'coop'))
      throw new Error('festa torto em ' + jogo.id);
  }
  if (jogo.genero !== undefined && !GENEROS.includes(jogo.genero)) throw new Error('genero torto em ' + jogo.id);
  const n = JOGOS.findIndex(x => x.id === jogo.id);
  if (n >= 0) JOGOS[n] = jogo; else JOGOS.push(jogo);
}

// Comeca agora uma rodada do minijogo dado (testes e atalho da tela).
export function pulaPara(p, jogo) { proximaRodada(p, jogo); }

// i: 0 (azul) ou 1 (rosa). m: { x, y, d, n, b, nb, op, nop }: joystick/toque entre -1 e 1, botao A (d, contador n),
// botao B (b, contador nb) e escolha feita na tela do celular (op, contador nop).
// semToque: acompanha joystick e contadores sem contar toque (tela pausada).
export function entrada(p, i, m, semToque = false) {
  const j = p.jogadores[i];
  if (!j) return;       // celular de um slot que nao esta na partida
  // Cada aba do celular manda sua sessao (s = hora em que abriu) e uma sequencia (q). Vale a aba mais nova:
  // a mais velha (ficou aberta em segundo plano) e ignorada; na troca so a base dos contadores muda, sem toque
  // fantasma, mas o joystick e o botao segurado ja valem. Sequencia velha (POST atrasado) e ignorada.
  if (Number.isInteger(m.s)) {
    if (Number.isInteger(j.s) && m.s < j.s) return;
    if (m.s !== j.s) { j.s = m.s; semToque = true; }
    else if (Number.isInteger(m.q) && Number.isInteger(j.q) && m.q <= j.q) return;
    j.q = m.q;
  }
  if (semToque) for (const k of ['n', 'nb', 'nop']) if (m[k] !== undefined) j[k] = m[k];
  let x = Number(m.x), y = Number(m.y);
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  const a = tocouBotao(j, m, 'd', 'n'), b = tocouBotao(j, m, 'b', 'nb');
  if (a && aguardando(p)) { j.pronto = true; p.eventos.push('moeda'); }     // A durante a explicacao = "estou pronto"
  const escolheu = m.nop !== undefined && j.nop !== undefined && m.nop > j.nop && Number.isInteger(m.op) && m.op >= 0;
  if (m.nop !== undefined) j.nop = m.nop;
  if (p.fase === 'jogando') {
    if (a) { j.querDash = ESPERA_BOTAO; j.apertouA += a; }
    if (b) { j.querPulo = ESPERA_BOTAO; j.apertouB += b; }
    if (escolheu && p.t >= j.escolhaDesde) j.escolha = m.op;     // toque atrasado na carta nao vira resposta do minijogo
  } else if (p.fase === 'intro' && escolheu && j.oferta) {
    if (j.oferta[m.op]) { j.carta = j.oferta[m.op]; j.oferta = null; p.eventos.push('carta'); }     // carta de poder escolhida na explicacao
    else if (m.op === j.oferta.length) { j.oferta = null; if (aguardando(p)) { j.pronto = true; p.eventos.push('moeda'); } }   // "sem carta": ja fica pronto
  }
  j.ent = { x, y, d: !!m.d, b: !!m.b };
}

// Com p.esperaPronto ligado (a tela liga), a rodada so comeca a contagem depois que os dois apertam A.
export function aguardando(p) { return p.fase === 'intro' && !!p.esperaPronto && !p.liberado; }

export function tempoIntro(p) { return p.fase === 'intro' ? T_INTRO - (aguardando(p) ? 0 : p.t) : 0; }

// O que atualiza pode devolver: coop (2 = todos venceram), times (0 ou 1), vs ou classico (indice de quem venceu); -1 e empate ou fracasso.
function resultadosValidos(p) {
  if (ehCoop(p)) return [undefined, -1, 2];
  if (p.modo === 'times') return [undefined, -1, 0, 1];
  return [undefined, -1, ...p.jogadores.keys()];
}

export function passo(p, dt) {
  p.t += dt;
  if (aguardando(p)) {
    if (!p.jogadores.every(j => j.pronto) && p.t < T_PRONTO) return;
    p.liberado = true; p.t = 0;
  }
  if (p.fase === 'intro') {
    if (p.t >= T_INTRO) { p.fase = 'jogando'; p.t = 0; for (const j of p.jogadores) { j.escolhaDesde = j.oferta || j.carta ? ESPERA_CARTA : 0; j.oferta = null; } }    // quem nao escolheu fica sem carta
    return;
  }
  if (p.fase === 'fim') { fisicaSegura(p, dt); if (p.t >= T_FIM && !p.esperaRevanche) reinicia(p); return; }     // esperaRevanche (a tela liga): o podio espera a escolha de revanche
  if (p.fase === 'resultado') { fisicaSegura(p, dt); if (p.t >= T_RESULTADO) proximaRodada(p); return; }
  let vencedor;
  try {
    fisica(p, dt);
    vencedor = p.jogo.atualiza(p, dt);
    if (!resultadosValidos(p).includes(vencedor)) throw new Error('atualiza devolveu ' + String(vencedor));
  } catch (e) { descarta(p, p.jogo, e); vencedor = -1; }
  if (vencedor === undefined && p.t > LIMITE_MOTOR) vencedor = -1;       // nenhuma rodada passa disso
  for (const j of p.jogadores) { j.apertouA = 0; j.apertouB = 0; j.escolha = -1; }   // valem so por um passo
  if (vencedor !== undefined) termina(p, vencedor);
}

// Regra do ESTILO.md: nenhuma rodada fecha antes de T_MIN_RODADA, nem por toque sem querer nem por jogada perfeita.
// A tela aplica comMinimo em todo minijogo (embutido ou da pasta). Se o minijogo decide antes do tempo, o resultado fica
// guardado em p.dados.fimCedo, o atualiza deixa de ser chamado (placar e celular ficam como estavam, a fisica segue) e a
// rodada fecha aos 5 s com o mesmo resultado. Retorno invalido para o modo segue na hora e vira erro no motor.
// Os testes de unidade de cada minijogo rodam sem a trava, para conferir a regra pura do jogo.
export const T_MIN_RODADA = 5;
const COM_MINIMO = Symbol('comMinimo');
export function comMinimo(jogo) {
  if (typeof jogo?.atualiza !== 'function' || jogo.atualiza[COM_MINIMO]) return jogo;      // invalido: registra recusa com a mensagem certa
  const original = jogo.atualiza;
  const atualiza = function (p, dt) {
    const d = p.dados;
    if (d.fimCedo !== undefined) return p.t >= T_MIN_RODADA ? d.fimCedo : undefined;
    const r = original.call(this, p, dt);
    if (r !== undefined && p.t < T_MIN_RODADA && resultadosValidos(p).includes(r)) { d.fimCedo = r; return undefined; }
    return r;
  };
  atualiza[COM_MINIMO] = true;
  jogo.atualiza = atualiza;
  return jogo;
}
