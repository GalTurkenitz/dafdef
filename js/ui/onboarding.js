/**
 * onboarding.js — השאלון (המפרט, סעיף 8).
 *
 * שלושה חלקים: מי אתה · הנישות שלך · המסגרת.
 * שאלה למסך, פס התקדמות, ובסוף טבלת השערים האישית.
 *
 * שערי הרווח נקבעים כאן ורק כאן — אין שום מסך שבו המשתמש מזין
 * אותם ידנית. מי שרוצה שערים אחרים עונה על השאלון שוב.
 *
 * פרמטרים בכתובת:
 *   ?edit=1      עריכה מתוך ההגדרות
 *   ?step=apps   קפיצה ישירה לבחירת האפליקציות
 */

import { initTheme } from './theme.js';
import { icon } from './icons.js';
import { APPS, appIcon, defaultApps } from './apps.js';
import { NICHES, NICHE_IDS, BACKGROUND_DEFAULTS } from '../config.js';
import { gateTable, explainGates } from '../logic/formula.js';
import { setProfile, getProfile, setSettings, setNiches, getNiches,
         setBlockedApps, getBlockedApps } from '../logic/store.js';

const $ = (s) => document.querySelector(s);

const els = {
  progress: $('[data-progress]'),
  step:     $('[data-step]'),
  actions:  $('[data-actions]'),
};

const AUTO_ADVANCE_MS = 250;

/* ------------------------------------------------------------------ *
 * השאלות
 * ------------------------------------------------------------------ */

const QUESTIONS = [
  { key: 'age', part: 'מי אתה', title: 'בן כמה אתה?',
    note: 'לא משפיע על החישוב — רק עוזר לנו להבין את המשתמשים',
    options: [
      { value: 'under18', label: 'מתחת ל-18' },
      { value: '18-24',   label: '18 עד 24' },
      { value: '25-34',   label: '25 עד 34' },
      { value: '35-44',   label: '35 עד 44' },
      { value: '45plus',  label: '45 ומעלה' },
    ] },

  { key: 'screenTime', part: 'מי אתה', title: 'כמה זמן מסך יש לך ביום?',
    options: [
      { value: '<2',  label: 'פחות משעתיים' },
      { value: '2-4', label: 'שעתיים עד ארבע' },
      { value: '4-6', label: 'ארבע עד שש' },
      { value: '6+',  label: 'יותר משש' },
    ] },

  { key: 'goal', part: 'מי אתה', title: 'מה המטרה שלך?',
    options: [
      { value: 'reduce',  label: 'לצמצם דרסטית', note: 'צריך לעבוד יותר על כל דקה' },
      { value: 'balance', label: 'לאזן' },
      { value: 'habits',  label: 'להוסיף הרגלים טובים', note: 'כל פעולה שווה יותר' },
    ] },

  { key: 'strictness', part: 'מי אתה', title: 'כמה קשוח שנהיה איתך?',
    options: [
      { value: 'soft',   label: 'רך' },
      { value: 'medium', label: 'בינוני' },
      { value: 'brutal', label: 'אכזרי' },
    ] },

  { key: 'resetChoice', part: 'המסגרת', title: 'מה קורה לדקות שצברת?',
    options: [
      { value: 'midnight', label: 'מתאפסות בחצות', note: 'כל יום מתחילים מחדש' },
      { value: 'keep',     label: 'נשמרות',        note: 'נצברות בלי תפוגה' },
    ] },
];

/** הנישות, בסדר שבו הן מוצגות בכרטיסים */
const NICHE_BLURB = {
  reading:   'עמוד בספר',
  fitness:   'שכיבות וסקוואטים',
  learning:  'אנגלית בכרטיסיות',
  writing:   'רישום יומן קצר',
  breathing: 'שתי דקות של נשימה',
  water:     'כוס מים',
  steps:     'צעדים לאורך היום',
  sleep:     'שינה מספקת',
};

/* ------------------------------------------------------------------ *
 * מצב
 * ------------------------------------------------------------------ */

const params = new URLSearchParams(location.search);
const existingProfile = getProfile();
const isEdit = params.get('edit') === '1' && !!existingProfile;

const answers = isEdit
  ? Object.fromEntries(QUESTIONS.map((q) => [q.key, existingProfile[q.key]]).filter(([, v]) => v))
  : {};

let selectedNiches = new Set(getNiches().selected);
let nicheSettings = structuredClone(getNiches().settings);
let selectedApps = new Set(getBlockedApps().map((a) => a.id));

