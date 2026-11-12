// CALCIO BALILLA: il tavolo visto dall'alto in verticale, panno verde con le righe, stecche cromate con le
// manopole, omini blu e rossi che ruotano quando si tira, pallina bianca. Chi gioca in alto vede il tavolo girato:
// la propria porta è sempre in basso.
// Fluidità: il tavolo (panno, righe, porte) si disegna una volta sola in un canvas a parte; le proprie stecche si
// muovono subito nel browser con le stesse regole del server (velocità massima, fine corsa) e si riallineano a quelle
// del server quando ci si ferma, così il comando non ha il ritardo della rete.
(() => {
  const { suono } = window.Nuovi;
  const COL = [{ maglia: '#2f6fd8', scuro: '#1d4a99', nome: 'blu' }, { maglia: '#e0402f', scuro: '#9c2516', nome: 'rossa' }];
  let colpi = [], visti = 0, sfondo = null, chiave = '', ctxC = null;
  // le mie stecche previste: s (spostamento), meta, ultimo comando
  const mie = new Map();
  let mouseX = null, mouseNuovo = false, tasti = 0, ultimoComando = 0, tiroLocale = 0, ultimoFotogramma = 0;

  function preparaSfondo(W, H, ex) {
    const k = 2, c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
    const g = c.getContext('2d'); g.scale(k, k);
    g.fillStyle = '#6b4325'; g.fillRect(0, 0, W, H);
    const pan = g.createLinearGradient(0, 0, W, 0); pan.addColorStop(0, '#2c8a43'); pan.addColorStop(0.5, '#35a050'); pan.addColorStop(1, '#2c8a43');
    g.fillStyle = pan; g.fillRect(6, 6, W - 12, H - 12);
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let y = 0; y < H; y += 100) g.fillRect(6, y, W - 12, 50);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3;
    g.strokeRect(14, 14, W - 28, H - 28);
    g.beginPath(); g.moveTo(14, H / 2); g.lineTo(W - 14, H / 2); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 70, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, H / 2, 4, 0, Math.PI * 2); g.fill();
    for (const y of [14, H - 14]) { const s = y < H / 2 ? 1 : -1; g.strokeRect(W / 2 - 150, y, 300, s * 110); g.strokeRect(W / 2 - 80, y, 160, s * 45); }
    for (const [y, sq] of [[0, 1], [H, 0]]) {
      g.fillStyle = '#1b1d22'; g.fillRect(W / 2 - ex.PORTA / 2, y === 0 ? -2 : H - 8, ex.PORTA, 10);
      g.fillStyle = COL[sq].maglia; g.fillRect(W / 2 - ex.PORTA / 2 - 8, y === 0 ? 0 : H - 8, 8, 8); g.fillRect(W / 2 + ex.PORTA / 2, y === 0 ? 0 : H - 8, 8, 8);
    }
    // le ombre delle stecche (fisse)
    g.fillStyle = 'rgba(0,0,0,.25)'; for (const a of ex.aste) g.fillRect(0, a.y + 3, W, 6);
    return c;
  }
  let metallo = null;
  function omino(g, x, y, col, dir, tiro, mio) {
    // tiro: 1 appena calciato → 0; i piedi vanno avanti (verso dir) e tornano
    const k = tiro > 0 ? Math.sin((1 - tiro) * Math.PI) : 0, gamba = dir * (10 + k * 14);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 4, y + 5, 15, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222'; g.fillRect(x - 7, y, 5, gamba); g.fillRect(x + 2, y, 5, gamba);
    g.fillStyle = '#111'; const py = y + gamba - (dir < 0 ? 4 : 0); g.fillRect(x - 8, py, 7, 4); g.fillRect(x + 1, py, 7, 4);
    g.fillStyle = col.maglia; g.beginPath(); g.ellipse(x, y, 15, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = col.scuro; g.fillRect(x - 15, y - 1.5, 30, 3);
    if (mio) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 16, 9, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#f2c79b'; g.beginPath(); g.arc(x, y - dir * 2, 6.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2416'; g.beginPath(); g.arc(x, y - dir * 4, 5.5, Math.PI, 0, dir > 0); g.fill();
  }
  // la stecca: dove mettere l'omino più adatto in x (come sul server)
  function spostaPer(a, s0, x) {
    let meglio = s0, dm = Infinity;
    for (const b of a.base) {
      const s = Math.max(a.min, Math.min(a.max, x - b));
      const d = Math.abs(s + b - x) * 3 + Math.abs(s - s0) * 0.2;
      if (d < dm) { dm = d; meglio = s; }
    }
    return meglio;
  }

  // schermi larghi (computer, telefono in orizzontale): il tavolo si gira e la propria porta va a sinistra; prima era
  // una striscia stretta al centro dello schermo. Le coordinate "di vista" restano quelle del tavolo in verticale.
  const orizz = () => window.innerWidth > window.innerHeight * 1.15;
  // dal punto toccato alla x "di vista" del tavolo in verticale (in orizzontale è l'altezza sullo schermo)
  const xVista = (e, r, W) => (orizz() ? ((e.clientY - r.top) / r.height) * W : ((e.clientX - r.left) / r.width) * W);

  // comandi locali (per la previsione): il mouse sul campo e le frecce
  const attivo = () => ctxC && ctxC.partita && ctxC.partita.gioco === 'calcetto' && !ctxC.partita.finita;
  document.addEventListener('pointermove', (e) => {
    if (!attivo() || !e.target.classList || !e.target.classList.contains('ar-tela')) return;
    const r = e.target.getBoundingClientRect();
    mouseX = xVista(e, r, ctxC.partita.W); mouseNuovo = true; ultimoComando = performance.now();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!attivo()) return;
    if ((e.target.classList && e.target.classList.contains('ar-tela') && e.pointerType !== 'touch') || (e.target.closest && e.target.closest('[data-ar="azione"]'))) tiroLocale = performance.now();
  });
  document.addEventListener('keydown', (e) => {
    if (!attivo() || e.repeat || (e.target.closest && e.target.closest('input, textarea'))) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a' || (orizz() && (k === 'arrowup' || k === 'w'))) tasti = -1; else if (k === 'arrowright' || k === 'd' || (orizz() && (k === 'arrowdown' || k === 's'))) tasti = 1;
    else if ([' ', 'enter', 'j', 'k'].includes(k)) tiroLocale = performance.now();
    if (tasti) ultimoComando = performance.now();
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'a', 'arrowup', 'w'].includes(k) && tasti < 0) tasti = 0;
    if (['arrowright', 'd', 'arrowdown', 's'].includes(k) && tasti > 0) tasti = 0;
  });

  const tavolo = window.Arena.tavolo({
    id: 'calcetto',
    mouse: 'bersaglio',
    misura: (p) => (orizz() ? [p.H, p.W] : [p.W, p.H]),
    coordMondo: (e, r, p) => [xVista(e, r, p.W), 0],
    // in orizzontale le stecche corrono in su e in giù: su/giù (W/S) spostano gli omini come sinistra/destra
    tasti: (x, y) => (orizz() ? [Math.max(-1, Math.min(1, x + y)), 0] : [x, y]),
    comandi: 'tasto',
    nomeAzione: '⚽ Tira',
    obiettivo: 'gol',
    suonoAzione: [[300, 0.03]],
    istruzioni: () => (window.Arena.touch() ? 'Trascina il dito sul campo: gli omini si mettono dove tocchi. Premi ⚽ Tira per calciare.' : `Muovi il mouse (o frecce ${orizz() ? 'su/giù, W/S' : 'destra/sinistra, A/D'}): gli omini si mettono dove punti. Clic o spazio per tirare.`) + (orizz() ? ' La tua porta è a sinistra.' : ' La tua porta è in basso.'),
    ruolo: (p, s, ctx) => {
      const ex = p.extra; if (!ex) return '';
      const sq = ctx.mio % 2, cosa = !ex.aSquadre ? 'tutte le stecche' : ctx.mio < 2 ? 'portiere e difesa' : 'centrocampo e attacco';
      return `squadra ${COL[sq].nome}: ${cosa}`;
    },
    sottotitolo: (p, ctx) => (p.extra ? `squadra ${COL[ctx.mio % 2].nome} · si vince a ${p.extra.obiettivo}` : ''),
    statoGioco: (ctx, s) => (s.s.gp ? 'GOL!' : 'Gioca!'),
    hud: (ctx, s) => { const sq = ctx.mio % 2; return `<span style="color:${COL[sq].maglia}">● Voi ${s.s.g[sq]}</span><span style="color:${COL[1 - sq].maglia}">● Loro ${s.s.g[1 - sq]}</span>`; },
    fineRound: (p, s, ctx) => `${s.s.g[ctx.mio % 2]} – ${s.s.g[1 - (ctx.mio % 2)]}`,
    dopoTick(ctx, d, prima) {
      ctxC = ctx;
      // i colpi arrivano con un numero: si fanno vedere (e sentire) una volta sola
      for (const [n, x, y, forte] of d.s.c || []) {
        if (n <= visti) continue;
        visti = n;
        colpi.push({ x, y, t: performance.now(), forte });
        suono([[forte ? 220 : 600, forte ? 0.06 : 0.03]], { tipo: forte ? 'square' : 'triangle', volume: forte ? 0.06 : 0.03 });
      }
      if (prima && prima.s && d.s.g && (d.s.g[0] !== prima.s.g[0] || d.s.g[1] !== prima.s.g[1])) {
        const nostro = d.s.g[ctx.mio % 2] !== prima.s.g[ctx.mio % 2];
        suono(nostro ? [[523, 0.1], [659, 0.1], [784, 0.25]] : [[300, 0.15], [200, 0.3]], { volume: 0.08 });
      }
    },
    disegna(g, p, s, prima, u, ctx) {
      ctxC = ctx;
      const ex = p.extra; if (!ex || !s.s || !s.s.a) return;
      const W = p.W, H = p.H, sq = ctx.mio % 2, giro = sq === 1;
      const k2 = `${W}x${H}`;
      if (k2 !== chiave) { sfondo = preparaSfondo(W, H, ex); chiave = k2; metallo = null; }
      if (!metallo) { metallo = g.createLinearGradient(0, -4, 0, 4); metallo.addColorStop(0, '#f4f6f8'); metallo.addColorStop(0.5, '#9aa1ab'); metallo.addColorStop(1, '#e2e5ea'); }
      const ora = performance.now(), dt = Math.min(0.05, (ora - (ultimoFotogramma || ora)) / 1000); ultimoFotogramma = ora;
      const oz = orizz();
      g.save();
      // in orizzontale: il tavolo girato di un quarto in senso orario, la propria porta (in basso) va a sinistra
      if (oz) { g.translate(H, 0); g.rotate(Math.PI / 2); }
      if (giro) { g.translate(W, H); g.rotate(Math.PI); }
      g.drawImage(sfondo, 0, 0, W, H);
      const pa = prima && prima.s && prima.s.a ? prima.s.a : null;
      // la pallina (sotto gli omini)
      const pb = prima && prima.s && prima.s.b, b = s.s.b;
      const vicina = pb && Math.hypot(pb.x - b.x, pb.y - b.y) < 120;
      const bx = vicina ? pb.x + (b.x - pb.x) * u : b.x, by = vicina ? pb.y + (b.y - pb.y) * u : b.y;
      const r = ex.R_PALLA;
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(bx + 3, by + 4, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f4f6f8'; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(160,170,185,.6)'; g.beginPath(); g.arc(bx + r * 0.25, by + r * 0.25, r * 0.7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(bx - r * 0.3, by - r * 0.3, r * 0.45, 0, Math.PI * 2); g.fill();
      // stecche e omini
      const gioca = s.fase === 'gioco' && !s.s.gp && attivo();
      const tiroMio = ora - tiroLocale < ex.DURATA_TIRO * 1000 ? 1 - (ora - tiroLocale) / (ex.DURATA_TIRO * 1000) : 0;
      ex.aste.forEach((a, i) => {
        const [s1, t1] = s.s.a[i], srv = pa ? pa[i][0] + (s1 - pa[i][0]) * u : s1;
        const mia = a.chi === ctx.mio;
        let sh = srv, tiro = t1;
        if (mia && gioca) {
          // previsione: la stecca va subito dove si punta, alla stessa velocità del server
          let m = mie.get(i); if (!m) { m = { s: srv }; mie.set(i, m); }
          let meta = m.s;
          if (tasti) meta = Math.max(a.min, Math.min(a.max, m.s + tasti * (giro ? -1 : 1) * ex.V_ASTA * 1.2 * dt));
          else if (mouseX !== null) meta = spostaPer(a, m.s, giro ? W - mouseX : mouseX);
          const max = ex.V_ASTA * dt;
          m.s += Math.max(-max, Math.min(max, meta - m.s));
          // fermi da un po': ci si riallinea dolcemente al server (che nel frattempo ci ha raggiunto)
          const fermo = ora - ultimoComando > 250;
          if (Math.abs(m.s - srv) > 90) m.s = srv;
          else if (fermo) m.s += (srv - m.s) * Math.min(1, dt * 8);
          sh = m.s;
          tiro = Math.max(t1, tiroMio);
        } else mie.delete(i);
        g.save(); g.translate(0, a.y); g.fillStyle = metallo; g.fillRect(0, -4, W, 8); g.restore();
        if (mia) { g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, a.y - 9, W, 18); }
        for (const x of a.base) omino(g, x + sh, a.y, COL[a.sq], a.sq === 0 ? -1 : 1, tiro, mia);
      });
      mouseNuovo = false;
      colpi = colpi.filter((c) => ora - c.t < 250);
      for (const c of colpi) { const k = (ora - c.t) / 250; g.strokeStyle = `rgba(255,255,200,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.arc(c.x, c.y, 12 + k * (c.forte ? 26 : 12), 0, Math.PI * 2); g.stroke(); }
      g.restore();
      // punteggio sul bordo (sempre dritto)
      g.font = '800 34px system-ui, sans-serif'; g.textBaseline = 'middle';
      if (oz) {
        // in alto al centro: i nostri gol a sinistra (dalla parte della nostra porta), i loro a destra
        g.textAlign = 'center';
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(H / 2 - 56, 16, 112, 54);
        g.fillStyle = COL[sq].maglia; g.fillText(String(s.s.g[sq]), H / 2 - 26, 44);
        g.fillStyle = COL[1 - sq].maglia; g.fillText(String(s.s.g[1 - sq]), H / 2 + 26, 44);
      } else {
        g.textAlign = 'left';
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(16, H / 2 - 52, 58, 104);
        g.fillStyle = COL[1 - sq].maglia; g.fillText(String(s.s.g[1 - sq]), 30, H / 2 - 24);
        g.fillStyle = COL[sq].maglia; g.fillText(String(s.s.g[sq]), 30, H / 2 + 26);
      }
      g.textBaseline = 'alphabetic';
      const [LW, LH] = oz ? [H, W] : [W, H];
      if (s.s.gp) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, LH / 2 - 70, LW, 140); g.fillStyle = '#ffd76a'; g.textAlign = 'center'; g.font = '900 88px system-ui, sans-serif'; g.fillText('GOL!', LW / 2, LH / 2 + 30); }
    },
  });
  // il punteggio in alto: le due squadre
  tavolo.punteggio = (ctx) => {
    const p = ctx.partita, esc = window.Nuovi.esc;
    const nomi = (sq) => Array.from({ length: p.n }, (_, i) => i).filter((i) => i % 2 === sq).map((i) => (i === ctx.mio ? 'Tu' : esc(ctx.nome(i)))).join(' e ');
    const g = (p.stato && p.stato.s && p.stato.s.g) || [0, 0];
    return `<span style="color:${COL[0].maglia}">${nomi(0)} <b>${g[0]}</b></span><span style="color:${COL[1].maglia}">${nomi(1)} <b>${g[1]}</b></span><span class="obiettivo">a ${p.extra ? p.extra.obiettivo : 5} gol</span>`;
  };
  Object.assign(window.Tavoli, { calcetto: tavolo });
})();
