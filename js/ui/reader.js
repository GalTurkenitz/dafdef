/**
 * reader.js — מסך הקורא (המפרט, סעיף 7.5).
 *
 * שני מסלולי תצוגה, אותה לוגיקת אימות:
 *   text — יצירות בן-יהודה (HTML מומר), מעומדות ב-paginator.js
 *   epub — קובץ EPUB שהמשתמש מייבא, מעומד ב-epub.js
 *
 * האימות עצמו (verify.js) לא יודע דבר על אף אחד מהם — הוא מקבל
 * מספר מילים וחותמות זמן, וזהו.
 */

import { createPaginator } from './paginator.js';
import { createPageVerifier, countWords } from '../logic/verify.js';
import { getSettings, setSettings, getReadingState, setReadingState,
         getCachedWork, cacheWork, earnPages, openDay, touchBook } from '../logic/store.js';
import { initTheme, setTheme, getTheme } from './theme.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { CONTENT_REV } from '../config.js';

/* ------------------------------------------------------------------ *
 * קבועים
 * ------------------------------------------------------------------ */

const DEFAULT_WORK = 'ws-bialik-safiach';   // כשנכנסים לקורא בלי לבחור ספר
const EPUB_JS  = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';
const JSZIP_JS = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

const FONT_MIN = 15;
const FONT_MAX = 26;
const TICK_MS = 500;
const SWIPE_PX = 40;      // מרחק מינימלי שנחשב החלקה
const TAP_PX = 12;        // תזוזה מתחת לזה היא הקשה, לא החלקה

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */

const $ = (sel) => document.querySelector(sel);

const els = {
  stage:      $('[data-stage]'),
  content:    $('[data-content]'),
  bars:       $('[data-bars]'),
  title:      $('[data-title]'),
  back:       $('[data-back]'),
  importBtn:  $('[data-import]'),
  file:       $('[data-file]'),
  position:   $('[data-position]'),
  fontSize:   $('[data-font-size]'),
  pagesToday: $('[data-pages-today]'),
  pageValue:  $('[data-page-value]'),
  earned:     $('[data-earned]'),
};

/* ------------------------------------------------------------------ *
 * מצב
 * ------------------------------------------------------------------ */

let settings = getSettings();
let reading = getReadingState();

let mode = 'text';        // 'text' | 'epub'
let work = null;          // { id, title, author, html, ... }
let pager = null;         // paginator (mode === 'text')
let rendition = null;     // epub.js (mode === 'epub')
let book = null;
let verifier = null;
let ticker = null;
let barsTimer = null;

/* ------------------------------------------------------------------ *
 * עזרים
 * ------------------------------------------------------------------ */

const now = () => Date.now();

function setFontSize(px) {
  const size = Math.min(FONT_MAX, Math.max(FONT_MIN, px));
  settings = setSettings({ fontSize: size });
  els.fontSize.textContent = size;
  document.documentElement.style.setProperty('--reader-fs', size + 'px');
  return size;
}

function renderStrip() {
  const pages = reading.pagesToday || 0;
  els.pagesToday.textContent = pages === 1 ? 'עמוד אחד היום' : `${pages} עמודים היום`;
  els.pageValue.textContent = `+${settings.pageValueMinutes} דק׳ לעמוד`;
}

function showEarned(minutes) {
  els.earned.textContent = `+${minutes} דק׳`;
  els.earned.classList.remove('is-on');
  void els.earned.offsetWidth;   // reflow — כדי שהאנימציה תרוץ שוב
  els.earned.classList.add('is-on');
}

/* ------------------------------------------------------------------ *
 * סרגלים
 * ------------------------------------------------------------------ */

function toggleBars(force) {
  const open = force ?? !els.bars.classList.contains('is-open');
  els.bars.classList.toggle('is-open', open);
  clearTimeout(barsTimer);
  if (open) barsTimer = setTimeout(() => els.bars.classList.remove('is-open'), 4000);
}

function markThemeButtons() {
  const current = getTheme();
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === current));
  });
}

