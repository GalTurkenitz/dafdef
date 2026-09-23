/**
 * progress.js — עמוד ההתקדמות (V3, סעיף ד).
 *
 * שני מצבים על אותו מסך:
 *   רשת   — ארבע הנישות החופשיות בריבוע 2×2, ממורכז במסך.
 *   מסלול — נתיב שלבים אנכי ומתפתל, בסגנון מפת שלבים של משחק.
 *
 * ── המסלול ────────────────────────────────────────────────────
 * השלבים הם עיגולים בלבד, מפוזרים בזיגזג עדין שמאלה-ימינה. **אין
 * קו מחבר** ביניהם — רק העיגולים עצמם. בתוך כל עיגול יש רק את
 * מספר השלב: בלי שמות, תיאורים או אייקונים.
 *
 * כל עשרה שלבים הם **קבוצה**, וכל קבוצה יושבת על גוון אחר של
 * שחור-אפרפר עם קו מפריד שסוגר אותה.
 *
 * המסלול נכנס אוטומטית למצב כהה, גם כשהמשתמש בחר בהיר. זו
 * החלה זמנית בלבד (applyTheme ולא setTheme): ההעדפה השמורה לא
 * משתנה, ויציאה מהמסלול מחזירה אותה.
 *
 * המיקום מחושב ב-left פיזי ולא ב-inset-inline — הזיגזג חייב
 * להיראות זהה ב-RTL.
 *
 * זה המסך היחיד באפליקציה שגוללים בו (סעיף ב5). הוא נפתח על
 * השלב הנוכחי; גלילה מטה חושפת שלבים שהושלמו, מעלה — הבאים.
 */

import { initTheme, applyTheme, getTheme } from './theme.js';
import { renderNavbar, mountMenu } from './nav.js';
import { icon } from './icons.js';
import { NICHES } from '../config.js';
import { unitValue } from '../logic/formula.js';
import { LEVELS_PER_SECTION, PROGRESS_NICHES, sectionOf,
         levelLabel, levelValue, unitsForLevel } from '../logic/progress.js';
import { getSettings, getProfile, getSelectedNiches, allProgress,
         getProgress, openDay } from '../logic/store.js';

const $ = (s) => document.querySelector(s);

const els = {
  title:  $('[data-title]'),
  body:   $('[data-body]'),
  screen: $('[data-screen]'),
};

/** המסלול מלא מהשלב הראשון ועד לתקרה — לא חלון סביב הנוכחי */
const MAX_LEVEL = 150;

/** מידות הנתיב */
const ROW_H = 86;        // מרחק אנכי בין שלבים
const NODE = 52;         // קוטר עיגול רגיל
const NODE_CURRENT = 66; // קוטר השלב הנוכחי

/* אוויר מתחת לשלב הראשון. בלעדיו הוא נצמד לקו של הסרגל התחתון,
   והבסיס התלת-ממדי שלו כמעט נוגע בו. */
const TAIL = 34;

/**
 * לכל נישה מסלול בעל אופי משלה (סעיף ד2):
 * amp   — עומק הזיגזג ביחס לרוחב
 * beat  — כל כמה שלבים הנתיב חוזר על עצמו
 * curve — כמה הפנייה מעוגלת (0 = שבירה חדה, 1 = גל רך)
 */
/** כמה מראות שונים יש לקבוצות לפני שהמחזור חוזר */
const SECTION_LOOKS = 5;

const TRACKS = {
  reading:  { tone: 'reading',  amp: 0.16, beat: 4, curve: 1.0 },  // גל שקט
  fitness:  { tone: 'fitness',  amp: 0.30, beat: 2, curve: 0.15 }, // זיגזג חד
  learning: { tone: 'learning', amp: 0.22, beat: 3, curve: 0.55 }, // מדרגות
  writing:  { tone: 'writing',  amp: 0.26, beat: 6, curve: 1.0 },  // גל רחב
};

/* ------------------------------------------------------------------ *
 * רשת הנישות
 * ------------------------------------------------------------------ */

