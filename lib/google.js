const { google } = require('googleapis');
const { config } = require('./config');

let _oauth2 = null;
function oauth2Client() {
  if (_oauth2) return _oauth2;
  const { clientId, clientSecret, redirectUri, refreshToken } = config.google;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
  _oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  if (refreshToken) _oauth2.setCredentials({ refresh_token: refreshToken });
  return _oauth2;
}

function freshOauth2() {
  const { clientId, clientSecret, redirectUri } = config.google;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

module.exports = { google, oauth2Client, freshOauth2 };
