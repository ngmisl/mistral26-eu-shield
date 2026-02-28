import { ExtensionMessage } from './schemas';
import { MessageError } from './errors';
import { z } from 'zod';

// Send message with Zod validation
function sendMessage(message: z.infer<typeof ExtensionMessage>): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Validate message before sending
      const validated = ExtensionMessage.parse(message);
      
      chrome.runtime.sendMessage(validated, response => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new MessageError({ reason: 'send_failed', raw: message }));
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(new MessageError({ reason: 'validation_failed', raw: message }));
    }
  });
}

// Parse received message with Zod validation
function parseMessage(raw: unknown): z.infer<typeof ExtensionMessage> | null {
  const result = ExtensionMessage.safeParse(raw);
  
  if (!result.success) {
    console.warn('Invalid message received:', raw, result.error);
    return null;
  }
  
  return result.data;
}

export { sendMessage, parseMessage };