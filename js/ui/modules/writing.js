/**
 * modules/writing.js — מודול הכתיבה (המפרט, סעיף 10.3).
 *
 * עורך יומן עם פרומפט יומי. ההדבקה חסומה, הקצב נמדד, ונדרשות
 * 50 מילים לפחות. הרישומים נשמרים מקומית וניתנים לצפייה — זה
 * ערך למשתמש, לא רק משימה שצריך לעבור.
 */

import { icon } from '../icons.js';
import { WRITING } from '../../config.js';
import { countWords, verifyEntry, reasonText, promptForDate } from '../../logic/writing.js';
import { getModuleData, setModuleData, today } from '../../logic/store.js';

export function mount(host, { onComplete } = {}) {
  const date = today();
  const prompt = promptForDate(date);
  const saved = getModuleData('writing', { entries: [] });

  let startedAt = 0;
  let pastedChars = 0;

  host.innerHTML = `
    <div class="writer">
      <div class="writer__prompt">
        <span class="t-small">הפרומפט של היום</span>
        <b>${prompt}</b>
      </div>

      <textarea class="writer__area" data-text rows="10"
                placeholder="כתוב כאן. אין תשובה נכונה."
                spellcheck="false"></textarea>

      <div class="writer__foot">
        <span class="t-small" data-count>0 מילים</span>
        <span class="t-small" data-note></span>
      </div>
    </div>

    ${saved.entries?.length ? `
      <details class="writer__past">
        <summary>הרישומים הקודמים שלך (${saved.entries.length})</summary>
        <div class="stack-2" style="margin-top: var(--sp-3);">
          ${saved.entries.slice(0, 8).map((e) => `
            <div class="card stack-2">
              <span class="t-small">${e.date} · ${e.prompt}</span>
              <p>${escapeHtml(e.text).slice(0, 400)}</p>
            </div>`).join('')}
        </div>
      </details>` : ''}`;

  const area = host.querySelector('[data-text]');
  const count = host.querySelector('[data-count]');
  const note = host.querySelector('[data-note]');

  /* ---------------------------------------------------------------- *
   * חסימת הדבקה (המפרט, סעיף 10.3)
   * ---------------------------------------------------------------- */

  area.addEventListener('paste', (e) => {
    e.preventDefault();
    pastedChars += (e.clipboardData?.getData('text') || '').length;
    note.textContent = 'הדבקה חסומה כאן — כתוב במילים שלך';
    note.className = 't-small is-warn';
  });

  area.addEventListener('drop', (e) => e.preventDefault());

  area.addEventListener('input', () => {
    if (!startedAt) startedAt = Date.now();

    const words = countWords(area.value);
    count.textContent = `${words} מילים`;
    count.classList.toggle('is-ready', words >= WRITING.minWords);

    if (words < WRITING.minWords) {
      note.textContent = `עוד ${WRITING.minWords - words}`;
      note.className = 't-small';
    } else if (!pastedChars) {
      note.textContent = 'אפשר לסיים';
      note.className = 't-small is-ready';
    }

    update();
  });

  /* ---------------------------------------------------------------- */

  function update() {
    const words = countWords(area.value);
    const btn = document.querySelector('[data-submit]');
    if (btn) btn.disabled = words < WRITING.minWords;
  }

  function submit() {
    const result = verifyEntry({
      text: area.value,
      elapsedMs: startedAt ? Date.now() - startedAt : 0,
      pasted: pastedChars,
    });

    if (!result.ok) {
      note.textContent = reasonText(result.reason, result.words);
      note.className = 't-small is-warn';
      return;
    }

    setModuleData('writing', {
      entries: [{ date, prompt, text: area.value, words: result.words }, ...(saved.entries || [])].slice(0, 60),
    });

    onComplete?.(1, { words: result.words });
  }

  return {
    /** הפוטר של מסך המשימה מבקש את הכפתור שלו מהמודול */
    actions: `<button class="btn btn--primary btn--block" data-submit disabled>
      ${icon('check', 20)} סיימתי לכתוב</button>`,
    bind(footer) {
      footer.querySelector('[data-submit]')?.addEventListener('click', submit);
      update();
    },
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
