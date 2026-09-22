/**
 * reader.js — מסך הקורא.
 *
 * שני מסלולי תצוגה, אותה לוגיקת אימות:
 *   text — ספרים מהקטלוג (HTML מומר), מעומדים ב-paginator.js
 *   epub — קובץ EPUB שהמשתמש מייבא, מעומד ב-epub.js
 *
 * שני עקרונות שמנחים את הקובץ:
 *   1. הדפדוף לעולם לא נחסם. עמוד שלא שהו בו מספיק פשוט לא נספר.
 *   2. מצב הקריאה נשמר לכל ספר בנפרד — אפשר לקרוא כמה ספרים במקביל.
 */

import { createPaginator } from './paginator.js';
import { createPageVerifier, countWords } from '../logic/verify.js';
import { getSettings, setSettings, getReadingState, setReadingState,
         getCachedWork, cacheWork, earnUnits, openDay,
         touchBook, getBook, getActiveBookId, setActiveBookId } from '../logic/store.js';
import { mountNavbar } from './nav.js';
import { initTheme, setTheme, getTheme } from './theme.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { CONTENT_REV } from '../config.js';

/* ------------------------------------------------------------------ *
 * קבועים
 * ------------------------------------------------------------------ */

const DEFAULT_WORK = 'ws-bialik-safiach';
const EPUB_JS  = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js';
const JSZIP_JS = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

const FONT_MIN = 15;
const FONT_MAX = 26;
const TICK_MS = 500;
const SWIPE_PX = 40;
const TAP_PX = 12;

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */

const $ = (sel) => document.querySelector(sel);

const els = {
  stage:       $('[data-stage]'),
  content:     $('[data-content]'),
  bars:        $('[data-bars]'),
  title:       $('[data-title]'),
  home:        $('[data-home]'),
  importBtn:   $('[data-import]'),
  settingsBtn: $('[data-open-settings]'),
  file:        $('[data-file]'),
  position:    $('[data-position]'),
  percent:     $('[data-percent]'),
  fontSize:    $('[data-font-size]'),
  pagesToday:  $('[data-pages-today]'),
  earned:      $('[data-earned]'),
  sheet:       $('[data-sheet]'),
};

/* ------------------------------------------------------------------ *
 * מצב
 * ------------------------------------------------------------------ */

let settings = getSettings();
let reading = getReadingState();

let mode = 'text';
let work = null;
let pager = null;
let rendition = null;
let book = null;
let verifier = null;
let ticker = null;
let barsTimer = null;

/** נקודות ההתחלה והסיום שהמשתמש סימן, בהיסטי תווים */
let marks = { start: 0, end: null };

const now = () => Date.now();

/* ------------------------------------------------------------------ *
 * עזרים
 * ------------------------------------------------------------------ */

function setFontSize(px) {
  const size = Math.min(FONT_MAX, Math.max(FONT_MIN, px));
  settings = setSettings({ fontSize: size });
  els.fontSize.textContent = size;
  document.documentElement.style.setProperty('--reader-fs', size + 'px');
  return size;
}

function renderStrip() {
  const pages = reading.pagesToday || 0;
  els.pagesToday.innerHTML =
    `${icon('book', 14)}<span>${pages === 1 ? 'עמוד אחד היום' : `${pages} עמודים היום`}</span>`;
}

function showEarned(minutes) {
  els.earned.textContent = `+${minutes} דק׳`;
  els.earned.classList.remove('is-on');
  void els.earned.offsetWidth;
  els.earned.classList.add('is-on');
}

/* ------------------------------------------------------------------ *
 * סרגלים וגיליון ההגדרות
 * ------------------------------------------------------------------ */

function toggleBars(force) {
  const open = force ?? !els.bars.classList.contains('is-open');
  els.bars.classList.toggle('is-open', open);
  clearTimeout(barsTimer);
  if (open) barsTimer = setTimeout(() => els.bars.classList.remove('is-open'), 4000);
}

function openSheet(open) {
  if (open) els.sheet.hidden = false;
  requestAnimationFrame(() => els.sheet.classList.toggle('is-open', open));

  if (open) { markThemeButtons(); toggleBars(false); }
  else setTimeout(() => { els.sheet.hidden = true; }, 250);
}

function markThemeButtons() {
  const current = getTheme();
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.mode === current));
  });
}

/* ------------------------------------------------------------------ *
 * אימות העמוד המוצג
 * ------------------------------------------------------------------ */

function beginPage(words) {
  verifier = createPageVerifier({ words, now: now() });
}

