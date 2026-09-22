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
 * (סעיף א5) — "בצע" ו"דלג" יושבים בראש המסך, מתחת לרצף.
 */

import { iconBody } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** הנישות שיש להן תמונה; השאר נופלות לאייקון */
const IMAGE_BASE = 'content/img/niches/';
const IMAGE_NICHES = new Set(['reading', 'fitness', 'learning', 'writing', 'breathing', 'water']);

let wheelSeq = 0;
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

function metrics(width, height) {
  // התחנה היא ריבוע מעוגל שמכיל תמונה. nodeR = חצי צלע.
  const tile = Math.max(52, Math.min(72, Math.round(Math.min(width, height) * 0.20)));
  const nodeR = tile / 2;

  /* הרדיוס נדחף עד הקצה: אופקית עוצר הריבוע עצמו, אנכית עוצר
     השם שמתחת לריבוע התחתון. בלוח לא-ריבועי הרוחב הוא שקובע,
     ולכן הטבעת יוצאת רחוקה יותר ממספר הדקות שבמרכז. */
  const labelDy = nodeR + 14;
  const labelPad = labelDy + 7 - nodeR;
  const ring = Math.max(60, Math.min(
    width / 2 - nodeR - 2,
    height / 2 - nodeR - labelPad - 2,
  ));

  return {
    cx: width / 2,
    cy: height / 2,
    tile,
    nodeR,
    radius: Math.round(tile * 0.28),
    iconSize: Math.round(tile * 0.44),
    labelDy,
    ring,
    segW: 2,
    glow: 5,
    arrow: Math.max(3.4, tile * 0.062),
  };
}

/* ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {number} [opts.width]   רוחב הלוח בפיקסלים
 * @param {number} [opts.height]  גובה הלוח — לא בהכרח שווה לרוחב
 * @param {Array}  opts.niches      [{ id, name, icon, done, current }]
 * @param {number} opts.minutes     יתרת הבנק
 * @returns {HTMLElement} אלמנט עם update({ niches, minutes })
 */
