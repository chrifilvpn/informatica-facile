const briscola = require('./briscola');
const { scopa, scopone } = require('./scopa');
const rubamazzo = require('./rubamazzo');
const scala40 = require('./scala40');
const tris = require('./tris');
const forza4 = require('./forza4');
const battaglia = require('./battaglia');
const dama = require('./dama');
const scacchi = require('./scacchi');
const impiccato = require('./impiccato');
const morra = require('./morra');
const numero = require('./numero');
const blackjack = require('./blackjack');
const baccarat = require('./baccarat');
const higherlower = require('./higherlower');
const texas = require('./texas');
const poker5 = require('./poker5');
const uno = require('./uno');
const campo = require('./campo');
const impostore = require('./impostore');
const coccodrillo = require('./coccodrillo');
const blockblast = require('./blockblast');
const peppa = require('./peppa');
const fastwest = require('./fastwest');
const wordle = require('./wordle');
const angolo = require('./angolo');
const sudoku = require('./sudoku');
const snake = require('./snake');
const tetris = require('./tetris');
const airhockey = require('./airhockey');
const pallone = require('./pallone');
const interruttori = require('./interruttori');
const casellebombe = require('./casellebombe');
const tesoro = require('./tesoro');
const coperti = require('./coperti');
const dubito = require('./dubito');
const nascondino = require('./nascondino');
const mappa = require('./mappa');
const tasti = require('./tasti');
const mensola = require('./mensola');
const mind = require('./mind');
const flip7 = require('./flip7');
const cirulla = require('./cirulla');
const solitario = require('./solitario');
const chirurgo = require('./chirurgo');
const benchmark = require('./benchmark');
const disegna = require('./disegna');
const putt = require('./putt');
const palloncini = require('./palloncini');
const gattotopi = require('./gattotopi');
const colori = require('./colori');
const bumper = require('./bumper');
const differenze = require('./differenze');
const { fuga, monete } = require('./salita');
const strada = require('./strada');
const bersaglio = require('./bersaglio');
const mangiatutto = require('./mangiatutto');
const tigerball = require('./tigerball');
const roulette = require('./roulette');
const bandiere = require('./bandiere');
const arcobaleno = require('./arcobaleno');
const pioggia = require('./pioggia');
const paintball = require('./paintball');
const piattaforme = require('./piattaforme');
const massi = require('./massi');
const stella = require('./stella');
const fune = require('./fune');
const dalgona = require('./dalgona');
const buio = require('./buio');
const alieno = require('./alieno');
const shutbox = require('./shutbox');
const sblocca = require('./sblocca');
const wanted = require('./wanted');
const duello = require('./duello');
const ponte = require('./ponte');

const GIOCHI = { briscola, scopa, scopone, rubamazzo, scala40, tris, forza4, battaglia, dama, scacchi, impiccato, morra, numero, blackjack, baccarat, higherlower, texas, poker5, uno, campo, impostore, coccodrillo, blockblast, peppa, fastwest, wordle, angolo, sudoku, snake, tetris, airhockey, pallone, interruttori, casellebombe, tesoro, coperti, dubito, nascondino, mappa, tasti, mensola, mind, flip7, cirulla, solitario, chirurgo, benchmark, disegna, putt, palloncini, gattotopi, colori, bumper, differenze, fuga, monete, arcobaleno, pioggia, paintball, piattaforme, massi, stella, fune, dalgona, buio, alieno, shutbox, sblocca, wanted, duello, strada, bersaglio, mangiatutto, tigerball, roulette, bandiere, ponte };

// GIOCHI NUOVI (cartelle giochi2, giochi3): ogni file che esporta meta e crea si registra da solo, senza toccare
// questo elenco (i file di dati senza meta, es. tressette-dati.js, si ignorano). Una cartella nuova ogni 100 file.
{
  const fs = require('fs');
  const path = require('path');
  for (const nome of ['giochi2', 'giochi3']) {
    const cartella = path.join(__dirname, '..', nome);
    const files = fs.existsSync(cartella) ? fs.readdirSync(cartella).filter((f) => f.endsWith('.js')).sort() : [];
    for (const f of files) {
      const m = require(path.join(cartella, f));
      if (m && m.meta && typeof m.crea === 'function' && !GIOCHI[m.meta.id]) GIOCHI[m.meta.id] = m;
    }
  }
}