function countPage() {
  // קריאה היא ערוץ חופשי — היא צוברת תמיד, וגם מסמנת ✓ בסבב היומי
  const { added, bonus, roundComplete } = earnUnits('reading', 1, now());

  reading = setReadingState({
    pagesToday: (reading.pagesToday || 0) + 1,
    minutesToday: (reading.minutesToday || 0) + added + bonus,
  });

  showEarned(added);
  renderStrip();

  if (bonus) toast(`הסבב היומי הושלם — ועוד ${bonus} דקות בונוס`, 3200);
  else if (roundComplete) toast('הסבב היומי הושלם', 2400);
}

function tick() {
  if (!verifier) return;
  if (verifier.claim(now())) countPage();
}

function startTicker() { stopTicker(); ticker = setInterval(tick, TICK_MS); }
function stopTicker() { clearInterval(ticker); ticker = null; }

/**
 * נקרא בכל דפדוף קדימה. הדפדוף עצמו אף פעם לא נעצר —
 * העמוד פשוט לא נספר, והמשתמש מקבל רמז עדין.
 */
function leavingPage() {
  if (!verifier) return;
  tick();
  if (!verifier.counted) toast('לאט לאט. עוד רגע העמוד נספר');
}

/* ------------------------------------------------------------------ *
 * התקדמות
 * ------------------------------------------------------------------ */

/** אחוז השלמה, נמדד מנקודת ההתחלה שסומנה ועד נקודת הסיום */
function progressPercent() {
  if (mode !== 'text' || !pager) return 0;

  const start = marks.start || 0;
  const end = marks.end ?? pager.totalChars;
  const span = end - start;
  if (span <= 0) return 1;

  const at = pager.offsetOfPage() - start;
  return Math.min(1, Math.max(0, at / span));
}

function renderPosition() {
  if (mode !== 'text' || !pager) return;

  els.position.textContent = `עמוד ${pager.page + 1} מתוך ${pager.pageCount}`;
  els.percent.textContent = `${Math.round(progressPercent() * 100)}%`;

  $('[data-turn="prev"]').disabled = pager.atStart;
  $('[data-turn="next"]').disabled = false;   // הדפדוף לעולם לא נחסם
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
  }
}

function afterTurn() {
  if (mode !== 'text') return;

  beginPage(pager.wordsOnPage());
  renderPosition();

  const offset = pager.offsetOfPage();
  touchBook(work.id, {
    title: work.title,
    author: work.author,
    estMinutes: work.estMinutes,
    location: offset,
    page: pager.page + 1,
    pages: pager.pageCount,
    chars: pager.totalChars,
    percent: progressPercent(),
  });
  reading = setReadingState({ lastWorkId: work.id });

  // הגענו לנקודת הסיום שסומנה
  if (marks.end != null && offset >= marks.end) finishWork();
}

/* ------------------------------------------------------------------ *
 * סימון תחילת וסוף ספר
 * ------------------------------------------------------------------ */

function markHere(which) {
  if (mode !== 'text' || !pager) { toast('הסימון זמין בספרי הקטלוג'); return; }

  const offset = pager.offsetOfPage();

  if (which === 'start') {
    if (marks.end != null && offset >= marks.end) {
      toast('נקודת ההתחלה חייבת לבוא לפני הסוף'); return;
    }
    marks.start = offset;
    touchBook(work.id, { start: offset });
    toast('סומן: הספר מתחיל כאן');
  } else {
    if (offset <= (marks.start || 0)) {
      toast('נקודת הסיום חייבת לבוא אחרי ההתחלה'); return;
    }
    marks.end = offset;
    touchBook(work.id, { end: offset });
  }

  touchBook(work.id, { percent: progressPercent() });
  renderPosition();
  openSheet(false);

  // סימון הסוף הוא גם ההצהרה שסיימת — מציגים מיד את אישור הסיום
  if (which === 'end') setTimeout(finishWork, 260);
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

    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      turn(dx < 0 ? 'next' : 'prev');   // RTL: שמאלה = הבא
      return;
    }

    if (Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX && now() - startT < 600) {
      const rect = els.stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 3) turn('next');
      else if (x > (rect.width * 2) / 3) turn('prev');
      else toggleBars();
    }
  });

  els.stage.addEventListener('pointercancel', () => { tracking = false; });

  document.addEventListener('keydown', (e) => {
    activity();
    if (e.key === 'ArrowLeft') turn('next');
    if (e.key === 'ArrowRight') turn('prev');
    if (e.key === 'Escape') openSheet(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (!verifier) return;
    if (document.hidden) { verifier.hide(now()); stopTicker(); }
    else { openDay(); verifier.show(now()); startTicker(); }
  });
}

