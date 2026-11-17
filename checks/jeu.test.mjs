import test from 'node:test';
import assert from 'node:assert/strict';
import { charger, ORDRE } from './harnais.mjs';

const B = charger(ORDRE);
const PAS = 1 / 60;

function jouer(secondes) {
  for (let k = 0; k < Math.round(secondes / PAS); k++) B.jeu.maj(PAS);
}

test('campagne : la mission 1 se monte avec quatre hommes et une garnison', () => {
  B.jeu.S.graine = 1234;
  B.jeu.lancerMission(1);
  const S = B.jeu.S;
  assert.equal(S.escouade.length, 4);
  assert.equal(S.escouade.filter(u => u.camp === 'bleu').length, 4);
  const rouges = S.etat.unites.filter(u => u.camp === 'rouge');
  assert.ok(rouges.length >= 6 && rouges.length <= 24, `garnison raisonnable (${rouges.length})`);
  assert.equal(S.etat.decor.drapeaux.length, 1);
  assert.ok(S.etat.decor.statiques.length > 50, 'le décor statique doit être riche');
});

test('campagne : même graine, même mission', () => {
  B.jeu.S.graine = 777;
  B.jeu.lancerMission(3);
  const a = Array.from(B.jeu.S.etat.relief.h);
  const rougesA = B.jeu.S.etat.unites.filter(u => u.camp === 'rouge').map(u => [u.x, u.z]);
  B.jeu.lancerMission(3);
  const b = Array.from(B.jeu.S.etat.relief.h);
  const rougesB = B.jeu.S.etat.unites.filter(u => u.camp === 'rouge').map(u => [u.x, u.z]);
  assert.deepEqual(a, b);
  assert.deepEqual(rougesA, rougesB);
});

test('campagne : la garnison vivante empêche le drapeau', () => {
  B.jeu.S.graine = 31;
  B.jeu.lancerMission(1);
  const S = B.jeu.S;
  const d = S.etat.decor.drapeaux[0];
  const u = S.selection[0];
  u.x = d.x; u.z = d.z;
  jouer(.5);
  assert.equal(d.pris, false, 'tant que la garnison vit, le drapeau résiste');
});

test('campagne : garnison morte, le drapeau se plante et la mission finit', () => {
  B.jeu.S.graine = 31;
  B.jeu.lancerMission(1);
  const S = B.jeu.S;
  for (const r of S.etat.unites) if (r.camp === 'rouge') B.troupe.tuer(r, S.etat.t);
  jouer(.5);
  assert.equal(S.drapeauActif, true, 'le drapeau doit devenir l’objectif');
  const d = S.etat.decor.drapeaux[0];
  const u = S.selection[0];
  u.x = d.x; u.z = d.z;
  u.drapeau = d;
  jouer(.5);
  assert.equal(d.pris, true);
  assert.notEqual(S.ecran, 'jeu', 'la mission doit se terminer');
});

test('campagne : une mine tue l’imprudent qui marche dessus', () => {
  B.jeu.S.graine = 5;
  B.jeu.lancerMission(3);
  const S = B.jeu.S;
  const m = S.etat.decor.mines[0];
  assert.ok(m, 'la mission 3 doit avoir un champ de mines');
  const u = S.selection[0];
  u.x = m.x; u.z = m.z;
  jouer(.3);
  assert.equal(m.sautee, true);
  assert.equal(u.etat, 'mort');
});

test('campagne : tous morts, une nouvelle section débarque et les vies baissent', () => {
  B.jeu.S.graine = 9;
  B.jeu.lancerMission(1);
  const S = B.jeu.S;
  S.vies = 3;
  for (const b of S.escouade) B.troupe.tuer(b, S.etat.t);
  jouer(3);
  assert.equal(S.vies, 2);
  assert.equal(S.escouade.filter(u => u.etat !== 'mort').length, 4, 'la relève doit être complète');
});

test('campagne : les caisses redonnent santé et munitions', () => {
  B.jeu.S.graine = 17;
  B.jeu.lancerMission(2);
  const S = B.jeu.S;
  const c = S.etat.decor.caisses.find(c => c.type === 'munitions');
  assert.ok(c, 'il faut au moins une caisse de munitions');
  const u = S.selection[0];
  u.x = c.x; u.z = c.z;
  const avant = S.escouade.reduce((s, b) => s + b.grenades, 0);
  u.cible = { x: c.x, z: c.z };
  u.caisse = c;
  jouer(.5);
  assert.equal(c.pris, true);
  assert.ok(S.escouade.reduce((s, b) => s + b.grenades, 0) > avant, 'les grenades doivent augmenter');
});

test('campagne : la sélection au clavier et les groupes', () => {
  B.jeu.S.graine = 23;
  B.jeu.lancerMission(1);
  const S = B.jeu.S;
  B.jeu.selectionUn(1);
  assert.equal(S.selection.length, 1);
  assert.equal(S.selection[0], S.escouade[1]);
  B.jeu.selectionTous();
  assert.equal(S.selection.length, 4);
  B.jeu.selectionUn(0);
  B.jeu.definirGroupe(3);
  B.jeu.selectionTous();
  B.jeu.selectionGroupe(3);
  assert.equal(S.selection.length, 1);
});

test('campagne : l’ordre d’avancer déplace l’escouade', () => {
  B.jeu.S.graine = 45;
  B.jeu.lancerMission(1);
  const S = B.jeu.S;
  const u = S.selection[0];
  const x0 = u.x, z0 = u.z;
  const cible = S.etat.relief.pointLibre(u.x + 6, u.z + 6, .38);
  u.cible = cible;
  for (let k = 0; k < 60 * 8; k++) B.jeu.maj(PAS);
  assert.ok(Math.hypot(u.x - cible.x, u.z - cible.z) < 1.2, 'l’homme doit rejoindre son point');
  assert.notEqual(u.x + u.z, x0 + z0);
});
