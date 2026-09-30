/**
 * anatomy.js — המפה בין נישה לאזור בגוף.
 *
 * ─────────────────────────────────────────────────────────────────
 *  למה זה קובץ נפרד
 *
 *  זו הידיעה עצמה, לא התצוגה שלה. body3d.js מצייר אותה, stats.js
 *  מציג אותה בטקסט, והשאלון יקרא ממנה בהמשך כדי לקבוע נקודת
 *  פתיחה לכל אזור. שלושתם חייבים לראות בדיוק אותו דבר.
 * ─────────────────────────────────────────────────────────────────
 *  ניסוח: "מפעיל", לא "משפר"
 *
 *  כל השדות אומרים איזה אזור הפעילות **מפעילה**, ולא בכמה הוא
 *  השתפר אצל המשתמש הזה. ההבדל אינו סמנטי:
 *
 *    1. זה מה שהמחקר באמת מראה. הדמיה מראה איפה יש פעילות; היא
 *       אינה מבטיחה לאדם מסוים שנפח אזור אצלו גדל.
 *    2. "האזור הזה אצלך השתפר" היא טענה בריאותית, וחנות Play
 *       בודקת טענות בריאותיות. "הפעילות הזו מפעילה את X" אינה.
 *
 *  המקורות יושבים ליד כל אזור כדי שאפשר יהיה לבדוק אותם, ולא
 *  כדי להציג אותם במסך.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * @typedef {object} Region
 * @property {string} niche   הנישה שמזינה את האזור
 * @property {string} label   שם האזור בעברית
 * @property {string} what    מה הפעילות מפעילה שם — משפט אחד
 * @property {string[]} parts שמות המשנים בתלת-מימד ששייכים לאזור
 * @property {string} [metric] איזה נתון מתוך הנישה שייך דווקא לכאן
 * @property {string} source  מאיפה זה — לבדיקה, לא לתצוגה
 */

