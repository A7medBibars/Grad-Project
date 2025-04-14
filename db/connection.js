import mongoose from "mongoose";
export const connectDB = () => {
  mongoose
    .connect("mongodb://127.0.0.1:27017/gradproject")
    .then(() => {
      console.log("db connected successfully");
    })
    .catch((err) => {
      console.log("fail to connect to db");
    });
};
