/* Colour blind switch: a button in the header that swaps the data colours for a colour blind safe set.
   The choice is remembered on this device. Charts redraw by themselves, because the page watches the class of <html>. */
(function () {
  'use strict';
  const KEY = 'tdf-colour-blind';
  const root = document.documentElement;
  const mast = document.querySelector('.mast-inner');
  if (!mast) return;
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: the choice lasts for this visit only */ } };

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'th-btn cb-btn';
  for (let i = 0; i < 3; i++) btn.appendChild(document.createElement('i'));
  btn.appendChild(document.createTextNode('Colour blind'));
  function paint() {
    const on = root.classList.contains('cb');
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Colour blind colours are on. Press to go back to the standard colours.' : 'Switch to colours that are easier to tell apart with colour blindness';
  }
  btn.addEventListener('click', () => {
    const on = root.classList.toggle('cb');
    write(on ? '1' : '0');
    paint();
  });
  if (read() === '1') root.classList.add('cb');
  paint();
  const before = mast.querySelector('.th-btn') || mast.querySelector('.gd-help-btn');
  if (before) before.parentNode.insertBefore(btn, before); else mast.appendChild(btn);
})();
