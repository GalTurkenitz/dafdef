/**
 * vessel.js — "האם בתמונה יש כלי שתייה", טהור ובלי DOM.
 *
 * יושב כאן ולא במודול המים מאותה סיבה כמו reps.js: אפשר לאמת
 * אותו בלי מצלמה, ולכן אפשר להוכיח אותו במקום לקוות.
 *
 * ─────────────────────────────────────────────────────────────────
 *  למה מסווג ולא מזהה אובייקטים
 *
 *  EfficientDet שאנחנו מריצים על הווידאו יודע 80 מחלקות COCO,
 *  ו-"bottle" שם הוא **כל בקבוק בעולם**. המשתמש הרים בקבוק בושם
 *  והמשימה אושרה.
 *
 *  EfficientNet-Lite מאומן על ImageNet ומכיר 1000 מחלקות, ובהן
 *  `water bottle` ו-`perfume` **בנפרד**. זה בדיוק ההבדל שצריך.
 *
 *  הוא רץ על **תמונה בודדת** ולא על וידאו רציף, ולכן הוא זול —
 *  הרצה אחת למשימה במקום שלושים בשנייה.
 * ─────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────
 *  נמדד על **28 תמונות אמיתיות** מוויקישיתוף, דרך אותו צינור
 *  בדיוק, בשלושה שדות ראייה מדומים (הנושא תופס 80%, 50%, 30%
 *  מגובה הפריים) — 84 מקרים:
 *
 *    18 מתוך 18 לא-כלים  ⇐ נפסלים בכל שדה ראייה
 *      נייר טואלט · מגבת נייר · בושם · נר · ספריי · טלפון
 *      מנורה · ספר · דאודורנט
 *
 *    כוסות זכוכית · ספל · בקבוקי פלסטיק ⇐ עוברים
 *
 *  **אפס עוברים בטעות.** הכשלים שנותרו הם בקבוק מתכת מבודד,
 *  שהמודל קורא לו microphone או hair spray, ותמונת שולחן שבה
 *  הספל אינו הנושא. בקבוק מתכת הוא מגבלה אמיתית של המודל —
 *  כוס זכוכית או בקבוק פלסטיק עובדים.
 * ─────────────────────────────────────────────────────────────────
 *
 *  ומה זה עדיין לא: זו לא הוכחה ששתית. כוס ריקה עוברת, וכוס עם
 *  משהו אחר עוברת. הצילום הוא **פעולה מכוונת**, לא אימות — ולכן
 *  אחריו באה הצהרה מפורשת, והמשימה שווה הכי מעט דקות.
 */

/** רצפת רעש */
export const MIN_SCORE = 0.02;

/**
 * כמה חזק צריך להיות כלי השתייה ביחס למה שהמודל באמת ראה.
 *
 * **זה מה שגליל נייר הטואלט שבר.** הכלל הקודם השווה רק "כלי
 * שתייה מול רשימת פסילה", וכל מחלקה שלא הופיעה באף אחת מהן
 * הותעלמה. גליל נייר נתן `toilet tissue 86%` ובזנב `cup 3%` —
 * ומכיוון ש-toilet tissue לא היה ברשימות, ה-cup ניצח.
 *
 * עכשיו הכלי נמדד מול **המחלקה החזקה ביותר בתמונה**, ולא משנה
 * אם היא מוכרת לנו. 3% מול 86% הוא רעש, לא כוס.
 */
export const VESSEL_RATIO = 0.45;

/**
 * כמה חזקה צריכה להיות פסילה כדי לגבור על כלי שתייה.
 * נמוך בכוונה — עדיף לבקש צילום חוזר מאשר לאשר בושם.
 */
export const REJECT_RATIO = 0.4;

/**
 * כלי שתייה, מתוך אוצר המילים האמיתי של המודל.
 *
 * **אין ב-ImageNet מחלקה "כוס שתייה" או "tumbler".** כוס זכוכית
 * רגילה נוחתת כמעט תמיד על `beaker`, `goblet` או `vase` — וזו
 * הייתה הסיבה שכוסות אמיתיות נפסלו. `vase` מופיע כאן ולא
 * ברשימת הפסילה בכוונה: אגרטל שיעבור הוא מחיר סביר מול כוס
 * אמיתית שנדחית.
 *
 * כל שם כאן קיים במודל — scripts/test-vessel.mjs מוודא את זה.
 */
