/**
 * test-sip.mjs — זיהוי "שתיתי" (logic/sip.js).
 *
 * הבדיקה קיימת בגלל שני דיווחים אמיתיים של המשתמש:
 *
 *   1. "מזהה שיש כוס אבל לא מבין מתי הכוס עולה לפה" — הסף היה
 *      מרחק קבוע בפריים על שורש כף היד, ולכן נשבר לפי המרחק
 *      מהמצלמה.
 *   2. "לקחתי בקבוק בושם, הוא חשב שזו כוס, והרמתי לפנים — שתה לי."
 *
 * שלושה שערים נבדקים כאן, וכולם יחסיים לגוף:
 *   הכוס ליד הפה · גודל המיכל ביחס לראש · הטיית ראש מכוילת.
 */

import { sipState, cupBox, bodyScale, headTilt, mid,
         CUP_NEAR, HAND_NEAR, MIN_CUP_SIZE, TILT_DELTA,
         CUP_MEMORY_MS } from '../js/logic/sip.js';

let fail = 0;
const is = (name, got, want) => {
  const okk = Object.is(got, want);
  if (!okk) fail++;
  console.log(`${okk ? 'ok  ' : 'FAIL'} ${name} → ${got}${okk ? '' : `  (want ${want})`}`);
};

/* ------------------------------------------------------------------ *
 * בונה תנוחה
 *
 * scale = המרחק אף–כתפיים, בערך גובה ראש. קרוב למצלמה = scale גדול.
 * tilt  = כמה הראש מוטה אחורה, ביחידות של אותו scale.
 * cupLong = הצלע הארוכה של המיכל, באותן יחידות.
 * ------------------------------------------------------------------ */

function pose({ scale = 0.2, tilt = 0, handDrop = 0.6,
                cupDrop = null, cupLong = 0.8 } = {}) {
  const nose = { x: 0.5, y: 0.40 };
  const shoulders = { x: 0.5, y: 0.40 + scale };
  const mouthMid = { x: 0.5, y: 0.40 + scale * 0.25 };

  /* ההטיה מוגדרת כ-(earY - noseY)/scale, אז מציבים את האוזניים */
  const earMid = { x: 0.5, y: nose.y + tilt * scale };

  const wrist = { x: 0.5, y: mouthMid.y + scale * handDrop };

  const cup = cupDrop === null ? null : {
    x: 0.5,
    y: mouthMid.y + scale * cupDrop,
    w: cupLong * scale * 0.5,
    h: cupLong * scale,
    long: cupLong * scale,
  };

  return { nose, shoulders, mouth: mouthMid, earMid, wrists: [wrist], cup };
}

/** תנוחת שתייה תקינה: כוס גדולה ליד הפה, ראש מוטה */
const drinkingPose = (over = {}) =>
  pose({ scale: 0.2, tilt: TILT_DELTA + 0.04, handDrop: 0.6,
         cupDrop: 0.2, cupLong: 0.8, ...over });

const ARGS = { now: 1000, lastCupAt: 1000, tiltRef: 0 };

/* ------------------------------------------------------------------ *
 * עזרים
 * ------------------------------------------------------------------ */

console.log('— תיבת הכוס —');
{
  const c = cupBox({ originX: 160, originY: 120, width: 64, height: 96 }, 640, 480);
  is('x במרכז, מנורמל', c.x, (160 + 32) / 640);
  is('y במרכז, מנורמל', c.y, (120 + 48) / 480);
  is('הצלע הארוכה', c.long, 96 / 480);
  is('בלי תיבה — null', cupBox(null, 640, 480), null);
  is('בלי מידות — null', cupBox({ originX: 0, originY: 0, width: 1, height: 1 }, 0, 0), null);
}

