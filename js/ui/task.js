/**
 * task.js — מסך המשימה הגנרי (המפרט, סעיף 9.3).
 *
 * עטיפה אחידה לכל משימת רוטציה: כותרת, שווי, תוכן המודול,
 * התקדמות, ובסיום — אנימציית "+X דק'" וחזרה הביתה עם ✓ בסבב.
 *
 * כל נישה טוענת את המודול שלה דינמית — כך שקוד המצלמה הכבד
 * יורד רק כשבאמת צריך אותו.
 */

import { initTheme } from './theme.js';
import { mountBack, mountMenu, mountNavbar } from './nav.js';
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

/** נוסח אבן דרך: "100 שכיבות סמיכה" */
const MILESTONE_WORDS = {
  'fitness.pushups': 'שכיבות סמיכה',
  'fitness.squats':  'סקוואטים',
  reading:   'עמודים',
  writing:   'מילים',
  learning:  'תשובות נכונות',
  water:     'כוסות מים',
  breathing: 'תרגילי מדיטציה',
  steps:     'צעדים',
  sleep:     'שעות שינה מעל היעד',
};

const milestoneText = (m) =>
  `${m.value.toLocaleString('he')} ${MILESTONE_WORDS[m.key] || ''}`.trim();

/* ------------------------------------------------------------------ *
 * סיום משימה
 * ------------------------------------------------------------------ */

/**
 * מזכה על המשימה, מסמן ✓ בסבב ומציג את אישור הסיום.
 *
 * @param {number} units כמה יחידות בוצעו
 * @param {object} meta  מה שהמודול מדווח (exercise, correct, words,
 *   seconds). זה מה שמזין את המונים המצטברים — בלי זה הם היו
 *   סופרים "משימה" ולא "57 מילים".
 */
function complete(units = 1, meta = {}) {
  const { added, roundComplete, bonus, milestones, level } =
    earnUnits(nicheId, units, Date.now(), meta);

  els.module.innerHTML = `
    <div class="taskdone screen-in">
      <div class="taskdone__mark">${icon('check', 40)}</div>
      <p class="taskdone__earn">+${roundMinutes(added)} דק׳</p>
      <p class="t-sub">${niche.name} · סומן בסבב היומי</p>
      ${bonus ? `<p class="taskdone__bonus">ועוד ${bonus} דקות על השלמת הסבב</p>` : ''}
      ${roundComplete && !bonus ? '<p class="t-sub">הסבב הושלם — מכאן הכל פתוח</p>' : ''}
      ${milestones?.length ? milestones.map((m) =>
        `<p class="taskdone__milestone">אבן דרך: ${milestoneText(m)}</p>`).join('') : ''}
      ${level?.leveledUp ? `<p class="taskdone__level">רמה ${level.level}</p>` : ''}
    </div>`;

  els.actions.innerHTML = '<a class="btn btn--primary btn--block" href="index.html">חזרה לבית</a>';
}

/* ------------------------------------------------------------------ *
 * מודול שעוד לא נבנה
 * ------------------------------------------------------------------ */

const COMING = {};

/** המודולים. כל אחד מייצא mount(host, hooks). */
const MODULES = {
  learning:  () => import('./modules/learning.js'),
  writing:   () => import('./modules/writing.js'),
  breathing: () => import('./modules/breathing.js'),
  water:     () => import('./modules/water.js'),
  fitness:   () => import('./modules/fitness.js'),
};

/** מודולים שדורשים מצלמה — צריך HTTPS ו-getUserMedia */
const NEEDS_CAMERA = new Set(['breathing', 'water', 'fitness']);

function cameraUnavailable() {
  return !navigator.mediaDevices?.getUserMedia;
}

/** מריץ מודול אמיתי בתוך עטיפת המשימה */
async function runModule(id) {
  const mod = await MODULES[id]();

  let live = null;

  const api = await mod.mount(els.module, {
    onComplete: (units = 1, meta = {}) => complete(units, meta),
    onFail: () => {
      els.actions.innerHTML =
        '<a class="btn btn--secondary btn--block" href="index.html">חזרה לבית</a>';
    },
  });

  live = api;
  // מודול שמחזיק מצלמה חייב להשתחרר כשעוזבים את המסך
  window.addEventListener('pagehide', () => live?.stop?.());

  // מודול יכול לבקש כפתור משלו בפוטר (כמו "סיימתי לכתוב")
  if (api?.actions) {
    els.actions.innerHTML = api.actions;
    api.bind?.(els.actions);
  } else {
    els.actions.innerHTML = '';
  }
}

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
  mountMenu();
  mountNavbar('task');

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
    const why = gate.reason === 'done-this-round'
      ? 'המשימה הזו כבר בוצעה בסבב הנוכחי. היא תחזור לתור בסבב הבא.'
      : gate.reason === 'not-selected'
        ? 'הנישה הזו לא נמצאת בסבב שלך.'
        : 'המשימה לא זמינה כרגע.';

    els.module.innerHTML = `<p class="t-sub empty">${why}</p>`;
    els.actions.innerHTML = '<a class="btn btn--secondary btn--block" href="index.html">חזרה לבית</a>';
    return;
  }

  if (NEEDS_CAMERA.has(nicheId) && cameraUnavailable()) {
    els.module.innerHTML = `
      <p class="t-sub empty">המשימה הזו צריכה מצלמה, והדפדפן הזה לא נותן גישה.<br>
        נסה לפתוח את האתר ב-HTTPS.</p>`;
    els.actions.innerHTML = '<a class="btn btn--secondary btn--block" href="index.html">חזרה לבית</a>';
    return;
  }

  if (MODULES[nicheId]) {
    runModule(nicheId).catch((err) => {
      console.error(err);
      els.module.innerHTML = '<p class="t-sub empty">משהו השתבש בטעינת המשימה.</p>';
    });
    return;
  }

  renderComing();
}

init();
