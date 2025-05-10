import { Router } from "express";
import { isValid } from "../../middleware/validation.js";
import {
  signupVal,
  loginVal,
  updateUserVal,
  changePassVal,
  updatePasswordVal,
  forgetPassVal,
  googleLoginVal,
} from "./user.validation.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  changePassword,
  deleteUser,
  forgetPassword,
  getAccount,
  getDataById,
  login,
  logout,
  signup,
  updateUser,
  updatePassword,
  verifyAcc,
  googleLogin,
  getUserCollections,
  getUserHistory,
} from "./user.controller.js";
import { roles } from "../../utils/constants/enums.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/authorization.js";

const userRouter = Router();

//signup
userRouter.post("/signup", isValid(signupVal), asyncHandler(signup));

//verify
userRouter.get("/verify/:token", asyncHandler(verifyAcc));

//login
userRouter.post("/login", isValid(loginVal), asyncHandler(login));

//logout
userRouter.post("/logout", isAuthenticated(), asyncHandler(logout));

// update user
userRouter.put(
  "/update",
  isAuthenticated(),
  isAuthorized(roles.USER),
  isValid(updateUserVal),
  asyncHandler(updateUser)
);

// update password (requires authentication)
userRouter.put(
  "/update-password",
  isAuthenticated(),
  isValid(updatePasswordVal),
  asyncHandler(updatePassword)
);

//delete
userRouter.delete(
  "/delete",
  isAuthenticated(),
  isAuthorized([roles.USER]),
  asyncHandler(deleteUser)
);

//get my data
userRouter.get("/profile", isAuthenticated(), asyncHandler(getAccount));

// Get user collections
userRouter.get(
  "/collections",
  isAuthenticated(),
  isAuthorized(roles.USER),
  asyncHandler(getUserCollections)
);

// Get user history
userRouter.get(
  "/history",
  isAuthenticated(),
  isAuthorized(roles.USER),
  asyncHandler(getUserHistory)
);

//get by id
userRouter.get("/:id", asyncHandler(getDataById));

userRouter.post(
  "/forget-password",
  isValid(forgetPassVal),
  asyncHandler(forgetPassword)
);
userRouter.put(
  "/change-password",
  isValid(changePassVal),
  asyncHandler(changePassword)
);

// Google OAuth login
userRouter.post("/google-login", isValid(googleLoginVal), asyncHandler(googleLogin));

export default userRouter;
