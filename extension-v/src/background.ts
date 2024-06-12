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

    setTimeout(() => {
      sendSignal(createMessage('update-state', getState()), 'popup');
    }, 100);
  },
  disconnect: () => {
    if (!socket.socket.connected) return;
    socket.disconnect();
  },
};

function getState(): {
  state: 'Connected' | 'Disconnected';
  url: string;
} {
  return {
    state: socket.socket.connected ? 'Connected' : 'Disconnected',
    url: server_url,
  };
}

async function getTab(): Promise<chrome.tabs.Tab> {
  if (!readingTab) return getCurrentTab();

  const lastTab = await chrome.tabs.get(readingTab);

  if (lastTab) return lastTab;
  else return getCurrentTab();
}

setListener('background', listeners);

const socket = new SocketWrapper('http://localhost:5008');
/**
 * * One command to indicate the start of the reading, to setup the page and get the current content
 * * And another command command to get the next/previous content, if it fails stop the player
 */

socket.on('connect', () => {
  console.log('Socket connected');
  try {
    sendSignal(createMessage('update-state', getState()), 'popup');
  } catch (e) {
    console.log(e);
  }
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');

  try {
    sendSignal(createMessage('update-state', getState()), 'popup');
  } catch (e) {
    console.log(e);
  }
});

let readingTab: number | undefined;

socket.on('content', async (addition, callback) => {
  const currentTab: chrome.tabs.Tab = await getTab();

  if (!currentTab || !currentTab.id || !currentTab.url) {
    console.log('No current tab');
    callback([]);
    readingTab = undefined;
    return;
  }

  if (readingTab && readingTab !== currentTab.id) {
    console.log('Trying to get next/previous content from a different tab');
    callback([]);
    readingTab = undefined;
    return;
  }

  // if (addition !== 0 && readingTab !== currentTab.id) {
  //   console.log("Trying to get next/previous content from a different tab");
  //   callback([]);
  //   return;
  // }

  console.log('Current tab:', currentTab);

  if (!matchUsableSites(currentTab.url)) {
    console.log('Not usable site');
    callback([]);
    readingTab = undefined;
    return;
  }

  console.log('Usable site:', currentTab.url);

  const isInjected = await sendSignal(createMessage('test'), 'content', {
    toTab: true,
    tabID: currentTab.id,
  })
    .then(() => true)
    .catch(() => false);

  console.log('isInjected?', isInjected);

  if (!isInjected) {
    console.log('Injecting scripts');

    try {
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['scripts/jquery.min.js'],
      });

      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
          (async () => {
            const src = chrome.runtime.getURL('./scripts/content.js');
            await import(src);
          })();
        },
      });
    } catch (error: any) {
      console.log('Failed to inject', error.message);
      callback([]);
      readingTab = undefined;
      return;
    }

    await waitMillis(100);
  }

  readingTab = currentTab.id;

  console.log('Getting response');
  const response: string[] = await recibeResponse(createMessage('getPage', addition), 'content', {
    toTab: true,
    tabID: readingTab,
  });

  if (!response) {
    console.log('No response');
    callback([]);
    readingTab = undefined;
    return;
  }

  console.log('GetContent', `index:${addition}`, response[0]);
  callback(response);
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
