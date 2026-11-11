// Base comune dei giochi da casinò con le fiche (blackjack, baccarat, higher or lower).
// - Le fiche arrivano dal tavolo (ogni giocatore ne ha 1000 all'inizio) e tornano al tavolo dopo ogni mano.
// - Chi ha 0 fiche non può puntare finché non scrive !ricarica in chat.
// - Fase delle puntate: tutti puntano insieme. Dopo la prima puntata gli altri hanno SECONDI_PUNTATE secondi,
//   poi chi non ha puntato salta la mano.
const { SEMI, mescola } = require('./carte');

const SECONDI_PUNTATE = 20;

function scarpa(mazzi) {
  const m = [];
  for (let d = 0; d < mazzi; d++) for (const s of SEMI) for (let r = 1; r <= 13; r++) m.push({ id: `${r}${s}-${d}`, rango: r, seme: s });
  return mescola(m);
}

class Casino {
  constructor({ n, fiche }) {
    this.n = n;
    this.fiche = Array.from({ length: n }, (_, i) => (fiche && Number.isFinite(fiche[i]) ? fiche[i] : 1000));
    this.turno = null;
    this.inAttesa = false;
    this.finita = false;
    this.risultato = null;
    this.evento = null;
    this.nEv = 0;
    this.nMano = 0;
  }

  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }

  // ---- fiche (le usa il server) ----
  ficheDi(p) { return this.fiche[p]; }
  ricarica(p, quante) { this.fiche[p] += quante; }
  // fiche ancora in gioco nella mano in corso (puntate non ancora risolte): se ci sono, il giocatore non è davvero a secco.
  // Vale anche mentre gli altri stanno ancora puntando: chi ha già messo tutto sul tavolo non è rimasto senza fiche.
  ficheInGioco(p) { return this.fase && this.puntato && this.puntato[p] ? 1 : 0; }

  // ---- fase delle puntate ----
  apriPuntate() {
    this.fase = 'puntate';
    this.turno = null;
    this.nMano++;
    this.puntato = new Array(this.n).fill(false);
    this.passato = new Array(this.n).fill(false);
    this.chiusuraPuntate = null;
  }
  // chi deve ancora decidere: ha fiche e non ha né puntato né passato
  attesi() {
    if (this.fase !== 'puntate' || this.inAttesa) return [];
    return this.fiche.map((f, i) => (f > 0 && !this.puntato[i] && !this.passato[i] ? i : -1)).filter((i) => i >= 0);
  }
  segnaPuntata(p) {
    this.puntato[p] = true;
    if (!this.chiusuraPuntate) this.chiusuraPuntate = Date.now() + SECONDI_PUNTATE * 1000;
    this.forseChiudiPuntate();
  }
  passa(p) {
    if (this.fase !== 'puntate' || this.puntato[p]) return { errore: 'Non puoi passare adesso' };
    this.passato[p] = true;
    this.forseChiudiPuntate();
    return { ok: true };
  }
  forseChiudiPuntate() {
    if (this.fase !== 'puntate') return;
    if (this.attesi().length) return;
    if (!this.puntato.some(Boolean)) { // nessuno ha puntato: si riapre il giro
      if (this.passato.some(Boolean)) { this.apriPuntate(); this.annuncia(null, 'Nessuna puntata: nuova mano', ''); }
      return;
    }
    this.chiusuraPuntate = null;
    this.gioca(); // lo implementa ogni gioco
  }
  // il server lo chiama allo scadere del tempo (vedi scadenza)
  scadenza() {
    if (this.fase === 'puntate' && this.chiusuraPuntate) return this.chiusuraPuntate;
    return this.scadenzaTurno ? this.scadenzaTurno() : null;
  }
  controllaTempo() {
    if (this.fase === 'puntate' && this.chiusuraPuntate && Date.now() >= this.chiusuraPuntate) {
      for (const i of this.attesi()) this.passato[i] = true;
      this.forseChiudiPuntate();
      return true;
    }
    return this.tempoTurno ? this.tempoTurno() : false;
  }
  // assenti (dispense, disconnessi): nelle puntate saltano la mano
  salta(p) {
    if (this.fase === 'puntate') { if (!this.puntato[p] && !this.passato[p]) this.passa(p); return; }
    if (this.saltaTurno) this.saltaTurno(p);
  }
  controllaImporto(p, importo) {
    const x = Number(importo);
    if (!Number.isInteger(x) || x <= 0) return { errore: 'Puntata non valida' };
    if (x > this.fiche[p]) return { errore: `Hai solo ${this.fiche[p]} fiche` };
    return { importo: x };
  }
  tempoPuntateMs() { return this.chiusuraPuntate ? Math.max(0, this.chiusuraPuntate - Date.now()) : null; }
}

// puntata del computer in base al livello (in fiche intere)
function puntataBot(fiche, livello) {
  if (fiche <= 5) return fiche;
  const quota = livello === 'facile' ? 0.05 + Math.random() * 0.2 : livello === 'medio' ? 0.05 + Math.random() * 0.05 : 0.04;
  return Math.max(5, Math.min(fiche, Math.round((fiche * quota) / 5) * 5));
}

module.exports = { Casino, scarpa, puntataBot, SECONDI_PUNTATE };
