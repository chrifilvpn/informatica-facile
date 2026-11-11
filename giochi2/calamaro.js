// IL GIOCO DEL CALAMARO (serie Squid Game, l'ultimo gioco): per terra è disegnato il calamaro, un quadrato (il
// corpo) a sinistra, un passaggio stretto (la "vita"), un triangolo e un cerchio (la testa) a destra; nella testa c'è
// la CASA. Due squadre fisse che si scambiano i ruoli a ogni round: gli ATTACCANTI partono fuori dal disegno, a
// sinistra, e devono toccare la casa; i DIFENSORI stanno dentro il disegno e li spingono fuori.
// Fuori dal disegno gli attaccanti saltano "a zoppo" (lenti) e possono entrare solo dalla vita, attraversando una
// delle sue due linee lunghe; da lì in poi corrono come i difensori. Una spinta (tasto azione) sbalza via chi è
// vicino: chi è dentro il disegno e ci finisce fuori è eliminato (attaccante o difensore); chi salta a zoppo, se
// viene spinto, cade a terra per un attimo. Punti: casa toccata 5, eliminazione 2, difensore che resiste 1
// (più 2 se nessuno ha toccato la casa). Dopo i round vince chi ha più punti.
const { Arena, casuale } = require('../giochi/arena');
const T = require('../giochi/trucco');
// !win + parola segreta: un vantaggio per il round in corso (al massimo 25 secondi di gioco), poi il trucco si spegne
function aggiornaWin(g, dt) {
  const w = g.winOn || (g.winOn = {}), tw = g.winT || (g.winT = {});
  for (let p = 0; p < g.n; p++) {
    if (!(w[p] = T.armato(g, p))) { tw[p] = 0; continue; }
    tw[p] = (tw[p] || 0) + dt;
    if (tw[p] > 25) { T.consuma(g, p); w[p] = false; tw[p] = 0; }
  }
}
function fineWin(g) { for (let p = 0; p < g.n; p++) { T.consuma(g, p); if (g.winOn) g.winOn[p] = false; } }
// velocità: difensori un po' più svelti degli attaccanti (che a zoppo vanno alla metà)
const W = 1000, H = 620, R = 15, V_DIF = 212, V_ATT = 195, ZOPPO = 100;
// il disegno (simmetrico rispetto a y = 310)
const Q = { x0: 120, x1: 380, y0: 150, y1: 470 };            // corpo (quadrato)
const VITA = { x0: 380, x1: 520, y0: 268, y1: 352 };         // la vita: il passaggio stretto
const TRI = [[520, 110], [520, 510], [760, 310]];            // triangolo
const TESTA = { x: 800, y: 310, r: 130 };                    // testa (cerchio)
const CASA = { x: 862, y: 310, r: 26 };                      // la casa da toccare
const PORTATA = R * 2 + 26, RICARICA = 1.2, SPINTA = 470, FRENO = 5, A_TERRA = 0.4, LEGGERO = 0.55;
const P_CASA = 5, P_ELIMINA = 2, P_RESISTE = 1, P_MURO = 2;
const DURATE = [60, 45, 90];

