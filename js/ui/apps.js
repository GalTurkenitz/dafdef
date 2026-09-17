/**
 * apps.js — האפליקציות החסומות (מדומות).
 *
 * ** הערת מימוש ל-iOS **
 * המסך שבוחר אפליקציות (onboarding, שלב בחירת האפליקציות) מוחלף
 * בגרסת ה-iOS ב-FamilyActivityPicker של אפל, ואז רשימת האפליקציות
 * מגיעה מהמערכת ולא מהקובץ הזה. החסימה עצמה נעשית ב-Screen Time API.
 * כאן הכל מדומה — אייקונים מצוירים ושמות בעברית.
 *
 * האייקונים מצוירים ולא לוגואים אמיתיים, כדי לא לשלוח סימני מסחר בדמו.
 */

export const APPS = [
  { id: 'instagram', name: 'אינסטגרם', hue: 'ig',   kind: 'social' },
  { id: 'tiktok',    name: 'טיקטוק',   hue: 'tt',   kind: 'social' },
  { id: 'youtube',   name: 'יוטיוב',   hue: 'yt',   kind: 'social' },
  { id: 'facebook',  name: 'פייסבוק',  hue: 'fb',   kind: 'social' },
  { id: 'x',         name: 'X',        hue: 'x',    kind: 'social' },
  { id: 'game',      name: 'משחק',     hue: 'game', kind: 'games' },
];

const GLYPHS = {
  instagram: '<rect x="5" y="5" width="14" height="14" rx="4.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="16.6" cy="7.4" r="1" fill="currentColor" stroke="none"/>',
  tiktok:    '<path d="M14 4v9.5a3.5 3.5 0 1 1-3-3.46"/><path d="M14 4c.4 2.2 1.9 3.6 4 3.9"/>',
  youtube:   '<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M10.5 9.8v4.4l3.8-2.2z"/>',
  facebook:  '<path d="M14.5 21v-7.5h2.4l.4-3h-2.8V8.8c0-.9.25-1.5 1.5-1.5H17.5V4.6C17.2 4.55 16.2 4.5 15 4.5c-2.4 0-4 1.5-4 4.2v2.8H8.6v3H11V21"/>',
  x:         '<path d="M5 5l14 14M19 5L5 19"/>',
  game:      '<rect x="2.5" y="7" width="19" height="10" rx="4"/><path d="M7 10.5v3M5.5 12h3"/><circle cx="16" cy="11" r=".9" fill="currentColor" stroke="none"/><circle cx="18" cy="13.5" r=".9" fill="currentColor" stroke="none"/>',
};

/** @returns {string} אייקון אפליקציה מדומה */
export function appIcon(id, size = 56) {
  const glyph = GLYPHS[id] || GLYPHS.game;
  return `<span class="appicon appicon--${id}" style="--s:${size}px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg>
  </span>`;
}

export function appById(id) {
  return APPS.find((a) => a.id === id) || null;
}

/** ברירת מחדל אם המשתמש דילג על הבחירה */
export function defaultApps() {
  return APPS.filter((a) => a.kind === 'social').slice(0, 3);
}
