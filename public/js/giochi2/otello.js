// REVERSI: la damiera verde con le pedine bianche e nere. Le caselle dove si può mettere hanno un puntino; le pedine
// girate dall'ultima mossa ruotano una dopo l'altra (dalla più vicina alla più lontana).
(() => {
  const { esc, primaVolta, suono, ritardo } = window.Nuovi;
  const L = 8;
  const dist = (a, b) => Math.max(Math.abs(Math.floor(a / L) - Math.floor(b / L)), Math.abs((a % L) - (b % L)));
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const mio = p.turno === ctx.mio && !p.finita;
      const possibili = new Set(mio ? p.mosse : []);
      const girate = new Set(p.girate || []);
      const st = ritardo(ui, `ot-${p.nMosse}-${p.ultima}`);
      const celle = p.celle.map((v, i) => {
        let dentro = '';
        if (v !== null) {
          const col = p.colori[v];
          const gira = girate.has(i), nuova = p.ultima === i;
          const cls = gira ? 'gira' : nuova ? 'nuova' : '';
          const stile = gira ? `${st};--k:${dist(i, p.ultima)};--da:var(--ot-${col === 'nero' ? 'bianco' : 'nero'})` : nuova ? st : '';
          dentro = `<span class="ot-ped ${col} ${cls}" style="${stile}"></span>${nuova ? '<i class="ot-ultima"></i>' : ''}`;
        }
        const r = Math.floor(i / L), c = i % L;
        const nome = `${'abcdefgh'[c]}${r + 1}`;
        if (possibili.has(i)) return `<button type="button" class="ot-cella puo" data-az="metti" data-i="${i}" aria-label="Metti in ${nome}"><span class="ot-ped fantasma ${p.colori[ctx.mio]}"></span></button>`;
        return `<div class="ot-cella" aria-label="${nome}${v !== null ? ` ${p.colori[v]}` : ''}">${dentro}</div>`;
      }).join('');
      const [a, b] = [ctx.mio, 1 - ctx.mio];
      const conto = (k) => `<span class="ot-conto ${p.turno === k ? 'di-turno' : ''}"><span class="ot-ped mini ${p.colori[k]}"></span><b>${esc(k === ctx.mio ? 'Tu' : ctx.nome(k))}</b> <strong>${p.conteggio[k]}</strong></span>`;
      let msg;
      if (p.finita) msg = p.risultato.pareggio ? 'Pareggio!' : p.risultato.vincitori[0] === ctx.mio ? 'Hai vinto! 🎉' : `Vince ${esc(ctx.nome(p.risultato.vincitori[0]))}`;
      else if (p.passato != null) msg = p.passato === ctx.mio ? 'Non avevi mosse: tocca ancora all\'avversario' : `${esc(ctx.nome(p.passato))} passa: tocca ancora a te`;
      else msg = mio ? `Tocca a te · ${p.mosse.length} ${p.mosse.length === 1 ? 'casella possibile' : 'caselle possibili'}` : `${esc(ctx.nome(p.turno))} ci pensa…`;
      const annulla = p.puoAnnullare ? `<button type="button" class="bottone piccolo-bt" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>` : '';
      return `<div class="ot">
        <div class="ot-punti">${conto(a)}<span class="ot-vs">–</span>${conto(b)}</div>
        <div class="ot-tavola ${mio ? 'mio' : ''}">${celle}</div>
        <p class="pa-msg ot-msg" aria-live="polite">${msg}</p>${annulla}</div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.ultima != null && primaVolta(ctx.ui, `ot-s-${p.nMosse}-${p.ultima}`)) {
        suono([[p.turno === ctx.mio ? 330 : 440, 0.05], ...Array.from({ length: Math.min(p.girate.length, 6) }, (_, k) => [520 + k * 40, 0.03])], { tipo: 'triangle', volume: 0.05 });
      }
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.turno == null) return null;
      const col = p.colori[p.turno] === 'nero' ? '(neri)' : '(bianchi)';
      return p.turno === ctx.mio ? `Tocca a te ${col}` : `Tocca a ${ctx.nome(p.turno)} ${col}`;
    },
    // il conteggio delle pedine è già sopra la damiera, con chi deve muovere evidenziato
    punteggio() { return ''; },
    infoPosto(ctx, posto) { const p = ctx.partita; return `${p.colori[posto] === 'nero' ? '<span class="pedina-segno nero"></span>' : '<span class="pedina-segno bianco"></span>'} ${p.conteggio[posto]} pedine`; },
    clic(ctx, el) {
      if (el.dataset.az === 'annullaMossa') return ctx.invia({ tipo: 'annulla' });
      if (el.dataset.az !== 'metti') return;
      el.disabled = true;
      ctx.invia({ tipo: 'metti', cella: Number(el.dataset.i) });
    },
  };
  Object.assign(window.Tavoli, { otello: tavolo });
})();
