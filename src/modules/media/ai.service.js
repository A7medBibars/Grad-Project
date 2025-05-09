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
    if (!mediaFile || !mediaFile.path) {
      throw new AppError(messages.media.invalidMedia, 400);
    }

    if (!['image', 'video'].includes(mediaType)) {
      throw new AppError(messages.media.invalidMediaType, 400);
    }

    // Create form data for API request
    const formData = new FormData();
    
    // Read the file content and add to form data
    const fileStream = fs.createReadStream(mediaFile.path);
    formData.append('file', fileStream, {
      filename: path.basename(mediaFile.path),
      contentType: mediaFile.mimetype
    });

    // Determine endpoint based on media type
    const endpoint = mediaType === 'image' 
      ? aiConfig.endpoints.image 
      : aiConfig.endpoints.video;
    
    // Make request to AI server
    const response = await axios.post(`${aiConfig.serverUrl}${endpoint}`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      timeout: aiConfig.timeout
    });

    return {
      success: true,
      aiResults: response.data
    };
  } catch (error) {
    // Handle errors from AI server
    if (error.response) {
      throw new AppError(
        `AI processing failed: ${error.response.data.error || 'Unknown error'}`,
        error.response.status || 500
      );
    }
    
    // Handle network or other errors
    throw new AppError(
      `AI service error: ${error.message}`,
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
  
  const fileExt = path.extname(file.originalname).toLowerCase().substring(1);
  
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