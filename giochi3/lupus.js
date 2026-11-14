// LUPUS IN FABULA: il villaggio di Borgo Nebbioso e i lupi mannari nascosti tra gli abitanti. Ruoli segreti, notte e
// giorno, discussione in chat, votazioni a voce alta e un narratore automatico che racconta tutto (anche a voce).
// - Notte: i lupi scelgono insieme una vittima (si vedono tra loro e parlano in una chat solo loro), la Veggente
//   scopre se qualcuno è un lupo, la Guardia protegge una persona (mai la stessa due notti di fila, mai sé stessa).
// - Alba: il narratore racconta chi è morto (o chi la Guardia ha salvato senza saperlo).
// - Giorno: discussione a tempo (si può dire «Pronti al voto»), poi voto palese: si vede chi vota chi e si può
//   cambiare finché non hanno votato tutti. Pareggio = ballottaggio tra i più votati; un altro pareggio = nessuno.
// - Il Cacciatore, quando muore, spara a qualcuno. Il Medium (se i ruoli dei morti restano segreti) scopre se il
//   condannato del giorno era un lupo. L'Indemoniato è un umano che tifa per i lupi.
// - Vince il villaggio quando non ci sono più lupi; vincono i lupi quando sono tanti quanti gli altri vivi.
// Il computer sa giocare tutti i ruoli: ascolta la chat (chi viene nominato diventa più sospetto), parla in chat
// (la Veggente del computer accusa i lupi che ha scoperto, un lupo furbo può fingersi Veggente) e vota.

const RUOLI = {
  lupo: { nome: 'Lupo mannaro', icona: '🐺', lupi: true, desc: 'Di notte scegli con gli altri lupi chi sbranare. Di giorno fingi di essere un innocente abitante.' },
  veggente: { nome: 'Veggente', icona: '🔮', desc: 'Ogni notte scegli una persona e scopri se è un lupo mannaro. Usa bene quello che sai: se ti scoprono, i lupi ti cercheranno.' },
  guardia: { nome: 'Guardia', icona: '🛡️', desc: 'Ogni notte proteggi una persona dai lupi (non te stessa e non la stessa persona due notti di fila).' },
  medium: { nome: 'Medium', icona: '🕯️', desc: 'Ogni notte scopri se la persona condannata dal villaggio quel giorno era un lupo mannaro.' },
  cacciatore: { nome: 'Cacciatore', icona: '🏹', desc: 'Quando muori, di notte o di giorno, fai in tempo a sparare un ultimo colpo: porti con te chi vuoi.' },
  indemoniato: { nome: 'Indemoniato', icona: '😈', tifaLupi: true, desc: 'Sei umano (la Veggente ti vede innocente) ma tifi per i lupi: vinci se vincono loro. Non sai chi sono: aiutali a confondere il villaggio.' },
  contadino: { nome: 'Contadino', icona: '🌾', desc: 'Non hai poteri speciali, ma il tuo voto vale quanto quello degli altri: ascolta, ragiona e smaschera i lupi.' },
};

const NOTTE_MS = 60000;      // quanto può durare al massimo la notte
const NOTTE_MIN_MS = 12000;  // la notte dura almeno così (se finisse subito si capirebbe chi ha poteri)
const VOTO_MS = 60000;
const CACCIA_MS = 30000;
const PAUSA_RUOLI = 9000, PAUSA_ALBA = 7500, PAUSA_CONDANNA = 8000, PAUSA_SPARO = 6000, PAUSA_FINALE = 6000;
const MAX_NOTTI = 20; // nessuna partita infinita: dopo 20 notti i lupi sono sopravvissuti e vincono

const caso = (a) => a[Math.floor(Math.random() * a.length)];
const mescola = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------- il narratore ----------------
// i testi usano @k per il nome del giocatore k (il browser mette i nomi)
const T = {
  inizio: [
    'Benvenuti a Borgo Nebbioso. Da qualche notte, nei boschi intorno al villaggio, si sentono ululati. Qualcuno tra voi non è quello che sembra. Guardate la vostra carta, in segreto.',
    'Borgo Nebbioso, un villaggio tranquillo… fino a stanotte. Tra gli abitanti si nascondono dei lupi mannari. Ognuno guardi la propria carta, e non la mostri a nessuno.',
  ],
  notte: [
    'Cala la notte su Borgo Nebbioso. Tutti chiudono gli occhi.',
    'Il sole tramonta dietro le colline. Il villaggio si addormenta.',
    'Scende il buio. Le porte si chiudono, le candele si spengono.',
    'È notte fonda. Si sente solo il vento tra gli alberi.',
  ],
  primaNotte: 'È la prima notte: i lupi aprono gli occhi e si riconoscono, ma per stanotte non cacciano. La Veggente apre gli occhi e sceglie chi scrutare.',
  ruoliNotte: 'I lupi aprono gli occhi e scelgono una vittima. La Veggente interroga le carte. La Guardia veglia su qualcuno.',
  alba: [
    'Sorge il sole su Borgo Nebbioso.',
    'Il gallo canta: è l\'alba.',
    'La nebbia si dirada. Il villaggio si risveglia.',
  ],
  morto: [
    'Nella piazza trovano @k, senza vita. I lupi hanno colpito.',
    '@k non si è svegliato. Sulla porta di casa, segni di artigli.',
    'Un grido rompe il silenzio: @k è stato sbranato durante la notte.',
  ],
  nessunMorto: [
    'Incredibile: stanotte nessuno è morto.',
    'Tutti si svegliano sani e salvi. Stanotte i lupi sono rimasti a mani vuote.',
  ],
  salvato: 'Qualcuno ha sentito i lupi sotto la finestra… ma una figura nell\'ombra li ha messi in fuga.',
  giorno: [
    'Il villaggio si riunisce in piazza. Chi sono i lupi? Discutete in chat, poi si vota.',
    'Tutti in piazza: è il momento di parlare. Accusate, difendetevi, ragionate.',
  ],
  voto: 'Il tempo delle parole è finito. Si vota: chi mandiamo al rogo?',
  ballottaggio: 'Pareggio! Ballottaggio tra @@: si vota di nuovo, solo tra loro.',
  nessunoCondannato: 'Il villaggio non si mette d\'accordo. Per oggi nessuno viene condannato.',
  condannato: [
    'Il villaggio ha deciso: @k viene condannato al rogo.',
    'La folla ha parlato: @k viene portato via.',
  ],
  cacciatore: '@k era il Cacciatore! Prima di cadere imbraccia il fucile…',
  sparo: 'Bang! Il Cacciatore ha colpito @k.',
  nessunoSparo: 'Il Cacciatore abbassa il fucile: nessun colpo.',
  vittoriaVillaggio: 'L\'ultimo lupo è caduto. Borgo Nebbioso è salvo: vince il villaggio!',
  vittoriaLupi: 'I lupi sono ormai tanti quanti gli abitanti. Non c\'è più scampo: vincono i lupi mannari!',
  stallo: 'Le notti passano e i lupi sono ancora tra voi. Il villaggio si arrende: vincono i lupi.',
};
const eraTesto = (r, rivela) => (!rivela ? '' : r === 'lupo' ? ' Era un lupo mannaro! 🐺' : ` Era ${articolo(r)} ${RUOLI[r].nome}.`);
function articolo(r) { return { veggente: 'la', guardia: 'la' }[r] || 'il'; }

