/* CHAIR À CANON — les corps, repris d'EMPRISE (human-data.js, body-data.js, human.js, people.js) :
   anatomie procédurale paramétrique, vêtements à deux os continus, jambes en IK (jambe d'appui tendue,
   jambe libre qui se lève), bras qui ballent au pas et se tendent en visée. La démarche s'avance à partir
   de la distance réellement parcourue — un homme arrêté ne marche pas parce que l'IA le veut.
   Les formes sont enregistrées chez FRender (cube unité) ; l'assemblage rend des primitives dynamiques,
   comme la foule d'EMPRISE. */
(function (G) {
  'use strict';
  const B = G.CAC = G.CAC || {};
  if (typeof G.document === 'undefined' || typeof G.FRender === 'undefined') { B.corps = null; return; }

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ————— anatomie procédurale (human-data.js, verbatim) —————
  const mesh = () => ({ positions: [], normals: [], indices: [], bones: [], materials: [] });
  function vertex(m, p, bone = [0, 0, 0], material = 0) { const i = m.positions.length; m.positions.push(p); m.normals.push([0, 0, 0]); m.bones.push(bone); m.materials.push(material); return i; }
  function normalise(m) { for (const n of m.normals) n.fill(0); for (let i = 0; i < m.indices.length; i += 3) { const ids = m.indices.slice(i, i + 3), [a, b, c] = ids.map(j => m.positions[j]), u = b.map((n, k) => n - a[k]), v = c.map((n, k) => n - a[k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; for (const j of ids) for (let k = 0; k < 3; k++) m.normals[j][k] += n[k]; } for (let i = 0; i < m.normals.length; i++) { const n = m.normals[i], l = Math.hypot(...n); m.normals[i] = l > 1e-10 ? n.map(v => v / l) : [0, 1, 0]; } m.count = m.positions.length; return m; }
  function profile(y, rows) { if (y <= rows[0][0]) return rows[0].slice(1); let i = 1; while (i < rows.length - 1 && y > rows[i][0]) i++; const a = rows[i - 1], b = rows[i], h = b[0] - a[0], t = clamp((y - a[0]) / h), slope = (j, k) => { if (j === 0) return (rows[1][k] - rows[0][k]) / (rows[1][0] - rows[0][0]); if (j === rows.length - 1) return (rows[j][k] - rows[j - 1][k]) / (rows[j][0] - rows[j - 1][0]); const h0 = rows[j][0] - rows[j - 1][0], h1 = rows[j + 1][0] - rows[j][0], d0 = (rows[j][k] - rows[j - 1][k]) / h0, d1 = (rows[j + 1][k] - rows[j][k]) / h1; if (d0 * d1 <= 0) return 0; return 3 * (h0 + h1) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1); }; return a.slice(1).map((v, k) => { k++; const n = (2 * t * t * t - 3 * t * t + 1) * v + (t * t * t - 2 * t * t + t) * h * slope(i - 1, k) + (-2 * t * t * t + 3 * t * t) * b[k] + (t * t * t - t * t) * h * slope(i, k); return clamp(n, Math.min(v, b[k]), Math.max(v, b[k])); }); }
  function surface(m, { bottom, top, rows = 24, sides = 28, point, bones = () => [0, 0, 0], material = 0, cap = true }) { const start = m.positions.length; for (let j = 0; j <= rows; j++) { const y = bottom + (top - bottom) * j / rows; for (let i = 0; i < sides; i++) { const angle = i * Math.PI * 2 / sides; vertex(m, point(y, angle), bones(y, angle), material); } } for (let j = 0; j < rows; j++) for (let i = 0; i < sides; i++) { const a = start + j * sides + i, b = a + sides, c = start + j * sides + (i + 1) % sides, d = c + sides; m.indices.push(a, b, c, c, b, d); } if (cap) for (const [j, flip] of [[0, true], [rows, false]]) { const y = bottom + (top - bottom) * j / rows, p = [0, 0, 0]; for (let i = 0; i < sides; i++) for (let k = 0; k < 3; k++) p[k] += m.positions[start + j * sides + i][k] / sides; const center = vertex(m, p, bones(y), material); for (let i = 0; i < sides; i++) { const a = start + j * sides + i, b = start + j * sides + (i + 1) % sides; m.indices.push(center, ...(flip ? [a, b] : [b, a])); } } }
  function ellipsoid(m, center, radii, { bone = [1, 1, 0], material = 0, rows = 10, sides = 16, tilt = 0 } = {}) { const start = m.positions.length, ct = Math.cos(tilt), st = Math.sin(tilt); for (let j = 0; j <= rows; j++) for (let i = 0; i < sides; i++) { const v = j * Math.PI / rows, u = i * Math.PI * 2 / sides, x = radii[0] * Math.sin(v) * Math.cos(u), y = radii[1] * Math.cos(v), z = radii[2] * Math.sin(v) * Math.sin(u); vertex(m, [center[0] + ct * x - st * y, center[1] + st * x + ct * y, center[2] + z], bone, material); } for (let j = 0; j < rows; j++) for (let i = 0; i < sides; i++) { const a = start + j * sides + i, b = a + sides, c = start + j * sides + (i + 1) % sides, d = c + sides; if (j > 0) m.indices.push(a, d, b); if (j < rows - 1) m.indices.push(a, c, d); } }

  function head() { const m = mesh(), shape = [[1.525, .028, .028, .018], [1.55, .057, .049, .026], [1.585, .079, .066, .021], [1.625, .091, .080, .008], [1.67, .095, .086, .0], [1.71, .093, .083, -.002], [1.75, .092, .078, -.007], [1.79, .080, .067, -.012], [1.815, .055, .047, -.015], [1.827, .006, .006, -.015]], g = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
    surface(m, { bottom: 1.525, top: 1.827, rows: 32, sides: 40, bones: () => [1, 1, 0], point(y, a) { const [rx, rz, cz] = profile(y, shape), x = rx * Math.cos(a), front = Math.max(0, Math.sin(a)) ** 6; let z = cz + rz * Math.sin(a); z += front * (.023 * g(x, y, 0, 1.669, .022, .030) + .010 * g(x, y, 0, 1.703, .015, .042) + .008 * g(x, y, -.054, 1.660, .026, .023) + .008 * g(x, y, .054, 1.660, .026, .023) - .010 * g(x, y, -.038, 1.703, .021, .013) - .010 * g(x, y, .038, 1.703, .021, .013) + .009 * g(x, y, 0, 1.611, .036, .008) - .003 * g(x, y, 0, 1.617, .040, .003)); return [x, y, z]; } });
    for (const side of [-1, 1]) ellipsoid(m, [side * .097, 1.669, -.008], [.014, .034, .020]);
    surface(m, { bottom: 1.465, top: 1.555, rows: 8, sides: 24, bones: () => [1, 1, 0], point(y, a) { const rx = .053 + smooth(1.51, 1.555, y) * .009; return [rx * Math.cos(a), y, .004 + .050 * Math.sin(a)]; } });
    return normalise(m);
  }
  const humanData = head();

  // ————— corps habillé (body-data.js, verbatim) —————
  const G1 = { mesh, vertex, normalise, profile, surface, ellipsoid, smooth, clamp };
  const m = G1.mesh();
  const { surface: sf, ellipsoid: el, profile: pf, smooth: sm, clamp: cl } = G1;
  const shirt = [[1.035, .195, .140], [1.11, .197, .145], [1.24, .207, .150], [1.36, .219, .143], [1.43, .216, .122], [1.475, .150, .088], [1.495, .077, .066], [1.512, .070, .064], [1.532, .067, .061]];
  sf(m, { bottom: 1.035, top: 1.532, rows: 26, sides: 28, material: 1, point(y, a) { const [rx, rz] = pf(y, shirt), fold = .0015 * Math.sin(y * 58 + a * 3) * Math.sin(a * 5); return [(rx + fold) * Math.cos(a), y - .018 * sm(1.475, 1.532, y) * Math.max(0, Math.sin(a)) ** 2, (rz + fold) * Math.sin(a)]; } });
  sf(m, { bottom: .87, top: 1.035, rows: 10, sides: 28, material: 2, point(y, a) { const [rx, rz] = pf(y, [[.87, .158, .108], [.95, .185, .127], [1.035, .195, .140]]); return [rx * Math.cos(a), y, rz * Math.sin(a)]; } });
  for (const side of [-1, 1]) {
    const upper = side > 0 ? 3 : 2, fore = side > 0 ? 19 : 18, thigh = side > 0 ? 5 : 4, shin = side > 0 ? 17 : 16, foot = side > 0 ? 21 : 20;
    sf(m, { bottom: .955, top: 1.485, rows: 30, sides: 18, material: 1, bones(y) { if (y > 1.40) return [upper, 0, sm(1.40, 1.485, y) * .95]; return [upper, fore, 1 - sm(1.135, 1.245, y)]; }, point(y, a) { const [rx, rz] = pf(y, [[.955, .045, .049], [1.04, .053, .058], [1.12, .058, .063], [1.19, .057, .062], [1.30, .069, .076], [1.40, .070, .076], [1.43, .061, .068], [1.465, .036, .043], [1.485, .012, .018]]), t = cl((1.43 - y) / .24), lower = cl((1.19 - y) / .24), cx = side * (y > 1.43 ? .235 - .085 * sm(1.43, 1.485, y) : y < 1.19 ? .255 + .005 * lower : .235 + .020 * t), cz = .015 * lower, fold = .0012 * Math.sin(y * 65 + a * 3); return [cx + (rx + fold) * Math.cos(a), y - .026 * sm(1.27, 1.43, y) * Math.max(0, side * Math.cos(a)) ** 2, cz + (rz + fold) * Math.sin(a)]; } });
    el(m, [side * .26, .910, .015], [.042, .057, .024], { bone: [fore, fore, 0], rows: 10, sides: 16 });
    const lengths = [.045, .057, .054, .043], offsets = [-.027, -.009, .010, .027];
    for (let f = 0; f < 4; f++) el(m, [side * (.26 + offsets[f]), .861 - lengths[f] / 2, .018], [.0095, lengths[f] / 2 + .009, .0105], { bone: [fore, fore, 0], rows: 7, sides: 8 });
    el(m, [side * .216, .900, .026], [.012, .030, .014], { bone: [fore, fore, 0], tilt: side * .42, rows: 10, sides: 12 });
    sf(m, { bottom: .145, top: 1.0, rows: 32, sides: 20, material: 2, bones(y) { if (y > .88) return [thigh, 0, sm(.88, 1.0, y) * .7]; return [thigh, shin, 1 - sm(.465, .575, y)]; }, point(y, a) { const [rx, rz] = pf(y, [[.145, .058, .065], [.29, .072, .082], [.45, .078, .086], [.54, .080, .088], [.72, .096, .107], [.88, .103, .115], [1.0, .102, .119]]), fold = .0014 * Math.sin(y * 52 + a * 4); return [side * .105 + (rx + fold) * Math.cos(a), y, (rz + fold) * Math.sin(a)]; } });
    sf(m, { bottom: .005, top: .145, rows: 12, sides: 20, material: 4, bones: () => [foot, foot, 0], point(y, a) { const [rx, rz, cz] = pf(y, [[.005, .052, .110, .027], [.020, .059, .126, .035], [.052, .060, .124, .032], [.088, .055, .105, .023], [.115, .047, .071, .010], [.145, .041, .052, 0]]); return [side * .105 + rx * Math.cos(a) * (1 - .08 * Math.max(0, Math.sin(a))), y, cz + rz * Math.sin(a)]; } });
  }
  const bodyData = G1.normalise(m); bodyData.feet = true;

  // ————— repères matriciels (BITUME carene/voiture, mêmes formules) —————
  function boite(triangles) { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const t of triangles) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], t[k][0], t[k][1], t[k][2]); hi[k] = Math.max(hi[k], t[k][0], t[k][1], t[k][2]); } return { lo, hi }; }
  const unitaire = q => { const l = Math.hypot(...q) || 1; return q.map(v => v / l); };
  function normaliser(triangles) { const { lo, hi } = boite(triangles), centre = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2), taille = [0, 1, 2].map(k => Math.max(1e-4, hi[k] - lo[k])); const p = q => [0, 1, 2].map(k => (q[k] - centre[k]) / taille[k]), n = q => unitaire([0, 1, 2].map(k => q[k] * taille[k])); return { triangles: triangles.map(t => [p(t[0]), p(t[1]), p(t[2]), n(t[3]), n(t[4]), n(t[5])]), centre, taille }; }
  function euler(rx, ry, rz) { const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz); return [[cz * cy, sz * cy, -sy], [cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx], [cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx]]; }
  const mulv = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
  const mulM = (a, b) => [mulv(a, b[0]), mulv(a, b[1]), mulv(a, b[2])];
  function angles(m) { const b = -Math.asin(Math.max(-1, Math.min(1, m[0][2]))); return [Math.atan2(m[1][2], m[2][2]), b, Math.atan2(m[0][1], m[0][0])]; }

  function register(data, nom) { const triangles = []; for (let i = 0; i < data.indices.length; i += 3) { const ids = [data.indices[i], data.indices[i + 2], data.indices[i + 1]], point = j => [data.positions[j][0], data.positions[j][1], -data.positions[j][2]], normal = j => [data.normals[j][0], data.normals[j][1], -data.normals[j][2]]; triangles.push([...ids.map(point), ...ids.map(normal)]); } const n = normaliser(triangles); G.FRender.forme(nom, n.triangles); return { shape: nom, p: n.centre, s: n.taille }; }

  // ————— la tête et le corps découpés par os et matière (human.js) —————
  const tete = register(humanData, 'cac-tete');
  const bd = bodyData, body = { positions: bd.positions, normals: bd.normals, bones: bd.bones, materials: bd.materials, indices: bd.indices };
  const groups = new Map();
  for (let i = 0; i < body.indices.length; i += 3) {
    const ids = body.indices.slice(i, i + 3), vote = new Map(), mat = new Map();
    for (const j of ids) { const [a, b, w] = body.bones[j]; vote.set(a, (vote.get(a) || 0) + 1 - w); vote.set(b, (vote.get(b) || 0) + w); mat.set(body.materials[j], (mat.get(body.materials[j]) || 0) + 1); }
    const code = [...vote].sort((a, b) => b[1] - a[1])[0][0], material = [...mat].sort((a, b) => b[1] - a[1])[0][0], key = code + ',' + material;
    if (!groups.has(key)) groups.set(key, { code, material, indices: [] });
    groups.get(key).indices.push(...ids);
  }
  const parts = [];
  for (const [key, part] of groups) parts.push({ ...register({ ...body, indices: part.indices }, 'cac-corps-' + key), code: part.code, material: part.material });

  // ————— la démarche (human.js legGait/motion, people.js advanceGait, verbatim) —————
  const gaitParameters = Object.freeze({ duty: .52, stride: .30, lift: .09, drop: .072, thigh: .45, shin: .375, ankleY: .145, cycleDistance: 1.2 / 1.04 });
  function legGait(phase, amount = 1) { amount = Math.max(0, Math.min(1.2, amount)); const q = gaitParameters, u = ((phase / (Math.PI * 2)) % 1 + 1) % 1, s = u < q.duty ? 0 : (u - q.duty) / (1 - q.duty), swing = u >= q.duty, t = s * s * (3 - 2 * s), z = q.stride * amount * (swing ? -1 + 2 * t : 1 - 2 * u / q.duty), lift = swing ? q.lift * amount * Math.sin(Math.PI * s) ** 2 : 0, bodyY = -q.drop * amount + .003 * amount * Math.cos(phase * 2), dy = .97 + bodyY - q.ankleY - lift, d = Math.max(.05, Math.min(q.thigh + q.shin - .00001, Math.hypot(dy, z))), knee = -Math.acos(Math.max(-1, Math.min(1, (d * d - q.thigh * q.thigh - q.shin * q.shin) / (2 * q.thigh * q.shin)))), hip = Math.atan2(z, dy) + Math.acos(Math.max(-1, Math.min(1, (q.thigh * q.thigh + d * d - q.shin * q.shin) / (2 * q.thigh * d)))), ankle = -hip - knee; return { hip, knee, ankle, bodyY, lift, z, stance: !swing }; }
  function motion({ phase = 0, walk = 0, aim = false } = {}) { const left = legGait(phase, walk), right = legGait(phase + Math.PI, walk), swing = Math.sin(phase) * .23 * walk; return { left, right, bodyY: left.bodyY, armLeft: aim ? 1.20 : -swing, armRight: aim ? 1.20 : swing, elbow: aim ? .35 : .12, matrices: [] }; }
  function boneMatrix(code, pose) { if (pose.matrices[code]) return pose.matrices[code]; const left = [2, 18, 4, 16, 20].includes(code), leg = left ? pose.left : pose.right; let c = 1, s = 0, ty = 0, tz = 0, angle = 0;
    const turn = (a, y, z = 0) => { const ca = Math.cos(a), sa = Math.sin(a), nc = ca * c - sa * s, ns = ca * s + sa * c, ny = ca * ty + sa * tz + y * (1 - ca) - sa * z, nz = -sa * ty + ca * tz + z * (1 - ca) + sa * y; c = nc; s = ns; ty = ny; tz = nz; angle += a; };
    if ([4, 5, 16, 17, 20, 21].includes(code)) { if (code >= 20) turn(leg.ankle, .145); if (code >= 16) turn(leg.knee, .52); turn(leg.hip, .97); } else if ([2, 3, 18, 19].includes(code)) { if (code >= 18) turn(pose.elbow, 1.19); turn(left ? pose.armLeft : pose.armRight, 1.43); }
    return pose.matrices[code] = [c, s, ty, tz, angle];
  }
  function transformPoint(p, code, pose) { const [c, s, ty, tz] = boneMatrix(code, pose); return [p[0], c * p[1] + s * p[2] + ty, -s * p[1] + c * p[2] + tz]; }
  function advanceGait(state, travel, speed, dt) {
    const target = Math.min(1.2, Math.max(0, speed) / (speed > 2 ? 2.53846 : 1.26923));
    const previous = state.amount || 0; state.amount = previous + (target - previous) * (1 - Math.exp(-Math.max(0, dt) / .12));
    if (state.amount < .001) state.amount = 0;
    state.phase = (state.phase || 0) + Math.min(.5, Math.max(0, travel)) / (1.2 / 1.04 * Math.max(.15, target, (previous + state.amount) / 2)) * Math.PI * 2;
    return state;
  }

  B.corps = { parts, tete, motion, boneMatrix, transformPoint, advanceGait, normaliser, euler, mulM, angles, bodyData, humanData, gaitParameters };
})(typeof window !== 'undefined' ? window : globalThis);
