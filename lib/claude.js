const { config } = require('./config');

const MODEL = 'claude-opus-4-7';

const SYSTEM_PROMPT = `You are REBB, a Keller Williams real-estate operations agent for Ed Sarausad (edsar@kw.com).
You receive a snapshot of Ed's morning state (important Gmail threads, overdue CRM contacts and opportunities, today's calendar events) and produce a prioritized action list.

Rules:
- Return ONLY valid JSON conforming to the schema below. No prose, no markdown fences.
- Maximum 10 actions, sorted P1 -> P3.
- Every action must have a "draftPreview" that is ready to send as-is (no placeholders like [NAME], no TODO).
- For Email Reply actions, "payload.body" must be the complete reply body — polite, on-brand, concise. Include the threadId, to, subject, and any In-Reply-To header from the source thread metadata.
- For Calendar Event actions, "payload.start" and "payload.end" must be ISO 8601 with timezone offset.
- For Airtable Update actions, only update fields that obviously need updating (e.g. push "Next Follow-Up Date" forward by 7 days, set "Stage" based on email content).
- For Meeting Prep, "draftPreview" is a one-paragraph briefing on the meeting and attendees.
- Use the "reason" field to state in one sentence why this action matters.
- If nothing is on deck, return {"actions": [], "summary": "Nothing requires action today."}.

JSON schema (TypeScript notation):
{
  actions: Array<{
    title: string,                       // <=200 chars, the action label
    type: "Email Reply" | "Airtable Update" | "Calendar Event" | "Meeting Prep",
    priority: "P1" | "P2" | "P3",
    source: "Gmail" | "Contacts" | "Opportunities" | "Calendar",
    reason: string,                      // one sentence why
    draftPreview: string,                // user-facing preview, <=2000 chars
    dueDate?: string,                    // YYYY-MM-DD
    linkedContactId?: string,            // Airtable rec... id
    linkedOpportunityId?: string,        // Airtable rec... id
    payload: EmailPayload | AirtableUpdatePayload | CalendarEventPayload | MeetingPrepPayload
  }>,
  summary?: string                       // optional one-line summary
}`;

async function callClaude({ inputs, date, operator }) {
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const url = `http://127.0.0.1:${config.port}/v1/messages`;

  const userMessage = JSON.stringify({ date, operator, inputs }, null, 2);

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Today is ${date}. Here is the morning snapshot for ${operator}:\n\n${userMessage}\n\nReturn the action list as JSON only.`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Claude proxy returned ${resp.status}: ${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  if (!text) throw new Error('Claude returned no text content');
  return { text, raw: data };
}

async function ping() {
  if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const url = `http://127.0.0.1:${config.port}/v1/messages`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  if (!resp.ok) throw new Error(`Claude proxy ping failed: ${resp.status}`);
  return true;
}

module.exports = { callClaude, ping, MODEL };
