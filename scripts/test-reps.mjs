/**
 * test-reps.mjs — בדיקות למנוע ספירת החזרות (V3, סעיף ו7).
 *
 * "הגדרת הסיום" של הסעיף דורשת שלושה דברים: עשר שכיבות אמיתיות
 * נספרות כעשר, חצאי-חזרות אינן נספרות, ואין ספירה כשחלק מהגוף
 * מחוץ לפריים. אי אפשר לאמת את זה מול מצלמה בלי לעמוד ולעשות
 * עשר שכיבות, ולכן המנוע נכתב טהור — וכאן מזינים לו גוף מדומה.
 */

import { createCounter, update, STATE, bodyVisible,
         pushupAngle, bodyHorizontal } from '../js/logic/reps.js';

let fail = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} → ${got}${ok ? '' : `  (want ${want})`}`);
};

const POSE = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,    RIGHT_WRIST: 16,
  LEFT_HIP: 23,      RIGHT_HIP: 24,
  LEFT_KNEE: 25,     RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
};

function angle(a, b, c) {
  if (!a || !b || !c) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) return null;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
}

/* ------------------------------------------------------------------ *
 * גוף מדומה
 * ------------------------------------------------------------------ */

const P = (x, y, visibility = 1) => ({ x, y, visibility });

/**
 * שכיבת סמיכה: הגוף אופקי (כתפיים וקרסוליים מרוחקים ב-x),
 * וזווית המרפק נקבעת ע"י מיקום פרק כף היד.
 */
function pushupBody(elbowDeg, vis = 1) {
  const lm = [];
  // כתף בשמאל הפריים, קרסול בימין — גוף שרוע
  lm[POSE.LEFT_SHOULDER]  = P(0.20, 0.50, vis);
  lm[POSE.RIGHT_SHOULDER] = P(0.20, 0.54, vis);
  lm[POSE.LEFT_HIP]       = P(0.55, 0.52, vis);
  lm[POSE.RIGHT_HIP]      = P(0.55, 0.56, vis);
  lm[POSE.LEFT_ANKLE]     = P(0.85, 0.53, vis);
  lm[POSE.RIGHT_ANKLE]    = P(0.85, 0.57, vis);

  // מרפק מתחת לכתף; כף היד בזווית המבוקשת סביב המרפק
  const ex = 0.20, ey = 0.70;
  lm[POSE.LEFT_ELBOW]  = P(ex, ey, vis);
  lm[POSE.RIGHT_ELBOW] = P(ex, ey, vis);

  // וקטור כתף->מרפק מצביע מטה; מסובבים ממנו את המרפק
  const rad = (elbowDeg * Math.PI) / 180;
  lm[POSE.LEFT_WRIST]  = P(ex + Math.sin(rad) * 0.2, ey - Math.cos(rad) * 0.2, vis);
  lm[POSE.RIGHT_WRIST] = P(ex + Math.sin(rad) * 0.2, ey - Math.cos(rad) * 0.2, vis);
  return lm;
}

/** סקוואט: hip הוא גובה הירכיים; 0.50 = עמידה */
function squatBody(hip, vis = 1) {
  const lm = [];
  lm[POSE.LEFT_SHOULDER]  = P(0.50, 0.30, vis);
  lm[POSE.RIGHT_SHOULDER] = P(0.54, 0.30, vis);
  lm[POSE.LEFT_HIP]       = P(0.50, hip, vis);
  lm[POSE.RIGHT_HIP]      = P(0.54, hip, vis);
  lm[POSE.LEFT_KNEE]      = P(0.50, hip + 0.18, vis);
  lm[POSE.RIGHT_KNEE]     = P(0.54, hip + 0.18, vis);
  lm[POSE.LEFT_ANKLE]     = P(0.50, 0.92, vis);
  lm[POSE.RIGHT_ANKLE]    = P(0.54, 0.92, vis);
  return lm;
}

/* ------------------------------------------------------------------ *
 * נגן: מזין פריימים למנוע
 * ------------------------------------------------------------------ */

function feed(c, lm, { from, ms, step = 50, exercise = 'pushup' }) {
  let t = from;
  const end = from + ms;
  while (t <= end) {
    c = update(c, { lm, POSE, angle, now: t, visible: bodyVisible(lm, POSE, exercise) });
    t += step;
  }
  return { c, t: t - step };
}

/** מעביר את המנוע דרך השער והספירה לאחור */
function armed(exercise, target, lm) {
  let c = createCounter(exercise, target);
  let t = 1000;
  ({ c, t } = feed(c, lm, { from: t, ms: 1600, exercise }));     // שער גוף מלא
  ({ c, t } = feed(c, lm, { from: t + 50, ms: 3100, exercise })); // 3-2-1
  return { c, t };
}

/* ------------------------------------------------------------------ *
 * עזרים
 * ------------------------------------------------------------------ */

console.log('— עזרי מדידה —');
{
  const flat = pushupBody(170);
  is('גוף שרוע מזוהה כאופקי', bodyHorizontal(flat, POSE), true);

  // אותו גוף, אנכי: כתפיים מעל קרסוליים
  const upright = squatBody(0.5);
  is('גוף עומד אינו אופקי', bodyHorizontal(upright, POSE), false);

  // צד אחד מוסתר — נבחר הצד הנראה
  const oneSide = pushupBody(90);
  oneSide[POSE.LEFT_ELBOW] = P(0.9, 0.9, 0.1);
  is('זווית נלקחת מהצד הנראה', Math.round(pushupAngle(oneSide, POSE, angle)), 90);

  const hidden = pushupBody(170, 0.2);
  is('נקודות מעומעמות = לא רואים גוף', bodyVisible(hidden, POSE, 'pushup'), false);
  is('נקודות ברורות = רואים גוף', bodyVisible(pushupBody(170), POSE, 'pushup'), true);
}

/* ------------------------------------------------------------------ *
 * שער הגוף המלא
 * ------------------------------------------------------------------ */

console.log('\n— שער הגוף המלא —');
{
  let c = createCounter('pushup', 10);
  const lm = pushupBody(170);

  ({ c } = feed(c, lm, { from: 0, ms: 900 }));
  is('אחרי 0.9 שנ׳ עדיין ממתינים', c.state, STATE.WAITING);

  ({ c } = feed(c, lm, { from: 1000, ms: 1600 }));
  is('אחרי 1.5 שנ׳ עוברים לספירה לאחור', c.state, STATE.COUNTDOWN);

  let t;
  ({ c, t } = feed(c, lm, { from: 2700, ms: 3100 }));
  is('ואז מתחילים', c.state, STATE.UP);
}

/* ------------------------------------------------------------------ *
 * עשר שכיבות אמיתיות = עשר
 * ------------------------------------------------------------------ */

console.log('\n— הגדרת הסיום: עשר שכיבות —');
{
  let { c, t } = armed('pushup', 10, pushupBody(170));
  is('מתחילים מאפס', c.reps, 0);

  for (let i = 0; i < 10; i++) {
    ({ c, t } = feed(c, pushupBody(80),  { from: t + 50, ms: 700 }));   // למטה
    ({ c, t } = feed(c, pushupBody(170), { from: t + 50, ms: 700 }));   // למעלה
  }
  is('עשר שכיבות מלאות נספרות', c.reps, 10);
  is('והמשימה הסתיימה', c.state, STATE.DONE);
}

/* ------------------------------------------------------------------ *
 * חצאי-חזרות אינן נספרות
 * ------------------------------------------------------------------ */

console.log('\n— חצאי-חזרות —');
{
  let { c, t } = armed('pushup', 10, pushupBody(170));

  // ירידה חלקית בלבד: מרפק ב-130 מעלות, לא מגיע ל"למטה"
  for (let i = 0; i < 6; i++) {
    ({ c, t } = feed(c, pushupBody(130), { from: t + 50, ms: 700 }));
    ({ c, t } = feed(c, pushupBody(170), { from: t + 50, ms: 700 }));
  }
  is('שש ירידות חלקיות לא נספרו', c.reps, 0);

  // ירידה מלאה אבל עלייה חלקית
  for (let i = 0; i < 6; i++) {
    ({ c, t } = feed(c, pushupBody(80),  { from: t + 50, ms: 700 }));
    ({ c, t } = feed(c, pushupBody(130), { from: t + 50, ms: 700 }));
  }
  is('ועליות חלקיות גם לא', c.reps, 0);

  // עכשיו עלייה מלאה אחת — משלימה את החזרה שנפתחה
  ({ c, t } = feed(c, pushupBody(170), { from: t + 50, ms: 700 }));
  is('עלייה מלאה סוגרת חזרה אחת', c.reps, 1);
}

/* ------------------------------------------------------------------ *
 * תנועה מהירה מדי
 * ------------------------------------------------------------------ */

console.log('\n— משך מינימלי לפאזה —');
{
  let { c, t } = armed('pushup', 10, pushupBody(170));

  // רעידה: 100ms לכל פאזה, מתחת לסף של 500
  for (let i = 0; i < 8; i++) {
    ({ c, t } = feed(c, pushupBody(80),  { from: t + 50, ms: 100 }));
    ({ c, t } = feed(c, pushupBody(170), { from: t + 50, ms: 100 }));
  }
  is('רעידות מהירות לא נספרות', c.reps, 0);
}

/* ------------------------------------------------------------------ *
 * יציאה מהפריים
 * ------------------------------------------------------------------ */

console.log('\n— יציאה מהפריים —');
{
  let { c, t } = armed('pushup', 10, pushupBody(170));

  ({ c, t } = feed(c, pushupBody(80),  { from: t + 50, ms: 700 }));
  ({ c, t } = feed(c, pushupBody(170), { from: t + 50, ms: 700 }));
  is('חזרה אחת לפני היציאה', c.reps, 1);

  // חלק מהגוף יוצא
  ({ c, t } = feed(c, pushupBody(170, 0.2), { from: t + 50, ms: 400 }));
  is('היציאה משהה מיד', c.state, STATE.PAUSED);

  // תנועה מלאה בזמן שהגוף בחוץ
  ({ c, t } = feed(c, pushupBody(80, 0.2),  { from: t + 50, ms: 700 }));
  ({ c, t } = feed(c, pushupBody(170, 0.2), { from: t + 50, ms: 700 }));
  is('ואין ספירה כשהגוף בחוץ', c.reps, 1);

  // חוזר
  ({ c, t } = feed(c, pushupBody(170), { from: t + 50, ms: 1600 }));
  is('חוזרים לספירה אחרי שהגוף חוזר', c.state, STATE.UP);
  is('והמונה נשמר', c.reps, 1);
}

/* ------------------------------------------------------------------ *
 * סקוואט לפי גובה ירכיים
 * ------------------------------------------------------------------ */

console.log('\n— סקוואט: גובה ירכיים ולא זווית ברך —');
{
  let { c, t } = armed('squat', 10, squatBody(0.50));
  is('גובה העמידה כויל', Math.round(c.standingHip * 100) / 100, 0.5);

  // ירידה של 25%+ מגובה הגו (גו = 0.50-0.30 = 0.20 ⇒ 0.05+)
  for (let i = 0; i < 5; i++) {
    ({ c, t } = feed(c, squatBody(0.58), { from: t + 50, ms: 700, exercise: 'squat' }));
    ({ c, t } = feed(c, squatBody(0.50), { from: t + 50, ms: 700, exercise: 'squat' }));
  }
  is('חמישה סקוואטים מלאים', c.reps, 5);

  // ירידה זעירה — לא סקוואט
  let before = c.reps;
  for (let i = 0; i < 5; i++) {
    ({ c, t } = feed(c, squatBody(0.52), { from: t + 50, ms: 700, exercise: 'squat' }));
    ({ c, t } = feed(c, squatBody(0.50), { from: t + 50, ms: 700, exercise: 'squat' }));
  }
  is('ירידות זעירות לא נספרות', c.reps, before);
}

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
