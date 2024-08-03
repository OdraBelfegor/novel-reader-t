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
  protected content: TextProcessorResult;
  protected currentIndex: number;

  protected state: 'IDLE' | 'PLAYING' | 'PAUSED';
  public onEnded?: onEndedPlayer;
  public onPlay?: onPlayPlayer;
  public onAction?: onActionPlayer;

  protected audio: PlayerAudioControl;
  protected tts: TextToSpeech;

  protected stopped: boolean;

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

    this.state = 'IDLE';

    this.stopped = false;

    this.content = textProcessor(rawContent);
  }

  async run(): Promise<void> {
    // TODO: Make possible to cancel fetch audio
    if (this.currentIndex >= this.content.server.length) {
      console.log('All content played');
      this.onEnded?.('end:forward');
      return;
    }

    if (this.state !== 'IDLE' || this.stopped) {
      console.log(`Cannot play. Current state: ${this.state} | Stopped: ${this.stopped}`);
      return;
    }

    this.state = 'PLAYING';

    const sentence = this.content.server[this.currentIndex];

    if (sentence.isReadable) {
      await Promise.all([this.getAudio(sentence), this.getNextAudio()]);

      if (sentence.audio) {
        console.log('Playing sentence:', [sentence.sentence]);
        this.audio.asynchronousPlay(sentence.audio).then(reason => this.handleAudioEnd(reason));
      } else {
        // Todo: Handle need of audio. Pause the player?
        console.log('Cannot play sentence:', [sentence.sentence]);
        this.audio.alert('ping');
        this.state = 'PAUSED';
      }
    } else {
      this.state = 'IDLE';
      this.currentIndex++;

      this.run();
    }

    this.onPlay?.();
  }

  private async handleAudioEnd(reason: ReasonAudioEnd): Promise<void> {
    console.log('Audio ended, event:', { reason });
    if (this.state === 'PAUSED') return;
    this.state = 'IDLE';

    if (reason === 'ended') {
      this.currentIndex++;
      this.run();
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;

    if (this.state === 'PLAYING') {
      await this.audio.stop();
    }

    console.log('Player stopped:', this.state);
    this.onEnded?.('stopped');
  }

  async pause(): Promise<void> {
    if (this.state === 'PAUSED') return;
    let stop: Promise<void> | undefined;

    if (this.state === 'PLAYING') {
      stop = this.audio.stop();
    }

    this.state = 'PAUSED';
    if (stop) await stop;
    this.onAction?.();
  }

  async resume(): Promise<void> {
    if (this.state === 'IDLE') return;
    if (this.state === 'PAUSED') {
      this.state = 'IDLE';
      await this.run();
    }

    this.onAction?.();
  }

  async backward(): Promise<void> {
    if (this.state === 'IDLE') return;
    if (this.state === 'PLAYING') await this.audio.stop();
    if (this.currentIndex - 1 < 0) {
      this.onEnded?.('end:backward');
      return;
    }
    if (this.state === 'PAUSED') this.state = 'IDLE';

    let toIndex = this.currentIndex - 1;

    while (!this.content.server[toIndex].isReadable) {
      toIndex--;
      if (toIndex < 0) {
        this.onEnded?.('end:backward');
        return;
      }
    }

    this.currentIndex = toIndex;
    await this.run();
    this.onAction?.();
  }

  async forward(): Promise<void> {
    if (this.state === 'IDLE') return;
    if (this.state === 'PLAYING') await this.audio.stop();
    if (this.state === 'PAUSED') this.state = 'IDLE';

    this.currentIndex++;
    await this.run();

    this.onAction?.();
  }

  async seek(index: number): Promise<void> {
    if (index < 0 || index >= this.content.server.length) return;

    if (this.state === 'IDLE') return;
    if (this.state === 'PLAYING') await this.audio.stop();
    if (this.state === 'PAUSED') this.state = 'IDLE';

    this.currentIndex = index;
    await this.run();

    this.onAction?.();
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

  private async getNextAudio(): Promise<void> {
    if (this.currentIndex + 1 >= this.content.server.length) return;

    const sentence = this.content.server[this.currentIndex + 1];

    await this.getAudio(sentence);
  }

  getState() {
    return this.state;
  }

  getIndex() {
    return this.currentIndex;
  }

  getContent() {
    return this.content;
  }

  getServerContent() {
    return this.content.server;
  }

  getClientContent() {
    return this.content.client;
  }

  getRawContent() {
    return this.rawContent;
  }

  setToLastIndex() {
    this.currentIndex = this.content.server.length - 1;
  }
}
