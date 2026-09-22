/**
 * progress.js — מנגנון השלבים (V3, סעיף ד).
 *
 * כל ביצוע מעלה שלב. השלבים מקובצים לסקשנים של עשרה, וכל סקשן
 * מקשה את המשימה ומשלם יותר.
 *
 * מודול טהור: בלי DOM, בלי localStorage.
 */

import { GATES } from '../config.js';

/** כמה שלבים בסקשן (סעיף ד2) */
export const LEVELS_PER_SECTION = 10;

/** תוספת שווי לכל סקשן מעבר לראשון (סעיף ד3) */
export const SECTION_BONUS = 0.2;

/** פרמיה ליחידה על ביצוע דרך המסלול לעומת משימת רוטציה (סעיף ד4) */
export const PROGRESS_PREMIUM_MINUTES = 2.5;

/* ------------------------------------------------------------------ *
 * שלבים וסקשנים
 * ------------------------------------------------------------------ */

/** מספר הסקשן (מ-0) שאליו שייך השלב */
export function sectionOf(level = 1) {
  return Math.floor((Math.max(1, level) - 1) / LEVELS_PER_SECTION);
}

/** המיקום בתוך הסקשן, 1..10 */
export function levelInSection(level = 1) {
  return ((Math.max(1, level) - 1) % LEVELS_PER_SECTION) + 1;
}

/** טווח השלבים של סקשן — "11-20" */
export function sectionRange(section = 0) {
  const from = section * LEVELS_PER_SECTION + 1;
  return { from, to: from + LEVELS_PER_SECTION - 1 };
}

/* ------------------------------------------------------------------ *
 * מדרגות הקושי (סעיף ד3)
 *
 * מדרגה לכל סקשן. כשנגמרות המדרגות נשארים באחרונה — אחרת
 * המשימה הופכת לבלתי אפשרית אחרי מספיק סקשנים.
 * ------------------------------------------------------------------ */

const LADDERS = {
  reading:  [1, 2, 3, 4, 5],          // עמודים
  fitness:  [10, 12, 15, 18, 20],     // חזרות
  writing:  [50, 75, 100, 125, 150],  // מילים
  learning: [1, 1, 1, 1, 1],          // סט אחד; הקושי איכותי ולא כמותי
};

/** כמה יחידות דרושות בשלב הזה */
export function unitsForLevel(nicheId, level = 1) {
  const ladder = LADDERS[nicheId];
  if (!ladder) return 1;
  return ladder[Math.min(sectionOf(level), ladder.length - 1)];
}

/** כל המדרגות של נישה — לתצוגה */
export function ladderOf(nicheId) {
  return LADDERS[nicheId] ? [...LADDERS[nicheId]] : [1];
}

/* ------------------------------------------------------------------ *
 * תשלום (סעיפים ד3, ד4)
 * ------------------------------------------------------------------ */

/**
 * מקדם הסקשן — הדרך שבה קושי איכותי משלם, כשהכמות לא גדלה.
 * סקשן 0 = ×1, סקשן 1 = ×1.2, וכן הלאה.
 */
export function sectionFactor(level = 1) {
  return 1 + sectionOf(level) * SECTION_BONUS;
}

/**
 * כמה דקות שווה השלב הזה.
 *
 * הקושי משלם משתי דרכים: היחידות גדלות (3 עמודים = 3× שווי עמוד),
 * ומעליהן מקדם הסקשן לקושי האיכותי. בנוסף יש פרמיה קבועה ליחידה
 * על כך שזה נעשה במסלול ולא כמשימת רוטציה.
 *
 * @param {string} nicheId
 * @param {number} level
 * @param {number} unitMinutes שווי יחידה אחת לפי formula.unitValue
 */
export function levelValue(nicheId, level, unitMinutes) {
  const units = unitsForLevel(nicheId, level);
  const base = unitMinutes * units * sectionFactor(level);
  return base + PROGRESS_PREMIUM_MINUTES * units;
}

/* ------------------------------------------------------------------ *
 * קידום
 * ------------------------------------------------------------------ */

export function createProgress() {
  return { level: 1, completed: 0, pagesIntoLevel: 0 };
}

/**
 * ביצוע אחד = שלב אחד, בכל הנישות חוץ מקריאה.
 *
 * בקריאה השלב מתקדם לפי עמודים שנקראו (סעיף ד5): צוברים עמודים
 * עד שמגיעים לכמות שהשלב דורש, ורק אז עולים.
 *
 * @returns {{progress: object, leveledUp: boolean}}
 */
export function advance(state, nicheId, units = 1) {
  const cur = { ...createProgress(), ...state };

  if (nicheId !== 'reading') {
    return {
      progress: { ...cur, level: cur.level + 1, completed: cur.completed + 1, pagesIntoLevel: 0 },
      leveledUp: true,
    };
  }

  const need = unitsForLevel('reading', cur.level);
  const pages = cur.pagesIntoLevel + Math.max(0, units);

  if (pages < need) {
    return { progress: { ...cur, pagesIntoLevel: pages }, leveledUp: false };
  }

  return {
    progress: {
      ...cur,
      level: cur.level + 1,
      completed: cur.completed + 1,
      pagesIntoLevel: pages - need,
    },
    leveledUp: true,
  };
}

/** תיאור השלב למשתמש */
export function levelLabel(nicheId, level) {
  const units = unitsForLevel(nicheId, level);
  switch (nicheId) {
    case 'reading':  return `${units} ${units === 1 ? 'עמוד' : 'עמודים'}`;
    case 'fitness':  return `${units} חזרות`;
    case 'writing':  return `${units} מילים`;
    case 'learning': return `סט של 10 שאלות`;
    default:         return `${units}`;
  }
}

/** הנישות שיש להן מסלול התקדמות — הערוץ החופשי */
export const PROGRESS_NICHES = ['reading', 'fitness', 'learning', 'writing']
  .filter((id) => GATES[id]);
