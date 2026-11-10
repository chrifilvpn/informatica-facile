// DRAGHI E SEGRETE: il gioco di ruolo fantasy con l'IA che fa da master (le regole libere SRD 5.1 della 5ª edizione
// del gioco di ruolo più famoso). Da 1 a 6 giocatori, i posti vuoti sono compagni del computer (li interpreta il
// master e in battaglia li muove il gioco). Fasi:
//   creazione   ognuno crea il suo personaggio (stirpe, classe, background, caratteristiche, abilità, incantesimi,
//               aspetto); chi ha aperto il tavolo può scrivere l'idea della campagna; poi si parte
//   avventura   il master racconta; ognuno scrive cosa fa il suo personaggio (qualsiasi cosa); quando hanno scritto
//               tutti (o dopo un tempo) il master risponde
//   prove       il master ha chiesto prove o tiri salvezza: ognuno tira i suoi dadi, poi il master racconta l'esito
//   combattimento  la mappa tattica a turni (combattimento.js); alla fine esperienza e livelli, e si torna al racconto
// Al tavolo con gli amici uno può fare il master al posto dell'IA (dm.js): l'IA gli fa da consigliere.
// La campagna vive finché il tavolo è aperto, ma si può scaricare e riprendere da un file (salva.js). I file delle
// regole sono in giochi3/draghi/.
const R = require('./draghi/regole');
const B = require('./draghi/base');
const { CLASSI } = require('./draghi/classi');
const { INCANTESIMI } = require('./draghi/incantesimi');
const { MOSTRI } = require('./draghi/mostri');
const MAP = require('./draghi/mappe');
const { Combattimento } = require('./draghi/combattimento');
const MASTER = require('./draghi/master');
const T = require('../giochi/trucco');
const H = require('./draghi/horror');
const INC = require('./draghi/incubo');
const { TempoReale } = require('./draghi/tempo-reale');
const DM = require('./draghi/dm');
const SALVA = require('./draghi/salva');

const AMBIENTAZIONI = ['classica', 'oscura', 'pirati', 'citta', 'selvaggia'];
const ATTESA_DICHIARAZIONI = 150000; // dopo la prima azione scritta, al massimo 2 minuti e mezzo per gli altri
const MAX_RACCONTO = 400;
const ROUND_PER_RACCONTO = 2; // in combattimento il master IA racconta ogni due round
const { ATTESA_MANO } = DM; // il master muove i nemici a mano: dopo 2 minuti senza mosse il turno lo fa il gioco
const ATTESA_REVIVE = 15 * 60000; // tutti morti: un quarto d'ora per scrivere !revive, poi la campagna finisce
const STILE_DA_LUOGO = { villaggio: 'villaggio', citta: 'villaggio', porto: 'villaggio', taverna: 'taverna', castello: 'castello', torre: 'castello', tempio: 'cripta', rovine: 'dungeon', dungeon: 'dungeon', grotta: 'grotta', cripta: 'cripta', foresta: 'foresta', montagna: 'montagna', palude: 'palude', deserto: 'strada', accampamento: 'foresta', ponte: 'strada', miniera: 'grotta', fattoria: 'villaggio', lago: 'palude' };
const ao = (pg, m = 'o', f = 'a') => (pg && pg.genere === 'f' ? f : m); // pronto/pronta, morto/morta
const GRUPPO = ['tutti', 'gruppo', 'party', 'tutto il gruppo', 'il gruppo'];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

class Draghi {
  constructor({ n, bot = [], opzioni = {}, primo = 0, master = null }) {
    this.id = 'draghi';
    this.n = n;
    this.bot = Array.from({ length: n }, (_, i) => bot[i] || null);
    this.host = this.bot.findIndex((b) => !b); if (this.host < 0) this.host = 0;
    this.ambientazione = AMBIENTAZIONI.includes(opzioni.ambientazione) || H.TEMI.includes(opzioni.ambientazione) ? opzioni.ambientazione : opzioni.ambientazione === 'caso' ? AMBIENTAZIONI[Math.floor(Math.random() * AMBIENTAZIONI.length)] : 'classica';
    // le ambientazioni horror (horror.js): una campagna a settori, a turni o in tempo reale (incubo.js, tempo-reale.js)
    this.cp = H.CAMPAGNE[this.ambientazione] || null;
    this.modalita = this.cp && opzioni.modalita === 'reale' ? 'reale' : 'turni';
    // in più sullo stesso computer (solo a turni): chi ha aperto il tavolo gioca anche i posti dei primi compagni del
    // computer, passandosi il computer (le sue mosse arrivano con "per": il posto di chi sta giocando)
    const stessoPc = this.modalita === 'turni' ? Math.max(1, Math.min(n, Number(opzioni.stessoPc) || 1)) : 1;
    this.locali = [this.host];
    for (let i = 0; i < n && this.locali.length < stessoPc; i++) if (this.bot[i] && i !== this.host) { this.locali.push(i); this.bot[i] = null; }
    if (this.locali.length < 2) this.locali = [];
    this.pazza = opzioni.pazza === true || opzioni.pazza === 'true';
    this.livelloIniziale = [1, 3, 5].includes(Number(opzioni.livello)) ? Number(opzioni.livello) : 1;
    this.difficolta = ['storia', 'normale', 'mortale'].includes(opzioni.difficolta) ? opzioni.difficolta : 'normale';
    this.lunghezza = ['normali', 'brevi', 'lunghe'].includes(opzioni.lunghezza) ? opzioni.lunghezza : 'normali';
    this.chiave = process.env.GEMINI_API_KEY ? String(process.env.GEMINI_API_KEY).trim() : '';
    this.fetch = typeof fetch === 'function' ? fetch : null;
    this.fase = 'creazione';
    this.pg = new Array(n).fill(null);
    this.tirati = new Array(n).fill(null);
    this.suggerite = new Array(n).fill(null);
    this.idea = '';
    this.racconto = []; this.nR = 0;
    this.storia = []; // per il master: [{ ruolo, testo }]
    this.diario = '';
    this.png = []; this.missioni = [];
    this.dichiarazioni = {};
    this.primaDichiarazione = null;
    this.prove = []; // { id, posto, tipo, cd, vantaggio, svantaggio, motivo, salvezza, danno, tipoDanno, meta, condizione, esito }
    this.scelte = [];
    this.atmosfera = 'calma';
    this.attesaIA = false; this.rispostaIA = null; this.erroreIA = null; this.ultimaRichiesta = null; this.tentativi = 0;
    this.combattimento = null; this.metaCombattimento = null; this.roundRaccontato = 0; this.attesaRacconto = false; this.raccontoPronto = null;
    this.prossimaMossaMostro = 0;
    this.velocitaBot = 0.6;
    this.turno = null; this.inAttesa = false; this.finita = false; this.risultato = null; this.evento = null; this.nEv = 0;
    this.seme = Math.floor(Math.random() * 1e9);
    this.mondo = MAP.generaMondo(this.seme);
    this.posizione = null;
    this.scenaVista = null; // la mappa tattica dell'ultimo combattimento (si vede anche dopo)
    if (this.cp) this.preparaIncubo();
    this.preparaDm();
    // il master scelto nella sala d'attesa (server.js): come il 🎩 della creazione
    if (master != null) this.azioneDm(this.host, { tipo: 'dm-scegli', posto: master });
    if (this.modalita === 'reale') {
      // tempo reale: il server chiama tick() ogni 50 ms e manda a ognuno vistaTick(posto); i comandi arrivano da input()
      this.tickMs = 50;
      this.tick = (ora) => (this.reale ? this.reale.tick(ora) : false);
      this.vistaTick = (posto) => (this.reale ? this.reale.vistaTick(posto) : null);
      this.input = (posto, dati) => { if (this.reale) this.reale.input(posto, dati); };
    }
  }
  annuncia(posto, testo, testoIo, forte = false) { this.evento = { id: ++this.nEv, posto, testo, testoIo, forte }; }
  scrivi(tipo, testo, extra = {}) {
    const voce = { id: ++this.nR, tipo, testo: String(testo || '').slice(0, 9000), ora: Date.now(), ...extra };
    this.racconto.push(voce);
    if (this.racconto.length > MAX_RACCONTO) this.racconto.shift();
    return voce;
  }
  pgVivi() { return this.pg.map((p, i) => (p && !p.morto ? i : -1)).filter((i) => i >= 0); }
  // i personaggi vivi dei giocatori veri: se non ce n'è più nessuno la campagna aspetta !revive (i compagni del
  // computer da soli non scrivono niente e il tavolo restava fermo per sempre)
  // Se nessun giocatore vero ha un personaggio (l'unica persona fa il master e i compagni sono tutti del computer)
  // contano i compagni: altrimenti al primo controllo risultavano «tutti morti» con la compagnia in piedi.
  umaniVivi() {
    const haPgUmano = this.pg.some((p, i) => p && this.umano(i));
    return this.pgVivi().filter((i) => !haPgUmano || this.umano(i));
  }
  postoDi(nome) {
    const n = norm(nome);
    if (!n) return -1;
    let k = this.pg.findIndex((p) => p && norm(p.nome) === n);
    // solo il nome (o l'inizio del nome completo): "Aldo" trova "Aldo Ferri", ma "Aldo il fabbro" (un personaggio non
    // giocante) non deve trovare il personaggio Aldo
    if (k < 0) k = this.pg.findIndex((p) => p && `${norm(p.nome)} `.startsWith(`${n} `));
    return k;
  }
  chiDi(chi) { const n = norm(chi); if (GRUPPO.includes(n) || !n) return this.pgVivi(); const k = this.postoDi(chi); return k >= 0 ? [k] : []; }
  // per gli eventi che toccano un personaggio solo (morte, ispirazione, oggetti persi): serve il suo nome, se no niente
  unoDi(chi) { const n = norm(chi); return n && !GRUPPO.includes(n) ? this.postoDi(chi) : -1; }
  umano(p) { return !this.bot[p]; }

