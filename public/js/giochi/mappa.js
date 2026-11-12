// LA MAPPA NASCOSTA: griglia 5×5; la mia strada, i numeri scoperti, le mosse possibili e alla fine i nemici.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const COLORI = ['#e8453c', '#2f7fd8', '#2e9d57', '#d19a2a', '#8e55c9', '#e36fa5'];
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, io = ctx.mio;
      const possibili = new Set(p.possibili);
      const nemici = new Set(p.nemici || []);
      const fine = p.fase !== 'gioco' || p.finita;
      const celle = [];
      for (let c = 0; c < p.lato * p.lato; c++) {
        const num = p.numeri[c];
        const qui = p.pos === c;
        const segni = [];
        if (c === p.uscita) segni.push('<span class="mn-uscita">🚪</span>');
        if (c === p.partenza && !qui) segni.push('<span class="mn-partenza">🧭</span>');
        if (nemici.has(c)) segni.push('<span class="mn-nemico">👾</span>');
        if (fine) p.altri.forEach((a, i) => { if (a.strada && a.strada.includes(c)) segni.push(`<i class="mn-orma" style="--c:${COLORI[i % COLORI.length]}"></i>`); });
        if (qui) segni.push(`<span class="mn-io ${p.stato}" style="--c:${COLORI[io % COLORI.length]}">${p.stato === 'preso' ? '💥' : '🧍'}</span>`);
        const numero = num !== null && !nemici.has(c) ? `<b class="mn-num n${num}">${num}</b>` : '';
        const cls = ['mn-cella', num !== null ? 'vista' : '', p.strada.includes(c) ? 'strada' : '', possibili.has(c) ? 'mossa' : '', p.scelto === c ? 'scelta' : '', nemici.has(c) ? 'nemico' : ''].join(' ');
        celle.push(possibili.has(c)
          ? `<button type="button" class="${cls}" data-az="muovi" data-c="${c}" aria-label="Vai alla casella ${c + 1}">${numero}${segni.join('')}</button>`
          : `<div class="${cls}">${numero}${segni.join('')}</div>`);
      }
      let msg;
      if (p.finita) msg = 'Fine! Ecco dov\'erano i nemici e le strade di tutti.';
      else if (p.fase === 'riassunto') msg = `Mappa ${p.nMappa} finita: la strada più corta era di ${p.minima} mosse. Arriva la prossima…`;
      else if (p.stato === 'uscito') msg = '🚪 Sei uscito! Aspetta gli altri.';
      else if (p.stato === 'preso') msg = '👾 Preso! Aspetta gli altri.';
      else if (p.stato === 'fermo') msg = 'Mosse finite. Aspetta gli altri.';
      else if (p.scelto !== null) msg = 'Mossa scelta: ci si muove quando hanno scelto tutti…';
      else msg = `Mossa ${p.mosse + 1} di ${p.maxMosse}: scegli dove andare`;
      // chi ha già scelto la mossa: una targhetta per giocatore col suo colore (prima era una riga «Tu: … · Ada: ✓»)
      const STATI = { uscito: '🚪 uscito', preso: '👾 preso', fermo: '⏹ senza mosse' };
      const altri = p.n > 1 ? `<div class="mn-altri">${p.altri.map((a, i) => {
        const testo = a.stato === 'viaggio' ? (a.pronto ? '✓ ha scelto' : 'sta scegliendo…') : STATI[a.stato];
        return `<span class="mn-chi ${a.stato === 'viaggio' && a.pronto ? 'pronto' : ''} ${a.stato !== 'viaggio' ? 'fuori' : ''}" style="--c:${COLORI[i % COLORI.length]}"><i></i><b>${esc(i === io ? 'Tu' : ctx.nome(i))}</b> ${testo}</span>`;
      }).join('')}</div>` : '';
      return `<div class="mn">
        <p class="pa-round">Mappa ${p.nMappa} di ${p.nMappe} · ${p.nNemici} nemici nascosti</p>
        <div class="mn-griglia" style="--lato:${p.lato}">${celle.join('')}</div>
        <p class="pa-msg" aria-live="polite">${msg}</p>${altri}
      </div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      const k = `mn-${p.nMappa}-${p.mosse}-${p.stato}`;
      if (p.mosse && primaVolta(ctx.ui, k)) suono(p.stato === 'preso' ? [[160, 0.08], [80, 0.3]] : p.stato === 'uscito' ? [[523, 0.08], [659, 0.08], [1046, 0.18]] : [[440 + 40 * (p.numeri[p.pos] || 0), 0.06]], { volume: 0.07 });
    },
    statoAttesa: () => 'Prossima mappa…',
    stato(ctx) { const p = ctx.partita; if (p.finita) return null; return p.stato === 'viaggio' ? `Mossa ${p.mosse + 1}/${p.maxMosse}` : 'Aspetti gli altri'; },
    punteggio(ctx) { const p = ctx.partita; return p.punti.map((x, i) => `<span style="color:${COLORI[i % COLORI.length]}">${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b></span>`).join('') + '<span class="obiettivo">uscita: 10 + 2 per mossa avanzata</span>'; },
    infoPosto(ctx, posto) { const a = ctx.partita.altri[posto]; return `${a.mosse} ${a.mosse === 1 ? 'mossa' : 'mosse'} · ${ctx.partita.punti[posto]} ${ctx.partita.punti[posto] === 1 ? 'punto' : 'punti'}`; },
    clic(ctx, el) { if (el.dataset.az === 'muovi') ctx.invia({ tipo: 'muovi', cella: Number(el.dataset.c) }); },
  };
  Object.assign(window.Tavoli, { mappa: tavolo });
})();
