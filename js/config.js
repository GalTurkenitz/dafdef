/**
 * config.js — קבועים גלובליים של האפליקציה.
 * שם המוצר הוא placeholder לפי המפרט (סעיף 1) — מוחלף כאן בלבד.
 */

export const APP_NAME = 'דפדף';
export const APP_TAGLINE = 'קרא כדי לפתוח';

/** קידומת מפתחות localStorage (המפרט, סעיף 4) */
export const STORE_PREFIX = 'dafdef:';

/** מצבי תצוגה. ספיה זמין בקורא בלבד (המפרט, סעיף 3). */
export const THEMES = ['light', 'dark', 'sepia'];

/**
 * גרסת התוכן. מעלים אותה כשקבצי content/works משתנים,
 * כדי שמטמון היצירות בדפדפן לא יישאר עם גרסה ישנה.
 */
export const CONTENT_REV = 2;
