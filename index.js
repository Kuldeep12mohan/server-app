import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import connectDB from "./db/db.js";
import questionRouter from "./routes/question.routes.js"

dotenv.config();
await connectDB();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173", // frontend URL
    credentials: true,
  })
);

const SECRET_HE = process.env.HE_PASSWORD;
const SECRET_SHE = process.env.SHE_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

app.post("/auth/unlock", (req, res) => {
  const { password, role } = req.body;

  if (!role || !password)
    return res.status(400).json({ success: false, message: "Missing role or password" });

  let isValid = false;

  if (role === "he" && password === SECRET_HE) isValid = true;
  if (role === "she" && password === SECRET_SHE) isValid = true;

  if (!isValid) {
    return res.status(401).json({ success: false, message: "Wrong password" });
  }

  const token = jwt.sign({ unlocked: true, role }, JWT_SECRET, { expiresIn: "7d" });

  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
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
    sameSite: "strict",
    secure: false, // true in production
  });
  res.json({ success: true, message: "Logged out successfully 💖" });
});

app.use("/questions",questionRouter);
app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));
