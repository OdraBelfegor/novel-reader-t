import type { SentenceServer, TextProcessorResult } from '@common/types';
import TextToSpeech from '../tts-use';
import { ContentControl, Audio, type ReasonAudioEnd } from '.';
import { EventEmitter } from 'events';
import { waitAll } from '../extras';

export type onEndedPlayer = (cause: 'stopped' | 'end:forward' | 'end:backward') => void;
export type onPlayPlayer = () => void;
export type onActionPlayer = () => void;

type PlayerEvents = {
  ended: Parameters<onEndedPlayer>;
  play: Parameters<onPlayPlayer>;
  action: Parameters<onActionPlayer>;
};

// States: playing, paused
/**
 * TODO: Differentiate between actions and process, ways to stop process and delimit how much an action takes
 *   - Action: 'play', 'stop', 'pause', 'forward', 'backward', 'seek'
 *   - Process: 'play (sentence, download, reproduce audio)'
 */

export class Player {
  protected _content: ContentControl;
  // protected _state: 'IDLE' | 'PLAYING' | 'PAUSED';
  protected _state: PlayerState;
  protected tts: TextToSpeech;
  public stopped: boolean;

  protected _currentlyPlaying: Promise<void> = Promise.resolve();

  public eventEmitter = new EventEmitter<PlayerEvents>();

  /**
   *
   * @param rawContent  Content to be played
   * @param audio Audio control
   * @param tts Text-to-speech to use
   */
  constructor(rawContent: string[], tts: TextToSpeech) {
    this.tts = tts;

    this._state = new IdleState(this);

    this.stopped = false;

    this._content = new ContentControl(rawContent);

  }

  async run(): Promise<void> {
    await this._state.run();
  }

  async play(): Promise<void> {
    await this._state.play();
    this.emit('action');
  }

  async stop(): Promise<void> {
    await this._state.stop();
    this.emit('ended', 'stopped');
  }

  async backward(): Promise<void> {
    await this._state.backward();
    this.emit('action');
  }

  async forward(): Promise<void> {
    await this._state.forward();
    this.emit('action');
  }

  async seek(index: number): Promise<void> {
    if (index < 0 || index >= this._content.serverContent.length) return;

    await this._state.seek(index);
    this.emit('action');
  }

  public stopAudio() {
    // return this.audio.stop();
    return Audio.stopCurrent();
  }

  private async getAudio(sentence: SentenceServer): Promise<void> {
    if (!sentence.isReadable || sentence.audio.buffer) return;

    const audio = await this.tts.getAudio(sentence.sentence).catch(error => {
      console.log('Error getting audio:', error);
      return undefined;
    });

    if (!audio) return;

    sentence.audio.buffer = audio;
    console.log('Got audio for:', [
      {
        index: sentence.index,
        sentence: sentence.sentence,
      },
    ]);
  }

  private async getNextAudio(index: number): Promise<void> {
    if (index + 1 >= this._content.serverContent.length) return;
    await this.getAudio(this._content.serverContent[index + 1]);
  }

  public async playSentence(index: number): Promise<void> {
    this.state = new PlayingState(this);
    const sentence = this._content.currentSentence;

    if (!sentence.isReadable) {
      this.state = new IdleState(this);
      const ended = this._content.next();
      if (ended)
        this.emit('ended', 'end:forward');
      else
        this._state.run();

      return;
    }

    const currentAudio = this.getAudio(sentence);
    const nextAudio = this.getNextAudio(index);
    await currentAudio;

    if (this._state.name !== 'PLAYING') return;

    if (!sentence.audio) {
      console.log('Cannot play sentence:', [sentence.sentence]);
      // await this.audio.alert('ping');
      await Audio.alert('ping');
      this.state = new PausedState(this);
      return;
    }

    console.log('Playing sentence:', [sentence.sentence]);

    this._currentlyPlaying = waitAll([
      // this.audio.play(sentence.audio).then(this.handleAudioEnd.bind(this)),
      sentence.audio.play().then(this.handleAudioEnd.bind(this)),
      nextAudio,
    ]);
  }

  private async handleAudioEnd(reason: ReasonAudioEnd): Promise<void> {
    console.log('Audio ended:', { reason });
    // if (this._state.name === 'PAUSED') return;

    if (reason === 'disconnected' || reason === 'no-connection') {
      this.state = new PausedState(this);
      this.emit('action');
      return
    }

    this.state = new IdleState(this);

    if (reason === 'ended') {
      const ended = this._content.next();
      console.log(['Ended:', ended]);

      if (ended) {
        console.log('All content played');
        this.emit('ended', 'end:forward');
        return;
      }

      await this._state.run();
    }
  }

