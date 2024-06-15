import nlp from 'compromise';

export default function textProcessor(raw: string[]): {
  server: ContentServer;
  client: ContentClient;
} {
  let paragraphCount = 0;
  let sentenceCount = 0;

  // Array of sentences to player
  let server: ContentServer = new Array<SentenceServer>();
  // Array of paragraphs to show
  let client: ContentClient = new Array<ParagraphClient>();

  raw.map(paragraph => {
    client.push({
      id: paragraphCount,
      sentences: new Array<SentenceClient>(),
    });

    let sentenceInParagraphCount = 0;
    paragraphToSentences(paragraph).map(sentence => {
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
  // * test
  return nlp(paragraph).sentences().out('array');
}

/**
 * Remove all non readable characters and replace with readable if possible
 *
 */
function textToReadable(text: string): string {
  let edit = text.trim();
  // Clear white spaces
  edit = edit.replace(/\s/gi, ' ');
  // Check [] because the TTS doesn't read them
  // It can replace certain characters tha are used as brackets to remark the text
  edit = edit.replace(/[\[«「『\<]/gi, '(');
  edit = edit.replace(/[\]»」』\>]/gi, ')');
  edit = edit.replace(/[\—]/gi, '-');
  // More than three letters or certain symbols are corrected to only three
  edit = edit.replace(/([\w\.\*\-\—])\1{3,}/g, match => match[0].repeat(3));

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
  if (text === '...') return true;
  if (text.length > 1 && text.replace(/[^a-zA-Z0-9]/gi, '').length > 0) return true;
  return false;
}

export type SentenceServer = {
  index: number;
  sentence: string;
  isReadable: boolean;
  audio?: string;
};

export type ContentServer = SentenceServer[];

export type SentenceClient = {
  id: number;
  paragraphId: number;
  inParagraphId: number;
  sentence: string;
};

export type ParagraphClient = { id: number; sentences: SentenceClient[] };

export type ContentClient = ParagraphClient[];

const rawContent = [
  "The passage in question was on the sixth floor, near Ravenclaw tower, hidden behind the tapestry of Magnus the Treacherous, which would only open if you waved your wand exactly the opposite of the way Magnus was swinging in the tapestry. This shortcut seemed to be one of the few known in the castle, in fact the passage was so dirty and abandoned that I think I was the first one to find it in years, and that's with the help of my magical vision.",
  "I didn't know what to do.",
];

console.log(textProcessor(rawContent));
