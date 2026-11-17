/* CHAIR À CANON — les armes : balles rapides et tendues, grenades en cloche qui rebondissent, roquettes
   droitières. Les projectiles avancent par pas fixes (la simulation tourne à 60 Hz) et frappent le sol,
   les obstacles qui arrêtent les balles et les hommes. Une balle tue ; l'explosion blesse dans un rayon. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const PARAM = {
    mg: { vitesse: 78, grav: 1.1, portee: 46, cadence: .115, dispersion: .03 },
    mgEnnemi: { vitesse: 62, grav: 1.1, portee: 38, cadence: .13, dispersion: .075 },
    grenade: { grav: 13.5, meche: 2.3, rayon: 4.4, mortBalle: 2.4 },
    roquette: { vitesse: 27, grav: .5, rayon: 5.2 }
  };

  // Le point de départ du tir : l'épaule de l'homme, un peu en avant.
  function depart(u, relief) {
    const y = relief.hauteur(u.x, u.z);
    return [u.x + Math.sin(u.dirTir) * .45, y + 1.12, u.z + Math.cos(u.dirTir) * .45];
  }

  function tirerMg(etat, u, cible, relief, ennemi) {
    const p = PARAM[ennemi ? 'mgEnnemi' : 'mg'];
    const [x0, y0, z0] = depart(u, relief);
    const tx = cible.x, ty = (cible.y === undefined ? relief.hauteur(cible.x, cible.z) + (cible.unite ? .95 : .35) : cible.y), tz = cible.z;
    const d = Math.hypot(tx - x0, ty - y0, tz - z0) || 1;
    const r = etat.rng;
    // dispersion : un cône autour de la direction
    const ax = (r() - .5) * 2 * p.dispersion, az = (r() - .5) * 2 * p.dispersion, ay = (r() - .5) * 2 * p.dispersion;
    const vx = (tx - x0) / d * p.vitesse + ax * p.vitesse;
    const vy = (ty - y0) / d * p.vitesse + ay * p.vitesse * .6;
    const vz = (tz - z0) / d * p.vitesse + az * p.vitesse;
    etat.projectiles.push({ type: 'balle', x: x0, y: y0, z: z0, vx, vy, vz, t: 0, portee: p.portee, camp: u.camp, tireur: u, trace: [x0, y0, z0] });
    u.cooldown = p.cadence;
    return true;
  }

  // Solution balistique simple pour la grenade : temps de vol choisi, vitesse qui suit.
  function tirerGrenade(etat, u, cible, relief) {
    if (u.grenades <= 0) return false;
    u.grenades--;
    const [x0, y0, z0] = depart(u, relief);
    const tx = cible.x, tz = cible.z, ty = relief.hauteur(tx, tz) + .2;
    const d = Math.hypot(tx - x0, tz - z0);
    const T = Math.min(1.9, Math.max(.75, Math.sqrt(Math.max(d, .5)) * .62));
    const g = PARAM.grenade.grav;
    etat.projectiles.push({
      type: 'grenade', x: x0, y: y0 + .2, z: z0,
      vx: (tx - x0) / T, vy: (ty - y0 + .5 * g * T * T) / T, vz: (tz - z0) / T,
      t: 0, meche: PARAM.grenade.meche, rebonds: 0, camp: u.camp, tireur: u
    });
    u.cooldown = .8;
    return true;
  }

  function tirerRoquette(etat, u, cible, relief) {
    if (u.roquettes <= 0) return false;
    u.roquettes--;
    const [x0, y0, z0] = depart(u, relief);
    const tx = cible.x, ty = (cible.y === undefined ? relief.hauteur(cible.x, cible.z) + .8 : cible.y), tz = cible.z;
    const d = Math.hypot(tx - x0, ty - y0, tz - z0) || 1;
    const p = PARAM.roquette;
    etat.projectiles.push({
      type: 'roquette', x: x0, y: y0 + .1, z: z0,
      vx: (tx - x0) / d * p.vitesse, vy: (ty - y0) / d * p.vitesse, vz: (tz - z0) / d * p.vitesse,
      t: 0, portee: 60, camp: u.camp, tireur: u
    });
    u.cooldown = 1.6;
    return true;
  }

  function toucheHommes(etat, x, y, z, rayon, campQuiTire, cause) {
    let touches = 0;
    for (const u of etat.unites) {
      if (u.etat === 'mort' || u.camp === campQuiTire) continue;
      const uy = etat.relief.hauteur(u.x, u.z);
      const d = Math.hypot(x - u.x, z - u.z);
      const vertical = y > uy - .35 && y < uy + 1.9;
      if (d < rayon && vertical) {
        const degats = cause === 'balle' ? 100 : (d < rayon * .55 ? 100 : Math.max(18, 100 * (1 - d / rayon)));
        u.vie -= degats;
        touches++;
        if (u.vie <= 0) { B.troupe.tuer(u, etat.t); etat.stats.tues[u.camp] = (etat.stats.tues[u.camp] || 0) + 1; if (etat.quand && etat.quand.mort) etat.quand.mort(u, cause); }
        else if (etat.quand && etat.quand.blesse) etat.quand.blesse(u);
      }
    }
    return touches;
  }

  function explosion(etat, x, y, z, rayon) {
    if (etat.quand && etat.quand.explosion) etat.quand.explosion(x, y, z, rayon);
    toucheHommes(etat, x, y, z, rayon, null, 'souffle');
    // les mines sautent en chaîne
    for (const m of etat.decor.mines) {
      if (m.sautee) continue;
      if (Math.hypot(x - m.x, z - m.z) < rayon + .4) { m.sautee = true; explosion(etat, m.x, etat.relief.hauteur(m.x, m.z) + .15, m.z, 3.6); }
    }
  }

  function maj(etat, dt) {
    const relief = etat.relief, ps = etat.projectiles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.t += dt;
      const grav = p.type === 'balle' ? PARAM.mg.grav : p.type === 'grenade' ? PARAM.grenade.grav : PARAM.roquette.grav;
      const pas = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy, p.vz) * dt / .5));
      let mort = false;
      for (let k = 0; k < pas && !mort; k++) {
        const h = dt / pas;
        p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
        if (p.type !== 'roquette') p.vy -= grav * h;
        const ySol = relief.hauteur(p.x, p.z);
        if (p.type === 'grenade') {
          if (p.y <= ySol + .08) {
            p.y = ySol + .08;
            if (p.rebonds > 2 || Math.abs(p.vy) < 1.4) { ps.splice(i, 1); explosion(etat, p.x, p.y + .15, p.z, PARAM.grenade.rayon); mort = true; break; }
            p.vy = -p.vy * .34; p.vx *= .58; p.vz *= .58; p.rebonds++;
            if (etat.quand && etat.quand.rebond) etat.quand.rebond(p);
          }
          if (!mort && p.t >= p.meche) { ps.splice(i, 1); explosion(etat, p.x, p.y, p.z, PARAM.grenade.rayon); mort = true; break; }
        } else {
          // balle ou roquette : sol, obstacles, hommes
          let frappe = null;
          if (p.y <= ySol) frappe = { x: p.x, y: ySol, z: p.z };
          if (!frappe) for (const o of relief.obstacles) {
            if (!o.bloqueTir) continue;
            if (p.y > o.h + .15 || p.y < relief.eau - .5) continue;
            if ((p.x - o.x) ** 2 + (p.z - o.z) ** 2 < o.r * o.r) { frappe = { x: p.x, y: p.y, z: p.z }; break; }
          }
          if (!frappe) {
            const rayon = p.type === 'roquette' ? .55 : .42;
            for (const u of etat.unites) {
              if (u.etat === 'mort' || u.camp === p.camp) continue;
              const uy = relief.hauteur(u.x, u.z);
              if (p.x > u.x - rayon && p.x < u.x + rayon && p.z > u.z - rayon && p.z < u.z + rayon && p.y > uy - .25 && p.y < uy + 1.85) {
                if (p.type === 'roquette') { frappe = { x: p.x, y: p.y, z: p.z }; }
                else {
                  ps.splice(i, 1);
                  toucheHommes(etat, u.x, p.y, u.z, .5, p.camp, 'balle');
                  if (etat.quand && etat.quand.impact) etat.quand.impact(p, u);
                  mort = true;
                }
                break;
              }
            }
          }
          if (!mort && frappe) {
            ps.splice(i, 1); mort = true;
            if (p.type === 'roquette') explosion(etat, frappe.x, Math.max(frappe.y, relief.hauteur(frappe.x, frappe.z) + .2), frappe.z, PARAM.roquette.rayon);
            else if (etat.quand && etat.quand.impact) etat.quand.impact(p, null, frappe);
          }
          if (!mort && (p.t > 3 || Math.hypot(p.x - (p.trace ? p.trace[0] : p.x), p.z - (p.trace ? p.trace[2] : p.z)) > p.portee)) { ps.splice(i, 1); mort = true; }
        }
      }
      if (!mort && p.type === 'grenade' && p.t > 6) { ps.splice(i, 1); explosion(etat, p.x, p.y, p.z, PARAM.grenade.rayon); }
      if (!mort && p.type === 'roquette' && p.t > 4) { ps.splice(i, 1); explosion(etat, p.x, p.y, p.z, PARAM.roquette.rayon); }
    }
  }

  B.armes = { PARAM, tirerMg, tirerGrenade, tirerRoquette, explosion, maj, toucheHommes, depart };
})(typeof window !== 'undefined' ? window : globalThis);
