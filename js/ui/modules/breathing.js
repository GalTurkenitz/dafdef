/**
 * modules/breathing.js — תרגיל נשימות מונחה (המפרט, סעיף 10.4).
 *
 * טבעת שמתרחבת ומתכווצת לפי תבנית 4-7-8, שתי דקות.
 * אכיפה: נוכחות רציפה בפריים — יצא, הטיימר נעצר וחוזר כשחוזר.
 * זיהוי תנועת כתפיים הוא אימות רך: חיווי בלבד, לא פסילה.
 */

import { BREATHING } from '../../config.js';
import { createCamera, POSE, mid } from '../../camera/camera.js';

const PHASES = [
  { key: 'inhale', label: 'שאף',  seconds: BREATHING.pattern.inhale },
  { key: 'hold',   label: 'החזק', seconds: BREATHING.pattern.hold },
  { key: 'exhale', label: 'נשוף', seconds: BREATHING.pattern.exhale },
];

const CYCLE = PHASES.reduce((s, p) => s + p.seconds, 0);

export async function mount(host, { onComplete } = {}) {
  host.innerHTML = '<div data-cam></div><div class="breath" data-breath></div>';

  const panel = host.querySelector('[data-breath]');
  let elapsed = 0;          // שניות שנצברו בפועל
  let last = 0;
  let timer = null;
  let present = false;
  let shoulderHint = '';

  // מעקב אחרי גובה הכתפיים — עולה בשאיפה, יורד בנשיפה
  let baseY = null;
  let smoothY = null;

  const cam = createCamera({
    host: host.querySelector('[data-cam]'),
    model: 'pose',
    onPresence: (s) => {
      present = s.present;
      if (!present) cam.setGuide('חזור לתוך הפריים — הטיימר ממתין', 'warn');
    },
    onFrame: (result, ctx) => {
      const lm = result.landmarks?.[0];
      if (!lm) return;

      const shoulders = mid(lm[POSE.LEFT_SHOULDER], lm[POSE.RIGHT_SHOULDER]);
      if (shoulders) {
        smoothY = smoothY == null ? shoulders.y : smoothY * 0.85 + shoulders.y * 0.15;
        if (baseY == null) baseY = smoothY;
        // y קטן = גבוה יותר במסך
        const delta = baseY - smoothY;
        shoulderHint = delta > 0.004 ? 'up' : delta < -0.004 ? 'down' : '';
      }

      ctx.setGuide(present ? '' : 'חזור לתוך הפריים — הטיימר ממתין', present ? '' : 'warn');
    },
  });

  /* ---------------------------------------------------------------- */

  function phaseAt(seconds) {
    let t = seconds % CYCLE;
    for (const phase of PHASES) {
      if (t < phase.seconds) return { ...phase, into: t };
      t -= phase.seconds;
    }
    return { ...PHASES[0], into: 0 };
  }

  /** 0..1 — כמה הטבעת פתוחה */
  function openness(phase) {
    const p = phase.into / phase.seconds;
    if (phase.key === 'inhale') return p;
    if (phase.key === 'hold') return 1;
    return 1 - p;
  }

  function render() {
    const phase = phaseAt(elapsed);
    const scale = 0.45 + openness(phase) * 0.55;
    const left = Math.max(0, BREATHING.totalSeconds - elapsed);

    // האימות הרך: מראים אם התנועה מסתנכרנת, בלי לפסול
    const synced = (phase.key === 'inhale' && shoulderHint === 'up')
                || (phase.key === 'exhale' && shoulderHint === 'down');

    panel.innerHTML = `
      <div class="breath__ring" style="--open:${scale.toFixed(3)}">
        <span class="breath__label">${phase.label}</span>
        <span class="breath__count">${Math.ceil(phase.seconds - phase.into)}</span>
      </div>
      <p class="breath__left">${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} נותרו</p>
      <p class="breath__sync ${synced ? 'is-on' : ''}">${synced ? 'יפה, ממש ככה' : ' '}</p>`;
  }

  function tick() {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    // הזמן נצבר רק כשהמשתמש בפריים (המפרט, סעיף 10.4)
    if (present) elapsed += dt;

    render();

    if (elapsed >= BREATHING.totalSeconds) {
      clearInterval(timer);
      cam.stop();
      onComplete?.(1, { seconds: Math.round(elapsed) });
    }
  }

  /* ---------------------------------------------------------------- */

  try {
    await cam.start();
  } catch {
    return;   // createCamera כבר הציג את השגיאה
  }

  cam.setGuide('שב בנוח, כתפיים רפויות. נתחיל.');
  last = performance.now();
  timer = setInterval(tick, 100);

  window.addEventListener('pagehide', () => { clearInterval(timer); cam.stop(); }, { once: true });

  return { stop: () => { clearInterval(timer); cam.stop(); } };
}
