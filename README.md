# CHAIR À CANON

Jeu de guerre en vue de dessus, dans le navigateur, entièrement procédural : îles, tranchées, bunkers,
soldats et explosions sont fabriqués par le code. Moteur FERRO 0.3.3 (WebGL2), aucune image, aucun son
enregistré, aucune police chargée : une seule page HTML autonome. Hommage à *Cannon Fodder* (Amiga, 1993) :
le genre et les sensations, rien des dessins, noms ou musiques d'origine.

## Jouer

Ouvrir `dist/chair-a-canon.html` dans un navigateur récent avec WebGL2 (Chrome, Edge, Firefox, Safari 15+).
Pour reconstruire :

```bash
python3 construire.py
```

La construction vérifie d'abord les 33 modules du moteur contre `FERRO.lock.json` (SHA256), puis assemble la
page et écrit `SIZE.json` (tailles, empreinte). La version affichée au titre suit les sources (`VERSION.json`).

## Le jeu

- **Campagne** : des missions générées par graine — île, plage de départ, camp ennemi, tranchées, bunker,
  drapeau. À partir de la mission 2 : tourelles et roquettes ; mission 3 : champ de mines ; mission 4 : grenadiers.
- **Escouade** : quatre hommes, sélection au clic ou au cadre, groupes (Ctrl+1..4 / F1..F4). Une balle tue ;
  les grenades blessent dans un rayon. Les caisses vertes soignent, les oranges donnent des munitions.
- **Ordres** : clic gauche au sol pour avancer, sur un ennemi pour ouvrir le feu, clic droit maintenu pour
  arroser le curseur, G puis clic pour la grenade, R puis clic pour la roquette.
- **Caméra** : isométrique à 45°, zoom molette, déplacement WASD/bords/minicarte, Espace sur la sélection.
- **Procédural** : relief (bruit de valeur en fbm), nappes de triangles colorées, soldats assemblés en
  primitives FERRO, balles et grenades balistiques, explosions en particules, sons synthétisés par FAudio.

## Dépôt

```
src/ferro/     les 33 modules du moteur, identiques à M4D135/FERRO 0.3.3 (FERRO.lock.json)
src/*.js       le jeu : relief, décor, troupe, armes, IA, effets, son, caméra, coque, main
checks/        les tests Node (node --test checks/)
construire.py  l'assemblage en une page + vérification du verrou
tools/         verrouiller.py : recopie le moteur depuis un clone FERRO et régénère le verrou
```

## Tests

```bash
node --test checks/
```

Relief déterministe, balistique des grenades, IA (vue, alerte, tourelles), escouade et déroulé des missions.
