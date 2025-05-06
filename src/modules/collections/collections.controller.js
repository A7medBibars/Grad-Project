import { Collection } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { messages } from "../../utils/constants/messages.js";
import { Record } from "../../../db/index.js";

export const createCollection = async (req, res, next) => {
  //get data
  let { name } = req.body;
  name = name.toLowerCase();
  //check if collection already exists
  const collectionExist = await Collection.findOne({ name });
  if (collectionExist) {
    return next(new AppError(messages.collection.alreadyExist, 409));
  }
  //prepare data
  const collection = new Collection({
    name,
    createdBy: req.authUser._id,
  });
  //save data
  const createdCollection = await collection.save();
  if (!createdCollection) {
    return next(new AppError(messages.collection.failToCreate, 500));
  }

  // Populate the user who created the collection
  const populatedCollection = await Collection.findById(
    createdCollection._id
  ).populate("createdBy", "firstName lastName");

  //send response
  res.status(201).json({
    success: true,
    message: messages.collection.createSuccessfully,
    data: populatedCollection,
  });
};

export const getAllCollections = async (req, res, next) => {
  //get all collections
  const collections = await Collection.find()
    .populate("createdBy", "name")
    .populate("records");
    
  if (!collections) {
    return next(new AppError(messages.collection.failToGet, 500));
  }
  //send response
  res.status(200).json({
    success: true,
    data: collections,
  });
};

export const getCollection = async (req, res, next) => {
  //get collection by id
  const { collectionId } = req.params;
  const collection = await Collection.findById(collectionId)
    .populate("createdBy", "name")
    .populate("records");
    
  if (!collection) {
    return next(new AppError(messages.collection.notFound, 404));
  }
  //send response
  res.status(200).json({
    success: true,
    data: collection,
  });
};

export const updateCollection = async (req, res, next) => {
  //get data
  let { name } = req.body;
  name = name?.toLowerCase();
  const { collectionId } = req.params;

  //check if collection exists
  const collection = await Collection.findById(collectionId);
  if (!collection) {
    return next(new AppError(messages.collection.notFound, 404));
  }


  //check if new name already exists
  if (name && name !== collection.name) {
    const nameExists = await Collection.findOne({ name });
    if (nameExists) {
      return next(new AppError(messages.collection.alreadyExist, 409));
    }
  }

  //prepare data
  const updateData = name ? { name } : {};

  //update data
  const updatedCollection = await Collection.findByIdAndUpdate(
    collectionId,
    updateData,
    { new: true, runValidators: true }
  );
  if (!updatedCollection) {
    return next(new AppError(messages.collection.failToUpdate, 500));
  }

  // Populate the user who created the collection
  const populatedCollection = await Collection.findById(collectionId).populate(
    "createdBy",
    "name"
  );

  //send response
  res.status(200).json({
    success: true,
    message: messages.collection.updateSuccessfully,
    data: populatedCollection,
  });
};

export const deleteCollection = async (req, res, next) => {
  //check if collection exists
  const { collectionId } = req.params;
  const collection = await Collection.findById(collectionId);
  if (!collection) {
    return next(new AppError(messages.collection.notFound, 404));
  }

  // Populate the user who created the collection before deleting
  const populatedCollection = await Collection.findById(collectionId).populate(
    "createdBy",
    "name"
  );

  //delete data
  const deletedCollection = await Collection.findByIdAndDelete(collectionId);
  if (!deletedCollection) {
    return next(new AppError(messages.collection.failToDelete, 500));
  }

  //send response
  res.status(200).json({
    success: true,
    message: messages.collection.deleteSuccessfully,
    data: populatedCollection,
  });
};

export const addRecordToCollection = async (req, res, next) => {
  // Get data
  const { collectionId } = req.params;
  const { recordId } = req.body;

  // Check if collection exists
  const collection = await Collection.findById(collectionId);
  if (!collection) {
    return next(new AppError(messages.collection.notFound, 404));
  }

  // Check if record exists
  const record = await Record.findById(recordId);
  if (!record) {
    return next(new AppError("Record not found", 404));
  }

  // Check if record already exists in collection
  if (collection.records.includes(recordId)) {
    return next(new AppError("Record already exists in this collection", 409));
  }

  // Add record to collection
  const updatedCollection = await Collection.findByIdAndUpdate(
    collectionId,
    { $push: { records: recordId } },
    { new: true, runValidators: true }
  ).populate("createdBy", "firstName lastName")
    .populate("records");

  if (!updatedCollection) {
    return next(new AppError("Failed to add record to collection", 500));
  }

  // Also update the record's collectionId if needed
  await Record.findByIdAndUpdate(recordId, { collectionId });

  // Send response
  res.status(200).json({
    success: true,
    message: "Record added to collection successfully",
    data: updatedCollection,
  });
};


export const removeRecordFromCollection = async (req, res, next) => {
  // Get data
  const { collectionId, recordId } = req.params;

  // Check if collection exists
  const collection = await Collection.findById(collectionId);
  if (!collection) {
    return next(new AppError(messages.collection.notFound, 404));
  }

  // Check if record exists in collection
  if (!collection.records.includes(recordId)) {
    return next(new AppError("Record not found in this collection", 404));
  }

  // Remove record from collection
  const updatedCollection = await Collection.findByIdAndUpdate(
    collectionId,
    { $pull: { records: recordId } },
    { new: true, runValidators: true }
  ).populate("createdBy", "firstName lastName")
    .populate("records");

  if (!updatedCollection) {
    return next(new AppError("Failed to remove record from collection", 500));
  }

  // Send response
  res.status(200).json({
    success: true,
    message: "Record removed from collection successfully",
    data: updatedCollection,
  });
};
