# Media Extraction Guide

This document provides information about the URL media extraction functionality and how to optimize results for different platforms.

## Supported Platforms

The system can extract media (images and videos) from various sources:

- Regular websites with Open Graph tags or standard media elements
- YouTube videos 
- Instagram posts
- Twitter/X posts
- TikTok videos
- Facebook posts (requires additional configuration)

## Platform-Specific Guidelines

### YouTube

YouTube extraction works best with:

1. **Standard YouTube URLs** in the following formats:
   - `https://www.youtube.com/watch?v=VIDEO_ID`
   - `https://youtu.be/VIDEO_ID`
   - `https://www.youtube.com/embed/VIDEO_ID`

2. **Public Videos**: The video must be publicly accessible.

3. **Thumbnail Extraction**: By default, the system extracts the video's thumbnail image as a proxy for the video content, trying multiple thumbnail quality versions until one works.

### Instagram

Instagram extraction works best with:

1. **Public Posts**: Private or restricted content is not accessible.

2. **Direct Post URLs** in these formats:
   - `https://www.instagram.com/p/POST_ID/`
   - `https://www.instagram.com/reel/REEL_ID/`

3. **Browser Accessibility**: If the URL works in an incognito/private browser window without requiring login, it will likely work with the extractor.

Instagram has strict scraping protections, so the system uses multiple approaches:
- Standard web extraction
- Mobile user agent simulation
- Open Graph metadata extraction

### Twitter/X

Twitter extraction works best with:

1. **Direct Tweet URLs**: `https://twitter.com/username/status/TWEET_ID`

2. **Public Tweets**: The tweet must be from a public account.

3. **Syndication**: The system uses Twitter's syndication endpoint for better access to public content.

### TikTok

TikTok extraction works with:

1. **Direct Video URLs**: `https://www.tiktok.com/@username/video/VIDEO_ID`

2. **Public Videos**: The video must be publicly accessible.

TikTok has strong anti-scraping measures, so success rates may vary.

## Troubleshooting

If you encounter issues with media extraction:

### General Issues

1. **Check URL Format**: Ensure the URL is correct and directly points to the content.
2. **Check Content Privacy**: Private content cannot be extracted.
3. **Try Alternate URLs**: Some platforms have alternative URL formats that work better.

### Platform-Specific Issues

#### YouTube
- If a thumbnail can't be extracted, try using a different video or check if the video is available in your region.
- Very new or very old videos might have incomplete thumbnails.

#### Instagram
- Instagram regularly changes its HTML structure, making extraction challenging.
- Try using posts from official/verified accounts, which typically have more consistent formatting.

#### Twitter/X
- If media extraction fails, ensure the tweet contains media (image or video).
- Some tweets with multiple media items may only have the first item extracted.

## Advanced Configuration

The media extraction behavior can be customized through environment variables:

```
# General URL extraction settings
URL_EXTRACTION_ENABLED=true
URL_MAX_FILE_SIZE=52428800  # 50MB max file size
URL_TIMEOUT=30000           # 30 second timeout

# Social media specific settings
SOCIAL_MEDIA_EXTRACTION_ENABLED=true
SOCIAL_MEDIA_USE_ALTERNATIVES=true

# Platform-specific toggles
SOCIAL_MEDIA_YOUTUBE_ENABLED=true
SOCIAL_MEDIA_INSTAGRAM_ENABLED=true
SOCIAL_MEDIA_TWITTER_ENABLED=true
SOCIAL_MEDIA_TIKTOK_ENABLED=true
```

For additional details on Facebook configuration, see `facebook-api-setup.md`. 