function renderGrid() {
  els.title.textContent = 'התקדמות';
  els.screen.classList.remove('screen--scroll');
  els.screen.classList.remove('screen--dark');

  // יוצאים מהמסלול — חוזרים למצב התצוגה שהמשתמש בחר
  applyTheme(getTheme());

  const selected = new Set(getSelectedNiches());
  const states = allProgress();

  const cards = PROGRESS_NICHES.map((id) => {
    const niche = NICHES[id];
    const st = states[id];
    const on = selected.has(id);

    /* הרקע הוא תמונת הנישה עם שכבת צבע מעליה, כדי שהטקסט יישאר
       קריא בלי להסתיר את התמונה. הנתיב מהשורש בכוונה: url()
       בתוך משתנה CSS נפתר ביחס לקובץ ה-CSS ולא ל-HTML. */
    return `<a class="track-card track-card--${id}${on ? '' : ' is-off'}"
               href="?niche=${id}" data-open="${id}"
               style="--photo:url('/content/img/niches/${id}.webp')">
      <span class="track-card__name">${niche.name}</span>
      ${on
        ? `<span class="track-card__level">שלב ${st.level}</span>`
        : '<span class="track-card__off">לא בסבב שלך</span>'}
    </a>`;
  }).join('');

  els.body.innerHTML = `<div class="trackgrid">${cards}</div>`;

  els.body.querySelectorAll('[data-open]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.dataset.open;
      if (!selected.has(id)) return;
      history.pushState({ niche: id }, '', `?niche=${id}`);
      renderTrack(id);
    });
  });
}

/* ------------------------------------------------------------------ *
 * גיאומטריית הנתיב
 * ------------------------------------------------------------------ */

/**
 * המיקום האופקי של שלב, כשבר מרוחב הנתיב (0..1).
 * משולש מרוכך: עולה ויורד לפי beat, ו-curve מרכך את הפינות.
 */
function xFraction(level, track) {
  const phase = ((level - 1) % track.beat) / track.beat;   // 0..1
  const tri = 1 - Math.abs(phase * 2 - 1);                 // 0..1..0
  const soft = track.curve * (0.5 - 0.5 * Math.cos(phase * 2 * Math.PI))
             + (1 - track.curve) * tri;
  return 0.5 + (soft - 0.5) * 2 * track.amp;
}

/* ------------------------------------------------------------------ *
 * מסלול השלבים
 * ------------------------------------------------------------------ */

function renderTrack(nicheId) {
  const niche = NICHES[nicheId];
  const track = TRACKS[nicheId];
  const st = getProgress(nicheId);

  els.title.textContent = niche.name;
  els.screen.classList.add('screen--scroll');
  els.screen.classList.add('screen--dark');

  // המסלול תמיד כהה. זמנית בלבד — ההעדפה השמורה לא נוגעת.
  applyTheme('dark');

  els.body.innerHTML = `
    <div class="track track--${track.tone}">
      <button class="btn btn--ghost track__back" data-back-grid>
        ${icon('arrow', 18)} כל המסלולים
      </button>
      <div class="track__path" data-path>
        <div class="track__map" data-map
             style="height:${MAX_LEVEL * ROW_H + TAIL}px"></div>
      </div>
    </div>`;

  els.body.querySelector('[data-back-grid]').addEventListener('click', () => {
    history.pushState({}, '', location.pathname);
    renderGrid();
  });

  const path = els.body.querySelector('[data-path]');
  const map = els.body.querySelector('[data-map]');

  // הרוחב ידוע רק אחרי שהמסלול על המסך
  requestAnimationFrame(() => {
    drawMap(map, nicheId, track, st);

    const current = map.querySelector('[data-current]');
    if (current) {
      path.scrollTop = current.offsetTop - path.clientHeight / 2 + NODE_CURRENT / 2;
    }
  });
}

/** מצייר את הקבוצות ואת עיגולי השלבים */
function drawMap(map, nicheId, track, st) {
  const w = map.clientWidth || 340;

  /* השלב הגבוה יושב למעלה, כך שגלילה מטה חושפת את מה שכבר הושלם
     וגלילה מעלה את הבאים (סעיף ד5). */
  const yOf = (level) => (MAX_LEVEL - level) * ROW_H + ROW_H / 2;

  /* ---- רקעי הקבוצות והקו המפריד ---- */

  const sections = [];
  const sectionCount = Math.ceil(MAX_LEVEL / LEVELS_PER_SECTION);

  for (let sec = 0; sec < sectionCount; sec++) {
    const first = sec * LEVELS_PER_SECTION + 1;
    const last = Math.min(MAX_LEVEL, first + LEVELS_PER_SECTION - 1);

    // הקבוצה נמתחת מהשלב הגבוה שבה (למעלה) עד הנמוך (למטה).
    // הקבוצה הראשונה מקבלת גם את זנב האוויר שמתחת לשלב 1, אחרת
    // נשאר שם פס רקע שלא שייך לאף קבוצה.
    const top = yOf(last) - ROW_H / 2;
    const height = (last - first + 1) * ROW_H + (sec === 0 ? TAIL : 0);

    sections.push(`
      <div class="track__band track__band--s${sec % SECTION_LOOKS}"
           style="top:${top}px; height:${height}px" aria-hidden="true"></div>`);

    // קו מפריד בתחתית הקבוצה, חוץ מהקבוצה הראשונה
    if (sec > 0) {
      sections.push(`
        <div class="track__divider track__divider--s${sec % SECTION_LOOKS}"
             style="top:${top + height}px" aria-hidden="true"></div>`);
    }
  }

  /* ---- עיגולי השלבים ---- */

  const nodes = [];
  for (let level = MAX_LEVEL; level >= 1; level--) {
    const sec = sectionOf(level);
    const done = level < st.level;
    const current = level === st.level;
    const locked = level > st.level;
    const size = current ? NODE_CURRENT : NODE;

    const x = xFraction(level, track) * w;
    const y = yOf(level);

    const cls = ['track__node', `track__node--s${sec % SECTION_LOOKS}`];
    if (done) cls.push('is-done');
    if (current) cls.push('is-current');
    if (locked) cls.push('is-locked');

    /* גם שלב נעול לחיץ — הוא נפתח כדי להראות מה הוא, אבל בלי
       פרטי המשימה ובלי אפשרות לצאת לדרך. */
    nodes.push(`<button class="${cls.join(' ')}" type="button"
        ${current ? 'data-current' : ''}
        data-level="${level}"
        aria-label="שלב ${level}"
        style="left:${(x - size / 2).toFixed(1)}px;
               top:${(y - size / 2).toFixed(1)}px;
               width:${size}px; height:${size}px;">${level}</button>`);
  }

  map.innerHTML = sections.join('') + nodes.join('');

  map.querySelectorAll('[data-level]').forEach((b) => {
    b.addEventListener('click', () => {
      openLevelSheet(nicheId, Number(b.dataset.level),
                     b.classList.contains('is-locked'));
    });
  });
}

