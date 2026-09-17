/**
 * bookcard.js — כרטיס ספר, משותף לספרייה ול"הספרים שלי" במסך הבית.
 *
 * אין עטיפות בשלב הזה: כל ספר מקבל רקע צבעוני פשוט עם שם היצירה
 * והמחבר. הצבע נקבע לפי אורך הקריאה המשוער — ירוק קצר, צהוב בינוני,
 * אדום ארוך. הספים ב-config.js.
 */

import { BOOK_LENGTH } from '../config.js';

/**
 * @param {number} estMinutes
 * @returns {'short'|'medium'|'long'}
 */
export function lengthClass(estMinutes = 0) {
  if (estMinutes <= BOOK_LENGTH.shortMaxMinutes) return 'short';
  if (estMinutes <= BOOK_LENGTH.mediumMaxMinutes) return 'medium';
  return 'long';
}

/** זמן קריאה בלשון אנושית */
export function timeLabel(minutes = 0) {
  if (minutes < 60) return `${minutes} דק׳`;
  const h = Math.round(minutes / 60);
  return h === 1 ? 'כשעה' : `כ-${h} שעות`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * @param {object} book פריט קטלוג, או ספר מ-store.getBooks()
 * @param {object} [opts]
 * @param {number|null} [opts.percent] 0..1 — מוסיף פס התקדמות
 * @returns {string}
 */
export function bookCard(book, { percent = null } = {}) {
  const tone = lengthClass(book.estMinutes);
  const pct = percent == null ? null : Math.round(percent * 100);

  return `<a class="bookcard bookcard--${tone}" href="reader.html?work=${encodeURIComponent(book.id)}">
    <span class="bookcard__face">
      <span class="bookcard__title">${esc(book.title)}</span>
      <span class="bookcard__author">${esc(book.author)}</span>
      ${book.estMinutes ? `<span class="bookcard__time">${timeLabel(book.estMinutes)}</span>` : ''}
    </span>
    ${pct == null ? '' : `
      <span class="bookcard__progress" aria-label="${pct} אחוז">
        <i style="inline-size:${pct}%"></i>
        <b>${pct}%</b>
      </span>`}
  </a>`;
}

/** כרטיס "ספר חדש" שמוביל לספרייה (מסך הבית) */
export function newBookCard() {
  return `<a class="bookcard bookcard--new" href="library.html">
    <span class="bookcard__face">
      <span class="bookcard__plus" aria-hidden="true">+</span>
      <span class="bookcard__title">ספר חדש</span>
    </span>
  </a>`;
}
