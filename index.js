import express from "express";
import dotenv from "dotenv";
import passport from "passport";
import session from "express-session";
import GoogleStrategy from "passport-google-oauth20";
import { connectDB } from "./db/connection.js";
import { globalErrorHandling } from "./src/middleware/asyncHandler.js";
import * as allRouters from "./src/index.js";

// Load environment variables
dotenv.config();

//init app
const app = express();

// connection
const PORT = process.env.PORT || 3000;
connectDB();

// parse
app.use(express.json());

// serve static files from uploads folder
app.use('/uploads', express.static('uploads'));

// routes
app.use("/user", allRouters.userRouter);
app.use("/collections", allRouters.collectionRouter);
app.use("/media", allRouters.mediaRouter);

//global error handling
app.use(globalErrorHandling);

//listen
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
