/* CHAIR À CANON — la coque : la campagne, l'escouade, les ordres, le HUD, la minicarte et le déroulé des
   missions. L'état S est unique ; la simulation (armes, IA, effets) tourne à pas fixe dans maj(). */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};

  const NB = 4, VIES_DEPART = 3;
  const FORMATION = [[0, 0], [1.35, .35], [-1.35, .35], [.15, 1.5]];

  const S = {
    ecran: 'titre', mission: 1, vies: VIES_DEPART, graine: (Date.now() & 0xffff) || 7,
    etat: null, cam: null, sys: null, son: null, rendu: null, dom: null,
    mode: null, droit: null, cadre: null, message: null, messageT: 0,
    respawn: 0, drapeauActif: false, statsMission: null, cumul: { tu: 0, tirs: 0, touches: 0, missions: 0 }
  };

  function dom(id) { return G.document ? G.document.getElementById(id) : null; }

  function brancherDom() {
    if (S.dom || !G.document) return;
    const d = S.dom = {
      hud: dom('hud'), mission: dom('hud-mission'), ennemis: dom('hud-ennemis'), vies: dom('hud-vies'),
      armes: dom('hud-armes'), msg: dom('hud-msg'), escouade: dom('escouade'), mini: dom('minicarte'),
      titre: dom('titre'), regles: dom('regles'), voile: dom('voile'), voileT: dom('voile-texte'), voileS: dom('voile-sous'),
      pause: dom('pause'), bilan: dom('bilan'), bilanT: dom('bilan-titre'), bilanL: dom('bilan-lignes'), bilanN: dom('bilan-note')
    };
    d.escouade.innerHTML = '';
    d.portraits = [];
    for (let k = 0; k < NB; k++) {
      const p = G.document.createElement('div');
      p.className = 'portrait';
      p.innerHTML = '<span class="numero">' + (k + 1) + '</span><span class="bonnet"></span><span class="sante"><i></i></span>';
      d.escouade.appendChild(p);
      d.portraits.push(p);
    }
    const clic = (id, f) => { const e = dom(id); if (e) e.addEventListener('click', f); };
    clic('btn-campagne', () => { S.son && S.son.demarrer(); S.son && S.son.ui(); nouvelleCampagne(); });
    clic('btn-regles', () => { d.regles.classList.remove('cache'); });
    clic('btn-regles-retour', () => { d.regles.classList.add('cache'); });
    clic('btn-reprendre', () => { S.ecran = 'jeu'; d.pause.classList.add('cache'); });
    clic('btn-abandonner', () => { d.pause.classList.add('cache'); ecranTitre(); });
    clic('btn-bilan', () => {
      d.bilan.classList.add('cache');
      if (S.ecran === 'bilan-fin') ecranTitre();
      else { S.mission++; lancerMission(S.mission); }
    });
    if (d.mini) {
      // comme dans Point de rupture : clic, déplacer la vue ; glisser, la suivre
      const viserIci = e => {
        const r = d.mini.getBoundingClientRect();
        S.cam.viser((e.clientX - r.left) / r.width * S.etat.relief.taille, (e.clientY - r.top) / r.height * S.etat.relief.taille);
      };
      let glisseMini = false;
      d.mini.addEventListener('pointerdown', e => { glisseMini = true; d.mini.setPointerCapture(e.pointerId); viserIci(e); });
      d.mini.addEventListener('pointermove', e => { if (glisseMini) viserIci(e); });
      const fin = () => { glisseMini = false; };
      d.mini.addEventListener('pointerup', fin);
      d.mini.addEventListener('pointercancel', fin);
    }
  }

  function ecranTitre() {
    S.ecran = 'titre'; S.etat = null;
    if (S.dom) { S.dom.titre.classList.remove('cache'); S.dom.hud.classList.add('cache'); S.dom.pause.classList.add('cache'); S.dom.bilan.classList.add('cache'); }
    if (S.son) S.son.enJeu(false);
  }

  function nouvelleCampagne() {
    S.mission = 1; S.vies = VIES_DEPART;
    S.graine = (Math.random() * 65535) | 0;
    S.cumul = { tu: 0, tirs: 0, touches: 0, missions: 0 };
    lancerMission(1);
  }

  function lancerMission(numero) {
    brancherDom();
    S.ecran = 'jeu'; S.mode = null; S.droit = null; S.cadre = null; S.drapeauActif = false; S.respawn = 0;
    const graine = (S.graine * 31 + numero * 7919) >>> 0;
    const relief = B.relief.creer({ graine, taille: 96 });
    const decor = B.decor.generer(relief, graine, numero);
    const sys = B.etincelles.creer();
    const etat = S.etat = {
      t: 0, relief, decor, sys, unites: [], projectiles: [], bruits: [],
      rng: B.relief.rng(graine ^ 0x5bf03635),
      stats: { tues: {}, tirs: 0, touches: 0, grenades: 0, debut: performance.now() },
      quand: {}
    };
    S.sys = sys;
    etat.quand = {
      explosion(x, y, z, r) {
        B.etincelles.explosion(sys, x, y, z, r, etat.rng);
        S.son && S.son.explosion(x, S.cam);
        etat.bruits.push({ x, z, fort: true });
        for (const tr of decor.tourelles) {
          if (tr.vivante && Math.hypot(x - tr.x, z - tr.z) < r + 1) {
            tr.vivante = false;
            B.etincelles.explosion(sys, tr.x, tr.y + .8, tr.z, 2.2, etat.rng);
          }
        }
      },
      rebond() {},
      impact(p, u, frappe) {
        if (u) {
          B.etincelles.sang(sys, u.x, relief.hauteur(u.x, u.z), u.z, etat.rng);
          S.son && S.son.impact(u.x, S.cam);
          if (p.camp === 'bleu') etat.stats.touches++;
        } else if (frappe) B.etincelles.impact(sys, frappe.x, frappe.y, frappe.z, etat.rng);
      },
      mort(u) {
        S.son && S.son.mort(u.x, S.cam);
        if (u.camp === 'rouge') S.cumul.tu++;
      },
      blesse() { S.son && S.son.blesse(); },
      tirEnnemi(u) { S.son && S.son.tirEnnemi(u.x, S.cam); },
      grenadeEnnemie(u) { S.son && S.son.grenade(u.x, S.cam); }
    };

    // l'escouade bleue, sur la plage
    const escouade = [];
    for (let k = 0; k < NB; k++) {
      const p = relief.pointLibre(decor.spawn.x + (k % 2) * 1.4 - .7, decor.spawn.z - 1.5 + Math.floor(k / 2) * 1.4, .4);
      const u = B.troupe.creer({ camp: 'bleu', x: p.x, z: p.z, dir: Math.PI, groupe: k < 2 ? 1 : 2 });
      u.grenades = k < 2 ? 2 : 1;
      if (numero >= 2 && k === 0) { u.arme = 'bazooka'; u.roquettes = numero >= 2 ? 2 : 0; }
      escouade.push(u);
    }
    S.escouade = escouade;
    S.selection = escouade.slice();
    for (const u of S.selection) u.selectionne = true;
    etat.unites.push.apply(etat.unites, escouade);

    // la garnison : fantassins le long des tranchées et du camp, grenadiers dès la mission 4, tireur sur la tour
    const r = etat.rng;
    const nb = Math.min(22, 5 + numero * 3);
    for (let k = 0; k < nb; k++) {
      const ang = r() * Math.PI * 2, d = 4 + r() * 13;
      const p = relief.pointLibre(decor.camp.x + Math.cos(ang) * d, decor.camp.z + Math.sin(ang) * d, .4);
      if (!p) continue;
      const u = B.troupe.creer({ camp: 'rouge', x: p.x, z: p.z, dir: ang + Math.PI, vitesse: 1.7 });
      if (numero >= 4 && k % 5 === 4) { u.arme = 'grenadier'; u.grenades = 3; }
      etat.unites.push(u);
    }
    if (decor.tours.length) {
      const t = decor.tours[0];
      const u = B.troupe.creer({ camp: 'rouge', x: t.x + .1, z: t.z + .1, dir: Math.PI, vitesse: 0 });
      u.tour = t;
      u.alt = t.y - relief.hauteur(t.x, t.z);
      etat.unites.push(u);
    }

    // le monde statique part au GPU ; les nappes de terre et de mer aussi
    if (S.rendu) {
      S.rendu.setWorld(decor.statiques, [], relief.atmosphere());
      S.rendu.setNappes(relief.nappes().concat([relief.nappeEau()]));
    }

    S.cam = B.vue.creer(S.toile, relief);
    S.cam.placer(decor.spawn.x, decor.spawn.z - 6, 30);

    S.mini = construireMinicarte(relief, decor);
    S.ecran = 'jeu';
    if (S.dom) {
      S.dom.titre.classList.add('cache');
      S.dom.hud.classList.remove('cache');
      S.dom.pause.classList.add('cache');
      S.dom.bilan.classList.add('cache');
    }
    if (S.son) S.son.enJeu(true);
    voiler('MISSION ' + numero, numero === 1 ? 'Éliminez la garnison, puis plantez le drapeau au camp' : 'Éliminez la garnison, puis plantez le drapeau au camp');
    rafraichir();
  }

  function voiler(texte, sous, sang) {
    if (!S.dom) return;
    S.dom.voile.classList.remove('cache');
    S.dom.voileT.textContent = texte;
    S.dom.voileT.className = sang ? 'sang' : '';
    S.dom.voileS.textContent = sous || '';
    S.voileT = 2.2;
  }

  function defausse() {
    if (!S.dom) return;
    S.dom.voile.classList.add('cache');
  }

  // ————— ordres —————
  function bleus() { return S.escouade.filter(u => u.etat !== 'mort'); }

  function ordreClic(frappe, mx, my) {
    if (S.ecran !== 'jeu' || !S.etat) return;
    const etat = S.etat;
    if (S.cadre) { S.cadre = null; return; }
    if (!frappe) return;
    if (frappe.type === 'unite' && frappe.unite.camp === 'rouge') {
      for (const u of S.selection) {
        u.cibleTir = { unite: frappe.unite };
        u.cible = { x: frappe.unite.x, z: frappe.unite.z };
      }
      return;
    }
    if (frappe.type === 'obstacle') {
      const c = caisseProche(frappe.obstacle);
      if (c && !c.pris) {
        const u = bleus()[0];
        if (u) { u.cible = { x: c.x, z: c.z }; u.caisse = c; u.cibleTir = null; }
        return;
      }
    }
    const x = frappe.x, z = frappe.z;
    // avancer en formation
    const sel = S.selection.slice();
    sel.forEach((u, k) => {
      const f = FORMATION[k % FORMATION.length];
      const p = etat.relief.pointLibre(x + f[0], z + f[1], .38);
      u.cible = p ? { x: p.x, z: p.z } : { x, z };
      u.cibleTir = null; u.caisse = null;
    });
    // planter le drapeau ?
    for (const d of S.etat.decor.drapeaux) {
      if (!d.pris && Math.hypot(x - d.x, z - d.z) < 2.4 && S.drapeauActif) {
        const u = sel[0];
        if (u) { u.cible = { x: d.x, z: d.z }; u.drapeau = d; }
      }
    }
  }

  function caisseProche(obstacle) {
    for (const c of S.etat.decor.caisses) if (!c.pris && Math.hypot(c.x - obstacle.x, c.z - obstacle.z) < .6) return c;
    return null;
  }

  function ordreTirOuvert(point) { S.droit = point ? { x: point.x, z: point.z } : null; }

  // grenade ou roquette posée au clic gauche (le mode est armé par G ou R)
  function poserProjectile(frappe) {
    if (!S.etat || !frappe) return false;
    const etat = S.etat;
    if (S.mode === 'grenade') {
      const u = bleus().find(b => b.grenades > 0);
      if (u && B.armes.tirerGrenade(etat, u, { x: frappe.x, z: frappe.z }, etat.relief)) { etat.stats.grenades++; S.son && S.son.grenade(u.x, S.cam); }
      S.mode = null;
      return true;
    }
    if (S.mode === 'roquette') {
      const u = bleus().find(b => b.roquettes > 0);
      if (u && B.armes.tirerRoquette(etat, u, { x: frappe.x, z: frappe.z }, etat.relief)) { S.son && S.son.roquette(u.x, S.cam); }
      S.mode = null;
      return true;
    }
    return false;
  }

  // clic gauche court : l'homme sous le curseur ; Maj pour ajouter au groupe sélectionné
  function selectionClic(frappe, mx, my, ajouter) {
    if (!S.etat) return;
    if (frappe && frappe.type === 'unite' && frappe.unite.camp === 'bleu' && frappe.unite.etat !== 'mort') {
      const u = frappe.unite;
      if (ajouter) u.selectionne = !u.selectionne;
      else { for (const v of S.escouade) v.selectionne = false; u.selectionne = true; }
      S.selection = bleus().filter(v => v.selectionne);
      if (!S.selection.length) selectionTous();
      return;
    }
    if (ajouter) return;
    selectionCadre(mx - 10, my - 10, mx + 10, my + 10);
  }

  function selectionCadre(x0, y0, x1, y1) {
    if (!S.etat || !S.toile || !S.cam) return;
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    let trouve = false;
    for (const u of bleus()) {
      const e = S.cam.projeter(u.x, S.etat.relief.hauteur(u.x, u.z) + .9, u.z);
      if (e && e[0] >= xa && e[0] <= xb && e[1] >= ya && e[1] <= yb) { u.selectionne = true; trouve = true; }
      else u.selectionne = false;
    }
    if (trouve) S.selection = bleus().filter(u => u.selectionne);
  }

  function selectionUn(i) {
    if (!S.escouade) return;
    S.selection = [];
    S.escouade.forEach((u, k) => { u.selectionne = (k === i && u.etat !== 'mort'); if (u.selectionne) S.selection.push(u); });
    if (!S.selection.length) selectionTous();
  }
  function selectionTous() {
    S.selection = bleus();
    for (const u of S.escouade) u.selectionne = u.etat !== 'mort';
  }
  function selectionGroupe(g) {
    const groupe = S.escouade.filter(u => u.groupe === g && u.etat !== 'mort');
    if (!groupe.length) return;
    S.selection = groupe;
    for (const u of S.escouade) u.selectionne = groupe.indexOf(u) >= 0;
  }
  function definirGroupe(g) {
    const sel = S.selection.slice();
    if (sel.length) sel.forEach(u => { u.groupe = g; });
  }

  // ————— simulation —————
  function maj(dt) {
    if (S.ecran !== 'jeu' || !S.etat) return;
    const etat = S.etat, relief = etat.relief;
    etat.t += dt;
    if (S.voileT > 0) { S.voileT -= dt; if (S.voileT <= 0) defausse(); }

    // ordres de tir des bleus
    for (const u of S.selection) {
      if (u.etat === 'mort') continue;
      if (S.droit) u.cibleTir = { x: S.droit.x, z: S.droit.z };
    }
    for (const u of bleus()) {
      u.cooldown = Math.max(0, u.cooldown - dt);
      if (u.caisse && Math.hypot(u.x - u.caisse.x, u.z - u.caisse.z) < 1.3) { ramasser(u); u.caisse = null; }
      if (u.drapeau && !u.drapeau.pris && Math.hypot(u.x - u.drapeau.x, u.z - u.drapeau.z) < 1.7 && garnisonMorte()) {
        u.drapeau.pris = true; finMission(true); return;
      }
      let cible = null;
      if (u.cibleTir) {
        if (u.cibleTir.unite) {
          if (u.cibleTir.unite.etat === 'mort') u.cibleTir = null;
          else cible = u.cibleTir.unite;
        } else cible = u.cibleTir;
      }
      if (cible) {
        const cx = cible.x, cz = cible.z;
        u.dirTir = Math.atan2(cx - u.x, cz - u.z);
        const y0 = relief.hauteur(u.x, u.z), y1 = relief.hauteur(cx, cz);
        u.pitch = Math.max(-.7, Math.min(.7, (y1 + .9 - (y0 + 1.12)) / Math.max(1, Math.hypot(cx - u.x, cz - u.z))));
        const dist = Math.hypot(cx - u.x, cz - u.z);
        if (u.cooldown <= 0 && dist < B.armes.PARAM.mg.portee && relief.losClair(u.x, y0 + 1.15, u.z, cx, y1 + .5, cz)) {
          const arme = u.arme === 'bazooka' && u.cibleTir && u.cibleTir.unite && dist > 12 && u.roquettes > 0 ? 'bazooka' : 'mg';
          if (arme === 'bazooka') { B.armes.tirerRoquette(etat, u, { x: cx, y: y1 + .9, z: cz }, relief); S.son && S.son.roquette(u.x, S.cam); }
          else {
            B.armes.tirerMg(etat, u, { x: cx, y: y1 + (cible.unite || u.cibleTir.unite ? .95 : .3), z: cz }, relief, false);
            etat.stats.tirs++; S.cumul.tirs++;
            etat.bruits.push({ x: u.x, z: u.z });
            S.son && S.son.coupFeuJoueur(u.x, S.cam);
            const p = etat.projectiles[etat.projectiles.length - 1];
            if (p) B.etincelles.tir(etat.sys, p.trace[0], p.trace[1], p.trace[2], cx, y1 + .9, cz);
          }
        }
      }
      B.troupe.avancer(u, relief, S.escouade, dt);
    }

    B.armes.maj(etat, dt);
    B.ia.maj(etat, dt);
    B.etincelles.maj(etat.sys, dt, etat.rng);

    // les mines
    for (const m of etat.decor.mines) {
      if (m.sautee) continue;
      for (const u of bleus()) {
        if (Math.hypot(u.x - m.x, u.z - m.z) < .95) {
          m.sautee = true;
          B.armes.explosion(etat, m.x, relief.hauteur(m.x, m.z) + .12, m.z, 3.6);
          break;
        }
      }
    }

    // fin de partie
    if (!garnisonMorte()) {
      if (S.drapeauActif) { S.drapeauActif = false; }
    } else if (!S.drapeauActif) {
      S.drapeauActif = true;
      message('Plus un seul rouge — plantez le drapeau au camp !');
    }
    if (!bleus().length && S.ecran === 'jeu') {
      if (S.respawn <= 0) { S.respawn = 2.2; voiler('TOUS MORTS', '', true); S.son && S.son.defaite(); }
      else {
        S.respawn -= dt;
        if (S.respawn <= 0) {
          S.vies--;
          if (S.vies <= 0) finMission(false);
          else respawnEscouade();
        }
      }
    }

    B.vue.maj(S.cam, dt);
    rafraichir();
  }

  function garnisonMorte() {
    return !S.etat.unites.some(u => u.camp === 'rouge' && u.etat !== 'mort');
  }

  function ramasser(u) {
    const c = u.caisse;
    c.pris = true;
    if (c.type === 'vie') {
      for (const b of S.escouade) if (b.etat !== 'mort') b.vie = 100;
      const mort = S.escouade.find(b => b.etat === 'mort');
      if (mort) { mort.etat = 'garde'; mort.vie = 100; mort.mortA = -1; mort.x = u.x; mort.z = u.z; }
      S.son && S.son.ramassage();
      message('Caisse de santé — la section se refait');
    } else {
      const vivants = bleus();
      vivants.forEach((b, k) => { b.grenades += k < 2 ? 2 : 1; if (b.arme === 'bazooka') b.roquettes += 1; });
      S.son && S.son.munitions();
      message('Caisse de munitions — grenades et roquettes');
    }
  }

  function respawnEscouade() {
    const decor = S.etat.decor;
    S.escouade = [];
    for (let k = 0; k < NB; k++) {
      const p = S.etat.relief.pointLibre(decor.spawn.x + (k % 2) * 1.4 - .7, decor.spawn.z - 1.5 + Math.floor(k / 2) * 1.4, .4);
      const u = B.troupe.creer({ camp: 'bleu', x: p.x, z: p.z, dir: Math.PI, groupe: k < 2 ? 1 : 2 });
      u.grenades = k < 2 ? 2 : 1;
      if (S.mission >= 2 && k === 0) { u.arme = 'bazooka'; u.roquettes = 2; }
      S.escouade.push(u);
    }
    S.etat.unites = S.etat.unites.filter(u => u.camp !== 'bleu').concat(S.escouade);
    S.selection = S.escouade.slice();
    for (const u of S.selection) u.selectionne = true;
    S.cam.cibleX = decor.spawn.x; S.cam.cibleZ = decor.spawn.z - 6;
    voiler('NOUVELLE SECTION', S.vies + ' sections restantes');
  }

  function finMission(reussie) {
    S.ecran = 'bilan-fin';
    const d = S.dom;
    if (!d) return;
    const st = S.etat.stats;
    const temps = ((performance.now() - st.debut) / 1000) | 0;
    const prec = st.tirs ? Math.round(100 * st.touches / st.tirs) : 0;
    d.bilanT.textContent = reussie ? 'MISSION ACCOMPLIE' : 'FIN DE PARTIE';
    d.bilanT.style.color = reussie ? '' : '#c23b2a';
    const lignes = [
      ['Ennemis éliminés', S.etat.unites.filter(u => u.camp === 'rouge' && u.etat === 'mort').length],
      ['Balles tirées', st.tirs],
      ['Précision', prec + ' %'],
      ['Grenades lancées', st.grenades],
      ['Temps', (temps / 60 | 0) + ' min ' + (temps % 60) + ' s'],
      ['Sections restantes', S.vies]
    ];
    d.bilanL.innerHTML = lignes.map(l => '<tr><td>' + l[0] + '</td><td>' + l[1] + '</td></tr>').join('');
    let note = '';
    if (reussie) {
      S.cumul.missions++;
      if (prec >= 35 && S.vies < 5) { S.vies++; note = 'Tir juste : une section de renfort en plus.'; }
      d.bilanN.textContent = note;
      S.ecran = 'bilan';
      S.son && S.son.victoire();
    } else {
      d.bilanN.textContent = 'Il ne reste plus personne pour charger les munitions.';
      S.son && S.son.defaite();
    }
    d.bilan.classList.remove('cache');
  }

  function message(t) {
    if (!S.dom || !S.dom.msg) return;
    S.dom.msg.textContent = t;
    S.dom.msg.classList.add('visible');
    clearTimeout(S._msg);
    S._msg = setTimeout(() => S.dom.msg && S.dom.msg.classList.remove('visible'), 3200);
  }

  function rafraichir() {
    const d = S.dom;
    if (!d || !S.etat) return;
    d.mission.textContent = S.mission;
    d.ennemis.textContent = S.etat.unites.filter(u => u.camp === 'rouge' && u.etat !== 'mort').length;
    d.vies.textContent = '●'.repeat(Math.max(0, S.vies)) || '—';
    const vivants = bleus();
    const gre = vivants.reduce((s, u) => s + u.grenades, 0), roq = vivants.reduce((s, u) => s + u.roquettes, 0);
    d.armes.textContent = 'MG ∞ · GRENADES ' + gre + (S.mission >= 2 ? ' · ROQUETTES ' + roq : '');
    S.escouade.forEach((u, k) => {
      const p = d.portraits[k];
      if (!p) return;
      p.className = 'portrait' + (u.selectionne ? ' choisi' : '') + (u.etat === 'mort' ? ' mort' : '');
      const i = p.querySelector('.sante i');
      if (i) i.style.width = Math.max(0, u.vie) + '%';
    });
    dessinerMinicarte();
  }

  // ————— minicarte —————
  function construireMinicarte(relief, decor) {
    if (!G.document) return null;
    const t = relief.taille, c = G.document.createElement('canvas');
    c.width = t; c.height = t;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(t, t);
    for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) {
      const h = relief.hauteur(i, j);
      let r, v, b;
      if (h <= 0) { r = 24; v = 66; b = 92; }
      else if (h < .75) { r = 178; v = 156; b = 104; }
      else { const p = Math.hypot(...relief.pente(i, j)); if (p > .75) { r = 104; v = 100; b = 90; } else { r = 52 + (i * 7 + j * 13) % 14; v = 96 + (i * 11) % 22; b = 42; } }
      const k = (j * t + i) * 4;
      img.data[k] = r; img.data[k + 1] = v; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function dessinerMinicarte() {
    const d = S.dom;
    if (!d || !d.mini || !S.mini || !S.etat) return;
    const ctx = d.mini.getContext('2d'), t = S.etat.relief.taille, f = d.mini.width / t;
    ctx.clearRect(0, 0, d.mini.width, d.mini.height);
    ctx.drawImage(S.mini, 0, 0, d.mini.width, d.mini.height);
    ctx.globalAlpha = .8;
    for (const o of S.etat.relief.obstacles) {
      if (o.r < .5) continue;
      ctx.fillStyle = o.r > .9 ? '#2c2f28' : '#3d3a2c';
      ctx.fillRect(o.x * f - 1, o.z * f - 1, 2.2, 2.2);
    }
    ctx.globalAlpha = 1;
    for (const dr of S.etat.decor.drapeaux) {
      ctx.fillStyle = dr.pris ? '#6fc24d' : '#c23b2a';
      ctx.fillRect(dr.x * f - 2, dr.z * f - 3, 4, 6);
    }
    for (const tr of S.etat.decor.tourelles) {
      if (!tr.vivante) continue;
      ctx.fillStyle = '#e0a030';
      ctx.beginPath(); ctx.arc(tr.x * f, tr.z * f, 2.4, 0, 6.29); ctx.fill();
    }
    for (const u of S.etat.unites) {
      if (u.etat === 'mort') continue;
      ctx.fillStyle = u.camp === 'bleu' ? (u.selectionne ? '#9fc4ff' : '#3f6fd0') : '#d8452f';
      ctx.beginPath(); ctx.arc(u.x * f, u.z * f, u.camp === 'bleu' ? 2.6 : 2.1, 0, 6.29); ctx.fill();
    }
    // le cadre de vue
    const w = S.cam.dist * 1.35;
    ctx.strokeStyle = '#d8d2c2aa';
    ctx.strokeRect((S.cam.x - w / 2) * f, (S.cam.z - w / 2) * f, w * f, w * f);
  }

  // ————— maillage de l'image —————
  function mailler(sortie) {
    if (!S.etat) return;
    const t = S.etat.t;
    for (const u of S.etat.unites) B.troupe.mailler(u, S.etat.relief, t, sortie, true);
    // les barils des tourelles suivent l'angle
    for (const tr of S.etat.decor.tourelles) {
      if (!tr.vivante) continue;
      sortie.push({ shape: 'box', p: [tr.x + Math.sin(tr.angle) * .55, tr.y + .85, tr.z + Math.cos(tr.angle) * .55], s: [.12, .12, 1.1], r: [0, tr.angle, 0], mat: 7, color: [0.18, 0.19, 0.21] });
    }
    // les caisses et les mines vivent dans le dynamique (on peut les ramasser)
    for (const c of S.etat.decor.caisses) {
      if (c.pris) continue;
      const y = S.etat.relief.hauteur(c.x, c.z);
      sortie.push({ shape: 'box', p: [c.x, y + .29, c.z], s: [.62, .58, .62], mat: 10, color: c.type === 'vie' ? [0.20, 0.42, 0.18] : [0.62, 0.36, 0.10] });
      sortie.push({ shape: 'box', p: [c.x, y + .47, c.z], s: [.66, .1, .12], mat: 7, color: c.type === 'vie' ? [0.85, 0.9, 0.85] : [0.9, 0.75, 0.2] });
    }
    for (const m of S.etat.decor.mines) {
      if (m.sautee) continue;
      const y = S.etat.relief.hauteur(m.x, m.z);
      sortie.push({ shape: 'cylinder', p: [m.x, y - .01, m.z], s: [.4, .07, .4], mat: 7, color: [0.12, 0.13, 0.11] });
      sortie.push({ shape: 'sphere', p: [m.x, y + .07, m.z], s: [.09, .07, .09], mat: 6, color: [0.5, 0.08, 0.05] });
    }
    // le drapeau ennemi : la hampe est au décor, la toile est dynamique
    for (const dr of S.etat.decor.drapeaux) {
      if (dr.pris) continue;
      const y = S.etat.relief.hauteur(dr.x, dr.z);
      const g = Math.sin(t * 3) * .06;
      sortie.push({ shape: 'box', p: [dr.x + .62, y + 2.81 + g * .3, dr.z], s: [1.15, .72, .06], r: [0, 0, g], mat: 6, color: [0.76, 0.16, 0.12] });
    }
    B.etincelles.mailler(S.etat.sys, S.etat.relief, sortie);
  }

  B.jeu = {
    S, maj, mailler, ordreClic, ordreTirOuvert, selectionCadre, selectionClic, poserProjectile,
    selectionUn, selectionTous, selectionGroupe, definirGroupe, ecranTitre, nouvelleCampagne,
    lancerMission, brancherDom, voiler, message, bleus
  };
})(typeof window !== 'undefined' ? window : globalThis);
