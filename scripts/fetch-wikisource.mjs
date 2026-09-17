/**
 * fetch-wikisource.mjs — מקור תוכן זמני, עד שמפתח בן-יהודה מגיע.
 *
 * ויקיטקסט העברי הוא בעיקרו ארכיון ספרי קודש; הספרות היפה שבו מועטה.
 * הסקריפט הזה מרכיב ממנו את הספרים שכן קיימים: כל ספר מוגדר כשורש
 * שהפרקים שלו הם תת-דפים, והם משורשרים לספר אחד לפי הסדר.
 *
 * בשלב שבו מפתח בן-יהודה קיים, fetch-benyehuda.mjs מחליף את הקובץ הזה.
 *
 * הרצה:  node scripts/fetch-wikisource.mjs
 */

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { countWords, WPM } from '../js/logic/verify.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKS_DIR = join(ROOT, 'content', 'works');
const CATALOG = join(ROOT, 'content', 'catalog.json');

const API = 'https://he.wikisource.org/w/api.php';
const UA = 'dafdef-demo/0.1 (webforyoutwo@gmail.com)';
const GAP_MS = 450;

/** מתחת לזה זה לא ספר אלא דף תוכן עניינים — לא נכנס לקטלוג */
const MIN_BOOK_WORDS = 1000;

/**
 * הספרים. `root` עם לוכסן בסוף = ספר שמורכב מתת-דפים.
 * בלי לוכסן = דף בודד.
 */
const BOOKS = [
  { id: 'ws-bialik-proza',   root: 'פרוזה (ביאליק)/',
    title: 'פרוזה', author: 'חיים נחמן ביאליק', genre: 'פרוזה' },

  { id: 'ws-bialik-safiach', root: 'פרוזה (ביאליק)/ספיח',
    title: 'ספיח', author: 'חיים נחמן ביאליק', genre: 'פרוזה' },

  { id: 'ws-bialik-gader',   root: 'פרוזה (ביאליק)/מאחורי הגדר',
    title: 'מאחורי הגדר', author: 'חיים נחמן ביאליק', genre: 'פרוזה' },

  { id: 'ws-bialik-aggada',  root: 'על האגדה/',
    title: 'על האגדה', author: 'חיים נחמן ביאליק', genre: 'מסות' },

  { id: 'ws-bialik-shirim',  root: 'שירים ופזמונות לילדים (ביאליק)/',
    title: 'שירים ופזמונות לילדים', author: 'חיים נחמן ביאליק', genre: 'שירה' },

  { id: 'ws-bialik-matmid',  root: 'המתמיד',
    title: 'המתמיד', author: 'חיים נחמן ביאליק', genre: 'שירה' },

  { id: 'ws-iliad',          root: 'כל כתבי שאול טשרניחובסקי/כרך ג: איליאדה/',
    title: 'האיליאדה', author: 'הומרוס · תרגום שאול טשרניחובסקי', genre: 'אפוס' },

  { id: 'ws-odyssey',        root: 'כל כתבי שאול טשרניחובסקי/כרך ד: אודיסיה/',
    title: 'האודיסיאה', author: 'הומרוס · תרגום שאול טשרניחובסקי', genre: 'אפוס' },

  { id: 'ws-katzenelson',    root: 'כל כתבי י"ל קאצענעלסאן/',
    title: 'כל כתבי י"ל קאצענעלסון', author: 'יהודה ליב קצנלסון', genre: 'פרוזה' },
];

/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastCall = 0;
async function api(params) {
  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const url = new URL(API);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`ויקיטקסט ${res.status}`);
  return res.json();
}

/** כל תת-הדפים של שורש, לפי סדר אלפביתי של ויקיטקסט */
async function subPages(prefix) {
  const out = [];
  let cont;
  do {
    const r = await api({ action: 'query', list: 'allpages', apnamespace: '0',
                          apprefix: prefix, aplimit: '500', ...(cont ? { apcontinue: cont } : {}) });
    out.push(...r.query.allpages.map((p) => p.title));
    cont = r.continue?.apcontinue;
  } while (cont);
  return out;
}

/**
 * משאיר רק את מה שנקרא בפועל — בלי ניווט, הערות שוליים וקטגוריות.
 *
 * שתי מלכודות בוויקיטקסט:
 *  1. חלק מהיצירות (האיליאדה, המחזות) עטופות ב-<table> לצורך פריסה,
 *     ולכן אסור לזרוק טבלאות — צריך לפרק אותן.
 *  2. שירה מגיעה כ-<div class="poem"> עם <br /> בין השורות, לא כפסקאות.
 */
