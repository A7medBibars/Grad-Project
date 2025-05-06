import express from "express";
import dotenv from "dotenv";
import passport from "passport";
import session from "express-session";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { connectDB } from "./db/connection.js";
import { globalErrorHandling } from "./src/middleware/asyncHandler.js";
import * as allRouters from "./src/index.js";
import { User } from "./db/index.js";
import { emailStatus, status } from "./src/utils/constants/enums.js";
import cors from "cors";

// Load environment variables
dotenv.config({ path: "./config/.env" });

//init app
const app = express();

// connection
const PORT = process.env.PORT || 3000;
connectDB();

// Configure CORS for Vercel
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

// parse
app.use(express.json());

// Configure session for Vercel
app.use(
  session({
    secret: process.env.JWT_SECRET || 'session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/user/auth/google/callback",
      scope: ["profile", "email"]
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
          // Create new user
          user = await User.create({
            googleId: profile.id,
            firstName: profile.name.givenName || profile.displayName.split(' ')[0],
            lastName: profile.name.familyName || profile.displayName.split(' ')[1] || '',
            email: profile.emails[0].value,
            emailStatus: emailStatus.VERIFIED,
            status: status.ONLINE
          });
        } else {
          // Update user status
          user.status = status.ONLINE;
          await user.save();
        }
        
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// serve static files from uploads folder
app.use('/uploads', express.static('uploads'));

// routes
app.use("/user", allRouters.userRouter);
app.use("/collections", allRouters.collectionRouter);
app.use("/media", allRouters.mediaRouter);
app.use("/records", allRouters.recordsRouter);

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

// Add a basic health check route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

//global error handling
app.use(globalErrorHandling);

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
