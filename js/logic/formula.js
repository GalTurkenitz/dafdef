/**
 * formula.js — שערי הרווח (המפרט, סעיף 6).
 *
 * כל נישה מגדירה כמה דקות שווה יחידה אחת שלה. על הבסיס הזה מוכפלים
 * שני מקדמים מהשאלון: המטרה והקשיחות. התוצאה זהה לכל הנישות —
 * מי שבחר "אכזרי" מקבל פחות על הכל, לא רק על הקריאה.
 *
 * מודול טהור: בלי DOM, בלי Date, בלי localStorage.
 *
 * הערה על עיגול: המפרט אומר "עיגול לדקה", אבל חזרת כושר בודדת
 * שווה דקה אחת לפני מקדמים — ובמצב אכזרי היא הייתה מתעגלת לאפס
 * ומאבדת את כל הערך. לכן העיגול נעשה בזמן ההצגה ובזמן הזיכוי של
 * אצווה, בעוד החישוב הפנימי נשאר שברי. bank.js ממילא מחזיק שברים.
 */

import { GATES, GOAL_FACTOR, STRICTNESS_FACTOR, NICHES } from '../config.js';

export const DEFAULT_PROFILE = { goal: 'balance', strictness: 'medium' };

/** המקדם המשולב מהשאלון */
export function profileFactor({ goal, strictness } = {}) {
  const g = GOAL_FACTOR[goal] ?? GOAL_FACTOR.balance;
  const s = STRICTNESS_FACTOR[strictness] ?? STRICTNESS_FACTOR.medium;
  return g * s;
}

/**
 * כמה דקות שווה יחידה אחת של הנישה — ערך מדויק, בלי עיגול.
 * זה המספר שמשמש לזיכוי בפועל.
 *
 * @param {string} nicheId
 * @param {{goal, strictness}} profile
 * @returns {number}
 */
export function unitValue(nicheId, profile = DEFAULT_PROFILE) {
  const gate = GATES[nicheId];
  if (!gate) return 0;
  return gate.base * profileFactor(profile);
}

/**
 * כמה דקות שווה משימת רוטציה שלמה של הנישה.
 * לכושר משימה היא 10 חזרות, לשאר יחידה אחת.
 */
export function taskValue(nicheId, profile = DEFAULT_PROFILE) {
  const gate = GATES[nicheId];
  if (!gate) return 0;
  return unitValue(nicheId, profile) * gate.taskUnits;
}

/** כמה דקות מגיעות על כמות יחידות */
export function earnFor(nicheId, units, profile = DEFAULT_PROFILE) {
  return unitValue(nicheId, profile) * Math.max(0, units);
}

/** עיגול לדקה שלמה — לתצוגה בלבד (המפרט, סעיף 6) */
export function roundMinutes(n) {
  return Math.round(n);
}

/* ------------------------------------------------------------------ *
 * טבלת השערים האישית (המפרט, סעיף 8ג)
 * ------------------------------------------------------------------ */

/**
 * שורה לכל נישה שנבחרה, עם השווי המחושב שלה.
 * מוצגת בסוף השאלון ובדשבורד — לקריאה בלבד.
 *
 * @returns {Array<{id, name, icon, unit, label, minutes}>}
 */
export function gateTable(selected = [], profile = DEFAULT_PROFILE) {
  return selected
    .filter((id) => GATES[id] && NICHES[id])
    .map((id) => {
      const niche = NICHES[id];
      const gate = GATES[id];
      const perTask = taskValue(id, profile);

      // לכושר מציגים את המשימה (10 חזרות) — חזרה בודדת מתעגלת לאפס
      const showTask = gate.taskUnits > 1;

      return {
        id,
        name: niche.name,
        icon: niche.icon,
        unit: niche.unit,
        label: showTask ? niche.taskLabel : niche.unit,
        minutes: roundMinutes(showTask ? perTask : unitValue(id, profile)),
      };
    });
}

/* ------------------------------------------------------------------ *
 * הסבר מילולי (המפרט, סעיף 8ג)
 * ------------------------------------------------------------------ */

const GOAL_WORDS = {
  reduce: 'לצמצם דרסטית',
  balance: 'לאזן',
  habits: 'להוסיף הרגלים טובים',
};

const STRICT_WORDS = {
  soft: 'רך',
  medium: 'בינוני',
  brutal: 'אכזרי',
};

/**
 * השורה שמסבירה למשתמש למה יצא לו מה שיצא.
 * טון חם ולא מטיף (המפרט, סעיף 4 של המסמך המקורי).
 */
export function explainGates({ goal, strictness } = {}) {
  const g = GOAL_WORDS[goal] || GOAL_WORDS.balance;
  const s = STRICT_WORDS[strictness] || STRICT_WORDS.medium;

  let line = `בחרת ${g} במצב ${s}`;
  if (strictness === 'brutal') line += ' — לכן היחסים מחמירים';
  else if (strictness === 'soft') line += ' — לכן היחסים נדיבים';

  if (goal === 'habits') line += '. כל פעולה שווה יותר, כדי שיהיה כדאי להתחיל';
  else if (goal === 'reduce') line += '. צריך לעבוד יותר על כל דקת מסך';

  return line;
}

/* ------------------------------------------------------------------ *
 * תאימות זמנית — נמחק בשלב 3
 *
 * ה-onboarding הישן עדיין מדבר בשפה של "שווי עמוד". השלב הבא
 * מחליף אותו בשאלון הרב-נישתי, ואז שתי הפונקציות האלה יורדות.
 * עד אז הן קיימות רק כדי שכל קומיט יישאר פריס.
 * ------------------------------------------------------------------ */

/** @deprecated השתמש ב-unitValue('reading', profile) */
export function computePageValue(profile = DEFAULT_PROFILE) {
  return roundMinutes(unitValue('reading', profile));
}

/** @deprecated השתמש ב-explainGates */
export function explainPageValue(profile = DEFAULT_PROFILE) {
  return explainGates(profile);
}
