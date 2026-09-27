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
 *  ומה זה עדיין לא: זו לא הוכחה ששתית. כוס ריקה עוברת, וכוס עם
 *  משהו אחר עוברת. הצילום הוא **פעולה מכוונת**, לא אימות — ולכן
 *  אחריו באה הצהרה מפורשת, והמשימה שווה הכי מעט דקות.
 */

/** ציון מינימלי כדי להתייחס לזיהוי ברצינות */
export const MIN_SCORE = 0.12;

/** כלי שתייה — ImageNet */
export const VESSEL = [
  'cup', 'coffee mug', 'beer glass', 'goblet', 'water bottle',
  'pop bottle', 'soda bottle', 'beer bottle', 'wine bottle',
  'water jug', 'pitcher', 'ewer', 'measuring cup', 'cocktail shaker',
  'teapot', 'coffeepot', 'espresso', 'espresso maker', 'red wine',
  'eggnog', 'cup of coffee', 'mug',
];

/**
 * מה שנראה כמו כלי שתייה אבל אינו.
 * `perfume` ו-`pill bottle` הם בדיוק המקרה שדווח.
 */
export const NOT_VESSEL = [
  'perfume', 'pill bottle', 'lotion', 'sunscreen', 'hair spray',
  'soap dispenser', 'spray can', 'lighter', 'syringe', 'candle',
  'cellular telephone', 'remote control', 'flashlight', 'saltshaker',
  'vase', 'pot', 'oil filter', 'lipstick', 'nail polish',
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

  const vessel = rows.find((r) => inList(r.name, VESSEL)) || null;
  const bad = rows.find((r) => inList(r.name, NOT_VESSEL)) || null;

  /* מה שברור שאינו כלי שתייה גובר, גם אם משהו אחר דומה קצת.
     זה מה שפוסל את בקבוק הבושם. */
  if (bad && (!vessel || bad.score >= vessel.score)) {
    return { ok: false, reason: 'not-vessel', match: bad.name, score: bad.score };
  }

  if (vessel) {
    return { ok: true, reason: 'vessel', match: vessel.name, score: vessel.score };
  }

  return { ok: false, reason: 'unclear', match: rows[0].name, score: rows[0].score };
}

/** הודעה למשתמש לפי הסיבה */
export function vesselMessage(result) {
  switch (result?.reason) {
    case 'vessel':     return 'רואים כוס';
    case 'not-vessel': return 'זה לא נראה כמו כלי שתייה. צלם כוס או בקבוק';
    default:           return 'לא זיהיתי כוס. קרב את הכוס למצלמה ונסה שוב';
  }
}
