/**
 * sip.js — הגיאומטריה של "הכוס עלתה לפה", טהורה ובלי DOM.
 *
 * היא יושבת כאן ולא בתוך modules/water.js בדיוק מאותה סיבה
 * ש-reps.js יושב כאן: אפשר לאמת אותה בלי מצלמה ובלי דפדפן,
 * ולכן אפשר להוכיח שהיא עובדת במקום לקוות.
 *
 * **הבאג שהיא מתקנת:** הסף הקודם היה מרחק קבוע של 0.22 מרוחב
 * הפריים בין שורש כף היד לאף. שתי הנחות שבורות ישבו בו —
 *
 *   1. כשאתה שותה **היד נמוכה מהפה**. הכוס מגיעה לשפתיים,
 *      שורש כף היד נשאר בגובה הסנטר או מתחתיו.
 *   2. מרחק בפריים תלוי כמה אתה רחוק מהמצלמה. קרוב לפריים —
 *      0.22 זה מעט; רחוק — זה הרבה. אותו סף התנהג הפוך בין
 *      שני משתמשים.
 *
 * כאן הכל נמדד **ביחס למרחק אף–כתפיים**, שהוא בערך גובה ראש
 * ומשתנה יחד עם המרחק מהמצלמה — ולכן הסף זהה לכולם. והאות
 * העיקרי הוא **מרכז תיבת הכוס** ולא היד, כי הוא מודד בדיוק את
 * מה שצריך.
 */

/** מרכז הכוס ליד האף, ביחידות של גובה ראש */
export const CUP_NEAR = 1.25;

/** גיבוי: היד ליד הפה, באותן יחידות */
export const HAND_NEAR = 1.05;

/**
 * מזהה האובייקטים רץ פעם ב-300ms, והכוס נעלמת לו כשהיא צמודה
 * לפנים ומוסתרת ביד. זיכרון קצר מונע איפוס של הלגימה באמצע.
 */
export const CUP_MEMORY_MS = 1500;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * מרכז תיבת הכוס בקואורדינטות מנורמלות (0..1), כמו נקודות הפוז.
 * MediaPipe מחזיר את התיבה בפיקסלים של הפריים.
 *
 * @param {{originX:number, originY:number, width:number, height:number}|null} box
 * @param {number} frameW
 * @param {number} frameH
 */
export function cupCenter(box, frameW = 640, frameH = 480) {
  if (!box || !frameW || !frameH) return null;
  return {
    x: (box.originX + box.width / 2) / frameW,
    y: (box.originY + box.height / 2) / frameH,
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
 * האם עכשיו שותים.
 *
 * @param {object} o
 * @param {{x:number,y:number}} o.nose
 * @param {{x:number,y:number}} o.shoulders  אמצע הכתפיים
 * @param {Array<{x:number,y:number}>} o.wrists
 * @param {{x:number,y:number}|null} o.cup   מרכז הכוס, מנורמל
 * @param {number} o.now
 * @param {number} o.lastCupAt  מתי כוס זוהתה לאחרונה
 * @returns {{drinking:boolean, cupAtMouth:boolean, handNearFace:boolean,
 *            cupRecent:boolean, scale:number}}
 */
export function sipState({ nose, shoulders, wrists = [], cup = null,
                           now = 0, lastCupAt = 0 } = {}) {
  const off = { drinking: false, cupAtMouth: false, handNearFace: false,
                cupRecent: false, scale: 0 };
  if (!nose || !shoulders) return off;

  const scale = bodyScale(nose, shoulders);
  if (!scale) return off;

  const nearest = wrists
    .filter(Boolean)
    .reduce((best, w) => {
      const d = dist(w, nose);
      return !best || d < best ? d : best;
    }, null);

  const handNearFace = nearest !== null && nearest < scale * HAND_NEAR;
  const cupAtMouth = cup ? dist(cup, nose) < scale * CUP_NEAR : false;
  /* lastCupAt=0 פירושו "כוס לא זוהתה מעולם". בלי הבדיקה הזו, בשנייה
     וחצי הראשונות של הריצה now-0 קטן מהזיכרון, ויד ריקה הייתה
     עוברת. נמצא בהשוואה מול הסף הישן, לא בבדיקה עצמה. */
  const cupRecent = lastCupAt > 0 && now - lastCupAt < CUP_MEMORY_MS;

  /* הכוס מול הפנים מספיקה לבדה. היד לבדה לא — היא נחשבת רק
     כשכוס זוהתה ממש לפני כן, אחרת יד ריקה הייתה עוברת. */
  return {
    drinking: cupAtMouth || (handNearFace && cupRecent),
    cupAtMouth,
    handNearFace,
    cupRecent,
    scale,
  };
}
