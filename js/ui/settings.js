/**
 * settings.js — הגדרות (המפרט, סעיף 9.5).
 *
 * השאלון · ניהול נישות והגדרותיהן · מצב איפוס · אפליקציות חסומות ·
 * תצוגה · גודל טקסט · אפס הכל.
 *
 * ** שערי הרווח אינם מופיעים כאן ואינם ניתנים לעריכה. **
 * הם נגזרים מהשאלון בלבד — מי שרוצה שערים אחרים עונה עליו שוב.
 * זה מה ששומר על המנגנון אמיתי.
 */

import { initTheme, setTheme, getTheme } from './theme.js';
import { renderNavbar, mountBack, mountMenu } from './nav.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { NICHES, NICHE_IDS, BACKGROUND_DEFAULTS } from '../config.js';
import { getSettings, setSettings, getBlockedApps, getProfile,
         getNiches, setNiches, setNicheSettings, getBackground,
         devInjectBackground, clearAll, devJumpDay, openDay } from '../logic/store.js';

const list = document.querySelector('[data-settings-list]');

const FONT_MIN = 15;
const FONT_MAX = 26;

let settings = getSettings();
let devUnlocked = false;

/* ------------------------------------------------------------------ */

const GOAL_WORDS = {
  wean: 'גמילה', reduce: 'לצמצם דרסטית', balance: 'לאזן',
  routine: 'שגרה יציבה', habits: 'להוסיף הרגלים',
};
const STRICT_WORDS = {
  soft: 'רך', medium: 'בינוני', tough: 'קשוח',
  tougher: 'קשוח מאוד', brutal: 'אכזרי',
};

/** תמצית התשובות — בלי השערים עצמם, שלא ניתנים לשינוי כאן */
function answersSummary() {
  const p = getProfile();
  if (!p) return 'עוד לא ענית';
  return [GOAL_WORDS[p.goal], STRICT_WORDS[p.strictness]].filter(Boolean).join(' · ');
}

const card = (title, body, note) => `
  <div class="card stack-2">
    <div class="row-between"><span>${title}</span>${body.head || ''}</div>
    ${body.main || ''}
    ${note ? `<p class="t-small">${note}</p>` : ''}
  </div>`;

/* ------------------------------------------------------------------ */

