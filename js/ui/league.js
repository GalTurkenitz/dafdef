/**
 * league.js (UI) — ליגות וחברים.
 *
 * כל הנתונים עוברים דרך logic/league.js בלבד. אין כאן שום קריאה
 * ל-localStorage ושום ידיעה על מבנה האחסון — זה מה שיאפשר
 * להחליף את שכבת הנתונים בשרת בלי לגעת במסך הזה.
 *
 * המסכים:
 *   home      שני כפתורים — ליגות וחברים
 *   leagues   רשימת הליגות שאני חבר בהן, עם יצירה והצטרפות
 *   league    טבלת ליגה אחת
 *   settings  הגדרות ליגה אחת
 *   create    יצירת ליגה · join הצטרפות בקוד
 *   friends   החברים שלי · requests בקשות · add חיפוש והוספה
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountMenu } from './nav.js';
import { icon, iconFilled } from './icons.js';
import { toast } from './toast.js';
import { LEAGUE_METRICS, LEAGUE_PAGE_SIZE, NICHES } from '../config.js';
import * as league from '../logic/league.js';
import { getSettings, openDay } from '../logic/store.js';

const $ = (s) => document.querySelector(s);
const els = { title: $('[data-title]'), body: $('[data-body]') };

let view = 'home';       // home | leagues | league | settings | create | join | friends | requests | add
let leagueId = null;     // הליגה שנפתחה
let page = 0;
let timerId = null;

const esc = (v) => String(v).replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const go = (next, id = null) => { view = next; leagueId = id ?? leagueId; page = 0; render(); };

/* ------------------------------------------------------------------ *
 * תמונת הליגה
 *
 * התמונה נשמרת ב-localStorage כ-data-URL, ולכן חייבת לרדת בגודל:
 * צילום מהטלפון בגודל מלא ימלא את המכסה לבדו. חיתוך ריבועי
 * ב-256px ו-JPEG באיכות 0.7 יוצאים כמה עשרות קילובייט.
 * ------------------------------------------------------------------ */

const IMG_SIDE = 256;

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = IMG_SIDE;
      c.height = IMG_SIDE;
      c.getContext('2d').drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, IMG_SIDE, IMG_SIDE);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

/** אותו בורר תמונה בדיוק ביצירה ובהגדרות */
function imagePicker(current) {
  return `
    <div class="leagueimg">
      <label class="leagueimg__pick">
        <input type="file" accept="image/*" data-img-input hidden>
        <span class="leagueimg__preview" data-img-preview>${current
          ? `<img src="${current}" alt="">` : icon('plus', 20)}</span>
        <span class="leagueimg__text">תמונה לליגה<br><i class="t-small">לא חובה</i></span>
      </label>
      <button class="btn btn--ghost" type="button" data-img-clear
              ${current ? '' : 'hidden'}>הסרה</button>
    </div>`;
}

function bindImagePicker(initial = null) {
  const state = { value: initial };
  const input = els.body.querySelector('[data-img-input]');
  const preview = els.body.querySelector('[data-img-preview]');
  const clear = els.body.querySelector('[data-img-clear]');
  if (!input) return state;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      state.value = await shrinkImage(file);
      preview.innerHTML = `<img src="${state.value}" alt="">`;
      clear.hidden = false;
    } catch { toast('לא הצלחתי לקרוא את התמונה'); }
  });

  clear?.addEventListener('click', () => {
    state.value = null;
    preview.innerHTML = icon('plus', 20);
    clear.hidden = true;
  });

  return state;
}

/* ------------------------------------------------------------------ *
 * חלוניות
 * ------------------------------------------------------------------ */

