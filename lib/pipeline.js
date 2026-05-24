const crypto = require('node:crypto');
const { config, assertBriefConfig } = require('./config');
const airtable = require('./airtable');
const gmail = require('./gmail');
const calendar = require('./calendar');
const slack = require('./slack');
const claude = require('./claude');
const tokens = require('./tokens');
const { BriefSchema, extractJSON } = require('./schema');
const { composeBriefBlocks } = require('./blocks');

const TOKEN_TTL_SECONDS = 48 * 3600;

async function gatherInputs() {
  const results = await Promise.allSettled([
    gmail.listImportantUnansweredThreads(),
    airtable.getContactsOverdue(),
    airtable.getOppsNeedingAction(),
    calendar.listTodayEvents(),
  ]);
  const [gmailRes, contactsRes, oppsRes, calRes] = results;
  const errors = [];
  const pick = (r, label) => {
    if (r.status === 'fulfilled') return r.value;
    errors.push({ source: label, message: r.reason?.message || String(r.reason) });
    return [];
  };
  return {
    inputs: {
      gmail: pick(gmailRes, 'gmail'),
      contacts: pick(contactsRes, 'contacts'),
      opportunities: pick(oppsRes, 'opportunities'),
      calendar: pick(calRes, 'calendar'),
    },
    errors,
  };
}

function reviewUrlFor(taskId) {
  return `https://airtable.com/${config.airtable.baseId}/Tasks/${taskId}`;
}

const TASK_TYPE_MAP = {
  'Email Reply': 'Email Reply (Draft Ready)',
  'Airtable Update': 'Airtable Update',
  'Calendar Event': 'Calendar Event',
  'Meeting Prep': 'Meeting Prep',
};

async function persistActionsToAirtable(actions) {
  const persisted = [];
  for (const action of actions) {
    const jti = crypto.randomUUID();
    const fields = {
      'Task Name': action.title,
      'Task Type': TASK_TYPE_MAP[action.type] || action.type,
      Status: 'Draft Ready for Review',
      Priority: action.priority,
      'Draft Content': action.draftPreview,
      Source: action.source,
      'Action Payload': JSON.stringify(action.payload),
      'Token JTI': jti,
    };
    if (action.dueDate) fields['Due Date'] = action.dueDate;
    if (action.linkedContactId) fields['Linked Contact'] = [action.linkedContactId];
    if (action.linkedOpportunityId) fields['Linked Opportunity'] = [action.linkedOpportunityId];

    let task;
    try {
      task = await airtable.createTask(fields);
    } catch (err) {
      console.error(`Failed to create task "${action.title}":`, err.message);
      continue;
    }

    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const token = tokens.sign({ tid: task.id, jti, act: action.type, exp });

    persisted.push({
      ...action,
      taskId: task.id,
      token,
      reviewUrl: reviewUrlFor(task.id),
    });
  }
  return persisted;
}

async function runDailyBrief({ dryRun = config.dryRun } = {}) {
  assertBriefConfig();

  const date = airtable.todayIsoCT();
  const { inputs, errors: gatherErrors } = await gatherInputs();
  const counts = {
    gmail: inputs.gmail.length,
    contacts: inputs.contacts.length,
    opportunities: inputs.opportunities.length,
    calendar: inputs.calendar.length,
  };
  console.log(`[brief ${date}] inputs:`, counts, 'gather errors:', gatherErrors.length);

  const { text: rawText } = await claude.callClaude({
    date,
    operator: config.google.gmailUser,
    inputs,
  });

  let parsed;
  try {
    parsed = BriefSchema.parse(extractJSON(rawText));
  } catch (err) {
    console.error('[brief] Claude output failed validation:', err.message);
    console.error('[brief] Raw text:', rawText.slice(0, 1000));
    throw new Error(`Claude output failed validation: ${err.message}`);
  }

  const persisted = await persistActionsToAirtable(parsed.actions);
  const blocks = composeBriefBlocks({
    date,
    actions: persisted,
    summary: parsed.summary,
  });

  if (dryRun) {
    console.log('[brief] DRY_RUN — would post the following blocks:');
    console.log(JSON.stringify(blocks, null, 2));
    return { dryRun: true, date, counts, actionsPersisted: persisted.length, blocks };
  }

  const postResult = await slack.postMessage({
    channel: config.slack.channelId,
    blocks,
    text: `REBB Daily Brief — ${date} — ${persisted.length} action${persisted.length === 1 ? '' : 's'}`,
  });

  return {
    dryRun: false,
    date,
    counts,
    actionsPersisted: persisted.length,
    slackTs: postResult.ts,
    slackChannel: postResult.channel,
  };
}

module.exports = { runDailyBrief, gatherInputs, persistActionsToAirtable };
