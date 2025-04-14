import path from "path";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve("./config/.env") });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});
export default cloudinary;

/**
 * @description
 * Delete a cloudinary file by its public_id
 * @param {string} public_id the public_id of the file to delete
 * @returns {Promise<void>}
 */
export const deleteCloudFile = async (public_id) => {
  await cloudinary.uploader.destroy(public_id);
};