console.log('\n— קנה מידה והטיה —');
{
  is('אף–כתפיים', Number(bodyScale({ x: .5, y: .4 }, { x: .5, y: .6 }).toFixed(3)), 0.2);
  is('בלי נקודות — אפס', bodyScale(null, { x: 0, y: 0 }), 0);
  is('הטיה יחסית ל-scale',
     Number(headTilt({ x: .5, y: .4 }, { x: .5, y: .44 }, 0.2).toFixed(2)), 0.2);
  is('בלי אוזניים — null', headTilt({ x: .5, y: .4 }, null, 0.2), null);
  is('mid של שתי נקודות', mid({ x: 0, y: 0 }, { x: 1, y: 1 }).x, 0.5);
  is('mid עם אחת חסרה', mid(null, { x: 1, y: 1 }).x, 1);
}

/* ------------------------------------------------------------------ *
 * שתייה אמיתית
 * ------------------------------------------------------------------ */

console.log('\n— שתייה אמיתית —');
{
  const s = sipState({ ...drinkingPose(), ...ARGS });
  is('הכוס ליד הפה', s.cupAtMouth, true);
  is('  גדולה מספיק', s.bigEnough, true);
  is('  הראש מוטה', s.tilted, true);
  is('  ולכן שותים', s.drinking, true);
}

{
  /* אותה תנוחה בדיוק, במרחקים שונים מהמצלמה */
  const far  = sipState({ ...drinkingPose({ scale: 0.08 }), ...ARGS });
  const near = sipState({ ...drinkingPose({ scale: 0.34 }), ...ARGS });
  is('רחוק מהמצלמה', far.drinking, true);
  is('קרוב למצלמה', near.drinking, true);
  is('  שני המקרים זהים — זה מה שהסף הישן שבר',
     far.drinking === near.drinking, true);
}

{
  /* הכוס נעלמה למזהה באמצע הלגימה, והיד עדיין ליד הפה */
  const p = drinkingPose({ cupDrop: null });
  const s = sipState({ ...p, now: 1400, lastCupAt: 1000, tiltRef: 0 });
  is('כוס שנעלמה לרגע — ממשיכים', s.drinking, true);
}

/* ------------------------------------------------------------------ *
 * בקבוק הבושם
 * ------------------------------------------------------------------ */

console.log('\n— בקבוק בושם —');
{
  /* בושם ≈ 8 ס"מ מול ראש ≈ 22 — יחס 0.36, מתחת לסף */
  const s = sipState({ ...drinkingPose({ cupLong: 0.36 }), ...ARGS });
  is('קטן מדי', s.bigEnough, false);
  is('  ולכן לא ליד הפה', s.cupAtMouth, false);
  is('  ולא שותים', s.drinking, false);
}

{
  /* מיכל בגודל תקין, אבל הראש לא זז — מרים חפץ לפנים */
  const s = sipState({ ...drinkingPose({ tilt: 0 }), ...ARGS });
  is('כוס גדולה בלי הטיית ראש', s.cupAtMouth, true);
  is('  ההטיה נכשלת', s.tilted, false);
  is('  ולכן לא שותים', s.drinking, false);
}

{
  /* שניהם ביחד — בושם בלי הטיה */
  const s = sipState({ ...drinkingPose({ cupLong: 0.36, tilt: 0 }), ...ARGS });
  is('בושם מורם לפנים — לא שותים', s.drinking, false);
}

/* ------------------------------------------------------------------ *
 * מה שעוד לא אמור להיספר
 * ------------------------------------------------------------------ */

console.log('\n— לא נספר —');
{
  const s = sipState({ ...drinkingPose({ cupDrop: null, handDrop: 0.5 }),
                       now: 5000, lastCupAt: 0, tiltRef: 0 });
  is('יד ריקה ליד הפה', s.handNearFace, true);
  is('  ובכל זאת לא שותים', s.drinking, false);
}

{
  /* בתחילת הריצה now קטן ו-lastCupAt=0. בלי הגנה מפורשת ההפרש
     קטן מהזיכרון, ויד ריקה הייתה עוברת. */
  const s = sipState({ ...drinkingPose({ cupDrop: null, handDrop: 0.5 }),
                       now: 300, lastCupAt: 0, tiltRef: 0 });
  is('בתחילת הריצה, יד ריקה', s.cupRecent, false);
  is('  ולכן לא שותים', s.drinking, false);
}