/** אישור לפני פעולה שאי אפשר לבטל — חלונית קטנה במרכז המסך */
function confirmLeave(id) {
  const d = document.createElement('div');
  d.className = 'confirm';
  d.innerHTML = `
    <div class="confirm__scrim" data-no></div>
    <div class="confirm__panel" role="dialog" aria-modal="true"
         aria-label="אישור עזיבת ליגה">
      <p class="confirm__q">אתה בטוח שאתה רוצה לעזוב את הליגה?</p>
      <button class="btn btn--danger btn--block" type="button" data-yes>
        כן, אני רוצה לעזוב</button>
      <button class="btn btn--ghost btn--block" type="button" data-no>
        לא, אני רוצה להישאר</button>
    </div>`;

  document.body.appendChild(d);
  requestAnimationFrame(() => d.classList.add('is-open'));

  const close = () => { d.classList.remove('is-open'); setTimeout(() => d.remove(), 180); };
  d.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', close));
  d.querySelector('[data-yes]').addEventListener('click', () => {
    league.leaveLeague(id);
    d.remove();
    go('leagues');
  });
}

/* ------------------------------------------------------------------ *
 * פרופיל שחקן
 *
 * הערך הראשי לכל נישה. זהה במהותו ל-CARDS ב-stats.js, אבל מקוצר —
 * כאן מוצגת שורה אחת לנישה ולא כרטיס.
 * ------------------------------------------------------------------ */

const PROFILE_CARDS = {
  reading:   { main: (l) => l.reading.pages,      unit: 'עמודים',
               sub: (l) => `${l.reading.books} ספרים` },
  fitness:   { main: (l) => l.fitness.reps,       unit: 'חזרות',
               sub: (l) => `${l.fitness.pushups} שכיבות · ${l.fitness.squats} סקוואטים` },
  learning:  { main: (l) => l.learning.correct,   unit: 'תשובות',
               sub: (l) => `${l.learning.sets} סטים` },
  writing:   { main: (l) => l.writing.words,      unit: 'מילים',
               sub: (l) => `${l.writing.entries} רישומים` },
  breathing: { main: (l) => l.breathing.sessions, unit: 'תרגילים',
               sub: (l) => `${l.breathing.minutes} דקות` },
  water:     { main: (l) => l.water.cups,         unit: 'כוסות', sub: () => '' },
  steps:     { main: (l) => l.steps.steps,        unit: 'צעדים', sub: () => 'מעל קו הבסיס' },
  sleep:     { main: (l) => l.sleep.hours,        unit: 'שעות',  sub: () => 'מעל היעד' },
};

const fmt = (n) => Number(n).toLocaleString('he');

function showPlayer(username) {
  const p = league.getPlayer(username);
  if (!p) { toast('אפשר לראות פרופיל רק של חבר או שותף לליגה'); return; }

  const sheet = document.createElement('div');
  sheet.className = 'levelsheet';
  sheet.innerHTML = `
    <div class="levelsheet__scrim" data-close></div>
    <div class="levelsheet__panel" role="dialog" aria-modal="true"
         aria-label="פרופיל ${esc(p.username)}">
      <h2 class="levelsheet__title">${esc(p.username)}</h2>

      <div class="profilechips">
        <div class="streak${p.bestStreak ? ' is-lit' : ''}"
             aria-label="הרצף הכי גבוה ${p.bestStreak}">
          <span class="streak__icon">${icon('flame', 16)}</span>
          <span class="streak__num">${p.bestStreak}</span>
        </div>
        <div class="streak streak--level" aria-label="רמה ${p.level}">
          <span class="streak__icon">${iconFilled('badge', 16)}</span>
          <span class="streak__num">${p.level}</span>
        </div>
      </div>

      <div class="statgrid statgrid--profile">
        ${Object.entries(PROFILE_CARDS).map(([id, card]) => {
          const sub = card.sub(p.lifetime);
          return `
            <div class="statcard statcard--${id}">
              <span class="statcard__head">
                <span class="statcard__icon">${icon(NICHES[id].icon, 16)}</span>
                <span class="statcard__name">${NICHES[id].name}</span>
              </span>
              <span class="statcard__value">${fmt(card.main(p.lifetime))}</span>
              <span class="statcard__unit">${card.unit}</span>
              ${sub ? `<span class="statcard__sub">${sub}</span>` : ''}
            </div>`;
        }).join('')}
      </div>

      <button class="btn btn--primary btn--block" type="button" data-close>סגירה</button>
    </div>`;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('is-open'));

  const close = () => {
    sheet.classList.remove('is-open');
    setTimeout(() => sheet.remove(), 200);
  };
  sheet.querySelectorAll('[data-close]').forEach((e) => e.addEventListener('click', close));
}

