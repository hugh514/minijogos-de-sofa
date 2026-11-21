// Pula onda da festa (todos contra todos ou times). O núcleo no centro da arena solta anéis que crescem até a borda, cada vez
// mais juntos e mais rápidos. O anel azul vem pelo chão: pule (B). O anel vermelho vem no alto: fique no chão, ele pega quem
// estiver no ar. O núcleo avisa qual vem (esquenta azul embaixo, ou sobe e fica vermelho). Cada golpe tira 1 de 3 vidas e
// quem zera voa para fora. Vence o último (ou o time) com vida, ou quem tiver mais vidas no fim do tempo.
// Em times as vidas dos dois se somam e o time só perde quando os dois zeram.
// Sem lua e sem a carta Mola: o pulo longo (2 s na lua) não desce a tempo do anel alto, e a regra deixaria de valer.
import { posicionaRoda, timeDe, quem, elimina, RAIO } from '../logica.mjs';

export const TEMPO = 45, VIDAS = 3, DIST = 4.5;
const R_NUCLEO = 1, MEIA_FAIXA = 0.25, T_IMUNE = 1, T_RECADO = 1.2, PRIMEIRO = 2.5;
const Y_BAIXA = 0.35, Y_ALTA = 0.5;                    // acima de Y_BAIXA o anel do chão passa por baixo; acima de Y_ALTA o anel alto pega
const COR_BAIXA = 0x35e0ff, COR_ALTA = 0xff3b30, ALTURA_ALTA = 2.1;
const NOMES_TIMES = ['Time laranja', 'Time roxo'];

const intervalo = t => Math.max(0.75, 2.4 - t * 0.045);         // os anéis vêm cada vez mais juntos
const velocidade = t => Math.min(10, 5 + t * 0.12);             // e cada vez mais rápidos
const chanceAlta = t => Math.min(0.4, 0.18 + t * 0.006);

const emTimes = p => p.modo === 'times';
const dono = (p, i) => (emTimes(p) ? timeDe(p, i) : i);

function soma(p) {
  const d = p.dados, t = emTimes(p) ? [0, 0] : d.vidas.map(() => 0);
  d.vidas.forEach((v, i) => { t[dono(p, i)] += v; });
  return t;
}

function celulares(p, fim) {
  const d = p.dados;
  p.jogadores.forEach((_, i) => {
    const vidas = `Vidas: ${d.vidas[i]}` + (emTimes(p) ? ` (time: ${d.placar[dono(p, i)]})` : '');
    const t = fim ? fim[i] : d.vidas[i] <= 0 ? 'Sem vidas. Torça!' : (d.tRecado[i] > 0 ? d.recado[i] + ' ' : '') + vidas;
    if (p.celular[i].texto !== t) p.celular[i] = { ...p.celular[i], texto: t };
  });
}

// Estado final da tela e dos celulares, escrito antes de devolver o resultado.
function fecha(p, v) {
  const d = p.dados;
  d.aviso = v < 0 ? 'Empate!' : (emTimes(p) ? NOMES_TIMES[v] : quem(p, v)) + ' venceu!'; d.avisoCor = '#ffffff';
  celulares(p, p.jogadores.map((_, i) => (v < 0 ? 'Empate!' : dono(p, i) === v ? 'Você venceu!' : emTimes(p) ? 'O outro time venceu' : quem(p, v) + ' venceu')));
  return v;
}

