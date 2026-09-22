/**
 * daily.js — בחירה יומית מתוך מאגרים (V3, סעיפים ו2-ו4).
 *
 * שני מודולים מחליפים תוכן כל יום: הכתיבה מחליפה נושא, והמדיטציה
 * מחליפה תרגיל. שניהם בוחרים **לפי התאריך** ולא באקראי, כדי ששני
 * ביקורים באותו יום יקבלו את אותו דבר — גם אחרי רענון, וגם אם
 * המשתמש יוצא וחוזר.
 *
 * הבחירה מוגבלת למה שנפתח עד השלב הנוכחי במסלול ההתקדמות, כך
 * שהתוכן נעשה מאתגר יותר עם הזמן ולא מיד.
 *
 * מודול טהור: בלי DOM, בלי localStorage, בלי Date — התאריך והמצב
 * מגיעים כארגומנטים.
 */

/** מספר יציב מתוך מחרוזת תאריך "YYYY-MM-DD" */
export function dateSeed(dateStr = '') {
  const s = String(dateStr);
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

/**
 * בוחר פריט מתוך רשימה לפי התאריך.
 * @param {Array} list
 * @param {string} dateStr
 * @param {number} [salt] מפריד בין שני מאגרים שנבחרים באותו יום
 */
export function pickForDate(list, dateStr, salt = 0) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[(dateSeed(dateStr) + salt) % list.length];
}

/* ------------------------------------------------------------------ *
 * כתיבה (ו2, ו3)
 * ------------------------------------------------------------------ */

/**
 * המדרגה שנפתחה עד השלב הנתון. כל עשרה שלבים נפתחת מדרגה,
 * כדי שהמדרגות יתיישרו עם הסקשנים במסלול ההתקדמות.
 */
export function writingTier(tiers = [], level = 1) {
  if (!tiers.length) return null;
  const unlocked = Math.min(tiers.length - 1, Math.floor((Math.max(1, level) - 1) / 10));
  return tiers[unlocked];
}

/**
 * הנושא היומי לכתיבה.
 * @returns {{topic: string, tier: object}|null}
 */
export function writingTopic(bank, dateStr, level = 1) {
  const tier = writingTier(bank?.tiers || [], level);
  if (!tier) return null;
  return { topic: pickForDate(tier.topics, dateStr), tier };
}

/* ------------------------------------------------------------------ *
 * מדיטציה (ו4)
 * ------------------------------------------------------------------ */

/**
 * התרגיל היומי. נבחר רק מבין התרגילים שנפתחו עד השלב הנוכחי;
 * tier 0 זמין מהיום הראשון, והשאר נפתחים כל עשרה שלבים.
 */
export function meditationOfDay(bank, dateStr, level = 1) {
  const all = bank?.exercises || [];
  if (!all.length) return null;

  const maxTier = Math.floor((Math.max(1, level) - 1) / 10);
  const open = all.filter((e) => (e.tier || 0) <= maxTier);

  // salt שונה מהכתיבה, כדי ששני המאגרים לא יזוזו יחד
  return pickForDate(open.length ? open : all, dateStr, 7);
}

/** אורך מחזור נשימה אחד בשניות */
export function cycleSeconds(pattern = {}) {
  return (pattern.inhale || 0) + (pattern.hold || 0)
       + (pattern.exhale || 0) + (pattern.holdOut || 0);
}

/**
 * הפאזה שבה נמצאים בתוך מחזור, ומה ההתקדמות בתוכה.
 * מחזיר גם `flow`: 'in' בשאיפה, 'out' בנשיפה, null בעצירה —
 * זה מה שמזין את חיצי האוויר שעל הווידאו (ו5).
 */
export function phaseAt(pattern = {}, elapsedSeconds = 0) {
  const steps = [
    { key: 'inhale',  label: 'שאף',  seconds: pattern.inhale  || 0, flow: 'in' },
    { key: 'hold',    label: 'החזק', seconds: pattern.hold    || 0, flow: null },
    { key: 'exhale',  label: 'נשוף', seconds: pattern.exhale  || 0, flow: 'out' },
    { key: 'holdOut', label: 'המתן', seconds: pattern.holdOut || 0, flow: null },
  ].filter((s) => s.seconds > 0);

  const cycle = steps.reduce((s, p) => s + p.seconds, 0);
  if (!cycle) return null;

  let into = elapsedSeconds % cycle;
  for (const step of steps) {
    if (into < step.seconds) {
      return { ...step, into, progress: step.seconds ? into / step.seconds : 0 };
    }
    into -= step.seconds;
  }
  return { ...steps[0], into: 0, progress: 0 };
}
