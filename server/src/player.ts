import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@common/events';
import type { PlayerState } from '@common/types';
import PlayerAudioControl from './player-audio-control';
import TextToSpeech from './tts-use';
import TextToSpeechUse from './tts-use';

export type PlayerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class PlayerUsers {
  users: PlayerSocket[];
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: Server) {
    this.users = [];
    this.server = io;
  }

  add(socket: PlayerSocket) {
    this.users.push(socket);
  }

  remove(socket: PlayerSocket) {
    const index = this.users.findIndex(u => u.id === socket.id);
    if (index > -1) {
      this.users.splice(index, 1);
    }
  }

  prioritize(socket: PlayerSocket) {
    const index = this.users.findIndex(u => u.id === socket.id);
    if (index > -1) {
      this.users.unshift(this.users.splice(index, 1)[0]);
    }
  }

  getUserById(id: string): PlayerSocket | undefined {
    return this.users.find(u => u.id === id);
  }

  getUserByIndex(index: number): PlayerSocket | undefined {
    return this.users[index];
  }

  getIdList(): string[] {
    return this.users.map(u => u.id);
  }
}

export class Player {
  protected rawContent: string[];
  protected currentIndex: number;

  protected state: 'IDLE' | 'PLAYING' | 'PAUSED';

  // public onEnded?: (stopped: boolean) => void;
  public onEnded?: (cause: 'stopped' | 'end:forward' | 'end:backward') => void;
  public onPlay?: () => void;
  public onAction?: () => void;

  protected audio: PlayerAudioControl;
  protected tts: TextToSpeech;

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
  }

  async play(): Promise<void> {
    if (this.currentIndex >= this.rawContent.length) {
      console.log('All content played');
      if (this.onEnded) this.onEnded('end:forward');
      return;
    }

    if (this.state === 'PLAYING') {
      console.log('Already playing');
      return;
    }

    this.state = 'PLAYING';

    const sentence = this.rawContent[this.currentIndex];
    const audio = await this.tts.getAudio(sentence);

    console.log('Got audio for:', [sentence]);

    await this.audio.play(audio, ({ type }) => {
      console.log('Audio ended, event:', { reason: type });
      this.state = 'IDLE';

      if (type === 'ended') {
        this.currentIndex++;
        this.play();
      }
    });

    if (this.onPlay) this.onPlay();
  }

  async stop(): Promise<void> {
    if (this.state === 'IDLE') return;

    await this.audio.stop();
    console.log('Audio stopped:', this.state);

    if (this.onEnded) this.onEnded('stopped');
  }

  async pause(): Promise<void> {
    if (this.state === 'IDLE') return;

    if (this.state === 'PLAYING') {
      await this.audio.stop();
      this.state = 'PAUSED';
    }

    if (this.onAction) this.onAction();
  }

  async resume(): Promise<void> {
    if (this.state === 'IDLE') return;

    if (this.state === 'PAUSED') {
      await this.play();
    }

    if (this.onAction) this.onAction();
  }

  async backward(): Promise<void> {
    if (this.state === 'IDLE') return;

    await this.audio.stop();

    if (this.currentIndex - 1 < 0) {
      if (this.onEnded) this.onEnded('end:backward');
      return;
    }

    this.currentIndex--;
    await this.play();

    if (this.onAction) this.onAction();
  }

  async forward(): Promise<void> {
    if (this.state === 'IDLE') return;

    await this.audio.stop();

    // if (this.currentIndex + 1 >= this.rawContent.length) {
    //   if (this.onEnded) this.onEnded('end:forward');
    //   return;
    // }

    this.currentIndex++;
    await this.play();

    if (this.onAction) this.onAction();
  }

  async seek(index: number): Promise<void> {
    await this.audio.stop();

    if (index < 0 || index >= this.rawContent.length) return;

    this.currentIndex = index;
    await this.play();

    if (this.onAction) this.onAction();
  }

  getState() {
    return this.state;
  }

  getIndex() {
    return this.currentIndex;
  }

  getRawContent() {
    return this.rawContent;
  }
}

export class PlayerControl {
  users: PlayerUsers;
  tts: TextToSpeech;
  audio: PlayerAudioControl;

  player?: Player;
  loop: boolean;
  loopActive: boolean;
  loopLimit: number | null;

