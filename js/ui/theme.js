/**
 * theme.js — מצב תצוגה (בהיר / כהה).
 * המצב הוא class על <html>: theme-light / theme-dark.
 * ברירת מחדל: prefers-color-scheme.
 *
 * הערה: בשלב 4 המפתח יעבור לעבור דרך store.js יחד עם שאר settings.
 * עד אז הקריאה/כתיבה כאן מקומית ותואמת את אותו מפתח.
 */

import { STORE_PREFIX, THEMES } from '../config.js';

const KEY = STORE_PREFIX + 'settings';

/** @returns {'light'|'dark'} מה שהמערכת של המשתמש מעדיפה */
export function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** @returns {'light'|'dark'} המצב השמור, או העדפת המערכת */
export function getTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}').theme;
    if (THEMES.includes(saved)) return saved;
  } catch { /* localStorage חסום או פגום — נופלים להעדפת המערכת */ }
  return systemTheme();
}

/** מחיל מצב תצוגה על <html> בלי לשמור אותו (לתצוגה מקדימה) */
export function applyTheme(theme) {
  const t = THEMES.includes(theme) ? theme : systemTheme();
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add('theme-' + t);
  root.dataset.theme = t;

  // מסנכרן את צבע סרגל הכתובת בספארי iOS עם רקע האפליקציה
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
  }
  return t;
}

/** מחיל ושומר */
export function setTheme(theme) {
  const t = applyTheme(theme);
  try {
    const settings = JSON.parse(localStorage.getItem(KEY) || '{}');
    settings.theme = t;
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch { /* אין מקום או חסום — המצב עדיין הוחל על העמוד */ }
  return t;
}

/** מפעיל את המצב השמור בטעינת עמוד ומאזין לשינוי בהעדפת המערכת */
export function initTheme() {
  applyTheme(getTheme());

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}').theme; } catch { /* ignore */ }
    if (!THEMES.includes(saved)) applyTheme(systemTheme()); // רק כשאין בחירה מפורשת
  });
}
