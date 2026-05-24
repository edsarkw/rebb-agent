const { google, oauth2Client } = require('./google');
const { config } = require('./config');

function gmailClient() {
  return google.gmail({ version: 'v1', auth: oauth2Client() });
}

const DEFAULT_QUERY = 'is:important is:unread newer_than:3d -in:sent -in:chat -category:promotions -category:social';

async function listImportantUnansweredThreads({ q = DEFAULT_QUERY, maxResults = 40 } = {}) {
  const gmail = gmailClient();
  const listResp = await gmail.users.threads.list({
    userId: config.google.gmailUser,
    q,
    maxResults,
  });
  const threads = listResp.data.threads || [];
  if (threads.length === 0) return [];

  const enriched = await Promise.all(
    threads.map(async (t) => {
      const detail = await gmail.users.threads.get({
        userId: config.google.gmailUser,
        id: t.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });
      const messages = detail.data.messages || [];
      const last = messages[messages.length - 1];
      const headers = Object.fromEntries(
        (last?.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value])
      );
      return {
        threadId: t.id,
        snippet: detail.data.snippet || '',
        messageCount: messages.length,
        lastMessageId: last?.id,
        from: headers.from || '',
        to: headers.to || '',
        subject: headers.subject || '',
        date: headers.date || '',
      };
    })
  );
  return enriched;
}

function encodeRfc2822({ to, from, subject, body, inReplyTo, references }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push('', body);
  return Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendReply({ threadId, to, subject, body, inReplyTo, references }) {
  const gmail = gmailClient();
  const raw = encodeRfc2822({
    to,
    from: config.google.gmailUser,
    subject,
    body,
    inReplyTo,
    references,
  });
  const resp = await gmail.users.messages.send({
    userId: config.google.gmailUser,
    requestBody: { raw, threadId },
  });
  return { id: resp.data.id, threadId: resp.data.threadId };
}

async function ping() {
  const gmail = gmailClient();
  const resp = await gmail.users.getProfile({ userId: config.google.gmailUser });
  return { emailAddress: resp.data.emailAddress, messagesTotal: resp.data.messagesTotal };
}

module.exports = { listImportantUnansweredThreads, sendReply, ping, DEFAULT_QUERY };
