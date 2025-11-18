import http from "http";
import express from "express";
import dotenv from "dotenv";
import connectDB from "./db/db.js";
import { setupMiddleware } from "./middleware/rateLimiter.middleware.js";
import authRouter from "./routes/auth.routes.js";
import questionRouter from "./routes/question.routes.js";
import moodRouter from "./routes/mood.routes.js";
import { initializeSocketServer } from "./socket/socketServer.js";
import config from "./config/config.js";

dotenv.config();
//h
await connectDB();

const app = express();
app.set("trust proxy", 1);

// Setup middleware
setupMiddleware(app);

// REST Routes
app.use("/auth", authRouter);
app.use("/questions", questionRouter);
app.use("/mood", moodRouter);

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO
initializeSocketServer(httpServer);

httpServer.listen(config.PORT, () => {
  console.log(`🚀 Server + Socket running on port ${config.PORT}`);
});