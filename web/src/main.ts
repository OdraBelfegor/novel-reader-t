import './app.css';
import App from './App.svelte';
import './utils/user-config';
import { socket } from './socket';
import { AudioEmitter, AlertEmitter } from './utils/audio';

const audioEmitter = new AudioEmitter();
const alertEmitter = new AlertEmitter();

const app = new App({
  target: document.getElementById('app') || document.body,
});

socket.on('connect', () => {
  document.body.style.border = '5px ridge var(--successColor)';

  setTimeout(() => {
    document.body.style.border = '5px ridge transparent';
  }, 500);
});

socket.on('disconnect', () => {
  document.body.style.border = '5px ridge var(--alertColor)';
});

socket.on('alert:show', message => {
  setTimeout(() => {
    alert(message);
  }, 1);
});

socket.on('audio:play', async (audio, ack) => {
  await audioEmitter.play(audio, type => {
    console.log('Audio ended', type);
    socket.emit('audio:ended', type);
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

socket.emit('player:request-state');

export default app;
