/**
 * paginator.js — מחלק טקסט לעמודים אמיתיים (לא גלילה).
 *
 * הטכניקה: CSS multi-column ברוחב עמוד אחד. הדפדפן עושה את השבירה,
 * ואנחנו מזיזים את התוכן ב-transform כדי להציג עמוד אחר.
 * ב-RTL העמודים נערמים ימינה-שמאלה, ולכן עמוד i נמצא ב-x שלילי
 * ומובא לתצוגה בהזזה חיובית.
 *
 * הדבר החשוב כאן הוא wordsOnPage(): verify.js דורש את מספר המילים
 * בעמוד המוצג בפועל. במקום לעטוף כל מילה ב-span (כבד על אייפון),
 * מוצאים את גבולות העמודים בחיפוש בינארי עם Range — מספר קריאות
 * לוגריתמי במקום אחת לכל מילה.
 */

import { countWords } from '../logic/verify.js';

export function createPaginator({ viewport, content, gap = 32 }) {
  let step = 0;          // רוחב עמוד + מרווח
  let pageCount = 1;
  let page = 0;

  let textNodes = [];    // [{ node, start }] לפי סדר המסמך
  let fullText = '';     // שרשור כל הטקסט — ההיסטים מתייחסים אליו
  let bounds = [];       // bounds[i] = היסט התו הראשון בעמוד i
  let wordCache = [];

  /* ---------- מיפוי הטקסט ---------- */

  function indexText() {
    textNodes = [];
    let out = '';
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.data) continue;
      textNodes.push({ node, start: out.length });
      out += node.data;
    }
    fullText = out;
  }

  /** @returns {{node: Text, index: number}|null} מיקום התו בהיסט הגלובלי */
  function locate(offset) {
    if (!textNodes.length) return null;
    let lo = 0, hi = textNodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (textNodes[mid].start <= offset) lo = mid; else hi = mid - 1;
    }
    const entry = textNodes[lo];
    const index = Math.min(offset - entry.start, entry.node.data.length - 1);
    return index < 0 ? null : { node: entry.node, index };
  }

  /**
   * באיזה עמוד יושב התו שבהיסט הזה.
   * נמדד תמיד כשהתוכן ב-translateX(0) — אחרת ה-rect מוסט.
   */
  function columnOf(offset, originLeft) {
    const at = locate(offset);
    if (!at) return 0;

    const range = document.createRange();
    let rect = null;

    // תווי רווח ושבירת שורה מחזירים rect ריק — מדלגים קדימה
    for (let probe = at.index; probe < at.node.data.length && probe < at.index + 40; probe++) {
      range.setStart(at.node, probe);
      range.setEnd(at.node, probe + 1);
      const r = range.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) { rect = r; break; }
    }
    if (!rect) return 0;

    // עמוד i תופס x בטווח [originLeft - i*step, originLeft - i*step + width]
    const i = Math.ceil((originLeft - rect.left) / step);
    return Math.min(Math.max(i, 0), pageCount - 1);
  }

  /** ההיסט הראשון ששייך לעמוד p — חיפוש בינארי על סדר המסמך */
  function firstOffsetOfPage(p, originLeft) {
    if (p <= 0) return 0;
    let lo = 0, hi = fullText.length - 1, ans = fullText.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (columnOf(mid, originLeft) >= p) { ans = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    return ans;
  }

  /* ---------- פריסה ---------- */

  /** מחשב מחדש את העמודים. נקרא בטעינה, בשינוי גודל טקסט ובסיבוב מסך. */
  function layout() {
    // רוחב תיבת התוכן, לא של ה-viewport — ל-stage יש שוליים אופקיים
    const width = content.clientWidth || viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;

    step = width + gap;

    content.style.transform = 'translateX(0px)';
    content.style.height = height + 'px';
    // גובה העמוד נחתך לכפולה שלמה של גובה השורה,
    // אחרת השורה האחרונה בכל עמוד נחתכת באמצע.
    const lineHeight = parseFloat(getComputedStyle(content).lineHeight);
    if (Number.isFinite(lineHeight) && lineHeight > 0) {
      content.style.height = Math.max(lineHeight, Math.floor(height / lineHeight) * lineHeight) + 'px';
    }
    content.style.columnWidth = width + 'px';
    content.style.columnGap = gap + 'px';

    pageCount = Math.max(1, Math.round((content.scrollWidth + gap) / step));

    indexText();

    const originLeft = content.getBoundingClientRect().left;
    bounds = new Array(pageCount);
    for (let p = 0; p < pageCount; p++) bounds[p] = firstOffsetOfPage(p, originLeft);
    bounds.push(fullText.length);

    wordCache = new Array(pageCount).fill(null);
    page = Math.min(page, pageCount - 1);
    apply();
  }

  function apply() {
    content.style.transform = `translateX(${page * step}px)`;
  }

  /* ---------- API ---------- */

  return {
    layout,

    get page() { return page; },
    get pageCount() { return pageCount; },
    get atStart() { return page <= 0; },
    get atEnd() { return page >= pageCount - 1; },

    /** @returns {boolean} האם באמת זזנו */
    goTo(p) {
      const next = Math.min(Math.max(p, 0), pageCount - 1);
      if (next === page) return false;
      page = next;
      apply();
      return true;
    },

    next() { return this.goTo(page + 1); },
    prev() { return this.goTo(page - 1); },

    /** מספר המילים בעמוד המוצג — מה ש-verify.js צריך */
    wordsOnPage(p = page) {
      if (wordCache[p] != null) return wordCache[p];
      const slice = fullText.slice(bounds[p] ?? 0, bounds[p + 1] ?? fullText.length);
      const n = countWords(slice);
      wordCache[p] = n;
      return n;
    },

    /** היסט התווים של תחילת העמוד — כך נשמר המיקום (עמיד לשינוי גודל טקסט) */
    offsetOfPage(p = page) { return bounds[p] ?? 0; },

    /** לאיזה עמוד לחזור בשביל היסט שמור */
    pageOfOffset(offset) {
      if (!Number.isFinite(offset) || offset <= 0) return 0;
      for (let p = pageCount - 1; p >= 0; p--) if (bounds[p] <= offset) return p;
      return 0;
    },

    get totalWords() { return countWords(fullText); },
  };
}
