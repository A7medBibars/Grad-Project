import { Router } from "express";
import { 
  uploadMedia, 
  uploadMultipleMedia, 
  getMedia, 
  deleteMedia, 
  getMediaByCollection,
  processMediaWithAI,
  checkAIAvailability
} from "./media.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isValid } from "../../middleware/validation.js";
import { handleSingleUpload, handleMultipleUploads } from "../../middleware/fileUpload.js";
import { uploadMediaVal, updateMediaVal, getCollectionMediaVal } from "./media.validation.js";

const mediaRouter = Router();

// Check AI availability
mediaRouter.get(
  "/ai-status",
  asyncHandler(checkAIAvailability)
);

// Upload single media file
mediaRouter.post(
  "/upload",
  isAuthenticated(),
  handleSingleUpload(),
  isValid(uploadMediaVal),
  asyncHandler(uploadMedia)
);

// Upload multiple media files
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