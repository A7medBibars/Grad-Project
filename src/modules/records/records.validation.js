// This file is kept as a placeholder for future validation schemas 

import Joi from "joi";
import { generalFields } from "../../middleware/validation.js";

export const recordIdVal = {
  params: Joi.object({
    recordId: generalFields.objectId.required().messages({
      'string.hex': 'Record ID must be a valid hex string',
      'string.length': 'Record ID must be exactly 24 characters',
      'any.required': 'Record ID is required'
    })
  })
};

export const assignRecordToCollectionVal = {
  params: Joi.object({
    recordId: generalFields.objectId.required().messages({
      'string.hex': 'Record ID must be a valid hex string',
      'string.length': 'Record ID must be exactly 24 characters',
      'any.required': 'Record ID is required'
    })
  }),
  body: Joi.object({
    collectionId: generalFields.objectId.required().messages({
      'string.hex': 'Collection ID must be a valid hex string',
      'string.length': 'Collection ID must be exactly 24 characters',
      'any.required': 'Collection ID is required'
    })
  })
}; 