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
         currentTask, skipTask, roundStatus, roundProgress,
         startNewRound, roundDoneToday, getLevelState } from '../logic/store.js';
import * as bank from '../logic/bank.js';

const $ = (s) => document.querySelector(s);

const els = {
  streak:  $('[data-streak-mount]'),
  soloTop: $('[data-solo-top]'),
  wheel:   $('[data-wheel-mount]'),
  next:    $('[data-next-task]'),
};

let wheel = null;

/* ------------------------------------------------------------------ *
 * רצף השלמת הסבבים (סעיף א6)
 * ------------------------------------------------------------------ */

function renderStreak() {
  const { current } = getStreak();

  /* החיווי דולק רק אחרי שהושלמו כל משימות היום: עד אז הלהבה
     אפורה וכבויה, וברגע שהסבב נסגר היא נדלקת בכתום.

     זה אייקון SVG ולא אימוג׳י בדיוק בשביל זה — אימוג׳י נושא צבע
     משלו ותמיד נראה בוער, ואי אפשר לכבות אותו בלי להפוך אותו
     לכתם אפור. */
  const lit = roundDoneToday();

  /* לצד הרצף — הרמה. שני חיוויים באותו סגנון: אחד על היום,
     אחד על כל הדרך. */
  const lv = getLevelState();

  els.streak.innerHTML = `
    <div class="streak${lit ? ' is-lit' : ''}">
      <span class="streak__icon">${icon('flame', 16)}</span>
      <span class="streak__word">רצף</span>
      <span class="streak__num">${current}</span>
    </div>
    <button class="streak streak--level" type="button" data-level-chip
            aria-label="רמה ${lv.level}">
      <span class="streak__word">רמה</span>
      <span class="streak__num">${lv.level}</span>
    </button>`;

  els.streak.querySelector('[data-level-chip]')
    .addEventListener('click', () => openLevelSheet(lv));
}

/** חלון קטן: כמה נקודות יש, וכמה חסר לרמה הבאה (סעיף 1.5) */
function openLevelSheet(lv) {
  const sheet = document.createElement('div');
  sheet.className = 'levelsheet';
  sheet.innerHTML = `
    <div class="levelsheet__scrim" data-close></div>
    <div class="levelsheet__panel" role="dialog" aria-modal="true" aria-label="רמה ${lv.level}">
      <span class="levelsheet__badge">${lv.level}</span>
      <h2 class="levelsheet__title">רמה ${lv.level}</h2>
      <p class="levelsheet__sub">${lv.xp.toLocaleString('he')} נקודות בסך הכל</p>

      <div class="levelbar" role="progressbar"
           aria-valuenow="${lv.into}" aria-valuemin="0" aria-valuemax="${lv.need}">
        <i style="inline-size:${Math.round(lv.ratio * 100)}%"></i>
      </div>
      <p class="t-small">עוד ${(lv.need - lv.into).toLocaleString('he')} נקודות לרמה ${lv.level + 1}</p>

      <button class="btn btn--ghost btn--block" type="button" data-close>סגירה</button>
    </div>`;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('is-open'));

  const close = () => {
    sheet.classList.remove('is-open');
    setTimeout(() => sheet.remove(), 200);
  };
  sheet.querySelectorAll('[data-close]').forEach((e) => e.addEventListener('click', close));
}

/* ------------------------------------------------------------------ *
 * הגלגל
 * ------------------------------------------------------------------ */

/**
 * אזור הגלגל.
 *
 * עם נישה אחת אין ממה לבנות גלגל — תחנה בודדת על מעגל אינה
 * מסלול. במקרה הזה המסך מסודר אחרת: עיגול הדקות למעלה, המשימה
 * הבאה מתחתיו, ותמונת הנישה כריבוע גדול בתחתית.
 */
