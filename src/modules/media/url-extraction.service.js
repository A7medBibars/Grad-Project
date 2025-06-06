import axios from 'axios';
// Using dynamic import for cheerio
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';
import { AppError } from '../../utils/appError.js';
import { messages } from '../../utils/constants/messages.js';
import { aiConfig } from '../../config/ai.config.js';
import fbgraph from 'fbgraph';
import { promisify } from 'util';
import util from 'util';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Promisify fbgraph get method
const graphGet = promisify(fbgraph.get);

/**
 * Social media platform API identifiers
 */
const SOCIAL_PLATFORMS = {
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  TWITTER: 'twitter',
  TIKTOK: 'tiktok',
  YOUTUBE: 'youtube',
  UNKNOWN: 'unknown'
};

/**
 * Helper function to load cheerio - will be called only when needed
 * This avoids issues with different cheerio import formats
 */
async function loadCheerio(html) {
  try {
    // Try the dynamic import approach
    const cheerioModule = await import('cheerio');
    // Handle different module formats
    const cheerio = cheerioModule.default || cheerioModule;
    return cheerio.load(html);
  } catch (error) {
    console.error('Error loading cheerio:', error);
    throw new AppError('Failed to load HTML parsing library', 500);
  }
}

/**
 * Extract media from a URL
 * @param {string} url - The URL to extract media from
 * @returns {Promise<Object>} - The extracted media object with path, mimetype, and type
 */
export const extractMediaFromUrl = async (url) => {
  try {
    // Check if URL extraction is enabled
    if (!aiConfig.urlExtraction.enabled) {
      throw new AppError('URL content extraction is disabled', 400);
    }
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // First, identify if this is a social media URL and what platform
    const platform = identifySocialPlatform(url);
    
    // Handle based on platform type
    if (platform !== SOCIAL_PLATFORMS.UNKNOWN && aiConfig.urlExtraction.socialMedia?.enabled) {
      return await extractFromSocialMedia(url, platform, uploadsDir);
    }
    
    // For regular websites, proceed with normal extraction
    return await extractFromWebsite(url, uploadsDir);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    // Handle axios specific errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      throw new AppError(`Error fetching URL: ${error.response.status} - ${error.response.statusText}`, 400);
    } else if (error.request) {
      // The request was made but no response was received
      throw new AppError(`No response received from URL: ${error.message}`, 400);
    } else if (error.code === 'ECONNABORTED') {
      // Timeout error
      throw new AppError(`Request timeout: URL took too long to respond`, 400);
    } else if (error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' || error.message.includes('maxContentLength')) {
      // File size exceeded
      throw new AppError(`File size exceeds the maximum allowed size`, 400);
    }
    
    // Generic error
    throw new AppError(`Error extracting media from URL: ${error.message}`, 500);
  }
};

/**
 * Identify which social media platform a URL is from
 * @param {string} url - The URL to check
 * @returns {string} - The platform identifier
 */
function identifySocialPlatform(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('facebook.com') || hostname.includes('fb.com') || hostname.includes('fb.watch')) {
      return SOCIAL_PLATFORMS.FACEBOOK;
    } else if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
      return SOCIAL_PLATFORMS.INSTAGRAM;
    } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return SOCIAL_PLATFORMS.TWITTER;
    } else if (hostname.includes('tiktok.com')) {
      return SOCIAL_PLATFORMS.TIKTOK;
    } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return SOCIAL_PLATFORMS.YOUTUBE;
    }
    
    return SOCIAL_PLATFORMS.UNKNOWN;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return SOCIAL_PLATFORMS.UNKNOWN;
  }
}

/**
 * Extract media from a standard website
 * @param {string} url - The URL to extract from
 * @param {string} uploadsDir - The directory to save files to
 * @returns {Promise<Object>} - The extracted media data
 */
