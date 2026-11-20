// Cor mentirosa (Festa: todos contra todos ou times). A tela mostra o NOME de uma cor escrito com tinta de OUTRA cor, e o comando
// alterna a cada desafio entre tocar a cor da TINTA e tocar a PALAVRA. Todos respondem ao mesmo tempo, cada um no seu celular:
// quem acerta primeiro leva o ponto e o desafio fecha; quem erra perde 1 ponto e congela 2 s. Vence quem (ou o time que) chegar
// a 5; aos 45 s vence quem estiver na frente sozinho, e lideres iguais empatam. Em times os pontos dos dois se somam.
import { posicionaCantos, timeDe, quem } from '../logica.mjs';

export const META = 5, LIMITE = 45;
const CORES = ['Vermelho', 'Azul', 'Verde', 'Amarelo'];
const HEX = [0xe5383b, 0x2f7df6, 0x35c26b, 0xffd23f];
const CSS = ['#ff4a4a', '#4a9bff', '#3ddc7a', '#ffd84d'];
const GELO = 2, PRAZO = 6, PRAZO_MIN = 3.5;
const XBLOCO = [-4.5, -1.5, 1.5, 4.5], ZBLOCO = 4.6;
const COMANDO = ['Toque a PALAVRA', 'Toque a TINTA'], COMANDO_TV = ['TOQUE A PALAVRA', 'TOQUE A TINTA'];
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const dono = p => i => (p.modo === 'times' ? timeDe(p, i) : i);       // de quem e o ponto: do jogador ou do time
const lider = placar => { const m = Math.max(...placar), l = placar.flatMap((v, k) => (v === m ? [k] : [])); return l.length === 1 ? l[0] : -1; };

function novoDesafio(p) {
  const d = p.dados;
  d.modoTinta = !d.modoTinta;
  d.palavra = Math.floor(p.rng() * 4) % 4;
  d.tinta = (d.palavra + 1 + Math.floor(p.rng() * 3) % 3) % 4;      // sempre diferente da palavra
  d.prazo = Math.max(PRAZO_MIN, PRAZO - 0.5 * Math.max(...d.placar));   // o prazo encurta conforme o lider avanca
  d.comando = COMANDO_TV[+d.modoTinta];
  d.aviso = CORES[d.palavra].toUpperCase(); d.avisoCor = CSS[d.tinta];
}

function telas(p, fim) {
  const d = p.dados, de = dono(p);
  p.jogadores.forEach((_, i) => {
    const pontos = `Pontos: ${d.placar[de(i)]}`;
    p.celular[i] = fim ? { modo: 'espera', texto: fim[i], vibra: d.vibra[i] }
      : d.gelo[i] > 0 ? { modo: 'espera', texto: `Errou: congelado e menos 1 ponto. ${pontos}`, vibra: d.vibra[i] }
      : { modo: 'opcoes', texto: `${d.pausa > 0 ? 'Prepare-se..' : COMANDO[+d.modoTinta]}. ${pontos}`, opcoes: CORES, coresOp: CSS, linha: true, vibra: d.vibra[i] };
  });
}

