import test from 'node:test';
import assert from 'node:assert/strict';
import { criaPartida, passo, entrada, pulaPara, registra, aguardando, tempoIntro, moedasDaRodada, CARTAS, MODIFICADORES, JOGOS, PONTOS_VITORIA, RAIO } from './logica.mjs';

const DT = 1 / 60;
function roda(p, seg) { for (let i = 0; i < seg * 60; i++) passo(p, DT); }

// Cria a partida ja no primeiro quadro de jogo do minijogo pedido.
function partidaEm(id, rng = () => 0.3) {
  const p = criaPartida(rng);
  pulaPara(p, JOGOS.find(j => j.id === id));
  for (let i = 0; p.fase !== 'jogando'; i++) { assert.ok(i < 600); passo(p, DT); }
  return p;
}

test('a rodada comeca na intro e so depois libera o movimento', () => {
  const p = criaPartida(() => 0.3);
  const x0 = p.jogadores[0].x;
  entrada(p, 0, { x: 1, y: 0 });
  roda(p, 1);
  assert.equal(p.fase, 'intro');
  assert.equal(p.jogadores[0].x, x0);
  roda(p, 3);
  assert.equal(p.fase, 'jogando');
  assert.ok(p.jogadores[0].x > x0);
});

test('todos os minijogos aparecem antes de repetir', () => {
  const p = criaPartida(Math.random);
  const vistos = new Set([p.jogo.id]);
  for (let i = 0; i < JOGOS.length - 1; i++) {
    p.fase = 'resultado'; p.t = 0; roda(p, 2.6);
    vistos.add(p.jogo.id);
  }
  assert.equal(vistos.size, JOGOS.length);
});

test('sumo: quem sai da arena cai e o outro soma 1 queda, sem encerrar a rodada', () => {
  const p = partidaEm('sumo');
  entrada(p, 0, { x: -1, y: 0 });
  roda(p, 1);
  assert.equal(p.jogadores[0].vivo, false);
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.jogadores[1].pontos, 0);
});

test('sumo: a arena encolhe depois de um tempo', () => {
  const p = partidaEm('sumo');
  roda(p, 10);
  assert.ok(p.arena.raio < 8);
});

test('empurrao da impulso e respeita a recarga', () => {
  const p = partidaEm('moedas');
  p.dados.moedas = [{ x: 0, z: 8 }, { x: 0, z: 8 }, { x: 0, z: 8 }];
  const j = p.jogadores[0];
  entrada(p, 0, { x: 0, y: 1, d: true });
  passo(p, DT);
  const v1 = Math.hypot(j.vx, j.vz);
  assert.ok(v1 > 8, 'ganhou impulso');
  entrada(p, 0, { x: 0, y: 1, d: false }); passo(p, DT);
  entrada(p, 0, { x: 0, y: 1, d: true }); passo(p, DT);
  assert.ok(Math.hypot(j.vx, j.vz) < v1 + 1, 'segundo empurrao em seguida nao conta');
});

test('as duas bolas nao se atravessam', () => {
  const p = partidaEm('bomba');
  entrada(p, 0, { x: 1, y: 0 }); entrada(p, 1, { x: -1, y: 0 });
  for (let i = 0; i < 120; i++) {
    passo(p, DT);
    const [a, b] = p.jogadores;
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= RAIO * 2 - 1e-6);
  }
});

test('parede segura o jogador dentro da arena', () => {
  const p = partidaEm('bomba');
  entrada(p, 0, { x: -1, y: 0 });
  roda(p, 3);
  const j = p.jogadores[0];
  assert.equal(j.vivo, true);
  assert.ok(Math.hypot(j.x, j.z) <= p.arena.raio - RAIO + 1e-6);
});

test('moedas: pegar 5 vence a rodada', () => {
  const p = partidaEm('moedas');
  for (let n = 0; n < 5; n++) {
    assert.equal(p.fase, 'jogando');
    p.dados.moedas[0] = { x: p.jogadores[1].x, z: p.jogadores[1].z };
    passo(p, DT);
  }
  assert.equal(p.vencedor, 1);
  assert.equal(p.jogadores[1].pontos, 1);
});

test('bomba: encostar passa a bomba e ela explode em quem estiver com ela', () => {
  const p = partidaEm('bomba');
  const dono = p.dados.dono;
  p.dados.troca = 0;
  entrada(p, 0, { x: 1, y: 0 }); entrada(p, 1, { x: -1, y: 0 });
  roda(p, 1.5);
  assert.equal(p.dados.dono, 1 - dono, 'bomba trocou de mao');
  entrada(p, 0, { x: -1, y: 0 }); entrada(p, 1, { x: 1, y: 0 });   // se afastam
  roda(p, 0.5);
  const comBomba = p.dados.dono;
  p.dados.pavio = 0.05;
  roda(p, 0.2);
  assert.equal(p.vencedor, 1 - comBomba);
  assert.equal(p.jogadores[1 - comBomba].pontos, 1);
});

test('lava: o piso cai depois de pisado e quem fica parado cai e da 1 queda ao outro', () => {
  const p = partidaEm('lava');
  entrada(p, 1, { x: -1, y: -1 });      // rosa corre na diagonal, azul fica parado
  roda(p, 1.2);
  assert.equal(p.jogadores[0].vivo, false);
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.fase, 'jogando');
  assert.ok(p.dados.pisos.some(x => x.caiu));
});

test('futebol: bola no gol da direita e gol do azul; a bola volta ao centro e a rodada segue', () => {
  const p = partidaEm('futebol');
  Object.assign(p.dados.bola, { x: 10, z: 0, vx: 12, vz: 0 });
  roda(p, 0.5);
  assert.deepEqual(p.dados.placar, [1, 0]);
  assert.equal(p.fase, 'jogando');
  assert.ok(Math.hypot(p.dados.bola.x, p.dados.bola.z) < 3, 'bola de volta ao meio');
});

test('futebol: bola fora do gol bate na parede e volta', () => {
  const p = partidaEm('futebol');
  Object.assign(p.dados.bola, { x: 10, z: 5, vx: 12, vz: 0 });
  roda(p, 0.5);
  assert.equal(p.fase, 'jogando');
  assert.ok(p.dados.bola.vx < 0);
});

test('a partida termina em PONTOS_VITORIA pontos e depois recomeca zerada', () => {
  const p = criaPartida(() => 0.3);
  p.jogadores[1].pontos = PONTOS_VITORIA - 1;
  pulaPara(p, JOGOS[0]);
  while (p.fase !== 'jogando') passo(p, DT);
  p.dados.placar = [0, 1]; p.t = 5;
  p.jogadores[0].vivo = false;
  passo(p, DT);
  assert.equal(p.fase, 'fim');
  roda(p, 7.5);
  assert.equal(p.fase, 'intro');
  assert.equal(p.jogadores[1].pontos, 0);
});

test('entrada invalida vira zero e vetor grande e limitado', () => {
  const p = criaPartida(() => 0.3);
  entrada(p, 0, { x: 'abc', y: null });
  assert.deepEqual(p.jogadores[0].ent, { x: 0, y: 0, d: false, b: false });
  entrada(p, 0, { x: 30, y: 40 });
  assert.ok(Math.abs(Math.hypot(p.jogadores[0].ent.x, p.jogadores[0].ent.y) - 1) < 1e-9);
});

test('toque curto no botao conta pelo contador, mesmo chegando ja solto', () => {
  const p = partidaEm('bomba');
  const j = p.jogadores[0];
  entrada(p, 0, { x: 0, y: 0, d: false, n: 3 });
  passo(p, DT);
  assert.ok(Math.hypot(j.vx, j.vz) < 1, 'primeira mensagem so registra o contador');
  entrada(p, 0, { x: 0, y: 1, d: false, n: 4 });
  passo(p, DT);
  assert.ok(Math.hypot(j.vx, j.vz) > 8, 'contador mudou: empurrou');
});

