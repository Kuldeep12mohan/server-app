export class BaseGame {
  constructor(roomId, gameType) {
    this.id = roomId;
    this.gameType = gameType;
    this.players = {};
    this.winner = null;
  }

  addPlayer(role, socketId) {
    this.players[role] = socketId;
  }

  removePlayer(role) {
    delete this.players[role];
  }

  hasPlayer(role) {
    return !!this.players[role];
  }

  reset() {
    throw new Error("reset() must be implemented by subclass");
  }

  toJSON() {
    return {
      id: this.id,
      gameType: this.gameType,
      players: this.players,
      winner: this.winner,
    };
  }
}