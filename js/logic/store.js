/**
 * store.js — העטיפה היחידה של localStorage (המפרט, סעיף 4).
 * שום קובץ אחר לא נוגע ב-localStorage ישירות.
 *
 * כאן גם יושבים חוקי החצות: כל טעינת עמוד וכל חזרה לפוקוס קוראות
 * ל-openDay(), שסוגרת את היום הקודם אם עבר חצות.
 */

import { STORE_PREFIX } from '../config.js';
import * as bankLogic from './bank.js';
import * as streakLogic from './streak.js';

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
  pageValueMinutes: 15,   // עד שהשאלון רץ — ברירת המחדל של "לאזן"
  resetMode: 'midnight',
  theme: null,            // null = לפי העדפת המערכת
  fontSize: 17,
  onboardingDone: false,
};

export function getSettings() {
  return { ...SETTINGS_DEFAULTS, ...(read('settings') || {}) };
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write('settings', next);
  return next;
}

/* ------------------------------------------------------------------ *
 * profile — תשובות השאלון
 * ------------------------------------------------------------------ */

export function getProfile() {
  return read('profile');
}

export function setProfile(profile) {
  write('profile', { ...profile, createdAt: profile.createdAt || Date.now() });
  return getProfile();
}

/** כמה ימים עברו מאז שהמשתמש נרשם — נכנס לנוסחה */
export function daysSinceStart(now = Date.now()) {
  const profile = getProfile();
  if (!profile?.createdAt) return 0;
  return Math.max(0, Math.floor((now - profile.createdAt) / 86_400_000));
}

/* ------------------------------------------------------------------ *
 * bank
 * ------------------------------------------------------------------ */

export function getBank() {
  const raw = read('bank');
  if (!raw || typeof raw.minutes !== 'number') return bankLogic.createBank(Date.now());
  return { minutes: raw.minutes, lastUpdate: raw.lastUpdate || Date.now() };
}

export function setBank(bank) {
  write('bank', bank);
  return bank;
}

/** צבירה של עמודים מאומתים. מחזיר את הבנק החדש ואת הדקות שנוספו. */
export function earnPages(pages = 1, now = Date.now()) {
  const { pageValueMinutes } = getSettings();
  const bank = bankLogic.earn(getBank(), pages, pageValueMinutes, now);
  setBank(bank);

  registerReadToday(now);
  addToday({ pagesRead: pages, minutesEarned: pages * pageValueMinutes }, now);

  return { bank, added: pages * pageValueMinutes };
}

/* ------------------------------------------------------------------ *
 * blockedApps
 * ------------------------------------------------------------------ */

export function getBlockedApps() {
  return read('blockedApps') || [];
}

export function setBlockedApps(apps) {
  write('blockedApps', apps);
  return apps;
}

/* ------------------------------------------------------------------ *
 * readingState — מונים יומיים בלבד
 *
 * המיקום בספר כבר לא יושב כאן אלא ב-books, כי המשתמש קורא
 * כמה ספרים במקביל. כאן נשאר רק מה שגלובלי ליום.
 * ------------------------------------------------------------------ */

const READING_DEFAULTS = {
  lastWorkId: null,   // הספר האחרון שנפתח — לכניסה מהירה לקורא
  pagesToday: 0,
  minutesToday: 0,
  date: null,
};

