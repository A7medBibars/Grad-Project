import { model, Schema } from "mongoose";

//schema
const recordsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    collectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Collection',
      required: true
    },
    mediaUrl: {
      type: String,
      required: true
    },
    times: [{
      type: Number
    }],
    emotion: [{
      type: String
    }]
  },
  { timestamps: true }
);

// Add indexes for better query performance
recordsSchema.index({ userId: 1, collectionId: 1 });
recordsSchema.index({ mediaUrl: 1 });

//model
export const Record = model("Record", recordsSchema); 