test('empurrao pedido no fim da recarga sai assim que ela acaba', () => {
  const p = partidaEm('bomba');
  const j = p.jogadores[0];
  j.cd = 0.1;
  entrada(p, 0, { x: 0, y: 1, d: true });
  roda(p, 0.05);
  assert.ok(Math.hypot(j.vx, j.vz) < 8, 'ainda em recarga');
  roda(p, 0.1);
  assert.ok(j.cd > 0.8, 'empurrou quando a recarga acabou');
});

test('sumo: termina sozinho mesmo com os dois parados no centro', () => {
  const p = partidaEm('sumo');
  p.jogadores[0].x = -0.81; p.jogadores[1].x = 0.81;
  const rodada = p.rodada;
  roda(p, 55);
  assert.ok(p.rodada > rodada, 'a rodada acabou e veio a proxima');
});

test('moedas: no limite de tempo vence quem tem mais, ou empata', () => {
  const p = partidaEm('moedas');
  p.dados.moedas = p.dados.moedas.map(() => ({ x: 0, z: 0 }));
  p.dados.placar = [2, 1];
  p.t = 59.9;
  roda(p, 0.3);
  assert.equal(p.vencedor, 0);
  const q = partidaEm('moedas');
  q.dados.moedas = q.dados.moedas.map(() => ({ x: 0, z: 0 }));
  q.t = 59.9;
  roda(q, 0.3);
  assert.equal(q.vencedor, -1);
  assert.deepEqual(q.jogadores.map(j => j.pontos), [0, 0]);
});

test('futebol: bola no gol da esquerda e gol da rosa', () => {
  const p = partidaEm('futebol');
  Object.assign(p.dados.bola, { x: -10, z: 0, vx: -12, vz: 0 });
  roda(p, 0.5);
  assert.deepEqual(p.dados.placar, [0, 1]);
  assert.equal(p.fase, 'jogando');
});

test('futebol: o terceiro gol vence, mesmo depois de levar a frente', () => {
  const p = partidaEm('futebol');
  p.dados.placar = [2, 2];
  Object.assign(p.dados.bola, { x: -10, z: 0, vx: -12, vz: 0 });
  roda(p, 0.5);
  assert.equal(p.vencedor, 1);
  const q = partidaEm('futebol');
  q.dados.placar = [2, 0];
  Object.assign(q.dados.bola, { x: 10, z: 0, vx: 12, vz: 0 });
  roda(q, 0.5);
  assert.equal(q.vencedor, 0);
});

test('futebol: no fim do tempo vence quem fez mais gols; igual empata', () => {
  const p = partidaEm('futebol');
  p.dados.placar = [0, 2];
  p.t = 54.9;
  roda(p, 0.3);
  assert.equal(p.vencedor, 1);
  const q = partidaEm('futebol');
  q.dados.placar = [1, 1];
  q.t = 54.9;
  roda(q, 0.3);
  assert.equal(q.vencedor, -1);
});

test('futebol: placar de gols na tela, 55 s e a regra na dica', () => {
  const p = partidaEm('futebol');
  assert.equal(p.jogo.rotulo, 'gols');
  assert.equal(p.jogo.duracao, 55);
  assert.deepEqual(p.dados.placar, [0, 0]);
  assert.match(p.jogo.dica, /3 gols/);
});

test('entrada infinita nao estraga a posicao', () => {
  const p = partidaEm('bomba');
  entrada(p, 0, { x: Infinity, y: -Infinity });
  roda(p, 0.5);
  assert.ok(p.jogadores.every(j => Number.isFinite(j.x) && Number.isFinite(j.z)));
});

test('pulo: B tira do chao e a bola volta', () => {
  const p = partidaEm('bomba');
  const j = p.jogadores[0];
  entrada(p, 0, { x: 0, y: 0, b: true });
  roda(p, 0.2);
  assert.ok(j.y > 0.8, 'subiu');
  roda(p, 1);
  assert.equal(j.y, 0);
});

test('pulo: no ar as bolas nao se batem', () => {
  const p = partidaEm('bomba');
  const [a, b] = p.jogadores;
  Object.assign(a, { x: -1.2, z: 0, y: 1.3, vy: 3 }); Object.assign(b, { x: 0, z: 0 });
  a.vx = 6;
  passo(p, DT); passo(p, DT); passo(p, DT);
  assert.equal(b.vx, 0, 'quem esta no chao nao foi empurrado');
});

test('helice: a barra arremessa quem esta no chao e poupa quem pulou', () => {
  const p = partidaEm('helice');
  const [a, b] = p.jogadores;
  p.dados.ang = 0;                       // barra deitada no eixo x
  Object.assign(a, { x: 3, z: 0.2 });
  Object.assign(b, { x: -3, z: 0.2, y: 1.2, vy: 2 });
  passo(p, DT);
  assert.ok(Math.hypot(a.vx, a.vz) > 8, 'azul foi arremessado');
  assert.ok(Math.hypot(b.vx, b.vz) < 1, 'rosa estava no ar');
});

test('labirinto: pilares fixos, cantos livres e parede segura o jogador', () => {
  const p = partidaEm('labirinto');
  const g = p.dados.grade;
  assert.equal(g[1][1], 1);
  assert.equal(g[0][0], 0); assert.equal(g[1][0], 0); assert.equal(g[0][1], 0);
  assert.equal(g[10][8], 0);
  const j = p.jogadores[0];
  g[1][0] = 2;                           // caixa logo a direita do azul
  entrada(p, 0, { x: 1, y: 0 });
  roda(p, 1);
  assert.ok(j.x < -9.6, 'nao atravessou a caixa: ' + j.x);
});

test('labirinto: bomba quebra caixa, pilar segura o fogo e pega quem estiver na linha', () => {
  const p = partidaEm('labirinto');
  const d = p.dados, [a, b] = p.jogadores;
  for (const col of d.grade) col.forEach((c, k) => { if (c === 2) col[k] = 0; });
  d.grade[2][0] = 2;                     // caixa a duas casas
  Object.assign(b, { x: -10, z: -4 });   // rosa duas casas abaixo da bomba
  entrada(p, 0, { x: 0, y: 0, d: true });
  passo(p, DT);
  assert.equal(d.bombas.length, 1);
  assert.equal(a.vx, 0, 'A nao da empurrao neste minijogo');
  entrada(p, 0, { x: 0, y: 0, d: false });
  Object.assign(a, { x: 10, z: 8 });     // azul foge para longe
  roda(p, 2.1);
  assert.equal(d.grade[2][0], 0, 'caixa quebrou');
  assert.equal(b.vivo, false);
  assert.equal(p.vencedor, 0);
});

test('labirinto: no maximo duas bombas por jogador', () => {
  const p = partidaEm('labirinto');
  const a = p.jogadores[0];
  for (const [n, x] of [-10, -8, -10].entries()) {
    Object.assign(a, { x, z: n === 2 ? -6 : -8, vx: 0, vz: 0 });
    entrada(p, 0, { x: 0, y: 0, d: false, n: n });
    entrada(p, 0, { x: 0, y: 0, d: false, n: n + 100 });
    passo(p, DT);
  }
  assert.equal(p.dados.bombas.length, 2);
});

