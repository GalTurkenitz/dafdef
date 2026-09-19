/**
 * learning.js — בניית סט השאלות ובדיקתו (המפרט, סעיף 10.2).
 *
 * מודול טהור: מקבל מאגר מילים והיסטוריה, מחזיר סט שאלות.
 * בלי DOM, בלי fetch, בלי localStorage.
 *
 * הכלל: מילים שטעו בהן חוזרות בסטים הבאים לפני מילים חדשות.
 */

import { LEARNING } from '../config.js';

/**
 * ערבוב עם זרע קבוע — כך שאותו סט נבנה אותו דבר אם צריך לשחזר,
 * ובלי להישען על Math.random שאי אפשר לבדוק.
 */
export function shuffle(arr, seed = 1) {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * בונה סט של עשר שאלות.
 *
 * מחצית רב-ברירה (אנגלית ⇐ עברית) ומחצית השלמה, כדי שלא יהיה
 * אפשר לפתור הכל בזיהוי צורה בלבד.
 *
 * @param {Array} pool      כל המילים ברמה שנבחרה
 * @param {string[]} wrong  מזהי מילים שטעו בהן בעבר
 * @param {number} seed
 * @returns {Array} שאלות
 */
export function buildSet(pool, wrong = [], seed = 1) {
  if (!pool?.length) return [];

  const wrongSet = new Set(wrong);
  const repeats = pool.filter((w) => wrongSet.has(w.id));
  const fresh = pool.filter((w) => !wrongSet.has(w.id));

  // קודם מה שטעינו בו, ואז חדשות
  const chosen = [
    ...shuffle(repeats, seed).slice(0, LEARNING.questionsPerSet),
    ...shuffle(fresh, seed + 7),
  ].slice(0, LEARNING.questionsPerSet);

  return chosen.map((word, i) => {
    const wantsFill = i % 2 === 1 && word.sentence;

    if (wantsFill) {
      return {
        id: word.id,
        kind: 'fill',
        prompt: word.sentence.replace('____', ' ____ '),
        hint: word.he,
        answer: word.en,
      };
    }

    // רב-ברירה: שלושה מסיחים מאותה רמה
    const distractors = shuffle(pool.filter((w) => w.id !== word.id), seed + i)
      .slice(0, 3)
      .map((w) => w.he);

    return {
      id: word.id,
      kind: 'choice',
      prompt: word.en,
      answer: word.he,
      options: shuffle([word.he, ...distractors], seed + i + 100),
    };
  });
}

/** האם התשובה נכונה. סלחני לרווחים ולאותיות גדולות. */
export function isCorrect(question, given) {
  const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(given) === norm(question.answer);
}

/**
 * האם הסט הושלם — נדרשות לפחות minCorrect תשובות נכונות
 * (המפרט, סעיף 10.2: מתחת ל-8/10 הסט לא הושלם).
 */
export function isSetComplete(correctCount) {
  return correctCount >= LEARNING.minCorrect;
}

/** מוסיף מזהים שטעו בהם להיסטוריה, בלי כפילויות ובלי לגדול בלי סוף */
export function rememberWrong(previous = [], wrongIds = [], max = 60) {
  return [...new Set([...wrongIds, ...previous])].slice(0, max);
}

/** מסיר מזהים שנענו נכון מרשימת הטעויות */
export function forgetWrong(previous = [], correctIds = []) {
  const done = new Set(correctIds);
  return previous.filter((id) => !done.has(id));
}