// ---------------- i ruoli in gioco ----------------
function quantiLupi(n, scelta) {
  const auto = n <= 6 ? 1 : n <= 10 ? 2 : 3;
  const v = Number(scelta);
  const max = Math.max(1, Math.floor((n - 1) / 3)); // sempre meno di un terzo
  return Math.min(max, Number.isInteger(v) && v > 0 ? v : auto);
}
function componi(n, opzioni = {}) {
  const lupi = quantiLupi(n, opzioni.lupi);
  const rivela = opzioni.rivela !== 'no';
  const speciali = ['veggente'];
  if (n >= 6) speciali.push('guardia');
  if (opzioni.ruoli !== 'base') {
    if (n >= 7) speciali.push('cacciatore');
    if (n >= 8 && !rivela) speciali.push('medium');
    if (n >= 9) speciali.push('indemoniato');
  }
  const ruoli = [...new Array(lupi).fill('lupo'), ...speciali.slice(0, n - lupi)];
  while (ruoli.length < n) ruoli.push('contadino');
  return mescola(ruoli);
}

class Lupus {
  constructor({ n, opzioni = {}, bot = [] }) {
    this.id = 'lupus';
    this.n = n;
    this.bot = bot || [];
    this.rivela = opzioni.rivela !== 'no';
    this.primaTranquilla = opzioni.primaNotte !== 'caccia';
    this.discussioneMs = (Number(opzioni.discussione) || 120) * 1000;
    this.ruoli = componi(n, opzioni);
    this.vivi = new Array(n).fill(true);
    this.morti = [];             // { posto, quando: 'notte' | 'giorno', n, come: 'lupi' | 'rogo' | 'sparo' }
    this.racconto = [];          // { id, testo, tipo: 'notte' | 'giorno' | 'morte' | 'fine' }
    this.nRacc = 0;
    this.diario = Array.from({ length: n }, () => []); // quello che sa solo lui (Veggente, Medium, Guardia…)
    this.notteN = 0;
    this.sospetto = new Array(n).fill(0);   // quanto il villaggio (e il computer) sospetta di ognuno
    this.dichiarazioni = [];     // { posto, ruolo, bersaglio, lupo, giorno } dette in chat dai computer
    this.protettoIeri = null;
    this.condannatoOggi = null;
    this.cacciaDa = null;        // il Cacciatore che sta per sparare
    this.dopoCaccia = null;      // 'giorno' | 'notte'
    this.candidati = null;       // ballottaggio
    this.ballottaggio = false;
    this.voti = new Array(n).fill(undefined);
    this.pronti = new Set();
    this.sceltaLupi = {};
    this.azioniNotte = {};       // posto → bersaglio (Veggente, Guardia)
    this.fineFase = null; this.inizioFase = Date.now(); this.minNotte = null;
    this.parlato = new Set();    // i computer che hanno già detto la loro oggi
    this.chatDa = [];
    this.esito = null;           // 'villaggio' | 'lupi' | 'stallo'
    this.finita = false; this.risultato = null; this.turno = null; this.evento = null; this.nEv = 0;
    this.fase = 'ruoli';
    this.inAttesa = true; this.pausaMs = PAUSA_RUOLI;
    this.narra(caso(T.inizio), 'notte');
  }

  // ---------- utilità ----------
  narra(testo, tipo = 'giorno') { this.racconto.push({ id: ++this.nRacc, testo, tipo, notte: this.notteN }); if (this.racconto.length > 60) this.racconto.shift(); }
  annota(p, testo) { this.diario[p].push({ id: ++this.nRacc, testo, notte: this.notteN }); }
  eLupo(p) { return this.ruoli[p] === 'lupo'; }
  lupi(soloVivi = false) { return this.ruoli.map((r, i) => (r === 'lupo' && (!soloVivi || this.vivi[i]) ? i : -1)).filter((i) => i >= 0); }
  viventi() { return this.vivi.map((v, i) => (v ? i : -1)).filter((i) => i >= 0); }
  chi(ruolo) { return this.ruoli.indexOf(ruolo); }
  vivoCon(ruolo) { const i = this.chi(ruolo); return i >= 0 && this.vivi[i] ? i : -1; }
  valido(k) { return Number.isInteger(k) && k >= 0 && k < this.n; }

