import { model, Schema } from "mongoose";

const collectionSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  records: [
    {
      type: Schema.Types.ObjectId,
      ref: "Record",
    },
  ],
},
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

collectionSchema.virtual("users", {
  ref: "User",
  localField: "createdBy",
  foreignField: "_id",
});

collectionSchema.virtual("record", {
  ref: "Record",
  localField: "records",
  foreignField: "_id",
});

export const Collection = model("Collection", collectionSchema);

