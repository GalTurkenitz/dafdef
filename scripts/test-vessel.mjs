/**
 * test-vessel.mjs — "האם בתמונה יש כלי שתייה" (logic/vessel.js).
 *
 * הבדיקה קיימת בגלל דיווח אמיתי: "לקחתי בקבוק של בושם, הוא חשב
 * שזו כוס, וברגע שהעליתי את זה לפנים זה שתה לי."
 *
 * הסיבה הייתה ש-EfficientDet מכיר רק 80 מחלקות COCO, ו-"bottle"
 * שם הוא כל בקבוק בעולם. עכשיו רץ מסווג ImageNet שמכיר
 * `water bottle` ו-`perfume` **בנפרד**, והלוגיקה שמכריעה ביניהם
 * נבדקת כאן בלי מצלמה.
 */

import { readFileSync } from 'node:fs';
import { judgeVessel, vesselMessage, topLabels, MIN_SCORE,
         VESSEL, NOT_VESSEL } from '../js/logic/vessel.js';

let fail = 0;
const is = (name, got, want) => {
  const okk = Object.is(got, want);
  if (!okk) fail++;
  console.log(`${okk ? 'ok  ' : 'FAIL'} ${name} → ${got}${okk ? '' : `  (want ${want})`}`);
};

/** קיצור: רשימת קטגוריות כמו שהמסווג מחזיר */
const cats = (...pairs) =>
  pairs.map(([categoryName, score]) => ({ categoryName, score }));

/* ------------------------------------------------------------------ *
 * כלי שתייה
 * ------------------------------------------------------------------ */

console.log('— כלי שתייה —');
{
  const r = judgeVessel(cats(['water bottle', 0.82], ['pop bottle', 0.09]));
  is('בקבוק מים', r.ok, true);
  is('  והסיבה', r.reason, 'vessel');
  is('  ומה זוהה', r.match, 'water bottle');
}
is('כוס', judgeVessel(cats(['cup', 0.71])).ok, true);
is('ספל קפה', judgeVessel(cats(['coffee mug', 0.64])).ok, true);
is('כוס בירה', judgeVessel(cats(['beer glass', 0.55])).ok, true);
is('קנקן', judgeVessel(cats(['pitcher', 0.48])).ok, true);
is('כוס מדידה', judgeVessel(cats(['measuring cup', 0.40])).ok, true);

/* ImageNet נותן לפעמים שם מלא עם חלופות מופרדות בפסיק */
is('שם עם חלופות', judgeVessel(cats(['water jug, jug', 0.61])).ok, true);
is('קו תחתון במקום רווח', judgeVessel(cats(['coffee_mug', 0.61])).ok, true);
is('אותיות גדולות', judgeVessel(cats(['Water Bottle', 0.61])).ok, true);

/* ------------------------------------------------------------------ *
 * בקבוק הבושם — המקרה שדווח
 * ------------------------------------------------------------------ */

console.log('\n— בקבוק בושם —');
{
  const r = judgeVessel(cats(['perfume', 0.74], ['water bottle', 0.11]));
  is('בושם נפסל', r.ok, false);
  is('  והסיבה ברורה', r.reason, 'not-vessel');
  is('  ומה זוהה', r.match, 'perfume');
  is('  וההודעה מסבירה',
     vesselMessage(r).includes('לא נראה כמו כלי שתייה'), true);
}

{
  /* המסווג מתלבט, אבל הבושם מוביל */
  const r = judgeVessel(cats(['perfume', 0.44], ['water bottle', 0.38]));
  is('בושם מוביל על בקבוק', r.ok, false);
}

{
  /* תיקו — מה שברור שאינו כלי שתייה גובר */
  const r = judgeVessel(cats(['water bottle', 0.40], ['perfume', 0.40]));
  is('בתיקו הפסילה גוברת', r.ok, false);
}

{
  /* הבקבוק מוביל בבירור — עובר */
  const r = judgeVessel(cats(['water bottle', 0.72], ['perfume', 0.10]));
  is('בקבוק מוביל בבירור', r.ok, true);
}

is('בקבוק תרופות נפסל', judgeVessel(cats(['pill bottle', 0.66])).ok, false);
is('ספריי נפסל', judgeVessel(cats(['hair spray', 0.58])).ok, false);
is('טלפון נפסל', judgeVessel(cats(['cellular telephone', 0.80])).ok, false);
/* vase עבר בכוונה לרשימת כלי השתייה: כוס זכוכית רגילה נוחתת
   עליו, ואגרטל שיעבור הוא מחיר סביר מול כוס שנדחית. */
is('אגרטל עובר — במכוון', judgeVessel(cats(['vase', 0.52])).ok, true);

/* ------------------------------------------------------------------ *
 * לא ברור
 * ------------------------------------------------------------------ */

console.log('\n— לא ברור —');
{
  const r = judgeVessel([]);
  is('בלי תוצאות', r.ok, false);
  is('  הסיבה', r.reason, 'unclear');
  is('  וההודעה מבקשת לקרב', vesselMessage(r).includes('קרב'), true);
}

