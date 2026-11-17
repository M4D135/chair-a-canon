/* CHAIR À CANON — les étincelles : particules d'explosion, fumée, gerbes, sang, traces de balles, éclats
   et cratères persistants. Tout passe par les maillages dynamiques du moteur (drapeaux fx feu/fumée/
   étincelle, alpha, émissif) : aucune image. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const MAX = 900;

  function creer() {
    return { particules: [], crateres: [], flashs: [] };
  }

  function ajouter(sys, p) {
    if (sys.particules.length >= MAX) sys.particules.shift();
    sys.particules.push(p);
  }

  function explosion(sys, x, y, z, rayon, rng) {
    const r = rng || Math.random;
    sys.flashs.push({ x, y: y + .3, z, t: 0, duree: .12, r: rayon * .9 });
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, v = (1.5 + r() * 5) * rayon * .35;
      ajouter(sys, { type: 'feu', x, y: y + .2 + r() * .4, z, vx: Math.cos(a) * v, vy: 2 + r() * 5, vz: Math.sin(a) * v, t: 0, vie: .28 + r() * .3, s: .5 + r() * .8 * rayon * .3 });
    }
    for (let k = 0; k < 16; k++) {
      const a = r() * Math.PI * 2, v = (.6 + r() * 2.2) * rayon * .3;
      ajouter(sys, { type: 'fumee', x, y: y + .5, z, vx: Math.cos(a) * v, vy: 2.5 + r() * 3.5, vz: Math.sin(a) * v, t: 0, vie: 1.1 + r() * 1.3, s: .8 + r() * 1.1 * rayon * .32 });
    }
    for (let k = 0; k < 14; k++) {
      const a = r() * Math.PI * 2, v = 4 + r() * 9;
      ajouter(sys, { type: 'etincelle', x, y: y + .3, z, vx: Math.cos(a) * v, vy: 3 + r() * 8, vz: Math.sin(a) * v, t: 0, vie: .4 + r() * .5, s: .07 });
    }
    for (let k = 0; k < 8; k++) {
      const a = r() * Math.PI * 2, v = 2 + r() * 5;
      ajouter(sys, { type: 'eclat', x, y: y + .2, z, vx: Math.cos(a) * v, vy: 2 + r() * 4, vz: Math.sin(a) * v, t: 0, vie: .9 + r() * .7, s: .1 + r() * .12, r: r() * 3, rv: (r() - .5) * 9, grav: 12 });
    }
    sys.crateres.push({ x, z, r: Math.max(.7, rayon * .42), t: 0 });
    if (sys.crateres.length > 90) sys.crateres.shift();
  }

  function sang(sys, x, y, z, rng) {
    const r = rng || Math.random;
    for (let k = 0; k < 9; k++) {
      const a = r() * Math.PI * 2, v = 1 + r() * 3;
      ajouter(sys, { type: 'sang', x, y: y + .9, z, vx: Math.cos(a) * v, vy: 1.5 + r() * 2.5, vz: Math.sin(a) * v, t: 0, vie: .35 + r() * .3, s: .09 + r() * .07, grav: 11 });
    }
  }

  function impact(sys, x, y, z, rng) {
    const r = rng || Math.random;
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2, v = .8 + r() * 2;
      ajouter(sys, { type: 'poussiere', x, y: y + .05, z, vx: Math.cos(a) * v, vy: 1 + r() * 1.6, vz: Math.sin(a) * v, t: 0, vie: .3 + r() * .25, s: .16 + r() * .14 });
    }
  }

  function tir(sys, x0, y0, z0, x1, y1, z1) {
    sys.flashs.push({ x: x0, y: y0, z: z0, t: 0, duree: .05, r: .34 });
    ajouter(sys, { type: 'trace', x: x0, y: y0, z: z0, x2: x1, y2: y1, z2: z1, t: 0, vie: .055, s: .045 });
  }

  function maj(sys, dt, rng) {
    const r = rng || Math.random;
    for (let i = sys.particules.length - 1; i >= 0; i--) {
      const p = sys.particules[i];
      p.t += dt;
      if (p.t >= p.vie) { sys.particules.splice(i, 1); continue; }
      if (p.type !== 'trace') {
        p.x += p.vx * dt; p.z += p.vz * dt;
        p.y += p.vy * dt;
        if (p.grav) p.vy -= p.grav * dt;
        else if (p.type === 'fumee') { p.vy += .6 * dt; p.vx *= .985; p.vz *= .985; p.s += dt * 1.4; }
        else if (p.type === 'feu') p.vy += 1.8 * dt;
        else if (p.type === 'sang' || p.type === 'poussiere') p.vy -= 6 * dt;
        if (p.rv !== undefined) p.r += p.rv * dt;
      }
    }
    for (let i = sys.flashs.length - 1; i >= 0; i--) {
      const f = sys.flashs[i]; f.t += dt;
      if (f.t >= f.duree) sys.flashs.splice(i, 1);
    }
  }

  // Les maillages de l'image : particules fx + flashs émissifs + cratères sombres.
  function mailler(sys, relief, sortie) {
    for (const c of sys.crateres) {
      const y = relief.hauteur(c.x, c.z) + .02;
      sortie.push({ shape: 'cylinder', p: [c.x, y, c.z], s: [c.r * 2, .04, c.r * 2], mat: 7, color: [0.10, 0.08, 0.06] });
    }
    for (const p of sys.particules) {
      const f = 1 - p.t / p.vie;
      if (p.type === 'trace') {
        const mx = (p.x + p.x2) / 2, my = (p.y + p.y2) / 2, mz = (p.z + p.z2) / 2;
        const dx = p.x2 - p.x, dy = p.y2 - p.y, dz = p.z2 - p.z, l = Math.hypot(dx, dy, dz);
        sortie.push({ shape: 'box', p: [mx, my, mz], s: [p.s, p.s, Math.max(.2, l)], r: [-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0], mat: 5, color: [1, .9, .6], alpha: .8 * f, overlay: true, fx: true });
      } else if (p.type === 'feu') {
        sortie.push({ shape: 'sphere', p: [p.x, p.y, p.z], s: [p.s * f, p.s * f, p.s * f], mat: 14, fxFire: true, color: [1, .55 + f * .3, .18], alpha: Math.min(1, f * 1.6), overlay: true, fx: true, emissive: 1 });
      } else if (p.type === 'fumee') {
        sortie.push({ shape: 'sphere', p: [p.x, p.y, p.z], s: [p.s, p.s, p.s], mat: 15, fxSmoke: true, color: [.35, .33, .30], alpha: .5 * f, overlay: true, fx: true });
      } else if (p.type === 'etincelle') {
        sortie.push({ shape: 'sphere', p: [p.x, p.y, p.z], s: [p.s, p.s, p.s], mat: 17, fxSpark: true, color: [1, .8, .3], alpha: f, overlay: true, fx: true, emissive: 1 });
      } else if (p.type === 'sang') {
        sortie.push({ shape: 'box', p: [p.x, p.y, p.z], s: [p.s, p.s, p.s], mat: 6, color: [0.55, 0.05, 0.04], alpha: f });
      } else if (p.type === 'eclat') {
        sortie.push({ shape: 'box', p: [p.x, p.y, p.z], s: [p.s, p.s, p.s], r: [p.r, p.r * .7, 0], mat: 7, color: [0.2, 0.2, 0.22], alpha: Math.min(1, f * 2) });
      } else if (p.type === 'poussiere') {
        sortie.push({ shape: 'sphere', p: [p.x, p.y, p.z], s: [p.s, p.s * .7, p.s], mat: 15, fxSmoke: true, color: [.5, .44, .34], alpha: .45 * f, overlay: true, fx: true });
      }
    }
    for (const f of sys.flashs) {
      const k = 1 - f.t / f.duree;
      sortie.push({ shape: 'sphere', p: [f.x, f.y, f.z], s: [f.r * k, f.r * k, f.r * k], mat: 14, fxFire: true, color: [1, .85, .45], alpha: k, overlay: true, fx: true, emissive: 1 });
    }
  }

  B.etincelles = { creer, maj, mailler, explosion, sang, impact, tir };
})(typeof window !== 'undefined' ? window : globalThis);
