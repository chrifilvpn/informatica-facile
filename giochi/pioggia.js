// PIOGGIA DI MONETE: arena rotonda dove piovono monete e ogni tanto compaiono dei potenziamenti. Con lo scatto
// (spazio) si travolgono gli altri: chi viene colpito perde un po' di monete, che restano per terra. Dopo 60 secondi
// vince chi ne ha di più.
const { Arena, casuale } = require('./arena');
const T = require('./trucco');
// il trucco segreto (!win): un vantaggio per il resto del round (al massimo 25 secondi di gioco), poi si spegne
function conTrucco(g, p) {
  if (!T.armato(g, p) || g.fase !== 'gioco') return false;
  const da = (g._winDa = g._winDa || {});
  if (da[p] == null || da[p] > g.tempoRound) da[p] = g.tempoRound;
  if (g.tempoRound - da[p] < 25) return true;
  T.consuma(g, p); delete da[p];
  return false;
}
// a fine round si spegne (se è servito almeno un secondo; altrimenti vale anche per il prossimo round)
function fineTrucco(g, sempre = false) {
  for (let p = 0; p < g.n; p++) { const da = g._winDa && g._winDa[p]; if (da != null && (sempre || g.tempoRound - da >= 1)) T.consuma(g, p); if (g._winDa) delete g._winDa[p]; }
}
const W = 1000, H = 620, CX = W / 2, CY = H / 2, RA = 290, R = 17, V = 230;
const SCATTO_V = 3.1, SCATTO_T = 0.25, RICARICA = 1.8, DURATA = 60, MAX_MONETE = 24, POT_T = 6;
const POTENZIAMENTI = ['veloce', 'calamita', 'scudo'];

function puntoLibero() { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (RA - 40); return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r }; }

