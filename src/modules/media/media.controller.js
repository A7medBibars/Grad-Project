import { Media } from "../../../db/index.js";
import { Record } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";
import { messages } from "../../utils/constants/messages.js";
import { handleAIMediaProcessing, checkAIServerAvailability } from "./ai.service.js";
import { aiConfig } from "../../config/ai.config.js";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import axios from "axios";
import { promises as fsPromises } from "fs";
const { unlink: unlinkAsync } = fsPromises;

// Upload a single file
export const uploadMedia = async (req, res, next) => {
  // get data
  const file = req.file;
  if (!file) {
    return next(new AppError(messages.media.fileRequired, 400));
  }
  
  // Log file object structure for debugging
  console.log('File object structure:', JSON.stringify({
    fieldname: file.fieldname,
    originalname: file.originalname,
    encoding: file.encoding,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    buffer: file.buffer ? 'Buffer exists' : 'No buffer',
    destination: file.destination
  }, null, 2));
  
  const { title, description, collectionId } = req.body;

  // upload to cloudinary
  const folder = 'media_uploads';
  const cloudinaryResult = await uploadToCloudinary(file, folder);
  if (!cloudinaryResult) {
    return next(new AppError(messages.media.uploadFailed, 500));
  }

  // prepare media data
  const mediaData = {
    title,
    description,
    fileUrl: cloudinaryResult.url,
    publicId: cloudinaryResult.public_id,
    fileType: cloudinaryResult.resource_type,
    format: cloudinaryResult.format,
    size: file.size,
    collectionId: collectionId || null,
    uploadedBy: req.authUser._id,
    metadata: {} // Initialize metadata field
  };

  // Process with AI model if it's an image or video
  let aiResult = null;
  if (cloudinaryResult.resource_type === 'image' || cloudinaryResult.resource_type === 'video') {
    // Check if AI server is available
    console.log('Checking AI server availability...');
    const isAIServerAvailable = await checkAIServerAvailability();
    console.log('AI Server Available:', isAIServerAvailable);
    
    if (isAIServerAvailable) {
      try {
        // Process media with AI
        console.log('Processing media with AI...', {
          fileType: cloudinaryResult.resource_type,
          hasPath: !!file.path,
          hasBuffer: !!file.buffer,
          fileSize: file.size
        });
        
        // Pass skipAI: false to force AI processing
        const options = { skipAI: false };
        const enhancedMediaData = await handleAIMediaProcessing(file, mediaData, options);
        
        console.log('AI processing result:', {
          processed: enhancedMediaData.aiProcessed,
          status: enhancedMediaData.metadata?.aiStatus,
          error: enhancedMediaData.metadata?.aiError,
          emotion: enhancedMediaData.metadata?.emotion
        });
        
        // Update media data with AI results
        mediaData.metadata = enhancedMediaData.metadata || {};
        aiResult = enhancedMediaData.aiResults;
        
        // Create record if AI analysis was successful
        if (aiResult) {
          let recordData = {
            userId: req.authUser._id,
            collectionId: collectionId || null,
            mediaUrl: cloudinaryResult.url
          };

          // Handle different response formats from image vs video endpoints
          if (cloudinaryResult.resource_type === 'image') {
            recordData.emotion = [mediaData.metadata.emotion || 'unknown'];
            recordData.times = [0]; // Single timestamp for image
          } else {
            // For video: extract emotions and timestamps from array
            recordData.emotion = Array.isArray(aiResult) 
              ? aiResult.map(item => item.emotion) 
              : ['unknown'];
            recordData.times = Array.isArray(aiResult)
              ? aiResult.map(item => item.timestamp)
              : [0];
          }

          // Save record
          const record = new Record(recordData);
          await record.save();
        }
      } catch (error) {
        console.error('AI processing error:', error.message);
        // Continue without AI analysis if processing fails
      }
    } else {
      console.log('AI server is not available. Continuing without AI processing.');
    }
  }

  // Create and save media document
  const media = new Media(mediaData);
  const savedMedia = await media.save();
  if (!savedMedia) {
    // Rollback cloudinary upload
    await deleteFromCloudinary(cloudinaryResult.public_id, cloudinaryResult.resource_type);
    return next(new AppError(messages.media.failToSave, 500));
  }

  // Populate uploaded info
  const populatedMedia = await Media.findById(savedMedia._id).populate(
    "uploadedBy",
    "name"
  );

  // send response
  res.status(201).json({
    success: true,
    message: messages.media.uploadSuccess,
    data: populatedMedia,
    aiProcessed: !!aiResult
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

  // Check if AI server is available once for all files
  const isAIServerAvailable = await checkAIServerAvailability();

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

    // prepare media data
    const mediaData = {
      title: Array.isArray(title) ? title[index] || `Uploaded file ${index + 1}` : title || `Uploaded file ${index + 1}`,
      description: Array.isArray(description) ? description[index] || '' : description || '',
      fileUrl: cloudinaryResult.url,
      publicId: cloudinaryResult.public_id,
      fileType: cloudinaryResult.resource_type,
      format: cloudinaryResult.format,
      size: file.size,
      collectionId: collectionId || null,
      uploadedBy: req.authUser._id,
      metadata: {} // Initialize metadata field
    };

    // Process with AI model if it's an image or video and AI server is available
    let aiResult = null;
    if ((cloudinaryResult.resource_type === 'image' || cloudinaryResult.resource_type === 'video') && isAIServerAvailable) {
      try {
        // Process media with AI
        console.log('Processing media with AI...', {
          fileType: cloudinaryResult.resource_type,
          hasPath: !!file.path,
          hasBuffer: !!file.buffer,
          fileSize: file.size
        });
        
        // Pass skipAI: false to force AI processing
        const options = { skipAI: false };
        const enhancedMediaData = await handleAIMediaProcessing(file, mediaData, options);
        
        console.log('AI processing result:', {
          processed: enhancedMediaData.aiProcessed,
          status: enhancedMediaData.metadata?.aiStatus,
          error: enhancedMediaData.metadata?.aiError,
          emotion: enhancedMediaData.metadata?.emotion
        });
        
        // Update media data with AI results
        mediaData.metadata = enhancedMediaData.metadata || {};
        aiResult = enhancedMediaData.aiResults;
        
        // Save AI result for response
        if (aiResult) {
          // Create record
          let recordData = {
            userId: req.authUser._id,
            collectionId: collectionId || null,
            mediaUrl: cloudinaryResult.url
          };

          // Handle different response formats from image vs video endpoints
          if (cloudinaryResult.resource_type === 'image') {
            recordData.emotion = [mediaData.metadata.emotion || 'unknown'];
            recordData.times = [0]; // Single timestamp for image
          } else {
            // For video: extract emotions and timestamps from array
            recordData.emotion = Array.isArray(aiResult) 
              ? aiResult.map(item => item.emotion) 
              : ['unknown'];
            recordData.times = Array.isArray(aiResult)
              ? aiResult.map(item => item.timestamp)
              : [0];
          }

          // Save record
          const record = new Record(recordData);
          await record.save();
          
          aiResults.push({ mediaId: null, analysis: aiResult }); // MediaId will be updated after save
        }
      } catch (error) {
        console.error(`AI processing error for file ${index}:`, error.message);
        // Continue without AI analysis if processing fails
      }
    }

    // save media data
    const media = new Media(mediaData);
    const savedMedia = await media.save();
    if (!savedMedia) {
      throw new AppError(messages.media.failToSave, 500);
    }

    savedMediaIds.push(savedMedia._id);
    
    // Update mediaId in aiResults if we have a result for this file
    if (aiResult && aiResults.length > 0) {
      const lastAiResult = aiResults[aiResults.length - 1];
      if (lastAiResult.mediaId === null) {
        lastAiResult.mediaId = savedMedia._id;
      }
    }

    return {
      media: savedMedia,
      aiProcessed: !!aiResult
    };
  });

  try {
    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);
    
    // Populate uploaded media with user info
    const populatedMedia = await Media.find({ _id: { $in: savedMediaIds } }).populate(
      "uploadedBy",
      "name"
    );

    // send response
    res.status(201).json({
      success: true,
      message: messages.media.uploadSuccess,
      data: populatedMedia,
      aiResults: aiResults.length > 0 ? aiResults : null
    });
  } catch (error) {
    // Rollback cloudinary uploads on error
    for (const file of uploadedFiles) {
      await deleteFromCloudinary(file.public_id, file.resource_type);
    }
    
    // Rollback saved media
    if (savedMediaIds.length > 0) {
      await Media.deleteMany({ _id: { $in: savedMediaIds } });
    }
    
    return next(error);
  }
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
  
  // find media
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

