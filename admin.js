// AMMINISTRAZIONE: chi scrive in chat (del tavolo o globale) "!admin parola" diventa amministratore per quella
// connessione e vede la lista di chi è online, con la possibilità di esiliarlo dal sito.
// La parola è la stessa del trucco (!win, !lose) e NON è scritta da nessuna parte nel codice: si legge da TRUCCO_PAROLA
// (variabile d'ambiente su Render). Senza la variabile l'Ammiragliato non si apre. Maiuscole, accenti e spazi non contano.
const crypto = require('crypto');
const { semplice } = require('./giochi/trucco');
const impronta = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
// "!admin" seguito da qualcosa (giusto o sbagliato): questi messaggi non vanno mai in chat
const eTentativoAdmin = (testo) => /^!admin(\s|$)/.test(semplice(testo));
function eComandoAdmin(testo) {
  const p = semplice(process.env.TRUCCO_PAROLA);
  if (!p) return false;
  const t = semplice(testo);
  if (t.length > 200) return false;
  const m = /^!admin\s+(.+)$/.exec(t);
  if (!m) return false;
  // confronto a tempo costante sulle impronte (non si scopre la parola misurando i tempi di risposta)
  const a = Buffer.from(impronta(m[1]), 'hex'), b = Buffer.from(impronta(p), 'hex');
  return crypto.timingSafeEqual(a, b);
}
module.exports = { eComandoAdmin, eTentativoAdmin, impronta };
