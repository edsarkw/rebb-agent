const express = require('express');
const { config } = require('../lib/config');
const airtable = require('../lib/airtable');
const gmail = require('../lib/gmail');
const calendar = require('../lib/calendar');
const slack = require('../lib/slack');
const claude = require('../lib/claude');
const { runDailyBrief } = require('../lib/pipeline');

const router = express.Router();

function requireBearer(req, res, next) {
  if (!config.debugKey) return res.status(503).json({ error: 'DEBUG_KEY not configured' });
  const auth = req.get('authorization') || '';
  const raw = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.key;
  const token = typeof raw === 'string' ? raw.trim() : '';
  if (token !== config.debugKey) return res.status(401).json({ error: 'unauthorized' });
  next();
}

router.use(express.json({ limit: '1mb' }));

router.get('/debug/preflight', requireBearer, async (req, res) => {
  const checks = {};
  const run = async (label, fn) => {
    try {
      const r = await fn();
      checks[label] = { ok: true, ...(r && typeof r === 'object' ? r : { result: r }) };
    } catch (err) {
      checks[label] = { ok: false, error: err.message };
    }
  };
  await Promise.all([
    run('airtable', () => airtable.ping()),
    run('gmail', () => gmail.ping()),
    run('calendar', () => calendar.ping()),
    run('slack', () => slack.ping()),
    run('claude', () => claude.ping()),
  ]);
  const allOk = Object.values(checks).every((c) => c.ok);
  res.status(allOk ? 200 : 500).json({ ok: allOk, checks });
});

router.post('/debug/run-now', requireBearer, async (req, res) => {
  const send = req.query.send === '1' || req.query.send === 'true';
  try {
    const result = await runDailyBrief({ dryRun: !send });
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[debug/run-now] failed:', err);
    res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
});

module.exports = router;
