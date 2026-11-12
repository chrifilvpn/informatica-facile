// CIRULLA: stesso tavolo della scopa (carte in ordine, numerino del valore sulle figure) più la matta,
// le mani accusate scoperte e un riepilogo con Grande e Piccola.
(() => {
  const S = window.Tavoli.scopa; // scelta della presa, azioni e annulla: come nella scopa
  const esc = window.Nuovi.esc;
  const MATTA = '7c';
  const val = (c) => (c.vale != null ? c.vale : c.rango <= 7 ? c.rango : c.rango - 3);
  const SEMI = ['c', 'q', 'f', 'p'];
  const ordina = (cs) => [...cs].sort((a, b) => val(a) - val(b) || SEMI.indexOf(a.seme) - SEMI.indexOf(b.seme));
  // numerino: il valore delle figure; sulla matta la "M" (o il valore dichiarato con l'accuso)
  function F(c, cls = '', attr = '') {
    const matta = c.id === MATTA;
    const opz = matta ? { valore: c.vale != null ? c.vale : 'M' } : c.rango > 10 ? { valore: c.rango - 3 } : {};
    const titolo = matta ? ` title="Matta (7 di cuori)${c.vale != null ? `: vale ${c.vale}` : ''}"` : '';
    return Carte.fronte(c, `${cls} ${matta ? 'ci-matta' : ''}`, `${attr}${titolo}`, opz);
  }
  const plur = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;
  const nomeF = (ctx, posti) => (ctx.partita.aSquadre ? (posti.includes(ctx.mio) ? 'Voi' : 'Loro') : posti[0] === ctx.mio ? 'Tu' : ctx.nome(posti[0]));
  const NOMI_ACC = { barsega: 'Bàrsega', decino: 'Decino' };

  const tavolo = {
    panno(ctx) {
      const p = ctx.partita, ui = ctx.ui;
      const compatibili = ui.scelta ? ui.scelta.opzioni.filter((o) => ui.scelta.sel.every((x) => o.includes(x))) : [];
      const sel = new Set(compatibili.flat());
      const carte = ordina(p.tavolo).map((c) => {
        let cls = '';
        if (p.inCorso && p.inCorso.presa.includes(c.id)) cls = 'presa';
        else if (sel.has(c.id)) cls = ui.scelta.sel.includes(c.id) ? 'scelta' : 'selezionabile';
        return F(c, cls, sel.has(c.id) ? 'data-az="tavola" role="button" tabindex="0"' : '');
      });
      if (p.inCorso) carte.push(F(p.inCorso.carta, `appena da-${ctx.slot(p.inCorso.posto)}`));
      const vuota = !carte.length ? '<p class="tavola-vuota">Tavola vuota</p>' : '';
      const scoperte = p.scoperte.map((m, i) => (m && m.length ? `<div class="ci-scoperte"><span>${esc(ctx.nome(i))} ha bussato: carte scoperte</span><div>${ordina(m).map((c) => F(c, 'mini')).join('')}</div></div>` : '')).join('');
      const mazzo = p.mazzo ? `<div class="mazzo-mini" title="Carte nel mazzo">${Carte.retro()}<span>${p.mazzo}</span></div>` : '';
      return `${mazzo}<div class="tavola-carte">${carte.join('')}${vuota}</div>${scoperte}`;
    },
    mano(ctx) {
      const p = ctx.partita, attiva = !!p.opzioni;
      return window.Tavoli._ordinaMano40(p.mano, val).map((c) => {
        const cls = [attiva ? 'giocabile' : '', ctx.ui.scelta && ctx.ui.scelta.carta === c.id ? 'alzata' : '', attiva && p.opzioni[c.id] && p.opzioni[c.id].length ? 'prende' : ''].join(' ');
        return F(c, cls, attiva ? `data-az="mano" role="button" tabindex="0" aria-label="Gioca ${Carte.nome(c)}"` : '');
      }).join('');
    },
    azioni: S.azioni,
    infoPosto(ctx, posto) {
      const p = ctx.partita, f = p.aSquadre ? posto % 2 : posto, s = p.scope[f];
      return `${plur(p.preseCarte[f], 'carta presa', 'carte prese')}${s ? `, <b class="scope">${plur(s, 'scopa', 'scope')}</b>` : ''}`;
    },
    punteggio(ctx) {
      const p = ctx.partita;
      return p.totali.map((t, f) => `<span>${esc(nomeF(ctx, p.aSquadre ? [f, f + 2] : [f]))} <b>${t}</b></span>`).join('') + `<span class="obiettivo">si vince a ${p.obiettivo}</span>`;
    },
    riepilogo(ctx) {
      const p = ctx.partita, r = p.riepilogo;
      if (!r) return null;
      const riga = (titolo, chiave, fmt) => `<tr><th>${titolo}</th>${r.righe.map((x, f) => `<td class="${r.assegnati[chiave] === f ? 'vinto' : ''}">${fmt(x)}</td>`).join('')}</tr>`;
      const extra = (titolo, fmt) => `<tr><th>${titolo}</th>${r.righe.map((x) => `<td class="${fmt(x) ? 'vinto' : ''}">${fmt(x) || ''}</td>`).join('')}</tr>`;
      const accusi = r.accusi.map((a) => `${esc(a.posto === ctx.mio ? 'Tu' : ctx.nome(a.posto))}: ${NOMI_ACC[a.tipo]} (+${a.scope})`);
      if (r.quindici) accusi.unshift(`${esc(r.quindici.posto === ctx.mio ? 'Tu' : ctx.nome(r.quindici.posto))}: ${r.quindici.scope === 2 ? 'trenta' : 'quindici'} in tavola (+${r.quindici.scope})`);
      return `<h2>Fine smazzata ${r.smazzata}</h2>
        <div class="tabella-scorre"><table class="conti">
          <thead><tr><th></th>${r.righe.map((x) => `<th>${esc(nomeF(ctx, x.posti))}</th>`).join('')}</tr></thead>
          <tbody>
            ${riga('Carte', 'carte', (x) => x.carte)}
            ${riga('Quadri', 'quadri', (x) => x.quadri)}
            ${riga('Settebello', 'settebello', (x) => (x.settebello ? 'sì' : ''))}
            ${riga('Primiera', 'primiera', (x) => x.primiera || '–')}
            ${extra('Grande', (x) => x.grande)}
            ${extra('Piccola', (x) => x.piccola)}
            <tr><th>Scope</th>${r.righe.map((x) => `<td class="${x.scope ? 'vinto' : ''}">${x.scope}</td>`).join('')}</tr>
            <tr class="somma"><th>Punti fatti</th>${r.righe.map((x) => `<td>${x.punti}</td>`).join('')}</tr>
            <tr class="somma"><th>Totale</th>${r.righe.map((x) => `<td>${x.totale}</td>`).join('')}</tr>
          </tbody></table></div>
        ${accusi.length ? `<p class="piccolo">Accusi: ${accusi.join(' · ')}</p>` : ''}
        ${r.capotto >= 0 ? `<p><b>Capotto!</b> ${esc(nomeF(ctx, r.righe[r.capotto].posti))} ha preso tutte le quadri.</p>` : ''}
        ${r.avanzo ? `<p class="piccolo">Le ${r.avanzo} carte rimaste in tavola sono andate a ${r.ultimaPresa === ctx.mio ? 'te' : esc(ctx.nome(r.ultimaPresa))}.</p>` : ''}`;
    },
    clic: S.clic,
    reset: S.reset,
  };
  Object.assign(window.Tavoli, { cirulla: tavolo });
})();
