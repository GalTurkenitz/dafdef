/**
 * stats.js — עמוד הסטטיסטיקה (V4, סעיף 1).
 *
 * כמה עשית בכל נישה **מאז שהתחלת** — לא היום ולא השבוע.
 *
 * כל שמונה הנישות מוצגות תמיד, ארבע בכל צד, כדי שהמסך יהיה
 * מפה קבועה שאפשר ללמוד בעל פה. נישה שלא נבחרה נשארת במקומה אבל
 * מעומעמת ובלי צבע — כך רואים גם מה יש ומה עדיין לא נגעת בו.
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountMenu } from './nav.js';
import { icon } from './icons.js';
import { NICHES, NICHE_IDS } from '../config.js';
import { milestonesAround, nextMilestone } from '../logic/level.js';
import { getSettings, getSelectedNiches, getLifetime,
         getMilestonesHit, openDay } from '../logic/store.js';

const $ = (s) => document.querySelector(s);
const els = { body: $('[data-body]') };

/**
 * לכל נישה: מה המונה הראשי, מה המשני, ומאיזה מפתח אבני הדרך
 * נמדדות. כושר נמדד בשכיבות — יש לו שני סולמות, והראשי מוצג
 * בכרטיס בעוד השני יושב בשורת המשנה.
 */
const CARDS = {
  reading:   { main: (l) => l.reading.pages,   unit: 'עמודים',
               sub: (l) => `${l.reading.books} ספרים`, mkey: 'reading' },

  fitness:   { main: (l) => l.fitness.reps,    unit: 'חזרות',
               sub: (l) => `${l.fitness.pushups} שכיבות · ${l.fitness.squats} סקוואטים`,
               mkey: 'fitness.pushups' },

  learning:  { main: (l) => l.learning.correct, unit: 'תשובות',
               sub: (l) => `${l.learning.sets} סטים`, mkey: 'learning' },

  writing:   { main: (l) => l.writing.words,   unit: 'מילים',
               sub: (l) => `${l.writing.entries} רישומים`, mkey: 'writing' },

  breathing: { main: (l) => l.breathing.sessions, unit: 'תרגילים',
               sub: (l) => `${l.breathing.minutes} דקות`, mkey: 'breathing' },

  water:     { main: (l) => l.water.cups,      unit: 'כוסות',
               sub: () => '', mkey: 'water' },

  steps:     { main: (l) => l.steps.steps,     unit: 'צעדים',
               sub: () => 'מעל קו הבסיס', mkey: 'steps' },

  sleep:     { main: (l) => l.sleep.hours,     unit: 'שעות',
               sub: () => 'מעל היעד', mkey: 'sleep' },
};

const fmt = (n) => Number(n || 0).toLocaleString('he');

function render() {
  const life = getLifetime();
  const hit = getMilestonesHit();
  const selected = new Set(getSelectedNiches());

  els.body.innerHTML = `<div class="statgrid">${
    NICHE_IDS.map((id) => {
      const niche = NICHES[id];
      const card = CARDS[id];
      const on = selected.has(id);
      const value = card.main(life);
      const sub = card.sub(life);

      /* שורת אבני הדרך: מה שהושג מסומן מלא, מה שלפנינו ריק.
         היא נשענת על מה שנרשם בפועל ולא על השוואה חדשה, כדי
         שהתצוגה תתאים להודעות שכבר הוצגו. */
      const done = new Set(hit[card.mkey] || []);
      const marks = milestonesAround(card.mkey, value)
        .map((m) => `<i class="statcard__mark${done.has(m.value) || m.done ? ' is-on' : ''}"></i>`)
        .join('');

      const next = nextMilestone(card.mkey, value);

      return `<div class="statcard statcard--${id}${on ? '' : ' is-off'}">
        <span class="statcard__head">
          <span class="statcard__icon">${icon(niche.icon, 16)}</span>
          <span class="statcard__name">${niche.name}</span>
        </span>
        <span class="statcard__value">${fmt(value)}</span>
        <span class="statcard__unit">${card.unit}</span>
        ${sub ? `<span class="statcard__sub">${sub}</span>` : ''}
        <span class="statcard__marks" ${next ? `title="הבא: ${fmt(next)}"` : ''}>${marks}</span>
      </div>`;
    }).join('')
  }</div>`;
}

function init() {
  initTheme();
  if (!getSettings().onboardingDone) { location.replace('onboarding.html'); return; }

  openDay();
  renderNavbar('stats');
  mountMenu();
  render();

  window.addEventListener('pageshow', render);
}

init();
