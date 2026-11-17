/* CHAIR À CANON — la troupe : l'homme d'EMPRISE (corps procédural à deux os, jambes en IK, démarche
   avancée par la distance parcourue), son uniforme, son casque, son fusil ; sa marche, sa visée, sa chute.
   Sans le moteur (tests Node), l'homme retombe sur ses boîtes. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const EQUIPE = [0.13, 0.14, 0.16], PEAU = [0.80, 0.60, 0.45], SOMBRE = [0.055, 0.07, 0.08];
  const CAMPS = {
    bleu: { torse: [0.20, 0.36, 0.78], casque: [0.12, 0.22, 0.48], jambieres: [0.14, 0.20, 0.38] },
    rouge: { torse: [0.70, 0.20, 0.13], casque: [0.44, 0.11, 0.09], jambieres: [0.34, 0.12, 0.10] }
  };

  let prochain = 1;
  function creer(o) {
    const id = prochain++;
    return {
      id, camp: o.camp, arme: o.arme || 'mg',
      x: o.x, z: o.z, dir: o.dir === undefined ? 0 : o.dir, dirTir: o.dir === undefined ? 0 : o.dir,
      cible: null, cibleTir: null, tirOuvert: false,
      etat: 'garde', vie: 100, vitesse: o.vitesse || 2.1, phase: Math.random() * 6.28,
      allure: { phase: (id * 0.618) % 6.283, amount: 0 },
      groupe: o.groupe === undefined ? 0 : o.groupe, selectionne: false,
      grenades: o.grenades || 0, roquettes: o.roquettes || 0,
      cooldown: 0, rafale: 0, rafaleD: 0,
      alerte: 0, derniereVue: null, patrouille: null, waypoint: null,
      bloque: 0, cote: 0, coteChoisi: 0, detour: null, fuiteX: 0, fuiteZ: 0,
      mortA: -1, tu: false
    };
  }

  // L'homme d'EMPRISE assemblé : os → matrice → primitive. Couche par os et matière, comme la foule.
  function mailler(u, relief, t, sortie, cadavres) {
    const y = relief.hauteur(u.x, u.z) + (u.alt || 0);
    const C = CAMPS[u.camp];
    if (u.etat === 'mort' && !cadavres) return;
    if (!B.corps) { maillerBoites(u, y, t, sortie, C); if (u.selectionne && u.etat !== 'mort') anneau(u, y, sortie); return; }
    const K = B.corps;
    const allure = u.allure || { phase: 0, amount: 0 };
    const visee = u.etat !== 'mort' && (u.tirOuvert || u.cibleTir);
    const couche = u.etat === 'mort';
    const pose = K.motion({ phase: allure.phase, walk: couche ? 0 : allure.amount, aim: !!visee });
    const yaw = visee ? u.dirTir : u.dir, c = Math.cos(yaw), s = Math.sin(yaw);
    const lean = couche ? Math.PI / 2 : 0;
    // le monde du moteur est à main gauche (la caméra regarde (sin Y, −cos Y)) : pour que le nez
    // du corps (−z, comme l'exige FRender) regarde la marche et la main droite soit du bon côté,
    // le lacet du corps est π − cap, et les positions suivent les colonnes de cette rotation.
    const ry = Math.PI - yaw;
    const Mbase = K.mulM(K.euler(0, ry, 0), K.euler(lean, 0, 0));
    const point = p => couche
      ? [u.x - p[0] * c - (.98 - p[1]) * s, y + .25 - p[2], u.z + p[0] * s - (.98 - p[1]) * c]
      : [u.x - p[0] * c - p[2] * s, y + p[1] + (pose.bodyY || 0), u.z + p[0] * s - p[2] * c];
    const add = (shape, p, size, color, rot = [0, 0, 0], mat = 1) => sortie.push({
      shape, p: point(p), s: size, r: K.angles(K.mulM(Mbase, K.euler(...rot))), mat, color
    });
    const teinte = couche ? .55 : 1;
    const couleur = matiere => matiere === 0 ? PEAU.map(v => v * teinte)
      : matiere === 1 ? C.torse.map(v => v * teinte)
        : matiere === 2 ? C.jambieres.map(v => v * teinte)
          : SOMBRE;
    for (const part of K.parts) {
      if (part.code === 1) continue;
      const q = K.transformPoint([part.p[0], part.p[1], -part.p[2]], part.code, pose);
      add(part.shape, [q[0], q[1], -q[2]], part.s, couleur(part.material), [K.boneMatrix(part.code, pose)[4], 0, 0]);
    }
    // la tête et son casque, le sac, le fusil
    add('sphere', [0, 1.68, 0], [.30, .34, .30], PEAU.map(v => v * teinte));
    add('sphere', [0, 1.785, .008], [.25, .17, .25], C.casque.map(v => v * teinte));
    add('box', [0, 1.735, -.155], [.22, .055, .07], C.casque.map(v => v * .8 * teinte));
    add('box', [0, 1.25, .17], [.30, .38, .14], EQUIPE);
    const gp = visee ? [.09, 1.26, -.50] : [.27, .92, -.08];
    add('box', gp, [.10, .13, .38], SOMBRE, visee ? [0, 0, 0] : [.75, 0, 0], 7);
    add('cylinder', [gp[0], gp[1] + .035, gp[2] - .27], [.032, .22, .032], [.14, .16, .17], [Math.PI / 2, 0, 0], 7);
    if (u.arme === 'bazooka' && !couche) add('cylinder', [.16, 1.38, -.18], [.14, .9, .14], [.2, .22, .2], [Math.PI / 2 - .25, 0, 0], 7);
    if (u.selectionne && !couche) anneau(u, y, sortie);
  }

  function anneau(u, y, sortie) {
    sortie.push({ shape: 'ring', p: [u.x, y + .05, u.z], s: [1.15, .02, 1.15], mat: 4, color: [1, .85, .35], alpha: .85, overlay: true, fx: true });
  }

  // Le secours sans moteur : l'homme en boîtes (tests Node).
  function maillerBoites(u, y, t, sortie, C) {
    if (u.etat === 'mort') {
      const f = Math.min(1, (t - u.mortA) * 2.2);
      sortie.push({ shape: 'box', p: [u.x, y + .18 - .06 * f, u.z], s: [.36, .5, .24], r: [0, u.dir, -1.45 * f], mat: 1, color: C.torse.map(v => v * .7) });
      return;
    }
    const marche = u.cible && Math.hypot(u.cible.x - u.x, u.cible.z - u.z) > .3;
    const pas = marche ? Math.sin(u.phase) : Math.sin(t * 1.7 + u.id) * .12;
    const cy = y + .78, epaule = y + 1.18, dy = u.dir, dyt = u.dirTir;
    const cos = Math.cos(dy), sin = Math.sin(dy);
    sortie.push({ shape: 'box', p: [u.x, y + .32, u.z + .1 * cos], s: [.14, .62, .14], r: [pas * .9, dy, 0], mat: 1, color: C.jambieres });
    sortie.push({ shape: 'box', p: [u.x, y + .32, u.z - .1 * cos], s: [.14, .62, .14], r: [-pas * .9, dy, 0], mat: 1, color: C.jambieres });
    sortie.push({ shape: 'box', p: [u.x, cy, u.z], s: [.36, .5, .24], r: [0, dy, 0], mat: 1, color: C.torse });
    sortie.push({ shape: 'sphere', p: [u.x, y + 1.42, u.z], s: [.21, .21, .21], mat: 1, color: PEAU });
    sortie.push({ shape: 'sphere', p: [u.x, y + 1.48, u.z], s: [.26, .19, .26], mat: 1, color: C.casque });
    sortie.push({ shape: 'box', p: [u.x + Math.sin(dyt) * .42, epaule - .18, u.z + Math.cos(dyt) * .42], s: [.06, .74, .06], r: [Math.PI / 2 - .12, dyt, 0], mat: 7, color: [0.16, 0.16, 0.18] });
  }

  // Avancer vers la cible : le routage à candidats de la foule d'Emprise — on note des directions
  // tournées de moins en moins, on rejette celles butées à .6 m et 1.4 m, on garde le cap du côté
  // où l'on s'est engagé. Un homme bloqué choisit un bord et n'en change pas ; bloqué trop
  // longtemps, il renonce ou contourne par un point libre.
  const ANGLES = [0, .58, -.58, 1.16, -1.16, 1.8, -1.8, Math.PI];

  function libre(relief, x, z, r) {
    if (!relief.dansCarte(x, z) || relief.estEau(x, z)) return false;
    for (const o of relief.obstacles) {
      if (!o.bloqueMarche) continue;
      if (Math.hypot(x - o.x, z - o.z) < o.r + r) return false;
    }
    return true;
  }

  function route(u, relief, vx, vz) {
    let best = -Infinity, bx = 0, bz = 0;
    for (let k = 0; k < ANGLES.length; k++) {
      const a = ANGLES[k], c = Math.cos(a), s = Math.sin(a);
      const x = vx * c - vz * s, z = vz * c + vx * s;
      const score = x * vx + z * vz + (x * u.fuiteX + z * u.fuiteZ) * .22;
      if (score <= best) continue;
      if (!libre(relief, u.x + x * .6, u.z + z * .6, .3)) continue;
      if (!libre(relief, u.x + x * 1.4, u.z + z * 1.4, .3)) continue;
      best = score; bx = x; bz = z;
    }
    return [bx, bz];
  }

  function avancer(u, relief, camarades, dt) {
    if (!u.cible || u.etat === 'mort') { B.corps && B.corps.advanceGait(u.allure, 0, 0, dt); return false; }
    const ox = u.x, oz = u.z;
    const dx = u.cible.x - u.x, dz = u.cible.z - u.z, d = Math.hypot(dx, dz);
    if (d < .38) { u.cible = null; u.bloque = 0; u.cote = 0; B.corps && B.corps.advanceGait(u.allure, 0, 0, dt); return false; }
    let vx = dx / d, vz = dz / d;
    // le point de contournement prime tant qu'il reste du chemin vers lui
    if (u.detour && Math.hypot(u.detour.x - u.x, u.detour.z - u.z) > .5) {
      const ddx = u.detour.x - u.x, ddz = u.detour.z - u.z, dd = Math.hypot(ddx, ddz);
      vx = ddx / dd; vz = ddz / dd;
    } else u.detour = null;
    for (const c of (camarades || [])) {
      if (c === u || c.etat === 'mort') continue;
      const ox2 = u.x - c.x, oz2 = u.z - c.z, dd = Math.hypot(ox2, oz2);
      if (dd < .85 && dd > 1e-4) { const p = (.85 - dd) / dd * .9; vx += ox2 * p; vz += oz2 * p; }
    }
    const l = Math.hypot(vx, vz) || 1; vx /= l; vz /= l;
    const dir = route(u, relief, vx, vz);
    const nx = u.x + dir[0] * u.vitesse * dt, nz = u.z + dir[1] * u.vitesse * dt;
    const avance = libre(relief, nx, nz, .26);
    if (avance) { u.x = nx; u.z = nz; }
    // bloqué = on n'a pas avancé, qu'on ait dévié ou non : sinon le compteur s'auto-efface et le détour ne vient jamais
    const moved = Math.hypot(u.x - ox, u.z - oz);
    if (!avance || moved < .004) u.bloque = (u.bloque || 0) + dt;
    else if (dir[0] === vx && dir[1] === vz) u.bloque = Math.max(0, (u.bloque || 0) - dt * 2);
    if (u.bloque > .3 && !u.detour) {
      // on s'engage d'un côté et on y reste : le bord est choisi une fois, pas à chaque image
      if (!u.cote) u.cote = (u.id % 2 ? 1 : -1) * (u.bloque > 1.2 ? (u.coteChoisi || 1) : 1);
      if (!u.coteChoisi) { u.coteChoisi = u.cote; }
      const tx = -vz * u.cote, tz = vx * u.cote;
      u.fuiteX = tx; u.fuiteZ = tz;
      const px = u.x + (vx * .4 + tx) * 2.2, pz = u.z + (vz * .4 + tz) * 2.2;
      if (libre(relief, px, pz, .3)) u.detour = { x: px, z: pz };
    }
    if (u.bloque > 3.2) {
      // but injoignable : on vise le point libre le plus proche, sinon on renonce
      const p = relief.pointLibre(u.cible.x, u.cible.z, .38);
      if (p && Math.hypot(p.x - u.cible.x, p.z - u.cible.z) > 1.2) u.cible = { x: p.x, z: p.z };
      else u.cible = null;
      u.bloque = 0; u.cote = 0; u.coteChoisi = 0; u.detour = null;
    }
    if (moved > .05) {
      u.bloque = Math.max(0, (u.bloque || 0) - dt);
      if (!u.detour) { u.cote = 0; u.coteChoisi = 0; u.fuiteX = u.fuiteZ = 0; }
    }
    if (moved > .001) u.dir = Math.atan2(dir[0], dir[1]);
    B.corps && B.corps.advanceGait(u.allure, moved, moved / Math.max(dt, 1e-4), dt);
    return true;
  }

  function tuer(u, t) {
    u.etat = 'mort'; u.mortA = t; u.cible = null; u.cibleTir = null; u.selectionne = false; u.tu = true;
    u.allure && (u.allure.amount = 0);
  }

  B.troupe = { creer, mailler, avancer, tuer, CAMPS, PEAU, EQUIPE };
})(typeof window !== 'undefined' ? window : globalThis);
