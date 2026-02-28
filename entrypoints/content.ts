import { Effect } from 'effect';
import { ExtensionMessage } from '../lib/schemas';
import { runDetectionPipeline } from '../lib/detector';
import { parseMessage } from '../lib/messages';
import { z } from 'zod';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main(ctx) {
    let scanInProgress = false;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const parsed = parseMessage(message);

      if (!parsed || parsed.type !== 'CHECK_PAGE') {
        return false;
      }

      // Prevent duplicate scans (background onUpdated + popup can both trigger)
      if (scanInProgress) {
        return false;
      }
      scanInProgress = true;

      (async () => {
        try {
          const result = await Effect.runPromise(runDetectionPipeline(window.location.href));

          const responseMessage: z.infer<typeof ExtensionMessage> = {
            type: 'SCAN_RESULT',
            domain: parsed.domain,
            result: result.scoring,
            url: result.detection.url
          };

          chrome.runtime.sendMessage(responseMessage);
        } catch (error) {
          console.error('Detection failed:', error);

          const responseMessage: z.infer<typeof ExtensionMessage> = {
            type: 'SCAN_RESULT',
            domain: parsed.domain,
            result: {
              score: 0,
              status: 'grey',
              confidence: 0,
              signals: [],
              totalPossibleSignals: 0
            },
            url: window.location.href
          };

          chrome.runtime.sendMessage(responseMessage);
        } finally {
          scanInProgress = false;
        }
      })();

      // Don't return true — we send results via runtime.sendMessage, not sendResponse
      return false;
    });
  }
});