  get currentlyPlaying() {
    return this._currentlyPlaying;


  }

  get state() {
    return this._state;
  }

  set state(state: PlayerState) {
    console.log([`Set state: ${state.name}`]);
    this._state = state;
    // this.emit('action');
  }

  get index() {
    return this._content.currentIndex;
  }

  set index(index: number) {
    this._content.seek(index);
  }

  get content() {
    return this._content;
  }

  get serverContent() {
    return this._content.serverContent;
  }

  get clientContent() {
    return this._content.clientContent;
  }

  get on() {
    return this.eventEmitter.on.bind(this);
  }

  get emit() {
    return this.eventEmitter.emit.bind(this);
  }

  getRawContent() {
    return this._content.rawContent;
  }
}

type PlayerStateName = 'PLAYING' | 'PAUSED' | 'IDLE';

abstract class PlayerState {
  constructor(protected player: Player) { }

  abstract run(): Promise<void>;
  abstract play(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract backward(): Promise<void>;
  abstract forward(): Promise<void>;
  abstract seek(index: number): Promise<void>;
  abstract get name(): PlayerStateName;
}

class IdleState extends PlayerState {
  running: boolean;
  constructor(player: Player) {
    super(player);
    this.running = false;
  }

  async run(): Promise<void> {
    // TODO: Make possible to cancel fetch audio
    if (this.running) return;
    this.running = true;

    if (this.player.stopped) {
      console.log('Cannot play, already stopped');
      return;
    }

    const index = this.player.index;

    await this.player.playSentence(index);

    this.player.emit('play');
  }

  async play(): Promise<void> {
    if (!this.running) return this.player.state.run();
    this.player.state = new PausedState(this.player);
  }
  async stop(): Promise<void> {
    this.player.stopped = true;
  }
  async backward(): Promise<void> {
    // if(this.running) return;
    const ended = this.player.content.previous();
    if (ended) {
      this.player.emit('ended', 'end:backward');
      return;
    }
  }
  async forward(): Promise<void> {
    // if(this.running) return;
    this.player.content.next();
  }
  async seek(index: number): Promise<void> {
    // if(this.running) return;
    this.player.index = index;
  }

  get name(): PlayerStateName {
    return 'IDLE';
  }
}

class PlayingState extends PlayerState {
  async run(): Promise<void> {
    return;
  }
  async play(): Promise<void> {
    // const stopAudio = this.player.stopAudio();
    // this.player.state = new PausedState(this.player);
    // await stopAudio;
    await this.player.stopAudio();
    await this.player.currentlyPlaying;
    this.player.state = new PausedState(this.player);
  }
  async stop(): Promise<void> {
    await this.player.stopAudio();
    await this.player.currentlyPlaying;
    console.log('Player stopped:', this.player.state.name);
  }
  async backward(): Promise<void> {
    await this.player.stopAudio();
    await this.player.currentlyPlaying;
    const ended = this.player.content.previous();
    if (ended) {
      this.player.emit('ended', 'end:backward');
    }
    await this.player.state.run();
  }
  async forward(): Promise<void> {
    await this.player.stopAudio();
    await this.player.currentlyPlaying;
    const ended = this.player.content.next();
    if (ended) {
      this.player.emit('ended', 'end:forward');
      return;
    }
    await this.player.state.run();
  }
  async seek(index: number): Promise<void> {
    await this.player.stopAudio();
    this.player.index = index;
    await this.player.currentlyPlaying;
    await this.player.state.run();
  }

  get name(): PlayerStateName {
    return 'PLAYING';
  }
}

class PausedState extends PlayerState {
  async run(): Promise<void> {
    return;
  }
  async play(): Promise<void> {
    this.player.state = new IdleState(this.player);
    await this.player.state.run();
  }
  async stop(): Promise<void> {
    this.player.stopped = true;
    console.log('Player stopped:', this.player.state.name);
  }
  async backward(): Promise<void> {
    this.player.state = new IdleState(this.player);
    const ended = this.player.content.previous();
    if (ended) {
      this.player.emit('ended', 'end:backward');
      return;
    }
    await this.player.state.run();
  }
  async forward(): Promise<void> {
    this.player.state = new IdleState(this.player);
    const ended = this.player.content.next();
    if (ended) {
      this.player.emit('ended', 'end:forward');
      return;
    }
    await this.player.state.run();
  }
  async seek(index: number): Promise<void> {
    this.player.state = new IdleState(this.player);
    this.player.index = index;
    await this.player.state.run();
  }
  get name(): PlayerStateName {
    return 'PAUSED';
  }
}


