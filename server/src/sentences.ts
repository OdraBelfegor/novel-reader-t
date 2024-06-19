import textProcessor from './text-processor';

const content = [
  '"What is Project: X, sir?" A woman\'s voice! I have heard her voice once before... Ah! That day at the hospital...',
  '"Project: X is him," the older man pointed his finger at me. "Have you ever heard of a perfect human, Doc. Hazel?".',
  '"Perfect human... What does Subject 0x have to do with it?".',
];

console.log(JSON.stringify(textProcessor(content), null, 2));
