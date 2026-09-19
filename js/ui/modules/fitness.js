/**
 * modules/fitness.js — ספירת חזרות (המפרט, סעיף 10.6).
 *
 * שכיבות סמיכה וסקוואטים, לפי זוויות מפרקים ב-MediaPipe Pose.
 * חזרה = ירידה מלאה ואז עלייה מלאה — מכונת מצבים פשוטה שלא
 * נספרת פעמיים ולא נתפסת על רעידות.
 *
 * במשימת רוטציה נדרשות 10 חזרות; בערוץ החופשי כל חזרה צוברת.
 */

import { GATES } from '../../config.js';
import { createCamera, POSE, angle, mid, drawPose } from '../../camera/camera.js';

/**
 * לכל תרגיל: אילו זוויות מודדים, ומה נחשב "למטה" ו"למעלה".
 * הספים שמרניים בכוונה — עדיף לא לספור חזרה מאשר לספור אוויר.
 */
const EXERCISES = {
  pushup: {
    name: 'שכיבות סמיכה',
    setup: 'הנח את הטלפון על הרצפה בצד, כך שכל הגוף בפריים.',
    measure: (lm) => {
      const left = angle(lm[POSE.LEFT_SHOULDER], lm[POSE.LEFT_ELBOW], lm[POSE.LEFT_WRIST]);
      const right = angle(lm[POSE.RIGHT_SHOULDER], lm[POSE.RIGHT_ELBOW], lm[POSE.RIGHT_WRIST]);
      const both = [left, right].filter((v) => v != null);
      return both.length ? both.reduce((a, b) => a + b, 0) / both.length : null;
    },
    down: 100,   // מרפק כפוף
    up: 155,     // יד כמעט ישרה
  },

  squat: {
    name: 'סקוואטים',
    setup: 'העמד את הטלפון על משטח, במרחק שני מטרים, כך שכל הגוף נראה.',
    measure: (lm) => {
      const left = angle(lm[POSE.LEFT_HIP], lm[POSE.LEFT_KNEE], lm[POSE.LEFT_ANKLE]);
      const right = angle(lm[POSE.RIGHT_HIP], lm[POSE.RIGHT_KNEE], lm[POSE.RIGHT_ANKLE]);
      const both = [left, right].filter((v) => v != null);
      return both.length ? both.reduce((a, b) => a + b, 0) / both.length : null;
    },
    down: 105,
    up: 160,
  },
};

const TARGET = GATES.fitness.taskUnits;

export async function mount(host, { onComplete } = {}) {
  let exercise = 'pushup';

  /* ---------------------------------------------------------------- *
   * מסך פתיחה — בחירת תרגיל והנחיות מיקום (המפרט, סעיף 10.6)
   * ---------------------------------------------------------------- */

  host.innerHTML = `
    <div class="stack">
      <div class="seg" role="radiogroup" aria-label="תרגיל">
        <button class="seg__item" data-ex="pushup" aria-checked="true" role="radio">שכיבות סמיכה</button>
        <button class="seg__item" data-ex="squat" aria-checked="false" role="radio">סקוואטים</button>
      </div>
      <div class="card stack-2">
        <b data-setup>${EXERCISES.pushup.setup}</b>
        <p class="t-small">המצלמה צריכה לראות את כל הגוף. הכל רץ על המכשיר —
          שום וידאו לא נשמר ולא נשלח.</p>
      </div>
      <button class="btn btn--primary btn--block" data-go>מתחילים</button>
    </div>`;

  host.querySelectorAll('[data-ex]').forEach((btn) => {
    btn.addEventListener('click', () => {
      exercise = btn.dataset.ex;
      host.querySelectorAll('[data-ex]').forEach((b) =>
        b.setAttribute('aria-checked', String(b === btn)));
      host.querySelector('[data-setup]').textContent = EXERCISES[exercise].setup;
    });
  });

  await new Promise((resolve) => {
    host.querySelector('[data-go]').addEventListener('click', resolve, { once: true });
  });

  /* ---------------------------------------------------------------- *
   * הספירה
   * ---------------------------------------------------------------- */

  const cfg = EXERCISES[exercise];
  host.innerHTML = '<div data-cam></div><div class="reps" data-reps></div>';
  const panel = host.querySelector('[data-reps]');

  let reps = 0;
  let stage = 'up';          // מחכים לירידה
  let smooth = null;
  let finished = false;

  const cam = createCamera({
    host: host.querySelector('[data-cam]'),
    model: 'pose',
    onPresence: (s) => {
      if (!s.present) cam.setGuide('לא רואים אותך — סדר את הטלפון', 'warn');
    },
    onFrame: (result, ctx) => {
      const lm = result.landmarks?.[0];
      drawPose(ctx.ctx, ctx.canvas, lm);
      if (!lm || finished) return;

      const raw = cfg.measure(lm);
      if (raw == null) { cam.setGuide('לא רואים את כל הגוף', 'warn'); return; }

      // החלקה — מונעת ספירה על רעידה בודדת
      smooth = smooth == null ? raw : smooth * 0.7 + raw * 0.3;

      if (stage === 'up' && smooth < cfg.down) {
        stage = 'down';
        cam.setGuide('עכשיו למעלה');
      } else if (stage === 'down' && smooth > cfg.up) {
        stage = 'up';
        reps += 1;
        render();
        cam.setGuide(reps >= TARGET ? 'יפה מאוד' : 'עוד אחת');

        if (reps >= TARGET) {
          finished = true;
          setTimeout(() => { cam.stop(); onComplete?.(reps, { exercise }); }, 900);
        }
        return;
      } else {
        cam.setGuide(stage === 'up' ? 'רד למטה' : 'עכשיו למעלה');
      }

      render();
    },
  });

  function render() {
    panel.innerHTML = `
      <div class="reps__count">${reps}<span>/${TARGET}</span></div>
      <div class="progress"><i style="inline-size:${Math.min(100, (reps / TARGET) * 100)}%"></i></div>
      <p class="t-small">${cfg.name}</p>`;
  }

  render();

  try {
    await cam.start();
    cam.showFps(true);
  } catch {
    return;
  }

  window.addEventListener('pagehide', () => cam.stop(), { once: true });
  return { stop: () => cam.stop() };
}
