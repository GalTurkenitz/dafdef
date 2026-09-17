/**
 * store.js — העטיפה היחידה של localStorage (המפרט, סעיף 4).
 * שום קובץ אחר לא נוגע ב-localStorage ישירות.
 *
 * מצב שלב 2: ממומשים settings ו-readingState — מה שהקורא צריך.
 * bank / profile / streak / stats / blockedApps נוספים בשלב 4,
 * יחד עם חוקי החצות. המבנה כאן כבר תואם למפרט כדי שלא יהיה שינוי שובר.
 */

import { STORE_PREFIX } from '../config.js';

/* ------------------------------------------------------------------ *
 * גישה גולמית
 * ------------------------------------------------------------------ */

/** @returns {any} ערך שמור, או fallback אם אין / פגום / localStorage חסום */
export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback; // מצב פרטי בספארי, אחסון מלא, או JSON שבור
  }
}

/** @returns {boolean} האם הכתיבה הצליחה */
export function write(key, value) {
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(STORE_PREFIX + key); } catch { /* ignore */ }
}

/** מוחק את כל המפתחות של האפליקציה ("אפס הכל" בהגדרות) */
export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** תאריך מקומי כ-YYYY-MM-DD — הבסיס לחוקי החצות */
export function today(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ------------------------------------------------------------------ *
 * settings
 * ------------------------------------------------------------------ */

const SETTINGS_DEFAULTS = {
  pageValueMinutes: 15,   // עד שהשאלון רץ (שלב 5) זו ברירת המחדל של "לאזן"
  resetMode: 'midnight',
  theme: null,            // null = לפי העדפת המערכת
  fontSize: 17,           // המפרט, סעיף 3: גוף 17
  onboardingDone: false,
};

export function getSettings() {
  return { ...SETTINGS_DEFAULTS, ...(read('settings') || {}) };
}

/** מעדכן רק את המפתחות שנשלחו */
export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write('settings', next);
  return next;
}

/* ------------------------------------------------------------------ *
 * readingState
 * ------------------------------------------------------------------ */

const READING_DEFAULTS = {
  workId: null,
  location: null,     // מיקום בתוך היצירה (היסט תווים, או CFI ב-EPUB מיובא)
  pagesToday: 0,
  minutesToday: 0,
  date: null,
};

/**
 * מחזיר את מצב הקריאה. אם התאריך השמור אינו היום — המונים היומיים מתאפסים.
 * סגירת היום הקודם (streak + stats) נוספת בשלב 4.
 */
export function getReadingState() {
  const state = { ...READING_DEFAULTS, ...(read('readingState') || {}) };
  const now = today();
  if (state.date !== now) {
    state.pagesToday = 0;
    state.minutesToday = 0;
    state.date = now;
  }
  return state;
}

export function setReadingState(patch) {
  const next = { ...getReadingState(), ...patch, date: today() };
  write('readingState', next);
  return next;
}

/* ------------------------------------------------------------------ *
 * מטמון יצירות — worksCache:<id>
 * ------------------------------------------------------------------ */

export function getCachedWork(id) {
  return read('worksCache:' + id);
}

export function cacheWork(work) {
  return write('worksCache:' + work.id, work);
}
