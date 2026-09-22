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

  breathing: { id: 'breathing', name: 'נשימות', channel: 'task', icon: 'wind',
               unit: 'תרגיל',  taskLabel: 'תרגיל נשימות',    href: 'task.html?niche=breathing' },

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
