/**
 * formula.js — שווי עמוד בדקות מסך (המפרט, סעיף 5).
 *
 * מודול טהור: אין DOM, אין Date, אין localStorage. נכנס קלט, יוצא מספר.
 * זה הלב הכלכלי של האפליקציה, ולכן הוא גם המודול הכי נבדק.
 */

/** בסיס לפי המטרה שהמשתמש בחר בשאלון */
export const GOAL_BASE = {
  reduce: 10,    // לצמצם דרסטית — עמוד שווה מעט, צריך לקרוא הרבה
  balance: 15,   // לאזן
  read: 20,      // בעיקר לקרוא יותר — עמוד שווה הרבה, הקריאה משתלמת
};

/** מקדם קשיחות */
export const STRICTNESS_FACTOR = {
  soft: 1.25,
  medium: 1.0,
  brutal: 0.5,
};

/** שבועיים של חסד למי שלא קורא בכלל */
export const GRACE_DAYS = 14;
export const GRACE_FACTOR = 1.25;

/**
 * מקדם החסד ביום מסוים. מתחיל ב-1.25 ודועך לינארית ל-1.0 ביום 14.
 * חל רק על מי שענה "בכלל לא קורא".
 *
 * @param {'none'|'some'|'regular'} readingHabit
 * @param {number} daysSinceStart
 * @returns {number}
 */
export function graceFactor(readingHabit, daysSinceStart = 0) {
  if (readingHabit !== 'none') return 1;

  const day = Math.max(0, Math.min(GRACE_DAYS, Math.floor(daysSinceStart)));
  return GRACE_FACTOR - ((GRACE_FACTOR - 1) * day) / GRACE_DAYS;
}

/**
 * גבולות היחס. המפרט מגדיר אותם בסעיף 7.7 (מחוון ההגדרות, 5-30 דק').
 *
 * הערה: נוסחת סעיף 5 יכולה לחרוג מעבר ל-30 בצירוף אחד —
 * "בעיקר לקרוא יותר" + "רך" + "בכלל לא קורא" בימים הראשונים
 * נותן 31.5. זו סתירה בין שני סעיפים במסמך, ולכן התוצאה נחתכת
 * לטווח שהמסמך עצמו מגדיר כלגיטימי.
 */
export const MIN_PAGE_VALUE = 5;
export const MAX_PAGE_VALUE = 30;

/** עיגול לחצי דקה (המפרט, סעיף 5) */
export function roundToHalf(n) {
  return Math.round(n * 2) / 2;
}

/**
 * כמה דקות מסך שווה עמוד אחד.
 *
 * @param {object} profile
 * @param {'reduce'|'balance'|'read'} profile.goal
 * @param {'soft'|'medium'|'brutal'} profile.strictness
 * @param {'none'|'some'|'regular'} profile.readingHabit
 * @param {number} [profile.daysSinceStart=0]
 * @returns {number} דקות לעמוד, בכפולות של חצי
 */
export function computePageValue({ goal, strictness, readingHabit, daysSinceStart = 0 } = {}) {
  const base = GOAL_BASE[goal] ?? GOAL_BASE.balance;
  const strict = STRICTNESS_FACTOR[strictness] ?? STRICTNESS_FACTOR.medium;
  const grace = graceFactor(readingHabit, daysSinceStart);

  const raw = roundToHalf(base * strict * grace);
  return Math.min(MAX_PAGE_VALUE, Math.max(MIN_PAGE_VALUE, raw));
}

/* ------------------------------------------------------------------ *
 * הסבר מילולי — מוצג במסך התוצאה (המפרט, סעיף 7.1)
 * ------------------------------------------------------------------ */

const GOAL_WORDS = {
  reduce: 'לצמצם דרסטית',
  balance: 'לאזן',
  read: 'בעיקר לקרוא יותר',
};

const STRICT_WORDS = {
  soft: 'רך',
  medium: 'בינוני',
  brutal: 'אכזרי',
};

/**
 * שורת ההסבר מתחת למספר. אומרת למשתמש למה יצא לו מה שיצא,
 * בלי להטיף ובלי להתנצל (המפרט, סעיף 8).
 *
 * @returns {string}
 */
export function explainPageValue({ goal, strictness, readingHabit, daysSinceStart = 0 } = {}) {
  const g = GOAL_WORDS[goal] || GOAL_WORDS.balance;
  const s = STRICT_WORDS[strictness] || STRICT_WORDS.medium;

  let line = `בחרת ${g} במצב ${s}`;

  if (strictness === 'brutal') line += ' — לכן היחס מחמיר';
  else if (strictness === 'soft') line += ' — לכן היחס נדיב';

  if (readingHabit === 'none' && daysSinceStart < GRACE_DAYS) {
    line += '. בשבועיים הראשונים היחס מעט נוח יותר, כדי להיכנס לקצב';
  }

  return line;
}
