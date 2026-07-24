import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { google } from 'googleapis';
import {
  loadCredentials,
  getThisWeeksMeetings,
  filterMeetingsWithoutRooms,
  findAvailableRoom,
  addRoomToMeeting
} from './calendar.js';
import {
  ensureConfigDir,
  getCredentialsPath,
  getTokenPath
} from './config.js';
import { isAtOffice } from './presence.js';

function getStatePath() {
  return path.join(ensureConfigDir(), 'auto-state.json');
}

// Local calendar day as YYYY-MM-DD (booking is a per-local-day decision).
function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(getStatePath(), 'utf-8'));
  } catch {
    return { date: null, bookedEventIds: [] };
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
  } catch {
    // A daemon shouldn't crash on a state-write failure; worst case we
    // re-evaluate already-booked meetings, which addRoomToMeeting no-ops.
  }
}

// State resets at the start of each local day so a new day books fresh.
function stateForToday() {
  const state = loadState();
  const key = todayKey();
  if (state.date !== key) {
    return { date: key, bookedEventIds: [] };
  }
  return state;
}

// Summary of the most recent booking activity, for `office status`.
export function getAutoBookState() {
  const state = loadState();
  return { date: state.date, bookedCount: (state.bookedEventIds || []).length };
}

function isToday(meeting) {
  const start = meeting.start?.dateTime || meeting.start?.date;
  if (!start) return false;
  return todayKey(new Date(start)) === todayKey();
}

/**
 * macOS notification via osascript. Best-effort — never throws.
 *
 * Delivered through Script Editor, which is the notification channel that
 * actually works on current macOS (terminal-notifier's underlying API was
 * removed and silently no-ops). Set Script Editor's style to "Alerts" in
 * System Settings → Notifications to make these persist until dismissed.
 *
 * @param {{title?: string, subtitle?: string, message: string}} opts
 */
export function notify(opts) {
  if (process.platform !== 'darwin') return;
  const { title = 'mtg', subtitle, message } = opts;
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  let script = `display notification "${esc(message)}" with title "${esc(title)}"`;
  if (subtitle) script += ` subtitle "${esc(subtitle)}"`;
  execFile('osascript', ['-e', script], () => {});
}

// Headless auth: use the stored token only, never open a browser.
async function authorizeHeadless() {
  if (!fs.existsSync(getCredentialsPath())) {
    throw new Error('NOT_SET_UP');
  }
  if (!fs.existsSync(getTokenPath())) {
    throw new Error('NOT_AUTHORIZED');
  }

  const oauth = loadCredentials();
  const token = JSON.parse(fs.readFileSync(getTokenPath(), 'utf-8'));
  if (!token.refresh_token) {
    throw new Error('NOT_AUTHORIZED');
  }
  oauth.setCredentials(token);
  await oauth.getAccessToken(); // throws if the refresh token is dead
  return oauth;
}

/**
 * Core daemon tick. Checks presence, and if at the office, silently books the
 * best available room for each of today's room-less meetings (once each).
 *
 * @returns {Promise<{status: string, booked: Array, unavailable: Array}>}
 */
export async function autoBook({ force = false } = {}) {
  if (!force && !isAtOffice()) {
    return { status: 'not-at-office', booked: [], unavailable: [] };
  }

  let auth;
  try {
    auth = await authorizeHeadless();
  } catch (error) {
    return { status: `auth-error:${error.message}`, booked: [], unavailable: [] };
  }

  const calendar = google.calendar({ version: 'v3', auth });

  const meetings = await getThisWeeksMeetings(calendar);
  const todaysRoomless = filterMeetingsWithoutRooms(meetings).filter(isToday);

  const state = stateForToday();
  const alreadyBooked = new Set(state.bookedEventIds);

  const booked = [];
  const unavailable = [];

  for (const meeting of todaysRoomless) {
    if (alreadyBooked.has(meeting.id)) continue;

    let room;
    try {
      room = await findAvailableRoom(calendar, meeting);
    } catch {
      room = null;
    }

    if (!room) {
      unavailable.push(meeting.summary || '(untitled)');
      continue;
    }

    try {
      await addRoomToMeeting(calendar, meeting.id, room.email);
      alreadyBooked.add(meeting.id);
      booked.push({ summary: meeting.summary || '(untitled)', room: room.name });
    } catch {
      unavailable.push(meeting.summary || '(untitled)');
    }
  }

  state.bookedEventIds = [...alreadyBooked];
  saveState(state);

  if (booked.length > 0) {
    if (booked.length === 1) {
      notify({
        title: 'mtg',
        subtitle: 'Room booked for today',
        message: `${booked[0].room} → ${booked[0].summary}`
      });
    } else {
      notify({
        title: 'mtg',
        subtitle: `Booked ${booked.length} rooms for today`,
        message: booked.map(b => `${b.room} → ${b.summary}`).join(', ')
      });
    }
  }

  return { status: 'ok', booked, unavailable };
}
