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

  // "בצע"/"דלג" יושבים על התחנה שבתור, לא בתחתית המסך
  const nicheId = currentTask();
  const task = nicheId
    ? { href: NICHES[nicheId].href, onSkip: onSkip }
    : null;

  // הגלגל מתאים את עצמו לרוחב **ולגובה**, כדי שהמסך יישאר בלי
  // גלילה גם באייפון נמוך (סעיף א6)
  // הגלגל רשאי לחרוג מריפוד המסך — השמות ממילא יושבים עמוק בתוך
  // הריבוע, ולכן ניצול הרוחב המלא רק מגדיל את העיגול
  const size = Math.max(230, Math.min(
    376,
    Math.round(window.innerWidth * 0.96),
    Math.round(window.innerHeight * 0.48),
  ));

  if (!wheel) {
    wheel = createWheel({ size, niches, minutes, task });
    els.wheel.append(wheel);
  } else {
    wheel.update({ niches, minutes, task });
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
    els.next.innerHTML = `
      <a class="btn btn--primary btn--block" href="onboarding.html?edit=1">בחר נישות</a>`;
    return;
  }

  // הסבב מחזורי — תמיד יש משימה הבאה (סעיף ג1)
  if (!nicheId) { els.next.innerHTML = ''; return; }

  const niche = NICHES[nicheId];
  const minutes = roundMinutes(taskValue(nicheId, getProfile() || {}));

  els.next.innerHTML = `
    <p class="nexttask__label">המשימה הבאה</p>
    <p class="nexttask__name">${niche.taskLabel}<span>${minutes} דק׳</span></p>`;
}

/* ------------------------------------------------------------------ */

function renderAll() {
  renderStreak();
  renderWheel();
  renderNext();
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
