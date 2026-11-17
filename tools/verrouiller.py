#!/usr/bin/env python3
"""Recopie le moteur depuis un clone FERRO et régénère FERRO.lock.json.

    python3 tools/verrouiller.py ../ferro

Chaque module est copié à l'octet près ; le verrou enregistre l'identifiant, le chemin et le SHA256.
Le jeu ne retouche jamais src/ferro : une retouche locale se marque dans le dépôt du jeu, pas ici.
"""
import hashlib
import json
import pathlib
import shutil
import sys

ICI = pathlib.Path(__file__).resolve().parent.parent

ids = {
    'fmath.js': 'math', 'renderer.js': 'render', 'webgpu-shaders.js': 'webgpu-shaders',
    'webgpu-renderer.js': 'webgpu', 'backends.js': 'backends', 'geometry.js': 'geometry',
    'materials.js': 'materials', 'audio.js': 'audio', 'input.js': 'input', 'effects.js': 'effects',
    'motion.js': 'motion', 'engine.js': 'host', 'music.js': 'music', 'imuse.js': 'imuse',
    'navigation.js': 'navigation', 'physics.js': 'physics', 'physx.js': 'physx',
    'physx-runtime.js': 'physxRuntime', 'physics-geometry.js': 'physics-geometry',
    'vehicle-dynamics.js': 'vehicle-dynamics', 'destruction.js': 'destruction', 'crowd.js': 'crowd',
    'crowd-webgpu.js': 'crowd-webgpu', 'recipes.js': 'recipes', 'surface.js': 'surface',
    'gpu-profile.js': 'gpu-profile', 'skies.js': 'skies', 'reflections.js': 'reflections',
    'passages.js': 'passages', 'brain.js': 'brain', 'loop.js': 'loop', 'schedule.js': 'schedule',
    'jobs.js': 'jobs',
}


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    source = pathlib.Path(sys.argv[1]).resolve()
    src_ferro = source / 'src' / 'ferro'
    if not src_ferro.is_dir():
        raise SystemExit(f'pas de clone FERRO ici : {source}')
    manifeste = json.loads((source / 'FERRO.json').read_text(encoding='utf-8'))
    version = manifeste['version']

    dest = ICI / 'src' / 'ferro'
    dest.mkdir(parents=True, exist_ok=True)
    mods = []
    for f in sorted(src_ferro.glob('*.js')):
        if f.name == 'demo.js':
            continue
        shutil.copyfile(f, dest / f.name)
        mods.append({'id': ids[f.name], 'path': f'src/ferro/{f.name}',
                     'sha256': hashlib.sha256((dest / f.name).read_bytes()).hexdigest()})
    verrou = {'format': 'ferro-lock', 'version': version,
              'reference': 'M4D135/FERRO:src/ferro', 'game': 'chair-a-canon', 'modules': mods}
    (ICI / 'FERRO.lock.json').write_text(json.dumps(verrou, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{len(mods)} modules FERRO {version} recopiés et verrouillés')


if __name__ == '__main__':
    main()
