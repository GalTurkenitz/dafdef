/**
 * config.js — קבועים גלובליים של האפליקציה.
 * כל מספר שניתן לכוונון יושב כאן ולא מפוזר בקוד.
 */

export const APP_NAME = 'דפדף';
export const APP_TAGLINE = 'זמן מסך לא מקבלים, מרוויחים';

/** קידומת מפתחות localStorage (המפרט, סעיף 7) */
export const STORE_PREFIX = 'dafdef:';

/** מצבי תצוגה — שניים בלבד. */
export const THEMES = ['light', 'dark'];

/**
 * גרסת התוכן. מעלים אותה כשקבצי content/works משתנים,
 * כדי שמטמון היצירות בדפדפן לא יישאר עם גרסה ישנה.
 */
export const CONTENT_REV = 2;

/**
 * קידוד צבע לספר לפי זמן הקריאה המשוער.
 * ירוק = קצר · צהוב = בינוני · אדום = ארוך.
 */
export const BOOK_LENGTH = {
  shortMaxMinutes: 15,
  mediumMaxMinutes: 60,
};

/* ------------------------------------------------------------------ *
 * הנישות (המפרט, סעיף 3)
 *
 * channel קובע איך נכנסים לנישה:
 *   free       — כרטיס במסך הבית, זמין תמיד, צובר בלי הגבלה
 *   task       — קיימת רק כמשימת רוטציה
 *   background — צוברת מעצמה, ולא נכנסת לסבב היומי
 * ------------------------------------------------------------------ */

export const NICHES = {
  reading:   { id: 'reading',   name: 'קריאה',  channel: 'free', icon: 'book',
               unit: 'עמוד',   taskLabel: 'עמוד אחד',        href: 'reader.html' },

  fitness:   { id: 'fitness',   name: 'כושר',   channel: 'free', icon: 'activity',
               unit: 'חזרה',   taskLabel: '10 שכיבות',       href: 'task.html?niche=fitness' },

  learning:  { id: 'learning',  name: 'למידה',  channel: 'free', icon: 'brain',
               unit: 'סט',     taskLabel: 'סט של 10 שאלות',  href: 'task.html?niche=learning' },

  writing:   { id: 'writing',   name: 'כתיבה',  channel: 'free', icon: 'pen',
               unit: 'רישום',  taskLabel: 'רישום יומן',      href: 'task.html?niche=writing' },

  breathing: { id: 'breathing', name: 'מדיטציה', channel: 'task', icon: 'wind',
               unit: 'תרגיל',  taskLabel: 'תרגיל מדיטציה',   href: 'task.html?niche=breathing' },

  water:     { id: 'water',     name: 'מים',    channel: 'task', icon: 'droplet',
               unit: 'כוס',    taskLabel: 'כוס מים',         href: 'task.html?niche=water' },

  steps:     { id: 'steps',     name: 'צעדים',  channel: 'background', icon: 'footprints',
               unit: '1,000 צעדים', taskLabel: 'צעדים' },

  sleep:     { id: 'sleep',     name: 'שינה',   channel: 'background', icon: 'moon',
               unit: 'לילה',   taskLabel: 'שינה' },
};

export const NICHE_IDS = Object.keys(NICHES);

/** נישות שנכנסות לסבב היומי — כלומר הכל חוץ מצעדים ושינה */
export const ROUND_NICHE_IDS = NICHE_IDS.filter((id) => NICHES[id].channel !== 'background');

/* ------------------------------------------------------------------ *
 * שערי הרווח (המפרט, סעיף 6)
 *
 * base = דקות ליחידה אחת, לפני המקדמים מהשאלון.
 * taskUnits = כמה יחידות דרושות כדי להשלים משימת רוטציה.
 * ------------------------------------------------------------------ */

export const GATES = {
  reading:   { base: 5,  taskUnits: 1 },    // עמוד
  fitness:   { base: 1,  taskUnits: 10 },   // חזרה; משימה = 10 חזרות
  breathing: { base: 5,  taskUnits: 1 },    // תרגיל מדיטציה
  learning:  { base: 5,  taskUnits: 1 },    // סט של 10 שאלות
  writing:   { base: 5,  taskUnits: 1 },    // רישום
  water:     { base: 3,  taskUnits: 1 },    // כוס
  steps:     { base: 20, taskUnits: 1 },    // 1,000 צעדים מעל קו הבסיס
  sleep:     { base: 20, taskUnits: 1 },    // עמידה ביעד
};

