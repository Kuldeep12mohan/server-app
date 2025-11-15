// server.js
import http from "http";
import express from "express";
import { Server as IOServer } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import connectDB from "./db/db.js";
import questionRouter from "./routes/question.routes.js";
import moodRouter from "./routes/mood.routes.js";

dotenv.config();
await connectDB();

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const isProd = process.env.NODE_ENV === "production";

// ---------- Middlewares ----------
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many requests" },
});
app.use(apiLimiter);

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many attempts. Try again later." },
});

// ---------- Auth endpoints (REST) ----------
const SECRET_HE = process.env.HE_PASSWORD;
const SECRET_SHE = process.env.SHE_PASSWORD;

app.post("/auth/unlock", authLimiter, (req, res) => {
  const { password, role } = req.body;
  if (!role || !password)
    return res.status(400).json({ success: false, message: "Missing role or password" });

  let isValid = false;
  if (role === "he" && password === SECRET_HE) isValid = true;
  if (role === "she" && password === SECRET_SHE) isValid = true;

  if (!isValid)
    return res.status(401).json({ success: false, message: "Wrong password" });

  const token = jwt.sign({ unlocked: true, role }, JWT_SECRET, { expiresIn: "7d" });

  res.cookie("session", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "strict",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, role });
});

app.get("/auth/status", (req, res) => {
  const token = req.cookies.session;
  if (!token) return res.json({ unlocked: false });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ unlocked: true, role: decoded.role });
  } catch {
    return res.json({ unlocked: false });
  }
});

app.post("/auth/logout", (req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    sameSite: isProd ? "none" : "strict",
    secure: isProd,
    path: "/",
  });
  res.json({ success: true, message: "Logged out successfully 💖" });
});

// ---------- API routers ----------
app.use("/questions", questionRouter);
app.use("/mood", moodRouter);

// ---------- Create HTTP server + Socket.io ----------
const httpServer = http.createServer(app);

const io = new IOServer(httpServer, {
  cors: { origin: CLIENT_URL, credentials: true }
});

// ========== GAME STORE ==========
const games = new Map();

// Create new game
function createGame(roomId, starter = "he") {
  return {
    id: roomId,
    board: Array(9).fill(null),
    currentTurn: starter,                  // Who will guess + potentially move
    chooser: starter === "he" ? "she" : "he", // Opposite person chooses ball
    chosenBall: null,
    moveAllowed: false,
    players: {},                          // { he: socketId, she: socketId }
    winner: null
  };
}

// Check for win/draw
function checkWinner(board) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] === "X" ? "he" : "she";
    }
  }
  if (board.every(Boolean)) return "draw";
  return null;
}

// Parse cookies from socket handshake
function parseCookies(str = "") {
  const obj = {};
  str.split(";").forEach((c) => {
    const [k, v] = c.trim().split("=");
    if (k && v) obj[k] = decodeURIComponent(v);
  });
  return obj;
}

// ========== SOCKET.IO HANDLERS ==========
io.on("connection", (socket) => {

  // Extract role from JWT cookie if present
  let roleFromCookie = null;
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    if (cookies.session) {
      const decoded = jwt.verify(cookies.session, JWT_SECRET);
      roleFromCookie = decoded.role;
    }
  } catch {}

  socket.data.role = roleFromCookie;

  // ---------- JOIN ROOM ----------
  socket.on("join_room", ({ roomId, role }, cb) => {
    if (!["he", "she"].includes(role)) {
      return cb && cb({ success: false, message: "Invalid role" });
    }

    // If cookie-role exists → enforce it
    if (roleFromCookie && role !== roleFromCookie) {
      return cb && cb({ success: false, message: "Role mismatch with session" });
    }

    if (!games.has(roomId)) {
      games.set(roomId, createGame(roomId));
    }

    const game = games.get(roomId);

    game.players[role] = socket.id;
    socket.join(roomId);

    cb && cb({ success: true, game });

    io.to(roomId).emit("game_state", { game });
  });

  // ---------- CHOOSE BALL ----------
  socket.on("choose_ball", ({ roomId, role, color }, cb) => {
    const game = games.get(roomId);
    if (!game) return cb && cb({ success: false });

    if (role !== game.chooser) {
      return cb && cb({ success: false, message: "Not chooser" });
    }

    if (!["green", "red", "blue"].includes(color)) {
      return cb && cb({ success: false, message: "Invalid color" });
    }

    game.chosenBall = color;
    game.moveAllowed = false;

    io.to(roomId).emit("ball_chosen", { chooser: role });

    io.to(roomId).emit("game_state", { game });

    cb && cb({ success: true });
  });

  // ---------- GUESS BALL ----------
  socket.on("guess_ball", ({ roomId, role, color }, cb) => {
    const game = games.get(roomId);
    if (!game) return cb && cb({ success: false });

    if (role !== game.currentTurn) {
      return cb && cb({ success: false, message: "Not your guess turn" });
    }

    if (!game.chosenBall) {
      return cb && cb({ success: false, message: "Chooser has not selected yet" });
    }

    const correct = game.chosenBall === color;

    if (correct) {
      game.moveAllowed = true;
    } else {
      // Incorrect guess → turn switches
      game.currentTurn = game.currentTurn === "he" ? "she" : "he";
      game.chooser = game.currentTurn === "he" ? "she" : "he";
      game.moveAllowed = false;
    }

    game.chosenBall = null;

    io.to(roomId).emit("guess_result", { correct });
    io.to(roomId).emit("game_state", { game });

    cb && cb({ success: true, correct });
  });

  // ---------- MAKE MOVE ----------
  socket.on("make_move", ({ roomId, role, index }, cb) => {
    const game = games.get(roomId);
    if (!game) return cb && cb({ success: false });

    if (!game.moveAllowed)
      return cb && cb({ success: false, message: "Move not allowed" });

    if (role !== game.currentTurn)
      return cb && cb({ success: false, message: "Not your move" });

    if (index < 0 || index > 8)
      return cb && cb({ success: false, message: "Bad index" });

    if (game.board[index])
      return cb && cb({ success: false, message: "Cell filled" });

    game.board[index] = role === "he" ? "X" : "O";
    game.moveAllowed = false;

    // check win
    const winner = checkWinner(game.board);
    if (winner) {
      game.winner = winner;
    } else {
      game.currentTurn = game.currentTurn === "he" ? "she" : "he";
      game.chooser = game.currentTurn === "he" ? "she" : "he";
    }

    io.to(roomId).emit("game_state", { game });

    cb && cb({ success: true });
  });

  // ---------- RESET ----------
  socket.on("reset_game", ({ roomId }, cb) => {
    const fresh = createGame(roomId);
    games.set(roomId, fresh);
    io.to(roomId).emit("game_state", { game: fresh });
    cb && cb({ success: true });
  });

  // ---------- LEAVE ----------
  socket.on("leave_room", ({ roomId, role }) => {
    const game = games.get(roomId);
    if (game) {
      delete game.players[role];
      socket.leave(roomId);
      io.to(roomId).emit("game_state", { game });
    }
  });

  // ---------- DISCONNECT ----------
  socket.on("disconnect", () => {
    for (const [roomId, game] of games.entries()) {
      for (const [r, sid] of Object.entries(game.players)) {
        if (sid === socket.id) {
          delete game.players[r];
          io.to(roomId).emit("game_state", { game });
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server + Socket running on port ${PORT}`);
});