export function createWheel({ width = 300, height = 300, niches = [], minutes = 0 } = {}) {
  const m = metrics(width, height);
  const uid = ++wheelSeq;

  const wrap = document.createElement('div');
  wrap.className = 'wheel';
  wrap.style.width = `${width}px`;
  wrap.style.height = `${height}px`;

  const svg = el('svg', {
    class: 'wheel__svg',
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    'aria-hidden': 'true',
  });

  // סדר השכבות: מסלול · קשתות שהושלמו · חיצים · תחנות
  const defs    = el('defs');
  const gTrack  = el('g', { class: 'wheel__track-g' });
  const gArcs   = el('g', { class: 'wheel__arcs' });
  const gArrows = el('g', { class: 'wheel__arrows' });
  const gStops  = el('g', { class: 'wheel__stops' });
  svg.append(defs, gTrack, gArcs, gArrows, gStops);

  const center = document.createElement('div');
  center.className = 'wheel__center';

  // סיכום מילולי לקורא מסך — ה-SVG עצמו מוסתר ממנו
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

    defs.replaceChildren();
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
    const padArrow = gapDeg(m.arrow * 1.7);  // חלון צמוד לראש החץ

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

        /* הגלגל צבעוני במלואו בכל מצב: אותו צבע, אותו עובי, אותה
           עוצמה — לפני הביצוע ואחריו. ההבחנה היחידה בין בוצע
           לטרם היא תג ה-V שעל הריבוע. */
        for (const [from, to] of segs) {
          gTrack.appendChild(el('path', {
            class: 'wheel__seg',
            d: arc(from, to),
            fill: 'none',
            style: `stroke:${color}`,
            'stroke-width': m.segW,
            'stroke-linecap': 'round',
          }));
        }

        /* ---- ראש החץ שבין התחנות ----
           משולש מלא ולא "וי" משורטט: בגודל הזה צורה מלאה נקראת
           כחץ, וקו שבור נקרא כשבר במסלול. הוא יושב על הקו עצמו,
           והרווח סביבו נגזר מגודלו כדי שלא ייראה מנותק. */
        const tip = point(mid);
        const a = m.arrow;
        gArrows.appendChild(el('path', {
          class: 'wheel__arrow',
          d: `M ${(-a * 0.8).toFixed(2)} ${(-a).toFixed(2)} `
           + `L ${(a * 1.1).toFixed(2)} 0 `
           + `L ${(-a * 0.8).toFixed(2)} ${a.toFixed(2)} Z`,
          transform: `translate(${tip.x.toFixed(2)} ${tip.y.toFixed(2)}) `
                   + `rotate(${headingAt(mid).toFixed(2)})`,
          // דרך style ולא מאפיין fill: כלל CSS גובר על מאפיין הצגה.
          // החץ צבוע תמיד, בדיוק כמו הקשת שהוא יושב עליה.
          style: `fill:${color}`,
          stroke: 'none',
        }));
      }

      /* ---- התחנה: עיגול, אייקון, שם ---- */
      const stop = el('g', {
        class: 'wheel__stop'
             + (niche.done ? ' is-done' : '')
             + (niche.current ? ' is-current' : ''),
        style: `--c:${color}`,
      });

      const half = m.nodeR;
      const x0 = at.x - half;
      const y0 = at.y - half;

      // טבעת זוהרת למשימה הבאה בתור (סעיף א4.4)
      if (niche.current) {
        stop.appendChild(el('rect', {
          class: 'wheel__halo',
          x: (x0 - m.glow).toFixed(2), y: (y0 - m.glow).toFixed(2),
          width: m.tile + m.glow * 2, height: m.tile + m.glow * 2,
          rx: m.radius + m.glow,
          fill: 'none', stroke: color, 'stroke-width': 2,
        }));
      }

      // רקע מתחת לתמונה — נראה רק אם היא איטית או חסרה
      stop.appendChild(el('rect', {
        class: 'wheel__plate',
        x: x0.toFixed(2), y: y0.toFixed(2),
        width: m.tile, height: m.tile, rx: m.radius,
        fill: 'var(--surface)',
      }));

      /* התמונה, חתוכה לריבוע מעוגל. אם אין תמונה לנישה או שהיא
         נכשלת בטעינה — נופלים לאייקון, כדי שהתחנה לא תישאר ריקה. */
      const clipId = `tile-${uid}-${niche.id}`;
      const showIcon = () => {
        const sc = m.iconSize / 24;
        stop.appendChild(el('g', {
          class: 'wheel__glyph',
          transform: `translate(${(at.x - m.iconSize / 2).toFixed(2)} `
                   + `${(at.y - m.iconSize / 2).toFixed(2)}) scale(${sc.toFixed(4)})`,
          fill: 'none',
          stroke: color,
          'stroke-width': 1.75 / sc,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }, iconBody(niche.icon)));
      };

      if (IMAGE_NICHES.has(niche.id)) {
        defs.appendChild(el('clipPath', { id: clipId }, ''))
            .appendChild(el('rect', {
              x: x0.toFixed(2), y: y0.toFixed(2),
              width: m.tile, height: m.tile, rx: m.radius,
            }));

        const img = el('image', {
          class: 'wheel__photo',
          x: x0.toFixed(2), y: y0.toFixed(2),
          width: m.tile, height: m.tile,
          preserveAspectRatio: 'xMidYMid slice',
          'clip-path': `url(#${clipId})`,
        });
        img.setAttribute('href', `${IMAGE_BASE}${niche.id}.webp`);
        img.addEventListener('error', () => { img.remove(); showIcon(); }, { once: true });
        stop.appendChild(img);
      } else {
        showIcon();
      }

      // מסגרת בצבע הנישה — הזהות לא תלויה בתמונה
      stop.appendChild(el('rect', {
        class: 'wheel__frame',
        x: x0.toFixed(2), y: y0.toFixed(2),
        width: m.tile, height: m.tile, rx: m.radius,
        fill: 'none', stroke: color,
        'stroke-width': niche.current ? 2.5 : 2,
      }));

      // אחרי הביצוע — V בפינת הריבוע
      if (niche.done) {
        const br = m.nodeR * 0.34;
        const bx = at.x + half - br * 0.55;
        const by = at.y - half + br * 0.55;
        stop.appendChild(el('circle', {
          class: 'wheel__badge',
          cx: bx.toFixed(2), cy: by.toFixed(2), r: br.toFixed(2),
          fill: color, stroke: 'var(--bg)', 'stroke-width': 2,
        }));
        const cs = (br * 1.5) / 24;
        stop.appendChild(el('g', {
          class: 'wheel__badge-check',
          transform: `translate(${(bx - br * 0.75).toFixed(2)} `
                   + `${(by - br * 0.75).toFixed(2)}) scale(${cs.toFixed(4)})`,
          fill: 'none', stroke: 'var(--niche-contrast)', 'stroke-width': 3.2 / cs,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        }, iconBody('check')));
      }

      // השם מתחת לריבוע
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
