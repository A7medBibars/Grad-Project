import { Media } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";
import { messages } from "../../utils/constants/messages.js";

// Upload a single file
export const uploadMedia = async (req, res, next) => {
  // get data
  const file = req.file;
  if (!file) {
    return next(new AppError(messages.media.fileRequired, 400));
  }
  const { title, description, collectionId } = req.body;

  // upload to cloudinary
  const folder = 'media_uploads';
  const cloudinaryResult = await uploadToCloudinary(file, folder);
  if (!cloudinaryResult) {
    return next(new AppError(messages.media.uploadFailed, 500));
  }

  // prepare data
  const media = new Media({
    title,
    description,
    fileUrl: cloudinaryResult.url,
    publicId: cloudinaryResult.public_id,
    fileType: cloudinaryResult.resource_type,
    format: cloudinaryResult.format,
    size: file.size,
    collectionId: collectionId || null,
    uploadedBy: req.authUser._id
  });

  // save data
  const savedMedia = await media.save();
  if (!savedMedia) {
    // Rollback cloudinary upload
    await deleteFromCloudinary(cloudinaryResult.public_id, cloudinaryResult.resource_type);
    return next(new AppError(messages.media.failToSave, 500));
  }

  // populate the user who uploaded the media
  const populatedMedia = await Media.findById(savedMedia._id).populate(
    "uploadedBy",
    "firstName lastName"
  );

  // send response
  res.status(201).json({
    success: true,
    message: messages.media.uploadSuccess,
    data: populatedMedia
  });
};

// Upload multiple files
export const uploadMultipleMedia = async (req, res, next) => {
  // get data
  const files = req.files;
  if (!files || files.length === 0) {
    return next(new AppError(messages.media.filesRequired, 400));
  }
  const { title, description, collectionId } = req.body;

  // Keep track of uploaded files for rollback
  const uploadedFiles = [];
  
  // process each file
  const uploadPromises = files.map(async (file) => {
    // upload to cloudinary
    const folder = 'media_uploads';
    const cloudinaryResult = await uploadToCloudinary(file, folder);
    if (!cloudinaryResult) {
      throw new AppError(messages.media.uploadFailed, 500);
    }

    // Track uploaded file for potential rollback
    uploadedFiles.push({
      public_id: cloudinaryResult.public_id,
      resource_type: cloudinaryResult.resource_type
    });

    // prepare data
    const media = new Media({
      title,
      description,
      fileUrl: cloudinaryResult.url,
      publicId: cloudinaryResult.public_id,
      fileType: cloudinaryResult.resource_type,
      format: cloudinaryResult.format,
      size: file.size,
      collectionId: collectionId || null,
      uploadedBy: req.authUser._id
    });

    // save data
    const savedMedia = await media.save();
    if (!savedMedia) {
      throw new AppError(messages.media.failToSave, 500);
    }

    return savedMedia._id;
  }).map(p => p.catch(e => e)); // Handle individual promise rejections

  // execute all uploads and handle errors
  const results = await Promise.all(uploadPromises);
  
  // Check for errors
  const errors = results.filter(result => result instanceof Error);
  if (errors.length > 0) {
    // Rollback all successful uploads
    for (const file of uploadedFiles) {
      await deleteFromCloudinary(file.public_id, file.resource_type);
    }
    return next(new AppError(errors[0].message || messages.media.uploadFailed, 500));
  }

  // Get successful uploads
  const mediaIds = results;

  // populate uploaded media
  const populatedMedia = await Media.find({
    _id: { $in: mediaIds }
  }).populate("uploadedBy", "firstName lastName");

  // send response
  res.status(201).json({
    success: true,
    message: messages.media.multipleUploadSuccess,
    data: populatedMedia
  });
};

// Get media by ID
export const getMedia = async (req, res, next) => {
  // get media id
  const { mediaId } = req.params;
  
  // find media
  const media = await Media.findById(mediaId).populate(
    "uploadedBy",
    "firstName lastName"
  );
  
  // check if media exists
  if (!media) {
    return next(new AppError(messages.media.notFound, 404));
  }
  
  // send response
  res.status(200).json({
    success: true,
    data: media
  });
};

// Delete media
export const deleteMedia = async (req, res, next) => {
  // get media id
  const { mediaId } = req.params;
  
  // check if media exists
  const media = await Media.findById(mediaId);
  if (!media) {
    return next(new AppError(messages.media.notFound, 404));
  }
  
  // check authorization
  if (req.authUser._id.toString() !== media.uploadedBy.toString()) {
    return next(new AppError(messages.media.notAuthorized, 403));
  }
  
  // populate media before deleting
  const populatedMedia = await Media.findById(mediaId).populate(
    "uploadedBy",
    "firstName lastName"
  );
  
  // delete from cloudinary
  const cloudinaryResult = await deleteFromCloudinary(media.publicId, media.fileType);
  if (!cloudinaryResult || !cloudinaryResult.success) {
    return next(new AppError(messages.media.failToDelete, 500));
  }
  
  // delete from database
  const deletedMedia = await Media.findByIdAndDelete(mediaId);
  if (!deletedMedia) {
    return next(new AppError(messages.media.failToDelete, 500));
  }
  
  // send response
  res.status(200).json({
    success: true,
    message: messages.media.deleteSuccess,
    data: populatedMedia
  });
};

// Get all media for a collection
export const getMediaByCollection = async (req, res, next) => {
  // get collection id
  const { collectionId } = req.params;
  
  // find all media in collection
  const media = await Media.find({ collectionId }).populate(
    "uploadedBy",
    "firstName lastName"
  );
  
  // send response
  res.status(200).json({
    success: true,
    data: media
  });
}; 