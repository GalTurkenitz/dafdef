/**
 * ring.js — טבעת ההתקדמות (המפרט, סעיף 3: "רכיב מרכזי").
 * מציגה את יתרת הדקות בבנק: קשת ב---primary על מסלול דהוי, המספר במרכז.
 * משמשת במסך הבית ובדשבורד.
 *
 * לבנק אין תקרה (המפרט, סעיף 5), ולכן הטבעת צריכה נקודת ייחוס
 * כדי לדעת מה זה "מלא". capacity הוא הייחוס הזה — הטבעת מתמלאת עד אליו
 * וממשיכה להציג את המספר האמיתי מעליו.
 */

const SIZES = {
  lg: { size: 168, stroke: 12, num: 44 },  // בית ודשבורד
  md: { size: 120, stroke: 10, num: 32 },
  sm: { size: 84,  stroke: 8,  num: 22 },
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * @param {object} opts
 * @param {number} [opts.minutes=0]    דקות בבנק
 * @param {number} [opts.capacity=60]  כמה דקות נחשבות טבעת מלאה
 * @param {'lg'|'md'|'sm'} [opts.size='lg']
 * @param {string} [opts.label="דקות בבנק"]
 * @returns {HTMLElement} אלמנט עם המתודות update(minutes) ו-flick()
 */
export function createRing({ minutes = 0, capacity = 60, size = 'lg', label = 'דקות בבנק' } = {}) {
  const cfg = SIZES[size] || SIZES.lg;
  const r = (cfg.size - cfg.stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = cfg.size / 2;

  const wrap = document.createElement('div');
  wrap.className = 'ring';
  wrap.style.width = cfg.size + 'px';
  wrap.style.height = cfg.size + 'px';

  const svg = el('svg', {
    class: 'ring__svg',
    width: cfg.size,
    height: cfg.size,
    viewBox: `0 0 ${cfg.size} ${cfg.size}`,
    'aria-hidden': 'true',
  });

  svg.appendChild(el('circle', {
    class: 'ring__track', cx: mid, cy: mid, r, 'stroke-width': cfg.stroke,
  }));

  const value = el('circle', {
    class: 'ring__value', cx: mid, cy: mid, r,
    'stroke-width': cfg.stroke,
    'stroke-dasharray': c,
    'stroke-dashoffset': c,
  });
  svg.appendChild(value);

  const center = document.createElement('div');
  center.className = 'ring__center';

  const num = document.createElement('div');
  num.className = 'ring__num';
  num.style.fontSize = cfg.num + 'px';

  const cap = document.createElement('div');
  cap.className = 'ring__label';
  cap.textContent = label;

  center.append(num, cap);
  wrap.append(svg, center);

  // נגישות: קורא-מסך מקבל את הערך, לא את ה-SVG
  wrap.setAttribute('role', 'img');

  /** @param {number} m דקות */
  wrap.update = (m) => {
    const safe = Math.max(0, Number(m) || 0);
    const shown = Math.round(safe);
    num.textContent = shown;
    wrap.classList.toggle('is-empty', safe <= 0);

    const frac = capacity > 0 ? Math.min(1, safe / capacity) : 0;
    value.setAttribute('stroke-dashoffset', String(c * (1 - frac)));
    wrap.setAttribute('aria-label', `${shown} ${label}`);
    return wrap;
  };

  /** "פליק" קצר — אחרי שנצברו דקות (המפרט, סעיף 3) */
  wrap.flick = () => {
    wrap.classList.remove('is-flick');
    void wrap.offsetWidth; // מאלץ reflow כדי שהאנימציה תרוץ שוב
    wrap.classList.add('is-flick');
  };

  wrap.update(minutes);
  return wrap;
}
