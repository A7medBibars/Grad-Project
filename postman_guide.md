# Complete API Testing Guide for Postman

This guide will help you test all API endpoints using Postman.

## Prerequisites
- Make sure your server is running
- You'll need a valid JWT token for authenticated endpoints (obtain from login)
- You'll need valid MongoDB ObjectIDs for collections, users, and media items

## Table of Contents
1. [Authentication Flow](#authentication-flow)
2. [User API Endpoints](#user-api-endpoints)
3. [Collections API Endpoints](#collections-api-endpoints)
4. [Media API Endpoints](#media-api-endpoints)
5. [General Testing Tips](#general-testing-tips)

## Authentication Flow

The typical authentication flow is:
1. Register a new user with the signup endpoint
2. Verify the account using the verification link sent to email
3. Log in with the login endpoint
4. Copy the JWT token from the response
5. Use this token in the token header for authenticated endpoints

## User API Endpoints

### 1. User Signup
- **Method**: POST
- **URL**: `https://your-vercel-app.vercel.app/user/signup`
- **Auth Required**: No
- **Body** (JSON):
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com", 
    "password": "Password123!",
    "cPassword": "Password123!",
    "phone": "00201123456789",
    "DOB": "1990-01-01"
  }
  ```
- **Notes**: Password must contain uppercase, lowercase, number, and special character.

### 2. Verify Account
- **Method**: GET
- **URL**: `https://your-vercel-app.vercel.app/user/verify/YOUR_VERIFICATION_TOKEN`
- **Auth Required**: No
- **Notes**: The verification token is sent to the user's email.

### 3. User Login
- **Method**: POST
- **URL**: `https://your-vercel-app.vercel.app/user/login`
- **Auth Required**: No
- **Body** (JSON):
  ```json
  {
    "email": "john.doe@example.com",
    "password": "Password123!"
  }
  ```
- **Alternative Login with Phone**:
  ```json
  {
    "phone": "00201123456789",
    "password": "Password123!"
  }
  ```
- **Notes**: After successful login, the JWT token will be returned in the response.

### 4. User Logout
- **Method**: POST
- **URL**: `https://your-vercel-app.vercel.app/user/logout`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE

### 5. Update User Profile
- **Method**: PUT
- **URL**: `https://your-vercel-app.vercel.app/user/update`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE
- **Body** (JSON):
  ```json
  {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@example.com",
    "phone": "00201123456789",
    "DOB": "1990-01-01"
  }
  ```
- **Notes**: You can update any or all of these fields.

### 6. Update Password
- **Method**: PUT
- **URL**: `https://your-vercel-app.vercel.app/user/update-password`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE
- **Body** (JSON):
  ```json
  {
    "oldPassword": "Password123!",
    "newPassword": "NewPassword123!",
    "cPassword": "NewPassword123!"
  }
  ```

### 7. Delete User
- **Method**: DELETE
- **URL**: `https://your-vercel-app.vercel.app/user/delete`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE

### 8. Get User Profile
- **Method**: GET
- **URL**: `https://your-vercel-app.vercel.app/user/profile`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE

### 9. Get User by ID
- **Method**: GET
- **URL**: `https://your-vercel-app.vercel.app/user/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid user ID.

### 10. Forget Password
- **Method**: POST
- **URL**: `https://your-vercel-app.vercel.app/user/forget-password`
- **Auth Required**: No
- **Body** (JSON):
  ```json
  {
    "email": "john.doe@example.com"
  }
  ```
- **Notes**: This will send an OTP to the user's email.

### 11. Change Password (with OTP)
- **Method**: PUT
- **URL**: `https://your-vercel-app.vercel.app/user/change-password`
- **Auth Required**: No
- **Body** (JSON):
  ```json
  {
    "email": "john.doe@example.com",
    "otp": 123456,
    "newPass": "NewPassword123!",
    "cPassword": "NewPassword123!"
  }
  ```
- **Notes**: Use the OTP received via email.

### 12. Google Login
- **Method**: POST
- **URL**: `https://your-vercel-app.vercel.app/user/google-login`
- **Auth Required**: No
- **Body** (JSON):
  ```json
  {
    "idToken": "GOOGLE_ID_TOKEN_HERE"
  }
  ```
- **Notes**: Requires a valid Google OAuth ID token.

## Collections API Endpoints

### 1. Create Collection
- **Method**: POST
- **URL**: `https://your-vercel-app.vercel.app/collections/create`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE
- **Body** (JSON):
  ```json
  {
    "name": "My Collection"
  }
  ```

### 2. Get All Collections
- **Method**: GET
- **URL**: `https://your-vercel-app.vercel.app/collections`
- **Auth Required**: No

### 3. Get Collection by ID
- **Method**: GET
- **URL**: `https://your-vercel-app.vercel.app/collections/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid collection ID.

### 4. Update Collection
- **Method**: PUT
- **URL**: `https://your-vercel-app.vercel.app/collections/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Body** (JSON):
  ```json
  {
    "name": "Updated Collection Name"
  }
  ```
- **Notes**: Replace the ID in the URL with a valid collection ID.

### 5. Delete Collection
- **Method**: DELETE
- **URL**: `https://your-vercel-app.vercel.app/collections/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid collection ID.

## Media API Endpoints

### 1. Upload Single Media
- **Method**: POST
- **URL**: `https://your-vercel-app.vercel.app/media/upload`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE
- **Body** (form-data):
  - `file`: [Select a file]
  - `title`: "My Media Title"
  - `description`: "Optional description"
  - `collectionId`: "65f08c5e1a2b3c4d5e6f7890" (Optional)
- **Notes**: 
  - Supports image and video uploads
  - AI emotion analysis is automatically performed for images and videos
  - Response includes both media information and AI analysis results
  - A record is automatically created with the analysis results

### 2. Upload Multiple Media
- **Method**: POST
- **URL**: `https://your-vercel-app.vercel.app/media/upload/multiple`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE
- **Body** (form-data):
  - `files`: [Select multiple files]
  - `title`: "Common Title" (Optional, can be different per file)
  - `description`: "Optional description" (Optional)
  - `collectionId`: "65f08c5e1a2b3c4d5e6f7890" (Optional)
- **Notes**: 
  - Supports multiple image and video uploads
  - AI emotion analysis is performed for each file
  - Response includes media information and AI analysis results for each file
  - Records are automatically created with analysis results for each file

### 3. Get Media by ID
- **Method**: GET
- **URL**: `https://your-vercel-app.vercel.app/media/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid media ID.

### 4. Delete Media
- **Method**: DELETE
- **URL**: `https://your-vercel-app.vercel.app/media/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: Yes
- **Headers**:
  - `token`: YOUR_JWT_TOKEN_HERE
- **Notes**: Replace the ID in the URL with a valid media ID. Only the uploader can delete the media.

### 5. Get All Media for a Collection
- **Method**: GET
- **URL**: `https://your-vercel-app.vercel.app/media/collection/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid collection ID.

## AI Analysis Integration

The media upload endpoints now automatically process uploaded files through an AI model for emotion detection:

### Response Format for Single Image Upload
```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "data": {
    "_id": "65f08c5e1a2b3c4d5e6f7890",
    "title": "My Image",
    "description": "A test image",
    "fileUrl": "https://res.cloudinary.com/example/image/upload/v1234567890/media_uploads/image.jpg",
    "fileType": "image",
    "format": "jpg",
    "uploadedBy": {
      "_id": "65f08c5e1a2b3c4d5e6f7891",
      "firstName": "John",
      "lastName": "Doe"
    },
    "createdAt": "2023-06-15T10:30:00.000Z",
    "updatedAt": "2023-06-15T10:30:00.000Z"
  },
  "aiAnalysis": {
    "emotion": "happy"
  }
}
```

### Response Format for Video Upload
```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "data": {
    "_id": "65f08c5e1a2b3c4d5e6f7892",
    "title": "My Video",
    "description": "A test video",
    "fileUrl": "https://res.cloudinary.com/example/video/upload/v1234567890/media_uploads/video.mp4",
    "fileType": "video",
    "format": "mp4",
    "uploadedBy": {
      "_id": "65f08c5e1a2b3c4d5e6f7891",
      "firstName": "John",
      "lastName": "Doe"
    },
    "createdAt": "2023-06-15T10:30:00.000Z",
    "updatedAt": "2023-06-15T10:30:00.000Z"
  },
  "aiAnalysis": [
    {
      "timestamp": 0.5,
      "emotion": "neutral"
    },
    {
      "timestamp": 2.3,
      "emotion": "happy"
    },
    {
      "timestamp": 5.7,
      "emotion": "surprise"
    }
  ]
}
```

## General Testing Tips

1. **For file uploads**:
   - In Postman, select the "form-data" option for Body
   - For file fields, click the "Select Files" button and choose your file(s)
   - For text fields, simply add key-value pairs

2. **For authenticated endpoints**:
   - After login, copy the JWT token from the response
   - In the Headers tab, add `token` with value `YOUR_JWT_TOKEN_HERE`
   - Replace `YOUR_JWT_TOKEN_HERE` with the copied JWT token

3. **When testing with IDs**:
   - Always use valid MongoDB ObjectIDs (24 character hex strings)
   - Create resources first, then copy their IDs for use in other endpoints

4. **Response Format**:
   - Successful responses have this format:
     ```json
     {
       "success": true,
       "data": [result data]
     }
     ```
   - Error responses have this format:
     ```json
     {
       "success": false,
       "error": "Error message here"
     }
     ```

5. **Testing sequence**:
   - Start with signup and login to get your authentication token
   - Then create collections
   - Then upload media to those collections
   - Then test retrieval and update operations
   - Finally test delete operations 