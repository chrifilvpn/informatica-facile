// HEX: la scacchiera a rombo disegnata in SVG, con i lati colorati di rosso (sopra e sotto) e di blu (sinistra e
// destra). Le pedine sono gemme lucide; l'ultima mossa ha un anellino; a fine partita la catena vincente si illumina.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const R3 = Math.sqrt(3);
  const COL = ['ros', 'blu']; // ruolo 0 = rosso (sopra-sotto), 1 = blu (sinistra-destra)
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, N = p.N, ui = ctx.ui;
      const mio = p.turno === ctx.mio && !p.finita && !ctx.stato.spettatore;
      const s = 10; // lato dell'esagono
      const w = R3 * s, h = 1.5 * s;
      const cx = (r, c) => (c + r / 2) * w + w, cy = (r) => r * h + s * 1.6;
      const W = (N + (N - 1) / 2) * w + 2 * w, H = (N - 1) * h + s * 3.2;
      const punti = (x, y, k = 1) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${(x + Math.cos(a) * s * k).toFixed(2)},${(y + Math.sin(a) * s * k).toFixed(2)}`; }).join(' ');
      const vincente = new Set(p.vincente || []);
      let celle = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const i = r * N + c, v = p.celle[i], x = cx(r, c), y = cy(r);
        const libera = v === null && mio;
        celle += `<polygon class="hx-cella ${libera ? 'puo' : ''} ${ui.sopra === i && libera ? 'sopra' : ''}" points="${punti(x, y)}" ${libera ? `data-az="metti" data-i="${i}"` : ''}/>`;
        if (v !== null) {
          const col = COL[p.ruolo[v]];
          celle += `<circle class="hx-ped ${col} ${vincente.has(i) ? 'vince' : ''}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(s * 0.68).toFixed(2)}"/>`;
          if (p.ultima === i) celle += `<circle class="hx-ultima" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(s * 0.25).toFixed(2)}"/>`;
        }
      }
      // i quattro bordi colorati (rosso sopra e sotto, blu a sinistra e a destra)
      const bordo = (lista, cls) => `<polyline class="hx-bordo ${cls}" points="${lista.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}"/>`;
      const sopra = [], sotto = [], sin = [], des = [];
      for (let c = 0; c < N; c++) { sopra.push([cx(0, c) - w / 2, cy(0) - s / 2 - 3], [cx(0, c), cy(0) - s - 3]); sotto.push([cx(N - 1, c) - w / 2, cy(N - 1) + s + 3], [cx(N - 1, c), cy(N - 1) + s / 2 + 3]); }
      for (let r = 0; r < N; r++) { sin.push([cx(r, 0) - w / 2 - 3, cy(r) - s / 2], [cx(r, 0) - w / 2 - 3, cy(r) + s / 2]); des.push([cx(r, N - 1) + w / 2 + 3, cy(r) - s / 2], [cx(r, N - 1) + w / 2 + 3, cy(r) + s / 2]); }
      sopra.push([cx(0, N - 1) + w / 2, cy(0) - s / 2 - 3]);
      const svg = `<svg class="hx-svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" role="img" aria-label="Scacchiera di Hex ${N} per ${N}">
        ${bordo(sopra, 'ros')}${bordo(sotto, 'ros')}${bordo(sin, 'blu')}${bordo(des, 'blu')}${celle}</svg>`;
      const io = p.ruolo[ctx.mio], chi = (k) => esc(k === ctx.mio ? 'Tu' : ctx.nome(k));
      const conto = (k) => `<span class="ot-conto ${p.turno === k ? 'di-turno' : ''}"><i class="hx-ped-mini ${COL[p.ruolo[k]]}"></i><b>${chi(k)}</b> <small title="${p.ruolo[k] === 0 ? 'sopra-sotto' : 'sinistra-destra'}">${p.ruolo[k] === 0 ? '↕' : '↔'}</small></span>`;
      let msg;
      if (p.finita) msg = p.risultato.vincitori[0] === ctx.mio ? 'Hai collegato i tuoi lati: hai vinto! 🎉' : `Vince ${esc(ctx.nome(p.risultato.vincitori[0]))}`;
      else if (p.puoScambiare) msg = 'Puoi mettere una pedina oppure prenderti la prima pedina rossa (scambio)';
      else msg = mio ? `Tocca a te: collega ${io === 0 ? 'sopra e sotto' : 'sinistra e destra'}` : `${esc(ctx.nome(p.turno))} ci pensa…`;
      const bottoni = `${p.puoScambiare ? '<button type="button" class="bottone" data-az="scambia">🔄 Scambia (prendi la prima pedina)</button>' : ''}${p.puoAnnullare ? `<button type="button" class="bottone piccolo-bt" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>` : ''}`;
      return `<div class="hx"><div class="ot-punti">${conto(ctx.mio)}<span class="ot-vs">–</span>${conto(1 - ctx.mio)}</div>
        <div class="hx-tavola">${window.Lente.html(`hex${N}`, svg, { max: N >= 11 ? 2.6 : 2, angolo: 'alto', alto: '52vh' })}</div><p class="pa-msg ot-msg" aria-live="polite">${msg}</p>${bottoni ? `<div class="nk-bottoni">${bottoni}</div>` : ''}</div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.ultima != null && primaVolta(ctx.ui, `hx-${p.nMosse}`)) suono([[p.turno === ctx.mio ? 330 : 440, 0.05]], { tipo: 'triangle', volume: 0.05 });
    },
    stato(ctx) { const p = ctx.partita; if (p.finita || p.turno == null) return null; return p.turno === ctx.mio ? 'Tocca a te' : `Tocca a ${ctx.nome(p.turno)}`; },
    punteggio() { return ''; },
    infoPosto(ctx, posto) { return ctx.partita.ruolo[posto] === 0 ? '<i class="hx-ped-mini ros"></i> sopra-sotto' : '<i class="hx-ped-mini blu"></i> sinistra-destra'; },
    clic(ctx, el) {
      if (el.dataset.az === 'annullaMossa') return ctx.invia({ tipo: 'annulla' });
      if (el.dataset.az === 'scambia') return ctx.invia({ tipo: 'scambia' });
      if (el.dataset.az !== 'metti') return;
      ctx.ui.sopra = null;
      ctx.invia({ tipo: 'metti', cella: Number(el.dataset.i) });
    },
  };
  Object.assign(window.Tavoli, { hex: tavolo });
})();
