/**
 * league.js (UI) — עמוד הליגה (V4, סעיף 2.3).
 *
 * כל הנתונים עוברים דרך logic/league.js בלבד. אין כאן שום קריאה
 * ל-localStorage ושום ידיעה על מבנה האחסון — זה מה שיאפשר
 * להחליף את שכבת הנתונים בשרת בלי לגעת במסך הזה.
 *
 * המסכים: שם משתמש · הליגה שלי · יצירה · הצטרפות · חברים.
 * כולם נכנסים במסך אחד בלי גלילה, חוץ מטבלה ארוכה שמדפדפת.
 */

import { initTheme } from './theme.js';
import { renderNavbar, mountMenu } from './nav.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { LEAGUE_METRICS, LEAGUE_PAGE_SIZE, NICHES } from '../config.js';
import * as league from '../logic/league.js';
import { getSettings, openDay } from '../logic/store.js';

const $ = (s) => document.querySelector(s);
const els = { title: $('[data-title]'), body: $('[data-body]') };

let timerId = null;
let view = 'main';     // main | home | settings | create | join | friends
let page = 0;

/* ------------------------------------------------------------------ *
 * שם משתמש — פעם אחת, לפני הכל
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
 * תמונת הליגה
 *
 * התמונה נשמרת ב-localStorage כ-data-URL, ולכן חייבת לרדת בגודל:
 * צילום מהטלפון בגודל מלא ימלא את המכסה לבדו. חיתוך למרכע ריבועי
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

const esc = (v) => String(v).replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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

/* אישור לפני פעולה שאי אפשר לבטל — חלונית קטנה במרכז המסך */
function confirmLeave() {
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
    league.leaveLeague();
    d.remove();
    view = 'home';
    render();
  });
}


/** כמה נשאר לשבוע, בטקסט קצר */
function timeLeftText(ms) {
  if (ms <= 0) return 'השבוע נגמר';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor(ms / 3_600_000) % 24;
  const m = Math.floor(ms / 60_000) % 60;
  if (d > 0) return `עוד ${d} ${d === 1 ? 'יום' : 'ימים'} ו-${h} שעות`;
  if (h > 0) return `עוד ${h} שעות ו-${m} דקות`;
  return `עוד ${m} דקות`;
}

/* ------------------------------------------------------------------ *
 * פרופיל שחקן
 *
 * הערך הראשי לכל נישה. זהה במהותו ל-CARDS ב-stats.js, אבל מקוצר —
 * כאן מוצגת שורה אחת לנישה ולא כרטיס.
 * ------------------------------------------------------------------ */

const PROFILE_MAIN = {
  reading:   (l) => [l.reading.pages, 'עמודים'],
  fitness:   (l) => [l.fitness.reps, 'חזרות'],
  learning:  (l) => [l.learning.correct, 'תשובות'],
  writing:   (l) => [l.writing.words, 'מילים'],
  breathing: (l) => [l.breathing.sessions, 'תרגילים'],
  water:     (l) => [l.water.cups, 'כוסות'],
  steps:     (l) => [l.steps.steps, 'צעדים'],
  sleep:     (l) => [l.sleep.hours, 'שעות'],
};

