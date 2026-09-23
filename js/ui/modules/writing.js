/**
 * modules/writing.js — מודול הכתיבה (המפרט, סעיף 10.3).
 *
 * עורך יומן עם **נושא יומי** מתחלף (V3, סעיפים ו2-ו3). הנושא
 * נשלף ממאגר מדורג לפי קושי; השלב במסלול ההתקדמות קובע מאיזו
 * מדרגה שולפים, כך שהנושאים נעשים מאתגרים עם הזמן ודורשים יותר
 * מילים. ההדבקה חסומה, הקצב נמדד, והרישומים נשמרים מקומית.
 */

import { icon } from '../icons.js';
import { WRITING } from '../../config.js';
import { countWords, countSentences, verifyEntry, reasonText,
         promptForDate } from '../../logic/writing.js';
import { writingTopic } from '../../logic/daily.js';
import { unitsForLevel } from '../../logic/progress.js';
import { getModuleData, setModuleData, today, getProgress } from '../../logic/store.js';

export async function mount(host, { onComplete } = {}) {
  const date = today();
  const level = getProgress('writing').level || 1;

  /* הנושא היומי. אם המאגר לא נטען — נופלים לפרומפטים הישנים,
     כדי שהמודול לא ייתקע בגלל קובץ תוכן. */
  let topic = promptForDate(date);
  let tier = null;
  try {
    const bank = await fetch('content/writing/topics.json').then((r) => r.json());
    const pick = writingTopic(bank, date, level);
    if (pick && pick.topic) { topic = pick.topic; tier = pick.tier; }
  } catch (err) {
    console.warn('מאגר הנושאים לא נטען, נופלים לפרומפט הקבוע', err);
  }

  const prompt = topic;

  /* הדרישה נמדדת במשפטים לפי השלב במסלול — מתחילים משניים (ד3).
     רף המילים נגזר מהם כדי שמשפט לא יהיה מילה אחת, ולא מהמדרגה
     של הנושא: אחרת המסלול היה מבטיח שני משפטים והמודול היה דורש
     חמישים מילים. */
  const minSentences = unitsForLevel('writing', level);
  const minWords = Math.max(6, minSentences * 5);
  const saved = getModuleData('writing', { entries: [] });

  let startedAt = 0;
  let pastedChars = 0;

  host.innerHTML = `
    <div class="writer">
      <div class="writer__prompt">
        <span class="t-small">הנושא היומי${tier ? ` · ${tier.name}` : ''}</span>
        <b>${prompt}</b>
      </div>

      <textarea class="writer__area" data-text rows="10"
                placeholder="כתוב כאן. אין תשובה נכונה."
                spellcheck="false"></textarea>

      <div class="writer__foot">
        <span class="t-small" data-count>0/${minSentences} משפטים</span>
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

  /** כמה משפטים יש כרגע בשדה. מוגדר אחרי area — קריאה מוקדמת
     יותר הייתה נופלת על TDZ. */
  const sentencesNow = () => countSentences(area.value || '');
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
    count.textContent = `${sentencesNow()}/${minSentences} משפטים`;
    count.classList.toggle('is-ready', sentencesNow() >= minSentences);

    const have = sentencesNow();
    if (have < minSentences) {
      note.textContent = `עוד ${minSentences - have} ${minSentences - have === 1 ? 'משפט' : 'משפטים'}`;
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
    if (btn) btn.disabled = sentencesNow() < minSentences;
  }

  function submit() {
    const result = verifyEntry({
      text: area.value,
      elapsedMs: startedAt ? Date.now() - startedAt : 0,
      pasted: pastedChars,
      minWords,
      minSentences,
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
