import express from "express";
import jwt from "jsonwebtoken";
import { Question } from "../models/questions.model.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// 🧠 Middleware to verify session
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

// 💬 Ask a question
router.post("/ask", verifySession, async (req, res) => {
  try {
    const { text } = req.body;
    const askedBy = req.role;

    if (!text) {
      return res.status(400).json({ success: false, message: "Question text is required" });
    }

    const question = new Question({ text, askedBy });
    await question.save();

    res.json({ success: true, message: "Question added successfully 💌", question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🌸 Get current user's questions
router.get("/", verifySession, async (req, res) => {
  try {
    const myQuestions = await Question.find({ askedBy: req.role })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, questions: myQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch questions" });
  }
});

// 💞 Get other user's questions
router.get("/their-questions", verifySession, async (req, res) => {
  try {
    const otherRole = req.role === "he" ? "she" : "he";
    const theirQuestions = await Question.find({
      askedBy: otherRole,
      answer: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, questions: theirQuestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
    });
  }
});
router.post("/:questionId/answer", verifySession, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { answer } = req.body;
    const answeredBy = req.role;
    console.log(answer)

    if (!answer) {
      return res.status(400).json({ success: false, message: "Answer text is required" });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    if (question.askedBy === answeredBy) {
      return res.status(403).json({ success: false, message: "You cannot answer your own question" });
    }

    question.answer = { answer, answeredBy };
    await question.save();
    console.log(question)

    res.json({ success: true, message: "Answer added successfully 💬", question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to answer question" });
  }
});



export default router;
