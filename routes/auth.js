const express = require('express');
const { freshOauth2 } = require('../lib/google');
const { config } = require('../lib/config');

const router = express.Router();

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

function checkDebugKey(req, res) {
  if (!config.debugKey) {
    res.status(503).send('DEBUG_KEY not configured on server');
    return false;
  }
  const provided = typeof req.query.key === 'string' ? req.query.key.trim() : '';
  if (provided !== config.debugKey) {
    res.status(401).send('Unauthorized');
    return false;
  }
  return true;
}

router.get('/auth/google/start', (req, res) => {
  if (!checkDebugKey(req, res)) return;
  const oauth2 = freshOauth2();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    include_granted_scopes: true,
  });
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');

  try {
    const oauth2 = freshOauth2();
    const { tokens: t } = await oauth2.getToken(code);
    const refreshToken = t.refresh_token;
    if (!refreshToken) {
      return res
        .status(400)
        .send(
          'No refresh_token returned. Revoke prior consent at https://myaccount.google.com/permissions and retry /auth/google/start.'
        );
    }
    const safe = refreshToken.replace(/</g, '&lt;');
    res.set('content-type', 'text/html');
    res.send(`<!doctype html>
<html><head><title>REBB Google Refresh Token</title>
<style>body{font-family:system-ui;max-width:720px;margin:40px auto;padding:0 16px}pre{background:#111;color:#0f0;padding:16px;border-radius:8px;word-break:break-all;white-space:pre-wrap}</style>
</head><body>
<h1>Your refresh token</h1>
<p>Copy this and set it as the <code>GOOGLE_REFRESH_TOKEN</code> env var in Railway. This is shown only once.</p>
<pre id="t">${safe}</pre>
<button onclick="navigator.clipboard.writeText(document.getElementById('t').textContent)">Copy</button>
</body></html>`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`OAuth exchange failed: ${err.message}`);
  }
});

module.exports = router;
