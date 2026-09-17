/**
 * config.js — קבועים גלובליים של האפליקציה.
 * שם המוצר הוא placeholder לפי המפרט (סעיף 1) — מוחלף כאן בלבד.
 */

export const APP_NAME = 'דפדף';
export const APP_TAGLINE = 'קרא כדי לפתוח';

/** קידומת מפתחות localStorage (המפרט, סעיף 4) */
export const STORE_PREFIX = 'dafdef:';

/** מצבי תצוגה — שניים בלבד. */
export const THEMES = ['light', 'dark'];

/**
 * קידוד צבע לספר לפי זמן הקריאה המשוער.
 * ירוק = קצר · צהוב = בינוני · אדום = ארוך.
 * הספים כאן כדי שיהיה קל לכוונן אותם.
 */
export const BOOK_LENGTH = {
  shortMaxMinutes: 15,
  mediumMaxMinutes: 60,
};

/**
 * גרסת התוכן. מעלים אותה כשקבצי content/works משתנים,
 * כדי שמטמון היצירות בדפדפן לא יישאר עם גרסה ישנה.
 */
export const CONTENT_REV = 2;
