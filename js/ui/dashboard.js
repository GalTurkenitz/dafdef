/**
 * dashboard.js — דשבורד (המפרט, סעיף 7.6).
 * טבעת יתרה · היום · גרף 7 ימים · סטריק · ספרים שהתחלת.
 * הגרף הוא SVG שנבנה כאן, בלי שום ספרייה.
 */

import { initTheme } from './theme.js';
import { renderNavbar } from './nav.js';
import { createRing } from './ring.js';
import { icon } from './icons.js';
import { getBank, getReadingState, getStreak, getWeek, getStartedBooks, openDay } from '../logic/store.js';
import * as bank from '../logic/bank.js';

const $ = (s) => document.querySelector(s);

const els = {
  ring:   $('[data-ring-mount]'),
  today:  $('[data-today-stats]'),
  chart:  $('[data-week-chart]'),
  streak: $('[data-streak-stats]'),
  books:  $('[data-books-progress]'),
};

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

/* ------------------------------------------------------------------ */

function renderToday() {
  const reading = getReadingState();
  const week = getWeek();
  const todayRow = week[week.length - 1];

  const cell = (value, label) => `
    <div class="stat">
      <b class="stat__num">${value}</b>
      <span class="t-small">${label}</span>
    </div>`;

  els.today.innerHTML = `
    <h2 class="section__title">היום</h2>
    <div class="card stats-row">
      ${cell(reading.pagesToday || 0, 'עמודים')}
      ${cell(Math.round(todayRow.minutesEarned), 'דקות שנצברו')}
      ${cell(Math.round(todayRow.minutesSpent), 'דקות שנוצלו')}
    </div>`;
}

/**
 * גרף עמודות שבעה ימים. שני עמודים ליום — נצברו מול נוצלו —
 * כי זה מה שבאמת מספר אם אתה במאזן חיובי.
 */
function renderChart() {
  const week = getWeek();
  const max = Math.max(10, ...week.map((d) => Math.max(d.minutesEarned, d.minutesSpent)));

  const W = 320, H = 140, PAD_B = 22;
  const slot = W / week.length;
  const barW = 9;
  const gap = 3;

  const bars = week.map((d, i) => {
    const cx = slot * i + slot / 2;
    const scale = (v) => Math.max(v > 0 ? 3 : 0, ((H - PAD_B) * v) / max);

    const hE = scale(d.minutesEarned);
    const hS = scale(d.minutesSpent);
    const weekday = DAY_LETTERS[new Date(d.date + 'T00:00:00').getDay()];

    return `
      <rect class="bar bar--earned" x="${cx - barW - gap / 2}" y="${H - PAD_B - hE}"
            width="${barW}" height="${hE}" rx="3"></rect>
      <rect class="bar bar--spent"  x="${cx + gap / 2}" y="${H - PAD_B - hS}"
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
    </div>`;
}

function renderBooks() {
  const books = getStartedBooks();

  if (!books.length) {
    els.books.innerHTML = `
      <h2 class="section__title">ספרים שהתחלת</h2>
      <div class="card">
        <p class="t-sub">עוד לא פתחת ספר.</p>
        <a class="btn btn--secondary btn--block" href="library.html"
           style="margin-top: var(--sp-3);">לספרייה</a>
      </div>`;
    return;
  }

  els.books.innerHTML = `
    <h2 class="section__title">ספרים שהתחלת</h2>
    <div class="stack-2">
      ${books.map((b) => {
        const pct = Math.round((b.percent || 0) * 100);
        return `<a class="card book-progress" href="reader.html?work=${encodeURIComponent(b.id)}">
          <div class="row-between">
            <span class="book__title">${b.title || b.id}</span>
            <span class="t-small">${pct}%</span>
          </div>
          ${b.author ? `<span class="t-small">${b.author}</span>` : ''}
          <div class="progress" style="margin-top: var(--sp-2);">
            <i style="inline-size:${pct}%"></i>
          </div>
        </a>`;
      }).join('')}
    </div>`;
}

/* ------------------------------------------------------------------ */

function renderAll() {
  const b = getBank();
  els.ring.innerHTML = '';
  els.ring.append(createRing({ minutes: bank.displayMinutes(b), size: 'lg' }));

  renderToday();
  renderChart();
  renderStreak();
  renderBooks();
}

function init() {
  initTheme();
  openDay();
  renderNavbar('dashboard');
  renderAll();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { openDay(); renderAll(); }
  });
}

init();