function showPlayer(username) {
  const p = league.getPlayer(username);
  if (!p) { toast('לא נמצא פרופיל'); return; }

  const sheet = document.createElement('div');
  sheet.className = 'levelsheet';
  sheet.innerHTML = `
    <div class="levelsheet__scrim" data-close></div>
    <div class="levelsheet__panel" role="dialog" aria-modal="true"
         aria-label="פרופיל ${esc(p.username)}">
      <span class="levelsheet__badge">${p.level}</span>
      <h2 class="levelsheet__title">${esc(p.username)}</h2>
      <p class="levelsheet__sub">
        רמה ${p.level} · הרצף הכי גבוה ${p.bestStreak} ${p.bestStreak === 1 ? 'יום' : 'ימים'}
      </p>

      <div class="levelsheet__rows">
        ${Object.entries(PROFILE_MAIN).map(([id, get]) => {
          const [value, unit] = get(p.lifetime);
          return `
            <div class="levelsheet__row">
              <span>${NICHES[id]?.name || id}</span>
              <b>${Number(value).toLocaleString('he')} ${unit}</b>
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
 * הגדרות הליגה
 * ------------------------------------------------------------------ */

function renderSettings() {
  const my = league.getMyLeague();
  if (!my) { view = 'home'; render(); return; }

  const admin = league.isAdmin();
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
          <button class="btn btn--ghost btn--block" data-go="main">חזרה</button>
          <button class="btn btn--danger btn--block" data-leave>עזוב ליגה</button>
        </div>
      </div>`;
    bindNav();
    els.body.querySelector('[data-leave]').addEventListener('click', confirmLeave);
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
          ${league.getMembers().map((m) => `
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
        <button class="btn btn--ghost btn--block" data-go="main">חזרה</button>
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
    const res = league.updateLeague({
      name: els.body.querySelector('[data-lname]').value,
      metric,
      image: img.value,
    });
    if (!res.ok) { err.textContent = res.reason; return; }
    toast('נשמר');
    view = 'main';
    render();
  });

  els.body.querySelectorAll('[data-role]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = league.setAdmin(b.dataset.role, b.dataset.on === '1');
      if (!res.ok) { toast(res.reason); return; }
      render();
    });
  });

  els.body.querySelector('[data-leave]').addEventListener('click', confirmLeave);
}

/* ------------------------------------------------------------------ *
 * הליגה שלי
 * ------------------------------------------------------------------ */

/* דף הליגה הראשוני — המדף שממנו נכנסים פנימה. כל הפעולות שאינן
   הטבלה עצמה יושבות כאן, כדי שבתוך הליגה יהיה רק מה שרלוונטי לה. */
