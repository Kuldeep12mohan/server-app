import { BaseGame } from "./baseGame.js";

export class PuzzleGame extends BaseGame {
  constructor(roomId) {
    super(roomId, "puzzle");

    this.size = 4; // 4x4 puzzle
    this.totalTiles = this.size * this.size;

    this.imageUrl = null;

    this.tiles = [];           // array of tile indexes [0..8] but shuffled
    this.solvedTiles = [];     // perfect solved order for checking
    this.ready = { he: false, she: false };

    this.started = false;
    this.winner = null;

    this.reset();
  }

  // ----------------------------------------------
  // RESET GAME
  // ----------------------------------------------
  reset() {
    this.tiles = [...Array(this.totalTiles).keys()]; // [0..8]
    this.solvedTiles = [...this.tiles];
    this.ready = { he: false, she: false };
    this.started = false;
    this.imageUrl = null;
    this.winner = null;
    // Ensure we don't have lingering state if we add more in future
  }

  // ----------------------------------------------
  // PLAYER READY
  // ----------------------------------------------
  setReady(role) {
    if (!["he", "she"].includes(role)) {
      return { success: false, message: "Invalid role" };
    }

    this.ready[role] = true;

    // Start when both are ready
    if (this.ready.he && this.ready.she) {
      this.started = true;
      return { success: true, started: true };
    }

    return { success: true, started: false };
  }

  // ----------------------------------------------
  // SELECT PUZZLE IMAGE
  // ----------------------------------------------
  selectImage(role, url) {
    if (!url) return { success: false, message: "Image URL required" };
    // Optional: Check if role is allowed to select image, or if game already started
    if (this.started) return { success: false, message: "Game already started" };

    this.imageUrl = url;
    return { success: true };
  }

  // ----------------------------------------------
  // SHUFFLE TILES
  // ----------------------------------------------
  shuffleTiles() {
    if (!this.imageUrl) {
      return { success: false, message: "Image not selected yet" };
    }
    if (this.started) {
      // Allow shuffle only if game hasn't started or maybe restart?
      // For now, let's assume shuffle is only for setup or restart
      // But the UI allows shuffle before start.
    }

    // Fisher-Yates shuffle
    const arr = [...this.tiles];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    this.tiles = arr;

    return { success: true };
  }

  // ----------------------------------------------
  // SWAP TILES
  // ----------------------------------------------
  swapTiles(a, b) {
    if (!this.started) {
      return { success: false, message: "Puzzle not started yet" };
    }

    if (this.winner) {
      return { success: false, message: "Puzzle already solved!" };
    }

    if (typeof a !== 'number' || typeof b !== 'number') {
      return { success: false, message: "Invalid tile indices" };
    }

    if (a < 0 || a >= this.totalTiles || b < 0 || b >= this.totalTiles) {
      return { success: false, message: "Invalid tile index" };
    }

    // swap them
    [this.tiles[a], this.tiles[b]] = [this.tiles[b], this.tiles[a]];

    if (this.isSolved()) {
      this.winner = "both"; // cooperative game
    }

    return { success: true, solved: this.isSolved() };
  }

  // ----------------------------------------------
  // CHECK IF PUZZLE IS SOLVED
  // ----------------------------------------------
  // ----------------------------------------------
  // CHECK IF PUZZLE IS SOLVED
  // ----------------------------------------------
  isSolved() {
    const solved = this.tiles.every((val, idx) => val === this.solvedTiles[idx]);
    if (!solved) {
      // Optional: Log how many are correct for debugging
      const correctCount = this.tiles.reduce((acc, val, idx) => acc + (val === this.solvedTiles[idx] ? 1 : 0), 0);
    }
    return solved;
  }

  // ----------------------------------------------
  // DEBUG: INSTANT SOLVE
  // ----------------------------------------------
  debugSolve() {
    this.tiles = [...this.solvedTiles];
    this.winner = "both";
    return { success: true };
  }

  // ----------------------------------------------
  // JSON STRUCTURE
  // ----------------------------------------------
  toJSON() {
    return {
      ...super.toJSON(),
      tiles: this.tiles,
      solvedTiles: this.solvedTiles,
      ready: this.ready,
      started: this.started,
      imageUrl: this.imageUrl,
    };
  }
}
