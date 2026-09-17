/**
 * nav.js — ניווט תחתון משותף: בית · ספרייה · דשבורד · הגדרות (המפרט, סעיף 7.3).
 * מוזרק לתוך <div data-navbar></div> כדי שלא נשכפל HTML בין המסכים (אין build step).
 */

import { icon } from './icons.js';

const ITEMS = [
  { id: 'home',      href: 'index.html',     label: 'בית',     icon: 'home' },
  { id: 'library',   href: 'library.html',   label: 'ספרייה',  icon: 'library' },
  { id: 'dashboard', href: 'dashboard.html', label: 'דשבורד',  icon: 'chart' },
  { id: 'settings',  href: 'settings.html',  label: 'הגדרות',  icon: 'settings' },
];

/** @param {string} current מזהה המסך הנוכחי (home / library / dashboard / settings) */
export function renderNavbar(current) {
  const mount = document.querySelector('[data-navbar]');
  if (!mount) return;

  const links = ITEMS.map((item) => {
    const active = item.id === current ? ' aria-current="page"' : '';
    return `<a class="navbar__item" href="${item.href}"${active}>
      ${icon(item.icon, 22)}
      <span>${item.label}</span>
    </a>`;
  }).join('');

  mount.className = 'navbar';
  mount.innerHTML = `<nav class="navbar__inner" aria-label="ניווט ראשי">${links}</nav>`;
}

/**
 * כפתור חזרה מובנה בממשק — לא מסתמכים על כפתור ה-back של הדפדפן.
 * מוזרק לתוך <button data-back-btn></button> שבכותרת המסך.
 *
 * @param {string} fallback לאן ללכת כשאין היסטוריה (כניסה ישירה לכתובת)
 */
export function mountBack(fallback = 'index.html') {
  const btn = document.querySelector('[data-back-btn]');
  if (!btn) return;

  btn.classList.add('icon-btn');
  btn.setAttribute('aria-label', 'חזרה');
  btn.innerHTML = icon('arrow', 22);

  btn.addEventListener('click', () => {
    // חזרה אמיתית רק אם הגענו מתוך האפליקציה
    if (history.length > 1 && document.referrer.includes(location.host)) history.back();
    else location.href = fallback;
  });
}
