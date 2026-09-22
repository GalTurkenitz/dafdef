/**
 * home.js — מסך הבית (V3, סעיף א).
 *
 * מסך אחד בלי גלילה: רצף השלמת הסבבים למעלה, גלגל הסבב באמצע,
 * והמשימה הבאה למטה עם "בצע" ו"דלג".
 *
 * אין כאן אפליקציות חסומות (ירדו לחלוטין, סעיף א1) ואין כניסה
 * חופשית לנישות — הערוץ החופשי חי בעמוד ההתקדמות (סעיף א5).
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountMenu } from './nav.js';
import { createWheel } from './wheel.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { NICHES } from '../config.js';
import { taskValue, roundMinutes } from '../logic/formula.js';
import { getSettings, getProfile, getBank, getStreak, openDay,
         currentTask, skipTask, roundStatus, roundProgress } from '../logic/store.js';
import * as bank from '../logic/bank.js';

const $ = (s) => document.querySelector(s);

const els = {
  streak: $('[data-streak-mount]'),
  wheel:  $('[data-wheel-mount]'),
  next:   $('[data-next-task]'),
};

let wheel = null;

/* ------------------------------------------------------------------ *
 * רצף השלמת הסבבים (סעיף א6) — בלי אימוג'י
 * ------------------------------------------------------------------ */

function renderStreak() {
  const { current } = getStreak();
  const label = current === 1 ? 'יום ברצף' : 'ימים ברצף';

  els.streak.innerHTML = `
    <div class="streak">
      <span class="streak__icon">${icon('flag', 22)}</span>
      <span class="streak__num">${current}</span>
      <span class="streak__label">${current === 0 ? 'מתחילים רצף' : label}</span>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * הגלגל
 * ------------------------------------------------------------------ */

function renderWheel() {
  const niches = roundStatus();
  const minutes = bank.displayMinutes(getBank());

  // הגלגל ממלא את כל השטח שנשאר לו. הלוח אינו ריבועי בכוונה:
  // כך הטבעת נדחפת עד רוחב המסך ומתרחקת ממספר הדקות שבמרכז.
  const box = els.wheel.parentElement.getBoundingClientRect();
  const width = Math.max(240, Math.round(box.width));
  const height = Math.max(200, Math.round(box.height));

  if (!wheel) {
    wheel = createWheel({ width, height, niches, minutes });
    els.wheel.append(wheel);
  } else {
    wheel.update({ niches, minutes });
  }
}

/** דילוג — דוחה את המשימה לסוף התור (חוקי הרוטציה הקיימים) */
function onSkip(nicheId) {
  skipTask(nicheId);
  renderAll();
  const next = currentTask();
  if (next) toast(`נדחה להמשך היום. עכשיו: ${NICHES[next].name}`);
}

/* ------------------------------------------------------------------ *
 * המשימה הבאה
 * ------------------------------------------------------------------ */

function renderNext() {
  const nicheId = currentTask();
  const { total } = roundProgress();

  if (!total) {
    els.next.className = 'nexttask';
    els.next.innerHTML = `
      <a class="btn btn--primary btn--block" href="onboarding.html?edit=1">בחר נישות</a>`;
    return;
  }

  // הסבב מחזורי — תמיד יש משימה הבאה (סעיף ג1)
  if (!nicheId) { els.next.innerHTML = ''; return; }

  const niche = NICHES[nicheId];
  const minutes = roundMinutes(taskValue(nicheId, getProfile() || {}));

  // שם הנישה, ומיד מתחתיו שני הכפתורים
  els.next.className = 'nexttask';
  els.next.innerHTML = `
    <p class="nexttask__label">המשימה הבאה: <b>${niche.name}</b></p>
    <p class="nexttask__name">${niche.taskLabel}<span>${minutes} דק׳</span></p>
    <div class="nexttask__actions">
      <a class="btn btn--primary" href="${niche.href}">בצע</a>
      <button class="btn btn--secondary" type="button" data-skip>דלג</button>
    </div>`;

  els.next.querySelector('[data-skip]').addEventListener('click', () => onSkip(nicheId));
}

/* ------------------------------------------------------------------ */

function renderAll() {
  renderStreak();
  renderNext();
  // הגלגל אחרון: הוא מודד את השטח שנותר אחרי שני האחרים
  renderWheel();
}

function init() {
  initTheme();

  if (!getSettings().onboardingDone) { location.replace('onboarding.html'); return; }

  openDay();
  renderNavbar('home');
  mountMenu();
  renderAll();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { openDay(); renderAll(); }
  });

  window.addEventListener('pageshow', () => { openDay(); renderAll(); });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { wheel = null; els.wheel.innerHTML = ''; renderAll(); }, 200);
  });
}

init();