/** מקדמים מהשאלון, מוכפלים על כל השערים */
export const GOAL_FACTOR = {
  wean: 0.5,      // לגמול את עצמי מהטלפון
  reduce: 0.67,   // לצמצם דרסטית
  balance: 1.0,   // לאזן
  routine: 1.15,  // לבנות שגרה יציבה
  habits: 1.33,   // להוסיף הרגלים טובים
};

export const STRICTNESS_FACTOR = {
  soft: 1.25,
  medium: 1.0,
  tough: 0.85,
  tougher: 0.7,
  brutal: 0.5,
};

/** בונוס על השלמת סבב מלא. 0 מכבה אותו. */
export const ROUND_BONUS_MINUTES = 15;

/** זמן קירור בין כוסות מים (המפרט, סעיף 10.5) */
export const WATER_COOLDOWN_MS = 30 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * ספי אימות למודולים (המפרט, סעיף 10)
 * ------------------------------------------------------------------ */

export const LEARNING = {
  questionsPerSet: 10,
  minCorrect: 8,          // מתחת לזה — הסט לא הושלם
};

export const WRITING = {
  minWords: 50,
  minSeconds: 60,
  maxCharsPerSecond: 12,  // מעל זה זו לא הקלדה אנושית
};

export const BREATHING = {
  totalSeconds: 120,
  pattern: { inhale: 4, hold: 7, exhale: 8 },   // 4-7-8
};

/** ברירות מחדל לנישות הרקע, עד שהמשתמש מגדיר בשאלון */
export const BACKGROUND_DEFAULTS = {
  steps: { baseline: 4000 },
  sleep: { targetHours: 7, windowStart: '23:00', windowEnd: '08:00' },
};

/* ------------------------------------------------------------------ *
 * אבני דרך ורמה (V4, סעיפים 1.4-1.5)
 *
 * לכל מונה יש צעד בסיס s. חמש אבני הדרך הראשונות הן s, 2s ... 5s,
 * ומהשישית והלאה הצעד הוא 5s. זה כלל אחד לכל הנישות, ולכן כאן
 * נשמר רק הצעד ולא הרשימה המלאה.
 * ------------------------------------------------------------------ */

export const MILESTONES = {
  'fitness.pushups': 20,      // 20 · 40 · 60 · 80 · 100 ⇐ 200 · 300…
  'fitness.squats':  20,      // סולם נפרד וזהה
  reading:            2,      // עמודים
  writing:          100,      // מילים
  learning:          20,      // תשובות נכונות
  water:              2,      // כוסות
  breathing:          2,      // תרגילים שהושלמו
  sleep:              2,      // שעות מצטברות מעל היעד
  steps:           2000,      // צעדים מצטברים מעל קו הבסיס
};

/** נקודות על אבן דרך — קבוע לכל אבן דרך */
export const MILESTONE_POINTS = 100;

/** נקודות לפעולה */
export const XP = {
  task: 10,            // משימה שהושלמה (רוטציה או מסלול)
  level: 12,           // שלב שהושלם במסלול ההתקדמות
  round: 20,           // סבב יומי מלא
  milestone: MILESTONE_POINTS,
  leagueWin: 250,      // ניצחון שבועי בליגה
};

/** ספי הרמות הראשונות (נקודות מצטברות לרמה 2, 3, 4, 5, 6) */
export const LEVEL_FIRST_STEPS = [100, 200, 300, 400, 500];

/** מרמה 7 והלאה — כל רמה דורשת עוד כך וכך נקודות */
export const LEVEL_BASE_STEP = 500;

/** כמה שורות מוצגות בטבלת הליגה לפני דפדוף */
export const LEAGUE_PAGE_SIZE = 10;

/**
 * המדדים שאפשר לבחור בהם כשיוצרים ליגה (V4, סעיף 2.3א).
 * key מצביע על מונה שבועי; niche משמש לצבע ולאייקון.
 */
export const LEAGUE_METRICS = [
  { id: 'xp',               label: 'נקודות',            niche: null },
  { id: 'fitness.pushups',  label: 'שכיבות סמיכה',      niche: 'fitness' },
  { id: 'reading',          label: 'עמודי קריאה',       niche: 'reading' },
  { id: 'writing',          label: 'מילים בכתיבה',      niche: 'writing' },
  { id: 'learning',         label: 'תשובות נכונות',     niche: 'learning' },
  { id: 'breathing',        label: 'תרגילי מדיטציה',    niche: 'breathing' },
  { id: 'water',            label: 'כוסות מים',         niche: 'water' },
  { id: 'steps',            label: 'צעדים מעל הבסיס',   niche: 'steps' },
  { id: 'sleep',            label: 'שעות מעל היעד',     niche: 'sleep' },
];
