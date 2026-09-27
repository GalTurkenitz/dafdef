/**
 * league.js — שכבת הנתונים של הליגה (V4, סעיף 2.2).
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  זו שכבת הגישה היחידה לנתוני הליגה.                          │
 * │                                                              │
 * │  ליגה אמיתית דורשת שרת וחשבונות — שמות משתמש, חברים, קודים   │
 * │  וטבלה משותפת — וזה נדחה לאחרי סבב השיווק. לכן היום הכל      │
 * │  רץ מקומית על localStorage, עם חברים מדומים.                 │
 * │                                                              │
 * │  **ה-UI לא נוגע ב-localStorage ולא בנתוני הדמו בשום מקום.**  │
 * │  כשתגיע שכבת רשת, מחליפים את גוף הפונקציות כאן בלבד —        │
 * │  החתימות נשארות, ו-league.html לא משתנה.                     │
 * └──────────────────────────────────────────────────────────────┘
 */

import { STORE_PREFIX, LEAGUE_METRICS, XP } from '../config.js';
import { getXp, getWeekly, awardXp, read as readRaw,
         getLevelState, getStreak, getLifetime } from './store.js';

const KEY = STORE_PREFIX + 'league';

/* ------------------------------------------------------------------ *
 * אחסון
 * ------------------------------------------------------------------ */

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

function write(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* חסום */ }
  return next;
}

/* ------------------------------------------------------------------ *
 * חברים מדומים
 *
 * מסומנים ב-demo:true כדי שיהיה אפשר לזהות ולמחוק אותם ביום
 * שבו מגיעה שכבת רשת אמיתית.
 * ------------------------------------------------------------------ */

const DEMO_FRIENDS = [
  { id: 'd1', username: 'noam_l',    demo: true, seed: 37 },
  { id: 'd2', username: 'shira.k',   demo: true, seed: 71 },
  { id: 'd3', username: 'yuval99',   demo: true, seed: 13 },
  { id: 'd4', username: 'tamar_b',   demo: true, seed: 54 },
  { id: 'd5', username: 'idan.rz',   demo: true, seed: 92 },
  { id: 'd6', username: 'maya_g',    demo: true, seed: 26 },
];

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
 * ליגה
 * ------------------------------------------------------------------ */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // בלי 0/O/1/I

function makeCode() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * תפקידים
 *
 * היוצר הוא מנהל תמיד ואי אפשר להוריד אותו. מנהל יכול לערוך את
 * הליגה, לצרף ולהסיר חברים, ולמנות מנהלים נוספים. מי שאינו מנהל
 * יכול רק לעזוב.
 * ------------------------------------------------------------------ */

/** ליגות שנוצרו לפני שהיו תפקידים — היוצר הוא המנהל */
function adminsOf(l) {
  return l?.admins?.length ? l.admins : (l ? [l.owner] : []);
}

export function isAdmin(username = getUsername()) {
  const l = getMyLeague();
  return !!l && !!username && adminsOf(l).includes(username);
}

export function isOwner(username = getUsername()) {
  const l = getMyLeague();
  return !!l && l.owner === username;
}

/** מינוי או הסרה של תואר מנהל */
export function setAdmin(username, on) {
  const data = read();
  if (!data.league) return { ok: false, reason: 'אין ליגה' };
  if (!isAdmin()) return { ok: false, reason: 'רק מנהל יכול למנות' };

  const v = String(username || '').trim();
  if (!data.league.members.includes(v)) return { ok: false, reason: 'לא חבר בליגה' };
  if (v === data.league.owner) return { ok: false, reason: 'יוצר הליגה הוא מנהל תמיד' };

  const admins = new Set(adminsOf(data.league));
  if (on) admins.add(v); else admins.delete(v);
  data.league.admins = [...admins];

  write(data);
  return { ok: true };
}

export function getMembers() {
  const l = getMyLeague();
  if (!l) return [];
  const admins = adminsOf(l);
  return l.members.map((username) => ({
    username,
    admin: admins.includes(username),
    owner: username === l.owner,
    me: username === getUsername(),
  }));
}

export function getMyLeague() {
  return read().league || null;
}

export function metricLabel(id) {
  return (LEAGUE_METRICS.find((m) => m.id === id) || LEAGUE_METRICS[0]).label;
}

/**
 * @param {string} name
 * @param {string} metric אחד מ-LEAGUE_METRICS
 */
