import mongoose from "mongoose";

const moodSchema = new mongoose.Schema(
  {
    userRole: {
      type: String,
      enum: ["he", "she"],
      required: true,
    },
    mood: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// prevent duplicate entry for same day per user
moodSchema.index({ userRole: 1, date: 1 }, { unique: true });

export const Mood = mongoose.model("Mood", moodSchema);
