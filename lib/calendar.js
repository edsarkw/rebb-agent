const { google, oauth2Client } = require('./google');

function calClient() {
  return google.calendar({ version: 'v3', auth: oauth2Client() });
}

function dayBoundsCT(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const ymd = fmt.format(date);
  const start = new Date(`${ymd}T00:00:00-06:00`);
  const end = new Date(`${ymd}T23:59:59-06:00`);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

async function listTodayEvents() {
  const cal = calClient();
  const { timeMin, timeMax } = dayBoundsCT();
  const resp = await cal.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });
  return (resp.data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    location: e.location || '',
    description: e.description || '',
    attendees: (e.attendees || []).map((a) => ({ email: a.email, name: a.displayName, organizer: !!a.organizer })),
    htmlLink: e.htmlLink,
  }));
}

async function createEvent({ summary, description, start, end, attendees = [], location }) {
  const cal = calClient();
  const resp = await cal.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      description,
      location,
      start: { dateTime: start, timeZone: 'America/Chicago' },
      end: { dateTime: end, timeZone: 'America/Chicago' },
      attendees: attendees.map((email) => ({ email })),
    },
    sendUpdates: 'all',
  });
  return { id: resp.data.id, htmlLink: resp.data.htmlLink };
}

async function ping() {
  const cal = calClient();
  const resp = await cal.calendarList.list({ maxResults: 1 });
  return { count: (resp.data.items || []).length };
}

module.exports = { listTodayEvents, createEvent, ping };
