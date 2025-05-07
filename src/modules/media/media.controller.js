import { Media } from "../../../db/index.js";
import { Record } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";
import { messages } from "../../utils/constants/messages.js";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

// Upload a single file
export const uploadMedia = async (req, res, next) => {
  // get data
  const file = req.file;
  if (!file) {
    return next(new AppError(messages.media.fileRequired, 400));
  }
  const { title, description, collectionId } = req.body;

  // upload to cloudinary
  const folder = 'media_uploads';
  const cloudinaryResult = await uploadToCloudinary(file, folder);
  if (!cloudinaryResult) {
    return next(new AppError(messages.media.uploadFailed, 500));
  }

  // prepare media data
  const media = new Media({
    title,
    description,
    fileUrl: cloudinaryResult.url,
    publicId: cloudinaryResult.public_id,
    fileType: cloudinaryResult.resource_type,
    format: cloudinaryResult.format,
    size: file.size,
    collectionId: collectionId || null,
    uploadedBy: req.authUser._id
  });

  // save media data
  const savedMedia = await media.save();
  if (!savedMedia) {
    // Rollback cloudinary upload
    await deleteFromCloudinary(cloudinaryResult.public_id, cloudinaryResult.resource_type);
    return next(new AppError(messages.media.failToSave, 500));
  }

  // Process with AI model if it's an image or video
  let aiResult = null;
  if (cloudinaryResult.resource_type === 'image' || cloudinaryResult.resource_type === 'video') {
    // Create form data for AI API request
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path));

    // Determine which endpoint to use based on file type
    const endpoint = cloudinaryResult.resource_type === 'image' 
      ? 'http://localhost:5000/predict/image' 
      : 'http://localhost:5000/predict/video';

    // Call AI API
    let aiResponse;
    try {
      aiResponse = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });
    } catch (error) {
      console.error('AI API connection error:', error.message);
      // Continue without AI analysis if the API request fails
    }

    if (aiResponse && !aiResponse.ok) {
      console.error('AI analysis failed:', await aiResponse.text());
    } else if (aiResponse) {
      try {
        aiResult = await aiResponse.json();
        
        // Create record if AI analysis was successful
        if (aiResult) {
          let recordData = {
            userId: req.authUser._id,
            collectionId: collectionId || null,
            mediaUrl: cloudinaryResult.url
          };

          // Handle different response formats from image vs video endpoints
          if (cloudinaryResult.resource_type === 'image') {
            recordData.emotion = [aiResult.emotion];
            recordData.times = [0]; // Single timestamp for image
          } else {
            // For video: extract emotions and timestamps from array
            recordData.emotion = aiResult.map(item => item.emotion);
            recordData.times = aiResult.map(item => item.timestamp);
          }

          // Save record
          const record = new Record(recordData);
          await record.save();
          // No need to handle record save failure as it shouldn't affect media upload
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError.message);
        // Continue without AI analysis if parsing fails
      }
    }
  }

  // populate the user who uploaded the media
  const populatedMedia = await Media.findById(savedMedia._id).populate(
    "uploadedBy",
    "firstName lastName"
  );

  // send response
  res.status(201).json({
    success: true,
    message: messages.media.uploadSuccess,
    data: populatedMedia,
    aiAnalysis: aiResult
  });
};

