/**
 * background.js — נישות הרקע: צעדים ושינה (המפרט, סעיף 10.7).
 *
 * ** בדמו הנתונים מדומים. **
 * בגרסת ה-iOS הנתונים מגיעים מ-HealthKit — צעדים דרך
 * HKQuantityTypeIdentifierStepCount ושינה דרך
 * HKCategoryTypeIdentifierSleepAnalysis. הלוגיקה כאן נשארת כמו
 * שהיא; רק מקור הנתונים מתחלף.
 *
 * מודול טהור: בלי DOM, בלי Date, בלי localStorage.
 */

import { GATES, BACKGROUND_DEFAULTS } from '../config.js';

/* ------------------------------------------------------------------ *
 * צעדים
 * ------------------------------------------------------------------ */

/**
 * כמה יחידות זיכוי מגיעות על הצעדים של היום.
 * יחידה = 1,000 צעדים מעל קו הבסיס (המפרט, סעיף 6).
 *
 * @param {number} steps    צעדים היום
 * @param {number} baseline קו הבסיס שהמשתמש הגדיר
 * @returns {number} יחידות שלמות
 */
export function stepUnits(steps = 0, baseline = BACKGROUND_DEFAULTS.steps.baseline) {
  const above = Math.max(0, steps - Math.max(0, baseline));
  return Math.floor(above / 1000);
}

/** כמה צעדים חסרים ליחידה הבאה — לחיווי התקדמות */
export function stepsToNextUnit(steps = 0, baseline = BACKGROUND_DEFAULTS.steps.baseline) {
  const above = Math.max(0, steps - Math.max(0, baseline));
  return 1000 - (above % 1000);
}

/* ------------------------------------------------------------------ *
 * שינה
 * ------------------------------------------------------------------ */

/**
 * האם עמדת ביעד השינה. יחידה אחת ליום, לא יותר.
 *
 * @param {number} hours שעות שינה בפועל
 * @param {number} target היעד שהוגדר
 */
export function sleepUnits(hours = 0, target = BACKGROUND_DEFAULTS.sleep.targetHours) {
  return hours >= target ? 1 : 0;
}

/* ------------------------------------------------------------------ *
 * סיכום
 * ------------------------------------------------------------------ */

/**
 * כמה יחידות מגיעות על נישות הרקע, בניכוי מה שכבר שולם היום.
 * הניכוי הוא מה שמונע תשלום כפול כשהמסך נטען שוב ושוב.
 *
 * @param {object} data   { steps, sleepHours, paid: { steps, sleep } }
 * @param {object} config { steps: {baseline}, sleep: {targetHours} }
 * @returns {{steps: number, sleep: number}} יחידות לתשלום עכשיו
 */
export function duePayout(data = {}, config = {}) {
  const paid = data.paid || {};

  const steps = stepUnits(data.steps, config.steps?.baseline)
              - (paid.steps || 0);

  const sleep = sleepUnits(data.sleepHours, config.sleep?.targetHours)
              - (paid.sleep || 0);

  return { steps: Math.max(0, steps), sleep: Math.max(0, sleep) };
}

/** כמה דקות שווה יחידה אחת, לפני מקדמי השאלון */
export const BASE_MINUTES = {
  steps: GATES.steps.base,
  sleep: GATES.sleep.base,
};
