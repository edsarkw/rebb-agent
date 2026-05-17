const express = require('express');
const cors = require('cors');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_BETA = 'web-search-2025-03-05';

const pkg = require('./package.json');
const STARTED_AT = Date.now();

const app = express();

app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: pkg.version,
    uptime: (Date.now() - STARTED_AT) / 1000,
  });
});

app.post('/v1/messages', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: {
        type: 'configuration_error',
        message: 'ANTHROPIC_API_KEY is not set on the proxy server.',
      },
    });
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': ANTHROPIC_BETA,
      },
      body: JSON.stringify(req.body),
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const bodyText = await upstream.text();

    res.status(upstream.status);
    res.setHeader('content-type', contentType);
    res.send(bodyText);
  } catch (err) {
    console.error('Upstream request failed:', err);
    res.status(502).json({
      error: {
        type: 'upstream_error',
        message: err.message || 'Failed to reach Anthropic API',
      },
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: { type: 'not_found', message: `No route for ${req.method} ${req.path}` } });
});

const server = app.listen(PORT, () => {
  console.log(`rebb-agent-proxy v${pkg.version} listening on :${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY is not set. /v1/messages will return 500 until it is configured.');
  }
});

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
