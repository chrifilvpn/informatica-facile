// CONQUISTA DEL MONDO: la mappa in SVG con l'oceano, le terre dei continenti (cerchi sfumati che si fondono), le linee
// dei confini (tratteggiate sul mare) e i territori come gettoni del colore del padrone con il numero di armate.
// Sotto la mappa: la fase del turno e i suoi comandi (quante armate mettere, attacco singolo o fino in fondo, quante
// spostare), e i dadi dell'ultimo attacco.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const COLORI = ['#e63946', '#3a86ff', '#2a9d8f', '#f4a261', '#9b5de5'];
  const T = [
    ['Alaska', 'na', 70, 110], ['Canada', 'na', 200, 95], ['Groenlandia', 'na', 345, 55], ['Stati Uniti', 'na', 185, 210], ['Messico', 'na', 165, 300],
    ['Venezuela', 'sa', 255, 345], ['Brasile', 'sa', 320, 420], ['Argentina', 'sa', 270, 500],
    ['Gran Bretagna', 'eu', 440, 140], ['Scandinavia', 'eu', 510, 85], ['Europa occidentale', 'eu', 455, 230], ['Europa centrale', 'eu', 530, 180], ['Europa orientale', 'eu', 610, 140],
    ['Nord Africa', 'af', 480, 320], ['Egitto', 'af', 575, 290], ['Africa centrale', 'af', 545, 395], ['Sudafrica', 'af', 560, 490],
    ['Russia', 'as', 760, 105], ['Medio Oriente', 'as', 660, 255], ['India', 'as', 755, 300], ['Cina', 'as', 830, 215], ['Giappone', 'as', 935, 170],
    ['Indonesia', 'oc', 855, 380], ['Australia', 'oc', 920, 470],
  ].map(([nome, cont, x, y], i) => ({ i, nome, cont, x, y }));
  const TERRA = { na: '#c8b98a', sa: '#b9c98a', eu: '#c9b1a0', af: '#d9bf7a', as: '#b8c4a0', oc: '#d8a98a' };
  const CONFINI = [[0, 1], [0, 17], [1, 3], [1, 2], [2, 9], [2, 8], [3, 4], [4, 5], [5, 6], [5, 7], [6, 7], [6, 13], [8, 9], [8, 10], [8, 11], [9, 11], [9, 12], [10, 11], [10, 13], [11, 12], [11, 13], [11, 14], [12, 17], [12, 18], [13, 14], [13, 15], [14, 15], [14, 18], [15, 16], [17, 18], [17, 20], [17, 21], [18, 19], [19, 20], [19, 22], [20, 21], [20, 22], [22, 23]];
  const VICINI = T.map((t) => CONFINI.filter((c) => c.includes(t.i)).map((c) => (c[0] === t.i ? c[1] : c[0])));
  const PUNTI = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]], 6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]] };
  const dado = (v, cls) => `<svg class="cq-dado ${cls}" viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" rx="18"/>${PUNTI[v].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')}</svg>`;
  const chi = (ctx, i) => (i === ctx.mio ? 'Tu' : ctx.nome(i));

  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const mio = p.turno === ctx.mio && !p.finita && !ctx.stato.spettatore;
      if (!mio || (ui.fase !== p.fase)) { ui.sel = null; ui.fase = p.fase; }
      const sel = ui.sel;
      // cosa si può toccare in questa fase
      const toccabili = new Set(), bersagli = new Set();
      if (mio) {
        if (p.fase === 'rinforzi') T.forEach((t) => { if (p.padrone[t.i] === ctx.mio) toccabili.add(t.i); });
        if (p.fase === 'attacco') {
          T.forEach((t) => { if (p.padrone[t.i] === ctx.mio && p.armate[t.i] > 1 && VICINI[t.i].some((j) => p.padrone[j] !== ctx.mio)) toccabili.add(t.i); });
          if (sel != null) VICINI[sel].forEach((j) => { if (p.padrone[j] !== ctx.mio) bersagli.add(j); });
        }
        if (p.fase === 'spostamento' && p.collegati) {
          Object.keys(p.collegati).forEach((t) => { if (p.collegati[t].length) toccabili.add(Number(t)); });
          if (sel != null && p.collegati[sel]) p.collegati[sel].forEach((j) => bersagli.add(j));
        }
      }
      const at = p.attacco;
      let linee = '';
      for (const [a, b] of CONFINI) {
        const A = T[a], B = T[b], mare = A.cont !== B.cont || a === 0 && b === 17;
        if (a === 0 && b === 17) { linee += `<line class="cq-mare" x1="${A.x}" y1="${A.y}" x2="0" y2="${A.y - 20}"/><line class="cq-mare" x1="${B.x}" y1="${B.y}" x2="1000" y2="${B.y - 15}"/>`; continue; }
        const att = at && ((at.da === a && at.a === b) || (at.da === b && at.a === a));
        linee += `<line class="${mare ? 'cq-mare' : 'cq-terra'} ${att ? 'cq-attacco' : ''}" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
      }
      const terre = T.map((t) => `<circle cx="${t.x}" cy="${t.y}" r="62" fill="${TERRA[t.cont]}"/>`).join('');
      const pedine = T.map((t) => {
        const own = p.padrone[t.i], col = COLORI[own % COLORI.length];
        const cls = ['cq-t', toccabili.has(t.i) ? 'tocca' : '', bersagli.has(t.i) ? 'bersaglio' : '', sel === t.i ? 'sel' : '', at && at.a === t.i ? 'colpito' : '', at && at.da === t.i ? 'attaccante' : ''].filter(Boolean).join(' ');
        const az = toccabili.has(t.i) || bersagli.has(t.i) ? `data-az="terr" data-t="${t.i}"` : '';
        return `<g class="${cls}" ${az}><title>${t.nome}: ${esc(chi(ctx, own))}, ${p.armate[t.i]} armate</title><circle class="cq-gettone" cx="${t.x}" cy="${t.y}" r="24" fill="${col}"/><text class="cq-num" x="${t.x}" y="${t.y + 7}">${p.armate[t.i]}</text><text class="cq-nome" x="${t.x}" y="${t.y + 40}">${t.nome}</text></g>`;
      }).join('');
      const mappa = `<svg class="cq-mappa" viewBox="0 0 1000 560" role="img" aria-label="Mappa del mondo">
        <defs><filter id="cq-goo"><feGaussianBlur stdDeviation="14"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 30 -12"/></filter></defs>
        <rect width="1000" height="560" rx="18" class="cq-oceano"/><g filter="url(#cq-goo)" opacity=".95">${terre}</g>${linee}${pedine}</svg>`;
      // comandi della fase
      let comandi = '', info = '';
      if (mio && p.fase === 'rinforzi') {
        ui.quanti = ui.quanti && ui.quanti <= p.daPiazzare ? ui.quanti : 1;
        comandi = `<p class="cq-fase">📦 Rinforzi: hai <b>${p.daPiazzare}</b> armate da mettere. Tocca un tuo territorio.</p>
          <div class="cq-bottoni">${[1, 3, 5].filter((q) => q < p.daPiazzare).map((q) => `<button type="button" class="bottone piccolo-bt ${ui.quanti === q ? 'attivo' : ''}" data-az="quanti" data-q="${q}">+${q}</button>`).join('')}
          <button type="button" class="bottone piccolo-bt ${ui.quanti === p.daPiazzare ? 'attivo' : ''}" data-az="quanti" data-q="${p.daPiazzare}">tutte (${p.daPiazzare})</button>
          ${p.carte[ctx.mio] >= 3 ? `<button type="button" class="bottone" data-az="carte">🃏 Gioca 3 carte (+8)</button>` : ''}</div>`;
      } else if (mio && p.fase === 'attacco') {
        comandi = `<p class="cq-fase">⚔️ Attacchi: ${sel == null ? 'tocca un tuo territorio con almeno 2 armate' : `da <b>${T[sel].nome}</b>: tocca un nemico confinante`}</p>
          <div class="cq-bottoni"><button type="button" class="bottone piccolo-bt ${ui.fino ? '' : 'attivo'}" data-az="modo" data-f="0">🎲 Un tiro</button><button type="button" class="bottone piccolo-bt ${ui.fino ? 'attivo' : ''}" data-az="modo" data-f="1">⏩ Fino in fondo</button>
          <button type="button" class="bottone" data-az="fineAttacchi">Basta attacchi →</button></div>`;
      } else if (mio && p.fase === 'occupa') {
        const { da, a, min } = p.occupa, max = p.armate[da] - 1, meta = Math.max(min, Math.round(max / 2));
        comandi = `<p class="cq-fase">🚩 Hai conquistato <b>${T[a].nome}</b>: quante armate ci entrano da ${T[da].nome}?</p>
          <div class="cq-bottoni">${[...new Set([min, meta, max])].map((q) => `<button type="button" class="bottone" data-az="occupa" data-q="${q}">${q}${q === max ? ' (tutte)' : q === min ? ' (minimo)' : ''}</button>`).join('')}</div>`;
      } else if (mio && p.fase === 'spostamento') {
        if (ui.dest != null && (sel == null || !(p.collegati[sel] || []).includes(ui.dest))) ui.dest = null;
        const max = sel != null ? p.armate[sel] - 1 : 0;
        const quante = sel != null && ui.dest != null ? `<p class="cq-fase">Quante armate da ${T[sel].nome} a <b>${T[ui.dest].nome}</b>?</p><div class="cq-bottoni">${[...new Set([1, Math.ceil(max / 2), max])].map((q) => `<button type="button" class="bottone" data-az="sposta" data-q="${q}">${q}${q === max ? ' (tutte)' : ''}</button>`).join('')}</div>` : '';
        comandi = `<p class="cq-fase">🚚 Spostamento (facoltativo): ${sel == null ? 'tocca un territorio da cui spostare armate' : `da <b>${T[sel].nome}</b> (${max} spostabili): tocca dove`}</p>${quante}
          <div class="cq-bottoni"><button type="button" class="bottone" data-az="fine">Fine turno ✓</button></div>`;
      } else if (!p.finita) info = `<p class="cq-fase">Tocca a <b>${esc(ctx.nome(p.turno))}</b> · ${{ rinforzi: 'mette i rinforzi', attacco: 'attacca', occupa: 'occupa', spostamento: 'sposta le armate' }[p.fase]}</p>`;
      const dadi = at ? `<div class="cq-dadi"><span>${esc(chi(ctx, p.padrone[at.da]))} ⚔️ ${esc(chi(ctx, at.dif))}</span>${at.ultimo.a.map((v, k) => dado(v, k < at.ultimo.d.length && v > at.ultimo.d[k] ? 'vince att' : 'att')).join('')}<b>vs</b>${at.ultimo.d.map((v, k) => dado(v, k < at.ultimo.a.length && v >= at.ultimo.a[k] ? 'vince dif' : 'dif')).join('')}
        <small>${at.tiri > 1 ? `${at.tiri} tiri · ` : ''}perse ${at.perseA} in attacco, ${at.perseD} in difesa${at.conquistato ? ' · conquistato!' : ''}</small></div>` : '';
      const legenda = Array.from({ length: p.n }, (_, k) => `<span class="${p.turno === k ? 'di-turno' : ''} ${p.fuori.includes(k) ? 'fuori' : ''}"><i style="background:${COLORI[k % COLORI.length]}"></i>${esc(chi(ctx, k))} <b>${p.territoriPer[k]}</b>/${p.soglia}${p.carte[k] ? ` · 🃏${p.carte[k]}` : ''}</span>`).join('');
      return `<div class="cq"><div class="cq-legenda">${legenda}</div><div class="cq-cornice">${window.Lente.html('conquista', mappa, { max: 2.6, alto: '46vh' })}</div>${info}${comandi}${dadi}</div>`;
    },
    dopo(ctx) {
      const p = ctx.partita, at = p.attacco;
      if (at && primaVolta(ctx.ui, `cq-a-${p.evento ? p.evento.id : 0}-${at.da}-${at.a}-${at.perseA}-${at.perseD}`)) suono(at.conquistato ? [[440, 0.08], [660, 0.12]] : [[180, 0.05], [140, 0.05]], { tipo: 'triangle', volume: 0.05 });
    },
    stato(ctx) { const p = ctx.partita; if (p.finita || p.turno !== ctx.mio) return null; return { rinforzi: 'Metti i rinforzi', attacco: 'Attacca!', occupa: 'Occupa il territorio', spostamento: 'Sposta le armate' }[p.fase]; },
    punteggio(ctx) { const p = ctx.partita; return `<span class="obiettivo">giro ${p.giro} · obiettivo ${p.soglia} territori</span>`; },
    infoPosto(ctx, posto) { const p = ctx.partita; return p.fuori.includes(posto) ? 'fuori' : `${p.territoriPer[posto]} territori · +${p.rinforziPer[posto]}`; },
    clic(ctx, el) {
      const az = el.dataset.az, ui = ctx.ui, p = ctx.partita;
      if (az === 'quanti') { ui.quanti = Number(el.dataset.q); return ctx.ridisegna(); }
      if (az === 'carte') return ctx.invia({ tipo: 'carte' });
      if (az === 'modo') { ui.fino = el.dataset.f === '1'; return ctx.ridisegna(); }
      if (az === 'fineAttacchi') { ui.sel = null; return ctx.invia({ tipo: 'fineAttacchi' }); }
      if (az === 'occupa') return ctx.invia({ tipo: 'occupa', quanti: Number(el.dataset.q) });
      if (az === 'fine') { ui.sel = null; ui.dest = null; return ctx.invia({ tipo: 'fine' }); }
      if (az === 'sposta') { const da = ui.sel, a = ui.dest; ui.sel = null; ui.dest = null; return ctx.invia({ tipo: 'sposta', da, a, quanti: Number(el.dataset.q) }); }
      if (az === 'terr') {
        const t = Number(el.dataset.t);
        if (p.fase === 'rinforzi') { suono([[500, 0.04]], { tipo: 'sine', volume: 0.04 }); return ctx.invia({ tipo: 'metti', t, quanti: ui.quanti || 1 }); }
        if (p.fase === 'attacco') {
          if (p.padrone[t] === ctx.mio) { ui.sel = ui.sel === t ? null : t; return ctx.ridisegna(); }
          if (ui.sel != null) return ctx.invia({ tipo: 'attacca', da: ui.sel, a: t, fino: !!ui.fino });
        }
        if (p.fase === 'spostamento') {
          if (ui.sel == null || !(p.collegati[ui.sel] || []).includes(t)) { ui.sel = ui.sel === t ? null : t; return ctx.ridisegna(); }
          ui.dest = t; return ctx.ridisegna();
        }
      }
      return undefined;
    },
  };
  Object.assign(window.Tavoli, { conquista: tavolo });
})();