// Upload multiple files
export const uploadMultipleMedia = async (req, res, next) => {
  // get data
  const files = req.files;
  if (!files || files.length === 0) {
    return next(new AppError(messages.media.filesRequired, 400));
  }
  const { title, description, collectionId } = req.body;

  // Keep track of uploaded files for rollback
  const uploadedFiles = [];
  const savedMediaIds = [];
  const aiResults = [];
  
  // process each file
  const uploadPromises = files.map(async (file, index) => {
    // upload to cloudinary
    const folder = 'media_uploads';
    const cloudinaryResult = await uploadToCloudinary(file, folder);
    if (!cloudinaryResult) {
      throw new AppError(messages.media.uploadFailed, 500);
    }

    // Track uploaded file for potential rollback
    uploadedFiles.push({
      public_id: cloudinaryResult.public_id,
      resource_type: cloudinaryResult.resource_type
    });

    // prepare data
    const media = new Media({
      title: Array.isArray(title) ? title[index] || `Uploaded file ${index + 1}` : title || `Uploaded file ${index + 1}`,
      description: Array.isArray(description) ? description[index] || '' : description || '',
      fileUrl: cloudinaryResult.url,
      publicId: cloudinaryResult.public_id,
      fileType: cloudinaryResult.resource_type,
      format: cloudinaryResult.format,
      size: file.size,
      collectionId: collectionId || null,
      uploadedBy: req.authUser._id
    });

    // save data
    const savedMedia = await media.save();
    if (!savedMedia) {
      throw new AppError(messages.media.failToSave, 500);
    }

    savedMediaIds.push(savedMedia._id);

    // Process with AI model if it's an image or video
    let aiResult = null;
    if (cloudinaryResult.resource_type === 'image' || cloudinaryResult.resource_type === 'video') {
      // Create form data for AI API request
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path));

      // Determine which endpoint to use based on file type
      const endpoint = cloudinaryResult.resource_type === 'image' 
        ? 'http://localhost:5000/predict/image' 
        : 'http://localhost:5000/predict/video';

      // Call AI API
      let aiResponse;
      try {
        aiResponse = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        if (!aiResponse.ok) {
          console.error('AI analysis failed:', await aiResponse.text());
        } else {
          aiResult = await aiResponse.json();
          aiResults.push({ mediaId: savedMedia._id, analysis: aiResult });
          
          // Create record if AI analysis was successful
          if (aiResult) {
            let recordData = {
              userId: req.authUser._id,
              collectionId: collectionId || null,
              mediaUrl: cloudinaryResult.url
            };

            // Handle different response formats from image vs video endpoints
            if (cloudinaryResult.resource_type === 'image') {
              recordData.emotion = [aiResult.emotion];
              recordData.times = [0]; // Single timestamp for image
            } else {
              // For video: extract emotions and timestamps from array
              recordData.emotion = aiResult.map(item => item.emotion);
              recordData.times = aiResult.map(item => item.timestamp);
            }

            // Save record
            const record = new Record(recordData);
            await record.save();
            // No need to handle record save failure as it shouldn't affect media upload
          }
        }
      } catch (error) {
        console.error('AI processing error:', error.message);
        // Continue with other files even if AI processing fails for one
      }
    }

    return savedMedia._id;
  }).map(p => p.catch(e => e)); // Handle individual promise rejections

  // execute all uploads and handle errors
  const results = await Promise.all(uploadPromises);
  
  // Check for errors
  const errors = results.filter(result => result instanceof Error);
  if (errors.length > 0) {
    // Rollback all successful uploads
    for (const file of uploadedFiles) {
      await deleteFromCloudinary(file.public_id, file.resource_type);
    }
    
    // Delete saved media from database
    for (const mediaId of savedMediaIds) {
      await Media.findByIdAndDelete(mediaId);
    }
    
    return next(new AppError(errors[0].message || messages.media.uploadFailed, 500));
  }

  // Get successful uploads
  const mediaIds = results;

  // populate uploaded media
  const populatedMedia = await Media.find({
    _id: { $in: mediaIds }
  }).populate("uploadedBy", "firstName lastName");

  // send response
  res.status(201).json({
    success: true,
    message: messages.media.multipleUploadSuccess,
    data: populatedMedia,
    aiAnalysis: aiResults
  });
};

// Get media by ID
export const getMedia = async (req, res, next) => {
  // get media id
  const { mediaId } = req.params;
  
  // find media
  const media = await Media.findById(mediaId).populate(
    "uploadedBy",
    "name"
  );
  
  // check if media exists
  if (!media) {
    return next(new AppError(messages.media.notFound, 404));
  }
  
  // send response
  res.status(200).json({
    success: true,
    data: media
  });
};

// Delete media
export const deleteMedia = async (req, res, next) => {
  // get media id
  const { mediaId } = req.params;
  
  // check if media exists
  const media = await Media.findById(mediaId);
  if (!media) {
    return next(new AppError(messages.media.notFound, 404));
  }
  
  // check authorization
  if (req.authUser._id.toString() !== media.uploadedBy.toString()) {
    return next(new AppError(messages.media.notAuthorized, 403));
  }
  
  // populate media before deleting
  const populatedMedia = await Media.findById(mediaId).populate(
    "uploadedBy",
    "name"
  );
  
  // delete from cloudinary
  const cloudinaryResult = await deleteFromCloudinary(media.publicId, media.fileType);
  if (!cloudinaryResult || !cloudinaryResult.success) {
    return next(new AppError(messages.media.failToDelete, 500));
  }
  
  // delete from database
  const deletedMedia = await Media.findByIdAndDelete(mediaId);
  if (!deletedMedia) {
    return next(new AppError(messages.media.failToDelete, 500));
  }
  
  // send response
  res.status(200).json({
    success: true,
    message: messages.media.deleteSuccess,
    data: populatedMedia
  });
};

// Get all media for a collection
export const getMediaByCollection = async (req, res, next) => {
  // get collection id
  const { collectionId } = req.params;
  
  // find all media in collection
  const media = await Media.find({ collectionId }).populate(
    "uploadedBy",
    "name"
  );
  
  // send response
  res.status(200).json({
    success: true,
    data: media
  });
}; 