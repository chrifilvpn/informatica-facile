// FILETTO (MULINO): tavoliere di legno in SVG con i tre quadrati, pedine bianche e nere con l'ombra. Ai lati le
// pedine ancora da piazzare. Clic su un punto libero per piazzare; poi clic su una propria pedina e sull'arrivo.
// L'ultima mossa è segnata (anello e freccia tratteggiata), il mulino appena chiuso si illumina d'oro.
(() => {
  const { esc, primaVolta, suono, ritardo } = window.Nuovi;
  const COORD = [
    [0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2],
    [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6],
  ];
  const X = (i) => 60 + COORD[i][0] * 100, Y = (i) => 60 + COORD[i][1] * 100;
  const NOMI = 'a7 d7 g7 b6 d6 f6 c5 d5 e5 a4 b4 c4 e4 f4 g4 c3 d3 e3 b2 d2 f2 a1 d1 g1'.split(' ');

  function defs() {
    return `<defs>
      <radialGradient id="mul-g-bianco" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#ebe6da"/><stop offset="1" stop-color="#bdb5a3"/></radialGradient>
      <radialGradient id="mul-g-nero" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#6a6a6a"/><stop offset=".5" stop-color="#262626"/><stop offset="1" stop-color="#050505"/></radialGradient>
      <linearGradient id="mul-legno" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6bf83"/><stop offset=".5" stop-color="#d5a560"/><stop offset="1" stop-color="#c08a45"/></linearGradient>
      <filter id="mul-ombra" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".45"/></filter>
    </defs>`;
  }
  // venature del legno (sempre uguali)
  const VENATURE = Array.from({ length: 14 }, (_, k) => {
    const y = 30 + k * 50 + ((k * 37) % 17);
    return `<path d="M10 ${y} C 200 ${y - 14 + (k % 3) * 9}, 480 ${y + 16 - (k % 4) * 6}, 710 ${y - 4}" />`;
  }).join('');

  function pedina(i, col, cls = '', stile = '') {
    return `<g class="mul-ped ${cls}" style="${stile}" transform="translate(${X(i)} ${Y(i)})"><circle r="30" fill="url(#mul-g-${col})" filter="url(#mul-ombra)"/><circle r="19" class="mul-anello-${col}"/></g>`;
  }

  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const io = ctx.mio, avv = 1 - io;
      const mio = p.turno === io && !p.finita;
      const m = mio ? p.mosse : null;
      if (!mio || !m || m.tipo !== 'muovi' || !(ui.sel in m.da)) ui.sel = null;
      // l'unica pedina che si può muovere si sceglie da sola
      if (mio && m && m.tipo === 'muovi' && ui.sel == null) { const k = Object.keys(m.da); if (k.length === 1) ui.sel = Number(k[0]); }
      const chiave = `mul-${p.nMosse}-${p.tolta ? p.tolta.punto : ''}`;
      const st = ritardo(ui, chiave);
      const u = p.ultima;
      const linee = `<rect x="60" y="60" width="600" height="600"/><rect x="160" y="160" width="400" height="400"/><rect x="260" y="260" width="200" height="200"/>
        <path d="M360 60V260M360 460V660M60 360H260M460 360H660"/>`;
      let sotto = '', sopra = '';
      // ultima mossa: freccia tratteggiata dalla partenza all'arrivo
      if (u && u.da != null) sotto += `<line class="mul-scia" x1="${X(u.da)}" y1="${Y(u.da)}" x2="${X(u.a)}" y2="${Y(u.a)}" style="${st}"/><circle class="mul-partenza" cx="${X(u.da)}" cy="${Y(u.da)}" r="13"/>`;
      if (p.mulino && !p.finita) {
        const [a, , c] = p.mulino;
        sotto += `<line class="mul-mulino" x1="${X(a)}" y1="${Y(a)}" x2="${X(c)}" y2="${Y(c)}" style="${st}"/>`;
      }
      const puntiOk = new Set(m && (m.tipo === 'metti' || m.tipo === 'togli') ? m.punti : []);
      const dest = new Set(m && m.tipo === 'muovi' && ui.sel != null ? m.da[ui.sel] : []);
      const scegli = new Set(m && m.tipo === 'muovi' ? Object.keys(m.da).map(Number) : []);
      const punti = COORD.map((_, i) => `<circle class="mul-foro" cx="${X(i)}" cy="${Y(i)}" r="9"/>`).join('');
      let pedine = '', bersagli = '';
      p.celle.forEach((v, i) => {
        let cls = '', extra = '';
        if (v !== null) {
          if (u && u.a === i) { cls += ' nuova'; extra = st; }
          if (m && m.tipo === 'togli' && puntiOk.has(i)) cls += ' togli';
          if (scegli.has(i)) cls += ' mobile';
          if (ui.sel === i) cls += ' scelta';
          if (p.mulino && p.mulino.includes(i) && !p.finita) cls += ' in-mulino';
          pedine += pedina(i, p.colori[v], cls, extra);
          if (u && u.a === i) sopra += `<circle class="mul-ultima" cx="${X(i)}" cy="${Y(i)}" r="38"/>`;
        } else if (puntiOk.has(i) && m.tipo === 'metti') {
          sopra += `<circle class="mul-puo" cx="${X(i)}" cy="${Y(i)}" r="11"/>`;
        } else if (dest.has(i)) {
          sopra += `<circle class="mul-puo dest" cx="${X(i)}" cy="${Y(i)}" r="13"/>`;
        }
        const vuotaOk = v === null && (dest.has(i) || (puntiOk.has(i) && m.tipo === 'metti'));
        const attivo = mio && (puntiOk.has(i) || dest.has(i) || scegli.has(i));
        const nome = `${NOMI[i]}${v !== null ? `, pedina ${p.colori[v]}a` : ''}`;
        const fantasma = vuotaOk ? `<circle class="mul-fantasma" r="30" fill="url(#mul-g-${p.colori[io]})"/>` : '';
        bersagli += `<g class="mul-bersaglio ${attivo ? 'attivo' : ''}" transform="translate(${X(i)} ${Y(i)})" data-az="punto" data-i="${i}" ${attivo ? 'tabindex="0" role="button"' : ''} aria-label="${nome}">${fantasma}<circle class="mul-tocco" r="44"/></g>`;
      });
      // pedina appena tolta: svanisce
      if (p.tolta) sopra += `<g class="mul-svanisce" style="${st}" transform="translate(${X(p.tolta.punto)} ${Y(p.tolta.punto)})"><circle r="30" fill="url(#mul-g-${p.colori[1 - p.tolta.posto]})"/></g>`;
      const svg = `<svg class="mul-tavola ${mio ? 'mio' : ''}" viewBox="0 0 720 720" role="group" aria-label="Tavoliere del filetto">${defs()}
        <rect class="mul-legno" x="4" y="4" width="712" height="712" rx="26" fill="url(#mul-legno)"/>
        <g class="mul-venature">${VENATURE}</g>
        <rect class="mul-cornice" x="16" y="16" width="688" height="688" rx="18"/>
        <g class="mul-linee">${linee}</g>${punti}${sotto}${pedine}${sopra}${bersagli}</svg>`;

      const riserva = (k) => {
        const n = p.mano[k];
        const pile = Array.from({ length: 9 }, (_, j) => `<span class="mul-mini ${p.colori[k]} ${j < n ? '' : 'vuota'}"></span>`).join('');
        const fase = p.finita ? '' : p.fasi[k] === 'piazza' ? `${n} da piazzare` : p.fasi[k] === 'vola' ? '🕊️ vola!' : 'muove';
        return `<div class="mul-giocatore ${p.turno === k ? 'di-turno' : ''} ${k === io ? 'io' : ''}">
          <div class="mul-chi"><span class="mul-mini ${p.colori[k]}"></span><b>${esc(k === io ? 'Tu' : ctx.nome(k))}</b></div>
          <div class="mul-pile" aria-label="${n} pedine in mano">${pile}</div>
          <div class="mul-conti"><span>Sul tavoliere <strong>${p.sulTavolo[k]}</strong></span><span class="mul-fase">${fase}</span></div>
        </div>`;
      };
      let msg;
      if (p.finita) msg = p.risultato.pareggio ? `Patta: ${esc(p.motivo || '')}` : p.risultato.vincitori[0] === io ? `Hai vinto! 🎉 L'avversario ${esc(p.motivo || '')}` : `Vince ${esc(ctx.nome(p.risultato.vincitori[0]))}: ${esc(p.motivo || '')}`;
      else if (!mio) msg = p.daTogliere ? `${esc(ctx.nome(p.turno))} ha fatto mulino e sceglie cosa toglierti…` : `${esc(ctx.nome(p.turno))} ci pensa…`;
      else if (m.tipo === 'togli') msg = '<b>Mulino!</b> Togli una pedina dell\'avversario (quelle che lampeggiano)';
      else if (m.tipo === 'metti') msg = `Tocca a te: metti una pedina in un punto libero <small>(${p.mano[io]} in mano)</small>`;
      else if (ui.sel != null) msg = p.fasi[io] === 'vola' ? 'Scegli dove volare: qualsiasi punto libero' : 'Scegli dove spostarla (o un\'altra pedina)';
      else msg = p.fasi[io] === 'vola' ? 'Hai 3 pedine: scegli quale far volare' : 'Tocca a te: scegli una pedina da spostare';
      const patta = !p.finita && p.mano[0] === 0 && p.mano[1] === 0 && p.senzaMulino >= 60 ? `<p class="mul-nota">Senza mulini da ${Math.floor(p.senzaMulino / 2)} mosse a testa (a 50 è patta)</p>` : '';
      const annulla = p.puoAnnullare ? `<button type="button" class="bottone piccolo-bt" data-az="annullaMossa">↶ Annulla mossa${p.annullate ? ` <small>(${p.annullate})</small>` : ''}</button>` : '';
      return `<div class="mul">
        <div class="mul-campo">${riserva(avv)}<div class="mul-centro">${svg}</div>${riserva(io)}</div>
        <p class="pa-msg mul-msg ${mio ? 'mio' : ''}" aria-live="polite">${msg}</p>${patta}${annulla}</div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.nMosse && primaVolta(ctx.ui, `mul-s-${p.nMosse}-${p.tolta ? p.tolta.punto : ''}`)) {
        if (p.tolta) suono([[300, 0.08], [200, 0.14]], { tipo: 'sawtooth', volume: 0.04 });
        else if (p.mulino) suono([[523, 0.08], [659, 0.08], [784, 0.16]], { tipo: 'triangle', volume: 0.06 });
        else suono([[p.ultima && p.ultima.posto === ctx.mio ? 330 : 260, 0.06]], { tipo: 'triangle', volume: 0.06 });
      }
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita || p.turno == null) return null;
      const col = p.colori[p.turno] === 'nero' ? '(neri)' : '(bianchi)';
      if (p.daTogliere) return p.turno === ctx.mio ? 'Mulino! Togli una pedina dell’avversario' : `${ctx.nome(p.turno)} fa mulino`;
      return p.turno === ctx.mio ? `Tocca a te ${col}` : `Tocca a ${ctx.nome(p.turno)} ${col}`;
    },
    punteggio() { return ''; },
    infoPosto(ctx, posto) {
      const p = ctx.partita;
      return `${p.colori[posto] === 'nero' ? '<span class="pedina-segno nero"></span>' : '<span class="pedina-segno bianco"></span>'} ${p.sulTavolo[posto]} sul tavoliere${p.mano[posto] ? `, ${p.mano[posto]} in mano` : ''}`;
    },
    clic(ctx, el) {
      const p = ctx.partita, ui = ctx.ui;
      if (el.dataset.az === 'annullaMossa') return ctx.invia({ tipo: 'annulla' });
      if (el.dataset.az !== 'punto' || p.turno !== ctx.mio || p.finita) return;
      const i = Number(el.dataset.i), m = p.mosse;
      if (!m) return;
      if (m.tipo === 'metti') { if (m.punti.includes(i)) ctx.invia({ tipo: 'metti', punto: i }); return; }
      if (m.tipo === 'togli') {
        if (m.punti.includes(i)) ctx.invia({ tipo: 'togli', punto: i });
        else if (p.celle[i] === 1 - ctx.mio) ctx.avviso('Questa pedina è in un mulino: scegline un\'altra');
        return;
      }
      if (ui.sel != null && m.da[ui.sel] && m.da[ui.sel].includes(i)) { ctx.invia({ tipo: 'muovi', da: ui.sel, a: i }); ui.sel = null; return; }
      if (m.da[i]) ui.sel = ui.sel === i && Object.keys(m.da).length > 1 ? null : i;
      else if (p.celle[i] === ctx.mio) ctx.avviso('Questa pedina è bloccata');
      else ui.sel = Object.keys(m.da).length === 1 ? ui.sel : null;
      ctx.ridisegna();
    },
  };
  Object.assign(window.Tavoli, { mulino: tavolo });
})();
