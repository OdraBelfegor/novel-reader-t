import type { AlertType, onAudioEnded } from '@common/types';

export class AudioEmitter {
  protected audioContext?: AudioContext;
  protected gainNode?: GainNode;
  protected audioSourceNode?: AudioBufferSourceNode;
  stopped: boolean = false;
  protected volume?: number;
  protected playbackRate?: number;

  async play(audio: ArrayBuffer, onEnded: onAudioEnded) {
    if (!this.audioContext || !this.gainNode) {
      // @ts-ignore
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }

    if (!this.volume || !this.playbackRate) {
      this.volume = Number(localStorage.getItem('volumen') || '1');
      this.playbackRate = Number(localStorage.getItem('playback') || '1');
    }

    if (this.audioSourceNode) this.audioSourceNode.stop();

    const buffer = await this.audioContext?.decodeAudioData(audio);

    this.audioSourceNode = this.audioContext.createBufferSource();
    this.audioSourceNode.buffer = buffer;
    this.audioSourceNode.connect(this.gainNode);

    this.gainNode.gain.value = this.volume;
    this.audioSourceNode.playbackRate.value = this.playbackRate;

    this.audioSourceNode.onended = event => {
      this.audioSourceNode = undefined;
      onEnded(this.stopped ? 'stopped' : 'ended');
    };

    this.stopped = false;
    this.audioSourceNode.start();
  }

  stop() {
    if (!this.audioSourceNode) return;
    this.stopped = true;
    this.audioSourceNode.stop();
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.gainNode) this.gainNode.gain.value = volume;
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    if (this.audioSourceNode) this.audioSourceNode.playbackRate.value = rate;
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
