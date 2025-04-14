import { User } from "../../db/index.js";
import { AppError } from "../utils/appError.js";
import { emailStatus, status } from "../utils/constants/enums.js";
import { messages } from "../utils/constants/messages.js";
import { verifyToken } from "../utils/token.js";

/**
 * This middleware will check if the user is authenticated by verifying the token
 * given in the header. If the token is invalid or the user is not found, it will
 * throw an error. If the user is authenticated, it will add the `authUser` property
 * to the request object and call the next middleware.
 *
 * @param {Object} req - the request object
 * @param {Object} res - the response object
 * @param {Function} next - the next middleware
 * @returns {Promise<Object>} - a promise with the response object
 */
export const isAuthenticated = () => {
  return async (req, res, next) => {
    // token
    const { token } = req.headers;
    if (!token) {
      return next(new AppError("Authentication required. Please login.", 401));
    }
    
    // decoded token
    const payload = verifyToken({ token });
    if (payload.message) {
      // Check for specific token expiration error
      if (payload.message.includes('expired')) {
        return next(new AppError("Your session has expired. Please login again.", 401));
      }
      return next(new AppError("Invalid token. Please login again.", 401));
    }
    
    // check user exist
    const authUser = await User.findOne({
      _id: payload._id,
      emailStatus: emailStatus.VERIFIED,
    });
    if (!authUser) {
      return next(new AppError(messages.user.notFound, 404));
    }
    
    // Check if user is online
    if (authUser.status !== status.ONLINE) {
      return next(new AppError("Your account is not active. Please login again.", 401));
    }
    
    req.authUser = authUser;
    return next();
  };
};
