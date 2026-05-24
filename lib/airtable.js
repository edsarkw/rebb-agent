const Airtable = require('airtable');
const { config } = require('./config');

let _base = null;
function base() {
  if (_base) return _base;
  if (!config.airtable.pat) throw new Error('AIRTABLE_PAT not configured');
  Airtable.configure({ apiKey: config.airtable.pat });
  _base = Airtable.base(config.airtable.baseId);
  return _base;
}

const TABLES = {
  contacts: 'Contacts',
  opportunities: 'Opportunities',
  tasks: 'Tasks',
};

function todayIsoCT() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

async function fetchAll(table, opts = {}) {
  const out = [];
  await base()(table).select(opts).eachPage((records, fetchNextPage) => {
    for (const r of records) out.push({ id: r.id, fields: r.fields });
    fetchNextPage();
  });
  return out;
}

async function getContactsOverdue() {
  const today = todayIsoCT();
  const formula = `AND({Next Follow-Up Date}, IS_BEFORE({Next Follow-Up Date}, DATEADD('${today}', 1, 'day')))`;
  return fetchAll(TABLES.contacts, { filterByFormula: formula, pageSize: 100 });
}

async function getOppsNeedingAction() {
  const today = todayIsoCT();
  const formula = `AND({Next Action Due}, IS_BEFORE({Next Action Due}, DATEADD('${today}', 1, 'day')))`;
  return fetchAll(TABLES.opportunities, { filterByFormula: formula, pageSize: 100 });
}

const STATUS = {
  draft: 'Draft Ready for Review',
  sent: 'Done',
  failed: 'Failed',
};

async function createTask(fields) {
  const records = await base()(TABLES.tasks).create([{ fields }], { typecast: true });
  return { id: records[0].id, fields: records[0].fields };
}

async function getTask(id) {
  const rec = await base()(TABLES.tasks).find(id);
  return { id: rec.id, fields: rec.fields };
}

async function updateTask(id, fields) {
  const rec = await base()(TABLES.tasks).update(id, fields, { typecast: true });
  return { id: rec.id, fields: rec.fields };
}

async function atomicFlipDraftToSent(id, expectedJti) {
  const task = await getTask(id);
  if (task.fields['Token JTI'] !== expectedJti) {
    return { ok: false, reason: 'jti_mismatch', task };
  }
  const status = task.fields['Status'];
  if (status === STATUS.sent) return { ok: false, reason: 'already_sent', task };
  if (status === STATUS.failed) return { ok: false, reason: 'already_failed', task };
  if (status !== STATUS.draft) return { ok: false, reason: `bad_status_${status}`, task };

  const updated = await updateTask(id, {
    Status: STATUS.sent,
    'Sent At': new Date().toISOString(),
  });
  return { ok: true, task: updated };
}

async function markFailed(id, errorMessage) {
  const trimmed = String(errorMessage || '').slice(0, 1000);
  return updateTask(id, {
    Status: STATUS.failed,
    Notes: trimmed,
  });
}

async function ping() {
  await base()(TABLES.tasks).select({ maxRecords: 1, pageSize: 1 }).firstPage();
  return true;
}

module.exports = {
  TABLES,
  STATUS,
  base,
  todayIsoCT,
  getContactsOverdue,
  getOppsNeedingAction,
  createTask,
  getTask,
  updateTask,
  atomicFlipDraftToSent,
  markFailed,
  ping,
};
