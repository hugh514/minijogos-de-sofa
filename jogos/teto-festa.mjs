// Quase no teto da festa (todos contra todos ou times). Cada um tem o seu elevador, lado a lado: segure para subir e solte para
// travar. O teto é invisível, sorteado a cada subida e igual para todos; ele só aparece quando a subida acaba para todos. Quem bate
// despenca e a subida vale zero. São 3 subidas e a altura travada de cada uma soma no placar, em centímetros (o mesmo número
// inteiro que a tela mostra decide o empate). Vence a maior soma; em times, a soma dos dois do time.
import { timeDe, quem, RAIO } from '../logica.mjs';

export const SUBIDAS = 3, TEMPO = 30, ESP = 4;
const TETO_MIN = 3, TETO_MAX = 7, T_AUTO = 3, LIMITE = 8.5, T_MOSTRA = 2;
const V0 = 1.4, ACEL = 0.3, GRAVIDADE = 25, PERTO = 1.5, BASE = 0.3;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const cm = alt => Math.round(alt * 100);
const pontos = e => (e.estado === 'caindo' || e.estado === 'caiu' ? 0 : cm(e.alt));
const emTimes = p => p.modo === 'times';
const dono = (p, i) => (emTimes(p) ? timeDe(p, i) : i);
const lugar = (i, n) => (i - (n - 1) / 2) * ESP;

function fala(p, i, texto, vibra = 0) {
  p.celular[i] = { ...p.celular[i], texto, vibra: (p.celular[i].vibra ?? 0) + vibra };
}

// Soma de cada jogador (subidas fechadas mais a que está valendo agora) e o placar por dono (jogador ou time).
function conta(p) {
  const d = p.dados;
  d.soma = d.e.map((e, i) => d.total[i] + pontos(e));
  d.placar = emTimes(p) ? [0, 0] : d.soma.map(() => 0);
  d.soma.forEach((v, i) => { d.placar[dono(p, i)] += v; });
  if (emTimes(p)) d.inventario = d.soma.map(v => [`Soma ${v}`]);
}

function trava(p, i) {
  const d = p.dados, e = d.e[i];
  e.estado = 'travou'; p.eventos.push('moeda');
  fala(p, i, `Travou em ${cm(e.alt)} cm. Soma: ${d.total[i] + cm(e.alt)} cm`);
}

// Começa uma subida: teto novo, o mesmo para todos, e os elevadores no chão.
function novaSubida(p) {
  const d = p.dados;
  d.subida++; d.t0 = p.t; d.fim = 0;
  d.teto = TETO_MIN + p.rng() * (TETO_MAX - TETO_MIN);
  d.e = p.jogadores.map(() => ({ estado: 'espera', alt: 0, ts: 0, v: 0, auto: false, segurava: true }));   // segurava: o dedo ainda no botão não começa a subida nova
  p.jogadores.forEach((_, i) => fala(p, i, `Subida ${d.subida} de ${SUBIDAS}. Segure para subir, solte para travar`));
}

