const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { GIOCHI, pulisciOpzioni } = require('./giochi');
const TRUCCO = require('./giochi/trucco');
const PENSATORE = require('./giochi/pensatore'); // il computer che pensa in un thread a parte (giochi con meta.pensaLento)

const PORTA = process.env.PORT || 3000;
const ATTESA_BOT_MS = Number(process.env.ATTESA_BOT_MS) || 900; // pausa "di riflessione" del computer
const SOSTITUZIONE_MS = 25000; // dopo quanto il computer gioca per chi si è disconnesso
const ASSENTE_SFIDA_MS = Number(process.env.ASSENTE_SFIDA_MS) || 90000; // nelle sfide (saltaAssenti): dopo quanto chi è via si ritira
const VITA_STANZA_VUOTA_MS = 10 * 60 * 1000;
const LIVELLI = ['facile', 'medio', 'difficile'];
const FICHE_INIZIALI = 1000; // fiche di ogni giocatore a inizio tavolo (blackjack, poker, baccarat...)
const VOTO_FINE_MS = 30000; // quanto dura la votazione per terminare la partita
const ESECUZIONE_MS = 7000; // quanto dura l'esecuzione pubblica (67): il tavolo si ferma per tutti
const ESECUZIONE_ATTESA_MS = 12000; // tra un'esecuzione e l'altra, per non bloccare il tavolo di continuo
const { eSessantasette, eEnricoPapi } = require('./esecuzione');
const PAPI_MS = 6600; // quanto dura il video di Enrico Papi (chi scrive "enrico papi" in chat): il tavolo si ferma per tutti
const { censura } = require('./censura'); // viagano/viaganò in chat diventa ******** // "67", "sessantasette", "sessanta sette"
const NOMI_BOT = ['Ada', 'Alan', 'Grace', 'Linus', 'Tim', 'Margaret', 'Dennis', 'Barbara'];

const sicurezza = require('./sicurezza');
const sfida = require('./sfida'); // la sfida del giorno (stessa partita per tutti, classifica del giorno)
const { FantasIA, domandaDa, NOME: NOME_IA } = require('./fantasia'); // la mini IA della chat (Gemini)
const { eComandoAdmin } = require('./admin'); // comando segreto dell'amministratore (vedi admin.js) // difese: intestazioni, limiti, pulizia dei dati (vedi sicurezza.js)
// limiti per indirizzo larghi: a scuola tutta la classe esce su internet con lo stesso indirizzo
const MAX_TAVOLI = 1000, MAX_TAVOLI_PER_IP = Number(process.env.MAX_TAVOLI_PER_IP) || 60, MAX_CONNESSIONI_PER_IP = Number(process.env.MAX_CONNESSIONI_PER_IP) || 150;

