// Cor mentirosa: a tela mostra o NOME de uma cor escrito com tinta de OUTRA cor. O comando alterna a cada
// desafio entre tocar a cor da TINTA e tocar a PALAVRA. Quem acerta primeiro pontua; quem erra congela 2 s.
import { posiciona, maiorPlacar } from '../logica.mjs';

const CORES = ['Vermelho', 'Azul', 'Verde', 'Amarelo'];
const HEX = [0xe5383b, 0x2f7df6, 0x35c26b, 0xffd23f];
const CSS = ['#ff4a4a', '#4a9bff', '#3ddc7a', '#ffd84d'];
const META = 5, LIMITE = 45, SUBITA = 12, GELO = 2, PRAZO = 6, PRAZO_MIN = 3.5, LADO = 7.5, ZJOG = 1;
const XBLOCO = [-4.5, -1.5, 1.5, 4.5], ZBLOCO = 4.6;
const COMANDO = ['Toque a PALAVRA', 'Toque a cor da TINTA'], COMANDO_TV = ['TOQUE A PALAVRA', 'TOQUE A TINTA'];

// O prazo encurta a cada ponto do lider: quem esta na frente joga sob mais pressa.
export const prazoDe = placar => Math.max(PRAZO_MIN, PRAZO - 0.5 * Math.max(...placar));

function novoDesafio(p) {
  const d = p.dados;
  d.modoTinta = !d.modoTinta;
  d.palavra = Math.floor(p.rng() * 4) % 4;
  d.tinta = (d.palavra + 1 + Math.floor(p.rng() * 3) % 3) % 4;      // sempre diferente da palavra
  d.prazo = prazoDe(d.placar); d.comando = COMANDO_TV[+d.modoTinta];
  d.aviso = CORES[d.palavra].toUpperCase(); d.avisoCor = CSS[d.tinta];
}

function telas(p) {
  const d = p.dados;
  for (const i of [0, 1])
    p.celular[i] = d.gelo[i] > 0
      ? { modo: 'espera', texto: 'Congelado e menos 1 ponto: você tocou a cor errada', vibra: d.vibra[i] }
      : { modo: 'opcoes', texto: d.pausa > 0 ? 'Prepare-se...' : COMANDO[+d.modoTinta], opcoes: CORES, coresOp: CSS, linha: true, vibra: d.vibra[i] };
}

export default {
  id: 'cor-mentirosa', genero: 'reflexo', nome: 'Cor mentirosa',
  dica: 'Toque a cor da TINTA ou a PALAVRA escrita, como o comando pedir. Errou, congela e perde 1 ponto!',
  semMovimento: true, controle: { modo: 'espera' }, rotulo: 'acertos', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 10, lz: 6, parede: true };
    posiciona(p, LADO, 0);
    for (const j of p.jogadores) j.z = ZJOG;
    p.dados = {
      placar: [0, 0], gelo: [0, 0], vibra: [0, 0], fx: [], aviso: '', avisoCor: '#fff',
      modoTinta: p.rng() < 0.5, palavra: 0, tinta: 1, prazo: PRAZO, pausa: 0.6, comando: '',
    };
    telas(p);
  },

  atualiza(p, dt) {
    const d = p.dados;
    for (const i of [0, 1]) d.gelo[i] = Math.max(0, d.gelo[i] - dt);
    const empate = d.placar[0] === d.placar[1], subita = p.t > LIMITE && empate;
    if (d.pausa > 0) {
      if (subita) { d.aviso = 'Desempate: o próximo ponto vence!'; d.avisoCor = '#ffffff'; }
      d.pausa -= dt;
      if (d.pausa <= 0) novoDesafio(p);
    } else {
      const certa = d.modoTinta ? d.tinta : d.palavra, acertou = [];
      p.jogadores.forEach((j, i) => {
        const e = j.escolha;
        if (e < 0 || e > 3 || d.gelo[i] > 0) return;
        if (e === certa) return acertou.push(i);
        d.gelo[i] = GELO; d.vibra[i]++; d.placar[i] = Math.max(0, d.placar[i] - 1);
        if (j.y === 0) j.vy = 7;                         // susto
        d.fx.push({ ok: false, quem: i });
        p.eventos.push('batida');
      });
      for (const i of acertou) { d.placar[i]++; d.fx.push({ ok: true, quem: i, cor: certa }); }   // no mesmo quadro, os dois pontuam
      if (acertou.length) p.eventos.push('moeda');
      d.prazo -= dt;
      if (acertou.length || d.prazo <= 0) { d.pausa = acertou.length ? 0.9 : 0.5; d.aviso = ''; }
    }
    telas(p);
    const fim = p.t > LIMITE && (d.placar[0] !== d.placar[1] || p.t > LIMITE + SUBITA);   // empate no tempo: morte subita
    if (Math.max(...d.placar) >= META || fim) return maiorPlacar(p);
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const branco = { emissive: 0xffffff, emissiveIntensity: 0.35 };
    // os 4 blocos, da esquerda para a direita, na ordem dos botoes
    pecas.blocos = HEX.map((cor, i) => {
      const m = malha(new THREE.BoxGeometry(2.4, 0.8, 1.6), cor, { emissive: cor, emissiveIntensity: 0.2 });
      m.position.set(XBLOCO[i], 0.4, ZBLOCO); grupo.add(m); return m;
    });
    pecas.brilho = [0, 0, 0, 0]; pecas.visto = 0;

    // comando TINTA: letra T deitada no chao e uma gota de tinta, as duas na cor da tinta
    pecas.tinta = new THREE.Group();
    pecas.pintados = [];
    const pintado = (geo, x, y, z) => {
      const m = malha(geo, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
      m.position.set(x, y, z); pecas.tinta.add(m); pecas.pintados.push(m); return m;
    };
    pintado(new THREE.BoxGeometry(2.2, 0.3, 0.5), -2.4, 0.15, -1.15);
    pintado(new THREE.BoxGeometry(0.5, 0.3, 2.8), -2.4, 0.15, 0);
    pecas.gota = new THREE.Group();
    pecas.gota.position.set(1.6, 0, 0);
    pecas.tinta.add(pecas.gota);
    const bola = malha(new THREE.SphereGeometry(1, 20, 14), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
    bola.position.y = 1.2;
    const bico = malha(new THREE.ConeGeometry(0.87, 1.7, 20), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 });
    bico.position.y = 2.5;
    pecas.gota.add(bola, bico); pecas.pintados.push(bola, bico);

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

    // bloco de gelo de cada jogador
    pecas.gelos = [0, 1].map(() => {
      const m = malha(new THREE.BoxGeometry(2.1, 2.3, 2.1), 0x9be7ff, { transparent: true, opacity: 0.55, emissive: 0x2a6f8f });
      m.visible = false; grupo.add(m); return m;
    });
  },

  desenha(c, dt, t) {
    const d = c.p.dados, pc = c.pecas, js = c.p.jogadores;
    for (; pc.visto < d.fx.length; pc.visto++) {
      const f = d.fx[pc.visto], j = js[f.quem];
      if (f.ok) {
        pc.brilho[f.cor] = 1;
        c.som(880, 0.2, 'triangle', 0.2);
        c.particulas(j.x, 1.5, j.z, c.cores[f.quem], 26, 8);
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
    pc.gelos.forEach((m, i) => {
      m.visible = d.gelo[i] > 0;
      m.position.set(js[i].x, 1.15 + js[i].y, js[i].z);
      m.rotation.y = Math.sin(t * 30) * 0.03 * (d.gelo[i] < 0.5 ? 3 : 1);     // treme antes de quebrar
    });
  },
};
