export class BaseGame {
  constructor(roomId, gameType) {
    this.id = roomId;
    this.gameType = gameType;
    this.players = {};       // { he: socketId, she: socketId }
    this.winner = null;

    this.state = {};         // 👈 central game-state container
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

  // Subclasses should override this
  reset() {
    throw new Error("reset() must be implemented by subclass");
  }

  // Universal state update method
  updateState(newState) {
    this.state = { ...this.state, ...newState };
  }

  toJSON() {
    return {
      id: this.id,
      gameType: this.gameType,
      players: this.players,
      winner: this.winner,
      state: this.state,     // 👈 send the entire game state to frontend
    };
  }
}
