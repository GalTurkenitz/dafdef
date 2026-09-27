/**
 * league.js — שכבת הנתונים של הליגות והחברים (V4 סעיף 2.2, מורחב).
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  זו שכבת הגישה היחידה לנתוני הליגות והחברים.                 │
 * │                                                              │
 * │  ליגה אמיתית דורשת שרת וחשבונות — שמות משתמש, חברים, קודים   │
 * │  וטבלה משותפת — וזה נדחה לאחרי סבב השיווק. לכן היום הכל      │
 * │  רץ מקומית על localStorage, עם משתמשים מדומים.               │
 * │                                                              │
 * │  **ה-UI לא נוגע ב-localStorage ולא בנתוני הדמו בשום מקום.**  │
 * │  כשתגיע שכבת רשת, מחליפים את גוף הפונקציות כאן בלבד —        │
 * │  החתימות נשארות, ו-league.html לא משתנה.                     │
 * └──────────────────────────────────────────────────────────────┘
 *
 * המשתמש חבר בכמה ליגות במקביל, ולכן רוב ה-API מקבל leagueId
 * כארגומנט ראשון.
 */

import { STORE_PREFIX, LEAGUE_METRICS, XP } from '../config.js';
import { getWeekly, awardXp, read as readRaw,
         getLevelState, getStreak, getLifetime } from './store.js';

const KEY = STORE_PREFIX + 'league';

/* ------------------------------------------------------------------ *
 * אחסון
 * ------------------------------------------------------------------ */

function read() {
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { data = {}; }

  /* הגירה מהמבנה הישן של ליגה יחידה */
  if (data.league && !data.leagues) {
    data.leagues = [{ id: 'lg-legacy', ...data.league }];
    delete data.league;
  }

  data.leagues ??= [];
  data.friends ??= [];
  data.requests ??= [];   // בקשות שנכנסו אליי
  data.sent ??= [];       // בקשות ששלחתי
  return data;
}

function write(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* חסום */ }
  return next;
}

/* ------------------------------------------------------------------ *
 * משתמשים מדומים
 *
 * מסומנים ב-demo:true כדי שיהיה אפשר לזהות ולמחוק אותם ביום
 * שבו מגיעה שכבת רשת אמיתית.
 * ------------------------------------------------------------------ */

const DEMO_FRIENDS = [
  { id: 'd1', username: 'noam_l',   demo: true, seed: 37 },
  { id: 'd2', username: 'shira.k',  demo: true, seed: 71 },
  { id: 'd3', username: 'yuval99',  demo: true, seed: 13 },
  { id: 'd4', username: 'tamar_b',  demo: true, seed: 54 },
  { id: 'd5', username: 'idan.rz',  demo: true, seed: 92 },
  { id: 'd6', username: 'maya_g',   demo: true, seed: 26 },
  { id: 'd7', username: 'omer.dev', demo: true, seed: 48 },
  { id: 'd8', username: 'lior_s',   demo: true, seed: 65 },
  { id: 'd9', username: 'roni.bk',  demo: true, seed: 19 },
];

/**
 * בדמו אין שרת, ולכן אף אחד לא באמת יכול לשלוח בקשת חברות ומסך
 * הבקשות היה נשאר ריק לנצח. שתי בקשות נזרעות פעם אחת כדי שאפשר
 * יהיה לראות ולהדגים את המסך.
 *
 * למחיקה ביום שיש שרת: להוריד את הקריאות ל-seedRequestsOnce.
 */
const DEMO_REQUESTS = ['shira.k', 'idan.rz'];

function seedRequestsOnce(data) {
  if (data.requestsSeeded) return data;
  data.requestsSeeded = true;
  data.requests = DEMO_REQUESTS
    .filter((u) => !data.friends.includes(u))
    .map((from) => ({ from, at: Date.now(), demo: true }));
  return write(data);
}

/**
 * ערך מדומה יציב לחבר במדד נתון. נגזר מה-seed ומהמדד, כך שהוא
 * לא קופץ בכל רינדור אבל כן שונה בין מדדים ובין שבועות.
 */
function demoValue(friend, metric, week = '') {
  const base = friend.seed * 7 + metric.length * 13;
  const drift = [...week].reduce((a, c) => a + c.charCodeAt(0), 0) % 40;
  const raw = (base + drift) % 100;

  switch (metric) {
    case 'xp':               return 60 + raw * 4;
    case 'steps':            return 1000 + raw * 400;
    case 'writing':          return 40 + raw * 12;
    case 'fitness.pushups':  return 10 + raw;
    case 'sleep':            return Math.round(raw / 12);
    default:                 return Math.round(raw / 4);
  }
}

