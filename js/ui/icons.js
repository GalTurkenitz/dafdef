/**
 * icons.js — אייקוני Lucide כ-SVG מוטמע, עובי קו 1.75 (המפרט, סעיף 3).
 * מקור: lucide.dev (ISC). מועתקים ידנית כדי לא להוסיף תלות חיצונית.
 */

const PATHS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',

  /* ---------- הנישות ---------- */
  activity:   '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  brain:      '<path d="M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 5.6 16 3 3 0 0 0 9 20.5a2.5 2.5 0 0 0 3-2.5V4.5A1.5 1.5 0 0 0 10.5 3z"/><path d="M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3 3 0 0 1-1.1 4.8A3 3 0 0 1 15 20.5a2.5 2.5 0 0 1-3-2.5V4.5A1.5 1.5 0 0 1 13.5 3z"/>',
  pen:        '<path d="M12.5 5.5 18 11l-9 9H3.5v-5.5z"/><path d="m15 3 6 6"/>',
  wind:       '<path d="M4 8h9a3 3 0 1 0-3-3"/><path d="M2 12.5h13.5a3 3 0 1 1-3 3"/><path d="M4 17h6"/>',
  droplet:    '<path d="M12 2.7 6.9 8.3a7 7 0 1 0 10.2 0z"/>',
  footprints: '<path d="M5 15c.3-2 0-3.5-.6-5C3.7 8.4 4.4 6 6.4 6c1.9 0 2.6 2 2.2 4-.3 1.6-.6 3-.3 5z"/><path d="M5.3 18.8c1.4.4 2.7.1 3-1.2H5.1c-.1.5 0 1 .2 1.2z"/><path d="M15.4 11c.3-2 0-3.5-.6-5-.7-1.6 0-4 2-4 1.9 0 2.6 2 2.2 4-.3 1.6-.6 3-.3 5z"/><path d="M15.7 14.8c1.4.4 2.7.1 3-1.2h-3.2c-.1.5 0 1 .2 1.2z"/>',
  moon:       '<path d="M20.5 14.8A8.5 8.5 0 0 1 9.2 3.5a8.5 8.5 0 1 0 11.3 11.3z"/>',
  menu:       '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  flag:       '<path d="M5 21V4"/><path d="M5 4h10l-1.6 3.2L15 10.5H5z"/>',
  target:     '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
};

/**
 * @param {keyof PATHS} name
 * @param {number} [size=24]
 * @returns {string} מחרוזת SVG מוכנה להטמעה
 */
export function icon(name, size = 24) {
  const body = PATHS[name];
  if (!body) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const iconNames = Object.keys(PATHS);
