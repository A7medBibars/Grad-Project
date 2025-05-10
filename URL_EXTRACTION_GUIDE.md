# URL Media Extraction Guide

This guide explains how to use the URL media extraction service in your application to extract images and videos from various URLs, particularly from social media platforms.

## Overview

The URL extraction service allows you to extract media (images or videos) from URLs and process them through your existing media upload API. The service is particularly useful for handling social media links that often have anti-scraping measures.

## Supported Platforms

The service includes specialized handling for the following social media platforms:

### 1. Facebook
- Posts
- Photos
- Videos
- Reels
- Profile pages
- Mobile versions
- Graph API access (with token)

### 2. Twitter/X
- Tweets with media
- Profile pictures
- Videos (thumbnails)
- Multiple URL formats (twitter.com, x.com)
- API integration options

### 3. Instagram
- Posts with images
- Profile pages

### 4. TikTok
- Video posts (thumbnails)

### 5. YouTube
- Videos (thumbnails)

### 6. Regular Websites
- Open Graph meta tags
- Twitter cards
- Regular image and video tags

## Usage

### Basic Usage

To extract media from a URL:

```javascript
// Server-side
import { extractMediaFromUrl } from './url-extraction.service.js';

async function handleUrlExtraction(url) {
  try {
    const result = await extractMediaFromUrl(url);
    // result contains file object with path, mimetype, etc.
    return result;
  } catch (error) {
    console.error('Extraction failed:', error.message);
    throw error;
  }
}
```

### API Endpoint

The service is integrated with the following API endpoints:

1. Single URL extraction:
```
POST /api/media/upload
Content-Type: application/json

{
  "mediaUrl": "https://example.com/page-with-image",
  "title": "Optional Title",
  "description": "Optional Description",
  "collectionId": "Optional Collection ID"
}
```

2. Multiple URLs extraction:
```
POST /api/media/upload-multiple
Content-Type: application/json

{
  "mediaUrls": [
    "https://example.com/page-with-image1",
    "https://twitter.com/user/status/123456789"
  ],
  "title": "Optional Title",
  "description": "Optional Description",
  "collectionId": "Optional Collection ID"
}
```

## Configuration

The URL extraction service is highly configurable. Configuration options are available in `src/config/ai.config.js`.

### Main Configuration Options

```javascript
urlExtraction: {
  // Maximum file size to download from URL in bytes (default: 50MB)
  maxFileSize: 52428800,
  
  // Timeout for URL requests in milliseconds (default: 30 seconds)
  timeout: 30000,
  
  // Whether to enable URL content extraction
  enabled: true,
  
  // Social media extraction settings
  socialMedia: {
    // Whether to enable special handling for social media URLs
    enabled: true,
    
    // User agent to use for requests to social media sites
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
    
    // Whether to attempt to use alternative URLs like mobile versions
    useAlternatives: true,
    
    // Supported platforms configuration
    platforms: {
      facebook: {
        enabled: true,
        useMobileVersion: true,
        useGraphAPI: true // Requires FACEBOOK_ACCESS_TOKEN env variable
      },
      instagram: {
        enabled: true
      },
      twitter: {
        enabled: true,
        useSyndication: true,
        useTwitterAPI: true // Requires TWITTER_BEARER_TOKEN env variable
      },
      tiktok: {
        enabled: true
      },
      youtube: {
        enabled: true,
        useThumbnail: true
      }
    }
  }
}
```

### Environment Variables

The following environment variables can be used to override default configuration:

| Variable | Description | Default Value |
|----------|-------------|---------------|
| URL_MAX_FILE_SIZE | Maximum file size to download in bytes | 52428800 (50MB) |
| URL_TIMEOUT | Timeout for URL requests in milliseconds | 30000 (30s) |
| URL_EXTRACTION_ENABLED | Whether to enable URL extraction | true |
| SOCIAL_MEDIA_EXTRACTION_ENABLED | Whether to enable social media extraction | true |
| SOCIAL_MEDIA_USE_ALTERNATIVES | Whether to use alternative methods | true |
| SOCIAL_MEDIA_FACEBOOK_ENABLED | Whether to enable Facebook extraction | true |
| SOCIAL_MEDIA_INSTAGRAM_ENABLED | Whether to enable Instagram extraction | true |
| SOCIAL_MEDIA_TWITTER_ENABLED | Whether to enable Twitter extraction | true |
| SOCIAL_MEDIA_TIKTOK_ENABLED | Whether to enable TikTok extraction | true |
| SOCIAL_MEDIA_YOUTUBE_ENABLED | Whether to enable YouTube extraction | true |
| FACEBOOK_ACCESS_TOKEN | Facebook Graph API Access Token for enhanced extraction | undefined |
| TWITTER_BEARER_TOKEN | Twitter API v2 Bearer Token for enhanced extraction | undefined |

