/**
 * verify.js — אימות קריאה (המפרט, סעיף 5).
 *
 * שתי שכבות, שתיהן חובה:
 *   1. זמן מינימלי פר עמוד לפי מילים — קצב ייחוס 170 מילים/דקה, רצפה 20 שניות.
 *   2. נוכחות — אין אינטראקציה מעל 2.5 דקות ⇒ הטיימר נעצר (חוזר במגע);
 *      מעבר אפליקציה (visibilitychange) ⇒ עצירה מיידית.
 *
 * מודול טהור: בלי DOM, בלי Date.now, בלי setInterval.
 * כל פונקציה שתלויה בזמן מקבלת חותמת זמן מבחוץ (ms) — כדי שיהיה אפשר
 * לבדוק אותה בקלות ולהעביר את הלוגיקה כמו שהיא ל-iOS.
 */

/** קצב קריאה ייחוס, מילים לדקה */
export const WPM = 170;

/** רצפת זמן לעמוד — גם עמוד של שתי שורות דורש את זה */
export const FLOOR_MS = 20_000;

/** בלי אינטראקציה מעל זה — הקורא כנראה לא שם */
export const IDLE_MS = 150_000; // 2.5 דקות

/**
 * ספירת מילים בעברית. מתעלם מניקוד, טעמי מקרא, גרשיים ופיסוק.
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  if (!text) return 0;
  return text
    .replace(/[֑-ׇ]/g, '')       // ניקוד וטעמים
    .replace(/[^\p{L}\p{N}'"׳״-]+/gu, ' ') // כל השאר מפריד
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

/**
 * כמה זמן עמוד כזה חייב להיות פתוח כדי להיחשב נקרא.
 * @param {number} words
 * @returns {number} ms
 */
export function requiredMs(words) {
  const byLength = (Math.max(0, words) / WPM) * 60_000;
  return Math.max(FLOOR_MS, Math.round(byLength));
}

/**
 * מאמת עמוד יחיד. נוצר מחדש בכל דפדוף.
 *
 * @param {object} opts
 * @param {number} opts.words מספר המילים בעמוד המוצג
 * @param {number} opts.now   חותמת הזמן שבה העמוד נפתח
 */
export function createPageVerifier({ words, now }) {
  const required = requiredMs(words);

  let accumulated = 0;      // זמן קריאה שנצבר בפועל
  let cursor = now;         // עד מתי כבר ספרנו
  let lastActivity = now;   // האינטראקציה האחרונה
  let running = true;       // false כשהאפליקציה ברקע
  let counted = false;      // העמוד כבר נספר? (פעם אחת בלבד)

  /** עד מתי עוד מותר לספור בלי אינטראקציה חדשה */
  const idleDeadline = () => lastActivity + IDLE_MS;

  /**
   * מקדם את השעון ומוסיף לזמן שנצבר את מה שבאמת נקרא.
   * זמן שמעבר לסף חוסר-הפעילות פשוט לא נספר — ולכן הטיימר "נעצר" מעצמו.
   */
  function advance(t) {
    if (running) {
      const until = Math.min(t, idleDeadline());
      if (until > cursor) accumulated += until - cursor;
    }
    cursor = Math.max(cursor, t);
  }

  return {
    words,
    requiredMs: required,

    /** אינטראקציה של המשתמש — מגע, גלילה, דפדוף. מחדש את חלון הנוכחות. */
    activity(t) {
      advance(t);
      lastActivity = t;
      if (!running) { running = true; cursor = t; }
    },

    /** מעבר אפליקציה / מסך כבוי — עצירה מיידית (המפרט, סעיף 5) */
    hide(t) {
      advance(t);
      running = false;
    },

    /** חזרה לאפליקציה — הזמן מתחיל להיספר מחדש מעכשיו */
    show(t) {
      cursor = t;
      lastActivity = t;
      running = true;
    },

    /** זמן קריאה שנצבר עד t (ms) */
    elapsed(t) {
      advance(t);
      return accumulated;
    },

    /** כמה עוד חסר (ms). 0 כשהעמוד בשל. */
    remaining(t) {
      return Math.max(0, required - this.elapsed(t));
    },

    /** 0..1 — לשימוש חיווי התקדמות */
    progress(t) {
      return required === 0 ? 1 : Math.min(1, this.elapsed(t) / required);
    },

    /** האם הטיימר עצור כרגע (רקע או חוסר פעילות) */
    isPaused(t) {
      return !running || t > idleDeadline();
    },

    /** האם העמוד עבר את שתי השכבות */
    isSatisfied(t) {
      return this.elapsed(t) >= required;
    },

    /**
     * מסמן שהעמוד נספר. מחזיר true רק בפעם הראשונה,
     * כדי שהצבירה לבנק תקרה בדיוק פעם אחת לעמוד.
     */
    claim(t) {
      if (counted || !this.isSatisfied(t)) return false;
      counted = true;
      return true;
    },

    /** האם העמוד כבר נספר */
    get counted() { return counted; },
  };
}
