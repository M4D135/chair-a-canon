/* CHAIR À CANON — le décor d'une mission : plage de départ, camp ennemi, bunker, tranchées, tourelles,
   arbres, rochers, clôtures, caisses, mines et drapeau. Tout est géométrie FERRO (boîtes, cylindres,
   octaèdres, feuillages) et le layout sort d'une graine : même graine, même mission. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const BETON = [0.55, 0.54, 0.50], BETON_SOMB = [0.42, 0.41, 0.38], SABLE_SAC = [0.66, 0.58, 0.40],
    BOIS = [0.42, 0.28, 0.15], BOIS_SOMB = [0.30, 0.20, 0.11], METAL = [0.28, 0.29, 0.32],
    TERRE = [0.34, 0.26, 0.17];

  function boite(x, y, z, sx, sy, sz, mat, couleur, r) {
    return { shape: 'box', p: [x, y + sy / 2, z], s: [sx, sy, sz], r: r || [0, 0, 0], mat, color: couleur };
  }
  function cyl(x, y, z, r, h, mat, couleur) {
    return { shape: 'cylinder', p: [x, y + h / 2, z], s: [r * 2, h, r * 2], mat, color: couleur };
  }

  function generer(relief, graine, mission) {
    const r = B.relief.rng((graine >>> 0) * 7 + mission * 131 + 17);
    const t = relief.taille;
    const D = {
      statiques: [], drapeaux: [], caisses: [], mines: [], tourelles: [], tours: [],
      spawn: { x: t / 2, z: t - 9 }, camp: { x: 0, z: 0 }
    };
    const push = D.statiques.push.bind(D.statiques);
    const obst = (x, z, rayon, hauteur, marche, tir) => relief.ajouterObstacle({ x, z, r: rayon, h: hauteur, bloqueMarche: marche !== false, bloqueTir: !!tir });

    // — La plage de départ, au sud, à plat.
    let alt = Math.max(.5, relief.hauteur(D.spawn.x, D.spawn.z));
    relief.aplatir(D.spawn.x, D.spawn.z, 7.5, alt);

    // — Le camp ennemi : un plateau au nord, décalé, entouré de tranchées.
    const campX = t / 2 + (r() - .5) * t * .34, campZ = t * (.24 + r() * .1);
    let altC = Math.max(1.4, relief.hauteur(campX, campZ));
    relief.aplatir(campX, campZ, 15, altC);
    D.camp = { x: campX, z: campZ, alt: altC };
    relief.zones.push({ x: campX, z: campZ, r: 13, couleur: TERRE });

    // — Le bunker : U de béton ouvert au sud, le drapeau dedans.
    const mur = (x0, z0, x1, z1, ep, haut, mat, col) => {
      const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), n = Math.max(1, Math.round(l));
      for (let k = 0; k < n; k++) {
        const f = (k + .5) / n, x = x0 + dx * f, z = z0 + dz * f;
        push(boite(x, altC, z, ep, haut, l / n + .06, mat, col, [0, Math.atan2(dx, dz), 0]));
        obst(x, z, Math.max(ep, l / n) * .62, haut + altC, true, true);
      }
    };
    const bw = 6.5, porte = 2.2;
    mur(campX - bw, campZ - bw, campX + bw, campZ - bw, .7, 1.9, 3, BETON);            // fond nord
    mur(campX - bw, campZ - bw, campX - bw, campZ + bw, .7, 1.9, 3, BETON);            // aile ouest
    mur(campX + bw, campZ - bw, campX + bw, campZ + bw, .7, 1.9, 3, BETON);            // aile est
    mur(campX - bw, campZ + bw, campX - porte / 2, campZ + bw, .7, 1.9, 3, BETON);     // sud gauche
    mur(campX + porte / 2, campZ + bw, campX + bw, campZ + bw, .7, 1.9, 3, BETON);     // sud droite
    // toit partiel et créneaux
    push(boite(campX, altC + 1.9, campZ - bw + 1.2, bw * 2 - 1, .35, 2.6, 3, BETON_SOMB));
    for (let k = -2; k <= 2; k++) if (Math.abs(k) > 0) push(boite(campX + k * 1.3, altC + 2.25, campZ - bw + .2, .8, .55, .5, 3, BETON));

    // — Le drapeau, au centre du bunker : la hampe est au décor, la toile est dynamique (coque).
    D.drapeaux.push({ x: campX, z: campZ, pris: false });
    push(cyl(campX, altC, campZ, .07, 3.4, 7, [0.75, 0.72, 0.65]));
    // le drapeau ami, sur la plage
    push(cyl(D.spawn.x - 4.5, alt, D.spawn.z - 3, .06, 2.8, 7, [0.75, 0.72, 0.65]));
    push(boite(D.spawn.x - 3.95, alt + 2.0, D.spawn.z - 3, .9, .56, .06, 2, [0.18, 0.34, 0.72]));

    // — Les tranchées : trois boyaux rayonnant depuis le camp, terre retournée et sacs de sable.
    const tranchee = (x0, z0, ang, long) => {
      const pasT = 1.15, largeur = 1.5;
      for (let d = 2; d < long; d += pasT) {
        const x = x0 + Math.cos(ang) * d, z = z0 + Math.sin(ang) * d;
        if (relief.estEau(x, z)) break;
        relief.creuser(x, z, largeur, Math.min(1.15, Math.max(.55, relief.hauteur(x, z) - .1)));
        relief.zones.push({ x, z, r: 2.1, couleur: TERRE });
        // parois de sacs des deux côtés
        for (const cote of [-1, 1]) {
          const px = x + Math.cos(ang + Math.PI / 2) * cote * (largeur + .25), pz = z + Math.sin(ang + Math.PI / 2) * cote * (largeur + .25);
          push(boite(px, relief.hauteur(px, pz) - .15, pz, .8, .62, 1.25, 1, SABLE_SAC, [0, ang, 0]));
          obst(px, pz, .62, relief.hauteur(px, pz) + .5, true, true);
        }
      }
    };
    tranchee(campX, campZ + bw + .8, Math.PI / 2 + (r() - .5) * .5, 12 + r() * 8);
    tranchee(campX - bw - .8, campZ, Math.PI + (r() - .5) * .4, 10 + r() * 7);
    tranchee(campX + bw + .8, campZ, (r() - .5) * .4, 10 + r() * 7);

    // — Les tourelles (dès la mission 2) : socle, tourelle, canon.
    if (mission >= 2) {
      const nbT = Math.min(4, 1 + Math.floor(mission / 2));
      for (let k = 0; k < nbT; k++) {
        const ang = r() * Math.PI * 2, d = 9 + r() * 4;
        const x = campX + Math.cos(ang) * d, z = campZ + Math.sin(ang) * d;
        if (relief.estEau(x, z)) continue;
        const y = relief.hauteur(x, z);
        push(cyl(x, y - .1, z, 1.05, .55, 9, BETON_SOMB));
        push({ shape: 'octa', p: [x, y + .78, z], s: [1.25, .8, 1.25], mat: 7, color: [0.24, 0.26, 0.24] });
        D.tourelles.push({ x, z, y, angle: r() * Math.PI * 2, cooldown: 0, vivante: true, cible: null });
        obst(x, z, 1.05, y + 1.2, true, true);
      }
    }

    // — La tour de guet (mission 3+).
    if (mission >= 3) {
      const ang = r() * Math.PI * 2, x = campX + Math.cos(ang) * 11.5, z = campZ + Math.sin(ang) * 11.5;
      if (!relief.estEau(x, z)) {
        const y = relief.hauteur(x, z);
        for (const [dx, dz] of [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]]) push(boite(x + dx, y, z + dz, .22, 5.6, .22, 10, BOIS));
        push(boite(x, y + 5.6, z, 2.6, .28, 2.6, 10, BOIS_SOMB));
        for (let k = 0; k < 4; k++) push(boite(x + Math.cos(k * Math.PI / 2) * 1.2, y + 5.88, z + Math.sin(k * Math.PI / 2) * 1.2, k % 2 ? .16 : 2.5, .7, k % 2 ? 2.5 : .16, 10, BOIS));
        D.tours.push({ x, z, y: y + 6.15 });
        obst(x, z, 1.15, y + 6.5, true, true);
      }
    }

    // — Les arbres et les rochers, hors du camp et de la plage.
    const loinDesCamps = (x, z) => Math.hypot(x - campX, z - campZ) > 17 && Math.hypot(x - D.spawn.x, z - D.spawn.z) > 8;
    let tries = 0;
    while (tries++ < 420) {
      const x = 4 + r() * (t - 8), z = 4 + r() * (t - 8);
      if (relief.estEau(x, z) || !loinDesCamps(x, z)) continue;
      const p = relief.pente(x, z);
      if (Math.hypot(p[0], p[1]) > .85) continue;
      if (r() < .62) {
        const h = 2.2 + r() * 1.9, cour = .9 + r() * .8;
        push(cyl(x, relief.hauteur(x, z) - .1, z, .16, h, 10, BOIS));
        push({ shape: 'foliage', p: [x, relief.hauteur(x, z) + h + cour * .45, z], s: [cour * 2.1, cour * 1.9, cour * 2.1], mat: 11, color: [0.13 + r() * .07, 0.30 + r() * .12, 0.10] });
        obst(x, z, .34, relief.hauteur(x, z) + h, true, true);
      } else {
        const s = .7 + r() * 1.3;
        push({ shape: 'octa', p: [x, relief.hauteur(x, z) + s * .22, z], s: [s, s * .78, s * .9], r: [0, r() * 3.14, 0], mat: 9, color: [0.42, 0.40, 0.36] });
        obst(x, z, s * .52, relief.hauteur(x, z) + s * .6, true, true);
      }
    }

    // — Les clôtures de la plage : piquets et lattes (on tire à travers le bois).
    for (let k = 0; k < 14; k++) {
      const x = D.spawn.x - 7 + k, z = D.spawn.z - 5.5 + Math.round(Math.sin(k * .8) * 1.5);
      if (relief.estEau(x, z)) continue;
      const y = relief.hauteur(x, z);
      push(boite(x, y, z, .12, 1.15, .12, 10, BOIS_SOMB));
      if (k < 13) push(boite(x + .5, y + .82, z, 1.05, .1, .07, 10, BOIS));
      if (k < 13) push(boite(x + .5, y + .45, z, 1.05, .1, .07, 10, BOIS));
      obst(x, z, .3, y + 1.1, true, false);
    }

    // — Les caisses : santé (vertes) et munitions (orangées), près des tranchées et du camp.
    const caisse = (x, z, type) => {
      if (relief.estEau(x, z)) return;
      const y = relief.hauteur(x, z);
      obst(x, z, .42, y + .6, true, true);
      D.caisses.push({ x, z, pris: false, type });
    };
    const nbCaisses = 3 + Math.min(3, Math.floor(mission / 2));
    for (let k = 0; k < nbCaisses; k++) {
      const ang = r() * Math.PI * 2, d = 8 + r() * 12;
      caisse(campX + Math.cos(ang) * d, campZ + Math.sin(ang) * d, k % 2 ? 'vie' : 'munitions');
    }

    // — Le champ de mines (mission 3+) entre la plage et le camp.
    if (mission >= 3) {
      const nbM = 5 + mission;
      for (let k = 0; k < nbM; k++) {
        const x = campX + (r() - .5) * 30, z = campZ + 12 + r() * (D.spawn.z - campZ - 16);
        if (relief.estEau(x, z)) continue;
        D.mines.push({ x, z, sautee: false });
      }
    }

    // — Le poste de mitrailleuse du camp : sacs + sac à sable devant la porte.
    push(boite(campX - 3.2, altC, campZ + bw - 1.4, 1.6, .6, .9, 1, SABLE_SAC, [0, .4, 0]));
    push(boite(campX + 3.2, altC, campZ + bw - 1.4, 1.6, .6, .9, 1, SABLE_SAC, [0, -.4, 0]));
    obst(campX - 3.2, campZ + bw - 1.4, .8, altC + .6, true, true);
    obst(campX + 3.2, campZ + bw - 1.4, .8, altC + .6, true, true);

    return D;
  }

  B.decor = { generer, boite, cyl, BETON, SABLE_SAC, TERRE };
})(typeof window !== 'undefined' ? window : globalThis);
