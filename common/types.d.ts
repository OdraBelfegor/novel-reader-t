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
