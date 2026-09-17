/**
 * onboarding.js — שאלון, מסך תוצאה ובחירת אפליקציות (המפרט, סעיפים 7.1, 7.2).
 *
 * מסלול לינארי: 5 שאלות ⇐ תוצאה ⇐ בחירת אפליקציות ⇐ מסך הבית.
 * בחירה בשאלה מקדמת אוטומטית אחרי 250ms.
 */

import { initTheme } from './theme.js';
import { icon } from './icons.js';
import { APPS, appIcon, defaultApps } from './apps.js';
import { computePageValue, explainPageValue } from '../logic/formula.js';
import { setProfile, setSettings, setBlockedApps, getBlockedApps } from '../logic/store.js';

const $ = (s) => document.querySelector(s);

const els = {
  progress: $('[data-progress]'),
  step:     $('[data-step]'),
  actions:  $('[data-actions]'),
};

const AUTO_ADVANCE_MS = 250;

/* ------------------------------------------------------------------ *
 * השאלון (המפרט, סעיף 7.1)
 * ------------------------------------------------------------------ */

const QUESTIONS = [
  {
    key: 'screenTime',
    title: 'כמה זמן מסך יש לך ביום?',
    options: [
      { value: '<2',  label: 'פחות משעתיים' },
      { value: '2-4', label: 'שעתיים עד ארבע' },
      { value: '4-6', label: 'ארבע עד שש' },
      { value: '6+',  label: 'יותר משש' },
    ],
  },
  {
    key: 'goal',
    title: 'מה המטרה שלך?',
    options: [
      { value: 'reduce',  label: 'לצמצם דרסטית' },
      { value: 'balance', label: 'לאזן' },
      { value: 'read',    label: 'בעיקר לקרוא יותר' },
    ],
  },
  {
    key: 'readingHabit',
    title: 'כמה אתה קורא היום?',
    options: [
      { value: 'none',    label: 'בכלל לא' },
      { value: 'some',    label: 'קצת' },
      { value: 'regular', label: 'קורא קבוע' },
    ],
  },
  {
    key: 'strictness',
    title: 'כמה קשוח שנהיה איתך?',
    options: [
      { value: 'soft',   label: 'רך' },
      { value: 'medium', label: 'בינוני' },
      { value: 'brutal', label: 'אכזרי' },
    ],
  },
  {
    key: 'resetChoice',
    title: 'מה קורה לדקות שצברת?',
    options: [
      { value: 'midnight', label: 'מתאפסות בחצות', note: 'כל יום מתחילים מחדש' },
      { value: 'keep',     label: 'נשמרות',        note: 'נצברות בלי תפוגה' },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * מצב
 * ------------------------------------------------------------------ */

const answers = {};
let selectedApps = new Set(getBlockedApps().map((a) => a.id));
let step = 0;                 // 0..4 שאלות, 5 תוצאה, 6 אפליקציות

/* ------------------------------------------------------------------ *
 * שלד
 * ------------------------------------------------------------------ */

function renderProgress() {
  if (step >= QUESTIONS.length) { els.progress.innerHTML = ''; return; }

  const n = step + 1;
  els.progress.innerHTML = `
    <div class="row-between" style="margin-bottom: var(--sp-2);">
      <button class="icon-btn" data-back aria-label="חזרה" ${step === 0 ? 'hidden' : ''}></button>
      <span class="t-small">${n} מתוך ${QUESTIONS.length}</span>
    </div>
    <div class="progress" role="progressbar" aria-valuenow="${n}" aria-valuemin="1" aria-valuemax="${QUESTIONS.length}">
      <i style="inline-size: ${(n / QUESTIONS.length) * 100}%"></i>
    </div>`;

  const back = els.progress.querySelector('[data-back]');
  if (back) {
    back.innerHTML = icon('arrow', 22);
    back.addEventListener('click', () => { step -= 1; render(); });
  }
}

function renderQuestion() {
  const q = QUESTIONS[step];

  els.step.innerHTML = `
    <h1 style="margin-bottom: var(--sp-6);">${q.title}</h1>
    <div class="stack-2">
      ${q.options.map((o) => `
        <button class="card card--choice" role="radio" aria-checked="${answers[q.key] === o.value}"
                data-value="${o.value}">
          <span class="stack-2" style="gap:2px; text-align:start;">
            <span>${o.label}</span>
            ${o.note ? `<span class="t-small">${o.note}</span>` : ''}
          </span>
          <span data-mark>${answers[q.key] === o.value ? icon('check', 20) : ''}</span>
        </button>`).join('')}
    </div>`;

  els.step.querySelectorAll('[data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      answers[q.key] = btn.dataset.value;

      // חיווי מיידי, ואז מעבר אוטומטי (המפרט: 250ms)
      els.step.querySelectorAll('[data-value]').forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-checked', String(on));
        b.querySelector('[data-mark]').innerHTML = on ? icon('check', 20) : '';
      });

      setTimeout(() => { step += 1; render(); }, AUTO_ADVANCE_MS);
    });
  });

  els.actions.innerHTML = '';
}

