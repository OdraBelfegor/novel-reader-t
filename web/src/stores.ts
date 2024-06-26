import { writable, get, type Writable } from 'svelte/store';
import type { PlayerState, Content, ContentClient } from '@common/types';
import { socket } from './socket';

type View = 'home' | 'writer' | 'reader' | 'options';

export const currentView = writable<View>('home');
const viewHistory: View[] = [];

export function goToView(view: View): void {
  console.log('goToView', view);
  viewHistory.push(get(currentView));
  currentView.set(view);
}

export function toPreviousView(): void {
  currentView.set(viewHistory.pop() || 'home');
  //   currentView.set(viewHistory[viewHistory.length - 1]);
  //   viewHistory.pop();
}

function createContentStore(): {
  subscribe: Writable<ContentClient | []>['subscribe'];
} {
  const { subscribe, set, update } = writable<ContentClient | []>([]);

  socket.on('view:load-content', content => {
    console.log('view:load-content', content);
    if (content.length !== 0 && get(currentView) !== 'reader') goToView('reader');
    set(content);
  });

  return {
    subscribe,
  };
}

function createPlayerStateStore(): {
  subscribe: Writable<PlayerState>['subscribe'];
} {
  const { subscribe, set, update } = writable<PlayerState>({
    state: 'INACTIVE',
    loop: false,
    loopActive: false,
    loopLimit: null,
    loopCounter: null,
  });

  socket.on('view:update-state', state => {
    set(state);
  });

  return {
    subscribe,
  };
}

function createContentIndexStore(): {
  subscribe: Writable<number>['subscribe'];
} {
  const { subscribe, set, update } = writable<number>(0);

  socket.on('view:highlight-sentence', index => {
    set(index);
  });

  return {
    subscribe,
  };
}

function createAudioControlStore(): {
  set: Writable<{ volume: number; playback: number }>['set'];
  update: Writable<{ volume: number; playback: number }>['update'];
  subscribe: Writable<{ volume: number; playback: number }>['subscribe'];
} {
  const { subscribe, set, update } = writable<{ volume: number; playback: number }>({
    volume: 1,
    playback: 1,
  });

  const volume = Number(localStorage.getItem('volumen') || '1');
  const playback = Number(localStorage.getItem('playback') || '1');

  set({ volume, playback });

  return {
    set,
    subscribe,
    update,
  };
}

export const playerStateStore = createPlayerStateStore();
export const contentStore = createContentStore();
export const contentIndexStore = createContentIndexStore();
export const audioControlStore = createAudioControlStore();
