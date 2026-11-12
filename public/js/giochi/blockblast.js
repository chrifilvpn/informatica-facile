// BLOCK BLAST: il tavolo nel browser. I pezzi si trascinano (mouse o dito) oppure si toccano e poi si tocca la casella.
(() => {
  const { esc, ritardo, trascorso, strato, primaVolta, suono } = window.Nuovi;
  const L = 8;
  let ctxBB = null;
  let trascina = null; // { k, forma, fantasma, dx, dy, r, c, ok, lift }

  const entra = (g, celle, r, c) => celle.every(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < L && cc >= 0 && cc < L && g[rr * L + cc] === '0'; });
  function lineePiene(g, celle, r, c) {
    const x = g.split('');
    for (const [dr, dc] of celle) x[(r + dr) * L + c + dc] = '9';
    const out = new Set();
    for (let i = 0; i < L; i++) {
      let rp = true, cp = true;
      for (let j = 0; j < L; j++) { if (x[i * L + j] === '0') rp = false; if (x[j * L + i] === '0') cp = false; }
      if (rp) for (let j = 0; j < L; j++) out.add(i * L + j);
      if (cp) for (let j = 0; j < L; j++) out.add(j * L + i);
    }
    return out;
  }
  const dim = (celle) => ({ h: Math.max(...celle.map((x) => x[0])) + 1, w: Math.max(...celle.map((x) => x[1])) + 1 });
  const colore = (p, forma) => p.colori[forma];
  const posso = (ctx) => {
    const p = ctx.partita;
    if (p.finita || p.inPausaGioco) return false;
    const b = p.plance[p.mia];
    if (!b.vivo) return false;
    return p.modo === 'sfida' || p.turno === ctx.mio;
  };

  function griglia(ctx, b, { mia, mini }) {
    const p = ctx.partita;
    const g = b.griglia;
    const pend = mia && ctx.ui.pendente && ctx.ui.pendente.base === (b.ultimo ? b.ultimo.id : 0) ? ctx.ui.pendente : null;
    const pendenti = new Set(pend ? p.forme[pend.forma].map(([dr, dc]) => (pend.r + dr) * L + pend.c + dc) : []);
    let celle = '';
    for (let i = 0; i < L * L; i++) {
      const v = pendenti.has(i) ? colore(p, pend.forma) : parseInt(g[i], 36);
      celle += `<div class="bb-cella ${v ? `pieno c${v}` : ''}" ${mia ? `data-i="${i}"` : ''}></div>`;
    }
    // esplosione delle linee appena cancellate (dura meno di un secondo)
    let scoppi = '';
    const u = b.ultimo;
    if (u && !mini && u.cancellate.length) {
      const chiave = `scoppio-${ctx.partita.mia}-${u.id}-${mia}`;
      if (trascorso(ctx.ui, chiave) < 900) {
        const st = ritardo(ctx.ui, chiave);
        scoppi = u.cancellate.map((i, k) => `<span class="bb-scoppio c${colore(p, u.forma)}" style="--x:${i % L};--y:${Math.floor(i / L)};--k:${(k % 8) * 25}ms;${st}"></span>`).join('');
        scoppi += `<span class="bb-punti" style="--x:${u.c};--y:${u.r};${st}">+${u.guadagno}${u.combo > 1 ? ` <small>combo ×${u.combo}</small>` : ''}</span>`;
      }
    }
    const bloccata = !b.vivo ? `<div class="bb-bloccata">${mini ? '✖' : 'Nessun pezzo entra più'}</div>` : '';
    return `<div class="bb-griglia ${mini ? 'mini' : ''} ${mia ? 'mia' : ''} ${!b.vivo ? 'morta' : ''}">${celle}${scoppi}${bloccata}</div>`;
  }

  function pezzo(p, forma, k, attivo, sel) {
    if (!forma) return `<div class="bb-slot vuoto"></div>`;
    const celle = p.forme[forma];
    const { h, w } = dim(celle);
    const col = colore(p, forma);
    const quadri = celle.map(([r, c]) => `<i class="c${col}" style="grid-row:${r + 1};grid-column:${c + 1}"></i>`).join('');
    const nascosto = trascina && trascina.k === k ? 'in-mano' : '';
    return `<div class="bb-slot"><div class="bb-pezzo ${attivo ? 'attivo' : 'fermo'} ${sel ? 'scelto' : ''} ${nascosto}" data-k="${k}" style="--w:${w};--h:${h}" ${attivo ? `tabindex="0" role="button" aria-label="Pezzo ${k + 1}"` : ''}>${quadri}</div></div>`;
  }

  const blockblast = {
    libero: true,
    senzaFila: false,
    reset(ctx) { ctxBB = ctx; },
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const b = p.plance[p.mia];
      if (ui.pendente && ui.pendente.base !== (b.ultimo ? b.ultimo.id : 0)) ui.pendente = null;
      const attivo = posso(ctx);
      if (ui.sel != null && (!attivo || !b.vassoio[ui.sel])) ui.sel = null;
      const vassoio = b.vassoio.map((f, k) => pezzo(p, f, k, attivo && !(ui.pendente && ui.pendente.k === k), ui.sel === k)).join('');
      let testa;
      if (p.modo === 'sfida') testa = `<div class="bb-testa"><span>I tuoi punti <b>${b.punti}</b></span><span>Linee <b>${b.linee}</b></span>${b.combo > 1 ? `<span class="bb-combo">combo ×${b.combo}</span>` : ''}</div>`;
      else testa = `<div class="bb-testa"><span>${p.modo === 'coop' ? 'Punti di squadra' : 'Punti'} <b>${b.punti}</b></span><span>Linee <b>${b.linee}</b></span>${b.combo > 1 ? `<span class="bb-combo">combo ×${b.combo}</span>` : ''}</div>`;
      let altri = '';
      if (p.modo === 'sfida') {
        altri = `<aside class="bb-altri ${p.finita || !b.vivo ? 'sempre' : ''}" aria-label="Le griglie degli altri">${p.plance.map((x, i) => (i === p.mia ? '' : `<div class="bb-altro ${x.vivo ? '' : 'fuori'}"><p>${esc(ctx.nome(i))} <b>${x.punti}</b></p>${griglia(ctx, x, { mini: true })}</div>`)).join('')}</aside>`;
      }
      let nota = '';
      if (p.finita) nota = '';
      else if (!b.vivo) nota = '<p class="bb-nota">La tua griglia è bloccata: guarda come va a finire.</p>';
      else if (p.modo === 'coop' && p.turno !== ctx.mio) nota = `<p class="bb-nota">Tocca a <b>${esc(ctx.nome(p.turno))}</b> mettere un pezzo.</p>`;
      else if (!b.pezzi) nota = '<p class="bb-nota">Trascina un pezzo nella griglia, oppure toccalo e poi tocca la casella.</p>';
      const rec = p.finita && p.record.length ? `<div class="bb-record"><b>🏆 Migliori punteggi ${p.modo === 'coop' ? 'di squadra' : 'da solo'}</b><ol>${p.record.map((x, k) => `<li class="${k === p.posizioneRecord ? 'nuovo' : ''}">${x.punti}${x.giocatori > 1 ? ` <small>(${x.giocatori} giocatori)</small>` : ''}</li>`).join('')}</ol></div>` : '';
      return `<div class="bb bb-${p.modo}">
        <div class="bb-principale">${testa}${griglia(ctx, b, { mia: true })}
          <div class="bb-vassoio ${attivo ? '' : 'spento'}">${vassoio}</div>${nota}${rec}</div>
        ${altri}</div>`;
    },
    dopo(ctx) {
      ctxBB = ctx;
      if (trascina) anteprima();
      else if (ctx.ui.sel != null) anteprimaSel(ctx);
      const p = ctx.partita;
      const u = p.plance[p.mia].ultimo;
      if (u && u.cancellate.length && primaVolta(ctx.ui, `suono-bb-${u.id}`)) suono([[523, 0.07], [659, 0.07], [784, 0.12]], { volume: 0.07 });
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      if (p.inPausaGioco) return 'In pausa';
      const b = p.plance[p.mia];
      if (!b.vivo) return 'Griglia bloccata';
      if (p.modo === 'sfida') return 'Incastra i pezzi';
      return p.turno === ctx.mio ? (p.n === 1 ? 'Incastra i pezzi' : 'Tocca a te') : `Tocca a ${ctx.nome(p.turno)}`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      if (p.modo === 'sfida') return p.plance.map((x, i) => `<span class="${x.vivo ? '' : 'barrato'}">${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x.punti}</b></span>`).join('') + `<span class="obiettivo">${p.vittoria === 'punti' ? 'vince chi fa più punti' : 'vince chi resiste di più'}</span>`;
      if (p.modo === 'coop') return p.puntiDi.map((x, i) => `<span>${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b></span>`).join('') + '<span class="obiettivo">punti portati alla squadra</span>';
      return '';
    },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      if (p.modo === 'sfida') return p.plance[posto].vivo ? `${p.plance[posto].punti} punti` : '<span class="eliminato">bloccato</span>';
      return p.modo === 'coop' ? `${p.puntiDi[posto]} punti portati` : '';
    },
    clic(ctx, el) { void ctx; void el; }, // tutto passa dai gestori qui sotto
  };

  // ---------- trascinamento ----------
  function metti(k, r, c) {
    const ctx = ctxBB, p = ctx.partita, b = p.plance[p.mia];
    const forma = b.vassoio[k];
    ctx.ui.pendente = { k, r, c, forma, base: b.ultimo ? b.ultimo.id : 0 };
    ctx.ui.sel = null;
    ctx.invia({ tipo: 'metti', pezzo: k, r, c });
    ctx.ridisegna();
    const attesa = ctx.ui.pendente;
    // se il server rifiuta la mossa (o non risponde) il pezzo torna nel vassoio
    setTimeout(() => { if (ctxBB && ctxBB.stato && ctxBB.ui.pendente === attesa) { ctxBB.ui.pendente = null; ctxBB.ridisegna(); } }, 1500);
  }
  function pulisciAnteprima() {
    document.querySelectorAll('.bb-griglia.mia .anteprima, .bb-griglia.mia .libera, .bb-griglia.mia .no').forEach((x) => x.classList.remove('anteprima', 'libera', 'no'));
  }
  function segna(r, c, forma) {
    const p = ctxBB.partita, b = p.plance[p.mia];
    const celle = p.forme[forma];
    pulisciAnteprima();
    const grid = document.querySelector('.bb-griglia.mia');
    if (!grid || r == null) return false;
    const ok = entra(b.griglia, celle, r, c);
    if (!ok) return false;
    for (const [dr, dc] of celle) grid.querySelector(`[data-i="${(r + dr) * L + c + dc}"]`)?.classList.add('anteprima');
    for (const i of lineePiene(b.griglia, celle, r, c)) grid.querySelector(`[data-i="${i}"]`)?.classList.add('libera');
    return true;
  }
  function anteprima() {
    const t = trascina;
    const grid = document.querySelector('.bb-griglia.mia');
    if (!grid) return;
    const rg = grid.getBoundingClientRect();
    const cella = rg.width / L;
    const x = t.x - t.dx, y = t.y - t.dy - t.lift;
    t.fantasma.style.transform = `translate(${x}px, ${y}px)`;
    t.fantasma.style.setProperty('--cella', `${cella}px`);
    const r = Math.round((y - rg.top) / cella), c = Math.round((x - rg.left) / cella);
    const { h, w } = dim(ctxBB.partita.forme[t.forma]);
    const dentro = r > -h && r < L && c > -w && c < L;
    t.ok = dentro && segna(r, c, t.forma);
    t.r = r; t.c = c;
    t.fantasma.classList.toggle('valido', !!t.ok);
  }
  function anteprimaSel(ctx) {
    const hov = ctx.ui.hover;
    if (hov == null) return;
    const p = ctx.partita, b = p.plance[p.mia];
    const f = b.vassoio[ctx.ui.sel];
    if (f) segna(Math.floor(hov / L), hov % L, f);
  }

  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('.bb-pezzo.attivo');
    if (!el || !ctxBB || !ctxBB.stato || !ctxBB.partita || ctxBB.partita.gioco !== 'blockblast' || !posso(ctxBB)) return;
    e.preventDefault();
    const p = ctxBB.partita, b = p.plance[p.mia];
    const k = Number(el.dataset.k);
    const forma = b.vassoio[k];
    if (!forma) return;
    const grid = document.querySelector('.bb-griglia.mia');
    const cella = grid.getBoundingClientRect().width / L;
    const { h, w } = dim(p.forme[forma]);
    const f = document.createElement('div');
    f.className = 'bb-fantasma';
    f.style.cssText = `--w:${w};--h:${h};--cella:${cella}px`;
    f.innerHTML = p.forme[forma].map(([r, c]) => `<i class="c${p.colori[forma]}" style="grid-row:${r + 1};grid-column:${c + 1}"></i>`).join('');
    strato().append(f);
    // il pezzo si prende dal centro; col dito lo si alza un po' per vederlo
    trascina = { k, forma, fantasma: f, dx: (w * cella) / 2, dy: (h * cella) / 2, lift: e.pointerType === 'touch' ? cella * 1.6 : 0, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, mosso: false, ok: false };
    el.classList.add('in-mano');
    anteprima();
  });
  document.addEventListener('pointermove', (e) => {
    if (trascina) {
      trascina.x = e.clientX; trascina.y = e.clientY;
      if (Math.hypot(e.clientX - trascina.x0, e.clientY - trascina.y0) > 6) trascina.mosso = true;
      anteprima();
      return;
    }
    // pezzo scelto col tocco: anteprima dove passa il mouse
    const c = e.target.closest && e.target.closest('.bb-griglia.mia [data-i]');
    if (ctxBB && ctxBB.stato && ctxBB.partita && ctxBB.partita.gioco === 'blockblast' && ctxBB.ui.sel != null) {
      const i = c ? Number(c.dataset.i) : null;
      if (i !== ctxBB.ui.hover) { ctxBB.ui.hover = i; if (i == null) pulisciAnteprima(); else anteprimaSel(ctxBB); }
    }
  });
  function fine() {
    const t = trascina;
    if (!t) return;
    trascina = null;
    pulisciAnteprima();
    if (t.ok && t.mosso) { t.fantasma.remove(); metti(t.k, t.r, t.c); return; }
    if (!t.mosso) { // semplice tocco: il pezzo viene scelto
      t.fantasma.remove();
      ctxBB.ui.sel = ctxBB.ui.sel === t.k ? null : t.k;
      ctxBB.ridisegna();
      return;
    }
    // non entra: torna nel vassoio
    const slot = document.querySelector(`.bb-pezzo[data-k="${t.k}"]`);
    const r = slot ? slot.getBoundingClientRect() : null;
    if (r && t.fantasma.animate) {
      const a = t.fantasma.animate([{ transform: t.fantasma.style.transform, opacity: 1 }, { transform: `translate(${r.left}px, ${r.top}px) scale(.5)`, opacity: 0 }], { duration: 220, easing: 'ease-in' });
      a.onfinish = () => t.fantasma.remove();
    } else t.fantasma.remove();
    ctxBB.ridisegna();
  }
  document.addEventListener('pointerup', fine);
  document.addEventListener('pointercancel', fine);
  // tocco su una casella con un pezzo scelto
  document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('.bb-griglia.mia [data-i]');
    if (!c || !ctxBB || !ctxBB.stato || !ctxBB.partita || ctxBB.partita.gioco !== 'blockblast' || ctxBB.ui.sel == null || !posso(ctxBB)) return;
    const p = ctxBB.partita, b = p.plance[p.mia];
    const i = Number(c.dataset.i);
    const f = b.vassoio[ctxBB.ui.sel];
    if (!f || !entra(b.griglia, p.forme[f], Math.floor(i / L), i % L)) return ctxBB.avviso('Il pezzo non entra lì (la casella è il suo angolo in alto a sinistra)', 1800);
    metti(ctxBB.ui.sel, Math.floor(i / L), i % L);
  });
  // da tastiera: Invio sul pezzo lo sceglie
  document.addEventListener('keydown', (e) => {
    const el = (e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.bb-pezzo.attivo');
    if (!el || !ctxBB) return;
    e.preventDefault();
    ctxBB.ui.sel = Number(el.dataset.k);
    ctxBB.ridisegna();
  });

  Object.assign(window.Tavoli, { blockblast });
})();
