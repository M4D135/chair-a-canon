/* CHAIR À CANON — la coque technique : le canvas, le moteur FERRO (FRender), la boucle à pas fixe, les
   entrées (FInput pour le clavier, pointeurs pour la visée et le cadre de sélection). */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};
  if (typeof G.document === 'undefined') { B.main = { demarrer() {} }; return; }

  const S = () => B.jeu.S;
  let toile, rendu, entrees, boutonDroit = false, curseur = { x: 0, y: 0 }, glisse = null, dernierT = 0, accumulateur = 0;
  const PAS = 1 / 60;

  function creerEntrees() {
    const actions = [
      { id: 'haut', label: 'Haut', type: 'hold', keys: ['KeyW', 'ArrowUp'], touch: '↑' },
      { id: 'bas', label: 'Bas', type: 'hold', keys: ['KeyS', 'ArrowDown'], touch: '↓' },
      { id: 'gauche', label: 'Gauche', type: 'hold', keys: ['KeyA', 'ArrowLeft'], touch: '←' },
      { id: 'droite', label: 'Droite', type: 'hold', keys: ['KeyD', 'ArrowRight'], touch: '→' },
      { id: 'un', label: 'Homme 1', type: 'press', keys: ['Digit1'] },
      { id: 'deux', label: 'Homme 2', type: 'press', keys: ['Digit2'] },
      { id: 'trois', label: 'Homme 3', type: 'press', keys: ['Digit3'] },
      { id: 'quatre', label: 'Homme 4', type: 'press', keys: ['Digit4'] },
      { id: 'tous', label: 'Tous', type: 'press', keys: ['KeyT'] },
      { id: 'grenade', label: 'Grenade', type: 'press', keys: ['KeyG'] },
      { id: 'roquette', label: 'Roquette', type: 'press', keys: ['KeyR'] },
      { id: 'centrer', label: 'Centrer', type: 'press', keys: ['Space'] },
      { id: 'pause', label: 'Pause', type: 'press', keys: ['Escape'] }
    ];
    return G.FInput.create({ actions, device: 'keyboard', singlePad: true, menu: false });
  }

  function brancherPointeurs() {
    toile.addEventListener('contextmenu', e => e.preventDefault());
    toile.addEventListener('pointerdown', e => {
      B.jeu.S.son && B.jeu.S.son.demarrer();
      toile.setPointerCapture(e.pointerId);
      const r = toile.getBoundingClientRect();
      curseur.x = e.clientX - r.left; curseur.y = e.clientY - r.top;
      if (e.button === 2) { boutonDroit = true; tirerDroit(); return; }
      if (e.button === 0) glisse = { x0: curseur.x, y0: curseur.y, x1: curseur.x, y1: curseur.y };
    });
    toile.addEventListener('pointermove', e => {
      const r = toile.getBoundingClientRect();
      curseur.x = e.clientX - r.left; curseur.y = e.clientY - r.top;
      if (glisse) { glisse.x1 = curseur.x; glisse.y1 = curseur.y; }
      // les bords de l'écran font glisser la caméra
      const b = S().cam && S().cam.bord;
      if (b) {
        b.n = curseur.y < 14; b.s = curseur.y > r.height - 14;
        b.o = curseur.x < 14; b.e = curseur.x > r.width - 14;
      }
      if (boutonDroit) tirerDroit();
    });
    toile.addEventListener('pointerup', e => {
      const r = toile.getBoundingClientRect();
      if (e.button === 2) { boutonDroit = false; B.jeu.ordreTirOuvert(null); return; }
      if (e.button !== 0 || !glisse) return;
      const dx = Math.abs(glisse.x1 - glisse.x0), dy = Math.abs(glisse.y1 - glisse.y0);
      if (dx > 8 || dy > 8) B.jeu.selectionCadre(glisse.x0, glisse.y0, glisse.x1, glisse.y1);
      else {
        const frappe = frapperCurseur();
        B.jeu.ordreClic(frappe, curseur.x, curseur.y);
      }
      glisse = null;
    });
    toile.addEventListener('wheel', e => {
      e.preventDefault();
      const cam = S().cam;
      if (cam) cam.dist = Math.max(16, Math.min(64, cam.dist + Math.sign(e.deltaY) * 3));
    }, { passive: false });
    G.addEventListener('keydown', e => {
      if (entrees) entrees.keyDown(e.code, performance.now() / 1000, e.repeat, e.key);
      if (e.ctrlKey && /^Digit[1-4]$/.test(e.code)) { e.preventDefault(); B.jeu.definirGroupe(+e.code.slice(5)); }
      if (/^F[1-4]$/.test(e.code)) B.jeu.selectionGroupe(+e.code.slice(1));
    });
    G.addEventListener('keyup', e => { if (entrees) entrees.keyUp(e.code); });
    G.addEventListener('blur', () => { boutonDroit = false; B.jeu.ordreTirOuvert(null); if (entrees) entrees.clear(); });
  }

  function frapperCurseur() {
    const s = S();
    if (!s.etat || !s.cam) return null;
    return B.vue.curseur(s.cam, s.etat.relief, curseur.x, curseur.y, s.etat.unites);
  }

  function tirerDroit() {
    const frappe = frapperCurseur();
    if (frappe) B.jeu.ordreTirOuvert({ x: frappe.x, z: frappe.z });
  }

  function pollEntrees() {
    if (!entrees) return;
    const f = entrees.frame(), a = entrees.step();
    const s = S();
    if (s.cam) {
      s.cam.bord.n = s.cam.bord.n || !!a.haut; s.cam.bord.s = s.cam.bord.s || !!a.bas;
      s.cam.bord.o = s.cam.bord.o || !!a.gauche; s.cam.bord.e = s.cam.bord.e || !!a.droite;
    }
    for (const id of f.pressed) {
      if (id === 'un') B.jeu.selectionUn(0);
      else if (id === 'deux') B.jeu.selectionUn(1);
      else if (id === 'trois') B.jeu.selectionUn(2);
      else if (id === 'quatre') B.jeu.selectionUn(3);
      else if (id === 'tous') B.jeu.selectionTous();
      else if (id === 'grenade') { B.jeu.S.mode = B.jeu.S.mode === 'grenade' ? null : 'grenade'; B.jeu.message(B.jeu.S.mode ? 'Grenade — cliquez au point visé' : ''); }
      else if (id === 'roquette') { B.jeu.S.mode = B.jeu.S.mode === 'roquette' ? null : 'roquette'; B.jeu.message(B.jeu.S.mode ? 'Roquette — cliquez au point visé' : ''); }
      else if (id === 'centrer') {
        const sel = B.jeu.S.selection;
        if (sel.length && s.cam) {
          s.cam.cibleX = sel.reduce((a2, u) => a2 + u.x, 0) / sel.length;
          s.cam.cibleZ = sel.reduce((a2, u) => a2 + u.z, 0) / sel.length;
        }
      } else if (id === 'pause') {
        if (s.ecran === 'jeu') { s.ecran = 'pause'; const p = document.getElementById('pause'); if (p) p.classList.remove('cache'); }
        else if (s.ecran === 'pause') { s.ecran = 'jeu'; const p = document.getElementById('pause'); if (p) p.classList.add('cache'); }
      }
    }
  }

  function image(t) {
    const s = S();
    if (!rendu || !s.etat) return;
    const sortie = [];
    B.jeu.mailler(sortie);
    const cam = B.vue.camera3d(s.cam, s.etat.relief);
    rendu.draw(cam, sortie, {
      time: t / 1000, shadows: true, bloom: true, torch: false, sunOnly: true,
      adaptive: false, frameMs: 16.7, shake: s.cam.secousse
    });
  }

  function boucle(t) {
    G.requestAnimationFrame(boucle);
    const dt = Math.min(.1, (t - dernierT) / 1000 || 0);
    dernierT = t;
    pollEntrees();
    accumulateur += dt;
    let garde = 0;
    while (accumulateur >= PAS && garde++ < 6) { B.jeu.maj(PAS); accumulateur -= PAS; }
    if (S().etat) image(t);
  }

  function demarrer() {
    toile = document.getElementById('ecran');
    if (!toile || typeof G.FRender === 'undefined') return;
    rendu = G.FRender.create(toile, { msaa: 4, shadowMapScale: 2, reflections: false, sea: false });
    rendu.resize(Math.min(G.devicePixelRatio || 1, 1.75));
    B.jeu.S.toile = toile;
    B.jeu.S.rendu = rendu;
    B.jeu.S.son = B.son.creer();
    entrees = creerEntrees();
    brancherPointeurs();
    B.jeu.brancherDom();
    B.jeu.ecranTitre();
    G.requestAnimationFrame(boucle);
  }

  B.main = { demarrer, boucle };
  G.addEventListener('load', demarrer);
})(typeof window !== 'undefined' ? window : globalThis);
