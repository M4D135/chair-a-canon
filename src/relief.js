/* CHAIR À CANON — le relief : une île engendrée par bruit de valeur (fbm), échantillonnée sur une grille.
   Le relief répond à trois questions : de quelle hauteur est le sol ici, peut-on y marcher, et une balle
   y voit-elle son chemin coupé ? Il fournit aussi les nappes de triangles colorés du rendu (13 octets
   flottants par sommet : position, normale, trois portées nulles, matière, couleur).
   Module pur : il tourne dans Node pour les tests, sans fenêtre ni canvas. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  function rng(graine) {
    let s = (graine >>> 0) || 0x9e3779b9;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296; };
  }
  function hach(x, y, graine) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(graine | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const lisse = t => t * t * (3 - 2 * t);
  function bruit(x, y, graine) {
    const xi = Math.floor(x), yi = Math.floor(y), tx = lisse(x - xi), ty = lisse(y - yi);
    const a = hach(xi, yi, graine), b = hach(xi + 1, yi, graine), c = hach(xi, yi + 1, graine), d = hach(xi + 1, yi + 1, graine);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  function fbm(x, y, graine, octaves) {
    let s = 0, amp = .5, f = 1, n = 0;
    for (let i = 0; i < (octaves || 4); i++) { s += amp * bruit(x * f, y * f, graine + i * 977); n += amp; amp *= .5; f *= 2; }
    return s / n;
  }

  const EAU = 0;

  function creer(opt) {
    opt = opt || {};
    const graine = (opt.graine >>> 0) || 1;
    const taille = opt.taille || 96;
    const pas = opt.pas || 1;
    const n = Math.round(taille / pas) + 1;
    const h = new Float32Array(n * n);
    const cx = taille / 2, cz = taille / 2, rayon = taille * .47;

    // L'île : un renflement central qui plonge dans la mer vers les bords, creusé de vallons.
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * pas, z = j * pas;
      const d = Math.hypot(x - cx, z - cz) / rayon;
      let v = fbm(x / 30, z / 30, graine, 5) - .44;
      v += .62 * Math.pow(Math.max(0, 1 - d), 1.15) - 1.35 * Math.max(0, d - .8);
      v += (fbm(x / 11 + 7.3, z / 11 + 2.1, graine + 313, 3) - .5) * .5 * Math.max(0, 1 - d * .85);
      h[j * n + i] = v * 12.5;
    }

    // Combler les cuvettes isolées : un creux sous la mer mais cerné de terre n'est pas une baie,
    // c'est une flaque où la nappe de mer affleurerait en plein milieu de l'herbe.
    const RAY = 3, bouchons = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (h[j * n + i] >= EAU - .06) continue;
      let lePlusHaut = -Infinity;
      for (let dj = -RAY; dj <= RAY; dj++) for (let di = -RAY; di <= RAY; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        if (h[jj * n + ii] > lePlusHaut) lePlusHaut = h[jj * n + ii];
      }
      if (lePlusHaut > EAU + .5) { h[j * n + i] = EAU + .04; bouchons.push(j * n + i); }
    }
    // ramener la pente sous .55 m par case : on abaisse le haut partout, on ne remonte que les bouchons
    const estBouchonSet = new Set(bouchons);
    for (let passe = 0; passe < 48; passe++) {
      let bouge = false;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = j * n + i;
        let bas = Infinity, haut = -Infinity;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
          const v = h[jj * n + ii];
          if (v < bas) bas = v; if (v > haut) haut = v;
        }
        const avant = h[c];
        let v = Math.min(h[c], bas + .55);
        if (h[c] < haut - .55 && estBouchonSet.has(c)) v = Math.max(v, haut - .55);
        if (v !== avant) { h[c] = v; bouge = true; }
      }
      if (!bouge) break;
    }

    const R = {
      taille, pas, n, graine, eau: EAU, h,
      obstacles: [],      // {x, z, r, h, bloqueMarche, bloqueTir}
      zones: [],          // {x, z, r, couleur} — terre retournée du camp, aplatissements…

      hauteur(x, z) {
        const fi = Math.min(Math.max(x / pas, 0), n - 1.001), fj = Math.min(Math.max(z / pas, 0), n - 1.001);
        const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j;
        const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
        return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
      },
      pente(x, z) {
        const e = pas;
        return [(R.hauteur(x + e, z) - R.hauteur(x - e, z)) / (2 * e), (R.hauteur(x, z + e) - R.hauteur(x, z - e)) / (2 * e)];
      },
      estEau(x, z) { return R.hauteur(x, z) <= EAU + .02; },
      dansCarte(x, z) { return x > 1 && z > 1 && x < taille - 1 && z < taille - 1; },

      aplatir(x, z, rayonCible, alt) {
        const r0 = Math.ceil(rayonCible / pas);
        const i0 = Math.max(0, Math.floor(x / pas) - r0), i1 = Math.min(n - 1, Math.ceil(x / pas) + r0);
        const j0 = Math.max(0, Math.floor(z / pas) - r0), j1 = Math.min(n - 1, Math.ceil(z / pas) + r0);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const dx = i * pas - x, dz = j * pas - z, d = Math.hypot(dx, dz);
          if (d > rayonCible) continue;
          const f = lisse(1 - d / rayonCible);
          const g = f >= .5 ? 1 : lisse(f / .5) * .5;   // le cœur du plateau est rigoureusement horizontal
          h[j * n + i] = h[j * n + i] * (1 - g) + alt * g;
        }
      },
      creuser(x, z, rayonCible, profondeur) {
        const r0 = Math.ceil(rayonCible / pas);
        const i0 = Math.max(0, Math.floor(x / pas) - r0), i1 = Math.min(n - 1, Math.ceil(x / pas) + r0);
        const j0 = Math.max(0, Math.floor(z / pas) - r0), j1 = Math.min(n - 1, Math.ceil(z / pas) + r0);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const dx = i * pas - x, dz = j * pas - z, d = Math.hypot(dx, dz);
          if (d > rayonCible) continue;
          const f = lisse(1 - d / rayonCible);
          h[j * n + i] -= profondeur * f;
        }
      },

      ajouterObstacle(o) { R.obstacles.push(o); return o; },

      // Peut-on poser un homme de rayon r ici ? (hors eau, hors obstacle, sur la carte)
      libre(x, z, r) {
        if (!R.dansCarte(x, z) || R.estEau(x, z)) return false;
        const p = R.pente(x, z);
        if (Math.hypot(p[0], p[1]) > 1.15) return false;
        for (const o of R.obstacles) {
          if (!o.bloqueMarche) continue;
          if (Math.hypot(x - o.x, z - o.z) < o.r + (r === undefined ? .38 : r)) return false;
        }
        return true;
      },
      pointLibre(x, z, r) {
        if (R.libre(x, z, r)) return { x, z };
        const r0 = rng((x * 73856093 ^ z * 19349663 ^ R.graine) >>> 0);
        for (let k = 0; k < 24; k++) {
          const a = r0() * Math.PI * 2, d = .8 + k * .55;
          const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d;
          if (R.libre(nx, nz, r)) return { x: nx, z: nz };
        }
        return null;
      },

      // Une ligne de vue tient-elle entre deux yeux ? Le relief et les obstacles « bloqueTir » la coupent.
      losClair(x0, y0, z0, x1, y1, z1) {
        const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
        const d = Math.hypot(dx, dy, dz);
        const pasL = .6, l = Math.ceil(d / pasL);
        for (let k = 1; k < l; k++) {
          const f = k / l, px = x0 + dx * f, py = y0 + dy * f, pz = z0 + dz * f;
          if (py < R.hauteur(px, pz) + .22) return false;
        }
        for (const o of R.obstacles) {
          if (!o.bloqueTir) continue;
          const ox = o.x - x0, oz = o.z - z0;
          const t = (ox * dx + oz * dz) / (d * d);
          if (t <= 0 || t >= 1) continue;
          const yL = y0 + dy * t;
          if (yL < o.h + .1 && yL > EAU - .5) {
            const qx = x0 + dx * t - o.x, qz = z0 + dz * t - o.z;
            if (qx * qx + qz * qz < o.r * o.r) return false;
          }
        }
        return true;
      },

      // Le rayon de l'écran frappe-t-il le sol, un obstacle ou un homme ? (marche le long du rayon)
      frapper(ox, oy, oz, dx, dy, dz, unites) {
        const l = 260, pasL = .45, nL = Math.ceil(l / pasL);
        let px = ox, py = oy, pz = oz;
        for (let k = 1; k <= nL; k++) {
          const t = k * pasL; px = ox + dx * t; py = oy + dy * t; pz = oz + dz * t;
          if (py < -6) break;
          if (!R.dansCarte(px, pz) && py < EAU) break;
          for (const u of (unites || [])) {
            if (u.etat === 'mort') continue;
            const uy = R.hauteur(u.x, u.z);
            if (px > u.x - .5 && px < u.x + .5 && pz > u.z - .5 && pz < u.z + .5 && py > uy - .1 && py < uy + 1.8)
              return { type: 'unite', unite: u, x: px, y: py, z: pz };
          }
          for (const o of R.obstacles) {
            if (!o.bloqueTir) continue;
            if (py > o.h + .15) continue;
            const qx = px - o.x, qz = pz - o.z;
            if (qx * qx + qz * qz < o.r * o.r && py > EAU - .5) return { type: 'obstacle', obstacle: o, x: px, y: py, z: pz };
          }
          if (py <= R.hauteur(px, pz)) return { type: 'sol', x: px, y: R.hauteur(px, pz), z: pz };
        }
        return null;
      },

      // Les nappes du rendu : la terre en carreaux de 12, la mer en un seul plan.
      nappes() {
        const tuiles = [], T = 12;
        const herbe = [.17, .33, .13], herbeSombre = [.11, .22, .10], sable = [.72, .62, .40], roche = [.40, .38, .33], profond = [.05, .15, .19];
        // le sable ne borde que la mer : une cellule basse perdue dans l'herbe reste de l'herbe
        const presDeLeau = new Uint8Array(n * n);
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
          for (let dj = -4; dj <= 4 && !presDeLeau[j * n + i]; dj++) for (let di = -4; di <= 4; di++) {
            const ii = i + di, jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
            if (h[jj * n + ii] < EAU) { presDeLeau[j * n + i] = 1; break; }
          }
        }
        const nb = Math.ceil((n - 1) / T);
        for (let tj = 0; tj < nb; tj++) for (let ti = 0; ti < nb; ti++) {
          const i0 = ti * T, j0 = tj * T, i1 = Math.min(n - 1, i0 + T), j1 = Math.min(n - 1, j0 + T);
          const s = [], idx = [], base = new Map();
          let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
          const sommet = (i, j) => {
            const cle = j * n + i;
            if (base.has(cle)) return base.get(cle);
            const x = i * pas, z = j * pas, y = h[j * n + i];
            const gx = (h[Math.min(n - 1, j) * n + Math.min(n - 1, i + 1)] - h[j * n + Math.max(0, i - 1)]) / (2 * pas);
            const gz = (h[Math.min(n - 1, j + 1) * n + i] - h[Math.max(0, j - 1) * n + i]) / (2 * pas);
            const ln = Math.hypot(gx, 1, gz) || 1;
            let col, mat = 8;
            if (y <= EAU - .5) { col = profond; }
            else if (y < .75 && presDeLeau[j * n + i]) { const t = hach(i * 3, j * 7, graine + 5); col = [sable[0] - t * .07, sable[1] - t * .07, sable[2] - t * .09]; }
            else {
              const t = fbm(x / 6, z / 6, graine + 77, 2);
              col = [herbe[0] + t * .1, herbe[1] + t * .14, herbe[2] + t * .06];
              if (Math.hypot(gx, gz) > .75) { col = roche.map(v => v + t * .06); mat = 9; }
              else if (t < .3) col = herbeSombre;
            }
            for (const zn of R.zones) {
              const d = Math.hypot(x - zn.x, z - zn.z);
              if (d < zn.r && y > EAU) { const f = lisse(1 - d / zn.r); col = [col[0] + (zn.couleur[0] - col[0]) * f, col[1] + (zn.couleur[1] - col[1]) * f, col[2] + (zn.couleur[2] - col[2]) * f]; }
            }
            s.push(x, y, z, -gx / ln, 1 / ln, -gz / ln, 0, 0, 0, mat, col[0], col[1], col[2]);
            if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
            if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
            if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
            const id = s.length / 13 - 1;
            base.set(cle, id);
            return id;
          };
          for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
            const a = sommet(i, j), b = sommet(i + 1, j), c = sommet(i, j + 1), d = sommet(i + 1, j + 1);
            idx.push(a, c, b, b, c, d);
          }
          if (!s.length) continue;
          const centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
          tuiles.push({
            sommets: new Float32Array(s), indices: new Uint32Array(idx), centre,
            rayon: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 + 1
          });
        }
        return tuiles;
      },

      nappeEau() {
        const s = [], idx = [];
        const t = taille, y = EAU - .06, col = [.10, .30, .42];
        for (const [x, z] of [[0, 0], [t, 0], [0, t], [t, t]]) s.push(x, y, z, 0, 1, 0, 0, 0, 0, 12, col[0], col[1], col[2]);
        idx.push(0, 2, 1, 1, 2, 3);
        return { sommets: new Float32Array(s), indices: new Uint32Array(idx), centre: [t / 2, y, t / 2], rayon: t * .75 };
      },

      atmosphere() {
        return {
          skyTop: [.16, .30, .46], skyBottom: [.62, .68, .60], fog: [.55, .62, .58],
          sunDirection: [.42, .78, .31], sunColor: [1, .92, .74], ambient: [.30, .34, .33],
          wind: .5, fogDensity: 0, biome: 'ilot'
        };
      }
    };
    return R;
  }

  B.relief = { creer, rng, fbm, hach, EAU };
})(typeof window !== 'undefined' ? window : globalThis);
