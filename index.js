import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import connectDB from "./db/db.js";
import questionRouter from "./routes/question.routes.js";
import rateLimit from "express-rate-limit";

dotenv.config();
await connectDB();

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
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
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    secure: process.env.NODE_ENV === "production",
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
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ success: true, message: "Logged out successfully 💖" });
});

app.use("/questions", questionRouter);

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
