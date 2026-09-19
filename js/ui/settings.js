/**
 * settings.js — הגדרות (המפרט, סעיף 7.7).
 * השאלון · מצב איפוס · אפליקציות חסומות · מצב תצוגה ·
 * גודל טקסט · אפס הכל.
 *
 * ** יחס עמוד-דקות לא מופיע כאן ולא ניתן לעריכה. **
 * הוא נגזר מהשאלון בלבד — אם המשתמש רוצה יחס אחר הוא עונה שוב.
 * זה מה ששומר על המנגנון אמיתי. היחס מוצג בדשבורד ובראש השאלון.
 *
 * כולל גם את כפתור הפיתוח "קפוץ יום" (המפרט, סעיף 9.3), שנשאר נסתר
 * עד שלוחצים חמש פעמים על הכותרת.
 */

import { initTheme, setTheme, getTheme } from './theme.js';
import { renderNavbar, mountBack } from './nav.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { getSettings, setSettings, getBlockedApps, getProfile,
         clearAll, devJumpDay, openDay } from '../logic/store.js';

const list = document.querySelector('[data-settings-list]');

const FONT_MIN = 15;
const FONT_MAX = 26;

let settings = getSettings();
let devUnlocked = false;

/* ------------------------------------------------------------------ */

const GOAL_WORDS = { reduce: 'לצמצם דרסטית', balance: 'לאזן', read: 'לקרוא יותר' };
const STRICT_WORDS = { soft: 'רך', medium: 'בינוני', brutal: 'אכזרי' };

/** תמצית התשובות — בלי היחס עצמו, שלא ניתן לשינוי כאן */
function answersSummary() {
  const p = getProfile();
  if (!p) return 'עוד לא ענית';
  return [GOAL_WORDS[p.goal], STRICT_WORDS[p.strictness]].filter(Boolean).join(' · ')
      || 'שינוי התשובות מחשב את היחס מחדש';
}

const row = (title, body, note) => `
  <div class="card stack-2">
    <div class="row-between"><span>${title}</span>${body.head || ''}</div>
    ${body.main || ''}
    ${note ? `<p class="t-small">${note}</p>` : ''}
  </div>`;

function render() {
  const apps = getBlockedApps();
  const theme = getTheme();

  list.innerHTML = `
    <div class="stack">

      <a class="card card--choice" href="onboarding.html?edit=1">
        <span class="stack-2" style="gap:2px; text-align:start;">
          <span>השאלון שלי</span>
          <span class="t-small">${answersSummary()}</span>
        </span>
        ${icon('arrow', 20)}
      </a>

      ${row('מה קורה לדקות בחצות', {
        main: `<div class="seg" role="radiogroup" aria-label="מצב איפוס">
          <button class="seg__item" data-reset="midnight"
                  aria-checked="${settings.resetMode === 'midnight'}" role="radio">מתאפסות</button>
          <button class="seg__item" data-reset="keep"
                  aria-checked="${settings.resetMode === 'keep'}" role="radio">נשמרות</button>
        </div>`,
      })}

      ${row('מצב תצוגה', {
        main: `<div class="seg" role="radiogroup" aria-label="מצב תצוגה">
          <button class="seg__item" data-theme="light" aria-checked="${theme === 'light'}" role="radio">בהיר</button>
          <button class="seg__item" data-theme="dark"  aria-checked="${theme === 'dark'}"  role="radio">כהה</button>
        </div>`,
      })}

      ${row('גודל טקסט בקורא', {
        head: `<span class="chip" data-font-out>${settings.fontSize}</span>`,
        main: `<input class="slider" type="range" min="${FONT_MIN}" max="${FONT_MAX}" step="1"
                      value="${settings.fontSize}" data-font aria-label="גודל טקסט">`,
      })}

      <a class="card card--choice" href="onboarding.html?step=apps">
        <span class="stack-2" style="gap:2px; text-align:start;">
          <span>אפליקציות חסומות</span>
          <span class="t-small">${apps.length ? apps.map((a) => a.name).join(' · ') : 'לא נבחרו'}</span>
        </span>
        ${icon('arrow', 20)}
      </a>

      <div data-dev hidden></div>

      <button class="btn btn--danger btn--block" data-reset-all>אפס הכל</button>

      <p class="credit">הטקסטים באדיבות <a href="https://benyehuda.org" target="_blank" rel="noopener">פרויקט בן-יהודה</a></p>
    </div>`;

  bind();
}

/* ------------------------------------------------------------------ */

function bind() {
  // גודל טקסט
  const font = list.querySelector('[data-font]');
  const fontOut = list.querySelector('[data-font-out]');
  font.addEventListener('input', () => { fontOut.textContent = font.value; });
  font.addEventListener('change', () => {
    settings = setSettings({ fontSize: Number(font.value) });
  });

  // מצב איפוס
  list.querySelectorAll('[data-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      settings = setSettings({ resetMode: btn.dataset.reset });
      list.querySelectorAll('[data-reset]').forEach((b) =>
        b.setAttribute('aria-checked', String(b === btn)));
    });
  });

  // מצב תצוגה
  list.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.theme);
      list.querySelectorAll('[data-theme]').forEach((b) =>
        b.setAttribute('aria-checked', String(b === btn)));
    });
  });

  // אפס הכל — עם אישור (המפרט, סעיף 7.7)
  list.querySelector('[data-reset-all]').addEventListener('click', () => {
    if (!confirm('לאפס הכל? הבנק, הרצף, ההתקדמות בספרים והתשובות לשאלון יימחקו.')) return;
    clearAll();
    location.href = 'onboarding.html';
  });

  if (devUnlocked) renderDev();
}

/* ------------------------------------------------------------------ *
 * כלי פיתוח (המפרט, סעיף 9.3)
 * ------------------------------------------------------------------ */

function renderDev() {
  const host = list.querySelector('[data-dev]');
  host.hidden = false;
  host.innerHTML = `
    <div class="card stack-2">
      <span class="t-small">כלי בדיקה</span>
      <button class="btn btn--secondary btn--block" data-jump>קפוץ יום קדימה</button>
      <p class="t-small">מזיז את כל התאריכים יום אחורה, כדי לבדוק חצות, רצף ואיפוס בלי לחכות.</p>
    </div>`;

  host.querySelector('[data-jump]').addEventListener('click', () => {
    const r = devJumpDay(1);
    const what = [
      r.streakBroke ? 'הרצף נשבר' : 'הרצף נשמר',
      r.bankReset ? 'הבנק אופס' : 'הבנק נשמר',
    ].join(' · ');
    toast(`יום חדש — ${what}`, 3000);
  });
}

/** חמש הקשות על הכותרת פותחות את כלי הבדיקה */
function bindDevUnlock() {
  const title = document.querySelector('.screen__header h1');
  let taps = 0, last = 0;

  title.addEventListener('click', () => {
    const now = Date.now();
    taps = now - last < 700 ? taps + 1 : 1;
    last = now;

    if (taps >= 5 && !devUnlocked) {
      devUnlocked = true;
      renderDev();
      toast('כלי הבדיקה נפתחו', 2000);
    }
  });
}

/* ------------------------------------------------------------------ */

initTheme();
openDay();
renderNavbar('settings');
mountBack('index.html');
render();
bindDevUnlock();
