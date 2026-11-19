import test from 'node:test';
import assert from 'node:assert/strict';
import { entrada, passo } from '../logica.mjs';
import { partidaCom, roda, fumaca, sorteio, DT } from '../jogos/_teste.mjs';
import jogo from './lanterna.mjs';

// Poe o Cacador em (0,0) olhando para +x e o Fugitivo onde o teste pedir, sem pilares no caminho.
function cena(fx, fz) {
  const p = partidaCom(jogo), d = p.dados;
  d.pilares = [];
  Object.assign(p.jogadores[d.cac], { x: 0, z: 0 });
  Object.assign(p.jogadores[d.fug], { x: fx, z: fz });
  d.ang = 0;
  return p;
}

test('lanterna: papeis sorteados e ditos no celular de cada um', () => {
  const papeis = new Set();
  for (let s = 1; s <= 12; s++) {
    const p = partidaCom(jogo, sorteio(s)), d = p.dados;
    assert.equal(d.cac + d.fug, 1);
    assert.match(p.celular[d.cac].texto, /CAÇADOR/);
    assert.match(p.celular[d.fug].texto, /FUGITIVO/);
    papeis.add(d.cac);
  }
  assert.equal(papeis.size, 2, 'o sorteio cai nos dois jogadores');
});

test('lanterna: o primeiro toque nao acaba: o Fugitivo pisca, fica imune um instante e o segundo toque vence', () => {
  const p = cena(3, 0), d = p.dados;
  for (let k = 0; k < 120 && d.pegou === 0; k++) { entrada(p, d.cac, { x: 1, y: 0 }); passo(p, DT); }
  assert.equal(d.pegou, 1, 'primeiro toque conta');
  assert.equal(p.fase, 'jogando');
  assert.ok(p.jogadores[d.fug].vivo);
  assert.equal(d.visto, true, 'o toque denuncia o Fugitivo');
  Object.assign(p.jogadores[d.fug], { x: p.jogadores[d.cac].x + 1.2, z: p.jogadores[d.cac].z, vx: 0, vz: 0 });
  passo(p, DT);
  assert.equal(d.pegou, 1, 'imune logo depois do toque');
  roda(p, 1.6);
  for (let k = 0; k < 240 && p.fase === 'jogando'; k++) {
    const c = p.jogadores[d.cac], f = p.jogadores[d.fug];
    entrada(p, d.cac, { x: Math.sign(f.x - c.x), y: Math.sign(f.z - c.z) }); passo(p, DT);
  }
  assert.equal(p.vencedor, d.cac);
  assert.equal(p.jogadores[d.fug].vivo, false, 'o Fugitivo voa');
});

test('lanterna: os papeis aparecem na TV no comeco', () => {
  const p = partidaCom(jogo), d = p.dados;
  passo(p, DT);
  assert.match(d.aviso, new RegExp(`Jogador ${d.cac + 1} caça`));
  assert.match(jogo.dica, /2 vezes/);
});

test('lanterna: 30 s sem encostar, o Fugitivo vence', () => {
  const p = partidaCom(jogo), d = p.dados;
  roda(p, 29);
  assert.equal(p.fase, 'jogando');
  roda(p, 1.2);
  assert.equal(p.vencedor, d.fug);
});

test('lanterna: so aparece dentro do cone de luz', () => {
  let p = cena(4, 0); passo(p, DT);
  assert.equal(p.dados.visto, true, 'na frente, dentro do alcance');
  p = cena(-4, 0); passo(p, DT);
  assert.equal(p.dados.visto, false, 'atras do Cacador');
  p = cena(0, 4); passo(p, DT);
  assert.equal(p.dados.visto, false, 'de lado, fora do leque');
  p = cena(8, 0); passo(p, DT);
  assert.equal(p.dados.visto, false, 'na frente, mas longe demais');
});

test('lanterna: a luz vira para onde o Cacador anda', () => {
  const p = cena(0, 5), d = p.dados;
  for (let k = 0; k < 20; k++) { entrada(p, d.cac, { x: 0, y: 1 }); passo(p, DT); }
  assert.ok(Math.abs(d.ang - Math.PI / 2) < 0.2, 'apontou para +z');
  assert.equal(d.visto, true);
});