function cleanHtml(raw, verse = false) {
  let html = raw;

  // מה שבאמת לא שייך לטקסט
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<sup[\s\S]*?<\/sup>/gi, '');
  html = html.replace(/<span class="mw-editsection"[\s\S]*?<\/span>/gi, '');
  html = html.replace(/<div class="(?:printfooter|catlinks|navbox|mw-references-wrap|reflist)"[\s\S]*?<\/div>/gi, '');
  html = html.replace(/<ol class="references"[\s\S]*?<\/ol>/gi, '');

  // שירה: כל <br /> הוא שורה נפרדת
  html = html.replace(/<div class="poem">([\s\S]*?)<\/div>/gi, (_m, inner) =>
    inner.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_p, body) =>
      body.split(/<br\s*\/?>/i).map((line) => '<dd>' + line + '</dd>').join('')));

  // מפרקים טבלאות פריסה במקום לזרוק אותן
  html = html.replace(/<\/?(?:table|tbody|thead|tr|td|th)\b[^>]*>/gi, '\n');

  const keep = [];
  const re = /<(p|h2|h3|blockquote|dd|dl)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    let inner = m[2]
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
      .replace(/<(?!\/?(?:b|i|em|strong)\b)[^>]+>/gi, ' ')
      .replace(/&#160;|&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?׃־])/g, '$1')
      .trim();

    // מספרי שורות שוליים בתרגומי השירה ("… 15")
    inner = inner.replace(/\s+\d{1,4}$/, '');

    if (!inner || inner.length < 2) continue;
    if (tag === 'h2' || tag === 'h3') keep.push('<h3>' + inner + '</h3>');
    else if (verse || tag === 'blockquote' || tag === 'dd' || tag === 'dl') keep.push('<p class="verse">' + inner + '</p>');
    else keep.push('<p>' + inner + '</p>');
  }
  return keep.join('\n');
}

async function fetchPage(title, verse) {
  const j = await api({ action: 'parse', prop: 'text', page: title });
  if (!j.parse) return null;
  return cleanHtml(j.parse.text, verse);
}

const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ */

await rm(WORKS_DIR, { recursive: true, force: true });
await mkdir(WORKS_DIR, { recursive: true });

const catalog = [];

for (const book of BOOKS) {
  const isVerse = book.genre === 'שירה' || book.genre === 'אפוס';
  const parts = [];

  try {
    if (book.root.endsWith('/')) {
      // ספר מרובה פרקים — עומק אחד בלבד, הפרקים עצמם
      const all = await subPages(book.root);
      const chapters = all.filter((t) => !t.slice(book.root.length).includes('/'));

      for (const title of chapters) {
        const html = await fetchPage(title, isVerse);
        if (!html) continue;
        const name = title.slice(book.root.length);
        parts.push('<h3>' + name + '</h3>\n' + html);
        process.stdout.write(`\r  ${book.title} — ${parts.length}/${chapters.length} פרקים`.padEnd(64));
      }
    } else {
      const html = await fetchPage(book.root, isVerse);
      if (html) parts.push(html);
      process.stdout.write(`\r  ${book.title}`.padEnd(64));
    }
  } catch (err) {
    console.error(`\n  שגיאה ב-${book.title}: ${err.message}`);
  }

  if (!parts.length) {
    console.log(`\r  ${book.title} — לא נמצא, מדלג`.padEnd(64));
    continue;
  }

  const html = parts.join('\n');
  const wordCount = countWords(plain(html));
  const estMinutes = Math.max(1, Math.round(wordCount / WPM));

  if (wordCount < MIN_BOOK_WORDS) {
    console.log(`\r  ${book.title} — ${wordCount} מילים בלבד, כנראה דף תוכן. מדלג`.padEnd(64));
    continue;
  }

  const work = {
    id: book.id,
    title: book.title,
    author: book.author,
    genre: book.genre,
    chapters: parts.length,
    wordCount,
    estMinutes,
    source: 'he.wikisource.org — נחלת הכלל',
    url: 'https://he.wikisource.org/wiki/' + encodeURIComponent(book.root.replace(/\/$/, '')),
    html,
  };

  await writeFile(join(WORKS_DIR, book.id + '.json'), JSON.stringify(work, null, 2), 'utf8');

  const { html: _drop, ...entry } = work;
  catalog.push(entry);

  console.log(`\r  ✓ ${book.title} — ${wordCount.toLocaleString('he')} מילים, ~${estMinutes} דק׳`.padEnd(64));
}

catalog.sort((a, b) => a.title.localeCompare(b.title, 'he'));
await writeFile(CATALOG, JSON.stringify(catalog, null, 2), 'utf8');

const words = catalog.reduce((a, b) => a + b.wordCount, 0);
console.log(`\n${catalog.length} ספרים · ${words.toLocaleString('he')} מילים · ${CATALOG}`);
