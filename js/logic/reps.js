/**
 * reps.js — ספירת חזרות (V3, סעיף ו7).
 *
 * המנוע שמאחורי חיישן הכושר, כמודול טהור: בלי DOM, בלי מצלמה,
 * בלי זמן גלובלי. הוא מקבל נקודות גוף וחותמת זמן ומחזיר מצב
 * חדש. זה מה שמאפשר לבדוק את הספירה בלי לעמוד מול הטלפון —
 * ובלי זה אי אפשר לדעת שחצי-חזרה באמת לא נספרת.
 *
 * ── מה נשבר בגרסה הקודמת ──────────────────────────────────────
 * הסקוואטים נמדדו לפי זווית ברך. הזווית מחושבת מנקודות שהמודל
 * מנחש כשהן מוסתרות, ולכן היא קפצה והחזרות נספרו באוויר. כאן
 * המדד הוא **גובה הירכיים ביחס לעמידה** — נקודה יציבה שנראית
 * כמעט תמיד, מכוילת לגוף של המשתמש עצמו.
 *
 * ── השערים ────────────────────────────────────────────────────
 * 1. שער גוף מלא: אין ספירה עד שכל הנקודות הנדרשות נראות ברציפות.
 * 2. יציאה מהפריים עוצרת מיד וממשיכה כשהגוף חוזר במלואו.
 * 3. לכל פאזה משך מינימלי — תנועה מהירה מדי אינה חזרה.
 */

export const VISIBILITY_MIN = 0.6;   // סף אמון לנקודת גוף
export const GATE_MS = 1500;         // כמה זמן רצוף צריך לראות גוף מלא
export const COUNTDOWN_MS = 3000;    // 3-2-1 לפני שמתחילים
export const PHASE_MIN_MS = 500;     // משך מינימלי לפאזה

/** מצבי המנוע */
export const STATE = {
  WAITING: 'waiting',        // מחכים שהגוף ייכנס במלואו
  COUNTDOWN: 'countdown',    // 3-2-1
  UP: 'up',                  // בעמידה / זרועות ישרות
  DOWN: 'down',              // למטה
  PAUSED: 'paused',          // הגוף יצא מהפריים באמצע
  DONE: 'done',
};

/** הנקודות שחייבות להיראות, לכל תרגיל */
export const REQUIRED = {
  pushup: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW',
           'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_HIP', 'RIGHT_HIP'],
  squat:  ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP',
           'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE'],
};

export function createCounter(exercise = 'pushup', target = 10) {
  return {
    exercise,
    target,
    reps: 0,
    state: STATE.WAITING,
    since: 0,           // מתי נכנסנו למצב הנוכחי
    visibleSince: 0,    // מתי הגוף נראה במלואו ברציפות
    standingHip: null,  // כיול גובה עמידה לסקוואט
    /* מתי התנאי ההפוך התחיל להתקיים ברציפות. המעבר דורש שהוא
       יחזיק PHASE_MIN_MS — אחרת רעידה מהירה מצליחה להתהפך
       בפריים בודד אחרי שהמתנה ארוכה צברה זמן בפאזה. */
    candidateSince: 0,
    cue: '',
  };
}

/* ------------------------------------------------------------------ *
 * עזרים
 * ------------------------------------------------------------------ */

/** האם כל הנקודות הנדרשות נראות מעל סף האמון */
export function bodyVisible(lm, POSE, exercise) {
  const need = REQUIRED[exercise] || REQUIRED.pushup;
  return need.every((key) => {
    const p = lm?.[POSE[key]];
    // visibility חסר נחשב כנראה — מודלים מסוימים לא מספקים אותו
    return p && (p.visibility == null || p.visibility >= VISIBILITY_MIN);
  });
}

/** ממוצע של ערכים קיימים */
const avg = (...v) => {
  const list = v.filter((x) => x != null);
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
};

/**
 * ו7 — שכיבות: זווית המרפק נלקחת **רק מהצד שנראה טוב יותר**,
 * ולא כממוצע של שני הצדדים. צד מוסתר מייצר זווית מנוחשת שמזייפת
 * את הספירה.
 */
export function pushupAngle(lm, POSE, angle) {
  const sides = [
    { s: POSE.LEFT_SHOULDER,  e: POSE.LEFT_ELBOW,  w: POSE.LEFT_WRIST },
    { s: POSE.RIGHT_SHOULDER, e: POSE.RIGHT_ELBOW, w: POSE.RIGHT_WRIST },
  ].map(({ s, e, w }) => {
    const a = lm[s], b = lm[e], c = lm[w];
    if (!a || !b || !c) return null;
    const vis = Math.min(a.visibility ?? 1, b.visibility ?? 1, c.visibility ?? 1);
    return { vis, deg: angle(a, b, c) };
  }).filter((x) => x && x.deg != null);

  if (!sides.length) return null;
  return sides.sort((a, b) => b.vis - a.vis)[0].deg;
}

/**
 * ו7 — שכיבות: הגוף חייב להיות אופקי. בלי זה כיפוף מרפק בעמידה
 * נספר כחזרה. נמדד כיחס בין המרחק האנכי לאופקי בין כתפיים
 * לקרסוליים; בשכיבה הגוף שרוע, ולכן האנכי קטן מהאופקי.
 */
export function bodyHorizontal(lm, POSE) {
  const sh = avgPoint(lm[POSE.LEFT_SHOULDER], lm[POSE.RIGHT_SHOULDER]);
  const an = avgPoint(lm[POSE.LEFT_ANKLE], lm[POSE.RIGHT_ANKLE])
          || avgPoint(lm[POSE.LEFT_HIP], lm[POSE.RIGHT_HIP]);
  if (!sh || !an) return false;

  const dy = Math.abs(sh.y - an.y);
  const dx = Math.abs(sh.x - an.x);
  return dx > dy;     // פרוש יותר לרוחב מאשר לגובה
}

