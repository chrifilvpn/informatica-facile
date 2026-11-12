// INTERRUTTORI: un pannello di levette disegnate in CSS; quella della bomba fa saltare il pannello.
(() => {
  const { esc, ritardo, primaVolta, suono } = window.Nuovi;
  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita;
      const mio = p.turno === ctx.mio && !p.finita && !p.inAttesa;
      const botto = !!(p.ultimo && p.ultimo.bomba);
      const leve = p.accesi.map((chi, k) => {
        const acceso = chi !== null;
        const bomba = p.bomba === k;
        const puo = mio && !acceso;
        const cls = ['it-leva', acceso ? 'su' : '', bomba ? 'bomba' : '', puo ? 'attiva' : '', p.ultimo && p.ultimo.k === k ? 'appena' : ''].join(' ');
        const chiNome = acceso ? (chi === ctx.mio ? 'tu' : ctx.nome(chi)) : '';
        const inner = `<span class="it-spia"></span><span class="it-base"><span class="it-levetta"></span></span><span class="it-num">${k + 1}</span><span class="it-chi">${esc(chiNome)}</span>`;
        return puo
          ? `<button type="button" class="${cls}" data-az="accendi" data-k="${k}" aria-label="Interruttore ${k + 1}">${inner}</button>`
          : `<div class="${cls}" aria-label="Interruttore ${k + 1}${acceso ? ', acceso' : ''}">${inner}</div>`;
      }).join('');
      // una lampadina per interruttore sopra il pannello: si accende (con un piccolo sfarfallio) quando lo accendi
      const lampade = p.accesi.map((chi, k) => `<i class="it-lampada ${chi !== null ? 'accesa' : ''} ${p.ultimo && p.ultimo.k === k && !p.ultimo.bomba ? 'appena' : ''} ${botto && p.bomba === k ? 'rotta' : ''}"></i>`).join('');
      const rimasti = p.accesi.filter((x) => x === null).length;
      let msg;
      if (p.finita) msg = p.risultato.vincitori[0] === ctx.mio ? '🏆 Sei l\'ultimo rimasto: hai vinto!' : `🏆 Vince ${esc(ctx.nome(p.risultato.vincitori[0]))}`;
      else if (botto) msg = `💥 ${p.ultimo.posto === ctx.mio ? 'Sei saltato in aria!' : `${esc(ctx.nome(p.ultimo.posto))} è saltato in aria!`} Arriva un pannello nuovo…`;
      else if (!p.vivi[ctx.mio]) msg = 'Sei saltato: guardi gli altri sudare 🍿';
      else if (mio) msg = 'Tocca a te: accendi un interruttore…';
      else msg = `Tocca a ${esc(ctx.nome(p.turno))}`;
      const col = Math.min(p.quanti, p.quanti > 10 ? Math.ceil(p.quanti / 2) : p.quanti);
      return `<div class="it">
        <div class="it-lampade ${botto ? 'spente' : ''}" style="--col:${col}" aria-hidden="true">${lampade}</div>
        <div class="it-pannello ${botto ? 'botto' : ''} ${mio ? 'mio' : ''}" style="--col:${col};${botto ? ritardo(ctx.ui, `botto-${p.botti}`) : ''}">
          <div class="it-viti"><i></i><i></i><i></i><i></i></div>${leve}
          <div class="it-boom" aria-hidden="true">BOOM!</div>
        </div>
        <p class="pa-msg" aria-live="polite">${msg}</p>
        <p class="pa-info">${p.finita || botto ? '&nbsp;' : `${rimasti} interruttori spenti · rischio ${Math.round(100 / Math.max(1, rimasti))}%`}</p>
      </div>`;
    },
    azioni(ctx) {
      const p = ctx.partita;
      if (!p.conPasso || p.turno !== ctx.mio || p.inAttesa || p.finita) return '';
      return `<button type="button" class="bottone" data-az="passa" ${p.passi[ctx.mio] && p.accesi.filter((x) => x === null).length > 1 ? '' : 'disabled'}>Passo (${p.passi[ctx.mio] ? '1 disponibile' : 'già usato'})</button>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.ultimo && p.ultimo.bomba && primaVolta(ctx.ui, `s-botto-${p.botti}`)) { suono([[120, 0.06], [60, 0.4]], { tipo: 'sawtooth', volume: 0.14 }); if (navigator.vibrate && p.ultimo.posto === ctx.mio) navigator.vibrate([100, 50, 200]); }
      else if (p.ultimo && !p.ultimo.bomba && primaVolta(ctx.ui, `s-click-${p.botti}-${p.ultimo.k}`)) suono([[900, 0.03], [600, 0.04]], { tipo: 'square', volume: 0.04 });
    },
    statoAttesa: () => 'BOOM!',
    stato(ctx) { const p = ctx.partita; if (p.finita || p.turno == null) return null; return p.turno === ctx.mio ? 'Tocca a te: accendi un interruttore' : `Tocca a ${ctx.nome(p.turno)}`; },
    punteggio(ctx) { const p = ctx.partita; return `<span>In gioco <b>${p.vivi.filter(Boolean).length}</b></span><span>Saltati <b>${p.eliminati.length}</b></span><span class="obiettivo">${p.quanti} interruttori, 1 bomba</span>`; },
    infoPosto(ctx, posto) { const p = ctx.partita; if (!p.vivi[posto]) return '<span class="eliminato">💥 saltato</span>'; return p.conPasso && p.passi[posto] ? 'in gioco · passo pronto' : 'in gioco'; },
    clic(ctx, el) {
      if (el.dataset.az === 'accendi') { el.classList.add('su'); return ctx.invia({ tipo: 'accendi', interruttore: Number(el.dataset.k) }); }
      if (el.dataset.az === 'passa') return ctx.invia({ tipo: 'passa' });
    },
  };
  Object.assign(window.Tavoli, { interruttori: tavolo });
})();
