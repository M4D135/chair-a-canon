#!/usr/bin/env python3
"""Construit CHAIR À CANON en une seule page HTML, sans dépendance ni fichier d'image ou de son.

    python3 construire.py

Écrit :
  dist/chair-a-canon.html   la page complète, à ouvrir telle quelle dans un navigateur ;
  SIZE.json                 tailles brute et compressée, empreinte, taille de chaque source.
Le moteur est vérifié module par module contre FERRO.lock.json (SHA256) avant l'assemblage.
"""
import gzip
import hashlib
import json
import pathlib
import re

ICI = pathlib.Path(__file__).resolve().parent
SRC = ICI / 'src'
DIST = ICI / 'dist'

# Ordre d'exécution : le moteur d'abord, puis le monde, les troupes, le combat, la caméra, la coque.
MODULES = [
    'ferro/renderer.js',
    'ferro/geometry.js',
    'ferro/fmath.js',
    'ferro/audio.js',
    'ferro/input.js',
    'ferro/engine.js',
    'relief.js',
    'decor.js',
    'corps.js',
    'troupe.js',
    'armes.js',
    'ia.js',
    'etincelles.js',
    'son.js',
    'vue.js',
    'coque.js',
    'main.js',
]

FICHIER_VERSION = ICI / 'VERSION.json'
FICHIER_VERROU = ICI / 'FERRO.lock.json'


def empreinte_sources():
    h = hashlib.sha256()
    for nom in MODULES:
        h.update(nom.encode('utf-8'))
        h.update((SRC / nom).read_bytes())
    h.update((SRC / 'style.css').read_bytes())
    h.update((SRC / 'index.html').read_bytes())
    return h.hexdigest()


def verifier_verrou():
    """Chaque module du moteur doit correspondre octet pour octet au verrou FERRO."""
    verrou = json.loads(FICHIER_VERROU.read_text(encoding='utf-8'))
    for module in verrou['modules']:
        chemin = ICI / module['path']
        if not chemin.exists():
            raise SystemExit(f"verrou FERRO : module absent {module['path']}")
        if hashlib.sha256(chemin.read_bytes()).hexdigest() != module['sha256']:
            raise SystemExit(f"verrou FERRO : {module['path']} ne correspond pas au SHA256 verrouillé")
    return verrou['version']


def resoudre_version():
    """La version suit les sources : empreinte nouvelle → cran +1 ; rien changé → même version."""
    empreinte = empreinte_sources()
    if FICHIER_VERSION.exists():
        donnees = json.loads(FICHIER_VERSION.read_text(encoding='utf-8'))
        if donnees.get('empreinte') == empreinte:
            return donnees['version'], empreinte
        base = donnees.get('version', '0.1')
        parts = base.split('.')
        parts[-1] = str(int(parts[-1]) + 1)
        return '.'.join(parts), empreinte
    return '0.1', empreinte


def main():
    version_moteur = verifier_verrou()
    version, empreinte = resoudre_version()
    gabarit = (SRC / 'index.html').read_text(encoding='utf-8')
    style = (SRC / 'style.css').read_text(encoding='utf-8')

    if gabarit.count('/*STYLE*/') != 1 or gabarit.count('<!--MODULES-->') != 1:
        raise SystemExit('index.html doit contenir une fois /*STYLE*/ et une fois <!--MODULES-->')
    if gabarit.count('__VERSION_JEU__') != 1:
        raise SystemExit('index.html doit contenir exactement un __VERSION_JEU__')

    page = gabarit.replace('/*STYLE*/', style.strip())
    page = page.replace('__VERSION_JEU__', version)

    morceaux = []
    tailles = {}
    for nom in MODULES:
        code = (SRC / nom).read_text(encoding='utf-8')
        if '</script' in code.lower():
            raise SystemExit(f'{nom} contient « </script » : la page serait coupée')
        tailles[nom] = len(code.encode('utf-8'))
        morceaux.append(f'<script>\n/* ==== {nom} ==== */\n{code}\n</script>')
    page = page.replace('<!--MODULES-->', '\n'.join(morceaux))

    DIST.mkdir(exist_ok=True)
    sortie = DIST / 'chair-a-canon.html'
    octets = page.encode('utf-8')
    sortie.write_bytes(octets)
    compresse = len(gzip.compress(octets, 9))

    FICHIER_VERSION.write_text(json.dumps({
        'version': version, 'empreinte': empreinte, 'moteur': version_moteur,
    }, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    (ICI / 'SIZE.json').write_text(json.dumps({
        'page': 'dist/chair-a-canon.html',
        'octets': len(octets), 'gzip': compresse,
        'sha256': hashlib.sha256(octets).hexdigest(),
        'moteur': version_moteur, 'sources': tailles,
    }, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    print(f"dist/chair-a-canon.html  v{version}  {len(octets):,} o  ({compresse:,} o gzip)  FERRO {version_moteur}")


if __name__ == '__main__':
    main()
