// ALLEGRO CHIRURGO: il percorso su canvas. Il controllo dei bordi si fa qui, al volo, su ogni tratto del movimento
// (anche i movimenti veloci vengono controllati punto per punto); il server riceve la posizione e ricontrolla.
(() => {
  const { esc, suono } = window.Nuovi;
  const COLORI = ['#e8453c', '#2f7fd8', '#2e9d57', '#d19a2a', '#8e55c9', '#e36fa5', '#1fa3a3', '#e07b2c'];
  let ctxA = null, tela = null, ultimo = null;
  let perc = null, percChiave = null; // percorso con le lunghezze, per calcolare l'avanzamento
  const io = { corre: false, pos: null, prog: 0, tocchi: 0, flash: 0, invio: 0, arrivato: false };

  const attiva = () => ctxA && ctxA.stato && ctxA.partita && ctxA.partita.gioco === 'chirurgo';
  const larghezza = (p, t) => (p.pulsa ? p.w * (0.78 + 0.22 * Math.sin(t / 420)) : p.w);

  function prepara(p) {
    const chiave = p.percorso ? `${p.percorso.length}-${p.percorso[0]}-${p.percorso[p.percorso.length - 1]}` : null;
    if (chiave === percChiave) return;
    percChiave = chiave;
    if (!p.percorso) { perc = null; return; }
    const lung = [0];
    for (let i = 1; i < p.percorso.length; i++) lung.push(lung[i - 1] + Math.hypot(p.percorso[i][0] - p.percorso[i - 1][0], p.percorso[i][1] - p.percorso[i - 1][1]));
    perc = { pts: p.percorso, lung, totale: lung[lung.length - 1] };
    Object.assign(io, { corre: false, pos: null, prog: 0, arrivato: false });
  }
  // si cerca solo intorno all'ultimo punto raggiunto: dove due giri del percorso passano vicini non si salta sull'altro
  function vicino(x, y, da = null, finestra = 70) {
    let best = Infinity, bi = 0, bt = 0;
    const q = perc.pts;
    const i0 = da === null ? 0 : Math.max(0, da - finestra), i1 = da === null ? q.length - 1 : Math.min(q.length - 1, da + finestra);
    for (let i = i0; i < i1; i++) {
      const ax = q[i][0], ay = q[i][1], dx = q[i + 1][0] - ax, dy = q[i + 1][1] - ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
      if (d < best) { best = d; bi = i; bt = t; }
    }
    return { d: best, prog: (perc.lung[bi] + bt * (perc.lung[bi + 1] - perc.lung[bi])) / perc.totale, idx: bi };
  }

  function disegna() {
    if (!attiva() || !tela || !tela.isConnected) return;
    const ctx = ctxA, p = ctx.partita, t = ultimo || p.stato;
    const box = tela.parentElement;
    // l'altezza libera sotto la barra (con un numero fisso sul telefono in orizzontale il campo restava piccolo)
    const sopra = Math.max(0, box.getBoundingClientRect().top + (window.scrollY || 0));
    const scala = Math.min(box.clientWidth / p.W, (window.Arena.touch() ? Math.max(180, window.innerHeight - sopra - 20) : Math.max(200, window.innerHeight - 262)) / p.H);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(p.W * scala), h = Math.round(p.H * scala);
    if (tela.width !== Math.round(w * dpr)) { tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr); tela.style.width = `${w}px`; tela.style.height = `${h}px`; }
    const g = tela.getContext('2d');
    g.setTransform(dpr * scala, 0, 0, dpr * scala, 0, 0);
    // la tavola: un pannello scuro con i rivetti
    g.fillStyle = '#1d2b36'; g.fillRect(0, 0, p.W, p.H);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 20; y < p.H; y += 40) for (let x = 20; x < p.W; x += 40) { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
    const ora = Date.now();
    if (perc) {
      const lw = larghezza(p, ora);
      const traccia = () => { g.beginPath(); perc.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      // bordi di metallo e corridoio chiaro
      traccia(); g.strokeStyle = io.flash && ora - io.flash < 350 ? '#ff5a4f' : '#9fb3c8'; g.lineWidth = lw + 12; g.stroke();
      traccia(); g.strokeStyle = '#3c4d5e'; g.lineWidth = lw + 4; g.stroke();
      traccia(); g.strokeStyle = '#f3ead2'; g.lineWidth = lw; g.stroke();
      // la parte già fatta da me
      if (io.corre || io.arrivato) {
        const fin = io.prog * perc.totale;
        g.beginPath(); let fatto = false;
        for (let i = 0; i < perc.pts.length && perc.lung[i] <= fin; i++) { const [x, y] = perc.pts[i]; if (i) g.lineTo(x, y); else g.moveTo(x, y); fatto = true; }
        if (fatto) { g.strokeStyle = 'rgba(62,196,109,.45)'; g.lineWidth = Math.max(3, lw * 0.5); g.stroke(); }
      }
      // partenza e arrivo
      const [sx, sy] = perc.pts[0], [ex, ey] = perc.pts[perc.pts.length - 1];
      g.fillStyle = '#2e9d57'; g.beginPath(); g.arc(sx, sy, p.R, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = '700 16px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VIA', sx, sy);
      g.save(); g.beginPath(); g.arc(ex, ey, p.R, 0, Math.PI * 2); g.clip();
      for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(ex - p.R + i * 9, ey - p.R + j * 9, 9, 9); }
      g.restore();
      g.strokeStyle = '#d19a2a'; g.lineWidth = 3; g.beginPath(); g.arc(ex, ey, p.R, 0, Math.PI * 2); g.stroke();
    }
    // gli altri: pallini col nome
    if (t && t.g) t.g.forEach((x, i) => {
      if (i === ctx.mio || !x.pos || x.s === 'pronto') return;
      g.fillStyle = COLORI[i % COLORI.length]; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(x.pos[0], x.pos[1], 8, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.fillStyle = '#fff'; g.font = '600 14px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(ctx.nome(i).slice(0, 8), x.pos[0], x.pos[1] - 16);
    });
    // la mia punta: un piccolo bisturi rotondo
    if (io.pos && (io.corre || io.arrivato)) {
      g.fillStyle = '#fff'; g.strokeStyle = COLORI[ctx.mio % COLORI.length]; g.lineWidth = 3;
      g.beginPath(); g.arc(io.pos[0], io.pos[1], 5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // scritte sopra
    let scritta = '', piccola = '';
    if (t.pausa) scritta = '⏸ In pausa';
    else if (t.fase === 'via') { scritta = String(Math.ceil(t.via / 1000) || ''); piccola = 'Guarda bene il percorso…'; }
    else if (t.fase === 'corsa' && !io.corre && !io.arrivato && (!t.g || t.g[ctx.mio].s !== 'arrivato')) piccola = io.flash && ora - io.flash < 1500 ? 'BZZZ! Hai toccato: torna sulla partenza' : 'Premi sul cerchio VIA e trascina fino alla bandiera';
    else if (t.fase === 'pausa') { const mio = t.g[ctx.mio]; scritta = mio.t !== null ? `${(mio.t / 1000).toFixed(1)} s` : 'Tempo!'; piccola = 'Fine del round'; }
    if (scritta) { g.fillStyle = 'rgba(10,20,30,.55)'; g.fillRect(0, 0, p.W, p.H); g.fillStyle = '#fff'; g.font = '400 110px "Young Serif", Georgia, serif'; g.textAlign = 'center'; g.fillText(scritta, p.W / 2, p.H / 2); }
    if (piccola) { g.fillStyle = 'rgba(10,20,30,.7)'; g.fillRect(p.W / 2 - 330, 10, 660, 40); g.fillStyle = io.flash && ora - io.flash < 1500 ? '#ffb4ae' : '#fff'; g.font = '600 20px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(piccola, p.W / 2, 31); }
  }
  (function ciclo() { disegna(); aggiornaBarre(); requestAnimationFrame(ciclo); })();

  function aggiornaBarre() {
    if (!attiva() || !ultimo) return;
    const el = document.querySelector('.ch-barre');
    if (!el || !ultimo.g) return;
    const t = ultimo;
    const orologio = document.querySelector('.ch-tempo');
    const st = document.getElementById('stato-turno');
    const testo = tavolo.stato(ctxA);
    if (st && testo && st.textContent !== testo) st.textContent = testo;
    if (orologio) orologio.textContent = t.fase === 'corsa' ? `${(t.t / 1000).toFixed(1)} s${t.primo ? ` · ancora ${Math.ceil(t.resta / 1000)} s` : ''}` : '';
    const html = t.g.map((x, i) => {
      const prog = i === ctxA.mio && io.corre ? Math.max(io.prog, x.p) : x.p;
      return `<div class="ch-riga ${i === ctxA.mio ? 'mia' : ''}"><span>${esc(i === ctxA.mio ? 'Tu' : ctxA.nome(i))}</span><span class="tk-pista"><i style="width:${prog * 100}%;background:${COLORI[i % COLORI.length]}"></i></span><span>${x.t !== null ? `🏁 ${(x.t / 1000).toFixed(1)} s` : x.k ? `⚡${x.k}` : ''}</span></div>`;
    }).join('');
    if (el._html !== html) { el._html = html; el.innerHTML = html; }
  }

  // ---------- il mouse o il dito ----------
  function coord(e) {
    const p = ctxA.partita, r = tela.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * p.W, ((e.clientY - r.top) / r.height) * p.H];
  }
  function tocca(motivo) {
    if (!io.corre) return;
    io.corre = false; io.prog = 0; io.flash = Date.now(); io.tocchi++;
    ctxA.emetti('input', { t: 'tocca' });
    suono([[110, 0.25]], { tipo: 'sawtooth', volume: 0.12 });
    if (navigator.vibrate) navigator.vibrate(120);
    void motivo;
  }
  function puoGiocare() {
    const t = ultimo;
    return attiva() && perc && t && t.fase === 'corsa' && !t.pausa && t.g && t.g[ctxA.mio].s !== 'arrivato' && !ctxA.partita.finita;
  }
  function giu(e) {
    if (e.target !== tela || !puoGiocare()) return;
    e.preventDefault();
    const [x, y] = coord(e);
    const s = perc.pts[0];
    if (Math.hypot(x - s[0], y - s[1]) > ctxA.partita.R) return;
    try { tela.setPointerCapture(e.pointerId); } catch {}
    io.corre = true; io.pos = [x, y]; io.prog = 0; io.idx = 0; io.arrivato = false;
    ctxA.emetti('input', { t: 'via', x: Math.round(x), y: Math.round(y) });
    suono([[660, 0.05]], { volume: 0.05 });
  }
  function muovi(e) {
    if (!io.corre || !puoGiocare()) return;
    const p = ctxA.partita;
    const [x, y] = coord(e);
    const [x0, y0] = io.pos;
    const passi = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 2));
    const lw = larghezza(p, Date.now()) * (p.largo || 1);
    const inizio = perc.pts[0], meta = perc.pts[perc.pts.length - 1];
    for (let k = 1; k <= passi; k++) {
      const sx = x0 + ((x - x0) * k) / passi, sy = y0 + ((y - y0) * k) / passi;
      const v = vicino(sx, sy, io.idx);
      // dentro il cerchio del VIA o della bandiera si è al sicuro (i cerchi sono più larghi del corridoio)
      const salvo = Math.hypot(sx - inizio[0], sy - inizio[1]) <= p.R || (io.prog > 0.9 && Math.hypot(sx - meta[0], sy - meta[1]) <= p.R);
      if (v.d > lw / 2 && !salvo) return tocca('bordo');
      io.idx = v.idx;
      io.prog = Math.max(io.prog, v.prog);
    }
    io.pos = [x, y];
    const fine = perc.pts[perc.pts.length - 1];
    const arrivato = io.prog > 0.97 && Math.hypot(x - fine[0], y - fine[1]) <= p.R;
    const ora = performance.now();
    if (arrivato || ora - io.invio > 40) { io.invio = ora; ctxA.emetti('input', { t: 'pos', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }); }
    if (arrivato) { io.corre = false; io.arrivato = true; suono([[523, 0.1], [784, 0.1], [1046, 0.2]], { volume: 0.08 }); }
  }
  function su() { if (io.corre) tocca('lasciato'); }
  document.addEventListener('pointerdown', giu);
  document.addEventListener('pointermove', muovi);
  document.addEventListener('pointerup', su);
  document.addEventListener('pointercancel', su);
  window.addEventListener('blur', su);

  const tavolo = {
    libero: true,
    reset(ctx) {
      ctxA = ctx;
      const p = ctx.partita;
      if (!ultimo || ultimo.round !== p.stato.round) ultimo = p.stato;
      prepara(p);
      if (!tela) { tela = document.createElement('canvas'); tela.className = 'ch-tela'; tela.setAttribute('aria-label', 'Percorso da seguire senza toccare i bordi'); }
    },
    tick(ctx, d) {
      ctxA = ctx; 
      const prima = ultimo;
      ultimo = d;
      const mio = d.g && d.g[ctx.mio];
      // il server mi ha fermato (salto o bordo visto da lui): mi rimetto in partenza
      if (mio && io.corre && mio.s === 'pronto' && prima && prima.g && mio.k > prima.g[ctx.mio].k) { io.corre = false; io.prog = 0; io.flash = Date.now(); }
      if (d.fase !== 'corsa' && io.corre) io.corre = false;
      if (prima && prima.round !== d.round) Object.assign(io, { corre: false, prog: 0, arrivato: false, pos: null });
    },
    panno(ctx) {
      const p = ctx.partita;
      return `<div class="ch">
        <p class="pa-round">Percorso ${ultimo ? ultimo.round : 1} di ${p.nRound} · ${esc(p.nomeLivello)}${p.famiglia ? ` · ${{ serpentone: 'serpentone', labirinto: 'labirinto', spirale: 'spirale', zigzag: 'zig-zag' }[p.famiglia]}` : ''} <span class="ch-tempo"></span></p>
        <div class="ch-box"></div>
        <div class="ch-barre"></div>
      </div>`;
    },
    dopo() { const box = document.querySelector('.ch-box'); if (box && tela.parentElement !== box) box.append(tela); const b = document.querySelector('.ch-barre'); if (b) b._html = null; },
    stato(ctx) {
      const p = ctx.partita, t = ultimo;
      if (p.finita || !t) return null;
      if (t.pausa) return 'In pausa';
      return t.fase === 'via' ? 'Pronti…' : t.fase === 'corsa' ? (io.corre ? 'Mano ferma!' : 'Premi sul VIA') : 'Fine round';
    },
    punteggio(ctx) {
      const p = ctx.partita;
      if (p.n === 1) return `<span>Tempo totale <b>${(p.tempiTot[0] / 1000).toFixed(1)} s</b></span><span>Tocchi <b>${p.tocchiTot[0]}</b></span>`;
      return p.punti.map((x, i) => `<span style="color:${COLORI[i % COLORI.length]}">${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b></span>`).join('') + '<span class="obiettivo">punti</span>';
    },
    infoPosto(ctx, posto) { const p = ctx.partita; return `${p.punti[posto]} punti · ${p.tocchiTot[posto]} tocchi`; },
    clic() {},
  };
  Object.assign(window.Tavoli, { chirurgo: tavolo });
})();
