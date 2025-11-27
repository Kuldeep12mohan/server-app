import { gameManager } from "../games/gameManager.js";

export function registerGameHandlers(io, socket) {

  /* ----------------------------------------------
   * JOIN ROOM (Common for all game types)
   * ---------------------------------------------- */
  socket.on("join_room", ({ roomId, role, gameType = "tictactoe" }, cb) => {
    try {
      if (!["he", "she"].includes(role)) {
        return cb?.({ success: false, message: "Invalid role" });
      }

      // Enforce JWT role if present
      if (socket.data.role && socket.data.role !== role) {
        return cb?.({ success: false, message: "Role mismatch with session" });
      }

      // Create game if not exists
      if (!gameManager.hasGame(roomId)) {
        gameManager.createGame(roomId, gameType);
      }

      const game = gameManager.getGame(roomId);

      game.addPlayer(role, socket.id);
      socket.join(roomId);

      cb?.({ success: true, game: game.toJSON() });
      io.to(roomId).emit("game_state", { game: game.toJSON() });

    } catch (err) {
      console.error("Error in join_room:", err);
      cb?.({ success: false, message: "Internal server error during join" });
    }
  });

  /* ----------------------------------------------
   * TIC-TAC-TOE: CHOOSE BALL
   * ---------------------------------------------- */
  socket.on("choose_ball", ({ roomId, role, color }, cb) => {
    const game = gameManager.getGame(roomId);

    // Ensure this is a TicTacToe game
    if (!game?.chooseBall) {
      return cb?.({ success: false, message: "Not a TicTacToe game" });
    }

    const result = game.chooseBall(color);
    if (!result.success) return cb?.(result);

    io.to(roomId).emit("ball_chosen", { chooser: role });
    io.to(roomId).emit("game_state", { game: game.toJSON() });

    cb?.({ success: true });
  });

  /* ----------------------------------------------
   * TIC-TAC-TOE: GUESS BALL
   * ---------------------------------------------- */
  socket.on("guess_ball", ({ roomId, role, color }, cb) => {
    const game = gameManager.getGame(roomId);
    if (!game?.guessBall) {
      return cb?.({ success: false, message: "Not a TicTacToe game" });
    }

    const result = game.guessBall(color);
    if (!result.success) return cb?.(result);

    io.to(roomId).emit("guess_result", { correct: result.correct });
    io.to(roomId).emit("game_state", { game: game.toJSON() });

    cb?.({ success: true, correct: result.correct });
  });

  /* ----------------------------------------------
   * TIC-TAC-TOE: MAKE MOVE
   * ---------------------------------------------- */
  socket.on("make_move", ({ roomId, role, index }, cb) => {
    const game = gameManager.getGame(roomId);
    if (!game?.makeMove) {
      return cb?.({ success: false, message: "Not a TicTacToe game" });
    }

    const result = game.makeMove(role, index);
    if (!result.success) return cb?.(result);

    io.to(roomId).emit("game_state", { game: game.toJSON() });
    cb?.({ success: true });
  });


  /* ============================================================
   * PUZZLE GAME HANDLERS
   * ============================================================ */

  /* ----------------------------------------------
   * PUZZLE: SELECT IMAGE
   * ---------------------------------------------- */
  socket.on("puzzle_select_image", ({ roomId, role, imageUrl }, cb) => {
    const game = gameManager.getGame(roomId);

    if (!game?.selectImage) {
      return cb?.({ success: false, message: "Not a Puzzle game" });
    }

    const result = game.selectImage(role, imageUrl);

    cb?.(result);
    io.to(roomId).emit("game_state", { game: game.toJSON() });
  });

  /* ----------------------------------------------
   * PUZZLE: PLAYER READY
   * ---------------------------------------------- */
  socket.on("puzzle_ready", ({ roomId, role }, cb) => {
    const game = gameManager.getGame(roomId);

    if (!game?.setReady) {
      return cb?.({ success: false, message: "Not a Puzzle game" });
    }

    const result = game.setReady(role);
    if (!result.success) return cb?.(result);

    io.to(roomId).emit("game_state", { game: game.toJSON() });
    cb?.({ success: true });
  });

  /* ----------------------------------------------
   * PUZZLE: SWAP TILES
   * ---------------------------------------------- */
  socket.on("puzzle_swap", ({ roomId, indexA, indexB }, cb) => {
    const game = gameManager.getGame(roomId);

    if (!game?.swapTiles) {
      return cb?.({ success: false, message: "Not a Puzzle game" });
    }

    const result = game.swapTiles(indexA, indexB);
    if (!result.success) return cb?.(result);

    io.to(roomId).emit("game_state", { game: game.toJSON() });
    cb?.({ success: true });
  });

  /* ----------------------------------------------
   * PUZZLE: SHUFFLE
   * ---------------------------------------------- */
  socket.on("puzzle_shuffle", ({ roomId }, cb) => {
    const game = gameManager.getGame(roomId);

    if (!game?.shuffleTiles) {
      return cb?.({ success: false, message: "Not a Puzzle game" });
    }

    const result = game.shuffleTiles();
    cb?.(result);

    io.to(roomId).emit("game_state", { game: game.toJSON() });
  });


  /* ============================================================
   * RESET GAME (any type)
   * ============================================================ */
  socket.on("reset_game", ({ roomId }, cb) => {
    const game = gameManager.getGame(roomId);

    if (!game) return cb?.({ success: false, message: "Game not found" });

    game.reset();
    io.to(roomId).emit("game_state", { game: game.toJSON() });

    cb?.({ success: true });
  });

  /* ============================================================
   * SWITCH GAME TYPE
   * ============================================================ */
  socket.on("switch_game", ({ roomId, gameType }, cb) => {
    if (!["tictactoe", "puzzle"].includes(gameType)) {
      return cb?.({ success: false, message: "Invalid game type" });
    }

    // Force create/overwrite game
    gameManager.createGame(roomId, gameType);
    const game = gameManager.getGame(roomId);

    io.to(roomId).emit("game_state", { game: game.toJSON() });
    cb?.({ success: true });
  });


  /* ============================================================
   * LEAVE + DISCONNECT HANDLERS
   * ============================================================ */
  socket.on("leave_room", ({ roomId, role }) => {
    const game = gameManager.getGame(roomId);
    if (!game) return;

    game.removePlayer(role);
    socket.leave(roomId);

    io.to(roomId).emit("game_state", { game: game.toJSON() });
  });

  socket.on("disconnect", () => {
    for (const game of gameManager.getAllGames()) {
      for (const [role, sid] of Object.entries(game.players)) {
        if (sid === socket.id) {
          game.removePlayer(role);
          io.to(game.id).emit("game_state", { game: game.toJSON() });
        }
      }
    }
  });
}
