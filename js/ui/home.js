/**
 * home.js — מסך הבית, מסך הנעילה והאפליקציה המדומה
 * (המפרט, סעיפים 9.1, 9.2). כאן נסגרת הלולאה.
 *
 * הלולאה: מבצעים משימה ⇐ צוברים דקות ⇐ פותחים אפליקציה ⇐ הדקות
 * מתנקזות בזמן אמת ⇐ הבנק מתרוקן ⇐ המסך ננעל ⇐ חוזרים למשימה.
 */

import { initTheme } from './theme.js';
import { renderNavbar } from './nav.js';
import { createRing } from './ring.js';
import { icon } from './icons.js';
import { appIcon, appById } from './apps.js';
import { bookCard, newBookCard } from './bookcard.js';
import { toast } from './toast.js';
import { NICHES } from '../config.js';
import { taskValue, roundMinutes } from '../logic/formula.js';
import { getSettings, getProfile, getBank, setBank, getBlockedApps, getStreak,
         addToday, openDay, getStartedBooks, getSelectedNiches,
         currentTask, skipTask, roundStatus, roundProgress } from '../logic/store.js';
import * as rotation from '../logic/rotation.js';
import * as bank from '../logic/bank.js';

const $ = (s) => document.querySelector(s);

const els = {
  ring:   $('[data-ring-mount]'),
  streak: $('[data-streak-mount]'),
  task:   $('[data-task-card]'),
  round:  $('[data-round]'),
  free:   $('[data-free]'),
  apps:   $('[data-apps-grid]'),
  books:  $('[data-my-books]'),
};

const TICK_MS = 1000;

let ring = null;
let session = null;

const now = () => Date.now();

/* ------------------------------------------------------------------ *
 * ראש המסך — סטריק בולט וטבעת הבנק
 * ------------------------------------------------------------------ */

function renderStreak() {
  const { current, best } = getStreak();
  const label = current === 0 ? 'מתחילים רצף'
              : current === 1 ? 'יום ברצף' : 'ימים ברצף';

  els.streak.innerHTML = `
    <div class="streak">
      <span class="streak__flame" aria-hidden="true">🔥</span>
      <span class="streak__num">${current}</span>
      <span class="streak__label">${label}${best > current ? `<br>השיא ${best}` : ''}</span>
    </div>`;
}

function renderRing() {
  const b = getBank();
  if (!ring) {
    ring = createRing({ minutes: bank.displayMinutes(b), size: 'lg' });
    els.ring.append(ring);
  } else {
    ring.update(bank.displayMinutes(b));
  }
}

/* ------------------------------------------------------------------ *
 * כרטיס "המשימה שלי" (המפרט, סעיף 9.1)
 * ------------------------------------------------------------------ */

function renderTaskCard() {
  const nicheId = currentTask();
  const { done, total } = roundProgress();

  if (!total) {
    els.task.innerHTML = `
      <div class="card stack-2">
        <p class="t-sub">עוד לא בחרת נישות.</p>
        <a class="btn btn--secondary btn--block" href="onboarding.html?edit=1">לבחירה</a>
      </div>`;
    return;
  }

  // הסבב הושלם — אין משימה הבאה
  if (!nicheId) {
    els.task.innerHTML = `
      <div class="card taskcard taskcard--done">
        <span class="taskcard__icon">${icon('check', 26)}</span>
        <div class="taskcard__body">
          <b>הסבב הושלם</b>
          <span class="t-small">${done} מתוך ${total}. מכאן הכל פתוח — קח עוד כמה שבא לך.</span>
        </div>
      </div>`;
    return;
  }

  const niche = NICHES[nicheId];
  const minutes = roundMinutes(taskValue(nicheId, getProfile() || {}));

  els.task.innerHTML = `
    <div class="home__section"><h2>המשימה שלי</h2></div>
    <div class="card taskcard">
      <span class="taskcard__icon">${icon(niche.icon, 26)}</span>
      <div class="taskcard__body">
        <b>${niche.taskLabel}</b>
        <span class="t-small">${niche.name} · שווה <b>${minutes}</b> דקות</span>
      </div>
      <div class="taskcard__actions">
        <a class="btn btn--primary" href="${niche.href}">בצע</a>
        <button class="btn btn--ghost" data-skip>דלג</button>
      </div>
    </div>`;

  els.task.querySelector('[data-skip]')?.addEventListener('click', () => {
    skipTask(nicheId);
    renderTaskCard();
    renderRound();
    const next = currentTask();
    if (next) toast(`דחינו. הבאה בתור: ${NICHES[next].name}`);
  });
}

