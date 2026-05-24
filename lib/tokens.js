const crypto = require('node:crypto');
const { config } = require('./config');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function sign(payload) {
  if (!config.hmacSecret) throw new Error('HMAC_SECRET not configured');
  const body = b64url(JSON.stringify(payload));
  const mac = b64url(crypto.createHmac('sha256', config.hmacSecret).update(body).digest());
  return `${body}.${mac}`;
}

function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, error: 'malformed' };
  }
  const [body, mac] = token.split('.', 2);
  if (!body || !mac) return { ok: false, error: 'malformed' };
  const expected = b64url(crypto.createHmac('sha256', config.hmacSecret).update(body).digest());
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'bad_signature' };
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8'));
  } catch {
    return { ok: false, error: 'bad_json' };
  }
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: 'expired' };
  }
  return { ok: true, payload };
}

module.exports = { sign, verify };
