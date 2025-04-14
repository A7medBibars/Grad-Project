import Joi from "joi";
import { generalFields } from "../../middleware/validation.js";

export const createCollectionVal = Joi.object({
  name: generalFields.name.required(),
}).required();

export const updateCollectionVal = Joi.object({
  name: generalFields.name,
  collectionId: generalFields.objectId.required(),
}).required();