  // ---------- chi deve agire (per il server) ----------
  // chi ha aperto il tavolo (o chi gioca dal suo stesso computer)
  eHost(p) { return p === this.host || this.locali.includes(p); }
  // chi deve muovere: i posti sullo stesso computer non li muove mai il computer
  attesi() { return this.attesiTutti().filter((i) => i === this.host || !this.locali.includes(i)); }
  attesiTutti() {
    if (this.finita) return [];
    if (this.attesaDM) return [this.dm]; // i giocatori aspettano il master umano
    if (this.attesaIA) return [];
    if (this.fase === 'creazione') return this.pg.map((p, i) => (p || i === this.dm ? -1 : i)).filter((i) => i >= 0);
    if (this.fase === 'avventura') return this.pgVivi().filter((i) => this.umano(i) && this.dichiarazioni[i] == null);
    if (this.fase === 'prove') return [...new Set(this.prove.filter((x) => !x.esito).map((x) => x.posto))];
    if (this.fase === 'combattimento' && this.combattimento && !this.combattimento.finito) {
      const c = this.combattimento.attivo;
      const posto = c && c.pg ? this.pg.findIndex((p) => p === c.ref) : -1;
      return [...(posto >= 0 ? [posto] : []), ...(this.liberaDM || this.manoAttiva() ? [this.dm] : [])];
    }
    return [];
  }
  scadenza() {
    if (this.finita) return null;
    if (this.fase === 'caduti') return this.cadutiDa + ATTESA_REVIVE;
    if (this.attesaIaDm()) return Date.now() + 400;
    if (this.fase === 'reale') return null;
    if ((this.attesaIA && !this.attesaDM) || this.attesaRacconto || this.attesaLibera || this.liberaPronta) return Date.now() + 400;
    if (this.erroreIA && this.ultimaRichiesta && this.tentativi < 3) return Date.now() + 6000;
    if (this.fase === 'combattimento' && this.combattimento) {
      const cb = this.combattimento;
      if (cb.finito) return Date.now() + 1500;
      const c = cb.attivo;
      if (c && !c.pg && this.manoAttiva()) return this.manoChiave === this.chiaveMano() ? this.manoDa + ATTESA_MANO : Date.now() + 50;
      if (c && !c.pg) return Math.max(Date.now() + 50, this.prossimaMossaMostro);
    }
    if (this.fase === 'avventura' && this.primaDichiarazione) return this.primaDichiarazione + ATTESA_DICHIARAZIONI;
    return null;
  }
  controllaTempo() {
    const dm = this.novitaDm(); // i consigli e le bozze dell'IA per il master umano
    return this.controllaTempoGioco() || dm;
  }
  controllaTempoGioco() {
    if (this.finita) return false;
    if (this.fase === 'caduti') { if (Date.now() >= this.cadutiDa + ATTESA_REVIVE) { this.chiudi('Tutti i personaggi sono morti.'); return true; } return false; }
    if (this.fase === 'reale') return false;
    let cambiato = false;
    if (this.raccontoPronto) { const r = this.raccontoPronto; this.raccontoPronto = null; if (r.narrazione) this.scrivi('master', r.narrazione, { combattimento: true }); cambiato = true; }
    if (this.liberaPronta) { this.applicaLibera(); cambiato = true; }
    if (this.rispostaIA) { const r = this.rispostaIA; this.rispostaIA = null; this.applicaRisposta(r); return true; }
    // per sicurezza: "il master scrive" senza nessuna richiesta in corso non deve bloccare il tavolo
    if (this.attesaIA && !this.ultimaRichiesta && !this.attesaDM) { this.attesaIA = false; return true; }
    if (this.attesaIA) return cambiato;
    if (this.erroreIA && this.ultimaRichiesta && this.tentativi < 3 && !this.attesaIA) { this.ripeti(); return true; }
    if (this.fase === 'combattimento' && this.combattimento) {
      const cb = this.combattimento;
      if (cb.finito) { this.fineCombattimento(); return true; }
      const c = cb.attivo;
      // il master umano muove lui i nemici (dm.js): il gioco aspetta, e li muove da solo solo se il master non fa niente
      if (c && !c.pg && this.manoAttiva()) {
        if (this.manoChiave !== this.chiaveMano()) { this.manoChiave = this.chiaveMano(); this.manoDa = Date.now(); return true; }
        if (Date.now() < this.manoDa + ATTESA_MANO) return cambiato;
        cb.evento({ tipo: 'nota', id: c.id, testo: `Il master non muove ${c.ref.nome}: per questo turno lo muove il gioco.` });
        cb.turnoAutomatico(this.livelloIA());
        this.manoDa = Date.now();
        this.dopoAzioneCombattimento();
        return true;
      }
      if (c && !c.pg && Date.now() >= this.prossimaMossaMostro) {
        cb.turnoAutomatico(this.livelloIA());
        this.prossimaMossaMostro = Date.now() + 1100;
        this.dopoAzioneCombattimento();
        return true;
      }
    }
    if (this.fase === 'avventura' && this.primaDichiarazione && Date.now() >= this.primaDichiarazione + ATTESA_DICHIARAZIONI) { this.mandaDichiarazioni(); return true; }
    return cambiato;
  }
  livelloIA() { return { storia: 'facile', normale: 'medio', mortale: 'difficile' }[this.difficolta]; }
  // !win + parola segreta: il prossimo d20 del personaggio (prova, tiro salvezza, attacco, azione libera) sarà un 20 naturale
  // (lo spengono T.consuma in azioneProve/azioneLibera e combattimento.venti); a chi l'ha scritto un cenno segreto
  trucco(posto) { if (!(this.pg[posto] && this.pg[posto].morto)) T.sussurra(this, posto, '🍀 Il prossimo tiro di dado sarà un 20 naturale', 3000); }
  salta(p) { /* chi è via: il computer gioca per lui (bot) */ }

  // ---------- azioni ----------
  azione(p, a) {
    if (this.finita) return { errore: 'La campagna è finita' };
    if (!a || typeof a.tipo !== 'string') return { errore: 'Mossa non valida' };
    if (a.per != null && p === this.host && this.locali.includes(Number(a.per))) p = Number(a.per);
    // la risposta del master è arrivata ma il server non l'ha ancora messa nel racconto: prima quella, poi la mossa
    // (altrimenti una mossa nel mezzo faceva partire una nuova richiesta che la risposta vecchia cancellava, e il tavolo
    // restava per sempre su "il master sta scrivendo")
    if (this.rispostaIA && !this.attesaIA) { const r = this.rispostaIA; this.rispostaIA = null; this.applicaRisposta(r); if (this.finita) return { errore: 'La campagna è finita' }; }
    if (a.tipo === 'termina') {
      if (!this.comanda(p)) return { errore: 'Può chiudere la campagna solo chi ha aperto il tavolo' };
      this.chiudi('Il tavolo chiude la campagna.');
      return { ok: true };
    }
    if (a.tipo.startsWith('dm-')) return this.azioneDm(p, a);
    // 💾 scarica la campagna (chiunque, quando vuole) e 📂 riprendila da un file (salva.js)
    if (a.tipo === 'salva') return this.azioneSalva(p);
    if (a.tipo === 'riprendi') return this.azioneRiprendi(p, a.dati);
    if (p === this.dm && this.fase === 'creazione' && !['idea', 'inizia'].includes(a.tipo)) return { errore: 'Sei il master: non hai un personaggio' };
    if (a.tipo === 'note') { const pg = this.pg[p]; if (!pg) return { errore: 'Prima crea il personaggio' }; pg.note = String(a.testo || '').slice(0, 3000); return { ok: true }; }
    if (this.fase === 'creazione') return this.azioneCreazione(p, a);
    if (this.fase === 'caduti') return { errore: 'Tutti i personaggi sono morti: scrivete !revive in chat per riportarli in vita' };
    if (this.fase === 'reale') return this.reale.azione(p, a);
    if (a.tipo === 'riprova') { if (!this.erroreIA || !this.ultimaRichiesta) return { errore: 'Non c\'è niente da riprovare' }; this.tentativi = 0; this.ripeti(); return { ok: true }; }
    if (this.attesaIA) return { errore: 'Il master sta scrivendo…' };
    if (this.fase === 'avventura') return this.azioneAvventura(p, a);
    if (this.fase === 'prove') return this.azioneProve(p, a);
    if (this.fase === 'combattimento') return this.azioneCombattimento(p, a);
    return { errore: 'Mossa non valida' };
  }