{
  const s = sipState({ ...drinkingPose({ cupDrop: null, handDrop: 0.5 }),
                       now: 5000, lastCupAt: 5000 - CUP_MEMORY_MS - 1, tiltRef: 0 });
  is('זיהוי ישן מדי', s.cupRecent, false);
  is('  ולכן לא נספר', s.drinking, false);
}

{
  /* הכוס על השולחן, הידיים למטה */
  const s = sipState({ ...drinkingPose({ cupDrop: 3.0, handDrop: 3.0 }), ...ARGS });
  is('כוס על השולחן', s.cupAtMouth, false);
  is('  ידיים למטה', s.handNearFace, false);
  is('  לא שותים', s.drinking, false);
}

{
  is('בלי נקודות גוף', sipState({ nose: null, shoulders: null }).drinking, false);
  is('בלי כתפיים', sipState({ nose: { x: .5, y: .4 }, shoulders: null }).drinking, false);
}

/* ------------------------------------------------------------------ *
 * גבולות
 * ------------------------------------------------------------------ */

console.log('\n— גבולות —');
{
  const inn = sipState({ ...drinkingPose({ cupLong: MIN_CUP_SIZE + 0.02 }), ...ARGS });
  const out = sipState({ ...drinkingPose({ cupLong: MIN_CUP_SIZE - 0.02 }), ...ARGS });
  is('גודל בדיוק בפנים', inn.bigEnough, true);
  is('גודל בדיוק בחוץ', out.bigEnough, false);
}

{
  const inn = sipState({ ...drinkingPose({ tilt: TILT_DELTA + 0.01 }), ...ARGS });
  const out = sipState({ ...drinkingPose({ tilt: TILT_DELTA - 0.01 }), ...ARGS });
  is('הטיה בדיוק בפנים', inn.tilted, true);
  is('הטיה בדיוק בחוץ', out.tilted, false);
}

{
  const inn = sipState({ ...drinkingPose({ cupDrop: CUP_NEAR - 0.05 }), ...ARGS });
  const out = sipState({ ...drinkingPose({ cupDrop: CUP_NEAR + 0.05 }), ...ARGS });
  is('מרחק בדיוק בפנים', inn.cupAtMouth, true);
  is('מרחק בדיוק בחוץ', out.cupAtMouth, false);
}

{
  /* בלי כיול בסיס לא חוסמים על הטיה — עדיף לא לחסום מאשר
     לחסום על מדידה שלא נעשתה */
  const s = sipState({ ...drinkingPose({ tilt: 0 }),
                       now: 1000, lastCupAt: 1000, tiltRef: null });
  is('בלי כיול — ההטיה לא חוסמת', s.drinking, true);
}

/* ------------------------------------------------------------------ *
 * לגימות שלמות
 * ------------------------------------------------------------------ */

function runSip(frame, { frames = 100, step = 40 } = {}) {
  const SIP_MS = 2500;
  let sipMs = 0;
  let lastCupAt = 0;
  for (let i = 0; i < frames; i++) {
    const now = i * step;
    const p = frame(i, now);
    if (p.cup) lastCupAt = now;
    const s = sipState({ ...p, now, lastCupAt, tiltRef: 0 });
    sipMs = s.drinking ? sipMs + step : Math.max(0, sipMs - 25);
  }
  return { sipMs, done: sipMs >= SIP_MS };
}

console.log('\n— לגימות של 2.5 שניות —');
{
  /* שתייה תקינה שבה הכוס נעלמת למזהה באמצע */
  const r = runSip((i) => drinkingPose({ cupDrop: (i >= 20 && i <= 55) ? null : 0.2 }));
  is('שתייה תקינה הושלמה', r.done, true);
}
{
  const r = runSip(() => drinkingPose({ cupDrop: null }));
  is('בלי כוס בכלל — אפס', r.sipMs, 0);
}
{
  const r = runSip(() => drinkingPose({ cupLong: 0.36 }));
  is('בקבוק בושם — אפס', r.sipMs, 0);
}
{
  const r = runSip(() => drinkingPose({ tilt: 0 }));
  is('בלי הטיית ראש — אפס', r.sipMs, 0);
}

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
