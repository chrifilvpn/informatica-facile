// TIRO AL BERSAGLIO (ispirato al Ninja Dojo di Kirby, ma con arco e frecce): a ogni round compare un bersaglio a una
// distanza diversa (vicino, medio, lontano). Si mira col mouse (o col dito) e si tira una freccia sola: il mirino sta
// fermo dove lo metti, ma la freccia cala (di più sui bersagli lontani), il vento la sposta di lato (si vede quanto),
// ci mette un attimo ad arrivare e davanti al bersaglio passano assi di legno che la fermano.
// Più vicino al centro, più punti; i bersagli lontani valgono di più.
// Bersaglio, assi e oscillazione dipendono solo dal tempo del round: il browser li ricalcola da solo.
const { Arena, casuale } = require('./arena');
const T = require('./trucco');
const W = 1000, H = 620, TEMPO = 6, BORDO = 0.35;
const DIST = { 1: { nome: 'vicino', R: 62, y: 360, per: 1, cala: 12, vento: 0.5 }, 2: { nome: 'medio', R: 42, y: 318, per: 2, cala: 30, vento: 1 }, 3: { nome: 'lontano', R: 28, y: 292, per: 3, cala: 52, vento: 1.6 } };
const ANELLI = [[0.15, 10], [0.35, 8], [0.55, 6], [0.75, 4], [1, 2]];

// posizioni in funzione del tempo (uguali nel browser, vedi public/js/giochi/bersaglio.js)
const posBersaglio = (b, t) => ({ x: b.x0 + b.amp * Math.sin(b.om * t + b.fase), y: b.y });
const posAsse = (a, t) => ({ x: a.x0 + a.amp * Math.sin(a.om * t + a.fase), y: a.y });
// dove finisce la freccia rispetto al punto mirato: il vento la porta di lato, la distanza la fa calare
const deriva = (aria) => ({ x: aria.vento, y: aria.cala });
const volo = (d) => 0.28 + 0.2 * d; // secondi di volo della freccia

function punteggio(dist, R, per) {
  const r = dist / R;
  for (const [lim, p] of ANELLI) if (r <= lim) return { punti: p * per, centro: lim === 0.15 };
  return { punti: 0, centro: false };
}

