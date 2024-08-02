import { usableSites } from '../background.js';

export function waitMillis(millis: number) {
  return new Promise(function (fulfill) {
    setTimeout(fulfill, millis);
  });
}

export function getInnerText(elem: HTMLElement) {
  const text = elem.innerText;
  return text ? text.trim() : '';
}
export function matchUsableSites(url: string): boolean {
  const toMatchSite = new URL(url);
  for (const site of usableSites) {
    if (toMatchSite.hostname === site.hostname && site.usablePath.test(toMatchSite.pathname)) {
      return true;
    }
  }
  return false;
}
export async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    highlighted: true,
    windowType: 'normal',
  });
  return tab;
}