  // ---------- chi deve agire ----------
  attoriNotte() {
    const att = [];
    const caccia = !(this.notteN === 1 && this.primaTranquilla);
    if (caccia) for (const l of this.lupi(true)) att.push(l);
    const v = this.vivoCon('veggente'); if (v >= 0) att.push(v);
    const g = this.vivoCon('guardia'); if (g >= 0 && caccia) att.push(g);
    return att;
  }
  attesi() {
    if (this.finita || this.inAttesa) return [];
    if (this.fase === 'notte') return this.attoriNotte().filter((p) => (this.eLupo(p) ? this.sceltaLupi[p] === undefined : this.azioniNotte[p] === undefined));
    if (this.fase === 'giorno') return this.viventi().filter((p) => !this.pronti.has(p));
    if (this.fase === 'voto') return this.votanti().filter((p) => this.voti[p] === undefined);
    return [];
  }
  votanti() { return this.viventi(); }
  bersagliVoto(p) { return (this.candidati || this.viventi()).filter((k) => k !== p && this.vivi[k]); }

  scadenza() { return this.finita || this.inAttesa ? null : this.fineFase; }
  controllaTempo() {
    if (this.finita || this.inAttesa || !this.fineFase || Date.now() < this.fineFase) return false;
    if (this.fase === 'notte') this.risolviNotte();
    else if (this.fase === 'giorno') this.iniziaVoto();
    else if (this.fase === 'voto') this.scrutinio();
    else if (this.fase === 'cacciatore') this.spara(null);
    else return false;
    return true;
  }
  imposta(fase, ms) { this.fase = fase; this.turno = null; this.inizioFase = Date.now(); this.fineFase = ms ? Date.now() + ms : null; }

  // ---------- le fasi ----------
  iniziaNotte() {
    this.notteN++;
    if (this.notteN > MAX_NOTTI) { this.esito = 'stallo'; this.narra(T.stallo, 'fine'); return this.vaiAlFinale(); }
    this.imposta('notte', NOTTE_MS);
    this.minNotte = Date.now() + NOTTE_MIN_MS;
    this.sceltaLupi = {}; this.azioniNotte = {};
    if (this.notteN === 1) {
      const lupi = this.lupi();
      for (const l of lupi) {
        const altri = lupi.filter((x) => x !== l);
        this.annota(l, altri.length ? `🐺 Il tuo branco: ${altri.map((x) => `@${x}`).join(' e ')}.` : '🐺 Sei l\'unico lupo: caccia da solo.');
      }
    }
    this.narra(caso(T.notte), 'notte');
    this.narra(this.notteN === 1 && this.primaTranquilla ? T.primaNotte : T.ruoliNotte, 'notte');
    // il Medium scopre com'era il condannato di oggi
    const m = this.vivoCon('medium');
    if (m >= 0 && this.condannatoOggi != null) {
      const c = this.condannatoOggi;
      this.annota(m, `🕯️ Lo spirito di @${c} ti sussurra: ${this.eLupo(c) ? 'era un LUPO MANNARO 🐺' : 'non era un lupo'}.`);
    }
    this.condannatoOggi = null;
    if (!this.attesi().length) this.fineFase = this.minNotte;
  }

  // tutti quelli che dovevano agire hanno agito: la notte finisce (ma non prima del minimo)
  forseFineNotte() {
    if (this.attesi().length) return;
    if (Date.now() >= this.minNotte) this.risolviNotte();
    else this.fineFase = this.minNotte;
  }

  bersaglioLupi() {
    const conta = {};
    for (const v of Object.values(this.sceltaLupi)) if (this.valido(v)) conta[v] = (conta[v] || 0) + 1;
    const voci = Object.entries(conta);
    if (!voci.length) return null;
    const max = Math.max(...voci.map(([, c]) => c));
    return Number(caso(voci.filter(([, c]) => c === max))[0]);
  }

  risolviNotte() {
    const vittima = this.bersaglioLupi();
    const g = this.vivoCon('guardia');
    const protetto = g >= 0 ? this.azioniNotte[g] : undefined;
    this.protettoIeri = protetto === undefined ? null : protetto;
    this.narra(caso(T.alba), 'giorno');
    const morti = [];
    if (vittima != null && this.vivi[vittima]) {
      if (vittima === protetto) {
        this.narra(T.salvato, 'giorno');
        this.narra(caso(T.nessunMorto), 'giorno');
        if (g >= 0) this.annota(g, `🛡️ Hai salvato @${vittima} dai lupi!`);
      } else morti.push(vittima);
    } else if (!(this.notteN === 1 && this.primaTranquilla)) this.narra(caso(T.nessunMorto), 'giorno');
    else this.narra('La prima notte passa tranquilla. Ma da domani i lupi cacceranno.', 'giorno');
    for (const m of morti) this.uccidi(m, 'lupi', caso(T.morto));
    this.fase = 'alba'; this.fineFase = null;
    this.inAttesa = true; this.pausaMs = PAUSA_ALBA;
    this.dopoCaccia = 'giorno';
  }

  uccidi(k, come, testo) {
    if (!this.vivi[k]) return;
    this.vivi[k] = false;
    this.morti.push({ posto: k, quando: come === 'lupi' ? 'notte' : 'giorno', n: this.notteN, come, ruolo: this.ruoli[k] });
    this.narra(`${testo.replace('@k', `@${k}`)}${eraTesto(this.ruoli[k], this.rivela)}`, 'morte');
    this.annota(k, '💀 Sei morto. Ora sei un fantasma: vedi tutte le carte e parli solo con gli altri fantasmi.');
    if (this.rivela) this.imparaDaMorte(k, come);
    if (this.ruoli[k] === 'cacciatore') this.cacciaDa = k;
  }

  // il villaggio impara qualcosa da ogni carta scoperta (serve ai computer)
  imparaDaMorte(k, come) {
    const lupo = this.eLupo(k);
    for (const d of this.dichiarazioni) {
      if (d.bersaglio !== k) continue;
      if (d.lupo === lupo) this.sospetto[d.posto] -= 4; else this.sospetto[d.posto] += 10; // ha detto il vero / ha mentito
    }
    for (const c of this.dichiarazioni) if (c.posto === k && c.ruolo === 'veggente' && this.ruoli[k] !== 'veggente') {
      // era un falso veggente: chi l'aveva smentito guadagna fiducia
      for (const d of this.dichiarazioni) if (d.ruolo === 'veggente' && d.posto !== k) this.sospetto[d.posto] -= 4;
    }
    // chi l'ha votato al rogo
    if (come === 'rogo' && this.ultimiVoti) this.ultimiVoti.forEach((v, i) => { if (v === k && i !== k) this.sospetto[i] += lupo ? -1.5 : 1.5; });
  }

