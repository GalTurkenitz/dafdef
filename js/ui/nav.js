/**
 * nav.js — הניווט המשותף (V3, סעיף ב).
 *
 * שני רכיבים:
 *   1. סרגל תחתון עם חמישה מקומות, כשהבית במרכז ומורם מעל קו חום
 *      שמתרומם סביבו. כרגע מאוכלסים שניים — בית והתקדמות; השאר
 *      שמורים ולא מוצגים כפריטים לחיצים.
 *   2. תפריט המבורגר בפינה העליונה של כל מסך. כרגע פריט אחד
 *      (הגדרות), והמבנה מוכן להוספה.
 */

import { icon } from './icons.js';

/**
 * חמישה מקומות בסרגל. הבית במרכז בכוונה — הוא העוגן.
 * placeholder: true = מקום שמור, מוצג ריק ולא לחיץ.
 */
const SLOTS = [
  { id: 'slot-a',   placeholder: true },
  { id: 'progress', href: 'progress.html', label: 'התקדמות', icon: 'target' },
  { id: 'home',     href: 'index.html',    label: 'בית',      icon: 'home', center: true },
  { id: 'slot-d',   placeholder: true },
  { id: 'slot-e',   placeholder: true },
];

/** @param {string} current מזהה המסך הנוכחי */
export function renderNavbar(current) {
  const mount = document.querySelector('[data-navbar]');
  if (!mount) return;

  const items = SLOTS.map((s) => {
    if (s.placeholder) return '<span class="navbar__slot" aria-hidden="true"></span>';

    const active = s.id === current ? ' aria-current="page"' : '';
    const cls = s.center ? 'navbar__item navbar__item--center' : 'navbar__item';

    return `<a class="${cls}" href="${s.href}"${active}>
      <span class="navbar__icon">${icon(s.icon, s.center ? 24 : 22)}</span>
      <span class="navbar__label">${s.label}</span>
    </a>`;
  }).join('');

  mount.className = 'navbar';
  mount.innerHTML = `
    <nav class="navbar__inner" aria-label="ניווט ראשי">${items}</nav>`;
}

/**
 * מזריק סרגל ניווט למסך שאין בו <div data-navbar>, כדי שהסרגל
 * יופיע בכל מסך באפליקציה בלי לשכפל HTML.
 */
export function mountNavbar(current) {
  if (!document.querySelector('[data-navbar]')) {
    const host = document.createElement('div');
    host.setAttribute('data-navbar', '');
    document.body.appendChild(host);
  }
  renderNavbar(current);
}

/* ------------------------------------------------------------------ *
 * תפריט עליון
 * ------------------------------------------------------------------ */

const MENU = [
  { href: 'settings.html', label: 'הגדרות', icon: 'settings' },
];

/**
 * מזריק את כפתור ההמבורגר לתוך <button data-menu-btn></button>
 * ובונה את התפריט הנפתח.
 */
export function mountMenu() {
  const btn = document.querySelector('[data-menu-btn]');
  if (!btn) return;

  btn.classList.add('icon-btn');
  btn.setAttribute('aria-label', 'תפריט');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = icon('menu', 22);

  const panel = document.createElement('div');
  panel.className = 'menu';
  panel.hidden = true;
  // חותמת הגרסה מוצגת כאן כדי שאפשר יהיה לדעת בוודאות איזו
  // גרסה רצה במכשיר, במקום לנחש מול מטמון
  panel.innerHTML = `
    <div class="menu__scrim" data-menu-close></div>
    <nav class="menu__panel" aria-label="תפריט">
      ${MENU.map((m) => `
        <a class="menu__item" href="${m.href}">
          ${icon(m.icon, 20)}<span>${m.label}</span>
        </a>`).join('')}
      <p class="menu__build" data-build>גרסה ${window.DAFDEF_BUILD || '—'}</p>
    </nav>`;
  document.body.appendChild(panel);

  const open = (on) => {
    if (on) panel.hidden = false;
    requestAnimationFrame(() => panel.classList.toggle('is-open', on));
    btn.setAttribute('aria-expanded', String(on));
    if (!on) setTimeout(() => { panel.hidden = true; }, 220);
  };

  btn.addEventListener('click', () => open(panel.hidden));
  panel.querySelector('[data-menu-close]').addEventListener('click', () => open(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
}

/* ------------------------------------------------------------------ *
 * כפתור חזרה
 * ------------------------------------------------------------------ */

/**
 * כפתור חזרה מובנה בממשק — לא מסתמכים על כפתור ה-back של הדפדפן.
 * מוזרק לתוך <button data-back-btn></button> שבכותרת המסך.
 *
 * @param {string} fallback לאן ללכת כשאין היסטוריה
 */
export function mountBack(fallback = 'index.html') {
  const btn = document.querySelector('[data-back-btn]');
  if (!btn) return;

  btn.classList.add('icon-btn');
  btn.setAttribute('aria-label', 'חזרה');
  btn.innerHTML = icon('arrow', 22);

  btn.addEventListener('click', () => {
    if (history.length > 1 && document.referrer.includes(location.host)) history.back();
    else location.href = fallback;
  });
}
