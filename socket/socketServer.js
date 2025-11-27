import { Server as IOServer } from "socket.io";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import { parseCookies } from "../utils/cookieParser.js";
import { registerGameHandlers } from "./handlers/gameHandlers.js";

export function initializeSocketServer(httpServer) {
  const io = new IOServer(httpServer, {
    cors: { origin: config.CLIENT_URL, credentials: true },
  });

  io.on("connection", (socket) => {
    let roleFromCookie = null;
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      if (cookies.session) {
        const decoded = jwt.verify(cookies.session, config.JWT_SECRET);
        roleFromCookie = decoded.role;
      }
    } catch {}

    socket.data.role = roleFromCookie;
    registerGameHandlers(io, socket);
  });

  return io;
}