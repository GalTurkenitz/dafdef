/**
 * test-sip.mjs — זיהוי "הכוס עלתה לפה" (logic/sip.js).
 *
 * הבדיקה הזו קיימת כי המשתמש דיווח שהשלב השני של משימת המים לא
 * עובד: המצלמה מזהה שיש כוס, אבל לא מזהה מתי שותים. הסיבה הייתה
 * סף קבוע במרחק־פריים על שורש כף היד, ושתי הנחות שבורות בתוכו.
 *
 * כאן מוכיחים שלוש טענות בלי מצלמה:
 *   1. שתייה אמיתית נספרת — גם כשהיד נמוכה מהפה.
 *   2. אותה תנוחה בדיוק עובדת קרוב לפריים ורחוק ממנו.
 *   3. יד ריקה, וכוס שיושבת על השולחן, לא נספרות.
 */

import { sipState, cupCenter, bodyScale,
         CUP_NEAR, HAND_NEAR, CUP_MEMORY_MS } from '../js/logic/sip.js';

let fail = 0;
const is = (name, got, want) => {
  const okk = Object.is(got, want);
  if (!okk) fail++;
  console.log(`${okk ? 'ok  ' : 'FAIL'} ${name} → ${got}${okk ? '' : `  (want ${want})`}`);
};

/* ------------------------------------------------------------------ *
 * בונה תנוחה בקנה מידה נתון
 *
 * scale = המרחק אף–כתפיים, כלומר בערך גובה ראש. אדם קרוב למצלמה
 * מקבל scale גדול, רחוק מקבל קטן — וזה כל העניין.
 * ------------------------------------------------------------------ */

function pose({ scale = 0.2, handDrop = 0.6, cupDrop = null } = {}) {
  const nose = { x: 0.5, y: 0.40 };
  const shoulders = { x: 0.5, y: 0.40 + scale };

  /* היד יושבת מתחת לאף, ביחס לגובה הראש — ככה זה נראה בשתייה */
  const wrist = { x: 0.5, y: nose.y + scale * handDrop };

  const cup = cupDrop === null ? null
    : { x: 0.5, y: nose.y + scale * cupDrop };

  return { nose, shoulders, wrists: [wrist], cup };
}

/* ------------------------------------------------------------------ *
 * מרכז התיבה
 * ------------------------------------------------------------------ */

console.log('— מרכז תיבת הכוס —');
{
  const c = cupCenter({ originX: 160, originY: 120, width: 64, height: 96 }, 640, 480);
  is('x במרכז התיבה, מנורמל', c.x, (160 + 32) / 640);
  is('y במרכז התיבה, מנורמל', c.y, (120 + 48) / 480);
  is('בלי תיבה מחזיר null', cupCenter(null, 640, 480), null);
  is('בלי מידות מחזיר null', cupCenter({ originX: 0, originY: 0, width: 1, height: 1 }, 0, 0), null);
}

console.log('\n— קנה מידה של הגוף —');
{
  is('אף–כתפיים', Number(bodyScale({ x: .5, y: .4 }, { x: .5, y: .6 }).toFixed(3)), 0.2);
  is('בלי נקודות — אפס', bodyScale(null, { x: 0, y: 0 }), 0);
}

/* ------------------------------------------------------------------ *
 * שתייה אמיתית
 * ------------------------------------------------------------------ */

console.log('\n— שתייה אמיתית —');
{
  /* הכוס בגובה הסנטר, היד מתחתיה — התנוחה שהסף הישן פספס */
  const p = pose({ scale: 0.2, handDrop: 0.9, cupDrop: 0.5 });
  const s = sipState({ ...p, now: 1000, lastCupAt: 1000 });
  is('הכוס ליד הפה', s.cupAtMouth, true);
  is('  ולכן שותים', s.drinking, true);
}

{
  /* אותה תנוחה בדיוק, רק שהמשתמש רחוק מהמצלמה */
  const near = sipState({ ...pose({ scale: 0.30, handDrop: 0.9, cupDrop: 0.5 }),
                          now: 1000, lastCupAt: 1000 });
  const far  = sipState({ ...pose({ scale: 0.08, handDrop: 0.9, cupDrop: 0.5 }),
                          now: 1000, lastCupAt: 1000 });
  is('קרוב למצלמה — נספר', near.drinking, true);
  is('רחוק מהמצלמה — נספר גם', far.drinking, true);
  is('  וזה מה שהסף הישן שבר', near.drinking === far.drinking, true);
}

{
  /* הכוס נעלמה למזהה באמצע הלגימה, אבל היד עדיין ליד הפה */
  const p = pose({ scale: 0.2, handDrop: 0.7, cupDrop: null });
  const s = sipState({ ...p, now: 1400, lastCupAt: 1000 });
  is('כוס שנעלמה לרגע — ממשיכים', s.drinking, true);
  is('  כי הזיהוי טרי', s.cupRecent, true);
}

