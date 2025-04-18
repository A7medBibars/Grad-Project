import { AppError } from "../utils/appError.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      const statusCode = err.statusCode || 500;
      return next(new AppError(err.message, statusCode));
    });
  };
};
/**
 * @description
 * This middleware is used to handle any errors that might occur in the application.
 * It will catch any errors that are thrown and rollback any cloudinary files that
 * were uploaded. It will then return a JSON response with the error message and a
 * status code of 500.
 * @param {Object} err - the error object
 * @param {Object} req - the request object
 * @param {Object} res - the response object
 * @param {Function} next - the next middleware
 * @returns {Promise<Object>} - a JSON response with the error message and a status code of 500
 */
export const globalErrorHandling = async (err, req, res, next) => {
  // rollback cloud
  if (req.failFile) {
    await deleteFromCloudinary(req.failFile.public_id, req.failFile.resource_type || 'image');
  }
  if (req.failFiles?.length > 0) {
    for (const file of req.failFiles) {
      if (typeof file === 'string') {
        await deleteFromCloudinary(file);
      } else if (file?.public_id) {
        await deleteFromCloudinary(file.public_id, file.resource_type || 'image');
      }
    }
  }
  return res
    .status(err.statusCode || 500)
    .json({ message: err.message, success: false });
};
