// WANTED! (ispirato al minigioco del Nintendo DS, con personaggi originali): in alto c'è il manifesto del RICERCATO,
// sotto una folla di facce. Il ricercato è uno solo: trovalo e cliccalo (o toccalo) prima degli altri.
// Un clic sbagliato su un'altra faccia ti blocca per 2 secondi. La folla cambia a ogni round e diventa sempre più
// difficile: griglia, facce sparse, file che scorrono, facce che rimbalzano, cerchi che girano, pioggia, calca.
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
const W = 1000, H = 620, TOP = 130, R = 24, TEMPO = 15, BLOCCO = 2;
const TIPI = ['pirata', 'robot', 'gatto', 'cuoco', 'astronauta', 'ninja', 'fantasma', 'dinosauro', 'mago', 'alieno', 'vichingo', 'zombie'];
const SCHEMI = ['griglia', 'sparsi', 'righe', 'rimbalzo', 'cerchi', 'pioggia', 'calca'];
// i livelli del tavolo, da Facile a Impossibile: quante facce (all'inizio, in più a ogni round, al massimo), quanti
// personaggi diversi nella folla, quanto si muovono, quali schemi, quanto è grande ogni faccia
const LIVELLI = {
  facile: { facce: 22, cresce: 1, max: 40, tipi: 4, vel: 0.45, oscilla: 0.4, r: 26, schemi: ['griglia', 'sparsi', 'righe'] },
  normale: { facce: 40, cresce: 2, max: 70, tipi: 6, vel: 0.7, oscilla: 0.7, r: 25, schemi: ['griglia', 'sparsi', 'righe', 'cerchi', 'pioggia'] },
  difficile: { facce: 76, cresce: 3, max: 120, tipi: 4, vel: 1, oscilla: 1, r: 24, schemi: SCHEMI },
  esperto: { facce: 110, cresce: 4, max: 170, tipi: 8, vel: 1.15, oscilla: 1.1, r: 23, schemi: SCHEMI },
  estremo: { facce: 160, cresce: 5, max: 230, tipi: 10, vel: 1.3, oscilla: 1.2, r: 22, schemi: SCHEMI },
  impossibile: { facce: 300, cresce: 8, max: 380, tipi: 12, vel: 1.5, oscilla: 1.35, r: 20, schemi: SCHEMI },
};
const NOMI_LIVELLI = ['facile', 'normale', 'difficile', 'esperto', 'estremo', 'impossibile'];