test('colina: so pontua quem esta sozinho na zona e 8 segundos vencem', () => {
  const p = partidaEm('colina');
  const [a, b] = p.jogadores;
  p.dados.muda = 99;
  Object.assign(a, { x: 0, z: 0 }); Object.assign(b, { x: 1.7, z: 0 });
  roda(p, 1);
  assert.deepEqual(p.dados.placar, [0, 0], 'os dois dentro: ninguem pontua');
  Object.assign(a, { x: 0, z: 0, vx: 0, vz: 0 }); Object.assign(b, { x: 7, z: 0, vx: 0, vz: 0 });
  roda(p, 8.2);
  assert.equal(p.vencedor, 0);
});

test('meteoros: quem esta embaixo no impacto cai e da 1 queda ao outro, sem encerrar a rodada', () => {
  const p = partidaEm('meteoros');
  const [a, b] = p.jogadores;
  p.dados.prox = 99;
  p.dados.lista.push({ x: b.x, z: b.z, t: 0.1, r: 1.8 });
  roda(p, 0.2);
  assert.equal(a.vivo, true);
  assert.equal(b.vivo, false);
  assert.deepEqual(p.dados.placar, [1, 0]);
  assert.equal(p.fase, 'jogando');
});

test('pintura: quem pinta mais pisos vence no fim do tempo', () => {
  const p = partidaEm('pintura');
  entrada(p, 1, { x: -1, y: 0 });        // rosa anda, azul fica parado
  roda(p, 2);
  assert.ok(p.dados.placar[1] > p.dados.placar[0]);
  entrada(p, 1, { x: 0, y: 0 });
  roda(p, 23.5);
  assert.equal(p.vencedor, 1);
});

test('todo minijogo termina sozinho com os dois parados', () => {
  for (const jogo of JOGOS) {
    const p = partidaEm(jogo.id, Math.random);
    const rodada = p.rodada;
    roda(p, 100);
    assert.ok(p.rodada > rodada || p.fase === 'fim', jogo.id + ' nao terminou');
  }
});

test('escolha feita no celular chega ao minijogo por um passo so', () => {
  const vistas = [];
  const p = criaPartida(() => 0.3);
  pulaPara(p, { id: 't', nome: 't', dica: 't', inicia() {}, atualiza(q) { vistas.push(q.jogadores[1].escolha); } });
  while (p.fase !== 'jogando') passo(p, DT);
  entrada(p, 1, { x: 0, y: 0, op: 0, nop: 0 });
  entrada(p, 1, { x: 0, y: 0, op: 2, nop: 1 });
  passo(p, DT); passo(p, DT);
  assert.deepEqual(vistas.slice(-2), [2, -1]);
});

test('minijogo que da erro sai da rotacao e a partida continua', () => {
  const ruim = { id: 'ruim', nome: 'r', dica: 'r', inicia() {}, atualiza() { throw new Error('quebrou'); } };
  registra(ruim);
  const p = criaPartida(() => 0.3);
  pulaPara(p, ruim);
  roda(p, 4);
  assert.equal(p.vencedor, -1);
  assert.ok(!JOGOS.includes(ruim));
  assert.match(p.erros[0], /ruim: quebrou/);
  roda(p, 3);
  assert.equal(p.fase, 'intro');
});

test('registra troca a versao de um minijogo com o mesmo id', () => {
  const v1 = { id: 'novo', nome: 'v1', dica: 'd', inicia() {}, atualiza() {} };
  const v2 = { ...v1, nome: 'v2' };
  const antes = JOGOS.length;
  registra(v1); registra(v2);
  assert.equal(JOGOS.length, antes + 1);
  assert.equal(JOGOS.at(-1).nome, 'v2');
  JOGOS.pop();
  assert.throws(() => registra({ id: 'x' }));
});

test('com esperaPronto a rodada so comeca depois que os dois apertam A', () => {
  const p = criaPartida(() => 0.3);
  p.esperaPronto = true;
  roda(p, 10);
  assert.equal(p.fase, 'intro');
  assert.ok(aguardando(p));
  assert.equal(tempoIntro(p), 3.5, 'contagem parada enquanto espera');
  entrada(p, 0, { x: 0, y: 0, d: true });
  roda(p, 5);
  assert.ok(aguardando(p), 'so um pronto ainda nao comeca');
  assert.equal(p.jogadores[0].pronto, true);
  entrada(p, 1, { x: 0, y: 0, n: 0 });
  entrada(p, 1, { x: 0, y: 0, n: 1 });       // toque curto pelo contador
  roda(p, 1);
  assert.ok(!aguardando(p));
  assert.equal(p.fase, 'intro', 'agora roda a contagem 3-2-1');
  roda(p, 3);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.jogadores[0].querDash <= 0, true, 'o toque de pronto nao vira empurrao');
});

test('pronto vale de novo a cada rodada e ha um limite de espera', () => {
  const p = criaPartida(() => 0.3);
  p.esperaPronto = true;
  roda(p, 61);
  assert.ok(!aguardando(p), 'depois de 60 s comeca sozinho');
  pulaPara(p, JOGOS[0]);
  assert.ok(aguardando(p));
  assert.equal(p.jogadores[0].pronto, false);
});

test('retorno invalido do atualiza tira o minijogo em vez de travar', () => {
  for (const ruim of [false, null, true, 2, '0', NaN]) {
    const jogo = { id: 'ret', nome: 'r', dica: 'r', inicia() {}, atualiza() { return ruim; } };
    registra(jogo);
    const p = criaPartida(() => 0.3);
    pulaPara(p, jogo);
    roda(p, 4);
    assert.equal(p.vencedor, -1, String(ruim));
    assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0]);
    assert.ok(!JOGOS.includes(jogo));
  }
});

test('arena quebrada pelo minijogo nao trava o passo', () => {
  const jogo = { id: 'arena', nome: 'a', dica: 'a', inicia(p) { p.arena = null; }, atualiza() {} };
  registra(jogo);
  const p = criaPartida(() => 0.3);
  pulaPara(p, jogo);
  roda(p, 8);
  assert.ok(!JOGOS.includes(jogo));
  assert.notEqual(p.jogo, jogo);
});

test('minijogo que nunca decide e encerrado pelo motor com empate', () => {
  const jogo = { id: 'eterno', nome: 'e', dica: 'e', inicia() {}, atualiza() {} };
  const p = criaPartida(() => 0.3);
  pulaPara(p, jogo);
  roda(p, 3.6 + 76);
  assert.equal(p.vencedor, -1);
  assert.notEqual(p.fase, 'jogando');
});

test('contador que diminui (celular recarregou) nao conta como toque', () => {
  const vistos = [];
  const p = criaPartida(() => 0.3);
  pulaPara(p, { id: 'c', nome: 'c', dica: 'c', inicia() {}, atualiza(q) { vistos.push([q.jogadores[0].apertouA, q.jogadores[0].escolha]); } });
  while (p.fase !== 'jogando') passo(p, DT);
  entrada(p, 0, { x: 0, y: 0, n: 37, nb: 9, op: 2, nop: 4 });
  passo(p, DT);
  entrada(p, 0, { x: 0, y: 0, n: 0, nb: 0, op: -1, nop: 0 });     // pagina recarregada
  passo(p, DT);
  entrada(p, 0, { x: 0, y: 0, n: 2, nb: 0, op: 1, nop: 1 });      // dois toques e uma escolha de verdade
  passo(p, DT);
  assert.deepEqual(vistos.slice(-3), [[0, -1], [0, -1], [2, 1]]);
});

test('helice: parados, ninguem e atingido no primeiro segundo e meio', () => {
  const p = partidaEm('helice');
  roda(p, 1.5);
  assert.equal(p.fase, 'jogando');
  assert.ok(p.jogadores.every(j => j.vivo && Math.hypot(j.vx, j.vz) < 0.1));
});

