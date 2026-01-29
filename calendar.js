import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { getCredentialsPath, getTokenPath, loadConfig } from './config.js';

let oauth2Client;

// Load credentials from file
export function loadCredentials() {
  const credentialsPath = getCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    console.log(chalk.red.bold('\n❌ Error: credentials.json not found!\n'));
    console.log(chalk.yellow('Please run: ') + chalk.cyan('mtg setup'));
    console.log(chalk.gray('\nOr manually place your credentials.json file at:'));
    console.log(chalk.gray(credentialsPath + '\n'));
    process.exit(1);
  }

  const content = fs.readFileSync(credentialsPath);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  return oauth2Client;
}

// Get saved token or authenticate
export async function authorize() {
  const tokenPath = getTokenPath();

  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath));
    oauth2Client.setCredentials(token);
    return oauth2Client;
  }

  return getNewToken();
}

// Get new token through OAuth flow
function getNewToken() {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar']
    });

    console.log(chalk.cyan.bold('\n🔐 Authorization Required\n'));
    console.log(chalk.yellow('Please visit this URL to authorize:\n'));
    console.log(chalk.blue.underline(authUrl));
    console.log('');

    const spinner = ora({
      text: chalk.gray('Waiting for authentication...'),
      spinner: 'dots'
    }).start();

    const server = http.createServer(async (req, res) => {
      if (req.url.indexOf('/oauth2callback') > -1) {
        const qs = new URL(req.url, 'http://localhost:3000').searchParams;
        const code = qs.get('code');

        res.end('Authentication successful! You can close this window and return to the terminal.');
        server.close();

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(getTokenPath(), JSON.stringify(tokens));

        spinner.succeed(chalk.green('Authentication successful!'));
        console.log('');
        resolve(oauth2Client);
      }
    });

    server.listen(3000);
  });
}

// Get date range from now until end of next week
function getWeekDateRange() {
  const now = new Date();

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfNextWeek = new Date(startOfWeek);
  endOfNextWeek.setDate(startOfWeek.getDate() + 13);
  endOfNextWeek.setHours(23, 59, 59, 999);

  return {
    timeMin: now.toISOString(),
    timeMax: endOfNextWeek.toISOString()
  };
}

// Get meetings for this week and next week
export async function getThisWeeksMeetings(calendar) {
  const { timeMin, timeMax } = getWeekDateRange();

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime'
  });

  return response.data.items || [];
}

// Filter meetings without rooms
export function filterMeetingsWithoutRooms(meetings) {
  const config = loadConfig();
  const REMOTE_WORKERS = config.remoteWorkers || [];

  return meetings.filter(meeting => {
    if (!meeting.start || (!meeting.start.dateTime && !meeting.start.date)) return false;
    if (!meeting.end || (!meeting.end.dateTime && !meeting.end.date)) return false;
    if (!meeting.attendees) return false;

    const nonResourceAttendees = meeting.attendees.filter(attendee => !attendee.resource);
    if (nonResourceAttendees.length <= 1) return false;

    const hasRoom = meeting.attendees.some(attendee =>
      attendee.resource === true ||
      (attendee.email && attendee.email.includes('@resource.calendar.google.com'))
    );

    if (hasRoom) return false;

    // Check if meeting is only with remote workers
    const otherAttendees = nonResourceAttendees.filter(attendee => {
      if (attendee.self || attendee.organizer) return false;
      return true;
    });

    if (otherAttendees.length > 0) {
      const allRemote = otherAttendees.every(attendee => {
        const name = (attendee.displayName || attendee.email || '').toLowerCase();
        return REMOTE_WORKERS.some(remoteName => name.includes(remoteName));
      });

      if (allRemote) return false;
    }

    return true;
  });
}

// Check room availability
async function checkRoomAvailability(calendar, roomEmails, timeMin, timeMax) {
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: roomEmails.map(email => ({ id: email }))
    }
  });

  return response.data.calendars;
}

// Get attendee count
export function getAttendeeCount(meeting) {
  if (!meeting.attendees) return 1;
  return meeting.attendees.filter(attendee => !attendee.resource).length;
}

// Find available room
export async function findAvailableRoom(calendar, meeting) {
  const config = loadConfig();
  const ROOMS = config.rooms || [];

  const attendeeCount = getAttendeeCount(meeting);
  const timeMin = meeting.start.dateTime || meeting.start.date;
  const timeMax = meeting.end.dateTime || meeting.end.date;

  let startTime = timeMin;
  let endTime = timeMax;

  if (meeting.start.date && !meeting.start.dateTime) {
    const startDate = new Date(meeting.start.date);
    const endDate = new Date(meeting.end.date);
    startTime = startDate.toISOString();
    endTime = endDate.toISOString();
  }

  const roomEmails = ROOMS.map(room => room.email);
  const availability = await checkRoomAvailability(calendar, roomEmails, startTime, endTime);

  const availableRooms = ROOMS.filter(room => {
    const roomAvailability = availability[room.email];
    if (!roomAvailability) return false;

    const isAvailable = !roomAvailability.busy || roomAvailability.busy.length === 0;
    const hasCapacity = room.capacity >= attendeeCount;

    return isAvailable && hasCapacity;
  });

  if (availableRooms.length === 0) {
    const anyAvailable = ROOMS.filter(room => {
      const roomAvailability = availability[room.email];
      if (!roomAvailability) return false;
      return !roomAvailability.busy || roomAvailability.busy.length === 0;
    });

    if (anyAvailable.length === 0) {
      return null;
    }

    return anyAvailable.sort((a, b) => a.capacity - b.capacity)[0];
  }

  return availableRooms.sort((a, b) => a.capacity - b.capacity)[0];
}

// Add room to meeting
export async function addRoomToMeeting(calendar, eventId, roomEmail) {
  const event = await calendar.events.get({
    calendarId: 'primary',
    eventId
  });

  if (!event.data.attendees) {
    event.data.attendees = [];
  }

  const alreadyAdded = event.data.attendees.some(a => a.email === roomEmail);
  if (alreadyAdded) {
    throw new Error('Room already added to this meeting');
  }

  event.data.attendees.push({
    email: roomEmail,
    resource: true,
    responseStatus: 'accepted'
  });

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId,
    requestBody: event.data,
    sendUpdates: 'none'
  });

  const updatedAttendees = response.data.attendees || [];
  const roomAdded = updatedAttendees.some(a => a.email === roomEmail);

  if (!roomAdded) {
    throw new Error('Room was not added - update may have failed');
  }

  return response.data;
}

// Format date/time
export function formatDateTime(dateTimeString) {
  if (!dateTimeString) return 'Time not specified';
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) return 'Invalid date';

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === today.toDateString()) {
    return chalk.green('Today') + ' at ' + chalk.bold(timeStr);
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return chalk.yellow('Tomorrow') + ' at ' + chalk.bold(timeStr);
  }

  return dateStr + ' at ' + chalk.bold(timeStr);
}
