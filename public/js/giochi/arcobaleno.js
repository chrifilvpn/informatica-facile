// CASELLE COLORATE: pavimento a caselle con una forma diversa a ogni round, sospeso nel vuoto. Il colore da
// raggiungere è in alto (le caselle giuste NON sono segnate), con la barra del tempo. Potenziamenti e pugni.
(() => {
  const { COLORI, lerp, omino } = window.Arena;
  const C = 60, COLS = 16, OX = 20, OY = 10;
  const COL = ['#e8453c', '#2f6fd8', '#2e9d57', '#f2c230', '#8e55c9', '#f08a24', '#f07ab8', '#46c8e8'];
  const NOMI = ['ROSSO', 'BLU', 'VERDE', 'GIALLO', 'VIOLA', 'ARANCIONE', 'ROSA', 'AZZURRO'];
  const FORME = { cerchio: 'Cerchio', rombo: 'Rombo', croce: 'Croce', anello: 'Anello', cuore: 'Cuore', isole: 'Isole', macchia: 'Macchia' };
  const EMOJI = { pugno: '🥊', gelo: '❄️', velocita: '⚡', scudo: '🛡️', piuma: '🪶' };
  let colpi = [], geli = [], stelle = null, inizioCaduta = 0;
  function casella(g, x, y, col, alfa, scala) {
    g.save(); g.globalAlpha = alfa; g.translate(x + C / 2, y + C / 2); g.scale(scala, scala);
    const m = C / 2 - 2;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-m + 3, -m + 5, 2 * m, 2 * m);
    g.fillStyle = COL[col]; g.fillRect(-m, -m, 2 * m, 2 * m);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-m, -m, 2 * m, 8);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-m, m - 7, 2 * m, 7);
    g.restore();
  }
  const tavolo = window.Arena.tavolo({
    id: 'arcobaleno',
    nomeAzione: '👊 Pugno',
    obiettivo: 'punti',
    istruzioni: () => 'WASD o frecce (sul telefono il joystick): corri sul colore giusto e non finire nel vuoto! Spazio (o 👊): pugno a chi ti sta vicino. Passa sopra ai potenziamenti per prenderli.',
    sottotitolo: (p) => (p.stato && p.stato.s && FORME[p.stato.s.fo]) || '',
    statoGioco: (ctx, s) => { const e = s.s.e[ctx.mio]; return e && e.f ? 'Caduto: guarda gli altri' : `Vai sul ${NOMI[s.s.col].toLowerCase()}!`; },
    hud: (ctx, s) => {
      const e = s.s.e[ctx.mio] || {};
      const miei = [e.sp && '🥊', e.v && '⚡', e.sc && '🛡️', e.pi && '🪶', e.g && '❄️ congelato!'].filter(Boolean).join(' ');
      return `<span class="ab-colore" style="background:${COL[s.s.col]}">${NOMI[s.s.col]}</span><span>${FORME[s.s.fo] || ''} · turno ${s.s.ci}</span><span>🧍 in piedi: ${s.s.e.filter((x) => !x.f).length}</span>${miei ? `<span>${miei}</span>` : ''}`;
    },
    fineRound: (p, s, ctx) => `Punti totali: ${p.punti[ctx.mio]}`,
    // in alto, accanto ai totali, i punti del round fin qui (chi è caduto ha già i suoi)
    delRound: (ctx, s, i) => { const v = s.s.pr && s.s.pr[i]; if (v == null) return ''; const e = s.s.e[i]; return `+${v}${e && e.f ? ' ⬇' : ''}`; },
    dopoTick(ctx, d, prima) {
      for (const [x, y, colpito, forte] of d.s.pu) { colpi.push({ x, y, t: performance.now(), forte }); window.Nuovi.suono(colpito ? [[forte ? 110 : 160, forte ? 0.16 : 0.08]] : [[400, 0.03]], { tipo: 'square', volume: 0.06 }); }
      for (const [x, y, x2, y2] of d.s.ge || []) { geli.push({ x, y, x2, y2, t: performance.now() }); window.Nuovi.suono([[1400, 0.05], [900, 0.1]], { volume: 0.05 }); }
      if (prima && prima.s.f2 === 'corri' && d.s.f2 === 'cade') { inizioCaduta = performance.now(); window.Nuovi.suono([[300, 0.08], [150, 0.25]], { volume: 0.06 }); }
      const a = prima && prima.s.e[ctx.mio], b = d.s.e[ctx.mio];
      if (a && b && ((!a.sp && b.sp) || (!a.v && b.v) || (!a.sc && b.sc) || (!a.pi && b.pi))) window.Nuovi.suono([[660, 0.05], [990, 0.08]], { volume: 0.05 });
    },
    disegna(g, p, s, prima, u, ctx) {
      const W = p.W, H = p.H, ora = performance.now();
      // il vuoto: spazio profondo con le stelle
      const cielo = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7); cielo.addColorStop(0, '#1b2440'); cielo.addColorStop(1, '#070a14');
      g.fillStyle = cielo; g.fillRect(0, 0, W, H);
      if (!stelle) stelle = Array.from({ length: 90 }, (_, k) => ({ x: (k * 97) % W, y: (k * 53 + k * k) % H, r: k % 7 === 0 ? 2 : 1, f: k }));
      for (const st of stelle) { g.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(s.t * 2 + st.f)})`; g.fillRect(st.x, st.y, st.r, st.r); }
      const cade = s.s.f2 === 'cade', dc = cade ? Math.min(1, (ora - inizioCaduta) / 350) : 0;
      // bordo della forma (così si capisce dov'è il vuoto)
      s.s.c.forEach((col, k) => {
        if (col < 0) return;
        const x = OX + (k % COLS) * C, y = OY + Math.floor(k / COLS) * C;
        g.fillStyle = '#39415a'; g.fillRect(x - 2, y - 2, C + 4, C + 4);
      });
      s.s.c.forEach((col, k) => {
        if (col < 0) return;
        const x = OX + (k % COLS) * C, y = OY + Math.floor(k / COLS) * C;
        if (cade && col !== s.s.col) {
          // la casella sbagliata precipita: si rimpicciolisce e sparisce, resta il buco scuro
          g.fillStyle = '#05070d'; g.fillRect(x + 2, y + 2, C - 4, C - 4);
          if (dc < 1) casella(g, x, y + dc * 30, col, 1 - dc, 1 - dc * 0.6);
          return;
        }
        casella(g, x, y, col, 1, 1);
      });
      // potenziamenti che galleggiano
      for (const q of s.s.po || []) {
        const b = Math.sin(s.t * 4 + q.id) * 4;
        const gl = g.createRadialGradient(q.x, q.y + b, 2, q.x, q.y + b, 26); gl.addColorStop(0, 'rgba(255,255,255,.9)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(q.x, q.y + b, 26, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1b2440'; g.beginPath(); g.arc(q.x, q.y + b, 17, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
        g.font = '20px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(EMOJI[q.t] || '?', q.x, q.y + b + 1); g.textBaseline = 'alphabetic';
      }
      const ee = lerp(prima && prima.s.e, s.s.e, u);
      ee.forEach((e, i) => {
        if (e.f >= 1) return;
        const sc = e.f ? 1 - e.f * 0.8 : 1;
        const x = e.x, y = e.y + (e.f ? e.f * 30 : 0);
        const pr = prima && prima.s.e[i];
        if (e.v && !e.f && pr) { g.fillStyle = 'rgba(255,230,80,.35)'; for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x - (e.x - pr.x) * k * 1.5, y - (e.y - pr.y) * k * 1.5, 14 - k * 3, 0, Math.PI * 2); g.fill(); } }
        omino(g, x, y, 16 * sc, COLORI[i % COLORI.length], e.f ? '' : i === ctx.mio ? 'Tu' : ctx.nome(i).slice(0, 10), { io: i === ctx.mio, stordito: e.st, alfa: e.f ? 1 - e.f : 1 });
        if (e.f) return;
        if (e.sc) { g.strokeStyle = `rgba(120,200,255,${0.6 + 0.3 * Math.sin(s.t * 6)})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 24, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(120,200,255,.12)'; g.fill(); }
        if (e.g) { g.fillStyle = 'rgba(170,225,255,.55)'; g.fillRect(x - 21, y - 21, 42, 42); g.strokeStyle = '#e8f7ff'; g.lineWidth = 2; g.strokeRect(x - 21, y - 21, 42, 42); g.beginPath(); g.moveTo(x - 14, y - 16); g.lineTo(x - 4, y - 6); g.stroke(); }
        const icone = [e.sp && '🥊', e.pi && '🪶'].filter(Boolean).join('');
        if (icone) { g.font = '13px system-ui'; g.textAlign = 'center'; g.fillText(icone, x + 22, y - 14); }
      });
      colpi = colpi.filter((k) => ora - k.t < 320);
      for (const k of colpi) { const a = (ora - k.t) / 320; g.strokeStyle = k.forte ? `rgba(255,120,60,${1 - a})` : `rgba(255,255,255,${1 - a})`; g.lineWidth = k.forte ? 6 : 4; g.beginPath(); g.arc(k.x, k.y, 20 + a * (k.forte ? 100 : 45), 0, Math.PI * 2); g.stroke(); }
      geli = geli.filter((k) => ora - k.t < 450);
      for (const k of geli) { const a = (ora - k.t) / 450; g.strokeStyle = `rgba(170,230,255,${1 - a})`; g.lineWidth = 5; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(k.x, k.y); g.lineTo(k.x + (k.x2 - k.x) * Math.min(1, a * 2), k.y + (k.y2 - k.y) * Math.min(1, a * 2)); g.stroke(); g.setLineDash([]); }
      // il colore da raggiungere, grande in alto, e la barra del tempo
      if (s.s.f2 === 'corri') {
        const tw = 250;
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(W / 2 - tw / 2, 0, tw, 34);
        g.fillStyle = COL[s.s.col]; g.fillRect(W / 2 - tw / 2 + 4, 4, 26, 26);
        g.fillStyle = '#fff'; g.font = '800 20px system-ui'; g.textAlign = 'left'; g.fillText(NOMI[s.s.col], W / 2 - tw / 2 + 40, 25);
        g.textAlign = 'right'; g.font = '700 18px system-ui'; g.fillText(`${s.s.tm.toFixed(1)} s`, W / 2 + tw / 2 - 8, 25);
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, H - 8, W, 8); g.fillStyle = COL[s.s.col]; g.fillRect(0, H - 8, W * (s.s.tm / s.s.tt), 8);
      }
    },
  });
  Object.assign(window.Tavoli, { arcobaleno: tavolo });
})();