/* ------------------------------------------------------------------ *
 * מפת המסכים
 *
 * הסדר מהמפרט: 4 שאלות "מי אתה" ⇐ נישות ⇐ הגדרות נישות ⇐
 * מה קורה לדקות ⇐ טבלת שערים ⇐ אפליקציות.
 * מסך הגדרות הנישות מדלג על עצמו כשאין מה להגדיר.
 * ------------------------------------------------------------------ */

const SCREENS = ['age', 'screenTime', 'goal', 'strictness',
                 'niches', 'nicheSettings', 'resetChoice', 'gates', 'apps'];

let index = params.get('step') === 'apps' ? SCREENS.indexOf('apps') : 0;

/** האם יש בכלל מה להגדיר במסך הגדרות הנישות */
function needsNicheSettings() {
  return ['steps', 'sleep', 'learning'].some((id) => selectedNiches.has(id));
}

function go(delta) {
  let next = index + delta;

  while (next > 0 && next < SCREENS.length) {
    if (SCREENS[next] === 'nicheSettings' && !needsNicheSettings()) { next += delta; continue; }
    break;
  }

  index = Math.max(0, Math.min(SCREENS.length - 1, next));
  render();
}

/* ------------------------------------------------------------------ *
 * שלד
 * ------------------------------------------------------------------ */

const PART_OF = {
  age: 'מי אתה', screenTime: 'מי אתה', goal: 'מי אתה', strictness: 'מי אתה',
  niches: 'הנישות שלך', nicheSettings: 'הנישות שלך',
  resetChoice: 'המסגרת', gates: 'המסגרת', apps: 'המסגרת',
};

function renderProgress() {
  const screen = SCREENS[index];
  if (screen === 'gates' || screen === 'apps') { els.progress.innerHTML = ''; return; }

  const n = index + 1;
  const pct = (n / SCREENS.length) * 100;

  els.progress.innerHTML = `
    <div class="row-between" style="margin-bottom: var(--sp-2);">
      <button class="icon-btn" data-back aria-label="${index === 0 ? 'ביטול' : 'חזרה'}"></button>
      <span class="t-small">${PART_OF[screen]}</span>
    </div>
    <div class="progress" role="progressbar" aria-valuenow="${n}" aria-valuemin="1" aria-valuemax="${SCREENS.length}">
      <i style="inline-size: ${pct}%"></i>
    </div>`;

  const back = els.progress.querySelector('[data-back]');
  back.innerHTML = icon(index === 0 ? 'x' : 'arrow', 22);
  back.hidden = index === 0 && !isEdit;
  back.addEventListener('click', () => {
    if (index === 0) location.href = 'settings.html';
    else go(-1);
  });
}

/* ------------------------------------------------------------------ *
 * שאלה רגילה
 * ------------------------------------------------------------------ */

function renderQuestion(key) {
  const q = QUESTIONS.find((x) => x.key === key);

  els.step.innerHTML = `
    <h1>${q.title}</h1>
    ${q.note ? `<p class="t-small" style="margin-top: var(--sp-2);">${q.note}</p>` : ''}
    <div class="stack-2" style="margin-top: var(--sp-6);">
      ${q.options.map((o) => `
        <button class="card card--choice" role="radio" aria-checked="${answers[key] === o.value}"
                data-value="${o.value}">
          <span class="stack-2" style="gap:2px; text-align:start;">
            <span>${o.label}</span>
            ${o.note ? `<span class="t-small">${o.note}</span>` : ''}
          </span>
          <span data-mark>${answers[key] === o.value ? icon('check', 20) : ''}</span>
        </button>`).join('')}
    </div>`;

  els.step.querySelectorAll('[data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      answers[key] = btn.dataset.value;
      els.step.querySelectorAll('[data-value]').forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-checked', String(on));
        b.querySelector('[data-mark]').innerHTML = on ? icon('check', 20) : '';
      });
      setTimeout(() => go(1), AUTO_ADVANCE_MS);
    });
  });

  els.actions.innerHTML = isEdit && answers[key]
    ? '<button class="btn btn--ghost btn--block" data-next>הבא</button>' : '';
  els.actions.querySelector('[data-next]')?.addEventListener('click', () => go(1));
}

/* ------------------------------------------------------------------ *
 * בחירת נישות (המפרט, סעיף 8ב)
 * ------------------------------------------------------------------ */

