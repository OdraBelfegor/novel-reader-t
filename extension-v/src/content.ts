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
      // sendSignal(createMessage("print", "Getting content"), "background");
      const currentIndex = contentDoc.getCurrentIndex();
      return await contentDoc.getText(currentIndex + additive);
    },
    getCurrentPage: async () => {
      return await contentDoc.getText(contentDoc.getCurrentIndex());
    },
  };

  setListener('content', listeners);
})();
