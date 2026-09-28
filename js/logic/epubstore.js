/**
 * epubstore.js — שמירת קובצי EPUB שהמשתמש ייבא.
 *
 * ─────────────────────────────────────────────────────────────────
 *  הבאג שזה מתקן
 *
 *  ייבוא EPUB רשם את הספר ברשימת "הספרים שלי" דרך touchBook, אבל
 *  **הקובץ עצמו מעולם לא נשמר**. אחרי רענון הספר הופיע ברשימה
 *  ולא נפתח: אין לו קובץ ב-content/works ואין לו ערך בקטלוג.
 *
 *  localStorage לא מתאים כאן — הוא מוגבל לכמה מגה-בייט ומחזיק
 *  מחרוזות בלבד, ו"הנסיך הקטן" לבדו שוקל 43MB. IndexedDB מחזיק
 *  Blob בלי המרה ובלי התקרה הזו.
 * ─────────────────────────────────────────────────────────────────
 */

const DB = 'dafdef-epubs';
const STORE = 'files';

function open() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB, 1); }
    catch (e) { reject(e); return; }

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  }));
}

/** @param {string} id מזהה הספר (epub:<שם הקובץ>) */
export async function saveEpub(id, blob) {
  try { await run('readwrite', (s) => s.put(blob, id)); return true; }
  catch { return false; }
}

/** @returns {Promise<Blob|null>} */
export async function loadEpub(id) {
  try { return (await run('readonly', (s) => s.get(id))) || null; }
  catch { return null; }
}

export async function removeEpub(id) {
  try { await run('readwrite', (s) => s.delete(id)); return true; }
  catch { return false; }
}

/** האם מזהה הספר הוא של קובץ מיובא */
export const isImported = (id) => String(id || '').startsWith('epub:');