/** שורות לחיצות — בטבלה וברשימת החברים. כפתור בתוך השורה גובר. */
function bindPlayerRows() {
  els.body.querySelectorAll('[data-player]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      showPlayer(row.dataset.player);
    });
  });
}

/* ------------------------------------------------------------------ *
 * שם משתמש — זמני, עד שהשאלון יקבע אותו
 * ------------------------------------------------------------------ */

function renderUsername() {
  els.title.textContent = 'ליגה';
  els.body.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>בחר שם משתמש</h1>
        <p class="t-sub">ככה חברים ימצאו אותך. אפשר לשנות בהמשך.</p>
      </div>
      <div class="onepage__body">
        <label class="search">
          <input class="search__input" type="text" data-name maxlength="20"
                 placeholder="שם משתמש" aria-label="שם משתמש">
        </label>
        <p class="t-small is-warn" data-err></p>
        <button class="btn btn--primary btn--block" data-save>שמירה</button>
      </div>
    </div>`;

  const input = els.body.querySelector('[data-name]');
  const err = els.body.querySelector('[data-err]');

  els.body.querySelector('[data-save]').addEventListener('click', () => {
    const res = league.setUsername(input.value);
    if (!res.ok) { err.textContent = res.reason; return; }
    render();
  });
}

/* ------------------------------------------------------------------ *
 * פתיח — ליגות או חברים
 * ------------------------------------------------------------------ */

function renderHome() {
  const requests = league.getRequestCount();
  /* כותרת העמוד כבר אומרת "ליגה" — אותה מילה פעמיים על אותו
     מסך היא סימן ברור לממשק שנבנה ממסכים ולא עוצב. */
  els.title.textContent = '';

  els.body.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>ליגה</h1>
        <p class="t-sub">תחרות שבועית מול מי שאתה בוחר.</p>
      </div>
      <div class="onepage__body">
        <!-- שתי הכניסות בקבוצה אחת עם קו מפריד ביניהן, ולא שני
             לוחות צפים. כשיש שני פריטים בלבד, שתי תיבות נפרדות
             באמצע מסך ריק נראות כמו מסך שלא הספיקו לסיים. -->
        <div class="rowgroup">
          <button class="bigbtn" type="button" data-go="leagues">
            <span class="bigbtn__icon">${icon('trophy', 26)}</span>
            <span class="bigbtn__text">ליגות
              <i class="t-small">${league.getLeagues().length} ליגות</i></span>
          </button>

          <button class="bigbtn" type="button" data-go="friends">
            <span class="bigbtn__icon">${icon('target', 26)}</span>
            <span class="bigbtn__text">חברים
              <i class="t-small">${league.getFriends().length} חברים</i></span>
            ${requests ? `<span class="badge">${requests}</span>` : ''}
          </button>
        </div>
      </div>
    </div>`;

  bindNav();
}

/* ------------------------------------------------------------------ *
 * רשימת הליגות
 * ------------------------------------------------------------------ */

