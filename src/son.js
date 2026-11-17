/* CHAIR À CANON — le son : tout sort de FAudio, le synthétiseur du moteur FERRO. Aucune prise de son,
   aucun fichier. Le panoramique suit la position du bruit par rapport à la caméra. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  function creer() {
    let audio = null, demarre = false;
    return {
      demarrer() {
        if (audio || typeof G.FAudio === 'undefined' || typeof window === 'undefined') return;
        audio = G.FAudio.create({});
        if (audio.start) audio.start();
        demarre = true;
      },
      enJeu(v) { if (audio && audio.setPlaying) audio.setPlaying(!!v); },
      pan(x, cam) {
        if (!cam) return 0;
        return Math.max(-1, Math.min(1, (x - cam.x) / 22));
      },
      coupFeuJoueur(x, cam) { if (audio) audio.shot({ pan: this.pan(x, cam), level: .9 }); },
      tirEnnemi(x, cam) { if (audio) audio.enemyShot({ pan: this.pan(x, cam), level: .8 }); },
      explosion(x, cam) { if (audio) audio.explosion({ pan: this.pan(x, cam), level: 1 }); },
      grenade(x, cam) { if (audio) audio.grenadeLaunch({ pan: this.pan(x, cam) }); },
      roquette(x, cam) { if (audio) audio.rocket({ pan: this.pan(x, cam) }); },
      mort(x, cam) { if (audio) audio.kill({ pan: this.pan(x, cam) }); },
      blesse() { if (audio) audio.hurt(); },
      impact(x, cam) { if (audio) audio.hit({ pan: this.pan(x, cam) }); },
      ramassage() { if (audio) audio.pickup(); },
      munitions() { if (audio) audio.ammoPickup(); },
      alerte(x, cam) { if (audio) audio.alerted({ pan: this.pan(x, cam) }); },
      ui() { if (audio) audio.switchWeapon(); },
      victoire() { if (!audio) return; audio.pickup(); setTimeout(() => audio.alerted({}), 160); setTimeout(() => audio.pickup(), 320); },
      defaite() { if (!audio) return; audio.enemyShot({ level: .5 }); setTimeout(() => audio.hurt(), 140); }
    };
  }

  B.son = { creer };
})(typeof window !== 'undefined' ? window : globalThis);