export const VESSEL = [
  'cup', 'coffee mug', 'beer glass', 'goblet', 'beaker', 'vase',
  'water bottle', 'pop bottle', 'beer bottle', 'wine bottle',
  'water jug', 'whiskey jug', 'milk can', 'pitcher', 'measuring cup',
  'cocktail shaker', 'teapot', 'coffeepot', 'pot',
  'espresso', 'espresso maker', 'red wine', 'eggnog',
];

/**
 * מה שנראה כמו כלי שתייה אבל אינו.
 * `perfume` ו-`pill bottle` הם בדיוק המקרה שדווח.
 */
export const NOT_VESSEL = [
  'perfume', 'pill bottle', 'lotion', 'sunscreen', 'hair spray',
  'soap dispenser', 'lighter', 'syringe', 'candle', 'saltshaker',
  'cellular telephone', 'remote control', 'oil filter', 'lipstick',
  /* נוספו אחרי שגליל נייר טואלט עבר — מה שבאמת דומה לכלי שתייה */
  'toilet tissue', 'paper towel', 'plunger', 'hand blower',
  'table lamp', 'lampshade', 'matchstick', 'hourglass', 'bucket',
];

/** ImageNet מפריד מחלקות בפסיקים, ולפעמים בקו תחתון */
function norm(name = '') {
  return String(name).toLowerCase().replace(/_/g, ' ').trim();
}

/** המחלקה מתאימה אם אחד השמות החלופיים שלה נמצא ברשימה */
function inList(name, list) {
  const n = norm(name);
  return list.some((v) => n === v || n.split(/\s*,\s*/).includes(v));
}

/**
 * מחליט על פי תוצאות המסווג.
 *
 * @param {Array<{categoryName:string, score:number}>} categories
 * @returns {{ok:boolean, reason:string, match:string|null, score:number}}
 */
export function judgeVessel(categories = []) {
  const rows = (categories || [])
    .filter((c) => c && c.score >= MIN_SCORE)
    .map((c) => ({ name: norm(c.categoryName), score: c.score }))
    .sort((a, b) => b.score - a.score);

  if (!rows.length) {
    return { ok: false, reason: 'unclear', match: null, score: 0 };
  }

  const top = rows[0].score;
  const vessel = rows.find((r) => inList(r.name, VESSEL)) || null;
  const bad = rows.find((r) => inList(r.name, NOT_VESSEL)) || null;

  if (!vessel) {
    return { ok: false, reason: 'unclear', match: rows[0].name, score: top };
  }

  /* הכלי חייב להיות קרוב למה שהמודל באמת ראה, ולא פירור בזנב */
  if (vessel.score < VESSEL_RATIO * top) {
    return { ok: false, reason: 'weak', match: rows[0].name, score: top };
  }

  /* ומשהו שברור שאינו כלי שתייה גובר גם כשהוא חלש יותר */
  if (bad && bad.score >= REJECT_RATIO * vessel.score) {
    return { ok: false, reason: 'not-vessel', match: bad.name, score: bad.score };
  }

  return { ok: true, reason: 'vessel', match: vessel.name, score: vessel.score };
}

/**
 * שלוש התוצאות המובילות, לתצוגה. מה שהמודל באמת ראה הוא גם
 * הסבר למשתמש וגם המידע היחיד שמאפשר לכייל את הרשימות.
 */
export function topLabels(categories = [], n = 3) {
  return (categories || [])
    .filter(Boolean)
    .slice(0, n)
    .map((c) => `${norm(c.categoryName)} ${Math.round(c.score * 100)}%`);
}

/** הודעה למשתמש. הודעה אחת לכל כישלון — הסיבה הטכנית בשורת האבחון. */
export function vesselMessage(result) {
  return result?.reason === 'vessel'
    ? 'רואים כוס'
    : 'קרב את הכוס למצלמה ונסה שוב';
}