class Bersaglio extends Arena {
  constructor(o) {
    super(o, { id: 'bersaglio', round: 8, tickMs: 40 });
    this.W = W; this.H = H;
    this.viaMs = 1200; this.pausaRoundMs = 2400;
    this.avvia();
  }
  iniziaRound() {
    const k = this.round;
    // distanza: i primi due vicino e medio, poi a caso con i lontani sempre più frequenti
    const d = k === 1 ? 1 : k === 2 ? 2 : Math.random() < 0.25 ? 1 : Math.random() < 0.5 ? 2 : 3;
    const D = DIST[d];
    const muove = k >= 2 && Math.random() < 0.75;
    this.b = { d, R: D.R, y: D.y, x0: casuale(260, 740), amp: muove ? casuale(110, 240) / d ** 0.3 : 0, om: casuale(1.1, 2.2), fase: Math.random() * 6.3 };
    this.b.x0 = Math.max(120 + this.b.amp, Math.min(W - 120 - this.b.amp, this.b.x0));
    // assi che passano davanti (da metà partita anche due o tre)
    const nAssi = k <= 1 ? 0 : k <= 3 ? 1 : Math.min(3, 1 + Math.floor(Math.random() * (k >= 6 ? 3 : 2)));
    this.assi = Array.from({ length: nAssi }, (_, i) => {
      const w = casuale(55, 95) * (1.3 - d * 0.1), h = casuale(130, 200);
      return { id: i, w, h, y: D.y + casuale(-25, 25), x0: this.b.x0 + casuale(-60, 60), amp: casuale(150, 280), om: casuale(1.1, 2.4) * (i % 2 ? -1 : 1), fase: Math.random() * 6.3 };
    });
    // il vento (forza da 0 a 3, verso a caso) cresce coi round; spinge la freccia di lato, di più da lontano
    const forza = k <= 1 ? 0 : Math.min(3, Math.floor(Math.random() * (1 + k / 2.5))), verso = Math.random() < 0.5 ? -1 : 1;
    this.aria = { forza, verso, vento: forza * verso * 14 * D.vento, cala: D.cala };
    this.frecce = []; this.tirato = new Array(this.n).fill(false); this.fineDopo = null;
    this.mente = {};
    this.cambiato = true;
  }
  // dove va la freccia tirata al tempo t mirando a (mx, my): esito, punti e quando arriva
  tiro(p, mx, my, t) {
    if (this.tirato[p] || this.fase !== 'gioco') return false;
    this.tirato[p] = true;
    const tr = deriva(this.aria), arriva = t + volo(this.b.d);
    let x = mx + tr.x, y = my + tr.y;
    // il trucco segreto (!win): la freccia va al centro, a pochi pixel, e nessuna asse la ferma
    const win = T.consuma(this, p);
    if (win) { const c = posBersaglio(this.b, arriva), a = Math.random() * 6.3, r = Math.random() * this.b.R * 0.1; x = c.x + Math.cos(a) * r; y = c.y + Math.sin(a) * r; }
    const f = { p, x: Math.round(x), y: Math.round(y), t, arriva, esito: 'mancato', punti: 0 };
    // prima gli assi: la freccia li incontra a metà strada
    if (!win) for (const a of this.assi) {
      const q = posAsse(a, t + (arriva - t) * 0.6);
      if (Math.abs(x - q.x) <= a.w / 2 && Math.abs(y - q.y) <= a.h / 2) { f.esito = 'asse'; f.asse = a.id; f.dx = Math.round(x - q.x); f.dy = Math.round(y - q.y); break; }
    }
    if (f.esito !== 'asse') {
      const c = posBersaglio(this.b, arriva), dist = Math.hypot(x - c.x, y - c.y);
      if (dist <= this.b.R) { const s = punteggio(dist, this.b.R, DIST[this.b.d].per); f.esito = s.centro ? 'centro' : 'bersaglio'; f.punti = s.punti; f.dx = Math.round(x - c.x); f.dy = Math.round(y - c.y); }
    }
    this.frecce.push(f);
    return true;
  }
  azione(p, a) {
    if (!a || a.tipo !== 'tira') return { errore: 'Azione non valida' };
    if (this.fase !== 'gioco') return { errore: 'Aspetta il bersaglio' };
    if (this.tirato[p]) return { errore: 'Hai già tirato la tua freccia' };
    const ora = this.tempoRound;
    // il tempo del browser vale se è appena passato (così il bersaglio è dove lo si vedeva), ma non oltre 0,3 s
    const t = Math.max(ora - 0.3, Math.min(ora, Number(a.t) || ora));
    const mx = Math.max(-50, Math.min(W + 50, Number(a.mx) || 0)), my = Math.max(-50, Math.min(H + 50, Number(a.my) || 0));
    this.tiro(p, mx, my, t);
    return { ok: true };
  }
  passo() {
    const t = this.tempoRound;
    for (let p = 0; p < this.n; p++) if (!this.bot[p] && this.nuoviTocchi(p) && this.inp[p].mx !== null) this.tiro(p, this.inp[p].mx, this.inp[p].my, t);
    // le frecce arrivate: punti e annunci
    for (const f of this.frecce) {
      if (f.fatta || t < f.arriva) continue;
      f.fatta = true; this.cambiato = true;
      this.punti[f.p] += f.punti;
      if (f.esito === 'centro') this.annuncia(f.p, `fa centro! 🎯 +${f.punti}`, `centro perfetto! 🎯 +${f.punti}`, true);
      else if (f.esito === 'asse') this.annuncia(f.p, 'colpisce un\'asse 🪵', 'hai preso un\'asse! 🪵');
    }
    // quando hanno tirato tutti e le frecce sono arrivate, mezzo secondo per guardarle e il round finisce
    if (this.fineDopo === null && this.tirato.every(Boolean) && this.frecce.every((f) => f.fatta)) this.fineDopo = t + 0.5;
    return (this.fineDopo !== null && t >= this.fineDopo) || t >= TEMPO + 1.2;
  }
  fineRound() {}
  // il computer: mira al centro dove sarà il bersaglio all'arrivo, corregge vento e caduta (il difficile tutto, il facile per
  // niente) e aspetta che gli assi non siano in mezzo (il facile non ci guarda, il medio a volte)
  pensa(p, liv) {
    if (this.tirato[p]) return {};
    const t = this.tempoRound;
    const m = this.mente[p] || (this.mente[p] = { da: { facile: casuale(1.6, 3.6), medio: casuale(1.1, 2.6), difficile: casuale(0.9, 2.2) }[liv], guardaAssi: liv === 'difficile' || (liv === 'medio' && Math.random() < 0.55), err: null });
    if (t < m.da) return {};
    const b = this.b, arriva = t + volo(b.d), c = posBersaglio(b, arriva);
    if (!m.err) { const sd = { facile: 0.7, medio: 0.36, difficile: 0.14 }[liv] * b.R; const a = Math.random() * 6.3, r = Math.abs(sd * (Math.random() + Math.random() + Math.random() - 1.5)); m.err = { x: Math.cos(a) * r, y: Math.sin(a) * r }; }
    const corregge = { facile: 0.55, medio: 0.85, difficile: 1 }[liv];
    const tr = deriva(this.aria);
    const mx = c.x + m.err.x - tr.x * corregge, my = c.y + m.err.y - tr.y * corregge;
    const ultimo = t > TEMPO - 0.6;
    if (!ultimo) {
      if (m.guardaAssi) {
        const x = mx + tr.x, y = my + tr.y;
        if (this.assi.some((a) => { const q = posAsse(a, t + (arriva - t) * 0.6); return Math.abs(x - q.x) <= a.w / 2 + 12 && Math.abs(y - q.y) <= a.h / 2 + 12; })) return {};
      }
    }
    this.tiro(p, mx, my, t);
    return {};
  }
  vistaExtra() { return { b: this.b, assi: this.assi, aria: this.aria, dist: DIST[this.b.d].nome, per: DIST[this.b.d].per, tempo: TEMPO }; }
  statoTick() {
    return {
      ti: this.tirato.map((x) => (x ? 1 : 0)), resta: Math.max(0, Math.ceil(TEMPO - this.tempoRound)),
      fr: this.frecce.map((f) => ({ p: f.p, x: f.x, y: f.y, t: Math.round(f.t * 100) / 100, a: Math.round(f.arriva * 100) / 100, e: f.fatta ? f.esito : null, pt: f.fatta ? f.punti : null, dx: f.dx, dy: f.dy, as: f.asse })),
    };
  }
}

