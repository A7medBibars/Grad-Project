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
  
  // Get the record
  const record = await Record.findById(recordId)
    .populate("userId", "name email")
    .populate("collectionId", "name");

  if (!record) {
    return next(new AppError("Record not found", 404));
  }

  // Check if user owns the record
  if (record.userId._id.toString() !== req.authUser._id.toString()) {
    return next(new AppError("You are not authorized to delete this record", 403));
  }

  // Delete record
  const deletedRecord = await Record.findByIdAndDelete(recordId);
  
  if (!deletedRecord) {
    return next(new AppError("Failed to delete record", 500));
  }

  // Remove record from collection
  if (record.collectionId) {
    await Collection.findByIdAndUpdate(
      record.collectionId._id,
      { $pull: { records: recordId } }
    );
  }

  // Send response
  res.status(200).json({
    success: true,
    message: "Record deleted successfully",
    data: record,
  });
}; 