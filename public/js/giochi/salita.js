// FUGA DAI FANTASMI e MONETE IN SALITA: stesso disegno a scorrimento verticale (lo schermo segue la "camera").
(() => {
  const { COLORI, lerp, omino } = window.Arena;
  // ---------- ambientazioni ----------
  const TEMA = {
    cimitero: { cielo: ['#141a2e', '#233a3a'], erba: 'rgba(120,160,120,.08)', notte: true },
    castello: { cielo: ['#2a2238', '#3b2f4a'], erba: 'rgba(255,255,255,.05)', notte: true },
    palude: { cielo: ['#1e2b22', '#2f4630'], erba: 'rgba(160,200,120,.07)', notte: true },
    cripta: { cielo: ['#1c1612', '#33271d'], erba: 'rgba(255,230,200,.05)', notte: true },
    foresta: { cielo: ['#8fcf7c', '#6fb35e'], erba: 'rgba(255,255,255,.14)' },
    ghiacciaio: { cielo: ['#e9f4fb', '#cfe5f3'], erba: 'rgba(120,170,210,.18)' },
    vulcano: { cielo: ['#3a2a26', '#57362a'], erba: 'rgba(255,120,40,.07)' },
    tempio: { cielo: ['#e3c68e', '#d4b072'], erba: 'rgba(120,80,30,.12)' },
  };
  const NOME_TEMA = { cimitero: 'Cimitero 🪦', castello: 'Castello infestato 🏰', palude: 'Palude 🐸', cripta: 'Cripta 💀', foresta: 'Foresta 🌲', ghiacciaio: 'Ghiacciaio 🧊', vulcano: 'Vulcano 🌋', tempio: 'Tempio perduto 🏛️' };
  function ombra(g, x, y, rx, ry) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  function roccia(g, x, y, r, c1, c2) {
    ombra(g, x + 4, y + r * 0.5, r, r * 0.55);
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + r, y); for (let k = 1; k <= 9; k++) { const a = (k / 9) * Math.PI * 2, rr = r * (0.88 + ((k * 37 + Math.round(x)) % 10) / 60); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
  }
  function colonna(g, x, y, r, c1, c2) {
    ombra(g, x + 5, y + 6, r + 2, r * 0.8);
    g.fillStyle = c2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = c1; g.beginPath(); g.arc(x, y, r * 0.78, 0, Math.PI * 2); g.fill();
    g.strokeStyle = c2; g.lineWidth = 2; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); g.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); g.stroke(); }
  }
  function masso(g, te, x, y, r, t) {
    if (te === 'cimitero') { // lapide
      ombra(g, x + 4, y + r * 0.6, r * 0.9, r * 0.35);
      g.fillStyle = '#7d8290'; g.beginPath(); g.moveTo(x - r * 0.7, y + r * 0.6); g.lineTo(x - r * 0.7, y - r * 0.2); g.arc(x, y - r * 0.2, r * 0.7, Math.PI, 0); g.lineTo(x + r * 0.7, y + r * 0.6); g.fill();
      g.fillStyle = '#5f6470'; g.fillRect(x - 3, y - r * 0.55, 6, r * 0.8); g.fillRect(x - r * 0.3, y - r * 0.35, r * 0.6, 6);
      g.fillStyle = '#4c6b3f'; g.beginPath(); g.ellipse(x, y + r * 0.62, r * 0.8, 5, 0, 0, Math.PI * 2); g.fill();
    } else if (te === 'castello' || te === 'tempio') colonna(g, x, y, r, te === 'tempio' ? '#e8d6a8' : '#8a8298', te === 'tempio' ? '#b89a5e' : '#5c5566');
    else if (te === 'palude') { // albero morto
      ombra(g, x + 5, y + 5, r, r * 0.6);
      g.strokeStyle = '#3b2e22'; g.lineCap = 'round'; for (let k = 0; k < 6; k++) { const a = k * 1.05 + x; g.lineWidth = 6 - k * 0.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.3, x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
      g.fillStyle = '#4a3a2a'; g.beginPath(); g.arc(x, y, r * 0.35, 0, Math.PI * 2); g.fill();
    } else if (te === 'cripta') { // urna di pietra con teschio
      colonna(g, x, y, r, '#6e6258', '#40372f');
      g.font = `${Math.round(r * 0.8)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💀', x, y + 1); g.textBaseline = 'alphabetic';
    } else if (te === 'foresta') { // albero visto dall'alto
      ombra(g, x + 8, y + 8, r * 1.1, r);
      for (const [dx, dy, rr, c] of [[0, 0, 1, '#2f7a3a'], [-0.35, -0.3, 0.6, '#3c9447'], [0.3, -0.2, 0.55, '#358a40'], [0, 0.3, 0.55, '#2c7036'], [-0.15, -0.45, 0.3, '#57b060']]) { g.fillStyle = c; g.beginPath(); g.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); g.fill(); }
    } else if (te === 'ghiacciaio') { // blocco di ghiaccio
      ombra(g, x + 4, y + r * 0.5, r, r * 0.5);
      g.fillStyle = '#bfe3f7'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill();
      g.fillStyle = '#e9f7ff'; g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.4); g.lineTo(x + r * 0.1, y - r * 0.7); g.lineTo(x + r * 0.2, y); g.lineTo(x - r * 0.4, y + r * 0.2); g.fill();
      g.strokeStyle = '#8cc3e3'; g.lineWidth = 2; g.stroke();
    } else if (te === 'vulcano') { // roccia con crepe di lava
      roccia(g, x, y, r, '#5b4c47', '#2e2522');
      g.strokeStyle = `rgba(255,${120 + Math.round(60 * Math.sin(t * 4 + x))},30,.9)`; g.lineWidth = 2; g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.1); g.lineTo(x - r * 0.1, y + r * 0.1); g.lineTo(x + r * 0.2, y - r * 0.3); g.lineTo(x + r * 0.5, y + r * 0.2); g.stroke();
    } else roccia(g, x, y, r, '#b8b2a7', '#6b655c');
  }
  function muro(g, te, x, y, w, h, t) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (te === 'cimitero') { // recinto di ferro battuto
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 3, y + 5, w, h);
      g.fillStyle = '#2c2f36'; g.fillRect(x, y + h * 0.35, w, 5); g.fillRect(x, y + h * 0.75, w, 4);
      for (let xx = x + 4; xx < x + w; xx += 12) { g.fillRect(xx, y + 2, 4, h - 2); g.beginPath(); g.moveTo(xx - 2, y + 4); g.lineTo(xx + 2, y - 3); g.lineTo(xx + 6, y + 4); g.fill(); }
    } else if (te === 'palude') { // canneto
      g.fillStyle = '#3d5a2c'; g.fillRect(x, y, w, h);
      for (let xx = x; xx < x + w; xx += 7) { g.strokeStyle = (xx / 7) % 2 ? '#6f8f3a' : '#557a2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(xx, y + h); g.lineTo(xx + 3, y - 2); g.stroke(); if ((xx / 7) % 5 === 0) { g.fillStyle = '#6b4a2a'; g.fillRect(xx + 1, y, 4, 9); } }
    } else if (te === 'foresta') { // siepe
      g.fillStyle = '#2f6b33'; g.fillRect(x, y, w, h);
      for (let xx = x; xx < x + w + 10; xx += 14) { g.fillStyle = (xx / 14) % 2 ? '#3f8a44' : '#347a39'; g.beginPath(); g.arc(xx, y + h / 2, h * 0.62, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e24a6a'; for (let xx = x + 9; xx < x + w; xx += 37) { g.beginPath(); g.arc(xx, y + h * 0.35, 2.5, 0, Math.PI * 2); g.fill(); }
    } else if (te === 'ghiacciaio') {
      g.fillStyle = 'rgba(40,80,110,.3)'; g.fillRect(x + 3, y + 5, w, h); g.fillStyle = '#86b6d4'; g.fillRect(x, y, w, h); g.fillStyle = '#d8eefb'; g.fillRect(x, y, w, h * 0.45); g.strokeStyle = '#5f93b5'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      g.strokeStyle = '#9ccbe8'; g.lineWidth = 2; for (let xx = x; xx < x + w; xx += 40) { g.beginPath(); g.moveTo(xx, y + h); g.lineTo(xx + 12, y + h * 0.4); g.stroke(); }
    } else {
      const col = { castello: ['#5a5264', '#3b3544'], cripta: ['#4a3b30', '#2c221b'], vulcano: ['#3a302d', '#1f1917'], tempio: ['#c9a86a', '#9a7a44'] }[te] || ['#9a7b56', '#6d5438'];
      g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 3, y + 5, w, h);
      g.fillStyle = col[0]; g.fillRect(x, y, w, h);
      g.strokeStyle = col[1]; g.lineWidth = 2;
      const bw = te === 'tempio' ? 48 : 34;
      if (w >= h) for (let xx = x; xx < x + w; xx += bw) { g.strokeRect(xx, y, bw, h / 2); g.strokeRect(xx + bw / 2, y + h / 2, bw, h / 2); }
      else for (let yy = y; yy < y + h; yy += bw) { g.strokeRect(x, yy, w / 2, bw); g.strokeRect(x + w / 2, yy + bw / 2, w / 2, bw); }
      if (te === 'tempio') { g.fillStyle = '#8a6a34'; for (let xx = x + 16; xx < x + w - 8; xx += 96) { g.font = '12px system-ui'; g.fillText('𓂀', xx, y + h * 0.7); } }
      if (te === 'castello' && w > 120) for (let xx = x + 60; xx < x + w - 20; xx += 180) { // torce
        const f = 0.7 + 0.3 * Math.sin(t * 9 + xx); const gl = g.createRadialGradient(xx, y + 4, 1, xx, y + 4, 28); gl.addColorStop(0, `rgba(255,190,80,${0.8 * f})`); gl.addColorStop(1, 'rgba(255,190,80,0)');
        g.restore(); g.save(); g.fillStyle = gl; g.beginPath(); g.arc(xx, y + 4, 28, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffcf5a'; g.beginPath(); g.ellipse(xx, y, 4, 7 * f, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      }
      if (te === 'cripta' && w > 100) { g.font = '12px system-ui'; for (let xx = x + 30; xx < x + w - 10; xx += 110) g.fillText('💀', xx, y + h * 0.75); }
      if (te === 'vulcano') { g.strokeStyle = `rgba(255,110,30,${0.5 + 0.3 * Math.sin(t * 3 + x)})`; g.beginPath(); g.moveTo(x, y + h * 0.6); for (let xx = x; xx < x + w; xx += 30) g.lineTo(xx + 15, y + h * (xx % 60 ? 0.3 : 0.7)); g.stroke(); }
    }
    g.restore();
  }
  function zona(g, z, x, y, w, h, t) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (z === 'lava') {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#ff9a2e'); gr.addColorStop(0.5, '#e8461e'); gr.addColorStop(1, '#ff7a1e'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,230,120,.55)'; for (let k = 0; k < w / 40; k++) { const xx = x + ((k * 53 + t * 30) % w), yy = y + h * (0.3 + 0.4 * ((k * 7) % 5) / 5); g.beginPath(); g.ellipse(xx, yy, 14, 4 + 2 * Math.sin(t * 3 + k), 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(60,20,10,.35)'; for (let k = 0; k < w / 70; k++) { g.beginPath(); g.ellipse(x + ((k * 97 - t * 20) % w + w) % w, y + h * 0.6, 20, 6, 0, 0, Math.PI * 2); g.fill(); }
    } else if (z === 'ghiaccio') {
      g.fillStyle = '#a9d9f2'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; for (let k = 0; k < w / 30; k++) { const xx = x + k * 30; g.beginPath(); g.moveTo(xx, y + 8 + (k % 3) * 18); g.lineTo(xx + 22, y + (k % 3) * 18); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, w, 5);
    } else if (z === 'fango') {
      g.fillStyle = '#7a5a36'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(40,25,10,.35)'; for (let k = 0; k < w / 25; k++) { g.beginPath(); g.arc(x + k * 25 + 10, y + h * (0.3 + ((k * 13) % 5) / 8), 3 + (k % 3) + Math.sin(t * 2 + k), 0, Math.PI * 2); g.fill(); }
    } else { // acqua
      g.fillStyle = z === 'acqua' && TEMA_ATTUALE === 'palude' ? '#2c5a4a' : '#3d8fd0'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      for (let yy = y + 12; yy < y + h; yy += 18) { g.beginPath(); for (let xx = x; xx <= x + w; xx += 12) g.lineTo(xx, yy + Math.sin(xx / 20 + t * 3 + yy) * 3); g.stroke(); }
      if (TEMA_ATTUALE === 'palude') { g.fillStyle = '#5c9a44'; for (let k = 0; k < w / 90; k++) { const xx = x + 30 + k * 90, yy = y + h * 0.5 + ((k * 17) % 20) - 10; g.beginPath(); g.arc(xx, yy, 10, 0.3, Math.PI * 2 - 0.3); g.lineTo(xx, yy); g.fill(); } }
    }
    g.restore();
  }
  function ponte(g, te, z, x, y, w, h) {
    // bordo della zona intorno al ponte
    if (z === 'lava' || te === 'tempio') { g.fillStyle = te === 'tempio' ? '#bfa06a' : '#4a403c'; g.fillRect(x, y, w, h); g.strokeStyle = te === 'tempio' ? '#8a6a34' : '#2a2320'; g.lineWidth = 2; for (let yy = y; yy < y + h; yy += 22) g.strokeRect(x + 2, yy, w - 4, 22); return; }
    if (z === 'ghiaccio') { g.fillStyle = '#f6fbff'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(160,190,210,.4)'; for (let yy = y + 8; yy < y + h; yy += 16) g.fillRect(x + w / 2 - 6, yy, 4, 7); return; }
    g.fillStyle = '#8a5a30'; g.fillRect(x, y - 4, w, h + 8);
    g.strokeStyle = '#5e3a1a'; g.lineWidth = 2; for (let yy = y - 4; yy < y + h + 4; yy += 14) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
    g.fillStyle = '#5e3a1a'; g.fillRect(x - 4, y - 6, 6, h + 12); g.fillRect(x + w - 2, y - 6, 6, h + 12);
  }
  function pericolo(g, te, x, y, r, t) {
    g.save(); g.translate(x, y);
    if (te === 'cimitero') { // pipistrello
      const bat = Math.sin(t * 14) * 0.5;
      g.fillStyle = '#1b1b24'; g.beginPath(); g.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2); g.fill();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 5, -4); g.quadraticCurveTo(s * 20, -18 - bat * 10, s * 32, -6 + bat * 8); g.quadraticCurveTo(s * 24, 0, s * 20, 6); g.quadraticCurveTo(s * 14, 2, s * 6, 6); g.fill(); }
      g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(-3, -3, 1.8, 0, Math.PI * 2); g.arc(3, -3, 1.8, 0, Math.PI * 2); g.fill();
    } else if (te === 'castello' || te === 'palude') { // fantasmino / fuoco fatuo
      const c = te === 'palude' ? '120,255,190' : '170,200,255';
      const gl = g.createRadialGradient(0, 0, 2, 0, 0, r + 14); gl.addColorStop(0, `rgba(${c},.9)`); gl.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r + 14, 0, Math.PI * 2); g.fill();
      if (te === 'castello') { g.fillStyle = 'rgba(235,240,255,.95)'; g.beginPath(); g.arc(0, -3, 16, Math.PI, 0); for (let k = 0; k <= 4; k++) g.lineTo(16 - k * 8, 16 + (k % 2 ? -5 : 0) + Math.sin(t * 8 + k) * 2); g.closePath(); g.fill(); g.fillStyle = '#223'; g.beginPath(); g.arc(-5, -4, 3, 0, Math.PI * 2); g.arc(5, -4, 3, 0, Math.PI * 2); g.fill(); }
    } else if (te === 'cripta' || te === 'tempio') { // lama rotante
      g.rotate(t * 12);
      g.fillStyle = '#c9ced6'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, rr = k % 2 ? r * 0.7 : r * 1.05; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill();
      g.strokeStyle = '#7d828b'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#555'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
    } else if (te === 'foresta') { // tronco che rotola
      g.rotate(Math.PI / 2); g.fillStyle = '#7a4a26'; g.fillRect(-r * 1.3, -r * 0.6, r * 2.6, r * 1.2); g.strokeStyle = '#5a3418'; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(-r * 1.3, k * 6 + ((t * 60) % 12) - 6); g.lineTo(r * 1.3, k * 6 + ((t * 60) % 12) - 6); g.stroke(); }
      g.fillStyle = '#c69a62'; g.beginPath(); g.ellipse(r * 1.3, 0, 5, r * 0.6, 0, 0, Math.PI * 2); g.fill();
    } else if (te === 'ghiacciaio') { // palla di neve
      g.rotate(t * 5); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#b8d8ec'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * 0.6, 0.3, 2); g.stroke();
    } else { // palla di fuoco
      const gl = g.createRadialGradient(0, 0, 2, 0, 0, r + 12); gl.addColorStop(0, '#fff3a0'); gl.addColorStop(0.4, '#ff9a2e'); gl.addColorStop(1, 'rgba(230,60,20,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r + 12, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function fantasma(g, x, y, t) {
    g.save(); g.translate(x, y + Math.sin(t * 3 + x) * 6);
    g.fillStyle = 'rgba(235,240,255,.9)'; g.beginPath(); g.arc(0, 0, 28, Math.PI, 0);
    for (let k = 0; k <= 4; k++) g.lineTo(28 - k * 14, 30 + (k % 2 ? -8 : 0));
    g.closePath(); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.ellipse(-9, -4, 5, 8, 0, 0, Math.PI * 2); g.ellipse(9, -4, 5, 8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0, 12, 6, 8, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  let TEMA_ATTUALE = '';
  function decori(g, te, cam, W, H) {
    // piccole cose sul terreno che scorrono con la camera (solo decorazione)
    const passo = 90, y0 = Math.floor(cam / passo) * passo;
    for (let y = y0; y < cam + H + passo; y += passo) {
      const k = Math.abs(Math.round(y / passo));
      for (let j = 0; j < 3; j++) {
        const x = ((k * 211 + j * 367) % (W - 40)) + 20, yy = y + ((k * 37 + j * 53) % passo);
        if (te === 'foresta') { g.fillStyle = ['#f2d14a', '#e86a8a', '#ffffff'][(k + j) % 3]; g.beginPath(); g.arc(x, yy, 3, 0, Math.PI * 2); g.fill(); }
        else if (te === 'cimitero' || te === 'palude') { g.fillStyle = 'rgba(140,180,120,.25)'; g.fillRect(x, yy, 2, 8); g.fillRect(x + 4, yy + 2, 2, 7); }
        else if (te === 'cripta') { if ((k + j) % 4 === 0) { g.strokeStyle = 'rgba(230,220,200,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 8, yy); g.lineTo(x + 8, yy + 4); g.stroke(); } }
        else if (te === 'castello') { if (j === 0) { g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.strokeRect(x - 30, yy, 60, 40); } }
        else if (te === 'ghiacciaio') { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x, yy, 2, 0, Math.PI * 2); g.fill(); }
        else if (te === 'vulcano') { g.fillStyle = `rgba(255,110,30,${0.15 + 0.1 * ((k + j) % 3)})`; g.beginPath(); g.arc(x, yy, 3, 0, Math.PI * 2); g.fill(); }
        else if (te === 'tempio') { g.fillStyle = 'rgba(110,80,40,.18)'; g.fillRect(x, yy, 14, 3); }
      }
    }
    if (te === 'castello') { g.fillStyle = 'rgba(140,30,40,.35)'; g.fillRect(W / 2 - 70, cam - 10, 140, H + 20); g.fillStyle = 'rgba(210,170,70,.35)'; g.fillRect(W / 2 - 70, cam - 10, 6, H + 20); g.fillRect(W / 2 + 64, cam - 10, 6, H + 20); }
  }
  function disegna(modo) {
    return (g, p, s, prima, u, ctx) => {
      const W = p.W, H = p.H, te = s.s.te || (modo === 'fuga' ? 'cimitero' : 'foresta'), T = TEMA[te] || TEMA.foresta, notte = modo === 'fuga';
      TEMA_ATTUALE = te;
      const t = s.t;
      const cam = prima ? prima.s.cam + (s.s.cam - prima.s.cam) * u : s.s.cam;
      const sfondo = g.createLinearGradient(0, 0, 0, H); sfondo.addColorStop(0, T.cielo[0]); sfondo.addColorStop(1, T.cielo[1]);
      g.fillStyle = sfondo; g.fillRect(0, 0, W, H);
      g.fillStyle = T.erba;
      for (let y = -((cam % 80) + 80) % 80; y < H; y += 80) for (let x = ((y + cam) / 80) % 2 ? 40 : 0; x < W; x += 160) g.fillRect(x, y, 60, 6);
      g.save(); g.translate(0, -cam);
      decori(g, te, cam, W, H);
      if (s.s.fine !== null && s.s.fine > cam - 40 && s.s.fine < cam + H + 40) {
        for (let x = 0; x < W; x += 20) for (let k = 0; k < 2; k++) { g.fillStyle = (x / 20 + k) % 2 ? '#111' : '#fff'; g.fillRect(x, s.s.fine - 20 + k * 10, 20, 10); }
        g.fillStyle = te === 'ghiacciaio' || te === 'tempio' ? '#333' : '#fff'; g.font = '700 22px system-ui'; g.textAlign = 'center'; g.fillText('🏁 TRAGUARDO', W / 2, s.s.fine - 30);
      }
      // prima le zone e i ponti (sotto), poi i muri e i massi, poi i pericoli che si muovono
      for (const o of s.s.o) if (o.t === 2) zona(g, o.z, o.x, o.y, o.w, o.h, t);
      for (const o of s.s.o) if (o.t === 3) ponte(g, te, o.z, o.x, o.y, o.w, o.h);
      for (const o of s.s.o) if (o.t === 1) muro(g, te, o.x, o.y, o.w, o.h, t);
      for (const o of s.s.o) if (o.t === 0) masso(g, te, o.x, o.y, o.r, t);
      for (const m of s.s.mo) { g.fillStyle = '#f6c431'; g.beginPath(); g.arc(m.x, m.y, 10, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#b8860b'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#b8860b'; g.font = '700 11px system-ui'; g.textAlign = 'center'; g.fillText('€', m.x, m.y + 4); }
      const mob = lerp(prima && prima.s.o.filter((o) => o.t === 4), s.s.o.filter((o) => o.t === 4), u);
      for (const o of mob) pericolo(g, te, o.x, o.y, o.r, t);
      const ee = lerp(prima && prima.s.e, s.s.e, u);
      ee.forEach((e, i) => { if (!e.f && !e.a) omino(g, e.x, e.y, 15, COLORI[i % COLORI.length], i === ctx.mio ? 'Tu' : ctx.nome(i).slice(0, 10), { io: i === ctx.mio, alfa: (e.im && Math.floor(t * 10) % 2 ? 0.35 : 1) * (i === ctx.mio ? 1 : 0.85), stordito: e.st }); });
      g.restore();
      // nebbia nelle ambientazioni di notte
      if (notte) { const nb = g.createLinearGradient(0, 0, 0, 120); nb.addColorStop(0, 'rgba(10,10,20,.55)'); nb.addColorStop(1, 'rgba(10,10,20,0)'); g.fillStyle = nb; g.fillRect(0, 0, W, 120); }
      // il fondo: i fantasmi (o la nebbia di chi resta indietro)
      const fondo = g.createLinearGradient(0, H - 90, 0, H); fondo.addColorStop(0, notte ? 'rgba(180,190,255,0)' : 'rgba(40,30,20,0)'); fondo.addColorStop(1, notte ? 'rgba(180,190,255,.55)' : 'rgba(40,30,20,.6)');
      g.fillStyle = fondo; g.fillRect(0, H - 90, W, 90);
      if (notte) for (let k = 0; k < 9; k++) fantasma(g, 60 + k * 110, H - 18, t + k);
      else { g.fillStyle = 'rgba(200,40,30,.8)'; g.fillRect(0, H - 6, W, 6); }
      // nome dell'ambientazione nei primi secondi
      if (t < 4) { g.globalAlpha = Math.min(1, (4 - t) / 1.2); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(W / 2 - 170, 18, 340, 44); g.fillStyle = '#fff'; g.font = '700 22px system-ui'; g.textAlign = 'center'; g.fillText(NOME_TEMA[te] || '', W / 2, 48); g.globalAlpha = 1; }
    };
  }
  const base = (modo) => ({
    id: modo,
    obiettivo: modo === 'fuga' ? 'secondi di fuga' : 'monete e arrivi',
    istruzioni: () => (modo === 'fuga' ? 'WASD o frecce (sul telefono il joystick): sali e scappa! Chi tocca il fondo viene preso dai fantasmi.' : 'WASD o frecce (sul telefono il joystick): raccogli le monete e arriva in cima. Chi resta indietro è fuori.'),
    statoGioco: (ctx, s) => { const e = s.s.e[ctx.mio]; return !e ? '' : e.f ? 'Sei fuori: guarda gli altri' : e.a ? 'Sei arrivato!' : modo === 'fuga' ? 'Scappa!' : s.s.cd != null ? `Sali! ${s.s.cd} s per arrivare` : 'Sali!'; },
    sottotitolo: () => '',
    hud: (ctx, s) => (modo === 'fuga' ? `<span>${NOME_TEMA[s.s.te] || ''}</span><span>⏱️ ${Math.floor(s.t)} s</span><span>🏃 in fuga: ${s.s.e.filter((e) => !e.f).length}</span>`
      : `<span>${NOME_TEMA[s.s.te] || ''}</span><span>🪙 ${s.s.e[ctx.mio] ? s.s.e[ctx.mio].m : 0} monete</span><span class="sa-barra"><i style="width:${Math.round(s.s.prog * 100)}%"></i></span><span>${Math.round(s.s.prog * 100)}%</span>${s.s.cd != null ? `<span class="sa-chiude">⏳ ${s.s.cd} s</span>` : ''}`),
    fineRound: (p, s, ctx) => `Punti totali: ${p.punti[ctx.mio]}`,
    disegna: disegna(modo),
    dopoTick(ctx, d, prima) {
      const a = prima && prima.s.e[ctx.mio], b = d.s.e[ctx.mio];
      if (a && b && b.m > a.m) window.Nuovi.suono([[880, 0.04], [1175, 0.06]], { volume: 0.04 });
      if (a && b && b.salto > a.salto) window.Nuovi.suono([[220, 0.08], [140, 0.15]], { tipo: 'square', volume: 0.07 });
      if (a && b && !a.f && b.f) window.Nuovi.suono([[300, 0.1], [150, 0.3]], { volume: 0.08 });
    },
  });
  Object.assign(window.Tavoli, { fuga: window.Arena.tavolo(base('fuga')), monete: window.Arena.tavolo(base('monete')) });
})();
