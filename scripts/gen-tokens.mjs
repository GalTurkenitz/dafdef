import { writeFileSync } from 'node:fs';
import {
  argbFromHex, hexFromArgb, themeFromSourceColor,
  Hct, TonalPalette, Blend,
} from '@material/material-color-utilities';

const SEED = '#6F4E37';                 // החום של דפדף
const theme = themeFromSourceColor(argbFromHex(SEED));
const hex = (a) => hexFromArgb(a);

/** מרמוני צבע מותאם אישית לכיוון הזרע — זה מה שהופך פלטה לאחידה */
const harm = (h) => hex(Blend.harmonize(argbFromHex(h), argbFromHex(SEED)));

/** גוון ספציפי מתוך פלטת הגוונים של צבע */
const tone = (h, t) => hex(TonalPalette.fromInt(argbFromHex(h)).tone(t));

/**
 * רמות המשטח, לפי מדרגות הניטרל שהמפרט מגדיר.
 * ערבוב ידני החזיר ערכים כמעט זהים — אלה המספרים של M3 עצמו.
 */
function surfaces(isDark) {
  const n = theme.palettes.neutral;
  const t = isDark ? [6, 10, 12, 17, 22, 24] : [98, 96, 94, 92, 90, 100];
  return {
    surface: hex(n.tone(t[0])), s1: hex(n.tone(t[1])), s2: hex(n.tone(t[2])),
    s3: hex(n.tone(t[3])), s4: hex(n.tone(t[4])), s5: hex(n.tone(t[5])),
  };
}

const NICHES = {
  reading:   '#B4552F', fitness: '#A83B4C', learning: '#2F6F6B', writing: '#5B5296',
  breathing: '#56703F', water:   '#2E7BA6', steps:    '#A3711F', sleep:   '#474470',
};

function block(scheme, isDark) {
  const s = scheme.toJSON();
  const sf = surfaces(isDark);
  const T = isDark
    ? { nicheT: 80, lenBg: 18, lenInk: 90, contrast: 12 }
    : { nicheT: 40, lenBg: 92, lenInk: 25, contrast: 100 };

  /* הנישות **לא** מוהרמנות. הרמוניזציה מושכת גוונים לעבר הזרע,
     ואז קריאה, צעדים והרצף — כולם חמים מלכתחילה — יוצאים כמעט
     באותו צבע. צבע קטגורי תפקידו להבדיל. */
  const niche = Object.entries(NICHES)
    .map(([k, v]) => `  --niche-${k}:${' '.repeat(10 - k.length)}${tone(v, T.nicheT)};`)
    .join('\n');

  return { s, sf, T, niche };
}

const L = block(theme.schemes.light, false);
const D = block(theme.schemes.dark, true);

const ACCENT = harm('#C9862B');   // ענבר הרצף
const OK     = harm('#2E7D52');
const LEVEL  = harm('#2F6DB5');
const BADGE  = harm('#E0762B');

