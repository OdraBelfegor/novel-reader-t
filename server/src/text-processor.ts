import nlp from 'compromise';
import type {
  ContentServer,
  ContentClient,
  ParagraphClient,
  SentenceClient,
  SentenceServer,
  TextProcessorResult,
} from '@common/types';

export default function textProcessor(raw: string[]): TextProcessorResult {
  const rawFiltered = raw.filter((paragraph): boolean => {
    if (paragraph === null || paragraph === undefined) return false;
    if (paragraph.length === 0) return false;
    if (paragraph.replace(/[\s]/gi, '') === '') return false;
    return true;
  });

  let paragraphCount = 0;
  let sentenceCount = 0;

  // Array of sentences to player
  let server: ContentServer = new Array<SentenceServer>();
  // Array of paragraphs to show
  let client: ContentClient = new Array<ParagraphClient>();

  // For each paragraph
  rawFiltered.forEach(paragraph => {
    client.push({
      id: paragraphCount,
      sentences: new Array<SentenceClient>(),
    });

    // For each sentence
    let sentenceInParagraphCount = 0;
    paragraphToSentences(paragraph).forEach(sentence => {
      client[paragraphCount].sentences.push({
        id: sentenceCount,
        paragraphId: paragraphCount,
        inParagraphId: sentenceInParagraphCount,
        sentence: sentence,
      });

      server.push({
        index: sentenceCount,
        sentence: textToReadable(sentence),
        isReadable: isReadable(sentence),
      });

      sentenceInParagraphCount++;
      sentenceCount++;
    });

    paragraphCount++;
  });

  return {
    server,
    client,
  };
}

/**
 * Transform paragraph to array of sentences
 *
 */
function paragraphToSentences(paragraph: string): string[] {
  //   const sentences = paragraph.match(/[^\.\!\?\;\)\]]+[\.\!\?\;\)\]\"]+/gi);
  //   return sentences || [paragraph];
  if (paragraph.length <= 120) return [paragraph];
  return nlp(paragraph).sentences().out('array');
}

/**
 * Remove all non readable characters and replace with readable if possible
 *
 */
function textToReadable(text: string): string {
  let edit = text.trim();
  // Replace white spaces with spaces
  edit = edit.replace(/\s+/gi, ' ');
  // Check [] because the TTS doesn't read them
  // It can replace certain characters tha are used as brackets to remark the text
  edit = edit.replace(/[\[«「『\<{]/gi, '(');
  edit = edit.replace(/[\]»」』\>}]/gi, ')');
  edit = edit.replace(/[\—]/gi, '-');
  // More than three letters or certain symbols in a row are corrected to only three
  edit = edit.replace(/([\w\.\*\-\—])\1{3,}/g, match => match[0].repeat(3));

  // Remove dots that don't make sense (they ruin TTS)
  edit = edit.replace(/\.\.\.\w/g, match => `${match.substring(match.length - 1)}`);
  // Remove simbols that don't make sense
  edit = edit.replace(/[^\w\(\)\/ \,\.\¡\!\¿\?\-\—\_\#\$\%\&\=\+\~\"\']/gi, ' ');
  edit = edit.replace(/\~+/gi, '...');
  // Remove extra spaces
  edit = edit.replace(/\s+/gi, ' ');
  // Trim
  edit = edit.trim();
  return edit;
}

/**
 * Determine if text is readable
 *
 */
function isReadable(text: string): boolean {
  if (text.length === 0) return false;
  if (text === '...') return false;
  // Large sequences of numbers cant be read
  // if (text.length > 1 && text.replace(/[^a-zA-Z]/gi, '').length < 10) return true;
  if (text.length > 1 && text.replace(/[^a-zA-Z0-9]/gi, '').length > 0) return true;
  return false;
}
