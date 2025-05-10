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

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  
  try {
    // First attempt: Try to get media using regular extraction
    try {
      return await extractFromWebsite(url, uploadsDir);
    } catch (error) {
      console.log("Regular extraction failed for Facebook, trying specialized approaches...");
    }
    
    // Second attempt: Try mobile version
    const useAlternatives = aiConfig.urlExtraction.socialMedia?.useAlternatives !== false;
    const useMobileVersion = aiConfig.urlExtraction.socialMedia?.platforms?.facebook?.useMobileVersion !== false;
    
    if (useAlternatives && useMobileVersion) {
      try {
        const mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
        return await extractFromWebsite(mobileUrl, uploadsDir);
      } catch (mobileError) {
        console.log("Mobile version extraction failed for Facebook");
      }
    }
    
    // Third attempt: Try to access the post via oembed API
    try {
      const originalUrl = new URL(url);
      // Clean URL parameters
      const cleanUrl = `${originalUrl.protocol}//${originalUrl.host}${originalUrl.pathname}`;
      const oembedUrl = `https://www.facebook.com/plugins/post/oembed.json/?url=${encodeURIComponent(cleanUrl)}`;
      
      const oembedResponse = await axios.get(oembedUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (oembedResponse.data && oembedResponse.data.html) {
        // Extract image from the HTML
        const htmlContent = oembedResponse.data.html;
        
        // Look for image in the oEmbed HTML
        const imgMatch = htmlContent.match(/background-image:url\(['"]?(.*?)['"]?\)/i) || 
                         htmlContent.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
                         
        if (imgMatch && imgMatch[1]) {
          const imgUrl = imgMatch[1];
          return await downloadAndProcessMedia(imgUrl, 'image', url, uploadsDir);
        }
      }
    } catch (oembedError) {
      console.log("oEmbed extraction failed for Facebook:", oembedError.message);
    }
    
    // Fourth attempt: Try to extract from page preview
    try {
      const previewUrl = `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(url)}`;
      const response = await axios.get(previewUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = await loadCheerio(response.data);
      
      // Look for preview images in the Facebook debug tool
      const previewImg = $('img.image_fullwidth').attr('src');
      if (previewImg) {
        return await downloadAndProcessMedia(previewImg, 'image', url, uploadsDir);
      }
    } catch (previewError) {
      console.log("Preview extraction failed for Facebook");
    }
    
    // All attempts failed
    throw new AppError('Could not extract media from Facebook URL. Facebook may require authentication to access this content.', 400);
  } catch (error) {
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to extract media from Facebook post: ' + error.message, 400);
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
  
  // Instagram requires authentication for most content
  // We'll use a public approach by treating it as a regular website first
  try {
    // Try to get the media using normal website extraction
    return await extractFromWebsite(url, uploadsDir);
  } catch (error) {
    throw new AppError('Could not extract media from Instagram URL. Instagram may require authentication to access this content.', 400);
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
    // First attempt: Try to get media using regular extraction
    try {
      return await extractFromWebsite(url, uploadsDir);
    } catch (error) {
      console.log("Regular extraction failed for Twitter, trying specialized approaches...");
    }
    
    // Second attempt: Try syndication approach
    const useAlternatives = aiConfig.urlExtraction.socialMedia?.useAlternatives !== false;
    const useSyndication = aiConfig.urlExtraction.socialMedia?.platforms?.twitter?.useSyndication !== false;
    
    if (useAlternatives && useSyndication) {
      try {
        // Replace twitter.com with syndication.twitter.com
        const syndicationUrl = url.replace(/https?:\/\/(www\.)?twitter\.com/, 'https://syndication.twitter.com');
        
        const response = await axios.get(syndicationUrl, {
          responseType: 'text',
          timeout: aiConfig.urlExtraction?.timeout || 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        // Use dynamic cheerio loading
        const $ = await loadCheerio(response.data);
        
        // Look for media elements
        let mediaUrl = null;
        let mediaType = 'image';
        
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
        console.log("Syndication extraction failed for Twitter");
      }
    }
    
    // Third attempt: Try to extract using Twitter's publish API
    try {
      // Extract the tweet ID from the URL
      const tweetId = extractTwitterId(url);
      if (!tweetId) {
        throw new Error("Could not extract tweet ID from URL");
      }
      
      const publishUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
      const publishResponse = await axios.get(publishUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (publishResponse.data && publishResponse.data.html) {
        // Extract image from the HTML
        const htmlContent = publishResponse.data.html;
        const $ = await loadCheerio(htmlContent);
        
        // Look for image in the embedded content
        const imgSrc = $('img').attr('src');
        if (imgSrc) {
          return await downloadAndProcessMedia(imgSrc, 'image', url, uploadsDir);
        }
      }
    } catch (publishError) {
      console.log("Publish API extraction failed for Twitter:", publishError.message);
    }
    
    // Fourth attempt: Try the alternate static API
    try {
      // Extract the tweet ID from the URL
      const tweetId = extractTwitterId(url);
      if (!tweetId) {
        throw new Error("Could not extract tweet ID from URL");
      }
      
      // Try to get the tweet photo from unofficial API
      const staticUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}`;
      const staticResponse = await axios.get(staticUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (staticResponse.data) {
        // Check for images
        if (staticResponse.data.photos && staticResponse.data.photos.length > 0) {
          const photoUrl = staticResponse.data.photos[0].url;
          return await downloadAndProcessMedia(photoUrl, 'image', url, uploadsDir);
        }
        
        // Check for video
        if (staticResponse.data.video && staticResponse.data.video.poster) {
          const videoThumbnail = staticResponse.data.video.poster;
          return await downloadAndProcessMedia(videoThumbnail, 'image', url, uploadsDir);
        }
        
        // Check for profile picture as last resort
        if (staticResponse.data.user && staticResponse.data.user.profile_image_url) {
          const profilePic = staticResponse.data.user.profile_image_url;
          // Get a larger version of the profile pic
          const largerProfilePic = profilePic.replace('_normal', '_400x400');
          return await downloadAndProcessMedia(largerProfilePic, 'image', url, uploadsDir);
        }
      }
    } catch (staticError) {
      console.log("Static API extraction failed for Twitter:", staticError.message);
    }
    
    // All attempts failed
    throw new AppError('Could not extract media from Twitter/X URL.', 400);
  } catch (error) {
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to extract media from Twitter/X post: ' + error.message, 400);
  }
}

/**
 * Extract Twitter ID from URL
 * @param {string} url - The Twitter URL
 * @returns {string|null} - The extracted tweet ID or null
 */
function extractTwitterId(url) {
  try {
    // Convert URL to URL object
    const twitterUrl = new URL(url);
    
    // Check if it's a Twitter URL
    if (!twitterUrl.hostname.includes('twitter.com') && !twitterUrl.hostname.includes('x.com')) {
      return null;
    }
    
    // Extract the path parts
    const pathParts = twitterUrl.pathname.split('/').filter(part => part);
    
    // Check for standard tweet format: /username/status/id
    if (pathParts.length >= 3 && pathParts[1] === 'status') {
      return pathParts[2];
    }
    
    // Check for alternate format: /i/web/status/id
    if (pathParts.length >= 4 && pathParts[0] === 'i' && pathParts[1] === 'web' && pathParts[2] === 'status') {
      return pathParts[3];
    }
    
    // Check for short URLs
    if (twitterUrl.hostname.includes('t.co')) {
      // t.co URLs require following redirects, we can't extract ID directly
      return null;
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting Twitter ID:", error);
    return null;
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
      throw new AppError('Could not extract YouTube video ID from URL', 400);
    }
    
    // Check if thumbnail extraction is enabled
    const useThumbnail = aiConfig.urlExtraction.socialMedia?.platforms?.youtube?.useThumbnail !== false;
    
    if (useThumbnail) {
      // YouTube video thumbnail URL
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      
      // We'll use the thumbnail image as proxy for the video
      return await downloadAndProcessMedia(thumbnailUrl, 'image', url, uploadsDir);
    } else {
      // Try regular website extraction
      return await extractFromWebsite(url, uploadsDir);
    }
  } catch (error) {
    throw new AppError(`Could not extract media from YouTube URL: ${error.message}`, 400);
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