/* ------------------------------------------------------------------ *
 * אימות העמוד המוצג
 * ------------------------------------------------------------------ */

/** מתחיל לאמת את העמוד שמוצג עכשיו */
function beginPage(words) {
  verifier = createPageVerifier({ words, now: now() });
}

/** העמוד עבר את שתי השכבות — נספר פעם אחת בלבד */
function countPage() {
  // earnPages מטפל בכל השרשרת: בנק, סטריק וסטטיסטיקה יומית
  const { added } = earnPages(1, now());

  reading = setReadingState({
    pagesToday: (reading.pagesToday || 0) + 1,
    minutesToday: (reading.minutesToday || 0) + added,
  });

  showEarned(added);
  renderStrip();
}

function tick() {
  if (!verifier) return;
  if (verifier.claim(now())) countPage();
}

function startTicker() {
  stopTicker();
  ticker = setInterval(tick, TICK_MS);
}

function stopTicker() {
  clearInterval(ticker);
  ticker = null;
}

/** נקרא בכל ניסיון דפדוף — כאן נופל הטוסט של "לאט לאט" */
function leavingPage() {
  if (!verifier) return;
  tick();
  if (!verifier.counted) toast('לאט לאט 🙂 עוד רגע העמוד נספר');
}

/* ------------------------------------------------------------------ *
 * דפדוף
 * ------------------------------------------------------------------ */

function turn(direction) {
  if (direction === 'next') leavingPage();

  if (mode === 'text') {
    const wasLast = pager.atEnd;
    const moved = direction === 'next' ? pager.next() : pager.prev();
    if (!moved) {
      if (direction === 'next' && wasLast) finishWork();
      return;
    }
    afterTurn();
  } else {
    (direction === 'next' ? rendition.next() : rendition.prev());
    // afterTurn נקרא מאירוע relocated של epub.js
  }
}

function afterTurn() {
  if (mode !== 'text') return;

  beginPage(pager.wordsOnPage());
  reading = setReadingState({ workId: work.id, location: pager.offsetOfPage() });
  els.position.textContent = `עמוד ${pager.page + 1} מתוך ${pager.pageCount}`;

  touchBook(work.id, {
    title: work.title,
    author: work.author,
    page: pager.page + 1,
    pages: pager.pageCount,
    percent: pager.pageCount > 1 ? (pager.page + 1) / pager.pageCount : 1,
  });
}

/* ------------------------------------------------------------------ *
 * מחוות מגע
 * ------------------------------------------------------------------ */

function bindGestures() {
  let startX = 0, startY = 0, startT = 0, tracking = false;

  const activity = () => verifier && verifier.activity(now());

  els.stage.addEventListener('pointerdown', (e) => {
    tracking = true;
    startX = e.clientX; startY = e.clientY; startT = now();
    activity();
  });

  els.stage.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    activity();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // החלקה אופקית
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      // RTL: העמוד הבא נמצא משמאל, ולכן החלקה שמאלה מקדמת (המפרט, סעיף 3)
      turn(dx < 0 ? 'next' : 'prev');
      return;
    }

    // הקשה
    if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX && now() - startT < 600) {
      const rect = els.stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 3) turn('next');            // שליש שמאלי
      else if (x > (rect.width * 2) / 3) turn('prev'); // שליש ימני
      else toggleBars();
    }
  });

  els.stage.addEventListener('pointercancel', () => { tracking = false; });

  // מקלדת — נוח לבדיקה בדסקטופ
  document.addEventListener('keydown', (e) => {
    activity();
    if (e.key === 'ArrowLeft') turn('next');
    if (e.key === 'ArrowRight') turn('prev');
  });

  // מעבר אפליקציה עוצר מיידית (המפרט, סעיף 5)
  document.addEventListener('visibilitychange', () => {
    if (!verifier) return;
    if (document.hidden) { verifier.hide(now()); stopTicker(); }
    else { openDay(); verifier.show(now()); startTicker(); }
  });
}

/* ------------------------------------------------------------------ *
 * מסך סיום (המפרט, סעיף 7.5 — הרגע היחיד עם קונפטי)
 * ------------------------------------------------------------------ */

