import type { SentenceServer, TextProcessorResult } from '@common/types';
import { PlayerAudioControl, type ReasonAudioEnd } from '.';
import textProcessor from '../text-processor';
import TextToSpeech from '../tts-use';

export type onEndedPlayer = (cause: 'stopped' | 'end:forward' | 'end:backward') => void;
export type onPlayPlayer = () => void;
export type onActionPlayer = () => void;

/**
 * TODO: Differentiate between actions and process, ways to stop process and delimit how much an action takes
 *   - Action: 'play', 'stop', 'pause', 'forward', 'backward', 'seek'
 *   - Process: 'play (sentence, download, reproduce audio)'
 */

export class Player {
  protected rawContent: string[];
  protected _content: TextProcessorResult;
  protected currentIndex: number;

  // protected _state: 'IDLE' | 'PLAYING' | 'PAUSED';
  protected _state: PlayerState;
  public onEnded?: onEndedPlayer;
  public onPlay?: onPlayPlayer;
  public onAction?: onActionPlayer;

  protected audio: PlayerAudioControl;
  protected tts: TextToSpeech;

  protected _stopped: boolean;

  /**
   *
   * @param rawContent  Content to be played
   * @param audio Audio control
   * @param tts Text-to-speech to use
   */
  constructor(rawContent: string[], audio: PlayerAudioControl, tts: TextToSpeech) {
    this.rawContent = rawContent;
    this.currentIndex = 0;

    this.audio = audio;
    this.tts = tts;

    this._state = new IdleState(this);

    this._stopped = false;

    this._content = textProcessor(rawContent);
  }

  async play(): Promise<void> {
    await this._state.play();
    this.onAction?.();
  }

  async stop(): Promise<void> {
    await this._state.stop();
    this.onEnded?.('stopped');
  }

  async backward(): Promise<void> {
    await this._state.backward();
    this.onAction?.();
  }

  async forward(): Promise<void> {
    await this._state.forward();
    this.onAction?.();
  }

  async seek(index: number): Promise<void> {
    if (index < 0 || index >= this._content.server.length) return;

    await this.state.seek(index);
    this.onAction?.();
  }

  public stopAudio() {
    return this.audio.stop();
  }

  private async getAudio(sentence: SentenceServer): Promise<void> {
    if (!sentence.isReadable) return;
    if (sentence.audio) return;

    const audio = await this.tts.getAudio(sentence.sentence).catch(() => undefined);

    if (!audio) return;

    sentence.audio = audio;
    console.log('Getting audio for:', [
      {
        index: sentence.index,
        sentence: sentence.sentence,
      },
    ]);
  }

  public async playSentence(index: number): Promise<void> {
    this._state = new PlayingState(this);
    const sentence = this._content.server[index];
    const nextSentence: SentenceServer | undefined =
      index + 1 < this._content.server.length ? this._content.server[index + 1] : undefined;

    if (!sentence.isReadable) {
      this._state = new IdleState(this);
      this.currentIndex++;
      this._state.run();
      return;
    }

    await Promise.all([this.getAudio(sentence), nextSentence && this.getAudio(nextSentence)]);

    if (this._state.name !== 'PLAYING') return;

    if (!sentence.audio) {
      console.log('Cannot play sentence:', [sentence.sentence]);
      await this.audio.alert('ping');
      this._state = new PausedState(this);
      return;
    }

    console.log('Playing sentence:', [sentence.sentence]);
    this.audio.play(sentence.audio).then(reason => this.handleAudioEnd(reason));
  }

  private async handleAudioEnd(reason: ReasonAudioEnd): Promise<void> {
    console.log('Audio ended:', { reason });
    if (this._state.name === 'PAUSED') return;

    this._state = new IdleState(this);

    if (reason === 'ended') {
      this.currentIndex++;
      await this._state.run();
    }
  }

  get state() {
    return this._state;
  }

  set state(state: PlayerState) {
    this._state = state;
  }

  get index() {
    return this.currentIndex;
  }

  set index(index: number) {
    this.currentIndex = index;
  }

  get content() {
    return this._content;
  }

  get serverContent() {
    return this._content.server;
  }

  get clientContent() {
    return this._content.client;
  }

  get stopped() {
    return this._stopped;
  }

  set stopped(stopped: boolean) {
    this._stopped = stopped;
  }

  getRawContent() {
    return this.rawContent;
  }

  setToLastIndex() {
    this.currentIndex = this._content.server.length - 1;
  }
}

abstract class PlayerState {
  constructor(protected player: Player) {}

  abstract run(): Promise<void>;
  abstract play(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract backward(): Promise<void>;
  abstract forward(): Promise<void>;
  abstract seek(index: number): Promise<void>;

  abstract get name(): 'PLAYING' | 'PAUSED' | 'IDLE';

  handleBackward() {
    if (this.player.index - 1 < 0) {
      this.player.onEnded?.('end:backward');
      return;
    }

    let toIndex = this.player.index - 1;

    while (!this.player.serverContent[toIndex].isReadable) {
      toIndex--;
      if (toIndex < 0) {
        this.player.onEnded?.('end:backward');
        return;
      }
    }

    this.player.index = toIndex;
  }
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

    if (index >= this.player.serverContent.length) {
      console.log('All content played');
      this.player.onEnded?.('end:forward');
      return;
    }

    // this.player.state = new PlayingState(this.player);

    await this.player.playSentence(index);

    this.player.onPlay?.();
  }

  async handleAudioEnd(reason: ReasonAudioEnd): Promise<void> {
    console.log('Audio ended:', { reason });
    if (this.player.state.name === 'PAUSED') return;

    this.player.state = new IdleState(this.player);

    if (reason === 'ended') {
      this.player.index++;
      this.player.state.run();
    }
  }

  async play(): Promise<void> {
    if (this.running) return;
    return this.player.state.run();
  }
  async stop(): Promise<void> {
    this.player.stopped = true;
  }
  async backward(): Promise<void> {
    // if(this.running) return;
    this.handleBackward();
  }
  async forward(): Promise<void> {
    // if(this.running) return;
    this.player.index++;
  }
  async seek(index: number): Promise<void> {
    // if(this.running) return;
    this.player.index = index;
  }

  get name(): 'IDLE' | 'PLAYING' | 'PAUSED' {
    return 'IDLE';
  }
}

class PlayingState extends PlayerState {
  async run(): Promise<void> {
    return;
  }
  async play(): Promise<void> {
    const stopAudio = this.player.stopAudio();
    this.player.state = new PausedState(this.player);
    await stopAudio;
  }
  async stop(): Promise<void> {
    await this.player.stopAudio();
    console.log('Player stopped:', this.player.state.name);
  }
  async backward(): Promise<void> {
    await this.player.stopAudio();
    this.handleBackward();
    await this.player.state.run();
  }
  async forward(): Promise<void> {
    await this.player.stopAudio();
    this.player.index++;
    await this.player.state.run();
    this.player.onAction?.();
  }
  async seek(index: number): Promise<void> {
    await this.player.stopAudio();
    this.player.index = index;
    await this.player.state.run();
  }

  get name(): 'IDLE' | 'PLAYING' | 'PAUSED' {
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
    this.handleBackward();
    await this.player.state.run();
  }
  async forward(): Promise<void> {
    this.player.state = new IdleState(this.player);
    this.player.index++;
    await this.player.state.run();
  }
  async seek(index: number): Promise<void> {
    this.player.state = new IdleState(this.player);
    this.player.index = index;
    await this.player.state.run();
  }
  get name(): 'IDLE' | 'PLAYING' | 'PAUSED' {
    return 'PAUSED';
  }
}