function renderLeagues() {
  const list = league.getLeagues();
  els.title.textContent = 'ליגות';

  els.body.innerHTML = `
    <div class="league">
      <div class="listhead">
        <h2 class="listhead__title">הליגות שלי</h2>
        <div class="listhead__actions">
          <button class="btn btn--ghost btn--tiny" data-go="create">צור ליגה</button>
          <button class="btn btn--ghost btn--tiny" data-go="join">הצטרף</button>
        </div>
      </div>

      <div class="leaguelist">
        ${list.length ? list.map((l) => {
          const r = league.myRank(l.id);
          return `
            <button class="leaguecard" type="button" data-open="${l.id}">
              <span class="leaguecard__img">${l.image
                ? `<img src="${l.image}" alt="">` : icon('trophy', 20)}</span>
              <span class="leaguecard__body">
                <b class="leaguecard__name">${esc(l.name)}</b>
                <i class="t-small">${league.metricLabel(l.metric)} · ${l.members.length} משתתפים</i>
              </span>
              ${r ? `<span class="leaguecard__rank">${r.rank}<i>מתוך ${r.total}</i></span>` : ''}
            </button>`;
        }).join('')
        : '<p class="t-sub empty">עוד לא הצטרפת לאף ליגה.</p>'}
      </div>

      <div class="league__foot">
        <button class="iconbtn" type="button" data-go="home"
                aria-label="חזרה">${icon('arrow', 20)}</button>
      </div>
    </div>`;

  bindNav();
  els.body.querySelectorAll('[data-open]').forEach((b) => {
    b.addEventListener('click', () => go('league', b.dataset.open));
  });
}

/* ------------------------------------------------------------------ *
 * ליגה אחת
 * ------------------------------------------------------------------ */

/** ספירה לאחור בפורמט שעון: ימים · שעות · דקות · שניות */
function countdownParts(ms) {
  const t = Math.max(0, ms);
  return {
    d: Math.floor(t / 86_400_000),
    h: Math.floor(t / 3_600_000) % 24,
    m: Math.floor(t / 60_000) % 60,
    s: Math.floor(t / 1000) % 60,
  };
}

const pad = (n) => String(n).padStart(2, '0');