function finishWork() {
  if (document.querySelector('.finish')) return;

  // הסטטיסטיקה של הסיום היא על מה שנקרא היום — זה מה שיש לנו עד שלב 4
  const pages = reading.pagesToday || 0;
  const minutes = reading.minutesToday || 0;

  const panel = document.createElement('div');
  panel.className = 'finish';
  panel.innerHTML = `
    <div class="confetti" data-confetti></div>
    <h1>סיימת! 🎉</h1>
    <p class="t-sub">${work.title}${work.author ? ' · ' + work.author : ''}</p>
    <div class="finish__stats">
      <div class="finish__stat"><b>${pages}</b><span class="t-small">עמודים היום</span></div>
      <div class="finish__stat"><b>${minutes}</b><span class="t-small">דקות שנצברו</span></div>
    </div>
    <a class="btn btn--primary btn--block" href="library.html">לספר הבא</a>
    <a class="btn btn--ghost" href="index.html">חזרה לבית</a>
  `;
  document.querySelector('.reader').appendChild(panel);
  confetti(panel.querySelector('[data-confetti]'));

  stopTicker();
  verifier = null;
  reading = setReadingState({ workId: null, location: null });
}

function confetti(host) {
  const colors = ['--primary', '--accent', '--border', '--text-soft'];
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 48; i++) {
    const bit = document.createElement('i');
    bit.style.insetInlineStart = Math.random() * 100 + '%';
    bit.style.background = `var(${colors[i % colors.length]})`;
    bit.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    bit.style.animationDelay = (Math.random() * 0.5) + 's';
    frag.appendChild(bit);
  }
  host.appendChild(frag);
}

/* ------------------------------------------------------------------ *
 * מסלול טקסט — יצירות בן-יהודה
 * ------------------------------------------------------------------ */

async function loadWork(id) {
  const cached = getCachedWork(id);
  if (cached && cached._rev === CONTENT_REV) return cached;

  const res = await fetch(`content/works/${id}.json`);
  if (!res.ok) {
    if (cached) return cached;   // אין רשת אבל יש עותק שמור — קוראים אותו
    throw new Error('היצירה לא נמצאה');
  }

  const data = await res.json();
  data._rev = CONTENT_REV;
  cacheWork(data);      // המפרט, סעיף 6: נשמר לקריאה offline
  return data;
}

/**
 * פונט הקריאה נטען רק כשיש טקסט שמשתמש בו, ולכן קודם מזריקים את התוכן,
 * ורק אחר כך מחכים לפונט ומעמדים. בלי זה העימוד נעשה על פונט הגיבוי
 * ומספר העמודים משתנה אחרי שהפונט האמיתי נכנס.
 */
async function waitForReadingFont() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`400 ${settings.fontSize}px "Frank Ruhl Libre"`),
      document.fonts.load(`500 ${settings.fontSize}px "Frank Ruhl Libre"`),
    ]);
    await document.fonts.ready;
  } catch { /* הפונט לא נטען — מעמדים על פונט הגיבוי */ }
}

async function openText(data, location) {
  mode = 'text';
  work = data;

  els.content.hidden = false;
  els.content.innerHTML = data.html;
  els.title.textContent = data.title;
  document.title = `${data.title} · דפדף`;

  await waitForReadingFont();

  pager = createPaginator({ viewport: els.stage, content: els.content });
  pager.layout();

  if (Number.isFinite(location)) pager.goTo(pager.pageOfOffset(location));
  afterTurn();
  startTicker();
}

/** מעמדים מחדש בשינוי גודל טקסט, סיבוב מסך או שינוי חלון — ושומרים על המקום */
function relayout() {
  if (mode === 'epub') {
    applyEpubStyles();
    rendition?.resize();
    return;
  }
  if (!pager) return;
  const keep = pager.offsetOfPage();
  pager.layout();
  pager.goTo(pager.pageOfOffset(keep));
  afterTurn();
}

