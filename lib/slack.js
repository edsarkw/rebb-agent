const crypto = require('node:crypto');
const { config } = require('./config');

const SLACK_API = 'https://slack.com/api';

async function slackApi(method, payload) {
  if (!config.slack.botToken) throw new Error('SLACK_BOT_TOKEN not configured');
  const resp = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${config.slack.botToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!data.ok) {
    const err = new Error(`Slack ${method} failed: ${data.error || 'unknown'}`);
    err.response = data;
    throw err;
  }
  return data;
}

async function postMessage({ channel, blocks, text }) {
  return slackApi('chat.postMessage', {
    channel: channel || config.slack.channelId,
    blocks,
    text: text || 'REBB daily brief',
    unfurl_links: false,
    unfurl_media: false,
  });
}

async function updateMessage({ channel, ts, blocks, text }) {
  return slackApi('chat.update', {
    channel,
    ts,
    blocks,
    text: text || 'REBB daily brief',
  });
}

async function respondViaResponseUrl(responseUrl, payload) {
  const resp = await fetch(responseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    throw new Error(`response_url failed: ${resp.status}`);
  }
}

function verifySigningSecret({ signature, timestamp, rawBody }) {
  if (!config.slack.signingSecret) throw new Error('SLACK_SIGNING_SECRET not configured');
  if (!signature || !timestamp) return { ok: false, error: 'missing_headers' };

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, error: 'bad_timestamp' };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return { ok: false, error: 'stale' };

  const basestring = `v0:${timestamp}:${rawBody}`;
  const computed = 'v0=' + crypto
    .createHmac('sha256', config.slack.signingSecret)
    .update(basestring)
    .digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(computed);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'bad_signature' };
  }
  return { ok: true };
}

async function ping() {
  return slackApi('auth.test', {});
}

module.exports = {
  postMessage,
  updateMessage,
  respondViaResponseUrl,
  verifySigningSecret,
  ping,
};
