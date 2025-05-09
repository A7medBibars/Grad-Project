import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { AppError } from '../../utils/appError.js';
import { messages } from '../../utils/constants/messages.js';
import { aiConfig } from '../../config/ai.config.js';
import FormData from 'form-data';

// Convert fs.writeFile to promise-based
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Process media with AI emotion recognition
 * @param {Object} mediaFile - The uploaded media file
 * @param {string} mediaType - Type of media ('image' or 'video')
 * @returns {Promise<Object>} AI analysis results
 */
export const processMediaWithAI = async (mediaFile, mediaType) => {
  try {
    // Skip processing if AI is globally disabled
    if (!aiConfig.enabled) {
      return {
        success: false,
        reason: 'AI processing disabled'
      };
    }

    // Validate input
    if (!mediaFile || (!mediaFile.path && !mediaFile.buffer)) {
      throw new AppError(messages.media.invalidMedia, 400);
    }

    if (!['image', 'video'].includes(mediaType)) {
      throw new AppError(messages.media.invalidMediaType, 400);
    }

    // Create form data for API request
    const formData = new FormData();
    
    let tempFilePath = null;
    
    // Handle file input based on whether it has a path or buffer
    if (mediaFile.path) {
      // File is on disk - read stream directly
      console.log('Using file path for AI processing:', mediaFile.path);
      const fileStream = fs.createReadStream(mediaFile.path);
      formData.append('file', fileStream, {
        filename: path.basename(mediaFile.path),
        contentType: mediaFile.mimetype
      });
    } else if (mediaFile.buffer) {
      // File is in memory - create temporary file
      console.log('Using buffer for AI processing, creating temp file');
      const tempFilename = `temp_${Date.now()}_${mediaFile.originalname || 'upload.jpg'}`;
      tempFilePath = path.join(__dirname, '../../../uploads', tempFilename);
      
      // Create uploads directory if it doesn't exist
      if (!fs.existsSync(path.join(__dirname, '../../../uploads'))) {
        fs.mkdirSync(path.join(__dirname, '../../../uploads'), { recursive: true });
      }
      
      // Write buffer to temporary file
      await writeFileAsync(tempFilePath, mediaFile.buffer);
      
      // Read the temporary file
      const fileStream = fs.createReadStream(tempFilePath);
      formData.append('file', fileStream, {
        filename: mediaFile.originalname || 'upload.jpg',
        contentType: mediaFile.mimetype
      });
    } else {
      throw new AppError('File has neither path nor buffer', 400);
    }

    // Determine endpoint based on media type
    const endpoint = mediaType === 'image' 
      ? aiConfig.endpoints.image 
      : aiConfig.endpoints.video;
    
    console.log(`Sending request to AI server: ${aiConfig.serverUrl}${endpoint}`);
    
    // Make request to AI server
    const response = await axios.post(`${aiConfig.serverUrl}${endpoint}`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: aiConfig.timeout
    });

    // Clean up temp file if created
    if (tempFilePath) {
      try {
        await unlinkAsync(tempFilePath);
      } catch (err) {
        console.warn('Failed to delete temporary file:', err.message);
      }
    }

    return {
      success: true,
      aiResults: response.data
    };
  } catch (error) {
    // Clean up temp file if created
    if (arguments[0]?.tempFilePath) {
      try {
        await unlinkAsync(arguments[0].tempFilePath);
      } catch (err) {
        console.warn('Failed to delete temporary file on error:', err.message);
      }
    }
  
    // Handle errors from AI server
    if (error.response) {
      throw new AppError(
        `AI processing failed: ${error.response.data.error || 'Unknown error'}`,
        error.response.status || 500
      );
    }
    
    // Handle network or other errors
    throw new AppError(
      `AI service error: ${error.message || 'Unknown error'}`,
      500
    );
  }
};

/**
 * Determine the dominant emotion from AI analysis
 * @param {Object} aiResults - Results from AI processing
 * @returns {string} Dominant emotion
 */
