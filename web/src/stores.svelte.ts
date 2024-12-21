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

export type ToastType = 'success' | 'info' | 'warning';
type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

function createToastStore(): {
  subscribe: Writable<Toast[]>['subscribe'];
  add(options: {
    message: string;
    type?: 'success' | 'info' | 'warning';
    timeout?: number;
  }): number;
  remove(id: number): void;
} {
  const defaults = {
    type: 'warning',
    timeout: 3000,
  } as const;

  const { subscribe, set, update } = writable<Toast[]>([]);

  return {
    subscribe,
    add(options) {
      const id = Math.floor(Math.random() * 10000);
      const toast: Toast = { id, type: options.type || defaults.type, message: options.message };
      update(toasts => [...toasts, toast]);

      setTimeout(() => this.remove(id), options.timeout || defaults.timeout);

      return id;
    },
    remove(id) {
      update(toasts => toasts.filter(t => t.id !== id));
    },
  };
}

function createThemeStore(): {
  subscribe: Writable<'light' | 'dark'>['subscribe'];
  toggle: () => void;
} {
  const theme: 'light' | 'dark' = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  const { subscribe, set, update } = writable<'light' | 'dark'>(theme);

  subscribe(theme => {
    localStorage.setItem('theme', theme);
    document.documentElement.dataset['theme'] = theme;
  });

  return {
    subscribe,
    toggle: () => update(theme => (theme === 'light' ? 'dark' : 'light')),
  };
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
  changeValues: (params: { volume: number; playback: number }) => void;
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
    changeValues: ({ volume, playback }) => {
      if (volume <= 2 && volume > 0) localStorage.setItem('volumen', String(volume));
      if (playback <= 2 && playback > 0) localStorage.setItem('playback', String(playback));
      set({ volume, playback });
    },
  };
}

export const playerStateStore = createPlayerStateStore();
export const contentStore = createContentStore();
export const contentIndexStore = createContentIndexStore();
export const audioControlStore = createAudioControlStore();
export const themeStore = createThemeStore();
export const toastStore = createToastStore();
