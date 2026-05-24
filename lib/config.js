function required(name) {
  const v = process.env[name];
  if (!v || v.trim() === '') throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function optional(name, fallback = '') {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : fallback;
}

function bool(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

const briefEnabled = optional('AIRTABLE_PAT') !== '' && optional('SLACK_BOT_TOKEN') !== '';

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  anthropicApiKey: optional('ANTHROPIC_API_KEY'),
  briefEnabled,
  publicBaseUrl: optional('PUBLIC_BASE_URL').replace(/\/$/, ''),
  hmacSecret: optional('HMAC_SECRET'),
  debugKey: optional('DEBUG_KEY'),
  dryRun: bool('DRY_RUN', false),
  cron: {
    tz: optional('CRON_TZ', 'America/Chicago'),
    spec: optional('CRON_SPEC', '0 6 * * 1-5'),
  },
  airtable: {
    pat: optional('AIRTABLE_PAT'),
    baseId: optional('AIRTABLE_BASE_ID', 'appv9gg7K71WL8Xkc'),
  },
  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
    redirectUri: optional('GOOGLE_REDIRECT_URI'),
    refreshToken: optional('GOOGLE_REFRESH_TOKEN'),
    gmailUser: optional('GMAIL_USER', 'me'),
  },
  slack: {
    botToken: optional('SLACK_BOT_TOKEN'),
    signingSecret: optional('SLACK_SIGNING_SECRET'),
    channelId: optional('SLACK_CHANNEL_ID'),
  },
};

function assertBriefConfig() {
  const missing = [];
  if (!config.publicBaseUrl) missing.push('PUBLIC_BASE_URL');
  if (!config.hmacSecret || config.hmacSecret.length < 32) missing.push('HMAC_SECRET (>=32 chars)');
  if (!config.airtable.pat) missing.push('AIRTABLE_PAT');
  if (!config.airtable.baseId) missing.push('AIRTABLE_BASE_ID');
  if (!config.google.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!config.google.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!config.google.redirectUri) missing.push('GOOGLE_REDIRECT_URI');
  if (!config.google.refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');
  if (!config.slack.botToken) missing.push('SLACK_BOT_TOKEN');
  if (!config.slack.signingSecret) missing.push('SLACK_SIGNING_SECRET');
  if (!config.slack.channelId) missing.push('SLACK_CHANNEL_ID');
  if (!config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
  if (missing.length) {
    throw new Error(`Brief pipeline missing env vars: ${missing.join(', ')}`);
  }
}

module.exports = { config, assertBriefConfig, required, optional, bool };