/* ------------------------------------------------------------------ *
 * שם משתמש
 * ------------------------------------------------------------------ */

export function getUsername() {
  return read().username || null;
}

/** @returns {{ok:boolean, reason?:string}} */
export function validateUsername(name = '') {
  const v = String(name).trim();
  if (v.length < 3) return { ok: false, reason: 'קצר מדי — לפחות שלושה תווים' };
  if (v.length > 20) return { ok: false, reason: 'ארוך מדי — עד עשרים תווים' };
  if (!/^[A-Za-z0-9._֐-׿-]+$/.test(v)) {
    return { ok: false, reason: 'אותיות, ספרות, נקודה, מקף וקו תחתון בלבד' };
  }
  if (DEMO_FRIENDS.some((f) => f.username === v)) {
    return { ok: false, reason: 'השם הזה תפוס' };
  }
  return { ok: true };
}

export function setUsername(name) {
  const check = validateUsername(name);
  if (!check.ok) return check;
  write({ ...read(), username: String(name).trim() });
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * ליגות
 * ------------------------------------------------------------------ */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // בלי 0/O/1/I

function makeCode() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

const makeId = () => 'lg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function getLeagues() {
  return read().leagues;
}

export function getLeague(id) {
  return read().leagues.find((l) => l.id === id) || null;
}

export function metricLabel(id) {
  return (LEAGUE_METRICS.find((m) => m.id === id) || LEAGUE_METRICS[0]).label;
}

/** ליגות שנוצרו לפני שהיו תפקידים — היוצר הוא המנהל */
function adminsOf(l) {
  return l?.admins?.length ? l.admins : (l ? [l.owner] : []);
}

export function isAdmin(leagueId, username = getUsername()) {
  const l = getLeague(leagueId);
  return !!l && !!username && adminsOf(l).includes(username);
}

/**
 * @param {string} name
 * @param {string} metric אחד מ-LEAGUE_METRICS
 * @param {string|null} image data-URL מוקטן
 */
export function createLeague(name, metric = 'xp', image = null) {
  const username = getUsername();
  if (!username) return { ok: false, reason: 'צריך שם משתמש קודם' };
  if (String(name).trim().length < 2) return { ok: false, reason: 'שם הליגה קצר מדי' };

  /* ליגה חדשה נפתחת ריקה. חברים מדומים מראש נתנו תחושה של פעילות
     שלא קיימת — המשתמש צריך לראות שהוא לבד ולהזמין בעצמו. */
  const league = {
    id: makeId(),
    name: String(name).trim(),
    metric,
    code: makeCode(),
    owner: username,
    admins: [username],
    members: [username],
    createdAt: Date.now(),
    ...(image ? { image } : {}),
  };

  const data = read();
  write({ ...data, leagues: [...data.leagues, league] });
  return { ok: true, league };
}

/**
 * הצטרפות בקוד. בדמו כל קוד תקין־מבנית מתקבל ויוצר ליגה מדומה,
 * כי אין שרת שיחזיק ליגות של אחרים.
 */
export function joinByCode(code) {
  const username = getUsername();
  if (!username) return { ok: false, reason: 'צריך שם משתמש קודם' };

  const v = String(code || '').trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(v)) return { ok: false, reason: 'קוד לא תקין — שישה תווים' };

  const data = read();
  if (data.leagues.some((l) => l.code === v)) {
    return { ok: false, reason: 'אתה כבר בליגה הזו' };
  }

  const league = {
    id: makeId(),
    name: 'ליגה משותפת',
    metric: 'xp',
    code: v,
    owner: DEMO_FRIENDS[0].username,
    admins: [DEMO_FRIENDS[0].username],
    members: [DEMO_FRIENDS[0].username, DEMO_FRIENDS[1].username,
              DEMO_FRIENDS[2].username, username],
    createdAt: Date.now(),
    joined: true,
  };

  write({ ...data, leagues: [...data.leagues, league] });
  return { ok: true, league };
}

export function leaveLeague(leagueId) {
  const data = read();
  write({ ...data, leagues: data.leagues.filter((l) => l.id !== leagueId) });
  return { ok: true };
}

