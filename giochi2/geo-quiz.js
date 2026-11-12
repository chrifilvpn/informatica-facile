// QUIZ DI GEOGRAFIA con il motore di "Indovina la bandiera" (giochi/bandiere.js): qui si preparano le "banche" di
// domande di Capitali, Sagome dei paesi e Monumenti. Nessun "meta": i giochi veri sono capitali.js, sagome.js e
// monumenti.js nella stessa cartella.
const { PAESI } = require('../giochi/bandiere-dati');
const { Bandiere, mescola, OPZIONI, bot } = require('../giochi/bandiere');
const { CAPITALI, NOTE, CONTINENTE } = require('./geo-dati');
const { SAGOME } = require('./sagome-dati');
const { MONUMENTI } = require('./monumenti-dati');

const CONTINENTI = ['Europa', 'Americhe', 'Africa', 'Asia', 'Oceania'];

// i mazzi: tutto, famosi, difficili e un continente alla volta
function mazzi(elementi) {
  const ids = elementi.map((_, i) => i);
  const m = { tutte: ids, famose: ids.filter((i) => elementi[i].fama === 1), difficili: ids.filter((i) => elementi[i].fama >= 2) };
  for (const c of CONTINENTI) m[c] = ids.filter((i) => elementi[i].continente === c);
  return m;
}
const opzioneMazzo = (elementi, nome) => {
  const M = mazzi(elementi);
  const valori = ['tutte', 'famose', 'difficili', ...CONTINENTI.filter((c) => M[c].length >= 6)];
  const etichette = valori.map((v) => `${{ tutte: 'Tutto il mondo', famose: 'Solo i più famosi', difficili: 'Solo i difficili' }[v] || v} (${M[v].length})`);
  return { id: 'mazzo', nome, valori, etichette, predefinito: 'tutte' };
};

// 4 risposte: quella giusta + 3 sbagliate (con nomi diversi), scelte tra le più "simili" secondo simile(a, b)
function scelteCon(elementi, simile) {
  return (giusta, mazzo) => {
    const visti = new Set([elementi[giusta].nome]);
    // si pesca anche fuori dal mazzo se il mazzo è piccolo (es. un continente con pochi monumenti)
    const candidati = [...new Set([...mazzo, ...elementi.map((_, i) => i)])].filter((i) => i !== giusta)
      .map((i) => ({ i, s: simile(elementi[giusta], elementi[i]) + Math.random() * 0.6 }))
      .sort((a, b) => b.s - a.s);
    const scelte = [giusta];
    for (const c of candidati) {
      if (scelte.length >= OPZIONI) break;
      if (visti.has(elementi[c.i].nome)) continue;
      visti.add(elementi[c.i].nome); scelte.push(c.i);
    }
    return mescola(scelte);
  };
}
const stessoContinente = (a, b) => (a.continente === b.continente ? 1 : 0);

// ---- capitali: la bandiera e il nome del paese, si sceglie la capitale ----
const elCapitali = PAESI.map((p) => ({
  nome: CAPITALI[p.nome], paese: p.nome, fama: p.fama, continente: CONTINENTE[p.nome], svg: p.svg, W: p.W,
  domanda: `${p.nome}: qual è la capitale?`, indizio: NOTE[p.nome] || null,
}));
const CAPITALI_BANCA = {
  id: 'capitali', elementi: elCapitali, mazzi: mazzi(elCapitali), chiaveMazzo: 'mazzo', cosa: 'Capitale',
  domanda: 'Qual è la capitale?', scelte: scelteCon(elCapitali, (a, b) => stessoContinente(a, b) + (a.fama === b.fama ? 0.3 : 0)),
};

// ---- sagome: il contorno del paese, si sceglie il nome ----
const famaDi = Object.fromEntries(PAESI.map((p) => [p.nome, p.fama]));
const elSagome = SAGOME.map(([nome, W, H, d]) => ({
  nome, fama: famaDi[nome] || 2, continente: CONTINENTE[nome], W, H, sagoma: true, svg: `<path d="${d}"/>`, rapporto: W / H,
}));
const SAGOME_BANCA = {
  id: 'sagome', elementi: elSagome, mazzi: mazzi(elSagome), chiaveMazzo: 'mazzo', cosa: 'Sagoma',
  domanda: 'Di che paese è questa sagoma?',
  // risposte sbagliate: stesso continente e forma simile (più larga o più alta)
  scelte: scelteCon(elSagome, (a, b) => stessoContinente(a, b) + 0.6 * (1 - Math.min(1, Math.abs(Math.log(a.rapporto / b.rapporto))))),
};

// ---- monumenti: il nome del monumento, si sceglie dove si trova ----
const { DISEGNI_MONUMENTI } = require('./monumenti-disegni');
const dove = (m) => (m.citta === m.paese ? m.citta : `${m.citta} (${m.paese})`);
const elMonumenti = MONUMENTI.map((m) => ({
  nome: dove(m), paese: m.paese, fama: m.fama, continente: CONTINENTE[m.paese], icona: m.icona, disegno: DISEGNI_MONUMENTI[m.nome] || null,
  domanda: `Dove si trova: ${m.nome}?`, indizio: `${m.icona} ${m.nome}: ${m.indizio}`,
}));
const MONUMENTI_BANCA = {
  id: 'monumenti', elementi: elMonumenti, mazzi: mazzi(elMonumenti), chiaveMazzo: 'mazzo', cosa: 'Monumento',
  domanda: 'Dove si trova?',
  // sbagliate: altri posti dello stesso continente, meglio se di un altro paese (o dello stesso, per confondere)
  scelte: scelteCon(elMonumenti, (a, b) => stessoContinente(a, b) + (a.paese === b.paese ? 0.4 : 0)),
};

// opzioni e regole comuni (come Indovina la bandiera)
const opzioniComuni = (elementi, nomeMazzo) => [
  opzioneMazzo(elementi, nomeMazzo),
  { id: 'domande', nome: 'Domande', valori: [10, 20, 30], etichette: ['10 domande', '20 domande', '30 domande'], predefinito: 10 },
  { id: 'tempo', nome: 'Tempo', valori: [10, 15, 6], etichette: ['10 secondi', '15 secondi', '6 secondi (veloce)'], predefinito: 10 },
];
const regoleComuni = [
  'Si può rispondere una volta sola. Quando hanno risposto tutti, o quando finisce il tempo, si vede la risposta giusta (in verde) e quella sbagliata (in rosso), poi arriva la domanda dopo.',
  'Da soli: 1 punto per ogni risposta giusta; si tiene anche la serie di risposte giuste di fila.',
  'Sfida (da 2 a 8): tutti vedono la stessa domanda nello stesso momento. Una risposta giusta vale 10 punti più un bonus fino a 10 per la velocità. Vince chi ha più punti alla fine.',
  'Prima di iniziare si sceglie quante domande (10, 20 o 30), il tempo per ognuna e se tutto il mondo, solo i più famosi, solo i difficili o un continente.',
  'A fine partita compare il ripasso: le domande sbagliate, con la risposta giusta e quella che avevi scelto.',
  'Il computer facile conosce solo le risposte più famose ed è lento; il medio ne sa di più; il difficile le sa quasi tutte e risponde in fretta.',
];
function gioco(banca, meta) {
  return { meta: { tipo: 'tabellone', giocatori: [1, 2, 3, 4, 5, 6, 7, 8], ...meta }, crea: (o) => new Bandiere(o, banca), bot };
}

module.exports = { CAPITALI_BANCA, SAGOME_BANCA, MONUMENTI_BANCA, opzioniComuni, regoleComuni, gioco, CONTINENTI };