  dopoMorti() {
    // il Cacciatore appena morto spara
    if (this.cacciaDa != null) {
      this.imposta('cacciatore', CACCIA_MS);
      this.turno = this.cacciaDa;
      this.narra(T.cacciatore.replace('@k', `@${this.cacciaDa}`), 'morte');
      return;
    }
    if (this.controllaVittoria()) return;
    if (this.dopoCaccia === 'notte') this.iniziaNotte(); else this.iniziaGiorno();
  }

  iniziaGiorno() {
    this.imposta('giorno', this.discussioneMs);
    this.pronti = new Set(); this.parlato = new Set();
    this.candidati = null; this.ballottaggio = false;
    this.narra(caso(T.giorno), 'giorno');
  }

  iniziaVoto() {
    this.imposta('voto', VOTO_MS);
    this.voti = new Array(this.n).fill(undefined);
    this.narra(this.ballottaggio ? T.ballottaggio.replace('@@', this.candidati.map((k) => `@${k}`).join(' e ')) : T.voto, 'giorno');
  }

  scrutinio() {
    const conta = new Array(this.n).fill(0);
    this.voti.forEach((v, i) => { if (this.vivi[i] && this.valido(v) && this.vivi[v]) conta[v]++; });
    this.ultimiVoti = [...this.voti];
    const max = Math.max(...conta);
    const primi = conta.map((c, i) => (c === max && max > 0 ? i : -1)).filter((i) => i >= 0);
    this.ultimoConteggio = conta;
    if (primi.length > 1 && !this.ballottaggio) {
      this.ballottaggio = true;
      this.candidati = primi;
      this.iniziaVoto();
      return;
    }
    this.fase = 'condanna'; this.fineFase = null; this.turno = null;
    this.inAttesa = true; this.pausaMs = PAUSA_CONDANNA;
    this.dopoCaccia = 'notte';
    if (primi.length !== 1) { this.condannato = null; this.narra(T.nessunoCondannato, 'giorno'); return; }
    const k = primi[0];
    this.condannato = k;
    this.condannatoOggi = k;
    this.uccidi(k, 'rogo', caso(T.condannato));
  }

  spara(k) {
    const c = this.cacciaDa;
    this.cacciaDa = null;
    this.turno = null; this.fineFase = null;
    if (k == null || !this.vivi[k]) this.narra(T.nessunoSparo, 'morte');
    else this.uccidi(k, 'sparo', T.sparo);
    this.ultimoSparo = { da: c, a: k };
    this.fase = 'sparo';
    this.inAttesa = true; this.pausaMs = PAUSA_SPARO;
  }

  controllaVittoria() {
    const lupi = this.lupi(true).length;
    const altri = this.viventi().length - lupi;
    if (lupi === 0) this.esito = 'villaggio';
    else if (lupi >= altri) this.esito = 'lupi';
    else return false;
    this.narra(this.esito === 'villaggio' ? T.vittoriaVillaggio : T.vittoriaLupi, 'fine');
    this.vaiAlFinale();
    return true;
  }
  vaiAlFinale() { this.fase = 'finale'; this.fineFase = null; this.turno = null; this.inAttesa = true; this.pausaMs = PAUSA_FINALE; }

  avanza() {
    if (!this.inAttesa) return;
    this.inAttesa = false;
    if (this.fase === 'ruoli') return this.iniziaNotte();
    if (this.fase === 'alba' || this.fase === 'condanna' || this.fase === 'sparo') return this.dopoMorti();
    if (this.fase === 'finale') return this.chiudi();
  }

  squadraLupi(p) { return this.eLupo(p) || this.ruoli[p] === 'indemoniato'; }
  chiudi() {
    this.finita = true; this.inAttesa = false; this.turno = null; this.fineFase = null;
    this.fase = 'fine';
    const lupiVincono = this.esito !== 'villaggio';
    const tutti = Array.from({ length: this.n }, (_, i) => i);
    const branco = tutti.filter((i) => this.squadraLupi(i)), villaggio = tutti.filter((i) => !this.squadraLupi(i));
    const vincitori = lupiVincono ? branco : villaggio;
    this.risultato = {
      fazioni: [{ posti: branco, punti: lupiVincono ? 1 : 0 }, { posti: villaggio, punti: lupiVincono ? 0 : 1 }],
      etichetta: 'vittoria', pareggio: false, vincitori,
      titolo: lupiVincono ? 'Vincono i lupi mannari! 🐺' : 'Vince il villaggio! 🌾',
    };
  }

