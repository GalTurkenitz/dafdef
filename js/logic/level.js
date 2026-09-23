/**
 * level.js — רמת המשתמש ואבני הדרך (V4, סעיפים 1.4-1.5).
 *
 * מודול טהור: בלי DOM, בלי localStorage, בלי Date. הוא מקבל
 * מספרים ומחזיר מספרים, ולכן אפשר לבדוק את כל כללי הספים בלי
 * להריץ את האפליקציה.
 *
 * שני מנגנונים שונים שקל לבלבל ביניהם:
 *   **רמה**  — גלובלית למשתמש, נצברת מנקודות (xp) על כל פעולה.
 *   **שלב**  — מקומי לנישה, במסלול ההתקדמות (progress.js).
 * השמות נבחרו בכוונה כדי שלא יתערבבו.
 */

import { MILESTONES, MILESTONE_POINTS, XP, LEVEL_BASE_STEP,
         LEVEL_FIRST_STEPS } from '../config.js';

/* ------------------------------------------------------------------ *
 * אבני דרך
 * ------------------------------------------------------------------ */

/**
 * סולם אבני הדרך של מונה. חמש הראשונות בצעד s, ומהשישית והלאה
 * בצעד 5s — כלל אחיד לכל הנישות (סעיף 1.4).
 *
 * @param {string} key מזהה מונה, למשל 'reading' או 'fitness.pushups'
 * @param {number} upTo עד איזה ערך לייצר ספים
 * @returns {number[]}
 */
export function milestoneLadder(key, upTo = Infinity) {
  const step = MILESTONES[key];
  if (!step) return [];

  const out = [];
  for (let i = 1; i <= 5; i++) {
    const v = step * i;
    if (v > upTo) return out;
    out.push(v);
  }

  const big = step * 5;
  for (let i = 2; ; i++) {
    const v = big * i;
    if (v > upTo) return out;
    out.push(v);
    if (out.length > 200) return out;   // רשת ביטחון
  }
}

/** חמש אבני הדרך הבאות מערך נתון — לתצוגה בכרטיס */
export function milestonesAround(key, value = 0, count = 5) {
  const ladder = milestoneLadder(key, value + MILESTONES[key] * 60 || 0);
  const nextIdx = ladder.findIndex((v) => v > value);
  const start = nextIdx < 0 ? Math.max(0, ladder.length - count)
                            : Math.max(0, nextIdx - 2);
  return ladder.slice(start, start + count)
    .map((v) => ({ value: v, done: value >= v }));
}

/** אבן הדרך הבאה שטרם הושגה, או null */
export function nextMilestone(key, value = 0) {
  const ladder = milestoneLadder(key, value + (MILESTONES[key] || 0) * 10);
  return ladder.find((v) => v > value) ?? null;
}

/**
 * אילו ספים נחצו במעבר מ-before ל-after.
 * @returns {number[]} הספים שנחצו עכשיו, בסדר עולה
 */
export function crossedMilestones(key, before = 0, after = 0) {
  if (after <= before) return [];
  return milestoneLadder(key, after).filter((v) => v > before && v <= after);
}

/* ------------------------------------------------------------------ *
 * נקודות ורמה
 * ------------------------------------------------------------------ */

export { MILESTONE_POINTS, XP };

/**
 * כמה נקודות מצטברות דרושות כדי להגיע לרמה נתונה.
 *
 * חמש הרמות הראשונות בקפיצות של 100 (רמה 2 ב-100 ... רמה 6
 * ב-500), ומשם כל רמה דורשת 500 נוספות.
 */
export function xpForLevel(level = 1) {
  if (level <= 1) return 0;

  const i = level - 2;                       // 0 = רמה 2
  if (i < LEVEL_FIRST_STEPS.length) return LEVEL_FIRST_STEPS[i];

  const last = LEVEL_FIRST_STEPS[LEVEL_FIRST_STEPS.length - 1];
  return last + LEVEL_BASE_STEP * (i - LEVEL_FIRST_STEPS.length + 1);
}

/** הרמה שמתאימה לכמות נקודות */
export function levelForXp(xp = 0) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 999) level += 1;
  return level;
}

/**
 * מצב ההתקדמות לרמה הבאה.
 * @returns {{level, xp, into, need, ratio}}
 */
export function levelProgress(xp = 0) {
  const level = levelForXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const into = xp - from;
  const need = to - from;
  return { level, xp, into, need, ratio: need ? Math.min(1, into / need) : 1 };
}
