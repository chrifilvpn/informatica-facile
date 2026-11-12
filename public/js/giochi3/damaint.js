// DAMA INTERNAZIONALE: damiera 10×10 di legno, pedine bianche e nere con la corona per le dame. I propri pezzi stanno
// sempre in basso (la damiera si gira per il nero). Si tocca un pezzo che può muovere e poi la casella d'arrivo; il
// percorso dell'ultima mossa resta segnato, con le caselle dei pezzi mangiati.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const L = 10;
  const di = (v) => (v === 1 || v === 2 ? 0 : v === 3 || v === 4 ? 1 : -1);
  const nome = (i) => `${'abcdefghij'[i % L]}${L - Math.floor(i / L)}`;
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const mio = p.turno === ctx.mio && !p.finita && !ctx.stato.spettatore;
      const mioCol = ctx.mio === p.bianco ? 0 : 1;
      const giro = mioCol === 1; // il nero vede la damiera girata
      const daMuovere = new Set(mio ? p.mosse.map((m) => m.da) : []);
      if (ui.sel != null && !daMuovere.has(ui.sel)) ui.sel = null;
      const dest = new Map();
      if (ui.sel != null) for (const m of p.mosse) if (m.da === ui.sel) dest.set(m.a, (dest.get(m.a) || []).concat(m));
      const u = p.ultima, via = new Set(u ? u.via : []), prese = new Set(u ? u.prese : []);
      let celle = '';
      for (let k = 0; k < L * L; k++) {
        const i = giro ? L * L - 1 - k : k, r = Math.floor(i / L), c = i % L, scura = (r + c) % 2 === 1;
        if (!scura) { celle += '<div class="di-c chiara"></div>'; continue; }
        const v = p.b[i];
        const cls = ['di-c', 'scura', via.has(i) ? 'via' : '', prese.has(i) ? 'presa' : '', ui.sel === i ? 'sel' : '', dest.has(i) ? 'dest' : ''].filter(Boolean).join(' ');
        let dentro = '';
        if (v) dentro = `<span class="di-pz ${di(v) === 0 ? 'bianca' : 'nera'} ${v === 2 || v === 4 ? 'dama' : ''} ${daMuovere.has(i) ? 'puo' : ''}">${v === 2 || v === 4 ? '♛' : ''}</span>`;
        else if (dest.has(i)) dentro = '<i class="di-punto"></i>';
        const az = daMuovere.has(i) ? `data-az="pezzo" data-i="${i}"` : dest.has(i) ? `data-az="vai" data-i="${i}"` : '';
        celle += `<div class="${cls}" ${az} aria-label="${nome(i)}">${dentro}</div>`;
      }
      const lettere = Array.from({ length: L }, (_, k) => 'abcdefghij'[giro ? L - 1 - k : k]);
      // scelta tra prese diverse che arrivano nella stessa casella
      const scelta = ui.scelta ? `<div class="di-scelta"><p>Due prese diverse arrivano lì: quale fai?</p>${ui.scelta.map((m, k) => `<button type="button" class="bottone" data-az="scegli" data-k="${k}">via ${m.via.slice(1, -1).map(nome).join(', ') || nome(m.a)} · mangi ${m.prese.map(nome).join(', ')}</button>`).join('')}</div>` : '';
      const conto = (k) => { const x = p.pezzi[k], bianca = k === p.bianco; return `<span class="ot-conto ${p.turno === k ? 'di-turno' : ''}"><i class="di-mini ${bianca ? 'bianca' : 'nera'}"></i><b>${esc(k === ctx.mio ? 'Tu' : ctx.nome(k))}</b> <strong>${x.pedine}</strong>${x.dame ? ` <small>+ ${x.dame} ♛</small>` : ''}</span>`; };
      let msg;
      if (p.finita) msg = p.risultato.pareggio ? 'Pareggio!' : p.risultato.vincitori[0] === ctx.mio ? 'Hai vinto! 🎉' : `Vince ${esc(ctx.nome(p.risultato.vincitori[0]))}`;
      else if (mio) msg = p.mosse.length && p.mosse[0].prese.length ? `Devi mangiare: ${p.mosse[0].prese.length} ${p.mosse[0].prese.length === 1 ? 'pezzo' : 'pezzi'} (la presa più lunga)` : 'Tocca a te: scegli un pezzo';
      else msg = `${esc(ctx.nome(p.turno))} ci pensa…`;
      const annulla = p.puoAnnullare ? `<button type="button" class="bottone piccolo-bt" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>` : '';
      return `<div class="di"><div class="ot-punti">${conto(ctx.mio)}<span class="ot-vs">–</span>${conto(1 - ctx.mio)}</div>
        <div class="di-cornice"><div class="di-tavola">${celle}</div><div class="di-lettere">${lettere.map((x) => `<span>${x}</span>`).join('')}</div></div>
        ${scelta}<p class="pa-msg ot-msg" aria-live="polite">${msg}</p>${annulla}</div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.ultima && primaVolta(ctx.ui, `di-${p.nMosse}`)) suono(p.ultima.prese.length ? p.ultima.prese.map((_, k) => [500 + k * 60, 0.05]) : [[300, 0.05]], { tipo: 'triangle', volume: 0.05 });
    },
    stato(ctx) { const p = ctx.partita; if (p.finita || p.turno == null) return null; return p.turno === ctx.mio ? 'Tocca a te' : `Tocca a ${ctx.nome(p.turno)}`; },
    punteggio() { return ''; },
    infoPosto(ctx, posto) { const x = ctx.partita.pezzi[posto]; return `${posto === ctx.partita.bianco ? '<span class="pedina-segno bianco"></span>' : '<span class="pedina-segno nero"></span>'} ${x.pedine} pedine${x.dame ? ` · ${x.dame} dame` : ''}`; },
    clic(ctx, el) {
      const az = el.dataset.az, ui = ctx.ui, p = ctx.partita;
      if (az === 'annullaMossa') { ui.sel = null; ui.scelta = null; return ctx.invia({ tipo: 'annulla' }); }
      if (az === 'pezzo') { const i = Number(el.dataset.i); ui.sel = ui.sel === i ? null : i; ui.scelta = null; return ctx.ridisegna(); }
      if (az === 'vai') {
        const a = Number(el.dataset.i), lista = p.mosse.filter((m) => m.da === ui.sel && m.a === a);
        if (lista.length > 1) { ui.scelta = lista; return ctx.ridisegna(); }
        if (lista.length) { ui.sel = null; ui.scelta = null; return ctx.invia({ tipo: 'muovi', mossa: lista[0].k }); }
      }
      if (az === 'scegli' && ui.scelta) { const m = ui.scelta[Number(el.dataset.k)]; ui.sel = null; ui.scelta = null; return ctx.invia({ tipo: 'muovi', mossa: m.k }); }
      return undefined;
    },
  };
  Object.assign(window.Tavoli, { damaint: tavolo });
})();