function render() {
  const apps = getBlockedApps();
  const theme = getTheme();
  const niches = getNiches();
  const selected = new Set(niches.selected);

  list.innerHTML = `
    <div class="stack">

      <a class="card card--choice" href="onboarding.html?edit=1">
        <span class="stack-2" style="gap:2px; text-align:start;">
          <span>השאלון שלי</span>
          <span class="t-small">${answersSummary()}</span>
        </span>
        ${icon('arrow', 20)}
      </a>

      ${card('הנישות שלי', {
        head: `<span class="chip">${selected.size}</span>`,
        main: `<div class="nichetoggles">
          ${NICHE_IDS.map((id) => `
            <button class="nichetoggle" data-toggle="${id}" aria-pressed="${selected.has(id)}">
              ${icon(NICHES[id].icon, 18)}<span>${NICHES[id].name}</span>
            </button>`).join('')}
        </div>`,
      }, 'הוספה או הסרה משנה את הסבב היומי')}

      ${selected.has('steps') ? card('קו בסיס צעדים', {
        head: `<span class="chip" data-out="steps">${(niches.settings.steps?.baseline ?? BACKGROUND_DEFAULTS.steps.baseline).toLocaleString('he')}</span>`,
        main: `<input class="slider" type="range" min="1000" max="15000" step="500"
                      value="${niches.settings.steps?.baseline ?? BACKGROUND_DEFAULTS.steps.baseline}"
                      data-set="steps" aria-label="קו בסיס צעדים">`,
      }, 'רק צעדים מעל הקו מזכים בדקות') : ''}

      ${selected.has('sleep') ? card('יעד שעות שינה', {
        head: `<span class="chip" data-out="sleep">${niches.settings.sleep?.targetHours ?? BACKGROUND_DEFAULTS.sleep.targetHours}</span>`,
        main: `<input class="slider" type="range" min="5" max="10" step="0.5"
                      value="${niches.settings.sleep?.targetHours ?? BACKGROUND_DEFAULTS.sleep.targetHours}"
                      data-set="sleep" aria-label="יעד שעות שינה">`,
      }) : ''}

      ${card('רמת האנגלית', {
        main: `<div class="seg" role="radiogroup" aria-label="רמת אנגלית">
          ${[['beginner', 'מתחיל'], ['intermediate', 'בינוני'],
             ['advanced', 'מתקדם'], ['native', 'שפת אם']].map(([v, l]) => `
            <button class="seg__item" data-level="${v}" role="radio"
                    aria-checked="${(niches.settings.learning?.level || 'beginner') === v}">${l}</button>`).join('')}
        </div>`,
      })}

      ${card('מה קורה לדקות בחצות', {
        main: `<div class="seg" role="radiogroup" aria-label="מצב איפוס">
          <button class="seg__item" data-reset="midnight" role="radio"
                  aria-checked="${settings.resetMode === 'midnight'}">מתאפסות</button>
          <button class="seg__item" data-reset="keep" role="radio"
                  aria-checked="${settings.resetMode === 'keep'}">נשמרות</button>
        </div>`,
      })}

      ${card('מצב תצוגה', {
        main: `<div class="seg" role="radiogroup" aria-label="מצב תצוגה">
          <button class="seg__item" data-theme="light" role="radio" aria-checked="${theme === 'light'}">בהיר</button>
          <button class="seg__item" data-theme="dark" role="radio" aria-checked="${theme === 'dark'}">כהה</button>
        </div>`,
      })}

      ${card('גודל טקסט בקורא', {
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
  // נישות
  list.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      const selected = new Set(getNiches().selected);

      if (selected.has(id)) selected.delete(id); else selected.add(id);
      if (!selected.size) { toast('צריך לפחות נישה אחת'); return; }

      setNiches({ selected: [...selected] });
      render();
    });
  });

  const slider = (key, fmt = (v) => v) => {
    const input = list.querySelector(`[data-set="${key}"]`);
    const out = list.querySelector(`[data-out="${key}"]`);
    if (!input) return;

    input.addEventListener('input', () => { out.textContent = fmt(Number(input.value)); });
    input.addEventListener('change', () => {
      setNicheSettings(key, key === 'steps'
        ? { baseline: Number(input.value) }
        : { targetHours: Number(input.value) });
    });
  };
  slider('steps', (v) => v.toLocaleString('he'));
  slider('sleep');

  list.querySelectorAll('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setNicheSettings('learning', { level: btn.dataset.level });
      list.querySelectorAll('[data-level]').forEach((b) =>
        b.setAttribute('aria-checked', String(b === btn)));
    });
  });

  // גודל טקסט
  const font = list.querySelector('[data-font]');
  const fontOut = list.querySelector('[data-font-out]');
  font.addEventListener('input', () => { fontOut.textContent = font.value; });
  font.addEventListener('change', () => { settings = setSettings({ fontSize: Number(font.value) }); });

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

  // אפס הכל
  list.querySelector('[data-reset-all]').addEventListener('click', () => {
    if (!confirm('לאפס הכל? הבנק, הרצף, הסבב, ההתקדמות בספרים והתשובות לשאלון יימחקו.')) return;
    clearAll();
    location.href = 'onboarding.html';
  });

  if (devUnlocked) renderDev();
}

/* ------------------------------------------------------------------ *
 * כלי פיתוח (המפרט, סעיפים 10.7, 12.6)
 * ------------------------------------------------------------------ */

function renderDev() {
  const host = list.querySelector('[data-dev]');
  const bg = getBackground();

  host.hidden = false;
  host.innerHTML = `
    <div class="card stack-2">
      <span class="t-small">כלי בדיקה</span>

      <button class="btn btn--secondary btn--block" data-jump>קפוץ יום קדימה</button>

      <hr class="divider">

      <p class="t-small">צעדים ושינה מדומים — בגרסת iOS יגיעו מ-HealthKit</p>
      <div class="row-between">
        <span class="t-small">היום: ${bg.steps.toLocaleString('he')} צעדים · ${bg.sleepHours} שעות שינה</span>
      </div>
      <div class="row">
        <button class="btn btn--secondary" data-inject-steps>+2,000 צעדים</button>
        <button class="btn btn--secondary" data-inject-sleep>8 שעות שינה</button>
      </div>
    </div>`;

  host.querySelector('[data-jump]').addEventListener('click', () => {
    const r = devJumpDay(1);
    toast(`יום חדש — ${r.streakBroke ? 'הרצף נשבר' : 'הרצף נשמר'} · ${r.bankReset ? 'הבנק אופס' : 'הבנק נשמר'}`, 3000);
    render();
  });

  host.querySelector('[data-inject-steps]').addEventListener('click', () => {
    const paid = devInjectBackground({ steps: getBackground().steps + 2000 });
    toast(paid.minutes ? `+${Math.round(paid.minutes)} דק׳ על הצעדים` : 'עוד לא מספיק מעל קו הבסיס', 2600);
    render();
  });

  host.querySelector('[data-inject-sleep]').addEventListener('click', () => {
    const paid = devInjectBackground({ sleepHours: 8 });
    toast(paid.minutes ? `+${Math.round(paid.minutes)} דק׳ על השינה` : 'כבר שולם היום', 2600);
    render();
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
mountMenu();
render();
bindDevUnlock();
