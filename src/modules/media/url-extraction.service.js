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
    
    // Third attempt: Try Facebook Graph API with access token if available
    if (process.env.FACEBOOK_ACCESS_TOKEN) {
      try {
        console.log("Attempting to use Facebook Graph API with access token");
        
        // Extract the Facebook ID or post ID
        const facebookId = extractFacebookId(url);
        if (facebookId) {
          console.log(`Extracted Facebook ID: ${facebookId}, attempting Graph API with token`);
          
          // Different API endpoints to try
          const graphAPIEndpoints = [
            // Try to get post with attached media
            `https://graph.facebook.com/v18.0/${facebookId}?fields=full_picture,attachments{media,media_type,url,subattachments}&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`,
            // Try to get post directly
            `https://graph.facebook.com/v18.0/${facebookId}?fields=full_picture&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`,
            // Try with photo endpoint
            `https://graph.facebook.com/v18.0/${facebookId}?fields=images&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`
          ];
          
          for (const endpoint of graphAPIEndpoints) {
            try {
              const graphResponse = await axios.get(endpoint, {
                timeout: 15000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              });
              
              if (graphResponse.data) {
                // Check for full_picture in response
                if (graphResponse.data.full_picture) {
                  return await downloadAndProcessMedia(graphResponse.data.full_picture, 'image', url, uploadsDir);
                }
                
                // Check for attachments
                if (graphResponse.data.attachments && 
                    graphResponse.data.attachments.data && 
                    graphResponse.data.attachments.data.length > 0) {
                  
                  const attachment = graphResponse.data.attachments.data[0];
                  
                  // Check if there's media
                  if (attachment.media && attachment.media.image && attachment.media.image.src) {
                    return await downloadAndProcessMedia(attachment.media.image.src, 'image', url, uploadsDir);
                  }
                  
                  // Check for subattachments (multiple media)
                  if (attachment.subattachments && 
                      attachment.subattachments.data && 
                      attachment.subattachments.data.length > 0) {
                    
                    const subattachment = attachment.subattachments.data[0];
                    if (subattachment.media && subattachment.media.image && subattachment.media.image.src) {
                      return await downloadAndProcessMedia(subattachment.media.image.src, 'image', url, uploadsDir);
                    }
                  }
                }
                
                // Check for images array (used in photos)
                if (graphResponse.data.images && graphResponse.data.images.length > 0) {
                  // Get the largest image (first one usually)
                  const largestImage = graphResponse.data.images[0];
                  return await downloadAndProcessMedia(largestImage.source, 'image', url, uploadsDir);
                }
              }
            } catch (endpointError) {
              console.log(`Graph API endpoint ${endpoint.substring(0, 50)}... failed:`, endpointError.message);
              // Continue to next endpoint
            }
          }
        }
      } catch (tokenError) {
        console.log("Facebook Graph API with token failed:", tokenError.message);
      }
    }
    
    // Fourth attempt: Try to extract the ID and use public Graph API
    try {
      const facebookId = extractFacebookId(url);
      if (facebookId) {
        console.log(`Extracted Facebook ID: ${facebookId}, attempting public Graph API`);
        
        // Try to get the picture from Graph API (public endpoint)
        const graphUrl = `https://graph.facebook.com/${facebookId}/picture?type=large`;
        
        // Test if the URL returns a valid image
        const testResponse = await axios.head(graphUrl, {
          timeout: 10000,
          validateStatus: status => status < 400, // Accept any success status
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        // If we got a success response and it's an image
        if (testResponse.status < 400 && testResponse.headers['content-type'] && 
            testResponse.headers['content-type'].startsWith('image/')) {
          return await downloadAndProcessMedia(graphUrl, 'image', url, uploadsDir);
        }
      }
    } catch (graphError) {
      console.log("Public Graph API extraction failed for Facebook:", graphError.message);
    }
    
    // Fifth attempt: Try to access the post via oembed API
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
    
    // Sixth attempt: Try direct approach for Facebook photos
    if (url.includes('/photos/') || url.includes('/photo.php')) {
      try {
        const photoResponse = await axios.get(url, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml'
          }
        });
        
        // Use regular expressions to find the image URL in the response
        const htmlContent = photoResponse.data;
        
        // Look for FB photo URLs
        const photoMatches = [
          // Match photo URLs
          htmlContent.match(/og:image" content="([^"]+)"/),
          htmlContent.match(/div class="photo_wrap[^>]*><img src="([^"]+)"/),
          htmlContent.match(/style="background-image: url\('([^']+)'\)"/),
          htmlContent.match(/"image":{"uri":"([^"]+)"/)
        ];
        
        for (const match of photoMatches) {
          if (match && match[1]) {
            // Found a photo URL
            const photoUrl = match[1].replace(/\\/g, '');
            return await downloadAndProcessMedia(photoUrl, 'image', url, uploadsDir);
          }
        }
      } catch (photoError) {
        console.log("Direct photo extraction failed for Facebook:", photoError.message);
      }
    }
    
    // Seventh attempt: Try to extract from page preview
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
    
    // Eighth attempt: Handle Facebook Reels specifically
    if (url.includes('/reel/') || url.includes('/reels/')) {
      try {
        // Request the reel page with browser-like headers
        const reelResponse = await axios.get(url, {
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.facebook.com/'
          }
        });
        
        const htmlContent = reelResponse.data;
        
        // Look for video poster or thumbnail in reels
        const reelMatches = [
          // Match various thumbnail patterns in reels
          htmlContent.match(/og:image" content="([^"]+)"/),
          htmlContent.match(/"thumbnailImage":{"uri":"([^"]+)"/),
          htmlContent.match(/"previewImage":{"uri":"([^"]+)"/),
          htmlContent.match(/"posterImage":{"uri":"([^"]+)"/)
        ];
        
        for (const match of reelMatches) {
          if (match && match[1]) {
            // Found a thumbnail URL
            const thumbnailUrl = match[1].replace(/\\/g, '');
            return await downloadAndProcessMedia(thumbnailUrl, 'image', url, uploadsDir);
          }
        }
      } catch (reelError) {
        console.log("Reel extraction failed for Facebook:", reelError.message);
      }
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
 * Extract Facebook ID from URL
 * @param {string} url - The Facebook URL
 * @returns {string|null} - The extracted Facebook ID or null
 */
function extractFacebookId(url) {
  try {
    // Parse the URL
    const fbUrl = new URL(url);
    
    // Check if it's a Facebook URL
    if (!fbUrl.hostname.includes('facebook.com') && !fbUrl.hostname.includes('fb.com')) {
      return null;
    }
    
    // Get the path parts
    const pathParts = fbUrl.pathname.split('/').filter(part => part);
    
    // Handle different URL formats
    
    // Format: facebook.com/profile.php?id=NUMERIC_ID
    if (fbUrl.pathname.includes('profile.php')) {
      const idParam = fbUrl.searchParams.get('id');
      if (idParam && /^\d+$/.test(idParam)) {
        return idParam;
      }
    }
    
    // Format: facebook.com/photo.php?fbid=NUMERIC_ID
    if (fbUrl.pathname.includes('photo.php')) {
      const fbidParam = fbUrl.searchParams.get('fbid');
      if (fbidParam && /^\d+$/.test(fbidParam)) {
        return fbidParam;
      }
    }
    
    // Format: facebook.com/GROUP_NAME/posts/POST_ID
    if (pathParts.length >= 3 && pathParts[1] === 'posts') {
      return pathParts[2];
    }
    
    // Format: facebook.com/watch?v=VIDEO_ID
    if (fbUrl.pathname === '/watch' && fbUrl.searchParams.has('v')) {
      return fbUrl.searchParams.get('v');
    }
    
    // Format: facebook.com/PAGE_ID
    if (pathParts.length === 1 && /^\d+$/.test(pathParts[0])) {
      return pathParts[0];
    }
    
    // Format: facebook.com/reel/REEL_ID
    if (pathParts.length >= 2 && pathParts[0] === 'reel') {
      return pathParts[1];
    }
    
    // Format: facebook.com/PAGENAME (try to use the username)
    if (pathParts.length === 1) {
      return pathParts[0];
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting Facebook ID:", error);
    return null;
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
    // Print debugging info
    console.log("Attempting to extract media from Twitter URL:", url);
    
    // First attempt: Try direct image extraction if the URL is already a direct media link
    if (url.includes('pbs.twimg.com') || url.includes('video.twimg.com')) {
      try {
        return await downloadAndProcessMedia(url, 
          url.includes('video') ? 'video' : 'image', 
          url, 
          uploadsDir);
      } catch (directError) {
        console.log("Direct media link extraction failed:", directError.message);
      }
    }
    
    // Second attempt: Try to get media using regular extraction
    try {
      return await extractFromWebsite(url, uploadsDir);
    } catch (error) {
      console.log("Regular extraction failed for Twitter, trying specialized approaches...");
    }
    
    // Third attempt: Try fxtwitter API (a public API that returns media from tweets)
    try {
      // Replace twitter.com or x.com with fxtwitter.com
      const fxUrl = url.replace(/https?:\/\/(www\.)?(twitter|x)\.com/, 'https://api.fxtwitter.com');
      
      const fxResponse = await axios.get(fxUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      console.log("fxtwitter API response status:", fxResponse.status);
      
      if (fxResponse.data && fxResponse.data.status === "success") {
        if (fxResponse.data.tweet?.media?.photos?.length > 0) {
          // Extract the first photo
          const photoUrl = fxResponse.data.tweet.media.photos[0].url;
          return await downloadAndProcessMedia(photoUrl, 'image', url, uploadsDir);
        } else if (fxResponse.data.tweet?.media?.videos?.length > 0) {
          // Extract video thumbnail
          const videoThumbnail = fxResponse.data.tweet.media.videos[0].thumbnail;
          return await downloadAndProcessMedia(videoThumbnail, 'image', url, uploadsDir);
        } else if (fxResponse.data.tweet.user?.avatar_url) {
          // Last resort: use profile picture
          return await downloadAndProcessMedia(fxResponse.data.tweet.user.avatar_url, 'image', url, uploadsDir);
        }
      }
    } catch (fxError) {
      console.log("fxtwitter API extraction failed:", fxError.message);
    }
    
    // Fourth attempt: Try vxtwitter API (another alternative public API)
    try {
      // Replace twitter.com or x.com with vxtwitter.com
      const vxUrl = url.replace(/https?:\/\/(www\.)?(twitter|x)\.com/, 'https://api.vxtwitter.com');
      
      const vxResponse = await axios.get(vxUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      console.log("vxtwitter API response status:", vxResponse.status);
      
      if (vxResponse.data) {
        if (vxResponse.data.media_extended?.length > 0) {
          // Extract the first media
          const mediaUrl = vxResponse.data.media_extended[0].url;
          return await downloadAndProcessMedia(mediaUrl, 'image', url, uploadsDir);
        } else if (vxResponse.data.user_profile_image_url) {
          // Last resort: use profile picture
          return await downloadAndProcessMedia(vxResponse.data.user_profile_image_url, 'image', url, uploadsDir);
        }
      }
    } catch (vxError) {
      console.log("vxtwitter API extraction failed:", vxError.message);
    }
    
    // Fifth attempt: Try Nitter API (another Twitter alternative front-end)
    try {
      const tweetId = extractTwitterId(url);
      if (tweetId) {
        // Use a Nitter instance (avoid rate limits by trying multiple)
        const nitterInstances = [
          'https://nitter.net',
          'https://nitter.42l.fr',
          'https://nitter.pussthecat.org'
        ];
        
        // Try each instance until one works
        for (const instance of nitterInstances) {
          try {
            const nitterUrl = `${instance}/pic/media%2F${tweetId}`;
            
            // Check if the URL is accessible with a HEAD request first
            const headResponse = await axios.head(nitterUrl, {
              timeout: 5000,
              validateStatus: status => status < 400
            });
            
            if (headResponse.status < 400) {
              return await downloadAndProcessMedia(nitterUrl, 'image', url, uploadsDir);
            }
          } catch (instanceError) {
            console.log(`Nitter instance ${instance} failed:`, instanceError.message);
            // Continue to next instance
          }
        }
      }
    } catch (nitterError) {
      console.log("Nitter extraction failed:", nitterError.message);
    }
    
    // Sixth attempt: Try official Twitter API v2 if credentials are available
    try {
      const tweetId = extractTwitterId(url);
      if (tweetId && process.env.TWITTER_BEARER_TOKEN) {
        console.log("Attempting to use Twitter API v2 with bearer token");
        
        const twitterApiUrl = `https://api.twitter.com/2/tweets/${tweetId}?expansions=attachments.media_keys&media.fields=url,preview_image_url,type`;
        
        const twitterResponse = await axios.get(twitterApiUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
          },
          timeout: 10000
        });
        
        if (twitterResponse.data?.includes?.media) {
          const media = twitterResponse.data.includes.media[0];
          const mediaUrl = media.url || media.preview_image_url;
          
          if (mediaUrl) {
            return await downloadAndProcessMedia(mediaUrl, 'image', url, uploadsDir);
          }
        }
      }
    } catch (apiError) {
      console.log("Twitter API v2 extraction failed:", apiError.message);
    }
    
    // Seventh attempt: Try syndication approach
    const useAlternatives = aiConfig.urlExtraction.socialMedia?.useAlternatives !== false;
    const useSyndication = aiConfig.urlExtraction.socialMedia?.platforms?.twitter?.useSyndication !== false;
    
    if (useAlternatives && useSyndication) {
      try {
        // Replace twitter.com with syndication.twitter.com
        const syndicationUrl = url.replace(/https?:\/\/(www\.)?(twitter|x)\.com/, 'https://syndication.twitter.com');
        
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
        console.log("Syndication extraction failed for Twitter:", syndicationError.message);
      }
    }
    
    // Eighth attempt: Try to extract using Twitter's publish API
    try {
      // Extract the tweet ID from the URL
      const tweetId = extractTwitterId(url);
      if (!tweetId) {
        console.log("Could not extract tweet ID from URL");
      } else {
        console.log("Extracted tweet ID:", tweetId);
        
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
      }
    } catch (publishError) {
      console.log("Publish API extraction failed for Twitter:", publishError.message);
    }
    
    // Ninth attempt: Try the alternate static API
    try {
      // Extract the tweet ID from the URL
      const tweetId = extractTwitterId(url);
      if (!tweetId) {
        console.log("Could not extract tweet ID from URL for static API");
      } else {
        console.log("Using tweet ID for static API:", tweetId);
        
        // Try to get the tweet photo from unofficial API
        const staticUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}`;
        const staticResponse = await axios.get(staticUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        console.log("Static API response status:", staticResponse.status);
        
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
      }
    } catch (staticError) {
      console.log("Static API extraction failed for Twitter:", staticError.message);
    }
    
    // Tenth attempt: Try direct request with browser-like headers
    try {
      const browserLikeHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      };
      
      const directResponse = await axios.get(url, {
        headers: browserLikeHeaders,
        timeout: 30000
      });
      
      const htmlContent = directResponse.data;
      
      // Try to find image URLs using regex
      const imgMatches = [
        // Various patterns to extract images from Twitter HTML
        htmlContent.match(/<meta property="og:image" content="([^"]+)"/i),
        htmlContent.match(/https:\/\/pbs\.twimg\.com\/media\/[^\.]+\.[^"]+/g),
        htmlContent.match(/https:\/\/pbs\.twimg\.com\/profile_images\/[^\.]+\.[^"]+/g),
        htmlContent.match(/\\"profile_image_url_https\\":\\"([^"\\]+)\\"/i),
        // New patterns for X.com
        htmlContent.match(/\\"media_url_https\\":\\"([^"\\]+)\\"/i),
        htmlContent.match(/\\"expanded_url\\":\\"([^"\\]+\\\/photo\\\/)([^"\\]+)\\"/i)
      ];
      
      for (const match of imgMatches) {
        if (match && (match[1] || match[0])) {
          const imgUrl = match[1] || match[0];
          const cleanImgUrl = imgUrl.replace(/\\/g, '');
          return await downloadAndProcessMedia(cleanImgUrl, 'image', url, uploadsDir);
        }
      }
    } catch (directError) {
      console.log("Direct extraction with browser headers failed:", directError.message);
    }
    
    // All attempts failed
    throw new AppError('Could not extract media from Twitter/X URL. Try using a direct image URL from Twitter instead.', 400);
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
    if (pathParts.length >= 3 && (pathParts[1] === 'status' || pathParts[1] === 'statuses')) {
      return pathParts[2].split('?')[0]; // Remove any query parameters
    }
    
    // Check for alternate format: /i/web/status/id
    if (pathParts.length >= 4 && pathParts[0] === 'i' && pathParts[1] === 'web' && pathParts[2] === 'status') {
      return pathParts[3].split('?')[0]; // Remove any query parameters
    }
    
    // Check for the new X.com format: /i/status/id
    if (pathParts.length >= 3 && pathParts[0] === 'i' && pathParts[1] === 'status') {
      return pathParts[2].split('?')[0]; // Remove any query parameters
    }
    
    // Check for short URLs
    if (twitterUrl.hostname.includes('t.co')) {
      // t.co URLs require following redirects, we can't extract ID directly
      return null;
    }
    
    // Try to extract from query parameters (some Twitter URLs use this format)
    if (twitterUrl.searchParams.has('tweet_id')) {
      return twitterUrl.searchParams.get('tweet_id');
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting Twitter ID:", error.message);
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