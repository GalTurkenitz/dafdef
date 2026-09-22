/**
 * store.js — העטיפה היחידה של localStorage (המפרט, סעיף 7).
 * שום קובץ אחר לא נוגע ב-localStorage ישירות.
 *
 * כאן גם יושבים חוקי החצות: כל טעינת עמוד וכל חזרה לפוקוס קוראות
 * ל-openDay(), שסוגרת את היום הקודם אם עבר חצות.
 */

import { STORE_PREFIX, BACKGROUND_DEFAULTS, ROUND_BONUS_MINUTES,
         WATER_COOLDOWN_MS, NICHES } from '../config.js';
import * as bankLogic from './bank.js';
import * as streakLogic from './streak.js';
import * as rotation from './rotation.js';
import * as background from './background.js';
import * as levels from './progress.js';
import { earnFor } from './formula.js';

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

/**
 * צבירה על ביצוע יחידות בנישה כלשהי — עמוד, חזרה, סט, כוס וכו'.
 * זו הדלת היחידה לבנק: כל מודול קורא לה, אף אחד לא נוגע בבנק ישירות.
 *
 * מסמן ✓ בסבב, מזין את הסטריק ואת הסטטיסטיקה, ומשלם בונוס השלמה
 * אם הסבב נסגר בדיוק עכשיו.
 *
 * @returns {{bank, added, roundComplete, bonus}}
 */
export function earnUnits(nicheId, units = 1, now = Date.now()) {
  const profile = getProfile() || {};
  return creditMinutes(nicheId, earnFor(nicheId, units, profile), now,
                       nicheId === 'reading' ? units : 0);
}

/** שווי יחידה — עטיפה כדי ש-completeLevel לא ייבא את formula ישירות */
function formulaUnitValue(nicheId, profile) {
  return earnFor(nicheId, 1, profile);
}

/**
 * הזיכוי עצמו: מכניס דקות לבנק, מסמן ✓ בסבב, משלם בונוס השלמה
 * פעם ביום, ומזין סטריק וסטטיסטיקה.
 *
 * זו הדלת היחידה לבנק — כל מודול עובר דרכה.
 */
function creditMinutes(nicheId, added, now = Date.now(), pagesRead = 0) {
  let bank = bankLogic.earn(getBank(), 1, added, now);
  const stats = { minutesEarned: added };
  if (pagesRead) stats.pagesRead = pagesRead;

  const selected = getSelectedNiches();
  const { round, bonusDue } = rotation.markDone(getRound(), selected, nicheId);

  // בונוס ההשלמה — רק על הסבב הראשון של היום (V3, סעיף ג2)
  let bonus = 0;
  if (bonusDue && ROUND_BONUS_MINUTES > 0 && !round.bonusGiven) {
    bonus = ROUND_BONUS_MINUTES;
    bank = bankLogic.earn(bank, 1, bonus, now);
    stats.minutesEarned += bonus;
    setRound(rotation.markBonusGiven(round));
  } else {
    setRound(round);
  }

  setBank(bank);
  addToday(stats, now);
  addNicheToday(nicheId, added + bonus, now);

  if (round.roundComplete) registerRoundToday(now);

  return { bank, added, roundComplete: round.roundComplete, bonus };
}