export function getReadingState() {
  const raw = read('readingState') || {};

  // הגירה מהמבנה הישן, שבו המיקום היה גלובלי
  if (raw.workId && !raw.lastWorkId) {
    raw.lastWorkId = raw.workId;
    if (raw.location != null) touchBook(raw.workId, { location: raw.location });
  }

  const state = { ...READING_DEFAULTS, ...raw };
  delete state.workId;
  delete state.location;

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
 * streak
 * ------------------------------------------------------------------ */

export function getStreak() {
  return { ...streakLogic.createStreak(), ...(read('streak') || {}) };
}

export function setStreak(streak) {
  write('streak', streak);
  return streak;
}

function registerReadToday(now = Date.now()) {
  const day = today(new Date(now));
  const next = streakLogic.registerRead(getStreak(), day);
  return setStreak(next);
}

/* ------------------------------------------------------------------ *
 * stats — 7 הימים האחרונים
 * ------------------------------------------------------------------ */

export const STATS_DAYS = 7;

export function getStats() {
  const raw = read('stats');
  return Array.isArray(raw) ? raw : [];
}

export function setStats(stats) {
  write('stats', stats.slice(-STATS_DAYS));
  return getStats();
}

/** מוסיף למונים של היום. יוצר רשומה אם אין. */
export function addToday(delta, now = Date.now()) {
  const day = today(new Date(now));
  const stats = getStats();

  let entry = stats.find((s) => s.date === day);
  if (!entry) {
    entry = { date: day, pagesRead: 0, minutesEarned: 0, minutesSpent: 0 };
    stats.push(entry);
  }

  entry.pagesRead += delta.pagesRead || 0;
  entry.minutesEarned += delta.minutesEarned || 0;
  entry.minutesSpent += delta.minutesSpent || 0;

  return setStats(stats);
}

/**
 * שבעת הימים האחרונים כולל ימים ריקים — מה שגרף העמודות צריך.
 * @returns {Array<{date:string,pagesRead:number,minutesEarned:number,minutesSpent:number}>}
 */
export function getWeek(now = Date.now()) {
  const stats = getStats();
  const out = [];

  for (let i = STATS_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = today(d);
    out.push(stats.find((s) => s.date === date)
      || { date, pagesRead: 0, minutesEarned: 0, minutesSpent: 0 });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * חוקי החצות (המפרט, סעיף 4)
 * ------------------------------------------------------------------ */

/**
 * נקרא בכל טעינת עמוד ובכל חזרה לפוקוס.
 * אם עבר חצות: סוגר את היום הקודם, מאפס מונים יומיים,
 * ומאפס את הבנק רק אם resetMode === 'midnight'.
 *
 * @returns {{rolled: boolean, streakBroke: boolean, bankReset: boolean}}
 */
export function openDay(now = Date.now()) {
  const day = today(new Date(now));
  const marker = read('lastOpenDay');

  if (marker === day) return { rolled: false, streakBroke: false, bankReset: false };

  // ריצה ראשונה: אין יום קודם לסגור. רק מסמנים, בלי לאפס כלום —
  // אחרת פתיחה ראשונה של האפליקציה הייתה מוחקת בנק קיים.
  if (!marker) {
    write('lastOpenDay', day);
    return { rolled: false, streakBroke: false, bankReset: false };
  }

  const settings = getSettings();

  // רצף נשבר אם לא נקרא אתמול
  const { streak, broke } = streakLogic.closeDay(getStreak(), day);
  if (broke) setStreak(streak);

  // מונים יומיים — getReadingState כבר מאפס לפי תאריך, רק צריך לשמור
  setReadingState({});

  // הבנק
  const bankReset = settings.resetMode === 'midnight' && getBank().minutes > 0;
  setBank(bankLogic.resetDaily(getBank(), settings.resetMode, now));

  write('lastOpenDay', day);
  return { rolled: true, streakBroke: broke, bankReset };
}

/**
 * כלי פיתוח: "קפוץ יום" (המפרט, סעיף 9.3).
 * מזיז אחורה את כל חותמות הזמן והתאריכים ביום אחד,
 * כדי שאפשר יהיה לבדוק חצות, סטריק ואיפוס בלי לחכות.
 */
export function devJumpDay(days = 1) {
  const shiftMs = days * 86_400_000;

  const shiftDate = (dateStr) => {
    if (!dateStr) return dateStr;
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - days);
    return today(d);
  };

  const profile = getProfile();
  if (profile?.createdAt) write('profile', { ...profile, createdAt: profile.createdAt - shiftMs });

  const streak = getStreak();
  if (streak.lastReadDate) setStreak({ ...streak, lastReadDate: shiftDate(streak.lastReadDate) });

  setStats(getStats().map((s) => ({ ...s, date: shiftDate(s.date) })));

  const reading = read('readingState');
  if (reading?.date) write('readingState', { ...reading, date: shiftDate(reading.date) });

  const marker = read('lastOpenDay');
  if (marker) write('lastOpenDay', shiftDate(marker));

  const bank = getBank();
  setBank({ ...bank, lastUpdate: bank.lastUpdate - shiftMs });

  return openDay();
}

/* ------------------------------------------------------------------ *
 * books — כל ספר ומצב הקריאה שלו
 *
 * המשתמש קורא כמה ספרים במקביל, ולכן המיקום, נקודת ההתחלה
 * ונקודת הסיום נשמרים לכל ספר בנפרד. מונה העמודים היומי והבנק
 * נשארים גלובליים.
 * ------------------------------------------------------------------ */

export function getBooks() {
  const raw = read('books');
  return raw && typeof raw === 'object' ? raw : {};
}

export function getBook(id) {
  return getBooks()[id] || null;
}

/**
 * מעדכן ספר. שדות שלא נשלחו נשארים כמו שהם.
 * page/percent נשמרים כמקסימום, כדי שדפדוף אחורה לא יוריד התקדמות.
 */
export function touchBook(id, patch = {}) {
  if (!id) return getBooks();

  const books = getBooks();
  const prev = books[id] || {};
  const next = { ...prev, id, updatedAt: Date.now() };

  for (const key of ['title', 'author', 'genre', 'estMinutes', 'pages', 'chars']) {
    if (patch[key] != null) next[key] = patch[key];
  }

  // מיקום נוכחי — נע חופשי קדימה ואחורה
  if (patch.location != null) next.location = patch.location;

  // נקודות ההתחלה והסיום שהמשתמש סימן
  if ('start' in patch) next.start = patch.start;
  if ('end' in patch) next.end = patch.end;

  // התקדמות — רק קדימה
  if (patch.page != null) next.page = Math.max(prev.page || 0, patch.page);
  if (patch.percent != null) next.percent = Math.min(1, Math.max(prev.percent || 0, patch.percent));

  if (patch.finished) next.finished = true;

  books[id] = next;
  write('books', books);
  return books;
}

export function removeBook(id) {
  const books = getBooks();
  delete books[id];
  write('books', books);
  return books;
}

/** הספרים שבקריאה, מהאחרון שנקרא. משמש את "הספרים שלי" ואת הדשבורד. */
export function getStartedBooks() {
  return Object.values(getBooks()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/* ------------------------------------------------------------------ *
 * מטמון יצירות — worksCache:<id>
 * ------------------------------------------------------------------ */

export function getCachedWork(id) {
  return read('worksCache:' + id);
}

/**
 * מעל הגודל הזה אין טעם לנסות לשמור — localStorage מוגבל ל-5-10MB,
 * וכישלון כתיבה באמצע עלול לפגוע גם במפתחות אחרים.
 * ספר גדול פשוט נטען מחדש מהרשת; הוא ממילא מגיע מאותו מקור סטטי.
 */
export const MAX_CACHE_BYTES = 900_000;

export function cacheWork(work) {
  const size = (work.html || '').length * 2;   // UTF-16 בזיכרון
  if (size > MAX_CACHE_BYTES) return false;
  return write('worksCache:' + work.id, work);
}