/* ------------------------------------------------------------------ *
 * מחוון הסבב היומי
 * ------------------------------------------------------------------ */

function renderRound() {
  const status = roundStatus();
  if (!status.length) { els.round.innerHTML = ''; return; }

  const { done, total } = roundProgress();

  els.round.innerHTML = `
    <div class="home__section">
      <h2>הסבב היומי</h2>
      <span class="t-small">${done}/${total}</span>
    </div>
    <div class="roundbar">
      ${status.map((n) => `
        <span class="roundbar__item${n.done ? ' is-done' : ''}${n.current ? ' is-current' : ''}"
              title="${n.name}">
          <span class="roundbar__icon">${n.done ? icon('check', 18) : icon(n.icon, 18)}</span>
          <span class="roundbar__name">${n.name}</span>
        </span>`).join('')}
    </div>`;
}

/* ------------------------------------------------------------------ *
 * הערוץ החופשי — תמיד פתוח
 * ------------------------------------------------------------------ */

function renderFree() {
  const free = rotation.freeNiches(getSelectedNiches());
  if (!free.length) { els.free.innerHTML = ''; return; }

  const profile = getProfile() || {};

  els.free.innerHTML = `
    <div class="home__section">
      <h2>תמיד פתוח</h2>
      <span class="t-small">בלי קשר לסבב</span>
    </div>
    <div class="freegrid">
      ${free.map((id) => {
        const n = NICHES[id];
        return `<a class="freecard" href="${n.href}">
          <span class="freecard__icon">${icon(n.icon, 22)}</span>
          <span class="freecard__name">${n.name}</span>
          <span class="freecard__value">${roundMinutes(taskValue(id, profile))} דק׳</span>
        </a>`;
      }).join('')}
    </div>`;
}

/* ------------------------------------------------------------------ *
 * האפליקציות החסומות
 * ------------------------------------------------------------------ */

function renderApps() {
  const apps = getBlockedApps();
  const locked = bank.isEmpty(getBank());

  if (!apps.length) {
    els.apps.innerHTML = `<p class="t-sub" style="text-align:center;">
      עוד לא בחרת אפליקציות לחסימה.<br>
      <a href="onboarding.html?step=apps">לבחירה</a></p>`;
    return;
  }

  els.apps.innerHTML = `
    <div class="home__section"><h2>נעול עד שתרוויח</h2></div>
    <div class="appgrid">${apps.map((a) => `
      <button class="appcell" data-open="${a.id}" aria-pressed="false">
        ${appIcon(a.icon || a.id)}
        <span class="appcell__name">${a.name}</span>
        ${locked ? `<span class="appcell__lock">${icon('lock', 13)}</span>` : ''}
      </button>`).join('')}</div>`;

  els.apps.querySelectorAll('[data-open]').forEach((cell) => {
    cell.addEventListener('click', () => openApp(cell.dataset.open));
  });
}

/* ------------------------------------------------------------------ *
 * הספרים שלי
 * ------------------------------------------------------------------ */

function renderMyBooks() {
  if (!getSelectedNiches().includes('reading')) { els.books.innerHTML = ''; return; }

  const books = getStartedBooks().filter((b) => !b.finished).slice(0, 5);
  if (!books.length) { els.books.innerHTML = ''; return; }

  els.books.innerHTML = `
    <div class="home__section">
      <h2>הספרים שלי</h2>
      <a href="library.html">לספרייה</a>
    </div>
    <div class="bookgrid">
      ${books.map((b) => bookCard(b, { percent: b.percent ?? 0 })).join('')}
      ${newBookCard()}
    </div>`;
}

