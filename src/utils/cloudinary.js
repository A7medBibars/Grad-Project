import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: "./config/.env" });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload file to Cloudinary
export const uploadToCloudinary = async (file, folder) => {
  try {
    // If file is a buffer (from memory storage)
    if (file.buffer) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        uploadStream.end(file.buffer);
      });
      
      return {
        public_id: result.public_id,
        url: result.secure_url,
        format: result.format,
        resource_type: result.resource_type
      };
    }
    
    // If file is a path (from disk storage)
    if (file.path) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: 'auto' // Automatically detect if it's an image or video
      });
      
      return {
        public_id: result.public_id,
        url: result.secure_url,
        format: result.format,
        resource_type: result.resource_type
      };
    }
    
    // If neither buffer nor path is available
    console.error('File has neither buffer nor path:', file.originalname);
    throw new Error('File has neither buffer nor path');
  } catch (error) {
    console.error(`Error uploading to Cloudinary: ${error.message}`);
    return null;
  }
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return { success: true };
  } catch (error) {
    console.error(`Error deleting from Cloudinary: ${error.message}`);
    return { success: false };
  }
}; 