export function createLeague(name, metric = 'xp', image = null) {
  const username = getUsername();
  if (!username) return { ok: false, reason: 'צריך שם משתמש קודם' };
  if (String(name).trim().length < 2) return { ok: false, reason: 'שם הליגה קצר מדי' };

  /* ליגה חדשה נפתחת ריקה. חברים מדומים מראש נתנו תחושה של פעילות
     שלא קיימת — המשתמש צריך לראות שהוא לבד ולהזמין בעצמו. */
  const league = {
    name: String(name).trim(),
    metric,
    code: makeCode(),
    owner: username,
    admins: [username],
    members: [username],
    createdAt: Date.now(),
    ...(image ? { image } : {}),
  };

  write({ ...read(), league });
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

  const league = {
    name: 'ליגה משותפת',
    metric: 'xp',
    code: v,
    owner: DEMO_FRIENDS[0].username,
    members: [DEMO_FRIENDS[0].username, DEMO_FRIENDS[1].username,
              DEMO_FRIENDS[2].username, username],
    createdAt: Date.now(),
    joined: true,
  };

  write({ ...read(), league });
  return { ok: true, league };
}

/**
 * עדכון פרטי הליגה. רק היוצר, ורק שדות שנשלחו בפועל.
 * image הוא data-URL מוקטן (ראה shrinkImage ב-UI) — localStorage
 * מוגבל לכמה מגה, ותמונה מהמצלמה בגודל מלא תמלא אותו לבדה.
 */
export function updateLeague({ name, metric, image } = {}) {
  const data = read();
  if (!data.league) return { ok: false, reason: 'אין ליגה' };
  if (!isAdmin()) return { ok: false, reason: 'רק מנהל יכול לערוך' };

  if (name !== undefined) {
    const v = String(name).trim();
    if (v.length < 2) return { ok: false, reason: 'שם הליגה קצר מדי' };
    data.league.name = v;
  }

  if (metric !== undefined) {
    if (!LEAGUE_METRICS.some((m) => m.id === metric)) {
      return { ok: false, reason: 'מדד לא מוכר' };
    }
    data.league.metric = metric;
  }

  /* null מוחק את התמונה, undefined משאיר אותה כמו שהיא */
  if (image !== undefined) {
    if (image === null) delete data.league.image;
    else data.league.image = image;
  }

  write(data);
  return { ok: true, league: data.league };
}

export function leaveLeague() {
  const data = read();
  delete data.league;
  write(data);
  return { ok: true };
}

/**
 * צירוף חבר ישירות לליגה, בלי שהוא ימלא קוד.
 * בדמו אפשר לצרף רק שמות מתוך DEMO_FRIENDS, כי אין שרת שיחזיק
 * משתמשים אמיתיים; בגרסת הרשת זו תהיה חיפוש־והזמנה.
 */
export function addMember(username) {
  const data = read();
  const me = getUsername();
  if (!data.league) return { ok: false, reason: 'אין ליגה' };
  if (!isAdmin()) return { ok: false, reason: 'רק מנהל יכול להוסיף' };

  const v = String(username || '').trim();
  if (!v) return { ok: false, reason: 'הזן שם משתמש' };
  if (v === me) return { ok: false, reason: 'זה אתה' };
  if (data.league.members.includes(v)) return { ok: false, reason: 'כבר בליגה' };
  if (!DEMO_FRIENDS.some((f) => f.username === v)) {
    return { ok: false, reason: 'לא נמצא משתמש בשם הזה' };
  }

  data.league.members = [...data.league.members, v];
  write(data);
  return { ok: true };
}

