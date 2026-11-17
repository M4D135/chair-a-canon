import test from 'node:test';
import assert from 'node:assert/strict';
import { charger, plateau } from './harnais.mjs';

const B = charger(['relief.js']);

test('relief déterministe : même graine, même île', () => {
  const a = B.relief.creer({ graine: 1234, taille: 48 });
  const b = B.relief.creer({ graine: 1234, taille: 48 });
  assert.deepEqual(Array.from(a.h), Array.from(b.h));
  const c = B.relief.creer({ graine: 1235, taille: 48 });
  assert.notDeepEqual(Array.from(a.h), Array.from(c.h));
});

test('relief : le centre est terre, les coins sont mer', () => {
  const r = B.relief.creer({ graine: 77, taille: 96 });
  assert.ok(!r.estEau(48, 48), 'le centre doit être sec');
  assert.ok(r.estEau(2, 2) && r.estEau(94, 94), 'les coins doivent être sous l’eau');
});

test('relief : hauteur continue, pas de falaises d’un mètre entre deux cases', () => {
  const r = B.relief.creer({ graine: 4242, taille: 64 });
  for (let j = 1; j < r.n - 2; j++) for (let i = 1; i < r.n - 2; i++) {
    const d = Math.max(
      Math.abs(r.h[j * r.n + i] - r.h[j * r.n + i + 1]),
      Math.abs(r.h[j * r.n + i] - r.h[(j + 1) * r.n + i])
    );
    if (d > 1.6) assert.fail(`ressaut de ${d.toFixed(2)} m en ${i},${j}`);
  }
});

test('relief : aplatir rend le plateau horizontal en son centre', () => {
  const r = B.relief.creer({ graine: 4242, taille: 64 });
  r.aplatir(32, 32, 10, 3);
  assert.ok(Math.abs(r.hauteur(32, 32) - 3) < .02, 'le cœur du plateau suit l’altitude');
  assert.ok(Math.abs(r.hauteur(33.5, 30.5) - r.hauteur(30.5, 33.5)) < .05, 'le cœur est horizontal');
});

test('relief : ligne de vue coupée par un obstacle qui arrête les balles', () => {
  const r = plateau(B);
  assert.ok(r.losClair(20, 3, 32, 44, 3, 32), 'à plat et sans mur, on se voit');
  r.ajouterObstacle({ x: 32, z: 32, r: 1.4, h: 3.5, bloqueMarche: true, bloqueTir: true });
  assert.ok(!r.losClair(20, 3, 32, 44, 3, 32), 'le mur doit couper la vue');
  r.obstacles.length = 0;
  r.ajouterObstacle({ x: 32, z: 30, r: 1.2, h: .5, bloqueMarche: true, bloqueTir: false });
  assert.ok(r.losClair(20, 3, 32, 44, 3, 32), 'une souche ne coupe pas la vue');
});

test('relief : le rayon du curseur frappe le sol', () => {
  const r = plateau(B, { alt: 2 });
  const f = r.frapper(32, 20, 32, 0, -1, 0, []);
  assert.equal(f.type, 'sol');
  assert.ok(Math.abs(f.y - 2) < .1);
});

test('relief : le rayon frappe un homme avant le sol', () => {
  const r = plateau(B, { alt: 2 });
  const u = { etat: 'garde', x: 32, z: 32 };
  const f = r.frapper(32, 20, 32, 0, -1, 0, [u]);
  assert.equal(f.type, 'unite');
});

test('relief : les nappes sont des sommets de treize flottants et des indices valides', () => {
  const r = B.relief.creer({ graine: 9, taille: 48 });
  const tuiles = r.nappes();
  assert.ok(tuiles.length >= 4);
  for (const t of tuiles) {
    assert.equal(t.sommets.length % 13, 0);
    assert.ok(t.indices.length % 3 === 0);
    for (const i of t.indices) assert.ok(i >= 0 && i < t.sommets.length / 13);
    assert.ok(Number.isFinite(t.centre[0]) && t.rayon > 0);
  }
  const eau = r.nappeEau();
  assert.equal(eau.sommets.length, 4 * 13);
});

test('relief : libre refuse l’eau et les obstacles', () => {
  const r = B.relief.creer({ graine: 77, taille: 96 });
  assert.ok(!r.libre(2, 2, .4), 'la plage noyée est refusée');
  const sec = r.libre(48, 48, .4);
  r.ajouterObstacle({ x: 48, z: 48, r: 2, h: 2, bloqueMarche: true, bloqueTir: true });
  assert.ok(sec && !r.libre(48, 48, .4), 'l’obstacle doit interdire la case');
});