test('modificadores: desligados por padrao; ligados aparecem depois da 2a rodada e respeitam o minijogo', () => {
  const p = criaPartida(() => 0.1);
  for (let i = 0; i < 6; i++) { pulaPara(p, JOGOS[0]); assert.equal(p.mod, null); }
  const q = criaPartida(() => 0.1);
  q.modificadores = true;
  assert.equal(q.mod, null, 'primeiras rodadas sem tempero');
  const parado = { id: 'parado', nome: 'p', dica: 'p', semMovimento: true, inicia() {}, atualiza() {} };
  const vistos = new Set();
  let n = 0;
  q.rng = () => [0.1, 0.05, 0.3, 0.55, 0.75, 0.95, 0.2][n++ % 7];
  for (let i = 0; i < 40; i++) {
    pulaPara(q, i % 2 ? parado : JOGOS[0]);
    if (!q.mod) continue;
    vistos.add(q.mod.id);
    if (q.jogo === parado) assert.ok(!q.mod.anda, 'minijogo sem movimento nao recebe modificador de movimento');
  }
  assert.ok(vistos.size >= 3, 'variedade: ' + [...vistos]);
});

test('modificadores: ouro vale 2 pontos, espelho inverte, gelo escorrega', () => {
  const mod = id => MODIFICADORES.find(m => m.id === id);
  const p = partidaEm('sumo');
  p.mod = mod('ouro');
  p.dados.placar = [0, 1]; p.t = 5;
  p.jogadores[0].vivo = false;
  passo(p, DT);
  assert.equal(p.jogadores[1].pontos, 2);

  const q = partidaEm('bomba');
  q.mod = mod('espelho');
  const x0 = q.jogadores[0].x;
  entrada(q, 0, { x: 1, y: 0 });
  roda(q, 0.3);
  assert.ok(q.jogadores[0].x < x0, 'joystick para a direita anda para a esquerda');

  const desliza = m => {
    const r = partidaEm('colina');
    r.mod = m; r.dados.muda = 99;
    const j = r.jogadores[0];
    Object.assign(j, { x: 0, z: -6, vx: 0, vz: 6 });
    roda(r, 0.5);
    return j.z;
  };
  assert.ok(desliza(mod('gelo')) > desliza(null) + 0.5, 'no gelo o boneco vai mais longe');
});

test('duas abas no mesmo jogador: vale a mais nova, sem toque fantasma e sem perder toque', () => {
  const p = partidaEm('bomba');
  const j = p.jogadores[0];
  entrada(p, 0, { s: 111, q: 1, n: 30, nb: 7 });
  entrada(p, 0, { s: 222, q: 1, n: 0, nb: 0 });
  for (let k = 2; k < 12; k++) {
    entrada(p, 0, { s: 111, q: k, n: 30 + k, nb: 7, x: -1 });      // aba velha em segundo plano
    entrada(p, 0, { s: 222, q: k, n: 0, nb: 0, x: 1 });
  }
  assert.equal(j.apertouA, 0);
  assert.equal(j.apertouB, 0);
  assert.equal(j.ent.x, 1, 'joystick e da aba nova');
  entrada(p, 0, { s: 111, q: 50, n: 99 });
  entrada(p, 0, { s: 222, q: 50, n: 1, d: true });
  assert.equal(j.apertouA, 1, 'toque real logo depois de mensagem da aba velha conta');
  assert.equal(j.ent.d, true);
});

test('aba nova ja vale o botao segurado; pausado (semToque) acompanha sem contar toque', () => {
  const p = partidaEm('bomba');
  const j = p.jogadores[0];
  entrada(p, 0, { s: 1, q: 1, n: 0 });
  entrada(p, 0, { s: 2, q: 1, n: 5, d: true, x: 1 });
  assert.equal(j.apertouA, 0);
  assert.deepEqual([j.ent.d, j.ent.x], [true, 1]);
  entrada(p, 0, { s: 2, q: 2, n: 8, d: true }, true);
  assert.equal(j.apertouA, 0, 'toque na pausa nao vale depois');
  assert.equal(j.ent.d, true, 'segurando continua segurando');
  entrada(p, 0, { s: 2, q: 3, n: 9, d: true });
  assert.equal(j.apertouA, 1);
});

test('mensagem atrasada (sequencia antiga) da mesma sessao e ignorada', () => {
  const p = partidaEm('bomba');
  const j = p.jogadores[0];
  entrada(p, 0, { s: 5, q: 1, n: 0 });
  entrada(p, 0, { s: 5, q: 3, n: 1 });
  entrada(p, 0, { s: 5, q: 2, n: 0 });   // POST velho chegando depois do WebSocket
  entrada(p, 0, { s: 5, q: 4, n: 1 });
  assert.equal(j.apertouA, 1, 'um toque real conta uma vez');
});

test('modificador de movimento nao cai em minijogo que nao e de joystick, mesmo sem semMovimento', () => {
  const q = criaPartida(() => 0.1);
  q.modificadores = true;
  const botao = { id: 'botao-x', nome: 'b', dica: 'b', controle: { modo: 'botao' }, inicia() {}, atualiza() {} };
  let n = 0;
  q.rng = () => [0.1, 0.05, 0.3, 0.55, 0.75, 0.95, 0.2][n++ % 7];
  for (let i = 0; i < 40; i++) { pulaPara(q, botao); if (q.mod) assert.ok(!q.mod.anda, q.mod.id); }
});

test('um empurrao no parado nao derruba o outro do sumo em menos de 3 s', () => {
  const p = partidaEm('sumo');
  const [a, b] = p.jogadores;
  a.x = 2; a.z = 0; b.x = 4; b.z = 0;
  entrada(p, 0, { d: true, n: 1 }, true);
  entrada(p, 0, { d: true, n: 2 });
  let t = 0;
  while (t < 3 && p.jogadores[1].vivo && p.jogadores[0].vivo) { passo(p, DT); t += DT; }
  assert.ok(p.jogadores[1].vivo, `caiu em ${t.toFixed(2)} s`);
});

test('futebol: a bola nao passa de 14 m/s', () => {
  const p = partidaEm('futebol');
  p.dados.bola.vx = 60; p.dados.bola.vz = 30;
  passo(p, DT);
  assert.ok(Math.hypot(p.dados.bola.vx, p.dados.bola.vz) <= 14);
});

// ---------- cartas de poder (boosts de virada) ----------
// Termina a rodada atual com o vencedor dado, sem depender de minijogo.
function fecha(p, vencedor) {
  p.fase = 'jogando';
  p.jogo = { id: 'fecha', nome: 'f', dica: 'f', inicia() {}, atualiza: () => vencedor };
  passo(p, DT);
}
const joystick = () => JOGOS.find(j => j.id === 'bomba');
const soBotao = { id: 'so-botao', nome: 'b', dica: 'b', controle: { modo: 'botao' }, inicia() {}, atualiza() {} };

test('cartas: quem perde a rodada recebe 3 cartas na explicacao da proxima; quem vence e empate nao', () => {
  const p = criaPartida(() => 0.3);
  fecha(p, 0);
  pulaPara(p, joystick());
  assert.equal(p.jogadores[0].oferta, null);
  assert.equal(p.jogadores[1].oferta.length, 3);
  assert.equal(new Set(p.jogadores[1].oferta).size, 3, 'cartas diferentes');
  for (const id of p.jogadores[1].oferta) assert.ok(CARTAS.some(c => c.id === id));
  fecha(p, -1);
  pulaPara(p, joystick());
  assert.deepEqual(p.jogadores.map(j => j.oferta), [null, null], 'empate nao da carta');
});

