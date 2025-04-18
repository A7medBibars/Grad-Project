import { User } from "../../../db/index.js";
import { AppError } from "../../utils/appError.js";
import { emailStatus, roles, status } from "../../utils/constants/enums.js";
import { messages } from "../../utils/constants/messages.js";
import { sendEmail } from "../../utils/email.js";
import { generateOTP } from "../../utils/otp.js";
import { hashPassword } from "../../utils/pass.js";
import { generateToken, verifyToken } from "../../utils/token.js";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";

dotenv.config({ path: "./config/.env" });

//signup
export const signup = async (req, res, next) => {
  //get data
  let { firstName, lastName, email, password, phone, DOB } = req.body;

  // check if user exist
  const userExist = await User.findOne({ $or: [{ email }, { phone }] });
  if (userExist) {
    return next(new AppError(messages.user.alreadyExist, 409));
  }

  //prepare data
  //hash password
  password = hashPassword({ password, saltRound: 8 });
  //send otp
  const otp = generateOTP();

  // create user
  const user = new User({
    firstName,
    lastName,
    email,
    password,
    phone,
    DOB,
  });

  //add to db
  const createdUser = await user.save();
  if (!createdUser) {
    return next(new AppError(messages.user.failToCreate, 500));
  }
  //generate token
  const token = generateToken({ payload: { email, _id: createdUser._id } });

  // Send verification email
  const verificationLink = `${req.protocol}://${req.headers.host}/user/verify/${token}`;
  await sendEmail({
    to: email,
    subject: "Verify Your Account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333;">Account Verification</h2>
        <p>Thank you for registering! Please verify your account by clicking the link below:</p>
        <p style="margin: 20px 0;">
          <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Account</a>
        </p>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p style="word-break: break-all;">${verificationLink}</p>
        <p>This link will expire in 24 hours.</p>
      </div>
    `,
  });

  // send response
  return res.status(201).json({
    message: messages.user.createSuccessfully,
    success: true,
    data: createdUser,
  });
};

//verify email
export const verifyAcc = async (req, res, next) => {
  // get date from req
  const { token } = req.params;
  const payload = verifyToken({ token });

  await User.findOneAndUpdate(
    { email: payload.email, emailStatus: emailStatus.PENDING },
    { emailStatus: emailStatus.VERIFIED }
  );
  return res
    .status(200)
    .json({ message: messages.user.verified, success: true });
};

//login
export const login = async (req, res, next) => {
  //get data
  const { email, phone, password } = req.body;
  //check if user exist
  const userExist = await User.findOne({
    $or: [{ email }, { phone }],
    emailStatus: emailStatus.VERIFIED,
  });
  if (!userExist) {
    return next(new AppError(messages.user.invalidCredentials, 400));
  }
  //check password
  const match = bcrypt.compareSync(password, userExist.password);
  if (!match) {
    return next(new AppError(messages.user.invalidCredentials, 400));
  }
  //generate token
  const token = generateToken({ payload: { email, _id: userExist._id } });

  //update status
  await User.findOneAndUpdate(
    { _id: userExist._id },
    { status: status.ONLINE }
  );

  // send response
  return res.status(200).json({
    message: "login successfully",
    success: true,
    token,
  });
};

// update
export const updateUser = async (req, res, next) => {
  //check if user exist
  const userExist = await User.findOne({ _id: req.authUser._id });
  if (!userExist) {
    return next(new AppError(messages.user.notFound, 404));
  }
  //check if owner
  if (userExist._id.toString() !== req.authUser._id.toString()) {
    return next(new AppError(messages.user.notAuthorized, 403));
  }

  //check if email exist
  if (req.body.email) {
    const emailExists = await User.findOne({ email: req.body.email });
    if (
      emailExists &&
      emailExists._id.toString() !== req.authUser._id.toString()
    ) {
      return next(new AppError(messages.user.alreadyExist, 409));
    }
  }

  //check if phone exist
  if (req.body.phone) {
    const phoneExist = await User.findOne({ phone: req.body.phone });
    if (
      phoneExist &&
      phoneExist._id.toString() !== req.authUser._id.toString()
    ) {
      return next(new AppError(messages.user.alreadyExist, 409));
    }
  }

  //   if (phone && phone !== userExist.phone) {
  //     const phoneExist = await User.findOne({ phone });
  //     if (phoneExist) {
  //       return next(new AppError(messages.user.phoneExist, 409));
  //     }
  //   }

  //update user
  const updatedUser = await User.findOneAndUpdate(
    { _id: req.authUser._id },
    req.body,
    { new: true }
  );
  if (!updatedUser) {
    return next(new AppError(messages.user.failToUpdate, 404));
  }

  //send response
  return res.status(200).json({
    message: messages.user.updateSuccessfully,
    success: true,
    data: updatedUser,
  });
};

// delete
export const deleteUser = async (req, res, next) => {
  //check if user exist
  const userExist = await User.findOne({ _id: req.authUser._id });
  if (!userExist) {
    return next(new AppError(messages.user.notFound, 404));
  }

  //check if owner
  if (userExist._id.toString() !== req.authUser._id.toString()) {
    return next(new AppError(messages.user.notAuthorized, 403));
  }

  //delete user
  const deletedUser = await User.deleteOne({ _id: req.authUser._id });
  if (!deletedUser || deletedUser.deletedCount === 0) {
    return next(new AppError(messages.user.failToDelete, 404));
  }

  //send response
  return res.status(200).json({
    message: messages.user.deleteSuccessfully,
    success: true,
  });
};

// forgot password
export const forgetPassword = async (req, res, next) => {
  const { email } = req.body;

  //check existence
  const userExist = await User.findOne({ email });

  if (!userExist) {
    return next(new AppError(messages.user.notFound, 404));
  }

  //check if user already has an active OTP
  if (userExist.otp && userExist.otpExpiry > Date.now()) {
    return next(new AppError("An OTP has already been sent. Please check your email or wait for it to expire.", 400));
  }

  //generate new OTP
  const otp = generateOTP();
  const otpExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes expiry

  //update user with new OTP
  userExist.otp = otp;
  userExist.otpExpiry = otpExpiry;
  
  //save to db
  await userExist.save();

  //send email
  await sendEmail({
    to: email,
    subject: "Password Reset Request",
    html: `<h1>Password Reset OTP</h1>
           <p>You have requested to reset your password. Use the following OTP to proceed:</p>
           <h2 style="color: #4CAF50; font-size: 24px; padding: 10px; background-color: #f5f5f5; text-align: center;">${otp}</h2>
           <p>This OTP will expire in 15 minutes.</p>
           <p>If you did not request this password reset, please ignore this email.</p>`,
  });

  return res.status(200).json({
    success: true,
    message: "Password reset OTP sent successfully to your email",
  });
};

//change password
export const changePassword = async (req, res, next) => {
  const { otp, newPass, email } = req.body;

  //check existence
  const userExist = await User.findOne({ email });

  if (!userExist) {
    return next(new AppError(messages.user.notFound, 404));
  }

  // Verify OTP
  if (!userExist.otp) {
    return next(new AppError("No OTP found. Please request a password reset first.", 400));
  }

  if (userExist.otp !== otp) {
    return next(new AppError("Invalid OTP. Please check and try again.", 400));
  }

  if (userExist.otpExpiry < Date.now()) {
    return next(new AppError("OTP has expired. Please request a new password reset.", 400));
  }

  //hash new password
  const newHashPassword = hashPassword({ password: newPass, saltRound: 8 });

  // Update password and clear OTP data
  userExist.password = newHashPassword;
  userExist.otp = undefined;
  userExist.otpExpiry = undefined;
  
  //save to db
  await userExist.save();

  return res.status(200).json({
    success: true,
    message: "password changed successfully",
  });
};

// get account
export const getAccount = async (req, res, next) => {
  //check if user exist
  const user = await User.findById({ _id: req.authUser._id });
  if (!user) {
    return next(new AppError(messages.user.notFound, 404));
  }

  //check if owner or admin
  if (
    user._id.toString() !== req.authUser._id.toString() &&
    req.authUser.role !== roles.ADMIN
  ) {
    return next(new AppError(messages.user.notAuthorized, 403));
  }

  //send response
  return res.status(200).json({
    message: messages.user.getSuccessfully,
    success: true,
    data: user,
  });
};

// get data by id
export const getDataById = async (req, res, next) => {
  //check if user exist
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new AppError(messages.user.notFound, 404));
  }

  //send response
  return res.status(200).json({
    message: messages.user.getSuccessfully,
    success: true,
    data: user,
  });
};

//update password (requires old password)
export const updatePassword = async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.authUser._id;

  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError(messages.user.notFound, 404));
  }

  // Verify old password
  const isPasswordValid = bcrypt.compareSync(oldPassword, user.password);
  if (!isPasswordValid) {
    return next(new AppError("Current password is incorrect", 400));
  }

  // Hash new password
  const hashedPassword = hashPassword({ password: newPassword, saltRound: 8 });

  // Update password
  user.password = hashedPassword;
  await user.save();

  // Send confirmation email
  await sendEmail({
    to: user.email,
    subject: "Password Updated",
    html: `<h1>Password Updated</h1>
           <p>Your password has been successfully updated.</p>
           <p>If you did not make this change, please contact support immediately.</p>`,
  });

  return res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
};

//logout
export const logout = async (req, res, next) => {
  const userId = req.authUser._id;
  
  // Update user status to OFFLINE
  await User.findByIdAndUpdate(userId, { status: 'OFFLINE' });
  
  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

// Google OAuth login
export const googleLogin = async (req, res, next) => {
  try {
    // get data from req
    const { idToken } = req.body;
    
    // verify token with google
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // check if user exist
    let userExist = await User.findOne({ email });
    
    if (!userExist) {
      // create new user if doesn't exist
      userExist = await User.create({
        firstName: name.split(' ')[0],
        lastName: name.split(' ').slice(1).join(' '),
        email,
        profilePic: picture,
        emailStatus: emailStatus.VERIFIED, // Google accounts are pre-verified
        googleId: payload.sub // Store Google ID
      });
    }

    // generate token
    const token = generateToken({ 
      payload: { email, _id: userExist._id }
    });
    
    // update user status
    await User.findOneAndUpdate(
      { _id: userExist._id },
      { status: status.ONLINE }
    );

    // send response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: userExist
    });
  } catch (error) {
    return next(new AppError("Google authentication failed: " + error.message, 401));
  }
};
