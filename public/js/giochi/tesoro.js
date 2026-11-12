// SCAVA IL TESORO: griglia di terra; scavando escono monete, gemme, bombe o un numero (tesori vicini).
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const ICONA = { moneta: '<svg viewBox="0 0 40 40" class="ts-ico"><circle cx="20" cy="20" r="14" fill="#f1c24a" stroke="#a9781a" stroke-width="3"/><circle cx="20" cy="20" r="8" fill="none" stroke="#c89a2a" stroke-width="2"/></svg>',
    gemma: '<svg viewBox="0 0 40 40" class="ts-ico"><path d="M10 15 L16 8 H24 L30 15 L20 33 Z" fill="#5ad0e8" stroke="#1e7f96" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 15 H30 M16 8 L20 15 L24 8 M20 15 L20 33" stroke="#1e7f96" stroke-width="1.5" fill="none"/></svg>',
    bomba: '<svg viewBox="0 0 40 40" class="ts-ico"><circle cx="18" cy="23" r="11" fill="#2a2d35"/><path d="M25 14 q4 -6 9 -5" stroke="#8a6a3a" stroke-width="3" fill="none"/><circle cx="34" cy="9" r="3" fill="#ff9a3c"/><circle cx="14" cy="19" r="3" fill="rgba(255,255,255,.35)"/></svg>' };
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita;
      const mio = !p.finita && p.scavi[ctx.mio] > 0 && (p.modo === 'sfida' || p.turno === ctx.mio);
      const celle = p.griglia.map((x, i) => {
        if (x) {
          const di = p.modo === 'turni' ? ` title="${esc(x.posto === ctx.mio ? 'tuo' : ctx.nome(x.posto))}"` : '';
          const c = x.cosa === 'niente' ? `<b class="ts-num n${x.numero}">${x.numero || ''}</b>` : ICONA[x.cosa];
          // effetti dello scavo appena fatto: zolle che saltano, la moneta che brilla, la gemma che scintilla, la bomba che esplode
          const effetto = p.ultimo !== i ? '' : `<span class="ts-zolle" aria-hidden="true"></span>${x.cosa === 'moneta' || x.cosa === 'gemma' ? '<span class="ts-brilla" aria-hidden="true"><i></i><i></i><i></i></span>' : x.cosa === 'bomba' ? '<span class="cb-boom" aria-hidden="true"></span>' : ''}`;
          return `<div class="ts-cella scavata ${x.cosa} ${p.ultimo === i ? 'appena' : ''} ${p.modo === 'turni' && x.posto !== ctx.mio ? 'altrui' : ''}"${di}>${c}${effetto}</div>`;
        }
        if (p.tutto) { const c = p.tutto[i]; return `<div class="ts-cella rivelata">${c === 'niente' ? '' : ICONA[c]}</div>`; }
        return mio ? `<button type="button" class="ts-cella coperta attiva" data-az="scava" data-c="${i}" aria-label="Scava la casella ${i + 1}"></button>` : '<div class="ts-cella coperta"></div>';
      }).join('');
      let msg;
      if (p.finita) msg = 'Scavi finiti: ecco cosa c\'era sotto';
      else if (p.scavi[ctx.mio] <= 0) msg = 'Hai finito gli scavi: aspetta gli altri ⏳';
      else if (mio) msg = `Scegli dove scavare · ti restano <b>${p.scavi[ctx.mio]}</b> scavi`;
      else msg = `Scava ${esc(ctx.nome(p.turno))}`;
      const t = p.trovati[ctx.mio];
      return `<div class="ts">
        <div class="ts-griglia ${mio ? 'mio' : ''}" style="--lato:${p.lato}">${celle}</div>
        <p class="pa-msg" aria-live="polite">${msg}</p>
        <p class="pa-info">Hai trovato: 🪙 ${t.moneta} · 💎 ${t.gemma} · 💣 ${t.bomba} — i numeri dicono quanti tesori ci sono intorno</p>
      </div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      const x = p.ultimo != null && p.griglia[p.ultimo];
      if (x && x.posto === ctx.mio && primaVolta(ctx.ui, `ts-${p.ultimo}-${ctx.mio}`)) {
        const note = { moneta: [[880, 0.06], [1320, 0.1]], gemma: [[990, 0.07], [1320, 0.07], [1760, 0.14]], bomba: [[130, 0.05], [60, 0.35]], niente: [[260, 0.05]] }[x.cosa];
        suono(note, { tipo: x.cosa === 'bomba' ? 'sawtooth' : 'triangle', volume: x.cosa === 'niente' ? 0.04 : 0.08 });
      }
    },
    stato(ctx) {
      const p = ctx.partita;
      if (p.finita) return null;
      if (p.modo === 'sfida') return p.scavi[ctx.mio] > 0 ? `Scava! ${p.scavi[ctx.mio]} scavi rimasti` : 'Aspetti gli altri';
      return p.turno === ctx.mio ? 'Tocca a te: scava' : `Scava ${ctx.nome(p.turno)}`;
    },
    punteggio(ctx) { const p = ctx.partita; return p.punti.map((x, i) => `<span>${esc(i === ctx.mio ? 'Tu' : ctx.nome(i))} <b>${x}</b></span>`).join('') + `<span class="obiettivo">${p.modo === 'sfida' ? 'sfida: stessa griglia per tutti' : 'griglia condivisa'}</span>`; },
    infoPosto(ctx, posto) { const p = ctx.partita; return `${p.punti[posto]} ${p.punti[posto] === 1 ? "punto" : "punti"} · ⛏ ${p.scavi[posto]}`; },
    clic(ctx, el) { if (el.dataset.az === 'scava') { el.classList.add('premuta'); ctx.invia({ tipo: 'scava', cella: Number(el.dataset.c) }); } },
  };
  Object.assign(window.Tavoli, { tesoro: tavolo });
})();
