/* CHAIR À CANON — la coque technique : le canvas, le moteur FERRO (FRender), la boucle à pas fixe, les
   entrées (FInput pour le clavier, pointeurs pour la visée et le cadre de sélection). */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};
  if (typeof G.document === 'undefined') { B.main = { demarrer() {} }; return; }

  const S = () => B.jeu.S;
  let toile, rendu, entrees, curseur = { x: 0, y: 0 }, geste = null, cadreEl = null, dernierT = 0, accumulateur = 0;
  const TAN26 = Math.tan(26 * Math.PI / 360);
  const PAS = 1 / 60;

  function creerEntrees() {
    const actions = [
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
    // la liste blanche du moteur refuse Échap et les F : on l'étend pour la pause et les groupes
    const allowKey = code => /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Space|Enter|Backspace|Tab|Escape|F[1-9])$/.test(code);
    return G.FInput.create({ actions, device: 'keyboard', singlePad: true, menu: false, allowKey });
  }

  // Le geste à la Point de rupture : clic court = sélection, glisser = cadre, maintien = tir ;
  // clic droit = déplacement ; Alt+clic ou clic du milieu = la carte saisie à la main.
  function montrerCadre(x0, y0, x1, y1) {
    if (!cadreEl) cadreEl = document.getElementById('cadre');
    if (!cadreEl) return;
    cadreEl.hidden = false;
    Object.assign(cadreEl.style, { left: Math.min(x0, x1) + 'px', top: Math.min(y0, y1) + 'px', width: Math.abs(x1 - x0) + 'px', height: Math.abs(y1 - y0) + 'px' });
  }
  function cacherCadre() { if (cadreEl) cadreEl.hidden = true; }
  function reposerBords() {
    const b = S().cam && S().cam.bord;
    if (b) { b.n = b.s = b.o = b.e = false; }
  }

  function brancherPointeurs() {
    toile.addEventListener('contextmenu', e => e.preventDefault());
    toile.addEventListener('pointerdown', e => {
      S().son && S().son.demarrer();
      try { toile.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché : le geste suit sans capture */ }
      const r = toile.getBoundingClientRect();
      curseur.x = e.clientX - r.left; curseur.y = e.clientY - r.top;
      const cam = S().cam;
      if (!cam || S().ecran !== 'jeu') return;
      if (e.button === 1 || (e.button === 0 && e.altKey)) { reposerBords(); geste = { type: 'carte', prise: cam.saisir(curseur.x, curseur.y) }; e.preventDefault(); return; }
      if (e.button === 2) { const f = frapperCurseur(); if (f) B.jeu.ordreClic(f, curseur.x, curseur.y); return; }
      if (e.button === 0) geste = { type: 'attente', x0: curseur.x, y0: curseur.y, t0: performance.now() };
    });
    toile.addEventListener('pointermove', e => {
      const r = toile.getBoundingClientRect();
      curseur.x = e.clientX - r.left; curseur.y = e.clientY - r.top;
      const cam = S().cam;
      if (!cam) return;
      if (!geste && cam.bord) {
        cam.bord.n = curseur.y < 14; cam.bord.s = curseur.y > r.height - 14;
        cam.bord.o = curseur.x < 14; cam.bord.e = curseur.x > r.width - 14;
      }
      if (!geste) return;
      if (geste.type === 'carte') { cam.tenir(geste.prise, curseur.x, curseur.y); return; }
      if (geste.type === 'attente') {
        if (Math.hypot(curseur.x - geste.x0, curseur.y - geste.y0) > 6) { reposerBords(); geste.type = 'cadre'; montrerCadre(geste.x0, geste.y0, curseur.x, curseur.y); }
        else if (performance.now() - geste.t0 > 150 && !S().mode) { reposerBords(); geste.type = 'tir'; tirerAuCurseur(); }
        return;
      }
      if (geste.type === 'cadre') { montrerCadre(geste.x0, geste.y0, curseur.x, curseur.y); return; }
      if (geste.type === 'tir') tirerAuCurseur();
    });
    const fin = e => {
      if (!geste) return;
      if (e.type === 'pointercancel') { if (geste.type === 'tir') B.jeu.ordreTirOuvert(null); cacherCadre(); geste = null; return; }
      if ((geste.type === 'tir' || geste.type === 'cadre' || geste.type === 'attente') && e.button !== 0) return;
      if (geste.type === 'carte') { geste = null; return; }
      if (geste.type === 'tir') { B.jeu.ordreTirOuvert(null); geste = null; return; }
      if (geste.type === 'cadre') { cacherCadre(); B.jeu.selectionCadre(geste.x0, geste.y0, curseur.x, curseur.y); geste = null; return; }
      if (geste.type === 'attente') {
        const f = frapperCurseur();
        if (S().mode) B.jeu.poserProjectile(f);
        else B.jeu.selectionClic(f, curseur.x, curseur.y, e.shiftKey);
        geste = null;
      }
    };
    toile.addEventListener('pointerup', fin);
    toile.addEventListener('pointercancel', fin);
    toile.addEventListener('wheel', e => {
      e.preventDefault();
      const cam = S().cam;
      if (!cam) return;
      const r = toile.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const ligne = e.deltaMode === 1, dy = ligne ? e.deltaY * 33 : e.deltaY, dx = ligne ? e.deltaX * 33 : e.deltaX;
      const molette = ligne || (e.deltaX === 0 && e.wheelDeltaY && Math.abs(e.wheelDeltaY) % 120 === 0);
      if (e.ctrlKey) cam.zoomer(Math.exp(dy * .01), x, y);
      else if (e.shiftKey) cam.tourner((dy || dx) * .004);
      else if (molette) cam.zoomer(Math.pow(1.18, Math.sign(dy) * Math.min(4, Math.abs(dy) / 100 || 1)), x, y);
      else {
        // deux doigts sur le pavé : la carte suit les doigts
        const k = 2 * (cam.derniere ? cam.derniere.D : 30) * TAN26 / (toile.clientHeight || 600);
        cam.glisser(dx * k, -dy * k);
      }
    }, { passive: false });
    G.addEventListener('keydown', e => {
      const champ = e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.isContentEditable);
      if (entrees && !champ) entrees.keyDown(e.code, performance.now() / 1000, e.repeat, e.key);
      if (e.ctrlKey && /^Digit[1-4]$/.test(e.code)) { e.preventDefault(); B.jeu.definirGroupe(+e.code.slice(5)); }
      if (/^F[1-4]$/.test(e.code)) B.jeu.selectionGroupe(+e.code.slice(1));
      const cam = S().cam;
      if (cam && !champ && !e.ctrlKey && !e.metaKey) {
        const nom = B.vue.CLAVIER[e.code];
        if (nom) { cam.touche(nom, true); e.preventDefault(); }
      }
    });
    G.addEventListener('keyup', e => {
      if (entrees) entrees.keyUp(e.code);
      const cam = S().cam, nom = cam && B.vue.CLAVIER[e.code];
      if (nom) cam.touche(nom, false);
    });
    G.addEventListener('blur', () => { B.jeu.ordreTirOuvert(null); cacherCadre(); geste = null; if (entrees) entrees.clear(); S().cam && S().cam.relacher(); });
  }

  function frapperCurseur() {
    const s = S();
    if (!s.etat || !s.cam) return null;
    return B.vue.curseur(s.cam, s.etat.relief, curseur.x, curseur.y, s.etat.unites);
  }

  function tirerAuCurseur() {
    const frappe = frapperCurseur();
    if (frappe) B.jeu.ordreTirOuvert({ x: frappe.x, z: frappe.z });
  }

  function pollEntrees() {
    // maintien sans bouger : le geste bascule en tir, même si la souris ne tremble pas
    if (geste && geste.type === 'attente' && !S().mode && performance.now() - geste.t0 > 150) {
      reposerBords(); geste.type = 'tir'; tirerAuCurseur();
    }
    if (!entrees) return;
    const f = entrees.frame();
    const s = S();
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
