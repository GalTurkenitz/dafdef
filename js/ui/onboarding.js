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
import { bookCard } from './bookcard.js';
import { APPS, appIcon, defaultApps } from './apps.js';
import { NICHES, NICHE_IDS, BACKGROUND_DEFAULTS } from '../config.js';
import { gateTable, explainGates } from '../logic/formula.js';
import { setProfile, getProfile, setSettings, setNiches, getNiches,
         setBlockedApps, getBlockedApps, getActiveBookId, setActiveBookId } from '../logic/store.js';

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
      { value: 'wean',    label: 'לגמול את עצמי מהטלפון', note: 'כל דקת מסך עולה ביוקר' },
      { value: 'reduce',  label: 'לצמצם דרסטית' },
      { value: 'balance', label: 'לאזן' },
      { value: 'routine', label: 'לבנות שגרה יציבה' },
      { value: 'habits',  label: 'להוסיף הרגלים טובים', note: 'כל פעולה שווה יותר' },
    ] },

  { key: 'strictness', part: 'מי אתה', title: 'כמה קשוח שנהיה איתך?',
    options: [
      { value: 'soft',    label: 'רך' },
      { value: 'medium',  label: 'בינוני' },
      { value: 'tough',   label: 'קשוח' },
      { value: 'tougher', label: 'קשוח מאוד' },
      { value: 'brutal',  label: 'אכזרי' },
    ] },

  { key: 'resetChoice', part: 'המסגרת', title: 'מה קורה לדקות שצברת?',
    options: [
      { value: 'midnight', label: 'מתאפסות בחצות', note: 'כל יום מתחילים מחדש' },
      { value: 'keep',     label: 'נשמרות',        note: 'נצברות בלי תפוגה' },
    ] },
];

/** הנישות, בסדר שבו הן מוצגות בכרטיסים */
/* ארבע רמות אנגלית (V3, סעיף ו1) */
export const ENGLISH_LEVELS = [
  { id: 'beginner',     name: 'מתחיל',        blurb: 'מילים בודדות ומשפטים קצרים' },
  { id: 'intermediate', name: 'בינוני',       blurb: 'שיחה יומיומית בלי מילון' },
  { id: 'advanced',     name: 'מתקדם',        blurb: 'טקסטים ארוכים ומורכבים' },
  { id: 'native',       name: 'דובר שפת אם',  blurb: 'ניואנסים, ביטויים וסלנג' },
];

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

/* דף אחד לכל שאלה, בלי גלילה (V3, סעיף ח5). מסכים שאינם רלוונטיים
   לבחירה של המשתמש מדולגים ב-go(). */
const SCREENS = ['age', 'screenTime', 'goal', 'strictness',
                 'nichesTask', 'nichesBg', 'steps', 'sleep', 'english', 'book',
                 'resetChoice', 'gates1', 'gates2', 'apps'];

/** אילו מסכים מותנים בבחירת נישה */
const SCREEN_NEEDS = {
  steps: () => selectedNiches.has('steps'),
  sleep: () => selectedNiches.has('sleep'),
  book:  () => selectedNiches.has('reading'),
  // ח1: רמת האנגלית נשאלת מכולם, גם בלי נישת למידה
  english: () => true,
  // הדף השני של הטבלה מדולג כשאין בו מה להציג
  gates2: () => ['learning', 'writing'].some((id) => selectedNiches.has(id)),
};

let index = params.get('step') === 'apps' ? SCREENS.indexOf('apps') : 0;

