import type { PlayerState, AlertType, Content, EndType } from './types';

export interface ClientToServerEvents {
  'player:read-this': (contentToRead: string[]) => void;
  'player:play': () => void;
  'player:stop': () => void;
  'player:forward': () => void;
  'player:backward': () => void;
  'player:seek': (index: number) => void;
  'player:toggle-loop': () => void;
  'player:toggle-loop-limit': (chapters?: number) => void;
  'player:set-loop-limit': (chapters: number) => void;
  'player:remove-loop-limit': () => void;
  'player:request-state': () => void;
  'player:request-load-content': () => void;
  'audio:ended': (reason: EndType) => void;
}

export interface ServerToClientEvents {
  'audio:play': (audio: ArrayBuffer, ack: (...args: any[]) => void) => void;
  'audio:stop': (ack: (...args: any[]) => void) => void;
  'alert:play': (name: AlertType, ack: (...args: any[]) => void) => void;
  'alert:show': (message: string) => void;
  'view:update-state': (state: PlayerState) => void;
  'view:load-content': (content: Content) => void;
  'view:highlight-sentence': (index: number) => void;
}

export interface ProviderServerToClientEvents {
  'get-content': (mod: number, ack: (rawContent: string[]) => void) => void;
  'get-index': (ack: (index: number) => void) => void;
  'get-content-at': (index: number, ack: (rawContent: string[]) => void) => void;
  print: (message: string) => void;
}
export interface ProviderClientToServerEvents {}
