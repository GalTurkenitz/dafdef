/**
 * library.js — בוחר הספרים (V3, סעיף ז).
 *
 * זה כבר לא יעד ניווט אלא מסך בחירה: נפתח מ"החלף ספר" שבקורא או
 * בסיום ספר, ובחירה בספר קובעת אותו כ**ספר הפעיל** ומחזירה לקורא.
 *
 * החיפוש הוא הדרך למצוא ספר; בנוסף יש סינון לפי צבע אורך הקריאה
 * (סעיף ז2). אין סינון לפי מחבר או סוגה.
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountBack, mountMenu } from './nav.js';
import { icon } from './icons.js';
import { bookCard, lengthClass } from './bookcard.js';
import { getBooks, setActiveBookId } from '../logic/store.js';

const $ = (s) => document.querySelector(s);

const els = {
  search: $('[data-library-search]'),
  tones:  $('[data-library-tones]'),
  list:   $('[data-library-list]'),
  count:  $('[data-library-count]'),
};

let books = [];
let query = '';
let tone = 'all';        // all | short | medium | long

/** שבבי הסינון לפי אורך הקריאה (סעיף ז2) */
const TONES = [
  { id: 'all',    label: 'הכל' },
  { id: 'short',  label: 'קצר' },
  { id: 'medium', label: 'בינוני' },
  { id: 'long',   label: 'ארוך' },
];

/* ------------------------------------------------------------------ *
 * חיפוש
 * ------------------------------------------------------------------ */

/**
 * נרמול לחיפוש: מוריד ניקוד, גרשיים ומקף, כדי ש"קצנלסון"
 * ימצא גם את "קאצענעלסאן".
 */
function norm(s) {
  return String(s || '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'׳״־-]/g, '')
    .toLowerCase()
    .trim();
}

function matches(book, q) {
  if (tone !== 'all' && lengthClass(book.estMinutes) !== tone) return false;
  if (!q) return true;
  const hay = norm(`${book.title} ${book.author} ${book.genre}`);
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/* ------------------------------------------------------------------ *
 * תצוגה
 * ------------------------------------------------------------------ */

function render() {
  const started = getBooks();
  const found = books.filter((b) => matches(b, query));

  els.count.textContent = found.length === books.length
    ? `${books.length} ספרים`
    : `${found.length} מתוך ${books.length}`;

  if (!found.length) {
    els.list.innerHTML = `<p class="t-sub empty">
      לא מצאנו ספר כזה.<br>אפשר לנסות שם אחר, או לייבא EPUB משלך מתוך הקורא.</p>`;
    return;
  }

  els.list.innerHTML = `<div class="bookgrid">${
    found.map((b) => bookCard(b, { percent: started[b.id]?.percent ?? null })).join('')
  }</div>`;

  // בחירה קובעת את הספר הפעיל; הקישור עצמו כבר מוביל לקורא
  els.list.querySelectorAll('[data-book]').forEach((a) => {
    a.addEventListener('click', () => setActiveBookId(a.dataset.book));
  });
}

/** שבבי הסינון לפי צבע האורך */
function renderTones() {
  if (!els.tones) return;
  els.tones.innerHTML = `<div class="tonefilter" role="group" aria-label="סינון לפי אורך">
    ${TONES.map((t) => `
      <button class="tonechip tonechip--${t.id}" data-tone="${t.id}"
              aria-pressed="${tone === t.id}">${t.label}</button>`).join('')}
  </div>`;

  els.tones.querySelectorAll('[data-tone]').forEach((b) => {
    b.addEventListener('click', () => {
      tone = b.dataset.tone;
      renderTones();
      render();
    });
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
  mountBack('index.html');
  mountMenu();

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
  renderTones();
  render();
}

init();