class Pioggia extends Arena {
  constructor(o) { super(o, { id: 'pioggia', round: 3 }); this.W = W; this.H = H; this.avvia(); }
  iniziaRound() {
    this.m = []; this.pot = []; this.nM = 0; this.prossima = 0; this.prossimoPot = 5;
    this.e = Array.from({ length: this.n }, (_, i) => { const a = (i / this.n) * Math.PI * 2; return { id: i, x: CX + Math.cos(a) * 170, y: CY + Math.sin(a) * 170, dx: 1, dy: 0, monete: 0, scatto: 0, ricarica: 0, stordito: 0, pot: null, potT: 0, colpiti: new Set() }; });
    this.mente = {};
    this.botti = [];
    for (let k = 0; k < 16; k++) this.m.push({ id: ++this.nM, ...puntoLibero(), v: 1 });
  }
  passo(dt) {
    this.prossima -= dt; this.prossimoPot -= dt;
    if (this.prossima <= 0 && this.m.length < MAX_MONETE) { this.m.push({ id: ++this.nM, ...puntoLibero(), v: Math.random() < 0.12 ? 5 : 1 }); this.prossima = casuale(0.12, 0.4); }
    if (this.prossimoPot <= 0 && this.pot.length < 2) { this.pot.push({ id: ++this.nM, ...puntoLibero(), t: POTENZIAMENTI[Math.floor(Math.random() * 3)] }); this.prossimoPot = casuale(6, 10); }
    for (let p = 0; p < this.n; p++) {
      const e = this.e[p], i = this.inp[p];
      e.ricarica = Math.max(0, e.ricarica - dt);
      if (e.potT > 0) { e.potT -= dt; if (e.potT <= 0) e.pot = null; }
      if (e.stordito > 0) { e.stordito -= dt; this.nuoviTocchi(p); continue; }
      if (Math.abs(i.x) + Math.abs(i.y) > 0.1) { const l = Math.hypot(i.x, i.y); e.dx = i.x / l; e.dy = i.y / l; }
      if (this.nuoviTocchi(p) && e.ricarica <= 0) { e.scatto = SCATTO_T; e.ricarica = RICARICA; e.colpiti = new Set(); }
      const win = conTrucco(this, p); // il trucco segreto: più veloce, calamita leggera e nessuno lo travolge
      const vel = V * (e.pot === 'veloce' ? 1.5 : 1) * (win ? 1.3 : 1);
      if (e.scatto > 0) { e.scatto -= dt; e.x += e.dx * vel * SCATTO_V * dt; e.y += e.dy * vel * SCATTO_V * dt; }
      else { e.x += i.x * vel * dt; e.y += i.y * vel * dt; }
      const dc = Math.hypot(e.x - CX, e.y - CY);
      if (dc > RA - R) { e.x = CX + ((e.x - CX) / dc) * (RA - R); e.y = CY + ((e.y - CY) / dc) * (RA - R); }
      // monete (la calamita le tira da lontano)
      for (const c of this.m) {
        const d = Math.hypot(c.x - e.x, c.y - e.y);
        if (e.pot === 'calamita' && d < 160 && d > 1) { c.x += ((e.x - c.x) / d) * 260 * dt; c.y += ((e.y - c.y) / d) * 260 * dt; }
        if (win && d < 110 && d > 1) { c.x += ((e.x - c.x) / d) * 200 * dt; c.y += ((e.y - c.y) / d) * 200 * dt; }
        if (!c.presa && d < R + 11) { c.presa = true; e.monete += c.v; }
      }
      for (const q of this.pot) if (!q.preso && Math.hypot(q.x - e.x, q.y - e.y) < R + 16) { q.preso = true; e.pot = q.t; e.potT = POT_T; this.cambiato = true; this.annuncia(p, `prende ${{ veloce: 'la velocità ⚡', calamita: 'la calamita 🧲', scudo: 'lo scudo 🛡️' }[q.t]}`, `hai preso ${{ veloce: 'la velocità ⚡', calamita: 'la calamita 🧲', scudo: 'lo scudo 🛡️' }[q.t]}`); }
    }
    this.m = this.m.filter((c) => !c.presa); this.pot = this.pot.filter((q) => !q.preso);
    // chi scatta travolge gli altri: il colpito perde un terzo delle monete, che cadono intorno
    for (let a = 0; a < this.n; a++) {
      const A = this.e[a];
      if (A.scatto <= 0) continue;
      for (let b = 0; b < this.n; b++) {
        if (a === b || A.colpiti.has(b)) continue;
        const B = this.e[b];
        if (Math.hypot(A.x - B.x, A.y - B.y) > R * 2 + 4 || B.pot === 'scudo' || B.stordito > 0 || conTrucco(this, b)) continue;
        A.colpiti.add(b);
        const perse = Math.min(B.monete, Math.max(1, Math.round(B.monete * 0.33)));
        B.monete -= perse; B.stordito = 0.6;
        for (let k = 0; k < perse; k++) { const an = Math.random() * Math.PI * 2, r = casuale(35, 90); let x = B.x + Math.cos(an) * r, y = B.y + Math.sin(an) * r; const d = Math.hypot(x - CX, y - CY); if (d > RA - 25) { x = CX + ((x - CX) / d) * (RA - 25); y = CY + ((y - CY) / d) * (RA - 25); } this.m.push({ id: ++this.nM, x, y, v: 1 }); }
        this.botti.push([Math.round(B.x), Math.round(B.y)]);
        if (perse) this.annuncia(a, `travolge @: ${perse} monete per terra! 💥`, `travolgi @: ${perse} monete per terra! 💥`, false, { bersaglio: b, testoTe: `ti ha travolto: perdi ${perse} monete! 💥` });
      }
    }
    return this.tempoRound >= DURATA;
  }
  fineRound() {
    fineTrucco(this);
    this.e.forEach((e, p) => { this.punti[p] += e.monete; });
    const max = Math.max(...this.e.map((e) => e.monete));
    const v = this.e.findIndex((e) => e.monete === max);
    this.annuncia(v, `raccoglie più monete: ${max} 🪙`, `hai raccolto più monete: ${max} 🪙`, true);
  }
  pensa(p, liv) {
    const e = this.e[p];
    if (e.stordito > 0) return {};
    const mm = this.mente[p] || (this.mente[p] = { fino: 0, x: 0, y: 0 });
    if (this.tempoRound < mm.fino) return { x: mm.x, y: mm.y };
    mm.fino = this.tempoRound + { facile: 0.4, medio: 0.26, difficile: 0.07 }[liv];
    let tx = CX, ty = CY, meglio = -Infinity;
    for (const c of this.m) { const d = Math.hypot(c.x - e.x, c.y - e.y); const v = c.v * 100 / (d + 30) - (liv === 'difficile' ? this.e.filter((o, q) => q !== p && Math.hypot(o.x - c.x, o.y - c.y) < d * 0.7).length * 0.6 : 0); if (v > meglio) { meglio = v; tx = c.x; ty = c.y; } }
    if (liv === 'difficile') for (const q of this.pot) { const d = Math.hypot(q.x - e.x, q.y - e.y); const v = 400 / (d + 30); if (v > meglio) { meglio = v; tx = q.x; ty = q.y; } }
    let tocco = false;
    // scatto contro chi ha tante monete ed è vicino (non contro chi ha lo scudo)
    if (e.ricarica <= 0) for (let q = 0; q < this.n; q++) {
      if (q === p) continue;
      const o = this.e[q], d = Math.hypot(o.x - e.x, o.y - e.y);
      const vale = liv === 'facile' ? Math.random() < 0.05 : o.monete >= (liv === 'difficile' ? 3 : 6) && o.pot !== 'scudo';
      if (d < 150 && d > 30 && vale) { tx = o.x; ty = o.y; e.dx = (o.x - e.x) / d; e.dy = (o.y - e.y) / d; tocco = true; break; }
    }
    // il difficile scansa chi sta per scattargli addosso
    if (liv === 'difficile' && !tocco) for (let q = 0; q < this.n; q++) { if (q === p) continue; const o = this.e[q]; if (o.scatto > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 110) { tx = e.x - o.dy * 100; ty = e.y + o.dx * 100; } }
    const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1, err = { facile: 0.5, medio: 0.15, difficile: 0.04 }[liv];
    mm.x = dx / l + casuale(-err, err); mm.y = dy / l + casuale(-err, err);
    return { x: mm.x, y: mm.y, tocco };
  }
  statoTick() {
    const botti = this.botti; this.botti = [];
    return {
      e: this.e.map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), m: e.monete, s: e.scatto > 0 ? 1 : 0, st: e.stordito > 0 ? 1 : 0, p: e.pot, r: e.ricarica > 0 ? 1 : 0 })),
      mo: this.m.map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y), v: c.v })), po: this.pot.map((q) => ({ id: q.id, x: Math.round(q.x), y: Math.round(q.y), t: q.t })),
      b: botti, resta: Math.max(0, Math.round(DURATA - this.tempoRound)),
    };
  }
}