/* ------------------------------------------------------------------ *
 * דף השלב (סעיף ד6)
 * ------------------------------------------------------------------ */

/**
 * דף השלב.
 *
 * שלב פתוח מציג את המשימה, כמה דקות היא שווה, וכפתור "צא לדרך".
 * שלב נעול נפתח גם הוא — אבל מראה רק **מה השלב**: המספר והקבוצה
 * שלו. בלי המשימה, בלי השווי ובלי דרך לבצע אותו.
 */
function openLevelSheet(nicheId, level, locked = false) {
  const niche = NICHES[nicheId];
  const profile = getProfile() || {};
  const unit = unitValue(nicheId, profile);
  const minutes = Math.round(levelValue(nicheId, level, unit));
  const section = sectionOf(level) + 1;
  const st = getProgress(nicheId);

  const sheet = document.createElement('div');
  sheet.className = 'levelsheet';
  sheet.innerHTML = `
    <div class="levelsheet__scrim" data-close></div>
    <div class="levelsheet__panel track--${nicheId}${locked ? ' is-locked' : ''}"
         role="dialog" aria-modal="true" aria-label="שלב ${level}">
      <span class="levelsheet__badge">${level}</span>

      ${locked
        ? `<h2 class="levelsheet__title">שלב ${level}</h2>
           <p class="levelsheet__sub">${niche.name} · קבוצה ${section}</p>
           <p class="levelsheet__locked">
             השלב הזה עוד לא נפתח.<br>
             הוא יחכה לך אחרי שלב ${st.level}.
           </p>`
        : `<h2 class="levelsheet__title">${levelLabel(nicheId, level)}</h2>
           <p class="levelsheet__sub">${niche.name} · קבוצה ${section}</p>

           <div class="levelsheet__rows">
             <div class="levelsheet__row">
               <span>המשימה</span>
               <b>${levelLabel(nicheId, level)}</b>
             </div>
             <div class="levelsheet__row">
               <span>שווה</span>
               <b>${minutes} דק׳</b>
             </div>
             ${nicheId === 'reading' && unitsForLevel(nicheId, level) > 1 && level === st.level
               ? `<div class="levelsheet__row">
                    <span>נצבר בשלב</span>
                    <b>${st.pagesIntoLevel}/${unitsForLevel(nicheId, level)}</b>
                  </div>`
               : ''}
           </div>

           <a class="btn btn--primary btn--block" href="${niche.href}">צא לדרך</a>`}

      <button class="btn btn--ghost btn--block" type="button" data-close>סגירה</button>
    </div>`;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('is-open'));

  const close = () => {
    sheet.classList.remove('is-open');
    setTimeout(() => sheet.remove(), 200);
  };
  sheet.querySelectorAll('[data-close]').forEach((e) => e.addEventListener('click', close));
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

/* ------------------------------------------------------------------ */

function route() {
  const id = new URLSearchParams(location.search).get('niche');
  if (id && PROGRESS_NICHES.includes(id) && getSelectedNiches().includes(id)) renderTrack(id);
  else renderGrid();
}

function init() {
  initTheme();
  if (!getSettings().onboardingDone) { location.replace('onboarding.html'); return; }

  openDay();
  renderNavbar('progress');
  mountMenu();
  route();

  window.addEventListener('popstate', route);
}

init();
