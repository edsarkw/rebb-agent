const { z } = require('zod');

const EmailPayload = z.object({
  threadId: z.string().optional(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
});

const AirtableUpdatePayload = z.object({
  table: z.enum(['Contacts', 'Opportunities']),
  recordId: z.string(),
  fields: z.record(z.unknown()),
});

const CalendarEventPayload = z.object({
  summary: z.string(),
  description: z.string().optional(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.string()).optional(),
  location: z.string().optional(),
});

const MeetingPrepPayload = z.object({
  eventId: z.string().optional(),
  notes: z.string(),
});

const ActionItem = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(['Email Reply', 'Airtable Update', 'Calendar Event', 'Meeting Prep']),
  priority: z.enum(['P1', 'P2', 'P3']).default('P2'),
  source: z.enum(['Gmail', 'Contacts', 'Opportunities', 'Calendar']),
  reason: z.string().max(500),
  draftPreview: z.string().max(2000),
  dueDate: z.string().optional(),
  linkedContactId: z.string().optional(),
  linkedOpportunityId: z.string().optional(),
  payload: z.union([EmailPayload, AirtableUpdatePayload, CalendarEventPayload, MeetingPrepPayload]),
});

const BriefSchema = z.object({
  actions: z.array(ActionItem).max(10),
  summary: z.string().max(500).optional(),
});

function extractJSON(text) {
  if (typeof text !== 'string') throw new Error('Expected string');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  return JSON.parse(raw.slice(start, end + 1));
}

module.exports = { BriefSchema, ActionItem, extractJSON };
