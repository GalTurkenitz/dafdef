/**
 * dashboard.js — דשבורד (המפרט, סעיף 9.4).
 *
 * טבעת יתרה · הסבב היומי · פירוט היום לפי נישה · גרף שבעה ימים ·
 * סטריק · ספרים בקריאה. הגרף הוא SVG שנבנה כאן, בלי שום ספרייה.
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountBack } from './nav.js';
import { createRing } from './ring.js';
import { icon } from './icons.js';
import { bookCard } from './bookcard.js';
import { NICHES } from '../config.js';
import { roundMinutes } from '../logic/formula.js';
import { getBank, getReadingState, getStreak, getWeek, getStartedBooks,
         getSettings, getNicheToday, roundStatus, roundProgress,
         getBackground, settleBackground, openDay } from '../logic/store.js';
import * as bank from '../logic/bank.js';

const $ = (s) => document.querySelector(s);

const els = {
  ring:   $('[data-ring-mount]'),
  round:  $('[data-round]'),
  today:  $('[data-today-stats]'),
  niches: $('[data-niche-breakdown]'),
  chart:  $('[data-week-chart]'),
  streak: $('[data-streak-stats]'),
  books:  $('[data-books-progress]'),
};

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/* ------------------------------------------------------------------ */

function renderRing() {
  const b = getBank();
  els.ring.innerHTML = '';
  els.ring.append(createRing({ minutes: bank.displayMinutes(b), size: 'lg' }));
}

function renderRound() {
  const status = roundStatus();
  if (!status.length) { els.round.innerHTML = ''; return; }

  const { done, total } = roundProgress();

  els.round.innerHTML = `
    <div class="home__section">
      <h2 class="section__title" style="margin:0;">הסבב היומי</h2>
      <span class="t-small">${done}/${total}</span>
    </div>
    <div class="roundbar">
      ${status.map((n) => `
        <span class="roundbar__item${n.done ? ' is-done' : ''}${n.current ? ' is-current' : ''}">
          <span class="roundbar__icon">${n.done ? icon('check', 18) : icon(n.icon, 18)}</span>
          <span class="roundbar__name">${n.name}</span>
        </span>`).join('')}
    </div>`;
}

function renderToday() {
  const reading = getReadingState();
  const week = getWeek();
  const row = week[week.length - 1];

  const cell = (value, label) => `
    <div class="stat"><b class="stat__num">${value}</b><span class="t-small">${label}</span></div>`;

  els.today.innerHTML = `
    <h2 class="section__title">היום</h2>
    <div class="card stats-row">
      ${cell(reading.pagesToday || 0, 'עמודים')}
      ${cell(Math.round(row.minutesEarned), 'דקות שנצברו')}
      ${cell(Math.round(row.minutesSpent), 'דקות שנוצלו')}
    </div>`;
}

/** פירוט היום לפי נישה — כמה הרוויח מכל אחת (המפרט, סעיף 9.4) */
function renderNicheBreakdown() {
  const perNiche = getNicheToday();
  const rows = Object.entries(perNiche)
    .filter(([, min]) => min > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!rows.length) {
    els.niches.innerHTML = `
      <h2 class="section__title">מאיפה הגיעו הדקות</h2>
      <div class="card"><p class="t-sub">עוד לא הרווחת היום.</p></div>`;
    return;
  }

  const max = Math.max(...rows.map(([, m]) => m));

  els.niches.innerHTML = `
    <h2 class="section__title">מאיפה הגיעו הדקות</h2>
    <div class="card stack-2">
      ${rows.map(([id, minutes]) => {
        const n = NICHES[id];
        return `<div class="nicherow">
          <span class="nicherow__icon">${icon(n?.icon || 'target', 18)}</span>
          <span class="nicherow__name">${n?.name || id}</span>
          <span class="nicherow__bar"><i style="inline-size:${(minutes / max) * 100}%"></i></span>
          <b class="nicherow__num">${roundMinutes(minutes)}</b>
        </div>`;
      }).join('')}
    </div>`;
}

