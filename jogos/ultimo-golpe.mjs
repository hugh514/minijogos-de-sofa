// Ultimo golpe: os dois batem no chefao com o empurrao (A), mas so quem der o golpe final leva o ponto.
import { posiciona, RAIO } from '../logica.mjs';

const R_ARENA = 9, R_CHEFE = 2.2, VIDA = 16, LIMITE = 40;
const JANELA = 0.7, RECUO = 8;                    // tempo em que o empurrao vale como golpe; forca que joga o jogador para tras
const T_CARGA = 0.9, ALCANCE = 5.2, T_TONTO = 1, FORCA_ONDA = 12, T_ONDA = 0.4, ALTURA_DESVIO = 0.7;

export default {
  id: 'ultimo-golpe', genero: 'reflexo', nome: 'Último golpe', dica: 'Corra até o chefão e aperte Golpe. Quem der o último golpe vence. Fuja quando ele girar!',
  controle: { modo: 'padrao', a: 'GOLPE', b: 'PULA' }, rotulo: 'golpes', duracao: LIMITE,

  inicia(p) {
    p.arena = { tipo: 'circulo', raio: R_ARENA, parede: true };
    posiciona(p, 6);
    p.dados = {
      vida: VIDA, placar: [0, 0], janela: [0, 0], empAntes: [0, 0], tonto: [0, 0],
      prox: 4 + p.rng() * 2, carga: 0, onda: 0, ondas: 0,
      golpe: { n: 0, x: 1, z: 0, quem: 0 }, aviso: '', avisoCor: '#ffd84d', tAviso: 2.5,
    };
  },

  atualiza(p, dt) {
    const d = p.dados;

    // a varrida: o chefao gira (aviso) e solta uma onda que derruba quem esta perto e no chao
    d.onda = Math.max(0, d.onda - dt);
    if (d.carga > 0) {
      d.carga -= dt;
      if (d.carga <= 0) {
        d.carga = 0; d.onda = T_ONDA; d.ondas++; d.prox = (d.vida <= 6 ? 2 : 3.5) + p.rng() * 3;
        p.eventos.push('explosao');
        p.jogadores.forEach((j, i) => {
          const dist = Math.hypot(j.x, j.z);
          if (!j.vivo || dist > ALCANCE || j.y > ALTURA_DESVIO) return;
          const nx = dist ? j.x / dist : 1, nz = dist ? j.z / dist : 0;
          j.vx = nx * FORCA_ONDA; j.vz = nz * FORCA_ONDA; d.tonto[i] = T_TONTO; d.janela[i] = 0;
          p.celular[i] = { ...p.celular[i], vibra: (p.celular[i].vibra ?? 0) + 1 };
        });
      }
    } else {
      d.prox -= dt;
      if (d.prox <= 0) { d.carga = T_CARGA; p.eventos.push('troca'); }
    }

    const golpes = [];
    p.jogadores.forEach((j, i) => {
      if (!j.vivo) return;
      if (j.empurroes > d.empAntes[i] && d.tonto[i] <= 0) d.janela[i] = JANELA;     // acabou de dar o empurrao
      else d.janela[i] = Math.max(0, d.janela[i] - dt);
      if (d.tonto[i] > 0) {                       // atordoado: nao anda nem empurra
        d.tonto[i] -= dt; j.turbo = 0; j.cd = Math.max(j.cd, d.tonto[i]);
        if (d.tonto[i] <= 0) { d.tonto[i] = 0; j.turbo = 1; }
      }
      const dist = Math.hypot(j.x, j.z);
      if (dist < R_CHEFE + RAIO) {
        const nx = dist ? j.x / dist : 1, nz = dist ? j.z / dist : 0, vr = j.vx * nx + j.vz * nz;
        j.x = nx * (R_CHEFE + RAIO); j.z = nz * (R_CHEFE + RAIO);
        if (d.janela[i] > 0 && vr < -3) golpes.push({ i, j, nx, nz });
        else if (vr < 0) { j.vx -= 1.5 * vr * nx; j.vz -= 1.5 * vr * nz; }
      }
      d.empAntes[i] = j.empurroes;
    });

    if (golpes.length === 2 && p.rng() < 0.5) golpes.reverse();      // os dois no mesmo quadro: sorteia quem bateu primeiro
    for (const { i, j, nx, nz } of golpes) {
      d.vida--; d.placar[i]++; d.janela[i] = 0;
      j.vx = nx * RECUO; j.vz = nz * RECUO;
      d.golpe = { n: d.golpe.n + 1, x: nx, z: nz, quem: i };
      p.eventos.push('batida');
      if (d.vida <= 0) { d.aviso = ''; p.eventos.push('explosao'); return i; }
    }

    if (d.vida === 1 && d.tAviso > 0) { d.tAviso -= dt; d.aviso = d.tAviso > 0 ? 'Falta 1 golpe!' : ''; }
    if (p.t > LIMITE) return d.golpe.n > 0 ? d.golpe.quem : -1;      // fim do tempo: leva quem deu o ultimo golpe (ninguem bateu, empate)
  },

  monta(c) {
    const { THREE, malha, grupo, pecas } = c;
    Object.assign(pecas, { visto: 0, ondas: 0, flash: 0, giro: 0 });

    const chefe = pecas.chefe = new THREE.Group();
    pecas.corpo = malha(new THREE.SphereGeometry(R_CHEFE, 40, 28), 0x7b3fe4, { emissive: 0xff2a2a, emissiveIntensity: 0, roughness: 0.4 });
    chefe.add(pecas.corpo);
    for (let k = 0; k < 6; k++) {                 // espinhos na cintura: deixam o giro bem visivel
      const eixo = new THREE.Group(), espinho = malha(new THREE.ConeGeometry(0.4, 1.1, 12), 0xff7a2f, { emissive: 0x7a2a00 });
      espinho.rotation.z = -Math.PI / 2; espinho.position.x = R_CHEFE + 0.35;
      eixo.rotation.y = k * Math.PI / 3 + Math.PI / 6; eixo.add(espinho); chefe.add(eixo);
    }
    for (const lado of [-1, 1]) {
      const olho = malha(new THREE.SphereGeometry(0.45, 16, 12), 0xffffff); olho.position.set(lado * 0.8, 0.75, 1.85);
      const pupila = malha(new THREE.SphereGeometry(0.22, 12, 8), 0x111111); pupila.position.set(lado * 0.8, 0.8, 2.22);
      const sobrancelha = malha(new THREE.BoxGeometry(1, 0.2, 0.25), 0x1a1026); sobrancelha.position.set(lado * 0.8, 1.35, 1.75); sobrancelha.rotation.z = -lado * 0.45;
      chefe.add(olho, pupila, sobrancelha);
    }
    chefe.position.y = R_CHEFE; grupo.add(chefe);

    pecas.vida = [];                              // barra de vida: anel de luzes acima do chefao, apaga a cada golpe
    for (let k = 0; k < VIDA; k++) {
      const ang = -Math.PI / 2 + (k + 0.5) / VIDA * Math.PI * 2;
      const m = malha(new THREE.SphereGeometry(0.3, 12, 8), 0x35c26b, { emissive: 0x35c26b, emissiveIntensity: 0.9 });
      m.position.set(Math.cos(ang) * 2, R_CHEFE * 2 + 0.9, Math.sin(ang) * 2); m.castShadow = false;
      grupo.add(m); pecas.vida.push(m);
    }

    const limite = new THREE.Mesh(new THREE.TorusGeometry(ALCANCE, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
    limite.rotation.x = Math.PI / 2; limite.position.y = 0.04;       // ate onde a onda alcanca
    pecas.perigo = malha(new THREE.CylinderGeometry(ALCANCE, ALCANCE, 0.03, 56), 0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 0.6, transparent: true, opacity: 0 });
    pecas.perigo.position.y = 0.03; pecas.perigo.castShadow = false; pecas.perigo.visible = false;
    pecas.onda = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 56), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    pecas.onda.rotation.x = Math.PI / 2; pecas.onda.position.y = 0.5; pecas.onda.visible = false;
    grupo.add(limite, pecas.perigo, pecas.onda);

    pecas.tonto = [0, 1].map(() => {              // argola girando em cima de quem esta atordoado
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
      m.visible = false; grupo.add(m); return m;
    });
  },

  desenha(c, dt, t) {
    const p = c.p, d = p.dados, { pecas } = c;

    if (d.golpe.n !== pecas.visto) {              // golpe: faiscas na cor de quem bateu e o chefao balanca
      pecas.visto = d.golpe.n; pecas.flash = 1;
      c.particulas(d.golpe.x * R_CHEFE, 1.3, d.golpe.z * R_CHEFE, c.cores[d.golpe.quem], 14, 9);
      c.particulas(d.golpe.x * R_CHEFE, 1.3, d.golpe.z * R_CHEFE, 0xffe14a, 8, 7);
      if (d.vida <= 0) c.particulas(0, R_CHEFE, 0, 0x7b3fe4, 40, 14);
    }
    if (d.ondas !== pecas.ondas) {
      pecas.ondas = d.ondas;
      for (let k = 0; k < 8; k++) c.particulas(Math.cos(k * Math.PI / 4) * 3.5, 0.4, Math.sin(k * Math.PI / 4) * 3.5, 0xffe08a, 3, 6);
    }
    pecas.flash = Math.max(0, pecas.flash - dt * 3.5);

    const carga = d.carga > 0 ? 1 - d.carga / T_CARGA : 0, f = pecas.flash, chefe = pecas.chefe;
    if (d.carga > 0) pecas.giro += dt * (5 + 22 * carga);
    else { pecas.giro %= Math.PI * 2; pecas.giro *= Math.pow(0.01, dt); }       // depois da onda volta a olhar para a frente
    chefe.visible = d.vida > 0;
    chefe.rotation.y = pecas.giro;
    chefe.position.set(-d.golpe.x * 0.55 * f, R_CHEFE + Math.sin(t * 2.5) * 0.08, -d.golpe.z * 0.55 * f);
    chefe.scale.setScalar(1 + carga * 0.1 - f * 0.07);
    pecas.corpo.material.emissive.set(f > 0.5 ? 0xffffff : 0xff2a2a);
    pecas.corpo.material.emissiveIntensity = Math.max(f * 0.8, carga * (0.6 + Math.sin(t * 40) * 0.3));

    const fracao = d.vida / VIDA, cor = fracao > 0.5 ? 0x35c26b : fracao > 0.25 ? 0xffc531 : 0xff3b3b;
    pecas.vida.forEach((m, k) => {
      m.visible = k < d.vida;
      m.material.color.set(cor); m.material.emissive.set(cor);
      m.scale.setScalar(d.vida === 1 ? 1.5 + Math.sin(t * 14) * 0.5 : 1);         // a ultima luz pulsa
    });

    pecas.perigo.visible = d.carga > 0;
    pecas.perigo.material.opacity = carga * 0.45;
    pecas.onda.visible = d.onda > 0;
    if (d.onda > 0) { const r = R_CHEFE + (ALCANCE - R_CHEFE) * (1 - d.onda / T_ONDA); pecas.onda.scale.set(r, r, 4); }

    pecas.tonto.forEach((m, i) => {
      const j = p.jogadores[i];
      m.visible = d.tonto[i] > 0 && j.vivo;
      m.position.set(j.x, RAIO * 2 + 0.5 + j.y, j.z); m.rotation.set(Math.PI / 2 + Math.sin(t * 9) * 0.4, 0, t * 9);
    });
  },
};
