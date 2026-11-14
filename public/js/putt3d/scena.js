// MINIGOLF PARTY 3D — la scena (three.js). Costruisce la buca dalla stessa pianta del server (giochi/putt-buche.js):
// il prato è una griglia che segue il bordo e l'altezza (dossi, conche, pendii), con sopra una texture dipinta a
// codice (strisce del tosaerba, sabbia, neve, fango, ghiaccio); l'acqua è una vasca con le onde, i muri sono assi di
// legno (o ghiaccio, pietra, metallo secondo il tema), il campo sta su un'isola sopra il mondo del tema (prato con gli
// alberi, mare con le palme, neve con gli abeti, giungla, spazio con le stelle, colline). Ostacoli 3D: respingenti,
// rocce/palme/statue/pianeti/balle di fieno, casse/pinguini/barili/asteroidi/pecore che si muovono, mulini, porte
// scorrevoli, rampe, tubi, buchi neri, scatole dei superpoteri, buca con la bandierina che sventola.
// Il resto (comandi, schermo sopra la scena, suoni, minimappa) è in public/js/giochi/putt.js.
// Coordinate: x del campo = X, y del campo = Z, l'altezza = Y.
import * as THREE from '/js/three.module.min.js';

const PB = window.PuttBuche;
const R = PB.R_PALLA;

// ---------- i temi: colori del prato, dei muri, del mondo intorno, del cielo ----------
const TEMI = {
  classica: { prato: '#3fae5a', prato2: '#4bbb64', muro: 0x8a5a2b, muroCima: 0xc89a5c, terra: 0x6b4a2a, fuori: 0x3d8f4a, cielo: ['#7cc4ff', '#d8f0ff'], sole: 0xfff2d8, nebbia: 0xcfe8ff, deco: 'alberi' },
  pirati: { prato: '#57b84f', prato2: '#62c35a', muro: 0x6b4423, muroCima: 0xa8774a, terra: 0xd9c08a, fuori: 0x1f8fb0, cielo: ['#48b4ff', '#fff2cc'], sole: 0xfff0d0, nebbia: 0xbfe6ff, deco: 'palme', mare: true },
  ghiaccio: { prato: '#b9d6ea', prato2: '#c6dff0', muro: 0x5f9cc8, muroCima: 0xd6efff, terra: 0x8fb6d2, fuori: 0xcfe2ef, cielo: ['#6fa8d6', '#dcecf8'], sole: 0xfff6ea, nebbia: 0xd6e6f2, deco: 'abeti', neve: true },
  giungla: { prato: '#4e9a3c', prato2: '#58a545', muro: 0x6f6553, muroCima: 0x9c9177, terra: 0x4a3a26, fuori: 0x1d4d27, cielo: ['#7fb88a', '#e8f5d0'], sole: 0xffeec8, nebbia: 0xa9cfa0, deco: 'giungla' },
  spazio: { prato: '#2e3266', prato2: '#363b78', muro: 0x9aa1c8, muroCima: 0xd8ddff, terra: 0x2a2c48, fuori: null, cielo: ['#02030a', '#0b0e28'], sole: 0xc8d0ff, nebbia: 0x0b0d22, deco: 'spazio' },
  colline: { prato: '#5cb848', prato2: '#68c454', muro: 0x9a6b3a, muroCima: 0xd4a46a, terra: 0x7a5530, fuori: 0x6aa84a, cielo: ['#86ccff', '#fff6dc'], sole: 0xfff0cc, nebbia: 0xdbeedb, deco: 'colline' },
  open: { prato: '#45b45e', prato2: '#50bf69', muro: 0x8a5a2b, muroCima: 0xc89a5c, terra: 0x6b4a2a, fuori: 0x3a8a48, cielo: ['#6cbcff', '#e0f3ff'], sole: 0xfff2d8, nebbia: 0xcfe8ff, deco: 'alberi' },
};

