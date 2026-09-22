/**
 * wheel.js — גלגל הסבב (V3, סעיף א4).
 *
 * עיגול אחד גדול. במרכזו יתרת הדקות; על ההיקף עיגול קטן לכל נישה
 * שבסבב, במרווחים שווים; ביניהם חיצים שמראים לאן המסלול הולך.
 *
 * ── גיאומטריה ─────────────────────────────────────────────────────
 * הכל מצויר בתוך SVG אחד, כולל האייקונים והשמות. זה לא מקרי:
 * ב-RTL מאפייני מיקום לוגיים (inset-inline-start) מתהפכים, ולכן
 * שכבת HTML מעל SVG מציבה את התחנות בצד ההפוך. ל-SVG אין כיווניות —
 * נקודה בחישוב היא הנקודה שעל המסך. רק מספר הדקות נשאר HTML, כי הוא
 * ממורכז ב-grid ולא נשען על ציר.
 *
 * הזוויות נמדדות במעלות כש-0 = שעה 12, וגדלות עם כיוון השעון על
 * המסך. DIRECTION = -1 הופך את הסבב לנגד כיוון השעון — כיוון הקריאה
 * בעברית.
 *
 * הגלגל הוא תצוגה בלבד. לחיצה על נישה שלא בתורה לא פותחת כלום
 * (סעיף א5) — הכניסה למשימה היא דרך "בצע" שמתחתיו.
 */

import { iconBody } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** ב-RTL הסבב מתקדם נגד כיוון השעון */
const DIRECTION = -1;

/** הנישה הראשונה יושבת בשעה 12 */
const START_DEG = 0;

const el = (name, attrs = {}, children = '') => {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  if (children) n.innerHTML = children;
  return n;
};

/* ------------------------------------------------------------------ *
 * מידות — נגזרות מגודל הגלגל כדי שיתכווץ יפה במסכים קטנים
 * ------------------------------------------------------------------ */

function metrics(size) {
  const nodeR = Math.max(17, Math.min(23, Math.round(size * 0.068)));
  const label = 21;                       // labelDy + חצי גובה השורה
  return {
    cx: size / 2,
    cy: size / 2,
    nodeR,
    iconSize: Math.round(nodeR * 1.0),
    labelDy: nodeR + 13,
    ring: size / 2 - nodeR - label,       // רדיוס מסלול הסבב
    ringW: 1.5,
    doneW: 2.5,
    glow: 5,
    chevron: Math.max(3.5, nodeR * 0.2),
  };
}

/* ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {number} [opts.size=300]  צלע הריבוע בפיקסלים
 * @param {Array}  opts.niches      [{ id, name, icon, done, current }]
 * @param {number} opts.minutes     יתרת הבנק
 * @returns {HTMLElement} אלמנט עם update({ niches, minutes })
 */