const css = `/**
 * tokens.css — מערכת העיצוב.
 *
 * ─────────────────────────────────────────────────────────────────
 *  Material Design 3, נגזר מצבע זרע אחד: ${SEED}
 *
 *  הצבעים כאן **לא נבחרו ביד**. הם נוצרו מהזרע דרך ספריית הצבעים
 *  של גוגל (@material/material-color-utilities), שמחשבת לכל גוון
 *  סקאלה של 100 מדרגות במרחב HCT ובוחרת מדרגות שמובטח שיהיה
 *  ביניהן ניגודיות. זה ההבדל בין פלטה למערכת.
 *
 *  צבעי המותג — הרצף, הרמה, האישור, התג — עברו **הרמוניזציה**
 *  לכיוון הזרע: הגוון נמשך מעט לעבר החום, והכל נראה כמשפחה אחת.
 *
 *  **הנישות לא.** הרמוניזציה של צבע קטגורי הורסת את תפקידו:
 *  נמדד שקריאה, צעדים והרצף — כולם חמים מלכתחילה — יצאו כמעט
 *  באותו צבע. הן שומרות על הגוון המקורי, ורק הבהירות נלקחת
 *  מהסקאלה.
 *
 *  לשינוי הזרע: node scripts/gen-tokens.mjs
 * ─────────────────────────────────────────────────────────────────
 *  משטחים
 *
 *  ב-M3 גובה אינו צל אלא **מדרגה בסקאלת הניטרל**. ערבוב ידני
 *  החזיר ערכים כמעט זהים; אלה המדרגות שהמפרט עצמו מגדיר.
 * ─────────────────────────────────────────────────────────────────
 */

:root {
  /* ---------- M3: תפקידי צבע ---------- */
  --m3-primary: ${hex(L.s.primary)};
  --m3-on-primary: ${hex(L.s.onPrimary)};
  --m3-primary-container: ${hex(L.s.primaryContainer)};
  --m3-on-primary-container: ${hex(L.s.onPrimaryContainer)};
  --m3-secondary: ${hex(L.s.secondary)};
  --m3-secondary-container: ${hex(L.s.secondaryContainer)};
  --m3-on-secondary-container: ${hex(L.s.onSecondaryContainer)};
  --m3-tertiary: ${hex(L.s.tertiary)};
  --m3-tertiary-container: ${hex(L.s.tertiaryContainer)};
  --m3-error: ${hex(L.s.error)};
  --m3-error-container: ${hex(L.s.errorContainer)};
  --m3-on-error-container: ${hex(L.s.onErrorContainer)};
  --m3-outline: ${hex(L.s.outline)};
  --m3-outline-variant: ${hex(L.s.outlineVariant)};

  /* ---------- משטחים ---------- */
  --bg: ${L.sf.surface};
  --surface: ${L.sf.s1};
  --surface-1: ${L.sf.s1};
  --surface-2: ${L.sf.s2};
  --surface-3: ${L.sf.s3};
  --surface-4: ${L.sf.s4};
  --surface-5: ${L.sf.s5};

  --text: ${hex(L.s.onSurface)};
  --text-2: ${tone(SEED, 30)};
  --text-soft: ${hex(L.s.onSurfaceVariant)};
  --text-dim: ${tone(SEED, 55)};

  --border: rgba(0, 0, 0, .10);
  --border-soft: rgba(0, 0, 0, .06);
  --hairline: rgba(0, 0, 0, .07);

  /* ---------- מותג ---------- */
  --primary: ${hex(L.s.primary)};
  --primary-contrast: ${hex(L.s.onPrimary)};
  --primary-soft: ${hex(L.s.primaryContainer)};
  --primary-softer: ${tone(SEED, 95)};

  /* ---------- סמנטיים, מוהרמנים לזרע ---------- */
  --accent: ${tone(ACCENT, 40)};
  --accent-soft: ${tone(ACCENT, 92)};
  --danger: ${hex(L.s.error)};
  --danger-soft: ${hex(L.s.errorContainer)};
  --ok: ${tone(OK, 38)};
  --ok-soft: ${tone(OK, 92)};
  --level: ${tone(LEVEL, 42)};
  --level-soft: ${tone(LEVEL, 93)};
  --badge: ${tone(BADGE, 45)};

  --lock: ${tone(SEED, 8)};
  --track: ${tone(SEED, 90)};

  /* ---------- נישות ---------- */
${L.niche}
  --niche-contrast: ${hex(L.s.onPrimary)};

  /* ---------- אורך ספר ---------- */
  --len-short-bg: ${tone('#2E7D52', 92)};   --len-short-ink: ${tone('#2E7D52', 28)};
  --len-long-bg: ${tone('#A83B4C', 92)};    --len-long-ink: ${tone('#A83B4C', 28)};

  /* ---------- שכבת מצב (M3 state layer) ---------- */
  --state-hover: 0.08;
  --state-press: 0.12;

  /* ---------- צורה (M3 shape scale) ---------- */
  /* רדיוסים הדוקים. 16-20px על כל דבר הוא ברירת המחדל של
     ספריות רכיבים, ולכן הוא נקרא כברירת מחדל. */
  --r-sm: 7px;
  --r-chip: 999px;
  --r-btn: 10px;
  --r-card: 14px;
  --r-xl: 20px;

  /* ---------- טיפוגרפיה (M3 type scale) ---------- */
  --font-ui: 'Heebo', system-ui, sans-serif;
  --font-read: 'Frank Ruhl Libre', Georgia, serif;

  --fs-h1: 30px;
  --fs-h2: 20px;
  --fs-sub: 15px;
  --fs-body: 14px;
  --fs-small: 12px;
  --fs-micro: 11px;
  --fs-number: 56px;

  /* מספרים וכותרות גדולים צריכים מרווח אותיות שלילי, אחרת הם
     נראים רפויים. זה אחד ההבדלים הכי מורגשים בין ממשק מעוצב
     לממשק שנכתב. */
  --ls-number: -.03em;
  --ls-h1: -.02em;
  --ls-h2: -.01em;

  /* סולם משקלים: 500 גוף · 600 תוויות · 700 כותרות */
  --w-body: 500;
  --w-label: 600;
  --w-head: 700;

  --lh-body: 1.45;
  --lh-read: 1.72;

  /* ---------- מרווח ---------- */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-6: 24px;
  --sp-8: 32px;

  /* ---------- מידות ---------- */
  --phone-max: 480px;
  --screen-pad: 20px;
  --tap-min: 44px;
  --btn-h: 48px;
  --nav-h: 58px;
  --nav-rise: 0px;
  --nav-space: calc(var(--nav-h) + var(--nav-rise) + var(--sp-3));

  /* ---------- גובה (M3 elevation) ---------- */
  --shadow-card: 0 1px 2px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.05);
  --shadow-sheet: 0 12px 32px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.06);
  --shadow-raised: 0 2px 6px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.06);

  /* ---------- תנועה (M3 motion) ---------- */
  --t-fast: 150ms;
  --t-base: 250ms;
  --ease: cubic-bezier(.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(.2, 0, 0, 1);
}

/* ================================================================
   מצב כהה
   ================================================================ */

.theme-dark {
  --m3-primary: ${hex(D.s.primary)};
  --m3-on-primary: ${hex(D.s.onPrimary)};
  --m3-primary-container: ${hex(D.s.primaryContainer)};
  --m3-on-primary-container: ${hex(D.s.onPrimaryContainer)};
  --m3-secondary: ${hex(D.s.secondary)};
  --m3-secondary-container: ${hex(D.s.secondaryContainer)};
  --m3-on-secondary-container: ${hex(D.s.onSecondaryContainer)};
  --m3-tertiary: ${hex(D.s.tertiary)};
  --m3-tertiary-container: ${hex(D.s.tertiaryContainer)};
  --m3-error: ${hex(D.s.error)};
  --m3-error-container: ${hex(D.s.errorContainer)};
  --m3-on-error-container: ${hex(D.s.onErrorContainer)};
  --m3-outline: ${hex(D.s.outline)};
  --m3-outline-variant: ${hex(D.s.outlineVariant)};

  --bg: ${D.sf.surface};
  --surface: ${D.sf.s1};
  --surface-1: ${D.sf.s1};
  --surface-2: ${D.sf.s2};
  --surface-3: ${D.sf.s3};
  --surface-4: ${D.sf.s4};
  --surface-5: ${D.sf.s5};

  /* ארבע מדרגות טקסט, לא שתיים. וטקסט ראשי אינו לבן טהור —
     לבן על שחור "מזמזם" ונראה זול. */
  --text: #F4F1EF;
  --text-2: #CFC7C1;
  --text-soft: #9C938C;
  --text-dim: #6B635D;

  /* בממשק כהה צל כמעט בלתי נראה. העומק מגיע מקו שיער לבן
     שקוף ומשכבות משטח — זו הסיבה שמסגרת אפורה מלאה על כל
     כרטיס נראית כמו טופס שנוצר אוטומטית. */
  --border: rgba(255, 255, 255, .09);
  --border-soft: rgba(255, 255, 255, .055);
  --hairline: rgba(255, 255, 255, .07);

  --primary: ${hex(D.s.primary)};
  --primary-contrast: ${hex(D.s.onPrimary)};
  --primary-soft: ${hex(D.s.primaryContainer)};
  --primary-softer: ${tone(SEED, 20)};

  --accent: ${tone(ACCENT, 80)};
  --accent-soft: ${tone(ACCENT, 25)};
  --danger: ${hex(D.s.error)};
  --danger-soft: ${hex(D.s.errorContainer)};
  --ok: ${tone(OK, 80)};
  --ok-soft: ${tone(OK, 25)};
  --level: ${tone(LEVEL, 80)};
  --level-soft: ${tone(LEVEL, 25)};
  --badge: ${tone(BADGE, 70)};

  --lock: ${tone(SEED, 4)};
  --track: ${tone(SEED, 25)};

${D.niche}
  --niche-contrast: ${hex(D.s.onPrimary)};

  --len-short-bg: ${tone('#2E7D52', 20)};   --len-short-ink: ${tone('#2E7D52', 78)};
  --len-long-bg: ${tone('#A83B4C', 20)};    --len-long-ink: ${tone('#A83B4C', 78)};

  /* צל + טבעת: הטבעת היא מה שבאמת נראה על רקע כהה */
  --shadow-card: 0 1px 2px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05);
  --shadow-sheet: 0 12px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.07);
  --shadow-raised: 0 2px 6px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.06);
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'css', 'tokens.css');
writeFileSync(OUT, css, 'utf8');
console.log('נוצר tokens.css');
console.log('');
console.log('בהיר: bg', L.sf.surface, '· primary', hex(L.s.primary), '· surface-2', L.sf.s2);
console.log('כהה : bg', D.sf.surface, '· primary', hex(D.s.primary), '· surface-2', D.sf.s2);
console.log('');
console.log('משטחים כהה:', [D.sf.surface, D.sf.s1, D.sf.s2, D.sf.s3, D.sf.s4].join(' '));
console.log('נישות כהה :', Object.values(NICHES).map((v) => tone(v, 80)).join(' '));
