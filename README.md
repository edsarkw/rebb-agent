# rebb-agent-proxy

Claude API proxy for the **REBB CRM** real estate AI agent at
[lastinghomes.co](https://lastinghomes.co). Sits between a Claude.ai artifact
(browser) and the Anthropic Messages API to:

1. **Fix CORS** — Anthropic does not allow direct browser calls; this proxy
   does.
2. **Hide the API key** — the key lives on Railway, never in the artifact.
3. **Pass through `web_search` tool calls** — the
   `anthropic-beta: web-search-2025-03-05` header is added on every request.
4. **Stay ready for Phase 2** — same Railway project can host a cron service
   for the Monday market brief and Friday wrap.

---

## Prerequisites

- A [Railway](https://railway.app) account (Hobby plan, ~$5/month).
- An [Anthropic API key](https://console.anthropic.com/) (`sk-ant-...`).
- The [Railway CLI](https://docs.railway.app/develop/cli) installed locally:
  `npm i -g @railway/cli`.

## Deploy

```bash
# 1. Clone & install
git clone https://github.com/edsarkw/rebb-agent.git
cd rebb-agent
npm install

# 2. Log in to Railway
railway login

# 3. Create the project and deploy
railway init        # pick "Empty Project" and name it rebb-agent-proxy
railway up          # uploads source, builds with Nixpacks, starts node server.js

# 4. Set the API key
#    Either in the Railway dashboard → Variables, or via CLI:
railway variables set ANTHROPIC_API_KEY=sk-ant-...

# 5. Get a public domain
railway domain      # prints something like rebb-agent-proxy-production.up.railway.app
```

Verify the deploy:

```bash
curl https://YOUR_RAILWAY_DOMAIN/health
# { "status": "ok", "version": "1.0.0", "uptime": 12.34 }
```

## Wire the Claude.ai artifact

Open `agent-scenarios-updated.jsx`, find the line marked
`// TODO: replace with your Railway domain`, and paste the domain from
`railway domain`. That is the only change required — every other call
signature is unchanged.

```js
// before
const PROXY_URL = 'https://YOUR_RAILWAY_DOMAIN/v1/messages';
// after
const PROXY_URL = 'https://rebb-agent-proxy-production.up.railway.app/v1/messages';
```

Paste the updated component into a Claude.ai artifact and run it.

## Local dev

```bash
cp .env.example .env
# edit .env and paste your real key
npm run dev   # node --watch server.js
```

The server listens on `http://localhost:3000`.

## Cost expectation

- **Railway Hobby plan**: ~$5/month, includes $5 of usage credit.
- This proxy is idle most of the time (sub-100MB RAM, near-zero CPU); typical
  spend is well under the credit.
- **Anthropic API**: pay-as-you-go, separate bill — billed against the key
  configured in `ANTHROPIC_API_KEY`.

## Phase 2 preview — scheduled jobs

The same Railway project will host a second service for cron jobs:

1. In the Railway dashboard, click **+ New** → **Empty Service** in the
   same project.
2. Point it at the same repo, but set the start command to
   `node scheduler.js` (file will be added in Phase 2).
3. Use [Railway cron triggers](https://docs.railway.app/reference/cron-jobs)
   to schedule:
   - **Monday 06:00 CT** — market brief generation.
   - **Friday 16:00 CT** — weekly wrap.
4. The scheduler service will call this proxy's `/v1/messages` endpoint
   internally (same `ANTHROPIC_API_KEY` shared across services via Railway
   variable references).

No changes to this proxy are required for Phase 2 — it already supports
everything the scheduler needs.

## Endpoints

| Method | Path           | Description                                               |
| ------ | -------------- | --------------------------------------------------------- |
| GET    | `/health`      | `{ status, version, uptime }` — used by Railway healthchecks. |
| POST   | `/v1/messages` | Forwards body to the Anthropic Messages API, returns the response (including 4xx/5xx). |

## Operator

Ed Sarausad — KW Commercial National Director of Data Center Development
(<edsar@kw.com>).