/**
 * עדכון פרטי הליגה. רק מנהל, ורק שדות שנשלחו בפועל.
 * image הוא data-URL מוקטן (ראה shrinkImage ב-UI) — localStorage
 * מוגבל לכמה מגה, ותמונה מהמצלמה בגודל מלא תמלא אותו לבדה.
 */
export function updateLeague(leagueId, { name, metric, image } = {}) {
  const data = read();
  const l = data.leagues.find((x) => x.id === leagueId);
  if (!l) return { ok: false, reason: 'אין ליגה' };
  if (!isAdmin(leagueId)) return { ok: false, reason: 'רק מנהל יכול לערוך' };

  if (name !== undefined) {
    const v = String(name).trim();
    if (v.length < 2) return { ok: false, reason: 'שם הליגה קצר מדי' };
    l.name = v;
  }

  if (metric !== undefined) {
    if (!LEAGUE_METRICS.some((m) => m.id === metric)) {
      return { ok: false, reason: 'מדד לא מוכר' };
    }
    l.metric = metric;
  }

  /* null מוחק את התמונה, undefined משאיר אותה כמו שהיא */
  if (image !== undefined) {
    if (image === null) delete l.image;
    else l.image = image;
  }

  write(data);
  return { ok: true, league: l };
}

export function getMembers(leagueId) {
  const l = getLeague(leagueId);
  if (!l) return [];
  const admins = adminsOf(l);
  return l.members.map((username) => ({
    username,
    admin: admins.includes(username),
    owner: username === l.owner,
    me: username === getUsername(),
  }));
}

/**
 * צירוף חבר ישירות לליגה, בלי שהוא ימלא קוד.
 * בדמו אפשר לצרף רק שמות מוכרים, כי אין שרת שיחזיק משתמשים
 * אמיתיים; בגרסת הרשת זו תהיה הזמנה.
 */
export function addMember(leagueId, username) {
  const data = read();
  const l = data.leagues.find((x) => x.id === leagueId);
  const me = getUsername();
  if (!l) return { ok: false, reason: 'אין ליגה' };
  if (!isAdmin(leagueId)) return { ok: false, reason: 'רק מנהל יכול להוסיף' };

  const v = String(username || '').trim();
  if (!v) return { ok: false, reason: 'הזן שם משתמש' };
  if (v === me) return { ok: false, reason: 'זה אתה' };
  if (l.members.includes(v)) return { ok: false, reason: 'כבר בליגה' };
  if (!DEMO_FRIENDS.some((f) => f.username === v)) {
    return { ok: false, reason: 'לא נמצא משתמש בשם הזה' };
  }

  l.members = [...l.members, v];
  write(data);
  return { ok: true };
}

export function removeMember(leagueId, username) {
  const data = read();
  const l = data.leagues.find((x) => x.id === leagueId);
  if (!l) return { ok: false, reason: 'אין ליגה' };
  if (!isAdmin(leagueId)) return { ok: false, reason: 'רק מנהל יכול להסיר' };
  if (username === l.owner) return { ok: false, reason: 'אי אפשר להסיר את היוצר' };

  l.members = l.members.filter((m) => m !== username);
  l.admins = adminsOf(l).filter((m) => m !== username);
  write(data);
  return { ok: true };
}