/** @type {Record<string, Region>} */
export const REGIONS = {
  /* ---------- מוח ---------- */

  'brain-reading': {
    niche: 'reading',
    label: 'אזור זיהוי המילים',
    what: 'קריאה מפעילה את הגירוס הצירי השמאלי — האזור שמזהה מילים '
        + 'כתובות במבט אחד — ומשם את רשת השפה: הגירוס המצחי התחתון '
        + 'והגירוס הזוויתי.',
    parts: ['brainOccipito'],
    source: 'Dehaene & Cohen, Trends Cogn Sci 2011 · Nat Commun 2019 · '
          + 'VWFA ב-left occipitotemporal sulcus, MNI −42 −54 −12',
  },

  'brain-writing': {
    niche: 'writing',
    label: 'האזור המוטורי של הכתיבה',
    what: 'כתיבה מפעילה את הקליפה הקדם-מוטורית ואת החריץ התוך-קודקודי '
        + 'השמאלי, ואיתם את אזור אקסנר שממיר אות לפקודת תנועה. היד '
        + 'שכותבת מפעילה גם את אזור זיהוי המילים.',
    parts: ['brainFrontal'],
    source: 'Planton et al., "The handwriting brain" meta-analysis (18 מחקרים) · '
          + 'Nat Commun Biol 2021, Exner’s area',
  },

  'brain-learning': {
    niche: 'learning',
    label: 'היפוקמפוס וקליפה קדם-מצחית',
    what: 'שליפה מהזיכרון — להיזכר במילה ולא לקרוא אותה — מחזקת את '
        + 'ההיפוקמפוס הקדמי והאחורי, ומפעילה את הקליפה הקדם-מצחית '
        + 'הגבית-צדית. זו הסיבה שהמודול שואל ולא מציג.',
    parts: ['brainHippo'],
    source: 'PMC7821628 (retrieval practice, anterior+posterior hippocampus) · '
          + 'Cereb Cortex Commun 2022 · dlPFC בשליפת אוצר מילים',
  },

  'brain-sleep': {
    niche: 'sleep',
    label: 'גזע המוח וגלי השינה',
    what: 'בשינה העמוקה הזיכרון עובר מההיפוקמפוס לקליפה, ומערכת '
        + 'הניקוי הגלימפטית עובדת פי כמה מאשר בערות — רוב הפינוי '
        + 'קורה דווקא אז.',
    parts: ['brainStem'],
    source: 'Neuron 2023, systems memory consolidation · PMC7698404, '
          + 'glymphatic clearance עולה ב-80–90% בשינה',
  },

  /* ---------- איברים פנימיים ---------- */

  lungs: {
    niche: 'breathing',
    label: 'ריאות',
    what: 'תרגול נשימה קשוב מפעיל את האינסולה ואת הקליפה החגורה '
        + 'הקדמית — האזורים שקוראים את מצב הגוף מבפנים — ומחליש את '
        + 'תגובת האמיגדלה ללחץ.',
    parts: ['lungs'],
    source: 'Gotink et al. 2016, MBSR 8 שבועות · PMC4341506, '
          + 'זרימת דם ב-ACC ובאינסולה',
  },

  heart: {
    niche: 'steps',
    label: 'לב',
    what: 'הליכה אירובית קבועה מחזקת את הלב, ובמקביל נמצא שהיא '
        + 'מעלה BDNF ומגדילה את נפח ההיפוקמפוס הקדמי — האיבר '
        + 'היחיד שמשפיע גם על הגוף וגם על הזיכרון.',
    parts: ['heart'],
    source: 'Erickson et al., PNAS 2011 (RCT, 120 משתתפים) · '
          + 'PMC4263078, BDNF ותפקוד ניהולי',
  },

  kidneys: {
    niche: 'water',
    label: 'כליות',
    what: 'הכליות מסננות את הנוזלים ומווסתות את מאזן המים והמלחים. '
        + 'שתייה מספקת היא מה שמאפשר להן לעבוד בלי להתאמץ.',
    parts: ['kidneys'],
    source: 'פיזיולוגיה בסיסית — סינון גלומרולרי ומאזן נוזלים',
  },

  /* ---------- שרירים ----------
     שתי קבוצות נפרדות ולא אחת: שכיבות וסקוואטים אינם אותם
     שרירים, ולכל קבוצה מונה משלה. */

  chest: {
    niche: 'fitness',
    metric: 'pushups',
    label: 'חזה, כתף קדמית ותלת-ראשי',
    what: 'שכיבות סמיכה עובדות על החזה הגדול — שלושת ראשיו — על '
        + 'החלק הבריחי של הדלתא, ועל שלושת ראשי התלת-ראשי. אלה '
        + 'השרירים שדוחפים.',
    parts: ['musclePec', 'muscleArm'],
    source: 'Harvard Health, resistance training guidance · '
          + 'pectoralis major, anterior deltoid, triceps brachii',
  },

  legs: {
    niche: 'fitness',
    metric: 'squats',
    label: 'ארבע-ראשי והמסטרינג',
    what: 'סקוואטים עובדים על הארבע-ראשי — ישר הירך ושלושת '
        + 'הרחבים — ועל ההמסטרינג: דו-ראשי הירך, חצי-גידי '
        + 'וחצי-קרומי.',
    parts: ['muscleLegs'],
    source: 'BioRxiv 2023 / PMC10593473, squat vs hip thrust hypertrophy',
  },
};

/** כל מזהי האזורים, בסדר קבוע */
export const REGION_IDS = Object.keys(REGIONS);

/** מאיזה אזור מגיע חלק תלת-מימדי נתון */
export const regionOfPart = (() => {
  const map = new Map();
  for (const [id, r] of Object.entries(REGIONS)) {
    for (const p of r.parts) map.set(p, id);
  }
  return (part) => map.get(part) || null;
})();
