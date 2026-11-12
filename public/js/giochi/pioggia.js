// PIOGGIA DI MONETE: arena rotonda, monete che brillano, potenziamenti, scatti con la scia.
(() => {
  const { COLORI, lerp, omino } = window.Arena;
  const ICONA = { veloce: '⚡', calamita: '🧲', scudo: '🛡️' };
  let botti = [];
  const tavolo = window.Arena.tavolo({
    id: 'pioggia',
    nomeAzione: '💨 Scatto',
    obiettivo: 'monete',
    istruzioni: () => 'WASD o frecce (sul telefono il joystick): prendi le monete. Spazio (o 💨): scatto per travolgere gli altri e fargli cadere le monete!',
    statoGioco: () => 'Raccogli!',
    // in alto, accanto ai punti totali, le monete che ognuno ha in mano in questo round
    delRound: (ctx, s, i) => { const e = s.s.e[i]; return e ? `+${e.m} 🪙` : ''; },
    hud: (ctx, s) => { const e = s.s.e[ctx.mio]; return `<span>⏱️ ${s.s.resta} s</span><span>🪙 ${e ? e.m : 0}</span>${e && e.p ? `<span>${ICONA[e.p]} attivo</span>` : ''}<span>${e && e.r ? '💨 in ricarica' : '💨 pronto'}</span>`; },
    fineRound: (p, s, ctx) => `Punti totali: ${p.punti[ctx.mio]}`,
    dopoTick(ctx, d, prima) {
      for (const [x, y] of d.s.b) { botti.push({ x, y, t: performance.now() }); window.Nuovi.suono([[220, 0.06], [140, 0.12]], { tipo: 'square', volume: 0.06 }); }
      const a = prima && prima.s.e[ctx.mio], b = d.s.e[ctx.mio];
      if (a && b && b.m > a.m) window.Nuovi.suono([[988, 0.04], [1319, 0.06]], { volume: 0.035 });
    },
    disegna(g, p, s, prima, u, ctx) {
      const W = p.W, H = p.H, CX = W / 2, CY = H / 2, RA = 290;
      g.fillStyle = '#23143a'; g.fillRect(0, 0, W, H);
      const pav = g.createRadialGradient(CX, CY, 20, CX, CY, RA); pav.addColorStop(0, '#5a3e8a'); pav.addColorStop(1, '#382560');
      g.fillStyle = pav; g.beginPath(); g.arc(CX, CY, RA, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d19a2a'; g.lineWidth = 8; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2; for (let r = 60; r < RA; r += 60) { g.beginPath(); g.arc(CX, CY, r, 0, Math.PI * 2); g.stroke(); }
      const t = s.t;
      for (const c of s.s.mo) {
        const rr = c.v > 1 ? 15 : 10, sc = Math.abs(Math.cos(t * 3 + c.id));
        g.fillStyle = c.v > 1 ? '#ffe27a' : '#f6c431'; g.beginPath(); g.ellipse(c.x, c.y, rr * Math.max(0.3, sc), rr, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#b8860b'; g.lineWidth = 2; g.stroke();
      }
      g.font = '26px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const q of s.s.po) { g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(q.x, q.y, 20 + Math.sin(t * 5) * 3, 0, Math.PI * 2); g.fill(); g.fillText(ICONA[q.t], q.x, q.y); }
      g.textBaseline = 'alphabetic';
      const ee = lerp(prima && prima.s.e, s.s.e, u);
      ee.forEach((e, i) => {
        if (e.s) { g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(e.x, e.y, 26, 0, Math.PI * 2); g.fill(); }
        if (e.p === 'scudo') { g.strokeStyle = 'rgba(120,200,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(e.x, e.y, 24, 0, Math.PI * 2); g.stroke(); }
        omino(g, e.x, e.y, 17, COLORI[i % COLORI.length], `${i === ctx.mio ? 'Tu' : ctx.nome(i).slice(0, 8)} ${e.m}`, { io: i === ctx.mio, stordito: e.st });
      });
      const ora = performance.now();
      botti = botti.filter((k) => ora - k.t < 350);
      for (const k of botti) { const a = (ora - k.t) / 350; g.fillStyle = `rgba(255,220,100,${1 - a})`; for (let j = 0; j < 6; j++) { const an = j * Math.PI / 3 + a; g.beginPath(); g.arc(k.x + Math.cos(an) * a * 50, k.y + Math.sin(an) * a * 50, 5, 0, Math.PI * 2); g.fill(); } }
    },
  });
  Object.assign(window.Tavoli, { pioggia: tavolo });
})();