class Wanted extends Arena {
  constructor(o) {
    super(o, { id: 'wanted', round: 15, tickMs: 50 });
    this.W = W; this.H = H;
    this.viaMs = 1000; this.pausaRoundMs = 2200; // round brevi: poca attesa tra l'uno e l'altro
    this.livello = LIVELLI[o.opzioni && o.opzioni.difficolta] ? o.opzioni.difficolta : 'difficile';
    this.L = LIVELLI[this.livello];
    // gli schemi del livello in ordine a caso; dal Difficile in su si comincia sempre da uno dei più difficili
    const schemi = this.L.schemi, difficili = ['calca', 'rimbalzo', 'pioggia', 'cerchi'].filter((x) => schemi.includes(x));
    const primo = difficili.length && schemi === SCHEMI ? difficili[Math.floor(Math.random() * difficili.length)] : schemi[Math.floor(Math.random() * schemi.length)];
    const resto = schemi.filter((x) => x !== primo); for (let i = resto.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [resto[i], resto[j]] = [resto[j], resto[i]]; }
    this.ordine = [primo, ...resto];
    this.avvia();
  }
  iniziaRound() {
    const k = this.round - 1;
    // lo schema: i primi in ordine, poi a caso tra tutti; le facce aumentano col passare dei round
    const L = this.L, R = L.r;
    this.schema = k < this.ordine.length ? this.ordine[k] : L.schemi[Math.floor(Math.random() * L.schemi.length)];
    // i personaggi di questo round: tanti quanti dice il livello, scelti a caso tra i 12
    const tipi = [...TIPI].sort(() => Math.random() - 0.5).slice(0, L.tipi);
    this.ricercato = tipi[0];
    const altri = tipi.slice(1);
    const quanti = Math.min(L.max, L.facce + k * L.cresce + (this.schema === 'calca' ? Math.round(L.facce / 4) : 0));
    this.facce = [];
    const bassa = TOP + R, alta = H - R, sx = R, dx = W - R;
    // ogni faccia, oltre allo schema, gira su un suo piccolo cerchio e ruota su sé stessa: nessuno sta mai fermo
    const metti = (f) => this.facce.push({ tipo: altri[Math.floor(Math.random() * altri.length)], oa: casuale(10, 26) * L.oscilla, ow: casuale(1.6, 3.4) * (Math.random() < 0.5 ? 1 : -1), of: Math.random() * 6.3, rf: casuale(-0.6, 0.6), rw: casuale(0.6, 2.2) * (Math.random() < 0.5 ? 1 : -1), ...f });
    if (this.schema === 'griglia') {
      const col = Math.ceil(Math.sqrt(quanti * 2)), righe = Math.ceil(quanti / col);
      for (let i = 0; i < quanti; i++) metti({ bx: sx + 20 + (i % col) * ((dx - sx - 40) / Math.max(1, col - 1)), by: bassa + 10 + Math.floor(i / col) * ((alta - bassa - 20) / Math.max(1, righe - 1)) });
    } else if (this.schema === 'righe' || this.schema === 'pioggia') {
      const file = Math.max(3, Math.round(Math.sqrt(quanti / 2))), perFila = Math.ceil(quanti / file);
      for (let f = 0; f < file; f++) {
        const v = casuale(90, 170) * L.vel * (f % 2 ? -1 : 1);
        for (let j = 0; j < perFila && this.facce.length < quanti; j++) {
          if (this.schema === 'righe') metti({ bx: (j * (W + 60)) / perFila, by: bassa + 10 + f * ((alta - bassa - 20) / Math.max(1, file - 1)), vx: v, vy: 0, giro: W + 60 });
          else metti({ bx: sx + 20 + f * ((dx - sx - 40) / Math.max(1, file - 1)), by: TOP + (j * (H - TOP + 60)) / perFila, vx: 0, vy: Math.abs(v) * 0.8, giro: H - TOP + 60 });
        }
      }
    } else if (this.schema === 'cerchi') {
      const anelli = Math.max(2, Math.min(5, Math.round(quanti / 12)));
      let messe = 0;
      for (let a = 0; a < anelli; a++) {
        const r = 50 + a * 50, n = a === anelli - 1 ? quanti - messe : Math.round((quanti * (a + 1)) / ((anelli * (anelli + 1)) / 2));
        for (let j = 0; j < n && messe < quanti; j++, messe++) metti({ cx: W / 2, cy: (TOP + H) / 2, r, ang: (j / n) * Math.PI * 2, w: (a % 2 ? -1 : 1) * (0.5 + a * 0.12) * L.vel });
      }
    } else {
      // sparsi, rimbalzo, calca: posizioni a caso (nella calca si possono sovrapporre)
      for (let i = 0; i < quanti; i++) {
        let x, y, t = 0;
        do { x = casuale(sx, dx); y = casuale(bassa, alta); t++; } while (this.schema !== 'calca' && t < 30 && this.facce.some((f) => Math.hypot(f.bx - x, f.by - y) < R * 1.7));
        const v = (this.schema === 'rimbalzo' ? casuale(110, 210) : this.schema === 'calca' ? casuale(60, 140) : casuale(35, 80)) * L.vel, a = Math.random() * Math.PI * 2;
        metti({ bx: x, by: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rimbalza: true });
      }
    }
    // il ricercato prende il posto di una faccia a caso (nella calca non in fondo alla pila, così si vede)
    const quale = this.schema === 'calca' ? Math.floor(this.facce.length * (0.5 + Math.random() * 0.45)) : Math.floor(Math.random() * this.facce.length);
    this.facce[quale].tipo = this.ricercato; this.quale = quale;
    this.bloccati = new Array(this.n).fill(0);
    this.trovato = null; this.mente = {}; this.sbagli = [];
    this.aggiornaPosizioni(0);
  }
  aggiornaPosizioni(t) {
    this.posizioniSchema(t);
    for (const f of this.facce) {
      f.x = Math.max(R, Math.min(W - R, f.x + Math.cos(t * f.ow + f.of) * f.oa));
      f.y = Math.max(TOP + R, Math.min(H - R, f.y + Math.sin(t * f.ow + f.of) * f.oa * 0.8));
      f.ang = f.rf + Math.sin(t * f.rw) * 0.9; // dondola e si gira: il ricercato non si riconosce a colpo d'occhio
    }
  }
  posizioniSchema(t) {
    for (const f of this.facce) {
      if (f.cx !== undefined) { f.x = f.cx + Math.cos(f.ang + t * f.w) * f.r * 1.6; f.y = f.cy + Math.sin(f.ang + t * f.w) * f.r * 0.85; continue; }
      if (f.rimbalza) {
        // rimbalzo: posizione "piegata" dentro il campo (senza stato, così è uguale per tutti)
        const piega = (p, a, b) => { const l = b - a, m = ((p - a) % (2 * l) + 2 * l) % (2 * l); return a + (m < l ? m : 2 * l - m); };
        f.x = piega(f.bx + f.vx * t, R, W - R); f.y = piega(f.by + f.vy * t, TOP + R, H - R); continue;
      }
      if (f.giro) {
        if (f.vx) f.x = ((f.bx + f.vx * t) % f.giro + f.giro) % f.giro - 30; else f.x = f.bx;
        if (f.vy) f.y = TOP + ((f.by - TOP + f.vy * t) % f.giro + f.giro) % f.giro - 30; else f.y = f.by;
        continue;
      }
      f.x = f.bx; f.y = f.by;
    }
  }
  // la faccia sotto il puntatore (quella disegnata sopra, cioè l'ultima)
  // la faccia sotto il puntatore: se c'è il ricercato conta lui (anche se un'altra faccia gli passa sopra),
  // altrimenti quella disegnata sopra, cioè l'ultima
  colpita(x, y, largo = false) {
    const r = this.L.r, q = this.facce[this.quale];
    if (q && Math.hypot(q.x - x, q.y - y) < r * (largo ? 2.5 : 1)) return this.quale;
    for (let i = this.facce.length - 1; i >= 0; i--) { const f = this.facce[i]; if (Math.hypot(f.x - x, f.y - y) < r) return i; }
    return -1;
  }
  passo(dt) {
    const t = this.tempoRound;
    this.aggiornaPosizioni(t);
    if (this.trovato !== null) return t - this.trovato.t > 0.05;
    // il trucco segreto (!win): gli si sussurra dov'è il ricercato, il clic vale anche se è un po' fuori e gli errori non bloccano
    const win = this.facce.length ? Array.from({ length: this.n }, (_, p) => conTrucco(this, p)) : [];
    win.forEach((w, p) => { if (w && this.detto !== this.round * 100 + p) { this.detto = this.round * 100 + p; T.sussurra(this, p, `💡 Il ${this.ricercato} è ${this.zona(this.facce[this.quale])}`, 3000); } });
    for (let p = 0; p < this.n; p++) {
      if (!this.nuoviTocchi(p)) continue;
      const i = this.inp[p];
      if (i.mx === null || t < this.bloccati[p]) continue;
      const c = this.colpita(i.mx, i.my, win[p]);
      if (c < 0) continue;
      if (c === this.quale) {
        this.trovato = { p, t };
        const veloce = t < 3 ? 1 : 0;
        this.punti[p] += 1 + veloce;
        this.annuncia(p, `ha trovato il ricercato in ${t.toFixed(1)} s!${veloce ? ' ⚡ +1' : ''}`, `l'hai trovato in ${t.toFixed(1)} s!${veloce ? ' ⚡ +1' : ''}`, true);
        this.cambiato = true;
        return true;
      }
      if (!win[p]) this.bloccati[p] = t + BLOCCO;
      this.sbagli.push([p, Math.round(i.mx), Math.round(i.my)]); this.cambiato = true;
    }
    if (t >= TEMPO) { this.annuncia(null, 'Tempo scaduto: nessuno l\'ha trovato', 'Tempo scaduto', true); return true; }
    return false;
  }
  fineRound() { fineTrucco(this, true); }
  // in che zona del campo è una faccia (per il suggerimento segreto)
  zona(f) {
    const v = f.y < TOP + (H - TOP) / 3 ? 'in alto' : f.y > TOP + ((H - TOP) * 2) / 3 ? 'in basso' : 'a metà altezza';
    const o = f.x < W / 3 ? 'a sinistra' : f.x > (W * 2) / 3 ? 'a destra' : 'al centro';
    return `${v} ${o}`;
  }
  // il computer: lo "vede" dopo un tempo che dipende dal livello, da quante facce ci sono e se si muovono
  pensa(p, liv) {
    const m = this.mente[p] || (this.mente[p] = {});
    const t = this.tempoRound;
    if (m.round !== this.round) {
      m.round = this.round;
      const base = { facile: casuale(3.5, 8), medio: casuale(2, 5), difficile: casuale(1.5, 3.8) }[liv];
      // più facce e più movimento = ci vuole di più; con folle enormi cresce più piano (come per una persona)
      const muove = 1 + 0.35 * this.L.vel;
      m.quando = base * (0.3 + Math.sqrt(this.facce.length) / 11 + this.L.tipi / 40) * muove;
      m.sbaglia = Math.random() < { facile: 0.35, medio: 0.15, difficile: 0.03 }[liv] ? m.quando * 0.6 : null;
    }
    if (m.sbaglia !== null && t >= m.sbaglia) { m.sbaglia = null; const f = this.facce[(this.quale + 1) % this.facce.length]; return { mx: f.x, my: f.y, tocco: true }; }
    if (t >= m.quando && t >= this.bloccati[p]) { const f = this.facce[this.quale]; return { mx: f.x + casuale(-4, 4), my: f.y + casuale(-4, 4), tocco: true }; }
    return {};
  }
  statoTick() {
    const sbagli = this.sbagli; this.sbagli = [];
    // nel conto alla rovescia (e in pausa) le facce non si mandano: ferme, il ricercato si troverebbe subito
    const coperte = this.fase === 'via' || (this.fase === 'gioco' && this.inPausa);
    return {
      ric: this.ricercato, sc: this.schema, r: this.L.r, lv: this.livello, resta: Math.max(0, Math.ceil(TEMPO - this.tempoRound)), nf: this.facce.length,
      f: coperte ? [] : this.facce.map((f) => [Math.round(f.x), Math.round(f.y), TIPI.indexOf(f.tipo), Math.round(f.ang * 10)]),
      tr: this.trovato ? { p: this.trovato.p, i: this.quale, t: this.trovato.t } : this.fase === 'pausaRound' ? { p: null, i: this.quale } : null,
      bl: this.bloccati.map((b) => Math.max(0, Math.round((b - this.tempoRound) * 10) / 10)), sb: sbagli,
    };
  }
}