  constructor(users: PlayerUsers, ttsUrl: string) {
    this.users = users;

    this.tts = new TextToSpeechUse(ttsUrl);
    this.audio = new PlayerAudioControl(this.users);

    this.loop = false;
    this.loopActive = false;
    this.loopLimit = null;
  }

  async readThis(contentToRead: string[]): Promise<void> {
    console.log(['Action read this']);

    if (this.player) {
      console.log('Already reading something');
      return;
    }

    console.log('Read this:', contentToRead);

    this.player = new Player(contentToRead, this.audio, this.tts);

    this.player.onPlay = () => {
      if (!this.player) return;
      this.users.server.emit('view:highlight-sentence', this.player.getIndex());
    };

    this.player.onAction = () => {
      if (!this.player) return;
      this.users.server.emit('view:update-state', this.getConfig());
    };

    this.player.onEnded = cause => {
      console.log(['Player onEnded']);

      this.player = undefined;

      this.audio.alert('primary');
      this.users.server.emit('view:update-state', this.getConfig());
      this.users.server.emit('view:load-content', this.getContent());
    };

    await this.player.play();

    this.users.server.emit('view:update-state', this.getConfig());
    this.users.server.emit('view:load-content', this.getContent());
  }

  async play(): Promise<void> {
    console.log(['Action play']);

    if (!this.player) {
      console.log('No player');

      this.player = new Player(
        [
          'Walking up to the door, I open it to reveal Ai, her entrancing purple eyes peeking over her sunglasses.',
          '"Hey, Cassius! It\'s karaoke time!".',
          "\"Haa, you do realize that you didn't tell me anything about this like you said you would? You're lucky I wasn't heading out tonight, you would've been left alone in front of my door.\".",
          '"Oh, I did, didn\'t I? Whoopsie~".',
          '"Whatever. Come on in, the furniture got here this morning, so you have a place to sit now.".',
        ],
        this.audio,
        this.tts
      );

      this.player.onPlay = () => {
        if (!this.player) return;
        this.users.server.emit('view:highlight-sentence', this.player.getIndex());
      };

      this.player.onAction = () => {
        if (!this.player) return;
        this.users.server.emit('view:update-state', this.getConfig());
      };

      this.player.onEnded = async cause => {
        console.log(['Player onEnded']);
        this.player = undefined;

        await this.audio.alert('secondary');
        this.users.server.emit('view:update-state', this.getConfig());
        this.users.server.emit('view:load-content', this.getContent());

        if (cause === 'stopped') {
          console.log('Player ended by stop, dont continue cycle');
          await this.audio.alert('primary');
        }
      };

      await this.player.play();

      this.users.server.emit('view:load-content', this.getContent());
      this.users.server.emit('view:update-state', this.getConfig());

      return;
    }

    if (this.player.getState() === 'IDLE') {
      await this.player.play();
      return;
    }

    if (this.player.getState() === 'PLAYING') {
      await this.player.pause();
      return;
    }

    if (this.player.getState() === 'PAUSED') {
      await this.player.resume();
      return;
    }
  }

  async stop(): Promise<void> {
    console.log(['Action stop']);

    if (!this.player) {
      console.log('Stop emited with no player');
      return;
    }

    await this.player.stop();
  }

  async forward(): Promise<void> {
    console.log(['Action forward']);

    if (!this.player) {
      console.log('Forward emited with no player');
      return;
    }

    await this.player.forward();
  }

  async backward(): Promise<void> {
    console.log(['Action backward']);

    if (!this.player) {
      console.log('Backward emited with no player');
      return;
    }

    await this.player.backward();
  }

  async seek(index: number): Promise<void> {
    console.log(['Action seek', index]);

    if (!this.player) {
      console.log('Seek emited with no player');
      return;
    }

    await this.player.seek(index);
  }

  async stopAudio(): Promise<void> {
    console.log(['Action stop audio']);
    await this.audio.stop();
  }

  toggleLoop(): void {
    console.log(['Action toggle loop']);
  }

  setLoopLimit(limit: number): void {
    console.log(['Action set loop limit', limit]);
  }

  removeLoopLimit(): void {
    console.log(['Action remove loop limit']);
  }

  getConfig(): PlayerState {
    return {
      state: (this.player && this.player.getState()) || 'INACTIVE',
      loop: this.loop,
      loopActive: this.loopActive,
      loopLimit: this.loopLimit,
    };
  }

  getContent(): string[] {
    if (this.player) return this.player.getRawContent();
    return [];
  }
}