/* ------------------------------------------------------------------ *
 * מסך התוצאה (המפרט, סעיף 7.1)
 * ------------------------------------------------------------------ */

function renderResult() {
  const profile = { ...answers, createdAt: Date.now() };
  const value = computePageValue({ ...profile, daysSinceStart: 0 });

  setProfile(profile);
  setSettings({
    pageValueMinutes: value,
    resetMode: answers.resetChoice === 'keep' ? 'keep' : 'midnight',
  });

  els.step.innerHTML = `
    <div class="result screen-in">
      <p class="t-sub">אצלך</p>
      <p class="result__num">${value}</p>
      <h1>דקות לכל עמוד</h1>
      <p class="t-sub result__why">${explainPageValue({ ...profile, daysSinceStart: 0 })}</p>
    </div>`;

  els.actions.innerHTML =
    '<button class="btn btn--primary btn--block" data-next>בחירת האפליקציות לחסימה</button>';
  els.actions.querySelector('[data-next]').addEventListener('click', () => { step += 1; render(); });
}

/* ------------------------------------------------------------------ *
 * בחירת אפליקציות (המפרט, סעיף 7.2)
 * ------------------------------------------------------------------ */

const SHORTCUTS = [
  { id: 'social', label: 'רשתות חברתיות' },
  { id: 'games',  label: 'גם משחקים' },
  { id: 'custom', label: 'בחירה מותאמת' },
];

function renderApps() {
  els.step.innerHTML = `
    <h1>מה גוזל לך את הזמן?</h1>
    <p class="t-sub" style="margin: var(--sp-2) 0 var(--sp-4);">מומלץ לבחור 2-4 אפליקציות</p>

    <div class="filters" style="margin-bottom: var(--sp-4);">
      ${SHORTCUTS.map((s) => `<button class="chip chip--filter" data-shortcut="${s.id}">${s.label}</button>`).join('')}
    </div>

    <div class="appgrid">
      ${APPS.map((a) => `
        <button class="appcell" data-app="${a.id}" aria-pressed="${selectedApps.has(a.id)}">
          ${appIcon(a.id)}
          <span class="appcell__name">${a.name}</span>
          <span class="appcell__mark">${icon('check', 14)}</span>
        </button>`).join('')}
    </div>`;

  els.step.querySelectorAll('[data-app]').forEach((cell) => {
    cell.addEventListener('click', () => {
      const id = cell.dataset.app;
      if (selectedApps.has(id)) selectedApps.delete(id); else selectedApps.add(id);
      cell.setAttribute('aria-pressed', String(selectedApps.has(id)));
      updateAppsFooter();
    });
  });

  els.step.querySelectorAll('[data-shortcut]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.shortcut;
      if (kind === 'social') selectedApps = new Set(APPS.filter((a) => a.kind === 'social').map((a) => a.id));
      else if (kind === 'games') selectedApps = new Set(APPS.map((a) => a.id));
      else selectedApps = new Set();
      renderApps();
    });
  });

  updateAppsFooter();
}

function updateAppsFooter() {
  const n = selectedApps.size;
  els.actions.innerHTML = `
    <p class="t-small" style="text-align:center; margin-bottom: var(--sp-2);">
      ${n === 0 ? 'עוד לא בחרת' : n === 1 ? 'אפליקציה אחת נבחרה' : `${n} אפליקציות נבחרו`}
    </p>
    <button class="btn btn--primary btn--block" data-done ${n === 0 ? 'disabled' : ''}>סיימתי</button>`;

  const done = els.actions.querySelector('[data-done]');
  if (!done || n === 0) return;

  done.addEventListener('click', () => {
    const chosen = APPS.filter((a) => selectedApps.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, icon: a.id }));

    setBlockedApps(chosen.length ? chosen : defaultApps());
    setSettings({ onboardingDone: true });
    location.href = 'index.html';
  });

  // הצגת האייקונים בפוטר גם אחרי בחירה — נשאר פשוט, בלי לשכפל את הרשת
  els.step.querySelectorAll('[data-app]').forEach((cell) => {
    cell.setAttribute('aria-pressed', String(selectedApps.has(cell.dataset.app)));
  });
}

/* ------------------------------------------------------------------ */

function render() {
  step = Math.max(0, Math.min(QUESTIONS.length + 1, step));
  renderProgress();

  if (step < QUESTIONS.length) renderQuestion();
  else if (step === QUESTIONS.length) renderResult();
  else renderApps();

  window.scrollTo({ top: 0 });
}

initTheme();
render();