module.exports = {
  meta: {
    id: 'wanted',
    nome: 'Wanted!',
    tipo: 'tabellone',
    tempoReale: true,
    pausaBoss: true,
    giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Il manifesto dice chi cercare: trovalo in mezzo alla folla prima degli altri! Dodici personaggi e sei difficoltà, da Facile a Impossibile.',
    alias: ['wanted', 'ricercato', 'trova', 'folla', 'facce', 'trova il personaggio'],
    opzioni: [
      { id: 'difficolta', nome: 'Difficoltà', valori: ['difficile', 'facile', 'normale', 'esperto', 'estremo', 'impossibile'], etichette: ['Difficile', 'Facile', 'Normale', 'Esperto', 'Estremo', 'Impossibile'], predefinito: 'difficile' },
      { id: 'round', nome: 'Round', valori: [15, 10, 25], etichette: ['15 round', '10 round', '25 round'], predefinito: 15 },
    ],
    regole: [
      'In alto c\'è il manifesto RICERCATO con la faccia da trovare. Sotto c\'è una folla di personaggi (pirata, robot, gatto, cuoco, astronauta, ninja, fantasma, dinosauro, mago, alieno, vichingo, zombie), ma quello ricercato c\'è una volta sola.',
      'Trovalo e cliccalo (sul telefono toccalo) prima degli altri: prendi 1 punto, 2 se lo trovi in meno di 3 secondi.',
      'Se clicchi una faccia sbagliata resti bloccato per 2 secondi (il cursore diventa rosso). Cliccare nel vuoto non conta. Se il ricercato è sotto il puntatore conta lui, anche se un\'altra faccia gli passa sopra.',
      'Difficoltà (si sceglie al tavolo): Facile (una ventina di facce, 4 personaggi, lente, solo griglia, sparse e file), Normale (una quarantina, 6 personaggi), Difficile (circa 80 facce che diventano 120), Esperto (oltre 100, 8 personaggi), Estremo (oltre 150, 10 personaggi, più veloci) e Impossibile (300 facce che diventano quasi 400, tutti e 12 i personaggi, piccole e velocissime).',
      'Round dopo round la folla cresce e cambia schema: griglia, facce sparse, file che scorrono, rimbalzi, cerchi che girano, pioggia, calca (dove le facce si sovrappongono).',
      'Sul telefono, se le facce sono tantissime, se ne vedono al massimo 120 (il ricercato c\'è sempre), così restano toccabili: toccare dove non si vede niente non conta.',
      'Dopo 15 round (o 10, o 25) vince chi ha più punti.',
      'Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
      'Il computer facile ci mette tanto e spesso sbaglia; il medio è abbastanza svelto; il difficile ha l\'occhio lungo e sbaglia quasi mai. Più la folla è grande, più ci mettono anche loro.',
    ],
  },
  crea: (o) => new Wanted(o),
  bot: () => ({}),
  _test: { Wanted, TIPI, SCHEMI, LIVELLI, NOMI_LIVELLI },
};
