import { Schema, model } from "mongoose";

const mediaSchema = new Schema({
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  publicId: {
    type: String,
    required: [true, 'Public ID is required']
  },
  fileType: {
    type: String,
    enum: ['image', 'video'],
    required: [true, 'File type is required']
  },
  format: {
    type: String,
    required: [true, 'File format is required']
  },
  size: {
    type: Number
  },
  collectionId: {
    type: Schema.Types.ObjectId,
    ref: 'Collection'
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  metadata: {
    type: Object,
    default: {}
  },
  aiProcessed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export const Media = model("Media", mediaSchema);
