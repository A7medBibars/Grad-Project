import { Record, Collection } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { messages } from "../../utils/constants/messages.js";

// Get all records
export const getAllRecords = async (req, res, next) => {
  // Find all records without any filter
  const records = await Record.find()
    .populate("userId", "name email")
    .populate("collectionId", "name");

  if (!records) {
    return next(new AppError("Failed to get records", 500));
  }

  // Send response
  res.status(200).json({
    success: true,
    count: records.length,
    data: records,
  });
};

// Get single record
export const getRecord = async (req, res, next) => {
  // Get record ID
  const { recordId } = req.params;
  
  // Find record
  const record = await Record.findById(recordId)
    .populate("userId", "name email")
    .populate("collectionId", "name");

  if (!record) {
    return next(new AppError("Record not found", 404));
  }

  // Send response
  res.status(200).json({
    success: true,
    data: record,
  });
};

// Delete record
export const deleteRecord = async (req, res, next) => {
  // Get record ID
  const { recordId } = req.params;
  
  // Find record
  const record = await Record.findById(recordId);
  
  if (!record) {
    return next(new AppError("Record not found", 404));
  }
  
  // Check if user is authorized to delete this record
  if (record.userId.toString() !== req.authUser._id.toString()) {
    return next(new AppError("You are not authorized to delete this record", 403));
  }
  
  // Delete record
  const result = await Record.findByIdAndDelete(recordId);
  
  if (!result) {
    return next(new AppError("Failed to delete record", 500));
  }
  
  // If the record was in a collection, remove it from the collection
  if (record.collectionId) {
    await Collection.findByIdAndUpdate(
      record.collectionId,
      { $pull: { records: recordId } }
    );
  }
  
  // Send response
  res.status(200).json({
    success: true,
    message: "Record deleted successfully",
  });
};

// Assign record to collection
export const assignRecordToCollection = async (req, res, next) => {
  // Get data
  const { recordId } = req.params;
  const { collectionId } = req.body;

  // Check if record exists
  const record = await Record.findById(recordId);
  if (!record) {
    return next(new AppError("Record not found", 404));
  }

  // Check if user owns this record
  if (record.userId.toString() !== req.authUser._id.toString()) {
    return next(new AppError("You are not authorized to modify this record", 403));
  }

  // Check if collection exists
  const collection = await Collection.findById(collectionId);
  if (!collection) {
    return next(new AppError("Collection not found", 404));
  }

  // Check if record already exists in collection
  if (collection.records.includes(recordId)) {
    return next(new AppError("Record already exists in this collection", 409));
  }

  // Update record with collection ID
  const updatedRecord = await Record.findByIdAndUpdate(
    recordId,
    { collectionId },
    { new: true }
  ).populate("userId", "name email")
    .populate("collectionId", "name");

  if (!updatedRecord) {
    return next(new AppError("Failed to update record", 500));
  }

  // Update collection records array
  const updatedCollection = await Collection.findByIdAndUpdate(
    collectionId,
    { $addToSet: { records: recordId } },
    { new: true }
  );

  if (!updatedCollection) {
    // Rollback record update if collection update fails
    await Record.findByIdAndUpdate(recordId, { collectionId: record.collectionId || null });
    return next(new AppError("Failed to update collection", 500));
  }

  // Send response
  res.status(200).json({
    success: true,
    message: "Record assigned to collection successfully",
    data: updatedRecord
  });
}; 