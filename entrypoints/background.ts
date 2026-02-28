import { Effect } from 'effect';
import { ExtensionMessage, CachedResultSchema } from '../lib/schemas';
import { getCached, setCache, clearCache } from '../lib/cache';
import { parseMessage } from '../lib/messages';
import { DetectionError } from '../lib/errors';
import { z } from 'zod';

export default defineBackground(() => {
  console.log('EU Shield background service worker started');

  // Update icon based on compliance status
  function updateIcon(tabId: number, status: 'green' | 'red' | 'grey'): void {
    const iconPath = `/icon-${status}-32.png`;
    chrome.action.setIcon({
      tabId,
      path: iconPath
    });
  }

  // Handle tab updates
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) {
      return;
    }

    try {
      const url = new URL(tab.url);
      const domain = url.hostname;

      // Check cache first
      const cachedResult = await Effect.runPromise(getCached(domain));

      if (cachedResult) {
        updateIcon(tabId, cachedResult.status);
        return;
      }

       // Send message to content script to check page
      const message: z.infer<typeof ExtensionMessage> = {
        type: 'CHECK_PAGE',
        domain
      };
      
      try {
        await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        console.warn('Content script not ready or not injected:', error);
        // Fallback to grey icon if content script is not available
        updateIcon(tabId, 'grey');
      }
    } catch (error) {
      console.error('Error in tab update handler:', error);
    }
  });

  // Handle messages from content scripts and popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const parsed = parseMessage(message);

    if (!parsed) {
      return false;
    }

    switch (parsed.type) {
      case 'SCAN_RESULT': {
        console.log(`SCAN_RESULT for ${parsed.domain}: score=${parsed.result.score}, status=${parsed.result.status}, signals=${parsed.result.signals.length}`);

        const cacheResult: z.infer<typeof CachedResultSchema> = {
          domain: parsed.domain,
          score: parsed.result.score,
          status: parsed.result.status,
          confidence: parsed.result.confidence,
          signals: parsed.result.signals,
          analyzedUrl: parsed.url,
          timestamp: Date.now()
        };

        Effect.runPromise(setCache(parsed.domain, cacheResult)).then(() => {
          if (sender.tab?.id) {
            updateIcon(sender.tab.id, parsed.result.status);
          }
        }).catch(error => console.error('Cache error:', error));

        return false; // No response needed
      }

      case 'GET_RESULT': {
        Effect.runPromise(getCached(parsed.domain))
          .then(result => sendResponse(result))
          .catch(() => sendResponse(null));
        return true; // Will respond asynchronously
      }

      case 'FORCE_RESCAN': {
        Effect.runPromise(clearCache(parsed.domain)).then(() => {
          if (sender.tab?.id) {
            const msg: z.infer<typeof ExtensionMessage> = {
              type: 'CHECK_PAGE',
              domain: parsed.domain
            };
            chrome.tabs.sendMessage(sender.tab.id, msg);
          }
        }).catch(error => console.error('Rescan error:', error));

        return false; // No response needed
      }

      default:
        return false;
    }
  });
});