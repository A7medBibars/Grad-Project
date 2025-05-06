import { Router } from "express";
import { 
  createCollection, 
  getAllCollections, 
  getCollection, 
  updateCollection, 
  deleteCollection,
  addRecordToCollection,
  removeRecordFromCollection
} from "./collections.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isValid } from "../../middleware/validation.js";
import { createCollectionVal, updateCollectionVal, addRecordToCollectionVal } from "./collections.validation.js";

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

// add record to collection
collectionRouter.post(
  "/:collectionId/records",
  isAuthenticated(),
  isValid(addRecordToCollectionVal),
  asyncHandler(addRecordToCollection)
);

// remove record from collection
collectionRouter.delete(
  "/:collectionId/records/:recordId",
  isAuthenticated(),
  asyncHandler(removeRecordFromCollection)
);

export default collectionRouter;