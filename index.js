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
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

// ---------- In-memory games store & helpers ----------
const games = new Map();

function createNewGame(id, starterRole = "he") {
  return {
    id,
    board: Array(9).fill(null),
    currentTurn: starterRole,                   // who would play if move allowed
    chooser: starterRole === "he" ? "she" : "he", // who chooses the ball
    chosenBall: null,
    moveAllowed: false,
    players: {}, // { he: socketId, she: socketId }
    winner: null,
  };
}

function checkWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] === "X" ? "he" : "she";
    }
  }
  if (board.every(Boolean)) return "draw";
  return null;
}

// simple cookie parser helper for socket (no external dep)
function parseCookies(cookieHeader = "") {
  const cookies = {};
  cookieHeader.split(";").forEach((c) => {
    const [rawName, ...rest] = c.trim().split("=");
    if (!rawName) return;
    const rawVal = rest.join("=");
    try {
      cookies[rawName] = decodeURIComponent(rawVal);
    } catch (e) {
      cookies[rawName] = rawVal;
    }
  });
  return cookies;
}

// ---------- Socket handlers ----------
io.on("connection", (socket) => {
  // Attempt to decode JWT from cookies (for role)
  const cookieHeader = socket.handshake.headers?.cookie || "";
  const cookies = parseCookies(cookieHeader);
  let socketRole = null;
  if (cookies.session) {
    try {
      const decoded = jwt.verify(cookies.session, JWT_SECRET);
      socketRole = decoded.role;
    } catch (e) {
      // invalid token — leave socketRole null, client can still send role but less trust
    }
  }

  socket.data.roleFromCookie = socketRole; // may be null
  // console.log("socket connected", socket.id, "roleFromCookie", socketRole);

  socket.on("join_room", ({ roomId, role }, cb) => {
    if (!roomId || !["he","she"].includes(role)) {
      return cb && cb({ success: false, message: "Invalid params" });
    }

    // optional: enforce cookie-derived role matches claimed role
    if (socketRole && socketRole !== role) {
      // don't let mismatched claim go through
      return cb && cb({ success: false, message: "Role mismatch with session" });
    }

    if (!games.has(roomId)) {
      games.set(roomId, createNewGame(roomId, "he"));
    }

    const game = games.get(roomId);
    game.players[role] = socket.id;
    socket.join(roomId);

    // send full state to all in room
    io.to(roomId).emit("game_state", { game });

    return cb && cb({ success: true, game });
  });

  socket.on("choose_ball", ({ roomId, role, color }, cb) => {
    const game = games.get(roomId);
    if (!game) return cb && cb({ success: false, message: "No game" });

    // enforce chooser
    if (role !== game.chooser) return cb && cb({ success: false, message: "Not allowed to choose" });
    if (!["green","red","blue"].includes(color)) return cb && cb({ success: false, message: "Invalid color" });

    game.chosenBall = color;
    // notify: chooser picked (not revealing choice)
    io.to(roomId).emit("ball_chosen", {
      chooser: role,
      chosen: true,
      msg: `${role} chose a ball (hidden).`
    });

    io.to(roomId).emit("game_state", { game });
    return cb && cb({ success: true });
  });

  socket.on("guess_ball", ({ roomId, role, color }, cb) => {
    const game = games.get(roomId);
    if (!game) return cb && cb({ success: false, message: "No game" });

    // only currentTurn may guess
    if (role !== game.currentTurn) return cb && cb({ success: false, message: "Not your turn to guess" });
    if (!game.chosenBall) return cb && cb({ success: false, message: "Chooser hasn't selected" });

    const correct = game.chosenBall === color;

    if (correct) {
      game.moveAllowed = true;
      io.to(roomId).emit("guess_result", { correct: true, by: role, msg: "Guess correct — you may move!" });
    } else {
      // wrong: switch turn and chooser
      game.currentTurn = game.currentTurn === "he" ? "she" : "he";
      game.chooser = game.currentTurn === "he" ? "she" : "he";
      game.moveAllowed = false;
      io.to(roomId).emit("guess_result", { correct: false, by: role, msg: "Wrong guess — turn skipped." });
    }

    // always reset chosenBall after guess is processed
    game.chosenBall = null;

    io.to(roomId).emit("game_state", { game });
    return cb && cb({ success: true, correct });
  });

  socket.on("make_move", ({ roomId, role, index }, cb) => {
    const game = games.get(roomId);
    if (!game) return cb && cb({ success: false, message: "No game" });

    if (!game.moveAllowed) return cb && cb({ success: false, message: "Move not allowed now" });
    if (role !== game.currentTurn) return cb && cb({ success: false, message: "Not your move" });
    if (typeof index !== "number" || index < 0 || index > 8) return cb && cb({ success: false, message: "Invalid cell" });
    if (game.board[index]) return cb && cb({ success: false, message: "Cell already filled" });

    game.board[index] = role === "he" ? "X" : "O";
    game.moveAllowed = false;

    // check winner
    const winner = checkWinner(game.board);
    if (winner) {
      game.winner = winner;
      io.to(roomId).emit("game_over", { winner, game });
    } else {
      // swap turns + chooser
      game.currentTurn = game.currentTurn === "he" ? "she" : "he";
      game.chooser = game.currentTurn === "he" ? "she" : "he";
      io.to(roomId).emit("game_update", { game });
    }

    return cb && cb({ success: true });
  });

  socket.on("reset_game", ({ roomId }, cb) => {
    if (!roomId) return cb && cb({ success: false });
    const newGame = createNewGame(roomId, "he");
    games.set(roomId, newGame);
    io.to(roomId).emit("game_state", { game: newGame });
    return cb && cb({ success: true });
  });

  socket.on("leave_room", ({ roomId, role }, cb) => {
    const game = games.get(roomId);
    if (game) {
      delete game.players[role];
      socket.leave(roomId);
      io.to(roomId).emit("game_state", { game });
    }
    return cb && cb({ success: true });
  });

  socket.on("disconnect", () => {
    // remove player references from games
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

// ---------- Start server ----------
httpServer.listen(PORT, () => console.log(`🚀 Server + Socket running on http://localhost:${PORT}`));