test('cartas: escolha no celular durante a intro ativa a carta; indice fora da faixa e contador velho nao valem', () => {
  const p = criaPartida(() => 0.3);
  fecha(p, 0);
  pulaPara(p, joystick());
  const j = p.jogadores[1], oferta = [...j.oferta];
  entrada(p, 1, { op: 0, nop: 0 });
  entrada(p, 1, { op: 7, nop: 1 });
  assert.equal(j.carta, null, 'indice 7 nao existe');
  entrada(p, 1, { op: -1, nop: 2 });
  assert.equal(j.carta, null);
  entrada(p, 1, { op: 2, nop: 2 });
  assert.equal(j.carta, null, 'contador repetido nao e toque');
  entrada(p, 1, { op: 2, nop: 3 });
  assert.equal(j.carta, oferta[2]);
  assert.equal(j.oferta, null);
  entrada(p, 1, { op: 0, nop: 4 });
  assert.equal(j.carta, oferta[2], 'so uma carta por rodada');
});

test('cartas: oferta nao escolhida some quando a rodada comeca e a carta vale uma rodada so', () => {
  const p = criaPartida(() => 0.3);
  fecha(p, 0);
  pulaPara(p, joystick());
  roda(p, 4);
  assert.equal(p.fase, 'jogando');
  assert.equal(p.jogadores[1].oferta, null);
  entrada(p, 1, { op: 0, nop: 0 }); entrada(p, 1, { op: 0, nop: 1 });
  assert.equal(p.jogadores[1].carta, null, 'durante o jogo a escolha e do minijogo');
  const q = criaPartida(() => 0.3);
  fecha(q, 0); pulaPara(q, joystick());
  q.jogadores[1].carta = 'turbo';
  fecha(q, 0); pulaPara(q, joystick());
  assert.equal(q.jogadores[1].carta, null, 'carta acaba com a rodada');
});

test('cartas: minijogo sem joystick nao oferece turbo, dash nem pulo', () => {
  for (let k = 0; k < 20; k++) {
    let n = k;
    const p = criaPartida(() => ((n = (n * 7 + 3) % 17) / 17));
    fecha(p, 0);
    pulaPara(p, soBotao);
    for (const id of p.jogadores[1].oferta) assert.ok(!CARTAS.find(c => c.id === id).anda, id);
  }
});

test('cartas: vale dobro da 2 pontos e respeita o maximo', () => {
  const p = criaPartida(() => 0.3);
  p.jogadores[0].carta = 'dobro';
  fecha(p, 0);
  assert.equal(p.jogadores[0].pontos, 2);
  const q = criaPartida(() => 0.3);
  q.jogadores[0].pontos = PONTOS_VITORIA - 1; q.jogadores[0].carta = 'dobro';
  fecha(q, 0);
  assert.equal(q.jogadores[0].pontos, PONTOS_VITORIA);
  assert.equal(q.fase, 'fim');
});

test('cartas: escudo segura o ponto do outro, so aparece para quem esta atras e nunca duas vezes seguidas', () => {
  const p = criaPartida(() => 0.3);
  p.jogadores[1].carta = 'escudo';
  fecha(p, 0);
  assert.equal(p.jogadores[0].pontos, 0, 'escudo segurou o ponto');
  assert.ok(p.anuncios.some(a => a.tipo === 'escudo' && a.quem === 1));
  for (let k = 0; k < 15; k++) {          // empatado no placar: escudo nao entra na oferta
    let n = k;
    const q = criaPartida(() => ((n = (n * 5 + 1) % 13) / 13));
    fecha(q, 0); q.jogadores[0].pontos = 0;
    pulaPara(q, soBotao);
    assert.ok(!q.jogadores[1].oferta.includes('escudo'), 'empatado nao recebe escudo');
  }
  // atras no placar: no minijogo so de botao sobram 3 cartas (dobro, moedas, escudo), todas oferecidas
  const r = criaPartida(() => 0.3);
  r.jogadores[0].pontos = 2;
  fecha(r, 0);
  pulaPara(r, soBotao);
  assert.ok(r.jogadores[1].oferta.includes('escudo'));
  r.jogadores[1].carta = 'escudo'; r.jogadores[1].oferta = null;
  fecha(r, 0);
  pulaPara(r, soBotao);
  assert.ok(!r.jogadores[1].oferta.includes('escudo'), 'escudo nao vem duas vezes seguidas');
});

test('cartas: escudo nao soma na sequencia de vitorias de quem teve o ponto segurado', () => {
  const p = criaPartida(() => 0.3);
  fecha(p, 0);
  assert.equal(p.seq[0], 1);
  p.jogadores[1].carta = 'escudo';
  fecha(p, 0);
  assert.equal(p.seq[0], 1, 'ponto segurado nao conta');
  assert.ok(!p.anuncios.some(a => a.tipo === 'seq'));
});

test('cartas: moedas em dobro e valores das moedas da rodada', () => {
  const p = criaPartida(() => 0.3);
  p.jogadores[1].carta = 'moedas';
  fecha(p, 0);
  assert.deepEqual([moedasDaRodada(p, 0), moedasDaRodada(p, 1)], [10, 6]);
  const q = criaPartida(() => 0.3);
  fecha(q, -1);
  assert.deepEqual([moedasDaRodada(q, 0), moedasDaRodada(q, 1)], [5, 5]);
  const r = criaPartida(() => 0.3);
  r.jogadores[0].pontos = PONTOS_VITORIA - 1;
  fecha(r, 0);
  assert.equal(moedasDaRodada(r, 0), 40, 'vitoria da partida da +30');
});

test('cartas de joystick: turbo acelera, dash recarrega antes e pulo vai mais alto', () => {
  const corre = carta => {
    const p = partidaEm('colina'); p.dados.muda = 99;
    p.jogadores[0].carta = carta;
    entrada(p, 0, { x: 1, y: 0 }); roda(p, 0.25);
    return p.jogadores[0].vx;
  };
  assert.ok(corre('turbo') > corre(null) * 1.2, 'turbo');
  const recarga = carta => {
    const p = partidaEm('colina'); p.dados.muda = 99;
    p.jogadores[0].carta = carta;
    entrada(p, 0, { n: 0 }); entrada(p, 0, { n: 1, d: true }); passo(p, DT);
    return p.jogadores[0].cd;
  };
  assert.ok(recarga('dash') < recarga(null) * 0.7, 'dash');
  const altura = carta => {
    const p = partidaEm('colina'); p.dados.muda = 99;
    p.jogadores[0].carta = carta;
    entrada(p, 0, { nb: 0 }); entrada(p, 0, { nb: 1, b: true });
    let max = 0;
    for (let k = 0; k < 90; k++) { passo(p, DT); max = Math.max(max, p.jogadores[0].y); }
    return max;
  };
  assert.ok(altura('pulo') > altura(null) * 1.5, 'pulo alto');
});

// ---------- anuncios: sequencia, virada e ponto da partida ----------
test('anuncios: duas vitorias seguidas viram sequencia; empate nao quebra; derrota zera', () => {
  const p = criaPartida(() => 0.3);
  fecha(p, 0);
  assert.ok(!p.anuncios.some(a => a.tipo === 'seq'));
  fecha(p, 0);
  assert.deepEqual(p.anuncios.find(a => a.tipo === 'seq'), { tipo: 'seq', quem: 0, n: 2 });
  fecha(p, -1);
  fecha(p, 0);
  assert.equal(p.anuncios.find(a => a.tipo === 'seq').n, 3);
  fecha(p, 1);
  assert.ok(!p.anuncios.some(a => a.tipo === 'seq'));
  assert.equal(p.seq[0], 0);
});

