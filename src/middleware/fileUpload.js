import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils/appError.js';

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

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
}).array('files', 5); // Allow up to 5 files

// Middleware wrapper for single file upload
export const handleSingleUpload = () => {
  return (req, res, next) => {
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