// numeri a caso ma sempre uguali (le decorazioni non cambiano da un fotogramma all'altro né tra i giocatori)
function caso(seme) { let s = seme >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const dentro = PB.dentro, dentroPoligono = PB.dentroPoligono;
function vicinoBordo(x, y, poly) {
  let best = null, bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2));
    const px = x1 + u * dx, py = y1 + u * dy, d = Math.hypot(x - px, y - py);
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return [best, bd];
}
function tela2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texture(c, ripeti = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (ripeti) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

// la quota "vista": quella del server più le vasche dell'acqua e un filo di conca nei bunker
function quotaVista(b, x, y) {
  let h = PB.quota(b, x, y);
  for (const r of b.acqua || []) if (dentro(x, y, [r[0] - 2, r[1] - 2, r[2] + 4, r[3] + 4])) { h -= b._spazio ? 60 : 16; break; }
  for (const r of b.sabbia || []) if (dentro(x, y, r)) { h -= 2; break; }
  for (const r of b.fango || []) if (dentro(x, y, r)) { h -= 1.5; break; }
  return h;
}

// ---------- la texture del prato, dipinta come una cartina ----------
function dipingiPrato(b, tema) {
  const T = TEMI[tema] || TEMI.classica;
  const s = Math.min(1.1, 3072 / Math.max(b.W, b.H));
  const [c, g] = tela2d(Math.round(b.W * s), Math.round(b.H * s));
  g.scale(s, s);
  const rnd = caso(b.W * 7 + b.H);
  g.fillStyle = T.prato; g.fillRect(0, 0, b.W, b.H);
  if (tema === 'spazio') {
    // pavimento di una stazione: piastrelle con le righe che brillano
    g.strokeStyle = 'rgba(140,160,255,.22)'; g.lineWidth = 2;
    for (let x = 0; x < b.W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, b.H); g.stroke(); }
    for (let y = 0; y < b.H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(b.W, y); g.stroke(); }
    g.fillStyle = 'rgba(120,140,255,.08)'; for (let k = 0; k < 120; k++) g.fillRect(Math.floor(rnd() * b.W / 80) * 80, Math.floor(rnd() * b.H / 80) * 80, 80, 80);
  } else if (tema === 'ghiaccio') {
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(90,140,190,${0.05 + rnd() * 0.08})`; g.beginPath(); g.arc(rnd() * b.W, rnd() * b.H, 3 + rnd() * 10, 0, Math.PI * 2); g.fill(); }
  } else {
    // strisce del tosaerba e fili d'erba
    g.fillStyle = T.prato2; for (let x = 0; x < b.W; x += 120) g.fillRect(x, 0, 60, b.H);
    for (let k = 0; k < b.W * b.H / 900; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,60,0,.10)' : 'rgba(255,255,200,.07)'; g.fillRect(rnd() * b.W, rnd() * b.H, 2, 4); }
    if (tema === 'giungla') for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(30,70,20,.18)'; g.beginPath(); g.ellipse(rnd() * b.W, rnd() * b.H, 30 + rnd() * 60, 18 + rnd() * 30, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  }
  // il green intorno alla buca e la piazzola di partenza
  const [bx, by] = b.buca;
  const gr = g.createRadialGradient(bx, by, 10, bx, by, 150); gr.addColorStop(0, 'rgba(255,255,255,.13)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(bx, by, 150, 0, Math.PI * 2); g.fill();
  const rr = (lista, colore, extra) => { for (const [x, y, w, h] of lista || []) { g.fillStyle = colore; g.beginPath(); g.roundRect(x, y, w, h, Math.min(22, w / 3, h / 3)); g.fill(); if (extra) extra(x, y, w, h); } };
  rr(b.sabbia, '#e8d08f', (x, y, w, h) => { for (let k = 0; k < w * h / 120; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(160,120,50,.28)' : 'rgba(255,250,220,.4)'; g.fillRect(x + rnd() * w, y + rnd() * h, 2.5, 2.5); } g.strokeStyle = 'rgba(150,110,40,.5)'; g.lineWidth = 3; g.beginPath(); g.roundRect(x, y, w, h, Math.min(22, w / 3, h / 3)); g.stroke(); });
  rr(b.neve, '#ffffff', (x, y, w, h) => { for (let k = 0; k < w * h / 400; k++) { g.fillStyle = 'rgba(160,200,230,.35)'; g.beginPath(); g.arc(x + rnd() * w, y + rnd() * h, 3 + rnd() * 4, 0, Math.PI * 2); g.fill(); } });
  rr(b.fango, '#6e4f2a', (x, y, w, h) => { for (let k = 0; k < w * h / 500; k++) { g.fillStyle = 'rgba(40,25,10,.35)'; g.beginPath(); g.ellipse(x + rnd() * w, y + rnd() * h, 4 + rnd() * 10, 3 + rnd() * 6, rnd() * 3, 0, Math.PI * 2); g.fill(); } });
  rr(b.ghiaccio, 'rgba(165,218,248,.92)', (x, y, w, h) => { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; for (let k = 0; k < w * h / 9000; k++) { const px = x + rnd() * w, py = y + rnd() * h; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 20 + rnd() * 40, py + (rnd() - 0.5) * 30); g.stroke(); } });
  for (const [x, y, w, h] of b.acqua || []) { g.fillStyle = tema === 'spazio' ? '#020208' : '#1f5f9e'; g.fillRect(x - 4, y - 4, w + 8, h + 8); }
  for (const h of b.buchiNeri || []) { const gg = g.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.r); gg.addColorStop(0, '#000'); gg.addColorStop(0.2, '#1a0630'); gg.addColorStop(0.7, 'rgba(90,40,160,.35)'); gg.addColorStop(1, 'rgba(90,40,160,0)'); g.fillStyle = gg; g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill(); }
  // piazzola di partenza
  const [px, py] = b.partenza;
  g.fillStyle = tema === 'spazio' ? 'rgba(120,200,255,.35)' : 'rgba(255,255,255,.22)'; g.beginPath(); g.roundRect(px - 30, py - 30, 60, 60, 10); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.roundRect(px - 30, py - 30, 60, 60, 10); g.stroke(); g.setLineDash([]);
  const t = texture(c);
  t.anisotropy = 8;
  return t;
}

function materialeMuro(tema, cima = false) {
  const T = TEMI[tema] || TEMI.classica;
  if (tema === 'ghiaccio') return new THREE.MeshStandardMaterial({ color: cima ? T.muroCima : T.muro, roughness: 0.15, metalness: 0.05, transparent: !cima, opacity: cima ? 1 : 0.86 });
  if (tema === 'spazio') return new THREE.MeshStandardMaterial({ color: cima ? 0x7fe0ff : T.muro, roughness: 0.35, metalness: 0.7, emissive: cima ? 0x2a8fb0 : 0x000000, emissiveIntensity: cima ? 0.8 : 0 });
  // legno: venature dipinte
  const [c, g] = tela2d(256, 64);
  const base = new THREE.Color(cima ? T.muroCima : T.muro);
  g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, 256, 64);
  const rnd = caso(cima ? 3 : 5);
  for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.1})`; g.lineWidth = 1 + rnd() * 2; const y = rnd() * 64; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + (rnd() - 0.5) * 8, 170, y + (rnd() - 0.5) * 8, 256, y); g.stroke(); }
  if (tema === 'giungla') for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(40,90,30,${0.2 + rnd() * 0.3})`; g.beginPath(); g.arc(rnd() * 256, rnd() * 64, 3 + rnd() * 8, 0, Math.PI * 2); g.fill(); }
  const t = texture(c, true); t.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
}

// ---------- modelli fatti a codice ----------
const M = {};
function mat(colore, extra = {}) { return new THREE.MeshStandardMaterial({ color: colore, roughness: 0.7, ...extra }); }
function conOmbre(o) { o.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } }); return o; }

function palma(r) {
  const g = new THREE.Group(), alto = r * 3.2;
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.35, alto, 8), mat(0x8a6236));
  tronco.position.y = alto / 2; tronco.rotation.z = 0.12; g.add(tronco);
  const foglia = new THREE.ConeGeometry(r * 0.35, r * 2.2, 4); foglia.rotateX(Math.PI / 2); foglia.translate(0, 0, r * 1.1);
  for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(foglia, mat(0x2f9a3a)); f.position.set(alto * 0.12, alto, 0); f.rotation.set(0.5, (k / 7) * Math.PI * 2, 0); f.scale.y = 0.25; g.add(f); }
  const cocco = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 8, 6), mat(0x5a3a1a)); cocco.position.set(alto * 0.12, alto - r * 0.2, r * 0.2); g.add(cocco);
  // il tronco basso è l'ostacolo: un collare di sabbia alla base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 4, 16), mat(0xe2cb8f)); base.position.y = 1; g.add(base);
  return conOmbre(g);
}
function rocciaClassica(r, rnd) {
  const geo = new THREE.DodecahedronGeometry(r, 1); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.85 + rnd() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.75, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(0x8b8d93, { flatShading: true })); m.position.y = r * 0.55;
  return conOmbre(m);
}
function bloccoGhiaccio(r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, r * 1.6, 6), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, transmission: 0.4, thickness: 10, transparent: true, opacity: 0.85 }));
  m.position.y = r * 0.8; return conOmbre(m);
}
function statua(r) {
  const g = new THREE.Group(), pietra = mat(0x8f8f7c, { flatShading: true }), muschio = mat(0x3e7a2e);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, r * 0.6, 10), pietra); base.position.y = r * 0.3; g.add(base);
  const testa = new THREE.Mesh(new THREE.BoxGeometry(r * 1.3, r * 1.7, r * 1.2), pietra); testa.position.y = r * 1.45; g.add(testa);
  const occhio = new THREE.BoxGeometry(r * 0.35, r * 0.18, 0.1 * r);
  for (const s of [-1, 1]) { const o = new THREE.Mesh(occhio, mat(0x44463a)); o.position.set(s * r * 0.3, r * 1.65, r * 0.61); g.add(o); }
  const bocca = new THREE.Mesh(new THREE.BoxGeometry(r * 0.7, r * 0.14, 0.1 * r), mat(0x44463a)); bocca.position.set(0, r * 1.05, r * 0.61); g.add(bocca);
  const m2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, r * 0.12, 6, 16, 2.2), muschio); m2.rotation.x = Math.PI / 2; m2.position.y = r * 0.6; g.add(m2);
  return conOmbre(g);
}
function pianeta(r, rnd) {
  const g = new THREE.Group();
  const colori = [0xc7814d, 0x6fb1d9, 0xd9a36f, 0x9c6fd9];
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(colori[Math.floor(rnd() * colori.length)], { roughness: 0.9 })); s.position.y = r; g.add(s);
  const anello = new THREE.Mesh(new THREE.TorusGeometry(r * 1.45, r * 0.08, 6, 32), mat(0xe8d9b0)); anello.position.y = r; anello.rotation.x = Math.PI / 2 - 0.35; g.add(anello);
  return conOmbre(g);
}
function ballaFieno(r) {
  const g = new THREE.Group();
  const [c, gg] = tela2d(128, 64); gg.fillStyle = '#e2c25a'; gg.fillRect(0, 0, 128, 64);
  const rnd = caso(11); for (let k = 0; k < 300; k++) { gg.strokeStyle = `rgba(${150 + rnd() * 60},${110 + rnd() * 50},30,.6)`; gg.beginPath(); const x = rnd() * 128, y = rnd() * 64; gg.moveTo(x, y); gg.lineTo(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 6); gg.stroke(); }
  const t = texture(c, true);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 1.5, 18), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
  m.rotation.z = Math.PI / 2; m.position.y = r; g.add(m);
  for (const s of [-0.35, 0.35]) { const fa = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.9, 4, 24), mat(0x8a3a2a)); fa.rotation.y = Math.PI / 2; fa.position.set(s * r * 1.5, r, 0); g.add(fa); }
  return conOmbre(g);
}
function roccia(tema, r, rnd) {
  if (tema === 'pirati') return palma(r);
  if (tema === 'ghiaccio') return bloccoGhiaccio(r);
  if (tema === 'giungla') return statua(r);
  if (tema === 'spazio') return pianeta(r, rnd);
  if (tema === 'colline') return ballaFieno(r);
  return rocciaClassica(r, rnd);
}

function cassa(r) {
  const [c, g] = tela2d(64, 64); g.fillStyle = '#a8743f'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#5a3818'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58); g.beginPath(); g.moveTo(3, 3); g.lineTo(61, 61); g.stroke();
  const m = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6), new THREE.MeshStandardMaterial({ map: texture(c), roughness: 0.85 }));
  m.position.y = r * 0.8; const g2 = new THREE.Group(); g2.add(m); return conOmbre(g2);
}
function pinguino(r) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 16, 12), mat(0x1d2230, { roughness: 0.5 })); corpo.scale.set(1, 1.5, 0.95); corpo.position.y = r * 1.05; g.add(corpo);
  const pancia = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 16, 12), mat(0xffffff, { roughness: 0.6 })); pancia.scale.set(0.9, 1.3, 0.7); pancia.position.set(0, r * 0.95, r * 0.25); g.add(pancia);
  const testa = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 14, 10), mat(0x1d2230)); testa.position.y = r * 2.15; g.add(testa);
  const becco = new THREE.Mesh(new THREE.ConeGeometry(r * 0.14, r * 0.4, 8), mat(0xf2a33a)); becco.rotation.x = Math.PI / 2; becco.position.set(0, r * 2.1, r * 0.5); g.add(becco);
  for (const s of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 6, 6), mat(0xffffff)); o.position.set(s * r * 0.2, r * 2.27, r * 0.42); g.add(o);
    const ala = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 8, 6), mat(0x1d2230)); ala.scale.set(0.3, 1.2, 0.7); ala.position.set(s * r * 0.75, r * 1.15, 0); ala.rotation.z = s * 0.3; g.add(ala); g.userData[s < 0 ? 'alaS' : 'alaD'] = ala;
    const piede = new THREE.Mesh(new THREE.BoxGeometry(r * 0.3, r * 0.08, r * 0.4), mat(0xf2a33a)); piede.position.set(s * r * 0.25, r * 0.04, r * 0.2); g.add(piede);
  }
  return conOmbre(g);
}
function barile(r) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 1.6, 16), mat(0x7a5230)); corpo.position.y = r * 0.8; g.add(corpo);
  for (const y of [0.3, 1.3]) { const c = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, 1.2, 4, 20), mat(0x3a3a3a, { metalness: 0.6 })); c.rotation.x = Math.PI / 2; c.position.y = r * y; g.add(c); }
  return conOmbre(g);
}
function tronco(r) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, r * 2.2, 12), mat(0x6d4a2a)); m.rotation.z = Math.PI / 2; m.position.y = r * 0.8; g.add(m);
  for (const s of [-1, 1]) { const anelli = new THREE.Mesh(new THREE.CircleGeometry(r * 0.78, 12), mat(0xc49a66)); anelli.position.set(s * r * 1.11, r * 0.8, 0); anelli.rotation.y = s * Math.PI / 2; g.add(anelli); }
  g.userData.rotola = m;
  return conOmbre(g);
}
function asteroide(r, rnd) {
  const geo = new THREE.IcosahedronGeometry(r, 1); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.75 + rnd() * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(0x7a746e, { flatShading: true, roughness: 1 })); m.position.y = r;
  const g = new THREE.Group(); g.add(m); g.userData.gira = m; return conOmbre(g);
}
function pecora(r) {
  const g = new THREE.Group(), lana = mat(0xf6f3ea, { roughness: 1 }), nero = mat(0x26221e);
  const rnd = caso(r * 13);
  for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(r * (0.45 + rnd() * 0.15), 10, 8), lana); b.position.set((rnd() - 0.5) * r * 0.9, r * (0.95 + rnd() * 0.35), (rnd() - 0.5) * r * 1.2); g.add(b); }
  const testa = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 10, 8), nero); testa.scale.set(0.9, 1, 1.3); testa.position.set(0, r * 1.15, r * 0.85); g.add(testa);
  for (const s of [-1, 1]) {
    const orecchio = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 6, 6), nero); orecchio.scale.set(1.8, 0.5, 0.8); orecchio.position.set(s * r * 0.32, r * 1.25, r * 0.8); g.add(orecchio);
    for (const z of [-0.4, 0.4]) { const z2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.6, 6), nero); z2.position.set(s * r * 0.3, r * 0.3, z * r); g.add(z2); }
  }
  return conOmbre(g);
}
function mobile(tema, r, rnd) {
  if (tema === 'pirati') return cassa(r);
  if (tema === 'ghiaccio') return pinguino(r);
  if (tema === 'giungla') return tronco(r);
  if (tema === 'spazio') return asteroide(r, rnd);
  if (tema === 'colline') return pecora(r);
  return barile(r);
}

// decorazioni fuori dal campo (alberi, palme, abeti, rocce, pianeti lontani) con InstancedMesh
function decorazioni(gruppo, b, tema, livello, rnd) {
  const T = TEMI[tema] || TEMI.classica;
  const xs = b.bordo.map((q) => q[0]), ys = b.bordo.map((q) => q[1]);
  const m = T.deco === 'palme' ? 240 : 900; // le palme solo sulla spiaggia intorno all'isola
  const x0 = Math.min(...xs) - m, x1 = Math.max(...xs) + m, y0 = Math.min(...ys) - m, y1 = Math.max(...ys) + m;
  const punti = [];
  const n = Math.min(260, Math.round(((x1 - x0) * (y1 - y0)) / 60000));
  for (let k = 0; k < n * 4 && punti.length < n; k++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    if (dentroPoligono(x, y, b.bordo) || vicinoBordo(x, y, b.bordo)[1] < (T.deco === 'palme' ? 60 : 90)) continue;
    if (T.deco === 'palme' && rnd() < 0.5) continue;
    punti.push([x, y, 0.7 + rnd() * 0.8, rnd() * Math.PI * 2]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), eul = new THREE.Euler();
  const istanze = (geo, materiale, f) => {
    const im = new THREE.InstancedMesh(geo, materiale, punti.length);
    punti.forEach((p, i) => { const [px, py, pz, s, ry] = f(p); pos.set(px, py, pz); eul.set(0, ry, 0); q.setFromEuler(eul); sc.set(s, s, s); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; gruppo.add(im);
  };
  if (T.deco === 'spazio') {
    // pianeti lontani e qualche asteroide che galleggia
    for (let k = 0; k < 6; k++) {
      const r = 120 + rnd() * 380, a = rnd() * Math.PI * 2, d = 2500 + rnd() * 2500;
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rnd(), 0.5, 0.5), roughness: 1, emissive: new THREE.Color().setHSL(rnd(), 0.6, 0.15) }));
      s.position.set(b.W / 2 + Math.cos(a) * d, -300 + rnd() * 1400, b.H / 2 + Math.sin(a) * d); gruppo.add(s);
    }
    return;
  }
  if (T.deco === 'palme') {
    istanze(new THREE.CylinderGeometry(4, 7, 90, 6).translate(0, 45, 0), mat(0x8a6236), ([x, y, s, r]) => [x, livello, y, s, r]);
    const foglie = new THREE.ConeGeometry(55, 30, 7).translate(0, 98, 0);
    istanze(foglie, mat(0x2f9a3a, { flatShading: true }), ([x, y, s, r]) => [x, livello, y, s, r]);
    return;
  }
  if (T.deco === 'abeti') {
    istanze(new THREE.CylinderGeometry(4, 5, 30, 6).translate(0, 15, 0), mat(0x5a3a1e), ([x, y, s, r]) => [x, livello, y, s, r]);
    istanze(new THREE.ConeGeometry(34, 110, 8).translate(0, 80, 0), mat(0x2e5a3e, { flatShading: true }), ([x, y, s, r]) => [x, livello, y, s, r]);
    istanze(new THREE.ConeGeometry(24, 50, 8).translate(0, 118, 0), mat(0xffffff, { flatShading: true }), ([x, y, s, r]) => [x, livello, y, s, r]);
    return;
  }
  if (T.deco === 'colline') {
    // dolci colline intorno e alberi rotondi
    for (let k = 0; k < 14; k++) {
      const a = rnd() * Math.PI * 2, d = Math.max(b.W, b.H) * 0.7 + 400 + rnd() * 1200, r = 400 + rnd() * 600;
      const h = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(new THREE.Color(T.fuori).offsetHSL(0, 0, (rnd() - 0.5) * 0.08)));
      h.scale.y = 0.35; h.position.set(b.W / 2 + Math.cos(a) * d, livello - 2, b.H / 2 + Math.sin(a) * d); h.receiveShadow = true; gruppo.add(h);
    }
  }
  istanze(new THREE.CylinderGeometry(5, 8, 50, 6).translate(0, 25, 0), mat(0x6b4a2a), ([x, y, s, r]) => [x, livello, y, s, r]);
  const verde = T.deco === 'giungla' ? 0x2a6a2e : 0x3f9a45;
  istanze(new THREE.IcosahedronGeometry(42, 1).translate(0, 78, 0), mat(verde, { flatShading: true }), ([x, y, s, r]) => [x, livello, y, s, r]);
  if (T.deco === 'giungla') istanze(new THREE.IcosahedronGeometry(30, 0).translate(18, 110, 10), mat(0x1f5a28, { flatShading: true }), ([x, y, s, r]) => [x, livello, y, s, r]);
}

// una striscia piatta che segue il terreno (la freccia della mira)
class Striscia {
  constructor(n, colore, opacita) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: opacita, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.renderOrder = 5; this.mesh.frustumCulled = false;
    this.colore = new THREE.Color(colore);
  }
  // da (x, y) in direzione a per lunghezza l, larga w (che si stringe in punta se punta = true)
  metti(b, x, y, a, l, w, colori, punta) {
    const pos = this.mesh.geometry.attributes.position, col = this.mesh.geometry.attributes.color;
    const c = Math.cos(a), s = Math.sin(a), nx = -s, ny = c;
    for (let i = 0; i < this.n; i++) {
      const u = i / (this.n - 1), px = x + c * l * u, py = y + s * l * u;
      const ww = punta && u > 0.8 ? w * 2.4 * (1 - u) / 0.2 : w;
      const h = quotaVista(b, px, py) + 1.2;
      pos.setXYZ(i * 2, px + nx * ww, h, py + ny * ww); pos.setXYZ(i * 2 + 1, px - nx * ww, h, py - ny * ww);
      const cc = colori ? colori(u) : this.colore;
      col.setXYZ(i * 2, cc.r, cc.g, cc.b); col.setXYZ(i * 2 + 1, cc.r, cc.g, cc.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}

function etichetta(testo, colore) {
  const [c, g] = tela2d(256, 64);
  g.font = '700 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(250, g.measureText(testo).width + 28);
  g.fillStyle = 'rgba(10,20,30,.62)'; g.beginPath(); g.roundRect(128 - w / 2, 10, w, 44, 22); g.fill();
  g.fillStyle = colore; g.beginPath(); g.arc(128 - w / 2 + 18, 32, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.fillText(testo, 128 + 8, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(0.16, 0.04, 1); s.renderOrder = 10;
  return s;
}

function dipingiPallina(colore) {
  const [c, g] = tela2d(128, 64);
  g.fillStyle = colore; g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 28, 128, 8);
  for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.beginPath(); g.arc((k * 37) % 128, (k * 23) % 64, 3, 0, Math.PI * 2); g.fill(); }
  return texture(c);
}

// ======================================================================================
export function crea(tela) {
  const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 2, 20000);
  const emi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.1); scena.add(emi);
  const sole = new THREE.DirectionalLight(0xffffff, 2.2);
  sole.castShadow = true; sole.shadow.mapSize.set(2048, 2048);
  Object.assign(sole.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 10, far: 3000 });
  sole.shadow.bias = -0.0006; sole.shadow.normalBias = 0.6;
  scena.add(sole, sole.target);

  let mondo = null, chiave = null, b = null, tema = 'classica';
  let palle = [], vecchiePalle = [], etichette = [];
  let anim = { mulini: [], scorrevoli: [], mobili: [], respingenti: [], scatole: [], neri: [], acqua: [], mare: null, bandiera: null, neve: null };
  const mira = new Striscia(40, 0xffffff, 0.95), guida = new Striscia(30, 0xffffff, 0.35);
  scena.add(mira.mesh, guida.mesh);
  const coriandoli = [];
  const cam = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, pronta: false };
  const tmp = new THREE.Color();

  function svuota() {
    if (!mondo) return;
    scena.remove(mondo);
    mondo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
    });
    mondo = null;
  }

  // ---------------- costruzione della buca ----------------
  function costruisci(rif, buca, nomeTema, colori, nomi) {
    const k = `${rif[0]}/${rif[1]}`;
    if (k === chiave && mondo) return;
    svuota(); chiave = k; b = buca; tema = nomeTema; b._spazio = tema === 'spazio';
    segFissi = PB.segmentiFissi(b);
    const T = TEMI[tema] || TEMI.classica;
    const rnd = caso(rif[1] * 31 + rif[0].length * 7 + 1);
    mondo = new THREE.Group(); scena.add(mondo);
    // cielo, luci, nebbia
    const [cc, gg] = tela2d(4, 256); const gr = gg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, T.cielo[0]); gr.addColorStop(1, T.cielo[1]); gg.fillStyle = gr; gg.fillRect(0, 0, 4, 256);
    scena.background = texture(cc);
    scena.fog = new THREE.Fog(T.nebbia, 3000, 9000);
    emi.color.set(tema === 'spazio' ? 0x8090ff : 0xffffff); emi.groundColor.set(tema === 'spazio' ? 0x221133 : 0x445533); emi.intensity = tema === 'spazio' ? 0.75 : 1.1;
    sole.color.set(T.sole); sole.intensity = tema === 'spazio' ? 1.6 : tema === 'ghiaccio' ? 1.45 : 2.3;
    if (tema === 'ghiaccio') emi.intensity = 0.75;

    const xs = b.bordo.map((q) => q[0]), ys = b.bordo.map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    // ---- il prato: griglia che segue il bordo ----
    const C = 18, nx = Math.ceil((maxX - minX) / C) + 2, ny = Math.ceil((maxY - minY) / C) + 2;
    const pos = [], uv = [], ok = [], idx = [];
    let qMin = Infinity;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let x = Math.min(maxX, minX + i * C), y = Math.min(maxY, minY + j * C);
      const d = dentroPoligono(x, y, b.bordo);
      if (!d) [[x, y]] = vicinoBordo(x, y, b.bordo);
      const h = quotaVista(b, x, y); qMin = Math.min(qMin, h);
      pos.push(x, h, y); uv.push(x / b.W, 1 - y / b.H); ok.push(d);
    }
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b2 = a + 1, c = a + nx, d = c + 1;
      if (ok[a] || ok[b2] || ok[c]) idx.push(a, c, b2);
      if (ok[b2] || ok[c] || ok[d]) idx.push(b2, c, d);
    }
    const gp = new THREE.BufferGeometry();
    gp.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gp.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gp.setIndex(idx); gp.computeVertexNormals();
    const prato = new THREE.Mesh(gp, new THREE.MeshStandardMaterial({ map: dipingiPrato(b, tema), roughness: tema === 'ghiaccio' ? 0.35 : 0.92, metalness: tema === 'spazio' ? 0.3 : 0 }));
    prato.receiveShadow = true; mondo.add(prato);
    // ---- l'isola: i fianchi dal bordo fino al mondo di sotto ----
    const livello = Math.min(qMin, 0) - (tema === 'spazio' ? 260 : 46);
    {
      const p2 = [], i2 = [];
      const giro = b.bordo;
      for (let i = 0; i < giro.length; i++) {
        const [x1, y1] = giro[i], [x2, y2] = giro[(i + 1) % giro.length];
        const passi = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 40));
        for (let s = 0; s < passi; s++) {
          const ax = x1 + ((x2 - x1) * s) / passi, ay = y1 + ((y2 - y1) * s) / passi, bx = x1 + ((x2 - x1) * (s + 1)) / passi, by = y1 + ((y2 - y1) * (s + 1)) / passi;
          const n0 = p2.length / 3;
          p2.push(ax, quotaVista(b, ax, ay) + 1, ay, bx, quotaVista(b, bx, by) + 1, by, ax, livello, ay, bx, livello, by);
          i2.push(n0, n0 + 2, n0 + 1, n0 + 1, n0 + 2, n0 + 3);
        }
      }
      const gf = new THREE.BufferGeometry(); gf.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); gf.setIndex(i2); gf.computeVertexNormals();
      const fianco = new THREE.Mesh(gf, mat(T.terra, { side: THREE.DoubleSide, roughness: 1, flatShading: true }));
      fianco.receiveShadow = true; mondo.add(fianco);
    }
    // ---- il mondo intorno ----
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, grande = Math.max(maxX - minX, maxY - minY) + 9000;
    if (T.mare) {
      const gm = new THREE.PlaneGeometry(grande, grande, 80, 80); gm.rotateX(-Math.PI / 2);
      const mare = new THREE.Mesh(gm, new THREE.MeshStandardMaterial({ color: 0x1f8fb0, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.95 }));
      mare.position.set(cx, livello + 8, cy); mondo.add(mare); anim.mare = mare;
      const fondo = new THREE.Mesh(new THREE.PlaneGeometry(grande, grande).rotateX(-Math.PI / 2), mat(0xd9c08a)); fondo.position.set(cx, livello - 30, cy); mondo.add(fondo);
      // la spiaggia intorno all'isola
      const bordoSabbia = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX + 260, maxY - minY + 260).rotateX(-Math.PI / 2), mat(0xe9d39a));
      bordoSabbia.position.set(cx, livello + 6, cy); bordoSabbia.receiveShadow = true; mondo.add(bordoSabbia);
    } else if (T.fuori !== null) {
      const terra = new THREE.Mesh(new THREE.PlaneGeometry(grande, grande).rotateX(-Math.PI / 2), mat(T.fuori, { roughness: 1 }));
      terra.position.set(cx, livello, cy); terra.receiveShadow = true; mondo.add(terra);
    } else {
      // spazio: stelle tutto intorno
      const st = new THREE.BufferGeometry(), pp = [];
      for (let k = 0; k < 2500; k++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 8000; pp.push(cx + Math.sqrt(1 - u * u) * Math.cos(a) * r, u * r, cy + Math.sqrt(1 - u * u) * Math.sin(a) * r); }
      st.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
      mondo.add(new THREE.Points(st, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })));
    }
    decorazioni(mondo, b, tema, T.mare ? livello + 8 : livello, rnd);
    if (T.neve) {
      const gn = new THREE.BufferGeometry(), pn = new Float32Array(1500 * 3);
      for (let k = 0; k < 1500; k++) { pn[k * 3] = (rnd() - 0.5) * 1600; pn[k * 3 + 1] = rnd() * 600; pn[k * 3 + 2] = (rnd() - 0.5) * 1600; }
      gn.setAttribute('position', new THREE.BufferAttribute(pn, 3));
      anim.neve = new THREE.Points(gn, new THREE.PointsMaterial({ color: 0xffffff, size: 3, transparent: true, opacity: 0.85 }));
      anim.neve.frustumCulled = false; mondo.add(anim.neve);
    }
    // ---- acqua (o vuoto nello spazio) ----
    for (const [x, y, w, h] of b.acqua || []) {
      if (tema === 'spazio') {
        const vuoto = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x05030f }));
        vuoto.position.set(x + w / 2, quotaVista(b, x + w / 2, y + h / 2) + 1, y + h / 2); mondo.add(vuoto);
        const bordo = new THREE.Mesh(new THREE.PlaneGeometry(w + 6, h + 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a5cff, transparent: true, opacity: 0.35 }));
        bordo.position.copy(vuoto.position); bordo.position.y -= 0.5; mondo.add(bordo);
        continue;
      }
      const g = new THREE.PlaneGeometry(w + 4, h + 4, Math.ceil(w / 30), Math.ceil(h / 30)); g.rotateX(-Math.PI / 2);
      const acqua = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: tema === 'ghiaccio' ? 0x2b6f9c : 0x2a8fe0, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.82 }));
      acqua.position.set(x + w / 2, PB.quota(b, x + w / 2, y + h / 2) - 5, y + h / 2); acqua.receiveShadow = true; mondo.add(acqua); anim.acqua.push(acqua);
    }
    // ---- muri: assi lungo i segmenti, spezzate se il terreno sale e scende ----
    const mMuro = materialeMuro(tema), mCima = materialeMuro(tema, true);
    pezziMuro = []; vetro = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
    const muro = (sg, alto, spesso, m1, m2) => {
      const [x1, y1, x2, y2] = sg, L = Math.hypot(x2 - x1, y2 - y1); if (L < 1) return;
      const a = Math.atan2(y2 - y1, x2 - x1), pezzi = Math.max(1, Math.ceil(L / 90));
      for (let s = 0; s < pezzi; s++) {
        const u0 = s / pezzi, u1 = (s + 1) / pezzi, l = L / pezzi + spesso * (s === pezzi - 1 || s === 0 ? 1 : 0.2);
        const mx = x1 + (x2 - x1) * (u0 + u1) / 2, my = y1 + (y2 - y1) * (u0 + u1) / 2;
        const qa = quotaVista(b, x1 + (x2 - x1) * u0, y1 + (y2 - y1) * u0), qb = quotaVista(b, x1 + (x2 - x1) * u1, y1 + (y2 - y1) * u1), qm = quotaVista(b, mx, my);
        const giu = Math.min(qa, qb, qm) - 6, su = Math.max(qa, qb, qm) + alto;
        const box = new THREE.Mesh(new THREE.BoxGeometry(l, su - giu, spesso), m1);
        box.position.set(mx, (su + giu) / 2, my); box.rotation.y = -a; box.castShadow = true; box.receiveShadow = true; mondo.add(box);
        const cima = new THREE.Mesh(new THREE.BoxGeometry(l + 0.5, 3, spesso + 3), m2);
        cima.position.set(mx, su + 1.5, my); cima.rotation.y = -a; cima.castShadow = true; mondo.add(cima);
        pezziMuro.push({ box, cima, x: mx, y: my, m1, m2, l });
      }
    };
    for (const sg of PB.segmentiFissi(b)) muro(sg, 16, 14, mMuro, mCima);
    for (const sg of b.muretti || []) muro(sg, 6, 10, mat(0xb08a5a), mat(0xe3c89a));
    // ---- respingenti ----
    for (const [x, y, r] of b.respingenti || []) {
      const g = new THREE.Group(), q = quotaVista(b, x, y);
      const corpo = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 18, 28), mat(tema === 'spazio' ? 0xd65ab8 : 0xe0453f, { roughness: 0.35, emissive: tema === 'spazio' ? 0x5a1050 : 0x330000 }));
      corpo.position.y = 9; g.add(corpo);
      const anello = new THREE.Mesh(new THREE.TorusGeometry(r * 0.72, 2.4, 8, 32), mat(0xffffff, { roughness: 0.3 })); anello.rotation.x = Math.PI / 2; anello.position.y = 18.5; g.add(anello);
      const cappello = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.5, 6, 20), mat(0xffd23f, { metalness: 0.4, roughness: 0.3 })); cappello.position.y = 21; g.add(cappello);
      g.position.set(x, q - 2, y); conOmbre(g); mondo.add(g); anim.respingenti.push({ g, x, y, r, colpo: 0 });
    }
    for (const [x, y, r] of b.rocce || []) { const o = roccia(tema, r, rnd); o.position.set(x, quotaVista(b, x, y) - 1, y); o.rotation.y = rnd() * 6; mondo.add(o); }
    for (const mb of b.mobili || []) { const o = mobile(tema, mb.r, rnd); mondo.add(o); anim.mobili.push({ o, m: mb, px: null, py: null }); }
    // ---- mulini: il perno e le pale che girano ----
    for (const m of b.mulini || []) {
      const g = new THREE.Group(), q = quotaVista(b, m.x, m.y);
      const perno = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 34, 16), mat(0x6b4423)); perno.position.y = 17; g.add(perno);
      const tetto = new THREE.Mesh(new THREE.ConeGeometry(16, 14, 16), mat(0xb03a2e)); tetto.position.y = 41; g.add(tetto);
      const pale = new THREE.Group(); pale.position.y = 9;
      const tinta = tema === 'spazio' ? 0x8ad8ff : tema === 'giungla' ? 0x6d4a2a : 0xe05a47;
      for (let k = 0; k < m.pale; k++) {
        const pala = new THREE.Mesh(new THREE.BoxGeometry(m.l * 2, 14, 10), mat(tinta, { roughness: 0.6, emissive: tema === 'spazio' ? 0x1a5a7a : 0 }));
        pala.rotation.y = -(k * Math.PI) / m.pale; pale.add(pala);
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(m.l * 2 + 1, 4, 11), mat(0xffffff)); fascia.rotation.y = pala.rotation.y; fascia.position.y = 3; pale.add(fascia);
      }
      g.add(pale); g.position.set(m.x, q, m.y); conOmbre(g); mondo.add(g); anim.mulini.push({ pale, m });
    }
    // ---- porte scorrevoli ----
    for (const r of b.scorrevoli || []) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(r.w, 26, r.h), mat(tema === 'ghiaccio' ? 0xf4f9fd : 0x8e55c9, { roughness: 0.4 }));
      const strisce = new THREE.Mesh(new THREE.BoxGeometry(r.w + 0.6, 5, r.h + 0.6), mat(tema === 'ghiaccio' ? 0x9cc4e0 : 0xffd23f)); strisce.position.y = 6; box.add(strisce);
      conOmbre(box); mondo.add(box); anim.scorrevoli.push({ box, r });
    }
    // ---- rampe ----
    for (const rp of b.rampe || []) {
      const [x, y, w, h] = rp.r, lungoX = Math.abs(Math.cos(rp.a)) > 0.5, L = lungoX ? w : h, W = lungoX ? h : w, H = 14;
      const geo = new THREE.BufferGeometry();
      const v = [-L / 2, 0, -W / 2, L / 2, H, -W / 2, L / 2, 0, -W / 2, -L / 2, 0, W / 2, L / 2, H, W / 2, L / 2, 0, W / 2];
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      geo.setIndex([0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 2, 1, 4, 2, 4, 5, 0, 2, 5, 0, 5, 3]); geo.computeVertexNormals();
      const ramp = new THREE.Mesh(geo, mat(0xc98b3a, { flatShading: true }));
      const ang = lungoX ? (Math.cos(rp.a) > 0 ? 0 : Math.PI) : (Math.sin(rp.a) > 0 ? Math.PI / 2 : -Math.PI / 2);
      ramp.position.set(x + w / 2, quotaVista(b, x + w / 2, y + h / 2), y + h / 2); ramp.rotation.y = -ang; conOmbre(ramp); mondo.add(ramp);
      for (let k = -1; k <= 1; k++) {
        const fr = new THREE.Mesh(new THREE.BoxGeometry(6, 1, W * 0.5), mat(0xf6d28a)); fr.position.set(k * L * 0.25, H * (0.5 + k * 0.25) + 0.8, 0); fr.rotation.z = Math.atan2(H, L); ramp.add(fr);
      }
    }
    // ---- tubi: entrata (scura) e uscita (chiara) ----
    for (const tu of b.tubi || []) {
      for (const [p, c] of [[tu.a, 0x2a2d35], [tu.b, 0x9aa3b0]]) {
        const g = new THREE.Group(), q = quotaVista(b, p[0], p[1]);
        const anello = new THREE.Mesh(new THREE.TorusGeometry(PB.R_TUBO + 3, 4, 10, 28), mat(0xa9b2bf, { metalness: 0.7, roughness: 0.3 })); anello.rotation.x = Math.PI / 2; anello.position.y = 2; g.add(anello);
        const buco = new THREE.Mesh(new THREE.CircleGeometry(PB.R_TUBO, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c === 0x2a2d35 ? 0x050608 : 0x3a3f4a })); buco.position.y = 0.6; g.add(buco);
        const luce = new THREE.Mesh(new THREE.TorusGeometry(PB.R_TUBO + 9, 1.2, 6, 28), new THREE.MeshBasicMaterial({ color: c === 0x2a2d35 ? 0x5fff8a : 0xffa94d, transparent: true, opacity: 0.8 })); luce.rotation.x = Math.PI / 2; luce.position.y = 1; g.add(luce);
        g.position.set(p[0], q, p[1]); mondo.add(g);
      }
    }
    // ---- buchi neri ----
    for (const h of b.buchiNeri || []) {
      const [c, g] = tela2d(256, 256);
      for (let k = 0; k < 5; k++) { g.strokeStyle = `rgba(${180 + k * 10},${140 + k * 15},255,${0.5 - k * 0.07})`; g.lineWidth = 6; g.beginPath(); for (let a = 0; a < 9; a += 0.05) { const r = 12 + a * 13 + k * 3; g.lineTo(128 + Math.cos(a + k * 1.25) * r, 128 + Math.sin(a + k * 1.25) * r); } g.stroke(); }
      const disco = new THREE.Mesh(new THREE.CircleGeometry(h.r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texture(c), transparent: true, depthWrite: false }));
      disco.position.set(h.x, quotaVista(b, h.x, h.y) + 0.8, h.y); mondo.add(disco);
      const centro = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000 })); centro.position.set(h.x, quotaVista(b, h.x, h.y) + 4, h.y); mondo.add(centro);
      anim.neri.push(disco);
    }
    // ---- scatole dei superpoteri ----
    {
      const [c, g] = tela2d(64, 64); g.fillStyle = '#f2c230'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e0473c'; g.fillRect(26, 0, 12, 64); g.fillRect(0, 26, 64, 12);
      g.fillStyle = '#fff'; g.font = '900 30px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 32, 33);
      const tx = texture(c);
      (b.pu || []).forEach(([x, y]) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.4, emissive: 0x332200, transparent: true }));
        const alone = new THREE.Mesh(new THREE.RingGeometry(14, 20, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.5, depthWrite: false }));
        alone.position.set(x, quotaVista(b, x, y) + 0.7, y);
        box.castShadow = true; mondo.add(box, alone); anim.scatole.push({ box, alone, x, y, q: quotaVista(b, x, y) });
      });
    }
    // ---- la buca e la bandierina ----
    {
      const [bx, by] = b.buca, q = quotaVista(b, bx, by);
      const buco = new THREE.Mesh(new THREE.CircleGeometry(PB.R_BUCA, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050505 })); buco.position.set(bx, q + 0.35, by); mondo.add(buco);
      const labbro = new THREE.Mesh(new THREE.RingGeometry(PB.R_BUCA, PB.R_BUCA + 2.2, 32).rotateX(-Math.PI / 2), mat(0xffffff)); labbro.position.set(bx, q + 0.4, by); mondo.add(labbro);
      const asta = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 70, 8), mat(0xf2f2f2, { metalness: 0.3 })); asta.position.set(bx, q + 35, by); asta.castShadow = true; mondo.add(asta);
      const gb = new THREE.PlaneGeometry(30, 19, 10, 2); gb.translate(15, 0, 0);
      const bandiera = new THREE.Mesh(gb, mat(0xe0473c, { side: THREE.DoubleSide, roughness: 0.8 })); bandiera.position.set(bx, q + 60, by); bandiera.castShadow = true; mondo.add(bandiera);
      anim.bandiera = { m: bandiera, base: gb.attributes.position.array.slice(), asta };
      // un anello di luce che si vede da lontano
      const faro = new THREE.Mesh(new THREE.CylinderGeometry(PB.R_BUCA + 3, PB.R_BUCA + 3, 300, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      faro.position.set(bx, q + 150, by); mondo.add(faro); anim.faro = faro;
    }
    // ---- palline ----
    palle = []; etichette = [];
    vecchiePalle.forEach((x) => scena.remove(x)); vecchiePalle = [];
    cam.pronta = false;
    preparaPalle(colori, nomi);
  }

  function preparaPalle(colori, nomi) {
    for (let i = palle.length; i < colori.length; i++) {
      const sfera = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 18), new THREE.MeshStandardMaterial({ map: dipingiPallina(colori[i]), roughness: 0.3, metalness: 0.05, transparent: true }));
      sfera.castShadow = true;
      const aura = new THREE.Mesh(new THREE.TorusGeometry(R + 5, 1.6, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85 }));
      aura.rotation.x = Math.PI / 2; aura.visible = false;
      const scia = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3)), new THREE.LineBasicMaterial({ color: colori[i], transparent: true, opacity: 0.55 }));
      scia.frustumCulled = false; scia.userData.punti = [];
      const et = etichetta(nomi[i] || `G${i + 1}`, colori[i]);
      const g = new THREE.Group(); g.add(sfera, aura);
      scena.add(g, scia, et); vecchiePalle.push(g, scia, et);
      palle.push({ g, sfera, aura, scia, et, nome: nomi[i], x: null, y: null, dentro: false });
    }
    palle.forEach((p, i) => { if (p.nome !== nomi[i]) { scena.remove(p.et); const et = etichetta(nomi[i] || `G${i + 1}`, colori[i]); scena.add(et); vecchiePalle.push(et); p.et = et; p.nome = nomi[i]; } });
  }

  function botto(x, y, z, colore) {
    const n = 90, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [], c = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      p[k * 3] = x; p[k * 3 + 1] = z; p[k * 3 + 2] = y; const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
      v.push([Math.cos(a) * s, 180 + Math.random() * 220, Math.sin(a) * s]);
      tmp.setHSL(Math.random(), 0.9, 0.6); if (k % 3 === 0) tmp.set(colore); c[k * 3] = tmp.r; c[k * 3 + 1] = tmp.g; c[k * 3 + 2] = tmp.b;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const pt = new THREE.Points(g, new THREE.PointsMaterial({ size: 5, vertexColors: true, transparent: true }));
    pt.frustumCulled = false; scena.add(pt); coriandoli.push({ pt, v, t: 0 });
  }

  // quanto si va dritti da (x, y) nella direzione a prima di toccare un muro (al massimo max)
  let segFissi = [], pezziMuro = [], vetro = null;
  // i pezzi di muro tra la telecamera e la pallina diventano trasparenti (così non coprono mezza scena)
  function muriTrasparenti(cx, cy, bx, by) {
    const vx = bx - cx, vy = by - cy, l = Math.hypot(vx, vy) || 1;
    for (const p of pezziMuro) {
      const t = ((p.x - cx) * vx + (p.y - cy) * vy) / (l * l), d = Math.abs((p.x - cx) * vy - (p.y - cy) * vx) / l;
      const via = bx !== null && t > -0.3 && t < 0.8 && d < 70 + p.l / 2;
      p.box.material = via ? vetro : p.m1; p.cima.material = via ? vetro : p.m2; p.box.castShadow = !via;
    }
  }
  function raggioMuri(x0, y0, a, max) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = max;
    for (const [x1, y1, x2, y2] of segFissi) {
      const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((x1 - x0) * ey - (y1 - y0) * ex) / den, u = ((x1 - x0) * dy - (y1 - y0) * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
    }
    return best;
  }

  // ---------------- un fotogramma ----------------
  // s = { t, palle: [{ x, y, z, d, m, ...}], mio, colori, nomi, usciti, prese, mira: { a, f, carica, nascosta } | null,
  //       camera: { yaw, pitch, dist, alto, segui }, nebbia, scossa, dt }
  let ultimoT = null;
  function disegna(s) {
    if (!mondo || !b) return;
    const t = s.t, dt = s.dt;
    // ostacoli che si muovono (dal tempo della buca, uguale al server)
    for (const { pale, m } of anim.mulini) pale.rotation.y = -(m.w * t);
    for (const { box, r } of anim.scorrevoli) { const [x, y, w, h] = PB.rettScorrevole(r, t); box.position.set(x + w / 2, quotaVista(b, x + w / 2, y + h / 2) + 13, y + h / 2); }
    const cerchi = PB.mobiliAl(b, t);
    anim.mobili.forEach((o, k) => {
      const [x, y] = cerchi[k];
      if (o.px !== null) { const dx = x - o.px, dy = y - o.py; if (Math.hypot(dx, dy) > 0.05) o.o.rotation.y = Math.atan2(dx, dy); }
      o.o.position.set(x, quotaVista(b, x, y), y); o.px = x; o.py = y;
      if (o.o.userData.gira) o.o.userData.gira.rotation.set(t * 0.7, t * 0.5, 0);
      if (o.o.userData.alaS) { o.o.userData.alaS.rotation.z = -0.3 - Math.abs(Math.sin(t * 8)) * 0.4; o.o.userData.alaD.rotation.z = 0.3 + Math.abs(Math.sin(t * 8)) * 0.4; o.o.position.y += Math.abs(Math.sin(t * 8)) * 1.5; }
    });
    for (const d of anim.neri) d.rotation.y = t * 1.5;
    for (const a of anim.acqua) { a.material.color.offsetHSL(0, 0, 0); a.position.y += Math.sin(t * 2) * 0.01; }
    if (anim.mare) { const p = anim.mare.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x / 90 + t * 1.3) * 3 + Math.cos(z / 120 + t) * 3); } p.needsUpdate = true; anim.mare.geometry.computeVertexNormals(); }
    if (anim.bandiera) { const bp = anim.bandiera.m.geometry.attributes.position, base = anim.bandiera.base; for (let i = 0; i < bp.count; i++) { const x = base[i * 3]; bp.setZ(i, Math.sin(x / 7 - t * 6) * (x / 30) * 4); } bp.needsUpdate = true; }
    if (anim.faro) anim.faro.material.opacity = 0.08 + Math.sin(t * 2) * 0.04;
    anim.scatole.forEach((sc, k) => {
      const presa = (s.prese || []).includes(k);
      sc.box.position.set(sc.x, sc.q + 16 + Math.sin(t * 3 + k) * 3, sc.y); sc.box.rotation.set(0.3, t * 1.4 + k, 0.2);
      sc.box.material.opacity = presa ? 0.22 : 1; sc.alone.visible = !presa;
    });
    // respingenti che "saltano" quando una pallina li tocca
    for (const r of anim.respingenti) {
      if (s.palle.some((q) => q && !q.d && Math.hypot(q.x - r.x, q.y - r.y) < r.r + R + 3)) r.colpo = 1;
      r.colpo = Math.max(0, r.colpo - dt * 4); const k = 1 + r.colpo * 0.15; r.g.scale.set(k, 1 - r.colpo * 0.1, k);
    }
    // ---- palline ----
    let mia = null;
    s.palle.forEach((q, i) => {
      const P = palle[i]; if (!P) return;
      const via = !q || q.d || (s.usciti && s.usciti[i]);
      if (via) {
        if (q && q.d && !P.dentro && P.x !== null && s.botti) botto(b.buca[0], b.buca[1], quotaVista(b, b.buca[0], b.buca[1]) + 5, s.colori[i]);
        P.g.visible = false; P.et.visible = false; P.scia.visible = false; P.dentro = !!(q && q.d); return;
      }
      P.dentro = false;
      const h = quotaVista(b, q.x, q.y) + R + (q.z || 0);
      // rotola: gira intorno all'asse perpendicolare al movimento
      if (P.x !== null) {
        const dx = q.x - P.x, dy = q.y - P.y, l = Math.hypot(dx, dy);
        if (l > 0.01 && l < 200) { const asse = new THREE.Vector3(dy / l, 0, -dx / l); P.sfera.rotateOnWorldAxis(asse, l / R); }
      }
      P.x = q.x; P.y = q.y;
      P.g.position.set(q.x, h, q.y); P.g.visible = true;
      const io = i === s.mio;
      P.sfera.material.opacity = io ? 1 : 0.78;
      P.sfera.material.emissive && P.sfera.material.emissive.set(q.fa ? 0x6688aa : 0x000000);
      if (q.fa) P.sfera.material.opacity = 0.45;
      // l'aura dei poteri pronti
      const pronti = q.pt || [];
      P.aura.visible = pronti.length > 0 || !!q.co;
      if (P.aura.visible) { P.aura.material.color.set(q.co ? 0xc28a1a : pronti.includes('turbo') ? 0xff7a1a : pronti.includes('calamita') ? 0x5fd3ff : pronti.includes('molla') ? 0x9dff7a : 0xe6e6ff); P.aura.position.y = -R + 1.5; P.aura.scale.setScalar(1 + Math.sin(t * 7) * 0.08); }
      // il nome degli altri (non sopra la mia pallina: se sono vicini lo si toglie)
      const mq = s.palle[s.mio];
      P.et.visible = !io && !(mq && !mq.d && Math.hypot(q.x - mq.x, q.y - mq.y) < 40);
      P.et.position.set(q.x, h + 22, q.y);
      // la scia quando corre
      const pts = P.scia.userData.punti;
      if (q.m) { pts.push([q.x, h, q.y]); if (pts.length > 30) pts.shift(); } else if (pts.length) pts.shift();
      const arr = P.scia.geometry.attributes.position;
      for (let k = 0; k < 30; k++) { const pp = pts[Math.min(pts.length - 1, k)] || [q.x, h, q.y]; arr.setXYZ(k, pp[0], pp[1], pp[2]); }
      arr.needsUpdate = true; P.scia.visible = pts.length > 1; P.scia.geometry.setDrawRange(0, Math.max(2, pts.length));
      if (io) mia = { x: q.x, y: q.y, h };
    });
    // ---- coriandoli ----
    for (let k = coriandoli.length - 1; k >= 0; k--) {
      const c = coriandoli[k]; c.t += dt; const p = c.pt.geometry.attributes.position;
      c.v.forEach((v, j) => { v[1] -= 500 * dt; p.setXYZ(j, p.getX(j) + v[0] * dt, p.getY(j) + v[1] * dt, p.getZ(j) + v[2] * dt); });
      p.needsUpdate = true; c.pt.material.opacity = Math.max(0, 1 - c.t / 1.8);
      if (c.t > 1.8) { scena.remove(c.pt); c.pt.geometry.dispose(); c.pt.material.dispose(); coriandoli.splice(k, 1); }
    }
    // ---- la mira ----
    mira.mesh.visible = false; guida.mesh.visible = false;
    if (s.mira && mia) {
      const { a, f, carica, nascosta } = s.mira;
      if (!nascosta) {
        guida.mesh.visible = true; guida.metti(b, mia.x, mia.y, a, 260, 1.2, null, false);
        if (carica && f > 0) { mira.mesh.visible = true; mira.metti(b, mia.x, mia.y, a, 25 + f * 240, 4.5, (u) => tmp.setHSL((120 - f * u * 120) / 360, 0.9, 0.55), true); }
      }
    }
    // ---- telecamera ----
    const C = s.camera;
    let tx, ty, tz, pos;
    if (C.alto || !C.segui) {
      const xs = b.bordo.map((q) => q[0]), ys = b.bordo.map((q) => q[1]);
      tx = (Math.min(...xs) + Math.max(...xs)) / 2; tz = (Math.min(...ys) + Math.max(...ys)) / 2; ty = 0;
      const dist = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * camera.aspect) * 0.95 / camera.aspect + 300;
      pos = [tx - Math.cos(C.yaw) * Math.cos(1.15) * dist, ty + Math.sin(1.15) * dist, tz - Math.sin(C.yaw) * Math.cos(1.15) * dist];
    } else {
      tx = C.segui.x; tz = C.segui.y; ty = quotaVista(b, tx, tz) + R;
      const avanti = 40; tx += Math.cos(C.yaw) * avanti; tz += Math.sin(C.yaw) * avanti;
      // se dietro la pallina c'è un muro che la coprirebbe, la telecamera si avvicina
      let oriz = Math.cos(C.pitch) * C.dist, su = Math.sin(C.pitch) * C.dist;
      const muro = raggioMuri(C.segui.x, C.segui.y, C.yaw + Math.PI, oriz + 20);
      // (solo se il muro copre davvero la pallina: altrimenti la telecamera resta fuori e guarda sopra il muro)
      if (muro < oriz + 20 && su * (muro / oriz) < 22) { oriz = Math.max(18, muro - 22); su = Math.max(su, 40); }
      pos = [C.segui.x - Math.cos(C.yaw) * oriz, ty + su + 6, C.segui.y - Math.sin(C.yaw) * oriz];
      const terra = quotaVista(b, pos[0], pos[2]) + 14; if (pos[1] < terra) pos[1] = terra;
    }
    const k = cam.pronta ? 1 - Math.pow(0.0015, dt) : 1;
    cam.x += (pos[0] - cam.x) * k; cam.y += (pos[1] - cam.y) * k; cam.z += (pos[2] - cam.z) * k;
    cam.tx += (tx - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tz - cam.tz) * k; cam.pronta = true;
    let sx = 0, sy = 0;
    if (s.scossa > 0) { sx = (Math.random() - 0.5) * s.scossa * 10; sy = (Math.random() - 0.5) * s.scossa * 10; }
    camera.position.set(cam.x + sx, cam.y + sy, cam.z);
    if (C.segui && !C.alto) muriTrasparenti(cam.x, cam.z, C.segui.x, C.segui.y); else muriTrasparenti(0, 0, null, null);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    // l'ombra segue quello che si guarda
    sole.position.set(cam.tx + 500, cam.ty + 900, cam.tz + 300); sole.target.position.set(cam.tx, cam.ty, cam.tz);
    // nebbia (superpotere): si vede poco intorno alla propria pallina
    const T = TEMI[tema] || TEMI.classica;
    if (s.nebbia) { scena.fog.color.set(0xd6dae2); scena.fog.near = 30; scena.fog.far = Math.max(140, C.dist + 120); }
    else { scena.fog.color.set(T.nebbia); scena.fog.near = 3000; scena.fog.far = 9000; }
    if (anim.neve) { anim.neve.position.set(cam.tx, 0, cam.tz); const p = anim.neve.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - 40 * dt; if (y < -100) y += 700; p.setY(i, y); } p.needsUpdate = true; }
    renderer.render(scena, camera);
    ultimoT = t;
  }

  function dimensiona(w, h, dpr) {
    renderer.setPixelRatio(Math.min(2, dpr)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  // dal punto dello schermo (in pixel della tela) al punto del campo: per cliccare sulla minimappa no, sulla scena sì
  const rc = new THREE.Raycaster();
  function puntoCampo(nx, ny) {
    if (!mondo) return null;
    rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = rc.intersectObject(mondo.children[0], false)[0];
    return hit ? [hit.point.x, hit.point.z] : null;
  }
  return { costruisci, preparaPalle, disegna, dimensiona, puntoCampo, renderer, quota: (x, y) => (b ? quotaVista(b, x, y) : 0), distrugge: () => { svuota(); renderer.dispose(); } };
}