// Texto final de cada celular e aviso na tela, escritos antes de devolver o resultado (a rodada pode ficar guardada ate os 5 s).
function fechaComo(p, v) {
  const d = p.dados, de = dono(p), times = p.modo === 'times';
  d.aviso = v < 0 ? 'Empate!' : (times ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff'; d.pausa = 1;
  telas(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : de(i) === v ? 'Você venceu!' : times ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

export default {
  id: 'cor-mentirosa-festa', genero: 'reflexo', nome: 'Cor mentirosa em grupo',
  dica: 'Toque a cor da TINTA ou a PALAVRA, como a tela pedir. O mais rápido pontua, quem erra perde 1 ponto.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  semMovimento: true, controle: { modo: 'espera' }, rotulo: 'acertos', duracao: LIMITE,

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: 10, lz: 6, parede: true };
    posicionaCantos(p, 7.6, 2.3);
    for (const j of p.jogadores) j.z += 0.3;
    p.dados = {
      placar: Array(p.modo === 'times' ? 2 : n).fill(0), gelo: Array(n).fill(0), vibra: Array(n).fill(0), fx: [], aviso: '', avisoCor: '#ffffff',
      modoTinta: p.rng() < 0.5, palavra: 0, tinta: 1, prazo: PRAZO, pausa: 1.2, comando: '',
    };
    telas(p);
  },

  atualiza(p, dt) {
    const d = p.dados, de = dono(p);
    d.gelo = d.gelo.map(g => Math.max(0, g - dt));
    if (d.pausa > 0) {
      d.pausa -= dt;
      if (d.pausa <= 0) novoDesafio(p);
    } else {
      const certa = d.modoTinta ? d.tinta : d.palavra, acertou = [];
      p.jogadores.forEach((j, i) => {
        const e = j.escolha;
        if (e < 0 || e > 3 || d.gelo[i] > 0) return;
        if (e === certa) return acertou.push(i);
        d.gelo[i] = GELO; d.vibra[i]++; d.placar[de(i)] = Math.max(0, d.placar[de(i)] - 1);
        if (j.y === 0) j.vy = 7;                         // susto
        d.fx.push({ ok: false, quem: i });
        p.eventos.push('batida');
      });
      for (const k of new Set(acertou.map(de))) d.placar[k]++;      // no mesmo quadro, todos os que acertaram pontuam (o time, uma vez)
      for (const i of acertou) { d.fx.push({ ok: true, quem: i, cor: certa }); if (p.jogadores[i].y === 0) p.jogadores[i].vy = 6; }
      if (acertou.length) p.eventos.push('moeda');
      d.prazo -= dt;
      if (acertou.length || d.prazo <= 0) { d.pausa = acertou.length ? 0.9 : 0.5; d.aviso = ''; }
    }
    telas(p);
    if (Math.max(...d.placar) >= META || p.t >= LIMITE) return fechaComo(p, lider(d.placar));
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c;
    const branco = { emissive: 0xffffff, emissiveIntensity: 0.35 };
    const corDe = i => (p.modo === 'times' ? c.times[timeDe(p, i)] : c.cores[i]);
    // os 4 blocos, da esquerda para a direita, na ordem dos botoes do celular
    pecas.blocos = HEX.map((cor, i) => {
      const m = malha(new THREE.BoxGeometry(2.4, 0.8, 1.6), cor, { emissive: cor, emissiveIntensity: 0.2 });
      m.position.set(XBLOCO[i], 0.4, ZBLOCO); grupo.add(m); return m;
    });
    pecas.brilho = [0, 0, 0, 0]; pecas.visto = 0;

    // comando TINTA: letra T deitada no chao e uma gota de tinta, as duas na cor da tinta
    pecas.tinta = new THREE.Group();
    pecas.pintados = [];
    const pintado = (geo, x, y, z, pai = pecas.tinta) => {
      const m = malha(geo, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
      m.position.set(x, y, z); pai.add(m); pecas.pintados.push(m); return m;
    };
    pintado(new THREE.BoxGeometry(2.2, 0.3, 0.5), -2.4, 0.15, -1.15);
    pintado(new THREE.BoxGeometry(0.5, 0.3, 2.8), -2.4, 0.15, 0);
    pecas.gota = new THREE.Group();
    pecas.gota.position.set(1.6, 0, 0);
    pecas.tinta.add(pecas.gota);
    pintado(new THREE.SphereGeometry(1, 20, 14), 0, 1.2, 0, pecas.gota);
    pintado(new THREE.ConeGeometry(0.87, 1.7, 20), 0, 2.5, 0, pecas.gota);

    // comando PALAVRA: letra P deitada no chao e uma folha de papel com linhas de texto, tudo branco
    pecas.palavra = new THREE.Group();
    const p1 = (geo, x, z) => { const m = malha(geo, 0xffffff, branco); m.position.set(x - 2.4, 0.15, z); pecas.palavra.add(m); };
    p1(new THREE.BoxGeometry(0.5, 0.3, 2.8), -0.7, 0);
    p1(new THREE.BoxGeometry(1.6, 0.3, 0.5), 0.1, -1.15);
    p1(new THREE.BoxGeometry(1.6, 0.3, 0.5), 0.1, 0);
    p1(new THREE.BoxGeometry(0.5, 0.3, 1.65), 0.7, -0.575);
    pecas.folha = new THREE.Group();
    pecas.folha.position.set(1.6, 1.3, 0); pecas.folha.rotation.x = 0.55;       // inclinada para a camera
    pecas.folha.add(malha(new THREE.BoxGeometry(2.8, 0.12, 3.4), 0xffffff, branco));
    [-1.1, -0.45, 0.2, 0.85].forEach((z, k) => {
      const linha = malha(new THREE.BoxGeometry(k === 3 ? 1.3 : 2.2, 0.06, 0.24), 0x22223a);
      linha.position.set(k === 3 ? -0.45 : 0, 0.08, z); pecas.folha.add(linha);
    });
    pecas.palavra.add(pecas.folha);
    pecas.tinta.position.z = pecas.palavra.position.z = 0.6;
    grupo.add(pecas.tinta, pecas.palavra);

    // faixa com o comando por escrito (a regra nao pode viver so no celular); so no navegador, o node de teste nao tem canvas
    if (typeof document !== 'undefined') {
      const tela = document.createElement('canvas'); tela.width = 1024; tela.height = 256;
      const tex = new THREE.CanvasTexture(tela); tex.colorSpace = THREE.SRGBColorSpace;
      const faixa = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false, toneMapped: false }));
      faixa.scale.set(13, 13 * 256 / 1024, 1); faixa.position.set(0, 0.9, -3.7); faixa.visible = false; faixa.renderOrder = 5;
      grupo.add(faixa); pecas.faixa = { tela, tex, faixa, texto: '' };
    }

    // de cada jogador: um tapete na cor dele (do time, em times), a pilha de fichas dos pontos ao lado e o bloco de gelo do erro
    pecas.fichas = []; pecas.gelos = [];
    p.jogadores.forEach((j, i) => {
      const cor = corDe(i), fora = Math.sign(j.x) || 1;
      const tapete = malha(new THREE.CylinderGeometry(1.35, 1.35, 0.08, 28), cor); tapete.position.set(j.x, 0.04, j.z); grupo.add(tapete);
      const prato = malha(new THREE.CylinderGeometry(0.7, 0.8, 0.12, 20), 0x23233a); prato.position.set(j.x + fora * 1.55, 0.06, j.z + 1.1); grupo.add(prato);
      pecas.fichas[i] = Array.from({ length: META }, (_, k) => {
        const m = malha(new THREE.CylinderGeometry(0.58, 0.58, 0.3, 20), cor, { emissive: cor, emissiveIntensity: 0.35 });
        m.position.set(j.x + fora * 1.55, 0.27 + k * 0.34, j.z + 1.1); m.visible = false; grupo.add(m); return m;
      });
      const gelo = malha(new THREE.BoxGeometry(2.1, 2.3, 2.1), 0x9be7ff, { transparent: true, opacity: 0.55, emissive: 0x2a6f8f });
      gelo.visible = false; grupo.add(gelo); pecas.gelos[i] = gelo;
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, pc = c.pecas, js = p.jogadores, times = p.modo === 'times';
    const corDe = i => (times ? c.times[timeDe(p, i)] : c.cores[i]);
    for (; pc.visto < d.fx.length; pc.visto++) {
      const f = d.fx[pc.visto], j = js[f.quem];
      if (f.ok) {
        pc.brilho[f.cor] = 1;
        c.som(880, 0.2, 'triangle', 0.2);
        c.particulas(j.x, 1.5, j.z, corDe(f.quem), 26, 8);
        c.particulas(XBLOCO[f.cor], 1, ZBLOCO, HEX[f.cor], 12, 5);
      } else {
        c.som(140, 0.35, 'sawtooth', 0.2);
        c.particulas(j.x, 1.5, j.z, 0x9be7ff, 22, 6);
      }
    }
    pc.blocos.forEach((m, i) => {
      pc.brilho[i] = Math.max(0, pc.brilho[i] - dt * 2);
      m.material.emissiveIntensity = 0.2 + pc.brilho[i] * 1.5;
      m.position.y = 0.4 + pc.brilho[i] * 0.6;
    });
    const ativo = !(d.pausa > 0);
    if (pc.faixa) {
      const f = pc.faixa, txt = ativo ? d.comando : '';
      if (f.texto !== txt) {
        f.texto = txt; f.faixa.visible = !!txt;
        const x = f.tela.getContext('2d'), tinta = txt.endsWith('TINTA');
        x.clearRect(0, 0, 1024, 256);
        x.fillStyle = '#0a0d1ee6'; x.beginPath(); x.rect(8, 40, 1008, 176); x.fill();
        x.font = '900 100px "Segoe UI Black", "Arial Black", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
        const larg = x.measureText(txt).width;
        if (larg > 940) x.font = x.font.replace('100px', Math.floor(100 * 940 / larg) + 'px');       // cabe na faixa mesmo sem a fonte pesada
        x.fillStyle = tinta ? '#ffd84d' : '#ffffff'; x.fillText(txt, 512, 132);
        f.tex.needsUpdate = true;
      }
    }
    pc.tinta.visible = ativo && d.modoTinta;
    pc.palavra.visible = ativo && !d.modoTinta;
    for (const m of pc.pintados) { m.material.color.set(HEX[d.tinta]); m.material.emissive.set(HEX[d.tinta]); }
    pc.gota.scale.setScalar(1 + Math.sin(t * 7) * 0.08);
    pc.folha.position.y = 1.3 + Math.sin(t * 4) * 0.12;
    js.forEach((j, i) => {
      const pontos = d.placar[times ? timeDe(p, i) : i];
      pc.fichas[i].forEach((m, k) => { m.visible = k < pontos; });
      const g = pc.gelos[i];
      g.visible = d.gelo[i] > 0;
      g.position.set(j.x, 1.15 + j.y, j.z);
      g.rotation.y = Math.sin(t * 30) * 0.03 * (d.gelo[i] < 0.5 ? 3 : 1);     // treme antes de quebrar
    });
  },
};
