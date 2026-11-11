/* Theme switch: a small button in the header that flips between the light and dark themes.
   The choice is remembered on this device. Without a choice the page follows the system setting. */
(function () {
  'use strict';
  const KEY = 'tdf-theme';
  const root = document.documentElement;
  const mast = document.querySelector('.mast-inner');
  if (!mast) return;
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const write = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: the choice lasts for this visit only */ } };
  const systemDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const current = () => root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'th-btn';
  function label() {
    const next = current() === 'dark' ? 'light' : 'dark';
    btn.textContent = next === 'dark' ? 'Dark' : 'Light';
    btn.setAttribute('aria-label', `Switch to the ${next} theme`);
    btn.title = `Switch to the ${next} theme`;
  }
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    write(next);
    label();
  });
  const saved = read();
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  label();
  const help = mast.querySelector('.gd-help-btn');
  if (help) help.parentNode.insertBefore(btn, help); else mast.appendChild(btn);
})();
