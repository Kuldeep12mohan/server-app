import express from "express";
import jwt from "jsonwebtoken";
import { Mood } from "../models/mood.model.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

function verifySession(req, res, next) {
  const token = req.cookies.session;
  if (!token)
    return res.status(401).json({ success: false, message: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.role = decoded.role;
    next();
  } catch {
    return res.status(403).json({ success: false, message: "Invalid session" });
  }
}

// ⭐ 1) Save today’s mood
router.post("/", verifySession, async (req, res) => {
  try {
    const { mood, note } = req.body;
    const userRole = req.role;

    if (!mood)
      return res.status(400).json({ success: false, message: "Mood is required" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const entry = await Mood.findOneAndUpdate(
      { userRole, date: today },
      { mood, note, date: today },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "Mood saved!", entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ⭐ 2) Get today's mood for logged user
router.get("/today", verifySession, async (req, res) => {
  try {
    const userRole = req.role;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mood = await Mood.findOne({ userRole, date: today }).lean();

    res.json({ success: true, mood });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch today’s mood" });
  }
});

// ⭐ 3) Get mood history (last 30 days)
router.get("/history", verifySession, async (req, res) => {
  try {
    const userRole = req.role;

    const history = await Mood.find({ userRole })
      .sort({ date: -1 })
      .limit(30)
      .lean();

    res.json({ success: true, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch history" });
  }
});

// ⭐ 4) Get partner’s today mood
router.get("/partner-today", verifySession, async (req, res) => {
  try {
    const partnerRole = req.role === "he" ? "she" : "he";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mood = await Mood.findOne({ userRole: partnerRole, date: today }).lean();

    res.json({ success: true, mood });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch partner mood" });
  }
});

export default router;
