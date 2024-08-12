import type { Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ProviderServerToClientEvents,
  ProviderClientToServerEvents,
} from '@common/socket-events';
import type { PlayerState, ContentClient } from '@common/types';
import TextToSpeech from '../tts-use';
import {
  PlayerAudioControl,
  Player,
  type PlayerUsers,
  type onActionPlayer,
  type onEndedPlayer,
  type onPlayPlayer,
} from '.';

export type PlayerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type ProviderSocket = Socket<ProviderClientToServerEvents, ProviderServerToClientEvents>;

export class PlayerControl {
  users: PlayerUsers;
  tts: TextToSpeech;
  audio: PlayerAudioControl;

  provider?: ProviderSocket;
  loading: boolean;

  player?: Player;
  loop: boolean;
  loopActive: boolean;
  loopCounter: number | null;
  loopLimit: number | null;

  constructor(users: PlayerUsers, ttsUrl: string) {
    this.users = users;

    this.tts = new TextToSpeech(ttsUrl);
    this.audio = new PlayerAudioControl(this.users);

    this.loop = false;
    this.loopActive = false;
    this.loopCounter = null;
    this.loopLimit = null;

    this.loading = false;
  }

  restartConfig() {
    this.loop = false;
    this.loopActive = false;
    this.loopCounter = null;
    this.loopLimit = null;
  }

  private playerOnPlay: onPlayPlayer = () => {
    if (!this.player) return;
    this.users.server.emit('view:highlight-sentence', this.player.index);
  };

  private playerOnAction: onActionPlayer = () => {
    if (!this.player) return;
    this.users.server.emit('view:update-state', this.getConfig());
  };

  private playerOnEndedSingle: onEndedPlayer = cause => {
    console.log(['Player onEnded']);

    this.player = undefined;

    this.audio.alert('primary');

    this.restartConfig();
    this.users.server.emit('view:update-state', this.getConfig());
    this.users.server.emit('view:load-content', this.getClientContent());
  };

  private playerOnEndedLoop: onEndedPlayer = async cause => {
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

    let rawContent: string[] | undefined;

    if (cause === 'end:forward') {
      console.log('Player ended naturally/forward');

      if (typeof this.loopCounter === 'number') this.loopCounter++;

      rawContent = await this.provider
        .timeout(10000)
        .emitWithAck('get-content', 1)
        .catch(() => undefined);
    } else {
      console.log('Player ended backward');
      if (typeof this.loopCounter === 'number') this.loopCounter--;

      rawContent = await this.provider
        .timeout(10000)
        .emitWithAck('get-content', -1)
        .catch(() => undefined);
    }

    if (!rawContent || rawContent.length === 0) {
      await this.audio.alert('primary');
      console.log('Cannot get more content from provider');
      this.restartConfig();
      return;
    }

    this.player = new Player(rawContent, this.audio, this.tts);
    this.player.onPlay = this.playerOnPlay;
    this.player.onAction = this.playerOnAction;
    this.player.onEnded = this.playerOnEndedLoop;

    if (cause === 'end:backward') this.player.setToLastIndex();

    await this.player.run();

    this.users.server.emit('view:load-content', this.getClientContent());
    this.users.server.emit('view:update-state', this.getConfig());
  };

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

    this.player.onPlay = this.playerOnPlay;

    this.player.onAction = this.playerOnAction;

    this.player.onEnded = this.playerOnEndedSingle;

    await this.player.run();

    this.users.server.emit('view:update-state', this.getConfig());
    this.users.server.emit('view:load-content', this.getClientContent());
  }

  async readFromProvider(user: PlayerSocket): Promise<void> {
    if (!this.provider) {
      console.log('No provider of content');
      user.emit('alert:show', 'No provider connected');
      return;
    }

    if (this.loading) return;

    this.loading = true;
    // Get content in the tab shown
    const rawContent = await this.provider
      .timeout(10000)
      .emitWithAck('get-content', 0)
      .catch(() => undefined);

    this.loading = false;

    if (!rawContent || rawContent.length === 0) {
      console.log('Cannot get content from provider');
      user.emit('alert:show', 'Cannot get content');
      return;
    }

    this.player = new Player(rawContent, this.audio, this.tts);

    this.player.onPlay = this.playerOnPlay;
    this.player.onAction = this.playerOnAction;
    this.player.onEnded = this.playerOnEndedLoop;

    this.restartConfig();

    this.loop = true;
    this.loopActive = true;
    this.loopCounter = null;
    this.loopLimit = null;

    await this.player.run();

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

    await this.player.play();
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
      state: (this.player && this.player.state.name) || 'INACTIVE',
      loop: this.loop,
      loopActive: this.loopActive,
      loopLimit: this.loopLimit,
      loopCounter: this.loopCounter,
    };
  }

  getClientContent(): ContentClient | [] {
    if (this.player) return this.player.clientContent;
    return [];
  }

  getIndex(): number {
    if (this.player) return this.player.index;
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

    if (this.provider.id !== provider.id) return;

    console.log('Remove provider:', this.provider.id);
    this.provider = undefined;
  }
}
