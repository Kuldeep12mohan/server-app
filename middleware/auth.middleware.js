import jwt from "jsonwebtoken";
import config from "../config/config.js";

export function verifyToken(req, res, next) {
  const token = req.cookies.session;
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}