function go(delta) {
  let next = index + delta;

  while (next > 0 && next < SCREENS.length) {
    const need = SCREEN_NEEDS[SCREENS[next]];
    if (need && !need()) { next += delta; continue; }
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
  nichesTask: 'הבחירות שלך', nichesBg: 'הבחירות שלך',
  steps: 'הבחירות שלך', sleep: 'הבחירות שלך',
  english: 'הבחירות שלך', book: 'הבחירות שלך',
  resetChoice: 'המסגרת', gates1: 'המסגרת', gates2: 'המסגרת', apps: 'המסגרת',
};

function renderProgress() {
  const screen = SCREENS[index];
  if (screen === 'gates1' || screen === 'gates2' || screen === 'apps') {
    els.progress.innerHTML = ''; return;
  }

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

/**
 * ח6 — "מה קורה לדקות שצברת" מקבל עיצוב משלו: שני כרטיסים גדולים
 * שממלאים את המסך, כל אחד בגוון ובאיור שמבטאים את אופיו.
 */
function renderResetChoice() {
  const key = 'resetChoice';
  const CARDS = [
    { value: 'midnight', name: 'מתאפסות בחצות', note: 'כל יום מתחיל מאפס. מה שלא ניצלת — נעלם.',
      tone: 'reset', art: 'moon' },
    { value: 'keep', name: 'נשמרות', note: 'הדקות נצברות בלי תפוגה ומחכות לך.',
      tone: 'keep', art: 'flame' },
  ];

  els.step.innerHTML = `
    <div class="onepage">
      <div class="onepage__head"><h1>מה קורה לדקות שצברת?</h1></div>
      <div class="resetpick">
        ${CARDS.map((c) => `
          <button class="resetcard resetcard--${c.tone}" role="radio" data-value="${c.value}"
                  aria-checked="${answers[key] === c.value}">
            <span class="resetcard__art" aria-hidden="true">${icon(c.art, 34)}</span>
            <span class="resetcard__name">${c.name}</span>
            <span class="resetcard__note">${c.note}</span>
            <span class="resetcard__mark">${icon('check', 16)}</span>
          </button>`).join('')}
      </div>
    </div>`;

  els.step.querySelectorAll('[data-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      answers[key] = btn.dataset.value;
      els.step.querySelectorAll('[data-value]').forEach((b) =>
        b.setAttribute('aria-checked', String(b === btn)));
      setTimeout(() => go(1), AUTO_ADVANCE_MS);
    });
  });

  els.actions.innerHTML = answers[key]
    ? '<button class="btn btn--ghost btn--block" data-next>הבא</button>' : '';
  els.actions.querySelector('[data-next]')?.addEventListener('click', () => go(1));
}

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

/**
 * מסך בחירת הנישות, מפוצל לשתי קטגוריות (דף לכל אחת).
 *
 * שמונה כרטיסים על מסך אחד לא נכנסו: שניים מהם גלשו אל מחוץ
 * לשטח ונחתכו, כי המסך אינו גולל. הפיצול גם נכון מהותית —
 * נישות שמבוצעות כמשימה ונישות שנצברות ברקע הן שתי החלטות
 * שונות.
 */
const NICHE_GROUPS = {
  nichesTask: {
    title: 'איך תרוויח דקות?',
    sub: 'מומלץ לבחור בין 3 ל-5. אלה יהיו הסבב היומי שלך.',
    ids: () => NICHE_IDS.filter((id) => NICHES[id].channel !== 'background'),
    min: 1,
  },
  nichesBg: {
    title: 'מה עוד נספור לך ברקע?',
    sub: 'אלה נצברות מעצמן, בלי משימה. אפשר גם בלעדיהן.',
    ids: () => NICHE_IDS.filter((id) => NICHES[id].channel === 'background'),
    min: 0,
  },
};

