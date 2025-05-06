import { Router } from "express";
import { getAllRecords, getRecord, deleteRecord } from "./records.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { isAuthenticated } from "../../middleware/authentication.js";

const recordsRouter = Router();

// Get all records
recordsRouter.get(
  "/",
  asyncHandler(getAllRecords)
);

// Get single record
recordsRouter.get(
  "/:recordId",
  asyncHandler(getRecord)
);

// Delete record
recordsRouter.delete(
  "/:recordId",
  isAuthenticated(),
  asyncHandler(deleteRecord)
);

export default recordsRouter; 