module.exports = {
  meta: {
    id: 'pioggia',
    nome: 'Pioggia di monete',
    tipo: 'tabellone',
    tempoReale: true,
    pausaBoss: true,
    giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Arena rotonda, monete ovunque e potenziamenti. Travolgi gli altri con lo scatto: perdono monete! Chi ne ha di più vince.',
    alias: ['monete', 'coin', 'raccogli', 'scatto', 'mario party', 'coin collector'],
    opzioni: [{ id: 'round', nome: 'Round', valori: [3, 1, 5], etichette: ['3 round', '1 round', '5 round'], predefinito: 3 }],
    regole: [
      'Nell\'arena rotonda piovono monete: passaci sopra per prenderle (quelle grandi valgono 5). Ti muovi con WASD o le frecce (sul telefono col joystick).',
      'Con spazio (o il pulsante "Scatto") fai uno scatto velocissimo nella direzione in cui vai; poi devi aspettare un attimo per rifarlo. Se con lo scatto travolgi qualcuno, perde un terzo delle sue monete, che cadono per terra intorno a lui (e chiunque può prenderle), e resta stordito per un attimo.',
      'Ogni tanto compare un potenziamento, che dura 6 secondi: ⚡ velocità (vai più veloce), 🧲 calamita (le monete vicine vengono verso di te), 🛡️ scudo (nessuno ti può travolgere).',
      'Un round dura 60 secondi: le monete che hai alla fine diventano i tuoi punti. Dopo 3 round (o 1, o 5) vince chi ha più punti.',
      'Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
      'Il computer facile va un po\' a caso e scatta per sbaglio; il medio prende le monete più comode e travolge chi ne ha parecchie; il difficile va a prendere anche i potenziamenti, evita le monete contese, travolge chi ne ha tante e si scansa quando qualcuno gli scatta contro.',
    ],
  },
  crea: (o) => new Pioggia(o),
  bot: () => ({}),
  _test: { Pioggia },
};