function renderLeague() {
  const my = league.getLeague(leagueId);
  if (!my) { go('leagues'); return; }

  const admin = league.isAdmin(leagueId);
  const adminNames = new Set(
    league.getMembers(leagueId).filter((m) => m.admin).map((m) => m.username));
  const rows = league.getStandings(leagueId);
  const pages = Math.max(1, Math.ceil(rows.length / LEAGUE_PAGE_SIZE));
  page = Math.min(page, pages - 1);
  const slice = rows.slice(page * LEAGUE_PAGE_SIZE, (page + 1) * LEAGUE_PAGE_SIZE);

  els.title.textContent = 'ליגה';
  els.body.innerHTML = `
    <div class="league">
      <div class="league__head">
        <div class="league__id">
          ${my.image ? `<img class="league__img" src="${my.image}" alt="">` : ''}
          <div>
            <h2 class="league__name">${esc(my.name)}</h2>
            <p class="t-small">${league.metricLabel(my.metric)} · השבוע</p>
          </div>
        </div>
        <button class="iconbtn" type="button" data-go="leagues"
                aria-label="חזרה לליגות">${icon('arrow', 20)}</button>
      </div>

      <div class="clock" data-timer aria-label="הזמן שנותר לסוף השבוע"></div>

      <div class="league__table">
        ${slice.map((r) => `
          <div class="leaguerow is-tap${r.me ? ' is-me' : ''}${
               r.rank <= 3 ? ` is-top is-top${r.rank}` : ''}"
               data-player="${esc(r.username)}" role="button" tabindex="0">
            <span class="leaguerow__rank">${r.rank}</span>
            <span class="leaguerow__name">${esc(r.username)}${
              adminNames.has(r.username) ? '<span class="rolechip">מנהל</span>' : ''}</span>
            <span class="leaguerow__value">${r.value.toLocaleString('he')}</span>
            ${admin && !r.me
              ? `<button class="leaguerow__x" data-remove="${esc(r.username)}"
                         aria-label="הסרה">${icon('x', 14)}</button>`
              : ''}
          </div>`).join('')}

        ${admin && page === pages - 1 ? `
          <button class="leagueadd" type="button" data-add-open>
            ${icon('plus', 18)}<span>הוסף חברים</span>
          </button>
          <div class="leagueadd__form" hidden data-add-form>
            <label class="search">
              <input class="search__input" type="text" data-add-name maxlength="20"
                     placeholder="שם משתמש" aria-label="הוספת חבר לליגה">
            </label>
            <p class="t-small is-warn" data-add-err></p>
          </div>` : ''}
      </div>

      ${pages > 1 ? `
        <div class="pager">
          <button class="pagebtn" data-page="-1" ${page === 0 ? 'disabled' : ''}
                  aria-label="הקודם">${icon('arrow', 20)}</button>
          <span class="pager__pos">${page + 1} מתוך ${pages}</span>
          <button class="pagebtn is-next" data-page="1" ${page >= pages - 1 ? 'disabled' : ''}
                  aria-label="הבא">${icon('arrow', 20)}</button>
        </div>` : ''}

      <div class="league__foot">
        <button class="iconbtn" type="button" data-go="settings"
                aria-label="הגדרות הליגה">${icon('settings', 20)}</button>
        <span class="league__code" data-copy title="העתקה">${my.code}</span>
      </div>
    </div>`;

  bindNav();
  bindPlayerRows();

  const timerEl = els.body.querySelector('[data-timer]');
  const tick = () => {
    const { d, h, m, s } = countdownParts(league.weekEndsAt() - Date.now());
    timerEl.innerHTML = `
      <span class="clock__unit"><b>${pad(d)}</b><i>ימים</i></span>
      <span class="clock__sep">:</span>
      <span class="clock__unit"><b>${pad(h)}</b><i>שעות</i></span>
      <span class="clock__sep">:</span>
      <span class="clock__unit"><b>${pad(m)}</b><i>דקות</i></span>
      <span class="clock__sep">:</span>
      <span class="clock__unit"><b>${pad(s)}</b><i>שניות</i></span>`;
  };
  tick();
  timerId = setInterval(tick, 1000);

  els.body.querySelector('[data-copy]')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(my.code).then(
      () => toast('הקוד הועתק'),
      () => toast(`הקוד: ${my.code}`));
  });

  els.body.querySelectorAll('[data-page]').forEach((b) => {
    b.addEventListener('click', () => { page += Number(b.dataset.page); render(); });
  });

  els.body.querySelectorAll('[data-remove]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = league.removeMember(leagueId, b.dataset.remove);
      if (!res.ok) { toast(res.reason); return; }
      render();
    });
  });

  /* צירוף חבר ישירות, בלי שהוא ימלא קוד */
  const addForm = els.body.querySelector('[data-add-form]');
  const addInput = els.body.querySelector('[data-add-name]');
  const addErr = els.body.querySelector('[data-add-err]');

  els.body.querySelector('[data-add-open]')?.addEventListener('click', () => {
    addForm.hidden = !addForm.hidden;
    if (!addForm.hidden) addInput.focus();
  });

  addInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const res = league.addMember(leagueId, addInput.value);
    if (!res.ok) { addErr.textContent = res.reason; return; }
    render();
  });
}

/* ------------------------------------------------------------------ *
 * הגדרות הליגה
 * ------------------------------------------------------------------ */

