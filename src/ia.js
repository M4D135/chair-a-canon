/* CHAIR À CANON — l'intelligence ennemie : la garnison veille, patrouille autour de son camp, voit (ou
   entend) l'escouade, gagne un couvert et tire par rafales. Les grenadiers arrosent à la cloche, les
   tourelles balaient et pivotent. L'IA ne pense qu'en positions : le tir et la mort appartiennent aux armes. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const VUE = 30, OUIE = 26;

  function voit(relief, u, cible) {
    const dx = cible.x - u.x, dz = cible.z - u.z, d = Math.hypot(dx, dz);
    if (d > VUE) return false;
    const ang = Math.atan2(dx, dz);
    let e = ang - u.dir;
    while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
    if (d > 8 && Math.abs(e) > 1.35 && !u.alerte) return false;
    return relief.losClair(u.x, relief.hauteur(u.x, u.z) + 1.5, u.z, cible.x, relief.hauteur(cible.x, cible.z) + 1.0, cible.z);
  }

  function meilleursCandidatsCouvert(relief, u, menacant) {
    // huit points autour de l'homme : celui qui voit la menace être vu le moins bien, et qui est libre
    let meilleur = null, scoreM = -1e9;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + (u.id % 8) * .19, d = 2.2 + (k % 3) * 1.6;
      const x = u.x + Math.cos(a) * d, z = u.z + Math.sin(a) * d;
      if (!relief.libre(x, z, .38)) continue;
      let score = 0;
      const vu = relief.losClair(x, relief.hauteur(x, z) + 1.4, z, menacant.x, relief.hauteur(menacant.x, menacant.z) + 1.0, menacant.z);
      score += vu ? -3 : 4;
      score -= Math.abs(Math.hypot(x - menacant.x, z - menacant.z) - 11) * .12;
      for (const o of relief.obstacles) if (o.bloqueTir && Math.hypot(x - o.x, z - o.z) < o.r + 1.1) { score += 2.2; break; }
      if (score > scoreM) { scoreM = score; meilleur = { x, z }; }
    }
    return meilleur;
  }

  function maj(etat, dt) {
    const relief = etat.relief;
    const bleus = etat.unites.filter(u => u.camp === 'bleu' && u.etat !== 'mort');
    const rouges = etat.unites.filter(u => u.camp === 'rouge' && u.etat !== 'mort');

    // les bruits récents (tirs, explosions) alertent la garnison
    for (const b of etat.bruits) {
      for (const u of rouges) {
        if (u.etat === 'mort') continue;
        if (Math.hypot(b.x - u.x, b.z - u.z) < (b.fort ? OUIE * 1.6 : OUIE)) {
          u.alerte = Math.max(u.alerte, b.fort ? 10 : 6);
          if (!u.cibleTir || u.etat !== 'combat') u.derniereVue = { x: b.x, z: b.z };
        }
      }
    }
    etat.bruits.length = 0;

    for (const u of rouges) {
      if (u.etat === 'mort') continue;
      u.cooldown = Math.max(0, u.cooldown - dt);
      u.rafaleD = Math.max(0, u.rafaleD - dt);
      u.alerte = Math.max(0, u.alerte - dt);

      // cible : le bleu le plus proche dans le champ de vision
      let cible = null, dCible = 1e9;
      for (const b of bleus) {
        const d = Math.hypot(b.x - u.x, b.z - u.z);
        if (d < dCible && voit(relief, u, b)) { cible = b; dCible = d; }
      }
      if (cible) { u.derniereVue = { x: cible.x, z: cible.z }; u.alerte = Math.max(u.alerte, 7); }

      if (cible) {
        u.etat = 'combat';
        u.dirTir = Math.atan2(cible.x - u.x, cible.z - u.z);
        const y0 = relief.hauteur(u.x, u.z), y1 = relief.hauteur(cible.x, cible.z);
        u.pitch = Math.max(-.6, Math.min(.6, (y1 - y0) / Math.max(dCible, 1)));
        // se placer : rester à distance de tir, chercher un couvert si exposé
        const expose = relief.losClair(u.x, y0 + 1.4, u.z, cible.x, y1 + 1.0, cible.z);
        const prefere = u.arme === 'grenadier' ? 16 : 11;
        if (expose && dCible < prefere - 2 || expose && u.rafaleD <= 0 && dCible < 6) {
          const couvert = meilleursCandidatsCouvert(relief, u, cible);
          if (couvert && (!u.cible || Math.hypot(u.cible.x - couvert.x, u.cible.z - couvert.z) > 1)) u.cible = couvert;
        } else if (dCible > prefere + 5) u.cible = { x: cible.x, z: cible.z };
        else if (expose) u.cible = null;

        // le tir : rafales cadencées, les grenadiers arrosent à la cloche
        if (u.rafale > 0) {
          if (u.cooldown <= 0 && relief.losClair(u.x, y0 + 1.15, u.z, cible.x, y1 + .6, cible.z)) {
            B.armes.tirerMg(etat, u, { x: cible.x, y: y1 + .95, z: cible.z, unite: true }, relief, true);
            u.rafale--;
            etat.bruits.push({ x: u.x, z: u.z });
            if (etat.quand && etat.quand.tirEnnemi) etat.quand.tirEnnemi(u);
          }
        } else if (u.cooldown <= 0 && u.rafaleD <= 0) {
          u.rafale = 3 + Math.floor(etat.rng() * 3);
          u.rafaleD = 1.1 + etat.rng() * 1.3;
        }
        if (u.arme === 'grenadier' && u.grenades > 0 && u.cooldown <= 0 && dCible > 5 && dCible < 24 && etat.rng() < .5) {
          B.armes.tirerGrenade(etat, u, { x: cible.x + (etat.rng() - .5) * 3, z: cible.z + (etat.rng() - .5) * 3 }, relief);
          if (etat.quand && etat.quand.grenadeEnnemie) etat.quand.grenadeEnnemie(u);
        }
      } else if (u.alerte > 0 && u.derniereVue) {
        u.etat = 'alerte';
        u.cible = { x: u.derniereVue.x, z: u.derniereVue.z };
        u.dirTir = Math.atan2(u.derniereVue.x - u.x, u.derniereVue.z - u.z);
        if (Math.hypot(u.derniereVue.x - u.x, u.derniereVue.z - u.z) < 1.4) u.derniereVue = null;
      } else {
        u.etat = 'patrouille';
        if (!u.cible || Math.hypot(u.cible.x - u.x, u.cible.z - u.z) < .8) {
          if (!u.patrouille) {
            const r = etat.rng;
            u.patrouille = [];
            for (let k = 0; k < 3; k++) {
              const a = r() * Math.PI * 2, d = 3 + r() * 9;
              const p = relief.pointLibre(u.x + Math.cos(a) * d, u.z + Math.sin(a) * d, .4);
              if (p) u.patrouille.push(p);
            }
            u.waypoint = 0;
          }
          u.waypoint = (u.waypoint + 1) % Math.max(1, u.patrouille.length);
          const w = u.patrouille[u.waypoint];
          if (w && Math.hypot(w.x - u.x, w.z - u.z) > 1.2) u.cible = { x: w.x, z: w.z };
          else u.cible = null;
        }
      }
      B.troupe.avancer(u, relief, rouges, dt * (u.etat === 'combat' ? .75 : 1));
    }

    // les tourelles : pivotement lent, rafales longues, jamais hors de portée
    for (const tr of etat.decor.tourelles) {
      if (!tr.vivante) continue;
      tr.cooldown = Math.max(0, tr.cooldown - dt);
      let cible = null, dCible = 1e9;
      for (const b of bleus) {
        const d = Math.hypot(b.x - tr.x, b.z - tr.z);
        if (d < 34 && d < dCible && relief.losClair(tr.x, tr.y + 1.1, tr.z, b.x, relief.hauteur(b.x, b.z) + 1.0, b.z)) { cible = b; dCible = d; }
      }
      if (!cible) continue;
      const vise = Math.atan2(cible.x - tr.x, cible.z - tr.z);
      let e = vise - tr.angle;
      while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      const p = Math.sign(e) * Math.min(Math.abs(e), 1.6 * dt);
      tr.angle += p;
      if (Math.abs(e) < .09 && tr.cooldown <= 0) {
        const faux = { camp: 'rouge', x: tr.x, z: tr.z, dirTir: tr.angle, grenades: 0, cooldown: 0 };
        const y1 = relief.hauteur(cible.x, cible.z);
        B.armes.tirerMg(etat, faux, { x: cible.x, y: y1 + .95, z: cible.z, unite: true }, relief, true);
        tr.cooldown = .16;
        etat.bruits.push({ x: tr.x, z: tr.z });
        if (etat.quand && etat.quand.tirEnnemi) etat.quand.tirEnnemi({ x: tr.x, z: tr.z });
      }
    }
  }

  B.ia = { maj, voit };
})(typeof window !== 'undefined' ? window : globalThis);
