/* Harnais commun : charge les modules du jeu dans globalThis, comme le ferait la page assemblée. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function charger(noms) {
  for (const nom of noms) {
    const code = readFileSync(path.join(RACINE, 'src', nom), 'utf-8');
    vm.runInThisContext(code, { filename: nom });
  }
  return globalThis.CAC;
}

export const ORDRE = ['relief.js', 'decor.js', 'troupe.js', 'armes.js', 'ia.js', 'etincelles.js', 'son.js', 'vue.js', 'coque.js'];

export function aplatirDur(relief, x, z, r, alt) {
  const n = relief.n, pas = relief.pas;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (Math.hypot(i * pas - x, j * pas - z) <= r) relief.h[j * n + i] = alt;
  }
}

export function plateau(B, opt = {}) {
  const relief = B.relief.creer({ graine: opt.graine || 4242, taille: opt.taille || 64 });
  aplatirDur(relief, 32, 32, opt.rayon || 26, opt.alt || 2);
  return relief;
}

export function unit(B, relief, camp, x, z, extra) {
  const u = B.troupe.creer(Object.assign({ camp, x, z }, extra || {}));
  return u;
}