/** מינוי או הסרה של תואר מנהל */
export function setAdmin(leagueId, username, on) {
  const data = read();
  const l = data.leagues.find((x) => x.id === leagueId);
  if (!l) return { ok: false, reason: 'אין ליגה' };
  if (!isAdmin(leagueId)) return { ok: false, reason: 'רק מנהל יכול למנות' };

  const v = String(username || '').trim();
  if (!l.members.includes(v)) return { ok: false, reason: 'לא חבר בליגה' };
  if (v === l.owner) return { ok: false, reason: 'יוצר הליגה הוא מנהל תמיד' };

  const admins = new Set(adminsOf(l));
  if (on) admins.add(v); else admins.delete(v);
  l.admins = [...admins];

  write(data);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * חברים ובקשות
 * ------------------------------------------------------------------ */

export function getFriends() {
  return read().friends
    .map((n) => DEMO_FRIENDS.find((f) => f.username === n))
    .filter(Boolean);
}

export function getRequests() {
  return seedRequestsOnce(read()).requests;
}

export function getRequestCount() {
  return getRequests().length;
}

/** חיפוש משתמשים להוספה — שם בלבד, בלי סטטיסטיקה (ראה canSeeProfile) */
export function searchUsers(query = '') {
  const q = String(query).trim().toLowerCase();
  if (q.length < 2) return [];
  const data = read();
  return DEMO_FRIENDS
    .filter((f) => f.username.toLowerCase().includes(q))
    .filter((f) => f.username !== data.username)
    .map((f) => ({
      username: f.username,
      friend: data.friends.includes(f.username),
      pending: data.sent.includes(f.username),
    }));
}

export function sendRequest(username) {
  const data = read();
  const v = String(username || '').trim();
  if (!v) return { ok: false, reason: 'הזן שם משתמש' };
  if (v === data.username) return { ok: false, reason: 'זה אתה' };
  if (data.friends.includes(v)) return { ok: false, reason: 'כבר חבר שלך' };
  if (data.sent.includes(v)) return { ok: false, reason: 'כבר נשלחה בקשה' };
  if (!DEMO_FRIENDS.some((f) => f.username === v)) {
    return { ok: false, reason: 'לא נמצא משתמש בשם הזה' };
  }

  write({ ...data, sent: [...data.sent, v] });
  return { ok: true };
}

export function acceptRequest(username) {
  const data = seedRequestsOnce(read());
  const v = String(username || '').trim();
  if (!data.requests.some((r) => r.from === v)) {
    return { ok: false, reason: 'אין בקשה כזו' };
  }

  write({
    ...data,
    requests: data.requests.filter((r) => r.from !== v),
    friends: data.friends.includes(v) ? data.friends : [...data.friends, v],
  });
  return { ok: true };
}

export function rejectRequest(username) {
  const data = seedRequestsOnce(read());
  const v = String(username || '').trim();
  write({ ...data, requests: data.requests.filter((r) => r.from !== v) });
  return { ok: true };
}

export function removeFriend(username) {
  const data = read();
  write({ ...data, friends: data.friends.filter((f) => f !== username) });
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * פרופיל שחקן
 * ------------------------------------------------------------------ */

/**
 * מי מותר לי לראות. בחיפוש רואים שם בלבד — סטטיסטיקה נפתחת רק
 * למי שכבר בקשר איתי: חבר, מי שביקש ממני חברות, או שותף לליגה.
 */
export function canSeeProfile(username) {
  const data = read();
  const v = String(username || '').trim();
  if (!v) return false;
  if (v === data.username) return true;
  if (data.friends.includes(v)) return true;
  if (seedRequestsOnce(data).requests.some((r) => r.from === v)) return true;
  return data.leagues.some((l) => l.members.includes(v));
}

/** מונים מדומים יציבים, באותו מבנה בדיוק של getLifetime */
function demoLifetime(seed) {
  const n = (k, mul) => Math.round(((seed * k) % 97) * mul);
  return {
    reading:   { pages: n(3, 4),    books: n(5, 0.12) },
    fitness:   { reps: n(7, 6),     pushups: n(11, 3), squats: n(13, 3) },
    learning:  { correct: n(17, 5), sets: n(19, 0.6) },
    writing:   { words: n(23, 40),  entries: n(29, 0.8) },
    breathing: { minutes: n(31, 2), sessions: n(37, 0.5) },
    water:     { cups: n(41, 2) },
    steps:     { steps: n(43, 300) },
    sleep:     { hours: n(47, 3) },
  };
}

/**
 * פרופיל של שחקן — שלי מהנתונים האמיתיים, של אחרים מהדמו.
 * מחזיר null למי שאסור לי לראות.
 * @returns {{username, me, level, bestStreak, lifetime}|null}
 */
export function getPlayer(username) {
  const v = String(username || '').trim();
  if (!v || !canSeeProfile(v)) return null;

  if (v === getUsername()) {
    return {
      username: v,
      me: true,
      level: getLevelState().level,
      bestStreak: getStreak().best || 0,
      lifetime: getLifetime(),
    };
  }

  const f = DEMO_FRIENDS.find((x) => x.username === v);
  if (!f) return null;

  return {
    username: v,
    me: false,
    demo: true,
    level: 1 + ((f.seed * 3) % 24),
    bestStreak: (f.seed * 5) % 41,
    lifetime: demoLifetime(f.seed),
  };
}

/* ------------------------------------------------------------------ *
 * טבלה
 * ------------------------------------------------------------------ */

/** הערך השבועי של המשתמש עצמו במדד — אמיתי, לא מדומה */
export function myValue(metric = 'xp', now = Date.now()) {
  const week = getWeekly(now);
  if (metric === 'xp') return week.xp;
  return week.counters?.[metric] || 0;
}

/** טבלה לשבוע נתון, עם ערך משלי שנמסר מבחוץ */
function standingsFor(league, week, myVal) {
  const me = getUsername();
  if (!league || !me) return [];

  return league.members
    .map((username) => {
      const friend = DEMO_FRIENDS.find((f) => f.username === username);
      return {
        username,
        me: username === me,
        value: username === me ? myVal
                               : demoValue(friend || { seed: 5 }, league.metric, week),
      };
    })
    .sort((a, b) => b.value - a.value)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * טבלת הדירוג של ליגה, ממוינת מהגבוה לנמוך.
 * @returns {Array<{rank, username, value, me}>}
 */
export function getStandings(leagueId, now = Date.now()) {
  const l = getLeague(leagueId);
  if (!l) return [];
  return standingsFor(l, getWeekly(now).week || '', myValue(l.metric, now));
}

/** המקום שלי בליגה — לרשימת הליגות */
export function myRank(leagueId, now = Date.now()) {
  const rows = getStandings(leagueId, now);
  const me = rows.find((r) => r.me);
  return me ? { rank: me.rank, total: rows.length, value: me.value } : null;
}

/** הנקודות השבועיות של חבר — גם בלי ליגה משותפת */
export function friendWeeklyXp(username, now = Date.now()) {
  const friend = DEMO_FRIENDS.find((f) => f.username === username);
  if (!friend) return 0;
  return demoValue(friend, 'xp', getWeekly(now).week || '');
}

/* ------------------------------------------------------------------ *
 * סיום שבוע
 * ------------------------------------------------------------------ */

/**
 * מתי נגמר השבוע הנוכחי. אותו חישוב יום־עוגן כמו weekKey ב-store,
 * בזמן מקומי, כדי שהטיימר במסך והגלגול יסכימו ביניהם.
 */
export function weekEndsAt(now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  d.setHours(0, 0, 0, 0);
  return d.getTime() + 7 * 86_400_000;
}

/**
 * סוגר את השבוע אוטומטית כשהוא מתחלף, בכל הליגות. אין כפתור ידני —
 * בשרת אמיתי זה יקרה בצד השרת, וכאן זה נבדק בכל פתיחת אפליקציה.
 *
 * הערך השבועי שלי נקרא מהרשומה הגולמית, שעדיין מחזיקה את השבוע
 * הקודם עד שמשהו יכתוב עליה — ולכן חייבים לקרוא לזה לפני שמזכים
 * דקות ביום החדש.
 *
 * @returns {object|null} התוצאה אם נסגר שבוע, אחרת null
 */
export function settleWeek(now = Date.now()) {
  const data = read();
  if (!data.leagues.length) return null;

  const cur = getWeekly(now).week;

  /* פעם ראשונה — רק מסמנים באיזה שבוע אנחנו */
  if (!data.lastWeek) { write({ ...data, lastWeek: cur }); return null; }
  if (data.lastWeek === cur) return null;

  const raw = readRaw('weekly') || {};
  const mineFor = (metric) => (raw.week === data.lastWeek
    ? (metric === 'xp' ? (raw.xp || 0) : (raw.counters?.[metric] || 0))
    : 0);

  let wins = 0;
  const leagues = data.leagues.map((l) => {
    const standings = standingsFor(l, data.lastWeek, mineFor(l.metric));
    const winner = standings[0];
    const mine = standings.find((r) => r.me);
    if (winner?.me) wins++;
    return {
      leagueId: l.id,
      name: l.name,
      image: l.image || null,
      standings,
      winner: winner?.username || null,
      myRank: mine?.rank || null,
      total: standings.length,
      iWon: !!winner?.me,
    };
  });

  if (wins) awardXp(XP.leagueWin * wins, now);

  const result = {
    week: data.lastWeek,
    at: now,
    leagues,
    wins,
    prize: XP.leagueWin * wins,
  };

  write({ ...data, lastWeek: cur, lastResult: result, pendingResult: result });
  return result;
}

/** תוצאה שעוד לא הוצגה למשתמש */
export function getPendingResult() {
  return read().pendingResult || null;
}

export function clearPendingResult() {
  const data = read();
  delete data.pendingResult;
  write(data);
}

export function getLastResult() {
  return read().lastResult || null;
}
