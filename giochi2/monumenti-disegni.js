// DISEGNI DEI MONUMENTI per il quiz "Dove si trova?": un piccolo quadro SVG (viewBox 0 0 200 160) per i più famosi,
// al posto dell'emoji generica (🏛️, 🏙️, ⛪ andavano bene per dieci monumenti diversi). Fatti a mano con forme semplici:
// cielo, terreno e la sagoma riconoscibile del monumento. Chi non ha un disegno resta con la sua emoji.
const n = (x) => Math.round(x * 10) / 10;
function quadro(dentro, { cielo = '#bfe0f5', terra = '#8fbf7a', sole = true } = {}) {
  return `<rect width="200" height="160" rx="14" fill="${cielo}"/>${sole ? '<circle cx="170" cy="28" r="11" fill="#fff1b8"/>' : ''}`
    + `<path d="M0 138H200V146a14 14 0 0 1-14 14H14A14 14 0 0 1 0 146Z" fill="${terra}"/>${dentro}`;
}
const acqua = '#5b97c6', sabbia = '#e6cc92';
const ripeti = (k, f) => Array.from({ length: k }, (_, i) => f(i)).join('');
// punto su una curva quadratica (per i cavi dei ponti)
const quad = (t, a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
// sagoma simmetrica da una lista di punti del lato sinistro [x, y] (dal basso verso l'alto)
function simmetrica(pts, cx = 100) {
  const sx = pts.map(([x, y]) => `${n(x)} ${n(y)}`), dx = [...pts].reverse().map(([x, y]) => `${n(2 * cx - x)} ${n(y)}`);
  return `M${sx.join(' L')} L${dx.join(' L')} Z`;
}

const D = {
  'Torre Eiffel': quadro(`<path d="M58 138 L82 94 L89 62 L96 24 L98 14 H102 L104 24 L111 62 L118 94 L142 138 H128 Q100 100 72 138 Z" fill="#7a5640"/>
    <rect x="76" y="90" width="48" height="6" rx="1" fill="#5e412f"/><rect x="86" y="58" width="28" height="5" rx="1" fill="#5e412f"/>
    <path d="M100 14 V4" stroke="#5e412f" stroke-width="2"/>
    <path d="M88 96 L100 64 L112 96 M93 62 L100 30 L107 62" stroke="#a07a5e" stroke-width="1.2" fill="none"/>`),
  Colosseo: quadro(`<path d="M24 138 V80 Q100 64 176 80 V138 Z" fill="#d8b98a"/>
    <path d="M24 110 Q100 100 176 110 M24 92 Q100 80 176 92" stroke="#b8945f" stroke-width="2" fill="none"/>
    ${ripeti(10, (i) => `<rect x="${30 + i * 14.6}" y="114" width="8" height="21" rx="4" fill="#6e5236"/><rect x="${30 + i * 14.6}" y="${96 - Math.abs(4.5 - i) * 0.6}" width="8" height="12" rx="4" fill="#6e5236"/><rect x="${31.5 + i * 14.6}" y="${83 - Math.abs(4.5 - i) * 0.8}" width="5" height="4" fill="#8b6a46"/>`)}
    <path d="M140 66 L180 66 L180 102 L168 96 L158 100 L150 88 L144 84 Z" fill="#bfe0f5"/>`),
  'Big Ben': quadro(`<rect x="14" y="100" width="74" height="38" fill="#d6bd86"/>${ripeti(7, (i) => `<rect x="${19 + i * 10}" y="108" width="5" height="12" fill="#8a7346"/><rect x="${19 + i * 10}" y="124" width="5" height="10" fill="#8a7346"/>`)}
    <rect x="86" y="40" width="28" height="98" fill="#dcc48d"/><rect x="88" y="28" width="24" height="12" fill="#c9ad72"/>
    <path d="M86 28 L100 4 L114 28 Z" fill="#4c5a52"/><path d="M100 4 V0" stroke="#4c5a52" stroke-width="1.5"/>
    <circle cx="100" cy="56" r="10" fill="#fbf6e6" stroke="#5a4a2a" stroke-width="2"/><path d="M100 56 V49 M100 56 L105 59" stroke="#2a2a2a" stroke-width="1.5"/>
    ${ripeti(3, (i) => `<path d="M${92 + i * 8} 74 V134" stroke="#b39a62" stroke-width="1.5"/>`)}`),
  'Torre di Pisa': quadro(`<g transform="rotate(5 100 138)"><rect x="80" y="34" width="40" height="104" fill="#f3ecd9" stroke="#c9bd9f" stroke-width="1.5"/>
    ${ripeti(7, (i) => `<path d="M80 ${48 + i * 13} H120" stroke="#c9bd9f" stroke-width="1.5"/>${ripeti(4, (k) => `<rect x="${83 + k * 9.5}" y="${37 + i * 13}" width="5" height="9" rx="2.5" fill="#cbbf9f"/>`)}`)}
    <rect x="86" y="20" width="28" height="14" fill="#efe6cf" stroke="#c9bd9f" stroke-width="1.5"/>${ripeti(3, (k) => `<rect x="${89 + k * 8.5}" y="23" width="5" height="9" rx="2.5" fill="#cbbf9f"/>`)}</g>`),
  'Sagrada Família': quadro(`<rect x="36" y="100" width="128" height="38" fill="#c3a174"/>
    ${[[52, 70], [70, 50], [86, 36], [100, 18], [114, 36], [130, 50], [148, 70]].map(([x, h]) => `<path d="M${x - 7} 138 V${h + 20} Q${x} ${h - 8} ${x + 7} ${h + 20} V138 Z" fill="#c9a77a" stroke="#a5835a" stroke-width="1"/>${ripeti(Math.floor((118 - h) / 14), (k) => `<circle cx="${x}" cy="${h + 26 + k * 14}" r="1.8" fill="#7d6040"/>`)}<circle cx="${x}" cy="${h - 6}" r="3.2" fill="#e2b44a"/>`).join('')}
    <path d="M86 138 V116 Q100 100 114 116 V138 Z" fill="#6e5236"/>`),
  'Cristo Redentore': quadro(`<path d="M0 138 L36 122 L74 106 L92 98 H108 L128 104 L166 118 L200 128 V138 Z" fill="#5f8458"/>
    <rect x="94" y="92" width="12" height="8" fill="#cfcac0"/>
    <path d="M60 50 H140 L138 56 H106 L108 92 H92 L94 56 H62 Z" fill="#f4f2ec" stroke="#a9aeb3" stroke-width="1.2"/>
    <circle cx="100" cy="44" r="6" fill="#f4f2ec" stroke="#a9aeb3" stroke-width="1.2"/>`),
  'Piramidi di Giza': quadro(`<path d="M8 138 L30 110 L52 138 Z" fill="#e0bd72"/><path d="M30 110 L52 138 H40 Z" fill="#c49c55"/>
    <path d="M30 138 L90 48 L150 138 Z" fill="#e6c47c"/><path d="M90 48 L150 138 H112 Z" fill="#c9a35c"/>
    <path d="M118 138 L154 84 L190 138 Z" fill="#e3c178"/><path d="M154 84 L190 138 H166 Z" fill="#c69f58"/>`, { cielo: '#f6dcae', terra: sabbia }),
  'Opera House': quadro(`<rect x="22" y="116" width="156" height="14" fill="#d8c6a2"/>
    ${[[30, 66, 60], [56, 52, 84], [86, 40, 112], [114, 52, 140], [140, 66, 166]].map(([x0, top, x1]) => `<path d="M${x0} 116 Q${x0 + 6} ${top + 10} ${x1} ${top} Q${x1 - 14} ${top + 30} ${x1 - 6} 116 Z" fill="#fbfbf8" stroke="#aab6be" stroke-width="1.5"/><path d="M${x0 + 8} 116 Q${x0 + 14} ${top + 22} ${x1 - 4} ${top + 6}" stroke="#d3dbe0" stroke-width="1" fill="none"/>`).join('')}`, { terra: acqua }),
  'Burj Khalifa': quadro(`${[[14, 112, 18], [36, 120, 14], [150, 108, 16], [170, 118, 18]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${138 - y}" fill="#9db0bf"/>`).join('')}
    <path d="${simmetrica([[80, 138], [82, 110], [86, 110], [86, 84], [90, 84], [90, 60], [94, 60], [94, 38], [97, 38], [98, 16], [100, 2]])}" fill="#b9c9d6" stroke="#7d93a5" stroke-width="1.2"/>
    <path d="M100 4 V138" stroke="#e8f0f6" stroke-width="2"/>`, { terra: '#d9c58f' }),
  'Marina Bay Sands': quadro(`${[54, 92, 130].map((x) => `<path d="M${x} 138 L${x + 2} 52 H${x + 18} L${x + 20} 138 Z" fill="#cdd6dc" stroke="#8fa0ab" stroke-width="1.2"/>${ripeti(8, (k) => `<path d="M${x + 4} ${60 + k * 9.5} H${x + 16}" stroke="#a9b8c2" stroke-width="1"/>`)}`).join('')}
    <path d="M42 46 H176 Q182 46 178 52 H46 Q40 52 42 46 Z" fill="#7f95a3"/><path d="M60 46 Q110 40 166 46" stroke="#5f9a63" stroke-width="3" fill="none"/>`, { terra: acqua }),
  'Petronas Towers': quadro(`${[72, 128].map((x) => `<rect x="${x - 12}" y="62" width="24" height="76" fill="#c6cdd3" stroke="#8a969f" stroke-width="1.2"/><rect x="${x - 10}" y="48" width="20" height="14" fill="#cbd2d7" stroke="#8a969f" stroke-width="1.2"/><rect x="${x - 7}" y="38" width="14" height="10" fill="#d0d6da" stroke="#8a969f" stroke-width="1.2"/><rect x="${x - 4}" y="30" width="8" height="8" fill="#d6dbdf" stroke="#8a969f" stroke-width="1.2"/><path d="M${x} 30 V8" stroke="#8a969f" stroke-width="2"/>${ripeti(9, (k) => `<path d="M${x - 10} ${68 + k * 7.6} H${x + 10}" stroke="#a7b2ba" stroke-width="1"/>`)}`).join('')}
    <rect x="84" y="80" width="32" height="5" fill="#8a969f"/><path d="M86 85 L96 100 M114 85 L104 100" stroke="#8a969f" stroke-width="2"/>`),
  'Empire State Building': quadro(`<path d="M58 138 V100 H70 V72 H80 V52 H88 V40 H94 V30 H106 V40 H112 V52 H120 V72 H130 V100 H142 V138 Z" fill="#cdc4ad" stroke="#9a8f74" stroke-width="1.2"/>
    <path d="M98 30 V8 H102 V30" fill="#9a8f74"/>${ripeti(9, (k) => `<path d="M${76 + k * 6} ${k < 1 || k > 7 ? 76 : 56} V136" stroke="#a99e83" stroke-width="1"/>`)}
    ${[[14, 110, 22], [40, 118, 16], [150, 114, 18], [172, 104, 18]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${138 - y}" fill="#b5ad97"/>`).join('')}`),
  'Porta di Brandeburgo': quadro(`<rect x="28" y="62" width="144" height="14" fill="#e3d4ae"/><rect x="72" y="50" width="56" height="12" fill="#ddcc9f"/>
    ${[34, 56, 80, 112, 136, 158].map((x) => `<rect x="${x}" y="76" width="9" height="56" fill="#ecdfbc" stroke="#c4b285" stroke-width="1"/>`).join('')}
    <rect x="26" y="132" width="148" height="6" fill="#cdbb8c"/>
    <path d="M84 50 Q88 38 96 42 L100 34 L104 42 Q112 38 116 50 Z" fill="#4d7a63"/><path d="M100 34 V24" stroke="#4d7a63" stroke-width="2.5"/>`),
  'Arco di Trionfo': quadro(`<rect x="50" y="42" width="100" height="96" fill="#e6d6b0" stroke="#c2ad7e" stroke-width="1.2"/><rect x="46" y="36" width="108" height="10" fill="#d9c79c"/>
    <path d="M84 138 V92 A16 16 0 0 1 116 92 V138 Z" fill="#bfe0f5"/><path d="M60 138 V112 A5 5 0 0 1 70 112 V138 Z M130 138 V112 A5 5 0 0 1 140 112 V138 Z" fill="#bfe0f5"/>
    <path d="M50 60 H150" stroke="#c2ad7e" stroke-width="1.5"/><rect x="58" y="66" width="20" height="22" fill="#d2be8f"/><rect x="122" y="66" width="20" height="22" fill="#d2be8f"/>`),
  'Cupola del Brunelleschi': quadro(`<rect x="8" y="118" width="184" height="20" fill="#efe7d4"/>${ripeti(12, (i) => `<rect x="${12 + i * 15}" y="122" width="7" height="12" fill="#4e6b55"/>`)}
    <rect x="58" y="92" width="84" height="26" fill="#efe7d4" stroke="#4e6b55" stroke-width="1.5"/>${ripeti(5, (i) => `<circle cx="${70 + i * 15}" cy="104" r="4" fill="#4e6b55"/>`)}
    <path d="M56 92 Q58 40 100 30 Q142 40 144 92 Z" fill="#c0563a"/>
    <path d="M100 30 Q84 50 78 92 M100 30 Q116 50 122 92 M100 30 V92" stroke="#f3ebde" stroke-width="2.2" fill="none"/>
    <rect x="95" y="16" width="10" height="14" fill="#f3ebde"/><path d="M94 16 L100 6 L106 16 Z" fill="#f3ebde"/><circle cx="100" cy="5" r="2" fill="#d9b04a"/>`),
  'Basilica di San Pietro': quadro(`<rect x="28" y="102" width="144" height="36" fill="#e7dcc4"/>${ripeti(8, (i) => `<rect x="${34 + i * 18}" y="106" width="6" height="30" fill="#cbbd9b"/>`)}
    <path d="M80 102 L100 90 L120 102 Z" fill="#d8caa8"/>${ripeti(13, (i) => `<rect x="${31 + i * 11}" y="96" width="2.5" height="6" fill="#bfb08c"/>`)}
    <rect x="70" y="66" width="60" height="18" fill="#e3d8be"/>${ripeti(6, (i) => `<rect x="${74 + i * 10}" y="68" width="4" height="14" fill="#c7b991"/>`)}
    <path d="M68 66 Q70 26 100 22 Q130 26 132 66 Z" fill="#8ea3ab"/><path d="M100 22 V66 M100 22 Q86 34 82 66 M100 22 Q114 34 118 66" stroke="#b5c4ca" stroke-width="1.5" fill="none"/>
    <rect x="95" y="10" width="10" height="12" fill="#e3d8be"/><path d="M100 10 V2" stroke="#a89a75" stroke-width="2"/>`),
  'Golden Gate': quadro(`<path d="M0 82 Q35 40 80 42" stroke="#9fb8c8" stroke-width="0" fill="none"/>
    ${(() => {
      const cavo = [[0, 96, 30, 100, 56, 30], [56, 30, 100, 98, 144, 30], [144, 30, 170, 100, 200, 96]];
      let s = cavo.map(([a, b, c, d, e, f]) => `<path d="M${a} ${b} Q${c} ${d} ${e} ${f}" stroke="#c0392b" stroke-width="2.5" fill="none"/>`).join('');
      for (const [a, b, c, d, e, f] of cavo) for (let t = 0.1; t < 0.95; t += 0.1) s += `<path d="M${n(quad(t, a, c, e))} ${n(quad(t, b, d, f))} V104" stroke="#c0392b" stroke-width="0.8"/>`;
      return s;
    })()}
    <rect x="0" y="104" width="200" height="5" fill="#a93226"/>
    ${[56, 144].map((x) => `<rect x="${x - 7}" y="26" width="4" height="112" fill="#c0392b"/><rect x="${x + 3}" y="26" width="4" height="112" fill="#c0392b"/>${[32, 52, 76, 98].map((y) => `<rect x="${x - 7}" y="${y}" width="14" height="3" fill="#a93226"/>`).join('')}`).join('')}`, { terra: acqua, cielo: '#cfe2ee' }),
  'Tower Bridge': quadro(`<path d="M0 104 Q28 70 50 50 M150 50 Q172 70 200 104" stroke="#6f9cc0" stroke-width="3" fill="none"/>
    <rect x="0" y="104" width="200" height="6" fill="#6f9cc0"/><rect x="58" y="42" width="84" height="5" fill="#6f9cc0"/><rect x="58" y="52" width="84" height="3" fill="#6f9cc0"/>
    ${[50, 150].map((x) => `<rect x="${x - 12}" y="40" width="24" height="98" fill="#d9c9a5" stroke="#b09c72" stroke-width="1.2"/><path d="M${x - 14} 40 L${x} 16 L${x + 14} 40 Z" fill="#5d7488"/>${[-12, 12].map((d) => `<path d="M${x + d - 3} 40 L${x + d} 28 L${x + d + 3} 40 Z" fill="#5d7488"/>`).join('')}<path d="M${x - 5} 138 V120 A5 5 0 0 1 ${x + 5} 120 V138" fill="#9fc3e0"/><rect x="${x - 4}" y="60" width="8" height="12" rx="4" fill="#8a7a58"/><rect x="${x - 4}" y="80" width="8" height="12" rx="4" fill="#8a7a58"/>`).join('')}`, { terra: acqua }),
  Partenone: quadro(`<path d="M0 138 L20 118 H180 L200 138 Z" fill="#b9a585"/>
    <rect x="30" y="110" width="140" height="8" fill="#eadfc4"/><rect x="34" y="104" width="132" height="6" fill="#e3d6b8"/>
    ${ripeti(8, (i) => `<rect x="${40 + i * 16.4}" y="66" width="8" height="38" fill="#efe6cf" stroke="#cdbf9c" stroke-width="1"/>`)}
    <rect x="34" y="56" width="132" height="10" fill="#e6dabd"/><path d="M34 56 L78 40 L100 46 L112 44 L118 56 Z" fill="#ddd0b0"/>`, { cielo: '#bfe0f5', terra: '#a8946f' }),
  'Taj Mahal': quadro(`<rect x="20" y="126" width="160" height="12" fill="#e9e3d8"/><rect x="96" y="128" width="8" height="10" fill="#7fb2d8"/>
    ${[26, 174].map((x) => `<rect x="${x - 3}" y="56" width="6" height="70" fill="#f4f1ea" stroke="#c9c2b4" stroke-width="1"/><path d="M${x - 5} 56 Q${x} 44 ${x + 5} 56 Z" fill="#f4f1ea" stroke="#c9c2b4" stroke-width="1"/>`).join('')}
    <rect x="52" y="78" width="96" height="48" fill="#f6f3ec" stroke="#c9c2b4" stroke-width="1.2"/>
    <path d="M88 126 V94 Q100 80 112 94 V126 Z" fill="#d9d1c2"/>${[60, 128].map((x) => `<path d="M${x} 104 Q${x + 6} 96 ${x + 12} 104 V120 H${x} Z" fill="#e1dacb"/>`).join('')}
    <rect x="80" y="70" width="40" height="8" fill="#f1ede4"/><path d="M76 70 Q74 40 100 28 Q126 40 124 70 Z" fill="#f8f6f1" stroke="#c9c2b4" stroke-width="1.2"/><path d="M100 28 V18" stroke="#c9a54a" stroke-width="2"/>
    ${[62, 138].map((x) => `<path d="M${x - 8} 78 Q${x} 62 ${x + 8} 78 Z" fill="#f8f6f1" stroke="#c9c2b4" stroke-width="1"/>`).join('')}`, { terra: '#8fbf7a' }),
  'Mole Antonelliana': quadro(`<rect x="62" y="104" width="76" height="34" fill="#d8cdb8"/>${ripeti(6, (i) => `<rect x="${67 + i * 12}" y="110" width="6" height="22" fill="#a89a7c"/>`)}
    <path d="M60 104 Q66 72 84 62 L100 56 L116 62 Q134 72 140 104 Z" fill="#9aa3a8"/><path d="M100 56 V104 M84 62 Q74 80 72 104 M116 62 Q126 80 128 104" stroke="#bcc4c8" stroke-width="1.5" fill="none"/>
    <rect x="92" y="40" width="16" height="16" fill="#d8cdb8"/>${ripeti(3, (i) => `<rect x="${94 + i * 5}" y="43" width="2.5" height="11" fill="#a89a7c"/>`)}
    <path d="M94 40 L100 6 L106 40 Z" fill="#c9bfa8"/><circle cx="100" cy="5" r="2.2" fill="#d9b04a"/>`),
  Atomium: quadro(`<path d="M86 132 L96 112 M114 132 L104 112 M100 138 V114" stroke="#9aa6b1" stroke-width="3"/>
    ${(() => {
      const P = [[100, 18], [56, 42], [144, 42], [100, 66], [56, 92], [144, 92], [100, 114]];
      const L = [[0, 1], [0, 2], [1, 4], [2, 5], [4, 6], [5, 6], [3, 0], [3, 1], [3, 2], [3, 4], [3, 5], [3, 6]];
      return L.map(([a, b]) => `<path d="M${P[a][0]} ${P[a][1]} L${P[b][0]} ${P[b][1]}" stroke="#aab4be" stroke-width="4"/>`).join('')
        + P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#c9d1d9" stroke="#8d99a5" stroke-width="1.2"/><circle cx="${x - 4}" cy="${y - 4}" r="3.5" fill="#f2f5f8"/>`).join('');
    })()}`),
  'Grande Muraglia': quadro(`<path d="M0 138 L0 96 L40 64 L76 90 L118 54 L160 84 L200 70 V138 Z" fill="#6f9a5c"/><path d="M0 138 L0 116 L50 100 L110 112 L170 96 L200 104 V138 Z" fill="#5c844b"/>
    <path d="M0 112 L40 82 L76 104 L118 70 L160 98 L200 86" stroke="#b59a6e" stroke-width="7" fill="none" stroke-linejoin="round"/>
    <path d="M0 106 L40 76 L76 98 L118 64 L160 92 L200 80" stroke="#c9b083" stroke-width="2" stroke-dasharray="3 3" fill="none"/>
    ${[[40, 76], [118, 64], [160, 92]].map(([x, y]) => `<rect x="${x - 7}" y="${y - 12}" width="14" height="14" fill="#a8895c"/><rect x="${x - 3}" y="${y - 8}" width="6" height="5" fill="#6e5236"/>`).join('')}`),
  'Duomo di Milano': quadro(`<path d="M28 138 V78 H70 L100 54 L130 78 H172 V138 Z" fill="#f2ece0" stroke="#cfc6b2" stroke-width="1.2"/>
    ${ripeti(12, (i) => `<path d="M${30 + i * 12.6} 78 V${i % 3 === 0 ? 58 : 66} L${32 + i * 12.6} ${i % 3 === 0 ? 50 : 60} L${34 + i * 12.6} ${i % 3 === 0 ? 58 : 66} V78" fill="#f2ece0" stroke="#cfc6b2" stroke-width="1"/>`)}
    <path d="M97 54 V20 L100 8 L103 20 V54" fill="#f2ece0" stroke="#cfc6b2" stroke-width="1"/><circle cx="100" cy="6" r="2.6" fill="#e2b44a"/>
    ${ripeti(5, (i) => `<path d="M${46 + i * 27} 138 V112 L${52 + i * 27} 102 L${58 + i * 27} 112 V138 Z" fill="#9b8f78"/>`)}
    <circle cx="100" cy="82" r="8" fill="#d9cfb9"/>`, { terra: '#c9c2b2' }),
  'CN Tower': quadro(`${[[16, 106, 20], [40, 116, 18], [148, 110, 18], [170, 100, 18]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${138 - y}" fill="#9aa9b4"/>`).join('')}
    <path d="M92 138 L96 70 H104 L108 138 Z" fill="#d6d2c8" stroke="#a9a397" stroke-width="1"/>
    <ellipse cx="100" cy="66" rx="16" ry="8" fill="#b9b4a8"/><rect x="88" y="60" width="24" height="5" fill="#6b7d8b"/>
    <path d="M98 58 L99 14 H101 L102 58 Z" fill="#d6d2c8"/><ellipse cx="100" cy="40" rx="4" ry="2.5" fill="#b9b4a8"/>`, { terra: acqua }),
};

module.exports = { DISEGNI_MONUMENTI: D };
