import { AppError } from "../utils/appError.js";
import { messages } from "../utils/constants/messages.js";

/**
 * @description
 * This middleware will check if the user is authorized to
 * access the route by checking the role of the user against
 * the roles given as an argument.
 * @param {Array<string>} roles roles that is allowed to access the route
 * @returns {function} a middleware that throws an error if the user is not authorized
 */
export const isAuthorized = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.authUser.role)) {
      return next(new AppError(messages.user.notAuthorized, 401));
    }
    next();
  };
};
