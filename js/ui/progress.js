/**
 * progress.js — עמוד ההתקדמות (V3, סעיף ד).
 *
 * שני מצבים על אותו מסך:
 *   רשת — ארבע הנישות החופשיות בריבוע 2×2
 *   מסלול — נתיב השלבים של נישה אחת
 *
 * המסלול הוא המקום היחיד באפליקציה שגוללים בו (סעיף ב5), והוא
 * נפתח על השלב הנוכחי כך שהמשתמש רואה מיד איפה הוא.
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountMenu } from './nav.js';
import { icon } from './icons.js';
import { NICHES } from '../config.js';
import { unitValue } from '../logic/formula.js';
import { LEVELS_PER_SECTION, PROGRESS_NICHES, sectionOf, levelInSection,
         sectionRange, levelLabel, levelValue, unitsForLevel } from '../logic/progress.js';
import { getSettings, getProfile, getSelectedNiches, allProgress,
         getProgress, openDay } from '../logic/store.js';

const $ = (s) => document.querySelector(s);

const els = {
  title: $('[data-title]'),
  body:  $('[data-body]'),
  screen: $('[data-screen]'),
};

/** כמה שלבים קדימה מציגים מעבר לנוכחי */
const LOOK_AHEAD = 14;

/**
 * לכל נישה עיצוב מסלול משלה (סעיף ד2) — צורת התחנה, הגוון
 * והכינוי לסקשן. זה מה שגורם למסלולים להרגיש שונים.
 */
const TRACKS = {
  reading:  { tone: 'reading',  shape: 'page',   sectionWord: 'פרק' },
  fitness:  { tone: 'fitness',  shape: 'ring',   sectionWord: 'מחזור' },
  learning: { tone: 'learning', shape: 'card',   sectionWord: 'יחידה' },
  writing:  { tone: 'writing',  shape: 'quill',  sectionWord: 'מחברת' },
};

/* ------------------------------------------------------------------ *
 * רשת הנישות
 * ------------------------------------------------------------------ */

function renderGrid() {
  els.title.textContent = 'התקדמות';
  els.screen.classList.remove('screen--scroll');

  const selected = new Set(getSelectedNiches());
  const states = allProgress();

  const cards = PROGRESS_NICHES.map((id) => {
    const niche = NICHES[id];
    const st = states[id];
    const on = selected.has(id);
    const track = TRACKS[id];

    return `<a class="track-card track-card--${track.tone}${on ? '' : ' is-off'}"
               href="?niche=${id}" data-open="${id}">
      <span class="track-card__icon">${icon(niche.icon, 24)}</span>
      <span class="track-card__name">${niche.name}</span>
      ${on
        ? `<span class="track-card__level">שלב ${st.level}</span>
           <span class="track-card__section">${track.sectionWord} ${sectionOf(st.level) + 1}</span>`
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
 * מסלול השלבים
 * ------------------------------------------------------------------ */

function renderTrack(nicheId) {
  const niche = NICHES[nicheId];
  const track = TRACKS[nicheId];
  const st = getProgress(nicheId);
  const profile = getProfile() || {};
  const unit = unitValue(nicheId, profile);

  els.title.textContent = niche.name;
  els.screen.classList.add('screen--scroll');

  // בונים מהשלב הרחוק כלפי מטה, כדי שהנתיב יעלה כלפי מעלה
  const top = st.level + LOOK_AHEAD;
  const bottom = Math.max(1, st.level - LOOK_AHEAD);

  const rows = [];
  for (let lvl = top; lvl >= bottom; lvl--) {
    const inSection = levelInSection(lvl);

    // כותרת סקשן מעל השלב הראשון שלו
    if (inSection === LEVELS_PER_SECTION) {
      const sec = sectionOf(lvl);
      const range = sectionRange(sec);
      rows.push(`
        <div class="track__section track__section--${sec % 4}">
          <span class="track__section-name">${track.sectionWord} ${sec + 1}</span>
          <span class="track__section-range">שלבים ${range.from}-${range.to}</span>
        </div>`);
    }

    const done = lvl < st.level;
    const current = lvl === st.level;
    const minutes = Math.round(levelValue(nicheId, lvl, unit));

    rows.push(`
      <div class="track__row${done ? ' is-done' : ''}${current ? ' is-current' : ''}"
           ${current ? 'data-current' : ''}>
        <span class="track__node track__node--${track.shape}">
          ${done ? icon('check', 16) : lvl}
        </span>
        <span class="track__info">
          <b>${levelLabel(nicheId, lvl)}</b>
          <small>שלב ${lvl} · ${minutes} דק׳</small>
        </span>
      </div>`);
  }

  // בקריאה השלב מתקדם לפי עמודים, אז מראים כמה נצברו בתוכו
  const need = unitsForLevel(nicheId, st.level);
  const intoLevel = nicheId === 'reading' && need > 1
    ? `<div class="track__into">${st.pagesIntoLevel}/${need} עמודים בשלב הנוכחי</div>`
    : '';

  els.body.innerHTML = `
    <div class="track track--${track.tone}">
      <button class="btn btn--ghost track__back" data-back-grid>
        ${icon('arrow', 18)} כל המסלולים
      </button>
      ${intoLevel}
      <div class="track__path" data-path>${rows.join('')}</div>
      <a class="btn btn--primary btn--block track__go" href="${niche.href}">
        ${levelLabel(nicheId, st.level)} — לשלב ${st.level}
      </a>
    </div>`;

  els.body.querySelector('[data-back-grid]').addEventListener('click', () => {
    history.pushState({}, '', location.pathname);
    renderGrid();
  });

  // נפתח על השלב הנוכחי
  const path = els.body.querySelector('[data-path]');
  const cur = path.querySelector('[data-current]');
  if (cur) path.scrollTop = cur.offsetTop - path.clientHeight / 2 + cur.clientHeight / 2;
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