test('anuncios: virada quando empata depois de estar 2 atras, e quando passa a frente', () => {
  const p = criaPartida(() => 0.3);
  fecha(p, 0); fecha(p, 0);           // 2 x 0
  fecha(p, 1);
  assert.ok(!p.anuncios.some(a => a.tipo === 'virada'));
  fecha(p, 1);                        // 2 x 2
  assert.deepEqual(p.anuncios.find(a => a.tipo === 'virada'), { tipo: 'virada', quem: 1 });
  const q = criaPartida(() => 0.3);
  fecha(q, 0);                        // 1 x 0
  q.jogadores[1].carta = 'dobro';
  fecha(q, 1);                        // 1 x 2: passou a frente
  assert.ok(q.anuncios.some(a => a.tipo === 'virada' && a.quem === 1));
});

test('anuncios: ponto da partida quando alguem fica a 1 ponto', () => {
  const p = criaPartida(() => 0.3);
  p.jogadores[1].pontos = PONTOS_VITORIA - 2;
  fecha(p, 1);
  assert.deepEqual(p.anuncios.find(a => a.tipo === 'match'), { tipo: 'match', quem: 1 });
  p.jogadores[0].pontos = PONTOS_VITORIA - 2;
  fecha(p, 0);
  assert.equal(p.anuncios.find(a => a.tipo === 'match').quem, 2, 'os dois a 1 ponto');
  fecha(p, 0);
  assert.equal(p.fase, 'fim');
  assert.ok(!p.anuncios.some(a => a.tipo === 'match'));
  assert.equal(p.campeao, 0);
});

// ---------- minijogo cooperativo ----------
const coop = res => ({ id: 'coop-x', nome: 'c', dica: 'c', coop: true, inicia() {}, atualiza: () => res });
function joga(p, jogo) { pulaPara(p, jogo); while (p.fase === 'intro') passo(p, DT); passo(p, DT); }

test('coop: vitoria em equipe da 1 ponto para cada um e anuncio de equipe', () => {
  const p = criaPartida(() => 0.3);
  joga(p, coop(2));
  assert.equal(p.vencedor, 2);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [1, 1]);
  assert.ok(p.anuncios.some(a => a.tipo === 'equipe'));
  assert.deepEqual([moedasDaRodada(p, 0), moedasDaRodada(p, 1)], [10, 10]);
  assert.deepEqual(p.erros, []);
});

test('coop: fracasso nao da ponto a ninguem e cada um leva 3 moedas', () => {
  const p = criaPartida(() => 0.3);
  joga(p, coop(-1));
  assert.equal(p.vencedor, -1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0]);
  assert.deepEqual([moedasDaRodada(p, 0), moedasDaRodada(p, 1)], [3, 3]);
  assert.deepEqual(p.jogadores.map(j => j.direito), [false, false], 'fracasso juntos nao da carta');
});

test('coop: retorno 2 em minijogo que nao e coop continua invalido; coop nao pode devolver 0 ou 1', () => {
  const p = criaPartida(() => 0.3);
  const falso = { id: 'nao-coop-2', nome: 'n', dica: 'n', inicia() {}, atualiza: () => 2 };
  registra(falso);
  joga(p, falso);
  assert.equal(p.vencedor, -1);
  assert.deepEqual(p.jogadores.map(j => j.pontos), [0, 0]);
  assert.ok(p.erros.some(e => e.includes('nao-coop-2')));
  assert.ok(!JOGOS.includes(falso), 'saiu da rotacao');
  const q = criaPartida(() => 0.3);
  joga(q, { ...coop(0), id: 'coop-torto' });
  assert.ok(q.erros.some(e => e.includes('coop-torto')));
  assert.deepEqual(q.jogadores.map(j => j.pontos), [0, 0]);
});

test('coop: os dois chegando a 5 juntos acabam a partida como campeoes', () => {
  const p = criaPartida(() => 0.3);
  for (const j of p.jogadores) j.pontos = PONTOS_VITORIA - 1;
  joga(p, coop(2));
  assert.equal(p.fase, 'fim');
  assert.equal(p.campeao, 2);
  assert.deepEqual([moedasDaRodada(p, 0), moedasDaRodada(p, 1)], [40, 40]);
});

test('coop: nao entra no sorteio quando so um esta a 1 ponto; cartas ficam guardadas para a rodada competitiva', () => {
  const c = coop(2);
  registra(c);
  try {
    const p = criaPartida(() => 0.3);
    p.jogadores[0].pontos = PONTOS_VITORIA - 1;
    for (let k = 0; k < JOGOS.length * 2; k++) { p.fase = 'resultado'; p.t = 0; roda(p, 2.6); assert.notEqual(p.jogo, c); }
    const q = criaPartida(() => 0.3);
    fecha(q, 0);
    pulaPara(q, c);
    assert.equal(q.jogadores[1].oferta, null, 'sem carta em rodada coop');
    assert.equal(q.jogadores[1].direito, true, 'direito guardado');
    pulaPara(q, joystick());
    assert.equal(q.jogadores[1].oferta.length, 3);
  } finally { JOGOS.splice(JOGOS.indexOf(c), 1); }
});

// ---------- labirinto: itens que caem das caixas ----------
function labirintoLimpo() {
  const p = partidaEm('labirinto');
  for (const col of p.dados.grade) col.fill(0);
  return p;
}
const centro = (p, i, k) => ({ x: -p.arena.lx + 1 + i * 2, z: -p.arena.lz + 1 + k * 2 });
function longe(p) { Object.assign(p.jogadores[0], centro(p, 0, 8)); Object.assign(p.jogadores[1], centro(p, 10, 8)); }

test('labirinto: caixa quebrada pode soltar item; o fogo da propria explosao nao queima o item', () => {
  const p = labirintoLimpo();
  p.rng = () => 0.1;                                  // sempre solta, e o tipo e bomba extra
  p.dados.grade[4][2] = 2;
  p.dados.bombas.push({ i: 2, k: 2, t: 0.01, dono: 0, alcance: 2 });
  longe(p);
  passo(p, DT);
  assert.equal(p.dados.grade[4][2], 0);
  assert.equal(p.dados.itens.length, 1);
  assert.deepEqual([p.dados.itens[0].i, p.dados.itens[0].k, p.dados.itens[0].tipo], [4, 2, 'bomba']);
  roda(p, 0.6);
  assert.equal(p.dados.itens.length, 1, 'continua no chao depois do fogo');
});

test('labirinto: explosao destroi item que ja estava no chao', () => {
  const p = labirintoLimpo();
  p.dados.itens.push({ i: 3, k: 2, tipo: 'fogo', t: 0 });
  p.dados.bombas.push({ i: 2, k: 2, t: 0.01, dono: 0, alcance: 2 });
  longe(p);
  passo(p, DT);
  assert.equal(p.dados.itens.length, 0);
  assert.equal(p.dados.queimados.length, 1);
});

test('labirinto: bomba extra deixa soltar mais bombas ao mesmo tempo', () => {
  const p = labirintoLimpo();
  p.dados.itens.push({ i: 0, k: 0, tipo: 'bomba', t: 0 });
  Object.assign(p.jogadores[0], centro(p, 0, 0)); Object.assign(p.jogadores[1], centro(p, 10, 8));
  passo(p, DT);
  assert.equal(p.dados.poder[0].bombas, 3);
  assert.equal(p.dados.coletas.length, 1);
  const j = p.jogadores[0];
  entrada(p, 0, { n: 0 });
  for (let k = 1; k <= 4; k++) {
    Object.assign(j, centro(p, 0, k * 2), { vx: 0, vz: 0 });
    entrada(p, 0, { n: k }); passo(p, DT);
  }
  assert.equal(p.dados.bombas.filter(b => b.dono === 0).length, 3);
});

