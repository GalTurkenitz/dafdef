/**
 * library.js — מסך הספרייה (המפרט, סעיף 6).
 *
 * חיפוש הוא הרכיב המרכזי כאן: המשתמש מחפש ספר ומוצא אותו.
 * בנוסף סינון לפי מחבר וסוגה. לחיצה על ספר פותחת אותו מיד בקורא.
 */

import { initTheme } from './theme.js';
import { renderNavbar } from './nav.js';
import { icon } from './icons.js';
import { getReadingState } from '../logic/store.js';

const $ = (s) => document.querySelector(s);

const els = {
  search:  $('[data-library-search]'),
  filters: $('[data-library-filters]'),
  list:    $('[data-library-list]'),
  count:   $('[data-library-count]'),
};

let books = [];
let query = '';
let filter = { type: 'all', value: null };   // all | author | genre

/* ------------------------------------------------------------------ *
 * חיפוש
 * ------------------------------------------------------------------ */

/**
 * נרמול לחיפוש: מוריד ניקוד, גרשיים ומקף, כדי ש"קאצענעלסאן"
 * ו"קצנלסון" או "ביאליק" עם ובלי ניקוד יימצאו אותו דבר.
 */
function norm(s) {
  return String(s || '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'׳״־-]/g, '')
    .toLowerCase()
    .trim();
}

function matches(book, q) {
  if (!q) return true;
  const hay = norm(`${book.title} ${book.author} ${book.genre}`);
  // כל מילה בשאילתה צריכה להופיע — מאפשר "ביאליק פרוזה"
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/* ------------------------------------------------------------------ *
 * תצוגה
 * ------------------------------------------------------------------ */

function timeLabel(minutes) {
  if (minutes < 60) return `${minutes} דק׳`;
  const h = Math.round(minutes / 60);
  return h === 1 ? 'כשעה' : `כ-${h} שעות`;
}

function bookCard(book, continueFrom) {
  const parts = [`<span>${book.author}</span>`, `<span>${timeLabel(book.estMinutes)}</span>`];
  if (book.chapters > 1) parts.push(`<span>${book.chapters} פרקים</span>`);

  return `<a class="book" href="reader.html?work=${encodeURIComponent(book.id)}">
    <span class="book__spine" aria-hidden="true"></span>
    <span class="book__body">
      <span class="book__title">${book.title}</span>
      <span class="book__meta">${parts.join('<i>·</i>')}</span>
    </span>
    ${continueFrom ? '<span class="chip">ממשיכים</span>' : icon('arrow', 20)}
  </a>`;
}

function render() {
  const reading = getReadingState();
  const found = books.filter((b) => {
    if (filter.type === 'author' && b.author !== filter.value) return false;
    if (filter.type === 'genre' && b.genre !== filter.value) return false;
    return matches(b, query);
  });

  els.count.textContent = found.length === books.length
    ? `${books.length} ספרים`
    : `${found.length} מתוך ${books.length}`;

  if (!found.length) {
    els.list.innerHTML = `<p class="t-sub" style="text-align:center; padding: var(--sp-8) 0;">
      לא מצאנו ספר כזה.<br>אפשר לנסות שם אחר, או לייבא EPUB משלך מתוך הקורא.</p>`;
    return;
  }

  els.list.innerHTML = found.map((b) => bookCard(b, b.id === reading.workId)).join('');
}

function renderFilters() {
  const authors = [...new Set(books.map((b) => b.author))].sort((a, b) => a.localeCompare(b, 'he'));
  const genres  = [...new Set(books.map((b) => b.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'));

  const chip = (label, type, value) =>
    `<button class="chip chip--filter" data-filter="${type}" data-value="${value ?? ''}">${label}</button>`;

  els.filters.innerHTML = `
    <div class="filters" role="group" aria-label="סינון">
      ${chip('הכל', 'all', null)}
      ${genres.map((g) => chip(g, 'genre', g)).join('')}
      ${authors.map((a) => chip(a.split(' · ')[0], 'author', a)).join('')}
    </div>`;

  els.filters.querySelectorAll('[data-filter]').forEach((b) => {
    b.addEventListener('click', () => {
      filter = b.dataset.filter === 'all'
        ? { type: 'all', value: null }
        : { type: b.dataset.filter, value: b.dataset.value };
      markFilters();
      render();
    });
  });
  markFilters();
}

function markFilters() {
  els.filters.querySelectorAll('[data-filter]').forEach((b) => {
    const on = filter.type === 'all'
      ? b.dataset.filter === 'all'
      : b.dataset.filter === filter.type && b.dataset.value === filter.value;
    b.setAttribute('aria-pressed', String(on));
  });
}

function renderSearch() {
  els.search.innerHTML = `
    <label class="search">
      <span class="search__icon">${icon('search', 20)}</span>
      <input class="search__input" type="search" inputmode="search"
             placeholder="חיפוש ספר או מחבר" aria-label="חיפוש ספר או מחבר" data-q>
      <button class="search__clear" type="button" aria-label="ניקוי" hidden>${icon('x', 18)}</button>
    </label>`;

  const input = els.search.querySelector('[data-q]');
  const clear = els.search.querySelector('.search__clear');

  input.addEventListener('input', () => {
    query = input.value;
    clear.hidden = !query;
    render();
  });

  clear.addEventListener('click', () => {
    input.value = '';
    query = '';
    clear.hidden = true;
    input.focus();
    render();
  });
}

/* ------------------------------------------------------------------ */

async function init() {
  initTheme();
  renderNavbar('library');

  try {
    const res = await fetch('content/catalog.json');
    if (!res.ok) throw new Error('catalog ' + res.status);
    books = await res.json();
  } catch (err) {
    console.error(err);
    els.list.innerHTML = '<p class="t-sub">לא הצלחנו לטעון את הקטלוג.</p>';
    return;
  }

  books.sort((a, b) => a.title.localeCompare(b.title, 'he'));

  renderSearch();
  renderFilters();
  render();
}

init();
