/* CHAIR À CANON — la troupe : l'homme assemblé en primitives FERRO (boîtes et sphères), sa marche,
   sa visée, sa chute. Chaque unité est un objet d'état ; mailler() rend les instances dynamiques de
   l'image courante. Une balle tue ; la grenade blesse. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const EQUIPE = [0.13, 0.14, 0.16], PEAU = [0.80, 0.60, 0.45];
  const CAMPS = {
    bleu: { torse: [0.20, 0.36, 0.78], casque: [0.12, 0.22, 0.48], jambieres: [0.14, 0.20, 0.38] },
    rouge: { torse: [0.70, 0.20, 0.13], casque: [0.44, 0.11, 0.09], jambieres: [0.34, 0.12, 0.10] }
  };

  let prochain = 1;
  function creer(o) {
    return {
      id: prochain++, camp: o.camp, arme: o.arme || 'mg',
      x: o.x, z: o.z, dir: o.dir === undefined ? 0 : o.dir, dirTir: o.dir === undefined ? 0 : o.dir,
      cible: null, cibleTir: null, tirOuvert: false,
      etat: 'garde', vie: 100, vitesse: o.vitesse || 2.1, phase: Math.random() * 6.28,
      groupe: o.groupe === undefined ? 0 : o.groupe, selectionne: false,
      grenades: o.grenades || 0, roquettes: o.roquettes || 0,
      cooldown: 0, rafale: 0, rafaleD: 0,
      alerte: 0, derniereVue: null, patrouille: null, waypoint: null,
      mortA: -1, tu: false
    };
  }

  // Le corps de l'homme, en instances dynamiques. t : horloge pour le balancement debout.
  function mailler(u, relief, t, sortie, cadavres) {
    const y = relief.hauteur(u.x, u.z) + (u.alt || 0);
    const C = CAMPS[u.camp];
    if (u.etat === 'mort') {
      if (cadavres) {
        const f = Math.min(1, (t - u.mortA) * 2.2);
        const couche = [u.x, y + .18 - .06 * f, u.z];
        const r = [0, u.dir, -1.45 * f];
        sortie.push({ shape: 'box', p: couche, s: [.36, .5, .24], r, mat: 1, color: C.torse.map(v => v * .7) });
        sortie.push({ shape: 'sphere', p: [couche[0] + Math.sin(u.dir) * .34, y + .12, couche[2] + Math.cos(u.dir) * .34], s: [.22, .2, .22], mat: 1, color: PEAU.map(v => v * .5) });
      }
      return;
    }
    const marche = u.cible && Math.hypot(u.cible.x - u.x, u.cible.z - u.z) > .3;
    const pas = marche ? Math.sin(u.phase) : Math.sin(t * 1.7 + u.id) * .12;
    const cy = y + .78, epaule = y + 1.18;
    const dy = u.dir, dyt = u.dirTir;
    const cos = Math.cos(dy), sin = Math.sin(dy);
    // jambes
    sortie.push({ shape: 'box', p: [u.x - cos * .0 - sin * .1, y + .32, u.z + .1 * cos], s: [.14, .62, .14], r: [pas * .9, dy, 0], mat: 1, color: C.jambieres });
    sortie.push({ shape: 'box', p: [u.x + sin * .1, y + .32, u.z - .1 * cos], s: [.14, .62, .14], r: [-pas * .9, dy, 0], mat: 1, color: C.jambieres });
    // torse, sac, tête, casque
    sortie.push({ shape: 'box', p: [u.x, cy, u.z], s: [.36, .5, .24], r: [0, dy, 0], mat: 1, color: C.torse });
    sortie.push({ shape: 'box', p: [u.x - sin * .17, cy, u.z + cos * .17], s: [.24, .34, .12], r: [0, dy, 0], mat: 7, color: EQUIPE });
    sortie.push({ shape: 'sphere', p: [u.x, y + 1.42, u.z], s: [.21, .21, .21], mat: 1, color: PEAU });
    sortie.push({ shape: 'sphere', p: [u.x, y + 1.48, u.z], s: [.26, .19, .26], mat: 1, color: C.casque });
    // bras avant + fusil, orientés vers la visée ; bras arrière
    const pitch = u.pitch || 0;
    sortie.push({ shape: 'box', p: [u.x + Math.sin(dyt) * .26, epaule - .06 - pitch * .1, u.z + Math.cos(dyt) * .26], s: [.1, .34, .1], r: [-.9 - pitch, dyt, 0], mat: 1, color: C.torse });
    sortie.push({ shape: 'box', p: [u.x + Math.sin(dyt) * .42, epaule - .18 - pitch * .16, u.z + Math.cos(dyt) * .42], s: [.06, .74, .06], r: [Math.PI / 2 - .12 - pitch, dyt, 0], mat: 7, color: [0.16, 0.16, 0.18] });
    sortie.push({ shape: 'box', p: [u.x - sin * .2, epaule - .1, u.z + cos * .2], s: [.1, .32, .1], r: [.35 - pas * .5, dy, 0], mat: 1, color: C.torse });
    if (u.arme === 'bazooka') sortie.push({ shape: 'cylinder', p: [u.x + Math.sin(dyt) * .3, epaule - .02, u.z + Math.cos(dyt) * .3], s: [.14, .9, .14], r: [Math.PI / 2 - pitch, dyt, 0], mat: 7, color: [0.2, 0.22, 0.2] });
    if (u.selectionne) {
      sortie.push({ shape: 'ring', p: [u.x, y + .05, u.z], s: [1.15, .02, 1.15], mat: 4, color: [1, .85, .35], alpha: .85, overlay: true, fx: true });
    }
  }

  // Avancer vers la cible avec évitement des obstacles et séparation des camarades.
  function avancer(u, relief, camarades, dt) {
    if (!u.cible || u.etat === 'mort') return false;
    const dx = u.cible.x - u.x, dz = u.cible.z - u.z, d = Math.hypot(dx, dz);
    if (d < .38) { u.cible = null; return false; }
    let vx = dx / d, vz = dz / d;
    for (const o of relief.obstacles) {
      if (!o.bloqueMarche) continue;
      const ox = u.x - o.x, oz = u.z - o.z, dd = Math.hypot(ox, oz), rr = o.r + .42;
      if (dd < rr && dd > 1e-4) { const p = (rr - dd) / rr * 1.9; vx += ox / dd * p; vz += oz / dd * p; }
    }
    for (const c of (camarades || [])) {
      if (c === u || c.etat === 'mort') continue;
      const ox = u.x - c.x, oz = u.z - c.z, dd = Math.hypot(ox, oz);
      if (dd < .85 && dd > 1e-4) { const p = (.85 - dd) / dd * .9; vx += ox * p; vz += oz * p; }
    }
    const l = Math.hypot(vx, vz) || 1; vx /= l; vz /= l;
    const nx = u.x + vx * u.vitesse * dt, nz = u.z + vz * u.vitesse * dt;
    if (!relief.estEau(nx, nz) && relief.dansCarte(nx, nz)) {
      let coince = false;
      for (const o of relief.obstacles) {
        if (!o.bloqueMarche) continue;
        if (Math.hypot(nx - o.x, nz - o.z) < o.r + .3) { coince = true; break; }
      }
      if (!coince) { u.x = nx; u.z = nz; }
      else {
        // glissement le long de la tangente
        const tx = -vz, tz = vx;
        for (const s of [1, -1]) {
          const gx = u.x + (vx * .35 + tx * s * .9) * u.vitesse * dt, gz = u.z + (vz * .35 + tz * s * .9) * u.vitesse * dt;
          let ok = relief.dansCarte(gx, gz) && !relief.estEau(gx, gz);
          if (ok) for (const o of relief.obstacles) if (o.bloqueMarche && Math.hypot(gx - o.x, gz - o.z) < o.r + .3) { ok = false; break; }
          if (ok) { u.x = gx; u.z = gz; break; }
        }
      }
    }
    u.dir = Math.atan2(vx, vz);
    return true;
  }

  function tuer(u, t) {
    u.etat = 'mort'; u.mortA = t; u.cible = null; u.cibleTir = null; u.selectionne = false; u.tu = true;
  }

  B.troupe = { creer, mailler, avancer, tuer, CAMPS, PEAU, EQUIPE };
})(typeof window !== 'undefined' ? window : globalThis);
