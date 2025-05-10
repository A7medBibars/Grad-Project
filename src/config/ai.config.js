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
  },
  
  /**
   * URL content extraction settings
   */
  urlExtraction: {
    /**
     * Maximum file size to download from URL in bytes
     * Default: 50MB
     */
    maxFileSize: parseInt(process.env.URL_MAX_FILE_SIZE || '52428800', 10),
    
    /**
     * Timeout for URL requests in milliseconds
     * Default: 30 seconds
     */
    timeout: parseInt(process.env.URL_TIMEOUT || '30000', 10),
    
    /**
     * Whether to enable URL content extraction
     * Can be disabled with URL_EXTRACTION_ENABLED=false environment variable
     */
    enabled: process.env.URL_EXTRACTION_ENABLED !== 'false',
    
    /**
     * Social media extraction settings
     */
    socialMedia: {
      /**
       * Whether to enable special handling for social media URLs
       * Can be disabled with SOCIAL_MEDIA_EXTRACTION_ENABLED=false environment variable
       */
      enabled: process.env.SOCIAL_MEDIA_EXTRACTION_ENABLED !== 'false',
      
      /**
       * User agent to use for requests to social media sites
       * Some sites block generic scrapers, so we use a common browser user agent
       */
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      
      /**
       * Whether to attempt to use alternative URLs like mobile versions
       * Can be disabled with SOCIAL_MEDIA_USE_ALTERNATIVES=false environment variable
       */
      useAlternatives: process.env.SOCIAL_MEDIA_USE_ALTERNATIVES !== 'false',
      
      /**
       * Supported platforms configuration
       */
      platforms: {
        facebook: {
          enabled: process.env.SOCIAL_MEDIA_FACEBOOK_ENABLED !== 'false',
          useMobileVersion: true
        },
        instagram: {
          enabled: process.env.SOCIAL_MEDIA_INSTAGRAM_ENABLED !== 'false'
        },
        twitter: {
          enabled: process.env.SOCIAL_MEDIA_TWITTER_ENABLED !== 'false',
          useSyndication: true
        },
        tiktok: {
          enabled: process.env.SOCIAL_MEDIA_TIKTOK_ENABLED !== 'false'
        },
        youtube: {
          enabled: process.env.SOCIAL_MEDIA_YOUTUBE_ENABLED !== 'false',
          useThumbnail: true
        }
      }
    }
  }
}; 