  // ---------- le mosse ----------
  azione(p, a) {
    if (this.finita) return { errore: 'La partita è finita' };
    if (this.inAttesa) return { errore: 'Un attimo: il narratore sta parlando…' };
    if (!a || typeof a !== 'object') return { errore: 'Mossa non valida' };
    if (!this.valido(p) || (!this.vivi[p] && !(this.fase === 'cacciatore' && p === this.cacciaDa))) return { errore: 'I fantasmi non possono più agire' };
    const k = a.posto === null || a.posto === -1 ? null : Number(a.posto);

    if (this.fase === 'notte') {
      if (!this.attoriNotte().includes(p)) return { errore: 'Di notte dormi: aspetta l\'alba' };
      if (a.tipo !== 'notte') return { errore: 'Ora è notte' };
      if (!this.valido(k) || !this.vivi[k]) return { errore: 'Scegli una persona viva' };
      const r = this.ruoli[p];
      if (r === 'lupo') {
        if (this.eLupo(k)) return { errore: 'Non puoi sbranare un altro lupo' };
        this.sceltaLupi[p] = k; // si può cambiare finché non hanno scelto tutti i lupi
      } else if (r === 'veggente') {
        if (this.azioniNotte[p] !== undefined) return { errore: 'Hai già scrutato qualcuno stanotte' };
        if (k === p) return { errore: 'Scegli un\'altra persona' };
        this.azioniNotte[p] = k;
        const vede = this.eLupo(k);
        this.annota(p, `🔮 Notte ${this.notteN}: @${k} ${vede ? 'è un LUPO MANNARO 🐺' : 'non è un lupo'}.`);
        this.visti = this.visti || {};
        this.visti[k] = vede;
      } else if (r === 'guardia') {
        if (this.azioniNotte[p] !== undefined) return { errore: 'Stai già proteggendo qualcuno' };
        if (k === p) return { errore: 'Non puoi proteggere te stessa' };
        if (k === this.protettoIeri) return { errore: 'Non puoi proteggere la stessa persona due notti di fila' };
        this.azioniNotte[p] = k;
        this.annota(p, `🛡️ Notte ${this.notteN}: proteggi @${k}.`);
      }
      this.forseFineNotte();
      return { ok: true };
    }

    if (this.fase === 'giorno') {
      if (a.tipo === 'pronto') {
        if (a.frase && this.bot[p]) this.chatDa.push({ posto: p, testo: String(a.frase).slice(0, 160) });
        this.pronti.add(p);
        if (!this.attesi().length) this.iniziaVoto();
        return { ok: true };
      }
      if (a.tipo === 'nonPronto') { this.pronti.delete(p); return { ok: true }; }
      return { errore: 'Ora si discute: quando avete finito premete «Pronti al voto»' };
    }

    if (this.fase === 'voto') {
      if (a.tipo !== 'vota') return { errore: 'Ora si vota' };
      if (k === null) { this.voti[p] = null; } // astenuto
      else {
        if (!this.valido(k) || !this.vivi[k]) return { errore: 'Scegli una persona viva' };
        if (k === p) return { errore: 'Non puoi votare te stesso' };
        if (this.candidati && !this.candidati.includes(k)) return { errore: 'Al ballottaggio si vota solo tra i più votati' };
        this.voti[p] = k;
      }
      if (a.frase && this.bot[p]) this.chatDa.push({ posto: p, testo: String(a.frase).slice(0, 160) });
      if (!this.attesi().length) this.scrutinio();
      return { ok: true };
    }

    if (this.fase === 'cacciatore') {
      if (p !== this.cacciaDa) return { errore: 'Aspetta: il Cacciatore sta prendendo la mira' };
      if (a.tipo !== 'spara') return { errore: 'Scegli a chi sparare' };
      if (k !== null && (!this.valido(k) || !this.vivi[k] || k === p)) return { errore: 'Scegli una persona viva' };
      this.spara(k);
      return { ok: true };
    }
    return { errore: 'Mossa non valida' };
  }

  // il computer al posto di chi non risponde (o i computer veri) agiscono comunque tramite bot()
  // chi è morto non è mai atteso; i fantasmi non hanno niente da saltare
  salta(p) {
    if (this.fase === 'notte' && this.attesi().includes(p)) { if (this.eLupo(p)) this.sceltaLupi[p] = null; else this.azioniNotte[p] = null; this.forseFineNotte(); }
    else if (this.fase === 'giorno' && this.attesi().includes(p)) { this.pronti.add(p); if (!this.attesi().length) this.iniziaVoto(); }
    else if (this.fase === 'voto' && this.attesi().includes(p)) { this.voti[p] = null; if (!this.attesi().length) this.scrutinio(); }
    else if (this.fase === 'cacciatore' && p === this.cacciaDa) this.spara(null);
  }

  // ---------- la chat ----------
  // di notte parlano solo i lupi (tra loro); i fantasmi parlano solo tra fantasmi; di giorno il computer ascolta
  leggiChat(p, testo) {
    if (!this.valido(p)) return {};
    const morti = this.vivi.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (!this.vivi[p]) return { soloPer: morti };
    if (this.fase === 'notte') {
      if (this.eLupo(p)) return { soloPer: [...this.lupi(), ...morti] };
      return { nascondi: true, privato: '🌙 Di notte il villaggio dorme: la chat riapre all\'alba (parlano solo i lupi, tra loro)' };
    }
    const t = ` ${String(testo || '').toLowerCase()} `;
    (this.nomiGiocatori || []).forEach((nome, k) => {
      const n = String(nome || '').toLowerCase().replace(/\s*\(pc\)$/, '').trim();
      if (k === p || n.length < 3 || !this.vivi[k]) return;
      if (t.includes(n)) this.sospetto[k] += /lup|sospett|vot|bugiard|ment|accus|rogo|colpevol/.test(t) ? 1 : 0.4;
    });
    return {};
  }

  // ---------- il trucco segreto (!win) ----------
  suggerimentoWin(posto) {
    if (this.finita || this.fase === 'finale' || !this.valido(posto)) return null;
    const nome = (i) => (this.nomiGiocatori && this.nomiGiocatori[i]) || `il giocatore ${i + 1}`;
    if (this.squadraLupi(posto)) {
      const v = this.vivoCon('veggente'), g = this.vivoCon('guardia');
      const pezzi = [v >= 0 ? `la Veggente è ${nome(v)}` : 'la Veggente è morta', g >= 0 ? `la Guardia è ${nome(g)}` : null].filter(Boolean);
      if (this.ruoli[posto] === 'indemoniato') pezzi.unshift(`i lupi sono ${this.lupi(true).map(nome).join(' e ')}`);
      return `🐺 ${pezzi.join(', ')}`;
    }
    const l = this.lupi(true);
    return `🐺 ${l.length > 1 ? `I lupi sono ${l.map(nome).join(' e ')}` : `Il lupo è ${nome(l[0])}`}`;
  }