  // --- creazione ---
  azioneCreazione(p, a) {
    if (a.tipo === 'tiraCaratteristiche') {
      if (this.tirati[p] && this.tirati[p].volte >= 3) return { errore: 'Hai già tirato tre volte' };
      this.tirati[p] = { valori: R.tiraCaratteristiche(), volte: (this.tirati[p] ? this.tirati[p].volte : 0) + 1 };
      return { ok: true };
    }
    if (a.tipo === 'idea') { if (!this.comanda(p)) return { errore: 'L\'idea la scrive chi ha aperto il tavolo' }; this.idea = String(a.testo || '').slice(0, 2000); return { ok: true }; }
    if (a.tipo === 'crea') {
      let s = a.scelte && typeof a.scelte === 'object' ? { ...a.scelte } : {};
      s.livello = this.livelloIniziale;
      if (this.cp) this.scelteIncubo(s);
      if (s.metodo === 'dadi') s.tirati = this.tirati[p] ? this.tirati[p].valori : null;
      if (a.casuale || this.bot[p]) s = R.completaScelte({ ...s, classe: s.classe || this.classeCompagno(p) });
      if (s.metodo === 'dadi') s.tirati = this.tirati[p] ? this.tirati[p].valori : null;
      if (this.cp && (!s.classe || !CLASSI[s.classe] || !(CLASSI[s.classe].tema || []).includes(this.cp.id))) return { errore: 'Scegli una delle classi di questa ambientazione' };
      if (!this.cp && s.classe && CLASSI[s.classe] && CLASSI[s.classe].tema) return { errore: 'Questa classe c\'è solo nelle ambientazioni horror' };
      const r = R.creaPersonaggio(s);
      if (r.errore) return r;
      r.pg.uid = `pg${p}`;
      r.pg.posto = p;
      if (this.cp) this.dopoCreazioneIncubo(r.pg, a.casuale || this.bot[p] ? { ...s, nome: a.scelte && a.scelte.nome } : s);
      this.pg[p] = r.pg;
      this.annuncia(p, `ha creato ${r.pg.nome}, ${B.STIRPI[r.pg.stirpe].nome.toLowerCase()} ${CLASSI[r.pg.classe].nome.toLowerCase()}`, `${r.pg.nome} è pront${ao(r.pg)} all'avventura!`);
      if (this.tuttiPronti() && !this.inRipresa) this.iniziaAvventura();
      return { ok: true };
    }
    if (a.tipo === 'suggerisci') {
      // "scegli tu per me" in un passaggio della creazione: il server completa le scelte mancanti e le rimanda
      const s = a.scelte && typeof a.scelte === 'object' ? { ...a.scelte } : {};
      s.livello = this.livelloIniziale;
      if (this.cp) this.scelteIncubo(s);
      if (s.metodo === 'dadi') s.tirati = this.tirati[p] ? this.tirati[p].valori : null;
      try { this.suggerite[p] = { n: (this.suggerite[p] ? this.suggerite[p].n : 0) + 1, scelte: R.completaScelte(s) }; } catch (err) { return { errore: 'Non riesco a scegliere: prova a cambiare qualcosa' }; }
      if (this.cp && !s.nome) { const nomi = this.cp.nomiPg[this.suggerite[p].scelte.genere === 'f' ? 'f' : 'm'] || this.cp.nomiPg.m; this.suggerite[p].scelte.nome = nomi[Math.floor(Math.random() * nomi.length)]; }
      return { ok: true };
    }
    if (a.tipo === 'rifai') { if (!this.pg[p]) return { errore: 'Non hai ancora un personaggio' }; this.pg[p] = null; return { ok: true }; }
    if (a.tipo === 'inizia') {
      if (!this.comanda(p)) return { errore: 'Fa partire chi ha aperto il tavolo' };
      // chi non ha finito il personaggio: il computer lo completa
      for (let i = 0; i < this.n; i++) if (!this.pg[i] && i !== this.dm) this.azioneCreazione(i, { tipo: 'crea', casuale: true, scelte: {} });
      if (this.fase === 'creazione') this.iniziaAvventura();
      return { ok: true };
    }
    return { errore: 'Prima create i personaggi' };
  }
  // i compagni del computer scelgono una classe che manca al gruppo
  classeCompagno(p) {
    if (this.cp) return this.classeCompagnoIncubo(p);
    const prese = new Set(this.pg.filter(Boolean).map((x) => x.classe));
    const ruoli = ['guerriero', 'chierico', 'ladro', 'mago', 'ranger', 'paladino', 'bardo', 'druido', 'barbaro', 'stregone', 'warlock', 'monaco'];
    return ruoli.find((c) => !prese.has(c)) || ruoli[p % ruoli.length];
  }
  iniziaAvventura() {
    if (this.modalita === 'reale') { this.fase = 'reale'; this.reale = new TempoReale(this); return; }
    if (this.cp) { this.iniziaIncubo(); return; }
    this.fase = 'avventura';
    // il luogo di partenza
    const nomi = ['Borgo Cenere', 'Vallebruna', 'Porto Salmastro', 'Roccanera', 'Pietrafonda', 'Selvamorta', 'Torre del Corvo', 'Acquachiara'];
    const tipo = this.ambientazione === 'pirati' ? 'porto' : this.ambientazione === 'citta' ? 'citta' : 'villaggio';
    const l = MAP.aggiungiLuogo(this.mondo, { nome: nomi[this.seme % nomi.length], tipo, descrizione: 'Il punto di partenza' }, MAP.rng(this.seme + 1));
    l.visitato = true; this.posizione = l.id; this.mondo.percorso.push(l.id);
    this.scrivi('sistema', `La compagnia è pronta: ${this.pg.filter(Boolean).map((x) => `${x.nome} (${B.STIRPI[x.stirpe].nome} ${CLASSI[x.classe].nome.toLowerCase()} ${x.livello}°)`).join(', ')}.`);
    this.chiediMaster('inizio', `Comincia la campagna. Il gruppo si trova a ${l.nome} (${l.tipo}). ${this.idea ? `Idea per la campagna scritta dal tavolo: «${this.idea}». Seguila.` : 'Inventa tu un inizio originale e coinvolgente, con un aggancio per ogni personaggio (usa le loro storie se ci sono).'} Presenta il luogo, la situazione e un primo mistero o pericolo. Aggiungi il luogo di partenza agli eventi ("luogo" con vaiQui) solo se vuoi rinominarlo; puoi aggiungere altri luoghi vicini che si sentono nominare.`);
  }

