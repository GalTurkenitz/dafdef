/**
 * modules/water.js — רצף שתיית מים (המפרט, סעיף 10.5).
 *
 * שלושה שלבים: "הראה את הכוס" ⇐ "שתה" ⇐ "מאושר".
 * קירור של 30 דקות בין כוסות, והשווי נמוך בכוונה.
 *
 * V3 סעיף ו6 — תיקון באג: קודם "הראה את הכוס" עבר עם יד ריקה,
 * כי הבדיקה הייתה רק "יד מורמת". עכשיו רץ במקביל מזהה אובייקטים
 * אמיתי (EfficientDet-Lite, על המכשיר), ונדרש **זיהוי בפועל** של
 * כוס, כוס יין או בקבוק. גם בשלב השתייה הכוס חייבת להישאר מזוהה
 * לאורך הלגימה — לא רק תנועת יד.
 *
 * אם המודל לא נטען מוצגת שגיאה ברורה והמשימה אינה מתקדמת, במקום
 * לעבור בשקט.
 */

import { WATER_COOLDOWN_MS } from '../../config.js';
import { createCamera, POSE, mid, CUP_CLASSES } from '../../camera/camera.js';
import { icon } from '../icons.js';
import { waterCooldownLeft, setModuleData } from '../../logic/store.js';

/** כמה זמן צריך להחזיק את היד ליד הפה כדי שזה ייחשב שתייה */
const SIP_MS = 2500;

/** כמה זמן הכוס צריכה להיות מזוהה ברצף כדי לעבור את שלב ההצגה */
const CUP_HOLD_MS = 1200;

/** זיהוי נחשב "כוס" רק מעל הסף הזה */
const CUP_SCORE = 0.4;

/**
 * מאתר כוס בין הזיהויים של הפריים.
 * @returns {{score:number, box:object}|null}
 */
function findCup(objects = []) {
  let best = null;
  for (const d of objects) {
    for (const c of d.categories || []) {
      const name = (c.categoryName || '').toLowerCase();
      if (!CUP_CLASSES.includes(name)) continue;
      if (c.score < CUP_SCORE) continue;
      if (!best || c.score > best.score) best = { score: c.score, box: d.boundingBox };
    }
  }
  return best;
}

export async function mount(host, { onComplete } = {}) {
  /* ---------------------------------------------------------------- *
   * קירור
   * ---------------------------------------------------------------- */

  const cooldown = waterCooldownLeft();
  if (cooldown > 0) {
    const minutes = Math.ceil(cooldown / 60000);
    host.innerHTML = `
      <p class="t-sub empty">שתית לא מזמן.<br>
        הכוס הבאה בעוד ${minutes} דקות.</p>`;
    return;
  }

  host.innerHTML = `
    <div data-cam></div>
    <div class="water" data-water></div>`;

  const panel = host.querySelector('[data-water]');

  const STEPS = [
    { key: 'show',  label: 'הראה את הכוס', hint: 'החזק כוס, בקבוק או כוס יין מול המצלמה' },
    { key: 'drink', label: 'שתה',          hint: 'קרב את הכוס לפה והטה' },
    { key: 'done',  label: 'מאושר',        hint: '' },
  ];

  let step = 0;
  let cupSince = 0;
  let sipMs = 0;
  let finished = false;
  let cupSeen = false;      // האם כוס מזוהה בפריים הנוכחי

  function render() {
    panel.innerHTML = `
      <div class="water__steps">
        ${STEPS.map((s, i) => `
          <span class="water__step${i < step ? ' is-done' : ''}${i === step ? ' is-current' : ''}">
            ${i < step ? icon('check', 16) : i + 1}
            <small>${s.label}</small>
          </span>`).join('')}
      </div>
      ${step === 1 ? `<div class="progress"><i style="inline-size:${Math.min(100, (sipMs / SIP_MS) * 100)}%"></i></div>` : ''}
      <p class="t-sub" style="text-align:center;">${STEPS[step].hint}</p>`;
  }

  /* ---------------------------------------------------------------- */

  const cam = createCamera({
    host: host.querySelector('[data-cam]'),
    model: 'pose',
    detectObjects: true,
    onPresence: (s) => {
      if (!s.present) cam.setGuide('חזור לתוך הפריים', 'warn');
    },
    onFrame: (result, ctx) => {
      const lm = result.landmarks?.[0];
      if (!lm || finished) return;

      const nose = lm[POSE.NOSE];
      const wrists = [lm[POSE.LEFT_WRIST], lm[POSE.RIGHT_WRIST]].filter(Boolean);
      const shoulders = mid(lm[POSE.LEFT_SHOULDER], lm[POSE.RIGHT_SHOULDER]);
      if (!nose || !wrists.length || !shoulders) return;

      // היד הקרובה ביותר לפה
      const near = wrists.reduce((best, w) => {
        const d = Math.hypot(w.x - nose.x, w.y - nose.y);
        return !best || d < best.d ? { w, d } : best;
      }, null);

      const handNearFace = near.d < 0.22;

      // ו6: הכוס חייבת להיות מזוהה באמת, לא רק יד מורמת
      const cup = findCup(ctx.objects);
      cupSeen = Boolean(cup);

      if (step === 0) {
        if (!cup) {
          cupSince = 0;
          cam.setGuide('לא רואים כוס. החזק כוס או בקבוק מול המצלמה', 'warn');
          return;
        }

        if (!cupSince) cupSince = ctx.now;
        cam.setGuide(`רואים כוס · ${Math.round(cup.score * 100)}%`);

        if (ctx.now - cupSince > CUP_HOLD_MS) { step = 1; cupSince = 0; render(); }
        return;
      }

      if (step === 1) {
        // גם כאן הכוס חייבת להישאר בפריים — לא מספיק להרים יד ריקה
        if (handNearFace && cupSeen) {
          sipMs += 40;
          cam.setGuide('ממשיכים…');
        } else {
          sipMs = Math.max(0, sipMs - 25);
          cam.setGuide(cupSeen ? 'קרב את הכוס לפה' : 'הכוס יצאה מהפריים', cupSeen ? '' : 'warn');
        }

        render();

        if (sipMs >= SIP_MS) {
          finished = true;
          step = 2;
          render();
          cam.setGuide('מאושר');
          setModuleData('water', { lastDrink: Date.now() });
          setTimeout(() => { cam.stop(); onComplete?.(1); }, 900);
        }
      }
    },
  });

  render();

  try {
    await cam.start();
  } catch {
    return;   // createCamera כבר הציג את השגיאה
  }

  /* מודל שלא נטען = שגיאה ברורה, לא מעבר שקט (ו6) */
  if (!cam.hasDetector) {
    cam.stop();
    host.innerHTML = `
      <p class="t-sub empty">לא הצלחנו לטעון את מזהה האובייקטים,
        ובלעדיו אי אפשר לאמת שיש כוס.<br>נסה שוב עם חיבור אינטרנט יציב.</p>`;
    return;
  }

  window.addEventListener('pagehide', () => cam.stop(), { once: true });
  return { stop: () => cam.stop() };
}

export { WATER_COOLDOWN_MS };
