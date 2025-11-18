import { Router } from "express";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import { authLimiter } from "../middleware/ratelimiter.middleware.js";

const router = Router();

router.post("/unlock", authLimiter, (req, res) => {
  const { password, role } = req.body;
  if (!role || !password) {
    return res.status(400).json({ success: false, message: "Missing role or password" });
  }

  let isValid = false;
  if (role === "he" && password === config.HE_PASSWORD) isValid = true;
  if (role === "she" && password === config.SHE_PASSWORD) isValid = true;

  if (!isValid) {
    return res.status(401).json({ success: false, message: "Wrong password" });
  }

  const token = jwt.sign({ unlocked: true, role }, config.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("session", token, {
    httpOnly: true,
    sameSite: config.IS_PROD ? "none" : "strict",
    secure: config.IS_PROD,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, role });
});

router.get("/status", (req, res) => {
  const token = req.cookies.session;
  if (!token) return res.json({ unlocked: false });

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    return res.json({ unlocked: true, role: decoded.role });
  } catch {
    return res.json({ unlocked: false });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    sameSite: config.IS_PROD ? "none" : "strict",
    secure: config.IS_PROD,
    path: "/",
  });
  res.json({ success: true, message: "Logged out successfully 💖" });
});

export default router;