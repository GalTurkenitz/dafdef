/**
 * fetch-benyehuda.mjs — מושך את הקטלוג והספרים מפרויקט בן-יהודה.
 *
 * ** רץ מקומית בלבד. המפתח לעולם לא נכנס לקוד הלקוח. **
 * הסקריפט כותב קבצים סטטיים ל-content/, והאתר קורא רק אותם.
 *
 * מפתח: מונפק חינם ומיידית ב-https://benyehuda.org/api_keys/new
 *   ונקרא מ-~/.secrets/benyehuda.txt או ממשתנה הסביבה BENYEHUDA_KEY.
 *
 * מגבלת קצב רשמית: 50 בקשות בדקה. הסקריפט עובד ב-40 בדקה.
 *
 * הרצה:
 *   node scripts/fetch-benyehuda.mjs --probe        בדיקת חיבור והצגת מבנה התשובה
 *   node scripts/fetch-benyehuda.mjs --catalog      משיכת הקטלוג בלבד
 *   node scripts/fetch-benyehuda.mjs --limit 200    משיכת הקטלוג + 200 ספרים
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { countWords, WPM } from '../js/logic/verify.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKS_DIR = join(ROOT, 'content', 'works');
const CATALOG = join(ROOT, 'content', 'catalog.json');

const BASE = 'https://benyehuda.org/api/v1';
const GAP_MS = 1500;                 // 40 בקשות בדקה — מתחת למגבלה של 50
const PAGE_SIZE_GUESS = 25;          // גודל עמוד שה-API מחזיר בפועל; מתעדכן מהתשובה

/** ספר, להבדיל משיר בודד או מאמר. סף שמרני — מכוונים אחרי הרצה ראשונה. */
const MIN_BOOK_WORDS = 5000;

/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const opt = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i === -1 ? dflt : args[i + 1];
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadKey() {
  if (process.env.BENYEHUDA_KEY) return process.env.BENYEHUDA_KEY.trim();
  const path = join(homedir(), '.secrets', 'benyehuda.txt');
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch {
    console.error(`
לא נמצא מפתח API.

  1. הנפק מפתח חינם ב-https://benyehuda.org/api_keys/new
  2. שמור אותו ב-${path}

או הרץ עם BENYEHUDA_KEY=<המפתח> node scripts/fetch-benyehuda.mjs
`);
    process.exit(1);
  }
}

let lastCall = 0;
async function call(path, body, method = 'POST') {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const url = method === 'GET'
    ? `${BASE}${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(body.key)}`
    : `${BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers: { accept: 'application/json', 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new Error('המפתח נדחה — בדוק שהוא נכון ופעיל');
  if (res.status === 429) {
    console.warn('  קצב גבוה מדי — ממתין 30 שניות');
    await sleep(30_000);
    return call(path, body, method);
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ *
 * נרמול
 * ------------------------------------------------------------------ */

/**
 * מבנה התשובה של בן-יהודה לא מתועד במלואו (ה-swagger שלהם מחזיר 500),
 * ולכן מנרמלים בסובלנות: מחפשים את השדה בכמה שמות אפשריים.
 */
const pick = (obj, ...names) => {
  for (const n of names) {
    const v = n.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    if (v != null && v !== '') return v;
  }
  return undefined;
};

function normalize(raw) {
  const id = pick(raw, 'id', 'text_id', 'manifestation_id');
  if (id == null) return null;

  const title = pick(raw, 'title', 'name', 'metadata.title');
  const author = pick(raw, 'author_string', 'author', 'authors.0.name', 'metadata.author') || '';
  const genre = pick(raw, 'genre', 'metadata.genre') || '';
  const words = Number(pick(raw, 'word_count', 'words', 'metadata.word_count')) || 0;

  return {
    id: 'by-' + id,
    sourceId: id,
    title: String(title || '').trim(),
    author: String(author).trim(),
    genre: String(genre).trim(),
    wordCount: words,
    estMinutes: words ? Math.max(1, Math.round(words / WPM)) : 0,
    url: pick(raw, 'url', 'link') || `https://benyehuda.org/read/${id}`,
  };
}

