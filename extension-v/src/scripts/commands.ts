import { getCurrentTab, matchUsableSites, waitMillis } from './helpers.js';
import { setListener, sendSignal, createMessage, recibeResponse } from './message-passing.js';

let readingTab: number | undefined;

/**
 *  Setup the page and get the current content
 */
export async function getCurrentContent(callback: (...args: any) => void) {
  readingTab = undefined;

  const currentTab: chrome.tabs.Tab = await getCurrentTab();

  if (!currentTab || !currentTab.id || !currentTab.url) {
    console.log('No current tab');
    callback([]);
    return;
  }

  console.log('Current tab:', currentTab);

  if (!matchUsableSites(currentTab.url)) {
    console.log('Not usable site');
    callback([]);
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
        files: ['/assets/jquery.min.js'],
      });

      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
          (async () => {
            const src = chrome.runtime.getURL('/content.js');
            await import(src);
          })();
        },
      });
    } catch (error: any) {
      console.log('Failed to inject', error.message);
      callback([]);
      return;
    }

    await waitMillis(100);
  }

  console.log('Getting response');

  callback(await getContent(0, currentTab.id));

  readingTab = currentTab.id;
}

export function stopReading() {
  readingTab = undefined;
}

export async function getPage(addition: number, callback: (content: string[] | []) => void) {
  if (!readingTab) {
    console.log('No reading tab');
    callback([]);
    // stopReading();
    return;
  }

  const tab = await chrome.tabs.get(readingTab);
  if (!tab || !tab.id) {
    console.log('No tab with reading tab id');
    callback([]);
    return;
  }

  try {
    callback((await getContent(addition, tab.id)) || []);
  } catch (error: any) {
    console.log(`Error getting page with addition ${addition}: ${error.message}`);
    callback([]);
  }
}

async function getContent(addition: number, tabID: number): Promise<string[] | undefined> {
  const response: string[] = await recibeResponse(createMessage('getPage', addition), 'content', {
    toTab: true,
    tabID: tabID,
  });

  if (!response) {
    console.log('No response');
    return undefined;
  }

  console.log(`GetContent with addition: ${addition}`, response[0]);
  return response;
}
