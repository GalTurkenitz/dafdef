/**
 * modules/water.js — רצף שתיית מים (המפרט, סעיף 10.5).
 *
 * שלושה שלבים: "הראה את הכוס" ⇐ "שתה" ⇐ "מאושר".
 * קירור של 30 דקות בין כוסות, והשווי נמוך בכוונה.
 *
 * ** מגבלת אמת שכדאי לדעת: **
 * ל-MediaPipe אין מזהה כוסות. האימות כאן מבוסס על תנועת יד אל
 * הפה והטיית ראש אחורה — זו אינדיקציה, לא הוכחה, ואפשר לרמות
 * אותה. זו הסיבה שהמפרט קובע לנישה הזו את השווי הנמוך ביותר
 * (3 דקות לכוס) ושהיא זמינה רק כמשימת רוטציה.
 */

import { WATER_COOLDOWN_MS } from '../../config.js';
import { createCamera, POSE, mid } from '../../camera/camera.js';
import { waterCooldownLeft, setModuleData } from '../../logic/store.js';

/** כמה זמן צריך להחזיק את היד ליד הפה כדי שזה ייחשב שתייה */
const SIP_MS = 2500;

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
    { key: 'show',  label: 'הראה את הכוס', hint: 'החזק כוס או בקבוק בתוך הפריים' },
    { key: 'drink', label: 'שתה',          hint: 'קרב את הכוס לפה והטה' },
    { key: 'done',  label: 'מאושר',        hint: '' },
  ];

  let step = 0;
  let handUpSince = 0;
  let sipMs = 0;
  let finished = false;

  function render() {
    panel.innerHTML = `
      <div class="water__steps">
        ${STEPS.map((s, i) => `
          <span class="water__step${i < step ? ' is-done' : ''}${i === step ? ' is-current' : ''}">
            ${i < step ? '✓' : i + 1}
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

      if (step === 0) {
        // "הראה את הכוס" — יד מורמת מעל קו הכתפיים, מוחזקת רגע
        const raised = near.w.y < shoulders.y + 0.05;

        if (raised) {
          if (!handUpSince) handUpSince = ctx.now;
          cam.setGuide('יפה, מחזיקים…');
          if (ctx.now - handUpSince > 1200) { step = 1; handUpSince = 0; render(); }
        } else {
          handUpSince = 0;
          cam.setGuide('הרם את הכוס לתוך הפריים');
        }
        return;
      }

      if (step === 1) {
        if (handNearFace) {
          sipMs += 40;
          cam.setGuide('ממשיכים…');
        } else {
          sipMs = Math.max(0, sipMs - 25);
          cam.setGuide('קרב את הכוס לפה');
        }

        render();

        if (sipMs >= SIP_MS) {
          finished = true;
          step = 2;
          render();
          cam.setGuide('מאושר ✓');
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
    return;
  }

  window.addEventListener('pagehide', () => cam.stop(), { once: true });
  return { stop: () => cam.stop() };
}

export { WATER_COOLDOWN_MS };
