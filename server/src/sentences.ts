import { paragraphToSentences } from './text-processor';

const paragraph =
  "'Problems, problems and more problems, this situation we find ourselves in is complete garbage, how the hell could it happen, one moment we were celebrating the great victory that had happened against the catholic league and the next moment we showed up in this disgusting place they call the seven kingdoms.'";

console.log(paragraphToSentences(paragraph));
// console.log(paragraph.split(/(?<=, )/g));