/* ------------------------------------------------------------------ *
 * מסלול EPUB — קובץ שהמשתמש מייבא (המפרט, סעיף 7.5)
 * ------------------------------------------------------------------ */

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('טעינת הספרייה נכשלה'));
    document.head.appendChild(s);
  });
}

/**
 * מחבר שני CFI לטווח אחד — epub.js לא חושף את זה, וזו הדרך היחידה
 * לקבל את הטקסט שמוצג בעמוד, ובלעדיו אי אפשר לספור מילים.
 */
function rangeCfi(a, b) {
  const CFI = new window.ePub.CFI();
  const start = CFI.parse(a);
  const end = CFI.parse(b);
  const out = { range: true, base: start.base, path: { steps: [], terminal: null },
                start: start.path, end: end.path };

  const len = Math.min(start.path.steps.length, end.path.steps.length);
  for (let i = 0; i < len; i++) {
    if (!CFI.equalStep(start.path.steps[i], end.path.steps[i])) break;
    if (i === len - 1 && start.terminal === end.terminal) {
      out.path.steps.push(start.path.steps[i]);
      out.range = false;
    } else {
      out.path.steps.push(start.path.steps[i]);
    }
  }
  out.start.steps = out.start.steps.slice(out.path.steps.length);
  out.end.steps = out.end.steps.slice(out.path.steps.length);

  return 'epubcfi(' + CFI.segmentString(out.base) + '!' + CFI.segmentString(out.path)
       + ',' + CFI.segmentString(out.start) + ',' + CFI.segmentString(out.end) + ')';
}

/**
 * תוכן ה-EPUB חי ב-iframe משלו ולא יורש את משתני העיצוב שלנו,
 * ולכן מזריקים לו את הצבעים, הפונט וגודל הטקסט הנוכחיים.
 */
function applyEpubStyles() {
  if (!rendition) return;
  const css = getComputedStyle(document.documentElement);
  const val = (name) => css.getPropertyValue(name).trim();

  rendition.themes.override('color', val('--text'), true);
  rendition.themes.override('background', val('--bg'), true);
  rendition.themes.override('font-family', val('--font-read'), true);
  rendition.themes.override('line-height', String(val('--lh-read')), true);
  rendition.themes.fontSize(settings.fontSize + 'px');
}

/** מחבר מחוות מגע בתוך ה-iframe — אירועים משם לא מגיעים למסמך שלנו */
function bindEpubGestures(doc) {
  let x0 = 0, y0 = 0;

  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) =>
    doc.addEventListener(ev, () => verifier && verifier.activity(now()), { passive: true }));

  doc.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    x0 = t.clientX; y0 = t.clientY;
  }, { passive: true });

  doc.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;

    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      turn(dx < 0 ? 'next' : 'prev');   // RTL: שמאלה = הבא
      return;
    }
    if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX) {
      const w = doc.documentElement.clientWidth;
      if (t.clientX < w / 3) turn('next');
      else if (t.clientX > (w * 2) / 3) turn('prev');
      else toggleBars();
    }
  }, { passive: true });
}

/** חיווי מיקום ב-EPUB: אחוזים כשיש מפת מיקומים, אחרת מספר הפרק */
function epubPosition(loc) {
  try {
    if (book?.locations?.length()) {
      const pct = Math.round(book.locations.percentageFromCfi(loc.start.cfi) * 100);
      return `${pct}% מהספר`;
    }
  } catch { /* המפה עוד נבנית */ }
  const chapter = (loc.start.index ?? 0) + 1;
  const total = book?.spine?.length || 0;
  return total ? `פרק ${chapter} מתוך ${total}` : '';
}

/** כמה מילים מוצגות בעמוד ה-EPUB הנוכחי */
async function epubWordsOnPage(loc) {
  try {
    const range = await book.getRange(rangeCfi(loc.start.cfi, loc.end.cfi));
    return countWords(range.toString());
  } catch {
    return 0;   // נופלים לרצפת 20 השניות של verify.js
  }
}

