import joi from "joi";
import { generalFields } from "../../middleware/validation.js";

export const signupVal = joi.object({
  name: generalFields.name.required(),
  email: generalFields.email.required(),
  password: generalFields.password.required(),
  cPassword: generalFields.cPassword.required(),
  phone: generalFields.phone,
  DOB: generalFields.DOB,
});

export const loginVal = joi.object({
  email: generalFields.email.optional(),
  password: generalFields.password.required(),
  phone: generalFields.phone.when("email", {
    is: joi.exist(),
    then: generalFields.phone.optional(),
    otherwise: joi.required(),
  }),
});

export const updateUserVal = joi.object({
  name: generalFields.name,
  email: generalFields.email,
  phone: generalFields.phone,
  DOB: generalFields.DOB.optional(),
});

export const updatePasswordVal = joi.object({
  oldPassword: generalFields.password.required(),
  newPassword: generalFields.password.required(),
  cPassword: joi.string().valid(joi.ref("newPassword")).required(),
});

export const forgetPassVal = joi.object({
  email: generalFields.email.required(),
});

export const changePassVal = joi.object({
  email: generalFields.email.required(),
  otp: joi.number().required(),
  newPass: generalFields.password.required(),
  cPassword: joi.string().valid(joi.ref("newPass")).required(),
});

export const googleLoginVal = {
  body: joi.object({
    idToken: joi.string().required(),
  }),
};
