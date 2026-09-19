/**
 * task.js — מסך המשימה הגנרי (המפרט, סעיף 9.3).
 *
 * עטיפה אחידה לכל משימת רוטציה: כותרת, שווי, תוכן המודול,
 * התקדמות, ובסיום — אנימציית "+X דק'" וחזרה הביתה עם ✓ בסבב.
 *
 * המודולים עצמם נבנים בשלבים 6-7. עד אז כל נישה שאין לה מודול
 * מציגה מסך "בקרוב" כן, ולא מתחזה לעבוד.
 */

import { initTheme } from './theme.js';
import { mountBack } from './nav.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { NICHES } from '../config.js';
import { taskValue, roundMinutes } from '../logic/formula.js';
import { getProfile, canPerform, earnUnits, openDay, getSettings } from '../logic/store.js';

const $ = (s) => document.querySelector(s);

const els = {
  title:   $('[data-task-title]'),
  value:   $('[data-task-value]'),
  module:  $('[data-module]'),
  actions: $('[data-task-actions]'),
};

const nicheId = new URLSearchParams(location.search).get('niche');
const niche = NICHES[nicheId];

/* ------------------------------------------------------------------ *
 * סיום משימה
 * ------------------------------------------------------------------ */

/**
 * מזכה על המשימה, מסמן ✓ בסבב ומציג את אישור הסיום.
 * @param {number} units כמה יחידות בוצעו
 */
function complete(units = 1) {
  const { added, roundComplete, bonus } = earnUnits(nicheId, units);

  els.module.innerHTML = `
    <div class="taskdone screen-in">
      <div class="taskdone__mark">${icon('check', 40)}</div>
      <p class="taskdone__earn">+${roundMinutes(added)} דק׳</p>
      <p class="t-sub">${niche.name} · ✓ בסבב היומי</p>
      ${bonus ? `<p class="taskdone__bonus">ועוד ${bonus} דקות על השלמת הסבב 🎉</p>` : ''}
      ${roundComplete && !bonus ? '<p class="t-sub">הסבב הושלם — מכאן הכל פתוח</p>' : ''}
    </div>`;

  els.actions.innerHTML = '<a class="btn btn--primary btn--block" href="index.html">חזרה לבית</a>';
}

/* ------------------------------------------------------------------ *
 * מודול שעוד לא נבנה
 * ------------------------------------------------------------------ */

const COMING = {
  fitness:   'ספירת חזרות במצלמה — שכיבות סמיכה וסקוואטים.',
  learning:  'כרטיסיות אנגלית, סט של עשר שאלות.',
  writing:   'עורך יומן עם פרומפט יומי.',
  breathing: 'תרגיל נשימה מונחה של שתי דקות, עם מצלמה.',
  water:     'רצף מונחה במצלמה — כוס, שתייה, אישור.',
};

function renderComing() {
  els.module.innerHTML = `
    <div class="card stack-2" style="text-align:center;">
      <span style="font-size:34px;">${icon(niche.icon, 34)}</span>
      <b>${niche.name} עוד בבנייה</b>
      <p class="t-sub">${COMING[nicheId] || ''}</p>
    </div>
    <p class="t-small" style="text-align:center;">
      אפשר לסמן את המשימה כבוצעה כדי לבדוק את זרימת הסבב.</p>`;

  els.actions.innerHTML = `
    <button class="btn btn--secondary btn--block" data-dev-complete>
      סמן כבוצע (בדיקה)
    </button>`;

  els.actions.querySelector('[data-dev-complete]').addEventListener('click', () => {
    complete(niche.id === 'fitness' ? 10 : 1);
  });
}

/* ------------------------------------------------------------------ *
 * הפעלה
 * ------------------------------------------------------------------ */

function init() {
  initTheme();
  openDay();
  mountBack('index.html');

  if (!getSettings().onboardingDone) { location.replace('onboarding.html'); return; }

  if (!niche) {
    els.title.textContent = 'משימה';
    els.module.innerHTML = '<p class="t-sub empty">לא מצאנו את המשימה הזו.</p>';
    els.actions.innerHTML = '<a class="btn btn--secondary btn--block" href="index.html">חזרה לבית</a>';
    return;
  }

  // קריאה לא עוברת כאן — היא המודול המלא בקורא
  if (nicheId === 'reading') { location.replace('reader.html'); return; }

  els.title.textContent = niche.taskLabel;
  els.value.textContent = `${roundMinutes(taskValue(nicheId, getProfile() || {}))} דק׳`;

  const gate = canPerform(nicheId);
  if (!gate.allowed) {
    const why = gate.reason === 'done-today'
      ? 'המשימה הזו כבר בוצעה היום. היא תיפתח שוב כשתשלים את הסבב.'
      : gate.reason === 'not-selected'
        ? 'הנישה הזו לא נמצאת בסבב שלך.'
        : 'המשימה לא זמינה כרגע.';

    els.module.innerHTML = `<p class="t-sub empty">${why}</p>`;
    els.actions.innerHTML = '<a class="btn btn--secondary btn--block" href="index.html">חזרה לבית</a>';
    return;
  }

  renderComing();
}

init();