export function removeMember(username) {
  const data = read();
  if (!data.league) return { ok: false, reason: 'אין ליגה' };
  if (!isAdmin()) return { ok: false, reason: 'רק מנהל יכול להסיר' };
  if (username === data.league.owner) return { ok: false, reason: 'אי אפשר להסיר את היוצר' };

  data.league.members = data.league.members.filter((m) => m !== username);
  data.league.admins = adminsOf(data.league).filter((m) => m !== username);
  write(data);
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * חברים
 * ------------------------------------------------------------------ */

export function getFriends() {
  const names = read().friends || [];
  return names
    .map((n) => DEMO_FRIENDS.find((f) => f.username === n))
    .filter(Boolean);
}

export function addFriend(username) {
  const v = String(username || '').trim();
  if (!v) return { ok: false, reason: 'הזן שם משתמש' };
  if (v === getUsername()) return { ok: false, reason: 'זה אתה' };

  const found = DEMO_FRIENDS.find((f) => f.username === v);
  if (!found) return { ok: false, reason: 'לא נמצא משתמש בשם הזה' };

  const data = read();
  const friends = new Set(data.friends || []);
  if (friends.has(v)) return { ok: false, reason: 'כבר ברשימה' };

  friends.add(v);
  write({ ...data, friends: [...friends] });
  return { ok: true };
}

export function removeFriend(username) {
  const data = read();
  write({ ...data, friends: (data.friends || []).filter((f) => f !== username) });
  return { ok: true };
}

/** שמות שאפשר להוסיף — בדמו זו הרשימה הקבועה */
export function searchableUsernames() {
  return DEMO_FRIENDS.map((f) => f.username);
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

/**
 * טבלת הדירוג, ממוינת מהגבוה לנמוך.
 * @returns {Array<{rank, username, value, me}>}
 */
export function getStandings(now = Date.now()) {
  const league = getMyLeague();
  const me = getUsername();
  if (!league || !me) return [];

  const week = getWeekly(now).week || '';

  return league.members
    .map((username) => {
      const friend = DEMO_FRIENDS.find((f) => f.username === username);
      return {
        username,
        me: username === me,
        value: username === me ? myValue(league.metric, now)
                               : demoValue(friend || { seed: 5 }, league.metric, week),
      };
    })
    .sort((a, b) => b.value - a.value)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** הנקודות השבועיות של חבר — גם בלי ליגה משותפת (סעיף 2.3) */
export function friendWeeklyXp(username, now = Date.now()) {
  const friend = DEMO_FRIENDS.find((f) => f.username === username);
  if (!friend) return 0;
  return demoValue(friend, 'xp', getWeekly(now).week || '');
}

/* ------------------------------------------------------------------ *
 * פרופיל שחקן
 * ------------------------------------------------------------------ */

/** מונים מדומים יציבים, באותו מבנה בדיוק של getLifetime */
function demoLifetime(seed) {
  const n = (k, mul) => Math.round(((seed * k) % 97) * mul);
  return {
    reading:   { pages: n(3, 4),   books: n(5, 0.12) },
    fitness:   { reps: n(7, 6),    pushups: n(11, 3), squats: n(13, 3) },
    learning:  { correct: n(17, 5), sets: n(19, 0.6) },
    writing:   { words: n(23, 40), entries: n(29, 0.8) },
    breathing: { minutes: n(31, 2), sessions: n(37, 0.5) },
    water:     { cups: n(41, 2) },
    steps:     { steps: n(43, 300) },
    sleep:     { hours: n(47, 3) },
  };
}

/**
 * פרופיל של שחקן — שלי מהנתונים האמיתיים, של אחרים מהדמו.
 * @returns {{username, me, level, bestStreak, lifetime}|null}
 */
export function getPlayer(username) {
  const v = String(username || '').trim();
  if (!v) return null;

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

/** טבלה לשבוע נתון, עם ערך משלי שנמסר מבחוץ (לשבוע שכבר נסגר) */
function standingsFor(week, myVal) {
  const l = getMyLeague();
  const me = getUsername();
  if (!l || !me) return [];

  return l.members
    .map((username) => {
      const friend = DEMO_FRIENDS.find((f) => f.username === username);
      return {
        username,
        me: username === me,
        value: username === me ? myVal
                               : demoValue(friend || { seed: 5 }, l.metric, week),
      };
    })
    .sort((a, b) => b.value - a.value)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * סוגר את השבוע אוטומטית כשהוא מתחלף. אין כפתור ידני — בשרת
 * אמיתי זה יקרה בצד השרת, וכאן זה נבדק בכל פתיחת אפליקציה.
 *
 * הערך השבועי שלי נקרא מהרשומה הגולמית, שעדיין מחזיקה את השבוע
 * הקודם עד שמשהו יכתוב עליה — ולכן חייבים לקרוא לזה לפני שמזכים
 * דקות ביום החדש.
 *
 * @returns {object|null} התוצאה אם נסגר שבוע, אחרת null
 */
export function settleWeek(now = Date.now()) {
  const data = read();
  if (!data.league) return null;

  const cur = getWeekly(now).week;

  /* פעם ראשונה — רק מסמנים באיזה שבוע אנחנו */
  if (!data.lastWeek) { write({ ...data, lastWeek: cur }); return null; }
  if (data.lastWeek === cur) return null;

  const raw = readRaw('weekly') || {};
  const mine = raw.week === data.lastWeek
    ? (data.league.metric === 'xp' ? (raw.xp || 0)
                                   : (raw.counters?.[data.league.metric] || 0))
    : 0;

  const standings = standingsFor(data.lastWeek, mine);
  const winner = standings[0];
  const my = standings.find((r) => r.me);

  if (winner?.me) awardXp(XP.leagueWin, now);

  const result = {
    week: data.lastWeek,
    at: now,
    standings,
    winner: winner?.username || null,
    myRank: my?.rank || null,
    total: standings.length,
    iWon: !!winner?.me,
    prize: XP.leagueWin,
    league: data.league.name,
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