  // ---------- la vista di ogni giocatore ----------
  vista(p) {
    const io = this.valido(p) ? p : -1;
    const fine = this.finita || this.fase === 'finale';
    const fantasma = io >= 0 && !this.vivi[io];
    const sonoLupo = io >= 0 && this.eLupo(io);
    const ruoliVisti = this.ruoli.map((r, i) => {
      if (fine || fantasma || i === io) return r;
      if (sonoLupo && r === 'lupo') return r;
      if (!this.vivi[i] && this.rivela) return r;
      return null;
    });
    const notteAttiva = this.fase === 'notte' && !this.inAttesa;
    const mioRuolo = io >= 0 ? this.ruoli[io] : null;
    return {
      gioco: this.id, n: this.n, aSquadre: true, fase: this.fase, turno: this.turno, inAttesa: this.inAttesa, pausaMs: this.pausaMs,
      notteN: this.notteN, rivela: this.rivela,
      resta: this.fineFase && !this.inAttesa ? Math.max(0, this.fineFase - Date.now()) : null,
      durata: this.fineFase && !this.inAttesa ? Math.max(1, this.fineFase - this.inizioFase) : null,
      vivi: this.vivi, ruoli: ruoliVisti, mioRuolo, fantasma,
      morti: this.morti.map((m) => ({ posto: m.posto, quando: m.quando, n: m.n, come: m.come })),
      racconto: this.racconto.slice(-30),
      diario: io >= 0 ? this.diario[io].slice(-20) : [],
      // di notte: cosa devo fare io
      devoAgire: notteAttiva && io >= 0 && this.attoriNotte().includes(io),
      fatto: notteAttiva && io >= 0 ? (sonoLupo ? this.sceltaLupi[io] !== undefined : this.azioniNotte[io] !== undefined) : false,
      miaScelta: notteAttiva && io >= 0 ? (sonoLupo ? this.sceltaLupi[io] ?? null : this.azioniNotte[io] ?? null) : null,
      sceltaLupi: (sonoLupo || fantasma) && notteAttiva ? this.sceltaLupi : null,
      primaTranquilla: this.notteN === 1 && this.primaTranquilla,
      protettoIeri: mioRuolo === 'guardia' ? this.protettoIeri : null,
      // di giorno
      pronti: this.fase === 'giorno' ? this.vivi.map((_, i) => this.pronti.has(i)) : null,
      voti: this.fase === 'voto' || this.fase === 'condanna' ? this.voti.map((v) => (v === undefined ? -2 : v === null ? -1 : v)) : null,
      candidati: this.candidati, ballottaggio: this.ballottaggio,
      condannato: this.fase === 'condanna' ? this.condannato : null,
      cacciaDa: this.fase === 'cacciatore' ? this.cacciaDa : null,
      esito: fine ? this.esito : null,
      finita: this.finita, risultato: this.risultato, evento: this.evento,
    };
  }
}

// ---------------- il computer ----------------
const FRASI = {
  accusa: ['Secondo me @k è un lupo.', 'Non mi fido di @k.', '@k è troppo silenzioso…', 'Io voto @k, ha qualcosa di strano.', '@k mi sembra sospetto.', 'Guardate @k: per me è lui.'],
  difesa: ['Io sono innocente, ve lo giuro!', 'Non sono un lupo, state sbagliando persona.', 'Calma, ragioniamo prima di votare.'],
  veggente: ['Sono la Veggente: stanotte ho scoperto che @k è un LUPO!', 'Esco allo scoperto: sono la Veggente e @k è un lupo mannaro. Votatelo!'],
  falsaVeggente: ['Sono io la vera Veggente! @k è un lupo, non credetegli!', 'Attenti: la Veggente sono io, e ho visto che @k è un lupo.'],
  segue: ['Sono d\'accordo, voto @k.', 'Anche io voto @k.', 'Ok, @k.'],
  medium: ['Sono il Medium: @k era un lupo, avevamo ragione.', 'Sono il Medium: @k non era un lupo… abbiamo sbagliato.'],
};
const frase = (lista, k) => caso(lista).replace('@k', `@${k}`);

// rumore stabile per ogni computer e ogni giorno: non cambia idea a ogni messaggio
function rumore(g, p, k, livello) {
  const s = Math.sin((p + 1) * 12.9898 + (k + 1) * 78.233 + g.notteN * 37.719) * 43758.5453;
  const r = s - Math.floor(s);
  return (r - 0.5) * (livello === 'difficile' ? 2 : livello === 'facile' ? 8 : 4);
}

// quanto il computer p sospetta di k
function stimaSospetto(g, p, k, livello) {
  let s = g.sospetto[k] + rumore(g, p, k, livello);
  const io = g.ruoli[p];
  if (io === 'lupo') return g.eLupo(k) ? -100 : s;
  if (io === 'veggente' && g.visti && g.visti[k] !== undefined) return g.visti[k] ? 100 : -100;
  // chi si è dichiarato Veggente e ha accusato k (il computer ci crede, a meno che il "veggente" sia sospetto)
  for (const d of g.dichiarazioni) {
    if (d.ruolo !== 'veggente' || !g.vivi[d.posto] || d.posto === p) continue;
    if (d.bersaglio === k && g.sospetto[d.posto] < 5) s += d.lupo ? 6 : -4;
    if (d.posto === k) s -= 2; // chi si espone di solito è sincero
  }
  // chi accusa me
  if (g.voti && g.voti[k] === p && livello !== 'facile') s += 1;
  return s;
}

function scegliMax(g, p, candidati, livello, extra = () => 0) {
  if (!candidati.length) return null;
  if (livello === 'facile' && Math.random() < 0.5) return caso(candidati);
  let best = null, bv = -Infinity;
  for (const k of candidati) { const v = stimaSospetto(g, p, k, livello) + extra(k); if (v > bv) { bv = v; best = k; } }
  return best;
}

