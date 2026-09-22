/**
 * wheel.js — גלגל הסבב (V3, סעיף א4).
 *
 * עיגול אחד שמציג את הסבב היומי: הנישות יושבות על ההיקף, חיצים
 * מראים את כיוון המסלול, וקשת של כל נישה שבוצעה נצבעת.
 * במרכז — יתרת הדקות בבנק.
 *
 * הגלגל הוא תצוגה בלבד. לחיצה על נישה שלא בתורה לא פותחת כלום
 * (סעיף א5) — הכניסה למשימה היא דרך כפתור "בצע" שמתחתיו.
 */

import { icon } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const el = (name, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** ב-RTL הסבב מתקדם נגד כיוון השעון, כמו כיוון הקריאה */
const DIRECTION = -1;

/**
 * @param {object} opts
 * @param {number} [opts.size=300]
 * @param {Array} opts.niches   [{ id, name, icon, done, current }]
 * @param {number} opts.minutes יתרת הבנק
 * @returns {HTMLElement} אלמנט עם update({ niches, minutes })
 */
export function createWheel({ size = 300, niches = [], minutes = 0 } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'wheel';
  wrap.style.width = size + 'px';
  wrap.style.height = size + 'px';

  const svg = el('svg', {
    class: 'wheel__svg', width: size, height: size,
    viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true',
  });

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;          // מקום לתחנות על ההיקף
  const stroke = 10;

  svg.appendChild(el('circle', {
    class: 'wheel__track', cx, cy, r, 'stroke-width': stroke, fill: 'none',
  }));

  const arcs = el('g', { class: 'wheel__arcs' });
  const arrows = el('g', { class: 'wheel__arrows' });
  svg.appendChild(arcs);
  svg.appendChild(arrows);

  const center = document.createElement('div');
  center.className = 'wheel__center';

  const stops = document.createElement('div');
  stops.className = 'wheel__stops';

  wrap.append(svg, stops, center);

  /* ---------------------------------------------------------------- */

  /** נקודה על ההיקף בזווית נתונה (מעלות, 0 = למעלה) */
  function point(deg, radius = r) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(fromDeg, toDeg, radius = r) {
    const a = point(fromDeg, radius);
    const b = point(toDeg, radius);
    let sweepDeg = (toDeg - fromDeg) * DIRECTION;
    while (sweepDeg < 0) sweepDeg += 360;
    const large = sweepDeg > 180 ? 1 : 0;
    const sweep = DIRECTION === -1 ? 0 : 1;
    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${large} ${sweep} ${b.x} ${b.y}`;
  }

  wrap.update = ({ niches: list = niches, minutes: min = minutes } = {}) => {
    niches = list;
    minutes = min;

    arcs.innerHTML = '';
    arrows.innerHTML = '';
    stops.innerHTML = '';

    const n = niches.length;
    if (!n) {
      center.innerHTML = '<p class="t-sub">עוד לא בחרת נישות</p>';
      return wrap;
    }

    const step = 360 / n;

    niches.forEach((niche, i) => {
      // הקשת של הנישה — מתחילה בתחנה שלה ונגמרת בבאה
      const from = i * step * DIRECTION;
      const to = (i + 1) * step * DIRECTION;

      const arc = el('path', {
        class: 'wheel__arc' + (niche.done ? ' is-done' : '') + (niche.current ? ' is-current' : ''),
        d: arcPath(from, to),
        'stroke-width': stroke,
        fill: 'none',
        'stroke-linecap': 'round',
      });
      arcs.appendChild(arc);

      // חץ באמצע הקשת — מראה לאן המסלול הולך
      const midDeg = from + (step / 2) * DIRECTION;
      const tip = point(midDeg, r + stroke + 7);
      const rotate = midDeg + (DIRECTION === -1 ? -90 : 90);
      arrows.appendChild(el('path', {
        class: 'wheel__arrow' + (niche.done ? ' is-done' : ''),
        d: 'M -4 -4 L 3 0 L -4 4',
        transform: `translate(${tip.x} ${tip.y}) rotate(${rotate})`,
        fill: 'none',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }));

      // התחנה עצמה
      const at = point(from);
      const stop = document.createElement('span');
      stop.className = 'wheel__stop'
        + (niche.done ? ' is-done' : '')
        + (niche.current ? ' is-current' : '');
      stop.style.insetInlineStart = `${at.x}px`;
      stop.style.insetBlockStart = `${at.y}px`;
      stop.innerHTML = `
        <span class="wheel__stop-icon">${niche.done ? icon('check', 17) : icon(niche.icon, 17)}</span>
        <span class="wheel__stop-name">${niche.name}</span>`;
      stops.appendChild(stop);
    });

    const done = niches.filter((x) => x.done).length;

    center.innerHTML = `
      <span class="wheel__num">${Math.floor(minutes)}</span>
      <span class="wheel__unit">דקות בבנק</span>
      <span class="wheel__count">${done}/${n} בסבב</span>`;

    return wrap;
  };

  wrap.update({ niches, minutes });
  return wrap;
}
