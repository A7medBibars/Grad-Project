import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./config/.env" });

export const connectDB = () => {
  const DB_URI = process.env.DB_URI || "mongodb://127.0.0.1:27017/gradproject";
  
  // Configure mongoose for Vercel
  mongoose.set('strictQuery', true);
  
  mongoose
    .connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      console.log("Database connected successfully");
    })
    .catch((err) => {
      console.error("Failed to connect to database:", err.message);
      // Try to reconnect after 5 seconds
      setTimeout(connectDB, 5000);
    });
};
