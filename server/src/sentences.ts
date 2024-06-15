const rawContent = [
  "The passage in question was on the sixth floor, near Ravenclaw tower, hidden behind the tapestry of Magnus the Treacherous, which would only open if you waved your wand exactly the opposite of the way Magnus was swinging in the tapestry. This shortcut seemed to be one of the few known in the castle, in fact the passage was so dirty and abandoned that I think I was the first one to find it in years, and that's with the help of my magical vision.",
  "I didn't know what to do.",
  'But now, he knew he might visit a similar world like Naruto where a world where peace was an illusion.',
  'Chapter 97: Battle Balloons.',
  'According to the marching speed of the orcs, this army would reach the territory of Adonis in about two days.',
];

function processContent(content: string[]): any {
  let paragraphCount = 0;
  let sentenceCount = 0;
  let result1 = new Array<any>();
  let result2 = new Array<any>();
  content.map(paragraph => {
    result1.push({
      id: paragraphCount,
      sentences: new Array<any>(),
    });

    let sentenceInParagraphCount = 0;
    splitSentence(paragraph).map(sentence => {
      result1[paragraphCount].sentences.push({
        id: sentenceCount,
        inParagraphId: sentenceInParagraphCount,
        textShow: sentence,
        textRead: sentence,
        isReadable: true,
      });

      result2.push({
        sentence: sentence,
        index: sentenceInParagraphCount,
        audio: null,
      });

      sentenceInParagraphCount++;
      sentenceCount++;
    });

    paragraphCount++;
  });

  return {
    toClient: result1,
    toServer: result2,
  };

  function splitSentence(paragraph: string) {
    return paragraph.split('. ');
  }
}

const content: Paragraph[] = [
  {
    id: 0,
    sentences: [
      {
        id: 0,
        inParagraphId: 0,
        textShow:
          'The passage in question was on the sixth floor, near Ravenclaw tower, hidden behind the tapestry of Magnus the Treacherous, which would only open if you waved your wand exactly the opposite of the way Magnus was swinging in the tapestry. ',
        textRead:
          'The passage in question was on the sixth floor, near Ravenclaw tower, hidden behind the tapestry of Magnus the Treacherous, which would only open if you waved your wand exactly the opposite of the way Magnus was swinging in the tapestry. ',
        isReadable: true,
      },
      {
        id: 1,
        inParagraphId: 1,
        textShow:
          "This shortcut seemed to be one of the few known in the castle, in fact the passage was so dirty and abandoned that I think I was the first one to find it in years, and that's with the help of my magical vision.",
        textRead:
          "This shortcut seemed to be one of the few known in the castle, in fact the passage was so dirty and abandoned that I think I was the first one to find it in years, and that's with the help of my magical vision.",
        isReadable: true,
      },
    ],
  },
  {
    id: 1,
    sentences: [
      {
        id: 2,
        inParagraphId: 0,
        textShow: "I didn't know what to do.",
        textRead: "I didn't know what to do.",
        isReadable: true,
      },
    ],
  },
];

const contentServer = [
  {
    sentence:
      'The passage in question was on the sixth floor, near Ravenclaw tower, hidden behind the tapestry of Magnus the Treacherous, which would only open if you waved your wand exactly the opposite of the way Magnus was swinging in the tapestry.',
    index: 0,
    audio: null,
  },
  {
    sentence:
      "This shortcut seemed to be one of the few known in the castle, in fact the passage was so dirty and abandoned that I think I was the first one to find it in years, and that's with the help of my magical vision.",
    index: 1,
    audio: null,
  },
  {
    sentence: "I didn't know what to do.",
    index: 2,
    audio: null,
  },
];

console.log(JSON.stringify(content));
console.log(contentServer);

type ContentServer = {
  sentence: string;
  index: number;
  audio?: string;
};

type Sentence = {
  id: number;
  paragraphId: number;
  inParagraphId: number;
  textShow: string;
  textRead: string;
  isReadable: boolean;
};

type Paragraph = {
  id: number;
  sentences: {
    id: number;
    inParagraphId: number;
    textShow: string;
    textRead: string;
    isReadable: boolean;
  }[];
};
