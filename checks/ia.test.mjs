import test from 'node:test';
import assert from 'node:assert/strict';
import { charger, plateau, unit } from './harnais.mjs';

const B = charger(['relief.js', 'decor.js', 'troupe.js', 'armes.js', 'ia.js', 'etincelles.js']);

function etatDeTest(relief) {
  return {
    t: 0, relief, decor: { mines: [], tourelles: [], caisses: [], drapeaux: [] }, unites: [], projectiles: [],
    bruits: [], rng: B.relief.rng(555), stats: { tues: {} }, quand: {}
  };
}
const PAS = 1 / 60;
function tourner(etat, secondes) {
  for (let k = 0; k < Math.round(secondes / PAS); k++) { etat.t += PAS; B.ia.maj(etat, PAS); B.armes.maj(etat, PAS); }
}

test('IA : un rouge qui voit un bleu entre en combat et tire', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  const rouge = unit(B, relief, 'rouge', 30, 32, { dir: Math.PI / 2 });
  const bleu = unit(B, relief, 'bleu', 36, 32);
  bleu.vie = 1e9; // témoin increvable : on observe le comportement, pas le résultat
  etat.unites.push(rouge, bleu);
  let tirs = 0;
  etat.quand.tirEnnemi = () => { tirs++; };
  tourner(etat, .4);
  assert.equal(rouge.etat, 'combat', 'le rouge doit entrer en combat');
  tourner(etat, 2.5);
  assert.ok(tirs > 0, 'le rouge doit avoir ouvert le feu');
});

test('IA : un mur coupe la vue — le rouge ne voit pas le bleu derrière', () => {
  const relief = plateau(B);
  relief.ajouterObstacle({ x: 33, z: 32, r: 1.6, h: 4, bloqueMarche: true, bloqueTir: true });
  const etat = etatDeTest(relief);
  const rouge = unit(B, relief, 'rouge', 30, 32, { dir: Math.PI / 2 });
  const bleu = unit(B, relief, 'bleu', 36, 32);
  etat.unites.push(rouge, bleu);
  tourner(etat, 1.5);
  assert.notEqual(rouge.etat, 'combat');
});

test('IA : le bruit alerte et fait avancer vers la dernière position vue', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  const rouge = unit(B, relief, 'rouge', 30, 32, { dir: 0 });
  etat.unites.push(rouge);
  etat.bruits.push({ x: 40, z: 32, fort: true });
  B.ia.maj(etat, PAS);
  assert.ok(rouge.alerte > 0, 'le rouge doit être alerté');
  assert.ok(rouge.derniereVue, 'le rouge doit avoir mémorisé le bruit');
});

test('IA : le grenadier lance une grenade sur un bleu à portée', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  const grenadier = unit(B, relief, 'rouge', 30, 32, { dir: Math.PI / 2 });
  grenadier.arme = 'grenadier'; grenadier.grenades = 3;
  const bleu = unit(B, relief, 'bleu', 40, 32);
  bleu.vie = 1e9; // invincible : on veut voir la cloche, pas la curée
  etat.unites.push(grenadier, bleu);
  let lance = false;
  etat.quand.grenadeEnnemie = () => { lance = true; };
  for (let k = 0; k < 60 * 20 && !lance; k++) { etat.t += PAS; B.ia.maj(etat, PAS); B.armes.maj(etat, PAS); }
  assert.ok(lance || grenadier.grenades < 3, 'le grenadier doit finir par armer une cloche');
});

test('IA : la tourelle pivote et tire sur un bleu à découvert', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  etat.decor.tourelles.push({ x: 30, z: 32, y: relief.hauteur(30, 32), angle: Math.PI, cooldown: 0, vivante: true, cible: null });
  const bleu = unit(B, relief, 'bleu', 38, 32);
  etat.unites.push(bleu);
  tourner(etat, 3);
  const t = etat.decor.tourelles[0];
  const vise = Math.atan2(bleu.x - t.x, bleu.z - t.z);
  let e = t.angle - vise; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
  assert.ok(Math.abs(e) < .3, 'la tourelle doit s’être alignée sur la cible');
  assert.ok(etat.projectiles.some(p => p.camp === 'rouge') || bleu.etat === 'mort');
});

test('IA : la patrouille reste dans le camp', () => {
  const relief = plateau(B);
  const etat = etatDeTest(relief);
  const rouge = unit(B, relief, 'rouge', 32, 32);
  etat.unites.push(rouge);
  tourner(etat, 30);
  assert.ok(Math.hypot(rouge.x - 32, rouge.z - 32) < 22, 'le patrouilleur ne doit pas désertér le camp');
});
