/**
 * sip.js — הגיאומטריה של "שתיתי", טהורה ובלי DOM.
 *
 * היא יושבת כאן ולא בתוך modules/water.js בדיוק מאותה סיבה
 * ש-reps.js יושב כאן: אפשר לאמת אותה בלי מצלמה ובלי דפדפן,
 * ולכן אפשר להוכיח שהיא עובדת במקום לקוות.
 *
 * ─────────────────────────────────────────────────────────────────
 *  מה זה כן עושה ומה זה לא
 *
 *  מזהה האובייקטים מסווג **צורה**, לא תוכן. בקבוק בושם הוא
 *  "bottle" מבחינתו, וכוס ריקה זהה לכוס מלאה. **אי אפשר לאמת
 *  שתיית מים במצלמה**, ולכן המשימה הזו שווה הכי מעט דקות והיא
 *  זמינה רק כמשימה ולא בערוץ החופשי.
 *
 *  מה שכן אפשר זה להעלות את המחיר של רמאות. שלושה שערים, וכולם
 *  יחסיים לגוף ולכן בלתי תלויים במרחק מהמצלמה:
 *
 *    1. הכוס ליד **הפה**, לא ליד האף.
 *    2. **גודל** המיכל ביחס לראש — בקבוק בושם קטן מדי.
 *    3. **הטיית ראש לאחור**, מכוילת לתנוחה של המשתמש עצמו —
 *       מי שמרים חפץ לפנים בלי לשתות לא מטה את הראש.
 *
 *  מה שעדיין עובר: כוס ריקה, כוס עם משהו אחר, ומי שמעמיד פני
 *  שותה כמו שצריך. זה מקובל — המשימה עולה שתי דקות.
 * ─────────────────────────────────────────────────────────────────
 *
 * **הבאג שתוקן קודם:** הסף היה מרחק קבוע של 0.22 מרוחב הפריים
 * בין שורש כף היד לאף. כשאתה שותה היד נמוכה מהפה, והמרחק בפריים
 * תלוי כמה אתה רחוק מהמצלמה — כך שקרוב למצלמה הסף לא נפתח כלל.
 */

/** הכוס ליד הפה, ביחידות של גובה ראש */
export const CUP_NEAR = 1.0;

/** גיבוי: היד ליד הפה, באותן יחידות */
export const HAND_NEAR = 1.05;

/**
 * הצלע הארוכה של המיכל, ביחס לגובה הראש.
 * ראש ≈ 22 ס"מ; כוס ≈ 12-15, בקבוק ≈ 25, בקבוק בושם ≈ 8.
 */
export const MIN_CUP_SIZE = 0.5;

/**
 * כמה הראש צריך להיטות אחורה מעבר לתנוחת הבסיס של המשתמש,
 * ביחידות של גובה ראש.
 */
export const TILT_DELTA = 0.08;

/**
 * מזהה האובייקטים רץ פעם ב-300ms, והכוס נעלמת לו כשהיא צמודה
 * לפנים ומוסתרת ביד. זיכרון קצר מונע איפוס של הלגימה באמצע.
 */
