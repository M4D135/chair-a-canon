/* CHAIR À CANON — la vue : une caméra isométrique (lacet fixe à 45°, assiette 35°, champ étroit) qui
   cadre l'île comme l'original cadrait ses collines. Elle dérive vers la cible, zoome à la molette, se
   déplace au clavier, aux bords de l'écran ou à la minicarte — et sait dire ce que le curseur désigne. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const YAW = Math.PI / 4, PITCH = -35 * Math.PI / 180, FOV = 26;

  function creer(canvas) {
    return {
      x: 48, z: 48, alt: 0, dist: 34, yaw: YAW, pitch: PITCH, fov: FOV,
      near: .5, far: 320, cibleX: 48, cibleZ: 48,
      canvas, bord: { n: false, s: false, e: false, o: false }, secousse: 0
    };
  }

  function maj(cam, dt) {
    const v = 26 * (cam.dist / 34);
    if (cam.bord.o) cam.cibleX -= v * dt;
    if (cam.bord.e) cam.cibleX += v * dt;
    if (cam.bord.n) cam.cibleZ -= v * dt;
    if (cam.bord.s) cam.cibleZ += v * dt;
    const t = cam.canvas ? cam.canvas.clientWidth : 96, h = cam.canvas ? cam.canvas.clientHeight : 96;
    cam.cibleX = Math.max(2, Math.min(t - 2, cam.cibleX));
    cam.cibleZ = Math.max(2, Math.min(h - 2, cam.cibleZ));
    const k = 1 - Math.exp(-7 * dt);
    cam.x += (cam.cibleX - cam.x) * k;
    cam.z += (cam.cibleZ - cam.z) * k;
    cam.secousse = Math.max(0, cam.secousse - dt * 2.4);
  }

  // La position caméra attendue par le moteur : pos = cible − avant × distance.
  function camera3d(cam, relief) {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const avant = [sy * cp, sp, -cy * cp];
    const alt = Math.max(relief ? relief.hauteur(cam.x, cam.z) + 6 : 4, cam.dist * Math.abs(sp) + 2);
    return {
      pos: [cam.x - avant[0] * cam.dist, alt, cam.z - avant[2] * cam.dist],
      yaw: cam.yaw, pitch: cam.pitch, roll: 0, fov: cam.fov, near: cam.near, far: cam.far,
      allStatic: true
    };
  }

  // Les axes tels que le moteur les construit (cameraAxes), pour lancer le rayon du curseur.
  function axes(cam) {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    return { right: [cy, 0, sy], up: [-sy * sp, cp, cy * sp], forward: [sy * cp, sp, -cy * cp] };
  }

  // Curseur → monde : rayon caméra, frappé contre les hommes, les obstacles et le sol.
  function curseur(cam, relief, mx, my, unites) {
    const c = cam.canvas, w = c.clientWidth || 1, h = c.clientHeight || 1;
    const ndcX = (mx / w) * 2 - 1, ndcY = 1 - (my / h) * 2;
    const a = axes(cam);
    const tan = Math.tan(cam.fov * Math.PI / 360);
    const aspect = w / h;
    const c3 = camera3d(cam, relief);
    let dx = a.forward[0] + a.right[0] * ndcX * tan * aspect + a.up[0] * ndcY * tan;
    let dy = a.forward[1] + a.right[1] * ndcX * tan * aspect + a.up[1] * ndcY * tan;
    let dz = a.forward[2] + a.right[2] * ndcX * tan * aspect + a.up[2] * ndcY * tan;
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    return relief.frapper(c3.pos[0], c3.pos[1], c3.pos[2], dx, dy, dz, unites);
  }

  B.vue = { creer, maj, camera3d, axes, curseur, YAW, PITCH, FOV };
})(typeof window !== 'undefined' ? window : globalThis);