function renderNiches(kind) {
  const group = NICHE_GROUPS[kind];

  els.step.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>${group.title}</h1>
        <p class="t-sub">${group.sub}</p>
      </div>
      <div class="onepage__body">
        <div class="nichegrid">
          ${group.ids().map((id) => {
            const n = NICHES[id];
            return `<button class="nichecard" data-niche="${id}" aria-pressed="${selectedNiches.has(id)}">
              <span class="nichecard__icon">${icon(n.icon, 22)}</span>
              <span class="nichecard__name">${n.name}</span>
              <span class="nichecard__blurb">${NICHE_BLURB[id]}</span>
              <span class="nichecard__mark">${icon('check', 14)}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  els.step.querySelectorAll('[data-niche]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.niche;
      if (selectedNiches.has(id)) selectedNiches.delete(id); else selectedNiches.add(id);
      card.setAttribute('aria-pressed', String(selectedNiches.has(id)));
      renderNichesFooter(kind);
    });
  });

  renderNichesFooter(kind);
}

function renderNichesFooter(kind) {
  const group = NICHE_GROUPS[kind];
  const ids = group.ids();
  const picked = ids.filter((id) => selectedNiches.has(id)).length;
  const blocked = picked < group.min;

  els.actions.innerHTML = `
    <p class="t-small" style="text-align:center; margin-bottom: var(--sp-2);">
      ${blocked ? 'בחר לפחות אחת'
        : picked === 0 ? 'אפשר להמשיך גם בלי'
        : `בחרת ${picked} מתוך ${ids.length}`}
    </p>
    <button class="btn btn--primary btn--block" data-next ${blocked ? 'disabled' : ''}>המשך</button>`;

  els.actions.querySelector('[data-next]')?.addEventListener('click', () => go(1));
}

/* ------------------------------------------------------------------ *
 * דף לכל שאלה (V3, סעיף ח5)
 *
 * כל מסך כאן שואל דבר אחד, ממלא את הגובה ולא גולל. המבנה
 * המשותף יושב ב-settingPage כדי שהדפים יישארו זהים בצורתם.
 * ------------------------------------------------------------------ */

function settingPage({ title, sub = '', body }) {
  els.step.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>${title}</h1>
        ${sub ? `<p class="t-sub">${sub}</p>` : ''}
      </div>
      <div class="onepage__body">${body}</div>
    </div>`;

  els.actions.innerHTML = '<button class="btn btn--primary btn--block" data-next>המשך</button>';
  els.actions.querySelector('[data-next]').addEventListener('click', () => go(1));
}

function renderSteps() {
  const v = nicheSettings.steps?.baseline ?? BACKGROUND_DEFAULTS.steps.baseline;
  settingPage({
    title: 'כמה צעדים אתה הולך בממוצע ביום?',
    sub: 'רק צעדים מעל הקו הזה יזכו אותך בדקות.',
    body: `<div class="bigvalue">
        <span class="bigvalue__num" data-out="steps">${v.toLocaleString('he')}</span>
        <span class="bigvalue__unit">צעדים ביום</span>
      </div>
      <input class="slider" type="range" min="1000" max="15000" step="500" value="${v}"
             data-set="steps" aria-label="קו בסיס צעדים">`,
  });

  const input = els.step.querySelector('[data-set="steps"]');
  input.addEventListener('input', () => {
    const n = Number(input.value);
    nicheSettings.steps = { ...nicheSettings.steps, baseline: n };
    els.step.querySelector('[data-out="steps"]').textContent = n.toLocaleString('he');
  });
}

function renderSleep() {
  const s = { ...BACKGROUND_DEFAULTS.sleep, ...(nicheSettings.sleep || {}) };
  settingPage({
    title: 'כמה שעות שינה אתה ישן ביום?',
    sub: 'עמידה ביעד מזכה בדקות.',
    body: `<div class="bigvalue">
        <span class="bigvalue__num" data-out="sleep">${s.targetHours}</span>
        <span class="bigvalue__unit">שעות</span>
      </div>
      <input class="slider" type="range" min="5" max="10" step="0.5" value="${s.targetHours}"
             data-set="sleep" aria-label="יעד שעות שינה">
      <div class="row-between" style="margin-top: var(--sp-6);">
        <label class="t-small">מתי הולך לישון
          <input class="timeinput" type="time" value="${s.windowStart}" data-sleep="windowStart"></label>
        <label class="t-small">מתי קם
          <input class="timeinput" type="time" value="${s.windowEnd}" data-sleep="windowEnd"></label>
      </div>`,
  });

  const input = els.step.querySelector('[data-set="sleep"]');
  input.addEventListener('input', () => {
    const n = Number(input.value);
    nicheSettings.sleep = { ...nicheSettings.sleep, targetHours: n };
    els.step.querySelector('[data-out="sleep"]').textContent = n;
  });
  els.step.querySelectorAll('[data-sleep]').forEach((i) => {
    i.addEventListener('change', () => {
      nicheSettings.sleep = { ...nicheSettings.sleep, [i.dataset.sleep]: i.value };
    });
  });
}

/* ח1 + ו1: נשאל מכולם, וארבע רמות כולל דובר שפת אם */
function renderEnglish() {
  const level = nicheSettings.learning?.level || 'beginner';
  settingPage({
    title: 'מה רמת האנגלית שלך?',
    sub: 'גם אם לא בחרת למידה — אם תוסיף אותה בהמשך, נדע מאיפה להתחיל.',
    body: `<div class="levelstack" role="radiogroup" aria-label="רמת אנגלית">
      ${ENGLISH_LEVELS.map((l) => `
        <button class="levelcard" data-level="${l.id}" role="radio"
                aria-checked="${level === l.id}">
          <span class="levelcard__name">${l.name}</span>
          <span class="levelcard__blurb">${l.blurb}</span>
        </button>`).join('')}
    </div>`,
  });

  els.step.querySelectorAll('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      nicheSettings.learning = { ...nicheSettings.learning, level: btn.dataset.level };
      els.step.querySelectorAll('[data-level]').forEach((b) =>
        b.setAttribute('aria-checked', String(b === btn)));
    });
  });
}

