import test from 'node:test';
import assert from 'node:assert/strict';
import { charger, plateau, unit } from './harnais.mjs';

const B = charger(['relief.js', 'decor.js', 'troupe.js', 'armes.js', 'ia.js', 'etincelles.js']);

function etatDeTest(relief) {
  return {
    t: 0, relief, decor: { mines: [], tourelles: [], caisses: [], drapeaux: [] }, unites: [], projectiles: [],
    bruits: [], rng: B.relief.rng(999), stats: { tues: {} }, quand: {}
  };
}

const PAS = 1 / 60;
function avancer(etat, secondes) {
  for (let k = 0; k < Math.round(secondes / PAS); k++) { etat.t += PAS; B.armes.maj(etat, PAS); }
}

test('mitrailleuse : une balle tue un homme à découvert', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  const tireur = unit(B, relief, 'bleu', 28, 32);
  const cible = unit(B, relief, 'rouge', 38, 32);
  tireur.dirTir = Math.PI / 2;
  etat.unites.push(tireur, cible);
  B.armes.tirerMg(etat, tireur, { x: 38, y: relief.hauteur(38, 32) + .95, z: 32 }, relief, false);
  avancer(etat, .5);
  assert.equal(cible.etat, 'mort');
});

test('mitrailleuse : un mur de sacs arrête la balle', () => {
  const relief = plateau(B);
  relief.ajouterObstacle({ x: 33, z: 32, r: 1, h: 3, bloqueMarche: true, bloqueTir: true });
  const etat = etatDeTest(relief);
  const tireur = unit(B, relief, 'bleu', 28, 32);
  const cible = unit(B, relief, 'rouge', 38, 32);
  tireur.dirTir = Math.PI / 2;
  etat.unites.push(tireur, cible);
  B.armes.tirerMg(etat, tireur, { x: 38, y: relief.hauteur(38, 32) + .95, z: 32 }, relief, false);
  avancer(etat, .5);
  assert.equal(cible.etat, 'garde');
  assert.equal(etat.projectiles.length, 0);
});

test('grenade : elle éclot près du point visé et tue dans son rayon', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  const tireur = unit(B, relief, 'bleu', 26, 32);
  const cible = unit(B, relief, 'rouge', 36, 32);
  tireur.grenades = 2;
  etat.unites.push(tireur, cible);
  assert.ok(B.armes.tirerGrenade(etat, tireur, { x: 36, z: 32 }, relief));
  assert.equal(tireur.grenades, 1);
  avancer(etat, 3);
  assert.equal(cible.etat, 'mort', 'la grenade doit avoir tué la cible');
  assert.equal(etat.projectiles.length, 0);
});

test('grenade : elle tombe à moins de trois mètres du point visé', () => {
  const relief = plateau(B);
  let pire = 0;
  for (let k = 0; k < 10; k++) {
    const etat = etatDeTest(relief);
    const tireur = unit(B, relief, 'bleu', 24, 32);
    tireur.grenades = 1;
    etat.unites.push(tireur);
    let ex = null, ez = null;
    etat.quand.explosion = (x, y, z) => { ex = x; ez = z; };
    B.armes.tirerGrenade(etat, tireur, { x: 39, z: 32 }, relief);
    avancer(etat, 3);
    assert.ok(ex !== null, 'la grenade doit éclater');
    pire = Math.max(pire, Math.hypot(ex - 39, ez - 32));
  }
  assert.ok(pire < 3, `pire écart ${pire.toFixed(2)} m — la cloche doit rester utile`);
});

test('roquette : explosion au contact, blessure dans le rayon', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  const tireur = unit(B, relief, 'bleu', 26, 32);
  const cible = unit(B, relief, 'rouge', 36, 32);
  tireur.roquettes = 1;
  etat.unites.push(tireur, cible);
  assert.ok(B.armes.tirerRoquette(etat, tireur, { x: 36, y: relief.hauteur(36, 32) + .8, z: 32 }, relief));
  avancer(etat, 2);
  assert.ok(cible.etat === 'mort' || cible.vie < 100, 'le souffle doit tuer ou blesser');
});

test('souffle : la bombe touche les deux camps', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  const bleu = unit(B, relief, 'bleu', 32.4, 32);
  const rouge = unit(B, relief, 'rouge', 31.6, 32);
  etat.unites.push(bleu, rouge);
  B.armes.explosion(etat, 32, relief.hauteur(32, 32) + .2, 32, 4.4);
  assert.ok(bleu.vie < 100 && rouge.vie < 100);
});

test('chaîne de mines : une explosion fait sauter la mine voisine', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  etat.decor.mines.push({ x: 32, z: 32, sautee: false }, { x: 35, z: 32, sautee: false });
  let n = 0;
  etat.quand.explosion = () => { n++; };
  B.armes.explosion(etat, 32, relief.hauteur(32, 32) + .1, 32, 3.6);
  assert.equal(etat.decor.mines[0].sautee, true);
  assert.equal(etat.decor.mines[1].sautee, true);
  assert.ok(n >= 2, 'les deux mines doivent déclencher leur effet');
});