export const getDominantEmotion = (aiResults) => {
  // For image, return the single emotion
  if (aiResults.emotion) {
    return aiResults.emotion;
  }
  
  // For video, calculate the most frequent emotion
  if (Array.isArray(aiResults)) {
    const emotionCounts = aiResults.reduce((counts, result) => {
      counts[result.emotion] = (counts[result.emotion] || 0) + 1;
      return counts;
    }, {});
    
    // Find emotion with highest count
    return Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])[0] || 'unknown';
  }
  
  return 'unknown';
};

/**
 * Check if the AI server is available
 * @returns {Promise<boolean>} True if the server is available
 */
export const checkAIServerAvailability = async () => {
  // Skip check if AI is globally disabled
  if (!aiConfig.enabled) {
    return false;
  }
  
  try {
    await axios.get(`${aiConfig.serverUrl}${aiConfig.endpoints.healthCheck}`, { 
      timeout: 5000 
    });
    return true;
  } catch (error) {
    console.error('AI server is not available:', error.message);
    return false;
  }
};

/**
 * Check if a file is eligible for AI processing
 * @param {Object} file - The file to check
 * @returns {boolean} True if the file can be processed by AI
 */
export const isFileEligibleForAI = (file) => {
  if (!file || !file.mimetype) return false;
  
  // Get file extension either from originalname or mimetype
  let fileExt;
  if (file.originalname) {
    fileExt = path.extname(file.originalname).toLowerCase().substring(1);
  } else {
    // Extract extension from mimetype (e.g., "image/jpeg" -> "jpeg")
    fileExt = file.mimetype.split('/')[1];
  }
  
  // Log the eligibility check
  console.log('Checking file eligibility:', {
    mimetype: file.mimetype,
    extension: fileExt,
    hasPath: !!file.path,
    hasBuffer: !!file.buffer
  });
  
  if (file.mimetype.startsWith('image/')) {
    return aiConfig.supportedFormats.image.includes(fileExt);
  } else if (file.mimetype.startsWith('video/')) {
    return aiConfig.supportedFormats.video.includes(fileExt);
  }
  
  return false;
};

/**
 * Handle media uploads with AI processing
 * @param {Object} mediaFile - The uploaded media file
 * @param {Object} uploadInfo - Upload metadata
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Enhanced media object with AI analysis
 */
export const handleAIMediaProcessing = async (mediaFile, uploadInfo, options = {}) => {
  // Skip processing if explicitly requested or AI is disabled
  if (options.skipAI || !aiConfig.enabled) {
    return {
      ...uploadInfo,
      aiProcessed: false,
      metadata: {
        ...uploadInfo.metadata
      }
    };
  }
  
  // Check file eligibility
  if (!isFileEligibleForAI(mediaFile)) {
    return {
      ...uploadInfo,
      aiProcessed: false,
      metadata: {
        ...uploadInfo.metadata,
        aiStatus: 'ineligible'
      }
    };
  }
  
  // Determine media type from mimetype
  const mediaType = mediaFile.mimetype.startsWith('image') ? 'image' : 'video';
  
  try {
    // Process media with AI
    const aiResults = await processMediaWithAI(mediaFile, mediaType);
    
    // Skip if AI processing was disabled or failed
    if (!aiResults.success) {
      return {
        ...uploadInfo,
        aiProcessed: false,
        metadata: {
          ...uploadInfo.metadata,
          aiStatus: 'skipped',
          aiReason: aiResults.reason
        }
      };
    }
    
    // Get dominant emotion for metadata
    const dominantEmotion = getDominantEmotion(aiResults.aiResults);
    
    // Return enhanced media object
    return {
      ...uploadInfo,
      aiProcessed: true,
      aiResults: aiResults.aiResults,
      metadata: {
        ...uploadInfo.metadata,
        emotion: dominantEmotion,
        aiStatus: 'processed',
        processedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('AI processing failed, continuing without AI analysis:', error.message);
    
    // If AI processing fails, return original upload info without AI data
    return {
      ...uploadInfo,
      aiProcessed: false,
      metadata: {
        ...uploadInfo.metadata,
        aiStatus: 'error',
        aiError: error.message
      }
    };
  }
};

// Add this IIFE to properly handle the async function
(async () => {
  try {
    const isAvailable = await checkAIServerAvailability();
    console.log('AI Server Available:', isAvailable);
  } catch (error) {
    console.error('Error checking AI availability:', error.message);
  }
})(); 