const inQ = (x, y) => x >= Q.x0 && x <= Q.x1 && y >= Q.y0 && y <= Q.y1;
const inVita = (x, y) => x >= VITA.x0 && x <= VITA.x1 && y >= VITA.y0 && y <= VITA.y1;
function inTri(x, y) {
  const [[ax, ay], [bx, by], [cx, cy]] = TRI;
  const s = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const d1 = s(x, y, ax, ay, bx, by), d2 = s(x, y, bx, by, cx, cy), d3 = s(x, y, cx, cy, ax, ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
const inTesta = (x, y) => Math.hypot(x - TESTA.x, y - TESTA.y) <= TESTA.r;
const dentro = (x, y) => inQ(x, y) || inVita(x, y) || inTri(x, y) || inTesta(x, y);
// quanto spazio c'è intorno prima di uscire dal disegno (stima a raggi, per i computer)
function margine(x, y, max = 72) {
  if (!dentro(x, y)) return 0;
  for (let r = 8; r <= max; r += 8) for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; if (!dentro(x + Math.cos(a) * r, y + Math.sin(a) * r)) return r - 4; }
  return max;
}

class Calamaro extends Arena {
  constructor(o) {
    super(o, { id: 'calamaro', round: 4 });
    this.W = W; this.H = H;
    this.durata = DURATE.includes(Number(o.opzioni && o.opzioni.tempo)) ? Number(o.opzioni.tempo) : 60;
    // squadre fisse: posti pari (squadra A, rossa) e dispari (squadra B, blu); si alternano in attacco
    this.squadra = Array.from({ length: this.n }, (_, i) => i % 2);
    this.case = new Array(this.n).fill(0); this.eliminati = new Array(this.n).fill(0);
    this.avvia();
  }
  iniziaRound() {
    this.attacca = (this.round - 1) % 2;
    const att = [...Array(this.n).keys()].filter((p) => this.squadra[p] === this.attacca);
    const dif = [...Array(this.n).keys()].filter((p) => this.squadra[p] !== this.attacca);
    const postiDif = [[830, 250], [470, 310], [640, 250], [640, 370], [830, 370], [720, 310], [300, 230], [300, 390]];
    this.e = Array.from({ length: this.n }, (_, i) => {
      const e = { id: i, att: this.squadra[i] === this.attacca, zoppo: false, fuori: false, casa: false, el: null, kx: 0, ky: 0, terra: 0, carica: 0, da: null, daT: -9, vx: 0, vy: 0 };
      if (e.att) { const k = att.indexOf(i); e.x = 55; e.y = 150 + (k + 0.5) * (320 / att.length); e.zoppo = true; } else { const [x, y] = postiDif[dif.indexOf(i) % postiDif.length]; e.x = x; e.y = y; }
      return e;
    });
    this.spinte = []; this.mente = {}; this.casaTocca = 0; this.ultimoFatto = 0;
    this.annuncia(null, `Round ${this.round}: attacca la squadra ${this.attacca === 0 ? 'rossa' : 'blu'}`, '', false);
  }
  attivi(att) { return this.e.filter((e) => !e.fuori && !e.casa && e.att === att); }
  passo(dt) {
    aggiornaWin(this, dt);
    const t = this.tempoRound;
    // movimento
    for (let p = 0; p < this.n; p++) {
      const e = this.e[p];
      if (e.fuori || e.casa) continue;
      e.carica = Math.max(0, e.carica - dt);
      const i = this.inp[p];
      let dx = i.x, dy = i.y;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      if (t < e.terra) { dx = 0; dy = 0; }
      const v = (e.zoppo ? ZOPPO : e.att ? V_ATT : V_DIF) * (this.winOn[p] ? 1.2 : 1);
      e.vx = dx * v; e.vy = dy * v;
      this.cammina(e, dx * v * dt, dy * v * dt);
      // la spinta ricevuta (senza i muri del disegno: è così che si finisce fuori)
      if (Math.abs(e.kx) + Math.abs(e.ky) > 1) {
        const x0 = e.x, y0 = e.y;
        e.x = Math.max(R, Math.min(W - R, e.x + e.kx * dt)); e.y = Math.max(R, Math.min(H - R, e.y + e.ky * dt));
        // chi salta a zoppo non può essere sbalzato dentro il disegno (fuori dalla vita): resta sul bordo
        if (e.zoppo && dentro(e.x, e.y) && !inVita(e.x, e.y)) { e.x = x0; e.y = y0; e.kx = 0; e.ky = 0; }
        const k = Math.exp(-FRENO * dt); e.kx *= k; e.ky *= k;
      }
    }
    // gli omini non si attraversano (chi non è stato spinto non finisce fuori per una spallata)
    for (let a = 0; a < this.n; a++) for (let c = a + 1; c < this.n; c++) {
      const A = this.e[a], B = this.e[c];
      if (A.fuori || B.fuori || A.casa || B.casa) continue;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d >= R * 2 || d < 0.001) continue;
      const s = (R * 2 - d) / 2, nx = dx / d, ny = dy / d;
      for (const [E, k] of [[A, -1], [B, 1]]) {
        const x = E.x + nx * s * k, y = E.y + ny * s * k;
        if (this.valido(E, x, y)) { E.x = x; E.y = y; }
      }
    }
    // le spinte
    for (let p = 0; p < this.n; p++) {
      const e = this.e[p];
      if (e.fuori || e.casa) continue;
      const tocchi = this.nuoviTocchi(p);
      if (!tocchi || e.carica > 0 || t < e.terra) continue;
      e.carica = RICARICA;
      this.spinte.push([Math.round(e.x), Math.round(e.y), p]);
      this.cambiato = true;
      for (const o of this.e) {
        if (o.fuori || o.casa || o.att === e.att || this.winOn[o.id]) continue; // con il trucco non ti spinge nessuno
        const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy);
        if (d > PORTATA || d < 0.001) continue;
        // chi salta a zoppo viene sbalzato meno lontano, ma inciampa e resta fermo un attimo
        const f = SPINTA * (e.zoppo ? 0.45 : 1) * (o.zoppo ? LEGGERO : 1);
        o.kx += (dx / d) * f; o.ky += (dy / d) * f; o.da = p; o.daT = t;
        if (o.zoppo) o.terra = t + A_TERRA;
        e.kx -= (dx / d) * 60; e.ky -= (dy / d) * 60; // un piccolo contraccolpo
      }
    }
    // regole: entrata dalla vita, uscite dal disegno, casa
    for (let p = 0; p < this.n; p++) {
      const e = this.e[p];
      if (e.fuori || e.casa) continue;
      if (e.zoppo) {
        if (inVita(e.x, e.y)) { e.zoppo = false; this.cambiato = true; this.annuncia(p, 'supera la vita: ora corre! 🦑', 'hai superato la vita: ora corri! 🦑'); }
        continue;
      }
      if (!dentro(e.x, e.y)) { this.elimina(p); continue; }
      if (e.att && Math.hypot(e.x - CASA.x, e.y - CASA.y) <= R + CASA.r) {
        e.casa = true; this.case[p]++; this.punti[p] += P_CASA; this.casaTocca++; this.cambiato = true; this.ultimoFatto = t;
        this.annuncia(p, `tocca la testa del calamaro! +${P_CASA} 🦑`, `hai toccato la testa del calamaro! +${P_CASA} 🦑`, true);
      }
    }
    const att = this.attivi(true).length;
    if (att === 0) return t - this.ultimoFatto > 1.2;
    return t >= this.durata;
  }
  // dove si può stare camminando: dentro il disegno (difensori e attaccanti che hanno superato la vita) o fuori
  // (a zoppo, più la vita da cui si entra), sempre dentro il campo
  valido(e, x, y) {
    if (x < R || x > W - R || y < R || y > H - R) return false;
    return e.zoppo ? !dentro(x, y) || inVita(x, y) : dentro(x, y);
  }
  // prima in orizzontale poi in verticale, così si scivola lungo le linee
  cammina(e, mx, my) {
    if (this.valido(e, e.x + mx, e.y)) e.x += mx;
    if (this.valido(e, e.x, e.y + my)) e.y += my;
  }
  elimina(p) {
    const e = this.e[p], t = this.tempoRound;
    e.fuori = true; e.el = t; this.cambiato = true; this.ultimoFatto = t;
    const chi = e.da !== null && t - e.daT < 2.5 && !this.e[e.da].fuori ? e.da : null;
    if (chi !== null) {
      this.punti[chi] += P_ELIMINA; this.eliminati[chi]++;
      this.annuncia(chi, `spinge fuori @! +${P_ELIMINA} 💥`, `spingi fuori @! +${P_ELIMINA} 💥`, false, { bersaglio: p, testoTe: 'ti ha spinto fuori dal disegno: eliminato!' });
    } else this.annuncia(p, 'esce dal disegno: eliminato!', 'sei uscito dal disegno: eliminato!');
  }
  fineRound() {
    fineWin(this);
    const dif = this.e.filter((e) => !e.att && !e.fuori);
    for (const d of dif) this.punti[d.id] += P_RESISTE + (this.casaTocca ? 0 : P_MURO);
    if (!this.casaTocca && dif.length) this.annuncia(null, `Nessuno ha toccato la testa: i difensori rimasti prendono ${P_RESISTE + P_MURO} punti 🛡️`, '', true);
    else if (this.casaTocca) this.annuncia(null, `${this.casaTocca} ${this.casaTocca === 1 ? 'attaccante ha' : 'attaccanti hanno'} toccato la testa del calamaro`, '', true);
  }

  // ---------------- computer ----------------
  pensa(p, liv) {
    const e = this.e[p];
    if (e.fuori || e.casa) return {};
    const t = this.tempoRound;
    const m = this.mente[p] || (this.mente[p] = { fino: 0, x: 0, y: 0, varco: e.y < H / 2 ? 0 : 1, dalVarco: 0, attesa: casuale(0.3, 2) });
    if (t < m.fino) return { x: m.x, y: m.y };
    m.fino = t + { facile: 0.3, medio: 0.14, difficile: 0.05 }[liv];
    const nemici = this.e.filter((o) => !o.fuori && !o.casa && o.att !== e.att);
    let tx = e.x, ty = e.y, tocco = false;
    const vicino = (o) => Math.hypot(o.x - e.x, o.y - e.y) <= PORTATA - 4;
    const resta = this.durata - t;
    if (e.att && e.zoppo) {
      // ---- attaccante a zoppo: gira intorno al corpo fino a una delle linee della vita, aspetta il momento e salta dentro
      if ((m.varco === 0) !== (e.y < H / 2)) { m.varco = e.y < H / 2 ? 0 : 1; m.dalVarco = 0; } // spinto dall'altra parte
      const sopra = m.varco === 0;
      const my = (y) => (sopra ? y : H - y); // il percorso di sotto è lo specchio di quello di sopra
      const y = my(e.y);
      // il punto della linea più lontano dai difensori
      const gy = my(VITA.y0);
      let gx = 450, lontano = -1;
      for (let x = VITA.x0 + R + 4; x <= VITA.x1 - R - 4; x += 10) {
        const d = Math.min(...nemici.map((o) => Math.hypot(o.x - x, o.y - gy)), 999);
        if (d > lontano) { lontano = d; gx = x; }
      }
      if (e.x < Q.x0 - 4 && y > Q.y0 - R - 6) { tx = 95; ty = my(Q.y0 - R - 10); }
      else if (e.x < VITA.x0 + R + 4 && y < Q.y0 - R + 4) { tx = 450; ty = my(Q.y0 - R - 12); }
      else if (e.x > VITA.x1 + R) { tx = 450; ty = my(Q.y0 - R - 12); }
      else {
        // nella tasca sopra la vita: si aspetta il momento buono
        const d = lontano;
        const pronto = { facile: () => t > m.attesa, medio: () => d > 75 || m.dalVarco > 5, difficile: () => d > 95 || nemici.every((o) => o.carica > 0.35 || Math.hypot(o.x - gx, o.y - gy) > 70) }[liv]();
        if (resta < 12 || pronto) { tx = gx; ty = my(VITA.y0 + 30); }
        else if (liv === 'difficile' && m.dalVarco > 1.2 && t >= e.terra) { tx = gx; ty = my(VITA.y0 - 8); } // provoca: si avvicina perché il difensore sprechi la spinta
        else { tx = gx; ty = my(VITA.y0 - PORTATA - 18); }
        m.dalVarco += t - (m.ultimo || t);
        // troppa attesa da questa parte: si prova l'altra linea (non il facile)
        // (si torna indietro intorno al corpo: lo specchio del percorso fa il resto)
        if (liv !== 'facile' && m.dalVarco > { medio: 8, difficile: 5 }[liv]) { m.varco = 1 - m.varco; m.dalVarco = 0; m.giro = t + 6; }
      }
      m.ultimo = t;
      // spinge un difensore che sta sul bordo della vita (lo fa uscire)
      for (const o of nemici) if (vicino(o)) {
        const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (liv === 'facile' ? Math.random() < 0.3 : !dentro(o.x + (dx / d) * 80, o.y + (dy / d) * 80)) tocco = true;
      }
    } else if (e.att) {
      // ---- attaccante libero: verso la casa, lontano dai difensori e dalle linee
      const paura = { facile: 0.3, medio: 0.9, difficile: 1.6 }[liv], bordo = { facile: 0.6, medio: 2, difficile: 3.2 }[liv];
      let meglio = -Infinity;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, px = e.x + Math.cos(a) * 34, py = e.y + Math.sin(a) * 34;
        if (!dentro(px, py)) continue;
        let s = -Math.hypot(px - CASA.x, py - CASA.y);
        for (const o of nemici) { const d = Math.hypot(o.x - px, o.y - py); if (d < 120) s -= (120 - d) * paura; }
        const mg = margine(px, py, 40); if (mg < 36) s -= (36 - mg) * bordo;
        s += casuale(-1, 1) * { facile: 30, medio: 8, difficile: 2 }[liv];
        if (s > meglio) { meglio = s; tx = px; ty = py; }
      }
      for (const o of nemici) if (vicino(o)) {
        const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (liv === 'facile' ? Math.random() < 0.4 : liv === 'medio' ? true : !dentro(o.x + (dx / d) * 70, o.y + (dy / d) * 70) || margine(e.x, e.y) < 30) tocco = true;
      }
    } else {
      // ---- difensore: uno presidia la testa, gli altri la vita; chi è più vicino a un attaccante libero lo carica
      const difensori = this.e.filter((o) => !o.att && !o.fuori).map((o) => o.id);
      const ruolo = difensori.indexOf(p);
      const guardia = ruolo === 0 && difensori.length > 1 && liv !== 'facile';
      const liberi = nemici.filter((o) => !o.zoppo), zoppi = nemici.filter((o) => o.zoppo);
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      let caccia = null;
      if (liv === 'facile') { for (const a of liberi) if (dist(a, e) < 260 && (!caccia || dist(a, e) < dist(caccia, e))) caccia = a; } else {
        for (const a of liberi) {
          const cacciatori = difensori.filter((q) => !(q === difensori[0] && difensori.length > 1));
          const piuVicino = cacciatori.reduce((b, q) => (dist(this.e[q], a) < dist(this.e[b], a) ? q : b), cacciatori[0]);
          if (piuVicino === p && (!caccia || dist(a, e) < dist(caccia, e))) caccia = a;
        }
      }
      if (guardia && liberi.length) {
        // guardiano della testa: tra la casa e l'attaccante più vicino; se arriva vicino lo carica
        const a = liberi.reduce((b, o) => (dist(o, CASA) < dist(b, CASA) ? o : b));
        const d = dist(a, CASA) || 1, k = Math.min(d - 10, 70);
        tx = CASA.x + ((a.x - CASA.x) / d) * k; ty = CASA.y + ((a.y - CASA.y) / d) * k;
        if (d < 150) { tx = a.x; ty = a.y; }
      } else if (caccia) {
        tx = caccia.x; ty = caccia.y;
        // il difficile gli taglia la strada verso la casa
        if (liv === 'difficile' && dist(caccia, e) > PORTATA + 30) { const dc = dist(caccia, CASA) || 1, k = Math.min(70, dc * 0.5); tx = caccia.x + ((CASA.x - caccia.x) / dc) * k; ty = caccia.y + ((CASA.y - caccia.y) / dc) * k; }
        // e da vicino lo carica dal lato del centro del disegno, così la spinta lo porta verso il bordo
        else if (liv === 'difficile' && dist(caccia, e) > PORTATA) {
          const cx = caccia.x < VITA.x1 ? 450 : caccia.x < 700 ? 610 : TESTA.x;
          const ux = caccia.x - cx, uy = caccia.y - 310, l = Math.hypot(ux, uy) || 1;
          tx = caccia.x - (ux / l) * 22; ty = caccia.y - (uy / l) * 22;
        }
      } else if (guardia) { tx = CASA.x - 50; ty = CASA.y; } else if (liv === 'facile') {
        if (!m.giro || t > m.giro) { m.giro = t + casuale(1, 3); m.gx = 450 + casuale(-60, 60); m.gy = 310 + casuale(-30, 30); }
        tx = m.gx; ty = m.gy;
      } else {
        // presidia la linea della vita dove sta arrivando un attaccante a zoppo (ognuno il suo)
        const ord = zoppi.slice().sort((u, v) => dist(u, { x: 450, y: 310 }) - dist(v, { x: 450, y: 310 }));
        const k = Math.max(0, ruolo - (difensori.length > 1 ? 1 : 0));
        const z = ord.length ? ord[k % ord.length] : null;
        const lato = z ? (z.y < 310 ? -1 : 1) : (k % 2 ? 1 : -1);
        tx = z ? Math.max(VITA.x0 + R + 6, Math.min(VITA.x1 - R - 6, z.x)) : 450;
        ty = 310 + lato * (liv === 'difficile' ? 4 : 16);
      }
      // le spinte: sempre su chi salta a zoppo (cade), sugli altri quando servono a buttarli fuori
      for (const o of nemici) if (vicino(o)) {
        const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (liv === 'facile') { if (Math.random() < 0.35) tocco = true; } else if (o.zoppo || liv === 'medio' || !dentro(o.x + (dx / d) * 80, o.y + (dy / d) * 80) || margine(o.x, o.y) < 46) tocco = true;
      }
      // il difficile non resta sul bordo quando un attaccante è vicino (rischia di essere spinto fuori)
      if (liv === 'difficile' && nemici.some((o) => Math.hypot(o.x - e.x, o.y - e.y) < 90) && margine(e.x, e.y, 40) < 24) {
        let mx = 0, my2 = 0; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const mg = margine(e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, 40); mx += Math.cos(a) * mg; my2 += Math.sin(a) * mg; }
        tx = e.x + mx; ty = e.y + my2;
      }
    }
    const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy);
    const err = { facile: 0.45, medio: 0.15, difficile: 0.03 }[liv];
    if (l < 4) { m.x = 0; m.y = 0; } else { m.x = dx / l + casuale(-err, err); m.y = dy / l + casuale(-err, err); const k = Math.hypot(m.x, m.y) || 1; m.x /= k; m.y /= k; }
    return { x: m.x, y: m.y, tocco };
  }

  vistaExtra() { return { Q, VITA, TRI, TESTA, CASA, r: R, portata: PORTATA, squadra: this.squadra, durata: this.durata, case: this.case, eliminati: this.eliminati }; }
  statoTick() {
    const sp = this.spinte; this.spinte = [];
    const t = this.tempoRound;
    return {
      at: this.attacca, resta: Math.max(0, Math.ceil(this.durata - t)),
      e: this.e.map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), a: e.att ? 1 : 0, z: e.zoppo ? 1 : 0, f: e.fuori ? 1 : 0, c: e.casa ? 1 : 0, el: e.el, tr: t < e.terra ? 1 : 0, ca: e.carica > 0 ? 1 : 0 })),
      sp,
    };
  }
}

