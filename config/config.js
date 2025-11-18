import dotenv from "dotenv";
dotenv.config();

const config = {
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  JWT_SECRET: process.env.JWT_SECRET || "supersecretkey",
  IS_PROD: process.env.NODE_ENV === "production",
  HE_PASSWORD: process.env.HE_PASSWORD,
  SHE_PASSWORD: process.env.SHE_PASSWORD,
};

export default config;