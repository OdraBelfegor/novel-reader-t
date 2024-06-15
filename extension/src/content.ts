import type { EventHandlers } from './scripts/message-passing.js';
import {
  setListener,
  createMessage,
  sendSignal,
  recibeResponse,
} from './scripts/message-passing.js';

(async () => {
  const contentDoc = await import('./scripts/content/webnovel.js');

  const listeners: EventHandlers = {
    test: () => {
      console.log('Test content');
      return 'connected';
    },
    getDocText: contentDoc.getText,
    getCurrentIndex: contentDoc.getCurrentIndex,
    getPage: async (additive: number) => {
      if (additive === 0) return await contentDoc.getText(contentDoc.getCurrentIndex());

      return await contentDoc.getText(contentDoc.getCurrentIndex() + additive);
    },
  };

  setListener('content', listeners);
})();
