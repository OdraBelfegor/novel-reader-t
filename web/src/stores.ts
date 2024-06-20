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
  const { subscribe, set, update } = writable<ContentClient | []>([
    // "Cosmic Phoenix Host: That's enough for me. I hope we can watch you.",
    // "God Tongue: Can't you use the Livestream function?",
    // 'Scarlet King: Ah right, feel free to watch.',
    // 'Erix decided to use the live streamed features to let them watch and the camera seemed adjustable as they saw the Hobgoblin and tempest wolf asking many questions while Erix happily told them.',
    // 'Cosmic Phoenix Host: I wonder what those wolf fur feels like?',
    //
    // {
    //   show: "Shizuka deflated again, she thought her mother really agreed. It doesn't seem to be that easy...",
    //   paragraph: 0,
    //   read: '',
    //   isGroup: false,
    // },
    // {
    //   show: 'Mrs. Hiratsuka rose from her seat, she stood in front of Eiji and said: "Don\'t be nervous. I just wanted to make sure... Aren\'t you guys really dating?".',
    //   paragraph: 1,
    //   read: '',
    //   isGroup: false,
    // },
  ]);

  socket.on('view:load-content', content => {
    console.log('view:load-content', content);
    if (get(currentView) !== 'reader') goToView('reader');
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
    // *Confirm what this does
    if (state.state !== 'INACTIVE' && get(contentStore).length === 0)
      socket.emit('player:request-load-content');
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

export const playerStateStore = createPlayerStateStore();
export const contentStore = createContentStore();
export const contentIndexStore = createContentIndexStore();
