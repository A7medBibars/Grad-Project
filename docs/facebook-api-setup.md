# Facebook Graph API Integration

This application supports extracting media from Facebook posts using the Facebook Graph API. This provides more reliable access to media content compared to HTML scraping methods.

## Setup Instructions

To enable Facebook Graph API integration, follow these steps:

1. **Create a Facebook Developer Account**
   - Go to [Facebook for Developers](https://developers.facebook.com/)
   - Sign in with your Facebook account or create a new account

2. **Create a Facebook App**
   - From the Developer Dashboard, click "Create App"
   - Select the app type (Consumer or Business)
   - Fill in the required details and create your app

3. **Configure App Settings**
   - Navigate to the app settings
   - Make note of your App ID and App Secret
   - Add the necessary products to your app (e.g., Facebook Login)

4. **Generate an Access Token**
   - For basic public content access, you can use an App Token
   - For accessing user content, you'll need a User Access Token with the appropriate permissions
   - For long-term use, consider using a Long-Lived Access Token

5. **Set Environment Variables**
   This application uses the following environment variables for Facebook Graph API configuration:

   ```
   FACEBOOK_GRAPH_API_ENABLED=true
   FACEBOOK_GRAPH_API_VERSION=v18.0
   FACEBOOK_GRAPH_API_ACCESS_TOKEN=your_access_token_here
   FACEBOOK_APP_ID=your_app_id_here
   FACEBOOK_APP_SECRET=your_app_secret_here
   ```

   Add these to your `.env` file in the config directory.

## Access Token Types

### App Token
- Suitable for accessing public content
- Never expires
- Format: `{app-id}|{app-secret}`

### User Access Token
- Required for accessing user's content with their permission
- Short-lived (usually 1-2 hours)
- Requires user to authorize your app with the necessary permissions

### Long-Lived Access Token
- Extended lifetime (typically 60 days)
- Can be refreshed before expiration
- Recommended for production use

## Permissions

Depending on what content you need to access, you may need different permissions:
- `public_profile`: Basic profile information
- `user_posts`: Access to a user's posts
- `pages_read_engagement`: Access to page content

## Limitations

Note that the Graph API has usage limits and rate limits. For high-volume applications, monitor your usage and implement rate limiting in your code.

## Fallback Mechanism

If the Graph API fails to retrieve media content, the application will automatically fall back to HTML scraping methods. This provides a robust solution that works even when the API is not available or properly configured. 