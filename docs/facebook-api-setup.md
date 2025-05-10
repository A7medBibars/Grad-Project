# Facebook Graph API Setup

This document provides instructions on how to set up Facebook Graph API credentials for enhanced media extraction from Facebook URLs.

## Why Facebook API Access Is Needed

Facebook restricts access to content for web scrapers and automated tools. To reliably extract media from Facebook posts, we need to use the official Facebook Graph API with proper authentication.

## Setup Steps

1. **Create a Facebook Developer Account**:
   - Go to [developers.facebook.com](https://developers.facebook.com/)
   - Sign in with your Facebook account
   - Complete the developer registration process if needed

2. **Create a Facebook App**:
   - From the Developer Dashboard, click "Create App"
   - Select "Consumer" as the app type
   - Fill in the required details and create your app

3. **Get App Credentials**:
   - Once your app is created, go to the app dashboard
   - Navigate to "Settings" > "Basic"
   - Note your App ID and App Secret

4. **Generate Access Token**:
   - Go to "Tools" > "Graph API Explorer"
   - Select your app from the dropdown
   - Click "Generate Access Token"
   - For media extraction, you need at least the following permissions:
     - `pages_read_engagement`
     - `user_posts`
     - `user_photos`
     - `user_videos`
   - Click "Generate Access Token" and authenticate with your Facebook account

5. **Configure Your Environment**:
   - Create a `.env` file in the `config` directory (or use your existing one)
   - Add the following entries:

   ```
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   FACEBOOK_GRAPH_API_ACCESS_TOKEN=your_access_token
   FACEBOOK_GRAPH_API_ENABLED=true
   FACEBOOK_GRAPH_API_VERSION=v18.0
   ```

## Token Limitations

Note that Facebook access tokens have limitations:

- User access tokens typically expire in 1-2 hours
- For longer-lasting tokens, you can convert to a long-lived access token (60 days)
- For production use, consider using a Page access token or implement the token refresh workflow

## Troubleshooting

If you encounter issues with Facebook API access:

1. **Check Permissions**: Ensure your token has the necessary permissions
2. **Verify Token Validity**: Tokens expire - check if yours is still valid
3. **API Versions**: Make sure you're using a supported API version
4. **Rate Limits**: Facebook imposes rate limits on API requests
5. **Post Privacy**: The API can only access posts you have permission to view

## Additional Resources

- [Facebook Graph API Documentation](https://developers.facebook.com/docs/graph-api)
- [Access Token Documentation](https://developers.facebook.com/docs/facebook-login/access-tokens)
- [Facebook Developer Community](https://developers.facebook.com/community/) 