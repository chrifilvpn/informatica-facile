// POKER OMAHA: lo stesso tavolo del Texas Hold'em (window.Tavoli.texas), con 4 carte a testa. In più: la scritta con
// la regola delle 2 + 3 e il tipo di puntate al centro, e le 2 carte della mano che si stanno usando evidenziate.
(() => {
  const T = window.Tavoli.texas;
  const { esc } = window.Nuovi;
  const tavolo = {
    ...T,
    panno(ctx) {
      const p = ctx.partita;
      const regola = `<p class="om-regola">Omaha ${p.potLimit ? 'Pot Limit' : 'No Limit'}${p.ante ? ` · ante ${p.ante}` : ''} · <b>2 carte tue + 3 del tavolo</b></p>`;
      // sotto le carte del tavolo (in alto ci finirebbero sopra la targa e la puntata di chi sta di fronte)
      let html = T.panno(ctx).replace('<div class="pk-piatto">', `${regola}<div class="pk-piatto">`);
      if (p.miaMano && p.mieUsate) html = html.replace('<p class="pk-mia-mano">', '<p class="pk-mia-mano"><span class="om-usa">usi le 2 carte alzate:</span> ');
      return `<div class="om">${html}</div>`;
    },
    dopo(ctx) {
      if (T.dopo) T.dopo(ctx);
      const p = ctx.partita;
      const usate = new Set(p.mieUsate || []);
      for (const el of document.querySelectorAll('#panno .om .pk-mie .carta[data-id]')) el.classList.toggle('om-usata', usate.has(el.dataset.id));
    },
    infoPosto: T.infoPosto,
    stato: T.stato,
  };
  tavolo.clic = T.clic;
  Object.assign(window.Tavoli, { omaha: tavolo });
  void esc;
})();
