import { Media } from "../../../db/index.js";
import { Record } from "../../../db/index.js";
import { Collection } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";
import { messages } from "../../utils/constants/messages.js";
import { 
  handleAIMediaProcessing, 
  checkAIServerAvailability,
  getDominantEmotion
} from "./ai.service.js";
import { aiConfig } from "../../config/ai.config.js";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import axios from "axios";
import { promises as fsPromises } from "fs";
import { extractMediaFromUrl } from "./url-extraction.service.js";
const { unlink: unlinkAsync } = fsPromises;

// Upload a single file
export const uploadMedia = async (req, res, next) => {
  // Create an array to store saved media IDs (for error handling)
  const savedMediaIds = [];
  let cloudinaryResult = null;
  let mediaData = {};
  let file = null;
  let isExtractedFile = false;
  
  try {
    // Check if a URL was provided
    const { mediaUrl } = req.body;
    
    if (mediaUrl) {
      // Extract media from URL
      console.log(`Extracting media from URL: ${mediaUrl}`);
      const extractionResult = await extractMediaFromUrl(mediaUrl);
      file = extractionResult.file;
      isExtractedFile = true;
      
      // Add source URL to the metadata
      mediaData.sourceUrl = mediaUrl;
    } else {
      // Use the uploaded file
      file = req.file;
    }
    
    if (!file) {
      return next(new AppError('No file uploaded and no mediaUrl provided. Please either upload a file or provide a mediaUrl.', 400));
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
    cloudinaryResult = await uploadToCloudinary(file, folder);
    if (!cloudinaryResult) {
      return next(new AppError(messages.media.uploadFailed, 500));
    }

    // prepare media data
    mediaData = {
      ...mediaData, // Keep any existing properties like sourceUrl
      title,
      description,
      fileUrl: cloudinaryResult.url,
      publicId: cloudinaryResult.public_id,
      fileType: cloudinaryResult.resource_type,
      format: cloudinaryResult.format,
      size: file.size,
      collectionId: collectionId || null,
      uploadedBy: req.authUser._id,
      metadata: mediaData.metadata || {} // Initialize metadata field
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
        } catch (error) {
          console.error('AI processing error:', error.message);
          // Continue without AI analysis if processing fails
        }
      } else {
        console.log('AI server is not available. Continuing without AI processing.');
      }
    }

    // Create a record for this media regardless of AI processing
    let recordData = {
      userId: req.authUser._id,
      mediaUrl: cloudinaryResult.url
    };

    // Only include collectionId if it's specified
    if (collectionId) {
      recordData.collectionId = collectionId;
    }

    // If AI processing was successful, add emotion data
    if (aiResult) {
      // For image
      if (cloudinaryResult.resource_type === 'image') {
        recordData.emotion = [mediaData.metadata.emotion || 'unknown'];
        recordData.times = [0]; // Single timestamp for image
        
        // For image, just include the main emotion in the response
        mediaData.metadata.aiAnalysis = {
          emotion: mediaData.metadata.emotion || 'unknown'
        };
      } 
      // For video
      else {
        // Extract emotions and timestamps from array
        if (Array.isArray(aiResult)) {
          console.log('Video analysis result contains', aiResult.length, 'entries');
          
          // Store all emotions and timestamps
          recordData.emotion = aiResult.map(item => item.emotion);
          recordData.times = aiResult.map(item => item.timestamp);
          
          // For video, include detailed timeline in the response
          mediaData.metadata.aiAnalysis = {
            emotion: getDominantEmotion(aiResult), // Set the dominant emotion as the main one
            timeline: aiResult
          };
        } else {
          console.warn('Expected array for video analysis but got:', typeof aiResult);
          recordData.emotion = ['unknown'];
          recordData.times = [0];
          mediaData.metadata.aiAnalysis = {
            emotion: 'unknown',
            timeline: []
          };
        }
      }
    } 
    // If no AI processing, add default values
    else {
      recordData.emotion = ['unknown'];
      recordData.times = [0];
      mediaData.metadata.aiAnalysis = {
        emotion: 'unknown'
      };
    }

    // Save the record
    const record = new Record(recordData);
    const savedRecord = await record.save();

    // Keep record ID reference in metadata
    mediaData.metadata.recordId = savedRecord._id;

    // Create and save media document
    const media = new Media(mediaData);
    const savedMedia = await media.save();
    if (!savedMedia) {
      // Rollback cloudinary upload and record
      await deleteFromCloudinary(cloudinaryResult.public_id, cloudinaryResult.resource_type);
      
      // Delete the record we just created if save failed
      if (mediaData.metadata && mediaData.metadata.recordId) {
        await Record.findByIdAndDelete(mediaData.metadata.recordId);
      }
      
      return next(new AppError(messages.media.failToSave, 500));
    }

    savedMediaIds.push(savedMedia._id);

    // Populate uploaded info
    const populatedMedia = await Media.findById(savedMedia._id)
      .populate("uploadedBy", "name")
      .populate("collectionId", "name");

    // Get the record data for the response
    const populatedRecord = await Record.findById(mediaData.metadata.recordId)
      .populate("collectionId", "name");

    // send response
    res.status(201).json({
      success: true,
      message: messages.media.uploadSuccess,
      data: populatedMedia,
      aiProcessed: !!aiResult,
      record: populatedRecord ? {
        emotions: populatedRecord.emotion,
        times: populatedRecord.times,
        collection: populatedRecord.collectionId ? {
          id: populatedRecord.collectionId._id,
          name: populatedRecord.collectionId.name
        } : null
      } : null
    });
  } catch (error) {
    // If we reach this catch block, there was an unexpected error
    console.error('Unexpected error in uploadMedia:', error);
    
    // Clean up any Cloudinary uploads
    if (cloudinaryResult) {
      await deleteFromCloudinary(cloudinaryResult.public_id, cloudinaryResult.resource_type);
    }
    
    // Clean up any records created
    if (mediaData?.metadata?.recordId) {
      try {
        await Record.findByIdAndDelete(mediaData.metadata.recordId);
      } catch (cleanupError) {
        console.error('Error cleaning up record:', cleanupError);
      }
    }
    
    // Clean up any media created
    if (savedMediaIds.length > 0) {
      try {
        await Media.deleteMany({ _id: { $in: savedMediaIds } });
      } catch (cleanupError) {
        console.error('Error cleaning up media:', cleanupError);
      }
    }
    
    // Clean up temporarily extracted files if they exist
    if (isExtractedFile && file && file.path) {
      try {
        await unlinkAsync(file.path);
        console.log(`Cleaned up temporary file: ${file.path}`);
      } catch (cleanupError) {
        console.error(`Error cleaning up temporary file: ${cleanupError.message}`);
      }
    }
    
    return next(new AppError(error.message || 'Error uploading media', 500));
  }
};