/* ------------------------------------------------------------------ *
 * מסך הנעילה (המפרט, סעיף 9.2)
 * ------------------------------------------------------------------ */

function showLock() {
  if ($('.lock')) return;

  const nicheId = currentTask();
  const profile = getProfile() || {};

  // מציג את המשימה הנוכחית בסבב, לא יחס קריאה קבוע
  const line = nicheId
    ? `המשימה שלך: ${NICHES[nicheId].taskLabel} = ${roundMinutes(taskValue(nicheId, profile))} דקות`
    : 'הסבב הושלם היום — כל משימה פתוחה שוב';

  const href = nicheId ? NICHES[nicheId].href : 'index.html';

  const panel = document.createElement('div');
  panel.className = 'lock screen-in';
  panel.innerHTML = `
    <div class="lock__icon">${icon('lock', 44)}</div>
    <h1 class="lock__title">האפליקציה נעולה</h1>
    <p class="lock__sub">אין לך דקות בבנק.</p>
    <p class="lock__ratio">${line}</p>
    <div class="lock__actions">
      <a class="btn btn--primary btn--block" href="${href}">${nicheId ? 'למשימה' : 'לערוץ החופשי'}</a>
      ${nicheId ? '<a class="btn btn--ghost" href="#" data-lock-free>לערוץ החופשי</a>' : ''}
      <button class="btn btn--ghost" data-lock-back>חזרה</button>
    </div>`;

  document.body.appendChild(panel);
  panel.querySelector('[data-lock-back]').addEventListener('click', () => panel.remove());
  panel.querySelector('[data-lock-free]')?.addEventListener('click', (e) => {
    e.preventDefault();
    panel.remove();
    els.free.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* ------------------------------------------------------------------ *
 * האפליקציה המדומה
 * ------------------------------------------------------------------ */

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function openApp(appId) {
  const app = appById(appId) || { id: appId, name: appId };
  if (bank.isEmpty(getBank())) { showLock(); return; }

  // מקדמים את השעון בלי לנקז, אחרת כל הזמן שעבר מאז ייזקף עכשיו
  setBank(bank.touch(getBank(), now()));

  const overlay = document.createElement('div');
  overlay.className = 'fakeapp screen-in';
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
    overlay.classList.toggle('is-ending', next.minutes < 1);

    if (emptied || bank.isEmpty(next)) { closeApp(); showLock(); }
  };

  clock.textContent = formatClock(bank.remainingMs(getBank()));
  const timer = setInterval(tick, TICK_MS);

  session = { timer, overlay, flush: () => {
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

  setBank(bank.touch(getBank(), now()));
  renderAll();
}

/* ------------------------------------------------------------------ *
 * מיקרו-קופי
 * ------------------------------------------------------------------ */

function dayMessages(rollover) {
  if (rollover.streakBroke) toast('מתחילים רצף חדש היום', 2800);
  else if (rollover.bankReset) toast('יום חדש, סבב חדש. מתחילים?', 2800);
  else if (bank.isEmpty(getBank())) toast('נגמרו הדקות — משימה אחת ואתה בפנים', 2800);
}

/* ------------------------------------------------------------------ */

function renderAll() {
  renderStreak();
  renderRing();
  renderTaskCard();
  renderRound();
  renderFree();
  renderApps();
  renderMyBooks();
}

function init() {
  initTheme();

  if (!getSettings().onboardingDone) { location.replace('onboarding.html'); return; }

  const rollover = openDay();
  renderNavbar('home');
  renderAll();
  dayMessages(rollover);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    openDay();
    if (!session) setBank(bank.touch(getBank(), now()));
    renderAll();
  });

  window.addEventListener('pageshow', () => { openDay(); renderAll(); });

  window.addEventListener('pagehide', () => {
    if (!session) return;
    const { bank: next } = bank.drain(getBank(), now());
    setBank(next);
    session.flush();
  });
}

init();
