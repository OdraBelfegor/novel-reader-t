import { SocketWrapper } from './scripts/socket.js';
import {
  setListener,
  sendSignal,
  createMessage,
  recibeResponse,
} from './scripts/message-passing.js';
import type { EventHandlers } from './scripts/message-passing.js';
import type { PopupToBackgroundEvents } from './popup/popup.js';
import { waitMillis, matchUsableSites, getCurrentTab } from './scripts/helpers.js';
import { getCurrentContent, getPage, stopReading } from './scripts/commands.js';

let server_url: string;

export const usableSites: UsableSite[] = [
  {
    name: 'WebNovel',
    hostname: 'www.webnovel.com',
    usablePath: /^\/book\/[^\/]+\/[^\/]+/,
  },
];

const listeners: PopupToBackgroundEvents & EventHandlers = {
  print: (message: any) => {
    console.log('Printing:', message);
  },
  'get-state': async () => {
    if (!server_url)
      await chrome.storage.local.get(['server']).then(result => {
        if (!result.server) {
          const urlPlaceholder = 'http://localhost:5000';
          chrome.storage.local.set({ server: urlPlaceholder });
          server_url = urlPlaceholder;
        } else {
          server_url = result.server;
        }
      });
    return getState();
  },
  connect: url => {
    if (url !== server_url) {
      chrome.storage.local.set({ server: url }).then(() => {
        console.log('Url saved');
      });
    }

    socket.changeUrl(url);
    socket.connect();
    server_url = url;
  },
  disconnect: () => {
    if (!socket.socket.connected) return;
    socket.disconnect();
  },
};

function getState(): ConnectionState {
  return {
    state: socket.socket.connected ? 'Connected' : 'Disconnected',
    url: server_url,
  };
}

function updateState(): void {
  try {
    sendSignal(createMessage('update-state', getState()), 'popup');
  } catch (e) {
    console.log(e);
  }
}

setListener('background', listeners);

const socket = new SocketWrapper('http://localhost:5008');

socket.on('connect', () => {
  console.log('Socket connected');
  updateState();
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
  updateState();
  stopReading();
});

socket.on('get-content', async (addition, callback: (content: string[] | []) => void) => {
  console.log('Get content:', addition);
  if (addition === 0) getCurrentContent(callback);
  else getPage(addition, callback);
});

socket.on('stop', () => {
  stopReading();
});

export type ConnectionState = {
  state: 'Connected' | 'Disconnected';
  url: string;
};

export interface BackgroundToPopupEvents {
  'update-state': (response: ConnectionState) => void;
}
interface BackgroundToContentEvents {}

type UsableSite = {
  name: string;
  hostname: string;
  usablePath: RegExp;
};