{
  const r = judgeVessel(cats(['desk', 0.61], ['notebook', 0.22]));
  is('חפץ שאינו ברשימות', r.ok, false);
  is('  הסיבה', r.reason, 'unclear');
}

{
  /* כל הציונים מתחת לסף — כאילו לא זוהה כלום */
  const r = judgeVessel(cats(['cup', MIN_SCORE - 0.01], ['perfume', MIN_SCORE - 0.02]));
  is('ציונים נמוכים מדי', r.reason, 'unclear');
  is('  ולא עוברים', r.ok, false);
}

{
  const r = judgeVessel(cats(['cup', MIN_SCORE + 0.01]));
  is('בדיוק מעל הסף — עובר', r.ok, true);
}

is('קלט שבור לא מפיל', judgeVessel(null).ok, false);
is('ערכים ריקים לא מפילים', judgeVessel([null, undefined]).ok, false);

/* ------------------------------------------------------------------ *
 * שלמות הרשימות
 * ------------------------------------------------------------------ */

console.log('\n— הרשימות —');
{
  const both = VESSEL.filter((v) => NOT_VESSEL.includes(v));
  is('אין מחלקה בשתי הרשימות', both.length, 0);
  is('כל השמות באותיות קטנות',
     [...VESSEL, ...NOT_VESSEL].every((v) => v === v.toLowerCase()), true);
  is('perfume ברשימת הפסילה', NOT_VESSEL.includes('perfume'), true);
  is('water bottle ברשימת הקבלה', VESSEL.includes('water bottle'), true);
}

/* ------------------------------------------------------------------ *
 * הרשימות מול אוצר המילים של המודל
 *
 * זו הבדיקה שהייתה חסרה. שם שלא קיים במודל לא יחזור לעולם,
 * ולכן הוא שורה מתה שנראית כמו כיסוי. כך נפסלו כוסות אמיתיות:
 * ImageNet לא מכיר "כוס שתייה", וכוס זכוכית נוחתת על beaker,
 * goblet או vase — שניים מהם חסרו, והשלישי ישב ברשימת הפסילה.
 * ------------------------------------------------------------------ */

console.log('');
console.log('— מול אוצר המילים של המודל —');
{
  const bin = readFileSync(new URL(
    '../vendor/mediapipe/models/efficientnet_lite2.tflite', import.meta.url));
  const RE = new RegExp("[a-zA-Z][a-zA-Z_ '-]{2,40}", 'g');
  const labels = new Set((bin.toString('latin1').match(RE) || [])
    .map((x) => x.toLowerCase()));

  is('אוצר המילים נקרא מהמודל', labels.size > 900, true);
  console.log('     (' + labels.size + ' מחרוזות במודל)');

  const missingV = VESSEL.filter((v) => !labels.has(v));
  const missingN = NOT_VESSEL.filter((v) => !labels.has(v));
  is('כל כלי השתייה קיימים במודל', missingV.length, 0);
  if (missingV.length) console.log('     חסרים:', missingV.join(', '));
  is('כל הפסילות קיימות במודל', missingN.length, 0);
  if (missingN.length) console.log('     חסרים:', missingN.join(', '));

  /* המחלקות שכוס זכוכית רגילה נוחתת עליהן — חייבות לעבור */
  for (const glass of ['beaker', 'goblet', 'vase', 'cup']) {
    is(`כוס שזוהתה כ-${glass} עוברת`,
       judgeVessel([{ categoryName: glass, score: 0.3 }]).ok, true);
  }
}

/* ------------------------------------------------------------------ *
 * החלטה לפי דירוג ולא לפי סף
 *
 * מודל int8 שמתפלג על 1000 מחלקות נותן לעיתים ציון נמוך למחלקה
 * הנכונה. סף קבוע פסל כוסות אמיתיות — מה שקובע הוא מי מדורג
 * גבוה יותר.
 * ------------------------------------------------------------------ */

console.log('');
console.log('— דירוג ולא סף —');
{
  const r = judgeVessel(cats(['desk', 0.21], ['beaker', 0.08], ['lamp', 0.05]));
  is('כוס בציון נמוך אך ללא מתחרה', r.ok, true);
  is('  ומה זוהה', r.match, 'beaker');
}
{
  const r = judgeVessel(cats(['perfume', 0.19], ['beaker', 0.08]));
  is('בושם מדורג מעל כוס — נפסל', r.ok, false);
}
{
  const r = judgeVessel(cats(['beaker', 0.19], ['perfume', 0.08]));
  is('כוס מדורגת מעל בושם — עוברת', r.ok, true);
}
{
  const r = judgeVessel(cats(['cup', 0.015]));
  is('מתחת לרצפת הרעש — לא נספר', r.ok, false);
}

console.log('');
console.log('— תוויות לתצוגה —');
{
  const t = topLabels(cats(['Coffee Mug', 0.42], ['desk', 0.11], ['cup', 0.07], ['x', 0.01]));
  is('שלוש הראשונות', t.length, 3);
  is('  מנורמלות ובאחוזים', t[0], 'coffee mug 42%');
  is('בלי קלט — ריק', topLabels(null).length, 0);
}

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