// Estado final da tela e dos celulares, escrito antes de devolver o resultado.
function fecha(p) {
  const d = p.dados;
  conta(p);
  const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
  const v = lideres.length === 1 ? lideres[0] : -1;
  d.aviso = v < 0 ? 'Empate!' : (emTimes(p) ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff';
  p.jogadores.forEach((_, i) => fala(p, i, v < 0 ? 'Empate!' : dono(p, i) === v ? 'Você venceu!' : emTimes(p) ? 'O outro time venceu' : quem(p, v) + ' venceu'));
  return v;
}

export default {
  id: 'teto-festa', genero: 'equilibrio', nome: 'Quase no teto da festa',
  dica: 'Segure para subir e solte para travar antes do teto invisível, porque quem bate zera a subida.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  semMovimento: true, controle: { modo: 'botao', a: 'Segura' }, rotulo: 'cm', duracao: TEMPO,

  // Câmera baixa e de frente para as colunas: disputa de altura se vê na régua. Afasta com mais colunas.
  camera(p) {
    const n = p.jogadores?.length ?? 2;
    return { x: 0, y: 7, z: 14.5 + n * 1.5, ox: 0, oy: 3.9, oz: 0 };
  },

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'ret', lx: Math.max(7, n * ESP / 2 + 1.5), lz: 4.5, parede: true };
    p.jogadores.forEach((j, i) => { j.x = lugar(i, n); j.z = 0; });
    p.dados = { subida: 0, total: Array(n).fill(0), soma: Array(n).fill(0), placar: [], aviso: '', avisoCor: '#ff4a4a' };
    novaSubida(p);
    conta(p);
  },

  atualiza(p, dt) {
    const d = p.dados, t = p.t - d.t0, n = p.jogadores.length;
    p.jogadores.forEach((j, i) => {
      const e = d.e[i], segura = j.ent.d;
      Object.assign(j, { x: lugar(i, n), z: 0, vx: 0, vz: 0 });
      if (e.estado === 'espera') {
        if (j.apertouA || (segura && !e.segurava)) { e.estado = 'sobe'; p.eventos.push('pulo'); }
        else if (t >= T_AUTO) {                                   // demorou: sobe sozinho, e um toque (ou soltar) trava
          e.estado = 'sobe'; e.auto = true; e.segurava = false; p.eventos.push('pulo');
          fala(p, i, 'Subindo sozinho! Toque para travar', 1);
        }
      } else if (e.estado === 'sobe') {
        const soltou = e.auto ? !segura && (e.segurava || j.apertouA > 0) : !segura;
        if (soltou) trava(p, i);
        else {
          e.ts += dt; e.alt += (V0 + ACEL * e.ts) * dt;
          if (e.alt >= d.teto) {                                  // bateu: despenca e zera esta subida
            e.alt = d.teto; e.estado = 'caindo'; e.v = 0; p.eventos.push('explosao');
            fala(p, i, 'Bateu no teto! Esta subida vale zero', 1);
          }
        }
      } else if (e.estado === 'caindo') {
        e.v += GRAVIDADE * dt; e.alt -= e.v * dt;
        if (e.alt <= 0) { e.alt = 0; e.estado = 'caiu'; p.eventos.push('batida'); }
      }
      e.segurava = segura;
    });

    if (t >= LIMITE || p.t >= TEMPO) d.e.forEach((e, i) => { if (e.estado === 'sobe' || e.estado === 'espera') trava(p, i); });
    conta(p);
    if (p.t >= TEMPO) return fecha(p);                            // trava de segurança: a rodada nunca passa do tempo
    d.aviso = d.e.some(e => e.estado === 'caindo') ? 'Bateu no teto!' : ''; d.avisoCor = '#ff4a4a';

    if (d.e.every(e => e.estado === 'travou' || e.estado === 'caiu')) {      // mostra onde estava o teto e passa para a próxima
      d.fim += dt;
      d.aviso = `O teto estava em ${cm(d.teto)} cm`; d.avisoCor = '#ffd84d';
      if (d.fim < T_MOSTRA) return;
      d.total = [...d.soma];
      if (d.subida < SUBIDAS) { novaSubida(p); conta(p); return; }
      return fecha(p);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, p } = c, n = p.jogadores.length;
    const cor = i => (emTimes(p) ? c.times[timeDe(p, i)] : c.cores[i]);
    pecas.cor = cor; pecas.plat = []; pecas.pistao = []; pecas.visto = p.jogadores.map(() => 'espera');
    p.jogadores.forEach((_, i) => {
      const x = lugar(i, n);
      const plat = malha(new THREE.BoxGeometry(2.6, BASE, 2.6), cor(i), { emissive: cor(i), emissiveIntensity: 0.15 });
      const pistao = malha(new THREE.CylinderGeometry(0.35, 0.35, 1, 16), 0xb8c2d9, { metalness: 0.5, roughness: 0.35 });
      plat.position.set(x, BASE / 2, 0); pistao.position.set(x, 0, 0);
      const regua = malha(new THREE.BoxGeometry(0.22, 8.6, 0.22), 0x59627f); regua.position.set(x, 4.3, -1.9);
      grupo.add(plat, pistao, regua);
      for (let k = 1; k <= 8; k++) {                              // marcas da régua, uma por metro
        const marca = malha(new THREE.BoxGeometry(k % 5 ? 0.7 : 1.1, 0.09, 0.14), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 });
        marca.position.set(x, BASE + k, -1.78); grupo.add(marca);
      }
      pecas.plat.push(plat); pecas.pistao.push(pistao);
    });
    // o teto: laje vermelha que cobre todas as colunas, na altura em que a cabeça do boneco encosta
    pecas.teto = malha(new THREE.BoxGeometry((n - 1) * ESP + 5, 0.3, 3.2), 0xff3b3b, { emissive: 0xff2a2a, emissiveIntensity: 0.8, transparent: true, opacity: 0, depthWrite: false });
    pecas.teto.castShadow = pecas.teto.receiveShadow = false;
    pecas.teto.visible = false;
    grupo.add(pecas.teto);
  },

  desenha(c, dt, t) {
    const { pecas, bonecos, p } = c, d = p.dados, n = p.jogadores.length;
    d.e.forEach((e, i) => {
      const x = lugar(i, n), caido = e.estado === 'caindo' || e.estado === 'caiu';
      const treme = e.estado === 'sobe' ? Math.sin(t * 45 + i) * 0.015 : 0;
      pecas.plat[i].position.y = e.alt + BASE / 2 + treme;
      pecas.plat[i].material.emissiveIntensity = e.estado === 'travou' ? 0.9 : 0.15;
      pecas.pistao[i].scale.y = Math.max(0.01, e.alt); pecas.pistao[i].position.y = e.alt / 2;
      bonecos[i].position.y = RAIO + BASE + e.alt + treme;
      const corpo = bonecos[i].userData?.corpo ?? bonecos[i];     // amassa só o corpo: o nome em cima não estica
      if (caido) corpo.scale.set(1.25, 0.55, 1.25);
      else if (corpo === bonecos[i]) corpo.scale.setScalar(1);

      if (pecas.visto[i] !== e.estado) {                          // faíscas nas viradas de estado
        if (e.estado === 'travou') c.particulas(x, e.alt + BASE, 0, pecas.cor(i), 14, 6);
        if (e.estado === 'caindo') { c.particulas(x, d.teto + BASE + 1.6, 0, 0xffc531, 30, 11); c.particulas(x, d.teto + BASE + 1.6, 0, 0xff4a2a, 16, 8); }
        if (e.estado === 'caiu') c.particulas(x, BASE, 0, 0xdfe6f5, 16, 7);
        pecas.visto[i] = e.estado;
      }
    });
    // O teto so aparece quando a subida acabou para todos: se aparecesse quando o primeiro chega perto ou bate,
    // quem espera subia ate logo abaixo dele e o teto deixava de ser invisivel.
    const opac = d.fim > 0 ? 0.6 : 0;
    pecas.teto.visible = opac > 0.01;
    pecas.teto.material.opacity = opac;
    pecas.teto.position.set(0, d.teto + BASE + 2 * RAIO + 0.15, 0);
  },
};
