import multer from 'multer';
import { AppError } from '../utils/appError.js';

// Configure memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images and videos only
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only images and videos are allowed!', 400), false);
  }
};

// Export multer instances for different use cases
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
}).single('file');

export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
}).array('files', 5);

// Middleware wrapper for single file upload
export const handleSingleUpload = () => {
  return (req, res, next) => {
    // Check if there's a mediaUrl in the body, and skip file upload in that case
    if (req.body && req.body.mediaUrl) {
      return next();
    }
    
    uploadSingle(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred
        return next(new AppError(`Multer error: ${err.message}`, 400));
      } else if (err) {
        // An unknown error occurred
        return next(err);
      }
      
      // File is optional in this middleware
      // Let the controller decide if it's required
      next();
    });
  };
};

// Middleware wrapper for multiple file upload
export const handleMultipleUploads = () => {
  return (req, res, next) => {
    // Check if there's a mediaUrls array in the body, and skip file upload in that case
    if (req.body && req.body.mediaUrls && req.body.mediaUrls.length > 0) {
      return next();
    }
    
    uploadMultiple(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred
        return next(new AppError(`Multer error: ${err.message}`, 400));
      } else if (err) {
        // An unknown error occurred
        return next(err);
      }
      
      // Files are optional in this middleware
      // Let the controller decide if they're required
      next();
    });
  };
}; 