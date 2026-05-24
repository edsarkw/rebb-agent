const { config } = require('./config');

function truncate(s, n) {
  if (typeof s !== 'string') return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function headerBlocks({ date, count, summary }) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `REBB Daily Brief — ${date}`, emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${count} action${count === 1 ? '' : 's'} on deck` }],
    },
  ];
  if (summary) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `_${truncate(summary, 300)}_` },
    });
  }
  blocks.push({ type: 'divider' });
  return blocks;
}

function actionBlocks(action, idx) {
  const reviewUrl = action.reviewUrl;
  const titleLine = `*${idx}. ${truncate(action.title, 150)}*  ·  ${action.priority}  ·  ${action.source}`;
  const draft = truncate(action.draftPreview || '', 400);

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${titleLine}\n_${truncate(action.reason || '', 300)}_`,
      },
    },
  ];
  if (draft) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '```' + draft + '```' },
    });
  }
  blocks.push({
    type: 'actions',
    block_id: `act_${action.taskId}`,
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Review in Airtable', emoji: true },
        url: reviewUrl,
        action_id: `review_${action.taskId}`,
      },
      {
        type: 'button',
        style: 'primary',
        text: { type: 'plain_text', text: 'Approve & Send', emoji: true },
        action_id: 'do_approve',
        value: action.token,
        confirm: {
          title: { type: 'plain_text', text: 'Confirm action' },
          text: { type: 'mrkdwn', text: `*${truncate(action.title, 150)}*\nThis will execute the action now.` },
          confirm: { type: 'plain_text', text: 'Send' },
          deny: { type: 'plain_text', text: 'Cancel' },
        },
      },
    ],
  });
  blocks.push({ type: 'divider' });
  return blocks;
}

function emptyDayBlocks(date) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `REBB Daily Brief — ${date}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Nothing on deck — enjoy your morning.* :coffee:' },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: 'No unread important emails, no overdue CRM follow-ups, no calendar prep needed.' }],
    },
  ];
}

function composeBriefBlocks({ date, actions, summary }) {
  if (!actions || actions.length === 0) return emptyDayBlocks(date);
  const blocks = headerBlocks({ date, count: actions.length, summary });
  actions.forEach((a, i) => {
    blocks.push(...actionBlocks(a, i + 1));
  });
  return blocks.slice(0, 50);
}

function sentUpdateBlocks(original, { sentAt }) {
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `✓ *Sent at ${sentAt}*` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: original },
    },
  ];
}

function failedUpdateBlocks(original, { error, retryToken }) {
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `❌ *Failed:* ${truncate(error, 400)}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: original },
    },
  ];
  if (retryToken) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          style: 'primary',
          text: { type: 'plain_text', text: 'Retry', emoji: true },
          action_id: 'do_approve',
          value: retryToken,
        },
      ],
    });
  }
  return blocks;
}

module.exports = { composeBriefBlocks, emptyDayBlocks, sentUpdateBlocks, failedUpdateBlocks, truncate };
