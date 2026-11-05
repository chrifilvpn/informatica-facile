// SFIDA DEL GIORNO: ogni giorno un Sudoku, un Wordle, un puzzle di Sblocca, un quiz di Bandiere, un Kakuro, un livello
// di Spingi le casse e un Mahjong uguali per tutti.
// La partita si crea con un generatore di numeri "a caso" che parte da un seme fisso (la data + il gioco), così a
// tutti esce lo stesso schema. Conta per la classifica del giorno solo il primo tentativo di ognuno; le classifiche
// stanno nell'archivio (archivio.js).
const archivio = require('./archivio');

// il giorno italiano (la sfida cambia a mezzanotte in Italia)
function oggi(ora = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ora));
}

// generatore pseudo-casuale con seme (mulberry32) e un hash semplice per trasformare un testo in seme
function hash(t) { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function generatore(seme) {
  let a = seme >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// esegue fn con Math.random sostituito dal generatore (il server è a un solo filo: nessun'altra partita lo vede)
function conCaso(rng, fn) {
  const vero = Math.random;
  Math.random = rng;
  try { return fn(); } finally { Math.random = vero; }
}
// crea la partita col seme e fa in modo che anche le mosse successive (nuove domande, nuovi puzzle) usino lo stesso
// generatore: chi gioca la sfida dello stesso giorno vede la stessa sequenza
function creaConSeme(mod, opzioniCrea, seme) {
  const rng = generatore(seme);
  const p = conCaso(rng, () => mod.crea(opzioniCrea));
  for (let o = Object.getPrototypeOf(p); o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const k of Object.getOwnPropertyNames(o)) {
      const d = Object.getOwnPropertyDescriptor(o, k);
      if (k === 'constructor' || k === 'vista' || typeof d.value !== 'function' || Object.prototype.hasOwnProperty.call(p, k)) continue;
      const f = p[k];
      p[k] = function avvolta(...a) { return conCaso(rng, () => f.apply(this, a)); };
    }
  }
  return p;
}

const secondi = (ms) => Math.max(0, Math.round(ms / 1000));
const tempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// per ogni gioco: le opzioni fisse della sfida e come si misura il risultato (valore più alto = meglio)
// i rompicapo (giochi2/rompicapo-sfida.js): conta il tempo finale, penalità degli aiuti comprese
const tempoRompicapo = (extra) => (p) => { const t = p.tavole[0]; if (t.fatto == null) return null; const s = secondi(t.fatto); const e = extra(t); return { valore: -s, testo: `${tempo(s)}${e ? ` · ${e}` : ''}` }; };
const SFIDE = {
  sudoku: {
    titolo: 'difficoltà media', opzioni: { difficolta: 'medio', errori: 'visibili' },
    misura(p) { if (!p.griglia || !p.griglia.every((x, k) => x === p.soluzione[k])) return null; const s = secondi(p.tempo); return { valore: -s, testo: `${tempo(s)}${p.errori ? ` · ${p.errori} errori` : ''}` }; },
  },
  wordle: {
    titolo: 'parola di 5 lettere', opzioni: { lunghezza: 5, controllo: 'libero' },
    misura(p) { const f = p.fatto[0]; if (!f || !f.vinto) return { valore: -1e9, testo: 'non indovinata' }; const s = secondi(f.ms); return { valore: -(f.tentativi * 100000 + Math.min(s, 99999)), testo: `${f.tentativi}/6 · ${tempo(s)}` }; },
  },
  sblocca: {
    titolo: '3 puzzle medi', opzioni: { livello: 'medio', round: 3 },
    misura(p) { const ms = p.storico.reduce((t, r) => t + (r[0] ? r[0].ms : 180000), 0); const s = secondi(ms); return { valore: p.punti[0] * 100000 - Math.min(s, 99999), testo: `${p.punti[0]} ⭐ · ${tempo(s)}` }; },
  },
  bandiere: {
    titolo: '10 bandiere', opzioni: { bandiere: 'tutte', domande: 10, tempo: 10 },
    misura(p) { return { valore: p.punti[0], testo: `${p.punti[0]}/10` }; },
  },
  kakuro: {
    titolo: 'griglia 10×10, media', opzioni: { grandezza: 'media', difficolta: 'medio', errori: 'regole' },
    misura: tempoRompicapo((t) => (t.aiuti ? `${t.aiuti} aiuti` : '')),
  },
  sokoban: {
    titolo: 'un livello difficile', opzioni: { livelli: 'difficile', livello: 'caso' },
    misura: tempoRompicapo((t) => `${t.spinte} spinte${t.aiuti ? ` · ${t.aiuti} aiuti` : ''}`),
  },
  mahjong: {
    titolo: 'la piramide', opzioni: { figura: 'piramide' },
    misura: tempoRompicapo((t) => [t.aiuti ? `${t.aiuti} aiuti` : '', t.mescolate ? `${t.mescolate} rimescolate` : ''].filter(Boolean).join(' · ')),
  },
};

const chiaveClassifica = (data, gioco) => `sfida:${data}:${gioco}`;
const chiaveFatta = (data, gioco, id) => `sfidaFatta:${data}:${gioco}:${id}`;
// il primo tentativo si conta per browser e anche per dispositivo (indirizzo + caratteristiche del browser): così
// cancellare i dati del browser o aprire una finestra in incognito non regala un altro tentativo. Il dispositivo non si
// usa per gli indirizzi in IP_FIDATI (a scuola i computer uguali avrebbero la stessa impronta).
const giaFatta = (data, gioco, id, disp = null) => !!archivio.leggi(chiaveFatta(data, gioco, id)) || !!(disp && archivio.leggi(chiaveFatta(data, gioco, `d:${disp}`)));

// a fine partita: segna il risultato (solo il primo tentativo del giorno) e dice la posizione in classifica
function registra(s, partita) {
  const sf = s.sfida;
  if (!sf || sf.registrata) return null;
  sf.registrata = true;
  if (sf.prova || giaFatta(sf.data, s.gioco, sf.id, sf.disp)) return { prova: true };
  archivio.scrivi(chiaveFatta(sf.data, s.gioco, sf.id), 1);
  if (sf.disp) archivio.scrivi(chiaveFatta(sf.data, s.gioco, `d:${sf.disp}`), 1);
  const m = SFIDE[s.gioco].misura(partita);
  if (!m) return { prova: false, posizione: -1 };
  const pos = archivio.aggiungiInClassifica(chiaveClassifica(sf.data, s.gioco), { nome: sf.nome, valore: m.valore, testo: m.testo }, { quanti: 20, unoPerNome: false });
  return { prova: false, posizione: pos, testo: m.testo };
}

function classifiche(data = oggi()) {
  const giochi = {};
  for (const [id, x] of Object.entries(SFIDE)) giochi[id] = { titolo: x.titolo, lista: (archivio.leggi(chiaveClassifica(data, id), []) || []).map((v) => ({ nome: v.nome, testo: v.testo })) };
  return { data, giochi };
}

module.exports = { SFIDE, oggi, hash, generatore, creaConSeme, registra, classifiche, giaFatta };