/** גרף שבעה ימים — נצברו מול נוצלו */
function renderChart() {
  const week = getWeek();
  const max = Math.max(10, ...week.map((d) => Math.max(d.minutesEarned, d.minutesSpent)));

  const W = 320, H = 140, PAD_B = 22;
  const slot = W / week.length;
  const barW = 9, gap = 3;

  const bars = week.map((d, i) => {
    const cx = slot * i + slot / 2;
    const scale = (v) => Math.max(v > 0 ? 3 : 0, ((H - PAD_B) * v) / max);
    const hE = scale(d.minutesEarned);
    const hS = scale(d.minutesSpent);
    const weekday = DAY_LETTERS[new Date(d.date + 'T00:00:00').getDay()];

    return `
      <rect class="bar bar--earned" x="${cx - barW - gap / 2}" y="${H - PAD_B - hE}"
            width="${barW}" height="${hE}" rx="3"></rect>
      <rect class="bar bar--spent" x="${cx + gap / 2}" y="${H - PAD_B - hS}"
            width="${barW}" height="${hS}" rx="3"></rect>
      <text class="bar__label" x="${cx}" y="${H - 6}" text-anchor="middle">${weekday}</text>`;
  }).join('');

  const total = week.reduce((a, d) => a + d.minutesEarned, 0);

  els.chart.innerHTML = `
    <h2 class="section__title">שבעה ימים אחרונים</h2>
    <div class="card">
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
           aria-label="דקות שנצברו ונוצלו בשבעת הימים האחרונים">
        <line class="chart__base" x1="0" y1="${H - PAD_B}" x2="${W}" y2="${H - PAD_B}"></line>
        ${bars}
      </svg>
      <div class="legend">
        <span><i class="dot dot--earned"></i>נצברו</span>
        <span><i class="dot dot--spent"></i>נוצלו</span>
        <span class="t-small" style="margin-inline-start:auto;">${Math.round(total)} דק׳ השבוע</span>
      </div>
    </div>`;
}

function renderStreak() {
  const { current, best } = getStreak();

  els.streak.innerHTML = `
    <h2 class="section__title">רצף</h2>
    <div class="card stats-row">
      <div class="stat">
        <b class="stat__num stat__num--accent">${icon('flame', 26)}${current}</b>
        <span class="t-small">רצף נוכחי</span>
      </div>
      <div class="stat">
        <b class="stat__num">${best}</b>
        <span class="t-small">השיא שלך</span>
      </div>
    </div>
    <p class="t-small" style="text-align:center; margin-top: var(--sp-2);">
      יום נספר ברצף כשמשלימים סבב מלא</p>`;
}

function renderBooks() {
  const books = getStartedBooks();
  if (!books.length) { els.books.innerHTML = ''; return; }

  els.books.innerHTML = `
    <h2 class="section__title">ספרים שהתחלת</h2>
    <div class="bookgrid">
      ${books.map((b) => bookCard(b, { percent: b.percent ?? 0 })).join('')}
    </div>`;
}

/* ------------------------------------------------------------------ */

function renderAll() {
  renderRing();
  renderRound();
  renderToday();
  renderNicheBreakdown();
  renderChart();
  renderStreak();
  renderBooks();

  const ratio = document.createElement('a');
  ratio.className = 'ratio-chip';
  ratio.href = 'onboarding.html?edit=1';
  ratio.innerHTML = '<span>השערים שלך</span><span class="t-small">מהשאלון</span>';
  els.ring.append(ratio);
}

function init() {
  initTheme();
  openDay();

  // צעדים ושינה שנצברו ברקע משולמים בכניסה למסך
  settleBackground();

  renderNavbar('dashboard');
  mountBack('index.html');
  renderAll();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { openDay(); settleBackground(); renderAll(); }
  });
}

init();
