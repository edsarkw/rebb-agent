const express = require('express');
const slack = require('../lib/slack');
const tokens = require('../lib/tokens');
const airtable = require('../lib/airtable');
const { executeAction } = require('../lib/actions');
const { sentUpdateBlocks, failedUpdateBlocks } = require('../lib/blocks');

const router = express.Router();

router.post(
  '/slack/actions',
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req, res) => {
    const rawBody = req.body ? req.body.toString('utf8') : '';
    const signature = req.get('x-slack-signature');
    const timestamp = req.get('x-slack-request-timestamp');

    const sig = slack.verifySigningSecret({ signature, timestamp, rawBody });
    if (!sig.ok) {
      console.warn(`[slack-actions] signature rejected: ${sig.error}`);
      return res.status(401).send('Unauthorized');
    }

    let payload;
    try {
      const params = new URLSearchParams(rawBody);
      const payloadStr = params.get('payload');
      if (!payloadStr) throw new Error('missing payload');
      payload = JSON.parse(payloadStr);
    } catch (err) {
      console.warn(`[slack-actions] bad payload: ${err.message}`);
      return res.status(400).send('Bad Request');
    }

    const action = payload.actions?.[0];
    if (!action) return res.status(400).send('No action');

    if (action.action_id?.startsWith('review_')) {
      return res.status(200).send('');
    }

    if (action.action_id !== 'do_approve') {
      console.warn(`[slack-actions] unknown action_id: ${action.action_id}`);
      return res.status(200).send('');
    }

    const tokenStr = action.value;
    const v = tokens.verify(tokenStr);
    if (!v.ok) {
      console.warn(`[slack-actions] token rejected: ${v.error}`);
      return res.status(200).json({
        response_action: 'errors',
        text: `Token rejected: ${v.error}`,
      });
    }

    const { tid, jti } = v.payload;
    const channel = payload.channel?.id;
    const messageTs = payload.message?.ts;
    const responseUrl = payload.response_url;
    const originalText = payload.message?.blocks
      ? `_(see message above)_`
      : '_(original content)_';

    res.status(200).send('');

    setImmediate(async () => {
      try {
        const flip = await airtable.atomicFlipDraftToSent(tid, jti);
        if (!flip.ok) {
          if (flip.reason === 'already_sent') {
            await slack.respondViaResponseUrl(responseUrl, {
              response_type: 'ephemeral',
              replace_original: false,
              text: 'Already sent.',
            });
            return;
          }
          await slack.respondViaResponseUrl(responseUrl, {
            response_type: 'ephemeral',
            replace_original: false,
            text: `Cannot send: ${flip.reason}`,
          });
          return;
        }

        try {
          const result = await executeAction(flip.task);
          console.log(`[slack-actions] executed task ${tid}:`, result.kind, result.id || '');
          const sentAt = new Date().toLocaleTimeString('en-US', {
            timeZone: 'America/Chicago',
            hour: 'numeric',
            minute: '2-digit',
          });
          await slack.respondViaResponseUrl(responseUrl, {
            replace_original: true,
            blocks: sentUpdateBlocks(originalText, { sentAt }),
            text: `Sent at ${sentAt}`,
          });
        } catch (execErr) {
          console.error(`[slack-actions] execution failed for task ${tid}:`, execErr);
          await airtable.markFailed(tid, execErr.message);
          await slack.respondViaResponseUrl(responseUrl, {
            replace_original: true,
            blocks: failedUpdateBlocks(originalText, { error: execErr.message }),
            text: `Failed: ${execErr.message}`,
          });
        }
      } catch (outerErr) {
        console.error('[slack-actions] outer failure:', outerErr);
        try {
          await slack.respondViaResponseUrl(responseUrl, {
            response_type: 'ephemeral',
            replace_original: false,
            text: `Error processing action: ${outerErr.message}`,
          });
        } catch (_) {}
      }
    });
  }
);

module.exports = router;
