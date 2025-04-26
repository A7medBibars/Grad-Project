import { model, Schema } from "mongoose";
import { emailStatus, roles, status } from "../../src/utils/constants/enums.js";

//schema
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: function() {
        return !this.googleId; // Password is required only if not using Google auth
      },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    DOB: {
      type: String,
      default: new Date(),
    },
    phone: {
      type: String,
      unique: true,
    },
    role: {
      type: String,
      enum: Object.values(roles),
      default: roles.USER,
    },
    status: {
      type: String,
      enum: Object.values(status),
      default: status.OFFLINE,
    },
    emailStatus: {
      type: String,
      enum: Object.values(emailStatus),
      default: emailStatus.PENDING,
    },
    collections: [{
      type: Schema.Types.ObjectId,
      ref: 'Collection'
    }],
    otp: Number,
    otpExpiry: Date,
  },
  { timestamps: true }
);

//model
export const User = model("User", userSchema);
