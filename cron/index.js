const { Cron } = require('croner');
const { config } = require('../lib/config');
const { runDailyBrief } = require('../lib/pipeline');

let job = null;

function startCron() {
  if (job) return job;
  if (!config.airtable.pat || !config.slack.botToken) {
    console.log('[cron] brief deps not configured — skipping cron registration');
    return null;
  }
  job = new Cron(
    config.cron.spec,
    {
      timezone: config.cron.tz,
      protect: true,
      catch: (err) => console.error('[cron] runDailyBrief failed:', err),
    },
    async () => {
      const startedAt = new Date().toISOString();
      console.log(`[cron] runDailyBrief starting at ${startedAt} (tz=${config.cron.tz})`);
      try {
        const result = await runDailyBrief();
        console.log('[cron] runDailyBrief finished:', JSON.stringify(result));
      } catch (err) {
        console.error('[cron] runDailyBrief threw:', err);
      }
    }
  );
  console.log(
    `[cron] scheduled "${config.cron.spec}" (tz=${config.cron.tz}); next run = ${job.nextRun()?.toISOString()}`
  );
  return job;
}

function stopCron() {
  if (job) {
    job.stop();
    job = null;
  }
}

module.exports = { startCron, stopCron };
