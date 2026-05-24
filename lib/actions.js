const gmail = require('./gmail');
const calendar = require('./calendar');
const airtable = require('./airtable');

async function executeAction(task) {
  const type = task.fields['Task Type'];
  const payloadRaw = task.fields['Action Payload'];
  if (!payloadRaw) throw new Error('Task has no Action Payload');

  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (e) {
    throw new Error(`Action Payload is not valid JSON: ${e.message}`);
  }

  switch (type) {
    case 'Email Reply': {
      const result = await gmail.sendReply(payload);
      return { kind: 'email', ...result };
    }
    case 'Calendar Event': {
      const result = await calendar.createEvent(payload);
      return { kind: 'calendar', ...result };
    }
    case 'Airtable Update': {
      const { table, recordId, fields } = payload;
      const rec = await airtable.base()(table).update(recordId, fields);
      return { kind: 'airtable', id: rec.id };
    }
    case 'Meeting Prep': {
      return { kind: 'noop', note: 'Meeting Prep tasks are informational only' };
    }
    default:
      throw new Error(`Unknown Task Type: ${type}`);
  }
}

module.exports = { executeAction };
