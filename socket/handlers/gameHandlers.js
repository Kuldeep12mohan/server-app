import { gameManager } from "../games/gameManager.js";

export function registerGameHandlers(io, socket) {
  socket.on("join_room", ({ roomId, role, gameType = "tictactoe" }, cb) => {
    if (!["he", "she"].includes(role)) {
      return cb && cb({ success: false, message: "Invalid role" });
    }

    if (socket.data.role && role !== socket.data.role) {
      return cb && cb({ success: false, message: "Role mismatch with session" });
    }

    if (!gameManager.hasGame(roomId)) {
      gameManager.createGame(roomId, gameType);
    }

    const game = gameManager.getGame(roomId);
    game.addPlayer(role, socket.id);
    socket.join(roomId);

    cb && cb({ success: true, game: game.toJSON() });
    io.to(roomId).emit("game_state", { game: game.toJSON() });
  });

  socket.on("choose_ball", ({ roomId, role, color }, cb) => {
    const game = gameManager.getGame(roomId);
    if (!game) return cb && cb({ success: false, message: "Game not found" });

    if (role !== game.chooser) {
      return cb && cb({ success: false, message: "Not chooser" });
    }

    const result = game.chooseBall(color);
    if (!result.success) {
      return cb && cb(result);
    }

    io.to(roomId).emit("ball_chosen", { chooser: role });
    io.to(roomId).emit("game_state", { game: game.toJSON() });
    cb && cb({ success: true });
  });

  socket.on("guess_ball", ({ roomId, role, color }, cb) => {
    const game = gameManager.getGame(roomId);
    if (!game) return cb && cb({ success: false, message: "Game not found" });

    if (role !== game.currentTurn) {
      return cb && cb({ success: false, message: "Not your guess turn" });
    }

    const result = game.guessBall(color);
    if (!result.success) {
      return cb && cb(result);
    }

    io.to(roomId).emit("guess_result", { correct: result.correct });
    io.to(roomId).emit("game_state", { game: game.toJSON() });
    cb && cb({ success: true, correct: result.correct });
  });

  socket.on("make_move", ({ roomId, role, index }, cb) => {
    const game = gameManager.getGame(roomId);
    if (!game) return cb && cb({ success: false, message: "Game not found" });

    const result = game.makeMove(role, index);
    if (!result.success) {
      return cb && cb(result);
    }

    io.to(roomId).emit("game_state", { game: game.toJSON() });
    cb && cb({ success: true });
  });

  socket.on("reset_game", ({ roomId }, cb) => {
    const game = gameManager.getGame(roomId);
    if (!game) return cb && cb({ success: false, message: "Game not found" });

    game.reset();
    io.to(roomId).emit("game_state", { game: game.toJSON() });
    cb && cb({ success: true });
  });

  socket.on("leave_room", ({ roomId, role }) => {
    const game = gameManager.getGame(roomId);
    if (game) {
      game.removePlayer(role);
      socket.leave(roomId);
      io.to(roomId).emit("game_state", { game: game.toJSON() });
    }
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