/* ------------------------------------------------------------------ *
 * מסך סיום
 * ------------------------------------------------------------------ */

function finishWork() {
  if (document.querySelector('.finish')) return;

  const pages = reading.pagesToday || 0;
  const minutes = reading.minutesToday || 0;

  const panel = document.createElement('div');
  panel.className = 'finish';
  panel.innerHTML = `
    <div class="confetti" data-confetti></div>
    <h1>סיימת</h1>
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
  touchBook(work.id, { finished: true, percent: 1 });
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
 * מסלול טקסט
 * ------------------------------------------------------------------ */

async function loadWork(id) {
  const cached = getCachedWork(id);
  if (cached && cached._rev === CONTENT_REV) return cached;

  const res = await fetch(`content/works/${id}.json`);
  if (!res.ok) {
    if (cached) return cached;
    throw new Error('הספר לא נמצא');
  }

  const data = await res.json();
  data._rev = CONTENT_REV;
  cacheWork(data);
  return data;
}

/**
 * פונט הקריאה נטען רק כשיש טקסט שמשתמש בו, ולכן קודם מזריקים את
 * התוכן ורק אחר כך מחכים לפונט ומעמדים — אחרת מספר העמודים משתנה
 * אחרי שהפונט האמיתי נכנס.
 */
async function waitForReadingFont() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`400 ${settings.fontSize}px "Frank Ruhl Libre"`),
      document.fonts.load(`500 ${settings.fontSize}px "Frank Ruhl Libre"`),
    ]);
    await document.fonts.ready;
  } catch { /* נופלים לפונט הגיבוי */ }
}

async function openText(data) {
  mode = 'text';
  work = data;

  els.content.hidden = false;
  els.content.innerHTML = data.html;
  els.title.textContent = data.title;
  document.title = `${data.title} · דפדף`;

  await waitForReadingFont();

  pager = createPaginator({ viewport: els.stage, content: els.content });
  pager.layout();

  // מצב הקריאה של הספר הזה בלבד
  const saved = getBook(data.id) || {};
  marks = { start: saved.start || 0, end: saved.end ?? null };
  if (Number.isFinite(saved.location)) pager.goTo(pager.pageOfOffset(saved.location));

  afterTurn();
  startTicker();
}

/** מעמדים מחדש בשינוי גודל טקסט, סיבוב מסך או שינוי חלון */
function relayout() {
  if (mode === 'epub') { applyEpubStyles(); rendition?.resize(); return; }
  if (!pager) return;

  const keep = pager.offsetOfPage();
  pager.layout();
  pager.goTo(pager.pageOfOffset(keep));
  afterTurn();
}

/* ------------------------------------------------------------------ *
 * מסלול EPUB
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
      turn(dx < 0 ? 'next' : 'prev');
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

function epubPercent(loc) {
  try {
    if (book?.locations?.length()) {
      return Math.round(book.locations.percentageFromCfi(loc.start.cfi) * 100);
    }
  } catch { /* המפה עוד נבנית */ }
  return null;
}

async function epubWordsOnPage(loc) {
  try {
    const range = await book.getRange(rangeCfi(loc.start.cfi, loc.end.cfi));
    return countWords(range.toString());
  } catch {
    return 0;
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
    flow: 'paginated', spread: 'none', direction: 'rtl',
  });

  work = { id: 'epub:' + file.name, title: file.name.replace(/\.epub$/i, ''), author: '' };
  const saved = getBook(work.id) || {};
  await rendition.display(saved.location || undefined);

  els.title.textContent = work.title;
  document.title = `${work.title} · דפדף`;

  rendition.on('relocated', async (loc) => {
    beginPage(await epubWordsOnPage(loc));

    const pct = epubPercent(loc);
    els.position.textContent = `פרק ${(loc.start.index ?? 0) + 1}`;
    els.percent.textContent = pct == null ? '' : `${pct}%`;

    touchBook(work.id, { title: work.title, location: loc.start.cfi, percent: (pct ?? 0) / 100 });
    reading = setReadingState({ lastWorkId: work.id });

    if (loc.atEnd) finishWork();
  });

  rendition.on('rendered', (_section, view) => {
    const doc = view?.document || view?.contents?.document;
    if (doc) bindEpubGestures(doc);
    applyEpubStyles();
  });

  book.locations.generate(1400).then(() => {
    const loc = rendition.currentLocation();
    if (!loc) return;
    const pct = epubPercent(loc);
    if (pct != null) els.percent.textContent = `${pct}%`;
  }).catch(() => { /* בלי מפה נישאר עם חיווי הפרק */ });

  startTicker();
}

/* ------------------------------------------------------------------ *
 * טעינה, מצב ריק ושגיאה
 * ------------------------------------------------------------------ */

function showLoading(on) {
  let node = els.stage.querySelector('[data-loading]');
  if (!on) { node?.remove(); return; }
  if (node) return;

  node = document.createElement('div');
  node.className = 'reader__loading';
  node.dataset.loading = '';
  node.innerHTML = '<span class="spinner" aria-hidden="true"></span><p class="t-sub">רגע, פותחים את הספר…</p>';
  els.stage.appendChild(node);
}

function showEmpty(message) {
  els.stage.innerHTML = `
    <div class="reader__empty">
      <p class="t-sub">${message}</p>
      <a class="btn btn--secondary" href="library.html">לספרייה</a>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * הפעלה
 * ------------------------------------------------------------------ */

function bindChrome() {
  els.home.innerHTML = icon('home', 20);
  els.importBtn.innerHTML = icon('book', 22);
  els.settingsBtn.innerHTML = icon('settings', 20);

  // חזרה ישירה לדף הבית, לא להיסטוריית הדפדפן
  els.home.addEventListener('click', () => { location.href = 'index.html'; });

  // החלפת ספר פותחת את בוחר הספרים (סעיף ז1)
  const swap = document.querySelector('[data-swap-book]');
  if (swap) {
    swap.classList.add('toolbtn');
    swap.setAttribute('aria-label', 'החלף ספר');
    swap.innerHTML = icon('library', 20);
    swap.addEventListener('click', () => { location.href = 'library.html'; });
  }

  // כפתורי דפדוף קבועים — ב-RTL "הבא" מצביע שמאלה
  document.querySelectorAll('[data-turn]').forEach((btn) => {
    btn.innerHTML = icon('arrow', 22);
    btn.classList.toggle('is-next', btn.dataset.turn === 'next');
    btn.addEventListener('click', (e) => { e.stopPropagation(); turn(btn.dataset.turn); });
  });

  // גיליון ההגדרות
  els.settingsBtn.addEventListener('click', () => openSheet(true));
  document.querySelectorAll('[data-sheet-close]').forEach((n) =>
    n.addEventListener('click', () => openSheet(false)));

  document.querySelectorAll('[data-font]').forEach((b) => {
    b.innerHTML = icon(b.dataset.font === '+' ? 'plus' : 'minus', 20);
    b.addEventListener('click', () => {
      setFontSize(settings.fontSize + (b.dataset.font === '+' ? 1 : -1));
      relayout();
    });
  });

  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.addEventListener('click', () => { setTheme(b.dataset.mode); markThemeButtons(); relayout(); });
  });

  document.querySelectorAll('[data-mark]').forEach((b) => {
    b.addEventListener('click', () => markHere(b.dataset.mark));
  });

  // ייבוא EPUB
  els.importBtn.addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toggleBars(false);
    showLoading(true);
    try { await openEpub(file); }
    catch (err) { toast('לא הצלחנו לפתוח את הקובץ'); console.error(err); }
    finally { showLoading(false); }
  });
}

async function init() {
  initTheme();
  mountNavbar('reader');
  openDay();
  markThemeButtons();
  bindChrome();
  bindGestures();

  setFontSize(settings.fontSize);
  renderStrip();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 150);
  });

  /* סדר העדיפויות: מה שביקשו בכתובת, אחר כך הספר הפעיל (סעיף ז1),
     ורק אחר כך הספר האחרון או ברירת המחדל. */
  const asked = new URLSearchParams(location.search).get('work');
  if (asked) setActiveBookId(asked);

  const wanted = asked
    || getActiveBookId()
    || (reading.lastWorkId && !reading.lastWorkId.startsWith('epub:') ? reading.lastWorkId : null)
    || DEFAULT_WORK;

  if (!getActiveBookId() && wanted) setActiveBookId(wanted);

  showLoading(true);
  try {
    await openText(await loadWork(wanted));
    showLoading(false);
  } catch (err) {
    console.error(err);
    showLoading(false);
    showEmpty('לא הצלחנו לטעון את הספר.');
  }
}

init();
