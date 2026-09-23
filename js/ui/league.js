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
import { LEAGUE_METRICS, LEAGUE_PAGE_SIZE } from '../config.js';
import * as league from '../logic/league.js';
import { getSettings, openDay } from '../logic/store.js';

const $ = (s) => document.querySelector(s);
const els = { title: $('[data-title]'), body: $('[data-body]') };

let view = 'main';     // main | create | join | friends
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
 * הליגה שלי
 * ------------------------------------------------------------------ */

function renderMain() {
  const my = league.getMyLeague();
  els.title.textContent = 'ליגה';

  if (!my) {
    els.body.innerHTML = `
      <div class="onepage">
        <div class="onepage__head">
          <h1>עוד אין לך ליגה</h1>
          <p class="t-sub">צור ליגה והזמן חברים, או הצטרף עם קוד שקיבלת.</p>
        </div>
        <div class="onepage__body">
          <button class="btn btn--primary btn--block" data-go="create">צור ליגה</button>
          <button class="btn btn--secondary btn--block" data-go="join">הצטרף עם קוד</button>
          <button class="btn btn--ghost btn--block" data-go="friends">החברים שלי</button>
        </div>
      </div>`;
    bindNav();
    return;
  }

  const rows = league.getStandings();
  const pages = Math.max(1, Math.ceil(rows.length / LEAGUE_PAGE_SIZE));
  page = Math.min(page, pages - 1);
  const slice = rows.slice(page * LEAGUE_PAGE_SIZE, (page + 1) * LEAGUE_PAGE_SIZE);

  els.body.innerHTML = `
    <div class="league">
      <div class="league__head">
        <div>
          <h2 class="league__name">${my.name}</h2>
          <p class="t-small">${league.metricLabel(my.metric)} · השבוע</p>
        </div>
        <span class="league__code" data-copy title="העתקה">${my.code}</span>
      </div>

      <div class="league__table">
        ${slice.map((r) => `
          <div class="leaguerow${r.me ? ' is-me' : ''}">
            <span class="leaguerow__rank">${r.rank}</span>
            <span class="leaguerow__name">${r.username}</span>
            <span class="leaguerow__value">${r.value.toLocaleString('he')}</span>
            ${my.owner === league.getUsername() && !r.me
              ? `<button class="leaguerow__x" data-remove="${r.username}"
                         aria-label="הסרה">${icon('x', 14)}</button>`
              : ''}
          </div>`).join('')}
      </div>

      ${pages > 1 ? `
        <div class="pager">
          <button class="pagebtn" data-page="-1" ${page === 0 ? 'disabled' : ''}
                  aria-label="הקודם">${icon('arrow', 20)}</button>
          <span class="pager__pos">${page + 1} מתוך ${pages}</span>
          <button class="pagebtn is-next" data-page="1" ${page >= pages - 1 ? 'disabled' : ''}
                  aria-label="הבא">${icon('arrow', 20)}</button>
        </div>` : ''}

      <div class="league__actions">
        <button class="btn btn--ghost" data-go="friends">חברים</button>
        <button class="btn btn--ghost" data-close-week>סיים שבוע</button>
        <button class="btn btn--ghost" data-leave>עזוב ליגה</button>
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

  els.body.querySelectorAll('[data-remove]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = league.removeMember(b.dataset.remove);
      if (!res.ok) { toast(res.reason); return; }
      render();
    });
  });

  els.body.querySelector('[data-leave]')?.addEventListener('click', () => {
    league.leaveLeague();
    render();
  });

  els.body.querySelector('[data-close-week]')?.addEventListener('click', () => {
    const res = league.closeWeek();
    if (!res.ok) { toast(res.reason); return; }
    showWeekResult(res);
  });
}

/** סיכום שבוע — מי ניצח, ומה קיבל */
function showWeekResult(res) {
  const sheet = document.createElement('div');
  sheet.className = 'levelsheet';
  sheet.innerHTML = `
    <div class="levelsheet__scrim" data-close></div>
    <div class="levelsheet__panel" role="dialog" aria-modal="true" aria-label="סיכום שבוע">
      <span class="levelsheet__badge">${icon('trophy', 26)}</span>
      <h2 class="levelsheet__title">${res.winner}</h2>
      <p class="levelsheet__sub">
        ${res.iWon ? `ניצחת — ${res.prize} נקודות לרמה שלך` : 'סיים ראשון השבוע'}
      </p>

      <div class="levelsheet__rows">
        ${res.standings.slice(0, 5).map((r) => `
          <div class="levelsheet__row">
            <span>${r.rank}. ${r.username}</span>
            <b>${r.value.toLocaleString('he')}</b>
          </div>`).join('')}
      </div>

      <button class="btn btn--primary btn--block" type="button" data-close>שבוע חדש</button>
    </div>`;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('is-open'));

  const close = () => {
    sheet.classList.remove('is-open');
    setTimeout(() => { sheet.remove(); render(); }, 200);
  };
  sheet.querySelectorAll('[data-close]').forEach((e) => e.addEventListener('click', close));
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
    const res = league.createLeague(els.body.querySelector('[data-lname]').value, metric);
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
            <div class="leaguerow">
              <span class="leaguerow__name">${f.username}</span>
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
  if (!league.getUsername()) { renderUsername(); return; }

  switch (view) {
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
