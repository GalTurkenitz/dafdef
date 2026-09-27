/**
 * modules/water.js — כוס מים.
 *
 * שני שלבים: **צילום חי של הכוס** ⇐ **הצהרה ששתית**.
 * קירור של 30 דקות בין כוסות, והשווי נמוך בכוונה.
 *
 * ─────────────────────────────────────────────────────────────────
 *  למה זה השתנה
 *
 *  הגרסה הקודמת ניסתה לזהות בווידאו חי מתי הכוס עולה לפה. שני
 *  דיווחים אמיתיים הפילו אותה: המרחק נמדד מול הפריים ולא מול
 *  הגוף (ולכן נשבר לפי המרחק מהמצלמה), ומזהה האובייקטים אישר
 *  **בקבוק בושם** כי COCO מכיר רק "bottle".
 *
 *  אין דרך לאמת שתיית מים במצלמה. אז במקום להעמיד פנים:
 *
 *    1. **צילום חי** — פריים מהזרם, לא קובץ. אי אפשר לבחור
 *       תמונה מהגלריה.
 *    2. **מסווג ImageNet** על התמונה הבודדת. הוא מכיר
 *       `water bottle` ו-`perfume` בנפרד, וזה מה שפוסל את הבושם.
 *       הרצה אחת למשימה, ולכן זול — מודל הפוז ירד מכאן לגמרי.
 *    3. **הצהרה מפורשת** ששתית.
 *
 *  הצילום הוא פעולה מכוונת, לא הוכחה. כוס ריקה עוברת. זה מקובל:
 *  מי שמרמה כאן מרמה רק את עצמו, והמשימה שווה הכי מעט דקות.
 *
 *  התמונה נשארת בזיכרון, מסווגת, ונזרקת. לא נשמרת ולא עוזבת
 *  את המכשיר.
 * ─────────────────────────────────────────────────────────────────
 */

import { WATER_COOLDOWN_MS } from '../../config.js';
import { createCamera } from '../../camera/camera.js';
import { icon } from '../icons.js';
import { waterCooldownLeft, setModuleData } from '../../logic/store.js';
import { judgeVessel, vesselMessage } from '../../logic/vessel.js';

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

  /* ---------------------------------------------------------------- *
   * מצב
   * ---------------------------------------------------------------- */

  let step = 0;          // 0 צילום · 1 הצהרה · 2 הושלם
  let judged = null;

  host.innerHTML = `
    <div class="water">
      <div class="water__cam" data-cam></div>
      <p class="water__hint" data-hint>צלם את הכוס שלך</p>
      <div class="water__actions" data-actions></div>
      <p class="t-small water__note">
        הצילום נשאר על המכשיר, נבדק, ונמחק. שום תמונה לא נשמרת ולא נשלחת.
      </p>
    </div>`;

  const hintEl = host.querySelector('[data-hint]');
  const actionsEl = host.querySelector('[data-actions]');

  function render() {
    if (step === 0) {
      actionsEl.innerHTML = `
        <button class="btn btn--primary btn--block" type="button" data-shot>
          ${icon('search', 18)} צלם את הכוס
        </button>`;
      actionsEl.querySelector('[data-shot]').addEventListener('click', shoot);
      return;
    }

    if (step === 1) {
      actionsEl.innerHTML = `
        <button class="btn btn--primary btn--block" type="button" data-drank>שתיתי</button>
        <button class="btn btn--ghost btn--block" type="button" data-again>צלם שוב</button>`;
      actionsEl.querySelector('[data-drank]').addEventListener('click', drank);
      actionsEl.querySelector('[data-again]').addEventListener('click', () => {
        step = 0;
        judged = null;
        hintEl.className = 'water__hint';
        hintEl.textContent = 'צלם את הכוס שלך';
        render();
      });
      return;
    }

    actionsEl.innerHTML = '';
  }

  function shoot() {
    const categories = cam.captureStill();
    judged = judgeVessel(categories);

    hintEl.textContent = judged.ok
      ? 'נראה טוב. שתית?'
      : vesselMessage(judged);
    hintEl.className = 'water__hint' + (judged.ok ? ' is-ok' : ' is-warn');

    if (judged.ok) { step = 1; render(); }
  }

  function drank() {
    step = 2;
    hintEl.className = 'water__hint is-ok';
    hintEl.textContent = 'מאושר';
    render();
    setModuleData('water', { lastDrink: Date.now() });
    cam.stop();
    setTimeout(() => onComplete?.(1), 700);
  }

  /* ---------------------------------------------------------------- *
   * מצלמה — תצוגה חיה בלבד, בלי מודל נקודות
   * ---------------------------------------------------------------- */

  const cam = createCamera({
    host: host.querySelector('[data-cam]'),
    model: 'none',
    classify: true,
  });

  render();

  try {
    await cam.start();
  } catch {
    return;   // createCamera כבר הציג את השגיאה
  }

  /* מודל שלא נטען = שגיאה ברורה, לא מעבר שקט */
  if (!cam.hasClassifier) {
    cam.stop();
    host.innerHTML = `
      <p class="t-sub empty">לא הצלחנו לטעון את מסווג התמונה,
        ובלעדיו אי אפשר לבדוק שיש כוס.<br>נסה שוב עם חיבור אינטרנט יציב.</p>`;
    return;
  }

  window.addEventListener('pagehide', () => cam.stop(), { once: true });
  return { stop: () => cam.stop() };
}

export { WATER_COOLDOWN_MS };
