(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const socket = io();

  // ---------- memoria locale ----------
  const mem = {
    get(k, d = null) { try { const v = localStorage.getItem('if:' + k); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('if:' + k, v); } catch {} },
    del(k) { try { localStorage.removeItem('if:' + k); } catch {} },
  };
  // impronta del dispositivo: caratteristiche del browser e dello schermo (uguali anche in una finestra in incognito).
  // Serve solo a far rispettare l'esilio: il server la mescola con l'indirizzo e non la salva da nessun'altra parte.
  const impronta = (() => {
    const pezzi = [navigator.userAgent, navigator.language, (navigator.languages || []).join(','), (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })(),
      screen.width, screen.height, screen.colorDepth, window.devicePixelRatio, navigator.hardwareConcurrency, navigator.deviceMemory, navigator.platform, navigator.maxTouchPoints];
    try { const c = document.createElement('canvas'); c.width = 220; c.height = 40; const g = c.getContext('2d'); g.textBaseline = 'top'; g.font = '16px Arial'; g.fillStyle = '#f60'; g.fillRect(100, 1, 60, 20); g.fillStyle = '#069'; g.fillText('Informatica Facile ⛵ 1,2,3', 2, 12); pezzi.push(c.toDataURL()); } catch { /* niente canvas */ }
    // hash cyrb53 (veloce, non serve che sia crittografico)
    const t = pezzi.join('|'); let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < t.length; i++) { const ch = t.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  })();
  let mioId = mem.get('id');
  if (!mioId) { mioId = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now(); mem.set('id', mioId); }

  let giochi = [];
  let stato = null;
  let scelto = { gioco: mem.get('gioco', 'scopa'), posti: Number(mem.get('posti', 2)), livello: mem.get('livello', 'medio'), opzioni: {} };
  let ui = {};
  let firmaPartita = null;
  let ultimoEvento = 0;
  let ultimaChat = 0;
  let chatLetta = Number(mem.get('chatLetta', 0));
  // audio del sito: spento finché non lo accendi tu (così a scuola non parte nessun rumore); la scelta resta salvata
  let suono = mem.get('audio', 'no') === 'si';

  // ---------- utilità ----------
  const meta = (id) => giochi.find((g) => g.id === id);
  // al tavolo il pulsante della chat globale sta nella barra in alto (in basso coprirebbe le carte)
  function mostra(id) { for (const s of $$('.schermo')) s.hidden = s.id !== id; const b = $('#apri-globale'); if (b) b.hidden = id === 'schermo-gioco'; if (id !== 'schermo-gioco') avvisoTurno(false); schermoAcceso(); }
  // durante la partita lo schermo del telefono non si spegne da solo (Wake Lock); sulle dispense e fuori dal gioco sì
  let blocco = null;
  async function schermoAcceso() {
    const serve = !$('#schermo-gioco').hidden && !(window.Boss && Boss.attivo) && document.visibilityState === 'visible';
    try {
      if (serve && !blocco && navigator.wakeLock) { blocco = await navigator.wakeLock.request('screen'); blocco.addEventListener('release', () => { blocco = null; }); }
      else if (!serve && blocco) { const b = blocco; blocco = null; await b.release(); }
    } catch { blocco = null; }
  }
  document.addEventListener('visibilitychange', schermoAcceso);
  if (window.Boss) Boss.onCambio(schermoAcceso);
  let tAvviso;
  // al tavolo avvisi e annunci si mettono sopra la barra in alto (centrati su di essa), non sopra gli avversari
  function inBarra(el) {
    const b = !$('#schermo-gioco').hidden && $('#schermo-gioco .barra').getBoundingClientRect();
    const su = !!(b && b.height && b.bottom > 0);
    el.classList.toggle('in-barra', su);
    el.style.top = su ? `${Math.max(b.top + b.height / 2, el.offsetHeight / 2 + 4)}px` : '';
  }
  function avviso(t, ms = 2600) {
    const el = $('#avviso');
    el.textContent = t;
    el.hidden = false;
    inBarra(el);
    clearTimeout(tAvviso);
    tAvviso = setTimeout(() => (el.hidden = true), ms);
  }
  let tAnnuncio;
  function annuncio(t) {
    const el = $('#annuncio');
    el.textContent = t;
    el.hidden = false;
    inBarra(el);
    el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai');
    clearTimeout(tAnnuncio);
    tAnnuncio = setTimeout(() => (el.hidden = true), 1900);
  }
  let audio;
  function bip(freq = 660, dur = 0.12) {
    if (!suono) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = freq;
      o.type = 'triangle';
      g.gain.setValueAtTime(0.12, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch {}
  }
  // ---------- avviso "tocca a te" ----------
  // Se tocca a te mentre sei su un'altra scheda (o in un'altra finestra), il titolo della scheda lampeggia
  // e suona un din-don leggero; tutto si ferma appena torni sulla pagina. Vale per tutti i giochi a turni.
  // Con le dispense aperte il titolo vero non si vede (lo nasconde boss.js) e i suoni sono sospesi.
  const TITOLO_BASE = 'Informatica Facile';
  const TITOLO_TURNO = '● Tocca a te — Informatica Facile';
  const TITOLO_LAMPO = '🔔 Tocca a te!';
  let mioTurnoOra = false;
  let tLampo = null;
  const lontano = () => document.hidden || !document.hasFocus();
  function dinDon() {
    bip(880, 0.18);
    setTimeout(() => bip(660, 0.28), 170);
  }
  function fermaLampo() {
    if (!tLampo) return;
    clearInterval(tLampo);
    tLampo = null;
    document.title = mioTurnoOra ? TITOLO_TURNO : TITOLO_BASE;
  }
  function avvisoTurno(mio) {
    const nuovo = mio && !mioTurnoOra;
    mioTurnoOra = mio;
    if (!mio) { fermaLampo(); document.title = TITOLO_BASE; return; }
    if (tLampo) return; // sta già lampeggiando: non si tocca il titolo
    document.title = TITOLO_TURNO;
    if (!nuovo) return;
    if (!lontano()) { bip(); if (navigator.vibrate) navigator.vibrate(40); return; }
    dinDon();
    let acceso = false;
    tLampo = setInterval(() => { acceso = !acceso; document.title = acceso ? TITOLO_LAMPO : TITOLO_TURNO; }, 1000);
    document.title = TITOLO_LAMPO;
  }
  const tornato = () => { if (!document.hidden) fermaLampo(); };
  document.addEventListener('visibilitychange', tornato);
  window.addEventListener('focus', tornato);
  window.addEventListener('pointerdown', tornato, true);
  if (window.Boss) Boss.onCambio((attivo) => { if (!attivo) tornato(); });
  // due pulsanti (nella home e nella barra del gioco) per lo stesso interruttore
  function aggiornaSuono() {
    $('#suono').textContent = suono ? '🔊' : '🔇';
    $('#suono-home').textContent = suono ? '🔊 Audio acceso' : '🔇 Audio spento';
    for (const b of [$('#suono'), $('#suono-home')]) { b.setAttribute('aria-pressed', String(suono)); b.title = suono ? 'Audio acceso: tocca per spegnerlo' : 'Audio spento: tocca per accenderlo'; }
    if (window.Boss && Boss.silenzio) Boss.silenzio(!suono);
  }
  for (const b of [$('#suono'), $('#suono-home')]) b.addEventListener('click', () => { suono = !suono; mem.set('audio', suono ? 'si' : 'no'); aggiornaSuono(); bip(); });
  aggiornaSuono();

  // ---------- regole ----------
  function apriRegole(id) {
    const m = meta(id);
    if (!m) return;
    $('#regole-titolo').textContent = `Regole: ${m.nome}`;
    // a ogni gioco si aggiungono i comandi della chat e i tasti della modalità studio
    const comandi = Object.entries(m.comandi || {}).map(([c, d]) => `<li><b>${esc(c)}</b>: ${esc(d)}</li>`).join('');
    $('#regole-testo').innerHTML = m.regole.map((r) => `<li>${esc(r)}</li>`).join('')
      + `<li class="regole-sezione">Comandi della chat</li>${comandi}`
      + '<li class="regole-sezione">Modalità studio</li><li><b>Esc</b> apre le dispense; <b>/</b> o <b>\\</b> (oppure scrivere <b>gioca</b>) ti riporta alla partita, che nel frattempo resta salvata.</li>';
    $('#regole').hidden = false;
    $('#chiudi-regole').focus();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-regole-di]');
    if (b) apriRegole(b.dataset.regoleDi || (stato && stato.gioco) || scelto.gioco);
  });
  $('#chiudi-regole').addEventListener('click', () => ($('#regole').hidden = true));
  // Esc ora è il Boss Key (vedi js/boss.js): le finestre si chiudono con i loro pulsanti.

  // =================== MODALITÀ STUDIO (Boss Key) ===================
  // Il server sa chi è sulle dispense: serve per mettere in pausa i giochi di collaborazione.
  Boss.onCambio((attivo) => {
    socket.emit('boss', attivo);
    // usciti dalle dispense dell'apertura: se c'è da scegliere il nome, il cursore va subito lì
    if (!attivo && !$('#benvenuto').hidden) setTimeout(() => $('#nome-ingresso').focus(), 30);
  });
  socket.on('prof', () => Boss.attiva({ subito: true }));
  // esecuzione pubblica (qualcuno ha scritto 67 in chat): il nome finisce nel vulcano
  // "enrico papi" in chat: parte il video per tutti
  socket.on('papi', (d) => { if (window.Esecuzione) Esecuzione.papi({ ...(d || {}), chiuso: () => { if (!(d && d.globale)) socket.emit('papiChiuso'); } }); });
  socket.on('esecuzione', (d) => { if (window.Esecuzione) Esecuzione.avvia({ ...d, sonoIo: d.sonoIo !== undefined ? d.sonoIo : !!(stato && d.posto === stato.mioPosto) }); });
  // giochi in tempo reale: lo stato leggero arriva a ogni tick
  // le scritte sotto i nomi (righe fatte, lunghezza, punti…) seguono il gioco anche tra uno stato completo e l'altro
  let ultimaInfoPosti = 0;
  const aggiornaInfoPosti = (T) => {
    const ora = Date.now();
    if (!T.infoPosto || ora - ultimaInfoPosti < 400) return;
    ultimaInfoPosti = ora;
    document.querySelectorAll('.info-posto[data-info]').forEach((el) => {
      let h = '';
      try { h = T.infoPosto(ctx, Number(el.dataset.info)) || ''; } catch (e) { return; }
      if (el.dataset.ultimo !== h) { el.dataset.ultimo = h; el.innerHTML = h; }
    });
  };
  socket.on('tick', (d) => { const T = stato && stato.partita && Tavoli[stato.partita.gioco]; if (T && T.tick) { T.tick(ctx, d); aggiornaInfoPosti(T); } });
  socket.on('cursore', (d) => { const T = stato && stato.partita && Tavoli[stato.partita.gioco]; if (T && T.cursore) T.cursore(ctx, d); });
  const cfgStudio = Boss.config();
  $('#studio-grigia').checked = cfgStudio.grigia;
  $('#studio-secondi').value = cfgStudio.secondi;
  $('#studio-grigia').addEventListener('change', (e) => Boss.config({ grigia: e.target.checked }));
  $('#studio-secondi').addEventListener('change', (e) => { e.target.value = Boss.config({ secondi: e.target.value }).secondi; });
  $('#studio-gesto').value = cfgStudio.gesto || 'entrambi';
  $('#studio-gesto').addEventListener('change', (e) => Boss.config({ gesto: e.target.value }));

  // =================== INGRESSO ===================
  const daUrl = new URLSearchParams(location.search).get('tavolo');
  if (daUrl) $('#codice').value = daUrl.toUpperCase();

  // il nome: si chiede subito all'apertura (se non c'è ancora) e si cambia dalla home con "Cambia nome"
  function impostaNome(n) {
    $('#nome').value = n;
    $('#nome-mostrato').textContent = n;
    $('#saluto').hidden = !n;
    mem.set('nome', n);
    socket.emit('presenza', { id: mioId, imp: impronta, nome: n });
    // seduto in sala (partita non iniziata o finita): il nome cambia subito anche al tavolo
    if (stato && !stato.spettatore && (!stato.partita || stato.partita.finita)) socket.emit('cambiaNome', n);
  }
  // il nome si sceglie alla prima visita; poi si può cambiare dalla home (vale dal prossimo tavolo)
  function chiediNome(cambia = false) {
    $('#nome-errore').hidden = true;
    $('#nome-ingresso').value = cambia ? mem.get('nome', '') : '';
    $('#benvenuto-titolo').textContent = cambia ? 'Cambia nome' : 'Benvenuto su Informatica Facile!';
    const inSala = stato && !stato.spettatore && (!stato.partita || stato.partita.finita);
    $('#benvenuto-testo').textContent = cambia ? (inSala ? 'Il nuovo nome si vede subito a questo tavolo.' : stato ? 'Il nuovo nome si vede a questo tavolo quando la partita finisce, e dal prossimo tavolo.' : 'Il nuovo nome si vede dal prossimo tavolo in cui ti siedi.') : 'Come ti chiami? È il nome che vedranno gli altri giocatori (potrai cambiarlo dalla home con «Cambia nome»).';
    $('#nome-ok').textContent = cambia ? 'Salva ✔️' : 'Entra 🎮';
    $('#nome-annulla').hidden = !cambia;
    $('#benvenuto').hidden = false;
    setTimeout(() => { $('#nome-ingresso').focus(); $('#nome-ingresso').select(); }, 30);
  }
  $('#cambia-nome').addEventListener('click', () => chiediNome(true));
  $('#sala-cambia-nome').addEventListener('click', () => chiediNome(true));
  $('#nome-annulla').addEventListener('click', () => { $('#benvenuto').hidden = true; });
  $('#form-nome').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = $('#nome-ingresso').value.replace(/\s+/g, ' ').trim();
    const errore = !n ? 'Scrivi un nome per entrare' : n.length < 2 ? 'Il nome deve avere almeno 2 lettere' : /[<>&"'`\\]/.test(n) ? 'Nel nome non si possono usare < > & " \' ` \\' : '';
    if (errore) { $('#nome-errore').textContent = errore; $('#nome-errore').hidden = false; return; }
    const primaVolta = !mem.get('nome');
    impostaNome(n);
    $('#benvenuto').hidden = true;
    // arrivato con il link di un tavolo: appena scelto il nome ci si siede
    if (primaVolta && daUrl) entra();
  });
  if (mem.get('nome')) impostaNome(mem.get('nome')); else { $('#saluto').hidden = true; chiediNome(); }

  function nome() {
    const n = $('#nome').value.trim();
    if (!n) { chiediNome(); return null; }
    mem.set('nome', n);
    return n;
  }

  // filtri della home: per nome, per numero di giocatori, col computer o solo tra persone
  const filtro = { nome: '', giocatori: mem.get('fGioc', ''), tipo: mem.get('fTipo', ''), cat: mem.get('fCat', ''), ctrl: mem.get('fCtrl', '') };
  // preferiti (⭐) e giochi fatti di recente: salvati nel browser
  const leggiJson = (k, d) => { try { return JSON.parse(mem.get(k, '')) ?? d; } catch { return d; } };
  let preferiti = new Set(leggiJson('preferiti', []));
  let recenti = leggiJson('recenti', []);
  function segnaRecente(id) {
    recenti = [id, ...recenti.filter((x) => x !== id)].slice(0, 8);
    mem.set('recenti', JSON.stringify(recenti));
  }
  const CATEGORIE = [['', 'Tutti'], ['pref', '⭐ Preferiti'], ['recenti', '🕑 Recenti'], ['carte', '🃏 Carte'], ['casino', '🎰 Casinò'], ['strategia', '♟️ Strategia'], ['rompicapo', '🧩 Rompicapo'], ['parole', '🔤 Parole e quiz'], ['azione', '⚡ Azione'], ['squid', '🦑 Squid Game']];
  function disegnaCategorie() {
    $('#filtro-cat').innerHTML = CATEGORIE.map(([k, t]) => `<button type="button" data-cat="${k}" aria-pressed="${filtro.cat === k}">${t}${k === 'pref' && preferiti.size ? ` <small>${preferiti.size}</small>` : ''}</button>`).join('');
  }
  disegnaCategorie();
  $('#filtro-cat').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    filtro.cat = b.dataset.cat; mem.set('fCat', filtro.cat);
    disegnaCategorie(); disegnaGiochi();
  });
  const touch = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
  const semplice = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function passaFiltro(g) {
    if (filtro.nome) {
      const cerca = semplice(filtro.nome);
      if (!semplice(`${g.nome} ${g.id} ${(g.alias || []).join(' ')}`).includes(cerca)) return false;
    }
    if (filtro.giocatori) {
      const n = Number(filtro.giocatori);
      if (n >= 8 ? !g.giocatori.some((x) => x >= 8) : !g.giocatori.includes(n)) return false;
    }
    if (filtro.tipo === 'bot' && g.soloPersone) return false;
    if (filtro.tipo === 'persone' && !g.soloPersone) return false;
    // con cosa si gioca: i giochi "uno" (mouse o tastiera, a scelta) valgono sia per il mouse sia per la tastiera
    // (sul telefono il filtro è nascosto e non conta: si gioca col dito)
    if (filtro.ctrl && !touch() && g.controlli !== filtro.ctrl && !(g.controlli === 'uno' && filtro.ctrl !== 'entrambi')) return false;
    if (filtro.cat === 'pref' && !preferiti.has(g.id)) return false;
    if (filtro.cat === 'recenti' && !recenti.includes(g.id)) return false;
    if (filtro.cat && !['pref', 'recenti'].includes(filtro.cat) && g.categoria !== filtro.cat) return false;
    return true;
  }
  $('#filtro-giocatori').value = filtro.giocatori;
  for (const b of $$('#filtro-tipo button')) b.setAttribute('aria-pressed', String(b.dataset.tipo === filtro.tipo));
  for (const b of $$('#filtro-controlli button')) b.setAttribute('aria-pressed', String(b.dataset.ctrl === filtro.ctrl));
  $('#filtro-controlli').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ctrl]');
    if (!b) return;
    filtro.ctrl = b.dataset.ctrl; mem.set('fCtrl', filtro.ctrl);
    for (const x of $$('#filtro-controlli button')) x.setAttribute('aria-pressed', String(x === b));
    disegnaGiochi();
  });
  $('#filtro-nome').addEventListener('input', (e) => { filtro.nome = e.target.value; disegnaGiochi(); });
  $('#filtro-giocatori').addEventListener('change', (e) => { filtro.giocatori = e.target.value; mem.set('fGioc', filtro.giocatori); disegnaGiochi(); });
  $('#filtro-tipo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tipo]');
    if (!b) return;
    filtro.tipo = b.dataset.tipo; mem.set('fTipo', filtro.tipo);
    for (const x of $$('#filtro-tipo button')) x.setAttribute('aria-pressed', String(x === b));
    disegnaGiochi();
  });
  $('#filtro-azzera').addEventListener('click', () => {
    Object.assign(filtro, { nome: '', giocatori: '', tipo: '', cat: '', ctrl: '' }); mem.set('fGioc', ''); mem.set('fTipo', ''); mem.set('fCat', ''); mem.set('fCtrl', ''); disegnaCategorie();
    for (const x of $$('#filtro-controlli button')) x.setAttribute('aria-pressed', String(x.dataset.ctrl === ''));
    $('#filtro-nome').value = ''; $('#filtro-giocatori').value = '';
    for (const x of $$('#filtro-tipo button')) x.setAttribute('aria-pressed', String(x.dataset.tipo === ''));
    disegnaGiochi();
  });

  // sul telefono la barra dei filtri (sempre in vista) prendeva un quinto dello schermo: scorrendo in giù si nasconde,
  // appena si torna su ricompare (come la barra degli indirizzi)
  {
    const barra = $('.filtri'), stretto = window.matchMedia('(max-width: 600px)');
    let ultimaY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY, d = y - ultimaY;
      if (Math.abs(d) < 8) return;
      ultimaY = y;
      const via = stretto.matches && d > 0 && y > barra.parentElement.offsetTop + 200 && !barra.contains(document.activeElement);
      if (barra.classList.contains('filtri-via') !== via) barra.classList.toggle('filtri-via', via);
    }, { passive: true });
  }

  function disegnaGiochi() {
    const visibili = giochi.filter(passaFiltro);
    // cercando, prima i giochi il cui nome comincia con la parola, poi quelli che la contengono nel nome, poi gli altri
    if (filtro.nome) {
      const c = semplice(filtro.nome), voto = (g) => (semplice(g.nome).startsWith(c) ? 0 : semplice(g.nome).includes(c) ? 1 : 2);
      visibili.sort((a, b) => voto(a) - voto(b));
    } else if (filtro.cat === 'recenti') visibili.sort((a, b) => recenti.indexOf(a.id) - recenti.indexOf(b.id));
    $('#filtro-vuoto').hidden = visibili.length > 0;
    $('#filtro-vuoto').textContent = filtro.cat === 'pref' && !preferiti.size ? 'Nessun preferito: tocca la ☆ di un gioco per aggiungerlo.' : filtro.cat === 'recenti' && !recenti.length ? 'Non hai ancora giocato a niente da questo browser.' : 'Nessun gioco con questi filtri.';
    $('#filtro-azzera').hidden = !(filtro.nome || filtro.giocatori || filtro.tipo || filtro.cat || (filtro.ctrl && !touch()));
    // se il filtro fissa i giocatori, il numero scelto lo segue
    if (filtro.giocatori && !filtro.nome) {
      const m = meta(scelto.gioco), n = Number(filtro.giocatori);
      if (m && m.giocatori.includes(n)) scelto.posti = n;
    }
    $('#elenco-giochi').innerHTML = visibili.map((g) => `
      <button type="button" class="gioco-tessera" data-gioco="${g.id}" data-cat="${esc(g.categoria || 'altri')}" aria-pressed="${g.id === scelto.gioco}">
        <span class="g-stella ${preferiti.has(g.id) ? 'si' : ''}" data-preferito="${g.id}" role="switch" aria-checked="${preferiti.has(g.id)}" aria-label="Preferito" title="${preferiti.has(g.id) ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${preferiti.has(g.id) ? '★' : '☆'}</span>
        <span class="g-nome">${esc(g.nome)}</span>
        <span class="g-desc">${esc(g.descrizione)}</span>
        <span class="g-gioc">${g.giocatori.length === 1 ? `${g.giocatori[0]} giocatori` : `da ${g.giocatori[0]} a ${g.giocatori[g.giocatori.length - 1]} giocatori`}</span>
        <span class="g-tag">${g.soloPersone ? '👥 solo persone' : '🤖 anche col computer'}${g.tempoReale ? ' · ⚡ tempo reale' : ''}${g.soloComputer ? ' · 🖥️ solo computer' : ''}${g.senzaLivelli ? ' · 🤝 in squadra' : ''}</span>
      </button>`).join('');
    disegnaImpostazioni();
  }

  // il valore di un'opzione: le caselle (opzioni sì/no con "casella") danno "true" o "false"
  const valoreOpz = (el) => (el.type === 'checkbox' ? String(el.checked) : el.value);
  function selectOpzione(o, valore, attr) {
    // opzioni che contano solo con certe scelte (es. o.se = { modalita: ['survival'] }): si vedono solo allora
    if (o.se) return `<div class="opz-se" data-se='${esc(JSON.stringify(o.se))}'>${selectOpzione({ ...o, se: null }, valore, attr)}</div>`;
    if (o.casella) return `<label class="imp-riga imp-casella"><span>${esc(o.nome)}</span><input type="checkbox" ${attr} data-opz="${o.id}" ${String(valore) === 'true' ? 'checked' : ''}></label>`;
    return `<label class="imp-riga"><span>${esc(o.nome)}</span>
      <select ${attr} data-opz="${o.id}">${o.valori.map((v, i) => `<option value="${v}" ${String(v) === String(valore) ? 'selected' : ''}>${esc(o.etichette ? o.etichette[i] : v)}</option>`).join('')}</select></label>${anteprime(o, valore)}`;
  }
  // opzioni con l'anteprima (es. le mappe di Chi è l'Alieno): un disegno SVG per valore, si vede quello scelto
  function anteprime(o, valore) {
    if (!o.anteprime) return '';
    return `<div class="opz-anteprime" data-anteprime="${o.id}">${o.valori.map((v, i) => {
      const nome = esc(o.etichette ? o.etichette[i] : v);
      const disegno = o.anteprime[v] || `<div class="opz-casuale">${Object.values(o.anteprime).slice(0, 4).join('')}</div>`;
      return `<figure data-v="${esc(v)}" ${String(v) === String(valore) ? '' : 'hidden'}>${disegno}<figcaption>${nome}</figcaption></figure>`;
    }).join('')}</div>`;
  }
  // Le opzioni non si mostrano più come tendine bianche del browser: ogni <select> resta nascosto (è lui che tiene il
  // valore e manda "change", così il resto del codice non cambia) e al suo posto c'è un controllo nel tema del sito:
  // poche scelte brevi = pulsanti affiancati; tante o lunghe = un menu scuro a tendina con le voci in griglia.
  const ICONA_INIZIO = /^(\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(️|‍\p{Extended_Pictographic})*\s*/u;
  const separaIcona = (t) => { const m = String(t).match(ICONA_INIZIO); return m ? [m[0].trim(), String(t).slice(m[0].length)] : ['', String(t)]; };
  const chiaveOpz = (sel) => sel.dataset.opz || sel.id;
  function abbellisciOpzioni(radice, scelta = 'select[data-opz]') {
    if (!radice) return;
    for (const sel of radice.querySelectorAll(scelta)) {
      // una tendina che si ridisegna da sola (come quella dei giochi nella sala): si rifà anche il controllo
      if (sel.dataset.bello) { const vecchio = sel.nextElementSibling; if (vecchio && vecchio.dataset.per === chiaveOpz(sel)) vecchio.remove(); }
      sel.dataset.bello = '1';
      sel.classList.add('opz-nativa'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
      const voci = [...sel.options].map((o) => ({ v: o.value, t: o.textContent }));
      const brevi = voci.length <= 4 && voci.every((x) => x.t.length <= 24) && voci.reduce((s, x) => s + x.t.length, 0) <= 64;
      const box = document.createElement('div');
      box.className = brevi ? 'opz-chip' : 'opz-menu';
      box.dataset.per = chiaveOpz(sel);
      const conIcone = voci.some((x) => separaIcona(x.t)[0]);
      if (brevi) {
        box.setAttribute('role', 'radiogroup');
        box.style.setProperty('--n', voci.length);
        box.innerHTML = voci.map((x) => { const [ic, t] = separaIcona(x.t); return `<button type="button" role="radio" data-v="${esc(x.v)}">${ic ? `<i>${ic}</i>` : ''}<span>${esc(t)}</span></button>`; }).join('');
      } else {
        box.innerHTML = `<button type="button" class="opz-apri" aria-haspopup="listbox" aria-expanded="false"><i></i><span></span><b aria-hidden="true">▾</b></button>
          <div class="opz-lista" role="listbox" hidden>${voci.map((x) => { const [ic, t] = separaIcona(x.t); return `<button type="button" role="option" data-v="${esc(x.v)}">${conIcone ? `<i>${ic}</i>` : ''}<span>${esc(t)}</span></button>`; }).join('')}</div>`;
      }
      sel.after(box);
      sincronizzaOpzione(sel);
    }
  }
  function sincronizzaOpzione(sel) {
    const box = sel.nextElementSibling;
    if (!box || box.dataset.per !== chiaveOpz(sel)) return;
    for (const b of box.querySelectorAll('[data-v]')) { const si = b.dataset.v === sel.value; b.setAttribute(b.getAttribute('role') === 'radio' ? 'aria-checked' : 'aria-selected', String(si)); }
    const apri = box.querySelector('.opz-apri');
    if (apri) {
      const o = sel.options[sel.selectedIndex];
      const [ic, t] = separaIcona(o ? o.textContent : '');
      apri.querySelector('i').textContent = ic; apri.querySelector('i').hidden = !ic;
      apri.querySelector('span').textContent = t;
    }
  }
  function chiudiMenuOpzioni(tranne) {
    for (const m of $$('.opz-menu.aperto')) {
      if (m === tranne) continue;
      m.classList.remove('aperto'); m.querySelector('.opz-lista').hidden = true; m.querySelector('.opz-apri').setAttribute('aria-expanded', 'false');
    }
  }
  function scegliOpzione(box, v) {
    const sel = box.previousElementSibling;
    if (!sel || sel.tagName !== 'SELECT') return;
    if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    sincronizzaOpzione(sel);
  }
  document.addEventListener('click', (e) => {
    const box = e.target.closest && e.target.closest('.opz-chip, .opz-menu');
    if (!box) { chiudiMenuOpzioni(); return; }
    if (box.classList.contains('opz-menu') && e.target.closest('.opz-apri')) {
      const aperto = !box.classList.contains('aperto');
      chiudiMenuOpzioni(box);
      box.classList.toggle('aperto', aperto);
      const lista = box.querySelector('.opz-lista');
      lista.hidden = !aperto;
      box.querySelector('.opz-apri').setAttribute('aria-expanded', String(aperto));
      if (aperto) { const sc = lista.querySelector('[aria-selected="true"]') || lista.querySelector('[data-v]'); if (sc) sc.focus({ preventScroll: true }); }
      return;
    }
    const b = e.target.closest('[data-v]');
    if (!b) return;
    scegliOpzione(box, b.dataset.v);
    if (box.classList.contains('opz-menu')) { chiudiMenuOpzioni(); box.querySelector('.opz-apri').focus({ preventScroll: true }); }
  });
  document.addEventListener('keydown', (e) => {
    const box = e.target.closest && e.target.closest('.opz-menu.aperto');
    if (!box) return;
    const voci = [...box.querySelectorAll('.opz-lista [data-v]')];
    const i = voci.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); chiudiMenuOpzioni(); box.querySelector('.opz-apri').focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const k = Math.max(0, Math.min(voci.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); voci[k].focus(); }
  }, true);
  function opzioniVisibili(radice) {
    if (!radice) return;
    const valori = {};
    for (const el of radice.querySelectorAll('[data-opz]')) valori[el.dataset.opz] = valoreOpz(el);
    for (const box of radice.querySelectorAll('[data-se]')) {
      let se = {}; try { se = JSON.parse(box.dataset.se); } catch (_) { /* niente */ }
      box.hidden = !Object.entries(se).every(([k, v]) => v.map(String).includes(String(valori[k])));
    }
  }
  document.addEventListener('change', (e) => {
    const sel = e.target.closest && e.target.closest('select[data-opz]');
    if (!sel) return;
    sincronizzaOpzione(sel);
    opzioniVisibili(sel.closest('#imp-opzioni, #sala-opzioni'));
    const box = sel.closest('.imp-riga') && sel.closest('.imp-riga').nextElementSibling;
    if (box && box.dataset.anteprime === sel.dataset.opz) for (const f of box.querySelectorAll('figure')) f.hidden = f.dataset.v !== sel.value;
  });

  function disegnaImpostazioni() {
    const m = meta(scelto.gioco);
    if (!m) { $('#impostazioni').hidden = true; return; }
    $('#impostazioni').hidden = false;
    $('#imp-titolo').textContent = m.nome;
    $('#imp-desc').textContent = m.descrizione || '';
    $('#impostazioni [data-regole-di]').dataset.regoleDi = m.id;
    if (!m.giocatori.includes(scelto.posti)) scelto.posti = m.giocatori[0];
    $('#scelta-posti').innerHTML = m.giocatori.map((n) => `<button type="button" data-posti="${n}" aria-pressed="${n === scelto.posti}">${n}${m.id !== 'scopone' && n === 4 && ['briscola', 'scopa'].includes(m.id) ? ' <small>in coppia</small>' : ''}</button>`).join('');
    $('#imp-opzioni').innerHTML = m.opzioni.map((o) => selectOpzione(o, scelto.opzioni[o.id] ?? o.predefinito, 'class="imp-select"')).join('');
    abbellisciOpzioni($('#imp-opzioni'));
    opzioniVisibili($('#imp-opzioni'));
    for (const b of $$('#scelta-livello button')) b.setAttribute('aria-pressed', String(b.dataset.livello === scelto.livello));
    // giochi solo tra persone: niente computer; con un solo posto si gioca da soli
    const solo = scelto.posti === 1;
    $('#strada-computer').hidden = !!m.soloPersone && !solo; // da soli si può sempre giocare
    // giochi di collaborazione col computer (meta.senzaLivelli): il computer è un compagno, niente facile/medio/difficile
    $('#titolo-computer').textContent = solo ? 'Da solo' : m.senzaLivelli ? 'Con il computer in squadra' : 'Contro il computer';
    $('#scelta-livello').hidden = solo || !!m.senzaLivelli;
    $('#nota-amici').textContent = m.soloPersone
      ? 'Questo gioco si fa solo con altre persone: apri il tavolo e manda il link agli amici.'
      : 'Apri il tavolo e manda il link. I posti vuoti puoi riempirli col computer.';
  }

  $('#elenco-giochi').addEventListener('click', (e) => {
    const stella = e.target.closest('[data-preferito]');
    if (stella) {
      e.stopPropagation();
      const id = stella.dataset.preferito;
      if (preferiti.has(id)) preferiti.delete(id); else preferiti.add(id);
      mem.set('preferiti', JSON.stringify([...preferiti]));
      disegnaCategorie(); disegnaGiochi();
      return;
    }
    const t = e.target.closest('[data-gioco]');
    if (!t) return;
    scelto.gioco = t.dataset.gioco;
    scelto.opzioni = {};
    mem.set('gioco', scelto.gioco);
    for (const x of $$('.gioco-tessera')) x.setAttribute('aria-pressed', String(x === t));
    disegnaImpostazioni();
    vaiImpostazioni();
  });
  // dopo aver scelto un gioco si va dritti alle sue impostazioni (niente scorrimento a mano tra tutti i giochi)
  function vaiImpostazioni() {
    const el = $('#impostazioni'); if (!el || el.hidden) return;
    const lento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: lento ? 'auto' : 'smooth', block: 'start' }));
  }
  // nella ricerca, Invio sceglie il primo gioco trovato; la barra resta sempre in vista mentre si scorre
  $('#filtro-nome').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const primo = $('#elenco-giochi .gioco-tessera');
    if (primo) { primo.click(); e.target.blur(); }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-cambia-gioco]')) return;
    $('#filtro-nome').focus({ preventScroll: true });
    $('.filtri').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#scelta-posti').addEventListener('click', (e) => {
    const b = e.target.closest('[data-posti]');
    if (!b) return;
    scelto.posti = Number(b.dataset.posti);
    mem.set('posti', scelto.posti);
    disegnaImpostazioni();
  });
  $('#imp-opzioni').addEventListener('change', (e) => {
    if (!e.target.dataset.opz) return;
    scelto.opzioni[e.target.dataset.opz] = valoreOpz(e.target);
    // in più sullo stesso computer: i posti seguono il numero di giocatori
    if (e.target.dataset.opz === 'stessoPc' && Number(scelto.opzioni.stessoPc) > scelto.posti) { scelto.posti = Number(scelto.opzioni.stessoPc); disegnaImpostazioni(); }
  });
  $('#scelta-livello').addEventListener('click', (e) => {
    const b = e.target.closest('[data-livello]');
    if (!b) return;
    scelto.livello = b.dataset.livello;
    mem.set('livello', scelto.livello);
    disegnaImpostazioni();
  });

  function crea(controComputer) {
    const n = nome();
    if (!n) return;
    segnaRecente(scelto.gioco);
    socket.emit('creaStanza', { nome: n, id: mioId, gioco: scelto.gioco, posti: scelto.posti, opzioni: scelto.opzioni, controComputer: controComputer ? scelto.livello : null });
  }
  $('#gioca-solo').addEventListener('click', () => crea(true));
  $('#crea').addEventListener('click', () => crea(false));
  function entra() {
    const n = nome();
    const codice = $('#codice').value.trim().toUpperCase();
    if (!n) return;
    if (codice.length !== 4) { $('#codice').focus(); return avviso('Il codice ha 4 lettere'); }
    socket.emit('entraStanza', { nome: n, id: mioId, codice });
  }
  $('#entra').addEventListener('click', entra);
  $('#codice').addEventListener('keydown', (e) => e.key === 'Enter' && entra());

  // =================== SFIDA DEL GIORNO ===================
  const SFIDE = [['sudoku', '🔢', 'Sudoku'], ['wordle', '🟩', 'Wordle'], ['sblocca', '🧱', 'Sblocca'], ['bandiere', '🏳️', 'Bandiere'], ['kakuro', '➕', 'Kakuro'], ['sokoban', '📦', 'Spingi le casse'], ['mahjong', '🀄', 'Mahjong']];
  let sfidaDati = null;
  function disegnaSfide() {
    const fatte = (sfidaDati && sfidaDati.fatte) || [];
    $('#sfida-elenco').innerHTML = SFIDE.map(([id, ic, nomeG]) => {
      const x = sfidaDati && sfidaDati.giochi[id];
      return `<button type="button" class="sfida-bt ${fatte.includes(id) ? 'fatta' : ''}" data-sfida="${id}">
        <span class="sfida-ic">${ic}</span><span><b>${nomeG}</b><small>${esc(x ? x.titolo : '')}${fatte.includes(id) ? ' · ✓ fatta' : ''}</small></span></button>`;
    }).join('');
  }
  socket.on('classificaSfida', (d) => {
    sfidaDati = d; disegnaSfide();
    if ($('#classifica-sfida').hidden) return;
    const data = new Date(`${d.data}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#classifica-sfida-testo').innerHTML = `<p class="piccolo">${esc(data)}</p>${SFIDE.map(([id, ic, nomeG]) => {
      const x = d.giochi[id];
      return `<h3>${ic} ${nomeG} <small>${esc(x.titolo)}</small></h3>${x.lista.length ? `<ol class="sfida-classifica">${x.lista.slice(0, 10).map((v) => `<li><span>${esc(v.nome)}</span><b>${esc(v.testo)}</b></li>`).join('')}</ol>` : '<p class="piccolo">Nessuno ancora: sii il primo!</p>'}`;
    }).join('')}`;
  });
  disegnaSfide();
  socket.on('connect', () => socket.emit('classificaSfida', mioId));
  $('#sfida-elenco').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sfida]'); if (!b) return;
    const n = nome(); if (!n) return;
    segnaRecente(b.dataset.sfida);
    socket.emit('creaStanza', { nome: n, id: mioId, gioco: b.dataset.sfida, sfidaGiorno: true });
  });
  $('#apri-classifica-sfida').addEventListener('click', () => { $('#classifica-sfida').hidden = false; socket.emit('classificaSfida', mioId); $('#chiudi-classifica-sfida').focus(); });
  $('#chiudi-classifica-sfida').addEventListener('click', () => ($('#classifica-sfida').hidden = true));
  $('#classifica-sfida').addEventListener('click', (e) => { if (e.target.id === 'classifica-sfida') $('#classifica-sfida').hidden = true; });

  function tornaHome() {
    socket.emit('classificaSfida', mioId);
    mem.del('tavolo');
    stato = null;
    ultimaChat = 0; $('#messaggi').dataset.firma = ''; $('#messaggi').dataset.ultimo = ''; // il prossimo tavolo ha una chat sua
    firmaPartita = null;
    history.replaceState(null, '', location.pathname);
    for (const id of ['#fine', '#riepilogo', '#chat', '#conferma']) $(id).hidden = true;
    mostra('schermo-home');
  }
  function esci() { socket.emit('esci'); tornaHome(); }

  // =================== CONNESSIONE ===================
  socket.on('connect', () => {
    socket.emit('presenza', { id: mioId, imp: impronta, nome: mem.get('nome') || '' });
    const t = mem.get('tavolo');
    const n = mem.get('nome');
    if (t && n) socket.emit('entraStanza', { nome: n, id: mioId, codice: t, ritorno: true });
    if (Boss.attivo) socket.emit('boss', true);
    if (stato) $('#avviso').hidden = true;
  });
  socket.on('disconnect', () => avviso('Connessione persa, mi ricollego…', 60000));
  // ricollegandosi, il tavolo non c'era più (il sito si è riavviato): niente partita "fantasma" ferma sullo schermo
  socket.on('tavoloSparito', () => {
    const cera = !!stato;
    mem.del('tavolo');
    if (cera) tornaHome();
    avviso(cera ? 'Il tavolo non c\'è più: il sito si è riavviato e la partita è andata persa. Aprite un tavolo nuovo.' : 'Il tavolo di prima non c\'è più', 10000);
  });
  // il sito gratuito su Render si addormenta: se l'elenco dei giochi tarda, si spiega che si sta svegliando
  const tSveglia = setTimeout(() => { if (!giochi.length) $('#sveglia').hidden = false; }, 2500);
  socket.on('giochi', (g) => {
    clearTimeout(tSveglia); $('#sveglia').hidden = true;
    // i giochi in ordine alfabetico (nella home, nella sala e ovunque si elencano); "Ü" e "u", "2" e "10" come ci si aspetta
    giochi = [...g].sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base', numeric: true }));
    // un gioco salvato nel browser che non esiste più (un gioco tolto dal sito): si torna alla scopa
    if (!giochi.some((x) => x.id === scelto.gioco)) { scelto.gioco = 'scopa'; scelto.opzioni = {}; mem.set('gioco', 'scopa'); }
    disegnaGiochi(); if (stato) disegnaTutto(); });
  socket.on('errore', (m) => {
    avviso(m);
    if (!stato && /Nessun tavolo|pieno|iniziata/.test(m)) mem.del('tavolo');
    if (stato && stato.partita) disegnaGioco(); // rimette a posto le carte se la mossa non era valida
  });
  // il trucco segreto (!win): un suggerimento piccolo e discreto che sparisce da solo, e non resta da nessuna parte
  socket.on('segreto', ({ testo, durata } = {}) => {
    let el = document.getElementById('segreto');
    if (!el) { el = document.createElement('div'); el.id = 'segreto'; el.setAttribute('aria-live', 'polite'); el.addEventListener('click', () => { el.hidden = true; }); document.body.append(el); }
    el.textContent = testo || '';
    el.hidden = false;
    el.classList.remove('va'); void el.offsetWidth; el.classList.add('va');
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; el.textContent = ''; }, Math.min(8000, Math.max(1500, Number(durata) || 4500)));
  });
  // avviso solo per me scritto da un gioco (es. "ci sei quasi!" in Disegna e indovina): va anche nella chat
  socket.on('avvisoPrivato', (m) => {
    avviso(m);
    const li = document.createElement('li');
    li.className = 'sistema privato';
    li.textContent = `(solo per te) ${m}`;
    $('#messaggi').append(li);
    $('#messaggi').scrollTop = $('#messaggi').scrollHeight;
  });
  socket.on('allontanato', () => { tornaHome(); avviso('Sei stato tolto dal tavolo'); });

  socket.on('stato', (s) => {
    Boss.attivita(); // per l'overlay di caricamento se si preme Esc proprio adesso
    const primo = !stato;
    stato = s;
    // giochi che ricevono solo le novità (es. i tratti nuovi di Disegna e indovina) le uniscono a quello che hanno già
    if (s.partita && window.Tavoli && Tavoli[s.partita.gioco] && Tavoli[s.partita.gioco].ricevi) Tavoli[s.partita.gioco].ricevi(s.partita);
    mem.set('tavolo', s.codice);
    if (primo) { $('#avviso').hidden = true; history.replaceState(null, '', `?tavolo=${s.codice}`); }
    const firma = s.partita ? `${s.codice}:${s.gioco}:${s.partita.gioco}` : null;
    if (firma !== firmaPartita) { ui = {}; firmaPartita = firma; if (s.partita && !s.spettatore) segnaRecente(s.partita.gioco); }
    if (s.partita && !s.partita.finita && ui._fineDal) { ui._fineDal = null; ui._fineSubito = false; ui._record = null; } // rivincita: si riparte
    applicaTelefono(s);
    disegnaTutto();
    gestisciChat();
    disegnaVoto();
  });

  // =================== PASSA IL TELEFONO ===================
  // con l'opzione «Un solo dispositivo» il server manda anche le viste dei posti degli amici seduti qui (stato.locali):
  // si mostra lo schermo di chi deve giocare, dopo il sipario «Passa il telefono a…» (così nessuno sbircia)
  let tel = null; // { codice, attivo, coperto }
  function applicaTelefono(s, auto = true) {
    if (!s.locali || !s.partita || s.spettatore) { tel = null; $('#tel-sipario').hidden = true; $('#tel-barra').hidden = true; return; }
    if (s._mio == null) { s._mio = s.mioPosto; s._mia = s.partita; } // la vista del mio posto, come l'ha mandata il server
    const mio = s._mio;
    const vista = (k) => (k === mio ? s._mia : s.locali.viste[k]);
    const tutti = [mio, ...s.locali.posti];
    const deve = (k) => { const v = vista(k); return !!v && !v.finita && !v.inAttesa && (v.turno === k || (v.turno == null && s.locali.attesi.includes(k))); };
    if (!tel || tel.codice !== s.codice || !tutti.includes(tel.attivo)) tel = { codice: s.codice, attivo: tutti.find(deve) ?? mio, coperto: true };
    // chi aveva lo schermo ha finito: il telefono passa da solo a chi deve giocare
    if (auto && !deve(tel.attivo)) { const k = tutti.find(deve); if (k !== undefined) { tel.attivo = k; tel.coperto = true; ui = {}; } }
    if (vista(tel.attivo).finita) tel.coperto = false;
    s.partita = vista(tel.attivo);
    s.mioPosto = tel.attivo;
    const nome = (k) => esc((s.giocatori[k] && s.giocatori[k].nome) || '?');
    $('#tel-sipario').hidden = !tel.coperto;
    $('#tel-sipario').innerHTML = `<div class="tel-scheda"><p class="tel-icona">📱</p><h2>Passa il telefono a <b>${nome(tel.attivo)}</b></h2>
      <p>Gli altri non guardano lo schermo!</p><button type="button" class="bottone primario" data-tel-mostra>Sono ${nome(tel.attivo)}: mostra</button></div>`;
    $('#tel-barra').hidden = false;
    $('#tel-barra').innerHTML = `<span>📱 Schermo di <b>${nome(tel.attivo)}</b> · passa a:</span>${tutti.filter((k) => k !== tel.attivo).map((k) => `<button type="button" class="bottone mini-bt" data-tel-passa="${k}">${nome(k)}${deve(k) ? ' ⏳' : ''}</button>`).join('')}`;
  }
  document.addEventListener('click', (e) => {
    if (!tel || !stato) return;
    if (e.target.closest('[data-tel-mostra]')) { tel.coperto = false; $('#tel-sipario').hidden = true; return; }
    const b = e.target.closest('[data-tel-passa]');
    if (!b) return;
    tel.attivo = Number(b.dataset.telPassa); tel.coperto = true; ui = {};
    applicaTelefono(stato, false);
    disegnaTutto();
  });

  // =================== AMMIRAGLIATO (amministratore) ===================
  let adminDati = null;
  socket.on('adminAperto', () => { $('#admin').hidden = false; $('#chat').hidden = true; $('#globale').hidden = true; avviso('⚓ Benvenuto, Ammiraglio'); });
  socket.on('adminLista', (d) => {
    adminDati = d;
    setTimeout(() => { const el = $('#admin-comandi-stato'); if (el) el.textContent = d.comandiFino === -1 ? 'Comandi della chat: 🔇 spenti fino al riavvio' : d.comandiFino ? `Comandi della chat: 🔇 spenti per altri ${Math.ceil((d.comandiFino - Date.now()) / 60000)} min` : 'Comandi della chat: 🔊 attivi'; });
    $('#admin-lista').innerHTML = d.lista.map((x) => `<li class="${x.io ? 'io' : ''}"><div><b>${esc(x.nome)}</b>${x.admin ? ' ⚓' : ''}<small>${esc(x.dove)} · da ${x.minuti} min</small></div>
      ${x.io ? '<span class="piccolo">sei tu</span>' : `<button type="button" class="bottone mini-bt esilia" data-esilia="${esc(x.sid)}">⛵ Esilia</button>`}</li>`).join('');
    const bloccati = (d.bloccati || []).length ? `<p class="piccolo">Bloccati in automatico dalle difese:</p><ul class="admin-lista">${d.bloccati.map((b) => `<li><div><b>${esc(b.ip)}</b><small>${esc(b.motivo)} · ancora ${b.minuti} min${b.livello > 1 ? ` · ${b.livello}ª volta` : ''}</small></div><button type="button" class="bottone mini-bt" data-grazia-ip="${esc(b.ip)}">🕊️ Grazia</button></li>`).join('')}</ul>` : '';
    $('#admin-esiliati').innerHTML = bloccati + (d.esiliati.length ? `<p class="piccolo">In esilio:</p><ul class="admin-lista">${d.esiliati.map((e) => `<li><div><b>${esc(e.nome)}</b><small>ancora ${e.minuti} min</small></div><button type="button" class="bottone mini-bt" data-grazia="${esc(e.id)}">🕊️ Grazia</button></li>`).join('')}</ul>` : '');
  });
  $('#admin').addEventListener('click', (e) => {
    const b = e.target.closest('[data-esilia]');
    if (b) {
      const x = adminDati && adminDati.lista.find((y) => y.sid === b.dataset.esilia);
      if (x && confirm(`Esiliare ${x.nome} in fondo al mare?`)) socket.emit('adminEsilia', { sid: x.sid, minuti: Number($('#admin-durata').value), ip: $('#admin-ip').checked });
    }
    const g = e.target.closest('[data-grazia]');
    if (g) socket.emit('adminGrazia', { id: g.dataset.grazia });
    const gi = e.target.closest('[data-grazia-ip]'); if (gi) socket.emit('adminGraziaBan', { ip: gi.dataset.graziaIp });
  });
  $('#chiudi-admin').addEventListener('click', () => { $('#admin').hidden = true; });
  // spegnere / riaccendere i comandi della chat per tutto il sito
  $('#admin-comandi-spegni').addEventListener('click', () => {
    let m = $('#admin-comandi-durata').value;
    if (m === 'altro') { m = prompt('Per quanti minuti? (da 1 a 1440)', '30'); if (m === null) return; }
    m = Number(m);
    if (!(m === -1 || (m >= 1 && m <= 1440))) { avviso('Scrivi un numero di minuti da 1 a 1440'); return; }
    socket.emit('adminComandi', { minuti: m });
  });
  $('#admin-comandi-accendi').addEventListener('click', () => socket.emit('adminComandi', { minuti: 0 }));
  setInterval(() => { if (adminDati && !$('#admin').hidden) mostraStatoComandi(); }, 20000);
  function mostraStatoComandi() {
    const f = adminDati && adminDati.comandiFino;
    const el = $('#admin-comandi-stato');
    if (!el) return;
    el.textContent = f === -1 ? 'Comandi della chat: 🔇 spenti fino al riavvio' : f && f > Date.now() ? `Comandi della chat: 🔇 spenti per altri ${Math.ceil((f - Date.now()) / 60000)} min` : 'Comandi della chat: 🔊 attivi';
  }
  // l'esilio: animazione per tutti; chi viene esiliato poi vede la pagina dell'esilio e non può rientrare
  socket.on('esilio', (d) => { if (window.Esilio) Esilio.avvia(d); });
  function mostraSospeso(fino) {
    const min = Math.max(1, Math.ceil((fino - Date.now()) / 60000));
    $('#esiliato').innerHTML = `<div><p class="es-onda">🌊</p><h2>Accesso sospeso</h2><p>Da questo indirizzo il sito non è raggiungibile per un po'.</p><p class="piccolo">Riprova tra circa ${min < 120 ? `${min} minuti` : min < 2880 ? `${Math.ceil(min / 60)} ore` : `${Math.ceil(min / 1440)} giorni`}.</p></div>`;
    $('#esiliato').hidden = false;
  }
  socket.on('esiliato', ({ fino, sospeso } = {}) => {
    if (sospeso) return mostraSospeso(fino);
    const quando = fino ? new Date(fino).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long' }) : '';
    $('#esiliato').innerHTML = `<div><p class="es-onda">🌊</p><h2>Sei stato esiliato</h2><p>L'Ammiraglio ti ha mandato in fondo al mare.</p>${quando ? `<p class="piccolo">Potrai tornare dopo le ${esc(quando)}.</p>` : ''}</div>`;
    $('#esiliato').hidden = false;
  });

  socket.on('connect_error', (e) => {
    const msg = typeof e === 'string' ? e : e && e.message;
    if (msg === 'esiliato') { $('#esiliato').innerHTML = '<div><p class="es-onda">🌊</p><h2>Sei in esilio</h2><p>L\'Ammiraglio ti ha mandato in fondo al mare. Riprova più tardi.</p></div>'; $('#esiliato').hidden = false; }
    // bloccato in automatico dalle difese del sito: stessa schermata, con il tempo che manca
    if (msg && msg.startsWith('sospeso:')) mostraSospeso(Number(msg.slice(8)));
  });

  // risposta di fantasIA (la mini IA della chat): riquadro a parte, con a chi risponde
  function rigaIA(nome, a, perMe, testo) {
    return `<li class="ia"><b>${esc(nome)}</b>${a ? ` <span class="ia-a">→ ${perMe ? 'te' : esc(a)}</span>` : ''} ${esc(testo)}</li>`;
  }

  // =================== CHAT GLOBALE ===================
  const globale = { messaggi: [], nonLetti: 0 };
  function disegnaGlobale() {
    const ol = $('#messaggi-globale');
    ol.innerHTML = globale.messaggi.map((m) => (m.sistema ? `<li class="sistema">${esc(m.nome)} ${esc(m.testo)}</li>` : m.ia ? rigaIA(m.nome, m.a, !!m.aMe, m.testo) : `<li><b>${esc(m.mio ? 'Tu' : m.nome)}</b> ${esc(m.testo)}</li>`)).join('') || '<li class="sistema">Ancora nessun messaggio: scrivi tu il primo!</li>';
    ol.scrollTop = ol.scrollHeight;
    $('#globale-non-letti').hidden = !globale.nonLetti;
    $('#globale-non-letti-tavolo').hidden = !globale.nonLetti;
  }
  socket.on('chatGlobaleStorico', (lista) => { globale.messaggi = Array.isArray(lista) ? lista.slice(-60) : []; disegnaGlobale(); });
  socket.on('chatGlobale', (m) => {
    globale.messaggi.push(m);
    if (globale.messaggi.length > 60) globale.messaggi.shift();
    if ($('#globale').hidden) globale.nonLetti++;
    disegnaGlobale();
  });
  $('#apri-globale-tavolo').addEventListener('click', () => $('#apri-globale').click());
  $('#apri-globale').addEventListener('click', () => {
    $('#globale').hidden = false; globale.nonLetti = 0; disegnaGlobale();
    $('#testo-globale').focus();
  });
  $('#chiudi-globale').addEventListener('click', () => { $('#globale').hidden = true; });
  $('#form-globale').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('#testo-globale').value.trim();
    const nome = ($('#nome').value || mem.get('nome', '')).trim();
    if (!t) return;
    if (window.Fotocamera && Fotocamera.comando(t)) { $('#testo-globale').value = ''; return; } // !foto resta qui
    if (!nome) { avviso('Scrivi prima il tuo nome nella pagina iniziale'); return; }
    socket.emit('chatGlobale', { testo: t, nome });
    $('#testo-globale').value = '';
  });

  // =================== TERMINA LA PARTITA A VOTAZIONE ===================
  let tVoto = null;
  function disegnaVoto() {
    const v = stato && stato.partita && !stato.partita.finita ? stato.votoFine : null;
    $('#termina-voto').hidden = !(stato && stato.partita && !stato.partita.finita && !stato.spettatore);
    $('#torna-tavolo').hidden = !(stato && stato.partita && !stato.partita.finita && !stato.spettatore);
    const box = $('#voto-fine');
    clearInterval(tVoto);
    if (!v) { box.hidden = true; return; }
    const nome = (i) => (i === stato.mioPosto ? 'Tu' : (stato.giocatori[i] || {}).nome || '?');
    const votato = v.si.includes(stato.mioPosto) || v.no.includes(stato.mioPosto);
    const puo = v.votanti.includes(stato.mioPosto) && !votato;
    const fine = Date.now() + v.resta;
    const testo = () => `🗳️ <b>${esc(nome(v.da))}</b> ${v.da === stato.mioPosto ? 'hai proposto' : 'propone'} di ${v.tipo === 'restart' ? 'ricominciare la partita da capo' : 'terminare la partita'} · sì ${v.si.length}, no ${v.no.length} (servono ${v.servono} sì su ${v.votanti.length}) · ${Math.ceil(Math.max(0, fine - Date.now()) / 1000)} s`;
    box.innerHTML = `<span class="voto-testo">${testo()}</span>${puo ? `<button type="button" class="bottone mini-bt" data-voto="si">${v.tipo === 'restart' ? 'Sì, da capo' : 'Sì, terminiamo'}</button><button type="button" class="bottone mini-bt" data-voto="no">No, continuiamo</button>` : ''}`;
    box.hidden = false;
    tVoto = setInterval(() => { const t = box.querySelector('.voto-testo'); if (t) t.innerHTML = testo(); }, 1000);
  }
  $('#torna-tavolo').addEventListener('click', () => {
    const chi = (meta(stato.gioco) || {}).soloPersone ? 'il tuo posto resta vuoto' : 'al tuo posto gioca il computer';
    if (confirm(`Vuoi uscire da questa partita e tornare al tavolo? Gli altri continuano (${chi}) e tu li aspetti nella sala.`)) socket.emit('tornaAlTavolo');
  });
  $('#termina-voto').addEventListener('click', () => {
    if (stato && stato.votoFine) return;
    if (confirm('Vuoi proporre di terminare la partita? Se la maggioranza vota sì, si torna in sala.')) socket.emit('votoFine', true);
  });
  $('#voto-fine').addEventListener('click', (e) => { const b = e.target.closest('[data-voto]'); if (b) socket.emit(stato.votoFine && stato.votoFine.tipo === 'restart' ? 'votoRestart' : 'votoFine', b.dataset.voto === 'si'); });

  function disegnaTutto() {
    if (!stato || !giochi.length) return;
    disegnaSpettatore();
    // chi è tornato al tavolo aspetta nella sala finché la partita degli altri finisce
    const io = stato.giocatori && stato.giocatori[stato.mioPosto];
    const inSala = !!(stato.partita && !stato.partita.finita && io && io.inSala);
    $('#avviso-in-sala').hidden = !inSala;
    if (!stato.partita || inSala) { disegnaAttesa(); mostra('schermo-attesa'); }
    else { disegnaGioco(); mostra('schermo-gioco'); }
  }

  // =================== SALA D'ATTESA ===================
  const giocaInCoppia = () => stato.numPosti === 4 && ['briscola', 'scopa', 'scopone'].includes(stato.gioco);

  // giochi a squadre per posto (pari / dispari): la sala mostra già in che squadra finisce ogni posto
  function squadraSala(m, i) {
    const q = m.squadreSala;
    if (!q || stato.numPosti < q.min || (q.pari && stato.numPosti % 2)) return '';
    if (q.se && !Object.entries(q.se).every(([k, v]) => v.map(String).includes(String(stato.opzioni[k])))) return '';
    return `<span class="squadra">${esc(q.nomi[i % 2])}</span>`;
  }
  function disegnaAttesa() {
    const m = meta(stato.gioco);
    $('#codice-grande').textContent = stato.codice;
    $('#sala-gioco-nome').innerHTML = `<b>${esc(m.nome)}</b>${m.opzioni.map((o) => {
      const v = stato.opzioni[o.id];
      const i = o.valori.findIndex((x) => String(x) === String(v));
      return `<span>${esc(o.nome)}: ${esc(o.etichette ? o.etichette[i] : v)}</span>`;
    }).join('')}`;
    $('#sala-gioco-scelta').hidden = !stato.sonoHost;
    $('#sala-gioco-nome').hidden = stato.sonoHost;
    $('.sala-gioco [data-regole-di]').dataset.regoleDi = stato.gioco;
    // si ridisegna solo se il gioco o le opzioni cambiano (così un menu aperto non si chiude a ogni messaggio)
    const firmaSala = JSON.stringify([stato.codice, stato.gioco, stato.numPosti, stato.opzioni, giochi.length, stato.giocatori.some((x) => x && x.bot)]);
    if (stato.sonoHost && firmaSala !== $('#sala-gioco-scelta').dataset.firma) {
      $('#sala-gioco-scelta').dataset.firma = firmaSala;
      const conComputer = stato.giocatori.some((x) => x && x.bot);
      $('#sala-select').innerHTML = giochi.filter((g) => g.giocatori.includes(stato.numPosti) && (g.id === stato.gioco || !(g.soloPersone && conComputer)))
        .map((g) => `<option value="${g.id}" ${g.id === stato.gioco ? 'selected' : ''}>${esc(g.nome)}</option>`).join('');
      $('#sala-opzioni').innerHTML = m.opzioni.map((o) => selectOpzione(o, stato.opzioni[o.id], '')).join('');
      abbellisciOpzioni($('#sala-gioco-scelta'), '#sala-select');
      abbellisciOpzioni($('#sala-opzioni'));
      opzioniVisibili($('#sala-opzioni'));
    }

    const scambi = stato.scambi || [];
    // mentre si scrive il nome di un amico la lista non si ridisegna (si perderebbe il cursore)
    if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.telNome != null) return disegnaFineSala(m);
    $('#lista-posti').innerHTML = stato.giocatori.map((g, i) => {
      const io = i === stato.mioPosto && !stato.spettatore;
      if (stato.spettatore) {
        return g ? `<li><span>${esc(g.nome)} ${g.bot ? '<span class="distintivo">computer</span>' : ''}</span></li>`
          : `<li class="vuoto"><span>Posto libero</span><span class="posto-az"><button class="bottone mini-bt" data-prendi="${i}">Siediti qui</button></span></li>`;
      }
      const coppia = giocaInCoppia() ? `<span class="squadra">coppia ${i % 2 === 0 ? 'A' : 'B'}</span>` : squadraSala(m, i);
      if (!g && stato.sonoHost && m.passaTelefono && stato.opzioni.telefono === 'si') {
        return `<li class="vuoto"><span>📱 <input class="tel-nome" data-tel-nome="${i}" maxlength="18" placeholder="Nome di chi gioca qui" value="${esc(nomiTelefono[i] || '')}"></span>${coppia}</li>`;
      }
      if (!g) {
        return `<li class="vuoto"><span>Posto libero</span>${coppia}
          <span class="posto-az">
            ${stato.sonoHost && !m.soloPersone ? (m.senzaLivelli ? `<button class="bottone mini-bt" data-bot="medio" data-posto="${i}">Computer</button>` : `<span class="piccolo">Computer</span>${['facile', 'medio', 'difficile'].map((l) => `<button class="bottone mini-bt" data-bot="${l}" data-posto="${i}">${l}</button>`).join('')}`) : ''}
            <button class="bottone mini-bt" data-cambia="${i}">Siediti qui</button>
          </span></li>`;
      }
      const etichetta = g.bot ? `<span class="distintivo">computer${m.senzaLivelli ? '' : ` ${g.bot}`}</span>` : io ? '<span class="distintivo">tu</span>' : '';
      return `<li class="${io ? 'mio' : ''}"><span>${esc(g.nome)} ${etichetta}${!g.connesso ? ' <small>(non connesso)</small>' : ''}</span>${coppia}
        <span class="posto-az">
          ${m.masterUmano && !g.bot && stato.numPosti > 1 && !(Number(stato.opzioni.stessoPc) > 1) && stato.opzioni.modalita !== 'reale' ? (stato.sonoHost ? `<button class="bottone mini-bt" data-master="${i}" title="${g.master ? 'Torna a fare il master l\'IA' : 'Fa il master al posto dell\'IA'}">🎩 ${g.master ? 'Master ✕' : 'Master'}</button>` : g.master ? '<span class="distintivo">🎩 master</span>' : '') : ''}
          ${!io ? (scambi.some((x) => x.da === i && x.a === stato.mioPosto) ? `<button class="bottone mini-bt primario" data-cambia="${i}">✔ Accetta lo scambio</button>`
            : scambi.some((x) => x.da === stato.mioPosto && x.a === i) ? '<span class="piccolo">richiesta inviata…</span>'
            : `<button class="bottone mini-bt" data-cambia="${i}">${g.bot || stato.sonoHost ? 'Scambia posto' : 'Chiedi di scambiare'}</button>`) : ''}
          ${stato.sonoHost && !io ? `<button class="bottone mini-bt" data-togli="${i}">Togli</button>` : ''}
        </span></li>`;
    }).join('');

    disegnaFineSala(m);
  }
  function disegnaFineSala(m) {
    const liberi = stato.giocatori.filter((g) => !g).length;
    const telefono = m.passaTelefono && stato.opzioni.telefono === 'si';
    disegnaSalaExtra(m, liberi);
    $('#inizia').hidden = !stato.sonoHost;
    $('#inizia').disabled = liberi > 0 && !m.postiLiberiAlComputer && !telefono;
    $('#nota-attesa').textContent = liberi && telefono
      ? `📱 Un solo dispositivo: scrivi i nomi di chi gioca con te in ${liberi === 1 ? 'questo posto' : `questi ${liberi} posti`} (ci si passerà il telefono), oppure aspetta altri amici con il loro telefono.`
      : liberi && m.postiLiberiAlComputer
      ? `${liberi === 1 ? 'C\'è un posto libero' : `Ci sono ${liberi} posti liberi`}: se iniziate così ${liberi === 1 ? 'diventa un compagno' : 'diventano compagni'} del computer.`
      : liberi
      ? `${liberi === 1 ? 'Manca un giocatore' : `Mancano ${liberi} giocatori`}. ${stato.sonoHost ? (m.soloPersone ? 'Aspetta che arrivino gli amici: in questo gioco non si usa il computer.' : 'Aspetta gli amici o metti il computer nei posti liberi.') : ''}`
      : stato.sonoHost ? 'Tavolo al completo: puoi iniziare.' : 'Tavolo al completo: si aspetta che chi l\'ha aperto inizi la partita.';
  }

  $('#lista-posti').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.bot) socket.emit('aggiungiBot', { posto: Number(b.dataset.posto), livello: b.dataset.bot });
    if (b.dataset.togli) socket.emit('togliPosto', { posto: Number(b.dataset.togli) });
    if (b.dataset.master) socket.emit('scegliMaster', { posto: Number(b.dataset.master) });
    if (b.dataset.cambia) socket.emit('cambiaPosto', { posto: Number(b.dataset.cambia) });
    if (b.dataset.prendi) socket.emit('prendiPosto', { posto: Number(b.dataset.prendi) });
  });

  // =================== TORNEO E SERATA (dalla sala) ===================
  let serataScelti = null;
  function disegnaSalaExtra(m, liberi) {
    const box = $('#sala-extra');
    if (!stato.sonoHost || stato.spettatore) { box.hidden = true; return; }
    const adatti = giochi.filter((g) => g.giocatori.includes(stato.numPosti) && !(g.soloPersone && stato.giocatori.some((x) => x && x.bot)));
    if (!serataScelti || serataScelti.codice !== stato.codice) { serataScelti = new Set([stato.gioco]); serataScelti.codice = stato.codice; } // ogni tavolo ha la sua serata
    for (const id of [...serataScelti]) if (!adatti.some((g) => g.id === id)) serataScelti.delete(id); // tolti i giochi non più adatti
    const torneo = stato.numPosti === 2 ? `<div class="extra-riga"><b>🏆 Torneo a eliminazione</b>
      <p class="piccolo">Partecipano chi è al tavolo e chi entra col codice (guarda finché non tocca a lui); i posti che mancano li prende il computer.</p>
      <button type="button" class="bottone mini-bt" data-torneo="4">Torneo a 4</button><button type="button" class="bottone mini-bt" data-torneo="8">Torneo a 8</button></div>` : '';
    const aperta = box.querySelector('details[open]') ? 'open' : '';
    box.innerHTML = `${torneo}<details class="extra-riga" ${aperta}><summary><b>🎲 Serata a giochi misti</b> <small>(${serataScelti.size} ${serataScelti.size === 1 ? 'scelto' : 'scelti'})</small></summary>
      <p class="piccolo">Scegli da 2 a 8 giochi: si giocano uno dopo l'altro con questi giocatori. Ogni gioco vinto vale 3 punti.</p>
      <div class="serata-scelta">${adatti.map((g) => `<label><input type="checkbox" data-serata="${g.id}" ${serataScelti.has(g.id) ? 'checked' : ''}> ${esc(g.nome)}</label>`).join('')}</div>
      <button type="button" class="bottone mini-bt" data-serata-caso>🎲 4 a caso</button>
      <button type="button" class="bottone mini-bt primario" data-serata-via ${serataScelti.size < 2 || serataScelti.size > 8 || liberi ? 'disabled' : ''}>Inizia la serata</button>
      ${liberi ? '<small class="piccolo">Prima riempi tutti i posti.</small>' : ''}</details>`;
    box.hidden = false;
  }
  $('#sala-extra').addEventListener('change', (e) => {
    const c = e.target.closest('[data-serata]'); if (!c) return;
    if (c.checked) serataScelti.add(c.dataset.serata); else serataScelti.delete(c.dataset.serata);
    disegnaAttesa();
  });
  $('#sala-extra').addEventListener('click', (e) => {
    const t = e.target.closest('[data-torneo]');
    if (t) return socket.emit('iniziaTorneo', { dim: Number(t.dataset.torneo) });
    if (e.target.closest('[data-serata-caso]')) {
      const adatti = [...$$('#sala-extra [data-serata]')].map((x) => x.dataset.serata);
      for (let i = adatti.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [adatti[i], adatti[j]] = [adatti[j], adatti[i]]; }
      serataScelti = new Set(adatti.slice(0, 4)); serataScelti.codice = stato.codice;
      return disegnaAttesa();
    }
    if (e.target.closest('[data-serata-via]')) socket.emit('iniziaSerata', { giochi: [...serataScelti] });
  });
  // il tabellone del torneo e la classifica della serata (a fine partita)
  function riquadroTorneo() {
    const t = stato.torneo;
    if (!t) return '';
    const nome = (k) => (k === null || k === undefined ? '…' : t.nomi[k] === null ? '—' : esc(t.nomi[k]));
    const turni = t.turni.map((tu) => `<div class="tt-turno"><h4>${esc(tu.nome)}</h4>${tu.incontri.map((x) => `<div class="tt-inc ${x.v === null ? 'aperto' : ''}">
      <span class="${x.v === x.a ? 'vince' : x.v !== null ? 'perde' : ''}">${nome(x.a)}</span><span class="${x.v === x.b ? 'vince' : x.v !== null ? 'perde' : ''}">${nome(x.b)}</span></div>`).join('')}</div>`).join('');
    const stato2 = t.finito ? `<p class="tt-campione">🥇 ${nome(t.campione)} vince il torneo!</p>` : t.resta !== null ? `<p class="piccolo" data-conto="${Date.now() + t.resta}">Il prossimo incontro parte da solo tra <b>${Math.ceil(t.resta / 1000)}</b> s</p>` : '';
    return `<div class="torneo-tab"><h3>🏆 Torneo a ${t.dim}</h3><div class="tt-turni">${turni}</div>${stato2}</div>`;
  }
  function riquadroSerata() {
    const se = stato.serata;
    if (!se) return '';
    const ord = se.punti.map((x, i) => [i, x]).sort((a, b) => b[1] - a[1]);
    const nomeG = (id) => esc((giochi.find((g) => g.id === id) || { nome: id }).nome);
    const prossimo = !se.finita && se.resta !== null ? `<p class="piccolo" data-conto="${Date.now() + se.resta}">Prossimo gioco: <b>${nomeG(se.giochi[se.k])}</b> tra <b>${Math.ceil(se.resta / 1000)}</b> s</p>` : '';
    return `<div class="torneo-tab"><h3>🎲 Serata ${se.finita ? '· classifica finale' : `· ${se.k} di ${se.giochi.length} giochi`}</h3>
      <ol class="serata-punti">${ord.map(([i, x]) => `<li><span>${esc(nomeDi(i))}</span><b>${x}</b></li>`).join('')}</ol>
      <p class="piccolo">${se.giochi.map((id, k) => `${k < se.storia.length ? '✓' : k === se.k && !se.finita ? '▶' : '·'} ${nomeG(id)}`).join(' &nbsp; ')}</p>${prossimo}</div>`;
  }
  setInterval(() => {
    for (const el of $$('[data-conto]')) { const b = el.querySelector('b:last-of-type'); if (b) b.textContent = Math.max(0, Math.ceil((Number(el.dataset.conto) - Date.now()) / 1000)); }
  }, 500);

  // =================== SPETTATORI ===================
  // chi entra in un tavolo pieno guarda con gli occhi di un giocatore (lo sceglie qui); non può muovere
  function disegnaSpettatore() {
    const sp = !!stato.spettatore;
    document.body.classList.toggle('spettatore', sp);
    $('#testo-chat').placeholder = sp && stato.partita && !stato.partita.finita ? 'Scrivi agli altri spettatori (i giocatori non leggono)' : 'Scrivi agli altri';
    const barra = $('#barra-spett'), sala = $('#spett-sala');
    if (!sp) { barra.hidden = true; sala.hidden = true; return; }
    // chi guarda dallo stesso dispositivo di un giocatore può seguire solo lui (stato.soloPosti)
    const opzioni = stato.giocatori.map((g, i) => (g && (!stato.soloPosti || stato.soloPosti.includes(i)) ? `<option value="${i}" ${i === stato.segue ? 'selected' : ''}>${esc(g.nome)}${g.bot ? ' (PC)' : ''}</option>` : '')).join('');
    const liberi = (stato.postiLiberi || []).map((i) => `<button type="button" class="bottone mini-bt" data-prendi-posto="${i}">🪑 Gioca al posto di ${esc((stato.giocatori[i] || {}).nome || `posto ${i + 1}`)}</button>`).join('');
    const quanti = (stato.spettatori || []).length;
    barra.innerHTML = `<span>👀 Stai guardando con gli occhi di</span><select data-segui aria-label="Giocatore da seguire">${opzioni}</select><span class="piccolo">${quanti} ${quanti === 1 ? 'spettatore' : 'spettatori'}</span>${liberi}`;
    barra.hidden = !stato.partita;
    sala.innerHTML = `👀 Sei spettatore: il tavolo è pieno. ${(stato.postiLiberi || []).length ? 'Si è liberato un posto: premi «Siediti qui».' : 'Se si libera un posto potrai sederti.'}`;
    sala.hidden = !!stato.partita;
    $('#inizia').hidden = true;
  }
  for (const el of [$('#barra-spett')]) {
    el.addEventListener('change', (e) => { if (e.target.matches('[data-segui]')) { ui = {}; socket.emit('segui', { posto: Number(e.target.value) }); } });
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-prendi-posto]'); if (b) socket.emit('prendiPosto', { posto: Number(b.dataset.prendiPosto) }); });
  }
  socket.on('tavoloChiuso', () => { tornaHome(); avviso('Il tavolo che guardavi è stato chiuso'); });

  // =================== REAZIONI RAPIDE ===================
  const REAZIONI = ['👍', '😂', '😮', '😡', '👏', '🔥', '😭', 'GG'];
  $('#reazioni').innerHTML = REAZIONI.map((r) => `<button type="button" data-reazione="${r}">${r}</button>`).join('');
  $('#apri-reazioni').addEventListener('click', () => {
    const r = $('#reazioni'); r.hidden = !r.hidden; $('#apri-reazioni').setAttribute('aria-expanded', String(!r.hidden));
  });
  $('#reazioni').addEventListener('click', (e) => {
    const b = e.target.closest('[data-reazione]'); if (!b) return;
    socket.emit('reazione', b.dataset.reazione);
    $('#reazioni').hidden = true; $('#apri-reazioni').setAttribute('aria-expanded', 'false');
  });
  socket.on('reazione', ({ r, nome, posto, spettatore } = {}) => {
    if (!REAZIONI.includes(r)) return;
    const voli = $('#voli');
    if (voli.childElementCount > 12) voli.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `volo ${r === 'GG' ? 'testo' : ''}`;
    el.style.left = `${8 + Math.random() * 78}%`;
    const chi = posto === stato?.mioPosto && !stato?.spettatore ? 'Tu' : `${spettatore ? '👀 ' : ''}${nome}`;
    el.innerHTML = `<span class="volo-r">${esc(r)}</span><span class="volo-n">${esc(chi)}</span>`;
    voli.append(el);
    setTimeout(() => el.remove(), 2600);
  });
  $('#sala-select').addEventListener('change', (e) => socket.emit('impostaGioco', { gioco: e.target.value, opzioni: {} }));
  $('#sala-opzioni').addEventListener('change', () => {
    const opzioni = {};
    for (const s of $$('#sala-opzioni [data-opz]')) opzioni[s.dataset.opz] = valoreOpz(s);
    socket.emit('impostaGioco', { gioco: stato.gioco, opzioni });
  });
  // i nomi degli amici sullo stesso dispositivo (si ricordano nel browser per la prossima partita)
  const nomiTelefono = (() => { try { return JSON.parse(mem.get('nomiTelefono', '{}')) || {}; } catch { return {}; } })();
  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.telNome;
    if (k == null) return;
    nomiTelefono[k] = e.target.value;
    mem.set('nomiTelefono', JSON.stringify(nomiTelefono));
  });
  $('#inizia').addEventListener('click', () => socket.emit('inizia', { nomi: stato ? stato.giocatori.map((g, i) => (g ? null : nomiTelefono[i] || null)) : [] }));
  $('#esci-attesa').addEventListener('click', esci);
  $('#copia-link').addEventListener('click', async () => {
    const link = `${location.origin}${location.pathname}?tavolo=${stato.codice}`;
    try { await navigator.clipboard.writeText(link); avviso('Link copiato: mandalo agli amici'); } catch { prompt('Copia questo link', link); }
  });

  // =================== TAVOLO ===================
  function slot(posto) {
    const n = stato.numPosti;
    const rel = (posto - stato.mioPosto + n) % n;
    if (n === 2) return rel === 0 ? 0 : 2;
    if (n === 3) return [0, 1, 3][rel];
    return rel;
  }
  const nomeDi = (posto) => (posto === stato.mioPosto && !stato.spettatore ? 'Tu' : (stato.giocatori[posto] && stato.giocatori[posto].nome) || '?');

  const ctx = {
    get stato() { return stato; },
    get partita() { return stato.partita; },
    get mio() { return stato.mioPosto; },
    get ui() { return ui; },
    nome: nomeDi,
    slot,
    // passa il telefono: la mossa è di chi ha lo schermo in questo momento
    invia(azione) { if (!stato.spettatore) socket.emit('azione', stato._mio != null && stato.mioPosto !== stato._mio ? { ...azione, per: stato.mioPosto } : azione); },
    chat(testo) { socket.emit('chat', testo); }, // per i pulsanti che mandano un comando (es. !ricarica)
    emetti(evento, dati) { socket.emit(evento, dati); },
    ridisegna() { disegnaGioco(); },
    avviso,
  };

  function statoTurno(p, T) {
    const personalizzato = T.stato && T.stato(ctx);
    if (p.finita) return 'Partita finita';
    if (p.fase === 'riepilogo') return 'Fine smazzata';
    if (p.inCorso) return p.inCorso.posto === stato.mioPosto ? 'Prendi' : `${nomeDi(p.inCorso.posto)} prende`;
    if (p.inAttesa) return (T.statoAttesa && T.statoAttesa(ctx)) || 'Si raccoglie…';
    if (personalizzato) return personalizzato;
    if (p.turno === stato.mioPosto) return 'Tocca a te';
    return `Tocca a ${nomeDi(p.turno)}`;
  }

  function targhetta(posto, p) {
    const g = stato.giocatori[posto];
    const compagno = p.aSquadre && posto !== stato.mioPosto && posto % 2 === stato.mioPosto % 2;
    const classi = ['targhetta', p.turno === posto ? 'di-turno' : '', g && !g.connesso && !g.bot ? 'assente' : ''].join(' ');
    const badge = g && g.bot ? '<span class="bot" title="Computer">PC</span>' : g && g.autoplay ? '<span class="bot" title="Gioca il computer">auto</span>' : '';
    return `<div class="${classi}">${esc(posto === stato.mioPosto ? g.nome : nomeDi(posto))}${compagno ? ' <span class="compagno" title="Compagno">♦</span>' : ''}${badge}</div>`;
  }

  // sul telefono una mano con tante carte (scopone, UNO…) non deve uscire dallo schermo: le carte si sovrappongono
  // quanto basta per stare nella larghezza disponibile
  function stringiMano() {
    const m = $('#mano');
    if (!m || m.hidden || m.classList.contains('larga')) return;
    const cont = m.querySelector('.uno-mano') || m; // UNO ha la sua fila di carte dentro la mano
    const carte = [...cont.children].filter((c) => c.classList.contains('carta') || c.classList.contains('uno-carta'));
    carte.forEach((c) => { c.style.marginLeft = ''; });
    if (carte.length < 2) return;
    const cs = getComputedStyle(cont), gap = parseFloat(cs.columnGap) || 0;
    const margini = carte.slice(1).map((c) => parseFloat(getComputedStyle(c).marginLeft) || 0);
    const tot = carte.reduce((t, c) => t + c.offsetWidth, 0) + margini.reduce((a, b) => a + b, 0) + gap * (carte.length - 1);
    const W = Math.min(cont.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0), document.documentElement.clientWidth) - 8;
    if (tot <= W) return;
    const meno = (tot - W) / (carte.length - 1);
    carte.slice(1).forEach((c, i) => { c.style.marginLeft = `${margini[i] - meno}px`; });
  }
  window.addEventListener('resize', () => stringiMano());
  // la prima volta il tavolo può non avere ancora la sua misura (si apre proprio in quel momento): le carte non si
  // stringevano abbastanza e nello scopone dal telefono la mano usciva di lato e rimpiccioliva tutta la pagina
  if (window.ResizeObserver) new ResizeObserver(() => stringiMano()).observe(document.querySelector('#tavolo .io'));

  function disegnaGioco() {
    const p = stato.partita;
    const T = Tavoli[p.gioco];
    if (T.reset) T.reset(ctx);
    const m = meta(stato.gioco);
    const torneo = stato.torneo && !stato.torneo.finito ? ` · 🏆 ${stato.torneo.turni[stato.torneo.r].nome}` : '';
    const serata = stato.serata && !stato.serata.finita ? ` · 🎲 ${Math.min(stato.serata.k + 1, stato.serata.giochi.length)}/${stato.serata.giochi.length}` : '';
    $('#barra-titolo').textContent = (m ? m.nome : '') + (stato.sfida ? (stato.sfida.prova ? ' · 🗓️ prova' : ' · 🗓️ Sfida del giorno') : '') + torneo + serata;
    const st = $('#stato-turno');
    st.textContent = statoTurno(p, T);
    const mioTurno = p.turno === stato.mioPosto && !p.inAttesa && !p.finita && !stato.spettatore;
    if (stato.spettatore) st.textContent = st.textContent.replace(/^Tocca a te/, `Tocca a ${nomeDi(stato.mioPosto)}`);
    st.classList.toggle('mio', mioTurno);
    avvisoTurno(mioTurno);

    const punt = T.punteggio ? T.punteggio(ctx) : '';
    $('#punteggio').hidden = !punt;
    $('#punteggio').innerHTML = punt;

    // posti degli altri
    for (const el of $$('.posto-altro')) el.innerHTML = '';
    // Giochi senza carte (T.libero): il tabellone occupa tutto e gli avversari stanno in una fila in alto.
    $('#tavolo').classList.toggle('libero', !!T.libero);
    if (T.libero && !T.senzaFila) { // senzaFila: il gioco mostra da sé gli avversari (es. poker)
      $('.posto-altro[data-slot="2"]').innerHTML = `<div class="fila-avversari">${Array.from({ length: p.n }, (_, posto) => posto)
        .filter((posto) => posto !== stato.mioPosto)
        .map((posto) => `<div class="avversario">${targhetta(posto, p)}<div class="info-posto" data-info="${posto}">${T.infoPosto ? T.infoPosto(ctx, posto) : ''}</div><div class="bolla-posto" data-bolla="${posto}"></div></div>`).join('')}</div>`;
    }
    for (let posto = 0; posto < p.n && !T.libero; posto++) {
      const s = slot(posto);
      if (s === 0) continue;
      const el = $(`.posto-altro[data-slot="${s}"]`);
      const n = p.carteInMano ? p.carteInMano[posto] : 0;
      el.innerHTML = `${targhetta(posto, p)}
        <div class="ventaglio ${n > 6 ? 'stretto' : ''}">${Carte.retro().repeat(Math.min(n, 14))}${n > 6 ? `<span class="conta">${n}</span>` : ''}</div>
        <div class="info-posto" data-info="${posto}">${T.infoPosto ? T.infoPosto(ctx, posto) : ''}</div>
        <div class="bolla-posto" data-bolla="${posto}"></div>`;
    }
    $('#mio-nome').innerHTML = `${targhetta(stato.mioPosto, p)}<div class="info-posto" data-info="${stato.mioPosto}">${T.infoPosto ? T.infoPosto(ctx, stato.mioPosto) : ''}</div><div class="bolla-posto" data-bolla="${stato.mioPosto}"></div>`;

    $('#panno').className = `panno panno-${p.gioco}`;
    // giochi in tempo reale: se il pannello non è cambiato non si ricostruisce (rifarlo a ogni aggiornamento staccava
    // il campo di gioco per un attimo e si sentiva uno scatto)
    const htmlPanno = T.panno(ctx), primo = $('#panno').firstElementChild;
    if (!(T.tick && primo && primo._html === htmlPanno)) { $('#panno').innerHTML = htmlPanno; if ($('#panno').firstElementChild) $('#panno').firstElementChild._html = htmlPanno; }
    if (T.dopo) T.dopo(ctx); // es. rimettere il cursore nella casella dove si stava scrivendo
    $('#mano').className = `mano ${mioTurno ? 'attiva' : ''} ${T.manoLarga ? 'larga' : ''}`;
    $('#mano').innerHTML = T.mano ? T.mano(ctx) : '';
    $('#mano').hidden = !!T.libero && !T.mano;
    stringiMano();
    const inStudio = stato.giocatori.map((g, i) => (g && g.nascosto && i !== stato.mioPosto ? nomeDi(i) : null)).filter(Boolean);
    $('#pausa-studio').hidden = !stato.inPausa;
    $('#pausa-studio').textContent = stato.esecuzione ? (stato.esecuzioneTipo === 'papi' ? '🚗 Enrico Papi: il gioco è fermo per tutti' : '🌋 Esecuzione pubblica in corso: il gioco è fermo per tutti')
      : stato.inPausa ? `⏸ Partita in pausa: ${inStudio.join(', ') || 'qualcuno'} ha aperto le dispense` : '';
    evidenziaPescate(p);
    const az = T.azioni ? T.azioni(ctx) : '';
    $('#azioni').innerHTML = az;
    $('#azioni').hidden = !az;

    disegnaEvento(p);
    disegnaRiepilogo(p, T);
    disegnaFine(p);
    mostraBolleRecenti();
  }

  // Carta appena pescata (scala 40, briscola…): un bordo leggero e l'etichetta "nuova" per 2,5 secondi.
  // Se in mano entrano più di 2 carte insieme è una nuova distribuzione e non si evidenzia nulla.
  const DURATA_NUOVA = 2500;
  let tNuova = null;
  function evidenziaPescate(p) {
    if (!Array.isArray(p.mano)) return;
    const ids = p.mano.map((c) => c.id);
    if (!ui._manoPrima) { ui._manoPrima = ids; ui._pescate = []; return; }
    const prima = new Set(ui._manoPrima);
    const nuove = ids.filter((id) => !prima.has(id));
    if (nuove.length > 2) ui._pescate = [];
    else if (nuove.length) { ui._pescate = nuove; ui._pescateDal = Date.now(); }
    ui._pescate = ui._pescate.filter((id) => ids.includes(id));
    ui._manoPrima = ids;
    // l'etichetta "nuova" dura 2,5 secondi e sfuma; il ritardo negativo la fa ripartire da dove era se il tavolo si ridisegna
    const passati = Date.now() - (ui._pescateDal || 0);
    if (passati >= DURATA_NUOVA) return;
    for (const id of ui._pescate) for (const el of $$(`#tavolo .carta[data-id="${CSS.escape(id)}"]`)) {
      el.classList.add('pescata');
      el.style.setProperty('--t-pescata', `${-passati}ms`);
    }
    clearTimeout(tNuova);
    tNuova = setTimeout(() => $$('#tavolo .carta.pescata').forEach((el) => el.classList.remove('pescata')), DURATA_NUOVA - passati + 50);
  }

  function disegnaEvento(p) {
    const e = p.evento;
    if (!e || e.id === ultimoEvento) return;
    const nuovo = ultimoEvento !== 0 || Date.now() - caricamento > 1500;
    ultimoEvento = e.id;
    if (!nuovo) return;
    let t;
    if (e.posto == null) t = e.testo;
    else if (e.posto === stato.mioPosto) t = e.testoIo.charAt(0).toUpperCase() + e.testoIo.slice(1);
    else if (e.testoTe && e.bersaglio === stato.mioPosto) t = `${nomeDi(e.posto)} ${e.testoTe}`;
    else t = `${nomeDi(e.posto)} ${e.testo}`;
    if (e.bersaglio != null) t = t.replace('@', e.bersaglio === stato.mioPosto ? 'te' : nomeDi(e.bersaglio));
    if (e.forte) { annuncio(t); bip(880, 0.2); } else avviso(t, 1700);
  }
  const caricamento = Date.now();

  let fineRiepilogo = 0;
  let tRiepilogo;
  function disegnaRiepilogo(p, T) {
    const html = p.fase === 'riepilogo' && !p.finita && T.riepilogo ? T.riepilogo(ctx) : null;
    $('#riepilogo').hidden = !html;
    clearInterval(tRiepilogo);
    if (!html) { fineRiepilogo = 0; return; }
    $('#riepilogo-scheda').innerHTML = `${html}
      <button id="continua" class="bottone primario">Continua</button>
      <p class="piccolo" id="conto-rovescia"></p>`;
    $('#continua').addEventListener('click', () => socket.emit('continua'));
    $('#conto-rovescia').textContent = 'Si continua quando qualcuno preme "Continua".';
  }

  // A partita finita la schermata dei risultati arriva dopo qualche secondo: prima si vede come si è vinto
  // (linea del tris, quattro in fila, scacco matto...). Intanto una barretta permette di aprirla subito.
  const RITARDO_FINE = 2500; // i risultati si aprono da soli dopo 2,5 secondi
  let tFine = null;
  function disegnaFine(p) {
    $('#tavolo').classList.toggle('finita', !!p.finita);
    if (!p.finita) { ui._inCorso = true; $('#fine').hidden = true; $('#fine-barra').hidden = true; return; }
    const r = p.risultato;
    contaStatistica(p, r);
    if (!ui._fineDal) {
      ui._fineDal = Date.now();
      clearTimeout(tFine);
      tFine = setTimeout(() => { if (stato && stato.partita && stato.partita.finita) disegnaGioco(); }, RITARDO_FINE + 60);
    }
    const presto = !ui._fineSubito && Date.now() - ui._fineDal < RITARDO_FINE;
    if (presto) {
      const vinto = r.vincitori.includes(stato.mioPosto);
      const breve = r.titolo ? r.titolo : r.pareggio ? 'Pareggio' : vinto && !stato.spettatore ? (p.aSquadre ? 'Avete vinto!' : 'Hai vinto!') : r.vincitori.length ? `Vince ${r.vincitori.map((i) => nomeDi(i)).join(' e ')}` : 'Fine';
      $('#fine-barra').innerHTML = `<span>🏁 Partita finita · <b>${esc(breve)}</b></span><button type="button" class="bottone mini-bt" data-vedi-fine>Vedi i risultati</button><button type="button" class="bottone mini-bt" data-lobby>🏠 Torna alla lobby</button>`;
      $('#fine-barra').hidden = false;
      $('#fine').hidden = true;
      return;
    }
    $('#fine-barra').hidden = true;
    $('#fine').hidden = false;
    const T = Tavoli[p.gioco];
    const nomi = (posti) => (p.aSquadre ? posti.map((i) => nomeDi(i)).join(' e ') : nomeDi(posti[0]));
    const hoVinto = r.vincitori.includes(stato.mioPosto);
    let titolo;
    if (r.titolo) titolo = r.titolo; // es. Fast West: "Vince il west" quando cadono tutti
    else if (r.pareggio) titolo = 'Pareggio';
    else if (hoVinto && !stato.spettatore) titolo = p.aSquadre ? 'Avete vinto!' : 'Hai vinto!';
    else if (!r.vincitori.length) titolo = 'Partita finita'; // nessun vincitore (es. Wordle da soli, parola non trovata)
    else titolo = `Vince ${nomi(r.vincitori)}`;
    const alContrario = r.etichetta === 'penalità' || r.crescente;
    // chi ha vinto va sempre in cima (es. Indovina il numero in tanti: vince chi lo trova, anche se ha provato più volte)
    const vince = (f) => (!r.pareggio && f.posti.some((i) => r.vincitori.includes(i)) ? 0 : 1);
    const ordinate = [...r.fazioni].sort((a, b) => vince(a) - vince(b) || (alContrario ? a.punti - b.punti : b.punti - a.punti));
    const vittorie = stato.giocatori.map((g, i) => (g ? `<span>${esc(nomeDi(i))} <b>${g.vittorie}</b></span>` : '')).join('');
    const rec = recordPersonale(p, r, alContrario);
    $('#fine-scheda').innerHTML = `
      <h2>${esc(titolo)}</h2>
      ${T.riepilogo && p.riepilogo ? `<details class="dettaglio"><summary>Ultima smazzata</summary>${T.riepilogo(ctx)}</details>` : ''}
      <ul class="fine-punti">${ordinate.map((f) => `<li class="${r.vincitori.includes(f.posti[0]) && !r.pareggio ? 'vince' : ''}">
        <span>${esc(nomi(f.posti))}</span><span class="p">${f.punti} <small>${r.etichetta}</small></span></li>`).join('')}</ul>
      ${rec}
      ${riquadroTorneo()}${riquadroSerata()}
      ${stato.torneo || stato.serata ? '' : `<p class="piccolo">Partite vinte a questo tavolo</p><div class="vittorie">${vittorie}</div>`}
      ${(stato.torneo && !stato.torneo.finito) || (stato.serata && !stato.serata.finita) ? `${stato.sonoHost ? '<button class="bottone leggero" data-fine="sala">Interrompi e torna alla lobby</button>' : ''}` : stato.spettatore ? '<p class="piccolo">👀 Stai guardando: la rivincita la avvia chi ha aperto il tavolo.</p><button class="bottone leggero" data-fine="esci">Smetti di guardare</button>' : stato.sonoHost
        ? `<button class="bottone primario" data-fine="rivincita">Rivincita</button>${sceltaAltroGioco()}<button class="bottone" data-fine="sala">🏠 Torna alla lobby</button>`
        : '<p class="piccolo">La rivincita la avvia chi ha aperto il tavolo.</p><button class="bottone primario" data-fine="sala">🏠 Torna alla lobby</button>'}
      ${stato.spettatore ? '' : '<button class="bottone leggero" data-fine="esci">Torna all\'ingresso</button>'}`;
  }
  // RECORD PERSONALE: il miglior risultato di sempre in questo gioco, con queste opzioni e questo numero di giocatori
  // (salvato nel browser). Si aggiorna una volta sola per partita; "meno è meglio" vale per tiri, tempi, penalità…
  function recordPersonale(p, r, alContrario) {
    const mia = r.fazioni.find((f) => f.posti.length === 1 && f.posti[0] === stato.mioPosto);
    if (stato.spettatore || !mia || !Number.isFinite(Number(mia.punti)) || p.aSquadre) return '';
    const opz = Object.keys(stato.opzioni || {}).sort().map((k) => `${k}=${stato.opzioni[k]}`).join('&');
    const chiave = `record:${p.gioco}:${p.n}:${r.etichetta}:${opz}`;
    const valore = Number(mia.punti);
    if (!ui._record) {
      const prima = mem.get(chiave);
      const vecchio = prima == null ? null : Number(prima);
      const nuovo = vecchio === null || (alContrario ? valore < vecchio : valore > vecchio);
      if (nuovo) mem.set(chiave, String(valore));
      ui._record = { nuovo: nuovo && vecchio !== null, primo: vecchio === null, vecchio, migliore: nuovo ? valore : vecchio };
    }
    const x = ui._record;
    if (x.nuovo) return `<p class="record nuovo">🏅 Nuovo record personale: <b>${valore}</b> ${esc(r.etichetta)} <small>(prima: ${x.vecchio})</small></p>`;
    if (x.primo) return `<p class="record">📌 Primo risultato salvato: <b>${valore}</b> ${esc(r.etichetta)}. Prova a batterlo!</p>`;
    return `<p class="record">🏅 Il tuo record: <b>${x.migliore}</b> ${esc(r.etichetta)}</p>`;
  }

  // LE MIE STATISTICHE: quante partite ho giocato e vinto in ogni gioco (salvate nel browser, una volta per partita)
  function leggiStatistiche() { try { return JSON.parse(mem.get('statistiche', '{}')) || {}; } catch { return {}; } }
  function contaStatistica(p, r) {
    // conta solo le partite viste mentre erano in corso (non quelle già finite ritrovate ricaricando la pagina)
    if (ui._stat || !ui._inCorso || stato.spettatore || stato.mioPosto == null || stato.mioPosto < 0) return;
    ui._stat = true;
    const st = leggiStatistiche();
    const x = st[p.gioco] || { giocate: 0, vinte: 0, pari: 0 };
    x.giocate++;
    if (r.pareggio) x.pari++; else if (r.vincitori.includes(stato.mioPosto)) x.vinte++;
    x.ultima = Date.now();
    st[p.gioco] = x;
    mem.set('statistiche', JSON.stringify(st));
  }
  function disegnaStatistiche() {
    const st = leggiStatistiche();
    const righe = Object.entries(st).sort((a, b) => b[1].giocate - a[1].giocate);
    const tot = righe.reduce((a, [, x]) => ({ g: a.g + x.giocate, v: a.v + x.vinte }), { g: 0, v: 0 });
    const nomeG = (id) => (giochi.find((g) => g.id === id) || { nome: id }).nome;
    // i record personali sono salvati come record:gioco:giocatori:etichetta:opzioni
    const record = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('if:record:')) continue;
        const [, , id, n, et] = k.split(':');
        (record[id] = record[id] || []).push(`${localStorage.getItem(k)} ${et}${Number(n) > 1 ? ` (${n} giocatori)` : ''}`);
      }
    } catch { /* niente localStorage */ }
    $('#statistiche-testo').innerHTML = !righe.length
      ? '<p class="piccolo">Non hai ancora finito nessuna partita da questo browser. Gioca e torna qui!</p>'
      : `<p class="stat-totale"><b>${tot.g}</b> partite · <b>${tot.v}</b> vinte · <b>${Math.round((100 * tot.v) / tot.g)}%</b></p>
        <div class="stat-tabella"><table><thead><tr><th>Gioco</th><th>Giocate</th><th>Vinte</th><th>%</th></tr></thead><tbody>
        ${righe.map(([id, x]) => `<tr><td>${esc(nomeG(id))}${record[id] ? `<small class="stat-rec">🏅 ${record[id].slice(0, 3).map(esc).join(' · ')}</small>` : ''}</td><td>${x.giocate}</td><td>${x.vinte}</td><td>${Math.round((100 * x.vinte) / x.giocate)}%</td></tr>`).join('')}
        </tbody></table></div>`;
    $('#statistiche').hidden = false;
    $('#chiudi-statistiche').focus();
  }
  $('#apri-statistiche').addEventListener('click', disegnaStatistiche);
  $('#chiudi-statistiche').addEventListener('click', () => ($('#statistiche').hidden = true));
  $('#statistiche').addEventListener('click', (e) => { if (e.target.id === 'statistiche') $('#statistiche').hidden = true; });
  $('#statistiche-azzera').addEventListener('click', () => {
    if (!confirm('Azzero statistiche e record personali di questo browser?')) return;
    mem.del('statistiche');
    try { Object.keys(localStorage).filter((k) => k.startsWith('if:record:')).forEach((k) => localStorage.removeItem(k)); } catch { /* niente */ }
    disegnaStatistiche();
  });

  // a fine partita: scegli subito un altro gioco per lo stesso tavolo (solo chi l'ha aperto)
  let dopo = { gioco: null, opzioni: {} };
  function sceltaAltroGioco() {
    const adatti = giochi.filter((g) => g.giocatori.includes(stato.numPosti));
    if (!dopo.gioco || !adatti.some((g) => g.id === dopo.gioco)) dopo = { gioco: stato.gioco, opzioni: { ...stato.opzioni } };
    const m = meta(dopo.gioco);
    return `<div class="altro-gioco"><p class="piccolo">Oppure giocate subito a un altro gioco, con lo stesso tavolo:</p>
      <select data-dopo="gioco" aria-label="Prossimo gioco">${adatti.map((g) => `<option value="${g.id}" ${g.id === dopo.gioco ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select>
      ${m.opzioni.map((o) => selectOpzione(o, dopo.opzioni[o.id] ?? o.predefinito, 'data-dopo="opzione"')).join('')}
      <button class="bottone" data-fine="nuovo">Gioca a ${esc(m.nome)}</button></div>`;
  }
  $('#fine').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.dopo === 'gioco') { dopo = { gioco: t.value, opzioni: {} }; disegnaGioco(); }
    else if (t.dataset.dopo === 'opzione') dopo.opzioni[t.dataset.opz] = valoreOpz(t);
  });
  $('#fine-barra').addEventListener('click', (e) => {
    if (e.target.closest('[data-vedi-fine]')) { ui._fineSubito = true; disegnaGioco(); }
    if (e.target.closest('[data-lobby]')) socket.emit('tornaInSala');
  });
  $('#fine').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fine]');
    if (!b) return;
    if (b.dataset.fine === 'rivincita') socket.emit('rivincita');
    if (b.dataset.fine === 'sala') socket.emit('tornaInSala');
    if (b.dataset.fine === 'nuovo') socket.emit('nuovoGioco', { gioco: dopo.gioco, opzioni: dopo.opzioni });
    if (b.dataset.fine === 'esci') esci();
  });

  // clic sul tavolo: li gestisce il gioco
  function gestisciClic(e) {
    const el = e.target.closest('[data-az]');
    if (!el || !stato || !stato.partita) return;
    Tavoli[stato.partita.gioco].clic(ctx, el);
  }
  $('#tavolo').addEventListener('click', gestisciClic);
  $('#tavolo').addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-az]')) { e.preventDefault(); gestisciClic(e); }
  });

  // uscita
  $('#esci-gioco').addEventListener('click', () => {
    const p = stato.partita;
    if (!p || p.finita || stato.spettatore) return esci();
    const soloPc = stato.giocatori.every((g, i) => i === stato.mioPosto || (g && g.bot));
    $('#conferma-testo').textContent = soloPc
      ? 'La partita contro il computer verrà chiusa.'
      : (meta(stato.gioco) || {}).soloPersone ? 'Gli altri continuano senza di te: in questo gioco il tuo posto resta vuoto (non lo prende il computer).'
      : 'Al tuo posto giocherà il computer, così gli altri possono finire la partita.';
    $('#conferma').hidden = false;
    $('#conferma-no').focus();
  });
  $('#conferma-si').addEventListener('click', () => { $('#conferma').hidden = true; esci(); });
  $('#conferma-no').addEventListener('click', () => ($('#conferma').hidden = true));

  // =================== CHAT E NUVOLETTE ===================
  const RAPIDI = ['!prof', 'Bella mano!', 'Che fortuna 😅', 'Dai, tocca a te', 'Ben giocato 👏', 'Rivincita?'];
  $('#rapidi').innerHTML = RAPIDI.map((t) => (t === '!prof'
    ? '<button class="bottone mini-bt rapido-prof" data-rapido="!prof" title="Apre le dispense a tutti i giocatori del tavolo">🚨 !prof</button>'
    : `<button class="bottone mini-bt" data-rapido="${esc(t)}">${esc(t)}</button>`)).join('');
  $('#suggerimento-ricarica').addEventListener('click', (e) => { const b = e.target.closest('[data-rapido]'); if (b) socket.emit('chat', b.dataset.rapido); });
  $('#rapidi').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rapido]');
    if (b) socket.emit('chat', b.dataset.rapido);
  });

  const bolleAttive = new Map(); // posto -> { testo, fino }
  function gestisciChat() {
    $('#suggerimento-ricarica').hidden = !stato.ricaricaConsigliata;
    const lista = $('#messaggi');
    // si torna in fondo solo se si era già in fondo (o se arriva un mio messaggio): chi rilegge i vecchi resta lì
    const inFondo = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 40;
    const primaId = lista.dataset.ultimo;
    const firmaChat = stato.chat.map((m) => m.id).join(',');
    const cambiata = lista.dataset.firma !== firmaChat;
    lista.dataset.firma = firmaChat;
    if (cambiata) lista.innerHTML = stato.chat.map((m) => (m.sistema
      ? `<li class="sistema">${esc(m.testo)}</li>`
      : m.ia ? rigaIA(`🤖 ${m.nome}`, m.a, m.aPosto === stato.mioPosto && !stato.spettatore, m.testo)
      : `<li class="${m.posto === -2 ? 'spett' : ''}"><b>${esc(m.posto === stato.mioPosto && !stato.spettatore ? 'Tu' : m.nome)}</b> ${esc(m.testo)}</li>`)).join('');
    const ultimoMsg = stato.chat[stato.chat.length - 1];
    lista.dataset.ultimo = ultimoMsg ? ultimoMsg.id : '';
    const mio = ultimoMsg && String(ultimoMsg.id) !== primaId && ultimoMsg.posto === stato.mioPosto;
    if (cambiata && (inFondo || mio || !primaId)) lista.scrollTop = lista.scrollHeight;
    const nuovi = stato.chat.filter((m) => m.id > ultimaChat);
    const primaVolta = ultimaChat === 0;
    if (stato.chat.length) ultimaChat = stato.chat[stato.chat.length - 1].id;
    if (primaVolta) return;
    for (const m of nuovi) {
      if (m.sistema) {
        // con la chat aperta il messaggio si legge già lì; uno lungo (l'elenco di !comandi) nell'avviso copriva
        // tutto lo schermo del telefono: se ne mostra l'inizio e si accende il pallino della chat
        if ($('#chat').hidden) {
          const lungo = m.testo.length > 140;
          avviso(lungo ? `${m.testo.slice(0, 100).trim()}… (apri la chat per leggere tutto)` : m.testo, lungo ? 4200 : 3200);
          if (lungo) $('#non-letti').hidden = false;
        }
        continue;
      }
      if (m.ia) { bip(660, 0.08); continue; } // fantasIA non ha una nuvoletta: la risposta sta nella chat
      bolleAttive.set(m.posto, { testo: m.testo, fino: Date.now() + 5000 });
      if (m.posto !== stato.mioPosto) bip(520, 0.08);
    }
    const ultimo = stato.chat.length ? stato.chat[stato.chat.length - 1].ora : 0;
    if ($('#chat').hidden && nuovi.some((m) => !m.sistema && m.posto !== stato.mioPosto) && ultimo > chatLetta) $('#non-letti').hidden = false;
    mostraBolleRecenti();
    if (!stato.partita) bolleSala(nuovi);
  }

  function mostraBolleRecenti() {
    if (!stato || !stato.partita) return;
    const ora = Date.now();
    for (const el of $$('[data-bolla]')) {
      const b = bolleAttive.get(Number(el.dataset.bolla));
      if (b && b.fino > ora) {
        if (el.dataset.testo !== b.testo) {
          el.innerHTML = `<div class="bolla">${esc(b.testo)}</div>`;
          el.dataset.testo = b.testo;
        }
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.innerHTML = ''; el.dataset.testo = ''; }, b.fino - ora);
      } else { el.innerHTML = ''; el.dataset.testo = ''; }
    }
  }

  function bolleSala(nuovi) {
    for (const m of nuovi) {
      if (m.sistema) continue;
      // la risposta di fantasIA compare sulla riga di chi ha chiesto e resta di più (è più lunga)
      const li = $$('#lista-posti li')[m.ia ? m.aPosto : m.posto];
      if (!li) continue;
      if (m.ia) for (const x of li.querySelectorAll('.bolla-ia')) x.remove();
      const b = document.createElement('div');
      b.className = m.ia ? 'bolla bolla-sala bolla-ia' : 'bolla bolla-sala';
      b.textContent = m.ia ? `🤖 ${m.nome}: ${m.testo}` : m.testo;
      li.append(b);
      setTimeout(() => b.remove(), m.ia ? Math.min(30000, 6000 + m.testo.length * 60) : 5000);
    }
  }

  $('#apri-chat').addEventListener('click', () => {
    $('#chat').hidden = false;
    $('#non-letti').hidden = true;
    chatLetta = Date.now();
    mem.set('chatLetta', chatLetta);
    $('#testo-chat').focus();
  });
  $('#chiudi-chat').addEventListener('click', () => ($('#chat').hidden = true));
  $('#form-chat-sala').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('#testo-chat-sala').value.trim();
    if (t && !(window.Fotocamera && Fotocamera.comando(t))) socket.emit('chat', t); // !foto resta qui
    $('#testo-chat-sala').value = '';
  });
  $('#form-chat').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('#testo-chat').value.trim();
    if (t && !(window.Fotocamera && Fotocamera.comando(t))) socket.emit('chat', t); // !foto resta qui
    $('#testo-chat').value = '';
  });
})();
