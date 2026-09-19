/**
 * modules/learning.js — מודול הלמידה (המפרט, סעיף 10.2).
 *
 * סט של עשר שאלות, חצי רב-ברירה וחצי השלמה. טעות מחזירה שאלה
 * חלופית באותו סט, ומתחת ל-8/10 הסט לא הושלם.
 *
 * הממשק שכל מודול מממש:  mount(host, { onComplete, onFail })
 */

import { icon } from '../icons.js';
import { LEARNING } from '../../config.js';
import { buildSet, isCorrect, isSetComplete, rememberWrong, forgetWrong } from '../../logic/learning.js';
import { getNiches, getModuleData, setModuleData } from '../../logic/store.js';

export async function mount(host, { onComplete, onFail } = {}) {
  const level = getNiches().settings.learning?.level || 'beginner';
  const saved = getModuleData('learning', { wrong: [], sets: 0 });

  host.innerHTML = '<div class="card"><p class="t-sub">טוען מילים…</p></div>';

  let bank;
  try {
    const res = await fetch('content/learning/words.json');
    if (!res.ok) throw new Error(res.status);
    bank = await res.json();
  } catch {
    host.innerHTML = '<p class="t-sub empty">לא הצלחנו לטעון את מאגר המילים.</p>';
    return;
  }

  const pool = bank[level] || bank.beginner;
  const questions = buildSet(pool, saved.wrong, Date.now() % 100000);
  if (!questions.length) {
    host.innerHTML = '<p class="t-sub empty">אין מילים ברמה הזו.</p>';
    return;
  }

  let index = 0;
  let correct = 0;
  const wrongIds = [];
  const rightIds = [];
  let locked = false;

  /* ---------------------------------------------------------------- */

  function render() {
    const q = questions[index];

    host.innerHTML = `
      <div class="quiz">
        <div class="quiz__head">
          <span class="t-small">שאלה ${index + 1} מתוך ${questions.length}</span>
          <span class="t-small">${correct} נכונות</span>
        </div>
        <div class="progress"><i style="inline-size:${(index / questions.length) * 100}%"></i></div>

        <div class="quiz__card">
          ${q.kind === 'choice'
            ? `<p class="quiz__label">איך אומרים בעברית?</p>
               <p class="quiz__word">${q.prompt}</p>`
            : `<p class="quiz__label">השלם את המילה <b>${q.hint}</b></p>
               <p class="quiz__sentence">${q.prompt}</p>`}
        </div>

        ${q.kind === 'choice'
          ? `<div class="stack-2" data-options>
              ${q.options.map((o) => `<button class="card card--choice" data-opt="${o}">${o}</button>`).join('')}
             </div>`
          : `<form class="signup" data-fill>
              <input class="quiz__input" type="text" inputmode="latin" autocomplete="off"
                     autocapitalize="off" spellcheck="false" placeholder="באנגלית" data-answer>
              <button class="btn btn--primary" type="submit">בדיקה</button>
             </form>`}

        <p class="quiz__feedback" data-feedback></p>
      </div>`;

    if (q.kind === 'choice') {
      host.querySelectorAll('[data-opt]').forEach((btn) => {
        btn.addEventListener('click', () => answer(btn.dataset.opt, btn));
      });
    } else {
      const form = host.querySelector('[data-fill]');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        answer(host.querySelector('[data-answer]').value);
      });
      host.querySelector('[data-answer]').focus();
    }
  }

  function answer(given, btn) {
    if (locked) return;
    locked = true;

    const q = questions[index];
    const good = isCorrect(q, given);
    const feedback = host.querySelector('[data-feedback]');

    if (good) {
      correct += 1;
      rightIds.push(q.id);
      btn?.classList.add('is-right');
      feedback.className = 'quiz__feedback is-right';
      feedback.innerHTML = `${icon('check', 18)} נכון`;
    } else {
      wrongIds.push(q.id);
      btn?.classList.add('is-wrong');
      feedback.className = 'quiz__feedback is-wrong';
      feedback.textContent = `התשובה: ${q.answer}`;

      // מסמנים גם את הנכונה, כדי שילמד ולא רק ייכשל
      host.querySelector(`[data-opt="${CSS.escape(q.answer)}"]`)?.classList.add('is-right');
    }

    setTimeout(() => {
      locked = false;
      index += 1;
      if (index < questions.length) render();
      else finish();
    }, good ? 650 : 1500);
  }

  function finish() {
    // מילים שטעינו בהן חוזרות בסטים הבאים; מה שנענה נכון יורד מהרשימה
    setModuleData('learning', {
      wrong: rememberWrong(forgetWrong(saved.wrong, rightIds), wrongIds),
      sets: (saved.sets || 0) + 1,
    });

    if (isSetComplete(correct)) {
      onComplete?.(1, { correct, total: questions.length });
      return;
    }

    host.innerHTML = `
      <div class="quiz__result">
        <p class="quiz__score">${correct}<span>/${questions.length}</span></p>
        <p class="t-sub">צריך לפחות ${LEARNING.minCorrect} כדי להשלים את הסט.</p>
        <p class="t-small">המילים שטעית בהן יחזרו בסט הבא.</p>
      </div>`;

    onFail?.({ correct, total: questions.length });
  }

  render();
}
