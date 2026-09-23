/**
 * writing.js — אימות רישום היומן (המפרט, סעיף 10.3).
 *
 * שלושה מבחנים, כולם חובה:
 *   1. אורך — לפחות 50 מילים
 *   2. זמן — רישום אמיתי לא נכתב בעשר שניות
 *   3. קצב הקלדה — מעל סף מסוים זו לא הקלדה אנושית אלא הדבקה
 *
 * חסימת ההדבקה עצמה נעשית ב-UI; כאן נמצאת הבדיקה שאי אפשר לעקוף
 * אותה בכך שמקלידים מהר מדי.
 *
 * מודול טהור: בלי DOM, בלי Date.
 */

import { WRITING } from '../config.js';

/** ספירת מילים — עברית ואנגלית, בלי ניקוד וסימני פיסוק */
/**
 * ספירת משפטים. מסלול הכתיבה נמדד במשפטים ולא במילים, ולכן צריך
 * מדד משלו. משפט = רצף טקסט שנסגר בנקודה, סימן שאלה, קריאה או
 * שורה חדשה, ויש בו לפחות שתי מילים — כדי ש"כן." לא ייחשב.
 */
export function countSentences(text) {
  if (!text) return 0;
  return String(text)
    .split(/[.!?\n\u05C3]+/)
    .map((part) => part.trim())
    .filter((part) => countWords(part) >= 2)
    .length;
}

export function countWords(text) {
  if (!text) return 0;
  return text
    .replace(/[֑-ׇ]/g, '')
    .replace(/[^\p{L}\p{N}'"׳״-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

/**
 * בודק רישום.
 *
 * @param {object} entry
 * @param {string} entry.text
 * @param {number} entry.elapsedMs  כמה זמן עבר מתחילת הכתיבה
 * @param {number} [entry.pasted=0] כמה תווים הודבקו (ה-UI סופר)
 * @returns {{ok: boolean, words: number, reason: string|null}}
 */
/**
 * @param {object} opts
 * @param {number} [opts.minWords] רף מילים חלופי — מדרגות גבוהות
 *   במסלול הכתיבה דורשות יותר (V3, סעיף ו3)
 */
export function verifyEntry({ text = '', elapsedMs = 0, pasted = 0,
                              minWords = WRITING.minWords,
                              minSentences = 0 } = {}) {
  const words = countWords(text);

  if (pasted > 0) {
    return { ok: false, words, reason: 'paste' };
  }

  // במסלול ההתקדמות הדרישה היא משפטים; ברוטציה — מילים
  if (minSentences > 0 && countSentences(text) < minSentences) {
    return { ok: false, words, reason: 'short' };
  }

  if (words < minWords) {
    return { ok: false, words, reason: 'short' };
  }

  const seconds = elapsedMs / 1000;
  if (seconds < WRITING.minSeconds) {
    return { ok: false, words, reason: 'fast' };
  }

  // קצב תווים לשנייה — מעל הסף זו לא הקלדה
  if (seconds > 0 && text.length / seconds > WRITING.maxCharsPerSecond) {
    return { ok: false, words, reason: 'rate' };
  }

  return { ok: true, words, reason: null };
}

/** הודעה למשתמש לפי סיבת הכישלון. טון ענייני, בלי הטפה. */
export function reasonText(reason, words = 0) {
  switch (reason) {
    case 'paste':
      return 'הדבקה לא נספרת כאן. כתוב במילים שלך.';
    case 'short':
      return `עוד ${Math.max(0, WRITING.minWords - words)} מילים ונסיים.`;
    case 'fast':
      return 'קח עוד רגע — רישום אמיתי לוקח יותר מדקה.';
    case 'rate':
      return 'הקצב מהיר מדי בשביל הקלדה. משהו כאן לא מסתדר.';
    default:
      return '';
  }
}

/** פרומפט יומי — נבחר לפי התאריך כדי שיהיה יציב לאורך היום */
export const PROMPTS = [
  'על מה אתה גאה מהיום?',
  'מה הדבר האחד שהיית עושה אחרת?',
  'מי עשה לך את היום קל יותר?',
  'מה גזל לך הכי הרבה אנרגיה היום?',
  'מה למדת היום, גם אם קטן?',
  'מה אתה דוחה כבר יותר מדי זמן?',
  'מה היה הרגע הכי שקט שלך היום?',
  'על מה אתה מודה עכשיו?',
  'מה היית אומר לעצמך של הבוקר?',
  'מה אתה רוצה שיקרה מחר?',
];

export function promptForDate(dateStr = '') {
  const n = String(dateStr).split('-').reduce((a, p) => a + Number(p || 0), 0);
  return PROMPTS[n % PROMPTS.length];
}
