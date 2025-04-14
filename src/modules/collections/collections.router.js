import { Router } from "express";
import { 
  createCollection, 
  getAllCollections, 
  getCollection, 
  updateCollection, 
  deleteCollection 
} from "./collections.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isValid } from "../../middleware/validation.js";
import { createCollectionVal, updateCollectionVal } from "./collections.validation.js";

const collectionRouter = Router();

// create collection
collectionRouter.post(
  "/create",
  isAuthenticated(),
  isValid(createCollectionVal),
  asyncHandler(createCollection)
);

// get all collections
collectionRouter.get(
  "/",
  asyncHandler(getAllCollections)
);

// get single collection
collectionRouter.get(
  "/:collectionId",
  asyncHandler(getCollection)
);

// update collection
collectionRouter.put(
  "/:collectionId",
  isValid(updateCollectionVal),
  asyncHandler(updateCollection)
);

// delete collection
collectionRouter.delete(
  "/:collectionId",
  asyncHandler(deleteCollection)
);

export default collectionRouter;