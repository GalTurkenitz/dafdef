/**
 * home.js — מסך הבית, מסך הנעילה והאפליקציה המדומה
 * (המפרט, סעיפים 7.3, 7.4). כאן נסגרת הלולאה.
 *
 * הלולאה: קוראים ⇐ צוברים דקות ⇐ פותחים אפליקציה ⇐ הדקות מתנקזות
 * בזמן אמת ⇐ הבנק מתרוקן ⇐ המסך ננעל ⇐ חוזרים לקרוא.
 */

import { initTheme } from './theme.js';
import { renderNavbar } from './nav.js';
import { createRing } from './ring.js';
import { icon } from './icons.js';
import { appIcon, appById } from './apps.js';
import { toast } from './toast.js';
import { getSettings, getBank, setBank, getBlockedApps, getStreak,
         addToday, openDay } from '../logic/store.js';
import * as bank from '../logic/bank.js';

const $ = (s) => document.querySelector(s);

const els = {
  ring:   $('[data-ring-mount]'),
  streak: $('[data-streak-mount]'),
  apps:   $('[data-apps-grid]'),
  screen: $('.screen'),
};

const TICK_MS = 1000;

let ring = null;
let session = null;    // { appId, timer, overlay } כשאפליקציה מדומה פתוחה

const now = () => Date.now();

/* ------------------------------------------------------------------ *
 * מסך הבית
 * ------------------------------------------------------------------ */

function renderRing() {
  const b = getBank();
  if (!ring) {
    ring = createRing({ minutes: bank.displayMinutes(b), size: 'lg' });
    els.ring.append(ring);
  } else {
    ring.update(bank.displayMinutes(b));
  }
  return b;
}

function renderStreak() {
  const { current } = getStreak();
  els.streak.innerHTML = `<span class="chip chip--streak">${icon('flame', 16)} ${current}</span>`;
}

function renderApps() {
  const apps = getBlockedApps();
  const locked = bank.isEmpty(getBank());

  if (!apps.length) {
    els.apps.innerHTML = `<p class="t-sub" style="text-align:center;">
      עוד לא בחרת אפליקציות לחסימה.<br>
      <a href="onboarding.html">לבחירה</a></p>`;
    return;
  }

  els.apps.innerHTML = `<div class="appgrid">${apps.map((a) => `
    <button class="appcell" data-open="${a.id}" aria-pressed="false">
      ${appIcon(a.icon || a.id)}
      <span class="appcell__name">${a.name}</span>
      ${locked ? `<span class="appcell__lock">${icon('lock', 13)}</span>` : ''}
    </button>`).join('')}</div>`;

  els.apps.querySelectorAll('[data-open]').forEach((cell) => {
    cell.addEventListener('click', () => openApp(cell.dataset.open));
  });
}

function renderAll() {
  renderRing();
  renderStreak();
  renderApps();
}

/* ------------------------------------------------------------------ *
 * מסך הנעילה (המפרט, סעיף 7.4)
 * ------------------------------------------------------------------ */

function showLock() {
  if ($('.lock')) return;

  const { pageValueMinutes } = getSettings();

  const panel = document.createElement('div');
  panel.className = 'lock screen-in';
  panel.innerHTML = `
    <div class="lock__icon">${icon('lock', 44)}</div>
    <h1 class="lock__title">האפליקציה נעולה</h1>
    <p class="lock__sub">אין לך דקות בבנק.</p>
    <p class="lock__ratio">עמוד אחד = ${pageValueMinutes} דקות</p>
    <div class="lock__actions">
      <a class="btn btn--primary btn--block" href="reader.html">לקריאה</a>
      <button class="btn btn--ghost" data-lock-back>חזרה</button>
    </div>`;

  document.body.appendChild(panel);
  panel.querySelector('[data-lock-back]').addEventListener('click', () => panel.remove());
}

/* ------------------------------------------------------------------ *
 * האפליקציה המדומה (המפרט, סעיף 7.3)
 * ------------------------------------------------------------------ */

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function openApp(appId) {
  const app = appById(appId) || { id: appId, name: appId };

  if (bank.isEmpty(getBank())) { showLock(); return; }

  // מקדמים את השעון בלי לנקז, אחרת כל הזמן שעבר מאז הפעם הקודמת ייזקף עכשיו
  setBank(bank.touch(getBank(), now()));

  const overlay = document.createElement('div');
  overlay.className = 'fakeapp screen-in';
  overlay.dataset.app = app.id;
  overlay.innerHTML = `
    <div class="fakeapp__top">${appIcon(app.id, 64)}<span class="fakeapp__name">${app.name}</span></div>
    <div class="fakeapp__clock" data-clock>0:00</div>
    <p class="fakeapp__label">דקות שנשארו</p>
    <button class="btn btn--secondary" data-exit>יציאה</button>`;

  document.body.appendChild(overlay);

  const clock = overlay.querySelector('[data-clock]');
  let spentAccum = 0;

  const tick = () => {
    const { bank: next, spent, emptied } = bank.drain(getBank(), now());
    setBank(next);

    spentAccum += spent;
    clock.textContent = formatClock(bank.remainingMs(next));
    ring?.update(bank.displayMinutes(next));

    // מתחת לדקה — חיווי אדום עדין
    overlay.classList.toggle('is-ending', next.minutes < 1);

    if (emptied || bank.isEmpty(next)) {
      closeApp();
      showLock();
    }
  };

  clock.textContent = formatClock(bank.remainingMs(getBank()));
  const timer = setInterval(tick, TICK_MS);

  session = { appId: app.id, timer, overlay, flush: () => {
    if (spentAccum > 0) addToday({ minutesSpent: Math.round(spentAccum) });
    spentAccum = 0;
  } };

  overlay.querySelector('[data-exit]').addEventListener('click', () => closeApp());
}

function closeApp() {
  if (!session) return;

  clearInterval(session.timer);
  session.flush();
  session.overlay.remove();
  session = null;

  // השעון מתקדם בלי ניקוז — האפליקציה סגורה
  setBank(bank.touch(getBank(), now()));
  renderAll();
}

/* ------------------------------------------------------------------ *
 * מיקרו-קופי (המפרט, סעיף 8)
 * ------------------------------------------------------------------ */

function dayMessages(rollover) {
  if (rollover.streakBroke) toast('מתחילים רצף חדש היום', 2800);
  else if (rollover.bankReset) toast('יום חדש, דף חלק. עמוד ראשון?', 2800);
  else if (bank.isEmpty(getBank())) toast('נגמרו הדקות — עמוד אחד ואתה בפנים', 2800);
}

/* ------------------------------------------------------------------ */

function init() {
  initTheme();

  // מי שלא ענה על השאלון מתחיל משם (המפרט, סעיף 7.2: סיום ⇐ מסך הבית)
  if (!getSettings().onboardingDone) { location.replace('onboarding.html'); return; }

  const rollover = openDay();
  renderNavbar('home');
  renderAll();
  dayMessages(rollover);

  // חזרה לאפליקציה: מעדכנים חצות, ומנקזים את מה שרץ ברקע אם אפליקציה פתוחה
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    openDay();
    if (!session) setBank(bank.touch(getBank(), now()));
    renderAll();
  });

  window.addEventListener('pageshow', () => { openDay(); renderAll(); });

  // סגירת טאב באמצע שימוש באפליקציה — רושמים את הדקות שנוצלו לפני שנעלמים
  window.addEventListener('pagehide', () => {
    if (!session) return;
    const { bank: next } = bank.drain(getBank(), now());
    setBank(next);
    session.flush();
  });
}

init();
