/**
 * streak.js — רצף ימי הקריאה (המפרט, סעיף 5).
 *
 * יום עם עמוד מאומת אחד לפחות הוא יום סטריק.
 * פספוס יום מאפס את הרצף הנוכחי, אבל לא את השיא.
 *
 * מודול טהור: עובד על מחרוזות תאריך YYYY-MM-DD, בלי Date ובלי אזורי זמן.
 */

export function createStreak() {
  return { current: 0, best: 0, lastReadDate: null };
}

/** YYYY-MM-DD ⇐ מספר ימים, כדי להשוות תאריכים בלי אובייקט Date */
function toDayNumber(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** כמה ימים עברו בין שני תאריכים */
export function daysBetween(from, to) {
  const a = toDayNumber(from);
  const b = toDayNumber(to);
  return Number.isNaN(a) || Number.isNaN(b) ? NaN : b - a;
}

/**
 * העמוד המאומת הראשון של היום — מקדם את הרצף.
 * קריאה נוספת באותו יום לא משנה דבר.
 *
 * @param {{current:number,best:number,lastReadDate:string|null}} streak
 * @param {string} today YYYY-MM-DD
 */
export function registerRead(streak, today) {
  if (streak.lastReadDate === today) return streak;

  const gap = streak.lastReadDate ? daysBetween(streak.lastReadDate, today) : null;
  // רצף ממשיך רק אם קראנו אתמול; אחרת מתחילים מ-1
  const current = gap === 1 ? streak.current + 1 : 1;

  return {
    current,
    best: Math.max(streak.best, current),
    lastReadDate: today,
  };
}

/**
 * סגירת יום: אם עבר יותר מיום מאז הקריאה האחרונה, הרצף נשבר.
 * נקרא בכל טעינת עמוד ובכל חזרה לפוקוס (המפרט, סעיף 4).
 *
 * @returns {{streak: object, broke: boolean}}
 */
export function closeDay(streak, today) {
  if (!streak.lastReadDate || streak.current === 0) {
    return { streak, broke: false };
  }

  const gap = daysBetween(streak.lastReadDate, today);
  if (Number.isNaN(gap) || gap <= 1) return { streak, broke: false };

  return {
    streak: { ...streak, current: 0 },
    broke: true,
  };
}

/** האם כבר נקרא עמוד היום */
export function readToday(streak, today) {
  return streak.lastReadDate === today;
}