function bot(g, p, livello = 'medio') {
  if (g.finita || g.inAttesa || (!g.vivi[p] && g.cacciaDa !== p)) return null;
  const altriVivi = g.viventi().filter((k) => k !== p);
  const r = g.ruoli[p];

  if (g.fase === 'notte') {
    if (!g.attesi().includes(p)) return null;
    if (r === 'lupo') {
      const prede = altriVivi.filter((k) => !g.eLupo(k));
      // un compagno ha già scelto: lo seguo (il branco caccia unito)
      const giaScelto = Object.values(g.sceltaLupi).find((v) => g.valido(v) && g.vivi[v] && !g.eLupo(v));
      if (giaScelto !== undefined && livello !== 'facile') return { tipo: 'notte', posto: giaScelto };
      if (livello === 'facile') return { tipo: 'notte', posto: caso(prede) };
      // prima chi si è dichiarato Veggente o Medium, poi le persone di cui il villaggio si fida (meno sospette)
      const esposti = g.dichiarazioni.filter((d) => g.vivi[d.posto] && !g.eLupo(d.posto)).map((d) => d.posto);
      if (esposti.length) return { tipo: 'notte', posto: esposti[esposti.length - 1] };
      let best = prede[0], bv = Infinity;
      for (const k of prede) { const v = g.sospetto[k] + rumore(g, p, k, livello); if (v < bv) { bv = v; best = k; } }
      return { tipo: 'notte', posto: best };
    }
    if (r === 'veggente') {
      const ignoti = altriVivi.filter((k) => !(g.visti && g.visti[k] !== undefined));
      const scelta = scegliMax(g, p, ignoti.length ? ignoti : altriVivi, livello);
      return { tipo: 'notte', posto: scelta };
    }
    if (r === 'guardia') {
      const ok = altriVivi.filter((k) => k !== g.protettoIeri);
      const esposti = g.dichiarazioni.filter((d) => d.ruolo === 'veggente' && g.vivi[d.posto] && ok.includes(d.posto) && g.sospetto[d.posto] < 5).map((d) => d.posto);
      if (esposti.length && livello !== 'facile') return { tipo: 'notte', posto: esposti[esposti.length - 1] };
      // proteggo chi sembra più innocente (i lupi lo cercano)
      let best = caso(ok), bv = Infinity;
      if (livello !== 'facile') for (const k of ok) { const v = stimaSospetto(g, p, k, livello); if (v < bv) { bv = v; best = k; } }
      return { tipo: 'notte', posto: best };
    }
    return null;
  }

  if (g.fase === 'giorno') {
    if (g.pronti.has(p)) return null;
    let testo = null;
    if (!g.parlato.has(p)) {
      g.parlato.add(p);
      const lupoTrovato = r === 'veggente' && g.visti ? altriVivi.find((k) => g.visti[k] === true) : undefined;
      if (lupoTrovato !== undefined && (livello !== 'facile' || Math.random() < 0.5)) {
        testo = frase(FRASI.veggente, lupoTrovato);
        g.dichiarazioni.push({ posto: p, ruolo: 'veggente', bersaglio: lupoTrovato, lupo: true, giorno: g.notteN });
      } else if (r === 'lupo' && livello === 'difficile' && Math.random() < 0.4) {
        // un lupo furbo smentisce la vera Veggente (o accusa un innocente fingendosi Veggente)
        const vera = g.dichiarazioni.filter((d) => d.ruolo === 'veggente' && g.vivi[d.posto] && !g.eLupo(d.posto)).map((d) => d.posto);
        const bersaglio = vera.length ? vera[vera.length - 1] : scegliMax(g, p, altriVivi.filter((k) => !g.eLupo(k)), livello);
        if (bersaglio != null && !g.dichiarazioni.some((d) => d.posto === p)) {
          testo = frase(FRASI.falsaVeggente, bersaglio);
          g.dichiarazioni.push({ posto: p, ruolo: 'veggente', bersaglio, lupo: true, giorno: g.notteN });
        }
      } else if (r === 'medium' && g.morti.length && livello !== 'facile') {
        const ultimo = [...g.morti].reverse().find((m) => m.come === 'rogo');
        if (ultimo && ultimo.n === g.notteN && !g.dichiarazioni.some((d) => d.posto === p && d.bersaglio === ultimo.posto)) {
          const lupo = g.eLupo(ultimo.posto);
          testo = FRASI.medium[lupo ? 0 : 1].replace('@k', `@${ultimo.posto}`);
          g.dichiarazioni.push({ posto: p, ruolo: 'medium', bersaglio: ultimo.posto, lupo, giorno: g.notteN });
          if (g.ultimiVoti) g.ultimiVoti.forEach((v, i) => { if (v === ultimo.posto && i !== ultimo.posto) g.sospetto[i] += lupo ? -1.5 : 1.5; });
        }
      }
      if (!testo && Math.random() < (g.n > 8 ? 0.35 : 0.5)) {
        const candidati = r === 'lupo' ? altriVivi.filter((k) => !g.eLupo(k)) : altriVivi;
        const k = scegliMax(g, p, candidati, livello);
        if (k != null) { testo = frase(FRASI.accusa, k); if (r !== 'lupo') g.sospetto[k] += 0.5; }
      }
      if (testo) return { tipo: 'pronto', frase: testo };
    }
    return { tipo: 'pronto' };
  }

  if (g.fase === 'voto') {
    if (g.voti[p] !== undefined) return null;
    const candidati = g.bersagliVoto(p);
    if (!candidati.length) return { tipo: 'vota', posto: null };
    // il peso dei voti già dati (si va dietro alla maggioranza, se non ho idee migliori)
    const contro = (k) => g.voti.filter((v, i) => v === k && g.vivi[i]).length;
    const extra = (k) => contro(k) * (livello === 'difficile' ? 0.6 : 1) + (r === 'lupo' && g.dichiarazioni.some((d) => d.posto === k && d.ruolo === 'veggente' && !g.eLupo(k)) ? 6 : 0);
    let k;
    if (r === 'lupo') {
      const ok = candidati.filter((x) => !g.eLupo(x));
      k = ok.length ? scegliMax(g, p, ok, livello, extra) : caso(candidati); // al ballottaggio tra due lupi ne sacrifica uno
    } else k = scegliMax(g, p, candidati, livello, extra);
    const mio = contro(k) >= 2 && Math.random() < 0.25 ? frase(FRASI.segue, k) : null;
    return { tipo: 'vota', posto: k, frase: mio };
  }

  if (g.fase === 'cacciatore') {
    if (g.cacciaDa !== p) return null;
    const k = scegliMax(g, p, altriVivi, livello);
    // spara solo se ha un sospetto vero (o è facile e spara a caso)
    if (k == null) return { tipo: 'spara', posto: null };
    return { tipo: 'spara', posto: k };
  }
  return null;
}