module.exports = {
  meta: {
    id: 'bersaglio',
    nome: 'Tiro al bersaglio',
    tipo: 'tabellone',
    tempoReale: true,
    pausaBoss: true,
    giocatori: [1, 2, 3, 4, 5, 6, 7, 8],
    descrizione: 'Una freccia a bersaglio: mira, aspetta il momento giusto e evita le assi che passano davanti. Più vicino al centro, più punti.',
    alias: ['arco', 'frecce', 'bersaglio', 'tiro', 'ninja dojo', 'kirby', 'mira'],
    opzioni: [{ id: 'round', nome: 'Bersagli', valori: [8, 5, 12], etichette: ['8 bersagli', '5 bersagli', '12 bersagli'], predefinito: 8 }],
    regole: [
      'A ogni round compare un bersaglio a una distanza diversa: vicino, medio o lontano. Tutti tirano insieme e ognuno ha una freccia sola per bersaglio (6 secondi per tirare).',
      'Si mira col mouse e si tira con un clic (o con spazio o Invio); sul telefono appoggia il dito sul campo, trascina per mirare (il mirino compare un po\' sopra il dito, così vedi dove punti) e stacca il dito per tirare.',
      'Il mirino sta fermo dove lo metti, ma la freccia non va dritta: cala un po\' (poco sul bersaglio vicino, tanto su quello lontano, quindi bisogna mirare più in alto) e dal secondo bersaglio c\'è il vento, che la sposta di lato. La bandierina in alto dice da che parte soffia e quanto (da 0 a 3 tacche); da lontano il vento conta di più. La freccia non arriva subito: sui bersagli che si muovono bisogna tirare un po\' avanti. Hai 6 secondi per tirare.',
      'Dal secondo bersaglio passano davanti delle assi di legno che si muovono avanti e indietro: se la freccia le incontra si pianta lì e non vale niente.',
      'Punti: centro 10, poi 8, 6, 4 e 2 sull\'anello esterno, fuori 0. Il bersaglio medio vale il doppio, quello lontano il triplo. Dopo 8 bersagli (o 5, o 12) vince chi ha più punti.',
      'Il gioco è in tempo reale: si ferma per tutti quando qualcuno apre le dispense.',
      'Il computer facile tira quando capita e non tiene conto né del vento né della caduta né delle assi; il medio corregge a metà e a volte aspetta che le assi passino; il difficile corregge tutto, aspetta il varco libero e mira dove sarà il bersaglio.',
    ],
  },
  crea: (o) => new Bersaglio(o),
  bot: () => ({}),
  _test: { Bersaglio, punteggio, posBersaglio, posAsse, deriva, volo, DIST },
};
