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
5. Use this token in the Authorization header for authenticated endpoints

## User API Endpoints

### 1. User Signup
- **Method**: POST
- **URL**: `http://localhost:3000/user/signup`
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
- **URL**: `http://localhost:3000/user/verify/YOUR_VERIFICATION_TOKEN`
- **Auth Required**: No
- **Notes**: The verification token is sent to the user's email.

### 3. User Login
- **Method**: POST
- **URL**: `http://localhost:3000/user/login`
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
- **URL**: `http://localhost:3000/user/logout`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE

### 5. Update User Profile
- **Method**: PUT
- **URL**: `http://localhost:3000/user/update`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE
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
- **URL**: `http://localhost:3000/user/update-password`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE
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
- **URL**: `http://localhost:3000/user/delete`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE

### 8. Get User Profile
- **Method**: GET
- **URL**: `http://localhost:3000/user/profile`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE

### 9. Get User by ID
- **Method**: GET
- **URL**: `http://localhost:3000/user/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid user ID.

### 10. Forget Password
- **Method**: POST
- **URL**: `http://localhost:3000/user/forget-password`
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
- **URL**: `http://localhost:3000/user/change-password`
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
- **URL**: `http://localhost:3000/user/google-login`
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
- **URL**: `http://localhost:3000/collections/create`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE
- **Body** (JSON):
  ```json
  {
    "name": "My Collection"
  }
  ```

### 2. Get All Collections
- **Method**: GET
- **URL**: `http://localhost:3000/collections`
- **Auth Required**: No

### 3. Get Collection by ID
- **Method**: GET
- **URL**: `http://localhost:3000/collections/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid collection ID.

### 4. Update Collection
- **Method**: PUT
- **URL**: `http://localhost:3000/collections/65f08c5e1a2b3c4d5e6f7890`
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
- **URL**: `http://localhost:3000/collections/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid collection ID.

## Media API Endpoints

### 1. Upload Single Media
- **Method**: POST
- **URL**: `http://localhost:3000/media/upload`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE
- **Body** (form-data):
  - `file`: Select a file to upload
  - `title`: "My Media Title"
  - `description`: "This is a description of my media upload"
  - `collectionId`: "65f08c5e1a2b3c4d5e6f7890" (Replace with a valid collection ID)
- **Notes**: Use form-data content type in Postman.

### 2. Upload Multiple Media
- **Method**: POST
- **URL**: `http://localhost:3000/media/upload-multiple`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE
- **Body** (form-data):
  - `files`: Select multiple files to upload
  - `title`: "Multiple Media Upload"
  - `description`: "This is a batch upload of multiple files"
  - `collectionId`: "65f08c5e1a2b3c4d5e6f7890" (Replace with a valid collection ID)
- **Notes**: Use form-data content type in Postman.

### 3. Get Media By ID
- **Method**: GET
- **URL**: `http://localhost:3000/media/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid media ID.

### 4. Get Media By Collection
- **Method**: GET
- **URL**: `http://localhost:3000/media/collection/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: No
- **Notes**: Replace the ID in the URL with a valid collection ID.

### 5. Delete Media
- **Method**: DELETE
- **URL**: `http://localhost:3000/media/65f08c5e1a2b3c4d5e6f7890`
- **Auth Required**: Yes
- **Headers**:
  - `Authorization`: Bearer YOUR_JWT_TOKEN_HERE
- **Notes**: Replace the ID in the URL with a valid media ID.

## General Testing Tips

1. **For file uploads**:
   - In Postman, select the "form-data" option for Body
   - For file fields, click the "Select Files" button and choose your file(s)
   - For text fields, simply add key-value pairs

2. **For authenticated endpoints**:
   - After login, copy the JWT token from the response
   - In the Headers tab, add `Authorization` with value `Bearer YOUR_JWT_TOKEN_HERE`
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