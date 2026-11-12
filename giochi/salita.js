// DUE GIOCHI A SCORRIMENTO VERTICALE (lo schermo sale da solo e non si vede cosa c'è sopra finché non arriva):
// - FUGA DAI FANTASMI: dal basso salgono i fantasmi; chi resta indietro viene preso. Sopravvive chi dura di più.
// - MONETE IN SALITA: un percorso di lunghezza fissa pieno di monete e ostacoli; chi resta indietro è fuori,
//   chi arriva al traguardo prende un bonus in base all'ordine d'arrivo.
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
const W = 1000, H = 620, R = 15, V = 300;
const LUNGHEZZA = 6000; // monete in salita: lunghezza del percorso
const ULTIMI = 15; // monete in salita: secondi per arrivare dopo il primo (prima uno fermo in cima teneva il round fino a 3 minuti)

// MAPPE A TEMA: a ogni round si sceglie un'ambientazione, che decide quali pezzi di percorso escono e come sono.
// Pezzi: muro con varchi, massi, zig-zag (due muri sfalsati), corsie (una sola porta in cima: le altre sono vicoli
// ciechi), fiume (una fascia di acqua, fango, ghiaccio o lava con i ponti), pericoli che si muovono, stanze con due porte.
// Più si va avanti, più i pezzi difficili escono spesso e i varchi si stringono.
const TEMI = {
  fuga: {
    cimitero: { pezzi: { muro: 2, massi: 3, zigzag: 1, corsie: 1, mobili: 2 }, zona: null },
    castello: { pezzi: { muro: 2, zigzag: 2, corsie: 2, stanza: 3, mobili: 1, massi: 1 }, zona: null },
    palude: { pezzi: { fiume: 3, massi: 2, muro: 1, mobili: 1, zigzag: 1 }, zona: 'acqua' },
    cripta: { pezzi: { corsie: 3, zigzag: 2, stanza: 2, mobili: 2, muro: 1 }, zona: null },
  },
  monete: {
    foresta: { pezzi: { massi: 3, fiume: 2, muro: 1, mobili: 1, zigzag: 1, corsie: 1 }, zona: 'acqua' },
    ghiacciaio: { pezzi: { fiume: 3, massi: 2, muro: 1, mobili: 1, zigzag: 1 }, zona: 'ghiaccio' },
    vulcano: { pezzi: { fiume: 3, massi: 2, mobili: 2, muro: 1, zigzag: 1 }, zona: 'lava' },
    tempio: { pezzi: { stanza: 2, corsie: 2, massi: 2, mobili: 2, fiume: 1, muro: 1 }, zona: 'fango' },
  },
};
const DIFFICILI = { corsie: 1, stanza: 1, mobili: 1, zigzag: 0.6, fiume: 0.5 }; // quanto crescono col procedere
const LENTO = { acqua: 0.5, fango: 0.45 }; // nelle zone d'acqua e di fango si va più piano
const COLPO_GIU = 90, COLPO_FERMO = 0.5, COLPO_IMMUNE = 1.5;

const solido = (o) => o.tipo === 'masso' || o.tipo === 'muro';
function spingiFuori(e, ostacoli) {
  for (const o of ostacoli) {
    if (!solido(o)) continue;
    if (o.tipo === 'masso') {
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), m = o.r + R;
      if (d < m && d > 0.001) { e.x = o.x + (dx / d) * m; e.y = o.y + (dy / d) * m; }
    } else {
      const cx = Math.max(o.x, Math.min(o.x + o.w, e.x)), cy = Math.max(o.y, Math.min(o.y + o.h, e.y));
      const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
      if (d < R) {
        if (d > 0.001) { e.x = cx + (dx / d) * R; e.y = cy + (dy / d) * R; } else e.y = o.y + o.h + R;
      }
    }
  }
}
const dentro = (e, o, m = 0) => e.x > o.x - m && e.x < o.x + o.w + m && e.y > o.y - m && e.y < o.y + o.h + m;
const scegliPesato = (pesi) => { const t = Object.values(pesi).reduce((a, b) => a + b, 0); let r = Math.random() * t; for (const [k, v] of Object.entries(pesi)) { r -= v; if (r <= 0) return k; } return Object.keys(pesi)[0]; };