export const CUP_MEMORY_MS = 1500;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function mid(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * מרכז תיבת הכוס וגודלה, בקואורדינטות מנורמלות (0..1).
 * MediaPipe מחזיר את התיבה בפיקסלים של הפריים.
 *
 * @param {{originX:number, originY:number, width:number, height:number}|null} box
 * @returns {{x:number, y:number, w:number, h:number, long:number}|null}
 */
export function cupBox(box, frameW = 640, frameH = 480) {
  if (!box || !frameW || !frameH) return null;
  const w = box.width / frameW;
  const h = box.height / frameH;
  return {
    x: (box.originX + box.width / 2) / frameW,
    y: (box.originY + box.height / 2) / frameH,
    w,
    h,
    long: Math.max(w, h),
  };
}

/**
 * גובה ראש בקירוב — המרחק בין האף לאמצע הכתפיים.
 * כל הספים נמדדים ביחס אליו, ולכן אינם תלויים במרחק מהמצלמה.
 */
export function bodyScale(nose, shouldersMid) {
  if (!nose || !shouldersMid) return 0;
  return dist(nose, shouldersMid);
}

/**
 * כמה הראש מוטה אחורה, ביחידות של גובה ראש.
 *
 * כשהראש זקוף האף נמצא בערך בגובה האוזניים. כשמטים אחורה כדי
 * לשתות, האף **עולה** בתמונה והאוזניים יורדות — כלומר ההפרש
 * גדל. הערך המוחלט תלוי במבנה הפנים, ולכן משווים אותו לתנוחת
 * הבסיס של אותו משתמש ולא לסף גלובלי.
 */
export function headTilt(nose, earMid, scale) {
  if (!nose || !earMid || !scale) return null;
  return (earMid.y - nose.y) / scale;
}

/**
 * האם עכשיו שותים.
 *
 * @param {object} o
 * @param {{x,y}} o.nose
 * @param {{x,y}} o.shoulders  אמצע הכתפיים
 * @param {{x,y}|null} o.mouth אמצע הפה; בלעדיו נופלים לאף
 * @param {{x,y}|null} o.earMid אמצע האוזניים
 * @param {Array<{x,y}>} o.wrists
 * @param {{x,y,long}|null} o.cup תיבת הכוס המנורמלת
 * @param {number} o.now
 * @param {number} o.lastCupAt מתי כוס זוהתה לאחרונה
 * @param {number|null} o.tiltRef הטיית הבסיס שנמדדה בשלב ההצגה
 */
export function sipState({ nose, shoulders, mouth = null, earMid = null,
                           wrists = [], cup = null, now = 0, lastCupAt = 0,
                           tiltRef = null } = {}) {
  const off = { drinking: false, cupAtMouth: false, handNearFace: false,
                cupRecent: false, bigEnough: false, tilted: false,
                scale: 0, tilt: null };
  if (!nose || !shoulders) return off;

  const scale = bodyScale(nose, shoulders);
  if (!scale) return off;

  /* הפה הוא היעד הנכון. אם אין נקודות פה, האף הוא קירוב סביר. */
  const target = mouth || nose;

  const nearest = wrists
    .filter(Boolean)
    .reduce((best, w) => {
      const d = dist(w, target);
      return best === null || d < best ? d : best;
    }, null);

  const handNearFace = nearest !== null && nearest < scale * HAND_NEAR;

  /* שער הגודל: בקבוק בושם או עט לא נחשבים מיכל שתייה */
  const bigEnough = !!cup && cup.long >= scale * MIN_CUP_SIZE;

  const cupAtMouth = !!cup && bigEnough && dist(cup, target) < scale * CUP_NEAR;

  /* lastCupAt=0 פירושו "כוס לא זוהתה מעולם". בלי הבדיקה הזו, בשנייה
     וחצי הראשונות של הריצה now-0 קטן מהזיכרון, ויד ריקה הייתה
     עוברת. נמצא בהשוואה מול הסף הישן, לא בבדיקה עצמה. */
  const cupRecent = lastCupAt > 0 && now - lastCupAt < CUP_MEMORY_MS;

  /* שער ההטיה, מכויל לתנוחת הבסיס של המשתמש. בלי בסיס מדוד לא
     דורשים אותו — עדיף לא לחסום מאשר לחסום על כיול חסר. */
  const tilt = headTilt(nose, earMid, scale);
  const tilted = tiltRef === null || tilt === null
    ? true
    : tilt >= tiltRef + TILT_DELTA;

  /* הכוס מול הפה מספיקה לבדה. היד לבדה נחשבת רק כשכוס זוהתה ממש
     לפני כן, אחרת יד ריקה הייתה עוברת. ההטיה נדרשת בשני המקרים. */
  const near = cupAtMouth || (handNearFace && cupRecent && bigEnoughRecently(cup, bigEnough));

  return {
    drinking: near && tilted,
    cupAtMouth,
    handNearFace,
    cupRecent,
    bigEnough,
    tilted,
    scale,
    tilt,
  };
}

/* כשהכוס נעלמה למזהה אין לנו גודל למדוד, ואז סומכים על כך
   שהיא עברה את שער הגודל כשהיא עוד נראתה (שלב ההצגה). */
function bigEnoughRecently(cup, bigEnough) {
  return cup ? bigEnough : true;
}