async function extractFromWebsite(url, uploadsDir) {
  // Make a request to the URL with timeout from configuration
  const response = await axios.get(url, {
    responseType: 'text',
    timeout: aiConfig.urlExtraction.timeout,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  // Use dynamic cheerio loading
  const $ = await loadCheerio(response.data);
  
  // First try to find Open Graph meta tags for images or videos
  let mediaUrl = $('meta[property="og:image"]').attr('content') || 
                $('meta[property="og:image:url"]').attr('content');
  let mediaType = 'image';
  
  // If no image found, try to find video
  if (!mediaUrl) {
    mediaUrl = $('meta[property="og:video"]').attr('content') || 
              $('meta[property="og:video:url"]').attr('content') ||
              $('meta[property="og:video:secure_url"]').attr('content');
    mediaType = 'video';
  }
  
  // If no Open Graph tags, look for Twitter cards
  if (!mediaUrl) {
    mediaUrl = $('meta[name="twitter:image"]').attr('content');
    mediaType = 'image';
    
    if (!mediaUrl) {
      mediaUrl = $('meta[name="twitter:player:stream"]').attr('content');
      mediaType = 'video';
    }
  }
  
  // If no Open Graph or Twitter tags, look for regular image/video tags
  if (!mediaUrl) {
    // Look for the largest image
    let maxSize = 0;
    $('img').each((i, el) => {
      const width = parseInt($(el).attr('width') || '0', 10);
      const height = parseInt($(el).attr('height') || '0', 10);
      const size = width * height;
      if (size > maxSize && $(el).attr('src')) {
        maxSize = size;
        mediaUrl = $(el).attr('src');
        mediaType = 'image';
      }
    });
    
    // If no suitable image found, look for video
    if (!mediaUrl) {
      $('video source').each((i, el) => {
        if ($(el).attr('src')) {
          mediaUrl = $(el).attr('src');
          mediaType = 'video';
        }
      });
    }
  }
  
  // Handle relative URLs
  if (mediaUrl && !mediaUrl.startsWith('http')) {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    
    if (mediaUrl.startsWith('/')) {
      mediaUrl = `${baseUrl}${mediaUrl}`;
    } else {
      mediaUrl = `${baseUrl}/${mediaUrl}`;
    }
  }
  
  // If no media found
  if (!mediaUrl) {
    throw new AppError('No media found in the provided URL', 400);
  }
  
  // Download and process the media
  return await downloadAndProcessMedia(mediaUrl, mediaType, url, uploadsDir);
}

/**
 * Extract media from a social media post
 * @param {string} url - The URL to extract from
 * @param {string} platform - The social platform identifier
 * @param {string} uploadsDir - The directory to save files to
 * @returns {Promise<Object>} - The extracted media data
 */
async function extractFromSocialMedia(url, platform, uploadsDir) {
  switch (platform) {
    case SOCIAL_PLATFORMS.FACEBOOK:
      return await extractFromFacebook(url, uploadsDir);
    case SOCIAL_PLATFORMS.INSTAGRAM:
      return await extractFromInstagram(url, uploadsDir);
    case SOCIAL_PLATFORMS.TWITTER:
      return await extractFromTwitter(url, uploadsDir);
    case SOCIAL_PLATFORMS.TIKTOK:
      return await extractFromTikTok(url, uploadsDir);
    case SOCIAL_PLATFORMS.YOUTUBE:
      return await extractFromYouTube(url, uploadsDir);
    default:
      throw new AppError('Unsupported social media platform', 400);
  }
}

/**
 * Extract Facebook post ID from URL
 * @param {string} url - The Facebook URL
 * @returns {string|null} - The post ID, or null if not found
 */
function extractFacebookPostId(url) {
  try {
    // Parse the URL
    const urlObj = new URL(url);
    
    // Handle various Facebook URL formats
    if (urlObj.hostname.includes('facebook.com') || urlObj.hostname.includes('fb.com')) {
      const pathname = urlObj.pathname;
      
      // Format: facebook.com/permalink.php?story_fbid=123456789&id=987654321
      const storyFbid = urlObj.searchParams.get('story_fbid');
      if (storyFbid) {
        return storyFbid;
      }
      
      // Format: facebook.com/photo.php?fbid=123456789
      // Format: facebook.com/video.php?v=123456789
      const fbid = urlObj.searchParams.get('fbid') || urlObj.searchParams.get('v');
      if (fbid) {
        return fbid;
      }
      
      // Format: facebook.com/username/posts/123456789
      const postsMatch = pathname.match(/\/posts\/(\d+)/);
      if (postsMatch) {
        return postsMatch[1];
      }
      
      // Format: facebook.com/username/videos/123456789
      const videosMatch = pathname.match(/\/videos\/(\d+)/);
      if (videosMatch) {
        return videosMatch[1];
      }
      
      // Format: facebook.com/photo/?fbid=123456789
      // Handle path segments
      const pathSegments = pathname.split('/').filter(Boolean);
      if (pathSegments.length >= 2) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (/^\d+$/.test(lastSegment)) {
          return lastSegment;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Facebook URL:', error);
    return null;
  }
}

/**
 * Extract media from a Facebook post
 * @param {string} url - The Facebook post URL
 * @param {string} uploadsDir - The directory to save files to
 * @returns {Promise<Object>} - The extracted media data
 */
async function extractFromFacebook(url, uploadsDir) {
  // Check if Facebook extraction is enabled
  if (aiConfig.urlExtraction.socialMedia?.platforms?.facebook?.enabled === false) {
    throw new AppError('Facebook URL extraction is disabled', 400);
  }
  
  // First, check if Facebook Graph API is enabled and configured
  const graphApiEnabled = aiConfig.urlExtraction.socialMedia?.platforms?.facebook?.graphApi?.enabled;
  const accessToken = aiConfig.urlExtraction.socialMedia?.platforms?.facebook?.graphApi?.accessToken;
  
  if (graphApiEnabled && accessToken) {
    try {
      // Extract the post ID from the URL
      const postId = extractFacebookPostId(url);
      
      if (!postId) {
        console.log('Could not extract Facebook post ID from URL, falling back to HTML extraction');
        return await fallbackFacebookExtraction(url, uploadsDir);
      }
      
      // Set the Facebook Graph API version and access token
      const apiVersion = aiConfig.urlExtraction.socialMedia?.platforms?.facebook?.graphApi?.version || 'v18.0';
      fbgraph.setVersion(apiVersion);
      fbgraph.setAccessToken(accessToken);
      
      // Define the fields we want to retrieve
      const fields = 'id,message,full_picture,attachments{media,media_type,url,target{id},subattachments}';
      
      // Make the Graph API request
      const postData = await graphGet(`${postId}?fields=${fields}`);
      
      // Process the response to find media URLs
      let mediaUrl = null;
      let mediaType = 'image';
      
      // First, check for full picture
      if (postData.full_picture) {
        mediaUrl = postData.full_picture;
        mediaType = 'image';
      }
      
      // Check for attachments
      if (!mediaUrl && postData.attachments && postData.attachments.data && postData.attachments.data.length > 0) {
        const attachment = postData.attachments.data[0];
        
        // Handle different types of attachments
        if (attachment.media_type === 'photo' && attachment.media && attachment.media.image) {
          mediaUrl = attachment.media.image.src;
          mediaType = 'image';
        } else if (attachment.media_type === 'video' && attachment.media && attachment.media.source) {
          mediaUrl = attachment.media.source;
          mediaType = 'video';
        } else if (attachment.url) {
          // If there's a URL but no direct media, we can try to use it
          mediaUrl = attachment.url;
          mediaType = attachment.media_type === 'video' ? 'video' : 'image';
        }
        
        // Check subattachments if we still don't have a media URL
        if (!mediaUrl && attachment.subattachments && attachment.subattachments.data && attachment.subattachments.data.length > 0) {
          const subattachment = attachment.subattachments.data[0];
          if (subattachment.media && subattachment.media.image) {
            mediaUrl = subattachment.media.image.src;
            mediaType = 'image';
          }
        }
      }
      
      // If we found a media URL, download and process it
      if (mediaUrl) {
        return await downloadAndProcessMedia(mediaUrl, mediaType, url, uploadsDir);
      }
      
      // If we couldn't find media through the Graph API, fall back to HTML extraction
      console.log('No media found in Facebook Graph API response, falling back to HTML extraction');
      return await fallbackFacebookExtraction(url, uploadsDir);
    } catch (error) {
      console.error('Error using Facebook Graph API:', error);
      
      // Check for specific error types
      if (error.message && error.message.includes('OAuthException')) {
        throw new AppError(
          'Facebook API authentication failed. Please check your access token or permissions. ' +
          'You may need to generate a new access token with proper permissions.',
          401
        );
      }
      
      // If there's an error with the Graph API, fall back to HTML extraction
      return await fallbackFacebookExtraction(url, uploadsDir);
    }
  } else {
    // If Graph API is not enabled or configured, provide helpful message
    if (graphApiEnabled && !accessToken) {
      console.warn('Facebook Graph API is enabled but no access token is configured');
    }
    
    // Use HTML extraction as fallback
    return await fallbackFacebookExtraction(url, uploadsDir);
  }
}

/**
 * Fallback method for Facebook extraction using HTML scraping
 * @param {string} url - The Facebook post URL
 * @param {string} uploadsDir - The directory to save files to
 * @returns {Promise<Object>} - The extracted media data
 */
async function fallbackFacebookExtraction(url, uploadsDir) {
  // Try to get the media using normal website extraction
  try {
    return await extractFromWebsite(url, uploadsDir);
  } catch (error) {
    // If that fails, check if we should try alternative URLs
    const useAlternatives = aiConfig.urlExtraction.socialMedia?.useAlternatives !== false;
    const useMobileVersion = aiConfig.urlExtraction.socialMedia?.platforms?.facebook?.useMobileVersion !== false;
    
    if (useAlternatives && useMobileVersion) {
      // Try mobile version which might be more accessible
      const mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
      
      try {
        return await extractFromWebsite(mobileUrl, uploadsDir);
      } catch (secondError) {
        throw new AppError(
          'Could not extract media from Facebook URL. Facebook requires authentication to access this content. ' +
          'To fix this, please configure a valid Facebook Graph API access token in your environment variables.', 
          400
        );
      }
    } else {
      throw new AppError(
        'Could not extract media from Facebook URL. Facebook requires authentication to access this content. ' +
        'To fix this, please configure a valid Facebook Graph API access token in your environment variables.', 
        400
      );
    }
  }
}

/**
 * Extract media from an Instagram post
 * @param {string} url - The Instagram post URL
 * @param {string} uploadsDir - The directory to save files to
 * @returns {Promise<Object>} - The extracted media data
 */
async function extractFromInstagram(url, uploadsDir) {
  // Check if Instagram extraction is enabled
  if (aiConfig.urlExtraction.socialMedia?.platforms?.instagram?.enabled === false) {
    throw new AppError('Instagram URL extraction is disabled', 400);
  }
  
  // Try multiple approaches for Instagram content
  try {
    // First attempt: Try the standard website extraction
    try {
      return await extractFromWebsite(url, uploadsDir);
    } catch (firstError) {
      console.log('Standard extraction failed for Instagram, trying alternate methods...');
    }
    
    // Second attempt: Try with a different user agent (mobile)
    try {
      const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/85.0.4183.109 Mobile/15E148 Safari/604.1';
      
      const response = await axios.get(url, {
        responseType: 'text',
        timeout: aiConfig.urlExtraction.timeout,
        headers: {
          'User-Agent': mobileUserAgent
        }
      });
      
      const $ = await loadCheerio(response.data);
      
      // Look for image URLs specific to Instagram
      let mediaUrl = $('meta[property="og:image"]').attr('content');
      let mediaType = 'image';
      
      if (!mediaUrl) {
        mediaUrl = $('meta[property="og:video"]').attr('content');
        mediaType = 'video';
      }
      
      if (mediaUrl) {
        return await downloadAndProcessMedia(mediaUrl, mediaType, url, uploadsDir);
      }
    } catch (secondError) {
      console.log('Mobile user agent approach failed for Instagram');
    }
    
    // If all attempts fail, throw an informative error
    throw new AppError(
      'Could not extract media from Instagram URL. Instagram restricts content access for non-authenticated users. ' +
      'Try with a public Instagram post or consider using a different platform for sharing media.',
      400
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      'Could not extract media from Instagram URL. Instagram may require authentication to access this content. ' +
      'Try with a public Instagram post or consider using a different platform for sharing media.',
      400
    );
  }
}

/**
 * Extract media from a Twitter/X post
 * @param {string} url - The Twitter post URL
 * @param {string} uploadsDir - The directory to save files to
 * @returns {Promise<Object>} - The extracted media data
 */
async function extractFromTwitter(url, uploadsDir) {
  try {
    // Check if syndication should be attempted first
    const useAlternatives = aiConfig.urlExtraction.socialMedia?.useAlternatives !== false;
    const useSyndication = aiConfig.urlExtraction.socialMedia?.platforms?.twitter?.useSyndication !== false;
    
    if (useAlternatives && useSyndication) {
      // Replace twitter.com with syndication.twitter.com to get public content without authentication
      const syndicationUrl = url.replace(/https?:\/\/(www\.)?twitter\.com/, 'https://syndication.twitter.com');
      
      try {
        const response = await axios.get(syndicationUrl, {
          responseType: 'text',
          timeout: aiConfig.urlExtraction.timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        // Use dynamic cheerio loading
        const $ = await loadCheerio(response.data);
        
        // Check for images
        let mediaUrl = null;
        let mediaType = 'image';
        
        // Look for media elements
        const photoContainer = $('.EmbeddedTweet-tweetPhoto');
        if (photoContainer.length > 0) {
          const img = photoContainer.find('img').first();
          if (img.length > 0) {
            mediaUrl = img.attr('src');
            mediaType = 'image';
          }
        }
        
        // Check for videos
        if (!mediaUrl) {
          const videoContainer = $('.EmbeddedTweet-video');
          if (videoContainer.length > 0) {
            const video = videoContainer.find('video source').first();
            if (video.length > 0) {
              mediaUrl = video.attr('src');
              mediaType = 'video';
            }
          }
        }
        
        if (mediaUrl) {
          return await downloadAndProcessMedia(mediaUrl, mediaType, url, uploadsDir);
        }
      } catch (syndicationError) {
        console.error('Error accessing syndication URL:', syndicationError);
        // Fall back to regular extraction if syndication fails
      }
    }
    
    // If syndication approach failed or was disabled, try normal website extraction
    return await extractFromWebsite(url, uploadsDir);
  } catch (error) {
    throw new AppError('Could not extract media from Twitter/X URL.', 400);
  }
}

/**
 * Extract media from a TikTok post
 * @param {string} url - The TikTok post URL
 * @param {string} uploadsDir - The directory to save files to
 * @returns {Promise<Object>} - The extracted media data
 */
async function extractFromTikTok(url, uploadsDir) {
  // Check if TikTok extraction is enabled
  if (aiConfig.urlExtraction.socialMedia?.platforms?.tiktok?.enabled === false) {
    throw new AppError('TikTok URL extraction is disabled', 400);
  }
  
  try {
    // TikTok is particularly difficult to scrape
    // We'll try the normal website extraction first
    return await extractFromWebsite(url, uploadsDir);
  } catch (error) {
    throw new AppError('Could not extract media from TikTok URL. TikTok videos may require special handling.', 400);
  }
}

/**
 * Extract media from a YouTube video
 * @param {string} url - The YouTube video URL
 * @param {string} uploadsDir - The directory to save files to
 * @returns {Promise<Object>} - The extracted media data
 */
async function extractFromYouTube(url, uploadsDir) {
  // Check if YouTube extraction is enabled
  if (aiConfig.urlExtraction.socialMedia?.platforms?.youtube?.enabled === false) {
    throw new AppError('YouTube URL extraction is disabled', 400);
  }
  
  try {
    // Extract the video ID
    let videoId = '';
    const urlObj = new URL(url);
    
    if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.substring(1);
    } else if (urlObj.searchParams.has('v')) {
      videoId = urlObj.searchParams.get('v');
    } else {
      // Try to extract from different URL formats
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0 && pathSegments[0] === 'watch') {
        videoId = pathSegments[1];
      } else if (pathSegments.length > 0 && pathSegments[0] === 'embed') {
        videoId = pathSegments[1];
      } else if (pathSegments.length > 0 && /^[A-Za-z0-9_-]{11}$/.test(pathSegments[pathSegments.length - 1])) {
        // If the last segment looks like a YouTube ID (11 characters of alphanumeric + _ and -)
        videoId = pathSegments[pathSegments.length - 1];
      }
    }
    
    if (!videoId) {
      throw new AppError('Could not extract YouTube video ID from URL. Please ensure it is a valid YouTube video link.', 400);
    }
    
    // Check if thumbnail extraction is enabled
    const useThumbnail = aiConfig.urlExtraction.socialMedia?.platforms?.youtube?.useThumbnail !== false;
    
    if (useThumbnail) {
      // Try different thumbnail resolutions in order of preference
      const thumbnailUrls = [
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,  // HD quality
        `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,      // Standard quality
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,      // High quality
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,      // Medium quality
        `https://img.youtube.com/vi/${videoId}/default.jpg`         // Default quality
      ];
      
      // Try each thumbnail URL until one works
      for (const thumbnailUrl of thumbnailUrls) {
        try {
          console.log(`Trying YouTube thumbnail: ${thumbnailUrl}`);
          // Check if the image exists and isn't the default "video not available" image
          const response = await axios.head(thumbnailUrl);
          if (response.status === 200) {
            // Use the thumbnail image as proxy for the video
            return await downloadAndProcessMedia(thumbnailUrl, 'image', url, uploadsDir);
          }
        } catch (thumbnailError) {
          console.log(`Failed to get thumbnail ${thumbnailUrl}: ${thumbnailError.message}`);
          continue; // Try the next thumbnail URL
        }
      }
      
      // If all thumbnail attempts fail, try the website extraction
      console.log('All YouTube thumbnail attempts failed, trying regular website extraction');
    }
    
    // Try regular website extraction as fallback
    try {
      return await extractFromWebsite(url, uploadsDir);
    } catch (webError) {
      console.log('Website extraction for YouTube failed:', webError.message);
      
      // Last resort: use the first thumbnail and ignore errors
      const fallbackThumbnail = `https://img.youtube.com/vi/${videoId}/0.jpg`;
      return await downloadAndProcessMedia(fallbackThumbnail, 'image', url, uploadsDir);
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Could not extract media from YouTube URL: ${error.message}. ` +
      'Please ensure it is a valid and accessible YouTube video.',
      400
    );
  }
}

/**
 * Download media from URL and process it
 * @param {string} mediaUrl - The URL of the media to download
 * @param {string} mediaType - The type of media (image/video)
 * @param {string} sourceUrl - The original URL the media was found on
 * @param {string} uploadsDir - The directory to save the file to
 * @returns {Promise<Object>} - The processed media data
 */
async function downloadAndProcessMedia(mediaUrl, mediaType, sourceUrl, uploadsDir) {
  // Get default timeout and size limits
  const timeout = aiConfig.urlExtraction?.timeout || 30000; // Default 30s
  const maxFileSize = aiConfig.urlExtraction?.maxFileSize || 52428800; // Default 50MB
  
  // Use default user agent if not specified
  const userAgent = 
    aiConfig.urlExtraction?.socialMedia?.userAgent || 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  
  // Download the media with maxFileSize and timeout from configuration
  const mediaResponse = await axios({
    method: 'get',
    url: mediaUrl,
    responseType: 'arraybuffer',
    timeout: timeout,
    maxContentLength: maxFileSize,
    maxBodyLength: maxFileSize,
    headers: {
      'User-Agent': userAgent
    }
  });
  
  // Check if the file size exceeds the limit
  if (mediaResponse.data.length > maxFileSize) {
    throw new AppError(`File size exceeds the maximum allowed size of ${maxFileSize} bytes`, 400);
  }
  
  // Determine the content type and file extension
  const contentType = mediaResponse.headers['content-type'];
  let fileExtension;
  
  if (contentType.startsWith('image/')) {
    mediaType = 'image';
    fileExtension = contentType.split('/')[1].split(';')[0].toLowerCase();
    
    // Ensure the extension is in the supported formats
    if (!aiConfig.supportedFormats?.image?.includes(fileExtension)) {
      fileExtension = 'jpg'; // Default to jpg if not supported
    }
  } else if (contentType.startsWith('video/')) {
    mediaType = 'video';
    fileExtension = contentType.split('/')[1].split(';')[0].toLowerCase();
    
    // Ensure the extension is in the supported formats
    if (!aiConfig.supportedFormats?.video?.includes(fileExtension)) {
      fileExtension = 'mp4'; // Default to mp4 if not supported
    }
  } else {
    throw new AppError('Unsupported media type: ' + contentType, 400);
  }
  
  // Generate a unique filename
  const filename = `url_extracted_${uuidv4()}.${fileExtension}`;
  const filePath = path.join(uploadsDir, filename);
  
  // Save the file
  await fsPromises.writeFile(filePath, Buffer.from(mediaResponse.data));
  
  // Create a mock file object similar to multer's file object
  const fileObject = {
    path: filePath,
    mimetype: contentType,
    originalname: filename,
    size: mediaResponse.data.length
  };
  
  return {
    file: fileObject,
    mediaType,
    sourceUrl
  };
} 