class Salita extends Arena {
  constructor(o, modo) {
    super(o, { id: modo, round: 3 });
    this.modo = modo;
    this.W = W; this.H = H;
    this.temiUsati = [];
    this.avvia();
  }
  iniziaRound() {
    // tema del round: a caso tra quelli non ancora usati
    const tutti = Object.keys(TEMI[this.modo]);
    let liberi = tutti.filter((t) => !this.temiUsati.includes(t)); if (!liberi.length) { this.temiUsati = []; liberi = tutti; }
    this.tema = liberi[Math.floor(Math.random() * liberi.length)]; this.temiUsati.push(this.tema);
    this.T = TEMI[this.modo][this.tema];
    this.cam = 0; // y del bordo alto dello schermo nel mondo (sale: diventa sempre più negativo)
    this.ostacoli = []; this.monete = []; this.nO = 0;
    this.generato = H - 260;
    this.e = Array.from({ length: this.n }, (_, i) => ({ id: i, x: W / 2 + (i - (this.n - 1) / 2) * 60, y: H * 0.6, vx: 0, vy: 0, fuori: false, arrivo: null, monete: 0, fuoriT: null, fermo: 0, immune: 0, salto: 0 }));
    this.arrivi = []; this.chiude = null;
    this.mente = {};
    this.genera();
  }
  livello(y) { return Math.max(0, Math.min(1, -y / (this.modo === 'fuga' ? 7000 : LUNGHEZZA))); }
  aggiungi(o) { o.id = ++this.nO; this.ostacoli.push(o); return o; }
  moneta(x, y) { if (this.modo === 'monete') this.monete.push({ id: ++this.nO, x, y }); }
  // un muro orizzontale da 0 a W con i varchi indicati [inizio, larghezza]
  muroConVarchi(y, varchi, h = 26) {
    let x = 0;
    for (const [v, l] of varchi.sort((a, b) => a[0] - b[0])) { if (v - x > 10) this.aggiungi({ tipo: 'muro', x, y, w: v - x, h }); x = v + l; }
    if (W - x > 10) this.aggiungi({ tipo: 'muro', x, y, w: W - x, h });
  }
  // nuovi pezzi di percorso sopra lo schermo
  genera() {
    const fino = this.cam - 700;
    while (this.generato > fino) {
      const y = this.generato;
      if (this.modo === 'monete' && y < -LUNGHEZZA - 200) break;
      const lv = this.livello(y);
      const pesi = {}; for (const [k, v] of Object.entries(this.T.pezzi)) pesi[k] = v * (1 + (DIFFICILI[k] || 0) * lv * 2);
      // all'inizio niente pezzi complicati
      const pezzo = y > H - 700 ? 'massi' : scegliPesato(pesi);
      const alto = this[`pezzo_${pezzo}`](y, lv) || 0;
      this.generato -= alto + casuale(150, 200) - lv * 30;
    }
    // si butta via quello che è ormai sotto lo schermo
    this.ostacoli = this.ostacoli.filter((o) => (o.tipo === 'mobile' ? o.y : o.y) < this.cam + H + 120);
    this.monete = this.monete.filter((m) => m.y < this.cam + H + 60);
  }
  pezzo_muro(y, lv) {
    const varchi = Math.random() < 0.5 - lv * 0.25 ? 2 : 1, larg = casuale(140, 185) - lv * 35;
    const pos = Array.from({ length: varchi }, (_, k) => [casuale(60 + k * (W / varchi), (k + 1) * (W / varchi) - 60 - larg), larg]);
    this.muroConVarchi(y, pos);
    for (const [v] of pos) for (let k = 0; k < 3; k++) this.moneta(v + larg / 2, y - 50 - k * 34);
    return 26;
  }
  pezzo_massi(y, lv) {
    const quanti = 2 + Math.floor(Math.random() * 3 + lv * 2.5);
    const messi = [];
    for (let k = 0; k < quanti * 3 && messi.length < quanti; k++) {
      const r = casuale(24, 42), x = casuale(60, W - 60), yy = y + casuale(-60, 40);
      if (messi.some((m) => Math.hypot(m.x - x, m.y - yy) < m.r + r + 2 * R + 14)) continue; // resta sempre un passaggio
      messi.push(this.aggiungi({ tipo: 'masso', x, y: yy, r }));
    }
    for (let k = 0; k < 4; k++) { const x = casuale(60, W - 60), yy = y - casuale(60, 130); if (messi.every((o) => Math.hypot(o.x - x, o.y - yy) > o.r + 20)) this.moneta(x, yy); }
    return 60;
  }
  pezzo_zigzag(y, lv) {
    const larg = casuale(130, 165) - lv * 25, sinistra = Math.random() < 0.5, dist = 130 - lv * 15;
    const a = sinistra ? casuale(40, 250) : casuale(W - 250 - larg, W - 40 - larg), b = sinistra ? casuale(W - 250 - larg, W - 40 - larg) : casuale(40, 250);
    this.muroConVarchi(y, [[a, larg]]);
    this.muroConVarchi(y - dist, [[b, larg]]);
    // le monete disegnano la strada a zig-zag
    for (let k = 0; k <= 4; k++) this.moneta(a + larg / 2 + (b - a) * (k / 4), y - dist / 2 + 10 - (k === 0 ? -30 : k === 4 ? 30 : 0));
    return dist + 26;
  }
  pezzo_corsie(y, lv) {
    // corsie verticali: si entra da sotto in tutte, ma in cima se ne apre una sola
    const n = Math.random() < 0.5 ? 3 : 4, alto = 230 + lv * 40, top = y - alto;
    const larg = W / n, aperta = Math.floor(Math.random() * n);
    for (let k = 1; k < n; k++) this.aggiungi({ tipo: 'muro', x: k * larg - 12, y: top, w: 24, h: alto });
    const porta = Math.min(larg - 50, 150 - lv * 25);
    this.muroConVarchi(top - 26, [[aperta * larg + (larg - porta) / 2, porta]]);
    for (let k = 0; k < n; k++) { // monete: qualcuna di esca nei vicoli ciechi
      if (k === aperta || Math.random() < 0.5) for (let j = 0; j < 3; j++) this.moneta(k * larg + larg / 2, top + 40 + j * 45);
    }
    return alto + 26;
  }
  pezzo_fiume(y, lv) {
    const z = this.T.zona || 'acqua', alto = casuale(70, 100) + lv * 30, top = y - alto;
    // i ponti: nella lava e nel ghiaccio servono davvero; nell'acqua e nel fango fanno solo risparmiare tempo
    const ponti = Math.random() < 0.55 - lv * 0.2 ? 2 : 1, lp = casuale(110, 150) - lv * 20;
    const pos = Array.from({ length: ponti }, (_, k) => casuale(60 + k * (W / ponti), (k + 1) * (W / ponti) - 60 - lp)).sort((a, b) => a - b);
    let x = 0;
    for (const v of pos) { if (v - x > 5) this.aggiungi({ tipo: 'zona', z, x, y: top, w: v - x, h: alto }); this.aggiungi({ tipo: 'ponte', z, x: v, y: top, w: lp, h: alto }); x = v + lp; }
    if (W - x > 5) this.aggiungi({ tipo: 'zona', z, x, y: top, w: W - x, h: alto });
    for (const v of pos) this.moneta(v + lp / 2, top + alto / 2);
    return alto;
  }
  pezzo_mobili(y, lv) {
    const quanti = 1 + Math.floor(Math.random() * 2 + lv * 1.5);
    for (let k = 0; k < quanti; k++) {
      const amp = casuale(200, 420), cx = casuale(amp / 2 + 40, W - amp / 2 - 40);
      this.aggiungi({ tipo: 'mobile', x: cx, y: y - k * 75, cx, amp: amp / 2, w: casuale(1.3, 2.2) + lv * 1.2, fase: casuale(0, 6.28), r: 22 });
    }
    for (let k = 0; k < 3; k++) this.moneta(casuale(80, W - 80), y - casuale(0, quanti * 75));
    return (quanti - 1) * 75 + 30;
  }
  pezzo_stanza(y, lv) {
    // una stanza chiusa con una porta sotto e una sopra, da parti opposte
    const w = casuale(460, 700), x = casuale(20, W - 20 - w), alto = 200, top = y - alto, porta = 110 - lv * 15, sp = 24;
    const sotto = Math.random() < 0.5 ? x + 40 : x + w - 40 - porta, sopra = sotto < x + w / 2 ? x + w - 40 - porta : x + 40;
    this.aggiungi({ tipo: 'muro', x, y: y - sp, w: sotto - x, h: sp }); this.aggiungi({ tipo: 'muro', x: sotto + porta, y: y - sp, w: x + w - sotto - porta, h: sp });
    this.aggiungi({ tipo: 'muro', x, y: top, w: sopra - x, h: sp }); this.aggiungi({ tipo: 'muro', x: sopra + porta, y: top, w: x + w - sopra - porta, h: sp });
    this.aggiungi({ tipo: 'muro', x, y: top, w: sp, h: alto }); this.aggiungi({ tipo: 'muro', x: x + w - sp, y: top, w: sp, h: alto });
    this.aggiungi({ tipo: 'masso', x: x + w / 2, y: top + alto / 2, r: 30 });
    for (let k = 0; k < 4; k++) this.moneta(x + w * (0.2 + k * 0.2), top + alto / 2 + (k % 2 ? 45 : -45));
    return alto;
  }
  velocita() { return this.modo === 'fuga' ? 55 + this.tempoRound * 3.2 : 85 + this.tempoRound * 1.2; }
  passo(dt) {
    const fineP = -LUNGHEZZA;
    if (!(this.modo === 'monete' && this.cam <= fineP - 40)) this.cam -= this.velocita() * dt;
    this.genera();
    // i pericoli che si muovono vanno avanti e indietro
    for (const o of this.ostacoli) if (o.tipo === 'mobile') o.x = o.cx + Math.sin(o.fase + this.tempoRound * o.w) * o.amp;
    for (let p = 0; p < this.n; p++) {
      const e = this.e[p];
      if (e.fuori || e.arrivo !== null) continue;
      const i = this.inp[p];
      const win = conTrucco(this, p); // il trucco segreto: più veloce, niente fango né pericoli, e i fantasmi non lo prendono
      e.immune = Math.max(0, e.immune - dt);
      // su che terreno è?
      let terreno = null;
      for (const o of this.ostacoli) if ((o.tipo === 'zona' || o.tipo === 'ponte') && dentro(e, o)) { terreno = o.tipo === 'ponte' ? 'ponte' : o.z; if (terreno === 'ponte') break; }
      let vx = i.x * V * (win ? 1.35 : 1), vy = i.y * V * (win ? 1.35 : 1);
      if (e.fermo > 0) { e.fermo -= dt; vx = 0; vy = 0; }
      if (LENTO[terreno] && !win) { vx *= LENTO[terreno]; vy *= LENTO[terreno]; }
      if (terreno === 'ghiaccio') { const k = Math.min(1, 1.6 * dt); e.vx += (vx - e.vx) * k; e.vy += (vy - e.vy) * k; } // si scivola
      else { e.vx = vx; e.vy = vy; }
      e.x = Math.max(R, Math.min(W - R, e.x + e.vx * dt));
      e.y += e.vy * dt;
      spingiFuori(e, this.ostacoli);
      e.x = Math.max(R, Math.min(W - R, e.x));
      if (e.y < this.cam + R + 4) { e.y = this.cam + R + 4; e.vy = Math.max(0, e.vy); } // non si va oltre il bordo alto
      // lava e pericoli che si muovono: spinta all'indietro
      if (e.immune <= 0 && !win) {
        const mob = this.ostacoli.find((o) => o.tipo === 'mobile' && Math.hypot(o.x - e.x, o.y - e.y) < o.r + R - 4);
        if (mob || terreno === 'lava') this.colpisci(p, mob ? 'mobile' : 'lava');
      }
      // monete
      if (this.modo === 'monete') {
        for (const m of this.monete) if (!m.presa && Math.hypot(m.x - e.x, m.y - e.y) < R + (win ? 45 : 12)) { m.presa = true; e.monete++; this.punti[p]++; }
        if (e.y <= fineP) { e.arrivo = this.tempoRound; this.arrivi.push(p); const bonus = [30, 20, 10][this.arrivi.length - 1] || 5; this.punti[p] += bonus; this.cambiato = true;
          // il primo arrivato fa partire il conto alla rovescia per gli altri
          const altri = this.arrivi.length === 1 && this.e.some((x) => !x.fuori && x.arrivo === null);
          if (altri) this.chiude = this.tempoRound + ULTIMI;
          const coda = altri ? ` Gli altri hanno ${ULTIMI} secondi! ⏳` : '';
          this.annuncia(p, `arriva in cima! +${bonus} 🏁${coda}`, `sei arrivato in cima! +${bonus} 🏁${coda}`);
        }
      }
      // troppo in basso: presi dai fantasmi / rimasti indietro
      if (win && e.y > this.cam + H - 40) { e.y = this.cam + H - 40; spingiFuori(e, this.ostacoli); e.y = Math.min(e.y, this.cam + H - 23); }
      if (e.y > this.cam + H - 22) {
        e.fuori = true; e.fuoriT = this.tempoRound; this.cambiato = true;
        this.annuncia(p, this.modo === 'fuga' ? 'è stato preso dai fantasmi! 👻' : 'è rimasto indietro ed è fuori!', this.modo === 'fuga' ? 'ti hanno preso i fantasmi! 👻' : 'sei rimasto indietro: fuori!');
      }
    }
    this.monete = this.monete.filter((m) => !m.presa);
    const inGara = this.e.filter((e) => !e.fuori && e.arrivo === null).length;
    if (this.modo === 'fuga') return inGara === 0 || (this.n > 1 && inGara === 1 && this.e.filter((e) => e.fuori).length === this.n - 1 && this.soloDa(3)) || this.tempoRound > 150;
    return inGara === 0 || this.tempoRound > 180 || (this.chiude !== null && this.tempoRound >= this.chiude);
  }
  // colpito da un pericolo (o finito nella lava): torna un po' indietro, resta fermo un attimo e perde 2 monete
  colpisci(p, cosa) {
    const e = this.e[p];
    e.y += COLPO_GIU; e.fermo = COLPO_FERMO; e.immune = COLPO_IMMUNE; e.vx = 0; e.vy = 0; e.salto++;
    spingiFuori(e, this.ostacoli);
    let perse = 0;
    if (this.modo === 'monete') { perse = Math.min(2, e.monete); e.monete -= perse; this.punti[p] -= perse; }
    this.cambiato = true;
    const testo = cosa === 'lava' ? 'si scotta nella lava! 🔥' : 'viene travolto! 💫';
    this.annuncia(p, testo + (perse ? ` −${perse} 🪙` : ''), (cosa === 'lava' ? 'ti sei scottato nella lava! 🔥' : 'sei stato travolto! 💫') + (perse ? ` −${perse} 🪙` : ''));
  }
  soloDa(s) { this._solo = this._solo || this.tempoRound; return this.tempoRound - this._solo > s; }
  fineRound() {
    fineTrucco(this);
    this._solo = null;
    if (this.modo === 'fuga') {
      this.e.forEach((e, p) => { this.punti[p] += Math.round(e.fuoriT ?? this.tempoRound); });
      const vivi = this.e.map((e, p) => (e.fuori ? -1 : p)).filter((p) => p >= 0);
      if (vivi.length === 1 && this.n > 1) { this.punti[vivi[0]] += 10; this.annuncia(vivi[0], 'è l\'ultimo a scappare: +10 🏃', 'sei l\'ultimo rimasto: +10 🏃', true); }
    }
  }
  // il computer guarda gli ostacoli sopra di sé e punta al varco o alla moneta migliore
  pensa(p, liv) {
    const e = this.e[p];
    if (e.fuori || e.arrivo !== null) return {};
    const m = this.mente[p] || (this.mente[p] = { fino: 0, x: 0, y: 0 });
    if (this.tempoRound < m.fino) return { x: m.x, y: m.y };
    m.fino = this.tempoRound + { facile: 0.35, medio: 0.15, difficile: 0.1 }[liv];
    // il medio e il difficile cercano una strada vera (il medio vede solo gli ostacoli vicini e reagisce più piano)
    if (liv !== 'facile') { const d = this.percorso(e, liv === 'difficile' ? Infinity : 260); if (d) { m.x = d.x; m.y = d.y; if (liv === 'medio') { m.x += casuale(-0.15, 0.15); } return { x: m.x, y: m.y }; } }
    const vista = { facile: 140, medio: 220, difficile: 480 }[liv];
    // cerca una x libera appena sopra (campionando), preferendo monete e restando in alto sullo schermo
    let meglio = e.x, vm = -Infinity;
    for (let x = 30; x <= W - 30; x += 20) {
      let v = -Math.abs(x - e.x) * 0.006;
      for (const o of this.ostacoli) {
        if (o.y > e.y + 30 || o.y < e.y - vista) continue;
        let blocca;
        if (o.tipo === 'masso') blocca = Math.abs(o.x - x) < o.r + R + 8;
        else if (o.tipo === 'mobile') blocca = Math.abs(o.x - x) < o.r + R + 40;
        else if (o.tipo === 'zona') { if (o.z === 'lava') blocca = x > o.x - R && x < o.x + o.w + R; else { if (x > o.x && x < o.x + o.w) v -= 0.8; blocca = false; } }
        else if (o.tipo === 'ponte') blocca = false;
        else blocca = x > o.x - R - 6 && x < o.x + o.w + R + 6;
        if (blocca) v -= 3 * (1 - (e.y - o.y) / (vista + 40));
      }
      if (this.modo === 'monete' && liv !== 'facile') for (const c of this.monete) if (c.y < e.y && c.y > e.y - vista && Math.abs(c.x - x) < 25) v += 0.6;
      if (v > vm) { vm = v; meglio = x; }
    }
    const dx = meglio - e.x;
    const altezzaVoluta = this.cam + H * { facile: 0.55, medio: 0.45, difficile: 0.22 }[liv];
    const dy = altezzaVoluta - e.y;
    // davanti c'è qualcosa proprio sopra? allora prima di lato
    const sopra = this.ostacoli.some((o) => (o.tipo === 'masso' ? Math.abs(o.x - e.x) < o.r + R && o.y < e.y && o.y > e.y - o.r - 30
      : o.tipo === 'mobile' ? Math.abs(o.x - e.x) < o.r + R + 30 && o.y < e.y + 10 && o.y > e.y - 90
      : (o.tipo === 'muro' || (o.tipo === 'zona' && o.z === 'lava')) && e.x > o.x - R && e.x < o.x + o.w + R && o.y + o.h < e.y + 2 && o.y + o.h > e.y - 40));
    let x = Math.abs(dx) > 8 ? Math.sign(dx) : 0, y = sopra ? 0.3 : Math.max(-1, Math.min(1, dy / 60));
    const err = { facile: 0.5, medio: 0.18, difficile: 0.04 }[liv];
    x += casuale(-err, err); y += casuale(-err, err);
    const l = Math.hypot(x, y) || 1; m.x = l > 1 ? x / l : x; m.y = l > 1 ? y / l : y;
    return { x: m.x, y: m.y };
  }
  // il difficile cerca davvero una strada: griglia di caselle da 20 px su quello che si vede, e la visita in ampiezza
  // trova la casella libera più in alto raggiungibile (con le monete che valgono un po' di strada)
  percorso(e, vista = Infinity) {
    const C = 20, cols = W / C, righe = Math.ceil(H / C), top = this.cam;
    const libero = new Uint8Array(cols * righe).fill(1);
    for (const o0 of this.ostacoli) {
      if (o0.tipo === 'ponte' || (o0.tipo === 'zona' && o0.z !== 'lava')) continue;
      // un pericolo che si muove occupa il posto dove sarà nel prossimo mezzo secondo: si allarga il suo cerchio
      const o = o0.tipo === 'mobile' ? { tipo: 'masso', x: o0.x, y: o0.y, r: o0.r + 30 + o0.amp * o0.w * 0.25 * Math.abs(Math.cos(o0.fase + this.tempoRound * o0.w)) } : o0.tipo === 'zona' ? { tipo: 'muro', x: o0.x, y: o0.y, w: o0.w, h: o0.h } : o0;
      if (o.y > top + H + 60 || o.y + (o.h || 0) < top - 60 || o.y + (o.h || o.r || 0) < e.y - vista) continue;
      // solo le caselle intorno all'ostacolo
      const x0 = (o.tipo === 'masso' ? o.x - o.r : o.x) - R - C, x1 = (o.tipo === 'masso' ? o.x + o.r : o.x + o.w) + R + C;
      const y0 = (o.tipo === 'masso' ? o.y - o.r : o.y) - R - C, y1 = (o.tipo === 'masso' ? o.y + o.r : o.y + o.h) + R + C;
      const cMin = Math.max(0, Math.floor(x0 / C)), cMax = Math.min(cols - 1, Math.floor(x1 / C));
      const rMin = Math.max(0, Math.floor((y0 - top) / C)), rMax = Math.min(righe - 1, Math.floor((y1 - top) / C));
      for (let r = rMin; r <= rMax; r++) for (let c = cMin; c <= cMax; c++) {
        const x = c * C + C / 2, y = top + r * C + C / 2;
        const d = o.tipo === 'masso' ? Math.hypot(x - o.x, y - o.y) - o.r : Math.hypot(x - Math.max(o.x, Math.min(o.x + o.w, x)), y - Math.max(o.y, Math.min(o.y + o.h, y)));
        if (d < R + 3) libero[r * cols + c] = 0;
      }
    }
    const c0 = Math.max(0, Math.min(cols - 1, Math.floor(e.x / C))), r0 = Math.max(0, Math.min(righe - 1, Math.floor((e.y - top) / C)));
    const conMonete = this.modo === 'monete' ? new Set(this.monete.map((m) => Math.floor((m.y - top) / C) * cols + Math.floor(m.x / C))) : null;
    const prec = new Int32Array(cols * righe).fill(-1), inizio = r0 * cols + c0;
    prec[inizio] = inizio;
    const coda = [inizio];
    let meglio = inizio, vm = -Infinity;
    for (let q = 0; q < coda.length; q++) {
      const k = coda[q], r = Math.floor(k / cols), c = k % cols;
      let v = -r * 3 - Math.abs(c - c0) * 0.05;
      if (top + r * C < e.y - vista) v -= 1000; // oltre quello che vede non punta
      if (conMonete && conMonete.has(k)) v += 4;
      if (r < 3) v -= 6; // non attaccati al bordo in alto
      if (v > vm) { vm = v; meglio = k; }
      for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
        const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= righe || cc >= cols) continue;
        const kk = rr * cols + cc; if (prec[kk] !== -1 || !libero[kk]) continue;
        prec[kk] = k; coda.push(kk);
      }
    }
    // si risale il cammino fino a un passo di qualche casella avanti
    let k = meglio; const cam = [];
    while (k !== inizio && cam.length < 400) { cam.push(k); k = prec[k]; }
    if (!cam.length) return null;
    const passo = cam[Math.max(0, cam.length - 3)];
    const tx = (passo % cols) * C + C / 2, ty = top + Math.floor(passo / cols) * C + C / 2;
    const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1;
    return l < 4 ? { x: 0, y: 0 } : { x: dx / l, y: dy / l };
  }

  statoTick() {
    const vis = (y) => y > this.cam - 60 && y < this.cam + H + 60;
    return {
      cam: Math.round(this.cam), fine: this.modo === 'monete' ? -LUNGHEZZA : null,
      te: this.tema,
      e: this.e.map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), f: e.fuori ? 1 : 0, a: e.arrivo !== null ? 1 : 0, m: e.monete, st: e.fermo > 0 ? 1 : 0, im: e.immune > 0 ? 1 : 0, salto: e.salto })),
      o: this.ostacoli.filter((o) => vis(o.y) || (o.h && vis(o.y + o.h))).map((o) => (o.tipo === 'masso' ? { id: o.id, t: 0, x: Math.round(o.x), y: Math.round(o.y), r: Math.round(o.r) }
        : o.tipo === 'mobile' ? { id: o.id, t: 4, x: Math.round(o.x), y: Math.round(o.y), r: o.r }
        : { id: o.id, t: o.tipo === 'muro' ? 1 : o.tipo === 'zona' ? 2 : 3, z: o.z, x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w), h: Math.round(o.h) })),
      mo: this.monete.filter((m) => vis(m.y)).map((m) => ({ id: m.id, x: Math.round(m.x), y: Math.round(m.y) })),
      prog: this.modo === 'monete' ? Math.min(1, -this.cam / LUNGHEZZA) : null,
      cd: this.chiude !== null ? Math.max(0, Math.ceil(this.chiude - this.tempoRound)) : null,
    };
  }
}

