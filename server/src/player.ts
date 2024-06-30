import type { Server, Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ProviderServerToClientEvents,
  ProviderClientToServerEvents,
} from '@common/socket-events';
import type { PlayerState, ContentServer, ContentClient, TextProcessorResult } from '@common/types';
import PlayerAudioControl from './player-audio-control';
import TextToSpeech from './tts-use';
import TextToSpeechUse from './tts-use';
import textProcessor from './text-processor';

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
  protected content: TextProcessorResult;
  protected currentIndex: number;

  protected state: 'IDLE' | 'PLAYING' | 'PAUSED';

  // public onEnded?: (stopped: boolean) => void;
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

  async play(): Promise<void> {
    if (this.currentIndex >= this.content.server.length) {
      console.log('All content played');
      if (this.onEnded) this.onEnded('end:forward');
      return;
    }

    if (this.state === 'PAUSED') {
      console.log('Already paused');
      return;
    }

    if (this.state === 'PLAYING') {
      console.log('Already playing');
      return;
    }

    if (this.stopped) {
      console.log('Already stopped');
      return;
    }

    this.state = 'PLAYING';

    const sentence = this.content.server[this.currentIndex];

    if (sentence.isReadable) {
      const getCurrentAudio = (async () => {
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
      })();

      const getNextAudio = (async () => {
        if (this.currentIndex + 1 >= this.content.server.length) return;
        if (!this.content.server[this.currentIndex + 1].isReadable) return;
        if (this.content.server[this.currentIndex + 1].audio) return;

        const audio = await this.tts
          .getAudio(this.content.server[this.currentIndex + 1].sentence)
          .catch(() => undefined);

        if (!audio) return;

        this.content.server[this.currentIndex + 1].audio = audio;

        console.log('Getting next audio:', {
          index: this.currentIndex + 1,
          sentence: this.content.server[this.currentIndex + 1].sentence,
        });

        return;
      })();

      await Promise.all([getCurrentAudio, getNextAudio]);

      if (sentence.audio) {
        console.log('Playing sentence:', [sentence.sentence]);

        await this.audio.play(sentence.audio, ({ type }) => {
          console.log('Audio ended, event:', { reason: type });
          this.state = 'IDLE';

          if (type === 'ended') {
            this.currentIndex++;
            this.play();
          }
        });
      } else {
        console.log('Cannot play sentence:', [sentence.sentence]);
        this.audio.alert('ping');
      }
    } else {
      this.state = 'IDLE';
      this.currentIndex++;

      this.play();
    }

    if (this.onPlay) this.onPlay();
  }

  async stop(): Promise<void> {
    if (this.state === 'IDLE') return;

    this.stopped = true;
    await this.audio.stop();

    console.log('Player stopped:', this.state);

    if (this.onEnded) this.onEnded('stopped');
  }

  async pause(): Promise<void> {
    if (this.state === 'IDLE') return;

    if (this.state === 'PLAYING') {
      await this.audio.stop();
    }
    this.state = 'PAUSED';
    this.onAction && this.onAction();
    // if (this.onAction) this.onAction();
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

    if (index < 0 || index >= this.content.server.length) return;

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

export class PlayerControl {
  users: PlayerUsers;
  tts: TextToSpeech;
  audio: PlayerAudioControl;

  provider?: ProviderSocket;

  player?: Player;
  loop: boolean;
  loopActive: boolean;
  loopCounter: number | null;
  loopLimit: number | null;

  constructor(users: PlayerUsers, ttsUrl: string) {
    this.users = users;

    this.tts = new TextToSpeechUse(ttsUrl);
    this.audio = new PlayerAudioControl(this.users);

    this.loop = false;
    this.loopActive = false;
    this.loopCounter = null;
    this.loopLimit = null;
  }

  restartConfig() {
    this.loop = false;
    this.loopActive = false;
    this.loopCounter = null;
    this.loopLimit = null;
  }

  async readThis(rawContent: string[], user: PlayerSocket): Promise<void> {
    console.log(['Action read this']);

    if (this.player) {
      console.log('Already reading something');
      return;
    }

    console.log('Read this:', rawContent);

    this.player = new Player(rawContent, this.audio, this.tts);

    this.restartConfig();

    this.loop = false;
    this.loopActive = false;
    this.loopCounter = null;
    this.loopLimit = null;

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
      this.users.server.emit('view:load-content', this.getClientContent());

      this.restartConfig();
    };

    await this.player.play();

    this.users.server.emit('view:update-state', this.getConfig());
    this.users.server.emit('view:load-content', this.getClientContent());
  }

  async readFromProvider(user: PlayerSocket): Promise<void> {
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

    if (!rawContent || rawContent.length === 0) {
      console.log('Cannot get content from provider');
      user.emit('alert:show', 'Cannot get content');
      return;
    }

    this.player = new Player(rawContent, this.audio, this.tts);

    this.restartConfig();

    this.loop = true;
    this.loopActive = true;
    this.loopCounter = null;
    this.loopLimit = null;

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

      const canContinue: boolean = (() => {
        if (cause === 'stopped') return false;
        if (!this.loopActive) return false;
        if (
          typeof this.loopLimit === 'number' &&
          typeof this.loopCounter === 'number' &&
          this.loopCounter >= this.loopLimit
        ) {
          return false;
        }
        return true;
      })();

      // End reading
      if (!canContinue || !this.provider) {
        console.log("Player can't/shouldn't continue");

        this.restartConfig();

        this.users.server.emit('view:load-content', this.getClientContent());
        this.users.server.emit('view:update-state', this.getConfig());

        await this.audio.alert('primary');

        return;
      }

      // Continue reading
      await this.audio.alert('secondary');
      this.users.server.emit('view:update-state', this.getConfig());
      this.users.server.emit('view:load-content', this.getClientContent());

      if (cause === 'end:forward') {
        console.log('Player ended naturally/forward');

        if (typeof this.loopCounter === 'number') this.loopCounter++;

        const rawContent = await this.provider
          .timeout(10000)
          .emitWithAck('get-content', 1)
          .catch(() => undefined);

        if (!rawContent || rawContent.length === 0) {
          await this.audio.alert('primary');
          console.log('Cannot get more content from provider');
          this.restartConfig();
          return;
        }

        this.player = new Player(rawContent, this.audio, this.tts);
        this.player.onPlay = onPlay;
        this.player.onAction = onAction;
        this.player.onEnded = onEnded;

        await this.player.play();

        this.users.server.emit('view:load-content', this.getClientContent());
        this.users.server.emit('view:update-state', this.getConfig());
        return;
      }

      if (cause === 'end:backward') {
        console.log('Player ended backward');
        const rawContent = await this.provider
          .timeout(10000)
          .emitWithAck('get-content', -1)
          .catch(() => undefined);

        if (!rawContent || rawContent.length === 0) {
          await this.audio.alert('primary');
          console.log('Cannot get more content from provider');
          this.restartConfig();
          return;
        }

        this.player = new Player(rawContent, this.audio, this.tts);

        this.player.onPlay = onPlay;
        this.player.onAction = onAction;
        this.player.onEnded = onEnded;

        this.player.setToLastIndex();

        await this.player.play();

        this.users.server.emit('view:load-content', this.getClientContent());
        this.users.server.emit('view:update-state', this.getConfig());
        return;
      }
    };

    this.player.onPlay = onPlay;
    this.player.onAction = onAction;
    this.player.onEnded = onEnded;

    await this.player.play();

    this.users.server.emit('view:load-content', this.getClientContent());
    this.users.server.emit('view:update-state', this.getConfig());
  }

  async play(user: PlayerSocket): Promise<void> {
    console.log(['Action play']);

    if (!this.player) {
      console.log(['No player']);
      await this.readFromProvider(user);
      return;
    }

    if (this.player.getState() === 'IDLE') {
      await this.player.play();
      // * Acts when the player is IDLE, when the audio socket is disconnected, suspended?
      console.log(['Play emited with IDLE player, should do something?']);
      return;
    }

    if (this.player.getState() === 'PLAYING') {
      console.log(['Already playing, pause it']);
      await this.player.pause();
      return;
    }

    if (this.player.getState() === 'PAUSED') {
      console.log(['Already paused, resume it']);
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
    this.loopActive = !this.loopActive;
    this.users.server.emit('view:update-state', this.getConfig());
  }

  setLoopLimit(limit: number): void {
    console.log(['Action set loop limit', limit]);
    this.loopLimit = limit;
    if (this.loopCounter === null) this.loopCounter = 0;
    this.users.server.emit('view:update-state', this.getConfig());
  }

  removeLoopLimit(): void {
    console.log(['Action remove loop limit']);
    this.loopLimit = null;
    this.loopCounter = null;
    this.users.server.emit('view:update-state', this.getConfig());
  }

  async getContentFromProvider(): Promise<string[] | []> {
    if (!this.provider) {
      console.log('No provider');
      return [];
    }
    const text: string[] | [] = await this.provider
      .timeout(10000)
      .emitWithAck('get-content', 0)
      .catch(() => []);
    return text || [];
  }

  getConfig(): PlayerState {
    return {
      state: (this.player && this.player.getState()) || 'INACTIVE',
      loop: this.loop,
      loopActive: this.loopActive,
      loopLimit: this.loopLimit,
      loopCounter: this.loopCounter,
    };
  }

  getClientContent(): ContentClient | [] {
    if (this.player) return this.player.getClientContent();
    return [];
  }

  getIndex(): number {
    if (this.player) return this.player.getIndex();
    return 0;
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