test('labirinto: fogo aumenta o alcance da explosao', () => {
  const p = labirintoLimpo();
  p.dados.itens.push({ i: 0, k: 0, tipo: 'fogo', t: 0 });
  Object.assign(p.jogadores[0], centro(p, 0, 0)); Object.assign(p.jogadores[1], centro(p, 10, 8));
  passo(p, DT);
  assert.equal(p.dados.poder[0].fogo, 3);
  entrada(p, 0, { n: 0 }); entrada(p, 0, { n: 1 }); passo(p, DT);
  const b = p.dados.bombas[0];
  assert.equal(b.alcance, 3);
  Object.assign(p.jogadores[0], centro(p, 0, 8));
  b.t = 0.01; passo(p, DT);
  assert.ok(p.dados.fogo.some(f => f.i === 3 && f.k === 0), 'fogo chega a 3 casas');
});

test('labirinto: patins aumenta a velocidade', () => {
  const corre = patins => {
    const p = labirintoLimpo();
    if (patins) p.dados.itens.push({ i: 0, k: 0, tipo: 'patins', t: 0 });
    Object.assign(p.jogadores[0], centro(p, 0, 0)); Object.assign(p.jogadores[1], centro(p, 10, 8));
    passo(p, DT);
    entrada(p, 0, { x: 1, y: 0 }); roda(p, 0.3);
    return p.jogadores[0].vx;
  };
  assert.ok(corre(true) > corre(false) * 1.15);
});

test('labirinto: atravessa caixas passa por caixa, mas pilar continua segurando', () => {
  const anda = (passa, tipo) => {
    const p = labirintoLimpo();
    p.dados.grade[1][0] = tipo;
    if (passa) p.dados.poder[0].passa = true;
    Object.assign(p.jogadores[0], centro(p, 0, 0)); Object.assign(p.jogadores[1], centro(p, 10, 8));
    entrada(p, 0, { x: 1, y: 0 }); roda(p, 0.6);
    return p.jogadores[0].x - centro(p, 0, 0).x;
  };
  assert.ok(anda(true, 2) > 1.5, 'passou pela caixa');
  assert.ok(anda(false, 2) < 0.6, 'sem o item a caixa segura');
  assert.ok(anda(true, 1) < 0.6, 'pilar segura sempre');
});

// ---------- correcoes da revisao ----------
test('coop: rodada de ouro nao sai quando os 2 pontos dariam a partida para um so', () => {
  const ouro = MODIFICADORES.find(m => m.id === 'ouro');
  for (let k = 0; k < 30; k++) {
    let n = k;
    const p = criaPartida(() => ((n = (n * 7 + 3) % 19) / 19));
    p.modificadores = true; p.rodada = 5;
    p.jogadores[0].pontos = PONTOS_VITORIA - 2; p.jogadores[1].pontos = PONTOS_VITORIA - 3;
    pulaPara(p, coop(2));
    assert.notEqual(p.mod, ouro, 'ouro em coop com alguem a 2 pontos');
  }
});

test('cartas: toque na carta que chega logo depois da intro nao vira escolha do minijogo', () => {
  const opcoes = { id: 'opcoes-x', nome: 'o', dica: 'o', controle: { modo: 'opcoes' }, inicia(p) { p.dados.vistas = []; }, atualiza(p) { for (const j of p.jogadores) if (j.escolha >= 0) p.dados.vistas.push(j.escolha); } };
  const p = criaPartida(() => 0.3);
  fecha(p, 0);
  pulaPara(p, opcoes);
  entrada(p, 1, { op: 0, nop: 0 });
  while (p.fase === 'intro') passo(p, DT);
  entrada(p, 1, { op: 2, nop: 1 });              // toque feito na carta, chegando atrasado
  passo(p, DT);
  assert.deepEqual(p.dados.vistas, []);
  roda(p, 0.4);
  entrada(p, 1, { op: 1, nop: 2 });              // toque de verdade no minijogo
  passo(p, DT);
  assert.deepEqual(p.dados.vistas, [1]);
});

test('cartas: a quarta opcao "sem carta" recusa a oferta e ja conta como pronto', () => {
  const p = criaPartida(() => 0.3);
  p.esperaPronto = true;
  fecha(p, 0);
  pulaPara(p, joystick());
  const j = p.jogadores[1];
  entrada(p, 1, { op: 0, nop: 0 });
  entrada(p, 1, { op: 3, nop: 1 });
  assert.equal(j.oferta, null);
  assert.equal(j.carta, null);
  assert.equal(j.pronto, true);
});

test('cartas: escudo nao volta logo depois de uma rodada coop nem quando o inicia falha e o motor tenta outro', () => {
  const c = coop(-1);
  const r = criaPartida(() => 0.3);
  r.jogadores[0].pontos = 3;
  r.jogadores[1].carta = 'escudo';
  fecha(r, 0);                          // escudo usado; J2 ganha direito
  pulaPara(r, c);                       // rodada coop no meio: carta guardada
  pulaPara(r, soBotao);
  assert.ok(!r.jogadores[1].oferta.includes('escudo'), 'coop no meio nao libera o escudo');
  const q = criaPartida(() => 0.3);
  q.jogadores[0].pontos = 3;
  q.jogadores[1].carta = 'escudo';
  fecha(q, 0);
  const quebrado = { id: 'quebra-inicia', nome: 'q', dica: 'q', inicia() { throw new Error('x'); }, atualiza() {} };
  q.fila = [quebrado, soBotao];
  q.fase = 'resultado'; q.t = 0; roda(q, 2.6);
  assert.equal(q.jogo, soBotao);
  assert.ok(!q.jogadores[1].oferta.includes('escudo'), 'tentativa nova nao apaga a carta anterior');
});

test('empurroes: cada dash real soma 1 em j.empurroes, mesmo com a carta dash, e zera na rodada nova', () => {
  const p = partidaEm('sumo');
  const j = p.jogadores[0];
  j.carta = 'dash';
  assert.equal(j.empurroes, 0);
  for (let n = 1; n <= 3; n++) { entrada(p, 0, { d: true, n }); roda(p, 0.6); }
  assert.equal(j.empurroes, 3);
  pulaPara(p, JOGOS.find(x => x.id === 'sumo'));
  assert.equal(p.jogadores[0].empurroes, 0);
});

test('batida: dois bonecos andando um contra o outro por 2 s geram poucas batidas', () => {
  const p = partidaEm('sumo');
  p.arena.raio = 20;
  p.jogadores[0].x = -3; p.jogadores[1].x = 3;
  let batidas = 0;
  entrada(p, 0, { x: 1, y: 0 }); entrada(p, 1, { x: -1, y: 0 });
  for (let i = 0; i < 120; i++) { p.eventos.length = 0; passo(p, DT); batidas += p.eventos.filter(e => e === 'batida').length; }
  assert.ok(batidas >= 1 && batidas <= 10, `batidas: ${batidas}`);
});

// ---------- placar que da virada: melhor de 3 quedas (sumo, lava, helice, meteoros) ----------
// Quem cai da 1 queda ao outro e volta ao centro com 1,5 s de protecao; 2 quedas vencem; aos 50 s vence quem derrubou mais.
const QUEDAS_JOGOS = ['sumo', 'lava', 'helice', 'meteoros'];
function partidaQuedas(id) {
  const p = partidaEm(id);
  if (id === 'meteoros') p.dados.prox = 999;
  return p;
}
function rodaQuedas(p, seg) {                    // na lava o piso cai sozinho: aqui ele e refeito a cada quadro
  for (let i = 0; i < seg * 60; i++) {
    for (const x of p.dados.pisos ?? []) { x.t = -1; x.caiu = false; }
    if (p.jogo.id === 'helice') for (const j of p.jogadores) j.imune = 999;      // a barra nao interfere no teste
    passo(p, DT);
  }
}
const caiu = (p, i) => { p.jogadores[i].vivo = false; rodaQuedas(p, 1 / 60); };

