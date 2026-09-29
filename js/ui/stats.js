/**
 * stats.js — עמוד הסטטיסטיקה.
 *
 * כמה עשית בכל נישה **מאז שהתחלת** — לא היום ולא השבוע.
 *
 * ─────────────────────────────────────────────────────────────────
 *  מרשת כרטיסים לגוף
 *
 *  קודם זו הייתה רשת 2×2 של שמונה כרטיסים. המשתמש אמר שזה המסך
 *  המכוער באפליקציה, והציע במקומו גוף אדם תלת-מימדי שמסומנים עליו
 *  האזורים שהאפליקציה נוגעת בהם. לוחצים על אזור — נפתחת
 *  הסטטיסטיקה שלו.
 *
 *  הכרטיסים לא נמחקו: הם מה שנפתח בלחיצה, והם גם מסך הנפילה
 *  למכשיר בלי WebGL. אותו בונה מייצר את שניהם, כדי שלא ייווצרו
 *  שתי אמיתות לאותו נתון.
 * ─────────────────────────────────────────────────────────────────
 *  מה עוד לא כאן
 *
 *  אחוזי שיפור לכל אזור. הם תלויים בנקודת פתיחה שתיקבע בשאלון
 *  ("מי שישן 8 שעות מתחיל גבוה יותר ממי שישן 6"), והשאלון עוד לא
 *  נכתב. עד אז האזור מציג את המספרים שנצברו בפועל.
 * ─────────────────────────────────────────────────────────────────
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountMenu } from './nav.js';
import { icon } from './icons.js';
import { NICHES, NICHE_IDS } from '../config.js';
import { milestonesAround, nextMilestone } from '../logic/level.js';
import { getSettings, getSelectedNiches, getLifetime,
         getMilestonesHit, openDay } from '../logic/store.js';
import { REGIONS } from './anatomy.js';
import { createBody, hasWebGL } from './body3d.js';

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

/**
 * כשלאזור יש מדד משלו בתוך הנישה — שכיבות מול סקוואטים — הוא
 * גובר על המונה הראשי. אחרת החזה והרגליים היו מראים את אותו
 * מספר, ואי אפשר היה להבין למה לחצנו על שניהם.
 */
const METRICS = {
  pushups: { value: (l) => l.fitness.pushups, unit: 'שכיבות', mkey: 'fitness.pushups' },
  squats:  { value: (l) => l.fitness.squats,  unit: 'סקוואטים', mkey: 'fitness.squats' },
};

const fmt = (n) => Number(n || 0).toLocaleString('he');

/* ------------------------------------------------------------------ *
 * כרטיס אחד — משמש גם בגיליון וגם ברשת הנפילה
 * ------------------------------------------------------------------ */

function cardData(nicheId, metricKey) {
  const life = getLifetime();
  const hit = getMilestonesHit();
  const card = CARDS[nicheId];
  const metric = metricKey ? METRICS[metricKey] : null;

  const value = metric ? metric.value(life) : card.main(life);
  const mkey = metric ? metric.mkey : card.mkey;
  const done = new Set(hit[mkey] || []);

  return {
    niche: NICHES[nicheId],
    value,
    unit: metric ? metric.unit : card.unit,
    sub: metric ? '' : card.sub(life),
    next: nextMilestone(mkey, value),
    marks: milestonesAround(mkey, value)
      .map((m) => `<i class="statcard__mark${done.has(m.value) || m.done ? ' is-on' : ''}"></i>`)
      .join(''),
  };
}

function cardHtml(nicheId, { on, metricKey } = {}) {
  const d = cardData(nicheId, metricKey);
  return `<div class="statcard statcard--${nicheId}${on ? '' : ' is-off'}">
    <span class="statcard__head">
      <span class="statcard__icon">${icon(d.niche.icon, 16)}</span>
      <span class="statcard__name">${d.niche.name}</span>
    </span>
    <span class="statcard__value">${fmt(d.value)}</span>
    <span class="statcard__unit">${d.unit}</span>
    ${d.sub ? `<span class="statcard__sub">${d.sub}</span>` : ''}
    <span class="statcard__marks" ${d.next ? `title="הבא: ${fmt(d.next)}"` : ''}>${d.marks}</span>
  </div>`;
}

/* ------------------------------------------------------------------ *
 * מסך הנפילה — בלי WebGL אין גוף
 * ------------------------------------------------------------------ */

function renderGrid() {
  const selected = new Set(getSelectedNiches());
  els.body.innerHTML = `<div class="statgrid">${
    NICHE_IDS.map((id) => cardHtml(id, { on: selected.has(id) })).join('')
  }</div>`;
}

/* ------------------------------------------------------------------ *
 * הגוף
 * ------------------------------------------------------------------ */

let scene = null;

function renderBody() {
  const selected = new Set(getSelectedNiches());

  els.body.innerHTML = `
    <div class="statbody">
      <div class="statbody__stage" data-stage></div>
      <p class="statbody__hint" data-hint>סובב את הגוף · לחץ על אזור</p>
      <div class="statbody__sheet" data-sheet hidden></div>
    </div>`;

  const stage = els.body.querySelector('[data-stage]');
  const sheet = els.body.querySelector('[data-sheet]');
  const hint = els.body.querySelector('[data-hint]');

  scene = createBody({
    mount: stage,
    active: selected,
    onPick: (regionId) => {
      if (!regionId) {
        sheet.hidden = true;
        sheet.innerHTML = '';
        hint.hidden = false;
        return;
      }
      const region = REGIONS[regionId];
      hint.hidden = true;
      sheet.hidden = false;
      sheet.innerHTML = `
        <button class="statbody__close" type="button" data-close
                aria-label="סגירה">${icon('x', 18)}</button>
        <p class="statbody__area">${region.label}</p>
        ${cardHtml(region.niche, { on: selected.has(region.niche), metricKey: region.metric })}
        <p class="statbody__what">${region.what}</p>`;

      sheet.querySelector('[data-close]').addEventListener('click', () => {
        scene.select(null);
        sheet.hidden = true;
        sheet.innerHTML = '';
        hint.hidden = false;
      });
    },
  });
}

function render() {
  if (scene) { scene.destroy(); scene = null; }
  if (hasWebGL()) renderBody(); else renderGrid();
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
