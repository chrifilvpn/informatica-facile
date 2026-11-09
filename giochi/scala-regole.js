// Regole delle combinazioni di scala 40. Usato sia dal server sia dal browser.
(function (radice, fabbrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabbrica();
  else radice.ScalaRegole = fabbrica();
})(typeof self !== 'undefined' ? self : this, function () {
  const SEMI = ['c', 'q', 'f', 'p'];

  // valore di una posizione in scala: asso basso 1, asso alto 11, figure 10
  const valorePos = (pos) => (pos === 1 ? 1 : pos === 14 ? 11 : pos >= 11 ? 10 : pos);

  // penalità di una carta rimasta in mano
  const penalita = (c) => (c.jolly ? 25 : c.rango === 1 ? 11 : c.rango >= 11 ? 10 : c.rango);

  // i jolly di una combinazione: "jollies" li elenca tutti, "jolly" è il primo (o null)
  const conJolly = (jollies) => ({ jolly: jollies[0] || null, jollies });

  function valutaTris(nat, jolly) {
    const r = nat[0].rango;
    if (!nat.every((c) => c.rango === r)) return null;
    const semi = new Set(nat.map((c) => c.seme));
    if (semi.size !== nat.length) return null; // semi tutti diversi
    const tot = nat.length + jolly.length;
    if (tot < 3 || tot > 4) return null;
    const v = r === 1 ? 11 : Math.min(r, 10);
    const ordinate = [...nat].sort((a, b) => SEMI.indexOf(a.seme) - SEMI.indexOf(b.seme));
    return {
      tipo: 'tris',
      carte: [...ordinate, ...jolly],
      punti: v * tot,
      ...conJolly(jolly.map((j) => ({ id: j.id, rango: r, semi: SEMI.filter((s) => !semi.has(s)) }))),
    };
  }

  function valutaScala(nat, jolly) {
    const s = nat[0].seme;
    if (!nat.every((c) => c.seme === s)) return null;
    for (const assoAlto of [false, true]) {
      const pos = nat.map((c) => (c.rango === 1 && assoAlto ? 14 : c.rango));
      if (new Set(pos).size !== pos.length) continue;
      let da = Math.min(...pos);
      let a = Math.max(...pos);
      const buchi = a - da + 1 - nat.length;
      if (buchi > jolly.length) continue;
      // i jolly avanzati dopo aver riempito i buchi vanno in cima alla scala, poi in fondo
      let avanzati = jolly.length - buchi;
      while (avanzati > 0 && a < 14 && !(da === 1 && a === 13)) { a++; avanzati--; }
      while (avanzati > 0 && da > 1) { da--; avanzati--; }
      if (avanzati > 0) continue;
      if (da === 1 && a === 14) continue; // l'asso non può stare sia sotto che sopra
      const carte = [];
      const jollies = [];
      let punti = 0;
      let k = 0;
      for (let x = da; x <= a; x++) {
        const i = pos.indexOf(x);
        if (i >= 0) carte.push(nat[i]);
        else {
          carte.push(jolly[k]);
          jollies.push({ id: jolly[k].id, rango: x === 14 ? 1 : x, semi: [s] });
          k++;
        }
        punti += valorePos(x);
      }
      return { tipo: 'scala', seme: s, carte, punti, ...conJolly(jollies) };
    }
    return null;
  }

  // Controlla se un gruppo di carte è una combinazione valida: tris/poker o scala.
  // Si possono usare più jolly (anche uno accanto all'altro, come 8-jolly-jolly-J), purché non siano
  // più delle carte vere.
  function valuta(carte) {
    if (!carte || carte.length < 3) return null;
    const jolly = carte.filter((c) => c.jolly);
    const nat = carte.filter((c) => !c.jolly);
    if (nat.length < 2 || jolly.length > nat.length) return null;
    return valutaTris(nat, jolly) || valutaScala(nat, jolly);
  }

  // La carta naturale può sostituire un jolly di questa combinazione? Restituisce quel jolly (o null).
  // Con jollyId si sceglie quale jolly scambiare.
  function sostituisceJolly(comb, carta, jollyId) {
    if (!comb || !carta || carta.jolly) return null;
    const lista = comb.jollies || (comb.jolly ? [comb.jolly] : []);
    return lista.find((j) => (jollyId == null || j.id === jollyId) && carta.rango === j.rango && j.semi.includes(carta.seme)) || null;
  }

  return { SEMI, valuta, penalita, sostituisceJolly, valorePos };
});