module.exports = {
  meta: {
    id: 'calamaro',
    nome: 'Il gioco del calamaro',
    tipo: 'tabellone',
    tempoReale: true,
    pausaBoss: true,
    giocatori: [2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Squid Game, l\'ultimo gioco: attaccanti contro difensori sul calamaro disegnato per terra. Tocca la testa o spingi fuori gli altri!',
    alias: ['calamaro', 'squid', 'squid game', 'gioco del calamaro', 'ojingeo', 'seppia'],
    opzioni: [
      { id: 'round', nome: 'Round', valori: [4, 2, 6], etichette: ['4 round', '2 round', '6 round'], predefinito: 4 },
      { id: 'tempo', nome: 'Durata del round', valori: [60, 45, 90], etichette: ['60 secondi', '45 secondi', '90 secondi'], predefinito: 60 },
    ],
    regole: [
      'Per terra è disegnato il calamaro: il CORPO (il quadrato a sinistra), la VITA (il passaggio stretto), il triangolo e la TESTA (il cerchio a destra), dove c\'è la CASA. Ti muovi con WASD o le frecce (sul telefono col joystick); spingi con spazio (o il pulsante 🤚).',
      'Due squadre fisse, la rossa (posti dispari: 1°, 3°…) e la blu, che si scambiano i ruoli a ogni round: così tutti attaccano e difendono lo stesso numero di volte.',
      'Gli ATTACCANTI partono fuori dal disegno, a sinistra. Fuori dal disegno saltano a zoppo (vanno alla metà della velocità) e non possono mettere piede nel disegno, tranne che dalla VITA: si entra attraversando una delle sue due linee lunghe, sopra o sotto. Superata la vita si corre, e bisogna arrivare a toccare la CASA nella testa del calamaro.',
      'I DIFENSORI stanno sempre dentro il disegno e cercano di fermare gli attaccanti spingendoli fuori.',
      'La spinta sbalza via chi è vicino (dopo ogni spinta ci vuole quasi un secondo per ricaricarla). Chi è dentro il disegno e viene spinto fuori è ELIMINATO per il resto del round: vale sia per gli attaccanti sia per i difensori, che quindi devono stare attenti alle linee. Chi salta a zoppo, se viene spinto, cade a terra per un secondo.',
      'Punti: 5 a chi tocca la casa, 2 a chi spinge fuori un avversario, 1 a ogni difensore rimasto in piedi a fine round, e 2 in più ai difensori se nessuno ha toccato la casa.',
      'Il round finisce quando non ci sono più attaccanti in gioco (tutti eliminati o arrivati) oppure allo scadere del tempo (60 secondi, o 45, o 90). Dopo 4 round (o 2, o 6) vince chi ha più punti.',
      'Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
      'Il computer facile si muove un po\' a caso, spinge quando capita e salta dentro la vita senza aspettare; il medio aspetta che la linea sia libera, carica gli attaccanti e presidia testa e vita; il difficile cerca il varco più lontano dai difensori (e cambia lato se è chiuso), approfitta di quando hanno appena spinto, aggira i difensori e li spinge fuori quando sono sul bordo; in difesa si mette tra la casa e gli attaccanti, li carica dal lato del centro e non resta mai sulle linee.',
    ],
  },
  crea: (o) => new Calamaro(o),
  bot: () => ({}),
  _test: { Calamaro, dentro, inVita, margine, CASA, VITA, Q, TESTA, PORTATA },
};