/* ------------------------------------------------------------------ *
 * משיכה
 * ------------------------------------------------------------------ */

async function probe(key) {
  console.log('בודק חיבור…\n');
  const res = await call('/search', {
    key, view: 'basic', file_format: 'html', snippet: false,
    page: 0, sort_by: 'alphabetical', sort_dir: 'default',
  });

  console.log('מפתחות ברמה העליונה:', Object.keys(res).join(', '));
  const list = Array.isArray(res) ? res : (res.data || res.results || res.texts || []);
  console.log('פריטים בעמוד:', list.length);
  if (list[0]) {
    console.log('\nמבנה הפריט הראשון:');
    console.log(JSON.stringify(list[0], null, 2).slice(0, 1600));
    console.log('\nאחרי נרמול:', JSON.stringify(normalize(list[0]), null, 2));
  }
}

async function fetchCatalog(key) {
  const out = [];
  let page = 0;

  for (;;) {
    const res = await call('/search', {
      key, view: 'basic', file_format: 'html', snippet: false,
      page, sort_by: 'alphabetical', sort_dir: 'default',
    });

    const list = Array.isArray(res) ? res : (res.data || res.results || res.texts || []);
    if (!list.length) break;

    for (const raw of list) {
      const item = normalize(raw);
      if (item && item.title) out.push(item);
    }

    process.stdout.write(`\r  עמוד ${page} · ${out.length} רשומות`);
    page += 1;

    const total = Number(pick(res, 'total_count', 'total', 'count'));
    if (Number.isFinite(total) && out.length >= total) break;
    if (list.length < PAGE_SIZE_GUESS) break;
  }

  console.log('');
  return out;
}

async function fetchText(key, item) {
  const res = await call(`/texts/${item.sourceId}?view=basic&file_format=html`, { key }, 'GET');

  const html = pick(res, 'html', 'content', 'text', 'body', 'snippet') || '';
  const plain = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = countWords(plain) || item.wordCount;

  return {
    ...item,
    wordCount: words,
    estMinutes: Math.max(1, Math.round(words / WPM)),
    source: 'פרויקט בן-יהודה — benyehuda.org',
    html: String(html),
  };
}

/* ------------------------------------------------------------------ */

const key = await loadKey();

if (has('--probe')) {
  await probe(key);
  process.exit(0);
}

await mkdir(WORKS_DIR, { recursive: true });

console.log('מושך קטלוג…');
const catalog = await fetchCatalog(key);

// ספרים בלבד (המפרט, סעיף 6)
const books = catalog
  .filter((w) => w.wordCount === 0 || w.wordCount >= MIN_BOOK_WORDS)
  .sort((a, b) => a.title.localeCompare(b.title, 'he'));

console.log(`\n${catalog.length} רשומות · ${books.length} מהן ספרים (≥${MIN_BOOK_WORDS} מילים)`);

await writeFile(CATALOG, JSON.stringify(books, null, 2), 'utf8');
console.log(`נשמר ${CATALOG}`);

if (has('--catalog')) process.exit(0);

const limit = Number(opt('--limit', '60'));
console.log(`\nמוריד ${limit} ספרים…`);

let done = 0, skipped = 0;
for (const item of books.slice(0, limit)) {
  const path = join(WORKS_DIR, item.id + '.json');
  try { await access(path); skipped += 1; continue; } catch { /* עוד לא הורד */ }

  try {
    const work = await fetchText(key, item);
    await writeFile(path, JSON.stringify(work), 'utf8');
    done += 1;
    process.stdout.write(`\r  ${done}/${limit} · ${item.title.slice(0, 40)}`.padEnd(70));
  } catch (err) {
    console.error(`\n  דילוג על ${item.title}: ${err.message}`);
  }
}

console.log(`\n\nהורדו ${done} ספרים, ${skipped} כבר היו קיימים.`);
