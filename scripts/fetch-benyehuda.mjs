/**
 * fetch-benyehuda.mjs — בונה את קטלוג הספרים מפרויקט בן-יהודה.
 *
 * ─────────────────────────────────────────────────────────────────
 *  ספרים בלבד
 *
 *  במאגר 66,138 יצירות, ורובן אינן ספרים: במדגם יצא 44% שירה,
 *  36% מאמרים, 8% עיון ורק 12% פרוזה. לכן מסננים **לפי ז'אנר**
 *  ואז **לפי אורך אמיתי** — לא לפי הצהרה.
 *
 *  ה-API לא מחזיר אורך כלל. הגרסה הקודמת של הקובץ הזה סיננה
 *  `wordCount === 0 || wordCount >= 5000`, כלומר "אורך לא ידוע —
 *  תעביר", ומכיוון שהאורך תמיד לא ידוע **הכל היה עובר**. כאן כל
 *  יצירה נמדדת בפועל לפני שהיא נכנסת.
 *
 *  נמדד על 25 היצירות הפופולריות: 68% מהפרוזה הם ספרים.
 * ─────────────────────────────────────────────────────────────────
 *  למה רק מטא-דאטה
 *
 *  ספר ממוצע שוקל ~700KB. 300 ספרים הם 210MB — יותר מכל האפליקציה.
 *  לכן הקטלוג מחזיק מטא-דאטה ו-downloadUrl בלבד, והטקסט נמשך
 *  בפתיחה ראשונה ונשמר במטמון המקומי.
 *
 *  **downloadUrl ציבורי ואינו דורש מפתח**, ולכן המפתח נשאר
 *  ב-~/.secrets/benyehuda.txt ולעולם לא נכנס לקוד הלקוח.
 * ─────────────────────────────────────────────────────────────────
 *
 * שימוש:
 *   node scripts/fetch-benyehuda.mjs            # 300 ספרים
 *   node scripts/fetch-benyehuda.mjs --limit 80
 *   node scripts/fetch-benyehuda.mjs --probe
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WPM } from '../js/logic/verify.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'content', 'catalog.json');
const BASE = 'https://benyehuda.org/api/v1';

/** מתחת לזה זה סיפור קצר או מאמר, לא ספר */
const MIN_BOOK_WORDS = 5000;

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const countWords = (t) => (String(t).match(/[֐-׿a-zA-Z0-9']+/g) || []).length;

async function loadKey() {
  if (process.env.BENYEHUDA_KEY) return process.env.BENYEHUDA_KEY.trim();
  try {
    return (await readFile(join(homedir(), '.secrets', 'benyehuda.txt'), 'utf8')).trim();
  } catch {
    console.error(`
לא נמצא מפתח API.

  1. הנפק מפתח חינם ב-https://benyehuda.org/api_keys/new
  2. שמור אותו ב-~/.secrets/benyehuda.txt

**לא בריפו.**`);
    process.exit(1);
  }
}

/**
 * עמוד תוצאות אחד, פרוזה בלבד, לפי פופולריות.
 *
 * **הדפדוף הוא לפי סמן ולא לפי מספר עמוד.** `page: 1` מחזיר בדיוק
 * את אותן תוצאות כמו `page: 0` — נמדד — ולכן הגרסה הקודמת אספה
 * 25 פריטים וחשבה שנגמר המאגר. הסמן חוזר בשדה
 * next_page_search_after ונשלח חזרה כ-search_after.
 */
async function searchPage(key, cursor) {
  const res = await fetch(`${BASE}/search?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key, view: 'basic', file_format: 'html', snippet: false,
      sort_by: 'popularity', sort_dir: 'default',
      genres: ['prose'],
      ...(cursor ? { search_after: cursor } : { page: 0 }),
    }),
  });

  if (res.status === 429) { await sleep(30_000); return searchPage(key, cursor); }
  if (!res.ok) throw new Error(`search ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

/** מוריד את הטקסט וסופר מילים. מחזיר null אם אינו ספר. */
async function measure(item) {
  const url = item.download_url;
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) return null;

  const html = await res.text();
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const words = countWords(plain);
  if (words < MIN_BOOK_WORDS) return { words, book: false };

  const m = item.metadata || {};
  return {
    words,
    book: true,
    entry: {
      id: 'by-' + item.id,
      title: String(m.title || '').trim(),
      author: String(m.author_string || '').trim(),
      genre: 'פרוזה',
      wordCount: words,
      estMinutes: Math.max(1, Math.round(words / WPM)),
      source: 'פרויקט בן-יהודה — benyehuda.org',
      url: item.url || `https://benyehuda.org/read/${item.id}`,
      /* התוכן נמשך מכאן בפתיחה ראשונה ונשמר במטמון */
      downloadUrl: url,
    },
  };
}

/* ------------------------------------------------------------------ */

const key = await loadKey();

if (has('--probe')) {
  const d = await searchPage(key, null);
  console.log('פרוזה במאגר:', d.total_count);
  console.log('פריט לדוגמה:', JSON.stringify(d.data?.[0], null, 2).slice(0, 700));
  process.exit(0);
}

const limit = Number(opt('--limit', '300'));
console.log(`מחפש ${limit} ספרים (פרוזה, ${MIN_BOOK_WORDS}+ מילים)…\n`);

const books = [];
const seen = new Set();
let checked = 0;
let cursor = null;
let pages = 0;

outer:
for (;;) {
  const d = await searchPage(key, cursor);
  const list = d.data || [];
  if (!list.length) break;

  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    try {
      const r = await measure(item);
      checked += 1;
      if (r?.book) {
        books.push(r.entry);
        console.log(`  ${String(books.length).padStart(3)}. ${r.entry.title.slice(0, 38).padEnd(40)} ${String(r.words).padStart(7)} מילים`);
      }
    } catch { /* פריט שנכשל אינו סיבה לעצור */ }

    if (books.length >= limit) break outer;
    await sleep(350);
  }

  cursor = d.next_page_search_after;
  if (!cursor) break;
  pages += 1;
  if (pages > 400) break;
}

books.sort((a, b) => a.title.localeCompare(b.title, 'he'));
await writeFile(CATALOG, JSON.stringify(books, null, 2), 'utf8');

console.log(`\nנבדקו ${checked} · ${books.length} ספרים (${Math.round(books.length / checked * 100)}%)`);
console.log(`נשמר ${CATALOG}`);