export function createWheel({ size = 300, niches = [], minutes = 0 } = {}) {
  const m = metrics(size);

  const wrap = document.createElement('div');
  wrap.className = 'wheel';
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;

  const svg = el('svg', {
    class: 'wheel__svg',
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size,
    'aria-hidden': 'true',
  });

  // סדר השכבות: מסלול · קשתות שהושלמו · חיצים · תחנות
  const gTrack  = el('g', { class: 'wheel__track-g' });
  const gArcs   = el('g', { class: 'wheel__arcs' });
  const gArrows = el('g', { class: 'wheel__arrows' });
  const gStops  = el('g', { class: 'wheel__stops' });
  svg.append(gTrack, gArcs, gArrows, gStops);

  const center = document.createElement('div');
  center.className = 'wheel__center';

  const sr = document.createElement('p');
  sr.className = 'sr-only';

  wrap.append(svg, center, sr);

  /* ---------------------------------------------------------------- *
   * טריגונומטריה
   * ---------------------------------------------------------------- */

  /** נקודה על מעגל ברדיוס נתון, בזווית deg (0 = שעה 12) */
  const point = (deg, r = m.ring) => ({
    x: m.cx + r * Math.cos((deg - 90) * RAD),
    y: m.cy + r * Math.sin((deg - 90) * RAD),
  });

  /** הזווית שבה יושבת הנישה ה-i */
  const angleOf = (i, n) => START_DEG + i * (360 / n) * DIRECTION;

  /**
   * קשת בין שתי זוויות, תמיד בכיוון ההתקדמות של הסבב.
   * sweep=0 הוא נגד כיוון השעון במערכת הצירים של SVG.
   */
  function arc(fromDeg, toDeg, r = m.ring) {
    const a = point(fromDeg, r);
    const b = point(toDeg, r);
    let span = (toDeg - fromDeg) * DIRECTION;
    while (span < 0) span += 360;
    const large = span > 180 ? 1 : 0;
    const sweep = DIRECTION === -1 ? 0 : 1;
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} `
         + `A ${r} ${r} 0 ${large} ${sweep} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  }

  /** אורך קשת בפיקסלים → מעלות, לחישוב מרווחים */
  const gapDeg = (px) => (px / m.ring) * DEG;

  /**
   * זווית הסיבוב של חץ שיושב בזווית deg ומצביע לכיוון ההתקדמות.
   * נמדדת מהמשיק בפועל — שתי נקודות סמוכות על המסלול — כדי שלא
   * נתבלבל בסימנים כשמחליפים כיוון.
   */
  function headingAt(deg) {
    const back  = point(deg - 2 * DIRECTION);
    const ahead = point(deg + 2 * DIRECTION);
    return Math.atan2(ahead.y - back.y, ahead.x - back.x) * DEG;
  }

  /* ---------------------------------------------------------------- *
   * ציור
   * ---------------------------------------------------------------- */

  wrap.update = ({ niches: list = niches, minutes: min = minutes } = {}) => {
    niches = list;
    minutes = min;

    gTrack.replaceChildren();
    gArcs.replaceChildren();
    gArrows.replaceChildren();
    gStops.replaceChildren();

    const n = niches.length;

    center.innerHTML = `<span class="wheel__num">${Math.floor(minutes)}</span>
      <span class="wheel__unit">דקות</span>`;

    if (!n) {
      sr.textContent = 'עוד לא בחרת נישות לסבב';
      return wrap;
    }

    const step = 360 / n;
    const padNode  = gapDeg(m.nodeR + 7);   // לא נוגעים בעיגול
    const padArrow = gapDeg(11);             // חלון לחץ באמצע הקטע

    niches.forEach((niche, i) => {
      const deg = angleOf(i, n);
      const at = point(deg);
      const color = `var(--niche-${niche.id}, var(--primary))`;

      /* ---- הקטע שיוצא מהתחנה הזו אל הבאה ---- */
      if (n > 1) {
        const mid = deg + (step / 2) * DIRECTION;
        const segs = [
          [deg + padNode * DIRECTION, mid - padArrow * DIRECTION],
          [mid + padArrow * DIRECTION, deg + (step - padNode) * DIRECTION],
        ];

        for (const [from, to] of segs) {
          gTrack.appendChild(el('path', {
            class: 'wheel__seg',
            d: arc(from, to),
            fill: 'none',
            'stroke-width': m.ringW,
            'stroke-linecap': 'round',
          }));

          // קשת של נישה שהושלמה נצבעת בצבע שלה (סעיף א4)
          if (niche.done) {
            gArcs.appendChild(el('path', {
              class: 'wheel__seg-done',
              d: arc(from, to),
              fill: 'none',
              stroke: color,
              'stroke-width': m.doneW,
              'stroke-linecap': 'round',
            }));
          }
        }

        /* ---- החץ שבין העיגולים ---- */
        const tip = point(mid);
        const c = m.chevron;
        gArrows.appendChild(el('path', {
          class: 'wheel__arrow' + (niche.done ? ' is-done' : ''),
          d: `M ${-c} ${-c} L ${c * 0.75} 0 L ${-c} ${c}`,
          transform: `translate(${tip.x.toFixed(2)} ${tip.y.toFixed(2)}) `
                   + `rotate(${headingAt(mid).toFixed(2)})`,
          fill: 'none',
          stroke: niche.done ? color : null,
          'stroke-width': 1.6,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }));
      }

      /* ---- התחנה: עיגול, אייקון, שם ---- */
      const stop = el('g', {
        class: 'wheel__stop'
             + (niche.done ? ' is-done' : '')
             + (niche.current ? ' is-current' : ''),
        style: `--c:${color}`,
      });

      // טבעת זוהרת למשימה הבאה בתור (סעיף א4.4)
      if (niche.current) {
        stop.appendChild(el('circle', {
          class: 'wheel__halo',
          cx: at.x.toFixed(2), cy: at.y.toFixed(2), r: m.nodeR + m.glow,
          fill: 'none', stroke: color, 'stroke-width': 2,
        }));
      }

      stop.appendChild(el('circle', {
        class: 'wheel__disc',
        cx: at.x.toFixed(2), cy: at.y.toFixed(2), r: m.nodeR,
        fill: niche.done ? color : 'var(--surface)',
        stroke: color,
        'stroke-width': niche.current ? 2.5 : 1.75,
      }));

      // האייקון בלבד — בלי טקסט בתוך העיגול
      const s = m.iconSize / 24;
      stop.appendChild(el('g', {
        class: 'wheel__glyph',
        transform: `translate(${(at.x - m.iconSize / 2).toFixed(2)} `
                 + `${(at.y - m.iconSize / 2).toFixed(2)}) scale(${s.toFixed(4)})`,
        fill: 'none',
        stroke: niche.done ? 'var(--niche-contrast)' : color,
        'stroke-width': 1.75 / s,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }, iconBody(niche.icon)));

      // השם מתחת לעיגול
      stop.appendChild(el('text', {
        class: 'wheel__name',
        x: at.x.toFixed(2),
        y: (at.y + m.labelDy).toFixed(2),
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        fill: niche.current ? color : 'var(--text-soft)',
      }, niche.name));

      gStops.appendChild(stop);
    });

    const done = niches.filter((x) => x.done);
    const cur = niches.find((x) => x.current);
    sr.textContent = `${Math.floor(minutes)} דקות בבנק. `
      + `הושלמו ${done.length} מתוך ${n} בסבב. `
      + (cur ? `הבאה בתור: ${cur.name}.` : '');

    return wrap;
  };

  wrap.update({ niches, minutes });
  return wrap;
}
