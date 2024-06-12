import type { Server, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ProviderServerToClientEvents,
  ProviderClientToServerEvents,
} from 'socket-events';
import type { PlayerState } from 'types';
import PlayerAudioControl from './player-audio-control';
import TextToSpeech from './tts-use';
import TextToSpeechUse from './tts-use';

export type PlayerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type ProviderSocket = Socket<ProviderClientToServerEvents, ProviderServerToClientEvents>;

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

export type onEndedPlayer = (cause: 'stopped' | 'end:forward' | 'end:backward') => void;
export type onPlayPlayer = () => void;
export type onActionPlayer = () => void;

export class Player {
  protected rawContent: string[];
  protected currentIndex: number;

  protected state: 'IDLE' | 'PLAYING' | 'PAUSED';

  // public onEnded?: (stopped: boolean) => void;
  public onEnded?: onEndedPlayer;
  public onPlay?: onPlayPlayer;
  public onAction?: onActionPlayer;

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

  provider?: ProviderSocket;

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

  async readThis(contentToRead: string[], user: PlayerSocket): Promise<void> {
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

  async play(user: PlayerSocket): Promise<void> {
    console.log(['Action play']);

    if (!this.player) {
      console.log(['No player']);

      if (!this.provider) {
        console.log('No provider of content');
        user.emit('alert:show', 'No provider connected');
        return;
      }

      // Get content in the tab shown
      const rawContent = await this.provider
        .timeout(10000)
        .emitWithAck('get-content', 0)
        .catch(() => undefined);

      if (!rawContent) {
        console.log('Cannot get content from provider');
        user.emit('alert:show', 'Cannot get content');
        return;
      }

      this.player = new Player(rawContent, this.audio, this.tts);

      const onPlay: onPlayPlayer = () => {
        if (!this.player) return;
        this.users.server.emit('view:highlight-sentence', this.player.getIndex());
      };

      const onAction: onActionPlayer = () => {
        if (!this.player) return;
        this.users.server.emit('view:update-state', this.getConfig());
      };

      const onEnded: onEndedPlayer = async cause => {
        console.log(['Player onEnded']);
        this.player = undefined;

        if (cause !== 'stopped') await this.audio.alert('secondary');
        this.users.server.emit('view:update-state', this.getConfig());
        this.users.server.emit('view:load-content', this.getContent());

        if (cause === 'stopped' || !this.provider) {
          console.log("Player can't/shouldn't continue");
          await this.audio.alert('primary');
          return;
        }

        if (cause === 'end:forward') {
          console.log('Player ended naturally/forward');

          const rawContent = await this.provider
            .timeout(10000)
            .emitWithAck('get-content', 1)
            .catch(() => undefined);

          if (!rawContent) {
            await this.audio.alert('primary');
            return;
          }

          this.player = new Player(rawContent, this.audio, this.tts);
          this.player.onPlay = onPlay;
          this.player.onAction = onAction;
          this.player.onEnded = onEnded;

          await this.player.play();

          this.users.server.emit('view:load-content', this.getContent());
          this.users.server.emit('view:update-state', this.getConfig());
          return;
        }

        if (cause === 'end:backward') {
          console.log('Player ended backward');
          const rawContent = await this.provider
            .timeout(10000)
            .emitWithAck('get-content', -1)
            .catch(() => undefined);

          if (!rawContent) {
            await this.audio.alert('primary');
            return;
          }

          this.player = new Player(rawContent, this.audio, this.tts);
          this.player.onPlay = onPlay;
          this.player.onAction = onAction;
          this.player.onEnded = onEnded;

          await this.player.play();

          this.users.server.emit('view:load-content', this.getContent());
          this.users.server.emit('view:update-state', this.getConfig());
          return;
        }
      };

      this.player.onPlay = onPlay;
      this.player.onAction = onAction;
      this.player.onEnded = onEnded;

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

  setProvider(provider: ProviderSocket) {
    if (this.provider) {
      console.log('Provider already set');
      return;
    }
    console.log('Set provider:', provider.id);
    this.provider = provider;
  }

  removeProvider(provider: ProviderSocket) {
    if (!this.provider) {
      console.log('Provider already removed');
      return;
    }

    if (this.provider.id === provider.id) {
      console.log('Remove provider:', this.provider.id);
      this.provider = undefined;
      return;
    }
  }
}
