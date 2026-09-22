/**
 * rotation.js — מנוע הסבב היומי (המפרט, סעיף 3).
 *
 * הסבב מורכב מהנישות שהמשתמש בחר, חוץ מצעדים ושינה שצוברים ברקע.
 * הכלל המרכזי: אי אפשר לחזור על משימת רוטציה שכבר בוצעה היום —
 * עד שכל הסבב הושלם. הערוץ החופשי לא מוגבל בכך לעולם.
 *
 * מודול טהור: בלי DOM, בלי localStorage, בלי Date. כל פונקציה
 * מקבלת מצב ומחזירה מצב חדש או תשובה.
 *
 * מצב הסבב:
 *   { date, done: { reading: true, … }, skipped: [...],
 *     roundComplete: boolean, bonusGiven: boolean }
 */

import { NICHES, ROUND_NICHE_IDS } from '../config.js';

export function createRound(date = null) {
  return { date, done: {}, skipped: [], roundComplete: false,
           bonusGiven: false, roundsToday: 0 };
}

/* ------------------------------------------------------------------ *
 * הרכב הסבב
 * ------------------------------------------------------------------ */

/**
 * הנישות שמרכיבות את הסבב היומי — הנבחרות, בלי נישות הרקע,
 * בסדר הקבוע של config כדי שהסבב יהיה יציב בין טעינות.
 *
 * @param {string[]} selected
 * @returns {string[]}
 */
export function roundNiches(selected = []) {
  const set = new Set(selected);
  return ROUND_NICHE_IDS.filter((id) => set.has(id));
}

/** האם הנישה בוצעה היום */
export function isDone(round, nicheId) {
  return Boolean(round?.done?.[nicheId]);
}

/** כמה בוצעו מתוך כמה — לחיווי "3/6" */
export function progress(round, selected) {
  const all = roundNiches(selected);
  return { done: all.filter((id) => isDone(round, id)).length, total: all.length };
}

/** האם כל הסבב הושלם */
export function isRoundComplete(round, selected) {
  const all = roundNiches(selected);
  return all.length > 0 && all.every((id) => isDone(round, id));
}

/* ------------------------------------------------------------------ *
 * בחירת המשימה הבאה
 * ------------------------------------------------------------------ */

/**
 * הנישה שכרטיס "המשימה שלי" מציע עכשיו.
 *
 * הסדר: קודם מי שטרם בוצע וטרם דולג, ואם כולם דולגו — חוזרים
 * למדולגים לפי סדר הדילוג. כך דילוג באמת דוחה ולא מבטל.
 *
 * @returns {string|null} מזהה נישה, או null כשהסבב הושלם
 */
export function nextTask(round, selected) {
  const all = roundNiches(selected);
  const pending = all.filter((id) => !isDone(round, id));
  if (!pending.length) return null;

  const skipped = round.skipped || [];
  const fresh = pending.filter((id) => !skipped.includes(id));
  if (fresh.length) return fresh[0];

  // כולם דולגו — מחזירים את מי שדולג ראשון
  const bySkipOrder = skipped.filter((id) => pending.includes(id));
  return bySkipOrder[0] ?? pending[0];
}

/** דוחה את המשימה הנוכחית לסוף התור */
export function skip(round, nicheId) {
  if (!nicheId || isDone(round, nicheId)) return round;

  const skipped = (round.skipped || []).filter((id) => id !== nicheId);
  skipped.push(nicheId);
  return { ...round, skipped };
}

/* ------------------------------------------------------------------ *
 * זמינות
 * ------------------------------------------------------------------ */

/**
 * האם מותר לבצע את הנישה עכשיו.
 *
 * הערוץ החופשי תמיד פתוח. נישות הערוץ המשימתי זמינות **אך ורק
 * בתורן בסבב הנוכחי** (V3, סעיף ג1) — השלמת סבב לא פותחת ביצוע
 * חופשי, אלא מתחילה סבב חדש שבו הן חוזרות לתור.
 */