  // --- avventura: le dichiarazioni ---
  azioneAvventura(p, a) {
    const pg = this.pg[p];
    if (a.tipo === 'dichiara') {
      if (!pg || pg.morto) return { errore: 'Il tuo personaggio non può agire' };
      const testo = String(a.testo || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
      this.dichiarazioni[p] = testo;
      if (testo) this.scrivi('azione', testo, { posto: p, chi: pg.nome });
      if (!this.primaDichiarazione) this.primaDichiarazione = Date.now();
      if (!this.attesiTutti().length) this.mandaDichiarazioni();
      return { ok: true };
    }
    if (a.tipo === 'cambia') { if (this.dichiarazioni[p] == null) return { errore: 'Non hai ancora scritto niente' }; delete this.dichiarazioni[p]; return { ok: true }; }
    if (a.tipo === 'manda') {
      // chi ha aperto il tavolo può mandare al master senza aspettare gli altri
      if (!this.comanda(p) && Object.keys(this.dichiarazioni).length === 0) return { errore: 'Scrivi prima cosa fai' };
      if (!Object.values(this.dichiarazioni).some((x) => x)) return { errore: 'Nessuno ha scritto niente' };
      this.mandaDichiarazioni();
      return { ok: true };
    }
    if (a.tipo === 'equip') return this.equipaggia(p, a);
    if (a.tipo === 'incubo' && this.cp) return this.azioneIncubo(p, a);
    return { errore: 'Mossa non valida' };
  }
  mandaDichiarazioni() {
    const righe = [];
    for (const i of this.pgVivi()) {
      const t = this.dichiarazioni[i];
      if (this.bot[i]) continue;
      righe.push(`${this.pg[i].nome}: ${t ? t : '(non fa niente di particolare, segue il gruppo)'}`);
    }
    const compagni = this.pgVivi().filter((i) => this.bot[i]).map((i) => this.pg[i].nome);
    this.dichiarazioni = {}; this.primaDichiarazione = null;
    this.chiediMaster('azioni', `Cosa fanno i personaggi dei giocatori:\n${righe.join('\n')}${compagni.length ? `\nI compagni del computer (${compagni.join(', ')}) li fai agire tu.` : ''}\nRispondi: racconta cosa succede (chiedi prove o tiri salvezza se servono, oppure fai partire un combattimento).`);
  }
  equipaggia(p, a) {
    const pg = this.pg[p];
    if (!pg) return { errore: 'Niente personaggio' };
    if (a.armatura !== undefined) {
      if (a.armatura && !B.ARMATURE[a.armatura]) return { errore: 'Armatura sconosciuta' };
      if (a.armatura && !(pg.armatureAvute || []).includes(a.armatura) && pg.armatura !== a.armatura) return { errore: 'Non hai quell\'armatura' };
      if (pg.armatura) pg.armatureAvute = [...new Set([...(pg.armatureAvute || []), pg.armatura])];
      pg.armatura = a.armatura || null;
    }
    if (a.scudo !== undefined) pg.scudo = !!a.scudo && (pg.scudoAvuto || pg.scudo);
    R.ricalcola(pg);
    return { ok: true };
  }

  // --- il master ---
  contesto() {
    const luogo = this.mondo.luoghi.find((l) => l.id === this.posizione);
    const gruppo = this.pg.map((p, i) => (p ? `- ${R.schedaBreve(p)}${this.bot[i] ? ' [compagno del computer: lo interpreti tu]' : ''}${p.ispirazione ? ' [ha l\'ispirazione]' : ''}` : null)).filter(Boolean).join('\n');
    const luoghi = this.mondo.luoghi.map((l) => `${l.nome} (${l.tipo}${l.visitato ? ', visitato' : ''})${l.descrizione ? `: ${l.descrizione.slice(0, 120)}` : ''}`).join('; ');
    const png = this.png.slice(-25).map((x) => `${x.nome} (${x.atteggiamento || 'neutrale'}): ${x.descrizione.slice(0, 140)}`).join('\n');
    const miss = this.missioni.map((m) => `${m.titolo} [${m.stato}]: ${m.descrizione.slice(0, 160)}`).join('\n');
    const storia = this.storia.slice(-12).map((s) => `${s.ruolo === 'master' ? 'MASTER' : 'GIOCATORI'}: ${s.testo}`).join('\n\n');
    return `IL GRUPPO\n${gruppo}\n\nLUOGO ATTUALE: ${luogo ? `${luogo.nome} (${luogo.tipo})${luogo.descrizione ? ` — ${luogo.descrizione}` : ''}` : 'sconosciuto'}\nLUOGHI NOTI: ${luoghi || 'nessuno'}\n\nPERSONAGGI NON GIOCANTI INCONTRATI:\n${png || 'nessuno'}\n\nMISSIONI:\n${miss || 'nessuna'}${this.cp ? this.contestoIncubo() : ''}\n\nDIARIO DELLA CAMPAGNA:\n${this.diario || '(appena cominciata)'}\n\nSTORIA RECENTE:\n${storia || '(niente)'}`;
  }
  sistema() {
    const base = MASTER.istruzioni({ ambientazione: this.cp ? 'oscura' : this.ambientazione, pazza: this.pazza, difficolta: this.difficolta, lunghezza: this.lunghezza, regoleBrevi: MASTER.regoleBrevi(this.cp ? Object.fromEntries(Object.entries(MOSTRI).filter(([, m]) => (m.tema || []).includes(this.cp.id))) : Object.fromEntries(Object.entries(MOSTRI).filter(([, m]) => !m.tema)), B.CONDIZIONI) });
    return this.cp ? INC.istruzioniIncubo(base, this.cp) : base;
  }
  chiediMaster(tipo, richiesta, { ia = false } = {}) {
    this.ultimaRichiesta = { tipo, richiesta, ia };
    this.erroreIA = null;
    this.attesaIA = true;
    this.storia.push({ ruolo: 'giocatori', testo: richiesta.slice(0, 2500) });
    // c'è un master umano: la richiesta aspetta lui (dm.js)
    if (!ia && this.dmUmano) { this.attesaDM = { id: ++this.nDM, tipo, richiesta, da: Date.now() }; return; }
    this.chiamaMaster();
  }
  // la risposta dell'IA (o del master di riserva) alla richiesta, senza applicarla
  promessaMaster(tipo, richiesta) {
    const messaggio = `${this.contesto()}\n\n=== ADESSO ===\n${richiesta}`;
    const lv = Math.round(this.pgVivi().reduce((s, i) => s + this.pg[i].livello, 0) / Math.max(1, this.pgVivi().length));
    return this.chiave && this.fetch
      ? MASTER.chiamaGemini({ chiave: this.chiave, sistema: this.sistema(), messaggi: [{ ruolo: 'giocatori', testo: messaggio }], fetch: this.fetch, maxToken: this.lunghezza === 'lunghe' ? 6000 : 4096 }).then((r) => (r.errore ? { errore: r.errore } : MASTER.leggiRisposta(r.testo)))
      : this.cp ? Promise.resolve(this.masterRiservaIncubo(tipo))
      : Promise.resolve(MASTER.masterRiserva({ pazza: this.pazza, inizio: tipo === 'inizio', esiti: tipo === 'esiti' ? this.ultimiEsiti : null, livello: lv, luogo: (this.mondo.luoghi.find((l) => l.id === this.posizione) || {}).nome }));
  }
  chiamaMaster() {
    const io = this.ultimaRichiesta;
    this.attesaIA = true;
    const fai = this.promessaMaster(io.tipo, io.richiesta);
    fai.then((r) => { if (this.ultimaRichiesta !== io) return; this.attesaIA = false; if (r.errore) { this.erroreIA = r.errore; this.tentativi++; this.storia.pop(); } else { this.tentativi = 0; this.rispostaIA = r; } })
      .catch(() => { this.attesaIA = false; this.erroreIA = 'il master non risponde'; this.tentativi++; this.storia.pop(); });
  }
  ripeti() { const u = this.ultimaRichiesta; if (!u) return; this.erroreIA = null; this.chiediMaster(u.tipo, u.richiesta, { ia: u.ia }); }
  applicaRisposta(r) {
    const tipo = this.ultimaRichiesta ? this.ultimaRichiesta.tipo : null;
    this.ultimaRichiesta = null;
    if (r.narrazione) { this.scrivi('master', r.narrazione); this.storia.push({ ruolo: 'master', testo: r.narrazione.slice(0, 3000) }); }
    if (this.storia.length > 40) this.storia.splice(0, this.storia.length - 40);
    if (r.diario) this.diario = r.diario;
    if (r.atmosfera) this.atmosfera = r.atmosfera;
    this.scelte = r.scelte || [];
    this.applicaEventi(r.eventi || []);
    if (this.finita) return;
    if (!this.umaniVivi().length) { this.tuttiMorti(); return; }
    // prove e tiri salvezza
    const prove = [];
    for (const x of r.prove || []) {
      const tipo = norm(x.tipo).replace(/\s+/g, '');
      const tipoOk = B.ABILITA[tipo] ? tipo : B.CARATTERISTICHE[tipo] ? tipo : Object.keys(B.ABILITA).find((k) => norm(B.ABILITA[k].nome).replace(/\s+/g, '') === tipo) || Object.keys(B.CARATTERISTICHE).find((k) => norm(B.CARATTERISTICHE[k].nome) === tipo);
      if (!tipoOk) continue;
      for (const posto of this.chiDi(x.chi)) prove.push({ posto, tipo: tipoOk, cd: Math.max(1, Math.min(35, Number(x.cd) || 12)), vantaggio: !!x.vantaggio, svantaggio: !!x.svantaggio, motivo: String(x.motivo || '').slice(0, 200) });
    }
    for (const x of r.salvezze || []) {
      const car = B.CARATTERISTICHE[norm(x.car).slice(0, 3)] ? norm(x.car).slice(0, 3) : null;
      if (!car) continue;
      for (const posto of this.chiDi(x.chi)) prove.push({ posto, tipo: car, salvezza: true, cd: Math.max(1, Math.min(35, Number(x.cd) || 12)), danno: x.danno && /^[\dd+\- ]+$/i.test(String(x.danno)) ? String(x.danno).replace(/\s/g, '') : null, tipoDanno: B.TIPI_DANNO[x.tipoDanno] ? x.tipoDanno : 'contundente', meta: x.meta !== false, condizione: B.CONDIZIONI[x.condizione] ? x.condizione : null, motivo: String(x.motivo || '').slice(0, 200) });
    }
    if (prove.length) {
      this.prove = prove.map((x, k) => ({ id: k + 1, ...x, esito: null }));
      this.fase = 'prove';
      return;
    }
    if (r.combattimento) { this.iniziaCombattimento(r.combattimento); return; }
    this.fase = 'avventura';
    // horror: ogni scambio col master fa passare il tempo (la creatura si muove)
    if (this.cp && this.fase === 'avventura') { if (this.cacciatoreArriva) { this.cacciatoreArriva = false; this.incontroCacciatore(); } else if (tipo === 'azioni') this.passaTempo(); }
  }
  applicaEventi(eventi) {
    for (const e of eventi) {
      if (!e || typeof e !== 'object') continue;
      const t = String(e.tipo || '');
      const chi = this.chiDi(e.chi);
      try {
        if (this.cp && this.eventoIncubo(e, t, chi)) continue;
        if (t === 'danno') for (const k of chi) { const pg = this.pg[k]; const q = R.tira(e.danno || '1d6').totale; const sub = R.applicaDanno(pg, q, B.TIPI_DANNO[e.tipoDanno] ? e.tipoDanno : 'contundente', {}); this.scrivi('tiro', `${pg.nome} subisce ${sub} danni${e.tipoDanno ? ` da ${e.tipoDanno}` : ''}${e.motivo ? ` (${e.motivo})` : ''}.${pg.morto ? ` È MORT${ao(pg, 'O', 'A')}.` : pg.pf <= 0 ? ' Cade a terra!' : ''}`, { posto: k }); }
        else if (t === 'cura') for (const k of chi) { const pg = this.pg[k]; const q = R.cura(pg, R.tira(e.cura || '1d8').totale); this.scrivi('tiro', `${pg.nome} recupera ${q} punti ferita.`, { posto: k }); }
        else if (t === 'condizione') for (const k of chi) { const pg = this.pg[k]; const c = norm(e.condizione); if (!B.CONDIZIONI[c]) continue; if (e.togli) pg.condizioni = pg.condizioni.filter((x) => x !== c); else if (!pg.condizioni.includes(c)) pg.condizioni.push(c); if (c === 'esausto' && !e.togli) pg.esaurimento = Math.min(6, pg.esaurimento + 1); }
        else if (t === 'oggetto') for (const k of chi.slice(0, 1)) this.daiOggetto(this.pg[k], e);
        else if (t === 'perdiOggetto') for (const k of [this.unoDi(e.chi)].filter((x) => x >= 0)) { const pg = this.pg[k]; const o = pg.oggetti.find((x) => norm(x.nome) === norm(e.nome)) || pg.oggetti.find((x) => norm(x.nome).includes(norm(e.nome))); if (o) { o.n -= Math.max(1, Number(e.n) || 1); if (o.n <= 0) pg.oggetti = pg.oggetti.filter((x) => x !== o); } }
        else if (t === 'oro') {
          // un nome che non è di nessuno: le monete vanno al gruppo (prima sparivano); il resto della divisione ai primi
          const q = Math.max(-1e6, Math.min(this.tettoOro(), Math.round(Number(e.quantita) || 0)));
          const lista = chi.length ? chi : this.pgVivi();
          if (lista.length > 1) { const parte = Math.trunc(q / lista.length), resto = q - parte * lista.length; lista.forEach((k, j) => { this.pg[k].oro = Math.max(0, this.pg[k].oro + parte + (j < Math.abs(resto) ? Math.sign(resto) : 0)); }); this.scrivi('sistema', `${q >= 0 ? '+' : ''}${q} monete d'oro al gruppo (${resto ? `circa ${parte}` : parte} a testa).`); } else for (const k of lista) { this.pg[k].oro = Math.max(0, this.pg[k].oro + q); this.scrivi('sistema', `${this.pg[k].nome}: ${q >= 0 ? '+' : ''}${q} monete d'oro.`); }
        }
        else if (t === 'px') this.daiPx(Math.max(0, Math.min(this.tettoPx(), Math.round(Number(e.quantita) || 0))), e.motivo);
        else if (t === 'riposo') this.riposa(e.durata === 'lungo' ? 'lungo' : 'breve');
        else if (t === 'luogo') {
          const l = MAP.aggiungiLuogo(this.mondo, { nome: e.nome, tipo: e.luogoTipo || e.tipoLuogo || e.categoria, descrizione: e.descrizione, vicinoA: this.posizione }, Math.random);
          if (l && (e.vaiQui || e.vai)) { l.visitato = true; this.posizione = l.id; if (this.mondo.percorso[this.mondo.percorso.length - 1] !== l.id) this.mondo.percorso.push(l.id); this.scrivi('sistema', `📍 ${l.nome}`); }
        }
        else if (t === 'png') { const nome = String(e.nome || '').slice(0, 40); if (!nome) continue; const x = this.png.find((q) => norm(q.nome) === norm(nome)); const d = { nome, descrizione: String(e.descrizione || (x && x.descrizione) || '').slice(0, 400), atteggiamento: ['amico', 'neutrale', 'ostile'].includes(e.atteggiamento) ? e.atteggiamento : (x ? x.atteggiamento : 'neutrale') }; if (x) Object.assign(x, d); else this.png.push(d); if (this.png.length > 60) this.png.shift(); }
        else if (t === 'missione') { const titolo = String(e.titolo || '').slice(0, 80); if (!titolo) continue; const x = this.missioni.find((q) => norm(q.titolo) === norm(titolo)); const st = ['nuova', 'aggiornata', 'completata', 'fallita'].includes(e.stato) ? e.stato : 'nuova'; if (x) { x.stato = st === 'nuova' ? 'aggiornata' : st; if (e.descrizione) x.descrizione = String(e.descrizione).slice(0, 400); } else this.missioni.push({ titolo, descrizione: String(e.descrizione || '').slice(0, 400), stato: st }); this.scrivi('sistema', `📜 Missione ${st === 'completata' ? 'completata' : st === 'fallita' ? 'fallita' : st === 'aggiornata' ? 'aggiornata' : 'nuova'}: ${titolo}`); }
        else if (t === 'ispirazione') for (const k of [this.unoDi(e.chi)].filter((x) => x >= 0)) { this.pg[k].ispirazione = true; this.scrivi('sistema', `✨ ${this.pg[k].nome} riceve l'ispirazione!`); }
        else if (t === 'morte') for (const k of [this.unoDi(e.chi)].filter((x) => x >= 0 && !this.pg[x].morto)) { this.pg[k].morto = true; this.pg[k].pf = 0; this.scrivi('sistema', `💀 ${this.pg[k].nome} è mort${ao(this.pg[k])}.`); }
      } catch (err) { /* un evento sbagliato non ferma gli altri */ }
    }
    for (const pg of this.pg) if (pg) R.ricalcola(pg);
  }
  // i tetti ai regali del master (un giocatore può scrivere «trovo un milione di monete» e l'IA assecondarlo):
  // l'esperienza di un evento fa salire al massimo di un livello, l'oro cresce col livello del gruppo
  livelloMedio() { const v = this.pgVivi(); return Math.max(1, Math.round(v.reduce((s, i) => s + this.pg[i].livello, 0) / Math.max(1, v.length))); }
  tettoPx() { const l = Math.min(19, this.livelloMedio()); return Math.max(100, R.PX_LIVELLO[l] - R.PX_LIVELLO[l - 1]); }
  tettoOro() { const l = this.livelloMedio(); return Math.max(250, 250 * l * l); }
  daiOggetto(pg, e) {
    const nome = String(e.nome || '').slice(0, 60);
    if (!nome) return;
    const n = Math.max(1, Math.min(99, Number(e.n) || 1));
    const base = B.ARMI[e.arma] ? e.arma : null;
    if (base) {
      // un'arma (anche magica): diventa un attacco
      pg.armiMagiche = pg.armiMagiche || [];
      const bonus = Math.max(0, Math.min(3, Number(e.bonus) || 0));
      if (bonus || norm(nome) !== norm(B.ARMI[base].nome)) pg.armiMagiche.push({ id: `mag${pg.armiMagiche.length + 1}`, base, nome, bonus, descrizione: String(e.descrizione || '').slice(0, 300) });
      else pg.armi.push(base);
    } else if (B.ARMATURE[e.armatura]) {
      if (e.armatura === 'scudo') pg.scudoAvuto = true; else pg.armatureAvute = [...new Set([...(pg.armatureAvute || []), e.armatura])];
    }
    const x = pg.oggetti.find((o) => norm(o.nome) === norm(nome));
    if (x) x.n += n; else pg.oggetti.push({ nome, n, descrizione: String(e.descrizione || '').slice(0, 300) });
    this.scrivi('sistema', `🎒 ${pg.nome} ottiene: ${nome}${n > 1 ? ` ×${n}` : ''}.`);
  }
  daiPx(q, motivo) {
    if (!q) return;
    const vivi = this.pgVivi();
    this.scrivi('sistema', `⭐ +${q} punti esperienza a testa${motivo ? ` (${motivo})` : ''}.`);
    for (const k of vivi) {
      const pg = this.pg[k];
      const prima = pg.livello;
      R.aggiungiPx(pg, q);
      if (pg.livello > prima) { this.scrivi('sistema', `🎉 ${pg.nome} sale al ${pg.livello}° livello! (PF ${pg.pfMax})`, { posto: k }); this.annuncia(k, `sale al ${pg.livello}° livello! 🎉`, `sali al ${pg.livello}° livello! 🎉`, true); }
    }
  }
  riposa(tipo) {
    for (const k of this.pgVivi()) R.riposo(this.pg[k], tipo);
    this.scrivi('sistema', tipo === 'lungo' ? '🌙 Riposo lungo: punti ferita, slot e risorse recuperati.' : '☕ Riposo breve: dadi vita spesi e risorse brevi recuperate.');
  }

  // --- prove e tiri salvezza ---
  azioneProve(p, a) {
    if (a.tipo !== 'tira') return { errore: 'Prima tirate i dadi richiesti dal master' };
    const x = this.prove.find((q) => q.posto === p && !q.esito && (a.id == null || q.id === Number(a.id)));
    if (!x) return { errore: 'Non hai tiri da fare' };
    const pg = this.pg[p];
    // il trucco segreto (!win + parola segreta): questo tiro è un 20 naturale
    const opz = { cd: x.cd, vantaggio: x.vantaggio || (a.ispirazione && pg.ispirazione), svantaggio: x.svantaggio || !!(this.incubo && this.incubo.stato[p].paura >= 7), venti: T.consuma(this, p) };
    if (a.ispirazione && pg.ispirazione) pg.ispirazione = false;
    const isp = (pg.effetti || []).find((e) => e.effetto === 'ispirato');
    if (isp && a.bardica) { opz.ispirazione = isp.dado; pg.effetti = pg.effetti.filter((e) => e !== isp); }
    const r = x.salvezza ? R.salvezza(pg, x.tipo, opz) : R.prova(pg, x.tipo, opz);
    x.esito = { totale: r.totale, d20: r.d20, bonus: r.bonus, riuscita: r.riuscita, naturale: r.naturale };
    let dopo = '';
    if (x.salvezza && x.danno) { const tot = R.tira(x.danno).totale; const q = r.riuscita ? (x.meta ? Math.floor(tot / 2) : 0) : tot; if (q) { const sub = R.applicaDanno(pg, q, x.tipoDanno, {}); dopo = ` → ${sub} danni da ${x.tipoDanno}${pg.pf <= 0 ? (pg.morto ? `, MORT${ao(pg, 'O', 'A')}` : ', a terra!') : ''}`; } }
    if (x.salvezza && !r.riuscita && x.condizione && !pg.condizioni.includes(x.condizione)) { pg.condizioni.push(x.condizione); dopo += ` → ${x.condizione}`; }
    const dadi = r.d20.dadi.length > 1 ? `[${r.d20.dadi.join(', ')}] ${r.d20.modo}` : `${r.d20.valore}`;
    this.scrivi('tiro', `🎲 ${pg.nome}, ${r.nomeTipo}: ${dadi} ${R.segno(r.bonus)}${(r.extra || []).length ? ` (${r.extra.join(', ')})` : ''} = ${r.totale} contro CD ${x.cd}: ${r.riuscita ? 'RIUSCITA' : 'fallita'}${r.naturale === 20 ? ' (20 naturale!)' : r.naturale === 1 ? ' (1 naturale…)' : ''}${dopo}`, { posto: p, dado: r.d20.valore, riuscita: r.riuscita });
    if (this.prove.every((q) => q.esito)) {
      const esiti = this.prove.map((q) => ({ chi: this.pg[q.posto].nome, tipo: q.salvezza ? `tiro salvezza su ${B.CARATTERISTICHE[q.tipo].nome}` : (B.ABILITA[q.tipo] || B.CARATTERISTICHE[q.tipo]).nome, cd: q.cd, totale: q.esito.totale, riuscita: q.esito.riuscita, naturale: q.esito.naturale, motivo: q.motivo }));
      this.ultimiEsiti = esiti;
      this.prove = []; this.fase = 'avventura';
      this.chiediMaster('esiti', `Risultati dei tiri:\n${esiti.map((e) => `${e.chi} — ${e.tipo} (CD ${e.cd})${e.motivo ? ` per ${e.motivo}` : ''}: ${e.totale}, ${e.riuscita ? 'RIUSCITO' : 'FALLITO'}${e.naturale === 20 ? ' con un 20 naturale' : e.naturale === 1 ? ' con un 1 naturale' : ''}`).join('\n')}\nStato attuale dei personaggi già aggiornato nella scheda (punti ferita, condizioni). Racconta cosa succede.`);
    }
    return { ok: true };
  }

  // --- combattimento ---
  iniziaCombattimento(def) {
    const nemici = [];
    for (const n of (Array.isArray(def.nemici) ? def.nemici : []).slice(0, 12)) {
      const quanti = Math.max(1, Math.min(10, Number(n && n.n) || 1));
      for (let k = 0; k < quanti && nemici.length < 16; k++) { const m = R.mostroDa(n && n.id && MOSTRI[n.id] ? n : n && n.id && !MOSTRI[n.id] && !n.attacchi ? (Object.values(MOSTRI).find((x) => norm(x.nome) === norm(n.id)) || null) : n); if (m) { if (quanti > 1) m.nome = `${m.nome} ${k + 1}`; nemici.push(m); } }
    }
    if (!nemici.length) { this.fase = 'avventura'; return; }
    const luogo = this.mondo.luoghi.find((l) => l.id === this.posizione);
    const qui = this.cp ? this.scenaIncubo(def) : null;
    const stile = qui ? qui.stile : MAP.STILI_SCENA.includes(def.scena) ? def.scena : STILE_DA_LUOGO[luogo && luogo.tipo] || 'foresta';
    const grande = nemici.length + this.pgVivi().length > 10;
    const scena = MAP.scena(stile, Math.floor(Math.random() * 1e9), { w: grande ? 36 : 30, h: grande ? 22 : 20, luce: qui ? qui.luce : ['giorno', 'buio', 'torce'].includes(def.luce) ? def.luce : null });
    const gruppo = this.pgVivi().map((k) => this.pg[k]);
    for (const p of gruppo) { p.condizioni = p.condizioni.filter((x) => x !== 'prono'); }
    this.combattimento = new Combattimento({ scena, gruppo, nemici, sorpresa: def.sorpresa === 'gruppo' || def.sorpresa === 'nemici' ? def.sorpresa : null, livelloIA: this.livelloIA(), pazza: this.pazza });
    // il trucco segreto: il prossimo d20 (attacco, tiro salvezza, prova) del personaggio di chi l'ha attivato è un 20
    this.combattimento.venti = (c) => { const k = this.pg.indexOf(c.ref); return k >= 0 && T.consuma(this, k); };
    if (this.cp) { this.combattimento.horror = true; this.combattimento.rumore = this.incubo.rumore; this.combattimento.fuocoImparato = this.incubo.mente ? this.incubo.mente.abitudini.fuoco : 0; this.combattimento.senzaArmi = !this.cp.armi; }
    this.metaCombattimento = { nemici: nemici.map((m) => m.nome), inizio: Date.now() };
    this.scenaVista = scena;
    this.fase = 'combattimento';
    this.roundRaccontato = 1;
    this.prossimaMossaMostro = Date.now() + 1500;
    this.scrivi('sistema', `⚔️ Combattimento! Contro: ${nemici.map((m) => m.nome).join(', ')}.`);
    this.atmosfera = 'battaglia';
  }
  creaturaDi(p) { const pg = this.pg[p]; return pg && this.combattimento ? this.combattimento.creature.find((c) => c.ref === pg) : null; }
  azioneCombattimento(p, a) {
    const cb = this.combattimento;
    if (!cb || cb.finito) return { errore: 'Il combattimento è finito' };
    const c = this.creaturaDi(p);
    if (a.tipo === 'autoTurno') { if (!c || cb.attivo !== c) return { errore: 'Non è il tuo turno' }; cb.turnoAutomatico(this.bot[p] || 'medio'); this.dopoAzioneCombattimento(); return { ok: true }; }
    if (!c || cb.attivo !== c) return { errore: 'Non è il turno del tuo personaggio' };
    if (a.tipo === 'libera') return this.azioneLibera(p, c, a);
    let r;
    if (a.tipo === 'muovi') r = cb.muovi(c.id, a.x, a.y);
    else if (a.tipo === 'attacca') r = cb.attacca(c.id, a.bersaglio, { arma: a.arma, punizione: a.punizione, dueMani: !!a.dueMani });
    else if (a.tipo === 'lancia') r = cb.lancia(c.id, a.inc, { slot: a.slot, bersagli: a.bersagli || (a.bersaglio ? [a.bersaglio] : []), punto: a.punto });
    else if (a.tipo === 'azione') r = cb.azioneSemplice(c.id, a.az, a);
    else if (a.tipo === 'fine') r = cb.fineTurno(c.id);
    else return { errore: 'Mossa non valida' };
    if (r && r.errore) return r;
    this.dopoAzioneCombattimento();
    return { ok: true };
  }
  // AZIONE LIBERA in combattimento: il giocatore scrive qualsiasi cosa (spingere un nemico nel fuoco, far crollare una
  // colonna, convincerlo ad arrendersi…). Usa l'azione; il gioco tira un d20 e il master decide l'esito secondo le
  // regole, con danni, cure e condizioni che il gioco applica alle creature sulla mappa.
  azioneLibera(p, c, a) {
    const cb = this.combattimento, pg = this.pg[p];
    const testo = String(a.testo || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!testo) return { errore: 'Scrivi cosa vuoi fare' };
    if (!c.turno.azione) return { errore: 'Hai già usato l\'azione' };
    if (this.attesaLibera) return { errore: 'Il master sta ancora decidendo l\'azione di prima' };
    c.turno.azione = false;
    const d20 = R.d20({ venti: T.consuma(this, p) }).valore;
    cb.evento({ tipo: 'nota', id: c.id, testo: `${pg.nome} tenta: «${testo}» (d20: ${d20})` });
    this.scrivi('azione', testo, { posto: p, chi: pg.nome, combattimento: true });
    // c'è un master umano: decide lui (il combattimento intanto va avanti)
    if (this.dmUmano) { this.attesaLibera = true; this.liberaDM = { chi: pg.nome, testo, d20, c, cb }; this.dopoAzioneCombattimento(); return { ok: true }; }
    this.chiediLiberaIA({ chi: pg.nome, testo, d20, c, cb });
    this.dopoAzioneCombattimento();
    return { ok: true };
  }
  chiediLiberaIA({ chi, testo, d20, c, cb }) {
    const pg = c.ref;
    if (!(this.chiave && this.fetch)) { cb.evento({ tipo: 'nota', id: c.id, testo: d20 >= 11 ? 'Riesce, ma senza effetti sulle regole (senza IA il master di riserva non può giudicarlo).' : 'Non riesce.' }); this.attesaLibera = false; return; }
    const creature = cb.creature.filter((x) => cb.vivo(x)).map((x) => `${x.ref.nome} (${x.lato === 'gruppo' ? 'gruppo' : 'nemico'}, ${x.ref.pf}/${x.ref.pfMax} PF, CA ${x.ref.ca}, a ${cb.dist(c, x)} m da ${pg.nome}${x.ref.condizioni && x.ref.condizioni.length ? `, ${x.ref.condizioni.join(', ')}` : ''})`).join('; ');
    const msg = `COMBATTIMENTO IN CORSO (round ${cb.round}). Al suo turno ${chi} usa la sua azione per fare una cosa non prevista dai pulsanti: «${testo}».\nIl gioco ha già tirato per lui un d20 = ${d20} (aggiungi tu il modificatore giusto dalla sua scheda e confronta con una CD sensata, o con la CA/tiro salvezza del bersaglio).\nCreature sulla mappa: ${creature}.\nDecidi l'esito secondo le regole e rispondi SOLO con JSON: {"narrazione": "3-5 frasi vivide e senza censure", "riuscita": true/false, "effetti": [{"bersaglio": "nome esatto della creatura", "danno": "2d6", "tipoDanno": "contundente", "cura": null, "condizione": "prono|afferrato|accecato|spaventato|stordito|trattenuto|avvelenato|incapacitato|null", "turni": 1}]}. Niente effetti se l'azione non riesce o non ha senso.`;
    this.attesaLibera = true;
    const io = cb;
    MASTER.chiamaGemini({ chiave: this.chiave, sistema: this.sistema(), messaggi: [{ ruolo: 'giocatori', testo: `${this.contesto()}\n\n=== ADESSO ===\n${msg}` }], fetch: this.fetch, maxToken: 1500 })
      .then((x) => { this.attesaLibera = false; if (x.errore || this.combattimento !== io) return; let o = null; const t = String(x.testo || ''); try { const i = t.indexOf('{'), j = t.lastIndexOf('}'); o = JSON.parse(t.slice(i, j + 1)); } catch (e) { o = { narrazione: MASTER.leggiRisposta(t).narrazione }; } this.liberaPronta = { o, c, cb: io }; })
      .catch(() => { this.attesaLibera = false; });
  }
  applicaLibera() {
    const { o, c, cb } = this.liberaPronta; this.liberaPronta = null;
    if (!o || this.combattimento !== cb) return;
    if (o.narrazione) this.scrivi('master', String(o.narrazione).slice(0, 3000), { combattimento: true });
    const trova = (nome) => { const n = norm(nome); return cb.creature.find((x) => cb.vivo(x) && norm(x.ref.nome) === n) || cb.creature.find((x) => cb.vivo(x) && n && (norm(x.ref.nome).startsWith(n) || n.startsWith(norm(x.ref.nome)))); };
    const esiti = [];
    for (const e of (Array.isArray(o.effetti) ? o.effetti : []).slice(0, 6)) {
      const b = e && trova(e.bersaglio); if (!b) continue;
      try {
        if (e.danno && /^[\dd+\- ]+$/i.test(String(e.danno))) { const q = cb.danneggia(b, R.tira(String(e.danno).replace(/\s/g, '')).totale, B.TIPI_DANNO[e.tipoDanno] ? e.tipoDanno : 'contundente', { da: c }); esiti.push(`${b.ref.nome} −${q} PF`); cb.evento({ tipo: 'attacco', da: c.id, a: b.id, arma: 'azione libera', colpito: true, danno: q, testo: `${b.ref.nome} subisce ${q} danni.` }); }
        if (e.cura && /^[\dd+\- ]+$/i.test(String(e.cura))) { const q = R.cura(b.ref, R.tira(String(e.cura).replace(/\s/g, '')).totale); cb.evento({ tipo: 'cura', id: b.id, quanti: q, testo: `${b.ref.nome} recupera ${q} PF.` }); }
        const cond = norm(e.condizione); if (B.CONDIZIONI[cond]) { cb.mettiCondizione(b, cond, { da: c.id, turni: Math.max(1, Math.min(10, Number(e.turni) || 1)) }); cb.evento({ tipo: 'nota', id: b.id, testo: `${b.ref.nome}: ${cond}.` }); }
      } catch (err) { /* un effetto sbagliato non ferma gli altri */ }
    }
    if (!esiti.length && o.riuscita === false) cb.evento({ tipo: 'nota', id: c.id, testo: `Il tentativo di ${c.ref.nome} non riesce.` });
    cb.controllaFine();
  }
  dopoAzioneCombattimento() {
    const cb = this.combattimento;
    if (!cb) return;
    if (this.cp) this.rumoreInCombattimento();
    if (cb.attivo && !cb.attivo.pg && this.prossimaMossaMostro < Date.now() + 600) this.prossimaMossaMostro = Date.now() + 900;
    // racconto dei round appena finiti, due alla volta (in sottofondo, il combattimento non aspetta): un racconto per
    // ogni round faceva tante chiamate a Gemini e finiva presto il limite di richieste
    if (cb.round >= this.roundRaccontato + ROUND_PER_RACCONTO && this.chiave && this.fetch && !this.attesaRacconto && !this.dmUmano) {
      const r = this.roundRaccontato, fino = cb.round - 1; this.roundRaccontato = cb.round;
      const fatti = cb.eventi.filter((e) => e.round >= r && e.round <= fino && e.testo && !['turno', 'round'].includes(e.tipo)).map((e) => e.testo).slice(-40);
      if (fatti.length) {
        this.attesaRacconto = true;
        const msg = `Combattimento in corso (${r === fino ? `round ${r}` : `round ${r}-${fino}`}). Ecco cosa è successo secondo le regole (già deciso, non cambiarlo):\n${fatti.join('\n')}\nRaccontalo in modo vivido e cinematografico, in 3-6 frasi, senza aggiungere esiti diversi. Rispondi in JSON con solo {"narrazione": "…"}.`;
        MASTER.chiamaGemini({ chiave: this.chiave, sistema: this.sistema(), messaggi: [{ ruolo: 'giocatori', testo: `${this.contesto()}\n\n=== ADESSO ===\n${msg}` }], fetch: this.fetch, maxToken: 1200 })
          .then((x) => { this.attesaRacconto = false; if (!x.errore) this.raccontoPronto = MASTER.leggiRisposta(x.testo); })
          .catch(() => { this.attesaRacconto = false; });
      }
    } else if (cb.round > this.roundRaccontato && (!this.chiave || !this.fetch || this.dmUmano)) this.roundRaccontato = cb.round;
    if (cb.finito) this.prossimaMossaMostro = Date.now() + 1500;
  }
  fineCombattimento() {
    const cb = this.combattimento;
    const esito = cb.finito;
    const px = cb.pxGuadagnati();
    const vivi = this.pgVivi();
    // dopo la battaglia: niente più effetti brevi, chi è a terra resta svenuto (ma stabile se non è morto)
    for (const k of vivi) {
      const pg = this.pg[k];
      pg.effetti = pg.effetti.filter((e) => e.durataTurni == null || e.durataTurni > 100);
      pg.condizioni = pg.condizioni.filter((x) => !['prono', 'afferrato', 'trattenuto', 'spaventato', 'stordito', 'incapacitato', 'paralizzato', 'illuminato', 'rallentato'].includes(x));
      pg.concentrazione = null;
      if (pg.pf <= 0 && !pg.morto) pg.stabile = true;
      R.ricalcola(pg);
    }
    const nemici = cb.creature.filter((c) => c.lato === 'nemici');
    const riassunto = `${esito === 'vittoria' ? 'VITTORIA' : esito === 'fuga' ? 'FUGA (il gruppo è scappato)' : 'SCONFITTA'} dopo ${cb.round} round. Nemici: ${nemici.map((c) => `${c.ref.nome} (${c.ref.morto ? 'ucciso' : c.fuggito ? 'fuggito' : `${c.ref.pf}/${c.ref.pfMax} PF`})`).join(', ')}. Personaggi: ${this.pg.filter(Boolean).map((p) => `${p.nome} ${p.morto ? 'MORTO' : p.pf <= 0 ? 'svenuto a 0 PF' : `${p.pf}/${p.pfMax} PF`}`).join(', ')}.`;
    this.scrivi('sistema', esito === 'vittoria' ? `🏆 Vittoria! (${cb.round} round)` : esito === 'fuga' ? '🏃 Siete scappati.' : '💀 Il gruppo è stato sconfitto…');
    this.combattimento = null; this.liberaDM = null; this.attesaLibera = false;
    this.fase = 'avventura';
    this.atmosfera = 'calma';
    if (esito === 'vittoria' && px && vivi.length) this.daiPx(Math.round(px / vivi.length), 'il combattimento');
    if (this.cp) this.dopoScontroIncubo(cb, esito);
    if (!this.umaniVivi().length) { this.tuttiMorti(); return; }
    this.chiediMaster('combattimentoFinito', `Il combattimento è finito: ${riassunto}\nRacconta la fine dello scontro e cosa succede dopo (cosa trovano sui nemici, chi è ferito, conseguenze). Se il gruppo ha perso decidi tu il destino: catturati, salvati, lasciati per morti… L'esperienza del combattimento l'ha già data il gioco.`);
  }

  // morte permanente, ma con !revive in chat (server.js) i morti tornano: intanto la campagna aspetta
  tuttiMorti() {
    this.fase = 'caduti'; this.cadutiDa = Date.now(); this.attesaIA = false; this.combattimento = null;
    const soloCompagni = this.pgVivi().length > 0;
    this.scrivi('sistema', `💀 ${soloCompagni ? 'Tutti i personaggi dei giocatori sono morti (restano solo i compagni del computer).' : 'Tutti i personaggi sono morti.'}${this.cp ? ` ${this.cp.morte[Math.floor(Math.random() * this.cp.morte.length)]}` : ''} Scrivete !revive in chat per riportarli in vita, oppure chi ha aperto il tavolo chiude la campagna.`);
  }
  // !revive: i morti tornano in vita con tutti i punti ferita e le stesse cose che avevano
  revive() {
    const morti = this.pg.map((p, i) => (p && (p.morto || p.pf <= 0) ? i : -1)).filter((i) => i >= 0);
    if (!morti.length || this.finita) return 0;
    for (const k of morti) {
      const pg = this.pg[k];
      pg.morto = false; pg.pf = pg.pfMax; pg.stabile = false; pg.morte = { successi: 0, fallimenti: 0 };
      pg.condizioni = pg.condizioni.filter((x) => !['privo', 'prono', 'spaventato', 'paralizzato', 'stordito', 'incapacitato', 'pietrificato'].includes(x));
      R.ricalcola(pg);
      if (this.incubo) this.incubo.stato[k].paura = 0;
      const c = this.creaturaDi(k);
      if (c) { c.fuggito = false; c.x = c.x; }
    }
    this.scrivi('sistema', `✨ !revive: ${morti.map((k) => this.pg[k].nome).join(', ')} ${morti.length > 1 ? 'tornano' : 'torna'} in vita con tutti i punti ferita.`);
    if (this.fase === 'caduti') { this.fase = this.reale ? 'reale' : 'avventura'; this.cadutiDa = null; }
    if (this.reale) this.reale.revive(morti);
    return morti.length;
  }
  chiudi(motivo) {
    this.finita = true;
    this.fase = 'fine';
    this.attesaIA = false;
    this.scrivi('sistema', `🏁 ${motivo}`);
    const posti = Array.from({ length: this.n }, (_, i) => i);
    const vivi = this.pgVivi();
    this.risultato = {
      fazioni: posti.map((i) => ({ posti: [i], punti: this.pg[i] ? this.pg[i].px : 0 })), etichetta: 'PX', pareggio: false,
      vincitori: vivi, titolo: vivi.length ? `Fine della campagna: ${vivi.map((i) => this.pg[i].nome).join(', ')} ${vivi.length > 1 ? 'sopravvivono' : 'sopravvive'}` : 'Fine della campagna: nessun sopravvissuto',
    };
  }

  // ---------- vista ----------
  vista(p) {
    const cb = this.combattimento;
    const mio = this.pg[p] || null;
    return {
      gioco: this.id, n: this.n, fase: this.fase, host: this.host, bot: this.bot.map(Boolean), ambientazione: this.ambientazione, pazza: this.pazza, difficolta: this.difficolta, livelloIniziale: this.livelloIniziale,
      nomiClasse: this.cp ? Object.fromEntries(this.cp.classi.map((k) => [k, CLASSI[k].nome])) : null,
      modalita: this.modalita, incubo: this.cp && this.fase !== 'creazione' ? (p === this.dm ? this.stazioneDm(this.vistaIncubo(p)) : this.vistaIncubo(p)) : this.cp ? { id: this.cp.id, nome: this.cp.nome, icona: this.cp.icona, sottotitolo: this.cp.sottotitolo } : null,
      reale: this.reale ? this.reale.vistaFissa(p) : null,
      // il master umano (dm.js): chi è, e solo a lui le sue cose (richieste, consigli, bestiario, segreti)
      dm: this.dm, dmAuto: this.dmAuto, attesaDM: !!this.attesaDM, dmInfo: this.vistaDm(p),
      // stesso computer: quello che cambia da un giocatore all'altro (il browser mostra quello di chi ha il computer)
      locali: this.locali, perPosto: p === this.host && this.locali.length ? Object.fromEntries(this.locali.map((k) => [k, { suggerite: this.suggerite[k], tirati: this.tirati[k] ? this.tirati[k].valori : null, tiriFatti: this.tirati[k] ? this.tirati[k].volte : 0, mioPg: this.pg[k] ? this.pg[k].uid : null, mioId: this.pg[k] ? this.pg[k].uid : null }])) : null,
      iaAttiva: !!(this.chiave && this.fetch), attesaIA: this.attesaIA, attesaLibera: !!this.attesaLibera, erroreIA: this.erroreIA, idea: this.idea,
      suggerite: this.suggerite[p], tirati: this.tirati[p] ? this.tirati[p].valori : null, tiriFatti: this.tirati[p] ? this.tirati[p].volte : 0,
      pg: this.pg, mioPg: mio ? mio.uid : null,
      racconto: this.racconto.slice(-120), scelte: this.scelte, atmosfera: this.atmosfera,
      dichiarazioni: Object.fromEntries(Object.entries(this.dichiarazioni).map(([k, v]) => [k, v])), primaDichiarazione: this.primaDichiarazione ? Math.max(0, this.primaDichiarazione + ATTESA_DICHIARAZIONI - Date.now()) : null,
      prove: this.prove.map((x) => ({ id: x.id, posto: x.posto, tipo: x.tipo, nome: x.salvezza ? `Tiro salvezza su ${B.CARATTERISTICHE[x.tipo].nome}` : (B.ABILITA[x.tipo] || B.CARATTERISTICHE[x.tipo]).nome, cd: x.cd, vantaggio: x.vantaggio, svantaggio: x.svantaggio, motivo: x.motivo, salvezza: !!x.salvezza, esito: x.esito })),
      mondo: { w: this.mondo.w, h: this.mondo.h, celle: this.mondo.celle, luoghi: this.mondo.luoghi, percorso: this.mondo.percorso, posizione: this.posizione },
      png: this.png, missioni: this.missioni, diario: this.diario,
      combattimento: cb ? { ...cb.vista(), scena: { w: cb.scena.w, h: cb.scena.h, g: cb.scena.g, stile: cb.scena.stile, luce: cb.scena.luce } } : null,
      mioId: mio ? mio.uid : null,
      catalogo: this.fase === 'creazione' ? catalogo(this.cp ? this.cp.id : null) : null,
      incantesimi: this.fase !== 'creazione' ? infoIncantesimi(this.pg) : null,
      pronti: this.pg.map(Boolean), nomiArmature: NOMI_ARMATURE,
      salvataggio: this.vistaSalvataggio(p),
      turno: null, inAttesa: false, finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// i metodi delle ambientazioni horror a turni (con i getter: per questo non Object.assign)
Object.defineProperties(Draghi.prototype, Object.getOwnPropertyDescriptors(INC.metodi));
Object.defineProperties(Draghi.prototype, Object.getOwnPropertyDescriptors(DM.metodi));
Object.defineProperties(Draghi.prototype, Object.getOwnPropertyDescriptors(SALVA.metodi));

const NOMI_ARMATURE = Object.fromEntries(Object.entries(B.ARMATURE).map(([k, v]) => [k, v.nome]));

// ---------- il catalogo per la creazione guidata (si manda solo durante la creazione) ----------
// le ambientazioni horror vedono solo umani, le loro classi e i loro passati; quelle fantasy niente di tutto ciò a tema
const CATALOGO = {};
function catalogo(tema = null) {
  if (CATALOGO[tema]) return CATALOGO[tema];
  const { slotPer, STILI, SUPPLICHE } = require('./draghi/classi');
  const delTema = (x) => (tema ? (x.tema || []).includes(tema) : !x.tema);
  const classi = {};
  for (const [id, c] of Object.entries(CLASSI)) {
    if (!delTema(c)) continue;
    classi[id] = {
      nome: c.nome, desc: c.desc, dado: c.dado, principale: c.principale, salvezze: c.salvezze, armature: c.armature, armi: c.armi, abilita: { n: c.abilita.n, tra: R.listaAbilitaClasse(c) },
      equip: c.equip.map((e) => ({ nome: e.nome, armi: e.armi.map((a) => B.ARMI[a].nome), armatura: e.armatura ? B.ARMATURE[e.armatura].nome : null, scudo: !!e.scudo })),
      magia: c.magia ? { tipo: c.magia.tipo, car: c.magia.car, modo: c.magia.modo, trucchetti: c.magia.trucchetti || null, conosciuti: c.magia.conosciuti || null, mezzo: !!c.magia.mezzo, libro: c.magia.libro || 0, perLivello: c.magia.perLivello || 0, livMax: Array.from({ length: 20 }, (_, l) => slotPer(c.magia.tipo, l + 1).length) } : null,
      privilegi: c.privilegi.map((p) => ({ l: p.l, nome: p.nome, desc: p.desc, stile: !!p.stile, maestria: p.maestria || 0 })),
      sottoclasse: { nome: c.sottoclasse.nome, incantesimi: c.sottoclasse.incantesimi || {}, privilegi: c.sottoclasse.privilegi.map((p) => ({ l: p.l, nome: p.nome, desc: p.desc, stile: !!p.stile, abilitaScelte: p.abilitaScelte || 0 })) },
      aumentiExtra: c.aumentiExtra || [], base: c.base || id, icona: c.icona || null,
    };
  }
  const inc = {};
  for (const [id, x] of Object.entries(INCANTESIMI)) inc[id] = { nome: x.nome, liv: x.liv, scuola: x.scuola, classi: x.classiIds, tempo: x.tempo, gittata: x.gittata, durata: x.durata, conc: !!x.conc, rituale: !!x.rituale, desc: x.desc };
  CATALOGO[tema] = {
    caratteristiche: B.CARATTERISTICHE, ordine: B.ORDINE_CAR, abilita: B.ABILITA, stirpi: tema ? { umano: { ...B.STIRPI.umano, nomi: H.CAMPAGNE[tema].nomiPg || B.STIRPI.umano.nomi } } : B.STIRPI, discendenze: B.DISCENDENZE,
    background: Object.fromEntries(Object.entries(B.BACKGROUND).filter(([, x]) => delTema(x))),
    classi, incantesimi: inc, stili: STILI, suppliche: SUPPLICHE, aspetto: R.ASPETTO, costoPunti: R.COSTO_PUNTI, standard: R.STANDARD, lingue: B.LINGUE, tema,
  };
  return CATALOGO[tema];
}
// le informazioni sugli incantesimi che conosce il gruppo (per il pannello del combattimento e la scheda)
function infoIncantesimi(pgs) {
  const ids = new Set();
  for (const p of pgs) if (p && p.magia) for (const id of [...p.magia.trucchetti, ...p.magia.incantesimi, ...p.magia.sempre, ...(p.magia.libro || [])]) ids.add(id);
  const out = {};
  for (const id of ids) { const x = INCANTESIMI[id]; if (x) out[id] = { nome: x.nome, liv: x.liv, scuola: x.scuola, tempo: x.tempo, gittata: x.gittata, durata: x.durata, conc: !!x.conc, desc: x.desc, tipo: x.e ? x.e.tipo : 'utilita', area: x.e && x.e.area ? x.e.area : null, bersagli: x.e ? x.e.bersagli || 1 : 1, alleati: x.e ? ['cura', 'buff', 'stabilizza', 'ristora', 'rianima'].includes(x.e.tipo) : false }; }
  return out;
}

// ---------- il computer (compagni e chi è via) ----------
function bot(g, p) {
  // il master umano non risponde (è via o sulle dispense): risponde l'IA
  if (p === g.dm) return g.attesaDM || g.liberaDM ? { tipo: 'dm-ia' } : { tipo: 'nulla' };
  if (g.fase === 'creazione') return { tipo: 'crea', casuale: true, scelte: {} };
  if (g.fase === 'avventura') return { tipo: 'dichiara', testo: '' };
  if (g.fase === 'prove') { const x = g.prove.find((q) => q.posto === p && !q.esito); return { tipo: 'tira', id: x ? x.id : null }; }
  if (g.fase === 'combattimento') return { tipo: 'autoTurno' };
  return { tipo: 'nulla' };
}

module.exports = {
  meta: {
    id: 'draghi',
    nome: 'Draghi e Segrete',
    tipo: 'tabellone',
    giocatori: [1, 2, 3, 4, 5, 6],
    descrizione: 'Il gioco di ruolo fantasy con l\'IA che fa da master: crea il tuo eroe, esplora un mondo che nasce mentre giocate e combatti sulla mappa tattica. Possibilità infinite.',
    postiLiberiAlComputer: true, // si può iniziare con posti vuoti: diventano compagni del computer
    masterUmano: true, // nella sala d'attesa chi ha aperto il tavolo può scegliere chi fa il master (🎩)
    alias: ['draghi e segrete', 'gioco di ruolo', 'gdr', 'dungeons', 'dungeon', 'dragons', 'd&d', 'dnd', 'master', 'avventura', 'fantasy', 'rpg'],
    opzioni: [
      { id: 'ambientazione', nome: 'Ambientazione', valori: ['classica', 'oscura', 'pirati', 'citta', 'selvaggia', 'caso', 'sevastopol', 'pathos', 'manicomio'], etichette: ['Fantasy classico', 'Oscura e horror', 'Mari e pirati', 'Intrighi in città', 'Terre selvagge', 'A sorpresa (fantasy)', '🛰️ Stazione Sevastopol (Alien: Isolation)', '🌊 Base PATHOS-II (SOMA)', '🏚️ Manicomio Mount Massive (Outlast)'], predefinito: 'classica' },
      { id: 'stessoPc', nome: 'Sullo stesso computer (a turni)', valori: [1, 2, 3, 4, 5, 6], etichette: ['Ognuno col suo dispositivo', 'In 2: ci si passa il computer', 'In 3: ci si passa il computer', 'In 4: ci si passa il computer', 'In 5: ci si passa il computer', 'In 6: ci si passa il computer'], predefinito: 1 },
      { id: 'modalita', nome: 'Come si gioca (ambientazioni horror)', valori: ['turni', 'reale'], etichette: ['A turni, col master (classico)', '⏱️ In tempo reale: mappa enorme vista dall\'alto'], predefinito: 'turni' },
      { id: 'pazza', nome: '🤪 Modalità pazza (il master fa ridere)', valori: [false, true], etichette: ['No', 'Sì'], predefinito: false, casella: true },
      { id: 'livello', nome: 'Livello iniziale', valori: [1, 3, 5], etichette: ['1° livello (dall\'inizio)', '3° livello', '5° livello'], predefinito: 1 },
      { id: 'difficolta', nome: 'Difficoltà', valori: ['normale', 'storia', 'mortale'], etichette: ['Normale', 'Storia (combattimenti facili)', 'Mortale'], predefinito: 'normale' },
      { id: 'lunghezza', nome: 'Racconti del master', valori: ['normali', 'brevi', 'lunghe'], etichette: ['Normali', 'Brevi', 'Lunghi e dettagliati'], predefinito: 'normali' },
    ],
    regole: [
      'Un gioco di ruolo fantasy con le regole della 5ª edizione del gioco di ruolo più famoso (le regole libere SRD 5.1). Il MASTER è un\'intelligenza artificiale: racconta, dà voce ai personaggi che incontrate, inventa luoghi, missioni e mostri. Potete fare qualsiasi cosa.',
      'Prima ognuno crea il suo personaggio: stirpe (umano, elfo, nano, halfling, gnomo, mezzelfo, mezzorco, dragonide, tiefling), classe (barbaro, bardo, chierico, druido, guerriero, ladro, mago, monaco, paladino, ranger, stregone, warlock), background, caratteristiche (serie standard, 27 punti o 4d6), abilità, incantesimi, equipaggiamento e aspetto. In ogni passaggio c\'è "scegli tu per me". I posti vuoti diventano compagni del computer.',
      'Chi ha aperto il tavolo può scrivere un\'idea per la campagna (o lasciare che la inventi il master). Il mondo è una mappa a pergamena che si riempie dei luoghi che scoprite.',
      'Il master racconta; ognuno scrive cosa fa il suo personaggio, con parole sue (parlare, cercare, rubare, mentire, attaccare, lanciare un incantesimo…). Quando hanno scritto tutti (o chi ha aperto il tavolo preme "Manda al master", o passano due minuti e mezzo) il master risponde.',
      'Quando l\'esito è incerto il master chiede una PROVA (d20 + abilità contro una difficoltà) o un TIRO SALVEZZA: ognuno tira i suoi dadi con il pulsante. L\'ispirazione dà vantaggio. I conti li fa il gioco, sempre secondo le regole.',
      'COMBATTIMENTO: si passa alla mappa tattica a quadretti (1,5 metri). Iniziativa, poi a turno: movimento, un\'azione (attacco, incantesimo, scatto, disimpegno, schivata, aiuto, nascondersi, pozione…), un\'azione bonus e una reazione. Vantaggio e svantaggio, copertura, attacchi di opportunità, critici, condizioni, concentrazione, aree degli incantesimi: tutto come nelle regole. A 0 punti ferita si cade e si tira contro la morte.',
      'Dopo le battaglie e le missioni si guadagnano punti esperienza e si sale di livello (fino al 20°): più punti ferita, nuovi privilegi e incantesimi.',
      'La campagna dura finché il tavolo è aperto, ma con 💾 (nel Diario) chiunque scarica un file della campagna: per continuare un altro giorno, chi apre un tavolo nuovo (a turni) lo riprende con 📂 prima di cominciare. Chi ha aperto il tavolo può chiudere la campagna quando vuole.',
      'MASTER IN CARNE E OSSA (al tavolo con gli amici, a turni): prima di cominciare chi ha aperto il tavolo tocca il 🎩 accanto a un giocatore, che farà il master al posto dell\'IA (non crea il personaggio). Il master ha la sua schermata: legge cosa fanno i giocatori, racconta, chiede prove e tiri salvezza, fa partire i combattimenti (i nemici li muove il gioco), dà oggetti, oro ed esperienza e giudica le azioni libere; vede la mappa completa, il bestiario e i segreti dell\'ambientazione. L\'IA è il suo consigliere (le chiede regole, idee, nomi, CD), gli scrive una bozza da modificare, risponde al posto suo quando vuole o fa tutto in automatico. Se il master si assenta, risponde l\'IA.',
      'MORTE PERMANENTE: chi muore resta morto. Ma scrivendo !revive in chat (in tutte le modalità) i morti tornano in vita con tutti i punti ferita e le stesse cose che avevano.',
      'AMBIENTAZIONI HORROR (dal menu Ambientazione): la stazione Sevastopol di Alien: Isolation, la base sottomarina PATHOS-II di SOMA, il manicomio Mount Massive di Outlast (senza armi da fuoco: videocamera e batterie). Solo umani, con classi a tema (addetto alla sicurezza, ingegnere, medico, tecnico informatico, sommozzatore, giornalista…). La mappa è fatta di settori collegati da porte, ascensori, tram e condotti; alcune porte si aprono solo con l\'oggetto giusto. Gli obiettivi si fanno uno dopo l\'altro fino al finale.',
      'La CREATURA non si può uccidere: si evita, ci si nasconde negli armadietti, la si distrae col rumore o la si scaccia col fuoco. Il rumore (spari, corse, frugare) la attira; il rilevatore di movimento dice quanto è vicina; al buio le batterie della torcia si scaricano e la paura sale (con 7 o più le prove hanno svantaggio). Con i materiali trovati si costruiscono kit medici, diversivi, molotov, bombe, mine EMP. Gli androidi sono lenti e resistenti, e il tecnico li può hackerare.',
      'TEMPO REALE (opzione "Come si gioca"): tutta la stazione su una mappa enorme vista dall\'alto. Ti muovi con WASD o il joystick (Maiusc per correre, che fa rumore; C per accovacciarti), E per interagire (porte, casse, armadietti, terminali), F la torcia, Q il rilevatore, clic per attaccare o lanciare. I tiri per colpire e i danni sono quelli delle regole.',
    ],
  },
  crea: (o) => new Draghi(o),
  bot,
  _test: { Draghi, R, B, CLASSI, INCANTESIMI, MOSTRI, MAP, Combattimento, MASTER },
};
