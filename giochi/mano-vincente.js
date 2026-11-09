// MANO VINCENTE (!win !parola) nei giochi di carte "a combinazioni" (Scala 40, Burraco, Machiavelli…):
// costruisce con le carte disponibili (mazzo + mano attuale) un gruppo di scale e tris che usa esattamente
// `n` carte. Le mani escono diverse ogni volta: lunghezze, semi e ranghi a caso, e a volte un jolly.
const { mescola } = require('./carte');

const caso = (a) => a[Math.floor(Math.random() * a.length)];

// spezza n in parti da 3 a 5 (a caso), es. 13 → 4+3+3+3 o 5+5+3
function parti(n) {
  if (n < 3) return null;
  for (let t = 0; t < 50; t++) {
    const out = [];
    let resto = n;
    while (resto > 0) {
      const possibili = [3, 4, 5].filter((k) => k <= resto && (resto - k === 0 || resto - k >= 3));
      if (!possibili.length) break;
      const k = caso(possibili);
      out.push(k);
      resto -= k;
    }
    if (resto === 0) return out;
  }
  return null;
}

// opzioni:
//  valuta(carte) → combinazione valida (con .punti) o null   (le regole del gioco)
//  minPunti: punti minimi del totale (es. 40 per aprire a Scala 40)
//  conJolly: probabilità di mettere un jolly in una combinazione (se ce ne sono)
//  tris: true se il gioco ammette tris/poker (carte dello stesso rango, semi diversi)
//  trisSemiUguali: il tris può avere semi ripetuti (Burraco con due mazzi)
//  maxTris: grandezza massima di un tris (4 a Scala 40)
function costruisci(pool, n, { valuta, minPunti = 0, conJolly = 0.3, tris = true, maxTris = 4, assoAlto = true } = {}) {
  const tentativi = 400;
  for (let t = 0; t < tentativi; t++) {
    const pz = parti(n);
    if (!pz) return null;
    const liberi = mescola(pool.slice());
    const usati = new Set();
    const gruppi = [];
    let punti = 0;
    let ok = true;
    for (const k of pz) {
      const disp = liberi.filter((c) => !usati.has(c.id));
      const jolly = disp.filter((c) => c.jolly);
      const nat = disp.filter((c) => !c.jolly);
      const mettiJolly = jolly.length && Math.random() < conJolly;
      const kn = mettiJolly ? k - 1 : k;
      let gr = null;
      if (tris && k <= maxTris && Math.random() < 0.45) gr = prendiTris(nat, kn);
      if (!gr) gr = prendiScala(nat, kn, mettiJolly, assoAlto);
      if (!gr && tris && k <= maxTris) gr = prendiTris(nat, kn);
      if (!gr) { ok = false; break; }
      if (mettiJolly) gr = [...gr, jolly[0]];
      const v = valuta(gr);
      if (!v) { ok = false; break; }
      gr.forEach((c) => usati.add(c.id));
      gruppi.push(gr);
      punti += v.punti || 0;
    }
    if (ok && punti >= minPunti) return gruppi;
  }
  return null;
}

function prendiTris(nat, k) {
  const perRango = {};
  for (const c of nat) {
    const m = (perRango[c.rango] = perRango[c.rango] || {});
    if (!m[c.seme]) m[c.seme] = c;
  }
  const buoni = Object.values(perRango).map((m) => Object.values(m)).filter((l) => l.length >= k);
  if (!buoni.length) return null;
  return mescola(caso(buoni).slice()).slice(0, k);
}

// k carte vere di fila dello stesso seme; con `buco` lascia uno spazio in mezzo per il jolly
function prendiScala(nat, k, buco, assoAlto) {
  const perSeme = {};
  for (const c of nat) {
    const m = (perSeme[c.seme] = perSeme[c.seme] || {});
    if (!m[c.rango]) m[c.rango] = c;
    if (assoAlto && c.rango === 1 && !m[14]) m[14] = c;
  }
  const lung = buco ? k + 1 : k; // posizioni occupate dalla scala
  const scelte = [];
  for (const [, m] of Object.entries(perSeme)) {
    for (let da = 1; da + lung - 1 <= (assoAlto ? 14 : 13); da++) {
      const pos = [];
      for (let x = da; x < da + lung; x++) pos.push(x);
      const vuota = buco && lung >= 3 ? pos[1 + Math.floor(Math.random() * (lung - 2))] : null;
      const carte = pos.filter((x) => x !== vuota).map((x) => m[x]);
      if (carte.every(Boolean)) scelte.push(carte);
    }
  }
  return scelte.length ? caso(scelte) : null;
}

// POKER: 5 carte forti prese dal mazzo (carte con rango 1..13 e seme): full, colore, scala colore, poker o, di rado,
// scala reale. `tipi` limita le scelte. Restituisce le 5 carte o null.
function manoPoker(pool, tipi = ['full', 'full', 'colore', 'scalaColore', 'poker', 'poker', 'scala']) {
  const trova = (r, s) => pool.find((c) => c.rango === r && c.seme === s && !c.jolly);
  const semi = [...new Set(pool.filter((c) => c.seme).map((c) => c.seme))];
  for (let t = 0; t < 200; t++) {
    const tipo = Math.random() < 0.04 ? 'reale' : caso(tipi);
    let out = [];
    const r1 = 1 + Math.floor(Math.random() * 13);
    let r2 = 1 + Math.floor(Math.random() * 13);
    if (r2 === r1) r2 = (r1 % 13) + 1;
    if (tipo === 'poker') { out = semi.map((s) => trova(r1, s)).slice(0, 4); out.push(pool.find((c) => c.rango === r2 && !c.jolly)); }
    else if (tipo === 'full') { out = [...mescola(semi.slice()).slice(0, 3).map((s) => trova(r1, s)), ...mescola(semi.slice()).slice(0, 2).map((s) => trova(r2, s))]; }
    else if (tipo === 'colore') {
      const s = caso(semi);
      const r = mescola([...Array(13)].map((_, i) => i + 1)).slice(0, 5).sort((a, b) => a - b);
      const dritta = r[4] - r[0] === 4 || (r[0] === 1 && r[1] === 10);
      if (dritta) continue;
      out = r.map((x) => trova(x, s));
    } else if (tipo === 'scala') {
      const da = 1 + Math.floor(Math.random() * 10);
      const ss = [0, 1, 2, 3, 4].map(() => caso(semi));
      if (new Set(ss).size === 1) continue;
      out = [0, 1, 2, 3, 4].map((k) => trova(((da + k - 1) % 13) + 1, ss[k]));
    } else {
      const s = caso(semi);
      const da = tipo === 'reale' ? 10 : 1 + Math.floor(Math.random() * 9);
      out = [0, 1, 2, 3, 4].map((k) => trova(((da + k - 1) % 13) + 1, s));
    }
    if (out.length === 5 && out.every(Boolean) && new Set(out.map((c) => c.id)).size === 5) return mescola(out);
  }
  return null;
}

module.exports = { costruisci, parti, manoPoker, prendiScala };