export default {
  id: 'onda-festa', genero: 'ritmo', nome: 'Pula onda da festa',
  dica: 'Pule o anel azul que vem pelo chão e fique no chão quando o anel vermelho passar no alto.',
  festa: { min: 2, max: 4, modos: ['vs', 'times'] },
  controle: { modo: 'padrao', a: 'Empurra', b: 'Pula' }, rotulo: 'vidas', duracao: TEMPO,
  semMod: ['lua'], semCarta: ['pulo'],

  inicia(p) {
    const n = p.jogadores.length;
    p.arena = { tipo: 'circulo', raio: 8, parede: true };
    posicionaRoda(p, DIST);
    p.dados = {
      ondas: [], soltos: 0, prox: PRIMEIRO, proxAlta: false, carga: 0, vidas: Array(n).fill(VIDAS), placar: [],
      imune: Array(n).fill(0), recado: Array(n).fill(''), tRecado: Array(n).fill(0), golpes: [], aviso: '', avisoCor: '#ffffff',
    };
    p.dados.placar = soma(p);
    if (emTimes(p)) p.dados.inventario = p.dados.vidas.map(v => ['Vidas ' + v]);
    celulares(p);
  },

  atualiza(p, dt) {
    const d = p.dados;

    p.jogadores.forEach((j, i) => {                               // o núcleo é sólido: ninguém fica em cima dele
      d.imune[i] = Math.max(0, d.imune[i] - dt);
      d.tRecado[i] = Math.max(0, d.tRecado[i] - dt);
      const dist = Math.hypot(j.x, j.z), min = R_NUCLEO + RAIO;
      if (!j.vivo || dist >= min) return;
      const a = -Math.PI / 2 + i * 2 * Math.PI / p.jogadores.length;
      if (dist < 1e-6) { j.x = Math.cos(a) * min; j.z = Math.sin(a) * min; } else { j.x *= min / dist; j.z *= min / dist; }
    });

    d.prox -= dt;
    if (d.prox <= 0) {                                            // solta o anel que o núcleo estava avisando e sorteia o próximo
      d.ondas.push({ r: R_NUCLEO, v: velocidade(p.t), alta: d.proxAlta });
      d.soltos++;
      p.eventos.push(d.proxAlta ? 'troca' : 'dash');
      d.prox = intervalo(p.t);
      d.proxAlta = d.soltos >= 2 && p.rng() < chanceAlta(p.t);    // os dois primeiros são do chão, para ensinar o pulo
    }
    d.carga = Math.max(0, Math.min(1, 1 - d.prox / Math.min(1, intervalo(p.t))));      // o núcleo incha no último segundo

    for (const o of d.ondas) {
      const antes = o.r;
      o.r += o.v * dt;
      p.jogadores.forEach((j, i) => {
        if (!j.vivo || d.imune[i] > 0) return;
        const dist = Math.hypot(j.x, j.z);
        if (dist < antes - MEIA_FAIXA || dist > o.r + MEIA_FAIXA) return;
        if (o.alta ? j.y <= Y_ALTA : j.y > Y_BAIXA) return;       // passou por baixo do alto, ou por cima do baixo
        const nx = dist > 1e-6 ? j.x / dist : 1, nz = dist > 1e-6 ? j.z / dist : 0;
        d.vidas[i]--; d.golpes.push({ x: j.x, y: j.y, z: j.z, i, alta: o.alta });
        j.vx += nx * (o.alta ? 5 : 10); j.vz += nz * (o.alta ? 5 : 10);       // o anel joga o boneco para trás
        d.recado[i] = o.alta ? 'Bateu no anel alto!' : 'A onda pegou!'; d.tRecado[i] = T_RECADO;
        p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
        if (d.vidas[i] <= 0) { elimina(p, j, 12); p.eventos.push('explosao'); }
        else { d.imune[i] = T_IMUNE; j.vy = o.alta ? -6 : 5; p.eventos.push('batida'); }      // o alto derruba, o baixo dá um tranco
      });
    }
    d.ondas = d.ondas.filter(o => o.r < p.arena.raio + 0.3);

    d.placar = soma(p);
    if (emTimes(p)) d.inventario = d.vidas.map(v => ['Vidas ' + v]);
    celulares(p);

    const restam = d.placar.flatMap((v, k) => (v > 0 ? [k] : []));
    if (restam.length <= 1) return fecha(p, restam.length ? restam[0] : -1);
    if (p.t >= TEMPO) {
      const maior = Math.max(...d.placar), lideres = d.placar.flatMap((v, k) => (v === maior ? [k] : []));
      return fecha(p, lideres.length === 1 ? lideres[0] : -1);
    }
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    const base = malha(new THREE.CylinderGeometry(R_NUCLEO * 0.8, R_NUCLEO, 0.5, 28), 0x59627f); base.position.y = 0.25;
    const haste = malha(new THREE.CylinderGeometry(0.14, 0.14, 1, 10), 0x8d95ad, { metalness: 0.4, roughness: 0.4 });
    pecas.haste = haste;
    pecas.nucleo = malha(new THREE.SphereGeometry(0.75, 24, 16), 0xffd84d, { emissive: 0xffa000, emissiveIntensity: 0.4 });
    grupo.add(base, haste, pecas.nucleo);
    pecas.golpes = 0; pecas.sobe = 0;
  },

  desenha(c, dt, t) {
    const { THREE, malha, pool, pecas, bonecos, p } = c, d = p.dados;
    const corDe = i => (emTimes(p) ? c.times[timeDe(p, i)] : c.cores[i]);

    // núcleo: incha e esquenta antes de soltar; para o anel alto ele sobe na haste e fica vermelho
    const k = d.carga, n = pecas.nucleo, corProx = d.proxAlta ? COR_ALTA : COR_BAIXA;
    pecas.sobe += ((d.proxAlta ? 1 : 0) - pecas.sobe) * Math.min(1, dt * 7);
    const y = 1.1 + pecas.sobe * (ALTURA_ALTA - 0.9);
    n.position.y = y;
    n.scale.setScalar(0.8 + k * 0.6 + (k > 0.6 ? Math.sin(t * 50) * 0.04 : 0));
    n.material.color.set(k > 0.25 || d.proxAlta ? corProx : 0xffd84d);
    n.material.emissive.set(k > 0.25 || d.proxAlta ? corProx : 0xffa000);
    n.material.emissiveIntensity = 0.3 + k * (d.proxAlta ? 0.3 : 0.7);
    pecas.haste.scale.y = y; pecas.haste.position.y = y / 2;

    // anel: uma faixa em pé, opaca, com um rastro da mesma cor no chão. O do chão encosta no piso; o alto voa na altura da
    // cabeça e o rastro dele é só uma sombra escura, para se ver por onde ele passa
    const faixas = pool('faixas', d.ondas.length, () => new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.6, 72, 1, true),
      new THREE.MeshBasicMaterial({ color: COR_BAIXA, side: THREE.DoubleSide })));
    const rastros = pool('rastros', d.ondas.length, () => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 72), new THREE.MeshBasicMaterial({ color: COR_BAIXA, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.04; return m;
    });
    d.ondas.forEach((o, i) => {
      faixas[i].position.y = o.alta ? ALTURA_ALTA + 0.3 : 0.3; faixas[i].scale.set(o.r, 1, o.r); faixas[i].material.color.set(o.alta ? COR_ALTA : COR_BAIXA);
      rastros[i].scale.set(o.r, o.r, 1); rastros[i].material.color.set(o.alta ? 0x1a0606 : 0xb8f4ff);
    });

    // vidas: bolinhas girando em volta de cada boneco; quem acabou de apanhar pisca
    const vidas = pool('vidas', p.jogadores.length * VIDAS, () => malha(new THREE.SphereGeometry(0.2, 12, 8), 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
    p.jogadores.forEach((j, i) => {
      if (j.vivo) bonecos[i].visible = !(d.imune[i] > 0 && Math.sin(t * 40) < 0);
      for (let v = 0; v < VIDAS; v++) {
        const m = vidas[i * VIDAS + v], ang = t * 3 + v * 2 * Math.PI / VIDAS + i;
        m.visible = j.vivo && v < d.vidas[i];
        m.position.set(j.x + Math.cos(ang) * 1.2, RAIO + j.y, j.z + Math.sin(ang) * 1.2);
        m.material.color.set(corDe(i)); m.material.emissive.set(corDe(i));
      }
    });

    for (; pecas.golpes < d.golpes.length; pecas.golpes++) {
      const g = d.golpes[pecas.golpes];
      c.particulas(g.x, 0.6 + g.y, g.z, g.alta ? COR_ALTA : COR_BAIXA, 14, 8);
      c.particulas(g.x, 0.6 + g.y, g.z, corDe(g.i), 10, 6);
    }
  },
};
