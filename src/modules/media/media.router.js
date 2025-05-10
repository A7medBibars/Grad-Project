import { Router } from "express";
import { 
  uploadMedia, 
  uploadMultipleMedia, 
  getMedia, 
  deleteMedia, 
  getMediaByCollection,
  processMediaWithAI,
  checkAIAvailability,
  assignMediaToCollection
} from "./media.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isValid } from "../../middleware/validation.js";
import { handleSingleUpload, handleMultipleUploads } from "../../middleware/fileUpload.js";
import { 
  uploadMediaVal, 
  updateMediaVal, 
  getCollectionMediaVal,
  assignCollectionVal
} from "./media.validation.js";

const mediaRouter = Router();

// Check AI availability
mediaRouter.get(
  "/ai-status",
  asyncHandler(checkAIAvailability)
);

// Upload single media file or from URL
// Accepts either a file upload or a mediaUrl in the request body
mediaRouter.post(
  "/upload",
  isAuthenticated(),
  handleSingleUpload(),
  isValid(uploadMediaVal),
  asyncHandler(uploadMedia)
);

// Upload multiple media files or from URLs
// Accepts either file uploads or mediaUrls array in the request body
mediaRouter.post(
  "/upload-multiple",
  isAuthenticated(),
  handleMultipleUploads(),
  isValid(uploadMediaVal),
  asyncHandler(uploadMultipleMedia)
);

// Get all media for a collection - Route order matters! This must come before /:mediaId
mediaRouter.get(
  "/collection/:collectionId",
  isValid(getCollectionMediaVal),
  asyncHandler(getMediaByCollection)
);

// Process existing media with AI
mediaRouter.post(
  "/:mediaId/process-ai",
  isAuthenticated(),
  isValid(updateMediaVal),
  asyncHandler(processMediaWithAI)
);

// Assign media to collection
mediaRouter.post(
  "/:mediaId/assign-collection",
  isAuthenticated(),
  isValid(assignCollectionVal),
  asyncHandler(assignMediaToCollection)
);

// Get media by ID
mediaRouter.get(
  "/:mediaId",
  isValid(updateMediaVal),
  asyncHandler(getMedia)
);

// Delete media
mediaRouter.delete(
  "/:mediaId",
  isAuthenticated(),
  isValid(updateMediaVal),
  asyncHandler(deleteMedia)
);

export default mediaRouter; 