test('lanterna: o Fugitivo nao tem botao A (so denunciava) e a batida na parede o denuncia por um instante', () => {
  let p = cena(-5, 0), d = p.dados;
  assert.equal(p.celular[d.fug].a, '', 'celular do Fugitivo sem o botao A');
  assert.equal(p.celular[d.cac].a, undefined, 'o Cacador continua com o dele');
  entrada(p, d.fug, { x: 0, y: 0, n: 0 });
  entrada(p, d.fug, { x: 0, y: -1, n: 1 }); roda(p, 0.3);
  assert.equal(p.jogadores[d.fug].empurroes, 0, 'nem pelo teclado o Fugitivo empurra');
  assert.equal(d.visto, false, 'e nao se denuncia');
  roda(p, 1.5);
  assert.equal(d.visto, false);

  p = cena(-7, 0); d = p.dados;
  let visto = false;
  for (let k = 0; k < 60; k++) { entrada(p, d.fug, { x: -1, y: 0 }); passo(p, DT); visto ||= d.visto; }
  assert.equal(visto, true, 'bater na parede correndo denuncia');
});

test('lanterna: pilar segura o boneco', () => {
  const p = cena(-4, 5), d = p.dados;
  d.pilares = [{ x: 3, z: 0 }];
  for (let k = 0; k < 90; k++) { entrada(p, d.cac, { x: 1, y: 0 }); passo(p, DT); }
  const c = p.jogadores[d.cac];
  assert.ok(Math.hypot(c.x - 3, c.z) >= 1.5 - 1e-9, 'nao atravessa o pilar');
});

test('lanterna: pegadas aparecem ao andar e somem em 1 s', () => {
  const p = cena(-5, 0), d = p.dados;
  for (let k = 0; k < 40; k++) { entrada(p, d.fug, { x: 0, y: 1 }); passo(p, DT); }
  assert.ok(d.pegadas.length >= 2, 'deixou rastro');
  assert.ok(d.pegadas.every(pg => pg.t < 1));
  Object.assign(p.jogadores[d.fug], { vx: 0, vz: 0 });
  entrada(p, d.fug, { x: 0, y: 0 });
  roda(p, 1.1);
  assert.equal(d.pegadas.length, 0, 'parado, o rastro some');
});

test('lanterna: celular do Fugitivo vibra com o Cacador perto, e nao vibra longe', () => {
  let p = cena(-3, 0), d = p.dados;
  roda(p, 1);
  assert.ok(p.celular[d.fug].vibra >= 1);
  assert.match(p.celular[d.fug].texto, /FUGITIVO/, 'o texto do papel continua');
  assert.ok(p.celular[d.cac].vibra <= 1, 'o do Cacador e raro');
  p = cena(-8, 0); d = p.dados;
  roda(p, 2);
  assert.equal(p.celular[d.fug].vibra, 0);
});

test('lanterna: roda inteiro, parado e com dedos aleatorios, sem erro', () => {
  const vencedores = fumaca(jogo);
  assert.equal(vencedores.length, 15);
});

test('lanterna: mesmo com a carta dash o Fugitivo nao empurra', () => {
  const p = cena(-5, 0), d = p.dados;
  p.jogadores[d.fug].carta = 'dash';
  entrada(p, d.fug, { x: 0, y: 0, n: 0 });
  entrada(p, d.fug, { x: 0, y: -1, n: 1 }); roda(p, 0.3);
  assert.equal(p.jogadores[d.fug].empurroes, 0);
  assert.equal(d.faiscas.length, 0);
});

test('lanterna: parado, o Fugitivo some de vez; andando, o contorno volta', () => {
  const p = cena(-5, 0), d = p.dados;
  roda(p, 1);
  assert.ok(d.quieto >= 0.5, 'parado ha mais de meio segundo: sem contorno');
  for (let k = 0; k < 5; k++) { entrada(p, d.fug, { x: 0, y: 1 }); passo(p, DT); }
  assert.equal(d.quieto, 0, 'andou: o contorno volta');
  assert.match(jogo.dica, /Parado/);
});
