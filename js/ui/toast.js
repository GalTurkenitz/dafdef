/**
 * toast.js — הודעה עדינה וחולפת.
 * משמש למיקרו-קופי של המפרט (סעיף 8), למשל דפדוף מהיר בקורא.
 */

let node = null;
let timer = null;

function ensureNode() {
  if (node && node.isConnected) return node;
  node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.innerHTML = '<div class="toast__body"></div>';
  document.body.appendChild(node);
  return node;
}

/**
 * @param {string} message
 * @param {number} [ms=2200] כמה זמן להציג
 */
export function toast(message, ms = 2200) {
  const n = ensureNode();
  n.querySelector('.toast__body').textContent = message;

  clearTimeout(timer);
  requestAnimationFrame(() => n.classList.add('is-open'));
  timer = setTimeout(() => n.classList.remove('is-open'), ms);
}
