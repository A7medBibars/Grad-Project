/**
 * AI Processing Configuration
 * This file contains configuration settings for the AI analysis integration
 */

export const aiConfig = {
  /**
   * Base URL for the AI processing server
   * Can be overridden by AI_SERVER_URL environment variable
   */
  serverUrl: process.env.AI_SERVER_URL || 'http://localhost:5000',
  
  /**
   * Timeout for AI processing requests (in milliseconds)
   * Larger files like videos may need longer timeouts
   */
  timeout: parseInt(process.env.AI_TIMEOUT || '60000', 10),
  
  /**
   * Timeout for video processing (in milliseconds)
   * Videos need longer timeouts due to their size and processing requirements
   */
  videoTimeout: parseInt(process.env.AI_VIDEO_TIMEOUT || '120000', 10),
  
  /**
   * Whether to enable AI processing by default
   * Can be disabled globally with AI_ENABLED=false environment variable
   */
  enabled: process.env.AI_ENABLED !== 'false',
  
  /**
   * Path to the AI model file relative to project root
   * Used when running AI processing locally
   */
  modelPath: process.env.AI_MODEL_PATH || './AI/Final.h5',
  
  /**
   * Supported file formats for AI processing
   */
  supportedFormats: {
    image: ['jpg', 'jpeg', 'png'],
    video: ['mp4', 'mov', 'avi']
  },
  
  /**
   * API endpoints for AI processing
   */
  endpoints: {
    image: '/predict/image',
    video: '/predict/video',
    healthCheck: '/'
  }
}; 