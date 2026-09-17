/**
 * bank.js — בנק הזמן (המפרט, סעיף 5).
 *
 * מודול טהור: כל פונקציה מקבלת מצב ומחזירה מצב חדש, בלי לגעת
 * ב-localStorage ובלי לקרוא לשעון בעצמה. מי שמחבר את זה לדפדפן
 * הוא store.js ושכבת ה-UI.
 *
 * מצב הבנק: { minutes, lastUpdate }
 *   minutes    — היתרה בדקות (שבר עשרוני, לא מעוגל)
 *   lastUpdate — חותמת הזמן של החישוב האחרון
 */

/** אין תקרה לבנק (המפרט, סעיף 5) */
export const NO_CAP = Infinity;

export function createBank(now = 0) {
  return { minutes: 0, lastUpdate: now };
}

/**
 * צבירה — עמוד מאומת נכנס לבנק.
 *
 * @param {{minutes:number,lastUpdate:number}} bank
 * @param {number} pages כמה עמודים
 * @param {number} pageValueMinutes שווי עמוד
 * @param {number} now
 */
export function earn(bank, pages, pageValueMinutes, now) {
  const added = Math.max(0, pages) * Math.max(0, pageValueMinutes);
  return { minutes: bank.minutes + added, lastUpdate: now };
}

/**
 * ניקוז — מוריד את הזמן שעבר מאז החישוב האחרון.
 *
 * מחשבים לפי הפרש חותמות זמן ולא לפי ספירת טיקים, כדי שזה יישאר
 * נכון גם כשהדפדפן הלך לרקע והטיימרים הוקפאו (המפרט, סעיף 5).
 *
 * @returns {{bank: object, spent: number, emptied: boolean}}
 */
export function drain(bank, now) {
  const elapsedMin = Math.max(0, (now - bank.lastUpdate) / 60_000);
  const spent = Math.min(bank.minutes, elapsedMin);
  const minutes = Math.max(0, bank.minutes - elapsedMin);

  return {
    bank: { minutes, lastUpdate: now },
    spent,
    emptied: bank.minutes > 0 && minutes === 0,
  };
}

/**
 * מקדם את חותמת הזמן בלי לנקז — לשימוש כשהאפליקציה החסומה סגורה,
 * אחרת הבנק "יזלוג" על כל הזמן שעבר מאז הפעם הקודמת.
 */
export function touch(bank, now) {
  return { minutes: bank.minutes, lastUpdate: now };
}

/** האם נגמרו הדקות */
export function isEmpty(bank) {
  return bank.minutes <= 0;
}

/** היתרה כמספר שלם להצגה */
export function displayMinutes(bank) {
  return Math.floor(bank.minutes);
}

/**
 * כמה זמן נשאר עד שהבנק יתרוקן, במילישניות.
 * משמש את הטיימר היורד במסך האפליקציה המדומה.
 */
export function remainingMs(bank) {
  return Math.max(0, bank.minutes * 60_000);
}

/** איפוס חצות — רק במצב "מתאפסות בחצות" (המפרט, סעיף 4) */
export function resetDaily(bank, resetMode, now) {
  if (resetMode !== 'midnight') return touch(bank, now);
  return { minutes: 0, lastUpdate: now };
}
