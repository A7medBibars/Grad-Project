import { Router } from "express";
import { 
  getAllRecords, 
  getRecord, 
  deleteRecord, 
  assignRecordToCollection 
} from "./records.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";
import { isValid } from "../../middleware/validation.js";
import { recordIdVal, assignRecordToCollectionVal } from "./records.validation.js";

const recordsRouter = Router();

// Get all records
recordsRouter.get(
  "/",
  asyncHandler(getAllRecords)
);

// Get single record
recordsRouter.get(
  "/:recordId",
  isValid(recordIdVal),
  asyncHandler(getRecord)
);

// Assign record to a collection
recordsRouter.post(
  "/:recordId/assign-collection",
  isAuthenticated(),
  isValid(assignRecordToCollectionVal),
  asyncHandler(assignRecordToCollection)
);

// Delete record
recordsRouter.delete(
  "/:recordId",
  isAuthenticated(),
  isValid(recordIdVal),
  asyncHandler(deleteRecord)
);

export default recordsRouter; 