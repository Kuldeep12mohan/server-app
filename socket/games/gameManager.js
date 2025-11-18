import { TicTacToeGame } from "./TicTacToeGame.js";

class GameManager {
  constructor() {
    this.games = new Map();
  }

  createGame(roomId, gameType = "tictactoe", options = {}) {
    let game;
    
    switch (gameType) {
      case "tictactoe":
        game = new TicTacToeGame(roomId, options.starter);
        break;
      // Add more game types here:
      // case "chess":
      //   game = new ChessGame(roomId, options);
      //   break;
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }

    this.games.set(roomId, game);
    return game;
  }

  getGame(roomId) {
    return this.games.get(roomId);
  }

  hasGame(roomId) {
    return this.games.has(roomId);
  }

  deleteGame(roomId) {
    return this.games.delete(roomId);
  }

  getAllGames() {
    return Array.from(this.games.values());
  }
}

export const gameManager = new GameManager();