/** תאימות לאחור — הקורא עדיין מדבר בעמודים */
export function earnPages(pages = 1, now = Date.now()) {
  return earnUnits('reading', pages, now);
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

/**
 * האם הושלם היום סבב מלא. זה מה שקובע אם היום כבר נזקף לרצף,
 * ולכן גם אם חיווי הרצף דולק או כבוי.
 */
export function roundDoneToday() {
  return Boolean(getRound().roundComplete);
}

/** הסטריק נזקף על השלמת סבב מלא, לא על עמוד בודד (המפרט, סעיף 3) */
function registerRoundToday(now = Date.now()) {
  const day = today(new Date(now));
  return setStreak(streakLogic.registerRead(getStreak(), day));
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

  // הסבב היומי מתחיל מחדש (המפרט, סעיף 3)
  setRound(rotation.createRound(day));

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

  // בלי סמן יום קודם, openDay יחשוב שזו ריצה ראשונה ולא יאפס כלום.
  // קורה רק כשקופצים יום מיד אחרי איפוס, אבל אז הכפתור נראה שבור.
  if (!read('lastOpenDay')) write('lastOpenDay', today());

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

  const round = read('dailyRound');
  if (round?.date) write('dailyRound', { ...round, date: shiftDate(round.date) });

  const bg = read('moduleData:background');
  if (bg?.date) write('moduleData:background', { ...bg, date: shiftDate(bg.date) });

  const nicheStats = read('nicheStats');
  if (nicheStats) {
    write('nicheStats', Object.fromEntries(
      Object.entries(nicheStats).map(([d, v]) => [shiftDate(d), v])));
  }

  const bank = getBank();
  setBank({ ...bank, lastUpdate: bank.lastUpdate - shiftMs });

  return openDay();
}

/* ------------------------------------------------------------------ *
 * niches — הנישות שנבחרו וההגדרות שלהן (המפרט, סעיף 7)
 * ------------------------------------------------------------------ */

const NICHES_DEFAULTS = {
  selected: [],
  settings: {
    steps: { ...BACKGROUND_DEFAULTS.steps },
    sleep: { ...BACKGROUND_DEFAULTS.sleep },
    learning: { level: 'beginner' },
  },
};

export function getNiches() {
  const raw = read('niches') || {};
  return {
    selected: Array.isArray(raw.selected) ? raw.selected : NICHES_DEFAULTS.selected,
    settings: { ...NICHES_DEFAULTS.settings, ...(raw.settings || {}) },
  };
}

export function getSelectedNiches() {
  return getNiches().selected;
}

export function setNiches(patch) {
  const next = { ...getNiches(), ...patch };
  write('niches', next);
  return next;
}

/** מעדכן את ההגדרות של נישה אחת בלי לדרוס את האחרות */
export function setNicheSettings(nicheId, patch) {
  const n = getNiches();
  n.settings[nicheId] = { ...(n.settings[nicheId] || {}), ...patch };
  write('niches', n);
  return n;
}

/* ------------------------------------------------------------------ *
 * dailyRound — הסבב היומי (המפרט, סעיפים 3, 7)
 * ------------------------------------------------------------------ */

/** הסבב של היום. אם השמור הוא מיום אחר — מתחילים סבב נקי. */
export function getRound() {
  const raw = read('dailyRound');
  const now = today();
  if (!raw || raw.date !== now) return rotation.createRound(now);

  // normalize מרפא סבב שנתקע עם כל הנישות מסומנות — מצב שנוצר
  // כשרשימת הנישות השתנתה אחרי שסומנו, ומשאיר את המסך בלי
  // משימה הבאה עד חצות
  return rotation.normalize({ ...rotation.createRound(now), ...raw },
                            getSelectedNiches());
}

export function setRound(round) {
  write('dailyRound', { ...round, date: today() });
  return round;
}

/** הנישה שכרטיס "המשימה שלי" מציע עכשיו */
export function currentTask() {
  return rotation.nextTask(getRound(), getSelectedNiches());
}

/** דוחה את המשימה הנוכחית לסוף התור */
export function skipTask(nicheId) {
  return setRound(rotation.skip(getRound(), nicheId));
}

/** האם מותר לבצע את הנישה עכשיו */
export function canPerform(nicheId) {
  return rotation.canPerform(getRound(), getSelectedNiches(), nicheId);
}

/** מחוון הסבב לתצוגה */
/**
 * פותח סבב חדש ידנית. הסבב נפתח מעצמו בכל השלמה, וזו רשת
 * ביטחון למקרה שהמצב נתקע בכל זאת — כדי שלמשתמש תהיה תמיד דרך
 * להמשיך בלי לחכות לחצות.
 */
export function startNewRound() {
  const round = getRound();
  return setRound({ ...round, done: {}, skipped: [] });
}

export function roundStatus() {
  return rotation.roundStatus(getRound(), getSelectedNiches());
}

export function roundProgress() {
  return rotation.progress(getRound(), getSelectedNiches());
}

/* ------------------------------------------------------------------ *
 * moduleData:<niche> — מצב פנימי של כל מודול
 * ------------------------------------------------------------------ */

export function getModuleData(nicheId, fallback = {}) {
  return { ...fallback, ...(read('moduleData:' + nicheId) || {}) };
}

export function setModuleData(nicheId, patch) {
  const next = { ...getModuleData(nicheId), ...patch };
  write('moduleData:' + nicheId, next);
  return next;
}

/** קירור המים — כמה זמן נשאר עד הכוס הבאה (המפרט, סעיף 10.5) */
export function waterCooldownLeft(now = Date.now()) {
  const last = getModuleData('water').lastDrink || 0;
  return Math.max(0, WATER_COOLDOWN_MS - (now - last));
}

/* ------------------------------------------------------------------ *
 * פירוט יומי לפי נישה — מה הדשבורד מציג (המפרט, סעיף 9.4)
 * ------------------------------------------------------------------ */

function addNicheToday(nicheId, minutes, now = Date.now()) {
  const day = today(new Date(now));
  const all = read('nicheStats') || {};
  const forDay = all[day] || {};

  forDay[nicheId] = (forDay[nicheId] || 0) + minutes;
  all[day] = forDay;

  // שומרים שבוע אחורה בלבד
  const keep = Object.keys(all).sort().slice(-7);
  write('nicheStats', Object.fromEntries(keep.map((d) => [d, all[d]])));
  return forDay;
}

/** כמה הרוויח היום מכל נישה */
export function getNicheToday(now = Date.now()) {
  const all = read('nicheStats') || {};
  return all[today(new Date(now))] || {};
}

/* ------------------------------------------------------------------ *
 * נישות הרקע — צעדים ושינה (המפרט, סעיף 10.7)
 *
 * בדמו הנתונים מדומים ומוזרקים ידנית. בגרסת ה-iOS הם יגיעו
 * מ-HealthKit, והפונקציות כאן יישארו כמו שהן.
 * ------------------------------------------------------------------ */

const BACKGROUND_EMPTY = { date: null, steps: 0, sleepHours: 0, paid: { steps: 0, sleep: 0 } };

export function getBackground() {
  const raw = read('moduleData:background') || {};
  const day = today();

  // יום חדש — המונים והתשלומים מתאפסים
  if (raw.date !== day) return { ...BACKGROUND_EMPTY, date: day };

  return { ...BACKGROUND_EMPTY, ...raw, paid: { ...BACKGROUND_EMPTY.paid, ...(raw.paid || {}) } };
}

export function setBackground(patch) {
  const next = { ...getBackground(), ...patch, date: today() };
  write('moduleData:background', next);
  return next;
}

/**
 * משלם על צעדים ושינה שנצברו וטרם שולמו.
 * עובר דרך bank.js הרגיל, בדיוק כמו כל נישה אחרת.
 *
 * @returns {{steps: number, sleep: number, minutes: number}} מה שולם עכשיו
 */
export function settleBackground(now = Date.now()) {
  const data = getBackground();
  const { settings } = getNiches();
  const selected = getSelectedNiches();

  const due = background.duePayout(data, settings);
  let minutes = 0;

  for (const niche of ['steps', 'sleep']) {
    if (!selected.includes(niche) || due[niche] <= 0) continue;

    const { added } = earnUnits(niche, due[niche], now);
    minutes += added;
    data.paid[niche] = (data.paid[niche] || 0) + due[niche];
  }

  if (minutes > 0) setBackground({ paid: data.paid });
  return { ...due, minutes };
}

/** כלי פיתוח: הזרקת צעדים ושינה לבדיקת הזרימה (המפרט, סעיף 10.7) */
export function devInjectBackground({ steps, sleepHours } = {}) {
  const patch = {};
  if (steps != null) patch.steps = Math.max(0, steps);
  if (sleepHours != null) patch.sleepHours = Math.max(0, sleepHours);
  setBackground(patch);
  return settleBackground();
}

/* ------------------------------------------------------------------ *
 * מסלולי ההתקדמות (V3, סעיף ד)
 *
 * שלב נוכחי לכל נישה. שורד בין ימים ולא מתאפס בחצות (סעיף ד7).
 * ------------------------------------------------------------------ */

export function getProgress(nicheId) {
  return { ...levels.createProgress(), ...(read('progress:' + nicheId) || {}) };
}

export function setProgress(nicheId, state) {
  write('progress:' + nicheId, state);
  return state;
}

/** כל המסלולים, לתצוגת עמוד ההתקדמות */
export function allProgress() {
  return Object.fromEntries(levels.PROGRESS_NICHES.map((id) => [id, getProgress(id)]));
}

/**
 * ביצוע דרך מסלול ההתקדמות.
 *
 * משלם לפי שווי השלב (כולל מקדם הסקשן והפרמיה), מקדם את השלב,
 * ומסמן ✓ בסבב היומי — מערכת אחת, לא שתיים (סעיף ד6).
 *
 * @returns {{added, leveledUp, level, bonus, roundComplete}}
 */
export function completeLevel(nicheId, units = 1, now = Date.now()) {
  const profile = getProfile() || {};
  const before = getProgress(nicheId);

  const { progress: after, leveledUp } = levels.advance(before, nicheId, units);
  setProgress(nicheId, after);

  // משלמים רק על שלב שהושלם; עמודים באמצע שלב נצברים ולא מזכים
  if (!leveledUp) {
    return { added: 0, leveledUp: false, level: after.level, bonus: 0, roundComplete: false };
  }

  const minutes = levels.levelValue(nicheId, before.level, formulaUnitValue(nicheId, profile));
  const res = creditMinutes(nicheId, minutes, now);

  return { ...res, leveledUp: true, level: after.level };
}

/* ------------------------------------------------------------------ *
 * books — כל ספר ומצב הקריאה שלו
 *
 * המשתמש קורא כמה ספרים במקביל, ולכן המיקום, נקודת ההתחלה
 * ונקודת הסיום נשמרים לכל ספר בנפרד. מונה העמודים היומי והבנק
 * נשארים גלובליים.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * הספר הפעיל (V3, סעיף ז1)
 *
 * הקריאה צמודה לספר אחד בכל רגע. הספרייה כבר אינה יעד ניווט אלא
 * בוחר שנפתח מ"החלף ספר" או בסיום ספר, ומחזיר לקורא.
 * ------------------------------------------------------------------ */

export function getActiveBookId() {
  const raw = read('activeBook');
  return raw && typeof raw.id === 'string' ? raw.id : null;
}

export function setActiveBookId(id) {
  write('activeBook', { id, since: Date.now() });
  return id;
}

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