/* ח5: מי שבחר קריאה בוחר כאן את הספר הפעיל הראשון */
function renderBook() {
  const chosen = getActiveBookId();
  settingPage({
    title: 'איזה ספר תרצה לקרוא?',
    sub: 'אפשר להחליף בכל רגע מתוך הקורא.',
    body: `<div class="bookpick" data-book-pick>
        <p class="t-sub empty">טוען ספרים…</p>
      </div>`,
  });

  const host = els.step.querySelector('[data-book-pick]');

  fetch('content/catalog.json')
    .then((r) => r.json())
    .then((list) => {
      list.sort((a, b) => a.estMinutes - b.estMinutes);
      host.innerHTML = `<div class="bookgrid bookgrid--pick">${
        list.map((b) => bookCard(b)).join('')}</div>`;

      host.querySelectorAll('[data-book]').forEach((a) => {
        a.classList.toggle('is-chosen', a.dataset.book === chosen);
        a.addEventListener('click', (e) => {
          e.preventDefault();               // הבחירה לא יוצאת מהשאלון
          setActiveBookId(a.dataset.book);
          host.querySelectorAll('[data-book]').forEach((x) =>
            x.classList.toggle('is-chosen', x === a));
        });
      });
    })
    .catch(() => { host.innerHTML = '<p class="t-sub">לא הצלחנו לטעון את הקטלוג.</p>'; });
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

/* ח7 — הטבלה נפרסת על שני דפים כדי שאף אחד מהם לא יגלול.
   דף ראשון: קריאה, כושר, מדיטציה, מים, צעדים, שינה.
   דף שני: למידה וכתיבה. */
const GATE_PAGES = [
  ['reading', 'fitness', 'breathing', 'water', 'steps', 'sleep'],
  ['learning', 'writing'],
];

function renderGates(page = 1) {
  const profile = persist();
  const wanted = GATE_PAGES[page - 1];
  const rows = gateTable([...selectedNiches], profile)
    .filter((r) => wanted.includes(r.id));

  els.step.innerHTML = `
    <div class="onepage screen-in">
      <div class="onepage__head">
        <h1>השערים שלך</h1>
        ${page === 1
          ? `<p class="t-sub">${explainGates(profile)}</p>`
          : '<p class="t-sub">המשך הטבלה</p>'}
      </div>
      <div class="onepage__body">
        <div class="stack-2">
          ${rows.length ? rows.map((r) => `
            <div class="gaterow">
              <span class="gaterow__icon">${icon(r.icon, 20)}</span>
              <span class="gaterow__name">${r.name}<small>${r.label}</small></span>
              <span class="gaterow__value"><b>${r.minutes}</b> דק׳</span>
            </div>`).join('')
          : '<p class="t-sub empty">לא בחרת נישות מהקבוצה הזו.</p>'}
        </div>
        ${page === 2 ? `<p class="t-small" style="text-align:center; margin-top: var(--sp-6);">
          השערים נקבעים מהתשובות שלך. רוצה אחרים? ענה על השאלון שוב.</p>` : ''}
      </div>
    </div>`;

  if (page === 1) {
    els.actions.innerHTML = '<button class="btn btn--primary btn--block" data-next>המשך</button>';
  } else {
    els.actions.innerHTML = isEdit
      ? `<a class="btn btn--primary btn--block" href="settings.html">שמירה</a>
         <button class="btn btn--ghost btn--block" data-next>שינוי האפליקציות החסומות</button>`
      : '<button class="btn btn--primary btn--block" data-next>בחירת האפליקציות לחסימה</button>';
  }
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
    case 'nichesTask':
    case 'nichesBg':    renderNiches(SCREENS[index]); break;
    case 'resetChoice': renderResetChoice(); break;
    case 'steps':   renderSteps(); break;
    case 'sleep':   renderSleep(); break;
    case 'english': renderEnglish(); break;
    case 'book':    renderBook(); break;
    case 'gates1':  renderGates(1); break;
    case 'gates2':  renderGates(2); break;
    case 'apps':    renderApps(); break;
    default:              renderQuestion(SCREENS[index]);
  }

  window.scrollTo({ top: 0 });
}

initTheme();
render();
