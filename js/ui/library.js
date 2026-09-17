/**
 * library.js — מסך הספרייה.
 *
 * החיפוש הוא הדרך למצוא ספר; אין סינון לפי מחבר או סוגה.
 * הספרים מוצגים ברשת של שלושה בשורה, כל אחד בצבע לפי אורך הקריאה.
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountBack } from './nav.js';
import { icon } from './icons.js';
import { bookCard } from './bookcard.js';
import { getBooks } from '../logic/store.js';

const $ = (s) => document.querySelector(s);

const els = {
  search: $('[data-library-search]'),
  list:   $('[data-library-list]'),
  count:  $('[data-library-count]'),
};

let books = [];
let query = '';

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
  render();
}

init();
