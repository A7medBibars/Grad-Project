import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Upload file to Cloudinary
export const uploadToCloudinary = async (filePath, folder) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto' // Automatically detect if it's an image or video
    });
    return {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      resource_type: result.resource_type
    };
  } catch (error) {
    throw new Error(`Error uploading to Cloudinary: ${error.message}`);
  }
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return { success: true };
  } catch (error) {
    throw new Error(`Error deleting from Cloudinary: ${error.message}`);
  }
}; 