## Advanced Features

### Facebook Extraction

The service uses multiple approaches to extract media from Facebook:

1. Regular extraction using Open Graph tags
2. Mobile version of the site
3. Graph API with access token (when available)
4. Public Graph API for profile pictures
5. oEmbed API for embedded content
6. Direct photo extraction
7. Page preview via Facebook Debug Tool
8. Facebook Reels extraction

### Twitter/X Extraction

The service uses multiple approaches to extract media from Twitter/X:

1. Regular extraction using Open Graph tags
2. FXTwitter API integration
3. VXTwitter API integration
4. Nitter instances for alternative access
5. Twitter API v2 (if bearer token is provided)
6. Syndication endpoints
7. Twitter's publish API
8. Static API for tweet content
9. Direct request with browser-like headers

## Setting Up Social Media API Access

### Facebook Developer Setup

To improve Facebook URL extraction, especially for non-public content, you can set up a Facebook Developer account and create an app:

1. **Create a Facebook Developer Account**:
   - Go to [Facebook Developers](https://developers.facebook.com/) and sign in with your Facebook account
   - Complete the registration process if you're new

2. **Create a New App**:
   - Click "Create App"
   - Select "Other" as the app type
   - Fill in the app details and create the app

3. **Generate an Access Token**:
   - Navigate to the "Tools" section
   - Select "Graph API Explorer"
   - Select your app from the dropdown
   - Click "Generate Access Token"
   - Request the following permissions:
     - `user_posts`
     - `pages_read_engagement`
     - `pages_read_user_content`

4. **Use the Token in Your Application**:
   - Copy the generated access token
   - Add it to your environment variables as `FACEBOOK_ACCESS_TOKEN`
   - Restart your application

**Note**: Facebook access tokens expire. For long-term use, you may need to set up a process to refresh your token or use a long-lived token.

### Twitter Developer Setup

For improved Twitter/X extraction:

1. **Create a Twitter Developer Account**:
   - Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Sign in and apply for a developer account

2. **Create a Project and App**:
   - Once approved, create a new project
   - Add an app to your project

3. **Generate a Bearer Token**:
   - Navigate to your app's "Keys and Tokens" tab
   - Generate a Bearer Token (or use the API Key and Secret to generate one)

4. **Use the Token in Your Application**:
   - Add the Bearer Token to your environment variables as `TWITTER_BEARER_TOKEN`
   - Restart your application

## Troubleshooting

If you encounter issues with specific platforms:

### Facebook Issues

- Facebook actively prevents scraping and may block repeated requests
- Set `useMobileVersion: true` for better results
- Set up a Facebook Developer account and provide an access token as described above
- Note that even with an access token, private content or content from users who have restricted their privacy settings may not be accessible
- For best results, ensure you have the required permissions in your access token

### Twitter/X Issues

- Twitter/X has strong anti-scraping measures
- For better results, set up a Twitter Developer account and provide a bearer token
- Configure the TWITTER_BEARER_TOKEN environment variable
- Alternative APIs like FXTwitter may have rate limits

### General Issues

- Check network connectivity
- Verify the URL is valid and accessible
- Ensure the content isn't protected behind authentication
- Look for CORS or regional restrictions
- Check for rate limiting from the source website

## Error Handling

The service provides detailed error messages to help diagnose issues:

```javascript
try {
  const result = await extractMediaFromUrl(url);
  // Process result
} catch (error) {
  if (error.message.includes('authentication')) {
    // Handle authentication errors
  } else if (error.message.includes('timeout')) {
    // Handle timeout errors
  } else if (error.message.includes('file size')) {
    // Handle file size errors
  } else {
    // Handle other errors
  }
}
```

## Performance Considerations

- The service may make multiple requests for a single URL
- Consider implementing caching for frequently requested URLs
- Set appropriate timeouts based on your application needs
- Monitor rate limits with social media platforms 