for (const id of QUEDAS_JOGOS) {
  test(`${id}: uma queda so da 1 ao outro, nao encerra, e quem caiu volta ao centro`, () => {
    const p = partidaQuedas(id), [a] = p.jogadores;
    caiu(p, 0);
    assert.deepEqual(p.dados.placar, [0, 1]);
    assert.equal(p.fase, 'jogando');
    assert.equal(a.vivo, false, 'esta caindo');
    rodaQuedas(p, 1.5);
    assert.equal(a.vivo, true, 'voltou');
    assert.ok(Math.hypot(a.x, a.z) < 2.5 && a.y === 0, `voltou ao centro (${a.x}, ${a.z})`);
    assert.deepEqual(p.dados.placar, [0, 1]);
  });

  test(`${id}: depois de voltar, 1,5 s de protecao: nao cai nem da ponto; passado o tempo, cai`, () => {
    const p = partidaQuedas(id), [a] = p.jogadores;
    caiu(p, 0);
    rodaQuedas(p, 1.5);
    a.vivo = false; rodaQuedas(p, 1 / 60);
    assert.equal(a.vivo, true, 'protegido');
    assert.deepEqual(p.dados.placar, [0, 1]);
    rodaQuedas(p, 1.6); p.t = 5;
    caiu(p, 0);
    assert.equal(p.vencedor, 1, 'sem protecao a queda vale');
  });

  test(`${id}: melhor de 3, quem derruba 2 vezes vence, e da para virar`, () => {
    const p = partidaQuedas(id);
    caiu(p, 0); rodaQuedas(p, 1.5);                  // azul cai: 0 x 1
    rodaQuedas(p, 1.6);
    caiu(p, 1); rodaQuedas(p, 1.5);                  // rosa cai: 1 x 1
    assert.deepEqual(p.dados.placar, [1, 1]);
    assert.equal(p.fase, 'jogando');
    rodaQuedas(p, 1.6);
    caiu(p, 1);                                      // rosa cai de novo: 2 x 1
    assert.deepEqual(p.dados.placar, [2, 1]);
    assert.equal(p.vencedor, 0);
    assert.equal(p.jogadores[1].vivo, false);
  });

  test(`${id}: aos 50 s vence quem derrubou mais; igual empata`, () => {
    const p = partidaQuedas(id);
    p.dados.placar = [1, 0];
    p.t = 49.9;
    rodaQuedas(p, 0.3);
    assert.equal(p.vencedor, 0);
    const q = partidaQuedas(id);
    q.dados.placar = [1, 1];
    q.t = 49.9;
    rodaQuedas(q, 0.3);
    assert.equal(q.vencedor, -1);
  });

  test(`${id}: placar de quedas na tela, 50 s e a regra na dica`, () => {
    const p = partidaQuedas(id);
    assert.equal(p.jogo.rotulo, 'quedas');
    assert.equal(p.jogo.duracao, 50);
    assert.deepEqual(p.dados.placar, [0, 0]);
    assert.match(p.jogo.dica, /3/);
  });
}

test('sumo: a arena volta a ter o tamanho cheio depois de uma queda', () => {
  const p = partidaQuedas('sumo');
  roda(p, 12);
  assert.ok(p.arena.raio < 8);
  caiu(p, 0);
  rodaQuedas(p, 1.5);
  assert.equal(p.arena.raio, 8);
});

test('lava: o piso volta inteiro depois de uma queda', () => {
  const p = partidaEm('lava');
  p.dados.pisos[0].caiu = true;
  caiu(p, 0);
  roda(p, 1.5);
  assert.ok(!p.dados.pisos[0].caiu);
});

// ---------- rodada de queda nunca curta: a queda que decide so encerra depois de 5 s de jogo ----------
import { rodada, aleatorio } from './jogos/_teste.mjs';
for (const id of ['sumo', 'lava', 'helice']) {
  test(`${id}: com dedos aleatorios, nenhuma de 40 rodadas dura menos de 5 s`, () => {
    const jogo = JOGOS.find(x => x.id === id);
    let menor = Infinity;
    for (let s = 1; s <= 40; s++) menor = Math.min(menor, rodada(jogo, aleatorio, s).segundos);
    assert.ok(menor > 5, `a mais curta durou ${menor.toFixed(2)} s`);
  });
}

test('queda decisiva antes de 5 s conta no placar, mas a rodada segue e o jogador volta', () => {
  const p = partidaQuedas('sumo');
  caiu(p, 0); rodaQuedas(p, 1.5);                  // 0 x 1
  rodaQuedas(p, 1.6);
  caiu(p, 0);                                      // 0 x 2 aos 3 s: antes de 5 s
  assert.deepEqual(p.dados.placar, [0, 2]);
  assert.equal(p.fase, 'jogando');
  rodaQuedas(p, 1.5);
  assert.equal(p.jogadores[0].vivo, true, 'voltou');
  rodaQuedas(p, 2);
  assert.equal(p.vencedor, 1, 'passados os 5 s, quem esta com 2 quedas vence');
});

// ---------- quedas: quem chega primeiro a 2 quedas vence, mesmo que o outro empate o placar antes dos 5 s ----------
function semente(s) { let x = s * 2654435761 % 4294967296 || 1; return () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296; }
for (const id of QUEDAS_JOGOS) {
  test(`${id}: em 40 sementes, o primeiro a 2 quedas vence (nunca empate por isso), o placar nunca passa de 2 e a rodada passa de 5 s`, () => {
    for (let s = 1; s <= 40; s++) {
      const r = semente(s), p = partidaQuedas(id);
      let primeiro = -1, tFim = 0;
      for (let q = 0; q < 60 * 60 && p.vencedor === undefined; q++) {
        for (const [i, j] of p.jogadores.entries()) if (j.vivo && r() < (i ? 0.004 : 0.012)) j.vivo = false;   // um lado cai bem mais que o outro
        rodaQuedas(p, 1 / 60);
        assert.ok(Math.max(...p.dados.placar) <= 2, `${id} semente ${s}: placar ${p.dados.placar}`);
        if (primeiro < 0) primeiro = p.dados.placar.findIndex(x => x >= 2);
        if (p.vencedor !== undefined) break;
        tFim = p.t;
      }
      assert.ok(tFim >= 4.9 && p.vencedor !== undefined, `${id} semente ${s}: acabou aos ${tFim}`);
      if (primeiro >= 0) assert.equal(p.vencedor, primeiro, `${id} semente ${s}: placar ${p.dados.placar}`);
    }
  });

  test(`${id}: quem decidiu antes dos 5 s espera os 5 s, o outro nao soma e a rodada nao termina cedo`, () => {
    const p = partidaQuedas(id);
    caiu(p, 1); rodaQuedas(p, 3.1);            // 1 x 0 para o J1 (queda, volta e 1,5 s de protecao)
    caiu(p, 1);                                // 2 x 0: decidiu, mas p.t < 5
    assert.deepEqual(p.dados.placar, [2, 0]);
    assert.ok(p.t < 5 && p.vencedor === undefined, `t ${p.t} vencedor ${p.vencedor}`);
    caiu(p, 0); rodaQuedas(p, 0.8);            // o J1 cai: nao conta, e a rodada segue
    assert.deepEqual(p.dados.placar, [2, 0]);
    assert.ok(p.t < 5 && p.vencedor === undefined, `t ${p.t} vencedor ${p.vencedor}`);
    for (let q = 0; q < 60 * 2 && p.vencedor === undefined; q++) rodaQuedas(p, 1 / 60);
    assert.equal(p.vencedor, 0);
  });
}
