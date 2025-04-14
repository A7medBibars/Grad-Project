import joi from "joi";
import { AppError } from "../utils/appError.js";
/**
 * Validates that the given value is a valid JSON array of strings.
 *
 * @function parseArray
 * @param {string} value the value to validate
 * @param {function} helper joi helper function to return errors
 * @returns {boolean} true if the value is valid, error message if not
 */
const parseArray = (value, helper) => {
  let data = value
  let schema = joi.array().items(joi.string());
  const { error } = schema.validate(data);

  if (error) {
    return helper(error.details);
  }
  return true;
};
export const generalFields = {
  name: joi.string(),
  description: joi.string().max(2000),
  objectId: joi.string().hex().length(24),
  email: joi.string().email(),
  phone: joi
    .string()
    .pattern(new RegExp(/^(00201|\+201|01)[0-2,5]{1}[0-9]{8}$/)),
  password: joi
    .string()
    .pattern(
      new RegExp(
        /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/
      )
    ),
  cPassword: joi.string().valid(joi.ref("password")),
  DOB: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),

};

/**
 * Middleware to validate the given request with the given schema.
 *
 * @param {Object} schema the schema to validate the request with
 * @returns {function} a middleware that will validate the request and return a 400 error if it fails
 */
export const isValid = (schema) => {
  return (req, res, next) => {
    let data = { ...req.body, ...req.query, ...req.params };
    const { error } = schema.validate(data, { abortEarly: false });
    if (error) {
      const errArr = [];
      error.details.forEach((err) => errArr.push(err.message));

      return next(new AppError(errArr, 400));
    }
    next();
  };
};
