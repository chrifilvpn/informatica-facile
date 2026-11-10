// TETRIS BATTLE: il tavolo nel browser. I canvas restano gli stessi per tutta la partita.
(() => {
  const { esc } = window.Nuovi;
  const COLORI = [null, '#4dd6e8', '#f5d547', '#b57bf2', '#6fd672', '#f06b6b', '#5b8def', '#f5a04a']; // I O T S Z J L
  let ctxT = null, stato = null, mia = null, altre = new Map();
  let forme = null, tipi = null;
  let lMio = 20; // lato di un quadretto del mio tabellone (per i gesti col dito)

  function mattone(g, x, y, l, col, alfa = 1) {
    g.globalAlpha = alfa;
    g.fillStyle = col; g.fillRect(x * l + 1, y * l + 1, l - 2, l - 2);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x * l + 1, y * l + 1, l - 2, Math.max(2, l * 0.18));
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x * l + 1, y * l + l - 1 - Math.max(2, l * 0.14), l - 2, Math.max(2, l * 0.14));
    g.globalAlpha = 1;
  }
  const celle = (t, r) => forme[t][r % forme[t].length];

  function tabellone(tela, b, l, conFantasma) {
    const dpr = window.devicePixelRatio || 1;
    const W = 10, H = 20;
    if (tela.width !== W * l * dpr) { tela.width = W * l * dpr; tela.height = H * l * dpr; tela.style.width = `${W * l}px`; tela.style.height = `${H * l}px`; }
    const g = tela.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#10182c'; g.fillRect(0, 0, W * l, H * l);
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
    for (let x = 1; x < W; x++) { g.beginPath(); g.moveTo(x * l + 0.5, 0); g.lineTo(x * l + 0.5, H * l); g.stroke(); }
    for (let y = 1; y < H; y++) { g.beginPath(); g.moveTo(0, y * l + 0.5); g.lineTo(W * l, y * l + 0.5); g.stroke(); }
    for (let i = 0; i < W * H; i++) { const v = Number(b.g[i]); if (v) mattone(g, i % W, Math.floor(i / W), l, b.v ? COLORI[v] : '#555c6e'); }
    if (b.pz) {
      const col = COLORI[tipi.indexOf(b.pz.t) + 1];
      if (conFantasma && b.f != null) for (const [a, c] of celle(b.pz.t, b.pz.r)) if (b.f + c >= 0) { g.strokeStyle = col; g.lineWidth = 2; g.globalAlpha = 0.55; g.strokeRect((b.pz.x + a) * l + 2, (b.f + c) * l + 2, l - 4, l - 4); g.globalAlpha = 1; }
      for (const [a, c] of celle(b.pz.t, b.pz.r)) if (b.pz.y + c >= 0) mattone(g, b.pz.x + a, b.pz.y + c, l, col);
    }
    if (!b.v) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W * l, H * l); }
  }
  function pezzetto(tela, t, l, spento) {
    const dpr = window.devicePixelRatio || 1;
    if (tela.width !== 4 * l * dpr) { tela.width = 4 * l * dpr; tela.height = 2.5 * l * dpr; tela.style.width = `${4 * l}px`; tela.style.height = `${2.5 * l}px`; }
    const g = tela.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, 4 * l, 2.5 * l);
    if (!t) return;
    const c = celle(t, 0);
    const minY = Math.min(...c.map((x) => x[1]));
    const larg = Math.max(...c.map((x) => x[0])) + 1;
    const ox = (4 - larg) / 2;
    for (const [a, b] of c) mattone(g, a + ox, b - minY + 0.25, l, spento ? '#6b7180' : COLORI[tipi.indexOf(t) + 1]);
  }

  function disegna() {
    const ctx = ctxT;
    if (!ctx || !ctx.stato || !ctx.partita || ctx.partita.gioco !== 'tetris' || !stato || !mia) return;
    const io = stato.t[ctx.mio];
    const box = document.querySelector('.tt-mio');
    if (!box) return;
    // il tabellone prende l'altezza libera sotto la barra; sul telefono sotto ci sono anche i pulsanti (in orizzontale
    // stanno ai lati, fissi, e non tolgono altezza)
    const pulsanti = document.querySelector('.tt-pulsanti');
    const pulsH = pulsanti && pulsanti.offsetHeight && getComputedStyle(pulsanti).position !== 'fixed' ? pulsanti.offsetHeight + 14 : 0;
    const sopra = Math.max(0, box.getBoundingClientRect().top + (window.scrollY || 0));
    const l = Math.max(12, Math.min(34, Math.floor((window.innerHeight - sopra - pulsH - (matchMedia('(pointer: coarse)').matches ? 16 : 30)) / 20)));
    tabellone(mia.tela, io, l, true);
    lMio = l;
    pezzetto(mia.hold, io.h, Math.round(l * 0.6), io.hu);
    (io.nx || []).forEach((t, k) => pezzetto(mia.next[k], t, Math.round(l * (k ? 0.5 : 0.6))));
    mia.info.textContent = '';
    // sul telefono i tabelloni degli altri sono piccoli: si guarda il proprio
    const piccoli = matchMedia('(pointer: coarse)').matches;
    for (const [i, tela] of altre) tabellone(tela, stato.t[i], piccoli ? (ctx.partita.n > 4 ? 4 : 6) : ctx.partita.n > 4 ? 7 : 10, false);
    const conta = document.querySelector('.tt-conta');
    if (conta) conta.textContent = stato.pausa ? '⏸' : stato.via > 0 ? String(Math.ceil(stato.via / 1000)) : '';
    for (const el of document.querySelectorAll('[data-tt-punti]')) { const b = stato.t[Number(el.dataset.ttPunti)]; el.textContent = `${b.p} · ${b.r} righe · liv. ${b.l}`; }
  }
  (function giro() { disegna(); requestAnimationFrame(giro); })();

  function assicura(ctx) {
    if (!mia || mia.di !== ctx.partita) {
      const nuova = () => document.createElement('canvas');
      mia = { di: ctx.partita, tela: nuova(), hold: nuova(), next: [nuova(), nuova(), nuova()], info: document.createElement('span') };
      altre = new Map();
    }
    for (let i = 0; i < ctx.partita.n; i++) if (i !== ctx.mio && !altre.has(i)) altre.set(i, document.createElement('canvas'));
  }

  const tetris = {
    libero: true,
    reset(ctx) {
      ctxT = ctx; forme = ctx.partita.forme; tipi = ctx.partita.tipi;
      if (!mia || mia.di !== ctx.partita) stato = ctx.partita.stato;
      assicura(ctx);
    },
    tick(ctx, d) {
      stato = d;
      if (Date.now() - (ctx.ui._puntiDal || 0) > 500) { ctx.ui._puntiDal = Date.now(); const el = document.getElementById('punteggio'); if (el) el.innerHTML = tetris.punteggio(ctx); }
    },
    panno(ctx) {
      const p = ctx.partita;
      const altri = Array.from({ length: p.n }, (_, i) => i).filter((i) => i !== ctx.mio)
        .map((i) => `<div class="tt-altro ${stato && !stato.t[i].v ? 'fuori' : ''}"><p><b>${esc(ctx.nome(i))}</b><small data-tt-punti="${i}"></small></p><div data-tt-altro="${i}"></div></div>`).join('');
      const pulsanti = [['sx', '←'], ['ruotaSx', '↺'], ['giu', '↓'], ['ruota', '↻'], ['dx', '→'], ['hold', 'Hold'], ['caduta', '⤓ Giù']]
        .map(([a, t]) => `<button type="button" class="tt-bt" data-tt="${a}" aria-label="${a}">${t}</button>`).join('');
      return `<div class="tt">
        <div class="tt-gioco">
          <div class="tt-lato"><p>Hold</p><div data-tt-hold></div></div>
          <div class="tt-mio"><div data-tt-mia></div><span class="tt-conta" aria-live="polite"></span></div>
          <div class="tt-lato"><p>Prossimi</p><div data-tt-next></div><p class="tt-miei" data-tt-punti="${ctx.mio}"></p></div>
        </div>
        ${altri ? `<aside class="tt-altri">${altri}</aside>` : ''}
        <div class="tt-pulsanti">${pulsanti}</div>
      </div>`;
    },
    dopo(ctx) {
      assicura(ctx);
      const metti = (sel, el) => { const box = document.querySelector(sel); if (box && el.parentElement !== box) box.append(el); };
      metti('[data-tt-mia]', mia.tela); metti('[data-tt-hold]', mia.hold);
      const nx = document.querySelector('[data-tt-next]');
      if (nx) mia.next.forEach((c) => { if (c.parentElement !== nx) nx.append(c); });
      for (const [i, tela] of altre) metti(`[data-tt-altro="${i}"]`, tela);
    },
    stato(ctx) { const p = ctx.partita; if (p.finita) return null; const b = stato && stato.t[ctx.mio]; return b && !b.v ? 'Sei fuori: guarda gli altri' : p.n > 1 ? 'Resisti più degli altri' : 'Maratona'; },
    punteggio(ctx) {
      const s = stato ? stato.t : [];
      return s.map((b, i) => `<span class="${b.v ? '' : 'barrato'}">${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${b.p}</b></span>`).join('');
    },
    infoPosto(ctx, posto) { const b = stato && stato.t[posto]; return b ? (b.v ? `${b.r} righe` : '<span class="eliminato">fuori</span>') : ''; },
    clic() {},
  };

  // comandi: tastiera con ripetizione (←, →, ↓) e pulsanti per il telefono
  const manda = (az) => { if (ctxT && ctxT.stato && ctxT.partita && ctxT.partita.gioco === 'tetris' && !ctxT.partita.finita) ctxT.emetti('input', { az }); };
  const TASTI = { ArrowLeft: 'sx', ArrowRight: 'dx', ArrowDown: 'giu', ArrowUp: 'ruota', x: 'ruota', X: 'ruota', z: 'ruotaSx', Z: 'ruotaSx', ' ': 'caduta', c: 'hold', C: 'hold', Shift: 'hold' };
  const RIPETE = new Set(['sx', 'dx', 'giu']);
  const tenuti = new Map();
  document.addEventListener('keydown', (e) => {
    if (!ctxT || !ctxT.stato || !ctxT.partita || ctxT.partita.gioco !== 'tetris' || (window.Boss && Boss.attivo)) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const az = TASTI[e.key];
    if (!az) return;
    e.preventDefault();
    if (e.repeat) return;
    manda(az);
    if (RIPETE.has(az) && !tenuti.has(e.key)) {
      const t = setTimeout(() => { const iv = setInterval(() => manda(az), az === 'giu' ? 40 : 55); tenuti.set(e.key, iv); }, 160);
      tenuti.set(e.key, t);
    }
  });
  document.addEventListener('keyup', (e) => { const t = tenuti.get(e.key); if (t != null) { clearTimeout(t); clearInterval(t); tenuti.delete(e.key); } });
  window.addEventListener('blur', () => { for (const t of tenuti.values()) { clearTimeout(t); clearInterval(t); } tenuti.clear(); });
  let tieni = null;
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('[data-tt]');
    if (!b) return;
    e.preventDefault();
    const az = b.dataset.tt;
    manda(az);
    if (RIPETE.has(az)) tieni = setTimeout(() => { tieni = setInterval(() => manda(az), 60); }, 180);
  });
  const smetti = () => { if (tieni) { clearTimeout(tieni); clearInterval(tieni); tieni = null; } };
  document.addEventListener('pointerup', smetti);
  document.addEventListener('pointercancel', smetti);

  // gesti col dito sul proprio tabellone: tocco = ruota, trascinare di lato = sposta (un quadretto alla volta),
  // trascinare in giù = scende, colpo veloce in giù = caduta
  let gesto = null;
  document.addEventListener('pointerdown', (e) => {
    if (!mia || e.target !== mia.tela || e.pointerType === 'mouse') return;
    e.preventDefault();
    gesto = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), mosso: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!gesto || e.pointerId !== gesto.id) return;
    const passo = Math.max(14, lMio);
    while (Math.abs(e.clientX - gesto.x) >= passo) { const d = Math.sign(e.clientX - gesto.x); manda(d > 0 ? 'dx' : 'sx'); gesto.x += d * passo; gesto.mosso = true; }
    while (e.clientY - gesto.y >= passo * 1.2) { manda('giu'); gesto.y += passo * 1.2; gesto.mosso = true; }
  });
  const fineGesto = (e) => {
    if (!gesto || e.pointerId !== gesto.id) return;
    const dt = performance.now() - gesto.t, dx = e.clientX - gesto.x0, dy = e.clientY - gesto.y0;
    if (e.type === 'pointerup') {
      if (dy > 50 && dy / dt > 0.9 && Math.abs(dx) < dy) manda('caduta');
      else if (!gesto.mosso && Math.hypot(dx, dy) < 12 && dt < 350) manda('ruota');
    }
    gesto = null;
  };
  document.addEventListener('pointerup', fineGesto);
  document.addEventListener('pointercancel', fineGesto);

  Object.assign(window.Tavoli, { tetris });
})();