// CATEGORIE della home (un gioco nuovo che non è in elenco finisce in "Altri")
const CATEGORIE = {
  carte: ['briscola', 'scopa', 'scopone', 'rubamazzo', 'scala40', 'peppa', 'fastwest', 'dubito', 'flip7', 'cirulla', 'solitario', 'uno', 'tressette', 'cucu', 'burraco', 'memory', 'machiavelli', 'assopiglia', 'uomonero', 'chiamata', 'piramide', 'freecell'],
  casino: ['blackjack', 'baccarat', 'higherlower', 'texas', 'poker5', 'roulette', 'settemezzo', 'videopoker', 'omaha'],
  strategia: ['tris', 'forza4', 'forza3d', 'battaglia', 'dama', 'damaint', 'scacchi', 'xiangqi', 'casellebombe', 'tesoro', 'coperti', 'interruttori', 'mappa', 'nascondino', 'shutbox', 'otello', 'ludo', 'oca', 'backgammon', 'yahtzee', 'bugiardi', 'conquista', 'mulino', 'quoridor', 'go', 'damacinese', 'affari', 'hex', 'navale', 'draghi'],
  parole: ['impiccato', 'wordle', 'bandiere', 'capitali', 'sagome', 'monumenti', 'differenze', 'angolo', 'numero', 'impostore', 'coccodrillo', 'disegna', 'mensola', 'connessioni', 'codenames', 'morra', 'paroliere', 'nomicose', 'quiz', 'anagrammi', 'catena', 'cruciverba', 'anno', 'wavelength', 'lupus'],
  azione: ['snake', 'tetris', 'airhockey', 'pallone', 'tasti', 'chirurgo', 'benchmark', 'putt', 'palloncini', 'gattotopi', 'colori', 'bumper', 'fuga', 'monete', 'arcobaleno', 'pioggia', 'paintball', 'piattaforme', 'massi', 'wanted', 'duello', 'strada', 'bersaglio', 'mangiatutto', 'tigerball', 'mind', 'bomberman', 'slither', 'corsa', 'calcetto', 'hockey', 'patata', 'tron', 'carri', 'asteroidi', 'pong4', 'battitura', 'cerchi', 'frutta', 'sfere', 'difesa', 'stickwar'],
  squid: ['stella', 'fune', 'dalgona', 'buio', 'alieno', 'ponte', 'calamaro', 'biglie'],
  rompicapo: ['campo', 'sblocca', 'sudoku', 'blockblast', 'mastermind', 'nonogram', 'duemila', 'kakuro', 'kenken', 'hanoi', 'sokoban', 'mahjong', 'luci', 'nurikabe', 'picross', 'collega', 'caramelle', 'bolle'],
};
for (const [cat, ids] of Object.entries(CATEGORIE)) for (const id of ids) if (GIOCHI[id]) GIOCHI[id].meta.categoria = cat;
for (const g of Object.values(GIOCHI)) if (!g.meta.categoria) g.meta.categoria = 'altri';

// CONTROLLI sul computer (filtro della home): 'tastiera' = serve solo la tastiera, 'entrambi' = servono mouse e
// tastiera insieme, 'uno' = basta l'uno o l'altro; tutti gli altri si giocano col solo mouse ('mouse')
const CONTROLLI = {
  tastiera: ['snake', 'tetris', 'tasti', 'battitura', 'colori', 'bumper', 'fuga', 'monete', 'arcobaleno', 'pioggia', 'piattaforme', 'duello', 'mangiatutto', 'bomberman', 'hockey', 'patata', 'tron', 'stella', 'buio', 'calamaro', 'asteroidi', 'catena', 'nomicose', 'anagrammi', 'numero'],
  entrambi: ['paintball', 'carri', 'gattotopi', 'alieno', 'isolation', 'disegna', 'impostore', 'codenames', 'cruciverba', 'benchmark', 'draghi', 'angolo', 'wavelength', 'lupus'],
  uno: ['airhockey', 'massi', 'strada', 'pong4', 'slither', 'palloncini', 'calcetto', 'sudoku', 'wordle', 'impiccato', 'quiz', 'bandiere', 'capitali', 'sagome', 'monumenti', 'paroliere', 'duemila', 'mind', 'ponte'],
};
for (const [c, ids] of Object.entries(CONTROLLI)) for (const id of ids) if (GIOCHI[id]) GIOCHI[id].meta.controlli = c;
for (const g of Object.values(GIOCHI)) if (!g.meta.controlli) g.meta.controlli = 'mouse';

// Tiene solo le opzioni previste, con valori ammessi
function pulisciOpzioni(id, opzioni = {}) {
  const out = {};
  for (const o of GIOCHI[id].meta.opzioni) {
    const v = opzioni[o.id];
    const ammesso = o.valori.find((x) => String(x) === String(v));
    out[o.id] = ammesso !== undefined ? ammesso : o.predefinito;
  }
  return out;
}

module.exports = { GIOCHI, pulisciOpzioni, CONTROLLI };