// Process existing media with AI
export const processMediaWithAI = async (req, res, next) => {
  // Get media ID from params
  const { mediaId } = req.params;
  
  // Check if media exists
  const media = await Media.findById(mediaId);
  if (!media) {
    return next(new AppError(messages.media.notFound, 404));
  }
  
  // Check authorization
  if (req.authUser._id.toString() !== media.uploadedBy.toString()) {
    return next(new AppError(messages.media.notAuthorized, 403));
  }
  
  try {
    // Get file from cloudinary/local storage
    // For demonstration, we'll assume we need to download it from cloudinary
    const tempFilePath = path.join(__dirname, '../../../', 'uploads', `temp_${media.publicId.replace(/\//g, '_')}.${media.format}`);
    
    // Download file from Cloudinary using axios
    const fileResponse = await axios({
      method: 'get',
      url: media.fileUrl,
      responseType: 'stream'
    });
    
    // Create a write stream to save the file temporarily
    const writer = fs.createWriteStream(tempFilePath);
    fileResponse.data.pipe(writer);
    
    // Wait for the file to be fully downloaded
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Create a mock file object for AI processing
    const mockFile = {
      path: tempFilePath,
      mimetype: media.fileType === 'image' ? `image/${media.format}` : `video/${media.format}`,
      originalname: `${media._id}.${media.format}`
    };
    
    // Process with AI
    const mediaData = {
      _id: media._id,
      title: media.title,
      description: media.description,
      metadata: media.metadata || {}
    };
    
    const enhancedMediaData = await handleAIMediaProcessing(mockFile, mediaData);
    
    // Update media document with AI results
    const updatedMedia = await Media.findByIdAndUpdate(
      mediaId,
      { 
        metadata: enhancedMediaData.metadata,
        aiProcessed: !!enhancedMediaData.aiProcessed
      },
      { new: true }
    ).populate("uploadedBy", "name");
    
    // Create record if AI analysis was successful
    if (enhancedMediaData.aiResults) {
      const aiResult = enhancedMediaData.aiResults;
      let recordData = {
        userId: req.authUser._id,
        collectionId: media.collectionId || null,
        mediaUrl: media.fileUrl
      };

      // Handle different response formats from image vs video endpoints
      if (media.fileType === 'image') {
        recordData.emotion = [enhancedMediaData.metadata.emotion || 'unknown'];
        recordData.times = [0]; // Single timestamp for image
      } else {
        // For video: extract emotions and timestamps from array
        recordData.emotion = Array.isArray(aiResult) 
          ? aiResult.map(item => item.emotion) 
          : ['unknown'];
        recordData.times = Array.isArray(aiResult)
          ? aiResult.map(item => item.timestamp)
          : [0];
      }

      // Save record
      const record = new Record(recordData);
      await record.save();
    }
    
    // Delete temporary file
    await unlinkAsync(tempFilePath);
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'AI processing completed successfully',
      data: updatedMedia
    });
  } catch (error) {
    // Handle errors
    return next(new AppError(`AI processing failed: ${error.message}`, 500));
  }
};

// Check AI server availability
export const checkAIAvailability = async (req, res, next) => {
  try {
    const isAvailable = await checkAIServerAvailability();
    
    res.status(200).json({
      success: true,
      data: {
        aiAvailable: isAvailable,
        aiEnabled: aiConfig.enabled
      }
    });
  } catch (error) {
    return next(new AppError(`Error checking AI availability: ${error.message}`, 500));
  }
};