function renderHome() {
  const my = league.getMyLeague();
  els.title.textContent = 'ליגה';

  els.body.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>${my ? my.name : 'עוד אין לך ליגה'}</h1>
        <p class="t-sub">${my
          ? 'תחרות שבועית מול מי שהזמנת.'
          : 'צור ליגה והזמן חברים, או הצטרף עם קוד שקיבלת.'}</p>
      </div>
      <div class="onepage__body">
        ${my ? `
          <button class="btn btn--primary btn--block" data-go="main">הליגה שלי</button>
          <button class="btn btn--ghost btn--block" data-go="friends">החברים שלי</button>
`
        : `
          <button class="btn btn--primary btn--block" data-go="create">צור ליגה</button>
          <button class="btn btn--secondary btn--block" data-go="join">הצטרף עם קוד</button>
          <button class="btn btn--ghost btn--block" data-go="friends">החברים שלי</button>`}
      </div>
    </div>`;

  bindNav();
}

function renderMain() {
  const my = league.getMyLeague();
  if (!my) { renderHome(); return; }

  els.title.textContent = 'ליגה';

  const admin = league.isAdmin();
  const adminNames = new Set(
    league.getMembers().filter((m) => m.admin).map((m) => m.username));
  const rows = league.getStandings();
  const pages = Math.max(1, Math.ceil(rows.length / LEAGUE_PAGE_SIZE));
  page = Math.min(page, pages - 1);
  const slice = rows.slice(page * LEAGUE_PAGE_SIZE, (page + 1) * LEAGUE_PAGE_SIZE);

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
        <span class="league__code" data-copy title="העתקה">${my.code}</span>
      </div>

      <p class="league__timer" data-timer></p>

      <div class="league__table">
        ${slice.map((r) => `
          <div class="leaguerow is-tap${r.me ? ' is-me' : ''}"
               data-player="${esc(r.username)}" role="button" tabindex="0">
            <span class="leaguerow__rank">${r.rank}</span>
            <span class="leaguerow__name">${esc(r.username)}${
              adminNames.has(r.username) ? '<span class="rolechip">מנהל</span>' : ''}</span>
            <span class="leaguerow__value">${r.value.toLocaleString('he')}</span>
            ${admin && !r.me
              ? `<button class="leaguerow__x" data-remove="${r.username}"
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
        <button class="btn btn--ghost" data-go="home">חזרה</button>
      </div>
    </div>`;

  bindNav();

  els.body.querySelector('[data-copy]')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(my.code).then(
      () => toast('הקוד הועתק'),
      () => toast(`הקוד: ${my.code}`));
  });

  els.body.querySelectorAll('[data-page]').forEach((b) => {
    b.addEventListener('click', () => { page += Number(b.dataset.page); render(); });
  });

  const timerEl = els.body.querySelector('[data-timer]');
  const tick = () => {
    timerEl.textContent = timeLeftText(league.weekEndsAt() - Date.now());
  };
  tick();
  timerId = setInterval(tick, 30_000);

  bindPlayerRows();

  els.body.querySelectorAll('[data-remove]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = league.removeMember(b.dataset.remove);
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
    const res = league.addMember(addInput.value);
    if (!res.ok) { addErr.textContent = res.reason; return; }
    render();
  });
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
        <button class="btn btn--ghost btn--block" data-go="main">חזרה</button>
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
    view = 'main';
    render();
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
        <button class="btn btn--ghost btn--block" data-go="main">חזרה</button>
      </div>
    </div>`;

  bindNav();
  const err = els.body.querySelector('[data-err]');

  els.body.querySelector('[data-join]').addEventListener('click', () => {
    const res = league.joinByCode(els.body.querySelector('[data-code]').value);
    if (!res.ok) { err.textContent = res.reason; return; }
    view = 'main';
    render();
  });
}

/* ------------------------------------------------------------------ *
 * חברים
 * ------------------------------------------------------------------ */

function renderFriends() {
  els.title.textContent = 'חברים';
  const friends = league.getFriends();

  els.body.innerHTML = `
    <div class="onepage">
      <div class="onepage__head">
        <h1>החברים שלי</h1>
        <p class="t-sub">רואים את הנקודות השבועיות שלהם גם בלי ליגה משותפת.</p>
      </div>
      <div class="onepage__body">
        <label class="search">
          <span class="search__icon">${icon('search', 20)}</span>
          <input class="search__input" type="text" data-friend
                 placeholder="הוסף לפי שם משתמש" aria-label="הוסף חבר">
        </label>
        <p class="t-small is-warn" data-err></p>

        <div class="league__table">
          ${friends.length ? friends.map((f) => `
            <div class="leaguerow is-tap" data-player="${esc(f.username)}"
                 role="button" tabindex="0">
              <span class="leaguerow__name">${esc(f.username)}</span>
              <span class="leaguerow__value">${league.friendWeeklyXp(f.username).toLocaleString('he')}</span>
              <button class="leaguerow__x" data-unfriend="${f.username}"
                      aria-label="הסרה">${icon('x', 14)}</button>
            </div>`).join('')
          : '<p class="t-sub empty">עוד לא הוספת חברים.</p>'}
        </div>

        <button class="btn btn--ghost btn--block" data-go="main">חזרה</button>
      </div>
    </div>`;

  bindNav();
  const err = els.body.querySelector('[data-err]');
  const input = els.body.querySelector('[data-friend]');

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const res = league.addFriend(input.value);
    if (!res.ok) { err.textContent = res.reason; return; }
    render();
  });

  bindPlayerRows();

  els.body.querySelectorAll('[data-unfriend]').forEach((b) => {
    b.addEventListener('click', () => { league.removeFriend(b.dataset.unfriend); render(); });
  });
}

/* ------------------------------------------------------------------ */

function bindNav() {
  els.body.querySelectorAll('[data-go]').forEach((b) => {
    b.addEventListener('click', () => { view = b.dataset.go; page = 0; render(); });
  });
}

function render() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (!league.getUsername()) { renderUsername(); return; }

  switch (view) {
    case 'home':    renderHome(); break;
    case 'settings': renderSettings(); break;
    case 'create':  renderCreate(); break;
    case 'join':    renderJoin(); break;
    case 'friends': renderFriends(); break;
    default:        renderMain();
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
