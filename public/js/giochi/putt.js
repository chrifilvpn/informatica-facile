// MINIGOLF PARTY 3D: il gioco nel browser. La scena 3D (public/js/putt3d/scena.js, caricata solo quando serve insieme a
// three.js) e qui: i comandi (mouse e tastiera), la telecamera dietro la pallina, lo schermo sopra la scena (buca,
// colpi, tempo, minimappa, fatti, barra della forza, le tre caselle dei superpoteri, aiuto) e i suoni.
// Lo schermo sopra la scena è fatto una volta sola e non si ricostruisce con gli aggiornamenti del tavolo: così i
// clic sui superpoteri non vanno mai persi (prima i pulsanti venivano rifatti a ogni aggiornamento e il clic spariva).
// Solo al computer: dal telefono si vede un avviso e il posto resta fermo (come Alien: Isolation 3D).
(() => {
  const { esc, suono } = window.Nuovi;
  const PB = window.PuttBuche;
  const touch = () => window.Arena && window.Arena.touch();
  let ctxA = null, tela = null, hud = null, mini = null, S = null, caricamento = null, errore = null;
  let ultimo = null, prima = null, arrivo = 0, primaArrivo = 0;
  const attiva = () => ctxA && ctxA.stato && ctxA.partita && ctxA.partita.gioco === 'putt';
  const bucaDi = (rif) => (rif ? PB.COURSE[rif[0]].buche[rif[1]] : null);
  const ICONE = { turbo: '🚀', calamita: '🧲', rifai: '⏪', molla: '🦘', fantasma: '👻', nebbia: '🌫️', mira: '🙈', terremoto: '🌋', colla: '🍯' };
  const SPIEGA = {
    turbo: 'il prossimo tiro è più forte del 60%', calamita: 'nel prossimo tiro la buca attira la pallina', rifai: 'annulla l\'ultimo tiro (anche mentre corre)',
    molla: 'il prossimo tiro parte con un salto', fantasma: 'nel prossimo tiro passi attraverso gli ostacoli (non i muri)',
    nebbia: 'gli altri vedono poco per 10 secondi', mira: 'gli altri non vedono freccia e forza', terremoto: 'spinge a caso le palline degli altri', colla: 'il prossimo tiro degli altri è debole',
  };
  // telecamera e mira
  const cam = { yaw: 0, pitch: 0.42, dist: 230, alto: false, segui: null, k: null, guarda: -1 };
  let carica = null; // { f, da: 'mouse' | 'spazio', t0 }
  let gira = null; // trascinamento col tasto destro (o sinistro quando non si può tirare)
  const tasti = new Set();
  let aiuto = false, scossa = 0, ultimaScossa = 0, fattiVisti = new Set(), ultimoFrame = performance.now();

  function script(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(`non carica ${src}`)); document.head.appendChild(s); }); }
  function carica3d() {
    if (caricamento) return caricamento;
    caricamento = (async () => {
      const prova = document.createElement('canvas');
      if (!(prova.getContext('webgl2') || prova.getContext('webgl'))) throw new Error('Questo browser non disegna in 3D (WebGL spento o non supportato).');
      if (!window.PuttBuche) await script('/js/putt-buche.js');
      const m = await import('/js/putt3d/scena.js');
      S = m.crea(tela);
    })().catch((e) => { errore = e; console.error('[putt3d]', e); mostraErrore(); });
    return caricamento;
  }
  function mostraErrore() { const c = hud && hud.querySelector('.pt-centro'); if (c && errore) { c.hidden = false; c.textContent = `⚠️ ${errore.message}`; } }

  // ---------- interpolazione delle palline tra un tick e l'altro ----------
  function palleOra() {
    if (!ultimo) return [];
    const u = Math.min(1, (performance.now() - arrivo) / Math.max(20, arrivo - primaArrivo || 33));
    return ultimo.palle.map((q, i) => {
      const a = prima && prima.palle[i] && prima.k === ultimo.k ? prima.palle[i] : q;
      const lontano = Math.hypot(q.x - a.x, q.y - a.y) > 140; // tubo o acqua: niente interpolazione
      return { ...q, x: lontano ? q.x : a.x + (q.x - a.x) * u, y: lontano ? q.y : a.y + (q.y - a.y) * u, z: lontano ? q.z : (a.z || 0) + ((q.z || 0) - (a.z || 0)) * u };
    });
  }

  // ---------- lo schermo sopra la scena (fatto una volta) ----------
  function creaHud() {
    hud = document.createElement('div');
    hud.className = 'pt-hud';
    hud.innerHTML = `
      <div class="pt-in-alto"><div class="pt-buca"></div><div class="pt-righe"></div></div>
      <div class="pt-destra"><canvas class="pt-mini" width="200" height="140" aria-label="Minimappa"></canvas><div class="pt-fatti" aria-live="polite"></div></div>
      <button type="button" class="pt-pieno" title="Schermo intero (F)" aria-label="Schermo intero">⛶</button>
      <div class="pt-centro" hidden></div>
      <div class="pt-forza" hidden><div class="pt-forza-barra"><i></i></div><span></span></div>
      <div class="pt-sotto">
        <div class="pt-pronti"></div>
        <div class="pt-caselle">${[0, 1, 2].map((i) => `<button type="button" class="pt-casella" data-casella="${i}" disabled><b>${i + 1}</b><span class="pt-ic"></span><small></small></button>`).join('')}</div>
      </div>
      <div class="pt-suggerisci">Tasto destro: gira · Clic e trascina giù: tira · H: comandi</div>
      <div class="pt-aiuto" hidden>
        <h3>Comandi</h3>
        <p><b>Girare la mira</b>: tieni premuto il tasto destro e muovi il mouse (oppure A/D o ← →; con Maiusc piano piano).</p>
        <p><b>Tirare</b>: tieni premuto il tasto sinistro e trascina il mouse verso di te; lascia per tirare. Tasto destro o Esc annulla. Oppure tieni premuta la <b>barra spaziatrice</b>: la forza sale e scende, lascia quando è giusta.</p>
        <p><b>Telecamera</b>: W/S o ↑ ↓ la alzano e abbassano, la rotella avvicina e allontana, <b>Tab</b> mostra tutta la buca, <b>V</b> (quando sei in buca) segue gli altri, <b>F</b> schermo intero.</p>
        <p><b>Superpoteri</b>: tasti <b>1 2 3</b> o clic sulla casella, quando vuoi (anche mentre la pallina corre). Se non si può usare, te lo dice in alto a destra.</p>
        <p class="piccolo">Premi H per chiudere</p>
      </div>`;
    mini = hud.querySelector('.pt-mini');
    // i superpoteri: si usano alla pressione (non al "click"), così niente si perde
    hud.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('[data-casella]');
      if (c) { e.preventDefault(); e.stopPropagation(); usaPotere(Number(c.dataset.casella)); return; }
      if (e.target.closest('.pt-pieno')) { e.preventDefault(); schermoIntero(); }
    });
    return hud;
  }
  function schermoIntero() {
    const box = tela && tela.parentElement;
    if (!box) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
  }

  // ---------- comandi ----------
  function puoTirare() {
    const u = ultimo;
    if (!attiva() || !u || u.fase !== 'buca' || u.pausa || ctxA.partita.finita || ctxA.stato.spettatore) return false;
    const q = u.palle[ctxA.mio];
    return q && !q.d && !q.m && !(ctxA.partita.usciti || [])[ctxA.mio];
  }
  function tira() {
    const c = carica; carica = null;
    if (!c || c.f < 0.03 || !puoTirare()) return;
    ctxA.emetti('input', { t: 'tiro', a: cam.yaw, f: Math.round(c.f * 1000) / 1000 });
    suono([[200 + c.f * 260, 0.05], [140, 0.04]], { tipo: 'triangle', volume: 0.1 });
  }
  // (niente puntatore bloccato: si usano gli spostamenti del mouse tra un evento e l'altro)
  let ultimoMouse = null;
  const blocca = () => {}, sblocca = () => {};
  function suTela(e) { return tela && (e.target === tela || (hud && e.target === hud)); }

  document.addEventListener('mousedown', (e) => {
    if (!attiva() || !suTela(e) || touch()) return;
    e.preventDefault();
    ultimoMouse = [e.clientX, e.clientY];
    try { tela.focus({ preventScroll: true }); } catch (_) { /* niente */ }
    if (e.button === 2) { if (carica) { carica = null; sblocca(); return; } gira = { b: 2 }; blocca(); return; }
    if (e.button !== 0) return;
    if (puoTirare() && !cam.alto) { carica = { f: 0, da: 'mouse', acc: 0 }; blocca(); } else { gira = { b: 0 }; blocca(); }
  });
  document.addEventListener('mousemove', (e) => {
    if (!attiva() || (!carica && !gira)) { ultimoMouse = null; return; }
    const mx = ultimoMouse ? e.clientX - ultimoMouse[0] : 0, my = ultimoMouse ? e.clientY - ultimoMouse[1] : 0;
    ultimoMouse = [e.clientX, e.clientY];
    if (carica && carica.da === 'mouse') {
      carica.acc = Math.max(0, carica.acc + my);
      carica.f = Math.min(1, carica.acc / 280);
      cam.yaw += mx * 0.0012; // un ritocco fine della mira mentre si carica
    } else if (gira) {
      cam.yaw += mx * 0.0045;
      cam.pitch = Math.max(0.08, Math.min(1.35, cam.pitch + my * 0.003));
    }
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0 && carica && carica.da === 'mouse') { sblocca(); tira(); return; }
    if (gira && e.button === gira.b) { gira = null; sblocca(); }
  });
  document.addEventListener('contextmenu', (e) => { if (attiva() && suTela(e)) e.preventDefault(); });
  document.addEventListener('wheel', (e) => {
    if (!attiva() || !suTela(e)) return;
    e.preventDefault();
    cam.dist = Math.max(70, Math.min(1100, cam.dist * (e.deltaY > 0 ? 1.12 : 1 / 1.12)));
  }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if (!attiva() || touch() || (window.Boss && window.Boss.attivo) || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    const k = e.key.toLowerCase();
    if (['1', '2', '3'].includes(k)) { e.preventDefault(); if (!e.repeat) usaPotere(Number(k) - 1); return; }
    if (k === ' ') { e.preventDefault(); if (!e.repeat && !carica && puoTirare()) carica = { f: 0, da: 'spazio', t0: performance.now() }; return; }
    if (k === 'tab') { e.preventDefault(); if (!e.repeat) cam.alto = !cam.alto; return; }
    if (k === 'escape') { carica = null; aiuto = false; return; }
    if (k === 'h') { aiuto = !aiuto; return; }
    if (k === 'f') { schermoIntero(); return; }
    if (k === 'v') { cam.guarda = altroDaSeguire(1); return; }
    if (['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'shift'].includes(k)) { if (k.startsWith('arrow')) e.preventDefault(); tasti.add(k); }
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    tasti.delete(k);
    if (k === ' ' && carica && carica.da === 'spazio') tira();
  });
  window.addEventListener('blur', () => { tasti.clear(); carica = null; gira = null; });

  function usaPotere(i) {
    if (!attiva() || !ultimo || ultimo.fase !== 'buca' || ultimo.pausa || ctxA.stato.spettatore) return;
    const tasca = (ultimo.poteri || [])[ctxA.mio] || [];
    if (i >= tasca.length) { aggiungiFatto(`⚠️ La casella ${i + 1} è vuota: passa sulle scatole 🎁 per prendere i superpoteri`); return; }
    ctxA.emetti('input', { t: 'usa', i });
    const c = hud && hud.querySelector(`[data-casella="${i}"]`);
    if (c) { c.classList.remove('pt-premuta'); void c.offsetWidth; c.classList.add('pt-premuta'); }
    suono([[520, 0.05], [780, 0.07]], { volume: 0.08 });
  }

  // la prima mira di una buca: verso la bandierina se si vede, altrimenti verso il corridoio più lungo che va da quella parte
  function direzioneIniziale(b) {
    const segs = PB.segmentiFissi(b), [x0, y0] = b.partenza;
    const raggio = (a, max) => {
      const dx = Math.cos(a), dy = Math.sin(a);
      let best = max;
      for (const [x1, y1, x2, y2] of segs) {
        const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((x1 - x0) * ey - (y1 - y0) * ex) / den, u = ((x1 - x0) * dy - (y1 - y0) * dx) / den;
        if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
      }
      return best;
    };
    const aB = Math.atan2(b.buca[1] - y0, b.buca[0] - x0), dB = Math.hypot(b.buca[0] - x0, b.buca[1] - y0);
    if (raggio(aB, dB + 1) >= dB) return aB;
    let meglio = aB, punti = -1;
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2, l = Math.min(1600, raggio(a, 1600));
      const v = l * (1.6 + Math.cos(a - aB));
      if (v > punti) { punti = v; meglio = a; }
    }
    return meglio;
  }

  // quando sono in buca: chi seguo (-1 = vista dall'alto)
  function altroDaSeguire(passo) {
    if (!ultimo) return -1;
    const vivi = ultimo.palle.map((q, i) => (q && !q.d && !(ctxA.partita.usciti || [])[i] && i !== ctxA.mio ? i : -1)).filter((i) => i >= 0);
    if (!vivi.length) return -1;
    const k = vivi.indexOf(cam.guarda);
    return k < 0 ? vivi[0] : k + passo >= vivi.length ? -1 : vivi[k + passo];
  }

  // ---------- fatti (in alto a destra) ----------
  const locali = [];
  function aggiungiFatto(testo) { locali.push({ id: `l${Date.now()}${Math.random()}`, testo, ora: Date.now() }); }
  function disegnaFatti(d) {
    const box = hud && hud.querySelector('.pt-fatti');
    if (!box) return;
    const ora = Date.now();
    const nome = (i) => (i === ctxA.mio ? 'Tu' : ctxA.nome(i));
    const lista = (d.fatti || []).map((f) => ({ id: f.id, testo: f.chi != null ? f.testo.replace('@', nome(f.chi)) : f.testo }))
      .concat(locali.filter((f) => ora - f.ora < 5000)).slice(-5);
    for (const f of d.fatti || []) if (!fattiVisti.has(f.id)) { fattiVisti.add(f.id); if (f.chi != null && f.chi !== ctxA.mio && /scatena|Nebbia|nasconde|Colla/.test(f.testo)) suono([[300, 0.06], [220, 0.08]], { volume: 0.06 }); }
    const html = lista.map((f) => `<div class="pt-fatto">${esc(f.testo)}</div>`).join('');
    if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; }
    while (locali.length && ora - locali[0].ora > 6000) locali.shift();
  }

  // ---------- minimappa ----------
  function disegnaMini(b, palle) {
    if (!mini || !b) return;
    const g = mini.getContext('2d'), W = mini.width, H = mini.height;
    const xs = b.bordo.map((q) => q[0]), ys = b.bordo.map((q) => q[1]);
    const x0 = Math.min(...xs) - 40, y0 = Math.min(...ys) - 40, w = Math.max(...xs) - x0 + 40, h = Math.max(...ys) - y0 + 40;
    const k = Math.min(W / w, H / h), ox = (W - w * k) / 2, oy = (H - h * k) / 2;
    const P = (x, y) => [ox + (x - x0) * k, oy + (y - y0) * k];
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(10,20,15,.55)'; g.fillRect(0, 0, W, H);
    g.beginPath(); b.bordo.forEach(([x, y], i) => { const [a, c] = P(x, y); if (i) g.lineTo(a, c); else g.moveTo(a, c); }); g.closePath();
    g.fillStyle = { spazio: '#2e3266', ghiaccio: '#d8ecf7', giungla: '#4e9a3c' }[PB.COURSE[ctxA.partita.buca[0]].tema] || '#3f9e52'; g.fill(); g.strokeStyle = '#d9b27a'; g.lineWidth = 2; g.stroke();
    const zone = (lista, c) => { g.fillStyle = c; for (const [x, y, ww, hh] of lista || []) { const [a, cc] = P(x, y); g.fillRect(a, cc, ww * k, hh * k); } };
    zone(b.sabbia, '#e8d08f'); zone(b.neve, '#fff'); zone(b.fango, '#7a5a32'); zone(b.ghiaccio, '#a9dcf5'); zone(b.acqua, '#2f7fd8');
    g.strokeStyle = '#d9b27a'; g.lineWidth = 2;
    for (const [x1, y1, x2, y2] of b.muri || []) { const [a, c] = P(x1, y1), [d, e] = P(x2, y2); g.beginPath(); g.moveTo(a, c); g.lineTo(d, e); g.stroke(); }
    for (const [x, y, r] of (b.respingenti || []).concat(b.rocce || [])) { const [a, c] = P(x, y); g.fillStyle = '#c55'; g.beginPath(); g.arc(a, c, Math.max(1.5, r * k), 0, 7); g.fill(); }
    for (const d of b.dossi || []) { const [a, c] = P(d.x, d.y); g.strokeStyle = d.h > 0 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(a, c, d.r * k * 0.6, 0, 7); g.stroke(); }
    const [bx, by] = P(...b.buca); g.fillStyle = '#e0473c'; g.fillRect(bx, by - 9, 8, 5); g.fillStyle = '#111'; g.beginPath(); g.arc(bx, by, 3, 0, 7); g.fill();
    const p = ctxA.partita;
    palle.forEach((q, i) => {
      if (!q || q.d || (p.usciti || [])[i]) return;
      const [a, c] = P(q.x, q.y);
      g.fillStyle = p.colori[i % p.colori.length]; g.beginPath(); g.arc(a, c, i === ctxA.mio ? 4.5 : 3.2, 0, 7); g.fill();
      if (i === ctxA.mio) {
        g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(a, c); g.lineTo(a + Math.cos(cam.yaw) * 16, c + Math.sin(cam.yaw) * 16); g.stroke();
      }
    });
  }

  // ---------- il ciclo dei fotogrammi ----------
  function dimensiona() {
    const box = tela.parentElement;
    if (!box) return;
    const pieno = document.fullscreenElement === box;
    const largo = box.clientWidth;
    // alta quanto lo spazio del tavolo (il tabellone dei colpi sta sotto, si scorre)
    const top = box.getBoundingClientRect().top, pan = document.getElementById('panno');
    const fondo = pan ? pan.getBoundingClientRect().bottom : window.innerHeight;
    const alto = pieno ? window.innerHeight : Math.round(Math.max(360, Math.min(fondo - Math.max(0, top) - 4, largo * 0.66)));
    if (tela._w !== largo || tela._h !== alto) { tela._w = largo; tela._h = alto; tela.style.height = `${alto}px`; box.style.height = `${alto}px`; S.dimensiona(largo, alto, window.devicePixelRatio || 1); }
  }
  function frame() {
    requestAnimationFrame(frame);
    const ora = performance.now(), dt = Math.min(0.1, (ora - ultimoFrame) / 1000);
    ultimoFrame = ora;
    if (!attiva() || !S || !tela || !tela.isConnected || !ultimo || touch()) return;
    const p = ctxA.partita;
    if (p.buca == null) return;
    const b = bucaDi(p.buca), tema = PB.COURSE[p.buca[0]].tema;
    try {
      dimensiona();
      const nomi = Array.from({ length: p.n }, (_, i) => ctxA.nome(i));
      S.costruisci(p.buca, b, tema, p.colori, nomi);
      S.preparaPalle(p.colori, nomi);
      const palle = palleOra(), io = ultimo.palle[ctxA.mio] || {}, mia = palle[ctxA.mio];
      // nuova buca: la telecamera guarda verso la bandierina
      if (cam.k !== `${p.k}`) { cam.k = `${p.k}`; cam.yaw = direzioneIniziale(b); cam.alto = false; cam.guarda = -1; carica = null; }
      // tasti tenuti premuti
      const lento = tasti.has('shift') ? 0.22 : 1;
      if (tasti.has('a') || tasti.has('arrowleft')) cam.yaw -= 1.7 * lento * dt;
      if (tasti.has('d') || tasti.has('arrowright')) cam.yaw += 1.7 * lento * dt;
      if (tasti.has('w') || tasti.has('arrowup')) cam.pitch = Math.min(1.35, cam.pitch + 0.9 * dt);
      if (tasti.has('s') || tasti.has('arrowdown')) cam.pitch = Math.max(0.08, cam.pitch - 0.9 * dt);
      if (carica && carica.da === 'spazio') { const u = ((ora - carica.t0) / 1700) % 1; carica.f = u < 0.5 ? u * 2 : 2 - u * 2; }
      if (carica && !puoTirare()) carica = null;
      // chi segue la telecamera
      const inBuca = !mia || mia.d || (p.usciti || [])[ctxA.mio];
      let segui = null;
      if (!inBuca) segui = mia;
      else if (cam.guarda >= 0 && palle[cam.guarda] && !palle[cam.guarda].d) segui = palle[cam.guarda];
      // scossa del terremoto
      if (io.sc && io.sc !== ultimaScossa) { if (ultimaScossa) { scossa = 0.8; suono([[90, 0.25]], { tipo: 'sawtooth', volume: 0.08 }); } ultimaScossa = io.sc; }
      scossa = Math.max(0, scossa - dt);
      const t = ultimo.pausa ? ultimo.t : ultimo.t + (ora - arrivo) / 1000;
      S.disegna({
        t, dt, palle, mio: ctxA.mio, colori: p.colori, usciti: p.usciti, prese: io.pr || [], botti: true,
        mira: !inBuca && puoTirare() ? { a: cam.yaw, f: carica ? carica.f : 0, carica: !!carica, nascosta: !!io.ci } : null,
        camera: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, alto: cam.alto || (inBuca && !segui), segui },
        nebbia: io.nb > 0, scossa,
      });
      if (Math.floor(ora / 120) !== Math.floor((ora - dt * 1000) / 120)) disegnaMini(b, palle);
      aggiornaHud(p, b, io);
    } catch (e) { if (!frame.errato) { frame.errato = true; console.error('[putt3d]', e); } }
  }
  requestAnimationFrame(frame);

  function aggiornaHud(p, b, io) {
    if (!hud) return;
    const u = ultimo;
    const set = (sel, html) => { const el = hud.querySelector(sel); if (el && el._h !== html) { el.innerHTML = html; el._h = html; } };
    const nc = p.course.indexOf(p.buca[0]), nb = p.ordine.slice(0, p.k + 1).filter((r) => r[0] === p.buca[0]).length;
    set('.pt-buca', `${esc(PB.COURSE[p.buca[0]].nome)}${p.course.length > 1 ? ` <small>(${nc + 1}/${p.course.length})</small>` : ''} · buca ${nb} · <b>${esc(b.nome)}</b> · par ${b.par}`);
    set('.pt-righe', u.fase === 'buca' ? `Colpi: <b>${io.c || 0}</b> · ⏱ ${Math.floor(u.resta / 60000)}:${String(Math.floor(u.resta / 1000) % 60).padStart(2, '0')}${io.nb ? ` · 🌫️ nebbia ${io.nb} s` : ''}${io.ci ? ' · 🙈 mira nascosta' : ''}${io.co ? ' · 🍯 colla: tiro debole' : ''}` : '');
    // scritta al centro
    let centro = '';
    if (u.pausa) centro = '⏸ In pausa';
    else if (u.fase === 'via') centro = `<small>${esc(PB.COURSE[p.buca[0]].nome)}</small><br>${esc(b.nome)} · par ${b.par}<br><small>si parte tra ${Math.ceil(u.via / 1000)}…</small>`;
    else if (u.fase === 'fineBuca') centro = 'Buca finita!';
    else if (io.d) centro = `<small>⛳ In buca! Aspetta gli altri${altroDaSeguire(0) >= 0 ? ' · V: guarda gli altri' : ''}</small>`;
    const c = hud.querySelector('.pt-centro');
    if (!errore) { c.hidden = !centro; set('.pt-centro', centro); c.classList.toggle('pt-piccolo', !!io.d && u.fase === 'buca'); }
    // barra della forza
    const fz = hud.querySelector('.pt-forza');
    fz.hidden = !carica;
    if (carica) {
      const f = carica.f;
      fz.querySelector('i').style.width = io.ci ? '0%' : `${Math.round(f * 100)}%`;
      fz.querySelector('i').style.background = `hsl(${120 - f * 120} 85% 50%)`;
      fz.querySelector('span').textContent = io.ci ? '🙈 forza nascosta' : `${Math.round(f * 100 * (io.co ? 0.55 : 1))}%${(io.pt || []).includes('turbo') ? ' 🚀' : ''}`;
    }
    // superpoteri in tasca e pronti
    const tasca = (u.poteri || [])[ctxA.mio] || [];
    hud.querySelectorAll('[data-casella]').forEach((el, i) => {
      const t = tasca[i], k = t || '';
      if (el.dataset.t !== k) {
        el.dataset.t = k; el.disabled = !t;
        el.querySelector('.pt-ic').textContent = t ? ICONE[t] : '';
        el.querySelector('small').textContent = t ? (p.nomiPoteri || {})[t] || t : 'vuota';
        el.title = t ? `${(p.nomiPoteri || {})[t]}: ${SPIEGA[t]} (tasto ${i + 1})` : 'Casella vuota: passa sulle scatole 🎁';
        el.classList.toggle('pt-contro', !!t && (p.contro || []).includes(t));
      }
    });
    set('.pt-pronti', (io.pt || []).length ? `Pronti per il prossimo tiro: ${(io.pt || []).map((t) => `${ICONE[t]} ${esc((p.nomiPoteri || {})[t] || t)}`).join(' · ')}` : '');
    hud.querySelector('.pt-aiuto').hidden = !aiuto;
    hud.querySelector('.pt-mini').hidden = !!io.nb;
  }

  function tabellino(ctx) {
    const p = ctx.partita;
    const buche = p.ordine.map((rif) => bucaDi(rif));
    return `<div class="tabella-scorre"><table class="conti pt-tab"><thead><tr><th></th>${buche.map((b, k) => `<th class="${k === p.k && !p.finita ? 'ora' : ''}" title="${esc(b.nome)}">${k + 1}</th>`).join('')}<th>Tot</th></tr>
      <tr class="par"><th>par</th>${buche.map((b) => `<td>${b.par}</td>`).join('')}<td>${buche.reduce((s, b) => s + b.par, 0)}</td></tr></thead>
      <tbody>${Array.from({ length: p.n }, (_, i) => `<tr class="${i === ctx.mio ? 'mia' : ''}"><th><i style="background:${p.colori[i % p.colori.length]}"></i>${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))}${(p.telefono || [])[i] ? ' 📱' : ''}</th>${buche.map((b, k) => { const c = p.colpi[i][k]; return `<td class="${c == null ? '' : c < b.par ? 'sotto' : c > b.par ? 'sopra' : ''}">${c == null ? '' : c}</td>`; }).join('')}<td><b>${p.totali[i]}</b></td></tr>`).join('')}</tbody></table></div>`;
  }

  let telefonoDetto = '';
  const tavolo = {
    libero: true,
    senzaFila: true,
    reset(ctx) {
      ctxA = ctx;
      const d = ctx.partita.stato;
      if (!ultimo || ultimo.k !== d.k || ultimo.fase !== d.fase) { prima = null; ultimo = d; arrivo = performance.now(); primaArrivo = arrivo - 33; }
      if (touch()) {
        // dal telefono non si gioca: lo si dice al server una volta per partita (gli altri non ti aspettano)
        const chiave = `${ctx.partita.ordine.map((r) => r.join('.')).join()}|${ctx.mio}`;
        if (telefonoDetto !== chiave && !ctx.stato.spettatore && !ctx.partita.finita && !(ctx.partita.usciti || [])[ctx.mio]) { telefonoDetto = chiave; ctx.emetti('input', { t: 'telefono' }); }
        return;
      }
      if (!tela) { tela = document.createElement('canvas'); tela.className = 'pt-tela'; tela.setAttribute('aria-label', 'Campo da minigolf in 3D'); tela.tabIndex = 0; creaHud(); }
      carica3d();
    },
    tick(ctx, d) {
      ctxA = ctx;
      prima = ultimo; ultimo = d; primaArrivo = arrivo; arrivo = performance.now();
      if (touch()) return;
      disegnaFatti(d);
      const mio = d.palle[ctx.mio];
      if (mio && mio.d && prima && prima.palle[ctx.mio] && !prima.palle[ctx.mio].d && prima.k === d.k) suono([[660, 0.08], [880, 0.08], [1046, 0.15]], { volume: 0.09 });
    },
    panno(ctx) {
      const p = ctx.partita;
      if (touch()) {
        return `<div class="pt"><div class="pt-telefono"><b>🖥️ Minigolf Party 3D si gioca solo al computer</b>
          <p>È un gioco in 3D con mouse e tastiera: dal telefono sarebbe troppo scomodo (come Alien: Isolation 3D). Entra nello stesso tavolo dal computer; intanto gli altri giocano senza aspettarti.</p></div>${tabellino(ctx)}</div>`;
      }
      return `<div class="pt"><div class="pt-box"></div>${tabellino(ctx)}</div>`;
    },
    dopo() {
      if (touch() || !tela) return;
      const box = document.querySelector('.pt-box');
      if (box && tela.parentElement !== box) { box.append(tela, hud); tela._w = null; }
    },
    stato(ctx) {
      const p = ctx.partita, u = ultimo || p.stato;
      if (p.finita) return null;
      if (touch()) return 'Solo al computer';
      if (u.pausa) return 'In pausa';
      if (u.fase === 'via') return 'Si parte…';
      if (u.fase === 'fineBuca') return 'Buca finita';
      const mio = u.palle[ctx.mio];
      return mio && mio.d ? 'In buca! Aspetta gli altri' : 'Tira quando vuoi';
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return p.totali.map((x, i) => `<span>${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b></span>`).join('') + '<span class="obiettivo">vince chi fa meno colpi</span>';
    },
    infoPosto(ctx, posto) { return `${ctx.partita.totali[posto]} colpi`; },
    clic() {},
  };
  Object.assign(window.Tavoli, { putt: tavolo });
  window.__putt3d = { cam, get scena() { return S; }, get errore() { return errore; } }; // per le prove automatiche
})();
