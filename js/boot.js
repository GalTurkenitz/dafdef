/**
 * boot.js — רץ לפני כל מודול, בכל עמוד. סקריפט קלאסי ולא מודול,
 * כדי שירוץ מוקדם ככל האפשר וללא תלות.
 *
 * שלוש אחריויות:
 *
 * 1. חותמת גרסה. BUILD מוטבע כאן, ו-version.json נשלף מהרשת.
 *    אם הם שונים — הדפדפן מחזיק גרסה ישנה, ואנחנו טוענים מחדש
 *    עם פרמטר ?b= שהוא כתובת חדשה שהמטמון לא מכיר. זה הדבר
 *    היחיד שספארי באייפון לא יכול להתעלם ממנו.
 *
 * 2. שומר על סימן היכר לגרסה כדי שאפשר יהיה לשאול "מה אתה מריץ"
 *    ולקבל תשובה ודאית, במקום לנחש.
 *
 * 3. רשת ביטחון לשגיאות. כשמשהו נופל בטלפון, המסך מראה את זה
 *    במקום פשוט לאבד חלק מהממשק בשקט.
 */
(function () {
  'use strict';

  var BUILD = '20260923-0040';
  window.DAFDEF_BUILD = BUILD;

  /* ---------- 1+2: בדיקת גרסה ---------- */

  try {
    if (!/[?&]b=/.test(location.search)) {
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (v) {
          if (!v || !v.build || v.build === BUILD) return;
          // פעם אחת בלבד — כדי שלא ניכנס ללולאת טעינות
          if (sessionStorage.getItem('dafdef:build-retry') === v.build) return;
          sessionStorage.setItem('dafdef:build-retry', v.build);
          location.replace(location.pathname + '?b=' + encodeURIComponent(v.build));
        })
        .catch(function () {});
    }
  } catch (e) {}

  /* ---------- 3: רשת ביטחון ---------- */

  var shown = false;

  function banner(what, msg) {
    if (shown) return;
    shown = true;
    function paint() {
      var el = document.createElement('div');
      el.setAttribute('role', 'alert');
      el.style.cssText = 'position:fixed;inset-inline:0;top:0;z-index:9999;'
        + 'background:#B3403A;color:#fff;font:13px/1.45 system-ui,sans-serif;'
        + 'padding:10px 14px;text-align:start;direction:rtl;white-space:pre-wrap;'
        + 'box-shadow:0 2px 10px rgba(0,0,0,.35)';
      el.textContent = 'תקלה בטעינה (' + what + ') · גרסה ' + BUILD + '\n' + msg;
      (document.body || document.documentElement).appendChild(el);
    }
    if (document.body) paint();
    else document.addEventListener('DOMContentLoaded', paint);
  }

  window.DAFDEF_FAIL = banner;

  window.addEventListener('error', function (e) {
    banner('script', (e && e.message) || 'שגיאה לא ידועה');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    banner('promise', (r && (r.message || String(r))) || 'דחייה לא מטופלת');
  });
})();