export function canPerform(round, selected, nicheId) {
  const niche = NICHES[nicheId];
  if (!niche) return { allowed: false, reason: 'unknown' };

  if (!selected.includes(nicheId)) return { allowed: false, reason: 'not-selected' };

  // צעדים ושינה צוברים ברקע, לא "מבצעים" אותם
  if (niche.channel === 'background') return { allowed: false, reason: 'background' };

  // הערוץ החופשי לא מוגבל לעולם
  if (niche.channel === 'free') return { allowed: true, reason: null };

  // ערוץ משימות: זמין רק כשזו המשימה הנוכחית בסבב
  if (isDone(round, nicheId)) return { allowed: false, reason: 'done-this-round' };

  return { allowed: true, reason: null };
}

/* ------------------------------------------------------------------ *
 * ביצוע
 * ------------------------------------------------------------------ */

/**
 * מסמן נישה כבוצעה היום. נקרא גם ממשימת רוטציה וגם מפעילות
 * חופשית — שתיהן מסמנות ✓ (המפרט, סעיף 3).
 *
 * @returns {{round: object, justCompleted: boolean, bonusDue: boolean}}
 *   justCompleted — הסבב נסגר בדיוק עכשיו
 *   bonusDue      — מגיע בונוס השלמה שטרם ניתן
 */
export function markDone(round, selected, nicheId) {
  const niche = NICHES[nicheId];
  if (!niche || niche.channel === 'background') {
    return { round, justCompleted: false, bonusDue: false };
  }

  let next = {
    ...round,
    done: { ...round.done, [nicheId]: true },
    // הנישה בוצעה — אין טעם שתישאר ברשימת המדולגים
    skipped: (round.skipped || []).filter((id) => id !== nicheId),
  };

  const justCompleted = isRoundComplete(next, selected);
  const bonusDue = justCompleted && !next.bonusGiven;

  if (justCompleted) {
    // הסבב מחזורי: מיד מתחיל סבב חדש באותו יום (V3, סעיף ג1)
    next = {
      ...next,
      done: {},
      skipped: [],
      roundComplete: true,          // היום כבר כולל סבב מלא — לסטריק
      roundsToday: (next.roundsToday || 0) + 1,
    };
  }

  return { round: next, justCompleted, bonusDue };
}

/**
 * מרפא מצב סבב שנתקע כשכל הנישות מסומנות כבוצעו.
 *
 * הסבב מחזורי, ולכן המצב הזה לא אמור להתקיים: markDone מאפס
 * אותו ברגע שהסבב נסגר. הוא כן נוצר כשרשימת הנישות משתנה
 * *אחרי* שסומנו — למשל כשמסירים בהגדרות את הנישה היחידה שטרם
 * בוצעה, וכל מה שנשאר כבר מסומן. אז nextTask מחזיר null, המסך
 * נשאר בלי משימה הבאה, ואין דרך לצאת מזה עד חצות.
 *
 * הריפוי נעשה בקריאה ולא בכתיבה, כדי שגם מצב שכבר נשמר בעבר
 * יתוקן. roundComplete ו-bonusGiven נשמרים — היום עדיין נחשב
 * כמלא לרצף, והבונוס לא יינתן פעמיים.
 *
 * @returns {object} הסבב עצמו, או סבב חדש כשהוא היה תקוע
 */
export function normalize(round, selected = []) {
  if (!round || !isRoundComplete(round, selected)) return round;
  return { ...round, done: {}, skipped: [], roundComplete: true };
}

/** מסמן שבונוס ההשלמה כבר שולם, כדי שלא יינתן פעמיים */
export function markBonusGiven(round) {
  return { ...round, bonusGiven: true };
}

/* ------------------------------------------------------------------ *
 * תצוגה
 * ------------------------------------------------------------------ */

/**
 * מחוון הסבב במסך הבית — נישה, האם בוצעה, והאם היא המשימה הנוכחית.
 * @returns {Array<{id, name, icon, done, current}>}
 */
export function roundStatus(round, selected) {
  const current = nextTask(round, selected);
  return roundNiches(selected).map((id) => ({
    id,
    name: NICHES[id].name,
    icon: NICHES[id].icon,
    done: isDone(round, id),
    current: id === current,
  }));
}

/** נישות הערוץ החופשי שהמשתמש בחר — כרטיסי הכניסה המהירה בבית */
export function freeNiches(selected = []) {
  return selected.filter((id) => NICHES[id]?.channel === 'free');
}