const app = express();
const server = http.createServer(app);
// maxHttpBufferSize: nessun messaggio dal browser può superare 100 kB (di norma sono poche centinaia di byte)
// perMessageDeflate: i messaggi grandi (da 1 KB in su, es. i tick di Serpentoni) viaggiano compressi, circa un terzo:
// sulle reti lente (wifi della scuola, telefono) arrivano più regolari e il gioco scatta meno
const io = new Server(server, { maxHttpBufferSize: 1e5, pingTimeout: 20000, perMessageDeflate: { threshold: 1024 } });
// contro le connessioni lente e le troppe connessioni contemporanee
server.headersTimeout = 15000; server.requestTimeout = 30000; server.keepAliveTimeout = 5000;
server.maxConnections = Number(process.env.MAX_CONNESSIONI) || 3000;
// GUARDIA: ban automatico per indirizzo (vedi guardia.js). GUARDIA=attiva per bannare davvero; altrimenti scrive
// solo nel log chi avrebbe bannato. IP_FIDATI: indirizzi mai bannati (per esempio quello della scuola).
const { Guardia, MappaLimitata, origineValida } = require('./guardia');
const guardia = new Guardia({ attiva: process.env.GUARDIA === 'attiva', fidati: String(process.env.IP_FIDATI || '').split(',').map((x) => x.trim()).filter(Boolean) });
const ORIGINI = String(process.env.ORIGINI_CONSENTITE || '').split(',').map((x) => x.trim()).filter(Boolean);
sicurezza.difeseHttp(app, { guardia });
// all'avvio: come arrivano gli indirizzi (per controllare una volta su Render che siano diversi per ogni persona)
let indirizziMostrati = 0;
app.use((req, _res, next) => {
  if (indirizziMostrati < 5 && req.headers['x-forwarded-for']) { indirizziMostrati++; console.log(`[indirizzi] x-forwarded-for: "${req.headers['x-forwarded-for']}" · collegato da ${req.socket.remoteAddress} · indirizzo usato: ${sicurezza.ipDi(req)}`); }
  next();
});
if (!process.env.ADMIN_COMANDO) console.warn('[avviso] Il comando dell\'Ammiragliato è quello scritto in admin.js. Su Render imposta ADMIN_COMANDO con un comando lungo e casuale (almeno 20 caratteri): l\'impronta di un comando corto si ricava provando tutte le combinazioni.');
else if (process.env.ADMIN_COMANDO.trim().length < 20) console.warn('[avviso] ADMIN_COMANDO è corto: meglio almeno 20 caratteri casuali.');
// fantasIA: la chiave sta solo su Render (GEMINI_API_KEY), mai nel codice; GEMINI_MODELLO facoltativo
const fantasia = new FantasIA({ chiave: process.env.GEMINI_API_KEY, modello: process.env.GEMINI_MODELLO });
console.log(fantasia.attiva ? '[fantasIA] accesa (senza limite di domande)' : '[fantasIA] spenta: su Render manca GEMINI_API_KEY');
// trucco segreto: la parola sta solo su Render (TRUCCO_PAROLA), mai nel codice; senza, il trucco è spento
console.log(TRUCCO.attivo() ? '[trucco] acceso' : '[trucco] spento: su Render manca TRUCCO_PAROLA');
if (process.env.GUARDIA !== 'attiva') console.log('[guardia] modalità prova: i ban vengono solo scritti nel log (GUARDIA=attiva per applicarli)');
// fotocamera magica: programma e modelli di MediaPipe (~21 MB) compressi una volta sola (in memoria) e tenuti dal
// browser per una settimana: la prima volta si scaricano ~12 MB, dalla seconda la fotocamera si accende quasi subito
const MEDIAPIPE = path.join(__dirname, 'node_modules', '@mediapipe', 'tasks-vision');
const compressi = new Map();
function serviPesante(file, tipo) {
  return (q, r, next) => {
    fs.stat(file, (e, st) => {
      if (e) return next();
      const etag = `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
      r.set({ 'Cache-Control': 'public, max-age=604800', ETag: etag, Vary: 'Accept-Encoding' }).type(tipo);
      if (q.headers['if-none-match'] === etag) return r.status(304).end();
      if (!/\bgzip\b/.test(q.headers['accept-encoding'] || '')) return r.sendFile(file, { etag: false, lastModified: false, cacheControl: false });
      let z = compressi.get(file);
      if (!z || z.etag !== etag) {
        z = { etag, dati: new Promise((ok, ko) => fs.readFile(file, (e2, b) => (e2 ? ko(e2) : require('zlib').gzip(b, { level: 6 }, (e3, g) => (e3 ? ko(e3) : ok(g)))))) };
        compressi.set(file, z);
      }
      z.dati.then((g) => r.set({ 'Content-Encoding': 'gzip', 'Content-Length': g.length }).end(g)).catch(() => { compressi.delete(file); next(); });
    });
  };
}
app.get('/modelli/:file', (q, r, next) => (/^(mani|viso)\.task$/.test(q.params.file) ? serviPesante(path.join(__dirname, 'public', 'modelli', q.params.file), 'application/octet-stream')(q, r, next) : next()));
app.get('/js/mediapipe/vision_bundle.mjs', serviPesante(path.join(MEDIAPIPE, 'vision_bundle.mjs'), 'application/javascript'));
app.get('/js/mediapipe/wasm/:file', (q, r, next) => {
  const f = q.params.file;
  if (!/^vision_wasm_(nosimd_)?internal\.(js|wasm)$/.test(f)) return next();
  serviPesante(path.join(MEDIAPIPE, 'wasm', f), f.endsWith('.wasm') ? 'application/wasm' : 'application/javascript')(q, r, next);
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/js/scala-regole.js', (_q, r) => r.sendFile(path.join(__dirname, 'giochi', 'scala-regole.js')));
app.get('/js/navale-regole.js', (_q, r) => r.sendFile(path.join(__dirname, 'giochi', 'navale-regole.js')));
app.get('/js/putt-buche.js', (_q, r) => r.sendFile(path.join(__dirname, 'giochi', 'putt-buche.js')));
app.get('/js/strada-mondo.js', (_q, r) => r.sendFile(path.join(__dirname, 'giochi', 'strada-mondo.js')));
app.get('/js/tigerball-livelli.js', (_q, r) => r.sendFile(path.join(__dirname, 'giochi', 'tigerball-livelli.js')));
// Alien: Isolation 3D: la mappa (la stessa del server) e three.js (dalla dipendenza npm, niente CDN)
app.get('/js/isolation-mappa.js', (_q, r) => r.sendFile(path.join(__dirname, 'giochi3', 'isolation', 'mappa.js')));
app.get('/js/three.module.min.js', (_q, r) => r.type('application/javascript').sendFile(path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.min.js')));
// fotocamera magica: MediaPipe (mani e viso) dalla dipendenza npm, niente CDN; i modelli stanno in public/modelli
// (serviti compressi più sopra, prima dei file statici)
// giochi nuovi: tutti i file di public/js/giochi2 e giochi3 (e i loro stili) in un colpo solo, così aggiungere un
// gioco non richiede di toccare index.html
function unisciCartella(cartella, est) {
  const dir = path.join(__dirname, 'public', 'js', cartella);
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir).filter((f) => f.endsWith(est)).sort().map((f) => `/* ${f} */\n${fs.readFileSync(path.join(dir, f), 'utf8')}`).join(est === '.js' ? '\n;\n' : '\n');
}
const GIOCHI2_JS = ['giochi2', 'giochi3'].map((c) => unisciCartella(c, '.js')).join('\n;\n'), GIOCHI2_CSS = ['giochi2', 'giochi3'].map((c) => unisciCartella(c, '.css')).join('\n');
app.get('/js/giochi2.js', (_q, r) => r.type('application/javascript').send(GIOCHI2_JS));
app.get('/giochi2.css', (_q, r) => r.type('text/css').send(GIOCHI2_CSS));
app.get('/salute', (_q, r) => r.send('ok'));
// la voce narrante del master di Draghi e Segrete (voci neurali di Edge, vedi voce.js)
const voce = new (require('./voce').Voce)();
app.get('/voce', voce.rotta(sicurezza.ipDi));
// la pagina finta delle dispense ha un suo indirizzo: se si ricarica, il sito riparte da lì
app.get('/dispense', (_q, r) => r.sendFile(path.join(__dirname, 'public', 'index.html')));

const stanze = new Map();
const LETTERE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const nuovoCodice = () => {
  let c;
  do c = Array.from({ length: 4 }, () => LETTERE[Math.floor(Math.random() * LETTERE.length)]).join('');
  while (stanze.has(c));
  return c;
};
const { pulisciId } = sicurezza;
const pulisciNome = (n) => censura(sicurezza.pulisciNome(n)); // anche i nomi passano dalla censura
// un gioco esiste solo se è davvero nell'elenco (niente "constructor", "__proto__" e simili)
const giocoDa = (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(GIOCHI, id) ? GIOCHI[id] : null);
const elencoGiochi = () => Object.values(GIOCHI).map((g) => ({ ...g.meta, comandi: AIUTO_COMANDI }));

function nomeBot(s) {
  const usati = new Set(s.posti.filter(Boolean).map((g) => g.nome));
  return NOMI_BOT.find((n) => !usati.has(n)) || `Computer ${s.posti.filter((g) => g && g.bot).length + 1}`;
}
const creaBot = (s, livello) => ({ id: `bot-${Math.random().toString(36).slice(2)}`, nome: nomeBot(s), bot: livello, connesso: true, fiche: FICHE_INIZIALI });
// giochi senza computer (meta.soloPersone): chi manca salta il turno invece di essere sostituito
const senzaBot = (s) => !!GIOCHI[s.gioco].meta.soloPersone;
const umani = (s) => s.posti.filter((g) => g && !g.locale && (!g.bot || g.inSala));

// PASSA IL TELEFONO (giochi con meta.passaTelefono, opzione telefono = 'si'): chi apre il tavolo gioca con gli amici
// sullo stesso dispositivo. I posti vuoti diventano "posti locali" (locale = id di chi ha aperto il tavolo): il suo
// browser riceve anche le viste di quei posti e manda le mosse con { per: posto }. Sono presenti quando lo è lui.
const telefonoAttivo = (s) => !!(GIOCHI[s.gioco] && GIOCHI[s.gioco].meta.passaTelefono && s.opzioni && s.opzioni.telefono === 'si');
function sincronizzaLocali(s) {
  for (const x of s.posti) {
    if (!x || !x.locale) continue;
    const h = s.posti.find((y) => y && !y.locale && y.id === x.locale);
    x.connesso = !!(h && h.connesso); x.nascosto = !!(h && h.nascosto); x.nascostoDal = h ? h.nascostoDal : 0; x.uscito = !h || !!h.uscito;
  }
}
// tornati in sala (o cambiato gioco) i posti locali si liberano: alla prossima partita si riscrivono i nomi
function togliLocali(s) { s.posti.forEach((x, i) => { if (x && x.locale) s.posti[i] = null; }); }
// Giochi di collaborazione (meta.pausaBoss): se qualcuno è sulla pagina delle dispense, la partita si ferma per tutti
// (non chi si è scollegato o è uscito dal tavolo mentre era sulle dispense: altrimenti si restava fermi per sempre).
// Una partita può decidere da sé (es. Block Blast: in pausa da soli e in collaborazione, non nella sfida).
const pausaBossDi = (s) => (s.partita && s.partita.pausaBoss !== undefined ? s.partita.pausaBoss : GIOCHI[s.gioco].meta.pausaBoss);
const inEsecuzione = (s) => !!(s.esecuzioneFino && Date.now() < s.esecuzioneFino);
// Chi resta sulle dispense più di PAUSA_MAX_MS non ferma più gli altri giocatori presenti (se ci sono).
const PAUSA_MAX_MS = 45000;
const presente = (g) => g.connesso && !g.uscito;
function fermaTutti(s) {
  const nascosti = umani(s).filter((g) => g.nascosto && presente(g));
  if (!nascosti.length) return false;
  if (!umani(s).some((g) => !g.nascosto && presente(g))) return true; // tutti sulle dispense
  return nascosti.some((g) => Date.now() - (g.nascostoDal || 0) < PAUSA_MAX_MS);
}
// la partita in corso legge la chat del tavolo (leggiChat): lì la chat globale è chiusa per giocatori e spettatori
const chatControllata = (s) => !!(s.partita && !s.partita.finita && s.partita.leggiChat);
const inPausa = (s) => !!(s.partita && !s.partita.finita && (inEsecuzione(s) || (pausaBossDi(s) && fermaTutti(s))));

function messaggioSistema(s, testo) {
  s.chat.push({ id: ++s.nChat, posto: -1, testo, ora: Date.now(), sistema: true });
  if (s.chat.length > 80) s.chat.shift();
}

function invia(s) {
  if (!s.partita && s.posti.some((x) => x && x.locale)) togliLocali(s);
  sincronizzaLocali(s);
  if (s.votoFine && s.votoFine.partita !== s.partita) { clearTimeout(s.timerVoto); s.votoFine = null; }
  inviaSussurri(s);
  s.posti.forEach((g, posto) => {
    if (!g || (g.bot && !g.inSala) || !g.socketId) return; // chi è tornato al tavolo riceve ancora lo stato
    io.to(g.socketId).emit('stato', {
      codice: s.codice,
      gioco: s.gioco,
      opzioni: s.opzioni,
      numPosti: s.posti.length,
      mioPosto: posto,
      sonoHost: s.host === g.id,
      giocatori: s.posti.map((x, i) => (x ? { nome: x.nome, connesso: x.connesso, bot: x.bot || null, autoplay: !!x.autoplay, nascosto: !!x.nascosto, uscito: !!x.uscito, inSala: !!x.inSala, fiche: x.fiche, vittorie: s.vittorie[i], master: !!(s.master && s.master === x.id && !x.bot) } : null)),
      scambi: !s.partita && s.scambi ? s.scambi.filter((x) => s.posti[x.da] && s.posti[x.da].id === x.idDa && s.posti[x.a] && s.posti[x.a].id === x.idA).map((x) => ({ da: x.da, a: x.a })) : [],
      inPausa: inPausa(s),
      ricaricaConsigliata: !!(s.partita && s.partita.ficheDi && !g.bot && s.partita.ficheDi(posto) <= 0 && !(s.partita.ficheInGioco && s.partita.ficheInGioco(posto) > 0)),
      votoFine: s.votoFine ? { tipo: s.votoFine.tipo, da: s.votoFine.da, si: s.votoFine.si, no: s.votoFine.no, servono: s.votoFine.servono, votanti: s.votoFine.votanti, resta: Math.max(0, s.votoFine.scade - Date.now()) } : null,
      esecuzione: inEsecuzione(s) ? s.esecuzioneFino - Date.now() : 0, esecuzioneTipo: inEsecuzione(s) ? s.esecuzioneTipo || 'vulcano' : null,
      sfida: s.sfida && s.sfida.gioco === s.gioco ? { data: s.sfida.data, prova: !!s.sfida.prova } : null,
      torneo: tornei.vistaTorneo(s), serata: tornei.vistaSerata(s),
      partita: s.partita ? vistaLeggera(s, g.socketId, s.partita.vista(posto)) : null,
      // passa il telefono: le viste dei posti locali di questo browser e chi di loro deve agire
      locali: s.partita && !g.locale ? vistePerLocali(s, g.id) : null,
      chat: s.chat.filter((m) => !m.spett && (!m.per || m.per.includes(posto))).slice(-40), // m.per: messaggio visibile solo ad alcuni (es. i fantasmi di Chi è l'Alieno)
    });
  });
  inviaSpettatori(s);
}

function vistePerLocali(s, id) {
  const miei = s.posti.map((x, i) => (x && x.locale === id ? i : -1)).filter((i) => i >= 0);
  if (!miei.length) return null;
  const g = s.partita;
  const viste = {};
  for (const i of miei) viste[i] = g.vista(i);
  let attesi = [];
  try { attesi = !g.finita && g.turno == null && g.attesi && !g.inAttesa ? g.attesi() : []; } catch (e) { attesi = []; }
  return { posti: miei, viste, attesi };
}

// VISTE LEGGERE: un gioco con alleggerisci(vista, memo) può togliere dalla vista quello che quel browser ha già
// (es. Disegna e indovina manda solo i tratti nuovi, non tutto il disegno a ogni messaggio di chat). memo è un oggetto
// per ogni collegamento (socket) e per ogni partita: un browser nuovo o ricaricato riceve sempre tutto.
function vistaLeggera(s, sid, v) {
  const g = s.partita;
  if (!g || !g.alleggerisci || !v) return v;
  if (!s.memoViste || s.memoViste.partita !== g) s.memoViste = { partita: g, perSocket: new Map() };
  const m = s.memoViste.perSocket;
  if (!m.has(sid)) m.set(sid, {});
  try { g.alleggerisci(v, m.get(sid)); } catch (e) { /* in caso di problemi si manda la vista intera */ }
  return v;
}

// SPETTATORI: chi entra in un tavolo pieno (o a partita iniziata) guarda la partita "dagli occhi" di un giocatore che
// sceglie lui (vede quello che vede quel giocatore). Non può fare mosse; la sua chat durante la partita la leggono
// solo gli altri spettatori (così non suggerisce). Se si libera un posto può sedersi.
const MAX_SPETTATORI = 30;
function seguibile(s, posto) { return Number.isInteger(posto) && posto >= 0 && posto < s.posti.length && !!s.posti[posto]; }
// CONTRO CHI SBIRCIA: durante la partita chi guarda dallo stesso dispositivo (stesso indirizzo e stesso browser, anche in
// incognito o da un altro browser uguale) di una persona seduta al tavolo può seguire solo lei, non i suoi avversari.
// Restituisce i posti che lo spettatore può seguire, o null se può seguirli tutti.
function postiPerSpettatore(s, sp) {
  if (!s.partita || s.partita.finita || !sp.disp) return null;
  const miei = s.posti.map((x, i) => (x && !x.bot && !x.locale && x.socketId && presenze.get(x.socketId) && presenze.get(x.socketId).dispTavolo === sp.disp ? i : -1)).filter((i) => i >= 0);
  return miei.length ? miei : null;
}
function correggiSegue(s, sp) {
  const ok = postiPerSpettatore(s, sp);
  if (ok && !ok.includes(sp.segue)) sp.segue = ok[0];
  if (!seguibile(s, sp.segue)) sp.segue = s.posti.findIndex((x) => x && !x.bot) >= 0 ? s.posti.findIndex((x) => x && !x.bot) : s.posti.findIndex(Boolean);
  return ok;
}
function inviaSpettatori(s) {
  if (!s.spettatori || !s.spettatori.size) return;
  const liberi = postiLiberiPerSpettatori(s);
  for (const [sid, sp] of s.spettatori) {
    const soloPosti = correggiSegue(s, sp);
    const posto = Math.max(0, sp.segue);
    io.to(sid).emit('stato', {
      codice: s.codice, gioco: s.gioco, opzioni: s.opzioni, numPosti: s.posti.length,
      mioPosto: posto, spettatore: true, segue: posto, soloPosti, mioNome: sp.nome, postiLiberi: liberi,
      sonoHost: false,
      giocatori: s.posti.map((x, i) => (x ? { nome: x.nome, connesso: x.connesso, bot: x.bot || null, autoplay: !!x.autoplay, nascosto: !!x.nascosto, uscito: !!x.uscito, inSala: !!x.inSala, fiche: x.fiche, vittorie: s.vittorie[i], master: !!(s.master && s.master === x.id && !x.bot) } : null)),
      spettatori: [...s.spettatori.values()].map((x) => x.nome),
      torneo: tornei.vistaTorneo(s), serata: tornei.vistaSerata(s),
      inPausa: inPausa(s), ricaricaConsigliata: false, votoFine: null,
      esecuzione: inEsecuzione(s) ? s.esecuzioneFino - Date.now() : 0, esecuzioneTipo: inEsecuzione(s) ? s.esecuzioneTipo || 'vulcano' : null,
      partita: s.partita ? vistaLeggera(s, sid, s.partita.vista(posto)) : null,
      chat: s.chat.filter((m) => !m.per || m.per.includes(posto)).slice(-40),
    });
  }
}
// i posti che uno spettatore può prendere: vuoti in sala, oppure (a partita iniziata) quelli di chi è uscito
function postiLiberiPerSpettatori(s) {
  return s.posti.map((g, i) => (s.partita && !s.partita.finita ? (g && !g.inSala && ((g.bot && g.sostituto) || g.uscito) ? i : -1) : (!g ? i : -1))).filter((i) => i >= 0);
}

function aggiorna(s) {
  if (!stanze.has(s.codice)) return;
  const g = s.partita;
  // giochi in tempo reale che si fermano quando qualcuno è sulle dispense (es. il cronometro del campo minato)
  if (g && g.impostaPausa) g.impostaPausa(inPausa(s));
  // giochi con le fiche: il saldo torna al tavolo dopo ogni mossa; i computer senza fiche si ricaricano da soli
  if (g && g.ficheDi) {
    s.posti.forEach((x, i) => {
      if (!x) return;
      x.fiche = g.ficheDi(i);
      if (x.bot && x.fiche <= 0) { x.fiche = FICHE_INIZIALI; g.ricarica(i, FICHE_INIZIALI); messaggioSistema(s, `💰 ${x.nome} (computer) si ricarica con ${FICHE_INIZIALI} fiche`); }
      // a una persona rimasta senza fiche si consiglia (una volta) il comando !ricarica
      const aSecco = x.fiche <= 0 && !(g.ficheInGioco && g.ficheInGioco(i) > 0);
      if (!x.bot && aSecco && !x.ricaricaDetta) { x.ricaricaDetta = true; messaggioSistema(s, `💡 ${x.nome}, hai finito le fiche: scrivi !ricarica in chat per averne altre ${FICHE_INIZIALI}`); }
      if (x.fiche > 0) x.ricaricaDetta = false;
    });
  }
  // messaggi di sistema scritti dal gioco (es. "Ada ha indovinato!" in Disegna e indovina)
  if (g && g.chatSistema && g.chatSistema.length) for (const t of g.chatSistema.splice(0)) messaggioSistema(s, censura(String(t).slice(0, 200).replace(/@(\d+)/g, (_m, k) => (s.posti[k] ? s.posti[k].nome : '?'))));
  // messaggi che il gioco scrive in chat a nome di un giocatore (es. gli indizi di Chi è l'impostore)
  if (g && g.chatDa && g.chatDa.length) {
    for (const m of g.chatDa.splice(0)) {
      const x = s.posti[m.posto];
      if (!x) continue;
      const testo = String(m.testo).replace(/@(\d+)/g, (_m, k) => (s.posti[k] ? s.posti[k].nome : '?'));
      s.chat.push({ id: ++s.nChat, posto: m.posto, nome: x.nome, testo: censura(testo.slice(0, 160)), ora: Date.now() });
      if (s.chat.length > 80) s.chat.shift();
    }
  }
  if (g && g.finita && !g.registrata) {
    g.registrata = true;
    for (const v of g.risultato.vincitori) s.vittorie[v]++;
    tornei.finePartita(s, g);
    if (s.sfida && s.sfida.gioco === s.gioco) {
      const r = sfida.registra(s, g);
      if (r && r.prova) messaggioSistema(s, '🗓️ Partita di prova: per la classifica di oggi conta solo il primo tentativo');
      else if (r && r.posizione >= 0) messaggioSistema(s, `🗓️ Sfida del giorno: ${r.testo} · sei ${r.posizione + 1}° in classifica!`);
      else if (r) messaggioSistema(s, '🗓️ Sfida del giorno: risultato fuori dalla classifica dei primi 20');
    }
  }
  invia(s);
  pianifica(s);
  gestisciTick(s);
}

// IL TRUCCO SEGRETO (!win + parola segreta): i suggerimenti e i messaggi segreti del gioco vanno solo a chi li ha chiesti
function inviaSussurri(s) {
  const g = s.partita;
  if (!g) return;
  TRUCCO.controllaSuggerimenti(g);
  for (const m of TRUCCO.prendiSussurri(g)) {
    const x = s.posti[m.posto];
    if (x && !x.bot && x.socketId) io.to(x.socketId).emit('segreto', { testo: m.testo, durata: m.durata });
  }
}
function attivaTrucco(s, posto) {
  const g = s.partita;
  if (!g || g.finita) return;
  TRUCCO.arma(g, posto);
  try { if (typeof g.trucco === 'function') g.trucco(posto); } catch (e) { console.warn(`[${s.gioco}] errore nel trucco: ${e.message}`); }
  aggiorna(s);
}

// ---- giochi in tempo reale: la partita espone tick(ora), tickMs e vistaTick(posto) ----
// Il ciclo gira finché la partita è in corso; si ferma per tutti quando qualcuno è sulle dispense (pausaBoss).
function gestisciTick(s) {
  const g = s.partita;
  if (s.cicloDi && (s.cicloDi !== g || !g || g.finita || !stanze.has(s.codice))) { clearInterval(s.ciclo); s.ciclo = null; s.cicloDi = null; }
  if (!g || !g.tick || g.finita || s.ciclo) return;
  s.cicloDi = g;
  s.erroriTick = 0;
  s.ciclo = setInterval(() => {
    if (s.partita !== g || g.finita || !stanze.has(s.codice)) { clearInterval(s.ciclo); s.ciclo = null; s.cicloDi = null; return; }
    if (inPausa(s)) return;
    // nessuna persona collegata: inutile far girare il gioco (e un tavolo abbandonato non consuma il server)
    if (!s.posti.some((x) => x && !x.locale && (!x.bot || x.inSala) && x.connesso)) return;
    let cambiato = false;
    try { cambiato = g.tick(Date.now()); s.erroriTick = 0; } catch (e) {
      console.warn(`[${s.gioco}] errore nel tick: ${e.message}`);
      // un errore che si ripete a ogni tick bloccherebbe la partita per sempre: dopo 40 di fila si torna in sala
      if (++s.erroriTick >= 40) {
        clearInterval(s.ciclo); s.ciclo = null; s.cicloDi = null; s.erroriTick = 0;
        s.partita = null; tornei.annulla(s); ripristinaInSala(s);
        s.posti.forEach((x, k) => { if (x && ((x.bot && x.sostituto) || x.uscito)) s.posti[k] = null; });
        messaggioSistema(s, '⚠️ La partita si è bloccata per un errore ed è stata chiusa: potete ricominciare');
        invia(s);
        return;
      }
    }
    s.posti.forEach((x, posto) => { if (x && !x.bot && x.socketId) io.to(x.socketId).volatile.emit('tick', g.vistaTick(posto)); });
    if (s.spettatori) for (const [sid, sp] of s.spettatori) if ((correggiSegue(s, sp), seguibile(s, sp.segue))) io.to(sid).volatile.emit('tick', g.vistaTick(sp.segue));
    if (cambiato || g.finita) aggiorna(s);
    else if (g._sussurri && g._sussurri.length) inviaSussurri(s);
  }, g.tickMs || 50);
}

function pianifica(s) {
  sincronizzaLocali(s);
  clearTimeout(s.timer);
  clearTimeout(s.timerTempo);
  const g = s.partita;
  // timer di chi deve agire nelle fasi "tutti insieme": restano validi finché quel posto è atteso nella stessa
  // partita (così le mosse degli altri non fanno ripartire l'attesa e i computer lenti agiscono comunque)
  s.timerSim = s.timerSim || new Map();
  const attesiOra = g && !g.finita && g.turno == null && g.attesi && !g.inAttesa && !inEsecuzione(s) && !inPausa(s) ? new Set(g.attesi()) : new Set();
  for (const [posto, x] of s.timerSim) if (x.partita !== g || !attesiOra.has(posto)) { clearTimeout(x.id); s.timerSim.delete(posto); }
  if (!g || g.finita) return;
  // esecuzione pubblica in corso: tutto fermo, si riprende da soli alla fine
  if (inEsecuzione(s)) { s.timer = setTimeout(() => aggiorna(s), s.esecuzioneFino - Date.now() + 30); return; }
  // Giochi con orologio: g.scadenza() dice quando finisce il tempo di chi deve muovere.
  const fine = g.scadenza && g.scadenza();
  if (fine) {
    const partitaT = g;
    s.timerTempo = setTimeout(() => {
      if (s.partita === partitaT && partitaT.controllaTempo()) aggiorna(s);
      else if (s.partita === partitaT) pianifica(s);
    }, Math.max(0, fine - Date.now()) + 30);
  }
  if (inPausa(s)) return; // riprende quando tutti tornano dalle dispense
  const partita = g;
  // Fasi in cui tutti agiscono insieme (es. schieramento della battaglia navale): g.attesi() dice chi manca.
  if (g.turno == null && g.attesi && !g.inAttesa) {
    for (const posto of g.attesi()) {
      if (s.timerSim.has(posto)) continue; // c'è già un'attesa in corso per lui
      const gio = s.posti[posto];
      let attesa = null;
      if (gio.bot) attesa = ATTESA_BOT_MS * (g.velocitaBot || 1) * (1 + Math.random() * 2);
      // nelle sfide dove ognuno gioca per conto suo (saltaAssenti) chi è sulle dispense o ha perso la linea viene
      // ritirato: lì si aspetta di più (con il prof in giro capita spesso di restare sulle dispense un minuto)
      else if (!gio.connesso || gio.autoplay || gio.nascosto) attesa = GIOCHI[s.gioco].meta.saltaAssenti && !senzaBot(s) ? ASSENTE_SFIDA_MS : SOSTITUZIONE_MS;
      if (attesa == null) continue;
      s.timerSim.set(posto, { partita, id: setTimeout(() => {
        s.timerSim.delete(posto);
        if (s.partita !== partita || partita.finita || !partita.attesi().includes(posto)) return;
        if (!gio.bot && gio.connesso && !gio.autoplay && !gio.nascosto) return;
        if (senzaBot(s) || (!gio.bot && GIOCHI[s.gioco].meta.saltaAssenti)) { if (partita.salta) { partita.salta(posto); aggiorna(s); } return; }
        if (!gio.bot) messaggioSistema(s, `${gio.nome} non risponde: il computer ha agito per lui`);
        mossaComputer(s, posto, gio.bot || 'medio');
      }, attesa) });
    }
    return;
  }
  if (g.inAttesa) {
    // il riepilogo di fine smazzata resta finché qualcuno non preme "Continua"
    if (g.fase === 'riepilogo') return;
    s.timer = setTimeout(() => { if (s.partita === partita && partita.inAttesa) { partita.avanza(); aggiorna(s); } }, g.pausaMs || 1200);
    return;
  }
  const t = g.turno;
  if (t == null) return;
  const gio = s.posti[t];
  let attesa = null;
  let livello = null;
  if (senzaBot(s) || (!gio.bot && GIOCHI[s.gioco].meta.saltaAssenti)) {
    if (gio.uscito) attesa = 300;
    else if (!gio.connesso || gio.nascosto) attesa = SOSTITUZIONE_MS;
    if (attesa == null || !g.salta) return;
    s.timer = setTimeout(() => {
      if (s.partita !== partita || partita.turno !== t || partita.inAttesa) return;
      if (gio.connesso && !gio.nascosto && !gio.uscito) return; // nel frattempo è tornato
      partita.salta(t);
      aggiorna(s);
    }, attesa);
    return;
  }
  // velocitaBot: una partita può far aspettare meno il computer (per i giochi dove un turno è fatto di tante piccole mosse)
  if (gio.bot) { attesa = ATTESA_BOT_MS * (g.velocitaBot || 1) * (0.7 + Math.random() * 0.7); livello = gio.bot; }
  else if (!gio.connesso || gio.autoplay) { attesa = gio.autoplay ? ATTESA_BOT_MS : SOSTITUZIONE_MS; livello = 'medio'; }
  else if (gio.nascosto) { attesa = SOSTITUZIONE_MS; livello = 'medio'; } // sulle dispense: la partita va avanti
  if (attesa == null) return;
  s.timer = setTimeout(() => {
    if (s.partita !== partita || partita.turno !== t || partita.inAttesa) return;
    if (!gio.bot && gio.connesso && !gio.autoplay && !gio.nascosto) return; // nel frattempo è tornato
    if (!gio.bot && !gio.connesso && !gio.autoplay) { gio.autoplay = true; messaggioSistema(s, `${gio.nome} non è connesso: il computer gioca al suo posto`); }
    else if (!gio.bot && gio.nascosto && !gio.autoplay) messaggioSistema(s, `${gio.nome} è via: il computer ha fatto una mossa per lui`);
    mossaComputer(s, t, livello);
  }, attesa);
}

function mossaComputer(s, posto, livello) {
  const g = s.partita;
  const mod = GIOCHI[s.gioco];
  // giochi dove il computer pensa a lungo: la ricerca va nel thread a parte, così gli altri tavoli non si fermano
  if (mod.meta.pensaLento && livello !== 'facile' && !process.env.TEST_VELOCE) {
    if (s.pensando && s.pensando.partita === g) return; // ci sta già pensando
    const versione = s.mosseFatte || 0;
    s.pensando = { partita: g, posto };
    const crea = { n: g.n, primo: 0, opzioni: s.opzioni, bot: s.posti.map((x) => (x && x.bot) || null) };
    PENSATORE.pensa(s.gioco, g, posto, livello, crea).then((mossa) => {
      if (s.pensando && s.pensando.partita === g) s.pensando = null;
      // nel frattempo la partita è cambiata (annulla, fine del tempo, rivincita): si ricomincia da capo
      if (s.partita !== g || g.finita || g.turno !== posto || (s.mosseFatte || 0) !== versione || !stanze.has(s.codice)) { if (s.partita === g && !g.finita) aggiorna(s); return; }
      gioca(mossa);
    }, () => {
      if (s.pensando && s.pensando.partita === g) s.pensando = null;
      if (s.partita !== g || g.finita || g.turno !== posto || (s.mosseFatte || 0) !== versione) return;
      gioca(null);
    });
    return;
  }
  gioca(null);
  function gioca(pronta) {
    let r;
    try { r = g.azione(posto, pronta || mod.bot(g, posto, livello)); } catch (e) { r = { errore: e.message }; }
    if (r && r.errore) {
      console.warn(`[${s.gioco}] mossa del computer rifiutata: ${r.errore}`);
      try { r = g.azione(posto, mod.bot(g, posto, 'facile')); } catch (e) { r = { errore: e.message }; }
      if (r && r.errore && g.sblocca) g.sblocca(posto);
    }
    s.mosseFatte = (s.mosseFatte || 0) + 1;
    aggiorna(s);
  }
}

// Spiegazione dei comandi: compare con !comandi e nelle regole di ogni gioco.
const AIUTO_COMANDI = {
  '!ricarica': `ti ridà ${FICHE_INIZIALI} fiche, ma solo quando le hai finite (0 fiche). Serve nei giochi con le fiche`,
  '!prof': 'apre la pagina delle dispense a tutti i giocatori del tavolo (dalla chat globale: a tutto il sito)',
  '!restart': 'propone di ricominciare la partita da capo (se qualcosa è andato storto): decide la maggioranza del tavolo',
  '!fantasia': 'seguito da una domanda (per esempio !fantasia chi ha inventato il computer?): risponde fantasIA, la mini IA del sito, senza limite di domande',
  '!revive': 'in Draghi e Segrete riporta in vita i personaggi morti, con tutti i punti ferita e le stesse cose che avevano',
  '!foto': 'accende (o spegne) la Fotocamera magica solo per te: ti vedi in una finestrella da spostare dove vuoi e i gatti reagiscono ai tuoi gesti (!foto prova mostra i numeri dei gesti)',
  '!comandi': 'mostra questo elenco',
  // il 67 non si elenca: è un easter egg che si scopre giocando
};

// ---- comandi di chat: iniziano con "!" e non compaiono come messaggi normali ----
// Per aggiungerne uno nuovo basta una riga qui (es. '!ricarica' per le fiche).
const COMANDI = {
  '!restart': (s, posto) => {
    if (!s.partita || s.partita.finita) { messaggioSistema(s, 'Non c\'è una partita in corso da ricominciare'); return; }
    votazione(s, posto, true, 'restart');
  },
  '!ricarica': (s, posto) => {
    const g = s.posti[posto];
    const attuali = s.partita && s.partita.ficheDi ? s.partita.ficheDi(posto) : g.fiche;
    if (attuali > 0) { messaggioSistema(s, `${g.nome}: puoi chiedere altre fiche solo quando le hai finite (ora ne hai ${attuali})`); return; }
    g.fiche = FICHE_INIZIALI;
    if (s.partita && s.partita.ricarica) s.partita.ricarica(posto, FICHE_INIZIALI);
    messaggioSistema(s, `💰 ${g.nome} riceve ${FICHE_INIZIALI} fiche`);
  },
  '!revive': (s, posto) => {
    const g = s.partita;
    if (!g || g.finita || typeof g.revive !== 'function') { messaggioSistema(s, '!revive funziona solo durante una partita di Draghi e Segrete'); return; }
    const n = g.revive();
    messaggioSistema(s, n ? `✨ ${s.posti[posto].nome} ha usato !revive: ${n === 1 ? 'un personaggio torna' : `${n} personaggi tornano`} in vita` : 'Non c\'è nessun personaggio morto da riportare in vita');
  },
  '!comandi': (s) => {
    messaggioSistema(s, `Comandi della chat: ${Object.entries(AIUTO_COMANDI).map(([c, d]) => `${c} ${d}`).join(' · ')}`);
  },
  '!prof': (s, posto) => {
    const g = s.posti[posto];
    messaggioSistema(s, `🚨 ${g.nome} ha dato l'allarme prof`);
    io.to(s.codice).emit('prof', { nome: g.nome });
  },
};

// BLOCCO DEI COMANDI (dall'Ammiragliato): l'admin può spegnere per un po' i comandi della chat (il 67, !comandi,
// !restart…) se qualcuno ne abusa. !prof e !ricarica funzionano sempre. Vale per tutto il sito.
const SEMPRE_ATTIVI = ['!prof', '!ricarica', '!revive']; // funzionano anche con i comandi spenti
let comandiBloccatiFino = 0; // ora (ms) fino a cui sono spenti; Infinity = fino al riavvio del server
const comandiBloccati = () => Date.now() < comandiBloccatiFino;
function avvisoBlocco() {
  if (comandiBloccatiFino === Infinity) return '🔇 I comandi della chat sono disattivati dall\'Ammiragliato (tranne !prof e !ricarica)';
  const m = Math.max(1, Math.ceil((comandiBloccatiFino - Date.now()) / 60000));
  return `🔇 I comandi della chat sono disattivati dall'Ammiragliato per altri ${m} ${m === 1 ? 'minuto' : 'minuti'} (tranne !prof e !ricarica)`;
}

// ESECUZIONE PUBBLICA: chi scrive 67 in chat viene gettato nel vulcano. Il tavolo si ferma per tutti durante l'animazione.
function esecuzione(s, posto) {
  const g = s.posti[posto];
  if (!g) return;
  const ora = Date.now();
  if (s.esecuzioneFino && ora < s.esecuzioneFino + ESECUZIONE_ATTESA_MS) {
    messaggioSistema(s, `🌋 Il vulcano sta ancora digerendo… ${g.nome}, riprova tra poco`);
    return invia(s);
  }
  s.esecuzioneFino = ora + ESECUZIONE_MS;
  messaggioSistema(s, `🌋 ESECUZIONE PUBBLICA: ${g.nome} ha detto la parola proibita ed è stato gettato nel vulcano`);
  s.esecuzioneTipo = 'vulcano';
  io.to(s.codice).emit('esecuzione', { posto, nome: g.nome, durata: ESECUZIONE_MS });
  aggiorna(s); // ferma timer, computer e giochi in tempo reale (impostaPausa)
}

// ENRICO PAPI: chi scrive "enrico papi" in chat fa partire il video per tutto il tavolo (come il 67, il gioco si ferma)
function videoPapi(s, posto) {
  const g = s.posti[posto];
  if (!g) return;
  const ora = Date.now();
  if (s.esecuzioneFino && ora < s.esecuzioneFino + ESECUZIONE_ATTESA_MS) {
    messaggioSistema(s, `🚗 Enrico Papi sta ancora comprando auto… ${g.nome}, riprova tra poco`);
    return invia(s);
  }
  s.esecuzioneFino = ora + PAPI_MS;
  s.esecuzioneTipo = 'papi';
  s.papiChiusi = new Set(); // chi ha già chiuso il video con la ✕: quando l'hanno chiuso tutti, il gioco riparte
  messaggioSistema(s, `🚗 ${g.nome} ha chiamato Enrico Papi`);
  io.to(s.codice).emit('papi', { nome: g.nome, durata: PAPI_MS });
  aggiorna(s);
}

// VOTAZIONI: "Termina" (pulsante in alto) o "!restart" (comando in chat). Votano le persone al tavolo (i computer
// no); con la maggioranza dei sì la partita finisce (si torna in sala) o ricomincia da capo, uguale a prima.
// La votazione scade dopo 30 secondi.
const TESTI_VOTO = {
  fine: { proposta: 'terminare la partita', fatto: 'partita terminata' },
  restart: { proposta: 'ricominciare la partita da capo', fatto: 'la partita ricomincia da capo' },
};
function votazione(s, i, si, tipo) {
  if (!s || i === -1 || !s.partita || s.partita.finita) return;
  const g = s.posti[i];
  if (s.votoFine && s.votoFine.tipo !== tipo) { messaggioSistema(s, `🗳️ C'è già una votazione in corso per ${TESTI_VOTO[s.votoFine.tipo].proposta}`); aggiorna(s); return; }
  if (!s.votoFine) {
    if (si === false) return;
    const votanti = s.posti.map((x, k) => (x && !x.bot && !x.uscito ? k : -1)).filter((k) => k >= 0);
    const v = { tipo, da: i, si: [], no: [], votanti, servono: Math.floor(votanti.length / 2) + 1, scade: Date.now() + VOTO_FINE_MS, partita: s.partita };
    s.votoFine = v;
    messaggioSistema(s, `🗳️ ${g.nome} propone di ${TESTI_VOTO[tipo].proposta} (servono ${v.servono} sì su ${votanti.length})`);
    clearTimeout(s.timerVoto);
    s.timerVoto = setTimeout(() => {
      if (s.votoFine !== v) return;
      s.votoFine = null;
      messaggioSistema(s, '🗳️ Votazione scaduta: si continua a giocare');
      aggiorna(s);
    }, VOTO_FINE_MS);
  }
  const v = s.votoFine;
  if (!v.votanti.includes(i)) return;
  v.si = v.si.filter((k) => k !== i); v.no = v.no.filter((k) => k !== i);
  (si === false ? v.no : v.si).push(i);
  if (v.si.length >= v.servono) {
    clearTimeout(s.timerVoto);
    s.votoFine = null;
    messaggioSistema(s, `🗳️ La maggioranza ha votato sì (${v.si.length} su ${v.votanti.length}): ${TESTI_VOTO[tipo].fatto}`);
    clearTimeout(s.timer);
    if (tipo === 'restart') {
      // stessa partita da capo: stesso gioco, stesse opzioni, stessi giocatori e stesso primo di mano
      s.primo = (s.primo - 1 + s.posti.length) % s.posti.length;
      iniziaPartita(s);
    } else {
      s.partita = null;
      tornei.annulla(s);
      ripristinaInSala(s);
      s.posti.forEach((x, k) => { if (x && ((x.bot && x.sostituto) || x.uscito)) s.posti[k] = null; });
    }
  } else if (v.no.length > v.votanti.length - v.servono) {
    clearTimeout(s.timerVoto);
    s.votoFine = null;
    messaggioSistema(s, `🗳️ La proposta di ${TESTI_VOTO[tipo].proposta} è stata respinta: si continua`);
  }
  aggiorna(s);
}

// chi era tornato al tavolo durante la partita riprende il suo posto (non è più "computer" né "uscito")
function ripristinaInSala(s) {
  s.posti.forEach((x, k) => {
    if (!x || !x.inSala) return;
    const { inSala, uscito, bot, ...resto } = x;
    s.posti[k] = { ...resto, nome: x.nomeVero || x.nome };
    delete s.posti[k].nomeVero;
  });
}

function iniziaPartita(s) {
  ripristinaInSala(s);
  const mod = GIOCHI[s.gioco];
  const dati = { n: s.posti.length, primo: s.primo, opzioni: s.opzioni, fiche: s.posti.map((g) => (g ? g.fiche : FICHE_INIZIALI)), bot: s.posti.map((g) => (g && g.bot) || null) };
  // il master umano scelto nella sala (Draghi e Segrete): il posto di quel giocatore, se c'è ancora
  if (mod.meta.masterUmano && s.master) { const k = s.posti.findIndex((g) => g && !g.bot && g.id === s.master); if (k >= 0) dati.master = k; }
  // sfida del giorno: la stessa partita per tutti (seme = data + gioco); una rivincita è solo per allenarsi
  if (s.sfida && s.sfida.gioco === s.gioco) {
    if (s.sfida.registrata) s.sfida = { ...s.sfida, prova: true, registrata: false };
    s.partita = sfida.creaConSeme(mod, dati, sfida.hash(`${s.sfida.data}:${s.gioco}`));
  } else s.partita = mod.crea(dati);
  s.partita.nomiGiocatori = s.posti.map((g) => (g ? g.nome : '')); // per i giochi che leggono i nomi in chat (Chi è l'Alieno)
  s.primo = (s.primo + 1) % s.posti.length;
  s.posti.forEach((g) => g && (g.autoplay = false));
}

function chiudiStanza(s) {
  clearTimeout(s.timer);
  stanze.delete(s.codice);
  if (s.spettatori) for (const sid of s.spettatori.keys()) io.to(sid).emit('tavoloChiuso');
}
function controllaVuota(s) {
  clearTimeout(s.timerChiusura);
  if (!umani(s).length) { chiudiStanza(s); return; }
  if (umani(s).some((g) => g.connesso)) return;
  s.timerChiusura = setTimeout(() => chiudiStanza(s), VITA_STANZA_VUOTA_MS);
}

// troppe connessioni dallo stesso indirizzo: si rifiutano le nuove
const connessioniPerIp = new Map();
// CHAT GLOBALE: una chat per tutto il sito, dalla home e da ogni tavolo. Tiene gli ultimi messaggi in memoria.
const chatGlobale = [];
let nChatGlobale = 0;
const MAX_CHAT_GLOBALE = 60;
let ultimoProfGlobale = 0, ultimaEsecuzioneGlobale = 0;
const PROF_GLOBALE_ATTESA_MS = 30000; // l'allarme prof per tutto il sito al massimo ogni 30 secondi
// _da e _a (l'identificativo di chi scrive e di chi ha chiesto a fantasIA) restano sul server: a ognuno arriva solo
// "mio" / "aMe", così "Tu" non dipende dal nome (due persone con lo stesso nome non si confondono)
const vistaGlobale = (m, id) => { const { _da, _a, ...resto } = m; return { ...resto, mio: !!(id && _da === id), aMe: !!(id && _a === id) }; };
function pubblicaGlobale(m) {
  const msg = { id: ++nChatGlobale, ora: Date.now(), ...m };
  chatGlobale.push(msg); if (chatGlobale.length > MAX_CHAT_GLOBALE) chatGlobale.shift();
  for (const [, y] of presenze) y.socket.emit('chatGlobale', vistaGlobale(msg, y.id));
}

// ESILIO: chi viene esiliato dall'amministratore non può tornare per un po' (per identificativo del browser e,
// se l'amministratore lo sceglie, anche per indirizzo: attenzione, a scuola vale per tutta la classe)
const esiliati = new Map(); // id del browser -> { fino, nome }
const ipEsiliati = new Map(); // indirizzo -> fino
// impronta del dispositivo (indirizzo + caratteristiche del browser e dello schermo): blocca anche le finestre in
// incognito e i browser "puliti" sullo stesso computer. Non vale per gli indirizzi in IP_FIDATI (es. la scuola), dove
// computer tutti uguali potrebbero avere la stessa impronta.
const dispEsiliati = new Map(); // impronta -> { fino, id }
const chiaveDispositivo = (ip, imp) => (imp && !guardia.fidato(ip) ? require('crypto').createHash('sha256').update(`${ip}|${imp}`).digest('hex').slice(0, 32) : null);
const esiliato = (id, ip, disp = null) => {
  const ora = Date.now();
  const e = id && esiliati.get(id);
  if (e && e.fino > ora) return e.fino;
  const f = ip && ipEsiliati.get(ip);
  if (f && f > ora) return f;
  const d = disp && dispEsiliati.get(disp);
  if (d && d.fino > ora) return d.fino;
  return 0;
};
// chi è online: ogni connessione, anche dalla home
const presenze = new Map(); // socket.id -> { socket, id, nome, ip, dal, stanza, esci }
let timerAdmin = null;
function aggiornaAdmin() {
  clearTimeout(timerAdmin);
  timerAdmin = setTimeout(() => {
    const admin = [...presenze.values()].filter((x) => x.socket.data.admin);
    if (!admin.length) return;
    const ora = Date.now();
    const lista = [...presenze.entries()].map(([sid, x]) => {
      const st = x.stanza && stanze.get(x.stanza);
      return { sid, nome: x.nome || '(senza nome)', dove: st ? `tavolo ${st.codice} · ${GIOCHI[st.gioco].meta.nome}${st.partita && !st.partita.finita ? ' (in partita)' : ''}` : 'nella home', minuti: Math.floor((ora - x.dal) / 60000), admin: !!x.socket.data.admin };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
    const banditi = [...esiliati.entries()].filter(([, e]) => e.fino > ora).map(([id, e]) => ({ id, nome: e.nome, minuti: Math.ceil((e.fino - ora) / 60000) }));
    for (const a of admin) a.socket.emit('adminLista', { lista: lista.map((x) => ({ ...x, io: x.sid === a.socket.id })), esiliati: banditi, bloccati: guardia.elenco(), comandiFino: comandiBloccatiFino === Infinity ? -1 : comandiBloccatiFino > ora ? comandiBloccatiFino : 0, ipBloccati: [...ipEsiliati.values()].filter((f) => f > ora).length });
  }, 300);
}
const DURATA_ESILIO_ANIMAZIONE = 11000;
function esilia(sid, minuti, ancheIp) {
  const x = presenze.get(sid);
  if (!x || x.inEsilio) return;
  const nome = x.nome || 'Qualcuno';
  const fino = Date.now() + minuti * 60000;
  if (x.id) esiliati.set(x.id, { fino, nome });
  if (x.disp) dispEsiliati.set(x.disp, { fino, id: x.id });
  if (ancheIp) ipEsiliati.set(x.ip, fino);
  x.inEsilio = true;
  // tutti quelli sul sito vedono la partenza della barca
  for (const [sid2, y] of presenze) y.socket.emit('esilio', { nome, sonoIo: sid2 === sid, durata: DURATA_ESILIO_ANIMAZIONE });
  pubblicaGlobale({ nome: '⚓', testo: `${nome} è stato esiliato in fondo al mare`, sistema: true });
  setTimeout(() => {
    if (!presenze.has(sid)) return;
    x.socket.emit('esiliato', { fino });
    try { if (x.esci) x.esci(); } catch (e) { console.warn('[esilio]', e.message); }
    x.socket.disconnect(true);
  }, DURATA_ESILIO_ANIMAZIONE);
  aggiornaAdmin();
}

io.use((socket, next) => {
  const ip = sicurezza.ipDi(socket.handshake);
  const sospeso = guardia.bannato(ip);
  if (sospeso) return next(new Error(`sospeso:${sospeso}`));
  if (!origineValida(socket.handshake.headers, ORIGINI)) { guardia.segnala(ip, 'origine'); return next(new Error('Origine non consentita')); }
  if (esiliato(null, ip)) return next(new Error('esiliato'));
  const n = connessioniPerIp.get(ip) || 0;
  if (n >= MAX_CONNESSIONI_PER_IP) { guardia.segnala(ip, 'connessioni'); return next(new Error('Troppe connessioni da questo indirizzo')); }
  connessioniPerIp.set(ip, n + 1);
  socket.once('disconnect', () => { const m = (connessioniPerIp.get(ip) || 1) - 1; if (m > 0) connessioniPerIp.set(ip, m); else connessioniPerIp.delete(ip); });
  socket.data.ip = ip;
  next();
});


// al ban si chiudono le connessioni di quell'indirizzo, con la schermata dell'esilio e il tempo residuo
guardia.quandoBan = (ip, ban) => {
  for (const x of presenze.values()) if (x.ip === ip) { x.socket.emit('esiliato', { fino: ban.fino, sospeso: true }); try { if (x.esci) x.esci(); } catch (e) { /* niente */ } x.socket.disconnect(true); }
  aggiornaAdmin();
};
const codiciSbagliati = new MappaLimitata(20000), comandiFinti = new MappaLimitata(20000);
// chat globale: oltre al limite per connessione, uno per indirizzo (largo: a scuola la classe ha lo stesso indirizzo)
const chatGlobalePerIp = new MappaLimitata(20000);
function chatGlobaleConsentita(ip) {
  let b = chatGlobalePerIp.get(ip);
  if (!b) b = new sicurezza.Secchiello(2, 12);
  chatGlobalePerIp.set(ip, b);
  return b.prendi();
}
// conta i tentativi di un indirizzo in una finestra di tempo; restituisce quanti ne ha fatti
function conta(mappa, ip, finestraMs) { const ora = Date.now(); let c = mappa.get(ip); if (!c || ora - c.dal > finestraMs) c = { n: 0, dal: ora }; c.n++; mappa.set(ip, c); return c.n; }

// torneo a eliminazione e serata a giochi misti (vedi tornei.js)
const tornei = require('./tornei')({ io, GIOCHI, stanze, iniziaPartita, messaggioSistema, aggiorna, FICHE_INIZIALI, pulisciOpzioni, NOMI_BOT });

io.on('connection', (socket) => {
  const ipSocket = socket.data.ip;
  const sospetto = (codice) => { if (guardia.segnala(ipSocket, codice, socket) === 'chiudi') socket.disconnect(true); };
  // un messaggio "!qualcosa" che non è un comando: tanti di fila possono essere tentativi di indovinare quello segreto
  const comandoFinto = (testo) => { if (String(testo || '').trim().startsWith('!') && conta(comandiFinti, ipSocket, 10 * 60000) > 10) sospetto('comandi'); };
  // ogni evento passa dalle difese: dati ripuliti, limiti al secondo, e un errore non fa mai cadere il server
  sicurezza.proteggiSocket(socket, {
    quandoLimitato: (ev) => socket.emit('errore', ev === 'chat' ? 'Piano con i messaggi! Aspetta un attimo' : 'Stai andando troppo veloce: rallenta un attimo'),
    quandoErrore: () => socket.emit('errore', 'Mossa non valida'),
    quandoSospetto: sospetto,
  });
  let stanza = null;
  const presenza = { socket, id: null, nome: null, ip: ipSocket, dal: Date.now(), stanza: null, esci: null };
  presenze.set(socket.id, presenza);
  aggiornaAdmin();
  socket.once('disconnect', () => { presenze.delete(socket.id); aggiornaAdmin(); });
  // il browser dice chi è (anche dalla home): serve alla lista dell'amministratore e all'esilio
  socket.on('presenza', ({ id, nome, imp } = {}) => {
    presenza.id = pulisciId(id) || null;
    presenza.nome = nome ? pulisciNome(nome) : presenza.nome;
    if (imp) presenza.disp = chiaveDispositivo(ipSocket, pulisciId(imp));
    if (imp) presenza.dispTavolo = require('crypto').createHash('sha256').update(`tavolo|${ipSocket}|${pulisciId(imp)}`).digest('hex').slice(0, 32);
    const f = esiliato(presenza.id, ipSocket, presenza.disp);
    if (f) { socket.emit('esiliato', { fino: f }); socket.disconnect(true); return; }
    socket.emit('chatGlobaleStorico', chatGlobale.map((m) => vistaGlobale(m, presenza.id))); // ora si sa quali sono i miei
    aggiornaAdmin();
  });
  // "Cambia nome" dalla sala: se la partita non è ancora iniziata (o è finita) il nuovo nome vale subito al tavolo
  socket.on('cambiaNome', (n) => {
    const nuovo = pulisciNome(n);
    if (!nuovo) return;
    presenza.nome = nuovo;
    const s = stanza;
    const i = mioPosto();
    if (!s || i === -1 || (s.partita && !s.partita.finita)) return;
    const g = s.posti[i];
    const prima = g.nome;
    g.nome = nomeLibero(s, nuovo, i);
    if (g.nome === prima) return;
    messaggioSistema(s, `✏️ ${prima} ora si chiama ${g.nome}`);
    invia(s);
  });
  // il comando segreto: chi lo scrive diventa amministratore per questa connessione (il messaggio non si vede)
  const provaAdmin = (testo) => {
    if (!eComandoAdmin(testo)) return false;
    socket.data.admin = true;
    socket.emit('adminAperto');
    aggiornaAdmin();
    return true;
  };
  socket.on('adminLista', () => { if (socket.data.admin) aggiornaAdmin(); });
  socket.on('adminEsilia', ({ sid, minuti, ip } = {}) => {
    if (!socket.data.admin || sid === socket.id) return;
    const m = [10, 60, 1440, 10080].includes(Number(minuti)) ? Number(minuti) : 60;
    esilia(String(sid || ''), m, ip === true);
  });
  // spegne (o riaccende) i comandi della chat per tutto il sito: minuti = 0 riaccende, -1 fino al riavvio
  socket.on('adminComandi', ({ minuti } = {}) => {
    if (!socket.data.admin) return;
    const m = Number(minuti);
    if (m === 0) comandiBloccatiFino = 0;
    else if (m === -1) comandiBloccatiFino = Infinity;
    else if (Number.isFinite(m) && m >= 1 && m <= 1440) comandiBloccatiFino = Date.now() + Math.round(m) * 60000;
    else return;
    pubblicaGlobale({ nome: '⚓', testo: comandiBloccatiFino ? avvisoBlocco() : '🔊 I comandi della chat sono di nuovo attivi', sistema: true });
    aggiornaAdmin();
  });
  socket.on('adminGraziaBan', ({ ip } = {}) => { if (!socket.data.admin) return; guardia.grazia(String(ip || '')); aggiornaAdmin(); });
  socket.on('adminGrazia', ({ id } = {}) => {
    if (!socket.data.admin) return;
    const e = esiliati.get(String(id || ''));
    if (e) { esiliati.delete(String(id)); ipEsiliati.clear(); for (const [k, d] of dispEsiliati) if (d.id === String(id)) dispEsiliati.delete(k); }
    aggiornaAdmin();
  });
  // fantasIA: controlla i limiti, mostra subito la domanda e poi la risposta (o un avviso solo per chi ha chiesto)
  const chiediFantasia = (domanda, mostraDomanda, mostraRisposta) => {
    const p = fantasia.prenota(ipSocket, censura(domanda), { fidato: guardia.fidato(ipSocket) });
    if (p.errore) { socket.emit('avvisoPrivato', p.errore); return; }
    mostraDomanda();
    fantasia.rispondi(censura(domanda)).then((r) => {
      if (r.testo) mostraRisposta(censura(r.testo));
      else if (socket.connected) socket.emit('avvisoPrivato', r.errore);
    }).catch(() => { /* rispondi non lancia mai */ });
  };
  socket.emit('chatGlobaleStorico', chatGlobale.map((m) => vistaGlobale(m, presenza.id)));
  socket.on('chatGlobale', ({ testo, nome } = {}) => {
    if (TRUCCO.eComando(testo)) return; // il trucco segreto non si vede mai, neanche nella chat globale
    if (provaAdmin(testo)) return;
    if (!chatGlobaleConsentita(ipSocket)) { socket.emit('avvisoPrivato', 'Troppi messaggi da questa rete: aspetta qualche secondo'); return; }
    // nei giochi che controllano la chat del tavolo (Disegna, Chi è l'Alieno, Nomi in codice…) la chat globale
    // permetterebbe di aggirare le regole (scrivere la parola, dire chi è l'Alieno): chi gioca o guarda lì aspetta
    if (stanza && chatControllata(stanza) && !/^!(prof|comandi)\b/i.test(String(testo || '').trim())) {
      socket.emit('avvisoPrivato', '🔒 Durante questa partita la chat globale è chiusa per chi è al tavolo: usa la chat del tavolo');
      return;
    }
    if (!COMANDI[String(testo || '').trim().toLowerCase().split(/\s+/)[0]] && domandaDa(testo) === null) comandoFinto(testo);
    const grezzo = String(testo || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const chi = pulisciNome(presenza.nome || nome); // il nome registrato per questa connessione, non uno qualsiasi
    // i comandi funzionano anche dalla chat globale (quindi anche dalla home), per tutto il sito
    const cmd = grezzo.toLowerCase();
    const spento = comandiBloccati() && !SEMPRE_ATTIVI.includes(cmd.split(' ')[0]);
    if (spento && cmd.startsWith('!')) { socket.emit('avvisoPrivato', avvisoBlocco()); return; }
    if (cmd === '!comandi') { socket.emit('avvisoPrivato', 'Nella chat globale: !prof manda tutto il sito sulle dispense; !fantasia seguito da una domanda fa rispondere fantasIA, la mini IA del sito (senza limite di domande); il resto dei comandi (!ricarica, !restart) si usa al tavolo'); return; }
    const domanda = domandaDa(grezzo);
    if (domanda !== null) {
      chiediFantasia(domanda,
        () => pubblicaGlobale({ nome: chi, testo: censura(grezzo), _da: presenza.id }),
        (risposta) => pubblicaGlobale({ nome: `🤖 ${NOME_IA}`, testo: risposta, ia: true, a: chi, _a: presenza.id }));
      return;
    }
    if (cmd === '!prof') {
      const ora = Date.now();
      if (ora - ultimoProfGlobale < PROF_GLOBALE_ATTESA_MS) { socket.emit('avvisoPrivato', `L'allarme prof è appena scattato: riprova tra ${Math.ceil((PROF_GLOBALE_ATTESA_MS - (ora - ultimoProfGlobale)) / 1000)} secondi`); return; }
      ultimoProfGlobale = ora;
      io.emit('prof', { nome: chi });
      pubblicaGlobale({ nome: '🚨', testo: `${chi} ha dato l'allarme prof a tutto il sito`, sistema: true });
      return;
    }
    if (eSessantasette(grezzo) && spento) socket.emit('avvisoPrivato', avvisoBlocco());
    else if (eSessantasette(grezzo)) {
      const ora = Date.now();
      if (ora - ultimaEsecuzioneGlobale < ESECUZIONE_ATTESA_MS) return;
      ultimaEsecuzioneGlobale = ora;
      for (const [sid, y] of presenze) y.socket.emit('esecuzione', { nome: chi, sonoIo: sid === socket.id, durata: ESECUZIONE_MS, globale: true });
      pubblicaGlobale({ nome: '🌋', testo: `${chi} ha pronunciato il numero proibito ed è stato gettato nel vulcano`, sistema: true });
      return;
    }
    // "enrico papi" nella chat globale: il video parte per tutto il sito
    if (eEnricoPapi(grezzo) && spento) socket.emit('avvisoPrivato', avvisoBlocco());
    else if (eEnricoPapi(grezzo)) {
      const ora = Date.now();
      if (ora - ultimaEsecuzioneGlobale < ESECUZIONE_ATTESA_MS) return;
      ultimaEsecuzioneGlobale = ora;
      for (const [, y] of presenze) y.socket.emit('papi', { nome: chi, durata: PAPI_MS, globale: true });
      pubblicaGlobale({ nome: '🚗', testo: `${chi} ha chiamato Enrico Papi`, sistema: true });
      return;
    }
    const t = censura(grezzo);
    if (!t) return;
    pubblicaGlobale({ nome: chi, testo: t, _da: presenza.id });
  });
  let mioId = null;
  socket.emit('giochi', elencoGiochi());
  const errore = (m) => socket.emit('errore', m);
  const mioPosto = () => (stanza ? stanza.posti.findIndex((g) => g && g.id === mioId) : -1);
  const sonoHost = () => stanza && stanza.host === mioId;

  // due persone con lo stesso nome allo stesso tavolo non si distinguerebbero (voti, accuse in chat): chi arriva
  // dopo diventa "Marco 2"
  function nomeLibero(s, nome, posto) {
    const usati = new Set(s.posti.map((g, k) => (g && k !== posto ? String(g.nomeVero || g.nome).toLowerCase() : null)).filter(Boolean));
    if (!usati.has(nome.toLowerCase())) return nome;
    for (let k = 2; ; k++) { const n = `${nome.slice(0, 15)} ${k}`; if (!usati.has(n.toLowerCase())) return n; }
  }
  function siediti(s, id, nome) {
    if (esiliato(id, ipSocket, presenza.disp)) { socket.emit('esiliato', { fino: esiliato(id, ipSocket, presenza.disp) }); socket.disconnect(true); return; }
    let i = s.posti.findIndex((g) => g && g.id === id);
    if (i === -1 && tornei.inCorso(s) && s.torneo) return guarda(s, id, nome);
    if (i === -1) {
      if (s.partita) {
        // a partita iniziata si può prendere solo il posto di chi è uscito (ora giocato dal computer)
        i = s.posti.findIndex((g) => g && !g.inSala && ((g.bot && g.sostituto) || g.uscito));
        if (i === -1) return guarda(s, id, nome); // nessun posto: si guarda la partita da spettatore
        messaggioSistema(s, `${nome} prende il posto di ${s.posti[i].nome}`);
      } else {
        i = s.posti.findIndex((g) => !g);
        if (i === -1) i = s.posti.map((g) => !!(g && g.bot && !g.inSala)).lastIndexOf(true);
        if (i === -1) return guarda(s, id, nome);
      }
      if (s.posti[i] && s.posti[i].uscito && s.partita && s.partita.rientra) s.partita.rientra(i);
      // nei giochi in tempo reale il computer che teneva il posto smette di giocare: ora comanda la persona
      if (s.partita && Array.isArray(s.partita.bot)) s.partita.bot[i] = null;
      nome = nomeLibero(s, nome, i);
      s.posti[i] = { id, nome, socketId: null, connesso: false, bot: null, fiche: FICHE_INIZIALI };
      if (!s.partita) messaggioSistema(s, `${nome} si è seduto al tavolo`);
    }
    if (s.spettatori) s.spettatori.delete(socket.id);
    const g = s.posti[i];
    if (g.socketId && g.socketId !== socket.id) io.to(g.socketId).emit('errore', 'Ti sei collegato da un\'altra finestra');
    g.socketId = socket.id;
    g.connesso = true;
    g.nascosto = false;
    g.autoplay = false;
    if (!s.partita) g.nome = nomeLibero(s, nome, i);
    if (stanza && stanza !== s) esci();
    stanza = s;
    mioId = id;
    presenza.stanza = s.codice; presenza.id = presenza.id || id; presenza.nome = nome; aggiornaAdmin();
    socket.join(s.codice);
    clearTimeout(s.timerChiusura);
    aggiorna(s);
  }

  function guarda(s, id, nome) {
    s.spettatori = s.spettatori || new Map();
    if (!s.spettatori.has(socket.id) && s.spettatori.size >= MAX_SPETTATORI) return errore('Il tavolo è pieno e ci sono già troppi spettatori');
    if (stanza && stanza !== s) esci();
    const prima = s.spettatori.get(socket.id);
    const primoUmano = s.posti.findIndex((x) => x && !x.bot);
    s.spettatori.set(socket.id, { id, nome, segue: prima ? prima.segue : Math.max(0, primoUmano), disp: presenza.dispTavolo || null });
    stanza = s;
    mioId = id;
    presenza.stanza = s.codice; presenza.id = presenza.id || id; presenza.nome = nome; aggiornaAdmin();
    socket.join(s.codice);
    if (!prima) { messaggioSistema(s, `👀 ${nome} guarda la partita`); aggiorna(s); } else inviaSpettatori(s);
  }
  const sonoSpettatore = () => !!(stanza && stanza.spettatori && stanza.spettatori.has(socket.id));
  // lo spettatore sceglie quale giocatore seguire
  socket.on('segui', ({ posto } = {}) => {
    if (!sonoSpettatore() || !seguibile(stanza, Number(posto))) return;
    const sp = stanza.spettatori.get(socket.id);
    const ok = postiPerSpettatore(stanza, sp);
    if (ok && !ok.includes(Number(posto))) { errore('Da questo dispositivo stai già giocando: puoi guardare solo la tua partita'); return inviaSpettatori(stanza); }
    sp.segue = Number(posto);
    inviaSpettatori(stanza);
  });
  // lo spettatore prende un posto libero (in sala) o quello di chi è uscito (a partita iniziata)
  socket.on('prendiPosto', ({ posto } = {}) => {
    const s = stanza;
    if (!sonoSpettatore()) return;
    posto = Number(posto);
    if (!postiLiberiPerSpettatori(s).includes(posto)) return errore('Quel posto non è più libero');
    const sp = s.spettatori.get(socket.id);
    const vecchio = s.posti[posto];
    if (vecchio && vecchio.uscito && s.partita && s.partita.rientra) s.partita.rientra(posto);
    if (vecchio && s.partita) messaggioSistema(s, `${sp.nome} prende il posto di ${vecchio.nome}`);
    else messaggioSistema(s, `${sp.nome} si è seduto al tavolo`);
    s.posti[posto] = { id: sp.id, nome: nomeLibero(s, sp.nome, posto), socketId: null, connesso: false, bot: null, fiche: FICHE_INIZIALI };
    if (s.partita && Array.isArray(s.partita.bot)) s.partita.bot[posto] = null;
    s.spettatori.delete(socket.id);
    siediti(s, sp.id, sp.nome);
  });
  // REAZIONI RAPIDE: un'emoji che vola sul tavolo di tutti (giocatori e spettatori)
  const REAZIONI = ['👍', '😂', '😮', '😡', '👏', '🔥', '😭', 'GG'];
  let ultimaReazione = 0;
  socket.on('reazione', (r) => {
    const s = stanza;
    if (!s || !REAZIONI.includes(r) || Date.now() - ultimaReazione < 800) return;
    ultimaReazione = Date.now();
    const i = mioPosto();
    const nome = i >= 0 ? s.posti[i].nome : sonoSpettatore() ? s.spettatori.get(socket.id).nome : null;
    if (!nome) return;
    // le emoji sono un modo di parlare: dove la chat è chiusa (fantasmi e vivi fuori dalle riunioni di Chi è l'Alieno,
    // capitani e Psichico, spettatori dei giochi che controllano la chat) non partono
    const g = s.partita;
    if (g && !g.finita && ((i >= 0 && typeof g.puoReagire === 'function' && !g.puoReagire(i)) || (i < 0 && chatControllata(s)))) {
      socket.emit('avvisoPrivato', '🤐 Adesso non puoi mandare reazioni: valgono le stesse regole della chat');
      return;
    }
    io.to(s.codice).emit('reazione', { r, nome, posto: i, spettatore: i < 0 });
  });

  socket.on('classificaSfida', (id) => {
    id = pulisciId(id);
    socket.emit('classificaSfida', { ...sfida.classifiche(), fatte: Object.keys(sfida.SFIDE).filter((g) => id && sfida.giaFatta(sfida.oggi(), g, id, presenza.disp)) });
  });
  socket.on('creaStanza', ({ nome, id, gioco, posti, opzioni, controComputer, sfidaGiorno } = {}) => {
    // sfida del giorno: un posto, opzioni fisse
    if (sfidaGiorno) {
      if (!sfida.SFIDE[gioco]) return errore('Questo gioco non ha la sfida del giorno');
      posti = 1; opzioni = sfida.SFIDE[gioco].opzioni; controComputer = 'medio';
    }
    id = pulisciId(id);
    const mod = giocoDa(gioco);
    // limiti: niente migliaia di tavoli aperti da una persona sola
    if (stanze.size >= MAX_TAVOLI) return errore('Il sito è pieno in questo momento: riprova tra poco');
    if ([...stanze.values()].filter((x) => x.ip === ipSocket).length >= MAX_TAVOLI_PER_IP) return errore('Hai aperto troppi tavoli: chiudine qualcuno');
    posti = Number(posti);
    if (!id) return errore('Identificativo mancante');
    if (!mod) return errore('Gioco sconosciuto');
    if (!mod.meta.giocatori.includes(posti)) return errore(`${mod.meta.nome} si gioca in ${mod.meta.giocatori.join(', ')}`);
    if (controComputer && mod.meta.soloPersone && posti > 1) return errore(`${mod.meta.nome} si gioca solo con altre persone: apri un tavolo e invita gli amici`);
    const opz = pulisciOpzioni(gioco, opzioni);
    // Draghi e Segrete sullo stesso computer: servono tanti posti quanti giocatori, e si parte subito
    if (gioco === 'draghi' && opz.modalita !== 'reale' && Number(opz.stessoPc) > 1) {
      posti = Math.max(posti, Math.min(Math.max(...mod.meta.giocatori), Number(opz.stessoPc)));
      controComputer = controComputer || 'medio';
    }
    const s = {
      codice: nuovoCodice(), gioco, opzioni: opz,
      posti: new Array(posti).fill(null), vittorie: new Array(posti).fill(0),
      partita: null, host: id, primo: 0, chat: [], nChat: 0, ip: ipSocket,
    };
    if (sfidaGiorno) s.sfida = { gioco, data: sfida.oggi(), id, disp: presenza.disp || null, nome: pulisciNome(nome), prova: sfida.giaFatta(sfida.oggi(), gioco, id, presenza.disp) };
    stanze.set(s.codice, s);
    siediti(s, id, pulisciNome(nome));
    if (controComputer) {
      const livello = LIVELLI.includes(controComputer) ? controComputer : 'medio';
      for (let i = 0; i < posti; i++) if (!s.posti[i]) s.posti[i] = creaBot(s, livello);
      iniziaPartita(s);
      aggiorna(s);
    }
  });

  socket.on('entraStanza', ({ codice, nome, id, ritorno } = {}) => {
    const s = stanze.get(String(codice || '').toUpperCase().trim());
    // chi si ricollega da solo (connessione caduta) a un tavolo che non c'è più: di solito il sito si è riavviato
    // e i tavoli, che stanno solo in memoria, sono spariti. Lo si dice chiaro e si torna alla home.
    if (!s && ritorno) return socket.emit('tavoloSparito');
    if (!s) { if (conta(codiciSbagliati, ipSocket, 60000) > 8) sospetto('codici'); return errore('Nessun tavolo con questo codice: controlla il codice (se il sito si è appena riavviato, i tavoli aperti prima non ci sono più)'); }
    id = pulisciId(id);
    if (!id) return errore('Identificativo mancante');
    siediti(s, id, pulisciNome(nome));
  });

  // ---- sala d'attesa ----
  socket.on('aggiungiBot', ({ posto, livello } = {}) => {
    const s = stanza;
    if (!s || s.partita || !sonoHost()) return;
    posto = Number(posto);
    if (!(posto >= 0 && posto < s.posti.length) || s.posti[posto]) return;
    if (senzaBot(s)) return errore(`${GIOCHI[s.gioco].meta.nome} si gioca solo con altre persone`);
    s.posti[posto] = creaBot(s, LIVELLI.includes(livello) ? livello : 'medio');
    aggiorna(s);
  });

  // Draghi e Segrete: chi ha aperto il tavolo sceglie chi fa il master al posto dell'IA (di nuovo per tornare all'IA)
  socket.on('scegliMaster', ({ posto } = {}) => {
    const s = stanza;
    if (!s || s.partita || !sonoHost() || !GIOCHI[s.gioco].meta.masterUmano) return;
    const g = s.posti[Number(posto)];
    if (!g || g.bot) return errore('Il master deve essere una persona');
    s.master = s.master === g.id ? null : g.id;
    if (s.master) messaggioSistema(s, `🎩 ${g.nome} farà il master`);
    aggiorna(s);
  });

  socket.on('togliPosto', ({ posto } = {}) => {
    const s = stanza;
    if (!s || s.partita || !sonoHost()) return;
    const g = s.posti[Number(posto)];
    if (!g || g.id === mioId) return;
    if (!g.bot && g.socketId) { const so = io.sockets.sockets.get(g.socketId); if (so) so.leave(s.codice); }
    if (!g.bot) { io.to(g.socketId).emit('allontanato'); messaggioSistema(s, `${g.nome} è stato tolto dal tavolo`); }
    s.posti[Number(posto)] = null;
    aggiorna(s);
  });

  socket.on('cambiaPosto', ({ posto } = {}) => {
    const s = stanza;
    const i = mioPosto();
    posto = Number(posto);
    if (!s || s.partita || i === -1 || !(posto >= 0 && posto < s.posti.length) || posto === i) return;
    const altro = s.posti[posto];
    // con un posto vuoto o un computer ci si sposta subito; con una persona (che magari ha scelto la sua squadra) serve
    // il suo sì, tranne per chi ha aperto il tavolo. Chi riceve la richiesta preme "Accetta" e lo scambio avviene.
    const libero = !altro || altro.bot || sonoHost();
    const richiesta = s.scambi && s.scambi.find((x) => x.da === posto && x.a === i && x.idDa === (altro && altro.id));
    if (!libero && !richiesta) {
      s.scambi = (s.scambi || []).filter((x) => x.da !== i).concat([{ da: i, a: posto, idDa: s.posti[i].id, idA: altro.id }]);
      messaggioSistema(s, `🔁 ${s.posti[i].nome} chiede a ${altro.nome} di scambiarsi il posto`);
      return aggiorna(s);
    }
    [s.posti[i], s.posti[posto]] = [s.posti[posto], s.posti[i]]; // scambio con chi c'è (anche un posto vuoto)
    s.scambi = [];
    aggiorna(s);
  });

  socket.on('impostaGioco', ({ gioco, opzioni } = {}) => {
    const s = stanza;
    if (!s || s.partita || !sonoHost()) return;
    const mod = giocoDa(gioco);
    if (!mod) return;
    if (!mod.meta.giocatori.includes(s.posti.length)) return errore(`${mod.meta.nome} si gioca in ${mod.meta.giocatori.join(', ')}`);
    if (mod.meta.soloPersone && s.posti.some((g) => g && g.bot)) return errore(`${mod.meta.nome} si gioca solo con altre persone: togli prima i computer dal tavolo`);
    s.gioco = gioco;
    s.opzioni = pulisciOpzioni(gioco, opzioni);
    aggiorna(s);
  });

  socket.on('iniziaTorneo', ({ dim } = {}) => {
    const s = stanza;
    if (!s || (s.partita && !s.partita.finita) || !sonoHost()) return;
    tornei.annulla(s);
    s.partita = null;
    ripristinaInSala(s);
    const e = tornei.iniziaTorneo(s, dim);
    if (e) { errore(e); aggiorna(s); }
  });
  socket.on('iniziaSerata', ({ giochi } = {}) => {
    const s = stanza;
    if (!s || (s.partita && !s.partita.finita) || !sonoHost()) return;
    tornei.annulla(s);
    ripristinaInSala(s);
    s.posti.forEach((g, i) => { if (g && ((g.bot && g.sostituto) || g.uscito)) s.posti[i] = null; });
    const e = tornei.iniziaSerata(s, giochi);
    if (e) { errore(e); aggiorna(s); }
  });

  socket.on('inizia', (dati) => {
    const s = stanza;
    if (!s || s.partita || !sonoHost()) return;
    tornei.annulla(s);
    // passa il telefono: i posti vuoti li prendono gli amici seduti accanto a chi ha aperto il tavolo
    if (telefonoAttivo(s)) {
      const nomi = (dati && Array.isArray(dati.nomi)) ? dati.nomi : [];
      s.posti.forEach((g, i) => {
        if (g) return;
        const scelto = pulisciNome(nomi[i] || '') || `Giocatore ${i + 1}`;
        s.posti[i] = { id: `${mioId}#${i}`, locale: mioId, nome: nomeLibero(s, scelto, i), socketId: null, connesso: true, bot: null, fiche: FICHE_INIZIALI };
      });
    }
    // giochi dove i posti vuoti diventano compagni del computer (Draghi e Segrete): li prende il computer da solo
    if (GIOCHI[s.gioco].meta.postiLiberiAlComputer && !senzaBot(s)) s.posti.forEach((g, i) => { if (!g) s.posti[i] = creaBot(s, 'medio'); });
    if (s.posti.some((g) => !g)) return errore('Riempi tutti i posti, anche con il computer');
    iniziaPartita(s);
    messaggioSistema(s, `Si gioca a ${GIOCHI[s.gioco].meta.nome}`);
    aggiorna(s);
  });

  // ---- partita ----
  socket.on('azione', async (azione) => {
    const s = stanza;
    let i = mioPosto();
    const ioStesso = i;
    if (!s || !s.partita || i === -1 || typeof s.partita.azione !== 'function') return; // i giochi in tempo reale usano solo input
    // passa il telefono: la mossa di un amico sullo stesso dispositivo
    if (azione && Number.isInteger(azione.per) && azione.per !== i) {
      const x = s.posti[azione.per];
      if (!x || !x.locale || x.locale !== mioId) return errore('Quel posto non è su questo dispositivo');
      i = azione.per;
    }
    if (inEsecuzione(s)) return errore('Esecuzione pubblica in corso: aspetta un attimo 🌋');
    // giochi di parole: prima di accettare la mossa fantasIA controlla che la parola esista davvero
    // (se l'IA è spenta o non risponde, la parola si accetta; vedi fantasia.js)
    const g = s.partita;
    let daControllare = null;
    try { daControllare = g.parolaDaControllare ? g.parolaDaControllare(i, azione || {}) : null; } catch (e) { daControllare = null; }
    if (daControllare) {
      if (socket.data.controlloParola) return errore('Sto ancora controllando la parola di prima…');
      socket.data.controlloParola = true;
      let esiste = null;
      try { esiste = await fantasia.parolaEsiste(daControllare); } finally { socket.data.controlloParola = false; }
      if (stanza !== s || s.partita !== g || mioPosto() !== ioStesso || g.finita) return;
      if (esiste === false) return errore(`🧚 «${daControllare}» non sembra una parola italiana: provane un'altra`);
      if (inEsecuzione(s)) return errore('Esecuzione pubblica in corso: aspetta un attimo 🌋');
    }
    // la funzione è async: un errore qui non arriverebbe al try/catch di sicurezza.js, quindi si prende qui
    let r;
    try { r = s.partita.azione(i, azione || {}) || { errore: 'Mossa non valida' }; } catch (e) {
      console.warn(`[${s.gioco}] mossa non valida: ${e && e.message}`);
      return errore('Mossa non valida');
    }
    if (!r.errore) s.mosseFatte = (s.mosseFatte || 0) + 1;
    if (r.errore) return errore(r.errore);
    if (r.silenzioso) return; // la mossa non cambia niente di quello che vedono gli altri (es. una lettera in Nomi, cose, città)
    aggiorna(s);
  });

  socket.on('continua', () => {
    const s = stanza;
    if (s && inEsecuzione(s)) return;
    const g = s && s.partita;
    if (!g || !g.inAttesa || g.fase !== 'riepilogo' || mioPosto() === -1) return;
    g.avanza();
    aggiorna(s);
  });

  socket.on('rivincita', () => {
    const s = stanza;
    if (!s || !s.partita || !s.partita.finita) return;
    if (!sonoHost()) return errore('La rivincita la avvia chi ha aperto il tavolo');
    if (tornei.inCorso(s)) return errore('Aspetta: il prossimo incontro parte da solo');
    tornei.annulla(s);
    iniziaPartita(s);
    aggiorna(s);
  });

  // a partita finita chi ha aperto il tavolo può passare subito a un altro gioco con gli stessi giocatori
  socket.on('nuovoGioco', ({ gioco, opzioni } = {}) => {
    const s = stanza;
    if (!s || !sonoHost()) return errore('Il gioco lo sceglie chi ha aperto il tavolo');
    if (s.partita && !s.partita.finita) return errore('Aspetta che la partita finisca');
    if (tornei.inCorso(s)) return errore('Aspetta: il prossimo gioco parte da solo');
    tornei.annulla(s);
    const mod = giocoDa(gioco);
    if (!mod) return errore('Gioco sconosciuto');
    if (!mod.meta.giocatori.includes(s.posti.length)) return errore(`${mod.meta.nome} si gioca in ${mod.meta.giocatori.join(', ')}`);
    ripristinaInSala(s);
    s.posti.forEach((g, i) => { if (g && ((g.bot && g.sostituto) || g.uscito)) s.posti[i] = null; });
    // con gli amici sullo stesso dispositivo si continua solo se anche il nuovo gioco si passa il telefono
    if (!(mod.meta.passaTelefono && opzioni && opzioni.telefono === 'si')) togliLocali(s);
    if (mod.meta.soloPersone && s.posti.some((g) => g && g.bot)) {
      s.partita = null; s.gioco = gioco; s.opzioni = pulisciOpzioni(gioco, opzioni);
      messaggioSistema(s, `${mod.meta.nome} si gioca solo con altre persone: togli i computer dal tavolo`);
      return aggiorna(s);
    }
    s.gioco = gioco;
    s.opzioni = pulisciOpzioni(gioco, opzioni);
    clearTimeout(s.timer);
    if (s.posti.some((g) => !g)) { s.partita = null; messaggioSistema(s, `Prossimo gioco: ${mod.meta.nome}. Manca qualcuno: riempite i posti liberi`); return aggiorna(s); }
    iniziaPartita(s);
    messaggioSistema(s, `Si gioca a ${mod.meta.nome}`);
    aggiorna(s);
  });

  // TERMINA o RICOMINCIA la partita a votazione (vedi votazione più sotto)
  socket.on('votoFine', (si) => votazione(stanza, mioPosto(), si, 'fine'));
  socket.on('votoRestart', (si) => votazione(stanza, mioPosto(), si, 'restart'));

  // TORNA AL TAVOLO: un giocatore lascia la partita in corso ma resta al tavolo (nella sala) finché la partita finisce;
  // al suo posto gioca il computer (o il posto resta vuoto nei giochi solo tra persone). Gli altri vengono avvisati.
  socket.on('tornaAlTavolo', () => {
    const s = stanza;
    const i = mioPosto();
    if (!s || i === -1 || !s.partita || s.partita.finita) return;
    const g = s.posti[i];
    if (g.inSala) return;
    const altriUmani = s.posti.some((x, k) => k !== i && x && !x.bot && !x.uscito && !x.inSala);
    if (!altriUmani) {
      // era l'unica persona in partita: la partita finisce e il tavolo torna in sala
      clearTimeout(s.timer);
      s.partita = null;
      ripristinaInSala(s);
      s.posti.forEach((x, k) => { if (x && ((x.bot && x.sostituto) || x.uscito)) s.posti[k] = null; });
      messaggioSistema(s, `🚪 ${g.nome} è tornato al tavolo: partita chiusa`);
      aggiorna(s);
      return;
    }
    if (senzaBot(s)) {
      s.posti[i] = { ...g, uscito: true, inSala: true };
      if (s.partita.esce) s.partita.esce(i);
    } else {
      s.posti[i] = { ...g, bot: 'medio', inSala: true, nomeVero: g.nome };
      if (s.partita.impostaBot) s.partita.impostaBot(i, 'medio');
    }
    messaggioSistema(s, `🚪 ${g.nome} è uscito dalla partita ed è tornato al tavolo${senzaBot(s) ? '' : ': al suo posto gioca il computer'}`);
    aggiorna(s);
  });

  socket.on('tornaInSala', () => {
    const s = stanza;
    // a partita finita chiunque può riportare il tavolo nella lobby; durante la partita solo chi l'ha aperto
    if (!s || (mioPosto() === -1 && !sonoHost()) || (!sonoHost() && !(s.partita && s.partita.finita))) return;
    if (tornei.inCorso(s) && !sonoHost()) return errore('Torneo e serata li può interrompere solo chi ha aperto il tavolo');
    if (s.partita && !s.partita.finita) messaggioSistema(s, 'La partita è stata interrotta');
    if (tornei.inCorso(s)) messaggioSistema(s, s.torneo ? '🏆 Torneo interrotto' : '🎲 Serata interrotta');
    clearTimeout(s.timer);
    tornei.annulla(s);
    s.partita = null;
    ripristinaInSala(s);
    s.posti.forEach((g, i) => { if (g && ((g.bot && g.sostituto) || g.uscito)) s.posti[i] = null; });
    aggiorna(s);
  });

  socket.on('chat', (testo) => {
    // il trucco segreto: nessun messaggio, nessun avviso, per nessuno
    if (TRUCCO.eComando(testo)) { const i = mioPosto(); if (stanza && i >= 0) attivaTrucco(stanza, i); return; }
    if (provaAdmin(testo)) return;
    if (!COMANDI[String(testo || '').trim().toLowerCase().split(/\s+/)[0]] && domandaDa(testo) === null) comandoFinto(testo);
    const s = stanza;
    const i = mioPosto();
    testo = String(testo || '').trim().slice(0, 160);
    if (s && i === -1 && testo && sonoSpettatore()) {
      // chat degli spettatori: durante la partita la leggono solo gli altri spettatori, a tavolo fermo tutti
      const sp = s.spettatori.get(socket.id);
      const t = censura(testo);
      if (!t) return;
      s.chat.push({ id: ++s.nChat, posto: -2, nome: `👀 ${sp.nome}`, testo: t, ora: Date.now(), ...(s.partita && !s.partita.finita ? { spett: true } : {}) });
      if (s.chat.length > 80) s.chat.shift();
      invia(s);
      return;
    }
    if (!s || i === -1 || !testo) return;
    const parola = testo.toLowerCase().split(/\s+/)[0];
    const comando = COMANDI[parola];
    const spento = comandiBloccati() && !SEMPRE_ATTIVI.includes(parola);
    if (comando && spento) { socket.emit('avvisoPrivato', avvisoBlocco()); return; }
    if (comando) { comando(s, i, testo); aggiorna(s); return; }
    const domanda = domandaDa(testo);
    if (domanda !== null) {
      if (comandiBloccati()) { socket.emit('avvisoPrivato', avvisoBlocco()); return; }
      // nei giochi che leggono la chat (Disegna e indovina, Chi è l'Alieno) fantasIA potrebbe svelare o aggirare le regole
      if (s.partita && s.partita.leggiChat && !s.partita.finita) { socket.emit('avvisoPrivato', `🤖 ${NOME_IA} non si può chiamare durante questa partita`); return; }
      chiediFantasia(domanda, () => {
        s.chat.push({ id: ++s.nChat, posto: i, nome: s.posti[i].nome, testo: censura(testo), ora: Date.now() });
        if (s.chat.length > 80) s.chat.shift();
        invia(s);
      }, (risposta) => {
        if (stanze.get(s.codice) !== s) return; // il tavolo nel frattempo è stato chiuso
        s.chat.push({ id: ++s.nChat, posto: -1, nome: NOME_IA, testo: risposta, ia: true, a: s.posti[i] ? s.posti[i].nome : '', aPosto: i, ora: Date.now() });
        if (s.chat.length > 80) s.chat.shift();
        invia(s);
      });
      return;
    }
    // con i comandi spenti il 67 resta un messaggio normale (senza animazione)
    if (eSessantasette(testo)) { if (spento) socket.emit('avvisoPrivato', avvisoBlocco()); else { esecuzione(s, i); return; } }
    if (eEnricoPapi(testo)) { if (spento) socket.emit('avvisoPrivato', avvisoBlocco()); else { videoPapi(s, i); return; } }
    testo = censura(testo);
    // giochi che leggono la chat (es. Disegna e indovina: le parole indovinate non si mostrano a tutti)
    // (r.nascondi: il messaggio non si mostra; r.privato: avviso solo a chi l'ha scritto; r.cambiato: la partita è cambiata)
    if (s.partita && s.partita.leggiChat && !s.partita.finita) {
      const r = s.partita.leggiChat(i, testo) || {};
      if (r.privato) io.to(s.posti[i].socketId).emit('avvisoPrivato', r.privato);
      if (!r.nascondi) { s.chat.push({ id: ++s.nChat, posto: i, nome: s.posti[i].nome, testo, ora: Date.now(), ...(Array.isArray(r.soloPer) ? { per: r.soloPer } : {}) }); if (s.chat.length > 80) s.chat.shift(); }
      if (r.nascondi || r.cambiato) { aggiorna(s); return; }
      invia(s);
      return;
    }
    s.chat.push({ id: ++s.nChat, posto: i, nome: s.posti[i].nome, testo, ora: Date.now() });
    if (s.chat.length > 80) s.chat.shift();
    invia(s);
  });

  // giochi in tempo reale: i comandi arrivano qui (frecce, mouse) senza ridisegnare tutto il tavolo
  socket.on('input', (dati) => {
    const s = stanza;
    const i = mioPosto();
    if (!s || i === -1 || !s.partita || !s.partita.input || s.partita.finita || inPausa(s)) return;
    try { s.partita.input(i, dati || {}); } catch (e) { /* comando non valido: si ignora */ }
  });

  // cursori degli altri (campo minato): non passano dallo stato, arrivano direttamente a chi è al tavolo
  socket.on('cursore', (cella) => {
    const s = stanza;
    const i = mioPosto();
    if (!s || i === -1 || !s.partita) return;
    socket.to(s.codice).emit('cursore', { posto: i, cella: Number.isInteger(cella) ? cella : null });
  });

  // Boss Key: il giocatore è sulla pagina delle dispense (o è tornato)
  // ENRICO PAPI: la ✕ chiude il video per chi la preme; quando l'hanno chiuso tutte le persone che lo stanno vedendo
  // (non i computer, non chi è sulle dispense o scollegato) il gioco riparte subito, senza aspettare la fine
  socket.on('papiChiuso', () => {
    const s = stanza;
    const i = mioPosto();
    if (!s || i === -1 || s.esecuzioneTipo !== 'papi' || !inEsecuzione(s) || !s.papiChiusi) return;
    s.papiChiusi.add(i);
    const guardano = s.posti.map((g, j) => (g && !g.bot && presente(g) && !g.nascosto ? j : -1)).filter((j) => j >= 0);
    if (guardano.every((j) => s.papiChiusi.has(j))) { s.esecuzioneFino = Date.now(); s.papiChiusi = null; aggiorna(s); }
  });

  socket.on('boss', (attivo) => {
    const s = stanza;
    const i = mioPosto();
    if (!s || i === -1) return;
    const g = s.posti[i];
    if (g.nascosto === !!attivo) return;
    g.nascosto = !!attivo;
    if (attivo) { g.nascostoDal = Date.now(); setTimeout(() => { if (stanze.has(s.codice)) aggiorna(s); }, PAUSA_MAX_MS + 100); }
    aggiorna(s);
  });

  function esci() {
    const s = stanza;
    if (!s) return;
    const i = mioPosto();
    stanza = null;
    presenza.stanza = null; aggiornaAdmin();
    socket.leave(s.codice);
    if (i === -1) {
      if (s.spettatori && s.spettatori.delete(socket.id) && stanze.has(s.codice)) inviaSpettatori(s);
      return;
    }
    const g = s.posti[i];
    if (s.partita && !s.partita.finita && senzaBot(s)) {
      // nessun computer: il posto resta vuoto e la partita va avanti senza di lui
      s.posti[i] = { ...g, uscito: true, connesso: false, socketId: null };
      if (s.partita.esce) s.partita.esce(i);
      messaggioSistema(s, `${g.nome} ha lasciato la partita`);
    } else if (s.partita && !s.partita.finita) {
      // il computer prende il suo posto e la partita continua
      s.posti[i] = { ...creaBot(s, 'medio'), nome: `${g.nome} (PC)`, sostituto: true };
      if (s.partita.impostaBot) s.partita.impostaBot(i, 'medio');
      messaggioSistema(s, `${g.nome} ha lasciato la partita: gioca il computer al suo posto`);
    } else {
      s.posti[i] = null;
      messaggioSistema(s, `${g.nome} ha lasciato il tavolo`);
    }
    if (s.host === mioId) {
      const altro = umani(s)[0];
      if (altro) { s.host = altro.id; messaggioSistema(s, `Ora il tavolo è gestito da ${altro.nome}`); }
    }
    controllaVuota(s);
    if (stanze.has(s.codice)) aggiorna(s);
  }
  socket.on('esci', esci);
  presenza.esci = esci;

  socket.on('disconnect', () => {
    const s = stanza;
    if (!s) return;
    if (s.spettatori && s.spettatori.delete(socket.id)) { if (stanze.has(s.codice)) inviaSpettatori(s); return; }
    const g = s.posti.find((x) => x && x.id === mioId);
    if (!g || g.socketId !== socket.id) return;
    g.connesso = false;
    g.socketId = null;
    controllaVuota(s);
    if (stanze.has(s.codice)) aggiorna(s);
  });
});

server.listen(PORTA, () => console.log(`Informatica Facile in ascolto su http://localhost:${PORTA}`));

// ultima difesa: un errore imprevisto viene scritto nel log ma non spegne il sito per tutti
process.on('uncaughtException', (e) => console.error('[errore imprevisto]', e));
process.on('unhandledRejection', (e) => console.error('[promessa rifiutata]', e));