/* ------------------------------------------------------------------ *
 * מה שלא אמור להיספר
 * ------------------------------------------------------------------ */

console.log('\n— לא נספר —');
{
  /* יד ליד הפה, אבל כוס לא נראתה מעולם */
  const p = pose({ scale: 0.2, handDrop: 0.5, cupDrop: null });
  const s = sipState({ ...p, now: 5000, lastCupAt: 0 });
  is('יד ריקה ליד הפה', s.handNearFace, true);
  is('  ובכל זאת לא שותים', s.drinking, false);
}

{
  /* בתחילת הריצה now קטן ו-lastCupAt=0. בלי הגנה מפורשת ההפרש
     קטן מהזיכרון, ויד ריקה הייתה עוברת. */
  const p = pose({ scale: 0.2, handDrop: 0.5, cupDrop: null });
  const s = sipState({ ...p, now: 300, lastCupAt: 0 });
  is('בתחילת הריצה, יד ריקה', s.cupRecent, false);
  is('  ולכן לא שותים', s.drinking, false);
}

{
  /* הכוס זוהתה לפני הרבה זמן והיד למעלה — לא מספיק */
  const p = pose({ scale: 0.2, handDrop: 0.5, cupDrop: null });
  const s = sipState({ ...p, now: 5000, lastCupAt: 5000 - CUP_MEMORY_MS - 1 });
  is('זיהוי ישן מדי', s.cupRecent, false);
  is('  ולכן לא נספר', s.drinking, false);
}

{
  /* הכוס על השולחן, הרחק מתחת לפנים, והידיים למטה */
  const p = pose({ scale: 0.2, handDrop: 3.0, cupDrop: 3.0 });
  const s = sipState({ ...p, now: 1000, lastCupAt: 1000 });
  is('כוס על השולחן', s.cupAtMouth, false);
  is('  ידיים למטה', s.handNearFace, false);
  is('  לא שותים', s.drinking, false);
}

{
  is('בלי נקודות גוף — לא שותים',
     sipState({ nose: null, shoulders: null, now: 1, lastCupAt: 1 }).drinking, false);
  is('בלי כתפיים — לא שותים',
     sipState({ nose: { x: .5, y: .4 }, shoulders: null, now: 1, lastCupAt: 1 }).drinking, false);
}

/* ------------------------------------------------------------------ *
 * גבולות הספים
 * ------------------------------------------------------------------ */

console.log('\n— גבולות —');
{
  const justIn  = sipState({ ...pose({ scale: 0.2, handDrop: 5, cupDrop: CUP_NEAR - 0.05 }),
                             now: 1000, lastCupAt: 1000 });
  const justOut = sipState({ ...pose({ scale: 0.2, handDrop: 5, cupDrop: CUP_NEAR + 0.05 }),
                             now: 1000, lastCupAt: 1000 });
  is('בדיוק בפנים', justIn.cupAtMouth, true);
  is('בדיוק בחוץ', justOut.cupAtMouth, false);
}

{
  const inH  = sipState({ ...pose({ scale: 0.2, handDrop: HAND_NEAR - 0.05 }),
                          now: 1000, lastCupAt: 1000 });
  const outH = sipState({ ...pose({ scale: 0.2, handDrop: HAND_NEAR + 0.05 }),
                          now: 1000, lastCupAt: 1000 });
  is('יד בפנים', inH.handNearFace, true);
  is('יד בחוץ', outH.handNearFace, false);
}

/* ------------------------------------------------------------------ *
 * לגימה שלמה לאורך זמן
 * ------------------------------------------------------------------ */

console.log('\n— לגימה של 2.5 שניות —');
{
  const SIP_MS = 2500;
  let sipMs = 0;
  let lastCupAt = 0;

  /* 100 פריימים ב-40ms: הכוס עולה, נעלמת למזהה באמצע, וחוזרת */
  for (let i = 0; i < 100; i++) {
    const now = i * 40;
    const visible = i < 20 || i > 55;          // נעלמת בין 800ms ל-2240ms
    const p = pose({ scale: 0.2, handDrop: 0.8, cupDrop: visible ? 0.5 : null });
    if (visible) lastCupAt = now;
    const s = sipState({ ...p, now, lastCupAt });
    sipMs = s.drinking ? sipMs + 40 : Math.max(0, sipMs - 25);
  }

  is('הלגימה הושלמה', sipMs >= SIP_MS, true);
}

{
  /* אותו אורך, אבל בלי כוס בכלל */
  let sipMs = 0;
  for (let i = 0; i < 100; i++) {
    const now = i * 40;
    const p = pose({ scale: 0.2, handDrop: 0.8, cupDrop: null });
    const s = sipState({ ...p, now, lastCupAt: 0 });
    sipMs = s.drinking ? sipMs + 40 : Math.max(0, sipMs - 25);
  }
  is('בלי כוס — לא מצטבר כלום', sipMs, 0);
}

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
