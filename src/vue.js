/* CHAIR À CANON — la vue, reprise de la caméra RTS de Point de rupture : une visée au sol que la caméra
   rejoint sans à-coups (l'amortisseur critique de FERRO, motion.js damp), la carte saisie à la main (le point
   du sol sous le curseur reste sous le curseur), le zoom vers le curseur, la rotation autour de la visée, et
   l'emprise du soleil (camera.sun) pour que l'ombre ne tienne que sur ce que l'on voit. Le lacet reste fixé
   à 45° par défaut — l'île est toujours posée comme dans l'original — mais Q/E et le glissement Shift le
   laissent tourner. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const DMIN = 16, DMAX = 74, FOV = 26;
  const TAN = Math.tan(FOV * Math.PI / 360);
  const YAW0 = Math.PI / 4;
  const borner = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /** Amortisseur critique de FERRO (motion.js, damp), à la même formule. */
  function amortir(q, cible, omega, dt) {
    const x = q.x - cible, e = Math.exp(-omega * dt), t = (q.v + omega * x) * dt;
    q.x = cible + (x + t) * e; q.v = (q.v - omega * t) * e;
    return q.x;
  }
  const canal = x => ({ x, v: 0 });
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

  /** Axes du moteur (cameraAxes) : avant = [sin lacet · cos tangage, sin tangage, -cos lacet · cos tangage]. */
  function axes(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { right: [cy, 0, sy], up: [-sy * sp, cp, cy * sp], forward: [sy * cp, sp, -cy * cp] };
  }
  /** Plus on s'éloigne, plus on regarde à plomb : 34° près du sol, 52° tout en haut. */
  const tangage = D => -(34 + 18 * Math.pow(borner((D - DMIN) / (DMAX - DMIN), 0, 1), 0.7)) * Math.PI / 180;

  function creer(canvas, relief) {
    const vise = { x: 48, z: 48, D: 30, yaw: YAW0 };
    const lis = { x: canal(48), z: canal(48), D: canal(30), yaw: canal(YAW0) };
    const touches = new Set();
    let vue = null;

    // Repère du soleil, comme dans sunShadowPass : avant = -soleil, droite horizontale, haut = droite × avant.
    const s = [.42, .78, .31]; s[1] = Math.max(0.12, s[1]);
    const ls = Math.hypot(...s), fw = s.map(v => -v / ls), lh = Math.hypot(fw[0], fw[2]);
    const sr = [-fw[2] / lh, 0, fw[0] / lh];
    const su = [sr[1] * fw[2] - sr[2] * fw[1], sr[2] * fw[0] - sr[0] * fw[2], sr[0] * fw[1] - sr[1] * fw[0]];

    const aspect = () => (canvas && canvas.clientWidth ? canvas.clientWidth : 800) / (canvas && canvas.clientHeight ? canvas.clientHeight : 600);
    const solY = (x, z) => (relief ? Math.max(relief.hauteur(x, z), relief.eau) : 0);

    function camera(x, z, D, yaw) {
      const pitch = tangage(D), a = axes(yaw, pitch), f = a.forward;
      let pos = [x - f[0] * D, -f[1] * D, z - f[2] * D];
      // l'œil ne se noie ni dans la mer ni dans une colline
      const garde = solY(pos[0], pos[2]) + 3;
      if (pos[1] < garde) pos[1] = garde;
      return { pos, yaw, pitch, roll: 0, fov: FOV, near: Math.max(.5, D * .02), far: D * 4 + 200, allStatic: true, axes: a, D, cible: [x, z] };
    }
    /** Rayon de l'écran pour un pixel CSS, caméra donnée. */
    function rayon(cam, px, py) {
      const w = (canvas && canvas.clientWidth) || 800, h = (canvas && canvas.clientHeight) || 600;
      const nx = (px / w) * 2 - 1, ny = 1 - (py / h) * 2, { right: r, up: u, forward: f } = cam.axes, k = aspect();
      return [f[0] + (r[0] * nx * k + u[0] * ny) * TAN, f[1] + (r[1] * nx * k + u[1] * ny) * TAN, f[2] + (r[2] * nx * k + u[2] * ny) * TAN];
    }
    /** Point du sol (terrain ou mer) sous un pixel CSS, pour une caméra donnée. */
    function sol(cam, px, py) {
      const d = rayon(cam, px, py);
      if (d[1] > -1e-4) return null;
      const t = -cam.pos[1] / d[1];
      const x = cam.pos[0] + d[0] * t, z = cam.pos[2] + d[2] * t;
      return [x, z];
    }
    /** Emprise du soleil (camera.sun) : le carré du repère solaire qui couvre le sol visible. */
    function emprise(cam) {
      const w = (canvas && canvas.clientWidth) || 800, h = (canvas && canvas.clientHeight) || 600;
      const coins = [[0, 0], [w, 0], [0, h], [w, h]].map(([a, b]) => sol(cam, a, b));
      if (coins.some(c => !c)) return { center: [cam.cible[0], 0, cam.cible[1]], extent: cam.D * 1.5, depth: cam.D * 3.75 + 150 };
      let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity, gx = 0, gz = 0;
      for (const c of coins) {
        gx += c[0] / 4; gz += c[1] / 4;
        for (const y of [0, 12]) {
          const pr = c[0] * sr[0] + y * sr[1] + c[1] * sr[2], pu = c[0] * su[0] + y * su[1] + c[1] * su[2];
          r0 = Math.min(r0, pr); r1 = Math.max(r1, pr); u0 = Math.min(u0, pu); u1 = Math.max(u1, pu);
        }
      }
      const g = [gx, 0, gz], dr = (r0 + r1) / 2 - (g[0] * sr[0] + g[2] * sr[2]), du = (u0 + u1) / 2 - (g[0] * su[0] + g[1] * su[1] + g[2] * su[2]);
      const center = [g[0] + sr[0] * dr + su[0] * du, g[1] + sr[1] * dr + su[1] * du, g[2] + sr[2] * dr + su[2] * du];
      const extent = Math.ceil((Math.max(r1 - r0, u1 - u0) / 2 + 6) / 8) * 8;
      return { center, extent, depth: extent * 2.5 + 150 };
    }

    function borne() {
      const t = relief ? relief.taille : 96;
      vise.x = borner(vise.x, -10, t + 10);
      vise.z = borner(vise.z, -10, t + 10);
      vise.D = borner(vise.D, DMIN, DMAX);
    }
    const visee = () => camera(vise.x, vise.z, vise.D, vise.yaw);

    const cam = {
      canvas, relief, bord: { n: false, s: false, e: false, o: false }, secousse: 0,
      DMIN, DMAX,
      get x() { return lis.x.x; }, get z() { return lis.z.x; }, get dist() { return lis.D.x; },
      get cibleX() { return vise.x; }, set cibleX(v) { vise.x = v; borne(); },
      get cibleZ() { return vise.z; }, set cibleZ(v) { vise.z = v; borne(); },
      get yaw() { return vise.yaw; },
      placer(x, z, D = vise.D, yaw = vise.yaw) {
        Object.assign(vise, { x, z, D, yaw }); borne();
        lis.x = canal(vise.x); lis.z = canal(vise.z); lis.D = canal(vise.D); lis.yaw = canal(vise.yaw);
      },
      viser(x, z) { vise.x = x; vise.z = z; borne(); },
      /** Déplace la visée dans le plan du sol : droite et avant de l'écran, en mètres. */
      glisser(droite, avant) {
        const c = Math.cos(vise.yaw), s = Math.sin(vise.yaw);
        vise.x += c * droite + s * avant; vise.z += s * droite - c * avant; borne();
      },
      /** Garde sous le curseur le point du sol saisi : le geste suit la main, sans lissage. */
      saisir(px, py) { return sol(visee(), px, py); },
      tenir(prise, px, py) {
        const ici = sol(visee(), px, py);
        if (!prise || !ici) return;
        vise.x += prise[0] - ici[0]; vise.z += prise[1] - ici[1]; borne();
        lis.x = canal(vise.x); lis.z = canal(vise.z);
      },
      /** Zoom d'un facteur vers le pixel (px, py) : le point du sol sous le curseur ne bouge pas. */
      zoomer(facteur, px, py) {
        const avant = px === undefined ? null : sol(visee(), px, py);
        vise.D = borner(vise.D * facteur, DMIN, DMAX);
        if (avant) {
          const apres = sol(visee(), px, py);
          if (apres) { vise.x += avant[0] - apres[0]; vise.z += avant[1] - apres[1]; borne(); }
        }
      },
      tourner(da) { vise.yaw += da; },
      touche(code, bas) { if (bas) touches.add(code); else touches.delete(code); },
      relacher() { touches.clear(); },
      /** Pixel CSS d'un point du monde pour la dernière vue, ou null s'il est derrière l'œil. */
      projeter(x, y, z) {
        if (!vue) return null;
        const { right: r, up: u, forward: f } = vue.axes, p = vue.pos;
        const dx = x - p[0], dy = y - p[1], dz = z - p[2], profondeur = dx * f[0] + dy * f[1] + dz * f[2];
        if (profondeur < vue.near) return null;
        const w = (canvas && canvas.clientWidth) || 800, h = (canvas && canvas.clientHeight) || 600;
        const sx = (dx * r[0] + dy * r[1] + dz * r[2]) / (profondeur * TAN * aspect()), sy = (dx * u[0] + dy * u[1] + dz * u[2]) / (profondeur * TAN);
        return [(sx + 1) * .5 * w, (1 - sy) * .5 * h, profondeur];
      },
      /** Point du sol sous un pixel CSS, pour la dernière vue. */
      pointer(px, py) { return vue ? sol(vue, px, py) : null; },
      get derniere() { return vue; }
    };

    /** Avance le lissage, le clavier et les bords ; rend la caméra du moteur pour cette image. */
    cam.vue = function (dt) {
      const pas = vise.D * 1.1 * dt;
      let dr = 0, da = 0, rot = 0;
      if (touches.has('gauche')) dr -= 1;
      if (touches.has('droite')) dr += 1;
      if (touches.has('avant')) da += 1;
      if (touches.has('arriere')) da -= 1;
      if (touches.has('tourneG')) rot -= 1;
      if (touches.has('tourneD')) rot += 1;
      if (touches.has('plus')) cam.zoomer(Math.exp(-1.6 * dt));
      if (touches.has('moins')) cam.zoomer(Math.exp(1.6 * dt));
      if (cam.bord.o) dr -= 1;
      if (cam.bord.e) dr += 1;
      if (cam.bord.n) da += 1;
      if (cam.bord.s) da -= 1;
      if (dr || da) cam.glisser(dr * pas, da * pas);
      if (rot) vise.yaw += rot * 1.6 * dt;
      const yaw = amortir(lis.yaw, lis.yaw.x + angle(vise.yaw - lis.yaw.x), 12, dt);
      const x = amortir(lis.x, vise.x, 14, dt), z = amortir(lis.z, vise.z, 14, dt), D = amortir(lis.D, vise.D, 11, dt);
      cam.secousse = Math.max(0, cam.secousse - dt * 2.4);
      vue = camera(x, z, D, yaw);
      // vue.sun = emprise(vue); — en attente de vérification du pass ombres
      return vue;
    };
    return cam;
  }

  // ————— compatibilité avec la coque (maj/camera3d/axes/curseur) —————
  function maj(cam, dt) { cam.vue(dt); }
  function camera3d(cam) { return cam.derniere || cam.vue(0); }
  function curseur(cam, relief, mx, my, unites) {
    const v = cam.derniere || cam.vue(0);
    const d = rayonDe(v, cam, mx, my);
    return relief.frapper(v.pos[0], v.pos[1], v.pos[2], d[0], d[1], d[2], unites);
  }
  function rayonDe(camVue, cam, px, py) {
    const c = cam.canvas;
    const w = (c && c.clientWidth) || 800, h = (c && c.clientHeight) || 600;
    const nx = (px / w) * 2 - 1, ny = 1 - (py / h) * 2, { right: r, up: u, forward: f } = camVue.axes, k = w / h;
    return [f[0] + (r[0] * nx * k + u[0] * ny) * TAN, f[1] + (r[1] * nx * k + u[1] * ny) * TAN, f[2] + (r[2] * nx * k + u[2] * ny) * TAN];
  }

  /** Le clavier de la caméra, comme dans Point de rupture. */
  const CLAVIER = {
    ArrowUp: 'avant', KeyW: 'avant', ArrowDown: 'arriere', KeyS: 'arriere',
    ArrowLeft: 'gauche', KeyA: 'gauche', ArrowRight: 'droite', KeyD: 'droite',
    Equal: 'plus', NumpadAdd: 'plus', PageUp: 'plus', Minus: 'moins', NumpadSubtract: 'moins', PageDown: 'moins',
    KeyQ: 'tourneG', KeyE: 'tourneD'
  };

  B.vue = { creer, maj, camera3d, axes: (cam) => (cam.derniere || cam.vue(0)).axes, curseur, CLAVIER, DMIN, DMAX, FOV, YAW0 };
})(typeof window !== 'undefined' ? window : globalThis);
