/**
 * modules/fitness.js — ספירת חזרות (V3, סעיף ו7).
 *
 * המודול הזה הוא הקליפה בלבד: מצלמה, ציור ותצוגה. **כל ההחלטה**
 * אם חזרה נספרת יושבת ב-js/logic/reps.js, כמודול טהור שנבדק
 * בבדיקות אוטומטיות (scripts/test-reps.mjs) בלי מצלמה — אחרת אין
 * דרך לאמת שחצי-חזרה לא נספרת בלי לעשות עשר שכיבות בכל שינוי.
 *
 * במשימת רוטציה נדרשות 10 חזרות; בערוץ החופשי כל חזרה צוברת.
 */

import { GATES } from '../../config.js';
import { createCamera, POSE, angle, mid, drawPose } from '../../camera/camera.js';
import { createCounter, update as stepCounter, bodyVisible, STATE } from '../../logic/reps.js';

/**
 * לכל תרגיל: אילו זוויות מודדים, ומה נחשב "למטה" ו"למעלה".
 * הספים שמרניים בכוונה — עדיף לא לספור חזרה מאשר לספור אוויר.
 */
/**
 * לכל תרגיל: השם וההוראה איך להציב את הטלפון. הספים והמדידה
 * עברו ל-js/logic/reps.js — כאן נשאר רק מה שמוצג למשתמש.
 */
const EXERCISES = {
  pushup: {
    name: 'שכיבות סמיכה',
    setup: 'הנח את הטלפון על הרצפה בצד, כך שכל הגוף בפריים.',
  },
  squat: {
    name: 'סקוואטים',
    setup: 'העמד את הטלפון על משטח, במרחק שני מטרים, כך שכל הגוף נראה.',
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

  let counter = createCounter(exercise, TARGET);
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

      const visible = bodyVisible(lm, POSE, exercise);
      const before = counter;
      counter = stepCounter(counter, { lm, POSE, angle, now: ctx.now, visible });

      // ההנחיה מגיעה מהמנוע, כך שהמסך והספירה לא יכולים להיפרד
      const tone = (counter.state === STATE.WAITING || counter.state === STATE.PAUSED)
        ? 'warn' : '';
      cam.setGuide(counter.cue, tone);

      if (counter.reps !== before.reps || counter.state !== before.state) render();

      if (counter.state === STATE.DONE && !finished) {
        finished = true;
        setTimeout(() => { cam.stop(); onComplete?.(counter.reps, { exercise }); }, 900);
      }
    },
  });

  function render() {
    const counting = counter.state === STATE.UP || counter.state === STATE.DOWN
                  || counter.state === STATE.DONE;

    panel.innerHTML = `
      ${counter.state === STATE.COUNTDOWN
        ? `<div class="reps__countdown">${counter.cue}</div>`
        : `<div class="reps__count">${counter.reps}<span>/${TARGET}</span></div>`}
      <div class="progress"><i style="inline-size:${Math.min(100, (counter.reps / TARGET) * 100)}%"></i></div>
      <p class="t-small">${cfg.name}${counting ? '' : ` · ${counter.cue || 'ממתינים'}`}</p>`;
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
