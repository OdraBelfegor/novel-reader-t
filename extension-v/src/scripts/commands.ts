import { getCurrentTab, matchUsableSites, waitMillis } from './helpers.js';
import { setListener, sendSignal, createMessage, recibeResponse } from './message-passing.js';
let readingTab: number | undefined;

/**
 *  Setup the page and get the current content
 */
async function getCurrentContent(callback: (...args: any) => void) {
  readingTab = undefined;

  const currentTab = await getCurrentTab();

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
      return;
    }

    await waitMillis(100);
  }

  console.log('Getting response');
  const response: string[] = await recibeResponse(createMessage('getCurrentPage'), 'content', {
    toTab: true,
    tabID: currentTab.id,
  });

  if (!response) {
    console.log('No response');
    callback([]);
    return;
  }

  console.log('GetContent index:0', response[0]);
  callback(response);

  readingTab = currentTab.id;
}

function stopReading() {
  readingTab = undefined;
}

async function getPage(addition: number, callback: (...args: any) => void) {
  if (!readingTab) {
    console.log('No reading tab');
    callback([]);
    return;
  }

  const tab = chrome.tabs.get(readingTab);
  if (!tab) {
    console.log('No tab with reading tab id');
    callback([]);
    return;
  }

  try {
    const response: string[] = await recibeResponse(createMessage('getPage', addition), 'content', {
      toTab: true,
      tabID: readingTab,
    });

    if (!response) {
      console.log('No response');
      callback([]);
      return;
    }

    console.log(`GetContent with addition: ${addition}`, response[0]);
    callback(response);
    return;
  } catch (error: any) {
    console.log(`Error getting page with addition ${addition}: ${error.message}`);
    callback([]);
    return;
  }
}
