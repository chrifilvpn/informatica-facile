// Le course di Minigolf Party 3D (usate dal server e dal browser, che lo scarica da /js/putt-buche.js).
// Sette course: la Classica (le 9 buche di prima, ingrandite), cinque a tema (Pirati, Ghiaccio, Giungla, Spazio,
// Colline), ognuna con più di 6 buche disegnate (a ogni partita se ne giocano 6 a caso), più l'Open Course: una mappa
// unica e grande con 6 buche in fila. Il campo è una pianta (x, y) con l'altezza data da quota(b, x, y): dossi
// [{ x, y, r, h }] (h negativo = conca) e pendii [{ x, y, a, l, h }] (una fascia che sale di h lungo la direzione a,
// per l lunghezza, da un capo all'altro della buca). La pallina li sente (scende dai pendii, si ferma nelle conche) e
// il browser li disegna in 3D.
// Ogni buca ha la sua grandezza (W × H, più grande dello schermo: la telecamera segue la pallina) e:
//   bordo (poligono), muri (segmenti alti), muretti (segmenti bassi: si saltano con le rampe),
//   respingenti [x, y, r] (rilanciano forte), rocce [x, y, r] (rimbalzo normale: palme, pinguini, statue…),
//   mobili [{ x, y, ax, ay, per, fase, r }] (cerchi che si muovono avanti e indietro: casse, pinguini, asteroidi),
//   zone di terreno [x, y, larghezza, altezza]: sabbia, neve, fango (rallentano), ghiaccio (fa scivolare),
//   acqua (si torna indietro con un colpo di penalità), buchiNeri [{ x, y, r, f }] (attirano; nel centro = come l'acqua),
//   mulini, scorrevoli (asse y oppure x), rampe [{ r: [x, y, w, h], a: angolo }] (si salta sopra muretti, acqua e sabbia),
//   tubi [{ a: [x, y], b: [x, y] }] (entri da a ed esci da b, con la stessa velocità), pu [[x, y]] (scatole dei power-up),
//   partenza, buca, par, nome.
(function (radice, fabbrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabbrica();
  else radice.PuttBuche = fabbrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const R_PALLA = 8, R_BUCA = 13, R_TUBO = 20, R_SCATOLA = 16;
  const PI = Math.PI;

  // una corsia larga l lungo una spezzata: il poligono del bordo (angoli a spigolo vivo)
  function corsia(punti, l) {
    const n = punti.length, sx = [], dx = [], h = l / 2;
    for (let i = 0; i < n; i++) {
      const p = punti[i], a = punti[Math.max(0, i - 1)], b = punti[Math.min(n - 1, i + 1)];
      const d1 = norm(i === 0 ? [b[0] - p[0], b[1] - p[1]] : [p[0] - a[0], p[1] - a[1]]);
      const d2 = norm(i === n - 1 ? [p[0] - a[0], p[1] - a[1]] : [b[0] - p[0], b[1] - p[1]]);
      const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
      let m = norm([n1[0] + n2[0], n1[1] + n2[1]]); const c = m[0] * n2[0] + m[1] * n2[1];
      const k = h / Math.max(0.35, c);
      sx.push([Math.round(p[0] + m[0] * k), Math.round(p[1] + m[1] * k)]);
      dx.push([Math.round(p[0] - m[0] * k), Math.round(p[1] - m[1] * k)]);
    }
    return sx.concat(dx.reverse());
  }
  function norm([x, y]) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
  const rett = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const ottagono = (cx, cy, r) => Array.from({ length: 8 }, (_, k) => [Math.round(cx + r * Math.cos(PI / 8 + (k * PI) / 4)), Math.round(cy + r * Math.sin(PI / 8 + (k * PI) / 4))]);

  // ---------------- CLASSICA: le 9 buche di prima, ingrandite 1,6 volte ----------------
  const VECCHIE = [
    { id: 'rettilineo', nome: 'Il rettilineo', par: 2, bordo: [[100, 220], [900, 220], [900, 380], [100, 380]], partenza: [170, 300], buca: [820, 300], pu: [[500, 300]] },
    { id: 'curva', nome: 'La curva a L', par: 3, bordo: [[100, 90], [380, 90], [380, 390], [900, 390], [900, 540], [100, 540]], partenza: [240, 170], buca: [820, 465], pu: [[240, 465]] },
    { id: 'respingenti', nome: 'I respingenti', par: 3, bordo: [[100, 120], [900, 120], [900, 480], [100, 480]], partenza: [170, 300], buca: [840, 300],
      respingenti: [[400, 215, 38], [400, 385, 38], [600, 300, 44], [760, 195, 26], [760, 405, 26]], pu: [[500, 150], [500, 450]] },
    { id: 'sabbia', nome: 'La trappola di sabbia', par: 3, bordo: [[100, 180], [900, 180], [900, 440], [100, 440]], partenza: [170, 300], buca: [835, 300],
      muri: [[480, 180, 480, 340]], sabbia: [[640, 220, 130, 180]], pu: [[400, 400]] },
    { id: 'ponte', nome: 'Il ponte sull\'acqua', par: 2, bordo: [[80, 120], [920, 120], [920, 480], [80, 480]], partenza: [160, 300], buca: [840, 300],
      acqua: [[330, 120, 340, 150], [330, 330, 340, 150]], pu: [[250, 200]] },
    { id: 'zigzag', nome: 'Lo zig-zag', par: 4, bordo: [[100, 80], [900, 80], [900, 520], [100, 520]], partenza: [190, 150], buca: [810, 460],
      muri: [[300, 80, 300, 400], [500, 200, 500, 520], [700, 80, 700, 400]], pu: [[400, 460], [600, 140]] },
    { id: 'mulino', nome: 'Il mulino a vento', par: 3, bordo: [[100, 150], [900, 150], [900, 450], [100, 450]], partenza: [180, 300], buca: [825, 300],
      muri: [[600, 150, 600, 245], [600, 355, 600, 450]], mulini: [{ x: 600, y: 300, l: 80, w: 1.5, pale: 2 }], sabbia: [[330, 150, 90, 70], [330, 380, 90, 70]], pu: [[450, 300]] },
    { id: 'porte', nome: 'Le porte mobili', par: 3, bordo: [[80, 100], [920, 100], [920, 500], [80, 500]], partenza: [160, 300], buca: [845, 300],
      muri: [[380, 100, 380, 240], [380, 360, 380, 500], [640, 100, 640, 240], [640, 360, 640, 500]],
      scorrevoli: [{ x: 370, y0: 170, y1: 430, w: 20, h: 110, periodo: 2.6, fase: 0 }, { x: 630, y0: 170, y1: 430, w: 20, h: 110, periodo: 1.9, fase: 1.3 }], pu: [[510, 300]] },
    { id: 'labirinto', nome: 'Il labirinto', par: 6, bordo: [[60, 60], [940, 60], [940, 540], [60, 540]], partenza: [140, 480], buca: [870, 470],
      muri: [[220, 60, 220, 420], [380, 180, 380, 540], [540, 60, 540, 420], [700, 180, 700, 540]],
      acqua: [[548, 475, 144, 65]], sabbia: [[390, 60, 140, 60]], mulini: [{ x: 820, y: 300, l: 62, w: -1.9, pale: 3 }], pu: [[300, 120], [620, 300]] },
  ];
  function ingrandisci(b, k) {
    const p = ([x, y]) => [Math.round(x * k), Math.round(y * k)];
    const r4 = ([x, y, w, h]) => [x * k, y * k, w * k, h * k].map(Math.round);
    return { ...b, W: Math.round(1000 * k), H: Math.round(600 * k), bordo: b.bordo.map(p), partenza: p(b.partenza), buca: p(b.buca), pu: (b.pu || []).map(p),
      muri: (b.muri || []).map((s) => s.map((v) => Math.round(v * k))), respingenti: (b.respingenti || []).map(([x, y, r]) => [Math.round(x * k), Math.round(y * k), Math.round(r * k * 0.85)]),
      sabbia: (b.sabbia || []).map(r4), acqua: (b.acqua || []).map(r4),
      mulini: (b.mulini || []).map((m) => ({ ...m, x: m.x * k, y: m.y * k, l: m.l * k })),
      scorrevoli: (b.scorrevoli || []).map((s) => ({ ...s, x: s.x * k, y0: s.y0 * k, y1: s.y1 * k, w: s.w * k, h: s.h * k })) };
  }
  const CLASSICA = VECCHIE.map((b) => ingrandisci(b, 1.6));

  // ---------------- SPIAGGIA DEI PIRATI ----------------
  const PIRATI = [
    { id: 'sbarco', nome: 'Lo sbarco', par: 3, W: 1800, H: 1000, bordo: corsia([[150, 700], [900, 700], [1600, 300]], 240), partenza: [220, 700], buca: [1540, 330],
      acqua: [[600, 580, 160, 70]], rocce: [[1050, 560, 26], [1230, 500, 26]], pu: [[900, 760]] },
    { id: 'pontile', nome: 'Il pontile', par: 3, W: 2000, H: 900, bordo: rett(120, 250, 1760, 400), partenza: [200, 450], buca: [1780, 450],
      acqua: [[800, 250, 300, 170], [800, 480, 300, 170]], rocce: [[500, 330, 24], [500, 570, 24], [1400, 450, 30]], pu: [[650, 450], [1500, 330]] },
    { id: 'baia', nome: 'La baia a U', par: 4, W: 1800, H: 1100, bordo: corsia([[200, 250], [1500, 250], [1500, 850], [220, 850]], 240), partenza: [250, 250], buca: [280, 850],
      rocce: [[900, 200, 22], [900, 300, 22], [1450, 560, 26]], mobili: [{ x: 900, y: 850, ax: 0, ay: 80, per: 3, fase: 0, r: 30 }], pu: [[1500, 700]] },
    { id: 'relitto', nome: 'Il relitto', par: 3, W: 1800, H: 1100, bordo: rett(120, 120, 1560, 860), partenza: [220, 550], buca: [1560, 550],
      muri: [[600, 250, 900, 480], [600, 850, 900, 620], [1100, 380, 1100, 720]], respingenti: [[800, 550, 40], [1300, 300, 34], [1300, 800, 34]], acqua: [[1180, 120, 400, 110], [1180, 870, 400, 110]], pu: [[400, 300], [400, 800]] },
    { id: 'tesoro', nome: 'L\'isola del tesoro', par: 3, W: 1700, H: 1300, bordo: ottagono(850, 650, 580), partenza: [400, 650], buca: [990, 650],
      acqua: [[680, 380, 60, 540], [740, 380, 460, 60], [740, 860, 460, 60], [1140, 440, 60, 420]], rampe: [{ r: [580, 610, 90, 80], a: 0 }], rocce: [[930, 560, 18]], pu: [[850, 250], [850, 1050]] },
    { id: 'timone', nome: 'Il timone', par: 3, W: 1900, H: 900, bordo: corsia([[150, 450], [800, 450], [1100, 300], [1750, 300]], 280), partenza: [230, 450], buca: [1680, 300],
      mulini: [{ x: 950, y: 380, l: 110, w: 1.4, pale: 3 }], sabbia: [[1300, 180, 140, 90]], pu: [[500, 360]] },
    { id: 'cannoniere', nome: 'Le cannoniere', par: 4, W: 1900, H: 1200, bordo: corsia([[150, 200], [1000, 200], [400, 700], [1700, 950]], 230), partenza: [230, 200], buca: [1620, 930],
      mobili: [{ x: 750, y: 470, ax: 110, ay: 0, per: 2.4, fase: 0, r: 22 }, { x: 1100, y: 820, ax: 0, ay: 90, per: 2, fase: 1, r: 22 }], rocce: [[1350, 900, 24]], pu: [[850, 220], [900, 790]] },
    { id: 'squalo', nome: 'Il salto dello squalo', par: 2, W: 2000, H: 800, bordo: rett(120, 200, 1760, 400), partenza: [200, 400], buca: [1760, 400],
      acqua: [[800, 200, 380, 400]], rampe: [{ r: [620, 330, 110, 140], a: 0 }], rocce: [[1400, 290, 24], [1400, 510, 24]], pu: [[400, 300]] },
  ];

  // ---------------- GHIACCIO ----------------
  const GHIACCIO = [
    { id: 'pista', nome: 'La pista', par: 2, W: 2200, H: 700, bordo: rett(120, 200, 1960, 300), partenza: [200, 350], buca: [1980, 350],
      ghiaccio: [[500, 200, 900, 300]], neve: [[1600, 200, 240, 300]], rocce: [[1000, 280, 22], [1000, 420, 22]], pu: [[400, 260]] },
    { id: 'pinguino', nome: 'La curva del pinguino', par: 3, W: 1700, H: 1200, bordo: corsia([[200, 250], [1300, 250], [1300, 1000]], 260), partenza: [260, 250], buca: [1300, 930],
      ghiaccio: [[500, 120, 600, 260]], mobili: [{ x: 1300, y: 550, ax: 90, ay: 0, per: 2.6, fase: 0, r: 26 }, { x: 800, y: 250, ax: 0, ay: 80, per: 3, fase: 1.5, r: 24 }], pu: [[1250, 380]] },
    { id: 'lago', nome: 'Il lago ghiacciato', par: 3, W: 1900, H: 1200, bordo: rett(120, 120, 1660, 960), partenza: [230, 600], buca: [1640, 600],
      ghiaccio: [[400, 120, 1100, 960]], rocce: [[700, 400, 40], [700, 800, 40], [1000, 600, 50], [1300, 350, 36], [1300, 850, 36]], neve: [[1520, 480, 240, 240]], pu: [[1000, 250], [1000, 950]] },
    { id: 'iglu', nome: 'L\'iglù', par: 4, W: 1600, H: 1300, bordo: ottagono(800, 650, 560), partenza: [320, 650], buca: [800, 650],
      muri: [[700, 450, 900, 450], [900, 450, 1000, 550], [1000, 550, 1000, 750], [1000, 750, 900, 850], [900, 850, 700, 850], [700, 850, 600, 750], [600, 750, 600, 700], [600, 600, 600, 550], [600, 550, 700, 450]],
      ghiaccio: [[400, 250, 800, 160], [400, 890, 800, 160]], neve: [[610, 470, 380, 360]], pu: [[800, 330], [1150, 650]] },
    { id: 'slalom', nome: 'Lo slalom', par: 3, W: 2200, H: 800, bordo: rett(120, 150, 1960, 500), partenza: [200, 400], buca: [1990, 400],
      ghiaccio: [[300, 150, 1400, 500]], rocce: [[500, 280, 20], [700, 520, 20], [900, 280, 20], [1100, 520, 20], [1300, 280, 20], [1500, 520, 20], [1700, 400, 20]], pu: [[800, 400]] },
    { id: 'crepacci', nome: 'I crepacci', par: 3, W: 2000, H: 1000, bordo: rett(120, 150, 1760, 700), partenza: [200, 500], buca: [1780, 500],
      acqua: [[600, 150, 90, 280], [600, 570, 90, 280], [1150, 150, 90, 190], [1150, 400, 90, 450]], ghiaccio: [[690, 150, 460, 700]], pu: [[900, 500], [1450, 300]] },
    { id: 'valanga', nome: 'La valanga', par: 3, W: 2000, H: 1000, bordo: rett(120, 150, 1760, 700), partenza: [200, 500], buca: [1780, 500],
      scorrevoli: [{ asse: 'x', y: 260, x0: 500, x1: 1500, w: 180, h: 60, periodo: 3.2, fase: 0 }, { asse: 'x', y: 470, x0: 500, x1: 1500, w: 180, h: 60, periodo: 2.5, fase: 1.4 }, { asse: 'x', y: 680, x0: 500, x1: 1500, w: 180, h: 60, periodo: 2.8, fase: 2.2 }],
      neve: [[300, 150, 150, 700]], ghiaccio: [[1550, 150, 120, 700]], pu: [[1000, 180]] },
    { id: 'spirale', nome: 'La spirale gelata', par: 5, W: 1800, H: 1400, bordo: corsia([[200, 200], [1600, 200], [1600, 1200], [300, 1200], [300, 500], [1250, 500], [1250, 900], [700, 900]], 220), partenza: [260, 200], buca: [760, 900],
      ghiaccio: [[500, 90, 800, 220], [1490, 400, 220, 600], [500, 1090, 800, 220]], rocce: [[900, 470, 22]], pu: [[1600, 1150], [300, 800]] },
  ];

  // ---------------- TEMPIO NELLA GIUNGLA ----------------
  const GIUNGLA = [
    { id: 'sentiero', nome: 'Il sentiero', par: 3, W: 2000, H: 1000, bordo: corsia([[150, 700], [600, 300], [1100, 700], [1800, 300]], 230), partenza: [230, 660], buca: [1730, 330],
      fango: [[520, 250, 170, 120], [1030, 640, 170, 110]], rocce: [[850, 470, 24]], pu: [[850, 560]] },
    { id: 'fiume', nome: 'Il fiume', par: 2, W: 2000, H: 900, bordo: rett(120, 200, 1760, 500), partenza: [200, 450], buca: [1760, 450],
      acqua: [[850, 200, 240, 500]], rampe: [{ r: [680, 380, 110, 140], a: 0 }], rocce: [[1400, 330, 26], [1450, 570, 26]], pu: [[450, 300]] },
    { id: 'statue', nome: 'Le statue', par: 3, W: 1800, H: 1100, bordo: rett(120, 120, 1560, 860), partenza: [220, 550], buca: [1560, 550],
      rocce: [[550, 350, 40], [550, 750, 40], [900, 550, 46], [1250, 350, 40], [1250, 750, 40]], respingenti: [[900, 250, 30], [900, 850, 30]], fango: [[1380, 470, 90, 160]], pu: [[720, 550], [1100, 550]] },
    { id: 'tronchi', nome: 'I tronchi rotanti', par: 3, W: 2000, H: 900, bordo: rett(120, 200, 1760, 500), partenza: [200, 450], buca: [1780, 450],
      mulini: [{ x: 700, y: 450, l: 130, w: 1.2, pale: 2 }, { x: 1250, y: 450, l: 130, w: -1.5, pale: 2 }], fango: [[950, 200, 100, 150], [950, 550, 100, 150]], pu: [[980, 450]] },
    { id: 'tempio', nome: 'Il tempio', par: 4, W: 1800, H: 1300, bordo: rett(120, 120, 1560, 1060), partenza: [220, 1080], buca: [1500, 220],
      muri: [[120, 900, 1200, 900], [480, 650, 1680, 650], [120, 400, 1200, 400]], fango: [[1300, 700, 200, 150], [300, 450, 200, 150]], rocce: [[700, 1000, 26], [1000, 780, 26], [700, 530, 26]], pu: [[1500, 1000], [300, 800]] },
    { id: 'mobili', nome: 'Le sabbie mobili', par: 3, W: 1900, H: 1100, bordo: rett(120, 120, 1660, 860), partenza: [220, 550], buca: [1660, 550],
      fango: [[450, 120, 350, 330], [450, 650, 350, 330], [1000, 300, 300, 500], [1450, 120, 160, 250], [1450, 730, 160, 250]], pu: [[900, 200], [900, 900]] },
    { id: 'cascata', nome: 'La cascata', par: 4, W: 1900, H: 1300, bordo: corsia([[200, 250], [1600, 250], [1600, 650], [300, 650], [300, 1050], [1650, 1050]], 230), partenza: [260, 250], buca: [1580, 1050],
      acqua: [[800, 560, 200, 180]], scorrevoli: [{ asse: 'x', y: 610, x0: 750, x1: 1050, w: 90, h: 80, periodo: 3, fase: 0 }], fango: [[1000, 960, 150, 180]], pu: [[1600, 450], [300, 850]] },
    { id: 'serpente', nome: 'Il serpente', par: 4, W: 2200, H: 1100, bordo: corsia([[150, 300], [550, 800], [950, 300], [1350, 800], [1750, 300], [2050, 550]], 210), partenza: [210, 360], buca: [2000, 520],
      fango: [[900, 230, 120, 120]], rocce: [[550, 700, 22], [1350, 700, 22]], pu: [[1150, 550]] },
  ];

  // ---------------- SPAZIO ----------------
  const SPAZIO = [
    { id: 'decollo', nome: 'Il decollo', par: 2, W: 2100, H: 800, bordo: rett(120, 200, 1860, 400), partenza: [200, 400], buca: [1880, 400],
      mobili: [{ x: 800, y: 400, ax: 0, ay: 140, per: 2.6, fase: 0, r: 34 }, { x: 1300, y: 400, ax: 0, ay: 140, per: 2, fase: 1.6, r: 30 }], pu: [[500, 300]] },
    { id: 'buconero', nome: 'Il buco nero', par: 3, W: 1800, H: 1200, bordo: rett(120, 120, 1560, 960), partenza: [230, 600], buca: [1570, 600],
      buchiNeri: [{ x: 900, y: 600, r: 230, f: 700 }], respingenti: [[900, 250, 30], [900, 950, 30]], pu: [[600, 300], [600, 900]] },
    { id: 'saturno', nome: 'Gli anelli di Saturno', par: 3, W: 1800, H: 1200, bordo: rett(120, 120, 1560, 960), partenza: [230, 1000], buca: [1560, 220],
      respingenti: [[600, 700, 60], [1000, 450, 70], [1300, 800, 50], [500, 300, 40], [1400, 350, 36]], mobili: [{ x: 900, y: 800, ax: 150, ay: 0, per: 3.4, fase: 0, r: 26 }], pu: [[800, 1000], [1450, 600]] },
    { id: 'portali', nome: 'I portali', par: 2, W: 2000, H: 900, bordo: rett(120, 200, 1760, 500), partenza: [200, 450], buca: [1760, 450],
      muri: [[1000, 200, 1000, 700]], tubi: [{ a: [800, 300], b: [1200, 600] }, { a: [800, 600], b: [1200, 300] }], rocce: [[1500, 450, 28]], pu: [[500, 450]] },
    { id: 'asteroidi', nome: 'La cintura di asteroidi', par: 3, W: 2200, H: 1000, bordo: rett(120, 150, 1960, 700), partenza: [200, 500], buca: [1990, 500],
      mobili: [{ x: 600, y: 350, ax: 0, ay: 150, per: 2.2, fase: 0, r: 30 }, { x: 850, y: 650, ax: 0, ay: 150, per: 2.8, fase: 1, r: 36 }, { x: 1100, y: 400, ax: 0, ay: 180, per: 2.4, fase: 2, r: 28 }, { x: 1350, y: 600, ax: 0, ay: 160, per: 3, fase: 0.5, r: 34 }, { x: 1600, y: 450, ax: 0, ay: 170, per: 2.6, fase: 2.6, r: 30 }], pu: [[1000, 220], [1000, 780]] },
    { id: 'stazione', nome: 'La stazione orbitale', par: 4, W: 1800, H: 1400, bordo: corsia([[250, 250], [1550, 250], [1550, 1150], [250, 1150], [250, 600], [1150, 600]], 240), partenza: [300, 250], buca: [1080, 600],
      mulini: [{ x: 1550, y: 700, l: 100, w: 1.3, pale: 2 }], mobili: [{ x: 900, y: 1150, ax: 200, ay: 0, per: 3, fase: 0, r: 28 }], pu: [[900, 250], [250, 900]] },
    { id: 'gravita', nome: 'La gravità doppia', par: 3, W: 2000, H: 1100, bordo: rett(120, 120, 1760, 860), partenza: [230, 550], buca: [1770, 550],
      buchiNeri: [{ x: 700, y: 350, r: 200, f: 650 }, { x: 1250, y: 750, r: 200, f: 650 }], rocce: [[1000, 550, 30]], pu: [[700, 800], [1250, 300]] },
    { id: 'vuoto', nome: 'Il salto nel vuoto', par: 3, W: 2200, H: 900, bordo: rett(120, 200, 1960, 500), partenza: [200, 450], buca: [1990, 450],
      acqua: [[650, 200, 250, 500], [1350, 200, 250, 500]], rampe: [{ r: [500, 380, 110, 140], a: 0 }, { r: [1200, 380, 110, 140], a: 0 }], mobili: [{ x: 1080, y: 450, ax: 0, ay: 140, per: 2.4, fase: 0, r: 24 }], pu: [[1050, 280]] },
  ];

  // ---------------- LE COLLINE: dossi, conche e pendii (la pallina sale, scende e si ferma nelle conche) ----------------
  const COLLINE = [
    { id: 'dosso', nome: 'Il dosso', par: 2, W: 2000, H: 900, bordo: rett(120, 250, 1760, 400), partenza: [200, 450], buca: [1780, 450],
      dossi: [{ x: 1000, y: 450, r: 260, h: 45 }], rocce: [[1450, 340, 26]], pu: [[600, 330]] },
    { id: 'conca', nome: 'La conca', par: 3, W: 1800, H: 1100, bordo: rett(120, 120, 1560, 860), partenza: [220, 550], buca: [1560, 550],
      dossi: [{ x: 900, y: 550, r: 330, h: -55 }], mobili: [{ x: 900, y: 230, ax: 220, ay: 0, per: 4, fase: 0, r: 26 }], rocce: [[1250, 850, 28]], pu: [[900, 950]] },
    { id: 'salita', nome: 'La salita', par: 3, W: 1950, H: 950, bordo: corsia([[150, 700], [1000, 700], [1000, 250], [1800, 250]], 260), partenza: [220, 700], buca: [1720, 250],
      pendii: [{ x: 1000, y: 560, a: -PI / 2, l: 180, h: 45 }], rocce: [[1300, 180, 24]], pu: [[600, 760]] },
    { id: 'onde', nome: 'Le onde', par: 3, W: 2200, H: 900, bordo: rett(120, 200, 1960, 500), partenza: [200, 450], buca: [1990, 450],
      dossi: [{ x: 600, y: 450, r: 170, h: 38 }, { x: 900, y: 450, r: 150, h: -30 }, { x: 1200, y: 450, r: 170, h: 38 }, { x: 1500, y: 450, r: 150, h: -30 }], pu: [[1050, 270]] },
    { id: 'cratere', nome: 'Il cratere', par: 3, W: 1700, H: 1300, bordo: ottagono(850, 650, 560), partenza: [400, 650], buca: [850, 650],
      dossi: [{ x: 850, y: 650, r: 400, h: 85 }, { x: 850, y: 650, r: 110, h: -35 }], pu: [[850, 200], [850, 1100]] },
    { id: 'fienile', nome: 'Il fienile', par: 4, W: 1900, H: 1100, bordo: rett(120, 120, 1660, 860), partenza: [220, 550], buca: [1700, 550],
      muri: [[700, 120, 700, 750], [1200, 350, 1200, 980]], pendii: [{ x: 1300, y: 0, a: 0, l: 400, h: -60 }],
      rocce: [[450, 350, 30], [450, 750, 30]], mobili: [{ x: 950, y: 550, ax: 0, ay: 250, per: 3.5, fase: 0, r: 26 }], pu: [[950, 230], [950, 870]] },
    { id: 'mulino', nome: 'Il mulino sulla collina', par: 3, W: 2000, H: 900, bordo: rett(120, 200, 1760, 500), partenza: [200, 450], buca: [1780, 450],
      pendii: [{ x: 450, y: 0, a: 0, l: 300, h: 55 }, { x: 1250, y: 0, a: 0, l: 300, h: -55 }], mulini: [{ x: 1000, y: 450, l: 130, w: 1.3, pale: 2 }], pu: [[1000, 270]] },
    { id: 'gobbe', nome: 'Le gobbe del cammello', par: 4, W: 1900, H: 1300, bordo: corsia([[200, 250], [1600, 250], [1600, 1050], [250, 1050]], 250), partenza: [260, 250], buca: [320, 1050],
      dossi: [{ x: 800, y: 250, r: 150, h: 35 }, { x: 1600, y: 650, r: 170, h: -40 }, { x: 900, y: 1050, r: 150, h: 35 }], mobili: [{ x: 1250, y: 1050, ax: 0, ay: 80, per: 3, fase: 1, r: 24 }], pu: [[1600, 450], [600, 1050]] },
  ];

  // ---------------- OPEN COURSE: una mappa sola, 6 buche in fila su un percorso a serpentina ----------------
  // Si intreccia: i tubi passano sotto le altre corsie e ti portano a un'altra fila, le rampe saltano l'acqua e i muretti.
  const OPEN_W = 3800, OPEN_H = 2500;
  const openBase = {
    W: OPEN_W, H: OPEN_H,
    bordo: corsia([[200, 300], [3500, 300], [3500, 950], [300, 950], [300, 1600], [3500, 1600], [3500, 2250], [300, 2250]], 300),
    muretti: [[1500, 150, 1500, 450], [2800, 1450, 2800, 1750], [1200, 2100, 1200, 2400]],
    rampe: [{ r: [1330, 240, 110, 120], a: 0 }, { r: [2600, 1540, 110, 120], a: 0 }, { r: [1370, 2190, 110, 120], a: PI }, { r: [2300, 890, 110, 120], a: PI }, { r: [720, 1540, 110, 120], a: 0 }, { r: [2700, 2190, 110, 120], a: PI }],
    acqua: [[2150, 820, 120, 260], [900, 1470, 140, 260], [2500, 2120, 150, 260]],
    sabbia: [[2900, 180, 200, 120], [700, 820, 180, 120], [3100, 2130, 180, 110]],
    respingenti: [[2000, 300, 40], [1800, 1600, 44], [2000, 2250, 36]],
    rocce: [[3350, 700, 30], [480, 1300, 30], [3350, 1950, 30]],
    mulini: [{ x: 1100, y: 950, l: 120, w: 1.3, pale: 2 }, { x: 3000, y: 1600, l: 120, w: -1.2, pale: 2 }],
    mobili: [{ x: 2400, y: 300, ax: 0, ay: 110, per: 2.4, fase: 0, r: 30 }, { x: 1600, y: 2250, ax: 0, ay: 110, per: 2.2, fase: 1, r: 30 }],
    // tubi: scorciatoie tra una fila e l'altra (passano sotto le corsie), ma ti lasciano più lontano dalla buca giusta
    tubi: [{ a: [3350, 420], b: [3350, 1480] }, { a: [450, 1080], b: [450, 2130] }],
    pu: [[900, 300], [3000, 950], [2200, 1600], [700, 2250], [3500, 620], [3500, 1900]],
  };
  const TAPPE = [
    { nome: 'Open 1 · La partenza', par: 3, partenza: [300, 300], buca: [1900, 380] },
    { nome: 'Open 2 · La prima curva', par: 4, partenza: [1900, 300], buca: [2700, 950] },
    { nome: 'Open 3 · Il mulino', par: 3, partenza: [2700, 950], buca: [800, 1000] },
    { nome: 'Open 4 · Il ritorno', par: 4, partenza: [600, 1600], buca: [2400, 1650] },
    { nome: 'Open 5 · La grande curva', par: 4, partenza: [2400, 1600], buca: [3200, 2250] },
    { nome: 'Open 6 · Il traguardo', par: 4, partenza: [3200, 2250], buca: [500, 2250] },
  ];
  const OPEN = TAPPE.map((t, i) => ({ ...openBase, id: `open${i + 1}`, ...t, aperta: true }));

  const COURSE = {
    classica: { nome: 'Classica', tema: 'classica', buche: CLASSICA },
    pirati: { nome: 'Spiaggia dei pirati', tema: 'pirati', buche: PIRATI },
    ghiaccio: { nome: 'Ghiaccio', tema: 'ghiaccio', buche: GHIACCIO },
    giungla: { nome: 'Tempio nella giungla', tema: 'giungla', buche: GIUNGLA },
    spazio: { nome: 'Spazio', tema: 'spazio', buche: SPAZIO },
    colline: { nome: 'Le colline', tema: 'colline', buche: COLLINE },
    open: { nome: 'Open Course', tema: 'open', buche: OPEN, fisse: true },
  };
  const NOMI_COURSE = Object.keys(COURSE);
  const BUCHE_PER_COURSE = 6;

  // segmenti fissi: bordo e muri (alti), muretti (bassi: le palline in volo ci passano sopra)
  function segmentiFissi(b) {
    const s = [];
    for (let i = 0; i < b.bordo.length; i++) { const p = b.bordo[i], q = b.bordo[(i + 1) % b.bordo.length]; s.push([p[0], p[1], q[0], q[1]]); }
    for (const m of b.muri || []) s.push(m);
    return s;
  }
  const segmentiBassi = (b) => b.muretti || [];
  // segmenti che si muovono, al tempo t (secondi dall'inizio della buca)
  function segmentiMobili(b, t) {
    const s = [];
    for (const m of b.mulini || []) {
      for (let k = 0; k < m.pale; k++) {
        const a = m.w * t + (k * Math.PI) / m.pale;
        const dx = Math.cos(a) * m.l, dy = Math.sin(a) * m.l;
        s.push([m.x - dx, m.y - dy, m.x + dx, m.y + dy]);
      }
    }
    for (const r of b.scorrevoli || []) {
      const [x, y, w, h] = rettScorrevole(r, t);
      s.push([x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]);
    }
    return s;
  }
  function posScorrevole(r, t) { const u = (Math.sin((2 * Math.PI * t) / r.periodo + r.fase) + 1) / 2; return r.asse === 'x' ? r.x0 + u * (r.x1 - r.w - r.x0) : r.y0 + u * (r.y1 - r.h - r.y0); }
  function rettScorrevole(r, t) { const v = posScorrevole(r, t); return r.asse === 'x' ? [v, r.y, r.w, r.h] : [r.x, v, r.w, r.h]; }
  // i cerchi che si muovono (casse, pinguini, asteroidi) al tempo t
  function mobiliAl(b, t) { return (b.mobili || []).map((m) => { const s = Math.sin((2 * Math.PI * t) / m.per + m.fase); return [m.x + m.ax * s, m.y + m.ay * s, m.r]; }); }
  const dentro = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
  function dentroPoligono(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }

  // l'altezza del campo (dossi e pendii) e la sua pendenza [dh/dx, dh/dy]
  function quota(b, x, y) {
    let h = 0;
    for (const d of b.dossi || []) { const r = Math.hypot(x - d.x, y - d.y); if (r < d.r) h += (d.h * (1 + Math.cos((PI * r) / d.r))) / 2; }
    for (const p of b.pendii || []) { const u = Math.max(0, Math.min(1, ((x - p.x) * Math.cos(p.a) + (y - p.y) * Math.sin(p.a)) / p.l)); h += p.h * u * u * (3 - 2 * u); }
    return h;
  }
  function pendenza(b, x, y) {
    let gx = 0, gy = 0;
    for (const d of b.dossi || []) {
      const dx = x - d.x, dy = y - d.y, r = Math.hypot(dx, dy);
      if (r >= d.r || r < 1e-6) continue;
      const k = (-d.h * PI * Math.sin((PI * r) / d.r)) / (2 * d.r) / r;
      gx += k * dx; gy += k * dy;
    }
    for (const p of b.pendii || []) {
      const c = Math.cos(p.a), s = Math.sin(p.a), u = ((x - p.x) * c + (y - p.y) * s) / p.l;
      if (u <= 0 || u >= 1) continue;
      const k = (p.h * 6 * u * (1 - u)) / p.l;
      gx += k * c; gy += k * s;
    }
    return [gx, gy];
  }

  // per compatibilità: BUCHE = le buche della Classica
  return { R_PALLA, R_BUCA, R_TUBO, R_SCATOLA, COURSE, NOMI_COURSE, BUCHE_PER_COURSE, BUCHE: CLASSICA, W: 1600, H: 960,
    quota, pendenza, segmentiFissi, segmentiBassi, segmentiMobili, posScorrevole, rettScorrevole, mobiliAl, dentro, dentroPoligono, corsia };
});
