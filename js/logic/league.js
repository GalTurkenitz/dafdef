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
import { getXp, getWeekly, awardXp } from './store.js';

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
export function createLeague(name, metric = 'xp') {
  const username = getUsername();
  if (!username) return { ok: false, reason: 'צריך שם משתמש קודם' };
  if (String(name).trim().length < 2) return { ok: false, reason: 'שם הליגה קצר מדי' };

  const league = {
    name: String(name).trim(),
    metric,
    code: makeCode(),
    owner: username,
    members: [username, ...DEMO_FRIENDS.slice(0, 4).map((f) => f.username)],
    createdAt: Date.now(),
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

export function leaveLeague() {
  const data = read();
  delete data.league;
  write(data);
  return { ok: true };
}

export function removeMember(username) {
  const data = read();
  if (!data.league) return { ok: false, reason: 'אין ליגה' };
  if (data.league.owner !== getUsername()) return { ok: false, reason: 'רק יוצר הליגה יכול' };
  if (username === data.league.owner) return { ok: false, reason: 'אי אפשר להסיר את היוצר' };

  data.league.members = data.league.members.filter((m) => m !== username);
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
 * סיום שבוע
 * ------------------------------------------------------------------ */

/**
 * נועל את השבוע, מזכה את המנצח ומחזיר סיכום.
 * בשרת אמיתי זה יקרה בצד השרת ביום קבוע; כאן זה נקרא ידנית
 * מכפתור הבדיקה.
 */
export function closeWeek(now = Date.now()) {
  const standings = getStandings(now);
  if (!standings.length) return { ok: false, reason: 'אין ליגה' };

  const winner = standings[0];
  if (winner.me) awardXp(XP.leagueWin, now);

  const data = read();
  write({ ...data, lastResult: { at: now, standings, winner: winner.username } });

  return { ok: true, standings, winner: winner.username, iWon: winner.me,
           prize: XP.leagueWin };
}

export function getLastResult() {
  return read().lastResult || null;
}
