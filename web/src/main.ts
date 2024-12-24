import './app.css';
import './utils/user-config';
import * as Views from './views';
import Toast from './lib/Toast.svelte';
import { currentView, toastStore } from './stores.svelte';
import { socket } from './socket';
import { AudioEmitter, AlertEmitter } from './utils/audio';
import { audioControlStore } from '@/stores.svelte';
import screenLock from './screen-lock';
import { mount, unmount } from 'svelte';

const audioEmitter = new AudioEmitter();
const alertEmitter = new AlertEmitter();

audioControlStore.subscribe(({ volume, playback }) => {
  audioEmitter.setVolume(volume);
  audioEmitter.setPlaybackRate(playback);
});

const toast = mount(Toast, {
  target: document.body,
});

let app = mount(Views.Home, {
  target: document.getElementById('app')!,
});

currentView.subscribe((view: string) => {
  unmount(app);
  switch (view) {
    case 'home':
      app = mount(Views.Home, {
        target: document.getElementById('app')!,
      });
      break;
    case 'writer':
      app = mount(Views.Writer, {
        target: document.getElementById('app')!,
      });
      break;
    case 'reader':
      app = mount(Views.Reader, {
        target: document.getElementById('app')!,
      });
      break;
    case 'options':
      app = mount(Views.Options, {
        target: document.getElementById('app')!,
      });
      break;
  }
});

socket.on('disconnect', () => {
  audioEmitter.stop();
});

socket.on('alert:show', message => {
  toastStore.add({
    message,
    type: 'info',
  });
});

socket.on('audio:play', async (audio, ack) => {
  await audioEmitter.play(audio, type => {
    console.log('Audio ended', { type });
    if (socket.connected) socket.emit('audio:ended', type);
  });

  ack();
});

socket.on('audio:stop', ack => {
  console.log('Audio ordered to stop');
  audioEmitter.stop();
  setTimeout(ack, 10);
});

socket.on('alert:play', (name, ack) => {
  console.log('Ordered to play alert');
  alertEmitter.emit(name, ack);
});

socket.on('view:update-state', state => {
  console.log('view:update-state', state);
});

screenLock.requestWakeLock();
socket.connect();

document.addEventListener('visibilitychange', ev => {
  if (document.visibilityState === 'visible') {
    screenLock.requestWakeLock();
  }
});

if (import.meta.env.DEV) {
  toastStore.add({
    message: 'this is a toast',
    type: 'success',
    timeout: 500000,
  });
}

export default app;