const regoleComuni = [
  'Lo schermo sale da solo, sempre un po\' più veloce, e quello che c\'è sopra lo vedi solo quando arriva.',
  'A ogni round cambia l\'ambientazione, e con lei il percorso. Pezzi di percorso: muri con uno o due varchi, massi (lapidi, colonne, alberi, blocchi di ghiaccio…), zig-zag di due muri sfalsati, corsie con una sola porta in cima (le altre sono vicoli ciechi: guarda bene prima di entrare), stanze con una porta sotto e una sopra, fiumi con i ponti e pericoli che vanno avanti e indietro. Più si sale, più i pezzi difficili sono frequenti e i varchi stretti.',
  'Pericoli che si muovono (pipistrelli, fantasmini, fuochi fatui, lame, tronchi, palle di neve e di fuoco): se ti toccano scivoli indietro e resti fermo mezzo secondo; poi per un secondo e mezzo sei protetto (lampeggi).',
  'Ti muovi con WASD o le frecce (sul telefono col joystick). Non puoi andare oltre il bordo in alto; se resti indietro e tocchi il bordo in basso sei fuori.',
];
module.exports = {
  fuga: {
    meta: {
      id: 'fuga', nome: 'Fuga dai fantasmi', tipo: 'tabellone', tempoReale: true, pausaBoss: true, giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
      descrizione: 'Scappa verso l\'alto: dal basso salgono i fantasmi e non vedi cosa c\'è davanti finché lo schermo non scorre.',
      alias: ['fantasmi', 'fuga', 'scappa', 'scorrimento', 'sopravvivenza', 'mostri'],
      opzioni: [{ id: 'round', nome: 'Round', valori: [3, 1, 5], etichette: ['3 round', '1 round', '5 round'], predefinito: 3 }],
      regole: [...regoleComuni,
        'Ambientazioni: cimitero (lapidi, recinti, pipistrelli), castello infestato (colonne, stanze, corridoi, fantasmini), palude (l\'acqua ti rallenta a metà: meglio i ponti; alberi morti, canneti, fuochi fatui) e cripta (tante corsie e vicoli ciechi, lame rotanti).',
        'Dal basso salgono i fantasmi: chi resta indietro viene preso ed è fuori per il resto del round.',
        'Punti: un punto per ogni secondo in cui sei scappato; l\'ultimo rimasto prende 10 punti in più (il round finisce 3 secondi dopo che è rimasto solo). Dopo 3 round (o 1, o 5) vince chi ha più punti.',
        'Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
        'Il computer facile guarda poco avanti e resta basso; il medio cerca una strada ma vede solo gli ostacoli vicini; il difficile guarda tutto lo schermo, evita i vicoli ciechi e sta sempre in alto.'],
    },
    crea: (o) => new Salita(o, 'fuga'), bot: () => ({}), _test: { Salita },
  },
  monete: {
    meta: {
      id: 'monete', nome: 'Monete in salita', tipo: 'tabellone', tempoReale: true, pausaBoss: true, giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
      descrizione: 'Un percorso che sale, pieno di monete e ostacoli: raccogli più monete che puoi e arriva in cima. Chi resta indietro è fuori.',
      alias: ['monete', 'salita', 'corsa', 'scorrimento', 'coin'],
      opzioni: [{ id: 'round', nome: 'Round', valori: [3, 1, 5], etichette: ['3 round', '1 round', '5 round'], predefinito: 3 }],
      regole: [...regoleComuni,
        'Ambientazioni: foresta (alberi, siepi, ruscelli che rallentano, tronchi che rotolano), ghiacciaio (sul ghiaccio si scivola e si frena a fatica; blocchi di ghiaccio, palle di neve), vulcano (fiumi di lava da passare sui ponti: la lava ti respinge e ti fa perdere 2 monete; palle di fuoco) e tempio perduto (stanze, corsie, colonne, lame, sabbie mobili che rallentano). Anche un pericolo che ti tocca ti fa perdere 2 monete.',
        'Il percorso ha una lunghezza fissa (la barra mostra quanto manca) ed è pieno di monete, spesso proprio nei varchi dei muri: ogni moneta vale un punto.',
        'Chi arriva in cima prende un bonus: 30 punti il primo, 20 il secondo, 10 il terzo, 5 gli altri. Chi resta indietro è fuori, ma tiene le monete già prese.',
        'Quando arriva il primo, gli altri hanno 15 secondi per arrivare in cima: poi il round finisce (chi non è arrivato tiene le monete, ma niente bonus).',
        'Dopo 3 round (o 1, o 5) vince chi ha più punti. Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
        'Il computer facile guarda poco avanti e non cerca le monete; il medio le cerca; il difficile guarda lontano, prende le monete e sta sempre davanti.'],
    },
    crea: (o) => new Salita(o, 'monete'), bot: () => ({}), _test: { Salita, LUNGHEZZA, TEMI },
  },
};