async function openEpub(file) {
  await loadScript(JSZIP_JS);
  await loadScript(EPUB_JS);

  mode = 'epub';
  stopTicker();
  els.content.hidden = true;
  els.content.innerHTML = '';

  book = window.ePub(await file.arrayBuffer());
  rendition = book.renderTo(els.stage, {
    width: '100%', height: '100%',
    flow: 'paginated', spread: 'none',
    direction: 'rtl',
  });

  const saved = reading.workId === 'epub:' + file.name ? reading.location : null;
  await rendition.display(saved || undefined);

  work = { id: 'epub:' + file.name, title: file.name.replace(/\.epub$/i, ''), author: '' };
  els.title.textContent = work.title;
  document.title = `${work.title} · דפדף`;

  rendition.on('relocated', async (loc) => {
    beginPage(await epubWordsOnPage(loc));
    reading = setReadingState({ workId: work.id, location: loc.start.cfi });
    els.position.textContent = epubPosition(loc);
    touchBook(work.id, { title: work.title, author: work.author, percent: loc.start.percentage || 0 });
    if (loc.atEnd) finishWork();
  });

  // אחוזי התקדמות דורשים מפת מיקומים. נבנית ברקע כדי לא לעכב את הפתיחה.
  book.locations.generate(1400).then(() => {
    const loc = rendition.currentLocation();
    if (loc) els.position.textContent = epubPosition(loc);
  }).catch(() => { /* בלי מפה נישאר עם חיווי הפרק */ });

  rendition.on('rendered', (_section, view) => {
    const doc = view?.document || view?.contents?.document;
    if (doc) bindEpubGestures(doc);
    applyEpubStyles();
  });

  rendition.on('keyup', (e) => {
    if (e.key === 'ArrowLeft') turn('next');
    if (e.key === 'ArrowRight') turn('prev');
  });

  startTicker();
}

/* ------------------------------------------------------------------ *
 * מצב ריק / שגיאה
 * ------------------------------------------------------------------ */

function showEmpty(message) {
  els.stage.innerHTML = `
    <div class="reader__empty">
      <p class="t-sub">${message}</p>
      <a class="btn btn--secondary" href="index.html">חזרה לבית</a>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * הפעלה
 * ------------------------------------------------------------------ */

async function init() {
  initTheme();
  openDay();          // חוקי החצות — לפני שקוראים מצב כלשהו
  markThemeButtons();

  // ב-RTL חץ החזרה מצביע ימינה — כיוון ה"אחורה" של השפה
  els.back.innerHTML = icon('arrow', 22);
  els.importBtn.innerHTML = icon('book', 22);

  setFontSize(settings.fontSize);
  renderStrip();

  // ניווט וסרגלים
  els.back.addEventListener('click', () => history.length > 1 ? history.back() : (location.href = 'index.html'));
  els.importBtn.addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toggleBars(false);
    try { await openEpub(file); }
    catch (err) { toast('לא הצלחנו לפתוח את הקובץ'); console.error(err); }
  });

  document.querySelectorAll('[data-font]').forEach((b) => {
    b.innerHTML = icon(b.dataset.font === '+' ? 'plus' : 'minus', 20);
    b.addEventListener('click', () => {
      setFontSize(settings.fontSize + (b.dataset.font === '+' ? 1 : -1));
      relayout();
      toggleBars(true);
    });
  });

  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.addEventListener('click', () => {
      setTheme(b.dataset.mode);
      markThemeButtons();
      relayout();
      toggleBars(true);
    });
  });

  bindGestures();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 150);
  });

  // איזו יצירה לפתוח: פרמטר בכתובת ⇐ מה שנקרא לאחרונה ⇐ ברירת מחדל
  const wanted = new URLSearchParams(location.search).get('work')
    || (reading.workId && !reading.workId.startsWith('epub:') ? reading.workId : null)
    || DEFAULT_WORK;

  try {
    const data = await loadWork(wanted);
    const savedLocation = data.id === reading.workId ? reading.location : null;
    await openText(data, savedLocation);
  } catch (err) {
    console.error(err);
    showEmpty('לא הצלחנו לטעון את היצירה.');
  }
}

init();