// Upload multiple files
export const uploadMultipleMedia = async (req, res, next) => {
  // Arrays to track created/uploaded resources for error handling and rollback
  const savedMediaIds = [];
  const uploadedFiles = [];
  const extractedFiles = [];
  let isAIServerAvailable = false;
  
  try {
    // Check if AI server is available
    isAIServerAvailable = await checkAIServerAvailability();
    
    // Get data from request
    const { files } = req;
    const { title, description, collectionId, mediaUrls } = req.body;
    
    // Handle case when neither files nor media URLs are provided
    if ((!files || !files.length) && (!mediaUrls || !mediaUrls.length)) {
      return next(new AppError('No files uploaded and no mediaUrls provided. Please either upload files or provide mediaUrls.', 400));
    }
    
    // Process all files - both uploaded files and extracted from URLs
    let allFiles = [];
    
    // Add uploaded files
    if (files && files.length) {
      allFiles = [...files];
    }
    
    // Process media URLs if provided
    if (mediaUrls && mediaUrls.length) {
      try {
        // Extract media from each URL
        const urlPromises = mediaUrls.map(async (url) => {
          try {
            console.log(`Extracting media from URL: ${url}`);
            const extractionResult = await extractMediaFromUrl(url);
            extractedFiles.push(extractionResult.file);
            return {
              file: extractionResult.file,
              sourceUrl: url
            };
          } catch (error) {
            console.error(`Error extracting media from URL ${url}:`, error.message);
            return null;
          }
        });
        
        const extractedResults = await Promise.all(urlPromises);
        const validExtractedResults = extractedResults.filter(result => result !== null);
        
        // Add extracted files to all files
        allFiles = [
          ...allFiles,
          ...validExtractedResults.map(result => ({
            ...result.file,
            sourceUrl: result.sourceUrl
          }))
        ];
      } catch (error) {
        console.error('Error processing media URLs:', error.message);
      }
    }
    
    if (allFiles.length === 0) {
      return next(new AppError('No valid files were found to upload', 400));
    }
    
    // Process each file
    const uploadPromises = allFiles.map(async (file, index) => {
      let cloudinaryResult = null;
      let aiResult = null;
      
      try {
        // upload to cloudinary
        const folder = 'media_uploads';
        cloudinaryResult = await uploadToCloudinary(file, folder);
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
        
        // Add source URL to metadata if available
        if (file.sourceUrl) {
          mediaData.metadata.sourceUrl = file.sourceUrl;
        }

        // Process with AI model if it's an image or video and AI server is available
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
          } catch (error) {
            console.error(`AI processing error for file ${index}:`, error.message);
            // Continue without AI analysis if processing fails
          }
        }

        // Create a record for this media regardless of AI processing
        let recordData = {
          userId: req.authUser._id,
          mediaUrl: cloudinaryResult.url
        };

        // Only include collectionId if it's specified
        if (collectionId) {
          recordData.collectionId = collectionId;
        }

        // If AI processing was successful, add emotion data
        if (aiResult) {
          // For image
          if (cloudinaryResult.resource_type === 'image') {
            recordData.emotion = [mediaData.metadata.emotion || 'unknown'];
            recordData.times = [0]; // Single timestamp for image
            
            // For image, just include the main emotion in the response
            mediaData.metadata.aiAnalysis = {
              emotion: mediaData.metadata.emotion || 'unknown'
            };
          } 
          // For video
          else {
            // Extract emotions and timestamps from array
            if (Array.isArray(aiResult)) {
              console.log('Video analysis result contains', aiResult.length, 'entries');
              
              // Store all emotions and timestamps
              recordData.emotion = aiResult.map(item => item.emotion);
              recordData.times = aiResult.map(item => item.timestamp);
              
              // For video, include detailed timeline in the response
              mediaData.metadata.aiAnalysis = {
                emotion: getDominantEmotion(aiResult), // Set the dominant emotion as the main one
                timeline: aiResult
              };
            } else {
              console.warn('Expected array for video analysis but got:', typeof aiResult);
              recordData.emotion = ['unknown'];
              recordData.times = [0];
              mediaData.metadata.aiAnalysis = {
                emotion: 'unknown',
                timeline: []
              };
            }
          }
          
          // Store AI result for response
          aiResults.push({ mediaId: null, analysis: aiResult });
        } 
        // If no AI processing, add default values
        else {
          recordData.emotion = ['unknown'];
          recordData.times = [0];
          mediaData.metadata.aiAnalysis = {
            emotion: 'unknown'
          };
        }

        // Save the record
        const record = new Record(recordData);
        savedRecord = await record.save();
        savedRecordIds.push(savedRecord._id);

        // Keep record ID reference in metadata
        mediaData.metadata.recordId = savedRecord._id;

        // save media data
        const media = new Media(mediaData);
        const savedMedia = await media.save();

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
          aiProcessed: !!aiResult,
          recordId: savedRecord._id
        };
      } catch (error) {
        // If this specific file upload fails, clean up its resources
        if (cloudinaryResult) {
          await deleteFromCloudinary(cloudinaryResult.public_id, cloudinaryResult.resource_type);
        }
        
        if (savedRecord) {
          await Record.findByIdAndDelete(savedRecord._id);
        }
        
        // Return error to be handled by Promise.all
        throw error;
      }
    });

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);
    
    // Populate uploaded media with user info and collection data
    const populatedMedia = await Media.find({ _id: { $in: savedMediaIds } })
      .populate("uploadedBy", "name")
      .populate("collectionId", "name");

    // Get record data for the response with collection information
    const recordIds = results.map(result => result.recordId).filter(Boolean);
    const records = await Record.find({ _id: { $in: recordIds } })
      .populate("collectionId", "name");

    // Create a map of records by ID for easier lookup
    const recordMap = {};
    records.forEach(record => {
      recordMap[record._id.toString()] = {
        emotions: record.emotion,
        times: record.times,
        collection: record.collectionId ? {
          id: record.collectionId._id,
          name: record.collectionId.name
        } : null
      };
    });

    // Map media to their records
    const mediaWithRecords = populatedMedia.map(media => {
      const recordId = media.metadata?.recordId;
      return {
        ...media.toObject(),
        record: recordId ? recordMap[recordId.toString()] : null
      };
    });

    // send response
    res.status(201).json({
      success: true,
      message: messages.media.uploadSuccess,
      data: populatedMedia,
      aiResults: aiResults.length > 0 ? aiResults : null,
      records: recordMap
    });
  } catch (error) {
    console.error('Error in uploadMultipleMedia:', error);
    
    // Rollback cloudinary uploads on error
    for (const file of uploadedFiles) {
      try {
        await deleteFromCloudinary(file.public_id, file.resource_type);
      } catch (cleanupError) {
        console.error('Error cleaning up Cloudinary upload:', cleanupError);
      }
    }
    
    // Rollback saved records
    if (savedRecordIds.length > 0) {
      try {
        await Record.deleteMany({ _id: { $in: savedRecordIds } });
      } catch (cleanupError) {
        console.error('Error cleaning up records:', cleanupError);
      }
    }
    
    // Rollback saved media
    if (savedMediaIds.length > 0) {
      try {
        await Media.deleteMany({ _id: { $in: savedMediaIds } });
      } catch (cleanupError) {
        console.error('Error cleaning up media:', cleanupError);
      }
    }
    
    // Clean up temporarily extracted files
    await Promise.all(extractedFiles.map(async (file) => {
      try {
        if (file && file.path) {
          await unlinkAsync(file.path);
          console.log(`Cleaned up temporary file: ${file.path}`);
        }
      } catch (cleanupError) {
        console.error(`Error cleaning up temporary file: ${cleanupError.message}`);
      }
    }));
    
    return next(error instanceof AppError ? error : new AppError(error.message || 'Error uploading media', 500));
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
    
    // Create a record for this media whether AI processing succeeded or not
    const aiResult = enhancedMediaData.aiResults;
    let recordData = {
      userId: req.authUser._id,
      mediaUrl: media.fileUrl
    };

    // Only include collectionId if media already has one
    if (media.collectionId) {
      recordData.collectionId = media.collectionId;
    }

    // If AI processing was successful, add emotion data
    if (aiResult) {
      // For image
      if (media.fileType === 'image') {
        recordData.emotion = [enhancedMediaData.metadata.emotion || 'unknown'];
        recordData.times = [0]; // Single timestamp for image
        
        // For image, just include the main emotion in the response
        enhancedMediaData.metadata.aiAnalysis = {
          emotion: enhancedMediaData.metadata.emotion || 'unknown'
        };
      } 
      // For video
      else {
        // Extract emotions and timestamps from array
        if (Array.isArray(aiResult)) {
          console.log('Video analysis result contains', aiResult.length, 'entries');
          
          // Store all emotions and timestamps
          recordData.emotion = aiResult.map(item => item.emotion);
          recordData.times = aiResult.map(item => item.timestamp);
          
          // For video, include detailed timeline in the response
          enhancedMediaData.metadata.aiAnalysis = {
            emotion: getDominantEmotion(aiResult), // Set the dominant emotion as the main one
            timeline: aiResult
          };
        } else {
          console.warn('Expected array for video analysis but got:', typeof aiResult);
          recordData.emotion = ['unknown'];
          recordData.times = [0];
          enhancedMediaData.metadata.aiAnalysis = {
            emotion: 'unknown',
            timeline: []
          };
        }
      }
    } 
    // If no AI processing, add default values
    else {
      recordData.emotion = ['unknown'];
      recordData.times = [0];
      enhancedMediaData.metadata.aiAnalysis = {
        emotion: 'unknown'
      };
    }

    // Check if there's already a record ID in metadata
    let savedRecord;
    if (media.metadata && media.metadata.recordId) {
      // Update existing record with new data
      savedRecord = await Record.findByIdAndUpdate(
        media.metadata.recordId,
        recordData,
        { new: true }
      );
    } else {
      // Create a new record
      const record = new Record(recordData);
      savedRecord = await record.save();
      
      // Update media with record ID reference
      updatedMedia.metadata.recordId = savedRecord._id;
      await updatedMedia.save();
    }
    
    // Delete temporary file
    await unlinkAsync(tempFilePath);
    
    // Populate uploaded info
    const populatedMedia = await Media.findById(updatedMedia._id)
      .populate("uploadedBy", "name")
      .populate("collectionId", "name");

    // Get the record data for the response
    const populatedRecord = await Record.findById(updatedMedia.metadata.recordId)
      .populate("collectionId", "name");

    // send response
    res.status(200).json({
      success: true,
      message: 'AI processing completed successfully',
      data: populatedMedia,
      aiProcessed: !!aiResult,
      record: populatedRecord ? {
        emotions: populatedRecord.emotion,
        times: populatedRecord.times,
        collection: populatedRecord.collectionId ? {
          id: populatedRecord.collectionId._id,
          name: populatedRecord.collectionId.name
        } : null
      } : null
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

// Assign media to a collection
export const assignMediaToCollection = async (req, res, next) => {
  try {
    // Get media ID and collection ID
    const { mediaId } = req.params;
    const { collectionId } = req.body;
    
    // Validate the collection ID
    if (!collectionId) {
      return next(new AppError('Collection ID is required', 400));
    }
    
    // Check if media exists
    const media = await Media.findById(mediaId);
    if (!media) {
      return next(new AppError(messages.media.notFound, 404));
    }
    
    // Check authorization
    if (req.authUser._id.toString() !== media.uploadedBy.toString()) {
      return next(new AppError(messages.media.notAuthorized, 403));
    }
    
    // Check if collection exists
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return next(new AppError('Collection not found', 404));
    }
    
    // Update media with collection ID
    const updatedMedia = await Media.findByIdAndUpdate(
      mediaId,
      { collectionId },
      { new: true }
    ).populate('uploadedBy', 'name');
    
    // If there's a record ID in metadata, use the records module to update it
    if (media.metadata && media.metadata.recordId) {
      // We'll use an internal request rather than redirecting the user
      // This allows us to handle errors properly and provide a consistent response
      
      // Create a mock request for the records controller
      const recordUpdateReq = {
        params: { recordId: media.metadata.recordId },
        body: { collectionId },
        authUser: req.authUser
      };
      
      // Create a mock response to capture the result
      let recordUpdateError = null;
      const recordUpdateRes = {
        status: () => ({ 
          json: (data) => { return data; }
        })
      };
      
      // Create a mock next function to capture errors
      const recordUpdateNext = (error) => {
        recordUpdateError = error;
      };
      
      try {
        // Import the assignRecordToCollection function dynamically
        const { assignRecordToCollection } = await import('../records/records.controller.js');
        
        // Call the function directly
        await assignRecordToCollection(recordUpdateReq, recordUpdateRes, recordUpdateNext);
        
        // If there was an error, log it but continue
        if (recordUpdateError) {
          console.error('Error assigning record to collection:', recordUpdateError);
        }
      } catch (recordError) {
        console.error('Error importing or calling records controller:', recordError);
      }
    }
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Media assigned to collection successfully',
      data: updatedMedia
    });
  } catch (error) {
    return next(new AppError(`Failed to assign media to collection: ${error.message}`, 500));
  }
};