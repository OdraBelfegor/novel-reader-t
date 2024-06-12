import { waitMillis, getInnerText } from '../helpers.js';

export function getCurrentIndex() {
  const bottomFold = $(window).height();
  const headings = $('h1').get();

  if (headings.length <= 0) return 0;

  let index = headings.length - 1;
  // @ts-ignore
  while (index > 0 && headings[index].getBoundingClientRect().y >= bottomFold) index--;
  return index;
}

export async function getText(chapterIndex: number): Promise<string[] | null> {
  if (chapterIndex >= $('h1').length) {
    document.documentElement.scrollTop = document.documentElement.scrollHeight;
    await waitMillis(1500);
  }

  const headings = $('h1').get();

  if (chapterIndex >= headings.length) return null;

  const heading = headings[chapterIndex];
  // @ts-ignore
  document.documentElement.scrollTop = $(heading).offset().top - 80;

  const elems = $('h1, .cha-paragraph p').get();
  let startIndex = elems.indexOf(heading);

  if (startIndex == -1) {
    console.error('FATAL: unexpected');
    return null;
  }

  let endIndex = startIndex + 1;

  while (endIndex < elems.length && elems[endIndex].tagName != 'H1') endIndex++;

  return elems.slice(startIndex, endIndex).map(getInnerText);
}
