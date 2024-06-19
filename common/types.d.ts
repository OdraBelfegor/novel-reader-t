export type AlertType = 'primary' | 'secondary' | 'ping';

export interface PlayerState {
  state: 'IDLE' | 'PLAYING' | 'PAUSED' | 'INACTIVE';
  loop: boolean;
  loopActive: boolean;
  loopLimit: number | null;
}

export type Content = string[];

export type EndType = 'ended' | 'stopped';

export type onAudioEnded = (reason: EndType) => void;

export type SentenceServer = {
  index: number;
  sentence: string;
  isReadable: boolean;
  audio?: ArrayBuffer;
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

export type TextProcessorResult = {
  server: ContentServer;
  client: ContentClient;
};
