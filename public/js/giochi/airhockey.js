// AIR HOCKEY: il tavolo nel browser, con previsione lato client.
// - la mia racchetta si disegna subito dove punto (non aspetta il server)
// - il disco avanza da solo tra un tick e l'altro (con i rimbalzi) e si corregge piano quando arriva la posizione vera
// - chi gioca in alto vede il tavolo capovolto: la propria porta è sempre in basso
(() => {
  const { esc, suono } = window.Nuovi;
  const COLORI_SQ = ['#e8453c', '#2f7fd8'];
  let ctxA = null, tela = null, ultimo = null, ricevuto = 0;
  const vista = { disco: null, mazze: [] };
  let mio = null; // posizione della mia racchetta (coordinate del tavolo)
  let ultimoInvio = 0;

  const giro = (p, x, y) => (p.miaSquadra === 1 ? [p.W - x, p.H - y] : [x, y]); // tavolo → schermo (e viceversa: è simmetrico)

  function prevediDisco(p, ora) {
    if (!ultimo) return null;
    let [x, y, vx, vy] = ultimo.d;
    if (ultimo.fermo > 0 || ultimo.pausa) return [x, y];
    const t = Math.min(0.12, (ora - ricevuto) / 1000); // al massimo 120 ms di previsione
    x += vx * t; y += vy * t;
    const r = p.R_DISCO;
    if (x < r) x = 2 * r - x; if (x > p.W - r) x = 2 * (p.W - r) - x;
    const inPorta = Math.abs(x - p.W / 2) < p.PORTA / 2;
    if (!inPorta) { if (y < r) y = 2 * r - y; if (y > p.H - r) y = 2 * (p.H - r) - y; }
    return [x, y];
  }

  function disegna() {
    const ctx = ctxA;
    if (!ctx || !ctx.stato || !ctx.partita || ctx.partita.gioco !== 'airhockey' || !tela || !ultimo) return;
    const p = ctx.partita;
    const box = tela.parentElement;
    if (!box) return;
    // il tavolo prende l'altezza che resta sotto la barra (prima un numero fisso: sul telefono in orizzontale era minuscolo)
    const sopra = Math.max(0, box.getBoundingClientRect().top + (window.scrollY || 0));
    const scala = Math.min(box.clientWidth / p.W, (matchMedia('(pointer: coarse)').matches ? Math.max(140, window.innerHeight - sopra - (window.innerWidth > window.innerHeight ? 20 : 84)) : window.innerHeight - 224) / p.H);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(p.W * scala), h = Math.round(p.H * scala);
    if (tela.width !== w * dpr) { tela.width = w * dpr; tela.height = h * dpr; tela.style.width = `${w}px`; tela.style.height = `${h}px`; }
    const g = tela.getContext('2d');
    g.setTransform(dpr * scala, 0, 0, dpr * scala, 0, 0);
    // il tavolo
    g.fillStyle = '#eaf4fb'; g.fillRect(0, 0, p.W, p.H);
    g.fillStyle = 'rgba(80,130,170,.13)';
    for (let y = 30; y < p.H; y += 40) for (let x = 30 + ((y / 40) % 2) * 20; x < p.W; x += 40) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#c33c3c'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, p.H / 2); g.lineTo(p.W, p.H / 2); g.stroke();
    g.beginPath(); g.arc(p.W / 2, p.H / 2, 90, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#3b77b5'; g.lineWidth = 3;
    for (const lato of [0, 1]) { const y = lato ? p.H : 0; g.beginPath(); g.arc(p.W / 2, y, 150, lato ? Math.PI : 0, lato ? Math.PI * 2 : Math.PI); g.stroke(); }
    // porte (quella in basso è sempre la mia)
    const sqBasso = p.miaSquadra, sqAlto = 1 - p.miaSquadra;
    g.strokeStyle = '#b7cfe0'; g.lineWidth = 10; g.strokeRect(5, 5, p.W - 10, p.H - 10);
    // le porte: un'apertura scura nella sponda, con i pali del colore della squadra
    for (const [y, sq] of [[0, sqAlto], [p.H - 16, sqBasso]]) {
      g.fillStyle = '#243447'; g.fillRect(p.W / 2 - p.PORTA / 2, y, p.PORTA, 16);
      g.fillStyle = COLORI_SQ[sq]; g.fillRect(p.W / 2 - p.PORTA / 2 - 10, y, 12, 16); g.fillRect(p.W / 2 + p.PORTA / 2 - 2, y, 12, 16);
    }
    // punteggio stampato sul tavolo
    g.fillStyle = 'rgba(40,70,100,.18)'; g.font = '400 110px "Young Serif", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(ultimo.g[sqAlto]), p.W / 2, p.H * 0.27); g.fillText(String(ultimo.g[sqBasso]), p.W / 2, p.H * 0.73);

    // disco: previsione + correzione morbida
    const ora = performance.now();
    const pr = prevediDisco(p, ora);
    if (pr) {
      if (!vista.disco || Math.hypot(pr[0] - vista.disco[0], pr[1] - vista.disco[1]) > 160) vista.disco = pr.slice();
      else { vista.disco[0] += (pr[0] - vista.disco[0]) * 0.5; vista.disco[1] += (pr[1] - vista.disco[1]) * 0.5; }
      const [x, y] = giro(p, vista.disco[0], vista.disco[1]);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.arc(x + 4, y + 5, p.R_DISCO, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1f2430'; g.beginPath(); g.arc(x, y, p.R_DISCO, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4a5364'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, p.R_DISCO * 0.62, 0, Math.PI * 2); g.stroke();
    }
    // racchette: la mia dove punto, le altre interpolate
    ultimo.m.forEach(([mx, my], i) => {
      let pos;
      if (i === ctx.mio && mio) {
        // la mia racchetta insegue il puntatore alla stessa velocità massima del server: così il disco
        // non sembra più passarci attraverso quando muovo il mouse di scatto
        const prima = vista.mazze[i] || [mx, my];
        const dtm = Math.min(0.05, (ora - (vista.oraMia || ora)) / 1000);
        const vmax = (p.V_MAZZA || 2600) * dtm;
        let dx = mio[0] - prima[0], dy = mio[1] - prima[1];
        const d = Math.hypot(dx, dy);
        if (d > vmax && d > 0) { dx *= vmax / d; dy *= vmax / d; }
        pos = [prima[0] + dx, prima[1] + dy];
        // se il server la vede molto altrove (spinta dal disco), mi riallineo piano
        if (Math.hypot(mx - pos[0], my - pos[1]) > 60) pos = [pos[0] + (mx - pos[0]) * 0.3, pos[1] + (my - pos[1]) * 0.3];
        vista.oraMia = ora;
      } else {
        const prima = vista.mazze[i] || [mx, my];
        pos = [prima[0] + (mx - prima[0]) * 0.45, prima[1] + (my - prima[1]) * 0.45];
      }
      vista.mazze[i] = pos;
      const [x, y] = giro(p, pos[0], pos[1]);
      const col = COLORI_SQ[i % 2];
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(x + 5, y + 6, p.R_MAZZA, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(x, y, p.R_MAZZA, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x, y, p.R_MAZZA * 0.62, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(x, y, p.R_MAZZA * 0.38, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1f2430'; g.font = '600 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(i === ctx.mio ? 'tu' : (ctx.nome(i) || '').slice(0, 6), x, y - p.R_MAZZA - 16);
    });
    const scritta = ultimo.pausa ? '⏸ In pausa' : ultimo.fermo > 1400 ? String(Math.ceil(ultimo.fermo / 1000)) : '';
    if (scritta) { g.fillStyle = 'rgba(20,40,60,.45)'; g.fillRect(0, 0, p.W, p.H); g.fillStyle = '#fff'; g.font = '400 140px "Young Serif", Georgia, serif'; g.fillText(scritta, p.W / 2, p.H / 2); }
  }
  // TASTIERA: WASD o frecce muovono la racchetta (su = verso la porta avversaria, come la si vede sullo schermo)
  const premuti = new Set();
  const TASTI = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
  const giocoAttivo = () => ctxA && ctxA.partita && ctxA.partita.gioco === 'airhockey' && !ctxA.partita.finita && document.contains(tela) && !(window.Boss && window.Boss.attivo);
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!TASTI[k] || !giocoAttivo() || (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'))) return;
    e.preventDefault(); premuti.add(k);
  });
  document.addEventListener('keyup', (e) => premuti.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => premuti.clear());
  let ultimoTasti = 0;
  function daTastiera(ora) {
    const dt = Math.min(0.05, (ora - (ultimoTasti || ora)) / 1000); ultimoTasti = ora;
    if (!premuti.size || !giocoAttivo() || !ultimo) return;
    const p = ctxA.partita;
    let dx = 0, dy = 0; for (const k of premuti) { dx += TASTI[k][0]; dy += TASTI[k][1]; }
    const l = Math.hypot(dx, dy); if (!l) return;
    if (!mio) { const m = ultimo.m && ultimo.m[ctxA.mio]; mio = m ? [m[0], m[1]] : [p.W / 2, p.miaSquadra === 0 ? p.H * 0.85 : p.H * 0.15]; }
    const v = 980 * dt / l, giu = p.miaSquadra === 1 ? -1 : 1; // il tavolo di chi gioca in alto è capovolto
    const lim = p.limiti;
    mio = [Math.max(lim.x0, Math.min(lim.x1, mio[0] + dx * v * giu)), Math.max(lim.y0, Math.min(lim.y1, mio[1] + dy * v * giu))];
    if (ora - ultimoInvio > 25) { ultimoInvio = ora; ctxA.emetti('input', { x: Math.round(mio[0]), y: Math.round(mio[1]) }); }
  }
  (function ciclo(ora) { daTastiera(ora || performance.now()); disegna(); requestAnimationFrame(ciclo); })();

  function daPuntatore(e) {
    const ctx = ctxA;
    if (!ctx || !tela || !ctx.partita || ctx.partita.gioco !== 'airhockey' || ctx.partita.finita) return;
    const p = ctx.partita;
    const r = tela.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * p.W, sy = ((e.clientY - r.top) / r.height) * p.H;
    let [x, y] = giro(p, sx, sy);
    const l = p.limiti;
    x = Math.max(l.x0, Math.min(l.x1, x)); y = Math.max(l.y0, Math.min(l.y1, y));
    mio = [x, y];
    const ora = performance.now();
    if (ora - ultimoInvio > 25) { ultimoInvio = ora; ctx.emetti('input', { x: Math.round(x), y: Math.round(y) }); }
  }

  const airhockey = {
    libero: true,
    reset(ctx) {
      ctxA = ctx;
      if (ctx.ui._ahVisto !== true) { ctx.ui._ahVisto = true; ultimo = ctx.partita.stato; ricevuto = performance.now(); mio = null; vista.disco = null; vista.mazze = []; }
      if (!tela) { tela = document.createElement('canvas'); tela.className = 'ah-tela'; tela.setAttribute('aria-label', 'Tavolo da air hockey'); }
    },
    tick(ctx, d) {
      const prima = ultimo && ultimo.g.join();
      ultimo = d; ricevuto = performance.now();
      if (prima && prima !== d.g.join()) suono([[660, 0.08], [990, 0.16]], { volume: 0.07 });
      if (Date.now() - (ctx.ui._puntiDal || 0) > 400) { ctx.ui._puntiDal = Date.now(); const el = document.getElementById('punteggio'); if (el) el.innerHTML = airhockey.punteggio(ctx); }
    },
    panno(ctx) {
      return `<div class="ah"><div class="ah-box"></div><p class="piccolo ah-nota">Muovi il mouse, il dito, oppure WASD o le frecce: la tua porta è quella in basso.</p></div>`;
    },
    dopo() { const box = document.querySelector('.ah-box'); if (box && tela.parentElement !== box) box.append(tela); },
    stato(ctx) { const p = ctx.partita; return p.finita ? null : `Si vince a ${p.obiettivo} gol`; },
    punteggio(ctx) {
      const p = ctx.partita, g = ultimo ? ultimo.g : p.gol;
      const nomi = (sq) => Array.from({ length: p.n }, (_, i) => i).filter((i) => i % 2 === sq).map((i) => (i === ctx.mio ? 'Tu' : ctx.nome(i))).join(' e ');
      return `<span style="color:${COLORI_SQ[0]}">${esc(nomi(0))} <b>${g[0]}</b></span><span style="color:${COLORI_SQ[1]}">${esc(nomi(1))} <b>${g[1]}</b></span><span class="obiettivo">a ${p.obiettivo} gol</span>`;
    },
    infoPosto(ctx, posto) { const p = ctx.partita; return p.aSquadre ? `squadra ${posto % 2 ? 'blu' : 'rossa'}` : ''; },
    clic() {},
  };
  document.addEventListener('pointermove', (e) => { if (e.target === tela) daPuntatore(e); });
  document.addEventListener('pointerdown', (e) => { if (e.target === tela) { e.preventDefault(); daPuntatore(e); } });

  Object.assign(window.Tavoli, { airhockey });
})();
