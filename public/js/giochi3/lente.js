// LENTE: tavolieri ingrandibili sul telefono (Hex, Affari in città, Conquista del mondo). Il gioco avvolge il suo
// tavoliere con Lente.html(chiave, html): compaiono i pulsanti ＋ e − (solo su schermi stretti) e si può allargare
// con due dita. Ingrandito, il tavoliere resta nello stesso riquadro e si sposta trascinando col dito.
// Livello e posizione restano uguali anche quando il gioco ridisegna il tavolo (ogni mossa), perché sono salvati
// qui per chiave e rimessi appena il riquadro nuovo compare.
(() => {
  const stato = {}; // chiave -> { z, x, y, h }
  const PASSI = [1, 1.5, 2, 2.6];
  const st = (k) => (stato[k] = stato[k] || { z: 1, x: 0, y: 0, h: 0 });

  // altezza del riquadro ingrandito: quella di prima, oppure (con l'opzione alto) cresce col tavoliere fino a quel limite
  const altezza = (s, z) => (s.alto ? `min(${Math.round(s.h * z)}px, ${s.alto})` : `${s.h}px`);

  function html(chiave, contenuto, { max = 2.6, alto = '', angolo = 'basso' } = {}) {
    const s = st(chiave);
    s.max = max; s.alto = alto;
    const z = Math.min(s.z, max);
    const alto2 = z > 1 && s.h ? `height:${altezza(s, z)};` : '';
    return `<div class="ln" data-lente="${chiave}"><div class="ln-vista ${z > 1 ? 'ln-zoom' : ''}" style="--ln-z:${z};${alto2}"><div class="ln-dentro">${contenuto}</div></div>
      <div class="ln-bt ${angolo}"><button type="button" data-lente-bt="+" aria-label="Ingrandisci" ${z >= max ? 'disabled' : ''}>＋</button><button type="button" data-lente-bt="-" aria-label="Rimpicciolisci" ${z <= 1 ? 'disabled' : ''}>−</button></div></div>`;
  }

  // cambia il livello tenendo fermo il punto (cx, cy) del riquadro (il centro se non c'è)
  function imposta(box, z, cx, cy) {
    const vista = box.querySelector('.ln-vista'), k = box.dataset.lente, s = st(k);
    z = Math.max(1, Math.min(s.max || 2.6, z));
    const z0 = s.z;
    if (z0 === 1 && z > 1) s.h = vista.clientHeight;
    if (cx == null) { cx = vista.clientWidth / 2; cy = vista.clientHeight / 2; }
    let x = (vista.scrollLeft + cx) * (z / z0) - cx, y = (vista.scrollTop + cy) * (z / z0) - cy;
    s.z = z;
    vista.style.setProperty('--ln-z', z);
    vista.classList.toggle('ln-zoom', z > 1);
    vista.style.height = z > 1 && s.h ? altezza(s, z) : '';
    vista.scrollLeft = s.x = Math.max(0, x);
    vista.scrollTop = s.y = Math.max(0, y);
    const [piu, meno] = box.querySelectorAll('[data-lente-bt]');
    if (piu) piu.disabled = z >= (s.max || 2.6);
    if (meno) meno.disabled = z <= 1;
  }

  document.addEventListener('click', (e) => {
    const bt = e.target instanceof Element && e.target.closest('[data-lente-bt]');
    if (!bt) return;
    const box = bt.closest('.ln'), s = st(box.dataset.lente);
    e.stopPropagation();
    const dopo = bt.dataset.lenteBt === '+' ? PASSI.find((v) => v > s.z + 0.01) || s.max : [...PASSI].reverse().find((v) => v < s.z - 0.01) || 1;
    imposta(box, dopo);
  }, true);

  // ricorda dove si è spostato il riquadro ingrandito
  document.addEventListener('scroll', (e) => {
    const v = e.target;
    if (!(v instanceof Element) || !v.classList.contains('ln-vista')) return;
    const s = st(v.parentElement.dataset.lente);
    s.x = v.scrollLeft; s.y = v.scrollTop;
  }, true);

  // due dita: allarga e stringe
  let pizzico = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2) return;
    const box = e.target instanceof Element && e.target.closest('.ln');
    if (!box) return;
    pizzico = { box, d: dist(e.touches), z: st(box.dataset.lente).z };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!pizzico || e.touches.length !== 2) return;
    e.preventDefault();
    const q = pizzico.box.querySelector('.ln-vista').getBoundingClientRect();
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - q.left, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - q.top;
    imposta(pizzico.box, pizzico.z * dist(e.touches) / pizzico.d, cx, cy);
  }, { passive: false });
  document.addEventListener('touchend', (e) => { if (e.touches.length < 2) pizzico = null; }, { passive: true });

  // il gioco ridisegna il tavolo: si rimette il riquadro dov'era
  new MutationObserver(() => {
    for (const v of document.querySelectorAll('.ln-vista.ln-zoom')) {
      const s = st(v.parentElement.dataset.lente);
      if (v.scrollLeft !== s.x || v.scrollTop !== s.y) { v.scrollLeft = s.x; v.scrollTop = s.y; }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.Lente = { html, imposta, _stato: stato };
})();
