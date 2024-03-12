import type { AlertType, onAudioEnded } from '@common/types';

export class AudioEmitter {
  protected audioContext?: AudioContext;
  protected gainNode?: GainNode;
  protected audioSourceNode?: AudioBufferSourceNode;

  protected currentOnEnded?: onAudioEnded;

  async play(audio: ArrayBuffer, onEnded: onAudioEnded) {
    if (!this.audioContext) {
      // @ts-ignore
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }

    if (this.audioSourceNode) this.audioSourceNode.stop();

    const buffer = await this.audioContext?.decodeAudioData(audio);

    this.audioSourceNode = this.audioContext.createBufferSource();
    this.audioSourceNode.buffer = buffer;
    // @ts-ignore
    this.audioSourceNode.connect(this.gainNode);

    this.currentOnEnded = onEnded;

    this.audioSourceNode.onended = () => {
      this.audioSourceNode = undefined;
      if (this.currentOnEnded) {
        this.currentOnEnded('ended');
      }
      this.currentOnEnded = undefined;
    };

    this.audioSourceNode.start();
  }

  stop() {
    if (!this.audioSourceNode) return;
    this.audioSourceNode.onended = () => {
      this.audioSourceNode = undefined;
      if (this.currentOnEnded) {
        this.currentOnEnded('stopped');
      }
      this.currentOnEnded = undefined;
    };

    this.audioSourceNode.stop();
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