function renderNiches() {
  els.step.innerHTML = `
    <h1>במה תרוויח דקות?</h1>
    <p class="t-sub" style="margin: var(--sp-2) 0 var(--sp-6);">
      בחר כמה שתרצה. אלה יהיו הסבב היומי שלך.</p>

    <div class="nichegrid">
      ${NICHE_IDS.map((id) => {
        const n = NICHES[id];
        return `<button class="nichecard" data-niche="${id}" aria-pressed="${selectedNiches.has(id)}">
          <span class="nichecard__icon">${icon(n.icon, 24)}</span>
          <span class="nichecard__name">${n.name}</span>
          <span class="nichecard__blurb">${NICHE_BLURB[id]}</span>
          <span class="nichecard__mark">${icon('check', 14)}</span>
        </button>`;
      }).join('')}
    </div>`;

  els.step.querySelectorAll('[data-niche]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.niche;
      if (selectedNiches.has(id)) selectedNiches.delete(id); else selectedNiches.add(id);
      card.setAttribute('aria-pressed', String(selectedNiches.has(id)));
      renderNichesFooter();
    });
  });

  renderNichesFooter();
}

function renderNichesFooter() {
  const n = selectedNiches.size;
  const inRound = [...selectedNiches].filter((id) => NICHES[id].channel !== 'background').length;

  els.actions.innerHTML = `
    <p class="t-small" style="text-align:center; margin-bottom: var(--sp-2);">
      ${n === 0 ? 'בחר לפחות אחת'
        : `בחרת ${n} — הסבב היומי שלך הוא ${inRound}${inRound !== n ? ' (צעדים ושינה צוברים ברקע)' : ''}`}
    </p>
    <button class="btn btn--primary btn--block" data-next ${n === 0 ? 'disabled' : ''}>המשך</button>`;

  els.actions.querySelector('[data-next]')?.addEventListener('click', () => go(1));
}

/* ------------------------------------------------------------------ *
 * הגדרות הנישות שצריכות (המפרט, סעיף 8ב6)
 * ------------------------------------------------------------------ */

function renderNicheSettings() {
  const blocks = [];

  if (selectedNiches.has('steps')) {
    const v = nicheSettings.steps?.baseline ?? BACKGROUND_DEFAULTS.steps.baseline;
    blocks.push(`
      <div class="card stack-2">
        <div class="row-between"><span>${icon('footprints', 20)} קו הבסיס היומי שלך</span>
          <span class="chip" data-out="steps">${v.toLocaleString('he')}</span></div>
        <input class="slider" type="range" min="1000" max="15000" step="500" value="${v}"
               data-set="steps" aria-label="קו בסיס צעדים">
        <p class="t-small">רק צעדים מעל הקו הזה מזכים בדקות</p>
      </div>`);
  }

  if (selectedNiches.has('sleep')) {
    const s = { ...BACKGROUND_DEFAULTS.sleep, ...(nicheSettings.sleep || {}) };
    blocks.push(`
      <div class="card stack-2">
        <div class="row-between"><span>${icon('moon', 20)} יעד שעות שינה</span>
          <span class="chip" data-out="sleep">${s.targetHours}</span></div>
        <input class="slider" type="range" min="5" max="10" step="0.5" value="${s.targetHours}"
               data-set="sleep" aria-label="יעד שעות שינה">
        <div class="row-between" style="margin-top: var(--sp-2);">
          <label class="t-small">מתי הולך לישון
            <input class="timeinput" type="time" value="${s.windowStart}" data-sleep="windowStart"></label>
          <label class="t-small">מתי קם
            <input class="timeinput" type="time" value="${s.windowEnd}" data-sleep="windowEnd"></label>
        </div>
      </div>`);
  }

  if (selectedNiches.has('learning')) {
    const level = nicheSettings.learning?.level || 'beginner';
    blocks.push(`
      <div class="card stack-2">
        <span>${icon('brain', 20)} רמת האנגלית שלך</span>
        <div class="seg" role="radiogroup" aria-label="רמת אנגלית">
          <button class="seg__item" data-level="beginner" aria-checked="${level === 'beginner'}" role="radio">מתחיל</button>
          <button class="seg__item" data-level="intermediate" aria-checked="${level === 'intermediate'}" role="radio">בינוני</button>
          <button class="seg__item" data-level="advanced" aria-checked="${level === 'advanced'}" role="radio">מתקדם</button>
        </div>
      </div>`);
  }

  els.step.innerHTML = `
    <h1>כמה הגדרות</h1>
    <p class="t-sub" style="margin: var(--sp-2) 0 var(--sp-6);">
      רק לנישות שצריכות אותן.</p>
    <div class="stack">${blocks.join('')}</div>`;

  els.step.querySelector('[data-set="steps"]')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    nicheSettings.steps = { ...nicheSettings.steps, baseline: v };
    els.step.querySelector('[data-out="steps"]').textContent = v.toLocaleString('he');
  });

  els.step.querySelector('[data-set="sleep"]')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    nicheSettings.sleep = { ...nicheSettings.sleep, targetHours: v };
    els.step.querySelector('[data-out="sleep"]').textContent = v;
  });

  els.step.querySelectorAll('[data-sleep]').forEach((input) => {
    input.addEventListener('change', () => {
      nicheSettings.sleep = { ...nicheSettings.sleep, [input.dataset.sleep]: input.value };
    });
  });

  els.step.querySelectorAll('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      nicheSettings.learning = { level: btn.dataset.level };
      els.step.querySelectorAll('[data-level]').forEach((b) =>
        b.setAttribute('aria-checked', String(b === btn)));
    });
  });

  els.actions.innerHTML = '<button class="btn btn--primary btn--block" data-next>המשך</button>';
  els.actions.querySelector('[data-next]').addEventListener('click', () => go(1));
}

