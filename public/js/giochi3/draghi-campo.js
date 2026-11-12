// DRAGHI E SEGRETE — il campo di battaglia: la mappa tattica su un canvas che resta lo stesso tra un aggiornamento e
// l'altro (si riattacca dopo ogni ridisegno del tavolo), con le pedine (ritratti dei personaggi, simboli dei mostri),
// gli anelli dei punti ferita, le condizioni, la nebbia dove il gruppo non vede, le caselle raggiungibili con il
// percorso, le aree degli incantesimi e le animazioni degli eventi (passi, colpi, numeri dei danni, esplosioni).
// Si sposta trascinando, si ingrandisce con la rotella o i pulsanti. A fianco: il pannello del turno con attacchi,
// incantesimi, azioni e privilegi di classe. I conti (movimento, aree, gittate) sono gli stessi del server.
// Il master umano che muove i nemici usa la stessa mappa: al turno di un nemico «il suo personaggio» è quel nemico
// (dmInfo.mano, dm.js) e le mosse partono come dm-cb; con 🖐️ Sposta mette i nemici dove vuole, in qualsiasi momento.
(() => {
  const { esc, suono } = window.Nuovi;
  const M = () => window.DraghiMappe, A = () => window.DraghiArte;
  const C = 32, CELLA = 1.5;
  const BLOCCA = new Set(['#', 'T', 'r', 't', 'w', 'c', 'S', 'f', 'a', 'l', 'k', 'u', 'L', 'o']), DIFFICILE = new Set(['~', 'b', ':']);
  const passabile = (ch) => !BLOCCA.has(ch);
  const ICONE_COND = { prono: '🛌', avvelenato: '🤢', spaventato: '😱', stordito: '💫', paralizzato: '⚡', privo: '💤', affascinato: '💕', accecato: '🙈', trattenuto: '🕸️', afferrato: '✊', invisibile: '👻', incapacitato: '😵', illuminato: '✨', rallentato: '🐌', assordato: '🙉', pietrificato: '🗿', esausto: '😩' };
  const ICONE_EFF = { Ira: '😡', Benedizione: '🙏', Nascosto: '👤', Scudo: '🛡️', 'Scudo della fede': '🛡️', Velocità: '⚡', 'Ispirazione bardica': '🎵', Santuario: '🕊️', 'Armatura magica': '🔷', Eroismo: '🦁' };
  const RAGGIO = { Minuscola: 0.3, Piccola: 0.4, Media: 0.44, Grande: 0.72, Enorme: 0.98, Mastodontica: 1.3 };
  const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * CELLA;
  const vivo = (c) => c && !c.morto && !c.fuggito && !(c.pf <= 0 && !c.pg);
  const inPiedi = (c) => vivo(c) && c.pf > 0;
  const fmt = (m) => `${String(Math.round(m * 10) / 10).replace('.', ',')} m`;

  function st(ctx) { const ui = ctx.ui; if (!ui.cb) ui.cb = { modo: 'muovi', sel: null, bersagli: [], hover: null, cam: { k: 1, ox: 0, oy: 0, fit: true }, evVisto: null, anim: [], posAnim: {}, chiave: null }; return ui.cb; }
  const cbDi = (ctx) => ctx.partita.combattimento;
  // il nemico che il master sta muovendo adesso (solo al master, solo al turno di quel nemico)
  const mano = (ctx) => { const I = ctx.partita.dmInfo; return I && I.mano && !ctx.stato.spettatore ? I.mano : null; };
  const mioIdDi = (ctx) => ctx.partita.mioId || (mano(ctx) ? mano(ctx).id : null);
  const io = (ctx) => { const cb = cbDi(ctx), id = mioIdDi(ctx); return cb && id ? cb.creature.find((c) => c.id === id) : null; };
  const pgDi = (ctx, id) => ctx.partita.pg.find((x) => x && x.uid === id) || (mano(ctx) && mano(ctx).id === id ? mano(ctx) : null);
  const mioTurno = (ctx) => { const cb = cbDi(ctx), id = mioIdDi(ctx); return !!(cb && !cb.finito && cb.attivo && id && cb.attivo === id && !ctx.stato.spettatore); };
  // le mosse: quelle del master per il nemico partono come dm-cb (stesse regole, controllate dal server)
  const manda = (ctx, a) => ctx.invia(mano(ctx) ? { ...a, tipo: 'dm-cb', mossa: a.tipo } : a);

  // ---------- conti come nel server ----------
  function raggiungibili(cb, c) {
    const sc = cb.scena, { w, h, g } = sc, metri = c.turno ? c.turno.movimento : 0;
    const costo = new Float64Array(w * h).fill(Infinity), da = new Int32Array(w * h).fill(-1);
    const nem = new Set(cb.creature.filter((x) => x.lato !== c.lato && inPiedi(x)).map((x) => x.y * w + x.x));
    const prono = c.condizioni.includes('prono');
    const s = c.y * w + c.x; costo[s] = 0;
    const coda = [s];
    while (coda.length) {
      let bi = 0; for (let k = 1; k < coda.length; k++) if (costo[coda[k]] < costo[coda[bi]]) bi = k;
      const i = coda.splice(bi, 1)[0], x = i % w, y = Math.floor(i / w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx, ch = g[j];
        if (!passabile(ch) || nem.has(j)) continue;
        if (dx && dy && (!passabile(g[y * w + xx]) || !passabile(g[yy * w + x]))) continue;
        const nc = costo[i] + (DIFFICILE.has(ch) || prono ? CELLA * 2 : CELLA);
        if (nc > metri + 1e-9 || nc >= costo[j]) continue;
        costo[j] = nc; da[j] = i; coda.push(j);
      }
    }
    return { costo, da };
  }
  const occupata = (cb, x, y, tranne) => cb.creature.some((c) => c !== tranne && vivo(c) && c.x === x && c.y === y);
  function celleArea(cb, c, punto, area) {
    const { w, h } = cb.scena, out = [], r = area.m / CELLA;
    const px = punto.x, py = punto.y, ang = Math.atan2(py - c.y, px - c.x);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let dentro = false;
      if (area.forma === 'sfera') dentro = Math.hypot(x - (area.suDiMe ? c.x : px), y - (area.suDiMe ? c.y : py)) <= r + 0.01;
      else if (area.forma === 'cubo') { const half = r / 2; dentro = Math.abs(x - px) <= half && Math.abs(y - py) <= half; }
      else if (area.forma === 'cono') { const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy); if (d > 0 && d <= r + 0.01) { let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; dentro = Math.abs(da) <= 0.47; } }
      else if (area.forma === 'linea') { const dx = x - c.x, dy = y - c.y; const l = dx * Math.cos(ang) + dy * Math.sin(ang), perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang)); dentro = l > 0 && l <= r + 0.01 && perp <= 0.55; }
      const ox = area.suDiMe || area.forma !== 'sfera' ? c.x : px, oy = area.suDiMe || area.forma !== 'sfera' ? c.y : py;
      if (dentro && (area.forma === 'sfera' || M().vede(cb.scena, ox, oy, x, y))) out.push({ x, y });
    }
    return out;
  }
  const gittataInc = (inf) => (inf.gittata === 'tocco' ? CELLA : inf.gittata === 'se' ? 0 : Number(inf.gittata) || 18);

  // ---------- che cosa si sta per fare ----------
  // sel: { tipo: 'arma', id } | { tipo: 'inc', id, slot, bersagli: [] } | { tipo: 'az', az, chi: 'nemico'|'alleato'|'punto' }
  function comeBersaglio(ctx, sel) {
    if (!sel) return null;
    if (sel.tipo === 'arma') return 'nemico';
    if (sel.tipo === 'az') return sel.chi || null;
    if (sel.tipo === 'inc') {
      const inf = ctx.partita.incantesimi[sel.id]; if (!inf) return null;
      if (inf.area && !inf.area.suDiMe) return inf.gittata === 'se' ? 'direzione' : 'punto';
      if (inf.tipo === 'teletrasporto') return 'punto';
      if (inf.alleati) return inf.gittata === 'se' ? null : 'alleato';
      if (['attacco', 'salvezza', 'auto', 'uccidi'].includes(inf.tipo)) return 'nemico';
      return null;
    }
    return null;
  }
  // il bersaglio va bene? (distanza e linea di vista come nel server)
  function bersaglioOk(ctx, sel, b) {
    const cb = cbDi(ctx), me = io(ctx); if (!me || !b) return false;
    const chi = comeBersaglio(ctx, sel), d = dist(me, b);
    if (chi === 'nemico' && (b.lato === me.lato || !vivo(b))) return false;
    if (chi === 'alleato' && (b.lato !== me.lato || b.morto && !(sel.tipo === 'inc' && ctx.partita.incantesimi[sel.id].tipo === 'rianima'))) return false;
    if (sel.tipo === 'arma') {
      const me2 = pgDi(ctx, me.id); const a = sel.id ? me2.attacchi.find((x) => x.id === sel.id) : null;
      const max = a ? (a.mischia && !a.lancio ? a.portata || CELLA : a.gittata ? a.gittata[1] : a.portata || CELLA) : Math.max(...me2.attacchi.map((x) => (x.mischia && !x.lancio ? x.portata || CELLA : x.gittata ? x.gittata[1] : CELLA)));
      return d <= max + 1e-9 && M().vede(cb.scena, me.x, me.y, b.x, b.y);
    }
    if (sel.tipo === 'inc') { const inf = ctx.partita.incantesimi[sel.id]; return d <= Math.max(gittataInc(inf), CELLA) + 1e-9 && (b === me || M().vede(cb.scena, me.x, me.y, b.x, b.y)); }
    if (sel.tipo === 'az') return d <= (sel.portata || CELLA) + 1e-9;
    return false;
  }

  // ---------- il canvas che resta ----------
  function campo(ctx) {
    const ui = ctx.ui;
    if (ui.campo) return ui.campo;
    const wrap = document.createElement('div'); wrap.className = 'dr-campo';
    wrap.innerHTML = `<canvas></canvas><div class="dr-campo-tip" hidden></div><div class="dr-campo-zoom"><button type="button" data-z="+" aria-label="Ingrandisci">+</button><button type="button" data-z="-" aria-label="Rimpicciolisci">−</button><button type="button" data-z="0" aria-label="Tutta la mappa">⤢</button><button type="button" data-z="io" aria-label="Il mio personaggio">◎</button></div><div class="dr-campo-banner" hidden></div>`;
    const cv = wrap.querySelector('canvas'), tip = wrap.querySelector('.dr-campo-tip'), banner = wrap.querySelector('.dr-campo-banner');
    const F = { wrap, cv, tip, banner, g: cv.getContext('2d'), W: 0, H: 0, dpr: 1, ctx, nebbia: null, chiaveNebbia: '', ultimoDisegno: 0 };
    ui.campo = F;
    const cella = (e) => { const s = st(F.ctx), r = cv.getBoundingClientRect(); const k = s.cam.k; return { x: Math.floor((e.clientX - r.left - s.cam.ox) / (C * k)), y: Math.floor((e.clientY - r.top - s.cam.oy) / (C * k)), sx: e.clientX - r.left, sy: e.clientY - r.top }; };
    let giu = null;
    cv.addEventListener('pointerdown', (e) => { giu = { x: e.clientX, y: e.clientY, ox: st(F.ctx).cam.ox, oy: st(F.ctx).cam.oy, mosso: false, id: e.pointerId }; });
    cv.addEventListener('pointermove', (e) => {
      const s = st(F.ctx);
      if (giu && giu.id === e.pointerId && (e.buttons || e.pointerType === 'touch')) {
        const dx = e.clientX - giu.x, dy = e.clientY - giu.y;
        if (giu.mosso || Math.hypot(dx, dy) > 7) { giu.mosso = true; s.cam.fit = false; s.cam.ox = giu.ox + dx; s.cam.oy = giu.oy + dy; limita(F, s); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); }
      }
      const c = cella(e); s.hover = c; aggiornaTip(F, c);
    });
    cv.addEventListener('pointerleave', () => { st(F.ctx).hover = null; tip.hidden = true; });
    cv.addEventListener('pointerup', (e) => { const g2 = giu; giu = null; if (g2 && !g2.mosso) { const c = cella(e); st(F.ctx).hover = c; tocca(F.ctx, c); } });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(F, e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    wrap.querySelector('.dr-campo-zoom').addEventListener('click', (e) => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      const z = b.dataset.z, s = st(F.ctx);
      if (z === '+') zoom(F, 1.25, F.W / 2, F.H / 2); else if (z === '-') zoom(F, 1 / 1.25, F.W / 2, F.H / 2);
      else if (z === '0') { s.cam.fit = true; adatta(F, s, true); } else if (z === 'io') centra(F, io(F.ctx), true);
    });
    new ResizeObserver(() => { misura(F); }).observe(wrap);
    const ciclo = (t) => { if (!wrap.isConnected && ui.campo !== F) return; requestAnimationFrame(ciclo); if (!wrap.isConnected) return; const anim = st(F.ctx).anim.length || Object.keys(st(F.ctx).posAnim).length; if (!anim && t - F.ultimoDisegno < 45) return; F.ultimoDisegno = t; disegna(F, t); };
    requestAnimationFrame(ciclo);
    return F;
  }
  function misura(F) {
    const r = F.wrap.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!r.width || !r.height) return;
    F.W = r.width; F.H = r.height; F.dpr = dpr;
    F.cv.width = Math.round(r.width * dpr); F.cv.height = Math.round(r.height * dpr);
    F.cv.style.width = `${r.width}px`; F.cv.style.height = `${r.height}px`;
    adatta(F, st(F.ctx), false);
  }
  // la zona utile della scena: dove non c'è roccia piena (più le creature), con un quadretto di margine
  function zonaUtile(cb) {
    const sc = cb.scena;
    let x0 = sc.w, y0 = sc.h, x1 = -1, y1 = -1;
    for (let y = 0; y < sc.h; y++) for (let x = 0; x < sc.w; x++) if (sc.g[y * sc.w + x] !== '#') { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (const c of cb.creature) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
    if (x1 < 0) return { x0: 0, y0: 0, x1: sc.w - 1, y1: sc.h - 1 };
    return { x0: Math.max(0, x0 - 1), y0: Math.max(0, y0 - 1), x1: Math.min(sc.w - 1, x1 + 1), y1: Math.min(sc.h - 1, y1 + 1) };
  }
  function adatta(F, s, forza) {
    const cb = cbDi(F.ctx); if (!cb || !F.W) return;
    const z = zonaUtile(cb), zw = (z.x1 - z.x0 + 1) * C, zh = (z.y1 - z.y0 + 1) * C;
    const kFit = Math.min(F.W / zw, F.H / zh, 2.2);
    if (s.cam.fit || forza) {
      if (kFit * C >= 30 || forza) { s.cam.k = kFit; s.cam.ox = (F.W - zw * kFit) / 2 - z.x0 * C * kFit; s.cam.oy = (F.H - zh * kFit) / 2 - z.y0 * C * kFit; s.cam.fit = true; s.cam.zona = true; return; }
      // la scena intera non sta (succede sul telefono): si inquadrano almeno tutte le creature in campo, così
      // all'inizio della battaglia si vedono anche i nemici e non solo il proprio personaggio
      const vive = cb.creature.filter((c) => vivo(c));
      if (vive.length) {
        const x0 = Math.max(0, Math.min(...vive.map((c) => c.x)) - 1), x1 = Math.min(cb.scena.w - 1, Math.max(...vive.map((c) => c.x)) + 1);
        const y0 = Math.max(0, Math.min(...vive.map((c) => c.y)) - 1), y1 = Math.min(cb.scena.h - 1, Math.max(...vive.map((c) => c.y)) + 1);
        const bw = (x1 - x0 + 1) * C, bh = (y1 - y0 + 1) * C, kC = Math.min(F.W / bw, F.H / bh, (F.W < 600 ? 28 : 36) / C);
        if (kC * C >= 17) { s.cam.k = kC; s.cam.fit = false; s.cam.ox = (F.W - bw * kC) / 2 - x0 * C * kC; s.cam.oy = (F.H - bh * kC) / 2 - y0 * C * kC; limita(F, s); return; }
      }
      s.cam.k = (F.W < 600 ? 28 : 36) / C; s.cam.fit = false; centra(F, io(F.ctx) || cb.creature.find((c) => c.id === cb.attivo), false);
    }
    limita(F, s);
  }
  function limita(F, s) {
    const cb = cbDi(F.ctx); if (!cb) return;
    const mw = cb.scena.w * C * s.cam.k, mh = cb.scena.h * C * s.cam.k, m = 60;
    if (s.cam.fit) return;
    s.cam.ox = mw <= F.W ? Math.min(Math.max(s.cam.ox, 0), F.W - mw) : Math.min(m, Math.max(F.W - mw - m, s.cam.ox));
    s.cam.oy = mh <= F.H ? Math.min(Math.max(s.cam.oy, 0), F.H - mh) : Math.min(m, Math.max(F.H - mh - m, s.cam.oy));
  }
  function zoom(F, f, sx, sy) {
    const s = st(F.ctx), k0 = s.cam.k, k = Math.max(0.35, Math.min(2.6, k0 * f));
    s.cam.ox = sx - ((sx - s.cam.ox) * k) / k0; s.cam.oy = sy - ((sy - s.cam.oy) * k) / k0; s.cam.k = k; s.cam.fit = false; limita(F, s);
  }
  function centra(F, c, anima) {
    if (!c || !F.W) return;
    const s = st(F.ctx), k = s.cam.k, mw = cbDi(F.ctx).scena.w * C * k, mh = cbDi(F.ctx).scena.h * C * k;
    if (s.cam.fit) return;
    const ox = F.W / 2 - (c.x + 0.5) * C * k, oy = F.H / 2 - (c.y + 0.5) * C * k;
    if (!anima) { s.cam.ox = ox; s.cam.oy = oy; limita(F, s); return; }
    const da = { ox: s.cam.ox, oy: s.cam.oy }, t0 = performance.now();
    s.anim.push({ t0, dur: 450, f: (q) => { s.cam.ox = da.ox + (ox - da.ox) * q; s.cam.oy = da.oy + (oy - da.oy) * q; if (q >= 1) limita(F, s); } });
  }

  // ---------- il tocco su una casella ----------
  function tocca(ctx, c) {
    const cb = cbDi(ctx); if (!cb) return;
    if (st(ctx).sposta && ctx.partita.dmInfo) return toccaSposta(ctx, c);
    if (!mioTurno(ctx)) return;
    const s = st(ctx), me = io(ctx); if (!me) return;
    if (c.x < 0 || c.y < 0 || c.x >= cb.scena.w || c.y >= cb.scena.h) return;
    const chi = cb.creature.find((x) => x.x === c.x && x.y === c.y && vivo(x)) || cb.creature.find((x) => x.x === c.x && x.y === c.y && !x.fuggito);
    const sel = s.sel, come = comeBersaglio(ctx, sel);
    if (sel && (come === 'punto' || come === 'direzione')) {
      const inf = sel.tipo === 'inc' ? ctx.partita.incantesimi[sel.id] : null;
      if (come === 'punto' && inf && dist(me, c) > gittataInc(inf) + 1e-9) return ctx.avviso(`Troppo lontano: massimo ${fmt(gittataInc(inf))}`);
      if (come === 'direzione' && c.x === me.x && c.y === me.y) return ctx.avviso('Tocca una casella nella direzione in cui lanciare');
      const punto = { x: c.x, y: c.y };
      if (sel.tipo === 'inc') return lancia(ctx, sel, { punto });
      return azione(ctx, { az: sel.az, punto, ...(sel.extra || {}) });
    }
    if (chi && sel && (come === 'nemico' || come === 'alleato')) {
      if (!bersaglioOk(ctx, sel, chi)) return ctx.avviso(chi.lato === me.lato && come === 'nemico' ? 'È dalla tua parte!' : chi.lato !== me.lato && come === 'alleato' ? 'Scegli un alleato' : 'Troppo lontano o non lo vedi');
      if (sel.tipo === 'arma') return attacca(ctx, chi.id);
      if (sel.tipo === 'az') return azione(ctx, { az: sel.az, bersaglio: chi.id, ...(sel.extra || {}) });
      if (sel.tipo === 'inc') {
        const inf = ctx.partita.incantesimi[sel.id], max = Math.max(1, inf.bersagli || 1);
        sel.bersagli = sel.bersagli.includes(chi.id) ? sel.bersagli.filter((x) => x !== chi.id) : [...sel.bersagli, chi.id];
        if (sel.bersagli.length >= max || max === 1) return lancia(ctx, sel, {});
        return ctx.ridisegna();
      }
    }
    // senza niente di scelto: un nemico si attacca con l'arma migliore, una casella libera è un passo
    if (chi && chi !== me && chi.lato !== me.lato && vivo(chi) && !sel) {
      const t = me.turno; if (t && (t.azione || t.attacchi > 0 && t.attacchi < t.attacchiMax)) { if (bersaglioOk(ctx, { tipo: 'arma', id: null }, chi)) return attacca(ctx, chi.id); return ctx.avviso('Troppo lontano: avvicinati o scegli un\'arma a distanza'); }
      return ctx.avviso('Hai già usato l\'azione');
    }
    if (!chi || chi === me) {
      if (sel) { s.sel = null; return ctx.ridisegna(); }
      if (chi === me) return undefined;
      const { costo } = raggiungibili(cb, me);
      const j = c.y * cb.scena.w + c.x;
      if (costo[j] === Infinity) return ctx.avviso(me.turno && me.turno.movimento > 0 ? 'Non ci arrivi con il movimento che ti resta' : 'Hai finito il movimento');
      if (occupata(cb, c.x, c.y, me)) return ctx.avviso('Lì c\'è già qualcuno');
      suono([[260, 0.03], [300, 0.03]], { tipo: 'sine', volume: 0.03 });
      return manda(ctx, { tipo: 'muovi', x: c.x, y: c.y });
    }
    return undefined;
  }
  // 🖐️ la mano del master: prima tocca il nemico, poi la casella dove metterlo
  function toccaSposta(ctx, c) {
    const cb = cbDi(ctx), s = st(ctx);
    if (c.x < 0 || c.y < 0 || c.x >= cb.scena.w || c.y >= cb.scena.h) return undefined;
    const chi = cb.creature.find((x) => x.x === c.x && x.y === c.y && vivo(x));
    if (chi && chi.lato === 'nemici' && !chi.pg) { s.sposta.id = s.sposta.id === chi.id ? null : chi.id; return ctx.ridisegna(); }
    if (!s.sposta.id) return ctx.avviso(chi ? 'Puoi spostare solo i nemici' : 'Tocca prima il nemico da spostare');
    if (chi) return ctx.avviso('Lì c\'è già qualcuno');
    if (!passabile(cb.scena.g[c.y * cb.scena.w + c.x])) return ctx.avviso('Lì non ci si può stare');
    suono([[300, 0.04], [240, 0.05]], { tipo: 'sine', volume: 0.03 });
    return ctx.invia({ tipo: 'dm-cb', mossa: 'sposta', id: s.sposta.id, x: c.x, y: c.y });
  }
  function attacca(ctx, bersaglio) {
    const s = st(ctx), a = { tipo: 'attacca', bersaglio };
    if (s.sel && s.sel.tipo === 'arma' && s.sel.id) a.arma = s.sel.id;
    if (s.punizione) a.punizione = s.punizione;
    if (s.dueMani) a.dueMani = true;
    s.punizione = null;
    suono([[180, 0.04], [120, 0.05]], { tipo: 'sawtooth', volume: 0.03 });
    manda(ctx, a);
    const me = io(ctx); if (me && me.turno && me.turno.attacchi + 1 >= me.turno.attacchiMax) s.sel = null;
    return ctx.ridisegna();
  }
  function lancia(ctx, sel, { punto = null } = {}) {
    const a = { tipo: 'lancia', inc: sel.id, bersagli: sel.bersagli || [] };
    if (sel.slot) a.slot = sel.slot;
    if (punto) a.punto = punto;
    st(ctx).sel = null;
    suono([[520, 0.05], [780, 0.06], [1040, 0.08]], { tipo: 'sine', volume: 0.04 });
    manda(ctx, a);
    return ctx.ridisegna();
  }
  function azione(ctx, extra) { st(ctx).sel = null; manda(ctx, { tipo: 'azione', ...extra }); return ctx.ridisegna(); }

  // ---------- gli eventi diventano animazioni ----------
  function eventi(ctx) {
    const cb = cbDi(ctx), s = st(ctx), F = ctx.ui.campo; if (!cb) return;
    const chiave = `${cb.scena.stile}${cb.scena.w}x${cb.scena.h}${cb.scena.g.slice(0, 120)}`;
    const ultimo = cb.eventi.length ? cb.eventi[cb.eventi.length - 1].n : 0;
    if (s.chiave !== chiave) { s.chiave = chiave; s.evVisto = ultimo; s.anim = []; s.posAnim = {}; s.sel = null; if (F) { F.chiaveNebbia = ''; adatta(F, s, false); } return; }
    const nuovi = cb.eventi.filter((e) => e.n > s.evVisto);
    s.evVisto = ultimo;
    if (!nuovi.length) return;
    let t = performance.now();
    const pos = (id) => { const c = cb.creature.find((x) => x.id === id); return c ? { x: c.x, y: c.y } : null; };
    const testo = (id, tx, col, grande = false) => { const p = pos(id); if (p) s.anim.push({ t0: t, dur: 1300, testo: tx, col, grande, x: p.x, y: p.y }); };
    for (const e of nuovi) {
      if (e.tipo === 'movimento' && e.percorso && e.percorso.length > 1) {
        const dur = Math.min(1600, 120 * (e.percorso.length - 1));
        s.posAnim[e.id] = { percorso: e.percorso, t0: t, dur };
        t += dur * 0.7;
      } else if (e.tipo === 'movimento' && e.teletrasporto) { const p = pos(e.id); if (p) s.anim.push({ t0: t, dur: 700, lampo: true, x: p.x, y: p.y, col: '#b080ff' }); t += 200; }
      else if (e.tipo === 'attacco') {
        const da = pos(e.da), a = pos(e.a);
        if (da && a) s.anim.push({ t0: t, dur: 380, colpo: true, da, a, distanza: dist(da, a) > CELLA, magia: !!(ctx.partita.incantesimi && Object.values(ctx.partita.incantesimi).some((x) => x.nome === e.arma)) });
        t += 260;
        if (e.colpito) { testo(e.a, e.critico ? `CRITICO! −${e.danno}` : `−${e.danno}`, e.critico ? '#ffd040' : '#ff5a4a', e.critico); s.anim.push({ t0: t, dur: 350, scossa: e.a }); suono(e.critico ? [[220, 0.06], [110, 0.12]] : [[160, 0.06]], { tipo: 'square', volume: 0.025 }); }
        else { testo(e.a, 'mancato', '#d8d0c0'); suono([[700, 0.03]], { tipo: 'sine', volume: 0.02 }); }
        t += 240;
      } else if (e.tipo === 'area' && e.celle) {
        s.anim.push({ t0: t, dur: 900, area: e.celle, col: /fuoco|Soffio|Palla|brucianti/i.test(e.testo) ? '255,120,40' : /freddo|Gelo|Ghiaccio|Neve|Cono/i.test(e.testo) ? '120,200,255' : /fulmine|Fulmine|tuono|Onda/i.test(e.testo) ? '200,200,255' : '200,120,255' });
        suono([[90, 0.15], [70, 0.2]], { tipo: 'sawtooth', volume: 0.04 }); t += 400;
      } else if (e.tipo === 'cura') { testo(e.id, `+${e.quanti}`, '#6ee07a'); s.anim.push({ t0: t, dur: 800, lampo: true, ...pos(e.id), col: '#6ee07a' }); t += 250; }
      else if (e.tipo === 'salvezza') { testo(e.a, e.riuscita ? 'resiste' : 'colpito!', e.riuscita ? '#c8d8ff' : '#ff9a4a'); t += 220; }
      else if (e.tipo === 'cade' || e.tipo === 'muore') { testo(e.id, e.tipo === 'muore' ? '💀' : '⬇', '#ffffff', true); t += 200; }
      else if (e.tipo === 'incantesimo') { const p = pos(e.da); if (p) s.anim.push({ t0: t, dur: 600, lampo: true, ...p, col: '#c8a0ff' }); t += 150; }
      else if (e.tipo === 'turno' && e.id === mioIdDi(ctx) && !ctx.stato.spettatore) { suono([[523, 0.08], [784, 0.12]], { tipo: 'triangle', volume: 0.05 }); if (F) setTimeout(() => centra(F, io(ctx), true), Math.max(0, t - performance.now())); s.sel = null; s.modo = 'muovi'; }
      else if (e.tipo === 'fine') { if (F) mostraBanner(F, e.esito === 'vittoria' ? '🏆 Vittoria!' : '💀 Sconfitta…', e.esito); }
    }
  }
  function mostraBanner(F, testo, cls) { F.banner.textContent = testo; F.banner.className = `dr-campo-banner ${cls || ''}`; F.banner.hidden = false; clearTimeout(F.tBanner); F.tBanner = setTimeout(() => { F.banner.hidden = true; }, 2600); }

  // ---------- disegno ----------
  function posizione(s, c, t) {
    const a = s.posAnim[c.id];
    if (!a) return { x: c.x, y: c.y };
    const q = Math.min(1, (t - a.t0) / a.dur);
    if (q < 0) return a.percorso[0];
    if (q >= 1) { delete s.posAnim[c.id]; return { x: c.x, y: c.y }; }
    const f = q * (a.percorso.length - 1), i = Math.floor(f), r = f - i, p0 = a.percorso[i], p1 = a.percorso[Math.min(a.percorso.length - 1, i + 1)];
    return { x: p0.x + (p1.x - p0.x) * r, y: p0.y + (p1.y - p0.y) * r, cammina: true };
  }
  function nebbia(F, cb) {
    const sc = cb.scena;
    if (sc.luce === 'giorno') { F.vis = null; return null; }
    const occhi = cb.creature.filter((c) => c.lato === 'gruppo' && vivo(c)).map((c) => ({ x: c.x, y: c.y }));
    const chiave = `${sc.g.length}:${occhi.map((o) => `${o.x},${o.y}`).join(';')}:${sc.luce}`;
    if (F.chiaveNebbia === chiave) return F.nebbia;
    const vis = M().campoVisivo(sc, occhi, sc.luce === 'buio' ? 8 : sc.luce === 'emergenza' ? 9 : 11);
    F.vis = vis;
    const cv = F.nebbia || document.createElement('canvas'); cv.width = sc.w; cv.height = sc.h;
    const g = cv.getContext('2d'), img = g.createImageData(sc.w, sc.h);
    const a = sc.luce === 'buio' ? 200 : sc.luce === 'emergenza' ? 170 : 125;
    for (let i = 0; i < vis.length; i++) { img.data[i * 4] = 6; img.data[i * 4 + 1] = 4; img.data[i * 4 + 2] = 12; img.data[i * 4 + 3] = vis[i] ? 0 : a; }
    g.putImageData(img, 0, 0);
    F.nebbia = cv; F.chiaveNebbia = chiave;
    return cv;
  }
  function disegna(F, t) {
    const ctx = F.ctx, cb = cbDi(ctx); if (!cb || !F.W) return;
    const s = st(ctx), g = F.g, sc = cb.scena, k = s.cam.k;
    for (const a of s.anim) if (a.f) a.f(Math.min(1, (t - a.t0) / a.dur));
    s.anim = s.anim.filter((a) => t - a.t0 < a.dur);
    g.setTransform(F.dpr, 0, 0, F.dpr, 0, 0);
    g.fillStyle = '#0d0a08'; g.fillRect(0, 0, F.W, F.H);
    g.save();
    // scossa dello schermo per i critici
    g.translate(s.cam.ox, s.cam.oy); g.scale(k, k);
    g.imageSmoothingEnabled = true;
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 24 / k;
    g.drawImage(M().stratoScena(sc), 0, 0);
    g.shadowBlur = 0;
    const me = io(ctx), mio = mioTurno(ctx);
    const fog = nebbia(F, cb);
    if (fog) { g.imageSmoothingEnabled = true; g.drawImage(fog, 0, 0, sc.w * C, sc.h * C); for (const c of cb.creature) if (c.lato === 'gruppo' && vivo(c)) { const p = posizione(s, c, t); const gr = g.createRadialGradient((p.x + 0.5) * C, (p.y + 0.5) * C, C, (p.x + 0.5) * C, (p.y + 0.5) * C, C * 5); gr.addColorStop(0, 'rgba(255,190,90,.16)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = gr; g.fillRect((p.x - 5) * C, (p.y - 5) * C, C * 11, C * 11); } }
    // la luce rossa d'emergenza delle ambientazioni horror
    if (sc.luce === 'emergenza') { g.fillStyle = `rgba(190,20,10,${0.1 + 0.06 * Math.sin(t / 420)})`; g.fillRect(0, 0, sc.w * C, sc.h * C); }
    // caselle raggiungibili e percorso
    let rag = null;
    if (mio && me && me.turno && !s.sel && me.turno.movimento > 0) {
      rag = raggiungibili(cb, me);
      g.fillStyle = 'rgba(90,170,255,.16)';
      for (let i = 0; i < rag.costo.length; i++) if (rag.costo[i] !== Infinity && rag.costo[i] > 0) g.fillRect((i % sc.w) * C + 1, Math.floor(i / sc.w) * C + 1, C - 2, C - 2);
      g.strokeStyle = 'rgba(140,200,255,.35)'; g.lineWidth = 1;
      for (let i = 0; i < rag.costo.length; i++) if (rag.costo[i] !== Infinity && rag.costo[i] > 0) { const x = i % sc.w, y = Math.floor(i / sc.w); const fuori = (xx, yy) => xx < 0 || yy < 0 || xx >= sc.w || yy >= sc.h || rag.costo[yy * sc.w + xx] === Infinity; g.beginPath(); if (fuori(x, y - 1)) { g.moveTo(x * C, y * C); g.lineTo(x * C + C, y * C); } if (fuori(x, y + 1)) { g.moveTo(x * C, y * C + C); g.lineTo(x * C + C, y * C + C); } if (fuori(x - 1, y)) { g.moveTo(x * C, y * C); g.lineTo(x * C, y * C + C); } if (fuori(x + 1, y)) { g.moveTo(x * C + C, y * C); g.lineTo(x * C + C, y * C + C); } g.stroke(); }
    }
    const h = s.hover;
    if (rag && h && h.x >= 0 && h.y >= 0 && h.x < sc.w && h.y < sc.h) {
      const j = h.y * sc.w + h.x;
      if (rag.costo[j] !== Infinity && rag.costo[j] > 0 && !occupata(cb, h.x, h.y, me)) {
        const pts = []; for (let i = j; i >= 0 && i !== me.y * sc.w + me.x; i = rag.da[i]) pts.unshift(i); pts.unshift(me.y * sc.w + me.x);
        g.strokeStyle = 'rgba(255,240,200,.85)'; g.lineWidth = 3; g.setLineDash([6, 6]); g.lineDashOffset = -t / 40; g.beginPath();
        pts.forEach((i, n) => { const x = (i % sc.w + 0.5) * C, y = (Math.floor(i / sc.w) + 0.5) * C; if (n) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(255,240,200,.25)'; g.fillRect(h.x * C, h.y * C, C, C);
        etichetta(g, fmt(rag.costo[j]), (h.x + 0.5) * C, h.y * C - 6, k);
      }
    }
    // aree e gittate degli incantesimi che si stanno per lanciare
    const come = comeBersaglio(ctx, s.sel);
    if (mio && me && s.sel && s.sel.tipo === 'inc') {
      const inf = ctx.partita.incantesimi[s.sel.id], gt = gittataInc(inf);
      if (gt > CELLA && come !== 'direzione') { g.strokeStyle = 'rgba(200,160,255,.55)'; g.lineWidth = 2; g.setLineDash([8, 6]); const r = (gt / CELLA + 0.5) * C; g.strokeRect((me.x + 0.5) * C - r, (me.y + 0.5) * C - r, r * 2, r * 2); g.setLineDash([]); }
      if (inf.area && (inf.area.suDiMe || (h && (come === 'punto' || come === 'direzione')))) {
        const punto = inf.area.suDiMe ? { x: me.x, y: me.y } : { x: h.x, y: h.y };
        if (inf.area.suDiMe || (punto.x !== me.x || punto.y !== me.y)) {
          const celle = celleArea(cb, me, punto, inf.area), puls = 0.28 + 0.1 * Math.sin(t / 180);
          g.fillStyle = `rgba(255,110,40,${puls})`; for (const p of celle) g.fillRect(p.x * C, p.y * C, C, C);
          g.strokeStyle = 'rgba(255,170,90,.8)'; g.lineWidth = 1; for (const p of celle) g.strokeRect(p.x * C + 0.5, p.y * C + 0.5, C - 1, C - 1);
        }
      }
    }
    if (mio && me && s.sel && s.sel.tipo === 'az' && (come === 'punto' || come === 'direzione') && h && s.sel.area) {
      const celle = celleArea(cb, me, { x: h.x, y: h.y }, s.sel.area);
      g.fillStyle = `rgba(255,110,40,${0.3 + 0.1 * Math.sin(t / 180)})`; for (const p of celle) g.fillRect(p.x * C, p.y * C, C, C);
    }
    // aree esplose (animazione)
    for (const a of s.anim) if (a.area) { const q = (t - a.t0) / a.dur; g.fillStyle = `rgba(${a.col},${0.65 * (1 - q)})`; for (const p of a.area) g.fillRect(p.x * C, p.y * C, C, C); }
    // le pedine (prima i caduti, poi i vivi, l'attivo sopra)
    const ordine = cb.creature.filter((c) => !c.fuggito).sort((a, b) => (vivo(a) - vivo(b)) || ((a.id === cb.attivo) - (b.id === cb.attivo)) || (a.y - b.y));
    for (const c of ordine) pedina(F, g, c, s, t, cb, me, mio, come, F.vis);
    // 🖐️ il nemico che il master sta per spostare
    const daSpostare = s.sposta && s.sposta.id ? cb.creature.find((c) => c.id === s.sposta.id && vivo(c)) : null;
    if (daSpostare) { const r = (RAGGIO[daSpostare.taglia] || 0.44) * C + 8; g.strokeStyle = `rgba(190,140,255,${0.65 + 0.3 * Math.sin(t / 150)})`; g.lineWidth = 3; g.setLineDash([4, 4]); g.beginPath(); g.arc((daSpostare.x + 0.5) * C, (daSpostare.y + 0.5) * C, r, 0, 7); g.stroke(); g.setLineDash([]); }
    // colpi, lampi e numeri
    for (const a of s.anim) {
      const q = Math.min(1, Math.max(0, (t - a.t0) / a.dur)); if (t < a.t0) continue;
      if (a.colpo) {
        const x0 = (a.da.x + 0.5) * C, y0 = (a.da.y + 0.5) * C, x1 = (a.a.x + 0.5) * C, y1 = (a.a.y + 0.5) * C;
        if (a.distanza) { const x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q; g.strokeStyle = a.magia ? 'rgba(200,150,255,.95)' : 'rgba(255,240,210,.95)'; g.lineWidth = a.magia ? 4 : 2.5; g.beginPath(); g.moveTo(x - (x1 - x0) * 0.12, y - (y1 - y0) * 0.12); g.lineTo(x, y); g.stroke(); if (a.magia) { g.fillStyle = 'rgba(220,180,255,.9)'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } }
        else { const ang = Math.atan2(y1 - y0, x1 - x0); g.strokeStyle = `rgba(255,255,255,${1 - q})`; g.lineWidth = 3; g.beginPath(); g.arc(x1, y1, C * 0.55, ang - 2.2 + q * 1.6, ang - 1.2 + q * 1.6); g.stroke(); }
      }
      if (a.lampo && a.x != null) { g.fillStyle = a.col; g.globalAlpha = 0.5 * (1 - q); g.beginPath(); g.arc((a.x + 0.5) * C, (a.y + 0.5) * C, C * (0.4 + q * 0.9), 0, 7); g.fill(); g.globalAlpha = 1; }
      if (a.testo) { const y = (a.y + 0.2) * C - q * C * 1.2; g.globalAlpha = q > 0.7 ? (1 - q) / 0.3 : 1; scritta(g, a.testo, (a.x + 0.5) * C, y, a.grande ? 17 : 14, a.col); g.globalAlpha = 1; }
    }
    g.restore();
  }
  function etichetta(g, tx, x, y, k) { g.font = `600 ${Math.max(10, 11 / Math.min(1, k))}px system-ui, sans-serif`; const w = g.measureText(tx).width + 10; g.fillStyle = 'rgba(20,14,8,.85)'; g.fillRect(x - w / 2, y - 14, w, 17); g.fillStyle = '#ffe9b0'; g.textAlign = 'center'; g.fillText(tx, x, y - 1); }
  function scritta(g, tx, x, y, dim, col) { g.font = `800 ${dim}px Georgia, serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(tx, x, y); g.fillStyle = col; g.fillText(tx, x, y); }
  function pedina(F, g, c, s, t, cb, me, mio, come, vis) {
    const p = posizione(s, c, t), r = (RAGGIO[c.taglia] || 0.44) * C;
    let x = (p.x + 0.5) * C, y = (p.y + 0.5) * C;
    const scossa = s.anim.find((a) => a.scossa === c.id && t >= a.t0);
    if (scossa) x += Math.sin((t - scossa.t0) / 22) * 3 * (1 - (t - scossa.t0) / scossa.dur);
    if (p.cammina) y -= Math.abs(Math.sin(t / 70)) * 2.5;
    const morto = c.morto || (!c.pg && c.pf <= 0), aTerra = c.pg && c.pf <= 0 && !c.morto;
    const attivo = c.id === cb.attivo && !cb.finito;
    g.save();
    const alBuio = vis && c.lato !== 'gruppo' && !vis[c.y * cb.scena.w + c.x];
    if (morto) g.globalAlpha = 0.5; else if (alBuio) g.globalAlpha = 0.45;
    if (c.armadietto || c.fumo) g.globalAlpha = 0.35; // nell'armadietto o nel fumo: non si vede
    // ombra
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x, y + r * 0.78, r * 0.95, r * 0.38, 0, 0, 7); g.fill();
    // alone dell'attivo e dei bersagli possibili
    if (attivo) { const gr = g.createRadialGradient(x, y, r * 0.6, x, y, r * 1.7); gr.addColorStop(0, 'rgba(255,210,90,.55)'); gr.addColorStop(1, 'rgba(255,210,90,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.7, 0, 7); g.fill(); }
    const sel = s.sel;
    const bersagliabile = mio && me && c !== me && !morto && ((sel && (come === 'nemico' || come === 'alleato') && bersaglioOk(F.ctx, sel, c)) || (!sel && c.lato !== me.lato && inPiedi(c) && me.turno && (me.turno.azione || me.turno.attacchi > 0 && me.turno.attacchi < me.turno.attacchiMax) && bersaglioOk(F.ctx, { tipo: 'arma', id: null }, c)));
    if (bersagliabile) { g.strokeStyle = c.lato === me.lato ? 'rgba(110,230,130,.9)' : `rgba(255,70,50,${0.6 + 0.35 * Math.sin(t / 160)})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 5, 0, 7); g.stroke(); }
    // il disco
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.closePath();
    if (c.pg) {
      const pg = pgDi(F.ctx, c.id);
      g.fillStyle = '#2a2018'; g.fill(); g.clip();
      const img = pg ? M().immagineRitratto(pg) : null;
      if (img && img.complete && img.naturalWidth) { const d = r * 2 * 1.75; g.drawImage(img, x - d / 2, y - d * 0.47, d, d * 1.2); }
      if (aTerra || morto) { g.fillStyle = 'rgba(40,40,50,.55)'; g.fillRect(x - r, y - r, r * 2, r * 2); }
    } else {
      const col = (c.aspetto && c.aspetto.col) || '#8a3a3a';
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, A().scurisci(col, 1.5)); gr.addColorStop(1, A().scurisci(col, 0.55));
      g.fillStyle = gr; g.fill();
      g.font = `${Math.round(r * 1.15)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText((c.aspetto && c.aspetto.s) || '👾', x, y + r * 0.06); g.textBaseline = 'alphabetic';
    }
    g.restore();
    // bordo del lato e anello dei punti ferita
    const mioPg = me && c.id === me.id;
    g.lineWidth = Math.max(2, r * 0.12);
    g.strokeStyle = c.lato === 'gruppo' ? (mioPg ? '#f0c040' : '#5aa8ff') : '#d8392a';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    if (!morto && c.pfMax) {
      const q = Math.max(0, Math.min(1, c.pf / c.pfMax));
      g.lineWidth = Math.max(3, r * 0.16); g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(x, y, r + g.lineWidth * 0.9, 0, 7); g.stroke();
      g.strokeStyle = q > 0.6 ? '#4ccf62' : q > 0.3 ? '#e8b030' : '#e8402a';
      g.beginPath(); g.arc(x, y, r + g.lineWidth * 0.9, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); g.stroke();
      if (c.pfTemp) { g.strokeStyle = '#7ad0ff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + g.lineWidth * 3.2, -Math.PI / 2, -Math.PI / 2 + Math.min(1, c.pfTemp / c.pfMax) * Math.PI * 2); g.stroke(); }
    }
    if (attivo) { g.strokeStyle = '#ffd860'; g.lineWidth = 2.5; g.setLineDash([5, 4]); g.lineDashOffset = -t / 30; g.beginPath(); g.arc(x, y, r + 9, 0, 7); g.stroke(); g.setLineDash([]); }
    // morti, caduti, condizioni
    if (morto) { g.globalAlpha = 1; g.strokeStyle = '#c02020'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.6); g.lineTo(x + r * 0.6, y + r * 0.6); g.moveTo(x + r * 0.6, y - r * 0.6); g.lineTo(x - r * 0.6, y + r * 0.6); g.stroke(); }
    if (aTerra && c.morte) { for (let i = 0; i < 3; i++) { g.fillStyle = i < c.morte.successi ? '#4ccf62' : '#333'; g.beginPath(); g.arc(x - 12 + i * 6, y + r + 9, 2.6, 0, 7); g.fill(); g.fillStyle = i < c.morte.fallimenti ? '#e8402a' : '#333'; g.beginPath(); g.arc(x + 2 + i * 6, y + r + 9, 2.6, 0, 7); g.fill(); } if (c.stabile) scritta(g, 'stabile', x, y + r + 20, 9, '#9fd'); }
    const icone = [...c.condizioni.map((k) => ICONE_COND[k]).filter(Boolean), ...c.effetti.map((k) => ICONE_EFF[k]).filter(Boolean)].slice(0, 4);
    if (icone.length && !morto) { g.font = `${Math.max(9, r * 0.5)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; icone.forEach((ic, i) => g.fillText(ic, x - (icone.length - 1) * r * 0.3 + i * r * 0.6, y - r - 5)); }
    if (c.conc && !morto) { g.fillStyle = '#b080ff'; g.beginPath(); g.moveTo(x + r * 0.75, y - r * 0.95); g.lineTo(x + r * 1.0, y - r * 0.7); g.lineTo(x + r * 0.75, y - r * 0.45); g.lineTo(x + r * 0.5, y - r * 0.7); g.fill(); }
    g.restore();
  }
  function aggiornaTip(F, cel) {
    const cb = cbDi(F.ctx); if (!cb) return;
    const c = cb.creature.find((x) => x.x === cel.x && x.y === cel.y && !x.fuggito && vivo(x)) || cb.creature.find((x) => x.x === cel.x && x.y === cel.y && !x.fuggito);
    if (!c) { F.tip.hidden = true; return; }
    const me = io(F.ctx);
    const stato = c.morto ? 'morto' : c.pf <= 0 ? (c.pg ? (c.stabile ? 'a terra, stabile' : 'a terra, morente') : 'a terra') : `${c.pf}/${c.pfMax} PF${c.pfTemp ? ` (+${c.pfTemp})` : ''}`;
    const d = me && c !== me ? ` · ${fmt(dist(me, c))}${M().vede(cb.scena, me.x, me.y, c.x, c.y) ? '' : ' · non visibile'}` : '';
    F.tip.innerHTML = `<b>${esc(c.nome)}</b><span>${stato} · CA ${c.ca}${d}</span>${c.condizioni.length || c.effetti.length ? `<small>${esc([...c.condizioni, ...c.effetti].join(', '))}</small>` : ''}`;
    F.tip.hidden = false;
    const s = st(F.ctx), k = s.cam.k;
    const x = s.cam.ox + (c.x + 0.5) * C * k, y = s.cam.oy + c.y * C * k;
    F.tip.style.left = `${Math.max(8, Math.min(F.W - 190, x - 90))}px`; F.tip.style.top = `${Math.max(4, y - 64)}px`;
  }

  // ---------- html: la fila dell'iniziativa e il pannello del turno ----------
  function miniPedina(ctx, c, cb) {
    const pg = c.pg ? pgDi(ctx, c.id) : null;
    const dentro = pg ? A().ritratto(pg, { cornice: false }) : `<span class="dr-mini-emoji" style="background:${(c.aspetto && c.aspetto.col) || '#8a3a3a'}">${(c.aspetto && c.aspetto.s) || '👾'}</span>`;
    const q = c.pfMax ? Math.max(0, c.pf / c.pfMax) : 0;
    return `<span class="dr-ini ${c.lato} ${c.id === cb.attivo ? 'attivo' : ''} ${c.pf <= 0 ? 'giu' : ''} ${c.id === ctx.partita.mioId ? 'mio' : ''}" title="${esc(c.nome)} · iniziativa ${c.iniziativa}">${dentro}<i style="--q:${q}"></i><small>${c.iniziativa}</small></span>`;
  }
  function filaIniziativa(ctx) {
    const cb = cbDi(ctx); if (!cb) return '';
    const att = cb.creature.find((c) => c.id === cb.attivo);
    return `<div class="dr-iniziativa"><span class="dr-round">Round <b>${cb.round}</b></span><div class="dr-ini-fila">${cb.ordine.map((id) => cb.creature.find((c) => c.id === id)).filter(Boolean).map((c) => miniPedina(ctx, c, cb)).join('')}</div>
      <span class="dr-tocca ${mioTurno(ctx) ? 'mio' : ''}">${cb.finito ? (cb.finito === 'vittoria' ? '🏆 Vittoria!' : '💀 Sconfitta') : mioTurno(ctx) && mano(ctx) ? `🎩 Muovi ${esc(mano(ctx).nome)}` : mioTurno(ctx) ? '⚔️ Tocca a te!' : att ? `Tocca a ${esc(att.nome)}` : ''}</span></div>`;
  }
  const LISTA_AZ = [
    ['scatto', '🏃', 'Scatto', 'Raddoppia il movimento'], ['disimpegno', '🌀', 'Disimpegno', 'Ti allontani senza attacchi di opportunità'], ['schivata', '🛡️', 'Schivata', 'Chi ti attacca ha svantaggio'],
    ['nascondersi', '👤', 'Nascondersi', 'Prova di Furtività'], ['aiuto', '🤝', 'Aiuto', 'Un alleato ha vantaggio contro un nemico vicino', 'nemico'], ['pozione', '🧪', 'Pozione', 'Pozione di guarigione (2d4+2): a te o a un alleato vicino', 'alleato'],
    ['stabilizza', '⚕️', 'Stabilizza', 'Un alleato morente vicino (Medicina CD 10)', 'alleato'],
  ];
  const AZ_CLASSE = [
    ['ira', 'ira', '😡', 'Ira', 'Bonus: +danni, resistenza ai colpi', 'bonus'], ['irruento', 'irruento', '💢', 'Attacco irruento', 'Vantaggio ai tuoi attacchi, ma anche a quelli contro di te'],
    ['recupero', 'recupero', '❤️‍🩹', 'Recuperare energie', 'Bonus: 1d10 + livello PF', 'bonus'], ['impeto', 'impeto', '⚡', 'Azione impetuosa', 'Un\'azione in più'],
    ['artiMarziali', 'colpoMarziale', '👊', 'Colpo senz\'armi', 'Bonus dopo l\'attacco', 'bonus', 'nemico'], ['ki', 'raffica', '🌪️', 'Raffica di colpi', '1 ki: due colpi bonus', 'bonus', 'nemico'],
    ['stordente', 'stordente', '💫', 'Colpo stordente', '1 ki: Costituzione o stordito', null, 'nemico'], ['imposizione', 'imposizione', '🙌', 'Imposizione delle mani', 'Cura con la riserva', null, 'alleato'],
    ['ispirazione', 'ispirazione', '🎵', 'Ispirazione bardica', 'Bonus: un dado in più a un alleato', 'bonus', 'alleato', 18], ['scacciare', 'scacciare', '☀️', 'Scacciare non morti', 'Incanalare divinità'],
    ['preservare', 'preservare', '💖', 'Preservare la vita', 'Incanalare divinità: cura il gruppo'], ['soffio', 'soffio', '🐉', 'Soffio', 'Azione: soffio del drago', null, 'direzione'],
  ];
  function pannello(ctx) {
    const p = ctx.partita, cb = cbDi(ctx); if (!cb) return '';
    const s = st(ctx), me = io(ctx), pg = me ? pgDi(ctx, me.id) : null;
    const log = cb.eventi.filter((e) => e.testo && e.tipo !== 'turno').slice(-14).reverse().map((e) => `<li class="dr-ev-${e.tipo} ${e.colpito ? 'colpito' : ''} ${e.critico ? 'critico' : ''}">${esc(e.testo)}</li>`).join('');
    const registro = `<div class="dr-cb-log"><h4>Cronaca della battaglia</h4><ul>${log}</ul></div>`;
    if (mano(ctx) && me && mioTurno(ctx)) return pannelloMano(ctx, me, mano(ctx), registro);
    if (!me || !pg) return `<div class="dr-cb-pannello"><p class="dr-cb-attesa">Guardi la battaglia.</p>${registro}</div>`;
    if (!mioTurno(ctx)) {
      const att = cb.creature.find((c) => c.id === cb.attivo);
      const giu = me.pf <= 0 && !me.morto ? `<p class="dr-cb-giu">Sei a terra! ${me.stabile ? 'Sei stabile.' : `Tiri contro la morte: ${me.morte.successi} ✔ ${me.morte.fallimenti} ✖`}</p>` : '';
      return `<div class="dr-cb-pannello"><p class="dr-cb-attesa">${cb.finito ? 'Il combattimento è finito.' : `⏳ Tocca a <b>${esc(att ? att.nome : '…')}</b>${att && att.lato === 'nemici' ? ' (il master muove i nemici)' : ''}`}</p>${giu}${registro}</div>`;
    }
    const t = me.turno || {};
    const pallino = (ok, n) => `<span class="dr-risorsa ${ok ? 'ok' : ''}"><i></i>${n}</span>`;
    const attOk = t.azione || (t.attacchi > 0 && t.attacchi < t.attacchiMax);
    const risorse = `<div class="dr-cb-risorse">${pallino(t.azione, 'Azione')}${pallino(t.bonus, 'Bonus')}${pallino(me.reazione, 'Reazione')}<span class="dr-risorsa mov"><b>${fmt(t.movimento || 0)}</b> movimento</span>${t.attacchiMax > 1 ? `<span class="dr-risorsa">attacchi ${t.attacchi}/${t.attacchiMax}</span>` : ''}</div>`;
    const selArma = s.sel && s.sel.tipo === 'arma' ? s.sel.id : undefined;
    const armi = pg.attacchi.filter((a) => a.id !== 'colpo' || pg.attacchi.length < 3 || pg.capacita.includes('artiMarziali')).map((a) => `<button type="button" class="dr-cb-arma ${selArma === a.id ? 'sel' : ''}" data-az="dr-cb-arma" data-id="${esc(a.id)}" ${attOk ? '' : 'disabled'}>
      <b>${a.mischia ? (a.gittata ? '🗡️' : '⚔️') : '🏹'} ${esc(a.nome)}</b><small>${a.colpire >= 0 ? '+' : ''}${a.colpire} · ${esc(a.danno)} ${esc(a.tipo)}${a.gittata ? ` · ${a.gittata[0]}/${a.gittata[1]} m` : a.portata > CELLA ? ' · portata 3 m' : ''}</small></button>`).join('');
    // punizione divina
    let extraArmi = '';
    if (pg.capacita.includes('punizione') && pg.magia) { const liv = pg.magia.slot.map((n, i) => (n > (pg.magia.slotUsati[i] || 0) ? i + 1 : 0)).filter(Boolean).slice(0, 4); if (liv.length) extraArmi += `<div class="dr-cb-opz"><span>✨ Punizione divina:</span>${['no', ...liv].map((l) => `<button type="button" class="dr-chip ${(s.punizione || 'no') === l ? 'sel' : ''}" data-az="dr-cb-pun" data-id="${l}">${l === 'no' ? 'no' : `slot ${l}°`}</button>`).join('')}</div>`; }
    const versatile = pg.attacchi.find((a) => a.versatile && (!selArma || a.id === selArma));
    if (versatile && !pg.scudo) extraArmi += `<div class="dr-cb-opz"><button type="button" class="dr-chip ${s.dueMani ? 'sel' : ''}" data-az="dr-cb-duemani">🤲 A due mani (${esc(versatile.versatile)})</button></div>`;
    // incantesimi
    let magie = '';
    if (pg.magia && (pg.magia.trucchetti.length || pg.magia.incantesimi.length || pg.magia.sempre.length)) {
      const ira = me.effetti.includes('Ira');
      const slotLib = (l) => pg.magia.slot[l - 1] > (pg.magia.slotUsati[l - 1] || 0);
      const ids = [...new Set([...pg.magia.trucchetti, ...pg.magia.incantesimi, ...pg.magia.sempre])].filter((id) => p.incantesimi[id]).sort((a, b) => p.incantesimi[a].liv - p.incantesimi[b].liv);
      const slot = pg.magia.slot.length ? `<div class="dr-slot">${pg.magia.slot.map((n, i) => `<span title="Slot di ${i + 1}° livello"><small>${i + 1}°</small>${Array.from({ length: n }, (_, k) => `<i class="${k < n - (pg.magia.slotUsati[i] || 0) ? 'on' : ''}"></i>`).join('')}</span>`).join('')}</div>` : '';
      magie = `<div class="dr-cb-sez"><h4>✨ Incantesimi <small>CD ${pg.magia.cd} · attacco +${pg.magia.attacco}</small></h4>${slot}<div class="dr-cb-incs">${ids.map((id) => {
        const inf = p.incantesimi[id], bonus = inf.tempo === 'bonus', reazione = inf.tempo === 'reazione';
        const slotOk = inf.liv === 0 || pg.magia.slot.some((n, i) => i + 1 >= inf.liv && n > (pg.magia.slotUsati[i] || 0));
        const ok = !ira && !reazione && slotOk && (bonus ? t.bonus : t.azione);
        const seli = s.sel && s.sel.tipo === 'inc' && s.sel.id === id;
        return `<button type="button" class="dr-cb-inc ${seli ? 'sel' : ''} ${inf.liv ? '' : 'trucco'}" data-az="dr-cb-inc" data-id="${id}" ${ok ? '' : 'disabled'} title="${esc(`${inf.nome} (${inf.liv ? `${inf.liv}°` : 'trucchetto'}, ${inf.tempo}, ${inf.gittata}${/^\d+$/.test(String(inf.gittata)) ? ' m' : ''}): ${inf.desc}`)}">
          <b>${inf.liv ? `<i>${inf.liv}</i>` : ''}${esc(inf.nome)}</b><small>${bonus ? 'bonus · ' : reazione ? 'reazione · ' : ''}${inf.area ? `${inf.area.forma} ${inf.area.m} m` : inf.gittata === 'se' ? 'su di te' : inf.gittata === 'tocco' ? 'tocco' : `${inf.gittata} m`}${inf.conc ? ' · C' : ''}</small></button>`;
      }).join('')}</div>${s.sel && s.sel.tipo === 'inc' ? dettaglioInc(ctx, pg, slotLib) : ''}</div>`;
    }
    // azioni e privilegi
    const azioni = LISTA_AZ.filter(([az]) => az !== 'pozione' || pg.oggetti.some((o) => /pozione di guarigione/i.test(o.nome) && o.n > 0)).map(([az, ic, n, d, chi]) => {
      const scaltra = pg.capacita.includes('scaltra') && ['scatto', 'disimpegno', 'nascondersi'].includes(az);
      const ok = t.azione || (scaltra && t.bonus);
      const sl = s.sel && s.sel.tipo === 'az' && s.sel.az === az;
      return `<button type="button" class="dr-cb-az ${sl ? 'sel' : ''}" data-az="dr-cb-az" data-id="${az}" ${chi ? `data-chi="${chi}"` : ''} ${scaltra && !t.azione ? 'data-bonus="1"' : ''} ${ok ? '' : 'disabled'} title="${esc(d)}"><span>${ic}</span>${n}${scaltra && !t.azione ? ' <small>(bonus)</small>' : ''}</button>`;
    }).join('');
    const classe = AZ_CLASSE.filter(([cap]) => pg.capacita.includes(cap) || (cap === 'soffio' && pg.stirpe === 'dragonide')).map(([cap, az, ic, n, d, tipo, chi, portata]) => {
      const ris = { ira: 'ira', recupero: 'recupero', impeto: 'impeto', raffica: 'ki', stordente: 'ki', ispirazione: 'ispirazione', scacciare: 'divinita', preservare: 'divinita', soffio: 'soffio', imposizione: 'mani' }[az];
      const r = ris ? pg.risorse[ris] : null, resto = r ? r.max - r.usati : null;
      if (ris && !r) return '';
      let ok = tipo === 'bonus' ? t.bonus : ['impeto', 'irruento', 'stordente'].includes(az) ? true : t.azione;
      if (resto != null && resto <= 0) ok = false;
      if (az === 'ira' && me.effetti.includes('Ira')) ok = false;
      if ((az === 'colpoMarziale' || az === 'raffica') && !(t.attacchi > 0)) ok = false;
      const sl = s.sel && s.sel.tipo === 'az' && s.sel.az === az;
      return `<button type="button" class="dr-cb-az classe ${sl ? 'sel' : ''}" data-az="dr-cb-az" data-id="${az}" ${chi ? `data-chi="${chi}"` : ''} ${portata ? `data-portata="${portata}"` : ''} ${ok ? '' : 'disabled'} title="${esc(d)}"><span>${ic}</span>${n}${resto != null ? ` <small>${r.punti ? `${resto} PF` : `×${resto}`}</small>` : ''}</button>`;
    }).join('');
    const guida = s.sel ? `<p class="dr-cb-guida">${guidaSel(ctx, s.sel)} <button type="button" class="dr-link" data-az="dr-cb-annulla">annulla</button></p>`
      : `<p class="dr-cb-guida">🚶 Tocca una casella azzurra per muoverti, un nemico per attaccarlo con ${attOk ? 'l\'arma migliore' : '…(azione già usata)'}.</p>`;
    return `<div class="dr-cb-pannello mio">${risorse}${guida}
      <div class="dr-cb-sez"><h4>⚔️ Attacchi</h4><div class="dr-cb-armi">${armi}</div>${extraArmi}</div>
      ${magie}
      <div class="dr-cb-sez"><h4>🎲 Azioni</h4><div class="dr-cb-azioni">${azioni}${classe}</div></div>
      ${cb.horror && window.DraghiIncubo ? window.DraghiIncubo.azioniCombattimento(ctx, pg, me, t, s) : ''}
      <div class="dr-cb-sez"><h4>✍️ Azione libera <small>qualsiasi cosa ti venga in mente: decide il master</small></h4><div class="dr-cb-libera"><textarea data-tieni="libera" rows="2" maxlength="600" placeholder="Es.: rovescio il braciere addosso al goblin, poi gli urlo di arrendersi…">${esc(ctx.ui.t_libera || '')}</textarea><button type="button" class="dr-bt dr-bt-oro" data-az="dr-cb-libera" aria-label="Fallo" ${t.azione && !p.attesaLibera ? '' : 'disabled'}>➤</button></div>${p.attesaLibera ? '<small class="dr-nota">🪶 Il master sta decidendo cosa succede…</small>' : !t.azione ? '<small class="dr-nota">Serve l\'azione: l\'hai già usata in questo turno.</small>' : ''}</div>
      <div class="dr-cb-fine"><button type="button" class="dr-bt" data-az="dr-cb-auto" title="Il computer gioca questo turno per te">🤖 Gioca per me</button><button type="button" class="dr-bt dr-bt-oro" data-az="dr-cb-fine">Fine turno ⏭</button></div>
      ${registro}</div>`;
  }
  // il pannello del master al turno di un nemico: i suoi attacchi, il soffio, le azioni semplici, fine turno
  function pannelloMano(ctx, me, m, registro) {
    const s = st(ctx), t = me.turno || {};
    const pallino = (ok, n) => `<span class="dr-risorsa ${ok ? 'ok' : ''}"><i></i>${n}</span>`;
    const attOk = t.azione || (t.attacchi > 0 && t.attacchi < t.attacchiMax);
    const risorse = `<div class="dr-cb-risorse">${pallino(t.azione, 'Azione')}${pallino(me.reazione, 'Reazione')}<span class="dr-risorsa mov"><b>${fmt(t.movimento || 0)}</b> movimento</span>${t.attacchiMax > 1 ? `<span class="dr-risorsa">attacchi ${t.attacchi}/${t.attacchiMax}</span>` : ''}</div>`;
    const selArma = s.sel && s.sel.tipo === 'arma' ? s.sel.id : undefined;
    const armi = m.attacchi.map((a) => `<button type="button" class="dr-cb-arma ${selArma === a.id ? 'sel' : ''}" data-az="dr-cb-arma" data-id="${esc(a.id)}" ${attOk ? '' : 'disabled'}>
      <b>${a.mischia ? '⚔️' : '🏹'} ${esc(a.nome)}</b><small>${a.colpire >= 0 ? '+' : ''}${a.colpire} · ${esc(a.danno)} ${esc(a.tipo || '')}${a.gittata ? ` · ${a.gittata[0]}/${a.gittata[1]} m` : a.portata > CELLA ? ` · portata ${fmt(a.portata)}` : ''}</small></button>`).join('');
    const sl = (az) => (s.sel && s.sel.tipo === 'az' && s.sel.az === az ? 'sel' : '');
    const soffio = m.soffio ? `<button type="button" class="dr-cb-az classe ${sl('soffio')}" data-az="dr-cb-az" data-id="soffio" data-chi="direzione" ${m.soffio.pronto && t.azione ? '' : 'disabled'} title="${esc(`${m.soffio.forma} di ${m.soffio.m} m, ${m.soffio.danno} ${m.soffio.tipo}`)}"><span>🐉</span>Soffio <small>${m.soffio.pronto ? `${esc(m.soffio.danno)} ${esc(m.soffio.tipo)}` : 'si ricarica'}</small></button>` : '';
    const azioni = LISTA_AZ.slice(0, 3).map(([az, ic, n, d]) => `<button type="button" class="dr-cb-az" data-az="dr-cb-az" data-id="${az}" ${t.azione ? '' : 'disabled'} title="${esc(d)}"><span>${ic}</span>${n}</button>`).join('');
    const guida = s.sel ? `<p class="dr-cb-guida">${guidaSel(ctx, s.sel)} <button type="button" class="dr-link" data-az="dr-cb-annulla">annulla</button></p>`
      : `<p class="dr-cb-guida">🎩 Muovi tu <b>${esc(m.nome)}</b>: tocca una casella azzurra per spostarlo, un personaggio per attaccarlo${attOk ? '' : ' (azione già usata)'}.</p>`;
    const sec = Math.ceil((m.attesa || 0) / 1000);
    return `<div class="dr-cb-pannello mio">${risorse}${guida}
      <div class="dr-cb-sez"><h4>⚔️ Attacchi di ${esc(m.nome)}</h4><div class="dr-cb-armi">${armi}</div></div>
      <div class="dr-cb-sez"><h4>🎲 Azioni</h4><div class="dr-cb-azioni">${soffio}${azioni}</div>${m.incantesimi ? '<small class="dr-nota">Gli incantesimi dei mostri li lancia il gioco: usa «🤖 Lo fa il gioco».</small>' : ''}</div>
      <div class="dr-cb-fine"><button type="button" class="dr-bt" data-az="dr-cb-auto" title="Il gioco fa questo turno del nemico con le sue regole">🤖 Lo fa il gioco</button><button type="button" class="dr-bt dr-bt-oro" data-az="dr-cb-fine">Fine turno ⏭</button></div>
      ${sec < 60 ? `<small class="dr-nota">⏳ Se non fai niente, tra ${sec} secondi lo muove il gioco.</small>` : ''}
      ${registro}</div>`;
  }
  function guidaSel(ctx, sel) {
    const come = comeBersaglio(ctx, sel);
    if (sel.tipo === 'arma') return '🎯 Tocca il nemico da attaccare.';
    if (sel.tipo === 'inc') {
      const inf = ctx.partita.incantesimi[sel.id], max = Math.max(1, inf.bersagli || 1);
      if (come === 'punto') return `🎯 Tocca dove lanciare <b>${esc(inf.nome)}</b> (entro ${fmt(gittataInc(inf))}).`;
      if (come === 'direzione') return `🧭 Tocca la direzione in cui lanciare <b>${esc(inf.nome)}</b>.`;
      if (come === 'nemico' || come === 'alleato') return `🎯 Tocca ${come === 'nemico' ? 'il nemico' : 'l\'alleato (anche te stesso)'}${max > 1 ? ` — fino a ${max} bersagli (${sel.bersagli.length} scelti)` : ''}.`;
      return `Pronto a lanciare <b>${esc(inf.nome)}</b>.`;
    }
    if (sel.tipo === 'az') return come === 'punto' ? '🎯 Tocca il punto dove lanciarlo (al massimo 12 metri).' : come === 'direzione' ? '🧭 Tocca la direzione del soffio.' : come === 'alleato' ? '🎯 Tocca l\'alleato (o te stesso).' : '🎯 Tocca il nemico.';
    return '';
  }
  function dettaglioInc(ctx, pg, slotLib) {
    const s = st(ctx), sel = s.sel, inf = ctx.partita.incantesimi[sel.id], come = comeBersaglio(ctx, sel);
    let slot = '';
    if (inf.liv > 0 && pg.classe !== 'warlock') {
      const liv = []; for (let l = inf.liv; l <= pg.magia.slot.length; l++) if (slotLib(l)) liv.push(l);
      slot = `<div class="dr-cb-opz"><span>Slot:</span>${liv.map((l) => `<button type="button" class="dr-chip ${(sel.slot || liv[0]) === l ? 'sel' : ''}" data-az="dr-cb-slot" data-id="${l}">${l}°${l > inf.liv ? ' ↑' : ''}</button>`).join('')}</div>`;
    }
    const conc = inf.conc && pg.concentrazione ? `<p class="dr-nota">⚠️ Interrompe la concentrazione su ${esc((ctx.partita.incantesimi[pg.concentrazione] || { nome: pg.concentrazione }).nome)}.</p>` : '';
    const subito = !come || (sel.bersagli.length && (come === 'nemico' || come === 'alleato'));
    return `<div class="dr-cb-det"><p><b>${esc(inf.nome)}</b> — ${esc(inf.desc)}</p>${slot}${conc}${subito ? `<button type="button" class="dr-bt dr-bt-oro" data-az="dr-cb-lancia">✨ Lancia${sel.bersagli.length ? ` su ${sel.bersagli.length}` : ''}</button>` : ''}</div>`;
  }

  function clic(ctx, el) {
    const az = el.dataset.az, id = el.dataset.id, s = st(ctx);
    switch (az) {
      case 'dr-cb-arma': s.sel = s.sel && s.sel.tipo === 'arma' && s.sel.id === id ? null : { tipo: 'arma', id }; return ctx.ridisegna();
      case 'dr-cb-pun': s.punizione = id === 'no' ? null : Number(id); return ctx.ridisegna();
      case 'dr-cb-duemani': s.dueMani = !s.dueMani; return ctx.ridisegna();
      case 'dr-cb-inc': {
        if (s.sel && s.sel.tipo === 'inc' && s.sel.id === id) { s.sel = null; return ctx.ridisegna(); }
        const pg = pgDi(ctx, ctx.partita.mioId), inf = ctx.partita.incantesimi[id];
        let slot = null; if (inf.liv > 0 && pg) for (let l = inf.liv; l <= pg.magia.slot.length; l++) if (pg.magia.slot[l - 1] > (pg.magia.slotUsati[l - 1] || 0)) { slot = l; break; }
        s.sel = { tipo: 'inc', id, slot, bersagli: [] };
        suono([[660, 0.03]], { tipo: 'sine', volume: 0.03 });
        return ctx.ridisegna();
      }
      case 'dr-cb-slot': if (s.sel) s.sel.slot = Number(id); return ctx.ridisegna();
      case 'dr-cb-lancia': if (s.sel && s.sel.tipo === 'inc') return lancia(ctx, s.sel, {}); return undefined;
      case 'dr-cb-annulla': s.sel = null; return ctx.ridisegna();
      case 'dr-cb-az': {
        const chi = el.dataset.chi;
        const extra = el.dataset.ogg ? { oggetto: el.dataset.ogg } : null;
        if (!chi) return azione(ctx, { az: id, ...(el.dataset.bonus ? { bonus: true } : {}), ...(extra || {}) });
        if (s.sel && s.sel.tipo === 'az' && s.sel.az === id && (!extra || (s.sel.extra && s.sel.extra.oggetto === extra.oggetto))) { s.sel = null; return ctx.ridisegna(); }
        const pg = pgDi(ctx, ctx.partita.mioId);
        const area = id === 'soffio' && pg && pg.soffio ? { forma: pg.soffio.forma, m: pg.soffio.m } : id === 'soffio' && pg ? (['rosso', 'oro', 'verde', 'bianco', 'argento'].includes(pg.discendenza) ? { forma: 'cono', m: 4.5 } : { forma: 'linea', m: 9 }) : null;
        s.sel = { tipo: 'az', az: id, chi, portata: Number(el.dataset.portata) || CELLA, area, extra };
        return ctx.ridisegna();
      }
      case 'dr-cb-libera': {
        const testo = String(ctx.ui.t_libera || '').trim();
        if (!testo) return ctx.avviso('Scrivi cosa vuoi fare');
        ctx.ui.t_libera = ''; ctx.ui.fuoco = null; s.sel = null;
        suono([[440, 0.05], [660, 0.07]], { tipo: 'sine', volume: 0.03 });
        return ctx.invia({ tipo: 'libera', testo });
      }
      case 'dr-cb-fine': s.sel = null; suono([[392, 0.05], [330, 0.06]], { tipo: 'triangle', volume: 0.03 }); return manda(ctx, { tipo: 'fine' });
      case 'dr-cb-auto': s.sel = null; return manda(ctx, { tipo: 'autoTurno' });
      case 'dr-cb-sposta': s.sel = null; s.sposta = s.sposta ? null : { id: null }; return ctx.ridisegna();
      default: return undefined;
    }
  }
  // dopo ogni ridisegno: si rimette il canvas al suo posto e si leggono gli eventi nuovi
  function dopo(ctx) {
    const posto = document.getElementById('dr-campo-posto');
    if (!posto || !cbDi(ctx)) return;
    const F = campo(ctx); F.ctx = ctx;
    if (F.wrap.parentNode !== posto) { posto.append(F.wrap); misura(F); }
    eventi(ctx);
    const s = st(ctx);
    if (s.sel && !mioTurno(ctx)) s.sel = null;
  }

  const spostando = (ctx) => !!st(ctx).sposta;
  window.DraghiCampo = { filaIniziativa, pannello, clic, dopo, mioTurno, spostando };
})();