function renderSettings() {
  const my = league.getLeague(leagueId);
  if (!my) { go('leagues'); return; }

  const admin = league.isAdmin(leagueId);
  els.title.textContent = 'הגדרות';

  /* מי שאינו מנהל לא עורך כלום — רק יוצא */
  if (!admin) {
    els.body.innerHTML = `
      <div class="onepage">
        <div class="onepage__head">
          <h1>${esc(my.name)}</h1>
          <p class="t-sub">רק מנהל הליגה יכול לשנות את השם, התמונה והמדד.</p>
        </div>
        <div class="onepage__body">
          <button class="btn btn--ghost btn--block" data-go="league">חזרה</button>
          <button class="btn btn--danger btn--block" data-leave>עזוב ליגה</button>
        </div>
      </div>`;
    bindNav();
    els.body.querySelector('[data-leave]').addEventListener('click', () => confirmLeave(leagueId));
    return;
  }

  els.body.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>הגדרות הליגה</h1>
      </div>
      <div class="onepage__body">
        <label class="search">
          <input class="search__input" type="text" data-lname maxlength="24"
                 value="${esc(my.name)}" aria-label="שם הליגה">
        </label>

        ${imagePicker(my.image || null)}

        <div class="metricpick" role="radiogroup" aria-label="מדד הליגה">
          ${LEAGUE_METRICS.map((m) => `
            <button class="metricchip" data-metric="${m.id}" role="radio"
                    aria-checked="${m.id === my.metric}">${m.label}</button>`).join('')}
        </div>

        <p class="t-small is-warn" data-err></p>

        <div class="league__table">
          ${league.getMembers(leagueId).map((m) => `
            <div class="leaguerow">
              <span class="leaguerow__name">${esc(m.username)}${m.me ? ' (את/ה)' : ''}</span>
              ${m.admin ? '<span class="rolechip">מנהל</span>' : ''}
              ${m.owner ? '' : `
                <button class="btn btn--ghost btn--tiny" data-role="${esc(m.username)}"
                        data-on="${m.admin ? '0' : '1'}">
                  ${m.admin ? 'הסר ניהול' : 'מנה כמנהל'}</button>`}
            </div>`).join('')}
        </div>

        <button class="btn btn--primary btn--block" data-save>שמירה</button>
        <button class="btn btn--ghost btn--block" data-go="league">חזרה</button>
        <button class="btn btn--danger btn--block" data-leave>עזוב ליגה</button>
      </div>
    </div>`;

  bindNav();
  const img = bindImagePicker(my.image || null);
  const err = els.body.querySelector('[data-err]');
  let metric = my.metric;

  els.body.querySelectorAll('[data-metric]').forEach((b) => {
    b.addEventListener('click', () => {
      metric = b.dataset.metric;
      els.body.querySelectorAll('[data-metric]').forEach((x) =>
        x.setAttribute('aria-checked', String(x === b)));
    });
  });

  els.body.querySelector('[data-save]').addEventListener('click', () => {
    const res = league.updateLeague(leagueId, {
      name: els.body.querySelector('[data-lname]').value,
      metric,
      image: img.value,
    });
    if (!res.ok) { err.textContent = res.reason; return; }
    toast('נשמר');
    go('league');
  });

  els.body.querySelectorAll('[data-role]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = league.setAdmin(leagueId, b.dataset.role, b.dataset.on === '1');
      if (!res.ok) { toast(res.reason); return; }
      render();
    });
  });

  els.body.querySelector('[data-leave]').addEventListener('click', () => confirmLeave(leagueId));
}

/* ------------------------------------------------------------------ *
 * יצירה והצטרפות
 * ------------------------------------------------------------------ */

function renderCreate() {
  els.title.textContent = 'צור ליגה';
  els.body.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>ליגה חדשה</h1>
        <p class="t-sub">בחר לפי מה סופרים. כל ליגה סופרת אחרת.</p>
      </div>
      <div class="onepage__body">
        <label class="search">
          <input class="search__input" type="text" data-lname maxlength="24"
                 placeholder="שם הליגה" aria-label="שם הליגה">
        </label>

        ${imagePicker(null)}

        <div class="metricpick" role="radiogroup" aria-label="מדד הליגה">
          ${LEAGUE_METRICS.map((m, i) => `
            <button class="metricchip" data-metric="${m.id}"
                    role="radio" aria-checked="${i === 0}">${m.label}</button>`).join('')}
        </div>

        <p class="t-small is-warn" data-err></p>
        <button class="btn btn--primary btn--block" data-create>צור</button>
        <button class="btn btn--ghost btn--block" data-go="leagues">חזרה</button>
      </div>
    </div>`;

  const img = bindImagePicker(null);
  let metric = LEAGUE_METRICS[0].id;
  els.body.querySelectorAll('[data-metric]').forEach((b) => {
    b.addEventListener('click', () => {
      metric = b.dataset.metric;
      els.body.querySelectorAll('[data-metric]').forEach((x) =>
        x.setAttribute('aria-checked', String(x === b)));
    });
  });

  bindNav();
  const err = els.body.querySelector('[data-err]');

  els.body.querySelector('[data-create]').addEventListener('click', () => {
    const res = league.createLeague(
      els.body.querySelector('[data-lname]').value, metric, img.value);
    if (!res.ok) { err.textContent = res.reason; return; }
    go('league', res.league.id);
  });
}

