import textProcessor from './text-processor';

const content = [
  '"...Huff...Huff...This...isn\'t over, tree...huff..." Leo can feel his sweat rolling across his forehead and cheeks.',
  '"Project: X is him," the older man pointed his finger at me. "Have you ever heard of a perfect human, Doc. Hazel?".',
  '"Perfect human... What does Subject 0x have to do with it?".',
];

// console.log(JSON.stringify(textProcessor(content), null, 2));

const edit = content[0].replace(/\.\.\.\w/g, match => ` ${match.substring(match.length - 1)}`);

console.log(edit);
