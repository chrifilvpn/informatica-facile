// SCACCHI CINESI: la scacchiera di legno con le linee, il fiume in mezzo e le diagonali dei palazzi, disegnata in SVG.
// I pezzi sono dischi con un disegno (o, a scelta, la sigla italiana o il carattere cinese). I propri pezzi stanno sempre in basso.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const C = 9, R = 10;
  const ITA = { 1: 'Gen', 2: 'Cons', 3: 'Ele', 4: 'Cav', 5: 'Car', 6: 'Can', 7: 'Sol' };
  const NOMI = { 1: 'generale', 2: 'consigliere', 3: 'elefante', 4: 'cavallo', 5: 'carro', 6: 'cannone', 7: 'soldato' };
  // disegni dei pezzi in un riquadro 24×24: .p = pieno del colore del pezzo, .l = solo linea, .c = dettaglio chiaro
  const DISEGNI = {
    1: '<path class="p" d="M4 17 3 7.5l5 4.5 4-7 4 7 5-4.5-1 9.5z"/><path class="p" d="M4 18.6h16v2.6H4z"/><circle class="c" cx="12" cy="13" r="1.4"/>',
    2: '<path class="p" d="M12 20.5 2.6 9.8a12.5 12.5 0 0 1 18.8 0z"/><path class="c-l" d="M12 20.5 6.2 6.3M12 20.5 12 4.6M12 20.5 17.8 6.3"/><circle class="p" cx="12" cy="20.3" r="1.6"/>',
    3: '<ellipse class="p" cx="5.6" cy="10" rx="3.6" ry="5"/><ellipse class="p" cx="18.4" cy="10" rx="3.6" ry="5"/><circle class="p" cx="12" cy="9.6" r="5.4"/><path class="l" d="M12 13.5c0 3.5.8 5.6-1.4 7.3" stroke-width="3" stroke-linecap="round"/><path class="c-l" d="M9.4 13.4 8.6 16.4M14.6 13.4l.8 3"/><circle class="c" cx="10" cy="8.6" r=".9"/><circle class="c" cx="14" cy="8.6" r=".9"/>',
    4: '<path class="p" d="M7 21.2c.4-3.3 1.6-5 3.4-6.3-1.8.2-3.5.9-4.8 2.2L4 14.6c1.8-3.4 3.8-6.2 6.2-8.2L10 3.4l2.4 2C17.4 5.6 20.4 9.6 20 21.2z"/><circle class="c" cx="11.2" cy="9.2" r="1"/><path class="c-l" d="M14.6 7.8c1.8 2 2.6 5.2 2.6 9"/>',
    5: '<path class="p" d="M4.5 6.5h15v8h-15z"/><path class="l" d="M7 6.5V4M17 6.5V4M4.5 10.5h15"/><circle class="p" cx="7.5" cy="17.4" r="3.4"/><circle class="p" cx="16.5" cy="17.4" r="3.4"/><circle class="c" cx="7.5" cy="17.4" r="1.1"/><circle class="c" cx="16.5" cy="17.4" r="1.1"/>',
    6: '<path class="p" d="M3.2 14.4 18.3 6.2l2 3.7-15 8.2z"/><path class="c-l" d="M8.2 11.7l2 3.7"/><circle class="p" cx="8.6" cy="17.3" r="3.6"/><circle class="c" cx="8.6" cy="17.3" r="1.2"/><circle class="p" cx="20.2" cy="19.4" r="1.7"/>',
    7: '<path class="l" d="M17.5 5.5v16" stroke-width="1.8"/><path class="p" d="M17.5 1.8l2.4 4.4h-4.8z"/><path class="p" d="M4 7.5h9.4v6.2c0 3.6-2.3 5.8-4.7 7-2.4-1.2-4.7-3.4-4.7-7z"/><path class="c-l" d="M8.7 9.3v9.4M5.8 12.4h5.8"/>',
  };
  const CIN = { 1: ['帥', '將'], 2: ['仕', '士'], 3: ['相', '象'], 4: ['傌', '馬'], 5: ['俥', '車'], 6: ['炮', '砲'], 7: ['兵', '卒'] };
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const mio = p.turno === ctx.mio && !p.finita && !ctx.stato.spettatore;
      const mioCol = ctx.mio === p.rosso ? 0 : 1, giro = mioCol === 1;
      const S = 40, M = 30; // passo e margine
      const pos = (i) => { let r = Math.floor(i / C), c = i % C; if (giro) { r = R - 1 - r; c = C - 1 - c; } return [M + c * S, M + r * S]; };
      const W = M * 2 + (C - 1) * S, H = M * 2 + (R - 1) * S;
      const daMuovere = new Set(mio ? p.mosse.map((m) => m[0]) : []);
      if (ui.sel != null && !daMuovere.has(ui.sel)) ui.sel = null;
      const dest = new Set(ui.sel != null ? p.mosse.filter((m) => m[0] === ui.sel).map((m) => m[1]) : []);
      // linee: orizzontali intere, verticali interrotte dal fiume (tranne i bordi), diagonali dei palazzi
      let linee = '';
      for (let r = 0; r < R; r++) linee += `<line x1="${M}" y1="${M + r * S}" x2="${M + (C - 1) * S}" y2="${M + r * S}"/>`;
      for (let c = 0; c < C; c++) {
        if (c === 0 || c === C - 1) linee += `<line x1="${M + c * S}" y1="${M}" x2="${M + c * S}" y2="${M + (R - 1) * S}"/>`;
        else linee += `<line x1="${M + c * S}" y1="${M}" x2="${M + c * S}" y2="${M + 4 * S}"/><line x1="${M + c * S}" y1="${M + 5 * S}" x2="${M + c * S}" y2="${M + (R - 1) * S}"/>`;
      }
      for (const r0 of [0, 7]) linee += `<line x1="${M + 3 * S}" y1="${M + r0 * S}" x2="${M + 5 * S}" y2="${M + (r0 + 2) * S}"/><line x1="${M + 5 * S}" y1="${M + r0 * S}" x2="${M + 3 * S}" y2="${M + (r0 + 2) * S}"/>`;
      const fiume = `<text class="xq-fiume" x="${M + 2 * S}" y="${M + 4.5 * S + 6}">fiume</text><text class="xq-fiume" x="${M + 6 * S}" y="${M + 4.5 * S + 6}">${p.simboli === 'cinesi' ? '楚河 漢界' : '~ ~ ~'}</text>`;
      let pezzi = '';
      const u = p.ultima;
      if (u) { const [x1, y1] = pos(u.da), [x2, y2] = pos(u.a); pezzi += `<circle class="xq-orma" cx="${x1}" cy="${y1}" r="6"/><circle class="xq-arrivo" cx="${x2}" cy="${y2}" r="19"/>`; }
      for (let i = 0; i < C * R; i++) {
        const v = p.b[i], [x, y] = pos(i);
        if (v) {
          const t = Math.abs(v), col = v > 0 ? 0 : 1;
          const testo = p.simboli === 'cinesi' ? CIN[t][col] : ITA[t];
          const segno = p.simboli === 'disegni' ? `<svg class="xq-ico" x="${x - 10.5}" y="${y - 10.5}" width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">${DISEGNI[t]}</svg>`
            : `<text x="${x}" y="${y + (p.simboli === 'cinesi' ? 6 : 4)}" class="${p.simboli === 'cinesi' ? 'cin' : testo.length > 3 ? 'lungo' : ''}">${testo}</text>`;
          const cls = ['xq-pz', col === 0 ? 'rosso' : 'nero', daMuovere.has(i) ? 'puo' : '', ui.sel === i ? 'sel' : '', dest.has(i) ? 'preda' : '', p.scacco != null && t === 1 && ((col === 0) === (p.scacco === p.rosso)) ? 'scacco' : ''].filter(Boolean).join(' ');
          const az = daMuovere.has(i) ? `data-az="pezzo" data-i="${i}"` : dest.has(i) ? `data-az="vai" data-i="${i}"` : '';
          pezzi += `<g class="${cls}" ${az}><title>${NOMI[t]} ${col === 0 ? 'rosso' : 'nero'}</title><circle cx="${x}" cy="${y}" r="17"/><circle class="anello" cx="${x}" cy="${y}" r="14"/>${segno}</g>`;
        } else if (dest.has(i)) pezzi += `<g data-az="vai" data-i="${i}" class="xq-dest"><circle cx="${x}" cy="${y}" r="16" class="presa"/><circle cx="${x}" cy="${y}" r="6"/></g>`;
      }
      const svg = `<svg class="xq-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scacchiera degli scacchi cinesi"><rect class="xq-legno" x="2" y="2" width="${W - 4}" height="${H - 4}" rx="10"/><g class="xq-linee">${linee}</g>${fiume}${pezzi}</svg>`;
      const conto = (k) => `<span class="ot-conto ${p.turno === k ? 'di-turno' : ''}"><i class="xq-mini ${k === p.rosso ? 'rosso' : 'nero'}"></i><b>${esc(k === ctx.mio ? 'Tu' : ctx.nome(k))}</b>${p.catturati[k === p.rosso ? 0 : 1].length ? ` <small>ha mangiato ${p.catturati[k === p.rosso ? 0 : 1].length}</small>` : ''}</span>`;
      let msg;
      if (p.finita) msg = p.risultato.pareggio ? 'Pareggio!' : p.risultato.vincitori[0] === ctx.mio ? 'Hai vinto! 🎉' : `Vince ${esc(ctx.nome(p.risultato.vincitori[0]))}`;
      else if (mio) msg = p.scacco === ctx.mio ? '⚠️ Il tuo generale è sotto scacco!' : ui.sel != null ? 'Scegli dove andare (puntini verdi; i cerchi rossi mangiano)' : 'Tocca a te: scegli un pezzo';
      else msg = `${esc(ctx.nome(p.turno))} ci pensa…`;
      const annulla = p.puoAnnullare ? `<button type="button" class="bottone piccolo-bt" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>` : '';
      return `<div class="xq"><div class="ot-punti">${conto(ctx.mio)}<span class="ot-vs">–</span>${conto(1 - ctx.mio)}</div>${svg}
        <p class="pa-msg ot-msg ${p.scacco === ctx.mio && mio ? 'xq-allarme' : ''}" aria-live="polite">${msg}</p>${annulla}</div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.ultima && primaVolta(ctx.ui, `xq-${p.nMosse}`)) suono([[p.scacco != null ? 660 : 300, 0.06]], { tipo: 'triangle', volume: 0.05 });
    },
    stato(ctx) { const p = ctx.partita; if (p.finita || p.turno == null) return null; return p.turno === ctx.mio ? (p.scacco === ctx.mio ? 'Tocca a te: sei sotto scacco!' : 'Tocca a te') : `Tocca a ${ctx.nome(p.turno)}`; },
    punteggio() { return ''; },
    infoPosto(ctx, posto) { return posto === ctx.partita.rosso ? '<span class="pedina-segno rosso"></span> rosso' : '<span class="pedina-segno nero"></span> nero'; },
    clic(ctx, el) {
      const az = el.dataset.az, ui = ctx.ui;
      if (az === 'annullaMossa') { ui.sel = null; return ctx.invia({ tipo: 'annulla' }); }
      if (az === 'pezzo') { const i = Number(el.dataset.i); ui.sel = ui.sel === i ? null : i; return ctx.ridisegna(); }
      if (az === 'vai' && ui.sel != null) { const da = ui.sel; ui.sel = null; return ctx.invia({ tipo: 'muovi', da, a: Number(el.dataset.i) }); }
      return undefined;
    },
  };
  Object.assign(window.Tavoli, { xiangqi: tavolo });
})();
