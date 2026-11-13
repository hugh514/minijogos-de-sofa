// Cabo de guerra traicoeiro: martele o botao para puxar, mas na luz vermelha quem apertar escorrega.
import { posiciona } from '../logica.mjs';

const META = 6, PUXAO = 0.32, ESCORREGA = 1.1, LIMITE = 45;

export default {
  id: 'cabo', nome: 'Cabo de guerra', dica: 'Aperte rápido para puxar. Na luz VERMELHA, pare: quem apertar escorrega!',
  semMovimento: true, controle: { modo: 'botao', a: 'PUXA!' },

  inicia(p) {
    p.arena = { tipo: 'ret', lx: 11, lz: 4, parede: true };
    posiciona(p, 5);
    p.dados = { corda: 0, vermelho: false, troca: 3 + p.rng() * 2 };   // corda < 0: jogador 1 esta ganhando
  },

  atualiza(p, dt) {
    const d = p.dados;
    d.troca -= dt;
    if (d.troca <= 0) {
      d.vermelho = !d.vermelho;
      d.troca = d.vermelho ? 0.8 + p.rng() * 1.2 : 1.5 + p.rng() * 3;
      p.eventos.push('troca');
      for (const i of [0, 1]) p.celular[i] = { vibra: (p.celular[i].vibra ?? 0) + (d.vermelho ? 1 : 0) };
    }
    d.aviso = d.vermelho ? 'PARE!' : ''; d.avisoCor = '#ff4a4a';
    p.jogadores.forEach((j, i) => {
      const lado = i ? 1 : -1;                    // cada um puxa para o seu lado
      if (j.apertouA) d.corda += lado * j.apertouA * (d.vermelho ? -ESCORREGA : PUXAO);
      if (j.apertouA && d.vermelho) p.eventos.push('queda');
      j.x = d.corda + lado * 5; j.z = 0; j.vx = j.vz = 0;
    });
    if (Math.abs(d.corda) >= META) return d.corda < 0 ? 0 : 1;
    if (p.t > LIMITE) return d.corda === 0 ? -1 : d.corda < 0 ? 0 : 1;
  },

  monta(c) {
    const { THREE, malha, grupo, pecas, cores } = c;
    pecas.corda = malha(new THREE.CylinderGeometry(0.12, 0.12, 10, 10), 0xd9b98a);
    pecas.corda.rotation.z = Math.PI / 2; pecas.corda.position.y = 0.8;
    pecas.no = malha(new THREE.SphereGeometry(0.35, 14, 10), 0xe5383b); pecas.no.position.y = 0.8;
    pecas.luz = malha(new THREE.SphereGeometry(0.9, 20, 14), 0x35c26b, { emissive: 0x35c26b, emissiveIntensity: 1 });
    pecas.luz.position.set(0, 3.2, -4);
    grupo.add(pecas.corda, pecas.no, pecas.luz);
    for (const lado of [-1, 1]) {                 // linha de chegada de cada lado, na cor de quem vence ali
      const linha = malha(new THREE.BoxGeometry(0.3, 0.04, 8), cores[lado < 0 ? 0 : 1]);
      linha.position.set(lado * META, 0.02, 0); grupo.add(linha);
    }
  },

  desenha(c) {
    const d = c.p.dados, cor = d.vermelho ? 0xff2a2a : 0x35c26b;
    c.pecas.corda.position.x = c.pecas.no.position.x = d.corda;
    c.pecas.luz.material.color.set(cor); c.pecas.luz.material.emissive.set(cor);
  },
};
