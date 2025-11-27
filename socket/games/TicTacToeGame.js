import { BaseGame } from "./baseGame.js";

export class TicTacToeGame extends BaseGame {
  constructor(roomId, starter = "he") {
    super(roomId, "tictactoe");
    this.board = Array(9).fill(null);
    this.currentTurn = starter;
    this.chooser = starter === "he" ? "she" : "he";
    this.chosenBall = null;
    this.moveAllowed = false;
    this.winner = null;
  }


  chooseBall(color) {
    if (!["green", "red", "blue"].includes(color)) {
      return { success: false, message: "Invalid color" };
    }
    if (this.chosenBall) {
      // Already chosen, maybe allow re-choose if game hasn't progressed?
      // For now, strict.
      return { success: false, message: "Ball already chosen" };
    }
    this.chosenBall = color;
    this.moveAllowed = false;
    return { success: true };
  }

  guessBall(color) {
    if (!this.chosenBall) {
      return { success: false, message: "No ball chosen yet" };
    }
    if (this.moveAllowed) {
      return { success: false, message: "Already guessed correctly, make your move!" };
    }

    const correct = this.chosenBall === color;

    if (correct) {
      this.moveAllowed = true;
    } else {
      // Wrong guess - switch turns
      this.switchTurns();
      this.moveAllowed = false;
      // Reset chosen ball so next player can choose?
      // The logic seems to be: Chooser picks -> Guesser guesses.
      // If wrong, turns switch. So new Chooser picks?
      // If so, we need to reset chosenBall.
      this.chosenBall = null;
    }

    // If correct, we keep chosenBall so we know? Or maybe reset it?
    // If correct, moveAllowed becomes true. Then they make a move.
    // After move, turns switch.
    // So if correct, we can clear chosenBall immediately or after move.
    // Let's clear it after move.

    return { success: true, correct };
  }

  makeMove(role, index) {
    if (!this.moveAllowed) {
      return { success: false, message: "Move not allowed. Guess the ball first!" };
    }

    if (role !== this.currentTurn) {
      return { success: false, message: "Not your turn" };
    }

    if (index < 0 || index > 8) {
      return { success: false, message: "Invalid index" };
    }

    if (this.board[index]) {
      return { success: false, message: "Cell already filled" };
    }

    this.board[index] = role === "he" ? "X" : "O";
    this.moveAllowed = false;
    this.chosenBall = null; // Reset chosen ball after move

    const winner = this.checkWinner();
    if (winner) {
      this.winner = winner;
    } else {
      this.switchTurns();
    }

    return { success: true };
  }

  switchTurns() {
    this.currentTurn = this.currentTurn === "he" ? "she" : "he";
    this.chooser = this.currentTurn === "he" ? "she" : "he";
  }

  checkWinner() {
    const wins = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];

    for (const [a, b, c] of wins) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return this.board[a] === "X" ? "he" : "she";
      }
    }

    if (this.board.every(Boolean)) return "draw";
    return null;
  }

  reset() {
    this.board = Array(9).fill(null);
    this.currentTurn = "he";
    this.chooser = "she";
    this.chosenBall = null;
    this.moveAllowed = false;
    this.winner = null;
  }

  toJSON() {
    return {
      id: this.id,
      gameType: this.gameType,
      players: this.players,
      board: this.board,
      currentTurn: this.currentTurn,
      chooser: this.chooser,
      chosenBall: this.chosenBall,
      moveAllowed: this.moveAllowed,
      winner: this.winner,
    };
  }

}