/* ------------------------------------------------------------------ *
 * טבלת השערים האישית (המפרט, סעיף 8ג8)
 * ------------------------------------------------------------------ */

function persist() {
  const profile = { ...answers, createdAt: existingProfile?.createdAt || Date.now() };
  setProfile(profile);

  setNiches({ selected: [...selectedNiches], settings: nicheSettings });
  setSettings({ resetMode: answers.resetChoice === 'keep' ? 'keep' : 'midnight' });

  return profile;
}

function renderGates() {
  const profile = persist();
  const rows = gateTable([...selectedNiches], profile);

  els.step.innerHTML = `
    <div class="screen-in">
      <h1 style="text-align:center;">השערים שלך</h1>
      <p class="t-sub" style="text-align:center; margin: var(--sp-2) 0 var(--sp-6);">
        ${explainGates(profile)}</p>

      <div class="stack-2">
        ${rows.map((r) => `
          <div class="gaterow">
            <span class="gaterow__icon">${icon(r.icon, 20)}</span>
            <span class="gaterow__name">${r.name}<small>${r.label}</small></span>
            <span class="gaterow__value"><b>${r.minutes}</b> דק׳</span>
          </div>`).join('')}
      </div>

      <p class="t-small" style="text-align:center; margin-top: var(--sp-6);">
        השערים נקבעים מהתשובות שלך. רוצה אחרים? ענה על השאלון שוב.</p>
    </div>`;

  els.actions.innerHTML = isEdit
    ? `<a class="btn btn--primary btn--block" href="settings.html">שמירה</a>
       <button class="btn btn--ghost btn--block" data-next>שינוי האפליקציות החסומות</button>`
    : '<button class="btn btn--primary btn--block" data-next>בחירת האפליקציות לחסימה</button>';

  els.actions.querySelector('[data-next]')?.addEventListener('click', () => go(1));
}

/* ------------------------------------------------------------------ *
 * בחירת אפליקציות (המפרט, סעיף 8ג9)
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
      renderAppsFooter();
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

  renderAppsFooter();
}

function renderAppsFooter() {
  const n = selectedApps.size;
  const fromSettings = isEdit || params.get('step') === 'apps';

  els.actions.innerHTML = `
    <p class="t-small" style="text-align:center; margin-bottom: var(--sp-2);">
      ${n === 0 ? 'עוד לא בחרת' : n === 1 ? 'אפליקציה אחת נבחרה' : `${n} אפליקציות נבחרו`}
    </p>
    <button class="btn btn--primary btn--block" data-done ${n === 0 ? 'disabled' : ''}>
      ${fromSettings ? 'שמירה' : 'סיימתי'}
    </button>`;

  const done = els.actions.querySelector('[data-done]');
  if (!done || n === 0) return;

  done.addEventListener('click', () => {
    const chosen = APPS.filter((a) => selectedApps.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, icon: a.id }));

    setBlockedApps(chosen.length ? chosen : defaultApps());
    setSettings({ onboardingDone: true });
    location.href = fromSettings ? 'settings.html' : 'index.html';
  });
}

/* ------------------------------------------------------------------ */

function render() {
  renderProgress();

  switch (SCREENS[index]) {
    case 'niches':        renderNiches(); break;
    case 'nicheSettings': renderNicheSettings(); break;
    case 'gates':         renderGates(); break;
    case 'apps':          renderApps(); break;
    default:              renderQuestion(SCREENS[index]);
  }

  window.scrollTo({ top: 0 });
}

initTheme();
render();
