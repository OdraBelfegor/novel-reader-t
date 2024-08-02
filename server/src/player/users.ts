import type { ClientToServerEvents, ServerToClientEvents } from '@common/socket-events';
import type { Server } from 'socket.io';
import { PlayerSocket } from '.';

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
