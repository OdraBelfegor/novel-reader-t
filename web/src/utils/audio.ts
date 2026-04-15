import type { AlertType, onAudioEnded } from '@common/types';



type AudioItem = {
  source: AudioBufferSourceNode;
  stopped: boolean;
};

export class AudioController {
  audios: Map<string, AudioItem> = new Map();
  audioContext: AudioContext;
  gainNode: GainNode;

  _volume: number;
  _playbackRate: number;

  currentlyPlaying: Promise<void> = Promise.resolve();

  constructor() {
    // @ts-expect-error
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    this._volume = Number(localStorage.getItem('volumen') || '1');
    this._playbackRate = Number(localStorage.getItem('playback') || '1');

    this.gainNode.gain.value = this._volume;
  }

  async play(hash: string, audio: ArrayBuffer, onEnded: onAudioEnded): Promise<void> {
    console.log('called play audio', typeof audio);

    let buffer: AudioBuffer;
    try {
      buffer = await this.audioContext.decodeAudioData(audio);
    } catch (error) {
      console.error('Failed to decode audio data:', error);
      onEnded('stopped');
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);
    source.playbackRate.value = this._playbackRate;

    this.audios.set(hash, { source, stopped: false });

    let ended: () => void;

    this.currentlyPlaying = new Promise(resolve => ended = resolve);

    source.onended = () => {
      if (!this.audios.has(hash)) return;

      const audioItem = this.audios.get(hash) as AudioItem;
      this.audios.delete(hash);

      if (audioItem.stopped) onEnded('stopped');
      else onEnded('ended');

      ended();
    };

    source.start();
  }

  stop(id: string) {
    if (!this.audios.has(id)) return;
    const audio = this.audios.get(id) as AudioItem;
    audio.stopped = true;
    audio.source.stop();
  }

  stopAll() {
    this.audios.forEach(audioItem => {
      audioItem.stopped = true;
      audioItem.source.stop();
    });
  }

  set volume(volume: number) {
    if (volume > 2 || volume <= 0) return;
    localStorage.setItem('volumen', String(volume));
    this._volume = volume;
    this.gainNode.gain.value = volume;
  }

  set playbackRate(rate: number) {
    if (rate > 2 || rate <= 0) return;
    localStorage.setItem('playback', String(rate));
    this._playbackRate = rate;
    this.audios.forEach(audioItem => (audioItem.source.playbackRate.value = rate));
  }
}

export class AlertEmitter {
  audioContext?: AudioContext;
  gainNode?: GainNode;
  volument: number;

  constructor() {
    this.volument = 1;
  }

  async emit(name: AlertType, callback: () => void) {
    console.log('Called emit alert');
    let url: string;

    if (name === 'ping') {
      url = 'sounds/ping.mp3';
    } else if (name === 'secondary') {
      url = 'sounds/alert_secondary.mp3';
    } else if (name === 'primary') {
      url = `sounds/alert.mp3`;
    } else {
      callback();
      return;
    }

    fetch(url)
      .then(response => response.arrayBuffer())
      .then(buffer => this.play(buffer, callback));
  }

  protected async play(audio: ArrayBuffer, callback: () => void) {
    console.log('called play alert');
    if (!this.audioContext) {
      // @ts-ignore
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }

    const decode = await this.audioContext.decodeAudioData(audio);
    const source = this.audioContext.createBufferSource();
    source.buffer = decode;
    // @ts-ignore
    source.connect(this.gainNode);
    source.start();
    source.onended = () => {
      callback();
    };
  }
}