function avgPoint(a, b) {
  if (!a && !b) return null;
  if (!a) return { x: b.x, y: b.y };
  if (!b) return { x: a.x, y: a.y };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** גובה הירכיים בפריים (0 למעלה, 1 למטה) */
export function hipY(lm, POSE) {
  const p = avgPoint(lm[POSE.LEFT_HIP], lm[POSE.RIGHT_HIP]);
  return p ? p.y : null;
}

/** גובה הכתפיים — משמש לנרמול לפי גודל הגוף בפריים */
export function shoulderY(lm, POSE) {
  const p = avgPoint(lm[POSE.LEFT_SHOULDER], lm[POSE.RIGHT_SHOULDER]);
  return p ? p.y : null;
}

/* ------------------------------------------------------------------ *
 * המנוע
 * ------------------------------------------------------------------ */

/**
 * מעדכן את המונה מפריים אחד.
 *
 * @param {object} c      המצב (מ-createCounter)
 * @param {object} frame  { lm, POSE, angle, now, visible }
 * @returns {object} מצב חדש. c עצמו אינו משתנה.
 */
export function update(c, { lm, POSE, angle, now, visible }) {
  const next = { ...c };

  /* ---- שער הגוף המלא ותפיסת יציאה מהפריים ---- */

  if (!visible) {
    next.visibleSince = 0;
    // באמצע סט — משהים, לא מאפסים את הספירה
    if (c.state === STATE.UP || c.state === STATE.DOWN) {
      next.state = STATE.PAUSED;
      next.since = now;
    } else if (c.state === STATE.COUNTDOWN) {
      next.state = STATE.WAITING;
      next.since = now;
    }
    next.cue = 'לא רואים את כל הגוף';
    return next;
  }

  if (!c.visibleSince) next.visibleSince = now;
  const steady = now - next.visibleSince;

  if (c.state === STATE.WAITING) {
    if (steady < GATE_MS) {
      next.cue = 'מתייצבים…';
      return next;
    }
    next.state = STATE.COUNTDOWN;
    next.since = now;
    next.cue = '3';
    return next;
  }

  if (c.state === STATE.COUNTDOWN) {
    const left = COUNTDOWN_MS - (now - c.since);
    if (left > 0) {
      next.cue = String(Math.ceil(left / 1000));
      return next;
    }
    // בסקוואט מכיילים את גובה העמידה ברגע שמתחילים
    next.state = STATE.UP;
    next.since = now;
    next.cue = c.exercise === 'squat' ? 'רד למטה' : 'רד למטה';
    if (c.exercise === 'squat') next.standingHip = hipY(lm, POSE);
    return next;
  }

  if (c.state === STATE.PAUSED) {
    // חוזרים רק אחרי שהגוף נראה שוב ברציפות
    if (steady < GATE_MS) { next.cue = 'חוזרים…'; return next; }
    next.state = STATE.UP;
    next.since = now;
    next.cue = 'רד למטה';
    return next;
  }

  if (c.state === STATE.DONE) return next;

  /* ---- מדידה ---- */

  let isDown = false;
  let isUp = false;

  if (c.exercise === 'squat') {
    /* המדד: כמה הירכיים ירדו ביחס לעמידה, מנורמל לגובה הגוף
       בפריים (כתפיים עד ירכיים), כך שמרחק מהמצלמה לא משפיע. */
    const hip = hipY(lm, POSE);
    const sh = shoulderY(lm, POSE);
    if (hip == null || sh == null) return next;

    // כיול מתמשך: הגובה הגבוה ביותר שנראה הוא העמידה
    if (next.standingHip == null || hip < next.standingHip) next.standingHip = hip;

    const torso = Math.abs(next.standingHip - sh) || 0.2;
    const drop = (hip - next.standingHip) / torso;

    isDown = drop > 0.25;     // הירכיים ירדו ברבע מגובה הגו
    isUp = drop < 0.10;
  } else {
    const deg = pushupAngle(lm, POSE, angle);
    if (deg == null) return next;

    // בלי גוף אופקי אין שכיבות סמיכה
    if (!bodyHorizontal(lm, POSE)) {
      next.cue = 'שכב אופקית מול המצלמה';
      return next;
    }

    isDown = deg < 100;
    isUp = deg > 155;
  }

  /* ---- מכונת המצבים ----
     המעבר דורש שהמצב ההפוך יתקיים **ברציפות** PHASE_MIN_MS.
     מדידה מרגע הכניסה לפאזה לא הספיקה: המתנה ארוכה צברה זמן,
     ואז די היה בפריים בודד כדי להתהפך — כך רעידות נספרו. */

  const wantDown = c.state === STATE.UP;
  const reached = wantDown ? isDown : isUp;

  if (!reached) {
    next.candidateSince = 0;
    if (!next.cue) next.cue = wantDown ? 'רד למטה' : 'עכשיו למעלה';
    return next;
  }

  if (!c.candidateSince) {
    next.candidateSince = now;
    return next;
  }

  if (now - c.candidateSince < PHASE_MIN_MS) {
    next.candidateSince = c.candidateSince;
    return next;
  }

  next.candidateSince = 0;
  next.since = now;

  if (wantDown) {
    next.state = STATE.DOWN;
    next.cue = 'עכשיו למעלה';
    return next;
  }

  next.state = STATE.UP;
  next.reps = c.reps + 1;
  next.cue = next.reps >= c.target ? 'כל הכבוד' : 'רד למטה';
  if (next.reps >= c.target) next.state = STATE.DONE;
  return next;

}
