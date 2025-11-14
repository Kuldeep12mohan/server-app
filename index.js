import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import connectDB from "./db/db.js";
import questionRouter from "./routes/question.routes.js";

dotenv.config();
await connectDB();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

app.use(express.json());
app.use(cookieParser());

// ✅ CORS setup
console.log(CLIENT_URL)
app.use(
  cors({
    origin: CLIENT_URL, 
    credentials: true, 
  })
);


// Secrets
const SECRET_HE = process.env.HE_PASSWORD;
const SECRET_SHE = process.env.SHE_PASSWORD;

// ✅ Unlock route
app.post("/auth/unlock", (req, res) => {
  const { password, role } = req.body;
  if (!role || !password)
    return res.status(400).json({ success: false, message: "Missing role or password" });

  let isValid = false;
  if (role === "he" && password === SECRET_HE) isValid = true;
  if (role === "she" && password === SECRET_SHE) isValid = true;

  if (!isValid)
    return res.status(401).json({ success: false, message: "Wrong password" });

  const token = jwt.sign({ unlocked: true, role }, JWT_SECRET, { expiresIn: "7d" });

  // ✅ Use Secure cookie settings for production
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    secure: process.env.NODE_ENV === "production", // must be true for HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({ success: true, role });
});

// ✅ Auth status
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

// ✅ Logout
app.post("/auth/logout", (req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ success: true, message: "Logged out successfully 💖" });
});

// ✅ Routes
app.use("/questions", questionRouter);

// ✅ Start server
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
