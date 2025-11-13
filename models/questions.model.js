import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    askedBy: { type: String, enum: ["he", "she"], required: true },
    answer: {
      answer: { type: String },
      answeredBy: { type: String, enum: ["he", "she"] },
    },
  },
  { timestamps: true }
);
export const Question = mongoose.model("Question", questionSchema);
