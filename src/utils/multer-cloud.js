import multer, { diskStorage } from "multer";
import { AppError } from "./appError.js";

const fileValidation = { file: ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp" ,"video/mp4"] };

/**
 * @description
 * Returns a multer middleware that will save a file to a local disk
 * and filter out invalid file types. The file types that are allowed
 * by default are pdf and doc. You can pass in an options object with
 * the key `allowTypes` to specify the file types you want to allow.
 * @param {{ allowTypes: string[] }} [options={}] - options object
 * @returns {import("multer").MulterMiddleware} - multer middleware
 */
export const cloudUploads = ({ allowTypes = fileValidation.file } = {}) => {
  const storage = diskStorage({});
  const fileFilter = (req, file, cb) => {
    if (!allowTypes.includes(file.mimetype)) {
      cb(new AppError("invalid file format", 400), false);
    }
    cb(null, true);
  };
  return multer({ storage, fileFilter });
};