module.exports = {
  meta: {
    id: 'lupus',
    nome: 'Lupus in fabula',
    tipo: 'tabellone',
    giocatori: [5, 6, 7, 8, 9, 10, 11, 12],
    descrizione: 'Lupi mannari nascosti nel villaggio: ruoli segreti, notte e giorno, discussione e voto, con un narratore che racconta tutto. Meglio con tanti amici, ognuno col suo telefono.',
    alias: ['lupus', 'lupus in fabula', 'lupus in tabula', 'lupi', 'lupo', 'lupi mannari', 'licantropo', 'werewolf', 'mafia', 'villaggio', 'veggente'],
    opzioni: [
      { id: 'discussione', nome: '💬 Discussione di giorno', valori: [120, 180, 60, 300], etichette: ['2 minuti', '3 minuti', '1 minuto', '5 minuti'], predefinito: 120 },
      { id: 'lupi', nome: '🐺 Lupi', valori: ['auto', 1, 2, 3], etichette: ['In base ai giocatori', '1 lupo', '2 lupi', '3 lupi'], predefinito: 'auto' },
      { id: 'ruoli', nome: '🎭 Ruoli speciali', valori: ['tutti', 'base'], etichette: ['Tutti (Veggente, Guardia, Cacciatore, Medium, Indemoniato)', 'Solo Veggente e Guardia'], predefinito: 'tutti' },
      { id: 'rivela', nome: '💀 Carte dei morti', valori: ['si', 'no'], etichette: ['Si scoprono', 'Restano segrete (entra il Medium)'], predefinito: 'si' },
      { id: 'primaNotte', nome: '🌙 Prima notte', valori: ['tranquilla', 'caccia'], etichette: ['Tranquilla: i lupi si riconoscono', 'I lupi cacciano subito'], predefinito: 'tranquilla' },
    ],
    regole: [
      'Nel villaggio di Borgo Nebbioso si nascondono dei lupi mannari. All\'inizio ognuno riceve una carta segreta con il suo ruolo: tocca la carta per guardarla e toccala di nuovo per nasconderla. Il narratore (anche a voce, se l\'audio del sito è acceso) racconta tutto quello che succede.',
      'Ruoli: 🐺 Lupi mannari (1 fino a 6 giocatori, 2 fino a 10, 3 oltre; si conoscono tra loro), 🔮 Veggente, 🛡️ Guardia (da 6), 🏹 Cacciatore (da 7), 🕯️ Medium (da 8, solo se le carte dei morti restano segrete), 😈 Indemoniato (da 9) e 🌾 Contadini. Con «Solo Veggente e Guardia» gli altri sono tutti contadini.',
      'Notte: tutti dormono. I lupi scelgono insieme chi sbranare (vedono le scelte dei compagni e parlano in una chat solo loro; se non sono d\'accordo decide la maggioranza, a pari voti la sorte). La Veggente sceglie una persona e scopre se è un lupo. La Guardia protegge una persona: se i lupi attaccano proprio lei, si salva. La Guardia non può proteggere sé stessa né la stessa persona due notti di fila. Di notte chi non è lupo non può scrivere in chat.',
      'Prima notte «tranquilla» (predefinita): i lupi si riconoscono e la Veggente scruta qualcuno, ma nessuno muore. Con «I lupi cacciano subito» si comincia a cacciare dalla prima notte.',
      'Alba: il narratore racconta chi è morto. Con «Carte dei morti: si scoprono» si vede anche che ruolo aveva.',
      'Giorno: discussione in chat (2 minuti, o quanto scelto). Quando tutti i vivi premono «Pronti al voto» si vota subito. Il voto è palese: si vede chi vota chi, e si può cambiare finché non hanno votato tutti (o finché non scade il minuto). Ci si può astenere.',
      'Il più votato viene condannato al rogo. Se c\'è un pareggio si fa il ballottaggio: si vota di nuovo solo tra i più votati. Se anche il ballottaggio finisce pari, o nessuno vota, oggi non muore nessuno.',
      'Il Cacciatore, quando muore (di notte o di giorno), ha 30 secondi per sparare a una persona, che muore con lui. Il Medium, ogni notte, scopre se il condannato di quel giorno era un lupo. L\'Indemoniato è umano (la Veggente lo vede innocente) ma vince con i lupi.',
      'Vince il villaggio quando tutti i lupi sono morti. Vincono i lupi (e l\'Indemoniato) quando i lupi vivi sono tanti quanti gli altri vivi. Dopo 20 notti senza un vincitore i lupi sono sopravvissuti e vincono loro.',
      'I morti diventano fantasmi: vedono tutte le carte e la loro chat la leggono solo gli altri fantasmi (niente suggerimenti ai vivi!).',
      'I posti vuoti si possono riempire col computer: sa fare tutti i ruoli, legge la chat (chi viene nominato e accusato gli sembra più sospetto), parla (la Veggente del computer accusa in chat i lupi che ha scoperto, un lupo difficile può fingersi Veggente) e vota. Ma il gioco è pensato per tanti amici, ognuno col suo telefono.',
    ],
  },
  crea: (o) => new Lupus(o),
  bot,
  _test: { componi, quantiLupi, RUOLI, T, NOTTE_MIN_MS, MAX_NOTTI },
};