function renderWheel() {
  const niches = roundStatus();
  const minutes = bank.displayMinutes(getBank());

  if (niches.length === 1) { renderSolo(niches[0], minutes); return; }

  els.soloTop.innerHTML = '';
  els.wheel.classList.remove('home__solo-square');

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

/**
 * פריסת נישה יחידה: עיגול דקות בתוך טבעת חומה למעלה, ותמונת
 * הנישה כריבוע גדול למטה. "המשימה הבאה" יושבת ביניהם, כי היא
 * מחברת בין מה שצברת לבין מה שעושים עכשיו.
 *
 * הטבעת היא מסגרת ולא מד: אין תקרה לדקות, ולכן אין אחוז למלא.
 */
function renderSolo(niche, minutes) {
  wheel = null;
  els.wheel.innerHTML = '';
  els.wheel.classList.add('home__solo-square');

  /* טבעת שלמה, לא מד התקדמות: אין תקרה לדקות שאפשר לצבור, ולכן
     אין מה למלא. המספר הוא שעולה. */
  els.soloTop.innerHTML = `
    <div class="solo-ring">
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
        <circle class="solo-ring__line" cx="60" cy="60" r="52" fill="none" stroke-width="8"/>
      </svg>
      <span class="solo-ring__center">
        <b>${Math.floor(minutes)}</b>
        <small>דקות</small>
      </span>
    </div>`;

  els.wheel.innerHTML = `
    <div class="solo-square solo-square--${niche.id}"
         style="--photo:url('/content/img/niches/${niche.id}.webp')">
      <span class="solo-square__name">${niche.name}</span>
    </div>`;
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

  /* הסבב מחזורי ולכן תמיד יש משימה הבאה (סעיף ג1), ו-normalize
     מרפא מצב סבב תקוע. אם בכל זאת הגענו לכאן — לא משאירים מסך
     בלי מוצא: זו בדיוק התקלה שבה המשתמש ראה גלגל בלי כפתורים
     ובלי שום דרך להמשיך. */
  if (!nicheId) {
    els.next.className = 'nexttask';
    els.next.innerHTML = `
      <p class="nexttask__label">סיימת את הסבב של היום</p>
      <div class="nexttask__actions">
        <button class="btn btn--primary btn--block" type="button" data-new-round>
          התחל סבב חדש
        </button>
      </div>`;
    els.next.querySelector('[data-new-round]').addEventListener('click', () => {
      startNewRound();
      renderAll();
    });
    return;
  }

  const niche = NICHES[nicheId];
  const minutes = roundMinutes(taskValue(nicheId, getProfile() || {}));

  // שם הנישה, ומיד מתחתיו שני הכפתורים
  els.next.className = 'nexttask';
  els.next.innerHTML = `
    <p class="nexttask__label">
      המשימה הבאה: <b>${niche.name}</b>
      <span class="nexttask__detail">${niche.taskLabel} · ${minutes} דק׳</span>
    </p>
    <div class="nexttask__actions">
      <a class="btn btn--primary" href="${niche.href}">בצע</a>
      <button class="btn btn--secondary" type="button" data-skip>דלג</button>
    </div>`;

  els.next.querySelector('[data-skip]').addEventListener('click', () => onSkip(nicheId));
}

/* ------------------------------------------------------------------ */

/**
 * כל אזור מרונדר בנפרד. קודם, נפילה ב-renderNext הייתה מוחקת
 * את הכפתורים בשקט והמסך היה נראה תקין חוץ מהם — בדיוק סוג
 * התקלה שאי אפשר לאבחן מרחוק. עכשיו כל אזור עומד בפני עצמו,
 * וכישלון מגיע למסך במקום להיעלם.
 */
function safely(what, fn) {
  try {
    fn();
  } catch (err) {
    console.error(what, err);
    if (window.DAFDEF_FAIL) window.DAFDEF_FAIL(what, err && err.message ? err.message : String(err));
  }
}

function renderAll() {
  safely('רצף', renderStreak);
  safely('המשימה הבאה', renderNext);
  // הגלגל אחרון: הוא מודד את השטח שנותר אחרי שני האחרים
  safely('גלגל', renderWheel);
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