function renderJoin() {
  els.title.textContent = 'הצטרפות';
  els.body.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>הצטרף עם קוד</h1>
        <p class="t-sub">שישה תווים שקיבלת ממי שיצר את הליגה.</p>
      </div>
      <div class="onepage__body">
        <label class="search">
          <input class="search__input codeinput" type="text" data-code maxlength="6"
                 placeholder="ABC123" aria-label="קוד הזמנה" autocapitalize="characters">
        </label>
        <p class="t-small is-warn" data-err></p>
        <button class="btn btn--primary btn--block" data-join>הצטרף</button>
        <button class="btn btn--ghost btn--block" data-go="leagues">חזרה</button>
      </div>
    </div>`;

  bindNav();
  const err = els.body.querySelector('[data-err]');

  els.body.querySelector('[data-join]').addEventListener('click', () => {
    const res = league.joinByCode(els.body.querySelector('[data-code]').value);
    if (!res.ok) { err.textContent = res.reason; return; }
    go('league', res.league.id);
  });
}

/* ------------------------------------------------------------------ *
 * חברים
 * ------------------------------------------------------------------ */

function renderFriends() {
  els.title.textContent = 'חברים';
  const friends = league.getFriends();
  const requests = league.getRequestCount();

  els.body.innerHTML = `
    <div class="league">
      <div class="listhead">
        <h2 class="listhead__title">החברים שלי</h2>
        <div class="listhead__actions">
          <button class="btn btn--ghost btn--tiny reqbtn" data-go="requests">
            בקשות${requests ? `<span class="badge">${requests}</span>` : ''}
          </button>
          <button class="btn btn--ghost btn--tiny" data-go="add">הוסף חבר</button>
        </div>
      </div>

      <div class="leaguelist">
        ${friends.length ? friends.map((f) => `
          <div class="leaguerow is-tap" data-player="${esc(f.username)}"
               role="button" tabindex="0">
            <span class="leaguerow__name">${esc(f.username)}</span>
            <span class="leaguerow__value">${league.friendWeeklyXp(f.username).toLocaleString('he')}</span>
            <button class="leaguerow__x" data-unfriend="${esc(f.username)}"
                    aria-label="הסרה">${icon('x', 14)}</button>
          </div>`).join('')
        : '<p class="t-sub empty">עוד לא הוספת חברים.</p>'}
      </div>

      <div class="league__foot">
        <button class="iconbtn" type="button" data-go="home"
                aria-label="חזרה">${icon('arrow', 20)}</button>
      </div>
    </div>`;

  bindNav();
  bindPlayerRows();

  els.body.querySelectorAll('[data-unfriend]').forEach((b) => {
    b.addEventListener('click', () => { league.removeFriend(b.dataset.unfriend); render(); });
  });
}

function renderRequests() {
  els.title.textContent = 'בקשות';
  const requests = league.getRequests();

  els.body.innerHTML = `
    <div class="league">
      <div class="listhead">
        <h2 class="listhead__title">בקשות חברות</h2>
      </div>

      <div class="leaguelist">
        ${requests.length ? requests.map((r) => `
          <div class="reqrow">
            <span class="reqrow__name is-tap" data-player="${esc(r.from)}"
                  role="button" tabindex="0">${esc(r.from)}</span>
            <button class="btn btn--ok btn--tiny" data-accept="${esc(r.from)}">אשר</button>
            <button class="btn btn--danger btn--tiny" data-reject="${esc(r.from)}">דחה</button>
          </div>`).join('')
        : '<p class="t-sub empty">אין בקשות חדשות.</p>'}
      </div>

      <div class="league__foot">
        <button class="iconbtn" type="button" data-go="friends"
                aria-label="חזרה">${icon('arrow', 20)}</button>
      </div>
    </div>`;

  bindNav();
  bindPlayerRows();

  els.body.querySelectorAll('[data-accept]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = league.acceptRequest(b.dataset.accept);
      if (!res.ok) { toast(res.reason); return; }
      toast(`${b.dataset.accept} נוסף לחברים`);
      render();
    });
  });

  els.body.querySelectorAll('[data-reject]').forEach((b) => {
    b.addEventListener('click', () => { league.rejectRequest(b.dataset.reject); render(); });
  });
}

function renderAdd() {
  els.title.textContent = 'הוסף חבר';

  els.body.innerHTML = `
    <div class="league">
      <div class="listhead">
        <h2 class="listhead__title">חיפוש</h2>
      </div>

      <label class="search">
        <span class="search__icon">${icon('search', 20)}</span>
        <input class="search__input" type="text" data-q
               placeholder="שם משתמש" aria-label="חיפוש שם משתמש">
      </label>
      <p class="t-small is-warn" data-err></p>

      <div class="leaguelist" data-results>
        <p class="t-sub empty">הקלד שם משתמש כדי לחפש.</p>
      </div>

      <div class="league__foot">
        <button class="iconbtn" type="button" data-go="friends"
                aria-label="חזרה">${icon('arrow', 20)}</button>
      </div>
    </div>`;

  bindNav();
  const input = els.body.querySelector('[data-q]');
  const out = els.body.querySelector('[data-results]');
  const err = els.body.querySelector('[data-err]');

  /* בחיפוש אין סטטיסטיקה — רק שם וכפתור. הפרופיל נפתח רק למי
     שכבר בקשר איתי (canSeeProfile בשכבת הלוגיקה). */
  const show = () => {
    const rows = league.searchUsers(input.value);
    if (!rows.length) {
      out.innerHTML = input.value.trim().length < 2
        ? '<p class="t-sub empty">הקלד שם משתמש כדי לחפש.</p>'
        : '<p class="t-sub empty">לא נמצאו משתמשים.</p>';
      return;
    }
    out.innerHTML = rows.map((r) => `
      <div class="leaguerow">
        <span class="leaguerow__name">${esc(r.username)}</span>
        ${r.friend ? '<span class="t-small">חבר שלך</span>'
        : r.pending ? '<span class="t-small">נשלחה בקשה</span>'
        : `<button class="btn btn--ghost btn--tiny" data-req="${esc(r.username)}">
             בקש חברות</button>`}
      </div>`).join('');

    out.querySelectorAll('[data-req]').forEach((b) => {
      b.addEventListener('click', () => {
        const res = league.sendRequest(b.dataset.req);
        if (!res.ok) { err.textContent = res.reason; return; }
        err.textContent = '';
        toast('הבקשה נשלחה');
        show();
      });
    });
  };

  input.addEventListener('input', show);
}

/* ------------------------------------------------------------------ */

function bindNav() {
  els.body.querySelectorAll('[data-go]').forEach((b) => {
    b.addEventListener('click', () => go(b.dataset.go));
  });
}

function render() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (!league.getUsername()) { renderUsername(); return; }

  switch (view) {
    case 'leagues':  renderLeagues(); break;
    case 'league':   renderLeague(); break;
    case 'settings': renderSettings(); break;
    case 'create':   renderCreate(); break;
    case 'join':     renderJoin(); break;
    case 'friends':  renderFriends(); break;
    case 'requests': renderRequests(); break;
    case 'add':      renderAdd(); break;
    default:         renderHome();
  }
}

function init() {
  initTheme();
  if (!getSettings().onboardingDone) { location.replace('onboarding.html'); return; }

  openDay();
  renderNavbar('league');
  mountMenu();
  render();
}

init();
