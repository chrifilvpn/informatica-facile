// GO: goban di legno in SVG con coordinate, punti stella, pietre con ombra, segno sull'ultima pietra e sul ko,
// anteprima trasparente sotto il mouse. Nel conteggio: territori segnati con quadratini, pietre morte barrate e
// cliccabili, punteggio provvisorio e "Accetta".
(() => {
  const { esc, primaVolta, suono } = window.Nuovi;
  const LETTERE = 'ABCDEFGHJKLMNOPQRST';
  const STELLE = { 9: [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]], 13: [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]], 19: [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]] };
  const nomeCol = (c) => (c === 1 ? 'nero' : 'bianco');

  const tavolo = {
    libero: true,
    panno(ctx) {
      const p = ctx.partita, io = ctx.mio, N = p.N;
      const C = 600 / (N + 1), M = C; // passo e margine
      const X = (x) => M + x * C, Y = (y) => M + y * C;
      const mioCol = p.colori[io];
      const mio = p.turno === io && p.fase === 'gioco' && !p.finita;
      const conteggio = p.fase === 'conteggio' || p.finita;
      const morte = new Set(p.morte.map(([x, y]) => y * N + x));
      let s = '<defs><radialGradient id="go-n" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#6a6a6a"/><stop offset=".45" stop-color="#1c1c1c"/><stop offset="1" stop-color="#000"/></radialGradient>'
        + '<radialGradient id="go-b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#ecebe4"/><stop offset="1" stop-color="#bdb9aa"/></radialGradient></defs>';
      s += `<rect class="go-legno" x="0" y="0" width="${600}" height="${600}" rx="10"/>`;
      for (let k = 0; k < N; k++) {
        s += `<line class="go-linea" x1="${X(0)}" y1="${Y(k)}" x2="${X(N - 1)}" y2="${Y(k)}"/><line class="go-linea" x1="${X(k)}" y1="${Y(0)}" x2="${X(k)}" y2="${Y(N - 1)}"/>`;
        s += `<text class="go-coord" x="${X(k)}" y="${M * 0.45}">${LETTERE[k]}</text><text class="go-coord" x="${M * 0.42}" y="${Y(k) + 5}">${N - k}</text>`;
      }
      for (const [x, y] of STELLE[N] || []) s += `<circle class="go-stella" cx="${X(x)}" cy="${Y(y)}" r="${Math.max(3, C * 0.09)}"/>`;
      const r = C * 0.47;
      p.celle.forEach((c, i) => {
        const x = i % N, y = Math.floor(i / N);
        if (c === 1 || c === 2) {
          const ultima = p.ultima && !p.ultima.passo && p.ultima.x === x && p.ultima.y === y;
          const morta = conteggio && morte.has(i);
          s += `<circle class="go-pietra ${ultima ? 'nuova' : ''} ${morta ? 'morta' : ''}" cx="${X(x)}" cy="${Y(y)}" r="${r}" fill="url(#go-${c === 1 ? 'n' : 'b'})"${conteggio && p.fase === 'conteggio' ? ` data-az="morte" data-x="${x}" data-y="${y}" role="button"` : ''}/>`;
          if (ultima) s += `<circle class="go-ultima" cx="${X(x)}" cy="${Y(y)}" r="${r * 0.32}" stroke="${c === 1 ? '#fff' : '#000'}"/>`;
          if (morta) s += `<path class="go-croce" d="M${X(x) - r * 0.45} ${Y(y) - r * 0.45} L${X(x) + r * 0.45} ${Y(y) + r * 0.45} M${X(x) + r * 0.45} ${Y(y) - r * 0.45} L${X(x) - r * 0.45} ${Y(y) + r * 0.45}"/>`;
        }
        if (conteggio && p.terr && (p.terr[i] === 1 || p.terr[i] === 2) && (c === 0 || morte.has(i))) {
          const q = C * 0.28;
          s += `<rect class="go-terr ${p.terr[i] === 1 ? 'n' : 'b'}" x="${X(x) - q / 2}" y="${Y(y) - q / 2}" width="${q}" height="${q}"/>`;
        }
        if (mio && c === 0) {
          const ko = p.ko && p.ko[0] === x && p.ko[1] === y;
          s += `<g class="go-punto ${ko ? 'ko' : ''}" data-az="metti" data-x="${x}" data-y="${y}" role="button" aria-label="${LETTERE[x]}${N - y}"><rect x="${X(x) - C / 2}" y="${Y(y) - C / 2}" width="${C}" height="${C}" fill="transparent"/><circle class="go-fantasma ${mioCol === 1 ? 'n' : 'b'}" cx="${X(x)}" cy="${Y(y)}" r="${r}"/></g>`;
        }
      });
      if (p.ko && p.fase === 'gioco') s += `<rect class="go-ko" x="${X(p.ko[0]) - C * 0.22}" y="${Y(p.ko[1]) - C * 0.22}" width="${C * 0.44}" height="${C * 0.44}"/>`;
      const svg = `<svg class="go-svg" viewBox="0 0 600 600" role="img" aria-label="Goban ${N}×${N}">${s}</svg>`;

      const nome = (k) => (k === io ? 'Tu' : esc(ctx.nome(k)));
      const righe = [0, 1].map((k) => `<div class="go-gioc ${p.turno === k ? 'di-turno' : ''}"><span class="go-pal ${nomeCol(p.colori[k])}"></span><b>${nome(k)}</b>
        <small>${p.catturate[k]} ${p.catturate[k] === 1 ? 'pietra presa' : 'pietre prese'}${p.colori[k] === 2 ? ` · komi ${String(p.komi).replace('.', ',')}` : ''}</small>${p.punti ? `<span class="go-pt">${String(p.colori[k] === 1 ? p.punti.nero : p.punti.bianco).replace('.', ',')}</span>` : ''}</div>`).join('');
      let msg, bt = '';
      if (p.finita) msg = p.risultato.vincitori[0] === io ? 'Hai vinto! 🎉' : `Vince ${esc(ctx.nome(p.risultato.vincitori[0]))}`;
      else if (p.fase === 'conteggio') {
        msg = 'Conteggio: clicca un gruppo per segnarlo vivo o morto, poi accetta';
        bt = `<button class="bottone primario-bt" data-az="accetta" ${p.accettato[io] ? 'disabled' : ''}>${p.accettato[io] ? '✓ Accettato' : 'Accetta il conteggio'}</button><button class="bottone" data-az="riprendi">Riprendi a giocare</button>`;
        if (p.accettato[1 - io]) msg += ` · ${esc(ctx.nome(1 - io))} ha già accettato`;
      } else if (mio) {
        msg = p.ultima && p.ultima.passo ? `${esc(ctx.nome(1 - io))} ha passato: se passi anche tu si conta` : `Tocca a te (${nomeCol(mioCol)})`;
        bt = '<button class="bottone" data-az="passa">Passo</button><button class="bottone piccolo-bt go-abb" data-az="abbandona">Abbandono</button>';
      } else msg = `${esc(ctx.nome(p.turno))} ci pensa…`;
      return `<div class="go">${svg}<div class="go-lato">${righe}<p class="go-msg" aria-live="polite">${msg}</p><div class="go-bt">${bt}</div><p class="go-nota">Mossa ${p.nMosse}${p.ko && p.fase === 'gioco' ? ' · ko: il quadratino rosso non si può giocare adesso' : ''}</p></div></div>`;
    },
    dopo(ctx) {
      const p = ctx.partita;
      if (p.ultima && primaVolta(ctx.ui, `go-${p.nMosse}`) && !p.ultima.passo) suono(p.ultima.prese ? [[300, 0.04], [500, 0.05], [700, 0.06]] : [[180, 0.04]], { tipo: 'triangle', volume: 0.05 });
    },
    stato(ctx) { const p = ctx.partita; if (p.fase === 'conteggio') return 'Conteggio'; return p.turno === ctx.mio && !p.finita ? 'Tocca a te' : null; },
    punteggio() { return ''; },
    infoPosto(ctx, k) { const p = ctx.partita; return `${p.colori[k] === 1 ? '<span class="pedina-segno nero"></span>' : '<span class="pedina-segno bianco"></span>'} ${p.catturate[k]} prese`; },
    clic(ctx, el) {
      const az = el.dataset.az;
      if (az === 'metti') return ctx.invia({ tipo: 'metti', x: Number(el.dataset.x), y: Number(el.dataset.y) });
      if (az === 'morte') return ctx.invia({ tipo: 'morte', x: Number(el.dataset.x), y: Number(el.dataset.y) });
      if (az === 'abbandona') { if (window.confirm('Vuoi davvero abbandonare la partita?')) ctx.invia({ tipo: 'abbandona' }); return undefined; }
      if (['passa', 'accetta', 'riprendi'].includes(az)) return ctx.invia({ tipo: az });
      return undefined;
    },
  };
  Object.assign(window.Tavoli, { go: tavolo });
})();
