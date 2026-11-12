// CASELLE E BOMBE: griglia di caselle coperte; si scopre una casella alla volta, ci si ferma quando si vuole.
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const COLORI = ['#e8453c', '#2f7fd8', '#2e9d57', '#d19a2a', '#8e55c9', '#e36fa5'];
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita;
      const mio = p.turno === ctx.mio && !p.finita && !p.inAttesa;
      const bombeFinali = new Set(p.tutteBombe || []);
      const celle = p.scoperte.map((x, i) => {
        // effetti sull'ultima casella: esplosione con schegge per la bomba, anello di luce per quella sicura
        const effetto = p.ultima !== i ? '' : x.bomba ? '<span class="cb-boom" aria-hidden="true"></span><span class="cb-schegge" aria-hidden="true"></span>' : '<span class="cb-luce" aria-hidden="true"></span>';
        if (x) return `<div class="cb-cella ${x.bomba ? 'bomba' : 'sicura'} ${p.ultima === i ? 'appena' : ''}" style="--col:${COLORI[x.posto % COLORI.length]}" title="${esc(x.posto === ctx.mio ? 'tu' : ctx.nome(x.posto))}">${x.bomba ? '💣' : '✓'}${effetto}</div>`;
        if (bombeFinali.has(i)) return '<div class="cb-cella rivelata">💣</div>';
        return mio ? `<button type="button" class="cb-cella coperta attiva" data-az="scopri" data-c="${i}" aria-label="Casella ${i + 1}"></button>` : '<div class="cb-cella coperta"></div>';
      }).join('');
      const rischio = Math.round((100 * p.bombeRimaste) / Math.max(1, p.rimaste));
      let msg;
      if (p.inAttesa) msg = `💣 Bomba! ${p.evento && p.evento.posto === ctx.mio ? 'Hai perso il piatto del turno.' : ''}`;
      else if (p.finita) msg = 'Caselle sicure finite!';
      else if (mio) msg = p.piatto ? `Piatto del turno: <b>${p.piatto}</b>. Un'altra casella o ti fermi?` : 'Tocca a te: scopri una casella';
      else msg = `Tocca a ${esc(ctx.nome(p.turno))}${p.piatto ? ` · piatto ${p.piatto}` : ''}`;
      return `<div class="cb">
        <div class="cb-griglia ${mio ? 'mio' : ''} ${p.ultima != null && p.scoperte[p.ultima] && p.scoperte[p.ultima].bomba && p.inAttesa ? 'scossa' : ''}" style="--lato:${p.lato}">${celle}</div>
        <p class="pa-msg" aria-live="polite">${msg}</p>
        <p class="pa-info">${p.finita ? '&nbsp;' : `${p.rimaste} caselle coperte, ${p.bombeRimaste} bombe · rischio della prossima ${rischio}%`}</p>
      </div>`;
    },
    azioni(ctx) {
      const p = ctx.partita;
      if (p.turno !== ctx.mio || p.inAttesa || p.finita) return '';
      return `<button type="button" class="bottone primario" data-az="fermati" ${p.piatto ? '' : 'disabled'}>💰 Fermati e incassa ${p.piatto}</button>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.ultima == null) return;
      const x = p.scoperte[p.ultima];
      if (x && primaVolta(ctx.ui, `cb-${p.ultima}`)) suono(x.bomba ? [[130, 0.05], [65, 0.35]] : [[700, 0.05], [940, 0.07]], { tipo: x.bomba ? 'sawtooth' : 'triangle', volume: x.bomba ? 0.13 : 0.05 });
    },
    statoAttesa: () => 'Bomba!',
    stato(ctx) { const p = ctx.partita; if (p.finita || p.turno == null) return null; return p.turno === ctx.mio ? 'Tocca a te' : `Tocca a ${ctx.nome(p.turno)}`; },
    punteggio(ctx) { const p = ctx.partita; return p.punti.map((x, i) => `<span style="color:${COLORI[i % COLORI.length]}">${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b></span>`).join(''); },
    infoPosto(ctx, posto) { const p = ctx.partita; return `${p.punti[posto]} ${p.punti[posto] === 1 ? "punto" : "punti"}${p.turno === posto && p.piatto ? ` · piatto ${p.piatto}` : ''}`; },
    clic(ctx, el) {
      if (el.dataset.az === 'scopri') { el.classList.add('premuta'); return ctx.invia({ tipo: 'scopri', cella: Number(el.dataset.c) }); }
      if (el.dataset.az === 'fermati') return ctx.invia({ tipo: 'fermati' });
    },
  };
  Object.assign(window.Tavoli, { casellebombe: tavolo });
})();
