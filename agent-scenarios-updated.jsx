import React, { useState } from 'react';

// =========================================================================
// REBB CRM — Agent Scenarios (Claude.ai artifact)
// -------------------------------------------------------------------------
// Operator:    Ed Sarausad <edsar@kw.com>
// Site:        lastinghomes.co
// Phase:       1 — interactive scenarios driven by the Anthropic API
//
// IMPORTANT: requests do NOT go directly to api.anthropic.com (browser CORS).
// They go to the Railway-hosted proxy in this repo (server.js).
// =========================================================================

// TODO: replace YOUR_RAILWAY_DOMAIN with the domain printed by `railway domain`
//       e.g. 'https://rebb-agent-proxy-production.up.railway.app/v1/messages'
const PROXY_URL = 'https://YOUR_RAILWAY_DOMAIN/v1/messages';

const SCENARIOS = [
  {
    id: 'market-brief',
    title: 'Monday market brief',
    description:
      'Pull the latest week of activity for KW Commercial data-center deals and summarize movers.',
    prompt:
      'You are the REBB CRM analyst. Produce a concise Monday market brief covering data-center commercial real estate: notable transactions, capacity announcements, and rate-environment notes from the last 7 days. Use web_search when needed and cite sources.',
  },
  {
    id: 'friday-wrap',
    title: 'Friday wrap',
    description: 'End-of-week recap with three things to watch next week.',
    prompt:
      'You are the REBB CRM analyst. Produce a Friday wrap of the data-center CRE week: closed deals, rumored deals, hyperscaler capex updates, and 3 items to watch next week. Use web_search for confirmation.',
  },
  {
    id: 'lead-qualifier',
    title: 'Lead qualifier',
    description:
      'Given a prospect name and city, draft a quick qualification memo for the broker.',
    prompt:
      'You are the REBB CRM lead qualifier. For the prospect below, find recent news, parent company, likely site-selection criteria, and 3 sharp questions for the first call. Use web_search.',
  },
];

async function callClaude({ system, userMessage, signal }) {
  const body = {
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: userMessage }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
  };

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy returned ${res.status}: ${text}`);
  }

  return res.json();
}

function extractText(message) {
  if (!message?.content) return '';
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');
}

export default function AgentScenarios() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const [userInput, setUserInput] = useState('');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const active = SCENARIOS.find((s) => s.id === activeId);

  async function run() {
    setIsLoading(true);
    setError(null);
    setOutput('');
    try {
      const message = await callClaude({
        system: active.prompt,
        userMessage:
          userInput.trim() ||
          'Run the scenario with sensible defaults for KW Commercial data-center coverage.',
      });
      setOutput(extractText(message) || JSON.stringify(message, null, 2));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">REBB CRM — Agent Scenarios</h1>
          <p className="text-sm text-slate-600">
            lastinghomes.co • Ed Sarausad, KW Commercial
          </p>
        </header>

        <nav className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                s.id === activeId
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {s.title}
            </button>
          ))}
        </nav>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-medium">{active.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{active.description}</p>

          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            rows={3}
            placeholder="Optional extra context (markets, prospects, tickers)…"
            className="mt-3 w-full rounded-md border border-slate-300 p-2 text-sm"
          />

          <button
            onClick={run}
            disabled={isLoading}
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isLoading ? 'Running…' : 'Run scenario'}
          </button>
        </section>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {output && (
          <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-4 text-sm">
            {output}
          </pre>
        )}
      </div>
    </div>
  );
}
